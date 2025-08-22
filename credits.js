
/* =========================================================================
   Woodson — Credit Notes Card UI (v1.1)
   - Adds AP crawl (AccountPayment_r.aspx) to show Taken / Partial / Open
   - Card UI, visible proxy checkbox, toolbar (size filters + actions)
   - Debounced observer; MS AJAX-aware; cached AP index (10 min, sessionStorage)
   ========================================================================== */
(function(){
  'use strict';
  if (!/CreditNotes_r\.aspx/i.test(location.pathname)) return;
  if (window.__WL_CREDITS_BOOTED__) return; window.__WL_CREDITS_BOOTED__ = true;

  /* ---------- logger ---------- */
  const LVL={error:0,warn:1,info:2,debug:3}; let LOG=LVL.info;
  const log={info:(...a)=>{if(LOG>=LVL.info)console.log('[CRN]',...a);},warn:(...a)=>{if(LOG>=LVL.warn)console.warn('[CRN]',...a);},debug:(...a)=>{if(LOG>=LVL.debug)console.log('[CRN]',...a);} };
  const VERSION='1.1'; log.info('Version',VERSION,'booting…');

  /* ---------- CSS (same as v1.0; keeps chips; badge colors reused) ---------- */
  (function injectCSS(){
    const css = `
      #ctl00_PageBody_CreditNotesGrid thead th:not(:first-child),
      .RadGrid[id*="CreditNotesGrid"] thead th:not(:first-child){display:none!important;}
      .wl-crn-cardify tr.rgRow,.wl-crn-cardify tr.rgAltRow{display:block;background:#fff;border:1px solid #e5e7eb;border-radius:16px;margin:12px 0;box-shadow:0 6px 18px rgba(15,23,42,.06);overflow:hidden;position:relative;}
      .wl-crn-cardify tr.rgRow>td,.wl-crn-cardify tr.rgAltRow>td{display:none!important;}
      .wl-crn-cardify tr.rgRow>td:first-child,.wl-crn-cardify tr.rgAltRow>td:first-child{display:block!important;position:absolute;left:0;top:0;border:none!important;background:transparent;padding:0;margin:0;width:1px!important;min-width:1px!important;height:1px;z-index:1;overflow:hidden;}
      .wl-hide-native{position:absolute!important;left:-9999px!important;top:auto!important;width:1px!important;height:1px!important;overflow:hidden!important;opacity:0!important;pointer-events:none!important;}
      .wl-row-head{display:grid;gap:8px;padding:14px 14px 12px 46px;align-items:center;grid-template-columns:1fr auto;}
      .wl-head-left{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
      .wl-head-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;}
      .wl-card-check{width:20px;height:20px;border:2px solid #cbd5e1;border-radius:4px;background:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:border-color .15s,background .15s,box-shadow .15s;}
      .wl-card-check:focus-visible{outline:0;box-shadow:0 0 0 3px #93c5fd;}
      .wl-card-check[data-checked=true]{border-color:#0ea5e9;background:#e0f2fe;}
      .wl-card-check svg{width:12px;height:12px;display:none;}
      .wl-card-check[data-checked=true] svg{display:block;}
      .wl-crn-no{font-weight:900;font-size:16px;letter-spacing:.2px;} @media(min-width:1024px){.wl-crn-no{font-size:18px;}}
      .wl-chip{display:inline-flex;align-items:center;gap:6px;font-weight:800;border-radius:999px;padding:6px 10px;font-size:12px;}
      .wl-chip--slate{background:#e2e8f0;color:#0f172a;}
      .wl-chip--green{background:#dcfce7;color:#065f46;}
      .wl-chip--amber{background:#fef3c7;color:#92400e;}
      .wl-chip--red{background:#fee2e2;color:#7f1d1d;}
      .wl-meta{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:#475569;}
      .wl-meta span{white-space:nowrap;}
      .wl-btn{appearance:none;border:none;border-radius:12px;font-weight:900;padding:10px 14px;text-decoration:none;cursor:pointer;}
      .wl-btn--primary{background:#6b0016;color:#fff;}
      .wl-btn--ghost{background:#f8fafc;color:#111827;border:1px solid #e5e7eb;}
      .wl-details{display:none;border-top:1px solid #eef0f3;padding:12px 14px 14px 46px;}
      .wl-details.show{display:block;}
      .wl-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:8px 0 10px;}
      .wl-chipbtn{border:1px solid #e5e7eb;border-radius:999px;padding:6px 10px;font-weight:700;background:#fff;color:#0f172a;font-size:12px;cursor:pointer;user-select:none;}
      .wl-chipbtn[data-active=true]{border-color:#0ea5e9;background:#e0f2fe;color:#075985;}
      .wl-spacer{flex:1 1 auto;}
      .wl-act{border:1px solid #e5e7eb;border-radius:10px;padding:6px 10px;font-weight:700;background:#f8fafc;font-size:12px;cursor:pointer;}
    `;
    const el=document.createElement('style'); el.textContent=css; document.head.appendChild(el);
  })();

  /* ---------- utils ---------- */
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  const txt=(el)=> (el?.textContent||'').trim();
  const parseMoney=(s)=>{ const v=parseFloat(String(s||'').replace(/[^0-9.\-]/g,'')||'0'); return Number.isFinite(v)?v:0; };
  const toUSD=(n)=> Number(n).toLocaleString(undefined,{style:'currency',currency:'USD'});
  const nearlyZero=(n)=> Math.abs(n)<0.009;
  async function waitFor(sel,{root=document,tries=60,interval=120}={}){ for(let i=0;i<tries;i++){const el=root.querySelector(sel); if(el) return el; await sleep(interval);} return null; }
  const grab=(tr,sel)=>{ const el=tr.querySelector(sel); return el?el.textContent.trim():''; };
  const abs=(u)=>{ try{ return new URL(u,location.origin).toString(); }catch{ return u; } };

  /* ---------- date range (uses Credit Notes pickers) ---------- */
  function readCreditDateRange(){
    const getState=(id)=>{ const inp=document.getElementById(id); if(!inp) return null; try{ return JSON.parse(inp.value.replace(/&quot;/g,'"')); }catch{ return null; } };
    const startState=getState('ctl00_PageBody_dtStart_RadDatePicker1_dateInput_ClientState');
    const endState  =getState('ctl00_PageBody_dtEnd_RadDatePicker1_dateInput_ClientState');
    const toISO=(state, fallbackId)=>{
      if(state?.valueAsString){ const m=state.valueAsString.match(/^(\d{4}-\d{2}-\d{2})-/); if(m) return m[1]; }
      const vis=document.getElementById(fallbackId);
      if(vis && vis.value){ const d=new Date(vis.value); if(!isNaN(d)) return d.toISOString().slice(0,10); }
      return null;
    };
    const startISO=toISO(startState,'ctl00_PageBody_dtStart_RadDatePicker1_dateInput');
    const endISO  =toISO(endState,  'ctl00_PageBody_dtEnd_RadDatePicker1_dateInput');
    return { startISO, endISO };
  }

  /* ---------- AP crawl & cache (Credit Notes) ---------- */
  function apCacheKey(startISO,endISO){ return `wl_ap_index_v3_cr_${startISO||'na'}_${endISO||'na'}`; }
  async function buildApIndex(startISO,endISO){
    const key=apCacheKey(startISO,endISO);
    try{
      const raw=sessionStorage.getItem(key);
      if(raw){ const {at,data}=JSON.parse(raw); if(Date.now()-at<10*60*1000) return new Map(data); }
    }catch{}

    const base=new URL('/AccountPayment_r.aspx', location.origin);
    base.searchParams.set('searchType','TransactionDate');
    if(startISO) base.searchParams.set('startDate',`${startISO}T00:00:00`);
    if(endISO)   base.searchParams.set('endDate',  `${endISO}T23:59:59`);

    const parser=new DOMParser();
    const fetchText=(url)=> fetch(url,{credentials:'same-origin',cache:'no-cache'}).then(r=>r.text());
    const normalizePager=(href)=>{
      const u=new URL(href, base.toString());
      if(startISO && !u.searchParams.get('startDate')) u.searchParams.set('startDate',`${startISO}T00:00:00`);
      if(endISO   && !u.searchParams.get('endDate'))   u.searchParams.set('endDate',  `${endISO}T23:59:59`);
      if(!u.searchParams.get('searchType')) u.searchParams.set('searchType','TransactionDate');
      u.pathname='/AccountPayment_r.aspx';
      return u.toString();
    };

    const index=new Map(); // Map<CreditNoteNumber, { outstanding:number }>
    const parseRows=(doc)=>{
      const host=doc.querySelector('#ctl00_PageBody_InvoicesGrid') || doc; // AP page sometimes reuses id
      const tbl =host.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || host.querySelector('.rgMasterTable');
      if(!tbl) return;
      const rows=tbl.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow');
      rows.forEach(tr=>{
        const type = txt(tr.querySelector('td[data-title="Type"]')) || txt(tr.children[1]);
        let docNo  = txt(tr.querySelector('span[id*="_DocumentNumber"]')) ||
                     txt(tr.querySelector('td[data-title="Doc. #"] span')) ||
                     txt(tr.querySelector('td[data-title="Document #"] span')) ||
                     txt(tr.querySelector('td[data-title="Doc #"] span'));
        const outTxt = txt(tr.querySelector('td[data-title="Amount Outstanding"]')) || txt(tr.children[8]);
        let outVal = parseMoney(outTxt);

        // Credit notes may show as negative amounts; normalize to positive
        if (outVal < 0) outVal = Math.abs(outVal);

        const t = (type||'').toLowerCase();
        // Match anything that looks like a credit note
        const isCredit = /credit/.test(t) || /crn|c\/n/.test(t);
        if (docNo && isCredit){
          // Strip any leading "CR" or similar prefixes in AP to match the grid's pure number
          const clean = String(docNo).replace(/^\s*(CR|CRN|CN)\s*/i,'').trim();
          index.set(clean, { outstanding: outVal });
        }
      });
    };

    try{
      const firstHTML=await fetchText(base.toString());
      const firstDoc =parser.parseFromString(firstHTML,'text/html');
      parseRows(firstDoc);

      const pagerHrefs = Array.from(new Set(
        [base.toString()].concat(
          Array.from(firstDoc.querySelectorAll('ul.pagination a.page-link[href]'))
            .map(a=>a.getAttribute('href'))
            .filter(h=>/pageIndex=\d+/.test(h||''))
            .map(normalizePager)
        )
      )).filter(u=>u!==base.toString());

      if(pagerHrefs.length){
        const results=await Promise.allSettled(pagerHrefs.map(h=>fetchText(h)));
        results.forEach(r=>{
          if(r.status==='fulfilled'){
            parseRows(parser.parseFromString(r.value,'text/html'));
          }
        });
      }
    }catch(e){ log.warn('AP crawl failed', e); }

    try{ sessionStorage.setItem(key, JSON.stringify({at:Date.now(), data:Array.from(index.entries())})); }catch{}
    return index;
  }
  let __AP_PROMISE__=null;
  async function ensureApIndex(){
    const {startISO,endISO}=readCreditDateRange();
    if(!__AP_PROMISE__) __AP_PROMISE__ = buildApIndex(startISO,endISO);
    return __AP_PROMISE__;
  }

  /* ---------- grid helpers ---------- */
  async function getMasterTable(){
    const root=await waitFor('#ctl00_PageBody_CreditNotesGrid'); if(!root) return null;
    return root.querySelector('#ctl00_PageBody_CreditNotesGrid_ctl00') || root.querySelector('.rgMasterTable');
  }
  function findCreditAnchor(tr){
    return tr.querySelector('td[data-title="Credit Note #"] a[href*="CreditNoteDetails_r.aspx"], td[data-title="Credit Note #"] a[href*="/CreditNotes_r.aspx"]');
  }
  function findRealCheckbox(tr){
    return tr.querySelector('input[type="checkbox"][name*="chkSelect"]');
  }

  /* ---------- visible checkbox proxy ---------- */
  function ensureCardCheckbox(tr){
    const headLeft=tr.querySelector('.wl-row-head .wl-head-left');
    if(!headLeft) return null;
    let btn=headLeft.querySelector('.wl-card-check');
    if(!btn){
      btn=document.createElement('button');
      btn.type='button';
      btn.className='wl-card-check';
      btn.setAttribute('role','checkbox');
      btn.setAttribute('aria-checked','false');
      btn.innerHTML=`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 11.2L3.3 8l1.4-1.4 1.8 1.8 4.8-4.8L12.7 5 6.5 11.2z"/></svg>`;
      headLeft.insertBefore(btn, headLeft.firstChild);
    }
    return btn;
  }
  function syncCardCheckboxFromReal(tr){
    const real=findRealCheckbox(tr); if(!real) return;
    const btn=ensureCardCheckbox(tr); if(!btn) return;
    real.classList.add('wl-hide-native');
    const checked=!!real.checked;
    btn.dataset.checked=checked?'true':'false';
    btn.setAttribute('aria-checked', checked?'true':'false');
    btn.disabled=!!real.disabled;
  }
  function bindCardCheckboxInteractions(tr){
    const real=findRealCheckbox(tr); if(!real) return;
    const btn=ensureCardCheckbox(tr); if(!btn) return;
    if(!btn.__wlBound){
      btn.addEventListener('click',(e)=>{ e.preventDefault(); e.stopPropagation(); real.click(); setTimeout(()=>syncCardCheckboxFromReal(tr),0); });
      btn.__wlBound=true;
    }
    if(!real.__wlBound){
      real.addEventListener('change',()=>syncCardCheckboxFromReal(tr));
      real.__wlBound=true;
    }
    syncCardCheckboxFromReal(tr);
  }
  function syncAllCardChecks(master){
    master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow').forEach(tr=> syncCardCheckboxFromReal(tr));
  }

  /* ---------- AP badge application ---------- */
  async function applyBadges(master){
    const rows = Array.from(master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
    if(!rows.length) return;
    const apIndex = await ensureApIndex().catch(()=>null);

    rows.forEach(tr=>{
      const a = findCreditAnchor(tr);
      const crNoRaw = a ? (a.textContent||'').trim() : '';
      const crNo = crNoRaw.replace(/^\s*(CR|CRN|CN)\s*/i,''); // align with AP index key

      // Defaults
      let status='unknown';
      let outLeft=0;

      if (crNo && apIndex){
        const info = apIndex.get(crNo);
        const total = parseMoney(grab(tr,'td[data-title="Total Amount"]')) || parseMoney(grab(tr,'td[data-title="Goods Total"]'));
        if (!info || nearlyZero(info.outstanding)){
          status = 'taken';
        } else {
          const out = Number(info.outstanding) || 0;
          if (Number.isFinite(total) && out < total - 0.009){ status='partial'; outLeft=out; }
          else { status='open'; outLeft=out; }
        }
      }

      tr.dataset.status = status;
      tr.dataset.outstanding = String(outLeft || 0);

      updateCardBadge(tr);
    });
  }

  function updateCardBadge(tr){
    const chip = tr.querySelector('.wl-card-badge'); if(!chip) return;
    const status = tr.dataset.status || 'unknown';
    const out = Number(tr.dataset.outstanding || 0);

    if (status==='taken'){ chip.className='wl-chip wl-chip--green wl-card-badge'; chip.textContent='Taken'; }
    else if (status==='partial'){ chip.className='wl-chip wl-chip--amber wl-card-badge'; chip.textContent=`Partial · ${toUSD(out)}`; }
    else if (status==='open'){ chip.className='wl-chip wl-chip--amber wl-card-badge'; chip.textContent=`Open · ${toUSD(out)}`; }
    else { chip.className='wl-chip wl-chip--slate wl-card-badge'; chip.textContent='Status N/A'; }
  }

  /* ---------- card rendering ---------- */
  function buildCardForRow(tr){
    if(tr.__wlCard) return;

    const a=findCreditAnchor(tr);
    const crNo=a?(a.textContent||'').trim():'';
    const href=a?abs(a.getAttribute('href')||'#'):'#';
    const yourRef=grab(tr,'td[data-title="Your Ref"]');
    const jobRef =grab(tr,'td[data-title="Job Ref"]');
    const crDate=grab(tr,'td[data-title="Credit Date"]');
    const goods =grab(tr,'td[data-title="Goods Total"]');
    const tax   =grab(tr,'td[data-title="Tax"]');
    const total =grab(tr,'td[data-title="Total Amount"]');
    const lines =grab(tr,'td[data-title="Lines"]');
    const branch=grab(tr,'td[data-title="Branch"]');

    tr.dataset.total = String(parseMoney(total || goods || '0'));
    tr.dataset.branch = branch || '';
    tr.dataset.crdate = crDate || '';

    if(a){ a.style.position='absolute'; a.style.width='1px'; a.style.height='1px'; a.style.overflow='hidden'; a.style.clip='rect(1px,1px,1px,1px)'; a.setAttribute('aria-hidden','true'); }

    const head=document.createElement('div');
    head.className='wl-row-head';
    head.innerHTML = `
      <div class="wl-head-left">
        <!-- checkbox injected here -->
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
        ${href!=='#'?`<a class="wl-btn wl-btn--ghost" href="${href}">Open</a>`:''}
        <button class="wl-btn wl-btn--primary" type="button" data-act="toggle">View details</button>
      </div>
    `;
    tr.insertAdjacentElement('afterbegin', head);

    bindCardCheckboxInteractions(tr);

    const details=document.createElement('div'); details.className='wl-details'; tr.appendChild(details);
    head.querySelector('[data-act="toggle"]').addEventListener('click', async (e)=>{
      e.preventDefault();
      if(!details.dataset.loaded){
        details.dataset.loaded='1';
        details.innerHTML=`<div style="color:#475569;">Loading…</div>`;
        try{
          let detailsUrl=href;
          if(detailsUrl==='#' || /#detailsAnchor/.test(detailsUrl)){
            const idSpan=tr.querySelector('td:first-child span[creditnoteid]');
            const cid=idSpan?.getAttribute('creditnoteid');
            if(cid) detailsUrl=abs(`CreditNoteDetails_r.aspx?id=${encodeURIComponent(cid)}`);
          }
          if(!detailsUrl || detailsUrl==='#') throw new Error('No details URL');
          const html=await fetch(detailsUrl,{credentials:'same-origin'}).then(r=>r.text());
          const doc=new DOMParser().parseFromString(html,'text/html');
          const table=doc.querySelector('#ctl00_PageBody_ctl02_CreditNoteDetailsGrid_ctl00, .rgMasterTable');

          if(table){
            const items=[];
            table.querySelectorAll('tbody > tr').forEach(tr2=>{
              const code=(tr2.querySelector('td[data-title="Product Code"]')||{}).textContent||'';
              const desc=(tr2.querySelector('td[data-title="Description"]')||{}).textContent||'';
              const qty =(tr2.querySelector('td[data-title="Qty"]')||{}).textContent||'';
              const tot =(tr2.querySelector('td[data-title="Total"]')||{}).textContent||'';
              if((code+desc).trim()) items.push({code:code.trim(),desc:desc.trim(),qty:qty.trim(),tot:tot.trim()});
            });
            details.innerHTML = items.slice(0,8).map(l=>`
              <div style="display:flex;gap:12px;justify-content:space-between;border:1px solid #eef0f3;border-radius:12px;padding:10px;">
                <div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:800;min-width:86px">${l.code||'-'}</div>
                <div style="flex:1;min-width:160px">${l.desc||''}</div>
                <div style="white-space:nowrap;font-weight:700">${l.qty?`Qty: ${l.qty}`:''}${l.tot?` · ${l.tot}`:''}</div>
              </div>
            `).join('') || `<div style="color:#475569;">No line items found.</div>`;
          } else {
            details.innerHTML = `<div style="color:#475569;">Couldn’t read details.${detailsUrl?` <a href="${detailsUrl}">Open details page</a>.`:``}</div>`;
          }
        }catch{
          details.innerHTML = `<div style="color:#7f1d1d;background:#fee2e2;border:1px solid #fecaca;border-radius:10px;padding:10px;">
            Sorry, we couldn’t load details.${href && href!=='#' ? ` You can still <a href="${href}">open the credit note</a>.` : ``}
          </div>`;
        }
      }
      details.classList.toggle('show');
      e.currentTarget.textContent = details.classList.contains('show') ? 'Hide details' : 'View details';
    });

    tr.__wlCard=true;
    updateCardBadge(tr);
  }

  function cardify(master){
    const host=master.closest('#ctl00_PageBody_CreditNotesGrid, .RadGrid[id*="CreditNotesGrid"]'); if(!host) return;
    master.classList.add('wl-crn-cardify');
    const rows=Array.from(master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
    rows.forEach(tr=>{ try{ buildCardForRow(tr); }catch(e){ log.warn('Cardify row fail',e); } });
    syncAllCardChecks(master);
  }

  /* ---------- toolbar ---------- */
  function ensureToolbar(){
    const grid=document.getElementById('ctl00_PageBody_CreditNotesGrid');
    const flex=grid?.closest('.bodyFlexItem')||grid;
    if(!flex) return null;
    if(flex.querySelector('.wl-toolbar')) return flex.querySelector('.wl-toolbar');

    const bar=document.createElement('div');
    bar.className='wl-toolbar';
    bar.innerHTML=`
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
      const chip=e.target.closest('.wl-chipbtn');
      const act =e.target.closest('.wl-act');
      if(chip){
        e.preventDefault(); e.stopPropagation();
        bar.querySelectorAll('.wl-chipbtn').forEach(b=>b.dataset.active='false');
        chip.dataset.active='true';
        applyFilter(chip.dataset.filter);
      } else if(act){
        e.preventDefault(); e.stopPropagation();
        if(act.dataset.action==='select-filtered'){ selectFilteredOnPage(); }
        else if(act.dataset.action==='print-selected'){
          if(typeof window.printSelectedClicked==='function') window.printSelectedClicked();
          else document.getElementById('ctl00_PageBody_lnkPrintSelected')?.click();
        } else if(act.dataset.action==='export-selected'){
          if(typeof window.exportSelectedClicked==='function') window.exportSelectedClicked();
          else document.getElementById('ctl00_PageBody_lnkExportSelected')?.click();
        }
      }
    });
    return bar;
  }
  function applyFilter(filter){
    const master=document.querySelector('#ctl00_PageBody_CreditNotesGrid .rgMasterTable'); if(!master) return;
    master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow').forEach(tr=>{
      const total=Number(tr.dataset.total||'0');
      let show=true;
      if(filter==='gte500') show=total>=500;
      else if(filter==='lt500') show=total>0 && total<500;
      tr.style.display=show?'':'none';
    });
  }
  function selectFilteredOnPage(){
    const root=document.getElementById('ctl00_PageBody_CreditNotesGrid'); if(!root) return;
    const boxes=root.querySelectorAll('tbody input[type="checkbox"][name*="chkSelect"]');
    boxes.forEach(cb=>{
      const tr=cb.closest('tr');
      if(tr && tr.style.display!=='none' && !cb.checked){
        cb.click(); const btn=tr.querySelector('.wl-card-check'); if(btn) syncCardCheckboxFromReal(tr);
      }
    });
  }

  /* ---------- observer (debounced + capped) ---------- */
  let observer, observeSuspended=false, debounceId=null, lastKey='', runsForKey=0;
  const MAX_RUNS_PER_KEY=2;
  function creditNo(tr){ const a=findCreditAnchor(tr); return a?(a.textContent||'').trim():''; }
  function computeGridKey(master){
    const rows=master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow');
    const n=rows.length||0;
    const first=n?creditNo(rows[0]):''; const last=n?creditNo(rows[n-1]):'';
    return `${n}:${first}-${last}`;
  }
  async function enhanceOnce(master,reason){
    if(!master) return;
    const key=computeGridKey(master);
    if(key===lastKey && runsForKey>=MAX_RUNS_PER_KEY){ log.info('Enhance skipped',{key,reason}); return; }
    if(key!==lastKey){ lastKey=key; runsForKey=0; }
    runsForKey++;

    // AP statuses first (so cards render with the right badge)
    await applyBadges(master);
    cardify(master);
    syncAllCardChecks(master);
  }
  function attachGridObserver(){
    const gridRoot=document.getElementById('ctl00_PageBody_CreditNotesGrid'); if(!gridRoot) return;
    if(observer) return;
    observer=new MutationObserver(()=>{
      if(observeSuspended) return;
      if(debounceId) clearTimeout(debounceId);
      debounceId=setTimeout(async ()=>{
        const master=gridRoot.querySelector('#ctl00_PageBody_CreditNotesGrid_ctl00') || gridRoot.querySelector('.rgMasterTable');
        if(master) await enhanceOnce(master,'mutation');
      },120);
    });
    observer.observe(gridRoot,{childList:true,subtree:true});
  }

  /* ---------- keep Select-All in sync ---------- */
  function hookSelectAllSync(){
    const headCb=document.querySelector('#ctl00_PageBody_CreditNotesGrid thead input[type="checkbox"], .RadGrid[id*="CreditNotesGrid"] thead input[type="checkbox"]');
    if(!headCb || headCb.__wlHeadBound) return;
    headCb.addEventListener('change',()=>{
      const master=document.querySelector('#ctl00_PageBody_CreditNotesGrid_ctl00, #ctl00_PageBody_CreditNotesGrid .rgMasterTable, .RadGrid[id*="CreditNotesGrid"] .rgMasterTable');
      if(master) syncAllCardChecks(master);
    });
    headCb.__wlHeadBound=true;
  }

  /* ---------- MS AJAX hooks ---------- */
  function attachAjaxHooks(){
    try{
      if(window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager){
        const prm=Sys.WebForms.PageRequestManager.getInstance();
        prm.add_initializeRequest(()=>{ observeSuspended=true; });
        prm.add_endRequest(async ()=>{
          observeSuspended=false; lastKey=''; runsForKey=0;
          // Rebuild AP index on each postback to reflect date-range changes
          __AP_PROMISE__=null;
          try{ await ensureApIndex(); }catch{}
          const master=document.querySelector('#ctl00_PageBody_CreditNotesGrid_ctl00, #ctl00_PageBody_CreditNotesGrid .rgMasterTable, .RadGrid[id*="CreditNotesGrid"] .rgMasterTable');
          if(master) await enhanceOnce(master,'ajax-endRequest');
          hookSelectAllSync();
        });
      }
    }catch{}
  }

  /* ---------- boot ---------- */
  async function boot(){
    const master=await getMasterTable(); if(!master) return;
    ensureToolbar();
    try{ await ensureApIndex(); }catch{}
    await enhanceOnce(master,'boot');
    attachAjaxHooks();
    attachGridObserver();
    hookSelectAllSync();
    log.info('Boot complete',{rows: document.querySelectorAll('#ctl00_PageBody_CreditNotesGrid .rgMasterTable tbody > tr.rgRow, #ctl00_PageBody_CreditNotesGrid .rgMasterTable tbody > tr.rgAltRow').length, version:VERSION});
  }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',boot,{once:true}); }
  else { boot(); }

  /* ---------- debug ---------- */
  window.WLCreditNotes={
    version:VERSION,
    async refreshAp(){ __AP_PROMISE__=null; await ensureApIndex(); const master=await getMasterTable(); await applyBadges(master); },
    sync(){
      const master=document.querySelector('#ctl00_PageBody_CreditNotesGrid_ctl00, #ctl00_PageBody_CreditNotesGrid .rgMasterTable, .RadGrid[id*="CreditNotesGrid"] .rgMasterTable');
      if(master) syncAllCardChecks(master);
    }
  };
})();

