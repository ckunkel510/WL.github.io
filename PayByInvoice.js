
(function(){
  'use strict';
  if (!/AccountPayment_r\.aspx/i.test(location.pathname)) return;

  const $ = (id)=> document.getElementById(id);

  // Read params once
  const url = new URL(location.href);
  const invoicesParam = (url.searchParams.get('utm_invoices') || '').trim(); // "12345,45678"
  const totalParam    = (url.searchParams.get('utm_total')    || '').trim(); // "12.34"

  // Persist across AJAX postbacks (and if user clicks around)
  const PREF_KEY = 'wl_ap_prefill_v1';
  function savePref(p){ try{ sessionStorage.setItem(PREF_KEY, JSON.stringify(p)); }catch{} }
  function loadPref(){ try{ return JSON.parse(sessionStorage.getItem(PREF_KEY) || '{}'); }catch{ return {}; } }

  // Seed once from URL (only if present)
  if (invoicesParam || totalParam) {
    const existing = loadPref();
    savePref({
      invoices: invoicesParam || existing.invoices || '',
      total:    totalParam    || existing.total    || ''
    });
  }

  function applyPrefill(){
    const pref = loadPref();
    if (!pref || (!pref.invoices && !pref.total)) return;

    const rem = $('ctl00_PageBody_RemittanceAdviceTextBox');
    if (rem && pref.invoices){
      // Idempotent: only add our invoice list if it's not already in the box
      if (!rem.value.includes(pref.invoices)){
        rem.value = rem.value ? `${rem.value.replace(/\s+$/,'')}\n${pref.invoices}` : pref.invoices;
      }
    }

    const amt = $('ctl00_PageBody_PaymentAmountTextBox');
    if (amt && pref.total && amt.value !== pref.total){
      amt.value = pref.total;
    }
  }

  function triggerAmountPostbackOnce(){
    // Some pages recalc totals only on change -> trigger once
    if (window.__wlAmtPosted) return;
    const amt = $('ctl00_PageBody_PaymentAmountTextBox');
    if (!amt) return;
    window.__wlAmtPosted = true;
    // Give MS AJAX a tick to wire up, then fire change
    setTimeout(()=> {
      amt.dispatchEvent(new Event('change', { bubbles:true }));
    }, 50);
  }

  function wireAjaxReseeder(){
    try{
      if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager){
        const prm = Sys.WebForms.PageRequestManager.getInstance();
        if (!prm.__wlBound){
          prm.add_endRequest(function(){
            // Re-apply after ANY partial postback (billing address, etc.)
            applyPrefill();
          });
          prm.__wlBound = true;
        }
      }
    }catch{}
  }

  // Boot
  applyPrefill();
  wireAjaxReseeder();

  // If we came in with a total from the URL, kick the server-side calc once.
  if (totalParam) {
    // Ensure hooks are in place before we trigger the change
    setTimeout(()=> { applyPrefill(); triggerAmountPostbackOnce(); }, 0);
  }
})();
