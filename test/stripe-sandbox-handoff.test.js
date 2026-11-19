'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const header = fs.readFileSync(require.resolve('../headermodern.js'), 'utf8');
const source = header.slice(header.indexOf('  function stripeSandboxPaymentLink('), header.indexOf('  function loadAccessibility('));
const ORIGIN = 'https://webtrack.woodsonlumber.com';
const LINK = ORIGIN + '/Payment.aspx?PaymentForOrderID=synthetic-order&MinPaymentAmount=synthetic-minimum&utm=ccverify';
function fixture(options = {}) {
  const changes = [], listeners = {}, meta = {};
  const location = new URL(options.url || LINK);
  location.replace = url => changes.push({ navigation: url });
  const signedIn = options.signedIn !== false;
  const name = options.name || 'ckunkel2';
  const identity = {
    querySelector: () => options.identitySignedOut ? null : {},
    querySelectorAll: () => (options.headings || [`Change details for user '${name}'`, `Change password for user '${name}'`]).map(textContent => ({ textContent }))
  };
  const doc = {
    querySelector: selector => selector.includes('SignOut=1') && signedIn ? {} : null,
    getElementById: id => id.includes('PaymentTypePanel') ? { textContent: 'Order# 17633235 Outstanding amount: 30.23' } : { readOnly: options.editable !== true },
    addEventListener: (type, fn) => { listeners[type] = fn; }, removeEventListener() {},
    activeElement: { tagName: options.cardFocused ? 'IFRAME' : 'BODY' },
    createElement: () => meta, head: { appendChild: node => changes.push({ meta: node }) }
  };
  let resolve;
  const wait = new Promise(done => { resolve = done; });
  const win = { location, AbortController, setTimeout: fn => { listeners.timeout = fn; return 1; }, clearTimeout() {},
    addEventListener: (type, fn) => { listeners[type] = fn; }, removeEventListener() {},
    fetch: async (url, init) => {
      changes.push({ fetch: url, credentials: init.credentials, cache: init.cache, redirect: init.redirect });
      if (options.delayed) await wait;
      if (options.networkError) throw Error('Unreachable');
      return { ok: true, url: options.responseURL || ORIGIN + '/AccountSettings.aspx', text: async () => 'identity' };
    }
  }; win.top = options.frame ? {} : win;
  const context = vm.createContext({ window: win, document: doc, WEBTRACK: ORIGIN, URL, DOMParser: class { parseFromString() { return identity; } } });
  vm.runInContext(source, context);
  return { changes, listeners, context, resolve };
}
test('only ckunkel2 with two matching native headings is handed to the sandbox', async () => {
  const f = fixture(); await f.context.startStripeSandboxHandoff();
  const navigation = f.changes.find(x => x.navigation).navigation;
  const target = new URL(navigation);
  assert.equal(target.origin, 'https://woodson-stripe-sandbox.vercel.app');
  assert.equal(target.search, '');
  const source = new URL(new URLSearchParams(target.hash.slice(1)).get('webtrack'));
  assert.equal(source.searchParams.get('PaymentForOrderID'), 'synthetic-order');
  assert.equal(source.searchParams.has('utm'), false);
  assert.equal(f.changes.find(x => x.meta).meta.content, 'no-referrer');
  assert.equal(f.changes[0].credentials, 'same-origin');
  assert.equal(f.changes[0].cache, 'no-store');
});
test('guest, unrelated page, ordinary payment page, frames and ambiguous links make no identity request or changes', async () => {
  for (const options of [{ signedIn: false }, { url: ORIGIN + '/Products.aspx' }, { url: ORIGIN + '/Payment.aspx' },
    { frame: true }, { editable: true }, { url: LINK + '&PaymentForOrderID=other' }, { url: LINK.replace(ORIGIN, 'https://example.invalid') }]) {
    const f = fixture(options); await f.context.startStripeSandboxHandoff(); assert.deepEqual(f.changes, [], JSON.stringify(options));
  }
});
test('other customers, contradictory headings, sign-in responses and lookup failures never redirect or modify native forms', async () => {
  for (const options of [{ name: 'ckunkel3' }, { identitySignedOut: true }, { networkError: true },
    { headings: ["Change details for user 'ckunkel2'", "Change password for user 'other'"] },
    { headings: ["Welcome ckunkel2"] }, { responseURL: ORIGIN + '/SignIn.aspx' }, { cardFocused: true }]) {
    const f = fixture(options); await f.context.startStripeSandboxHandoff();
    assert.equal(f.changes.length, 1, JSON.stringify(options)); assert.ok(f.changes[0].fetch);
  }
});
test('payment interaction, departure, timeout or changed payment context prevents a late automatic redirect', async () => {
  for (const event of ['pointerdown', 'keydown', 'submit', 'pagehide', 'timeout', 'context']) {
    const f = fixture({ delayed: true }); const pending = f.context.startStripeSandboxHandoff();
    if (event === 'context') f.context.window.location = new URL(ORIGIN + '/Products.aspx');
    else f.listeners[event]();
    f.resolve(); await pending;
    assert.equal(f.changes.length, 1, event);
  }
});
test('the native handoff boots once and only at DOM readiness', async () => {
  const f = fixture(); await f.context.startStripeSandboxHandoff(); await f.context.startStripeSandboxHandoff();
  assert.equal(f.changes.filter(x => x.fetch).length, 1);
  assert.match(header, /onReady\(function \(\) \{\s+startStripeSandboxHandoff\(\);/);
});
