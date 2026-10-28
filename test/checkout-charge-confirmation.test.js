'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../BuyNowPilot'),source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8');
const origin='https://webtrack.woodsonlumber.com';
function receipt({message='Thank you. Your reserved order W123456 was submitted and will be processed.',order='W123456',merchant=false}={}) {
  return {documentElement:{dataset:{}},getElementById(id){
    if(id==='CartResponseMessage')return {textContent:message,querySelector:()=>order?{textContent:order}:null};
    if(id==='ctl00_PageBody_SuccessfulPaymentResults_MerchantDetailsPanel')return merchant?{textContent:'Woodson Lumber'}:null;
    return null;
  }};
}
test('native charge success uses the success route, a positive native message and a real order number without a payment receipt',()=>{
  assert.equal(core.nativeOrderNumber(receipt(),origin+'/ShoppingCart.aspx?success=1'),'W123456');
  assert.equal(core.nativeOrderNumber(receipt({merchant:true}),origin+'/ShoppingCart.aspx?success=1'),'W123456');
  assert.equal(core.nativeOrderNumber(receipt({order:'',message:'Thank you. Order number W123456 was submitted.'}),origin+'/ShoppingCart.aspx?success=1'),'W123456');
});
test('URLs, empty carts, ambiguous messages, failures, invalid IDs and mismatched references cannot confirm an order',()=>{
  for(const path of ['/ShoppingCart.aspx','/ShoppingCart.aspx?success=0','/Products.aspx?success=1','https://example.test/ShoppingCart.aspx?success=1','/ShoppingCart.aspx?success=1&ref=W999999']) assert.equal(core.nativeOrderNumber(receipt(),new URL(path,origin).href),'');
  for(const options of [{message:'Order number W123456'},{message:'Order W123456 was not submitted'},{message:'No order was placed'},{message:'Payment declined',merchant:true},{message:'Order failed',merchant:true},{order:'unknown'},{order:'<script>'},{order:''}])assert.equal(core.nativeOrderNumber(receipt(options),origin+'/ShoppingCart.aspx?success=1'),'');
  assert.equal(core.nativeOrderNumber({getElementById:()=>null},origin+'/ShoppingCart.aspx?success=1'),'');
});
test('natural cart charge confirmation clears the pending guard once, including a positively confirmed late response',async()=>{
  const inspect=source.slice(source.indexOf('    async function inspectFrame('),source.indexOf('    function setNative('));
  for(const phase of ['submitting','uncertain']) {
    const native=receipt(),events=[],saved=[],rendered=[];
    const context=vm.createContext({frame:{contentDocument:native},active:{id:'CC-current-attempt',phase,cartCheckout:true},submitting:phase==='submitting',busy:false,nativeOrderNumber:core.nativeOrderNumber,text:String,measureCheckout:(...args)=>events.push(args),save(){saved.push(context.active.phase);},clearFrame(){context.frame=null;},loading(){},status:message=>rendered.push(message),button:label=>({label}),node:(tag,value)=>({tag,value}),dismiss(){},win:{location:{}},overlay:{querySelector(selector){if(selector==='[data-bn-body]')return {replaceChildren(...nodes){rendered.push(...nodes.map(n=>n.value||n.label));}};return {remove(){}};}},cart(){throw Error('A natural charge order must not restore or rewrite its purchased cart');}});
    vm.runInContext(inspect,context);
    const child={location:{href:origin+'/ShoppingCart.aspx?success=1'}};
    await context.inspectFrame(child,native);await context.inspectFrame(child,native);
    assert.equal(context.active.phase,'confirmed');assert.equal(context.active.orderNumber,'W123456');assert.equal(context.submitting,false);assert.deepEqual(saved,['confirmed']);assert.ok(rendered.includes('Order W123456 confirmed'));
    assert.equal(events.filter(e=>e[0]==='purchase').length,1);
  }
});
