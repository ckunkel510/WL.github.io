
(function(){
  const UPS_REGEX = /^1Z[0-9A-Z]{16}$/i;
  const MAX_IFRAME_CONCURRENCY = 2;
  const startTs = performance.now();

  // ---- tiny logger ----
  const log = (...args) => console.log('%cOpenOrders Tracker','color:#6b0016;font-weight:bold;', `[+${(performance.now()-startTs).toFixed(1)}ms]`, ...args);

  // ---- state ----
  const checked = new Map();     // oid -> true/false
  const inflight = new Set();    // oids currently checking
  let lastSignature = '';
  let observer, debounceTimer;

  // ---- grid helpers ----
  const getGridHost = () => document.querySelector('#ctl00_PageBody_OrdersGrid, .RadGrid[id*="OrdersGrid"]');
  const getMasterTable = (host) => host && (host.querySelector('#ctl00_PageBody_OrdersGrid_ctl00') || host.querySelector('.rgMasterTable'));
  const getRows = (master) => Array.from(master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
  const getOidFromRow = (tr) => {
    const a = tr.querySelector('td.wide-only a[href*="oid="], td.narrow-only a[href*="oid="]');
    const m = a && /[?&]oid=(\d+)/.exec(a.getAttribute('href')||'');
    return m ? m[1] : null;
  };
  const injectButton = (tr, oid) => {
    if (tr.querySelector('.wl-track-btn')) return; // already injected
    const vt = tr.querySelector('td[data-title="Vehicle Tracking"] span[id*="VehicleTracking"]');
    const target = vt || tr.lastElementChild || tr;
    const a = document.createElement('a');
    a.className='wl-track-btn';
    a.href=`/OpenOrders_r.aspx?oid=${encodeURIComponent(oid)}&tracking=yes#detailsAnchor`;
    a.textContent='Track order';
    target.appendChild(a);
    log('Injected button', oid);
  };

  // ---- styles ----
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

  // ---- iframe checker (runs page scripts, then reads DOM) ----
  const createHiddenIframe = () => {
    const ifr = document.createElement('iframe');
    ifr.className = 'wl-hidden-iframe';
    ifr.setAttribute('sandbox','allow-same-origin allow-scripts allow-forms');
    document.body.appendChild(ifr);
    return ifr;
  };

  function checkOrderInIframe(oid){
    return new Promise((resolve) => {
      const ifr = createHiddenIframe();
      const url = `/OpenOrders_r.aspx?oid=${encodeURIComponent(oid)}#detailsAnchor`;
      let finished = false;
      const done = (ok) => { if (finished) return; finished = true; try{ifr.remove();}catch{} resolve(ok); };

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
        // try twice to allow UpdatePanel to finish
        setTimeout(scan, 150);
        setTimeout(scan, 650);
      });
      setTimeout(()=>done(false), 8000); // safety
      ifr.src = url;
      log('Start iframe check', oid);
    });
  }

  // pool the checks
  async function checkOidsWithPool(oids, onResult){
    const queue = oids.slice();
    let active = 0;
    return new Promise((resolve)=>{
      const pump = () => {
        if (!queue.length && active === 0) return resolve();
        while (active < MAX_IFRAME_CONCURRENCY && queue.length){
          const oid = queue.shift();
          active++;
          inflight.add(oid);
          checkOrderInIframe(oid).then(ok => onResult(oid, ok)).finally(()=>{
            inflight.delete(oid);
            active--;
            pump();
          });
        }
      };
      pump();
    });
  }

  // ---- main runner (debounced) ----
  async function processGrid(){
    const host = getGridHost();
    if (!host) { log('Grid host not found'); return; }
    const master = getMasterTable(host);
    if (!master) { log('Master table not found yet'); return; }

    const rows = getRows(master);
    const oids = rows.map(getOidFromRow).filter(Boolean);
    const signature = oids.join(',');

    // skip if nothing changed and no inflight work
    if (signature === lastSignature && inflight.size === 0) return;
    lastSignature = signature;

    log('Rows:', rows.length, 'OIDs:', signature || '(none)');

    const toCheck = [];
    const rowByOid = new Map();
    rows.forEach(tr => {
      const oid = getOidFromRow(tr);
      if (!oid) return;
      rowByOid.set(oid, tr);

      if (checked.has(oid)) {
        // already resolved
        if (checked.get(oid) === true) injectButton(tr, oid);
        return;
      }
      if (inflight.has(oid)) return; // already checking

      // mark UI as checking once
      if (!tr.querySelector('.wl-checking')) {
        const vt = tr.querySelector('td[data-title="Vehicle Tracking"] span[id*="VehicleTracking"]');
        if (vt) { const s=document.createElement('span'); s.className='wl-checking'; s.textContent=' Checking…'; vt.appendChild(s); tr.__wlChecking = s; }
      }
      toCheck.push(oid);
    });

    if (!toCheck.length) return;

    await checkOidsWithPool(toCheck, (oid, ok)=>{
      checked.set(oid, !!ok);
      const tr = rowByOid.get(oid);
      if (tr && tr.__wlChecking) { tr.__wlChecking.remove(); delete tr.__wlChecking; }
      log('Result', oid, 'UPS=', ok);
      if (ok && tr) injectButton(tr, oid);
    });

    // if we got here and nothing is inflight, we can stop observing for now
    if (inflight.size === 0 && observer) {
      log('Quiescent — disconnecting observer until next postback.');
      observer.disconnect();
      observer = null;
    }
  }

  function schedule(){
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processGrid, 500);
  }

  function init(){
    schedule();

    // Observe only around the grid to reduce noise
    const host = getGridHost() || document.body;
    observer = new MutationObserver(schedule);
    observer.observe(host === document.body ? document.body : host.parentElement || host, { childList:true, subtree:true });

    // Re-run after ASP.NET partial postbacks
    if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager){
      const prm = Sys.WebForms.PageRequestManager.getInstance();
      prm.add_endRequest(function(){
        log('endRequest');
        // force reprocess: reset signature so next run isn’t skipped
        lastSignature = '';
        // reattach observer if we had disconnected
        if (!observer){
          const h = getGridHost() || document.body;
          observer = new MutationObserver(schedule);
          observer.observe(h === document.body ? document.body : h.parentElement || h, { childList:true, subtree:true });
        }
        schedule();
      });
      log('Hooked PageRequestManager endRequest');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
