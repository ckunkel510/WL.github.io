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

