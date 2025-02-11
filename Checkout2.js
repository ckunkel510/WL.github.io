// When the transaction type and other checkout divs are loaded
$(document).ready(function() {
    console.log('Page loaded, initializing custom checkout experience...');

    // Hide only the original input content, but ensure the div itself is visible
    $('#ctl00_PageBody_TransactionTypeInput').hide();

    // Add temporary debug styles to see if the div is rendering properly
    $('#ctl00_PageBody_TransactionTypeDiv').css({ border: '2px solid red' });

    // Ensure transaction type div exists before appending
    if ($('#ctl00_PageBody_TransactionTypeDiv').length) {
        console.log('Appending modern transaction selector...');
        
        const modernTransactionSelector = `
            <div class="modern-transaction-selector d-flex justify-content-around" style="border: 2px solid blue; padding: 10px;">
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

        // Initial state check
        if ($('#ctl00_PageBody_TransactionTypeSelector_rdbOrder').is(':checked')) {
            updateTransactionStyles('rdbOrder');
        } else if ($('#ctl00_PageBody_TransactionTypeSelector_rdbQuote').is(':checked')) {
            updateTransactionStyles('rdbQuote');
        }

        // Button click event
        $('.modern-transaction-selector button').on('click', function() {
            const selectedValue = $(this).data('value');
            updateTransactionStyles(selectedValue);
        });
    } else {
        console.warn('Transaction type div not found.');
    }
});
