
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

