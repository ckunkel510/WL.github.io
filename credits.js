
/* =========================================================================
   Woodson — Credit Notes Card UI (v1.0)
   - Card UI formatting for CreditNotes_r.aspx
   - Always-visible custom checkbox in each card header
     • Proxies the real chkSelect (keeps Telerik postbacks/selection)
     • Syncs with header Select-All and programmatic changes
   - Toolbar: All / ≥$500 / <$500, Select filtered, Print selected, Export selected
   - Debounced observer; capped enhance passes per grid state; MS AJAX-aware
   ========================================================================== */

(function () {
  'use strict';
  if (!/CreditNotes_r\.aspx/i.test(location.pathname)) return;
  if (window.__WL_CREDITS_BOOTED__) return;
  window.__WL_CREDITS_BOOTED__ = true;

  /* ---------- logger ---------- */
  const LVL = { error:0, warn:1, info:2, debug:3 };
  let LOG = LVL.info;
  const log = {
    info (...a){ if (LOG>=LVL.info ) console.log('[CRN]',...a); },
    warn (...a){ if (LOG>=LVL.warn ) console.warn('[CRN]',...a); },
    debug(...a){ if (LOG>=LVL.debug) console.log('[CRN]',...a); },
  };
  const VERSION = '1.0';
  log.info('Version', VERSION, 'booting…');

  /* ---------- CSS ---------- */
  (function injectCSS(){
    const css = `
      /* Hide all header th except first (Select-All) */
      #ctl00_PageBody_CreditNotesGrid thead th:not(:first-child),
      .RadGrid[id*="CreditNotesGrid"] thead th:not(:first-child){ display:none !important; }

      /* Card rows */
      .wl-crn-cardify tr.rgRow, .wl-crn-cardify tr.rgAltRow{
        display:block; background:#fff; border:1px solid #e5e7eb; border-radius:16px;
        margin:12px 0; box-shadow:0 6px 18px rgba(15,23,42,.06); overflow:hidden; position:relative;
      }
      .wl-crn-cardify tr.rgRow > td, .wl-crn-cardify tr.rgAltRow > td{ display:none !important; }

      /* Keep first cell present (positioned) for legacy checkbox, but tiny/invisible */
      .wl-crn-cardify tr.rgRow > td:first-child,
      .wl-crn-cardify tr.rgAltRow > td:first-child{
        display:block !important; position:absolute; left:0; top:0; border:none !important;
        background:transparent; padding:0; margin:0; width:1px !important; min-width:1px !important; height:1px;
        z-index:1; overflow:hidden;
      }

      /* Hide the native checkbox visually; keep it for Telerik click/change */
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

      /* Visible card checkbox */
      .wl-card-check{
        width:20px; height:20px; border:2px solid #cbd5e1; border-radius:4px; background:#fff;
        display:inline-flex; align-items:center; justify-content:center; cursor:pointer;
        transition: border-color .15s ease, background .15s ease, box-shadow .15s ease;
      }
      .wl-card-check:focus-visible{ outline:0; box-shadow:0 0 0 3px #93c5fd; }
      .wl-card-check[data-checked="true"]{ border-color:#0ea5e9; background:#e0f2fe; }
      .wl-card-check svg{ width:12px; height:12px; display:none; }
      .wl-card-check[data-checked="true"] svg{ display:block; }

      .wl-crn-no{ font-weight:900; font-size:16px; letter-spacing:.2px; }
      @media (min-width:1024px){ .wl-crn-no{ font-size:18px; } }

      .wl-chip{ display:inline-flex; align-items:center; gap:6px; font-weight:800; border-radius:999px; padding:6px 10px; font-size:12px; }
      .wl-chip--slate{ background:#e2e8f0; color:#0f172a; }
      .wl-chip--green{ background:#dcfce7; color:#065f46; }
      .wl-chip--amber{ background:#fef3c7; color:#92400e; }

      .wl-meta{ display:flex; gap:12px; flex-wrap:wrap; font-size:12px; color:#475569; }
      .wl-meta span{ white-space:nowrap; }

      .wl-btn{ appearance:none; border:none; border-radius:12px; font-weight:900; padding:10px 14px; text-decoration:none; cursor:pointer; }
      .wl-btn--primary{ background:#6b0016; color:#fff; }
      .wl-btn--ghost{ background:#f8fafc; color:#111827; border:1px solid #e5e7eb; }

      .wl-details{ display:none; border-top:1px solid #eef0f3; padding:12px 14px 14px 46px; }
      .wl-details.show{ display:block; }

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
  })();

  /* ---------- utils ---------- */
  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
  const txt = (el)=> (el?.textContent || '').trim();
  const parseMoney = (s)=> { const v = parseFloat(String(s||'').replace(/[^0-9.\-]/g,'') || '0'); return Number.isFinite(v) ? v : 0; };
  const toUSD = (n)=> Number(n).toLocaleString(undefined,{style:'currency',currency:'USD'});
  async function waitFor(selector, {root=document, tries=60, interval=120} = {}){
    for (let i=0;i<tries;i++){ const el = root.querySelector(selector); if (el) return el; await sleep(interval); }
    return null;
  }
  const grab = (tr, sel) => { const el = tr.querySelector(sel); return el ? el.textContent.trim() : ''; };
  const abs  = (u)=>{ try{ return new URL(u, location.origin).toString(); }catch{ return u; } };

  /* ---------- grid helpers ---------- */
  async function getMasterTable(){
    const root = await waitFor('#ctl00_PageBody_CreditNotesGrid');
    if (!root) return null;
    return root.querySelector('#ctl00_PageBody_CreditNotesGrid_ctl00') || root.querySelector('.rgMasterTable');
  }
  function findCreditAnchor(tr){
    return tr.querySelector('td[data-title="Credit Note #"] a[href*="CreditNoteDetails_r.aspx"], td[data-title="Credit Note #"] a[href*="/CreditNotes_r.aspx"]');
  }
  function findRealCheckbox(tr){
    return tr.querySelector('input[type="checkbox"][name*="chkSelect"]');
  }

  /* ---------- Visible card checkbox (proxy) ---------- */
  function ensureCardCheckbox(tr){
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

    real.classList.add('wl-hide-native');
    const checked = !!real.checked;
    btn.dataset.checked = checked ? 'true' : 'false';
    btn.setAttribute('aria-checked', checked ? 'true' : 'false');
    btn.disabled = !!real.disabled;
  }
  function bindCardCheckboxInteractions(tr){
    const real = findRealCheckbox(tr); if (!real) return;
    const btn  = ensureCardCheckbox(tr); if (!btn) return;

    if (!btn.__wlBound){
      btn.addEventListener('click', (e)=>{
        e.preventDefault(); e.stopPropagation();
        real.click(); // let Telerik’s wiring run
        setTimeout(()=> syncCardCheckboxFromReal(tr), 0);
      });
      btn.__wlBound = true;
    }

    if (!real.__wlBound){
      real.addEventListener('change', ()=> syncCardCheckboxFromReal(tr));
      real.__wlBound = true;
    }

    syncCardCheckboxFromReal(tr);
  }
  function syncAllCardChecks(master){
    master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow').forEach(tr=> syncCardCheckboxFromReal(tr));
  }

  /* ---------- card rendering ---------- */
  function buildCardForRow(tr){
    if (tr.__wlCard) return;

    // Gather fields
    const a = findCreditAnchor(tr);
    const crNo   = a ? (a.textContent||'').trim() : '';
    const href   = a ? abs(a.getAttribute('href')||'#') : '#';
    const yourRef= grab(tr, 'td[data-title="Your Ref"]');
    const jobRef = grab(tr, 'td[data-title="Job Ref"]');
    const crDate = grab(tr, 'td[data-title="Credit Date"]');
    const goods  = grab(tr, 'td[data-title="Goods Total"]');
    const tax    = grab(tr, 'td[data-title="Tax"]');
    const total  = grab(tr, 'td[data-title="Total Amount"]');
    const lines  = grab(tr, 'td[data-title="Lines"]');
    const branch = grab(tr, 'td[data-title="Branch"]');

    // Dataset helpers for filtering
    tr.dataset.total = String(parseMoney(total || goods || '0'));
    tr.dataset.branch = branch || '';
    tr.dataset.crdate = crDate || '';

    if (a){
      a.style.position='absolute'; a.style.width='1px'; a.style.height='1px';
      a.style.overflow='hidden'; a.style.clip='rect(1px,1px,1px,1px)'; a.setAttribute('aria-hidden','true');
    }

    const head = document.createElement('div');
    head.className = 'wl-row-head';
    head.innerHTML = `
      <div class="wl-head-left">
        <!-- custom card checkbox gets inserted here -->
        <span class="wl-crn-no">${crNo ? `Credit Note #${crNo}` : `Credit Note`}</span>
        <span class="wl-chip wl-chip--slate wl-card-badge">${total ? `Total · ${toUSD(parseMoney(total))}` : `Total · n/a`}</span>
        <div class="wl-meta">
          ${crDate ? `<span>Date: ${crDate}</span>` : ``}
          ${branch ? `<span>Branch: ${branch}</span>` : ``}
          ${lines  ? `<span>Lines: ${lines}</span>` : ``}
          ${yourRef && yourRef!=='-' ? `<span>Your Ref: ${yourRef}</span>` : ``}
          ${jobRef  && jobRef!=='-'  ? `<span>Job: ${jobRef}</span>` : ``}
          ${(goods||tax) ? `<span>Goods: ${goods||'-'}${tax?` · Tax: ${tax}`:''}</span>` : ``}
        </div>
      </div>
      <div class="wl-head-right">
        ${href !== '#' ? `<a class="wl-btn wl-btn--ghost" href="${href}">Open</a>` : ``}
        <button class="wl-btn wl-btn--primary" type="button" data-act="toggle">View details</button>
      </div>
    `;
    tr.insertAdjacentElement('afterbegin', head);

    // Visible checkbox proxy
    bindCardCheckboxInteractions(tr);

    // Details panel (lazy)
    const details = document.createElement('div');
    details.className = 'wl-details';
    tr.appendChild(details);

    head.querySelector('[data-act="toggle"]').addEventListener('click', async (e)=>{
      e.preventDefault();
      if (!details.dataset.loaded){
        details.dataset.loaded = '1';
        details.innerHTML = `<div style="color:#475569;">Loading…</div>`;
        try{
          let detailsUrl = href;
          if (detailsUrl === '#' || /#detailsAnchor/.test(detailsUrl)) {
            // Build CreditNoteDetails URL using the creditnoteid attribute on the first cell’s span (present in your markup)
            const idSpan = tr.querySelector('td:first-child span[creditnoteid]');
            const cid = idSpan?.getAttribute('creditnoteid');
            if (cid) detailsUrl = abs(`CreditNoteDetails_r.aspx?id=${encodeURIComponent(cid)}`);
          }
          if (!detailsUrl || detailsUrl === '#') throw new Error('No details URL');

          const html = await fetch(detailsUrl, { credentials:'same-origin' }).then(r=>r.text());
          const doc  = new DOMParser().parseFromString(html, 'text/html');
          const table = doc.querySelector('#ctl00_PageBody_ctl02_CreditNoteDetailsGrid_ctl00, .rgMasterTable');

          if (table){
            const items = [];
            table.querySelectorAll('tbody > tr').forEach(tr2=>{
              const code = (tr2.querySelector('td[data-title="Product Code"]')||{}).textContent||'';
              const desc = (tr2.querySelector('td[data-title="Description"]')||{}).textContent||'';
              const qty  = (tr2.querySelector('td[data-title="Qty"]')||{}).textContent||'';
              const tot  = (tr2.querySelector('td[data-title="Total"]')||{}).textContent||'';
              if ((code+desc).trim()) items.push({code:code.trim(),desc:desc.trim(),qty:qty.trim(),tot:tot.trim()});
            });
            details.innerHTML = items.slice(0,8).map(l=>`
              <div style="display:flex;gap:12px;justify-content:space-between;border:1px solid #eef0f3;border-radius:12px;padding:10px;">
                <div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:800;min-width:86px">${l.code||'-'}</div>
                <div style="flex:1;min-width:160px">${l.desc||''}</div>
                <div style="white-space:nowrap;font-weight:700">${l.qty?`Qty: ${l.qty}`:''}${l.tot?` · ${l.tot}`:''}</div>
              </div>
            `).join('') || `<div style="color:#475569;">No line items found.</div>`;
          } else {
            details.innerHTML = `<div style="color:#475569;">Couldn’t read details. ${detailsUrl?`<a href="${detailsUrl}">Open details page</a>.`:``}</div>`;
          }
        }catch(e){
          details.innerHTML = `<div style="color:#7f1d1d;background:#fee2e2;border:1px solid #fecaca;border-radius:10px;padding:10px;">
            Sorry, we couldn’t load details.${href && href!=='#' ? ` You can still <a href="${href}">open the credit note</a>.` : ``}
          </div>`;
        }
      }
      details.classList.toggle('show');
      e.currentTarget.textContent = details.classList.contains('show') ? 'Hide details' : 'View details';
    });

    tr.__wlCard = true;
  }

  function cardify(master){
    const host = master.closest('#ctl00_PageBody_CreditNotesGrid, .RadGrid[id*="CreditNotesGrid"]');
    if (!host) return;
    master.classList.add('wl-crn-cardify');
    const rows = Array.from(master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
    rows.forEach(tr=>{ try{ buildCardForRow(tr); }catch(e){ log.warn('Cardify row fail', e); } });
    syncAllCardChecks(master);
  }

  /* ---------- toolbar + filters ---------- */
  function ensureToolbar(){
    const grid = document.getElementById('ctl00_PageBody_CreditNotesGrid');
    const flex = grid?.closest('.bodyFlexItem') || grid;
    if (!flex) return null;
    if (flex.querySelector('.wl-toolbar')) return flex.querySelector('.wl-toolbar');

    const bar = document.createElement('div');
    bar.className = 'wl-toolbar';
    bar.innerHTML = `
  <button type="button" class="wl-chipbtn" data-filter="all" data-active="true">All</button>
  <button type="button" class="wl-chipbtn" data-filter="gte500">≥ $500</button>
  <button type="button" class="wl-chipbtn" data-filter="lt500">&lt; $500</button>
  <div class="wl-spacer"></div>
  <button type="button" class="wl-act" data-action="select-filtered">Select filtered</button>
  <button type="button" class="wl-act" data-action="print-selected" title="Print Selected">Print selected</button>
  <button type="button" class="wl-act" data-action="export-selected" title="Export Selected to QuickBooks">Export selected</button>
`;
    flex.insertBefore(bar, flex.firstChild);

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
        } else if (act.dataset.action==='print-selected'){
          // Use existing global hook if present; else click the native link
          if (typeof window.printSelectedClicked === 'function') window.printSelectedClicked();
          else document.getElementById('ctl00_PageBody_lnkPrintSelected')?.click();
        } else if (act.dataset.action==='export-selected'){
          if (typeof window.exportSelectedClicked === 'function') window.exportSelectedClicked();
          else document.getElementById('ctl00_PageBody_lnkExportSelected')?.click();
        }
      }
    });

    return bar;
  }

  function applyFilter(filter){
    const master = document.querySelector('#ctl00_PageBody_CreditNotesGrid .rgMasterTable'); if (!master) return;
    const rows = master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow');
    rows.forEach(tr=>{
      const total = Number(tr.dataset.total || '0');
      let show = true;
      if (filter === 'gte500') show = total >= 500;
      else if (filter === 'lt500') show = total > 0 && total < 500;
      // 'all' shows everything
      tr.style.display = show ? '' : 'none';
    });
  }

  function selectFilteredOnPage(){
    const root = document.getElementById('ctl00_PageBody_CreditNotesGrid'); if (!root) return;
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

  function findCreditNumber(tr){
    const a = findCreditAnchor(tr);
    return a ? (a.textContent||'').trim() : '';
  }
  function computeGridKey(master){
    const rows = master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow');
    const n = rows.length || 0;
    const firstNo = n ? findCreditNumber(rows[0]) : '';
    const lastNo  = n ? findCreditNumber(rows[n-1]) : '';
    return `${n}:${firstNo}-${lastNo}`;
  }
  async function enhanceOnce(master, reason){
    if (!master) return;
    const key = computeGridKey(master);
    if (key === lastKey && runsForKey >= MAX_RUNS_PER_KEY){ log.info('Enhance skipped', {key, reason}); return; }
    if (key !== lastKey){ lastKey = key; runsForKey = 0; }
    runsForKey++;
    cardify(master);
    syncAllCardChecks(master);
  }
  function attachGridObserver(){
    const gridRoot = document.getElementById('ctl00_PageBody_CreditNotesGrid'); if (!gridRoot) return;
    if (observer) return;

    observer = new MutationObserver(()=>{
      if (observeSuspended) return;
      if (debounceId) clearTimeout(debounceId);
      debounceId = setTimeout(async ()=>{
        const master = gridRoot.querySelector('#ctl00_PageBody_CreditNotesGrid_ctl00') || gridRoot.querySelector('.rgMasterTable');
        if (master) await enhanceOnce(master, 'mutation');
      }, 120);
    });
    observer.observe(gridRoot, { childList:true, subtree:true });
  }

  /* ---------- Keep Select-All in sync with our card checks ---------- */
  function hookSelectAllSync(){
    const headCb = document.querySelector('#ctl00_PageBody_CreditNotesGrid thead input[type="checkbox"], .RadGrid[id*="CreditNotesGrid"] thead input[type="checkbox"]');
    if (!headCb || headCb.__wlHeadBound) return;
    headCb.addEventListener('change', ()=>{
      const master = document.querySelector('#ctl00_PageBody_CreditNotesGrid_ctl00, #ctl00_PageBody_CreditNotesGrid .rgMasterTable, .RadGrid[id*="CreditNotesGrid"] .rgMasterTable');
      if (master) syncAllCardChecks(master);
    });
    headCb.__wlHeadBound = true;
  }

  /* ---------- MS AJAX hooks ---------- */
  function attachAjaxHooks(){
    try{
      if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager){
        const prm = Sys.WebForms.PageRequestManager.getInstance();
        prm.add_initializeRequest(()=>{ observeSuspended = true; });
        prm.add_endRequest(()=> {
          observeSuspended = false; lastKey = ''; runsForKey = 0;
          const master = document.querySelector('#ctl00_PageBody_CreditNotesGrid_ctl00, #ctl00_PageBody_CreditNotesGrid .rgMasterTable, .RadGrid[id*="CreditNotesGrid"] .rgMasterTable');
          if (master) enhanceOnce(master, 'ajax-endRequest');
          hookSelectAllSync();
        });
      }
    }catch{}
  }

  /* ---------- boot ---------- */
  async function boot(){
    const master = await getMasterTable(); if (!master) return;
    ensureToolbar();
    await enhanceOnce(master, 'boot');
    attachAjaxHooks();
    attachGridObserver();
    hookSelectAllSync();
    log.info('Boot complete', { rows: master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow').length, version: VERSION });
  }

  if (document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', boot, { once:true }); }
  else { boot(); }

  /* ---------- minimal debug ---------- */
  window.WLCreditNotes = {
    version: VERSION,
    sync(){
      const master = document.querySelector('#ctl00_PageBody_CreditNotesGrid_ctl00, #ctl00_PageBody_CreditNotesGrid .rgMasterTable, .RadGrid[id*="CreditNotesGrid"] .rgMasterTable');
      if (master) syncAllCardChecks(master);
    }
  };
})();

