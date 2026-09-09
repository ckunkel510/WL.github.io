(function woodsonPaymentFlow() {
  'use strict';

  var isFixture = document.documentElement.getAttribute('data-wl-payment-fixture') === 'true';
  if (!/\/AccountPayment_r\.aspx$/i.test(window.location.pathname) && !isFixture) return;

  /*
   * Safe rollout:
   *   ?wl_payment_flow=native  -> WebTrack's native page, untouched
   *   ?wl_payment_flow=preview -> the new progressive enhancement
   *
   * Keep preview-only until both cash and charge-account paths are approved.
   * Change ROLLOUT_MODE to "live" when the preview is ready for all customers.
   */
  var ROLLOUT_MODE = 'preview';
  var requestedMode = '';
  try {
    requestedMode = new URL(window.location.href).searchParams.get('wl_payment_flow') || '';
  } catch (error) {}

  if (requestedMode === 'native') return;
  if (ROLLOUT_MODE === 'preview' && requestedMode !== 'preview') return;

  var VERSION = 'v2-preview-7';
  var IDS = {
    address: 'ctl00_PageBody_AddressDropdownList',
    billing: 'ctl00_PageBody_BillingAddressTextBox',
    postal: 'ctl00_PageBody_PostalCodeTextBox',
    postalAlt: 'ctl00_PageBody_BillingPostalCodeTextBox',
    email: 'ctl00_PageBody_EmailAddressTextBox',
    amountDue: 'ctl00_PageBody_AmountOwingLiteral',
    amount: 'ctl00_PageBody_PaymentAmountTextBox',
    notes: 'ctl00_PageBody_NotesTextBox',
    remittance: 'ctl00_PageBody_RemittanceAdviceTextBox',
    transactions: 'ctl00_PageBody_accountsTransactionsPanel',
    payByBank: 'ctl00_PageBody_RadioButton_PayByCheck',
    payBySavedBank: 'ctl00_PageBody_RadioButton_PayByCheckOnFile',
    payByCard: 'ctl00_PageBody_RadioButton_PayByCredit',
    payBySavedCard: 'ctl00_PageBody_RadioButton_PayByCardOnFile',
    submitPanel: 'ctl00_PageBody_MakePaymentPanel',
    submit: 'ctl00_PageBody_MakePayment',
    submitAltPanel: 'ctl00_PageBody_ForteControls',
    submitAlt: 'ctl00_PageBody_ForteMakePayment'
  };

  var BILLING_DRAFT_KEY = 'wl_payment_billing_draft_v1_'+String(window.__WL_PAYMENT_PREVIEW_ACCOUNT_ID__ || 'preview').replace(/[^A-Z0-9_-]/gi, '');

  var METHOD_IDS = [
    IDS.payByBank,
    IDS.payBySavedBank,
    IDS.payByCard,
    IDS.payBySavedCard
  ];

  function byId(id) {
    return document.getElementById(id);
  }

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function parseMoney(value) {
    var number = Number.parseFloat(String(value || '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(number) ? number : 0;
  }

  function formatMoney(value) {
    return Number(value || 0).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function closestGroup(element) {
    if (!element) return null;
    return element.closest('.epi-form-group-acctPayment') || element.parentElement;
  }

  function insertBefore(reference, node) {
    if (!reference || !reference.parentNode || !node) return false;
    reference.parentNode.insertBefore(node, reference);
    return true;
  }

  function appendDescribedBy(control, id) {
    if (!control || !id) return;
    var current = cleanText(control.getAttribute('aria-describedby'));
    var ids = current ? current.split(' ') : [];
    if (ids.indexOf(id) === -1) ids.push(id);
    control.setAttribute('aria-describedby', ids.join(' '));
  }

  function readBillingDraft() {
    try {
      var draft = JSON.parse(sessionStorage.getItem(BILLING_DRAFT_KEY) || 'null');
      if (!draft || !draft.savedAt || Date.now() - Number(draft.savedAt) > 30 * 60 * 1000) {
        sessionStorage.removeItem(BILLING_DRAFT_KEY);
        return '';
      }
      return String(draft.value || '');
    } catch (error) {}
    return '';
  }

  function writeBillingDraft(value) {
    try {
      var clean = String(value || '');
      if (!clean) {
        sessionStorage.removeItem(BILLING_DRAFT_KEY);
        return;
      }
      sessionStorage.setItem(BILLING_DRAFT_KEY, JSON.stringify({ value: clean, savedAt: Date.now() }));
    } catch (error) {}
  }

  function ensureBillingControl() {
    var controls = document.querySelectorAll('input[name="ctl00$PageBody$BillingAddressTextBox"]');
    var nativeControl = null;
    Array.prototype.some.call(controls, function (control) {
      if (control.getAttribute('data-wl-restored-billing') !== 'true') {
        nativeControl = control;
        return true;
      }
      return false;
    });

    var restoredGroup = byId('wl-payment-restored-billing');
    if (nativeControl && restoredGroup) restoredGroup.remove();
    var control = nativeControl || byId(IDS.billing);

    if (!control) {
      var reference = closestGroup(byId(IDS.postal) || byId(IDS.postalAlt) || byId(IDS.email) || byId(IDS.amount));
      restoredGroup = document.createElement('div');
      restoredGroup.id = 'wl-payment-restored-billing';
      restoredGroup.className = 'epi-form-group-acctPayment';
      restoredGroup.innerHTML = [
        '<div><label for="'+IDS.billing+'">Billing address:</label></div>',
        '<div><input id="'+IDS.billing+'" name="ctl00$PageBody$BillingAddressTextBox" type="text" class="form-control" maxlength="200" autocomplete="street-address" data-wl-restored-billing="true"></div>'
      ].join('');
      if (reference) insertBefore(reference, restoredGroup);
      else (document.getElementById('aspnetForm') || document.querySelector('form') || document.body).appendChild(restoredGroup);
      control = byId(IDS.billing);
    }

    var saved = readBillingDraft();
    if (control && !cleanText(control.value) && saved) control.value = saved;
    if (control && control.getAttribute('data-wl-billing-draft-bound') !== VERSION) {
      control.setAttribute('data-wl-billing-draft-bound', VERSION);
      control.addEventListener('input', function () { writeBillingDraft(control.value); });
    }
    return control;
  }

  function ensureStyles() {
    if (byId('wl-payment-flow-styles')) return;

    var style = document.createElement('style');
    style.id = 'wl-payment-flow-styles';
    style.textContent = [
      'body.wl-payment-flow-ready{--wl-wine:#720018;--wl-wine-dark:#540012;--wl-ink:#1f2937;--wl-muted:#5f6773;--wl-line:#dfe3e8;--wl-soft:#f6f7f9;}',
      'body.wl-payment-flow-ready *{box-sizing:border-box;}',
      'body.wl-payment-flow-ready #MainLayoutRow{width:calc(100% - 30px)!important;max-width:1210px!important;margin-left:auto!important;margin-right:auto!important;}',
      'body.wl-payment-flow-ready #MainLayoutRow>.container-fluid>.row>.col-auto.navigation-menu{display:none!important;}',
      'body.wl-payment-flow-ready #MainLayoutRow>.container-fluid>.row>.col{flex:1 1 100%!important;width:100%!important;max-width:100%!important;padding-left:15px!important;}',
      'body.wl-payment-flow-ready .bodyFlexContainer{display:block!important;width:100%!important;}',
      'body.wl-payment-flow-ready .bodyFlexContainer>.bodyFlexItem{display:block!important;width:100%!important;}',
      'body.wl-payment-flow-ready .bodyFlexContainer>.bodyFlexItem.listPageHeader{display:none!important;}',
      'body.wl-payment-flow-ready .bodyFlexContainer>.bodyFlexItem>.float-left{float:none!important;width:100%!important;max-width:1180px!important;margin:0 auto!important;}',
      '#wl-payment-guide{max-width:1180px;margin:10px auto 12px;padding:0;color:var(--wl-ink);font-family:Arial,Helvetica,sans-serif;}',
      '#wl-payment-guide .wl-guide-card{display:grid;grid-template-columns:minmax(260px,1fr) minmax(430px,1.25fr);gap:10px 22px;align-items:end;background:linear-gradient(135deg,#fff 0%,#f9f5f6 100%);border:1px solid #eadadd;border-left:6px solid var(--wl-wine);border-radius:13px;padding:12px 18px;box-shadow:0 4px 14px rgba(31,41,55,.05);}',
      '#wl-payment-guide .wl-guide-main{min-width:0;}',
      '#wl-payment-guide .wl-back-link{display:inline-flex;align-items:center;min-height:28px;margin:0 0 4px;color:var(--wl-wine);font-size:13px;font-weight:800;text-decoration:none;}',
      '#wl-payment-guide .wl-back-link:hover{text-decoration:underline;}',
      '#wl-payment-guide h1{margin:0;color:#1b1d21;font-size:clamp(23px,3vw,31px);line-height:1.12;}',
      '#wl-payment-guide .wl-guide-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:0;padding:0;list-style:none;}',
      '#wl-payment-guide .wl-guide-steps a{display:flex;align-items:center;gap:7px;min-height:40px;padding:7px 9px;border:1px solid var(--wl-line);border-radius:9px;background:#fff;color:var(--wl-ink);font-size:13px;font-weight:700;text-decoration:none;}',
      '#wl-payment-guide .wl-step-number{display:inline-grid;place-items:center;flex:0 0 23px;width:23px;height:23px;border-radius:50%;background:var(--wl-wine);color:#fff;font-size:12px;}',
      '#wl-payment-workspace{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(340px,.8fr);gap:14px;align-items:start;width:100%;max-width:1180px;margin:0 auto 18px;color:var(--wl-ink);font-family:Arial,Helvetica,sans-serif;}',
      '.wl-workspace-column{min-width:0;padding:14px;border:1px solid var(--wl-line);border-radius:13px;background:var(--wl-soft);box-shadow:0 3px 12px rgba(31,41,55,.04);}',
      '.wl-payment-section-heading{width:100%;margin:12px 0 7px;padding:0;color:var(--wl-ink);font-family:Arial,Helvetica,sans-serif;}',
      '.wl-payment-section-heading:first-child{margin-top:0;}',
      '.wl-payment-section-heading h2{margin:0;font-size:18px;line-height:1.22;}',
      '.wl-payment-section-heading p{margin:4px 0 0;color:var(--wl-muted);font-size:13px;line-height:1.4;}',
      '#wl-current-balance{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:6px 0;padding:10px 12px;border:1px solid #d7e6dd;border-radius:9px;background:#f6fbf8;}',
      '#wl-current-balance span{color:#3d5545;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;}',
      '#wl-current-balance strong{color:#173c25;font-size:22px;line-height:1;}',
      'body.wl-payment-flow-ready .wl-payment-card{display:grid!important;grid-template-columns:minmax(118px,145px) minmax(0,1fr)!important;gap:5px 10px!important;align-items:center!important;width:100%!important;max-width:none!important;margin:6px 0!important;padding:9px 10px!important;border:1px solid var(--wl-line)!important;border-radius:9px!important;background:#fff!important;box-shadow:none!important;}',
      'body.wl-payment-flow-ready .wl-payment-card>div{width:auto!important;min-width:0!important;max-width:none!important;flex:none!important;}',
      'body.wl-payment-flow-ready .wl-payment-card>div:first-child{grid-column:1;align-self:center;}',
      'body.wl-payment-flow-ready .wl-payment-card>div:nth-child(2){grid-column:2;}',
      'body.wl-payment-flow-ready .wl-payment-card>.wl-field-help{grid-column:2;margin:0!important;}',
      'body.wl-payment-flow-ready .wl-payment-card.wl-payment-balance-field,body.wl-payment-flow-ready .wl-payment-card.wl-payment-remittance-field{display:none!important;}',
      'body.wl-payment-flow-ready .wl-payment-field input[type="text"],body.wl-payment-flow-ready .wl-payment-field input[type="email"],body.wl-payment-flow-ready .wl-payment-field textarea,body.wl-payment-flow-ready .wl-payment-field select{width:100%!important;max-width:none!important;min-height:40px!important;padding:8px 10px!important;border:1px solid #aeb5bf!important;border-radius:7px!important;background:#fff!important;color:#111827!important;font-size:15px!important;}',
      'body.wl-payment-flow-ready .wl-payment-field textarea{min-height:58px!important;resize:vertical;}',
      'body.wl-payment-flow-ready .wl-payment-notes-field textarea{height:78px!important;min-height:58px!important;max-height:110px!important;}',
      'body.wl-payment-flow-ready .wl-payment-field input:focus,body.wl-payment-flow-ready .wl-payment-field textarea:focus,body.wl-payment-flow-ready .wl-payment-field select:focus{outline:3px solid rgba(114,0,24,.18)!important;border-color:var(--wl-wine)!important;}',
      'body.wl-payment-flow-ready:not(.wl-payment-validation-requested) .wl-payment-field span[style*="color: Red"],body.wl-payment-flow-ready:not(.wl-payment-validation-requested) .wl-payment-field span[style*="color:red"],body.wl-payment-flow-ready:not(.wl-payment-validation-requested) #ctl00_PageBody_BillingAddressValidatorMessage{display:none!important;}',
      '#wl-payment-billing-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;}',
      '#wl-payment-billing-grid .wl-payment-card{grid-template-columns:1fr!important;align-items:start!important;}',
      '#wl-payment-billing-grid .wl-payment-card>div:first-child,#wl-payment-billing-grid .wl-payment-card>div:nth-child(2){grid-column:1;}',
      '.wl-field-help{margin:5px 0 0;color:var(--wl-muted);font-size:12px;line-height:1.35;}',
      '#wl-payment-amount-choices{width:100%;margin:0 0 7px;padding:10px;border:1px solid #eadadd;border-radius:9px;background:#fffafa;}',
      '#wl-payment-amount-choices .wl-choice-title{margin:0 0 7px;font-size:14px;font-weight:800;color:var(--wl-ink);}',
      '#wl-payment-amount-choices .wl-choice-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;}',
      '.wl-flow-button{min-height:40px;padding:7px 10px;border:1px solid #aeb5bf;border-radius:8px;background:#fff;color:var(--wl-ink);font-size:13px;font-weight:800;cursor:pointer;}',
      '.wl-flow-button:hover{border-color:var(--wl-wine);color:var(--wl-wine);}',
      '.wl-flow-button:focus-visible{outline:3px solid rgba(114,0,24,.2);outline-offset:2px;}',
      '.wl-flow-button.primary{border-color:var(--wl-wine);background:var(--wl-wine);color:#fff;}',
      '.wl-flow-button.primary:hover{background:var(--wl-wine-dark);color:#fff;}',
      'body.wl-payment-flow-ready .wl-payment-method-section{display:block!important;width:100%!important;margin:0!important;}',
      'body.wl-payment-flow-ready .wl-payment-method-section>.container{display:block!important;width:100%!important;max-width:none!important;padding:0!important;}',
      'body.wl-payment-flow-ready .wl-payment-method-section>.container>div{width:100%!important;}',
      'body.wl-payment-flow-ready .wl-payment-method{width:100%;max-width:none;margin:6px 0!important;padding:10px 12px!important;border:1px solid var(--wl-line)!important;border-radius:9px!important;background:#fff!important;}',
      'body.wl-payment-flow-ready .wl-payment-method:focus-within{border-color:var(--wl-wine)!important;box-shadow:0 0 0 3px rgba(114,0,24,.12);}',
      'body.wl-payment-flow-ready .wl-payment-method input[type="radio"]{width:19px;height:19px;margin-right:9px;accent-color:var(--wl-wine);}',
      'body.wl-payment-flow-ready.wl-payment-charge .wl-payment-card-method{display:none!important;}',
      'body.wl-payment-flow-ready.wl-payment-charge #'+IDS.submit+'{display:none!important;}',
      '#wl-ach-route-note{margin:7px 0;padding:9px 11px;border:1px solid #d7e6dd;border-radius:8px;background:#f6fbf8;color:#31523d;font-size:12px;line-height:1.35;}',
      '#wl-payment-review{margin:10px 0;padding:12px;border:1px solid #d7e6dd;border-radius:10px;background:#f6fbf8;color:var(--wl-ink);font-family:Arial,Helvetica,sans-serif;}',
      '#wl-payment-review h2{margin:0 0 9px;font-size:18px;}',
      '#wl-payment-review dl{display:grid;grid-template-columns:minmax(108px,.65fr) minmax(0,1fr);gap:6px 9px;margin:0;font-size:13px;}',
      '#wl-payment-review dt{color:var(--wl-muted);font-weight:700;}',
      '#wl-payment-review dd{margin:0;font-weight:800;overflow-wrap:anywhere;}',
      '#wl-payment-review .wl-review-help{margin:9px 0 0;color:var(--wl-muted);font-size:12px;line-height:1.35;}',
      'body.wl-payment-flow-ready #'+IDS.submitPanel+',body.wl-payment-flow-ready #'+IDS.submitAltPanel+'{width:100%;max-width:none;margin:0!important;padding:0!important;border:0!important;background:transparent!important;}',
      'body.wl-payment-flow-ready #'+IDS.submitPanel+' .epi-form-group-acctPayment,body.wl-payment-flow-ready #'+IDS.submitAltPanel+' .epi-form-group-acctPayment{display:block!important;width:100%!important;margin:0!important;padding:0!important;background:transparent!important;}',
      'body.wl-payment-flow-ready #'+IDS.submitPanel+' .submit-button-panel,body.wl-payment-flow-ready #'+IDS.submitAltPanel+' .submit-button-panel,body.wl-payment-flow-ready #'+IDS.submitAltPanel+' .epi-form-group-acctPayment>div{display:flex!important;justify-content:flex-start!important;width:100%!important;max-width:none!important;}',
      'body.wl-payment-flow-ready #'+IDS.submit+',body.wl-payment-flow-ready #'+IDS.submit+':visited,body.wl-payment-flow-ready #'+IDS.submitAlt+'{display:inline-flex!important;align-items:center;justify-content:center;width:100%!important;min-height:46px;padding:10px 16px!important;border:1px solid var(--wl-wine)!important;border-radius:8px!important;background:var(--wl-wine)!important;color:#fff!important;font-size:15px!important;font-weight:800!important;text-decoration:none!important;}',
      'body.wl-payment-flow-ready #'+IDS.submit+':hover,body.wl-payment-flow-ready #'+IDS.submitAlt+':hover{background:var(--wl-wine-dark)!important;}',
      'body.wl-payment-flow-ready #'+IDS.submit+':focus-visible,body.wl-payment-flow-ready #'+IDS.submitAlt+':focus-visible{outline:3px solid rgba(114,0,24,.22)!important;outline-offset:3px;}',
      '#wl-payment-native-note{margin:7px 0 0;color:var(--wl-muted);font-size:12px;line-height:1.35;text-align:center;}',
      'body.wl-payment-dialog-open{overflow:hidden;}',
      '.wl-picker-dialog[hidden]{display:none!important;}',
      '.wl-picker-dialog{position:fixed;inset:0;z-index:10050;display:grid;place-items:center;padding:20px;background:rgba(17,24,39,.62);}',
      '.wl-picker-card{display:flex;flex-direction:column;width:min(1060px,calc(100vw - 40px));max-height:calc(100vh - 40px);overflow:hidden;border-radius:14px;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.3);}',
      '.wl-picker-header{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:13px 16px;background:var(--wl-wine);color:#fff;}',
      '.wl-picker-header h2{margin:0;font-size:21px;}',
      '.wl-picker-header-actions{display:flex;align-items:center;gap:8px;}',
      '.wl-picker-header .wl-flow-button{min-height:36px;border-color:rgba(255,255,255,.55);background:transparent;color:#fff;}',
      '.wl-picker-tools{display:flex;align-items:center;gap:9px;padding:11px 16px;border-bottom:1px solid var(--wl-line);background:#fafafa;}',
      '.wl-picker-search{flex:1 1 auto;min-width:0;min-height:40px;padding:8px 11px;border:1px solid #aeb5bf;border-radius:8px;font-size:14px;}',
      '.wl-picker-summary{flex:0 0 auto;color:var(--wl-ink);font-size:13px;font-weight:800;}',
      '.wl-picker-body{min-height:0;padding:10px 16px;overflow:auto;}',
      '.wl-picker-list{display:grid;gap:7px;}',
      '.wl-picker-row{display:grid;grid-template-columns:28px minmax(105px,.65fr) minmax(150px,1fr) minmax(165px,1.15fr) minmax(100px,.55fr) auto;gap:10px;align-items:center;padding:10px;border:1px solid var(--wl-line);border-radius:9px;background:#fff;}',
      '.wl-picker-row:hover{border-color:#c9aeb4;background:#fffafb;}',
      '.wl-picker-row input[type="checkbox"]{width:19px;height:19px;accent-color:var(--wl-wine);}',
      '.wl-picker-doc{font-weight:900;}',
      '.wl-picker-meta{color:var(--wl-muted);font-size:12px;line-height:1.35;}',
      '.wl-picker-amount{text-align:right;font-weight:900;}',
      '.wl-picker-document{min-height:34px;padding:6px 9px;white-space:nowrap;}',
      '.wl-picker-kind{display:inline-block;margin-top:3px;padding:2px 7px;border-radius:999px;background:#eef6ff;color:#1e40af;font-size:11px;font-weight:800;}',
      '.wl-picker-kind.credit{background:#fff7ed;color:#9a3412;}',
      '.wl-picker-empty{margin:8px 0;padding:18px;border:1px dashed #c8cdd4;border-radius:9px;text-align:center;color:var(--wl-muted);}',
      '.wl-picker-message{min-height:18px;margin:0;padding:0 16px 8px;color:#9a3412;font-size:12px;font-weight:700;}',
      '.wl-picker-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;border-top:1px solid var(--wl-line);background:#fafafa;}',
      '.wl-picker-footer-actions{display:flex;gap:8px;}',
      '.wl-job-row{grid-template-columns:28px minmax(0,1fr) minmax(110px,.35fr);}',
      'body.wl-payment-flow-ready #'+IDS.transactions+'{position:absolute!important;left:-100000px!important;top:auto!important;width:1px!important;height:1px!important;overflow:hidden!important;opacity:0!important;pointer-events:none!important;}',
      '.wl-dialog-close{min-width:74px;}',
      '@media (max-width:900px){#wl-payment-guide .wl-guide-card{grid-template-columns:1fr;align-items:start;}#wl-payment-workspace{grid-template-columns:1fr;}#wl-payment-amount-choices .wl-choice-row{grid-template-columns:repeat(2,minmax(0,1fr));}}',
      '@media (max-width:720px){body.wl-payment-flow-ready #MainLayoutRow{width:calc(100% - 12px)!important;}#wl-payment-guide{margin:8px auto 10px;}#wl-payment-guide .wl-guide-card{padding:11px 12px;}#wl-payment-guide .wl-guide-steps{grid-template-columns:1fr;}#wl-payment-workspace{gap:10px;}.wl-workspace-column{padding:11px;}body.wl-payment-flow-ready .wl-payment-card{grid-template-columns:1fr!important;gap:4px!important;}body.wl-payment-flow-ready .wl-payment-card>div:first-child,body.wl-payment-flow-ready .wl-payment-card>div:nth-child(2),body.wl-payment-flow-ready .wl-payment-card>.wl-field-help{grid-column:1;}#wl-payment-billing-grid{grid-template-columns:1fr;}#wl-payment-amount-choices .wl-choice-row{grid-template-columns:1fr;}#wl-payment-review dl{grid-template-columns:1fr;gap:2px;}#wl-payment-review dd{margin-bottom:6px;}.wl-picker-dialog{padding:8px;}.wl-picker-card{width:calc(100vw - 16px);max-height:calc(100vh - 16px);}.wl-picker-header,.wl-picker-tools,.wl-picker-footer{padding:10px 12px;}.wl-picker-header{align-items:flex-start;}.wl-picker-tools{align-items:stretch;flex-direction:column;}.wl-picker-row{grid-template-columns:28px 1fr auto;}.wl-picker-row .wl-picker-secondary{grid-column:2 / -1;}.wl-picker-row .wl-picker-amount{grid-column:3;grid-row:1;text-align:right;}.wl-picker-row .wl-picker-document{grid-column:2 / -1;width:100%;}.wl-job-row{grid-template-columns:28px 1fr auto;}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function pageHeadingText() {
    var headings = document.querySelectorAll('.bodyFlexItem.listPageHeader, h1, h2, .pageHeader, .panelHeader');
    return cleanText(Array.prototype.map.call(headings, function (heading) {
      return heading.textContent;
    }).join(' '));
  }

  function isCashAccount() {
    if (/Load Cash Account Balance/i.test(pageHeadingText())) return true;
    return !byId(IDS.remittance) && !byId(IDS.transactions);
  }

  function isSuccessView() {
    var receipt = document.querySelector('table.paymentDataTable');
    if (!receipt) return false;
    return /payment was successful/i.test(cleanText(document.body && document.body.textContent));
  }

  function getFirstContentReference() {
    return closestGroup(byId(IDS.billing)) ||
      closestGroup(byId(IDS.amount)) ||
      byId(IDS.transactions) ||
      byId(IDS.submitPanel);
  }

  function ensureGuide(cashAccount) {
    var guide = byId('wl-payment-guide');
    if (!guide) {
      guide = document.createElement('section');
      guide.id = 'wl-payment-guide';
      guide.setAttribute('aria-labelledby', 'wl-payment-guide-title');

      var pageHeader = document.querySelector('.bodyFlexItem.listPageHeader');
      if (pageHeader && pageHeader.parentNode) {
        pageHeader.parentNode.insertBefore(guide, pageHeader.nextSibling);
      } else {
        insertBefore(getFirstContentReference(), guide);
      }
    }

    var title = cashAccount ? 'Add money to your cash account' : 'Pay your Woodson account';

    guide.innerHTML = [
      '<div class="wl-guide-card">',
      '  <div class="wl-guide-main">',
      '    <a class="wl-back-link" href="AccountInfo_R.aspx">&larr; Back to Account Overview</a>',
      '    <h1 id="wl-payment-guide-title">'+title+'</h1>',
      '  </div>',
      '  <ol class="wl-guide-steps">',
      '    <li><a href="#'+IDS.amount+'"><span class="wl-step-number">1</span><span>Amount</span></a></li>',
      '    <li><a href="#'+IDS.payByBank+'"><span class="wl-step-number">2</span><span>Method</span></a></li>',
      '    <li><a href="#wl-payment-right"><span class="wl-step-number">3</span><span>Review</span></a></li>',
      '  </ol>',
      '</div>'
    ].join('');
  }

  function ensureSectionHeading(reference, id, step, title, description) {
    if (!reference) return null;
    var heading = byId(id);
    if (!heading) {
      heading = document.createElement('div');
      heading.id = id;
      heading.className = 'wl-payment-section-heading';
      insertBefore(reference, heading);
    }
    heading.innerHTML = (step ? '<p class="wl-section-kicker">'+step+'</p>' : '')+
      '<h2>'+title+'</h2>'+
      (description ? '<p>'+description+'</p>' : '');
    return heading;
  }

  function ensureHelp(group, id, text, control) {
    if (!group) return;
    var help = byId(id);
    if (!help) {
      help = document.createElement('p');
      help.id = id;
      help.className = 'wl-field-help';
      group.appendChild(help);
    }
    help.textContent = text;
    appendDescribedBy(control, id);
  }

  function enhanceField(id, className, helpId, helpText, attributes) {
    var control = byId(id);
    if (!control) return null;

    var group = closestGroup(control);
    if (group) {
      group.classList.add('wl-payment-field', 'wl-payment-card');
      if (className) group.classList.add(className);
    }

    Object.keys(attributes || {}).forEach(function (name) {
      if (!control.getAttribute(name)) control.setAttribute(name, attributes[name]);
    });

    if (helpText) ensureHelp(group, helpId, helpText, control);
    return { control: control, group: group };
  }

  function stabilizeNativeTextField(control) {
    if (!control) return;
    var nativeChange = control.getAttribute('onchange');
    if (nativeChange && !control.getAttribute('data-wl-native-onchange')) {
      control.setAttribute('data-wl-native-onchange', nativeChange);
    }
    control.removeAttribute('onchange');
  }

  function statementAmount() {
    try {
      var params = new URL(window.location.href).searchParams;
      var explicit = parseMoney(params.get('utm_statement_total'));
      if (explicit > 0) return explicit;
      if (/PayStatement/i.test(params.get('utm_action') || '')) {
        return parseMoney(params.get('utm_total'));
      }
    } catch (error) {}
    return 0;
  }

  function setAmount(value) {
    var input = byId(IDS.amount);
    if (!input || !(value > 0)) return;

    input.value = Number(value).toFixed(2);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function ensureBalanceSummary(cashAccount, amountHeading) {
    var dueField = byId(IDS.amountDue);
    var dueGroup = closestGroup(dueField);
    if (dueGroup) {
      dueGroup.classList.add('wl-payment-balance-field');
      dueGroup.setAttribute('aria-hidden', 'true');
    }

    var summary = byId('wl-current-balance');
    if (!summary) {
      summary = document.createElement('div');
      summary.id = 'wl-current-balance';
      if (amountHeading && amountHeading.parentNode) {
        amountHeading.parentNode.insertBefore(summary, amountHeading.nextSibling);
      }
    }

    var due = parseMoney(dueField && (dueField.value || dueField.textContent));
    summary.innerHTML = '<span>'+(cashAccount ? 'Cash balance' : 'Current balance')+'</span><strong>'+formatMoney(due)+'</strong>';
    return summary;
  }

  function ensureAmountChoices(cashAccount, amountGroup) {
    if (!amountGroup) return;
    var choices = byId('wl-payment-amount-choices');
    if (!choices) {
      choices = document.createElement('div');
      choices.id = 'wl-payment-amount-choices';
      insertBefore(amountGroup, choices);
    }

    if (cashAccount) {
      choices.innerHTML = '<p class="wl-choice-title">How much would you like to add?</p><div class="wl-choice-row"><button type="button" class="wl-flow-button primary" data-wl-action="focus-amount">Enter an amount</button></div>';
      return;
    }

    var dueField = byId(IDS.amountDue);
    var due = parseMoney(dueField && (dueField.value || dueField.textContent));
    var statement = statementAmount();
    choices.innerHTML = [
      '<p class="wl-choice-title">What would you like to pay?</p>',
      '<div class="wl-choice-row">',
      due > 0 ? '<button type="button" class="wl-flow-button primary" data-wl-action="pay-balance">Pay full balance '+formatMoney(due)+'</button>' : '',
      statement > 0 ? '<button type="button" class="wl-flow-button" data-wl-action="pay-statement">Pay last statement '+formatMoney(statement)+'</button>' : '',
      byId(IDS.transactions) ? '<button type="button" class="wl-flow-button" data-wl-action="choose-invoices">Pay selected invoices</button>' : '',
      byId(IDS.transactions) ? '<button type="button" class="wl-flow-button" data-wl-action="choose-job">Pay by job</button>' : '',
      '<button type="button" class="wl-flow-button" data-wl-action="focus-amount">Other amount</button>',
      '</div>'
    ].join('');
  }

  var invoicePickerState = {
    rows: [],
    selected: new Map(),
    loaded: false,
    loading: false,
    documentUrls: new Map()
  };
  var jobPickerState = {
    rows: [],
    selected: new Map(),
    loaded: false,
    loading: false
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function transactionCell(row, titles) {
    var value = '';
    titles.some(function (title) {
      var cell = row.querySelector('td[data-title="'+title+'"]');
      if (!cell) return false;
      value = cleanText(cell.textContent);
      return !!value;
    });
    return value;
  }

  function isCreditRow(row) {
    return /credit|crn|c\/n/i.test(String(row && row.type || '')) || parseMoney(row && row.amount) < 0;
  }

  function extractTransactionRows(root) {
    var grid = root.querySelector('#ctl00_PageBody_InvoicesGrid .rgMasterTable, #ctl00_PageBody_InvoicesGrid_ctl00, .RadGrid[id*="InvoicesGrid"] .rgMasterTable');
    if (!grid) return [];

    return Array.prototype.map.call(grid.querySelectorAll('tbody > tr'), function (tableRow) {
      var doc = transactionCell(tableRow, ['Doc. #', 'Document #', 'Doc #', 'Invoice #']);
      if (!doc) return null;
      var type = transactionCell(tableRow, ['Type']) || 'Invoice';
      return {
        key: type.toLowerCase()+'|'+doc,
        doc: doc,
        type: type,
        branch: transactionCell(tableRow, ['Branch']),
        transactionDate: transactionCell(tableRow, ['Transaction Date', 'Trans Date', 'Date']),
        dueDate: transactionCell(tableRow, ['Due Date']),
        job: transactionCell(tableRow, ['Job Ref', 'Job', 'Job Name', 'Project']),
        reference: transactionCell(tableRow, ['Customer Ref', 'Description', 'Notes', 'Reference']),
        amount: transactionCell(tableRow, ['Amount', 'Doc Amount', 'Amount With Tax']),
        outstanding: transactionCell(tableRow, ['Amount Outstanding', 'Outstanding', 'Balance'])
      };
    }).filter(Boolean);
  }

  function mergeTransactionRows(rows) {
    var known = new Set(invoicePickerState.rows.map(function (row) { return row.key; }));
    rows.forEach(function (row) {
      if (!row || known.has(row.key)) return;
      known.add(row.key);
      invoicePickerState.rows.push(row);
    });
  }

  function normalizePaymentPageUrl(href) {
    try {
      var url = new URL(href, window.location.href);
      if (!/\/AccountPayment_r\.aspx$/i.test(url.pathname)) return '';
      url.searchParams.delete('wl_invoice_mode');
      return url.href;
    } catch (error) {}
    return '';
  }

  function collectPaymentPageUrls(root) {
    var panel = root.querySelector('#'+IDS.transactions);
    if (!panel) return [];
    return Array.prototype.map.call(panel.querySelectorAll('a[href*="pageIndex="],a[href*="itemsPerPage=48"]'), function (anchor) {
      return normalizePaymentPageUrl(anchor.getAttribute('href') || '');
    }).filter(Boolean);
  }

  function setPickerMessage(id, message) {
    var target = byId(id);
    if (target) target.textContent = message || '';
  }

  function selectedInvoiceRows() {
    return invoicePickerState.rows.filter(function (row) {
      return invoicePickerState.selected.has(row.key);
    });
  }

  function selectedInvoiceTotal() {
    return selectedInvoiceRows().reduce(function (total, row) {
      var amount = Math.abs(parseMoney(row.outstanding || row.amount));
      return total + (isCreditRow(row) ? -amount : amount);
    }, 0);
  }

  function seedInvoiceSelection() {
    invoicePickerState.selected.clear();
    var remittance = cleanText(byId(IDS.remittance) && byId(IDS.remittance).value);
    if (!remittance) return;
    var tokens = remittance.split(/\s*,\s*/).filter(Boolean);
    invoicePickerState.rows.forEach(function (row) {
      var invoiceToken = new RegExp('^'+row.doc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')+'\\$','i');
      var creditToken = new RegExp('^CN'+row.doc.replace(/^(CN|CRN|CR)/i, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')+'$','i');
      if (tokens.some(function (token) { return invoiceToken.test(token) || creditToken.test(token); })) {
        invoicePickerState.selected.set(row.key, true);
      }
    });
  }

  function renderInvoiceSummary() {
    var summary = byId('wl-invoice-summary');
    if (!summary) return;
    var count = invoicePickerState.selected.size;
    summary.textContent = count+' selected · '+formatMoney(Math.max(0, selectedInvoiceTotal()));
  }

  function renderInvoiceRows() {
    var list = byId('wl-invoice-list');
    if (!list) return;
    var query = cleanText(byId('wl-invoice-filter') && byId('wl-invoice-filter').value).toLowerCase();
    var rows = invoicePickerState.rows.filter(function (row) {
      if (!query) return true;
      return [row.doc, row.type, row.transactionDate, row.dueDate, row.job, row.reference, row.branch]
        .join(' ').toLowerCase().indexOf(query) !== -1;
    });

    if (!rows.length) {
      list.innerHTML = '<p class="wl-picker-empty">'+(invoicePickerState.loading ? 'Loading invoices and credits…' : 'No matching invoices or credits found.')+'</p>';
      renderInvoiceSummary();
      return;
    }

    list.innerHTML = rows.map(function (row) {
      var credit = isCreditRow(row);
      var amount = Math.abs(parseMoney(row.outstanding || row.amount));
      return [
        '<div class="wl-picker-row" data-wl-invoice-key="'+escapeHtml(row.key)+'">',
        '  <input type="checkbox" aria-label="Select '+(credit ? 'credit ' : 'invoice ')+escapeHtml(row.doc)+'" data-wl-select-invoice="'+escapeHtml(row.key)+'" '+(invoicePickerState.selected.has(row.key) ? 'checked' : '')+'>',
        '  <span><span class="wl-picker-doc">'+escapeHtml(row.doc)+'</span><br><span class="wl-picker-kind '+(credit ? 'credit' : '')+'">'+(credit ? 'Credit' : 'Invoice')+'</span></span>',
        '  <span class="wl-picker-secondary"><strong>'+escapeHtml(row.transactionDate || 'No date')+'</strong><br><span class="wl-picker-meta">Due '+escapeHtml(row.dueDate || '—')+'</span></span>',
        '  <span class="wl-picker-secondary"><strong>'+escapeHtml(row.job && row.job !== '-' ? row.job : 'No job')+'</strong><br><span class="wl-picker-meta">'+escapeHtml(row.reference || row.branch || '—')+'</span></span>',
        '  <span class="wl-picker-amount">'+(credit ? '−' : '')+formatMoney(amount)+'</span>',
        '  <button type="button" class="wl-flow-button wl-picker-document" data-wl-action="view-document" data-wl-document-key="'+escapeHtml(row.key)+'">View document</button>',
        '</div>'
      ].join('');
    }).join('');
    renderInvoiceSummary();
  }

  async function loadInvoiceRows() {
    if (invoicePickerState.loading || invoicePickerState.loaded) return;
    invoicePickerState.loading = true;
    invoicePickerState.rows = [];
    mergeTransactionRows(extractTransactionRows(document));
    seedInvoiceSelection();
    renderInvoiceRows();

    var queued = collectPaymentPageUrls(document);
    var visited = new Set([normalizePaymentPageUrl(window.location.href)]);
    var parser = new DOMParser();
    var requests = 0;

    try {
      while (queued.length && requests < 24) {
        var pageUrl = queued.shift();
        if (!pageUrl || visited.has(pageUrl)) continue;
        visited.add(pageUrl);
        requests += 1;
        var response = await fetch(pageUrl, { credentials: 'same-origin', cache: 'no-cache' });
        if (!response.ok) continue;
        var page = parser.parseFromString(await response.text(), 'text/html');
        mergeTransactionRows(extractTransactionRows(page));
        collectPaymentPageUrls(page).forEach(function (candidate) {
          if (!visited.has(candidate) && queued.indexOf(candidate) === -1) queued.push(candidate);
        });
        renderInvoiceRows();
      }
      invoicePickerState.loaded = true;
    } catch (error) {
      setPickerMessage('wl-invoice-message', 'Some older items could not be loaded. You can still select from the items shown.');
    }
    invoicePickerState.loading = false;
    renderInvoiceRows();
  }

  function dateSearchValue(value) {
    var match = String(value || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return '';
    return match[3]+'-'+String(match[1]).padStart(2, '0')+'-'+String(match[2]).padStart(2, '0');
  }

  function allowedDocumentUrl(href, credit) {
    try {
      var url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin || !/\/ProcessDocument\.aspx$/i.test(url.pathname)) return '';
      if (url.searchParams.get('documentType') !== (credit ? '7' : '6')) return '';
      return url.href;
    } catch (error) {}
    return '';
  }

  async function resolveTransactionDocument(row) {
    if (invoicePickerState.documentUrls.has(row.key)) return invoicePickerState.documentUrls.get(row.key);
    var credit = isCreditRow(row);
    var day = dateSearchValue(row.transactionDate);
    if (!day) throw new Error('Document date is unavailable.');

    var listUrl = new URL(credit ? 'CreditNotes_r.aspx' : 'Invoices_r.aspx', window.location.origin);
    listUrl.searchParams.set('searchType', credit ? 'CreditDate' : 'InvoiceDate');
    listUrl.searchParams.set('startDate', day+'T00:00:00');
    listUrl.searchParams.set('endDate', day+'T23:59:59');

    var response = await fetch(listUrl.href, { credentials: 'same-origin', cache: 'no-cache' });
    if (!response.ok) throw new Error('Document list is unavailable.');
    var parser = new DOMParser();
    var listPage = parser.parseFromString(await response.text(), 'text/html');
    var rows = Array.prototype.slice.call(listPage.querySelectorAll('tbody > tr'));
    var targetRow = rows.find(function (candidate) {
      var cell = candidate.querySelector(credit ? 'td[data-title="Credit Note #"]' : 'td[data-title="Invoice #"]');
      return cleanText(cell && cell.textContent).replace(/^(CN|CRN|CR)/i, '') === row.doc.replace(/^(CN|CRN|CR)/i, '');
    });
    if (!targetRow) throw new Error('Document was not found.');

    var detailsAnchor = targetRow.querySelector(credit
      ? 'a[href*="CreditNoteDetails_r.aspx"],a[href*="CreditNotes_r.aspx"][href*="oid="]'
      : 'a[href*="InvoiceDetails_r.aspx"]');
    var detailsHref = detailsAnchor && detailsAnchor.getAttribute('href');
    if (!detailsHref && credit) {
      var creditId = targetRow.querySelector('[creditnoteid]');
      if (creditId) detailsHref = 'CreditNoteDetails_r.aspx?id='+encodeURIComponent(creditId.getAttribute('creditnoteid'));
    }
    if (!detailsHref) throw new Error('Document details are unavailable.');

    var detailsUrl = new URL(detailsHref, window.location.origin);
    if (detailsUrl.origin !== window.location.origin) throw new Error('Document link is invalid.');
    var detailsResponse = await fetch(detailsUrl.href, { credentials: 'same-origin', cache: 'no-cache' });
    if (!detailsResponse.ok) throw new Error('Document details are unavailable.');
    var detailsPage = parser.parseFromString(await detailsResponse.text(), 'text/html');
    var documentAnchor = detailsPage.querySelector('a[href*="ProcessDocument.aspx"][href*="documentType='+(credit ? '7' : '6')+'"]');
    var documentUrl = allowedDocumentUrl(documentAnchor && documentAnchor.getAttribute('href'), credit);
    if (!documentUrl) throw new Error('The downloadable document is unavailable.');
    invoicePickerState.documentUrls.set(row.key, documentUrl);
    return documentUrl;
  }

  async function openTransactionDocument(button) {
    var key = button && button.getAttribute('data-wl-document-key');
    var row = invoicePickerState.rows.find(function (candidate) { return candidate.key === key; });
    if (!button || !row) return;
    var original = button.textContent;
    var viewer = null;
    try {
      viewer = window.open('about:blank', '_blank');
      if (viewer && viewer.document && viewer.document.body) viewer.document.body.textContent = 'Loading document…';
    } catch (error) {}

    button.disabled = true;
    button.textContent = 'Loading…';
    setPickerMessage('wl-invoice-message', '');
    try {
      var documentUrl = await resolveTransactionDocument(row);
      if (viewer && !viewer.closed) viewer.location.replace(documentUrl);
      else window.open(documentUrl, '_blank', 'noopener');
      button.textContent = 'View document';
    } catch (error) {
      if (viewer && !viewer.closed) viewer.close();
      button.textContent = original;
      setPickerMessage('wl-invoice-message', 'That document could not be loaded. You can still select it for payment.');
    }
    button.disabled = false;
  }

  function setRemittance(value) {
    var remittance = byId(IDS.remittance);
    if (!remittance) return;
    document.querySelectorAll('#'+IDS.transactions+' input[type="checkbox"][id*="chkSelect"]:not([id*="SelectAll"])').forEach(function (checkbox) {
      checkbox.checked = false;
    });
    remittance.value = value || '';
    remittance.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function applyPaymentSelection(amount, remittance) {
    var billing = byId(IDS.billing);
    if (billing) writeBillingDraft(billing.value);
    setRemittance(remittance);
    closePickerDialog();
    setAmount(amount);
  }

  function commitInvoiceSelection() {
    var rows = selectedInvoiceRows();
    var total = selectedInvoiceTotal();
    if (!rows.length) {
      setPickerMessage('wl-invoice-message', 'Select at least one invoice or credit.');
      return;
    }
    if (!(total > 0)) {
      setPickerMessage('wl-invoice-message', 'The selected invoices must be greater than the selected credits.');
      return;
    }

    var tokens = rows.map(function (row) {
      if (isCreditRow(row)) return 'CN'+row.doc.replace(/^(CN|CRN|CR)/i, '');
      return row.doc+'$'+Math.abs(parseMoney(row.outstanding || row.amount)).toFixed(2);
    });
    jobPickerState.selected.clear();
    applyPaymentSelection(total, tokens.join(','));
  }

  function renderJobSummary() {
    var summary = byId('wl-job-summary');
    if (!summary) return;
    var total = Array.from(jobPickerState.selected.values()).reduce(function (sum, amount) { return sum + amount; }, 0);
    summary.textContent = jobPickerState.selected.size+' selected · '+formatMoney(total);
  }

  function renderJobRows() {
    var list = byId('wl-job-list');
    if (!list) return;
    var query = cleanText(byId('wl-job-filter') && byId('wl-job-filter').value).toLowerCase();
    var rows = jobPickerState.rows.filter(function (row) {
      return !query || row.job.toLowerCase().indexOf(query) !== -1;
    });
    if (!rows.length) {
      list.innerHTML = '<p class="wl-picker-empty">'+(jobPickerState.loading ? 'Loading job balances…' : 'No matching job balances found.')+'</p>';
      renderJobSummary();
      return;
    }
    list.innerHTML = rows.map(function (row) {
      return [
        '<label class="wl-picker-row wl-job-row">',
        '  <input type="checkbox" data-wl-select-job="'+escapeHtml(row.job)+'" '+(jobPickerState.selected.has(row.job) ? 'checked' : '')+'>',
        '  <span><strong>'+escapeHtml(row.job)+'</strong><br><span class="wl-picker-meta">Pay this job balance</span></span>',
        '  <span class="wl-picker-amount">'+formatMoney(row.amount)+'</span>',
        '</label>'
      ].join('');
    }).join('');
    renderJobSummary();
  }

  async function loadJobRows() {
    if (jobPickerState.loading || jobPickerState.loaded) return;
    jobPickerState.loading = true;
    renderJobRows();
    try {
      var response = await fetch('JobBalances_R.aspx', { credentials: 'same-origin', cache: 'no-cache' });
      if (!response.ok) throw new Error('Job balances are unavailable.');
      var page = new DOMParser().parseFromString(await response.text(), 'text/html');
      jobPickerState.rows = Array.prototype.map.call(page.querySelectorAll('table tr'), function (row) {
        var job = transactionCell(row, ['Job']);
        var amount = parseMoney(transactionCell(row, ['Net Amount']));
        return job && amount > 0 ? { job: job, amount: amount } : null;
      }).filter(Boolean);
      var existingRemittance = cleanText(byId(IDS.remittance) && byId(IDS.remittance).value);
      jobPickerState.rows.forEach(function (row) {
        if (existingRemittance.indexOf(row.job+' - $') !== -1) jobPickerState.selected.set(row.job, row.amount);
      });
      jobPickerState.loaded = true;
    } catch (error) {
      setPickerMessage('wl-job-message', 'Job balances could not be loaded. Please try again.');
    }
    jobPickerState.loading = false;
    renderJobRows();
  }

  function commitJobSelection() {
    if (!jobPickerState.selected.size) {
      setPickerMessage('wl-job-message', 'Select at least one job.');
      return;
    }
    var total = Array.from(jobPickerState.selected.values()).reduce(function (sum, amount) { return sum + amount; }, 0);
    var date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    var tokens = Array.from(jobPickerState.selected.entries()).map(function (entry) {
      return entry[0].replace(/[\r\n,]+/g, ' ').trim()+' - $'+entry[1].toFixed(2)+' balance as of '+date;
    });
    invoicePickerState.selected.clear();
    applyPaymentSelection(total, tokens.join(', '));
  }

  function closePickerDialog() {
    ['wl-invoice-dialog', 'wl-job-dialog'].forEach(function (id) {
      var dialog = byId(id);
      if (dialog) dialog.hidden = true;
    });
    if (document.body) document.body.classList.remove('wl-payment-dialog-open');
  }

  function openPickerDialog(id) {
    var dialog = byId(id);
    if (!dialog) return;
    dialog.hidden = false;
    document.body.classList.add('wl-payment-dialog-open');
    setPickerMessage(id === 'wl-job-dialog' ? 'wl-job-message' : 'wl-invoice-message', '');
    if (id === 'wl-job-dialog') {
      renderJobRows();
      loadJobRows();
      var jobFilter = byId('wl-job-filter');
      if (jobFilter) jobFilter.focus({ preventScroll: true });
      return;
    }
    seedInvoiceSelection();
    renderInvoiceRows();
    loadInvoiceRows();
    var invoiceFilter = byId('wl-invoice-filter');
    if (invoiceFilter) invoiceFilter.focus({ preventScroll: true });
  }

  function ensurePickerDialogs(cashAccount) {
    var panel = byId(IDS.transactions);
    if (!panel || cashAccount) return;
    panel.classList.add('wl-payment-invoice-panel');

    var form = document.getElementById('aspnetForm') || document.querySelector('form') || document.body;
    if (!byId('wl-invoice-dialog')) {
      var invoiceDialog = document.createElement('div');
      invoiceDialog.id = 'wl-invoice-dialog';
      invoiceDialog.className = 'wl-picker-dialog';
      invoiceDialog.hidden = true;
      invoiceDialog.setAttribute('role', 'dialog');
      invoiceDialog.setAttribute('aria-modal', 'true');
      invoiceDialog.setAttribute('aria-labelledby', 'wl-invoice-dialog-title');
      invoiceDialog.innerHTML = [
        '<div class="wl-picker-card">',
        '  <div class="wl-picker-header"><h2 id="wl-invoice-dialog-title">Pay selected invoices</h2><div class="wl-picker-header-actions"><button type="button" class="wl-flow-button" data-wl-action="select-all-invoices">Select all</button><button type="button" class="wl-flow-button" data-wl-action="clear-invoices">Clear</button><button type="button" class="wl-flow-button" data-wl-action="close-picker" aria-label="Close invoice selection">Close</button></div></div>',
        '  <div class="wl-picker-tools"><input id="wl-invoice-filter" class="wl-picker-search" type="search" placeholder="Search invoice, credit, job, reference, or date" aria-label="Search invoices and credits"><span id="wl-invoice-summary" class="wl-picker-summary">0 selected · $0.00</span></div>',
        '  <div class="wl-picker-body"><div id="wl-invoice-list" class="wl-picker-list"></div></div>',
        '  <p id="wl-invoice-message" class="wl-picker-message" aria-live="polite"></p>',
        '  <div class="wl-picker-footer"><span class="wl-picker-meta">Credits reduce the selected payment.</span><div class="wl-picker-footer-actions"><button type="button" class="wl-flow-button" data-wl-action="close-picker">Cancel</button><button type="button" class="wl-flow-button primary" data-wl-action="use-invoices">Use selected items</button></div></div>',
        '</div>'
      ].join('');
      form.appendChild(invoiceDialog);
    }

    if (!byId('wl-job-dialog')) {
      var jobDialog = document.createElement('div');
      jobDialog.id = 'wl-job-dialog';
      jobDialog.className = 'wl-picker-dialog';
      jobDialog.hidden = true;
      jobDialog.setAttribute('role', 'dialog');
      jobDialog.setAttribute('aria-modal', 'true');
      jobDialog.setAttribute('aria-labelledby', 'wl-job-dialog-title');
      jobDialog.innerHTML = [
        '<div class="wl-picker-card">',
        '  <div class="wl-picker-header"><h2 id="wl-job-dialog-title">Pay by job</h2><div class="wl-picker-header-actions"><button type="button" class="wl-flow-button" data-wl-action="select-all-jobs">Select all</button><button type="button" class="wl-flow-button" data-wl-action="clear-jobs">Clear</button><button type="button" class="wl-flow-button" data-wl-action="close-picker" aria-label="Close job selection">Close</button></div></div>',
        '  <div class="wl-picker-tools"><input id="wl-job-filter" class="wl-picker-search" type="search" placeholder="Search jobs" aria-label="Search job balances"><span id="wl-job-summary" class="wl-picker-summary">0 selected · $0.00</span></div>',
        '  <div class="wl-picker-body"><div id="wl-job-list" class="wl-picker-list"></div></div>',
        '  <p id="wl-job-message" class="wl-picker-message" aria-live="polite"></p>',
        '  <div class="wl-picker-footer"><span class="wl-picker-meta">Choose one or more job balances.</span><div class="wl-picker-footer-actions"><button type="button" class="wl-flow-button" data-wl-action="close-picker">Cancel</button><button type="button" class="wl-flow-button primary" data-wl-action="use-jobs">Use selected jobs</button></div></div>',
        '</div>'
      ].join('');
      form.appendChild(jobDialog);
    }
  }

  function ensureWorkspace(parts) {
    var workspace = byId('wl-payment-workspace');
    if (!workspace) {
      workspace = document.createElement('div');
      workspace.id = 'wl-payment-workspace';
      workspace.innerHTML = '<section id="wl-payment-left" class="wl-workspace-column"></section><section id="wl-payment-right" class="wl-workspace-column"></section>';
      var reference = parts.amountHeading || parts.amountGroup || parts.billingGroup || parts.submitPanel;
      insertBefore(reference, workspace);
    }

    var left = byId('wl-payment-left');
    var right = byId('wl-payment-right');
    if (!left || !right) return workspace;

    if (parts.amountHeading) left.appendChild(parts.amountHeading);
    if (parts.balanceSummary) left.appendChild(parts.balanceSummary);
    if (parts.amountChoices) left.appendChild(parts.amountChoices);
    if (parts.billingHeading) left.appendChild(parts.billingHeading);

    var billingGrid = byId('wl-payment-billing-grid');
    if (!billingGrid) {
      billingGrid = document.createElement('div');
      billingGrid.id = 'wl-payment-billing-grid';
    }
    left.appendChild(billingGrid);
    [parts.addressGroup, parts.billingGroup, parts.postalGroup, parts.emailGroup]
      .forEach(function (node) { if (node) billingGrid.appendChild(node); });
    if (parts.remittanceGroup) left.appendChild(parts.remittanceGroup);
    [parts.amountGroup, parts.methodHeading, parts.methodSection, parts.notesGroup, parts.submitPanel]
      .forEach(function (node) { if (node) right.appendChild(node); });
    return workspace;
  }

  function enhanceMethods(cashAccount) {
    var firstGroup = null;
    METHOD_IDS.forEach(function (id) {
      var radio = byId(id);
      if (!radio) return;
      var group = radio.closest('.radiobutton') || closestGroup(radio);
      if (!group) return;
      if (!firstGroup) firstGroup = group;
      group.classList.add('wl-payment-method');
      var cardMethod = id === IDS.payByCard || id === IDS.payBySavedCard;
      group.classList.toggle('wl-payment-card-method', cardMethod);
      if (!cashAccount && cardMethod) {
        radio.checked = false;
        radio.disabled = true;
        group.hidden = true;
        group.setAttribute('aria-hidden', 'true');
      }
    });

    if (!cashAccount) {
      var bank = byId(IDS.payByBank) || byId(IDS.payBySavedBank);
      if (bank) {
        bank.disabled = false;
        bank.checked = true;
        var bankLabel = document.querySelector('label[for="'+bank.id+'"]');
        if (bankLabel) bankLabel.textContent = 'Bank account (ACH/eCheck)';
      }
    }
    return firstGroup;
  }

  var ACH_ROUTE_KEY = 'wl_payment_ach_route_v1_'+String(window.__WL_PAYMENT_PREVIEW_ACCOUNT_ID__ || 'preview').replace(/[^A-Z0-9_-]/gi, '');

  function ensureChargeAchRoute(cashAccount, methodSection) {
    var note = byId('wl-ach-route-note');
    if (cashAccount) {
      if (note) note.remove();
      return;
    }

    if (!note) {
      note = document.createElement('p');
      note.id = 'wl-ach-route-note';
      (methodSection || closestGroup(byId(IDS.payByBank)) || byId(IDS.submitAltPanel) || byId(IDS.submitPanel)).appendChild(note);
    }

    if (byId(IDS.submitAlt)) {
      note.textContent = 'Charge-account payments use secure ACH/eCheck through Forte.';
      try { sessionStorage.removeItem(ACH_ROUTE_KEY); } catch (error) {}
      return;
    }

    note.textContent = 'Preparing secure ACH/eCheck payment…';
    var searchType = byId('ctl00_PageBody_SearchType');
    if (!searchType) return;
    var lastRequest = 0;
    try { lastRequest = Number(sessionStorage.getItem(ACH_ROUTE_KEY) || 0); } catch (error) {}
    if (Date.now() - lastRequest < 10000) return;
    try { sessionStorage.setItem(ACH_ROUTE_KEY, String(Date.now())); } catch (error) {}
    searchType.value = 'JobReference';
    searchType.dispatchEvent(new Event('change', { bubbles: true }));
    if (byId(IDS.submitAlt)) {
      note.textContent = 'Charge-account payments use secure ACH/eCheck through Forte.';
      try { sessionStorage.removeItem(ACH_ROUTE_KEY); } catch (error) {}
      ensureReview(false);
    }
  }

  function selectedMethodText() {
    var checked = null;
    METHOD_IDS.some(function (id) {
      var radio = byId(id);
      if (radio && radio.checked) {
        checked = radio;
        return true;
      }
      return false;
    });

    if (!checked) return 'Choose a payment method';
    if (document.body && document.body.classList.contains('wl-payment-charge')) return 'Bank account (ACH/eCheck)';
    var label = document.querySelector('label[for="'+checked.id+'"]');
    var source = label || checked.closest('.radiobutton') || checked.parentElement;
    return cleanText(source && source.textContent) || 'Selected';
  }

  function selectedInvoiceCount() {
    var count = document.querySelectorAll('#'+IDS.transactions+' input[type="checkbox"][id*="chkSelect"]:checked:not([id*="SelectAll"])').length;
    if (count) return count;
    var remittance = cleanText(byId(IDS.remittance) && byId(IDS.remittance).value);
    if (!remittance || /balance as of|^STATEMENT/i.test(remittance)) return 0;
    return remittance.split(/\s*,\s*/).filter(Boolean).length;
  }

  function paymentSelectionSummary() {
    var remittance = cleanText(byId(IDS.remittance) && byId(IDS.remittance).value);
    var jobCount = (remittance.match(/balance as of/gi) || []).length;
    if (jobCount) return jobCount+' selected job balance'+(jobCount === 1 ? '' : 's');
    if (/^STATEMENT/i.test(remittance)) return 'Last statement';
    var count = selectedInvoiceCount();
    if (count) return count+' selected invoice'+(count === 1 ? '' : 's')+(remittance.indexOf('CN') !== -1 ? ' / credit' : '');
    return 'Account balance';
  }

  function billingStatus() {
    var postalField = byId(IDS.postal) || byId(IDS.postalAlt);
    var address = cleanText(byId(IDS.billing) && byId(IDS.billing).value);
    var postal = cleanText(postalField && postalField.value);
    var email = cleanText(byId(IDS.email) && byId(IDS.email).value);
    return address && postal && email ? 'Billing details entered' : 'Complete the billing fields above';
  }

  function ensureReview(cashAccount) {
    var panel = cashAccount
      ? (byId(IDS.submitPanel) || byId(IDS.submitAltPanel))
      : (byId(IDS.submitAltPanel) || byId(IDS.submitPanel));
    if (!panel) return;
    panel.classList.add('wl-payment-submit-section');

    var review = byId('wl-payment-review');
    if (!review) {
      review = document.createElement('section');
      review.id = 'wl-payment-review';
      review.setAttribute('aria-labelledby', 'wl-payment-review-title');
      review.setAttribute('aria-live', 'polite');
      panel.insertBefore(review, panel.firstChild);
    }

    var amount = parseMoney(byId(IDS.amount) && byId(IDS.amount).value);
    review.innerHTML = [
      '<h2 id="wl-payment-review-title">Review</h2>',
      '<dl>',
      '<dt>'+(cashAccount ? 'Amount to add' : 'Payment amount')+'</dt><dd>'+(amount > 0 ? formatMoney(amount) : 'Enter an amount')+'</dd>',
      cashAccount ? '' : '<dt>Payment applies to</dt><dd>'+paymentSelectionSummary()+'</dd>',
      '<dt>Payment method</dt><dd>'+selectedMethodText()+'</dd>',
      '<dt>Billing</dt><dd>'+billingStatus()+'</dd>',
      '</dl>',
      '<p class="wl-review-help">You will confirm before payment is submitted.</p>'
    ].join('');

    var nativeSubmit = cashAccount
      ? (byId(IDS.submit) || byId(IDS.submitAlt))
      : (byId(IDS.submitAlt) || byId(IDS.submit));
    if (nativeSubmit) {
      var buttonText = cashAccount ? 'Continue to add funds' : 'Continue to secure payment';
      if (nativeSubmit.tagName === 'INPUT') nativeSubmit.value = buttonText;
      else nativeSubmit.textContent = buttonText;
      nativeSubmit.setAttribute('data-wl-native-payment-control', 'true');
    }

    var note = byId('wl-payment-native-note');
    if (!note) {
      note = document.createElement('p');
      note.id = 'wl-payment-native-note';
      panel.appendChild(note);
    }
    note.textContent = cashAccount
      ? 'Continue to the secure confirmation screen.'
      : 'Continue to secure ACH/eCheck through Forte.';
  }

  function wirePageEvents() {
    if (document.documentElement.getAttribute('data-wl-payment-events') === VERSION) return;
    document.documentElement.setAttribute('data-wl-payment-events', VERSION);

    document.addEventListener('click', function (event) {
      var nativeSubmit = event.target.closest && event.target.closest('#'+IDS.submit+',#'+IDS.submitAlt);
      if (nativeSubmit && document.body) document.body.classList.add('wl-payment-validation-requested');
    }, true);

    document.addEventListener('click', function (event) {
      var actionButton = event.target.closest && event.target.closest('[data-wl-action]');
      if (!actionButton) return;

      var action = actionButton.getAttribute('data-wl-action');
      if (action === 'focus-amount') {
        setRemittance('');
        invoicePickerState.selected.clear();
        jobPickerState.selected.clear();
        var amount = byId(IDS.amount);
        if (amount) {
          amount.focus();
          if (typeof amount.select === 'function') amount.select();
        }
      }

      if (action === 'pay-balance') {
        var dueField = byId(IDS.amountDue);
        var due = parseMoney(dueField && (dueField.value || dueField.textContent));
        setRemittance('');
        invoicePickerState.selected.clear();
        jobPickerState.selected.clear();
        setAmount(due);
      }

      if (action === 'pay-statement') {
        var statement = statementAmount();
        setRemittance('STATEMENT - $'+Number(statement || 0).toFixed(2));
        invoicePickerState.selected.clear();
        jobPickerState.selected.clear();
        setAmount(statement);
      }

      if (action === 'choose-invoices') {
        openPickerDialog('wl-invoice-dialog');
      }

      if (action === 'choose-job') {
        openPickerDialog('wl-job-dialog');
      }

      if (action === 'close-picker') {
        closePickerDialog();
      }

      if (action === 'clear-invoices') {
        invoicePickerState.selected.clear();
        renderInvoiceRows();
        setPickerMessage('wl-invoice-message', '');
      }

      if (action === 'select-all-invoices') {
        invoicePickerState.rows.forEach(function (row) { invoicePickerState.selected.set(row.key, true); });
        renderInvoiceRows();
      }

      if (action === 'use-invoices') {
        commitInvoiceSelection();
      }

      if (action === 'clear-jobs') {
        jobPickerState.selected.clear();
        renderJobRows();
        setPickerMessage('wl-job-message', '');
      }

      if (action === 'select-all-jobs') {
        jobPickerState.rows.forEach(function (row) { jobPickerState.selected.set(row.job, row.amount); });
        renderJobRows();
      }

      if (action === 'use-jobs') {
        commitJobSelection();
      }

      if (action === 'view-document') {
        openTransactionDocument(actionButton);
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && document.querySelector('.wl-picker-dialog:not([hidden])')) {
        closePickerDialog();
      }
    });

    document.addEventListener('input', function (event) {
      if (event.target && event.target.id === 'wl-invoice-filter') renderInvoiceRows();
      if (event.target && event.target.id === 'wl-job-filter') renderJobRows();
    });

    document.addEventListener('change', function (event) {
      var invoiceKey = event.target && event.target.getAttribute('data-wl-select-invoice');
      if (invoiceKey) {
        if (event.target.checked) invoicePickerState.selected.set(invoiceKey, true);
        else invoicePickerState.selected.delete(invoiceKey);
        renderInvoiceSummary();
      }

      var jobName = event.target && event.target.getAttribute('data-wl-select-job');
      if (jobName) {
        var job = jobPickerState.rows.find(function (row) { return row.job === jobName; });
        if (event.target.checked && job) jobPickerState.selected.set(jobName, job.amount);
        else jobPickerState.selected.delete(jobName);
        renderJobSummary();
      }
    });

    document.addEventListener('input', scheduleReview);
    document.addEventListener('change', scheduleReview);
  }

  var reviewTimer = 0;
  function scheduleReview() {
    window.clearTimeout(reviewTimer);
    reviewTimer = window.setTimeout(function () {
      ensureReview(isCashAccount());
    }, 40);
  }

  function enhanceSuccessView() {
    document.body.classList.add('wl-payment-success');
    try { sessionStorage.removeItem(BILLING_DRAFT_KEY); } catch (error) {}
    var guide = byId('wl-payment-guide');
    if (guide) guide.remove();
  }

  function enhance() {
    if (!document.body) return false;
    if (isSuccessView()) {
      enhanceSuccessView();
      return true;
    }

    var amountInput = byId(IDS.amount);
    var submitPanel = byId(IDS.submitPanel) || byId(IDS.submitAltPanel);
    if (!amountInput && !submitPanel) return false;

    var cashAccount = isCashAccount();
    document.body.classList.add('wl-payment-flow-ready');
    document.body.classList.toggle('wl-payment-cash', cashAccount);
    document.body.classList.toggle('wl-payment-charge', !cashAccount);
    document.body.setAttribute('data-wl-payment-flow-version', VERSION);

    ensureStyles();
    ensureGuide(cashAccount);
    ensureBillingControl();

    var address = enhanceField(
      IDS.address,
      'wl-payment-address-field',
      '',
      '',
      {}
    );
    var billing = enhanceField(
      IDS.billing,
      'wl-payment-billing-field',
      '',
      '',
      { autocomplete: 'street-address' }
    );
    var postal = enhanceField(
      byId(IDS.postal) ? IDS.postal : IDS.postalAlt,
      'wl-payment-postal-field',
      '',
      '',
      { autocomplete: 'postal-code', inputmode: 'numeric' }
    );
    var email = enhanceField(
      IDS.email,
      'wl-payment-email-field',
      '',
      '',
      { autocomplete: 'email', inputmode: 'email' }
    );

    var amount = enhanceField(
      IDS.amount,
      'wl-payment-amount-field',
      '',
      '',
      { inputmode: 'decimal', autocomplete: 'off' }
    );
    var amountDue = enhanceField(
      IDS.amountDue,
      'wl-payment-balance-field',
      '',
      '',
      {}
    );

    var notes = enhanceField(
      IDS.notes,
      'wl-payment-notes-field',
      '',
      '',
      {}
    );
    var remittance = null;
    if (!cashAccount) {
      remittance = enhanceField(
        IDS.remittance,
        'wl-payment-remittance-field',
        '',
        '',
        {}
      );
      if (remittance && remittance.group) remittance.group.setAttribute('aria-hidden', 'true');
    }

    [billing, postal, email].forEach(function (field) {
      stabilizeNativeTextField(field && field.control);
    });

    var billingHeading = ensureSectionHeading(
      (address && address.group) || (billing && billing.group),
      'wl-payment-billing-heading',
      '',
      'Billing information',
      ''
    );
    var amountHeading = ensureSectionHeading(
      (amountDue && amountDue.group) || (amount && amount.group),
      'wl-payment-amount-heading',
      '',
      cashAccount ? 'Choose amount' : 'Choose what to pay',
      ''
    );
    var balanceSummary = ensureBalanceSummary(cashAccount, amountHeading);
    ensureAmountChoices(cashAccount, amount && amount.group);
    ensurePickerDialogs(cashAccount);

    var firstMethodGroup = enhanceMethods(cashAccount);
    var methodSection = firstMethodGroup && (firstMethodGroup.closest('.epi-form-group-acctPayment') || firstMethodGroup.parentElement);
    if (methodSection) methodSection.classList.add('wl-payment-method-section');
    var methodHeading = ensureSectionHeading(
      methodSection || firstMethodGroup,
      'wl-payment-method-heading',
      '',
      'Payment method',
      ''
    );

    var staleReviewHeading = byId('wl-payment-review-heading');
    if (staleReviewHeading) staleReviewHeading.remove();
    ensureReview(cashAccount);
    submitPanel = cashAccount
      ? (byId(IDS.submitPanel) || byId(IDS.submitAltPanel))
      : (byId(IDS.submitAltPanel) || byId(IDS.submitPanel));
    ensureWorkspace({
      amountHeading: amountHeading,
      balanceSummary: balanceSummary,
      amountChoices: byId('wl-payment-amount-choices'),
      amountGroup: amount && amount.group,
      billingHeading: billingHeading,
      addressGroup: address && address.group,
      billingGroup: billing && billing.group,
      postalGroup: postal && postal.group,
      emailGroup: email && email.group,
      notesGroup: notes && notes.group,
      remittanceGroup: remittance && remittance.group,
      methodHeading: methodHeading,
      methodSection: methodSection,
      submitPanel: submitPanel
    });
    wirePageEvents();
    ensureChargeAchRoute(cashAccount, methodSection);
    return true;
  }

  function bindWebFormsUpdates() {
    try {
      if (!window.Sys || !Sys.WebForms || !Sys.WebForms.PageRequestManager) return;
      var manager = Sys.WebForms.PageRequestManager.getInstance();
      if (!manager || manager.__wlPaymentFlowBound) return;
      manager.add_endRequest(function () {
        window.setTimeout(enhance, 0);
      });
      manager.__wlPaymentFlowBound = true;
    } catch (error) {}
  }

  function boot() {
    var attempts = 0;
    var timer = window.setInterval(function () {
      attempts += 1;
      if (enhance() || attempts >= 40) window.clearInterval(timer);
    }, 100);
    bindWebFormsUpdates();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
