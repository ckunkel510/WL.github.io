/**
 * WL WebTrack Checkout Wizard (stable rebuild)
 * Version: 2026-02-18 (stable)
 *
 * Goals:
 *  - Require an explicit Ship/Pickup choice (even if WebTrack defaults one in the background)
 *  - Never "jump" past Delivery Address when Delivered is chosen
 *  - Survive WebForms postbacks (SaleType, Branch, ZIP, Select Address, etc.) by storing step/state in URL hash
 *  - Avoid breaking DOM (NO inserting divs right after a <textarea> inside a <td>, NO moving individual inputs)
 *
 * URL hash keys used:
 *   - wlstep: 1..5
 *   - wlship: rbDelivered | rbCollectLater
 *   - wlts  : timestamp (ms) (optional TTL)
 *
 * Debug:
 *   add ?wlDebug=1 to the URL to see console logs.
 */
(function () {
  "use strict";

  // Prevent double-init
  if (window.WLCheckoutWizard && window.WLCheckoutWizard.__inited) return;
  window.WLCheckoutWizard = window.WLCheckoutWizard || {};
  window.WLCheckoutWizard.__inited = true;

  var DEBUG = /[?&]wlDebug=1\b/i.test(location.search);
  function log() {
    if (!DEBUG) return;
    try { console.log.apply(console, ["[WL Checkout]"].concat([].slice.call(arguments))); } catch (e) {}
  }

  // ---------------------------
  // Hash state (survives postback)
  // ---------------------------
  function parseHash() {
    var raw = (location.hash || "").replace(/^#/, "");
    var out = {};
    if (!raw) return out;
    raw.split("&").forEach(function (pair) {
      if (!pair) return;
      var idx = pair.indexOf("=");
      var k = idx >= 0 ? pair.slice(0, idx) : pair;
      var v = idx >= 0 ? pair.slice(idx + 1) : "";
      if (!k) return;
      try {
        out[decodeURIComponent(k)] = decodeURIComponent(v);
      } catch (e) {
        out[k] = v;
      }
    });
    return out;
  }

  function setHash(patch) {
    var cur = parseHash();
    Object.keys(patch || {}).forEach(function (k) {
      var v = patch[k];
      if (v === null || v === undefined || v === "") delete cur[k];
      else cur[k] = String(v);
    });

    var parts = [];
    Object.keys(cur).forEach(function (k) {
      parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(cur[k]));
    });

    var newHash = parts.length ? "#" + parts.join("&") : "";
    var url = location.pathname + location.search + newHash;
    try { history.replaceState(null, "", url); } catch (e) { location.hash = newHash; }
  }

  function getHashInt(key, fallback) {
    var h = parseHash();
    var n = parseInt(h[key], 10);
    return isFinite(n) ? n : fallback;
  }

  function getHashStr(key, fallback) {
    var h = parseHash();
    var v = (h[key] || "").trim();
    return v ? v : fallback;
  }

  // If hash is "stale", ignore it.
  function isHashFresh(maxMinutes) {
    var ts = parseInt(getHashStr("wlts", ""), 10);
    if (!isFinite(ts) || ts <= 0) return false;
    var ageMs = Date.now() - ts;
    return ageMs >= 0 && ageMs <= (maxMinutes * 60 * 1000);
  }

  // ---------------------------
  // DOM helpers
  // ---------------------------
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function closestBlock(el) {
    if (!el) return null;
    return el.closest(".row") ||
      el.closest(".epi-form-col-single-checkout") ||
      el.closest(".epi-form-group-checkout") ||
      el.closest("div") ||
      el.parentElement;
  }

  function safeText(t) {
    return (t || "").replace(/\s+/g, " ").trim();
  }

  function tryPostBack(target) {
    // target should be the eventTarget string WebForms expects
    if (!target) return false;
    if (typeof window.__doPostBack === "function") {
      try {
        setTimeout(function () { window.__doPostBack(target, ""); }, 0);
        return true;
      } catch (e) {}
    }
    return false;
  }

  function isPostBackTrigger(el) {
    if (!el) return false;
    var href = (el.getAttribute && el.getAttribute("href")) || "";
    var oc = (el.getAttribute && el.getAttribute("onclick")) || "";
    return /__doPostBack\(/i.test(href) || /__doPostBack\(/i.test(oc) || /WebForm_DoPostBackWithOptions/i.test(oc);
  }

  // ---------------------------
  // Locate native controls/sections
  // ---------------------------
  function getShipRadios() {
    var delivered = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbDelivered") ||
      qs('input[id*="SaleTypeSelector_rbDelivered"]');
    var pickup = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbCollectLater") ||
      qs('input[id*="SaleTypeSelector_rbCollectLater"]');
    return { delivered: delivered, pickup: pickup };
  }

  function getBranchDDL() {
    return document.getElementById("ctl00_PageBody_BranchDropDownList") ||
      qs('select[id*="BranchDropDownList"]');
  }

  function getContinueBtn() {
    return document.getElementById("ctl00_PageBody_ContinueButton2") ||
      document.getElementById("ctl00_PageBody_ContinueButton1") ||
      qs('input[id*="ContinueButton"]');
  }

  function getDeliveryKeyField() {
    return document.getElementById("ctl00_PageBody_DeliveryAddress_AddressLine1") ||
      qs('[id*="DeliveryAddress_AddressLine1"]');
  }

  function getInvoiceKeyField() {
    return document.getElementById("ctl00_PageBody_InvoiceAddress_AddressLine1") ||
      qs('[id*="InvoiceAddress_AddressLine1"]');
  }

  function getPOField() {
    return document.getElementById("ctl00_PageBody_PurchaseOrderNumberTextBox") ||
      qs('input[id*="PurchaseOrderNumberTextBox"]');
  }

  function getSpecialInsField() {
    return document.getElementById("ctl00_PageBody_SpecialInstructionsTextBox") ||
      qs('textarea[id*="SpecialInstructionsTextBox"]');
  }

  function getDeliveryFields() {
    return {
      first: document.getElementById("ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox") || qs('[id*="DeliveryAddress_ContactFirstNameTextBox"]'),
      last: document.getElementById("ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox") || qs('[id*="DeliveryAddress_ContactLastNameTextBox"]'),
      addr1: document.getElementById("ctl00_PageBody_DeliveryAddress_AddressLine1") || qs('[id*="DeliveryAddress_AddressLine1"]'),
      city: document.getElementById("ctl00_PageBody_DeliveryAddress_City") || qs('[id*="DeliveryAddress_City"]'),
      state: document.getElementById("ctl00_PageBody_DeliveryAddress_CountySelector_CountyList") || qs('[id*="DeliveryAddress_CountySelector_CountyList"]'),
      zip: document.getElementById("ctl00_PageBody_DeliveryAddress_Postcode") || qs('[id*="DeliveryAddress_Postcode"]'),
      phone: document.getElementById("ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox") || qs('[id*="DeliveryAddress_ContactTelephoneTextBox"]')
    };
  }

  function getInvoiceFields() {
    return {
      addr1: document.getElementById("ctl00_PageBody_InvoiceAddress_AddressLine1") || qs('[id*="InvoiceAddress_AddressLine1"]'),
      city: document.getElementById("ctl00_PageBody_InvoiceAddress_City") || qs('[id*="InvoiceAddress_City"]'),
      state: document.getElementById("ctl00_PageBody_InvoiceAddress_CountySelector_CountyList") || qs('[id*="InvoiceAddress_CountySelector_CountyList"]'),
      zip: document.getElementById("ctl00_PageBody_InvoiceAddress_Postcode") || qs('[id*="InvoiceAddress_Postcode"]'),
      email: document.getElementById("ctl00_PageBody_InvoiceAddress_EmailAddressTextBox") || qs('[id*="InvoiceAddress_EmailAddressTextBox"]')
    };
  }

  // ---------------------------
  // Config knobs (safe defaults)
  // ---------------------------
  var CONFIG = {
    // You said branch step is usually hidden; keep it hidden by default
    forceHideBranchStep: true,
    // Require the user to click Delivered or Pickup before moving on
    requireExplicitShipChoice: false,
    // If true, selecting Delivered/Pickup will immediately trigger WebTrack's postback when changing away from the currently checked radio
    postBackOnShipChange: true,
    // TTL for hash (minutes). Helps avoid resuming to step 5 from some old checkout attempt.
    hashTTLMinutes: 30
  };

  // ---------------------------
  // Build wizard
  // ---------------------------
  function injectStyles() {
    if (document.getElementById("wlCheckoutWizardStyle")) return;
    var style = document.createElement("style");
    style.id = "wlCheckoutWizardStyle";
    style.textContent = [
      "#wlCheckoutWizard .checkout-wizard{background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:14px;padding:14px;margin:16px auto;max-width:980px;}",
      "#wlCheckoutWizard .checkout-steps{list-style:none;display:flex;gap:8px;padding:0;margin:0 0 14px 0;flex-wrap:wrap;}",
      "#wlCheckoutWizard .checkout-steps li{padding:8px 10px;border-radius:999px;border:1px solid rgba(0,0,0,.12);font-size:13px;opacity:.8;cursor:pointer;user-select:none;}",
      "#wlCheckoutWizard .checkout-steps li.active{opacity:1;border-color:rgba(0,0,0,.25);font-weight:700;}",
      "#wlCheckoutWizard .checkout-steps li.completed{opacity:1;background:rgba(0,0,0,.04);}",
      "#wlCheckoutWizard .checkout-step{display:none;}",
      "#wlCheckoutWizard .checkout-step.active{display:block;}",
      "#wlCheckoutWizard .checkout-nav{display:flex;gap:10px;justify-content:flex-end;margin-top:14px;}",
      "#wlCheckoutWizard .wl-ship-title{font-weight:700;margin-bottom:6px;}",
      "#wlCheckoutWizard .wl-ship-buttons{display:flex;gap:10px;}",
      "#wlCheckoutWizard .wl-ship-btn{flex:1 1 0%;}",
      "#wlCheckoutWizard .wl-ship-btn[aria-pressed='false']{opacity:.55;}",
      "#wlCheckoutWizard .wl-ship-help{font-size:12px;opacity:.8;margin-top:6px;}",
      "#wlCheckoutWizard .wl-summary{border:1px dashed rgba(0,0,0,.2);border-radius:12px;padding:10px 12px;margin-bottom:10px;}",
      "#wlCheckoutWizard .wl-summary strong{display:block;margin-bottom:4px;}",
      "#wlCheckoutWizard .wl-summary .btn-link{padding:0;font-size:13px;}",
      "#wlCheckoutWizard .wl-warning{background:rgba(255,193,7,.15);border:1px solid rgba(255,193,7,.35);padding:10px 12px;border-radius:12px;margin:10px 0;font-size:13px;}",
      "#wlCheckoutWizard .wl-error{color:#b00020;font-size:13px;margin-top:6px;}",
      "#wlCheckoutWizard .wl-req{color:#b00020;font-weight:700;}",
      "@media (max-width:640px){#wlCheckoutWizard .checkout-nav{justify-content:space-between;}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function createWizardShell() {
    if (qs("#wlCheckoutWizard")) return qs("#wlCheckoutWizard");

    var form = qs("form") || document.body;

    var shell = document.createElement("div");
    shell.id = "wlCheckoutWizard";
    shell.className = "container";
    shell.innerHTML =
      '<div class="checkout-wizard">' +
        '<ul class="checkout-steps">' +
          '<li data-step="1">Ship/Pickup</li>' +
          '<li data-step="2">Branch</li>' +
          '<li data-step="3">Delivery Address</li>' +
          '<li data-step="4">Billing Address</li>' +
          '<li data-step="5">Date &amp; Instructions</li>' +
        '</ul>' +
        '<div class="checkout-step" data-step="1"></div>' +
        '<div class="checkout-step" data-step="2"></div>' +
        '<div class="checkout-step" data-step="3"></div>' +
        '<div class="checkout-step" data-step="4"></div>' +
        '<div class="checkout-step" data-step="5"></div>' +
      '</div>';

    // Put at top of form so submit inputs remain inside form
    form.insertBefore(shell, form.firstChild);
    return shell;
  }

  function addNav(step, isFinal) {
    var stepEl = qs('#wlCheckoutWizard .checkout-step[data-step="' + step + '"]');
    if (!stepEl) return;
    if (qs(".checkout-nav", stepEl)) return;

    var nav = document.createElement("div");
    nav.className = "checkout-nav";

    if (step > 1) {
      var back = document.createElement("button");
      back.type = "button";
      back.className = "btn btn-secondary wl-back";
      back.dataset.wlBack = String(step - 1);
      back.textContent = "Back";
      nav.appendChild(back);
    }

    if (isFinal) {
      var cont = getContinueBtn();
      if (cont) {
        // Make sure it's visible in our wizard
        cont.style.display = "";
        nav.appendChild(cont);
      } else {
        // Fallback
        var done = document.createElement("button");
        done.type = "submit";
        done.className = "btn btn-primary";
        done.textContent = "Continue";
        nav.appendChild(done);
      }
    } else {
      var next = document.createElement("button");
      next.type = "button";
      next.className = "btn btn-primary wl-next";
      next.dataset.wlNext = String(step + 1);
      next.textContent = "Next";
      nav.appendChild(next);
    }

    stepEl.appendChild(nav);
  }

  function hideOriginalSubmitPanels() {
    // WebTrack often has submit-button-panel blocks; hide them so we don't see double Continue buttons
    qsa(".submit-button-panel").forEach(function (p) {
      try { p.style.display = "none"; } catch (e) {}
    });
  }

  // Determine if the branch step should be visible in THIS context
  function branchStepVisible() {
    if (CONFIG.forceHideBranchStep) return false;
    var ddl = getBranchDDL();
    if (!ddl) return false;
    if (ddl.options && ddl.options.length <= 1) return false;
    var block = closestBlock(ddl);
    if (!block) return false;
    try {
      if (getComputedStyle(block).display === "none") return false;
    } catch (e) {}
    return true;
  }

  // Build / move sections into steps (block-level only!)
  function moveSectionsIntoWizard() {
    var wizard = qs("#wlCheckoutWizard");
    if (!wizard) return false;

    var shipRadios = getShipRadios();
    var shipBlock = closestBlock(qs(".SaleTypeSelector")) || closestBlock(shipRadios.delivered) || closestBlock(shipRadios.pickup);
    var branchBlock = closestBlock(getBranchDDL());
    var deliveryBlock = closestBlock(getDeliveryKeyField());
    var invoiceBlock = closestBlock(getInvoiceKeyField());
    var instrBlock = closestBlock(getPOField()) || closestBlock(getSpecialInsField());

    if (!shipBlock || !deliveryBlock || !invoiceBlock || !instrBlock) {
      log("Missing blocks:", { shipBlock: !!shipBlock, deliveryBlock: !!deliveryBlock, invoiceBlock: !!invoiceBlock, instrBlock: !!instrBlock });
      return false;
    }

    // Make sure we don't move the same block twice on a single page instance
    function move(block, step) {
      if (!block) return;
      if (block.dataset && block.dataset.wlMoved === "1") return;
      var dest = qs('#wlCheckoutWizard .checkout-step[data-step="' + step + '"]');
      if (!dest) return;
      block.dataset.wlMoved = "1";
      dest.appendChild(block);
    }

    move(shipBlock, 1);
    if (branchBlock) move(branchBlock, 2);
    move(deliveryBlock, 3);
    move(invoiceBlock, 4);
    move(instrBlock, 5);

    return true;
  }

  // ---------------------------
  // Wizard state & navigation
  // ---------------------------
  var STATE = {
    shipChosen: "",   // rbDelivered | rbCollectLater | ""
    step: 1
  };

  function readNativeShipValue() {
    var r = getShipRadios();
    if (r.delivered && r.delivered.checked) return "rbDelivered";
    if (r.pickup && r.pickup.checked) return "rbCollectLater";
    return "";
  }

  function setShipChosen(value, opts) {
    opts = opts || {};
    STATE.shipChosen = value || "";

    // Update step 3 label (Delivery vs Sales)
    var step3Label = qs('#wlCheckoutWizard .checkout-steps li[data-step="3"]');
    if (step3Label) {
      step3Label.textContent = (STATE.shipChosen === "rbCollectLater") ? "Sales Address" : "Delivery Address";
    }

    // Toggle pickup vs delivery request fields in step 5 (if present)
    var pickupBox = qs("#wlPickupFields");
    var deliveryBox = qs("#wlDeliveryFields");
    if (pickupBox && deliveryBox) {
      if (STATE.shipChosen === "rbCollectLater") {
        pickupBox.style.display = "";
        deliveryBox.style.display = "none";
      } else if (STATE.shipChosen === "rbDelivered") {
        pickupBox.style.display = "none";
        deliveryBox.style.display = "";
      } else {
        // none selected yet
        pickupBox.style.display = "none";
        deliveryBox.style.display = "none";
      }
    }

    // Update native radios to match (only if explicitly requested)
    if (opts.syncNative) {
      var r = getShipRadios();
      if (r.delivered && r.pickup) {
        r.delivered.checked = (value === "rbDelivered");
        r.pickup.checked = (value === "rbCollectLater");
      }
    }

    // Persist to hash (fresh timestamp each time)
    setHash({ wlship: STATE.shipChosen, wlts: String(Date.now()) });

    // Enable/disable Next on step 1
    var step1 = qs('#wlCheckoutWizard .checkout-step[data-step="1"]');
    var nextBtn = step1 ? qs(".wl-next", step1) : null;
    if (nextBtn) {
      nextBtn.disabled = CONFIG.requireExplicitShipChoice && !STATE.shipChosen;
    }
  }

  function computeVisibleSteps() {
    var steps = [1, 3, 4, 5];
    if (branchStepVisible()) steps = [1, 2, 3, 4, 5];
    return steps;
  }

  function normalizeStep(step) {
    var vis = computeVisibleSteps();
    if (vis.indexOf(step) >= 0) return step;
    // If asking for step2 but hidden, go to 3; if asking for step3 but not exists, go to 4, etc.
    for (var i = 0; i < vis.length; i++) {
      if (vis[i] > step) return vis[i];
    }
    return vis[vis.length - 1];
  }

  function gotoStep(step, opts) {
    opts = opts || {};
    step = normalizeStep(step);

    STATE.step = step;
    setHash({ wlstep: String(step), wlts: String(Date.now()) });

    // Show correct step panel
    qsa("#wlCheckoutWizard .checkout-step").forEach(function (p) {
      p.classList.remove("active");
    });
    var active = qs('#wlCheckoutWizard .checkout-step[data-step="' + step + '"]');
    if (active) active.classList.add("active");

    // Step pills
    qsa("#wlCheckoutWizard .checkout-steps li").forEach(function (li) {
      var s = parseInt(li.getAttribute("data-step"), 10);
      li.classList.remove("active");
      li.classList.remove("completed");

      // Hide branch pill if branch step hidden
      if (s === 2 && !branchStepVisible()) {
        li.style.display = "none";
        return;
      }
      li.style.display = "";

      if (s === step) li.classList.add("active");
      else {
        var vis = computeVisibleSteps();
        if (vis.indexOf(s) >= 0 && vis.indexOf(s) < vis.indexOf(step)) li.classList.add("completed");
      }
    });

    // When entering a step, refresh summaries
    refreshDeliverySummary();
    refreshInvoiceSummary();

    // Step 1 "Next" disabled until shipping chosen
    if (step === 1) {
      var step1 = qs('#wlCheckoutWizard .checkout-step[data-step="1"]');
      var nextBtn = step1 ? qs(".wl-next", step1) : null;
      if (nextBtn) nextBtn.disabled = CONFIG.requireExplicitShipChoice && !STATE.shipChosen;
    }

    if (!opts.silent) log("gotoStep", step, "ship", STATE.shipChosen);
  }

  function nextStepFrom(step) {
    var vis = computeVisibleSteps();
    var idx = vis.indexOf(step);
    if (idx < 0) return vis[0];
    return vis[Math.min(idx + 1, vis.length - 1)];
  }

  function prevStepFrom(step) {
    var vis = computeVisibleSteps();
    var idx = vis.indexOf(step);
    if (idx <= 0) return vis[0];
    return vis[idx - 1];
  }

  // ---------------------------
  // Validation (lightweight guardrails)
  // ---------------------------
  function showInlineError(step, msg) {
    var panel = qs('#wlCheckoutWizard .checkout-step[data-step="' + step + '"]');
    if (!panel) return;
    var existing = qs(".wl-error", panel);
    if (!existing) {
      existing = document.createElement("div");
      existing.className = "wl-error";
      panel.insertBefore(existing, panel.firstChild);
    }
    existing.textContent = msg || "";
  }

  function clearInlineError(step) {
    var panel = qs('#wlCheckoutWizard .checkout-step[data-step="' + step + '"]');
    if (!panel) return;
    var existing = qs(".wl-error", panel);
    if (existing) existing.remove();
  }

  function validateStep(step) {
    clearInlineError(step);

    if (step === 1) {
      if (CONFIG.requireExplicitShipChoice && !STATE.shipChosen) {
        showInlineError(1, "Please choose Delivered or Pickup to continue.");
        return false;
      }
      return true;
    }

    if (step === 2) {
      var ddl = getBranchDDL();
      if (!ddl) return true;
      if (!ddl.value) {
        showInlineError(2, "Please select a branch to continue.");
        return false;
      }
      return true;
    }

    if (step === 3) {
      // Delivery/Sales address: require basics only when Delivered
      if (STATE.shipChosen === "rbDelivered") {
        var f = getDeliveryFields();
        if (f.addr1 && !safeText(f.addr1.value)) { showInlineError(3, "Please enter Address line 1."); return false; }
        if (f.city && !safeText(f.city.value)) { showInlineError(3, "Please enter City."); return false; }
        if (f.state && (f.state.value === "0" || f.state.value === "")) { showInlineError(3, "Please select State."); return false; }
        if (f.zip && !safeText(f.zip.value)) { showInlineError(3, "Please enter Zip code."); return false; }
      }
      return true;
    }

    if (step === 4) {
      var same = qs("#sameAsDeliveryCheck");
      if (same && same.checked) return true;
      var inv = getInvoiceFields();
      if (inv.addr1 && !safeText(inv.addr1.value)) { showInlineError(4, "Please enter Billing address line 1."); return false; }
      if (inv.city && !safeText(inv.city.value)) { showInlineError(4, "Please enter Billing city."); return false; }
      if (inv.state && (inv.state.value === "0" || inv.state.value === "")) { showInlineError(4, "Please select Billing state."); return false; }
      if (inv.zip && !safeText(inv.zip.value)) { showInlineError(4, "Please enter Billing zip code."); return false; }
      if (inv.email && !safeText(inv.email.value)) { showInlineError(4, "Please enter Email address."); return false; }
      return true;
    }

    if (step === 5) {
      if (STATE.shipChosen === "rbCollectLater") {
        var pd = qs("#pickupDate");
        var pt = qs("#pickupTime");
        var pp = qs("#pickupPerson");
        if (pd && !pd.value) { showInlineError(5, "Please select a requested pickup date."); return false; }
        if (pt && pt.disabled === false && !pt.value) { showInlineError(5, "Please select a requested pickup time."); return false; }
        if (pp && !safeText(pp.value)) { showInlineError(5, "Please enter the pickup person name."); return false; }
      }
      if (STATE.shipChosen === "rbDelivered") {
        var dd = qs("#deliveryDate");
        if (dd && !dd.value) { showInlineError(5, "Please select a requested delivery date."); return false; }
        var dt = qs('input[name="deliveryTime"]:checked');
        if (!dt) { showInlineError(5, "Please choose Morning or Afternoon for delivery."); return false; }
      }
      return true;
    }

    return true;
  }

  // ---------------------------
  // UI Enhancements
  // ---------------------------
  function enhanceShippingUI() {
    var step1 = qs('#wlCheckoutWizard .checkout-step[data-step="1"]');
    if (!step1) return;

    var shipRadios = getShipRadios();
    var deliveredRadio = shipRadios.delivered;
    var pickupRadio = shipRadios.pickup;

    // Hide the native selector visually, but keep it in DOM
    var native = qs(".SaleTypeSelector");
    if (native) {
      native.classList.add("d-none");
      native.setAttribute("aria-hidden", "true");
    }

    // Create modern selector if missing
    if (!qs("#wlModernShip", step1)) {
      var modern = document.createElement("div");
      modern.className = "modern-shipping-selector mt-2";
      modern.id = "wlModernShip";
      modern.innerHTML =
        '<div class="wl-ship-title">Shipping method</div>' +
        '<div class="wl-ship-buttons">' +
          '<button type="button" class="epi-button wl-ship-btn" data-value="rbDelivered" aria-pressed="false">Delivered</button>' +
          '<button type="button" class="epi-button wl-ship-btn" data-value="rbCollectLater" aria-pressed="false">Pickup (Free)</button>' +
        '</div>' +
        '<div class="wl-ship-help">Choose one to continue.</div>';

      // Put it right after the native selector if possible
      if (native && native.parentElement) native.parentElement.appendChild(modern);
      else step1.insertBefore(modern, step1.firstChild);
    }

    function applyButtonState() {
      qsa("#wlModernShip .wl-ship-btn", step1).forEach(function (btn) {
        var v = btn.getAttribute("data-value");
        var on = (v === STATE.shipChosen);
        btn.classList.toggle("wl-selected", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }

    function shipValueToEventTarget(v) {
      // WebTrack uses event target like ctl00$PageBody$SaleTypeSelector$rbDelivered
      if (v === "rbDelivered") return "ctl00$PageBody$SaleTypeSelector$rbDelivered";
      if (v === "rbCollectLater") return "ctl00$PageBody$SaleTypeSelector$rbCollectLater";
      return "";
    }

    function onShipClick(v) {
      var nativeBefore = readNativeShipValue();

      // Always set our state
      setShipChosen(v, { syncNative: true });
      applyButtonState();

      // Decide which step we want AFTER ship choice
      // (Your requirement: Delivered should go to Delivery Address first, not Billing)
      var targetStep = branchStepVisible() ? 2 : 3;
      setHash({ wlstep: String(targetStep), wlts: String(Date.now()) });

      // Trigger postback ONLY if switching away from current native selection
      if (CONFIG.postBackOnShipChange && v && v !== nativeBefore) {
        var eventTarget = shipValueToEventTarget(v);
        // Make sure the radio matches before postback
        if (deliveredRadio && pickupRadio) {
          deliveredRadio.checked = (v === "rbDelivered");
          pickupRadio.checked = (v === "rbCollectLater");
        }
        log("Ship change postback ->", eventTarget, "resume step", targetStep);
        if (!tryPostBack(eventTarget)) {
          // Fallback: click the native radio
          var input = (v === "rbDelivered") ? deliveredRadio : pickupRadio;
          try { input && input.click(); } catch (e) {}
        }
        return;
      }

      // No postback needed; just move forward in wizard
      gotoStep(targetStep);
    }

    // Wire ship buttons
    qsa("#wlModernShip .wl-ship-btn", step1).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var v = btn.getAttribute("data-value") || "";
        onShipClick(v);
      });
    });

    // Initial state:
    // - If hash is fresh and includes wlship, use it (so postback returns to same place without forcing another click)
    // - Otherwise, require explicit click even if WebTrack defaulted one in the background
    var initialShip = "";
    var hashShip = getHashStr("wlship", "");
    if (isHashFresh(CONFIG.hashTTLMinutes) && (hashShip === "rbDelivered" || hashShip === "rbCollectLater")) {
      initialShip = hashShip;
      // Ensure native matches (avoid UI saying Delivered while native is Pickup)
      var nativeVal = readNativeShipValue();
      if (nativeVal && nativeVal !== initialShip) {
        setShipChosen(initialShip, { syncNative: true });
        // If mismatch, request postback so server updates fields
        if (CONFIG.postBackOnShipChange) {
          var tgt = shipValueToEventTarget(initialShip);
          setHash({ wlstep: getHashStr("wlstep", "1"), wlts: String(Date.now()) });
          log("Hash ship mismatch => forcing postback", tgt);
          tryPostBack(tgt);
          return;
        }
      } else {
        setShipChosen(initialShip, { syncNative: true });
      }
    } else {
      // No fresh hash: require explicit user click
      if (CONFIG.requireExplicitShipChoice) {
        setShipChosen("", { syncNative: false });
      } else {
        setShipChosen(readNativeShipValue(), { syncNative: false });
      }
    }

    applyButtonState();
  }

  // Delivery summary (step 3)
  function refreshDeliverySummary() {
    var step3 = qs('#wlCheckoutWizard .checkout-step[data-step="3"]');
    if (!step3) return;
    var sum = qs("#wlDeliverySummary", step3);
    var formBlock = qs("#wlDeliveryFormBlock", step3);
    if (!sum || !formBlock) return;

    var f = getDeliveryFields();
    var lines = [];

    var name = safeText((f.first && f.first.value) ? f.first.value : "") + " " + safeText((f.last && f.last.value) ? f.last.value : "");
    name = safeText(name);

    var addr1 = safeText(f.addr1 && f.addr1.value);
    var city = safeText(f.city && f.city.value);
    var state = "";
    if (f.state && f.state.selectedOptions && f.state.selectedOptions[0]) state = safeText(f.state.selectedOptions[0].text);
    var zip = safeText(f.zip && f.zip.value);

    if (name) lines.push(name);
    if (addr1) lines.push(addr1);
    var cityLine = safeText([city, state, zip].filter(Boolean).join(", "));
    if (cityLine) lines.push(cityLine);

    var title = (STATE.shipChosen === "rbCollectLater") ? "Sales Address" : "Delivery Address";

    var hasBasics = !!addr1 && !!city && !!zip && (STATE.shipChosen !== "rbDelivered" || (f.state && f.state.value && f.state.value !== "0"));
    sum.querySelector("strong").textContent = title;

    var body = qs(".wl-summary-body", sum);
    if (body) body.innerHTML = lines.length ? lines.map(function (l) { return l + "<br>"; }).join("") : "<em>Not provided yet.</em>";

    // If basics exist, default to summary view; otherwise show form
    if (hasBasics) {
      sum.style.display = "";
      formBlock.style.display = "none";
    } else {
      sum.style.display = "none";
      formBlock.style.display = "";
    }
  }

  function enhanceDeliverySummary() {
    var step3 = qs('#wlCheckoutWizard .checkout-step[data-step="3"]');
    if (!step3) return;

    if (!qs("#wlDeliverySummary", step3)) {
      var summary = document.createElement("div");
      summary.id = "wlDeliverySummary";
      summary.className = "wl-summary";
      summary.innerHTML =
        "<strong>Delivery Address</strong>" +
        '<div class="wl-summary-body"></div>' +
        '<button type="button" class="btn btn-link" id="wlEditDelivery">Edit</button>';

      // Wrap the existing content block so we can hide/show it as a whole
      var holder = document.createElement("div");
      holder.id = "wlDeliveryFormBlock";

      // Move all children except nav into holder
      var nav = qs(".checkout-nav", step3);
      var kids = Array.prototype.slice.call(step3.childNodes);
      kids.forEach(function (n) {
        if (n === nav) return;
        holder.appendChild(n);
      });
      step3.insertBefore(summary, nav || step3.firstChild);
      step3.insertBefore(holder, nav || null);

      var editBtn = qs("#wlEditDelivery", summary);
      if (editBtn) {
        editBtn.addEventListener("click", function () {
          summary.style.display = "none";
          holder.style.display = "";
          // Scroll a bit for UX
          try { holder.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {}
        });
      }
    }

    refreshDeliverySummary();
  }

  // Invoice summary (step 4)
  function refreshInvoiceSummary() {
    var step4 = qs('#wlCheckoutWizard .checkout-step[data-step="4"]');
    if (!step4) return;
    var sum = qs("#wlInvoiceSummary", step4);
    var formBlock = qs("#wlInvoiceFormBlock", step4);
    if (!sum || !formBlock) return;

    var inv = getInvoiceFields();
    var addr1 = safeText(inv.addr1 && inv.addr1.value);
    var city = safeText(inv.city && inv.city.value);
    var state = "";
    if (inv.state && inv.state.selectedOptions && inv.state.selectedOptions[0]) state = safeText(inv.state.selectedOptions[0].text);
    var zip = safeText(inv.zip && inv.zip.value);
    var email = safeText(inv.email && inv.email.value);

    var lines = [];
    if (addr1) lines.push(addr1);
    var cityLine = safeText([city, state, zip].filter(Boolean).join(", "));
    if (cityLine) lines.push(cityLine);
    if (email) lines.push("Email: " + email);

    var hasBasics = !!addr1 && !!city && !!zip && (inv.state && inv.state.value && inv.state.value !== "0") && !!email;

    var body = qs(".wl-summary-body", sum);
    if (body) body.innerHTML = lines.length ? lines.map(function (l) { return l + "<br>"; }).join("") : "<em>Not provided yet.</em>";

    // If basics exist, default to summary view; otherwise show form
    if (hasBasics) {
      sum.style.display = "";
      formBlock.style.display = "none";
    } else {
      sum.style.display = "none";
      formBlock.style.display = "";
    }
  }

  function enhanceInvoiceSummary() {
    var step4 = qs('#wlCheckoutWizard .checkout-step[data-step="4"]');
    if (!step4) return;

    // Add "Same as delivery" if missing
    if (!qs("#sameAsDeliveryCheck", step4)) {
      var sameWrap = document.createElement("div");
      sameWrap.className = "form-check mb-3";
      sameWrap.innerHTML =
        '<input class="form-check-input" type="checkbox" id="sameAsDeliveryCheck">' +
        '<label class="form-check-label" for="sameAsDeliveryCheck">Billing address is the same as delivery address</label>';
      step4.insertBefore(sameWrap, step4.firstChild);
    }

    if (!qs("#wlInvoiceSummary", step4)) {
      var summary = document.createElement("div");
      summary.id = "wlInvoiceSummary";
      summary.className = "wl-summary";
      summary.innerHTML =
        "<strong>Billing Address</strong>" +
        '<div class="wl-summary-body"></div>' +
        '<button type="button" class="btn btn-link" id="wlEditInvoice">Enter / edit billing address</button>';

      var holder = document.createElement("div");
      holder.id = "wlInvoiceFormBlock";

      // Move all children except nav into holder (but keep the SameAs checkbox above summary)
      var nav = qs(".checkout-nav", step4);
      var kids = Array.prototype.slice.call(step4.childNodes);

      kids.forEach(function (n) {
        if (n === nav) return;
        if (n.nodeType === 1 && n.id === "sameAsDeliveryCheck") return;
        if (n.nodeType === 1 && n.classList && n.classList.contains("form-check")) return; // our checkbox wrapper
        holder.appendChild(n);
      });

      // Insert after checkbox wrapper
      var checkboxWrap = qs(".form-check", step4);
      if (checkboxWrap && checkboxWrap.nextSibling) step4.insertBefore(summary, checkboxWrap.nextSibling);
      else step4.insertBefore(summary, nav || null);

      step4.insertBefore(holder, nav || null);

      var editBtn = qs("#wlEditInvoice", summary);
      if (editBtn) {
        editBtn.addEventListener("click", function () {
          summary.style.display = "none";
          holder.style.display = "";
          try { holder.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {}
        });
      }
    }

    // Same-as-delivery behavior: if checked, try to use WebTrack's copy buttons when present
    var same = qs("#sameAsDeliveryCheck", step4);
    if (same) {
      same.addEventListener("change", function () {
        if (!same.checked) return;
        // If WebTrack has a copy button, click it (may postback). Ensure we resume to step 4.
        setHash({ wlstep: "4", wlts: String(Date.now()) });

        var copy1 = document.getElementById("ctl00_PageBody_CopyDeliveryAddressLinkButton") ||
          qs('a[id*="CopyDeliveryAddressLinkButton"]');
        if (copy1) {
          log("Same as delivery -> clicking copy link");
          try { copy1.click(); } catch (e) {}
        } else {
          // Fallback: copy values client-side
          var d = getDeliveryFields();
          var inv = getInvoiceFields();
          if (d.addr1 && inv.addr1) inv.addr1.value = d.addr1.value || "";
          if (d.city && inv.city) inv.city.value = d.city.value || "";
          if (d.state && inv.state) inv.state.value = d.state.value || inv.state.value;
          if (d.zip && inv.zip) inv.zip.value = d.zip.value || "";
          refreshInvoiceSummary();
        }
      });
    }

    refreshInvoiceSummary();
  }

  // Step 5: pickup/delivery request fields + instructions sync
  function formatDateISO(d) {
    function pad(n) { return n < 10 ? "0" + n : "" + n; }
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function buildTimeOptions(dateObj) {
    // Store hours memory:
    // Mon–Fri 7:30–5:30, Sat 7:30–4:00, Sun closed
    var day = dateObj.getDay(); // 0=Sun
    if (day === 0) return []; // closed
    var startMin = 7 * 60 + 30;
    var endMin = (day === 6) ? (16 * 60) : (17 * 60 + 30);
    var step = 30;

    var opts = [];
    for (var m = startMin; m <= endMin; m += step) {
      var hh = Math.floor(m / 60);
      var mm = m % 60;
      var ampm = hh >= 12 ? "PM" : "AM";
      var h12 = hh % 12; if (h12 === 0) h12 = 12;
      var label = h12 + ":" + (mm < 10 ? "0" + mm : mm) + " " + ampm;
      opts.push(label);
    }
    return opts;
  }

  function syncSpecialInstructions() {
    var si = getSpecialInsField();
    if (!si) return;

    var extra = safeText(qs("#specialInsExtra") && qs("#specialInsExtra").value);
    var text = "";

    if (STATE.shipChosen === "rbCollectLater") {
      var pd = qs("#pickupDate") && qs("#pickupDate").value;
      var pt = qs("#pickupTime") && qs("#pickupTime").value;
      var pp = safeText(qs("#pickupPerson") && qs("#pickupPerson").value);

      var pieces = [];
      if (pd) pieces.push("Pickup on " + pd + (pt ? " at " + pt : ""));
      if (pp) pieces.push("Pickup person: " + pp);
      if (extra) pieces.push(extra);

      text = pieces.join(" | ");
    } else if (STATE.shipChosen === "rbDelivered") {
      var dd = qs("#deliveryDate") && qs("#deliveryDate").value;
      var time = qs('input[name="deliveryTime"]:checked');
      var slot = time ? time.value : "";

      var piecesD = [];
      if (dd) piecesD.push("Delivery on " + dd + (slot ? " (" + slot + ")" : ""));
      if (extra) piecesD.push(extra);
      text = piecesD.join(" | ");
    } else {
      // no ship choice yet
      text = extra || "";
    }

    // Preserve any existing text if user already typed into the native field (but it's hidden)
    // If it already starts with our generated phrases, replace; otherwise append.
    var cur = safeText(si.value || "");
    if (!cur) si.value = text;
    else {
      // If the textarea is currently default like "Delivery on " (your snippet), overwrite with our generated content
      if (/^(Delivery on|Pickup on)\b/i.test(cur) || cur === "Delivery on") si.value = text;
      else si.value = cur + (text ? " | " + text : "");
    }
  }

  function enhanceInstructionsExtras() {
    var step5 = qs('#wlCheckoutWizard .checkout-step[data-step="5"]');
    if (!step5) return;

    var nav = qs(".checkout-nav", step5);
    var ta = getSpecialInsField(); // hidden WebForms textarea

    // Try to find existing UI fields (they may exist from an older/broken version)
    var pickupDateEl = qs("#pickupDate");
    var pickupTimeEl = qs("#pickupTime");
    var pickupPersonEl = qs("#pickupPerson");
    var deliveryDateEl = qs("#deliveryDate");
    var extraEl = qs("#specialInsExtra");

    function ensureWrappedGroup(rootEl, desiredId, createHtml) {
      var grp = rootEl ? closest(rootEl, ".form-group") : null;
      if (!grp) {
        grp = document.createElement("div");
        grp.className = "form-group";
        grp.innerHTML = createHtml;
        // refresh element refs if we just created them
      }
      grp.id = desiredId;
      return grp;
    }

    // Build (or reuse) the wrapper card
    var box = qs("#wlRequestFields");
    if (!box) {
      box = document.createElement("div");
      box.id = "wlRequestFields";
      box.className = "wl-card";
      box.style.marginTop = "14px";
      box.style.padding = "12px";
      box.style.border = "1px solid rgba(0,0,0,.12)";
      box.style.borderRadius = "10px";
      box.style.background = "#fff";
    }

    // Create/move groups (pickup / delivery / extra) into the wrapper
    var pickupHtml =
      '<label for="pickupDate">Requested Pickup Date:</label>' +
      '<input type="date" id="pickupDate" class="form-control" />' +
      '<label for="pickupTime">Requested Pickup Time:</label>' +
      '<select id="pickupTime" class="form-control" disabled></select>' +
      '<label for="pickupPerson">Pickup Person:</label>' +
      '<input type="text" id="pickupPerson" class="form-control" data-wl-pickup-sync="1" />';

    var deliveryHtml =
      '<label for="deliveryDate">Requested Delivery Date:</label>' +
      '<input type="date" id="deliveryDate" class="form-control" />' +
      '<div style="margin-top:8px;">' +
      '  <label style="margin-right:12px;"><input type="radio" name="deliveryTime" value="Morning"> Morning</label>' +
      '  <label><input type="radio" name="deliveryTime" value="Afternoon"> Afternoon</label>' +
      '</div>';

    var extraHtml =
      '<label for="specialInsExtra">Additional instructions:</label>' +
      '<textarea id="specialInsExtra" class="form-control" placeholder="Optional additional notes"></textarea>';

    // Ensure groups exist
    var pickupGroup = ensureWrappedGroup(pickupDateEl, "wlPickupFields", pickupHtml);
    var deliveryGroup = ensureWrappedGroup(deliveryDateEl, "wlDeliveryFields", deliveryHtml);
    var extraGroup = ensureWrappedGroup(extraEl, "wlExtraFields", extraHtml);

    // If we created groups, update element refs
    pickupDateEl = qs("#pickupDate");
    pickupTimeEl = qs("#pickupTime");
    pickupPersonEl = qs("#pickupPerson");
    deliveryDateEl = qs("#deliveryDate");
    extraEl = qs("#specialInsExtra");

    // Make sure the wrapper is inside step 5, and in the right spot (before the nav)
    if (!step5.contains(box)) {
      if (nav && nav.parentNode === step5) step5.insertBefore(box, nav);
      else step5.appendChild(box);
    } else {
      // If it's already in step 5 but after the nav, move it before the nav
      if (nav && box.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING) {
        // box is before nav already (good)
      } else if (nav && nav.parentNode === step5) {
        step5.insertBefore(box, nav);
      }
    }

    // Ensure the groups are children of the wrapper (this also "repairs" invalid markup cases)
    if (!box.contains(pickupGroup)) box.appendChild(pickupGroup);
    if (!box.contains(deliveryGroup)) box.appendChild(deliveryGroup);
    if (!box.contains(extraGroup)) box.appendChild(extraGroup);

    // Avoid double-binding on re-inits (rare, but can happen with partial renders)
    if (box.dataset.wlBound === "1") return;
    box.dataset.wlBound = "1";

    // Date bounds
    var today = new Date();
    var minPickup = fmtISO(today);
    var maxPickup = fmtISO(addDays(today, CONFIG.pickupMaxDaysOut));
    var minDelivery = fmtISO(addDays(today, CONFIG.deliveryMinLeadDays));

    if (pickupDateEl) {
      pickupDateEl.min = minPickup;
      pickupDateEl.max = maxPickup;
    }
    if (deliveryDateEl) {
      deliveryDateEl.min = minDelivery;
      deliveryDateEl.removeAttribute("max");
    }

    // Preload pickup time options (populated on date select)
    if (pickupTimeEl && pickupTimeEl.options.length === 0) {
      var ph = document.createElement("option");
      ph.value = "";
      ph.textContent = "Select a date first";
      pickupTimeEl.appendChild(ph);
      pickupTimeEl.disabled = true;
    }

    // If you already have a value in the hidden textarea (e.g., returning), try to reflect it in UI minimally
    // (We keep this lightweight; the hidden textarea is the source of truth.)
    syncSpecialInstructions();

    // Wire: pickup date -> populate time options + sync
    if (pickupDateEl && pickupTimeEl) {
      pickupDateEl.addEventListener("change", function () {
        pickupTimeEl.innerHTML = "";

        var dt = pickupDateEl.value ? new Date(pickupDateEl.value + "T00:00:00") : null;
        var isWeekend = dt ? (dt.getDay() === 0 || dt.getDay() === 6) : false;

        var opts = isWeekend ? CONFIG.pickupTimesWeekend : CONFIG.pickupTimesWeekday;

        if (!dt) {
          var p0 = document.createElement("option");
          p0.value = "";
          p0.textContent = "Select a date first";
          pickupTimeEl.appendChild(p0);
          pickupTimeEl.disabled = true;
        } else {
          var p1 = document.createElement("option");
          p1.value = "";
          p1.textContent = "Select a time";
          pickupTimeEl.appendChild(p1);

          opts.forEach(function (t) {
            var o = document.createElement("option");
            o.value = t;
            o.textContent = t;
            pickupTimeEl.appendChild(o);
          });
          pickupTimeEl.disabled = false;
        }

        syncSpecialInstructions();
      });

      pickupTimeEl.addEventListener("change", syncSpecialInstructions);
    }

    if (pickupPersonEl) pickupPersonEl.addEventListener("input", syncSpecialInstructions);
    if (deliveryDateEl) deliveryDateEl.addEventListener("change", syncSpecialInstructions);

    qsa('input[name="deliveryTime"]').forEach(function (r) {
      r.addEventListener("change", syncSpecialInstructions);
    });

    if (extraEl) extraEl.addEventListener("input", syncSpecialInstructions);

    // Sync on submit + clear hash
    var cont = getContinueBtn();
    if (cont) {
      cont.addEventListener(
        "click",
        function () {
          syncSpecialInstructions();
          setHash({ wlstep: null, wlship: null, wlts: null });
        },
        true
      );
    }

    // Initial population of pickup times if a date is already selected
    if (pickupDateEl && pickupDateEl.value) {
      try { pickupDateEl.dispatchEvent(new Event("change", { bubbles: true })); } catch (e) {}
    }
  }

  // ---------------------------
  // Global listeners for postbacks
  // ---------------------------
  function attachPostbackPersistence() {
    // Capture any click that triggers a postback and remember our current step
    document.addEventListener("click", function (e) {
      var el = e.target;
      if (!el) return;
      var t = el.closest("a,button,input");
      if (!t) return;
      if (!qs("#wlCheckoutWizard")) return;
      if (!isPostBackTrigger(t)) return;

      setHash({ wlstep: String(STATE.step), wlship: STATE.shipChosen, wlts: String(Date.now()) });
    }, true);

    // Capture changes on inputs that trigger inline postback (ZIP fields, branch ddl, etc.)
    document.addEventListener("change", function (e) {
      var el = e.target;
      if (!el || !qs("#wlCheckoutWizard")) return;

      var onch = (el.getAttribute && el.getAttribute("onchange")) || "";
      if (/__doPostBack\(/i.test(onch) || /WebForm_DoPostBackWithOptions/i.test(onch)) {
        setHash({ wlstep: String(STATE.step), wlship: STATE.shipChosen, wlts: String(Date.now()) });
      }
    }, true);
  }

  // ---------------------------
  // Navigation wiring
  // ---------------------------
  function attachNavHandlers() {
    var wizard = qs("#wlCheckoutWizard");
    if (!wizard) return;

    wizard.addEventListener("click", function (e) {
      var btn = e.target.closest("button.wl-next, button.wl-back");
      if (!btn) return;

      var isNext = btn.classList.contains("wl-next");
      var current = STATE.step;

      if (isNext) {
        if (!validateStep(current)) return;
        var n = nextStepFrom(current);
        gotoStep(n);
      } else {
        var p = prevStepFrom(current);
        gotoStep(p);
      }
    });

    // Step pill clicks: allow going back to completed steps; don't allow skipping ahead
    qsa("#wlCheckoutWizard .checkout-steps li").forEach(function (li) {
      li.addEventListener("click", function () {
        var s = parseInt(li.getAttribute("data-step"), 10);
        if (!isFinite(s)) return;
        if (s === 2 && !branchStepVisible()) return;

        // only allow back navigation or current
        var vis = computeVisibleSteps();
        if (vis.indexOf(s) >= 0 && vis.indexOf(s) <= vis.indexOf(STATE.step)) {
          gotoStep(s);
        }
      });
    });
  }

  // ---------------------------
  // Init
  // ---------------------------
  function init() {
    injectStyles();
    createWizardShell();

    if (!moveSectionsIntoWizard()) return;

    // Add nav controls
    addNav(1, false);
    addNav(2, false);
    addNav(3, false);
    addNav(4, false);
    addNav(5, true);

    hideOriginalSubmitPanels();
    attachPostbackPersistence();

    // Enhance UI
    enhanceShippingUI();
    enhanceDeliverySummary();
    enhanceInvoiceSummary();
    enhanceInstructionsExtras();
    attachNavHandlers();

    // Determine initial step: only honor hash if fresh
    var initialStep = 1;
    if (isHashFresh(CONFIG.hashTTLMinutes)) {
      var hs = getHashInt("wlstep", 1);
      initialStep = normalizeStep(hs);
    }

    // Determine ship selection:
    // - Prefer the current native WebForms radio state (server truth).
    // - Fall back to hash only if native state isn't available.
    var nativeShip = readNativeShipValue();
    var initialShip = "";
    if (isHashFresh(CONFIG.hashTTLMinutes)) {
      var hship = getHashStr("wlship", "");
      if (hship === "rbDelivered" || hship === "rbCollectLater") initialShip = hship;
    }
    if (nativeShip === "rbDelivered" || nativeShip === "rbCollectLater") initialShip = nativeShip;
    if (!initialShip && !CONFIG.requireExplicitShipChoice) initialShip = nativeShip;

    setShipChosen(initialShip, { syncNative: false });

    // Start
    gotoStep(initialStep, { silent: true });
    log("Initialized. step", initialStep, "ship", STATE.shipChosen, "branch visible", branchStepVisible());
  }

  // Run after DOM is ready (WebTrack sometimes loads scripts late)
  function ready(fn) {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      setTimeout(fn, 0);
    } else {
      document.addEventListener("DOMContentLoaded", fn);
    }
  }

  ready(init);

})();



(function () {
  const LOG_PREFIX = "[WL CheckoutWizard]";

  function log(...args) {
    console.log(LOG_PREFIX, ...args);
  }

  function findInvoiceColumn() {
    // Most reliable anchor: any InvoiceAddress field that should exist
    const invoiceField =
      document.getElementById("ctl00_PageBody_InvoiceAddress_AddressLine1") ||
      document.querySelector('[id*="InvoiceAddress_AddressLine1"]') ||
      document.querySelector('[id*="InvoiceAddress_"]');

    if (!invoiceField) return null;

    // In your HTML, the whole invoice UI is inside a .epi-form-col-single-checkout
    const col = invoiceField.closest(".epi-form-col-single-checkout");
    return col || null;
  }

  function widenToFullWidth(el) {
    if (!el) return;
    el.style.flex = "0 0 100%";
    el.style.maxWidth = "100%";
    el.style.width = "100%";
  }

  function ensureStep4HasInvoice() {
    const wizard = document.getElementById("wlCheckoutWizard");
    if (!wizard) return false;

    const step4 = wizard.querySelector('.checkout-step[data-step="4"]');
    if (!step4) return false;

    const invoiceBlock = document.getElementById("wlInvoiceFormBlock") || step4.querySelector("#wlInvoiceFormBlock");
    if (!invoiceBlock) return false;

    // If invoice inputs already exist in step 4, we’re done
    if (invoiceBlock.querySelector('[id*="InvoiceAddress_"]')) return true;

    const invoiceCol = findInvoiceColumn();
    if (!invoiceCol) return false;

    // If we already moved it once, don’t keep doing it
    if (invoiceCol.dataset.wlInvoiceMoved === "1") {
      // But if step 4 got rebuilt, re-append it
      invoiceBlock.appendChild(invoiceCol);
      return true;
    }

    invoiceCol.dataset.wlInvoiceMoved = "1";

    // Ensure a row wrapper in step 4 (keeps your layout consistent)
    let row = invoiceBlock.querySelector(".row");
    if (!row) {
      row = document.createElement("div");
      row.className = "row";
      row.setAttribute("data-wl-moved", "1");
      invoiceBlock.appendChild(row);
    }

    // MOVE (not clone) the invoice column from step 3 into step 4
    row.appendChild(invoiceCol);

    // Make invoice col full width
    widenToFullWidth(invoiceCol);

    // After moving invoice out of step 3, widen the delivery column too
    const step3 = wizard.querySelector('.checkout-step[data-step="3"]');
    if (step3) {
      const deliveryCol = step3.querySelector(".epi-form-col-single-checkout");
      widenToFullWidth(deliveryCol);
    }

    log("Moved Invoice/Billing column into Step 4 (#wlInvoiceFormBlock).");
    return true;
  }

  function initMoveWithRetry() {
    let tries = 0;
    const maxTries = 60; // 60 * 250ms = 15s

    const t = setInterval(() => {
      tries++;

      const ok = ensureStep4HasInvoice();
      if (ok) {
        clearInterval(t);
        return;
      }

      if (tries >= maxTries) {
        clearInterval(t);
        log("Could not find Invoice column to move. (Invoice fields not detected)");
      }
    }, 250);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMoveWithRetry);
  } else {
    initMoveWithRetry();
  }
})();
