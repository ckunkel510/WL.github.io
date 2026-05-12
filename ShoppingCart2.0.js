(function () {
  'use strict';

  if (!/ShoppingCart\.aspx/i.test(location.pathname)) return;

  const QUOTE_URL = 'https://woodsonwholesaleinc.formstack.com/forms/request_a_quote';
  const SHOP_MORE_URL = '/Products.aspx';

  const CHECKOUT_MODE_KEY = 'wl_checkout_mode';
  const GUEST_KEY = 'wl_guest_checkout_payload';
  const GUEST_AUTOFILL_KEY = 'wl_guest_checkout_needs_autofill';
  const CHECKOUT_SNAPSHOT_KEY = 'wl_checkout_form_snapshot_v2';
  const DATE_STATE_KEY = 'wl_checkout_date_state_v2';

  function cartHasNativeSigninOption() {
    const cell = document.getElementById('ctl00_PageBody_OptionalSigninButton');
    if (!cell) return false;
    return !!cell.querySelector('a[href*="Signin.aspx"], a[href*="Login"], input[value*="Sign In"], button');
  }

  function isSignedInCart() {
    // WebTrack exposes the optional sign-in cell only when the shopper is not signed in.
    if (cartHasNativeSigninOption()) return false;

    // Extra positive checks for employee/customer sessions.
    const linksText = Array.from(document.querySelectorAll('a,button,input[type=submit],input[type=button]'))
      .map(el => (el.value || el.textContent || el.getAttribute('title') || '').trim().toLowerCase())
      .join(' | ');
    if (/sign\s*out|log\s*out|my\s+account|account\s+settings/.test(linksText)) return true;

    // If the page has no optional sign-in prompt, assume this is already an authenticated checkout context.
    return true;
  }

  function clearGuestCheckoutState() {
    try { sessionStorage.removeItem(GUEST_KEY); } catch {}
    try { sessionStorage.removeItem(GUEST_AUTOFILL_KEY); } catch {}
  }

  function startSignedInCheckoutFlow() {
    try { sessionStorage.setItem(CHECKOUT_MODE_KEY, 'signed_in'); } catch {}
    clearGuestCheckoutState();
    // Important for employee checkout: do not let a prior customer's checkout snapshot hydrate this order.
    try { sessionStorage.removeItem(CHECKOUT_SNAPSHOT_KEY); } catch {}
    try { sessionStorage.removeItem(DATE_STATE_KEY); } catch {}
    try { sessionStorage.removeItem('wl_billing_confirmed'); } catch {}
    try { sessionStorage.removeItem('wl_billing_seen'); } catch {}
    try { sessionStorage.removeItem('wl_billing_confirmed_delivered'); } catch {}
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function text(v) { return String(v || '').trim(); }

  function moneyFromText(raw) {
    const match = String(raw || '').match(/\$\s*([\d,]+(?:\.\d{2})?)/);
    return match ? Number(match[1].replace(/,/g, '')) || 0 : 0;
  }

  function formatMoney(n) {
    return '$' + (Number(n) || 0).toFixed(2);
  }

  function injectCss() {
    if (document.getElementById('wl-cart-css')) return;
    const style = document.createElement('style');
    style.id = 'wl-cart-css';
    style.textContent = `
      .wl-native-cart-hidden{position:absolute!important;left:-9999px!important;top:auto!important;width:1px!important;height:1px!important;overflow:hidden!important;opacity:0!important;pointer-events:none!important;}
      .wl-cart{margin:1rem 0 2rem;padding:18px;border-radius:16px;background:#f8f8f8;border:1px solid #e4e4e4;}
      .wl-cart-header{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start;justify-content:space-between;margin-bottom:14px;}
      .wl-cart-title{font-size:1.35rem;font-weight:800;color:#222;margin:0;}
      .wl-cart-sub{font-size:.95rem;color:#555;margin-top:4px;line-height:1.35;}
      .wl-quote-cta{border:1px solid rgba(0,0,0,.125);background:#fff;border-radius:14px;margin:0 0 14px;padding:14px;}
      .wl-quote-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;}
      .wl-cart-list{display:grid;gap:10px;}
      .wl-cart-item{display:grid;grid-template-columns:86px 1fr auto;gap:14px;align-items:center;background:#fff;border:1px solid #e1e1e1;border-radius:14px;padding:12px;}
      .wl-cart-img{width:76px;height:76px;object-fit:contain;border-radius:8px;background:#fff;border:1px solid #eee;}
      .wl-cart-code{font-weight:800;color:#004080;text-decoration:none;}
      .wl-cart-name{font-size:.98rem;color:#222;margin-top:2px;line-height:1.3;}
      .wl-cart-stock{font-size:.85rem;color:#2e7d32;margin-top:4px;line-height:1.3;}
      .wl-cart-controls{text-align:right;min-width:160px;}
      .wl-cart-price{font-weight:800;margin-bottom:8px;}
      .wl-cart-qty{display:inline-flex;align-items:center;gap:6px;margin-bottom:8px;}
      .wl-cart-qty input{width:70px;padding:6px 8px;border:1px solid #ccc;border-radius:8px;}
      .wl-cart-total{margin-bottom:6px;}
      .wl-remove{background:none;border:0;color:#b00020;cursor:pointer;padding:4px 0;font-weight:700;}
      .wl-cart-footer{display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between;margin-top:18px;padding-top:14px;border-top:1px solid #ddd;}
      .wl-cart-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:flex-end;}
      .wl-cart-secondary-actions{width:100%;display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;margin-top:8px;}
      .wl-btn{display:inline-flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid #ccc;padding:10px 14px;text-decoration:none;cursor:pointer;background:#fff;color:#222;line-height:1.1;}
      .wl-btn-primary{background:#6b0016;border-color:#6b0016;color:#fff;}
      .wl-btn-danger{background:#fff;border-color:#b00020;color:#b00020;}
      .wl-btn[disabled],.wl-btn.wl-loading{opacity:.65;cursor:wait;pointer-events:none;}
      .wl-btn-muted{background:#f1f1f1;color:#222;}
      .wl-empty-cart{padding:24px;background:#fff;border:1px solid #e1e1e1;border-radius:14px;text-align:center;}
      @media (max-width:700px){
        .wl-cart{padding:12px;}
        .wl-cart-item{grid-template-columns:72px 1fr;}
        .wl-cart-img{width:64px;height:64px;}
        .wl-cart-controls{grid-column:1 / -1;text-align:left;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;}
        .wl-cart-footer,.wl-cart-actions,.wl-cart-secondary-actions{justify-content:stretch;}
        .wl-btn,.wl-cart-secondary-actions .epi-button{width:100%;}
      }
    `;
    document.head.appendChild(style);
  }

  function runNative(btn) {
    if (!btn) return false;
    try {
      const href = btn.getAttribute('href') || '';
      if (/^javascript:/i.test(href)) {
        window.eval(href.replace(/^javascript:/i, ''));
        return true;
      }
    } catch (e) {
      console.warn('[WLCart] href postback failed, falling back to click', e);
    }
    try { btn.click(); return true; } catch (e) { console.warn('[WLCart] native click failed', e); }
    return false;
  }

  function getNativeButton(selectors) {
    for (const sel of selectors) {
      const found = document.querySelector(sel);
      if (found) return found;
    }
    return null;
  }

  function injectQuoteUnderHeader(cartPanel) {
    const header = cartPanel.querySelector('.cart-header');
    if (!header || cartPanel.querySelector('.wl-quote-cta')) return;

    const wrap = document.createElement('div');
    wrap.className = 'wl-quote-cta';

    const row = document.createElement('div');
    row.className = 'wl-quote-row';

    const copy = document.createElement('div');
    copy.style.minWidth = '240px';
    copy.style.flex = '1';
    const title = document.createElement('div');
    title.style.fontWeight = '800';
    title.style.fontSize = '1.05rem';
    title.textContent = 'Need a Quote?';
    const sub = document.createElement('div');
    sub.style.color = '#666';
    sub.style.lineHeight = '1.35';
    sub.textContent = 'Pricing a bigger order or not seeing exactly what you need? Submit a quick request and we’ll get back to you.';
    copy.append(title, sub);

    const link = document.createElement('a');
    link.className = 'wl-btn';
    link.href = QUOTE_URL;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Request a Quote';

    row.append(copy, link);
    wrap.appendChild(row);
    header.insertAdjacentElement('afterend', wrap);
  }

  function parseItem(row) {
    const img = row.querySelector('img.ThumbnailImage');
    const codeLink = row.querySelector('a.portalGridLink');
    const qtyInput = row.querySelector('input.riTextBox');
    const qtyState = row.querySelector("input[type='hidden'][id$='_ClientState']");
    const updateBtn = row.querySelector('a.refresh-cart-line-total');
    const deleteBtn = row.querySelector('a i.fas.fa-times')?.parentElement || row.querySelector('[id*="Delete"], [href*="Delete"]');

    const code = text(codeLink?.textContent);
    const name = text(codeLink?.parentElement?.nextElementSibling?.textContent) || text(row.querySelector('[data-title="Description"], .description, .ProductDescription')?.textContent);
    const stock = text(row.querySelector('.col-sm-6 div:nth-child(2) div')?.textContent);
    const total = moneyFromText(row.querySelector('.col-sm-3')?.textContent);
    const price = text(row.querySelector('.col-6')?.textContent?.match(/\$\s*[\d,]+(?:\.\d{2})?/)?.[0]) || '';

    return { row, img, codeLink, code, name, stock, qtyInput, qtyState, updateBtn, deleteBtn, total, price };
  }

  function updateRealQuantity(item, value) {
    const qty = Math.max(1, parseInt(value, 10) || 1);
    if (!item.qtyInput || !item.updateBtn) return false;

    item.qtyInput.value = String(qty);

    if (item.qtyState && item.qtyState.value) {
      try {
        const state = JSON.parse(item.qtyState.value);
        state.validationText = String(qty);
        state.valueAsString = String(qty);
        state.lastSetTextBoxValue = String(qty);
        item.qtyState.value = JSON.stringify(state);
      } catch (e) {
        console.warn('[WLCart] Could not update Telerik qty state. Continuing with input value.', e);
      }
    }

    runNative(item.updateBtn);
    return true;
  }

  function buildCartItem(item) {
    const card = document.createElement('div');
    card.className = 'wl-cart-item';

    const image = document.createElement('img');
    image.className = 'wl-cart-img';
    image.alt = item.name || item.code || 'Product image';
    image.src = item.img?.src || '';

    const details = document.createElement('div');
    const link = document.createElement('a');
    link.className = 'wl-cart-code';
    link.href = item.codeLink?.href || '#';
    link.textContent = item.code || 'Item';
    const name = document.createElement('div');
    name.className = 'wl-cart-name';
    name.textContent = item.name || '';
    const stock = document.createElement('div');
    stock.className = 'wl-cart-stock';
    stock.textContent = item.stock || '';
    details.append(link, name);
    if (item.stock) details.appendChild(stock);

    const controls = document.createElement('div');
    controls.className = 'wl-cart-controls';

    const price = document.createElement('div');
    price.className = 'wl-cart-price';
    price.textContent = item.price ? `${item.price} ea` : '';

    const qtyWrap = document.createElement('label');
    qtyWrap.className = 'wl-cart-qty';
    qtyWrap.append(document.createTextNode('Qty:'));
    const qty = document.createElement('input');
    qty.type = 'number';
    qty.min = '1';
    qty.step = '1';
    qty.value = item.qtyInput?.value || '1';
    qty.addEventListener('change', () => updateRealQuantity(item, qty.value));
    qtyWrap.appendChild(qty);

    const total = document.createElement('div');
    total.className = 'wl-cart-total';
    total.innerHTML = 'Total: <strong>' + formatMoney(item.total) + '</strong>';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'wl-remove';
    remove.textContent = '✕ Remove';
    remove.addEventListener('click', () => {
      if (!confirm('Remove this item from your cart?')) return;
      runNative(item.deleteBtn);
    });

    controls.append(price, qtyWrap, total, remove);
    card.append(image, details, controls);
    return card;
  }

  function buildCustomCart(cartPanel) {
    if (document.getElementById('wlCustomCart')) return;

    const rows = Array.from(cartPanel.querySelectorAll('.shopping-cart-item'));
    if (!rows.length) return;

    const items = rows.map(parseItem);
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);

    const wrapper = document.createElement('div');
    wrapper.id = 'wlCustomCart';
    wrapper.className = 'wl-cart';

    const header = document.createElement('div');
    header.className = 'wl-cart-header';
    const headCopy = document.createElement('div');
    const title = document.createElement('h2');
    title.className = 'wl-cart-title';
    title.textContent = 'Shopping Cart';
    const sub = document.createElement('div');
    sub.className = 'wl-cart-sub';
    const signedIn = isSignedInCart();
    wrapper.dataset.wlSignedIn = signedIn ? '1' : '0';

    sub.textContent = signedIn
      ? 'Review your items, update quantities, then continue to checkout.'
      : 'Review your items, update quantities, then continue as a signed-in customer or use Guest Checkout below.';
    headCopy.append(title, sub);
    header.appendChild(headCopy);

    const list = document.createElement('div');
    list.className = 'wl-cart-list';
    items.forEach(item => list.appendChild(buildCartItem(item)));

    const footer = document.createElement('div');
    footer.className = 'wl-cart-footer';

    const subtotalDiv = document.createElement('div');
    subtotalDiv.style.fontSize = '1.2rem';
    subtotalDiv.innerHTML = '<strong>Subtotal:</strong> ' + formatMoney(subtotal);

    const actions = document.createElement('div');
    actions.className = 'wl-cart-actions';

    const proceed = document.createElement('button');
    proceed.type = 'button';
    proceed.className = 'wl-btn wl-btn-primary';
    proceed.textContent = 'Proceed to Checkout';
    proceed.addEventListener('click', () => {
      proceed.classList.add('wl-loading');
      proceed.disabled = true;
      proceed.textContent = 'Opening Checkout…';
      startSignedInCheckoutFlow();
      try { sessionStorage.setItem('wl_expect_nav', '1'); } catch {}
      const nativeProceed = getNativeButton(['#ctl00_PageBody_PlaceOrderButton', '[name="ctl00$PageBody$PlaceOrderButton"]']);
      if (!runNative(nativeProceed)) {
        proceed.classList.remove('wl-loading');
        proceed.disabled = false;
        proceed.textContent = 'Proceed to Checkout';
        alert('Checkout did not start. Please use the original checkout button or refresh the cart.');
      }
    });

    const shopMore = document.createElement('a');
    shopMore.className = 'wl-btn wl-btn-muted';
    shopMore.href = SHOP_MORE_URL;
    shopMore.textContent = 'Shop for More';

    const empty = document.createElement('button');
    empty.type = 'button';
    empty.className = 'wl-btn wl-btn-danger';
    empty.textContent = 'Empty Cart';
    empty.addEventListener('click', () => {
      if (!confirm('Empty your cart?')) return;
      const nativeEmpty = getNativeButton(['#ctl00_PageBody_EmptyCartButton', '[name="ctl00$PageBody$EmptyCartButton"]']);
      runNative(nativeEmpty);
    });

    actions.append(proceed, shopMore, empty);

    const secondaryActions = document.createElement('div');
    secondaryActions.id = 'wl_guest_actions_mount';
    secondaryActions.className = 'wl-cart-secondary-actions';
    secondaryActions.style.display = signedIn ? 'none' : '';

    footer.append(subtotalDiv, actions);
    if (!signedIn) footer.appendChild(secondaryActions);
    wrapper.append(header, list, footer);

    cartPanel.insertAdjacentElement('afterend', wrapper);
    cartPanel.classList.add('wl-native-cart-hidden');

    // Let Guestcheckout.updated.js mount its buttons if it has already loaded.
    try { window.dispatchEvent(new Event('resize')); } catch {}
  }

  ready(function () {
    const cartPanel = document.querySelector('#ctl00_PageBody_ShoppingCartDetailPanel');
    if (!cartPanel) return;

    injectCss();
    injectQuoteUnderHeader(cartPanel);
    buildCustomCart(cartPanel);
  });
})();
