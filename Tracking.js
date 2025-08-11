
(function(){
  // Run once
  if (window.__WL_OPENORDERS_TRACKER_BTNS__) return;
  window.__WL_OPENORDERS_TRACKER_BTNS__ = true;

  const startTs = performance.now();
  const log = (...args) => console.log(
    '%cOpenOrders Tracker','color:#6b0016;font-weight:bold;',
    `[+${(performance.now()-startTs).toFixed(1)}ms]`, ...args
  );

  // Styles
  (function(){
    const css = document.createElement('style');
    css.textContent = `
      .wl-track-btn{
        display:inline-block;padding:6px 10px;border-radius:8px;font-weight:700;
        text-decoration:none;background:#6b0016;color:#fff;white-space:nowrap;margin-left:4px
      }
      .wl-track-btn:hover{opacity:.9}
    `;
    document.head.appendChild(css);
  })();

  // Helpers
  const host = document.querySelector('#ctl00_PageBody_OrdersGrid, .RadGrid[id*="OrdersGrid"]');
  if (!host) { log('Grid host not found'); return; }
  const master = host.querySelector('#ctl00_PageBody_OrdersGrid_ctl00, .rgMasterTable');
  if (!master) { log('Master table not found'); return; }

  const rows = Array.from(master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
  const getOid = (tr) => {
    const a = tr.querySelector('td.wide-only a[href*="oid="], td.narrow-only a[href*="oid="]');
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

  // Inject for all orders (overlay will decide if tracking exists)
  const oids = [];
  rows.forEach(tr => {
    const oid = getOid(tr);
    if (oid) { oids.push(oid); inject(tr, oid); }
  });

  log('Buttons injected for OIDs:', oids.join(', ') || '(none)');
})();














<script>
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
    // If your theme wraps content differently, add selectors above as needed.
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
  // (relies on the order details section that loads when ?oid=... is present)
  function findUPSNumbers() {
    // Allow direct pass-through via ?tracking=<number>
    if (explicitNumber) return [explicitNumber];

    const candidates = [];
    // Most common table id; also fall back to any master table inside OrderDetails grid container
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
    // Keep all candidates, but if you want, filter to UPS-like numbers:
    // return candidates.filter(n => UPS_REGEX.test(n) || n.length >= 8);
    return candidates;
  }

  // Boot
  hideMainContent();
  renderView([], 'loading');

  // Try immediately, then wait a bit in case the details grid renders after async postback
  function updateOnce() {
    const nums = findUPSNumbers();
    // Replace the loading view with the final content
    const overlay = document.querySelector('.wl-tracking-overlay');
    if (overlay) overlay.remove();
    renderView(nums, nums.length ? 'ready' : 'empty');
  }

  // If the page already has the details section (navigated with ?oid=...), we’ll catch it now.
  // Otherwise, some skins render it a tick later; give it up to ~2 seconds total.
  setTimeout(updateOnce, 150);   // quick pass
  setTimeout(updateOnce, 1200);  // later pass
})();
</script>




