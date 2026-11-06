(function routeProductionPaymentFlow() {
  'use strict';
  var isFixture = document.documentElement.getAttribute('data-wl-payment-fixture') === 'true';
  if (!/AccountPayment_r\.aspx/i.test(window.location.pathname) && !isFixture) return;

  var requestedMode = '';
  try {
    requestedMode = new URL(window.location.href).searchParams.get('wl_payment_flow') || '';
  } catch (error) {}
  if (requestedMode === 'native') {
    // Preserve the previous escape-hatch UI without parsing it on the modern path.
    if (document.querySelector('script[data-wl-payment-legacy-loader]')) return;
    var legacyLoader=document.createElement('script');
    var legacySource=document.currentScript && document.currentScript.src;
    legacyLoader.src=legacySource
      ? new URL('legacy/PayByInvoice.js?v=20261106-lazy-legacy-1',legacySource).href
      : 'https://ckunkel510.github.io/WL.github.io/legacy/PayByInvoice.js?v=20261106-lazy-legacy-1';
    legacyLoader.async=false;
    legacyLoader.setAttribute('data-wl-payment-legacy-loader','true');
    (document.head || document.documentElement).appendChild(legacyLoader);
    return;
  }
  if (window.__WL_PAYMENT_PREVIEW_ACTIVE__ || document.querySelector('script[data-wl-payment-preview-loader]')) return;

  var context = null;
  if (isFixture) {
    context = {
      loginName: document.documentElement.getAttribute('data-wl-payment-preview-login'),
      accountId: document.documentElement.getAttribute('data-wl-payment-preview-account'),
      expiresAt: Date.now() + 60000
    };
  } else {
    try {
      context = JSON.parse(sessionStorage.getItem('wl_payment_flow_preview_v1') || 'null');
    } catch (error) {}
  }

  var accountId = String(context && context.accountId || '').trim().toUpperCase();
  var expiresAt = Number(context && context.expiresAt || 0);
  if (!isFixture && (!accountId || expiresAt <= Date.now())) accountId = '';

  window.__WL_PAYMENT_PREVIEW_ACTIVE__ = true;
  window.__WL_PAYMENT_PREVIEW_ACCOUNT_ID__ = accountId || 'live';

  var loader = document.createElement('script');
  var currentSource = document.currentScript && document.currentScript.src;
  loader.src = currentSource
    ? new URL('PayByInvoicePreview.js?v=20260916-14', currentSource).href
    : 'https://ckunkel510.github.io/WL.github.io/PayByInvoicePreview.js?v=20260916-14';
  loader.async = false;
  loader.setAttribute('data-wl-payment-preview-loader', 'true');
  (document.head || document.documentElement).appendChild(loader);
})();
