'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),core=require('../BuyNowPilot');
const source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8');
function page(rows){return {getElementById:()=>null,querySelector:()=>null,documentElement:{dataset:{}},querySelectorAll:()=>rows.map(([label,value])=>({children:[{textContent:label}],querySelector:()=>({textContent:value})}))};}
const delivered=()=>[['Subtotal (without Tax)','$10.00'],['Delivery','$25.00'],['Tax','$2.89'],['Total inc Tax','$37.89']];
test('before-card totals use native tax and confirmed delivery, shipping, or free pickup',()=>{
 assert.equal(core.paymentTotals(page(delivered()),'delivery',2500).total,'$37.89');
 assert.equal(core.paymentTotals(page(delivered()),'ship',2500).tax,'$2.89');
 assert.equal(core.paymentTotals(page([['Subtotal','$10.00'],['Tax','$0.83'],['Total','$10.83']]),'pickup',0).shipping,'$0.00');
});
test('missing tax, wrong delivery and inconsistent totals cannot become a payment quote',()=>{
 for(const rows of [delivered().filter(r=>r[0]!=='Tax'),delivered().filter(r=>r[0]!=='Delivery'),delivered().map(r=>r[0]==='Tax'?[r[0],'Checking…']:r),delivered().map(r=>r[0].startsWith('Total')?[r[0],'$35.00']:r)])assert.throws(()=>core.paymentTotals(page(rows),'delivery',2500));
 assert.throws(()=>core.paymentTotals(page(delivered()),'ship',8000));
 for(const option of [{rate:'$0.00'}, {rate:'$25.00',pending:true}, {rate:'$25.00',available:false}]) assert.throws(()=>core.quotedShipping('ship',option));
});
function gateFixture(){
 let rows=delivered(),opened=0,identity=0,workspace=false,loading=true;const rendered={};
 const fast={revision:1,method:'delivery',methods:{delivery:{rate:'$25.00'}},shippingOptions:[],ready:false};
 const native=page(rows),frame={contentDocument:native,contentWindow:{}};
 const context=vm.createContext({fast,frame,busy:false,submitting:false,active:{current:[{pid:'1',code:'ITEM',quantity:1,unit:'ea'}]},paymentTotals:core.paymentTotals,quotedShipping:core.quotedShipping,signature:core.signature,nativeFormsReady:()=>true,paymentWorkspace:open=>{workspace=open;},loading:value=>{loading=value;},status:message=>{rendered.status=message;},fastText:(key,value)=>{rendered[key]=value;},haltFast:message=>{throw Error(message);},checkIdentity:async()=>{identity++;},driveFast:async()=>{opened++;}});
 const start=source.indexOf('    function paymentPricingScope('),end=source.indexOf('    function pickupNotice(',start);vm.runInContext(source.slice(start,end),context);context.cachePaymentTotal(native);
 return {context,fast,native,rendered,opened:()=>opened,identity:()=>identity,workspace:()=>workspace,loading:()=>loading,change(){rows[2][1]='$3.00';rows[3][1]='$38.00';context.cachePaymentTotal(native);}};
}
test('no-card quote pauses with a visible total and only an explicit click resumes payment',async()=>{
 const f=gateFixture();assert.equal(f.context.paymentTotalGate(f.native),false);assert.equal(f.opened(),0);assert.equal(f.workspace(),false);assert.equal(f.loading(),false);assert.equal(f.fast.ready,false);
 assert.equal(f.rendered['[data-bn-confirm]'],'Continue to payment · $37.89');
 await f.context.acceptPaymentTotal();assert.equal(f.opened(),1);assert.equal(f.identity(),1);assert.ok(f.fast.paymentApproval);assert.equal(f.fast.paymentQuote,null);assert.equal(f.fast.ready,false);assert.equal(f.context.paymentTotalGate(f.native),true);
});
test('native total changes after review require another customer confirmation',async()=>{
 const f=gateFixture();f.context.paymentTotalGate(f.native);f.change();await f.context.acceptPaymentTotal();assert.equal(f.opened(),0);assert.equal(f.fast.paymentApproval,null);assert.match(f.rendered.status,/total changed/);assert.equal(f.rendered['[data-bn-confirm]'],'Continue to payment · $38.00');
});
test('approved totals from another checkout revision cannot expose card entry',async()=>{
 const f=gateFixture();f.context.paymentTotalGate(f.native);await f.context.acceptPaymentTotal();f.fast.revision++;assert.equal(f.context.paymentTotalGate(f.native),false);assert.equal(f.fast.ready,false);
});
test('native stored-card selection preserves automatic review; new-card selection waits at total gate',async()=>{
 const driver=source.slice(source.indexOf('    async function driveFast('),source.indexOf('    async function submitNative('));
 for(const hasCard of [true,false]) {
  let next=0,gates=0;const cards={options:hasCard?[{value:'stored-id',textContent:'1111 Visa'}]:[{value:'',textContent:'Select'}],dispatchEvent(){}},stored={},newCard={dispatchEvent(){}};
  const elements={ctl00_PageBody_ddlCardsOnFile:cards,ctl00_PageBody_rbStoredCard:stored,ctl00_PageBody_rbCreditCard:newCard,ctl00_PageBody_btnContinue_CardOnFileView:{click(){next++;}}};
  const native={documentElement:{dataset:{}},getElementById:id=>elements[id]||null,querySelector:()=>null};
  const fast={started:Date.now(),payments:[]},context=vm.createContext({fast,frame:{contentDocument:native},scope:'test',active:{phase:'checking_out'},busy:false,submitting:false,nativeFormsReady:()=>true,text:String,setStage(){},digest:async()=> 'fingerprint',savedChoice:options=>options[0],guest:true,storage:{getItem(){}},checkIdentity:async()=>{},fastText(){},status(){},paymentTotalGate(){gates++;return false;}});
  vm.runInContext(driver,context);await context.driveFast({Event:class{}},native);assert.equal(next,hasCard?1:0);assert.equal(gates,hasCard?0:1);
 }
});

test('background quote refresh during identity verification does not swallow payment continuation or double-open it',async()=>{
 const f=gateFixture();let release;f.context.checkIdentity=()=>new Promise(resolve=>{release=resolve;});
 f.context.paymentTotalGate(f.native);const first=f.context.acceptPaymentTotal();assert.equal(f.fast.paymentAuthorizing,true);
 f.context.paymentTotalGate(f.native);await f.context.acceptPaymentTotal();assert.equal(f.opened(),0);
 release();await first;assert.equal(f.opened(),1);assert.equal(f.fast.paymentAuthorizing,false);assert.equal(f.fast.ready,false);
});


test('an intermediate native shipping continuation is blocked until the quoted charge and tax match',()=>{
 const listenerStart=source.indexOf("      page.addEventListener('click', function (event) {\n        if (fast && event.target.closest('#ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView'))");
 const listenerEnd=source.indexOf("      page.addEventListener('click'",listenerStart+20);
 for(const valid of [true,false]) {
  let listener,prevented=0,halted=0;
  const context=vm.createContext({page:{addEventListener:(name,fn)=>{listener=fn;}},fast:{},cachePaymentTotal:()=>valid,haltFast:()=>{halted++;}});
  vm.runInContext(source.slice(listenerStart,listenerEnd),context);
  listener({target:{closest:()=>({})},preventDefault(){prevented++;},stopImmediatePropagation(){prevented++;}});
  assert.equal(halted,valid?0:1);assert.equal(prevented,valid?0:2);
 }
});
