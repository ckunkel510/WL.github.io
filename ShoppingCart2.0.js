// ShoppingCart2.0.js

console.log('[Cart] DOM Ready');

document.addEventListener('DOMContentLoaded', function () {
  console.log('[Cart] Page loaded, initializing custom checkout experience...');

  const cartItems = Array.from(document.querySelectorAll('.row.shopping-cart-item'));
  const cartContainer = document.createElement('div');
  cartContainer.id = 'custom-cart';
  cartContainer.style.marginTop = '20px';

  const headerRow = document.createElement('div');
  headerRow.style.display = 'flex';
  headerRow.style.justifyContent = 'space-between';
  headerRow.style.padding = '10px 0';
  headerRow.style.borderBottom = '2px solid #ccc';
  headerRow.innerHTML = `
    <div style="flex: 1; font-weight: bold;">Product</div>
    <div style="width: 220px; text-align: right; font-weight: bold;">Details</div>
  `;
  cartContainer.appendChild(headerRow);

  let itemCount = 0;
  cartItems.forEach((item, index) => {
    const urlEl = item.querySelector('a[href*="ProductDetail.aspx"]');
    const imgEl = item.querySelector('img');
    const qtyInput = item.querySelector('input[type="text"][id*="_qty_"]');
    const updateBtn = item.querySelector('a[id*="refQty"]');
    const priceText = item.querySelector('.col-6')?.textContent.trim() || '';
    const totalText = item.querySelector('.col-sm-3 strong')?.textContent?.trim() || priceText;

    const productCode = urlEl?.textContent?.trim() || '[No Product Code]';
    const productName = urlEl?.closest('div')?.nextElementSibling?.textContent?.trim() || '[No Name]';
    const imgSrc = imgEl?.src || '';
    const url = urlEl?.href || '#';
    const qty = qtyInput?.value || '';
    const updateId = updateBtn?.id || '';

    if (!urlEl || !imgEl || !qtyInput || !updateBtn || productCode === 'Price\n                                                Quantity') {
      console.log(`[Cart] Skipping header or malformed row ${index + 1}`);
      return;
    }

    console.log(`[Cart] Item ${++itemCount}: URL=${url}, Qty=${qty}, UpdateID=${updateId}`);

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';
    row.style.flexWrap = 'wrap';
    row.style.padding = '15px 0';
    row.style.borderBottom = '1px solid #ccc';

    row.innerHTML = `
      <div style="display: flex; align-items: center; flex: 1; min-width: 250px;">
        <a href="${url}" style="display:inline-block; margin-right:10px;">
          <div class="image-wrapper" style="position:relative; display:inline-block;"><img src="${imgSrc}" alt="${productName}" style="width: 60px; height: 60px; object-fit: cover;"></div>
        </a>
        <div>
          <a href="${url}" style="text-decoration: none; color: #000;">
            <strong>${productCode}</strong><br>
            <small>${productName}</small>
          </a>
        </div>
      </div>
      <div style="text-align: right; min-width: 220px;">
        <div>Price: ${priceText}</div>
        <div>
          Qty:
          <input id="qty-${itemCount}" value="${qty}" style="width: 60px;" onchange="document.getElementById('${updateId}').click()">
        </div>
        <div>Total: <strong>${totalText}</strong></div>
      </div>
    `;

    cartContainer.appendChild(row);
  });

  const originalCart = document.querySelector('.shopping-cart');
  if (originalCart) originalCart.style.display = 'none';

  const subtotal = document.querySelector('.SubtotalWrapper')?.innerText.trim();
  console.log(`[Cart] Subtotal: ${subtotal}`);

  const totalRow = document.createElement('div');
  totalRow.style.display = 'flex';
  totalRow.style.justifyContent = 'space-between';
  totalRow.style.marginTop = '20px';
  totalRow.innerHTML = `
    <div><a href="/Products.aspx" class="epi-button">🛒 Shop More</a></div>
    <div>
      <strong>${subtotal}</strong><br>
      <a id="customPlaceOrderBtn" class="epi-button" style="margin-top:10px;">Place Order</a>
    </div>
  `;
  cartContainer.appendChild(totalRow);

  const injectPoint = document.querySelector('#ctl00_PageBody_CartLineControl');
  if (injectPoint) {
    console.log('[Cart] Injecting new cart container');
    injectPoint.prepend(cartContainer);
  } else {
    console.warn('[Cart] Failed to find inject point');
  }

  const realPlaceOrder = document.getElementById('ctl00_PageBody_PlaceOrderButton');
  const customBtn = document.getElementById('customPlaceOrderBtn');
  if (customBtn && realPlaceOrder) {
    customBtn.addEventListener('click', () => {
      console.log('[Cart] Triggering real PlaceOrder button');
      realPlaceOrder.click();
    });
  } else {
    console.warn('[Cart] PlaceOrder button not found');
  }
});