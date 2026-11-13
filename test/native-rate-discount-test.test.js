'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createService,normalize,scope,valid,MAX_AGE}=require('../api/native-rate-discount-test')._internal;
const pair=crypto.generateKeyPairSync('ed25519');
const NOW=Date.parse('2026-11-13T22:00:00Z');
const input={shipFrom:{postalCode:'77836'},shipTo:{addressLine:['702 W Buck St','WL RATE TEST ABCDEF0123456789'],city:'Caldwell',state:'TX',postalCode:'77836',country:'US'},totalWeight:4};
function authorization(action='arm',changes={}) {const payload={version:1,action,issuedAt:NOW,expiresAt:NOW+MAX_AGE,input:structuredClone(input),cart:[{pid:'268622',quantity:2},{pid:'268623',quantity:2}],...changes};return {payload,signature:crypto.sign(null,Buffer.from(JSON.stringify(normalize(payload))),pair.privateKey).toString('base64')};}
const base={rates:[{serviceCode:'03',amount:9.95},{serviceCode:'02',amount:35.83}]};
function fixture(options={}) {const records=new Map(),calls={read:0};let time=NOW;const service=createService({publicKey:pair.publicKey,now:()=>time,read:async key=>{calls.read++;return records.get(key);},write:async(key,value,ttl)=>{assert.ok(ttl<=180);records.set(key,value);},remove:async key=>records.delete(key),findClaim:async()=>options.claim || {recommendation:{mode:'ship'},rates:base.rates,totalWeight:4}});return {service,records,calls,advance(ms){time+=ms;}};}
test('a signed current four-box test carries a $31.98 discount through only the Ground response',async()=>{
  const f=fixture(),body=authorization();const armed=await f.service.manage(body);assert.equal(armed.returnedGroundCents,-2203);
  const result=await f.service.result(input,base);assert.equal(result.rates[0].amount,-22.03);assert.equal(result.rates[1].amount,35.83);assert.equal(base.rates[0].amount,9.95);
});
test('ordinary addresses, another marker, another origin and out-of-bounds weight cannot receive the test credit',async()=>{
  const f=fixture();await f.service.manage(authorization());
  for(const change of [x=>x.shipTo.addressLine.pop(),x=>x.shipTo.addressLine[1]='WL RATE TEST 1111111111111111',x=>x.shipTo.addressLine[0]='703 W Buck St',x=>x.shipTo.postalCode='77833',x=>x.shipFrom.postalCode='77833',x=>x.totalWeight=10]) {const other=structuredClone(input);change(other);assert.equal(await f.service.result(other,base),null);}
});
test('forged signatures, changed cart, modified dates and replay after expiry are rejected',async()=>{
  const f=fixture(),original=authorization();
  for(const change of [x=>x.signature='A'.repeat(86)+'==',x=>x.payload.cart[0].quantity=1,x=>x.payload.expiresAt+=1,x=>x.payload.input.shipTo.addressLine[1]='WL RATE TEST 1111111111111111']){const body=structuredClone(original);change(body);await assert.rejects(f.service.manage(body),error=>error.status===403);}
  await f.service.manage(original);f.advance(MAX_AGE+1);assert.equal(await f.service.result(input,base),null);await assert.rejects(f.service.manage(original),error=>error.status===403);
});
test('authorization cannot extend beyond three minutes or the dated test window',async()=>{
  const tooLong=authorization('arm',{expiresAt:NOW+MAX_AGE+1});assert.equal(valid(tooLong.payload,tooLong.signature,pair.publicKey,NOW),null);
  const body=authorization();assert.equal(valid(body.payload,body.signature,pair.publicKey,Date.parse('2026-11-14T06:00:00Z')),null);
});
test('test scope requires the public Caldwell address, a unique marker and positive bounded weight',()=>{
  assert.ok(scope(input));for(const weight of [0,-1,101,Infinity])assert.equal(scope({...input,totalWeight:weight}),null);
  assert.equal(scope({...input,shipTo:{...input.shipTo,addressLine:['702 W Buck St','WL RATE TEST SHORT']}}),null);
});
test('arming needs the current positive native basket quote; a changed/free/other quote fails closed',async()=>{
  for(const claim of [{recommendation:{mode:'delivery'},rates:base.rates,totalWeight:4},{recommendation:{mode:'ship'},rates:[{serviceCode:'03',amount:0}],totalWeight:4},{recommendation:{mode:'ship'},rates:base.rates,totalWeight:5}])await assert.rejects(fixture({claim}).service.manage(authorization()),error=>error.status===409);
  const f=fixture();await f.service.manage(authorization());assert.equal(await f.service.result(input,{rates:[{serviceCode:'03',amount:10}]}),null);
});
test('a signed disarm removes the override without touching normal fulfillment records',async()=>{
  const f=fixture();await f.service.manage(authorization());assert.equal(f.records.size,1);assert.deepEqual(await f.service.manage(authorization('disarm')),{ok:true,active:false});assert.equal(f.records.size,0);assert.equal(await f.service.result(input,base),null);
});

test('the authenticated native XML bridge carries a signed negative test rate, then restores its ordinary floor at expiry',async()=>{
  const route=require('../api/native-rate-discount-test'),legacy=require('../api/rate'),claims=require('../api/fulfillment-sessions');
  const signed=require('./fixtures/expired-native-rate-test-authorization.json');
  const keys=['VERCEL_ENV','KV_REST_API_URL','KV_REST_API_TOKEN','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','PROXY_USERNAME','PROXY_PASSWORD','PROXY_ACCESS_LICENSE'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]])),realNow=Date.now,records=new Map();let time=signed.payload.issuedAt;
  function response(){return {statusCode:0,setHeader(){},end(value){this.body=value;}};}
  try {
    keys.forEach(key=>delete process.env[key]);Object.assign(process.env,{VERCEL_ENV:'production',PROXY_USERNAME:'fixture-user',PROXY_PASSWORD:'fixture-password',PROXY_ACCESS_LICENSE:'fixture-license'});
    Date.now=()=>time;claims.resetMemoryClaims();
    route._internal.setTestStore({get:async key=>records.get(key),set:async(key,value)=>records.set(key,value),del:async key=>records.delete(key)});
    await claims.storeFulfillmentClaim({...signed.payload.input,recommendation:{mode:'ship'},rates:base.rates,availableRates:{ship:base.rates}},true);
    const armed=response();await route({method:'POST',body:signed},armed);assert.equal(armed.statusCode,200);assert.equal(JSON.parse(armed.body).returnedGroundCents,-2203);
    const xml=`<AccessRequest><UserId>fixture-user</UserId><Password>fixture-password</Password><AccessLicenseNumber>fixture-license</AccessLicenseNumber></AccessRequest><RatingServiceSelectionRequest><Request><TransactionReference><CustomerContext>Local native rate test</CustomerContext></TransactionReference></Request><Shipment><ShipFrom><Address><PostalCode>77836</PostalCode><CountryCode>US</CountryCode></Address></ShipFrom><ShipTo><Address><AddressLine>702 W Buck St</AddressLine><AddressLine>WL RATE TEST 0123456789ABCDEF</AddressLine><City>Caldwell</City><StateProvinceCode>TX</StateProvinceCode><PostalCode>77836</PostalCode><CountryCode>US</CountryCode></Address></ShipTo><Package><PackageWeight><UnitOfMeasurement><Code>LBS</Code></UnitOfMeasurement><Weight>4</Weight></PackageWeight></Package></Shipment></RatingServiceSelectionRequest>`;
    const discounted=response();await legacy({method:'POST',headers:{},body:xml,url:'/api/rate'},discounted);assert.equal(discounted.statusCode,200);assert.match(discounted.body,/<ResponseStatusCode>1<\/ResponseStatusCode>/);assert.match(discounted.body,/<TotalCharges>[\s\S]*?<MonetaryValue>-22\.03<\/MonetaryValue>/);
    time=signed.payload.expiresAt+1;const expired=response();await legacy({method:'POST',headers:{},body:xml,url:'/api/rate'},expired);assert.doesNotMatch(expired.body,/-22\.03/);assert.match(expired.body,/<MonetaryValue>9\.95<\/MonetaryValue>/);
    process.env.VERCEL_ENV='preview';const preview=response();await route({method:'POST',body:signed},preview);assert.equal(preview.statusCode,503);
  } finally {Date.now=realNow;route._internal.setTestStore(null);claims.resetMemoryClaims();for(const key of keys)previous[key]===undefined?delete process.env[key]:process.env[key]=previous[key];}
});
