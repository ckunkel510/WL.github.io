
/* ========================================================= 
   Woodson — Invoices Enhancer for Invoices_r.aspx (v4.1)
   - Modern UI (Open Orders parity): chips, search, density toggle
   - Visible-rows badging (IntersectionObserver)
   - Progressive AP crawl w/ throttled batches + live updates
   - Quick summary (page scope) + Select Filtered
   - Reapplies after Telerik partial postbacks
   ========================================================= */
(function () {
  'use strict';
  if (window.__WL_INVOICES_ENHANCED__) return;
  window.__WL_INVOICES_ENHANCED__ = true;

  const VERSION = '4.1';
  const t0 = performance.now();
  const log  = (...a)=>console.log('%cINV','color:#005d6e;font-weight:700;',`v${VERSION} [+${(performance.now()-t0).toFixed(1)}ms]`,...a);
  const warn = (...a)=>console.warn('%cINV','color:#b45309;font-weight:700;',`v${VERSION} [+${(performance.now()-t0).toFixed(1)}ms]`,...a);

  /* -------------------- CSS -------------------- */
  (function injectCSS(){
    const css = `
      /* Container */
      #ctl00_PageBody_InvoicesGrid {
        border-radius: 14px;
        box-shadow: 0 8px 24px rgba(15,23,42,.06);
        overflow: hidden;
        background: #fff;
      }
      .wl-toprow { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin: 10px 0 8px; }
      .wl-summary { display:flex; gap:8px; align-items:center; font-weight:800; font-size:12px; color:#0f172a; }
      .wl-pill { padding:4px 10px; border-radius:999px; background:#f1f5f9; border:1px solid #e5e7eb; }
      .wl-pill--over { background:#fee2e2; border-color:#fecaca; color:#7f1d1d; }

      /* Toolbar */
      .wl-toolbar {
        display:flex; align-items:center; gap:10px; flex-wrap:wrap;
        margin: 4px 0 12px 0;
      }
      .wl-chip {
        border:1px solid #e5e7eb; border-radius:999px; padding:6px 10px; font-weight:700;
        background:#fff; color:#0f172a; font-size:12px; cursor:pointer; user-select:none;
        transition: background .15s ease, border-color .15s ease;
      }
      .wl-chip[data-active="true"] { border-color:#0ea5e9; background:#e0f2fe; color:#075985; }
      .wl-chip[data-filter="overdue"] { background:#fff7f7; }
      .wl-spacer { flex:1 1 auto; }
      .wl-btn {
        border:1px solid #e5e7eb; border-radius:10px; padding:6px 10px; font-weight:700;
        background:#f8fafc; color:#0f172a; font-size:12px; cursor:pointer;
      }
      .wl-btn:active { transform: translateY(1px); }
      .wl-input {
        display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius:10px;
        border:1px solid #e5e7eb; background:#fff; font-size:12px; min-width:220px;
      }
      .wl-input input { border:none; outline:none; flex:1; font-size:12px; }

      /* Badges */
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
      /* Compact / Comfortable density */
      .wl-density-compact .RadGrid .rgMasterTable td, 
      .wl-density-compact .RadGrid .rgMasterTable th { padding: 8px 10px !important; }
      .RadGrid .rgMasterTable td, .RadGrid .rgMasterTable th {
        padding: 12px 14px !important; vertical-align: middle;
      }
      /* Zebra + hover + left status bar */
      .RadGrid .rgMasterTable tbody tr.rgRow    { background:#ffffff; }
      .RadGrid .rgMasterTable tbody tr.rgAltRow { background:#fbfdff; }
      .RadGrid .rgMasterTable tbody tr:hover { background:#f1f5f9; }
      .RadGrid .rgMasterTable tbody td { border-bottom: 1px dashed #e5e7eb; }
      .RadGrid .rgMasterTable tbody tr:last-child td { border-bottom: none; }
      .wl-statusbar { position:absolute; left:0; top:0; bottom:0; width:3px; border-top-left-radius:8px; border-bottom-left-radius:8px; }
      tr[data-status="paid"]    .wl-statusbar { background:#22c55e; opacity:.7; }
      tr[data-status="open"]    .wl-statusbar { background:#f59e0b; opacity:.7; }
      tr[data-status="partial"] .wl-statusbar { background:#fbbf24; opacity:.7; }
      /* row container for statusbar */
      .wl-rowwrap { position:relative; }

      /* Sticky first column (selector) */
      .rgMasterTable td:first-child, .rgMasterTable th:first-child {
        position: sticky; left: 0; z-index: 3; background: inherit;
      }

      /* Number alignment */
      td[data-title="Goods Total"], td[data-title="Tax"], td[data-title="Total Amount"] { 
        text-align: right !important; font-variant-numeric: tabular-nums; 
      }

      /* Overdue dot */
      .wl-overdue-dot {
        display:inline-block; width:8px; height:8px; border-radius:999px; background:#ef4444; margin-left:6px;
      }

      /* Scrollable area for sticky header */
      .wl-grid-wrap {
        max-height: 68vh; overflow:auto; border-radius:12px; background:#fff;
      }
    `;
    const el = document.createElement('style'); el.textContent = css; document.head.appendChild(el);
  })();

  /* -------------------- Utils -------------------- */
  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
  async function waitFor(selector, {root=document, tries=60, interval=120} = {}){
    for (let i=0;i<tries;i++){ const el = root.querySelector(selector); if (el) return el; await sleep(interval); }
    return null;
  }
  const txt = (el)=> (el?.textContent || '').trim();
  const toUSD = (n)=> Number(n).toLocaleString(undefined,{style:'currency',currency:'USD'});
  const parseMoney = (s)=> { const v = parseFloat(String(s||'').replace(/[^0-9.\-]/g,'') || '0'); return Number.isFinite(v) ? v : 0; };
  const nearlyZero = (n)=> Math.abs(n) < 0.009;
  const raf = (fn)=> new Promise(r=>requestAnimationFrame(()=>{ fn(); r(); }));

  /* -------------------- Date range (Invoices page) -------------------- */
  function readInvoiceDateRange(){
    const getClientState = (id)=>{
      const inp = document.getElementById(id); if (!inp) return null;
      try{ const raw = inp.value.replace(/&quot;/g,'"'); return JSON.parse(raw); }catch{ return null; }
    };
    const startState = getClientState('ctl00_PageBody_dtDateEntryStart_RadDatePicker1_dateInput_ClientState');
    const endState   = getClientState('ctl00_PageBody_dtDateEntryEnd_RadDatePicker1_dateInput_ClientState');

    const toISO = (state, fallbackInputId)=>{
      if (state?.valueAsString){
        const m = state.valueAsString.match(/^(\d{4}-\d{2}-\d{2})-/); if (m) return m[1];
      }
      const vis = document.getElementById(fallbackInputId);
      if (vis && vis.value){ const d = new Date(vis.value); if (!isNaN(d)) return d.toISOString().slice(0,10); }
      return null;
    };

    const startISO = toISO(startState, 'ctl00_PageBody_dtDateEntryStart_RadDatePicker1_dateInput');
    const endISO   = toISO(endState,   'ctl00_PageBody_dtDateEntryEnd_RadDatePicker1_dateInput');
    return { startISO, endISO };
  }

  /* -------------------- AP crawler (progressive) -------------------- */
  const AP_EVENTS = new EventTarget();           // emits 'ap:item' {docNo, outstanding}
  function apCacheKey(startISO, endISO){ return `wl_ap_index_v4_${startISO || 'na'}_${endISO || 'na'}`; }

  async function buildAccountPaymentIndex(startISO, endISO){
    const key = apCacheKey(startISO, endISO);
    // Try cache (10 min)
    try{
      const raw = sessionStorage.getItem(key);
      if (raw){
        const { at, data } = JSON.parse(raw);
        if (Date.now() - at < 10*60*1000){
          const map = new Map(data);
          // hydrate existing map to the UI (so rows resolve immediately)
          for (const [docNo, v] of map.entries()){
            AP_EVENTS.dispatchEvent(new CustomEvent('ap:item', { detail:{ docNo, outstanding: v.outstanding }}));
          }
          return map;
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
          // live-update visible rows as we discover items
          AP_EVENTS.dispatchEvent(new CustomEvent('ap:item', { detail:{ docNo, outstanding: outVal }}));
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
      // First page fast
      const firstHTML = await fetchText(base.toString());
      const firstDoc  = parser.parseFromString(firstHTML, 'text/html');
      parseRows(firstDoc);

      // Remaining pages in throttled batches (keeps UI responsive)
      const hrefs = collectPager(firstDoc).filter(u => u !== base.toString());
      const queue = hrefs.slice();
      const CONCURRENCY = 2;

      async function worker(){
        while (queue.length){
          const url = queue.shift();
          try{
            const html = await fetchText(url);
            const d = parser.parseFromString(html, 'text/html');
            parseRows(d);
          }catch(e){ /* ignore individual page errors */ }
          // Tiny pause between pages to yield main thread
          await sleep(50);
        }
      }
      await Promise.all(new Array(Math.min(CONCURRENCY, queue.length||0)).fill(0).map(worker));

    }catch(err){ warn('AP crawl failed:', err); }

    try{
      sessionStorage.setItem(key, JSON.stringify({at: Date.now(), data: Array.from(index.entries())}));
    }catch{}
    return index;
  }

  let __AP_PROMISE__ = null;
  async function ensureApIndex(){
    const { startISO, endISO } = readInvoiceDateRange();
    if (!__AP_PROMISE__) { __AP_PROMISE__ = buildAccountPaymentIndex(startISO, endISO); }
    return __AP_PROMISE__;
  }

  /* -------------------- Grid helpers -------------------- */
  async function getGridRoot(){ return await waitFor('#ctl00_PageBody_InvoicesGrid',{tries:60,interval:150}); }
  async function getMasterTable(){
    const root = await getGridRoot(); if (!root) return null;
    return root.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || root.querySelector('.rgMasterTable');
  }
  function todayAtMidnight(){ const d = new Date(); d.setHours(0,0,0,0); return d; }

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
    const td = tr.querySelector('td[data-title="Due Date"]'); const s = td ? txt(td) : '';
    if (!s) return null; const d = new Date(s); return isNaN(d) ? null : d;
  }
  function ensureRowWrap(tr){
    if (!tr.__wlWrapped){
      const wrap = document.createElement('div');
      wrap.className='wl-rowwrap';
      const firstCell = tr.cells && tr.cells[0];
      if (firstCell){
        // Insert an absolutely positioned color bar along the left
        const bar = document.createElement('div'); bar.className='wl-statusbar';
        // Put the bar into the first cell so it scrolls with the row
        firstCell.style.position='relative';
        firstCell.prepend(bar);
      }
      tr.__wlWrapped = true;
    }
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
    const badge = cell.querySelector('.wl-badge'); if (!badge) return;
    badge.className = `wl-badge ${cls}`; badge.textContent = text;
  }

  /* -------------------- Visible-rows tracking -------------------- */
  const visibleRows = new Set();
  let gridWrap = null;
  function buildRowObserver(){
    if (!gridWrap) gridWrap = document.querySelector('#ctl00_PageBody_InvoicesGrid .wl-grid-wrap');
    if (!gridWrap) return null;
    const io = new IntersectionObserver((entries)=>{
      for (const e of entries){
        const tr = e.target;
        if (e.isIntersecting){ visibleRows.add(tr); ensureRowWrap(tr); ensureBadgingForRows([tr]); }
        else { visibleRows.delete(tr); }
      }
    }, { root: gridWrap, threshold: 0 });
    return io;
  }
  let rowIO = null;
  function observeRows(master){
    if (!rowIO) rowIO = buildRowObserver();
    if (!rowIO) return;
    const rows = master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow');
    rows.forEach(tr=>rowIO.observe(tr));
  }

  /* -------------------- Badging + Status tagging (visible only) -------------------- */
  async function ensureBadgingForRows(rows){
    if (!rows || !rows.length) return;
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
        if (info && nearlyZero(info.outstanding)){
          invCells.forEach(cell=> setBadge(cell, 'wl-badge--green', 'Paid'));
          status = 'paid';
        }else if (info){
          const out = Number(info.outstanding) || 0;
          if (Number.isFinite(total) && out < total - 0.009){
            invCells.forEach(cell=> setBadge(cell, 'wl-badge--amber', `Partial · ${toUSD(out)} left`));
            status = 'partial';
          }else{
            invCells.forEach(cell=> setBadge(cell, 'wl-badge--amber', `Open · ${toUSD(out)}`));
            status = 'open';
          }
        }else{
          // Not in map yet (progressive crawl) — keep skeleton, will resolve on AP_EVENTS
        }
      }

      // Overdue marker
      const due = getDueDateFromRow(tr);
      const overdue = (status === 'open' || status === 'partial') && due && due < today;
      tr.dataset.status = status;
      tr.dataset.overdue = overdue ? '1' : '0';

      // add/remove overdue dot
      if (overdue){
        invCells.forEach(cell=>{
          if (!cell.querySelector('.wl-overdue-dot')){
            const dot = document.createElement('span'); dot.className = 'wl-overdue-dot'; dot.title = 'Overdue';
            cell.appendChild(dot);
          }
        });
      }else{
        invCells.forEach(cell=>{ const dot = cell.querySelector('.wl-overdue-dot'); if (dot) dot.remove(); });
      }
    });

    updateSummary(); // recalc page summary
  }

  function applyFilter(filter, searchTerm){
    const master = document.querySelector('#ctl00_PageBody_InvoicesGrid .rgMasterTable'); if (!master) return;
    const term = (searchTerm||'').toLowerCase();
    const rows = master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow');
    rows.forEach(tr=>{
      const status = tr.dataset.status || 'unknown';
      const over = tr.dataset.overdue === '1';
      let show = (filter === 'all');
      if (!show){
        if (filter === 'overdue') show = over;
        else show = (status === filter);
      }
      if (show && term){
        const hay = (tr.textContent || '').toLowerCase();
        show = hay.includes(term);
      }
      tr.style.display = show ? '' : 'none';
    });
  }

  function selectFilteredOnPage(){
    const root = document.getElementById('ctl00_PageBody_InvoicesGrid'); if (!root) return;
    const boxes = root.querySelectorAll('tbody input[type="checkbox"][name*="chkSelect"]');
    boxes.forEach(cb=>{
      const tr = cb.closest('tr');
      if (tr && tr.style.display !== 'none' && !cb.checked){ cb.click(); }
    });
  }

  /* -------------------- Wrapper, toolbar & summary -------------------- */
  function ensureGridWrapper(){
    const root = document.getElementById('ctl00_PageBody_InvoicesGrid'); if (!root) return null;
    if (root.__wlWrapped) return root.__wlWrapped;
    const table = root.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || root.querySelector('.rgMasterTable'); if (!table) return null;
    const wrap = document.createElement('div'); wrap.className = 'wl-grid-wrap';
    table.parentNode.insertBefore(wrap, table); wrap.appendChild(table);
    root.__wlWrapped = wrap; return wrap;
  }

  function ensureTopRow(){
    const gridFlexItem = document.getElementById('ctl00_PageBody_InvoicesGrid')?.closest('.bodyFlexItem') || document.getElementById('ctl00_PageBody_InvoicesGrid');
    if (!gridFlexItem) return null;
    if (gridFlexItem.querySelector('.wl-toprow')) return gridFlexItem.querySelector('.wl-toprow');

    const top = document.createElement('div'); top.className = 'wl-toprow';
    top.innerHTML = `
      <div class="wl-summary">
        <span class="wl-pill" data-sum="open">Open: 0</span>
        <span class="wl-pill" data-sum="partial">Partial: 0</span>
        <span class="wl-pill" data-sum="paid">Paid: 0</span>
        <span class="wl-pill wl-pill--over" data-sum="overdue">Overdue: 0</span>
      </div>
    `;
    gridFlexItem.insertBefore(top, gridFlexItem.firstChild);
    return top;
  }

  function ensureToolbar(){
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
      <button class="wl-chip" data-filter="overdue">Overdue</button>
      <div class="wl-input"><span>🔎</span><input type="text" placeholder="Search invoice, ref, branch…" aria-label="Search invoices"></div>
      <div class="wl-spacer"></div>
      <button class="wl-btn" data-action="density">Toggle density</button>
      <button class="wl-btn" data-action="select-filtered">Select filtered</button>
    `;
    gridFlexItem.insertBefore(bar, gridFlexItem.querySelector('.wl-grid-wrap') || gridFlexItem.lastChild);
    return bar;
  }

  function wireToolbar(bar){
    if (!bar || bar.__wired) return; bar.__wired = true;
    const root = document.getElementById('ctl00_PageBody_InvoicesGrid')?.closest('.bodyFlexItem') || document.body;

    const setActive = (btn)=>{ bar.querySelectorAll('.wl-chip').forEach(b=>b.dataset.active='false'); btn.dataset.active='true'; };
    let filter = 'all'; let term = '';

    const apply = ()=> applyFilter(filter, term);
    bar.addEventListener('click', (e)=>{
      const chip = e.target.closest('.wl-chip');
      const btn  = e.target.closest('.wl-btn');
      if (chip){ filter = chip.dataset.filter; setActive(chip); apply(); }
      else if (btn && btn.dataset.action === 'select-filtered'){ selectFilteredOnPage(); }
      else if (btn && btn.dataset.action === 'density'){
        root.classList.toggle('wl-density-compact');
      }
    });

    const input = bar.querySelector('input'); let tId = 0;
    input.addEventListener('input', ()=>{
      clearTimeout(tId);
      tId = setTimeout(()=>{ term = input.value||''; apply(); }, 120);
    });
  }

  function updateSummary(){
    const master = document.querySelector('#ctl00_PageBody_InvoicesGrid .rgMasterTable'); if (!master) return;
    const rows = master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow');
    let open=0, partial=0, paid=0, overdue=0;
    rows.forEach(tr=>{
      if (tr.style.display === 'none') return; // page scope & current filter
      const s = tr.dataset.status; const o = tr.dataset.overdue === '1';
      if (s === 'open') open++;
      else if (s === 'partial') partial++;
      else if (s === 'paid') paid++;
      if (o) overdue++;
    });
    const top = document.querySelector('.wl-toprow'); if (!top) return;
    const set = (k,v)=>{ const el = top.querySelector(`[data-sum="${k}"]`); if (el) el.textContent = `${k[0].toUpperCase()+k.slice(1)}: ${v}`; };
    set('open',open); set('partial',partial); set('paid',paid); set('overdue',overdue);
  }

  /* -------------------- Observer (partial postbacks) -------------------- */
  function attachGridObserver(){
    const gridRoot = document.getElementById('ctl00_PageBody_InvoicesGrid'); if (!gridRoot) return;
    if (gridRoot.__wlObserved) return; gridRoot.__wlObserved = true;

    const mo = new MutationObserver(()=>{
      const master = gridRoot.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || gridRoot.querySelector('.rgMasterTable');
      if (master){
        requestAnimationFrame(async ()=>{
          observeRows(master); // re-observe new page rows
          // on page change, visible set recalculates automatically via IO
        });
      }
    });
    mo.observe(gridRoot, { childList:true, subtree:true });
    log('Grid observer attached');
  }

  /* -------------------- AP live updates → badge visible rows -------------------- */
  AP_EVENTS.addEventListener('ap:item', ()=>{
    // when AP map gets new data, just refresh currently visible rows
    if (!visibleRows.size) return;
    ensureBadgingForRows(Array.from(visibleRows));
  });

  /* -------------------- Boot -------------------- */
  async function boot(){
    const master = await getMasterTable(); if (!master){ log('No invoices grid found'); return; }
    ensureGridWrapper(); gridWrap = document.querySelector('#ctl00_PageBody_InvoicesGrid .wl-grid-wrap');
    const top = ensureTopRow(); const toolbar = ensureToolbar(); wireToolbar(toolbar);

    // Build AP index (progressive) & start observing rows
    try{ await ensureApIndex(); }catch(e){ warn('AP index error', e); }
    observeRows(master);

    // Initial visible rows badging (after layout)
    await raf(()=>{ /* nop: let IO fire */ });

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

