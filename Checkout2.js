// ─────────────────────────────────────────────────────────────────────────────
// Woodson WebTrack Checkout Wizard (Modern Flow Rebuild + Address UX Improvements)
// Updates requested:
//  1) Delivery step: show inputs + live preview by default (no “Edit” gate)
//     + lightweight “address looks valid” checks
//     + if Google Places Autocomplete exists, hook it to #autocompleteDelivery/#autocompleteInvoice
//  2) Billing “same as delivery” defaults UNCHECKED; billing inputs visible by default
//     + when checked, prefill billing from delivery via existing postback
//  3) If Pickup selected: skip Delivery Address step in the wizard UI
//     + behind the scenes, auto-fill Delivery fields from Billing so WebTrack has values
//  4) Keep same-day pickup time rule: >= 2 hours out (rounded up to next hour)
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  // ---------------------------------------------------------------------------
  // 0) Storage helpers
  // ---------------------------------------------------------------------------
  const STEP_KEY = "wl_currentStep";
  const TTL_MS = 10 * 60 * 1000; // 10 minutes

  // Billing same-as-delivery should be per-session (so it defaults unchecked on a new session)
  const SAME_SESSION_KEY = "wl_sameAsDelivery_session";

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
    try {
      sessionStorage.setItem("wl_autocopy_done", "1");
    } catch {}
  }
  function autoCopyAlreadyDone() {
    try {
      return sessionStorage.getItem("wl_autocopy_done") === "1";
    } catch {
      return false;
    }
  }

  // Same-as-delivery: defaults unchecked each new session
  function setSameAsDeliverySession(val) {
    try {
      sessionStorage.setItem(SAME_SESSION_KEY, val ? "1" : "0");
    } catch {}
  }
  function getSameAsDeliverySession() {
    try {
      return sessionStorage.getItem(SAME_SESSION_KEY) === "1";
    } catch {
      return false;
    }
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
    // Inject modern-ish styling (lightweight)
    // -------------------------------------------------------------------------
    (function injectStyle() {
      const css = `
        .checkout-wizard{margin-bottom:16px}
        .checkout-steps{display:flex;flex-wrap:wrap;gap:10px;list-style:none;padding:0;margin:0 0 12px 0}
        .checkout-steps li{cursor:pointer;padding:10px 12px;border-radius:12px;background:#f4f6f8;color:#2b2f33;font-weight:600}
        .checkout-steps li.active{background:#1f6feb;color:#fff}
        .checkout-steps li.completed{opacity:.75}
        .checkout-step{display:none;background:#fff;border-radius:16px;padding:14px 14px 8px;box-shadow:0 1px 8px rgba(0,0,0,.06);margin-bottom:12px}
        .checkout-step.active{display:block}
        .checkout-nav{display:flex;gap:10px;justify-content:space-between;align-items:center;margin-top:10px}
        .wl-grid-2{display:grid;grid-template-columns:1fr;gap:12px}
        @media(min-width:992px){.wl-grid-2{grid-template-columns:1.2fr .8fr}}
        .wl-card{background:#f7f9fb;border:1px solid rgba(0,0,0,.06);border-radius:14px;padding:12px}
        .wl-muted{color:#6b7280}
        .wl-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;font-weight:700;font-size:12px}
        .wl-badge.good{background:#e8f7ee;color:#136f3a}
        .wl-badge.warn{background:#fff4e5;color:#8a4b00}
        .wl-badge.bad{background:#fdecec;color:#9b1c1c}
        .wl-hidden{display:none!important}
        .wl-help{font-size:13px;line-height:1.35}
      `;
      const st = document.createElement("style");
      st.type = "text/css";
      st.appendChild(document.createTextNode(css));
      document.head.appendChild(st);
    })();

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
    // Helpers: shipping mode detection
    // -------------------------------------------------------------------------
    const rbPick = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbCollectLater");
    const rbDel = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbDelivered");
    function isPickupSelected() {
      return !!(rbPick && rbPick.checked);
    }

    // -------------------------------------------------------------------------
    // C) Steps definition
    // -------------------------------------------------------------------------
    const steps = [
      {
        title: "Order Details",
        findEls: () => {
          const tx = document.getElementById("ctl00_PageBody_TransactionTypeDiv");
          return tx ? [tx.closest(".epi-form-col-single-checkout")] : [];
        },
      },
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
        title: "Your reference",
        findEls: () => {
          const po = document.getElementById(
            "ctl00_PageBody_PurchaseOrderNumberTextBox"
          );
          return po ? [po.closest(".epi-form-group-checkout")] : [];
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
          const tbl = document.querySelector(".cartTable");
          if (tbl) arr.push(tbl.closest("table"));
          const si = document.getElementById(
            "ctl00_PageBody_SpecialInstructionsTextBox"
          );
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
        back.className = "btn btn-secondary";
        back.textContent = "Back";
        back.addEventListener("click", (e) => {
          e.preventDefault();
          showStep(findPrevVisibleStep(num));
        });
        navDiv.appendChild(back);
      }

      if (num < steps.length) {
        const next = document.createElement("button");
        next.type = "button";
        next.className = "btn btn-primary";
        next.textContent = "Next";
        next.addEventListener("click", (e) => {
          e.preventDefault();
          showStep(findNextVisibleStep(num));
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

    // Optional "(optional)" on step 3 label
    (function () {
      const p3 = wizard.querySelector('.checkout-step[data-step="3"]');
      if (!p3) return;
      const lbl = p3.querySelector("label");
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
      if (!p6) return;
      const hdr = p6.querySelector(".font-weight-bold.mb-3.mt-4");
      if (hdr) hdr.textContent = "Billing Address";
    })();

    // -------------------------------------------------------------------------
    // E) Step visibility (Pickup should hide Delivery Address step)
    // -------------------------------------------------------------------------
    function shouldHideStep(stepNum) {
      // Hide Delivery Address step (5) when pickup is selected
      if (stepNum === 5 && isPickupSelected()) return true;
      return false;
    }

    function syncStepVisibility() {
      nav.querySelectorAll("li").forEach((li) => {
        const s = +li.dataset.step;
        li.classList.toggle("wl-hidden", shouldHideStep(s));
      });
      wizard.querySelectorAll(".checkout-step").forEach((p) => {
        const s = +p.dataset.step;
        p.classList.toggle("wl-hidden", shouldHideStep(s));
      });
    }

    function findPrevVisibleStep(fromStep) {
      for (let s = fromStep - 1; s >= 1; s--) {
        if (!shouldHideStep(s)) return s;
      }
      return 1;
    }
    function findNextVisibleStep(fromStep) {
      for (let s = fromStep + 1; s <= steps.length; s++) {
        if (!shouldHideStep(s)) return s;
      }
      return steps.length;
    }

    // -------------------------------------------------------------------------
    // F) Step switching + persistence
    // -------------------------------------------------------------------------
    function showStep(n) {
      syncStepVisibility();

      // If requested step is hidden, jump to nearest visible step.
      if (shouldHideStep(n)) {
        n = findNextVisibleStep(n);
      }

      wizard
        .querySelectorAll(".checkout-step")
        .forEach((p) => p.classList.toggle("active", +p.dataset.step === n));

      nav.querySelectorAll("li").forEach((li) => {
        const s = +li.dataset.step;
        if (shouldHideStep(s)) {
          li.classList.remove("active", "completed");
          return;
        }
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
    // G) ReturnStep binding for WebForms postbacks
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
        true
      );
    }

    bindReturnStepFor(
      "#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList",
      5,
      "change"
    );
    bindReturnStepFor("#ctl00_PageBody_DeliveryAddress_CountrySelector", 5, "change");

    bindReturnStepFor(
      "#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList",
      6,
      "change"
    );
    bindReturnStepFor("#ctl00_PageBody_InvoiceAddress_CountrySelector1", 6, "change");

    bindReturnStepFor("#ctl00_PageBody_BranchSelector", 4, "change");

    // -------------------------------------------------------------------------
    // H) Address utilities
    // -------------------------------------------------------------------------
    function norm(s) {
      return String(s || "").trim();
    }
    function looksLikeUSZip(z) {
      const zz = norm(z);
      return /^\d{5}(-\d{4})?$/.test(zz);
    }
    function setBadge(el, kind, text) {
      if (!el) return;
      el.className = "wl-badge " + kind;
      el.textContent = text;
    }

    // Copy Billing -> Delivery (for pickup mode behind-the-scenes)
    function copyBillingToDeliverySilently() {
      const map = [
        ["ctl00_PageBody_InvoiceAddress_AddressLine1", "ctl00_PageBody_DeliveryAddress_AddressLine1"],
        ["ctl00_PageBody_InvoiceAddress_AddressLine2", "ctl00_PageBody_DeliveryAddress_AddressLine2"],
        ["ctl00_PageBody_InvoiceAddress_City", "ctl00_PageBody_DeliveryAddress_City"],
        ["ctl00_PageBody_InvoiceAddress_Postcode", "ctl00_PageBody_DeliveryAddress_Postcode"],
        ["ctl00_PageBody_InvoiceAddress_CountrySelector1", "ctl00_PageBody_DeliveryAddress_CountrySelector"],
        ["ctl00_PageBody_InvoiceAddress_CountySelector_CountyList", "ctl00_PageBody_DeliveryAddress_CountySelector_CountyList"],
        ["ctl00_PageBody_InvoiceAddress_ContactFirstNameTextBox", "ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox"],
        ["ctl00_PageBody_InvoiceAddress_ContactLastNameTextBox", "ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox"],
        ["ctl00_PageBody_InvoiceAddress_EmailAddressTextBox", "ctl00_PageBody_DeliveryAddress_EmailAddressTextBox"],
        ["ctl00_PageBody_InvoiceAddress_ContactTelephoneTextBox", "ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox"],
      ];

      map.forEach(([fromId, toId]) => {
        const from = document.getElementById(fromId);
        const to = document.getElementById(toId);
        if (!from || !to) return;

        // selects
        if (to.tagName === "SELECT") {
          const val = from.value;
          if (val) to.value = val;
          return;
        }

        const val = norm(from.value);
        if (val && !norm(to.value)) {
          to.value = val;
        }
      });
    }

    // -------------------------------------------------------------------------
    // I) Delivery step (5): inputs + live preview side-by-side + validation badge
    // -------------------------------------------------------------------------
    (function () {
      const pane5 = wizard.querySelector('.checkout-step[data-step="5"]');
      if (!pane5) return;

      const col = pane5.querySelector(".epi-form-col-single-checkout");
      if (!col) return;

      // Build a 2-col layout: left inputs, right preview/validation
      const grid = document.createElement("div");
      grid.className = "wl-grid-2";

      const inputsCard = document.createElement("div");
      inputsCard.className = "wl-card";
      inputsCard.innerHTML = `<div style="font-weight:800;margin-bottom:8px">Delivery Address</div>`;

      const previewCard = document.createElement("div");
      previewCard.className = "wl-card";
      previewCard.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px">
          <div style="font-weight:800">Preview</div>
          <span id="wlDeliveryBadge" class="wl-badge warn">Checking…</span>
        </div>
        <div id="wlDeliveryPreview" class="wl-help wl-muted">Start typing an address.</div>
        <div class="wl-help wl-muted" style="margin-top:10px">
          Tip: Use the address search (Google suggestions) when available to reduce typos.
        </div>
      `;

      // Move current col children into inputsCard (preserving existing controls)
      const wrap = document.createElement("div");
      while (col.firstChild) wrap.appendChild(col.firstChild);
      inputsCard.appendChild(wrap);

      grid.appendChild(inputsCard);
      grid.appendChild(previewCard);
      col.appendChild(grid);

      const badge = previewCard.querySelector("#wlDeliveryBadge");
      const prev = previewCard.querySelector("#wlDeliveryPreview");

      const q = (id) => document.getElementById(id);

      function readDelivery() {
        const a1 = norm(q("ctl00_PageBody_DeliveryAddress_AddressLine1")?.value);
        const a2 = norm(q("ctl00_PageBody_DeliveryAddress_AddressLine2")?.value);
        const city = norm(q("ctl00_PageBody_DeliveryAddress_City")?.value);
        const st =
          q("ctl00_PageBody_DeliveryAddress_CountySelector_CountyList")?.selectedOptions?.[0]?.text || "";
        const zip = norm(q("ctl00_PageBody_DeliveryAddress_Postcode")?.value);
        const country = norm(q("ctl00_PageBody_DeliveryAddress_CountrySelector")?.value);
        return { a1, a2, city, st: norm(st), zip, country };
      }

      function renderDeliveryPreview() {
        const d = readDelivery();
        const lines = [];
        if (d.a1) lines.push(d.a1);
        if (d.a2) lines.push(d.a2);
        const line3 = [d.city, d.st].filter(Boolean).join(", ");
        const line4 = [d.zip].filter(Boolean).join(" ");
        if (line3 || line4) lines.push([line3, line4].filter(Boolean).join(" "));
        if (d.country) lines.push(d.country);

        prev.innerHTML = lines.length
          ? lines.map((x) => `<div>${x}</div>`).join("")
          : `<div class="wl-muted">Start typing an address.</div>`;

        // Simple validation heuristic (keeps it light)
        const missing = [];
        if (!d.a1) missing.push("street");
        if (!d.city) missing.push("city");
        if (!d.zip) missing.push("ZIP");
        const zipOk = d.zip ? looksLikeUSZip(d.zip) : false;

        if (missing.length) {
          setBadge(badge, "warn", "Needs info");
          badge.title = "Missing: " + missing.join(", ");
        } else if (!zipOk) {
          setBadge(badge, "warn", "Check ZIP");
          badge.title = "ZIP should look like 77840 or 77840-1234";
        } else {
          setBadge(badge, "good", "Looks good");
          badge.title = "Basic checks passed";
        }
      }

      // Hook inputs to refresh preview
      [
        "ctl00_PageBody_DeliveryAddress_AddressLine1",
        "ctl00_PageBody_DeliveryAddress_AddressLine2",
        "ctl00_PageBody_DeliveryAddress_City",
        "ctl00_PageBody_DeliveryAddress_Postcode",
        "ctl00_PageBody_DeliveryAddress_CountrySelector",
        "ctl00_PageBody_DeliveryAddress_CountySelector_CountyList",
      ].forEach((id) => {
        const el = q(id);
        if (!el) return;
        el.addEventListener("input", renderDeliveryPreview);
        el.addEventListener("change", renderDeliveryPreview);
        el.addEventListener("blur", renderDeliveryPreview);
      });

      // Optional: attach Google Places Autocomplete if present
      (function attachPlacesIfAvailable() {
        try {
          const g = window.google;
          if (!g || !g.maps || !g.maps.places || !g.maps.places.Autocomplete) return;

          const input = document.getElementById("autocompleteDelivery");
          if (!input) return;

          const ac = new g.maps.places.Autocomplete(input, {
            types: ["address"],
            componentRestrictions: { country: ["us"] },
          });

          ac.addListener("place_changed", function () {
            // We don’t assume exact fields are provided—just refresh preview after WebTrack/Google fills
            setTimeout(renderDeliveryPreview, 50);
          });
        } catch {}
      })();

      renderDeliveryPreview();
    })();

    // -------------------------------------------------------------------------
    // J) Billing step (6): default unchecked + inputs visible; checking triggers copy
    // -------------------------------------------------------------------------
    (function () {
      const pane6 = wizard.querySelector('.checkout-step[data-step="6"]');
      if (!pane6) return;

      // Hide original copy button if present
      const orig = document.getElementById("copyDeliveryAddressButton");
      if (orig) orig.style.display = "none";

      const chkDiv = document.createElement("div");
      chkDiv.className = "wl-card";
      chkDiv.style.marginBottom = "12px";
      chkDiv.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
          <div>
            <div style="font-weight:800;margin-bottom:4px">Billing Address</div>
            <div class="wl-help wl-muted">Enter your billing address. If it matches your delivery address, you can copy it with one click.</div>
          </div>
          <div class="form-check" style="margin:0">
            <input class="form-check-input" type="checkbox" id="sameAsDeliveryCheck">
            <label class="form-check-label" for="sameAsDeliveryCheck" style="font-weight:700">
              Same as delivery
            </label>
          </div>
        </div>
      `;
      pane6.insertBefore(chkDiv, pane6.firstChild);

      const sameCheck = chkDiv.querySelector("#sameAsDeliveryCheck");
      const colInv = pane6.querySelector(".epi-form-col-single-checkout");
      if (!colInv) return;

      // Put invoice inputs in a card (keep always visible by default)
      const card = document.createElement("div");
      card.className = "wl-card";
      card.innerHTML = `<div style="font-weight:800;margin-bottom:8px">Billing Address Details</div>`;

      const wrapInv = document.createElement("div");
      while (colInv.firstChild) wrapInv.appendChild(colInv.firstChild);
      card.appendChild(wrapInv);
      colInv.appendChild(card);

      const q = (sel) => wrapInv.querySelector(sel);

      function invoiceLooksBlank() {
        const invLine1 = (q("#ctl00_PageBody_InvoiceAddress_AddressLine1")?.value || "").trim();
        const invCity = (q("#ctl00_PageBody_InvoiceAddress_City")?.value || "").trim();
        const invZip = (q("#ctl00_PageBody_InvoiceAddress_Postcode")?.value || "").trim();
        return !invLine1 && !invCity && !invZip;
      }
      function deliveryHasData() {
        const delLine1 = (document.getElementById("ctl00_PageBody_DeliveryAddress_AddressLine1")?.value || "").trim();
        const delCity = (document.getElementById("ctl00_PageBody_DeliveryAddress_City")?.value || "").trim();
        const delZip = (document.getElementById("ctl00_PageBody_DeliveryAddress_Postcode")?.value || "").trim();
        return !!(delLine1 || delCity || delZip);
      }

      // Default unchecked for a new session (but keep checked across postback reloads in same session)
      const sameStored = getSameAsDeliverySession();
      sameCheck.checked = sameStored;

      // If they previously checked same-as-delivery in THIS session, but invoice is blank after reload,
      // auto-trigger copy once.
      if (sameStored && invoiceLooksBlank() && deliveryHasData() && !autoCopyAlreadyDone()) {
        markAutoCopyDone();
        setReturnStep(6);
        try {
          __doPostBack("ctl00$PageBody$CopyDeliveryAddressLinkButton", "");
          return;
        } catch {}
      }

      sameCheck.addEventListener("change", function () {
        if (this.checked) {
          setReturnStep(6);
          setSameAsDeliverySession(true);
          markAutoCopyDone(); // user-initiated copy
          try {
            __doPostBack("ctl00$PageBody$CopyDeliveryAddressLinkButton", "");
          } catch {}
        } else {
          setSameAsDeliverySession(false);
          // do not clear inputs automatically; user may want to edit
        }
      });

      // Optional: Google Places autocomplete for billing if available
      (function attachPlacesIfAvailable() {
        try {
          const g = window.google;
          if (!g || !g.maps || !g.maps.places || !g.maps.places.Autocomplete) return;

          const input = document.getElementById("autocompleteInvoice");
          if (!input) return;

          const ac = new g.maps.places.Autocomplete(input, {
            types: ["address"],
            componentRestrictions: { country: ["us"] },
          });

          ac.addListener("place_changed", function () {
            // Allow WebTrack/Google to populate fields; no-op beyond that
          });
        } catch {}
      })();
    })();

    // -------------------------------------------------------------------------
    // K) Prefill delivery address (kept light)
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
          let state = "",
            zip = "";

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

          $("#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList option").each(
            function () {
              if ($(this).text().trim().toLowerCase() === state.toLowerCase()) {
                $(this).prop("selected", true);
                return false;
              }
            }
          );
        }
      }
    } catch {}

    // -------------------------------------------------------------------------
    // L) AJAX fetch user info (DON’T trigger WebForms change)
    // -------------------------------------------------------------------------
    if ($) {
      $.get("https://webtrack.woodsonlumber.com/AccountSettings.aspx", (data) => {
        const $acc = $(data);
        const fn = (
          $acc.find("#ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput").val() || ""
        ).trim();
        const ln = (
          $acc.find("#ctl00_PageBody_ChangeUserDetailsControl_LastNameInput").val() || ""
        ).trim();
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
        const tel = $(data)
          .find("#ctl00_PageBody_TelephoneLink_TelephoneLink")
          .text()
          .trim();
        if (tel) $("#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox").val(tel);
        if (tel) $("#ctl00_PageBody_InvoiceAddress_ContactTelephoneTextBox").val(tel);
      });
    }

    // -------------------------------------------------------------------------
    // M) Step 7: pickup/delivery + special instructions
    // Fix: Same-day pickup times must be >= 2 hours out (rounded up to next hour)
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
      pickupDiv.className = "form-group wl-card";
      pickupDiv.innerHTML = `
        <div style="font-weight:800;margin-bottom:8px">Pickup details</div>
        <label for="pickupDate">Requested Pickup Date:</label>
        <input type="date" id="pickupDate" class="form-control">
        <label for="pickupTime" style="margin-top:8px">Requested Pickup Time:</label>
        <select id="pickupTime" class="form-control" disabled></select>
        <label for="pickupPerson" style="margin-top:8px">Pickup Person:</label>
        <input type="text" id="pickupPerson" class="form-control">`;
      pickupDiv.style.display = "none";

      const deliveryDiv = document.createElement("div");
      deliveryDiv.className = "form-group wl-card";
      deliveryDiv.innerHTML = `
        <div style="font-weight:800;margin-bottom:8px">Delivery details</div>
        <label for="deliveryDate">Requested Delivery Date:</label>
        <input type="date" id="deliveryDate" class="form-control">
        <div style="margin-top:8px">
          <label style="margin-right:10px"><input type="radio" name="deliveryTime" value="Morning"> Morning</label>
          <label><input type="radio" name="deliveryTime" value="Afternoon"> Afternoon</label>
        </div>`;
      deliveryDiv.style.display = "none";

      siWrap.insertAdjacentElement("afterend", pickupDiv);
      pickupDiv.insertAdjacentElement("afterend", deliveryDiv);

      const extraDiv = document.createElement("div");
      extraDiv.className = "form-group wl-card";
      extraDiv.innerHTML = `
        <div style="font-weight:800;margin-bottom:8px">Additional instructions (optional)</div>
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

      function getSameDayMinStartMins() {
        const now = new Date();
        const mins = minutesFromMidnight(now) + 120; // +2h
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
        // Keep wizard visibility synced
        syncStepVisibility();

        if (rbPick && rbPick.checked) {
          pickupDiv.style.display = "block";
          deliveryDiv.style.display = "none";

          // If date already chosen, enforce same-day rule immediately
          if (pickupInput.value) populatePickupTimes(parseLocalDate(pickupInput.value));

          // Pickup mode: ensure Delivery fields are filled from Billing for system requirements
          copyBillingToDeliverySilently();
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

      onShip();

      // Client validation on Continue buttons
      if ($) {
        $("#ctl00_PageBody_ContinueButton1, #ctl00_PageBody_ContinueButton2").on(
          "click",
          function (e) {
            setReturnStep(7);
            setExpectedNav(true);

            // Pickup mode: keep delivery fields filled before submit
            if (isPickupSelected()) {
              copyBillingToDeliverySilently();
            }

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
              showStep(7);
              setExpectedNav(false);
              return;
            }

            setTimeout(function () {
              window.WLCheckout?.detectAndJumpToValidation?.();
            }, 900);
          }
        );
      }
    })();

    // -------------------------------------------------------------------------
    // N) Robust validation scanner → jump to step containing first visible error
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

        const badInputs = Array.from(document.querySelectorAll(perInputSelectors)).filter(
          isVisible
        );
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
            sp
              .closest(".epi-form-group-checkout, .form-group, .epi-form-col-single-checkout")
              ?.querySelector("input,select,textarea");
          return nearby || sp;
        }

        const summary = document.querySelector(
          ".validation-summary-errors li, .validation-summary-errors"
        );
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

        let stepNum = paneStepFor(culprit) || 2;

        // If the culprit is in a hidden step (delivery step hidden during pickup),
        // jump to Billing instead.
        if (shouldHideStep(stepNum)) stepNum = 6;

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
    // O) Modern Transaction & Shipping selectors (kept)
    // -------------------------------------------------------------------------
    if ($) {
      $(function () {
        if ($("#ctl00_PageBody_TransactionTypeDiv").length) {
          $(".TransactionTypeSelector").hide();

          const txnHTML = `
            <div class="modern-transaction-selector d-flex justify-content-around" style="gap:10px">
              <button type="button" id="btnOrder" class="btn btn-primary" data-value="rdbOrder">
                <i class="fas fa-shopping-cart"></i> Order
              </button>
              <button type="button" id="btnQuote" class="btn btn-secondary" data-value="rdbQuote">
                <i class="fas fa-file-alt"></i> Request Quote
              </button>
            </div>`;
          $("#ctl00_PageBody_TransactionTypeDiv").append(txnHTML);

          function updateTransactionStyles(val) {
            const orderRad = $("#ctl00_PageBody_TransactionTypeSelector_rdbOrder");
            const quoteRad = $("#ctl00_PageBody_TransactionTypeSelector_rdbQuote");

            if (val === "rdbOrder") {
              orderRad.prop("checked", true);
              $("#btnOrder").addClass("btn-primary").removeClass("btn-secondary");
              $("#btnQuote").addClass("btn-secondary").removeClass("btn-primary");
            } else {
              quoteRad.prop("checked", true);
              $("#btnQuote").addClass("btn-primary").removeClass("btn-secondary");
              $("#btnOrder").addClass("btn-secondary").removeClass("btn-primary");
            }
          }

          updateTransactionStyles(
            $("#ctl00_PageBody_TransactionTypeSelector_rdbOrder").is(":checked")
              ? "rdbOrder"
              : "rdbQuote"
          );

          $(document).on("click", ".modern-transaction-selector button", function () {
            updateTransactionStyles($(this).data("value"));
            setStep(1);
          });
        }

        if ($(".SaleTypeSelector").length) {
          $(".SaleTypeSelector").hide();

          const shipHTML = `
            <div class="modern-shipping-selector d-flex justify-content-around" style="gap:10px">
              <button type="button" id="btnDelivered" class="btn btn-primary" data-value="rbDelivered">
                <i class="fas fa-truck"></i> Delivered
              </button>
              <button type="button" id="btnPickup" class="btn btn-secondary" data-value="rbCollectLater">
                <i class="fas fa-store"></i> Pickup (Free)
              </button>
            </div>`;
          $(".epi-form-col-single-checkout:has(.SaleTypeSelector)").append(shipHTML);

          $("<style>.modern-shipping-selector .btn[disabled], .modern-shipping-selector .btn.disabled { pointer-events:auto; }</style>").appendTo(
            document.head
          );

          function updateShippingStyles(val) {
            const delRad = $("#ctl00_PageBody_SaleTypeSelector_rbDelivered");
            const pickRad = $("#ctl00_PageBody_SaleTypeSelector_rbCollectLater");
            const $btnDelivered = $("#btnDelivered");
            const $btnPickup = $("#btnPickup");

            $btnDelivered
              .removeClass("disabled opacity-50")
              .removeAttr("disabled")
              .attr("aria-disabled", "false");
            $btnPickup
              .removeClass("disabled opacity-50")
              .removeAttr("disabled")
              .attr("aria-disabled", "false");

            if (val === "rbDelivered") {
              delRad.prop("checked", true).trigger("change");
              $btnDelivered
                .addClass("btn-primary")
                .removeClass("btn-secondary opacity-50")
                .attr("aria-pressed", "true");
              $btnPickup
                .addClass("btn-secondary opacity-50")
                .removeClass("btn-primary")
                .attr("aria-pressed", "false");
              document.cookie = "pickupSelected=false; path=/";
              document.cookie = "skipBack=false; path=/";
            } else {
              pickRad.prop("checked", true).trigger("change");
              $btnPickup
                .addClass("btn-primary")
                .removeClass("btn-secondary opacity-50")
                .attr("aria-pressed", "true");
              $btnDelivered
                .addClass("btn-secondary opacity-50")
                .removeClass("btn-primary")
                .attr("aria-pressed", "false");
              document.cookie = "pickupSelected=true; path=/";
              document.cookie = "skipBack=true; path=/";
            }

            // sync visibility immediately
            syncStepVisibility();

            // If pickup selected and user is on Delivery step, bump them forward
            const current = getStep() || 2;
            if (shouldHideStep(current)) showStep(findNextVisibleStep(current));
            else showStep(2);
          }

          updateShippingStyles(
            $("#ctl00_PageBody_SaleTypeSelector_rbDelivered").is(":checked")
              ? "rbDelivered"
              : "rbCollectLater"
          );

          $(document).on("click", ".modern-shipping-selector button", function () {
            updateShippingStyles($(this).data("value"));
          });
        }
      });
    }

    // -------------------------------------------------------------------------
    // P) Hide "Special Instructions" column header if present
    // -------------------------------------------------------------------------
    try {
      document.querySelectorAll("th").forEach((th) => {
        if ((th.textContent || "").includes("Special Instructions"))
          th.style.display = "none";
      });
    } catch {}

    // -------------------------------------------------------------------------
    // Q) Place order / Back to cart → reset wizard state
    // -------------------------------------------------------------------------
    (function () {
      const placeOrderBtn = document.getElementById("ctl00_PageBody_PlaceOrderButton");
      const backToCartBtn = document.getElementById("ctl00_PageBody_BackToCartButton3");

      function resetWizardState() {
        try {
          localStorage.removeItem(STEP_KEY);
        } catch {}
        try {
          sessionStorage.removeItem("wl_returnStep");
          sessionStorage.removeItem("wl_expect_nav");
          sessionStorage.removeItem("wl_autocopy_done");
          sessionStorage.removeItem(SAME_SESSION_KEY);
        } catch {}
      }

      if (placeOrderBtn) placeOrderBtn.addEventListener("click", resetWizardState);
      if (backToCartBtn) backToCartBtn.addEventListener("click", resetWizardState);
    })();

    // -------------------------------------------------------------------------
    // R) Restore step on load
    // -------------------------------------------------------------------------
    const expectedNav = consumeExpectedNav();
    const returnStep = consumeReturnStep();
    const saved = getStep();
    syncStepVisibility();

    let initial = returnStep || saved || 2;
    if (shouldHideStep(initial)) initial = findNextVisibleStep(initial);

    showStep(initial);

    // Pickup mode: immediately fill delivery from billing (helps system validations)
    if (isPickupSelected()) {
      copyBillingToDeliverySilently();
      syncStepVisibility();
    }

    if (expectedNav) {
      const tryJump = () =>
        window.WLCheckout?.detectAndJumpToValidation?.() === true;
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
