/*
 * Woodson order-confirmation enhancement
 * Page: ShoppingCart.aspx?success=1
 *
 * Presentation only:
 * - Keeps WebTrack's native success and merchant-detail elements in the DOM.
 * - Does not change order submission, payment, or purchase analytics behavior.
 * - Reuses native Done/Print controls through guarded proxy buttons.
 */
(function () {
  'use strict';

  if (window.__wlOrderConfirmationEnhancementLoaded) return;
  window.__wlOrderConfirmationEnhancementLoaded = true;

  var RESPONSE_ID = 'CartResponseMessage';
  var MERCHANT_ID = 'ctl00_PageBody_SuccessfulPaymentResults_MerchantDetailsPanel';
  var ROOT_ID = 'wl-order-confirmation';
  var STYLE_ID = 'wl-order-confirmation-styles';
  var PRODUCT_URL = '/Products.aspx';

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function html(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character];
    });
  }

  function isSuccessLocation() {
    if (!/\/ShoppingCart\.aspx$/i.test(window.location.pathname || '')) return false;

    try {
      return new URLSearchParams(window.location.search || '').get('success') === '1';
    } catch (error) {
      return /(?:^|[?&])success=1(?:&|$)/i.test(window.location.search || '');
    }
  }

  function getOrderNumber(response) {
    var fromUrl = '';

    try {
      fromUrl = new URLSearchParams(window.location.search || '').get('ref') || '';
    } catch (error) {
      var urlMatch = String(window.location.search || '').match(/(?:^|[?&])ref=([^&]+)/i);
      if (urlMatch) {
        try {
          fromUrl = decodeURIComponent(urlMatch[1].replace(/\+/g, ' '));
        } catch (decodeError) {
          fromUrl = urlMatch[1];
        }
      }
    }

    var strong = response.querySelector('strong');
    var fromStrong = strong ? cleanText(strong.textContent) : '';
    var responseText = cleanText(response.textContent);
    var textMatch = responseText.match(
      /(?:reserved\s+order|order|reference|confirmation)(?:\s+(?:number|no\.?|#))?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{3,})/i
    );
    var candidate = cleanText(fromUrl || fromStrong || (textMatch && textMatch[1]) || '');

    candidate = candidate.replace(
      /^(?:reserved\s+order|order|reference|confirmation)(?:\s+(?:number|no\.?))?\s*[:#-]?\s*/i,
      ''
    );

    return candidate.slice(0, 64);
  }

  function findLabeledValue(root, labelPattern) {
    var rows = root.querySelectorAll('tr');
    var i;

    for (i = 0; i < rows.length; i += 1) {
      var cells = rows[i].querySelectorAll('th,td');
      if (cells.length < 2) continue;

      var label = cleanText(cells[0].textContent).replace(/:$/, '');
      if (!labelPattern.test(label)) continue;

      var values = [];
      var cellIndex;
      for (cellIndex = 1; cellIndex < cells.length; cellIndex += 1) {
        var value = cleanText(cells[cellIndex].textContent);
        if (value) values.push(value);
      }
      if (values.length) return values.join(' ');
    }

    var terms = root.querySelectorAll('dt');
    for (i = 0; i < terms.length; i += 1) {
      if (!labelPattern.test(cleanText(terms[i].textContent).replace(/:$/, ''))) continue;
      var description = terms[i].nextElementSibling;
      var descriptionText = cleanText(description && description.textContent);
      if (descriptionText) return descriptionText;
    }

    return '';
  }

  function getFirstMerchantLine(merchant) {
    var cell = merchant.querySelector('td');
    var lines = String((cell && cell.textContent) || '')
      .split(/\n+/)
      .map(cleanText)
      .filter(Boolean);
    return lines[0] || '';
  }

  function getRequestedPickup(merchantText, merchant) {
    var date = findLabeledValue(merchant, /^(?:requested\s+)?pickup\s+date$/i);
    var time = findLabeledValue(merchant, /^(?:requested\s+)?pickup\s+time$/i);
    var combined = [date, time].filter(Boolean).join(' at ');

    if (combined) return combined;

    var labeled = findLabeledValue(
      merchant,
      /^(?:requested\s+)?(?:pickup|collection)(?:\s+date(?:\/time)?|\s+time)$/i
    );
    if (labeled) return labeled;

    var dateMatch = merchantText.match(
      /(?:pickup|collection)(?:\s+requested)?(?:\s+for|\s+date|\s+time)?\s*:?\s*((?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+)?([a-z]+\s+\d{1,2}(?:,\s+\d{4})?(?:\s+(?:at\s+)?\d{1,2}:\d{2}\s*(?:a\.?m\.?|p\.?m\.?))?)/i
    );
    return dateMatch ? cleanText(dateMatch[0].replace(/^[^:]*:\s*/, '')) : '';
  }

  function getOrderTotal(merchantText, merchant) {
    var labeled = findLabeledValue(
      merchant,
      /^(?:order\s+)?total|amount\s+(?:paid|charged)|payment\s+amount$/i
    );
    var labeledAmount = labeled.match(/\$\s?[\d,]+(?:\.\d{2})?/);
    if (labeledAmount) return labeledAmount[0].replace(/\s+/g, '');

    var allAmounts = merchantText.match(/\$\s?[\d,]+(?:\.\d{2})?/g);
    return allAmounts && allAmounts.length
      ? allAmounts[allAmounts.length - 1].replace(/\s+/g, '')
      : '';
  }

  function getConfirmationData(response, merchant) {
    var merchantText = cleanText(merchant.textContent);
    var branch =
      findLabeledValue(merchant, /^(?:pickup\s+)?(?:location|branch|store)$/i) ||
      getFirstMerchantLine(merchant);
    var address = findLabeledValue(
      merchant,
      /^(?:pickup\s+|store\s+)?address$/i
    );
    var paymentValue = findLabeledValue(
      merchant,
      /^(?:payment\s+)?(?:status|result|confirmation)$/i
    );
    var invoice = findLabeledValue(
      merchant,
      /^(?:invoice|invoice\s+number|receipt)$/i
    );
    var paymentConfirmed = /payment[^.]{0,80}(?:approved|confirmed|successful|received|complete)|(?:approved|confirmed|successful)[^.]{0,40}payment/i.test(
      merchantText
    );

    return {
      orderNumber: getOrderNumber(response),
      branch: branch.slice(0, 160),
      address: address.slice(0, 220),
      pickup: getRequestedPickup(merchantText, merchant).slice(0, 120),
      total: getOrderTotal(merchantText, merchant).slice(0, 32),
      payment: (paymentValue || (paymentConfirmed ? 'Confirmed' : '')).slice(0, 100),
      paymentConfirmed: paymentConfirmed,
      invoice: invoice.slice(0, 100)
    };
  }

  function findNativeAction(root, pattern) {
    var actions = root.querySelectorAll(
      'a,button,input[type="button"],input[type="submit"],input[type="image"]'
    );
    var i;

    for (i = 0; i < actions.length; i += 1) {
      if (actions[i].closest && actions[i].closest('#' + ROOT_ID)) continue;

      var label = cleanText(
        actions[i].textContent ||
        actions[i].value ||
        actions[i].getAttribute('aria-label') ||
        actions[i].getAttribute('title')
      );
      if (pattern.test(label)) return actions[i];
    }

    return null;
  }

  function proxyNativeAction(nativeAction, fallback) {
    if (nativeAction) {
      try {
        nativeAction.click();
        return;
      } catch (error) {
        var href = nativeAction.getAttribute && nativeAction.getAttribute('href');
        if (href) {
          window.location.href = href;
          return;
        }
      }
    }

    if (typeof fallback === 'function') fallback();
  }

  function copyOrderNumber(orderNumber, button, status) {
    function showCopied() {
      button.textContent = 'Copied';
      status.textContent = 'Order number copied.';
      window.setTimeout(function () {
        button.textContent = 'Copy';
        status.textContent = '';
      }, 1800);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(orderNumber).then(showCopied).catch(function () {
        fallbackCopy();
      });
      return;
    }

    fallbackCopy();

    function fallbackCopy() {
      var field = document.createElement('textarea');
      field.value = orderNumber;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      try {
        document.execCommand('copy');
        showCopied();
      } catch (error) {
        status.textContent = 'Select the order number and copy it.';
      }
      field.remove();
    }
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      'body.wl-order-confirmation-page{overflow-x:hidden;background:#f6f4f2;}',
      'body.wl-order-confirmation-page .mainContents,body.wl-order-confirmation-page .ShoppingCartDetailPanel,body.wl-order-confirmation-page #ctl00_PageBody_ShoppingCartDetailPanel{box-sizing:border-box;max-width:100%;}',
      'body.wl-order-confirmation-page .mainContents{width:min(1180px,100%);margin-inline:auto;}',
      'body.wl-order-confirmation-page .wl-order-confirmation__native-success{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important;}',
      'body.wl-order-confirmation-page .wl-order-confirmation__legacy-heading{display:none!important;}',
      '.wl-order-confirmation,.wl-order-confirmation *{box-sizing:border-box;}',
      '.wl-order-confirmation{--wl-maroon:#6b0016;--wl-maroon-dark:#4f0010;--wl-green:#27633c;--wl-green-soft:#edf7f0;--wl-ink:#231f20;--wl-muted:#625e5f;--wl-line:#ded9d6;--wl-paper:#fff;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;width:min(920px,calc(100% - 32px));margin:28px auto 20px;color:var(--wl-ink);}',
      '.wl-order-confirmation__card{overflow:hidden;background:var(--wl-paper);border:1px solid var(--wl-line);border-radius:20px;box-shadow:0 16px 44px rgba(49,32,35,.11);}',
      '.wl-order-confirmation__hero{display:grid;grid-template-columns:auto minmax(0,1fr);gap:18px;padding:30px 32px 24px;background:linear-gradient(135deg,#fff 0%,#fff 62%,#fbf4f5 100%);border-bottom:1px solid var(--wl-line);}',
      '.wl-order-confirmation__icon{display:grid;place-items:center;width:58px;height:58px;border-radius:50%;color:#fff;background:var(--wl-green);box-shadow:0 8px 20px rgba(39,99,60,.2);}',
      '.wl-order-confirmation__icon svg{display:block;width:30px;height:30px;}',
      '.wl-order-confirmation__eyebrow{margin:2px 0 5px;color:var(--wl-green);font-size:.78rem;font-weight:850;letter-spacing:.11em;text-transform:uppercase;}',
      '.wl-order-confirmation h1{margin:0;color:var(--wl-ink);font-size:clamp(1.75rem,4vw,2.45rem);font-weight:850;letter-spacing:-.035em;line-height:1.08;}',
      '.wl-order-confirmation__lead{max-width:660px;margin:10px 0 0;color:var(--wl-muted);font-size:1.03rem;line-height:1.55;}',
      '.wl-order-confirmation__order{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:20px;}',
      '.wl-order-confirmation__order-label{color:var(--wl-muted);font-size:.84rem;font-weight:750;text-transform:uppercase;letter-spacing:.055em;}',
      '.wl-order-confirmation__order-number{max-width:100%;overflow-wrap:anywhere;color:var(--wl-maroon);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:1.08rem;font-weight:850;}',
      '.wl-order-confirmation__copy{appearance:none;border:1px solid #cdbfc2;border-radius:999px;background:#fff;color:var(--wl-maroon);cursor:pointer;font:inherit;font-size:.83rem;font-weight:800;padding:7px 13px;}',
      '.wl-order-confirmation__copy:hover,.wl-order-confirmation__copy:focus-visible{border-color:var(--wl-maroon);background:#fbf4f5;outline:none;}',
      '.wl-order-confirmation__status{min-height:1em;color:var(--wl-green);font-size:.82rem;font-weight:700;}',
      '.wl-order-confirmation__body{padding:26px 32px 30px;}',
      '.wl-order-confirmation__chips{display:flex;gap:9px;flex-wrap:wrap;margin:0 0 24px;}',
      '.wl-order-confirmation__chip{display:inline-flex;align-items:center;gap:7px;border-radius:999px;background:var(--wl-green-soft);color:var(--wl-green);font-size:.84rem;font-weight:800;padding:7px 11px;}',
      '.wl-order-confirmation__chip-dot{width:7px;height:7px;border-radius:50%;background:currentColor;}',
      '.wl-order-confirmation__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:0 0 24px;}',
      '.wl-order-confirmation__fact{min-width:0;border:1px solid var(--wl-line);border-radius:14px;background:#fff;padding:15px 16px;}',
      '.wl-order-confirmation__fact:last-child:nth-child(odd){grid-column:1/-1;}',
      '.wl-order-confirmation__fact-label{display:block;margin-bottom:5px;color:var(--wl-muted);font-size:.77rem;font-weight:800;letter-spacing:.055em;text-transform:uppercase;}',
      '.wl-order-confirmation__fact-value{display:block;overflow-wrap:anywhere;color:var(--wl-ink);font-size:.98rem;font-weight:760;line-height:1.4;}',
      '.wl-order-confirmation__fact-detail{display:block;margin-top:3px;color:var(--wl-muted);font-size:.86rem;font-weight:500;line-height:1.4;}',
      '.wl-order-confirmation__next{display:grid;grid-template-columns:auto minmax(0,1fr);gap:14px;border-radius:15px;background:#f7f3f1;padding:17px 18px;margin-bottom:24px;}',
      '.wl-order-confirmation__next-number{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:var(--wl-maroon);color:#fff;font-size:.86rem;font-weight:850;}',
      '.wl-order-confirmation__next h2{margin:1px 0 5px;color:var(--wl-ink);font-size:1rem;font-weight:850;}',
      '.wl-order-confirmation__next p{margin:0;color:var(--wl-muted);font-size:.92rem;line-height:1.55;}',
      '.wl-order-confirmation__actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}',
      '.wl-order-confirmation__action{display:inline-flex;align-items:center;justify-content:center;min-height:46px;border:1px solid var(--wl-maroon);border-radius:10px;cursor:pointer;font:inherit;font-size:.94rem;font-weight:820;line-height:1.2;padding:11px 18px;text-align:center;text-decoration:none!important;transition:background .15s ease,color .15s ease,transform .15s ease;}',
      '.wl-order-confirmation__action:hover{transform:translateY(-1px);}',
      '.wl-order-confirmation__action--primary{background:var(--wl-maroon);color:#fff!important;}',
      '.wl-order-confirmation__action--primary:hover,.wl-order-confirmation__action--primary:focus-visible{background:var(--wl-maroon-dark);outline:none;}',
      '.wl-order-confirmation__action--secondary{background:#fff;color:var(--wl-maroon)!important;}',
      '.wl-order-confirmation__action--secondary:hover,.wl-order-confirmation__action--secondary:focus-visible{background:#fbf4f5;outline:none;}',
      '.wl-order-confirmation__action--link{margin-left:auto;border-color:transparent;background:transparent;color:var(--wl-maroon)!important;padding-inline:8px;}',
      '.wl-order-confirmation__receipt{width:min(920px,calc(100% - 32px));margin:0 auto 22px;border:1px solid var(--wl-line);border-radius:14px;background:#fff;overflow:hidden;}',
      '.wl-order-confirmation__receipt>summary{cursor:pointer;list-style:none;color:var(--wl-maroon);font-weight:820;padding:16px 18px;}',
      '.wl-order-confirmation__receipt>summary::-webkit-details-marker{display:none;}',
      '.wl-order-confirmation__receipt>summary:after{content:"+";float:right;font-size:1.2rem;line-height:1;}',
      '.wl-order-confirmation__receipt[open]>summary:after{content:"−";}',
      '.wl-order-confirmation__receipt-body{border-top:1px solid var(--wl-line);padding:18px;overflow-x:auto;}',
      '.wl-order-confirmation__receipt-body table{width:100%!important;max-width:100%!important;}',
      '.wl-order-confirmation__receipt-body td,.wl-order-confirmation__receipt-body th{overflow-wrap:anywhere;}',
      'body.wl-order-confirmation-page #savedForLater[data-wl-order-confirmation-sfl]{width:min(920px,calc(100% - 32px));margin:0 auto 34px!important;border:1px solid #ded9d6!important;border-radius:14px!important;overflow:hidden!important;background:#fff!important;}',
      'body.wl-order-confirmation-page #savedForLater[data-wl-order-confirmation-sfl] #sflHeader{cursor:pointer!important;user-select:none!important;}',
      'body.wl-order-confirmation-page #savedForLater[data-wl-order-confirmation-sfl] #sflHeader:after{content:"+";margin-left:auto;font-size:1.25rem;line-height:1;}',
      'body.wl-order-confirmation-page #savedForLater[data-wl-order-confirmation-sfl][data-wl-collapsed="false"] #sflHeader:after{content:"−";}',
      'body.wl-order-confirmation-page #savedForLater[data-wl-order-confirmation-sfl][data-wl-collapsed="true"] #sflBody{display:none!important;}',
      '@media(max-width:640px){.wl-order-confirmation{width:min(100% - 20px,920px);margin-top:14px;}.wl-order-confirmation__card{border-radius:15px;}.wl-order-confirmation__hero{grid-template-columns:1fr;gap:13px;padding:22px 19px 20px;}.wl-order-confirmation__icon{width:50px;height:50px;}.wl-order-confirmation__body{padding:20px 19px 22px;}.wl-order-confirmation__grid{grid-template-columns:1fr;}.wl-order-confirmation__actions{align-items:stretch;}.wl-order-confirmation__action{width:100%;}.wl-order-confirmation__action--link{margin-left:0;}.wl-order-confirmation__receipt,body.wl-order-confirmation-page #savedForLater[data-wl-order-confirmation-sfl]{width:min(100% - 20px,920px);}}',
      '@media print{body.wl-order-confirmation-page{background:#fff;}body.wl-order-confirmation-page #savedForLater,.wl-order-confirmation__actions,.wl-order-confirmation__copy{display:none!important;}.wl-order-confirmation,.wl-order-confirmation__receipt{width:100%;margin:0 0 16px;}.wl-order-confirmation__card,.wl-order-confirmation__receipt{box-shadow:none;border-color:#bbb;}.wl-order-confirmation__receipt{display:block;}.wl-order-confirmation__receipt>summary{display:none;}.wl-order-confirmation__receipt-body{display:block!important;}}'
    ].join('');
    document.head.appendChild(style);
  }

  function createFact(label, value, detail) {
    if (!value) return '';
    return [
      '<div class="wl-order-confirmation__fact">',
      '<span class="wl-order-confirmation__fact-label">', html(label), '</span>',
      '<span class="wl-order-confirmation__fact-value">', html(value), '</span>',
      detail
        ? '<span class="wl-order-confirmation__fact-detail">' + html(detail) + '</span>'
        : '',
      '</div>'
    ].join('');
  }

  function createCard(data) {
    var section = document.createElement('section');
    section.id = ROOT_ID;
    section.className = 'wl-order-confirmation';
    section.setAttribute('data-wl-order-confirmation', 'enhanced');
    section.setAttribute('aria-labelledby', 'wl-order-confirmation-title');
    if (data.orderNumber) {
      section.setAttribute('data-wl-order-number', data.orderNumber);
    }

    var pickupDetail = data.address || '';
    var facts = [
      createFact('Pickup location', data.branch, pickupDetail),
      createFact('Requested pickup', data.pickup, ''),
      createFact('Order total', data.total, ''),
      createFact('Payment', data.payment, ''),
      createFact('Invoice', data.invoice, '')
    ].filter(Boolean).join('');

    var branchPhrase = data.branch ? ' at ' + html(data.branch) : '';
    var orderBlock = data.orderNumber
      ? [
          '<div class="wl-order-confirmation__order">',
          '<span class="wl-order-confirmation__order-label">Order number</span>',
          '<strong class="wl-order-confirmation__order-number">', html(data.orderNumber), '</strong>',
          '<button class="wl-order-confirmation__copy" type="button" data-wl-copy-order>Copy</button>',
          '<span class="wl-order-confirmation__status" data-wl-copy-status aria-live="polite"></span>',
          '</div>'
        ].join('')
      : '';
    var paymentChip = data.paymentConfirmed || data.payment
      ? '<span class="wl-order-confirmation__chip"><span class="wl-order-confirmation__chip-dot"></span>Payment confirmed</span>'
      : '';

    section.innerHTML = [
      '<div class="wl-order-confirmation__card">',
      '<div class="wl-order-confirmation__hero">',
      '<div class="wl-order-confirmation__icon" aria-hidden="true">',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/></svg>',
      '</div>',
      '<div>',
      '<p class="wl-order-confirmation__eyebrow">Order placed</p>',
      '<h1 id="wl-order-confirmation-title">Your order is confirmed</h1>',
      '<p class="wl-order-confirmation__lead">Thank you. We received your order and will begin getting it ready.</p>',
      orderBlock,
      '</div>',
      '</div>',
      '<div class="wl-order-confirmation__body">',
      '<div class="wl-order-confirmation__chips">',
      '<span class="wl-order-confirmation__chip"><span class="wl-order-confirmation__chip-dot"></span>Order received</span>',
      paymentChip,
      '</div>',
      facts ? '<div class="wl-order-confirmation__grid">' + facts + '</div>' : '',
      '<div class="wl-order-confirmation__next">',
      '<span class="wl-order-confirmation__next-number">1</span>',
      '<div><h2>What happens next</h2>',
      '<p>We’ll start processing your order' + branchPhrase + '. Keep your order number handy for your records and use the receipt details below if you need to review the purchase.</p></div>',
      '</div>',
      '<div class="wl-order-confirmation__actions" aria-label="Order confirmation actions">',
      '<button type="button" class="wl-order-confirmation__action wl-order-confirmation__action--primary" data-wl-view-order>View order</button>',
      '<button type="button" class="wl-order-confirmation__action wl-order-confirmation__action--secondary" data-wl-print>Print receipt</button>',
      '<a class="wl-order-confirmation__action wl-order-confirmation__action--link" href="' + PRODUCT_URL + '">Continue shopping</a>',
      '</div>',
      '</div>',
      '</div>'
    ].join('');

    return section;
  }

  function makeReceiptDetails(merchant) {
    var details = document.createElement('details');
    details.className = 'wl-order-confirmation__receipt';
    details.innerHTML = [
      '<summary>Receipt and payment details</summary>',
      '<div class="wl-order-confirmation__receipt-body"></div>'
    ].join('');
    details.querySelector('.wl-order-confirmation__receipt-body').appendChild(merchant);
    return details;
  }

  function hideLegacyHeading(root) {
    var headings = root.querySelectorAll('h1,h2,h3,h4,.mainHeader,.headerText');
    var i;
    for (i = 0; i < headings.length; i += 1) {
      if (/^order results$/i.test(cleanText(headings[i].textContent))) {
        headings[i].classList.add('wl-order-confirmation__legacy-heading');
      }
    }
  }

  function prepareSavedForLater(root) {
    var savedForLater = document.getElementById('savedForLater');
    if (!savedForLater || savedForLater.getAttribute('data-wl-order-confirmation-sfl')) {
      return Boolean(savedForLater);
    }

    savedForLater.setAttribute('data-wl-order-confirmation-sfl', 'true');
    savedForLater.setAttribute('data-wl-collapsed', 'true');
    root.appendChild(savedForLater);

    var header = savedForLater.querySelector('#sflHeader');
    if (header) {
      header.setAttribute('role', 'button');
      header.setAttribute('tabindex', '0');
      header.setAttribute('aria-expanded', 'false');

      var toggle = function () {
        var collapsed = savedForLater.getAttribute('data-wl-collapsed') !== 'false';
        savedForLater.setAttribute('data-wl-collapsed', collapsed ? 'false' : 'true');
        header.setAttribute('aria-expanded', collapsed ? 'true' : 'false');
      };

      header.addEventListener('click', toggle);
      header.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggle();
        }
      });
    }

    return true;
  }

  function watchForSavedForLater(root) {
    if (prepareSavedForLater(root) || !window.MutationObserver) return;

    var observer = new MutationObserver(function () {
      if (prepareSavedForLater(root)) observer.disconnect();
    });
    observer.observe(root, { childList: true, subtree: true });
    window.setTimeout(function () {
      observer.disconnect();
    }, 12000);
  }

  function enhance() {
    if (!isSuccessLocation()) return true;
    if (document.getElementById(ROOT_ID)) return true;

    var response = document.getElementById(RESPONSE_ID);
    var merchant = document.getElementById(MERCHANT_ID);
    if (!response || !merchant) return false;

    var root =
      response.closest('.mainContents') ||
      merchant.closest('.mainContents') ||
      document.querySelector('.mainContents') ||
      response.parentElement ||
      document.body;
    var data = getConfirmationData(response, merchant);
    var doneAction =
      findNativeAction(merchant, /^(?:done|view\s+(?:my\s+)?order|finish)$/i) ||
      findNativeAction(root, /^(?:done|view\s+(?:my\s+)?order|finish)$/i);
    var printAction =
      findNativeAction(merchant, /\bprint\b/i) ||
      findNativeAction(root, /\bprint\b/i);
    var card = createCard(data);
    var receipt = makeReceiptDetails(merchant);

    injectStyles();
    document.body.classList.add('wl-order-confirmation-page');
    document.body.setAttribute('data-wl-order-confirmation-state', 'confirmed');
    response.classList.add('wl-order-confirmation__native-success');
    response.setAttribute('aria-hidden', 'true');
    hideLegacyHeading(root);

    response.parentNode.insertBefore(card, response);
    card.insertAdjacentElement('afterend', receipt);

    var copyButton = card.querySelector('[data-wl-copy-order]');
    if (copyButton && data.orderNumber) {
      copyButton.addEventListener('click', function () {
        copyOrderNumber(
          data.orderNumber,
          copyButton,
          card.querySelector('[data-wl-copy-status]')
        );
      });
    }

    card.querySelector('[data-wl-view-order]').addEventListener('click', function () {
      proxyNativeAction(doneAction, function () {
        window.location.href = PRODUCT_URL;
      });
    });
    card.querySelector('[data-wl-print]').addEventListener('click', function () {
      proxyNativeAction(printAction, function () {
        window.print();
      });
    });

    window.addEventListener('beforeprint', function () {
      receipt.open = true;
    });

    watchForSavedForLater(root);
    return true;
  }

  function start() {
    if (!isSuccessLocation()) return;
    if (enhance()) return;

    var attempts = 0;
    var interval = window.setInterval(function () {
      attempts += 1;
      if (enhance() || attempts >= 24) window.clearInterval(interval);
    }, 250);
  }

  window.WLOrderConfirmation = window.WLOrderConfirmation || {
    enhance: enhance
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
