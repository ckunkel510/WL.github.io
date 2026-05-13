
/* =========================================================================
   Woodson — Credit Notes UI (v2.0)
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
  const VERSION='2.0'; log.info('Version',VERSION,'booting…');

  /* ---------- CSS (same as v1.0; keeps chips; badge colors reused) ---------- */
  (function injectCSS(){
    const css = `
      .wl-crn-shell, .wl-crn-shell *{box-sizing:border-box;}
      .wl-crn-shell{
        font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
        color:#222;
        margin:8px 0 14px;
      }
      .wl-crn-top{
        position:relative;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        margin-bottom:12px;
      }
      .wl-crn-menu-wrap{
        display:flex;
        align-items:center;
        gap:10px;
        min-width:0;
      }
      .wl-crn-title-wrap{min-width:0;}
      .wl-crn-title{
        color:#6b0016;
        font-size:1.24rem;
        line-height:1.2;
        font-weight:900;
      }
      .wl-crn-subtitle{
        color:#64748b;
        margin-top:3px;
        font-size:.92rem;
        line-height:1.35;
      }
      .wl-crn-menu-btn{
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
      .wl-crn-menu-btn:hover{background:#fbf5f6;}
      .wl-crn-menu{
        position:absolute;
        left:0;
        top:46px;
        z-index:7001;
        width:min(390px,92vw);
        max-height:0;
        overflow:auto;
        padding:0 8px;
        background:#fff;
        border:1px solid #e5e7eb;
        border-radius:14px;
        box-shadow:0 12px 30px rgba(0,0,0,.16);
        opacity:0;
        pointer-events:none;
        transition:max-height .25s ease,opacity .18s ease,padding .18s ease;
      }
      .wl-crn-menu.open{
        max-height:72vh;
        opacity:1;
        pointer-events:auto;
        padding:8px;
      }
      .wl-crn-menu-section + .wl-crn-menu-section{
        border-top:1px solid #eee;
        margin-top:6px;
        padding-top:6px;
      }
      .wl-crn-menu-label{
        color:#6b0016;
        font-size:.72rem;
        font-weight:900;
        text-transform:uppercase;
        letter-spacing:.06em;
        padding:5px 10px 3px;
      }
      .wl-crn-menu a{
        display:block;
        padding:9px 10px;
        color:#111;
        text-decoration:none;
        border-radius:9px;
        font-weight:700;
      }
      .wl-crn-menu a:hover,
      .wl-crn-menu a[aria-current="page"]{
        background:#fbf5f6;
        color:#6b0016;
      }
      .wl-crn-top-actions{
        display:flex;
        align-items:center;
        justify-content:flex-end;
        gap:8px;
        flex-wrap:wrap;
      }
      .wl-crn-top-actions a{
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
      .wl-crn-top-actions a:hover{
        background:#fbf5f6;
        color:#6b0016;
      }
      .wl-crn-hide{
        position:absolute!important;
        left:-9999px!important;
        width:1px!important;
        height:1px!important;
        overflow:hidden!important;
        opacity:0!important;
        pointer-events:none!important;
      }

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
      .wl-toolbar{
        display:grid;
        grid-template-columns:minmax(260px,1fr) auto;
        gap:10px;
        margin:8px 0 12px;
        padding:12px;
        background:#fff;
        border:1px solid #e5e7eb;
        border-radius:16px;
        box-shadow:0 4px 14px rgba(15,23,42,.05);
      }
      .wl-toolbar-search{min-width:0;}
      .wl-toolbar-search label{
        display:block;
        margin-bottom:6px;
        color:#475569;
        font-size:12px;
        font-weight:900;
        text-transform:uppercase;
        letter-spacing:.04em;
      }
      .wl-crn-filter-input{
        width:100%;
        min-height:40px;
        border:1px solid #e5e7eb;
        border-radius:12px;
        padding:9px 11px;
        font:inherit;
        background:#fff;
      }
      .wl-crn-filter-input:focus{
        outline:2px solid rgba(107,0,22,.18);
        border-color:#6b0016;
      }
      .wl-toolbar-controls{
        display:flex;
        align-items:end;
        justify-content:flex-end;
        gap:8px;
        flex-wrap:wrap;
      }
      .wl-chipbtn{border:1px solid #e5e7eb;border-radius:999px;padding:7px 11px;font-weight:800;background:#fff;color:#0f172a;font-size:12px;cursor:pointer;user-select:none;}
      .wl-chipbtn[data-active=true]{border-color:#6b0016;background:#fbf5f6;color:#6b0016;}
      .wl-spacer{display:none;}
      .wl-act{border:1px solid #e5e7eb;border-radius:10px;padding:8px 11px;font-weight:800;background:#f8fafc;font-size:12px;cursor:pointer;}
      .wl-crn-results-note{grid-column:1 / -1;color:#64748b;font-size:12px;line-height:1.35;}

      .wl-crn-modal{
        position:fixed;
        inset:0;
        z-index:9999;
        display:none;
        align-items:flex-start;
        justify-content:center;
        padding:18px;
        background:rgba(0,0,0,.45);
        overflow:auto;
      }
      .wl-crn-modal.open{display:flex;}
      .wl-crn-modal-card{
        width:min(1120px,96vw);
        margin:auto 0;
        background:#fff;
        border-radius:16px;
        border:1px solid #e5e7eb;
        box-shadow:0 18px 44px rgba(0,0,0,.22);
        overflow:hidden;
        max-height:calc(100vh - 36px);
        display:flex;
        flex-direction:column;
      }
      .wl-crn-modal-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        background:#6b0016;
        color:#fff;
        padding:12px 14px;
        flex:0 0 auto;
      }
      .wl-crn-modal-title{font-weight:900;font-size:1.05rem;}
      .wl-crn-modal-subtitle{color:rgba(255,255,255,.88);font-size:.88rem;margin-top:2px;}
      .wl-crn-modal-close{
        border:1px solid rgba(255,255,255,.55);
        background:rgba(255,255,255,.12);
        color:#fff;
        border-radius:10px;
        min-height:36px;
        padding:7px 11px;
        font-weight:850;
        cursor:pointer;
      }
      .wl-crn-modal-close:hover{background:rgba(255,255,255,.22);}
      .wl-crn-modal-body{padding:14px;background:#fbf5f6;overflow:auto;}
      .wl-crn-modal-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;}
      .wl-crn-modal-note{
        background:#fff;
        border:1px solid #ead4d9;
        border-radius:12px;
        color:#64748b;
        font-size:.88rem;
        line-height:1.4;
        padding:10px 12px;
        margin:8px 0 12px;
      }
      .wl-crn-summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:9px;}
      .wl-crn-summary-card{background:#fff;border:1px solid #ead4d9;border-radius:12px;padding:10px;}
      .wl-crn-summary-label{color:#64748b;font-size:.78rem;font-weight:900;text-transform:uppercase;letter-spacing:.04em;}
      .wl-crn-summary-value{margin-top:2px;color:#6b0016;font-weight:900;}
      .wl-crn-lines{display:grid;gap:10px;}
      .wl-crn-line{
        background:#fff;
        border:1px solid #ead4d9;
        border-radius:12px;
        padding:11px;
        display:grid;
        grid-template-columns:minmax(120px,170px) minmax(220px,1fr) repeat(4,auto);
        align-items:center;
        gap:10px;
      }
      .wl-crn-line-code{color:#6b0016;font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:900;word-break:break-word;}
      .wl-crn-line-desc{color:#222;font-weight:650;line-height:1.3;}
      .wl-crn-line-meta{color:#64748b;font-size:.86rem;white-space:nowrap;}
      .wl-crn-line-price{color:#111;font-weight:900;white-space:nowrap;}
      .wl-crn-loading,.wl-crn-error,.wl-crn-empty{
        background:#fff;
        border:1px solid #ead4d9;
        border-radius:12px;
        padding:14px;
        color:#64748b;
        line-height:1.45;
      }
      .wl-crn-error{color:#7f1d1d;background:#fee2e2;border-color:#fecaca;}
      @media(max-width:760px){
        .wl-toolbar{grid-template-columns:1fr;}
        .wl-toolbar-controls{justify-content:flex-start;}
        .wl-crn-top{align-items:flex-start;flex-direction:column;}
        .wl-crn-line{grid-template-columns:1fr;}
      }
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

  const escapeHtml=(value)=>String(value==null?'':value).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
  const escapeAttr=(value)=>escapeHtml(value).replace(/'/g,'&#39;');

  function getStoredCashAccountFlag(){
    try{
      const raw=localStorage.getItem('wl_account_is_cash_v1');
      if(raw==='true') return true;
      if(raw==='false') return false;
    }catch{}
    return null;
  }
  function normalizeMenuLabel(label){
    label=String(label||'').trim();
    if(/^Account Information$/i.test(label)) return 'Account Dashboard';
    if(/^Quicklists$/i.test(label)) return 'Shopping Lists';
    return label;
  }
  function buildAccountMenu(root){
    const menu=root.querySelector('.wl-crn-menu');
    const btn=root.querySelector('.wl-crn-menu-btn');
    if(!menu || !btn || btn.__wlMenuBound) return;

    const currentPath=(window.location.pathname||'').split('/').pop().toLowerCase();
    const isCashAccount=getStoredCashAccountFlag();
    const paymentLabel=isCashAccount===true?'Reload Balance':(isCashAccount===false?'Make a Payment':'Make a Payment / Reload Balance');

    let accountSettingLinks=[['Quicklists_R.aspx','Shopping Lists']];
    if(isCashAccount!==true) accountSettingLinks.push(['Statements_R.aspx','Statements']);
    accountSettingLinks=accountSettingLinks.concat([
      ['CustomerTokens.aspx','Payment Methods'],
      ['AccountSettings.aspx','Change Password / Account Settings'],
      ['AddressList_R.aspx','Addresses'],
      ['Contacts_r.aspx','Contacts']
    ]);

    const groups=[
      {label:'',links:[['AccountInfo_R.aspx','Account Dashboard']]},
      {label:'Transactions',links:[
        ['AccountPayment_r.aspx',paymentLabel],
        ['OpenQuotes_r.aspx','Quotes'],
        ['OpenOrders_r.aspx','Orders'],
        ['Invoices_r.aspx','Invoices'],
        ['CreditNotes_r.aspx','Credit Notes'],
        ['ProductsPurchased_R.aspx','Products Purchased']
      ]},
      {label:'Account Settings',links:accountSettingLinks}
    ];

    menu.innerHTML=groups.map(group=>`
      <div class="wl-crn-menu-section">
        ${group.label?`<div class="wl-crn-menu-label">${escapeHtml(group.label)}</div>`:''}
        ${group.links.map(([href,label])=>{
          const path=String(href||'').split('?')[0].split('#')[0].split('/').pop().toLowerCase();
          const current=path===currentPath?' aria-current="page"':'';
          return `<a role="menuitem" href="${escapeAttr(href)}"${current}>${escapeHtml(normalizeMenuLabel(label))}</a>`;
        }).join('')}
      </div>
    `).join('');

    const toggle=(open)=>{
      menu.classList.toggle('open',!!open);
      btn.setAttribute('aria-expanded',open?'true':'false');
    };

    btn.addEventListener('click',(e)=>{
      e.preventDefault();
      e.stopPropagation();
      toggle(!menu.classList.contains('open'));
    });

    document.addEventListener('click',(e)=>{
      if(!menu.classList.contains('open')) return;
      if(!menu.contains(e.target) && e.target!==btn) toggle(false);
    });

    btn.__wlMenuBound=true;
  }

  function ensureCreditShell(){
    const grid=document.getElementById('ctl00_PageBody_CreditNotesGrid');
    const bodyFlex=grid?.closest('.bodyFlexContainer') || document.querySelector('.bodyFlexContainer');
    const host=bodyFlex?.parentElement || document.querySelector('#MainLayoutRow .col') || document.body;
    if(!host) return null;
    if(document.querySelector('.wl-crn-shell')) return document.querySelector('.wl-crn-shell');

    const legacyTitle=Array.from(document.querySelectorAll('.bodyFlexItem.listPageHeader,.listPageHeader'))
      .find(el=>/Credit Note/i.test(el.textContent||''));
    if(legacyTitle) legacyTitle.classList.add('wl-crn-hide');

    const legacyNav=document.getElementById('ctl00_LeftSidebarContents_MainNav_NavigationMenu');
    if(legacyNav) legacyNav.classList.add('wl-crn-hide');

    const shell=document.createElement('div');
    shell.className='wl-crn-shell';
    shell.innerHTML=`
      <div class="wl-crn-top">
        <div class="wl-crn-menu-wrap">
          <button type="button" class="wl-crn-menu-btn" aria-expanded="false" aria-controls="wl-crn-menu">☰ Menu</button>
          <div class="wl-crn-title-wrap">
            <div class="wl-crn-title">Credit Notes</div>
            <div class="wl-crn-subtitle">Review credit-note history, check usage status, select documents, and print or export selected credit notes.</div>
          </div>
          <div class="wl-crn-menu" id="wl-crn-menu" role="menu"></div>
        </div>
        <div class="wl-crn-top-actions">
          <a href="AccountPayment_r.aspx">Account Payment</a>
        </div>
      </div>
    `;

    host.insertBefore(shell,host.firstChild);
    buildAccountMenu(shell);
    return shell;
  }

  function creditHaystack(tr){
    const parts=[
      grab(tr,'td[data-title="Credit Note #"]'),
      grab(tr,'td[data-title="Your Ref"]'),
      grab(tr,'td[data-title="Job Ref"]'),
      grab(tr,'td[data-title="Credit Date"]'),
      grab(tr,'td[data-title="Goods Total"]'),
      grab(tr,'td[data-title="Tax"]'),
      grab(tr,'td[data-title="Total Amount"]'),
      grab(tr,'td[data-title="Lines"]'),
      grab(tr,'td[data-title="Branch"]')
    ];
    const cardText=tr.querySelector('.wl-row-head')?.textContent || '';
    return (parts.join(' ')+' '+cardText).replace(/\s+/g,' ').toLowerCase();
  }
  function getActiveCreditFilter(){
    return document.querySelector('.wl-toolbar .wl-chipbtn[data-active="true"]')?.dataset.filter || 'all';
  }

  function creditDetailsUrlFromRow(tr, href){
    if(href && href!=='#' && /CreditNoteDetails_r\.aspx/i.test(href)) return href;
    const idSpan=tr.querySelector('td:first-child span[creditnoteid], span[creditnoteid]');
    const cid=idSpan?.getAttribute('creditnoteid') || '';
    if(cid) return abs(`CreditNoteDetails_r.aspx?id=${encodeURIComponent(cid)}&returnUrl=${encodeURIComponent('~/CreditNotes_r.aspx')}`);
    return href || '#';
  }

  function findFirst(root, selectors){
    for(const selector of selectors){
      const found=root.querySelector(selector);
      if(found) return found;
    }
    return null;
  }

  function parseCreditDetailMeta(doc){
    const headerText=txt(doc.querySelector('.listPageHeader'));
    const match=headerText.match(/Details\s+for\s+Credit\s+Note\s+(\S+)/i);
    return { creditNumber: match ? match[1] : '' };
  }

  function parseCreditActionsFromDoc(doc){
    const creditDocLink=findFirst(doc,[
      '#ctl00_PageBody_ctl00_ShowDocumentImageLink',
      '#ctl00_PageBody_ctl00_ShowDocumentImageDropDown',
      'a[id*="ShowDocumentImage"]',
      'a[href*="ProcessDocument.aspx"][href*="documentType=7"]'
    ]);

    return {
      creditPdfHref: creditDocLink ? abs(creditDocLink.getAttribute('href') || creditDocLink.href || '') : ''
    };
  }

  function parseCreditLinesFromDoc(doc){
    const table=
      doc.querySelector('#ctl00_PageBody_ctl00_CreditNoteDetailsGrid_ctl00') ||
      doc.querySelector('#ctl00_PageBody_ctl00_CreditNoteDetailsGrid .rgMasterTable') ||
      doc.querySelector('#ctl00_PageBody_ctl02_CreditNoteDetailsGrid_ctl00') ||
      doc.querySelector('#ctl00_PageBody_ctl02_CreditNoteDetailsGrid .rgMasterTable');

    const lines=[];
    if(table){
      table.querySelectorAll('tbody > tr,tr.rgRow,tr.rgAltRow').forEach(row=>{
        if(row.querySelector('th')) return;
        const code=txt(row.querySelector('td[data-title="Product Code"]'));
        const description=txt(row.querySelector('td[data-title="Description"]'));
        const qty=txt(row.querySelector('td[data-title="Qty"]'));
        const uom=txt(row.querySelector('td[data-title="UOM"]'));
        const price=txt(row.querySelector('td[data-title="Price"]'));
        const restock=txt(row.querySelector('td[data-title="Restock Charge"]'));
        const tax=txt(row.querySelector('td[data-title="Tax"]'));
        const total=txt(row.querySelector('td[data-title="Total"]'));
        if((code+description).trim()) lines.push({code,description,qty,uom,price,restock,tax,total});
      });
    }
    return lines;
  }

  async function fetchCreditDetail(detailsUrl){
    const html=await fetch(detailsUrl,{credentials:'same-origin',cache:'no-cache'}).then(r=>{
      if(!r.ok) throw new Error('Credit note details request failed: '+r.status);
      return r.text();
    });
    const doc=new DOMParser().parseFromString(html,'text/html');
    return {
      doc,
      meta: parseCreditDetailMeta(doc),
      actions: parseCreditActionsFromDoc(doc),
      lines: parseCreditLinesFromDoc(doc)
    };
  }

  function openCreditModal(credit){
    const existing=document.getElementById('wl-crn-detail-modal');
    if(existing) existing.remove();

    const modal=document.createElement('div');
    modal.className='wl-crn-modal open';
    modal.id='wl-crn-detail-modal';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.innerHTML=`
      <div class="wl-crn-modal-card">
        <div class="wl-crn-modal-head">
          <div>
            <div class="wl-crn-modal-title">Credit Note #${escapeHtml(credit.crNo || '')}</div>
            <div class="wl-crn-modal-subtitle">${escapeHtml(credit.crDate || '')}${credit.branch ? ' • '+escapeHtml(credit.branch) : ''}${credit.total ? ' • Total '+escapeHtml(credit.total) : ''}</div>
          </div>
          <button type="button" class="wl-crn-modal-close">Close</button>
        </div>
        <div class="wl-crn-modal-body">
          <div class="wl-crn-loading">Loading credit note details…</div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal=()=>{
      modal.classList.remove('open');
      setTimeout(()=>modal.remove(),160);
    };

    modal.querySelector('.wl-crn-modal-close').addEventListener('click',closeModal);
    modal.addEventListener('click',e=>{ if(e.target===modal) closeModal(); });
    const keyHandler=(e)=>{
      if(e.key==='Escape' && modal.classList.contains('open')){
        closeModal();
        document.removeEventListener('keydown',keyHandler);
      }
    };
    document.addEventListener('keydown',keyHandler);

    fetchCreditDetail(credit.href).then(detail=>{
      const body=modal.querySelector('.wl-crn-modal-body');
      const meta=detail.meta || {};
      const actions=detail.actions || {};
      const creditNo=meta.creditNumber || credit.crNo || '';

      body.innerHTML=`
        <div class="wl-crn-summary-grid">
          <div class="wl-crn-summary-card"><div class="wl-crn-summary-label">Credit Note</div><div class="wl-crn-summary-value">#${escapeHtml(creditNo)}</div></div>
          <div class="wl-crn-summary-card"><div class="wl-crn-summary-label">Credit Date</div><div class="wl-crn-summary-value">${escapeHtml(credit.crDate || '—')}</div></div>
          <div class="wl-crn-summary-card"><div class="wl-crn-summary-label">Branch</div><div class="wl-crn-summary-value">${escapeHtml(credit.branch || '—')}</div></div>
          <div class="wl-crn-summary-card"><div class="wl-crn-summary-label">Total</div><div class="wl-crn-summary-value">${escapeHtml(credit.total || '—')}</div></div>
          <div class="wl-crn-summary-card"><div class="wl-crn-summary-label">Status</div><div class="wl-crn-summary-value">${escapeHtml(credit.statusLabel || '—')}</div></div>
          <div class="wl-crn-summary-card"><div class="wl-crn-summary-label">Lines</div><div class="wl-crn-summary-value">${escapeHtml(credit.lines || '—')}</div></div>
        </div>

        <div class="wl-crn-modal-actions">
          ${actions.creditPdfHref ? '<a class="wl-btn wl-btn--ghost" href="'+escapeAttr(actions.creditPdfHref)+'" target="_blank" rel="noopener">Download Credit Note PDF</a>' : ''}
        </div>

        <div class="wl-crn-modal-note">
          Download Credit Note PDF opens the generated paper-copy credit note document.
        </div>

        <div class="wl-crn-lines"></div>
      `;

      const linesWrap=body.querySelector('.wl-crn-lines');
      if(!detail.lines.length){
        linesWrap.appendChild(document.createRange().createContextualFragment('<div class="wl-crn-empty">No line items were found for this credit note.</div>'));
        return;
      }

      detail.lines.forEach(line=>{
        const el=document.createElement('div');
        el.className='wl-crn-line';
        el.innerHTML=`
          <div class="wl-crn-line-code">${escapeHtml(line.code || '—')}</div>
          <div class="wl-crn-line-desc">${escapeHtml(line.description || '—')}</div>
          <div class="wl-crn-line-meta">${line.qty ? 'Qty: '+escapeHtml(line.qty) : ''}${line.uom ? ' '+escapeHtml(line.uom) : ''}</div>
          <div class="wl-crn-line-price">${line.price ? escapeHtml(line.price) : ''}</div>
          <div class="wl-crn-line-meta">${line.restock ? 'Restock: '+escapeHtml(line.restock) : ''}</div>
          <div class="wl-crn-line-meta">${line.tax ? 'Tax: '+escapeHtml(line.tax) : ''}</div>
          <div class="wl-crn-line-meta">${line.total ? 'Total: '+escapeHtml(line.total) : ''}</div>
        `;
        linesWrap.appendChild(el);
      });
    }).catch(err=>{
      console.error('Credit note modal load failed',err);
      const body=modal.querySelector('.wl-crn-modal-body');
      body.innerHTML=`
        <div class="wl-crn-error">Sorry, we could not load credit-note details in this view.</div>
        <div class="wl-crn-modal-actions">
          <a class="wl-btn wl-btn--primary" href="${escapeAttr(credit.href)}">Open Credit Note Details</a>
        </div>
      `;
    });
  }



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
        ${href!=='#'?`<button class="wl-btn wl-btn--ghost" type="button" data-act="credit-modal">View Credit Note</button>`:''}
        <button class="wl-btn wl-btn--primary" type="button" data-act="toggle">Line Details</button>
      </div>
    `;
    tr.insertAdjacentElement('afterbegin', head);

    bindCardCheckboxInteractions(tr);

    const details=document.createElement('div'); details.className='wl-details'; tr.appendChild(details);

    const modalBtn=head.querySelector('[data-act="credit-modal"]');
    if(modalBtn){
      modalBtn.addEventListener('click',(e)=>{
        e.preventDefault();
        const detailsUrl=creditDetailsUrlFromRow(tr, href);
        openCreditModal({
          crNo,
          href: detailsUrl,
          yourRef,
          jobRef,
          crDate,
          goods,
          tax,
          total,
          lines,
          branch,
          statusLabel: tr.querySelector('.wl-card-badge')?.textContent || ''
        });
      });
    }

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
          const table=doc.querySelector('#ctl00_PageBody_ctl00_CreditNoteDetailsGrid_ctl00, #ctl00_PageBody_ctl00_CreditNoteDetailsGrid .rgMasterTable, #ctl00_PageBody_ctl02_CreditNoteDetailsGrid_ctl00, .rgMasterTable');

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
      e.currentTarget.textContent = details.classList.contains('show') ? 'Hide Details' : 'Line Details';
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
    applyFilter(getActiveCreditFilter());
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
      <div class="wl-toolbar-search">
        <label for="wl-crn-filter-text">Search credit notes</label>
        <input id="wl-crn-filter-text" class="wl-crn-filter-input" type="search" placeholder="Search credit note #, branch, job, reference, date, or amount...">
      </div>
      <div class="wl-toolbar-controls">
        <button type="button" class="wl-chipbtn" data-filter="all" data-active="true">All</button>
        <button type="button" class="wl-chipbtn" data-filter="taken">Taken</button>
        <button type="button" class="wl-chipbtn" data-filter="open">Open</button>
        <button type="button" class="wl-chipbtn" data-filter="partial">Partial</button>
        <button type="button" class="wl-chipbtn" data-filter="gte500">≥ $500</button>
        <button type="button" class="wl-chipbtn" data-filter="lt500">&lt; $500</button>
        <button type="button" class="wl-act" data-action="clear-search">Clear</button>
        <button type="button" class="wl-act" data-action="select-filtered">Select filtered</button>
        <button type="button" class="wl-act" data-action="print-selected" title="Print Selected">Print selected</button>
        <button type="button" class="wl-act" data-action="export-selected" title="Export Selected to QuickBooks">Export selected</button>
      </div>
      <div class="wl-crn-results-note" id="wl-crn-results-note">Showing credit notes from the current WebTrack result set.</div>
    `;
    flex.insertBefore(bar, flex.firstChild);

    const searchInput=bar.querySelector('#wl-crn-filter-text');
    if(searchInput && !searchInput.__wlBound){
      searchInput.addEventListener('input',()=>applyFilter(getActiveCreditFilter()));
      searchInput.__wlBound=true;
    }

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
        } else if(act.dataset.action==='clear-search'){
          if(searchInput) searchInput.value='';
          bar.querySelectorAll('.wl-chipbtn').forEach(b=>b.dataset.active='false');
          const all=bar.querySelector('.wl-chipbtn[data-filter="all"]');
          if(all) all.dataset.active='true';
          applyFilter('all');
          if(searchInput) searchInput.focus();
        }
      }
    });
    return bar;
  }
  function applyFilter(filter){
    const master=document.querySelector('#ctl00_PageBody_CreditNotesGrid .rgMasterTable'); if(!master) return;
    const rows=Array.from(master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
    const needle=(document.getElementById('wl-crn-filter-text')?.value || '').trim().toLowerCase();

    let shown=0;
    rows.forEach(tr=>{
      const total=Number(tr.dataset.total||'0');
      const status=tr.dataset.status || 'unknown';
      let statusMatch=true;
      if(filter==='gte500') statusMatch=total>=500;
      else if(filter==='lt500') statusMatch=total>0 && total<500;
      else if(filter!=='all') statusMatch=status===filter;

      const textMatch=!needle || creditHaystack(tr).indexOf(needle)>=0;
      const show=statusMatch && textMatch;
      tr.style.display=show?'':'none';
      if(show) shown++;
    });

    const note=document.getElementById('wl-crn-results-note');
    if(note){
      const totalRows=rows.length;
      const label=filter==='all'?'all statuses':filter;
      note.textContent=`Showing ${shown} of ${totalRows} credit notes from the current WebTrack result set (${label}${needle?', filtered by search':''}).`;
    }
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
        ensureCreditShell();
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
    ensureCreditShell();
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

