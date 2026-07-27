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

test('the existing live cart hook loads the enhancement only after a successful order', () => {
  assert.match(notificationSource, /ShoppingCart\\\.aspx/);
  assert.match(notificationSource, /success=1/);
  assert.match(
    notificationSource,
    /OrderConfirmation\.js\?v=20260727-1/
  );
  assert.doesNotMatch(notificationSource, /querySelector\(['"](?:header|nav)/);
});
