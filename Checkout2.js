$(document).ready(function() {
    console.log('Page loaded, initializing custom checkout experience...');

    // --------------------------
    // Hide all address input fields by default
    // --------------------------
    $('#ctl00_PageBody_DeliveryAddress_AddressLine1, #ctl00_PageBody_DeliveryAddress_City, #ctl00_PageBody_DeliveryAddress_Postcode, #ctl00_PageBody_DeliveryAddress_CountrySelector, #ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox, #ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox, #ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox').hide();
    $('#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox, #ctl00_PageBody_InvoiceAddress_AddressLine1, #ctl00_PageBody_InvoiceAddress_City, #ctl00_PageBody_InvoiceAddress_CountySelector_CountyList, #ctl00_PageBody_InvoiceAddress_Postcode, #ctl00_PageBody_InvoiceAddress_CountrySelector1').hide();

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
    // Global variable to hold the selected shipping address text (for label display)
    var shippingAddress = "";

    if ($('#ctl00_PageBody_CustomerAddressSelector_SelectAddressLinkButton').length) {
        console.log('Initializing address selector behavior...');

        // Automatically select the address with the smallest ID
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

            // Get the selected address text and store it
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

            // Populate the delivery address input fields
            $('#ctl00_PageBody_DeliveryAddress_AddressLine1').val(addressLine1);
            $('#ctl00_PageBody_DeliveryAddress_City').val(city);
            $('#ctl00_PageBody_DeliveryAddress_Postcode').val(zipCode);
            $('#ctl00_PageBody_DeliveryAddress_CountrySelector').val('USA');

            // Find the Delivery section (based on the text "Delivery" in a .SelectableAddressType)
            const deliverySection = $('.epi-form-col-single-checkout').filter(function() {
                return $(this).find('.SelectableAddressType').text().trim() === 'Delivery';
            });

            if (deliverySection.length) {
                // Set the dropdown value for state if needed
                const stateDropdown = $('#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList');
                if (stateDropdown.length) {
                    const matchedOption = stateDropdown.find('option').filter(function() {
                        const optionText = $(this).text().toLowerCase();
                        return (
                            optionText === state.toLowerCase() ||
                            optionText.includes(state.toLowerCase()) ||
                            (state.length === 2 && optionText.includes(state))
                        );
                    });
                    if (matchedOption.length > 0) {
                        matchedOption.prop('selected', true);
                        console.log(`Matched state: ${matchedOption.text()}`);
                    } else {
                        console.warn(`State '${state}' not found in dropdown options.`);
                    }
                }

                // Hide the delivery address input fields (they are already hidden by default)
                deliverySection.find('.epi-form-group-checkout').hide();

                // Remove any existing delivery address label display
                $('.selected-address-display').remove();

                // Append the Delivery Address label (shipping label) along with an Edit button
                var $checkoutDivs = $('.epi-form-col-single-checkout');
                if ($checkoutDivs.length >= 2) {
                    $checkoutDivs.eq($checkoutDivs.length - 2).after(
                        `<div class="selected-address-display mt-2">
                            <strong>Delivery Address:</strong><br>${shippingAddress}
                            <button type="button" id="editDeliveryAddressButton" class="edit-button">Edit Delivery Address</button>
                         </div>`
                    );
                    // Append the Billing Address section (radio button)
                    var billingSectionHtml = `
                        <div class="billing-address-section mt-2">
                            <label>
                                <input type="radio" id="billingAddressRadio" name="billingAddressOption">
                                Billing address is the same as delivery address
                            </label>
                        </div>
                    `;
                    $('.selected-address-display').last().after(billingSectionHtml);
                    // Append the Invoice Address label section (initially empty) with an Edit button
                    $('.billing-address-section').after(
                        `<div class="selected-invoice-address-display mt-2">
                            <strong>Invoice Address:</strong><br>
                            <button type="button" id="editInvoiceAddressButton" class="edit-button">Edit Invoice Address</button>
                         </div>`
                    );
                } else {
                    console.warn('Not enough .epi-form-col-single-checkout elements found.');
                }
            } else {
                console.warn('Delivery section not found.');
            }
        }

        // Add a button to allow adding a new address
        const addNewAddressButton = `
            <li class="AddressSelectorEntry text-center">
                <button id="btnAddNewAddress" class="btn btn-secondary">Add New Address</button>
            </li>
        `;
        $('.AddressSelectorList').append(addNewAddressButton);
        $(document).on('click', '#btnAddNewAddress', function() {
            // Show all delivery and invoice input fields
            $('#ctl00_PageBody_DeliveryAddress_AddressLine1, #ctl00_PageBody_DeliveryAddress_City, #ctl00_PageBody_DeliveryAddress_Postcode, #ctl00_PageBody_DeliveryAddress_CountrySelector, #ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox, #ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox, #ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox').show();
            $('#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox, #ctl00_PageBody_InvoiceAddress_AddressLine1, #ctl00_PageBody_InvoiceAddress_City, #ctl00_PageBody_InvoiceAddress_CountySelector_CountyList, #ctl00_PageBody_InvoiceAddress_Postcode, #ctl00_PageBody_InvoiceAddress_CountrySelector1').show();
            $('.AddressSelectorList').hide();
            // Optionally remove the labels so the user can enter new information
            $('.selected-address-display, .billing-address-section, .selected-invoice-address-display').remove();
        });
    } else {
        console.warn('Address selector link button not found.');
    }

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

        // Update the delivery contact fields and the invoice email field
        $('#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox').val(firstName);
        $('#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox').val(lastName);
        $('#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox').val(parsedEmail);

        // Also update the delivery address label to include the contact's name
        if ($('.selected-address-display').length) {
            $('.selected-address-display').html(
                `<strong>Delivery Address:</strong><br>${firstName} ${lastName}<br>${shippingAddress}
                 <button type="button" id="editDeliveryAddressButton" class="edit-button">Edit Delivery Address</button>`
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
            $('#ctl00_PageBody_InvoiceAddress_AddressLine1').val($('#ctl00_PageBody_DeliveryAddress_AddressLine1').val());
            $('#ctl00_PageBody_InvoiceAddress_City').val($('#ctl00_PageBody_DeliveryAddress_City').val());
            $('#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList').val($('#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList').val());
            $('#ctl00_PageBody_InvoiceAddress_Postcode').val($('#ctl00_PageBody_DeliveryAddress_Postcode').val());
            $('#ctl00_PageBody_InvoiceAddress_CountrySelector1').val($('#ctl00_PageBody_DeliveryAddress_CountrySelector').val());

            // Optionally update the invoice address label display if desired:
            var invoiceDisplay = `<strong>Invoice Address:</strong><br>` +
                $('#ctl00_PageBody_DeliveryAddress_AddressLine1').val() + `<br>` +
                $('#ctl00_PageBody_DeliveryAddress_City').val() + `<br>` +
                $('#ctl00_PageBody_DeliveryAddress_Postcode').val();
            $('.selected-invoice-address-display').html(invoiceDisplay +
                `<button type="button" id="editInvoiceAddressButton" class="edit-button">Edit Invoice Address</button>`);
        }
    });

    // --------------------------
    // Edit Buttons Handlers
    // --------------------------
    $(document).on('click', '#editDeliveryAddressButton', function() {
        $('#ctl00_PageBody_DeliveryAddress_AddressLine1, #ctl00_PageBody_DeliveryAddress_City, #ctl00_PageBody_DeliveryAddress_Postcode, #ctl00_PageBody_DeliveryAddress_CountrySelector, #ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox, #ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox, #ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox').show();
    });
    $(document).on('click', '#editInvoiceAddressButton', function() {
        $('#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox, #ctl00_PageBody_InvoiceAddress_AddressLine1, #ctl00_PageBody_InvoiceAddress_City, #ctl00_PageBody_InvoiceAddress_CountySelector_CountyList, #ctl00_PageBody_InvoiceAddress_Postcode, #ctl00_PageBody_InvoiceAddress_CountrySelector1').show();
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
