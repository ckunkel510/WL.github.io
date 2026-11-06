'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const router=fs.readFileSync(require.resolve('../PayByInvoice.js'),'utf8');
const legacy=fs.readFileSync(require.resolve('../legacy/PayByInvoice.js'),'utf8');
function run({mode='',path='/AccountPayment_r.aspx',fixture=false}={}) {
  const scripts=[],attrs={};const doc={currentScript:{src:'https://ckunkel510.github.io/WL.github.io/PayByInvoice.js'},documentElement:{getAttribute(name){return name==='data-wl-payment-fixture'&&fixture?'true':null;}},
    querySelector(selector){return scripts.find(s=>selector.includes(s.mark))||null;},createElement(){return {setAttribute(key){this.mark=key;}}},head:{appendChild(script){scripts.push(script);}}};
  const win={location:{pathname:path,href:'https://webtrack.woodsonlumber.com'+path+(mode?'?wl_payment_flow='+mode:'')}};
  const context=vm.createContext({window:win,document:doc,URL,Date,sessionStorage:{getItem:()=>null}});vm.runInContext(router,context);return {context,win,scripts};
}
test('ordinary payment downloads only the unchanged modern module and repeated initialization stays single',()=>{
  const f=run();assert.equal(f.scripts.length,1);assert.match(f.scripts[0].src,/PayByInvoicePreview\.js\?v=20260916-14$/);assert.equal(f.win.__WL_PAYMENT_PREVIEW_ACCOUNT_ID__,'live');
  vm.runInContext(router,f.context);assert.equal(f.scripts.length,1);assert.ok(router.length<3000);
});
test('the explicit native escape hatch loads the preserved legacy route only',()=>{
  const f=run({mode:'native'});assert.equal(f.scripts.length,1);assert.match(f.scripts[0].src,/\/legacy\/PayByInvoice\.js\?v=/);assert.equal(f.win.__WL_PAYMENT_PREVIEW_ACTIVE__,undefined);
  vm.runInContext(router,f.context);assert.equal(f.scripts.length,1);
});
test('sign-in return URLs and other pages cannot start payment customization',()=>{
  const f=run({path:'/SignIn.aspx'});assert.equal(f.scripts.length,0);
});
test('test fixtures retain their existing modern payment route',()=>{
  assert.equal(run({path:'/test/fixtures/pay-by-invoice-flow.html',fixture:true}).scripts.length,1);
});
test('the fallback modules are byte-preserved and perform no DOM work on the modern route',()=>{
  assert.equal(crypto.createHash('sha256').update(legacy).digest('hex'),'169b6638a2b571264392fe12da4129d937c382439dcd7a631f29bb7262d9a0ca');
  const doc=new Proxy({},{get(){throw Error('Disabled legacy modules must not touch the DOM');}});
  vm.runInNewContext(legacy,{window:{__WL_PAYMENT_PREVIEW_ACTIVE__:true},document:doc,location:{pathname:'/AccountPayment_r.aspx'}});
});
