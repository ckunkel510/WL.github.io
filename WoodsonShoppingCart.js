(function () {
  'use strict';

  if (!/ShoppingCart\.aspx/i.test(window.location.pathname)) return;

  const CART_SIGNATURE_KEY = 'wl_cart_signature_v1';
  const SHIPPING_QUOTE_KEY = 'wl_shipping_quote_v1';
  const AUTO_ADVANCE_KEY = 'wl_checkout_auto_advance';
  const QUOTE_TTL_MS = 4 * 60 * 60 * 1000;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  function text(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function money(value) {
    const match = String(value || '').match(/\$\s*([\d,]+(?:\.\d{2})?)/);
    return match ? '$' + match[1] : '';
  }

  function getCartRows() {
    return Array.from(document.querySelectorAll('.shopping-cart-item')).filter(function (row) {
      return Array.from(row.querySelectorAll('a')).some(function (link) {
        return /^\d{4,}$/.test(text(link.textContent));
      });
    });
  }

  function getCartProductCodes() {
    return getCartRows().map(function (row) {
      const link = Array.from(row.querySelectorAll('a')).find(function (candidate) {
        return /^\d{4,}$/.test(text(candidate.textContent));
      });
      return link ? text(link.textContent).toUpperCase() : '';
    }).filter(Boolean);
  }

  function getCartSignature() {
    return getCartRows().map(function (row) {
      const code = getCartProductCodesForRow(row);
      const qty = row.querySelector('input[id*="_qty_"]:not([id$="_ClientState"])')?.value || '';
      const totalMatch = text(row.innerText).match(/Total:\s*(\$[\d,]+(?:\.\d{2})?)/i);
      return [code, qty, totalMatch ? totalMatch[1] : ''].join(':');
    }).filter(Boolean).sort().join('|');
  }

  function getCartProductCodesForRow(row) {
    const link = Array.from(row.querySelectorAll('a')).find(function (candidate) {
      return /^\d{4,}$/.test(text(candidate.textContent));
    });
    return link ? text(link.textContent).toUpperCase() : '';
  }

  function saveCartSignature(signature) {
    if (!signature) return;
    try { sessionStorage.setItem(CART_SIGNATURE_KEY, signature); } catch {}
  }

  function readQuotedShipping(signature) {
    try {
      const quote = JSON.parse(localStorage.getItem(SHIPPING_QUOTE_KEY) || 'null');
      if (!quote || quote.kind !== 'local-delivery' || quote.signature !== signature || !quote.amount) return null;
      if ((Date.now() - Number(quote.ts || 0)) > QUOTE_TTL_MS) return null;
      return quote;
    } catch {
      return null;
    }
  }

  function injectStyles() {
    if (document.getElementById('wl-cart-shipping-css')) return;
    const style = document.createElement('style');
    style.id = 'wl-cart-shipping-css';
    style.textContent = `
      .wl-cart-shipping{margin-top:12px;padding-top:12px;border-top:1px solid #d9dde2;color:#25282c;font-size:14px;line-height:1.35;}
      .wl-cart-shipping-row{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:4px 0;}
      .wl-cart-shipping-row strong{color:#111;white-space:nowrap;}
      .wl-cart-shipping-note{margin-top:7px;color:#62676d;font-size:12px;max-width:360px;}
      .wl-cart-shipping-status{display:inline-flex;align-items:center;gap:7px;color:#555;}
      .wl-cart-shipping-dot{width:8px;height:8px;border-radius:50%;background:#6b0016;display:inline-block;}
      .wl-checkout-transition{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(255,255,255,.96);font-family:Arial,sans-serif;}
      .wl-checkout-transition-card{width:min(100%,440px);padding:28px 24px;text-align:center;border:1px solid #d9dde2;border-radius:8px;background:#fff;box-shadow:0 10px 32px rgba(0,0,0,.12);}
      .wl-checkout-transition-spinner{width:34px;height:34px;margin:0 auto 16px;border:4px solid #e4e4e4;border-top-color:#6b0016;border-radius:50%;animation:wl-cart-spin .8s linear infinite;}
      .wl-checkout-transition h2{margin:0 0 8px;font-size:21px;letter-spacing:0;color:#20242a;}
      .wl-checkout-transition p{margin:0;color:#5c6268;font-size:15px;}
      @keyframes wl-cart-spin{to{transform:rotate(360deg)}}
      @media (max-width:700px){.wl-cart-shipping{width:100%;}.wl-cart-shipping-note{max-width:none;}}
    `;
    document.head.appendChild(style);
  }

  function renderEstimate(result) {
    const wrappers = Array.from(document.querySelectorAll('.SubtotalWrapper'));
    if (!wrappers.length) return;

    wrappers.forEach(function (wrapper) {
      wrapper.querySelectorAll('.wl-cart-shipping').forEach(function (old) { old.remove(); });

      const panel = document.createElement('div');
      panel.className = 'wl-cart-shipping';

      const pickup = document.createElement('div');
      pickup.className = 'wl-cart-shipping-row';
      pickup.innerHTML = '<span>Store pickup</span><strong>Free</strong>';

      const delivery = document.createElement('div');
      delivery.className = 'wl-cart-shipping-row';
      const label = document.createElement('span');
      label.textContent = result.label || 'Estimated delivery';
      const amount = document.createElement('strong');
      amount.textContent = result.amount || 'Calculated at checkout';
      delivery.append(label, amount);

      const note = document.createElement('div');
      note.className = 'wl-cart-shipping-note';
      note.textContent = result.note || 'Final delivery charge is confirmed before payment.';

      panel.append(pickup, delivery, note);
      wrapper.appendChild(panel);
    });
  }

  function renderChecking() {
    renderEstimate({
      label: 'Estimated delivery',
      amount: 'Checking...',
      note: 'Using your saved address and the items in this cart.'
    });
  }

  async function getUserAddress() {
    try {
      const response = await fetch('/AccountInfo_R.aspx', { credentials: 'same-origin' });
      if (!response.ok) return null;
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const addressText = text(Array.from(doc.querySelectorAll('.accountInfoAddress li')).map(function (el) {
        return el.textContent;
      }).join(' '));
      const zip = addressText.match(/\b\d{5}(?:-\d{4})?\b/);
      return zip ? { zip: zip[0].slice(0, 5) } : null;
    } catch (error) {
      console.warn('[WLCart] Could not read the saved delivery ZIP.', error);
      return null;
    }
  }

  async function getProductData() {
    try {
      const response = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vSg6EOqMwc_5UjWU7ycyvF-rgj717p-WjV2Vhydcb7uc2Mf2Awj6GehQp66AHwViq4uX6mXXrtZZR-1/pub?output=csv');
      if (!response.ok) return [];
      const rows = (await response.text()).split(/\r?\n/).map(function (row) { return row.split(','); });
      const headers = rows.shift() || [];
      return rows.map(function (row) {
        return Object.fromEntries(row.map(function (cell, index) { return [headers[index], cell]; }));
      });
    } catch (error) {
      console.warn('[WLCart] Could not read product shipping dimensions.', error);
      return [];
    }
  }

  function isWithinCentralDeliveryZone(zip) {
    return ['77833', '77836', '78947', '77803', '76667', '76642', '75831'].includes(zip);
  }

  function cartSubtotal() {
    const visible = Array.from(document.querySelectorAll('.SubtotalWrapper')).find(function (wrapper) {
      const rect = wrapper.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1;
    });
    const amount = money(visible ? visible.textContent : '');
    return Number(String(amount).replace(/[^0-9.]/g, '')) || 0;
  }

  async function calculateEstimate(signature) {
    const quoted = readQuotedShipping(signature);
    if (quoted) {
      return {
        label: quoted.label || 'Estimated delivery',
        amount: quoted.amount,
        note: 'Based on WebTrack\'s latest quote for these cart items. Final charge is confirmed before payment.'
      };
    }

    const results = await Promise.all([getUserAddress(), getProductData()]);
    const userAddress = results[0];
    const productData = results[1];
    const codes = getCartProductCodes();
    const products = productData.filter(function (product) {
      return codes.includes(text(product.ProductCode).toUpperCase());
    });
    const containsLargeItems = products.some(function (product) {
      return Number(product.Weight) > 35 || Number(product.Width) > 36 ||
        Number(product.Thickness) > 36 || Number(product.Length) > 36;
    });

    if (!userAddress) {
      return {
        label: 'Estimated delivery',
        amount: 'Address needed',
        note: 'Sign in or confirm a delivery address to calculate shipping.'
      };
    }

    if (!isWithinCentralDeliveryZone(userAddress.zip)) {
      return {
        label: 'Estimated delivery',
        amount: containsLargeItems ? 'Address review needed' : 'Calculated at checkout',
        note: containsLargeItems
          ? 'Some oversized items may require another address or a custom freight quote.'
          : 'Ground freight is confirmed after your delivery address.'
      };
    }

    if (containsLargeItems) {
      return {
        label: 'Estimated delivery',
        amount: 'Calculated at checkout',
        note: 'Oversized items may change the base delivery charge.'
      };
    }

    if (cartSubtotal() >= 50) {
      return {
        label: 'Estimated delivery',
        amount: 'Free',
        note: 'This cart currently qualifies for free delivery in the central delivery zone.'
      };
    }

    return {
      label: 'Estimated delivery',
      amount: '$9.95',
      note: 'Based on your saved address and current cart. Final charge is confirmed before payment.'
    };
  }

  function isSignedIn() {
    return Array.from(document.querySelectorAll('a')).some(function (link) {
      return /sign\s*out/i.test(text(link.textContent));
    });
  }

  function showCheckoutTransition() {
    if (document.getElementById('wl-checkout-transition')) return;
    const overlay = document.createElement('div');
    overlay.id = 'wl-checkout-transition';
    overlay.className = 'wl-checkout-transition';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = `
      <div class="wl-checkout-transition-card">
        <div class="wl-checkout-transition-spinner" aria-hidden="true"></div>
        <h2>Preparing your checkout</h2>
        <p>Loading your saved pickup or delivery details and payment options...</p>
      </div>`;
    document.body.appendChild(overlay);
  }

  function bindCheckoutHandoff(signature) {
    document.addEventListener('click', function (event) {
      const target = event.target && event.target.closest
        ? event.target.closest('#ctl00_PageBody_PlaceOrderButton, [name="ctl00$PageBody$PlaceOrderButton"]')
        : null;
      if (!target) return;

      saveCartSignature(signature || getCartSignature());
      if (isSignedIn()) {
        try {
          sessionStorage.removeItem('wl_fulfillment_intent');
          sessionStorage.removeItem('wl_fulfillment_method');
          sessionStorage.removeItem('wl_shipping_selection_v1');
          sessionStorage.setItem(AUTO_ADVANCE_KEY, '1');
        } catch {}
      }
      showCheckoutTransition();
    }, true);
  }

  ready(async function () {
    const wrappers = document.querySelectorAll('.SubtotalWrapper');
    if (!wrappers.length) return;

    injectStyles();
    const signature = getCartSignature();
    saveCartSignature(signature);
    bindCheckoutHandoff(signature);
    renderChecking();
    renderEstimate(await calculateEstimate(signature));
  });
})();
