
(function () {
  'use strict';
  if (!/AccountPayment_r\.aspx/i.test(location.pathname)) return;

  const $ = (id)=> document.getElementById(id);
  const KEY = 'wl_ap_prefill_v2';

  /* ---------- helpers ---------- */
  function savePref(p){ try{ sessionStorage.setItem(KEY, JSON.stringify(p)); }catch{} }
  function loadPref(){ try{ return JSON.parse(sessionStorage.getItem(KEY) || '{}'); }catch{ return {}; } }
  function parseMoney(s){ const v=parseFloat(String(s||'').replace(/[^0-9.\-]/g,'')); return Number.isFinite(v)?v:0; }

  function normalizeInvoices(str){
    // Accept "3106716,3106139" or "INV3106716,INV3106139" (any spaces)
    return String(str||'')
      .split(/[,\n\r\t ]+/)
      .map(x=>x.trim())
      .filter(Boolean)
      .map(x=>{
        const core = x.replace(/^INV\s*/i,''); // strip any existing INV
        return `INV${core}`;
      })
      .join(',');
  }

  /* ---------- read URL and seed session ---------- */
  const url = new URL(location.href);
  const urlInv = url.searchParams.get('utm_invoices') || '';
  const urlTot = url.searchParams.get('utm_total')    || '';

  if (urlInv || urlTot){
    const existing = loadPref();
    const normalized = normalizeInvoices(urlInv);
    savePref({
      invoices: normalized || existing.invoices || '',
      total:    (urlTot || existing.total || '')
    });
  }

  /* ---------- apply to DOM ---------- */
  function applyPrefill(){
    const pref = loadPref(); if (!pref) return;
    const rem = $('ctl00_PageBody_RemittanceAdviceTextBox');
    if (rem && pref.invoices){
      // Make idempotent: if our normalized list isn’t already present, add it (on its own line if needed)
      const has = rem.value && rem.value.indexOf(pref.invoices) !== -1;
      if (!has){
        rem.value = rem.value ? `${rem.value.replace(/\s+$/,'')}\n${pref.invoices}` : pref.invoices;
      }
      // Also keep the "defaultValue" in sync so some frameworks use it as fallback
      rem.defaultValue = rem.value;
    }

    const amt = $('ctl00_PageBody_PaymentAmountTextBox');
    if (amt && pref.total){
      // Only set if different to avoid infinite onchange loops
      if (amt.value !== pref.total) amt.value = pref.total;
      // Keep defaultValue too (helps on rerenders)
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

  /* ---------- MS AJAX hooks ---------- */
  function wireAjax(){
    try{
      if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager){
        const prm = Sys.WebForms.PageRequestManager.getInstance();
        if (!prm.__wlBound){
          // BEFORE request goes out: make sure our values are present so server rebind keeps them
          prm.add_initializeRequest(function(){ stampValuesIntoForm(); });
          // AFTER update: re-apply in case server template overwrote
          prm.add_endRequest(function(){ applyPrefill(); });
          prm.__wlBound = true;
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
        el.addEventListener('input', ()=> {
          const rem = $('ctl00_PageBody_RemittanceAdviceTextBox');
          const amt = $('ctl00_PageBody_PaymentAmountTextBox');
          const pref = loadPref();
          savePref({
            invoices: rem ? normalizeInvoices(rem.value) : (pref.invoices||''),
            total:    amt ? amt.value : (pref.total||'')
          });
        });
        el.addEventListener('change', ()=> {
          // Just before a postback, many controls fire 'change' — save again
          const rem = $('ctl00_PageBody_RemittanceAdviceTextBox');
          const amt = $('ctl00_PageBody_PaymentAmountTextBox');
          const pref = loadPref();
          savePref({
            invoices: rem ? normalizeInvoices(rem.value) : (pref.invoices||''),
            total:    amt ? amt.value : (pref.total||'')
          });
        });
        el.__wlBound = true;
      }
    });

    // Safety: persist on unload
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

  /* ---------- one-time amount postback (optional) ---------- */
  function triggerAmountChangeOnce(){
    const pref = loadPref(); if (!pref.total) return;
    if (window.__wlAmtPosted) return;
    const amt = $('ctl00_PageBody_PaymentAmountTextBox');
    if (!amt) return;
    window.__wlAmtPosted = true;
    // Give MS AJAX a tick to wire handlers
    setTimeout(()=> {
      amt.dispatchEvent(new Event('change', { bubbles:true }));
    }, 60);
  }

  /* ---------- tiny UX polish ---------- */
  function injectCSS(){
    const css = `
      .wl-pay-summary{
        display:flex; gap:10px; align-items:center; justify-content:space-between;
        background:#f8fafc; border:1px solid #e5e7eb; border-radius:14px; padding:12px 14px; margin:8px 0 14px;
      }
      .wl-pay-summary .left{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
      .wl-pill{ border:1px solid #e5e7eb; background:#fff; border-radius:999px; padding:6px 10px; font-weight:700; font-size:12px; }
      .wl-action{ border:1px solid #e5e7eb; background:#fff; border-radius:10px; padding:8px 10px; font-weight:800; cursor:pointer; }
      .epi-form-group-acctPayment{ border:1px solid #eef0f3; border-radius:12px; padding:10px 12px; margin-bottom:10px; background:#fff; }
      .submit-button-panel .wl-pay-hint{ color:#475569; font-size:12px; margin-top:6px; }
    `;
    const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
  }

  function renderSummary(pref){
    // Place the summary just before the first form group
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
      const amt = $('ctl00_PageBody_PaymentAmountTextBox');
      // You can also clear amount if you want; leaving as-is
      const pref2 = loadPref(); savePref({ invoices:'', total: (pref2.total||'') });
      renderSummary(loadPref());
    });
  }

  /* ---------- boot ---------- */
  injectCSS();
  wireAjax();            // hook early so first postback includes our values
  wireFieldPersistence(); // persist user changes

  // Apply right away (first paint)…
  applyPrefill();
  // …and ensure first server calc (if a total was supplied)
  triggerAmountChangeOnce();

  // Defensive: apply again on DOM ready if this script loaded in <head>
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', applyPrefill, { once:true });
  }
})();






































(function(){
  'use strict';
  if (!/AccountPayment_r\.aspx/i.test(location.pathname)) return;

  /* ========== CSS: airy, compact, two-column ========== */
  (function injectCSS(){
    if (document.getElementById('wl-ap-compact-css')) return;
    const css = `
      :root{
        --wl-bg:#f6f7fb; --wl-card:#fff; --wl-border:#e5e7eb;
        --wl-text:#0f172a; --wl-sub:#475569; --wl-brand:#6b0016; --wl-focus:#93c5fd;
      }
      .bodyFlexContainer{ background:var(--wl-bg); }
      .wl-shell{ display:grid; gap:16px; }
      @media(min-width:1024px){ .wl-shell{ grid-template-columns: 1fr 420px; } }

      .wl-card{ background:var(--wl-card); border:1px solid var(--wl-border);
        border-radius:16px; box-shadow:0 6px 18px rgba(15,23,42,.06); }
      .wl-card-head{ padding:12px 14px; border-bottom:1px solid var(--wl-border);
        font-weight:900; letter-spacing:.2px; }
      .wl-card-body{ padding:12px 14px; }

      /* Compact two-column form grid */
      .wl-form-grid{ display:grid; gap:14px 16px; }
      @media(min-width:768px){ .wl-form-grid{ grid-template-columns: 1fr 1fr; } }
      .wl-item{ background:transparent; border:none; margin:0; padding:0; }
      .wl-span-2{ grid-column: 1 / -1; }

      /* Transform legacy groups into tidy rows */
      .wl-field{ display:grid; gap:6px; }
      @media(min-width:640px){
        .wl-field{ grid-template-columns: 160px 1fr; align-items:center; }
        .wl-lab{ text-align:right; padding-right:12px; }
      }
      .wl-lab{ color:var(--wl-sub); font-weight:800; }
      .wl-ctl input.form-control,
      .wl-ctl select.form-control,
      .wl-ctl textarea.form-control{
        border:1px solid var(--wl-border); border-radius:12px; padding:10px 12px; min-height:40px;
      }
      .wl-help{ color:var(--wl-sub); font-size:12px; margin-top:4px; }

      /* Amount quick actions */
      .wl-chips{ display:flex; gap:8px; flex-wrap:wrap; margin-top:6px; }
      .wl-chipbtn{ border:1px solid var(--wl-border); border-radius:999px; padding:6px 10px;
        background:#fff; font-weight:800; font-size:12px; cursor:pointer; }

      /* Pay method toggle (non-destructive) */
      .wl-paytoggle{ display:flex; gap:8px; flex-wrap:wrap; }
      .wl-paytoggle .opt{ border:1px solid var(--wl-border); border-radius:12px; padding:8px 12px;
        background:#fff; font-weight:800; cursor:pointer; }
      .wl-paytoggle .opt[data-active="true"]{ border-color:var(--wl-brand); box-shadow:0 0 0 3px rgba(107,0,22,.08); }

      /* Right rail summary + submit */
      .wl-summary{ display:flex; flex-direction:column; gap:12px; }
      .wl-pillrow{ display:flex; gap:8px; flex-wrap:wrap; }
      .wl-pill{ border:1px solid var(--wl-border); background:#fff; border-radius:999px; padding:6px 10px;
        font-weight:800; font-size:12px; }
      .wl-cta{ appearance:none; border:none; border-radius:12px; padding:12px 16px;
        background:var(--wl-brand); color:#fff; font-weight:900; cursor:pointer; width:100%; }
      .wl-cta:focus-visible{ outline:0; box-shadow:0 0 0 3px var(--wl-focus); }

      /* Make the transactions panel look like a card when moved */
      #ctl00_PageBody_accountsTransactionsPanel.wl-card .panelHeaderMidProductInfo1,
      #ctl00_PageBody_accountsTransactionsPanel.wl-card .paging-control{ border:none !important; }

      /* Minimize vertical bloat from legacy description text */
      .wl-compact .descriptionMessage{ display:none !important; }

      /* Subtle placeholder */
      #ctl00_PageBody_RemittanceAdviceTextBox::placeholder{ color:#98a5b1; }
    `;
    const el = document.createElement('style'); el.id='wl-ap-compact-css'; el.textContent = css; document.head.appendChild(el);
  })();

  /* ========== DOM helpers ========== */
  const $ = (sel,root=document)=> root.querySelector(sel);
  const $$ = (sel,root=document)=> Array.from(root.querySelectorAll(sel));
  const byId = (id)=> document.getElementById(id);
  function parseMoney(s){ const v=parseFloat(String(s||'').replace(/[^0-9.\-]/g,'')); return Number.isFinite(v)?v:0; }

  /* ========== Build compact layout ========== */
  function upgradeLayout(){
    const page = $('.bodyFlexContainer'); if (!page) return;

    // Shell grid: left form + right rail
    let shell = $('.wl-shell');
    if (!shell){
      const firstLeft = $('.bodyFlexItem > .float-left') || $('.bodyFlexItem');
      shell = document.createElement('div'); shell.className='wl-shell wl-compact';
      firstLeft?.parentNode?.insertBefore(shell, firstLeft);
      if (firstLeft) firstLeft.style.display='none'; // hide original column; we'll move its children
    }

    // Left card
    let leftCard = $('#wlLeftCard');
    if (!leftCard){
      leftCard = document.createElement('div');
      leftCard.id = 'wlLeftCard';
      leftCard.className = 'wl-card';
      leftCard.innerHTML = `<div class="wl-card-head">Payment details</div><div class="wl-card-body"><div id="wlFormGrid" class="wl-form-grid"></div></div>`;
      shell.appendChild(leftCard);
    }
    const grid = byId('wlFormGrid');

    // Right rail card
    let rightCard = $('#wlRightCard');
    if (!rightCard){
      rightCard = document.createElement('div');
      rightCard.id = 'wlRightCard';
      rightCard.className = 'wl-card';
      rightCard.innerHTML = `
        <div class="wl-card-head">Make a Payment</div>
        <div class="wl-card-body">
          <div id="wlSummary" class="wl-summary">
            <div class="wl-pillrow" id="wlSummaryPills"></div>
            <div id="wlSubmitMount"></div>
            <button type="button" class="wl-cta" id="wlProxySubmit">Make Payment</button>
          </div>
        </div>`;
      shell.appendChild(rightCard);
    }

    // Gather groups by control IDs
    const grp = {
      owing: byId('ctl00_PageBody_AmountOwingLiteral')?.closest('.epi-form-group-acctPayment') || null,
      amount: byId('ctl00_PageBody_PaymentAmountTextBox')?.closest('.epi-form-group-acctPayment') || null,
      addrDDL: byId('ctl00_PageBody_AddressDropdownList')?.closest('.epi-form-group-acctPayment') || null,
      billAddr: byId('ctl00_PageBody_BillingAddressTextBox')?.closest('.epi-form-group-acctPayment') || null,
      zip: byId('ctl00_PageBody_PostalCodeTextBox')?.closest('.epi-form-group-acctPayment') || null,
      email: byId('ctl00_PageBody_EmailAddressTextBox')?.closest('.epi-form-group-acctPayment') || null,
      notes: byId('ctl00_PageBody_NotesTextBox')?.closest('.epi-form-group-acctPayment') || null,
      remit: byId('ctl00_PageBody_RemittanceAdviceTextBox')?.closest('.epi-form-group-acctPayment') || null,
      payWrap: byId('ctl00_PageBody_MakePaymentPanel')?.previousElementSibling || null // radio group container
    };

    // Convert each legacy group to a tidy field block (label + control)
    Object.values(grp).filter(Boolean).forEach(group=>{
      if (!group.__wlTidy){
        // Each group usually has two direct divs: [label] + [control]
        const blocks = $$(':scope > div', group);
        if (blocks.length >= 2){
          const lab = blocks[0]; const ctl = blocks[1];
          lab.classList.add('wl-lab'); ctl.classList.add('wl-ctl');
          const wrap = document.createElement('div'); wrap.className='wl-field';
          wrap.appendChild(lab); wrap.appendChild(ctl);
          group.appendChild(wrap);
        }
        // Hide verbose legacy help text
        $$('p.descriptionMessage', group).forEach(p=> p.classList.add('wl-help'));
        group.__wlTidy = true;
        group.classList.add('wl-item');
      }
    });

    // Place items in compact two-column layout
    const order = [
      grp.owing, grp.amount,          // row 1
      grp.addrDDL, grp.billAddr,      // row 2
      grp.zip, grp.email,             // row 3
      grp.notes, grp.remit,           // row 4
      grp.payWrap                     // row 5 (full width)
    ].filter(Boolean);

    // Clean grid & re-append in the right order (idempotent)
    order.forEach(el => { if (!grid.contains(el)) grid.appendChild(el); });

    // Pay method toggle (credit/check) — keep WebForms behavior
    if (grp.payWrap && !grp.payWrap.__wlToggle){
      const credit = byId('ctl00_PageBody_RadioButton_PayByCredit');
      const check  = byId('ctl00_PageBody_RadioButton_PayByCheck');
      const ctlDiv = $$(':scope > div', grp.payWrap)[1];
      if (ctlDiv){
        const toggle = document.createElement('div');
        toggle.className = 'wl-paytoggle';
        const opt1 = document.createElement('button'); opt1.type='button'; opt1.className='opt'; opt1.textContent='Pay by credit';
        const opt2 = document.createElement('button'); opt2.type='button'; opt2.className='opt'; opt2.textContent='Pay by check';
        ctlDiv.innerHTML=''; ctlDiv.appendChild(toggle); toggle.appendChild(opt1); toggle.appendChild(opt2);
        const refresh=()=>{ opt1.dataset.active=credit?.checked?'true':'false'; opt2.dataset.active=check?.checked?'true':'false'; };
        opt1.addEventListener('click',()=>{ credit?.click(); refresh(); });
        opt2.addEventListener('click',()=>{ check?.click();  refresh(); });
        [credit,check].forEach(r=> r && r.addEventListener('change', refresh));
        refresh();
      }
      grp.payWrap.__wlToggle = true;
      grp.payWrap.classList.add('wl-span-2');
    }

    // Amount quick actions under Payment Amount
    const amountInput = byId('ctl00_PageBody_PaymentAmountTextBox');
    const owingVal = (function(){
      // Amount owing literal may be input[type=text][readonly] or literal
      const el = byId('ctl00_PageBody_AmountOwingLiteral');
      return el ? parseMoney(el.value || el.textContent) : 0;
    })();
    if (grp.amount && !grp.amount.querySelector('.wl-chips')){
      const chips = document.createElement('div'); chips.className='wl-chips';
      chips.innerHTML = `
        <button type="button" class="wl-chipbtn" data-act="fill-owing">Fill: Amount Owing</button>
        <button type="button" class="wl-chipbtn" data-act="clear-amt">Clear Amount</button>
      `;
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
      });
    }

    // Remittance niceties
    const rem = byId('ctl00_PageBody_RemittanceAdviceTextBox');
    if (rem && !rem.getAttribute('placeholder')){
      rem.setAttribute('placeholder','Comma separated · e.g. INV12345,INV67890');
    }

    // Right rail: mount summary pills + move the real submit panel into the right card
    const pills = byId('wlSummaryPills');
    if (pills && !pills.__wlBound){
      pills.__wlBound = true;
      // pull from session (prefill script uses KEY 'wl_ap_prefill_v2')
      let pref={};
      try{ pref = JSON.parse(sessionStorage.getItem('wl_ap_prefill_v2')||'{}'); }catch{}
      const invoiceList = String(pref.invoices||'').split(',').filter(Boolean);
      const total = pref.total || '';
      pills.innerHTML = `
        <span class="wl-pill">${invoiceList.length} invoice${invoiceList.length===1?'':'s'}</span>
        ${total?`<span class="wl-pill">Total ${total}</span>`:''}
        ${invoiceList.length?`<span class="wl-pill" title="${pref.invoices}">${invoiceList.slice(0,4).join(', ')}${invoiceList.length>4?'…':''}</span>`:''}
      `;
    }

    const submitMount = byId('wlSubmitMount');
    if (submitMount && !submitMount.__wlMoved){
      const realSubmitPanel = $('#ctl00_PageBody_MakePaymentPanel .submit-button-panel');
      if (realSubmitPanel){
        submitMount.appendChild(realSubmitPanel);
        submitMount.__wlMoved = true;
      }
    }
    // Proxy button clicks to the real submit (in case gateway injects late)
    byId('wlProxySubmit')?.addEventListener('click', ()=>{
      const real = $('#wlSubmitMount .submit-button-panel button, #wlSubmitMount .submit-button-panel input[type="submit"], #wlSubmitMount .submit-button-panel input[type="button"]');
      if (real) real.click();
      else window.scrollTo({ top: (byId('wlSubmitMount')?.getBoundingClientRect().top||0)+window.scrollY-80, behavior:'smooth' });
    });

    // Make transactions panel a card & place under the submit (right rail)
    const tx = byId('ctl00_PageBody_accountsTransactionsPanel');
    if (tx && !tx.__wlHomed){
      tx.classList.add('wl-card');
      const head = document.createElement('div'); head.className='wl-card-head'; head.textContent='Recent transactions';
      const body = document.createElement('div'); body.className='wl-card-body';
      // move existing children to body
      while (tx.firstChild) body.appendChild(tx.firstChild);
      tx.appendChild(head); tx.appendChild(body);
      rightCard.appendChild(tx);
      tx.__wlHomed = true;
    }
  }

  /* ========== Re-apply after partial postbacks ========== */
  function wireAjax(){
    try{
      if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager){
        const prm = Sys.WebForms.PageRequestManager.getInstance();
        if (!prm.__wlCompactBound){
          prm.add_endRequest(()=> upgradeLayout());
          prm.__wlCompactBound = true;
        }
      }
    }catch{}
  }

  /* ========== Boot ========== */
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>{ upgradeLayout(); wireAjax(); }, {once:true});
  } else {
    upgradeLayout(); wireAjax();
  }
})();



