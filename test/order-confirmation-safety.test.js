const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'OrderConfirmation.js'),
  'utf8'
);
const notificationSource = fs.readFileSync(
  path.join(__dirname, '..', 'storeNotification.js'),
  'utf8'
);

function extractedFunction(name, dependencies) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} should exist`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] !== '}') continue;
    depth -= 1;
    if (depth === 0) {
      const names = Object.keys(dependencies || {});
      const values = names.map((key) => dependencies[key]);
      return Function(...names, `return (${source.slice(start, index + 1)});`)(...values);
    }
  }
  throw new Error(`Could not extract ${name}`);
}

test('confirmation enhancement is limited to the successful ShoppingCart route', () => {
  assert.match(source, /ShoppingCart\\\.aspx/);
  assert.match(source, /get\('success'\) === '1'/);
  assert.match(source, /CartResponseMessage/);
  assert.match(
    source,
    /ctl00_PageBody_SuccessfulPaymentResults_MerchantDetailsPanel/
  );
});

test('native confirmation hooks stay in the DOM for analytics and fallbacks', () => {
  assert.doesNotMatch(source, /response\.remove\(\)|merchant\.remove\(\)/);
  assert.match(source, /appendChild\(merchant\)/);
  assert.match(source, /native-success/);
  assert.match(source, /proxyNativeAction/);
});

test('presentation code does not submit orders, send purchase events, or call remote APIs', () => {
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /\.submit\s*\(/);
  assert.doesNotMatch(source, /\bdataLayer\b|\bgtag\s*\(|\bfbq\s*\(/);
  assert.doesNotMatch(source, /Complete Order/i);
});

test('saved items are moved after confirmation content and collapsed by default', () => {
  assert.match(source, /root\.appendChild\(savedForLater\)/);
  assert.match(source, /setAttribute\('data-wl-collapsed', 'true'\)/);
  assert.match(source, /aria-expanded/);
});

test('stable confirmation attributes and order-number copy affordance are present', () => {
  assert.match(source, /data-wl-order-confirmation/);
  assert.match(source, /data-wl-order-number/);
  assert.match(source, /data-wl-copy-order/);
  assert.match(source, /navigator\.clipboard\.writeText/);
});

test('existing header stays outside the confirmation enhancement', () => {
  assert.doesNotMatch(source, /body\.wl-order-confirmation-page\s+(?:header|nav)/);
  assert.doesNotMatch(source, /querySelector\(['"](?:header|nav)/);
  assert.doesNotMatch(source, /Ready for Pickup/i);
});

test('confirmation labels the actual fulfillment method instead of assuming pickup', () => {
  const fulfillmentFromValue = extractedFunction('fulfillmentFromValue', {
    cleanText: (value) => String(value || '').replace(/\s+/g, ' ').trim()
  });

  assert.equal(fulfillmentFromValue('UPS Ground').mode, 'ship');
  assert.equal(fulfillmentFromValue('Delivered').mode, 'delivery');
  assert.equal(fulfillmentFromValue('Delivery').mode, 'delivery');
  assert.equal(fulfillmentFromValue('Store Pickup').mode, 'pickup');
  assert.match(source, /createFact\('Fulfillment', data\.fulfillment/);
  assert.match(source, /data\.fulfillmentMode === 'pickup'/);
  assert.doesNotMatch(source, /createFact\('Pickup location', data\.branch/);
  assert.match(source, /shipping or delivery charge needs review/i);
  assert.match(source, /getFulfillmentCharge/);
});

test('the existing live cart hook loads the enhancement only after a successful order', () => {
  assert.match(notificationSource, /ShoppingCart\\\.aspx/);
  assert.match(notificationSource, /success=1/);
  assert.match(
    notificationSource,
    /OrderConfirmation\.js\?v=20260902-shipping-safety-4/
  );
  assert.doesNotMatch(notificationSource, /querySelector\(['"](?:header|nav)/);
});
