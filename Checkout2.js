// ─────────────────────────────────────────────────────────────────────────────
// Woodson WebTrack Checkout Wizard (Modern Flow Rebuild)
// Fixes "kicked back to Step 2" by:
//  - storing a "returnStep" in sessionStorage before any likely postback
//  - restoring that step on reload
//  - avoiding unnecessary step resets
//  - avoiding trigger('change') on WebForms autofills
// ─────────────────────────────────────────────────────────────────────────────
(function () {
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

  window.WLCheckout = window.WLCheckout || {};
  window.WLCheckout.setStep = setStep;
  window.WLCheckout.getStep = getStep;
  window.WLCheckout.setReturnStep = setReturnStep;
  window.WLCheckout.TTL_MS = TTL_MS;

  // ---------------------------------------------------------------------------
  // 1) DOM Ready
  // ---------------------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", function () {
    // jQuery guard (WebTrack usually has it)
    const $ = window.jQuery;

    // -------------------------------------------------------------------------
    // A) Hide legacy UI bits
    // -------------------------------------------------------------------------
    try {
      // Hide the original “Date Required” picker entirely
      const dateColDefault = document.getElementById(
        "ctl00_PageBody_dtRequired_DatePicker_wrapper"
      );
      if (dateColDefault) dateColDefault.style.display = "none";

      // Hide “Date required:” label + wrapper
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

        // Hide default ASP.NET panel of back/continue
        $(".submit-button-panel").hide();
      }

      // Rename secondary back button
      if ($) $("#ctl00_PageBody_BackToCartButton2").val("Back to Cart");
    } catch {}

    // -------------------------------------------------------------------------
    // B) Build wizard container only once
    // -------------------------------------------------------------------------
    const container = document.querySelector(".container");
    if (!container) return;

    // Prevent double-inject
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
    // C) Steps definition (same as yours, just cleaned up)
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
          showStep(num - 1);
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
          showStep(num + 1);
        });
        navDiv.appendChild(next);
      } else {
        // Re-home the Continue button on last step (keep submit)
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
    // E) Step switching + persistence
    // -------------------------------------------------------------------------
    function showStep(n) {
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
    // F) Postback-safe returnStep logic (core fix)
    // -------------------------------------------------------------------------
    // Any of these controls are known to sometimes post back.
    // Before they change/click, we store "return to this step after reload".
    function bindReturnStepFor(selector, stepNum, eventName) {
      const ev = eventName || "change";
      const el = document.querySelector(selector);
      if (!el) return;
      el.addEventListener(
        ev,
        function () {
          setReturnStep(stepNum);
        },
        true // capture so we run before inline/onchange handlers
      );
    }

    // Delivery address dropdowns that often trigger postback
    bindReturnStepFor("#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList", 5, "change");
    bindReturnStepFor("#ctl00_PageBody_DeliveryAddress_CountrySelector", 5, "change");

    // Invoice address dropdowns that often trigger postback
    bindReturnStepFor("#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList", 6, "change");
    bindReturnStepFor("#ctl00_PageBody_InvoiceAddress_CountrySelector1", 6, "change");

    // Branch selector can trigger postback in some templates
    bindReturnStepFor("#ctl00_PageBody_BranchSelector", 4, "change");

    // -------------------------------------------------------------------------
    // G) Delivery summary/edit (Step 5) — keep your UX but avoid postbacks
    // -------------------------------------------------------------------------
    (function () {
      const pane5 = wizard.querySelector('.checkout-step[data-step="5"]');
      if (!pane5) return;

      const col = pane5.querySelector(".epi-form-col-single-checkout");
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

      wrap.style.display = "none";
      col.insertBefore(sum, wrap);

      sum.addEventListener("click", (e) => {
        if (e.target.id !== "editDelivery") return;
        e.preventDefault();
        sum.style.display = "none";
        wrap.style.display = "";
        try {
          wrap.scrollIntoView({ behavior: "smooth" });
        } catch {}

        if (!wrap.querySelector("#saveDelivery")) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.id = "saveDelivery";
          btn.className = "btn btn-primary mt-2";
          btn.textContent = "Save";
          wrap.appendChild(btn);

          btn.addEventListener("click", () => {
            upd();
            wrap.style.display = "none";
            sum.style.display = "";
            setStep(5);
          });
        }
      });

      upd();
    })();

    // -------------------------------------------------------------------------
    // H) Billing address same-as-delivery + summary/edit (Step 6)
    // Key fix: store returnStep=6 BEFORE CopyDeliveryAddress postback
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
      const sumInv = document.createElement("div");
      wrapInv.className = "invoice-inputs";
      sumInv.className = "invoice-summary";

      while (colInv.firstChild) wrapInv.appendChild(colInv.firstChild);
      colInv.appendChild(wrapInv);

      function q(sel) {
        return wrapInv.querySelector(sel);
      }
      function refreshInv() {
        const a1 = (q("#ctl00_PageBody_InvoiceAddress_AddressLine1")?.value || "").trim();
        const a2 = (q("#ctl00_PageBody_InvoiceAddress_AddressLine2")?.value || "").trim();
        const c = (q("#ctl00_PageBody_InvoiceAddress_City")?.value || "").trim();
        const st =
          q("#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList")?.selectedOptions?.[0]
            ?.text || "";
        const z = (q("#ctl00_PageBody_InvoiceAddress_Postcode")?.value || "").trim();
        const e = (q("#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox")?.value || "").trim();

        sumInv.innerHTML = `<strong>Billing Address</strong><br>
          ${a1}${a2 ? "<br>" + a2 : ""}<br>
          ${c}${c && (st || z) ? ", " : ""}${st} ${z}<br>
          Email: ${e}<br>
          <button type="button" id="editInvoice" class="btn btn-link">Enter new billing address</button>`;
      }

      wrapInv.style.display = "none";
      sumInv.style.display = "none";
      colInv.insertBefore(sumInv, wrapInv);

      // Initial state
      const sameStored = getSameAsDelivery();
      sameCheck.checked = sameStored;

      if (sameStored) {
        refreshInv();
        wrapInv.style.display = "none";
        sumInv.style.display = "";
      } else {
        wrapInv.style.display = "";
        sumInv.style.display = "none";
      }

      sameCheck.addEventListener("change", function () {
        if (this.checked) {
          // IMPORTANT: keep them on Step 6 after postback
          setReturnStep(6);
          setSameAsDelivery(true);

          // triggers server copy logic
          try {
            __doPostBack("ctl00$PageBody$CopyDeliveryAddressLinkButton", "");
          } catch {}
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
        try {
          wrapInv.scrollIntoView({ behavior: "smooth" });
        } catch {}
      });

      // If page reloaded after copy, we can refresh summary
      refreshInv();
    })();

    // -------------------------------------------------------------------------
    // I) Prefill delivery address (unchanged logic; but less “pushy”)
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

          $("#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList option").each(function () {
            if ($(this).text().trim().toLowerCase() === state.toLowerCase()) {
              $(this).prop("selected", true);
              return false;
            }
          });
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
          if ($el.length && val) $el.val(val); // no trigger("change")
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
    // K) Step 7: pickup/delivery + special instructions (keeps your logic)
    // Plus: store returnStep=7 before Continue postback attempts
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

      const th = p7.querySelector("th");
      if (th) {
        const opt2 = document.createElement("small");
        opt2.className = "text-muted";
        opt2.style.marginLeft = "8px";
        opt2.textContent = "(optional)";
        th.appendChild(opt2);
      }

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
      function populatePickupTimes(date) {
        const day = date.getDay();
        let openMins = 7 * 60 + 30,
          closeMins;
        if (1 <= day && day <= 5) closeMins = 17 * 60 + 30;
        else if (day === 6) closeMins = 16 * 60;
        else closeMins = openMins + 60;

        pickupTimeSel.innerHTML = "";
        for (let m = openMins; m + 60 <= closeMins; m += 60) {
          const start = formatTime(Math.floor(m / 60), m % 60);
          const end = formatTime(Math.floor((m + 60) / 60), (m + 60) % 60);
          const opt = document.createElement("option");
          opt.value = `${start}–${end}`;
          opt.text = `${start} – ${end}`;
          pickupTimeSel.appendChild(opt);
        }
        pickupTimeSel.disabled = false;
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
          const t = pickupTimeSel.value;
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
      deliveryDiv
        .querySelectorAll('input[name="deliveryTime"]')
        .forEach((r) => r.addEventListener("change", updateSpecial));
      specialExtra.addEventListener("input", updateSpecial);

      onShip();

      // Client validation on Continue buttons (no forced reset to step 2)
      if ($) {
        $("#ctl00_PageBody_ContinueButton1, #ctl00_PageBody_ContinueButton2").on("click", function (e) {
          // We expect a navigation attempt; if it fails (errors), we’ll bounce correctly.
          setReturnStep(7);
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
          }

          if (!valid) {
            e.preventDefault();
            alert("Hold on – we need a bit more info:\n\n" + errors.join("\n"));
            showStep(7);
            setExpectedNav(false);
            return;
          }

          // Safety net: if we remain on page and errors appear, jump to them
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

        const stepNum = paneStepFor(culprit) || 2;
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
    // M) Modern Transaction & Shipping selectors (kept; no forced disabling)
    // -------------------------------------------------------------------------
    if ($) {
      $(function () {
        // Transaction selector
        if ($("#ctl00_PageBody_TransactionTypeDiv").length) {
          $(".TransactionTypeSelector").hide();

          const txnHTML = `
            <div class="modern-transaction-selector d-flex justify-content-around">
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
            $("#ctl00_PageBody_TransactionTypeSelector_rdbOrder").is(":checked") ? "rdbOrder" : "rdbQuote"
          );

          $(document).on("click", ".modern-transaction-selector button", function () {
            updateTransactionStyles($(this).data("value"));
            setStep(1);
          });
        }

        // Shipping selector
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

          function updateShippingStyles(val) {
            const delRad = $("#ctl00_PageBody_SaleTypeSelector_rbDelivered");
            const pickRad = $("#ctl00_PageBody_SaleTypeSelector_rbCollectLater");
            const $btnDelivered = $("#btnDelivered");
            const $btnPickup = $("#btnPickup");

            $btnDelivered.removeClass("disabled opacity-50").removeAttr("disabled").attr("aria-disabled", "false");
            $btnPickup.removeClass("disabled opacity-50").removeAttr("disabled").attr("aria-disabled", "false");

            if (val === "rbDelivered") {
              delRad.prop("checked", true).trigger("change");
              $btnDelivered.addClass("btn-primary").removeClass("btn-secondary opacity-50").attr("aria-pressed", "true");
              $btnPickup.addClass("btn-secondary opacity-50").removeClass("btn-primary").attr("aria-pressed", "false");
              document.cookie = "pickupSelected=false; path=/";
              document.cookie = "skipBack=false; path=/";
            } else {
              pickRad.prop("checked", true).trigger("change");
              $btnPickup.addClass("btn-primary").removeClass("btn-secondary opacity-50").attr("aria-pressed", "true");
              $btnDelivered.addClass("btn-secondary opacity-50").removeClass("btn-primary").attr("aria-pressed", "false");
              document.cookie = "pickupSelected=true; path=/";
              document.cookie = "skipBack=true; path=/";
            }

            setStep(2);
          }

          updateShippingStyles(
            $("#ctl00_PageBody_SaleTypeSelector_rbDelivered").is(":checked") ? "rbDelivered" : "rbCollectLater"
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
        try {
          localStorage.removeItem(STEP_KEY);
        } catch {}
        try {
          sessionStorage.removeItem("wl_returnStep");
          sessionStorage.removeItem("wl_expect_nav");
        } catch {}
      }

      if (placeOrderBtn) placeOrderBtn.addEventListener("click", resetWizardState);
      if (backToCartBtn) backToCartBtn.addEventListener("click", resetWizardState);
    })();

    // -------------------------------------------------------------------------
    // P) Restore step on load (priority order):
    //  1) returnStep (sessionStorage) — for postbacks
    //  2) saved step (TTL localStorage)
    //  3) default 2
    // Then: if expectedNav (continue attempted), scan for errors and bounce.
    // -------------------------------------------------------------------------
    const expectedNav = consumeExpectedNav();
    const returnStep = consumeReturnStep();
    const saved = getStep();
    const initial = returnStep || saved || 2;

    showStep(initial);

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
