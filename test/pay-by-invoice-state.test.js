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
  assert.match(routerAndLegacySource, /__WL_PAYMENT_PREVIEW_ACCOUNT_ID__ = accountId/);
  assert.match(routerAndLegacySource, /PayByInvoicePreview\.js\?v=20260909-7/);
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
  assert.match(accountInfoSource, /utm_statement_total/);
  assert.match(accountInfoSource, /statementTotal\.toFixed\(2\)/);
});

test('preview is progressive enhancement with an explicit native escape hatch', () => {
  assert.match(previewSource, /var ROLLOUT_MODE = 'preview'/);
  assert.match(previewSource, /requestedMode === 'native'/);
  assert.match(previewSource, /requestedMode !== 'preview'/);
  assert.match(previewSource, /wl_payment_flow/);
});

test('preview leaves the native WebTrack control as the only payment trigger', () => {
  assert.match(previewSource, /ctl00_PageBody_MakePayment/);
  assert.match(previewSource, /ctl00_PageBody_ForteMakePayment/);
  assert.match(previewSource, /ctl00_PageBody_ForteControls/);
  assert.match(previewSource, /data-wl-native-payment-control/);

  assert.doesNotMatch(previewSource, /wlProxySubmit/);
  assert.doesNotMatch(previewSource, /__doPostBack/);
  assert.doesNotMatch(previewSource, /\.requestSubmit\s*\(/);
  assert.doesNotMatch(previewSource, /\.submit\s*\(/);
  assert.doesNotMatch(previewSource, /\.click\s*\(/);
  assert.doesNotMatch(previewSource, /preventDefault\s*\(/);
});

test('preview does not force reloads, redirects, or broad parallel payment state', () => {
  assert.doesNotMatch(previewSource, /location\.reload/);
  assert.doesNotMatch(previewSource, /location\.href\s*=/);
  assert.doesNotMatch(previewSource, /window\.location\s*=/);
  assert.doesNotMatch(previewSource, /localStorage/);
  assert.match(previewSource, /wl_payment_billing_draft_v1/);
  assert.match(previewSource, /30 \* 60 \* 1000/);
  assert.doesNotMatch(previewSource, /wl_ap_prefill|wlPayState|PendingRemit/);
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
  assert.match(previewSource, /Back to Account Overview/);
  assert.match(previewSource, /col-auto\.navigation-menu\{display:none!important/);
  assert.match(previewSource, /repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(previewSource, /#MainLayoutRow\{width:calc\(100% - 30px\)!important/);
  assert.match(previewSource, /id="wl-payment-left"/);
  assert.match(previewSource, /id="wl-payment-right"/);
  assert.match(previewSource, /Current balance/);
  assert.match(previewSource, /wl-payment-card\.wl-payment-balance-field/);
  assert.match(previewSource, /wl-payment-card\.wl-payment-remittance-field/);
  assert.match(previewSource, /parts\.balanceSummary\) left\.appendChild\(parts\.balanceSummary\)/);
  assert.match(previewSource, /\[parts\.amountGroup, parts\.methodHeading/);
  assert.doesNotMatch(previewSource, /wl-payment-amount-topline/);
});

test('preview convenience actions update native fields without submitting', () => {
  assert.match(previewSource, /data-wl-action="pay-balance"/);
  assert.match(previewSource, /data-wl-action="pay-statement"/);
  assert.match(previewSource, /data-wl-action="choose-invoices"/);
  assert.match(previewSource, /data-wl-action="choose-job"/);
  assert.match(previewSource, /input\.dispatchEvent\(new Event\('input'/);
  assert.doesNotMatch(previewSource, /input\.dispatchEvent\(new Event\('change'/);
  assert.match(previewSource, /Pay last statement/);
});

test('invoice and job choices open separate custom selectors', () => {
  assert.match(previewSource, /id = 'wl-invoice-dialog'/);
  assert.match(previewSource, /id = 'wl-job-dialog'/);
  assert.match(previewSource, /aria-modal/);
  assert.match(previewSource, /Pay selected invoices/);
  assert.match(previewSource, /Use selected items/);
  assert.match(previewSource, /Use selected jobs/);
  assert.match(previewSource, /JobBalances_R\.aspx/);
  assert.match(previewSource, /data-wl-select-invoice/);
  assert.match(previewSource, /data-wl-select-job/);
  assert.match(previewSource, /checkbox\.checked = false/);
  assert.match(previewSource, /position:absolute!important;left:-100000px/);
});

test('invoice and credit documents resolve through native WebTrack detail pages', () => {
  assert.match(previewSource, /Invoices_r\.aspx/);
  assert.match(previewSource, /CreditNotes_r\.aspx/);
  assert.match(previewSource, /InvoiceDetails_r\.aspx/);
  assert.match(previewSource, /CreditNoteDetails_r\.aspx/);
  assert.match(previewSource, /ProcessDocument\.aspx/);
  assert.match(previewSource, /data-wl-action="view-document"/);
  assert.match(previewSource, /url\.origin !== window\.location\.origin/);
});

test('charge accounts are limited to the native Forte ACH route', () => {
  assert.match(previewSource, /wl-payment-card-method/);
  assert.match(previewSource, /radio\.disabled = true/);
  assert.match(previewSource, /Bank account \(ACH\/eCheck\)/);
  assert.match(previewSource, /Charge-account payments use secure ACH\/eCheck through Forte/);
  assert.match(previewSource, /searchType\.value = 'JobReference'/);
  assert.match(previewSource, /searchType\.dispatchEvent\(new Event\('change'/);
  assert.match(previewSource, /wl-payment-flow-ready\.wl-payment-charge/);
});

test('billing entry is stabilized without changing the native final payment handler', () => {
  assert.match(previewSource, /data-wl-native-onchange/);
  assert.match(previewSource, /control\.removeAttribute\('onchange'\)/);
  assert.match(previewSource, /\[billing, postal, email\]/);
  assert.doesNotMatch(previewSource, /\[billing, postal, email, amount\]/);
  assert.doesNotMatch(previewSource, /input\.dispatchEvent\(new Event\('change'/);
  assert.match(previewSource, /wl-payment-validation-requested/);
  assert.match(previewSource, /wl-payment-notes-field textarea\{height:78px!important/);
  assert.match(previewSource, /data-wl-restored-billing/);
  assert.match(previewSource, /ctl00\$PageBody\$BillingAddressTextBox/);
});
