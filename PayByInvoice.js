
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

