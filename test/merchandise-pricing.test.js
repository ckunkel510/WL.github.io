'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {priceCart,policy}=require('../api/merchandise-pricing');
const {service,STORE_ADDRESSES}=require('../api/cart-pricing')._internal;
const front=require('../CartPricing');
const NOW=Date.parse('2026-11-13T22:00:00Z');
const products=[{productId:'268622',productCode:'9086423',price:19.99,weight:1.44},{productId:'268623',productCode:'9086424',price:19.99,weight:1.44},{productId:'255084',productCode:'9964149',price:10,weight:1}];
const line=(index,q,net)=>({productId:products[index].productId,productCode:products[index].productCode,quantity:q,netLineTotalCents:net ?? Math.round(products[index].price*100)*q});
const catalog=cart=>({fresh:true,active:{id:'verified-catalog'},products:cart.map(p=>products.find(x=>x.productId===p.productId))});
const price=cart=>priceCart(cart,catalog(cart),{now:NOW});
for(const [q,percent,savings] of [[1,25,500],[3,25,1499],[4,40,3198],[8,40,6397],[9,60,10795],[10,60,11994]])test(q+' boxes receive '+percent+'% once with integer cent rounding',()=>{const p=price([line(0,q)]);assert.equal(p.percentOff,percent);assert.equal(p.savingsCents,savings);assert.equal(p.merchandiseSubtotalCents,1999*q-savings);assert.equal(p.cart[0].netLineTotalCents,p.merchandiseSubtotalCents);});
test('mixed SKUs reach one shared tier, while clips do not count or receive savings',()=>{const p=price([line(0,2),line(1,2),line(2,12)]);assert.equal(p.eligibleQuantity,4);assert.equal(p.deltaCents,-3198);assert.equal(p.cart[2].netLineTotalCents,12000);assert.equal(p.cart.reduce((s,l)=>s+l.netLineTotalCents,0),p.merchandiseSubtotalCents);});
test('decreasing across both boundaries replaces the old credit',()=>{assert.equal(price([line(0,9)]).percentOff,60);assert.equal(price([line(0,8)]).percentOff,40);assert.equal(price([line(0,3)]).percentOff,25);assert.equal(price([line(2,9)]).savingsCents,0);});
test('a native discount already at or below the tier is not duplicated',()=>{assert.equal(price([line(0,4,4798)]).deltaCents,0);assert.equal(price([line(0,4,4000)]).deltaCents,0);assert.equal(price([line(0,4,5997)]).deltaCents,-1199);});
test('employees do not receive this sale and client prices cannot inflate its base',()=>{const c=[line(0,4)];assert.equal(priceCart(c,catalog(c),{employee:true,now:NOW}).savingsCents,0);assert.throws(()=>price([line(0,4,99999)]));assert.throws(()=>price([line(0,1.5)]));assert.throws(()=>price([line(0,1),line(0,1)]));assert.throws(()=>priceCart(c,{fresh:false,products:products},{now:NOW}));});
test('all server and browser eligible IDs agree and only packaged light products are included',()=>{assert.deepEqual(new Set(front.lightIds),new Set(policy.products.map(p=>p.productId)));assert.equal(policy.products.length,46);assert.equal(policy.excludedProducts.length,8);assert.ok(policy.excludedProducts.every(p=>!front.lightIds.includes(p.productId)));});
test('future approved special-order unit prices support increases and decreases without stacking light tiers',()=>{for(const unit of [1500,2500]){const c=[line(0,4)],p=priceCart(c,catalog(c),{now:NOW,trustedSpecialPrices:[{productId:'268622',quantity:4,unitPriceCents:unit,quoteId:'server-approved-quote',expiresAt:NOW+60000}]});assert.equal(p.merchandiseSubtotalCents,unit*4);assert.equal(p.deltaCents,unit*4-7996);assert.equal(p.savingsCents,0);}assert.throws(()=>priceCart([line(0,4)],catalog([line(0,4)]),{now:NOW,trustedSpecialPrices:[{productId:'268622',quantity:3,unitPriceCents:100,quoteId:'bad',expiresAt:NOW+60000}]}));});
function fixture(){let time=NOW;const records=new Map();const core=service({now:()=>time,getCatalogProducts:async c=>catalog(c),store:{read:async k=>records.get(k),write:async(k,v)=>records.set(k,v)},randomToken:()=> 'a'.repeat(30),quote:async body=>{assert.equal(body.cart.reduce((s,p)=>s+p.netLineTotalCents,0),4798);return {options:{ups:{available:true,rates:[{serviceCode:'03',serviceName:'UPS Ground',amount:9.95,currency:'USD'},{serviceCode:'02',serviceName:'UPS Second Day Air',amount:35.83,currency:'USD'}]},delivery:{available:true,serviceName:'Woodson Local Delivery',amount:25}}};}});return {core,records,expire(){time+=901000;}};}
const body={cart:[line(0,2),line(1,2)],shipFrom:{postalCode:'77836'},carrierOrigin:{postalCode:'77836'},shipTo:STORE_ADDRESSES['2'],pickupBranch:'2'};
const native=r=>({shipFrom:{postalCode:'77836'},shipTo:r.nativeAddress,packages:[{weight:5.76}]});
test('pickup carries exactly the credit with zero fulfillment cost and canonical selected store',async()=>{const f=fixture(),r=await f.core.reserve({...body,mode:'pickup'});assert.equal(r.receipt.nativeAddress.addressLine[0],'702 W Buck St');assert.equal(r.receipt.rates[0].amount,0);const result=await f.core.nativeResult(native(r.receipt));assert.equal(result.rates[0].amount,-31.98);assert.equal(result.rates[0].serviceName,'Store pickup');});
test('each shipping speed and Woodson delivery include one identical merchandise credit',async()=>{for(const mode of ['ship','delivery']){const f=fixture(),{receipt}=await f.core.reserve({...body,mode});const result=await f.core.nativeResult(native(receipt));assert.equal(result.rates[0].amount,mode==='ship'?-22.03:-6.98);if(mode==='ship')assert.equal(result.rates[1].amount,3.85);}});
test('receipts cannot leak through destination/origin/weight fallback; expired receipts block rather than full-price checkout',async()=>{const f=fixture(),{receipt}=await f.core.reserve({...body,mode:'pickup'});for(const change of [x=>x.shipTo={...x.shipTo,city:'Bryan'},x=>x.shipFrom={postalCode:'77833'},x=>x.packages=[{weight:4}],x=>x.shipTo={...x.shipTo,addressLine:['702 W Buck St','WLQ:'+'b'.repeat(30)]}]){const input=structuredClone(native(receipt));change(input);await assert.rejects(f.core.nativeResult(input));}assert.equal(await f.core.nativeResult({...native(receipt),shipTo:STORE_ADDRESSES['2']}),null);f.expire();await assert.rejects(f.core.nativeResult(native(receipt)));assert.equal(f.records.size,1);});
test('public arbitrary adjustment fields have no effect on pricing',async()=>{const f=fixture();const p=await f.core.preview({...body,adjustments:[{amountCents:-99999}],prices:[0],discount:99});assert.equal(p.deltaCents,-3198);});
test('presentation splits the real returned amount into savings and shipping without modifying native total',()=>{const receipt={expiresAt:Date.now()+60000,pricing:price(body.cart),rates:[{amount:9.95}]};const t={subtotal:7996,shipping:-2203,tax:478,total:6271};assert.deepEqual(front.reconcile(t,receipt),{merchandise:7996,adjustments:receipt.pricing.adjustments,subtotal:4798,shipping:995,tax:478,total:6271});assert.equal(front.reconcile({...t,shipping:995},receipt),null);assert.equal(front.reconcile({...t,total:9733},receipt),null);assert.equal(front.reconcile(t,{...receipt,expiresAt:0}),null);assert.equal(front.cents('$-22.03'),-2203);});

test('the authenticated native XML bridge imports pickup, UPS and local-delivery receipts without an ordinary fulfillment fallback',async()=>{
  const route=require('../api/cart-pricing'),bridge=require('../api/rate');
  const keys=['PROXY_USERNAME','PROXY_PASSWORD','PROXY_ACCESS_LICENSE'],before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  Object.assign(process.env,{PROXY_USERNAME:'fixture-user',PROXY_PASSWORD:'fixture-password',PROXY_ACCESS_LICENSE:'fixture-license'});
  try {
    for(const mode of ['pickup','ship','delivery']){
      const f=fixture(),{receipt}=await f.core.reserve({...body,mode});
      // Fixture time is deliberately fixed; make this receipt current only for
      // the imported bridge call, never as an externally usable authorization.
      for(const record of f.records.values()){record.createdAt=Date.now();record.expiresAt=Date.now()+60000;}
      route._internal.setTestStore({read:async k=>f.records.get(k)});
      const address=receipt.nativeAddress.addressLine.map(s=>'<AddressLine>'+s+'</AddressLine>').join('');
      const xml='<AccessRequest><UserId>fixture-user</UserId><Password>fixture-password</Password><AccessLicenseNumber>fixture-license</AccessLicenseNumber></AccessRequest><RatingServiceSelectionRequest><Shipment><ShipFrom><Address><PostalCode>77836</PostalCode></Address></ShipFrom><ShipTo><Address>'+address+'<City>Caldwell</City><StateProvinceCode>TX</StateProvinceCode><PostalCode>77836</PostalCode><CountryCode>US</CountryCode></Address></ShipTo><Package><PackageWeight><UnitOfMeasurement><Code>LBS</Code></UnitOfMeasurement><Weight>5.76</Weight></PackageWeight></Package></Shipment></RatingServiceSelectionRequest>';
      const res={setHeader(){},end(body){this.body=body;}};await bridge({method:'POST',headers:{},body:xml},res);
      assert.match(res.body,/<ResponseStatusCode>1<\/ResponseStatusCode>/);
      assert.ok(res.body.includes('<MonetaryValue>'+({pickup:'-31.98',ship:'-22.03',delivery:'-6.98'}[mode])+'</MonetaryValue>'));
    }
  }finally{route._internal.setTestStore(null);for(const k of keys)before[k]===undefined?delete process.env[k]:process.env[k]=before[k];}
});

test('repeated startup callbacks keep a slow same-cart price response current',async()=>{
  const revisions=front.quoteRevisions();let finish;const response=new Promise(resolve=>{finish=resolve;});
  const first=revisions.begin('four-box-cart');let applied=false;
  const pending=response.then(()=>{if(revisions.current(first))applied=true;});
  assert.equal(revisions.begin('four-box-cart'),null);assert.equal(revisions.begin('four-box-cart'),null);
  finish();await pending;assert.equal(applied,true);
  assert.equal(revisions.begin('four-box-cart'),null);assert.equal(revisions.current(first),true);
});
test('a changed basket supersedes its older quote, and a failed old response cannot reset the new basket',()=>{
  const revisions=front.quoteRevisions(),old=revisions.begin('three-box-cart'),next=revisions.begin('nine-box-cart');
  assert.equal(revisions.current(old),false);revisions.retry(old);assert.equal(revisions.begin('nine-box-cart'),null);assert.equal(revisions.current(next),true);
  revisions.retry(next);assert.ok(revisions.begin('nine-box-cart')>next);revisions.invalidate();assert.equal(revisions.current(next),false);
});

test('a new receipt removes prior pricing markers restored by native Back, including a real second address line',async()=>{
 for(const mode of ['ship','delivery']){
  const f=fixture(),oldMarker='WLQ:'+'b'.repeat(30),shipTo={...body.shipTo,addressLine:['702 W Buck St','Unit 1',oldMarker]};
  const {receipt}=await f.core.reserve({...body,mode,shipTo});
  assert.deepEqual(receipt.nativeAddress.addressLine,['702 W Buck St','Unit 1','WLQ:'+'a'.repeat(30)]);
  assert.equal((await f.core.nativeResult(native(receipt))).rates[0].amount,mode==='ship'?-22.03:-6.98);
  assert.deepEqual(shipTo.addressLine,['702 W Buck St','Unit 1',oldMarker]);
 }
});
test('browser Back and re-entry snapshots remove only technical markers and preserve genuine address fields',()=>{
 const values={AddressLine1:'702 W Buck St',AddressLine2:'Unit 1',AddressLine3:'WLQ:'+'a'.repeat(30),Postcode:'77836'};
 assert.deepEqual(front.cleanAddressValues(values),{...values,AddressLine3:''});
 const genuine={...values,AddressLine3:'Building C'};assert.deepEqual(front.cleanAddressValues(genuine),genuine);
 assert.equal(values.AddressLine3,'WLQ:'+'a'.repeat(30));
});
