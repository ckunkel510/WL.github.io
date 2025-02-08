// Function to dynamically update the SubtotalWrapper
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

    // Helper function to fetch and parse user address data
    async function getUserAddress() {
        try {
            const response = await fetch('https://webtrack.woodsonlumber.com/AccountInfo_R.aspx');
            const text = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            const addressElements = doc.querySelectorAll('.accountInfoAddress li');

            if (addressElements.length >= 4) {
                return {
                    street: addressElements[0].textContent.trim(),
                    cityState: addressElements[1].textContent.trim(),
                    zip: addressElements[2].textContent.trim(),
                    country: addressElements[3].textContent.trim()
                };
            }
        } catch (error) {
            console.error('Error fetching user address:', error);
        }
        return null;
    }

    // Helper function to determine if the address is within 70 miles of a location
    function isWithinCentralDeliveryZone(zip) {
        const eligibleZips = ['77833', '77836', '78947', '77803', '76667', '76642', '75831'];
        return eligibleZips.includes(zip);
    }

    // Helper function to get product data from the Google Sheet
    async function getProductData() {
        const response = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vSg6EOqMwc_5UjWU7ycyvF-rgj717p-WjV2Vhydcb7uc2Mf2Awj6GehQp66AHwViq4uX6mXXrtZZR-1/pub?output=csv');
        const csvText = await response.text();
        const rows = csvText.split('\n').map(row => row.split(','));
        const headers = rows.shift();

        return rows.map(row => Object.fromEntries(row.map((cell, index) => [headers[index], cell])));
    }

    // Helper function to get product codes from the cart
    function getCartProductCodes() {
        const cartLines = document.querySelectorAll('[id*="ctl00_PageBody_CartLineControl"]');
        return Array.from(cartLines).map(line => {
            const title = line.getAttribute('title');
            return title ? title.trim() : null;
        }).filter(title => title); // Filter out any null values
    }

    // Check address and shipping rules
    const userAddress = await getUserAddress();
    let cartSubtotal = parseFloat(subtotalWrapper.textContent.replace(/[^0-9\.]/g, '')) || 0;
    let productData = await getProductData();
    let cartProductCodes = getCartProductCodes();

    // Filter product data based on cart product codes
    const cartProducts = productData.filter(product => cartProductCodes.includes(product.ProductCode));

    // Determine shipping conditions
    let cartContainsLargeItems = cartProducts.some(product =>
        parseFloat(product.Weight) > 35 ||
        parseFloat(product.Width) > 36 ||
        parseFloat(product.Thickness) > 36 ||
        parseFloat(product.Length) > 36
    );

    let allItemsSmall = cartProducts.every(product =>
        parseFloat(product.Weight) <= 35 &&
        parseFloat(product.Width) <= 36 &&
        parseFloat(product.Thickness) <= 36 &&
        parseFloat(product.Length) <= 36
    );

    if (userAddress) {
        if (isWithinCentralDeliveryZone(userAddress.zip)) {
            if (cartContainsLargeItems) {
                shippingMessage.textContent = 'Shipping calculated at checkout.';
            } else if (cartSubtotal >= 50) {
                shippingMessage.textContent = 'Your order qualifies for free shipping in our central delivery zone!';
            } else {
                shippingMessage.textContent = 'Shipping estimated at $9.95 for your location unless your order qualifies for free shipping.';
            }
        } else {
            if (cartContainsLargeItems) {
                shippingMessage.textContent = 'One or more items in your cart cannot be shipped to your main address. Please select a different address at checkout or remove the item.';
            } else {
                shippingMessage.textContent = 'Ground freight calculated in checkout.';
            }
        }
    } else {
        shippingMessage.textContent = 'Shipping estimated based on item size and destination.';
    }

    // Append the message to the SubtotalWrapper without removing the existing subtotal text
    subtotalWrapper.innerHTML = subtotalText;
    subtotalWrapper.appendChild(shippingMessage);
})();
