'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const header = fs.readFileSync(require.resolve('../headermodern.js'), 'utf8');
const source = header.slice(header.indexOf('  function stripeSandboxPaymentLink('), header.indexOf('  function loadAccessibility('));
const ORIGIN = 'https://webtrack.woodsonlumber.com';
const LINK = ORIGIN + '/Payment.aspx?PaymentForOrderID=synthetic-order&MinPaymentAmount=synthetic-minimum&utm=ccverify';
const unpaid = { order: '17633235', currency: 'usd', cents: 3023, received: 0, paid: false, pending: false, review: false, sandbox: true, url: 'https://checkout.stripe.com/g/pay/cs_test_synthetic' };
function fixture(options = {}) {
  const changes = [], listeners = {};
  const location = new URL(options.url || LINK); location.replace = url => changes.push({ navigation: url });
  function node() { return { style: {}, children: [], setAttribute(k, v) { this[k] = v; }, appendChild(child) { this.children.push(child); }, addEventListener(k, v) { this[k] = v; } }; }
  const panel = node(); panel.textContent = 'Order# ' + (options.order || '17633235') + ' Outstanding amount: 30.23';
  panel.parentNode = { insertBefore: card => changes.push({ card }) };
  const providers = node();
  const doc = { querySelector: () => null,
    getElementById: id => ({ ctl00_PageBody_PaymentTypePanel: panel, ctl00_PageBody_PaymentProvidersPanel: providers,
      ctl00_PageBody_PaymentAmountInputBox: { readOnly: options.editable !== true },
      ctl00_PageBody_CreBillingAddress: { value: options.enteredBilling || '' }, ctl00_PageBody_CrePostalCode: { value: '' } })[id],
    activeElement: { tagName: options.activeTag || 'BODY' }, createElement: node,
    head: { appendChild: meta => changes.push({ meta }) } };
  let resolve;
  const wait = new Promise(done => { resolve = done; });
  const win = { location, AbortController, setTimeout: fn => { listeners.timeout = fn; return 1; }, clearTimeout() {},
    addEventListener: (type, fn) => { listeners[type] = fn; }, removeEventListener() {},
    fetch: async (url, init) => {
      changes.push({ fetch: url, init }); if (options.delayed) await wait;
      if (options.networkError) throw Error('Unreachable');
      return { ok: true, json: async () => options.status || unpaid };
    }
  }; win.top = options.frame ? {} : win;
  const context = vm.createContext({ window: win, document: doc, WEBTRACK: ORIGIN, URL });
  vm.runInContext(source, context);
  return { changes, listeners, context, resolve, panel, providers, card: () => changes.find(x => x.card)?.card };
}
test('only the approved native order starts the receipt lookup, including its anonymous link context', async () => {
  const f = fixture(); await f.context.startStripeSandboxHandoff();
  const request = f.changes.find(x => x.fetch);
  assert.equal(request.fetch, 'https://woodson-stripe-sandbox.vercel.app/api/customer-checkout');
  assert.equal(new URL(request.fetch).search, ''); assert.equal(request.init.credentials, 'omit');
  assert.equal(new URL(JSON.parse(request.init.body).url).searchParams.has('utm'), false);
  const target = new URL(f.changes.find(x => x.navigation).navigation);
  assert.equal(target.origin, 'https://checkout.stripe.com'); assert.equal(target.search, '');
  assert.equal(target.href.includes('PaymentForOrderID'), false);
  assert.equal(f.panel.style.display, 'none'); assert.equal(f.providers.style.display, 'none');
});
test('other orders, ordinary payment pages, frames, duplicate parameters and entered fields remain untouched', async () => {
  for (const options of [{ order: '17633236' }, { order: '176332350' }, { url: ORIGIN + '/Products.aspx' }, { url: ORIGIN + '/Payment.aspx' },
    { frame: true }, { editable: true }, { url: LINK + '&PaymentForOrderID=other' }, { url: LINK.replace(ORIGIN, 'https://example.invalid') },
    { activeTag: 'IFRAME' }, { activeTag: 'INPUT' }, { enteredBilling: 'Entered address' }]) {
    const f = fixture(options); await f.context.startStripeSandboxHandoff(); assert.deepEqual(f.changes, [], JSON.stringify(options));
  }
});
test('a fully captured test payment renders an inline receipt without another Checkout', async () => {
  const f = fixture({ status: { ...unpaid, received: 3023, paid: true } }); await f.context.startStripeSandboxHandoff();
  assert.equal(f.card().children[0].textContent, 'Test payment received in full');
  assert.match(f.card().children[3].textContent, /No real funds/);
  assert.equal(f.changes.some(x => x.navigation), false);
});
test('pending, reviewed or partial payments never open another Checkout', async () => {
  for (const status of [{ ...unpaid, pending: true }, { ...unpaid, review: true }, { ...unpaid, received: 1000 }]) {
    const f = fixture({ status }); await f.context.startStripeSandboxHandoff();
    assert.match(f.card().children[1].textContent, /do not submit another payment/);
    assert.equal(f.changes.some(x => x.navigation), false);
  }
});
test('lookup failure and invalid/live receipts fail closed with a visible retry', async () => {
  for (const options of [{ networkError: true }, { status: { ...unpaid, sandbox: false } }, { status: { ...unpaid, order: 'other' } }, { status: { ...unpaid, paid: true } },
    ...['https://attacker.invalid/c/pay/cs_test_x', 'https://checkout.stripe.com/c/pay/cs_live_x', 'http://checkout.stripe.com/c/pay/cs_test_x', 'https://checkout.stripe.com.evil.invalid/c/pay/cs_test_x', undefined].map(url => ({ status: { ...unpaid, url } }))]) {
    const f = fixture(options); await f.context.startStripeSandboxHandoff();
    assert.match(f.card().children[0].textContent, /could not be confirmed/);
    assert.equal(f.card().children[4].hidden, false);
    assert.equal(f.changes.some(x => x.navigation), false);
  }
});
test('Stripe cancel returns stay on WebTrack until the customer chooses to continue', async () => {
  const f = fixture({ url: LINK + '&wl_stripe_canceled=1' }); await f.context.startStripeSandboxHandoff();
  assert.equal(f.changes.find(x => x.fetch).fetch, 'https://woodson-stripe-sandbox.vercel.app/api/payment-status');
  assert.equal(f.changes.some(x => x.navigation), false);
  assert.match(f.card().children[1].textContent, /was canceled/);
  assert.equal(f.card().children[4].textContent, 'Continue to Stripe sandbox');
  await f.card().children[4].click();
  assert.equal(f.changes.filter(x => x.fetch)[1].fetch, 'https://woodson-stripe-sandbox.vercel.app/api/customer-checkout');
  assert.equal(new URL(f.changes.find(x => x.navigation).navigation).origin, 'https://checkout.stripe.com');
});
test('departure, timeout and context changes prevent a late redirect', async () => {
  for (const event of ['pagehide', 'timeout', 'context']) {
    const f = fixture({ delayed: true }); const promise = f.context.startStripeSandboxHandoff();
    if (event === 'context') f.context.window.location = new URL(ORIGIN + '/Products.aspx'); else f.listeners[event]();
    f.resolve(); await promise; assert.equal(f.changes.some(x => x.navigation), false, event);
  }
});
test('the receipt guard starts once at DOM readiness', async () => {
  const f = fixture(); await f.context.startStripeSandboxHandoff(); await f.context.startStripeSandboxHandoff();
  assert.equal(f.changes.filter(x => x.fetch).length, 1);
  assert.match(header, /onReady\(function \(\) \{\s+startStripeSandboxHandoff\(\);/);
});
