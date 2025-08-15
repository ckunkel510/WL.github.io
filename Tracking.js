/* =========================================================
   Open Orders — Amazon-style Card UI (Mobile + Desktop)
   + Tracking Overlay for ?tracking=
   ========================================================= */

/* ===== 1) Cardified order list with inline details ===== */
(function(){
  if (window.__WL_OPENORDERS_ENHANCED__) return;
  window.__WL_OPENORDERS_ENHANCED__ = true;

  const t0 = performance.now();
  const log = (...a)=>console.log('%cOpenOrders UI','color:#6b0016;font-weight:700;',`[+${(performance.now()-t0).toFixed(1)}ms]`,...a);

  // ---------- Styles ----------
  (function injectCSS(){
    const css = document.createElement('style');
    css.textContent = `
      /* Make grid render as a list of cards across breakpoints */
      .wl-cardify tr.rgRow, .wl-cardify tr.rgAltRow{
        display:block; background:#fff; border:1px solid #e5e7eb; border-radius:16px;
        margin:12px 0; box-shadow:0 6px 18px rgba(0,0,0,.05); overflow:hidden; position:relative
      }
      /* Hide original cells (we'll extract content and render our own) */
      .wl-cardify tr.rgRow>td, .wl-cardify tr.rgAltRow>td{ display:none !important; }

      /* Hide original grid header (we render card heads instead) */
.wl-cardify thead { 
  display: none !important;
}


      /* Card header */
      .wl-row-head{
        display:grid; gap:8px; padding:14px 14px 10px 14px; align-items:center
      }
      /* Desktop: two-column header layout */
      @media (min-width: 1024px){
        .wl-row-head{ grid-template-columns: 1fr auto; }
        .wl-row-head .wl-head-left{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .wl-row-head .wl-head-right{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; justify-content:flex-end; }
      }
      @media (max-width: 1023.98px){
        .wl-head-left{ display:flex; flex-wrap:wrap; gap:10px; }
        .wl-head-right{ display:flex; flex-wrap:wrap; gap:8px; }
      }

      .wl-order-id{ font-weight:900; font-size:16px; letter-spacing:.2px; }
      @media (min-width:1024px){ .wl-order-id{ font-size:18px; } }

      /* Status pill + palette */
      .wl-chip{ display:inline-flex; align-items:center; gap:6px; font-weight:800; border-radius:999px; padding:6px 10px; font-size:12px; text-transform:capitalize; }
      .wl-chip--slate{ background:#e2e8f0; color:#0f172a; }
      .wl-chip--green{ background:#dcfce7; color:#065f46; }
      .wl-chip--blue{ background:#dbeafe; color:#1e3a8a; }
      .wl-chip--amber{ background:#fef3c7; color:#92400e; }
      .wl-chip--orange{ background:#ffedd5; color:#9a3412; }
      .wl-chip--red{ background:#fee2e2; color:#7f1d1d; }
      .wl-chip--maroon{ background:#f2e6ea; color:#6b0016; }

      .wl-meta{ display:flex; gap:12px; flex-wrap:wrap; font-size:12px; color:#475569; }
      .wl-meta span{ white-space:nowrap; }

      .wl-actions{ display:flex; gap:8px; flex-wrap:wrap; }
      .wl-btn{ appearance:none; border:none; border-radius:12px; font-weight:900; padding:10px 14px; text-decoration:none; cursor:pointer; }
      .wl-btn:disabled{ opacity:.6; cursor:default; }
      .wl-btn--primary{ background:#6b0016; color:#fff; }
      .wl-btn--ghost{ background:#f8fafc; color:#111827; border:1px solid #e5e7eb; }

      /* Details area */
      .wl-details{ display:none; border-top:1px solid #eef0f3; padding:12px 14px 16px; }
      .wl-details.show{ display:block; }

      .wl-lines{ display:flex; flex-direction:column; gap:10px; }
      .wl-line{ display:flex; gap:12px; align-items:flex-start; justify-content:space-between; border:1px solid #eef0f3; border-radius:12px; padding:10px; }
      .wl-sku{ font-family:ui-monospace,Menlo,Consolas,monospace; font-weight:800; min-width:86px; }
      .wl-desc{ flex:1; min-width:160px; }
      .wl-qty{ white-space:nowrap; font-weight:700; }

      .wl-tracking-pills{ display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
      .wl-pill{ display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:999px; font-weight:800; font-size:12px; text-decoration:none; }
      .wl-pill--ups{ background:#111827; color:#fff; }
      .wl-pill--ups:hover{ opacity:.92; }

      /* Footer actions inside details */
      .wl-foot-actions{ margin-top:12px; display:flex; gap:8px; flex-wrap:wrap; }
    `;
    document.head.appendChild(css);
  })();

  // ---------- DOM helpers ----------
  const host = document.querySelector('#ctl00_PageBody_OrdersGrid, .RadGrid[id*="OrdersGrid"]');
  if (!host) { log('Grid host not found'); return; }
  const master = host.querySelector('#ctl00_PageBody_OrdersGrid_ctl00, .rgMasterTable');
  if (!master) { log('Master table not found'); return; }
  master.classList.add('wl-cardify');

  const rows = Array.from(master.querySelectorAll('tr.rgRow, tr.rgAltRow'));

  // Extractors from the original cells (before we hide them via CSS)
  function grab(tr, selector){
    const el = tr.querySelector(selector);
    return el ? el.textContent.trim() : '';
  }
  function findAnchor(tr){ return tr.querySelector('a[href*="oid="]') || null; }
  function getOid(href){ const m = /[?&]oid=(\d+)/.exec(href||''); return m ? m[1] : null; }

  // Status -> color mapping
  function statusColor(status){
    const s = (status||'').toLowerCase();
    if (s.includes('cancel')) return 'red';
    if (s.includes('backorder')) return 'orange';
    if (s.includes('invoice') || s.includes('billed') || s.includes('invoiced')) return 'slate';
    if (s.includes('delivered') || s.includes('shipped') || s.includes('complete')) return 'green';
    if (s.includes('ready') || s.includes('awaiting pickup')) return 'blue';
    if (s.includes('pick') || s.includes('picking') || s.includes('processing')) return 'amber';
    return 'slate';
  }

  // UPS helpers
  const UPS_RX = /^1Z[0-9A-Z]{16}$/i;
  const upsUrl = n => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`;

  // Build a full card UI per row
  function enhanceRow(tr){
    const a = findAnchor(tr);
    if (!a) return;

    const href = new URL(a.getAttribute('href')||'', location.origin).toString();
    const oid  = getOid(href);
    if (!oid) return;

    // Gather fields from the original cells
    const status  = grab(tr, 'td[data-title="Status"]');
    const created = grab(tr, 'td[data-title="Created"]');
    const branch  = grab(tr, 'td[data-title="Branch"]');
    const total   = grab(tr, 'td[data-title="Total Amount"], td[data-title="Goods Total"]');

    // Hide the original link but keep for fallback/postback
    a.style.position='absolute'; a.style.width='1px'; a.style.height='1px';
    a.style.overflow='hidden'; a.style.clip='rect(1px,1px,1px,1px)'; a.setAttribute('aria-hidden','true');

    // Header
    const head = document.createElement('div');
    head.className = 'wl-row-head';
    head.innerHTML = `
      <div class="wl-head-left">
        <span class="wl-order-id">Order #${oid}</span>
        <span class="wl-chip wl-chip--${statusColor(status)}">${status || 'Status'}</span>
        <div class="wl-meta">
          ${created ? `<span>Created: ${created}</span>` : ``}
          ${branch ? `<span>Branch: ${branch}</span>` : ``}
          ${total  ? `<span>Total: ${total}</span>` : ``}
        </div>
      </div>
      <div class="wl-head-right">
        <button class="wl-btn wl-btn--primary" type="button" data-action="toggle-details">View details</button>
        <a class="wl-btn wl-btn--ghost" href="${href}">Open full order</a>
      </div>
    `;
    tr.insertAdjacentElement('afterbegin', head);

    // Details container
    const details = document.createElement('div');
    details.className = 'wl-details';
    details.dataset.state = 'idle';
    tr.appendChild(details);

    // Toggle + lazy load
    const btn = head.querySelector('[data-action="toggle-details"]');
btn.addEventListener('click', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (details.dataset.state === 'idle') {
    await loadDetails(details, href, oid, btn);
  }
  details.classList.toggle('show');
  btn.textContent = details.classList.contains('show') ? 'Hide details' : 'View details';
});

  }

  // Fetch & render the order lines from the details page
  async function loadDetails(container, href, oid, btn){
    try{
      container.dataset.state = 'loading';
      btn.disabled = true; btn.textContent = 'Loading…';

      const html = await fetch(href, { credentials:'same-origin' }).then(r=>r.text());
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const table =
        doc.querySelector('#ctl00_PageBody_ctl02_OrderDetailsGrid_ctl00') ||
        doc.querySelector('#ctl00_PageBody_ctl02_OrderDetailsGrid .rgMasterTable') ||
        doc.querySelector('.rgMasterTable');

      const lines = [];
      const upsNumbers = [];

      if (table){
        table.querySelectorAll('tr').forEach(tr => {
          const codeEl = tr.querySelector('td[data-title="Product Code"]') || tr.querySelector('td:nth-child(1)');
          const descEl = tr.querySelector('td[data-title="Description"]') || tr.querySelector('td:nth-child(2)');
          const qtyEl  = tr.querySelector('td[data-title="Quantity"]') || tr.querySelector('td:nth-child(3)');
          if (!codeEl || !descEl) return;

          const code = (codeEl.textContent||'').trim();
          const desc = (descEl.textContent||'').trim().replace(/\s+/g,' ');
          const qty  = qtyEl ? (qtyEl.textContent||'').trim() : '';

          // Capture UPS tracking line(s)
          if ((code||'').toUpperCase() === 'UPS') {
            const raw = desc.replace(/\s+/g,'').toUpperCase();
            if (UPS_RX.test(raw)) upsNumbers.push(raw);
            else if (raw.length >= 8) upsNumbers.push(raw);
            return;
          }

          if (!code && !desc) return;
          lines.push({ code, desc, qty });
        });
      }

      container.innerHTML = `
        ${lines.length ? `
          <div class="wl-lines">
            ${lines.map(l => `
              <div class="wl-line">
                <div class="wl-sku">${l.code || '-'}</div>
                <div class="wl-desc">${l.desc || ''}</div>
                <div class="wl-qty">${l.qty ? 'Qty: '+l.qty : ''}</div>
              </div>
            `).join('')}
          </div>
        ` : `<div style="color:#475569;padding:8px 0;">No line items found.</div>`}

        ${upsNumbers.length ? `
          <div class="wl-tracking-pills">
            ${upsNumbers.map(n => `
              <a class="wl-pill wl-pill--ups" href="${upsUrl(n)}" target="_blank" rel="noopener" title="UPS ${n}">
                UPS · ${n}
              </a>
            `).join('')}
          </div>
        ` : ``}

        <div class="wl-foot-actions">
          <a class="wl-btn wl-btn--ghost" href="/OpenOrders_r.aspx">← Back to Orders</a>
          <a class="wl-btn wl-btn--primary" href="${href}">Open full order page</a>
        </div>
      `;

      container.dataset.state = 'ready';
    } catch(err){
      console.error(err);
      container.innerHTML = `<div style="color:#7f1d1d;background:#fee2e2;border:1px solid #fecaca;border-radius:10px;padding:10px;">
        Sorry, we couldn’t load order details. You can still <a href="${href}">open the full order page</a>.
      </div>`;
      container.dataset.state = 'error';
    } finally {
      btn.disabled = false;
      if (container.classList.contains('show')) btn.textContent = 'Hide details';
      else btn.textContent = 'View details';
    }
  }

  // Enhance all rows
  const enhanced = [];
  rows.forEach(tr => {
    try {
      enhanceRow(tr);
      enhanced.push(1);
    } catch(e){ console.warn('Enhance row failed', e); }
  });
  log('Enhanced rows:', enhanced.length);
})();

/* ===== 2) Tracking overlay (?tracking=…) stays for deep links ===== */
(function () {
  const qs = new URLSearchParams(location.search);
  const trackingParam = qs.get('tracking');
  if (!trackingParam) return;
  if (window.__WL_TRACKING_VIEW__) return;
  window.__WL_TRACKING_VIEW__ = true;

  const ORDER_ID = qs.get('oid') || '';
  const explicitNumber = trackingParam && trackingParam.toLowerCase() !== 'yes'
    ? trackingParam.trim()
    : null;

  const UPS_REGEX = /^1Z[0-9A-Z]{16}$/i;
  const toUPS = n => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`;

  function hideMainContent() {
    document.querySelectorAll('.bodyFlexContainer, #ctl00_PageBody_OrdersGrid, .paging-control')
      .forEach(el => { el.style.display = 'none'; });
  }

  function renderView(numbers, state) {
    const overlay = document.createElement('div');
    overlay.className = 'wl-tracking-overlay';
    overlay.innerHTML = `
      <div class="wl-track-card">
        <div class="wl-track-header">
          <div class="wl-track-title">Track your shipment</div>
          ${ORDER_ID ? `<div class="wl-track-sub">Order #${ORDER_ID}</div>` : ``}
        </div>

        ${state === 'loading' ? `
          <div class="wl-track-loading">Looking for tracking on your order…</div>
        ` : numbers.length ? `
          <div class="wl-track-list">
            ${numbers.map((n,i)=>`
              <div class="wl-track-line">
                <div class="wl-track-num">UPS ${n}</div>
                <a class="wl-track-btn" target="_blank" rel="noopener" href="${toUPS(n)}">
                  View status on UPS
                </a>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="wl-track-empty">
            We don’t see a tracking number on this order yet.
            If you just received this link, give it a little time or contact us and we’ll check for you.
          </div>
        `}

        <div class="wl-actions">
          <a class="wl-back" href="/OpenOrders_r.aspx">← Back to Orders</a>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const css = document.createElement('style');
    css.textContent = `
      .wl-tracking-overlay {
        position: fixed; inset: 0; display: grid; place-items: center; padding: 24px;
        background: rgba(255,255,255,0.98); z-index: 9999;
      }
      .wl-track-card {
        width: min(760px, 92vw); background: #fff; border: 1px solid #e5e7eb; border-radius: 16px;
        box-shadow: 0 12px 36px rgba(0,0,0,.08); padding: 20px; font-family: inherit;
      }
      .wl-track-header { margin-bottom: 10px; }
      .wl-track-title { font-size: 22px; font-weight: 800; }
      .wl-track-sub { color: #64748b; margin-top: 2px; }
      .wl-track-loading, .wl-track-empty { color: #475569; padding: 12px 0; }
      .wl-track-list { display: flex; flex-direction: column; gap: 12px; margin-top: 6px; }
      .wl-track-line { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between;
        border: 1px solid #eef0f3; border-radius: 12px; padding: 12px; }
      .wl-track-num { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-weight: 700; }
      .wl-track-btn {
        text-decoration: none; background: #6b0016; color: #fff; padding: 10px 14px; border-radius: 10px; font-weight: 700;
      }
      .wl-track-btn:hover { opacity: .92; }
      .wl-actions { display: flex; justify-content: flex-start; margin-top: 16px; }
      .wl-back { text-decoration: none; color: #0f172a; border-bottom: 1px dashed #cbd5e1; padding-bottom: 2px; }
      @media (max-width: 480px) {
        .wl-track-line { align-items: flex-start; }
        .wl-track-btn { width: 100%; text-align: center; }
      }
    `;
    document.head.appendChild(css);
  }

  function findUPSNumbers() {
    if (explicitNumber) return [explicitNumber];

    const candidates = [];
    const table =
      document.querySelector('#ctl00_PageBody_ctl02_OrderDetailsGrid_ctl00') ||
      document.querySelector('#ctl00_PageBody_ctl02_OrderDetailsGrid .rgMasterTable') ||
      document.querySelector('.rgMasterTable');
    if (!table) return candidates;

    table.querySelectorAll('tr').forEach(tr => {
      const code = tr.querySelector('td[data-title="Product Code"]') || tr.querySelector('td:nth-child(1)');
      const desc = tr.querySelector('td[data-title="Description"]') || tr.querySelector('td:nth-child(2)');
      if (!code || !desc) return;
      if ((code.textContent||'').trim().toUpperCase() === 'UPS') {
        const raw = (desc.textContent||'').trim().replace(/\s+/g,'');
        if (raw) candidates.push(raw);
      }
    });
    return candidates;
  }

  hideMainContent();
  renderView([], 'loading');

  function updateOnce() {
    const nums = findUPSNumbers();
    const overlay = document.querySelector('.wl-tracking-overlay');
    if (overlay) overlay.remove();
    renderView(nums, nums.length ? 'ready' : 'empty');
  }

  setTimeout(updateOnce, 150);
  setTimeout(updateOnce, 1200);
})();
















































/* ===========================
   1) OPEN ORDERS (LIST) ENHANCER
   =========================== */
(function(){
  if (window.__WL_OPENORDERS_ENHANCED__) return;
  window.__WL_OPENORDERS_ENHANCED__ = true;

  const t0 = performance.now();
  const log  = (...a)=>console.log('%cWL1','color:#6b0016;font-weight:700;',`[+${(performance.now()-t0).toFixed(1)}ms]`,...a);
  const warn = (...a)=>console.warn('%cWL1','color:#c2410c;font-weight:700;',`[+${(performance.now()-t0).toFixed(1)}ms]`,...a);

  if (!/OpenOrders_r\.aspx/i.test(location.pathname)) { log('Not on OpenOrders list'); return; }

  // CSS
  (function css(){
    const style = document.createElement('style');
    style.textContent = `
      /* Hide legacy table header since we render card-like rows */
      #ctl00_PageBody_OrdersGrid thead,
      .RadGrid[id*="OrdersGrid"] thead { display:none !important; }

      .wl-track-btn{
        display:inline-block;padding:6px 10px;border-radius:8px;font-weight:800;
        text-decoration:none;background:#6b0016;color:#fff;white-space:nowrap;margin-left:6px
      }
      .wl-track-btn:hover{ opacity:.92 }
      @media (max-width:640px){
        .wl-track-btn{ margin-left:0; margin-top:6px; display:inline-flex }
      }
    `;
    document.head.appendChild(style);
    log('List CSS injected');
  })();

  const host = document.querySelector('#ctl00_PageBody_OrdersGrid, .RadGrid[id*="OrdersGrid"]');
  if (!host) { warn('Orders grid host not found'); return; }
  const master = host.querySelector('#ctl00_PageBody_OrdersGrid_ctl00, .rgMasterTable');
  if (!master) { warn('Master table not found'); return; }

  const rows = Array.from(master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
  const oids = [];
  const getOid = (tr) => {
    const a = tr.querySelector('td.wide-only a[href*="oid="], td.narrow-only a[href*="oid="], a[href*="OrderDetails_r.aspx?oid="]');
    const m = a && /[?&]oid=(\d+)/.exec(a.getAttribute('href')||'');
    return m ? m[1] : null;
  };
  const inject = (tr, oid) => {
    if (!oid || tr.querySelector('.wl-track-btn')) return;
    const vt = tr.querySelector('td[data-title="Vehicle Tracking"] span[id*="VehicleTracking"]');
    const target = vt || tr.lastElementChild || tr;
    const a = document.createElement('a');
    a.className = 'wl-track-btn';
    a.href = `/OpenOrders_r.aspx?oid=${encodeURIComponent(oid)}&tracking=yes#detailsAnchor`;
    a.textContent = 'Track order';
    target.appendChild(a);
  };

  rows.forEach(tr => { const oid = getOid(tr); if (oid) { oids.push(oid); inject(tr, oid); } });
  log('Buttons injected for OIDs:', oids.join(', ') || '(none)');
})();

/* ===========================
   2) TRACKING OVERLAY (on list page with ?tracking=...)
   =========================== */
(function () {
  const qs = new URLSearchParams(location.search);
  const trackingParam = qs.get('tracking');
  if (!/OpenOrders_r\.aspx/i.test(location.pathname)) return;
  if (!trackingParam) return;
  if (window.__WL_TRACKING_VIEW__) return;
  window.__WL_TRACKING_VIEW__ = true;

  const t0 = performance.now();
  const log  = (...a)=>console.log('%cWL2','color:#6b0016;font-weight:700;',`[+${(performance.now()-t0).toFixed(1)}ms]`,...a);
  const ORDER_ID = qs.get('oid') || '';
  const explicitNumber = trackingParam && trackingParam.toLowerCase() !== 'yes'
    ? trackingParam.trim()
    : null;

  const toUPS = n => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`;

  function hideMainContent() {
    document.querySelectorAll('.bodyFlexContainer, #ctl00_PageBody_OrdersGrid, .paging-control')
      .forEach(el => { el.style.display = 'none'; });
  }

  function renderView(numbers, state) {
    const overlay = document.createElement('div');
    overlay.className = 'wl-tracking-overlay';
    overlay.innerHTML = `
      <div class="wl-track-card">
        <div class="wl-track-header">
          <div class="wl-track-title">Track your shipment</div>
          ${ORDER_ID ? `<div class="wl-track-sub">Order #${ORDER_ID}</div>` : ``}
        </div>

        ${state === 'loading' ? `
          <div class="wl-track-loading">Looking for tracking on your order…</div>
        ` : numbers.length ? `
          <div class="wl-track-list">
            ${numbers.map((n)=>`
              <div class="wl-track-line">
                <div class="wl-track-num">UPS ${n}</div>
                <a class="wl-track-btn" target="_blank" rel="noopener" href="${toUPS(n)}">View status on UPS</a>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="wl-track-empty">
            We don’t see a tracking number on this order yet.
            If you just received this link, give it a little time or contact us and we’ll check for you.
          </div>
        `}

        <div class="wl-actions">
          <a class="wl-back" href="/OpenOrders_r.aspx">← Back to Orders</a>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const css = document.createElement('style');
    css.textContent = `
      .wl-tracking-overlay {
        position: fixed; inset: 0; display: grid; place-items: center; padding: 24px;
        background: rgba(255,255,255,0.98); z-index: 9999;
      }
      .wl-track-card {
        width: min(760px, 92vw); background: #fff; border: 1px solid #e5e7eb; border-radius: 16px;
        box-shadow: 0 12px 36px rgba(0,0,0,.08); padding: 20px; font-family: inherit;
      }
      .wl-track-header { margin-bottom: 10px; }
      .wl-track-title { font-size: 22px; font-weight: 800; }
      .wl-track-sub { color: #64748b; margin-top: 2px; }
      .wl-track-loading, .wl-track-empty { color: #475569; padding: 12px 0; }
      .wl-track-list { display: flex; flex-direction: column; gap: 12px; margin-top: 6px; }
      .wl-track-line { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between;
        border: 1px solid #eef0f3; border-radius: 12px; padding: 12px; }
      .wl-track-num { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-weight: 700; }
      .wl-track-btn {
        text-decoration: none; background: #6b0016; color: #fff; padding: 10px 14px; border-radius: 10px; font-weight: 700;
      }
      .wl-track-btn:hover { opacity: .92; }
      .wl-actions { display: flex; justify-content: flex-start; margin-top: 16px; }
      .wl-back { text-decoration: none; color: #0f172a; border-bottom: 1px dashed #cbd5e1; padding-bottom: 2px; }
      @media (max-width: 480px) {
        .wl-track-line { align-items: flex-start; }
        .wl-track-btn { width: 100%; text-align: center; }
      }
    `;
    document.head.appendChild(css);
  }

  function findUPSNumbers() {
    if (explicitNumber) return [explicitNumber];
    const candidates = [];
    const table =
      document.querySelector('#ctl00_PageBody_ctl02_OrderDetailsGrid_ctl00') ||
      document.querySelector('#ctl00_PageBody_ctl02_OrderDetailsGrid .rgMasterTable') ||
      document.querySelector('.rgMasterTable');
    if (!table) return candidates;

    table.querySelectorAll('tr').forEach(tr => {
      const code = tr.querySelector('td[data-title="Product Code"]') || tr.querySelector('td:nth-child(1)');
      const desc = tr.querySelector('td[data-title="Description"]') || tr.querySelector('td:nth-child(2)');
      if (!code || !desc) return;
      if (code.textContent.trim().toUpperCase() === 'UPS') {
        const raw = desc.textContent.trim().replace(/\s+/g,'');
        if (raw) candidates.push(raw);
      }
    });
    return candidates;
  }

  hideMainContent();
  renderView([], 'loading');

  function updateOnce() {
    const nums = findUPSNumbers();
    const overlay = document.querySelector('.wl-tracking-overlay');
    if (overlay) overlay.remove();
    renderView(nums, nums.length ? 'ready' : 'empty');
    log('Overlay updated; numbers:', nums);
  }

  setTimeout(updateOnce, 150);
  setTimeout(updateOnce, 1200);
})();

/* ===========================
   3) ORDER DETAILS ENHANCER (WL3)
   - Share, Download PDF (generator-first)
   - Need help (tawk.to) with attributes/tags
   - UPS pills
   - Per-line Add to Cart (placeholder; productId resolver TBD)
   - INLINE mobile pickup barcode (SO;{ORDERNO})
   =========================== */
(function(){
  const isDetails = /OrderDetails_r\.aspx/i.test(location.pathname);
  if (!isDetails) { console.debug('WL3: not on OrderDetails page, skip'); return; }
  if (window.__WL_ORDERDETAILS_ENHANCED__) { console.debug('WL3: already enhanced, skip'); return; }
  window.__WL_ORDERDETAILS_ENHANCED__ = true;

  function start(){
    const t0 = performance.now();
    const log  = (...a)=>console.log('%cWL3','color:#6b0016;font-weight:700;',`[+${(performance.now()-t0).toFixed(1)}ms]`,...a);
    const warn = (...a)=>console.warn('%cWL3','color:#c2410c;font-weight:700;',`[+${(performance.now()-t0).toFixed(1)}ms]`,...a);
    const err  = (...a)=>console.error('%cWL3','color:#7f1d1d;font-weight:700;',`[+${(performance.now()-t0).toFixed(1)}ms]`,...a);

    /* ---------- CSS ---------- */
    (function injectCSS(){
      const css = document.createElement('style');
      css.textContent = `
        .bodyFlexContainer{ gap:14px; }
        .listPageHeader{ display:none !important; }

        .wl-od-header{
          display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between;
          background:#fff; border:1px solid #e5e7eb; border-radius:16px; padding:14px 16px;
          box-shadow:0 6px 18px rgba(0,0,0,.05);
        }
        .wl-od-header-inner{
          display:flex; flex-direction:column; gap:8px; width:100%;
        }
        .wl-od-top{
          display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between;
        }
        .wl-od-title{ display:flex; flex-wrap:wrap; align-items:center; gap:10px; }
        .wl-od-title .wl-order-no{ font-weight:900; font-size:20px; letter-spacing:.2px; }
        .wl-chip{ display:inline-flex; align-items:center; gap:6px; font-weight:800; border-radius:999px; padding:6px 10px; font-size:12px; text-transform:capitalize; }
        .wl-chip--slate{ background:#e2e8f0; color:#0f172a }
        .wl-chip--green{ background:#dcfce7; color:#065f46 }
        .wl-chip--blue{ background:#dbeafe; color:#1e3a8a }
        .wl-chip--amber{ background:#fef3c7; color:#92400e }
        .wl-chip--orange{ background:#ffedd5; color:#9a3412 }
        .wl-chip--red{ background:#fee2e2; color:#7f1d1d }
        .wl-chip--maroon{ background:#f2e6ea; color:#6b0016 }

        .wl-od-actions{ display:flex; gap:8px; flex-wrap:wrap; }
        .wl-btn{ appearance:none; border:none; border-radius:12px; font-weight:900; padding:10px 14px; text-decoration:none; cursor:pointer; }
        .wl-btn--primary{ background:#6b0016; color:#fff }
        .wl-btn--ghost{ background:#f8fafc; color:#111827; border:1px solid #e5e7eb }

        .panel.panelAccountInfo{
          width:100%; border:1px solid #e5e7eb; border-radius:16px; overflow:hidden;
          box-shadow:0 6px 18px rgba(0,0,0,.05); background:#fff;
        }
        .panel.panelAccountInfo .panelBodyHeader{
          font-weight:800; padding:10px 14px; background:#f8fafc; border-bottom:1px solid #eef0f3;
        }
        .panel.panelAccountInfo .panelBody{ padding:12px 14px; }

        #ctl00_PageBody_ctl00_OrderDetailsGrid .rgMasterTable{
          border-collapse:separate !important; border-spacing:0 10px; table-layout:auto;
        }
        #ctl00_PageBody_ctl00_OrderDetailsGrid thead{ display:none !important; }
        #ctl00_PageBody_ctl00_OrderDetailsGrid .rgRow,
        #ctl00_PageBody_ctl00_OrderDetailsGrid .rgAltRow{
          background:#fff; border:1px solid #eef0f3; border-radius:12px;
        }
        #ctl00_PageBody_ctl00_OrderDetailsGrid td{
          padding:10px; border:none !important; vertical-align:top;
        }
        #ctl00_PageBody_ctl00_OrderDetailsGrid td[data-title="Product Code"]{
          font-family:ui-monospace,Menlo,Consolas,monospace; font-weight:800; min-width:86px;
        }
        #ctl00_PageBody_ctl00_OrderDetailsGrid td[data-title="Description"]{ width:100%; }

        .wl-line-add{
          display:inline-flex; align-items:center; gap:6px;
          padding:6px 10px; border-radius:999px; font-weight:800; font-size:12px;
          border:1px solid #e5e7eb; background:#f8fafc; color:#111827; cursor:pointer; text-decoration:none;
        }

        .wl-od-tracking{
          display:flex; flex-wrap:wrap; gap:8px; margin-top:4px; margin-bottom:4px;
        }
        .wl-pill{ display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:999px; font-weight:800; font-size:12px; text-decoration:none; }
        .wl-pill--ups{ background:#111827; color:#fff; }

        /* INLINE barcode */
        .wl-barcode-inline{
          display:flex; align-items:center; gap:12px; background:#fff; border:1px solid #e5e7eb;
          border-radius:12px; padding:8px 10px; width:100%;
        }
        .wl-barcode-inline svg{ display:block; height:56px; width:auto; }
        .wl-barcode-caption{ display:flex; flex-direction:column; line-height:1.2; }
        .wl-barcode-caption .lbl{ font-weight:800; font-size:12px; color:#334155; }
        .wl-barcode-caption .val{ font-family:ui-monospace,Menlo,Consolas,monospace; font-weight:800; font-size:14px; }
        @media (min-width:769px){
          .wl-barcode-inline{ display:none; } /* mobile-only inline barcode */
        }
      `;
      document.head.appendChild(css);
      log('CSS injected');
    })();

    /* ---------- Helpers ---------- */
    const UPS_RX = /^1Z[0-9A-Z]{16}$/i;
    const toUPS = n => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`;
    const isMobile = () => matchMedia('(max-width: 768px)').matches;

    function statusColor(s){
      const x = (s||'').toLowerCase();
      if (x.includes('cancel')) return 'red';
      if (x.includes('backorder')) return 'orange';
      if (x.includes('invoice') || x.includes('billed') || x.includes('invoiced')) return 'slate';
      if (x.includes('delivered') || x.includes('shipped') || x.includes('complete')) return 'green';
      if (x.includes('ready') || x.includes('awaiting pickup')) return 'blue';
      if (x.includes('pick') || x.includes('picking') || x.includes('processing')) return 'amber';
      return 'slate';
    }

    function pickDocLinks(){
      const imgLink = document.getElementById('ctl00_PageBody_ctl00_ShowOrderImageLink')
                   || document.getElementById('ctl00_PageBody_ctl00_ShowOrderImageDropDown');
      const docLink = document.getElementById('ctl00_PageBody_ctl00_ShowOrderDocumentLink')
                   || document.getElementById('ctl00_PageBody_ctl00_ShowOrderDocumentDropDown');
      const imgHref = imgLink && imgLink.getAttribute('href');
      const docHref = docLink && docLink.getAttribute('href');
      const abs = (u)=>{ try{ return new URL(u, location.origin).toString(); }catch{ return u; } };
      const links = {
        generator: docHref ? abs(docHref) : null,   // ProcessDocument.aspx
        pdf:       imgHref && /toPdf=1/i.test(imgHref) ? abs(imgHref) : null // GetDocument.aspx … toPdf=1
      };
      log('Doc links (generator first):', links);
      return links;
    }

    async function tryFetchOk(url){
      try{
        const r = await fetch(url, { credentials:'same-origin', cache:'no-cache' });
        log('Fetch check', url, '->', r.status, r.ok);
        return r.ok;
      }catch(ex){ warn('Fetch failed', url, ex); return false; }
    }

    // Code128B -> SVG (supports needed chars, incl. ';')
    function code128B_SVG(data, opts={}){
      const CHART = (()=>{ const map={};
        const rows = [
          [0," ","212222"],[1,"!","222122"],[2,'"',"222221"],[3,"#","121223"],[4,"$","121322"],[5,"%","131222"],
          [6,"&","122213"],[7,"'","122312"],[8,"(","132212"],[9,")","221213"],[10,"*","221312"],[11,"+","231212"],
          [12,",","112232"],[13,"-","122132"],[14,".","122231"],[15,"/","113222"],[16,"0","123122"],[17,"1","123221"],
          [18,"2","223211"],[19,"3","221132"],[20,"4","221231"],[21,"5","213212"],[22,"6","223112"],[23,"7","312131"],
          [24,"8","311222"],[25,"9","321122"],[26,":","321221"],[27,";","312212"],[29,"=","322211"],[33,"A","111323"],
          [34,"B","131123"],[35,"C","131321"],[36,"D","112313"],[37,"E","132113"],[38,"F","132311"],[39,"G","211313"],
          [40,"H","231113"],[41,"I","231311"],[42,"J","112133"],[43,"K","112331"],[44,"L","132131"],[45,"M","113123"],
          [46,"N","113321"],[47,"O","133121"],[48,"P","313121"],[49,"Q","211331"],[50,"R","231131"],[51,"S","213113"],
          [52,"T","213311"],[53,"U","213131"],[54,"V","311123"],[55,"W","311321"],[56,"X","331121"],[57,"Y","312113"],
          [58,"Z","312311"],[59,"[","332111"],[60,"\\","314111"],[61,"]","221411"],[62,"^","431111"],[63,"_","111224"],
          [64,"`","111422"],[65,"a","121124"],[66,"b","121421"],[67,"c","141122"],[68,"d","141221"],[69,"e","112214"],
          [70,"f","112412"],[71,"g","122114"],[72,"h","122411"],[73,"i","142112"],[74,"j","142211"],[75,"k","241211"],
          [76,"l","221114"],[77,"m","413111"],[78,"n","241112"],[79,"o","134111"],[80,"p","111242"],[81,"q","121142"],
          [82,"r","121241"],[83,"s","114212"],[84,"t","124112"],[85,"u","124211"],[86,"v","411212"],[87,"w","421112"],
          [88,"x","421211"],[89,"y","212141"],[90,"z","214121"],[91,"{","412121"],[92,"|","111143"],[93,"}","111341"],
          [94,"~","131141"],[103,"StartA","211412"],[104,"StartB","211214"],[105,"StartC","211232"],[106,"Stop","2331112"]
        ];
        rows.forEach(([v,ch,p])=>{ if (typeof ch==='string' && ch.length===1) map[ch]=[v,p]; });
        return map;
      })();
      const START_B = { val:104, pattern:"211214" };
      const STOP    = { val:106, pattern:"2331112" };

      const codes = [START_B];
      let checksum = START_B.val;
      for (let i=0;i<data.length;i++){
        const ch = data[i];
        const entry = CHART[ch];
        if (!entry){ throw new Error("Code128B unsupported char: "+ch); }
        const [val, pattern] = entry;
        codes.push({ val, pattern });
        checksum += val * (i+1);
      }
      const checkVal = checksum % 103;
      function patternForValue(v){
        for (const k in CHART){ if (Object.prototype.hasOwnProperty.call(CHART,k)){
          if (CHART[k][0] === v) return CHART[k][1];
        }}
        const specials = { 100:"114131",101:"311141",102:"411131" };
        return specials[v] || "111111";
      }
      const checksumPattern = patternForValue(checkVal);
      const allPatterns = [START_B.pattern, ...codes.slice(1).map(c=>c.pattern), checksumPattern, STOP.pattern];

      const module = opts.module || 2;
      const height = opts.height || 120;
      let x = 0, bar = true;
      const rects = [];
      allPatterns.join('').split('').forEach(d=>{
        const w = parseInt(d,10) * module;
        if (bar) rects.push(`<rect x="${x}" y="0" width="${w}" height="${height}" />`);
        x += w; bar = !bar;
      });
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="${height}" viewBox="0 0 ${x} ${height}" fill="#000">${rects.join('')}</svg>`;
    }

    // read grid/table
    const grid = document.querySelector('#ctl00_PageBody_ctl00_OrderDetailsGrid');
    const table = grid && grid.querySelector('.rgMasterTable');
    log('Grid present:', !!grid, 'Table present:', !!table);

    function parseUPS(){
      const list = [];
      if (!table) return list;
      table.querySelectorAll('tr').forEach(tr=>{
        const codeEl = tr.querySelector('td[data-title="Product Code"]') || tr.children[0];
        const descEl = tr.querySelector('td[data-title="Description"]') || tr.children[1];
        if (!codeEl || !descEl) return;
        if ((codeEl.textContent||'').trim().toUpperCase() !== 'UPS') return;
        const raw = (descEl.textContent||'').trim().replace(/\s+/g,'').toUpperCase();
        if (raw && (UPS_RX.test(raw) || raw.length>=8)) list.push(raw);
      });
      return list;
    }
    const UPS_LIST = parseUPS();
    log('UPS numbers:', UPS_LIST);

    /* ---------- Build header (Share / Download / Copy / Help / INLINE Mobile Barcode) ---------- */
    (function buildHeader(){
      const container = document.querySelector('.bodyFlexContainer');
      if (!container) { warn('No .bodyFlexContainer'); return; }

      const oldHeader = document.querySelector('.listPageHeader');
      const orderText = oldHeader ? oldHeader.children?.[0]?.textContent?.trim() : '';
      const statusText = oldHeader ? oldHeader.children?.[1]?.textContent?.trim() : '';
      const orderNo = (orderText || '').replace(/[^\d]/g,'');
      const statusOnly = (statusText || '').replace(/^Status:\s*/i,'');
      log('Header parsed:', { orderNo, statusOnly });

      const backLink = document.getElementById('ctl00_PageBody_ctl00_BackButton');
      const imgLink  = document.getElementById('ctl00_PageBody_ctl00_ShowOrderImageLink')
                     || document.getElementById('ctl00_PageBody_ctl00_ShowOrderImageDropDown');
      const docLink  = document.getElementById('ctl00_PageBody_ctl00_ShowOrderDocumentLink')
                     || document.getElementById('ctl00_PageBody_ctl00_ShowOrderDocumentDropDown');
      const copyLink = document.getElementById('ctl00_PageBody_ctl00_AddToCart')
                     || document.getElementById('ctl00_PageBody_ctl00_AddToCartDropDown');

      // Pickup heuristic
      const isPickup = /Sales Address/i.test(document.body.innerText||'');

      // Header scaffolding with INLINE barcode container slot
      const head = document.createElement('div');
      head.className = 'wl-od-header';
      head.innerHTML = `
        <div class="wl-od-header-inner">
          <div class="wl-od-top">
            <div class="wl-od-title">
              <div class="wl-order-no">Order #${orderNo || ''}</div>
              ${statusOnly ? `<span class="wl-chip wl-chip--${statusColor(statusOnly)}">${statusOnly}</span>` : ``}
            </div>
            <div class="wl-od-actions">
              ${backLink ? `<a class="wl-btn wl-btn--ghost" href="${backLink.getAttribute('href')||'/OpenOrders_r.aspx'}">← Back</a>` : ``}
              ${imgLink  ? `<a class="wl-btn wl-btn--ghost" target="_blank" rel="noopener" href="${imgLink.getAttribute('href')||'#'}">View Image</a>` : ``}
              ${docLink  ? `<a class="wl-btn wl-btn--ghost" target="_blank" rel="noopener" href="${docLink.getAttribute('href')||'#'}">View Document</a>` : ``}
              ${docLink || imgLink ? `<button class="wl-btn wl-btn--ghost" type="button" id="wl-share-doc">Share</button>` : ``}
              ${docLink || imgLink ? `<button class="wl-btn wl-btn--ghost" type="button" id="wl-download-doc">Download PDF</button>` : ``}
              ${copyLink ? `<button class="wl-btn wl-btn--primary" type="button" id="wl-copy-lines">Copy Lines to Cart</button>` : ``}
              <button class="wl-btn wl-btn--primary" type="button" id="wl-need-help">Need help</button>
            </div>
          </div>

          ${ (isPickup && isMobile()) ? `
            <div class="wl-barcode-inline" aria-label="Pickup barcode">
              <div id="wl-barcode-inline-svg" aria-hidden="true"></div>
              <div class="wl-barcode-caption">
                <div class="lbl">Show this at pickup</div>
                <div class="val">SO;${orderNo}</div>
              </div>
            </div>
          ` : ``}
        </div>
      `;
      container.insertAdjacentElement('afterbegin', head);
      log('Header injected; pickup?', isPickup, 'mobile?', isMobile());

      // Render INLINE barcode if present
      const inlineSvgHost = head.querySelector('#wl-barcode-inline-svg');
      if (inlineSvgHost){
        try{
          inlineSvgHost.innerHTML = code128B_SVG(`SO;${orderNo}`, { module: 2, height: 80 });
          log('Inline barcode rendered: SO;', orderNo);
        }catch(ex){ err('Inline barcode render failed', ex); }
      }

      // Share
      const shareBtn = head.querySelector('#wl-share-doc');
      if (shareBtn){
        shareBtn.addEventListener('click', async (e)=>{
          e.preventDefault();
          const { generator, pdf } = pickDocLinks();
          const url = pdf || generator;
          log('Share clicked, url:', url);
          if (!url) { alert('Document not available yet.'); return; }
          const title = `Order #${orderNo} Document`;
          const text  = `Document for Order #${orderNo}`;
          try{
            if (navigator.share) { await navigator.share({ title, text, url }); log('Share via Web Share'); }
            else {
              location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text+':\n\n'+url)}`;
              log('Share via mailto');
            }
          }catch(ex){ err('Share failed', ex); }
        });
      }

      // Download (generator-first)
      const dlBtn = head.querySelector('#wl-download-doc');
      if (dlBtn){
        dlBtn.addEventListener('click', async (e)=>{
          e.preventDefault();
          const { generator, pdf } = pickDocLinks();
          log('Download click (generator first):', { generator, pdf });
          if (!generator && !pdf) { alert('Document not available yet.'); return; }

          if (pdf && await tryFetchOk(pdf)) {
            const a = document.createElement('a'); a.href = pdf; a.download = ''; document.body.appendChild(a); a.click(); requestAnimationFrame(()=>a.remove());
            log('Downloaded existing PDF'); return;
          }

          if (generator){
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none'; iframe.src = generator; document.body.appendChild(iframe);
            log('Generator kicked:', generator);
            setTimeout(async ()=>{
              if (pdf && await tryFetchOk(pdf)) {
                const a = document.createElement('a'); a.href = pdf; a.download = ''; document.body.appendChild(a); a.click(); requestAnimationFrame(()=>a.remove());
                log('Downloaded PDF after gen');
              } else {
                window.open(generator, '_blank', 'noopener');
                log('Opened generator tab (fallback)');
              }
              requestAnimationFrame(()=>iframe.remove());
            }, 900);
          } else if (pdf) {
            window.open(pdf, '_blank', 'noopener');
            log('Opened PDF directly (no generator link)');
          }
        });
      }

      // Copy Lines to Cart
      const copyBtn = head.querySelector('#wl-copy-lines');
      if (copyBtn && copyLink){
        copyBtn.addEventListener('click', (e)=>{
          e.preventDefault();
          const href = copyLink.getAttribute('href')||'';
          log('Copy Lines ->', href);
          try{
            if (href.startsWith('javascript:')) { /* eslint-disable-next-line no-eval */ eval(href.replace(/^javascript:/,'')); }
            else { location.assign(new URL(href, location.origin).toString()); }
          }catch(ex){ err('Copy Lines failed', ex); }
        });
      }

      // Need help (Tawk)
      const helpBtn = head.querySelector('#wl-need-help');
      if (helpBtn){
        helpBtn.addEventListener('click', (e)=>{
          e.preventDefault();
          const getCellText = (label) => {
            const tds = Array.from(document.querySelectorAll('.panel.panelAccountInfo td'));
            for (let i=0;i<tds.length-1;i++){
              const lhs = (tds[i].textContent||'').trim().replace(/\u00a0/g,' ');
              if (lhs.toLowerCase().startsWith(label.toLowerCase())) return (tds[i+1].textContent||'').trim();
            }
            return '';
          };
          const contactName = getCellText('Contact:') || '';
          const telRaw = getCellText('Tel:') || '';
          const phone = telRaw.replace(/[^\d+]/g,'');
          const attrs = {
            'order-id': orderNo || '',
            'status'  : statusOnly || '',
            'url'     : location.href,
            'branch'  : isPickup ? 'Pickup' : 'Delivery',
            'tracking': (UPS_LIST||[]).join(', ')
          };
          if (contactName) attrs['contact-name'] = contactName;
          if (phone) attrs['phone'] = phone;

          window.Tawk_API = window.Tawk_API || {};
          try { if (window.Tawk_API.start) { window.Tawk_API.start({ showWidget:true }); log('Tawk start(showWidget:true)'); } } catch{}
          const apply = () => {
            try { window.Tawk_API.setAttributes && window.Tawk_API.setAttributes(attrs, ()=>log('Tawk setAttributes OK')); } catch(ex){ err('Tawk setAttributes fail', ex); }
            try { window.Tawk_API.addTags && window.Tawk_API.addTags(['order-help', `order-${orderNo}`], ()=>log('Tawk addTags OK')); } catch(ex){ err('Tawk addTags fail', ex); }
            try {
              if (window.Tawk_API.maximize) window.Tawk_API.maximize();
              else if (window.Tawk_API.toggle) window.Tawk_API.toggle();
              else if (window.Tawk_API.popup) window.Tawk_API.popup();
              log('Tawk opened');
            } catch(ex){ warn('Tawk open fail', ex); }
          };
          if (window.Tawk_API.onLoad && !window.__WL_TAWK_HOOKED__){
            window.__WL_TAWK_HOOKED__ = true;
            const prev = window.Tawk_API.onLoad;
            window.Tawk_API.onLoad = function(){ try{ prev&&prev(); }catch{} apply(); };
            log('Tawk onLoad hook set');
          }
          apply();
        });
      }
    })();

    /* ---------- UPS pills (above grid) ---------- */
    (function upsPills(){
      const grid = document.querySelector('#ctl00_PageBody_ctl00_OrderDetailsGrid');
      const table = grid && grid.querySelector('.rgMasterTable');
      if (!grid || !table) return;

      const list = [];
      table.querySelectorAll('tr').forEach(tr=>{
        const codeEl = tr.querySelector('td[data-title="Product Code"]') || tr.children[0];
        const descEl = tr.querySelector('td[data-title="Description"]') || tr.children[1];
        if (!codeEl || !descEl) return;
        if ((codeEl.textContent||'').trim().toUpperCase() !== 'UPS') return;
        const raw = (descEl.textContent||'').trim().replace(/\s+/g,'').toUpperCase();
        if (raw && (UPS_RX.test(raw) || raw.length>=8)) list.push(raw);
      });
      if (!list.length) return;

      const wrap = document.createElement('div');
      wrap.className = 'wl-od-tracking';
      wrap.innerHTML = list.map(n=>`<a class="wl-pill wl-pill--ups" href="${toUPS(n)}" target="_blank" rel="noopener">UPS · ${n}</a>`).join('');
      grid.insertAdjacentElement('beforebegin', wrap);
      log('UPS pills injected:', list);
    })();

    /* ---------- Per-line Add to Cart (placeholder until productId resolver exists) ---------- */
    (function lineAddButtons(){
      const grid = document.querySelector('#ctl00_PageBody_ctl00_OrderDetailsGrid');
      const table = grid && grid.querySelector('.rgMasterTable');
      if (!grid || !table) return;

      let added = 0;
      table.querySelectorAll('tr').forEach(tr=>{
        const codeEl = tr.querySelector('td[data-title="Product Code"]') || tr.children[0];
        const descEl = tr.querySelector('td[data-title="Description"]') || tr.children[1];
        const qtyEl  = tr.querySelector('td[data-title="Qty"]') || tr.querySelector('td[data-title="Quantity"]') || tr.children[3];
        const actionCell = tr.querySelector('td:last-child') || tr.children[tr.children.length-1];
        if (!codeEl || !descEl || !actionCell) return;

        const code = (codeEl.textContent||'').trim().toUpperCase();
        if (!code || code === 'UPS') return;

        const qtyRaw = (qtyEl && qtyEl.textContent||'').trim();
        let qty = Math.max(1, Math.round(parseFloat(qtyRaw || '1')));
        if (!isFinite(qty)) qty = 1;

        const btn = document.createElement('button');
        btn.className = 'wl-line-add';
        btn.type = 'button';
        btn.textContent = `Add to cart${qty>1?` (${qty})`:''}`;
        btn.addEventListener('click', (e)=>{
          e.preventDefault();
          const placeholder = new URL(`/ShoppingCart.aspx?products=${encodeURIComponent(code)}:${qty}&cart_origin=reorder`, location.origin);
          warn('Cart needs productId (not code). Placeholder nav ->', placeholder.toString());
          location.assign(placeholder.toString());
        });

        actionCell.appendChild(btn);
        added++;
      });
      log('Per-line Add buttons injected:', added);
    })();

    log('Order Details enhanced: ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }
})();


