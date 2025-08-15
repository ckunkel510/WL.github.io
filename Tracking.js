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
















































/* ===== 3) Order Details page enhancer (OpenOrders -> "Open full order") ===== */
(function(){
  // Only run on the details page
  const isDetails = /OrderDetails_r\.aspx/i.test(location.pathname);
  if (!isDetails) return;
  if (window.__WL_ORDERDETAILS_ENHANCED__) return;
  window.__WL_ORDERDETAILS_ENHANCED__ = true;

  const t0 = performance.now();
  const log = (...a)=>console.log('%cOrderDetails UI','color:#6b0016;font-weight:700;',`[+${(performance.now()-t0).toFixed(1)}ms]`,...a);

  // ---------- CSS ----------
  (function injectCSS(){
    const css = document.createElement('style');
    css.textContent = `
      /* Page shell cleanup */
      .bodyFlexContainer{ gap:14px; }
      .listPageHeader{ display:none !important; } /* we’ll replace this with wl-od-header */

      /* Header */
      .wl-od-header{
        display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between;
        background:#fff; border:1px solid #e5e7eb; border-radius:16px; padding:14px 16px;
        box-shadow:0 6px 18px rgba(0,0,0,.05);
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
      .wl-btn:disabled{ opacity:.6; cursor:default }
      .wl-btn--primary{ background:#6b0016; color:#fff }
      .wl-btn--ghost{ background:#f8fafc; color:#111827; border:1px solid #e5e7eb }
      .wl-btn--link{ background:transparent; color:#0f172a; text-decoration:underline; }

      /* Info panels to cards */
      .panel.panelAccountInfo{
        width:100%; border:1px solid #e5e7eb; border-radius:16px; overflow:hidden;
        box-shadow:0 6px 18px rgba(0,0,0,.05); background:#fff;
      }
      .panel.panelAccountInfo .panelBodyHeader{
        font-weight:800; padding:10px 14px; background:#f8fafc; border-bottom:1px solid #eef0f3;
      }
      .panel.panelAccountInfo .panelBody{
        padding:12px 14px;
      }
      .panelAccountInfoSubtitle{ background:#f8fafc !important; }

      /* Line items grid polish */
      #ctl00_PageBody_ctl00_OrderDetailsGrid .rgMasterTable{
        border-collapse:separate !important; border-spacing:0 10px; table-layout:auto;
      }
      #ctl00_PageBody_ctl00_OrderDetailsGrid thead{ display:none !important; }
      #ctl00_PageBody_ctl00_OrderDetailsGrid .rgRow,
      #ctl00_PageBody_ctl00_OrderDetailsGrid .rgAltRow{
        background:#fff; border:1px solid #eef0f3; border-radius:12px;
      }
      #ctl00_PageBody_ctl00_OrderDetailsGrid td{
        padding:10px; border:none !important;
      }
      #ctl00_PageBody_ctl00_OrderDetailsGrid td[data-title="Product Code"]{
        font-family:ui-monospace,Menlo,Consolas,monospace; font-weight:800; min-width:86px;
      }
      #ctl00_PageBody_ctl00_OrderDetailsGrid td[data-title="Description"]{
        width:100%;
      }
      /* UPS pills area */
      .wl-od-tracking{
        display:flex; flex-wrap:wrap; gap:8px; margin-top:4px; margin-bottom:4px;
      }
      .wl-pill{ display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:999px; font-weight:800; font-size:12px; text-decoration:none; }
      .wl-pill--ups{ background:#111827; color:#fff; }
      .wl-pill--ups:hover{ opacity:.92; }

      /* Hide old “wide-only” actions row; we bring them into header */
      .bodyFlexItem.wide-only .epi-action{ display:none !important; }

      /* Tighten the side mini app-links block if visible */
      #accountlinkdiv{ display:none !important; }

      @media (max-width: 640px){
        .wl-od-title .wl-order-no{ font-size:18px; }
        .panel.panelAccountInfo .panelBody{ padding:10px 12px; }
      }
    `;
    document.head.appendChild(css);
  })();

  // ---------- Helpers ----------
  const toUPS = n => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`;
  const UPS_RX = /^1Z[0-9A-Z]{16}$/i;
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

  // ---------- Build header ----------
  (function buildHeader(){
    const container = document.querySelector('.bodyFlexContainer');
    if (!container) return;

    // Pull “Details for Order ####” + Status from original header
    const oldHeader = document.querySelector('.listPageHeader');
    const orderText = oldHeader ? oldHeader.children?.[0]?.textContent?.trim() : '';
    const statusText = oldHeader ? oldHeader.children?.[1]?.textContent?.trim() : '';
    const orderNo = (orderText || '').replace(/[^\d]/g,''); // 15513815
    const statusOnly = (statusText || '').replace(/^Status:\s*/i,'');

    // Get native action links
    const backLink = document.getElementById('ctl00_PageBody_ctl00_BackButton'); // back
    const imgLink  = document.getElementById('ctl00_PageBody_ctl00_ShowOrderImageLink')
                   || document.getElementById('ctl00_PageBody_ctl00_ShowOrderImageDropDown');
    const docLink  = document.getElementById('ctl00_PageBody_ctl00_ShowOrderDocumentLink')
                   || document.getElementById('ctl00_PageBody_ctl00_ShowOrderDocumentDropDown');
    const copyLink = document.getElementById('ctl00_PageBody_ctl00_AddToCart')
                   || document.getElementById('ctl00_PageBody_ctl00_AddToCartDropDown');

    // Header node
    const head = document.createElement('div');
    head.className = 'wl-od-header';
    head.innerHTML = `
      <div class="wl-od-title">
        <div class="wl-order-no">Order #${orderNo || ''}</div>
        ${statusOnly ? `<span class="wl-chip wl-chip--${statusColor(statusOnly)}">${statusOnly}</span>` : ``}
      </div>
      <div class="wl-od-actions">
        ${backLink ? `<a class="wl-btn wl-btn--ghost" href="${backLink.getAttribute('href')||'/OpenOrders_r.aspx'}">← Back</a>` : ``}
        ${imgLink  ? `<a class="wl-btn wl-btn--ghost" target="_blank" rel="noopener" href="${imgLink.getAttribute('href')||'#'}">Show Image</a>` : ``}
        ${docLink  ? `<a class="wl-btn wl-btn--ghost" target="_blank" rel="noopener" href="${docLink.getAttribute('href')||'#'}">Show Document</a>` : ``}
        ${copyLink ? `<button class="wl-btn wl-btn--primary" type="button" id="wl-copy-lines">Copy Lines to Cart</button>` : ``}
      </div>
    `;
    container.insertAdjacentElement('afterbegin', head);

    // Wire “Copy Lines to Cart” to the native postback link
    const copyBtn = head.querySelector('#wl-copy-lines');
    if (copyBtn && copyLink){
      copyBtn.addEventListener('click', (e)=>{
        e.preventDefault(); e.stopPropagation();
        const href = copyLink.getAttribute('href')||'';
        if (href.startsWith('javascript:')) {
          // invoke the original __doPostBack javascript
          // eslint-disable-next-line no-eval
          eval(href.replace(/^javascript:/,''));
        } else {
          location.href = href;
        }
      }, { passive:false });
    }
  })();

  // ---------- Convert UPS rows to pills ----------
  (function upsPills(){
    const grid = document.querySelector('#ctl00_PageBody_ctl00_OrderDetailsGrid');
    const table = grid && grid.querySelector('.rgMasterTable');
    if (!table) return;

    const pills = [];
    table.querySelectorAll('tr').forEach(tr=>{
      const codeEl = tr.querySelector('td[data-title="Product Code"]') || tr.children[0];
      const descEl = tr.querySelector('td[data-title="Description"]') || tr.children[1];
      if (!codeEl || !descEl) return;
      const code = (codeEl.textContent||'').trim().toUpperCase();
      if (code !== 'UPS') return;
      const raw = (descEl.textContent||'').trim().replace(/\s+/g,'').toUpperCase();
      if (!raw) return;
      if (UPS_RX.test(raw) || raw.length >= 8) pills.push(raw);

      // optional: you can hide the UPS line row to avoid duplicate info
      // tr.style.display = 'none';
    });

    if (pills.length){
      const wrap = document.createElement('div');
      wrap.className = 'wl-od-tracking';
      wrap.innerHTML = pills.map(n=>`
        <a class="wl-pill wl-pill--ups" href="${toUPS(n)}" target="_blank" rel="noopener" title="UPS ${n}">
          UPS · ${n}
        </a>
      `).join('');
      grid.insertAdjacentElement('beforebegin', wrap);
    }
  })();

  // ---------- Guard: prevent our buttons from causing postbacks ----------
  document.addEventListener('click', (e)=>{
    const btn = e.target.closest('.wl-btn');
    if (!btn) return;
    if (btn.tagName === 'BUTTON' && !btn.getAttribute('type')){
      btn.setAttribute('type','button');
    }
    e.stopPropagation();
  }, { capture:true });

  log('Order Details enhanced');
})();

