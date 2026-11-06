'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(require.resolve(p),'utf8');
const before=read('./fixtures/customization-loader-before.txt'),after=read('../config/webtrack-customizations-inline.js');
function scriptsFor(source,path,values={},touch=false) {
  const scripts=[],loc=new URL(path,'https://webtrack.woodsonlumber.com');
  const doc={readyState:'loading',addEventListener(){},createElement:tag=>({tag}),head:{appendChild(el){if(el.src)scripts.push(el.src);}}};
  const win={location:loc,matchMedia:()=>({matches:touch})};
  const context=vm.createContext({window:win,document:doc,location:loc,navigator:{maxTouchPoints:touch?1:0},matchMedia:win.matchMedia,URLSearchParams,console:{log(){}},sessionStorage:{getItem:key=>values[key]||null}});
  vm.runInContext(source,context);return scripts.map(src=>new URL(src).pathname.split('/').pop());
}
test('the prepared loader preserves every existing DOM rendering callback byte for byte',()=>{
  const block=source=>source.slice(source.indexOf('// ---------------- DOM behaviors (merged)'),source.indexOf('// ---------------- external script loads'));
  assert.equal(block(after),block(before));
});
test('sign-in return URLs cannot load account, checkout, product or default-page code',()=>{
  for(const destination of ['AccountInfo_R.aspx','AccountPayment_r.aspx','ShoppingCart.aspx','Products.aspx','ProductDetail.aspx','Default.aspx','Invoices_r.aspx']) {
    const path='/SignIn.aspx?Redirect='+encodeURIComponent('https://webtrack.woodsonlumber.com/'+destination);
    assert.deepEqual(scriptsFor(after,path),['UserSignUpEmailRestriction.js'],destination);
    assert.ok(scriptsFor(before,path).length>1,'the original loader did load the unrelated page');
  }
});
test('all unchanged page families retain their original feature modules and order',()=>{
  for(const path of ['ProductDetail.aspx?pid=14893','AccountInfo_R.aspx','OpenOrders_r.aspx','Invoices_r.aspx','OpenQuotes_r.aspx','AccountPayment_r.aspx','CreditNotes_r.aspx','Statements_R.aspx','Quicklists_R.aspx','ProductsPurchased_R.aspx','CustomerTokens.aspx','UserSignup.aspx','SignIn.aspx','ResetPassword.aspx','AccountSettings.aspx','Default.aspx','Contacts_r.aspx','Dashboards.aspx','Help.aspx','AboutUs.aspx']) {
    assert.deepEqual(scriptsFor(after,'/'+path),scriptsFor(before,'/'+path),path);
  }
});
test('ordinary product pages skip only the three modules whose existing entry guards would return',()=>{
  const old=scriptsFor(before,'/Products.aspx'),current=scriptsFor(after,'/Products.aspx');
  assert.deepEqual(current,old.filter(file=>!['default.js','storelocations.js','brenham.js'].includes(file)));
  for(const flags of [{storeMode:'on'},{storeProximity:'true'}])assert.ok(scriptsFor(after,'/Products.aspx',flags).includes('default.js'));
});
test('legacy location hub and all seven store routes retain their original renderers',()=>{
  for(const key of ['pg','pl1']) {
    assert.ok(scriptsFor(after,'/Products.aspx?'+key+'=4731').includes('storelocations.js'));
    for(let id=4733;id<=4739;id++)assert.ok(scriptsFor(after,'/Products.aspx?'+key+'='+id).includes('brenham.js'));
  }
  assert.ok(scriptsFor(after,'/Products.aspx?pg=4731&pl1=4733').includes('storelocations.js'));
  assert.ok(scriptsFor(after,'/Products.aspx?pg=4731&pl1=4733').includes('brenham.js'));
});
test('cart uses the existing stage-aware native-view loader and retains the other runtime modules',()=>{
  const old=scriptsFor(before,'/ShoppingCart.aspx'),current=scriptsFor(after,'/ShoppingCart.aspx');
  assert.deepEqual(current,old.map(file=>file==='Checkout2.js'?'CartNativeViews.js':file).filter(file=>file!=='CardContainer.js'));
});
test('address pages leave their single manager to the modern header',()=>{
  assert.deepEqual(scriptsFor(before,'/AddressList_R.aspx'),['AddressManagement.js']);
  assert.deepEqual(scriptsFor(after,'/AddressList_R.aspx'),[]);
  assert.deepEqual(scriptsFor(after,'/AddressDetails.aspx'),[]);
});

test('mobile browsing loads the scanner handoff without preloading the camera library',()=>{
  for(const path of ['/Products.aspx','/ProductDetail.aspx?pid=14893']) {
    const old=scriptsFor(before,path,{},true),current=scriptsFor(after,path,{},true);
    assert.ok(old.includes('quagga.min.js'));
    assert.ok(current.includes('BarcodeScanner.js'));
    assert.ok(!current.includes('quagga.min.js'));
  }
  assert.ok(!scriptsFor(after,'/SignIn.aspx?Redirect=Products.aspx',{},true).includes('BarcodeScanner.js'));
});
