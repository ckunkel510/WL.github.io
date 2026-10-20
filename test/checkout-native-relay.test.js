'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../BuyNowPilot'),source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8');
const start=source.indexOf('        function relay(submitter)'),end=source.indexOf('        nativeForm.submit=',start);
function fixture({target='ctl00$PageBody$PlaceOrderButton',action='./ShoppingCart.aspx?wlCheckout=single',final=false,submitting=false,phase='checking_out'}={}) {
 const posts=[],forms=[],data=new URLSearchParams([['__EVENTTARGET',target],['__VIEWSTATE','native-state'],['nativeQuantity','2']]);
 const page={documentElement:{dataset:{}},getElementById:()=>final?{}:null};
 const context=vm.createContext({submitting,active:{phase},frame:{contentDocument:page,name:'woodson-buy-now-checkout'},page,
  formBody:()=>({data:new URLSearchParams(data)}),nativeForm:{getAttribute:()=>action},child:{location:{href:'https://webtrack.woodsonlumber.com/ShoppingCart.aspx?wlCheckout=single'}},
  ORIGIN:'https://webtrack.woodsonlumber.com',URL,relayControl:core.relayControl,
  doc:{createElement:tag=>({tag,children:[],dataset:{},appendChild(child){this.children.push(child);}})},overlay:{appendChild:form=>forms.push(form)},
  win:{HTMLFormElement:{prototype:{submit(){posts.push(this);}}}}});
 vm.runInContext(source.slice(start,end),context);return {context,posts,forms,page};
}
test('intermediate native POST retains WebForms state and targets only its owned iframe once',()=>{
 const f=fixture();assert.equal(f.context.relay(null),true);assert.equal(f.posts.length,1);
 const post=f.posts[0];assert.equal(post.method,'POST');assert.equal(post.action,'https://webtrack.woodsonlumber.com/ShoppingCart.aspx?wlCheckout=single');assert.equal(post.target,'woodson-buy-now-checkout');
 assert.deepEqual(Object.fromEntries(post.children.map(x=>[x.name,x.value])),{__EVENTTARGET:'ctl00$PageBody$PlaceOrderButton',__VIEWSTATE:'native-state',nativeQuantity:'2'});
 assert.equal(f.context.relay(null),true);assert.equal(f.posts.length,1);
});
test('native submit-button payload is included and final/unsupported actions cannot be relayed',()=>{
 const f=fixture({target:''});assert.equal(f.context.relay({name:'ctl00$PageBody$btnContinue_CardOnFileView',value:'Continue'}),true);
 assert.equal(f.posts[0].children.find(x=>x.name==='ctl00$PageBody$btnContinue_CardOnFileView').value,'Continue');
 for(const options of [{final:true},{submitting:true},{phase:'submitting'},{target:'ctl00$PageBody$CompleteCheckoutButton'},{target:'unexpected'}]) {
  const blocked=fixture(options);assert.equal(blocked.context.relay(null),false);assert.equal(blocked.posts.length,0);
 }
});
test('native relay rejects other destinations and stale frames without transmitting form contents',()=>{
 for(const action of ['https://example.test/ShoppingCart.aspx','/AccountInfo_R.aspx']) {
  const f=fixture({action});assert.throws(()=>f.context.relay(null),/destination could not be verified/);assert.equal(f.forms.length,0);assert.equal(f.posts.length,0);
 }
 const stale=fixture();stale.context.frame.contentDocument={};assert.equal(stale.context.relay(null),false);assert.equal(stale.posts.length,0);
});
