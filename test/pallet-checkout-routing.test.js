'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../BuyNowPilot');
const source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8');
const pallet=[{pid:'22444',code:'ASC',quantity:30,unit:'bag'},{pid:'23297',code:'EPALLETS',quantity:1,unit:'ea'}];
test('every native pallet-rule product remains excluded from Quick Buy mutations',()=>{
  const rowSource=fs.readFileSync(require.resolve('../ShoppingCartRow.js'),'utf8');
  const rules=rowSource.slice(rowSource.indexOf('  var WL_EPALLET_RULES ='),rowSource.indexOf('  var WL_EPALLET_RULES_BY_CODE'));
  const nativeIds=[...rules.matchAll(/\b(\d+):\s*\{/g)].map(match=>match[1]);
  assert.ok(nativeIds.includes('22444'));
  for(const pid of [...nativeIds,'23297'])assert.throws(()=>core.lines([{pid,code:'SKU',quantity:1,unit:'ea'}]),/Pallet/,pid);
});
test('compact cart review verifies both pallet lines and rejects missing or changed quantities',()=>{
  const rows=pallet.map(item=>({code:item.code,quantity:item.quantity,unit:item.unit}));
  assert.doesNotThrow(()=>core.assertReview(rows,pallet,true));
  assert.throws(()=>core.assertReview(rows,pallet),/Pallet/);
  assert.throws(()=>core.assertReview(rows.slice(0,1),pallet,true),/differs/);
  assert.throws(()=>core.assertReview([{...rows[0],quantity:29},rows[1]],pallet,true),/differs/);
});
function start(options={}) {
  const calls=[];
  const context=vm.createContext({ENABLE_CART_CHECKOUT:true,overlay:null,busy:false,cartEntry:false,fast:null,frame:null,scope:'scope',branch:'1',owner:'owner',guest:null,
    doc:{},win:{sessionStorage:{getItem:k=>k==='wl_fulfillment_intent'?'pickup':k==='wl_fulfillment_selection_source_v1'?'user':null},crypto:{randomUUID:()=> 'test'}},
    withLock:async fn=>fn(),shell(){calls.push('compact');context.overlay={querySelector:()=>({})};},showPreview(){},loading(){},status(){},record:()=>options.recovery?{}:null,
    assertNoPendingCartOrder(){if(options.uncertain)throw Error('uncertain');},cartFromDocument:(doc,allow)=>{assert.equal(allow,true);return {items:pallet};},
    newFast:opts=>({...opts,dirty:false}),renderFast(){},updatePickupReadiness(){},updateFastOptions(){},seedSession(){},warmPickupStock(){},
    openFrame(){calls.push('frame');context.frame={contentDocument:null};},
    cart:async allow=>{assert.equal(allow,true);calls.push('verify cart');return {items:options.changed?[pallet[0]]:pallet};},
    checkIdentity:async()=>{calls.push('identity');if(options.identity)throw Error('identity');},purchaseRestrictions:async()=>new Set(options.blocked?['22444']:[]),
    hasCustomCuts:()=>false,nativeCartSignature:core.nativeCartSignature,measureCheckout(){},cancelPending:false});
  vm.runInContext(source.slice(source.indexOf('    async function startCart('),source.indexOf('    function bindCartEntry(')),context);
  return {context,calls,run:()=>context.startCart()};
}
test('ASC30 and its pallet stay in compact checkout through read-only cart verification',async()=>{
  const f=start();await f.run();assert.equal(f.calls[0],'compact');assert.ok(f.calls.includes('frame'));assert.ok(f.calls.includes('identity'));assert.ok(f.calls.includes('verify cart'));
  assert.equal(f.context.active.cartCheckout,true);assert.equal(core.nativeCartSignature(f.context.active.current),core.nativeCartSignature(pallet));assert.equal(f.context.busy,false);
});
test('compact pallet entry retains recovery, uncertain-order, identity, changed-cart and restricted-item guards',async()=>{
  for(const option of ['recovery','uncertain','identity','changed','blocked']) {const f=start({[option]:true});await assert.rejects(f.run());}
});
