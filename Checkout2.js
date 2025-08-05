$(document).ready(function() {
  console.log("Page loaded, initializing custom checkout experience...");

  // ===================================================
  // 0. On Load: Hide specified Delivery and Invoice Address elements.
  // ===================================================
  const deliveryHidden = [
    "#ctl00_PageBody_DeliveryAddress_ContactNameTitleLiteral",
    "label:contains('First name:')",
    "label:contains('Last name:')",
    "#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox",
    "#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox",
    "#ctl00_PageBody_DeliveryAddress_GoogleAddressSearchWrapper",
    "label[for='locationFieldDelivery']",
    "#locationFieldDelivery",
    "#ctl00_PageBody_DeliveryAddress_AddressLine1TitleLiteral",
    "#ctl00_PageBody_DeliveryAddress_AddressLine1",
    "#ctl00_PageBody_DeliveryAddress_AddressLine2TitleLiteral",
    "#ctl00_PageBody_DeliveryAddress_AddressLine2",
    "#ctl00_PageBody_DeliveryAddress_AddressLine3TitleLiteral",
    "#ctl00_PageBody_DeliveryAddress_AddressLine3",
    "#ctl00_PageBody_DeliveryAddress_AddressCityTitleLiteral",
    "#ctl00_PageBody_DeliveryAddress_City",
    "#ctl00_PageBody_DeliveryAddress_AddressCountyTitleLiteral",
    "#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList",
    "#ctl00_PageBody_DeliveryAddress_AddressPostcodeTitleLiteral",
    "#ctl00_PageBody_DeliveryAddress_Postcode",
    "#ctl00_PageBody_DeliveryAddress_AddressCountryTitleLiteral",
    "#ctl00_PageBody_DeliveryAddress_CountrySelector",
    "#ctl00_PageBody_DeliveryAddress_ContactTelephoneRow",
    "#ctl00_PageBody_DeliveryAddress_ContactTelephoneTitleLiteral",
    "#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox",
    "#autocompleteDelivery",
    "#ctl00_PageBody_ContinueButton1"
  ];
  const invoiceHidden = [
    "#ctl00_PageBody_InvoiceAddress_GoogleAddressSearchWrapper",
    "label[for='locationFieldInvoice']",
    "#locationFieldInvoice",
    "#autocompleteInvoice",
    "#ctl00_PageBody_InvoiceAddress_AddressLine1TitleLiteral",
    "#ctl00_PageBody_InvoiceAddress_AddressLine1",
    "#ctl00_PageBody_InvoiceAddress_AddressLine2TitleLiteral",
    "#ctl00_PageBody_InvoiceAddress_AddressLine2",
    "#ctl00_PageBody_InvoiceAddress_AddressLine3TitleLiteral",
    "#ctl00_PageBody_InvoiceAddress_AddressLine3",
    "#ctl00_PageBody_InvoiceAddress_AddressCityTitleLiteral",
    "#ctl00_PageBody_InvoiceAddress_City",
    "#ctl00_PageBody_InvoiceAddress_AddressCountyTitleLiteral",
    "#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList",
    "#ctl00_PageBody_InvoiceAddress_AddressPostcodeTitleLiteral",
    "#ctl00_PageBody_InvoiceAddress_Postcode",
    "#ctl00_PageBody_InvoiceAddress_AddressCountryTitleLiteral",
    "#ctl00_PageBody_InvoiceAddress_CountrySelector1",
    "#ctl00_PageBody_InvoiceAddress_EmailAddressRow",
    "#ctl00_PageBody_InvoiceAddress_EmailAddressTitleLiteral",
    "#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox"
  ];

  // hide them
  $(deliveryHidden.join(", ")).hide();
  $(invoiceHidden.join(", ")).hide();

  // show the rest of your checkout rows
  $('.container .row').not('.shopping-cart-item').show();

  // relabel the copy link
  $("#ctl00_PageBody_CopyDeliveryAddressLinkButton")
    .text("Billing address is the same as delivery address");


  // ===================================================
  // (A) Always-Attached Event Handlers & Helpers
  // ===================================================
  let isEditingDelivery = false;
  let isEditingInvoice  = false;

  function refreshReadOnlyDisplays() {
    // Delivery
    if (!isEditingDelivery) {
      const fn = $("#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox").val();
      const ln = $("#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox").val();
      const a1 = $("#ctl00_PageBody_DeliveryAddress_AddressLine1").val();
      const ct = $("#ctl00_PageBody_DeliveryAddress_City").val();
      const zp = $("#ctl00_PageBody_DeliveryAddress_Postcode").val();
      const htmlDel = `
        <strong>Delivery Address:</strong><br>
        ${fn} ${ln}<br>
        ${a1}<br>
        ${ct}, ${zp}
        <br>
        <button type="button" id="internalEditDeliveryAddressButton" class="edit-button">
          Edit Delivery Address
        </button>
      `;
      $(".selected-address-display").html(htmlDel);
    }

    // Invoice
    if (!isEditingInvoice) {
      const a1 = $("#ctl00_PageBody_InvoiceAddress_AddressLine1").val();
      const ct = $("#ctl00_PageBody_InvoiceAddress_City").val();
      const zp = $("#ctl00_PageBody_InvoiceAddress_Postcode").val();
      const htmlInv = `
        <strong>Invoice Address:</strong><br>
        ${a1}<br>
        ${ct}, ${zp}
        <br>
        <button type="button" id="internalEditInvoiceAddressButton" class="edit-button">
          Edit Invoice Address
        </button>
      `;
      $(".selected-invoice-address-display").html(htmlInv);
    }
  }

  // trigger refresh on any checkout input change
  $(document).on("change blur", ".epi-form-group-checkout input", refreshReadOnlyDisplays);


  // Edit/Save Delivery
  $(document).on("click", "#internalEditDeliveryAddressButton", function() {
    console.log("Edit Delivery clicked");
    isEditingDelivery = true;
    $(deliveryHidden.join(", ")).show();
    if (!$("#saveDeliveryAddressButton").length) {
      $(".selected-address-display")
        .append('<br><button type="button" id="saveDeliveryAddressButton" class="edit-button">Save Delivery Address</button>');
    }
  });
  $(document).on("click", "#saveDeliveryAddressButton", function() {
    console.log("Save Delivery clicked");
    $(deliveryHidden.join(", ")).hide();
    $("#saveDeliveryAddressButton").remove();
    isEditingDelivery = false;
    refreshReadOnlyDisplays();
  });


  // Edit/Save Invoice
  $(document).on("click", "#internalEditInvoiceAddressButton", function() {
    console.log("Edit Invoice clicked");
    isEditingInvoice = true;
    $(invoiceHidden.join(", ")).show();
    if (!$("#saveInvoiceAddressButton").length) {
      $(".selected-invoice-address-display")
        .append('<br><button type="button" id="saveInvoiceAddressButton" class="edit-button">Save Invoice Address</button>');
    }
  });
  $(document).on("click", "#saveInvoiceAddressButton", function() {
    console.log("Save Invoice clicked");
    $(invoiceHidden.join(", ")).hide();
    $("#saveInvoiceAddressButton").remove();
    isEditingInvoice = false;
    refreshReadOnlyDisplays();
  });


  // ===================================================
  // (B) Modern Transaction & Shipping Selectors
  // ===================================================
  if ($("#ctl00_PageBody_TransactionTypeDiv").length) {
    $(".TransactionTypeSelector").hide();
    const txnHTML = `
      <div class="modern-transaction-selector d-flex justify-content-around">
        <button id="btnOrder" class="btn btn-primary" data-value="rdbOrder">
          <i class="fas fa-shopping-cart"></i> Order
        </button>
        <button id="btnQuote" class="btn btn-secondary" data-value="rdbQuote">
          <i class="fas fa-file-alt"></i> Request Quote
        </button>
      </div>
    `;
    $("#ctl00_PageBody_TransactionTypeDiv").append(txnHTML);

    function updateTransactionStyles(val) {
      console.log(`Transaction type updated: ${val}`);
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

    // init & click
    updateTransactionStyles(
      $("#ctl00_PageBody_TransactionTypeSelector_rdbOrder").is(":checked") ? "rdbOrder" : "rdbQuote"
    );
    $(document).on("click", ".modern-transaction-selector button", function() {
      updateTransactionStyles($(this).data("value"));
    });
  } else {
    console.warn("Transaction type div not found.");
  }


  if ($(".SaleTypeSelector").length) {
    $(".SaleTypeSelector").hide();
    const shipHTML = `
      <div class="modern-shipping-selector d-flex justify-content-around">
        <button id="btnDelivered" class="btn btn-primary" data-value="rbDelivered">
          <i class="fas fa-truck"></i> Delivered
        </button>
        <button id="btnPickup" class="btn btn-secondary" data-value="rbCollectLater">
          <i class="fas fa-store"></i> Pickup (Free)
        </button>
      </div>
    `;
    $(".epi-form-col-single-checkout:has(.SaleTypeSelector)").append(shipHTML);

    function updateShippingStyles(val) {
      console.log(`Shipping method updated: ${val}`);
      const delRad = $("#ctl00_PageBody_SaleTypeSelector_rbDelivered");
      const pickRad = $("#ctl00_PageBody_SaleTypeSelector_rbCollectLater");
      if (val === "rbDelivered") {
        delRad.prop("checked", true);
        $("#btnDelivered").addClass("btn-primary").removeClass("btn-secondary");
        $("#btnPickup").addClass("btn-secondary").removeClass("btn-primary");
      } else {
        pickRad.prop("checked", true);
        $("#btnPickup").addClass("btn-primary").removeClass("btn-secondary");
        $("#btnDelivered").addClass("btn-secondary").removeClass("btn-primary");
        refreshReadOnlyDisplays();
      }
    }

    updateShippingStyles(
      $("#ctl00_PageBody_SaleTypeSelector_rbDelivered").is(":checked") ? "rbDelivered" : "rbCollectLater"
    );
    $(document).on("click", ".modern-shipping-selector button", function() {
      updateShippingStyles($(this).data("value"));
    });
  } else {
    console.warn("Shipping method selector not found.");
  }


  // ===================================================
  // (C) INITIAL PRE-POPULATION LOGIC
  // ===================================================
  if (!$("#ctl00_PageBody_DeliveryAddress_AddressLine1").val()) {
    console.log("Initial address pre-population running...");
    const $link = $("#ctl00_PageBody_CustomerAddressSelector_SelectAddressLinkButton");
    if ($link.length) {
      let $entries = $(".AddressSelectorEntry");
      if ($entries.length) {
        // find smallest ID
        let $pick = $entries.first();
        let minId = parseInt($pick.find(".AddressId").text(), 10);
        $entries.each(function() {
          const id = +$(this).find(".AddressId").text();
          if (id < minId) { minId = id; $pick = $(this); }
        });
        // parse text
        const txt = $pick.find("dd p").first().text().trim();
        const parts = txt.split(",").map(s => s.trim());
        const [line1='', city=''] = parts;
        let state = '', zip = '';
        if (parts.length >= 4) {
          state = parts[parts.length-2];
          zip   = parts[parts.length-1];
        } else if (parts.length>2) {
          const m = parts[2].match(/(.+?)\s*(\d{5}(?:-\d{4})?)?$/);
          if (m) { state = m[1].trim(); zip = m[2]||''; }
        }
        console.log(`Parsed Address: ${line1}, ${city}, ${state}, ${zip}`);
        $("#ctl00_PageBody_DeliveryAddress_AddressLine1").val(line1);
        $("#ctl00_PageBody_DeliveryAddress_City").val(city);
        $("#ctl00_PageBody_DeliveryAddress_Postcode").val(zip);
        $("#ctl00_PageBody_DeliveryAddress_CountrySelector").val("USA");
        $("#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList option").each(function() {
          if ($(this).text().trim().toLowerCase() === state.toLowerCase()) {
            $(this).prop("selected", true);
            return false;
          }
        });
      }
    } else {
      console.warn("Address selector link button not found.");
    }
  } else {
    console.log("Address pre-population skipped; field not empty.");
  }


  // ===================================================
  // (D) ALWAYS RUN: Account Settings & Telephone Fetch
  // ===================================================
  $.get("https://webtrack.woodsonlumber.com/AccountSettings.aspx", function(data) {
    const $acc = $(data);
    const fn = $acc.find("#ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput").val() || "";
    const ln = $acc.find("#ctl00_PageBody_ChangeUserDetailsControl_LastNameInput").val() || "";
    let email = $acc.find("#ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput").val() || "";
    email = email.replace(/^\([^)]*\)\s*/, "");
    console.log("Fetched account settings:", fn, ln, email);
    $("#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox").val(fn);
    $("#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox").val(ln);
    $("#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox").val(email);
    refreshReadOnlyDisplays();
  });
  $.get("https://webtrack.woodsonlumber.com/AccountInfo_R.aspx", function(data) {
    const tel = $(data).find("#ctl00_PageBody_TelephoneLink_TelephoneLink").text().trim();
    console.log("Fetched telephone:", tel);
    $("#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox").val(tel);
    refreshReadOnlyDisplays();
  });


  // ===================================================
  // (E) Append Read-Only Display Containers
  // ===================================================
  const $cols = $(".epi-form-col-single-checkout");
  if ($cols.length >= 7) {
    if (!$cols.eq(5).find(".selected-address-display").length) {
      $cols.eq(5).append(`
        <div class="selected-address-display">
          <strong>Delivery Address:</strong><br>
          <button type="button" id="internalEditDeliveryAddressButton" class="edit-button">
            Edit Delivery Address
          </button>
        </div>
      `);
    }
    if (!$cols.eq(6).find(".selected-invoice-address-display").length) {
      $cols.eq(6).append(`
        <div class="selected-invoice-address-display">
          <strong>Invoice Address:</strong><br>
          <button type="button" id="internalEditInvoiceAddressButton" class="edit-button">
            Edit Invoice Address
          </button>
        </div>
      `);
    }
    refreshReadOnlyDisplays();
  } else {
    console.warn("Not enough .epi-form-col-single-checkout elements found.");
  }


  // ===================================================
  // (F) Date Picker (unchanged)
  // ===================================================
  if ($("#ctl00_PageBody_dtRequired_DatePicker_wrapper").length) {
    console.log("Date selector found, no modifications made.");
  } else {
    console.warn("Date picker wrapper not found.");
  }
});
















(function () {
  if (window.CheckoutUI) return; // guard
  window.CheckoutUI = {
    sections: {},

    // --- Utilities ---
    q: (sel) => (Array.isArray(sel) ? sel.find(s => s && document.querySelector(s)) : sel),
    getVal(sel) {
      const s = this.q(sel); if (!s) return "";
      const el = document.querySelector(s);
      return el ? (el.value ?? "").toString().trim() : "";
    },
    setVal(sel, v) {
      const s = this.q(sel); if (!s) return;
      const el = document.querySelector(s);
      if (el) { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }
    },
    setChecked(sel, checked) {
      const s = this.q(sel); if (!s) return;
      const el = document.querySelector(s);
      if (el) { el.checked = !!checked; el.dispatchEvent(new Event("change", { bubbles: true })); }
    },
    setStatus(key, ok) {
      const el = document.getElementById(`status-${key}`);
      if (!el) return;
      el.textContent = ok ? "✓" : "✗";
      el.classList.toggle("ok", ok);
      el.classList.toggle("bad", !ok);
    },
    openDrawer(title, bodyHTML, onSave) {
      const overlay = document.getElementById("coDrawerOverlay");
      const drawer  = document.getElementById("coDrawer");
      document.getElementById("coDrawerTitle").textContent = title;
      const body = document.getElementById("coDrawerBody");
      body.innerHTML = bodyHTML;
      drawer.dataset.saveHandlerId = String(Date.now());
      this._currentSave = onSave || null;
      overlay.classList.add("active");
      drawer.classList.add("active");
    },
    closeDrawer(saved) {
      const overlay = document.getElementById("coDrawerOverlay");
      const drawer  = document.getElementById("coDrawer");
      overlay.classList.remove("active");
      drawer.classList.remove("active");
      if (saved && typeof this._currentSave === "function") this._currentSave();
      this._currentSave = null;
      this.refreshAll();
    },

    // Register a section card
    addSection({ key, title, render, complete }) {
      this.sections[key] = { render, complete };

      const container = document.getElementById("checkoutSummaryPanel");
      if (!container) return;

      if (!document.getElementById(`card-${key}`)) {
        const wrap = document.createElement("div");
        wrap.className = "checkout-summary-section";
        wrap.id = `card-${key}`;
        wrap.dataset.section = key;
        wrap.innerHTML = `
          <div class="section-title-row">
            <span class="section-status" id="status-${key}">•</span>
            <h3>${title}</h3>
          </div>
          <p id="summary-${key}">Loading...</p>
          <button class="edit-button" data-edit="${key}">Edit</button>
        `;
        container.appendChild(wrap);
      }
      this.refreshOne(key);
    },

    refreshOne(key) {
      const sec = this.sections[key];
      if (!sec) return;
      const txt = sec.render();
      const ok  = !!sec.complete(txt);
      const p   = document.getElementById(`summary-${key}`);
      if (p) p.textContent = txt || "Not provided";
      this.setStatus(key, ok);
    },

    refreshAll() {
      Object.keys(this.sections).forEach(k => this.refreshOne(k));
    }
  };

  // --- CSS (move to your stylesheet later) ---
  const css = `
    .checkout-layout-wrapper{display:flex;gap:2rem;margin-bottom:2rem;flex-wrap:wrap}
    .checkout-summary-panel{flex:1 1 340px;min-width:320px;background:#fdfdfd;border:1px solid #e7e7e7;border-radius:12px;padding:1.25rem 1.25rem .25rem;box-shadow:0 2px 16px rgba(0,0,0,.04)}
    .checkout-summary-panel h2{color:#6b0016;margin:0 0 .75rem;font-size:1.15rem}
    .checkout-summary-section{border-top:1px dashed #e0e0e0;padding:.9rem 0}
    .checkout-summary-section:first-of-type{border-top:0}
    .section-title-row{display:flex;gap:.5rem;align-items:center}
    .section-status{font-weight:700;font-size:.95rem}
    .section-status.ok{color:#148a00}.section-status.bad{color:#c7002a}
    .checkout-summary-section p{margin:.25rem 0 0;font-size:.9rem;color:#444;line-height:1.35;white-space:pre-line}
    .edit-button{margin-top:.5rem;font-size:.85rem;background:#6b0016;color:#fff;border:none;padding:.42rem .8rem;border-radius:6px;cursor:pointer}
    .edit-button:hover{background:#8d8d8d}

    /* Drawer (right) */
    #coDrawerOverlay{display:none}
    #coDrawerOverlay.active{display:block;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9998}
    #coDrawer{display:none}
    #coDrawer.active{display:block;position:fixed;top:64px;right:16px;width:440px;height:calc(100vh - 80px);background:#fff;z-index:9999;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);padding:1rem;overflow:auto}
    #coDrawer .modal-header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #eee;padding-bottom:.5rem;margin-bottom:.75rem}
    #coDrawer .modal-header h3{margin:0;color:#6b0016;font-size:1.05rem}
    #coDrawer .modal-actions{display:flex;gap:.5rem;justify-content:flex-end;margin-top:1rem}
    .btn-secondary{background:transparent;color:#6b0016;border:1px solid #6b0016;padding:.4rem .75rem;border-radius:6px;cursor:pointer}
    .btn-secondary:hover{background:#6b0016;color:#fff}
    .form-row{margin-bottom:.75rem}
    .form-row label{display:block;font-size:.85rem;color:#333;margin-bottom:.25rem}
    .form-row input,.form-row textarea,.form-row select{width:100%;padding:.55rem .6rem;border:1px solid #ccc;border-radius:6px;font-size:.92rem}
    .input-grid{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}
    .input-grid .full{grid-column:1 / -1}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // --- Summary shell + Drawer DOM ---
  const shell = `
    <div class="checkout-layout-wrapper">
      <div class="checkout-summary-panel" id="checkoutSummaryPanel">
        <h2>Your Order Summary</h2>
        <!-- sections will be appended here -->
      </div>
    </div>
    <div id="coDrawerOverlay"></div>
    <div id="coDrawer">
      <div class="modal-header">
        <h3 id="coDrawerTitle">Edit</h3>
        <button class="btn-secondary" id="coDrawerClose">Close</button>
      </div>
      <div id="coDrawerBody"></div>
      <div class="modal-actions">
        <button class="btn-secondary" id="coDrawerCancel">Cancel</button>
        <button class="edit-button" id="coDrawerSave">Save</button>
      </div>
    </div>
  `;
  // Insert just before the transaction type block if present, else at top of form
  const txnDiv = document.querySelector("#ctl00_PageBody_TransactionTypeDiv");
  if (txnDiv) txnDiv.insertAdjacentHTML("beforebegin", shell);
  else document.body.insertAdjacentHTML("afterbegin", shell);

  // Drawer wiring
  document.getElementById("coDrawerOverlay").addEventListener("click", () => CheckoutUI.closeDrawer(false));
  document.getElementById("coDrawerClose").addEventListener("click", () => CheckoutUI.closeDrawer(false));
  document.getElementById("coDrawerCancel").addEventListener("click", () => CheckoutUI.closeDrawer(false));
  document.getElementById("coDrawerSave").addEventListener("click", () => CheckoutUI.closeDrawer(true));

  // Global edit button handler
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".edit-button[data-edit]");
    if (!btn) return;
    const key = btn.getAttribute("data-edit");
    // Each module's "open editor" will call CheckoutUI.openDrawer(...)
    const evt = new CustomEvent("co:openEditor", { detail: { key } });
    document.dispatchEvent(evt);
  });
})();

