/*
  Checkout2.js (Woodson / WebTrack)
  Goal: Stabilize checkout Step 1 by funneling users into ONE of two flows:
    - Delivered: show Delivery Address + Billing Address + Date/Instructions
    - Pickup:    show Branch + Billing Address + Date/Instructions
  WebTrack quirk: delivery fields are still required for Pickup.
    -> In Pickup mode, we mirror Billing -> Delivery in the background.

  Design principles:
    - Do NOT rebuild WebForms markup.
    - Only show/hide existing DOM blocks and keep their IDs intact.
    - Re-apply mode after any async postback (UpdatePanel / __doPostBack).

  Drop-in usage:
    <script src=".../Checkout2.js" defer></script>
*/

(function () {
  'use strict';

  // ---------------------------
  // Page guard
  // ---------------------------
  function isCheckoutPage() {
    const p = (location.pathname || '').toLowerCase();
    // Covers common WebTrack patterns (Checkout.aspx / CheckoutDetails.aspx)
    return p.includes('checkout') || document.getElementById('ctl00_PageBody_SaleTypeSelector_rbDelivered');
  }
  if (!isCheckoutPage()) return;

  // ---------------------------
  // Small utils
  // ---------------------------
  const logPrefix = '[WL Checkout2]';
  const safeLog = (...a) => { try { console.log(logPrefix, ...a); } catch {} };

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $all(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }
  function byId(id) {
    return document.getElementById(id);
  }

  function show(el) {
    if (!el) return;
    el.style.display = '';
    el.removeAttribute('aria-hidden');
  }
  function hide(el) {
    if (!el) return;
    el.style.display = 'none';
    el.setAttribute('aria-hidden', 'true');
  }

  function closest(el, sel) {
    try { return el ? el.closest(sel) : null; } catch { return null; }
  }

  function setInputValue(input, val) {
    if (!input) return;
    const v = (val == null) ? '' : String(val);
    if (input.value !== v) input.value = v;
    // Nudge WebForms validators/dirty tracking (without triggering full postback)
    try {
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch {}
  }

  function setSelectByTextOrValue(select, textOrValue) {
    if (!select) return;
    const t = (textOrValue == null) ? '' : String(textOrValue);
    const opts = Array.from(select.options || []);
    const match = opts.find(o => o.value === t) || opts.find(o => (o.text || '').trim() === t);
    if (match) {
      select.value = match.value;
      try {
        select.dispatchEvent(new Event('change', { bubbles: true }));
      } catch {}
    }
  }

  // ---------------------------
  // Key element getters
  // ---------------------------
  function getDeliveredRadio() {
    return byId('ctl00_PageBody_SaleTypeSelector_rbDelivered');
  }
  function getPickupRadio() {
    return byId('ctl00_PageBody_SaleTypeSelector_rbCollectLater');
  }
  function getMode() {
    const d = getDeliveredRadio();
    const p = getPickupRadio();
    if (p && p.checked) return 'pickup';
    if (d && d.checked) return 'delivered';
    // default: delivered (matches native checked=checked in markup)
    return 'delivered';
  }

  function getBranchRow() {
    return byId('ctl00_PageBody_BranchSelector') || closest(byId('ctl00_PageBody_BranchDropDownList'), '.row');
  }

  // Delivery & Invoice blocks are rendered inside the same .row.
  function getAddressRow() {
    // This row contains Delivery (left) and Invoice (right)
    const delAny = byId('ctl00_PageBody_DeliveryAddress_AddressLine1') || byId('ctl00_PageBody_DeliveryAddress_Postcode');
    return closest(delAny, '.row');
  }

  function getDeliveryCol() {
    // Prefer the delivery autocomplete wrapper, else any delivery input
    const a = byId('ctl00_PageBody_DeliveryAddress_GoogleAddressSearchWrapper')
      || byId('ctl00_PageBody_DeliveryAddress_AddressLine1')
      || byId('ctl00_PageBody_DeliveryAddress_Postcode');
    return closest(a, '.epi-form-col-single-checkout');
  }

  function getInvoiceCol() {
    const a = byId('ctl00_PageBody_InvoiceAddress_GoogleAddressSearchWrapper')
      || byId('ctl00_PageBody_InvoiceAddress_AddressLine1')
      || byId('ctl00_PageBody_InvoiceAddress_Postcode');
    return closest(a, '.epi-form-col-single-checkout');
  }

  // ---------------------------
  // Mirror Billing -> Delivery (Pickup mode)
  // ---------------------------
  const billingToDeliveryMap = [
    // Billing/Invoice -> Delivery
    ['ctl00_PageBody_InvoiceAddress_AddressLine1', 'ctl00_PageBody_DeliveryAddress_AddressLine1'],
    ['ctl00_PageBody_InvoiceAddress_AddressLine2', 'ctl00_PageBody_DeliveryAddress_AddressLine2'],
    ['ctl00_PageBody_InvoiceAddress_AddressLine3', 'ctl00_PageBody_DeliveryAddress_AddressLine3'],
    ['ctl00_PageBody_InvoiceAddress_City',        'ctl00_PageBody_DeliveryAddress_City'],
    ['ctl00_PageBody_InvoiceAddress_Postcode',    'ctl00_PageBody_DeliveryAddress_Postcode'],
    // Country selects
    ['ctl00_PageBody_InvoiceAddress_CountrySelector1', 'ctl00_PageBody_DeliveryAddress_CountrySelector'],
    // State selects (CountyList)
    ['ctl00_PageBody_InvoiceAddress_CountySelector_CountyList', 'ctl00_PageBody_DeliveryAddress_CountySelector_CountyList'],
  ];

  function mirrorBillingToDeliveryOnce() {
    // Copy values without forcing a postback.
    billingToDeliveryMap.forEach(([fromId, toId]) => {
      const from = byId(fromId);
      const to = byId(toId);
      if (!from || !to) return;

      const isSelect = (from.tagName === 'SELECT') || (to.tagName === 'SELECT');
      if (isSelect) {
        // prefer matching by value; fallback by text
        if (to.tagName === 'SELECT' && from.tagName === 'SELECT') {
          to.value = from.value;
          try { to.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
        } else if (to.tagName === 'SELECT') {
          setSelectByTextOrValue(to, from.value);
        } else {
          setInputValue(to, from.value);
        }
      } else {
        setInputValue(to, from.value);
      }
    });

    // Also copy first/last/phone if present (these may exist only on delivery)
    // If you want to map from billing contact fields later, add them here.
  }

  function wireBillingMirror() {
    const invoiceInputs = [
      'ctl00_PageBody_InvoiceAddress_AddressLine1',
      'ctl00_PageBody_InvoiceAddress_AddressLine2',
      'ctl00_PageBody_InvoiceAddress_AddressLine3',
      'ctl00_PageBody_InvoiceAddress_City',
      'ctl00_PageBody_InvoiceAddress_Postcode',
      'ctl00_PageBody_InvoiceAddress_CountrySelector1',
      'ctl00_PageBody_InvoiceAddress_CountySelector_CountyList'
    ].map(byId).filter(Boolean);

    invoiceInputs.forEach(el => {
      if (el.__wl_mirror_bound) return;
      el.__wl_mirror_bound = true;
      el.addEventListener('input', () => { if (getMode() === 'pickup') mirrorBillingToDeliveryOnce(); });
      el.addEventListener('change', () => { if (getMode() === 'pickup') mirrorBillingToDeliveryOnce(); });
    });
  }

  // Ensure delivery required fields are populated right before Continue postback
  function wireContinueButtons() {
    const btns = [
      byId('ctl00_PageBody_ContinueButton1'),
      byId('ctl00_PageBody_ContinueButton2')
    ].filter(Boolean);

    btns.forEach(btn => {
      if (btn.__wl_bound) return;
      btn.__wl_bound = true;
      btn.addEventListener('click', function () {
        if (getMode() === 'pickup') {
          safeLog('Pickup mode: mirroring Billing -> Delivery before Continue');
          mirrorBillingToDeliveryOnce();
        }
      }, true); // capture, run before WebForms onclick
    });
  }

  // ---------------------------
  // Show/Hide funnel logic
  // ---------------------------
  function applyModeUI(mode) {
    // Sections
    const branchRow = getBranchRow();
    const addrRow = getAddressRow();
    const delCol = getDeliveryCol();
    const invCol = getInvoiceCol();

    // Delivery-only helpers
    const deliverySelectBtn = byId('ctl00_PageBody_CustomerAddressSelector_SelectAddressLinkButton');
    const deliverySearchWrap = byId('ctl00_PageBody_DeliveryAddress_GoogleAddressSearchWrapper');

    if (mode === 'pickup') {
      // Show branch selector
      show(branchRow);

      // Show only invoice/billing; hide delivery column but keep it in DOM
      if (addrRow) show(addrRow);
      hide(delCol);
      show(invCol);

      // Hide delivery search + select address button (optional)
      hide(deliverySearchWrap);
      hide(closest(deliverySelectBtn, 'div'));

      // Ensure delivery fields get populated from billing
      mirrorBillingToDeliveryOnce();

      safeLog('UI applied: PICKUP (Branch + Billing + Date/Instructions)');
    } else {
      // Delivered
      hide(branchRow);

      if (addrRow) show(addrRow);
      show(delCol);
      show(invCol);

      // Show delivery search + selector
      show(deliverySearchWrap);
      show(closest(deliverySelectBtn, 'div'));

      safeLog('UI applied: DELIVERED (Delivery + Billing + Date/Instructions)');
    }

    // Always keep date/PO + instructions visible (we don’t touch them here)
  }

  function wireModeSwitch() {
    const d = getDeliveredRadio();
    const p = getPickupRadio();

    function onChange() {
      const m = getMode();
      applyModeUI(m);
    }

    [d, p].filter(Boolean).forEach(r => {
      if (r.__wl_bound) return;
      r.__wl_bound = true;
      r.addEventListener('change', onChange);
      r.addEventListener('click', onChange);
    });
  }

  // ---------------------------
  // De-bug the “step menu” UI if present
  // ---------------------------
  function tameNativeStepMenu() {
    // This is the left column ".navigation-menu". We can hide it entirely.
    const navCol = $('.navigation-menu');
    if (navCol) hide(navCol);

    // If there are any multi-step panels, do NOT fight them; just let WebTrack render.
    // We focus on Step 1 funnel with stable sections.
  }

  // ---------------------------
  // Re-apply after postbacks / dynamic updates
  // ---------------------------
  function hookAspNetAsync() {
    // UpdatePanel endRequest
    try {
      if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager) {
        const prm = Sys.WebForms.PageRequestManager.getInstance();
        prm.add_endRequest(function () {
          safeLog('Async postback endRequest: re-applying mode UI');
          boot(true);
        });
      }
    } catch {}

    // MutationObserver fallback
    try {
      const container = $('.container') || document.body;
      const mo = new MutationObserver(function (mutations) {
        // Only re-apply if relevant nodes changed
        for (const m of mutations) {
          if (m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length)) {
            // Cheap filter: if address inputs exist, re-apply
            if (byId('ctl00_PageBody_InvoiceAddress_AddressLine1') || byId('ctl00_PageBody_DeliveryAddress_AddressLine1')) {
              boot(true);
              break;
            }
          }
        }
      });
      mo.observe(container, { childList: true, subtree: true });
    } catch {}
  }

  // ---------------------------
  // CSS (minimal, non-invasive)
  // ---------------------------
  function injectCss() {
    if (byId('wlCheckout2Css')) return;
    const style = document.createElement('style');
    style.id = 'wlCheckout2Css';
    style.textContent = `
      /* Hide step nav column if still taking up space */
      .navigation-menu[aria-hidden="true"], .navigation-menu[style*="display: none"] { display:none !important; }

      /* Slightly tighten spacing so layout doesn’t look broken when delivery column is hidden */
      .epi-form-col-single-checkout { min-width: 260px; }

      /* Optional: visually label pickup flow */
      body.wl-pickup-mode .SelectableAddressType { display:none; }
    `;
    document.head.appendChild(style);
  }

  // ---------------------------
  // Boot
  // ---------------------------
  let booting = false;
  function boot(isReapply) {
    if (booting) return;
    booting = true;
    try {
      injectCss();
      tameNativeStepMenu();
      wireModeSwitch();
      wireBillingMirror();
      wireContinueButtons();

      const mode = getMode();
      if (mode === 'pickup') document.body.classList.add('wl-pickup-mode');
      else document.body.classList.remove('wl-pickup-mode');

      applyModeUI(mode);

      if (!isReapply) hookAspNetAsync();
    } catch (e) {
      safeLog('Boot error', e);
    } finally {
      booting = false;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    boot(false);
  });

})();
