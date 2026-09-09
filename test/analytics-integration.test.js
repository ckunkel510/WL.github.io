const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

test('header loads the privacy-filter-safe site runtime', () => {
  const header = fs.readFileSync(path.join(root, 'headermodern.js'), 'utf8');
  assert.match(header, /WL\.github\.io\/wl-site\.js\?v=20260909-5/);
  assert.doesNotMatch(header, /ANALYTICS_URL\s*=\s*["'][^"']*(?:analytics|tracking|events|commerce)/i);
});

test('site runtime emits a confirmed GA4 purchase with transaction value', () => {
  const runtime = fs.readFileSync(path.join(root, 'wl-site.js'), 'utf8');
  assert.match(runtime, /var VERSION = "1\.6\.0"/);

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
  sessionStorage.setItem('wl_analytics_experiment_v1', JSON.stringify({
    experiment_id: 'pdp_fulfillment_v1_20260909',
    experiment_variant: 'enhanced_fulfillment',
    fulfillment_method: 'delivery'
  }));

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
  assert.equal(purchase.analytics_version, '1.6.0');
  assert.equal(purchase.experiment_id, 'pdp_fulfillment_v1_20260909');
  assert.equal(purchase.experiment_variant, 'enhanced_fulfillment');
  assert.equal(purchase.fulfillment_method, 'delivery');
  assert.equal(purchase.ecommerce.transaction_id, 'WL-12345');
  assert.equal(purchase.ecommerce.currency, 'USD');
  assert.equal(purchase.ecommerce.value, 123.45);

  window.WLAnalytics.refresh();
  assert.equal(window.dataLayer.filter((entry) => entry && entry.event_name === 'purchase').length, 1);
});

test('site runtime carries recommendation attribution into downstream ecommerce events', () => {
  const runtime = fs.readFileSync(path.join(root, 'wl-site.js'), 'utf8');
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
  sessionStorage.setItem('wl_pdp_recommendation_attribution_v1', JSON.stringify({
    productId: '200',
    sourceProductId: '100',
    listId: 'pdp_you_may_also_like_1_v2',
    listName: 'Nozzles & hose connections',
    algorithm: 'merchant_category_affinity_v2',
    strategy: 'curated_watering_hose_accessories',
    selectedAt: Date.now()
  }));

  const document = {
    readyState: 'loading',
    body: null,
    head: { appendChild() {} },
    addEventListener() {},
    createElement() { return { setAttribute() {} }; },
    getElementById() { return null; },
    querySelector() { return null; }
  };
  const window = {
    dataLayer: [],
    dispatchEvent() {},
    localStorage,
    location: { pathname: '/ProductDetail.aspx' },
    sessionStorage,
    setTimeout() {}
  };
  const context = {
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init.detail; },
    document,
    window
  };

  vm.runInNewContext(runtime, context);
  window.WLAnalytics.track('add_to_cart', {
    ecommerce: {
      currency: 'USD',
      value: 12.34,
      items: [{ item_id: '200', item_name: 'Recommended item', price: 12.34, quantity: 1 }]
    }
  });

  const event = window.dataLayer.find((entry) => entry && entry.event_name === 'add_to_cart');
  assert.ok(event);
  assert.equal(event.item_list_id, 'pdp_you_may_also_like_1_v2');
  assert.equal(event.recommendation_algorithm, 'merchant_category_affinity_v2');
  assert.equal(event.recommendation_strategy, 'curated_watering_hose_accessories');
  assert.equal(event.recommendation_source_product_id, '100');
  assert.equal(event.ecommerce.items[0].item_list_id, 'pdp_you_may_also_like_1_v2');
  assert.equal(event.ecommerce.items[0].item_list_name, 'Nozzles & hose connections');
});

test('site runtime prefers the newest PDP or search-discovery attribution', () => {
  const runtime = fs.readFileSync(path.join(root, 'wl-site.js'), 'utf8');
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
  sessionStorage.setItem('wl_pdp_recommendation_attribution_v1', JSON.stringify({
    productId: '200', listId: 'older-pdp', listName: 'Older PDP list', selectedAt: Date.now() - 1000
  }));
  sessionStorage.setItem('wl_product_discovery_attribution_v1', JSON.stringify({
    productId: '200', listId: 'search_recovery_matches_v1', listName: 'Possible matches',
    algorithm: 'merchant_typo_search_v1', strategy: 'typo_and_catalog_recovery', selectedAt: Date.now()
  }));

  const document = {
    readyState: 'loading', body: null, head: { appendChild() {} }, addEventListener() {},
    createElement() { return { setAttribute() {} }; }, getElementById() { return null; }, querySelector() { return null; }
  };
  const window = {
    dataLayer: [], dispatchEvent() {}, localStorage, location: { pathname: '/ProductDetail.aspx' }, sessionStorage, setTimeout() {}
  };
  vm.runInNewContext(runtime, {
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init.detail; }, document, window
  });
  window.WLAnalytics.track('view_item', {
    ecommerce: { items: [{ item_id: '200', item_name: 'Recovered item' }] }
  });

  const event = window.dataLayer.find((entry) => entry && entry.event_name === 'view_item');
  assert.equal(event.item_list_id, 'search_recovery_matches_v1');
  assert.equal(event.item_list_name, 'Possible matches');
  assert.equal(event.recommendation_algorithm, 'merchant_typo_search_v1');
  assert.equal(event.recommendation_source_product_id, undefined);
});
