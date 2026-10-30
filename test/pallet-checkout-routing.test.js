'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../BuyNowPilot');
const source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8');
const helpers=source.slice(source.indexOf('  function hasPalletCart('),source.indexOf('  var STATE_NAMES'));
const ids=source.match(/var PALLET_PRODUCTS = new Set\('([^']+)'/)[1].split(',');
function page(items) {
  return {querySelectorAll:()=>items.map(([pid,code])=>({querySelectorAll:()=>[
    {textContent:code,getAttribute:()=>'/ProductDetail.aspx?pid='+pid}
  ]}))};
}
function helper() {
  const context=vm.createContext({PALLET_PRODUCTS:new Set(ids),text:value=>String(value??'').replace(/\s+/g,' ').trim(),pidOf:value=>String(value).match(/[?&]pid=(\d+)(?:&|$)/i)?.[1]||''});
  vm.runInContext(helpers,context);return context.hasPalletCart;
}
test('ASC and every native pallet-rule product use native routing, including before the pallet has been added',()=>{
  const detect=helper();
  const rowSource=fs.readFileSync(require.resolve('../ShoppingCartRow.js'),'utf8');
  const rules=rowSource.slice(rowSource.indexOf('  var WL_EPALLET_RULES ='),rowSource.indexOf('  var WL_EPALLET_RULES_BY_CODE'));
  const nativeIds=[...rules.matchAll(/\b(\d+):\s*\{/g)].map(match=>match[1]);
  assert.ok(nativeIds.includes('22444'));
  for(const pid of [...nativeIds,'23297'])assert.equal(detect(page([[pid,'SKU']])),true,pid);
  assert.equal(detect(page([['22444','ASC'],['23297','EPALLETS']])),true);
});
test('pallet aliases route natively and ordinary or empty carts keep compact checkout',()=>{
  const detect=helper();
  for(const code of ['EPALLETS','E-Pallet','Concrete'])assert.equal(detect(page([['23297',code]])),true);
  assert.equal(detect(page([['999999','EPALLETS']])),true);
  assert.equal(detect(page([['57927','HARDWARE']])),false);
  assert.equal(detect(page([])),false);
});
test('Quick Buy still rejects pallet mutations after the cart routing fix',()=>{
  assert.throws(()=>core.lines([{pid:'22444',quantity:30,code:'ASC',unit:'Bag'}]),/Pallet-handling/);
  assert.throws(()=>core.lines([{pid:'23297',quantity:1,code:'EPALLETS',unit:'ea'}]),/Pallet/);
});
function route(options={}) {
  const events=[];
  const native={disabled:!!options.disabled,getAttribute:()=>options.ariaDisabled?'true':null,click(){assert.equal(context.bypassCartEntry,true);events.push('native click');}};
  const context=vm.createContext({ENABLE_CART_CHECKOUT:true,overlay:null,busy:false,cartEntry:false,bypassCartEntry:false,
    hasPalletCart:()=>true,doc:{getElementById:()=>options.missing?null:native},
    withLock:async work=>work(),releaseLock:()=>events.push('release'),record:()=>options.recovery?{}:null,
    assertNoPendingCartOrder(){events.push('order guard');if(options.uncertain)throw new Error('unconfirmed order');},
    async checkIdentity(){events.push('identity');if(options.identity)throw new Error('identity changed');},
    shell(){throw new Error('compact shell must not open');},seedSession(){throw new Error('compact must not seed native pallet checkout');}
  });
  vm.runInContext(source.slice(source.indexOf('    async function startCart('),source.indexOf('    function bindCartEntry(')),context);
  return {context,events,start:()=>context.startCart()};
}
test('signed-in and guest cart entry verifies identity, clicks native once, releases the lock and never opens compact',async()=>{
  // Both manual cart entry and the post-signup guest start call startCart.
  const f=route();await f.start();
  assert.deepEqual(f.events,['order guard','identity','native click','release']);
  assert.equal(f.context.busy,false);assert.equal(f.context.cartEntry,false);assert.equal(f.context.bypassCartEntry,false);assert.equal(f.context.releaseLock,null);
});
test('pallet routing retains recovery, uncertain-order, account and disabled-control guards',async()=>{
  for(const option of ['recovery','uncertain','identity','disabled','ariaDisabled','missing']) {
    const f=route({[option]:true});await assert.rejects(f.start());
    assert.equal(f.events.includes('native click'),false,option);
    assert.equal(f.events.at(-1),'release',option);assert.equal(f.context.busy,false,option);
  }
});
