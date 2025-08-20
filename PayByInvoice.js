
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











































(function(){
  'use strict';
  if (!/AccountPayment_r\.aspx/i.test(location.pathname)) return;

  /* =============== CSS =============== */
  (function injectCSS(){
    if (document.getElementById('wl-ap-polish-css')) return;
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

      /* When we must force Billing Address visible */
      #ctl00_PageBody_BillingAddressContainer.wl-force-show{ display:block !important; visibility:visible !important; }
      /* If the container id isn't present, fall back to the group wrapper */
      .epi-form-group-acctPayment.wl-force-show{ display:block !important; visibility:visible !important; }

      /* Trim verbose blurbs a bit */
      .wl-compact .descriptionMessage{ display:none !important; }

      /* Recent transactions: once embedded, we keep all internal content (no removals) */
    `;
    const el = document.createElement('style'); el.id='wl-ap-polish-css'; el.textContent = css; document.head.appendChild(el);
  })();

  /* =============== helpers =============== */
  const $  = (sel, root=document)=> root.querySelector(sel);
  const $$ = (sel, root=document)=> Array.from(root.querySelectorAll(sel));
  const byId = (id)=> document.getElementById(id);
  function parseMoney(s){ const v=parseFloat(String(s||'').replace(/[^0-9.\-]/g,'')); return Number.isFinite(v)?v:0; }
  function formatUSD(n){ return Number(n||0).toLocaleString(undefined,{style:'currency',currency:'USD'}); }
  function normalizeInvoices(str){ return String(str||'').split(/[,\n\r\t ]+/).map(x=>x.trim()).filter(Boolean).map(x=>`INV${x.replace(/^INV\s*/i,'')}`).join(','); }

  function waitFor(sel, {tries=30, interval=120}={}){
    return new Promise(resolve=>{
      let n=0; (function tick(){
        const el = document.querySelector(sel);
        if (el) return resolve(el);
        if (++n>=tries) return resolve(null);
        setTimeout(tick, interval);
      })();
    });
  }

  /* =============== build layout =============== */
  async function upgradeLayout(){
    const page = $('.bodyFlexContainer'); if (!page) return;

    // Shell
    let shell = $('.wl-shell');
    if (!shell){
      const firstLeft = $('.bodyFlexItem > .float-left') || $('.bodyFlexItem');
      shell = document.createElement('div'); shell.className='wl-shell wl-compact';
      firstLeft?.parentNode?.insertBefore(shell, firstLeft);
      if (firstLeft) firstLeft.style.display='none';
    }

    // Left card
    let leftCard = byId('wlLeftCard');
    if (!leftCard){
      leftCard = document.createElement('div');
      leftCard.id = 'wlLeftCard';
      leftCard.className = 'wl-card';
      leftCard.innerHTML = `<div class="wl-card-head">Payment details</div><div class="wl-card-body"><div id="wlFormGrid" class="wl-form-grid"></div></div>`;
      shell.appendChild(leftCard);
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
    }

    // Full-width transactions card
    let txCard = byId('wlTxCard');
    if (!txCard){
      txCard = document.createElement('div');
      txCard.id = 'wlTxCard';
      txCard.className = 'wl-card';
      txCard.innerHTML = `<div class="wl-card-head">Recent transactions</div><div class="wl-card-body" id="wlTxBody"></div>`;
      shell.appendChild(txCard);
    }

    // Grab legacy groups (re-find every time)
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

    // Tidy groups (label+control)
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
      // If server hid it with inline style, force show
      group.classList.add('wl-force-show');
      group.style.removeProperty('display');
    });

    // Place fields in left grid (idempotent)
    [grp.owing, grp.amount, grp.addrDDL, grp.billAddr, grp.zip, grp.email, grp.notes, grp.remit, grp.payWrap]
      .filter(Boolean).forEach(el=>{ if (!grid.contains(el)) grid.appendChild(el); });

    // Amount quick chips
    const amountInput = byId('ctl00_PageBody_PaymentAmountTextBox');
    const owingVal = (function(){ const el = byId('ctl00_PageBody_AmountOwingLiteral'); return el ? parseMoney(el.value || el.textContent) : 0; })();
    if (grp.amount && !grp.amount.querySelector('.wl-chips')){
      const chips = document.createElement('div'); chips.className='wl-chips';
      chips.innerHTML = `<button type="button" class="wl-chipbtn" data-act="fill-owing">Fill: Amount Owing</button><button type="button" class="wl-chipbtn" data-act="clear-amt">Clear Amount</button>`;
      grp.amount.appendChild(chips);
      chips.addEventListener('click',(e)=>{
        const b = e.target.closest('button[data-act]'); if (!b) return;
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
    if (rem && !rem.getAttribute('placeholder')) rem.setAttribute('placeholder','Comma separated · e.g. INV12345,INV67890');

    // Move submit panel into right card (idempotent)
    const submitMount = byId('wlSubmitMount');
    if (submitMount && !submitMount.__wlMoved){
      const realSubmitPanel = $('#ctl00_PageBody_MakePaymentPanel .submit-button-panel');
      if (realSubmitPanel){ submitMount.appendChild(realSubmitPanel); submitMount.__wlMoved = true; }
    }
    byId('wlProxySubmit')?.addEventListener('click', ()=>{
      const real = $('#wlSubmitMount .submit-button-panel button, #wlSubmitMount .submit-button-panel input[type="submit"], #wlSubmitMount .submit-button-panel input[type="button"]');
      if (real) real.click();
    });

    // ✅ Robust: wait for tx panel, then embed whole panel in the tx card
    const txBody = byId('wlTxBody');
    if (txBody){
      const txPanel = byId('ctl00_PageBody_accountsTransactionsPanel') || await waitFor('#ctl00_PageBody_accountsTransactionsPanel', {tries:25, interval:120});
      if (txPanel && txPanel.parentNode !== txBody){
        txBody.innerHTML = '';            // clear body
        txBody.appendChild(txPanel);      // move entire native panel inside
        // do NOT remove headers; let native content render intact
      }
    }

    // Ensure Billing Address is visible (server sometimes hides on amount change)
    const billContainer = byId('ctl00_PageBody_BillingAddressContainer') ||
                          byId('ctl00_PageBody_BillingAddressTextBox')?.closest('.epi-form-group-acctPayment');
    if (billContainer){
      billContainer.classList.add('wl-force-show');
      billContainer.style.removeProperty('display');
      if (!grid.contains(billContainer)) grid.appendChild(billContainer);
    }

    // Summary
    wireSummaryBindings();
    renderSummary();
  }

  /* =============== summary (right card) =============== */
  function getSummaryData(){
    const amtEl = byId('ctl00_PageBody_PaymentAmountTextBox');
    const addrDDL = byId('ctl00_PageBody_AddressDropdownList');
    const billEl = byId('ctl00_PageBody_BillingAddressTextBox');
    const zipEl = byId('ctl00_PageBody_PostalCodeTextBox');
    const emailEl = byId('ctl00_PageBody_EmailAddressTextBox');
    const remEl = byId('ctl00_PageBody_RemittanceAdviceTextBox');

    const totalStr = (amtEl?.value||'').trim();
    const addrSelText = (addrDDL && addrDDL.value !== '-1') ? (addrDDL.options[addrDDL.selectedIndex]?.text || '') : '';
    const billing = (billEl?.value||'').trim();
    const zip = (zipEl?.value||'').trim();
    const email = (emailEl?.value||'').trim();

    const remRaw = (remEl?.value||'').trim();
    const invs = normalizeInvoices(remRaw).split(',').filter(Boolean);

    return { total: totalStr ? formatUSD(parseMoney(totalStr)) : '', addrSelText, billing, zip, email, invCount: invs.length, invs };
  }

  function renderSummary(){
    const pills = byId('wlSummaryPills');
    const list  = byId('wlSummaryList');
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
    const btn = byId('wlShowAllInv');
    if (btn){
      btn.addEventListener('click', ()=>{
        const el = byId('wlRemShort'); if (!el) return;
        if (el.dataset.expanded==='1'){ el.textContent = remShort; el.dataset.expanded='0'; btn.textContent='View all'; }
        else { el.textContent = d.invs.join(', '); el.dataset.expanded='1'; btn.textContent='Collapse'; }
      });
    }
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
      const el = byId(id);
      if (!el || el.__wlSumBound) return;
      el.addEventListener('input', renderSummary);
      el.addEventListener('change', renderSummary);
      el.__wlSumBound = true;
    });
  }

  /* =============== MS AJAX re-apply =============== */
  function wireAjax(){
    try{
      if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager){
        const prm = Sys.WebForms.PageRequestManager.getInstance();
        if (!prm.__wlPolishBound){
          prm.add_endRequest(()=>{ upgradeLayout(); });  // re-run after every partial update
          prm.__wlPolishBound = true;
        }
      }
    }catch{}
  }

  /* =============== Boot =============== */
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>{ upgradeLayout(); wireAjax(); }, {once:true});
  } else {
    upgradeLayout(); wireAjax();
  }
})();











































(function(){
  'use strict';
  if (!/AccountPayment_r\.aspx/i.test(location.pathname)) return;

  /** Silently ensure Pay-By-Check is selected, without triggering a new postback */
  function markPayByCheck(silent = true){
    const rbCheck  = document.getElementById('ctl00_PageBody_RadioButton_PayByCheck');
    const rbCredit = document.getElementById('ctl00_PageBody_RadioButton_PayByCredit');
    if (!rbCheck) return false;

    if (!rbCheck.checked){
      if (silent){
        rbCheck.checked = true;
        if (rbCredit) rbCredit.checked = false;
      } else {
        // Fallback path only (see rescueIfMissing) — triggers its own postback
        rbCheck.click();
      }
      return true;
    }
    return false;
  }

  /** Put the Billing Address group into the left grid and force it visible */
  function ensureBillingVisible(){
    const grid = document.getElementById('wlFormGrid') || document;
    const billContainer =
      document.getElementById('ctl00_PageBody_BillingAddressContainer') ||
      document.getElementById('ctl00_PageBody_BillingAddressTextBox')?.closest('.epi-form-group-acctPayment');

    if (billContainer){
      billContainer.style.removeProperty('display');
      billContainer.classList.add('wl-force-show'); // CSS should set display:block !important
      if (grid && !grid.contains(billContainer)) grid.appendChild(billContainer);
      return true;
    }
    return false;
  }

  /** If billing still didn't render this cycle, do a ONE-TIME radio click to fetch it from server */
  function rescueIfMissing(){
    if (ensureBillingVisible()) return;           // already there
    if (window.__wlRescuedBilling) return;        // prevent loops
    const rbCheck = document.getElementById('ctl00_PageBody_RadioButton_PayByCheck');
    if (rbCheck){
      window.__wlRescuedBilling = true;
      setTimeout(()=> rbCheck.click(), 0);        // triggers server to re-render with billing block
    }
  }

  // Early selection on first paint
  markPayByCheck(true);

  // On DOM ready, try to show billing once more
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureBillingVisible, { once:true });
  } else {
    ensureBillingVisible();
  }

  // Hook MS AJAX so we set the radio BEFORE every async postback, then restore UI AFTER
  try{
    if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager){
      const prm = Sys.WebForms.PageRequestManager.getInstance();
      if (!prm.__wlBillingGuard){
        prm.add_initializeRequest(() => {
          // Critical: mark as checked BEFORE the request goes out, no extra postback
          markPayByCheck(true);
        });
        prm.add_endRequest(() => {
          // Try to place/show it; if missing, one-time rescue by clicking the radio (server-side toggle)
          markPayByCheck(true);
          ensureBillingVisible() || rescueIfMissing();
        });
        prm.__wlBillingGuard = true;
      }
    }
  }catch{}
})();



