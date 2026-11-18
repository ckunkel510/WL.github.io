'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createReview,approveReview,releaseGate,queueStatus,reviewHash}=require('../../lib/marketing/review');
const fixture=require('./review-fixture');
const now=Date.parse('2026-11-20T17:00:00Z'),hour=3600000;
const campaign=()=>fixture({id:'review-fixture',revision:'r1',themeId:'savings',category:'tools',audience:'deals',products:[{sku:'1',title:'Exact item',price:20,currency:'USD'}]},now);
test('each campaign needs owner approval; theme approval alone is insufficient',()=>{const c=campaign();assert.equal(releaseGate(c,now),null);delete c.review;assert.equal(releaseGate(c,now),'creative_review');});
test('subject, creative, products and release changes invalidate exact approval',()=>{for(const mutate of [c=>c.reviewManifest.subject='Changed',c=>c.reviewManifest.html='<p>New</p>',c=>c.products[0].price=21,c=>c.reviewManifest.scheduledFor='2026-11-21T17:00:00Z',c=>c.audience='project_tips']){const c=campaign();mutate(c);assert.equal(releaseGate(c,now),'review_changed');}});
test('fresh stock evidence can refresh without changing approved price or creative',()=>{const c=campaign();c.products[0].storeStock={fixture:{available:true}};assert.equal(releaseGate(c,now),null);});
test('late drafts need a later release to preserve minimum review time',()=>assert.throws(()=>createReview(campaign().reviewManifest,{now:now-23*hour}),/24 hours/));
test('daily batch can contain multiple review and reminder campaigns; late pending campaigns hold',()=>{const c=campaign(),r=createReview(c.reviewManifest,{now:now-72*hour});assert.equal(queueStatus(r,now-60*hour),'preparing');assert.equal(queueStatus(r,now-48*hour),'ready_for_review');assert.equal(queueStatus(r,now-24*hour),'approval_reminder');assert.equal(queueStatus(r,now-6*hour),'held');assert.throws(()=>approveReview(r,c.reviewManifest,{owner:'owner',now:now-5*hour}),/deadline/);});
test('release cannot silently move to tomorrow or replay after its one-hour window',()=>{const c=campaign();assert.equal(releaseGate(c,now-hour),'release_window');assert.equal(releaseGate(c,now+hour),'release_window');});
test('object key ordering does not create a different reviewed version',()=>{const m=campaign().reviewManifest;assert.equal(reviewHash(m),reviewHash(Object.fromEntries(Object.entries(m).reverse())));});

test('owner approval requires a passed visual walkthrough for the exact creative and both viewports',()=>{for(const change of [m=>delete m.visualReview,m=>m.visualReview.checks.mobile=false,m=>m.visualReview.htmlSha256='old',m=>m.visualReview.revision='r0',m=>m.visualReview.evidence.mobile='',m=>m.visualReview.checkedAt=new Date(now+hour).toISOString()]){const m=campaign().reviewManifest;change(m);const r=createReview(m,{now:now-72*hour});assert.throws(()=>approveReview(r,m,{owner:'owner',now:now-7*hour}),/visual review/);}});
test('refreshing stock cannot bypass a missing visual gate in a trusted release manifest',()=>{const c=campaign();delete c.reviewManifest.visualReview;const hash=reviewHash(c.reviewManifest);c.review.hash=hash;c.review.approval.hash=hash;assert.equal(releaseGate(c,now),'visual_review');});
