'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../smart-search.js'), 'utf8').replace(
  'nativeSearchState: nativeSearchState',
  'nativeSearchState: nativeSearchState, singleResultDestination, pilotAccount, redirectSingleResult, installDirectSearch'
);

function harness(options = {}) {
  const origin = 'https://webtrack.woodsonlumber.com';
  const navigations = [], requests = [], listeners = new Map();
  const settings = {
    querySelector: () => options.settingsSignedOut ? null : {},
    querySelectorAll: () => (options.names || ['ckunkel2', 'ckunkel2']).map(name => ({textContent: `Change details for user '${name}'`}))
  };
  let labels = options.labels || ['1 item found', '1 item found'];
  const links = (options.links || ['ProductDetail.aspx?pid=6698&pg=0', 'ProductDetail.aspx?pid=6698&pg=0#customer-reviews']).map(value => ({
    getAttribute: () => typeof value === 'string' ? value : value.href,
    getBoundingClientRect: () => ({width: 100, height: 30}),
    closest: () => typeof value === 'object' && value.recommendation ? {} : null
  }));
  const panel = {
    querySelectorAll(selector) {
      return selector === '.paging-control' ? labels.map(textContent => ({textContent})) : links;
    }
  };
  const document = {
    readyState: 'loading',
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name),
    querySelector: () => options.signedOut ? null : {},
    getElementById: () => panel
  };
  const window = {
    location: {origin, href: origin + '/Products.aspx?searchText=24082ypl', replace: value => navigations.push(value)},
    getComputedStyle: () => ({display:'block',visibility:'visible'}),
    AbortController, setTimeout, clearTimeout,
    DOMParser: class { parseFromString() { return settings; } },
    fetch: async (url, config) => {
      requests.push({url, config});
      if (options.interact) listeners.get('input')();
      if (options.changeResults) labels = ['Results 1-48 (of 64)'];
      if (options.fail) throw new Error('Unavailable');
      return {ok: true, url: options.responseUrl || url, text: async () => '<html>Native settings</html>'};
    }
  };
  window.top = options.frame ? {} : window;
  vm.runInNewContext(source, {window, document, URL, URLSearchParams});
  return {api: window.WLSmartSearch, panel, requests, navigations, listeners};
}

test('single native product opens once after fresh ckunkel2 verification', async () => {
  const h = harness();
  assert.equal(await h.api.redirectSingleResult(h.panel), true);
  assert.deepEqual(h.navigations, ['https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=6698&pg=0']);
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].url, 'https://webtrack.woodsonlumber.com/AccountSettings.aspx');
  assert.equal(h.requests[0].config.method, 'GET');
  assert.equal(h.requests[0].config.credentials, 'same-origin');
  assert.equal(h.requests[0].config.cache, 'no-store');
  assert.equal(h.listeners.has('input'), false);
});

test('image/title/review duplicate links and recommendation cards do not inflate native count', () => {
  const h = harness({links:['ProductDetail.aspx?pid=6698','ProductDetail.aspx?pid=6698#customer-reviews',{href:'ProductDetail.aspx?pid=85',recommendation:true}]});
  assert.equal(new URL(h.api.singleResultDestination(h.panel)).searchParams.get('pid'), '6698');
});

for (const [label, options] of [
  ['multiple native products', {labels:['2 items found'],links:['ProductDetail.aspx?pid=6698','ProductDetail.aspx?pid=85']}],
  ['one visible product on a page of a larger search', {labels:['Results 64-64 (of 64)']}],
  ['missing authoritative total', {labels:['']}],
  ['conflicting top and bottom totals', {labels:['1 item found','2 items found']}],
  ['two native products despite a stale one-result label', {links:['ProductDetail.aspx?pid=6698','ProductDetail.aspx?pid=85']}],
  ['external destination', {links:['https://example.com/ProductDetail.aspx?pid=6698']}],
  ['malformed product ID', {links:['ProductDetail.aspx?pid=wrong']}],
  ['signed-out visitors', {signedOut:true}],
  ['embedded pages', {frame:true}]
]) test(label + ' stays on results without an identity request', async () => {
  const h = harness(options);
  assert.equal(await h.api.redirectSingleResult(h.panel), false);
  assert.equal(h.navigations.length, 0);
  assert.equal(h.requests.length, 0);
});

for (const [label, options] of [
  ['another account', {names:['ckunkel3']}],
  ['conflicting account headings', {names:['ckunkel2','ckunkel3']}],
  ['missing account headings', {names:[]}],
  ['expired settings session', {settingsSignedOut:true}],
  ['redirect to sign-in', {responseUrl:'https://webtrack.woodsonlumber.com/SignIn.aspx'}],
  ['identity request failure', {fail:true}],
  ['user begins typing during identity request', {interact:true}],
  ['result total changes during identity request', {changeResults:true}]
]) test(label + ' leaves results usable', async () => {
  const h = harness(options);
  assert.equal(await h.api.redirectSingleResult(h.panel), false);
  assert.equal(h.navigations.length, 0);
  assert.equal(h.listeners.has('input'), false);
});

test('native Results 1-1 (of 1) format is accepted', async () => {
  const h = harness({labels:['Results 1-1 (of 1)']});
  assert.equal(await h.api.redirectSingleResult(h.panel), true);
});

function directHarness(options = {}) {
  const origin = 'https://webtrack.woodsonlumber.com';
  const events = new Map(), inputEvents = new Map(), attributes = new Map();
  const navigations = [], requests = [], tracked = [];
  let resolveResults;
  const input = {
    value: options.term || '24082ypl',
    getAttribute: name => attributes.has(name) ? attributes.get(name) : null,
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: name => attributes.delete(name),
    addEventListener: (name, fn) => inputEvents.set(name, fn)
  };
  const button = {};
  const box = {contains: node => node === input || node === button};
  const header = name => ({textContent: `Change password for user '${name}'`});
  let accountReads = 0;
  const settings = () => ({
    querySelector: () => (options.expire && accountReads > 1) ? null : {},
    querySelectorAll: () => [header(options.changedAccount && accountReads > 1 ? 'ckunkel3' : (options.user || 'ckunkel2'))]
  });
  const panel = {
    querySelectorAll: selector => selector === '.paging-control' ? [{textContent: options.multiple ? 'Results 1-48 (of 64)' : '1 item found'}] : [{
      getAttribute: () => 'ProductDetail.aspx?pid=6698&pg=0',
      closest: () => null,
      // Detached response HTML has no rendered dimensions.
      getBoundingClientRect: () => ({width:0,height:0})
    }]
  };
  const resultPage = {querySelector: () => (options.expire ? null : {}), getElementById: () => panel};
  const document = {
    readyState: 'loading',
    querySelector: () => options.guest ? null : {},
    getElementById: id => id.endsWith('_Input') ? input : box,
    addEventListener: (name, fn) => events.set(name, fn)
  };
  const window = {
    location: {origin,href:origin+'/ProductDetail.aspx?pid=85',assign:url=>navigations.push(url)},
    AbortController,setTimeout,clearTimeout,addEventListener:(name,fn)=>events.set(name,fn),
    DOMParser: class {parseFromString(html) { return html === 'settings' ? settings() : resultPage; }},
    WLAnalytics: {track:(name,parameters)=>tracked.push({name,parameters})},
    fetch: async (url, config) => {
      requests.push({url,config});
      if (url.includes('AccountSettings')) {
        accountReads++;
        return {ok:true,url,text:async()=> 'settings'};
      }
      if (options.pending) await new Promise(resolve => {resolveResults=resolve;});
      if (options.failResults) throw new Error('Native search unavailable');
      return {ok:true,url:new URL(url,origin).href,text:async()=> 'results'};
    }
  };
  window.top=window;
  vm.runInNewContext(source,{window,document,URL,URLSearchParams});
  const api=window.WLSmartSearch;
  async function submit(kind = 'keydown') {
    let prevented=false;
    const target = kind==='click' ? {closest:()=>button} : input;
    events.get(kind)?.({type:kind,target,key:'Enter',button:0,preventDefault(){prevented=true;},stopImmediatePropagation(){}});
    await new Promise(resolve=>setImmediate(resolve));
    return prevented;
  }
  return {api,navigations,requests,tracked,attributes,events,inputEvents,input,submit,resolve:()=>resolveResults?.()};
}

test('verified private search opens directly from source page without rendering result HTML', async () => {
  const h=directHarness();
  await h.api.installDirectSearch();
  assert.equal(await h.submit(),true);
  assert.deepEqual(h.navigations,['https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=6698&pg=0']);
  assert.equal(h.requests.filter(r=>r.url.includes('AccountSettings')).length,2,'warm identity never authorizes navigation by itself');
  assert.equal(h.requests.filter(r=>r.url.includes('Products.aspx')).length,1);
  assert.equal(h.tracked.length,1);
  assert.equal(h.tracked[0].name,'search');
  assert.equal(h.attributes.has('aria-busy'),false);
});

test('search button uses the same direct route', async () => {
  const h=directHarness();await h.api.installDirectSearch();
  assert.equal(await h.submit('click'),true);
  assert.match(h.navigations[0],/ProductDetail/);
});

test('multiple matches open normal results without duplicating the search analytics event',async()=>{
  const h=directHarness({term:'YPL',multiple:true});await h.api.installDirectSearch();await h.submit();
  assert.match(h.navigations[0],/^\/Products\.aspx.*searchText=YPL$/);
  assert.equal(h.tracked.length,0);
});

for(const options of [{changedAccount:true},{expire:true},{failResults:true}])test('direct route falls back safely: '+JSON.stringify(options),async()=>{
  const h=directHarness(options);await h.api.installDirectSearch();await h.submit();
  assert.match(h.navigations[0],/^\/Products\.aspx/);
  assert.equal(h.tracked.length,0);
});

for(const options of [{user:'ckunkel3'},{guest:true}])test('direct route never intercepts '+JSON.stringify(options),async()=>{
  const h=directHarness(options);await h.api.installDirectSearch();
  assert.equal(await h.submit(),false);assert.equal(h.navigations.length,0);
  assert.equal(h.requests.some(r=>r.url.includes('Products.aspx')),false);
});

test('editing the query while a direct search is pending cancels its navigation',async()=>{
  const h=directHarness({pending:true});await h.api.installDirectSearch();await h.submit();
  h.input.value='new query';h.inputEvents.get('input')();h.resolve();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.navigations.length,0);assert.equal(h.attributes.has('aria-busy'),false);
});

test('clicking elsewhere cancels a pending direct search',async()=>{
  const h=directHarness({pending:true});await h.api.installDirectSearch();await h.submit();
  h.events.get('pointerdown')({target:{}});h.resolve();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.navigations.length,0);
});

test('repeated Enter while pending performs one native result request',async()=>{
  const h=directHarness({pending:true});await h.api.installDirectSearch();await h.submit();await h.submit();
  h.resolve();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.requests.filter(r=>r.url.includes('Products.aspx')).length,1);assert.equal(h.navigations.length,1);
});

test('personal-data-shaped text stays on the normal native search path',async()=>{
  const h=directHarness({term:'person@example.com'});await h.api.installDirectSearch();
  assert.equal(await h.submit(),false);assert.equal(h.navigations.length,0);
});


test('direct product URLs omit the native return link to the skipped search',()=>{
  const h=harness({links:['ProductDetail.aspx?pid=6698&pg=0&returnUrl=%7e%2fProducts.aspx%3fsearchText%3d24082ypl']});
  assert.equal(h.api.singleResultDestination(h.panel),'https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=6698&pg=0');
});
