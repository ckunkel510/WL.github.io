// ─────────────────────────────────────────────────────────────────────────────
// Woodson WebTrack Checkout Wizard (Modern Flow Rebuild + Fixes)
// Fixes:
//  1) Same-day pickup times must be >= 2 hours out
//  2) Billing "same as delivery" persistence: if invoice fields blank after reload,
//     auto-trigger CopyDeliveryAddress postback ONCE per session and return to Step 5
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  // WebTrack now receives native UPS XML rates through the OAuth compatibility bridge.
  const UPS_SHIPPING_ENABLED = true;

  function suppressQuoteCheckoutPath() {
    if (!/ShoppingCart\.aspx/i.test(window.location.pathname || "")) return;

    const order = document.getElementById("ctl00_PageBody_TransactionTypeSelector_rdbOrder");
    const quote = document.getElementById("ctl00_PageBody_TransactionTypeSelector_rdbQuote");
    if (order) order.checked = true;
    if (quote) quote.checked = false;

    document.querySelectorAll(
      "#ctl00_PageBody_TransactionTypeDiv, .TransactionTypeSelector, " +
      ".wl-quote-cart, .wl-quote-cta, [data-wl='quote-cta']"
    ).forEach(function (node) {
      const transactionRow = node.matches("#ctl00_PageBody_TransactionTypeDiv, .TransactionTypeSelector")
        ? (node.closest(".row") || node.parentElement)
        : null;
      if (transactionRow) transactionRow.style.setProperty("display", "none", "important");
      node.style.setProperty("display", "none", "important");
      if (node.matches(".wl-quote-cart, .wl-quote-cta, [data-wl='quote-cta']")) node.remove();
    });
  }

  suppressQuoteCheckoutPath();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", suppressQuoteCheckoutPath, { once: true });
  }

  try {
    if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager) {
      Sys.WebForms.PageRequestManager.getInstance().add_endRequest(suppressQuoteCheckoutPath);
    }
  } catch {}

  const quoteObserver = new MutationObserver(suppressQuoteCheckoutPath);
  if (document.documentElement) quoteObserver.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(function () { quoteObserver.disconnect(); }, 15000);
  
  // ---------------------------------------------------------------------------
  // HOTFIX: Some builds referenced getDeliveredSelected()/getPickupSelected()
  // but didn't define them, which breaks the wizard and greys out steps.
  // Keep these tiny and WebForms-safe.
  // ---------------------------------------------------------------------------
  function getDeliveredSelected() {
    const el = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbDelivered");
    if (el && el.checked) return true;
    const ups = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbUPSDelivery");
    if (ups && ups.checked) return true;
    // Fallback: modern selector buttons (no radio checked yet)
    try {
      const btn = document.querySelector(`.modern-shipping-selector button[data-value="rbDelivered"].is-selected, .modern-shipping-selector button[data-value="rbDelivered"].selected, .modern-shipping-selector button[data-value="rbDelivered"].active, .modern-shipping-selector button[data-value="rbDelivered"].wl-selected`);
      if (btn) return true;
    } catch {}
    return false;
  }
  function getPickupSelected() {
    const el = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbCollectLater");
    if (el && el.checked) return true;
    // Fallback: modern selector buttons (no radio checked yet)
    try {
      const btn = document.querySelector(`.modern-shipping-selector button[data-value="rbCollectLater"].is-selected, .modern-shipping-selector button[data-value="rbCollectLater"].selected, .modern-shipping-selector button[data-value="rbCollectLater"].active, .modern-shipping-selector button[data-value="rbCollectLater"].wl-selected`);
      if (btn) return true;
    } catch {}
    return false;
  }
  function getSaleType() {
    if (getPickupSelected()) return 'pickup';
    if (!getDeliveredSelected()) return '';
    return getFulfillmentIntent() === 'ship' ? 'ship' : 'delivery';
  }

  function syncNativeRequiredDate() {
    const saleType = getSaleType();
    const source = saleType === "pickup"
      ? document.getElementById("pickupDate")
      : (saleType === "delivery" ? document.getElementById("deliveryDate") : null);
    const match = source && String(source.value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return;

    const year = match[1];
    const month = match[2];
    const day = match[3];
    const isoDate = year + "-" + month + "-" + day;
    const displayDate = Number(month) + "/" + Number(day) + "/" + year;
    const validationDate = isoDate + "-00-00-00";
    const picker = document.getElementById("ctl00_PageBody_dtRequired_DatePicker");
    const dateInput = document.getElementById("ctl00_PageBody_dtRequired_DatePicker_dateInput");
    const clientState = document.getElementById("ctl00_PageBody_dtRequired_DatePicker_dateInput_ClientState");

    if (picker) picker.value = isoDate;
    if (dateInput) dateInput.value = displayDate;
    if (clientState) {
      try {
        const state = JSON.parse(clientState.value || "{}");
        state.validationText = validationDate;
        state.valueAsString = validationDate;
        state.lastSetTextBoxValue = displayDate;
        clientState.value = JSON.stringify(state);
      } catch {}
    }
  }

  const SINGLE_PAGE_SESSION_KEY = "wl_checkout_single_page_preview";
  const AUTO_ADVANCE_KEY = "wl_checkout_auto_advance";
  const FULFILLMENT_INTENT_KEY = "wl_fulfillment_intent";

  function getFulfillmentIntent() {
    try {
      const intent = sessionStorage.getItem(FULFILLMENT_INTENT_KEY) || "";
      if (!UPS_SHIPPING_ENABLED && intent === "ship") {
        sessionStorage.removeItem(FULFILLMENT_INTENT_KEY);
        sessionStorage.removeItem("wl_fulfillment_method");
        return "";
      }
      return intent;
    } catch { return ""; }
  }

  function setFulfillmentIntent(value) {
    try {
      if (value) sessionStorage.setItem(FULFILLMENT_INTENT_KEY, value);
      else sessionStorage.removeItem(FULFILLMENT_INTENT_KEY);
    } catch {}
  }

  function isShippingIntent() {
    if (!UPS_SHIPPING_ENABLED) return false;
    const ups = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbUPSDelivery");
    return getFulfillmentIntent() === "ship" || !!(ups && ups.checked);
  }

  function isSinglePageCheckout() {
    try {
      const requested = new URLSearchParams(window.location.search).get("wlCheckout");
      if (requested === "single") sessionStorage.setItem(SINGLE_PAGE_SESSION_KEY, "1");
      if (requested === "wizard") sessionStorage.setItem(SINGLE_PAGE_SESSION_KEY, "0");

      const stored = sessionStorage.getItem(SINGLE_PAGE_SESSION_KEY);
      if (stored === "0") return false;
      if (stored === "1") return true;

      // The consolidated flow is now the customer default. Keep ?wlCheckout=wizard
      // as a session-scoped fallback while the new layout is monitored in production.
      sessionStorage.setItem(SINGLE_PAGE_SESSION_KEY, "1");
      return true;
    } catch {
      return true;
    }
  }

  // Capture the preview flag on the cart before sign-in redirects back into checkout.
  isSinglePageCheckout();

  function injectSinglePageStyles() {
    if (document.getElementById("wl-single-page-checkout-css")) return;

    const style = document.createElement("style");
    style.id = "wl-single-page-checkout-css";
    style.textContent = `
      .checkout-wizard.wl-single-page{
        width:min(100%,960px);max-width:960px;margin:24px auto 48px;padding:0 20px;color:#20242a;
        box-sizing:border-box;min-width:0;
      }
      .checkout-wizard.wl-single-page *{box-sizing:border-box;}
      .checkout-wizard.wl-single-page .checkout-steps{display:none!important;}
      .checkout-wizard.wl-single-page .checkout-step{
        display:block!important;margin:0;padding:24px 0;border-bottom:1px solid #d9dde2;background:#fff;
      }
      .checkout-wizard.wl-single-page .checkout-step:first-of-type{border-top:1px solid #d9dde2;}
      .checkout-wizard.wl-single-page .checkout-step.wl-step-unavailable{display:none!important;}
      .checkout-wizard.wl-single-page .wl-section-heading{
        display:flex;align-items:center;gap:12px;margin:0 0 20px;
      }
      .checkout-wizard.wl-single-page .wl-section-heading .wl-step-icon{
        width:38px;height:38px;flex:0 0 38px;border:1px solid #d9dde2;border-radius:8px;
        color:#6b0016;background:#f8f7f7;
      }
      .checkout-wizard.wl-single-page .wl-section-heading .wl-step-icon svg{width:21px;height:21px;}
      .checkout-wizard.wl-single-page .wl-section-title{
        margin:0;font-size:20px;line-height:1.25;font-weight:700;letter-spacing:0;color:#20242a;
      }
      .checkout-wizard.wl-single-page .checkout-nav{display:none!important;}
      .checkout-wizard.wl-single-page .checkout-step[data-step="5"] .checkout-nav{
        display:flex!important;justify-content:flex-end;margin-top:24px;padding-top:20px;border-top:1px solid #d9dde2;
      }
      .checkout-wizard.wl-single-page .checkout-step[data-step="5"] .wl-proxy-continue{
        width:min(100%,360px);min-height:48px;margin-left:auto;border:1px solid #6b0016!important;
        border-radius:6px!important;background:#6b0016!important;color:#fff!important;font-weight:700;
      }
      .checkout-wizard.wl-single-page .modern-shipping-selector{
        display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;justify-content:stretch!important;
      }
      .checkout-wizard.wl-single-page .modern-shipping-selector button{
        min-height:72px;width:100%;margin:0!important;padding:14px 16px!important;border-radius:8px!important;
        font-size:16px!important;font-weight:700!important;box-shadow:none!important;
      }
      .checkout-wizard.wl-single-page .modern-shipping-selector .wl-option-label{display:block;font-weight:800;}
      .checkout-wizard.wl-single-page .modern-shipping-selector .wl-option-meta{display:block;margin-top:4px;font-size:12px;font-weight:500;line-height:1.25;opacity:.82;}
      .checkout-wizard.wl-single-page .modern-shipping-selector .wl-option-tag{
        display:inline-block;margin-top:7px;padding:3px 7px;border-radius:999px;background:#eceff1;color:#34383c;
        font-size:11px;font-weight:800;line-height:1.2;
      }
      .checkout-wizard.wl-single-page .modern-shipping-selector button.wl-selected .wl-option-tag{background:rgba(255,255,255,.2);color:#fff;}
      .checkout-wizard.wl-single-page .wl-section-heading{flex-wrap:wrap;}
      .checkout-wizard.wl-single-page .wl-section-summary{flex:1 1 260px;min-width:0;margin-left:4px;color:#555;font-size:14px;line-height:1.35;}
      .checkout-wizard.wl-single-page .wl-section-edit{
        display:none;flex:0 0 auto;min-height:38px;padding:7px 12px;border:1px solid #aeb4ba;border-radius:6px;background:#fff;color:#6b0016;font-weight:700;
      }
      .checkout-wizard.wl-single-page .checkout-step.wl-section-collapsed .wl-section-edit{display:block;}
      .checkout-wizard.wl-single-page .checkout-step.wl-section-collapsed{padding:16px 0;}
      .checkout-wizard.wl-single-page .checkout-step.wl-section-collapsed>.wl-section-heading{margin:0;}
      .checkout-wizard.wl-single-page .checkout-step.wl-section-collapsed>:not(.wl-section-heading):not(.wl-section-summary):not(.checkout-nav){display:none!important;}
      .checkout-wizard.wl-single-page .checkout-step.wl-section-collapsed .wl-section-heading .wl-step-icon{background:#f1f6f2;color:#246b35;border-color:#c8ddce;}
      .checkout-wizard.wl-single-page .checkout-step.wl-section-deferred .wl-section-heading .wl-step-icon{background:#f5f5f5;color:#747a80;border-color:#d9dde2;}
      .checkout-wizard.wl-single-page .checkout-step.wl-section-deferred .wl-section-edit{display:none!important;}
      .checkout-wizard.wl-single-page .form-group,
      .checkout-wizard.wl-single-page .epi-form-group-checkout{
        max-width:none;margin:0 0 16px;align-items:stretch;
      }
      .checkout-wizard.wl-single-page input:not([type="radio"]):not([type="checkbox"]),
      .checkout-wizard.wl-single-page select,
      .checkout-wizard.wl-single-page textarea{
        min-height:44px;border:1px solid #b9c0c8!important;border-radius:6px!important;background:#fff;
        box-shadow:none!important;
      }
      .checkout-wizard.wl-single-page textarea{min-height:96px;}
      .checkout-wizard.wl-single-page input:focus,
      .checkout-wizard.wl-single-page select:focus,
      .checkout-wizard.wl-single-page textarea:focus{
        border-color:#6b0016!important;outline:3px solid rgba(196,151,45,.24)!important;outline-offset:1px;
      }
      .checkout-wizard.wl-single-page .wl-branch-card,
      .checkout-wizard.wl-single-page .wl-address-summary{border-radius:8px!important;box-shadow:none!important;}
      .checkout-wizard.wl-single-page .wl-inline-error{border-radius:6px;}
      .checkout-wizard.wl-single-page .wl-smart-handoff{
        display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 18px;padding:14px 16px;
        border:1px solid #d9dde2;border-left:4px solid #6b0016;border-radius:6px;background:#f7f7f8;
      }
      .checkout-wizard.wl-single-page .wl-smart-handoff-copy{min-width:0;color:#30353a;line-height:1.4;}
      .checkout-wizard.wl-single-page .wl-smart-handoff-copy strong{display:block;margin-bottom:2px;color:#20242a;}
      .checkout-wizard.wl-single-page .wl-smart-handoff button{
        flex:0 0 auto;min-height:40px;padding:8px 13px;border:1px solid #aab0b6;border-radius:6px;background:#fff;color:#20242a;font-weight:700;
      }
      @media (max-width:991px){
        body.wl-checkout-active #MainLayoutRow{width:100%!important;max-width:none!important;margin:0!important;}
        body.wl-checkout-active #MainLayoutRow>.container-fluid{
          width:100%!important;max-width:none!important;margin:0!important;padding:0 16px!important;
        }
        body.wl-checkout-active #MainLayoutRow .row{width:auto!important;max-width:none!important;margin:0!important;}
        body.wl-checkout-active #MainLayoutRow .col{
          width:100%!important;max-width:100%!important;flex:0 0 100%!important;margin:0!important;padding:0!important;
        }
        body.wl-checkout-active #MainLayoutRow .col>.container{
          width:100%!important;max-width:none!important;margin:0!important;padding:0!important;
        }
        .checkout-wizard.wl-single-page{width:100%!important;max-width:none!important;margin:16px auto 36px!important;padding:0 8px!important;}
      }
      @media (max-width:767px){
        body.wl-checkout-active #MainLayoutRow>.container-fluid{padding:0 12px!important;}
        .checkout-wizard.wl-single-page{width:100%!important;max-width:none!important;margin:12px auto 32px!important;padding:0 4px!important;}
        .checkout-wizard.wl-single-page .checkout-step{padding:20px 0;}
        .checkout-wizard.wl-single-page .wl-section-title{font-size:18px;}
        .checkout-wizard.wl-single-page .modern-shipping-selector{grid-template-columns:1fr;}
        .checkout-wizard.wl-single-page .wl-section-heading{
          display:grid!important;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;column-gap:12px;row-gap:6px;
        }
        .checkout-wizard.wl-single-page .wl-section-heading .wl-step-icon{grid-column:1;grid-row:1;}
        .checkout-wizard.wl-single-page .wl-section-title{grid-column:2;grid-row:1;min-width:0;}
        .checkout-wizard.wl-single-page .wl-section-summary{grid-column:2 / 4;grid-row:2;width:auto;min-width:0;margin:0;}
        .checkout-wizard.wl-single-page .wl-section-edit{grid-column:3;grid-row:1;margin:0;}
        .checkout-wizard.wl-single-page .epi-form-group-checkout{display:block!important;width:100%!important;max-width:100%!important;}
        .checkout-wizard.wl-single-page .form-group{width:100%!important;max-width:100%!important;}
        .checkout-wizard.wl-single-page label{max-width:100%;}
        .checkout-wizard.wl-single-page input:not([type="radio"]):not([type="checkbox"]),
        .checkout-wizard.wl-single-page select,
        .checkout-wizard.wl-single-page textarea{width:100%!important;max-width:100%!important;min-width:0!important;}
        .checkout-wizard.wl-single-page .checkout-step[data-step="5"] .wl-proxy-continue{width:100%;}
        .checkout-wizard.wl-single-page .wl-smart-handoff{display:grid;grid-template-columns:minmax(0,1fr);align-items:stretch;width:100%;}
        .checkout-wizard.wl-single-page .wl-smart-handoff-copy,.checkout-wizard.wl-single-page .wl-smart-handoff button{width:100%;min-width:0;}
      }
    `;
    document.head.appendChild(style);
  }

// ---------------------------------------------------------------------------
  // 0) Storage helpers (TTL for step; sessionStorage for returnStep)
  // ---------------------------------------------------------------------------
  const STEP_KEY = "wl_currentStep";
  const SAME_KEY = "wl_sameAsDelivery";
  const TTL_MS = 10 * 60 * 1000; // 10 minutes

  function setWithExpiry(key, value, ttlMs) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ value, expiry: Date.now() + ttlMs })
      );
    } catch {}
  }
  function getWithExpiry(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const item = JSON.parse(raw);
      if (!item || typeof item !== "object" || !("expiry" in item)) {
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

  function setStep(n) {
    setWithExpiry(STEP_KEY, String(n), TTL_MS);
  }
  function getStep() {
    const v = getWithExpiry(STEP_KEY);
    return v != null ? parseInt(v, 10) : null;
  }

  function setSameAsDelivery(val) {
    try {
      localStorage.setItem(SAME_KEY, val ? "true" : "false");
    } catch {}
  }
  function getSameAsDelivery() {
    try {
      return localStorage.getItem(SAME_KEY) === "true";
    } catch {
      return false;
    }
  }

  function setReturnStep(n) {
    try {
      sessionStorage.setItem("wl_returnStep", String(n));
    } catch {}
  }
  function consumeReturnStep() {
    try {
      const v = sessionStorage.getItem("wl_returnStep");
      if (v) sessionStorage.removeItem("wl_returnStep");
      return v ? parseInt(v, 10) : null;
    } catch {
      return null;
    }
  }

  function setExpectedNav(flag) {
    try {
      sessionStorage.setItem("wl_expect_nav", flag ? "1" : "0");
    } catch {}
  }
  function consumeExpectedNav() {
    try {
      const v = sessionStorage.getItem("wl_expect_nav") === "1";
      sessionStorage.removeItem("wl_expect_nav");
      return v;
    } catch {
      return false;
    }
  }


  // Pickup flow confirmation: ensure the user sees Billing summary before Date/Instructions.
  function setBillingConfirmed(flag) {
    try { sessionStorage.setItem("wl_billing_confirmed", flag ? "1" : "0"); } catch {}
  }
  function isBillingConfirmed() {
    try { return sessionStorage.getItem("wl_billing_confirmed") === "1"; } catch { return false; }
  }
  function clearBillingConfirmed() { setBillingConfirmed(false); }

  
  // Track whether Billing step has been shown this session.
  // Prevents WebForms/postback restores from jumping past Billing straight to Step 5.
  function setBillingSeen(flag) {
    try { sessionStorage.setItem("wl_billing_seen", flag ? "1" : "0"); } catch {}
  }
  function isBillingSeen() {
    try { return sessionStorage.getItem("wl_billing_seen") === "1"; } catch { return false; }
  }
// One-time per-session guard for auto-copy
  function markAutoCopyDone() {
    try { sessionStorage.setItem("wl_autocopy_done", "1"); } catch {}
  }
  function autoCopyAlreadyDone() {
    try { return sessionStorage.getItem("wl_autocopy_done") === "1"; } catch { return false; }
  }

  window.WLCheckout = window.WLCheckout || {};
  window.WLCheckout.setStep = setStep;
  window.WLCheckout.getStep = getStep;
  window.WLCheckout.setReturnStep = setReturnStep;
  window.WLCheckout.TTL_MS = TTL_MS;

  // ---------------------------------------------------------------------------
  // 1) DOM Ready
  // ---------------------------------------------------------------------------
  function initCheckout() {
    const $ = window.jQuery;

    // -------------------------------------------------------------------------
    // A) Hide legacy UI bits
    // -------------------------------------------------------------------------
    try {
      const dateColDefault = document.getElementById(
        "ctl00_PageBody_dtRequired_DatePicker_wrapper"
      );
      if (dateColDefault) dateColDefault.style.display = "none";

      if ($) {
        $("label")
          .filter(function () {
            return $(this).text().trim() === "Date required:";
          })
          .hide();
        $("div.form-control").hide();
        $("#ctl00_PageBody_dtRequired_DatePicker_wrapper").hide();
        $("#ctl00_PageBody_dtRequired_DatePicker_wrapper")
          .closest(".epi-form-col-single-checkout.epi-form-group-checkout")
          .hide();

        $(".submit-button-panel").hide();
      }

      if ($) $("#ctl00_PageBody_BackToCartButton2").val("Back to Cart");
    } catch {}

    // -------------------------------------------------------------------------
    // B) Build wizard container only once
    // -------------------------------------------------------------------------
    const container = document.querySelector(".container");
    if (!container) return;

    // Do not build the checkout wizard on the regular cart page or unrelated WebTrack pages.
    // The page must have at least one of the actual checkout controls.
    const hasCheckoutControls =
      document.getElementById("ctl00_PageBody_SaleTypeSelector_rbDelivered") ||
      document.getElementById("ctl00_PageBody_SaleTypeSelector_rbCollectLater") ||
      document.getElementById("ctl00_PageBody_InvoiceAddress_GoogleAddressSearchWrapper") ||
      document.getElementById("ctl00_PageBody_SpecialInstructionsTextBox");
    if (!hasCheckoutControls) return;

    try { document.body.classList.add("wl-checkout-active"); } catch {}

    if (document.querySelector(".checkout-wizard")) return;

    const wizard = document.createElement("div");
    wizard.className = "checkout-wizard";
    container.insertBefore(wizard, container.firstChild);

    const singlePageCheckout = isSinglePageCheckout();
    if (singlePageCheckout) {
      wizard.classList.add("wl-single-page");
      injectSinglePageStyles();
    }

    const nav = document.createElement("ul");
    nav.className = "checkout-steps";
    wizard.appendChild(nav);

    function isEl(x) {
      return x && x.nodeType === 1;
    }

    // -------------------------------------------------------------------------
    // C) Steps definition
    // -------------------------------------------------------------------------
    const steps = [
      {
        title: "Fulfillment",
        findEls: () => {
          const ship = document.getElementById(
            "ctl00_PageBody_SaleTypeSelector_lblDelivered"
          );
          return ship ? [ship.closest(".epi-form-col-single-checkout")] : [];
        },
      },
      {
        title: "Branch",
        findEls: () => {
          const br = document.getElementById("ctl00_PageBody_BranchSelector");
          return br ? [br] : [];
        },
      },
      {
        title: "Delivery / Shipping Address",
        findEls: () => {
          const hdr = document.querySelector(".SelectableAddressType");
          return hdr ? [hdr.closest(".epi-form-col-single-checkout")] : [];
        },
      },
      {
        title: "Billing Address",
        findEls: () => {
          const gp = document.getElementById(
            "ctl00_PageBody_InvoiceAddress_GoogleAddressSearchWrapper"
          );
          return gp ? [gp.closest(".epi-form-col-single-checkout")] : [];
        },
      },
      {
        title: "Timing & Instructions",
        findEls: () => {
          const arr = [];

          const po = document.getElementById(
            "ctl00_PageBody_PurchaseOrderNumberTextBox"
          );
          if (po) {
            const wrap =
              po.closest(".epi-form-group-checkout") ||
              po.closest(".epi-form-col-single-checkout") ||
              po.parentElement;
            if (wrap) arr.push(wrap);
          }
          const tbl = document.querySelector(".cartTable");
          if (tbl) arr.push(tbl.closest("table"));
          const si = document.getElementById("ctl00_PageBody_SpecialInstructionsTextBox");
          if (si) {
            const wrap =
              si.closest(".epi-form-group-checkout") ||
              si.closest(".epi-form-col-single-checkout") ||
              si.parentElement;
            if (wrap) arr.push(wrap);
          }
          return arr;
        },
      },
    ];

    
    // -------------------------------------------------------------------------
    // C.5) Pickup mode + address syncing helpers (WebForms-safe)
    // New step numbers after removing Order Details:
    //  1 Ship/Pickup, 2 Branch (pickup only), 3 Delivery Address (delivered only),
    //  4 Billing Address, 5 Date & Instructions (includes Your reference)
    // -------------------------------------------------------------------------
    function getBranchField() {
      const host = document.getElementById("ctl00_PageBody_BranchSelector");
      if (!host) return null;
      if (host.tagName === "SELECT" || host.tagName === "INPUT") return host;
      return host.querySelector("select, input");
    }

    function isBranchChosen(field) {
      if (!field) return false;
      const v = norm(field.value);
      if (!v || v === "0") return false;

      if (field.tagName === "SELECT") {
        const selected = field.options && field.selectedIndex >= 0 ? field.options[field.selectedIndex] : null;
        const txt = selected ? norm(selected.textContent || selected.text || "") : "";
        if (!txt || /^select/i.test(txt)) return false;
      }

      return true;
    }

    // --------------------------------------------------
    // Branch picker UI (Pickup only): cards + "selected" summary
    // --------------------------------------------------
    function wlCleanBranchText(txt) {
      const t = norm(txt);
      if (!t) return "";
      return t
        .replace(/,\s*PO BOX[^,]*,/gi, ",")
        .replace(/,\s*PO BOX[^,]*$/gi, "")
        .replace(/\s{2,}/g, " ")
        .replace(/\s+,/g, ",")
        .trim();
    }

    function wlParseBranchOption(label) {
      const raw = wlCleanBranchText(label);
      const parts = raw.split(" - ");
      if (parts.length >= 2) {
        return { name: parts[0].trim(), address: parts.slice(1).join(" - ").trim() };
      }
      return { name: raw, address: "" };
    }

    function wlHtml(s) {
      return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function wlTriggerBranchPostback(selectEl) {
      if (!selectEl) return;
      try { sessionStorage.setItem("wl_pendingStep", "2"); } catch {}
      try {
        const ev = new Event("change", { bubbles: true });
        selectEl.dispatchEvent(ev);
      } catch {}
      try {
        if (typeof __doPostBack === "function") {
          setTimeout(function () {
            __doPostBack("ctl00$PageBody$BranchDropDownList", "");
          }, 0);
        }
      } catch {}
    }

    function enhanceBranchPicker() {
      if (!getPickupSelected()) return;

      const sel = document.getElementById("ctl00_PageBody_BranchDropDownList") || getBranchField();
      if (!sel || sel.tagName !== "SELECT") return;

      try {
        const label = sel.closest(".epi-form-group-checkout")?.querySelector("label");
        if (label) label.textContent = "Select pickup branch:";
      } catch {}

      const host = sel.closest(".epi-form-group-checkout") || sel.parentElement;
      if (!host) return;

      let wrap = host.querySelector("#wlBranchCardsWrap");
      if (!wrap) {
        wrap = document.createElement("div");
        wrap.id = "wlBranchCardsWrap";
        wrap.className = "wl-branch-wrap";
        const overflowWrap = sel.closest(".overflow-hidden") || sel.parentElement;
        (overflowWrap || host).appendChild(wrap);
      }

      try { sel.classList.add("wl-hidden-select"); } catch {}
      try {
        sel.style.position = "absolute";
        sel.style.left = "-9999px";
        sel.style.width = "1px";
        sel.style.height = "1px";
        sel.style.opacity = "0";
      } catch {}

      const opts = Array.from(sel.options || [])
        .map(function (o) {
          const parsed = wlParseBranchOption(o.textContent || o.label || "");
          return {
            value: norm(o.value),
            selected: !!o.selected,
            name: parsed.name,
            address: parsed.address,
            raw: wlCleanBranchText(o.textContent || o.label || "")
          };
        })
        .filter(function (o) {
          return o.value && o.value !== "0" && o.name && !/^select/i.test(o.name);
        });

      if (!opts.length) return;

      const selectedValue = norm(sel.value);
      const current = opts.find(o => o.value === selectedValue) || null;
      const choices = current ? opts.filter(o => o.value !== current.value) : opts;

      wrap.innerHTML = `
        <div class="wl-branch-selected">
          <div class="wl-branch-selected-title">Pickup branch</div>
          ${current ? `
            <div class="wl-branch-card wl-branch-card-selected">
              <div class="wl-branch-name">${wlHtml(current.name)}</div>
              <div class="wl-branch-addr">${wlHtml(current.address)}</div>
              <div class="wl-branch-cta">Selected</div>
            </div>
          ` : `
            <div class="wl-branch-card wl-branch-card-empty">
              <div class="wl-branch-name">Choose your pickup store</div>
              <div class="wl-branch-addr">Select the location where you want to pick up your order.</div>
            </div>
          `}
        </div>
        <div class="wl-branch-list-title">${current ? "Other stores" : "Stores"}</div>
        <div class="wl-branch-grid">
          ${choices.map(o => `
            <button type="button" class="wl-branch-card wl-branch-card-option" data-value="${wlHtml(o.value)}">
              <div class="wl-branch-name">${wlHtml(o.name)}</div>
              <div class="wl-branch-addr">${wlHtml(o.address)}</div>
              <div class="wl-branch-cta">Choose this store</div>
            </button>
          `).join("")}
        </div>
      `;

      wrap.querySelectorAll(".wl-branch-card-option[data-value]").forEach(function (card) {
        card.addEventListener("click", function () {
          const v = (this.getAttribute("data-value") || "").trim();
          if (!v) return;

          try { sel.value = v; } catch {}
          try {
            Array.from(sel.options).forEach(o => { o.selected = (norm(o.value) === v); });
          } catch {}
          try { localStorage.setItem("wl_last_branch", v); } catch {}

          try { enhanceBranchPicker(); } catch {}
          wlTriggerBranchPostback(sel);
        });
      });
    }

    function autoSelectDefaultBranch() {
      const field = getBranchField();
      if (!field) return false;
      if (isBranchChosen(field)) return true;

      // Try last used branch first
      let last = "";
      try { last = localStorage.getItem("wl_last_branch") || ""; } catch {}
      if (last && field.tagName === "SELECT") {
        const opts = Array.from(field.options || []);
        const match = opts.find(o => norm(o.value) === norm(last));
        if (match) { field.value = match.value; return isBranchChosen(field); }
      }

      // Otherwise pick first non-placeholder option
      if (field.tagName === "SELECT") {
        const opts = Array.from(field.options || []);
        const candidate = opts.find(o => {
          const val = norm(o.value);
          const txt = norm(o.textContent || o.text || "");
          return val && val !== "0" && !/^select/i.test(txt);
        });
        if (candidate) {
          field.value = candidate.value;
          return isBranchChosen(field);
        }
      }
      return false;
    }

    function setStepVisibility(stepNum, isVisible) {
      const li = nav.querySelector(`li[data-step="${stepNum}"]`);
      const pane = wizard.querySelector(`.checkout-step[data-step="${stepNum}"]`);
      if (li) li.style.display = isVisible ? "" : "none";
      if (pane) {
        pane.style.display = isVisible ? "" : "none";
        pane.classList.toggle("wl-step-unavailable", !isVisible);
        if (singlePageCheckout) pane.classList.toggle("active", !!isVisible);
      }
    }

    function setDeliverySectionVisibility(isVisible) {
      // Keep underlying server controls in DOM, but hide the whole visual block.
      const pane4 = wizard.querySelector('.checkout-step[data-step="3"]');
      if (!pane4) return;
      const col = pane4.querySelector(".epi-form-col-single-checkout");
      if (col) col.style.display = isVisible ? "" : "none";
    }

    // In Pickup mode we hide the Delivery step, but WebTrack still requires a phone.
    // We surface the Delivery phone field inside Billing step so customers can complete it.
    function mountPickupPhoneInBilling(enable) {
      const phoneEl = document.getElementById("ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox");
      if (!phoneEl) return;

      let row = phoneEl.closest(".epi-form-group") || phoneEl.closest("div");
      if (!row) row = phoneEl.parentElement;
      if (!row) return;

      if (!row.dataset.wlOrigParentId) {
        const p = row.parentElement;
        if (p) {
          if (!p.id) p.id = "wl_del_phone_parent_" + Math.random().toString(16).slice(2);
          row.dataset.wlOrigParentId = p.id;
        }
      }

      const pane4 = wizard.querySelector('.checkout-step[data-step="4"]');
      if (!pane4) return;
      const target = pane4.querySelector(".epi-form-col-single-checkout") || pane4;

      if (enable) {
        if (!pane4.contains(row)) {
          const holderId = "wlPickupPhoneHolder";
          let holder = document.getElementById(holderId);
          if (!holder) {
            holder = document.createElement("div");
            holder.id = holderId;
            holder.className = "wl-pickup-phone mb-3";
            holder.innerHTML = `<div class="font-weight-bold mb-1">Phone (for order updates)</div>`;
            target.insertBefore(holder, target.firstChild);
          }
          holder.appendChild(row);
        }
        row.style.display = "";
      } else {
        const origId = row.dataset.wlOrigParentId;
        const orig = origId ? document.getElementById(origId) : null;
        if (orig && !orig.contains(row)) orig.appendChild(row);
      }
    }

    function updatePickupModeUI() {
      const pickup = getPickupSelected();
      const delivered = getDeliveredSelected();
      const hasSaleType = pickup || delivered;

      // Step 2 Branch: show for Pickup, hide for Delivered.
      setStepVisibility(2, !!pickup);

      if (!pickup && delivered) {
        // Ensure branch has a default value so WebTrack doesn't complain later.
        autoSelectDefaultBranch();
      }

      // Step 3 Delivery Address: hide + skip in pickup mode
      setStepVisibility(3, singlePageCheckout ? (!!delivered && !pickup) : !pickup);
      setDeliverySectionVisibility(!pickup);

      // The single-page preview reveals the remaining sections after fulfillment
      // is selected, keeping the first decision focused without adding pagination.
      if (singlePageCheckout) {
        setStepVisibility(4, hasSaleType);
        setStepVisibility(5, hasSaleType);
      }

      // Phone requirement: surface delivery phone inside billing when pickup
      mountPickupPhoneInBilling(!!pickup);

      // Billing same-as-delivery checkbox: hide in pickup mode
      try {
        if (window.WLCheckout && typeof window.WLCheckout.setSameAsDeliveryVisible === 'function') {
          window.WLCheckout.setSameAsDeliveryVisible(!pickup);
        }
      } catch {}

      // If pickup, keep Delivery inputs populated (or at least valid) to satisfy server-side required fields.
      if (pickup) {
        try { ensureDeliveryRequiredForPickup(); } catch { try { syncBillingToDelivery({force:false}); } catch {} }
      }
    
      // Enhance Branch selector UI when Pickup is selected
      try { enhanceBranchPicker(); } catch {}
}

    window.WLCheckout = window.WLCheckout || {};
    window.WLCheckout.updatePickupModeUI = updatePickupModeUI;
    window.WLCheckout.syncBillingToDelivery = syncBillingToDelivery;
    function norm(s) { return String(s || "").trim(); }

    function setIf(el, val) {
      if (!el) return;
      el.value = val;
      // IMPORTANT: don't trigger change/input on server controls unless needed.
    }

    function selectByText(selectEl, text) {
      if (!selectEl) return false;
      const t = norm(text).toLowerCase();
      if (!t) return false;
      const opts = Array.from(selectEl.options || []);
      // exact match
      let hit = opts.find(o => norm(o.text).toLowerCase() === t) || null;
      // try abbreviations (TX -> Texas) and vice versa
      if (!hit && t.length === 2) {
        const map = { al:"alabama", ak:"alaska", az:"arizona", ar:"arkansas", ca:"california", co:"colorado", ct:"connecticut",
          de:"delaware", fl:"florida", ga:"georgia", hi:"hawaii", id:"idaho", il:"illinois", in:"indiana", ia:"iowa", ks:"kansas",
          ky:"kentucky", la:"louisiana", me:"maine", md:"maryland", ma:"massachusetts", mi:"michigan", mn:"minnesota", ms:"mississippi",
          mo:"missouri", mt:"montana", ne:"nebraska", nv:"nevada", nh:"new hampshire", nj:"new jersey", nm:"new mexico", ny:"new york",
          nc:"north carolina", nd:"north dakota", oh:"ohio", ok:"oklahoma", or:"oregon", pa:"pennsylvania", ri:"rhode island",
          sc:"south carolina", sd:"south dakota", tn:"tennessee", tx:"texas", ut:"utah", vt:"vermont", va:"virginia", wa:"washington",
          wv:"west virginia", wi:"wisconsin", wy:"wyoming", dc:"district of columbia" };
        const full = map[t];
        if (full) hit = opts.find(o => norm(o.text).toLowerCase() === full) || null;
      }
      if (hit) {
        selectEl.value = hit.value;
        return true;
      }
      return false;
    }

    function showInlineError(stepNum, msg) {
      const pane = wizard.querySelector(`.checkout-step[data-step="${stepNum}"]`);
      if (!pane) return;
      let box = pane.querySelector(".wl-inline-error");
      if (!box) {
        box = document.createElement("div");
        box.className = "wl-inline-error alert alert-warning";
        box.style.marginBottom = "12px";
        pane.insertBefore(box, pane.firstChild);
      }
      box.innerHTML = msg;
    }

    function clearInlineError(stepNum) {
      const pane = wizard.querySelector(`.checkout-step[data-step="${stepNum}"]`);
      const box = pane && pane.querySelector(".wl-inline-error");
      if (box) box.remove();
    }


    // -------------------------------------------------------------------------
    // Guided checkout validation + persistence helpers
    // -------------------------------------------------------------------------
    const WL_CHECKOUT_SNAPSHOT_KEY = "wl_checkout_form_snapshot_v2";
    const WL_CHECKOUT_MODE_KEY = "wl_checkout_mode";
    const WL_GUEST_KEY = "wl_guest_checkout_payload";
    const WL_GUEST_AUTOFILL_KEY = "wl_guest_checkout_needs_autofill";
    const WL_DATE_STATE_KEY_GLOBAL = "wl_checkout_date_state_v2";
    const WL_REQUIRED_CLASS = "wl-field-invalid";

    function wlCheckoutMode() {
      try { return sessionStorage.getItem(WL_CHECKOUT_MODE_KEY) || ""; } catch { return ""; }
    }

    const WL_FIELD_LABELS = {
      "ContactFirstNameTextBox": "First name",
      "ContactLastNameTextBox": "Last name",
      "ContactTelephoneTextBox": "Phone",
      "EmailAddressTextBox": "Email",
      "AddressLine1": "Street address",
      "City": "City",
      "Postcode": "ZIP",
      "CountySelector_CountyList": "State",
      "CountrySelector": "Country",
      "CountrySelector1": "Country"
    };

    function wlDigits(v) { return String(v || "").replace(/[^\d]/g, ""); }

    function wlIsPlaceholderText(t) {
      const x = String(t || "").trim().toLowerCase();
      return !x || x === "0" || x === "00" || x === "select" || x === "[select]" || /select\s+(state|county|country|province)/i.test(x) || /^\[?select/i.test(x);
    }

    function wlSelectedText(selectEl) {
      if (!selectEl) return "";
      const opt = selectEl.selectedOptions && selectEl.selectedOptions[0] ? selectEl.selectedOptions[0] : null;
      return String((opt && (opt.text || opt.textContent)) || "").trim();
    }

    function wlSelectIsValid(selectEl) {
      if (!selectEl) return false;
      const v = String(selectEl.value || "").trim();
      const t = wlSelectedText(selectEl);
      return !!v && v !== "0" && v !== "00" && !wlIsPlaceholderText(t || v);
    }

    function wlNormalizeZipValue(raw) {
      const original = String(raw || "").trim();
      const d = wlDigits(original);
      if (d.length === 5) return d;
      if (d.length === 9) return d.slice(0, 5) + "-" + d.slice(5);
      return original;
    }

    function wlNormalizePhoneValue(raw) {
      const d = wlDigits(raw);
      if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
      if (d.length === 11 && d[0] === "1") return `(${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
      return String(raw || "").trim();
    }

    function wlSetPlainValue(el, value) {
      if (!el) return;
      try { el.value = value; } catch {}
    }

    function wlNormalizeFieldValues(prefix) {
      try {
        const zip = document.getElementById(`ctl00_PageBody_${prefix}_Postcode`);
        if (zip && zip.value) zip.value = wlNormalizeZipValue(zip.value);
      } catch {}
      try {
        const phone = document.getElementById(`ctl00_PageBody_${prefix}_ContactTelephoneTextBox`) ||
          (prefix === "InvoiceAddress" ? document.getElementById("ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox") : null);
        if (phone && phone.value) phone.value = wlNormalizePhoneValue(phone.value);
      } catch {}
      try {
        const country = document.getElementById(`ctl00_PageBody_${prefix}_CountrySelector${prefix === "InvoiceAddress" ? "1" : ""}`);
        if (country && (!String(country.value || "").trim() || String(country.value || "").trim() === "00" || wlIsPlaceholderText(wlSelectedText(country)))) {
          country.value = "USA";
        }
      } catch {}
    }

    function wlFieldLabel(el, fallback) {
      if (!el) return fallback || "Required field";
      const id = el.id || "";
      for (const key in WL_FIELD_LABELS) {
        if (id.indexOf(key) >= 0) return WL_FIELD_LABELS[key];
      }
      try {
        const label = el.closest(".epi-form-group-checkout,.epi-form-group,div")?.querySelector("label");
        if (label && String(label.textContent || "").trim()) return String(label.textContent || "").replace(/[:*]/g, "").trim();
      } catch {}
      return fallback || "Required field";
    }

    function wlClearFieldInvalid(root) {
      try {
        (root || document).querySelectorAll("." + WL_REQUIRED_CLASS).forEach((el) => el.classList.remove(WL_REQUIRED_CLASS));
        (root || document).querySelectorAll(".wl-field-msg").forEach((el) => el.remove());
      } catch {}
    }

    function wlMarkFieldInvalid(el, label) {
      if (!el) return;
      try { el.classList.add(WL_REQUIRED_CLASS); } catch {}
      try {
        const host = el.closest(".epi-form-group-checkout,.epi-form-group,.form-group") || el.parentElement;
        if (host && !host.querySelector(".wl-field-msg")) {
          const msg = document.createElement("div");
          msg.className = "wl-field-msg";
          msg.textContent = label || "Please complete this field.";
          host.appendChild(msg);
        }
      } catch {}
    }

    function wlOpenAddressEditor(prefix) {
      try {
        if (prefix === "DeliveryAddress" && window.WLCheckout?.showDeliveryEditor) window.WLCheckout.showDeliveryEditor();
        if (prefix === "InvoiceAddress" && window.WLCheckout?.showInvoiceEditor) window.WLCheckout.showInvoiceEditor();
      } catch {}
    }

    function wlAddressValidation(prefix, requireEmail, opts) {
      opts = opts || {};
      const mark = !!opts.mark;
      wlNormalizeFieldValues(prefix);

      const scope = document.querySelector(`.checkout-step[data-step="${prefix === "DeliveryAddress" ? 3 : 4}"]`) || document;
      if (mark) wlClearFieldInvalid(scope);

      const line1 = document.getElementById(`ctl00_PageBody_${prefix}_AddressLine1`);
      const city  = document.getElementById(`ctl00_PageBody_${prefix}_City`);
      const zip   = document.getElementById(`ctl00_PageBody_${prefix}_Postcode`);
      const state = document.getElementById(`ctl00_PageBody_${prefix}_CountySelector_CountyList`);
      const country = document.getElementById(`ctl00_PageBody_${prefix}_CountrySelector${prefix === "InvoiceAddress" ? "1" : ""}`);
      const first = document.getElementById(`ctl00_PageBody_${prefix}_ContactFirstNameTextBox`);
      const last = document.getElementById(`ctl00_PageBody_${prefix}_ContactLastNameTextBox`);
      const phone = document.getElementById(`ctl00_PageBody_${prefix}_ContactTelephoneTextBox`);
      const email = prefix === "InvoiceAddress" ? document.getElementById("ctl00_PageBody_InvoiceAddress_EmailAddressTextBox") : null;
      const phoneFallback = (!phone && prefix === "InvoiceAddress") ? document.getElementById("ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox") : null;

      const missing = [];
      const add = (el, label) => {
        missing.push({ el, label });
        if (mark) wlMarkFieldInvalid(el, label);
      };
      const val = (el) => (el && typeof el.value !== "undefined" ? String(el.value).trim() : "");

      // Contact fields are only required if present in this build. This avoids blocking older WebTrack layouts.
      if (first && !val(first)) add(first, "First name");
      if (last && !val(last)) add(last, "Last name");

      if (!val(line1)) add(line1, "Street address");
      if (!val(city)) add(city, "City");
      if (state && !wlSelectIsValid(state)) add(state, "State");

      const z = val(zip);
      if (!/^\d{5}(-\d{4})?$/.test(z)) add(zip, "ZIP must be 5 digits or ZIP+4");

      const pval = val(phone) || val(phoneFallback);
      if (phone || phoneFallback) {
        if (wlDigits(pval).length < 10) add(phone || phoneFallback, "Phone number");
      }

      if (requireEmail && email) {
        const e = val(email).replace(/^\([^)]*\)\s*/, "");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) add(email, "Valid email address");
      }

      if (country && (!String(country.value || "").trim() || String(country.value || "").trim() === "00" || wlIsPlaceholderText(wlSelectedText(country)))) {
        country.value = "USA";
      }

      return { valid: missing.length === 0, missing };
    }

    function wlAddressBlockIsValid(prefix, requireEmail) {
      return wlAddressValidation(prefix, requireEmail, { mark: false }).valid;
    }

    function wlShowAddressError(prefix, stepNum, requireEmail) {
      const result = wlAddressValidation(prefix, requireEmail, { mark: true });
      if (result.valid) {
        clearInlineError(stepNum);
        return true;
      }

      wlOpenAddressEditor(prefix);
      const labels = result.missing.map((m) => m.label).filter(Boolean);
      showInlineError(stepNum,
        `<strong>Please fix the highlighted fields below.</strong><br>` +
        `<span>${labels.join(", ")}</span>`
      );

      try {
        const first = result.missing.find((m) => m.el)?.el;
        if (first) {
          first.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => { try { first.focus(); } catch {} }, 150);
        }
      } catch {}
      return false;
    }

    function wlSnapshotValue(id) {
      const el = document.getElementById(id);
      if (!el) return null;
      if (el.type === "radio") return el.checked ? el.value || "1" : null;
      return String(el.value || "");
    }

    function wlSaveCheckoutSnapshot() {
      try {
        const ids = [
          "ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox",
          "ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox",
          "ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox",
          "ctl00_PageBody_DeliveryAddress_AddressLine1",
          "ctl00_PageBody_DeliveryAddress_AddressLine2",
          "ctl00_PageBody_DeliveryAddress_AddressLine3",
          "ctl00_PageBody_DeliveryAddress_City",
          "ctl00_PageBody_DeliveryAddress_Postcode",
          "ctl00_PageBody_DeliveryAddress_CountrySelector",
          "ctl00_PageBody_DeliveryAddress_CountySelector_CountyList",
          "ctl00_PageBody_InvoiceAddress_ContactFirstNameTextBox",
          "ctl00_PageBody_InvoiceAddress_ContactLastNameTextBox",
          "ctl00_PageBody_InvoiceAddress_ContactTelephoneTextBox",
          "ctl00_PageBody_InvoiceAddress_EmailAddressTextBox",
          "ctl00_PageBody_InvoiceAddress_AddressLine1",
          "ctl00_PageBody_InvoiceAddress_AddressLine2",
          "ctl00_PageBody_InvoiceAddress_AddressLine3",
          "ctl00_PageBody_InvoiceAddress_City",
          "ctl00_PageBody_InvoiceAddress_Postcode",
          "ctl00_PageBody_InvoiceAddress_CountrySelector1",
          "ctl00_PageBody_InvoiceAddress_CountySelector_CountyList",
          "ctl00_PageBody_PurchaseOrderNumberTextBox",
          "ctl00_PageBody_SpecialInstructionsTextBox"
        ];
        const data = { ts: Date.now(), mode: wlCheckoutMode(), fields: {} };
        ids.forEach((id) => {
          const v = wlSnapshotValue(id);
          if (v !== null) data.fields[id] = v;
        });
        sessionStorage.setItem(WL_CHECKOUT_SNAPSHOT_KEY, JSON.stringify(data));
      } catch {}
    }

    function wlRestoreCheckoutSnapshot() {
      try {
        const raw = sessionStorage.getItem(WL_CHECKOUT_SNAPSHOT_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (!data || !data.fields || (Date.now() - (data.ts || 0)) > (45 * 60 * 1000)) return;
        // Do not hydrate a new signed-in/employee checkout with an older guest/customer snapshot.
        // New snapshots include a mode; old snapshots without one are ignored on purpose.
        const currentMode = wlCheckoutMode();
        if (!data.mode || !currentMode || data.mode !== currentMode) return;
        Object.keys(data.fields).forEach((id) => {
          const el = document.getElementById(id);
          if (!el) return;
          const current = String(el.value || "").trim();
          const stored = String(data.fields[id] || "");
          if (!stored) return;
          if (el.tagName === "SELECT") {
            if (!current || current === "0" || current === "00" || wlIsPlaceholderText(wlSelectedText(el))) el.value = stored;
          } else if (!current) {
            el.value = stored;
          }
        });
      } catch {}
    }

    function wlInstallSnapshotListeners() {
      try {
        document.addEventListener("input", function (ev) {
          const id = ev.target && ev.target.id ? ev.target.id : "";
          if (/PageBody_(DeliveryAddress|InvoiceAddress|PurchaseOrderNumberTextBox|SpecialInstructionsTextBox)/.test(id)) {
            try { ev.target.classList.remove(WL_REQUIRED_CLASS); } catch {}
            try { ev.target.closest(".epi-form-group-checkout,.epi-form-group,.form-group")?.querySelector(".wl-field-msg")?.remove(); } catch {}
            wlSaveCheckoutSnapshot();
          }
        }, true);
        document.addEventListener("change", function (ev) {
          const id = ev.target && ev.target.id ? ev.target.id : "";
          if (/PageBody_(DeliveryAddress|InvoiceAddress|PurchaseOrderNumberTextBox|SpecialInstructionsTextBox)/.test(id)) {
            try { ev.target.classList.remove(WL_REQUIRED_CLASS); } catch {}
            try { ev.target.closest(".epi-form-group-checkout,.epi-form-group,.form-group")?.querySelector(".wl-field-msg")?.remove(); } catch {}
            wlSaveCheckoutSnapshot();
          }
        }, true);
      } catch {}
    }

    try {
      window.WLCheckout = window.WLCheckout || {};
      window.WLCheckout.addressBlockIsValid = wlAddressBlockIsValid;
      window.WLCheckout.saveCheckoutSnapshot = wlSaveCheckoutSnapshot;
      window.WLCheckout.restoreCheckoutSnapshot = wlRestoreCheckoutSnapshot;
    } catch {}

    wlRestoreCheckoutSnapshot();
    wlInstallSnapshotListeners();

    
    // Hide legacy/native checkout fields we do not want customers to see (they can re-appear after UpdatePanel postbacks)
    function hideLegacyCheckoutFields() {
      try {
        const txnDiv = document.getElementById("ctl00_PageBody_TransactionTypeDiv");
        if (txnDiv) {
          const row = txnDiv.closest(".row") || txnDiv.parentElement;
          if (row) row.style.display = "none";
          txnDiv.style.display = "none";
        }

        // "Date required" native RadDatePicker block (often hidden by WebTrack but can still take space/flash)
        const dtWrap = document.getElementById("ctl00_PageBody_dtRequired_DatePicker_wrapper");
        if (dtWrap) {
          const row = dtWrap.closest(".row") || dtWrap.parentElement;
          if (row) row.style.display = "none";
          dtWrap.style.display = "none";
        }

        const dtVal = document.getElementById("ctl00_PageBody_dtRequired_DateRequiredValidator");
        if (dtVal) dtVal.style.display = "none";
      } catch {}
    }

function validateZip(zip) {
      const z = wlNormalizeZipValue(zip);
      return /^\d{5}(-\d{4})?$/.test(z);
    }
    function validatePhone(phone) {
      return wlDigits(phone).length >= 10;
    }
    function validateEmail(email) {
      const e = norm(email).replace(/^\([^)]*\)\s*/, "");
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    }

    function validateAddressBlock(prefix, stepNum, requireEmail) {
      return wlShowAddressError(prefix, stepNum, requireEmail);
    }

    function syncBillingToDelivery(opts) {
      // Copy invoice/billing fields into delivery fields (no postback).
      // Used primarily for PICKUP mode where we hide the Delivery step, but WebTrack
      // still validates Delivery fields on submit.
      //
      // opts.force: overwrite delivery fields even if they already have values.
      // Default: only fill missing delivery fields.
      opts = opts || {};
      const force = !!opts.force;

      const map = [
        ["ctl00_PageBody_InvoiceAddress_ContactFirstNameTextBox","ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox"],
        ["ctl00_PageBody_InvoiceAddress_ContactLastNameTextBox","ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox"],
        ["ctl00_PageBody_InvoiceAddress_ContactTelephoneTextBox","ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox"],
        ["ctl00_PageBody_InvoiceAddress_AddressLine1","ctl00_PageBody_DeliveryAddress_AddressLine1"],
        ["ctl00_PageBody_InvoiceAddress_AddressLine2","ctl00_PageBody_DeliveryAddress_AddressLine2"],
        ["ctl00_PageBody_InvoiceAddress_AddressLine3","ctl00_PageBody_DeliveryAddress_AddressLine3"],
        ["ctl00_PageBody_InvoiceAddress_City","ctl00_PageBody_DeliveryAddress_City"],
        ["ctl00_PageBody_InvoiceAddress_Postcode","ctl00_PageBody_DeliveryAddress_Postcode"],
      ];

      map.forEach(([fromId,toId]) => {
        const from = document.getElementById(fromId);
        const to = document.getElementById(toId);
        if (!from || !to) return;
        if (force || !norm(to.value)) setIf(to, from.value);
      });

      // Country selectors differ between delivery/invoice
      const invCountry = document.getElementById("ctl00_PageBody_InvoiceAddress_CountrySelector1");
      const delCountry = document.getElementById("ctl00_PageBody_DeliveryAddress_CountrySelector");
      if (delCountry) {
        if (force || !norm(delCountry.value)) {
          if (invCountry && norm(invCountry.value)) setIf(delCountry, invCountry.value);
          if (!norm(delCountry.value)) delCountry.value = "USA";
        }
      }

      // State dropdown by visible text (more reliable than value in some themes)
      const invState = document.getElementById("ctl00_PageBody_InvoiceAddress_CountySelector_CountyList");
      const delState = document.getElementById("ctl00_PageBody_DeliveryAddress_CountySelector_CountyList");
      if (invState && delState) {
        const invText = invState.selectedOptions && invState.selectedOptions[0] ? invState.selectedOptions[0].text : "";
        const delHas = delState.selectedIndex != null && delState.selectedIndex > 0;
        if (invText && (force || !delHas)) selectByText(delState, invText);
      }
    }

    function syncDeliveryToInvoiceIfInvoiceBlank() {
      // For Pickup, if Delivery already has data (customer saved address, or system prefill)
      // and Invoice is still blank, we can *prefill* Invoice for convenience — WITHOUT
      // checking "same as delivery".
      const invLine1 = document.getElementById("ctl00_PageBody_InvoiceAddress_AddressLine1");
      const invCity  = document.getElementById("ctl00_PageBody_InvoiceAddress_City");
      const invZip   = document.getElementById("ctl00_PageBody_InvoiceAddress_Postcode");
      const invState = document.getElementById("ctl00_PageBody_InvoiceAddress_CountySelector_CountyList");
      if (!invLine1 || !invCity || !invZip || !invState) return;

      const invBlank = !norm(invLine1.value) && !norm(invCity.value) && !norm(invZip.value) && (invState.selectedIndex == null || invState.selectedIndex <= 0);

      if (!invBlank) return;

      const delLine1 = document.getElementById("ctl00_PageBody_DeliveryAddress_AddressLine1");
      const delCity  = document.getElementById("ctl00_PageBody_DeliveryAddress_City");
      const delZip   = document.getElementById("ctl00_PageBody_DeliveryAddress_Postcode");
      const delState = document.getElementById("ctl00_PageBody_DeliveryAddress_CountySelector_CountyList");

      const delHas = (delLine1 && norm(delLine1.value)) || (delCity && norm(delCity.value)) || (delZip && norm(delZip.value)) || (delState && delState.selectedIndex != null && delState.selectedIndex > 0);
      if (!delHas) return;

      try {
        const contactPairs = [
          ["ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox", "ctl00_PageBody_InvoiceAddress_ContactFirstNameTextBox"],
          ["ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox", "ctl00_PageBody_InvoiceAddress_ContactLastNameTextBox"],
          ["ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox", "ctl00_PageBody_InvoiceAddress_ContactTelephoneTextBox"]
        ];
        contactPairs.forEach(([fromId, toId]) => {
          const from = document.getElementById(fromId);
          const to = document.getElementById(toId);
          if (from && to && !norm(to.value)) to.value = from.value;
        });

        if (delLine1 && invLine1) invLine1.value = delLine1.value;
        if (delCity && invCity) invCity.value = delCity.value;
        if (delZip && invZip) invZip.value = delZip.value;

        if (delState && invState) {
          const txt = delState.selectedOptions && delState.selectedOptions[0] ? delState.selectedOptions[0].text : "";
          if (txt) selectByText(invState, txt);
        }

        const delCountry = document.getElementById("ctl00_PageBody_DeliveryAddress_CountrySelector");
        const invCountry = document.getElementById("ctl00_PageBody_InvoiceAddress_CountrySelector1");
        if (invCountry && (!norm(invCountry.value))) {
          invCountry.value = (delCountry && norm(delCountry.value)) ? delCountry.value : "USA";
        }
      } catch {}
    }

    function ensureDeliveryRequiredForPickup() {
      // In PICKUP mode we hide the Delivery step, but WebTrack still validates delivery fields.
      // Requirement: all delivery fields must be filled EXCEPT the Google address search box.
      // Strategy:
      //   - If delivery already has info, keep it.
      //   - Otherwise, fill any missing delivery required fields from Invoice.
      //   - If Invoice is blank but Delivery has info, optionally prefill Invoice (convenience).
      if (!getPickupSelected()) return;

      // If delivery has substantial data, we still want to ensure required fields are present.
      // We'll fill *missing* fields from invoice without overwriting existing delivery values.
      syncBillingToDelivery({ force: false });

      // If invoice is blank but delivery exists, prefill invoice (no checkbox).
      syncDeliveryToInvoiceIfInvoiceBlank();

      // Ensure delivery country defaults
      const delCountry = document.getElementById("ctl00_PageBody_DeliveryAddress_CountrySelector");
      if (delCountry && !norm(delCountry.value)) delCountry.value = "USA";
    }

    window.WLCheckout = window.WLCheckout || {};
    window.WLCheckout.updatePickupModeUI = updatePickupModeUI;
    window.WLCheckout.syncBillingToDelivery = syncBillingToDelivery;
    window.WLCheckout.ensureDeliveryRequiredForPickup = ensureDeliveryRequiredForPickup;
// -------------------------------------------------------------------------
    // D) Create step panes + nav buttons
    // -------------------------------------------------------------------------
    
    // --------------------------------------------------
    // Woodson-style step icons (avoids confusion when steps are conditionally hidden)
    // --------------------------------------------------
    function wlStepIconSvg(stepNum) {
      // Inline SVGs use currentColor so they automatically match active/inactive styles.
      switch (stepNum) {
        case 1: // Truck (Ship/Pickup)
          return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2h2.7a2 2 0 0 1 1.6.8l1.7 2.2a2 2 0 0 1 .4 1.2V18a2 2 0 0 1-2 2h-1.1a2.5 2.5 0 0 1-4.8 0H10.9a2.5 2.5 0 0 1-4.8 0H5a2 2 0 0 1-2-2V6Zm2 0v12h1.1a2.5 2.5 0 0 1 4.8 0H15V6H5Zm12 6v6h.4a2.5 2.5 0 0 1 4.8 0H22v-2.4L20.5 12H17Zm-8 7.5a1 1 0 1 0 0 .01V19.5Zm11 0a1 1 0 1 0 0 .01V19.5Z"/></svg>';
        case 2: // Wrench (Branch)
          return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M22 6.6a6.5 6.5 0 0 1-7.9 6.3l-5.8 5.8a2 2 0 0 1-2.8 0l-.7-.7a2 2 0 0 1 0-2.8l5.8-5.8A6.5 6.5 0 0 1 17.4 2l-2.7 2.7 1.9 1.9L19.4 4A6.5 6.5 0 0 1 22 6.6ZM6.1 16.3l.7.7 5.3-5.3-.7-.7-5.3 5.3Z"/></svg>';
        case 3: // Map pin (Delivery address)
          return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 1 7 7c0 5.2-7 13-7 13S5 14.2 5 9a7 7 0 0 1 7-7Zm0 9.5A2.5 2.5 0 1 0 12 6.5a2.5 2.5 0 0 0 0 5Z"/></svg>';
        case 4: // Document (Billing)
          return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 2h7l5 5v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V8h4.5L14 3.5ZM8 11h8v2H8v-2Zm0 4h8v2H8v-2Zm0-8h5v2H8V7Z"/></svg>';
        case 5: // Calendar / checklist (Date & instructions)
        default:
          return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2V2Zm14 8H3v10h18V10ZM5 6v2h14V6H5Zm2 7h2v2H7v-2Zm4 0h2v2h-2v-2Zm4 0h2v2h-2v-2Z"/></svg>';
      }
    }

    function decorateStepLi(li, stepNum, title) {
      if (!li) return;
      li.classList.add("wl-step-li");
      li.setAttribute("title", title || "");
      li.setAttribute("aria-label", title || "");
      li.innerHTML = '<span class="wl-step-icon" aria-hidden="true">' + wlStepIconSvg(stepNum) + '</span>' +
                     '<span class="wl-step-label">' + (title || ("Step " + stepNum)) + '</span>';
    }

steps.forEach(function (step, i) {
      const num = i + 1;

      const li = document.createElement("li");
      li.dataset.step = String(num);
      decorateStepLi(li, num, step.title);
      li.addEventListener("click", () => showStep(num));
      nav.appendChild(li);

      const pane = document.createElement("div");
      pane.className = "checkout-step";
      pane.dataset.step = String(num);
      wizard.appendChild(pane);

      if (singlePageCheckout) {
        const heading = document.createElement("div");
        heading.className = "wl-section-heading";
        heading.innerHTML = '<span class="wl-step-icon" aria-hidden="true">' + wlStepIconSvg(num) + '</span>' +
          '<h2 class="wl-section-title">' + step.title + '</h2>' +
          '<div class="wl-section-summary" aria-live="polite"></div>' +
          '<button type="button" class="wl-section-edit" data-wl-edit-step="' + num + '">Edit</button>';
        pane.appendChild(heading);
      }

      step.findEls()
        .filter(isEl)
        .forEach((el) => pane.appendChild(el));

      
      function clickNativeContinue() {
        const btn =
          document.querySelector("#ctl00_PageBody_ContinueButton2") ||
          document.querySelector("#ctl00_PageBody_ContinueButton1");
        if (!btn) return false;

        try {
          // Prefer a real click on the actual server control
          btn.disabled = false;
          btn.style.display = ""; // keep it actionable even if hidden elsewhere
          btn.click();
          return true;
        } catch {}

        // Fallback: explicit WebForms postback
        try {
          const uniqueName = btn.getAttribute("name");
          if (uniqueName && typeof __doPostBack === "function") {
            __doPostBack(uniqueName, "");
            return true;
          }
        } catch {}

        return false;
      }

const navDiv = document.createElement("div");
      navDiv.className = "checkout-nav";
      pane.appendChild(navDiv);

      if (num > 1) {
        const back = document.createElement("button");
        back.type = "button";
        back.className = "btn btn-secondary wl-back";
        back.dataset.wlBack = String(num - 1);
        back.textContent = "Back";
        back.addEventListener("click", (e) => {
          e.preventDefault();
          showStep(num - 1);
        });
        navDiv.appendChild(back);
      }

      if (num < steps.length) {
        const next = document.createElement("button");
        next.type = "button";
        next.className = "btn btn-primary wl-next";
        next.dataset.wlNext = String(num + 1);
        next.textContent = "Next";
        next.addEventListener("click", (e) => {
          e.preventDefault();
          const cur = getActiveStep ? getActiveStep() : num;
          // Validate current step and use smart skipping rules
          if (typeof validateStep === "function" && !validateStep(cur)) return;
          if (typeof goNextFrom === "function") { goNextFrom(cur); return; }
          showStep(cur + 1);
        });
        navDiv.appendChild(next);
      } else {
        // Final step: keep the native Continue button in-place (don’t move it),
        // and use a proxy button that triggers the native postback reliably.
        const native =
          document.querySelector("#ctl00_PageBody_ContinueButton2") ||
          document.querySelector("#ctl00_PageBody_ContinueButton1");

        if (native) {
          // Hide native button (but keep it in DOM so WebForms/Telerik wiring stays intact)
          try { native.style.display = "none"; } catch {}

          const proxy = document.createElement("button");
          proxy.type = "button";
          proxy.className = (native.className || "btn btn-primary") + " wl-proxy-continue";
          proxy.textContent = singlePageCheckout
            ? "Continue to Payment"
            : ((native.value || native.innerText || "Continue").trim() || "Continue");

          proxy.addEventListener("click", function () {
            // Clear any sticky inline errors on Step 5 before submitting
            try { clearInlineError(5); } catch {}
            const ok = (window.WLCheckout && typeof window.WLCheckout.validateBeforeFinalSubmit === "function")
              ? window.WLCheckout.validateBeforeFinalSubmit()
              : ((typeof validateStep === "function") ? validateStep(5) : true);
            if (!ok) return;

            syncNativeRequiredDate();

            // Trigger native submit/postback
            const worked = clickNativeContinue();
            if (!worked) {
              // As a last resort, try submitting the form
              try {
                const form = native.closest("form") || document.querySelector("form");
                if (form) form.submit();
              } catch {}
            }
          });

          navDiv.appendChild(proxy);
        }
      }});

    
    // -------------------------------------------------------------------------
    // E.2) ASP.NET UpdatePanel / async postback resilience
    // - Selecting Delivered/Pickup can trigger an async postback that disables
    //   arbitrary buttons on the page. Our injected "Next" buttons are not known
    //   to WebForms, so they can remain disabled unless we re-enable them after
    //   the request completes.
    // -------------------------------------------------------------------------
    function reEnableWizardNav() {
      try {
        wizard.querySelectorAll("button").forEach((b) => {
          b.disabled = false;
          b.removeAttribute("disabled");
          b.classList.remove("aspNetDisabled");
        });
      } catch {}
    }

    function hookAspNetAjax() {
      try {
        const prm = window.Sys && window.Sys.WebForms && window.Sys.WebForms.PageRequestManager
          ? window.Sys.WebForms.PageRequestManager.getInstance()
          : null;
        if (!prm || prm.__wlHooked) return;
        prm.__wlHooked = true;

        prm.add_endRequest(function () {
          // Re-enable our injected buttons and re-apply mode visibility
          reEnableWizardNav();
          hideLegacyCheckoutFields();

          try { enhanceBranchPicker(); } catch {}

          try { updatePickupModeUI(); } catch {}
          try { window.WLCheckout?.refreshSectionSummaries?.(); } catch {}
          try { window.WLCheckout?.trySmartAdvance?.(); } catch {}
    // If a full postback happened (not UpdatePanel), consume pending step here as well.
    try {
      const ps = sessionStorage.getItem("wl_pendingStep");
      if (ps) {
        sessionStorage.removeItem("wl_pendingStep");
        const n = parseInt(ps, 10);
        if (Number.isFinite(n)) {
          showStep(n);
          try { setStep(n); } catch {}
        }
      }
    } catch {}

          // If the active step became invalid for the selected mode, snap to the first required step.
          try {
            const a = getActiveStep ? getActiveStep() : 1;
            if (getPickupSelected() && a === 3) showStep(2); // pickup must choose Branch before billing
            if (getDeliveredSelected() && !getPickupSelected() && a === 2) showStep(3);
          } catch {}

          // Date module visibility can get reset by partial updates
          try {
            if (window.WLCheckout && typeof window.WLCheckout.refreshDateUI === "function") {
              window.WLCheckout.refreshDateUI();
            }
          } catch {}

          // Restore the active step after UpdatePanel refreshes.
          // Some partial updates can drop the `.active` class even though our stored step is correct,
          // which makes Step 5 look "completed" until the user clicks the tab.
          try {
            const desired = getStep();
            if (desired && Number.isFinite(desired)) showStep(desired);
          } catch {}
        });
      } catch {}
    }

    // Hook immediately (safe even if Sys isn't present)
    hookAspNetAjax();
    // Also run once in case something disabled buttons during initial render
    reEnableWizardNav();

    hideLegacyCheckoutFields();
    // Consume any pending step after a FULL postback (UpdatePanel hooks won't fire).
    try {
      const ps = sessionStorage.getItem("wl_pendingStep");
      if (ps) {
        sessionStorage.removeItem("wl_pendingStep");
        const n = parseInt(ps, 10);
        if (Number.isFinite(n)) {
          showStep(n);
          try { setStep(n); } catch {}
        }
      } else {
        // After a full postback, WebForms can lose which step was active.
        // Always restore from our stored step first; if missing, fall back to the first
        // required step for the selected mode.
        try {
          const desired = getStep();
          // If the stored step is 5 (or beyond) but Billing hasn't been shown yet in this session,
          // force the user to see Billing confirmation instead of silently skipping it.
          if (desired && Number.isFinite(desired)) {
            if (desired >= 5 && !isBillingSeen()) {
              showStep(4);
            } else {
              showStep(desired);
            }
          } else if (getPickupSelected()) {
            showStep(2);
          } else if (getDeliveredSelected() && !getPickupSelected()) {
            showStep(3);
          } else {
            showStep(1);
          }
        } catch {
          try {
            if (getPickupSelected()) showStep(2);
            else if (getDeliveredSelected() && !getPickupSelected()) showStep(3);
            else showStep(1);
          } catch {}
        }
      }
    } catch {}


    // -------------------------------------------------------------------------
    // E) Step switching + persistence
    // -------------------------------------------------------------------------
    function showStep(n, options) {
      options = options || {};
      // Clamp step number (old sessions sometimes stored 6+ which breaks Step 5 rendering)
      n = parseInt(n, 10);
      if (!Number.isFinite(n)) n = 1;
      const _maxStep = steps.length;
      if (n < 1) n = 1;
      if (n > _maxStep) n = _maxStep;
      // If Pickup is selected, skip Delivery Address (Step 3)
      if (getPickupSelected() && n === 3) n = 4;
      // If Delivered/Shipping is selected, hide Branch (Step 2)
      if (getDeliveredSelected() && !getPickupSelected() && n === 2) n = 3;
      // Delivered flow: require the user to confirm Billing (Step 4) before showing Step 5
      try {
        if (n === 5 && getDeliveredSelected() && !getPickupSelected()) {
          const confirmed = sessionStorage.getItem("wl_billing_confirmed_delivered") === "1";
          if (!confirmed) n = 4;
        }
      } catch {}


      // Pickup flow: require Billing confirmation before allowing Step 5 (Date & Instructions).
      // (Billing is prefilled in pickup mode, but we still want the user to confirm it.)
      if (getPickupSelected() && n === 5 && !isBillingConfirmed()) n = 4;
            // Mark Billing as seen whenever we land on Step 4.
      if (n === 4) { try { setBillingSeen(true); } catch {} }
      // When showing Step 5, re-run Date/Instructions UI init in case an UpdatePanel refreshed it.
      if (n === 5) { try { window.WLCheckout?.refreshDateUI?.(); } catch {} }

      // Re-clamp after mode-based skipping
      if (n < 1) n = 1;
      if (n > steps.length) n = steps.length;

      wizard
        .querySelectorAll(".checkout-step")
        .forEach((p) => {
          const shouldShow = singlePageCheckout
            ? !p.classList.contains("wl-step-unavailable")
            : +p.dataset.step === n;
          p.classList.toggle("active", shouldShow);
        });

      nav.querySelectorAll("li").forEach((li) => {
        const s = +li.dataset.step;
        li.classList.toggle("active", s === n);
        li.classList.toggle("completed", s < n);
      });

      setStep(n);
      try {
        if (window.WLCheckout && typeof window.WLCheckout.setSameAsDeliveryVisible === "function") {
          window.WLCheckout.setSameAsDeliveryVisible(!getPickupSelected());
        }
      } catch {}
      try {
        const scrollTarget = singlePageCheckout
          ? wizard.querySelector(`.checkout-step[data-step="${n}"]`)
          : wizard;
        if (options.scroll !== false && scrollTarget && !scrollTarget.classList.contains("wl-step-unavailable")) {
          window.scrollTo({ top: Math.max(0, scrollTarget.offsetTop - 16), behavior: "smooth" });
        }
      } catch {}

      // Billing step (Step 4): if "same as delivery" is checked but invoice fields are blank
      // because the checkbox persisted from a prior session, force a quick uncheck/recheck
      // AFTER the user has entered delivery address so the copy runs with real values.
      try {
        if (n === 4 && window.WLCheckout && typeof window.WLCheckout.forceInvoiceSameAsDeliveryRefresh === "function") {
          setTimeout(function () {
            try { window.WLCheckout.forceInvoiceSameAsDeliveryRefresh(); } catch {}
          }, 0);
        }
      } catch {}

      // Always present Billing as a confirm-first summary when values exist.
      // (Delivery + Pickup both.) User can click Edit to expand.
      try {
        if (n === 4 && window.WLCheckout && typeof window.WLCheckout.applyInvoiceDefaultView === "function") {
          setTimeout(function () {
            try { window.WLCheckout.applyInvoiceDefaultView(); } catch {}
          }, 30);
        }
      } catch {}
    
      // Pickup: render Branch cards whenever Branch step is shown
      try { if (n === 2 && getPickupSelected()) enhanceBranchPicker(); } catch {}
}

    window.WLCheckout.showStep = showStep;

// -------------------------------------------------------------------------
// E.1) Delegated nav handlers (survive UpdatePanel partial refresh)
// -------------------------------------------------------------------------
document.addEventListener("click", function (ev) {
  const btn = ev.target && ev.target.closest ? ev.target.closest("button") : null;
  if (!btn) return;

  // Delegated handlers must respect the wizard's smart-routing rules, especially
  // after UpdatePanel refreshes (the direct listeners may be lost).
  if (btn.dataset && btn.dataset.wlNext) {
    ev.preventDefault();
    ev.stopPropagation();
    if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();

    const cur = (typeof getActiveStep === "function") ? getActiveStep() : 1;
    if (typeof validateStep === "function" && !validateStep(cur)) return;

    // Mark Billing as confirmed only after Step 4 validates.
    if (cur === 4 && getPickupSelected()) setBillingConfirmed(true);

    if (typeof goNextFrom === "function") { goNextFrom(cur); return; }
    const to = parseInt(btn.dataset.wlNext, 10);
    if (Number.isFinite(to)) showStep(to);
    return;
  }

  if (btn.dataset && btn.dataset.wlBack) {
    ev.preventDefault();
    ev.stopPropagation();
    if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();

    const cur = (typeof getActiveStep === "function") ? getActiveStep() : 1;
    const to = parseInt(btn.dataset.wlBack, 10);
    if (Number.isFinite(to)) { showStep(to); return; }
    showStep(Math.max(1, cur - 1));
    return;
  }
}, true);




    // -------------------------------------------------------------------------
    // E.5) Wizard navigation intercept: validate + skip Step 5 in Pickup mode
    // -------------------------------------------------------------------------
    function getActiveStep() {
      if (singlePageCheckout) return getStep() || 1;
      const active = wizard.querySelector(".checkout-step.active");
      return active ? parseInt(active.dataset.step, 10) : 1;
    }

    function goNextFrom(stepNum) {
      let next = stepNum + 1;
      // Skip Branch step if delivered/shipping
      if (getDeliveredSelected() && !getPickupSelected() && next === 2) next = 3;
      // Skip Delivery Address step if pickup
      if (getPickupSelected() && next === 3) next = 4;
      showStep(next);
    }

    function validateStep(stepNum) {
      // Lightweight, client-side validation to prevent "stuck" moments.
      // Server validation still runs on final Continue.
      if (stepNum === 1) {
        // Ship/Pickup selected?
        const rbPick = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbCollectLater");
        const rbDel = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbDelivered");
        const rbUPS = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbUPSDelivery");
        if (!(rbPick && rbPick.checked) && !(rbDel && rbDel.checked) && !(rbUPS && rbUPS.checked)) {
          // If using the modern button selector, infer selection from the active button
          try {
            const btnDel = document.querySelector('.modern-shipping-selector button[data-value="rbDelivered"].is-selected, .modern-shipping-selector button[data-value="rbDelivered"].selected, .modern-shipping-selector button[data-value="rbDelivered"].active');
            const btnPick = document.querySelector('.modern-shipping-selector button[data-value="rbCollectLater"].is-selected, .modern-shipping-selector button[data-value="rbCollectLater"].selected, .modern-shipping-selector button[data-value="rbCollectLater"].active');
            const btnUPS = document.querySelector('.modern-shipping-selector button[data-value="rbUPSDelivery"].is-selected, .modern-shipping-selector button[data-value="rbUPSDelivery"].selected, .modern-shipping-selector button[data-value="rbUPSDelivery"].active');
            if (btnDel && rbDel) { rbDel.checked = true; }
            if (btnPick && rbPick) { rbPick.checked = true; }
            if (btnUPS && rbUPS) { rbUPS.checked = true; }
          } catch {}

          if (!(rbPick && rbPick.checked) && !(rbDel && rbDel.checked) && !(rbUPS && rbUPS.checked)) {
            showInlineError(1, "<strong>Please choose:</strong> Delivered or Pickup.");
            return false;
          }
        }
        clearInlineError(1);
        updatePickupModeUI();
        return true;
      }

      if (stepNum === 2) {
        // Branch is REQUIRED for Pickup (customer chooses pickup store).
        // For Delivered/Shipping, we can default a branch operationally (Amazon-style).
        const field = getBranchField();

        if (getPickupSelected()) {
          if (field && !isBranchChosen(field)) {
            showInlineError(2, "<strong>Please select a store/branch</strong> so we can route your pickup order.");
            return false;
          }
          clearInlineError(2);
          // Remember for next time
          try { if (field && norm(field.value)) localStorage.setItem("wl_last_branch", norm(field.value)); } catch {}
          return true;
        }

        // Delivered/Shipping: attempt to auto-select a default branch if none chosen.
        // We still keep the server control satisfied, but we don't block the customer here.
        if (field && !isBranchChosen(field)) {
          autoSelectDefaultBranch();
        }
        clearInlineError(2);
        // Remember for next time
        try { if (field && norm(field.value)) localStorage.setItem("wl_last_branch", norm(field.value)); } catch {}
        return true;
      }

      if (stepNum === 3) {
        // Delivery step is hidden in pickup mode.
        if (getPickupSelected()) return true;
        return validateAddressBlock("DeliveryAddress", 3, false);
      }

      if (stepNum === 4) {
        // Billing is always required (and is used to satisfy Delivery when pickup).
        const ok = validateAddressBlock("InvoiceAddress", 4, true);
        if (!ok) return false;

        // Ensure Billing country is set (default USA if blank/[Select Country])
        try {
          const c = document.getElementById("ctl00_PageBody_InvoiceAddress_CountrySelector1");
          if (c && (String(c.value||"").trim()==="" || String(c.value||"").trim()==="00")) {
            c.value = "USA";
            try { c.dispatchEvent(new Event("change",{bubbles:true})); } catch {}
          }
        } catch {}

        // Delivered flow: user is clicking Next on Billing, treat this as confirmation.
        try {
          if (getDeliveredSelected() && !getPickupSelected()) {
            sessionStorage.setItem("wl_billing_confirmed_delivered", "1");
          }
        } catch {}

        if (getPickupSelected()) {
          try { ensureDeliveryRequiredForPickup(); } catch { try { syncBillingToDelivery({force:false}); } catch {} }
          // Also, if Delivery Address step is hidden (pickup), make sure required server fields are not blank.
          clearInlineError(2);
        }
        return true;
      }

      if (stepNum === 5) {
        if (window.WLCheckout && typeof window.WLCheckout.validateDateInstructions === "function") {
          return window.WLCheckout.validateDateInstructions(true);
        }
        return true;
      }

      return true;
    }

    // Intercept our wizard "Next" buttons (not the final Continue submit button).
    wizard.addEventListener(
      "click",
      function (e) {
        const btn = e.target && e.target.closest ? e.target.closest("button.btn.btn-primary") : null;
        if (!btn) return;

        // Only intercept our "Next" buttons (not the ContinueButton which is submit)
        if (btn.type === "submit") return;
        if ((btn.textContent || "").trim().toLowerCase() !== "next") return;

        const stepNum = getActiveStep();
        e.preventDefault();
        e.stopPropagation();

        if (!validateStep(stepNum)) {
          showStep(stepNum);
          return;
        }
        goNextFrom(stepNum);
      },
      true
    );


    // -------------------------------------------------------------------------
    // F) Postback-safe returnStep logic (core fix)
    // -------------------------------------------------------------------------
    function bindReturnStepFor(selector, stepNum, eventName) {
      const ev = eventName || "change";
      const el = document.querySelector(selector);
      if (!el) return;
      el.addEventListener(
        ev,
        function () {
          setReturnStep(stepNum);
        },
        true // capture
      );
    }

    bindReturnStepFor("#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList", 3, "change");
    bindReturnStepFor("#ctl00_PageBody_DeliveryAddress_CountrySelector", 3, "change");

    bindReturnStepFor("#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList", 4, "change");
    bindReturnStepFor("#ctl00_PageBody_InvoiceAddress_CountrySelector1", 4, "change");

    bindReturnStepFor("#ctl00_PageBody_BranchSelector", 2, "change");
    // If the branch control is a wrapper div, bind to its inner select/input as well.
    bindReturnStepFor("#ctl00_PageBody_BranchSelector select", 2, "change");
    bindReturnStepFor("#ctl00_PageBody_BranchSelector input", 2, "change");

    // -------------------------------------------------------------------------
    // G) Delivery summary/edit (Step 3)
    // Only collapse into summary mode after the address is actually valid.
    // -------------------------------------------------------------------------
    (function () {
      const pane3 = wizard.querySelector('.checkout-step[data-step="3"]');
      if (!pane3) return;

      const col = pane3.querySelector(".epi-form-col-single-checkout");
      if (!col) return;

      const wrap = document.createElement("div");
      const sum = document.createElement("div");
      wrap.className = "delivery-inputs";
      sum.className = "delivery-summary wl-address-summary";

      while (col.firstChild) wrap.appendChild(col.firstChild);
      col.appendChild(wrap);
      col.insertBefore(sum, wrap);

      function safeVal(sel) {
        const el = wrap.querySelector(sel);
        return el ? el.value || "" : "";
      }
      function safeTextSelected(sel) {
        const el = wrap.querySelector(sel);
        const text = el && el.selectedOptions && el.selectedOptions[0] ? el.selectedOptions[0].text || "" : "";
        return wlIsPlaceholderText(text) ? "" : text;
      }

      function upd() {
        wlNormalizeFieldValues("DeliveryAddress");
        const a1 = safeVal("#ctl00_PageBody_DeliveryAddress_AddressLine1").trim();
        const a2 = safeVal("#ctl00_PageBody_DeliveryAddress_AddressLine2").trim();
        const c = safeVal("#ctl00_PageBody_DeliveryAddress_City").trim();
        const s = safeTextSelected("#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList").trim();
        const z = safeVal("#ctl00_PageBody_DeliveryAddress_Postcode").trim();
        const phone = (wrap.querySelector("#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox")?.value || "").trim();

        sum.innerHTML = `<strong>Delivery Address</strong><br>
          ${a1}${a2 ? "<br>" + a2 : ""}<br>
          ${c}${c && (s || z) ? ", " : ""}${s} ${z}<br>
          ${phone ? "Phone: " + phone + "<br>" : ""}
          <button type="button" id="editDelivery" class="btn btn-link">Edit delivery address</button>`;
      }

      function showInputs() {
        sum.style.display = "none";
        wrap.style.display = "";
      }

      function showSummaryIfValid() {
        if (getPickupSelected()) return false;
        if (!wlAddressBlockIsValid("DeliveryAddress", false)) {
          showInputs();
          return false;
        }
        upd();
        wrap.style.display = "none";
        sum.style.display = "";
        clearInlineError(3);
        return true;
      }

      // Start in summary mode only if it is valid. Otherwise keep fields open.
      if (!showSummaryIfValid()) showInputs();

      sum.addEventListener("click", (e) => {
        if (e.target.id !== "editDelivery") return;
        e.preventDefault();
        showInputs();
        try { wrap.scrollIntoView({ behavior: "smooth" }); } catch {}

        if (!wrap.querySelector("#saveDelivery")) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.id = "saveDelivery";
          btn.className = "btn btn-primary mt-2";
          btn.textContent = "Save Delivery Address";
          wrap.appendChild(btn);

          btn.addEventListener("click", () => {
            if (!validateAddressBlock("DeliveryAddress", 3, false)) return;
            upd();
            try {
              const same = document.getElementById('sameAsDeliveryCheck');
              if (same && same.checked && window.WLCheckout && typeof window.WLCheckout.refreshInvoiceSummary === 'function') {
                window.WLCheckout.refreshInvoiceSummary(true);
              }
            } catch {}
            showSummaryIfValid();
            setStep(4);
          });
        }
      });

      try {
        window.WLCheckout = window.WLCheckout || {};
        window.WLCheckout.refreshDeliverySummary = upd;
        window.WLCheckout.showDeliveryEditor = showInputs;
        window.WLCheckout.showDeliverySummaryIfFilled = showSummaryIfValid;
        window.WLCheckout.showDeliverySummaryIfValid = showSummaryIfValid;
      } catch {}
    })();

    // -------------------------------------------------------------------------
    // H) Billing address same-as-delivery + summary/edit (Step 6)
    // Fix: If sameAsDelivery=true but invoice fields blank after reload/cart changes,
    // auto-trigger CopyDeliveryAddress postback ONCE per session.
    // -------------------------------------------------------------------------
    (function () {
      const pane4 = wizard.querySelector('.checkout-step[data-step="4"]');
      if (!pane4) return;

      const orig = document.getElementById("copyDeliveryAddressButton");
      if (orig) orig.style.display = "none";

      const chkDiv = document.createElement("div");
      chkDiv.className = "form-check mb-3";
      chkDiv.innerHTML = `
        <input class="form-check-input" type="checkbox" id="sameAsDeliveryCheck">
        <label class="form-check-label" for="sameAsDeliveryCheck">
          Billing address is the same as delivery address
        </label>`;
      pane4.insertBefore(chkDiv, pane4.firstChild);

      const sameCheck = chkDiv.querySelector("#sameAsDeliveryCheck");
      const colInv = pane4.querySelector(".epi-form-col-single-checkout");
      if (!colInv) return;

      const wrapInv = document.createElement("div");
      const sumInv = document.createElement("div");
      wrapInv.className = "invoice-inputs";
      sumInv.className = "invoice-summary wl-address-summary";

      while (colInv.firstChild) wrapInv.appendChild(colInv.firstChild);
      colInv.appendChild(wrapInv);

      const q = (sel) => wrapInv.querySelector(sel);

      function copyDeliveryToInvoice(force) {
        try {
          const pairs = [
            ["ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox","ctl00_PageBody_InvoiceAddress_ContactFirstNameTextBox"],
            ["ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox","ctl00_PageBody_InvoiceAddress_ContactLastNameTextBox"],
            ["ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox","ctl00_PageBody_InvoiceAddress_ContactTelephoneTextBox"],
            ["ctl00_PageBody_DeliveryAddress_AddressLine1","ctl00_PageBody_InvoiceAddress_AddressLine1"],
            ["ctl00_PageBody_DeliveryAddress_AddressLine2","ctl00_PageBody_InvoiceAddress_AddressLine2"],
            ["ctl00_PageBody_DeliveryAddress_AddressLine3","ctl00_PageBody_InvoiceAddress_AddressLine3"],
            ["ctl00_PageBody_DeliveryAddress_City","ctl00_PageBody_InvoiceAddress_City"],
            ["ctl00_PageBody_DeliveryAddress_Postcode","ctl00_PageBody_InvoiceAddress_Postcode"],
          ];
          pairs.forEach(([from,to])=>{
            const f=document.getElementById(from);
            const t=document.getElementById(to);
            if (!f || !t) return;
            if (force || !String(t.value||"").trim()) t.value = f.value;
          });

          const delState=document.getElementById("ctl00_PageBody_DeliveryAddress_CountySelector_CountyList");
          const invState=document.getElementById("ctl00_PageBody_InvoiceAddress_CountySelector_CountyList");
          if (delState && invState) {
            const txt = delState.selectedOptions && delState.selectedOptions[0] ? delState.selectedOptions[0].text : "";
            if (txt) selectByText(invState, txt);
          }

          const invCountry=document.getElementById("ctl00_PageBody_InvoiceAddress_CountrySelector1");
          if (invCountry && !String(invCountry.value||"").trim()) invCountry.value = "USA";
        } catch {}
      }


      function refreshInv() {
        const first = (q("#ctl00_PageBody_InvoiceAddress_ContactFirstNameTextBox")?.value || "").trim();
        const last = (q("#ctl00_PageBody_InvoiceAddress_ContactLastNameTextBox")?.value || "").trim();
        const phone = (q("#ctl00_PageBody_InvoiceAddress_ContactTelephoneTextBox")?.value || "").trim();
        const a1 = (q("#ctl00_PageBody_InvoiceAddress_AddressLine1")?.value || "").trim();
        const a2 = (q("#ctl00_PageBody_InvoiceAddress_AddressLine2")?.value || "").trim();
        const c = (q("#ctl00_PageBody_InvoiceAddress_City")?.value || "").trim();
        let st =
          q("#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList")?.selectedOptions?.[0]?.text || "";
        if (wlIsPlaceholderText(st)) st = "";
        const z = (q("#ctl00_PageBody_InvoiceAddress_Postcode")?.value || "").trim();
        const e = (q("#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox")?.value || "").trim();

        sumInv.innerHTML = `<strong>Billing Address</strong><br>
          ${[first, last].filter(Boolean).join(" ")}${phone ? " - " + phone : ""}<br>
          ${a1}${a2 ? "<br>" + a2 : ""}<br>
          ${c}${c && (st || z) ? ", " : ""}${st} ${z}<br>
          ${e ? "Email: " + e + "<br>" : ""}
          <button type="button" id="editInvoice" class="btn btn-link">Edit billing address</button>`;
      }

      function invoiceLooksBlank() {
        const invLine1 = (q("#ctl00_PageBody_InvoiceAddress_AddressLine1")?.value || "").trim();
        const invCity  = (q("#ctl00_PageBody_InvoiceAddress_City")?.value || "").trim();
        const invZip   = (q("#ctl00_PageBody_InvoiceAddress_Postcode")?.value || "").trim();
        return !invLine1 && !invCity && !invZip;
      }

      function deliveryHasData() {
        const delLine1 = (document.getElementById("ctl00_PageBody_DeliveryAddress_AddressLine1")?.value || "").trim();
        const delCity  = (document.getElementById("ctl00_PageBody_DeliveryAddress_City")?.value || "").trim();
        const delZip   = (document.getElementById("ctl00_PageBody_DeliveryAddress_Postcode")?.value || "").trim();
        return !!(delLine1 || delCity || delZip);
      }

      // Signed-in accounts occasionally arrive with a complete delivery address but
      // an empty invoice block. Fill only that fully blank block and keep it editable;
      // never overwrite a distinct billing address already supplied by WebTrack.
      if (invoiceLooksBlank() && deliveryHasData()) {
        copyDeliveryToInvoice(false);
      }

      wrapInv.style.display = "none";
      sumInv.style.display = "none";
      colInv.insertBefore(sumInv, wrapInv);

      // Initial state from storage
      const sameStored = getSameAsDelivery();
      sameCheck.checked = sameStored;

      // If the user wants same-as-delivery AND invoice is blank after reload,
      // trigger the server-side copy ONCE this session.
      if (sameStored && invoiceLooksBlank() && deliveryHasData() && !autoCopyAlreadyDone()) {
        markAutoCopyDone();
        // IMPORTANT: Do not bounce the user past Billing.
        // After any server-side copy / refresh, always return to Billing (Step 4)
        // so the user can confirm the billing summary.
        setReturnStep(4);
        try {
          __doPostBack("ctl00$PageBody$CopyDeliveryAddressLinkButton", "");
          return; // page will reload; stop further UI work this pass
        } catch {}
      }

      // Normal display
      if (sameStored) {
        copyDeliveryToInvoice(true);
        refreshInv();
        if (wlAddressBlockIsValid("InvoiceAddress", true)) {
          wrapInv.style.display = "none";
          sumInv.style.display = "";
        } else {
          sumInv.style.display = "none";
          wrapInv.style.display = "";
        }
      } else {
        wrapInv.style.display = "";
        sumInv.style.display = "none";
      }

      sameCheck.addEventListener("change", function () {
        if (this.checked) {
          // Always keep the user on Billing after copying so they can confirm.
          setReturnStep(4);
          setSameAsDelivery(true);
          markAutoCopyDone(); // user-initiated copy: treat as done

          // Client-side copy immediately so the customer sees it without needing to uncheck/recheck
          copyDeliveryToInvoice(true);

          refreshInv();
          // Show summary mode only if the copied billing info is complete.
          if (wlAddressBlockIsValid("InvoiceAddress", true)) {
            wrapInv.style.display = "none";
            sumInv.style.display = "";
            clearInlineError(4);
          } else {
            sumInv.style.display = "none";
            wrapInv.style.display = "";
            setTimeout(function(){
              try { validateAddressBlock("InvoiceAddress", 4, true); } catch {}
            }, 60);
          }

          // If your WebTrack installation requires server-side copy logic, we can re-enable this postback.
          // try { __doPostBack("ctl00$PageBody$CopyDeliveryAddressLinkButton", ""); } catch {}
        } else {
          setSameAsDelivery(false);
          try { clearInlineError(4); } catch {}
          sumInv.style.display = "none";
          wrapInv.style.display = "";
        }
      });

      // When the "same as delivery" checkbox state is persisted (localStorage), it can be
      // checked on page load BEFORE the customer enters a delivery address. In that case,
      // we copy blanks into invoice fields and then hide the inputs (summary view), which
      // looks like the billing section is broken.
      //
      // This helper is called when Step 4 is shown. If delivery now has data but invoice is
      // still blank while the checkbox is checked, we toggle (uncheck→check) and re-run the
      // copy logic so the invoice fields populate.
      function forceInvoiceSameAsDeliveryRefresh() {
        try {
          if (!sameCheck || !sameCheck.checked) return;
          if (!invoiceLooksBlank()) return;
          if (!deliveryHasData()) return;

          // Avoid thrashing if Step 4 is re-rendered multiple times in quick succession.
          const guardKey = "wl_same_recheck_step4";
          try {
            if (sessionStorage.getItem(guardKey) === "1") return;
            sessionStorage.setItem(guardKey, "1");
            setTimeout(function(){
              try { sessionStorage.removeItem(guardKey); } catch {}
            }, 1500);
          } catch {}

          // Uncheck then recheck (without relying on browser firing change automatically)
          sameCheck.checked = false;
          setSameAsDelivery(false);

          sameCheck.checked = true;
          setSameAsDelivery(true);
          markAutoCopyDone();

          copyDeliveryToInvoice(true);
          refreshInv();
          if (wlAddressBlockIsValid("InvoiceAddress", true)) {
            wrapInv.style.display = "none";
            sumInv.style.display = "";
          } else {
            sumInv.style.display = "none";
            wrapInv.style.display = "";
          }
        } catch {}
      }

      // Pickup mode: we do NOT want "same as delivery" to ever be checked,
      // because we hide the delivery step and instead keep Delivery valid behind the scenes.
      function setSameAsDeliveryVisible(visible) {
        try {
          chkDiv.style.display = visible ? "" : "none";

          if (!visible) {
            // Pickup flow:
            // - Never allow same-as-delivery to be checked (we maintain Delivery validity behind the scenes)
            // - Default to a collapsed Billing summary so the customer can confirm, with an Edit option.
            if (sameCheck) sameCheck.checked = false;
            setSameAsDelivery(false);

            // Ensure invoice has something to summarize (prefill happens elsewhere; this is just defensive)
            try { refreshInv(); } catch {}

            // Show summary only if billing data is complete; otherwise leave fields open.
            if (wlAddressBlockIsValid("InvoiceAddress", true)) {
              wrapInv.style.display = "none";
              sumInv.style.display = "";
            } else {
              sumInv.style.display = "none";
              wrapInv.style.display = "";
            }
          } else {
            // Restore from storage when returning to Delivered flow
            const stored = getSameAsDelivery();
            if (sameCheck) sameCheck.checked = stored;
            if (stored) {
              copyDeliveryToInvoice(true);
              refreshInv();
              if (wlAddressBlockIsValid("InvoiceAddress", true)) {
                wrapInv.style.display = "none";
                sumInv.style.display = "";
              } else {
                sumInv.style.display = "none";
                wrapInv.style.display = "";
              }
            } else {
              sumInv.style.display = "none";
              wrapInv.style.display = "";
            }
          }
        } catch {}
      }
      // Enter edit mode
      sumInv.addEventListener("click", (e) => {
        if (e.target.id !== "editInvoice") return;
        e.preventDefault();
        sumInv.style.display = "none";
        wrapInv.style.display = "";
        // If the user edits billing, consider it unconfirmed until they hit Next.
        try { clearBillingConfirmed(); } catch {}
        if (!wrapInv.querySelector("#saveInvoice")) {
          const save = document.createElement("button");
          save.type = "button";
          save.id = "saveInvoice";
          save.className = "btn btn-primary mt-2";
          save.textContent = "Use this billing address";
          wrapInv.appendChild(save);
          save.addEventListener("click", function () {
            if (!validateAddressBlock("InvoiceAddress", 4, true)) return;
            refreshInv();
            wrapInv.style.display = "none";
            sumInv.style.display = "";
            try {
              pane4.dataset.wlEditing = "0";
              window.WLCheckout?.refreshSectionSummaries?.();
              window.WLCheckout?.trySmartAdvance?.();
            } catch {}
          });
        }
        try { wrapInv.scrollIntoView({ behavior: "smooth" }); } catch {}
      });

      // When arriving at Billing, default to a collapsed summary if we already have values.
      // This mirrors the Pickup confirmation UX, but does NOT auto-advance.
      function applyInvoiceDefaultView() {
        try {
          if (wlAddressBlockIsValid("InvoiceAddress", true)) {
            refreshInv();
            wrapInv.style.display = "none";
            sumInv.style.display = "";
          } else {
            sumInv.style.display = "none";
            wrapInv.style.display = "";
          }
        } catch {}
      }

      function hydrateBlankInvoiceFromDelivery() {
        try {
          if (invoiceLooksBlank() && deliveryHasData()) copyDeliveryToInvoice(false);
          applyInvoiceDefaultView();
          window.WLCheckout?.refreshSectionSummaries?.();
        } catch {}
      }

      try {
        window.WLCheckout = window.WLCheckout || {};
        window.WLCheckout.refreshInvoiceSummary = function(forceCopy){
          if (forceCopy) copyDeliveryToInvoice(true);
          refreshInv();
        };
        window.WLCheckout.showInvoiceEditor = function(){
          sumInv.style.display = "none";
          wrapInv.style.display = "";
        };

        window.WLCheckout.applyInvoiceDefaultView = applyInvoiceDefaultView;
        window.WLCheckout.hydrateBlankInvoiceFromDelivery = hydrateBlankInvoiceFromDelivery;

        // Expose the step-entry refresh hook.
        window.WLCheckout.forceInvoiceSameAsDeliveryRefresh = forceInvoiceSameAsDeliveryRefresh;
        window.WLCheckout.setSameAsDeliveryVisible = setSameAsDeliveryVisible;
      } catch {}

      refreshInv();
      applyInvoiceDefaultView();
    })();

    // -------------------------------------------------------------------------
    // I) Prefill delivery address (kept light)
    // -------------------------------------------------------------------------
    try {
      if ($ && !$("#ctl00_PageBody_DeliveryAddress_AddressLine1").val()) {
        const $entries = $(".AddressSelectorEntry");
        if ($entries.length) {
          let $pick = $entries.first();
          let minId = parseInt($pick.find(".AddressId").text(), 10);

          $entries.each(function () {
            const id = parseInt($(this).find(".AddressId").text(), 10);
            if (id < minId) {
              minId = id;
              $pick = $(this);
            }
          });

          const parts = $pick
            .find("dd p")
            .first()
            .text()
            .trim()
            .split(",")
            .map((s) => s.trim());

          const line1 = parts[0] || "";
          const city = parts[1] || "";
          let state = "", zip = "";

          if (parts.length >= 4) {
            state = parts[parts.length - 2] || "";
            zip = parts[parts.length - 1] || "";
          } else if (parts.length > 2) {
            const m = (parts[2] || "").match(/(.+?)\s*(\d{5}(?:-\d{4})?)?$/);
            if (m) {
              state = (m[1] || "").trim();
              zip = m[2] || "";
            }
          }

          $("#ctl00_PageBody_DeliveryAddress_AddressLine1").val(line1);
          $("#ctl00_PageBody_DeliveryAddress_City").val(city);
          $("#ctl00_PageBody_DeliveryAddress_Postcode").val(zip);
          $("#ctl00_PageBody_DeliveryAddress_CountrySelector").val("USA");

          $("#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList option").each(function () {
            if ($(this).text().trim().toLowerCase() === state.toLowerCase()) {
              $(this).prop("selected", true);
              return false;
            }
          });

          // Update the collapsed delivery summary immediately if present
          try {
            if (window.WLCheckout && typeof window.WLCheckout.refreshDeliverySummary === "function") window.WLCheckout.refreshDeliverySummary();
            if (window.WLCheckout && typeof window.WLCheckout.showDeliverySummaryIfFilled === "function") window.WLCheckout.showDeliverySummaryIfFilled();
          } catch {}

        }
      }
    } catch {}

    window.setTimeout(function () {
      try { window.WLCheckout?.hydrateBlankInvoiceFromDelivery?.(); } catch {}
    }, 0);
    window.setTimeout(function () {
      try { window.WLCheckout?.hydrateBlankInvoiceFromDelivery?.(); } catch {}
    }, 350);

    // -------------------------------------------------------------------------
    // J) AJAX fetch user info (DON’T trigger WebForms change)
    // -------------------------------------------------------------------------
    if ($) {
      $.get("https://webtrack.woodsonlumber.com/AccountSettings.aspx", (data) => {
        const $acc = $(data);
        const fn = ($acc.find("#ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput").val() || "").trim();
        const ln = ($acc.find("#ctl00_PageBody_ChangeUserDetailsControl_LastNameInput").val() || "").trim();
        const em = (
          ($acc.find("#ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput").val() || "")
            .replace(/^\([^)]*\)\s*/, "")
        ).trim();

        const setIfExists = (sel, val) => {
          const $el = $(sel);
          if ($el.length && val) $el.val(val);
        };

        setIfExists("#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox", fn);
        setIfExists("#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox", ln);

        setIfExists("#ctl00_PageBody_InvoiceAddress_ContactFirstNameTextBox", fn);
        setIfExists("#ctl00_PageBody_InvoiceAddress_ContactLastNameTextBox", ln);

        setIfExists("#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox", em);
        try {
          window.WLCheckout?.hydrateBlankInvoiceFromDelivery?.();
          window.WLCheckout?.refreshSectionSummaries?.();
        } catch {}
      });

      $.get("https://webtrack.woodsonlumber.com/AccountInfo_R.aspx", (data) => {
        const tel = $(data).find("#ctl00_PageBody_TelephoneLink_TelephoneLink").text().trim();
        if (tel) {
          $("#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox").val(tel);
          const $invoicePhone = $("#ctl00_PageBody_InvoiceAddress_ContactTelephoneTextBox");
          if ($invoicePhone.length && !$invoicePhone.val()) $invoicePhone.val(tel);
        }
        try {
          window.WLCheckout?.hydrateBlankInvoiceFromDelivery?.();
          window.WLCheckout?.refreshSectionSummaries?.();
        } catch {}
      });
    }

    // -------------------------------------------------------------------------
    // K) Step 7: pickup/delivery + special instructions
    // Fix: Same-day pickup times must be >= 2 hours out (rounded up to next hour)
    // -------------------------------------------------------------------------
    (function () {
      const p6 = wizard.querySelector('.checkout-step[data-step="5"]');
      if (!p6) return;

      const parseLocalDate = (s) => {
        const [y, m, d] = s.split("-").map(Number);
        return new Date(y, m - 1, d);
      };
      const formatLocal = (d) => {
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${d.getFullYear()}-${mm}-${dd}`;
      };

      const specialIns = document.getElementById("ctl00_PageBody_SpecialInstructionsTextBox");
      if (!specialIns) return;

      const siWrap =
        specialIns.closest(".epi-form-group-checkout") ||
        specialIns.closest(".epi-form-col-single-checkout") ||
        specialIns.parentElement;

      specialIns.style.display = "none";

      const pickupDiv = document.createElement("div");
      pickupDiv.className = "form-group";
      pickupDiv.innerHTML = `
        <label for="pickupDate">Requested Pickup Date:</label>
        <input type="date" id="pickupDate" class="form-control">
        <label for="pickupTime">Requested Pickup Time:</label>
        <select id="pickupTime" class="form-control" disabled></select>
        <label for="pickupPerson">Pickup Person:</label>
        <input type="text" id="pickupPerson" class="form-control">`;
      pickupDiv.style.display = "none";

      const deliveryDiv = document.createElement("div");
      deliveryDiv.className = "form-group";
      deliveryDiv.innerHTML = `
        <label for="deliveryDate">Requested Delivery Date:</label>
        <input type="date" id="deliveryDate" class="form-control">
        <div>
          <label><input type="radio" name="deliveryTime" value="Morning"> Morning</label>
          <label><input type="radio" name="deliveryTime" value="Afternoon"> Afternoon</label>
        </div>`;
      deliveryDiv.style.display = "none";

      const shippingAutoNote = document.createElement("div");
      shippingAutoNote.className = "alert alert-info wl-auto-ship-note";
      shippingAutoNote.style.display = "none";
      shippingAutoNote.style.marginTop = "10px";
      shippingAutoNote.innerHTML = "<strong>Ship via UPS:</strong> Choose the shipping speed on the next screen. We will show the estimated arrival date before payment.";

      siWrap.insertAdjacentElement("afterend", pickupDiv);
      pickupDiv.insertAdjacentElement("afterend", deliveryDiv);
      deliveryDiv.insertAdjacentElement("afterend", shippingAutoNote);

      const extraDiv = document.createElement("div");
      extraDiv.className = "form-group";
      extraDiv.innerHTML = `
        <label for="specialInsExtra">Additional instructions:</label>
        <textarea id="specialInsExtra" class="form-control" placeholder="Optional additional notes"></textarea>`;
      shippingAutoNote.insertAdjacentElement("afterend", extraDiv);

      const specialExtra = document.getElementById("specialInsExtra");

      const today = new Date();
      const isoToday = formatLocal(today);
      const maxPickupD = new Date();
      maxPickupD.setDate(maxPickupD.getDate() + 14);
      const minDelD = new Date();
      minDelD.setDate(minDelD.getDate() + 2);

      const pickupInput = pickupDiv.querySelector("#pickupDate");
      const pickupTimeSel = pickupDiv.querySelector("#pickupTime");
      const deliveryInput = deliveryDiv.querySelector("#deliveryDate");

      const WL_DATE_STATE_KEY = "wl_checkout_date_state_v2";

      function clearDateFieldErrors() {
        try {
          p6.querySelectorAll(".wl-field-invalid").forEach((el) => el.classList.remove("wl-field-invalid"));
          p6.querySelectorAll(".wl-field-msg").forEach((el) => el.remove());
        } catch {}
      }

      function markDateInvalid(el, label) {
        if (!el) return;
        try { el.classList.add("wl-field-invalid"); } catch {}
        try {
          const host = el.closest(".form-group") || el.parentElement;
          if (host && !host.querySelector(".wl-field-msg")) {
            const msg = document.createElement("div");
            msg.className = "wl-field-msg";
            msg.textContent = label;
            host.appendChild(msg);
          }
        } catch {}
      }

      function saveDateState() {
        try {
          const selectedDeliveryTime = deliveryDiv.querySelector('input[name="deliveryTime"]:checked');
          sessionStorage.setItem(WL_DATE_STATE_KEY, JSON.stringify({
            ts: Date.now(),
            pickupDate: pickupInput.value || "",
            pickupTime: pickupTimeSel.value || "",
            pickupPerson: pickupDiv.querySelector("#pickupPerson")?.value || "",
            deliveryDate: deliveryInput.value || "",
            deliveryTime: selectedDeliveryTime ? selectedDeliveryTime.value : "",
            extra: specialExtra.value || "",
            special: specialIns.value || ""
          }));
        } catch {}
      }

      function restoreDateState(opts) {
        opts = opts || {};
        const onlyBlank = !!opts.onlyBlank;
        try {
          const raw = sessionStorage.getItem(WL_DATE_STATE_KEY);
          if (!raw) return;
          const data = JSON.parse(raw);
          if (!data || (Date.now() - (data.ts || 0)) > 60 * 60 * 1000) return;

          if (data.pickupDate && (!onlyBlank || !pickupInput.value)) {
            pickupInput.value = data.pickupDate;
            try { populatePickupTimes(parseLocalDate(data.pickupDate)); } catch {}
          }
          if (data.pickupTime && (!onlyBlank || !pickupTimeSel.value)) {
            try { pickupTimeSel.value = data.pickupTime; } catch {}
          }
          const pickupPerson = pickupDiv.querySelector("#pickupPerson");
          if (pickupPerson && data.pickupPerson && (!onlyBlank || !pickupPerson.value)) pickupPerson.value = data.pickupPerson;
          if (data.deliveryDate && (!onlyBlank || !deliveryInput.value)) deliveryInput.value = data.deliveryDate;
          if (data.deliveryTime) {
            const r = deliveryDiv.querySelector(`input[name="deliveryTime"][value="${data.deliveryTime}"]`);
            if (r && (!onlyBlank || !deliveryDiv.querySelector('input[name="deliveryTime"]:checked'))) r.checked = true;
          }
          if (data.extra && (!onlyBlank || !specialExtra.value)) specialExtra.value = data.extra;
          if (data.special && (!onlyBlank || !specialIns.value)) specialIns.value = data.special;
        } catch {}
      }

      pickupInput.setAttribute("min", isoToday);
      pickupInput.setAttribute("max", formatLocal(maxPickupD));
      deliveryInput.setAttribute("min", formatLocal(minDelD));

      function formatTime(h, m) {
        const ampm = h >= 12 ? "PM" : "AM";
        const hh = h % 12 || 12;
        const mm = String(m).padStart(2, "0");
        return `${hh}:${mm} ${ampm}`;
      }

      function minutesFromMidnight(d) {
        return d.getHours() * 60 + d.getMinutes();
      }

      // NEW: if selected pickup date is today, minimum start time is now + 120 minutes,
      // rounded up to next hour
      function getSameDayMinStartMins() {
        const now = new Date();
        const mins = minutesFromMidnight(now) + 120; // +2h
        // round up to next hour boundary
        return Math.ceil(mins / 60) * 60;
      }

      function populatePickupTimes(date) {
        const day = date.getDay();
        let openMins = 7 * 60 + 30;
        let closeMins;

        if (1 <= day && day <= 5) closeMins = 17 * 60 + 30;
        else if (day === 6) closeMins = 16 * 60;
        else closeMins = openMins + 60; // Sunday: basically none

        // Apply same-day rule
        const isSameDay =
          date.getFullYear() === today.getFullYear() &&
          date.getMonth() === today.getMonth() &&
          date.getDate() === today.getDate();

        let minStart = openMins;
        if (isSameDay) {
          minStart = Math.max(openMins, getSameDayMinStartMins());
        }

        pickupTimeSel.innerHTML = "";

        // We show 1-hour windows [m, m+60], starting at minStart, stepping by 60
        // Ensure the window fits fully before close
        // Also snap minStart to an hour boundary to keep clean windows
        minStart = Math.ceil(minStart / 60) * 60;

        for (let m = minStart; m + 60 <= closeMins; m += 60) {
          const start = formatTime(Math.floor(m / 60), m % 60);
          const end = formatTime(Math.floor((m + 60) / 60), (m + 60) % 60);
          const opt = document.createElement("option");
          opt.value = `${start}–${end}`;
          opt.text = `${start} – ${end}`;
          pickupTimeSel.appendChild(opt);
        }

        pickupTimeSel.disabled = false;

        // If nothing available same-day, disable and show a placeholder option
        if (!pickupTimeSel.options.length) {
          pickupTimeSel.disabled = true;
          const opt = document.createElement("option");
          opt.value = "";
          opt.text = "No pickup times available today (select another date)";
          pickupTimeSel.appendChild(opt);
        }
      }

      pickupInput.addEventListener("change", function () {
        if (!this.value) return updateSpecial();
        let d = parseLocalDate(this.value);

        if (d.getDay() === 0) {
          alert("No Sunday pickups – moved to Monday");
          d.setDate(d.getDate() + 1);
        }
        if (d > maxPickupD) {
          alert("Pickups only within next two weeks");
          d = maxPickupD;
        }

        this.value = formatLocal(d);
        populatePickupTimes(d);
        updateSpecial();
      });

      deliveryInput.addEventListener("change", function () {
        if (!this.value) return updateSpecial();
        let d = parseLocalDate(this.value);
        if (d.getDay() === 0) {
          alert("No Sunday deliveries – moved to Monday");
          d.setDate(d.getDate() + 1);
        }
        if (d < minDelD) {
          alert("Select at least 2 days out");
          d = minDelD;
        }
        this.value = formatLocal(d);
        updateSpecial();
      });

      const rbPick = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbCollectLater");
      const rbDel = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbDelivered");
      const rbUPS = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbUPSDelivery");
      const zipInput = document.getElementById("ctl00_PageBody_DeliveryAddress_Postcode");

      function inZone(z) {
        return ["75", "76", "77", "78", "79"].includes((z || "").substring(0, 2));
      }

      function deliveryStateText() {
        const state = document.getElementById("ctl00_PageBody_DeliveryAddress_CountySelector_CountyList");
        if (!state) return "";
        const txt = state.selectedOptions && state.selectedOptions[0] ? (state.selectedOptions[0].text || state.selectedOptions[0].textContent || "") : "";
        return String(txt || state.value || "").trim();
      }

      function isTexasDeliveryAddress() {
        const s = deliveryStateText().toLowerCase();
        return s === "tx" || s === "texas";
      }

      function isOutOfTexasDelivery() {
        if (!getDeliveredSelected() || getPickupSelected()) return false;
        const s = deliveryStateText().toLowerCase();
        if (!s || /^\[?select/i.test(s) || s === "0" || s === "00") return false;
        return !isTexasDeliveryAddress();
      }

      function isShippingOrder() {
        return isShippingIntent() || isOutOfTexasDelivery();
      }

      function nextValidDeliveryDate() {
        const d = new Date(minDelD.getFullYear(), minDelD.getMonth(), minDelD.getDate());
        if (d.getDay() === 0) d.setDate(d.getDate() + 1);
        return formatLocal(d);
      }

      function selectDeliveryTime(value) {
        const r = deliveryDiv.querySelector(`input[name="deliveryTime"][value="${value}"]`);
        if (r) r.checked = true;
      }

      function applyShippingDefaults() {
        if (!isShippingOrder()) return false;
        if (!deliveryInput.value) deliveryInput.value = nextValidDeliveryDate();
        selectDeliveryTime("Afternoon");
        return true;
      }

      function updateSpecial() {
        let baseText = "";

        if (rbPick && rbPick.checked) {
          const d = pickupInput.value;
          const t = pickupTimeSel.disabled ? "" : pickupTimeSel.value;
          const p = pickupDiv.querySelector("#pickupPerson").value;

          specialIns.readOnly = false;
          baseText = "Pickup on " + d + (t ? " at " + t : "") + (p ? " for " + p : "");
        } else if (getDeliveredSelected() && !getPickupSelected()) {
          specialIns.readOnly = true;
          const shippingOrder = applyShippingDefaults();
          if (!shippingOrder && inZone(zipInput ? zipInput.value : "")) {
            const d2 = deliveryInput.value;
            const t2 = deliveryDiv.querySelector('input[name="deliveryTime"]:checked');
            baseText = "Delivery on " + d2 + (t2 ? " (" + t2.value + ")" : "");
          } else {
            baseText = "Ship via UPS; shipping speed and estimated arrival selected on the next screen.";
          }
        }

        specialIns.value = baseText + (specialExtra.value ? " – " + specialExtra.value : "");
        saveDateState();
      }

      function onShip() {
        if (rbPick && rbPick.checked) {
          pickupDiv.style.display = "block";
          deliveryDiv.style.display = "none";
          shippingAutoNote.style.display = "none";

          // If date already chosen, enforce same-day rule immediately
          if (pickupInput.value) populatePickupTimes(parseLocalDate(pickupInput.value));
        } else if (getDeliveredSelected() && !getPickupSelected()) {
          pickupDiv.style.display = "none";
          const shippingOrder = applyShippingDefaults();
          deliveryDiv.style.display = shippingOrder ? "none" : "block";
          shippingAutoNote.style.display = shippingOrder ? "block" : "none";
        } else {
          pickupDiv.style.display = "none";
          deliveryDiv.style.display = "none";
          shippingAutoNote.style.display = "none";
        }
        updateSpecial();
      }

      if (rbPick) rbPick.addEventListener("change", onShip);
      if (rbDel) rbDel.addEventListener("change", onShip);
      if (rbUPS) rbUPS.addEventListener("change", onShip);
      ["ctl00_PageBody_DeliveryAddress_CountySelector_CountyList", "ctl00_PageBody_DeliveryAddress_Postcode"].forEach(function(id) {
        const node = document.getElementById(id);
        if (node) {
          node.addEventListener("change", onShip, true);
          node.addEventListener("input", onShip, true);
        }
      });

      pickupDiv.querySelector("#pickupPerson").addEventListener("input", updateSpecial);
      pickupTimeSel.addEventListener("change", updateSpecial);

      deliveryDiv
        .querySelectorAll('input[name="deliveryTime"]')
        .forEach((r) => r.addEventListener("change", updateSpecial));
      specialExtra.addEventListener("input", updateSpecial);

      function validateDateInstructions(mark) {
        mark = !!mark;
        if (mark) clearDateFieldErrors();
        const errors = [];
        const add = (el, msg) => { errors.push(msg); if (mark) markDateInvalid(el, msg); };

        if (getDeliveredSelected() && !getPickupSelected()) {
          const shippingOrder = applyShippingDefaults();
          if (!deliveryInput.value) add(deliveryInput, shippingOrder ? "Shipping date could not be defaulted. Please review the delivery address." : "Please select a requested delivery date.");
          const t = deliveryDiv.querySelector('input[name="deliveryTime"]:checked');
          if (!t) add(deliveryDiv.querySelector('input[name="deliveryTime"]'), shippingOrder ? "Shipping time could not be defaulted." : "Please choose Morning or Afternoon.");
        }

        if (getPickupSelected()) {
          if (!pickupInput.value) add(pickupInput, "Please select a requested pickup date.");
          const pickupPerson = pickupDiv.querySelector("#pickupPerson");
          if (!pickupPerson.value.trim()) add(pickupPerson, "Please enter who will pick up the order.");
          if (pickupTimeSel.disabled || !pickupTimeSel.value) add(pickupTimeSel, "Please select an available pickup time.");
        }

        if (errors.length) {
          if (mark) {
            showInlineError(5, `<strong>Please finish the Date & Instructions step.</strong><br>${errors.join("<br>")}`);
            try {
              const first = p6.querySelector(".wl-field-invalid");
              if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
            } catch {}
          }
          return false;
        }
        clearInlineError(5);
        return true;
      }

      function validateBeforeFinalSubmit() {
        try { wlSaveCheckoutSnapshot(); } catch {}
        if (!validateStep(1)) { showStep(1); return false; }
        if (getPickupSelected() && !validateStep(2)) { showStep(2); return false; }
        if (getDeliveredSelected() && !getPickupSelected() && !validateStep(3)) { showStep(3); return false; }
        if (!validateStep(4)) { showStep(4); return false; }
        showStep(5);
        return validateDateInstructions(true);
      }

      [pickupInput, pickupTimeSel, pickupDiv.querySelector("#pickupPerson"), deliveryInput, specialExtra]
        .filter(Boolean)
        .forEach((node) => {
          node.addEventListener("input", saveDateState, true);
          node.addEventListener("change", saveDateState, true);
        });
      deliveryDiv.querySelectorAll('input[name="deliveryTime"]').forEach((node) => node.addEventListener("change", saveDateState, true));

      restoreDateState({ onlyBlank: true });
      onShip();

      // Expose refresh hooks so UpdatePanel partial postbacks can restore visibility/state.
      window.WLCheckout = window.WLCheckout || {};
      window.WLCheckout.refreshDateUI = function () {
        try { restoreDateState({ onlyBlank: true }); } catch {}
        try { onShip(); } catch {}
      };
      window.WLCheckout.validateDateInstructions = validateDateInstructions;
      window.WLCheckout.validateBeforeFinalSubmit = validateBeforeFinalSubmit;


      // Client validation on Continue buttons
      if ($) {
        $("#ctl00_PageBody_ContinueButton1, #ctl00_PageBody_ContinueButton2").on("click", function (e) {
          try {
            if (!validateBeforeFinalSubmit()) {
              e.preventDefault();
              setExpectedNav(false);
              return;
            }
          } catch {}
          // Ensure pickup orders don't get blocked by required delivery fields
          try {
            if (getPickupSelected()) {
              // Validate billing now (so we can guide the user before server rejects)
              if (!validateAddressBlock("InvoiceAddress", 4, true)) {
                e.preventDefault();
                showStep(4);
                return;
              }
              try { ensureDeliveryRequiredForPickup(); } catch { try { syncBillingToDelivery({force:false}); } catch {} }
            }
          } catch {}

          setReturnStep(steps.length);
          setExpectedNav(true);

          let valid = true;
          const errors = [];

          if (getDeliveredSelected() && !getPickupSelected()) {
            if (!$("#deliveryDate").val()) {
              valid = false;
              errors.push("• Please select a Requested Delivery Date.");
            }
            if (!$('input[name="deliveryTime"]:checked').length) {
              valid = false;
              errors.push("• Please choose a Delivery Time (Morning or Afternoon).");
            }
          }

          if (getPickupSelected()) {
            if (!$("#pickupDate").val()) {
              valid = false;
              errors.push("• Please select a Requested Pickup Date.");
            }
            if (!$("#pickupPerson").val().trim()) {
              valid = false;
              errors.push("• Please enter a Pickup Person.");
            }
            if ($("#pickupTime").prop("disabled") || !$("#pickupTime").val()) {
              valid = false;
              errors.push("• Please select an available Pickup Time.");
            }
          }

          if (!valid) {
            e.preventDefault();
            alert("Hold on – we need a bit more info:\n\n" + errors.join("\n"));
            // Final step in this wizard is Step 5 (Date & Instructions)
            showStep(5);
            setExpectedNav(false);
            return;
          }

          setTimeout(function () {
            window.WLCheckout?.detectAndJumpToValidation?.();
          }, 900);
        });
      }
    })();

    // -------------------------------------------------------------------------
    // L) Robust validation scanner → jump to step containing first visible error
    // -------------------------------------------------------------------------
    (function () {
      function isVisible(el) {
        if (!el) return false;
        const s = window.getComputedStyle(el);
        return s.display !== "none" && s.visibility !== "hidden" && el.offsetParent !== null;
      }

      function findFirstInvalidElement() {
        const perInputSelectors = [
          "input.input-validation-error",
          "select.input-validation-error",
          "textarea.input-validation-error",
          "input.is-invalid",
          "select.is-invalid",
          "textarea.is-invalid",
          '[aria-invalid="true"]',
        ].join(",");

        const badInputs = Array.from(document.querySelectorAll(perInputSelectors)).filter(isVisible);
        if (badInputs.length) return badInputs[0];

        const validators = Array.from(
          document.querySelectorAll(
            "span[controltovalidate], span.validator, .field-validation-error, .text-danger"
          )
        ).filter((el) => isVisible(el) && (el.textContent || "").trim().length >= 1);

        if (validators.length) {
          const sp = validators[0];
          const ctl = sp.getAttribute("controltovalidate");
          if (ctl) {
            const target = document.getElementById(ctl);
            if (target) return target;
          }
          const nearby =
            sp.closest(".epi-form-group-checkout, .form-group, .epi-form-col-single-checkout")?.querySelector(
              "input,select,textarea"
            );
          return nearby || sp;
        }

        const summary = document.querySelector(".validation-summary-errors li, .validation-summary-errors");
        if (summary && isVisible(summary)) return summary;

        return null;
      }

      function paneStepFor(el) {
        const pane = el && el.closest ? el.closest(".checkout-step") : null;
        return pane && pane.dataset.step ? parseInt(pane.dataset.step, 10) : null;
      }

      function detectAndJumpToValidation() {
        const culprit = findFirstInvalidElement();
        if (!culprit) return false;

        const stepNum = paneStepFor(culprit) || 1;
        showStep(stepNum);

        try {
          culprit.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch {}

        return true;
      }

      window.WLCheckout = window.WLCheckout || {};
      window.WLCheckout.detectAndJumpToValidation = detectAndJumpToValidation;
    })();

    // -------------------------------------------------------------------------
    // M) Modern Shipping selector (Transaction is forced to ORDER)
    // -------------------------------------------------------------------------
    if ($) {
      $(function () {
        // Force ORDER and hide transaction type UI
        if ($("#ctl00_PageBody_TransactionTypeDiv").length) {
          try {
            $(".TransactionTypeSelector").hide();
            $("#ctl00_PageBody_TransactionTypeDiv").hide();
            $("#ctl00_PageBody_TransactionTypeSelector_rdbOrder").prop("checked", true);
            $("#ctl00_PageBody_TransactionTypeSelector_rdbQuote").prop("checked", false);
          } catch {}
        }

        if ($(".SaleTypeSelector").length) {
          $(".SaleTypeSelector").hide();

          if (!UPS_SHIPPING_ENABLED) {
            $("#ctl00_PageBody_SaleTypeSelector_rbUPSDelivery").prop("checked", false);
          }

          const hasNativeUps = UPS_SHIPPING_ENABLED && $("#ctl00_PageBody_SaleTypeSelector_rbUPSDelivery").length > 0;
          const shipHTML = `
            <div class="modern-shipping-selector d-flex justify-content-around">
              <button type="button" id="btnPickup" class="btn btn-secondary" data-mode="pickup" data-value="rbCollectLater">
                <span class="wl-option-label"><i class="fas fa-store"></i> Pickup</span>
                <span class="wl-option-meta">Choose a Woodson store</span>
                <span class="wl-option-tag">Free</span>
              </button>
              <button type="button" id="btnDelivered" class="btn btn-primary" data-mode="delivery" data-value="rbDelivered">
                <span class="wl-option-label"><i class="fas fa-truck"></i> Local Delivery</span>
                <span class="wl-option-meta">Woodson delivery in Texas</span>
                <span class="wl-option-tag" data-wl-delivery-tag>Texas address</span>
              </button>
              ${hasNativeUps ? `
              <button type="button" id="btnShip" class="btn btn-secondary" data-mode="ship" data-value="rbUPSDelivery">
                <span class="wl-option-label"><i class="fas fa-shipping-fast"></i> Ship via UPS</span>
                <span class="wl-option-meta">UPS service nationwide</span>
                <span class="wl-option-tag" data-wl-ship-tag>Rates at checkout</span>
              </button>` : ""}
            </div>`;
          $(".epi-form-col-single-checkout:has(.SaleTypeSelector)").append(shipHTML);

          (function(){
            const wlCss = `
.modern-shipping-selector .btn[disabled], .modern-shipping-selector .btn.disabled { pointer-events:auto; }
.modern-shipping-selector button.wl-selected{background-color:#6b0016 !important;color:#fff !important;border:none !important;}
.modern-shipping-selector button.wl-selected i{color:#fff !important;}
.modern-shipping-selector button.wl-unselected{background-color:#f5f5f5 !important;color:#000 !important;border:1px solid #ccc !important;}
.modern-shipping-selector button.wl-unselected i{color:#000 !important;}
.wl-step-li{display:flex;align-items:center;gap:10px;}
.wl-step-icon{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;}
.wl-step-icon svg{width:20px;height:20px;display:block;}
/* keep labels readable; numbers are replaced by icons */
.checkout-wizard ul li{display:flex;align-items:center;}
.checkout-wizard ul li .wl-step-label{line-height:1.1;}
/* When active/completed, keep icon color in sync with text */
.checkout-wizard ul li.active .wl-step-icon,
.checkout-wizard ul li.completed .wl-step-icon{color:inherit;}

/* Hide any native step numbers (WebTrack often uses ::before or a number span) */
.checkout-wizard ul li::before{content:none !important;display:none !important;}
.checkout-wizard ul li .step-number,
.checkout-wizard ul li .wizard-step-number,
.checkout-wizard ul li .stepNum,
.checkout-wizard ul li .number,
.checkout-wizard ul li .step{display:none !important;}

/* Woodson brand: active step pill */
.checkout-wizard ul li{padding:10px 12px;border-radius:10px;gap:10px;}
.checkout-wizard ul li.active{background:#6b0016 !important;color:#fff !important;}
.checkout-wizard ul li.active .wl-step-icon{color:#fff !important;}
.checkout-wizard ul li.completed{opacity:.75;}
.checkout-wizard ul li.completed:hover{opacity:1;}


/* Branch cards (Pickup) */
.wl-hidden-select{position:absolute !important;left:-9999px !important;width:1px !important;height:1px !important;opacity:0 !important;}
.wl-branch-wrap{margin-top:12px;}
.wl-branch-selected-title,.wl-branch-list-title{font-weight:700;margin:10px 0 8px 0;}
.wl-branch-card{width:100%;text-align:left;border-radius:14px;padding:14px 14px;border:1px solid #ddd;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.06);}
.wl-branch-card + .wl-branch-card{margin-top:10px;}
.wl-branch-name{font-weight:800;font-size:16px;margin-bottom:4px;}
.wl-branch-addr{font-size:13px;opacity:.85;line-height:1.25;}
.wl-branch-cta{margin-top:10px;font-weight:700;font-size:12px;opacity:.9;}
.wl-branch-card-option{cursor:pointer;}
.wl-branch-card-option:hover{border-color:#6b0016;box-shadow:0 2px 8px rgba(107,0,22,.18);}
.wl-branch-card-selected{border-color:#6b0016;}
.wl-field-invalid{border-color:#b00020 !important;box-shadow:0 0 0 3px rgba(176,0,32,.12) !important;background:#fffafa !important;}
.wl-field-msg{font-size:12px;color:#b00020;margin-top:4px;line-height:1.3;}
.wl-inline-error{border-left:4px solid #b00020;}
.wl-address-summary{border:1px solid #ddd;border-radius:12px;padding:12px;background:#fff;margin-bottom:12px;}
.wl-branch-grid{display:grid;grid-template-columns:1fr;gap:10px;}
@media (min-width: 900px){.wl-branch-grid{grid-template-columns:1fr 1fr;}}
`;
            try {
              if (!document.getElementById("wlCheckoutCss")) {
                const st = document.createElement("style");
                st.id = "wlCheckoutCss";
                st.textContent = wlCss;
                document.head.appendChild(st);
              }
            } catch {}
          })();

          function selectedStateText(selector) {
            const el = document.querySelector(selector);
            if (!el) return "";
            const option = el.selectedOptions && el.selectedOptions[0] ? el.selectedOptions[0] : null;
            return String((option && (option.text || option.textContent)) || el.value || "").trim().toLowerCase();
          }

          function addressRegion() {
            const state = selectedStateText("#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList") ||
              selectedStateText("#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList");
            if (!state || /^\[?select/.test(state) || state === "0" || state === "00") return "unknown";
            return state === "tx" || state === "texas" ? "texas" : "outside";
          }

          function updateAddressAwareOptions() {
            const region = addressRegion();
            const $delivery = $("#btnDelivered");
            const $ship = $("#btnShip");
            const $deliveryTag = $delivery.find("[data-wl-delivery-tag]");
            const $shipTag = $ship.find("[data-wl-ship-tag]");

            if (region === "outside") {
              $delivery.hide();
              $shipTag.text("Recommended for your address");
              const intent = getFulfillmentIntent();
              if (!intent || intent === "delivery") {
                setFulfillmentIntent("ship");
                try { sessionStorage.setItem("wl_fulfillment_method", "ship"); } catch {}
                window.setTimeout(function () {
                  const ups = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbUPSDelivery");
                  updateShippingStyles("ship", { silent: !!(ups && ups.checked) });
                }, 0);
              }
            } else if (region === "texas") {
              $delivery.show();
              $deliveryTag.text("Texas option");
              $shipTag.text("UPS option");
            } else {
              $delivery.show();
              $deliveryTag.text("Texas addresses");
              $shipTag.text("UPS option");
            }
          }

          function updateShippingStyles(mode, opts) {
            opts = opts || {};
            const silent = !!opts.silent;

            const delRad = $("#ctl00_PageBody_SaleTypeSelector_rbDelivered");
            const pickRad = $("#ctl00_PageBody_SaleTypeSelector_rbCollectLater");
            const upsRad = $("#ctl00_PageBody_SaleTypeSelector_rbUPSDelivery");
            const $buttons = $(".modern-shipping-selector button[data-mode]");

            $buttons.css({ opacity: 1, pointerEvents: "auto" });

            const hasSelection = mode === "pickup" || mode === "delivery" || mode === "ship";
            const isPickup = mode === "pickup";
            const isShip = mode === "ship";
            const isDelivered = mode === "delivery";
            const isDeliveryLike = isDelivered || isShip;

            // Visual styling (use classes + !important CSS to defeat theme overrides)
            try {
              const setSelected = (btn, selected) => {
                if (!btn || !btn.length) return;
                btn.toggleClass("wl-selected", !!selected);
                btn.toggleClass("wl-unselected", !selected);
                btn.attr("aria-pressed", selected ? "true" : "false");
                // extra safety: force icon/text colors
                try {
                  const el = btn.get(0);
                  if (el && el.style) {
                    el.style.setProperty("background-color", selected ? "#6b0016" : "#f5f5f5", "important");
                    el.style.setProperty("color", selected ? "#fff" : "#000", "important");
                    el.style.setProperty("border", selected ? "none" : "1px solid #ccc", "important");
                  }
                  btn.find("i").each(function(){
                    try { this.style.setProperty("color", selected ? "#fff" : "#000", "important"); } catch(e){}
                  });
                } catch (e) {}
              };

              $buttons.each(function () {
                const $button = $(this);
                setSelected($button, hasSelection && $button.data("mode") === mode);
              });
            } catch (e) {}

            // Persist selection for other modules only after the customer/system has actually selected a sale type.
            if (hasSelection) {
              document.cookie = "pickupSelected=" + (isDeliveryLike ? "false" : "true") + ";path=/";
              try {
                setFulfillmentIntent(mode);
                sessionStorage.setItem("wl_fulfillment_method", mode);
              } catch {}
            }
            updateAddressAwareOptions();
            // Keep underlying panels sane (does not trigger postback)
            if (hasSelection) {
              try { ensureShippingPanelVisibility(isDeliveryLike); } catch (e) {}
            }

            // IMPORTANT: on initial load we only want Step 1 (selection) visible.
            // Only on user interaction do we select the WebTrack radio + advance.
            if (!silent && hasSelection) {
              // Changing ship/pickup selection resets Billing confirmation gates
              try { sessionStorage.removeItem("wl_billing_confirmed_delivered"); } catch {}
              const nextStep = isDeliveryLike ? 3 : 2;

              // Let the postback-return logic know where to land if the page refreshes.
              try {
                sessionStorage.setItem("wl_pendingStep", String(nextStep));
                setExpectedNav();
              } catch (e) {}

              // Select the underlying WebTrack radio (may cause an UpdatePanel postback)
              try {
                if (isDelivered && delRad.length && !delRad.is(":checked")) {
                  delRad.prop("checked", true).trigger("click").trigger("change");
                } else if (isShip && upsRad.length && !upsRad.is(":checked")) {
                  upsRad.prop("checked", true).trigger("click").trigger("change");
                } else if (isShip && !upsRad.length && delRad.length && !delRad.is(":checked")) {
                  delRad.prop("checked", true).trigger("click").trigger("change");
                } else if (isPickup && pickRad.length && !pickRad.is(":checked")) {
                  pickRad.prop("checked", true).trigger("click").trigger("change");
                }
              } catch (e) {}

              // Advance immediately so the user lands on the right step right away.
              try {
                showStep(nextStep);
                setStep(nextStep);
                clearBillingConfirmed();
              } catch (e) {}
            }

            // Refresh pickup-mode UI (uses pickupSelected cookie)
            try {
              if (window.WLCheckout && typeof window.WLCheckout.updatePickupModeUI === "function") {
                window.WLCheckout.updatePickupModeUI();
              }
              window.WLCheckout?.refreshDateUI?.();
              window.WLCheckout?.refreshSectionSummaries?.();
            } catch (e) {}

            if (!silent && hasSelection) {
              try {
                document.dispatchEvent(new CustomEvent("wl:fulfillment-change", { detail: { mode: mode } }));
              } catch {}
            }
          }

          updateAddressAwareOptions();
          updateShippingStyles(getFulfillmentIntent(), { silent: true });

          $(document).on("click", ".modern-shipping-selector button", function () {
            updateShippingStyles($(this).data("mode"));
          });

          $(document).on("change", "#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList, #ctl00_PageBody_InvoiceAddress_CountySelector_CountyList", updateAddressAwareOptions);
          window.setTimeout(updateAddressAwareOptions, 300);
          window.setTimeout(updateAddressAwareOptions, 900);
        }
      });
    }

    // -------------------------------------------------------------------------
    // N) Hide "Special Instructions" column header if present
    // -------------------------------------------------------------------------
    try {
      document.querySelectorAll("th").forEach((th) => {
        if ((th.textContent || "").includes("Special Instructions")) th.style.display = "none";
      });
    } catch {}


    // -------------------------------------------------------------------------
    // N.5) Auto-handle stock shortage modal with a softer flow
    // - Watches specifically for #stockModal becoming visible on the final step
    // - Immediately hides the blocking modal/backdrop and triggers native Yes
    // - Drops a friendly inline notice for the customer
    // -------------------------------------------------------------------------
    (function () {
      const STOCK_NOTICE_KEY = "wl_stock_shortage_notice";
      let stockProceeding = false;
      let stockLastTriggerAt = 0;
      let stockObserver = null;
      let stockPoll = null;

      function isVisible(el) {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (el.classList.contains("show")) return true;
        if (el.getAttribute("aria-modal") === "true") return true;
        return el.offsetParent !== null;
      }

      function removeStockModalArtifacts() {
        try { document.body.classList.remove("modal-open"); } catch {}
        try { document.body.style.removeProperty("padding-right"); } catch {}
        try {
          document.querySelectorAll(".modal-backdrop, .stock-modal-backdrop").forEach((el) => el.remove());
        } catch {}
      }

      function buildShortageMessage(modal) {
        try {
          const rows = Array.from(modal.querySelectorAll("table tr")).slice(1);
          const count = rows.length;
          if (count > 1) {
            return "Some items in your order may need a little extra time. We’ll continue processing your order and confirm timing for any quantity that needs to be sourced from available inventory or normal replenishment.";
          }
          return "This order includes an item that may need a little extra time. We’ll continue processing your order and confirm timing for any quantity that needs to be sourced from available inventory or normal replenishment.";
        } catch {
          return "Some items in your order may need a little extra time. We’ll continue processing your order and confirm timing as needed.";
        }
      }

      function persistShortageNotice(message) {
        try {
          sessionStorage.setItem(STOCK_NOTICE_KEY, JSON.stringify({ message: message || "Some items in your order may need a little extra time.", ts: Date.now() }));
        } catch {}
      }

      function renderShortageNotice() {
        let payload = null;
        try {
          const raw = sessionStorage.getItem(STOCK_NOTICE_KEY);
          if (!raw) return;
          sessionStorage.removeItem(STOCK_NOTICE_KEY);
          payload = JSON.parse(raw);
        } catch {
          return;
        }
        if (!payload || !payload.message) return;

        const existing = document.getElementById("wlStockNotice");
        if (existing) existing.remove();

        const notice = document.createElement("div");
        notice.id = "wlStockNotice";
        notice.className = "wl-stock-notice";
        notice.innerHTML = '<div class="wl-stock-notice__title">Order update</div><div class="wl-stock-notice__body"></div>';
        const body = notice.querySelector('.wl-stock-notice__body');
        if (body) body.textContent = payload.message;

        const target =
          document.querySelector('.checkout-step[data-step="5"] .checkout-nav') ||
          document.querySelector('.checkout-step[data-step="5"]') ||
          document.querySelector('.checkout-wizard') ||
          document.querySelector('.container');
        if (target) {
          target.parentNode.insertBefore(notice, target);
        }
      }

      function injectStockNoticeCss() {
        if (document.getElementById("wl-stock-notice-css")) return;
        const style = document.createElement("style");
        style.id = "wl-stock-notice-css";
        style.textContent = [
          '.wl-stock-notice{margin:12px 0 16px;padding:14px 16px;border-radius:12px;background:#f8fafc;border:1px solid #dbe5ef;color:#243447;box-shadow:0 1px 2px rgba(0,0,0,.04);}',
          '.wl-stock-notice__title{font-weight:700;margin-bottom:4px;}',
          '.wl-stock-notice__body{line-height:1.45;}',
          '#stockModal.wl-auto-bypass{display:none !important;visibility:hidden !important;opacity:0 !important;pointer-events:none !important;}'
        ].join('');
        document.head.appendChild(style);
      }

      function triggerStockYes(modal) {
        const yes = modal && modal.querySelector('#ctl00_PageBody_YesButton');
        if (!yes) return false;

        persistShortageNotice(buildShortageMessage(modal));

        try { modal.classList.add('wl-auto-bypass'); } catch {}
        try { modal.setAttribute('aria-hidden', 'true'); } catch {}
        try { modal.style.display = 'none'; } catch {}
        removeStockModalArtifacts();

        stockProceeding = true;
        stockLastTriggerAt = Date.now();

        try {
          yes.setAttribute('data-wl-autoclicked', '1');
          yes.click();
          return true;
        } catch {}

        try {
          const href = yes.getAttribute('href') || '';
          if (href.indexOf('javascript:') === 0) {
            eval(href.replace(/^javascript:/i, ''));
            return true;
          }
        } catch {}

        try {
          const uniqueName = yes.getAttribute('name') || 'ctl00$PageBody$YesButton';
          if (typeof WebForm_DoPostBackWithOptions === 'function' && typeof WebForm_PostBackOptions === 'function') {
            WebForm_DoPostBackWithOptions(new WebForm_PostBackOptions(uniqueName, '', true, '', '', false, true));
            return true;
          }
        } catch {}

        try {
          if (typeof __doPostBack === 'function') {
            __doPostBack('ctl00$PageBody$YesButton', '');
            return true;
          }
        } catch {}

        stockProceeding = false;
        return false;
      }

      function maybeHandleStockModal() {
        const modal = document.getElementById('stockModal');
        if (!modal || !isVisible(modal)) return false;

        const now = Date.now();
        if (stockProceeding && (now - stockLastTriggerAt) < 2500) {
          try { modal.classList.add('wl-auto-bypass'); modal.style.display = 'none'; } catch {}
          removeStockModalArtifacts();
          return true;
        }

        return triggerStockYes(modal);
      }

      function bindStockModalBypass() {
        injectStockNoticeCss();
        renderShortageNotice();

        try {
          if (!stockObserver && document.body) {
            stockObserver = new MutationObserver(function () {
              maybeHandleStockModal();
            });
            stockObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'aria-modal'] });
          }
        } catch {}

        try {
          if (!stockPoll) stockPoll = window.setInterval(maybeHandleStockModal, 250);
        } catch {}

        try { maybeHandleStockModal(); } catch {}
      }

      bindStockModalBypass();

      try {
        const prm = window.Sys && window.Sys.WebForms && window.Sys.WebForms.PageRequestManager
          ? window.Sys.WebForms.PageRequestManager.getInstance()
          : null;
        if (prm && !prm.__wlStockModalHooked) {
          prm.__wlStockModalHooked = true;
          prm.add_endRequest(function () {
            stockProceeding = false;
            injectStockNoticeCss();
            renderShortageNotice();
            setTimeout(maybeHandleStockModal, 0);
            setTimeout(maybeHandleStockModal, 150);
          });
        }
      } catch {}
    })();

    // -------------------------------------------------------------------------
    // O) Place order / Back to cart → reset wizard state
    // -------------------------------------------------------------------------
    (function () {
      const placeOrderBtn = document.getElementById("ctl00_PageBody_PlaceOrderButton");
      const backToCartBtn = document.getElementById("ctl00_PageBody_BackToCartButton3");

      function resetWizardState() {
        setSameAsDelivery(false);
        try { localStorage.removeItem(STEP_KEY); } catch {}
        try {
          sessionStorage.removeItem("wl_returnStep");
          sessionStorage.removeItem("wl_expect_nav");
          sessionStorage.removeItem("wl_autocopy_done");
          sessionStorage.removeItem("wl_billing_confirmed");
          sessionStorage.removeItem("wl_billing_seen");
          sessionStorage.removeItem("wl_billing_confirmed_delivered");
          sessionStorage.removeItem(WL_CHECKOUT_SNAPSHOT_KEY);
          sessionStorage.removeItem(WL_DATE_STATE_KEY_GLOBAL);
          sessionStorage.removeItem(WL_GUEST_KEY);
          sessionStorage.removeItem(WL_GUEST_AUTOFILL_KEY);
          sessionStorage.removeItem(WL_CHECKOUT_MODE_KEY);
          sessionStorage.removeItem("wl_fulfillment_method");
          sessionStorage.removeItem(FULFILLMENT_INTENT_KEY);
          sessionStorage.removeItem("wl_shipping_selection_v1");
        } catch {}
      }

      if (placeOrderBtn) placeOrderBtn.addEventListener("click", resetWizardState);
      if (backToCartBtn) backToCartBtn.addEventListener("click", resetWizardState);
    })();

    // -------------------------------------------------------------------------
    // P) Restore step on load
    // -------------------------------------------------------------------------
    const expectedNav = consumeExpectedNav();
    const returnStep = consumeReturnStep();
    const saved = getStep();

    // Restore the step WebForms meant to return to. This keeps customers from being
    // bounced back to Ship/Pickup after choosing a branch, copying billing, or hitting
    // a server-side validation refresh.
    let initial = returnStep || saved || 1;
    initial = parseInt(initial, 10);
    if (!Number.isFinite(initial)) initial = 1;
    if (initial >= 5 && !isBillingSeen()) initial = 4;

    setStep(initial);
    showStep(initial, { scroll: false });
    try { updatePickupModeUI(); } catch {}

    // Amazon-style checkout rows: keep completed sections compact, retain an Edit
    // action, and open only the first section that still needs customer input.
    (function installSectionSummaries() {
      if (!singlePageCheckout) return;

      const panes = Array.from(wizard.querySelectorAll(".checkout-step[data-step]"));
      let refreshTimer = null;

      function value(id) {
        return String(document.getElementById(id)?.value || "").trim();
      }

      function selectedText(el) {
        if (!el) return "";
        if (el.tagName === "SELECT") {
          const option = el.selectedOptions && el.selectedOptions[0] ? el.selectedOptions[0] : null;
          const selected = String((option && (option.text || option.textContent)) || el.value || "").replace(/\s+/g, " ").trim();
          return wlIsPlaceholderText(selected) ? "" : selected;
        }
        return String(el.value || "").trim();
      }

      function compactAddress(prefix) {
        const line1 = value(`ctl00_PageBody_${prefix}_AddressLine1`);
        const city = value(`ctl00_PageBody_${prefix}_City`);
        const state = selectedText(document.getElementById(`ctl00_PageBody_${prefix}_CountySelector_CountyList`));
        const zip = value(`ctl00_PageBody_${prefix}_Postcode`);
        return [line1, [city, state, zip].filter(Boolean).join(" ")].filter(Boolean).join(" - ");
      }

      function sectionValid(stepNum) {
        if (stepNum === 1) {
          const intent = getFulfillmentIntent();
          if (intent === "pickup") return getPickupSelected();
          if (intent === "delivery" || intent === "ship") return getDeliveredSelected() && !getPickupSelected();
          return false;
        }
        if (stepNum === 2) return !getPickupSelected() || isBranchChosen(getBranchField());
        if (stepNum === 3) return getPickupSelected() || !!window.WLCheckout?.addressBlockIsValid?.("DeliveryAddress", false);
        if (stepNum === 4) return !!window.WLCheckout?.addressBlockIsValid?.("InvoiceAddress", true);
        if (stepNum === 5) return !!window.WLCheckout?.validateDateInstructions?.(false);
        return true;
      }

      function sectionSummary(stepNum) {
        const intent = getFulfillmentIntent();
        if (stepNum === 1) {
          if (intent === "pickup") return "Pickup from a Woodson store";
          if (intent === "delivery") return "Local Woodson delivery";
          if (intent === "ship" && UPS_SHIPPING_ENABLED) return "Ship via UPS";
          return UPS_SHIPPING_ENABLED ? "Choose Pickup, Local Delivery, or UPS Shipping" : "Choose Pickup or Local Delivery";
        }
        if (stepNum === 2) {
          const branch = getBranchField();
          return selectedText(branch) || "Choose a pickup store";
        }
        if (stepNum === 3) return compactAddress("DeliveryAddress") || "Add a delivery or shipping address";
        if (stepNum === 4) return compactAddress("InvoiceAddress") || "Add a billing address";
        if (stepNum === 5) {
          if (intent === "ship") return "UPS speed and estimated arrival are selected next";
          if (getPickupSelected()) {
            return [value("pickupDate"), selectedText(document.getElementById("pickupTime")), value("pickupPerson")].filter(Boolean).join(" - ") || "Choose pickup timing";
          }
          const deliveryTime = document.querySelector('input[name="deliveryTime"]:checked');
          return [value("deliveryDate"), deliveryTime ? deliveryTime.value : ""].filter(Boolean).join(" - ") || "Choose delivery timing";
        }
        return "";
      }

      function refreshSectionSummaries() {
        let firstIncomplete = null;
        panes.forEach(function (pane) {
          const stepNum = Number(pane.dataset.step || 0);
          const unavailable = pane.classList.contains("wl-step-unavailable");
          const valid = unavailable || sectionValid(stepNum);
          const summary = pane.querySelector(".wl-section-summary");
          if (summary) summary.textContent = unavailable ? "Not needed for this order" : sectionSummary(stepNum);
          pane.classList.remove("wl-section-deferred");
          if (!unavailable && !valid && firstIncomplete == null) firstIncomplete = stepNum;
        });

        panes.forEach(function (pane) {
          const stepNum = Number(pane.dataset.step || 0);
          const unavailable = pane.classList.contains("wl-step-unavailable");
          const valid = unavailable || sectionValid(stepNum);
          const editing = pane.dataset.wlEditing === "1";

          if (unavailable) {
            pane.classList.remove("wl-section-collapsed", "wl-section-deferred");
          } else if (editing || stepNum === firstIncomplete) {
            pane.classList.remove("wl-section-collapsed", "wl-section-deferred");
          } else if (valid) {
            pane.classList.add("wl-section-collapsed");
            pane.classList.remove("wl-section-deferred");
          } else {
            pane.classList.add("wl-section-collapsed", "wl-section-deferred");
          }
        });

        return firstIncomplete;
      }

      function openSection(stepNum) {
        const pane = wizard.querySelector(`.checkout-step[data-step="${stepNum}"]`);
        if (!pane || pane.classList.contains("wl-step-unavailable")) return;
        panes.forEach(function (item) { item.dataset.wlEditing = "0"; });
        pane.dataset.wlEditing = "1";
        pane.classList.remove("wl-section-collapsed", "wl-section-deferred");
        if (stepNum === 3) window.WLCheckout?.showDeliveryEditor?.();
        if (stepNum === 4) window.WLCheckout?.showInvoiceEditor?.();
        try { pane.scrollIntoView({ behavior: "smooth", block: "start" }); } catch {}
      }

      function openFirstIncompleteSection() {
        const stepNum = refreshSectionSummaries();
        if (stepNum) openSection(stepNum);
        return stepNum;
      }

      function scheduleRefresh() {
        if (refreshTimer) window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(refreshSectionSummaries, 80);
      }

      wizard.addEventListener("click", function (event) {
        const edit = event.target && event.target.closest ? event.target.closest("[data-wl-edit-step]") : null;
        if (!edit) return;
        event.preventDefault();
        openSection(Number(edit.getAttribute("data-wl-edit-step")));
      });
      wizard.addEventListener("input", scheduleRefresh, true);
      wizard.addEventListener("change", scheduleRefresh, true);
      document.addEventListener("wl:fulfillment-change", function () {
        panes.forEach(function (pane) { pane.dataset.wlEditing = "0"; });
        window.setTimeout(function () {
          refreshSectionSummaries();
          openFirstIncompleteSection();
        }, 120);
      });

      window.WLCheckout = window.WLCheckout || {};
      window.WLCheckout.refreshSectionSummaries = refreshSectionSummaries;
      window.WLCheckout.openFirstIncompleteSection = openFirstIncompleteSection;

      window.setTimeout(function () {
        refreshSectionSummaries();
        openFirstIncompleteSection();
      }, 180);
    })();

    // Signed-in customers arriving from the cart can move directly to payment when
    // every saved checkout detail is already complete. The short handoff keeps an
    // obvious Review Details escape hatch and falls back to the full form when needed.
    (function startSmartCheckoutHandoff() {
      let requested = false;
      try { requested = sessionStorage.getItem(AUTO_ADVANCE_KEY) === "1"; } catch {}
      if (!singlePageCheckout || !requested) return;

      let cancelled = false;
      let advancing = false;
      let submitTimer = null;
      let retryTimer = null;
      let attempts = 0;

      const banner = document.createElement("div");
      banner.className = "wl-smart-handoff";
      banner.setAttribute("role", "status");
      banner.setAttribute("aria-live", "polite");
      banner.innerHTML = `
        <div class="wl-smart-handoff-copy">
          <strong>Checking your saved checkout details</strong>
          <span>We will continue to payment automatically when everything is ready.</span>
        </div>
        <button type="button">Review details</button>`;
      wizard.insertBefore(banner, wizard.firstChild);

      const copy = banner.querySelector(".wl-smart-handoff-copy");
      const reviewButton = banner.querySelector("button");

      function stopAutoAdvance() {
        cancelled = true;
        if (submitTimer) window.clearTimeout(submitTimer);
        if (retryTimer) window.clearTimeout(retryTimer);
        try { sessionStorage.removeItem(AUTO_ADVANCE_KEY); } catch {}
        banner.remove();
      }

      reviewButton.addEventListener("click", stopAutoAdvance);

      function canAutoAdvance() {
        if (!getFulfillmentIntent()) return false;
        if (!getPickupSelected() && !getDeliveredSelected()) return false;
        if (getPickupSelected()) {
          const branch = getBranchField();
          if (!isBranchChosen(branch)) return false;
        }
        if (getDeliveredSelected() && !getPickupSelected()) {
          if (!window.WLCheckout?.addressBlockIsValid?.("DeliveryAddress", false)) return false;
        }
        if (!window.WLCheckout?.addressBlockIsValid?.("InvoiceAddress", true)) return false;
        if (!window.WLCheckout?.validateDateInstructions?.(false)) return false;
        return true;
      }

      function attemptAutoAdvance() {
        if (cancelled || advancing) return;
        attempts += 1;

        try { window.WLCheckout?.refreshDateUI?.(); } catch {}
        if (!canAutoAdvance()) {
          if (!getFulfillmentIntent()) {
            copy.innerHTML = UPS_SHIPPING_ENABLED
              ? "<strong>How would you like to receive this order?</strong><span>Choose Pickup, Local Delivery, or UPS Shipping below.</span>"
              : "<strong>How would you like to receive this order?</strong><span>Choose Pickup or Local Delivery below.</span>";
            return;
          }
          if (attempts < 3) {
            retryTimer = window.setTimeout(attemptAutoAdvance, 350);
            return;
          }
          copy.innerHTML = "<strong>Please review your checkout details</strong><span>One or more choices still need your attention before payment.</span>";
          reviewButton.textContent = "Review below";
          try { window.WLCheckout?.openFirstIncompleteSection?.(); } catch {}
          return;
        }

        advancing = true;
        try {
          if (getPickupSelected()) {
            setBillingConfirmed(true);
            ensureDeliveryRequiredForPickup();
          } else {
            sessionStorage.setItem("wl_billing_confirmed_delivered", "1");
          }
          setBillingSeen(true);
          window.WLCheckout?.saveCheckoutSnapshot?.();
        } catch {}

        copy.innerHTML = "<strong>Saved details are ready</strong><span>Continuing to payment and order review...</span>";
        submitTimer = window.setTimeout(function () {
          if (cancelled) return;
          try { sessionStorage.removeItem(AUTO_ADVANCE_KEY); } catch {}
          const continueButton = wizard.querySelector(".wl-proxy-continue");
          if (continueButton) continueButton.click();
          else stopAutoAdvance();
        }, 1200);
      }

      function scheduleAutoAdvance() {
        if (cancelled || advancing) return;
        attempts = 0;
        if (retryTimer) window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(attemptAutoAdvance, 250);
      }

      document.addEventListener("wl:fulfillment-change", scheduleAutoAdvance);
      wizard.addEventListener("change", scheduleAutoAdvance, true);
      wizard.addEventListener("input", scheduleAutoAdvance, true);
      try {
        window.WLCheckout = window.WLCheckout || {};
        window.WLCheckout.trySmartAdvance = scheduleAutoAdvance;
      } catch {}

      window.setTimeout(attemptAutoAdvance, 250);
    })();

    if (expectedNav) {
      const tryJump = () => window.WLCheckout?.detectAndJumpToValidation?.() === true;
      if (!tryJump()) {
        setTimeout(tryJump, 0);
        setTimeout(tryJump, 300);
        setTimeout(tryJump, 1200);
        setTimeout(() => {
          if (!tryJump()) showStep(returnStep || saved || initial || 2);
        }, 1600);
      }
    }
  }

  // GTM can inject this file after DOMContentLoaded. Initialize immediately in that
  // case so checkout never falls through to the unenhanced WebTrack form.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCheckout, { once: true });
  } else {
    initCheckout();
  }
})();
