// ─────────────────────────────────────────────────────────────────────────────
// Woodson WebTrack "Shoppable Checkout" Script (v3)
// Goal: Make checkout feel modern + frictionless while staying WebForms-safe.
// Pages supported:
//   1) ShoppingCart.aspx  → optional "One more chance to add items" drawer
//   2) Checkout.aspx (or your WebTrack checkout page with controls below) → wizard
//
// Key improvements over Checkout2.js:
//   • Loading overlay during full/async postbacks (prevents "stuck" feeling)
//   • Step-level "preflight" validation (blocks Next with friendly inline toast)
//   • Live order summary bar (always shows what they've chosen; edit jumps back)
//   • More resilient return-to-step behavior after postbacks (ReturnStep + Observer)
//   • Keeps your existing fixes: same-day pickup >= 2 hours out, billing copy-once
//
// Notes:
//   • Designed to be drop-in; it *only* rearranges DOM, never invents postback args.
//   • If your checkout URL isn't "Checkout.aspx", tweak PATH_CHECKOUT below.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  // ────────────────────────────────────────────────────────────────────────────
  // 0) Page routing
  // ────────────────────────────────────────────────────────────────────────────
  const PATH = (location.pathname || '').toLowerCase();
  const PATH_CART = /shoppingcart\.aspx/i;
  const PATH_CHECKOUT = /(checkout|checkout_r|checkout2|singlecheckout|checkoutwizard)\.aspx/i; // broadened

  const isCart = PATH_CART.test(PATH);
  const isCheckout = PATH_CHECKOUT.test(PATH);

  if (!isCart && !isCheckout) return;

  // ────────────────────────────────────────────────────────────────────────────
  // 1) Shared helpers
  // ────────────────────────────────────────────────────────────────────────────
  const $ = window.jQuery || null;

  const WL = (window.WLCheckout = window.WLCheckout || {});
  const LOG = (...a) => { try { /* eslint-disable no-console */ console.log('[WL:CO]', ...a); } catch {} };

  const STEP_KEY = 'wl_currentStep';
  const SAME_KEY = 'wl_sameAsDelivery';
  const TTL_MS = 10 * 60 * 1000;

  function setWithExpiry(key, value, ttlMs) {
    try {
      localStorage.setItem(key, JSON.stringify({ value, expiry: Date.now() + ttlMs }));
    } catch {}
  }
  function getWithExpiry(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const item = JSON.parse(raw);
      if (!item || typeof item !== 'object' || !('expiry' in item)) {
        localStorage.removeItem(key);
        return null;
      }
      if (Date.now() > item.expiry) {
        localStorage.removeItem(key);
        return null;
      }
      return item.value;
    } catch {
      return null;
    }
  }

  function setStep(n) { setWithExpiry(STEP_KEY, String(n), TTL_MS); }
  function getStep() {
    const v = getWithExpiry(STEP_KEY);
    return v != null ? parseInt(v, 10) : null;
  }

  function setSameAsDelivery(val) {
    try { localStorage.setItem(SAME_KEY, val ? 'true' : 'false'); } catch {}
  }
  function getSameAsDelivery() {
    try { return localStorage.getItem(SAME_KEY) === 'true'; } catch { return false; }
  }

  function setReturnStep(n) { try { sessionStorage.setItem('wl_returnStep', String(n)); } catch {} }
  function consumeReturnStep() {
    try {
      const v = sessionStorage.getItem('wl_returnStep');
      if (v) sessionStorage.removeItem('wl_returnStep');
      return v ? parseInt(v, 10) : null;
    } catch { return null; }
  }

  function setExpectedNav(flag) { try { sessionStorage.setItem('wl_expect_nav', flag ? '1' : '0'); } catch {} }
  function consumeExpectedNav() {
    try {
      const v = sessionStorage.getItem('wl_expect_nav') === '1';
      sessionStorage.removeItem('wl_expect_nav');
      return v;
    } catch { return false; }
  }

  // One-time per-session guard for billing auto-copy
  function markAutoCopyDone() { try { sessionStorage.setItem('wl_autocopy_done', '1'); } catch {} }
  function autoCopyAlreadyDone() { try { return sessionStorage.getItem('wl_autocopy_done') === '1'; } catch { return false; } }

  // "Sticky" navigation expectation guard
  function setNavIntent(reason) { try { sessionStorage.setItem('wl_nav_intent', reason || '1'); } catch {} }
  function consumeNavIntent() {
    try {
      const v = sessionStorage.getItem('wl_nav_intent');
      sessionStorage.removeItem('wl_nav_intent');
      return v || '';
    } catch { return ''; }
  }

  WL.setStep = setStep;
  WL.getStep = getStep;
  WL.setReturnStep = setReturnStep;
  WL.TTL_MS = TTL_MS;

  function el(tag, props, children) {
    const node = document.createElement(tag);
    if (props) Object.keys(props).forEach((k) => {
      if (k === 'class') node.className = props[k];
      else if (k === 'html') node.innerHTML = props[k];
      else if (k.startsWith('on') && typeof props[k] === 'function') node.addEventListener(k.slice(2), props[k]);
      else node.setAttribute(k, props[k]);
    });
    (children || []).forEach((c) => node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return node;
  }

  function isVisible(node) {
    if (!node) return false;
    const s = window.getComputedStyle(node);
    return s.display !== 'none' && s.visibility !== 'hidden' && node.offsetParent !== null;
  }

  function scrollToNice(node) {
    try { node.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch {}
  }

  function safeTrim(v) { return String(v || '').trim(); }

  function toast(msg, type) {
    const host = document.getElementById('wlToastHost') || document.body.appendChild(el('div', { id: 'wlToastHost', class: 'wl-toast-host' }));
    const t = el('div', { class: 'wl-toast ' + (type || 'info'), html: `<div class="wl-toast-msg">${msg}</div><button type="button" class="wl-toast-x" aria-label="Close">×</button>` });
    host.appendChild(t);
    const kill = () => { try { t.remove(); } catch {} };
    t.querySelector('.wl-toast-x')?.addEventListener('click', kill);
    setTimeout(kill, 5200);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 2) Loading overlay (full postback + UpdatePanel async postback support)
  // ────────────────────────────────────────────────────────────────────────────
  function ensureOverlay() {
    if (document.getElementById('wlOverlay')) return;

    const overlay = el('div', { id: 'wlOverlay', class: 'wl-overlay', html: `
      <div class="wl-overlay-card" role="status" aria-live="polite">
        <div class="wl-spinner" aria-hidden="true"></div>
        <div class="wl-overlay-title">Working on it…</div>
        <div class="wl-overlay-sub">This can take a few seconds. Please don’t refresh.</div>
      </div>
    `});
    overlay.style.display = 'none';
    document.body.appendChild(overlay);
  }

  function showOverlay(reason) {
    ensureOverlay();
    const o = document.getElementById('wlOverlay');
    if (!o) return;
    const title = o.querySelector('.wl-overlay-title');
    if (title && reason) title.textContent = reason;
    o.style.display = 'flex';
    document.documentElement.classList.add('wl-busy');
  }

  function hideOverlay() {
    const o = document.getElementById('wlOverlay');
    if (!o) return;
    o.style.display = 'none';
    document.documentElement.classList.remove('wl-busy');
  }

  function wireOverlayForPostbacks() {
    // Full postback on form submit
    const form = document.forms && document.forms[0];
    if (form && !form.__wl_overlay_bound) {
      form.__wl_overlay_bound = true;
      form.addEventListener('submit', () => showOverlay('Submitting…'), true);
    }

    // WebForms UpdatePanel async postbacks (if present)
    try {
      const prm = window.Sys && window.Sys.WebForms && window.Sys.WebForms.PageRequestManager
        ? window.Sys.WebForms.PageRequestManager.getInstance()
        : null;
      if (prm && !prm.__wl_bound) {
        prm.__wl_bound = true;
        prm.add_beginRequest(() => showOverlay('Updating…'));
        prm.add_endRequest(() => setTimeout(hideOverlay, 50));
      }
    } catch {}

    // Conservative: show overlay when __doPostBack is invoked from our clicks
    if (typeof window.__doPostBack === 'function' && !window.__doPostBack.__wl_wrapped) {
      const orig = window.__doPostBack;
      window.__doPostBack = function (a, b) {
        try { showOverlay('Updating…'); } catch {}
        return orig(a, b);
      };
      window.__doPostBack.__wl_wrapped = true;
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 3) CART PAGE: "One more chance to add items" drawer
  // ────────────────────────────────────────────────────────────────────────────
  function initCartNudge() {
    // Keep this safe: if we can't find buttons, do nothing.
    // Common WebTrack cart buttons:
    const proceed =
      document.querySelector('#ctl00_PageBody_ProceedToCheckoutButton') ||
      document.querySelector('#ctl00_PageBody_CheckoutButton') ||
      document.querySelector('input[value*="Checkout" i],button[value*="Checkout" i]');

    const guest =
      document.querySelector('#ctl00_PageBody_CheckoutAsGuestButton') ||
      document.querySelector('input[value*="Guest" i],button[value*="Guest" i]');

    if (!proceed && !guest) return;

    // Inject mini "nudge" drawer (once per session) before they leave the cart
    const key = 'wl_cart_nudge_done';
    const already = (() => { try { return sessionStorage.getItem(key) === '1'; } catch { return false; }})();
    if (already) return;

    function openDrawer(e, goFn) {
      if (e) e.preventDefault();
      showOverlay('One last check…');

      const drawer = el('div', { id: 'wlCartDrawer', class: 'wl-cart-drawer', html: `
        <div class="wl-cart-drawer-inner">
          <div class="wl-cart-drawer-head">
            <div>
              <div class="wl-cart-drawer-title">Need anything else?</div>
              <div class="wl-cart-drawer-sub">People often add these before checkout.</div>
            </div>
            <button type="button" class="wl-x" aria-label="Close">×</button>
          </div>
          <div class="wl-quick-links">
            <a class="wl-ql" href="/Search.aspx?q=faucet%20cover">Faucet covers</a>
            <a class="wl-ql" href="/Search.aspx?q=pipe%20insulation">Pipe insulation</a>
            <a class="wl-ql" href="/Search.aspx?q=hand%20warmers">Hand warmers</a>
            <a class="wl-ql" href="/Search.aspx?q=gloves">Gloves</a>
            <a class="wl-ql" href="/Search.aspx?q=tape">Tape</a>
            <a class="wl-ql" href="/Search.aspx?q=caulk">Caulk</a>
          </div>
          <div class="wl-cart-drawer-actions">
            <button type="button" class="btn btn-secondary" id="wlContinueShopping">Keep shopping</button>
            <button type="button" class="btn btn-primary" id="wlGoCheckout">Continue to checkout</button>
          </div>
        </div>
      `});

      document.body.appendChild(drawer);
      drawer.querySelector('.wl-x')?.addEventListener('click', () => { drawer.remove(); hideOverlay(); });
      drawer.querySelector('#wlContinueShopping')?.addEventListener('click', () => { drawer.remove(); hideOverlay(); });
      drawer.querySelector('#wlGoCheckout')?.addEventListener('click', () => {
        try { sessionStorage.setItem(key, '1'); } catch {}
        drawer.remove();
        // Let the original button do its thing (postback/navigation)
        try { goFn(); } catch {}
      });

      hideOverlay();
    }

    // Wrap clicks, but keep them working if drawer fails.
    function wrap(btn, goFn) {
      if (!btn || btn.__wl_wrapped) return;
      btn.__wl_wrapped = true;
      btn.addEventListener('click', (e) => {
        try {
          openDrawer(e, goFn);
        } catch {
          // fallback: proceed normally
          try { goFn(); } catch {}
        }
      }, true);
    }

    wrap(proceed, () => proceed.click.__wl_passthrough ? proceed.click.__wl_passthrough() : proceed.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    wrap(guest, () => guest.click.__wl_passthrough ? guest.click.__wl_passthrough() : guest.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    // Safer: preserve original click by storing it and invoking it
    [proceed, guest].filter(Boolean).forEach((b) => {
      try {
        if (!b.click.__wl_passthrough) {
          const orig = b.click.bind(b);
          b.click.__wl_passthrough = orig;
        }
      } catch {}
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 4) CHECKOUT PAGE: Wizard rebuild + polish
  // ────────────────────────────────────────────────────────────────────────────
  function initCheckoutWizard() {
    // Your existing selectors (from Checkout2.js) are preserved.
    // If your checkout page uses a different container, tweak here:
    const container = document.querySelector('.container');
    if (!container) return;

    // Prevent double-mount
    if (document.querySelector('.checkout-wizard')) return;

    // Hide legacy UI bits (kept from your version) fileciteturn1file2L1-L17
    try {
      const dateColDefault = document.getElementById('ctl00_PageBody_dtRequired_DatePicker_wrapper');
      if (dateColDefault) dateColDefault.style.display = 'none';

      if ($) {
        $('label').filter(function () { return $(this).text().trim() === 'Date required:'; }).hide();
        $('div.form-control').hide();
        $('#ctl00_PageBody_dtRequired_DatePicker_wrapper').hide();
        $('#ctl00_PageBody_dtRequired_DatePicker_wrapper')
          .closest('.epi-form-col-single-checkout.epi-form-group-checkout')
          .hide();
        $('.submit-button-panel').hide();
        $('#ctl00_PageBody_BackToCartButton2').val('Back to Cart');
      }
    } catch {}

    // Wizard shell
    const wizard = el('div', { class: 'checkout-wizard' });
    container.insertBefore(wizard, container.firstChild);

    const head = el('div', { class: 'wl-wiz-head', html: `
      <div class="wl-wiz-title">Checkout</div>
      <div class="wl-wiz-sub">Fast, simple, and no surprises.</div>
    `});
    wizard.appendChild(head);

    const summaryBar = el('div', { class: 'wl-summarybar', html: `
      <div class="wl-sum-grid">
        <div class="wl-sum-item"><div class="wl-sum-k">Order</div><div class="wl-sum-v" id="wlSumOrder">—</div></div>
        <div class="wl-sum-item"><div class="wl-sum-k">Delivery</div><div class="wl-sum-v" id="wlSumShip">—</div></div>
        <div class="wl-sum-item"><div class="wl-sum-k">Branch</div><div class="wl-sum-v" id="wlSumBranch">—</div></div>
        <div class="wl-sum-item"><div class="wl-sum-k">Dates</div><div class="wl-sum-v" id="wlSumDates">—</div></div>
        <div class="wl-sum-item wl-sum-actions">
          <button type="button" class="btn btn-link" id="wlEditShip">Edit shipping</button>
          <button type="button" class="btn btn-link" id="wlEditAddr">Edit address</button>
        </div>
      </div>
    `});
    wizard.appendChild(summaryBar);

    const nav = el('ul', { class: 'checkout-steps', role: 'tablist' });
    wizard.appendChild(nav);

    function isEl(x) { return x && x.nodeType === 1; }

    // Steps definition (kept, with minor title tweaks)
    const steps = [
      {
        title: 'Order Type',
        findEls: () => {
          const tx = document.getElementById('ctl00_PageBody_TransactionTypeDiv');
          return tx ? [tx.closest('.epi-form-col-single-checkout')] : [];
        },
      },
      {
        title: 'Ship or Pickup',
        findEls: () => {
          const ship = document.getElementById('ctl00_PageBody_SaleTypeSelector_lblDelivered');
          return ship ? [ship.closest('.epi-form-col-single-checkout')] : [];
        },
      },
      {
        title: 'Reference',
        findEls: () => {
          const po = document.getElementById('ctl00_PageBody_PurchaseOrderNumberTextBox');
          return po ? [po.closest('.epi-form-group-checkout')] : [];
        },
      },
      {
        title: 'Branch',
        findEls: () => {
          const br = document.getElementById('ctl00_PageBody_BranchSelector');
          return br ? [br] : [];
        },
      },
      {
        title: 'Delivery Address',
        findEls: () => {
          const hdr = document.querySelector('.SelectableAddressType');
          return hdr ? [hdr.closest('.epi-form-col-single-checkout')] : [];
        },
      },
      {
        title: 'Billing Address',
        findEls: () => {
          const gp = document.getElementById('ctl00_PageBody_InvoiceAddress_GoogleAddressSearchWrapper');
          return gp ? [gp.closest('.epi-form-col-single-checkout')] : [];
        },
      },
      {
        title: 'Dates & Notes',
        findEls: () => {
          const arr = [];
          const tbl = document.querySelector('.cartTable');
          if (tbl) arr.push(tbl.closest('table'));
          const si = document.getElementById('ctl00_PageBody_SpecialInstructionsTextBox');
          if (si) {
            const wrap = si.closest('.epi-form-group-checkout') ||
              si.closest('.epi-form-col-single-checkout') ||
              si.parentElement;
            if (wrap) arr.push(wrap);
          }
          return arr;
        },
      },
    ]; // fileciteturn1file4L14-L52

    // panes
    steps.forEach((step, i) => {
      const num = i + 1;

      const li = el('li', { 'data-step': String(num), role: 'tab', tabindex: '0' }, [step.title]);
      li.addEventListener('click', () => showStep(num));
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showStep(num); } });
      nav.appendChild(li);

      const pane = el('div', { class: 'checkout-step', 'data-step': String(num), role: 'tabpanel' });
      wizard.appendChild(pane);

      step.findEls().filter(isEl).forEach((node) => pane.appendChild(node));

      // nav actions
      const navDiv = el('div', { class: 'checkout-nav' });
      pane.appendChild(navDiv);

      if (num > 1) {
        navDiv.appendChild(el('button', { type: 'button', class: 'btn btn-secondary', onclick: (e) => { e.preventDefault(); showStep(num - 1); }}, ['Back']));
      }

      if (num < steps.length) {
        navDiv.appendChild(el('button', {
          type: 'button',
          class: 'btn btn-primary',
          onclick: (e) => {
            e.preventDefault();
            // Step-level preflight validation
            const ok = validateStep(num);
            if (!ok) return;
            showStep(num + 1);
          }
        }, ['Next']));
      } else {
        const conts = Array.from(document.querySelectorAll('#ctl00_PageBody_ContinueButton1,#ctl00_PageBody_ContinueButton2'));
        if (conts.length) {
          const cont = conts.pop();
          cont.style.display = '';
          cont.type = 'submit';
          cont.addEventListener('click', () => {
            setReturnStep(num);
            setExpectedNav(true);
            setNavIntent('continue');
            showOverlay('Submitting…');
          }, true);
          navDiv.appendChild(cont);
        }
      }
    }); // fileciteturn1file3L4-L61

    // Optional "(optional)" on reference label
    (function () {
      const p3 = wizard.querySelector('.checkout-step[data-step="3"]');
      if (!p3) return;
      const lbl = p3.querySelector('label');
      if (!lbl) return;
      const opt = el('small', { class: 'text-muted' }, [' (optional)']);
      opt.style.marginLeft = '8px';
      lbl.appendChild(opt);
    })(); // fileciteturn1file3L63-L74

    // Rename step 6 header (kept) fileciteturn1file1L1-L7
    (function () {
      const p6 = wizard.querySelector('.checkout-step[data-step="6"]');
      if (!p6) return;
      const hdr = p6.querySelector('.font-weight-bold.mb-3.mt-4');
      if (hdr) hdr.textContent = 'Billing Address';
    })();

    // Step switching + persistence (kept behavior) fileciteturn1file3L84-L105
    function showStep(n) {
      wizard.querySelectorAll('.checkout-step').forEach((p) => p.classList.toggle('active', +p.dataset.step === n));
      nav.querySelectorAll('li').forEach((li) => {
        const s = +li.dataset.step;
        li.classList.toggle('active', s === n);
        li.classList.toggle('completed', s < n);
        li.setAttribute('aria-selected', s === n ? 'true' : 'false');
      });
      setStep(n);

      // update summary whenever step changes
      updateSummary();

      try { window.scrollTo({ top: wizard.offsetTop, behavior: 'smooth' }); } catch {}
      // focus first input in step
      setTimeout(() => focusFirstInputInStep(n), 50);
    }
    WL.showStep = showStep;

    function focusFirstInputInStep(stepNum) {
      const pane = wizard.querySelector(`.checkout-step[data-step="${stepNum}"]`);
      if (!pane) return;
      const target = pane.querySelector('input:not([type="hidden"]):not([disabled]),select:not([disabled]),textarea:not([disabled])');
      if (target && isVisible(target)) { try { target.focus({ preventScroll: true }); } catch {} }
    }

    // ReturnStep binding for postback-y controls (kept) fileciteturn1file1L31-L54
    function bindReturnStepFor(selector, stepNum, eventName) {
      const ev = eventName || 'change';
      const node = document.querySelector(selector);
      if (!node) return;
      node.addEventListener(ev, () => setReturnStep(stepNum), true);
    }
    bindReturnStepFor('#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList', 5, 'change');
    bindReturnStepFor('#ctl00_PageBody_DeliveryAddress_CountrySelector', 5, 'change');
    bindReturnStepFor('#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList', 6, 'change');
    bindReturnStepFor('#ctl00_PageBody_InvoiceAddress_CountrySelector1', 6, 'change');
    bindReturnStepFor('#ctl00_PageBody_BranchSelector', 4, 'change');

    // -----------------------------------------------------------------------
    // Preflight validation: only blocks on obvious required info
    // -----------------------------------------------------------------------
    function validateStep(stepNum) {
      const pane = wizard.querySelector(`.checkout-step[data-step="${stepNum}"]`);
      if (!pane) return true;

      // If WebForms already marked invalid fields, respect that first.
      const bad = pane.querySelector('input.input-validation-error,select.input-validation-error,textarea.input-validation-error,input.is-invalid,select.is-invalid,textarea.is-invalid,[aria-invalid="true"]');
      if (bad && isVisible(bad)) {
        toast('There’s something to fix on this step.', 'warn');
        scrollToNice(bad);
        try { bad.focus({ preventScroll: true }); } catch {}
        return false;
      }

      // Minimal required checks by step
      const errs = [];

      if (stepNum === 2) {
        const rbDel = document.getElementById('ctl00_PageBody_SaleTypeSelector_rbDelivered');
        const rbPick = document.getElementById('ctl00_PageBody_SaleTypeSelector_rbCollectLater');
        if (rbDel && rbPick && !rbDel.checked && !rbPick.checked) errs.push('Choose Delivered or Pickup.');
      }

      if (stepNum === 4) {
        const br = document.getElementById('ctl00_PageBody_BranchSelector');
        if (br && !safeTrim(br.value)) errs.push('Select a branch.');
      }

      if (stepNum === 5) {
        const line1 = document.getElementById('ctl00_PageBody_DeliveryAddress_AddressLine1');
        const city = document.getElementById('ctl00_PageBody_DeliveryAddress_City');
        const zip = document.getElementById('ctl00_PageBody_DeliveryAddress_Postcode');
        if (line1 && !safeTrim(line1.value)) errs.push('Enter delivery address (line 1).');
        if (city && !safeTrim(city.value)) errs.push('Enter city.');
        if (zip && !safeTrim(zip.value)) errs.push('Enter ZIP/postcode.');
      }

      if (stepNum === 6) {
        // If same-as-delivery is checked, we allow them to proceed.
        const same = document.getElementById('sameAsDeliveryCheck');
        if (same && same.checked) return true;

        const line1 = document.getElementById('ctl00_PageBody_InvoiceAddress_AddressLine1');
        const city = document.getElementById('ctl00_PageBody_InvoiceAddress_City');
        const zip = document.getElementById('ctl00_PageBody_InvoiceAddress_Postcode');
        const email = document.getElementById('ctl00_PageBody_InvoiceAddress_EmailAddressTextBox');
        if (line1 && !safeTrim(line1.value)) errs.push('Enter billing address (line 1).');
        if (city && !safeTrim(city.value)) errs.push('Enter billing city.');
        if (zip && !safeTrim(zip.value)) errs.push('Enter billing ZIP/postcode.');
        if (email && email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email.value).replace(/^\([^)]*\)\s*/, ''))) {
          errs.push('Billing email looks invalid.');
        }
      }

      if (errs.length) {
        toast(errs[0], 'warn');
        return false;
      }

      return true;
    }

    // -----------------------------------------------------------------------
    // Delivery summary/edit (Step 5) – kept behavior, but summary updates bar
    // -----------------------------------------------------------------------
    (function () {
      const pane5 = wizard.querySelector('.checkout-step[data-step="5"]');
      if (!pane5) return;

      const col = pane5.querySelector('.epi-form-col-single-checkout');
      if (!col) return;

      const wrap = el('div', { class: 'delivery-inputs' });
      const sum = el('div', { class: 'delivery-summary' });

      while (col.firstChild) wrap.appendChild(col.firstChild);
      col.appendChild(wrap);

      function safeVal(sel) {
        const n = wrap.querySelector(sel);
        return n ? (n.value || '') : '';
      }
      function safeTextSelected(sel) {
        const n = wrap.querySelector(sel);
        if (!n || !n.selectedOptions || !n.selectedOptions[0]) return '';
        return n.selectedOptions[0].text || '';
      }

      function upd() {
        const a1 = safeTrim(safeVal('#ctl00_PageBody_DeliveryAddress_AddressLine1'));
        const a2 = safeTrim(safeVal('#ctl00_PageBody_DeliveryAddress_AddressLine2'));
        const c = safeTrim(safeVal('#ctl00_PageBody_DeliveryAddress_City'));
        const s = safeTrim(safeTextSelected('#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList'));
        const z = safeTrim(safeVal('#ctl00_PageBody_DeliveryAddress_Postcode'));

        sum.innerHTML = `
          <div class="wl-card">
            <div class="wl-card-title">Delivery Address</div>
            <div class="wl-card-body">
              ${a1 ? a1 : '<span class="wl-muted">Not set yet</span>'}${a2 ? '<br>' + a2 : ''}<br>
              ${[c, s, z].filter(Boolean).join(', ').replace(/,\s*,/g, ', ')}
            </div>
            <div class="wl-card-actions">
              <button type="button" class="btn btn-link" id="editDelivery">Edit</button>
            </div>
          </div>`;
        updateSummary();
      }

      wrap.style.display = 'none';
      col.insertBefore(sum, wrap);

      sum.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'editDelivery') {
          e.preventDefault();
          sum.style.display = 'none';
          wrap.style.display = '';
          scrollToNice(wrap);
        }
      });

      // Add a lightweight "Save & continue" that doesn't postback
      if (!wrap.querySelector('#saveDelivery')) {
        const btn = el('button', { type: 'button', id: 'saveDelivery', class: 'btn btn-primary mt-2' }, ['Save']);
        wrap.appendChild(btn);
        btn.addEventListener('click', () => {
          upd();
          wrap.style.display = 'none';
          sum.style.display = '';
          toast('Saved.', 'ok');
        });
      }

      // live updates
      ['input', 'change'].forEach((ev) => {
        wrap.addEventListener(ev, () => { try { upd(); } catch {} }, true);
      });

      upd();
    })();

    // -----------------------------------------------------------------------
    // Billing same-as-delivery + summary/edit (Step 6) – kept + hardened
    // Auto-trigger CopyDeliveryAddress postback ONCE if needed.
    // -----------------------------------------------------------------------
    (function () {
      const pane6 = wizard.querySelector('.checkout-step[data-step="6"]');
      if (!pane6) return;

      const orig = document.getElementById('copyDeliveryAddressButton');
      if (orig) orig.style.display = 'none';

      const chkDiv = el('div', { class: 'form-check mb-3', html: `
        <input class="form-check-input" type="checkbox" id="sameAsDeliveryCheck">
        <label class="form-check-label" for="sameAsDeliveryCheck">Billing address is the same as delivery address</label>
      `});
      pane6.insertBefore(chkDiv, pane6.firstChild);

      const sameCheck = chkDiv.querySelector('#sameAsDeliveryCheck');
      const colInv = pane6.querySelector('.epi-form-col-single-checkout');
      if (!colInv) return;

      const wrapInv = el('div', { class: 'invoice-inputs' });
      const sumInv = el('div', { class: 'invoice-summary' });

      while (colInv.firstChild) wrapInv.appendChild(colInv.firstChild);
      colInv.appendChild(wrapInv);

      const q = (sel) => wrapInv.querySelector(sel);

      function invoiceLooksBlank() {
        const invLine1 = safeTrim(q('#ctl00_PageBody_InvoiceAddress_AddressLine1')?.value);
        const invCity  = safeTrim(q('#ctl00_PageBody_InvoiceAddress_City')?.value);
        const invZip   = safeTrim(q('#ctl00_PageBody_InvoiceAddress_Postcode')?.value);
        return !invLine1 && !invCity && !invZip;
      }
      function deliveryHasData() {
        const delLine1 = safeTrim(document.getElementById('ctl00_PageBody_DeliveryAddress_AddressLine1')?.value);
        const delCity  = safeTrim(document.getElementById('ctl00_PageBody_DeliveryAddress_City')?.value);
        const delZip   = safeTrim(document.getElementById('ctl00_PageBody_DeliveryAddress_Postcode')?.value);
        return !!(delLine1 || delCity || delZip);
      }

      function refreshInv() {
        const a1 = safeTrim(q('#ctl00_PageBody_InvoiceAddress_AddressLine1')?.value);
        const a2 = safeTrim(q('#ctl00_PageBody_InvoiceAddress_AddressLine2')?.value);
        const c  = safeTrim(q('#ctl00_PageBody_InvoiceAddress_City')?.value);
        const st = safeTrim(q('#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList')?.selectedOptions?.[0]?.text);
        const z  = safeTrim(q('#ctl00_PageBody_InvoiceAddress_Postcode')?.value);
        const e  = safeTrim(q('#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox')?.value).replace(/^\([^)]*\)\s*/, '');

        sumInv.innerHTML = `
          <div class="wl-card">
            <div class="wl-card-title">Billing Address</div>
            <div class="wl-card-body">
              ${a1 ? a1 : '<span class="wl-muted">Not set yet</span>'}${a2 ? '<br>' + a2 : ''}<br>
              ${[c, st, z].filter(Boolean).join(', ').replace(/,\s*,/g, ', ')}<br>
              <span class="wl-muted">Email:</span> ${e || '—'}
            </div>
            <div class="wl-card-actions">
              <button type="button" class="btn btn-link" id="editInvoice">Enter a different billing address</button>
            </div>
          </div>`;
        updateSummary();
      }

      wrapInv.style.display = 'none';
      sumInv.style.display = 'none';
      colInv.insertBefore(sumInv, wrapInv);

      // Initial state from storage
      const sameStored = getSameAsDelivery();
      sameCheck.checked = sameStored;

      // If same-as-delivery AND invoice blank after reload, trigger server-side copy once.
      if (sameStored && invoiceLooksBlank() && deliveryHasData() && !autoCopyAlreadyDone()) {
        markAutoCopyDone();
        setReturnStep(6);
        setExpectedNav(true);
        setNavIntent('autocopy');
        try {
          showOverlay('Copying address…');
          window.__doPostBack('ctl00$PageBody$CopyDeliveryAddressLinkButton', '');
          return;
        } catch {
          hideOverlay();
        }
      }

      function setModeSummary() {
        refreshInv();
        wrapInv.style.display = 'none';
        sumInv.style.display = '';
      }
      function setModeEdit() {
        sumInv.style.display = 'none';
        wrapInv.style.display = '';
      }

      if (sameStored) setModeSummary();
      else setModeEdit();

      sameCheck.addEventListener('change', function () {
        if (this.checked) {
          setReturnStep(6);
          setExpectedNav(true);
          setNavIntent('copy');
          setSameAsDelivery(true);
          markAutoCopyDone();
          try {
            showOverlay('Copying address…');
            window.__doPostBack('ctl00$PageBody$CopyDeliveryAddressLinkButton', '');
          } catch {
            hideOverlay();
          }
        } else {
          setSameAsDelivery(false);
          setModeEdit();
        }
      });

      sumInv.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'editInvoice') {
          e.preventDefault();
          sameCheck.checked = false;
          setSameAsDelivery(false);
          setModeEdit();
          scrollToNice(wrapInv);
        }
      });

      // keep summary fresh
      ['input', 'change'].forEach((ev) => {
        wrapInv.addEventListener(ev, () => { try { refreshInv(); } catch {} }, true);
      });

      refreshInv();
    })();

    // -----------------------------------------------------------------------
    // Prefill delivery/contact info (kept light; never triggers change)
    // -----------------------------------------------------------------------
    try {
      if ($ && !$('#ctl00_PageBody_DeliveryAddress_AddressLine1').val()) {
        const $entries = $('.AddressSelectorEntry');
        if ($entries.length) {
          let $pick = $entries.first();
          let minId = parseInt($pick.find('.AddressId').text(), 10);

          $entries.each(function () {
            const id = parseInt($(this).find('.AddressId').text(), 10);
            if (id < minId) { minId = id; $pick = $(this); }
          });

          const parts = $pick.find('dd p').first().text().trim().split(',').map((s) => s.trim());
          const line1 = parts[0] || '';
          const city = parts[1] || '';
          let state = '', zip = '';

          if (parts.length >= 4) {
            state = parts[parts.length - 2] || '';
            zip = parts[parts.length - 1] || '';
          } else if (parts.length > 2) {
            const m = (parts[2] || '').match(/(.+?)\s*(\d{5}(?:-\d{4})?)?$/);
            if (m) { state = safeTrim(m[1]); zip = m[2] || ''; }
          }

          $('#ctl00_PageBody_DeliveryAddress_AddressLine1').val(line1);
          $('#ctl00_PageBody_DeliveryAddress_City').val(city);
          $('#ctl00_PageBody_DeliveryAddress_Postcode').val(zip);
          $('#ctl00_PageBody_DeliveryAddress_CountrySelector').val('USA');

          $('#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList option').each(function () {
            if ($(this).text().trim().toLowerCase() === state.toLowerCase()) {
              $(this).prop('selected', true);
              return false;
            }
          });
        }
      }
    } catch {}

    // Pull names/email/phone via GET (same as your file)
    if ($) {
      $.get('https://webtrack.woodsonlumber.com/AccountSettings.aspx', (data) => {
        const $acc = $(data);
        const fn = safeTrim($acc.find('#ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput').val());
        const ln = safeTrim($acc.find('#ctl00_PageBody_ChangeUserDetailsControl_LastNameInput').val());
        const em = safeTrim(($acc.find('#ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput').val() || '').replace(/^\([^)]*\)\s*/, ''));

        const setIfExists = (sel, val) => {
          const $el = $(sel);
          if ($el.length && val) $el.val(val);
        };

        setIfExists('#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox', fn);
        setIfExists('#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox', ln);

        setIfExists('#ctl00_PageBody_InvoiceAddress_ContactFirstNameTextBox', fn);
        setIfExists('#ctl00_PageBody_InvoiceAddress_ContactLastNameTextBox', ln);

        setIfExists('#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox', em);

        updateSummary();
      });

      $.get('https://webtrack.woodsonlumber.com/AccountInfo_R.aspx', (data) => {
        const tel = safeTrim($(data).find('#ctl00_PageBody_TelephoneLink_TelephoneLink').text());
        if (tel) $('#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox').val(tel);
      });
    }

    // -----------------------------------------------------------------------
    // Step 7: pickup/delivery + special instructions
    // Fix: Same-day pickup times must be >= 2 hours out (rounded up) (kept)
    // -----------------------------------------------------------------------
    (function () {
      const p7 = wizard.querySelector('.checkout-step[data-step="7"]');
      if (!p7) return;

      const parseLocalDate = (s) => {
        const [y, m, d] = s.split('-').map(Number);
        return new Date(y, m - 1, d);
      };
      const formatLocal = (d) => {
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${d.getFullYear()}-${mm}-${dd}`;
      };

      const specialIns = document.getElementById('ctl00_PageBody_SpecialInstructionsTextBox');
      if (!specialIns) return;

      const siWrap = specialIns.closest('.epi-form-group-checkout') ||
        specialIns.closest('.epi-form-col-single-checkout') ||
        specialIns.parentElement;

      specialIns.style.display = 'none';

      const pickupDiv = el('div', { class: 'form-group wl-datebox', html: `
        <label for="pickupDate">Requested Pickup Date</label>
        <input type="date" id="pickupDate" class="form-control">
        <label for="pickupTime">Pickup Time Window</label>
        <select id="pickupTime" class="form-control" disabled></select>
        <label for="pickupPerson">Pickup Person</label>
        <input type="text" id="pickupPerson" class="form-control" placeholder="Who will pick this up?">
      `});
      pickupDiv.style.display = 'none';

      const deliveryDiv = el('div', { class: 'form-group wl-datebox', html: `
        <label for="deliveryDate">Requested Delivery Date</label>
        <input type="date" id="deliveryDate" class="form-control">
        <div class="wl-radio-row">
          <label><input type="radio" name="deliveryTime" value="Morning"> Morning</label>
          <label><input type="radio" name="deliveryTime" value="Afternoon"> Afternoon</label>
        </div>
      `});
      deliveryDiv.style.display = 'none';

      siWrap.insertAdjacentElement('afterend', pickupDiv);
      pickupDiv.insertAdjacentElement('afterend', deliveryDiv);

      const extraDiv = el('div', { class: 'form-group', html: `
        <label for="specialInsExtra">Additional instructions (optional)</label>
        <textarea id="specialInsExtra" class="form-control" placeholder="Gate code, preferred call/text, where to drop, etc."></textarea>
      `});
      deliveryDiv.insertAdjacentElement('afterend', extraDiv);

      const specialExtra = document.getElementById('specialInsExtra');

      const today = new Date();
      const isoToday = formatLocal(today);
      const maxPickupD = new Date(); maxPickupD.setDate(maxPickupD.getDate() + 14);
      const minDelD = new Date(); minDelD.setDate(minDelD.getDate() + 2);

      const pickupInput = pickupDiv.querySelector('#pickupDate');
      const pickupTimeSel = pickupDiv.querySelector('#pickupTime');
      const deliveryInput = deliveryDiv.querySelector('#deliveryDate');

      pickupInput.setAttribute('min', isoToday);
      pickupInput.setAttribute('max', formatLocal(maxPickupD));
      deliveryInput.setAttribute('min', formatLocal(minDelD));

      function formatTime(h, m) {
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hh = h % 12 || 12;
        const mm = String(m).padStart(2, '0');
        return `${hh}:${mm} ${ampm}`;
      }
      function minutesFromMidnight(d) { return d.getHours() * 60 + d.getMinutes(); }
      function getSameDayMinStartMins() {
        const now = new Date();
        const mins = minutesFromMidnight(now) + 120;
        return Math.ceil(mins / 60) * 60;
      }

      function populatePickupTimes(date) {
        const day = date.getDay();
        let openMins = 7 * 60 + 30;
        let closeMins;

        if (1 <= day && day <= 5) closeMins = 17 * 60 + 30;
        else if (day === 6) closeMins = 16 * 60;
        else closeMins = openMins + 60; // Sunday: effectively none

        const isSameDay = date.toDateString() === today.toDateString();

        let minStart = openMins;
        if (isSameDay) minStart = Math.max(openMins, getSameDayMinStartMins());

        pickupTimeSel.innerHTML = '';
        minStart = Math.ceil(minStart / 60) * 60;

        for (let m = minStart; m + 60 <= closeMins; m += 60) {
          const start = formatTime(Math.floor(m / 60), m % 60);
          const end = formatTime(Math.floor((m + 60) / 60), (m + 60) % 60);
          const opt = document.createElement('option');
          opt.value = `${start}–${end}`;
          opt.text = `${start} – ${end}`;
          pickupTimeSel.appendChild(opt);
        }

        pickupTimeSel.disabled = false;
        if (!pickupTimeSel.options.length) {
          pickupTimeSel.disabled = true;
          const opt = document.createElement('option');
          opt.value = '';
          opt.text = 'No pickup times available today (select another date)';
          pickupTimeSel.appendChild(opt);
        }
      }

      pickupInput.addEventListener('change', function () {
        if (!this.value) return updateSpecial();
        let d = parseLocalDate(this.value);

        if (d.getDay() === 0) { toast('No Sunday pickups — moved to Monday.', 'info'); d.setDate(d.getDate() + 1); }
        if (d > maxPickupD) { toast('Pickups are available within the next 2 weeks.', 'info'); d = maxPickupD; }

        this.value = formatLocal(d);
        populatePickupTimes(d);
        updateSpecial();
      });

      deliveryInput.addEventListener('change', function () {
        if (!this.value) return updateSpecial();
        let d = parseLocalDate(this.value);

        if (d.getDay() === 0) { toast('No Sunday deliveries — moved to Monday.', 'info'); d.setDate(d.getDate() + 1); }
        if (d < minDelD) { toast('Delivery requires at least 2 days notice.', 'info'); d = minDelD; }

        this.value = formatLocal(d);
        updateSpecial();
      });

      const rbPick = document.getElementById('ctl00_PageBody_SaleTypeSelector_rbCollectLater');
      const rbDel = document.getElementById('ctl00_PageBody_SaleTypeSelector_rbDelivered');
      const zipInput = document.getElementById('ctl00_PageBody_DeliveryAddress_Postcode');

      function inZone(z) {
        return ['75', '76', '77', '78', '79'].includes((z || '').substring(0, 2));
      }

      function updateSpecial() {
        let baseText = '';

        if (rbPick && rbPick.checked) {
          const d = pickupInput.value;
          const t = pickupTimeSel.disabled ? '' : pickupTimeSel.value;
          const p = safeTrim(pickupDiv.querySelector('#pickupPerson')?.value);

          specialIns.readOnly = false;
          baseText = 'Pickup on ' + d + (t ? ' at ' + t : '') + (p ? ' for ' + p : '');
        } else if (rbDel && rbDel.checked) {
          specialIns.readOnly = true;
          if (inZone(zipInput ? zipInput.value : '')) {
            const d2 = deliveryInput.value;
            const t2 = deliveryDiv.querySelector('input[name="deliveryTime"]:checked');
            baseText = 'Delivery on ' + d2 + (t2 ? ' (' + t2.value + ')' : '');
          } else {
            baseText = 'Ship via 3rd party delivery on next screen.';
          }
        }

        specialIns.value = baseText + (specialExtra.value ? ' – ' + specialExtra.value : '');
        updateSummary();
      }

      function onShip() {
        if (rbPick && rbPick.checked) {
          pickupDiv.style.display = 'block';
          deliveryDiv.style.display = 'none';
          if (pickupInput.value) populatePickupTimes(parseLocalDate(pickupInput.value));
        } else if (rbDel && rbDel.checked) {
          pickupDiv.style.display = 'none';
          deliveryDiv.style.display = 'block';
        } else {
          pickupDiv.style.display = 'none';
          deliveryDiv.style.display = 'none';
        }
        updateSpecial();
      }

      if (rbPick) rbPick.addEventListener('change', onShip);
      if (rbDel) rbDel.addEventListener('change', onShip);

      pickupDiv.querySelector('#pickupPerson')?.addEventListener('input', updateSpecial);
      pickupTimeSel.addEventListener('change', updateSpecial);
      deliveryDiv.querySelectorAll('input[name="deliveryTime"]').forEach((r) => r.addEventListener('change', updateSpecial));
      specialExtra.addEventListener('input', updateSpecial);

      onShip();

      // Client validation on Continue buttons (kept concept, with nicer messages)
      if ($) {
        $('#ctl00_PageBody_ContinueButton1, #ctl00_PageBody_ContinueButton2').on('click', function (e) {
          setReturnStep(7);
          setExpectedNav(true);
          setNavIntent('continue');

          let valid = true;
          const errors = [];

          if ($('#deliveryDate').closest('.form-group').is(':visible')) {
            if (!$('#deliveryDate').val()) { valid = false; errors.push('Please select a Requested Delivery Date.'); }
            if (!$('input[name="deliveryTime"]:checked').length) { valid = false; errors.push('Please choose Morning or Afternoon.'); }
          }

          if ($('#pickupDate').closest('.form-group').is(':visible')) {
            if (!$('#pickupDate').val()) { valid = false; errors.push('Please select a Requested Pickup Date.'); }
            if (!safeTrim($('#pickupPerson').val())) { valid = false; errors.push('Please enter a Pickup Person.'); }
            if ($('#pickupTime').prop('disabled') || !$('#pickupTime').val()) { valid = false; errors.push('Please select an available Pickup Time.'); }
          }

          if (!valid) {
            e.preventDefault();
            toast(errors[0], 'warn');
            showStep(7);
            setExpectedNav(false);
            return;
          }

          showOverlay('Submitting…');
          setTimeout(() => WL.detectAndJumpToValidation?.(), 900);
        });
      }
    })();

    // -----------------------------------------------------------------------
    // Validation scanner → jump to step containing first visible error (kept)
    // -----------------------------------------------------------------------
    (function () {
      function findFirstInvalidElement() {
        const perInputSelectors = [
          'input.input-validation-error',
          'select.input-validation-error',
          'textarea.input-validation-error',
          'input.is-invalid',
          'select.is-invalid',
          'textarea.is-invalid',
          '[aria-invalid="true"]',
        ].join(',');

        const badInputs = Array.from(document.querySelectorAll(perInputSelectors)).filter(isVisible);
        if (badInputs.length) return badInputs[0];

        const validators = Array.from(document.querySelectorAll('span[controltovalidate], span.validator, .field-validation-error, .text-danger'))
          .filter((n) => isVisible(n) && safeTrim(n.textContent).length >= 1);

        if (validators.length) {
          const sp = validators[0];
          const ctl = sp.getAttribute('controltovalidate');
          if (ctl) {
            const target = document.getElementById(ctl);
            if (target) return target;
          }
          const nearby = sp.closest('.epi-form-group-checkout, .form-group, .epi-form-col-single-checkout')?.querySelector('input,select,textarea');
          return nearby || sp;
        }

        const summary = document.querySelector('.validation-summary-errors li, .validation-summary-errors');
        if (summary && isVisible(summary)) return summary;

        return null;
      }

      function paneStepFor(node) {
        const pane = node && node.closest ? node.closest('.checkout-step') : null;
        return pane && pane.dataset.step ? parseInt(pane.dataset.step, 10) : null;
      }

      function detectAndJumpToValidation() {
        const culprit = findFirstInvalidElement();
        if (!culprit) return false;
        const stepNum = paneStepFor(culprit) || 2;
        showStep(stepNum);
        scrollToNice(culprit);
        return true;
      }

      WL.detectAndJumpToValidation = detectAndJumpToValidation;
    })();

    // -----------------------------------------------------------------------
    // Modern transaction & shipping selectors (kept, lightly tightened)
    // -----------------------------------------------------------------------
    if ($) {
      $(function () {
        if ($('#ctl00_PageBody_TransactionTypeDiv').length) {
          $('.TransactionTypeSelector').hide();

          const txnHTML = `
            <div class="modern-transaction-selector d-flex justify-content-around">
              <button type="button" id="btnOrder" class="btn btn-primary" data-value="rdbOrder">
                <i class="fas fa-shopping-cart"></i> Order
              </button>
              <button type="button" id="btnQuote" class="btn btn-secondary" data-value="rdbQuote">
                <i class="fas fa-file-alt"></i> Request Quote
              </button>
            </div>`;
          $('#ctl00_PageBody_TransactionTypeDiv').append(txnHTML);

          function updateTransactionStyles(val) {
            const orderRad = $('#ctl00_PageBody_TransactionTypeSelector_rdbOrder');
            const quoteRad = $('#ctl00_PageBody_TransactionTypeSelector_rdbQuote');

            if (val === 'rdbOrder') {
              orderRad.prop('checked', true);
              $('#btnOrder').addClass('btn-primary').removeClass('btn-secondary');
              $('#btnQuote').addClass('btn-secondary').removeClass('btn-primary');
            } else {
              quoteRad.prop('checked', true);
              $('#btnQuote').addClass('btn-primary').removeClass('btn-secondary');
              $('#btnOrder').addClass('btn-secondary').removeClass('btn-primary');
            }
            updateSummary();
          }

          updateTransactionStyles($('#ctl00_PageBody_TransactionTypeSelector_rdbOrder').is(':checked') ? 'rdbOrder' : 'rdbQuote');

          $(document).on('click', '.modern-transaction-selector button', function () {
            updateTransactionStyles($(this).data('value'));
            setStep(1);
            // auto-advance
            showStep(2);
          });
        }

        if ($('.SaleTypeSelector').length) {
          $('.SaleTypeSelector').hide();

          const shipHTML = `
            <div class="modern-shipping-selector d-flex justify-content-around">
              <button type="button" id="btnDelivered" class="btn btn-primary" data-value="rbDelivered">
                <i class="fas fa-truck"></i> Delivered
              </button>
              <button type="button" id="btnPickup" class="btn btn-secondary" data-value="rbCollectLater">
                <i class="fas fa-store"></i> Pickup (Free)
              </button>
            </div>`;
          $('.epi-form-col-single-checkout:has(.SaleTypeSelector)').append(shipHTML);

          $('<style>.modern-shipping-selector .btn[disabled], .modern-shipping-selector .btn.disabled { pointer-events:auto; }</style>').appendTo(document.head);

          function updateShippingStyles(val) {
            const delRad = $('#ctl00_PageBody_SaleTypeSelector_rbDelivered');
            const pickRad = $('#ctl00_PageBody_SaleTypeSelector_rbCollectLater');
            const $btnDelivered = $('#btnDelivered');
            const $btnPickup = $('#btnPickup');

            $btnDelivered.removeClass('disabled opacity-50').removeAttr('disabled').attr('aria-disabled', 'false');
            $btnPickup.removeClass('disabled opacity-50').removeAttr('disabled').attr('aria-disabled', 'false');

            if (val === 'rbDelivered') {
              delRad.prop('checked', true).trigger('change');
              $btnDelivered.addClass('btn-primary').removeClass('btn-secondary opacity-50').attr('aria-pressed', 'true');
              $btnPickup.addClass('btn-secondary opacity-50').removeClass('btn-primary').attr('aria-pressed', 'false');
              document.cookie = 'pickupSelected=false; path=/';
              document.cookie = 'skipBack=false; path=/';
            } else {
              pickRad.prop('checked', true).trigger('change');
              $btnPickup.addClass('btn-primary').removeClass('btn-secondary opacity-50').attr('aria-pressed', 'true');
              $btnDelivered.addClass('btn-secondary opacity-50').removeClass('btn-primary').attr('aria-pressed', 'false');
              document.cookie = 'pickupSelected=true; path=/';
              document.cookie = 'skipBack=true; path=/';
            }

            setStep(2);
            updateSummary();
            // auto-advance
            showStep(3);
          }

          updateShippingStyles($('#ctl00_PageBody_SaleTypeSelector_rbDelivered').is(':checked') ? 'rbDelivered' : 'rbCollectLater');

          $(document).on('click', '.modern-shipping-selector button', function () {
            updateShippingStyles($(this).data('value'));
          });
        }
      });
    }

    // Hide "Special Instructions" header if present
    try {
      document.querySelectorAll('th').forEach((th) => {
        if ((th.textContent || '').includes('Special Instructions')) th.style.display = 'none';
      });
    } catch {}

    // Reset wizard state on Place Order / Back to Cart
    (function () {
      const placeOrderBtn = document.getElementById('ctl00_PageBody_PlaceOrderButton');
      const backToCartBtn = document.getElementById('ctl00_PageBody_BackToCartButton3');

      function resetWizardState() {
        setSameAsDelivery(false);
        try { localStorage.removeItem(STEP_KEY); } catch {}
        try {
          sessionStorage.removeItem('wl_returnStep');
          sessionStorage.removeItem('wl_expect_nav');
          sessionStorage.removeItem('wl_autocopy_done');
          sessionStorage.removeItem('wl_nav_intent');
        } catch {}
      }

      if (placeOrderBtn) placeOrderBtn.addEventListener('click', resetWizardState, true);
      if (backToCartBtn) backToCartBtn.addEventListener('click', resetWizardState, true);
    })();

    // -----------------------------------------------------------------------
    // Summary bar logic (reads from real fields; never forces postback)
    // -----------------------------------------------------------------------
    function updateSummary() {
      const orderRad = document.getElementById('ctl00_PageBody_TransactionTypeSelector_rdbOrder');
      const quoteRad = document.getElementById('ctl00_PageBody_TransactionTypeSelector_rdbQuote');

      const rbDel = document.getElementById('ctl00_PageBody_SaleTypeSelector_rbDelivered');
      const rbPick = document.getElementById('ctl00_PageBody_SaleTypeSelector_rbCollectLater');

      const brSel = document.getElementById('ctl00_PageBody_BranchSelector');
      const brTxt = brSel && brSel.selectedOptions && brSel.selectedOptions[0] ? safeTrim(brSel.selectedOptions[0].text) : safeTrim(brSel?.value);

      const shipTxt = rbPick && rbPick.checked ? 'Pickup' : (rbDel && rbDel.checked ? 'Delivered' : '—');
      const orderTxt = quoteRad && quoteRad.checked ? 'Quote' : 'Order';

      const si = document.getElementById('ctl00_PageBody_SpecialInstructionsTextBox');
      const datesTxt = si ? (safeTrim(si.value).match(/(Pickup|Delivery|Ship).*$/i)?.[0] || '') : '';

      const set = (id, val) => { const n = document.getElementById(id); if (n) n.textContent = val || '—'; };
      set('wlSumOrder', orderTxt);
      set('wlSumShip', shipTxt);
      set('wlSumBranch', brTxt || '—');
      set('wlSumDates', datesTxt || '—');
    }

    // Edit shortcuts
    summaryBar.querySelector('#wlEditShip')?.addEventListener('click', () => showStep(2));
    summaryBar.querySelector('#wlEditAddr')?.addEventListener('click', () => showStep(5));

    // Keep summary current when key inputs change
    ['change', 'input'].forEach((ev) => {
      wizard.addEventListener(ev, (e) => {
        const t = e.target;
        if (!t) return;
        const id = t.id || '';
        if (id.includes('TransactionTypeSelector') || id.includes('SaleTypeSelector') || id.includes('BranchSelector') || id.includes('SpecialInstructionsTextBox')) {
          updateSummary();
        }
      }, true);
    });

    // -----------------------------------------------------------------------
    // Restore step after load / postback (hardened)
    // -----------------------------------------------------------------------
    function restoreStep() {
      const expectedNav = consumeExpectedNav(); // fileciteturn1file0L16-L29
      const returnStep = consumeReturnStep();
      const saved = getStep();
      const initial = returnStep || saved || 2;

      showStep(initial);

      const intent = consumeNavIntent();
      if (expectedNav || intent) {
        // Try jump to validation quickly; if none, keep step
        const tryJump = () => WL.detectAndJumpToValidation?.() === true;
        if (!tryJump()) {
          setTimeout(tryJump, 0);
          setTimeout(tryJump, 300);
          setTimeout(tryJump, 1200);
          setTimeout(() => { if (!tryJump()) showStep(returnStep || saved || 2); }, 1600);
        }
      }
    }

    restoreStep();

    // Extra resilience: if a postback re-renders parts of the page, ensure
    // our wizard still shows the right pane and summary is in sync.
    const mo = new MutationObserver(() => {
      try { updateSummary(); } catch {}
    });
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch {}

    // Finally: hook overlay
    wireOverlayForPostbacks();
    hideOverlay();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 5) CSS (compact, modern, but plays nice with Bootstrap)
  // ────────────────────────────────────────────────────────────────────────────
  function injectCSS() {
    if (document.getElementById('wlCheckoutCSS')) return;
    const css = `
      .checkout-wizard { margin: 12px 0 18px; border-radius: 16px; border: 1px solid rgba(0,0,0,.08); padding: 14px; background: #fff; box-shadow: 0 6px 22px rgba(0,0,0,.06); }
      .wl-wiz-head { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; padding: 6px 4px 10px; }
      .wl-wiz-title { font-size: 22px; font-weight: 800; }
      .wl-wiz-sub { color: rgba(0,0,0,.6); font-size: 13px; }

      .checkout-steps { list-style:none; padding:0; margin: 10px 0 12px; display:flex; flex-wrap:wrap; gap:8px; }
      .checkout-steps li { cursor:pointer; user-select:none; padding: 8px 10px; border-radius: 999px; border:1px solid rgba(0,0,0,.12); font-size: 13px; background: rgba(0,0,0,.02); }
      .checkout-steps li.active { border-color: rgba(0,0,0,.24); background: rgba(0,0,0,.05); font-weight: 700; }
      .checkout-steps li.completed { opacity: .7; }

      .checkout-step { display:none; padding: 10px 6px 12px; }
      .checkout-step.active { display:block; }
      .checkout-nav { display:flex; gap:10px; justify-content:space-between; margin-top: 10px; }

      .wl-summarybar { position: sticky; top: 8px; z-index: 5; border-radius: 14px; border: 1px solid rgba(0,0,0,.10); background: rgba(255,255,255,.92); backdrop-filter: blur(10px); padding: 10px; margin: 8px 0 12px; }
      .wl-sum-grid { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)) auto; gap: 10px; align-items:center; }
      .wl-sum-item { min-width: 0; }
      .wl-sum-k { font-size: 11px; color: rgba(0,0,0,.55); text-transform: uppercase; letter-spacing: .04em; }
      .wl-sum-v { font-size: 13px; font-weight: 700; overflow:hidden; text-overflow: ellipsis; white-space: nowrap; }
      .wl-sum-actions { display:flex; gap: 8px; justify-content:flex-end; }
      @media (max-width: 900px){ .wl-sum-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .wl-sum-actions { justify-content:flex-start; } }

      .wl-card { border: 1px solid rgba(0,0,0,.10); border-radius: 14px; padding: 10px; background: rgba(0,0,0,.02); }
      .wl-card-title { font-weight: 800; margin-bottom: 4px; }
      .wl-card-body { font-size: 13px; line-height: 1.35; }
      .wl-card-actions { margin-top: 6px; }
      .wl-muted { color: rgba(0,0,0,.55); }

      .wl-datebox { border: 1px solid rgba(0,0,0,.10); border-radius: 14px; padding: 10px; background: rgba(0,0,0,.02); }
      .wl-radio-row { display:flex; gap: 16px; margin: 6px 0 2px; }

      .wl-toast-host { position: fixed; right: 12px; bottom: 12px; z-index: 2147483646; display:flex; flex-direction:column; gap: 10px; }
      .wl-toast { min-width: 260px; max-width: 360px; border-radius: 14px; border: 1px solid rgba(0,0,0,.10); background: rgba(255,255,255,.96); box-shadow: 0 10px 30px rgba(0,0,0,.12); padding: 10px 10px 10px 12px; display:flex; align-items:flex-start; gap: 10px; }
      .wl-toast.ok { border-color: rgba(40,167,69,.28); }
      .wl-toast.warn { border-color: rgba(255,193,7,.38); }
      .wl-toast-msg { font-size: 13px; line-height: 1.25; }
      .wl-toast-x { margin-left:auto; border:none; background:transparent; font-size: 18px; line-height: 1; opacity: .7; cursor:pointer; }

      .wl-overlay { position: fixed; inset:0; display:flex; align-items:center; justify-content:center; background: rgba(0,0,0,.35); z-index: 2147483647; padding: 18px; }
      .wl-overlay-card { width: min(520px, 100%); border-radius: 18px; background: #fff; border: 1px solid rgba(0,0,0,.10); box-shadow: 0 22px 60px rgba(0,0,0,.25); padding: 18px; display:flex; flex-direction:column; gap: 8px; text-align:center; }
      .wl-spinner { width: 28px; height: 28px; border-radius: 999px; border: 3px solid rgba(0,0,0,.16); border-top-color: rgba(0,0,0,.55); margin: 0 auto 4px; animation: wlspin 1s linear infinite; }
      .wl-overlay-title { font-weight: 900; font-size: 16px; }
      .wl-overlay-sub { color: rgba(0,0,0,.55); font-size: 13px; }
      @keyframes wlspin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
      .wl-busy { cursor: progress; }

      /* Cart drawer */
      .wl-cart-drawer { position: fixed; inset:0; z-index: 2147483645; background: rgba(0,0,0,.35); display:flex; align-items:center; justify-content:center; padding: 16px; }
      .wl-cart-drawer-inner { width: min(720px, 100%); background:#fff; border-radius: 18px; border: 1px solid rgba(0,0,0,.10); box-shadow: 0 22px 60px rgba(0,0,0,.25); padding: 14px; }
      .wl-cart-drawer-head { display:flex; align-items:flex-start; justify-content:space-between; gap: 10px; }
      .wl-cart-drawer-title { font-weight: 900; font-size: 16px; }
      .wl-cart-drawer-sub { color: rgba(0,0,0,.55); font-size: 13px; margin-top: 2px; }
      .wl-x { border:none; background:transparent; font-size: 22px; line-height: 1; opacity: .7; cursor:pointer; }
      .wl-quick-links { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 12px 0; }
      .wl-ql { display:block; padding: 10px; border-radius: 14px; border:1px solid rgba(0,0,0,.10); background: rgba(0,0,0,.02); text-decoration:none; color: inherit; font-weight: 700; font-size: 13px; text-align:center; }
      .wl-cart-drawer-actions { display:flex; gap: 10px; justify-content:flex-end; }
      @media (max-width: 720px){ .wl-quick-links { grid-template-columns: repeat(2, minmax(0, 1fr)); } .wl-cart-drawer-actions { flex-direction:column; } }
    `;
    const style = el('style', { id: 'wlCheckoutCSS' }, [css]);
    document.head.appendChild(style);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 6) Boot
  // ────────────────────────────────────────────────────────────────────────────
  injectCSS();
  ensureOverlay();
  wireOverlayForPostbacks();

  if (isCart) {
    document.addEventListener('DOMContentLoaded', () => {
      try { initCartNudge(); } catch (e) { LOG('cart nudge error', e); }
    });
  }

  if (isCheckout) {
    document.addEventListener('DOMContentLoaded', () => {
      try { initCheckoutWizard(); } catch (e) { LOG('checkout wizard error', e); hideOverlay(); }
    });
  }
})();
