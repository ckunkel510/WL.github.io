/* =========================================================
   Woodson — Invoices Enhancer for Invoices_r.aspx (v3.0)
   - Preserves Select-All + per-row checkboxes
   - Paid/Open/Partial badge (AP crawl across pages)
   - Modern UI styling + toolbar filters
   - Reapplies after Telerik postbacks (MutationObserver)
   ========================================================= */

(function () {
  'use strict';
  if (window.__WL_INVOICES_ENHANCED__) return;
  window.__WL_INVOICES_ENHANCED__ = true;

  const VERSION = '3.0';
  const t0 = performance.now();
  const log  = (...a)=>console.log('%cINV','color:#005d6e;font-weight:700;',`v${VERSION} [+${(performance.now()-t0).toFixed(1)}ms]`,...a);
  const warn = (...a)=>console.warn('%cINV','color:#b45309;font-weight:700;',`v${VERSION} [+${(performance.now()-t0).toFixed(1)}ms]`,...a);

  /* -------------------- CSS -------------------- */
  (function injectCSS(){
    const css = `
      /* Container polish */
      #ctl00_PageBody_InvoicesGrid {
        border-radius: 12px;
        box-shadow: 0 6px 18px rgba(15,23,42,.06);
        overflow: hidden; /* keeps sticky headers clean on scroll */
        background: #fff;
      }

      /* Toolbar */
      .wl-toolbar {
        display:flex; align-items:center; gap:10px; flex-wrap:wrap;
        margin: 12px 0 10px 0;
      }
      .wl-chip {
        border:1px solid #e5e7eb; border-radius:999px; padding:6px 10px; font-weight:700;
        background:#fff; color:#0f172a; font-size:12px; cursor:pointer; user-select:none;
      }
      .wl-chip[data-active="true"] {
        border-color:#0ea5e9; background:#e0f2fe; color:#075985;
      }
      .wl-spacer { flex:1 1 auto; }
      .wl-btn {
        border:1px solid #e5e7eb; border-radius:10px; padding:6px 10px; font-weight:700;
        background:#f8fafc; color:#0f172a; font-size:12px; cursor:pointer;
      }
      .wl-btn:active { transform: translateY(1px); }

      /* Badges from v2, tweaked */
      .wl-badge{display:inline-flex;align-items:center;gap:6px;font-weight:800;border-radius:999px;padding:2px 8px;font-size:11px;margin-left:8px;vertical-align:middle;line-height:1.6}
      .wl-badge--green{background:#dcfce7;color:#065f46}
      .wl-badge--amber{background:#fef3c7;color:#92400e}
      .wl-badge--slate{background:#e2e8f0;color:#0f172a}
      .wl-skel{background:repeating-linear-gradient(90deg,#f1f5f9,#f1f5f9 8px,#e2e8f0 8px,#e2e8f0 16px);color:transparent}

      /* Modern table look */
      .RadGrid .rgMasterTable { border-collapse: separate; border-spacing: 0; }
      .RadGrid .rgMasterTable thead th.rgHeader {
        position: sticky; top: 0; z-index: 2;
        background: #f8fafc; color:#0f172a; font-weight:800; font-size:12px;
        border-bottom: 1px solid #e5e7eb;
      }
      /* Compact rows */
      .RadGrid .rgMasterTable td, .RadGrid .rgMasterTable th {
        padding: 10px 12px !important;
        vertical-align: middle;
      }
      /* Zebra + hover */
      .RadGrid .rgMasterTable tbody tr.rgRow    { background:#ffffff; }
      .RadGrid .rgMasterTable tbody tr.rgAltRow { background:#fbfdff; }
      .RadGrid .rgMasterTable tbody tr:hover { background:#f1f5f9; }
      /* Subtle row separators */
      .RadGrid .rgMasterTable tbody td { border-bottom: 1px dashed #e5e7eb; }
      .RadGrid .rgMasterTable tbody tr:last-child td { border-bottom: none; }

      /* Sticky first column (selector) */
      .rgMasterTable td:first-child, .rgMasterTable th:first-child {
        position: sticky; left: 0; z-index: 3; background: inherit;
      }
      /* Better number alignment */
      td[data-title="Goods Total"], td[data-title="Tax"], td[data-title="Total Amount"] { text-align: right !important; font-variant-numeric: tabular-nums; }

      /* Overdue marker */
      .wl-overdue-dot {
        display:inline-block; width:8px; height:8px; border-radius:999px; background:#ef4444; margin-left:6px;
      }

      /* Make grid area scrollable if tall; header remains sticky */
      .wl-grid-wrap {
        max-height: 68vh; overflow:auto; border-radius:12px; background:#fff;
      }
    `;
    const el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
  })();

  /* -------------------- Utils -------------------- */
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

  /* -------------------- Date range (Invoices page) -------------------- */
  function readInvoiceDateRange(){
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
      if (state?.valueAsString){
        const m = state.valueAsString.match(/^(\d{4}-\d{2}-\d{2})-/);
        if (m) return m[1];
      }
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

  /* -------------------- AccountPayment crawler -------------------- */
  function apCacheKey(startISO, endISO){
    return `wl_ap_index_v3_${startISO || 'na'}_${endISO || 'na'}`;
  }

  async function buildAccountPaymentIndex(startISO, endISO){
    const key = apCacheKey(startISO, endISO);

    // Cache 10 minutes
    try{
      const raw = sessionStorage.getItem(key);
      if (raw){
        const { at, data } = JSON.parse(raw);
        if (Date.now() - at < 10*60*1000){
          return new Map(data);
        }
      }
    }catch{}

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
      const firstHTML = await fetchText(base.toString());
      const firstDoc  = parser.parseFromString(firstHTML, 'text/html');
      parseRows(firstDoc);

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
    }catch(err){ warn('AP crawl failed:', err); }

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

  /* -------------------- Invoices grid detection -------------------- */
  async function getGridRoot(){ return await waitFor('#ctl00_PageBody_InvoicesGrid',{tries:60,interval:150}); }
  async function getMasterTable(){
    const root = await getGridRoot();
    if (!root) return null;
    return root.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || root.querySelector('.rgMasterTable');
  }

  /* -------------------- Row helpers -------------------- */
  function getInvoiceNumberFromRow(tr){
    const cellWide   = tr.querySelector('td.wide-only[data-title="Invoice #"]');
    const cellNarrow = tr.querySelector('td.narrow-only[data-title="Invoice #"]');
    const aWide = cellWide ? cellWide.querySelector('a') : null;
    const aNarrow = cellNarrow ? cellNarrow.querySelector('a') : null;
    return txt(aWide) || txt(aNarrow) || '';
  }
  function getTotalAmountFromRow(tr){
    const td = tr.querySelector('td[data-title="Total Amount"]');
    return parseMoney(td ? td.textContent : '0');
  }
  function getDueDateFromRow(tr){
    const td = tr.querySelector('td[data-title="Due Date"]');
    const s = td ? txt(td) : '';
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }
  function todayAtMidnight(){
    const d = new Date(); d.setHours(0,0,0,0); return d;
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

  /* -------------------- Badging + Status tagging -------------------- */
  async function applyBadges(master){
    const rows = Array.from(master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
    if (!rows.length){ return; }

    const apIndex = await ensureApIndex().catch(()=>null);
    const today = todayAtMidnight();

    rows.forEach(tr=>{
      const invNo = getInvoiceNumberFromRow(tr);
      if (!invNo) return;

      placeBadgeIntoInvoiceCells(tr);
      const invCells = tr.querySelectorAll('td[data-title="Invoice #"].wide-only, td[data-title="Invoice #"].narrow-only');

      let status = 'unknown';
      if (!apIndex){
        invCells.forEach(cell=> setBadge(cell, 'wl-badge--slate', 'Status N/A'));
        status = 'unknown';
      }else{
        const info = apIndex.get(invNo);
        const total = getTotalAmountFromRow(tr);
        if (!info || nearlyZero(info.outstanding)){
          invCells.forEach(cell=> setBadge(cell, 'wl-badge--green', 'Paid'));
          status = 'paid';
        }else{
          const out = Number(info.outstanding) || 0;
          if (Number.isFinite(total) && out < total - 0.009){
            invCells.forEach(cell=> setBadge(cell, 'wl-badge--amber', `Partial · ${toUSD(out)} left`));
            status = 'partial';
          }else{
            invCells.forEach(cell=> setBadge(cell, 'wl-badge--amber', `Open · ${toUSD(out)}`));
            status = 'open';
          }
        }
      }

      // Add overdue dot for open/partial & past due date
      const due = getDueDateFromRow(tr);
      const overdue = (status === 'open' || status === 'partial') && due && due < today;
      tr.dataset.status = status;
      tr.dataset.overdue = overdue ? '1' : '0';

      if (overdue){
        invCells.forEach(cell=>{
          if (!cell.querySelector('.wl-overdue-dot')){
            const dot = document.createElement('span');
            dot.className = 'wl-overdue-dot';
            dot.title = 'Overdue';
            cell.appendChild(dot);
          }
        });
      }else{
        invCells.forEach(cell=>{
          const dot = cell.querySelector('.wl-overdue-dot');
          if (dot) dot.remove();
        });
      }
    });
  }

  /* -------------------- Modernize grid: wrapper + toolbar -------------------- */
  function ensureGridWrapper(){
    const root = document.getElementById('ctl00_PageBody_InvoicesGrid');
    if (!root) return null;
    if (root.__wlWrapped) return root.__wlWrapped;

    // Wrap the table in a scroll container for sticky header to shine
    const table = root.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || root.querySelector('.rgMasterTable');
    if (!table) return null;

    const wrap = document.createElement('div');
    wrap.className = 'wl-grid-wrap';
    table.parentNode.insertBefore(wrap, table);
    wrap.appendChild(table);
    root.__wlWrapped = wrap;
    return wrap;
  }

  function ensureToolbar(){
    // Insert just above the grid container (inside same bodyFlexItem)
    const gridFlexItem = document.getElementById('ctl00_PageBody_InvoicesGrid')?.closest('.bodyFlexItem') || document.getElementById('ctl00_PageBody_InvoicesGrid');
    if (!gridFlexItem) return null;
    if (gridFlexItem.querySelector('.wl-toolbar')) return gridFlexItem.querySelector('.wl-toolbar');

    const bar = document.createElement('div');
    bar.className = 'wl-toolbar';
    bar.innerHTML = `
      <button class="wl-chip" data-filter="all" data-active="true">All</button>
      <button class="wl-chip" data-filter="open">Open</button>
      <button class="wl-chip" data-filter="partial">Partial</button>
      <button class="wl-chip" data-filter="paid">Paid</button>
      <div class="wl-spacer"></div>
      <button class="wl-btn" data-action="select-filtered">Select filtered</button>
    `;
    gridFlexItem.insertBefore(bar, gridFlexItem.firstChild);
    return bar;
  }

  function applyFilter(filter){
    const master = document.querySelector('#ctl00_PageBody_InvoicesGrid .rgMasterTable');
    if (!master) return;
    const rows = master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow');
    rows.forEach(tr=>{
      const status = tr.dataset.status || 'unknown';
      const show = (filter === 'all') ? true : (status === filter);
      tr.style.display = show ? '' : 'none';
    });
  }

  function selectFilteredOnPage(){
    // Only touch row checkboxes that are visible
    const root = document.getElementById('ctl00_PageBody_InvoicesGrid');
    if (!root) return;
    const boxes = root.querySelectorAll('tbody input[type="checkbox"][name*="chkSelect"]');
    boxes.forEach(cb=>{
      const tr = cb.closest('tr');
      if (tr && tr.style.display !== 'none'){
        if (!cb.checked){
          cb.click(); // triggers Telerik postback handler if any
        }
      }
    });
  }

  function wireToolbar(bar){
    if (!bar || bar.__wired) return;
    bar.__wired = true;

    const setActive = (btn)=>{
      bar.querySelectorAll('.wl-chip').forEach(b=>b.dataset.active='false');
      btn.dataset.active='true';
    };

    bar.addEventListener('click', (e)=>{
      const chip = e.target.closest('.wl-chip');
      const btn  = e.target.closest('.wl-btn');
      if (chip){
        setActive(chip);
        applyFilter(chip.dataset.filter);
      }else if (btn && btn.dataset.action === 'select-filtered'){
        selectFilteredOnPage();
      }
    });
  }

  /* -------------------- Observer -------------------- */
  function attachGridObserver(){
    const gridRoot = document.getElementById('ctl00_PageBody_InvoicesGrid');
    if (!gridRoot) return;
    if (gridRoot.__wlObserved) return;
    gridRoot.__wlObserved = true;

    const mo = new MutationObserver(()=>{
      const master = gridRoot.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || gridRoot.querySelector('.rgMasterTable');
      if (master){
        requestAnimationFrame(async ()=>{
          await applyBadges(master);
        });
      }
    });
    mo.observe(gridRoot, { childList:true, subtree:true });
    log('Grid observer attached');
  }

  /* -------------------- Boot -------------------- */
  async function boot(){
    const master = await getMasterTable();
    if (!master){ log('No invoices grid found'); return; }

    // Modern wrapper + toolbar (once)
    ensureGridWrapper();
    const toolbar = ensureToolbar(); wireToolbar(toolbar);

    // Build AP index and badge rows
    try{ await ensureApIndex(); }catch(e){ warn('AP index error', e); }
    await applyBadges(master);

    // Observer for partial page refreshes
    attachGridObserver();

    log('Invoices grid enhanced');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
  window.addEventListener('load', ()=>boot(), { once:true });

  // Manual debug hook
  window.WLInvoices = { run: boot, version: VERSION };

})();
