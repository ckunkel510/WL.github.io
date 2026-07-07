(function () {
  'use strict';

  if (!/ShoppingCart\.aspx/i.test(window.location.pathname)) return;

  const CART_SIGNATURE_KEY = 'wl_cart_signature_v1';
  const SHIPPING_QUOTE_KEY = 'wl_shipping_quote_v1';
  const SHIPPING_PROMO_KEY = 'wl_shipping_promo_v1';
  const AUTO_ADVANCE_KEY = 'wl_checkout_auto_advance';
  const CART_SUBTOTAL_KEY = 'wl_cart_subtotal_v1';
  const QUOTE_TTL_MS = 4 * 60 * 60 * 1000;
  const UPS_RATE_URL = 'https://wl-upsrates.vercel.app/api/ups-rates';
  const SHIPPING_PROMO_VERSION = '20260707-bridge-5';
  const SHIPPING_PROMO_SCRIPT_URL = 'https://ckunkel510.github.io/WL.github.io/UpsShippingPromo.js?v=' + SHIPPING_PROMO_VERSION;
  const STORE_ORIGINS = {
    brenham: { name: 'Brenham', city: 'Brenham', state: 'TX', postalCode: '77833' },
    bryan: { name: 'Bryan', city: 'Bryan', state: 'TX', postalCode: '77803' },
    caldwell: { name: 'Caldwell', city: 'Caldwell', state: 'TX', postalCode: '77836' },
    lexington: { name: 'Lexington', city: 'Lexington', state: 'TX', postalCode: '78947' },
    buffalo: { name: 'Buffalo', city: 'Buffalo', state: 'TX', postalCode: '75831' },
    mexia: { name: 'Mexia', city: 'Mexia', state: 'TX', postalCode: '76667' },
    groesbeck: { name: 'Groesbeck', city: 'Groesbeck', state: 'TX', postalCode: '76642' }
  };

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  function text(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function loadShippingPromoScript() {
    if (window.WLShippingPromo && window.WLShippingPromo.version === SHIPPING_PROMO_VERSION) return;
    if (document.querySelector('script[data-wl-ups-shipping-promo="' + SHIPPING_PROMO_VERSION + '"]')) return;
    const script = document.createElement('script');
    script.src = SHIPPING_PROMO_SCRIPT_URL;
    script.async = true;
    script.setAttribute('data-wl-ups-shipping-promo', SHIPPING_PROMO_VERSION);
    document.head.appendChild(script);
  }

  function money(value) {
    const match = String(value || '').match(/\$\s*([\d,]+(?:\.\d{2})?)/);
    return match ? '$' + match[1] : '';
  }

  function getCartRows() {
    return Array.from(document.querySelectorAll('.shopping-cart-item')).filter(function (row) {
      return !!(getCartProductCodesForRow(row) || getCartProductIdForRow(row));
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

  function getCartItems() {
    return getCartRows().map(function (row) {
      const quantityInput = row.querySelector('input[id*="_qty_"]:not([id$="_ClientState"])');
      const quantitySelect = row.querySelector('select.wl-qty-select');
      const lockedQty = row.querySelector('.wl-qty-locked');
      return {
        productId: getCartProductIdForRow(row),
        code: getCartProductCodesForRow(row),
        productCode: getCartProductCodesForRow(row),
        quantity: Math.max(1, Number(quantitySelect?.value || quantityInput?.value || lockedQty?.textContent) || 1)
      };
    }).filter(function (item) { return item.code || item.productId; });
  }

  function getCartSignature() {
    return getCartRows().map(function (row) {
      const code = getCartProductCodesForRow(row);
      const id = getCartProductIdForRow(row);
      const qty = row.querySelector('select.wl-qty-select')?.value ||
        row.querySelector('input[id*="_qty_"]:not([id$="_ClientState"])')?.value ||
        row.querySelector('.wl-qty-locked')?.textContent ||
        '';
      const totalMatch = text(row.innerText).match(/Total:\s*(\$[\d,]+(?:\.\d{2})?)/i);
      return [id, code, qty, totalMatch ? totalMatch[1] : ''].join(':');
    }).filter(Boolean).sort().join('|');
  }

  function getCartProductIdForRow(row) {
    const link = Array.from(row.querySelectorAll('a[href*="ProductDetail.aspx"]')).find(function (candidate) {
      return /[?&]pid=\d+/i.test(candidate.getAttribute('href') || '');
    });
    const match = (link?.getAttribute('href') || '').match(/[?&]pid=(\d+)/i);
    return match ? match[1] : '';
  }

  function getCartProductCodesForRow(row) {
    const link = row.querySelector('.portalGridLink') ||
      row.querySelector('.cart-item-card h6 a') ||
      row.querySelector('h6 a[href*="ProductDetail.aspx"]') ||
      Array.from(row.querySelectorAll('a[href*="ProductDetail.aspx"]')).find(function (candidate) {
        return text(candidate.textContent);
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
      if (!quote || !['local-delivery', 'ups'].includes(quote.kind) || quote.signature !== signature || !quote.amount) return null;
      if ((Date.now() - Number(quote.ts || 0)) > QUOTE_TTL_MS) return null;
      return quote;
    } catch {
      return null;
    }
  }

  function readShippingPromo(signature) {
    try {
      const native = window.WLShippingPromo && typeof window.WLShippingPromo.toRatePayload === 'function'
        ? window.WLShippingPromo.toRatePayload()
        : null;
      const stored = native || JSON.parse(sessionStorage.getItem(SHIPPING_PROMO_KEY) || localStorage.getItem(SHIPPING_PROMO_KEY) || 'null');
      if (!stored || stored.eligible !== true || !stored.code) return null;
      if (stored.cartSignature && signature && stored.cartSignature !== signature) return null;
      return stored;
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
      return zip ? {
        zip: zip[0].slice(0, 5),
        isTexas: /\b(?:Texas|TX)\b/i.test(addressText)
      } : null;
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

  function getSelectedStoreOrigin() {
    const locationText = text(Array.from(document.querySelectorAll('a[href]')).filter(function (link) {
      return String(link.getAttribute('href') || '').toLowerCase().includes('storelocations');
    }).map(function (link) { return link.textContent; }).join(' ')).toLowerCase();
    const key = Object.keys(STORE_ORIGINS).find(function (storeName) {
      return locationText.includes(storeName);
    });
    return key ? STORE_ORIGINS[key] : null;
  }

  function buildUpsPackage(items, productData) {
    const byCode = new Map(productData.map(function (product) {
      return [text(product.ProductCode).toUpperCase(), product];
    }));
    let totalWeight = 0;
    let containsLargeItems = false;

    for (const item of items) {
      const product = byCode.get(item.code);
      const weight = Number(product?.Weight);
      if (!product || !Number.isFinite(weight) || weight <= 0) {
        return { unavailable: true, containsLargeItems: false };
      }
      containsLargeItems = containsLargeItems || weight > 35 || Number(product.Width) > 36 ||
        Number(product.Thickness) > 36 || Number(product.Length) > 36;
      totalWeight += weight * item.quantity;
    }

    return {
      unavailable: !items.length || totalWeight <= 0 || totalWeight > 150,
      containsLargeItems: containsLargeItems,
      packages: [{ weight: Number(totalWeight.toFixed(2)) }]
    };
  }

  async function getUpsEstimate(userAddress, packageInfo, items, signature) {
    const origin = getSelectedStoreOrigin();
    if (!origin) throw new Error('The selected store could not be determined.');
    const promo = readShippingPromo(signature);
    const response = await fetch(UPS_RATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shipFrom: origin,
        shipTo: { postalCode: userAddress.zip, country: 'US', residential: true },
        packages: packageInfo.packages,
        cart: items.map(function (item) {
          return { productId: item.productId, productCode: item.productCode || item.code, quantity: item.quantity };
        }),
        promo: promo ? { code: promo.code, eligible: promo.eligible === true } : null
      })
    });
    const result = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(result.error || 'UPS could not calculate a rate.');
    const rate = (result.rates || []).find(function (candidate) {
      return candidate.serviceCode === '03';
    }) || (result.rates || [])[0];
    if (!rate || !Number.isFinite(Number(rate.amount))) throw new Error('UPS returned no eligible services.');
    const promoApplied = result.promotion && result.promotion.applied && rate.serviceCode === result.promotion.serviceCode;
    return {
      label: rate.serviceName || 'UPS shipping',
      amount: '$' + Number(rate.amount).toFixed(2),
      note: promoApplied
        ? 'Shipping promo applied to UPS Ground. Final rate is confirmed before payment.'
        : 'Estimated from ' + origin.name + ' to ZIP ' + userAddress.zip + '. Final rate is confirmed before payment.'
    };
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
    const results = await Promise.all([getUserAddress(), getProductData()]);
    const userAddress = results[0];
    const productData = results[1];
    const items = getCartItems();
    const codes = items.map(function (item) { return item.code; });
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

    const quoted = readQuotedShipping(signature);
    const quoteMatchesAddress = quoted && (
      (userAddress.isTexas && quoted.kind === 'local-delivery') ||
      (!userAddress.isTexas && quoted.kind === 'ups' && quoted.postalCode === userAddress.zip)
    );
    if (quoteMatchesAddress) {
      return {
        label: quoted.label || (quoted.kind === 'ups' ? 'UPS shipping' : 'Estimated delivery'),
        amount: quoted.amount,
        note: 'Based on WebTrack\'s latest quote for these cart items. Final charge is confirmed before payment.'
      };
    }

    const packageInfo = buildUpsPackage(items, productData);

    if (!userAddress.isTexas) {
      if (packageInfo.containsLargeItems) {
        return {
          label: 'UPS shipping',
          amount: 'Freight review needed',
          note: 'One or more oversized items require a custom shipping review.'
        };
      }
      if (packageInfo.unavailable) {
        return {
          label: 'UPS shipping',
          amount: 'Calculated at checkout',
          note: 'The final UPS service and rate will be shown before payment.'
        };
      }
      try {
        return await getUpsEstimate(userAddress, packageInfo, items, signature);
      } catch (error) {
        console.warn('[WLCart] Could not calculate the UPS cart estimate.', error);
        return {
          label: 'UPS shipping',
          amount: 'Calculated at checkout',
          note: 'The final UPS service and rate will be shown before payment.'
        };
      }
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

    return {
      label: 'Local delivery',
      amount: 'Calculated at checkout',
      note: containsLargeItems
        ? 'WebTrack will calculate the exact charge after confirming the delivery address and oversized items.'
        : 'WebTrack will calculate the exact Woodson delivery charge after confirming the delivery address.'
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
          sessionStorage.removeItem(AUTO_ADVANCE_KEY);
        } catch {}
      }
      showCheckoutTransition();
    }, true);
  }

  ready(async function () {
    const wrappers = document.querySelectorAll('.SubtotalWrapper');
    if (!wrappers.length) return;

    loadShippingPromoScript();
    injectStyles();
    const signature = getCartSignature();
    saveCartSignature(signature);
    try { sessionStorage.setItem(CART_SUBTOTAL_KEY, cartSubtotal().toFixed(2)); } catch {}
    bindCheckoutHandoff(signature);
    renderChecking();
    renderEstimate(await calculateEstimate(signature));
  });
})();
