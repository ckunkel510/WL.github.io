
(function () {
  'use strict';
  if (!/AccountPayment_r\.aspx/i.test(location.pathname)) return;

  // ---- HARD GUARD: only run if URL has our params ----
  const url = new URL(location.href);
  const HAS_PARAMS = url.searchParams.has('utm_invoices') || url.searchParams.has('utm_total');
  if (!HAS_PARAMS) return; // <- zero overhead if not coming from Invoices

  const $ = (id)=> document.getElementById(id);
  const KEY = 'wl_ap_prefill_v2';

  /* ---------- helpers ---------- */
  function savePref(p){ try{ sessionStorage.setItem(KEY, JSON.stringify(p)); }catch{} }
  function loadPref(){ try{ return JSON.parse(sessionStorage.getItem(KEY) || '{}'); }catch{ return {}; } }
  function parseMoney(s){ const v=parseFloat(String(s||'').replace(/[^0-9.\-]/g,'')); return Number.isFinite(v)?v:0; }
  function normalizeInvoices(str){
    return String(str||'')
      .split(/[,\n\r\t ]+/)
      .map(x=>x.trim())
      .filter(Boolean)
      .map(x=>`INV${x.replace(/^INV\s*/i,'')}`)
      .join(',');
  }

  /* ---------- read URL and seed session ---------- */
  const urlInv = url.searchParams.get('utm_invoices') || '';
  const urlTot = url.searchParams.get('utm_total')    || '';
  if (urlInv || urlTot){
    const existing = loadPref();
    savePref({
      invoices: normalizeInvoices(urlInv) || existing.invoices || '',
      total:    (urlTot || existing.total || '')
    });
  }

  /* ---------- apply to DOM ---------- */
  function applyPrefill(){
    const pref = loadPref(); if (!pref) return;
    const rem = $('ctl00_PageBody_RemittanceAdviceTextBox');
    if (rem && pref.invoices){
      const has = rem.value && rem.value.indexOf(pref.invoices) !== -1;
      if (!has){
        rem.value = rem.value ? `${rem.value.replace(/\s+$/,'')}\n${pref.invoices}` : pref.invoices;
      }
      rem.defaultValue = rem.value;
    }
    const amt = $('ctl00_PageBody_PaymentAmountTextBox');
    if (amt && pref.total){
      if (amt.value !== pref.total) amt.value = pref.total;
      amt.defaultValue = amt.value;
    }
    renderSummary(pref);
  }

  /* ---------- ensure values are in the POST before any partial postback ---------- */
  function stampValuesIntoForm(){
    const pref = loadPref(); if (!pref) return;
    const rem = $('ctl00_PageBody_RemittanceAdviceTextBox');
    const amt = $('ctl00_PageBody_PaymentAmountTextBox');
    if (rem && pref.invoices && rem.value.indexOf(pref.invoices) === -1){
      rem.value = rem.value ? `${rem.value.replace(/\s+$/,'')}\n${pref.invoices}` : pref.invoices;
    }
    if (amt && pref.total && amt.value !== pref.total){
      amt.value = pref.total;
    }
  }

  /* ---------- MS AJAX hooks (only if params present) ---------- */
  function wireAjax(){
    try{
      if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager){
        const prm = Sys.WebForms.PageRequestManager.getInstance();
        if (!prm.__wlPrefillBound){
          prm.add_initializeRequest(()=>{ stampValuesIntoForm(); });
          prm.add_endRequest(()=>{ applyPrefill(); });
          prm.__wlPrefillBound = true;
        }
      }
    }catch{}
  }

  /* ---------- persist on user edits too ---------- */
  function wireFieldPersistence(){
    const ids = [
      'ctl00_PageBody_RemittanceAdviceTextBox',
      'ctl00_PageBody_PaymentAmountTextBox',
      'ctl00_PageBody_BillingAddressTextBox',
      'ctl00_PageBody_AddressDropdownList',
      'ctl00_PageBody_PostalCodeTextBox'
    ];
    ids.forEach(id=>{
      const el = $(id);
      if (el && !el.__wlBound){
        const saveNow = ()=>{
          const rem = $('ctl00_PageBody_RemittanceAdviceTextBox');
          const amt = $('ctl00_PageBody_PaymentAmountTextBox');
          const pref = loadPref();
          savePref({
            invoices: rem ? normalizeInvoices(rem.value) : (pref.invoices||''),
            total:    amt ? amt.value : (pref.total||'')
          });
        };
        el.addEventListener('input',  saveNow);
        el.addEventListener('change', saveNow);
        el.__wlBound = true;
      }
    });
    window.addEventListener('beforeunload', ()=> {
      const rem = $('ctl00_PageBody_RemittanceAdviceTextBox');
      const amt = $('ctl00_PageBody_PaymentAmountTextBox');
      const pref = loadPref();
      savePref({
        invoices: rem ? normalizeInvoices(rem.value) : (pref.invoices||''),
        total:    amt ? amt.value : (pref.total||'')
      });
    });
  }

  /* ---------- optional one-time amount postback ---------- */
  function triggerAmountChangeOnce(){
    const pref = loadPref(); if (!pref.total) return;
    if (window.__wlAmtPosted) return;
    const amt = $('ctl00_PageBody_PaymentAmountTextBox'); if (!amt) return;
    window.__wlAmtPosted = true;
    setTimeout(()=> { amt.dispatchEvent(new Event('change', { bubbles:true })); }, 60);
  }

  /* ---------- tiny summary bar (only when params exist) ---------- */
  function injectCSS(){
    if (document.getElementById('wl-pay-summary-css')) return;
    const css = `
      .wl-pay-summary{
        display:flex; gap:10px; align-items:center; justify-content:space-between;
        background:#f8fafc; border:1px solid #e5e7eb; border-radius:14px; padding:12px 14px; margin:8px 0 14px;
      }
      .wl-pay-summary .left{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
      .wl-pill{ border:1px solid #e5e7eb; background:#fff; border-radius:999px; padding:6px 10px; font-weight:700; font-size:12px; }
      .wl-action{ border:1px solid #e5e7eb; background:#fff; border-radius:10px; padding:8px 10px; font-weight:800; cursor:pointer; }
    `;
    const s = document.createElement('style'); s.id='wl-pay-summary-css'; s.textContent = css; document.head.appendChild(s);
  }

  function renderSummary(pref){
    const host = document.querySelector('.bodyFlexItem .epi-form-group-acctPayment');
    if (!host) return;
    let box = document.getElementById('wlPaySummary');
    if (!box){
      box = document.createElement('div');
      box.id = 'wlPaySummary';
      box.className = 'wl-pay-summary';
      host.parentNode.insertBefore(box, host);
    }
    const invList = String(pref.invoices||'').split(',').filter(Boolean);
    const totalStr = pref.total || '';
    box.innerHTML = `
      <div class="left">
        <div class="wl-pill">${invList.length} invoice${invList.length===1?'':'s'}</div>
        ${totalStr ? `<div class="wl-pill">Total ${totalStr}</div>` : ``}
        ${invList.length ? `<div class="wl-pill" title="${pref.invoices}">${invList.slice(0,4).join(', ')}${invList.length>4?'…':''}</div>` : ``}
      </div>
      <div class="right">
        <button type="button" class="wl-action" data-act="clear-remit">Clear list</button>
        <a class="wl-action" href="/Invoices_r.aspx">Back to invoices</a>
      </div>
    `;
    box.querySelector('[data-act="clear-remit"]')?.addEventListener('click', ()=>{
      const rem = $('ctl00_PageBody_RemittanceAdviceTextBox');
      if (rem){ rem.value=''; rem.defaultValue=''; }
      const pref2 = loadPref(); savePref({ invoices:'', total: (pref2.total||'') });
      renderSummary(loadPref());
    });
  }

  /* ---------- boot (only runs because HAS_PARAMS=true) ---------- */
  injectCSS();
  wireAjax();
  wireFieldPersistence();
  applyPrefill();
  triggerAmountChangeOnce();

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', applyPrefill, { once:true });
  }
})();











































/* ===========================================
   Woodson — AccountPayment instrumentation
   Levels: 0=error,1=warn,2=info,3=debug
   Console prefix: [AP]
   =========================================== */
(function(){
  'use strict';
  if (!/AccountPayment_r\.aspx/i.test(location.pathname)) return;

  /* ---------- logger (shared) ---------- */
  const LVL = { error:0, warn:1, info:2, debug:3 };
  const stored = sessionStorage.getItem('__WL_AP_LOG_LVL');
  let LOG = (stored !== null ? Number(stored) : LVL.info);
  const S = (v)=> (v===undefined||v===null) ? '(nil)' : v;

  function gcs(el){ try{ return el ? getComputedStyle(el) : null; }catch{ return null; } }
  function nodeInfo(el){
    const cs = gcs(el) || {};
    return {
      present: !!el,
      id: el?.id || '',
      tag: el?.tagName || '',
      display: el ? (el.style?.display || '(inline)') + ` / comp:${cs.display||''}` : '(n/a)',
      visibility: el ? (el.style?.visibility || '(auto)') + ` / comp:${cs.visibility||''}` : '(n/a)',
      inDOM: !!(el && el.isConnected),
      offsetParent: !!(el && el.offsetParent),
      offsetH: el?.offsetHeight || 0,
      classes: el?.className || ''
    };
  }

  const log = {
    error(...a){ if (LOG>=LVL.error) console.error('[AP]', ...a); },
    warn (...a){ if (LOG>=LVL.warn ) console.warn ('[AP]', ...a); },
    info (...a){ if (LOG>=LVL.info ) console.log  ('[AP]', ...a); },
    debug(...a){ if (LOG>=LVL.debug) console.log  ('[AP]', ...a); },
  };

  function setLevel(n){ LOG = Number(n)||0; sessionStorage.setItem('__WL_AP_LOG_LVL', String(LOG)); log.info('Log level set to', LOG); }
  function snap(){
    const ids = {
      rbCheck: 'ctl00_PageBody_RadioButton_PayByCheck',
      rbCredit:'ctl00_PageBody_RadioButton_PayByCredit',
      amount:  'ctl00_PageBody_PaymentAmountTextBox',
      billBox: 'ctl00_PageBody_BillingAddressTextBox',
      billWrap:'ctl00_PageBody_BillingAddressContainer',
      submit:  'ctl00_PageBody_MakePaymentPanel'
    };
    const r = {};
    for (const k in ids){ r[k] = nodeInfo(document.getElementById(ids[k])); }
    const grid = document.getElementById('wlFormGrid');
    r.wlFormGrid = nodeInfo(grid);
    r.billWrapParent = (function(){
      const bw = document.getElementById(ids.billWrap) || document.getElementById(ids.billBox)?.closest('.epi-form-group-acctPayment');
      return { parentId: bw?.parentElement?.id || '(none)', parentClasses: bw?.parentElement?.className || '' };
    })();
    console.log('[AP] SNAPSHOT', r);
    return r;
  }
  window.WLPayDiag = { setLevel, snap, getLevel:()=>LOG, LVL };

  log.info('AP logger ready. Level:', LOG);
})();

/* =========================================================
   POLISH / LAYOUT MODULE  (with detailed instrumentation)
   ========================================================= */
(function(){
  'use strict';
  if (!/AccountPayment_r\.aspx/i.test(location.pathname)) return;
  const LOG = window.WLPayDiag?.getLevel?.() ?? 2;
  const LVL = window.WLPayDiag?.LVL;
  const log = {
    error(...a){ if (LOG>=LVL.error) console.error('[AP:LAY]', ...a); },
    warn (...a){ if (LOG>=LVL.warn ) console.warn ('[AP:LAY]', ...a); },
    info (...a){ if (LOG>=LVL.info ) console.log  ('[AP:LAY]', ...a); },
    debug(...a){ if (LOG>=LVL.debug) console.log  ('[AP:LAY]', ...a); },
  };

  /* =============== CSS =============== */
  (function injectCSS(){
    if (document.getElementById('wl-ap-polish-css')) { log.debug('injectCSS: already present'); return; }
    const css = `
      :root{ --wl-bg:#f6f7fb; --wl-card:#fff; --wl-border:#e5e7eb;
             --wl-text:#0f172a; --wl-sub:#475569; --wl-brand:#6b0016; --wl-focus:#93c5fd; }
      .bodyFlexContainer{ background:var(--wl-bg); }

      .wl-shell{ display:grid; gap:18px; grid-template-areas:"left right" "tx tx"; }
      @media(min-width:1200px){ .wl-shell{ grid-template-columns: 1fr 380px; } }
      @media(min-width:1024px) and (max-width:1199px){ .wl-shell{ grid-template-columns: 1fr 360px; } }
      @media(max-width:1023px){ .wl-shell{ grid-template-areas:"left" "right" "tx"; grid-template-columns: 1fr; } }

      #wlLeftCard{ grid-area:left; }  #wlRightCard{ grid-area:right; }  #wlTxCard{ grid-area:tx; }

      .wl-card{ background:var(--wl-card); border:1px solid var(--wl-border);
                border-radius:16px; box-shadow:0 6px 18px rgba(15,23,42,.06); }
      .wl-card-head{ padding:14px 18px; border-bottom:1px solid var(--wl-border); font-weight:900; }
      .wl-card-body{ padding:16px 18px; }

      .wl-form-grid{ display:grid; gap:18px 18px; }
      @media(min-width:768px){ .wl-form-grid{ grid-template-columns: 1fr 1fr; } }
      .wl-item{ margin:0; padding:0; border:none; background:transparent; }
      .wl-span-2{ grid-column: 1 / -1; }

      .wl-field{ display:grid; gap:8px; }
      @media(min-width:640px){ .wl-field{ grid-template-columns: 200px 1fr; align-items:center; }
                                .wl-lab{ text-align:right; padding-right:14px; } }
      .wl-lab{ color:var(--wl-sub); font-weight:800; }
      .wl-ctl input.form-control, .wl-ctl select.form-control, .wl-ctl textarea.form-control{
        border:1px solid var(--wl-border); border-radius:12px; padding:12px 14px; min-height:42px;
      }
      .wl-help{ color:var(--wl-sub); font-size:12px; margin-top:4px; }

      .wl-chips{ display:flex; gap:10px; flex-wrap:wrap; margin-top:8px; }
      .wl-chipbtn{ border:1px solid var(--wl-border); border-radius:999px; padding:7px 12px; background:#fff; font-weight:800; font-size:12px; cursor:pointer; }

      .wl-summary{ display:flex; flex-direction:column; gap:12px; }
      .wl-pillrow{ display:flex; gap:8px; flex-wrap:wrap; }
      .wl-pill{ border:1px solid var(--wl-border); background:#fff; border-radius:999px; padding:6px 10px; font-weight:800; font-size:12px; }
      .wl-summarylist{ display:grid; gap:8px; }
      .wl-row{ display:grid; grid-template-columns: 120px 1fr; gap:8px; }
      .wl-key{ color:#334155; font-weight:800; } .wl-val{ color:#0f172a; } .wl-val small{ color:#475569; }
      .wl-cta{ appearance:none; border:none; border-radius:12px; padding:12px 16px; background:var(--wl-brand); color:#fff; font-weight:900; cursor:pointer; width:100%; }
      .wl-cta:focus-visible{ outline:0; box-shadow:0 0 0 3px var(--wl-focus); }
      .wl-link{ background:none; border:none; padding:0; color:#0ea5e9; font-weight:800; cursor:pointer; }

      #ctl00_PageBody_BillingAddressContainer.wl-force-show{ display:block !important; visibility:visible !important; }
      .epi-form-group-acctPayment.wl-force-show{ display:block !important; visibility:visible !important; }

      #ctl00_PageBody_RadioButton_PayByCheck{ display:inline-block !important; }
      label[for="ctl00_PageBody_RadioButton_PayByCheck"]{ display:inline-block !important; }
    `;
    const el = document.createElement('style'); el.id='wl-ap-polish-css'; el.textContent = css; document.head.appendChild(el);
    log.info('injectCSS: styles injected');
  })();

  /* =============== helpers =============== */
  const $  = (sel, root=document)=> root.querySelector(sel);
  const $$ = (sel, root=document)=> Array.from(root.querySelectorAll(sel));
  const byId = (id)=> document.getElementById(id);
  function parseMoney(s){ const v=parseFloat(String(s||'').replace(/[^0-9.\-]/g,'')); return Number.isFinite(v)?v:0; }
  function formatUSD(n){ return Number(n||0).toLocaleString(undefined,{style:'currency',currency:'USD'}); }

  function waitFor(sel, {tries=30, interval=120}={}){
    return new Promise(resolve=>{
      let n=0; (function tick(){
        const el = document.querySelector(sel);
        if (el) { resolve(el); }
        else if (++n>=tries) { resolve(null); }
        else { setTimeout(tick, interval); }
      })();
    });
  }

  // Visible radios only; do NOT force a selection here (guards handle defaults)
  function ensurePayByCheckVisibleAndSelected(){
    const wrap = byId('ctl00_PageBody_MakePaymentPanel')?.previousElementSibling;
    if (wrap){
      wrap.style.removeProperty('display');
      wrap.classList.add('wl-item','wl-span-2');
    }
    const rbCheck  = byId('ctl00_PageBody_RadioButton_PayByCheck');
    const lblCheck = document.querySelector('label[for="ctl00_PageBody_RadioButton_PayByCheck"]');
    if (rbCheck){
      rbCheck.style.removeProperty('display');
      // NOTE: do not set checked here
      log.debug('ensurePayByCheckVisibleAndSelected: radios visible');
    } else {
      log.warn('ensurePayByCheckVisibleAndSelected: rbCheck not found');
    }
    if (lblCheck){
      lblCheck.style.removeProperty('display');
      lblCheck.style.visibility = 'visible';
    }
  }

  function ensureBillingVisible(){
    const grid = byId('wlFormGrid') || document;
    const billContainer = byId('ctl00_PageBody_BillingAddressContainer') ||
                          byId('ctl00_PageBody_BillingAddressTextBox')?.closest('.epi-form-group-acctPayment');
    if (billContainer){
      const before = { parent: billContainer.parentElement?.id || '(none)' };
      billContainer.classList.add('wl-force-show');
      billContainer.style.removeProperty('display');
      if (grid && !grid.contains(billContainer)) grid.appendChild(billContainer);
      const after  = { parent: billContainer.parentElement?.id || '(none)' };
      log.info('ensureBillingVisible: ensured', { before, after, id: billContainer.id });
      return true;
    }
    log.warn('ensureBillingVisible: NOT FOUND');
    return false;
  }

  /* =============== build layout =============== */
  async function upgradeLayout(){
    log.info('upgradeLayout: start');

    const page = $('.bodyFlexContainer'); if (!page) { log.warn('upgradeLayout: page container missing'); return; }

    // Shell
    let shell = $('.wl-shell');
    if (!shell){
      const firstLeft = $('.bodyFlexItem > .float-left') || $('.bodyFlexItem');
      shell = document.createElement('div'); shell.className='wl-shell';
      firstLeft?.parentNode?.insertBefore(shell, firstLeft);
      if (firstLeft) firstLeft.style.display='none';
      log.debug('shell: created');
    } else {
      log.debug('shell: exists');
    }

    // Left card
    let leftCard = byId('wlLeftCard');
    if (!leftCard){
      leftCard = document.createElement('div');
      leftCard.id = 'wlLeftCard';
      leftCard.className = 'wl-card';
      leftCard.innerHTML = `<div class="wl-card-head">Payment details</div><div class="wl-card-body"><div id="wlFormGrid" class="wl-form-grid"></div></div>`;
      shell.appendChild(leftCard);
      log.debug('leftCard: created');
    }

    const grid = byId('wlFormGrid');

    // Right card
    let rightCard = byId('wlRightCard');
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
      log.debug('rightCard: created');
    }

    // Full-width transactions card
    let txCard = byId('wlTxCard');
    if (!txCard){
      txCard = document.createElement('div');
      txCard.id = 'wlTxCard';
      txCard.className = 'wl-card';
      txCard.innerHTML = `<div class="wl-card-head">Recent transactions</div><div class="wl-card-body" id="wlTxBody"></div>`;
      shell.appendChild(txCard);
      log.debug('txCard: created');
    }

    // Grab legacy groups
    const grp = {
      owing: byId('ctl00_PageBody_AmountOwingLiteral')?.closest('.epi-form-group-acctPayment') || null,
      amount: byId('ctl00_PageBody_PaymentAmountTextBox')?.closest('.epi-form-group-acctPayment') || null,
      addrDDL: byId('ctl00_PageBody_AddressDropdownList')?.closest('.epi-form-group-acctPayment') || null,
      billAddr: byId('ctl00_PageBody_BillingAddressTextBox')?.closest('.epi-form-group-acctPayment')
                || byId('ctl00_PageBody_BillingAddressContainer') || null,
      zip: byId('ctl00_PageBody_PostalCodeTextBox')?.closest('.epi-form-group-acctPayment') || null,
      email: byId('ctl00_PageBody_EmailAddressTextBox')?.closest('.epi-form-group-acctPayment') || null,
      notes: byId('ctl00_PageBody_NotesTextBox')?.closest('.epi-form-group-acctPayment') || null,
      remit: byId('ctl00_PageBody_RemittanceAdviceTextBox')?.closest('.epi-form-group-acctPayment') || null,
      payWrap: byId('ctl00_PageBody_MakePaymentPanel')?.previousElementSibling || null
    };
    log.debug('groups found', Object.fromEntries(Object.entries(grp).map(([k,v])=>[k, !!v])));

    // Tidy groups (label+control), keep native radios intact
    Object.entries(grp).filter(([,v])=>!!v).forEach(([k,group])=>{
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
        log.debug('tidy group', k);
      }
      group.style.removeProperty('display');
    });

    // Place fields
    [grp.owing, grp.amount, grp.addrDDL, grp.billAddr, grp.zip, grp.email, grp.notes, grp.remit, grp.payWrap]
      .filter(Boolean).forEach(el=>{ if (!grid.contains(el)) { grid.appendChild(el); log.debug('moved to grid', el.id||'(no-id)'); }});
    if (grp.payWrap) grp.payWrap.classList.add('wl-span-2');

    // Radios: ensure visible only (selection handled in guards)
    ensurePayByCheckVisibleAndSelected();

    // Amount quick chips
    const amountInput = byId('ctl00_PageBody_PaymentAmountTextBox');
    const owingVal = (function(){ const el = byId('ctl00_PageBody_AmountOwingLiteral'); return el ? parseMoney(el.value || el.textContent) : 0; })();
    if (grp.amount && !grp.amount.querySelector('.wl-chips')){
      const chips = document.createElement('div'); chips.className='wl-chips';
      chips.innerHTML = `<button type="button" class="wl-chipbtn" data-act="fill-owing">Fill: Amount Owing</button><button type="button" class="wl-chipbtn" data-act="clear-amt">Clear Amount</button>`;
      grp.amount.appendChild(chips);
      chips.addEventListener('click',(e)=>{
        const b = e.target.closest('button[data-act]'); if (!b) return;
        log.info('amount chip click', b.dataset.act);
        if (b.dataset.act==='fill-owing' && Number.isFinite(owingVal) && amountInput){
          amountInput.value = owingVal.toFixed(2);
          setTimeout(()=> amountInput.dispatchEvent(new Event('change',{bubbles:true})), 0);
        }else if (b.dataset.act==='clear-amt' && amountInput){
          amountInput.value = '';
          setTimeout(()=> amountInput.dispatchEvent(new Event('change',{bubbles:true})), 0);
        }
        renderSummary();
      });
    }

    // Remittance placeholder
    const rem = byId('ctl00_PageBody_RemittanceAdviceTextBox');
    if (rem && !rem.getAttribute('placeholder')) { rem.setAttribute('placeholder','Comma separated · e.g. INV12345,INV67890'); }

    // Move submit panel into right card (idempotent)
    const submitMount = byId('wlSubmitMount');
    if (submitMount && !submitMount.__wlMoved){
      const realSubmitPanel = $('#ctl00_PageBody_MakePaymentPanel .submit-button-panel');
      if (realSubmitPanel){ submitMount.appendChild(realSubmitPanel); submitMount.__wlMoved = true; log.debug('submit panel moved'); }
    }
    byId('wlProxySubmit')?.addEventListener('click', ()=>{
      const real = $('#wlSubmitMount .submit-button-panel button, #wlSubmitMount .submit-button-panel input[type="submit"], #wlSubmitMount .submit-button-panel input[type="button"]');
      log.info('proxy submit click; found real?', !!real);
      if (real) real.click();
    });

    // Embed full tx panel
    const txBody = byId('wlTxBody');
    if (txBody){
      const txPanel = byId('ctl00_PageBody_accountsTransactionsPanel') || await waitFor('#ctl00_PageBody_accountsTransactionsPanel', {tries:25, interval:120});
      if (txPanel && txPanel.parentNode !== txBody){
        txBody.innerHTML = '';
        txBody.appendChild(txPanel);
        log.info('transactions panel embedded');
      } else {
        log.warn('transactions panel not found or already placed');
      }
    }

    // Ensure Billing is present/visible
    ensureBillingVisible();

    // Summary
    wireSummaryBindings();
    renderSummary();

    log.info('upgradeLayout: end');
  }

  /* =============== summary (right card) =============== */
  function getSummaryData(){
  const byId = (id)=> document.getElementById(id);
  const amtEl   = byId('ctl00_PageBody_PaymentAmountTextBox');
  const addrDDL = byId('ctl00_PageBody_AddressDropdownList');
  const billEl  = byId('ctl00_PageBody_BillingAddressTextBox');
  const zipEl   = byId('ctl00_PageBody_PostalCodeTextBox');
  const emailEl = byId('ctl00_PageBody_EmailAddressTextBox');
  const remEl   = byId('ctl00_PageBody_RemittanceAdviceTextBox');

  const totalStr = (amtEl?.value || '').trim();
  const addrSelText = (addrDDL && addrDDL.value !== '-1')
    ? (addrDDL.options[addrDDL.selectedIndex]?.text || '')
    : '';
  const billing = (billEl?.value || '').trim();
  const zip     = (zipEl?.value || '').trim();
  const email   = (emailEl?.value || '').trim();

  const invs = String((remEl?.value || '').trim())
    .split(/[,\n\r\t ]+/)
    .map(x => x.trim())
    .filter(Boolean);

  return {
    total: totalStr ? formatUSD(parseMoney(totalStr)) : '',
    addrSelText, billing, zip, email,
    invCount: invs.length,
    invs
  };
}


  function renderSummary(){
    const byId = (id)=> document.getElementById(id);
    const pills = byId('wlSummaryPills');
    const list  = byId('wlSummaryList');
    if (!pills || !list) { log.warn('renderSummary: mounts missing'); return; }
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
    const btn = byId('wlShowAllInv');
    if (btn){
      btn.addEventListener('click', ()=>{
        const el = byId('wlRemShort'); if (!el) return;
        if (el.dataset.expanded==='1'){ el.textContent = remShort; el.dataset.expanded='0'; btn.textContent='View all'; }
        else { el.textContent = d.invs.join(', '); el.dataset.expanded='1'; btn.textContent='Collapse'; }
      });
    }
    log.debug('renderSummary: data', d);
  }

  function wireSummaryBindings(){
    if (wireSummaryBindings.__bound) return;
    wireSummaryBindings.__bound = true;
    [
      'ctl00_PageBody_PaymentAmountTextBox',
      'ctl00_PageBody_AddressDropdownList',
      'ctl00_PageBody_BillingAddressTextBox',
      'ctl00_PageBody_PostalCodeTextBox',
      'ctl00_PageBody_EmailAddressTextBox',
      'ctl00_PageBody_RemittanceAdviceTextBox'
    ].forEach(id=>{
      const el = document.getElementById(id);
      if (!el || el.__wlSumBound) return;
      el.addEventListener('input', renderSummary);
      el.addEventListener('change', renderSummary);
      el.__wlSumBound = true;
      log.debug('wireSummaryBindings: bound', id);
    });
  }

  /* =============== MS AJAX re-apply =============== */
  (function wireAjax(){
    try{
      if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager){
        const prm = Sys.WebForms.PageRequestManager.getInstance();
        if (!prm.__wlPolishBound){
          let seq = 0;
          prm.add_initializeRequest(function(sender, args){
            seq++; const src = args?.get_postBackElement?.();
            log.info(`MSAjax init #${seq}`, { srcId: src?.id || '(unknown)', srcName: src?.name || '' });
          });
          prm.add_endRequest(function(sender, args){
            const err = args?.get_error?.() || null;
            if (err){ log.error('MSAjax end error:', err); if (args?.set_errorHandled) args.set_errorHandled(true); }
            log.info('MSAjax end   #' + seq + ' — re-applying layout');
            upgradeLayout();
            ensurePayByCheckVisibleAndSelected(); // visibility only
            ensureBillingVisible();
            window.WLPayDiag?.snap?.();
          });
          prm.__wlPolishBound = true;
          log.info('wireAjax: hooks attached');
        } else {
          log.debug('wireAjax: already bound');
        }
      } else {
        log.warn('wireAjax: PageRequestManager not available');
      }
    }catch(e){ log.error('wireAjax exception', e); }
  })();

  /* =============== Boot =============== */
  (function boot(){
    if (document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', ()=>{
        log.info('BOOT (DOMContentLoaded)');
        upgradeLayout();
        ensurePayByCheckVisibleAndSelected(); // visibility only
        window.WLPayDiag?.snap?.();
      }, {once:true});
    } else {
      log.info('BOOT (immediate)');
      upgradeLayout();
      ensurePayByCheckVisibleAndSelected(); // visibility only
      window.WLPayDiag?.snap?.();
    }
  })();
})();

/* ======================================================
   GUARDS MODULE (respect user choice, keep Billing alive)
   ====================================================== */
(function(){
  'use strict';
  if (!/AccountPayment_r\.aspx/i.test(location.pathname)) return;
  const LOG = window.WLPayDiag?.getLevel?.() ?? 2;
  const LVL = window.WLPayDiag?.LVL;
  const log = {
    error(...a){ if (LOG>=LVL.error) console.error('[AP:GRD]', ...a); },
    warn (...a){ if (LOG>=LVL.warn ) console.warn ('[AP:GRD]', ...a); },
    info (...a){ if (LOG>=LVL.info ) console.log  ('[AP:GRD]', ...a); },
    debug(...a){ if (LOG>=LVL.debug) console.log  ('[AP:GRD]', ...a); },
  };

  const IDS = {
    rbCheck: 'ctl00_PageBody_RadioButton_PayByCheck',
    rbCredit:'ctl00_PageBody_RadioButton_PayByCredit',
    amount:  'ctl00_PageBody_PaymentAmountTextBox',
    billBox: 'ctl00_PageBody_BillingAddressTextBox',
    billWrap:'ctl00_PageBody_BillingAddressContainer'
  };

  function readPayMode(){
    const cr  = document.getElementById(IDS.rbCredit);
    return (cr && cr.checked) ? 'credit' : 'check';
  }

  // Default to check only if neither selected; otherwise honor user choice
  function setPayByCheckDefaultIfUnset(evtLabel){
    const chk = document.getElementById(IDS.rbCheck);
    const cr  = document.getElementById(IDS.rbCredit);
    if (!chk && !cr){ log.warn('setPayByCheckDefaultIfUnset: radios missing'); return false; }

    if (cr && cr.checked){
      ensureShadowPayBy('credit');
      log.info('setPayByCheckDefaultIfUnset:', evtLabel||'(boot)', { honored:'credit' });
      return true;
    }
    if (chk && chk.checked){
      ensureShadowPayBy('check');
      log.info('setPayByCheckDefaultIfUnset:', evtLabel||'(boot)', { honored:'check' });
      return true;
    }
    if (chk){
      chk.checked = true;
      if (cr) cr.checked = false;
      ensureShadowPayBy('check');
      log.info('setPayByCheckDefaultIfUnset:', evtLabel||'(boot)', { set:'check' });
      return true;
    }
    return false;
  }

  // Hidden input mirrors the CURRENT pay mode (does not force a mode)
  function ensureShadowPayBy(mode){
    const form = document.forms[0]; if (!form) { log.warn('ensureShadowPayBy: no form'); return; }
    let h = document.getElementById('wlPayByShadow');
    if (!h){
      h = document.createElement('input');
      h.type = 'hidden';
      h.id   = 'wlPayByShadow';
      h.name = 'ctl00$PageBody$PayBy';
      form.appendChild(h);
      log.debug('ensureShadowPayBy: created');
    }
    const m = mode || readPayMode();
    h.value = (m === 'credit') ? 'RadioButton_PayByCredit' : 'RadioButton_PayByCheck';
    log.debug('ensureShadowPayBy: value set', h.value);
  }
  function removeShadowPayBy(){
    const h = document.getElementById('wlPayByShadow');
    if (h){ h.remove(); log.debug('removeShadowPayBy: removed'); }
  }
  // expose for bridge
  window.ensureShadowPayBy = ensureShadowPayBy;
  window.WLPayMode = { readPayMode, ensureShadowPayBy };

  function showBilling(){
    const wrap = document.getElementById(IDS.billWrap) ||
                 document.getElementById(IDS.billBox)?.closest('.epi-form-group-acctPayment');
    if (wrap){
      const before = { parent: wrap.parentElement?.id || '(none)' };
      wrap.style.removeProperty('display');
      wrap.classList.add('wl-force-show');
      const grid = document.getElementById('wlFormGrid');
      if (grid && !grid.contains(wrap)) grid.appendChild(wrap);
      const after  = { parent: wrap.parentElement?.id || '(none)' };
      log.info('showBilling: ensured', { before, after, id: wrap.id });
      return true;
    }
    log.warn('showBilling: NOT FOUND');
    return false;
  }

  function wireGuards(){
    const amt = document.getElementById(IDS.amount);
    if (amt && !amt.__wlPayGuard){
      // keep shadow in sync (capture phase, before WebForms handlers)
      amt.addEventListener('input',  ()=> ensureShadowPayBy(), true);
      amt.addEventListener('change', ()=> ensureShadowPayBy(), true);
      amt.__wlPayGuard = true;
      log.info('wireGuards: amount capture listeners attached');
    } else {
      log.debug('wireGuards: amount already bound or missing');
    }

    const form = document.forms[0];
    if (form && !form.__wlPayGuard){
      form.addEventListener('submit', ()=>{ log.info('form submit: syncing pay mode'); ensureShadowPayBy(); showBilling(); });
      form.__wlPayGuard = true;
      log.info('wireGuards: form submit guard attached');
    }

    try{
      if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager){
        const prm = Sys.WebForms.PageRequestManager.getInstance();
        if (!prm.__wlPayGuard){
          let seq = 0;
          prm.add_initializeRequest((sender, args)=>{
            seq++; const src = args?.get_postBackElement?.();
            log.info(`GRD init #${seq}`, { srcId: src?.id || '(unknown)', srcName: src?.name || '' });
            ensureShadowPayBy(); // mirror current selection
          });
          prm.add_endRequest((sender, args)=>{
            const err = args?.get_error?.() || null;
            if (err){ log.error('GRD end error:', err); if (args?.set_errorHandled) args.set_errorHandled(true); }
            log.info(`GRD end  #${seq} — re-ensure billing + shadow`);
            ensureShadowPayBy(); // keep mirrored
            showBilling();
            removeShadowPayBy();
            window.WLPayDiag?.snap?.();
          });
          prm.__wlPayGuard = true;
          log.info('wireGuards: MSAjax guards attached');
        } else {
          log.debug('wireGuards: MSAjax already bound');
        }
      } else {
        log.warn('wireGuards: PageRequestManager not available');
      }
    }catch(e){ log.error('wireGuards exception', e); }
  }

  function boot(){
    log.info('GRD BOOT');
    setPayByCheckDefaultIfUnset('boot'); // default only if unset
    ensureShadowPayBy();                 // mirror whatever is selected
    showBilling();
    wireGuards();
    window.WLPayDiag?.snap?.();
  }
  if (document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', boot, {once:true}); }
  else { boot(); }
})();

/* ======================================================
   SUBMIT BRIDGE (proxy to native, respect pay mode)
   ====================================================== */
(function(){
  'use strict';
  if (!/AccountPayment_r\.aspx/i.test(location.pathname)) return;

  const log = (window.WLPayDiag ? {
    info: (...a)=> WLPayDiag.getLevel()>=WLPayDiag.LVL.info && console.log('[AP:BRIDGE]', ...a),
    warn: (...a)=> WLPayDiag.getLevel()>=WLPayDiag.LVL.warn && console.warn('[AP:BRIDGE]', ...a),
    error:(...a)=> WLPayDiag.getLevel()>=WLPayDiag.LVL.error&& console.error('[AP:BRIDGE]', ...a),
    debug:(...a)=> WLPayDiag.getLevel()>=WLPayDiag.LVL.debug&& console.log('[AP:BRIDGE]', ...a),
  } : console);

  // Off-screen (NOT display:none) so gateway hooks still see it
  (function css(){
    if (document.getElementById('wl-submit-bridge-css')) return;
    const s=document.createElement('style'); s.id='wl-submit-bridge-css';
    s.textContent = `.wl-hidden-native{position:absolute!important;left:-20000px!important;top:auto!important;width:1px!important;height:1px!important;overflow:hidden!important;}`;
    document.head.appendChild(s);
  })();

  function restoreSubmitPanel(){
    const nativeCtl = document.querySelector('#ctl00_PageBody_MakePaymentPanel .epi-form-group-acctPayment > div:nth-child(2)');
    const moved = document.querySelector('#wlSubmitMount .submit-button-panel');
    if (nativeCtl && moved && moved.parentNode !== nativeCtl){
      nativeCtl.appendChild(moved);
      log.info('submit panel restored to native container');
    }
    const native = document.querySelector('#ctl00_PageBody_MakePaymentPanel .submit-button-panel');
    if (native && !native.classList.contains('wl-hidden-native')){
      native.classList.add('wl-hidden-native'); // keep in DOM for Forte
      log.debug('native submit panel visually hidden (kept in DOM)');
    }
  }

  function findNativeTrigger(){
    // primary: anything inside the native submit container
    let real = document.querySelector('#ctl00_PageBody_MakePaymentPanel .submit-button-panel button, #ctl00_PageBody_MakePaymentPanel .submit-button-panel input[type="submit"], #ctl00_PageBody_MakePaymentPanel .submit-button-panel input[type="button"], #ctl00_PageBody_MakePaymentPanel .submit-button-panel a');
    // fallback: any likely gateway trigger
    if (!real) real = document.querySelector('[data-gateway="shift4"], [id*="Shift4"], .shift4-button, button[name*="MakePayment"], input[type="submit"][name*="MakePayment"]');
    return real;
  }

  function currentPayMode(){
    const cr = document.getElementById('ctl00_PageBody_RadioButton_PayByCredit');
    return (cr && cr.checked) ? 'credit' : 'check';
  }

  function proxyFire(){
    const mode = currentPayMode();
    try{ window.ensureShadowPayBy?.(); }catch{}
    const real = findNativeTrigger();
    if (real){
      log.info('proxy firing native trigger', { mode, tag: real.tagName, id: real.id, name: real.name, value: real.value });
      real.click(); // Credit → Forte modal; Check → normal postback hooked to this control
      return true;
    }
    // Fallback to __doPostBack if present
    const pb = document.querySelector('#ctl00_PageBody_MakePaymentPanel .submit-button-panel [onclick*="__doPostBack"]');
    if (pb){
      const m = (pb.getAttribute('onclick')||'').match(/__doPostBack\(['"]([^'"]+)['"],\s*['"]([^'"]*)['"]\)/);
      if (m && window.__doPostBack){
        log.info('proxy using __doPostBack', { mode, target: m[1], arg: m[2] });
        window.__doPostBack(m[1], m[2]||'');
        return true;
      }
    }
    // Last resort: submit the form
    const form = document.forms[0];
    if (form){
      log.warn('proxy fallback form.submit()', { mode });
      const ev = new Event('submit', { bubbles:true, cancelable:true });
      form.dispatchEvent(ev);
      if (!ev.defaultPrevented){ form.submit(); }
      return true;
    }
    log.error('proxy could not find any submit mechanism');
    return false;
  }

  function wireProxy(){
    const btn = document.getElementById('wlProxySubmit');
    if (!btn || btn.__wlBridgeBound) return;
    btn.addEventListener('click', proxyFire);
    btn.__wlBridgeBound = true;
    log.info('proxy wired to native submit');
  }

  function afterAjax(){
    restoreSubmitPanel();
    wireProxy();
  }

  function boot(){
    afterAjax();
    try{
      if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager){
        const prm = Sys.WebForms.PageRequestManager.getInstance();
        if (!prm.__wlBridgeBound){
          prm.add_endRequest(()=>{ log.info('bridge endRequest rewire'); afterAjax(); });
          prm.__wlBridgeBound = true;
        }
      }
    }catch(e){ log.warn('bridge: PageRequestManager not available', e); }
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();











































/* =========================
   Woodson — AP UI overrides
   - Back to My Account button
   - Card header colors (Left/Right cards)
   - Hide left sidebar nav
   - 80% width fields on desktop
   ========================= */
(function(){
  'use strict';
  if (!/AccountPayment_r\.aspx/i.test(location.pathname)) return;

  const log = (window.WLPayDiag ? {
    info: (...a)=> WLPayDiag.getLevel()>=WLPayDiag.LVL.info && console.log('[AP:UX]', ...a),
    debug:(...a)=> WLPayDiag.getLevel()>=WLPayDiag.LVL.debug&& console.log('[AP:UX]', ...a),
  } : console);

  /* ---------- CSS overrides ---------- */
  (function injectOverrides(){
    if (document.getElementById('wl-ap-overrides-css')) return;
    const s = document.createElement('style'); s.id = 'wl-ap-overrides-css';
    s.textContent = `
      /* Back button */
      .wl-topbar{ display:flex; justify-content:flex-end; gap:12px; margin:10px 0 6px; }
      .wl-backbtn{
        appearance:none; border:1px solid #6b0016; border-radius:10px;
        padding:8px 12px; background:#6b0016; color:#fff; font-weight:800; cursor:pointer;
        text-decoration:none; line-height:1;
      }
      .wl-backbtn:focus-visible{ outline:0; box-shadow:0 0 0 3px rgba(107,0,22,.25); }

      /* Only color the two card headers you mentioned */
      #wlLeftCard  .wl-card-head,
      #wlRightCard .wl-card-head{
        background:#6b0016 !important;
        color:#fff !important;
      }

      /* Hide the left sidebar nav */
      #ctl00_LeftSidebarContents_MainNav_NavigationMenu{
        display:none !important;
      }

      /* Make form rows 80% width on desktop (>=768px) */
      @media (min-width:768px){
        .wl-form-grid .wl-item .wl-field{
          width:80%;
        }
      }
    `;
    document.head.appendChild(s);
    log.info('Overrides CSS injected');
  })();

  /* ---------- Top "Back to My Account" button ---------- */
  function addBackButton(){
    if (document.getElementById('wlTopBar')) return;

    // Prefer placing right under the existing page header; fallback to top of body container
    const header = document.querySelector('.bodyFlexItem.listPageHeader');
    const host   = header?.parentNode || document.querySelector('.bodyFlexContainer') || document.body;

    const bar = document.createElement('div');
    bar.id = 'wlTopBar';
    bar.className = 'wl-topbar';

    const a = document.createElement('a');
    a.href = 'https://webtrack.woodsonlumber.com/AccountInfo_R.aspx';
    a.className = 'wl-backbtn';
    a.textContent = 'Back to My Account';

    bar.appendChild(a);

    if (header && header.nextSibling){
      host.insertBefore(bar, header.nextSibling);
    } else {
      host.insertBefore(bar, host.firstChild);
    }

    log.info('Back to My Account button added');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', addBackButton, { once:true });
  } else {
    addBackButton();
  }
})();









































/* ===============================
   Woodson — AP inline amount UX
   - Inline "last statement" + chips
   - Slightly tighter desktop spacing
   - Back button text color = white
   =============================== */
(function(){
  'use strict';
  if (!/AccountPayment_r\.aspx/i.test(location.pathname)) return;

  /* ---- CSS overrides ---- */
  (function injectCSS(){
    if (document.getElementById('wl-ap-amount-inline-css')) return;
    const s = document.createElement('style'); s.id = 'wl-ap-amount-inline-css';
    s.textContent = `
      /* Inline actions row below amount input */
      .wl-amt-actions{
        display:flex; align-items:center; flex-wrap:wrap;
        gap:8px; margin-top:6px;
      }
      .wl-amt-actions .wl-chipbtn{
        border:1px solid #e5e7eb; border-radius:999px; padding:6px 10px;
        background:#fff; font-weight:800; font-size:12px; cursor:pointer;
      }
      .wl-amt-actions .wl-inlineradio{
        display:inline-flex; align-items:center; gap:6px; font-weight:800;
      }
      .wl-amt-actions .wl-inlineradio input{ transform:translateY(1px); }

      /* Slightly reduce vertical density on desktop */
      @media (min-width:768px){
        .wl-form-grid{ gap:14px 18px !important; }         /* was 18px 18px */
        .wl-card-body{ padding:12px 16px !important; }     /* was 16px 18px */
        .wl-field{ gap:6px !important; }                   /* was 8px */
      }

      /* Ensure back button text is white in all states */
      #wlTopBar .wl-backbtn,
      #wlTopBar .wl-backbtn:visited,
      #wlTopBar .wl-backbtn:hover,
      #wlTopBar .wl-backbtn:active,
      #wlTopBar .wl-backbtn:focus{
        color:#fff !important;
      }
    `;
    document.head.appendChild(s);
  })();

  /* ---- JS to inline amount actions ---- */
  function placeAmountActions(){
    const amtInput = document.getElementById('ctl00_PageBody_PaymentAmountTextBox');
    if (!amtInput) return;

    // Amount group container (legacy form group we reflowed earlier)
    const amtGroup = amtInput.closest('.epi-form-group-acctPayment') || amtInput.parentElement;
    if (!amtGroup) return;

    // Create a single, idempotent actions row
    let actions = amtGroup.querySelector('#wlAmtActions');
    if (!actions){
      actions = document.createElement('div');
      actions.id = 'wlAmtActions';
      actions.className = 'wl-amt-actions';
      // Insert actions AFTER the first ".wl-field" row if present, else at end of group
      const firstField = amtGroup.querySelector('.wl-field');
      (firstField?.parentNode || amtGroup).insertBefore(actions, firstField ? firstField.nextSibling : null);
    } else {
      actions.innerHTML = ''; // reset (idempotent)
    }

    /* --- Move native "Pay My Last Statement" inline --- */
    const lastRadio  = document.getElementById('lastStatementRadio');
    const lastLabel  = document.getElementById('lastStatementRadioLabel');
    if (lastRadio && lastLabel){
      // Keep their original behavior; just re-home them
      const wrap = document.createElement('label');
      wrap.className = 'wl-inlineradio';
      wrap.setAttribute('for', 'lastStatementRadio');
      wrap.appendChild(lastRadio);     // move input node
      wrap.appendChild(document.createTextNode(lastLabel.textContent || 'Pay My Last Statement'));
      actions.appendChild(wrap);
      // Hide the original label (now redundant) if it still occupies space
      lastLabel.style.display = 'none';
    }

    /* --- Chips: Fill owing / Clear --- */
    // Compute "Amount Owing" from literal
    const owingEl = document.getElementById('ctl00_PageBody_AmountOwingLiteral');
    const owingVal = (function(){
      const s = (owingEl?.value || owingEl?.textContent || '').replace(/[^0-9.\-]/g,'');
      const n = parseFloat(s); return Number.isFinite(n) ? n : 0;
    })();

    // Create fresh chip buttons (we replace any previous .wl-chips block)
    const makeChip = (label, act) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'wl-chipbtn';
      b.dataset.act = act;
      b.textContent = label;
      return b;
    };
    const fillBtn  = makeChip('Fill owing', 'fill-owing');
    const clearBtn = makeChip('Clear', 'clear-amt');
    actions.appendChild(fillBtn);
    actions.appendChild(clearBtn);

    // Wire behavior
    fillBtn.addEventListener('click', function(){
      if (!amtInput) return;
      if (Number.isFinite(owingVal) && owingVal > 0){
        amtInput.value = owingVal.toFixed(2);
        // Trigger server-side onchange (WebForms) if needed
        setTimeout(()=> amtInput.dispatchEvent(new Event('change', { bubbles:true })), 0);
      }
    });
    clearBtn.addEventListener('click', function(){
      if (!amtInput) return;
      amtInput.value = '';
      setTimeout(()=> amtInput.dispatchEvent(new Event('change', { bubbles:true })), 0);
    });

    // Remove any old chips block we previously appended (to avoid duplication)
    const legacyChips = amtGroup.querySelector('.wl-chips');
    if (legacyChips) legacyChips.remove();
  }

  /* ---- boot + (optional) re-apply after WebForms async updates ---- */
  function boot(){
    placeAmountActions();
    // If MS AJAX is present, re-apply after partial postbacks
    try{
      if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager){
        const prm = Sys.WebForms.PageRequestManager.getInstance();
        if (!prm.__wlAmtInlineBound){
          prm.add_endRequest(()=> placeAmountActions());
          prm.__wlAmtInlineBound = true;
        }
      }
    }catch{}
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();






























































































/* ==========================================================
   Woodson — Quick Payment Actions (+ Pay by Invoice & Pay by Job modals)
   Runs only on AccountPayment_r.aspx
   ========================================================== */
(function () {
  'use strict';
  if (!/AccountPayment_r\.aspx/i.test(location.pathname)) return;

  /* ---------- logging ---------- */
  const LOG = (window.WLPayDiag?.getLevel?.() ?? 2);
  const LVL = window.WLPayDiag?.LVL || { error:0, warn:1, info:2, debug:3 };
  const log = {
    error: (...a)=> { if (LOG >= LVL.error) console.error('[AP:WID]', ...a); },
    warn:  (...a)=> { if (LOG >= LVL.warn ) console.warn ('[AP:WID]', ...a); },
    info:  (...a)=> { if (LOG >= LVL.info ) console.log  ('[AP:WID]', ...a); },
    debug: (...a)=> { if (LOG >= LVL.debug) console.log  ('[AP:WID]', ...a); },
  };

  /* ---------- CSS ---------- */
  (function injectCSS(){
    if (document.getElementById('wl-quick-widget-css')) return;
    const css = `
      #wlQuickWidget { grid-column: 1 / -1; }
      .wl-quick {
        border:1px solid #e5e7eb; border-radius:14px; background:#fff;
        padding:12px 14px; box-shadow:0 4px 14px rgba(15,23,42,.06);
      }
      .wl-quick-title { font-weight:900; margin:0 0 8px 0; font-size:14px; color:#0f172a; }
      .wl-quick-row { display:flex; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:6px; }

      .wl-inlineradio { display:inline-flex; align-items:center; gap:8px; font-weight:800; }
      .wl-inlineradio input { transform:translateY(1px); }

      .wl-chipbtn{
        border:1px solid #e5e7eb; border-radius:999px; padding:6px 12px;
        background:#fff; font-weight:800; font-size:12px; cursor:pointer;
      }
      .wl-chipbtn[disabled]{ opacity:.6; cursor:not-allowed; }

      /* Modal shared */
      .wl-modal-backdrop {
        position:fixed; inset:0; background:rgba(15,23,42,.5);
        display:none; z-index:9999;
      }
      .wl-modal-shell {
        position:fixed; inset:0; display:none; z-index:10000;
      }
      .wl-modal-card {
        position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
        background:#fff; border-radius:16px; width:min(1100px,94vw); max-height:86vh;
        box-shadow:0 20px 60px rgba(0,0,0,.25); display:flex; flex-direction:column;
      }
      .wl-modal-head {
        padding:12px 16px; background:#6b0016; color:#fff; font-weight:900;
        display:flex; justify-content:space-between; align-items:center;
        border-radius:16px 16px 0 0;
      }
      .wl-modal-head .right { display:flex; align-items:center; gap:8px; }
      .wl-modal-pill { background:rgba(255,255,255,.16); border:1px solid rgba(255,255,255,.25); border-radius:999px; padding:4px 8px; font-weight:800; }
      .wl-modal-body { padding:12px 16px; overflow:auto; }
      .wl-modal-foot { padding:12px 16px; display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #e5e7eb; }

      .wl-btn {
        border:1px solid #e5e7eb; border-radius:10px; padding:8px 12px; font-weight:800; background:#fff; cursor:pointer;
      }
      .wl-btn:focus-visible { outline:0; box-shadow:0 0 0 3px #93c5fd; }
      .wl-btn-primary { background:#6b0016; color:#fff; border-color:#6b0016; }
      .wl-btn-ghost { background:transparent; color:#fff; border-color:rgba(255,255,255,.35); }

      /* Jobs list inside modal */
      .wl-jobs-list { display:grid; gap:8px; }
      .wl-job-line { display:flex; align-items:center; gap:10px; }
      .wl-job-line input { transform:translateY(1px); }

      /* Slightly tighter spacing on desktop */
      @media (min-width:768px){
        .wl-form-grid{ gap:14px 18px; }
        .wl-field{ gap:6px; width:80%; }
      }
    `;
    const s = document.createElement('style'); s.id='wl-quick-widget-css'; s.textContent = css;
    document.head.appendChild(s);
  })();

  /* ---------- helpers ---------- */
  const $id = (x)=> document.getElementById(x);
  const $1  = (sel,root=document)=> root.querySelector(sel);
  function parseMoney(s){ const v = parseFloat(String(s||'').replace(/[^0-9.\-]/g,'')); return Number.isFinite(v)?v:0; }
  function format2(n){ const v = Number(n||0); return v.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2}); }
  function amtEl(){ return $id('ctl00_PageBody_PaymentAmountTextBox'); }
  function remEl(){ return $id('ctl00_PageBody_RemittanceAdviceTextBox'); }
  function owingVal(){ const el = $id('ctl00_PageBody_AmountOwingLiteral'); return el ? parseMoney(el.value || el.textContent) : 0; }
  function triggerChange(el){ try{ el.dispatchEvent(new Event('change',{bubbles:true})); }catch{} }

  /* ---------- Pay My Last Statement ---------- */
  async function fetchLastStatementAmount_jq(){
    return new Promise((resolve,reject)=>{
      try{
        window.jQuery.ajax({
          url:'https://webtrack.woodsonlumber.com/Statements_R.aspx',
          method:'GET',
          success:(data)=> {
            try{
              const $ = window.jQuery;
              const closing = $(data).find('tr#ctl00_PageBody_StatementsDataGrid_ctl00__0 td[data-title="Closing Balance"]').text().trim();
              resolve(closing || '');
            }catch(e){ reject(e); }
          },
          error:()=>reject(new Error('Ajax error'))
        });
      }catch(e){ reject(e); }
    });
  }
  async function fetchLastStatementAmount_vanilla(){
    const res = await fetch('https://webtrack.woodsonlumber.com/Statements_R.aspx', { credentials:'include' });
    if (!res.ok) throw new Error('HTTP '+res.status);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html,'text/html');
    const td = doc.querySelector('tr#ctl00_PageBody_StatementsDataGrid_ctl00__0 td[data-title="Closing Balance"]');
    return (td?.textContent || '').trim();
  }
  async function onLastStatementChecked(radio, labelSpan){
    if (!radio.checked) return;
    try{
      const closingStr = (window.jQuery ? await fetchLastStatementAmount_jq() : await fetchLastStatementAmount_vanilla());
      if (!closingStr){ alert('Could not find last statement amount.'); return; }
      const amt = amtEl(); const rem = remEl();
      if (labelSpan) labelSpan.textContent = `Pay My Last Statement: ${closingStr}`;
      if (amt){
        const n = parseMoney(closingStr);
        amt.value = Number.isFinite(n) ? format2(n) : closingStr;
        triggerChange(amt);
      }
      if (rem){
        const msg = 'Paying last statement amount';
        const lines = (rem.value||'').split('\n').filter(Boolean);
        if (!lines.includes(msg)) lines.push(msg);
        rem.value = lines.join('\n');
      }
    }catch(e){ console.warn(e); alert('Error fetching data.'); }
  }

  /* ---------- Pay by Invoice (existing) ---------- */
  const TX_PANEL_ID = 'ctl00_PageBody_accountsTransactionsPanel';
  const SESS_TX_OPEN = '__WL_TxModalOpen';

  function ensureTxModalDOM(){
    if ($id('wlTxModal')) return;
    const back = document.createElement('div'); back.id='wlTxModalBackdrop'; back.className='wl-modal-backdrop';
    const shell = document.createElement('div'); shell.id='wlTxModal'; shell.className='wl-modal-shell';
    shell.innerHTML = `
      <div class="wl-modal-card" role="dialog" aria-modal="true" aria-labelledby="wlTxTitle">
        <div class="wl-modal-head">
          <div id="wlTxTitle">Select Invoices</div>
          <div class="right">
            <button type="button" class="wl-btn wl-btn-ghost" id="wlTxCloseX" aria-label="Close">✕</button>
          </div>
        </div>
        <div class="wl-modal-body" id="wlTxModalBody"></div>
        <div class="wl-modal-foot">
          <button type="button" class="wl-btn" id="wlTxCancelBtn">Cancel</button>
          <button type="button" class="wl-btn wl-btn-primary" id="wlTxDoneBtn">Done</button>
        </div>
      </div>`;
    document.body.appendChild(back);
    document.body.appendChild(shell);

    back.addEventListener('click', closeTxModal);
    $id('wlTxCloseX').addEventListener('click', closeTxModal);
    $id('wlTxCancelBtn').addEventListener('click', closeTxModal);
    $id('wlTxDoneBtn').addEventListener('click', closeTxModal);
    document.addEventListener('keydown', (e)=>{ if (e.key==='Escape' && sessionStorage.getItem(SESS_TX_OPEN)==='1') closeTxModal(); });
  }
  function moveTxPanelToModal(){
    const panel = $id(TX_PANEL_ID);
    const host  = $id('wlTxModalBody');
    if (!panel || !host) return false;
    let ph = $id('wlTxReturn');
    if (!ph){ ph = document.createElement('div'); ph.id='wlTxReturn'; panel.parentNode?.insertBefore(ph, panel); }
    host.appendChild(panel);
    return true;
  }
  function restoreTxPanel(){
    const panel = $id(TX_PANEL_ID), ph = $id('wlTxReturn');
    if (panel && ph && ph.parentNode){ ph.parentNode.insertBefore(panel, ph); ph.remove(); }
    else {
      const body = $id('wlTxBody') || $1('#wlTxCard .wl-card-body');
      if (panel && body) body.appendChild(panel);
    }
  }
  function showTxChrome(){ $id('wlTxModalBackdrop').style.display='block'; $id('wlTxModal').style.display='block'; document.body.style.overflow='hidden'; }
  function hideTxChrome(){ const b=$id('wlTxModalBackdrop'), m=$id('wlTxModal'); if(b)b.style.display='none'; if(m)m.style.display='none'; document.body.style.overflow=''; }
  function openTxModal(){
    ensureTxModalDOM();
    if (sessionStorage.getItem(SESS_TX_OPEN)==='1'){ showTxChrome(); return; }
    if (!moveTxPanelToModal()) return;
    showTxChrome();
    sessionStorage.setItem(SESS_TX_OPEN,'1');
    const btn = $id('wlOpenTxModalBtn'); if (btn){ btn.disabled=true; btn.setAttribute('aria-disabled','true'); }
  }
  function closeTxModal(){
    restoreTxPanel();
    hideTxChrome();
    sessionStorage.removeItem(SESS_TX_OPEN);
    const btn = $id('wlOpenTxModalBtn'); if (btn){ btn.disabled=false; btn.removeAttribute('aria-disabled'); btn.focus?.(); }
  }
  function ensureTxModalState(){
    ensureTxModalDOM();
    const wantOpen = sessionStorage.getItem(SESS_TX_OPEN)==='1';
    const panel = $id(TX_PANEL_ID);
    const host  = $id('wlTxModalBody');
    if (wantOpen){
      if (panel && host && panel.parentNode !== host) moveTxPanelToModal();
      showTxChrome();
      const btn = $id('wlOpenTxModalBtn'); if (btn){ btn.disabled=true; btn.setAttribute('aria-disabled','true'); }
    }else{
      if (panel && host && panel.parentNode === host) restoreTxPanel();
      hideTxChrome();
      const btn = $id('wlOpenTxModalBtn'); if (btn){ btn.disabled=false; btn.removeAttribute('aria-disabled'); }
    }
  }

  /* ---------- Pay by Job (NEW modal) ---------- */
  const SESS_JOBS_OPEN = '__WL_JobsModalOpen';
  const SESS_JOBS_SEL  = '__WL_JobsSelection'; // { job: amount, ... }

  function ensureJobsModalDOM(){
    if ($id('wlJobsModal')) return;
    const back = document.createElement('div'); back.id='wlJobsModalBackdrop'; back.className='wl-modal-backdrop';
    const shell = document.createElement('div'); shell.id='wlJobsModal'; shell.className='wl-modal-shell';
    shell.innerHTML = `
      <div class="wl-modal-card" role="dialog" aria-modal="true" aria-labelledby="wlJobsTitle">
        <div class="wl-modal-head">
          <div id="wlJobsTitle">Select Jobs</div>
          <div class="right">
            <span class="wl-modal-pill" id="wlJobsSummary">Selected: $0.00 (0)</span>
            <button type="button" class="wl-btn wl-btn-ghost" id="wlJobsSelectAllBtn">Select all</button>
            <button type="button" class="wl-btn wl-btn-ghost" id="wlJobsClearBtn">Clear</button>
            <button type="button" class="wl-btn wl-btn-ghost" id="wlJobsCloseX" aria-label="Close">✕</button>
          </div>
        </div>
        <div class="wl-modal-body">
          <div class="wl-jobs-list" id="wlJobsList"></div>
        </div>
        <div class="wl-modal-foot">
          <button type="button" class="wl-btn" id="wlJobsCancelBtn">Cancel</button>
          <button type="button" class="wl-btn wl-btn-primary" id="wlJobsDoneBtn">Done</button>
        </div>
      </div>`;
    document.body.appendChild(back);
    document.body.appendChild(shell);

    back.addEventListener('click', closeJobsModal);
    $id('wlJobsCloseX').addEventListener('click', closeJobsModal);
    $id('wlJobsCancelBtn').addEventListener('click', closeJobsModal);
    $id('wlJobsDoneBtn').addEventListener('click', commitJobsSelection);
    $id('wlJobsSelectAllBtn').addEventListener('click', ()=> jobsSelectAll(true));
    $id('wlJobsClearBtn').addEventListener('click', ()=> jobsSelectAll(false));
    document.addEventListener('keydown', (e)=>{ if (e.key==='Escape' && sessionStorage.getItem(SESS_JOBS_OPEN)==='1') closeJobsModal(); });
  }

  async function fetchJobBalances(){
    try{
      const res = await fetch('https://webtrack.woodsonlumber.com/JobBalances_R.aspx',{ credentials:'include' });
      if (!res.ok) throw new Error('HTTP '+res.status);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html,'text/html');
      const rows = Array.from(doc.querySelectorAll('table tr'));
      const out = [];
      rows.forEach(row=>{
        const jobCell = row.querySelector('td[data-title="Job"]');
        const netCell = row.querySelector('td[data-title="Net Amount"]');
        if (jobCell && netCell) out.push({ job: jobCell.textContent.trim(), netAmount: parseMoney(netCell.textContent) });
      });
      return out;
    }catch(e){ console.warn('fetchJobBalances error', e); return []; }
  }

  function jobsUpdateSummary(){
    const list = $id('wlJobsList'); if (!list) return;
    const checks = Array.from(list.querySelectorAll('input[type="checkbox"]'));
    const sel = checks.filter(c=>c.checked);
    const total = sel.reduce((s,c)=> s + parseMoney(c.value), 0);
    const pill = $id('wlJobsSummary'); if (pill) pill.textContent = `Selected: $${format2(total)} (${sel.length})`;
  }

  function jobsSelectAll(state){
    const list = $id('wlJobsList'); if (!list) return;
    list.querySelectorAll('input[type="checkbox"]').forEach(cb=> cb.checked = !!state);
    jobsUpdateSummary();
  }

  async function openJobsModal(){
    ensureJobsModalDOM();
    // Populate list if empty or we want to refresh
    const list = $id('wlJobsList');
    if (!list.dataset.loaded){
      const jobs = await fetchJobBalances();
      list.innerHTML = '';
      if (!jobs || jobs.length === 0){
        const p = document.createElement('p'); p.textContent = 'No job balances found.'; list.appendChild(p);
      } else {
        const frag = document.createDocumentFragment();
        jobs.forEach((job,i)=>{
          const label = document.createElement('label'); label.className='wl-job-line';
          const cb = document.createElement('input'); cb.type='checkbox'; cb.value=String(job.netAmount); cb.dataset.job=job.job; cb.id=`job-${i}`;
          const txt = document.createElement('span'); txt.textContent = `${job.job} — $${format2(job.netAmount)}`;
          label.appendChild(cb); label.appendChild(txt);
          frag.appendChild(label);
        });
        list.appendChild(frag);
        list.dataset.loaded = '1';
      }
      // Pre-check from session
      const prevSel = JSON.parse(sessionStorage.getItem(SESS_JOBS_SEL) || '{}');
      if (prevSel && Object.keys(prevSel).length){
        list.querySelectorAll('input[type="checkbox"]').forEach(cb=>{
          if (prevSel[cb.dataset.job] != null) cb.checked = true;
        });
      }
      list.addEventListener('change', jobsUpdateSummary, { passive:true });
    }
    jobsUpdateSummary();
    // Open chrome
    $id('wlJobsModalBackdrop').style.display='block';
    $id('wlJobsModal').style.display='block';
    document.body.style.overflow='hidden';
    sessionStorage.setItem(SESS_JOBS_OPEN,'1');
    const btn = $id('wlOpenJobsModalBtn'); if (btn){ btn.disabled = true; btn.setAttribute('aria-disabled','true'); }
  }

  function closeJobsModal(){
    $id('wlJobsModalBackdrop').style.display='none';
    $id('wlJobsModal').style.display='none';
    document.body.style.overflow='';
    sessionStorage.removeItem(SESS_JOBS_OPEN);
    const btn = $id('wlOpenJobsModalBtn'); if (btn){ btn.disabled = false; btn.removeAttribute('aria-disabled'); btn.focus?.(); }
  }

  function ensureJobsModalState(){
    ensureJobsModalDOM();
    const open = sessionStorage.getItem(SESS_JOBS_OPEN)==='1';
    if (open){
      $id('wlJobsModalBackdrop').style.display='block';
      $id('wlJobsModal').style.display='block';
      document.body.style.overflow='hidden';
      const btn = $id('wlOpenJobsModalBtn'); if (btn){ btn.disabled = true; btn.setAttribute('aria-disabled','true'); }
      jobsUpdateSummary();
    } else {
      closeJobsModal();
    }
  }

  function commitJobsSelection(){
    const list = $id('wlJobsList'); if (!list){ closeJobsModal(); return; }
    const checks = Array.from(list.querySelectorAll('input[type="checkbox"]'));
    const sel = checks.filter(c=>c.checked);
    // Build selection map
    const newSel = {}; sel.forEach(c=> newSel[c.dataset.job] = parseMoney(c.value));
    const prevSel = JSON.parse(sessionStorage.getItem(SESS_JOBS_SEL) || '{}');

    const prevTotal = Object.values(prevSel).reduce((s,v)=> s + Number(v||0), 0);
    const newTotal  = Object.values(newSel).reduce((s,v)=> s + Number(v||0), 0);

    // Update amount (replace previous job contribution with new)
    const a = amtEl(); if (a){
      const base = parseMoney(a.value);
      const next = Math.max(0, base - prevTotal + newTotal);
      a.value = format2(next);
      triggerChange(a);
    }

    // Update remittance (remove previous JOB lines, add new JOB lines)
    const r = remEl(); if (r){
      const lines = (r.value||'').split('\n');
      const kept = lines.filter(line=>{
        // remove only lines matching previous jobs we added
        return !Object.keys(prevSel).some(job => line.trim().startsWith(`JOB ${job}:`));
      }).filter(Boolean);
      const add = Object.entries(newSel).map(([job,amt])=> `JOB ${job}: $${format2(amt)}`);
      r.value = [...kept, ...add].join('\n');
    }

    // Persist new selection
    sessionStorage.setItem(SESS_JOBS_SEL, JSON.stringify(newSel));
    closeJobsModal();
  }

  /* ---------- Build the widget ---------- */
  async function mountWidget(){
    const grid = $id('wlFormGrid') || $1('.bodyFlexItem') || document.body;
    if (!grid){ log.warn('No grid found for widget'); return; }

    let host = $id('wlQuickWidget');
    if (!host){
      host = document.createElement('div');
      host.id = 'wlQuickWidget';
      host.className = 'wl-item wl-span-2';
      grid.insertBefore(host, grid.firstChild);
    } else {
      host.innerHTML = '';
    }

    host.innerHTML = `
      <div class="wl-quick">
        <div class="wl-quick-title">Quick Payment Actions</div>
        <div class="wl-quick-row" id="wlQuickRow">
          <label class="wl-inlineradio" id="wlLastStmtWrap">
            <input type="radio" id="lastStatementRadio" class="radiobutton" name="balanceOption" />
            <span id="lastStatementRadioText">Pay My Last Statement</span>
          </label>
          <button type="button" class="wl-chipbtn" id="wlFillOwingBtn">Fill Owing</button>
          <button type="button" class="wl-chipbtn" id="wlClearAmtBtn">Clear</button>
          <button type="button" class="wl-chipbtn" id="wlOpenTxModalBtn">Pay by Invoice</button>
          <button type="button" class="wl-chipbtn" id="wlOpenJobsModalBtn">Pay by Job</button>
        </div>
      </div>
    `;

    /* Pay My Last Statement (hide on "Load Cash Account Balance" pages) */
    const hdrText = ($1('.bodyFlexItem.listPageHeader')?.textContent || '').trim();
    const lastWrap = $id('wlLastStmtWrap');
    const lastRadio = $id('lastStatementRadio');
    const lastText = $id('lastStatementRadioText');
    if (/Load Cash Account Balance/i.test(hdrText)){
      lastWrap.style.display = 'none';
    }
    (lastRadio).addEventListener('change', ()=> onLastStatementChecked(lastRadio, lastText));

    /* Fill/Clear */
    $id('wlFillOwingBtn').addEventListener('click', ()=>{
      const v = owingVal(); const a = amtEl();
      if (a && v > 0){ a.value = format2(v); triggerChange(a); }
    });
    $id('wlClearAmtBtn').addEventListener('click', ()=>{ const a = amtEl(); if (!a) return; a.value=''; triggerChange(a); });

    /* Invoices modal */
    ensureTxModalDOM();
    $id('wlOpenTxModalBtn').addEventListener('click', openTxModal);
    ensureTxModalState();

    /* Jobs modal */
    ensureJobsModalDOM();
    $id('wlOpenJobsModalBtn').addEventListener('click', openJobsModal);
    ensureJobsModalState();

    log.info('Quick Payment Actions mounted (with Invoice & Jobs modals)');
  }

  /* ---------- Boot + MS AJAX handling ---------- */
  function boot(){
    mountWidget();
    try{
      if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager){
        const prm = window.Sys.WebForms.PageRequestManager.getInstance();
        if (!prm.__wlQuickWidBound){
          prm.add_endRequest(()=> { mountWidget(); ensureTxModalState(); ensureJobsModalState(); });
          prm.__wlQuickWidBound = true;
        }
      }
    }catch{} // ok
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();

