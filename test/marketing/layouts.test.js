'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{chooseLayout}=require('../../lib/marketing/layouts');
const now=Date.parse('2026-11-20T17:00:00Z'),day=86400000;
const layout=(id,family)=>({id,family,status:'approved',owner:'fixture',revision:'r1',categories:['building'],audiences:['trade_news'],brandPromise:'Built on Quality',expiresAt:'2027-01-01T00:00:00Z'});
const input=()=>({layouts:[layout('a','editorial'),layout('b','photo')],active:{id:'a',revision:'r1',family:'editorial',startedAt:new Date(now-14*day).toISOString()},category:'building',audience:'trade_news',historyComplete:true,now});
test('layout direction rotates at two weeks and keeps Built on Quality anchors',()=>{assert.equal(chooseLayout(input()).layout.id,'b');});
test('a familiar layout may serve fresh stories within its two-week window',()=>{const x=input();x.active.startedAt=new Date(now-7*day).toISOString();assert.equal(chooseLayout(x).layout.id,'a');});
test('unapproved or stale replacement layouts return to creative review',()=>{const x=input();x.layouts[1].status='draft';assert.equal(chooseLayout(x).status,'needs_review');x.layouts[1].status='approved';x.layouts[1].brandPromise='Texas Roots';assert.equal(chooseLayout(x).status,'needs_review');});
