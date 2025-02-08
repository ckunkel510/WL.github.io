// Function to dynamically update the SubtotalWrapper
(function updateShippingMessage() {
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

    // Determine the message content based on hypothetical cart data
    // Placeholder: Modify this logic to pull real data about the cart's contents
    let cartContainsLargeItems = false; // Example: Check if the cart has large items
    let cartSubtotal = parseFloat(subtotalWrapper.textContent.replace(/[^0-9\.]/g, '')) || 0;

    if (cartContainsLargeItems) {
        shippingMessage.textContent = 'Shipping is calculated based on order size and destination. Orders over $50 may qualify for free shipping.';
    } else if (cartSubtotal >= 50) {
        shippingMessage.textContent = 'Your order qualifies for free shipping in our central delivery zone!';
    } else {
        shippingMessage.textContent = 'Shipping estimated at $9.95 unless your order qualifies for free shipping.';
    }

    // Append the message to the SubtotalWrapper without removing the existing subtotal text
    subtotalWrapper.innerHTML = subtotalText;
    subtotalWrapper.appendChild(shippingMessage);
})();
