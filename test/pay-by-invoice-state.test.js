const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const routerAndLegacySource = read('PayByInvoice.js');
const previewSource = read('PayByInvoicePreview.js');
const accountInfoSource = read('Accountinfo.js');
const paymentFixtureSource = read('test/fixtures/pay-by-invoice-flow.html');

test('production router loads the payment flow for every account by default', () => {
  assert.match(routerAndLegacySource, /function routeProductionPaymentFlow/);
  assert.match(routerAndLegacySource, /requestedMode === 'native'/);
  assert.doesNotMatch(routerAndLegacySource, /expectedAccountIds/);
  assert.doesNotMatch(routerAndLegacySource, /requestedMode !== 'preview'/);
  assert.match(routerAndLegacySource, /__WL_PAYMENT_PREVIEW_ACCOUNT_ID__ = accountId \|\| 'live'/);
  assert.match(routerAndLegacySource, /PayByInvoicePreview\.js\?v=20260916-14/);
});

test('legacy payment enhancements remain available behind the native escape hatch', () => {
  const guardedLegacyModules = routerAndLegacySource.match(
    /if \(window\.__WL_PAYMENT_PREVIEW_ACTIVE__ \|\| !\/AccountPayment_r\\\.aspx\/i\.test\(location\.pathname\)\) return;/g
  ) || [];

  assert.equal(guardedLegacyModules.length, 14);
  assert.match(routerAndLegacySource, /PayByInvoice version v38/);
  assert.match(routerAndLegacySource, /wlProxySubmit/);
  assert.match(routerAndLegacySource, /wiz\.id = 'wlApWizard3'/);
});

test('account overview enables the payment flow for every account', () => {
  assert.doesNotMatch(accountInfoSource, /PAYMENT_FLOW_PREVIEW_ACCOUNT_IDS/);
  assert.match(accountInfoSource, /function configurePaymentFlow\(accountName\)/);
  assert.match(accountInfoSource, /sessionStorage\.setItem\(PAYMENT_FLOW_CONTEXT_KEY/);
  assert.match(accountInfoSource, /sessionStorage\.removeItem\(PAYMENT_FLOW_CONTEXT_KEY\)/);
  assert.match(accountInfoSource, /return true;/);
  assert.match(accountInfoSource, /url\.searchParams\.set\('wl_payment_flow','preview'\)/);
  assert.match(accountInfoSource, /withPaymentFlow\('AccountPayment_r\.aspx'\)/);
  assert.match(accountInfoSource, /utm_statement_total/);
  assert.match(accountInfoSource, /statementTotal\.toFixed\(2\)/);
});

test('test accounts receive the smooth dashboard without blocking on Account Settings', () => {
  assert.match(accountInfoSource, /ACCOUNT_EXPERIENCE_BUILD = '20260916-smooth-2'/);
  assert.match(accountInfoSource, /ACCOUNT_EXPERIENCE_TEST_USERS/);
  assert.match(accountInfoSource, /const smoothExperience=!!testLogin/);
  assert.match(accountInfoSource, /const accountSettingsDetails = smoothExperience\s*\? \{loginName:testLogin/);
  assert.match(accountInfoSource, /requestAnimationFrame\(\(\)=>requestAnimationFrame\(startHydration\)\)/);
  assert.match(accountInfoSource, /aria-busy="true"/);
  assert.match(accountInfoSource, /keepStableEmpty/);
  assert.match(accountInfoSource, /requestIdleCallback\(hydrateProductMedia/);
  assert.match(accountInfoSource, /e\.key!==\'Escape\'/);
});

test('production flow is progressive enhancement with an explicit native escape hatch', () => {
  assert.match(previewSource, /var ROLLOUT_MODE = 'live'/);
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
  assert.match(previewSource, /wl_payment_remittance_draft_v1/);
  assert.match(previewSource, /30 \* 60 \* 1000/);
  assert.match(previewSource, /2 \* 60 \* 1000/);
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
  assert.match(previewSource, /wl-payment-card\.wl-payment-address-field/);
  assert.match(previewSource, /address\.group\.hidden = true/);
  assert.match(previewSource, /parts\.balanceSummary\) left\.appendChild\(parts\.balanceSummary\)/);
  assert.match(previewSource, /parts\.amountGroup\) left\.appendChild\(parts\.amountGroup\)/);
  assert.match(previewSource, /\[parts\.methodHeading, parts\.methodSection/);
  assert.match(previewSource, /Reload amount:/);
  assert.match(previewSource, /Reload details/);
  assert.doesNotMatch(previewSource, /How much would you like to add/);
  assert.doesNotMatch(previewSource, /wl-payment-amount-topline/);
});

test('saved payment selectors have an explicit dropdown treatment', () => {
  assert.match(previewSource, /wl-payment-token-select/);
  assert.match(previewSource, /Choose a saved card/);
  assert.match(previewSource, /Choose a saved bank account/);
  assert.match(previewSource, /ChecksOnFileContainer/);
  assert.match(previewSource, /CardsOnFileContainer/);
  assert.match(previewSource, /background-image:url\("data:image\/svg\+xml/);
  assert.match(previewSource, /appearance:none!important/);
});

test('preview convenience actions update native fields without submitting', () => {
  assert.match(previewSource, /data-wl-action="pay-balance"/);
  assert.match(previewSource, /data-wl-action="pay-statement"/);
  assert.match(previewSource, /data-wl-action="choose-invoices"/);
  assert.match(previewSource, /data-wl-action="choose-job"/);
  assert.match(previewSource, /input\.dispatchEvent\(new Event\('input'/);
  assert.match(previewSource, /input\.dispatchEvent\(new Event\('change'/);
  assert.match(previewSource, /Pay last statement/);
});

test('document, job, and statement selections have an editable removable preview', () => {
  assert.match(previewSource, /id="wl-payment-selection-preview"/);
  assert.match(previewSource, /Your selection/);
  assert.match(previewSource, /Pay by selected documents/);
  assert.match(previewSource, /Edit selected documents/);
  assert.match(previewSource, /Edit selected jobs/);
  assert.match(previewSource, /Remove last statement/);
  assert.match(previewSource, /data-wl-action="clear-selection"/);
  assert.match(previewSource, /function clearPaymentSelection\(\)/);
  assert.match(previewSource, /amount\.value = '0\.00'/);
  assert.match(previewSource, /writeRemittanceDraft\(''\)/);
  assert.match(previewSource, /balance as of\)\/i/);
});

test('invoice and job choices open separate custom selectors', () => {
  assert.match(previewSource, /id = 'wl-invoice-dialog'/);
  assert.match(previewSource, /id = 'wl-job-dialog'/);
  assert.match(previewSource, /aria-modal/);
  assert.match(previewSource, /Pay by selected documents/);
  assert.match(previewSource, /Use selected documents/);
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
  assert.match(previewSource, /Choose an amount to continue with secure ACH\/eCheck through Forte/);
  assert.match(previewSource, /searchType\.value = 'JobReference'/);
  assert.match(previewSource, /searchType\.dispatchEvent\(new Event\('change'/);
  assert.match(previewSource, /wl-payment-flow-ready\.wl-payment-charge/);
});

test('charge ACH setup waits for WebForms and recovers from a swallowed postback', () => {
  assert.match(previewSource, /ACH_ROUTE_RETRY_LIMIT = 3/);
  assert.match(previewSource, /ACH_ROUTE_RETRY_DELAY = 1600/);
  assert.match(previewSource, /get_isInAsyncPostBack/);
  assert.match(previewSource, /scheduleChargeAchRoute\(350\)/);
  assert.match(previewSource, /scheduleChargeAchRoute\(ACH_ROUTE_RETRY_DELAY\)/);
  assert.match(previewSource, /data-wl-action="retry-ach-route"/);
  assert.match(previewSource, /Secure payment is taking longer than expected/);
  assert.match(previewSource, /event\.target\.id === IDS\.amount/);
  assert.match(previewSource, /if \(!\(amount > 0\)\)/);
  assert.match(paymentFixtureSource, /forte_failures/);
  assert.match(paymentFixtureSource, /data-fixture-forte-attempts/);
});

test('native payment clicks receive a non-blocking progress acknowledgement', () => {
  assert.match(previewSource, /id = 'wl-payment-processing'/);
  assert.match(previewSource, /Your click was received/);
  assert.match(previewSource, /Opening secure payment…/);
  assert.match(previewSource, /PAYMENT_PROCESSING_TIMEOUT = 18000/);
  assert.match(previewSource, /MutationObserver/);
  assert.match(previewSource, /hostedPaymentIsVisible/);
  assert.match(previewSource, /The secure window did not open/);
  assert.match(previewSource, /startPaymentProcessing\(nativeSubmit\)/);
  assert.match(previewSource, /data-wl-native-payment-control/);
  assert.match(paymentFixtureSource, /payment_delay/);
  assert.doesNotMatch(previewSource, /preventDefault\s*\(/);
});

test('billing entry is stabilized without changing the native final payment handler', () => {
  assert.match(previewSource, /data-wl-native-onchange/);
  assert.match(previewSource, /control\.removeAttribute\('onchange'\)/);
  assert.match(previewSource, /\[billing, postal, email\]/);
  assert.doesNotMatch(previewSource, /\[billing, postal, email, amount\]/);
  assert.match(previewSource, /input\.dispatchEvent\(new Event\('change'/);
  assert.match(previewSource, /wl-payment-validation-requested/);
  assert.match(previewSource, /wl-payment-notes-field textarea\{height:78px!important/);
  assert.match(previewSource, /data-wl-restored-billing/);
  assert.match(previewSource, /ctl00\$PageBody\$BillingAddressTextBox/);
});
