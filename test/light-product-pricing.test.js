'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {service}=require('../api/cart-pricing')._internal;
const {priceCart,policy}=require('../api/merchandise-pricing');
const ui=require('../LightSaleDetails'),cartUI=require('../CartPricing');
const [white,multi]=['268622','268623'].map(id=>policy.products.find(p=>p.productId===id));
const line=(product,q,unit=1999)=>({productId:product.productId,productCode:product.productCode,quantity:q,netLineTotalCents:q*unit});
const selected=(quantity=1,productId=white.productId)=>({productId,quantity,unitPriceCents:1999});
const catalog=cart=>({fresh:true,active:{id:'fixture-current'},products:cart.map(p=>({...p,price:19.99,weight:1.44}))});
const core=()=>service({getCatalogProducts:async cart=>catalog(cart)});
for(const [q,percent,total] of [[1,25,1499],[3,25,4498],[4,40,4798],[8,40,9595],[9,60,7196]]) test('empty-cart product preview at '+q+' boxes uses checkout cents',async()=>{
 const {pricing,productPreview:p}=await core().previewProduct({cart:[],selectedProduct:selected(q)});
 assert.equal(p.percentOff,percent);assert.equal(p.itemTotalCents,total);assert.equal(p.inCartQuantity,0);assert.equal(p.itemQuantity,q);assert.equal(p.regularUnitPriceCents,1999);
 assert.equal(p.unitPriceCents,Math.round(total/q));assert.equal(p.unitPriceIsAverage,total%q!==0);
 assert.deepEqual(pricing,priceCart([line(white,q)],catalog([line(white,q)])));
});
test('three other eligible boxes plus one selected box reach 40% with the exact allocated cent',async()=>{
 const input={cart:[line(multi,3)],selectedProduct:selected()},before=structuredClone(input);
 const {pricing,productPreview:p}=await core().previewProduct(input);
 assert.equal(p.percentOff,40);assert.equal(p.eligibleQuantity,4);assert.equal(p.itemTotalCents,1200);assert.equal(p.unitPriceIsAverage,false);
 assert.equal(pricing.merchandiseSubtotalCents,4798);assert.deepEqual(input,before);
});
test('eight other boxes plus one selected box reach 60%',async()=>{
 const {productPreview:p}=await core().previewProduct({cart:[line(multi,8)],selectedProduct:selected()});
 assert.equal(p.percentOff,60);assert.equal(p.eligibleQuantity,9);assert.equal(p.itemTotalCents,800);
});
test('existing boxes of this same SKU merge with selected boxes without duplicate lines',async()=>{
 const {pricing,productPreview:p}=await core().previewProduct({cart:[line(white,3)],selectedProduct:selected()});
 assert.equal(pricing.cart.length,1);assert.equal(p.inCartQuantity,3);assert.equal(p.selectedQuantity,1);assert.equal(p.itemQuantity,4);assert.equal(p.itemTotalCents,4798);assert.equal(p.unitPriceIsAverage,true);
});
test('accessories do not qualify and already-discounted light prices are not discounted twice',async()=>{
 const accessory={productId:'255084',productCode:'9964149',quantity:99,netLineTotalCents:79101};
 const {productPreview:p}=await core().previewProduct({cart:[accessory],selectedProduct:selected()});assert.equal(p.percentOff,25);assert.equal(p.eligibleQuantity,1);
 const {pricing,productPreview:r}=await core().previewProduct({cart:[line(multi,3,1000)],selectedProduct:{...selected(),unitPriceCents:1000}});
 assert.equal(pricing.deltaCents,0);assert.equal(r.unitPriceCents,1000);assert.equal(r.itemTotalCents,1000);
});
test('employee views, unverified catalog, invalid selection and inflated native price cannot invent a sale',async()=>{
 assert.equal((await core().previewProduct({cart:[],selectedProduct:selected(),employee:true})).productPreview.percentOff,0);
 for(const change of [{selectedProduct:selected(0)},{selectedProduct:selected(1.5)},{selectedProduct:selected(10001)},{selectedProduct:selected(1,'255084')},{selectedProduct:{...selected(),unitPriceCents:3000}},{cart:null}]) await assert.rejects(core().previewProduct({cart:[],selectedProduct:selected(),...change}));
 await assert.rejects(service({getCatalogProducts:async cart=>({...catalog(cart),fresh:false})}).previewProduct({cart:[],selectedProduct:selected()}));
});
test('a slow same-selection response stays current; superseded quantities and page hides cannot apply it',()=>{
 const r=ui.latestOnly(),first=r.begin('one');assert.equal(r.begin('one'),null);assert.equal(r.current(first),true);
 const next=r.begin('four');assert.equal(r.current(first),false);assert.equal(r.current(next),true);
 const focused=r.begin('four',true);assert.equal(r.current(next),false);r.invalidate();assert.equal(r.current(focused),false);
});
test('a failed or sign-in cart page cannot be treated as an empty basket',()=>{
 assert.deepEqual(ui.readCart({querySelectorAll:()=>[],getElementById:()=>null,body:{textContent:'Your cart is currently empty.'}}),[]);
 for(const message of ['Sign in to continue','Service temporarily unavailable','Shopping cart']) assert.throws(()=>ui.readCart({querySelectorAll:()=>[],getElementById:()=>null,body:{textContent:message}}));
});
test('product preview and checkout read the same native cart row contract and reject incomplete prices',()=>{
 const row={textContent:'Total: $39.98',querySelectorAll:()=>[{getAttribute:()=>'/ProductDetail.aspx?pid=268622'}],querySelector:s=>s.startsWith('input')?{value:'2'}:s==='.portalGridLink,.cart-item-card h6 a'?{textContent:'9086423'}:null};
 const doc={querySelectorAll:()=>[row]};assert.deepEqual(ui.readCart(doc),cartUI.readCart(doc));
 row.textContent='Price unavailable';assert.throws(()=>ui.readCart(doc));
});
