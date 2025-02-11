$(document).ready(function() {
  console.log("Page loaded, initializing custom checkout experience...");

  // ===================================================
  // (A) Always-Attached Event Handlers & Helper Functions
  // ===================================================

  // Update the read-only displays from the current input field values.
  function refreshReadOnlyDisplays() {
    // Delivery display update.
    var delFirstName = $("#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox").val();
    var delLastName  = $("#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox").val();
    var delAddress   = $("#ctl00_PageBody_DeliveryAddress_AddressLine1").val();
    var delCity      = $("#ctl00_PageBody_DeliveryAddress_City").val();
    var delZip       = $("#ctl00_PageBody_DeliveryAddress_Postcode").val();
    var delDisplay = "<strong>Delivery Address:</strong><br>" +
                     delFirstName + " " + delLastName + "<br>" +
                     delAddress + "<br>" +
                     delCity + ", " + delZip;
    $(".selected-address-display").html(delDisplay +
      '<br><button type="button" id="internalEditDeliveryAddressButton" class="edit-button">Edit Delivery Address</button>');

    // Invoice display update.
    var invAddress   = $("#ctl00_PageBody_InvoiceAddress_AddressLine1").val();
    var invCity      = $("#ctl00_PageBody_InvoiceAddress_City").val();
    var invZip       = $("#ctl00_PageBody_InvoiceAddress_Postcode").val();
    var invDisplay = "<strong>Invoice Address:</strong><br>" +
                     invAddress + "<br>" +
                     invCity + ", " + invZip;
    $(".selected-invoice-address-display").html(invDisplay +
      '<br><button type="button" id="internalEditInvoiceAddressButton" class="edit-button">Edit Invoice Address</button>');
  }

  // Whenever any input field inside an .epi-form-group-checkout changes or loses focus, update the displays.
  $(".epi-form-group-checkout input").on("change blur", refreshReadOnlyDisplays);

  // When the internal edit buttons are clicked, show the original input fields.
  $(document).on("click", "#internalEditDeliveryAddressButton", function() {
    console.log("Internal Edit Delivery Address button clicked.");
    $(".epi-form-group-checkout").show();
  });
  $(document).on("click", "#internalEditInvoiceAddressButton", function() {
    console.log("Internal Edit Invoice Address button clicked.");
    $(".epi-form-group-checkout").show();
  });

  // When the billing radio button is checked, copy delivery values to invoice fields.
  $(document).on("change", "#billingAddressRadio", function() {
    if ($(this).is(":checked")) {
      console.log("Billing radio button checked.");
      var deliveryAddressLine = $("#ctl00_PageBody_DeliveryAddress_AddressLine1").val();
      var deliveryCity = $("#ctl00_PageBody_DeliveryAddress_City").val();
      var deliveryPostcode = $("#ctl00_PageBody_DeliveryAddress_Postcode").val();
      var deliveryCountry = $("#ctl00_PageBody_DeliveryAddress_CountrySelector").val();

      $("#ctl00_PageBody_InvoiceAddress_AddressLine1").val(deliveryAddressLine);
      $("#ctl00_PageBody_InvoiceAddress_City").val(deliveryCity);
      $("#ctl00_PageBody_InvoiceAddress_Postcode").val(deliveryPostcode);
      $("#ctl00_PageBody_InvoiceAddress_CountrySelector1").val(deliveryCountry);

      refreshReadOnlyDisplays();
    }
  });

  // ===================================================
  // (B) INITIAL LOAD PRE-POPULATION LOGIC – Run only if the Delivery Address field is empty.
  // ===================================================
  if ($("#ctl00_PageBody_DeliveryAddress_AddressLine1").val() === "") {
    console.log("Initial load pre-population running...");

    // --- 1. Pre-Populate from the Address Selector ---
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
        console.log("Pre-populated shipping address from selector:", shippingAddress);

        // Parse the address.
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
        // Pre-populate the delivery input fields.
        $("#ctl00_PageBody_DeliveryAddress_AddressLine1").val(addrLine1);
        $("#ctl00_PageBody_DeliveryAddress_City").val(city);
        $("#ctl00_PageBody_DeliveryAddress_Postcode").val(zip);
        $("#ctl00_PageBody_DeliveryAddress_CountrySelector").val("USA");

        // Set the state dropdown by matching the option text.
        var $stateSelect = $("#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList");
        if ($stateSelect.length) {
          $stateSelect.find("option").each(function() {
            if ($(this).text().trim().toLowerCase() === state.toLowerCase()) {
              $(this).prop("selected", true);
              return false; // break out of the loop
            }
          });
        }
      }
    } else {
      console.warn("Address selector link button not found.");
    }

    // --- 2. Pre-Populate from Account Settings & Telephone ---
    $.get("https://webtrack.woodsonlumber.com/AccountSettings.aspx", function(data) {
      var $acc = $(data);
      var firstName = $acc.find("#ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput").val() || "";
      var lastName = $acc.find("#ctl00_PageBody_ChangeUserDetailsControl_LastNameInput").val() || "";
      var emailStr = $acc.find("#ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput").val() || "";
      var parsedEmail = emailStr.replace(/^\([^)]*\)\s*/, "");
      console.log("Fetched account settings:", firstName, lastName, parsedEmail);
      $("#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox").val(firstName);
      $("#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox").val(lastName);
      $("#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox").val(parsedEmail);
      // Update the Delivery Address display (if already appended later, this function refreshes it).
      refreshReadOnlyDisplays();
    });
    $.get("https://webtrack.woodsonlumber.com/AccountInfo_R.aspx", function(data) {
      var tel = $(data).find("#ctl00_PageBody_TelephoneLink_TelephoneLink").text().trim();
      console.log("Fetched telephone:", tel);
      $("#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox").val(tel);
    });

    // --- 3. Append Read-Only Display Containers (if not already present) ---
    var $checkoutDivs = $(".epi-form-col-single-checkout");
    if ($checkoutDivs.length >= 7) {
      if ($checkoutDivs.eq(5).find(".selected-address-display").length === 0) {
        $checkoutDivs.eq(5).append(`
          <div class="selected-address-display">
            <strong>Delivery Address:</strong><br>${$("#ctl00_PageBody_DeliveryAddress_AddressLine1").val()}<br>
            ${$("#ctl00_PageBody_DeliveryAddress_City").val()}, ${$("#ctl00_PageBody_DeliveryAddress_Postcode").val()}<br>
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
    } else {
      console.warn("Not enough .epi-form-col-single-checkout elements found.");
    }

    // Finally, call refresh to update the displays.
    refreshReadOnlyDisplays();
  } else {
    console.log("Pre-population skipped because input field is not empty.");
    refreshReadOnlyDisplays();
  }

  // ===================================================
  // 5. Date Picker (unchanged)
  // ===================================================
  if ($("#ctl00_PageBody_dtRequired_DatePicker_wrapper").length) {
    console.log("Date selector found, no modifications made to the date field.");
  } else {
    console.warn("Date picker wrapper not found.");
  }
});
