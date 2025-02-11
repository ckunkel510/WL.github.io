$(document).ready(function() {
  console.log("Page loaded, initializing custom checkout experience...");

  // ===================================================
  // 0. On Load: Hide specified Delivery and Invoice Address elements.
  // ===================================================
  // Delivery Address elements to hide (including the additional CopyDeliveryAddressLinkButton)
  $(
    "#ctl00_PageBody_DeliveryAddress_ContactNameTitleLiteral, " +
    "label:contains('First name:'), " +
    "label:contains('Last name:'), " +
    "#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox, " +
    "#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox, " +
    "#ctl00_PageBody_DeliveryAddress_GoogleAddressSearchWrapper, " +
    "label[for='locationFieldDelivery'], " +
    "#locationFieldDelivery, " +
    "#ctl00_PageBody_DeliveryAddress_AddressLine1TitleLiteral, " +
    "#ctl00_PageBody_DeliveryAddress_AddressLine1, " +
    "#ctl00_PageBody_DeliveryAddress_AddressLine2TitleLiteral, " +
    "#ctl00_PageBody_DeliveryAddress_AddressLine2, " +
    "#ctl00_PageBody_DeliveryAddress_AddressLine3TitleLiteral, " +
    "#ctl00_PageBody_DeliveryAddress_AddressLine3, " +
    "#ctl00_PageBody_DeliveryAddress_AddressCityTitleLiteral, " +
    "#ctl00_PageBody_DeliveryAddress_City, " +
    "#ctl00_PageBody_DeliveryAddress_AddressCountyTitleLiteral, " +
    "#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList, " +
    "#ctl00_PageBody_DeliveryAddress_AddressPostcodeTitleLiteral, " +
    "#ctl00_PageBody_DeliveryAddress_Postcode, " +
    "#ctl00_PageBody_DeliveryAddress_AddressCountryTitleLiteral, " +
    "#ctl00_PageBody_DeliveryAddress_CountrySelector, " +
    "#ctl00_PageBody_DeliveryAddress_ContactTelephoneRow, " +
    "#ctl00_PageBody_DeliveryAddress_ContactTelephoneTitleLiteral, " +
    "#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox, " +
    "#autocompleteDelivery"
  ).css("display", "none");

  // Invoice Address elements to hide:
  $(
    "#ctl00_PageBody_InvoiceAddress_GoogleAddressSearchWrapper, " +
    "label[for='locationFieldInvoice'], " +
    "#locationFieldInvoice, " +
    "#autocompleteInvoice, " +
    "#ctl00_PageBody_InvoiceAddress_AddressLine1TitleLiteral, " +
    "#ctl00_PageBody_InvoiceAddress_AddressLine1, " +
    "#ctl00_PageBody_InvoiceAddress_AddressLine2TitleLiteral, " +
    "#ctl00_PageBody_InvoiceAddress_AddressLine2, " +
    "#ctl00_PageBody_InvoiceAddress_AddressLine3TitleLiteral, " +
    "#ctl00_PageBody_InvoiceAddress_AddressLine3, " +
    "#ctl00_PageBody_InvoiceAddress_AddressCityTitleLiteral, " +
    "#ctl00_PageBody_InvoiceAddress_City, " +
    "#ctl00_PageBody_InvoiceAddress_AddressCountyTitleLiteral, " +
    "#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList, " +
    "#ctl00_PageBody_InvoiceAddress_AddressPostcodeTitleLiteral, " +
    "#ctl00_PageBody_InvoiceAddress_Postcode, " +
    "#ctl00_PageBody_InvoiceAddress_AddressCountryTitleLiteral, " +
    "#ctl00_PageBody_InvoiceAddress_CountrySelector1, " +
    "#ctl00_PageBody_InvoiceAddress_EmailAddressRow, " +
    "#ctl00_PageBody_InvoiceAddress_EmailAddressTitleLiteral, " +
    "#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox"
  ).css("display", "none");

  // ===================================================
  // (A) Always-Attached Event Handlers & Helper Functions
  // ===================================================
  var isEditingDelivery = false;
  var isEditingInvoice = false;

  // refreshReadOnlyDisplays() updates the read-only displays from current input values.
  function refreshReadOnlyDisplays() {
    // Only update Delivery display if not editing.
    if (!isEditingDelivery) {
      var delFirstName = $("#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox").val();
      var delLastName  = $("#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox").val();
      var delAddress   = $("#ctl00_PageBody_DeliveryAddress_AddressLine1").val();
      var delCity      = $("#ctl00_PageBody_DeliveryAddress_City").val();
      var delZip       = $("#ctl00_PageBody_DeliveryAddress_Postcode").val();
      var delDisplay   = "<strong>Delivery Address:</strong><br>" +
                         delFirstName + " " + delLastName + "<br>" +
                         delAddress + "<br>" +
                         delCity + ", " + delZip;
      $(".selected-address-display").html(delDisplay +
        '<br><button type="button" id="internalEditDeliveryAddressButton" class="edit-button">Edit Delivery Address</button>');
    }
    // Always update Invoice display if not editing.
    if (!isEditingInvoice) {
      var invAddress   = $("#ctl00_PageBody_InvoiceAddress_AddressLine1").val();
      var invCity      = $("#ctl00_PageBody_InvoiceAddress_City").val();
      var invZip       = $("#ctl00_PageBody_InvoiceAddress_Postcode").val();
      var invDisplay   = "<strong>Invoice Address:</strong><br>" +
                         invAddress + "<br>" +
                         invCity + ", " + invZip;
      $(".selected-invoice-address-display").html(invDisplay +
        '<br><button type="button" id="internalEditInvoiceAddressButton" class="edit-button">Edit Invoice Address</button>');
    }
  }

  // Update read-only displays on input change/blur.
  $(".epi-form-group-checkout input").on("change blur", refreshReadOnlyDisplays);

  // Internal Edit Delivery Address: Reveal hidden Delivery Address elements and add Save button.
  $(document).on("click", "#internalEditDeliveryAddressButton", function() {
    console.log("Internal Edit Delivery Address button clicked.");
    isEditingDelivery = true;
    $("#ctl00_PageBody_DeliveryAddress_ContactNameTitleLiteral, " +
      "label:contains('First name:'), " +
      "label:contains('Last name:'), " +
      "#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox, " +
      "#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox, " +
      "#ctl00_PageBody_DeliveryAddress_GoogleAddressSearchWrapper, " +
      "label[for='locationFieldDelivery'], " +
      "#locationFieldDelivery, " +
      "#ctl00_PageBody_DeliveryAddress_AddressLine1TitleLiteral, " +
      "#ctl00_PageBody_DeliveryAddress_AddressLine1, " +
      "#ctl00_PageBody_DeliveryAddress_AddressLine2TitleLiteral, " +
      "#ctl00_PageBody_DeliveryAddress_AddressLine2, " +
      "#ctl00_PageBody_DeliveryAddress_AddressLine3TitleLiteral, " +
      "#ctl00_PageBody_DeliveryAddress_AddressLine3, " +
      "#ctl00_PageBody_DeliveryAddress_AddressCityTitleLiteral, " +
      "#ctl00_PageBody_DeliveryAddress_City, " +
      "#ctl00_PageBody_DeliveryAddress_AddressCountyTitleLiteral, " +
      "#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList, " +
      "#ctl00_PageBody_DeliveryAddress_AddressPostcodeTitleLiteral, " +
      "#ctl00_PageBody_DeliveryAddress_Postcode, " +
      "#ctl00_PageBody_DeliveryAddress_AddressCountryTitleLiteral, " +
      "#ctl00_PageBody_DeliveryAddress_CountrySelector, " +
      "#ctl00_PageBody_DeliveryAddress_ContactTelephoneRow, " +
      "#ctl00_PageBody_DeliveryAddress_ContactTelephoneTitleLiteral, " +
      "#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox, " +
      "#autocompleteDelivery"
    ).css("display", "inline-block");
    // Append Save button if not present.
    if ($("#saveDeliveryAddressButton").length === 0) {
      $(".selected-address-display").append(
        '<br><button type="button" id="saveDeliveryAddressButton" class="edit-button">Save Delivery Address</button>'
      );
    }
  });

  // Save Delivery Address: Hide the Delivery Address elements and remove the Save button.
  $(document).on("click", "#saveDeliveryAddressButton", function() {
    console.log("Save Delivery Address button clicked.");
    $("#ctl00_PageBody_DeliveryAddress_ContactNameTitleLiteral, " +
      "label:contains('First name:'), " +
      "label:contains('Last name:'), " +
      "#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox, " +
      "#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox, " +
      "#ctl00_PageBody_DeliveryAddress_GoogleAddressSearchWrapper, " +
      "label[for='locationFieldDelivery'], " +
      "#locationFieldDelivery, " +
      "#ctl00_PageBody_DeliveryAddress_AddressLine1TitleLiteral, " +
      "#ctl00_PageBody_DeliveryAddress_AddressLine1, " +
      "#ctl00_PageBody_DeliveryAddress_AddressLine2TitleLiteral, " +
      "#ctl00_PageBody_DeliveryAddress_AddressLine2, " +
      "#ctl00_PageBody_DeliveryAddress_AddressLine3TitleLiteral, " +
      "#ctl00_PageBody_DeliveryAddress_AddressLine3, " +
      "#ctl00_PageBody_DeliveryAddress_AddressCityTitleLiteral, " +
      "#ctl00_PageBody_DeliveryAddress_City, " +
      "#ctl00_PageBody_DeliveryAddress_AddressCountyTitleLiteral, " +
      "#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList, " +
      "#ctl00_PageBody_DeliveryAddress_AddressPostcodeTitleLiteral, " +
      "#ctl00_PageBody_DeliveryAddress_Postcode, " +
      "#ctl00_PageBody_DeliveryAddress_AddressCountryTitleLiteral, " +
      "#ctl00_PageBody_DeliveryAddress_CountrySelector, " +
      "#ctl00_PageBody_DeliveryAddress_ContactTelephoneRow, " +
      "#ctl00_PageBody_DeliveryAddress_ContactTelephoneTitleLiteral, " +
      "#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox, " +
      "#autocompleteDelivery"
    ).css("display", "none");
    $("#saveDeliveryAddressButton").remove();
    isEditingDelivery = false;
    refreshReadOnlyDisplays();
  });

  // Internal Edit Invoice Address: Reveal hidden Invoice Address elements and add Save button.
  $(document).on("click", "#internalEditInvoiceAddressButton", function() {
    console.log("Internal Edit Invoice Address button clicked.");
    isEditingInvoice = true;
    $("#ctl00_PageBody_InvoiceAddress_GoogleAddressSearchWrapper, " +
      "label[for='locationFieldInvoice'], " +
      "#locationFieldInvoice, " +
      "#autocompleteInvoice, " +
      "#ctl00_PageBody_InvoiceAddress_AddressLine1TitleLiteral, " +
      "#ctl00_PageBody_InvoiceAddress_AddressLine1, " +
      "#ctl00_PageBody_InvoiceAddress_AddressLine2TitleLiteral, " +
      "#ctl00_PageBody_InvoiceAddress_AddressLine2, " +
      "#ctl00_PageBody_InvoiceAddress_AddressLine3TitleLiteral, " +
      "#ctl00_PageBody_InvoiceAddress_AddressLine3, " +
      "#ctl00_PageBody_InvoiceAddress_AddressCityTitleLiteral, " +
      "#ctl00_PageBody_InvoiceAddress_City, " +
      "#ctl00_PageBody_InvoiceAddress_AddressCountyTitleLiteral, " +
      "#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList, " +
      "#ctl00_PageBody_InvoiceAddress_AddressPostcodeTitleLiteral, " +
      "#ctl00_PageBody_InvoiceAddress_Postcode, " +
      "#ctl00_PageBody_InvoiceAddress_AddressCountryTitleLiteral, " +
      "#ctl00_PageBody_InvoiceAddress_CountrySelector1, " +
      "#ctl00_PageBody_InvoiceAddress_EmailAddressRow, " +
      "#ctl00_PageBody_InvoiceAddress_EmailAddressTitleLiteral, " +
      "#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox"
    ).css("display", "inline-block");
    if ($("#saveInvoiceAddressButton").length === 0) {
      $(".selected-invoice-address-display").append(
        '<br><button type="button" id="saveInvoiceAddressButton" class="edit-button">Save Invoice Address</button>'
      );
    }
  });

  // Save Invoice Address: Hide the Invoice Address elements and remove the Save button.
  $(document).on("click", "#saveInvoiceAddressButton", function() {
    console.log("Save Invoice Address button clicked.");
    $("#ctl00_PageBody_InvoiceAddress_GoogleAddressSearchWrapper, " +
      "label[for='locationFieldInvoice'], " +
      "#locationFieldInvoice, " +
      "#autocompleteInvoice, " +
      "#ctl00_PageBody_InvoiceAddress_AddressLine1TitleLiteral, " +
      "#ctl00_PageBody_InvoiceAddress_AddressLine1, " +
      "#ctl00_PageBody_InvoiceAddress_AddressLine2TitleLiteral, " +
      "#ctl00_PageBody_InvoiceAddress_AddressLine2, " +
      "#ctl00_PageBody_InvoiceAddress_AddressLine3TitleLiteral, " +
      "#ctl00_PageBody_InvoiceAddress_AddressLine3, " +
      "#ctl00_PageBody_InvoiceAddress_AddressCityTitleLiteral, " +
      "#ctl00_PageBody_InvoiceAddress_City, " +
      "#ctl00_PageBody_InvoiceAddress_AddressCountyTitleLiteral, " +
      "#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList, " +
      "#ctl00_PageBody_InvoiceAddress_AddressPostcodeTitleLiteral, " +
      "#ctl00_PageBody_InvoiceAddress_Postcode, " +
      "#ctl00_PageBody_InvoiceAddress_AddressCountryTitleLiteral, " +
      "#ctl00_PageBody_InvoiceAddress_CountrySelector1, " +
      "#ctl00_PageBody_InvoiceAddress_EmailAddressRow, " +
      "#ctl00_PageBody_InvoiceAddress_EmailAddressTitleLiteral, " +
      "#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox"
    ).css("display", "none");
    $("#saveInvoiceAddressButton").remove();
    isEditingInvoice = false;
    refreshReadOnlyDisplays();
  });

  // ===================================================
  // (B) Modern Buttons for Transaction Type & Shipping Method (Always Run)
  // ===================================================
  if ($("#ctl00_PageBody_TransactionTypeDiv").length) {
    $(".TransactionTypeSelector").hide();
    const modernTransactionSelector = `
      <div class="modern-transaction-selector d-flex justify-content-around">
        <button id="btnOrder" class="btn btn-primary" data-value="rdbOrder">
          <i class="fas fa-shopping-cart"></i> Order
        </button>
        <button id="btnQuote" class="btn btn-secondary" data-value="rdbQuote">
          <i class="fas fa-file-alt"></i> Request Quote
        </button>
      </div>
    `;
    $("#ctl00_PageBody_TransactionTypeDiv").append(modernTransactionSelector);
    function updateTransactionStyles(selectedValue) {
      console.log(`Transaction type updated: ${selectedValue}`);
      if (selectedValue === "rdbOrder") {
        $("#ctl00_PageBody_TransactionTypeSelector_rdbOrder").prop("checked", true);
        $("#btnOrder").removeClass("btn-secondary").addClass("btn-primary");
        $("#btnQuote").removeClass("btn-primary").addClass("btn-secondary");
      } else if (selectedValue === "rdbQuote") {
        $("#ctl00_PageBody_TransactionTypeSelector_rdbQuote").prop("checked", true);
        $("#btnQuote").removeClass("btn-secondary").addClass("btn-primary");
        $("#btnOrder").removeClass("btn-primary").addClass("btn-secondary");
      }
    }
    if ($("#ctl00_PageBody_TransactionTypeSelector_rdbOrder").is(":checked")) {
      updateTransactionStyles("rdbOrder");
    } else if ($("#ctl00_PageBody_TransactionTypeSelector_rdbQuote").is(":checked")) {
      updateTransactionStyles("rdbQuote");
    }
    $(".modern-transaction-selector button").on("click", function() {
      updateTransactionStyles($(this).data("value"));
    });
  } else {
    console.warn("Transaction type div not found.");
  }

  if ($(".SaleTypeSelector").length) {
    $(".SaleTypeSelector").hide();
    const modernShippingSelector = `
      <div class="modern-shipping-selector d-flex justify-content-around">
        <button id="btnDelivered" class="btn btn-primary" data-value="rbDelivered">
          <i class="fas fa-truck"></i> Delivered
        </button>
        <button id="btnPickup" class="btn btn-secondary" data-value="rbCollectLater">
          <i class="fas fa-store"></i> Pickup (Free)
        </button>
      </div>
    `;
    $(".epi-form-col-single-checkout:has(.SaleTypeSelector)").append(modernShippingSelector);
    function updateShippingStyles(selectedValue) {
      console.log(`Shipping method updated: ${selectedValue}`);
      if (selectedValue === "rbDelivered") {
        $("#ctl00_PageBody_SaleTypeSelector_rbDelivered").prop("checked", true);
        $("#btnDelivered").removeClass("btn-secondary").addClass("btn-primary");
        $("#btnPickup").removeClass("btn-primary").addClass("btn-secondary");
      } else if (selectedValue === "rbCollectLater") {
        $("#ctl00_PageBody_SaleTypeSelector_rbCollectLater").prop("checked", true);
        $("#btnPickup").removeClass("btn-secondary").addClass("btn-primary");
        $("#btnDelivered").removeClass("btn-primary").addClass("btn-secondary");
        $("#billingAddressRadio").prop("checked", true).trigger("change");
      }
    }
    if ($("#ctl00_PageBody_SaleTypeSelector_rbDelivered").is(":checked")) {
      updateShippingStyles("rbDelivered");
    } else if ($("#ctl00_PageBody_SaleTypeSelector_rbCollectLater").is(":checked")) {
      updateShippingStyles("rbCollectLater");
    }
    $(".modern-shipping-selector button").on("click", function() {
      updateShippingStyles($(this).data("value"));
    });
  } else {
    console.warn("Shipping method selector not found.");
  }

  // ===================================================
  // (C) INITIAL PRE-POPULATION LOGIC – Runs only if Delivery Address is empty.
  // ===================================================
  if ($("#ctl00_PageBody_DeliveryAddress_AddressLine1").val() === "") {
    console.log("Initial address pre-population running...");
    if ($("#ctl00_PageBody_CustomerAddressSelector_SelectAddressLinkButton").length) {
      var $addressEntries = $(".AddressSelectorEntry");
      if ($addressEntries.length > 0) {
        var smallestIdEntry = $addressEntries.first();
        var smallestId = parseInt(smallestIdEntry.find(".AddressId").text().trim(), 10);
        $addressEntries.each(function() {
          var currentId = parseInt($(this).find(".AddressId").text().trim(), 10);
          if (currentId < smallestId) {
            smallestId = currentId;
            smallestIdEntry = $(this);
          }
        });
        var shippingAddress = smallestIdEntry.find("dd p").first().text().trim();
        console.log("Pre-populated shipping address:", shippingAddress);
        var parts = shippingAddress.split(",").map(function(s) { return s.trim(); });
        var addrLine1 = parts[0] || "";
        var city = parts[1] || "";
        var state = "";
        var zip = "";
        if (parts.length >= 4) {
          state = parts[parts.length - 2];
          zip = parts[parts.length - 1];
        } else if (parts.length > 2) {
          var m = parts[2].match(/(.+?)\s*(\d{5}(?:-\d{4})?)?$/);
          if (m) {
            state = m[1].trim();
            zip = m[2] || "";
          }
        }
        console.log("Parsed Address: Line1=" + addrLine1 + ", City=" + city + ", State=" + state + ", Zip=" + zip);
        $("#ctl00_PageBody_DeliveryAddress_AddressLine1").val(addrLine1);
        $("#ctl00_PageBody_DeliveryAddress_City").val(city);
        $("#ctl00_PageBody_DeliveryAddress_Postcode").val(zip);
        $("#ctl00_PageBody_DeliveryAddress_CountrySelector").val("USA");
        var $stateSelect = $("#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList");
        if ($stateSelect.length) {
          $stateSelect.find("option").each(function() {
            if ($(this).text().trim().toLowerCase() === state.toLowerCase()) {
              $(this).prop("selected", true);
              return false;
            }
          });
        }
      }
    } else {
      console.warn("Address selector link button not found.");
    }
  } else {
    console.log("Address pre-population skipped because Delivery Address field is not empty.");
  }

  // ===================================================
  // (D) ALWAYS RUN: Account Settings & Telephone Fetch
  // ===================================================
  $.get("https://webtrack.woodsonlumber.com/AccountSettings.aspx", function(data) {
    var $acc = $(data);
    var firstName = $acc.find("#ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput").val() || "";
    var lastName  = $acc.find("#ctl00_PageBody_ChangeUserDetailsControl_LastNameInput").val() || "";
    var emailStr  = $acc.find("#ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput").val() || "";
    var parsedEmail = emailStr.replace(/^\([^)]*\)\s*/, "");
    console.log("Fetched account settings:", firstName, lastName, parsedEmail);
    $("#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox").val(firstName);
    $("#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox").val(lastName);
    $("#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox").val(parsedEmail);
    refreshReadOnlyDisplays();
  });
  $.get("https://webtrack.woodsonlumber.com/AccountInfo_R.aspx", function(data) {
    var tel = $(data).find("#ctl00_PageBody_TelephoneLink_TelephoneLink").text().trim();
    console.log("Fetched telephone:", tel);
    $("#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox").val(tel);
    refreshReadOnlyDisplays();
  });

  // ===================================================
  // (E) Append Read-Only Display Containers (if not already present)
  // ===================================================
  var $checkoutDivs = $(".epi-form-col-single-checkout");
  if ($checkoutDivs.length >= 7) {
    if ($checkoutDivs.eq(5).find(".selected-address-display").length === 0) {
      $checkoutDivs.eq(5).append(`
        <div class="selected-address-display">
          <strong>Delivery Address:</strong><br>
          <button type="button" id="internalEditDeliveryAddressButton" class="edit-button">Edit Delivery Address</button>
        </div>
      `);
    }
    if ($checkoutDivs.eq(6).find(".billing-address-section").length === 0) {
      $checkoutDivs.eq(6).append(`
        <div class="billing-address-section">
          <label>
            <input type="radio" id="billingAddressRadio" name="billingAddressOption">
            Billing address is the same as delivery address
          </label>
          <div class="selected-invoice-address-display">
            <strong>Invoice Address:</strong><br>
            <button type="button" id="internalEditInvoiceAddressButton" class="edit-button">Edit Invoice Address</button>
          </div>
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
    console.log("Date selector found, no modifications made to the date field.");
  } else {
    console.warn("Date picker wrapper not found.");
  }
});
