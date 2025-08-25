/* ============================================================
   Woodson — Store Mode App (Default.js replacement)
   v1.0 (2025-08-25)
   - Always respects sessionStorage flags:
       storeMode: "on" | "off"
       storeProximity: "true" if user is at/near store (set elsewhere)
       storeName: friendly name of current store
       storeBranchKey: short code/branch id for stock lookup (optional)
       customerCode: cached account code (pulled from AccountInfo if possible)
   - Mobile-first maroon UI (#6b0016), big tap targets
   - Home overlay with actions (Search, Scan, Specials, My Account, Help, Exit)
   - Intercepts product clicks on Products.aspx to show a slim Product Card modal
   - Product Card pulls image, name, price, stock-at-branch (via ShowStock.aspx)
   - Account barcode (Code 128) using JsBarcode (loaded on demand)
   - Tawk.to helpers for "Need help?" and "Where is this in my store?" prompts
   - Safe: minimal DOM assumptions, lots of fallbacks, resilient to missing nodes
   ============================================================ */
(function () {
  'use strict';

  const BRAND = {
    maroon: '#6b0016',
    textOnMaroon: '#ffffff',
    accent: '#ffffff',
  };

  const PATH = location.pathname.toLowerCase();
  const URL_ORIGIN = location.origin;

  const ss = {
    get: (k, d = null) => {
      try { const v = sessionStorage.getItem(k); return v ?? d; } catch { return d; }
    },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} },
    del: (k) => { try { sessionStorage.removeItem(k); } catch {} },
  };

  let isStoreMode = ss.get('storeMode') === 'on';
  const stillAtStore = ss.get('storeProximity') === 'true';
  const storeName = ss.get('storeName') || 'Woodson Lumber';
  const storeBranchKey = ss.get('storeBranchKey') || ''; // e.g., "Brenham" or branch id used in stock grid

  // Guard: only do work if user is near store or already in store mode
  if (!stillAtStore && !isStoreMode) return;

  // ===== Bootstrap: Home Overlay on Default.aspx OR when explicitly requested =====
  document.addEventListener('DOMContentLoaded', () => {
    // If we're at/near a store, force-enable storeMode for this session
    if (stillAtStore && !isStoreMode) { ss.set('storeMode', 'on'); isStoreMode = true; }

    const isDefault = PATH.includes('default.aspx');
    const isProducts = PATH.includes('products.aspx');
    const url = new URL(location.href);
    const hasSearch = !!(url.searchParams.get('searchText') || url.searchParams.get('pg') || url.searchParams.get('pl1'));

    if (isDefault && isStoreMode) {
      renderStoreHomeOverlay();
      attachProductIntercepts();
      ensureBarcodeDepsPreload();
    } else if (isProducts && isStoreMode && !hasSearch) {
      // Landed on Products with no active search/category -> show Store Home overlay to kick off the flow
      renderStoreHomeOverlay();
      attachProductIntercepts();
      ensureBarcodeDepsPreload();
    } else {
      // Non-home pages or products with search/category: show banner + keep intercepts active
      if (isProducts) injectReturnToStoreBanner();
      attachProductIntercepts();
      ensureBarcodeDepsPreload();
    }
  });

  /* ========================= UI Builders ========================= */
  function renderStoreHomeOverlay() {
    const layout = document.querySelector('#MainLayoutRow') || document.body;
    // Clear layout & paint maroon background to confirm Store Mode visually
    if (layout) layout.innerHTML = '';

    const container = el('div', {
      style: `background:${BRAND.maroon};color:${BRAND.textOnMaroon};min-height:100vh;` +
             `font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;` +
             `display:flex;flex-direction:column;align-items:center;gap:16px;` +
             `padding:24px 16px;box-sizing:border-box;overflow-x:hidden;`
    });

    const title = el('div', {
      style: 'text-align:center;'
    }, [
      el('h1', {
        style: 'font-size:1.75rem;margin:0;font-style:italic;font-family:Georgia,Times,serif;'
      }, `Welcome to ${storeName}`),
      el('div', { style: 'opacity:.9;margin-top:6px;font-size:.95rem;' }, 'In‑Store Mode')
    ]);

    const grid = el('div', {
      style: `display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));` +
             `gap:14px;width:100%;max-width:720px;`
    });

    // Buttons
    grid.appendChild(tileButton('🔍 Search Products', () => {
      // Use native search
      ss.set('storeMode', 'on');
      location.href = '/Products.aspx';
    }));

    grid.appendChild(tileButton('📷 Scan Barcode', () => {
      ensureQuagga(() => loadInStoreScanner());
    }));

    grid.appendChild(tileButton('🔥 Specials', () => {
      ss.set('storeMode', 'on');
      location.href = '/Products.aspx?pl1=4546&pg=4546';
    }));

    grid.appendChild(tileButton('👤 My Account', () => {
      openAccountModal();
    }));

    grid.appendChild(tileButton('💬 Need Help?', () => {
      try {
        window.Tawk_API?.maximize?.();
      } catch {}
    }));

    grid.appendChild(tileButton('🔁 Exit Store Mode', () => {
      ss.set('storeMode', 'off');
      location.href = '/Default.aspx';
    }));

    container.appendChild(title);

    // Quick search bar on home overlay
    container.appendChild(quickSearch());

    container.appendChild(grid);

    // Footer note / store confirmation
    container.appendChild(el('div', { style: 'margin-top:auto;font-size:.85rem;opacity:.9;' }, `Store Mode active for ${storeName}`));

    (layout || document.body).appendChild(container);
  }

  function injectReturnToStoreBanner() {
    // Show only once per page; place before sticky header if it exists
    if (document.getElementById('storeModeBanner')) return;
    const stickyHeader = document.querySelector('.sticky-header') || document.body.firstElementChild;
    if (!stickyHeader) return;

    const banner = el('div', {
      id: 'storeModeBanner',
      style: `background:${BRAND.maroon};color:${BRAND.textOnMaroon};padding:10px 16px;` +
             `font-weight:600;font-size:1rem;text-align:center;width:100%;box-sizing:border-box;z-index:9999;`
    }, [
      'You\'re near a Woodson Lumber store.', ' ',
      el('a', {
        href: '#',
        style: 'color:#fff;text-decoration:underline;margin-left:6px;'
      }, 'Switch to Store Mode')
    ]);

    banner.querySelector('a')?.addEventListener('click', (e) => {
      e.preventDefault(); ss.set('storeMode', 'on'); location.href = '/Default.aspx';
    });

    stickyHeader.parentNode?.insertBefore(banner, stickyHeader);
    console.info('[StoreMode] Return banner injected');
  }

  function quickSearch() {
    const wrap = el('form', { style: 'width:100%;max-width:720px;display:flex;gap:8px;' });
    const input = el('input', {
      type: 'search',
      placeholder: 'Search products…',
      style: 'flex:1;border-radius:10px;border:none;padding:14px 16px;font-size:1rem;'
    });
    const btn = el('button', {
      type: 'submit',
      style: `border:none;border-radius:10px;padding:14px 16px;font-size:1rem;` +
             `font-weight:700;background:${BRAND.accent};color:${BRAND.maroon};`
    }, 'Search');

    wrap.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = (input.value || '').trim();
      if (!q) return input.focus();
      ss.set('storeMode', 'on');
      location.href = `/Products.aspx?pg=0&searchText=${encodeURIComponent(q)}`;
    });

    wrap.append(input, btn);
    return wrap;
  }

  function tileButton(text, onClick) {
    const btn = el('button', {
      style: `background:#fff;color:${BRAND.maroon};padding:0;border-radius:16px;border:none;` +
             `font-size:1rem;font-weight:800;cursor:pointer;width:100%;aspect-ratio:1/1;` +
             `box-shadow:0 2px 10px rgba(0,0,0,.25);display:flex;align-items:center;` +
             `justify-content:center;text-align:center;transition:transform .1s ease;`
    }, text);
    btn.addEventListener('click', (e) => { e.preventDefault(); onClick?.(); });
    btn.addEventListener('pointerdown', () => btn.style.transform = 'scale(.98)');
    btn.addEventListener('pointerup',   () => btn.style.transform = '');
    btn.addEventListener('mouseleave',  () => btn.style.transform = '');
    return btn;
  }

  /* ===================== Account Barcode Modal ===================== */
  function openAccountModal() {
    const code = ss.get('customerCode') || '';

    // Try to lazily fetch customer code if missing
    if (!code) tryFetchCustomerCode().finally(show);
    else show();

    function show() {
      const acctCode = ss.get('customerCode') || code || '—';
      const modal = modalShell({ title: 'My Account Code' });
      const body = el('div', { style: 'display:flex;flex-direction:column;gap:12px;align-items:center;' });

      body.appendChild(el('div', { style: 'font-size:1rem;opacity:.95;text-align:center;' }, 'Show this code to the cashier or let them scan your barcode.'));
      body.appendChild(el('div', { style: 'font-size:1.1rem;font-weight:800;' }, acctCode));

      const svg = el('svg', { id: 'wlAcctBarcode', style: 'width:100%;max-width:420px;height:120px;background:#fff;border-radius:10px;padding:8px;'}, '');
      body.appendChild(svg);

      modal.body.appendChild(body);
      modal.open();

      ensureJsBarcode(() => {
        try {
          window.JsBarcode(svg, acctCode || '000000', { format: 'CODE128', displayValue: false, margin: 0 });
        } catch (e) { console.warn('JsBarcode error', e); }
      });
    }
  }

  async function tryFetchCustomerCode() {
    // Best-effort: pull from AccountInfo_R.aspx if same-origin and logged-in
    try {
      const res = await fetch('/AccountInfo_R.aspx', { credentials: 'same-origin' });
      if (!res.ok) return;
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      // Look for something that looks like an Account # or Customer Code
      const txt = doc.body.innerText || '';
      const m = txt.match(/(Customer\s*Code|Account\s*(?:#|Number|No\.?))\s*[:\-]?\s*([A-Z0-9\-]{3,})/i);
      if (m && m[2]) ss.set('customerCode', m[2].trim());
    } catch {}
  }

  /* =================== Products Intercept + Card =================== */
  function attachProductIntercepts() {
    // Intercept clicks to ProductDetail.aspx from anywhere in the DOM
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href*="ProductDetail.aspx"], a[href*="pid="]');
      if (!a) return;
      const url = new URL(a.href, location.origin);
      const pid = url.searchParams.get('pid');
      if (!pid) return;

      // If near store, keep users in in-store flow by showing the modal
      if (ss.get('storeProximity') === 'true') {
        e.preventDefault();
        ss.set('storeMode', 'on');
        openProductCard(pid);
      }
    }, true);
  }

  async function openProductCard(pid) {
    const modal = modalShell({ title: 'Product Details' });
    const body = el('div', { style: 'display:flex;flex-direction:column;gap:12px;' });
    modal.body.appendChild(body);
    modal.open();

    body.appendChild(skeletonRow());

    try {
      const [detail, stock] = await Promise.all([
        fetchProductDetail(pid),
        fetchStockForBranch(pid, storeBranchKey || storeName)
      ]);

      body.innerHTML = '';

      const header = el('div', { style: 'display:flex;gap:12px;align-items:flex-start;' });
      const img = el('img', { src: detail.image || '', alt: '', style: 'width:34vw;max-width:160px;aspect-ratio:1/1;object-fit:contain;background:#fff;border-radius:12px;padding:10px;' });
      const meta = el('div', { style: 'flex:1;display:flex;flex-direction:column;gap:6px;' });

      meta.appendChild(el('div', { style: 'font-weight:800;line-height:1.25;' }, detail.name || 'Product'));
      if (detail.desc) meta.appendChild(el('div', { style: 'opacity:.95;font-size:.95rem;' }, detail.desc));

      const price = detail.price ? formatMoney(detail.price) : (detail.priceText || '');
      meta.appendChild(el('div', { style: 'margin-top:6px;font-size:1.1rem;font-weight:900;' }, price || ''));

      const stockLine = stock?.statusText || 'Checking local availability…';
      meta.appendChild(el('div', { style: `margin-top:2px;font-weight:700;` }, stockLine));

      // Future: bin location
      meta.appendChild(el('div', { style: 'margin-top:2px;opacity:.9;' }, `Bin Location: ${stock?.bin || '—'}`));

      header.append(img, meta);
      body.appendChild(header);

      // Actions
      const row = el('div', { style: 'display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;' });
      row.appendChild(primaryBtn('Find in Store', () => openFindInStore(detail, stock)));
      row.appendChild(secondaryBtn('Ask for Help', () => openHelpPrompt(detail, stock)));
      row.appendChild(secondaryBtn('View Full Page', () => {
        ss.set('storeMode', 'on');
        location.href = `/ProductDetail.aspx?pid=${encodeURIComponent(pid)}`;
      }));
      body.appendChild(row);

    } catch (e) {
      console.warn('openProductCard error', e);
      body.innerHTML = '';
      body.appendChild(el('div', {}, 'Sorry — couldn\'t load this item.'));
    }
  }

  async function fetchProductDetail(pid) {
    // Parse the product detail page to extract a few fields
    const res = await fetch(`/ProductDetail.aspx?pid=${encodeURIComponent(pid)}`, { credentials: 'same-origin' });
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const getText = (sel) => (doc.querySelector(sel)?.textContent || '').trim();

    // Try a few likely selectors for image and price
    const img = doc.querySelector('#ProductImageRow img, #ProductDetail img, img.productImage, img#MainProductImage');
    const name = getText('h1, .product-title, #ProductName, .MainProductTitle');
    const desc = getText('#ctl00_PageBody_productDetail_productDescription, .product-description, .ProductDescription');

    // Price: either direct element or in text
    let priceText = getText('.product-price, .PriceValue, #ProductPrice, .price');
    if (!priceText) {
      const pageTxt = doc.body.innerText || '';
      const m = pageTxt.match(/\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?/);
      if (m) priceText = m[0];
    }

    const price = parseMoney(priceText);

    return {
      image: img?.src || '',
      name,
      desc,
      priceText,
      price,
    };
  }

  async function fetchStockForBranch(pid, branchKey) {
    // Pull stock grid (ShowStock.aspx) and attempt to match current branch
    try {
      const res = await fetch(`/Catalog/ShowStock.aspx?productid=${encodeURIComponent(pid)}`, { credentials: 'same-origin' });
      if (!res.ok) return null;
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const rows = Array.from(doc.querySelectorAll('table tr'));
      // Try to find a header -> which column is Location, Bin, and Qty
      const headerCells = Array.from(rows.find(r => r.querySelector('th'))?.querySelectorAll('th') || []);
      const colIndex = (label) => headerCells.findIndex(th => new RegExp(label, 'i').test(th.textContent || ''));
      const iLoc = colIndex('Location');
      const iQty = colIndex('Qty|Quantity|On Hand');
      const iBin = colIndex('Bin');

      let statusText = 'Availability unknown';
      let bin = '';

      const matchRow = rows.find(r => {
        const cells = Array.from(r.querySelectorAll('td'));
        if (!cells.length) return false;
        const locTxt = (cells[iLoc]?.textContent || '').trim();
        if (!locTxt) return false;
        const key = String(branchKey || '').toLowerCase();
        return key && locTxt.toLowerCase().includes(key);
      });

      if (matchRow) {
        const cells = Array.from(matchRow.querySelectorAll('td'));
        const qtyTxt = (cells[iQty]?.textContent || '').trim();
        const qty = parseInt(qtyTxt.replace(/[^0-9\-]/g, ''), 10);
        bin = (cells[iBin]?.textContent || '').trim();
        if (Number.isFinite(qty)) {
          statusText = qty > 0 ? `In Stock at ${storeName} (Qty: ${qty})` : `Out of Stock at ${storeName}`;
        }
      }

      return { statusText, bin };
    } catch { return null; }
  }

  /* ======================= Help / Store Map ======================= */
  function openHelpPrompt(detail, stock) {
    try {
      // Prefill visitor attributes so staff sees context
      const attrs = {
        'Store Mode': 'true',
        'Store': storeName,
        'Product': detail?.name || '',
        'Status': stock?.statusText || '',
      };
      window.Tawk_API?.setAttributes?.(attrs, function(err) { /* ignore */ });
      window.Tawk_API?.maximize?.();
    } catch {}
  }

  function openFindInStore(detail, stock) {
    // Placeholder modal to host a future store map. For now, show bin & tips.
    const modal = modalShell({ title: 'Find in Store' });
    const body = el('div', { style: 'display:flex;flex-direction:column;gap:12px;' });
    body.appendChild(el('div', {}, detail?.name || ''));
    body.appendChild(el('div', { style: 'font-weight:700;' }, `Bin Location: ${stock?.bin || 'Ask an associate'}`));
    body.appendChild(el('div', { style: 'opacity:.95;' }, 'Aisle map coming soon. Tap "Ask for Help" to chat with us.'));
    const row = el('div', { style: 'display:flex;gap:10px;margin-top:4px;flex-wrap:wrap;' });
    row.appendChild(secondaryBtn('Ask for Help', () => openHelpPrompt(detail, stock)));
    modal.body.appendChild(body);
    modal.body.appendChild(row);
    modal.open();
  }

  /* ========================= Utilities ========================= */
  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs && typeof attrs === 'object') {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'style' && typeof v === 'string') n.setAttribute('style', v);
        else if (k === 'class') n.className = v;
        else if (k === 'dataset' && v && typeof v === 'object') {
          for (const [dk, dv] of Object.entries(v)) n.dataset[dk] = dv;
        } else if (k in n) {
          try { n[k] = v; } catch { n.setAttribute(k, v); }
        } else {
          n.setAttribute(k, v);
        }
      }
    }
    if (children != null) {
      if (Array.isArray(children)) children.forEach(c => n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
      else n.appendChild(typeof children === 'string' ? document.createTextNode(children) : children);
    }
    return n;
  }

  function modalShell({ title }) {
    const overlay = el('div', { style: `position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:99999;display:flex;align-items:flex-end;` });
    const sheet = el('div', { style: `background:${BRAND.maroon};color:#fff;width:100%;border-top-left-radius:16px;border-top-right-radius:16px;` +
                                         `max-height:86vh;overflow:auto;box-shadow:0 -8px 30px rgba(0,0,0,.35);` });
    const header = el('div', { style: 'display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.2);' }, [
      el('div', { style: 'font-weight:900;font-size:1.1rem;' }, title || ''),
      el('button', { style: 'background:transparent;color:#fff;border:none;font-size:1.25rem;font-weight:900;' }, '✕')
    ]);
    const body = el('div', { style: 'padding:14px 16px;' });

    header.lastChild.addEventListener('click', () => close());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    function open() { document.body.appendChild(overlay); overlay.appendChild(sheet); sheet.append(header, body); }
    function close() { overlay.remove(); }

    return { overlay, sheet, header, body, open, close };
  }

  function skeletonRow() {
    return el('div', { style: 'display:flex;gap:12px;align-items:center;' }, [
      el('div', { style: 'width:120px;height:120px;background:rgba(255,255,255,.2);border-radius:12px;' }),
      el('div', { style: 'flex:1;display:grid;gap:8px;' }, [
        el('div', { style: 'height:16px;background:rgba(255,255,255,.25);border-radius:8px;width:80%;' }),
        el('div', { style: 'height:14px;background:rgba(255,255,255,.2);border-radius:8px;width:60%;' }),
        el('div', { style: 'height:20px;background:rgba(255,255,255,.3);border-radius:8px;width:40%;' })
      ])
    ]);
  }

  function primaryBtn(label, onClick) {
    const b = el('button', { style: `background:#fff;color:${BRAND.maroon};border:none;border-radius:12px;padding:12px 14px;font-weight:900;` }, label);
    b.addEventListener('click', (e) => { e.preventDefault(); onClick?.(); });
    return b;
  }
  function secondaryBtn(label, onClick) {
    const b = el('button', { style: `background:transparent;color:#fff;border:1px solid rgba(255,255,255,.6);border-radius:12px;padding:12px 14px;font-weight:800;` }, label);
    b.addEventListener('click', (e) => { e.preventDefault(); onClick?.(); });
    return b;
  }

  function ensureQuagga(cb) {
    if (window.Quagga) return cb?.();
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/quagga@0.12.1/dist/quagga.min.js';
    s.onload = () => cb?.();
    document.head.appendChild(s);
  }

  function ensureJsBarcode(cb) {
    if (window.JsBarcode) return cb?.();
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';
    s.onload = () => cb?.();
    document.head.appendChild(s);
  }

  function ensureBarcodeDepsPreload() {
    // Lightly preload for smoother UX later
    setTimeout(() => { ensureJsBarcode(); }, 500);
  }

  function parseMoney(s) {
    const v = parseFloat(String(s || '').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(v) ? v : 0;
  }
  function formatMoney(n) { try { return n ? n.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : ''; } catch { return `$${(+n).toFixed(2)}`; } }

  /* ======================== Scanner Overlay ======================== */
  window.loadInStoreScanner = function () {
    if (document.getElementById('barcode-scan-overlay')) {
      document.getElementById('barcode-scan-overlay').style.display = 'block';
      startQuagga();
      return;
    }
    const overlay = document.createElement('div');
    overlay.id = 'barcode-scan-overlay';
    overlay.setAttribute('style', 'display:block;position:fixed;top:0;left:0;z-index:99999;width:100%;height:100%;background:rgba(0,0,0,.9);');
    overlay.innerHTML = `
      <video id="barcode-video" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover;"></video>
      <canvas id="barcode-canvas" style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:2;"></canvas>
      <div style="position:absolute;top:50%;left:50%;width:60%;height:22%;transform:translate(-50%,-50%);border:2px solid #00ff00;z-index:3;"></div>
      <button id="close-barcode-scanner" style="position:absolute;top:10px;right:10px;padding:10px 15px;font-size:16px;z-index:10000;">Close</button>`;
    document.body.appendChild(overlay);
    document.getElementById('close-barcode-scanner').onclick = stopQuagga;
    startQuagga();
  };

  function startQuagga() {
    const video = document.getElementById('barcode-video');
    const detected = {};
    const minDetections = 3;

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(stream => {
      video.srcObject = stream;
      window.Quagga.init({
        inputStream: { type: 'LiveStream', target: document.getElementById('barcode-canvas'), constraints: { facingMode: 'environment' } },
        decoder: { readers: ['upc_reader','ean_reader','code_128_reader'] },
        locate: true
      }, err => {
        if (err) { console.error('Quagga error:', err); stopQuagga(); return; }
        window.Quagga.start();
      });

      window.Quagga.onDetected(result => {
        const code = result?.codeResult?.code;
        if (!code) return;
        detected[code] = (detected[code] || 0) + 1;
        if (detected[code] >= minDetections) {
          window.Quagga.stop();
          stream.getTracks().forEach(t => t.stop());
          ss.set('storeMode', 'on');
          location.href = `/Products.aspx?pg=0&searchText=${encodeURIComponent(code)}`;
        }
      });
    }).catch(() => stopQuagga());
  }

  function stopQuagga() {
    const overlay = document.getElementById('barcode-scan-overlay');
    if (overlay) overlay.style.display = 'none';
    const video = document.getElementById('barcode-video');
    if (video && video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
    try { window.Quagga?.stop(); } catch {}
  }
})();
