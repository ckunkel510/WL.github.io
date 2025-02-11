// When the transaction type and other checkout divs are loaded
$(document).ready(function() {
    console.log('Page loaded, initializing custom checkout experience...');

    // Hide the specific original transaction type input content, not the entire div
    $('#ctl00_PageBody_TransactionTypeInput').hide();
    $('.TransactionTypeSelector').hide();

    // Ensure transaction type div exists before appending
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

    // Hide original shipping method input and add modern buttons
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

    // Enhance address selector behavior
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

            // Select and display the address with the smallest ID
            const selectedAddress = smallestIdEntry.find('dd p').first().text().trim();
            console.log(`Smallest ID address selected: ${selectedAddress}`);

            // Populate the address input fields
            const addressParts = selectedAddress.split(',');
            if (addressParts.length >= 3) {
                $('#ctl00_PageBody_DeliveryAddress_AddressLine1').val(addressParts[0].trim());
                $('#ctl00_PageBody_DeliveryAddress_City').val(addressParts[1].trim());
                $('#ctl00_PageBody_DeliveryAddress_Postcode').val(addressParts[2].trim());
                $('#ctl00_PageBody_DeliveryAddress_CountrySelector').val('USA');
            }

            // Find the Delivery section and update only that section
            const deliverySection = $('.epi-form-col-single-checkout').filter(function() {
                return $(this).find('.SelectableAddressType').text().trim() === 'Delivery';
            });

            if (deliverySection.length) {
                // Set state/county dropdown correctly with logic for both abbreviation and full name
                const stateDropdown = $('#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList');
                const stateText = addressParts[1].split(' ')[1]?.trim() || ''; // Assuming state might be part of the city/state line
                if (stateDropdown.length) {
                    let matchedOption = stateDropdown.find('option').filter(function() {
                        return (
                            $(this).text().toLowerCase() === stateText.toLowerCase() ||
                            $(this).text().toLowerCase().includes(stateText.toLowerCase()) ||
                            $(this).text().slice(0, 2).toLowerCase() === stateText.toLowerCase()
                        );
                    });
                    if (matchedOption.length > 0) {
                        stateDropdown.val(matchedOption.val());
                    }
                }

                // Hide address input fields and display the selected address summary within the Delivery section
                deliverySection.find('.epi-form-group-checkout').hide();
                deliverySection.find('.selected-address-display').remove();
                deliverySection.find('.SelectableAddressType').parent().after(`<div class="selected-address-display"><strong>Selected Address:</strong> ${selectedAddress}</div>`);
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

        $('#btnAddNewAddress').on('click', function() {
            console.log('Add New Address button clicked');
            // Show all address input fields within the Delivery section
            const deliverySection = $('.epi-form-col-single-checkout').filter(function() {
                return $(this).find('.SelectableAddressType').text().trim() === 'Delivery';
            });
            deliverySection.find('.epi-form-group-checkout').show();
            $('.AddressSelectorList').hide();
            deliverySection.find('.selected-address-display').remove();
        });
    } else {
        console.warn('Address selector link button not found.');
    }

    // Restore the original date input setup
    if ($('#ctl00_PageBody_dtRequired_DatePicker_wrapper').length) {
        console.log('Date selector found, no modifications made to the date field.');
    } else {
        console.warn('Date picker wrapper not found.');
    }
});
