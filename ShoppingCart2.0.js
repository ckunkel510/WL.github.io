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
  const itemData = [];

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

    itemData.push({ url, imgSrc, productCode, productName, priceText, totalText, qty, updateId });
  });

  itemData.forEach((item, index) => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';
    row.style.flexWrap = 'wrap';
    row.style.padding = '15px 0';
    row.style.borderBottom = '1px solid #ccc';

    const qtyBoxId = `qty-${index}`;
    row.innerHTML = `
      <div style="display: flex; align-items: center; flex: 1; min-width: 250px;">
        <a href="${item.url}" style="display:inline-block; margin-right:10px;">
          <div class="image-wrapper" style="position:relative; display:inline-block;"><img src="${item.imgSrc}" alt="${item.productName}" style="width: 60px; height: 60px; object-fit: cover;"></div>
        </a>
        <div>
          <a href="${item.url}" style="text-decoration: none; color: #000;">
            <strong>${item.productCode}</strong><br>
            <small>${item.productName}</small>
          </a>
        </div>
      </div>
      <div style="text-align: right; min-width: 220px;">
        <div>Price: ${item.priceText}</div>
        <div>
          Qty:
          <input id="${qtyBoxId}" value="${item.qty}" style="width: 60px;">
        </div>
        <div>Total: <strong>${item.totalText}</strong></div>
      </div>
    `;
    cartContainer.appendChild(row);

    setTimeout(() => {
      const qtyField = document.getElementById(qtyBoxId);
      if (qtyField) {
        qtyField.addEventListener('change', () => {
          console.log(`[Cart] Qty changed for ${item.productCode}, triggering update ID: ${item.updateId}`);
          const realUpdateBtn = document.getElementById(item.updateId);
          if (realUpdateBtn) realUpdateBtn.click();
        });
      }
    }, 0);
  });

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

  const injectPoint = document.querySelector('#ctl00_PageBody_ShoppingCartSummaryTableControl');
  if (injectPoint) {
    console.log('[Cart] Inject point found: ctl00_PageBody_ShoppingCartSummaryTableControl');
    injectPoint.prepend(cartContainer);
  } else {
    console.error('[Cart] No valid inject point found.');
    return;
  }

  // Hide old cart containers
  const fallbackCartContainers = [
    '#ctl00_PageBody_ShoppingCartSummaryTableControl',
    '#ctl00_PageBody_CartLineControl',
    '.row.shopping-cart-item',
    '.shopping-cart'
  ];

  fallbackCartContainers.forEach(selector => {
    const el = document.querySelector(selector);
    if (el) {
      el.style.display = 'none';
      console.log(`[Cart] Hiding original element: ${selector}`);
    }
  });

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

  const storeName = document.querySelector('#locationFieldDelivery')?.textContent || document.querySelector('#locationFieldInvoice')?.textContent || '';
  if (storeName) {
    const storeNote = document.createElement('div');
    storeNote.style.margin = '20px 0';
    storeNote.style.padding = '10px';
    storeNote.style.backgroundColor = '#f5f5f5';
    storeNote.style.border = '1px solid #ccc';
    storeNote.style.borderRadius = '6px';
    storeNote.innerHTML = `<strong>You're shopping:</strong> ${storeName}. Store-specific info coming soon.`;
    cartContainer.prepend(storeNote);
  }
});