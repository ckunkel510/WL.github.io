/* =========================================================
   Woodson — Invoices Enhancer for Invoices_r.aspx (v4.0)
   PERF FOCUS:
   - Only resolve status for the *visible page* of invoices
   - Sequential AP fetch with early-exit (no mass crawling)
   - Cache per invoice in sessionStorage (10 min)
   UI:
   - Modern table styling + toolbar filters (All/Open/Partial/Paid)
   - Keeps Select-All + per-row checkboxes untouched
   ========================================================= */

(function () {
  'use strict';
  if (window.__WL_INVOICES_ENHANCED__) return;
  window.__WL_INVOICES_ENHANCED__ = true;

  const VERSION = '4.0';
  const log  = (...a)=>console.log('%cINV','color:#005d6e;font-weight:700;',`v${VERSION}`,...a);
  const warn = (...a)=>console.warn('%cINV','color:#b45309;font-weight:700;',`v${VERSION}`,...a);

  /* =============== CSS (same visual polish) =============== */
  (function injectCSS(){
    const css = `
      #ctl00_PageBody_InvoicesGrid {
        border-radius: 12px;
        box-shadow: 0 6px 18px rgba(15,23,42,.06);
        overflow: hidden;
        background: #fff;
      }
      .wl-toolbar {
        display:flex; align-items:center; gap:10px; flex-wrap:wrap;
        margin: 12px 0 10px 0;
      }
      .wl-chip {
        border:1px solid #e5e7eb; border-radius:999px; padding:6px 10px; font-weight:700;
        background:#fff; color:#0f172a; font-size:12px; cursor:pointer; user-select:none;
      }
      .wl-chip[data-active="true"] { border-color:#0ea5e9; background:#e0f2fe; color:#075985; }
      .wl-spacer { flex:1 1 auto; }
      .wl-btn {
        border:1px solid #e5e7eb; border-radius:10px; padding:6px 10px; font-weight:700;
        background:#f8fafc; color:#0f172a; font-size:12px; cursor:pointer;
      }
      .wl-btn:active { transform: translateY(1px); }
      .wl-badge{display:inline-flex;align-items:center;gap:6px;font-weight:800;border-radius:999px;padding:2px 8px;font-size:11px;margin-left:8px;vertical-align:middle;line-height:1.6}
      .wl-badge--green{background:#dcfce7;color:#065f46}
      .wl-badge--amber{background:#fef3c7;color:#92400e}
      .wl-badge--slate{background:#e2e8f0;color:#0f172a}
      .wl-skel{background:repeating-linear-gradient(90deg,#f1f5f9,#f1f5f9 8px,#e2e8f0 8px,#e2e8f0 16px);color:transparent}
      .RadGrid .rgMasterTable { border-collapse: separate; border-spacing: 0; }
      .RadGrid .rgMasterTable thead th.rgHeader {
        position: sticky; top: 0; z-index: 2;
        background: #f8fafc; color:#0f172a; font-weight:800; font-size:12px;
        border-bottom: 1px solid #e5e7eb;
      }
      .RadGrid .rgMasterTable td, .RadGrid .rgMasterTable th {
        padding: 10px 12px !important;
        vertical-align: middle;
      }
      .RadGrid .rgMasterTable tbody tr.rgRow    { background:#ffffff; }
      .RadGrid .rgMasterTable tbody tr.rgAltRow { background:#fbfdff; }
      .RadGrid .rgMasterTable tbody tr:hover { background:#f1f5f9; }
      .RadGrid .rgMasterTable tbody td { border-bottom: 1px dashed #e5e7eb; }
      .RadGrid .rgMasterTable tbody tr:last-child td { border-bottom: none; }
      .rgMasterTable td:first-child, .rgMasterTable th:first-child {
        position: sticky; left: 0; z-index: 3; background: inherit;
      }
      td[data-title="Goods Total"], td[data-title="Tax"], td[data-title="Total Amount"] {
        text-align: right !important; font-variant-numeric: tabular-nums;
      }
      .wl-overdue-dot { display:inline-block; width:8px; height:8px; border-radius:999px; background:#ef4444; margin-left:6px; }
      .wl-grid-wrap { max-height: 68vh; overflow:auto; border-radius:12px; background:#fff; }
    `;
    const el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
  })();

  /* =================== Utils =================== */
  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
  async function waitFor(sel,{tries=60,interval=120,root=document}={}){ for(let i=0;i<tries;i++){const el=root.querySelector(sel); if(el) return el; await sleep(interval);} return null; }
  const txt = (el)=> (el?.textContent || '').trim();
  const toUSD = (n)=> Number(n).toLocaleString(undefined,{style:'currency',currency:'USD'});
  const parseMoney = (s)=> { const v = parseFloat(String(s||'').replace(/[^0-9.\-]/g,'') || '0'); return Number.isFinite(v) ? v : 0; };
  const nearlyZero = (n)=> Math.abs(n) < 0.009;
  function todayMidnight(){ const d=new Date(); d.setHours(0,0,0,0); return d; }

  /* =================== Date range (Invoices page) =================== */
  function readInvoiceDateRange(){
    const getCS = (id)=>{ const inp=document.getElementById(id); if(!inp) return null; try{ return JSON.parse(inp.value.replace(/&quot;/g,'"')); }catch{return null;} };
    const startState = getCS('ctl00_PageBody_dtDateEntryStart_RadDatePicker1_dateInput_ClientState');
    const endState   = getCS('ctl00_PageBody_dtDateEntryEnd_RadDatePicker1_dateInput_ClientState');
    const toISO = (state)=>{ if(state?.valueAsString){ const m = state.valueAsString.match(/^(\d{4}-\d{2}-\d{2})-/); if(m) return m[1]; } return null; };
    return { startISO: toISO(startState), endISO: toISO(endState) };
  }

  /* =================== Grid bits =================== */
  async function getGridRoot(){ return await waitFor('#ctl00_PageBody_InvoicesGrid'); }
  async function getMasterTable(){
    const root = await getGridRoot();
    if (!root) return null;
    return root.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || root.querySelector('.rgMasterTable');
  }
  function getInvoiceNumberFromRow(tr){
    const wide = tr.querySelector('td.wide-only[data-title="Invoice #"] a');
    const nar  = tr.querySelector('td.narrow-only[data-title="Invoice #"] a');
    return (wide ? txt(wide) : '') || (nar ? txt(nar) : '');
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

  /* =================== Badges =================== */
  function ensureBadgeInCell(cell){
    let badge = cell.querySelector('.wl-badge');
    if (!badge){
      badge = document.createElement('span');
      badge.className = 'wl-badge wl-badge--slate';
      badge.innerHTML = '<span class="wl-skel">checking…</span>';
      cell.appendChild(badge);
    }
    return badge;
  }
  function setBadge(cell, cls, text){
    const badge = ensureBadgeInCell(cell);
    badge.className = `wl-badge ${cls}`;
    badge.textContent = text;
  }
  function updateOverdueDot(cells, show){
    cells.forEach(cell=>{
      let dot = cell.querySelector('.wl-overdue-dot');
      if (show){
        if (!dot){ dot = document.createElement('span'); dot.className='wl-overdue-dot'; dot.title='Overdue'; cell.appendChild(dot); }
      }else{
        if (dot) dot.remove();
      }
    });
  }
  function placeSkeleton(tr){
    const cells = [];
    const cw = tr.querySelector('td.wide-only[data-title="Invoice #"]'); if (cw) cells.push(cw);
    const cn = tr.querySelector('td.narrow-only[data-title="Invoice #"]'); if (cn) cells.push(cn);
    cells.forEach(c=>ensureBadgeInCell(c));
  }

  /* =================== PERF: page-scoped AP resolver =================== */
  // We only resolve statuses for the *visible* invoice numbers on the current page.
  // AP pages are scanned sequentially (early-exit) within the invoice date range.
  // Results are cached per invoice for 10 minutes.
  let resolver = null;
  let gen = 0; // generation token to ignore stale work

  function createResolver(startISO, endISO){
    const cache = new Map(); // docNo -> { outstanding:number }
    const keyPrefix = `wl_ap_doc_v3_${startISO||'na'}_${endISO||'na'}_`;

    const loadSession = (doc)=> {
      try{
        const raw = sessionStorage.getItem(keyPrefix+doc);
        if (!raw) return null;
        const { at, data } = JSON.parse(raw);
        if (Date.now() - at < 10*60*1000) return data;
      }catch{}
      return null;
    };
    const saveSession = (doc, data)=>{
      try{ sessionStorage.setItem(keyPrefix+doc, JSON.stringify({at:Date.now(), data})); }catch{}
    };

    const remember = (doc, val)=>{ cache.set(doc, val); saveSession(doc,val); };

    const parseAPDoc = (html)=>{
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const host = doc.querySelector('#ctl00_PageBody_InvoicesGrid') || doc;
      const tbl  = host.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || host.querySelector('.rgMasterTable');
      const found = new Map();
      if (!tbl) return {found, pager:[]};

      const rows = tbl.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow');
      rows.forEach(tr=>{
        const type = txt(tr.querySelector('td[data-title="Type"]')) || txt(tr.children[1]);
        let docNo = txt(tr.querySelector('span[id*="_DocumentNumber"]')) ||
                    txt(tr.querySelector('td[data-title="Doc. #"] span')) ||
                    txt(tr.querySelector('td[data-title="Document #"] span'));
        const outTxt = txt(tr.querySelector('td[data-title="Amount Outstanding"]')) || txt(tr.children[8]);
        const outVal = parseMoney(outTxt);
        if (docNo && (type||'').toLowerCase()==='invoice'){
          found.set(docNo, { outstanding: outVal });
        }
      });

      // Build a normalized list of AP pager URLs (same date range)
      const pager = [];
      const normalize = (href)=>{
        try{
          const u = new URL(href, location.origin + '/AccountPayment_r.aspx');
          if (startISO) u.searchParams.set('startDate', `${startISO}T00:00:00`);
          if (endISO)   u.searchParams.set('endDate',   `${endISO}T23:59:59`);
          u.searchParams.set('searchType','TransactionDate');
          u.pathname = '/AccountPayment_r.aspx';
          return u.toString();
        }catch{ return null; }
      };
      doc.querySelectorAll('ul.pagination a.page-link[href]').forEach(a=>{
        const href = a.getAttribute('href');
        if (href && /pageIndex=\d+/.test(href)){
          const nu = normalize(href);
          if (nu) pager.push(nu);
        }
      });

      // Deduplicate & sort by pageIndex asc
      const dedup = Array.from(new Set(pager));
      dedup.sort((a,b)=> {
        const pa = Number(new URL(a).searchParams.get('pageIndex')||'0');
        const pb = Number(new URL(b).searchParams.get('pageIndex')||'0');
        return pa - pb;
      });

      return { found, pager: dedup };
    };

    const fetchText = async (url)=> {
      const res = await fetch(url, { credentials:'same-origin', cache:'no-cache' });
      if (!res.ok) throw new Error('HTTP '+res.status);
      return res.text();
    };

    async function resolveForInvoices(targetDocs, currentGen){
      // Populate from memory / session first
      const missing = new Set();
      targetDocs.forEach(doc=>{
        if (cache.has(doc)) return;
        const s = loadSession(doc);
        if (s) { cache.set(doc, s); }
        else { missing.add(doc); }
      });
      if (!missing.size) return; // done

      // Start sequential scan: first page, then more only if needed
      const base = new URL('/AccountPayment_r.aspx', location.origin);
      base.searchParams.set('searchType','TransactionDate');
      if (startISO) base.searchParams.set('startDate', `${startISO}T00:00:00`);
      if (endISO)   base.searchParams.set('endDate',   `${endISO}T23:59:59`);

      try{
        // PAGE 1
        let html = await fetchText(base.toString());
        if (currentGen !== gen) return; // stale
        let { found, pager } = parseAPDoc(html);
        found.forEach((v,k)=> { if (missing.has(k)){ remember(k,v); missing.delete(k); } });
        if (!missing.size) return;

        // Remove base URL from pager if present and ensure we go forward only
        pager = pager.filter(u => new URL(u).searchParams.get('pageIndex') !== '0');

        // Iterate pages SEQUENTIALLY, early-exit as soon as we’ve found all
        for (let i=0; i<pager.length && missing.size; i++){
          if (currentGen !== gen) return; // new page of invoices loaded, stop
          await sleep(0); // yield to keep UI responsive
          html = await fetchText(pager[i]);
          if (currentGen !== gen) return;
          ({ found } = parseAPDoc(html));
          found.forEach((v,k)=> { if (missing.has(k)){ remember(k,v); missing.delete(k); } });
        }
      }catch(err){
        warn('AP resolve error:', err);
      }
    }

    return {
      get(doc){ return cache.get(doc) || loadSession(doc) || null; },
      async ensure(docs, currentGen){ await resolveForInvoices(docs, currentGen); }
    };
  }

  /* =================== Apply statuses to VISIBLE rows only =================== */
  function collectVisibleInvoiceNos(master){
    const rows = Array.from(master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
    const docs = [];
    rows.forEach(tr=>{
      if (tr.style.display === 'none') return; // filtered out
      const doc = getInvoiceNumberFromRow(tr);
      if (doc) docs.push(doc);
    });
    return docs;
  }

  function setRowStatusFromCache(tr, res){
    const invCells = tr.querySelectorAll('td[data-title="Invoice #"].wide-only, td[data-title="Invoice #"].narrow-only');

    if (!res){
      invCells.forEach(cell=> setBadge(cell,'wl-badge--slate','Status N/A'));
      tr.dataset.status = 'unknown';
      updateOverdueDot(invCells,false);
      return;
    }

    const total = getTotalAmountFromRow(tr);
    const out = Number(res.outstanding)||0;

    if (nearlyZero(out)){
      invCells.forEach(cell=> setBadge(cell,'wl-badge--green','Paid'));
      tr.dataset.status = 'paid';
      updateOverdueDot(invCells,false);
    }else if (out < total - 0.009){
      invCells.forEach(cell=> setBadge(cell,'wl-badge--amber',`Partial · ${toUSD(out)} left`));
      tr.dataset.status = 'partial';
      const due = getDueDateFromRow(tr); const overdue = due && due < todayMidnight();
      updateOverdueDot(invCells, !!overdue);
    }else{
      invCells.forEach(cell=> setBadge(cell,'wl-badge--amber',`Open · ${toUSD(out)}`));
      tr.dataset.status = 'open';
      const due = getDueDateFromRow(tr); const overdue = due && due < todayMidnight();
      updateOverdueDot(invCells, !!overdue);
    }
  }

  async function updateVisibleRows(master){
    // Generation step: if the user flips the page, older work is ignored
    const myGen = ++gen;

    // Resolver per (date) range instance
    const { startISO, endISO } = readInvoiceDateRange();
    if (!resolver) resolver = createResolver(startISO, endISO);

    const rows = Array.from(master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
    // show skeletons immediately
    rows.forEach(placeSkeleton);

    // Try to apply from cache first (fast paint)
    rows.forEach(tr=>{
      const doc = getInvoiceNumberFromRow(tr);
      if (!doc) return;
      const cached = resolver.get(doc);
      if (cached) setRowStatusFromCache(tr, cached);
    });

    // Resolve only missing docs (visible page only)
    const docs = collectVisibleInvoiceNos(master).filter(d => !resolver.get(d));
    if (docs.length){
      await resolver.ensure(docs, myGen); // sequential AP scan; early exit when all docs found
      // Paint again (apply newly found)
      rows.forEach(tr=>{
        const doc = getInvoiceNumberFromRow(tr);
        if (!doc) return;
        const cached = resolver.get(doc);
        if (cached) setRowStatusFromCache(tr, cached);
      });
    }
  }

  /* =================== Toolbar & filtering (unchanged) =================== */
  function ensureGridWrapper(){
    const root = document.getElementById('ctl00_PageBody_InvoicesGrid');
    if (!root) return null;
    if (root.__wlWrapped) return root.__wlWrapped;
    const tbl = root.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || root.querySelector('.rgMasterTable');
    if (!tbl) return null;
    const wrap = document.createElement('div');
    wrap.className='wl-grid-wrap';
    tbl.parentNode.insertBefore(wrap, tbl);
    wrap.appendChild(tbl);
    root.__wlWrapped = wrap;
    return wrap;
  }
  function ensureToolbar(){
    const gridFlexItem = document.getElementById('ctl00_PageBody_InvoicesGrid')?.closest('.bodyFlexItem') || document.getElementById('ctl00_PageBody_InvoicesGrid');
    if (!gridFlexItem) return null;
    let bar = gridFlexItem.querySelector('.wl-toolbar');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.className='wl-toolbar';
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
    const root = document.getElementById('ctl00_PageBody_InvoicesGrid');
    if (!root) return;
    const boxes = root.querySelectorAll('tbody input[type="checkbox"][name*="chkSelect"]');
    boxes.forEach(cb=>{
      const tr = cb.closest('tr');
      if (tr && tr.style.display !== 'none' && !cb.checked) cb.click();
    });
  }
  function wireToolbar(bar){
    if (!bar || bar.__wired) return; bar.__wired = true;
    const setActive=(btn)=>{ bar.querySelectorAll('.wl-chip').forEach(b=>b.dataset.active='false'); btn.dataset.active='true'; };
    bar.addEventListener('click', (e)=>{
      const chip = e.target.closest('.wl-chip');
      const btn  = e.target.closest('.wl-btn');
      if (chip){ setActive(chip); applyFilter(chip.dataset.filter); }
      else if (btn && btn.dataset.action==='select-filtered'){ selectFilteredOnPage(); }
    });
  }

  /* =================== Observer: re-run only for the visible page =================== */
  function attachGridObserver(){
    const gridRoot = document.getElementById('ctl00_PageBody_InvoicesGrid');
    if (!gridRoot || gridRoot.__wlObserved) return;
    gridRoot.__wlObserved = true;
    const mo = new MutationObserver(()=>{
      const master = gridRoot.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || gridRoot.querySelector('.rgMasterTable');
      if (master){
        // Wait for Telerik to finish DOM swaps
        requestAnimationFrame(async ()=>{ await updateVisibleRows(master); });
      }
    });
    mo.observe(gridRoot, { childList:true, subtree:true });
  }

  /* =================== Boot =================== */
  async function boot(){
    const master = await getMasterTable();
    if (!master) { log('No invoice grid found'); return; }

    // Reset resolver on each full page load (date range might differ)
    const { startISO, endISO } = readInvoiceDateRange();
    resolver = createResolver(startISO, endISO);

    ensureGridWrapper();
    const bar = ensureToolbar(); wireToolbar(bar);

    await updateVisibleRows(master); // ONLY current page
    attachGridObserver();

    log('Invoices page enhanced (page-scoped, fast).');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
  window.addEventListener('load', ()=>boot(), { once:true });

  // Debug hook
  window.WLInvoices = { run: boot, version: VERSION };

})();
