$(document).ready(function() {
    console.log('Page loaded, initializing custom checkout experience...');

    // ===================================================
    // 1. Hide Original Input Fields (but keep them in the DOM)
    // ===================================================
    $('#ctl00_PageBody_DeliveryAddress_AddressLine1, ' +
      '#ctl00_PageBody_DeliveryAddress_City, ' +
      '#ctl00_PageBody_DeliveryAddress_Postcode, ' +
      '#ctl00_PageBody_DeliveryAddress_CountrySelector, ' +
      '#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox, ' +
      '#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox, ' +
      '#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox').css('display', 'none');

    $('#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox, ' +
      '#ctl00_PageBody_InvoiceAddress_AddressLine1, ' +
      '#ctl00_PageBody_InvoiceAddress_City, ' +
      '#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList, ' +
      '#ctl00_PageBody_InvoiceAddress_Postcode, ' +
      '#ctl00_PageBody_InvoiceAddress_CountrySelector1').css('display', 'none');


    // ===================================================
    // 2. Transaction Type Section
    // ===================================================
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
        $('#ctl00_PageBody_TransactionTypeDiv').append(modernTransactionSelector);

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
            updateTransactionStyles($(this).data('value'));
        });
    } else {
        console.warn('Transaction type div not found.');
    }


    // ===================================================
    // 3. Shipping Method Section
    // ===================================================
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
                // Automatically check billing radio if Pickup is selected.
                $("#billingAddressRadio").prop("checked", true).trigger("change");
            }
        }
        if ($('#ctl00_PageBody_SaleTypeSelector_rbDelivered').is(':checked')) {
            updateShippingStyles('rbDelivered');
        } else if ($('#ctl00_PageBody_SaleTypeSelector_rbCollectLater').is(':checked')) {
            updateShippingStyles('rbCollectLater');
        }
        $('.modern-shipping-selector button').on('click', function() {
            updateShippingStyles($(this).data('value'));
        });
    } else {
        console.warn('Shipping method selector not found.');
    }


    // ===================================================
    // 4. Address Selector Behavior & Appending Read-Only Display Containers
    // ===================================================
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
            shippingAddress = smallestIdEntry.find('dd p').first().text().trim();
            console.log(`Smallest ID address selected: ${shippingAddress}`);

            // Parse address components from the selected address.
            const parts = shippingAddress.split(',').map(s => s.trim());
            const addressLine1 = parts[0] || '';
            const city = parts[1] || '';
            let state = '', zipCode = '';
            if (parts.length >= 4) {
                state = parts[parts.length - 2];
                zipCode = parts[parts.length - 1];
            } else if (parts.length > 2) {
                const match = parts[2].match(/(.+?)\s*(\d{5}(?:-\d{4})?)?$/);
                if (match) {
                    state = match[1].trim();
                    zipCode = match[2] || '';
                }
            }
            console.log(`Parsed Address -> Line 1: ${addressLine1}, City: ${city}, State: ${state}, Zip: ${zipCode}`);

            // Populate the hidden delivery input fields.
            $('#ctl00_PageBody_DeliveryAddress_AddressLine1').val(addressLine1);
            $('#ctl00_PageBody_DeliveryAddress_City').val(city);
            $('#ctl00_PageBody_DeliveryAddress_Postcode').val(zipCode);
            $('#ctl00_PageBody_DeliveryAddress_CountrySelector').val('USA');

            // Append read-only display containers to the 6th and 7th .epi-form-col-single-checkout elements.
            var $checkoutDivs = $('.epi-form-col-single-checkout');
            if ($checkoutDivs.length >= 7) {
                // Append the Delivery Address read-only container (visible by default)
                // Only append once (using a unique class to check if it already exists).
                if ($checkoutDivs.eq(5).find('.selected-address-display').length === 0) {
                    $checkoutDivs.eq(5).append(`
                        <div class="selected-address-display">
                            <strong>Delivery Address:</strong><br>${shippingAddress}<br>
                            <button type="button" id="internalEditDeliveryAddressButton" class="edit-button">Edit Delivery Address</button>
                        </div>
                    `);
                }
                // Append the Invoice Address container (with billing radio) to the 7th element.
                if ($checkoutDivs.eq(6).find('.billing-address-section').length === 0) {
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
                console.warn('Not enough .epi-form-col-single-checkout elements found.');
            }
        }
        // "Add New Address" button to reveal hidden input fields.
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
        });
    } else {
        console.warn('Address selector link button not found.');
    }

    // ===================================================
    // 5. External Edit Buttons (Optional)
    // These buttons (appended externally) reveal the hidden input fields.
    // ===================================================
    var $checkoutDivs = $('.epi-form-col-single-checkout');
    if ($checkoutDivs.length >= 7) {
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
    }

    // ===================================================
    // 6. Account Settings Fetch
    // ===================================================
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

        // Optionally update the read-only delivery display (if needed)
        if ($('.selected-address-display').length) {
            // Update content without reappending duplicate edit buttons.
            $('.selected-address-display').find('strong').first().html(`Delivery Address:`);
            // You might choose to update the displayed name here if desired.
        }
    });

    // ===================================================
    // 7. Telephone Fetch
    // ===================================================
    $.get("https://webtrack.woodsonlumber.com/AccountInfo_R.aspx", function(data) {
        var telephone = $(data).find('#ctl00_PageBody_TelephoneLink_TelephoneLink').text().trim();
        console.log("Fetched telephone:", telephone);
        $('#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox').val(telephone);
    });

    // ===================================================
    // 8. Billing Address Radio Button Handler
    // ===================================================
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
                `<br><button type="button" id="internalEditInvoiceAddressButton" class="edit-button">Edit Invoice Address</button>`);
        }
    });

    // ===================================================
    // 9. Internal Edit Buttons Handlers (within read-only displays)
    // ===================================================
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

    // ===================================================
    // 10. Date Picker (unchanged)
    // ===================================================
    if ($('#ctl00_PageBody_dtRequired_DatePicker_wrapper').length) {
        console.log('Date selector found, no modifications made to the date field.');
    } else {
        console.warn('Date picker wrapper not found.');
    }
});
