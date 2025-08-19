/* =========================================================================
   Woodson — Invoices Card UI (v3.5)
   - Working logic (date-range AP crawl + badging + filters)
   - Card UI formatting
   - SURFACES ORIGINAL PER-ROW chkSelect CHECKBOXES (and decorators) IN EACH CARD
   - Keeps header Select-All checkbox functional
   - Deep logging; MutationObserver re-applies after Telerik partial postbacks
   ========================================================================== */

(function () {
  'use strict';
  if (!/Invoices_r\.aspx/i.test(location.pathname)) return;

  // ---- Log system ----------------------------------------------------------
  const LVL = { error:0, warn:1, info:2, debug:3, trace:4 };
  const LS_KEY = 'WL_INV_LOG';
  let LOG_LEVEL = (() => {
    const ls = (localStorage.getItem(LS_KEY) || '').toLowerCase();
    if (ls in LVL) return LVL[ls];
    return LVL.debug; // default verbose while we dial this in
  })();

  const prefix = (lvl) => [`%cINV`, `color:#005d6e;font-weight:700;`, `[${lvl.toUpperCase()}]`];
  const log = {
    setLevel(l){
      if (typeof l === 'string' && l.toLowerCase() in LVL) LOG_LEVEL = LVL[l.toLowerCase()];
      else if (typeof l === 'number') LOG_LEVEL = l|0;
      try { localStorage.setItem(LS_KEY, Object.keys(LVL).find(k=>LVL[k]===LOG_LEVEL) || 'debug'); }catch{}
      console.log(...prefix('info'), 'Log level set to', LOG_LEVEL, '(0=error,1=warn,2=info,3=debug,4=trace)');
    },
    error(...a){ if (LOG_LEVEL >= LVL.error) console.error(...prefix('error'), ...a); },
    warn (...a){ if (LOG_LEVEL >= LVL.warn ) console.warn (...prefix('warn' ), ...a); },
    info (...a){ if (LOG_LEVEL >= LVL.info ) console.log  (...prefix('info' ), ...a); },
    debug(...a){ if (LOG_LEVEL >= LVL.debug) console.log  (...prefix('debug'), ...a); },
    trace(...a){ if (LOG_LEVEL >= LVL.trace) console.log  (...prefix('trace'), ...a); },
    group(label, collapsed=true){
      if (LOG_LEVEL < LVL.debug) return { end(){} };
      (collapsed?console.groupCollapsed:console.group)(...prefix('debug'), label);
      return { end(){ try{ console.groupEnd(); }catch{} } };
    }
  };

  const VERSION = '3.5';
  const t0 = performance.now();
  log.info(`Version ${VERSION} booting… (+${(performance.now()-t0).toFixed(1)}ms)`);

  // ---- CSS (card UI + checkbox surfacing + visibility fallbacks) ----------
  (function injectCSS(){
    const css = `
      /* Keep Select-All visible, hide other headers for a clean card grid */
      #ctl00_PageBody_InvoicesGrid thead th:not(:first-child),
      .RadGrid[id*="InvoicesGrid"] thead th:not(:first-child){ display:none !important; }

      /* Cardify body rows; make rows positioning context for overlays */
      .wl-inv-cardify tr.rgRow, .wl-inv-cardify tr.rgAltRow{
        display:block; background:#fff; border:1px solid #e5e7eb; border-radius:16px;
        margin:12px 0; box-shadow:0 6px 18px rgba(15,23,42,.06); overflow:hidden; position:relative;
      }
      .wl-inv-cardify tr.rgRow > td, .wl-inv-cardify tr.rgAltRow > td{ display:none !important; }

      /* Keep first cell present as our anchor area (for the checkbox overlay) */
      .wl-inv-cardify tr.rgRow > td:first-child,
      .wl-inv-cardify tr.rgAltRow > td:first-child{
        display:block !important; position:absolute; left:0; top:0;
        border:none !important; background:transparent; padding:0; margin:0;
        width:auto !important; min-width:40px;
        z-index:100; /* sits above card head content */
      }

      /* Visible selection wrap that holds the ORIGINAL chkSelect and its decorator */
      .wl-select-wrap{
        position:absolute; left:10px; top:10px;
        display:flex; align-items:center; gap:8px;
        z-index:101; background:transparent;
      }

      /* If a decorator hides the input, force the native checkbox visible as fallback */
      .wl-select-wrap input[type="checkbox"]{
        display: inline-block !important;
        opacity: 1 !important;
        visibility: visible !important;
        width: 16px !important;
        height: 16px !important;
        pointer-events: auto !important;
        position: static !important;
        appearance: auto !important;
      }

      /* Common decorator classes — ensure they show if we moved them */
      .wl-select-wrap label,
      .wl-select-wrap .rfdCheckbox,
      .wl-select-wrap .rfdSkinnedCheckbox,
      .wl-select-wrap .rgCheckBox,
      .wl-select-wrap .RadCheckBox,
      .wl-select-wrap .checkbox,
      .wl-select-wrap .chk{
        display: inline-flex !important;
        align-items: center;
      }

      /* Optional: debug outline on the selection cluster (toggle via localStorage) */
      .wl-select-wrap[data-debug="1"]{
        outline: 2px dashed #ef4444;
        outline-offset: 2px;
        background: rgba(239,68,68,.06);
        border-radius: 8px;
        padding: 4px 6px;
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

      .wl-btn{ appearance:none; border:none; border-radius:12px; font-weight:900; padding:10px 14px; text-decoration:none; cursor:pointer; }
      .wl-btn--primary{ background:#6b0016; color:#fff; }
      .wl-btn--ghost{ background:#f8fafc; color:#111827; border:1px solid #e5e7eb; }

      .wl-details{ display:none; border-top:1px solid #eef0f3; padding:12px 14px 14px 46px; }
      .wl-details.show{ display:block; }

      .wl-badge-skel{
        background:repeating-linear-gradient(90deg,#f1f5f9,#f1f5f9 8px,#e2e8f0 8px,#e2e8f0 16px);
        color:transparent
      }

      /* Toolbar */
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
    log.debug('CSS injected', el);
  })();

  // ---- Utils ---------------------------------------------------------------
  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
  const txt = (el)=> (el?.textContent || '').trim();
  const toUSD = (n)=> Number(n).toLocaleString(undefined,{style:'currency',currency:'USD'});
  const parseMoney = (s)=> { const v = parseFloat(String(s||'').replace(/[^0-9.\-]/g,'') || '0'); return Number.isFinite(v) ? v : 0; };
  const nearlyZero = (n)=> Math.abs(n) < 0.009;
  async function waitFor(selector, {root=document, tries=60, interval=120} = {}){
    for (let i=0;i<tries;i++){ const el = root.querySelector(selector); if (el) return el; await sleep(interval); }
    return null;
  }

  // ---- Date range ----------------------------------------------------------
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
    log.info('Date range', { startISO, endISO, startState, endState });
    return { startISO, endISO };
  }

  // ---- AccountPayment crawler ---------------------------------------------
  function apCacheKey(startISO, endISO){ return `wl_ap_index_v3_${startISO || 'na'}_${endISO || 'na'}`; }

  async function buildAccountPaymentIndex(startISO, endISO){
    const key = apCacheKey(startISO, endISO);
    try{
      const raw = sessionStorage.getItem(key);
      if (raw){
        const { at, data } = JSON.parse(raw);
        if (Date.now() - at < 10*60*1000){
          const map = new Map(data);
          log.info('AP index cache HIT', { key, size: map.size, ageSec: ((Date.now()-at)/1000)|0 });
          return map;
        }
        log.info('AP index cache STALE', { key });
      } else {
        log.debug('AP index cache MISS', { key });
      }
    }catch(e){ log.warn('AP cache parse error', e); }

    const base = new URL('/AccountPayment_r.aspx', location.origin);
    base.searchParams.set('searchType','TransactionDate');
    if (startISO) base.searchParams.set('startDate', `${startISO}T00:00:00`);
    if (endISO)   base.searchParams.set('endDate',   `${endISO}T23:59:59`);
    log.info('AP crawl base URL', base.toString());

    const parser = new DOMParser();
    const fetchText = async (url) => {
      log.debug('AP fetch', url);
      const res = await fetch(url, { credentials:'same-origin', cache:'no-cache' });
      log.debug('AP fetch status', url, res.status);
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
      if (!tbl) { log.warn('AP parse: table not found'); return 0; }
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
      log.debug('AP parse: rows found', rows.length, 'invoices indexed', count);
      return count;
    };

    const collectPager = (doc)=>{
      const set = new Set([base.toString()]);
      doc.querySelectorAll('ul.pagination a.page-link[href]').forEach(a=>{
        const href = a.getAttribute('href');
        if (href && /pageIndex=\d+/.test(href)) set.add(normalizePagerUrl(href));
      });
      const list = Array.from(set);
      log.debug('AP pager links', list);
      return list;
    };

    try{
      const firstHTML = await fetchText(base.toString());
      const firstDoc  = parser.parseFromString(firstHTML, 'text/html');
      parseRows(firstDoc);
      const hrefs = collectPager(firstDoc).filter(u => u !== base.toString());
      if (hrefs.length){
        const results = await Promise.allSettled(hrefs.map(h=>fetchText(h)));
        results.forEach((r,i)=>{
          if (r.status === 'fulfilled'){
            const d = parser.parseFromString(r.value, 'text/html');
            parseRows(d);
          } else {
            log.warn('AP page fetch failed', hrefs[i], r.reason);
          }
        });
      }
    }catch(err){ log.warn('AP crawl failed:', err); }

    try{
      sessionStorage.setItem(key, JSON.stringify({at: Date.now(), data: Array.from(index.entries())}));
      log.info('AP index stored', { key, size: index.size });
    }catch(e){ log.warn('AP cache store failed', e); }

    return index;
  }

  let __AP_PROMISE__ = null;
  async function ensureApIndex(){
    const { startISO, endISO } = readInvoiceDateRange();
    if (!__AP_PROMISE__) { __AP_PROMISE__ = buildAccountPaymentIndex(startISO, endISO); }
    return __AP_PROMISE__;
  }

  // ---- Grid helpers --------------------------------------------------------
  async function getMasterTable(){
    const root = await waitFor('#ctl00_PageBody_InvoicesGrid');
    if (!root) { log.error('Grid host not found'); return null; }
    const master = root.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || root.querySelector('.rgMasterTable');
    log.info('Master table', master);
    return master;
  }
  function todayAtMidnight(){ const d = new Date(); d.setHours(0,0,0,0); return d; }

  function findInvoiceAnchor(tr){
    return tr.querySelector('td[data-title="Invoice #"] a[href*="InvoiceDetails_r.aspx"], td[data-title="Invoice #"] a[href*="/Invoices_r.aspx"]');
  }
  const grab = (tr, sel) => { const el = tr.querySelector(sel); return el ? el.textContent.trim() : ''; };
  const abs  = (u)=>{ try{ return new URL(u, location.origin).toString(); }catch{ return u; } };

  // ---- Checkbox surfacing (MOVE input + decorator; force visible if needed)
  function findCheckboxDecorator(cb, tr){
    if (!cb || !tr) return null;
    // <label for="...">
    let deco = tr.querySelector(`label[for="${cb.id}"]`);
    if (deco) return deco;
    // input wrapped by <label>
    if (cb.parentElement && cb.parentElement.tagName === 'LABEL') return cb.parentElement;
    // common RFD sibling
    const sib = cb.nextElementSibling;
    if (sib && /(rfd|chk|checkbox|rgCheck|RadCheck)/i.test(sib.className || '')) return sib;
    // guess any known decorator in the row
    const guess = tr.querySelector(`.rfdCheckbox, .rfdSkinnedCheckbox, .rgCheckBox, .RadCheckBox, .checkbox, .chk`);
    return guess || null;
  }

  function getRowCheckbox(tr){
    const first = tr.cells && tr.cells[0];
    let cb = first ? first.querySelector('input[type="checkbox"][name*="chkSelect"]') : null;
    if (!cb) cb = tr.querySelector('input[type="checkbox"][name*="chkSelect"]');
    return cb;
  }

  function surfaceCheckboxInCard(tr, rowIndex){
    if (!tr || !(tr.classList.contains('rgRow') || tr.classList.contains('rgAltRow'))) return;
    const firstCell = tr.cells && tr.cells[0];
    if (!firstCell) { log.warn('Row has no first cell', { rowIndex, tr }); return; }

    const cb = getRowCheckbox(tr);
    if (!cb){
      log.warn('Row checkbox not found', { rowIndex, html: firstCell.innerHTML.slice(0,200) });
      return;
    }

    // Create/ensure the visible wrap (optionally debug outline)
    let wrap = firstCell.querySelector('.wl-select-wrap');
    if (!wrap){
      wrap = document.createElement('div');
      wrap.className = 'wl-select-wrap';
      if (localStorage.getItem('WL_INV_DEBUG_WRAP') === '1') wrap.dataset.debug = '1';
      firstCell.appendChild(wrap);
      log.debug('Created .wl-select-wrap', { rowIndex });
    }

    // Move native checkbox
    if (cb.closest('.wl-select-wrap') !== wrap){
      wrap.appendChild(cb);
      log.info('Moved checkbox into card', { rowIndex, id: cb.id, name: cb.name });
    }

    // Move visual decorator if any (label / span / anchor etc.)
    const deco = findCheckboxDecorator(cb, tr);
    if (deco && deco.closest('.wl-select-wrap') !== wrap){
      wrap.appendChild(deco);
      log.info('Moved decorator with checkbox', { rowIndex, decoTag: deco.tagName, decoClass: deco.className });
    }

    // If still hidden, force native input visible as fallback
    const cs = getComputedStyle(cb);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0){
      cb.style.display = 'inline-block';
      cb.style.opacity = '1';
      cb.style.visibility = 'visible';
      cb.style.position = 'static';
      log.debug('Forced native checkbox visible (no/hidden decorator)', { rowIndex });
    }

    // Big click target: clicking empty part of the wrap toggles the checkbox
    if (!wrap.__wlClickBound){
      wrap.addEventListener('click', (e)=>{ if (e.target === wrap) cb.click(); }, { passive:true });
      wrap.__wlClickBound = true;
    }

    // Visibility diagnostics
    try{
      const r1 = wrap.getBoundingClientRect();
      const r2 = cb.getBoundingClientRect();
      const csFirst = getComputedStyle(firstCell);
      const csWrap  = getComputedStyle(wrap);
      log.trace('Checkbox visibility', {
        rowIndex,
        firstCell: { display: csFirst.display, position: csFirst.position, zIndex: csFirst.zIndex },
        wrap: { display: csWrap.display, position: csWrap.position, zIndex: csWrap.zIndex },
        wrapRect: { x: r1.x|0, y: r1.y|0, w: r1.width|0, h: r1.height|0 },
        cbRect:   { x: r2.x|0, y: r2.y|0, w: r2.width|0, h: r2.height|0 },
        cbStyles: { display: cs.display, visibility: cs.visibility, opacity: cs.opacity }
      });
    }catch{}
  }

  function surfaceAllCheckboxes(master){
    const rows = master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow');
    log.info('Surfacing checkboxes for rows', rows.length);
    let i=0; rows.forEach(tr=>surfaceCheckboxInCard(tr, i++));
  }

  // ---- Badging -------------------------------------------------------------
  async function applyBadges(master){
    const rows = Array.from(master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
    log.info('applyBadges on rows', rows.length);
    if (!rows.length) return;

    const apIndex = await ensureApIndex().catch((e)=>{ log.warn('ensureApIndex failed', e); return null; });
    const today = todayAtMidnight();

    rows.forEach((tr, idx)=>{
      const a = findInvoiceAnchor(tr);
      const invNo = a ? (a.textContent||'').trim() : '';

      // ensure checkbox visible early
      surfaceCheckboxInCard(tr, idx);

      let status = 'unknown';
      let outLeft = 0;

      if (invNo && apIndex){
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

      if (LOG_LEVEL >= LVL.debug){
        const g = log.group(`Row ${idx} badge ${invNo || '(no #)'} → ${status}${overdue?' (overdue)':''}`);
        log.debug('calc', { invNo, outLeft, due: dueTxt, overdue, total: grab(tr,'td[data-title="Total Amount"]') });
        g.end();
      }

      // Keep legacy table-badge updated (harmless if hidden)
      const invCells = tr.querySelectorAll('td[data-title="Invoice #"]');
      invCells.forEach(cell=>{
        let badge = cell.querySelector('.wl-badge');
        if (!badge){ badge = document.createElement('span'); badge.className='wl-badge'; cell.appendChild(badge); }
        if (status === 'paid'){ badge.className='wl-badge wl-chip wl-chip--green'; badge.textContent='Paid'; }
        else if (status === 'partial'){ badge.className='wl-badge wl-chip wl-chip--amber'; badge.textContent=`Partial · ${toUSD(outLeft)}`; }
        else if (status === 'open'){ badge.className='wl-badge wl-chip wl-chip--amber'; badge.textContent=`Open · ${toUSD(outLeft)}`; }
        else { badge.className='wl-badge wl-chip wl-chip--slate'; badge.textContent='Status N/A'; }
      });

      updateCardBadge(tr);
    });
  }

  // ---- Card rendering ------------------------------------------------------
  function buildCardForRow(tr, idx){
    if (tr.__wlCard) return;
    const a = findInvoiceAnchor(tr);
    const invNo = a ? (a.textContent||'').trim() : '';
    const invHref = a ? abs(a.getAttribute('href')||'#') : '#';
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

    if (a){
      a.style.position='absolute'; a.style.width='1px'; a.style.height='1px';
      a.style.overflow='hidden'; a.style.clip='rect(1px,1px,1px,1px)'; a.setAttribute('aria-hidden','true');
    }

    // Make sure checkbox is visible even before badges compute
    surfaceCheckboxInCard(tr, idx);

    const head = document.createElement('div');
    head.className = 'wl-row-head';
    head.innerHTML = `
      <div class="wl-head-left">
        <span class="wl-inv-no">${invNo ? `Invoice #${invNo}` : `Invoice`}</span>
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
        ${invHref !== '#' ? `<a class="wl-btn wl-btn--ghost" href="${invHref}">Open</a>` : ``}
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
          if (invHref === '#') throw new Error('No invoice href');
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
            log.debug('Details loaded for', invNo, 'items:', items.length);
          } else {
            details.innerHTML = `<div style="color:#475569;">Couldn’t read details.${invHref!=='#' ? ` <a href="${invHref}">Open invoice page</a>.` : ''}</div>`;
            log.warn('Details table not found for', invNo);
          }
        }catch(ex){
          log.warn('Details fetch failed', invNo, ex);
          details.innerHTML = `<div style="color:#7f1d1d;background:#fee2e2;border:1px solid #fecaca;border-radius:10px;padding:10px;">
            Sorry, we couldn’t load details.${invHref!=='#' ? ` You can still <a href="${invHref}">open the invoice page</a>.` : ``}
          </div>`;
        }
      }
      details.classList.toggle('show');
      e.currentTarget.textContent = details.classList.contains('show') ? 'Hide details' : 'View details';
    });

    tr.__wlCard = true;
    log.debug('Card built', { idx, invNo });
    updateCardBadge(tr);
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
      chip.className = chip.className.replace('wl-chip--amber','wl-chip--red');
      chip.textContent += ' · Overdue';
    }
  }

  function cardify(master){
    const host = master.closest('#ctl00_PageBody_InvoicesGrid, .RadGrid[id*="InvoicesGrid"]');
    if (!host) { log.warn('cardify: host not found'); return; }
    master.classList.add('wl-inv-cardify');
    const rows = Array.from(master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
    log.info('cardify on rows', rows.length);
    rows.forEach((tr,i)=>{ try{ buildCardForRow(tr,i); }catch(e){ log.warn('Cardify row fail', i, e); } });
    surfaceAllCheckboxes(master); // belt & suspenders
  }

  // ---- Toolbar -------------------------------------------------------------
  function ensureToolbar(){
    const grid = document.getElementById('ctl00_PageBody_InvoicesGrid');
    const flex = grid?.closest('.bodyFlexItem') || grid;
    if (!flex) { log.warn('Toolbar: container not found'); return null; }
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
    log.info('Toolbar added');

    bar.addEventListener('click',(e)=>{
      const chip = e.target.closest('.wl-chipbtn');
      const act  = e.target.closest('.wl-act');
      if (chip){
        bar.querySelectorAll('.wl-chipbtn').forEach(b=>b.dataset.active='false');
        chip.dataset.active='true';
        log.debug('Filter click', chip.dataset.filter);
        applyFilter(chip.dataset.filter);
      }else if (act && act.dataset.action==='select-filtered'){
        log.debug('Select filtered clicked');
        selectFilteredOnPage();
      }
    });
    return bar;
  }

  function applyFilter(filter){
    const master = document.querySelector('#ctl00_PageBody_InvoicesGrid .rgMasterTable'); if (!master) return;
    const rows = master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow');
    let shown=0, hidden=0;
    rows.forEach(tr=>{
      const status = tr.dataset.status || 'unknown';
      const show = (filter === 'all') ? true : (status === filter);
      tr.style.display = show ? '' : 'none';
      show ? shown++ : hidden++;
    });
    log.info('Filter applied', { filter, shown, hidden });
  }

  function selectFilteredOnPage(){
    const root = document.getElementById('ctl00_PageBody_InvoicesGrid'); if (!root) return;
    const boxes = root.querySelectorAll('tbody input[type="checkbox"][name*="chkSelect"]');
    let clicks = 0;
    boxes.forEach(cb=>{
      const tr = cb.closest('tr');
      if (tr && tr.style.display !== 'none' && !cb.checked){ cb.click(); clicks++; }
    });
    log.info('Select filtered - clicked', clicks, 'checkboxes');
  }

  // ---- Observer ------------------------------------------------------------
  function attachGridObserver(){
    const gridRoot = document.getElementById('ctl00_PageBody_InvoicesGrid'); if (!gridRoot) { log.warn('Observer: grid root not found'); return; }
    if (gridRoot.__wlObserved) return; gridRoot.__wlObserved = true;

    const mo = new MutationObserver((mutList)=>{
      let add=0, rem=0, sub=0;
      mutList.forEach(m=>{ add += m.addedNodes?.length||0; rem += m.removedNodes?.length||0; if (m.type==='childList') sub++; });
      const g = log.group(`MutationObserver fire: ${sub} childList, +${add}/-${rem}`, true);
      const master = gridRoot.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || gridRoot.querySelector('.rgMasterTable');
      if (master){
        requestAnimationFrame(async ()=>{
          log.debug('Observer: reapply enhancements…');
          await applyBadges(master);
          cardify(master);
          surfaceAllCheckboxes(master);
        });
      } else {
        log.warn('Observer: master table not found on mutation');
      }
      g.end();
    });
    mo.observe(gridRoot, { childList:true, subtree:true });
    log.info('Grid observer attached');
  }

  // ---- Boot ----------------------------------------------------------------
  async function boot(){
    log.info('Boot start');
    const headerSelectAll = document.querySelector('#ctl00_PageBody_InvoicesGrid thead input[type="checkbox"], .RadGrid[id*="InvoicesGrid"] thead input[type="checkbox"]');
    log.info('Header Select-All present?', !!headerSelectAll, headerSelectAll ? { id: headerSelectAll.id, name: headerSelectAll.name } : null);

    const master = await getMasterTable(); if (!master){ log.error('No master table — aborting'); return; }
    ensureToolbar();

    try{ await ensureApIndex(); }catch(e){ log.warn('AP index error', e); }

    await applyBadges(master);
    cardify(master);

    attachGridObserver();

    log.info('Boot complete', { rows: master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow').length, version: VERSION });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
  window.addEventListener('load', ()=>boot(), { once:true });

  // ---- Debug helpers -------------------------------------------------------
  window.WLInvoices = {
    version: VERSION,
    setLogLevel: log.setLevel,
    resurface(){
      const master = document.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00, #ctl00_PageBody_InvoicesGrid .rgMasterTable, .RadGrid[id*="InvoicesGrid"] .rgMasterTable');
      if (!master) return log.warn('resurface: no master');
      surfaceAllCheckboxes(master);
    },
    scanRows(){
      const master = document.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00, #ctl00_PageBody_InvoicesGrid .rgMasterTable, .RadGrid[id*="InvoicesGrid"] .rgMasterTable');
      if (!master) return log.warn('scanRows: no master');
      const rows = master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow');
      const out = [];
      rows.forEach((tr,i)=>{
        const cb = getRowCheckbox(tr);
        const a  = findInvoiceAnchor(tr);
        out.push({
          i, hasCb: !!cb, cbId: cb?.id, cbName: cb?.name,
          inv: a ? (a.textContent||'').trim() : null,
          status: tr.dataset.status, overdue: tr.dataset.overdue
        });
      });
      console.table(out);
      return out;
    }
  };

  log.info(`Version ${VERSION} ready (+${(performance.now()-t0).toFixed(1)}ms)`);
})();
