
/* =========================================================================
   Woodson — Invoices Card UI (v3.1)  ✅ working logic + modern card styling
   - Uses your original AP crawl & badging logic (date-range aware + cache)
   - Renders each row as a card while preserving the first-cell checkbox
   - Status chip reflects the same open/partial/paid logic as before
   - “Select filtered” kept; headers hidden except select-all
   - Reapplies after Telerik partial postbacks (observer)
   ========================================================================== */

(function () {
  'use strict';
  if (!/Invoices_r\.aspx/i.test(location.pathname)) return;
  if (window.__WL_INVOICES_ENHANCED__) return;
  window.__WL_INVOICES_ENHANCED__ = true;

  const VERSION = '3.1';
  const t0 = performance.now();
  const log  = (...a)=>console.log('%cINV','color:#005d6e;font-weight:700;',`v${VERSION} [+${(performance.now()-t0).toFixed(1)}ms]`,...a);
  const warn = (...a)=>console.warn('%cINV','color:#b45309;font-weight:700;',`v${VERSION} [+${(performance.now()-t0).toFixed(1)}ms]`,...a);

  /* -------------------- CSS (card UI) -------------------- */
  (function injectCSS(){
    const css = `
      /* Keep select-all visible, hide other headers for a cleaner card grid */
      #ctl00_PageBody_InvoicesGrid thead th:not(:first-child),
      .RadGrid[id*="InvoicesGrid"] thead th:not(:first-child){ display:none !important; }

      /* Cardify rows but keep first td (checkbox) visible & clickable */
      .wl-inv-cardify tr.rgRow, .wl-inv-cardify tr.rgAltRow{
        display:block; background:#fff; border:1px solid #e5e7eb; border-radius:16px;
        margin:12px 0; box-shadow:0 6px 18px rgba(15,23,42,.06); overflow:hidden; position:relative;
      }
      .wl-inv-cardify tr.rgRow > td, .wl-inv-cardify tr.rgAltRow > td{ display:none !important; }
      .wl-inv-cardify tr.rgRow > td:first-child,
      .wl-inv-cardify tr.rgAltRow > td:first-child{
        display:block !important; position:absolute; left:10px; top:12px;
        background:transparent; border:none !important; z-index:2;
      }

      .wl-row-head{
        display:grid; gap:8px; padding:14px 14px 12px 46px; align-items:center;
        grid-template-columns: 1fr auto;
      }
      .wl-head-left{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
      .wl-head-right{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:flex-end; }

      .wl-inv-no{ font-weight:900; font-size:16px; letter-spacing:.2px; }
      @media (min-width:1024px){ .wl-inv-no{ font-size:18px; } }

      .wl-chip{ display:inline-flex; align-items:center; gap:6px; font-weight:800; border-radius:999px; padding:6px 10px; font-size:12px; }
      .wl-chip--slate{ background:#e2e8f0; color:#0f172a; }
      .wl-chip--green{ background:#dcfce7; color:#065f46; }
      .wl-chip--amber{ background:#fef3c7; color:#92400e; }
      .wl-chip--red{   background:#fee2e2; color:#7f1d1d; }
      .wl-chip--blue{  background:#dbeafe; color:#1e3a8a; }

      .wl-meta{ display:flex; gap:12px; flex-wrap:wrap; font-size:12px; color:#475569; }
      .wl-meta span{ white-space:nowrap; }

      .wl-actions{ display:flex; gap:8px; flex-wrap:wrap; }
      .wl-btn{ appearance:none; border:none; border-radius:12px; font-weight:900; padding:10px 14px; text-decoration:none; cursor:pointer; }
      .wl-btn--primary{ background:#6b0016; color:#fff; }
      .wl-btn--ghost{ background:#f8fafc; color:#111827; border:1px solid #e5e7eb; }

      .wl-details{ display:none; border-top:1px solid #eef0f3; padding:12px 14px 14px 46px; }
      .wl-details.show{ display:block; }

      .wl-badge-skel{
        background:repeating-linear-gradient(90deg,#f1f5f9,#f1f5f9 8px,#e2e8f0 8px,#e2e8f0 16px);
        color:transparent
      }

      /* Simple toolbar (kept from your working logic) */
      .wl-toolbar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin: 8px 0 10px; }
      .wl-chipbtn {
        border:1px solid #e5e7eb; border-radius:999px; padding:6px 10px; font-weight:700;
        background:#fff; color:#0f172a; font-size:12px; cursor:pointer; user-select:none;
      }
      .wl-chipbtn[data-active="true"] { border-color:#0ea5e9; background:#e0f2fe; color:#075985; }
      .wl-spacer { flex:1 1 auto; }
      .wl-act { border:1px solid #e5e7eb; border-radius:10px; padding:6px 10px; font-weight:700; background:#f8fafc; font-size:12px; cursor:pointer; }
    `;
    const el = document.createElement('style'); el.textContent = css; document.head.appendChild(el);
  })();

  /* -------------------- Utils (from your working build) -------------------- */
  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
  const txt = (el)=> (el?.textContent || '').trim();
  const toUSD = (n)=> Number(n).toLocaleString(undefined,{style:'currency',currency:'USD'});
  const parseMoney = (s)=> { const v = parseFloat(String(s||'').replace(/[^0-9.\-]/g,'') || '0'); return Number.isFinite(v) ? v : 0; };
  const nearlyZero = (n)=> Math.abs(n) < 0.009;

  async function waitFor(selector, {root=document, tries=60, interval=120} = {}){
    for (let i=0;i<tries;i++){ const el = root.querySelector(selector); if (el) return el; await sleep(interval); }
    return null;
  }

  /* -------------------- Date range (same as your v3) -------------------- */
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

  /* -------------------- AccountPayment crawler (your working logic) -------------------- */
  function apCacheKey(startISO, endISO){ return `wl_ap_index_v3_${startISO || 'na'}_${endISO || 'na'}`; }

  async function buildAccountPaymentIndex(startISO, endISO){
    const key = apCacheKey(startISO, endISO);
    try{
      const raw = sessionStorage.getItem(key);
      if (raw){
        const { at, data } = JSON.parse(raw);
        if (Date.now() - at < 10*60*1000){ return new Map(data); }
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

    try{ sessionStorage.setItem(key, JSON.stringify({at: Date.now(), data: Array.from(index.entries())})); }catch{}
    return index;
  }

  let __AP_PROMISE__ = null;
  async function ensureApIndex(){
    const { startISO, endISO } = readInvoiceDateRange();
    if (!__AP_PROMISE__) { __AP_PROMISE__ = buildAccountPaymentIndex(startISO, endISO); }
    return __AP_PROMISE__;
  }

  /* -------------------- Grid + row helpers -------------------- */
  async function getMasterTable(){
    const root = await waitFor('#ctl00_PageBody_InvoicesGrid'); if (!root) return null;
    return root.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || root.querySelector('.rgMasterTable');
  }
  function todayAtMidnight(){ const d = new Date(); d.setHours(0,0,0,0); return d; }

  function findInvoiceAnchor(tr){
    return tr.querySelector('td[data-title="Invoice #"] a[href*="InvoiceDetails_r.aspx"], td[data-title="Invoice #"] a[href*="/Invoices_r.aspx"]');
  }
  const grab = (tr, sel) => { const el = tr.querySelector(sel); return el ? el.textContent.trim() : ''; };
  const abs  = (u)=>{ try{ return new URL(u, location.origin).toString(); }catch{ return u; } };

  /* -------------------- Badging (keeps your logic; now also stores data-* for card) -------------------- */
  async function applyBadges(master){
    const rows = Array.from(master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
    if (!rows.length) return;

    const apIndex = await ensureApIndex().catch(()=>null);
    const today = todayAtMidnight();

    rows.forEach(tr=>{
      const a = findInvoiceAnchor(tr);
      const invNo = a ? (a.textContent||'').trim() : '';
      if (!invNo) return;

      let status = 'unknown';
      let outLeft = 0;

      if (!apIndex){
        status = 'unknown';
      }else{
        const info = apIndex.get(invNo);
        const total = parseMoney(grab(tr,'td[data-title="Total Amount"]'));
        if (!info || nearlyZero(info.outstanding)){
          status = 'paid'; outLeft = 0;
        }else{
          const out = Number(info.outstanding) || 0;
          if (Number.isFinite(total) && out < total - 0.009){ status = 'partial'; outLeft = out; }
          else { status = 'open'; outLeft = out; }
        }
      }

      const dueTxt = grab(tr,'td[data-title="Due Date"]');
      const due = dueTxt ? new Date(dueTxt) : null;
      const overdue = (status === 'open' || status === 'partial') && due && due < today;

      tr.dataset.status = status;
      tr.dataset.outstanding = String(outLeft || 0);
      tr.dataset.overdue = overdue ? '1' : '0';

      // If legacy table-badge exists (pre-card), keep it updated too:
      const invCells = tr.querySelectorAll('td[data-title="Invoice #"]');
      invCells.forEach(cell=>{
        let badge = cell.querySelector('.wl-badge');
        if (!badge){ badge = document.createElement('span'); badge.className='wl-badge'; cell.appendChild(badge); }
        if (status === 'paid'){ badge.className='wl-badge wl-chip wl-chip--green'; badge.textContent='Paid'; }
        else if (status === 'partial'){ badge.className='wl-badge wl-chip wl-chip--amber'; badge.textContent=`Partial · ${toUSD(outLeft)}`; }
        else if (status === 'open'){ badge.className='wl-badge wl-chip wl-chip--amber'; badge.textContent=`Open · ${toUSD(outLeft)}`; }
        else { badge.className='wl-badge wl-chip wl-chip--slate'; badge.textContent='Status N/A'; }
      });

      // Update card chip if card is already built
      updateCardBadge(tr);
    });
  }

  /* -------------------- Card rendering -------------------- */
  function buildCardForRow(tr){
    if (tr.__wlCard) return; // idempotent
    const a = findInvoiceAnchor(tr); if (!a) return;

    const invNo = (a.textContent||'').trim();
    const invHref = abs(a.getAttribute('href')||'#');
    const orderNo = grab(tr, 'td[data-title="Order #"]');
    const yourRef = grab(tr, 'td[data-title="Your Ref"]');
    const jobRef  = grab(tr, 'td[data-title="Job Ref"]');
    const invDate = grab(tr, 'td[data-title="Invoice Date"]');
    const dueDate = grab(tr, 'td[data-title="Due Date"]');
    const goods   = grab(tr, 'td[data-title="Goods Total"]');
    const tax     = grab(tr, 'td[data-title="Tax"]');
    const total   = grab(tr, 'td[data-title="Total Amount"]');
    const lines   = grab(tr, 'td[data-title="Lines"]');
    const branch  = grab(tr, 'td[data-title="Branch"]');

    // Hide original anchor but keep it for keyboard/fallback
    a.style.position='absolute'; a.style.width='1px'; a.style.height='1px';
    a.style.overflow='hidden'; a.style.clip='rect(1px,1px,1px,1px)'; a.setAttribute('aria-hidden','true');

    const head = document.createElement('div');
    head.className = 'wl-row-head';
    head.innerHTML = `
      <div class="wl-head-left">
        <span class="wl-inv-no">Invoice #${invNo}</span>
        <span class="wl-chip wl-chip--slate wl-card-badge"><span class="wl-badge-skel">checking…</span></span>
        <div class="wl-meta">
          ${invDate ? `<span>Inv: ${invDate}</span>` : ``}
          ${dueDate ? `<span>Due: ${dueDate}</span>` : ``}
          ${orderNo ? `<span>Order: ${orderNo}</span>` : ``}
          ${branch  ? `<span>Branch: ${branch}</span>` : ``}
          ${lines   ? `<span>Lines: ${lines}</span>` : ``}
          ${yourRef && yourRef!=='-' ? `<span>Your Ref: ${yourRef}</span>` : ``}
          ${jobRef  && jobRef!=='-'  ? `<span>Job: ${jobRef}</span>` : ``}
          ${(total||goods||tax) ? `<span>Total: ${total||goods}</span>` : ``}
        </div>
      </div>
      <div class="wl-head-right">
        <a class="wl-btn wl-btn--ghost" href="${invHref}">Open</a>
        <button class="wl-btn wl-btn--primary" type="button" data-act="toggle">View details</button>
      </div>
    `;
    tr.insertAdjacentElement('afterbegin', head);

    const details = document.createElement('div');
    details.className = 'wl-details';
    tr.appendChild(details);

    head.querySelector('[data-act="toggle"]').addEventListener('click', async (e)=>{
      e.preventDefault();
      if (!details.dataset.loaded){
        details.dataset.loaded = '1';
        details.innerHTML = `<div style="color:#475569;">Loading…</div>`;
        try{
          const html = await fetch(invHref, { credentials:'same-origin' }).then(r=>r.text());
          const doc  = new DOMParser().parseFromString(html, 'text/html');
          const table = doc.querySelector('#ctl00_PageBody_ctl02_InvoiceDetailsGrid_ctl00, .rgMasterTable');
          if (table){
            const lines = [];
            table.querySelectorAll('tbody > tr').forEach(tr2=>{
              const code = (tr2.querySelector('td[data-title="Product Code"]')||{}).textContent||'';
              const desc = (tr2.querySelector('td[data-title="Description"]')||{}).textContent||'';
              const qty  = (tr2.querySelector('td[data-title="Qty"]')||{}).textContent||'';
              const tot  = (tr2.querySelector('td[data-title="Total"]')||{}).textContent||'';
              if ((code+desc).trim()) lines.push({code:code.trim(),desc:desc.trim(),qty:qty.trim(),tot:tot.trim()});
            });
            details.innerHTML = lines.slice(0,6).map(l=>`
              <div style="display:flex;gap:12px;justify-content:space-between;border:1px solid #eef0f3;border-radius:12px;padding:10px;">
                <div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:800;min-width:86px">${l.code||'-'}</div>
                <div style="flex:1;min-width:160px">${l.desc||''}</div>
                <div style="white-space:nowrap;font-weight:700">${l.qty?`Qty: ${l.qty}`:''}${l.tot?` · ${l.tot}`:''}</div>
              </div>
            `).join('') || `<div style="color:#475569;">No line items found.</div>`;
          }else{
            details.innerHTML = `<div style="color:#475569;">Couldn’t read details. <a href="${invHref}">Open invoice page</a>.</div>`;
          }
        }catch(ex){
          details.innerHTML = `<div style="color:#7f1d1d;background:#fee2e2;border:1px solid #fecaca;border-radius:10px;padding:10px;">
            Sorry, we couldn’t load details. You can still <a href="${invHref}">open the invoice page</a>.
          </div>`;
        }
      }
      details.classList.toggle('show');
      e.currentTarget.textContent = details.classList.contains('show') ? 'Hide details' : 'View details';
    });

    tr.__wlCard = true;
    updateCardBadge(tr); // reflect current dataset status
  }

  function updateCardBadge(tr){
    const chip = tr.querySelector('.wl-card-badge'); if (!chip) return;
    const status = tr.dataset.status || 'unknown';
    const out = Number(tr.dataset.outstanding || 0);
    if (status === 'paid'){ chip.className='wl-chip wl-chip--green wl-card-badge'; chip.textContent='Paid'; }
    else if (status === 'partial'){ chip.className='wl-chip wl-chip--amber wl-card-badge'; chip.textContent=`Partial · ${toUSD(out)}`; }
    else if (status === 'open'){ chip.className='wl-chip wl-chip--amber wl-card-badge'; chip.textContent=`Open · ${toUSD(out)}`; }
    else { chip.className='wl-chip wl-chip--slate wl-card-badge'; chip.textContent='Status N/A'; }
    if (tr.dataset.overdue === '1' && (status==='open'||status==='partial')){
      chip.className = chip.className.replace('wl-chip--amber','wl-chip--red'); // red for overdue
      chip.textContent += ' · Overdue';
    }
  }

  function cardify(master){
    const host = master.closest('#ctl00_PageBody_InvoicesGrid, .RadGrid[id*="InvoicesGrid"]');
    if (!host) return;
    master.classList.add('wl-inv-cardify');
    const rows = Array.from(master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
    rows.forEach(tr=>{ try{ buildCardForRow(tr); }catch(e){ warn('Cardify row fail', e); } });
  }

  /* -------------------- Toolbar (keep select filtered + simple status filter) -------------------- */
  function ensureToolbar(){
    const grid = document.getElementById('ctl00_PageBody_InvoicesGrid');
    const flex = grid?.closest('.bodyFlexItem') || grid;
    if (!flex) return null;
    if (flex.querySelector('.wl-toolbar')) return flex.querySelector('.wl-toolbar');

    const bar = document.createElement('div');
    bar.className = 'wl-toolbar';
    bar.innerHTML = `
      <button class="wl-chipbtn" data-filter="all" data-active="true">All</button>
      <button class="wl-chipbtn" data-filter="open">Open</button>
      <button class="wl-chipbtn" data-filter="partial">Partial</button>
      <button class="wl-chipbtn" data-filter="paid">Paid</button>
      <div class="wl-spacer"></div>
      <button class="wl-act" data-action="select-filtered">Select filtered</button>
    `;
    flex.insertBefore(bar, flex.firstChild);

    bar.addEventListener('click',(e)=>{
      const chip = e.target.closest('.wl-chipbtn');
      const act  = e.target.closest('.wl-act');
      if (chip){
        bar.querySelectorAll('.wl-chipbtn').forEach(b=>b.dataset.active='false');
        chip.dataset.active='true';
        applyFilter(chip.dataset.filter);
      }else if (act && act.dataset.action==='select-filtered'){
        selectFilteredOnPage();
      }
    });
    return bar;
  }

  function applyFilter(filter){
    const master = document.querySelector('#ctl00_PageBody_InvoicesGrid .rgMasterTable'); if (!master) return;
    const rows = master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow');
    rows.forEach(tr=>{
      const status = tr.dataset.status || 'unknown';
      const show = (filter === 'all') ? true : (status === filter);
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

  /* -------------------- Observer for partial postbacks -------------------- */
  function attachGridObserver(){
    const gridRoot = document.getElementById('ctl00_PageBody_InvoicesGrid'); if (!gridRoot) return;
    if (gridRoot.__wlObserved) return; gridRoot.__wlObserved = true;

    const mo = new MutationObserver(()=>{
      const master = gridRoot.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || gridRoot.querySelector('.rgMasterTable');
      if (master){
        requestAnimationFrame(async ()=>{
          await applyBadges(master);
          cardify(master);
        });
      }
    });
    mo.observe(gridRoot, { childList:true, subtree:true });
    log('Grid observer attached');
  }

  /* -------------------- Boot -------------------- */
  async function boot(){
    const master = await getMasterTable(); if (!master){ log('No invoices grid found'); return; }
    ensureToolbar();
    try{ await ensureApIndex(); }catch(e){ warn('AP index error', e); }
    await applyBadges(master);
    cardify(master);
    attachGridObserver();
    log('Invoices enhanced (card UI + working logic)');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
  window.addEventListener('load', ()=>boot(), { once:true });

  // Debug
  window.WLInvoices = { run: boot, version: VERSION };
})();



















/* =========================================================================
   Woodson — Invoices Card UI (v3.2)  + per-row radio
   ========================================================================== */
(function () {
  'use strict';
  if (!/Invoices_r\.aspx/i.test(location.pathname)) return;
  if (window.__WL_INVOICES_ENHANCED__ && window.WLInvoices?.version?.startsWith?.('3.2')) return;
  window.__WL_INVOICES_ENHANCED__ = true;

  const VERSION = '3.2';
  const t0 = performance.now();
  const log  = (...a)=>console.log('%cINV','color:#005d6e;font-weight:700;',`v${VERSION} [+${(performance.now()-t0).toFixed(1)}ms]`,...a);
  const warn = (...a)=>console.warn('%cINV','color:#b45309;font-weight:700;',`v${VERSION} [+${(performance.now()-t0).toFixed(1)}ms]`,...a);

  /* -------------------- CSS additions (radio next to checkbox) -------------------- */
  (function injectCSS(){
    const css = `
      /* keep from v3.1 … */

      /* lay out the first cell content (checkbox + radio) nicely */
      .wl-inv-cardify tr.rgRow > td:first-child,
      .wl-inv-cardify tr.rgAltRow > td:first-child{
        display:flex !important; align-items:center; gap:10px; padding:0 6px;
      }
      .wl-inv-cardify input.wl-radio { cursor:pointer; }
      .wl-inv-cardify input[type="checkbox"] { cursor:pointer; }
    `;
    const el = document.createElement('style'); el.textContent = css; document.head.appendChild(el);
  })();

  /* -------------------- utils (same as v3.1) -------------------- */
  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
  const txt = (el)=> (el?.textContent || '').trim();
  const toUSD = (n)=> Number(n).toLocaleString(undefined,{style:'currency',currency:'USD'});
  const parseMoney = (s)=> { const v = parseFloat(String(s||'').replace(/[^0-9.\-]/g,'') || '0'); return Number.isFinite(v) ? v : 0; };
  const nearlyZero = (n)=> Math.abs(n) < 0.009;
  async function waitFor(selector, {root=document, tries=60, interval=120} = {}){ for (let i=0;i<tries;i++){ const el = root.querySelector(selector); if (el) return el; await sleep(interval); } return null; }
  const abs  = (u)=>{ try{ return new URL(u, location.origin).toString(); }catch{ return u; } };

  /* -------------------- date range + AP crawler (unchanged from v3.1) -------------------- */
  function readInvoiceDateRange(){ /* … unchanged … */
    const getClientState = (id)=>{ const inp=document.getElementById(id); if(!inp) return null; try{ return JSON.parse(inp.value.replace(/&quot;/g,'"')); }catch{ return null; } };
    const toISO=(state,fallback)=>{ if(state?.valueAsString){ const m=state.valueAsString.match(/^(\d{4}-\d{2}-\d{2})-/); if(m) return m[1]; }
      const vis=document.getElementById(fallback); if(vis&&vis.value){ const d=new Date(vis.value); if(!isNaN(d)) return d.toISOString().slice(0,10); } return null; };
    const s=toISO(getClientState('ctl00_PageBody_dtDateEntryStart_RadDatePicker1_dateInput_ClientState'),'ctl00_PageBody_dtDateEntryStart_RadDatePicker1_dateInput');
    const e=toISO(getClientState('ctl00_PageBody_dtDateEntryEnd_RadDatePicker1_dateInput_ClientState'),'ctl00_PageBody_dtDateEntryEnd_RadDatePicker1_dateInput');
    return { startISO:s, endISO:e };
  }
  function apCacheKey(startISO,endISO){ return `wl_ap_index_v3_${startISO||'na'}_${endISO||'na'}`; }
  async function buildAccountPaymentIndex(startISO,endISO){ /* … unchanged from your working logic … */
    const key=apCacheKey(startISO,endISO);
    try{ const raw=sessionStorage.getItem(key); if(raw){ const {at,data}=JSON.parse(raw); if(Date.now()-at<10*60*1000){ return new Map(data); } } }catch{}
    const base=new URL('/AccountPayment_r.aspx',location.origin); base.searchParams.set('searchType','TransactionDate');
    if(startISO) base.searchParams.set('startDate',`${startISO}T00:00:00`); if(endISO) base.searchParams.set('endDate',`${endISO}T23:59:59`);
    const parser=new DOMParser();
    const fetchText=async(u)=>{ const r=await fetch(u,{credentials:'same-origin',cache:'no-cache'}); if(!r.ok) throw new Error('HTTP '+r.status); return r.text(); };
    const normalize=(href)=>{ const u=new URL(href,base.toString()); if(startISO&&!u.searchParams.get('startDate')) u.searchParams.set('startDate',`${startISO}T00:00:00`);
      if(endISO&&!u.searchParams.get('endDate')) u.searchParams.set('endDate',`${endISO}T23:59:59`);
      if(!u.searchParams.get('searchType')) u.searchParams.set('searchType','TransactionDate'); u.pathname='/AccountPayment_r.aspx'; return u.toString(); };
    const index=new Map();
    const parseRows=(doc)=>{ const host=doc.querySelector('#ctl00_PageBody_InvoicesGrid')||doc;
      const tbl=host.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00')||host.querySelector('.rgMasterTable'); if(!tbl) return 0;
      let n=0; tbl.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow').forEach(tr=>{
        const type=txt(tr.querySelector('td[data-title="Type"]'))||txt(tr.children[1]);
        let docNo=txt(tr.querySelector('span[id*="_DocumentNumber"]'))||txt(tr.querySelector('td[data-title="Doc. #"] span'))||txt(tr.querySelector('td[data-title="Document #"] span'));
        const outTxt=txt(tr.querySelector('td[data-title="Amount Outstanding"]'))||txt(tr.children[8]); const outVal=parseMoney(outTxt);
        if(docNo&&(type||'').toLowerCase()==='invoice'){ index.set(docNo,{outstanding:outVal}); n++; }
      }); return n; };
    try{
      const firstHTML=await fetchText(base.toString()); const firstDoc=parser.parseFromString(firstHTML,'text/html'); parseRows(firstDoc);
      const hrefs=[...new Set([base.toString(), ...Array.from(firstDoc.querySelectorAll('ul.pagination a.page-link[href]')).map(a=>normalize(a.getAttribute('href')||'')) ])].filter(u=>u!==base.toString());
      if(hrefs.length){ const results=await Promise.allSettled(hrefs.map(h=>fetchText(h))); results.forEach(r=>{ if(r.status==='fulfilled'){ const d=parser.parseFromString(r.value,'text/html'); parseRows(d); } }); }
    }catch(e){ console.warn(e); }
    try{ sessionStorage.setItem(key, JSON.stringify({at:Date.now(), data:[...index.entries()]})); }catch{}
    return index;
  }
  let __AP_PROMISE__=null; async function ensureApIndex(){ const {startISO,endISO}=readInvoiceDateRange(); if(!__AP_PROMISE__){ __AP_PROMISE__=buildAccountPaymentIndex(startISO,endISO); } return __AP_PROMISE__; }

  /* -------------------- grid helpers -------------------- */
  async function getMasterTable(){ const root=await waitFor('#ctl00_PageBody_InvoicesGrid'); if(!root) return null;
    return root.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || root.querySelector('.rgMasterTable'); }
  function todayAtMidnight(){ const d=new Date(); d.setHours(0,0,0,0); return d; }
  const grab = (tr, sel) => { const el = tr.querySelector(sel); return el ? el.textContent.trim() : ''; };
  function findInvoiceAnchor(tr){ return tr.querySelector('td[data-title="Invoice #"] a[href*="InvoiceDetails_r.aspx"], td[data-title="Invoice #"] a[href*="/Invoices_r.aspx"]'); }

  /* -------------------- NEW: per-row radio -------------------- */
  function ensureRowRadio(tr, invNo){
    const first = tr.querySelector('td:first-child'); if (!first || !invNo) return;
    if (first.querySelector('input.wl-radio')) return; // already added
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.className = 'wl-radio';
    radio.name = 'wlInvPick';
    radio.value = invNo;
    radio.setAttribute('aria-label', `Select invoice ${invNo}`);
    radio.title = `Select invoice ${invNo}`;
    radio.style.marginLeft = '2px';
    first.appendChild(radio);

    // clicking on the card (non-interactive area) selects this radio
    tr.addEventListener('click', (e)=>{
      const hit = e.target.closest('a,button,input,label');
      if (hit) return;
      radio.checked = true;
    });
  }

  /* -------------------- badging (same logic; writes data-* used by card) -------------------- */
  async function applyBadges(master){
    const rows = Array.from(master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow')); if (!rows.length) return;
    const apIndex = await ensureApIndex().catch(()=>null);
    const today = todayAtMidnight();

    rows.forEach(tr=>{
      const a = findInvoiceAnchor(tr);
      const invNo = a ? (a.textContent||'').trim() : '';
      if (!invNo) return;

      // ensure the radio now that we know invNo
      ensureRowRadio(tr, invNo);

      let status = 'unknown'; let outLeft = 0;
      if (!apIndex){ status='unknown'; }
      else{
        const info = apIndex.get(invNo);
        const total = parseMoney(grab(tr,'td[data-title="Total Amount"]'));
        if (!info || nearlyZero(info.outstanding)){ status='paid'; outLeft=0; }
        else {
          const out = Number(info.outstanding)||0;
          if (Number.isFinite(total) && out < total - 0.009){ status='partial'; outLeft=out; }
          else { status='open'; outLeft=out; }
        }
      }
      const dueTxt = grab(tr,'td[data-title="Due Date"]');
      const due = dueTxt ? new Date(dueTxt) : null;
      const overdue = (status === 'open' || status === 'partial') && due && due < today;

      tr.dataset.status = status;
      tr.dataset.outstanding = String(outLeft || 0);
      tr.dataset.overdue = overdue ? '1' : '0';

      updateCardBadge(tr);
    });
  }

  /* -------------------- card rendering (same as v3.1, now calls ensureRowRadio) -------------------- */
  function updateCardBadge(tr){
    const chip = tr.querySelector('.wl-card-badge'); if (!chip) return;
    const status = tr.dataset.status || 'unknown';
    const out = Number(tr.dataset.outstanding || 0);
    if (status === 'paid'){ chip.className='wl-chip wl-chip--green wl-card-badge'; chip.textContent='Paid'; }
    else if (status === 'partial'){ chip.className='wl-chip wl-chip--amber wl-card-badge'; chip.textContent=`Partial · ${toUSD(out)}`; }
    else if (status === 'open'){ chip.className='wl-chip wl-chip--amber wl-card-badge'; chip.textContent=`Open · ${toUSD(out)}`; }
    else { chip.className='wl-chip wl-chip--slate wl-card-badge'; chip.textContent='Status N/A'; }
    if (tr.dataset.overdue === '1' && (status==='open'||status==='partial')){
      chip.className = chip.className.replace('wl-chip--amber','wl-chip--red'); chip.textContent += ' · Overdue';
    }
  }

  function buildCardForRow(tr){
    if (tr.__wlCard) return;
    const a = findInvoiceAnchor(tr); if (!a) return;
    const invNo = (a.textContent||'').trim();
    const invHref = abs(a.getAttribute('href')||'#');
    const orderNo = grab(tr, 'td[data-title="Order #"]');
    const yourRef = grab(tr, 'td[data-title="Your Ref"]');
    const jobRef  = grab(tr, 'td[data-title="Job Ref"]');
    const invDate = grab(tr, 'td[data-title="Invoice Date"]');
    const dueDate = grab(tr, 'td[data-title="Due Date"]');
    const goods   = grab(tr, 'td[data-title="Goods Total"]');
    const tax     = grab(tr, 'td[data-title="Tax"]');
    const total   = grab(tr, 'td[data-title="Total Amount"]');
    const lines   = grab(tr, 'td[data-title="Lines"]');
    const branch  = grab(tr, 'td[data-title="Branch"]');

    // hide original anchor for fallback
    a.style.position='absolute'; a.style.width='1px'; a.style.height='1px';
    a.style.overflow='hidden'; a.style.clip='rect(1px,1px,1px,1px)'; a.setAttribute('aria-hidden','true');

    // ensure radio now that we know the invoice number
    ensureRowRadio(tr, invNo);

    const head = document.createElement('div');
    head.className = 'wl-row-head';
    head.innerHTML = `
      <div class="wl-head-left">
        <span class="wl-inv-no">Invoice #${invNo}</span>
        <span class="wl-chip wl-chip--slate wl-card-badge"><span class="wl-badge-skel">checking…</span></span>
        <div class="wl-meta">
          ${invDate ? `<span>Inv: ${invDate}</span>` : ``}
          ${dueDate ? `<span>Due: ${dueDate}</span>` : ``}
          ${orderNo ? `<span>Order: ${orderNo}</span>` : ``}
          ${branch  ? `<span>Branch: ${branch}</span>` : ``}
          ${lines   ? `<span>Lines: ${lines}</span>` : ``}
          ${yourRef && yourRef!=='-' ? `<span>Your Ref: ${yourRef}</span>` : ``}
          ${jobRef  && jobRef!=='-'  ? `<span>Job: ${jobRef}</span>` : ``}
          ${(total||goods||tax) ? `<span>Total: ${total||goods}</span>` : ``}
        </div>
      </div>
      <div class="wl-head-right">
        <a class="wl-btn wl-btn--ghost" href="${invHref}">Open</a>
        <button class="wl-btn wl-btn--primary" type="button" data-act="toggle">View details</button>
      </div>
    `;
    tr.insertAdjacentElement('afterbegin', head);

    const details = document.createElement('div');
    details.className = 'wl-details';
    tr.appendChild(details);

    head.querySelector('[data-act="toggle"]').addEventListener('click', async (e)=>{
      e.preventDefault();
      if (!details.dataset.loaded){
        details.dataset.loaded = '1';
        details.innerHTML = `<div style="color:#475569;">Loading…</div>`;
        try{
          const html = await fetch(invHref, { credentials:'same-origin' }).then(r=>r.text());
          const doc  = new DOMParser().parseFromString(html, 'text/html');
          const table = doc.querySelector('#ctl00_PageBody_ctl02_InvoiceDetailsGrid_ctl00, .rgMasterTable');
          if (table){
            const items = [];
            table.querySelectorAll('tbody > tr').forEach(tr2=>{
              const code = (tr2.querySelector('td[data-title="Product Code"]')||{}).textContent||'';
              const desc = (tr2.querySelector('td[data-title="Description"]')||{}).textContent||'';
              const qty  = (tr2.querySelector('td[data-title="Qty"]')||{}).textContent||'';
              const tot  = (tr2.querySelector('td[data-title="Total"]')||{}).textContent||'';
              if ((code+desc).trim()) items.push({code:code.trim(),desc:desc.trim(),qty:qty.trim(),tot:tot.trim()});
            });
            details.innerHTML = items.slice(0,6).map(l=>`
              <div style="display:flex;gap:12px;justify-content:space-between;border:1px solid #eef0f3;border-radius:12px;padding:10px;">
                <div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:800;min-width:86px">${l.code||'-'}</div>
                <div style="flex:1;min-width:160px">${l.desc||''}</div>
                <div style="white-space:nowrap;font-weight:700">${l.qty?`Qty: ${l.qty}`:''}${l.tot?` · ${l.tot}`:''}</div>
              </div>
            `).join('') || `<div style="color:#475569;">No line items found.</div>`;
          } else {
            details.innerHTML = `<div style="color:#475569;">Couldn’t read details. <a href="${invHref}">Open invoice page</a>.</div>`;
          }
        }catch(ex){
          details.innerHTML = `<div style="color:#7f1d1d;background:#fee2e2;border:1px solid #fecaca;border-radius:10px;padding:10px;">
            Sorry, we couldn’t load details. You can still <a href="${invHref}">open the invoice page</a>.
          </div>`;
        }
      }
      details.classList.toggle('show');
      e.currentTarget.textContent = details.classList.contains('show') ? 'Hide details' : 'View details';
    });

    tr.__wlCard = true;
    updateCardBadge(tr);
  }

  function cardify(master){
    const host = master.closest('#ctl00_PageBody_InvoicesGrid, .RadGrid[id*="InvoicesGrid"]');
    if (!host) return;
    master.classList.add('wl-inv-cardify');
    const rows = Array.from(master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
    rows.forEach(tr=>{ try{ buildCardForRow(tr); }catch(e){ warn('Cardify row fail', e); } });
  }

  /* -------------------- toolbar (unchanged minimal) -------------------- */
  function ensureToolbar(){
    const grid = document.getElementById('ctl00_PageBody_InvoicesGrid');
    const flex = grid?.closest('.bodyFlexItem') || grid;
    if (!flex) return null;
    if (flex.querySelector('.wl-toolbar')) return flex.querySelector('.wl-toolbar');

    const bar = document.createElement('div');
    bar.className = 'wl-toolbar';
    bar.innerHTML = `
      <button class="wl-chipbtn" data-filter="all" data-active="true">All</button>
      <button class="wl-chipbtn" data-filter="open">Open</button>
      <button class="wl-chipbtn" data-filter="partial">Partial</button>
      <button class="wl-chipbtn" data-filter="paid">Paid</button>
      <div class="wl-spacer"></div>
      <button class="wl-act" data-action="select-filtered">Select filtered</button>
    `;
    flex.insertBefore(bar, flex.firstChild);

    bar.addEventListener('click',(e)=>{
      const chip = e.target.closest('.wl-chipbtn');
      const act  = e.target.closest('.wl-act');
      if (chip){
        bar.querySelectorAll('.wl-chipbtn').forEach(b=>b.dataset.active='false');
        chip.dataset.active='true';
        applyFilter(chip.dataset.filter);
      }else if (act && act.dataset.action==='select-filtered'){
        selectFilteredOnPage();
      }
    });
    return bar;
  }

  function applyFilter(filter){
    const master = document.querySelector('#ctl00_PageBody_InvoicesGrid .rgMasterTable'); if (!master) return;
    const rows = master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow');
    rows.forEach(tr=>{
      const status = tr.dataset.status || 'unknown';
      const show = (filter === 'all') ? true : (status === filter);
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

  /* -------------------- observer (unchanged, now cardify also ensures radios) -------------------- */
  function attachGridObserver(){
    const gridRoot = document.getElementById('ctl00_PageBody_InvoicesGrid'); if (!gridRoot) return;
    if (gridRoot.__wlObserved) return; gridRoot.__wlObserved = true;
    const mo = new MutationObserver(()=>{
      const master = gridRoot.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || gridRoot.querySelector('.rgMasterTable');
      if (master){
        requestAnimationFrame(async ()=>{
          await applyBadges(master);
          cardify(master);
        });
      }
    });
    mo.observe(gridRoot, { childList:true, subtree:true });
    log('Grid observer attached');
  }

  /* -------------------- boot -------------------- */
  async function boot(){
    const master = await getMasterTable(); if (!master){ log('No invoices grid found'); return; }
    ensureToolbar();
    try{ await ensureApIndex(); }catch(e){ warn('AP index error', e); }
    await applyBadges(master);
    cardify(master);
    attachGridObserver();
    log('Invoices enhanced (card UI + radios)');
  }

  if (document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', boot, { once:true }); } else { boot(); }
  window.addEventListener('load', ()=>boot(), { once:true });

  // Public helper: get the currently selected radio's invoice number
  window.WLInvoices = {
    run: boot,
    version: VERSION,
    getSelectedInvoice(){
      const r = document.querySelector('input.wl-radio:checked');
      return r ? r.value : null;
    }
  };
})();


















/* =========================================================================
   Patch — surface the built-in row checkbox & add our radio beside it
   - Reparents existing chkSelect into a visible wrap in the first cell
   - Appends a wlInvPick radio (value = invoice #)
   - Re-applies after Telerik partial postbacks
   ========================================================================== */
(function(){
  if (!/Invoices_r\.aspx/i.test(location.pathname)) return;

  // Minimal CSS to ensure the selection cluster is visible over the card
  const css = `
    .wl-select-wrap{
      position:absolute; left:10px; top:10px;
      display:flex; align-items:center; gap:8px;
      z-index:20; background:transparent;
    }
    /* first cell stays visible/clickable in card mode */
    .wl-inv-cardify tr.rgRow > td:first-child,
    .wl-inv-cardify tr.rgAltRow > td:first-child{
      display:block !important; position:absolute; left:0; top:0;
      border:none !important; background:transparent; padding:0 6px;
    }
    .wl-inv-cardify input[type="checkbox"], .wl-inv-cardify input.wl-radio { cursor:pointer; }
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const findMaster = ()=>(
    document.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') ||
    document.querySelector('#ctl00_PageBody_InvoicesGrid .rgMasterTable') ||
    document.querySelector('.RadGrid[id*="InvoicesGrid"] .rgMasterTable')
  );

  function moveAndAttachSelection(tr){
    const first = tr.cells && tr.cells[0];
    if (!first) return;

    // Ensure a visible wrap inside the first cell
    let wrap = first.querySelector('.wl-select-wrap');
    if (!wrap){
      wrap = document.createElement('div');
      wrap.className = 'wl-select-wrap';
      first.appendChild(wrap);
    }

    // 1) MOVE the existing Telerik checkbox into our wrap (do NOT clone)
    //    Example input: id/name ends with chkSelect (dynamic indices)
    let cb = tr.querySelector('input[type="checkbox"][name*="InvoicesGrid"][name*="chkSelect"]') ||
             tr.querySelector('input[type="checkbox"][name*="chkSelect"]');
    if (cb && cb.closest('.wl-select-wrap') !== wrap){
      wrap.appendChild(cb);
    }

    // 2) Add our single-select radio (if you want it)
    //    It's independent — keeps Telerik checkbox behavior intact.
    const invAnchor = tr.querySelector('td[data-title="Invoice #"] a');
    const invNo = invAnchor ? invAnchor.textContent.trim() : '';
    if (invNo && !wrap.querySelector('input.wl-radio')){
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.className = 'wl-radio';
      radio.name = 'wlInvPick';
      radio.value = invNo;
      radio.setAttribute('aria-label', `Select invoice ${invNo}`);
      wrap.appendChild(radio);

      // Clicking empty card space selects this radio (not links/buttons/inputs)
      tr.addEventListener('click', (e)=>{
        if (!e.target.closest('a,button,input,label')) radio.checked = true;
      });
    }
  }

  function applyAll(){
    const master = findMaster(); if (!master) return;
    master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow').forEach(moveAndAttachSelection);
  }

  // Initial pass
  applyAll();

  // Re-apply on partial postbacks / paging
  const gridRoot = document.getElementById('ctl00_PageBody_InvoicesGrid');
  if (gridRoot && !gridRoot.__wlSelObs){
    gridRoot.__wlSelObs = true;
    new MutationObserver(()=>applyAll()).observe(gridRoot, { childList:true, subtree:true });
  }

  // Expose helper (merged with your existing WLInvoices if present)
  window.WLInvoices = Object.assign({}, window.WLInvoices, {
    getSelectedInvoice(){ const r = document.querySelector('input.wl-radio:checked'); return r ? r.value : null; }
  });
})();
