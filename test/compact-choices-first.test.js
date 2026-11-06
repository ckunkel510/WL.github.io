'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../BuyNowPilot'),source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b));
const address={line1:'123 Test Street',line2:'Suite 4',city:'Test city',stateValue:'TX',zip:'77833',countryValue:'USA',contactName:'Test Customer',phone:'9795550100',email:'test@example.invalid'};
const quote={options:{ups:{available:true,amount:9.95,rates:[{serviceCode:'03',serviceName:'UPS Ground',amount:9.95},{serviceCode:'02',serviceName:'UPS 2nd Day Air',amount:49.31}]},delivery:{available:false}}};

test('shipping choices are available from the trusted quote before native payment/review',()=>{
  assert.deepEqual(core.quoteShippingChoices(core.fulfillmentOptions(true,quote).ship),[
    {value:'03',label:'UPS Ground · $9.95'},{value:'02',label:'UPS 2nd Day Air · $49.31'}
  ]);
  assert.deepEqual(core.quoteShippingChoices({available:true,pending:true,rates:quote.options.ups.rates}),[]);
  assert.deepEqual(core.quoteShippingChoices({available:true,rates:[{serviceCode:'03',amount:-1},{serviceCode:'x',amount:10}]}),[]);
  assert.equal(core.quoteShippingChoices({available:true,rates:[{serviceCode:'59',amount:56.22}]})[0].label,'UPS 2nd Day Air A.M. · $56.22');
});

test('manual US addresses accept full or numeric native states and ZIP+4 without changing street/unit/contact',()=>{
  const input={...address,stateValue:'56',stateText:'Texas',zip:'778331234'};
  const normalized=core.normalizeCheckoutAddress(input);
  assert.equal(normalized.stateValue,'TX');assert.equal(normalized.zip,'77833-1234');
  for(const key of ['line1','line2','contactName','phone','email'])assert.equal(normalized[key],input[key]);
  assert.equal(input.stateValue,'56');assert.equal(input.zip,'778331234');
  assert.equal(core.checkoutAddressKey({...address,stateValue:'56',stateText:'Texas'}),core.checkoutAddressKey(address));
  assert.equal(core.checkoutAddressKey({...address,stateValue:'Texas'}),core.checkoutAddressKey(address));
});

test('missing manual guest fields are identified before starting a native continuation',()=>{
  for(const field of ['line1','city','stateValue','zip','contactName','phone','email']) {
    const issue=core.checkoutAddressIssue({...address,[field]:''},true);assert.equal(issue.field,field);
  }
  assert.equal(core.checkoutAddressIssue({...address,stateValue:'not-a-state'},true).field,'stateValue');
  assert.equal(core.checkoutAddressIssue({...address,zip:'123'},true).field,'zip');
  assert.equal(core.checkoutAddressIssue({...address,email:'invalid'},true).field,'email');
  assert.equal(core.checkoutAddressIssue(address,true),null);
  assert.equal(core.checkoutAddressIssue({...address,email:'',phone:'',contactName:''},false),null,'separate billing uses the existing contact, not another required contact form');
});

test('unchanged manual choices compare equal while real contact, billing or instruction changes do not',()=>{
  const choices={method:'ship',address,billing:address,date:'2026-11-09',shippingValue:'03',notes:'Keep dry',selected:['2','1']};
  const key=core.checkoutChoicesKey(choices);
  assert.equal(core.checkoutChoicesKey({...choices,selected:['1','2'],date:'2026-11-10',address:{...address,stateValue:'Texas',countryValue:'US'}}),key);
  for(const changed of [{notes:'Leave at rear'},{billing:{...address,line1:'456 Other Street'}},{address:{...address,phone:'9795550200'}},{shippingValue:'02'}])assert.notEqual(core.checkoutChoicesKey({...choices,...changed}),key);
});

function choiceChangeFixture() {
  const calls={clears:0,refreshes:0,views:0,drafts:0};
  const nativePage={getElementById:()=>null},frame={contentDocument:nativePage};
  const context=vm.createContext({fast:{journey:'options',optionsReady:true,method:'ship',shippingValue:'03',methods:core.fulfillmentOptions(true,quote),revision:1},frame,busy:false,submitting:false,active:{},
    keepCartDraft(){calls.drafts++;},updateFastOptions(){calls.views++;},presentChoices(){calls.views++;},updatePickupReadiness(){},warmPickupStock(){},proposedItems:()=>[],paymentWorkspace(){},presentDraft(){calls.refreshes++;},clearFrame(){calls.clears++;}});
  vm.runInContext(section('    function requestFastUpdate(','    function editableFast('),context);
  return {context,calls,frame};
}

test('timing, speed and note edits stay local and retain the prepared native view and rates',()=>{
  const f=choiceChangeFixture();
  for(const kind of ['timing','shipping','notes','contact','notes'])f.context.requestFastUpdate(kind);
  assert.equal(f.context.frame,f.frame);assert.equal(f.context.fast.optionsReady,true);assert.equal(f.context.fast.revision,1);
  assert.equal(f.context.fast.methods.ship.available,true);assert.equal(f.calls.clears,0);assert.equal(f.calls.refreshes,0);assert.equal(f.calls.drafts,5);
});

const driver=section('    async function driveFast(','    async function submitNative(');
test('the actual native details driver pauses before POST, then applies local edits and continues once',async()=>{
  let posts=0,quotes=0,presented=0;
  const control=()=>({dataset:{bnRequestedAt:String(Date.now())},getAttribute:()=> 'true'});
  const elements={btnDelivered:control(),btnPickup:control(),btnShip:control(),ctl00_PageBody_SaleTypeSelector_rbUPSDelivery:{},deliveryDate:{min:'2026-11-09',max:'2026-11-20',dataset:{}},specialInsExtra:{value:''}};
  const next={dataset:{},click(){posts++;}},page={documentElement:{dataset:{}},getElementById:id=>elements[id]||null,querySelector:selector=>selector==='.wl-proxy-continue'?next:null,querySelectorAll:()=>[]};
  const child={WLCheckout:{refreshDateUI(){},validateBeforeFinalSubmit:()=>true},WLShippingOffer:{current:()=>quote,refresh(){quotes++;}},sessionStorage:{getItem:()=> 'ship'}};
  const fast={journey:'options',method:'ship',address,methods:core.fulfillmentOptions(true,quote),started:Date.now(),opened:Date.now(),notes:'Original',window:'Afternoon'};
  const context=vm.createContext({fast,frame:{contentDocument:page},active:{phase:'checking_out',purchase:[]},busy:false,submitting:false,guest:false,settings:{},account:{},overlay:{dataset:{}},detailsQuotes:new Map([[page,quote]]),
    nativeFormsReady:()=>true,setStage(){},status(){},checkIdentity:async()=>{},nativeAddress(){},applyContactDefaults(){},contactDefaults(){},hydrateMatchingAddressState(){},accountAddress:()=>address,
    updateFastOptions(){},quoteForCart:x=>x,fulfillmentOptions:core.fulfillmentOptions,checkoutAddressIssue:core.checkoutAddressIssue,quoteShippingChoices:core.quoteShippingChoices,fulfillmentApplied:()=>true,
    firstDate:core.firstDate,dateChoice:core.dateChoice,text:x=>String(x||''),setNative(w,input,value){if(input)input.value=value;},marker:()=> 'test-reference',presentChoices(){presented++;},measureCheckout(){},haltFast(message){throw Error(message);}});
  vm.runInContext(driver,context);
  await context.driveFast(child,page);await context.driveFast(child,page);
  assert.equal(posts,0);assert.equal(fast.optionsReady,true);assert.equal(fast.shippingValue,'03');assert.equal(quotes,0);assert.equal(presented,2);
  fast.notes='Leave at receiving';fast.journey='payment';fast.optionsReady=false;delete page.documentElement.dataset.bnFieldsApplied;
  await context.driveFast(child,page);await context.driveFast(child,page);
  assert.equal(posts,1);assert.equal(quotes,0);assert.match(elements.specialInsExtra.value,/Leave at receiving/);
});

function cardDriverFixture({guest=false,noCards=false}={}) {
  let posts=0,shows=0,gates=0,identity=0;
  const cards={value:'a',options:noCards?[]:[{value:'a',textContent:'1111 Fixture Visa'},{value:'b',textContent:'2222 Fixture Visa'}],dispatchEvent(){}},stored={checked:true};
  const elements={ctl00_PageBody_ddlCardsOnFile:cards,ctl00_PageBody_rbStoredCard:stored,ctl00_PageBody_rbCreditCard:{dispatchEvent(){}},ctl00_PageBody_btnContinue_CardOnFileView:{click(){posts++;}}};
  const page={documentElement:{dataset:{}},getElementById:id=>elements[id]||null,querySelector:()=>null};
  const fast={journey:'payment',started:Date.now(),payments:[]},context=vm.createContext({fast,frame:{contentDocument:page},scope:'fixture',active:{phase:'checking_out'},busy:false,submitting:false,guest,storage:{getItem(){}},preferenceKey:'test',
    nativeFormsReady:()=>true,text:String,setStage(){},digest:async text=>text,savedChoice:core.savedChoice,checkIdentity:async()=>{identity++;},fastText(){},status(){},
    presentPaymentChoices(){shows++;fast.paymentReady=true;fast.journey='payment';},paymentTotalGate(){gates++;return false;},
    setNative(w,input,value){input.value=value;}});
  vm.runInContext(driver,context);return {context,fast,page,cards,child:{Event:class{}},counts:()=>({posts,shows,gates,identity})};
}

test('guided saved-card checkout waits for customer review and never repeats the native continuation',async()=>{
  const f=cardDriverFixture();await f.context.driveFast(f.child,f.page);await f.context.driveFast(f.child,f.page);
  assert.equal(f.counts().posts,0);assert.equal(f.counts().shows,2);assert.equal(f.counts().identity,0);
  f.fast.paymentApproved=true;f.fast.paymentConfirmed=f.fast.paymentFingerprint;f.fast.journey='review';
  await f.context.driveFast(f.child,f.page);await f.context.driveFast(f.child,f.page);assert.equal(f.counts().posts,1);assert.equal(f.counts().identity,1);
});

test('a removed approved card returns to payment choices instead of silently using another saved card',async()=>{
  const f=cardDriverFixture();await f.context.driveFast(f.child,f.page);
  f.fast.paymentApproved=true;f.fast.paymentConfirmed=f.fast.paymentFingerprint;f.cards.options.shift();
  await f.context.driveFast(f.child,f.page);assert.equal(f.counts().posts,0);assert.equal(f.fast.paymentApproved,false);assert.equal(f.fast.paymentConfirmed,'');assert.equal(f.fast.journey,'payment');
});

test('guest/new-card continuation cannot expose secure payment before explicit approval of the priced total',async()=>{
  const f=cardDriverFixture({guest:true,noCards:true});await f.context.driveFast(f.child,f.page);assert.equal(f.counts().posts,0);assert.equal(f.counts().shows,1);
  f.fast.addPayment=true;f.fast.paymentApproved=true;await f.context.driveFast(f.child,f.page);
  assert.equal(f.counts().gates,1);assert.equal(f.counts().posts,0);assert.equal(f.fast.securePayment,undefined);
});

test('address or fulfillment changes prepare choices rather than submitting/reviewing an order',()=>{
  for(const kind of ['address','method','sales','back']) {
    const f=choiceChangeFixture();f.context.requestFastUpdate(kind);
    assert.equal(f.context.fast.journey,'options');assert.equal(f.context.fast.optionsReady,false);assert.equal(f.context.fast.dirty,true);
    assert.equal(f.calls.refreshes,1);assert.equal(f.calls.clears,0,'refresh can reuse the still-unsubmitted details view');
  }
});

test('saved payment selection retains the existing priced native payment view',()=>{
  const f=choiceChangeFixture();f.context.fast.journey='payment';f.context.fast.paymentConfirmed='old';
  f.frame.contentDocument.getElementById=()=>({});let shows=0;f.context.presentPaymentChoices=()=>shows++;
  f.context.requestFastUpdate('payment');
  assert.equal(shows,1);assert.equal(f.context.frame,f.frame);assert.equal(f.context.fast.revision,1);assert.equal(f.context.fast.paymentConfirmed,'');assert.equal(f.calls.clears,0);assert.equal(f.calls.refreshes,0);
});

test('Continue releases prepared choices once without reopening checkout or placing an order',async()=>{
  let drives=0;const page={documentElement:{dataset:{bnFieldsApplied:'1'}}};
  const context=vm.createContext({fast:{journey:'options',optionsReady:true,method:'ship',shippingValue:'02',methods:core.fulfillmentOptions(true,quote)},frame:{contentDocument:page,contentWindow:{}},busy:false,submitting:false,
    guidedView(){},loading(){},status(){},driveFast(){drives++;},quoteShippingChoices:core.quoteShippingChoices});
  vm.runInContext(section('    async function continueChoices(','    function presentPaymentChoices('),context);
  await context.continueChoices();await context.continueChoices();assert.equal(drives,1);assert.equal(context.fast.journey,'payment');assert.equal(context.fast.paymentApproved,false);assert.equal(page.documentElement.dataset.bnFieldsApplied,undefined);
});

test('Continue cannot bypass an editor, incomplete setup or an unavailable shipping choice',async()=>{
  for(const mode of ['editor','preparing','unavailable','stopped','busy','submitting','detached']) {
    let drives=0;const context=vm.createContext({fast:{journey:'options',optionsReady:true,method:'ship',shippingValue:'03',methods:core.fulfillmentOptions(true,quote)},frame:{contentDocument:{documentElement:{dataset:{}}}},busy:false,submitting:false,
      guidedView(){},loading(){},status(){},overlay:{querySelector:()=>({focus(){}})},driveFast(){drives++;},quoteShippingChoices:core.quoteShippingChoices});
    if(mode==='editor')context.fast.editor='address';if(mode==='preparing')context.fast.optionsReady=false;if(mode==='unavailable')context.fast.shippingValue='missing';if(mode==='stopped')context.fast.stopped=true;if(mode==='busy')context.busy=true;if(mode==='submitting')context.submitting=true;if(mode==='detached')context.frame.contentDocument=null;
    vm.runInContext(section('    async function continueChoices(','    function presentPaymentChoices('),context);await context.continueChoices();assert.equal(drives,0,mode);
  }
});

test('rapid address edits coalesce into one options refresh and a departed cart cannot refresh',()=>{
  let timer,refreshes=0;const context=vm.createContext({fast:{journey:'options'},active:{},overlay:{},busy:false,submitting:false,cancelPending:false,choicesTimer:null,
    win:{setTimeout(fn){timer=fn;return 1;},clearTimeout(){}},refreshFast(){refreshes++;return Promise.resolve();},showError(error){throw error;}});
  vm.runInContext(section('    function queueChoicesRefresh(','    async function continueChoices('),context);
  context.queueChoicesRefresh();context.queueChoicesRefresh();timer();assert.equal(refreshes,1);
  context.queueChoicesRefresh();context.overlay=null;timer();assert.equal(refreshes,1);
});
