/* =====================================================================
   Woodson — AccountPayment (streamlined)
   - UTM prefill
   - Layout + styling
   - Guards (respect pay mode + shadow field)
   - Submit bridge (proxy to native Forte/submit)
   - UI overrides (back button, header colors, hide left nav, 80% width)
   - Quick widget: Pay Last Statement, Fill Owing, Pay by Job (modal), Pay by Invoice (modal)
   ===================================================================== */

/* ---------------------------
   0) Early exit on other pages
   --------------------------- */
(function () {
  'use strict';
  if (!/AccountPayment_r\.aspx/i.test(location.pathname)) return;

  /* ========= shared helpers ========= */
  const $id = (x)=> document.getElementById(x);
  const $1  = (sel,root=document)=> root.querySelector(sel);
  const $$  = (sel,root=document)=> Array.from((root||document).querySelectorAll(sel));
  const parseMoney = (s)=> {
    const v=parseFloat(String(s||'').replace(/[^0-9.\-]/g,'')); 
    return Number.isFinite(v)?v:0;
  };
  const format2 = (n)=> Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2});
  const formEl  = ()=> (document.forms && document.forms[0]) || document.body;
  const triggerChange = (el)=> { try{ el.dispatchEvent(new Event('change',{bubbles:true})); }catch{} };
  const amtEl = ()=> $id('ctl00_PageBody_PaymentAmountTextBox');
  const remEl = ()=> $id('ctl00_PageBody_RemittanceAdviceTextBox');

  /* ===================================
     1) UTM prefill (invoices + amount)
     =================================== */
  (function prefillFromUTM(){
    const url = new URL(location.href);
    const HAS = url.searchParams.has('utm_invoices') || url.searchParams.has('utm_total');
    if (!HAS) return;

    const KEY='wl_ap_prefill_v2';
    const normalizeInvoices = (str)=>
      String(str||'').split(/[,\n\r\t ]+/).map(x=>x.trim()).filter(Boolean)
        .map(x=>`INV${x.replace(/^INV\s*/i,'')}`).join(',');

    const save = (p)=> { try{ sessionStorage.setItem(KEY, JSON.stringify(p)); }catch{} };
    const load = ()=> { try{ return JSON.parse(sessionStorage.getItem(KEY)||'{}'); }catch{ return {}; } };

    const urlInv = url.searchParams.get('utm_invoices') || '';
    const urlTot = url.searchParams.get('utm_total') || '';
    if (urlInv || urlTot){
      const ex = load();
      save({ invoices: normalizeInvoices(urlInv)||ex.invoices||'', total: urlTot||ex.total||'' });
    }

    const apply = ()=>{
      const pref = load(); if (!pref) return;
      const r = remEl(); const a = amtEl();
      if (r && pref.invoices && r.value.indexOf(pref.invoices)===-1){
        r.value = r.value ? `${r.value.replace(/\s+$/,'')}\n${pref.invoices}` : pref.invoices;
        r.defaultValue = r.value;
      }
      if (a && pref.total){ if (a.value !== pref.total) a.value = pref.total; a.defaultValue = a.value; }
    };

    const stampBeforeAjax = ()=>{
      const pref = load(); if (!pref) return;
      const r = remEl(); const a = amtEl();
      if (r && pref.invoices && r.value.indexOf(pref.invoices)===-1){
        r.value = r.value ? `${r.value.replace(/\s+$/,'')}\n${pref.invoices}` : pref.invoices;
      }
      if (a && pref.total && a.value !== pref.total) a.value = pref.total;
    };

    const persistOnEdit = ()=>{
      const ids = [
        'ctl00_PageBody_RemittanceAdviceTextBox','ctl00_PageBody_PaymentAmountTextBox',
        'ctl00_PageBody_BillingAddressTextBox','ctl00_PageBody_AddressDropdownList',
        'ctl00_PageBody_PostalCodeTextBox'
      ];
      ids.forEach(id=>{
        const el=$id(id); if (!el || el.__wlBound) return;
        const saveNow = ()=>{
          const r = remEl(); const a = amtEl(); const ex=load();
          save({
            invoices: r ? String(r.value||'').split(/[,\n\r\t ]+/).map(x=>x.trim()).filter(Boolean)
              .map(x=>`INV${x.replace(/^INV\s*/i,'')}`).join(',') : (ex.invoices||''),
            total: a ? a.value : (ex.total||'')
          });
        };
        el.addEventListener('input', saveNow);
        el.addEventListener('change', saveNow);
        el.__wlBound = true;
      });
      window.addEventListener('beforeunload', ()=>{
        const r=remEl(), a=amtEl(), ex=load();
        save({
          invoices: r ? String(r.value||'').split(/[,\n\r\t ]+/).map(x=>x.trim()).filter(Boolean)
            .map(x=>`INV${x.replace(/^INV\s*/i,'')}`).join(',') : (ex.invoices||''),
          total: a ? a.value : (ex.total||'')
        });
      });
    };

    // MS AJAX safe
    try{
      if (window.Sys?.WebForms?.PageRequestManager){
        const prm = Sys.WebForms.PageRequestManager.getInstance();
        if (!prm.__wlPrefillBound){
          prm.add_initializeRequest(()=> stampBeforeAjax());
          prm.add_endRequest(()=> apply());
          prm.__wlPrefillBound = true;
        }
      }
    }catch{}
    apply(); persistOnEdit();
    if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', apply, {once:true});
  })();

  /* =============================
     2) CSS (layout + minor tweaks)
     ============================= */
  (function injectCSS(){
    if ($id('wl-ap-css')) return;
    const s=document.createElement('style'); s.id='wl-ap-css';
    s.textContent = `
      :root{ --wl-bg:#f6f7fb; --wl-card:#fff; --wl-border:#e5e7eb;
             --wl-text:#0f172a; --wl-sub:#475569; --wl-brand:#6b0016; --wl-focus:#93c5fd; }
      .bodyFlexContainer{ background:var(--wl-bg); }

      .wl-shell{ display:grid; gap:18px; grid-template-areas:"left right" "tx tx"; }
      @media(min-width:1200px){ .wl-shell{ grid-template-columns: 1fr 380px; } }
      @media(min-width:1024px) and (max-width:1199px){ .wl-shell{ grid-template-columns: 1fr 360px; } }
      @media(max-width:1023px){ .wl-shell{ grid-template-areas:"left" "right" "tx"; grid-template-columns: 1fr; } }

      #wlLeftCard{ grid-area:left; } #wlRightCard{ grid-area:right; } #wlTxCard{ grid-area:tx; }
      .wl-card{ background:var(--wl-card); border:1px solid var(--wl-border);
                border-radius:16px; box-shadow:0 6px 18px rgba(15,23,42,.06); }
      .wl-card-head{ padding:14px 18px; border-bottom:1px solid var(--wl-border); font-weight:900; }
      .wl-card-body{ padding:12px 16px; } /* slightly tighter */

      .wl-form-grid{ display:grid; gap:14px 16px; } /* slightly tighter */
      @media(min-width:768px){ .wl-form-grid{ grid-template-columns: 1fr 1fr; } }
      .wl-item{ margin:0; padding:0; border:none; background:transparent; }
      .wl-span-2{ grid-column: 1 / -1; }
      .wl-field{ display:grid; gap:6px; } /* slightly tighter */
      @media(min-width:640px){ .wl-field{ grid-template-columns: 200px 1fr; align-items:center; } .wl-lab{ text-align:right; padding-right:14px; } }
      .wl-lab{ color:var(--wl-sub); font-weight:800; }
      .wl-ctl input.form-control, .wl-ctl select.form-control, .wl-ctl textarea.form-control{
        border:1px solid var(--wl-border); border-radius:12px; padding:12px 14px; min-height:42px;
      }
      .wl-help{ color:var(--wl-sub); font-size:12px; margin-top:4px; }

      /* Quick widget + chips */
      .wl-quick{ border:1px solid var(--wl-border); border-radius:14px; background:#fff; padding:12px 14px; box-shadow:0 4px 14px rgba(15,23,42,.06); }
      .wl-quick-row{ display:flex; align-items:center; flex-wrap:wrap; gap:10px; }
      .wl-chipbtn{ border:1px solid var(--wl-border); border-radius:999px; padding:6px 12px; background:#fff; font-weight:800; font-size:12px; cursor:pointer; }
      .wl-chipbtn[disabled]{ opacity:.6; cursor:not-allowed; }

      /* Submit */
      .wl-cta{ appearance:none; border:none; border-radius:12px; padding:12px 16px; background:var(--wl-brand); color:#fff; font-weight:900; cursor:pointer; width:100%; }
      .wl-cta:focus-visible{ outline:0; box-shadow:0 0 0 3px var(--wl-focus); }

      /* Card head colors (left + right) */
      #wlLeftCard .wl-card-head, #wlRightCard .wl-card-head{ background:#6b0016 !important; color:#fff !important; }

      /* Hide left sidebar nav */
      #ctl00_LeftSidebarContents_MainNav_NavigationMenu{ display:none !important; }

      /* 80% width rows on desktop */
      @media(min-width:768px){ .wl-form-grid .wl-item .wl-field{ width:80%; } }

      /* Back to My Account top button */
      .wl-topbar{ display:flex; justify-content:flex-end; gap:12px; margin:10px 0 6px; }
      .wl-backbtn{ appearance:none; border:1px solid #6b0016; border-radius:10px; padding:8px 12px; background:#6b0016; color:#fff; font-weight:800; text-decoration:none; line-height:1; }
      .wl-backbtn:focus-visible{ outline:0; box-shadow:0 0 0 3px rgba(107,0,22,.25); }
      .wl-backbtn, .wl-backbtn:visited, .wl-backbtn:hover, .wl-backbtn:active, .wl-backbtn:focus{ color:#fff !important; }

      /* Modal */
      .wl-modal-backdrop{ position:fixed; inset:0; background:rgba(15,23,42,.5); display:none; z-index:9999; }
      .wl-modal-shell{ position:fixed; inset:0; display:none; z-index:10000; }
      .wl-modal-card{ position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); background:#fff; border-radius:16px; width:min(1100px,94vw); max-height:86vh; box-shadow:0 20px 60px rgba(0,0,0,.25); display:flex; flex-direction:column; }
      .wl-modal-head{ padding:12px 16px; background:#6b0016; color:#fff; font-weight:900; display:flex; justify-content:space-between; align-items:center; border-radius:16px 16px 0 0; }
      .wl-modal-body{ padding:12px 16px; overflow:auto; }
      .wl-modal-foot{ padding:12px 16px; display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #e5e7eb; }
      .wl-btn{ border:1px solid #e5e7eb; border-radius:10px; padding:8px 12px; font-weight:800; background:#fff; cursor:pointer; }
      .wl-btn-primary{ background:#6b0016; color:#fff; border-color:#6b0016; }
      .wl-btn-ghost{ background:transparent; color:#fff; border-color:rgba(255,255,255,.35); }

      /* Modernize tx grid (when shown in modal) */
      .wl-modern-grid table{ border-collapse:separate; border-spacing:0; width:100%; font-size:14px; }
      .wl-modern-grid thead th{ position:sticky; top:0; background:#f8fafc; z-index:1; font-weight:800; letter-spacing:.01em; border-bottom:1px solid #e5e7eb; padding:10px 12px; }
      .wl-modern-grid tbody tr{ transition:background .15s ease; }
      .wl-modern-grid tbody tr:hover{ background:#f9fafb; }
      .wl-modern-grid td{ border-bottom:1px solid #eef2f7; padding:10px 12px; }

      /* Keep native submit in DOM but off-screen (for gateways) */
      .wl-hidden-native{ position:absolute!important; left:-20000px!important; top:auto!important; width:1px!important; height:1px!important; overflow:hidden!important; }
    `;
    document.head.appendChild(s);
  })();

  /* ===========================
     3) Layout (shell + grouping)
     =========================== */
  async function upgradeLayout(){
    const page = $1('.bodyFlexContainer'); if (!page) return;

    // Shell
    let shell = $1('.wl-shell');
    if (!shell){
      const firstLeft = $1('.bodyFlexItem > .float-left') || $1('.bodyFlexItem');
      shell = document.createElement('div'); shell.className='wl-shell';
      firstLeft?.parentNode?.insertBefore(shell, firstLeft);
      if (firstLeft) firstLeft.style.display='none';
    }

    // Cards
    let leftCard = $id('wlLeftCard');
    if (!leftCard){
      leftCard = document.createElement('div');
      leftCard.id = 'wlLeftCard';
      leftCard.className = 'wl-card';
      leftCard.innerHTML = `<div class="wl-card-head">Payment details</div><div class="wl-card-body"><div id="wlFormGrid" class="wl-form-grid"></div></div>`;
      shell.appendChild(leftCard);
    }
    const grid = $id('wlFormGrid');

    let rightCard = $id('wlRightCard');
    if (!rightCard){
      rightCard = document.createElement('div');
      rightCard.id = 'wlRightCard';
      rightCard.className = 'wl-card';
      rightCard.innerHTML = `
        <div class="wl-card-head">Make a Payment</div>
        <div class="wl-card-body">
          <div class="wl-summary">
            <div class="wl-pillrow" id="wlSummaryPills"></div>
            <div class="wl-summarylist" id="wlSummaryList"></div>
            <div id="wlSubmitMount" style="margin-top:6px;"></div>
            <button type="button" class="wl-cta" id="wlProxySubmit">Make Payment</button>
          </div>
        </div>`;
      shell.appendChild(rightCard);
    }

    let txCard = $id('wlTxCard');
    if (!txCard){
      txCard = document.createElement('div');
      txCard.id = 'wlTxCard';
      txCard.className = 'wl-card';
      txCard.innerHTML = `<div class="wl-card-head">Recent transactions</div><div class="wl-card-body" id="wlTxBody"></div>`;
      shell.appendChild(txCard);
    }

    // Move legacy groups into grid
    const grp = {
      owing: $id('ctl00_PageBody_AmountOwingLiteral')?.closest('.epi-form-group-acctPayment') || null,
      amount: $id('ctl00_PageBody_PaymentAmountTextBox')?.closest('.epi-form-group-acctPayment') || null,
      addrDDL: $id('ctl00_PageBody_AddressDropdownList')?.closest('.epi-form-group-acctPayment') || null,
      billAddr: $id('ctl00_PageBody_BillingAddressTextBox')?.closest('.epi-form-group-acctPayment')
                || $id('ctl00_PageBody_BillingAddressContainer') || null,
      zip: $id('ctl00_PageBody_PostalCodeTextBox')?.closest('.epi-form-group-acctPayment') || null,
      email: $id('ctl00_PageBody_EmailAddressTextBox')?.closest('.epi-form-group-acctPayment') || null,
      notes: $id('ctl00_PageBody_NotesTextBox')?.closest('.epi-form-group-acctPayment') || null,
      remit: $id('ctl00_PageBody_RemittanceAdviceTextBox')?.closest('.epi-form-group-acctPayment') || null,
      payWrap: $id('ctl00_PageBody_MakePaymentPanel')?.previousElementSibling || null
    };

    Object.values(grp).filter(Boolean).forEach(group=>{
      if (!group.__wlTidy){
        const blocks = $$(':scope > div', group);
        if (blocks.length >= 2){
          const lab = blocks[0]; const ctl = blocks[1];
          lab.classList.add('wl-lab'); ctl.classList.add('wl-ctl');
          const wrap = document.createElement('div'); wrap.className='wl-field';
          wrap.appendChild(lab); wrap.appendChild(ctl);
          group.appendChild(wrap);
        }
        $$('p.descriptionMessage', group).forEach(p=> p.classList.add('wl-help'));
        group.__wlTidy = true; group.classList.add('wl-item');
      }
      group.style.removeProperty('display');
    });

    [grp.owing, grp.amount, grp.addrDDL, grp.billAddr, grp.zip, grp.email, grp.notes, grp.remit, grp.payWrap]
      .filter(Boolean).forEach(el=>{ if (!grid.contains(el)) grid.appendChild(el); });
    if (grp.payWrap) grp.payWrap.classList.add('wl-span-2');

    // Ensure radios visible (don’t force selection here; guards mirror the chosen mode)
    const rbCheck = $id('ctl00_PageBody_RadioButton_PayByCheck');
    const lblCheck = document.querySelector('label[for="ctl00_PageBody_RadioButton_PayByCheck"]');
    grp.payWrap?.style.removeProperty('display');
    if (rbCheck) rbCheck.style.removeProperty('display');
    if (lblCheck){ lblCheck.style.removeProperty('display'); lblCheck.style.visibility='visible'; }

    // Amount “Remittance” placeholder
    const rem = remEl();
    if (rem && !rem.getAttribute('placeholder')) rem.setAttribute('placeholder','Comma separated · e.g. INV12345,INV67890');

    // Submit panel into right card (but keep native in DOM)
    const submitMount = $id('wlSubmitMount');
    if (submitMount && !submitMount.__wlMoved){
      const realSubmitPanel = $1('#ctl00_PageBody_MakePaymentPanel .submit-button-panel');
      if (realSubmitPanel){ submitMount.appendChild(realSubmitPanel); submitMount.__wlMoved = true; }
    }
  }

  /* ==================
     4) Summary (right)
     ================== */
  function getSummaryData(){
    const amt   = amtEl();
    const addr  = $id('ctl00_PageBody_AddressDropdownList');
    const bill  = $id('ctl00_PageBody_BillingAddressTextBox');
    const zip   = $id('ctl00_PageBody_PostalCodeTextBox');
    const email = $id('ctl00_PageBody_EmailAddressTextBox');
    const rem   = remEl();

    const totalStr = (amt?.value||'').trim();
    const addrSelText = (addr && addr.value !== '-1') ? (addr.options[addr.selectedIndex]?.text || '') : '';
    const billing = (bill?.value||'').trim();
    const zipStr  = (zip?.value||'').trim();
    const emailStr= (email?.value||'').trim();
    const invs = String((rem?.value||'').trim()).split(/[,\n\r\t ]+/).map(x=>x.trim()).filter(Boolean);

    return {
      total: totalStr ? Number(parseMoney(totalStr)||0).toLocaleString(undefined,{style:'currency',currency:'USD'}) : '',
      addrSelText: addrSelText, billing, zip:zipStr, email:emailStr,
      invCount: invs.length, invs
    };
  }
  function renderSummary(){
    const pills = $id('wlSummaryPills');
    const list  = $id('wlSummaryList');
    if (!pills || !list) return;
    const d = getSummaryData();
    pills.innerHTML = `
      <span class="wl-pill">${d.invCount} invoice${d.invCount===1?'':'s'}</span>
      ${d.total?`<span class="wl-pill">Total ${d.total}</span>`:''}
      ${d.invCount?`<span class="wl-pill" title="${d.invs.join(', ')}">${d.invs.slice(0,4).join(', ')}${d.invCount>4?'…':''}</span>`:''}
    `;
    const remShort = d.invs.slice(0,6).join(', ');
    list.innerHTML = `
      <div class="wl-row"><div class="wl-key">Invoices</div><div class="wl-val">${d.invCount} item${d.invCount===1?'':'s'} ${d.invCount>6?`<button type="button" class="wl-link" id="wlShowAllInv">View all</button>`:''}</div></div>
      <div class="wl-row"><div class="wl-key">Total</div><div class="wl-val">${d.total || '<small>—</small>'}</div></div>
      <div class="wl-row"><div class="wl-key">Address</div><div class="wl-val">${d.addrSelText || '<small>(none)</small>'}</div></div>
      <div class="wl-row"><div class="wl-key">Billing</div><div class="wl-val">${d.billing || '<small>—</small>'}<br>${d.zip ? `<small>ZIP ${d.zip}</small>` : ''}</div></div>
      <div class="wl-row"><div class="wl-key">Email</div><div class="wl-val">${d.email || '<small>—</small>'}</div></div>
      <div class="wl-row"><div class="wl-key">Remittance</div><div class="wl-val"><span id="wlRemShort">${remShort || '<small>—</small>'}</span></div></div>
    `;
    const btn = $id('wlShowAllInv');
    if (btn){
      btn.addEventListener('click', ()=>{
        const el = $id('wlRemShort'); if (!el) return;
        if (el.dataset.expanded==='1'){ el.textContent = remShort; el.dataset.expanded='0'; btn.textContent='View all'; }
        else { el.textContent = getSummaryData().invs.join(', '); el.dataset.expanded='1'; btn.textContent='Collapse'; }
      });
    }
  }
  function bindSummaryFields(){
    if (bindSummaryFields.__bound) return; bindSummaryFields.__bound = true;
    [
      'ctl00_PageBody_PaymentAmountTextBox','ctl00_PageBody_AddressDropdownList','ctl00_PageBody_BillingAddressTextBox',
      'ctl00_PageBody_PostalCodeTextBox','ctl00_PageBody_EmailAddressTextBox','ctl00_PageBody_RemittanceAdviceTextBox'
    ].forEach(id=>{
      const el=$id(id); if (!el || el.__wlSumBound) return;
      el.addEventListener('input', renderSummary);
      el.addEventListener('change', renderSummary);
      el.__wlSumBound = true;
    });
  }

  /* =========================================
     5) Guards (mirror Pay mode + show billing)
     ========================================= */
  const IDS = {
    rbCheck: 'ctl00_PageBody_RadioButton_PayByCheck',
    rbCredit:'ctl00_PageBody_RadioButton_PayByCredit',
    billBox: 'ctl00_PageBody_BillingAddressTextBox',
    billWrap:'ctl00_PageBody_BillingAddressContainer'
  };
  function readPayMode(){
    const cr=$id(IDS.rbCredit);
    return (cr && cr.checked) ? 'credit' : 'check';
  }
  function setDefaultPayModeIfUnset(){
    const chk=$id(IDS.rbCheck), cr=$id(IDS.rbCredit);
    if (!chk && !cr) return;
    if (chk?.checked || cr?.checked) { ensureShadowPayBy(); return; }
    if (chk){ chk.checked=true; if (cr) cr.checked=false; }
    ensureShadowPayBy();
  }
  function ensureShadowPayBy(){
    const form = formEl(); if (!form) return;
    let h=$id('wlPayByShadow');
    if (!h){
      h=document.createElement('input'); h.type='hidden'; h.id='wlPayByShadow'; h.name='ctl00$PageBody$PayBy';
      form.appendChild(h);
    }
    h.value = (readPayMode()==='credit') ? 'RadioButton_PayByCredit' : 'RadioButton_PayByCheck';
  }
  function showBilling(){
    const wrap = $id(IDS.billWrap) || $id(IDS.billBox)?.closest('.epi-form-group-acctPayment');
    if (!wrap) return false;
    wrap.style.removeProperty('display'); wrap.classList.add('wl-force-show');
    const grid = $id('wlFormGrid'); if (grid && !grid.contains(wrap)) grid.appendChild(wrap);
    return true;
  }
  function wireGuards(){
    const a = amtEl();
    if (a && !a.__wlPayGuard){
      a.addEventListener('input',  ensureShadowPayBy, true);
      a.addEventListener('change', ensureShadowPayBy, true);
      a.__wlPayGuard = true;
    }
    const form = formEl();
    if (form && !form.__wlPayGuard){
      form.addEventListener('submit', ()=>{ ensureShadowPayBy(); showBilling(); });
      form.__wlPayGuard = true;
    }
    try{
      if (window.Sys?.WebForms?.PageRequestManager){
        const prm = Sys.WebForms.PageRequestManager.getInstance();
        if (!prm.__wlPayGuard){
          prm.add_initializeRequest(()=> ensureShadowPayBy());
          prm.add_endRequest(()=> { ensureShadowPayBy(); showBilling(); });
          prm.__wlPayGuard = true;
        }
      }
    }catch{}
  }

  /* ============================
     6) Submit bridge to native UI
     ============================ */
  (function submitBridge(){
    // keep native panel in DOM and off-screen (for gateways)
    const ensureCSS=()=>{
      if ($id('wl-submit-bridge-css')) return;
      const s=document.createElement('style'); s.id='wl-submit-bridge-css';
      s.textContent = `.wl-hidden-native{position:absolute!important;left:-20000px!important;top:auto!important;width:1px!important;height:1px!important;overflow:hidden!important;}`;
      document.head.appendChild(s);
    };
    ensureCSS();

    function restoreSubmitPanel(){
      const nativeCtl = $1('#ctl00_PageBody_MakePaymentPanel .epi-form-group-acctPayment > div:nth-child(2)');
      const moved = $1('#wlSubmitMount .submit-button-panel');
      if (nativeCtl && moved && moved.parentNode !== nativeCtl) nativeCtl.appendChild(moved);
      const native = $1('#ctl00_PageBody_MakePaymentPanel .submit-button-panel');
      if (native && !native.classList.contains('wl-hidden-native')) native.classList.add('wl-hidden-native');
    }
    function findNativeTrigger(){
      let real = $1('#ctl00_PageBody_MakePaymentPanel .submit-button-panel button, #ctl00_PageBody_MakePaymentPanel .submit-button-panel input[type="submit"], #ctl00_PageBody_MakePaymentPanel .submit-button-panel input[type="button"], #ctl00_PageBody_MakePaymentPanel .submit-button-panel a');
      if (!real) real = $1('[data-gateway="shift4"], [id*="Shift4"], .shift4-button, button[name*="MakePayment"], input[type="submit"][name*="MakePayment"]');
      return real;
    }
    function proxyFire(){
      ensureShadowPayBy();
      const real = findNativeTrigger();
      if (real){ real.click(); return true; }
      const pb = $1('#ctl00_PageBody_MakePaymentPanel .submit-button-panel [onclick*="__doPostBack"]');
      if (pb){
        const m = (pb.getAttribute('onclick')||'').match(/__doPostBack\(['"]([^'"]+)['"],\s*['"]([^'"]*)['"]\)/);
        if (m && window.__doPostBack){ window.__doPostBack(m[1], m[2]||''); return true; }
      }
      const f=formEl(); if (f){ const ev=new Event('submit',{bubbles:true,cancelable:true}); f.dispatchEvent(ev); if(!ev.defaultPrevented){ f.submit(); } return true; }
      return false;
    }
    function wireProxy(){
      const btn=$id('wlProxySubmit'); if (!btn || btn.__wlBridgeBound) return;
      btn.addEventListener('click', proxyFire); btn.__wlBridgeBound=true;
    }
    function afterAjax(){ restoreSubmitPanel(); wireProxy(); }
    function boot(){
      afterAjax();
      try{
        if (window.Sys?.WebForms?.PageRequestManager){
          const prm = Sys.WebForms.PageRequestManager.getInstance();
          if (!prm.__wlBridgeBound){
            prm.add_endRequest(afterAjax);
            prm.__wlBridgeBound = true;
          }
        }
      }catch{}
    }
    if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
  })();

  /* ==========================
     7) UI overrides (top button)
     ========================== */
  (function addBackButton(){
    if ($id('wlTopBar')) return;
    const header = $1('.bodyFlexItem.listPageHeader');
    const host   = header?.parentNode || $1('.bodyFlexContainer') || document.body;
    const bar = document.createElement('div'); bar.id='wlTopBar'; bar.className='wl-topbar';
    const a  = document.createElement('a'); a.href='https://webtrack.woodsonlumber.com/AccountInfo_R.aspx'; a.className='wl-backbtn'; a.textContent='Back to My Account';
    bar.appendChild(a);
    if (header && header.nextSibling) host.insertBefore(bar, header.nextSibling); else host.insertBefore(bar, host.firstChild);
  })();

  /* =======================================================
     8) Quick widget (Last Statement, Fill Owing, Job, Invoice)
     ======================================================= */
  function ensureQuickWidget(){
    const grid = $id('wlFormGrid'); if (!grid) return;
    if ($id('wlQuickWidget')) return;

    const card = document.createElement('div');
    card.id='wlQuickWidget'; card.className='wl-quick wl-span-2';
    card.innerHTML = `
      <div class="wl-quick-row" id="wlQuickRow">
        <button type="button" class="wl-chipbtn" id="wlPayLastStmt">Pay My Last Statement</button>
        <button type="button" class="wl-chipbtn" id="wlFillOwing">Fill Owing</button>
        <button type="button" class="wl-chipbtn" id="wlPayByJobBtn">Pay by Job</button>
        <button type="button" class="wl-chipbtn" id="wlPayByInvoiceBtn">Pay by Invoice</button>
      </div>
    `;
    grid.prepend(card);

    // Fill owing
    $id('wlFillOwing')?.addEventListener('click', ()=>{
      const owingEl=$id('ctl00_PageBody_AmountOwingLiteral');
      const val = parseMoney((owingEl?.value || owingEl?.textContent || ''));
      const a=amtEl(); if (a && Number.isFinite(val) && val>0){ a.value = format2(val); triggerChange(a); }
    });

    // Last Statement -> writes remittance “STATEMENT <date> — $amount”
    $id('wlPayLastStmt')?.addEventListener('click', async function(){
      const btn=this;
      const withJQ = !!window.jQuery;
      async function fetchJQ(){
        return new Promise((resolve,reject)=>{
          window.jQuery.ajax({
            url:'https://webtrack.woodsonlumber.com/Statements_R.aspx', method:'GET',
            success:(data)=>{ try{
              const $=window.jQuery; const row=$(data).find('tr#ctl00_PageBody_StatementsDataGrid_ctl00__0');
              const closing=row.find('td[data-title="Closing Balance"]').text().trim();
              const date=row.find('td[data-title="Statement Date"]').text().trim() || row.find('td[data-title*="Date"]').first().text().trim() || '';
              resolve({ closing, date });
            }catch(e){ reject(e); }}, error:()=>reject(new Error('Ajax error'))
          });
        });
      }
      async function fetchNative(){
        const res=await fetch('https://webtrack.woodsonlumber.com/Statements_R.aspx',{credentials:'include'});
        if(!res.ok) throw new Error('HTTP '+res.status);
        const html=await res.text();
        const doc=new DOMParser().parseFromString(html,'text/html');
        const row=doc.querySelector('tr#ctl00_PageBody_StatementsDataGrid_ctl00__0');
        const closing=(row?.querySelector('td[data-title="Closing Balance"]')?.textContent||'').trim();
        const date=(row?.querySelector('td[data-title="Statement Date"]')?.textContent
                 || row?.querySelector('td[data-title*="Date"]')?.textContent || '').trim();
        return { closing, date };
      }
      btn.disabled=true; btn.textContent='Fetching…';
      try{
        const {closing,date} = (withJQ ? await fetchJQ() : await fetchNative());
        if (!closing){ alert('Could not find last statement amount.'); btn.disabled=false; btn.textContent='Pay My Last Statement'; return; }
        const amtNum = parseMoney(closing);
        const a=amtEl(); if (a){ a.value = Number.isFinite(amtNum) ? format2(amtNum) : closing; triggerChange(a); }
        const r=remEl();
        if (r){
          const lines=(r.value||'').split('\n').map(l=>l.trim()).filter(Boolean).filter(l=>!/^STATEMENT\b/i.test(l));
          lines.unshift(`STATEMENT ${date||'LAST'} — $${format2(amtNum)}`);
          r.value = lines.join('\n');
        }
      }catch{ alert('Error fetching data.'); }
      btn.disabled=false; btn.textContent='Pay My Last Statement';
    });

    // Pay by Job (modal)
    $id('wlPayByJobBtn')?.addEventListener('click', openJobsModal);

    // Pay by Invoice (modal using live grid)
    $id('wlPayByInvoiceBtn')?.addEventListener('click', openTxModal);
  }

  /* -------- Pay by Job modal -------- */
  function ensureJobsModalDOM(){
    if ($id('wlJobsModal')) return;
    const back=document.createElement('div'); back.id='wlJobsModalBackdrop'; back.className='wl-modal-backdrop';
    const shell=document.createElement('div'); shell.id='wlJobsModal'; shell.className='wl-modal-shell';
    shell.innerHTML=`
      <div class="wl-modal-card" role="dialog" aria-modal="true" aria-labelledby="wlJobsTitle">
        <div class="wl-modal-head">
          <div id="wlJobsTitle">Pay by Job</div>
          <button type="button" class="wl-btn wl-btn-ghost" id="wlJobsCloseX" aria-label="Close">✕</button>
        </div>
        <div class="wl-modal-body">
          <div id="wlJobsBody">Loading jobs…</div>
        </div>
        <div class="wl-modal-foot">
          <button type="button" class="wl-btn" id="wlJobsCancel">Cancel</button>
          <button type="button" class="wl-btn wl-btn-primary" id="wlJobsDone">Done</button>
        </div>
      </div>`;
    const f=formEl(); f.appendChild(back); f.appendChild(shell);
    const close=()=>{ back.style.display='none'; shell.style.display='none'; };
    back.addEventListener('click', close);
    $id('wlJobsCloseX').addEventListener('click', close);
    $id('wlJobsCancel').addEventListener('click', close);
    $id('wlJobsDone').addEventListener('click', close);
  }
  async function fetchJobBalances(){
    try{
      const res=await fetch('https://webtrack.woodsonlumber.com/JobBalances_R.aspx',{credentials:'include'});
      if(!res.ok) throw new Error('HTTP '+res.status);
      const html=await res.text();
      const doc=new DOMParser().parseFromString(html,'text/html');
      const rows=[...doc.querySelectorAll('table tr')];
      return rows.map(r=>{
        const job=r.querySelector('td[data-title="Job"]')?.textContent?.trim();
        const net=r.querySelector('td[data-title="Net Amount"]')?.textContent?.trim();
        if (!job || !net) return null;
        return { job, netAmount: parseMoney(net) };
      }).filter(Boolean);
    }catch{ return []; }
  }
  function renderJobsList(jobs){
    const host=$id('wlJobsBody'); if (!host) return;
    if (!jobs.length){ host.textContent='No jobs found.'; return; }
    const wrap=document.createElement('div'); wrap.className='wl-jobs-list';
    wrap.id='wlJobsList';
    jobs.forEach((job, i)=>{
      const line=document.createElement('label'); line.className='wl-job-line';
      const cb=document.createElement('input'); cb.type='checkbox'; cb.value=String(job.netAmount); cb.dataset.job=job.job; cb.id=`job-${i}`;
      const text=document.createElement('span'); text.textContent=`${job.job} — $${format2(job.netAmount)}`;
      line.appendChild(cb); line.appendChild(text); wrap.appendChild(line);
    });
    host.innerHTML=''; host.appendChild(wrap);

    const recalc = ()=>{
      const boxes=[...wrap.querySelectorAll('input[type="checkbox"]')];
      const total = boxes.filter(b=>b.checked).reduce((s,b)=> s+parseMoney(b.value), 0);
      const a=amtEl(); if (a){ a.value = total ? format2(total) : ''; triggerChange(a); }
      const r=remEl(); if (r){
        const others=(r.value||'').split('\n').filter(l=>!/^JOB\s/i.test(l)).filter(Boolean);
        const lines=boxes.filter(b=>b.checked).map(b=>`JOB ${b.dataset.job} — $${format2(parseMoney(b.value))}`);
        r.value = [...lines, ...others].join('\n');
      }
    };
    wrap.addEventListener('change', recalc);
  }
  async function openJobsModal(){
    ensureJobsModalDOM();
    const back=$id('wlJobsModalBackdrop'), shell=$id('wlJobsModal');
    back.style.display='block'; shell.style.display='block';
    $id('wlJobsBody').textContent='Loading jobs…';
    renderJobsList(await fetchJobBalances());
  }

  /* -------- Pay by Invoice modal (moves live grid into modal; persists across postbacks) -------- */
  const TX_PANEL_ID='ctl00_PageBody_accountsTransactionsPanel';
  const SESS_TX_OPEN='__WL_TxModalOpen';
  const PH_ID='wlTxReturnPH';

  function ensureTxModalDOM(){
    if ($id('wlTxModal')) return;
    const back=document.createElement('div'); back.id='wlTxModalBackdrop'; back.className='wl-modal-backdrop';
    const shell=document.createElement('div'); shell.id='wlTxModal'; shell.className='wl-modal-shell';
    shell.innerHTML=`
      <div class="wl-modal-card" role="dialog" aria-modal="true" aria-labelledby="wlTxTitle">
        <div class="wl-modal-head">
          <div id="wlTxTitle">Select Invoices</div>
          <button type="button" class="wl-btn wl-btn-ghost" id="wlTxCloseX" aria-label="Close">✕</button>
        </div>
        <div class="wl-modal-body wl-modern-grid" id="wlTxModalBody"><div id="wlTxLoading" style="padding:8px 0;">Loading invoices…</div></div>
        <div class="wl-modal-foot">
          <button type="button" class="wl-btn" id="wlTxCancelBtn">Cancel</button>
          <button type="button" class="wl-btn wl-btn-primary" id="wlTxDoneBtn">Done</button>
        </div>
      </div>`;
    const f=formEl(); f.appendChild(back); f.appendChild(shell);
    const close=()=>{ back.style.display='none'; shell.style.display='none'; sessionStorage.removeItem(SESS_TX_OPEN); restoreTxTarget(); };
    back.addEventListener('click', close);
    $id('wlTxCloseX').addEventListener('click', close);
    $id('wlTxCancelBtn').addEventListener('click', close);
    $id('wlTxDoneBtn').addEventListener('click', close);

    // If user interacts inside the grid, remember modal open across postbacks
    f.addEventListener('click',(e)=>{
      const host=$id('wlTxModalBody'); if (!host) return;
      if (host.contains(e.target)) sessionStorage.setItem(SESS_TX_OPEN,'1');
    }, true);
  }
  function findTxMoveTarget(){
    const panel=$id(TX_PANEL_ID);
    if (panel && (panel.querySelector('table, .rgDataDiv, input, select, a, button'))) return panel;
    const body = $id('wlTxBody') || $1('#wlTxCard .wl-card-body');
    if (body){
      const inner = body.querySelector('#'+CSS.escape(TX_PANEL_ID)) || body.firstElementChild;
      if (inner) return inner;
    }
    const fallback = $1('#'+CSS.escape(TX_PANEL_ID)+' * table') || $1('#wlTxCard .wl-card-body table');
    return fallback ? (fallback.closest('div,section,article')||fallback) : null;
  }
  function makePlaceholderFor(el){
    $id(PH_ID)?.remove();
    const ph=document.createElement('div'); ph.id=PH_ID;
    el.parentNode?.insertBefore(ph, el);
    return ph;
  }
  function moveTxTargetToModal(){
    const host=$id('wlTxModalBody'); if (!host) return false;
    const target=findTxMoveTarget(); if (!target) return false;
    makePlaceholderFor(target);
    host.appendChild(target);
    target.classList.add('wl-modern-grid');
    $id('wlTxLoading')?.remove();
    return true;
  }
  function restoreTxTarget(){
    const ph=$id(PH_ID); const target=findTxMoveTarget();
    if (ph && target){ ph.parentNode?.insertBefore(target, ph); target.classList.remove('wl-modern-grid'); ph.remove(); }
  }
  function openTxModal(){
    ensureTxModalDOM();
    const back=$id('wlTxModalBackdrop'), shell=$id('wlTxModal');
    back.style.display='block'; shell.style.display='block';
    if (!moveTxTargetToModal()){ $id('wlTxLoading')?.replaceChildren(document.createTextNode('Unable to load invoices table.')); }
    sessionStorage.setItem(SESS_TX_OPEN,'1');
  }
  function reattachIfNeeded(){
    if (sessionStorage.getItem(SESS_TX_OPEN)==='1'){
      ensureTxModalDOM();
      const back=$id('wlTxModalBackdrop'), shell=$id('wlTxModal');
      back.style.display='block'; shell.style.display='block';
      moveTxTargetToModal();
    }
  }

  /* ======================
     9) Boot + ajax reapply
     ====================== */
  function boot(){
    upgradeLayout();
    setDefaultPayModeIfUnset();
    ensureShadowPayBy();
    showBilling();
    wireGuards();
    bindSummaryFields();
    renderSummary();
    ensureQuickWidget();
    // rewire submit proxy (mounted earlier)
    // reattach modal grid if needed
    reattachIfNeeded();
  }

  if (document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  } else {
    boot();
  }

  try{
    if (window.Sys?.WebForms?.PageRequestManager){
      const prm = Sys.WebForms.PageRequestManager.getInstance();
      if (!prm.__wlMainBound){
        prm.add_endRequest(()=> { boot(); });
        prm.__wlMainBound = true;
      }
    }
  }catch{}
})();
