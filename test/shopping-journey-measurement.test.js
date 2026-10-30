'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../wl-site.js'),'utf8');
const helpers=source.slice(source.indexOf('  function queueCartMutation('),source.indexOf('  function listName('));
function fixture(){
 const data=new Map(),events=[],connected=new Set(),root={};connected.add(root);
 const context=vm.createContext({pageToken:'first-page',pendingCartRoot:null,PENDING_CART_KEY:'pending',window:{sessionStorage:{},location:{href:'https://webtrack.woodsonlumber.com/ShoppingCart.aspx'}},document:{documentElement:{contains:node=>connected.has(node)}},cartItems:()=>context.items,safeStorage:(storage,method,key,value)=>method==='get'?data.get(key):method==='remove'?data.delete(key):data.set(key,value),pushEvent:(name,params)=>(events.push({name,...params}),true),ecommerce:(items,value)=>value===null?{items}:{items,value},cleanString:value=>/@/.test(value||'')?null:String(value||'').trim(),text:node=>node?.textContent||'',URL});
 context.items=[{item_id:'85',item_name:'Product',quantity:3,price:2}];
 vm.runInContext(helpers,context);
 return {context,events,root,replace(items){connected.clear();context.items=items;},data};
}
test('optimistic quantity edits cannot emit ecommerce outcomes until native confirmation',()=>{
 const f=fixture(),c=f.context;c.queueCartMutation('quantity',c.items[0],4,f.root);c.items=[{...c.items[0],quantity:4}];
 assert.equal(c.confirmCartMutation(c.items),false);assert.equal(f.events.length,0);
 f.replace(c.items);assert.equal(c.confirmCartMutation(c.items),true);
 assert.deepEqual(f.events.map(e=>e.name),['add_to_cart','cart_quantity_change']);assert.equal(f.events[0].ecommerce.items[0].quantity,1);assert.equal(f.events[0].ecommerce.value,2);
 assert.equal(c.confirmCartMutation(c.items),false);assert.equal(f.events.length,2);
});
test('confirmed dropdown decreases report the removed delta and the new total quantity',()=>{
 const f=fixture(),c=f.context;c.queueCartMutation('quantity',c.items[0],1,f.root);f.replace([{...c.items[0],quantity:1}]);c.confirmCartMutation(c.items);
 assert.equal(f.events[0].name,'remove_from_cart');assert.equal(f.events[0].ecommerce.items[0].quantity,2);assert.equal(f.events[0].ecommerce.value,4);assert.equal(f.events[1].quantity,1);assert.equal(f.events[1].previous_quantity,3);
});
test('failed native delete produces an error instead of a false removal',()=>{
 const f=fixture(),c=f.context;c.queueCartMutation('remove',c.items[0],0,f.root);f.replace(c.items);c.confirmCartMutation(c.items);
 assert.deepEqual(f.events.map(e=>e.name),['cart_action_error']);assert.equal(f.events[0].error_code,'cart_change_not_confirmed');assert.equal(f.events[0].ecommerce.items[0].item_id,'85');assert.equal(f.events[0].previous_quantity,3);assert.equal(f.events[0].requested_quantity,0);assert.equal(f.events[0].quantity,3);
});
test('a confirmed empty cart and Save for Later each report the actual removed line once',()=>{
 for(const kind of ['remove','save']){const f=fixture(),c=f.context;c.queueCartMutation(kind,c.items[0],0,f.root);f.replace([]);c.confirmCartMutation([]);c.confirmCartMutation([]);
 assert.equal(f.events.filter(e=>e.name==='remove_from_cart').length,1);assert.equal(f.events[0].ecommerce.items[0].quantity,3);assert.equal(f.events.filter(e=>e.name==='save_for_later').length,kind==='save'?1:0);}
});
test('Saved for Later addition is proven by the next native cart and uses its actual unit price',()=>{
 const f=fixture(),c=f.context;c.queueCartMutation('add_saved',{...c.items[0],quantity:1,price:0},4,f.root);f.replace([{...c.items[0],quantity:4,price:2.62}]);c.confirmCartMutation(c.items);
 assert.equal(f.events.length,1);assert.equal(f.events[0].name,'add_to_cart');assert.equal(f.events[0].cart_action,'add_saved');assert.equal(f.events[0].ecommerce.items[0].quantity,1);assert.equal(f.events[0].ecommerce.value,2.62);
});
test('stale, corrupt and impossible pending actions fail closed',()=>{
 for(const value of ['broken',JSON.stringify({at:Date.now()-180000,from:'old',kind:'remove',item:{item_id:'85'},before:3,after:0}),JSON.stringify({at:Date.now(),from:'old',kind:'quantity',item:{item_id:'85'},before:3,after:-1})]){
 const f=fixture();f.data.set('pending',value);assert.equal(f.context.confirmCartMutation([]),false);assert.equal(f.events.length,0);assert.equal(f.data.has('pending'),false);}
});
test('cross-document confirmation works without retaining a detached DOM reference',()=>{
 const f=fixture(),c=f.context;c.queueCartMutation('remove',c.items[0],0,f.root);c.pageToken='next-page';c.pendingCartRoot=null;c.confirmCartMutation([]);assert.equal(f.events[0].name,'remove_from_cart');
});
function anchor(href,area,label='Category'){
 return {matches:selector=>selector==='a[href]',getAttribute:()=>href,textContent:label,closest:selector=>selector.includes(area)?{}:null};
}
test('navigation records safe routes and category context without full URLs or customer query values',()=>{
 const f=fixture(),c=f.context;c.trackNavigation(anchor('/Products.aspx?pg=549&secret=private','wl-department-nav','Faucets'));
 assert.equal(f.events[0].name,'navigation_click');assert.equal(f.events[0].navigation_area,'departments');assert.equal(f.events[0].destination_type,'product_category');assert.equal(f.events[0].category_id,'549');assert.equal(f.events[0].category_label,'Faucets');assert.ok(!JSON.stringify(f.events).includes('private'));
 c.trackNavigation(anchor('/AccountInfo_R.aspx?email=private@example.invalid','siteHeaderContent','Personal Name'));assert.ok(!JSON.stringify(f.events).includes('Personal Name'));assert.ok(!JSON.stringify(f.events).includes('private@example.invalid'));
});
test('cart action anchors and unrelated external links cannot masquerade as navigation',()=>{
 const f=fixture();for(const href of ['#','javascript:__doPostBack()','https://other.example/ShoppingCart.aspx','mailto:test@example.invalid'])f.context.trackNavigation(anchor(href,'siteHeaderContent'));assert.equal(f.events.length,0);
});
test('native list impressions require visibility and deduplicate repeated observer callbacks',()=>{
 const events=[],roots=[{pid:'85'},{pid:'97'}];let callback,observed=[];
 roots.forEach(root=>Object.assign(root,{tagName:'DIV',closest:()=>null,querySelectorAll:()=>[],setAttribute(){},getAttribute:()=>String(roots.indexOf(root))}));
 const context=vm.createContext({window:{IntersectionObserver:class{constructor(cb){callback=cb;}observe(root){observed.push(root);}unobserve(){}}},document:{querySelectorAll:()=>roots},productListObserver:null,observedProductRoots:new WeakSet(),observedProductIds:{},pageType:()=> 'product_list',listName:()=> 'Catalog',itemFromRoot:(root,index)=>({item_id:root.pid,index}),ecommerce:items=>({items}),pushEvent:(name,params)=>events.push({name,...params})});
 vm.runInContext(source.slice(source.indexOf('  function emitProductList('),source.indexOf('  function cartItems(')),context);
 context.emitProductList(false);context.emitProductList(true);assert.equal(observed.length,2);assert.equal(events.length,0);
 callback([{target:roots[0],isIntersecting:false,intersectionRatio:0},{target:roots[1],isIntersecting:true,intersectionRatio:.1}]);assert.equal(events.length,0);
 callback([{target:roots[0],isIntersecting:true,intersectionRatio:.5}]);callback([{target:roots[0],isIntersecting:true,intersectionRatio:1}]);assert.equal(events.length,1);assert.equal(events[0].ecommerce.items[0].item_id,'85');
});

test('Saved for Later product selection uses its own card rather than another cart product',()=>{
 const row={},context=vm.createContext({document:{}});vm.runInContext(source.slice(source.indexOf('  function productCardFor('),source.indexOf('  function valueForItems(')),context);
 const chosen=context.productCardFor({closest:selector=>selector.includes('.sflRow')?row:null});assert.equal(chosen,row);
});
test('partial cart rendering cannot confirm changes or report an incomplete basket',()=>{
 const context=vm.createContext({document:{querySelectorAll:()=>['85','97'].map(pid=>({getAttribute:()=>'/ProductDetail.aspx?pid='+pid}))},productIdFromLink:link=>new URL(link.getAttribute('href'),'https://example.test').searchParams.get('pid')});
 vm.runInContext(source.slice(source.indexOf('  function cartFullyRendered('),source.indexOf('  function emitViewCart(')),context);
 assert.equal(context.cartFullyRendered([{item_id:'85'}]),false);assert.equal(context.cartFullyRendered([{item_id:'85'},{item_id:'97'}]),true);assert.equal(context.cartFullyRendered([]),false);
});
