'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../BuyNowPilot'),source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8');
const start=source.indexOf('        function relay()'),end=source.indexOf('        nativeForm.submit=',start);
function fixture({target='ctl00$PageBody$PlaceOrderButton',action='./ShoppingCart.aspx?wlCheckout=single',formTarget='',final=false,submitting=false,phase='checking_out'}={}) {
 const posts=[],tasks=[],data=new URLSearchParams([['__EVENTTARGET',target],['__VIEWSTATE','native-state']]);
 const nativeForm={target:formTarget,elements:{namedItem:()=>({value:target})},children:[],getAttribute:()=>action,appendChild(child){this.children.push(child);}};
 const page={documentElement:{dataset:{}},getElementById:()=>final?{}:null,createElement:tag=>({tag})};
 const context=vm.createContext({submitting,active:{phase},frame:{contentDocument:page},page,nativeForm,
  formBody:()=>({data:new URLSearchParams(data)}),child:{location:{href:'https://webtrack.woodsonlumber.com/ShoppingCart.aspx?wlCheckout=single'},HTMLFormElement:{prototype:{submit(){posts.push(this);}}}},
  ORIGIN:'https://webtrack.woodsonlumber.com',URL,relayControl:core.relayControl,
  win:{setTimeout(fn){tasks.push(fn);}},showError(error){throw error;}});
 vm.runInContext(source.slice(start,end),context);return {context,posts,tasks,page,nativeForm,flush(){while(tasks.length)tasks.shift()();}};
}
test('validated intermediate navigation submits the original native form once in its own frame after WebForms completes',()=>{
 const f=fixture();assert.equal(f.context.relay(null),true);assert.equal(f.posts.length,0);assert.equal(f.tasks.length,1);
 assert.equal(f.context.relay(null),true);assert.equal(f.tasks.length,1);f.flush();assert.deepEqual(f.posts,[f.nativeForm]);
});
test('final and unsupported actions stay on their native path, and ordinary submit events are not canceled',()=>{
 for(const options of [{final:true},{submitting:true},{phase:'submitting'},{target:'ctl00$PageBody$CompleteCheckoutButton'},{target:'unexpected'},{target:''}]) {
  const blocked=fixture(options);assert.equal(blocked.context.relay(),false);blocked.flush();assert.equal(blocked.posts.length,0);
 }
 assert.doesNotMatch(source.slice(start,source.indexOf('      var scheduled = false;',start)),/nativeForm\.addEventListener\('submit'/);
});
test('foreign destinations, targets, stale frames and cancellation before the deferred task cannot submit',()=>{
 for(const options of [{action:'https://example.test/ShoppingCart.aspx'},{action:'/AccountInfo_R.aspx'},{formTarget:'_top'}]) {
  const f=fixture(options);assert.throws(()=>f.context.relay(null),/could not be verified/);f.flush();assert.equal(f.posts.length,0);
 }
 const stale=fixture();stale.context.frame.contentDocument={};assert.equal(stale.context.relay(null),false);stale.flush();assert.equal(stale.posts.length,0);
 for(const invalidate of [f=>{f.context.frame=null;},f=>{f.context.active.phase='restoring';},f=>{f.context.submitting=true;}]) {
  const f=fixture();f.context.relay(null);invalidate(f);f.flush();assert.equal(f.posts.length,0);
 }
});
