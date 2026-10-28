'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const core=require('../BuyNowPilot');
const address={line1:'100 Job Street',line2:'Building A',line3:'Gate 2',city:'Caldwell',stateValue:'TX',stateText:'Texas',zip:'77836',countryValue:'USA'};
function grid(entries){return {getElementById:()=>({querySelectorAll:()=>entries.map(e=>({cells:[{querySelector:()=>({textContent:e.code,getAttribute:()=>e.href || '/AddressDetails.aspx?oid='+e.id+'&action=3'})},{querySelector:()=>({getAttribute:()=>e.type||'Job Address'})},{textContent:e.ref||''},{textContent:e.summary||''}]}))})};}
function detail(overrides={}){const f={addressCode:'J47',addressLine1:address.line1,addressLine2:address.line2,addressLine3:address.line3,city:address.city,state:'TX',zipCode:address.zip,CountrySelector:'USA',JobReference:'Site 47',...overrides};return {getElementById(id){const name=id.replace('ctl00_PageBody_','');return name in f?{value:f[name],selectedOptions:name==='CountrySelector'?[{textContent:'United States'}]:undefined}:null;}};}
function review(sales=address,billing={...address,line1:'PO Box 419',line2:'',line3:''}){const values={};for(const [prefix,a] of [['Delivery',sales],['Invoice',billing]])for(const [field,value] of [['AddressLines',[a.line1,a.line2,a.line3].filter(Boolean).join('')],['City',a.city],['State','Texas'],[prefix==='Invoice'?'ZipCode':'PostalCode',a.zip]])values['ctl00_PageBody_ShoppingCartSummaryTableControl_'+prefix+field]={textContent:value};return {getElementById:id=>values[id]};}
test('all saved rows retain native IDs, job code/reference and full search terms beyond the old 12-row limit',()=>{
 const entries=core.savedSalesAddresses(grid(Array.from({length:48},(_,i)=>({id:String(i+1),code:'J'+i,ref:'Site '+i,summary:(i===47?'100 Far Road, Bryan':'100 Job Street, Caldwell')}))));
 assert.equal(entries.length,48);assert.equal(entries[47].isJob,true);assert.equal(entries[47].jobReference,'Site 47');
 assert.deepEqual(core.matchingSalesAddresses(entries,'site 47 Bryan').map(e=>e.id),['48']);assert.equal(core.matchingSalesAddresses(entries,'no matching job').length,0);
 assert.match(core.salesAddressLabel(entries[47]),/Job · J47 · Job ref: Site 47/);
});
test('saved-address links cannot leave WebTrack or introduce invalid and duplicate native IDs',()=>{
 const entries=core.savedSalesAddresses(grid([{id:'1',code:'MAIN',type:'Default Address'},{id:'1',code:'duplicate'},{id:'0',code:'new'},{id:'2',code:'external',href:'https://example.test/AddressDetails.aspx?oid=2'},{id:'3',code:'wrongpath',href:'/Other.aspx?oid=3'}]));
 assert.equal(entries.length,1);assert.equal(entries[0].isMain,true);assert.throws(()=>core.savedSalesAddresses({getElementById:()=>null}),/unavailable/);
});
test('selection reads full native address fields, handles text state input and rejects mismatched or incomplete saved addresses',()=>{
 const entry={code:'J47'},full=core.savedSalesDetails(detail(),entry);assert.equal(full.line3,'Gate 2');assert.equal(full.stateText,'TX');assert.equal(full.countryValue,'USA');
 for(const changes of [{addressCode:'J99'},{city:''},{state:''},{zipCode:''},{CountrySelector:'0'}])assert.throws(()=>core.savedSalesDetails(detail(changes),entry),/verified|missing/);
});
test('final native review must show selected sales address and separate main invoice address, including pickup',()=>{
 const billing={...address,line1:'PO Box 419',line2:'',line3:''};assert.doesNotThrow(()=>core.assertSalesReview(review(),address,billing));
 assert.throws(()=>core.assertSalesReview(review(billing,billing),address,billing),/sales/);
 assert.throws(()=>core.assertSalesReview(review(address,address),address,billing),/invoice/);
 assert.throws(()=>core.assertSalesReview(review({...address,city:'Bryan'},billing),address,billing),/sales/);
 assert.throws(()=>core.assertSalesReview({getElementById:()=>null},address,billing),/sales/);
});
