$(document).ready(function() {
  console.log("Page loaded, initializing custom checkout experience...");

  // ----------------------------------------------------------------------
  // (A) Always-Attached Event Handlers & Functions
  // ----------------------------------------------------------------------

  // Function to update the read-only display areas based on current input field values.
  function refreshReadOnlyDisplays() {
    // Get delivery-related values
    var delFirstName = $("#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox").val();
    var delLastName  = $("#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox").val();
    var delAddress   = $("#ctl00_PageBody_DeliveryAddress_AddressLine1").val();
    var delCity      = $("#ctl00_PageBody_DeliveryAddress_City").val();
    var delZip       = $("#ctl00_PageBody_DeliveryAddress_Postcode").val();
    // Update the Delivery Address display (if exists)
    if ($(".selected-address-display").length) {
      $(".selected-address-display").html(
        "<strong>Delivery Address:</strong><br>" +
        delFirstName + " " + delLastName + "<br>" +
        delAddress + "<br>" +
        delCity + ", " + delZip + "<br>" +
        '<button type="button" id="internalEditDeliveryAddressButton" class="edit-button">Edit Delivery Address</button>'
      );
    }
    
    // Get invoice-related values
    var invAddress   = $("#ctl00_PageBody_InvoiceAddress_AddressLine1").val();
    var invCity      = $("#ctl00_PageBody_InvoiceAddress_City").val();
    var invZip       = $("#ctl00_PageBody_InvoiceAddress_Postcode").val();
    // Update the Invoice Address display (if exists)
    if ($(".selected-invoice-address-display").length) {
      $(".selected-invoice-address-display").html(
        "<strong>Invoice Address:</strong><br>" +
        invAddress + "<br>" +
        invCity + ", " + invZip + "<br>" +
        '<button type="button" id="internalEditInvoiceAddressButton" class="edit-button">Edit Invoice Address</button>'
      );
    }
  }

  // Whenever any input field inside an .epi-form-group-checkout changes or loses focus, update the displays.
  $(".epi-form-group-checkout input").on("change blur", refreshReadOnlyDisplays);

  // Internal Edit button handlers (they reveal the hidden input fields).
  $(document).on("click", "#internalEditDeliveryAddressButton", function() {
    console.log("Internal Edit Delivery Address button clicked.");
    $(".epi-form-group-checkout").show();
  });
  $(document).on("click", "#internalEditInvoiceAddressButton", function() {
    console.log("Internal Edit Invoice Address button clicked.");
    $(".epi-form-group-checkout").show();
  });

  // Billing radio button handler – when checked, copy delivery fields to invoice fields and update display.
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

      console.log("Copied values to invoice address fields:",
        deliveryAddressLine, deliveryCity, deliveryPostcode);

      refreshReadOnlyDisplays();
    }
  });

  // ----------------------------------------------------------------------
  // (B) INITIAL LOAD LOGIC – Run only on first load
  // ----------------------------------------------------------------------
  if (!sessionStorage.getItem("initialLoadDone")) {
    console.log("Running initial pre-population logic...");

    // --- Address Selector Pre-Population & Read-Only Displays ---
    if ($("#ctl00_PageBody_CustomerAddressSelector_SelectAddressLinkButton").length) {
      const addressEntries = $(".AddressSelectorEntry");
      if (addressEntries.length > 0) {
        let smallestIdEntry = addressEntries.first();
        let smallestId = parseInt(smallestIdEntry.find(".AddressId").text().trim(), 10);
        addressEntries.each(function() {
          const currentId = parseInt($(this).find(".AddressId").text().trim(), 10);
          if (currentId < smallestId) {
            smallestId = currentId;
            smallestIdEntry = $(this);
          }
        });
        var shippingAddress = smallestIdEntry.find("dd p").first().text().trim();
        console.log("Pre-populated shipping address:", shippingAddress);

        // Parse address components.
        const parts = shippingAddress.split(",").map(s => s.trim());
        const addressLine1 = parts[0] || "";
        const city = parts[1] || "";
        let state = "", zipCode = "";
        if (parts.length >= 4) {
          state = parts[parts.length - 2];
          zipCode = parts[parts.length - 1];
        } else if (parts.length > 2) {
          const match = parts[2].match(/(.+?)\s*(\d{5}(?:-\d{4})?)?$/);
          if (match) {
            state = match[1].trim();
            zipCode = match[2] || "";
          }
        }
        console.log(`Parsed Address: Line1=${addressLine1}, City=${city}, State=${state}, Zip=${zipCode}`);

        // Pre-populate the delivery input fields.
        $("#ctl00_PageBody_DeliveryAddress_AddressLine1").val(addressLine1);
        $("#ctl00_PageBody_DeliveryAddress_City").val(city);
        $("#ctl00_PageBody_DeliveryAddress_Postcode").val(zipCode);
        $("#ctl00_PageBody_DeliveryAddress_CountrySelector").val("USA");

        // For the state dropdown, iterate options to select one matching the parsed state.
        var $stateSelect = $("#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList");
        if ($stateSelect.length) {
          $stateSelect.find("option").each(function() {
            if ($(this).text().trim().toLowerCase() === state.toLowerCase()) {
              $(this).prop("selected", true);
              return false;
            }
          });
        }

        // Append read-only display containers into the 6th and 7th checkout containers.
        var $checkoutDivs = $(".epi-form-col-single-checkout");
        if ($checkoutDivs.length >= 7) {
          // Append Delivery Address display (only if not already appended).
          if ($checkoutDivs.eq(5).find(".selected-address-display").length === 0) {
            $checkoutDivs.eq(5).append(`
              <div class="selected-address-display">
                <strong>Delivery Address:</strong><br>${shippingAddress}<br>
                <button type="button" id="internalEditDeliveryAddressButton" class="edit-button">Edit Delivery Address</button>
              </div>
            `);
          }
          // Append Invoice Address display (with billing radio) if not already appended.
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
          // Now update the read-only displays based on the current input field values.
          refreshReadOnlyDisplays();
        } else {
          console.warn("Not enough .epi-form-col-single-checkout elements found.");
        }
      }
    } else {
      console.warn("Address selector link button not found.");
    }

    // --- Account Settings & Telephone Fetch (Pre-Population) ---
    $.get("https://webtrack.woodsonlumber.com/AccountSettings.aspx", function(data) {
      var $accountPage = $(data);
      var firstName = $accountPage.find("#ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput").val() || "";
      var lastName  = $accountPage.find("#ctl00_PageBody_ChangeUserDetailsControl_LastNameInput").val() || "";
      var emailStr  = $accountPage.find("#ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput").val() || "";
      var parsedEmail = emailStr.replace(/^\([^)]*\)\s*/, "");
      console.log("Fetched account settings:", firstName, lastName, parsedEmail);

      $("#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox").val(firstName);
      $("#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox").val(lastName);
      $("#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox").val(parsedEmail);

      // Update the Delivery Address display with the contact's name.
      if ($(".selected-address-display").length) {
        $(".selected-address-display").html(
          "<strong>Delivery Address:</strong><br>" +
          firstName + " " + lastName + "<br>" +
          shippingAddress + "<br>" +
          '<button type="button" id="internalEditDeliveryAddressButton" class="edit-button">Edit Delivery Address</button>'
        );
      }
      refreshReadOnlyDisplays();
    });
    $.get("https://webtrack.woodsonlumber.com/AccountInfo_R.aspx", function(data) {
      var telephone = $(data).find("#ctl00_PageBody_TelephoneLink_TelephoneLink").text().trim();
      console.log("Fetched telephone:", telephone);
      $("#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox").val(telephone);
    });

    // Mark that initial pre-population has been done.
    sessionStorage.setItem("initialLoadDone", "true");
  } // End of initial load block

  // ===================================================
  // 7. Date Picker (unchanged)
  // ===================================================
  if ($("#ctl00_PageBody_dtRequired_DatePicker_wrapper").length) {
    console.log("Date selector found, no modifications made to the date field.");
  } else {
    console.warn("Date picker wrapper not found.");
  }
});
