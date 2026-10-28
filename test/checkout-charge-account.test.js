'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../BuyNowPilot');
const checkout=fs.readFileSync(require.resolve('../Checkout2'),'utf8');
const emailSource=checkout.slice(checkout.indexOf('    function validateEmail('),checkout.indexOf('    function validateAddressBlock('));
const validationSource=checkout.slice(checkout.indexOf('    function wlAddressValidation('),checkout.indexOf('    function wlAddressBlockIsValid('));
const address={line1:'PO Box 419',line2:'',line3:'',city:'Caldwell',zip:'77836',countryValue:'USA',stateValue:'TX',stateText:'Texas'};
function fixture(overrides={}) {
  const fields={};
  for(const prefix of ['DeliveryAddress','InvoiceAddress']) {
    const base='ctl00_PageBody_'+prefix+'_';
    for(const [name,key] of [['AddressLine1','line1'],['AddressLine2','line2'],['AddressLine3','line3'],['City','city'],['Postcode','zip']]) fields[base+name]={value:address[key]};
    fields[base+'CountrySelector'+(prefix==='InvoiceAddress'?'1':'')]={value:'USA',selectedOptions:[{text:'United States'}]};
    fields[base+'CountySelector_CountyList']={value:'0',options:[{value:'0',textContent:'[Select State]'},{value:'56',textContent:'Texas'},{value:'12',textContent:'California'}]};
  }
  fields.ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox={value:'9795550100'};
  fields.ctl00_PageBody_InvoiceAddress_EmailAddressTextBox={value:'billing@example.test; accounts@example.test;manager@example.test'};
  for(const [name,value] of Object.entries(overrides)) fields['ctl00_PageBody_InvoiceAddress_'+name].value=value;
  const page={getElementById:id=>fields[id]||null,querySelector:()=>null};
  const context=vm.createContext({document:page,norm:v=>String(v||'').trim(),wlNormalizeFieldValues(){},wlDigits:v=>String(v||'').replace(/\D/g,''),wlSelectIsValid:el=>!!el.value&&!['0','00'].includes(el.value),wlIsPlaceholderText:()=>false,wlSelectedText:()=> 'United States'});
  vm.runInContext(emailSource+validationSource,context);
  return {fields,page,context,validate:()=>context.wlAddressValidation('InvoiceAddress',true)};
}
test('invoice email validation accepts native recipient lists and rejects malformed entries',()=>{
  const {context}=fixture();
  for(const value of ['one@example.test','one@example.test;two@example.test',' one@example.test ; two@example.test; ','(Primary) one@example.test;two@example.test',"a+b.o'neil@example.test"]) assert.equal(context.validateEmail(value),true,value);
  for(const value of ['', ';', 'one@example.test;;two@example.test','one@example.test;bad','one@example.test,two@example.test','a..b@example.test','one@-example.test']) assert.equal(context.validateEmail(value),false,value);
});
test('charge billing with absent contact controls validates after exact saved-address state hydration',()=>{
  const f=fixture();
  assert.deepEqual(Array.from(f.validate().missing,m=>m.label),['State']);
  assert.equal(core.hydrateMatchingAddressState(f.page,'InvoiceAddress',address),true);
  assert.equal(f.fields.ctl00_PageBody_InvoiceAddress_CountySelector_CountyList.value,'56');
  assert.equal(f.validate().valid,true);
  assert.equal(f.fields.ctl00_PageBody_InvoiceAddress_EmailAddressTextBox.value,'billing@example.test; accounts@example.test;manager@example.test');
});
test('state hydration never overrides an existing state or guesses for another address or country',()=>{
  for(const overrides of [{AddressLine1:'100 Other St'},{AddressLine2:'Suite 2'},{City:'Bryan'},{Postcode:'77801'},{CountrySelector1:'CAN'},{CountySelector_CountyList:'12'}]) {
    const f=fixture(overrides),before=f.fields.ctl00_PageBody_InvoiceAddress_CountySelector_CountyList.value;
    assert.equal(core.hydrateMatchingAddressState(f.page,'InvoiceAddress',address),false);
    assert.equal(f.fields.ctl00_PageBody_InvoiceAddress_CountySelector_CountyList.value,before);
  }
  for(const candidate of [null,{...address,countryValue:'CAN'},{...address,stateValue:'ZZ',stateText:''},{...address,line1:''}]) assert.equal(core.hydrateMatchingAddressState(fixture().page,'InvoiceAddress',candidate),false);
  const f=fixture();assert.equal(core.hydrateMatchingAddressState(f.page,'InvoiceAddress',{...address,stateValue:'CA',stateText:'California'}),true);
  assert.equal(f.fields.ctl00_PageBody_InvoiceAddress_CountySelector_CountyList.value,'12');
});
test('authenticated defaults retain billing recipients; explicit guest contact still replaces them',()=>{
  const f=fixture(),email=f.fields.ctl00_PageBody_InvoiceAddress_EmailAddressTextBox.value;
  const contact={firstName:'Test',lastName:'Customer',email:'login@example.test',phone:'9795550100'};
  core.applyContactDefaults(f.page,contact,null,false);
  assert.equal(f.fields.ctl00_PageBody_InvoiceAddress_EmailAddressTextBox.value,email);
  core.applyContactDefaults(f.page,contact,null,true);
  assert.equal(f.fields.ctl00_PageBody_InvoiceAddress_EmailAddressTextBox.value,contact.email);
  f.fields.ctl00_PageBody_InvoiceAddress_EmailAddressTextBox.value='';
  core.applyContactDefaults(f.page,contact,null,false);
  assert.equal(f.fields.ctl00_PageBody_InvoiceAddress_EmailAddressTextBox.value,contact.email);
});
test('cash and guest required contact, state, ZIP, phone and email checks remain enforced',()=>{
  for(const [name,value,label] of [['ContactFirstNameTextBox','','First name'],['ContactLastNameTextBox','','Last name'],['ContactTelephoneTextBox','555','Phone number'],['Postcode','123','ZIP must be 5 digits or ZIP+4'],['EmailAddressTextBox','one@example.test;broken','Valid email address']]) {
    const f=fixture();core.hydrateMatchingAddressState(f.page,'InvoiceAddress',address);
    f.fields['ctl00_PageBody_InvoiceAddress_'+name]={value};
    assert.equal(f.validate().valid,false);assert.ok(Array.from(f.validate().missing,m=>m.label).includes(label));
  }
});
