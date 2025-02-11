$(document).ready(function() {
    console.log('Page loaded, initializing custom checkout experience...');

    // --------------------------
    // Hide all address input fields by default (they remain in the DOM)
    // --------------------------
    $('#ctl00_PageBody_DeliveryAddress_AddressLine1, ' +
      '#ctl00_PageBody_DeliveryAddress_City, ' +
      '#ctl00_PageBody_DeliveryAddress_Postcode, ' +
      '#ctl00_PageBody_DeliveryAddress_CountrySelector, ' +
      '#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox, ' +
      '#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox, ' +
      '#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox').hide();

    $('#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox, ' +
      '#ctl00_PageBody_InvoiceAddress_AddressLine1, ' +
      '#ctl00_PageBody_InvoiceAddress_City, ' +
      '#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList, ' +
      '#ctl00_PageBody_InvoiceAddress_Postcode, ' +
      '#ctl00_PageBody_InvoiceAddress_CountrySelector1').hide();

    // --------------------------
    // Transaction Type Section
    // --------------------------
    if ($('#ctl00_PageBody_TransactionTypeDiv').length) {
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
        $('#ctl00_PageBody_TransactionTypeDiv').show().append(modernTransactionSelector);

        function updateTransactionStyles(selectedValue) {
            console.log(`Transaction type updated: ${selectedValue}`);
            if (selectedValue === 'rdbOrder') {
                $('#ctl00_PageBody_TransactionTypeSelector_rdbOrder').prop('checked', true);
                $('#btnOrder').removeClass('btn-secondary').addClass('btn-primary');
                $('#btnQuote').removeClass('btn-primary').addClass('btn-secondary');
            } else if (selectedValue === 'rdbQuote') {
                $('#ctl00_PageBody_TransactionTypeSelector_rdbQuote').prop('checked', true);
                $('#btnQuote').removeClass('btn-secondary').addClass('btn-primary');
                $('#btnOrder').removeClass('btn-primary').addClass('btn-secondary');
            }
        }
        if ($('#ctl00_PageBody_TransactionTypeSelector_rdbOrder').is(':checked')) {
            updateTransactionStyles('rdbOrder');
        } else if ($('#ctl00_PageBody_TransactionTypeSelector_rdbQuote').is(':checked')) {
            updateTransactionStyles('rdbQuote');
        }
        $('.modern-transaction-selector button').on('click', function() {
            const selectedValue = $(this).data('value');
            updateTransactionStyles(selectedValue);
        });
    } else {
        console.warn('Transaction type div not found.');
    }

    // --------------------------
    // Shipping Method Section
    // --------------------------
    if ($('.SaleTypeSelector').length) {
        $('.SaleTypeSelector').hide();
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
        $('.epi-form-col-single-checkout:has(.SaleTypeSelector)').append(modernShippingSelector);

        function updateShippingStyles(selectedValue) {
            console.log(`Shipping method updated: ${selectedValue}`);
            if (selectedValue === 'rbDelivered') {
                $('#ctl00_PageBody_SaleTypeSelector_rbDelivered').prop('checked', true);
                $('#btnDelivered').removeClass('btn-secondary').addClass('btn-primary');
                $('#btnPickup').removeClass('btn-primary').addClass('btn-secondary');
            } else if (selectedValue === 'rbCollectLater') {
                $('#ctl00_PageBody_SaleTypeSelector_rbCollectLater').prop('checked', true);
                $('#btnPickup').removeClass('btn-secondary').addClass('btn-primary');
                $('#btnDelivered').removeClass('btn-primary').addClass('btn-secondary');
            }
        }
        if ($('#ctl00_PageBody_SaleTypeSelector_rbDelivered').is(':checked')) {
            updateShippingStyles('rbDelivered');
        } else if ($('#ctl00_PageBody_SaleTypeSelector_rbCollectLater').is(':checked')) {
            updateShippingStyles('rbCollectLater');
        }
        $('.modern-shipping-selector button').on('click', function() {
            const selectedValue = $(this).data('value');
            updateShippingStyles(selectedValue);
        });
    } else {
        console.warn('Shipping method selector not found.');
    }

    // --------------------------
    // Address Selector Behavior
    // --------------------------
    var shippingAddress = "";
    if ($('#ctl00_PageBody_CustomerAddressSelector_SelectAddressLinkButton').length) {
        console.log('Initializing address selector behavior...');
        const addressEntries = $('.AddressSelectorEntry');
        if (addressEntries.length > 0) {
            let smallestIdEntry = addressEntries.first();
            let smallestId = parseInt(smallestIdEntry.find('.AddressId').text().trim(), 10);
            addressEntries.each(function() {
                const currentId = parseInt($(this).find('.AddressId').text().trim(), 10);
                if (currentId < smallestId) {
                    smallestId = currentId;
                    smallestIdEntry = $(this);
                }
            });
            const selectedAddress = smallestIdEntry.find('dd p').first().text().trim();
            shippingAddress = selectedAddress;
            console.log(`Smallest ID address selected: ${selectedAddress}`);

            // Parse address components
            const addressParts = selectedAddress.split(',').map(part => part.trim());
            const addressLine1 = addressParts[0] || '';
            const city = addressParts[1] || '';
            let state = '', zipCode = '';
            if (addressParts.length >= 4) {
                state = addressParts[addressParts.length - 2];
                zipCode = addressParts[addressParts.length - 1];
            } else if (addressParts.length > 2) {
                const stateZipMatch = addressParts[2].match(/(.+?)\s*(\d{5}(?:-\d{4})?)?$/);
                if (stateZipMatch) {
                    state = stateZipMatch[1].trim();
                    zipCode = stateZipMatch[2] || '';
                }
            }
            console.log(`Parsed Address -> Line 1: ${addressLine1}, City: ${city}, State: ${state}, Zip: ${zipCode}`);

            // Populate the hidden delivery address input fields
            $('#ctl00_PageBody_DeliveryAddress_AddressLine1').val(addressLine1);
            $('#ctl00_PageBody_DeliveryAddress_City').val(city);
            $('#ctl00_PageBody_DeliveryAddress_Postcode').val(zipCode);
            $('#ctl00_PageBody_DeliveryAddress_CountrySelector').val('USA');

            // Instead of replacing the container content, append a new read-only display container.
            var $checkoutDivs = $('.epi-form-col-single-checkout');
            if ($checkoutDivs.length >= 7) {
                // Append the Delivery Address read-only display into the 6th container (index 5)
                $checkoutDivs.eq(5).append(`
                    <div class="selected-address-display">
                        <strong>Delivery Address:</strong><br>${shippingAddress}<br>
                        <button type="button" id="internalEditDeliveryAddressButton" class="edit-button">(Internal Edit Delivery Address)</button>
                    </div>
                `);
                // Append the Invoice Address display (with billing radio button) into the 7th container (index 6)
                $checkoutDivs.eq(6).append(`
                    <div class="billing-address-section">
                        <label>
                            <input type="radio" id="billingAddressRadio" name="billingAddressOption">
                            Billing address is the same as delivery address
                        </label>
                        <div class="selected-invoice-address-display">
                            <strong>Invoice Address:</strong><br>
                            <button type="button" id="internalEditInvoiceAddressButton" class="edit-button">(Internal Edit Invoice Address)</button>
                        </div>
                    </div>
                `);
                // (Note: We do not hide these containers now so that the read-only displays remain visible.)
            } else {
                console.warn('Not enough .epi-form-col-single-checkout elements found.');
            }
        }

        // Add a button to allow adding a new address (which shows the hidden input fields)
        const addNewAddressButton = `
            <li class="AddressSelectorEntry text-center">
                <button id="btnAddNewAddress" class="btn btn-secondary">Add New Address</button>
            </li>
        `;
        $('.AddressSelectorList').append(addNewAddressButton);
        $(document).on('click', '#btnAddNewAddress', function() {
            $('#ctl00_PageBody_DeliveryAddress_AddressLine1, ' +
              '#ctl00_PageBody_DeliveryAddress_City, ' +
              '#ctl00_PageBody_DeliveryAddress_Postcode, ' +
              '#ctl00_PageBody_DeliveryAddress_CountrySelector, ' +
              '#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox, ' +
              '#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox, ' +
              '#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox')
              .css('display', 'inline-block');
            $('#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox, ' +
              '#ctl00_PageBody_InvoiceAddress_AddressLine1, ' +
              '#ctl00_PageBody_InvoiceAddress_City, ' +
              '#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList, ' +
              '#ctl00_PageBody_InvoiceAddress_Postcode, ' +
              '#ctl00_PageBody_InvoiceAddress_CountrySelector1')
              .css('display', 'inline-block');
            $('.AddressSelectorList').hide();
            // Optionally, clear the read-only display sections if re-entering new data.
            // (This line is optional—you might prefer to leave them visible.)
            // $('.selected-address-display, .billing-address-section').empty();
        });
    } else {
        console.warn('Address selector link button not found.');
    }

    // --------------------------
    // External Edit Buttons (Optional)
    // These external buttons (if desired) show the hidden input fields.
    // --------------------------
    // (Place these as needed; here we append them to the body.)
    $('<button id="showEditDeliveryButton" style="margin:10px;">Edit Delivery Address</button>')
        .appendTo('body')
        .on('click', function() {
            console.log("External Edit Delivery button clicked.");
            $('#ctl00_PageBody_DeliveryAddress_AddressLine1, ' +
              '#ctl00_PageBody_DeliveryAddress_City, ' +
              '#ctl00_PageBody_DeliveryAddress_Postcode, ' +
              '#ctl00_PageBody_DeliveryAddress_CountrySelector, ' +
              '#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox, ' +
              '#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox, ' +
              '#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox')
              .css('display', 'inline-block');
        });
    $('<button id="showEditInvoiceButton" style="margin:10px;">Edit Invoice Address</button>')
        .appendTo('body')
        .on('click', function() {
            console.log("External Edit Invoice button clicked.");
            $('#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox, ' +
              '#ctl00_PageBody_InvoiceAddress_AddressLine1, ' +
              '#ctl00_PageBody_InvoiceAddress_City, ' +
              '#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList, ' +
              '#ctl00_PageBody_InvoiceAddress_Postcode, ' +
              '#ctl00_PageBody_InvoiceAddress_CountrySelector1')
              .css('display', 'inline-block');
        });

    // --------------------------
    // Account Settings Fetch
    // --------------------------
    $.get("https://webtrack.woodsonlumber.com/AccountSettings.aspx", function(data) {
        var $accountPage = $(data);
        var firstName = $accountPage.find('#ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput').val() || '';
        var lastName  = $accountPage.find('#ctl00_PageBody_ChangeUserDetailsControl_LastNameInput').val() || '';
        var emailStr  = $accountPage.find('#ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput').val() || '';
        var parsedEmail = emailStr.replace(/^\([^)]*\)\s*/, '');
        console.log("Fetched account settings:", firstName, lastName, parsedEmail);

        $('#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox').val(firstName);
        $('#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox').val(lastName);
        $('#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox').val(parsedEmail);

        // Update the Delivery Address read-only display to include the contact's name.
        if ($('.selected-address-display').length) {
            $('.selected-address-display').html(
                `<strong>Delivery Address:</strong><br>${firstName} ${lastName}<br>${shippingAddress}<br>
                 <button type="button" id="internalEditDeliveryAddressButton" class="edit-button">(Internal Edit Delivery Address)</button>`
            );
        }
    });

    // --------------------------
    // Telephone Fetch
    // --------------------------
    $.get("https://webtrack.woodsonlumber.com/AccountInfo_R.aspx", function(data) {
        var telephone = $(data).find('#ctl00_PageBody_TelephoneLink_TelephoneLink').text().trim();
        console.log("Fetched telephone:", telephone);
        $('#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox').val(telephone);
    });

    // --------------------------
    // Billing Address Radio Button Handler
    // --------------------------
    $(document).on('change', '#billingAddressRadio', function() {
        if ($(this).is(':checked')) {
            console.log("Billing radio button checked.");
            var deliveryAddressLine = $('#ctl00_PageBody_DeliveryAddress_AddressLine1').val();
            var deliveryCity = $('#ctl00_PageBody_DeliveryAddress_City').val();
            var deliveryCounty = $('#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList').val();
            var deliveryPostcode = $('#ctl00_PageBody_DeliveryAddress_Postcode').val();
            var deliveryCountry = $('#ctl00_PageBody_DeliveryAddress_CountrySelector').val();

            $('#ctl00_PageBody_InvoiceAddress_AddressLine1').val(deliveryAddressLine);
            $('#ctl00_PageBody_InvoiceAddress_City').val(deliveryCity);
            $('#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList').val(deliveryCounty);
            $('#ctl00_PageBody_InvoiceAddress_Postcode').val(deliveryPostcode);
            $('#ctl00_PageBody_InvoiceAddress_CountrySelector1').val(deliveryCountry);

            console.log("Copied values to invoice address fields:",
                deliveryAddressLine, deliveryCity, deliveryPostcode);

            var invoiceDisplay = `<strong>Invoice Address:</strong><br>` +
                deliveryAddressLine + `<br>` +
                deliveryCity + `<br>` +
                deliveryPostcode;
            $('.selected-invoice-address-display').html(invoiceDisplay +
                `<br><button type="button" id="internalEditInvoiceAddressButton" class="edit-button">(Internal Edit Invoice Address)</button>`);
        }
    });

    // --------------------------
    // Internal Edit Buttons Handlers (within the read-only displays)
    // --------------------------
    $(document).on('click', '#internalEditDeliveryAddressButton', function() {
        console.log("Internal Edit Delivery Address button clicked.");
        $('#ctl00_PageBody_DeliveryAddress_AddressLine1, ' +
          '#ctl00_PageBody_DeliveryAddress_City, ' +
          '#ctl00_PageBody_DeliveryAddress_Postcode, ' +
          '#ctl00_PageBody_DeliveryAddress_CountrySelector, ' +
          '#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox, ' +
          '#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox, ' +
          '#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox')
          .css('display', 'inline-block');
    });
    $(document).on('click', '#internalEditInvoiceAddressButton', function() {
        console.log("Internal Edit Invoice Address button clicked.");
        $('#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox, ' +
          '#ctl00_PageBody_InvoiceAddress_AddressLine1, ' +
          '#ctl00_PageBody_InvoiceAddress_City, ' +
          '#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList, ' +
          '#ctl00_PageBody_InvoiceAddress_Postcode, ' +
          '#ctl00_PageBody_InvoiceAddress_CountrySelector1')
          .css('display', 'inline-block');
    });

    // --------------------------
    // Date Picker (unchanged)
    // --------------------------
    if ($('#ctl00_PageBody_dtRequired_DatePicker_wrapper').length) {
        console.log('Date selector found, no modifications made to the date field.');
    } else {
        console.warn('Date picker wrapper not found.');
    }
});
