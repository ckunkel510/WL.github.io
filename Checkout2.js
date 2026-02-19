// ─────────────────────────────────────────────────────────────────────────────
// Woodson WebTrack Checkout Wizard (Modern Flow Rebuild + Fixes)
// Fixes:
//  1) Same-day pickup times must be >= 2 hours out
//  2) Billing "same as delivery" persistence: if invoice fields blank after reload,
//     auto-trigger CopyDeliveryAddress postback ONCE per session and return to Step 5
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  
  // ---------------------------------------------------------------------------
  // HOTFIX: Some builds referenced getDeliveredSelected()/getPickupSelected()
  // but didn't define them, which breaks the wizard and greys out steps.
  // Keep these tiny and WebForms-safe.
  // ---------------------------------------------------------------------------
  function getDeliveredSelected() {
    const el = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbDelivered");
    if (el && el.checked) return true;
    // Fallback: modern selector buttons (no radio checked yet)
    try {
      const btn = document.querySelector(`.modern-shipping-selector button[data-value="rbDelivered"].is-selected, .modern-shipping-selector button[data-value="rbDelivered"].selected, .modern-shipping-selector button[data-value="rbDelivered"].active`);
      if (btn) return true;
    } catch {}
    return false;
  }
  function getPickupSelected() {
    const el = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbCollectLater");
    if (el && el.checked) return true;
    // Fallback: modern selector buttons (no radio checked yet)
    try {
      const btn = document.querySelector(`.modern-shipping-selector button[data-value="rbCollectLater"].is-selected, .modern-shipping-selector button[data-value="rbCollectLater"].selected, .modern-shipping-selector button[data-value="rbCollectLater"].active`);
      if (btn) return true;
    } catch {}
    return false;
  }
  function getSaleType() {
    return getPickupSelected() ? 'pickup' : (getDeliveredSelected() ? 'delivered' : '');
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
  document.addEventListener("DOMContentLoaded", function () {
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

    if (document.querySelector(".checkout-wizard")) return;

    const wizard = document.createElement("div");
    wizard.className = "checkout-wizard";
    container.insertBefore(wizard, container.firstChild);

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
        title: "Ship/Pickup",
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
        title: "Delivery Address",
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
        title: "Date & Instructions",
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
      if (field.tagName === "SELECT" && field.selectedIndex <= 0) {
        const opt0 = field.options && field.options[0] ? norm(field.options[0].value) : "";
        if (!opt0 || opt0 === "0") return false;
      }
      return true;
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
      if (pane) pane.style.display = isVisible ? "" : "none";
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

      // Step 2 Branch: show for Pickup, hide for Delivered.
      setStepVisibility(2, !!pickup);

      if (!pickup && delivered) {
        // Ensure branch has a default value so WebTrack doesn't complain later.
        autoSelectDefaultBranch();
      }

      // Step 3 Delivery Address: hide + skip in pickup mode
      setStepVisibility(3, !pickup);
      setDeliverySectionVisibility(!pickup);

      // Phone requirement: surface delivery phone inside billing when pickup
      mountPickupPhoneInBilling(!!pickup);

      // If pickup, keep Delivery inputs populated from Billing to satisfy required server fields.
      if (pickup) syncBillingToDelivery();
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

    function validateZip(zip) {
      const z = norm(zip).replace(/\s/g, "");
      return /^\d{5}(-\d{4})?$/.test(z);
    }
    function validatePhone(phone) {
      const p = norm(phone).replace(/[^\d]/g, "");
      return p.length >= 10;
    }
    function validateEmail(email) {
      const e = norm(email).replace(/^\([^)]*\)\s*/, "");
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    }

    function validateAddressBlock(prefix, stepNum, requireEmail) {
      // prefix: "DeliveryAddress" or "InvoiceAddress"
      const line1 = document.getElementById(`ctl00_PageBody_${prefix}_AddressLine1`);
      const city  = document.getElementById(`ctl00_PageBody_${prefix}_City`);
      const zip   = document.getElementById(`ctl00_PageBody_${prefix}_Postcode`);
      const state = document.getElementById(`ctl00_PageBody_${prefix}_CountySelector_CountyList`);
      const country = document.getElementById(`ctl00_PageBody_${prefix}_CountrySelector${prefix==="InvoiceAddress" ? "1" : ""}`);
      const phone = document.getElementById(`ctl00_PageBody_${prefix}_ContactTelephoneTextBox`);
      const email = prefix==="InvoiceAddress" ? document.getElementById("ctl00_PageBody_InvoiceAddress_EmailAddressTextBox") : null;

      // Some WebTrack builds don’t have a Billing/Invoice phone field.
      // In those cases, we validate (and later submit) the Delivery phone field instead.
      const phoneFallback = (!phone && prefix==="InvoiceAddress") ? document.getElementById("ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox") : null;

      const missing = [];
      if (!norm(line1 && line1.value)) missing.push("Street address");
      if (!norm(city && city.value)) missing.push("City");
      if (!(state && norm(state.value))) missing.push("State");
      if (!validateZip(zip && zip.value)) missing.push("ZIP");
      const phoneVal = (phone && phone.value) ? phone.value : (phoneFallback && phoneFallback.value) ? phoneFallback.value : "";
      if (!validatePhone(phoneVal)) missing.push("Phone");
      if (requireEmail && !validateEmail(email && email.value)) missing.push("Email");

      if (country && !norm(country.value)) {
        // default to USA without triggering postbacks
        try { country.value = "USA"; } catch {}
      }

      if (missing.length) {
        showInlineError(stepNum,
          `<strong>We just need a bit more info.</strong><br>` +
          `Please enter: <em>${missing.join(", ")}</em>.`
        );
        return false;
      }

      clearInlineError(stepNum);
      return true;
    }

    function syncBillingToDelivery() {
      // Copy invoice/billing fields into delivery fields (no postback).
      // This keeps pickup checkout "shoppable" by only asking for billing.
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
        if (from && to) setIf(to, from.value);
      });

      // Country selectors differ between delivery/invoice
      const invCountry = document.getElementById("ctl00_PageBody_InvoiceAddress_CountrySelector1");
      const delCountry = document.getElementById("ctl00_PageBody_DeliveryAddress_CountrySelector");
      if (invCountry && delCountry) setIf(delCountry, invCountry.value || "USA");
      if (delCountry && !norm(delCountry.value)) delCountry.value = "USA";

      // State dropdown by visible text
      const invState = document.getElementById("ctl00_PageBody_InvoiceAddress_CountySelector_CountyList");
      const delState = document.getElementById("ctl00_PageBody_DeliveryAddress_CountySelector_CountyList");
      if (invState && delState) {
        const invText = invState.selectedOptions && invState.selectedOptions[0] ? invState.selectedOptions[0].text : "";
        if (invText) selectByText(delState, invText);
      }
    }

    



    window.WLCheckout = window.WLCheckout || {};
    window.WLCheckout.updatePickupModeUI = updatePickupModeUI;
    window.WLCheckout.syncBillingToDelivery = syncBillingToDelivery;
// -------------------------------------------------------------------------
    // D) Create step panes + nav buttons
    // -------------------------------------------------------------------------
    steps.forEach(function (step, i) {
      const num = i + 1;

      const li = document.createElement("li");
      li.dataset.step = String(num);
      li.textContent = step.title;
      li.addEventListener("click", () => showStep(num));
      nav.appendChild(li);

      const pane = document.createElement("div");
      pane.className = "checkout-step";
      pane.dataset.step = String(num);
      wizard.appendChild(pane);

      step.findEls()
        .filter(isEl)
        .forEach((el) => pane.appendChild(el));

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
        const conts = Array.from(
          document.querySelectorAll(
            "#ctl00_PageBody_ContinueButton1,#ctl00_PageBody_ContinueButton2"
          )
        );
        if (conts.length) {
          const cont = conts.pop();
          cont.style.display = "";
          cont.type = "submit";
          navDiv.appendChild(cont);
        }
      }
    });

    
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
// If a ship/pickup selection triggered a postback, advance to the next logical step.
try {
  const ps = sessionStorage.getItem("wl_pendingStep");
  if (ps) {
    sessionStorage.removeItem("wl_pendingStep");
    const n = parseInt(ps, 10);
    if (Number.isFinite(n)) showStep(n);
  }
} catch {}

          try { updatePickupModeUI(); } catch {}
    // If a full postback happened (not UpdatePanel), consume pending step here as well.
    try {
      const ps = sessionStorage.getItem("wl_pendingStep");
      if (ps) {
        sessionStorage.removeItem("wl_pendingStep");
        const n = parseInt(ps, 10);
        if (Number.isFinite(n)) showStep(n);
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
        });
      } catch {}
    }

    // Hook immediately (safe even if Sys isn't present)
    hookAspNetAjax();
    // Also run once in case something disabled buttons during initial render
    reEnableWizardNav();

    // Consume any pending step after a FULL postback (UpdatePanel hooks won't fire).
    try {
      const ps = sessionStorage.getItem("wl_pendingStep");
      if (ps) {
        sessionStorage.removeItem("wl_pendingStep");
        const n = parseInt(ps, 10);
        if (Number.isFinite(n)) showStep(n);
      } else {
        // If WebForms restored an unexpected step, clamp to the first required step
        // so the user sees the right flow:
        //  - Pickup: Step 2 (Branch) -> Step 4 (Billing) -> Step 5 (Date & Instructions)
        //  - Delivery: Step 3 (Delivery Address) -> Step 4 -> Step 5
        const a = (typeof getActiveStep === "function") ? getActiveStep() : 1;
        if (getPickupSelected() && a >= 4) showStep(2);
        if (getDeliveredSelected() && !getPickupSelected() && a === 2) showStep(3);
      }
    } catch {}


    // -------------------------------------------------------------------------
    // E) Step switching + persistence
    // -------------------------------------------------------------------------
    function showStep(n) {
      // If Pickup is selected, skip Delivery Address (Step 3)
      if (getPickupSelected() && n === 3) n = 4;
      // If Delivered/Shipping is selected, hide Branch (Step 2)
      if (getDeliveredSelected() && !getPickupSelected() && n === 2) n = 3;
      // Ensure Step 5 (Date & Instructions) is actually loaded/rendered.
      if (n === 5) {
        try {
          if (window.WLCheckout && typeof window.WLCheckout.buildDateStepUI === "function") {
            window.WLCheckout.buildDateStepUI();
          }
        } catch {}
        // If WebTrack hasn't created the server controls yet, click the native tab once.
        try {
          if (!document.getElementById("ctl00_PageBody_SpecialInstructionsTextBox")) {
            window.WLCheckout && typeof window.WLCheckout.ensureNativeDateTabLoaded === "function" && window.WLCheckout.ensureNativeDateTabLoaded();
          }
        } catch {}
        try {
          window.WLCheckout && typeof window.WLCheckout.refreshDateUI === "function" && window.WLCheckout.refreshDateUI();
        } catch {}
      }

      wizard
        .querySelectorAll(".checkout-step")
        .forEach((p) => p.classList.toggle("active", +p.dataset.step === n));

      nav.querySelectorAll("li").forEach((li) => {
        const s = +li.dataset.step;
        li.classList.toggle("active", s === n);
        li.classList.toggle("completed", s < n);
      });

      setStep(n);
      try {
        window.scrollTo({ top: wizard.offsetTop, behavior: "smooth" });
      } catch {}
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
    const cur = (typeof getActiveStep === "function") ? getActiveStep() : 1;
    if (typeof validateStep === "function" && !validateStep(cur)) return;
    if (typeof goNextFrom === "function") { goNextFrom(cur); return; }
    const to = parseInt(btn.dataset.wlNext, 10);
    if (Number.isFinite(to)) showStep(to);
    return;
  }

  if (btn.dataset && btn.dataset.wlBack) {
    ev.preventDefault();
    const cur = (typeof getActiveStep === "function") ? getActiveStep() : 1;
    const to = parseInt(btn.dataset.wlBack, 10);
    // Prefer explicit back target if present, otherwise just go back one step.
    if (Number.isFinite(to)) { showStep(to); return; }
    showStep(Math.max(1, cur - 1));
    return;
  }
}, true);




    // -------------------------------------------------------------------------
    // E.5) Wizard navigation intercept: validate + skip Step 5 in Pickup mode
    // -------------------------------------------------------------------------
    function getActiveStep() {
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
        if (!(rbPick && rbPick.checked) && !(rbDel && rbDel.checked)) {
          // If using the modern button selector, infer selection from the active button
          try {
            const btnDel = document.querySelector('.modern-shipping-selector button[data-value="rbDelivered"].is-selected, .modern-shipping-selector button[data-value="rbDelivered"].selected, .modern-shipping-selector button[data-value="rbDelivered"].active');
            const btnPick = document.querySelector('.modern-shipping-selector button[data-value="rbCollectLater"].is-selected, .modern-shipping-selector button[data-value="rbCollectLater"].selected, .modern-shipping-selector button[data-value="rbCollectLater"].active');
            if (btnDel && rbDel) { rbDel.checked = true; }
            if (btnPick && rbPick) { rbPick.checked = true; }
          } catch {}

          if (!(rbPick && rbPick.checked) && !(rbDel && rbDel.checked)) {
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
          clearInlineError(3);
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

        if (getPickupSelected()) {
          syncBillingToDelivery();
          // Also, if Delivery Address step is hidden (pickup), make sure required server fields are not blank.
          clearInlineError(2);
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
    // G) Delivery summary/edit (Step 5)
    // -------------------------------------------------------------------------
    (function () {
      const pane4 = wizard.querySelector('.checkout-step[data-step="3"]');
      if (!pane4) return;

      const col = pane4.querySelector(".epi-form-col-single-checkout");
      if (!col) return;

      const wrap = document.createElement("div");
      const sum = document.createElement("div");
      wrap.className = "delivery-inputs";
      sum.className = "delivery-summary";

      while (col.firstChild) wrap.appendChild(col.firstChild);
      col.appendChild(wrap);

      function safeVal(sel) {
        const el = wrap.querySelector(sel);
        return el ? el.value || "" : "";
      }
      function safeTextSelected(sel) {
        const el = wrap.querySelector(sel);
        if (!el || !el.selectedOptions || !el.selectedOptions[0]) return "";
        return el.selectedOptions[0].text || "";
      }

      function upd() {
        const a1 = safeVal("#ctl00_PageBody_DeliveryAddress_AddressLine1").trim();
        const a2 = safeVal("#ctl00_PageBody_DeliveryAddress_AddressLine2").trim();
        const c = safeVal("#ctl00_PageBody_DeliveryAddress_City").trim();
        const s = safeTextSelected("#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList").trim();
        const z = safeVal("#ctl00_PageBody_DeliveryAddress_Postcode").trim();

        sum.innerHTML = `<strong>Delivery Address</strong><br>
          ${a1}${a2 ? "<br>" + a2 : ""}<br>
          ${c}${c && (s || z) ? ", " : ""}${s} ${z}<br>
          <button type="button" id="editDelivery" class="btn btn-link">Edit</button>`;
      }

      col.insertBefore(sum, wrap);

      // Expose for other modules (prefill, pickup sync)
      try { window.WLCheckout = window.WLCheckout || {}; window.WLCheckout.refreshDeliverySummary = upd;
      try { window.WLCheckout.showDeliverySummaryIfFilled = function(){
        try {
          const hasAny = safeVal("#ctl00_PageBody_DeliveryAddress_AddressLine1").trim() ||
                         safeVal("#ctl00_PageBody_DeliveryAddress_City").trim() ||
                         safeVal("#ctl00_PageBody_DeliveryAddress_Postcode").trim();
          if (hasAny) { upd(); wrap.style.display = "none"; sum.style.display = ""; }
        } catch {}
      }; } catch {}
 } catch {}

      // If delivery already has data, show summary; otherwise keep inputs visible
      const hasAny = safeVal("#ctl00_PageBody_DeliveryAddress_AddressLine1").trim() ||
                     safeVal("#ctl00_PageBody_DeliveryAddress_City").trim() ||
                     safeVal("#ctl00_PageBody_DeliveryAddress_Postcode").trim();
      if (hasAny) {
        upd();
        wrap.style.display = "none";
        sum.style.display = "";
      } else {
        wrap.style.display = "";
        sum.style.display = "none";
      }

      sum.addEventListener("click", (e) => {
        if (e.target.id !== "editDelivery") return;
        e.preventDefault();
        sum.style.display = "none";
        wrap.style.display = "";
        try { wrap.scrollIntoView({ behavior: "smooth" }); } catch {}

        if (!wrap.querySelector("#saveDelivery")) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.id = "saveDelivery";
          btn.className = "btn btn-primary mt-2";
          btn.textContent = "Save";
          wrap.appendChild(btn);

          btn.addEventListener("click", () => {
            upd();
            try {
              const same = document.getElementById('sameAsDeliveryCheck');
              if (same && same.checked && window.WLCheckout && typeof window.WLCheckout.refreshInvoiceSummary === 'function') {
                window.WLCheckout.refreshInvoiceSummary(true);
              }
            } catch {}
            wrap.style.display = "none";
            sum.style.display = "";
            setStep(4);
          });
        }
      });

      upd();
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
      sumInv.className = "invoice-summary";

      while (colInv.firstChild) wrapInv.appendChild(colInv.firstChild);
      colInv.appendChild(wrapInv);

      const q = (sel) => wrapInv.querySelector(sel);

      function copyDeliveryToInvoice(force) {
        try {
          const pairs = [
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
        const a1 = (q("#ctl00_PageBody_InvoiceAddress_AddressLine1")?.value || "").trim();
        const a2 = (q("#ctl00_PageBody_InvoiceAddress_AddressLine2")?.value || "").trim();
        const c = (q("#ctl00_PageBody_InvoiceAddress_City")?.value || "").trim();
        const st =
          q("#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList")?.selectedOptions?.[0]?.text || "";
        const z = (q("#ctl00_PageBody_InvoiceAddress_Postcode")?.value || "").trim();
        const e = (q("#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox")?.value || "").trim();

        sumInv.innerHTML = `<strong>Billing Address</strong><br>
          ${a1}${a2 ? "<br>" + a2 : ""}<br>
          ${c}${c && (st || z) ? ", " : ""}${st} ${z}<br>
          Email: ${e}<br>
          <button type="button" id="editInvoice" class="btn btn-link">Enter new billing address</button>`;
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
        setReturnStep(5);
        try {
          __doPostBack("ctl00$PageBody$CopyDeliveryAddressLinkButton", "");
          return; // page will reload; stop further UI work this pass
        } catch {}
      }

      // Normal display
      if (sameStored) {
        copyDeliveryToInvoice(true);
        refreshInv();
        wrapInv.style.display = "none";
        sumInv.style.display = "";
      } else {
        wrapInv.style.display = "";
        sumInv.style.display = "none";
      }

      sameCheck.addEventListener("change", function () {
        if (this.checked) {
          setReturnStep(5);
          setSameAsDelivery(true);
          markAutoCopyDone(); // user-initiated copy: treat as done

          // Client-side copy immediately so the customer sees it without needing to uncheck/recheck
          copyDeliveryToInvoice(true);

          refreshInv();
          wrapInv.style.display = "none";
          sumInv.style.display = "";

          // If your WebTrack installation requires server-side copy logic, we can re-enable this postback.
          // try { __doPostBack("ctl00$PageBody$CopyDeliveryAddressLinkButton", ""); } catch {}
        } else {
          setSameAsDelivery(false);
          sumInv.style.display = "none";
          wrapInv.style.display = "";
        }
      });

      sumInv.addEventListener("click", (e) => {
        if (e.target.id !== "editInvoice") return;
        e.preventDefault();
        sumInv.style.display = "none";
        wrapInv.style.display = "";
        try { wrapInv.scrollIntoView({ behavior: "smooth" }); } catch {}
      });

      try {
        window.WLCheckout = window.WLCheckout || {};
        window.WLCheckout.refreshInvoiceSummary = function(forceCopy){
          if (forceCopy) copyDeliveryToInvoice(true);
          refreshInv();
        };
      } catch {}

      refreshInv();
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
      });

      $.get("https://webtrack.woodsonlumber.com/AccountInfo_R.aspx", (data) => {
        const tel = $(data).find("#ctl00_PageBody_TelephoneLink_TelephoneLink").text().trim();
        if (tel) $("#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox").val(tel);
      });
    }

    // -------------------------------------------------------------------------
    // K) Step 7: pickup/delivery + special instructions
    // Fix: Same-day pickup times must be >= 2 hours out (rounded up to next hour)
    // NOTE: WebTrack sometimes lazy-loads this section only after the native
    //       "Date & Instructions" tab is clicked. We make this module re-runnable
    //       and also auto-click that native tab if needed.
    // -------------------------------------------------------------------------
    function buildDateStepUI() {
      try {
        const p6 = wizard.querySelector('.checkout-step[data-step="5"]');
        if (!p6) return;

        // Already built? Just refresh visibility/state.
        if (document.getElementById("pickupDate") || document.getElementById("deliveryDate")) {
          try { window.WLCheckout && typeof window.WLCheckout.refreshDateUI === "function" && window.WLCheckout.refreshDateUI(); } catch {}
          return;
        }

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

        if (!siWrap) return;

        // Hide legacy textbox (we still populate it for server submission)
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

        // Insert AFTER the Special Instructions field wrapper (inside our Step 5 pane)
        siWrap.insertAdjacentElement("afterend", pickupDiv);
        pickupDiv.insertAdjacentElement("afterend", deliveryDiv);

        const extraDiv = document.createElement("div");
        extraDiv.className = "form-group";
        extraDiv.innerHTML = `
          <label for="specialInsExtra">Additional instructions:</label>
          <textarea id="specialInsExtra" class="form-control" placeholder="Optional additional notes"></textarea>`;
        deliveryDiv.insertAdjacentElement("afterend", extraDiv);

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

        // If selected pickup date is today, minimum start time is now + 120 minutes,
        // rounded up to next hour
        function getSameDayMinStartMins() {
          const now = new Date();
          const mins = minutesFromMidnight(now) + 120; // +2h
          return Math.ceil(mins / 60) * 60;
        }

        function populatePickupTimes(date) {
          const day = date.getDay();
          let openMins = 7 * 60 + 30;
          let closeMins;

          if (1 <= day && day <= 5) closeMins = 17 * 60 + 30;
          else if (day === 6) closeMins = 16 * 60;
          else closeMins = openMins + 60; // Sunday: basically none

          const isSameDay =
            date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate();

          let minStart = openMins;
          if (isSameDay) minStart = Math.max(openMins, getSameDayMinStartMins());

          pickupTimeSel.innerHTML = "";
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
        const zipInput = document.getElementById("ctl00_PageBody_DeliveryAddress_Postcode");

        function inZone(z) {
          return ["75", "76", "77", "78", "79"].includes((z || "").substring(0, 2));
        }

        function updateSpecial() {
          let baseText = "";

          if (rbPick && rbPick.checked) {
            const d = pickupInput.value;
            const t = pickupTimeSel.disabled ? "" : pickupTimeSel.value;
            const p = pickupDiv.querySelector("#pickupPerson").value;

            specialIns.readOnly = false;
            baseText = "Pickup on " + d + (t ? " at " + t : "") + (p ? " for " + p : "");
          } else if (rbDel && rbDel.checked) {
            specialIns.readOnly = true;
            if (inZone(zipInput ? zipInput.value : "")) {
              const d2 = deliveryInput.value;
              const t2 = deliveryDiv.querySelector('input[name="deliveryTime"]:checked');
              baseText = "Delivery on " + d2 + (t2 ? " (" + t2.value + ")" : "");
            } else {
              baseText = "Ship via 3rd party delivery on next screen.";
            }
          }

          specialIns.value = baseText + (specialExtra.value ? " – " + specialExtra.value : "");
        }

        function onShip() {
          if (rbPick && rbPick.checked) {
            pickupDiv.style.display = "block";
            deliveryDiv.style.display = "none";
            if (pickupInput.value) populatePickupTimes(parseLocalDate(pickupInput.value));
          } else if (rbDel && rbDel.checked) {
            pickupDiv.style.display = "none";
            deliveryDiv.style.display = "block";
          } else {
            pickupDiv.style.display = "none";
            deliveryDiv.style.display = "none";
          }
          updateSpecial();
        }

        if (rbPick) rbPick.addEventListener("change", onShip);
        if (rbDel) rbDel.addEventListener("change", onShip);

        pickupDiv.querySelector("#pickupPerson").addEventListener("input", updateSpecial);
        pickupTimeSel.addEventListener("change", updateSpecial);

        deliveryDiv
          .querySelectorAll('input[name="deliveryTime"]')
          .forEach((r) => r.addEventListener("change", updateSpecial));
        specialExtra.addEventListener("input", updateSpecial);

        // Expose hooks so UpdatePanel partial postbacks can restore visibility/state.
        window.WLCheckout = window.WLCheckout || {};
        window.WLCheckout.refreshDateUI = function () {
          try { onShip(); } catch {}
        };

        onShip();

        // Client validation on Continue buttons
        if ($) {
          $("#ctl00_PageBody_ContinueButton1, #ctl00_PageBody_ContinueButton2").off("click.wlDate").on("click.wlDate", function (e) {
            try {
              if (getPickupSelected()) {
                if (!validateAddressBlock("InvoiceAddress", 4, true)) {
                  e.preventDefault();
                  showStep(4);
                  return;
                }
                syncBillingToDelivery();
              }
            } catch {}

            setReturnStep(steps.length);
            setExpectedNav(true);

            let valid = true;
            const errors = [];

            if ($("#deliveryDate").closest(".form-group").is(":visible")) {
              if (!$("#deliveryDate").val()) {
                valid = false;
                errors.push("• Please select a Requested Delivery Date.");
              }
              if (!$('input[name="deliveryTime"]:checked').length) {
                valid = false;
                errors.push("• Please choose a Delivery Time (Morning or Afternoon).");
              }
            }

            if ($("#pickupDate").closest(".form-group").is(":visible")) {
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
              showStep(5);
              setExpectedNav(false);
              return;
            }

            setTimeout(function () {
              window.WLCheckout?.detectAndJumpToValidation?.();
            }, 900);
          });
        }
      } catch {}
    }

    // If the native WebTrack tab hasn't been activated yet, Step 5 controls may not exist.
    function ensureNativeDateTabLoaded() {
      try {
        if (document.getElementById("ctl00_PageBody_SpecialInstructionsTextBox")) return true;
        if (sessionStorage.getItem("wl_native_step5_clicked") === "1") return false;

        const needle = ["date", "instruction"];
        const nodes = Array.from(document.querySelectorAll("a,button,li,span,div"))
          .filter((el) => {
            const t = (el.textContent || "").trim().toLowerCase();
            return t && needle.every((w) => t.includes(w));
          });

        const hit =
          nodes.find((el) => el.tagName === "A" || el.tagName === "BUTTON") ||
          nodes[0];

        if (hit) {
          sessionStorage.setItem("wl_native_step5_clicked", "1");
          sessionStorage.setItem("wl_pendingStep", "5");
          try { setExpectedNav(true); } catch {}
          try { hit.click(); } catch {}
          return true;
        }
      } catch {}
      return false;
    }

    window.WLCheckout = window.WLCheckout || {};
    window.WLCheckout.buildDateStepUI = buildDateStepUI;
    window.WLCheckout.ensureNativeDateTabLoaded = ensureNativeDateTabLoaded;

    // Build once on initial load
    buildDateStepUI();

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

          const shipHTML = `
            <div class="modern-shipping-selector d-flex justify-content-around">
              <button type="button" id="btnDelivered" class="btn btn-primary" data-value="rbDelivered">
                <i class="fas fa-truck"></i> Delivered
              </button>
              <button type="button" id="btnPickup" class="btn btn-secondary" data-value="rbCollectLater">
                <i class="fas fa-store"></i> Pickup (Free)
              </button>
            </div>`;
          $(".epi-form-col-single-checkout:has(.SaleTypeSelector)").append(shipHTML);

          $("<style>.modern-shipping-selector .btn[disabled], .modern-shipping-selector .btn.disabled { pointer-events:auto; }</style>").appendTo(document.head);

                    function updateShippingStyles(val, opts) {
            opts = opts || {};
            const silent = !!opts.silent;

            const delRad = $("#ctl00_PageBody_SaleTypeSelector_rbDelivered");
            const pickRad = $("#ctl00_PageBody_SaleTypeSelector_rbCollectLater");
            const $btnDelivered = $("#btnDelivered");
            const $btnPickup = $("#btnPickup");

            // Ensure buttons are clickable
            $btnDelivered.css({ opacity: 1, pointerEvents: "auto" });
            $btnPickup.css({ opacity: 1, pointerEvents: "auto" });

            const isDelivered = val === "rbDelivered";

            // Visual styling
            if (isDelivered) {
              $btnDelivered.css({ background: "#6b0016", color: "#fff", border: "none" });
              $btnPickup.css({ background: "#f5f5f5", color: "#000", border: "1px solid #ccc" });
              document.cookie = "pickupSelected=false;path=/";
            } else {
              $btnPickup.css({ background: "#6b0016", color: "#fff", border: "none" });
              $btnDelivered.css({ background: "#f5f5f5", color: "#000", border: "1px solid #ccc" });
              document.cookie = "pickupSelected=true;path=/";
            }

            // Keep underlying panels sane (does not trigger postback)
            try { ensureShippingPanelVisibility(isDelivered); } catch (e) {}

            // IMPORTANT: on initial load we only want Step 1 (selection) visible.
            // Only on user interaction do we select the WebTrack radio + advance.
            if (!silent) {
              const nextStep = isDelivered ? 3 : 2;

              // Let the postback-return logic know where to land if the page refreshes.
              try {
                sessionStorage.setItem("wl_pendingStep", String(nextStep));
                setExpectedNav();
              } catch (e) {}

              // Select the underlying WebTrack radio (may cause an UpdatePanel postback)
              try {
                if (isDelivered && delRad.length && !delRad.is(":checked")) {
                  delRad.prop("checked", true).trigger("click").trigger("change");
                } else if (!isDelivered && pickRad.length && !pickRad.is(":checked")) {
                  pickRad.prop("checked", true).trigger("click").trigger("change");
                }
              } catch (e) {}

              // Advance immediately so the user lands on the right step right away.
              try {
                showStep(nextStep);
                setStep(nextStep);
              } catch (e) {}
            }

            // Refresh pickup-mode UI (uses pickupSelected cookie)
            try {
              if (window.WLCheckout && typeof window.WLCheckout.updatePickupModeUI === "function") {
                window.WLCheckout.updatePickupModeUI();
              }
            } catch (e) {}
          }


          updateShippingStyles(
            $("#ctl00_PageBody_SaleTypeSelector_rbDelivered").is(":checked") ? "rbDelivered" : "rbCollectLater",
            { silent: true }
          );

          $(document).on("click", ".modern-shipping-selector button", function () {
            updateShippingStyles($(this).data("value"));
          });
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

    // Always start on Step 1 (Delivery / Pickup selection) when Checkout loads.
    // If this load is a postback return, the pending-step / validation logic below will jump as needed.
    const initial = 1;
    setStep(initial);
    showStep(initial);
    // Apply pickup-mode visibility immediately on load
    try { updatePickupModeUI(); } catch {}

    if (expectedNav) {
      const tryJump = () => window.WLCheckout?.detectAndJumpToValidation?.() === true;
      if (!tryJump()) {
        setTimeout(tryJump, 0);
        setTimeout(tryJump, 300);
        setTimeout(tryJump, 1200);
        setTimeout(() => {
          if (!tryJump()) showStep(returnStep || saved || 2);
        }, 1600);
      }
    }
  });
})();

