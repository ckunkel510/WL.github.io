$(document).ready(function() {
  console.log("Page loaded, initializing custom checkout experience...");

  // ===================================================
  // (A) Attach Event Handlers (always run)
  // ===================================================

  // --- Transaction Type Section ---
  if ($("#ctl00_PageBody_TransactionTypeDiv").length) {
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

  // --- Shipping Method Section ---
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
        // Automatically check the billing address radio button when Pickup is selected.
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

  // --- Billing Radio Button Handler ---
  $(document).on("change", "#billingAddressRadio", function() {
    if ($(this).is(":checked")) {
      console.log("Billing radio button checked.");
      var deliveryAddressLine = $("#ctl00_PageBody_DeliveryAddress_AddressLine1").val();
      var deliveryCity = $("#ctl00_PageBody_DeliveryAddress_City").val();
      var deliveryCounty = $("#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList").val();
      var deliveryPostcode = $("#ctl00_PageBody_DeliveryAddress_Postcode").val();
      var deliveryCountry = $("#ctl00_PageBody_DeliveryAddress_CountrySelector").val();

      $("#ctl00_PageBody_InvoiceAddress_AddressLine1").val(deliveryAddressLine);
      $("#ctl00_PageBody_InvoiceAddress_City").val(deliveryCity);
      $("#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList").val(deliveryCounty);
      $("#ctl00_PageBody_InvoiceAddress_Postcode").val(deliveryPostcode);
      $("#ctl00_PageBody_InvoiceAddress_CountrySelector1").val(deliveryCountry);

      console.log("Copied values to invoice address fields:",
        deliveryAddressLine, deliveryCity, deliveryPostcode);

      var invoiceDisplay = `<strong>Invoice Address:</strong><br>` +
        deliveryAddressLine + `<br>` +
        deliveryCity + `<br>` +
        deliveryPostcode;
      $(".selected-invoice-address-display").html(invoiceDisplay +
        `<br><button type="button" id="internalEditInvoiceAddressButton" class="edit-button">Edit Invoice Address</button>`);
    }
  });

  // --- Internal Edit Button Handlers (always attached) ---
  $(document).on("click", "#internalEditDeliveryAddressButton", function() {
    console.log("Internal Edit Delivery Address button clicked.");
    // Show the input groups by showing all elements with the class .epi-form-group-checkout.
    $(".epi-form-group-checkout").show();
  });
  $(document).on("click", "#internalEditInvoiceAddressButton", function() {
    console.log("Internal Edit Invoice Address button clicked.");
    $(".epi-form-group-checkout").show();
  });

  // ===================================================
  // (B) Pre-Population Logic (Only runs on first load)
  // ===================================================
  if (!sessionStorage.getItem("initialLoadDone")) {
    console.log("Running initial pre-population logic...");

    // --- Address Selector Pre-Population & Appending Read-Only Displays ---
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
        shippingAddress = smallestIdEntry.find("dd p").first().text().trim();
        console.log("Pre-populated shipping address:", shippingAddress);

        // Parse the address components.
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

        // Append the read-only display containers (if not already present) to the 6th and 7th checkout divs.
        var $checkoutDivs = $(".epi-form-col-single-checkout");
        if ($checkoutDivs.length >= 7) {
          // Append Delivery Address display to the 6th container (index 5)
          if ($checkoutDivs.eq(5).find(".selected-address-display").length === 0) {
            $checkoutDivs.eq(5).append(`
              <div class="selected-address-display">
                <strong>Delivery Address:</strong><br>${shippingAddress}<br>
                <button type="button" id="internalEditDeliveryAddressButton" class="edit-button">Edit Delivery Address</button>
              </div>
            `);
          }
          // Append Invoice Address display (with billing radio button) to the 7th container (index 6)
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

    // --- Account Settings Fetch (Pre-Population) ---
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

      // Update the Delivery Address display with the contact's name.
      if ($(".selected-address-display").length) {
        $(".selected-address-display").html(
          `<strong>Delivery Address:</strong><br>${firstName} ${lastName}<br>${shippingAddress}<br>
           <button type="button" id="internalEditDeliveryAddressButton" class="edit-button">Edit Delivery Address</button>`
        );
      }
    });

    // --- Telephone Fetch (Pre-Population) ---
    $.get("https://webtrack.woodsonlumber.com/AccountInfo_R.aspx", function(data) {
      var telephone = $(data).find("#ctl00_PageBody_TelephoneLink_TelephoneLink").text().trim();
      console.log("Fetched telephone:", telephone);
      $("#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox").val(telephone);
    });

    // Mark initial load as done.
    sessionStorage.setItem("initialLoadDone", "true");
  } // End initial load block

  // ===================================================
  // 5. (Event Handlers are attached above and will run on every load)
  // ===================================================

  // Billing Address Radio Button Handler and Internal Edit Buttons were attached above.
  // (They always run, so any subsequent postbacks will use the user‐modified values.)

  // ===================================================
  // 6. Date Picker (unchanged)
  // ===================================================
  if ($("#ctl00_PageBody_dtRequired_DatePicker_wrapper").length) {
    console.log("Date selector found, no modifications made to the date field.");
  } else {
    console.warn("Date picker wrapper not found.");
  }
});
