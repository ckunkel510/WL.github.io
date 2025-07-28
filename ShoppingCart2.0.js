console.log('[Cart] Waiting for DOM elements to initialize...');

function waitForElement(selector, maxRetries = 20, interval = 250) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      attempts++;
      if (attempts >= maxRetries) return reject(`Timeout waiting for ${selector}`);
      setTimeout(check, interval);
    };
    check();
  });
}

async function initCustomCart() {
  console.log('[Cart] Page loaded, initializing custom checkout experience...');

  let injectPoint;
  try {
    injectPoint = await waitForElement('#ctl00_PageBody_CartLineControl').catch(() => null);
    if (!injectPoint) {
      injectPoint = document.querySelector('.shopping-cart');
      if (!injectPoint) throw new Error('[Cart] No valid inject point found.');
      console.warn('[Cart] Fallback to .shopping-cart as inject point');
    }
  } catch (e) {
    console.error(e);
    return;
  }

  const cartItems = Array.from(document.querySelectorAll('.row.shopping-cart-item'));
  if (!cartItems.length) {
    console.warn('[Cart] No cart items found, aborting.');
    return;
  }

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

    if (!urlEl || !imgEl || !qtyInput || !updateBtn || productCode.includes('Price')) {
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
          <img src="${item.imgSrc}" alt="${item.productName}" style="width: 60px; height: 60px; object-fit: cover;">
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

  const subtotal = document.querySelector('.SubtotalWrapper')?.innerText.trim() || '[No Subtotal]';
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

  // Add location indicator
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

  // Hide old cart
  const originalCart = document.querySelector('.shopping-cart');
  if (originalCart) originalCart.style.display = 'none';

  injectPoint.prepend(cartContainer);
  console.log('[Cart] Injected custom cart into page.');

  // Attach Place Order functionality
  try {
    const realPlaceOrder = await waitForElement('#ctl00_PageBody_PlaceOrderButton');
    const customBtn = document.getElementById('customPlaceOrderBtn');
    if (customBtn) {
      customBtn.addEventListener('click', () => {
        console.log('[Cart] Triggering real PlaceOrder button...');
        realPlaceOrder.click();
      });
    }
  } catch (e) {
    console.warn('[Cart] Could not bind to real PlaceOrder button');
  }
}

// Run the script once DOM is ready
document.addEventListener('DOMContentLoaded', initCustomCart);
