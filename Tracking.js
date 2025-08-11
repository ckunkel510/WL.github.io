
(function(){
  const UPS_REGEX = /^1Z[0-9A-Z]{16}$/i;
  const MAX_IFRAME_CONCURRENCY = 2; // number of orders checked in parallel
  const startTs = performance.now();

  function log(...args){
    const t = (performance.now() - startTs).toFixed(1).padStart(6,' ');
    console.log('%cOpenOrders Tracker','color:#6b0016;font-weight:bold;', `[+${t}ms]`, ...args);
  }

  // ---------- Grid helpers ----------
  function getGridHost(){
    return document.querySelector('#ctl00_PageBody_OrdersGrid, .RadGrid[id*="OrdersGrid"]');
  }
  function getMasterTable(host){
    return host.querySelector('#ctl00_PageBody_OrdersGrid_ctl00, .rgMasterTable');
  }
  function getRows(master){
    return Array.from(master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
  }
  function getOidFromRow(tr){
    const a = tr.querySelector('td.wide-only a[href*="oid="], td.narrow-only a[href*="oid="]');
    if (!a){ log('No OID link in row', tr.id||'(no id)'); return null; }
    const m = /[?&]oid=(\d+)/.exec(a.getAttribute('href')||'');
    if (!m){ log('Could not parse OID from href:', a.getAttribute('href')); return null; }
    return m[1];
  }
  function injectButton(tr, oid){
    const vt = tr.querySelector('td[data-title="Vehicle Tracking"] span[id*="VehicleTracking"]');
    const target = vt || tr.lastElementChild || tr;
    const a = document.createElement('a');
    a.className = 'wl-track-btn';
    a.href = `/OpenOrders_r.aspx?oid=${encodeURIComponent(oid)}&tracking=yes#detailsAnchor`;
    a.textContent = 'Track order';
    target.appendChild(a);
    log('Injected Track button for OID', oid);
  }

  // ---------- Styles ----------
  const css = document.createElement('style');
  css.textContent = `
    .wl-track-btn{display:inline-block;padding:6px 10px;border-radius:8px;font-weight:700;text-decoration:none;background:#6b0016;color:#fff;white-space:nowrap;margin-left:4px}
    .wl-track-btn:hover{opacity:.9}
    .wl-checking{font-size:12px;color:#6b7280;margin-left:4px}
    .wl-hidden-iframe{position:fixed;left:-99999px;top:-99999px;width:1px;height:1px;border:0;visibility:hidden}
  `;
  document.head.appendChild(css);

  // ---------- Iframe checker ----------
  function createHiddenIframe(){
    const ifr = document.createElement('iframe');
    ifr.className = 'wl-hidden-iframe';
    ifr.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms');
    document.body.appendChild(ifr);
    return ifr;
  }

  function checkOrderInIframe(oid){
    return new Promise((resolve) => {
      const ifr = createHiddenIframe();
      const url = `/OpenOrders_r.aspx?oid=${encodeURIComponent(oid)}#detailsAnchor`;
      let done = false;

      const cleanup = (result) => {
        if (done) return;
        done = true;
        try { ifr.remove(); } catch {}
        resolve(result);
      };

      const onLoad = () => {
        try {
          const doc = ifr.contentDocument;
          if (!doc) { log('OID', oid, 'iframe contentDocument missing'); return cleanup(false); }
          const table = doc.querySelector('#ctl00_PageBody_ctl02_OrderDetailsGrid_ctl00, .RadGrid[id*="OrderDetailsGrid"] .rgMasterTable, .rgMasterTable');
          if (!table){
            log('OID', oid, 'details grid not found in iframe');
            return cleanup(false);
          }
          let found = false, candidates = [];
          table.querySelectorAll('tr').forEach(tr => {
            const code = tr.querySelector('td[data-title="Product Code"]');
            const desc = tr.querySelector('td[data-title="Description"]');
            if (!code || !desc) return;
            if (code.textContent.trim().toUpperCase() === 'UPS'){
              const raw = desc.textContent.trim().replace(/\s+/g,'');
              if (raw) {
                candidates.push(raw);
                if (UPS_REGEX.test(raw) || raw.length >= 8) found = true;
              }
            }
          });
          log('OID', oid, 'iframe UPS candidates:', candidates.length ? candidates.join(',') : '(none)');
          cleanup(found);
        } catch (e){
          log('OID', oid, 'iframe error:', e.message||e);
          cleanup(false);
        }
      };

      ifr.addEventListener('load', () => {
        setTimeout(onLoad, 120);
        setTimeout(onLoad, 600);
      });

      setTimeout(() => {
        log('OID', oid, 'iframe timeout');
        cleanup(false);
      }, 8000);

      ifr.src = url;
      log('OID', oid, 'loading iframe:', url);
    });
  }

  // ---------- Pool ----------
  async function checkOidsWithPool(oids, onResult){
    const queue = oids.slice();
    let active = 0;

    return new Promise((resolve) => {
      const next = () => {
        if (queue.length === 0 && active === 0) return resolve();
        while (active < MAX_IFRAME_CONCURRENCY && queue.length){
          const oid = queue.shift();
          active++;
          checkOrderInIframe(oid).then(ok => onResult(oid, ok)).finally(() => {
            active--;
            next();
          });
        }
      };
      next();
    });
  }

  // ---------- Main ----------
  async function processGrid(){
    const host = getGridHost();
    if (!host){ log('Grid host not found'); return; }
    const master = getMasterTable(host);
    if (!master){ log('Master table not found yet'); return; }

    const rows = getRows(master);
    log('Rows found:', rows.length);

    const work = [];
    const rowByOid = new Map();
    for (const tr of rows){
      const oid = getOidFromRow(tr);
      if (!oid) continue;
      rowByOid.set(oid, tr);
      const vt = tr.querySelector('td[data-title="Vehicle Tracking"] span[id*="VehicleTracking"]');
      if (vt){
        const note = document.createElement('span');
        note.className = 'wl-checking';
        note.textContent = ' Checking…';
        vt.appendChild(note);
        tr.__wlChecking = note;
      }
      work.push(oid);
    }
    if (!work.length){ log('No OIDs to check.'); return; }

    await checkOidsWithPool(work, (oid, ok) => {
      const tr = rowByOid.get(oid);
      if (tr && tr.__wlChecking) { tr.__wlChecking.remove(); delete tr.__wlChecking; }
      log('OID', oid, 'UPS present =', ok);
      if (ok && tr) injectButton(tr, oid);
    });

    log('All OIDs processed.');
  }

  function init(){
    processGrid();
    if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager){
      const prm = Sys.WebForms.PageRequestManager.getInstance();
      prm.add_endRequest(function(){ log('endRequest — reprocessing'); processGrid(); });
      log('Hooked PageRequestManager endRequest');
    }
    const mo = new MutationObserver(() => processGrid());
    mo.observe(document.body, {childList:true, subtree:true});
    setTimeout(()=>{ mo.disconnect(); log('Observer stopped (15s).'); }, 15000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

