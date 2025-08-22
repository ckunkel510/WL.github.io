
/* =========================================================================
   Woodson — Statements Card UI (v1.0)
   - Applies to Statements_R.aspx
   - Card UI: "Statement for <Month YYYY>", Due (always 10th next month), Closing Balance
   - Adds "Pay statement" to the most recent statement (and a top sticky button)
   - Keeps your existing behavior of pushing the latest statement total into
     AccountPayment_r.aspx via URL params.
   - Debounced observer; MS AJAX-aware
   ========================================================================== */

(function(){
  'use strict';
  if (!/Statements_R\.aspx/i.test(location.pathname)) return;
  if (window.__WL_STATEMENTS_BOOTED__) return;
  window.__WL_STATEMENTS_BOOTED__ = true;

  /* ---------- logger ---------- */
  const LVL={error:0,warn:1,info:2,debug:3}; let LOG=LVL.info;
  const log={info:(...a)=>{if(LOG>=LVL.info)console.log('[STM]',...a);}};

  const VERSION='1.0';
  log.info('Version', VERSION, 'booting…');

  /* ---------- CSS ---------- */
  (function injectCSS(){
    const css = `
      /* Hide grid headers (we render card headers) */
      #ctl00_PageBody_StatementsDataGrid thead th { display:none !important; }

      /* Card rows */
      .wl-stm-cardify tr.rgRow, .wl-stm-cardify tr.rgAltRow{
        display:block; background:#fff; border:1px solid #e5e7eb; border-radius:16px;
        margin:12px 0; box-shadow:0 6px 18px rgba(15,23,42,.06); overflow:hidden; position:relative;
      }
      .wl-stm-cardify tr.rgRow > td, .wl-stm-cardify tr.rgAltRow > td{ display:none !important; }

      .wl-row-head{
        display:grid; gap:8px; padding:14px; align-items:center;
        grid-template-columns: 1fr auto;
      }
      .wl-head-left{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
      .wl-head-right{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:flex-end; }

      .wl-title{ font-weight:900; font-size:18px; letter-spacing:.2px; }
      @media (min-width:1024px){ .wl-title{ font-size:20px; } }

      .wl-chip{ display:inline-flex; align-items:center; gap:6px; font-weight:800; border-radius:999px; padding:6px 10px; font-size:12px; }
      .wl-chip--slate{ background:#e2e8f0; color:#0f172a; }
      .wl-chip--green{ background:#dcfce7; color:#065f46; }

      .wl-meta{ display:flex; gap:12px; flex-wrap:wrap; font-size:12px; color:#475569; }
      .wl-meta span{ white-space:nowrap; }

      .wl-btn{ appearance:none; border:none; border-radius:12px; font-weight:900; padding:10px 14px; text-decoration:none; cursor:pointer; }
      .wl-btn--primary{ background:#6b0016; color:#fff; }
      .wl-btn--ghost{ background:#f8fafc; color:#111827; border:1px solid #e5e7eb; }

      .wl-stm-paybar{
        position:sticky; top:0; z-index:40; background:#fff; border:1px solid #e5e7eb;
        border-radius:12px; padding:10px 12px; margin:8px 0; display:flex; align-items:center; gap:10px;
        box-shadow:0 6px 18px rgba(15,23,42,.06);
      }
      .wl-spacer{ flex:1 1 auto; }
    `;
    const el=document.createElement('style'); el.textContent=css; document.head.appendChild(el);
  })();

  /* ---------- utils ---------- */
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  async function waitFor(sel,{root=document,tries=60,interval=120}={}){ for(let i=0;i<tries;i++){const el=root.querySelector(sel); if(el) return el; await sleep(interval);} return null; }
  const txt=(el)=> (el?.textContent||'').trim();
  const parseMoney=(s)=>{ const v=parseFloat(String(s||'').replace(/[^0-9.\-]/g,'')||'0'); return Number.isFinite(v)?v:0; };
  const toUSD=(n)=> Number(n).toLocaleString(undefined,{style:'currency',currency:'USD'});
  const abs=(u)=>{ try{ return new URL(u,location.origin).toString(); }catch{ return u; } };
  const fmtDate=(d)=> d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
  const monthLabel=(d)=> d.toLocaleDateString(undefined,{year:'numeric',month:'long'});

  // Due date = 10th of next month (from "Generated DateTime")
  function computeDueDate(genDate){
    const y = genDate.getFullYear(), m = genDate.getMonth(); // 0-based
    const next = new Date(y, m+1, 10);
    next.setHours(0,0,0,0);
    return next;
  }

  /* ---------- grid helpers ---------- */
  async function getMasterTable(){
    const root=await waitFor('#ctl00_PageBody_StatementsDataGrid'); if(!root) return null;
    return root.querySelector('#ctl00_PageBody_StatementsDataGrid_ctl00') || root.querySelector('.rgMasterTable');
  }

  function parseRowData(tr){
    const stmtNo = txt(tr.querySelector('td[data-title="Statement Number"] a'));
    const a = tr.querySelector('td[data-title="Statement Number"] a');
    const hrefRaw = a ? a.getAttribute('href')||'' : '';
    const href = abs(hrefRaw);
    const oidMatch = hrefRaw.match(/[?&]oid=(\d+)/i);
    const oid = oidMatch ? oidMatch[1] : null;

    const genRaw = txt(tr.querySelector('td[data-title="Generated DateTime"]'));
    const genDate = genRaw ? new Date(genRaw) : null;

    const closingTxt = txt(tr.querySelector('td[data-title="Closing Balance"]'));
    const closing = parseMoney(closingTxt);

    const due = genDate ? computeDueDate(genDate) : null;

    tr.dataset.stmtNo = stmtNo || '';
    tr.dataset.oid = oid || '';
    tr.dataset.closing = String(closing||0);
    tr.dataset.generatedISO = genDate ? genDate.toISOString() : '';
    tr.dataset.dueISO = due ? due.toISOString() : '';

    return { stmtNo, href, oid, genDate, closing, due };
  }

  function buildCard(tr){
    if (tr.__wlCard) return;
    const { stmtNo, href, oid, genDate, closing, due } = parseRowData(tr);

    const titleMonth = genDate ? monthLabel(genDate) : (stmtNo ? `Statement #${stmtNo}` : 'Statement');
    const head=document.createElement('div');
    head.className='wl-row-head';
    head.innerHTML = `
      <div class="wl-head-left">
        <span class="wl-title">Statement for ${titleMonth || '—'}</span>
        ${closing ? `<span class="wl-chip wl-chip--green">Closing · ${toUSD(closing)}</span>` : ``}
        ${due ? `<span class="wl-chip wl-chip--slate">Due · ${fmtDate(due)}</span>` : ``}
        <div class="wl-meta">
          ${genDate ? `<span>Generated: ${fmtDate(genDate)}</span>` : ``}
          ${stmtNo ? `<span>Internal #: ${stmtNo}</span>` : ``}
        </div>
      </div>
      <div class="wl-head-right">
        ${href ? `<a class="wl-btn wl-btn--ghost" href="${href}">Open</a>` : ``}
        <button class="wl-btn wl-btn--primary" type="button" data-act="pay" ${tr.dataset.isLatest==='1'?'':'data-latest="0"'}>Pay statement</button>
      </div>
    `;
    tr.insertAdjacentElement('afterbegin', head);

    // Wire the "Pay" button
    const payBtn = head.querySelector('[data-act="pay"]');
    payBtn?.addEventListener('click', (e)=>{
      e.preventDefault();
      const amt = Number(tr.dataset.closing||'0');
      // Build a link to AccountPayment with dual params (back-compat friendly):
      const u = new URL('/AccountPayment_r.aspx', location.origin);
      // Primary params (match invoices pattern you already use)
      u.searchParams.set('utm_statement', stmtNo || (genDate?`stmt_${genDate.toISOString().slice(0,10)}`:'latest'));
      u.searchParams.set('utm_total', (Math.round(amt*100)/100).toFixed(2));
      // Optional alternates if you already read different names on that page
      u.searchParams.set('stmt_total', (Math.round(amt*100)/100).toFixed(2));
      if (oid) u.searchParams.set('stmt_oid', oid);
      location.assign(u.toString());
    });

    tr.__wlCard = true;
  }

  function cardify(master){
    if (!master) return;
    master.classList.add('wl-stm-cardify');
    const rows = Array.from(master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
    rows.forEach(tr=>{ try{ buildCard(tr); }catch(e){ /*noop*/ } });
  }

  /* ---------- find latest + top sticky pay bar ---------- */
  function markLatest(master){
    const rows = Array.from(master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
    if (!rows.length) return null;
    let latest = null, latestTime = -Infinity;

    rows.forEach(tr=>{
      const dISO = tr.dataset.generatedISO || '';
      const t = dISO ? Date.parse(dISO) : NaN;
      if (!Number.isNaN(t) && t > latestTime){ latestTime = t; latest = tr; }
    });

    if (latest){
      rows.forEach(tr=> tr.dataset.isLatest = (tr===latest ? '1' : '0'));
    }
    return latest;
  }

  function ensurePayBar(latest){
    if (!latest) return;
    const host = document.getElementById('ctl00_PageBody_StatementsDataGrid')?.closest('.bodyFlexItem') || document.body;
    if (!host || host.querySelector('.wl-stm-paybar')) return;

    const amt = Number(latest.dataset.closing||'0');
    const gen = latest.dataset.generatedISO ? new Date(latest.dataset.generatedISO) : null;
    const due = latest.dataset.dueISO ? new Date(latest.dataset.dueISO) : null;
    const stmtNo = latest.dataset.stmtNo || '';

    const bar = document.createElement('div');
    bar.className = 'wl-stm-paybar';
    bar.innerHTML = `
      <div><strong>Latest statement</strong> ${gen?`· ${monthLabel(gen)}`:''}</div>
      <div class="wl-chip wl-chip--green">Closing · ${toUSD(amt)}</div>
      ${due?`<div class="wl-chip wl-chip--slate">Due · ${fmtDate(due)}</div>`:''}
      <div class="wl-spacer"></div>
      <button type="button" class="wl-btn wl-btn--primary" data-act="pay-latest">Pay statement</button>
    `;
    host.insertBefore(bar, host.firstChild);

    bar.querySelector('[data-act="pay-latest"]').addEventListener('click', ()=>{
      const u = new URL('/AccountPayment_r.aspx', location.origin);
      u.searchParams.set('utm_statement', stmtNo || (gen?`stmt_${gen.toISOString().slice(0,10)}`:'latest'));
      u.searchParams.set('utm_total', (Math.round(amt*100)/100).toFixed(2));
      u.searchParams.set('stmt_total', (Math.round(amt*100)/100).toFixed(2));
      const oid = latest.dataset.oid; if (oid) u.searchParams.set('stmt_oid', oid);
      location.assign(u.toString());
    });
  }

  /* ---------- observer (debounced) & MS AJAX hooks ---------- */
  let observer, debounceId = null;
  function attachObserver(){
    const gridRoot=document.getElementById('ctl00_PageBody_StatementsDataGrid'); if(!gridRoot) return;
    if (observer) return;
    observer=new MutationObserver(()=>{
      if (debounceId) clearTimeout(debounceId);
      debounceId=setTimeout(async ()=>{
        const master = gridRoot.querySelector('#ctl00_PageBody_StatementsDataGrid_ctl00') || gridRoot.querySelector('.rgMasterTable');
        if (!master) return;
        cardify(master);
        const latest = markLatest(master);
        ensurePayBar(latest);
      }, 120);
    });
    observer.observe(gridRoot, { childList:true, subtree:true });
  }

  function attachAjaxHooks(){
    try{
      if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager){
        const prm = Sys.WebForms.PageRequestManager.getInstance();
        prm.add_endRequest(()=>{
          const master = document.querySelector('#ctl00_PageBody_StatementsDataGrid_ctl00, #ctl00_PageBody_StatementsDataGrid .rgMasterTable');
          if (!master) return;
          cardify(master);
          const latest = markLatest(master);
          ensurePayBar(latest);
        });
      }
    }catch{}
  }

  /* ---------- boot ---------- */
  async function boot(){
    const master = await getMasterTable(); if (!master) return;
    cardify(master);
    const latest = markLatest(master);
    ensurePayBar(latest);
    attachObserver();
    attachAjaxHooks();
    log.info('Boot complete', { rows: document.querySelectorAll('#ctl00_PageBody_StatementsDataGrid .rgMasterTable tbody > tr').length, version: VERSION });
  }
  if (document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', boot, { once:true }); }
  else { boot(); }

  /* ---------- export minimal helpers ---------- */
  window.WLStatements = {
    version: VERSION,
    payLatest(){
      const master = document.querySelector('#ctl00_PageBody_StatementsDataGrid_ctl00, #ctl00_PageBody_StatementsDataGrid .rgMasterTable');
      const latest = master ? markLatest(master) : null;
      const btn = document.querySelector('.wl-stm-paybar [data-act="pay-latest"]');
      if (btn) btn.click();
    }
  };
})();

