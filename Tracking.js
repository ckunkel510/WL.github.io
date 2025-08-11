
(function(){
  const UPS_REGEX = /^1Z[0-9A-Z]{16}$/i;
  const MAX_IFRAME_CONCURRENCY = 2; // polite parallelism
  const startTs = performance.now();
  const log = (...args) =>
    console.log('%cOpenOrders Tracker','color:#6b0016;font-weight:bold;',
      `[+${(performance.now()-startTs).toFixed(1)}ms]`, ...args);

  // --- grid helpers (for this page) ---
  const getGridHost = () => document.querySelector('#ctl00_PageBody_OrdersGrid, .RadGrid[id*="OrdersGrid"]');
  const getMasterTable = (host) => host && (host.querySelector('#ctl00_PageBody_OrdersGrid_ctl00') || host.querySelector('.rgMasterTable'));
  const getRows = (master) => Array.from(master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
  const getOidFromRow = (tr) => {
    const a = tr.querySelector('td.wide-only a[href*="oid="], td.narrow-only a[href*="oid="]');
    const m = a && /[?&]oid=(\d+)/.exec(a.getAttribute('href')||'');
    return m ? m[1] : null;
  };
  const injectButton = (tr, oid) => {
    if (tr.querySelector('.wl-track-btn')) return; // already added
    const vt = tr.querySelector('td[data-title="Vehicle Tracking"] span[id*="VehicleTracking"]');
    const target = vt || tr.lastElementChild || tr;
    const a = document.createElement('a');
    a.className = 'wl-track-btn';
    a.href = `/OpenOrders_r.aspx?oid=${encodeURIComponent(oid)}&tracking=yes#detailsAnchor`;
    a.textContent = 'Track order';
    target.appendChild(a);
    log('Injected button', oid);
  };

  // --- minimal styles ---
  (function(){
    const css = document.createElement('style');
    css.textContent = `
      .wl-track-btn{display:inline-block;padding:6px 10px;border-radius:8px;font-weight:700;text-decoration:none;background:#6b0016;color:#fff;white-space:nowrap;margin-left:4px}
      .wl-track-btn:hover{opacity:.9}
      .wl-checking{font-size:12px;color:#6b7280;margin-left:4px}
      .wl-hidden-iframe{position:fixed;left:-99999px;top:-99999px;width:1px;height:1px;border:0;visibility:hidden}
    `;
    document.head.appendChild(css);
  })();

  // --- iframe checker (single shot) ---
  const createHiddenIframe = () => {
    const ifr = document.createElement('iframe');
    ifr.className = 'wl-hidden-iframe';
    // no sandbox -> avoids console warning; page is same-origin
    document.body.appendChild(ifr);
    return ifr;
  };

  function checkOrderInIframe(oid){
    return new Promise((resolve) => {
      const ifr = createHiddenIframe();
      const url = `/OpenOrders_r.aspx?oid=${encodeURIComponent(oid)}#detailsAnchor`;
      let finished = false;
      const done = (ok) => { if (finished) return; finished = true; try{ ifr.remove(); }catch{} resolve(!!ok); };

      const scan = () => {
        try{
          const doc = ifr.contentDocument;
          if (!doc) return done(false);
          const table = doc.querySelector('#ctl00_PageBody_ctl02_OrderDetailsGrid_ctl00, .RadGrid[id*="OrderDetailsGrid"] .rgMasterTable, .rgMasterTable');
          if (!table) return done(false);

          let found = false;
          table.querySelectorAll('tr').forEach(tr=>{
            const code = tr.querySelector('td[data-title="Product Code"]');
            const desc = tr.querySelector('td[data-title="Description"]');
            if (!code || !desc) return;
            if (code.textContent.trim().toUpperCase() === 'UPS'){
              const raw = desc.textContent.trim().replace(/\s+/g,'');
              if (raw && (UPS_REGEX.test(raw) || raw.length >= 8)) found = true;
            }
          });
          done(found);
        }catch(e){ done(false); }
      };

      ifr.addEventListener('load', () => {
        // single pass: quick scan once
        setTimeout(scan, 200);
      });

      // safety timeout
      setTimeout(()=>done(false), 6000);

      ifr.src = url;
      log('Start iframe check', oid);
    });
  }

  async function checkOidsOnce(oids, onResult){
    // simple pool
    const queue = oids.slice();
    let active = 0;
    return new Promise((resolve)=>{
      const pump = () => {
        if (!queue.length && active === 0) return resolve();
        while (active < MAX_IFRAME_CONCURRENCY && queue.length){
          const oid = queue.shift();
          active++;
          checkOrderInIframe(oid).then(ok => onResult(oid, ok)).finally(()=>{
            active--; pump();
          });
        }
      };
      pump();
    });
  }

  async function runOnce(){
    const host = getGridHost();
    if (!host){ log('Grid host not found'); return; }
    const master = getMasterTable(host);
    if (!master){ log('Master table not found'); return; }

    const rows = getRows(master);
    const oids = rows.map(getOidFromRow).filter(Boolean);
    log('Rows:', rows.length, 'OIDs:', oids.join(',') || '(none)');

    // Show a quick "Checking…" hint (optional)
    const rowByOid = new Map();
    rows.forEach(tr => {
      const oid = getOidFromRow(tr);
      if (!oid) return;
      rowByOid.set(oid, tr);
      const vt = tr.querySelector('td[data-title="Vehicle Tracking"] span[id*="VehicleTracking"]');
      if (vt && !tr.querySelector('.wl-checking')){
        const s = document.createElement('span');
        s.className = 'wl-checking';
        s.textContent = ' Checking…';
        vt.appendChild(s);
        tr.__wlChecking = s;
      }
    });

    // One pass only
    await checkOidsOnce(oids, (oid, ok)=>{
      const tr = rowByOid.get(oid);
      if (tr && tr.__wlChecking) { tr.__wlChecking.remove(); delete tr.__wlChecking; }
      log('Result', oid, 'UPS=', ok);
      if (ok && tr) injectButton(tr, oid);
    });

    log('Done. (single pass complete)');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runOnce, { once: true });
  } else {
    runOnce();
  }
})();

