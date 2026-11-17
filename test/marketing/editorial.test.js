'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{articleDecision,editorialGate}=require('../../lib/marketing/editorial');
const now=Date.parse('2026-11-20T17:00:00Z'),day=86400000;
const article=()=>({url:'https://www.nahb.org/fixture',primarySource:true,linkVerified:true,title:'Fixture',relevanceReason:'Relevant to current bids',categories:['building'],verifiedAt:new Date(now).toISOString(),publishedAt:new Date(now-4*day).toISOString(),kind:'news'});
test('current primary news is recent, linked and relevant to the actual category',()=>{assert.equal(articleDecision(article(),{category:'building',now}),null);assert.equal(articleDecision(article(),{category:'hunting',now}),'article_evidence');});
test('checking an old article today does not make it current news',()=>{const a=article();a.publishedAt=new Date(now-400*day).toISOString();assert.equal(articleDecision(a,{category:'building',now}),'stale_news');});
test('technical reading needs a date and a fresh applicability check, never a current-news label',()=>{const a={...article(),kind:'technical',publishedAt:new Date(now-120*day).toISOString(),applicabilityVerifiedAt:new Date(now).toISOString()};assert.equal(articleDecision(a,{category:'building',now}),null);delete a.applicabilityVerifiedAt;assert.equal(articleDecision(a,{category:'building',now}),'technical_applicability_review');});
test('contractor briefs do not dispatch with missing editorial sources',()=>assert.equal(editorialGate({audience:'trade_news'},now),'current_articles_required'));
