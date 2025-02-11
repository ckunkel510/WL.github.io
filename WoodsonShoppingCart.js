// Function to dynamically update the SubtotalWrapper and handle the TransactionType section
(async function updateShippingMessage() {
    // Select the SubtotalWrapper div
    const subtotalWrapper = document.querySelector('.SubtotalWrapper');

    if (!subtotalWrapper) return; // Exit if the div is not found

    // Extract and keep the existing subtotal text
    const subtotalText = subtotalWrapper.innerHTML;

    // Create the shipping message element
    const shippingMessage = document.createElement('div');
    shippingMessage.style.marginTop = '10px';
    shippingMessage.style.fontSize = '14px';
    shippingMessage.style.color = '#555';

    // Helper function to handle transaction type section
    function handleTransactionTypeSection() {
        const transactionTypeDiv = document.getElementById('ctl00_PageBody_TransactionTypeDiv');
        if (transactionTypeDiv) {
            console.log('TransactionTypeDiv found:', transactionTypeDiv.innerHTML);
        } else {
            console.log('TransactionTypeDiv not found');
        }
    }

    // Mutation observer to detect changes in the DOM
    const observer = new MutationObserver(() => {
        const transactionTypeDiv = document.getElementById('ctl00_PageBody_TransactionTypeDiv');
        if (transactionTypeDiv) {
            observer.disconnect(); // Stop observing once the div is found
            handleTransactionTypeSection();
        }
    });

    // Start observing the entire body for changes
    observer.observe(document.body, { childList: true, subtree: true });

    // Shipping message logic (kept unchanged)
    subtotalWrapper.innerHTML = subtotalText;
    subtotalWrapper.appendChild(shippingMessage);
})();
