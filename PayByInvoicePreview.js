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

  var VERSION = 'v2-preview-3';
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
    submit: 'ctl00_PageBody_MakePayment'
  };

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

  function ensureStyles() {
    if (byId('wl-payment-flow-styles')) return;

    var style = document.createElement('style');
    style.id = 'wl-payment-flow-styles';
    style.textContent = [
      'body.wl-payment-flow-ready{--wl-wine:#720018;--wl-wine-dark:#540012;--wl-ink:#1f2937;--wl-muted:#5f6773;--wl-line:#dfe3e8;--wl-soft:#f6f7f9;}',
      'body.wl-payment-flow-ready *{box-sizing:border-box;}',
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
      '#wl-payment-amount-topline{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;align-items:stretch;}',
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
      'body.wl-payment-flow-ready .wl-payment-field input:focus,body.wl-payment-flow-ready .wl-payment-field textarea:focus,body.wl-payment-flow-ready .wl-payment-field select:focus{outline:3px solid rgba(114,0,24,.18)!important;border-color:var(--wl-wine)!important;}',
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
      '#wl-payment-review{margin:10px 0;padding:12px;border:1px solid #d7e6dd;border-radius:10px;background:#f6fbf8;color:var(--wl-ink);font-family:Arial,Helvetica,sans-serif;}',
      '#wl-payment-review h2{margin:0 0 9px;font-size:18px;}',
      '#wl-payment-review dl{display:grid;grid-template-columns:minmax(108px,.65fr) minmax(0,1fr);gap:6px 9px;margin:0;font-size:13px;}',
      '#wl-payment-review dt{color:var(--wl-muted);font-weight:700;}',
      '#wl-payment-review dd{margin:0;font-weight:800;overflow-wrap:anywhere;}',
      '#wl-payment-review .wl-review-help{margin:9px 0 0;color:var(--wl-muted);font-size:12px;line-height:1.35;}',
      'body.wl-payment-flow-ready #'+IDS.submitPanel+'{width:100%;max-width:none;margin:0!important;padding:0!important;border:0!important;background:transparent!important;}',
      'body.wl-payment-flow-ready #'+IDS.submitPanel+' .epi-form-group-acctPayment{display:block!important;width:100%!important;margin:0!important;padding:0!important;background:transparent!important;}',
      'body.wl-payment-flow-ready #'+IDS.submitPanel+' .submit-button-panel{display:flex!important;justify-content:flex-start!important;width:100%!important;}',
      'body.wl-payment-flow-ready #'+IDS.submit+',body.wl-payment-flow-ready #'+IDS.submit+':visited{display:inline-flex!important;align-items:center;justify-content:center;width:100%!important;min-height:46px;padding:10px 16px!important;border:1px solid var(--wl-wine)!important;border-radius:8px!important;background:var(--wl-wine)!important;color:#fff!important;font-size:15px!important;font-weight:800!important;text-decoration:none!important;}',
      'body.wl-payment-flow-ready #'+IDS.submit+':hover{background:var(--wl-wine-dark)!important;}',
      'body.wl-payment-flow-ready #'+IDS.submit+':focus-visible{outline:3px solid rgba(114,0,24,.22)!important;outline-offset:3px;}',
      '#wl-payment-native-note{margin:7px 0 0;color:var(--wl-muted);font-size:12px;line-height:1.35;text-align:center;}',
      'body.wl-payment-dialog-open{overflow:hidden;}',
      '#wl-invoice-dialog[hidden]{display:none!important;}',
      '#wl-invoice-dialog{position:fixed;inset:0;z-index:10050;display:grid;place-items:center;padding:20px;background:rgba(17,24,39,.62);}',
      '#wl-invoice-dialog-card{display:flex;flex-direction:column;width:min(1180px,calc(100vw - 40px));max-height:calc(100vh - 40px);overflow:hidden;border-radius:14px;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.3);}',
      '#wl-invoice-dialog-header{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:13px 16px;border-bottom:1px solid var(--wl-line);}',
      '#wl-invoice-dialog-title{margin:0;font-size:21px;}',
      '#wl-invoice-dialog-body{min-height:0;padding:0 16px;overflow:auto;}',
      '#wl-invoice-dialog-footer{display:flex;justify-content:flex-end;padding:12px 16px;border-top:1px solid var(--wl-line);background:#fafafa;}',
      '#wl-payment-invoice-note{margin:14px 0 8px;padding:10px 12px;border-left:4px solid var(--wl-wine);border-radius:8px;background:#fff8f9;color:var(--wl-ink);font-size:13px;line-height:1.4;}',
      'body.wl-payment-flow-ready #'+IDS.transactions+'{display:block!important;width:100%;max-width:none;margin:0!important;padding:8px 0 14px!important;border:0!important;background:#fff;overflow-x:auto;}',
      'body.wl-payment-flow-ready #'+IDS.transactions+' table{width:100%!important;}',
      'body.wl-payment-flow-ready #'+IDS.transactions+' td,body.wl-payment-flow-ready #'+IDS.transactions+' th{padding:8px 7px!important;}',
      'body.wl-payment-flow-ready #'+IDS.transactions+' input[type="checkbox"]{width:20px;height:20px;accent-color:var(--wl-wine);}',
      '.wl-dialog-close{min-width:74px;}',
      '@media (max-width:900px){#wl-payment-guide .wl-guide-card{grid-template-columns:1fr;align-items:start;}#wl-payment-workspace{grid-template-columns:1fr;}#wl-payment-amount-choices .wl-choice-row{grid-template-columns:repeat(2,minmax(0,1fr));}}',
      '@media (max-width:620px){#wl-payment-guide{margin:8px auto 10px;}#wl-payment-guide .wl-guide-card{padding:11px 12px;}#wl-payment-guide .wl-guide-steps{grid-template-columns:1fr;}#wl-payment-workspace{gap:10px;}.wl-workspace-column{padding:11px;}body.wl-payment-flow-ready .wl-payment-card{grid-template-columns:1fr!important;gap:4px!important;}body.wl-payment-flow-ready .wl-payment-card>div:first-child,body.wl-payment-flow-ready .wl-payment-card>div:nth-child(2),body.wl-payment-flow-ready .wl-payment-card>.wl-field-help{grid-column:1;}#wl-payment-amount-topline,#wl-payment-billing-grid{grid-template-columns:1fr;}#wl-payment-amount-choices .wl-choice-row{grid-template-columns:1fr;}#wl-payment-review dl{grid-template-columns:1fr;gap:2px;}#wl-payment-review dd{margin-bottom:6px;}#wl-invoice-dialog{padding:8px;}#wl-invoice-dialog-card{width:calc(100vw - 16px);max-height:calc(100vh - 16px);}#wl-invoice-dialog-header,#wl-invoice-dialog-footer{padding:11px 12px;}#wl-invoice-dialog-body{padding:0 12px;}}'
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
      '    <li><a href="#'+IDS.submit+'"><span class="wl-step-number">3</span><span>Review</span></a></li>',
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
    input.focus();
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

  function dialogMode() {
    try {
      return new URL(window.location.href).searchParams.get('wl_invoice_mode') || '';
    } catch (error) {}
    return '';
  }

  function setDialogMode(mode) {
    try {
      var url = new URL(window.location.href);
      if (mode) url.searchParams.set('wl_invoice_mode', mode);
      else url.searchParams.delete('wl_invoice_mode');
      window.history.replaceState(window.history.state, document.title, url.href);
    } catch (error) {}
  }

  function closeInvoiceDialog() {
    var dialog = byId('wl-invoice-dialog');
    if (dialog) dialog.hidden = true;
    if (document.body) document.body.classList.remove('wl-payment-dialog-open');
    setDialogMode('');
  }

  function openInvoiceDialog(mode, selectJob) {
    var dialog = byId('wl-invoice-dialog');
    var panel = byId(IDS.transactions);
    if (!dialog || !panel) return;

    var title = byId('wl-invoice-dialog-title');
    var note = byId('wl-payment-invoice-note');
    var jobMode = mode === 'job';
    if (title) title.textContent = jobMode ? 'Pay invoices by job' : 'Select invoices to pay';
    if (note) note.innerHTML = jobMode
      ? '<strong>Search by job.</strong> Choose a job reference, then select the invoices you want to pay.'
      : '<strong>Select invoices to pay.</strong> Search or check the invoices you want included.';

    setDialogMode(jobMode ? 'job' : 'invoices');
    dialog.hidden = false;
    document.body.classList.add('wl-payment-dialog-open');

    if (jobMode) {
      var searchType = byId('ctl00_PageBody_SearchType');
      if (searchType && searchType.value !== 'JobReference' && selectJob) {
        searchType.value = 'JobReference';
        searchType.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
      if (searchType) searchType.focus({ preventScroll: true });
      return;
    }

    var firstCheckbox = panel.querySelector('input[type="checkbox"]');
    if (firstCheckbox) firstCheckbox.focus({ preventScroll: true });
  }

  function ensureInvoiceDialog(cashAccount) {
    var panel = byId(IDS.transactions);
    if (!panel || cashAccount) return null;
    panel.classList.add('wl-payment-invoice-panel');
    panel.hidden = false;

    var dialog = byId('wl-invoice-dialog');
    if (!dialog) {
      dialog = document.createElement('div');
      dialog.id = 'wl-invoice-dialog';
      dialog.hidden = true;
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'wl-invoice-dialog-title');
      dialog.innerHTML = [
        '<div id="wl-invoice-dialog-card">',
        '  <div id="wl-invoice-dialog-header">',
        '    <h2 id="wl-invoice-dialog-title">Select invoices to pay</h2>',
        '    <button type="button" class="wl-flow-button wl-dialog-close" data-wl-action="close-invoice-dialog" aria-label="Close invoice selection">Close</button>',
        '  </div>',
        '  <div id="wl-invoice-dialog-body"></div>',
        '  <div id="wl-invoice-dialog-footer"><button type="button" class="wl-flow-button primary" data-wl-action="close-invoice-dialog">Done</button></div>',
        '</div>'
      ].join('');
      var form = document.getElementById('aspnetForm') || document.querySelector('form') || document.body;
      form.appendChild(dialog);
    }

    var body = byId('wl-invoice-dialog-body');
    if (body && panel.parentNode !== body) body.appendChild(panel);

    var note = byId('wl-payment-invoice-note');
    if (!note) {
      note = document.createElement('div');
      note.id = 'wl-payment-invoice-note';
      panel.insertBefore(note, panel.firstChild);
    }

    var mode = dialogMode();
    if (mode === 'job' || mode === 'invoices') openInvoiceDialog(mode, false);
    return dialog;
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
    var amountTopline = byId('wl-payment-amount-topline');
    if (!amountTopline) {
      amountTopline = document.createElement('div');
      amountTopline.id = 'wl-payment-amount-topline';
    }
    left.appendChild(amountTopline);
    [parts.balanceSummary, parts.amountGroup].forEach(function (node) { if (node) amountTopline.appendChild(node); });
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
    [parts.methodHeading, parts.methodSection, parts.notesGroup, parts.submitPanel]
      .forEach(function (node) { if (node) right.appendChild(node); });
    return workspace;
  }

  function enhanceMethods() {
    var firstGroup = null;
    METHOD_IDS.forEach(function (id) {
      var radio = byId(id);
      if (!radio) return;
      var group = radio.closest('.radiobutton') || closestGroup(radio);
      if (!group) return;
      if (!firstGroup) firstGroup = group;
      group.classList.add('wl-payment-method');

    });
    return firstGroup;
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
    var label = document.querySelector('label[for="'+checked.id+'"]');
    var source = label || checked.closest('.radiobutton') || checked.parentElement;
    return cleanText(source && source.textContent) || 'Selected';
  }

  function selectedInvoiceCount() {
    return document.querySelectorAll('#'+IDS.transactions+' input[type="checkbox"][id*="chkSelect"]:checked:not([id*="SelectAll"])').length;
  }

  function billingStatus() {
    var postalField = byId(IDS.postal) || byId(IDS.postalAlt);
    var address = cleanText(byId(IDS.billing) && byId(IDS.billing).value);
    var postal = cleanText(postalField && postalField.value);
    var email = cleanText(byId(IDS.email) && byId(IDS.email).value);
    return address && postal && email ? 'Billing details entered' : 'Complete the billing fields above';
  }

  function ensureReview(cashAccount) {
    var panel = byId(IDS.submitPanel);
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
    var invoiceCount = selectedInvoiceCount();
    review.innerHTML = [
      '<h2 id="wl-payment-review-title">Review</h2>',
      '<dl>',
      '<dt>'+(cashAccount ? 'Amount to add' : 'Payment amount')+'</dt><dd>'+(amount > 0 ? formatMoney(amount) : 'Enter an amount')+'</dd>',
      cashAccount ? '' : '<dt>Invoices selected</dt><dd>'+(invoiceCount ? invoiceCount : 'None — payment applies to the account')+'</dd>',
      '<dt>Payment method</dt><dd>'+selectedMethodText()+'</dd>',
      '<dt>Billing</dt><dd>'+billingStatus()+'</dd>',
      '</dl>',
      '<p class="wl-review-help">You will confirm before payment is submitted.</p>'
    ].join('');

    var nativeSubmit = byId(IDS.submit);
    if (nativeSubmit) {
      nativeSubmit.textContent = cashAccount ? 'Continue to add funds' : 'Continue to secure payment';
      nativeSubmit.setAttribute('data-wl-native-payment-control', 'true');
    }

    var note = byId('wl-payment-native-note');
    if (!note) {
      note = document.createElement('p');
      note.id = 'wl-payment-native-note';
      panel.appendChild(note);
    }
    note.textContent = 'Continue to the secure confirmation screen.';
  }

  function wirePageEvents() {
    if (document.documentElement.getAttribute('data-wl-payment-events') === VERSION) return;
    document.documentElement.setAttribute('data-wl-payment-events', VERSION);

    document.addEventListener('click', function (event) {
      var actionButton = event.target.closest && event.target.closest('[data-wl-action]');
      if (!actionButton) return;

      var action = actionButton.getAttribute('data-wl-action');
      if (action === 'focus-amount') {
        var amount = byId(IDS.amount);
        if (amount) {
          amount.focus();
          if (typeof amount.select === 'function') amount.select();
        }
      }

      if (action === 'pay-balance') {
        var dueField = byId(IDS.amountDue);
        var due = parseMoney(dueField && (dueField.value || dueField.textContent));
        setAmount(due);
      }

      if (action === 'pay-statement') {
        setAmount(statementAmount());
      }

      if (action === 'choose-invoices') {
        openInvoiceDialog('invoices', false);
      }

      if (action === 'choose-job') {
        openInvoiceDialog('job', true);
      }

      if (action === 'close-invoice-dialog') {
        closeInvoiceDialog();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && byId('wl-invoice-dialog') && !byId('wl-invoice-dialog').hidden) {
        closeInvoiceDialog();
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
    var submitPanel = byId(IDS.submitPanel);
    if (!amountInput && !submitPanel) return false;

    var cashAccount = isCashAccount();
    document.body.classList.add('wl-payment-flow-ready');
    document.body.classList.toggle('wl-payment-cash', cashAccount);
    document.body.classList.toggle('wl-payment-charge', !cashAccount);
    document.body.setAttribute('data-wl-payment-flow-version', VERSION);

    ensureStyles();
    ensureGuide(cashAccount);

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

    [billing, postal, email, amount].forEach(function (field) {
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
      cashAccount ? 'Amount to add' : 'Payment amount',
      ''
    );
    var balanceSummary = ensureBalanceSummary(cashAccount, amountHeading);
    ensureAmountChoices(cashAccount, amount && amount.group);
    ensureInvoiceDialog(cashAccount);

    var firstMethodGroup = enhanceMethods();
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
