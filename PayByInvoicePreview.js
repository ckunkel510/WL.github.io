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

  var VERSION = 'v2-preview-1';
  var IDS = {
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
      '#wl-payment-guide{max-width:980px;margin:16px auto 22px;padding:0 4px;color:var(--wl-ink);font-family:Arial,Helvetica,sans-serif;}',
      '#wl-payment-guide .wl-guide-card{background:linear-gradient(135deg,#fff 0%,#f9f5f6 100%);border:1px solid #eadadd;border-left:6px solid var(--wl-wine);border-radius:14px;padding:20px;box-shadow:0 6px 22px rgba(31,41,55,.07);}',
      '#wl-payment-guide .wl-guide-kicker{margin:0 0 6px;color:var(--wl-wine);font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;}',
      '#wl-payment-guide h1{margin:0;color:#1b1d21;font-size:clamp(24px,4vw,34px);line-height:1.15;}',
      '#wl-payment-guide .wl-guide-copy{max-width:720px;margin:9px 0 0;color:var(--wl-muted);font-size:15px;line-height:1.5;}',
      '#wl-payment-guide .wl-guide-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:18px 0 0;padding:0;list-style:none;}',
      '#wl-payment-guide .wl-guide-steps a{display:flex;align-items:center;gap:8px;min-height:44px;padding:9px 10px;border:1px solid var(--wl-line);border-radius:10px;background:#fff;color:var(--wl-ink);font-size:13px;font-weight:700;text-decoration:none;}',
      '#wl-payment-guide .wl-step-number{display:inline-grid;place-items:center;flex:0 0 24px;width:24px;height:24px;border-radius:50%;background:var(--wl-wine);color:#fff;font-size:12px;}',
      '.wl-payment-section-heading{max-width:980px;margin:22px auto 10px;padding:0 4px;color:var(--wl-ink);font-family:Arial,Helvetica,sans-serif;}',
      '.wl-payment-section-heading .wl-section-kicker{margin:0 0 3px;color:var(--wl-wine);font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;}',
      '.wl-payment-section-heading h2{margin:0;font-size:21px;line-height:1.25;}',
      '.wl-payment-section-heading p{margin:5px 0 0;color:var(--wl-muted);font-size:14px;line-height:1.45;}',
      'body.wl-payment-flow-ready .wl-payment-card{max-width:980px;margin-left:auto!important;margin-right:auto!important;padding:16px!important;border:1px solid var(--wl-line)!important;border-radius:12px!important;background:#fff!important;box-shadow:0 3px 14px rgba(31,41,55,.05)!important;}',
      'body.wl-payment-flow-ready .wl-payment-balance-field{border-color:#d7e6dd!important;background:#f6fbf8!important;}',
      'body.wl-payment-flow-ready .wl-payment-field input[type="text"],body.wl-payment-flow-ready .wl-payment-field input[type="email"],body.wl-payment-flow-ready .wl-payment-field textarea,body.wl-payment-flow-ready .wl-payment-field select{width:100%!important;max-width:none!important;min-height:46px!important;padding:10px 12px!important;border:1px solid #aeb5bf!important;border-radius:8px!important;background:#fff!important;color:#111827!important;font-size:16px!important;}',
      'body.wl-payment-flow-ready .wl-payment-field textarea{min-height:92px!important;resize:vertical;}',
      'body.wl-payment-flow-ready .wl-payment-field input:focus,body.wl-payment-flow-ready .wl-payment-field textarea:focus,body.wl-payment-flow-ready .wl-payment-field select:focus{outline:3px solid rgba(114,0,24,.18)!important;border-color:var(--wl-wine)!important;}',
      '.wl-field-help{margin:7px 0 0;color:var(--wl-muted);font-size:13px;line-height:1.4;}',
      '#wl-payment-amount-choices{max-width:980px;margin:0 auto 10px;padding:14px;border:1px solid #eadadd;border-radius:12px;background:#fffafa;}',
      '#wl-payment-amount-choices .wl-choice-title{margin:0 0 9px;font-size:15px;font-weight:800;color:var(--wl-ink);}',
      '#wl-payment-amount-choices .wl-choice-row{display:flex;flex-wrap:wrap;gap:9px;}',
      '.wl-flow-button{min-height:44px;padding:9px 14px;border:1px solid #aeb5bf;border-radius:9px;background:#fff;color:var(--wl-ink);font-size:14px;font-weight:800;cursor:pointer;}',
      '.wl-flow-button:hover{border-color:var(--wl-wine);color:var(--wl-wine);}',
      '.wl-flow-button:focus-visible{outline:3px solid rgba(114,0,24,.2);outline-offset:2px;}',
      '.wl-flow-button.primary{border-color:var(--wl-wine);background:var(--wl-wine);color:#fff;}',
      '.wl-flow-button.primary:hover{background:var(--wl-wine-dark);color:#fff;}',
      '#wl-payment-invoice-note{margin:0 0 14px;padding:12px 14px;border-left:4px solid var(--wl-wine);border-radius:8px;background:#fff8f9;color:var(--wl-ink);font-size:14px;line-height:1.45;}',
      'body.wl-payment-flow-ready #'+IDS.transactions+'{max-width:980px;margin:12px auto!important;padding:16px!important;border:1px solid var(--wl-line);border-radius:12px;background:#fff;overflow-x:auto;}',
      'body.wl-payment-flow-ready #'+IDS.transactions+' table{width:100%!important;}',
      'body.wl-payment-flow-ready #'+IDS.transactions+' td,body.wl-payment-flow-ready #'+IDS.transactions+' th{padding:9px 8px!important;}',
      'body.wl-payment-flow-ready #'+IDS.transactions+' input[type="checkbox"]{width:20px;height:20px;accent-color:var(--wl-wine);}',
      'body.wl-payment-flow-ready .wl-payment-method{max-width:980px;margin:8px auto!important;padding:12px 14px!important;border:1px solid var(--wl-line)!important;border-radius:10px!important;background:#fff!important;}',
      'body.wl-payment-flow-ready .wl-payment-method:focus-within{border-color:var(--wl-wine)!important;box-shadow:0 0 0 3px rgba(114,0,24,.12);}',
      'body.wl-payment-flow-ready .wl-payment-method input[type="radio"]{width:20px;height:20px;margin-right:10px;accent-color:var(--wl-wine);}',
      '.wl-method-help{margin:7px 0 0 30px;color:var(--wl-muted);font-size:13px;line-height:1.4;}',
      '#wl-payment-review{margin:0 0 14px;padding:16px;border:1px solid #d7e6dd;border-radius:12px;background:#f6fbf8;color:var(--wl-ink);font-family:Arial,Helvetica,sans-serif;}',
      '#wl-payment-review h2{margin:0 0 12px;font-size:20px;}',
      '#wl-payment-review dl{display:grid;grid-template-columns:minmax(120px,.55fr) minmax(0,1fr);gap:8px 16px;margin:0;}',
      '#wl-payment-review dt{color:var(--wl-muted);font-weight:700;}',
      '#wl-payment-review dd{margin:0;font-weight:800;overflow-wrap:anywhere;}',
      '#wl-payment-review .wl-review-help{margin:12px 0 0;color:var(--wl-muted);font-size:13px;line-height:1.4;}',
      'body.wl-payment-flow-ready #'+IDS.submitPanel+'{max-width:980px;margin:22px auto!important;padding:16px!important;border:1px solid var(--wl-line);border-radius:12px;background:#fff;}',
      'body.wl-payment-flow-ready #'+IDS.submit+',body.wl-payment-flow-ready #'+IDS.submit+':visited{display:inline-flex!important;align-items:center;justify-content:center;min-height:48px;padding:11px 20px!important;border:1px solid var(--wl-wine)!important;border-radius:9px!important;background:var(--wl-wine)!important;color:#fff!important;font-size:16px!important;font-weight:800!important;text-decoration:none!important;}',
      'body.wl-payment-flow-ready #'+IDS.submit+':hover{background:var(--wl-wine-dark)!important;}',
      'body.wl-payment-flow-ready #'+IDS.submit+':focus-visible{outline:3px solid rgba(114,0,24,.22)!important;outline-offset:3px;}',
      '#wl-payment-native-note{margin:10px 0 0;color:var(--wl-muted);font-size:12px;line-height:1.4;}',
      '@media (max-width:760px){#wl-payment-guide .wl-guide-card{padding:16px;}#wl-payment-guide .wl-guide-steps{grid-template-columns:1fr 1fr;}body.wl-payment-flow-ready .wl-payment-card,body.wl-payment-flow-ready #'+IDS.transactions+',body.wl-payment-flow-ready #'+IDS.submitPanel+'{padding:13px!important;}#wl-payment-review dl{grid-template-columns:1fr;gap:2px;}#wl-payment-review dd{margin-bottom:8px;}}',
      '@media (max-width:420px){#wl-payment-guide .wl-guide-steps{grid-template-columns:1fr;}.wl-flow-button{width:100%;}body.wl-payment-flow-ready #'+IDS.submit+'{width:100%;}}'
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
    var copy = cashAccount
      ? 'Enter the amount you want to add, confirm your billing details, and choose a payment method. Everything stays on one page.'
      : 'Choose what you want to pay, confirm your billing details, and select a payment method. Everything stays on one page.';

    guide.innerHTML = [
      '<div class="wl-guide-card">',
      '  <p class="wl-guide-kicker">Secure account payment</p>',
      '  <h1 id="wl-payment-guide-title">'+title+'</h1>',
      '  <p class="wl-guide-copy">'+copy+'</p>',
      '  <ol class="wl-guide-steps">',
      '    <li><a href="#'+IDS.billing+'"><span class="wl-step-number">1</span><span>Payment details</span></a></li>',
      '    <li><a href="#'+IDS.payByBank+'"><span class="wl-step-number">2</span><span>Payment method</span></a></li>',
      '    <li><a href="#'+IDS.submit+'"><span class="wl-step-number">3</span><span>Review & continue</span></a></li>',
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
    heading.innerHTML = '<p class="wl-section-kicker">'+step+'</p><h2>'+title+'</h2><p>'+description+'</p>';
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

  function setAmount(value) {
    var input = byId(IDS.amount);
    if (!input || !(value > 0)) return;

    input.value = Number(value).toFixed(2);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.focus();
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
      choices.innerHTML = '<p class="wl-choice-title">Start with the amount you want to add.</p><div class="wl-choice-row"><button type="button" class="wl-flow-button primary" data-wl-action="focus-amount">Enter an amount</button></div>';
      return;
    }

    var dueField = byId(IDS.amountDue);
    var due = parseMoney(dueField && (dueField.value || dueField.textContent));
    choices.innerHTML = [
      '<p class="wl-choice-title">What would you like to pay?</p>',
      '<div class="wl-choice-row">',
      due > 0 ? '<button type="button" class="wl-flow-button primary" data-wl-action="pay-balance">Pay full balance '+formatMoney(due)+'</button>' : '',
      byId(IDS.transactions) ? '<button type="button" class="wl-flow-button" data-wl-action="choose-invoices">Choose specific invoices</button>' : '',
      '<button type="button" class="wl-flow-button" data-wl-action="focus-amount">Enter another amount</button>',
      '</div>'
    ].join('');
  }

  function ensureInvoiceGuidance(cashAccount) {
    var panel = byId(IDS.transactions);
    if (!panel || cashAccount) return;
    panel.classList.add('wl-payment-invoice-panel');

    var note = byId('wl-payment-invoice-note');
    if (!note) {
      note = document.createElement('div');
      note.id = 'wl-payment-invoice-note';
      panel.insertBefore(note, panel.firstChild);
    }
    note.innerHTML = '<strong>Paying selected invoices?</strong> Check the invoices below. WebTrack will keep the invoice selections attached to this payment.';
  }

  function methodHelpText(id) {
    if (id === IDS.payByBank) return 'Use a new bank account through the secure payment window.';
    if (id === IDS.payBySavedBank) return 'Use a bank account already saved to your Woodson account.';
    if (id === IDS.payByCard) return 'Use a new debit or credit card when card payments are available.';
    if (id === IDS.payBySavedCard) return 'Use a card already saved to your Woodson account.';
    return '';
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

      var helpId = 'wl-method-help-'+id;
      var help = byId(helpId);
      if (!help) {
        help = document.createElement('p');
        help.id = helpId;
        help.className = 'wl-method-help';
        group.appendChild(help);
      }
      help.textContent = methodHelpText(id);
      appendDescribedBy(radio, helpId);
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
      '<h2 id="wl-payment-review-title">Review before continuing</h2>',
      '<dl>',
      '<dt>'+(cashAccount ? 'Amount to add' : 'Payment amount')+'</dt><dd>'+(amount > 0 ? formatMoney(amount) : 'Enter an amount')+'</dd>',
      cashAccount ? '' : '<dt>Invoices selected</dt><dd>'+(invoiceCount ? invoiceCount : 'None — payment applies to the account')+'</dd>',
      '<dt>Payment method</dt><dd>'+selectedMethodText()+'</dd>',
      '<dt>Billing</dt><dd>'+billingStatus()+'</dd>',
      '</dl>',
      '<p class="wl-review-help">The next step opens Woodson\'s secure payment window. Your payment is not submitted until you confirm it there.</p>'
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
    note.textContent = 'Secure processing is handled by Woodson WebTrack. No payment is made by this page enhancement.';
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

      if (action === 'choose-invoices') {
        var panel = byId(IDS.transactions);
        if (panel) {
          panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
          var firstCheckbox = panel.querySelector('input[type="checkbox"]');
          if (firstCheckbox) firstCheckbox.focus({ preventScroll: true });
        }
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

    var billing = enhanceField(
      IDS.billing,
      'wl-payment-billing-field',
      'wl-billing-help',
      'Enter the billing street address associated with the bank account or card.',
      { autocomplete: 'street-address' }
    );
    enhanceField(
      byId(IDS.postal) ? IDS.postal : IDS.postalAlt,
      'wl-payment-postal-field',
      'wl-postal-help',
      'Use the billing ZIP code for the payment method.',
      { autocomplete: 'postal-code', inputmode: 'numeric' }
    );
    enhanceField(
      IDS.email,
      'wl-payment-email-field',
      'wl-email-help',
      'We will send the payment receipt to this address.',
      { autocomplete: 'email', inputmode: 'email' }
    );

    var amount = enhanceField(
      IDS.amount,
      'wl-payment-amount-field',
      'wl-amount-help',
      cashAccount ? 'Enter the dollar amount to add to this cash account.' : 'Enter an amount, pay the full balance, or select invoices below.',
      { inputmode: 'decimal', autocomplete: 'off' }
    );
    var amountDue = enhanceField(
      IDS.amountDue,
      'wl-payment-balance-field',
      '',
      '',
      {}
    );

    enhanceField(
      IDS.notes,
      'wl-payment-notes-field',
      'wl-notes-help',
      'Optional: add a short note for your records.',
      {}
    );
    if (!cashAccount) {
      enhanceField(
        IDS.remittance,
        'wl-payment-remittance-field',
        'wl-remittance-help',
        'Optional: enter invoice numbers separated by commas if you are not using the invoice checkboxes.',
        {}
      );
    }

    ensureSectionHeading(
      billing && billing.group,
      'wl-payment-billing-heading',
      'Step 1',
      'Confirm billing details',
      'These details are used to verify the payment method and deliver the receipt.'
    );
    ensureSectionHeading(
      (amountDue && amountDue.group) || (amount && amount.group),
      'wl-payment-amount-heading',
      'Payment details',
      cashAccount ? 'Enter the amount to add' : 'Choose what to pay',
      cashAccount ? 'This amount will be added to the cash account balance.' : 'Pay the account balance, selected invoices, or another amount.'
    );
    ensureAmountChoices(cashAccount, amount && amount.group);
    ensureInvoiceGuidance(cashAccount);

    var firstMethodGroup = enhanceMethods();
    ensureSectionHeading(
      firstMethodGroup,
      'wl-payment-method-heading',
      'Step 2',
      'Choose a payment method',
      'Select a new or saved payment method. WebTrack will load the secure fields it needs.'
    );

    ensureSectionHeading(
      submitPanel,
      'wl-payment-review-heading',
      'Step 3',
      'Review and continue',
      'Check the summary, then continue to Woodson\'s secure payment window.'
    );
    ensureReview(cashAccount);
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
