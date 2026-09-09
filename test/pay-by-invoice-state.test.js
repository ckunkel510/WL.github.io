const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const routerAndLegacySource = read('PayByInvoice.js');
const previewSource = read('PayByInvoicePreview.js');
const accountInfoSource = read('Accountinfo.js');

test('preview router requires an approved account ID and the preview URL', () => {
  const ids = routerAndLegacySource.match(/var expectedAccountIds = \[([^\]]+)\]/)[1]
    .match(/'[^']+'/g)
    .map((value) => value.slice(1, -1));

  assert.deepEqual(ids, ['EMP2111', '10005']);
  assert.match(routerAndLegacySource, /requestedMode !== 'preview'/);
  assert.match(routerAndLegacySource, /expectedAccountIds\.indexOf\(accountId\) !== -1/);
  assert.match(routerAndLegacySource, /expiresAt > Date\.now\(\)/);
  assert.match(routerAndLegacySource, /PayByInvoicePreview\.js\?v=20260909-1/);
});

test('legacy payment enhancements remain the default and stop only for an approved preview', () => {
  const guardedLegacyModules = routerAndLegacySource.match(
    /if \(window\.__WL_PAYMENT_PREVIEW_ACTIVE__ \|\| !\/AccountPayment_r\\\.aspx\/i\.test\(location\.pathname\)\) return;/g
  ) || [];

  assert.equal(guardedLegacyModules.length, 14);
  assert.match(routerAndLegacySource, /PayByInvoice version v38/);
  assert.match(routerAndLegacySource, /wlProxySubmit/);
  assert.match(routerAndLegacySource, /wiz\.id = 'wlApWizard3'/);
});

test('account overview enables preview only for the two approved account IDs', () => {
  const ids = accountInfoSource.match(/PAYMENT_FLOW_PREVIEW_ACCOUNT_IDS = Object\.freeze\(\[([^\]]+)\]\)/)[1]
    .match(/'[^']+'/g)
    .map((value) => value.slice(1, -1));

  assert.deepEqual(ids, ['EMP2111', '10005']);
  assert.match(accountInfoSource, /PAYMENT_FLOW_PREVIEW_ACCOUNT_IDS = Object\.freeze/);
  assert.match(accountInfoSource, /PAYMENT_FLOW_PREVIEW_ACCOUNT_IDS\.includes\(accountId\)/);
  assert.match(accountInfoSource, /sessionStorage\.removeItem\(PAYMENT_FLOW_PREVIEW_KEY\)/);
  assert.match(accountInfoSource, /url\.searchParams\.set\('wl_payment_flow','preview'\)/);
  assert.match(accountInfoSource, /withPaymentFlowPreview\('AccountPayment_r\.aspx'\)/);
});

test('preview is progressive enhancement with an explicit native escape hatch', () => {
  assert.match(previewSource, /var ROLLOUT_MODE = 'preview'/);
  assert.match(previewSource, /requestedMode === 'native'/);
  assert.match(previewSource, /requestedMode !== 'preview'/);
  assert.match(previewSource, /wl_payment_flow/);
});

test('preview leaves the native WebTrack control as the only payment trigger', () => {
  assert.match(previewSource, /ctl00_PageBody_MakePayment/);
  assert.match(previewSource, /data-wl-native-payment-control/);

  assert.doesNotMatch(previewSource, /wlProxySubmit/);
  assert.doesNotMatch(previewSource, /__doPostBack/);
  assert.doesNotMatch(previewSource, /\.requestSubmit\s*\(/);
  assert.doesNotMatch(previewSource, /\.submit\s*\(/);
  assert.doesNotMatch(previewSource, /\.click\s*\(/);
  assert.doesNotMatch(previewSource, /preventDefault\s*\(/);
});

test('preview does not force reloads, redirects, or parallel payment state', () => {
  assert.doesNotMatch(previewSource, /location\.reload/);
  assert.doesNotMatch(previewSource, /location\.href\s*=/);
  assert.doesNotMatch(previewSource, /window\.location\s*=/);
  assert.doesNotMatch(previewSource, /sessionStorage/);
  assert.doesNotMatch(previewSource, /localStorage/);
});

test('preview enhances native fields in place for cash and charge accounts', () => {
  [
    'ctl00_PageBody_BillingAddressTextBox',
    'ctl00_PageBody_PostalCodeTextBox',
    'ctl00_PageBody_EmailAddressTextBox',
    'ctl00_PageBody_PaymentAmountTextBox',
    'ctl00_PageBody_NotesTextBox',
    'ctl00_PageBody_RemittanceAdviceTextBox',
    'ctl00_PageBody_RadioButton_PayByCheck',
    'ctl00_PageBody_RadioButton_PayByCheckOnFile',
    'ctl00_PageBody_RadioButton_PayByCredit',
    'ctl00_PageBody_RadioButton_PayByCardOnFile'
  ].forEach((id) => assert.match(previewSource, new RegExp(id)));

  assert.match(previewSource, /Load Cash Account Balance/);
  assert.match(previewSource, /Add money to your cash account/);
  assert.match(previewSource, /Pay your Woodson account/);
  assert.match(previewSource, /repeat\(3,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(previewSource, /wl-hidden-native/);
  assert.doesNotMatch(previewSource, /display\s*:\s*none/);
});

test('preview convenience actions update native fields without submitting', () => {
  assert.match(previewSource, /data-wl-action="pay-balance"/);
  assert.match(previewSource, /data-wl-action="choose-invoices"/);
  assert.match(previewSource, /input\.dispatchEvent\(new Event\('input'/);
  assert.match(previewSource, /input\.dispatchEvent\(new Event\('change'/);
});
