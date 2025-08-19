/* =========================================================
   Woodson — Invoices Enhancer for Invoices_r.aspx (v2.2)
   - Preserves Select-All + per-row checkboxes
   - Adds Paid/Open/Partial badge to Invoice # cells
   - Crawls AccountPayment_r.aspx across all pages
   - Honors the same From/To date range as invoices page
   - Reapplies after Telerik postbacks
   ========================================================= */

(function () {
  'use strict';
  if (window.__WL_INVOICES_ENHANCED__) return;
  window.__WL_INVOICES_ENHANCED__ = true;

  const VERSION = '2.2';
  const t0 = performance.now();
  const log  = (...a)=>console.log('%cINV','color:#005d6e;font-weight:700;',`v${VERSION} [+${(performance.now()-t0).toFixed(1)}ms]`,...a);
  const warn = (...a)=>console.warn('%cINV','color:#b45309;font-weight:700;',`v${VERSION} [+${(performance.now()-t0).toFixed(1)}ms]`,...a);

  // ---------- Light CSS (no layout overrides)
  (function injectCSS(){
    const css = `
      .wl-badge{display:inline-flex;align-items:center;gap:6px;font-weight:800;border-radius:999px;padding:2px 8px;font-size:11px;margin-left:8px;vertical-align:middle;line-height:1.6}
      .wl-badge--green{background:#dcfce7;color:#065f46}
      .wl-badge--amber{background:#fef3c7;color:#92400e}
      .wl-badge--slate{background:#e2e8f0;color:#0f172a}
      .wl-skel{background:repeating-linear-gradient(90deg,#f1f5f9,#f1f5f9 8px,#e2e8f0 8px,#e2e8f0 16px);color:transparent}
    `;
    const el = document.createElement('style'); el.textContent = css; document.head.appendChild(el);
  })();

  // ---------- Utils
  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
  async function waitFor(selector, {root=document, tries=60, interval=120} = {}){
    for (let i=0;i<tries;i++){
      const el = root.querySelector(selector);
      if (el) return el;
      await sleep(interval);
    }
    return null;
  }
  const txt = (el)=> (el?.textContent || '').trim();
  const toUSD = (n)=> Number(n).toLocaleString(undefined,{style:'currency',currency:'USD'});
  const parseMoney = (s)=> {
    const v = parseFloat(String(s||'').replace(/[^0-9.\-]/g,'') || '0');
    return Number.isFinite(v) ? v : 0;
  };
  const nearlyZero = (n)=> Math.abs(n) < 0.009;

  // ---------- Read Invoices page date range (used for AP query)
  function readInvoiceDateRange(){
    // Hidden JSON-rich inputs are most reliable
    const getClientState = (id)=>{
      const inp = document.getElementById(id);
      if (!inp) return null;
      try{
        const raw = inp.value.replace(/&quot;/g,'"');
        return JSON.parse(raw);
      }catch{ return null; }
    };
    const startState = getClientState('ctl00_PageBody_dtDateEntryStart_RadDatePicker1_dateInput_ClientState');
    const endState   = getClientState('ctl00_PageBody_dtDateEntryEnd_RadDatePicker1_dateInput_ClientState');

    const toISO = (state, fallbackInputId)=>{
      if (state?.valueAsString){ // e.g. "2025-08-19-00-00-00"
        const m = state.valueAsString.match(/^(\d{4}-\d{2}-\d{2})-/);
        if (m) return m[1];
      }
      // Fallback: visible textbox "M/D/YYYY"
      const vis = document.getElementById(fallbackInputId);
      if (vis && vis.value){
        const d = new Date(vis.value);
        if (!isNaN(d)) return d.toISOString().slice(0,10);
      }
      return null;
    };

    const startISO = toISO(startState, 'ctl00_PageBody_dtDateEntryStart_RadDatePicker1_dateInput');
    const endISO   = toISO(endState,   'ctl00_PageBody_dtDateEntryEnd_RadDatePicker1_dateInput');
    return { startISO, endISO };
  }

  // ---------- AccountPayment crawler (per date-range cache)
  function apCacheKey(startISO, endISO){
    return `wl_ap_index_v3_${startISO || 'na'}_${endISO || 'na'}`;
  }

  async function buildAccountPaymentIndex(startISO, endISO){
    const key = apCacheKey(startISO, endISO);

    // Try cache (10 minutes)
    try{
      const raw = sessionStorage.getItem(key);
      if (raw){
        const { at, data } = JSON.parse(raw);
        if (Date.now() - at < 10*60*1000){
          const map = new Map(data);
          log('AP index from cache:', map.size, {startISO, endISO});
          return map;
        }
      }
    }catch{}

    // Base URL with date range
    const base = new URL('/AccountPayment_r.aspx', location.origin);
    base.searchParams.set('searchType','TransactionDate');
    if (startISO) base.searchParams.set('startDate', `${startISO}T00:00:00`);
    if (endISO)   base.searchParams.set('endDate',   `${endISO}T23:59:59`);

    const parser = new DOMParser();
    const fetchText = async (url) => {
      const res = await fetch(url, { credentials:'same-origin', cache:'no-cache' });
      if (!res.ok) throw new Error('HTTP '+res.status);
      return res.text();
    };

    const normalizePagerUrl = (href)=>{
      const u = new URL(href, base.toString());
      // Ensure date params persist even if pager omits them
      if (startISO && !u.searchParams.get('startDate')) u.searchParams.set('startDate', `${startISO}T00:00:00`);
      if (endISO && !u.searchParams.get('endDate'))     u.searchParams.set('endDate',   `${endISO}T23:59:59`);
      if (!u.searchParams.get('searchType'))            u.searchParams.set('searchType','TransactionDate');
      u.pathname = '/AccountPayment_r.aspx';
      return u.toString();
    };

    const index = new Map();

    const parseRows = (doc)=>{
      const host = doc.querySelector('#ctl00_PageBody_InvoicesGrid') || doc;
      const tbl  = host.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || host.querySelector('.rgMasterTable');
      if (!tbl) return 0;

      let count = 0;
      const rows = tbl.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow');
      rows.forEach(tr=>{
        const type = txt(tr.querySelector('td[data-title="Type"]')) || txt(tr.children[1]);
        // Doc # span is reliable on AP page
        let docNo = txt(tr.querySelector('span[id*="_DocumentNumber"]')) ||
                    txt(tr.querySelector('td[data-title="Doc. #"] span')) ||
                    txt(tr.querySelector('td[data-title="Document #"] span'));
        const outTxt = txt(tr.querySelector('td[data-title="Amount Outstanding"]')) || txt(tr.children[8]);
        const outVal = parseMoney(outTxt);
        if (docNo && (type||'').toLowerCase() === 'invoice'){
          index.set(docNo, { outstanding: outVal });
          count++;
        }
      });
      return count;
    };

    const collectPager = (doc)=>{
      const set = new Set([base.toString()]);
      doc.querySelectorAll('ul.pagination a.page-link[href]').forEach(a=>{
        const href = a.getAttribute('href');
        if (href && /pageIndex=\d+/.test(href)) set.add(normalizePagerUrl(href));
      });
      return Array.from(set);
    };

    try{
      // First page
      const firstHTML = await fetchText(base.toString());
      const firstDoc  = parser.parseFromString(firstHTML, 'text/html');
      parseRows(firstDoc);

      // All pages via pager links
      const hrefs = collectPager(firstDoc).filter(u => u !== base.toString());
      if (hrefs.length){
        const results = await Promise.allSettled(hrefs.map(h=>fetchText(h)));
        results.forEach(r=>{
          if (r.status === 'fulfilled'){
            const d = parser.parseFromString(r.value, 'text/html');
            parseRows(d);
          }
        });
      }
      log('AP index built:', index.size, {startISO, endISO});
    }catch(err){
      warn('AP crawl failed:', err);
    }

    try{
      sessionStorage.setItem(key, JSON.stringify({at: Date.now(), data: Array.from(index.entries())}));
    }catch{}

    return index;
  }

  let __AP_PROMISE__ = null;
  async function ensureApIndex(){
    const { startISO, endISO } = readInvoiceDateRange();
    if (!__AP_PROMISE__) {
      __AP_PROMISE__ = buildAccountPaymentIndex(startISO, endISO);
    }
    return __AP_PROMISE__;
  }

  // ---------- Invoices grid detection
  async function findInvoicesMasterTable(){
    const gridRoot = await waitFor('#ctl00_PageBody_InvoicesGrid', {tries:60, interval:150});
    if (!gridRoot) return null;
    const table = gridRoot.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || gridRoot.querySelector('.rgMasterTable');
    return table || null;
  }

  // ---------- Helpers for row parsing
  function getInvoiceNumberFromRow(tr){
    // Prefer the display invoice number (anchor text), not "invoiceid"
    const cellWide   = tr.querySelector('td.wide-only[data-title="Invoice #"]');
    const cellNarrow = tr.querySelector('td.narrow-only[data-title="Invoice #"]');
    const aWide = cellWide ? cellWide.querySelector('a') : null;
    const aNarrow = cellNarrow ? cellNarrow.querySelector('a') : null;
    const num = txt(aWide) || txt(aNarrow);
    return num || '';
  }

  function getTotalAmountFromRow(tr){
    const td = tr.querySelector('td[data-title="Total Amount"]');
    return parseMoney(td ? td.textContent : '0');
  }

  function placeBadgeIntoInvoiceCells(tr){
    const targets = [];
    const cellWide   = tr.querySelector('td.wide-only[data-title="Invoice #"]');
    const cellNarrow = tr.querySelector('td.narrow-only[data-title="Invoice #"]');
    if (cellWide) targets.push(cellWide);
    if (cellNarrow) targets.push(cellNarrow);

    targets.forEach(cell=>{
      let badge = cell.querySelector('.wl-badge');
      if (!badge){
        badge = document.createElement('span');
        badge.className = 'wl-badge wl-badge--slate';
        badge.innerHTML = '<span class="wl-skel">checking…</span>';
        cell.appendChild(badge);
      }
    });
  }

  function setBadge(cell, cls, text){
    const badge = cell.querySelector('.wl-badge');
    if (!badge) return;
    badge.className = `wl-badge ${cls}`;
    badge.textContent = text;
  }

  // ---------- Apply badges to all visible rows (idempotent)
  async function applyBadges(masterTable){
    const rows = Array.from(masterTable.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
    if (!rows.length){ log('No invoice rows found'); return; }

    const apIndex = await ensureApIndex().catch(()=>null);

    rows.forEach(tr=>{
      const invNo = getInvoiceNumberFromRow(tr);
      if (!invNo) return;

      // Insert badge placeholders in both invoice cells
      placeBadgeIntoInvoiceCells(tr);

      const invCells = tr.querySelectorAll('td[data-title="Invoice #"].wide-only, td[data-title="Invoice #"].narrow-only');
      if (!apIndex){ // fallback if AP fetch failed
        invCells.forEach(cell=> setBadge(cell, 'wl-badge--slate', 'Status N/A'));
        return;
      }

      const info = apIndex.get(invNo); // Doc.# on AP equals the visible invoice number here
      const total = getTotalAmountFromRow(tr);

      if (!info){
        // Not on AccountPayment table → treated as fully applied/paid
        invCells.forEach(cell=> setBadge(cell, 'wl-badge--green', 'Paid'));
      }else{
        const out = Number(info.outstanding) || 0;
        if (nearlyZero(out)){
          invCells.forEach(cell=> setBadge(cell, 'wl-badge--green', 'Paid'));
        }else{
          // Distinguish Open vs Partial using invoice "Total Amount" on this grid
          if (Number.isFinite(total) && out < total - 0.009){
            invCells.forEach(cell=> setBadge(cell, 'wl-badge--amber', `Partial · ${toUSD(out)} left`));
          }else{
            invCells.forEach(cell=> setBadge(cell, 'wl-badge--amber', `Open · ${toUSD(out)}`));
          }
        }
      }
    });

    log('Badges applied to invoice rows:', rows.length);
  }

  // ---------- Re-apply after Telerik updates
  function attachGridObserver(){
    const gridRoot = document.getElementById('ctl00_PageBody_InvoicesGrid');
    if (!gridRoot) return;
    const mo = new MutationObserver(()=>{
      const master = gridRoot.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || gridRoot.querySelector('.rgMasterTable');
      if (master){
        // Debounce a frame so DOM settles
        requestAnimationFrame(()=>applyBadges(master));
      }
    });
    mo.observe(gridRoot, { childList:true, subtree:true });
    log('Grid observer attached');
  }

  // ---------- Boot
  async function boot(){
    // Only act when the invoices grid exists (path-agnostic)
    const master = await findInvoicesMasterTable();
    if (!master){
      log('No invoices grid found on this page');
      return;
    }

    // Build/ensure AP index for current date range, then apply
    try{
      await ensureApIndex();
    }catch(e){
      warn('AP index build error', e);
    }
    await applyBadges(master);
    attachGridObserver();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
  // Safety rerun after full load (in case Telerik finishes late)
  window.addEventListener('load', ()=>boot(), { once:true });

  // Expose manual trigger for debugging
  window.WLInvoices = { run: boot, version: VERSION };

})();
