
/* =========================================================================
   Woodson — Statements Card UI (v1.3)
   - Cards for each statement
   - ONLY latest has "Pay statement"
   - "Open" uses GetStatementLink behavior
   - Hides the left RadMenu sidebar
   - Adds "← Back to My Account" button above the page
   ========================================================================== */
(function(){
  'use strict';
  if (!/Statements_R\.aspx/i.test(location.pathname)) return;
  if (window.__WL_STATEMENTS_BOOTED__) return; 
  window.__WL_STATEMENTS_BOOTED__ = true;

  const log={info:(...a)=>console.log('[STM]',...a)};
  const VERSION='1.3'; log.info('Version',VERSION,'booting…');

  /* ---------- CSS ---------- */
  (function injectCSS(){
    const css=`
      #ctl00_PageBody_StatementsDataGrid thead th { display:none !important; }
      .wl-stm-cardify tr.rgRow,.wl-stm-cardify tr.rgAltRow{
        display:block;background:#fff;border:1px solid #e5e7eb;border-radius:16px;
        margin:12px 0;box-shadow:0 6px 18px rgba(15,23,42,.06);overflow:hidden;
      }
      .wl-stm-cardify tr.rgRow>td,.wl-stm-cardify tr.rgAltRow>td{display:none!important;}
      .wl-row-head{display:grid;gap:8px;padding:14px;align-items:center;grid-template-columns:1fr auto;}
      .wl-head-left{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
      .wl-head-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;}
      .wl-title{font-weight:900;font-size:18px;}
      @media(min-width:1024px){.wl-title{font-size:20px;}}
      .wl-chip{display:inline-flex;align-items:center;gap:6px;font-weight:800;border-radius:999px;padding:6px 10px;font-size:12px;}
      .wl-chip--slate{background:#e2e8f0;color:#0f172a;}
      .wl-chip--green{background:#dcfce7;color:#065f46;}
      .wl-meta{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:#475569;}
      .wl-meta span{white-space:nowrap;}
      .wl-btn{appearance:none;border:none;border-radius:12px;font-weight:900;padding:10px 14px;text-decoration:none;cursor:pointer;}
      .wl-btn--primary{background:#6b0016;color:#fff;}
      .wl-btn--ghost{background:#f8fafc;color:#111827;border:1px solid #e5e7eb;}
      /* Hide sidebar menu */
      #ctl00_LeftSidebarContents_Navigation_NavigationMenu { display:none !important; }
      /* Back button styling */
      .wl-backbar{margin:10px 0;}
      .wl-backbtn{display:inline-block;background:#f8fafc;border:1px solid #e5e7eb;
        color:#111827;border-radius:12px;font-weight:700;padding:8px 14px;
        text-decoration:none;cursor:pointer;}
      .wl-backbtn:hover{background:#e5e7eb;}
    `;
    const el=document.createElement('style'); el.textContent=css; document.head.appendChild(el);
  })();

  /* ---------- utils ---------- */
  const txt=(el)=> (el?.textContent||'').trim();
  const parseMoney=(s)=>{const v=parseFloat(String(s||'').replace(/[^0-9.\-]/g,'')||'0');return Number.isFinite(v)?v:0;};
  const toUSD=(n)=>Number(n).toLocaleString(undefined,{style:'currency',currency:'USD'});
  const fmtDate=(d)=>d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
  const monthLabel=(d)=>d.toLocaleDateString(undefined,{year:'numeric',month:'long'});
  function computeDueDate(genDate){const y=genDate.getFullYear(),m=genDate.getMonth();return new Date(y,m+1,10);}
  function buildStatementDocUrl(oid){
    if(!oid) return null;
    const base=new URL('/ProcessDocument.aspx',location.origin);
    base.searchParams.set('documentId',oid);
    base.searchParams.set('documentType','2');
    base.searchParams.set('processDocument','1');
    base.searchParams.set('IsSummaryStatement','0');
    const chk=document.getElementById('IncludePaidTransactions');
    if(chk&&chk.checked) base.searchParams.set('includePaidTransactions','1');
    return base.toString();
  }

  /* ---------- grid helpers ---------- */
  function parseRowData(tr){
    const a=tr.querySelector('td[data-title="Statement Number"] a');
    const hrefRaw=a?.getAttribute('href')||'';
    const oidMatch=hrefRaw.match(/[?&]oid=(\d+)/i);
    const oid=oidMatch?oidMatch[1]:null;
    const stmtNo=txt(a);
    const genRaw=txt(tr.querySelector('td[data-title="Generated DateTime"]'));
    const genDate=genRaw?new Date(genRaw):null;
    const closing=parseMoney(txt(tr.querySelector('td[data-title="Closing Balance"]')));
    const due=genDate?computeDueDate(genDate):null;
    tr.dataset.oid=oid||''; tr.dataset.stmtNo=stmtNo||''; tr.dataset.generatedISO=genDate?genDate.toISOString():'';
    tr.dataset.closing=String(closing||0); tr.dataset.dueISO=due?due.toISOString():'';
    return {stmtNo,oid,genDate,closing,due};
  }
  function buildCard(tr){
    if(tr.__wlCard) return;
    const {stmtNo,oid,genDate,closing,due}=parseRowData(tr);
    const head=document.createElement('div');
    head.className='wl-row-head';
    head.innerHTML=`
      <div class="wl-head-left">
        <span class="wl-title">Statement for ${genDate?monthLabel(genDate):stmtNo}</span>
        ${closing?`<span class="wl-chip wl-chip--green">Closing · ${toUSD(closing)}</span>`:''}
        ${due?`<span class="wl-chip wl-chip--slate">Due · ${fmtDate(due)}</span>`:''}
        <div class="wl-meta">
          ${genDate?`<span>Generated: ${fmtDate(genDate)}</span>`:''}
        </div>
      </div>
      <div class="wl-head-right">
        <button class="wl-btn wl-btn--ghost" type="button" data-act="open">Open</button>
        <button class="wl-btn wl-btn--primary" type="button" data-act="pay" style="display:none;">Pay statement</button>
      </div>`;
    tr.insertAdjacentElement('afterbegin',head);
    head.querySelector('[data-act="open"]').addEventListener('click',e=>{
      e.preventDefault();const url=buildStatementDocUrl(oid);if(url) window.open(url);
    });
    head.querySelector('[data-act="pay"]').addEventListener('click',e=>{
      e.preventDefault();const amt=Number(tr.dataset.closing||'0');const u=new URL('/AccountPayment_r.aspx',location.origin);
      u.searchParams.set('utm_statement',stmtNo||'latest');
      u.searchParams.set('utm_total',amt.toFixed(2));
      u.searchParams.set('stmt_total',amt.toFixed(2));
      if(oid) u.searchParams.set('stmt_oid',oid);
      location.assign(u.toString());
    });
    tr.__wlCard=true;
  }
  function cardify(master){
    master.classList.add('wl-stm-cardify');
    master.querySelectorAll('tbody > tr').forEach(tr=>{try{buildCard(tr);}catch{}});
  }
  function markLatest(master){
    const rows=[...master.querySelectorAll('tbody > tr')];
    if(!rows.length) return null;
    let latest=null,latestTime=-Infinity;
    rows.forEach(tr=>{const t=tr.dataset.generatedISO?Date.parse(tr.dataset.generatedISO):NaN;if(!isNaN(t)&&t>latestTime){latestTime=t;latest=tr;}});
    rows.forEach(tr=>{const btn=tr.querySelector('[data-act="pay"]');if(btn) btn.style.display=(tr===latest)?'':'none';});
    return latest;
  }

  /* ---------- Add Back to My Account ---------- */
  function ensureBackButton(){
    const grid=document.getElementById('ctl00_PageBody_StatementsDataGrid');
    if(!grid) return;
    const container=grid.closest('.bodyFlexItem')||document.body;
    if(container.querySelector('.wl-backbar')) return;
    const bar=document.createElement('div');
    bar.className='wl-backbar';
    bar.innerHTML=`<a href="AccountInfo_R.aspx" class="wl-backbtn">← Back to My Account</a>`;
    container.insertBefore(bar,container.firstChild);
  }

  /* ---------- observer ---------- */
  function enhance(){
    const master=document.querySelector('#ctl00_PageBody_StatementsDataGrid_ctl00, #ctl00_PageBody_StatementsDataGrid .rgMasterTable');
    if(!master) return;
    cardify(master);
    markLatest(master);
    ensureBackButton();
  }
  new MutationObserver(()=>setTimeout(enhance,120)).observe(document.getElementById('ctl00_PageBody_StatementsDataGrid'),{childList:true,subtree:true});
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',enhance,{once:true});}else enhance();

})();

