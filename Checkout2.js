// ─────────────────────────────────────────────────────────────────────────────
// Woodson WebTrack Checkout Wizard (Modern Flow + Pickup Address UX Fixes)
// Fixes added:
//  1) Pickup orders: hide Delivery Address step; still fill required delivery fields
//     behind the scenes (copy from Billing OR default address) so system is happy.
//  2) Billing "same as delivery" checked but data missing: server copy ONCE/session
//     + client fallback copy if invoice remains blank after reload.
//  3) Same-day pickup time slots must be >= 2 hours out.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  const STEP_KEY = "wl_currentStep";
  const SAME_KEY = "wl_sameAsDelivery";
  const TTL_MS = 10 * 60 * 1000; // 10 minutes

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

  function setStep(n) { setWithExpiry(STEP_KEY, String(n), TTL_MS); }
  function getStep() {
    const v = getWithExpiry(STEP_KEY);
    return v != null ? parseInt(v, 10) : null;
  }

  function setSameAsDelivery(val) {
    try { localStorage.setItem(SAME_KEY, val ? "true" : "false"); } catch {}
  }
  function getSameAsDelivery() {
    try { return localStorage.getItem(SAME_KEY) === "true"; } catch { return false; }
  }

  function setReturnStep(n) { try { sessionStorage.setItem("wl_returnStep", String(n)); } catch {} }
  function consumeReturnStep() {
    try {
      const v = sessionStorage.getItem("wl_returnStep");
      if (v) sessionStorage.removeItem("wl_returnStep");
      return v ? parseInt(v, 10) : null;
    } catch { return null; }
  }

  function setExpectedNav(flag) { try { sessionStorage.setItem("wl_expect_nav", flag ? "1" : "0"); } catch {} }
  function consumeExpectedNav() {
    try {
      const v = sessionStorage.getItem("wl_expect_nav") === "1";
      sessionStorage.removeItem("wl_expect_nav");
      return v;
    } catch { return false; }
  }

  // One-time per-session guard for server-side copy
  function markAutoCopyDone() { try { sessionStorage.setItem("wl_autocopy_done", "1"); } catch {} }
  function autoCopyAlreadyDone() { try { return sessionStorage.getItem("wl_autocopy_done") === "1"; } catch { return false; } }

  // Pickup delivery-fill guard
  function markPickupDeliveryFilled() { try { sessionStorage.setItem("wl_pickup_deliv_filled", "1"); } catch {} }
  function pickupDeliveryFilled() { try { return sessionStorage.getItem("wl_pickup_deliv_filled") === "1"; } catch { return false; } }

  window.WLCheckout = window.WLCheckout || {};
  window.WLCheckout.setStep = setStep;
  window.WLCheckout.getStep = getStep;
  window.WLCheckout.setReturnStep = setReturnStep;
  window.WLCheckout.TTL_MS = TTL_MS;

  // Helpers
  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.from(document.querySelectorAll(sel)); }
  function val(id) { const el = document.getElementById(id); return el ? (el.value || "") : ""; }
  function setVal(id, v) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = v;
  }
  function safeSelectedText(id) {
    const el = document.getElementById(id);
    if (!el || !el.selectedOptions || !el.selectedOptions[0]) return "";
    return el.selectedOptions[0].text || "";
  }
  function copyVal(srcId, dstId) {
    const v = val(srcId);
    if (v && v.trim()) setVal(dstId, v);
  }
  function isBlankAddress(prefix) {
    // prefix = "DeliveryAddress" or "InvoiceAddress"
    const line1 = val(`ctl00_PageBody_${prefix}_AddressLine1`).trim();
    const city  = val(`ctl00_PageBody_${prefix}_City`).trim();
    const zip   = val(`ctl00_PageBody_${prefix}_Postcode`).trim();
    return !line1 && !city && !zip;
  }

  // Fill Delivery Address from Invoice/Billing (client-side)
  function fillDeliveryFromInvoiceIfNeeded() {
    // Delivery fields required by system even on pickup (your note)
    if (!isBlankAddress("DeliveryAddress")) return;

    // Copy invoice -> delivery
    copyVal("ctl00_PageBody_InvoiceAddress_AddressLine1", "ctl00_PageBody_DeliveryAddress_AddressLine1");
    copyVal("ctl00_PageBody_InvoiceAddress_AddressLine2", "ctl00_PageBody_DeliveryAddress_AddressLine2");
    copyVal("ctl00_PageBody_InvoiceAddress_City",        "ctl00_PageBody_DeliveryAddress_City");
    copyVal("ctl00_PageBody_InvoiceAddress_Postcode",    "ctl00_PageBody_DeliveryAddress_Postcode");

    // Country defaults
    const delCountry = document.getElementById("ctl00_PageBody_DeliveryAddress_CountrySelector");
    if (delCountry && !delCountry.value) delCountry.value = "USA";

    // State/County: try to match by visible text
    const invStateSel = document.getElementById("ctl00_PageBody_InvoiceAddress_CountySelector_CountyList");
    const delStateSel = document.getElementById("ctl00_PageBody_DeliveryAddress_CountySelector_CountyList");
    if (invStateSel && delStateSel) {
      const invText = invStateSel.selectedOptions?.[0]?.text?.trim() || "";
      if (invText) {
        Array.from(delStateSel.options).some(opt => {
          if ((opt.text || "").trim().toLowerCase() === invText.toLowerCase()) {
            delStateSel.value = opt.value;
            return true;
          }
          return false;
        });
      }
    }
  }

  // Client-side copy Delivery -> Invoice as a fallback when same-as-delivery is checked but invoice blank
  function fillInvoiceFromDeliveryFallback() {
    if (!isBlankAddress("InvoiceAddress")) return;
    copyVal("ctl00_PageBody_DeliveryAddress_AddressLine1", "ctl00_PageBody_InvoiceAddress_AddressLine1");
    copyVal("ctl00_PageBody_DeliveryAddress_AddressLine2", "ctl00_PageBody_InvoiceAddress_AddressLine2");
    copyVal("ctl00_PageBody_DeliveryAddress_City",        "ctl00_PageBody_InvoiceAddress_City");
    copyVal("ctl00_PageBody_DeliveryAddress_Postcode",    "ctl00_PageBody_InvoiceAddress_Postcode");

    const invCountry = document.getElementById("ctl00_PageBody_InvoiceAddress_CountrySelector1");
    if (invCountry && !invCountry.value) invCountry.value = "USA";

    const delStateSel = document.getElementById("ctl00_PageBody_DeliveryAddress_CountySelector_CountyList");
    const invStateSel = document.getElementById("ctl00_PageBody_InvoiceAddress_CountySelector_CountyList");
    if (delStateSel && invStateSel) {
      const delText = delStateSel.selectedOptions?.[0]?.text?.trim() || "";
      if (delText) {
        Array.from(invStateSel.options).some(opt => {
          if ((opt.text || "").trim().toLowerCase() === delText.toLowerCase()) {
            invStateSel.value = opt.value;
            return true;
          }
          return false;
        });
      }
    }
  }

  function isPickupSelected() {
    const rbPick = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbCollectLater");
    return !!(rbPick && rbPick.checked);
  }
  function isDeliveredSelected() {
    const rbDel = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbDelivered");
    return !!(rbDel && rbDel.checked);
  }

  // Hide/Show Step 5 (Delivery step) depending on pickup/delivered
  function setDeliveryStepVisibility(wizardEl, show) {
    const li = wizardEl.querySelector('ul.checkout-steps li[data-step="5"]');
    const pane = wizardEl.querySelector('.checkout-step[data-step="5"]');
    if (li) li.style.display = show ? "" : "none";
    if (pane) pane.style.display = show ? "" : "none";
  }

  // If pickup, ensure Delivery fields are filled (hidden) before continuing.
  function ensureSystemDeliveryForPickup() {
    if (!isPickupSelected()) return;

    // If billing exists, copy billing -> delivery
    fillDeliveryFromInvoiceIfNeeded();

    // If still blank, leave it for your existing prefill/default selector
    // but we at least try once here.
    markPickupDeliveryFilled();
  }

  // ---------------------------------------------------------------------------
  // MAIN
  // ---------------------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", function () {
    const jq = window.jQuery;

    // Hide legacy bits
    try {
      const dateWrap = document.getElementById("ctl00_PageBody_dtRequired_DatePicker_wrapper");
      if (dateWrap) dateWrap.style.display = "none";
      if (jq) {
        jq(".submit-button-panel").hide();
        jq("label").filter(function () { return jq(this).text().trim() === "Date required:"; }).hide();
        jq("div.form-control").hide();
        jq("#ctl00_PageBody_dtRequired_DatePicker_wrapper").hide();
        jq("#ctl00_PageBody_dtRequired_DatePicker_wrapper")
          .closest(".epi-form-col-single-checkout.epi-form-group-checkout")
          .hide();
        jq("#ctl00_PageBody_BackToCartButton2").val("Back to Cart");
      }
    } catch {}

    const container = document.querySelector(".container");
    if (!container) return;
    if (document.querySelector(".checkout-wizard")) return;

    // Build wizard
    const wizard = document.createElement("div");
    wizard.className = "checkout-wizard";
    container.insertBefore(wizard, container.firstChild);

    const nav = document.createElement("ul");
    nav.className = "checkout-steps";
    wizard.appendChild(nav);

    const steps = [
      { title: "Order Details", findEls: () => {
        const tx = document.getElementById("ctl00_PageBody_TransactionTypeDiv");
        return tx ? [tx.closest(".epi-form-col-single-checkout")] : [];
      }},
      { title: "Ship/Pickup", findEls: () => {
        const ship = document.getElementById("ctl00_PageBody_SaleTypeSelector_lblDelivered");
        return ship ? [ship.closest(".epi-form-col-single-checkout")] : [];
      }},
      { title: "Your reference", findEls: () => {
        const po = document.getElementById("ctl00_PageBody_PurchaseOrderNumberTextBox");
        return po ? [po.closest(".epi-form-group-checkout")] : [];
      }},
      { title: "Branch", findEls: () => {
        const br = document.getElementById("ctl00_PageBody_BranchSelector");
        return br ? [br] : [];
      }},
      { title: "Delivery Address", findEls: () => {
        const hdr = document.querySelector(".SelectableAddressType");
        return hdr ? [hdr.closest(".epi-form-col-single-checkout")] : [];
      }},
      { title: "Billing Address", findEls: () => {
        const gp = document.getElementById("ctl00_PageBody_InvoiceAddress_GoogleAddressSearchWrapper");
        return gp ? [gp.closest(".epi-form-col-single-checkout")] : [];
      }},
      { title: "Date & Instructions", findEls: () => {
        const arr = [];
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
      }},
    ];

    function showStep(n) {
      wizard.querySelectorAll(".checkout-step")
        .forEach(p => p.classList.toggle("active", +p.dataset.step === n));
      nav.querySelectorAll("li").forEach(li => {
        const s = +li.dataset.step;
        li.classList.toggle("active", s === n);
        li.classList.toggle("completed", s < n);
      });
      setStep(n);
      try { window.scrollTo({ top: wizard.offsetTop, behavior: "smooth" }); } catch {}
    }
    window.WLCheckout.showStep = showStep;

    // Build panes
    steps.forEach((step, i) => {
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

      step.findEls().filter(el => el && el.nodeType === 1).forEach(el => pane.appendChild(el));

      const navDiv = document.createElement("div");
      navDiv.className = "checkout-nav";
      pane.appendChild(navDiv);

      if (num > 1) {
        const back = document.createElement("button");
        back.type = "button";
        back.className = "btn btn-secondary";
        back.textContent = "Back";
        back.addEventListener("click", (e) => { e.preventDefault(); showStep(num - 1); });
        navDiv.appendChild(back);
      }

      if (num < steps.length) {
        const next = document.createElement("button");
        next.type = "button";
        next.className = "btn btn-primary";
        next.textContent = "Next";
        next.addEventListener("click", (e) => {
          e.preventDefault();

          // If leaving Billing step while pickup is selected, ensure system delivery is filled.
          if (num === 6 && isPickupSelected()) {
            ensureSystemDeliveryForPickup();
          }

          showStep(num + 1);
        });
        navDiv.appendChild(next);
      } else {
        const conts = Array.from(document.querySelectorAll("#ctl00_PageBody_ContinueButton1,#ctl00_PageBody_ContinueButton2"));
        if (conts.length) {
          const cont = conts.pop();
          cont.style.display = "";
          cont.type = "submit";
          navDiv.appendChild(cont);
        }
      }
    });

    // Optional tag on step 3
    (function () {
      const p3 = wizard.querySelector('.checkout-step[data-step="3"]');
      const lbl = p3 && p3.querySelector("label");
      if (!lbl) return;
      const opt = document.createElement("small");
      opt.className = "text-muted";
      opt.style.marginLeft = "8px";
      opt.textContent = "(optional)";
      lbl.appendChild(opt);
    })();

    // Rename step 6 header
    (function () {
      const p6 = wizard.querySelector('.checkout-step[data-step="6"]');
      const hdr = p6 && p6.querySelector(".font-weight-bold.mb-3.mt-4");
      if (hdr) hdr.textContent = "Billing Address";
    })();

    // -------------------------------------------------------------------------
    // Delivery summary/edit (Step 5)
    // -------------------------------------------------------------------------
    (function () {
      const pane5 = wizard.querySelector('.checkout-step[data-step="5"]');
      if (!pane5) return;
      const col = pane5.querySelector(".epi-form-col-single-checkout");
      if (!col) return;

      const wrap = document.createElement("div");
      wrap.className = "delivery-inputs";

      const sum = document.createElement("div");
      sum.className = "delivery-summary";

      while (col.firstChild) wrap.appendChild(col.firstChild);
      col.appendChild(wrap);

      function upd() {
        const a1 = val("ctl00_PageBody_DeliveryAddress_AddressLine1").trim();
        const a2 = val("ctl00_PageBody_DeliveryAddress_AddressLine2").trim();
        const c  = val("ctl00_PageBody_DeliveryAddress_City").trim();
        const s  = safeSelectedText("ctl00_PageBody_DeliveryAddress_CountySelector_CountyList").trim();
        const z  = val("ctl00_PageBody_DeliveryAddress_Postcode").trim();

        sum.innerHTML = `<strong>Delivery Address</strong><br>
          ${a1}${a2 ? "<br>" + a2 : ""}<br>
          ${c}${c && (s || z) ? ", " : ""}${s} ${z}<br>
          <button type="button" id="editDelivery" class="btn btn-link">Edit</button>`;
      }

      wrap.style.display = "none";
      col.insertBefore(sum, wrap);

      sum.addEventListener("click", (e) => {
        if (e.target.id !== "editDelivery") return;
        e.preventDefault();
        sum.style.display = "none";
        wrap.style.display = "";
        setReturnStep(5);
        try { wrap.scrollIntoView({ behavior: "smooth" }); } catch {}
      });

      upd();
    })();

    // -------------------------------------------------------------------------
    // Billing: same-as-delivery + recovery (Step 6)
    // -------------------------------------------------------------------------
    (function () {
      const pane6 = wizard.querySelector('.checkout-step[data-step="6"]');
      if (!pane6) return;

      const orig = document.getElementById("copyDeliveryAddressButton");
      if (orig) orig.style.display = "none";

      const chkDiv = document.createElement("div");
      chkDiv.className = "form-check mb-3";
      chkDiv.innerHTML = `
        <input class="form-check-input" type="checkbox" id="sameAsDeliveryCheck">
        <label class="form-check-label" for="sameAsDeliveryCheck">
          Billing address is the same as delivery address
        </label>`;
      pane6.insertBefore(chkDiv, pane6.firstChild);

      const sameCheck = chkDiv.querySelector("#sameAsDeliveryCheck");

      const colInv = pane6.querySelector(".epi-form-col-single-checkout");
      if (!colInv) return;

      const wrapInv = document.createElement("div");
      wrapInv.className = "invoice-inputs";

      const sumInv = document.createElement("div");
      sumInv.className = "invoice-summary";

      while (colInv.firstChild) wrapInv.appendChild(colInv.firstChild);
      colInv.appendChild(wrapInv);

      colInv.insertBefore(sumInv, wrapInv);

      function refreshInvSummary() {
        const a1 = val("ctl00_PageBody_InvoiceAddress_AddressLine1").trim();
        const a2 = val("ctl00_PageBody_InvoiceAddress_AddressLine2").trim();
        const c  = val("ctl00_PageBody_InvoiceAddress_City").trim();
        const st = safeSelectedText("ctl00_PageBody_InvoiceAddress_CountySelector_CountyList").trim();
        const z  = val("ctl00_PageBody_InvoiceAddress_Postcode").trim();
        const e  = val("ctl00_PageBody_InvoiceAddress_EmailAddressTextBox").trim();

        sumInv.innerHTML = `<strong>Billing Address</strong><br>
          ${a1}${a2 ? "<br>" + a2 : ""}<br>
          ${c}${c && (st || z) ? ", " : ""}${st} ${z}<br>
          Email: ${e}<br>
          <button type="button" id="editInvoice" class="btn btn-link">Enter new billing address</button>`;
      }

      // initial checkbox state
      const sameStored = getSameAsDelivery();
      sameCheck.checked = sameStored;

      // Recovery path:
      // If same-as-delivery is checked but invoice is blank:
      //  1) server-side copy ONCE/session
      //  2) if still blank, client fallback copy
      if (sameStored && isBlankAddress("InvoiceAddress")) {
        // If delivery has data, do server copy first (once per session)
        if (!isBlankAddress("DeliveryAddress") && !autoCopyAlreadyDone()) {
          markAutoCopyDone();
          setReturnStep(6);
          setExpectedNav(true);
          try {
            __doPostBack("ctl00$PageBody$CopyDeliveryAddressLinkButton", "");
            return; // page will reload
          } catch {}
        } else {
          // If server already tried, do client fallback
          fillInvoiceFromDeliveryFallback();
        }
      }

      // Display rules:
      // - Delivered: same-as-delivery shows summary (locked)
      // - Pickup: we prefer user edits Billing (so show inputs) even if checkbox is checked,
      //          BUT behind the scenes we still keep delivery filled.
      function applyBillingDisplay() {
        if (isPickupSelected()) {
          // Pickup mode: no confusion—always show billing inputs.
          sumInv.style.display = "none";
          wrapInv.style.display = "";
          refreshInvSummary();
          return;
        }

        // Delivered mode: show summary if same-as-delivery
        if (sameCheck.checked) {
          refreshInvSummary();
          wrapInv.style.display = "none";
          sumInv.style.display = "";
        } else {
          wrapInv.style.display = "";
          sumInv.style.display = "none";
        }
      }

      sameCheck.addEventListener("change", function () {
        setReturnStep(6);

        if (this.checked) {
          setSameAsDelivery(true);

          // In delivered mode, do the standard postback copy
          if (isDeliveredSelected()) {
            markAutoCopyDone();
            setExpectedNav(true);
            try {
              __doPostBack("ctl00$PageBody$CopyDeliveryAddressLinkButton", "");
              return;
            } catch {}
          }

          // In pickup mode, DO NOT force-copy billing from delivery (confusing).
          // Instead: we will use billing as primary and fill delivery behind scenes.
          applyBillingDisplay();
          ensureSystemDeliveryForPickup();
        } else {
          setSameAsDelivery(false);
          applyBillingDisplay();
        }
      });

      sumInv.addEventListener("click", (e) => {
        if (e.target.id !== "editInvoice") return;
        e.preventDefault();
        sumInv.style.display = "none";
        wrapInv.style.display = "";
        setReturnStep(6);
        try { wrapInv.scrollIntoView({ behavior: "smooth" }); } catch {}
      });

      // Apply display initially
      applyBillingDisplay();

      // If pickup and checkbox checked, ensure hidden delivery is filled
      if (isPickupSelected() && sameCheck.checked && !pickupDeliveryFilled()) {
        ensureSystemDeliveryForPickup();
      }
    })();

    // -------------------------------------------------------------------------
    // Step visibility based on Ship/Pickup choice
    // -------------------------------------------------------------------------
    function syncModeUI() {
      const pickup = isPickupSelected();
      setDeliveryStepVisibility(wizard, !pickup);

      // If pickup selected, keep users out of delivery step
      const cur = getStep() || 2;
      if (pickup && cur === 5) {
        showStep(6);
      }

      // Also in pickup, ensure delivery is filled behind scenes
      if (pickup) ensureSystemDeliveryForPickup();
    }

    const rbPick = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbCollectLater");
    const rbDel  = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbDelivered");
    if (rbPick) rbPick.addEventListener("change", () => { setReturnStep(2); syncModeUI(); });
    if (rbDel)  rbDel.addEventListener("change", () => { setReturnStep(2); syncModeUI(); });

    // Initial
    syncModeUI();

    // -------------------------------------------------------------------------
    // Step 7: pickup/delivery + special instructions + same-day pickup time rule
    // -------------------------------------------------------------------------
    (function () {
      const p7 = wizard.querySelector('.checkout-step[data-step="7"]');
      if (!p7) return;

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
      const maxPickupD = new Date(); maxPickupD.setDate(maxPickupD.getDate() + 14);
      const minDelD = new Date(); minDelD.setDate(minDelD.getDate() + 2);

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
      function minutesFromMidnight(d) { return d.getHours() * 60 + d.getMinutes(); }
      function getSameDayMinStartMins() {
        const now = new Date();
        const mins = minutesFromMidnight(now) + 120; // +2 hours
        return Math.ceil(mins / 60) * 60; // round up to next hour
      }

      function populatePickupTimes(date) {
        const day = date.getDay();
        let openMins = 7 * 60 + 30;
        let closeMins;

        if (1 <= day && day <= 5) closeMins = 17 * 60 + 30;
        else if (day === 6) closeMins = 16 * 60;
        else closeMins = openMins + 60;

        const isSameDay =
          date.getFullYear() === today.getFullYear() &&
          date.getMonth() === today.getMonth() &&
          date.getDate() === today.getDate();

        let minStart = openMins;
        if (isSameDay) minStart = Math.max(openMins, getSameDayMinStartMins());
        minStart = Math.ceil(minStart / 60) * 60;

        pickupTimeSel.innerHTML = "";
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
        if (d.getDay() === 0) { alert("No Sunday pickups – moved to Monday"); d.setDate(d.getDate() + 1); }
        if (d > maxPickupD) { alert("Pickups only within next two weeks"); d = maxPickupD; }
        this.value = formatLocal(d);
        populatePickupTimes(d);
        updateSpecial();
      });

      deliveryInput.addEventListener("change", function () {
        if (!this.value) return updateSpecial();
        let d = parseLocalDate(this.value);
        if (d.getDay() === 0) { alert("No Sunday deliveries – moved to Monday"); d.setDate(d.getDate() + 1); }
        if (d < minDelD) { alert("Select at least 2 days out"); d = minDelD; }
        this.value = formatLocal(d);
        updateSpecial();
      });

      const zipInput = document.getElementById("ctl00_PageBody_DeliveryAddress_Postcode");
      function inZone(z) { return ["75","76","77","78","79"].includes((z || "").substring(0, 2)); }

      function updateSpecial() {
        let baseText = "";
        if (isPickupSelected()) {
          const d = pickupInput.value;
          const t = pickupTimeSel.disabled ? "" : pickupTimeSel.value;
          const p = pickupDiv.querySelector("#pickupPerson").value;
          specialIns.readOnly = false;
          baseText = "Pickup on " + d + (t ? " at " + t : "") + (p ? " for " + p : "");
        } else if (isDeliveredSelected()) {
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
        if (isPickupSelected()) {
          pickupDiv.style.display = "block";
          deliveryDiv.style.display = "none";
          if (pickupInput.value) populatePickupTimes(parseLocalDate(pickupInput.value));
        } else if (isDeliveredSelected()) {
          pickupDiv.style.display = "none";
          deliveryDiv.style.display = "block";
        } else {
          pickupDiv.style.display = "none";
          deliveryDiv.style.display = "none";
        }
        updateSpecial();
      }

      if (rbPick) rbPick.addEventListener("change", onShip);
      if (rbDel)  rbDel.addEventListener("change", onShip);

      pickupDiv.querySelector("#pickupPerson").addEventListener("input", updateSpecial);
      pickupTimeSel.addEventListener("change", updateSpecial);
      deliveryDiv.querySelectorAll('input[name="deliveryTime"]').forEach(r => r.addEventListener("change", updateSpecial));
      specialExtra.addEventListener("input", updateSpecial);

      onShip();

      // Continue buttons validation + pickup delivery fill
      if (jq) {
        jq("#ctl00_PageBody_ContinueButton1, #ctl00_PageBody_ContinueButton2").on("click", function (e) {
          setReturnStep(7);
          setExpectedNav(true);

          // Pickup: ensure system delivery exists before submit/continue
          if (isPickupSelected()) ensureSystemDeliveryForPickup();

          let valid = true;
          const errors = [];

          if (jq("#deliveryDate").closest(".form-group").is(":visible")) {
            if (!jq("#deliveryDate").val()) { valid = false; errors.push("• Please select a Requested Delivery Date."); }
            if (!jq('input[name="deliveryTime"]:checked').length) { valid = false; errors.push("• Please choose a Delivery Time (Morning or Afternoon)."); }
          }

          if (jq("#pickupDate").closest(".form-group").is(":visible")) {
            if (!jq("#pickupDate").val()) { valid = false; errors.push("• Please select a Requested Pickup Date."); }
            if (!jq("#pickupPerson").val().trim()) { valid = false; errors.push("• Please enter a Pickup Person."); }
            if (jq("#pickupTime").prop("disabled") || !jq("#pickupTime").val()) { valid = false; errors.push("• Please select an available Pickup Time."); }
          }

          if (!valid) {
            e.preventDefault();
            alert("Hold on – we need a bit more info:\n\n" + errors.join("\n"));
            showStep(7);
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
    // Validation scanner
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
        const bad = $all(perInputSelectors).filter(isVisible);
        if (bad.length) return bad[0];

        const validators = $all("span[controltovalidate], span.validator, .field-validation-error, .text-danger")
          .filter(el => isVisible(el) && (el.textContent || "").trim().length >= 1);

        if (validators.length) {
          const sp = validators[0];
          const ctl = sp.getAttribute("controltovalidate");
          if (ctl) {
            const target = document.getElementById(ctl);
            if (target) return target;
          }
          const nearby = sp.closest(".epi-form-group-checkout, .form-group, .epi-form-col-single-checkout")
            ?.querySelector("input,select,textarea");
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
        const stepNum = paneStepFor(culprit) || 2;
        window.WLCheckout?.showStep?.(stepNum);
        try { culprit.scrollIntoView({ behavior: "smooth", block: "center" }); } catch {}
        return true;
      }
      window.WLCheckout = window.WLCheckout || {};
      window.WLCheckout.detectAndJumpToValidation = detectAndJumpToValidation;
    })();

    // -------------------------------------------------------------------------
    // Hide "Special Instructions" header cell
    // -------------------------------------------------------------------------
    try {
      document.querySelectorAll("th").forEach(th => {
        if ((th.textContent || "").includes("Special Instructions")) th.style.display = "none";
      });
    } catch {}

    // -------------------------------------------------------------------------
    // Restore step on load (and enforce pickup mode rules)
    // -------------------------------------------------------------------------
    const expectedNav = consumeExpectedNav();
    const returnStep = consumeReturnStep();
    const saved = getStep();
    let initial = returnStep || saved || 2;

    // If pickup: skip delivery step
    if (isPickupSelected() && initial === 5) initial = 6;

    window.WLCheckout.showStep(initial);

    // If pickup: hide delivery step + fill required delivery behind scenes
    if (isPickupSelected()) {
      setDeliveryStepVisibility(wizard, false);
      ensureSystemDeliveryForPickup();
    }

    if (expectedNav) {
      const tryJump = () => window.WLCheckout?.detectAndJumpToValidation?.() === true;
      if (!tryJump()) {
        setTimeout(tryJump, 0);
        setTimeout(tryJump, 300);
        setTimeout(tryJump, 1200);
        setTimeout(() => {
          if (!tryJump()) window.WLCheckout.showStep(returnStep || saved || 2);
        }, 1600);
      }
    }

    // -------------------------------------------------------------------------
    // Place order / Back to cart reset
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
          sessionStorage.removeItem("wl_pickup_deliv_filled");
        } catch {}
      }
      if (placeOrderBtn) placeOrderBtn.addEventListener("click", resetWizardState);
      if (backToCartBtn) backToCartBtn.addEventListener("click", resetWizardState);
    })();
  });
})();
