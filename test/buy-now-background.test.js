const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const header=fs.readFileSync(path.join(root,'headermodern.js'),'utf8');
const checkout=fs.readFileSync(path.join(root,'Checkout2.js'),'utf8');
function context(owned=true) {
  const win={name:'woodson-buy-now-checkout',location:{origin:'https://webtrack.woodsonlumber.com',pathname:'/ShoppingCart.aspx',search:''}};
  win.parent={location:{origin:win.location.origin},document:{querySelector:()=>owned?{contentWindow:win}:null}};
  return win;
}
function guard(source,win) {
  const fn=source.match(/function isBuyNowFrame\(\) \{[\s\S]*?catch \(_\) \{ return false; \}\n  \}/)[0];
  return vm.runInNewContext('('+fn+')()',{window:win});
}
test('background UI suppression requires the exact same-origin iframe owned by the pilot panel',()=>{
  for(const source of [header,checkout]) {
    assert.equal(guard(source,context()),true);
    assert.equal(guard(source,context(false)),false);
    const main=context();main.parent=main;assert.equal(guard(source,main),false);
    const wrong=context();wrong.name='other-frame';assert.equal(guard(source,wrong),false);
    const foreign=context();foreign.parent.location.origin='https://example.com';assert.equal(guard(source,foreign),false);
    const inaccessible=context();Object.defineProperty(inaccessible.parent,'location',{get(){throw new Error('cross origin')}});assert.equal(guard(source,inaccessible),false);
  }
});
test('owned Buy Now frame keeps native submit rescue without starting header or account lookups',()=>{
  const win=context();let listeners=0,requests=0;
  win.fetch=()=>{requests++;throw new Error('Header lookup should not run')};
  const document={documentElement:{dataset:{}},addEventListener:()=>listeners++,querySelector:()=>{throw new Error('Header rendering should not run')}};
  vm.runInNewContext(header,{window:win,document,location:win.location});
  assert.equal(listeners,1);
  assert.equal(requests,0);
  assert.equal(document.documentElement.dataset.wlBuyNowHeader,'parent');
});
