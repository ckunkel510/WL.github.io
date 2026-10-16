'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../ProductDetailPilot');
function winFixture() {
  const requests=[],created=[];
  const doc={readyState:'complete',querySelector(){throw Error('Presentation must not inspect customer identity');},createElement(tag){created.push({tag});return {remove(){}};},head:{appendChild(link){link.onerror();}}};
  const win={document:doc,location:{origin:'https://webtrack.woodsonlumber.com',pathname:'/ProductDetail.aspx'},setTimeout,clearTimeout,fetch:async(url)=>{requests.push(url);throw Error('Public product presentation needs no account reads');}};
  win.top=win; return {win,requests,created};
}
for(const visitor of ['ckunkel2','another signed-in customer','guest','anonymous shopper'])test('public presentation loads for '+visitor+' without identity or account requests',async()=>{
  const f=winFixture();await core.boot(f.win);assert.equal(f.created.length,1);assert.equal(f.created[0].tag,'link');assert.equal(f.requests.length,0);
});
test('frames, other pages and unrelated origins do not load the product presentation',async()=>{
  for(const mode of ['frame','cart','other-origin']) {
    const f=winFixture();
    if(mode==='frame')f.win.top={};if(mode==='cart')f.win.location.pathname='/ShoppingCart.aspx';if(mode==='other-origin')f.win.location.origin='https://example.invalid';
    await core.boot(f.win);assert.equal(f.created.length,0,mode);assert.equal(f.win.WLPdpExperience,undefined,mode);
  }
});
test('a presentation stylesheet failure preserves the native page',async()=>{
  const f=winFixture();await core.boot(f.win);assert.equal(f.created.length,1);assert.equal(f.win.WLPdpExperience,undefined);
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
