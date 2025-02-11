// When the transaction type div is loaded
$(document).ready(function() {
    // Hide the original transaction type input content and all children of the transaction type div except for the label
    $('#ctl00_PageBody_TransactionTypeInput, .TransactionTypeSelector').hide();

    // Create modern buttons to replace the radio buttons visually
    const modernSelector = `
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
    $('#ctl00_PageBody_TransactionTypeDiv').append(modernSelector);

    // Handle button clicks to update the hidden radio buttons
    function updateButtonStyles(selectedValue) {
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

    // Initial update to reflect the current state of the radio buttons
    if ($('#ctl00_PageBody_TransactionTypeSelector_rdbOrder').is(':checked')) {
        updateButtonStyles('rdbOrder');
    } else if ($('#ctl00_PageBody_TransactionTypeSelector_rdbQuote').is(':checked')) {
        updateButtonStyles('rdbQuote');
    }

    // Update styles when a button is clicked
    $('.modern-transaction-selector button').on('click', function() {
        const selectedValue = $(this).data('value');
        updateButtonStyles(selectedValue);
    });
});
