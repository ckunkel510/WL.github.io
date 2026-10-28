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
function pagedGrid(start,size,total=137){const doc=grid(Array.from({length:Math.min(size,total-start)},(_,i)=>({id:String(start+i+1),code:'JOB'+(start+i+1),ref:'Site '+(start+i+1)})));doc.querySelectorAll=()=>[0,...(start+size<total?[start+size]:[]),...(start===0&&size===12?[0]:[])].map((offset,i)=>({getAttribute:()=>'/AddressList_R.aspx?pageIndex='+offset+'&groupIndex=0&itemsPerPage='+(size===12&&i===2?48:size)}));return doc;}
test('the picker follows native pagination and loads all 137 saved jobs rather than only the first native page',async()=>{
 const reads=[],verified=[];
 const entries=await core.allSalesAddresses(async path=>{reads.push(path);const u=new URL(path,'https://webtrack.woodsonlumber.com');return pagedGrid(Number(u.searchParams.get('pageIndex')||0),Number(u.searchParams.get('itemsPerPage')||12));},async()=>verified.push(true));
 assert.equal(entries.length,137);assert.equal(entries[136].code,'JOB137');assert.equal(core.matchingSalesAddresses(entries,'Site 137').length,1);
 assert.deepEqual(reads,['/AddressList_R.aspx','/AddressList_R.aspx?pageIndex=0&groupIndex=0&itemsPerPage=48','/AddressList_R.aspx?pageIndex=48&groupIndex=0&itemsPerPage=48','/AddressList_R.aspx?pageIndex=96&groupIndex=0&itemsPerPage=48']);assert.equal(verified.length,4);
});
test('address paging remains on native read-only list links and stops if account verification fails',async()=>{
 const page={querySelectorAll:()=>['https://example.test/AddressList_R.aspx?pageIndex=48','/ShoppingCart.aspx?pageIndex=48','?pageIndex=-1','?pageIndex=48&itemsPerPage=999','?pageIndex=24&itemsPerPage=12'].map(href=>({getAttribute:()=>href}))};
 assert.equal(core.salesAddressPage(page,'/AddressList_R.aspx',false),'/AddressList_R.aspx?pageIndex=24&itemsPerPage=12');
 let reads=0;await assert.rejects(core.allSalesAddresses(async()=>{reads++;return pagedGrid(0,48);},async()=>{throw Error('Account changed');}),/Account changed/);assert.equal(reads,1);
});
test('a native detail-page failure can use only a complete unambiguous address already returned by the authorized list',()=>{
 const entry={code:'JOB47',summary:'100 Job Street, Caldwell, Texas, 77836, United States',jobReference:'Site 47',phone:'9795550100',contactName:'Site Contact'};
 const full=core.savedSalesDetails({getElementById:()=>null},entry);assert.equal(full.line1,'100 Job Street');assert.equal(full.stateValue,'TX');assert.equal(full.zip,'77836');assert.equal(full.jobReference,'Site 47');assert.equal(full.phone,entry.phone);
 const canada=core.listedSalesDetails({...entry,summary:'100 Main St, Ottawa, Ontario, K1A 0B1, Canada'});assert.equal(canada.countryValue,'CAN');assert.equal(canada.stateValue,'ON');
});
test('list fallback never guesses missing fields, splits ambiguous street lines, accepts invalid regions or masks a mismatched native record',()=>{
 const entry={code:'JOB47',summary:'100 Job Street, Caldwell, TX, 77836, United States'};
 for(const summary of ['100 Job Street, United States','100 Job Street, Caldwell, 77836, United States','100 Job Street, Building A, Caldwell, TX, 77836, United States','100 Job Street, Caldwell, ZZ, 77836, United States','100 Job Street, Caldwell, TX, 778360, United States','100 Job Street, Ottawa, Ontario, 77836, United States','100 Job Street, Caldwell, TX, 77836, Canada']){
  assert.equal(core.listedSalesDetails({...entry,summary}),null);assert.throws(()=>core.savedSalesDetails({getElementById:()=>null},{...entry,summary}),/incomplete/);
 }
 assert.throws(()=>core.savedSalesDetails(detail({addressCode:'other'}),entry),/verified/);
});
