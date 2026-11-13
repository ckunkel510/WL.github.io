'use strict';

const crypto = require('node:crypto');
const {Redis} = require('@upstash/redis');
const {priceCart} = require('./merchandise-pricing');
const {getCatalogProducts} = require('./shipping-catalog');
const {buildFulfillmentQuote,carrierOriginFor} = require('./fulfillment-quote')._test;
const {publicOriginBranch} = require('./fulfillment-sessions');
const {normalizeUsState} = require('./us-state');
const TTL = 15 * 60;
const PREFIX = 'WLQ:';
const STORE_ADDRESSES = {
  '1': {name:'Brenham', addressLine:['301 Clinton St'], city:'Brenham', state:'TX', postalCode:'77833',country:'US'},
  '4': {name:'Bryan', addressLine:['105 W Pease St'], city:'Bryan', state:'TX', postalCode:'77801',country:'US'},
  '2': {name:'Caldwell', addressLine:['702 W Buck St'], city:'Caldwell', state:'TX', postalCode:'77836',country:'US'},
  '3': {name:'Lexington', addressLine:['8714 US-77'], city:'Lexington', state:'TX', postalCode:'78947',country:'US'},
  '5': {name:'Groesbeck', addressLine:['1219 E Yeagua St'], city:'Groesbeck', state:'TX', postalCode:'76642',country:'US'},
  '6': {name:'Mexia', addressLine:['1127 E Milam St'], city:'Mexia', state:'TX', postalCode:'76667',country:'US'},
  '7': {name:'Buffalo', addressLine:['2871 W Commerce St'], city:'Buffalo', state:'TX', postalCode:'75831',country:'US'}
};
const clean = value => String(value || '').toUpperCase().replace(/\s+/g,' ').trim();
const error = (message,status=409) => Object.assign(new Error(message),{status});
function cleanAddress(address) {
  if (!address || !Array.isArray(address.addressLine)) throw error('A complete fulfillment address is required.');
  // WebForms can restore our prior carrier marker from its address draft after
  // Back. It is never a delivery address line and cannot enter a new receipt.
  return {...address,addressLine:address.addressLine.map(line=>String(line).trim()).filter(line=>line && !/^WLQ:[a-f0-9]{30}$/i.test(line))};
}
function marker(input) {
  const lines = input?.shipTo?.addressLine || [];
  const found = lines.filter(line => clean(line).startsWith(PREFIX));
  if (!found.length) return '';
  if (found.length!==1 || !/^WLQ:[a-f0-9]{30}$/i.test(String(found[0]).trim())) throw error('Please return to your order details to refresh pricing.');
  return String(found[0]).trim().slice(PREFIX.length).toLowerCase();
}
function addressHash(address) {
  const lines = (address?.addressLine || []).map(clean).filter(line => line && !line.startsWith(PREFIX));
  const state = normalizeUsState(address?.state) || clean(address?.state);
  const zip = String(address?.postalCode || '').match(/^\d{5}/)?.[0];
  if (!lines.length || lines.length>2 || !clean(address?.city) || !state || !zip || !['US','USA','UNITED STATES'].includes(clean(address?.country || 'US'))) throw error('A complete US fulfillment address is required.');
  return crypto.createHash('sha256').update(JSON.stringify([lines,clean(address.city),state,zip])).digest('hex');
}
function originPostal(input) {
  if (publicOriginBranch(input)==='unmapped') throw error('A current Woodson trading branch is required.');
  return String(input.shipFrom.postalCode).match(/^\d{5}/)[0];
}
let redis, testStore;
function storage() {
  if (testStore) return testStore;
  if (!redis) {
    if (!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) && !(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)) throw error('Pricing storage is temporarily unavailable.',503);
    redis=Redis.fromEnv();
  }
  return {read:key=>redis.get(key),write:(key,value)=>redis.set(key,value,{ex:TTL})};
}
function service(deps={}) {
  const now=deps.now || Date.now;
  const getProducts=deps.getCatalogProducts || getCatalogProducts;
  const quote=deps.quote || buildFulfillmentQuote;
  return {
    async preview(body) {
      const catalog=await getProducts(body.cart);
      // Future special-order issuers resolve an approved quote ID on the server.
      // No body.prices/body.adjustments/body.discount fields are used.
      const special=deps.resolveSpecialPrices ? await deps.resolveSpecialPrices(body.specialQuoteIds,body.cart) : [];
      const pricing=priceCart(body.cart,catalog,{now:now(),employee:body.employee===true,trustedSpecialPrices:special});
      return pricing;
    },
    async reserve(body) {
      const pricing=await this.preview(body);
      if (!pricing.deltaCents) return {pricing,receipt:null};
      if (!['ship','delivery','pickup'].includes(body.mode)) throw error('Choose your fulfillment method.');
      if (!(pricing.totalWeight>0)) throw error('The current basket weight must be verified before applying pricing.');
      const origin=originPostal({shipFrom:body.carrierOrigin});
      const sourceAddress=body.mode==='pickup' ? STORE_ADDRESSES[String(body.pickupBranch)] : body.shipTo;
      if (!sourceAddress) throw error('Please confirm your pickup store.');
      const address=cleanAddress(sourceAddress);
      const destinationHash=addressHash(address);
      let rates;
      if (body.mode==='pickup') rates=[{serviceCode:'03',serviceName:'Store pickup',amount:0,currency:'USD',billingWeight:pricing.totalWeight}];
      else {
        const adjusted=pricing.cart.map((p,i)=>({...body.cart[i],...p}));
        const result=await quote({...body,shipFrom:carrierOriginFor({shipFrom:body.shipFrom}),shipTo:address,cart:adjusted},
          {carrierOrigin:carrierOriginFor({carrierOrigin:body.carrierOrigin})});
        const option=result.options?.[body.mode==='ship'?'ups':'delivery'];
        if (!option?.available) throw error('Your selected fulfillment method needs a current quote.');
        rates=body.mode==='ship' ? option.rates : [{serviceCode:'03',serviceName:option.serviceName,amount:option.amount,currency:'USD',billingWeight:pricing.totalWeight}];
        if (!Array.isArray(rates) || !rates.length || rates.some(r=>!Number.isFinite(Number(r.amount)) || Number(r.amount)<0)) throw error('The fulfillment quote is invalid.');
      }
      const token=(deps.randomToken || (()=>crypto.randomBytes(15).toString('hex')))();
      const record={version:1,origin,destinationHash,mode:body.mode,pricing,rates,createdAt:now(),expiresAt:now()+TTL*1000};
      await (deps.store || storage()).write('wl:merchandise-pricing:'+token,record);
      return {pricing,receipt:{token,mode:body.mode,expiresAt:record.expiresAt,pricing,rates,
        nativeAddress:{...address,addressLine:[...address.addressLine,PREFIX+token]},pickupBranch:body.mode==='pickup'?String(body.pickupBranch):null}};
    },
    async nativeResult(input) {
      const token=marker(input);
      if (!token) return null;
      const record=await (deps.store || storage()).read('wl:merchandise-pricing:'+token);
      const weight=(input.packages || []).reduce((sum,p)=>sum+Number(p.weight || 0),0);
      if (!record || record.version!==1 || record.expiresAt<=now() || record.createdAt>now()+5000 ||
          record.origin!==originPostal(input) || record.destinationHash!==addressHash(input.shipTo) ||
          !Number.isFinite(weight) || Math.abs(weight-record.pricing.totalWeight)>0.021) throw error('Your cart pricing needs to be refreshed from order details.');
      return {rates:record.rates.map(rate=>({...rate,amount:(Math.round(Number(rate.amount)*100)+record.pricing.deltaCents)/100}))};
    }
  };
}
async function nativeResult(input) {return service().nativeResult(input);}
async function handler(req,res) {
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
  const origin=req.headers?.origin;
  const origins=process.env.VERCEL_ENV==='production' ? ['https://webtrack.woodsonlumber.com'] : ['https://webtrack.woodsonlumber.com','http://127.0.0.1:8787'];
  if (!origins.includes(origin)) {res.statusCode=403;return res.end(JSON.stringify({error:'Origin is not allowed.'}));}
  res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if (req.method==='OPTIONS') {res.statusCode=204;return res.end();}
  if (req.method!=='POST') {res.statusCode=405;return res.end(JSON.stringify({error:'POST is required.'}));}
  try {
    if (typeof req.body==='string' && req.body.length>32000) throw error('The cart request is too large.',413);
    const body=typeof req.body==='object'?req.body:JSON.parse(req.body || '{}');
    const result=body.action==='reserve' ? await service().reserve(body) : {pricing:await service().preview(body)};
    res.statusCode=200;return res.end(JSON.stringify({ok:true,...result}));
  } catch (e) {res.statusCode=e.status || 503;return res.end(JSON.stringify({error:e.status?e.message:'Pricing could not be refreshed. Please retry.'}));}
}
module.exports=handler;
module.exports._internal={service,nativeResult,marker,addressHash,cleanAddress,STORE_ADDRESSES,TTL,setTestStore:store=>{testStore=store;}};
