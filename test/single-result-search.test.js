'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../smart-search.js'), 'utf8').replace(
  'nativeSearchState: nativeSearchState',
  'nativeSearchState: nativeSearchState, singleResultDestination, pilotAccount, redirectSingleResult'
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
