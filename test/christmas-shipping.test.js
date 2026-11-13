'use strict';
process.env.NODE_ENV='test';
const test=require('node:test');
const assert=require('node:assert/strict');
const manifest=require('../data/christmas-shop-2026.json');
const promo=require('../api/christmas-promotion');
const sessions=require('../api/fulfillment-sessions');
const {applyShippingMinimumToRates}=require('../api/shipping-policy');
const bridge=require('../api/rate')._test;
const {buildFulfillmentQuote}=require('../api/fulfillment-quote')._test;
const NOW=Date.parse('2026-11-14T12:00:00-06:00');
const item=manifest.products[0];
const cart=[{...item,quantity:2,netLineTotalCents:10000}];
const trusted=[{...item,quantity:2,unitPriceCents:5000}];
const raw=[{serviceCode:'03',serviceName:'UPS Ground',amount:28,currency:'USD'}, {serviceCode:'02',serviceName:'UPS 2nd Day Air',amount:48,currency:'USD'}];
function freeRates(){return promo.apply(raw,promo.evaluate('MERRY100',cart,trusted,NOW),0,NOW);}
const realNow=Date.now;
test.beforeEach(()=>{Date.now=()=>NOW;sessions.resetMemoryClaims();});
test.afterEach(()=>{Date.now=realNow;});

test('the reviewed Christmas manifest covers the full 172-item shop and all 17 groups',()=>{
  assert.equal(manifest.products.length,172);
  assert.equal(new Set(manifest.products.map(p=>p.productId)).size,172);
  assert.equal(manifest.groups.length,17);
  assert.ok(manifest.products.every(p=>/^[A-Za-z0-9._/-]+$/.test(p.productCode)));
  assert.equal(manifest.products.find(p=>p.productId==='268622').productCode,'9086423');
  assert.ok(manifest.groups.some(g=>g.id==='4696'&&g.parentId==='4651'));
});
test('MERRY100 qualifies at $100 exactly and ignores non-Christmas merchandise',()=>{
  assert.equal(promo.evaluate('merry100',cart,trusted,NOW).applied,true);
  const discounted=[{...cart[0],netLineTotalCents:9999}];
  assert.equal(promo.evaluate('MERRY100',discounted,trusted,NOW).applied,false);
  const unrelated={productId:'999999999',quantity:1,netLineTotalCents:100000};
  assert.equal(promo.evaluate('MERRY100',discounted.concat(unrelated),trusted.concat({...unrelated,unitPriceCents:100000}),NOW).eligibleSubtotalCents,9999);
});
test('native line totals can lower qualifying spend but cannot inflate trusted catalog prices',()=>{
  assert.equal(promo.evaluate('MERRY100',[{...cart[0],netLineTotalCents:999999}],[{...trusted[0],unitPriceCents:4999}],NOW).applied,false);
  for(const value of [undefined,null,-1,Infinity,'bad']) {
    assert.equal(promo.evaluate('MERRY100',[{...cart[0],netLineTotalCents:value}],trusted,NOW).applied,false,String(value));
  }
  assert.equal(promo.evaluate('MERRY100',[{...cart[0],productId:'999999'}],trusted,NOW).applied,false);
});
test('the promotion expires after December 5 Central time and rejects other codes',()=>{
  assert.equal(promo.evaluate('MERRY100',cart,trusted,Date.parse('2026-12-06T05:59:59.999Z')).applied,true);
  assert.equal(promo.evaluate('MERRY100',cart,trusted,Date.parse('2026-12-06T06:00:00Z')).applied,false);
  assert.equal(promo.evaluate('FREESHIP',cart,trusted,NOW).applied,false);
  assert.equal(promo.evaluate('MERRY50',cart,trusted,NOW).reason,'unrecognized');
  assert.equal(promo.evaluate('MERRY100',[{...cart[0],netLineTotalCents:5000}],trusted,NOW).applied,false);
});
test('only validated Ground is free; upgrades and custom processing remain payable',()=>{
  const rates=freeRates();
  assert.equal(rates[0].amount,0);
  assert.equal(rates[1].amount,48);
  assert.equal(applyShippingMinimumToRates({rates}).rates[0].amount,0);
  const cutting=promo.apply(raw,promo.evaluate('MERRY100',cart,trusted,NOW),5,NOW);
  assert.equal(applyShippingMinimumToRates({rates:cutting}).rates[0].amount,5);
  assert.equal(promo.promotionalRate(rates[0],Date.parse('2026-12-06T06:00:00Z')),false);
  assert.equal(promo.promotionalRate({...rates[0],promotion:{...rates[0].promotion,code:'MERRY50'}}),false);
  assert.equal(promo.promotionalRate({...rates[0],promotion:{...rates[0].promotion,eligibleSubtotalCents:9999}}),false);
  assert.equal(bridge.safePositiveRates({rates:[{serviceCode:'03',amount:0}]}).rates.length,0);
  assert.equal(applyShippingMinimumToRates({rates:[{serviceCode:'03',amount:1}]}).rates[0].amount,9.95);
});
test('qualification survives fulfillment, storage, native XML and the final shipping floor',async()=>{
  const body={shipFrom:{postalCode:'77833'},shipTo:{postalCode:'77834',addressLine:['123 Example St'],city:'Example',state:'TX'},cart,promotionCode:'MERRY100'};
  let stored;
  const quote=await buildFulfillmentQuote(body,{
    buildAutomaticShippingQuote:async()=>({result:{rates:raw},claim:{packages:[{weight:3,length:12,width:8,height:6}],productWeight:3,basis:{productRefs:trusted}}}),
    quoteWoodsonDelivery:async()=>({available:true,serviceCode:'03',serviceName:'Woodson Local Delivery',amount:25,currency:'USD'}),
    storeFulfillmentClaim:async claim=>{stored=claim;return sessions.storeFulfillmentClaim(claim);}
  });
  assert.equal(quote.options.ups.amount,0);
  assert.equal(quote.options.delivery.amount,25);
  assert.equal(quote.recommendation.mode,'ship');
  const found=await sessions.findFulfillmentClaim({...body,totalWeight:3});
  assert.equal(found.rates[0].amount,0);
  const result=bridge.safePositiveRates(applyShippingMinimumToRates(bridge.fulfillmentResult(found)));
  assert.match(bridge.successXml(result,'Christmas test'),/<MonetaryValue>0\.00<\/MonetaryValue>/);
  assert.equal(stored.availableRates.delivery[0].amount,25);
  const selected=await sessions.selectFulfillmentClaim({...body,totalWeight:3,mode:'ship'});
  assert.equal(selected.recommendation.amount,0);
});
test('free shipping claims cannot leak through a shared ZIP, another address, or another weight',async()=>{
  const base={shipFrom:{postalCode:'77833'},shipTo:{postalCode:'77834',addressLine:['123 Example St'],city:'Example',state:'TX'},totalWeight:3,recommendation:{mode:'ship',amount:0},rates:freeRates(),availableRates:{ship:freeRates()}};
  assert.equal((await sessions.storeFulfillmentClaim(base)).ok,true);
  assert.equal(await sessions.findFulfillmentClaim({...base,shipTo:{postalCode:'77834'}}),null);
  assert.equal(await sessions.findFulfillmentClaim({...base,shipTo:{...base.shipTo,addressLine:['456 Other St']}}),null);
  assert.equal(await sessions.findFulfillmentClaim({...base,totalWeight:3.2}),null);
  assert.equal((await sessions.findFulfillmentClaim(base)).rates[0].amount,0);
  await sessions.storeFulfillmentClaim({...base,recommendation:{mode:'ship',amount:28},rates:raw,availableRates:{ship:raw}});
  assert.equal((await sessions.findFulfillmentClaim(base)).rates[0].amount,28);
});
