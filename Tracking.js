
(function () {
  const UPS_REGEX = /^1Z[0-9A-Z]{16}$/i;
  const DEBUG = true;
  const startTs = performance.now();

  // ——— Debug UI ———
  let logPanel;
  function log(...args){ 
    const t = (performance.now() - startTs).toFixed(1).padStart(6,' ');
    const line = `[+${t}ms] ${args.join(' ')}`;
    console.log('%cOpenOrders Tracker','color:#6b0016;font-weight:bold;', line);
    if (!DEBUG) return;
    if (!logPanel){
      logPanel = document.createElement('div');
      logPanel.id='wl-debug-console';
      logPanel.style.cssText='position:fixed;right:12px;bottom:12px;width:360px;max-height:40vh;background:#0b1020;color:#dbeafe;font:12px ui-monospace,Menlo,Consolas,monospace;border:1px solid #334155;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.25);padding:8px;overflow:auto;z-index:99999';
      logPanel.innerHTML = `<div style="font-weight:700;margin-bottom:6px;color:#93c5fd">OpenOrders Tracker — Debug</div><div id="wl-debug-lines"></div>`;
      document.body.appendChild(logPanel);
    }
    const lines = logPanel.querySelector('#wl-debug-lines');
    const d=document.createElement('div'); d.textContent=line; lines.appendChild(d);
    logPanel.scrollTop = logPanel.scrollHeight;
  }

  // ——— Selectors (more forgiving) ———
  function getGridHost(){
    // typical: #ctl00_PageBody_OrdersGrid
    // fallback: any RadGrid whose id contains OrdersGrid
    return document.querySelector('#ctl00_PageBody_OrdersGrid, .RadGrid[id*="OrdersGrid"]');
  }
  function getMasterTable(host){
    // typical: #ctl00_PageBody_OrdersGrid_ctl00
    return host.querySelector('#ctl00_PageBody_OrdersGrid_ctl00, .rgMasterTable');
  }

  function getRows(master){
    return Array.from(master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
  }

  function getOidFromRow(tr){
    const a = tr.querySelector('td.wide-only a[href*="oid="], td.narrow-only a[href*="oid="]');
    if (!a){ log('Row has no OID link:', tr.id || '(no id)'); return null; }
    const m = /[?&]oid=(\d+)/.exec(a.getAttribute('href') || '');
    if (!m){ log('Could not parse OID from href:', a.getAttribute('href')); return null; }
    return m[1];
  }

  async function hasUPSTracking(oid){
    const url = `/OrderDetails_r.aspx?oid=${encodeURIComponent(oid)}`;
    log('Fetching details for OID', oid);
    let res;
    try { res = await fetch(url, {credentials:'same-origin'}); }
    catch(e){ log('Fetch failed for', oid, e.message||e); return false; }
    if (!res.ok){ log('HTTP', res.status, 'for', oid); return false; }
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const table = doc.querySelector('#ctl00_PageBody_ctl02_OrderDetailsGrid_ctl00, .rgMasterTable');
    if (!table){ log('Details grid missing for', oid); return false; }
    let found=false;
    table.querySelectorAll('tr').forEach(tr=>{
      const code = tr.querySelector('td[data-title="Product Code"]');
      const desc = tr.querySelector('td[data-title="Description"]');
      if (!code || !desc) return;
      if (code.textContent.trim().toUpperCase() === 'UPS'){
        const raw = desc.textContent.trim().replace(/\s+/g,'');
        if (raw && (UPS_REGEX.test(raw) || raw.length>=8)) found=true;
      }
    });
    log('OID', oid, 'UPS present =', found);
    return found;
  }

  function injectButton(tr, oid){
    const vtSpan = tr.querySelector('td[data-title="Vehicle Tracking"] span[id*="VehicleTracking"]');
    const target = vtSpan || tr.lastElementChild;
    if (!target){ log('No inject target for', oid); return; }
    const a = document.createElement('a');
    a.className='wl-track-btn';
    a.href=`/OpenOrders_r.aspx?oid=${encodeURIComponent(oid)}&tracking=yes#detailsAnchor`;
    a.textContent='Track order';
    target.appendChild(a);
    log('Injected button for', oid);
  }

  // ——— Styles ———
  const css = document.createElement('style');
  css.textContent = `
    .wl-track-btn{display:inline-block;padding:6px 10px;border-radius:8px;font-weight:700;text-decoration:none;background:#6b0016;color:#fff;white-space:nowrap;margin-left:4px}
    .wl-track-btn:hover{opacity:.9}
    .wl-checking{font-size:12px;color:#6b7280;margin-left:4px}
  `;
  document.head.appendChild(css);

  // ——— Main work ———
  let processedOnce = false;

  async function processGrid(){
    const host = getGridHost();
    if (!host){ log('Grid host not found'); return false; }
    const master = getMasterTable(host);
    if (!master){ log('Master table not found (yet) inside host'); return false; }

    const rows = getRows(master);
    log('Rows:', rows.length);

    for (const tr of rows){
      const oid = getOidFromRow(tr);
      if (!oid) continue;

      // lightweight “checking”
      const vt = tr.querySelector('td[data-title="Vehicle Tracking"] span[id*="VehicleTracking"]');
      let note;
      if (vt){ note = document.createElement('span'); note.className='wl-checking'; note.textContent=' Checking…'; vt.appendChild(note); }

      try{
        const ok = await hasUPSTracking(oid);
        if (note) note.remove();
        if (ok) injectButton(tr, oid);
      }catch(e){
        if (note) note.remove();
        log('Error processing', oid, e.message||e);
      }
    }
    processedOnce = true;
    log('Processing complete.');
    return true;
  }

  // Debounced observer to avoid spam
  let debounceTimer;
  function scheduleProcess(){
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processGrid, 150);
  }

  // Boot on DOMReady
  function init(){
    scheduleProcess();

    // Observe body for async render
    const mo = new MutationObserver(()=>{
      // only keep observing until we have processed at least once with a grid present
      scheduleProcess();
    });
    mo.observe(document.body, {childList:true, subtree:true});

    // Stop after 15s if nothing shows
    setTimeout(()=>{ mo.disconnect(); log('Observer stopped (15s).'); }, 15000);

    // Re-run after ASP.NET UpdatePanel postbacks (if present)
    if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager){
      const prm = Sys.WebForms.PageRequestManager.getInstance();
      prm.add_endRequest(function(){ log('endRequest — reprocessing'); scheduleProcess(); });
      log('Hooked PageRequestManager endRequest');
    }
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

