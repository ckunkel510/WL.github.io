const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

test('header loads the privacy-filter-safe site runtime', () => {
  const header = fs.readFileSync(path.join(root, 'headermodern.js'), 'utf8');
  assert.match(header, /WL\.github\.io\/wl-site\.js\?v=20260721-3/);
  assert.doesNotMatch(header, /ANALYTICS_URL\s*=\s*["'][^"']*(?:analytics|tracking|events|commerce)/i);
});

test('site runtime emits a confirmed GA4 purchase with transaction value', () => {
  const runtime = fs.readFileSync(path.join(root, 'wl-site.js'), 'utf8');
  assert.match(runtime, /var VERSION = "1\.2\.2"/);

  const storage = () => {
    const values = new Map();
    return {
      getItem: (key) => values.has(key) ? values.get(key) : null,
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, String(value))
    };
  };
  const localStorage = storage();
  const sessionStorage = storage();
  sessionStorage.setItem('purchaseSubtotal', '123.45');

  let onReady;
  const response = {
    textContent: 'Thank you. Order number WL-12345',
    querySelector: (selector) => selector === 'strong' ? { textContent: 'WL-12345' } : null
  };
  const merchant = { textContent: 'Woodson Lumber' };
  const document = {
    readyState: 'loading',
    body: null,
    head: { appendChild() {} },
    addEventListener(name, callback) {
      if (name === 'DOMContentLoaded') onReady = callback;
    },
    createElement() {
      return { setAttribute() {} };
    },
    getElementById(id) {
      if (id === 'CartResponseMessage') return response;
      if (id === 'ctl00_PageBody_SuccessfulPaymentResults_MerchantDetailsPanel') return merchant;
      return null;
    },
    querySelector() { return null; }
  };
  const window = {
    dataLayer: [],
    dispatchEvent() {},
    localStorage,
    location: { pathname: '/ShoppingCart.aspx' },
    sessionStorage,
    setTimeout(callback) { callback(); }
  };
  const context = {
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init.detail; },
    document,
    window
  };

  vm.runInNewContext(runtime, context);
  assert.equal(typeof onReady, 'function');
  onReady();

  const purchase = window.dataLayer.find((entry) => entry && entry.event === 'wl_analytics_event' && entry.event_name === 'purchase');
  assert.ok(purchase);
  assert.equal(purchase.analytics_version, '1.2.2');
  assert.equal(purchase.ecommerce.transaction_id, 'WL-12345');
  assert.equal(purchase.ecommerce.currency, 'USD');
  assert.equal(purchase.ecommerce.value, 123.45);

  window.WLAnalytics.refresh();
  assert.equal(window.dataLayer.filter((entry) => entry && entry.event_name === 'purchase').length, 1);
});
