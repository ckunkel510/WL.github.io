$(document).ready(function() {
  console.log("Page loaded, initializing custom checkout experience...");

  // ------------------------------------------------------
  // (A) Always attach event handlers (they run on every load)
  // ------------------------------------------------------
  
  // Shipping method change handler (for example, when Pickup is selected)
  if ($(".SaleTypeSelector").length) {
    $(".modern-shipping-selector button").on("click", function() {
      var selectedValue = $(this).data("value");
      if (selectedValue === "rbCollectLater") {
        // When Pickup is selected, automatically check the billing radio.
        $("#billingAddressRadio").prop("checked", true).trigger("change");
      }
    });
  }
  
  // Billing radio button change handler – copy delivery inputs to invoice inputs.
  $(document).on("change", "#billingAddressRadio", function() {
    if ($(this).is(":checked")) {
      console.log("Billing radio button checked.");
      $("#ctl00_PageBody_InvoiceAddress_AddressLine1").val(
        $("#ctl00_PageBody_DeliveryAddress_AddressLine1").val()
      );
      $("#ctl00_PageBody_InvoiceAddress_City").val(
        $("#ctl00_PageBody_DeliveryAddress_City").val()
      );
      $("#ctl00_PageBody_InvoiceAddress_Postcode").val(
        $("#ctl00_PageBody_DeliveryAddress_Postcode").val()
      );
      $("#ctl00_PageBody_InvoiceAddress_CountrySelector1").val(
        $("#ctl00_PageBody_DeliveryAddress_CountrySelector").val()
      );
      // (If you have a state dropdown, you may copy that too.)
      updateReadOnlyDisplays();
    }
  });
  
  // Internal Edit buttons – when clicked, show the input fields.
  // (In this example, we assume the input fields remain visible once loaded.
  //  You could instead call a function to reveal hidden fields.)
  $(document).on("click", "#internalEditDeliveryAddressButton", function() {
    console.log("Internal Edit Delivery Address button clicked.");
    // (Here you might call a function to show input fields.)
    $(".epi-form-group-checkout").show();
  });
  $(document).on("click", "#internalEditInvoiceAddressButton", function() {
    console.log("Internal Edit Invoice Address button clicked.");
    $(".epi-form-group-checkout").show();
  });
  
  // ------------------------------------------------------
  // (B) Define a helper function to update the read-only displays.
  // ------------------------------------------------------
  function updateReadOnlyDisplays() {
    // For Delivery Address:
    var deliveryFirstName = $("#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox").val();
    var deliveryLastName = $("#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox").val();
    var deliveryAddressLine1 = $("#ctl00_PageBody_DeliveryAddress_AddressLine1").val();
    var deliveryCity = $("#ctl00_PageBody_DeliveryAddress_City").val();
    var deliveryPostcode = $("#ctl00_PageBody_DeliveryAddress_Postcode").val();
    var fullDelivery = deliveryAddressLine1 + ", " + deliveryCity + ", " + deliveryPostcode;
    $(".selected-address-display").html(
      "<strong>Delivery Address:</strong><br>" +
      deliveryFirstName + " " + deliveryLastName + "<br>" +
      fullDelivery + "<br>" +
      "<button type='button' id='internalEditDeliveryAddressButton' class='edit-button'>Edit Delivery Address</button>"
    );
    
    // For Invoice Address:
    var invoiceAddressLine1 = $("#ctl00_PageBody_InvoiceAddress_AddressLine1").val();
    var invoiceCity = $("#ctl00_PageBody_InvoiceAddress_City").val();
    var invoicePostcode = $("#ctl00_PageBody_InvoiceAddress_Postcode").val();
    var fullInvoice = invoiceAddressLine1 + ", " + invoiceCity + ", " + invoicePostcode;
    $(".selected-invoice-address-display").html(
      "<strong>Invoice Address:</strong><br>" +
      fullInvoice + "<br>" +
      "<button type='button' id='internalEditInvoiceAddressButton' class='edit-button'>Edit Invoice Address</button>"
    );
  }
  
  // ------------------------------------------------------
  // (C) Initial Load Pre-Population (only runs once)
  // ------------------------------------------------------
  if (!sessionStorage.getItem("initialLoadDone")) {
    console.log("Running initial pre-population logic...");
    
    // --- External data fetch for Address Selector ---
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
        var fetchedAddress = smallestIdEntry.find("dd p").first().text().trim();
        console.log("Fetched shipping address from address selector:", fetchedAddress);
        
        // Parse the address components.
        const parts = fetchedAddress.split(",").map(s => s.trim());
        var addressLine1 = parts[0] || "";
        var city = parts[1] || "";
        var state = "";
        var zipCode = "";
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
        // Prepopulate the delivery input fields.
        $("#ctl00_PageBody_DeliveryAddress_AddressLine1").val(addressLine1);
        $("#ctl00_PageBody_DeliveryAddress_City").val(city);
        $("#ctl00_PageBody_DeliveryAddress_Postcode").val(zipCode);
        $("#ctl00_PageBody_DeliveryAddress_CountrySelector").val("USA");
        // (Optional: set the state dropdown by matching option text)
        var $stateSelect = $("#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList");
        if ($stateSelect.length) {
          $stateSelect.find("option").each(function() {
            if ($(this).text().trim().toLowerCase() === state.toLowerCase()) {
              $(this).prop("selected", true);
              return false;
            }
          });
        }
        
        // Save the fetched shipping address in a variable.
        shippingAddress = fetchedAddress;
        
        // Append the read-only display containers (if not already present)
        var $checkoutDivs = $(".epi-form-col-single-checkout");
        if ($checkoutDivs.length >= 7) {
          if ($checkoutDivs.eq(5).find(".selected-address-display").length === 0) {
            $checkoutDivs.eq(5).append(`
              <div class="selected-address-display">
                <strong>Delivery Address:</strong><br>${fetchedAddress}<br>
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
      }
    } else {
      console.warn("Address selector link button not found.");
    }
    
    // --- External data fetch for Account Settings ---
    $.get("https://webtrack.woodsonlumber.com/AccountSettings.aspx", function(data) {
      var $accountPage = $(data);
      var firstName = $accountPage.find("#ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput").val() || "";
      var lastName = $accountPage.find("#ctl00_PageBody_ChangeUserDetailsControl_LastNameInput").val() || "";
      var emailStr = $accountPage.find("#ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput").val() || "";
      var parsedEmail = emailStr.replace(/^\([^)]*\)\s*/, "");
      console.log("Fetched account settings:", firstName, lastName, parsedEmail);
      
      $("#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox").val(firstName);
      $("#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox").val(lastName);
      $("#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox").val(parsedEmail);
      
      // Update the read-only display for delivery address with the contact's name.
      if ($(".selected-address-display").length) {
        $(".selected-address-display").html(
          `<strong>Delivery Address:</strong><br>${firstName} ${lastName}<br>${shippingAddress}<br>
           <button type="button" id="internalEditDeliveryAddressButton" class="edit-button">Edit Delivery Address</button>`
        );
      }
    });
    
    // --- External data fetch for Telephone ---
    $.get("https://webtrack.woodsonlumber.com/AccountInfo_R.aspx", function(data) {
      var telephone = $(data).find("#ctl00_PageBody_TelephoneLink_TelephoneLink").text().trim();
      console.log("Fetched telephone:", telephone);
      $("#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox").val(telephone);
    });
    
    // Mark that the initial pre-population has been done.
    sessionStorage.setItem("initialLoadDone", "true");
  } // end if initial load
  
  // ------------------------------------------------------
  // (C) Update read-only displays from the current input values.
  // This runs on every load.
  updateReadOnlyDisplays();

  // ===================================================
  // 5. (Other event handlers – already attached above)
  // ===================================================
  
  // ===================================================
  // 6. Date Picker (unchanged)
  // ===================================================
  if ($("#ctl00_PageBody_dtRequired_DatePicker_wrapper").length) {
    console.log("Date selector found, no modifications made to the date field.");
  } else {
    console.warn("Date picker wrapper not found.");
  }
});
