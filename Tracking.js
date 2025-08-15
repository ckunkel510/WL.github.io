/* =========================================================
   Open Orders — Amazon-style Enhanced List + Tracking Overlay
   ========================================================= */

/* ===== 1) Amazon-style enhanced order list (desktop + mobile) ===== */
(function(){
  if (window.__WL_OPENORDERS_ENHANCED__) return;
  window.__WL_OPENORDERS_ENHANCED__ = true;

  const t0 = performance.now();
  const log = (...a)=>console.log('%cOpenOrders UI','color:#6b0016;font-weight:700;',`[+${(performance.now()-t0).toFixed(1)}ms]`,...a);

  // ---------- Styles ----------
  (function injectCSS(){
    const css = document.createElement('style');
    css.textContent = `
      /* Cardified table */
      .wl-cardify tr.rgRow, .wl-cardify tr.rgAltRow{
        background:#fff;border:1px solid #e5e7eb;border-radius:14px;margin:10px 0;
        box-shadow:0 6px 18px rgba(0,0,0,.05);overflow:hidden
      }
      .wl-row-head{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px}
      .wl-row-head .wl-order-id{font-weight:800}
      .wl-chip{display:inline-flex;align-items:center;gap:6px;font-weight:700;border-radius:999px;padding:6px 10px;font-size:12px}
      .wl-chip[aria-label^="Status"]{text-transform:capitalize}
      .wl-chip--slate{background:#e2e8f0;color:#0f172a}
      .wl-chip--green{background:#dcfce7;color:#065f46}
      .wl-chip--blue{background:#dbeafe;color:#1e3a8a}
      .wl-chip--amber{background:#fef3c7;color:#92400e}
      .wl-chip--orange{background:#ffedd5;color:#9a3412}
      .wl-chip--red{background:#fee2e2;color:#7f1d1d}
      .wl-chip--maroon{background:#f2e6ea;color:#6b0016}

      .wl-actions{display:flex;gap:8px;margin-left:auto}
      .wl-btn{appearance:none;border:none;border-radius:10px;font-weight:800;padding:10px 14px;text-decoration:none;cursor:pointer}
      .wl-btn:disabled{opacity:.5;cursor:default}
      .wl-btn--primary{background:#6b0016;color:#fff}
      .wl-btn--ghost{background:#f8fafc;color:#111827;border:1px solid #e5e7eb}

      .wl-details{border-top:1px solid #eef0f3;padding:10px 10px 14px 10px;display:none}
      .wl-details.show{display:block}
      .wl-lines{display:flex;flex-direction:column;gap:10px}
      .wl-line{display:flex;justify-content:space-between;gap:10px;border:1px solid #eef0f3;border-radius:12px;padding:10px}
      .wl-line .wl-sku{font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:700}
      .wl-line .wl-desc{flex:1;min-width:140px}
      .wl-meta{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:#475569;margin-top:6px}

      .wl-tracking-pills{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
      .wl-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;font-weight:700;font-size:12px;text-decoration:none}
      .wl-pill--ups{background:#111827;color:#fff}
      .wl-pill--ups:hover{opacity:.9}

      /* Desktop niceties */
      @media (min-width: 769px){
        .wl-row-head{padding:12px 14px}
        .wl-details{padding:12px 14px 16px}
      }

      /* Make the table a "card list" on mobile */
      @media (max-width: 768px){
        .wl-cardify tr.rgRow>td, .wl-cardify tr.rgAltRow>td{display:none !important}
        .wl-cardify tr.rgRow, .wl-cardify tr.rgAltRow{display:block}
      }
    `;
    document.head.appendChild(css);
  })();

  const host = document.querySelector('#ctl00_PageBody_OrdersGrid, .RadGrid[id*="OrdersGrid"]');
  if (!host) { log('Grid host not found'); return; }
  const master = host.querySelector('#ctl00_PageBody_OrdersGrid_ctl00, .rgMasterTable');
  if (!master) { log('Master table not found'); return; }
  master.classList.add('wl-cardify');

  const rows = Array.from(master.querySelectorAll('tr.rgRow, tr.rgAltRow'));

  // Helpers
  const UPS_RX = /^1Z[0-9A-Z]{16}$/i;
  const upsUrl = n => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`;
  function statusColor(status){
    const s = (status||'').toLowerCase();
    if (s.includes('cancel')) return 'red';
    if (s.includes('backorder')) return 'orange';
    if (s.includes('invoice') || s.includes('billed')) return 'slate';
    if (s.includes('delivered') || s.includes('shipped') || s.includes('complete')) return 'green';
    if (s.includes('ready')) return 'blue';
    if (s.includes('pick')) return 'amber';
    return 'slate';
  }
  function findOrderLink(tr){ return tr.querySelector('a[href*="oid="]') || null; }
  function getOidFromHref(href){ const m = /[?&]oid=(\d+)/.exec(href||''); return m ? m[1] : null; }

  // Build the “card head” + actions
  function buildHead(tr, oid, href){
    const statusCell = tr.querySelector('td[data-title="Status"]');
    const createdCell = tr.querySelector('td[data-title="Created"]');
    const branchCell  = tr.querySelector('td[data-title="Branch"]');
    const totalCell   = tr.querySelector('td[data-title="Total Amount"], td[data-title="Goods Total"]');
    const status = statusCell ? statusCell.textContent.trim() : '';
    const created = createdCell ? createdCell.textContent.trim() : '';
    const branch = branchCell ? branchCell.textContent.trim() : '';
    const total = totalCell ? totalCell.textContent.trim() : '';

    const head = document.createElement('div');
    head.className = 'wl-row-head';
    head.innerHTML = `
      <span class="wl-order-id">Order #${oid}</span>
      <span class="wl-chip wl-chip--${statusColor(status)}" aria-label="Status: ${status}">${status || 'Status'}</span>
      <div class="wl-meta">
        ${created ? `<span>Created: ${created}</span>` : ``}
        ${branch ? `<span>Branch: ${branch}</span>` : ``}
        ${total  ? `<span>Total: ${total}</span>` : ``}
      </div>
      <div class="wl-actions">
        <button class="wl-btn wl-btn--primary" data-action="toggle-details">View details</button>
      </div>
    `;
    tr.insertAdjacentElement('afterbegin', head);

    const details = document.createElement('div');
    details.className = 'wl-details';
    details.dataset.state = 'idle'; // idle | loading | ready | error
    tr.appendChild(details);

    const btn = head.querySelector('[data-action="toggle-details"]');
    btn.addEventListener('click', async () => {
      if (details.dataset.state === 'idle') {
        await loadDetails(details, href, oid, btn);
      }
      details.classList.toggle('show');
      btn.textContent = details.classList.contains('show') ? 'Hide details' : 'View details';
    });
  }

  // Fetch & render order lines from the details page
  async function loadDetails(container, href, oid, btn){
    try{
      container.dataset.state = 'loading';
      btn.disabled = true; btn.textContent = 'Loading…';

      const url = new URL(href, location.origin).toString();
      const html = await fetch(url, { credentials:'same-origin' }).then(r=>r.text());
      const doc = new DOMParser().parseFromString(html, 'text/html');

      // Likely selectors for the details grid
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

          const code = codeEl.textContent.trim();
          const desc = descEl.textContent.trim().replace(/\s+/g,' ');
          const qty  = qtyEl ? qtyEl.textContent.trim() : '';

          if (code.toUpperCase() === 'UPS') {
            const raw = desc.replace(/\s+/g,'').toUpperCase();
            if (UPS_RX.test(raw)) upsNumbers.push(raw);
            else if (raw.length >= 8) upsNumbers.push(raw); // lenient fallback
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
        ` : `
          <div style="color:#475569;padding:8px 0;">No line items found.</div>
        `}
        ${upsNumbers.length ? `
          <div class="wl-tracking-pills">
            ${upsNumbers.map(n => `
              <a class="wl-pill wl-pill--ups" href="${upsUrl(n)}" target="_blank" rel="noopener" title="UPS ${n}">
                UPS · ${n}
              </a>
            `).join('')}
          </div>
        ` : ``}
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
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

  // Enhance each row
  const enhancedOids = [];
  rows.forEach(tr => {
    const a = findOrderLink(tr);
    if (!a) return;

    const href = a.getAttribute('href') || '';
    const oid = getOidFromHref(href);
    if (!oid) return;

    // Visually hide the original anchor; keep it for fallback/postbacks
    a.style.position = 'absolute'; a.style.width='1px'; a.style.height='1px';
    a.style.overflow='hidden'; a.style.clip='rect(1px,1px,1px,1px)'; a.setAttribute('aria-hidden','true');

    buildHead(tr, oid, new URL(href, location.origin).toString());
    enhancedOids.push(oid);
  });

  log('Enhanced rows for OIDs:', enhancedOids.join(', ') || '(none)');
})();

/* ===== 2) Existing ?tracking= overlay (kept for direct links) ===== */
(function () {
  // Run only when requested
  const qs = new URLSearchParams(location.search);
  const trackingParam = qs.get('tracking');
  if (!trackingParam) return;
  if (window.__WL_TRACKING_VIEW__) return; // hard guard
  window.__WL_TRACKING_VIEW__ = true;

  const ORDER_ID = qs.get('oid') || '';
  const explicitNumber = trackingParam && trackingParam.toLowerCase() !== 'yes'
    ? trackingParam.trim()
    : null;

  // UPS link builder + basic sanity check (lenient on purpose)
  const UPS_REGEX = /^1Z[0-9A-Z]{16}$/i;
  const toUPS = n => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`;

  // Hide main page chrome but keep header/nav
  function hideMainContent() {
    document.querySelectorAll('.bodyFlexContainer, #ctl00_PageBody_OrdersGrid, .paging-control')
      .forEach(el => { el.style.display = 'none'; });
  }

  // Build the on-site tracking UI
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

    // Styles (scoped)
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

  // Scrape UPS numbers from the details grid on this page
  function findUPSNumbers() {
    if (explicitNumber) return [explicitNumber];

    const candidates = [];
    const table =
      document.querySelector('#ctl00_PageBody_ctl02_OrderDetailsGrid_ctl00') ||
      document.querySelector('#ctl00_PageBody_ctl02_OrderDetailsGrid .rgMasterTable') ||
      document.querySelector('.rgMasterTable'); // safety
    if (!table) return candidates;

    table.querySelectorAll('tr').forEach(tr => {
      const code = tr.querySelector('td[data-title="Product Code"]') ||
                   tr.querySelector('td:nth-child(1)'); // loose fallback
      const desc = tr.querySelector('td[data-title="Description"]') ||
                   tr.querySelector('td:nth-child(2)');
      if (!code || !desc) return;
      if (code.textContent.trim().toUpperCase() === 'UPS') {
        const raw = desc.textContent.trim().replace(/\s+/g,'');
        if (raw) candidates.push(raw);
      }
    });
    return candidates;
  }

  // Boot
  hideMainContent();
  renderView([], 'loading');

  function updateOnce() {
    const nums = findUPSNumbers();
    // Replace the loading view with the final content
    const overlay = document.querySelector('.wl-tracking-overlay');
    if (overlay) overlay.remove();
    renderView(nums, nums.length ? 'ready' : 'empty');
  }

  // Try immediately, then again to catch async render
  setTimeout(updateOnce, 150);
  setTimeout(updateOnce, 1200);
})();
