
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

  /* ---------------- CSS ---------------- */
  (function injectCSS(){
    if (document.getElementById('wl-ap-modern-css')) return;
    const css = `
      :root{
        --wl-bg:#f6f7fb;
        --wl-card:#ffffff;
        --wl-border:#e5e7eb;
        --wl-text:#0f172a;
        --wl-sub:#475569;
        --wl-brand:#6b0016;
        --wl-brand-2:#8a1426;
        --wl-focus:#93c5fd;
        --wl-chip:#f1f5f9;
      }
      /* page backdrop */
      .bodyFlexContainer{ background:var(--wl-bg); }
      /* grid shell */
      .wl-ap-shell{
        display:grid; gap:16px; align-items:start;
      }
      @media (min-width: 1024px){
        .wl-ap-shell{ grid-template-columns: 1fr 420px; }
      }

      /* card */
      .wl-card{
        background:var(--wl-card); border:1px solid var(--wl-border);
        border-radius:16px; box-shadow:0 6px 18px rgba(15,23,42,.06);
      }
      .wl-card .wl-card-head{
        padding:14px 16px; border-bottom:1px solid var(--wl-border);
        font-weight:900; letter-spacing:.2px;
      }
      .wl-card .wl-card-body{ padding:14px 16px; }

      /* tidy the legacy groups */
      .wl-card .epi-form-group-acctPayment{
        border:none !important; background:transparent !important;
        padding:10px 0 !important; margin:0 0 8px !important;
      }
      .wl-field{ display:grid; gap:8px; }
      @media (min-width: 640px){
        .wl-field{ grid-template-columns: 180px 1fr; align-items:center; }
        .wl-field > .wl-lab { text-align:right; padding-right:12px; }
      }
      .wl-lab{ color:var(--wl-sub); font-weight:800; }
      .wl-ctl input.form-control,
      .wl-ctl select.form-control,
      .wl-ctl textarea.form-control{
        border:1px solid var(--wl-border); border-radius:12px; padding:10px 12px;
        box-shadow:none;
      }
      .wl-help{ color:var(--wl-sub); font-size:12px; margin-top:4px; }

      /* chips & quick actions */
      .wl-chiprow{ display:flex; gap:8px; flex-wrap:wrap; margin-top:6px; }
      .wl-chipbtn{
        border:1px solid var(--wl-border); border-radius:999px; padding:6px 10px;
        background:#fff; font-weight:800; font-size:12px; cursor:pointer; user-select:none;
      }

      /* pay method toggle (non-destructive) */
      .wl-paytoggle{ display:flex; gap:8px; flex-wrap:wrap; }
      .wl-paytoggle .opt{
        border:1px solid var(--wl-border); border-radius:12px; padding:8px 12px; cursor:pointer;
        font-weight:800; display:inline-flex; align-items:center; gap:8px; background:#fff;
      }
      .wl-paytoggle .opt[data-active="true"]{ border-color:var(--wl-brand); box-shadow:0 0 0 3px rgba(107,0,22,.08); }

      /* sticky footer action */
      .wl-sticky{
        position:sticky; bottom:0; z-index:40; margin-top:12px;
        background:rgba(246,247,251,.8); backdrop-filter:saturate(1.2) blur(8px);
        border-top:1px solid var(--wl-border);
      }
      .wl-sticky-inner{
        display:flex; gap:10px; align-items:center; justify-content:space-between;
        padding:10px 12px;
      }
      .wl-cta{
        appearance:none; border:none; border-radius:12px; padding:12px 16px;
        background:var(--wl-brand); color:#fff; font-weight:900; cursor:pointer;
      }
      .wl-cta:hover{ background:var(--wl-brand-2); }

      /* right column transactions panel appearance */
      #ctl00_PageBody_accountsTransactionsPanel.wl-card .panelHeaderMidProductInfo1,
      #ctl00_PageBody_accountsTransactionsPanel.wl-card .paging-control{ border:none !important; }

      /* top summary tweaks (uses your existing box if present) */
      #wlPaySummary{ margin-bottom:12px; }
      /* minor placeholder */
      #ctl00_PageBody_RemittanceAdviceTextBox::placeholder{ color:#9aa6b2; }
    `;
    const el = document.createElement('style'); el.id='wl-ap-modern-css'; el.textContent = css; document.head.appendChild(el);
  })();

  /* ---------------- DOM helpers ---------------- */
  const $ = (sel,root=document)=> root.querySelector(sel);
  const $$ = (sel,root=document)=> Array.from(root.querySelectorAll(sel));
  const byId = (id)=> document.getElementById(id);
  const once = (el,prop)=> (el[prop]=el[prop]||true) && el[prop];

  function parseMoney(s){ const v=parseFloat(String(s||'').replace(/[^0-9.\-]/g,'')); return Number.isFinite(v)?v:0; }

  /* ---------------- upgrade pass ---------------- */
  function upgradeUI(){
    const page = $('.bodyFlexContainer');
    if (!page || page.__wlUpgraded) return;
    page.__wlUpgraded = true;

    // Shell grid wrapping left form column + right transactions
    const leftCol = $('.bodyFlexItem > .float-left') || $('.bodyFlexItem');
    const rightPanel = byId('ctl00_PageBody_accountsTransactionsPanel');
    if (!leftCol) return;

    const shell = document.createElement('div');
    shell.className = 'wl-ap-shell';
    leftCol.parentNode.insertBefore(shell, leftCol);

    // Build left card
    const leftCard = document.createElement('div');
    leftCard.className = 'wl-card';
    leftCard.innerHTML = `
      <div class="wl-card-head">Payment details</div>
      <div class="wl-card-body" id="wlLeftBody"></div>
    `;
    shell.appendChild(leftCard);

    // Move existing groups into our left card body
    const leftBody = byId('wlLeftBody');
    $$('.epi-form-group-acctPayment', leftCol).forEach(g=> leftBody.appendChild(g));

    // Make each legacy group a nice field row
    $$('.epi-form-group-acctPayment', leftBody).forEach(group=>{
      // Group has structure: <div><label/></div><div>[input]</div>
      const blocks = $$(':scope > div', group);
      if (blocks.length >= 2){
        const lab = blocks[0]; const ctl = blocks[1];
        lab.classList.add('wl-lab'); ctl.classList.add('wl-ctl');
        const wrap = document.createElement('div');
        wrap.className = 'wl-field';
        group.appendChild(wrap);
        wrap.appendChild(lab); wrap.appendChild(ctl);
      }
      // Optional help <p> -> style
      $$('p.descriptionMessage', group).forEach(p=>{ p.classList.add('wl-help'); });
    });

    // Add quick chips under Amount
    const amtCtl = byId('ctl00_PageBody_PaymentAmountTextBox');
    const amountGroup = amtCtl ? amtCtl.closest('.epi-form-group-acctPayment') : null;
    const amountOwing = parseMoney(byId('ctl00_PageBody_AmountOwingLiteral')?.value || byId('ctl00_PageBody_AmountOwingLiteral')?.textContent);
    if (amountGroup && !amountGroup.querySelector('.wl-chiprow')){
      const chipRow = document.createElement('div');
      chipRow.className = 'wl-chiprow';
      chipRow.innerHTML = `
        <button type="button" class="wl-chipbtn" data-act="fill-owing">Fill: Amount Owing</button>
        <button type="button" class="wl-chipbtn" data-act="clear-amt">Clear Amount</button>
      `;
      amountGroup.appendChild(chipRow);

      chipRow.addEventListener('click', (e)=>{
        const b = e.target.closest('button[data-act]'); if (!b) return;
        if (b.dataset.act==='fill-owing' && Number.isFinite(amountOwing) && amtCtl){
          amtCtl.value = amountOwing.toFixed(2);
          // trigger change so WebForms recalcs if needed
          setTimeout(()=> amtCtl.dispatchEvent(new Event('change',{bubbles:true})), 0);
        } else if (b.dataset.act==='clear-amt' && amtCtl){
          amtCtl.value = '';
          setTimeout(()=> amtCtl.dispatchEvent(new Event('change',{bubbles:true})), 0);
        }
      });
    }

    // Remittance placeholder + live chip count in summary (if your earlier script created wlPaySummary)
    const rem = byId('ctl00_PageBody_RemittanceAdviceTextBox');
    if (rem && !rem.getAttribute('placeholder')){
      rem.setAttribute('placeholder','Comma separated, e.g. INV12345,INV67890');
    }
    function updateRemitCount(){
      const box = byId('wlPaySummary');
      if (!box) return;
      const raw = (rem?.value || '').trim();
      const count = raw ? raw.split(/[,\n\r\t ]+/).filter(Boolean).length : 0;
      const pill = box.querySelector('.wl-pill');
      if (pill) pill.textContent = `${count} invoice${count===1?'':'s'}`;
    }
    if (rem && !rem.__wlCountBound){
      rem.addEventListener('input', updateRemitCount);
      rem.__wlCountBound = true;
      updateRemitCount();
    }

    // Pay method as toggle (non-destructive)
    const payWrapGroup = $('#ctl00_PageBody_MakePaymentPanel')?.previousElementSibling; // group containing radios
    if (payWrapGroup && !payWrapGroup.__wlToggle){
      const credit = byId('ctl00_PageBody_RadioButton_PayByCredit');
      const check  = byId('ctl00_PageBody_RadioButton_PayByCheck');
      if (credit || check){
        const labDiv = $$(':scope > div', payWrapGroup)[0];
        const ctlDiv = $$(':scope > div', payWrapGroup)[1];
        if (labDiv && ctlDiv){
          const toggle = document.createElement('div');
          toggle.className = 'wl-paytoggle';
          const opt1 = document.createElement('button');
          opt1.type='button'; opt1.className='opt'; opt1.textContent='Pay by credit';
          const opt2 = document.createElement('button');
          opt2.type='button'; opt2.className='opt'; opt2.textContent='Pay by check';
          toggle.appendChild(opt1); toggle.appendChild(opt2);
          ctlDiv.innerHTML=''; ctlDiv.appendChild(toggle);

          function refresh(){
            opt1.dataset.active = credit?.checked ? 'true':'false';
            opt2.dataset.active = check?.checked ? 'true':'false';
          }
          opt1.addEventListener('click', ()=>{ credit?.click(); refresh(); });
          opt2.addEventListener('click', ()=>{ check?.click();  refresh(); });
          [credit,check].forEach(r=> r && r.addEventListener('change', refresh));
          refresh();
        }
      }
      payWrapGroup.__wlToggle = true;
    }

    // Right panel: make it a card + place in grid
    if (rightPanel){
      rightPanel.classList.add('wl-card');
      const head = document.createElement('div'); head.className='wl-card-head'; head.textContent='Recent transactions';
      const body = document.createElement('div'); body.className='wl-card-body';
      // Move existing children into body
      while (rightPanel.firstChild) body.appendChild(rightPanel.firstChild);
      rightPanel.appendChild(head); rightPanel.appendChild(body);
      shell.appendChild(rightPanel);
    }

    // Sticky footer mirroring the real submit button (if/when it appears)
    ensureStickyCTA();
  }

  /* ---------------- sticky CTA ---------------- */
  function ensureStickyCTA(){
    if (byId('wlSticky')) return;
    const submitHost = $('.submit-button-panel');
    const cta = document.createElement('div');
    cta.id = 'wlSticky';
    cta.className = 'wl-sticky';
    cta.innerHTML = `
      <div class="wl-sticky-inner">
        <div style="font-weight:800;color:#334155;">Review details and submit your payment.</div>
        <button type="button" class="wl-cta" id="wlCtaBtn">Make Payment</button>
      </div>
    `;
    // Place after left card
    const leftCard = $('.wl-card'); if (leftCard) leftCard.parentNode.insertBefore(cta, leftCard.nextSibling);

    const proxyClick = ()=>{
      const real = submitHost?.querySelector('button, input[type="submit"], input[type="button"]');
      if (real){ real.click(); }
      else { window.scrollTo({ top: (submitHost?.getBoundingClientRect().top||0)+window.scrollY-80, behavior:'smooth' }); }
    };
    byId('wlCtaBtn')?.addEventListener('click', proxyClick);

    // Also: if a real button appears later (after gateway loads), we keep the sticky
    if (submitHost && !submitHost.__wlObserve){
      const mo = new MutationObserver(()=>{/* no-op; button discovery is in proxy */});
      mo.observe(submitHost, {childList:true, subtree:true});
      submitHost.__wlObserve = true;
    }
  }

  /* ---------------- MS AJAX re-apply ---------------- */
  function wireAjax(){
    try{
      if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager){
        const prm = Sys.WebForms.PageRequestManager.getInstance();
        if (!prm.__wlModernBound){
          prm.add_endRequest(()=> {
            // re-run after any partial update
            // (don’t wrap the whole page again; upgradeUI guard handles it)
            upgradeUI();
          });
          prm.__wlModernBound = true;
        }
      }
    }catch{}
  }

  /* ---------------- boot ---------------- */
  // If DOM was already present
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>{ upgradeUI(); wireAjax(); }, { once:true });
  } else {
    upgradeUI(); wireAjax();
  }
})();

