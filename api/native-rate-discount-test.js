'use strict';

// Short, signed diagnostic for the owner's four-box test. Not a sale engine.
const crypto = require('node:crypto');
const {Redis} = require('@upstash/redis');
const {findFulfillmentClaim, publicOriginBranch} = require('./fulfillment-sessions');
const PUBLIC_KEY = "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAxbky7WWV2swEMrfHGji5nh5/FD88NdOF6CIxafwj6rQ=\n-----END PUBLIC KEY-----\n";
const END = Date.parse('2026-11-14T06:00:00Z');
const MAX_AGE = 180000;
const DISCOUNT_CENTS = 3198;
const ORIGINAL_GROUND_CENTS = 995;
const clean = value => String(value || '').toUpperCase().replace(/\s+/g,' ').trim();

function scope(input) {
  const to=input?.shipTo,lines=(Array.isArray(to?.addressLine)?to.addressLine:[]).map(clean).filter(Boolean);
  const origin=String(input?.shipFrom?.postalCode || '').match(/^\d{5}/)?.[0];
  const zip=String(to?.postalCode || '').match(/^\d{5}/)?.[0];
  const weight=Number(input?.totalWeight) || (Array.isArray(input?.packages)?input.packages.reduce((sum,p)=>sum+Number(p.weight || 0),0):0);
  if (publicOriginBranch(input)==='unmapped' || !origin || zip!=='77836' || clean(to?.city)!=='CALDWELL' ||
      !['TX','TEXAS'].includes(clean(to?.state)) || !['','US','USA','UNITED STATES'].includes(clean(to?.country)) ||
      lines.length!==2 || lines[0]!=='702 W BUCK ST' || !/^WL RATE TEST [A-F0-9]{16}$/.test(lines[1]) ||
      !Number.isFinite(weight) || weight<=0 || weight>100) return null;
  const destination=crypto.createHash('sha256').update(JSON.stringify([lines,'CALDWELL','TX',zip])).digest('hex');
  return {origin,destination,marker:lines[1],weight:Number(weight.toFixed(2))};
}

function normalize(payload) {
  if (!payload || payload.version!==1 || !['arm','disarm'].includes(payload.action)) return null;
  const s=scope(payload.input);
  const cart=(Array.isArray(payload.cart)?payload.cart:[]).map(line=>({pid:String(line.pid || ''),quantity:Number(line.quantity)})).sort((a,b)=>a.pid.localeCompare(b.pid));
  if (!s || JSON.stringify(cart)!==JSON.stringify([{pid:'268622',quantity:2},{pid:'268623',quantity:2}])) return null;
  return {version:1,action:payload.action,issuedAt:Number(payload.issuedAt),expiresAt:Number(payload.expiresAt),scope:s,cart};
}

function valid(payload,signature,publicKey,now) {
  const n=normalize(payload);
  if (!n || now>=END || !Number.isSafeInteger(n.issuedAt) || !Number.isSafeInteger(n.expiresAt) ||
      n.issuedAt>now+5000 || n.issuedAt<now-MAX_AGE || n.expiresAt<=now ||
      n.expiresAt<=n.issuedAt || n.expiresAt-n.issuedAt>MAX_AGE || n.expiresAt>END ||
      typeof signature!=='string' || !/^[A-Za-z0-9+/]{86}==$/.test(signature)) return null;
  try { return crypto.verify(null,Buffer.from(JSON.stringify(n)),publicKey,Buffer.from(signature,'base64'))?n:null; }
  catch (_) { return null; }
}

const keyFor=s=>`wl:native-rate-discount-test:${s.origin}:${s.destination}`;
function createService(deps) {
  const now=deps.now || Date.now;
  const verifyKey=deps.publicKey || PUBLIC_KEY;
  return {
    async manage(body) {
      const n=valid(body?.payload,body?.signature,verifyKey,now());
      if (!n) {const error=new Error('A current signed test authorization is required.');error.status=403;throw error;}
      const key=keyFor(n.scope);
      if (n.action==='disarm') {await deps.remove(key);return {ok:true,active:false};}
      const claim=await deps.findClaim(body.payload.input);
      const ground=claim?.rates?.find(rate=>String(rate.serviceCode)==='03');
      if (!claim || claim.recommendation?.mode!=='ship' || Math.round(Number(ground?.amount)*100)!==ORIGINAL_GROUND_CENTS ||
          !Number.isFinite(Number(claim.totalWeight)) || Math.abs(Number(claim.totalWeight)-n.scope.weight)>0.021) {
        const error=new Error('The current positive test-basket Ground quote must be $9.95.');error.status=409;throw error;
      }
      const payload={version:1,action:n.action,issuedAt:n.issuedAt,expiresAt:n.expiresAt,
        input:{shipFrom:{postalCode:n.scope.origin},shipTo:{addressLine:['702 W Buck St',n.scope.marker],city:'Caldwell',state:'TX',postalCode:'77836',country:'US'},totalWeight:n.scope.weight},cart:n.cart};
      await deps.write(key,{payload,signature:body.signature},Math.max(1,Math.ceil((n.expiresAt-now())/1000)));
      return {ok:true,active:true,expiresAt:new Date(n.expiresAt).toISOString(),discountCents:DISCOUNT_CENTS,returnedGroundCents:ORIGINAL_GROUND_CENTS-DISCOUNT_CENTS};
    },
    async result(input,result) {
      const current=scope(input);
      if (!current || now()>=END) return null;
      const record=await deps.read(keyFor(current));
      const n=valid(record?.payload,record?.signature,verifyKey,now());
      if (!n || n.action!=='arm' || current.origin!==n.scope.origin || current.destination!==n.scope.destination ||
          current.marker!==n.scope.marker || Math.abs(current.weight-n.scope.weight)>Math.max(2,n.scope.weight*0.35)) return null;
      const ground=result?.rates?.find(rate=>String(rate.serviceCode)==='03');
      if (Math.round(Number(ground?.amount)*100)!==ORIGINAL_GROUND_CENTS) return null;
      return {...result,rates:result.rates.map(rate=>String(rate.serviceCode)==='03'?{...rate,amount:(ORIGINAL_GROUND_CENTS-DISCOUNT_CENTS)/100}:rate)};
    }
  };
}

let redis;
function service() {
  if (process.env.VERCEL_ENV!=='production') return null;
  if (!redis && !(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) && !(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)) return null;
  if (!redis) redis=Redis.fromEnv();
  return createService({read:key=>redis.get(key),write:(key,value,ttl)=>redis.set(key,value,{ex:ttl}),remove:key=>redis.del(key),findClaim:findFulfillmentClaim});
}

async function testResultFor(input,result) {
  // Most requests return here without a Redis call; all standard rate guards stay.
  if (!scope(input) || Date.now()>=END) return null;
  const active=service();
  if (!active) return null;
  try {return await active.result(input,result);} catch (_) {return null;}
}

async function handler(req,res) {
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  if (req.method!=='POST') {res.statusCode=405;return res.end(JSON.stringify({error:'POST is required.'}));}
  try {
    const active=service();
    if (!active || Date.now()>=END) {res.statusCode=503;return res.end(JSON.stringify({error:'The rate test is inactive.'}));}
    if (typeof req.body==='string' && req.body.length>16000) {res.statusCode=413;return res.end(JSON.stringify({error:'Request too large.'}));}
    const body=typeof req.body==='object'?req.body:JSON.parse(req.body || '{}');
    const result=await active.manage(body);
    res.statusCode=200;return res.end(JSON.stringify(result));
  } catch (error) {
    res.statusCode=error.status || 500;
    return res.end(JSON.stringify({error:error.status?error.message:'The rate test could not be updated.'}));
  }
}
module.exports=handler;
module.exports._internal={scope,normalize,valid,createService,testResultFor,END,MAX_AGE,DISCOUNT_CENTS,ORIGINAL_GROUND_CENTS,setTestStore:store=>{redis=store;}};
