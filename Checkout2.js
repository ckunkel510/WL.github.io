// When the transaction type and other checkout divs are loaded
$(document).ready(function() {
    // Hide the original transaction type input content and all children of the transaction type div except for the label
    $('#ctl00_PageBody_TransactionTypeInput, .TransactionTypeSelector').hide();

    // Create modern buttons to replace the transaction type radio buttons visually
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

    // Append the modern selector after the transaction type label
    $('#ctl00_PageBody_TransactionTypeDiv').append(modernTransactionSelector);

    // Handle transaction button clicks
    function updateTransactionStyles(selectedValue) {
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

    // Initial update for transaction type buttons
    if ($('#ctl00_PageBody_TransactionTypeSelector_rdbOrder').is(':checked')) {
        updateTransactionStyles('rdbOrder');
    } else if ($('#ctl00_PageBody_TransactionTypeSelector_rdbQuote').is(':checked')) {
        updateTransactionStyles('rdbQuote');
    }

    $('.modern-transaction-selector button').on('click', function() {
        const selectedValue = $(this).data('value');
        updateTransactionStyles(selectedValue);
    });

    // Hide original shipping method input and add modern buttons
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

    // Hide the original date input and enhance the interface
    $('#ctl00_PageBody_dtRequired_DatePicker_wrapper').hide();

    const modernDateSelector = `
        <div class="modern-date-selector">
            <label for="modernDateInput">Date Required:</label>
            <input type="text" id="modernDateInput" class="form-control" placeholder="Select a date">
        </div>
    `;

    $('.epi-form-col-single-checkout:has(#ctl00_PageBody_dtRequired_DatePicker_wrapper)').append(modernDateSelector);

    $('#modernDateInput').datepicker({
        dateFormat: 'mm/dd/yy',
        minDate: 0,
        onSelect: function(dateText) {
            $('#ctl00_PageBody_dtRequired_DatePicker_dateInput').val(dateText);
        }
    });
});
