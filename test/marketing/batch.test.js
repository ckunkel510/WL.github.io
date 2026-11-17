'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {runBatch}=require('../../lib/marketing/batch');
const now=Date.parse('2026-11-17T17:00:00Z');
const withReview=require('./review-fixture');
const campaign=withReview({id:'x',revision:'r1',themeId:'trade',category:'building',audience:'trade_news',trigger:'declared',allowEditorialOnly:true,notBefore:'2026-11-01T00:00:00Z',expiresAt:'2026-12-01T00:00:00Z',productsVerified:true,linksVerified:true,contentVerified:true,approval:{status:'approved',owner:'fixture',revision:'r1',themeId:'trade',categories:['building'],audiences:['trade_news'],expiresAt:'2026-12-01T00:00:00Z'}},now);
function adapter(){return {snapshot:async id=>({contact:{id,permission:'explicit',marketingOptIn:true,status:'active',purchases:[],interests:['trade_news']},ledger:{complete:true,entries:[]}}),reserveAndRecheck:async({campaign})=>({acquired:true,idempotencyKey:'fixture',decision:campaign.decision,reviewHash:campaign.review.hash}),deliver:async()=>({providerMessageId:'fixture'}),finish:async()=>{}};}
test('batch defaults to dry run and deduplicates contacts',async()=>{const a=adapter();a.deliver=()=>{throw Error('Must not deliver')};const r=await runBatch({contactIds:['1','1'],campaigns:[campaign],adapter:a,now});assert.equal(r.length,1);assert.equal(r[0].status,'would_send');});
test('concurrent or revoked reservation cannot send',async()=>{const a=adapter();a.reserveAndRecheck=async()=>({acquired:false});a.deliver=()=>{throw Error('Must not deliver')};const r=await runBatch({contactIds:['1'],campaigns:[campaign],adapter:a,now,dryRun:false});assert.equal(r[0].status,'suppressed');});
test('uncertain provider outcome stays reserved for reconciliation',async()=>{const a=adapter();let final;a.deliver=async()=>{throw Error('timeout')};a.finish=async(_,state)=>final=state.status;const r=await runBatch({contactIds:['1'],campaigns:[campaign],adapter:a,now,dryRun:false});assert.equal(r[0].status,'uncertain');assert.equal(final,'uncertain');});
test('a real send needs a transactional adapter',async()=>{await assert.rejects(runBatch({contactIds:['1'],campaigns:[campaign],adapter:{snapshot:adapter().snapshot},now,dryRun:false}),/Transactional/);});

test('an incomplete or stale atomic recheck cannot deliver a prior snapshot',async()=>{const a=adapter();a.reserveAndRecheck=async()=>({acquired:true,idempotencyKey:'fixture'});a.deliver=()=>{throw Error('Must not deliver')};const r=await runBatch({contactIds:['1'],campaigns:[campaign],adapter:a,now,dryRun:false});assert.equal(r[0].status,'suppressed');});
