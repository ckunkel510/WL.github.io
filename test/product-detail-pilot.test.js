'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../ProductDetailPilot');
function account(names=['ckunkel2'], signedIn=true) {
  return {querySelector:()=>signedIn?{}:null,querySelectorAll:()=>names.map(name=>({textContent:"Change details for user '"+name+"'"}))};
}
test('only matching native signed-in account headings enable the product preview',()=>{
  assert.equal(core.pilotAccount(account()),true);
  assert.equal(core.pilotAccount(account(['CKUNKEL2'])),true);
  for(const doc of [account(['ckunkel3']),account([]),account(['ckunkel2','ckunkel3']),account(['ckunkel2'],false),account(['ckunkel2 extra'])])assert.equal(core.pilotAccount(doc),false);
  assert.equal(core.pilotAccount({querySelector:()=>({}),querySelectorAll:()=>[{textContent:'Product code: ckunkel2'}]}),false);
});
function winFixture({names=['ckunkel2'],signed=true,responseUrl='https://webtrack.woodsonlumber.com/AccountSettings.aspx',ok=true,fail=false}={}) {
  let requests=[],created=[];
  const doc=Object.assign(account(['Product'],signed),{readyState:'complete',createElement(tag){created.push(tag);return {remove(){}};},head:{appendChild(link){link.onerror();}}});
  const win={document:doc,location:{origin:'https://webtrack.woodsonlumber.com',pathname:'/ProductDetail.aspx'},AbortController,setTimeout,clearTimeout,DOMParser:class{parseFromString(){return account(names);}},fetch:async(url,options)=>{requests.push({url,options});if(fail)throw Error('offline');return{ok,url:responseUrl,text:async()=>''};}};
  win.top=win; return{win,requests,created};
}
test('verification uses an uncached same-origin read and rejects errors or redirected identity pages',async()=>{
  const good=winFixture();assert.equal(await core.verifyAccount(good.win),true);
  assert.equal(good.requests[0].url,'/AccountSettings.aspx');assert.equal(good.requests[0].options.cache,'no-store');assert.equal(good.requests[0].options.credentials,'same-origin');
  for(const options of [{names:['ckunkel3']},{ok:false},{fail:true},{signed:false},{responseUrl:'https://webtrack.woodsonlumber.com/SignIn.aspx'},{responseUrl:'https://example.invalid/AccountSettings.aspx'}])assert.equal(await core.verifyAccount(winFixture(options).win),false);
});
test('no stylesheet or rearrangement loads for guests, other accounts, frames or other pages',async()=>{
  for(const mode of ['guest','other','frame','cart','other-origin']) {
    const f=winFixture({signed:mode!=='guest',names:mode==='other'?['another-user']:['ckunkel2']});
    if(mode==='frame')f.win.top={};if(mode==='cart')f.win.location.pathname='/ShoppingCart.aspx';if(mode==='other-origin')f.win.location.origin='https://example.invalid';
    await core.boot(f.win);assert.equal(f.created.length,0,mode);assert.equal(f.win.WLPdpExperience,undefined,mode);
  }
});
test('a presentation stylesheet failure preserves the native page',async()=>{
  const f=winFixture();await core.boot(f.win);assert.deepEqual(f.created,['link']);assert.equal(f.win.WLPdpExperience,undefined);
});
test('review summary requires actual review entries and a valid loaded rating',()=>{
  const section=(count,rating)=>({querySelectorAll:()=>Array(count),querySelector:()=>rating===null?null:{getAttribute:()=>rating+' out of 5 stars'}});
  assert.deepEqual(core.ratingSummary(section(2,4.5)),{count:2,value:4.5,label:'4.5 · 2 reviews'});
  assert.equal(core.ratingSummary(section(1,5)).label,'5.0 · 1 review');
  for(const [count,rating] of [[0,4],[1,null],[1,0],[1,6],[1,'unavailable']])assert.equal(core.ratingSummary(section(count,rating)),null);
});

test('sticky presentation is enabled only when the whole purchase panel fits below the toolbar',()=>{
  assert.equal(core.stickyFits(632,902),true);
  assert.equal(core.stickyFits(632,720),true);
  assert.equal(core.stickyFits(632,700),false);
  assert.equal(core.stickyFits(850,902),false);
  assert.equal(core.stickyFits(0,902),false);
  assert.equal(core.stickyFits(632,704),true);
});
