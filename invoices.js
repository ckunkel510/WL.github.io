/* =========================================================================
   Woodson — Invoices UI (v4.1)
   - Same working logic (AP crawl + date-range + badges + filters)
   - Card UI formatting
   - NEW: Always-visible custom checkbox in each card header
     • Clicking it calls the REAL chkSelect.click() (keeps Telerik postbacks)
     • Stays in sync with header Select-All and any programmatic changes
   - Run cap: at most 2 enhance passes per grid state; reset on MS AJAX postback
   ========================================================================== */

(function () {
  'use strict';
  if (!/Invoices_r\.aspx/i.test(location.pathname)) return;
  if (window.__WL_INVOICES_BOOTED__) return;
  window.__WL_INVOICES_BOOTED__ = true;

  /* ---------- logger (quiet by default) ---------- */
  const LVL = { error:0, warn:1, info:2, debug:3 };
  let LOG = LVL.info; // set to LVL.debug if you want more noise
  const log = {
    info (...a){ if (LOG>=LVL.info ) console.log('[INV]',...a); },
    warn (...a){ if (LOG>=LVL.warn ) console.warn('[INV]',...a); },
    debug(...a){ if (LOG>=LVL.debug) console.log('[INV]',...a); },
  };

  const VERSION = '4.2';
  log.info('Version', VERSION, 'booting…');


  /* ---------- default invoice date range ---------- */
  const WL_DEFAULT_INVOICE_LOOKBACK_MONTHS = 12;
  const WL_DEFAULT_RANGE_SESSION_KEY = 'wl_inv_default_12mo_range_applied_v1';

  function wlPad2(n){
    return String(n).padStart(2, '0');
  }

  function wlLocalISODate(d){
    return `${d.getFullYear()}-${wlPad2(d.getMonth() + 1)}-${wlPad2(d.getDate())}`;
  }

  function wlParseQueryDate(value){
    const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;

    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    d.setHours(0, 0, 0, 0);
    return isNaN(d) ? null : d;
  }

  function maybeApplyDefaultInvoiceDateRange(){
    try {
      // Prevent a redirect loop and avoid fighting the customer if they manually
      // change the range after the first automatic 12-month default is applied.
      if (sessionStorage.getItem(WL_DEFAULT_RANGE_SESSION_KEY) === '1') {
        return false;
      }

      const url = new URL(location.href);
      const searchType = url.searchParams.get('searchType') || 'InvoiceDate';

      // Do not override Product / Job Ref / Your Ref / Invoice # searches.
      if (!/^InvoiceDate$/i.test(searchType)) {
        sessionStorage.setItem(WL_DEFAULT_RANGE_SESSION_KEY, '1');
        return false;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const defaultStart = new Date(today);
      defaultStart.setMonth(defaultStart.getMonth() - WL_DEFAULT_INVOICE_LOOKBACK_MONTHS);

      const currentStart = wlParseQueryDate(url.searchParams.get('startDate'));
      const currentEnd = wlParseQueryDate(url.searchParams.get('endDate')) || today;

      const currentDays = currentStart
        ? Math.round((currentEnd - currentStart) / 86400000)
        : 0;

      // If it is already roughly 12 months or wider, leave it alone.
      if (currentDays >= 335) {
        sessionStorage.setItem(WL_DEFAULT_RANGE_SESSION_KEY, '1');
        return false;
      }

      url.searchParams.set('searchType', 'InvoiceDate');
      url.searchParams.set('startDate', `${wlLocalISODate(defaultStart)}T00:00:00`);
      url.searchParams.set('endDate', `${wlLocalISODate(today)}T23:59:59`);
      url.searchParams.delete('pageIndex');

      sessionStorage.setItem(WL_DEFAULT_RANGE_SESSION_KEY, '1');
      location.replace(url.toString());
      return true;
    } catch (e) {
      log.warn('Could not apply default invoice date range', e);
      return false;
    }
  }

  if (maybeApplyDefaultInvoiceDateRange()) return;

  /* ---------- CSS ---------- */
  (function injectCSS(){
    const css = `
      .wl-inv-shell, .wl-inv-shell * { box-sizing:border-box; }
      .wl-inv-shell {
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        color:#222;
        margin: 8px 0 14px;
      }
      .wl-inv-top {
        position:relative;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        margin-bottom:12px;
      }
      .wl-inv-title-wrap { min-width:0; }
      .wl-inv-title {
        color:#6b0016;
        font-size:1.24rem;
        line-height:1.2;
        font-weight:900;
      }
      .wl-inv-subtitle {
        color:#64748b;
        margin-top:3px;
        font-size:.92rem;
        line-height:1.35;
      }
      .wl-inv-menu-wrap {
        display:flex;
        align-items:center;
        gap:10px;
        min-width:0;
      }
      .wl-inv-menu-btn {
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        border:1px solid #e5e7eb;
        background:#fff;
        color:#6b0016;
        font-weight:900;
        border-radius:10px;
        padding:9px 13px;
        cursor:pointer;
        line-height:1.1;
        white-space:nowrap;
      }
      .wl-inv-menu-btn:hover { background:#fbf5f6; }
      .wl-inv-menu {
        position:absolute;
        left:0;
        top:46px;
        z-index:7001;
        width:min(390px, 92vw);
        max-height:0;
        overflow:auto;
        padding:0 8px;
        background:#fff;
        border:1px solid #e5e7eb;
        border-radius:14px;
        box-shadow:0 12px 30px rgba(0,0,0,.16);
        opacity:0;
        pointer-events:none;
        transition:max-height .25s ease, opacity .18s ease, padding .18s ease;
      }
      .wl-inv-menu.open {
        max-height:72vh;
        opacity:1;
        pointer-events:auto;
        padding:8px;
      }
      .wl-inv-menu-section + .wl-inv-menu-section {
        border-top:1px solid #eee;
        margin-top:6px;
        padding-top:6px;
      }
      .wl-inv-menu-label {
        color:#6b0016;
        font-size:.72rem;
        font-weight:900;
        text-transform:uppercase;
        letter-spacing:.06em;
        padding:5px 10px 3px;
      }
      .wl-inv-menu a {
        display:block;
        padding:9px 10px;
        color:#111;
        text-decoration:none;
        border-radius:9px;
        font-weight:700;
      }
      .wl-inv-menu a:hover,
      .wl-inv-menu a[aria-current="page"] {
        background:#fbf5f6;
        color:#6b0016;
      }
      .wl-inv-top-actions {
        display:flex;
        align-items:center;
        justify-content:flex-end;
        gap:8px;
        flex-wrap:wrap;
      }
      .wl-inv-top-actions a {
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:38px;
        padding:9px 14px;
        border-radius:10px;
        border:1px solid #e5e7eb;
        background:#fff;
        color:#111;
        text-decoration:none;
        font-weight:850;
      }
      .wl-inv-top-actions a:hover {
        background:#fbf5f6;
        color:#6b0016;
      }
      .wl-inv-hide {
        position:absolute !important;
        left:-9999px !important;
        width:1px !important;
        height:1px !important;
        overflow:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
      }

      /* Hide all header th except first (Select-All) */
      #ctl00_PageBody_InvoicesGrid thead th:not(:first-child),
      .RadGrid[id*="InvoicesGrid"] thead th:not(:first-child){ display:none !important; }

      /* Card rows */
      .wl-inv-cardify tr.rgRow, .wl-inv-cardify tr.rgAltRow{
        display:block; background:#fff; border:1px solid #e5e7eb; border-radius:16px;
        margin:12px 0; box-shadow:0 6px 18px rgba(15,23,42,.06); overflow:hidden; position:relative;
      }
      .wl-inv-cardify tr.rgRow > td, .wl-inv-cardify tr.rgAltRow > td{ display:none !important; }

      /* Keep first cell present (positioned) for legacy checkbox, but tiny/invisible */
      .wl-inv-cardify tr.rgRow > td:first-child,
      .wl-inv-cardify tr.rgAltRow > td:first-child{
        display:block !important; position:absolute; left:0; top:0; border:none !important;
        background:transparent; padding:0; margin:0; width:1px !important; min-width:1px !important; height:1px;
        z-index:1; overflow:hidden;
      }

      /* Ensure the REAL checkbox never shows/overlaps; keep it clickable for postback only if needed */
      .wl-hide-native{
        position:absolute !important; left:-9999px !important; top:auto !important; width:1px !important;
        height:1px !important; overflow:hidden !important; opacity:0 !important; pointer-events:none !important;
      }

      .wl-row-head{
        display:grid; gap:8px; padding:14px 14px 12px 46px; align-items:center;
        grid-template-columns: 1fr auto;
      }
      .wl-head-left{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
      .wl-head-right{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:flex-end; }

      /* Our always-visible card checkbox */
      .wl-card-check{
        width:20px; height:20px; border:2px solid #cbd5e1; border-radius:4px; background:#fff;
        display:inline-flex; align-items:center; justify-content:center; cursor:pointer;
        transition: border-color .15s ease, background .15s ease, box-shadow .15s ease;
      }
      .wl-card-check:focus-visible{ outline:0; box-shadow:0 0 0 3px #93c5fd; }
      .wl-card-check[data-checked="true"]{ border-color:#0ea5e9; background:#e0f2fe; }
      .wl-card-check svg{ width:12px; height:12px; display:none; }
      .wl-card-check[data-checked="true"] svg{ display:block; }

      .wl-inv-no{ font-weight:900; font-size:16px; letter-spacing:.2px; }
      @media (min-width:1024px){ .wl-inv-no{ font-size:18px; } }

      .wl-chip{ display:inline-flex; align-items:center; gap:6px; font-weight:800; border-radius:999px; padding:6px 10px; font-size:12px; }
      .wl-chip--slate{ background:#e2e8f0; color:#0f172a; }
      .wl-chip--green{ background:#dcfce7; color:#065f46; }
      .wl-chip--amber{ background:#fef3c7; color:#92400e; }
      .wl-chip--red{   background:#fee2e2; color:#7f1d1d; }

      .wl-meta{ display:flex; gap:12px; flex-wrap:wrap; font-size:12px; color:#475569; }
      .wl-meta span{ white-space:nowrap; }

      .wl-btn{ appearance:none; border:none; border-radius:12px; font-weight:900; padding:10px 14px; text-decoration:none; cursor:pointer; }
      .wl-btn--primary{ background:#6b0016; color:#fff; }
      .wl-btn--ghost{ background:#f8fafc; color:#111827; border:1px solid #e5e7eb; }

      .wl-details{ display:none; border-top:1px solid #eef0f3; padding:12px 14px 14px 46px; }
      .wl-details.show{ display:block; }

      /* Toolbar */
      .wl-toolbar {
        display:grid;
        grid-template-columns:minmax(260px, 1fr) auto;
        gap:10px;
        margin: 8px 0 12px;
        padding:12px;
        background:#fff;
        border:1px solid #e5e7eb;
        border-radius:16px;
        box-shadow:0 4px 14px rgba(15,23,42,.05);
      }
      .wl-toolbar-search { min-width:0; }
      .wl-toolbar-search label {
        display:block;
        margin-bottom:6px;
        color:#475569;
        font-size:12px;
        font-weight:900;
        text-transform:uppercase;
        letter-spacing:.04em;
      }
      .wl-inv-filter-input {
        width:100%;
        min-height:40px;
        border:1px solid #e5e7eb;
        border-radius:12px;
        padding:9px 11px;
        font:inherit;
        background:#fff;
      }
      .wl-inv-filter-input:focus {
        outline:2px solid rgba(107,0,22,.18);
        border-color:#6b0016;
      }
      .wl-toolbar-controls {
        display:flex;
        align-items:end;
        justify-content:flex-end;
        gap:8px;
        flex-wrap:wrap;
      }
      .wl-chipbtn {
        border:1px solid #e5e7eb; border-radius:999px; padding:7px 11px; font-weight:800;
        background:#fff; color:#0f172a; font-size:12px; cursor:pointer; user-select:none;
      }
      .wl-chipbtn[data-active="true"] { border-color:#6b0016; background:#fbf5f6; color:#6b0016; }
      .wl-spacer { display:none; }
      .wl-act { border:1px solid #e5e7eb; border-radius:10px; padding:8px 11px; font-weight:800; background:#f8fafc; font-size:12px; cursor:pointer; }
      .wl-act[data-action="pay-selected"] { background:#6b0016; border-color:#6b0016; color:#fff; }
      .wl-inv-results-note {
        grid-column:1 / -1;
        color:#64748b;
        font-size:12px;
        line-height:1.35;
      }
      .wl-inv-modal {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: none;
        align-items: flex-start;
        justify-content: center;
        padding: 18px;
        background: rgba(0,0,0,.45);
        overflow: auto;
      }
      .wl-inv-modal.open { display: flex; }
      .wl-inv-modal-card {
        width: min(1120px, 96vw);
        margin: auto 0;
        background: #fff;
        border-radius: 16px;
        border: 1px solid #e5e7eb;
        box-shadow: 0 18px 44px rgba(0,0,0,.22);
        overflow: hidden;
        max-height: calc(100vh - 36px);
        display: flex;
        flex-direction: column;
      }
      .wl-inv-modal-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        background: #6b0016;
        color: #fff;
        padding: 12px 14px;
        flex: 0 0 auto;
      }
      .wl-inv-modal-title { font-weight: 900; font-size: 1.05rem; }
      .wl-inv-modal-subtitle { color: rgba(255,255,255,.88); font-size: .88rem; margin-top: 2px; }
      .wl-inv-modal-close {
        border: 1px solid rgba(255,255,255,.55);
        background: rgba(255,255,255,.12);
        color: #fff;
        border-radius: 10px;
        min-height: 36px;
        padding: 7px 11px;
        font-weight: 850;
        cursor: pointer;
      }
      .wl-inv-modal-close:hover { background: rgba(255,255,255,.22); }
      .wl-inv-modal-body {
        padding: 14px;
        background: #fbf5f6;
        overflow: auto;
      }
      .wl-inv-modal-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 12px 0;
      }
      .wl-inv-modal-note {
        background: #fff;
        border: 1px solid #ead4d9;
        border-radius: 12px;
        color: #64748b;
        font-size: .88rem;
        line-height: 1.4;
        padding: 10px 12px;
        margin: 8px 0 12px;
      }
      .wl-inv-summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
        gap: 9px;
      }
      .wl-inv-summary-card {
        background: #fff;
        border: 1px solid #ead4d9;
        border-radius: 12px;
        padding: 10px;
      }
      .wl-inv-summary-label {
        color: #64748b;
        font-size: .78rem;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: .04em;
      }
      .wl-inv-summary-value {
        margin-top: 2px;
        color: #6b0016;
        font-weight: 900;
      }
      .wl-inv-lines {
        display: grid;
        gap: 10px;
      }
      .wl-inv-line {
        background: #fff;
        border: 1px solid #ead4d9;
        border-radius: 12px;
        padding: 11px;
        display: grid;
        grid-template-columns: minmax(120px, 170px) minmax(220px, 1fr) repeat(3, auto);
        align-items: center;
        gap: 10px;
      }
      .wl-inv-line-code {
        color: #6b0016;
        font-family: ui-monospace, Menlo, Consolas, monospace;
        font-weight: 900;
        word-break: break-word;
      }
      .wl-inv-line-desc { color:#222; font-weight:650; line-height:1.3; }
      .wl-inv-line-meta { color:#64748b; font-size:.86rem; white-space:nowrap; }
      .wl-inv-line-price { color:#111; font-weight:900; white-space:nowrap; }
      .wl-inv-loading,
      .wl-inv-error,
      .wl-inv-empty {
        background:#fff;
        border:1px solid #ead4d9;
        border-radius:12px;
        padding:14px;
        color:#64748b;
        line-height:1.45;
      }
      .wl-inv-error {
        color:#7f1d1d;
        background:#fee2e2;
        border-color:#fecaca;
      }
      .wl-inv-post-frame {
        position:absolute !important;
        left:-9999px !important;
        top:-9999px !important;
        width:1px !important;
        height:1px !important;
        border:0 !important;
        opacity:0 !important;
      }

      @media (max-width: 760px) {
        .wl-toolbar { grid-template-columns:1fr; }
        .wl-toolbar-controls { justify-content:flex-start; }
        .wl-inv-top { align-items:flex-start; flex-direction:column; }
      }
    `;
    const el = document.createElement('style'); el.textContent = css; document.head.appendChild(el);
  })();

  /* ---------- utils ---------- */
  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
  const txt = (el)=> (el?.textContent || '').trim();
  const toUSD = (n)=> Number(n).toLocaleString(undefined,{style:'currency',currency:'USD'});
  const parseMoney = (s)=> { const v = parseFloat(String(s||'').replace(/[^0-9.\-]/g,'') || '0'); return Number.isFinite(v) ? v : 0; };
  const nearlyZero = (n)=> Math.abs(n) < 0.009;
  async function waitFor(selector, {root=document, tries=60, interval=120} = {}){
    for (let i=0;i<tries;i++){ const el = root.querySelector(selector); if (el) return el; await sleep(interval); }
    return null;
  }

  /* ---------- date range ---------- */
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

  /* ---------- AP crawl & cache ---------- */
  function apCacheKey(startISO, endISO){ return `wl_ap_index_v3_${startISO || 'na'}_${endISO || 'na'}`; }
  async function buildAccountPaymentIndex(startISO, endISO){
    const key = apCacheKey(startISO, endISO);
    try{
      const raw = sessionStorage.getItem(key);
      if (raw){
        const { at, data } = JSON.parse(raw);
        if (Date.now() - at < 10*60*1000) return new Map(data);
      }
    }catch{}
    const base = new URL('/AccountPayment_r.aspx', location.origin);
    base.searchParams.set('searchType','TransactionDate');
    if (startISO) base.searchParams.set('startDate', `${startISO}T00:00:00`);
    if (endISO)   base.searchParams.set('endDate',   `${endISO}T23:59:59`);

    const parser = new DOMParser();
    const fetchText = (url)=> fetch(url, { credentials:'same-origin', cache:'no-cache' }).then(r=>r.text());
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
      const rows = tbl.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow');
      rows.forEach(tr=>{
        const type = txt(tr.querySelector('td[data-title="Type"]')) || txt(tr.children[1]);
        let docNo =
  txt(tr.querySelector('span[id*="_DocumentNumber"]')) ||
  txt(tr.querySelector('td[data-title="Doc. #"] span')) ||
  txt(tr.querySelector('td[data-title="Doc. #"]')) ||                // ✅ add this
  txt(tr.querySelector('td[data-title="Document #"] span')) ||
  txt(tr.querySelector('td[data-title="Document #"]'));              // ✅ and this

        const outTxt = txt(tr.querySelector('td[data-title="Amount Outstanding"]')) || txt(tr.children[8]);
        const outVal = parseMoney(outTxt);
        if (docNo && (type||'').toLowerCase() === 'invoice'){
          index.set(docNo, { outstanding: outVal });
        }
      });
    };

    try{
      const firstHTML = await fetchText(base.toString());
      const firstDoc  = parser.parseFromString(firstHTML, 'text/html');
      parseRows(firstDoc);
      const hrefs = Array.from(new Set(
        [base.toString()].concat(
          Array.from(firstDoc.querySelectorAll('ul.pagination a.page-link[href]'))
            .map(a=>a.getAttribute('href'))
            .filter(h=>/pageIndex=\d+/.test(h||''))
            .map(normalizePagerUrl)
        )
      )).filter(u => u !== base.toString());
      if (hrefs.length){
        const results = await Promise.allSettled(hrefs.map(h=>fetchText(h)));
        results.forEach(r=>{ if (r.status==='fulfilled'){ parseRows(parser.parseFromString(r.value, 'text/html')); }});
      }
    }catch{}

    try{ sessionStorage.setItem(key, JSON.stringify({at: Date.now(), data: Array.from(index.entries())})); }catch{}
    return index;
  }
  let __AP_PROMISE__ = null;
  async function ensureApIndex(){
    const { startISO, endISO } = readInvoiceDateRange();
    if (!__AP_PROMISE__) __AP_PROMISE__ = buildAccountPaymentIndex(startISO, endISO);
    return __AP_PROMISE__;
  }

  /* ---------- grid helpers ---------- */
  async function getMasterTable(){
    const root = await waitFor('#ctl00_PageBody_InvoicesGrid');
    if (!root) return null;
    return root.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || root.querySelector('.rgMasterTable');
  }
  function todayAtMidnight(){ const d = new Date(); d.setHours(0,0,0,0); return d; }
  function findInvoiceAnchor(tr){
    return tr.querySelector('td[data-title="Invoice #"] a[href*="InvoiceDetails_r.aspx"], td[data-title="Invoice #"] a[href*="/Invoices_r.aspx"]');
  }
  const grab = (tr, sel) => { const el = tr.querySelector(sel); return el ? el.textContent.trim() : ''; };
  const abs  = (u)=>{ try{ return new URL(u, location.origin).toString(); }catch{ return u; } };

  const escapeHtml = (value)=> String(value == null ? '' : value).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
  const escapeAttr = (value)=> escapeHtml(value).replace(/'/g, '&#39;');

  function getStoredCashAccountFlag(){
    try{
      const raw = localStorage.getItem('wl_account_is_cash_v1');
      if (raw === 'true') return true;
      if (raw === 'false') return false;
    }catch{}
    return null;
  }

  function normalizeMenuLabel(label){
    label = String(label || '').trim();
    if (/^Account Information$/i.test(label)) return 'Account Dashboard';
    if (/^Quicklists$/i.test(label)) return 'Shopping Lists';
    return label;
  }

  function buildAccountMenu(root){
    const menu = root.querySelector('.wl-inv-menu');
    const btn = root.querySelector('.wl-inv-menu-btn');
    if (!menu || !btn || btn.__wlMenuBound) return;

    const currentPath = (window.location.pathname || '').split('/').pop().toLowerCase();
    const isCashAccount = getStoredCashAccountFlag();
    const paymentLabel = isCashAccount === true ? 'Reload Balance' : (isCashAccount === false ? 'Make a Payment' : 'Make a Payment / Reload Balance');

    let accountSettingLinks = [
      ['Quicklists_R.aspx', 'Shopping Lists']
    ];

    if (isCashAccount !== true) {
      accountSettingLinks.push(['Statements_R.aspx', 'Statements']);
    }

    accountSettingLinks = accountSettingLinks.concat([
      ['CustomerTokens.aspx', 'Payment Methods'],
      ['AccountSettings.aspx', 'Change Password / Account Settings'],
      ['AddressList_R.aspx', 'Addresses'],
      ['Contacts_r.aspx', 'Contacts']
    ]);

    const groups = [
      { label:'', links:[['AccountInfo_R.aspx', 'Account Dashboard']] },
      {
        label:'Transactions',
        links:[
          ['AccountPayment_r.aspx', paymentLabel],
          ['OpenQuotes_r.aspx', 'Quotes'],
          ['OpenOrders_r.aspx', 'Orders'],
          ['Invoices_r.aspx', 'Invoices'],
          ['CreditNotes_r.aspx', 'Credit Notes'],
          ['ProductsPurchased_R.aspx', 'Products Purchased']
        ]
      },
      { label:'Account Settings', links:accountSettingLinks }
    ];

    menu.innerHTML = groups.map(group => `
      <div class="wl-inv-menu-section">
        ${group.label ? `<div class="wl-inv-menu-label">${escapeHtml(group.label)}</div>` : ''}
        ${group.links.map(([href, label]) => {
          const path = String(href || '').split('?')[0].split('#')[0].split('/').pop().toLowerCase();
          const current = path === currentPath ? ' aria-current="page"' : '';
          return `<a role="menuitem" href="${escapeAttr(href)}"${current}>${escapeHtml(normalizeMenuLabel(label))}</a>`;
        }).join('')}
      </div>
    `).join('');

    const toggle = (open)=>{
      menu.classList.toggle('open', !!open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    btn.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      toggle(!menu.classList.contains('open'));
    });

    document.addEventListener('click', (e)=>{
      if (!menu.classList.contains('open')) return;
      if (!menu.contains(e.target) && e.target !== btn) toggle(false);
    });

    btn.__wlMenuBound = true;
  }

  function ensureInvoicesShell(){
    const grid = document.getElementById('ctl00_PageBody_InvoicesGrid');
    const bodyFlex = grid?.closest('.bodyFlexContainer') || document.querySelector('.bodyFlexContainer');
    const host = bodyFlex?.parentElement || document.querySelector('#MainLayoutRow .col') || document.body;
    if (!host) return null;

    if (document.querySelector('.wl-inv-shell')) return document.querySelector('.wl-inv-shell');

    const legacyTitle = Array.from(document.querySelectorAll('.bodyFlexItem.listPageHeader, .listPageHeader'))
      .find(el => /Invoice/i.test(el.textContent || ''));
    if (legacyTitle) legacyTitle.classList.add('wl-inv-hide');

    const legacyNav = document.getElementById('ctl00_LeftSidebarContents_MainNav_NavigationMenu');
    if (legacyNav) legacyNav.classList.add('wl-inv-hide');

    const shell = document.createElement('div');
    shell.className = 'wl-inv-shell';
    shell.innerHTML = `
      <div class="wl-inv-top">
        <div class="wl-inv-menu-wrap">
          <button type="button" class="wl-inv-menu-btn" aria-expanded="false" aria-controls="wl-inv-menu">☰ Menu</button>
          <div class="wl-inv-title-wrap">
            <div class="wl-inv-title">Invoices</div>
            <div class="wl-inv-subtitle">Review invoice history, check payment status, select invoices, and send selected open balances to payment.</div>
          </div>
          <div class="wl-inv-menu" id="wl-inv-menu" role="menu"></div>
        </div>
        <div class="wl-inv-top-actions">
          <a href="AccountPayment_r.aspx">Make a Payment</a>
        </div>
      </div>
    `;

    host.insertBefore(shell, host.firstChild);
    buildAccountMenu(shell);
    return shell;
  }

  function invoiceHaystack(tr){
    const parts = [
      grab(tr, 'td[data-title="Invoice #"]'),
      grab(tr, 'td[data-title="Order #"]'),
      grab(tr, 'td[data-title="Your Ref"]'),
      grab(tr, 'td[data-title="Job Ref"]'),
      grab(tr, 'td[data-title="Invoice Date"]'),
      grab(tr, 'td[data-title="Due Date"]'),
      grab(tr, 'td[data-title="Goods Total"]'),
      grab(tr, 'td[data-title="Tax"]'),
      grab(tr, 'td[data-title="Total Amount"]'),
      grab(tr, 'td[data-title="Lines"]'),
      grab(tr, 'td[data-title="Branch"]')
    ];
    const cardText = tr.querySelector('.wl-row-head')?.textContent || '';
    return (parts.join(' ') + ' ' + cardText).replace(/\s+/g, ' ').toLowerCase();
  }

  function getActiveInvoiceFilter(){
    return document.querySelector('.wl-toolbar .wl-chipbtn[data-active="true"]')?.dataset.filter || 'all';
  }



  /* ---------- NEW: Custom card checkbox (proxy to REAL chkSelect) ---------- */
  function findRealCheckbox(tr){
    return tr.querySelector('input[type="checkbox"][name*="chkSelect"]');
  }
  function ensureCardCheckbox(tr){
    // Create the visible control in the card header (left side)
    const headLeft = tr.querySelector('.wl-row-head .wl-head-left');
    if (!headLeft) return null;

    let btn = headLeft.querySelector('.wl-card-check');
    if (!btn){
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wl-card-check';
      btn.setAttribute('role','checkbox');
      btn.setAttribute('aria-checked','false');
      btn.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 11.2L3.3 8l1.4-1.4 1.8 1.8 4.8-4.8L12.7 5 6.5 11.2z"/></svg>`;
      headLeft.insertBefore(btn, headLeft.firstChild);
    }
    return btn;
  }
  function syncCardCheckboxFromReal(tr){
    const real = findRealCheckbox(tr); if (!real) return;
    const btn  = ensureCardCheckbox(tr); if (!btn) return;

    // Make sure the real one is hidden from view but kept in DOM
    real.classList.add('wl-hide-native');

    const checked = !!real.checked;
    btn.dataset.checked = checked ? 'true' : 'false';
    btn.setAttribute('aria-checked', checked ? 'true' : 'false');
    btn.disabled = !!real.disabled;
  }
  function bindCardCheckboxInteractions(tr){
    const real = findRealCheckbox(tr); if (!real) return;
    const btn  = ensureCardCheckbox(tr); if (!btn) return;

    // Clicking the visible button proxies to the real checkbox (fires Telerik handlers)
    if (!btn.__wlBound){
      btn.addEventListener('click', (e)=>{
        e.preventDefault(); e.stopPropagation();
        // Let Telerik do its thing via native click
        real.click();
        // After the real click, reflect UI state
        setTimeout(()=> syncCardCheckboxFromReal(tr), 0);
      });
      btn.__wlBound = true;
    }

    // If something else toggles the real one (Select-All, scripts), reflect UI
    if (!real.__wlBound){
      real.addEventListener('change', ()=> syncCardCheckboxFromReal(tr));
      real.__wlBound = true;
    }

    // Initial sync
    syncCardCheckboxFromReal(tr);
  }
  function syncAllCardChecks(master){
    master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow').forEach(tr=>{
      syncCardCheckboxFromReal(tr);
    });
  }

  /* ---------- badging ---------- */
  async function applyBadges(master){
    const rows = Array.from(master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
    if (!rows.length) return;

    const apIndex = await ensureApIndex().catch(()=>null);
    const today = todayAtMidnight();

    rows.forEach((tr)=>{
      const a = findInvoiceAnchor(tr);
      const invNo = a ? (a.textContent||'').trim() : '';

      let status = 'unknown';
      let outLeft = 0;

      if (invNo && apIndex){
        const info = apIndex.get(invNo);
        const total = parseMoney(grab(tr,'td[data-title="Total Amount"]'));
        if (!info || nearlyZero(info.outstanding)){
          status = 'paid';
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

      // Legacy badge (kept harmless)
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

  /* ---------- card rendering ---------- */
  function invoiceIdFromHref(href){
    const m = String(href || '').match(/[?&](?:id|oid)=(\d+)/i);
    return m ? m[1] : '';
  }

  function findFirst(root, selectors){
    for (const selector of selectors){
      const found = root.querySelector(selector);
      if (found) return found;
    }
    return null;
  }

  function parseInvoiceDetailMeta(doc){
    const headerText = txt(doc.querySelector('.listPageHeader'));
    const invoiceMatch = headerText.match(/Details\s+for\s+Invoice\s+(\S+)/i);

    const panelText = txt(doc.querySelector('.panel.panelAccountInfo')) || '';
    const getField = (label)=>{
      const m = panelText.match(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:?\\s*([^\\n\\r]+?)(?=\\s+[A-Z][A-Za-z ]+\\s*:|$)', 'i'));
      return m ? m[1].trim() : '';
    };

    return {
      invoiceNumber: invoiceMatch ? invoiceMatch[1] : '',
      orderNumber: getField('Order Number'),
      invoiceDate: getField('Invoice Date'),
      paymentTerms: getField('Payment Terms'),
      discount: getField('Discount')
    };
  }

  function parseInvoiceActionsFromDoc(doc){
    const invoiceLink = findFirst(doc, [
      '#ctl00_PageBody_ctl00_ShowInvoiceLink',
      '#ctl00_PageBody_ctl00_ShowInvoiceDropDown',
      'a[id*="ShowInvoice"]'
    ]);
    const orderImageLink = findFirst(doc, [
      '#ctl00_PageBody_ctl00_ShowOrderImageLink',
      '#ctl00_PageBody_ctl00_ShowOrderImageDropDown',
      'a[id*="ShowOrderImage"]'
    ]);
    const orderDocumentLink = findFirst(doc, [
      '#ctl00_PageBody_ctl00_ShowOrderDocumentLink',
      '#ctl00_PageBody_ctl00_ShowOrderDocumentDropDown',
      'a[id*="ShowOrderDocument"]'
    ]);
    const addToCartLink = findFirst(doc, [
      '#ctl00_PageBody_ctl00_AddToCart',
      '#ctl00_PageBody_ctl00_AddToCartDropDown',
      'a[id*="AddToCart"]'
    ]);

    const addHref = addToCartLink ? (addToCartLink.getAttribute('href') || addToCartLink.href || '') : '';
    const targetMatch = addHref.match(/__doPostBack\(['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]\)/i);

    return {
      invoicePdfHref: invoiceLink ? abs(invoiceLink.getAttribute('href') || invoiceLink.href || '') : '',
      orderImageHref: orderImageLink ? abs(orderImageLink.getAttribute('href') || orderImageLink.href || '') : '',
      orderDocumentHref: orderDocumentLink ? abs(orderDocumentLink.getAttribute('href') || orderDocumentLink.href || '') : '',
      addToCartHref: addHref,
      addToCartTarget: targetMatch ? targetMatch[1] : '',
      hasAddToCart: !!addToCartLink
    };
  }

  function parseInvoiceLinesFromDoc(doc){
    const table =
      doc.querySelector('#ctl00_PageBody_ctl00_InvoiceDetailsGrid_ctl00') ||
      doc.querySelector('#ctl00_PageBody_ctl00_InvoiceDetailsGrid .rgMasterTable') ||
      doc.querySelector('#ctl00_PageBody_ctl02_InvoiceDetailsGrid_ctl00') ||
      doc.querySelector('#ctl00_PageBody_ctl02_InvoiceDetailsGrid .rgMasterTable');

    const lines = [];
    if (table){
      table.querySelectorAll('tbody > tr, tr.rgRow, tr.rgAltRow').forEach(row=>{
        if (row.querySelector('th')) return;
        const code = txt(row.querySelector('td[data-title="Product Code"]'));
        const description = txt(row.querySelector('td[data-title="Description"]'));
        const qty = txt(row.querySelector('td[data-title="Qty"]'));
        const per = txt(row.querySelector('td[data-title="Per"]'));
        const price = txt(row.querySelector('td[data-title="Price"]'));
        const uom = txt(row.querySelector('td[data-title="UOM"]'));
        const tax = txt(row.querySelector('td[data-title="Tax"]'));
        const total = txt(row.querySelector('td[data-title="Total"]'));
        if ((code + description).trim()) lines.push({ code, description, qty, per, price, uom, tax, total });
      });
    }

    return lines;
  }

  async function fetchInvoiceDetail(invHref){
    const html = await fetch(invHref, { credentials:'same-origin', cache:'no-cache' }).then(r=>{
      if (!r.ok) throw new Error('Invoice details request failed: ' + r.status);
      return r.text();
    });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return {
      doc,
      meta: parseInvoiceDetailMeta(doc),
      actions: parseInvoiceActionsFromDoc(doc),
      lines: parseInvoiceLinesFromDoc(doc)
    };
  }

  function submitInvoiceDetailPost(invHref, actionTarget, button){
    if (!invHref || !actionTarget) return Promise.reject(new Error('Missing invoice add-to-cart target.'));

    return fetch(invHref, { credentials:'same-origin', cache:'no-cache' })
      .then(r=>{
        if (!r.ok) throw new Error('Could not reload invoice details page: ' + r.status);
        return r.text();
      })
      .then(html=>{
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const sourceForm = doc.querySelector('form');
        if (!sourceForm) throw new Error('Invoice details form was not found.');

        const form = document.createElement('form');
        form.method = (sourceForm.getAttribute('method') || 'post').toLowerCase();
        form.action = abs(sourceForm.getAttribute('action') || invHref);
        form.style.display = 'none';

        sourceForm.querySelectorAll('input, select, textarea').forEach(field=>{
          const name = field.getAttribute('name');
          if (!name) return;
          if ((field.type === 'checkbox' || field.type === 'radio') && !field.checked) return;

          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = name;
          input.value = field.value || '';
          form.appendChild(input);
        });

        const setHidden = (name, value)=>{
          let input = form.querySelector(`input[name="${String(name).replace(/"/g, '\\"')}"]`);
          if (!input){
            input = document.createElement('input');
            input.type = 'hidden';
            input.name = name;
            form.appendChild(input);
          }
          input.value = value || '';
        };

        setHidden('__EVENTTARGET', actionTarget);
        setHidden('__EVENTARGUMENT', '');

        document.body.appendChild(form);
        form.submit();
      });
  }

  function addInvoiceToCart(invHref, actions, button){
    const originalText = button ? button.textContent : '';
    let target = actions && actions.addToCartTarget;

    if (!target && actions && actions.addToCartHref){
      const m = String(actions.addToCartHref).match(/__doPostBack\(['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]\)/i);
      if (m) target = m[1];
    }

    if (button){
      button.disabled = true;
      button.textContent = 'Adding to Cart…';
    }

    submitInvoiceDetailPost(invHref, target, button).catch(err=>{
      console.error('Add invoice to cart failed', err);
      if (button){
        button.disabled = false;
        button.textContent = originalText || 'Add Invoice to Cart';
      }
      alert('We could not add this invoice to the cart from this pop-up. The invoice details page will open so you can add it from there.');
      location.href = invHref;
    });
  }

  function openInvoiceModal(inv){
    const existing = document.getElementById('wl-inv-detail-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'wl-inv-modal open';
    modal.id = 'wl-inv-detail-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="wl-inv-modal-card">
        <div class="wl-inv-modal-head">
          <div>
            <div class="wl-inv-modal-title">Invoice #${escapeHtml(inv.invNo || '')}</div>
            <div class="wl-inv-modal-subtitle">${escapeHtml(inv.invDate || '')}${inv.orderNo ? ' • Order ' + escapeHtml(inv.orderNo) : ''}${inv.total ? ' • Total ' + escapeHtml(inv.total) : ''}</div>
          </div>
          <button type="button" class="wl-inv-modal-close">Close</button>
        </div>
        <div class="wl-inv-modal-body">
          <div class="wl-inv-loading">Loading invoice details…</div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = ()=>{
      modal.classList.remove('open');
      setTimeout(()=>modal.remove(), 160);
    };

    modal.querySelector('.wl-inv-modal-close').addEventListener('click', closeModal);
    modal.addEventListener('click', e=>{ if (e.target === modal) closeModal(); });
    const keyHandler = (e)=>{
      if (e.key === 'Escape' && modal.classList.contains('open')){
        closeModal();
        document.removeEventListener('keydown', keyHandler);
      }
    };
    document.addEventListener('keydown', keyHandler);

    fetchInvoiceDetail(inv.href).then(detail=>{
      const body = modal.querySelector('.wl-inv-modal-body');
      const meta = detail.meta || {};
      const actions = detail.actions || {};

      const invoiceNo = meta.invoiceNumber || inv.invNo || '';
      const orderNo = meta.orderNumber || inv.orderNo || '';
      const invoiceDate = meta.invoiceDate || inv.invDate || '';
      const paymentTerms = meta.paymentTerms || '';
      const discount = meta.discount || '';

      body.innerHTML = `
        <div class="wl-inv-summary-grid">
          <div class="wl-inv-summary-card"><div class="wl-inv-summary-label">Invoice</div><div class="wl-inv-summary-value">#${escapeHtml(invoiceNo)}</div></div>
          <div class="wl-inv-summary-card"><div class="wl-inv-summary-label">Order</div><div class="wl-inv-summary-value">${escapeHtml(orderNo || '—')}</div></div>
          <div class="wl-inv-summary-card"><div class="wl-inv-summary-label">Invoice Date</div><div class="wl-inv-summary-value">${escapeHtml(invoiceDate || '—')}</div></div>
          <div class="wl-inv-summary-card"><div class="wl-inv-summary-label">Due Date</div><div class="wl-inv-summary-value">${escapeHtml(inv.dueDate || '—')}</div></div>
          <div class="wl-inv-summary-card"><div class="wl-inv-summary-label">Terms</div><div class="wl-inv-summary-value">${escapeHtml(paymentTerms || '—')}</div></div>
          <div class="wl-inv-summary-card"><div class="wl-inv-summary-label">Total</div><div class="wl-inv-summary-value">${escapeHtml(inv.total || '—')}</div></div>
        </div>

        <div class="wl-inv-modal-actions">
          ${actions.hasAddToCart ? '<button type="button" class="wl-btn wl-btn--primary" id="wl-inv-add-cart">Add Invoice to Cart</button>' : ''}
          ${actions.invoicePdfHref ? '<a class="wl-btn wl-btn--ghost" href="' + escapeAttr(actions.invoicePdfHref) + '" target="_blank" rel="noopener">Download Invoice PDF</a>' : ''}
          ${actions.orderImageHref ? '<a class="wl-btn wl-btn--ghost" href="' + escapeAttr(actions.orderImageHref) + '" target="_blank" rel="noopener">View Delivery Images</a>' : ''}
          ${actions.orderDocumentHref ? '<a class="wl-btn wl-btn--ghost" href="' + escapeAttr(actions.orderDocumentHref) + '" target="_blank" rel="noopener">Download Order PDF</a>' : ''}
        </div>

        <div class="wl-inv-modal-note">
          Download Invoice PDF opens the generated invoice document. Delivery images open only when images are attached to the original order.
        </div>

        <div class="wl-inv-lines"></div>
      `;

      const addBtn = body.querySelector('#wl-inv-add-cart');
      if (addBtn) addBtn.addEventListener('click', ()=>addInvoiceToCart(inv.href, actions, addBtn));

      const linesWrap = body.querySelector('.wl-inv-lines');
      if (!detail.lines.length){
        linesWrap.appendChild(document.createRange().createContextualFragment('<div class="wl-inv-empty">No line items were found for this invoice.</div>'));
        return;
      }

      detail.lines.forEach(line=>{
        const el = document.createElement('div');
        el.className = 'wl-inv-line';
        el.innerHTML = `
          <div class="wl-inv-line-code">${escapeHtml(line.code || '—')}</div>
          <div class="wl-inv-line-desc">${escapeHtml(line.description || '—')}</div>
          <div class="wl-inv-line-meta">${line.qty ? 'Qty: ' + escapeHtml(line.qty) : ''}${line.per ? ' ' + escapeHtml(line.per) : ''}</div>
          <div class="wl-inv-line-price">${line.price ? escapeHtml(line.price) : ''}</div>
          <div class="wl-inv-line-meta">${line.total ? 'Total: ' + escapeHtml(line.total) : ''}</div>
        `;
        linesWrap.appendChild(el);
      });
    }).catch(err=>{
      console.error('Invoice modal load failed', err);
      const body = modal.querySelector('.wl-inv-modal-body');
      body.innerHTML = `
        <div class="wl-inv-error">Sorry, we could not load invoice details in this view.</div>
        <div class="wl-inv-modal-actions">
          <a class="wl-btn wl-btn--primary" href="${escapeAttr(inv.href)}">Open Invoice Details</a>
        </div>
      `;
    });
  }

  function buildCardForRow(tr){
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

    const head = document.createElement('div');
    head.className = 'wl-row-head';
    head.innerHTML = `
      <div class="wl-head-left">
        <!-- custom card checkbox gets inserted here -->
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
        ${invHref !== '#' ? `<button class="wl-btn wl-btn--ghost" type="button" data-act="invoice-modal">View Invoice</button>` : ``}
        <button class="wl-btn wl-btn--primary" type="button" data-act="toggle">Line Details</button>
      </div>
    `;
    tr.insertAdjacentElement('afterbegin', head);

    // Build and bind the visible card checkbox (proxy to real)
    bindCardCheckboxInteractions(tr);

    const details = document.createElement('div');
    details.className = 'wl-details';
    tr.appendChild(details);

    const modalBtn = head.querySelector('[data-act="invoice-modal"]');
    if (modalBtn) {
      modalBtn.addEventListener('click', (e)=>{
        e.preventDefault();
        openInvoiceModal({
          invNo,
          href: invHref,
          orderNo,
          invDate,
          dueDate,
          total,
          branch
        });
      });
    }

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
          } else {
            details.innerHTML = `<div style="color:#475569;">Couldn’t read details. <a href="${invHref}">Open invoice page</a>.</div>`;
          }
        }catch{
          details.innerHTML = `<div style="color:#7f1d1d;background:#fee2e2;border:1px solid #fecaca;border-radius:10px;padding:10px;">
            Sorry, we couldn’t load details.${invHref!=='#' ? ` You can still <a href="${invHref}">open the invoice page</a>.` : ``}
          </div>`;
        }
      }
      details.classList.toggle('show');
      e.currentTarget.textContent = details.classList.contains('show') ? 'Hide Details' : 'Line Details';
    });

    tr.__wlCard = true;
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
    if (!host) return;
    master.classList.add('wl-inv-cardify');
    const rows = Array.from(master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
    rows.forEach(tr=>{ try{ buildCardForRow(tr); }catch(e){ log.warn('Cardify row fail', e); } });

    // After cards exist, sync all custom checkboxes from real ones
    syncAllCardChecks(master);
    applyFilter(getActiveInvoiceFilter());
  }

  /* ---------- toolbar ---------- */
  function ensureToolbar(){
    const grid = document.getElementById('ctl00_PageBody_InvoicesGrid');
    const flex = grid?.closest('.bodyFlexItem') || grid;
    if (!flex) return null;
    if (flex.querySelector('.wl-toolbar')) return flex.querySelector('.wl-toolbar');

    const bar = document.createElement('div');
    bar.className = 'wl-toolbar';
    bar.innerHTML = `
  <div class="wl-toolbar-search">
    <label for="wl-inv-filter-text">Search invoices</label>
    <input id="wl-inv-filter-text" class="wl-inv-filter-input" type="search" placeholder="Search invoice #, order #, branch, job, reference, date, or amount...">
  </div>
  <div class="wl-toolbar-controls">
    <button type="button" class="wl-chipbtn" data-filter="all" data-active="true">All</button>
    <button type="button" class="wl-chipbtn" data-filter="open">Open</button>
    <button type="button" class="wl-chipbtn" data-filter="partial">Partial</button>
    <button type="button" class="wl-chipbtn" data-filter="paid">Paid</button>
    <button type="button" class="wl-act" data-action="clear-search">Clear</button>
    <button type="button" class="wl-act" data-action="select-filtered">Select filtered</button>
    <button type="button" class="wl-act" data-action="pay-selected" title="Go to Account Payment with selected invoices prefilled">Pay selected</button>
  </div>
  <div class="wl-inv-results-note" id="wl-inv-results-note">Showing invoices from the current WebTrack result set.</div>
`;


    flex.insertBefore(bar, flex.firstChild);

    const searchInput = bar.querySelector('#wl-inv-filter-text');
    if (searchInput && !searchInput.__wlBound){
      searchInput.addEventListener('input', ()=> applyFilter(getActiveInvoiceFilter()));
      searchInput.__wlBound = true;
    }

    bar.addEventListener('click',(e)=>{
  const chip = e.target.closest('.wl-chipbtn');
  const act  = e.target.closest('.wl-act');

  if (chip){
    e.preventDefault(); e.stopPropagation();
    bar.querySelectorAll('.wl-chipbtn').forEach(b=>b.dataset.active='false');
    chip.dataset.active='true';
    applyFilter(chip.dataset.filter);
  } else if (act){
    e.preventDefault(); e.stopPropagation();
    if (act.dataset.action==='select-filtered'){
      selectFilteredOnPage();
    } else if (act.dataset.action==='pay-selected'){
      paySelected();
    } else if (act.dataset.action==='clear-search'){
      if (searchInput) searchInput.value = '';
      bar.querySelectorAll('.wl-chipbtn').forEach(b=>b.dataset.active='false');
      const all = bar.querySelector('.wl-chipbtn[data-filter="all"]');
      if (all) all.dataset.active = 'true';
      applyFilter('all');
      if (searchInput) searchInput.focus();
    }
  }
});

    return bar;
  }
  function applyFilter(filter){
    const master = document.querySelector('#ctl00_PageBody_InvoicesGrid .rgMasterTable'); if (!master) return;
    const rows = Array.from(master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
    const needle = (document.getElementById('wl-inv-filter-text')?.value || '').trim().toLowerCase();

    let shown = 0;
    rows.forEach(tr=>{
      const status = tr.dataset.status || 'unknown';
      const statusMatch = (filter === 'all') ? true : (status === filter);
      const textMatch = !needle || invoiceHaystack(tr).indexOf(needle) >= 0;
      const show = statusMatch && textMatch;
      tr.style.display = show ? '' : 'none';
      if (show) shown++;
    });

    const note = document.getElementById('wl-inv-results-note');
    if (note) {
      const total = rows.length;
      const label = filter === 'all' ? 'all statuses' : filter;
      note.textContent = `Showing ${shown} of ${total} invoices from the current WebTrack result set (${label}${needle ? ', filtered by search' : ''}).`;
    }
  }
  function selectFilteredOnPage(){
    const root = document.getElementById('ctl00_PageBody_InvoicesGrid'); if (!root) return;
    const boxes = root.querySelectorAll('tbody input[type="checkbox"][name*="chkSelect"]');
    boxes.forEach(cb=>{
      const tr = cb.closest('tr');
      if (tr && tr.style.display !== 'none' && !cb.checked){
        cb.click(); // let Telerik wire run
        const btn = tr.querySelector('.wl-card-check'); if (btn) syncCardCheckboxFromReal(tr);
      }
    });
  }

  /* ---------- observer (debounced + capped) ---------- */
  let observer, observeSuspended = false, debounceId = null, lastKey = '', runsForKey = 0;
  const MAX_RUNS_PER_KEY = 2;

  function computeGridKey(master){
    const rows = master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow');
    const n = rows.length || 0;
    const firstInv = n ? (findInvoiceAnchor(rows[0])?.textContent||'').trim() : '';
    const lastInv  = n ? (findInvoiceAnchor(rows[n-1])?.textContent||'').trim() : '';
    return `${n}:${firstInv}-${lastInv}`;
  }
  async function enhanceOnce(master, reason){
    if (!master) return;
    const key = computeGridKey(master);
    if (key === lastKey && runsForKey >= MAX_RUNS_PER_KEY){ log.info('Enhance skipped', {key, reason}); return; }
    if (key !== lastKey){ lastKey = key; runsForKey = 0; }
    runsForKey++;
    await applyBadges(master);
    cardify(master);
    // keep card checks synced in case of select-all changes
    syncAllCardChecks(master);
  }
  function attachGridObserver(){
    const gridRoot = document.getElementById('ctl00_PageBody_InvoicesGrid'); if (!gridRoot) return;
    if (observer) return;

    observer = new MutationObserver(()=>{
      if (observeSuspended) return;
      if (debounceId) clearTimeout(debounceId);
      debounceId = setTimeout(async ()=>{
        const master = gridRoot.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || gridRoot.querySelector('.rgMasterTable');
        if (master) await enhanceOnce(master, 'mutation');
      }, 120);
    });
    observer.observe(gridRoot, { childList:true, subtree:true });
  }

  function paySelected(){
  const root = document.getElementById('ctl00_PageBody_InvoicesGrid');
  if (!root) return;

  // All checked native checkboxes (we proxy UI, but these still carry Telerik behavior)
  const checked = Array.from(root.querySelectorAll('tbody input[type="checkbox"][name*="chkSelect"]:checked'));
  if (!checked.length){
    alert('Select at least one invoice to pay.');
    return;
  }

  // Build list of invoice numbers + compute payable total (prefers Outstanding if present)
  const items = [];
  let sumCents = 0;

  checked.forEach(cb=>{
    const tr = cb.closest('tr');
    if (!tr) return;

    // Invoice #
    const a = (tr.querySelector('td[data-title="Invoice #"] a[href]') || {});
    const invNo = (a.textContent || '').trim();
    if (!invNo) return;

    // Amount to pay: prefer outstanding dataset (set earlier by badges), else fall back to Total Amount cell
    let amt = parseFloat(tr.dataset.outstanding || 'NaN');
    if (!Number.isFinite(amt)){
      const totTxt = grab(tr, 'td[data-title="Total Amount"], td[data-title="Goods Total"]');
      amt = parseMoney(totTxt);
    }

    // Ignore if effectively zero (already paid)
    if (nearlyZero(amt)) return;

    items.push({ invNo, amt });
    sumCents += Math.round(amt * 100); // integer cents to avoid FP wobble
  });

  if (!items.length){
    alert('All selected invoices appear paid (no outstanding balance). Choose open/partial invoices.');
    return;
  }

  const invoiceList = items
  .map(x => String(x.invNo || '').trim())
  .map(s => {
    const core = s.replace(/^INV\s*/i,'');       // remove any existing "INV"
    return `INV${core}`;                          // add exactly one "INV"
  })
  .join(',');
  const total = (sumCents/100).toFixed(2);

  const u = new URL('/AccountPayment_r.aspx', location.origin);
  // "utm parameters" per your request — name them however you like:
  u.searchParams.set('utm_invoices', invoiceList);
  u.searchParams.set('utm_total', total);

  // Go!
  location.assign(u.toString());
}

  /* ---------- MS AJAX hooks ---------- */
  function attachAjaxHooks(){
    try{
      if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager){
        const prm = Sys.WebForms.PageRequestManager.getInstance();
        prm.add_initializeRequest(()=>{ observeSuspended = true; });
        prm.add_endRequest(()=> {
          observeSuspended = false; lastKey = ''; runsForKey = 0;
          ensureInvoicesShell();
          const master = document.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00, #ctl00_PageBody_InvoicesGrid .rgMasterTable, .RadGrid[id*="InvoicesGrid"] .rgMasterTable');
          if (master) enhanceOnce(master, 'ajax-endRequest');
        });
      }
    }catch{}
  }

  /* ---------- keep Select-All in sync with our card checks ---------- */
  function hookSelectAllSync(){
    const headCb = document.querySelector('#ctl00_PageBody_InvoicesGrid thead input[type="checkbox"], .RadGrid[id*="InvoicesGrid"] thead input[type="checkbox"]');
    if (!headCb || headCb.__wlHeadBound) return;
    headCb.addEventListener('change', ()=>{
      const master = document.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00, #ctl00_PageBody_InvoicesGrid .rgMasterTable, .RadGrid[id*="InvoicesGrid"] .rgMasterTable');
      if (master) syncAllCardChecks(master);
    });
    headCb.__wlHeadBound = true;
  }

  /* ---------- boot ---------- */
  async function boot(){
    ensureInvoicesShell();
    const master = await getMasterTable(); if (!master) return;
    ensureToolbar();
    try{ await ensureApIndex(); }catch{}
    await enhanceOnce(master, 'boot');
    attachAjaxHooks();
    attachGridObserver();
    hookSelectAllSync();
    log.info('Boot complete', { rows: master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow').length, version: VERSION });
  }

  if (document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', boot, { once:true }); }
  else { boot(); }

  /* ---------- export minimal debug helpers ---------- */
  window.WLInvoices = {
    version: VERSION,
    sync(){
      const master = document.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00, #ctl00_PageBody_InvoicesGrid .rgMasterTable, .RadGrid[id*="InvoicesGrid"] .rgMasterTable');
      if (master) syncAllCardChecks(master);
    }
  };
})();


