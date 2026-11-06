'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../Guestcheckout.js'),'utf8');
const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
function fixture() {
  const initial={email:'fixture@example.invalid',phone:'9795550100',fname:'Guest',lname:'Fixture',del_addr1:'123 Test Street',del_city:'Test City',del_state:'Texas',del_zip:'778331234',inv_addr1:'456 Billing Street',inv_city:'Other City',inv_state:'New York',inv_zip:'10520'};
  const fields=Object.fromEntries(Object.entries(initial).map(([name,value])=>['gc_'+name,{value}]));fields.gc_bill_same={checked:true};fields.gc_submit={disabled:false};
  const errors=new Map(),context=vm.createContext({$:selector=>fields[selector.slice(1)],clean:value=>String(value||'').trim(),digits:value=>String(value||'').replace(/\D/g,''),clearGuestFieldErrors:()=>errors.clear(),markGuestInvalid:(id,message)=>errors.set(id,message),
    document:{querySelector:()=>null},setTimeout:fn=>fn(),randTempPassword:()=> 'test-only-never-used'});
  vm.runInContext(section('  const STATE_LONG =','  function $(')+section('  function validateEmail(','  function clearGuestFieldErrors(')+section('  function collectGuestPayload(','  async function onSubmitGuest('),context);
  return {context,fields,errors,collect:()=>context.collectGuestPayload()};
}

test('guest manual entry accepts state names/autofill and ZIP+4 and carries the same-as-delivery choice',()=>{
  const f=fixture(),payload=f.collect();assert.equal(payload.error,undefined);assert.equal(payload.d_state,'TX');assert.equal(payload.d_zip,'77833-1234');assert.equal(payload.i_addr1,payload.d_addr1);assert.equal(payload.billSame,true);
  assert.equal(f.fields.gc_del_state.value,'TX');assert.equal(f.fields.gc_del_zip.value,'77833-1234');assert.equal(f.fields.gc_phone.value,'(979) 555-0100');
});

test('missing guest fields and invalid states, email, phone or ZIP prevent signup while preserving entered fields',()=>{
  for(const [field,value] of [['email','invalid'],['phone','555'],['fname',''],['lname',''],['del_addr1',''],['del_city',''],['del_state','ZZ'],['del_zip','123']]) {
    const f=fixture();f.fields['gc_'+field].value=value;assert.ok(f.collect().error,field);assert.ok(f.errors.has('gc_'+field),field);
    assert.equal(f.fields.gc_inv_addr1.value,'456 Billing Street');
    f.fields['gc_'+field].value=fixture().fields['gc_'+field].value;
    assert.equal(f.collect().error,undefined,'correcting '+field+' completes the existing entries');
  }
});

test('separate guest billing is required only when selected and never overwritten by delivery changes',()=>{
  const f=fixture();f.fields.gc_bill_same.checked=false;let payload=f.collect();assert.equal(payload.i_addr1,'456 Billing Street');assert.equal(payload.i_state2,'NY');
  f.fields.gc_del_addr1.value='789 Receiving Street';payload=f.collect();assert.equal(payload.d_addr1,'789 Receiving Street');assert.equal(payload.i_addr1,'456 Billing Street');
  f.fields.gc_inv_zip.value='12';assert.ok(f.collect().error);assert.ok(f.errors.has('gc_inv_zip'));
  f.fields.gc_bill_same.checked=true;payload=f.collect();assert.equal(payload.error,undefined);assert.equal(payload.i_addr1,'789 Receiving Street');assert.equal(payload.i_zip,'77833-1234');
});

test('repeat guest Continue or Enter cannot start duplicate signup while the first request is pending',async()=>{
  const f=fixture();let release,starts=0;
  Object.assign(f.context,{collectGuestPayload:()=>({email:'fixture@example.invalid'}),saveGuest(){},backupGuestCart:()=>{starts++;return new Promise(resolve=>{release=resolve;});},createAccountInBackground:async()=>{},verifyGuestAccount:async()=>{},guestMetric(){},continueCheckoutAndHookBilling(){},closeModal(){},showError(){},ERR(){}});
  vm.runInContext(section('  async function onSubmitGuest(','  async function guestNativeDocument('),f.context);
  const first=f.context.onSubmitGuest();await f.context.onSubmitGuest();assert.equal(starts,1);assert.equal(f.fields.gc_submit.disabled,true);release();await first;assert.equal(f.fields.gc_submit.disabled,false);
});

test('Enter submits guest input once but leaves composing text and other controls alone',()=>{
  let handler,submitted=0,prevented=0;
  const context=vm.createContext({modal:{addEventListener:(event,fn)=>{handler=fn;}},onSubmitGuest:()=>submitted++});
  const start=source.indexOf("    modal.addEventListener('keydown'");vm.runInContext(source.slice(start,source.indexOf('\n  }',start)),context);
  for(const event of [{key:'Enter',target:{tagName:'INPUT'}},{key:'Enter',isComposing:true,target:{tagName:'INPUT'}},{key:'Tab',target:{tagName:'INPUT'}},{key:'Enter',target:{tagName:'BUTTON'}}])handler({...event,preventDefault(){prevented++;}});
  assert.equal(submitted,1);assert.equal(prevented,1);
});
