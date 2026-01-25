
(function () {
  'use strict';
  console.log('[AP] PayByInvoice version v24 loaded');

  if (!/AccountPayment_r\.aspx/i.test(location.pathname)) return;

  /* =============================
     URL + Session Pref Handling
     ============================= */
  const url = new URL(location.href);
  const HAS_PARAMS = [
    'utm_invoices','utm_total','utm_jobs','utm_remit','utm_notes','utm_clear','utm_back','utm_docs'
  ].some(k => url.searchParams.has(k));
  if (!HAS_PARAMS) return;

  const $ = (id)=> document.getElementById(id);
  const KEY = 'wl_ap_prefill_v3';

  function savePref(p){ try{ sessionStorage.setItem(KEY, JSON.stringify(p)); }catch(e){} }
  function loadPref(){ try{ return JSON.parse(sessionStorage.getItem(KEY) || '{}'); }catch{ return {}; } }

  const BILL_DRAFT_KEY = 'wl_billDraft_v3';
  const STEP_ADV_KEY  = 'wl_ap_forceStep_v3';
  function saveBillDraft(v){ try{ sessionStorage.setItem(BILL_DRAFT_KEY, String(v||'')); }catch(e){} }
  function loadBillDraft(){ try{ return sessionStorage.getItem(BILL_DRAFT_KEY) || ''; }catch{ return ''; } }

  const BILL_LOCK_KEY  = 'wl_billLocked_v1';
  const WL_FORCE_WIZ_PB_KEY = 'wl_forceWizardPostback_v1';

  function lockBilling(v){ try{ sessionStorage.setItem(BILL_LOCK_KEY, String(v||'')); }catch(e){} }
  function loadBillingLock(){ try{ return sessionStorage.getItem(BILL_LOCK_KEY) || ''; }catch{ return ''; } }
  function clearBillingLock(){ try{ sessionStorage.removeItem(BILL_LOCK_KEY); }catch(e){} }

  function shouldForceWizardPostback(){
    try{
      const t = Number(sessionStorage.getItem(WL_FORCE_WIZ_PB_KEY) || 0);
      return !(t && (Date.now() - t) < 8000);
    }catch{ return true; }
  }
  function markWizardPostback(){ try{ sessionStorage.setItem(WL_FORCE_WIZ_PB_KEY, String(Date.now())); }catch(e){} }

  // Force a server round-trip using the same path as "Make Payment"
  function forceWizardRoundTrip(reason){
    try{
      if (!shouldForceWizardPostback()) return false;
      markWizardPostback();
      const proxy = document.getElementById('wlProxySubmit');
      if (proxy){ try{ proxy.click(); }catch(e){} return true; }
      const real = document.querySelector('#wlSubmitMount .submit-button-panel button, #wlSubmitMount .submit-button-panel input[type="submit"], #wlSubmitMount .submit-button-panel input[type="button"]')
        || document.querySelector('#ctl00_PageBody_MakePaymentPanel .submit-button-panel button, #ctl00_PageBody_MakePaymentPanel .submit-button-panel input[type="submit"], #ctl00_PageBody_MakePaymentPanel .submit-button-panel input[type="button"]');
      if (real){ try{ real.click(); }catch(e){} return true; }
    }catch(e){}
    return false;
  }

  // Force a server round-trip using the Pay By Check ("Check on File") radio postback.
  // This is useful to re-render the Step 1 billing UI after the user commits billing.
  const WL_FORCE_CHECK_PB_KEY = 'wl_forcePayByCheckPostback_v1';
  function shouldForceCheckPostback(){
    try{
      const t = Number(sessionStorage.getItem(WL_FORCE_CHECK_PB_KEY) || 0);
      return !(t && (Date.now() - t) < 8000);
    }catch{ return true; }
  }
  function markCheckPostback(){ try{ sessionStorage.setItem(WL_FORCE_CHECK_PB_KEY, String(Date.now())); }catch(e){} }

  function forcePayByCheckRoundTrip(reason){
    try{
      if (!shouldForceCheckPostback()) return false;
      markCheckPostback();

      // Try click first (lets WebForms emit whatever it normally does)
      const rb = document.getElementById('ctl00_PageBody_RadioButton_PayByCheck');
      if (rb){
        rb.click();
        return true;
      }

      // Fallback to explicit __doPostBack with common UniqueID
      if (typeof window.__doPostBack === 'function'){
        window.__doPostBack('ctl00$PageBody$RadioButton_PayByCheck','');
        return true;
      }

      // Last resort: use the Make Payment proxy (if present)
      return forceWizardRoundTrip('fallback-from-check:' + (reason||''));
    }catch(e){}
    return false;
  }


  function renderBillingDisplay(infoInner, value, inputClass){
    try{
      const v = String(value||'').trim();
      if (!v) return null;

      let disp = document.getElementById('wlBillingDisplayWrap');
      if (disp) { try{ disp.classList.add('wl-force-show'); }catch(e){} }
      if (!disp){
        disp = document.createElement('div');
        disp.id = 'wlBillingDisplayWrap';
        disp.className = 'epi-form-group-acctPayment';
        disp.classList.add('wl-force-show');
        disp.innerHTML = `
          <div class="wl-bill-display">
            <div class="wl-bill-head">
              <div class="wl-bill-title">Billing Address</div>
              <button type="button" class="w3-btn ghost sm" id="wlBillingEditBtn">Edit</button>
            </div>
            <input type="text" class="${inputClass || 'form-control'}" readonly value="">
            <div class="wl-bill-note">Saved. To change this, click Edit.</div>
          </div>
        `;
      }
      // Put it before email when possible
      const emailWrap = document.getElementById('ctl00_PageBody_EmailTextBox')?.closest('.epi-form-group-acctPayment') || null;
      if (disp.parentElement !== infoInner){
        if (emailWrap && emailWrap.parentElement === infoInner){
          infoInner.insertBefore(disp, emailWrap);
        } else {
          infoInner.appendChild(disp);
        }
      }
      const ro = disp.querySelector('input[readonly]');
      if (ro) ro.value = v;

      const btn = disp.querySelector('#wlBillingEditBtn');
      if (btn && !btn.__wlBound){
        btn.__wlBound = true;
        btn.addEventListener('click', ()=>{
          try { clearBillingLock(); } catch {}
          try { saveBillDraft(''); } catch {}
          try { location.reload(); } catch {}
        });
      }
      return disp;
    }catch(e){}
    return null;
  }
  function clearBillDraft(){ try{ sessionStorage.removeItem(BILL_DRAFT_KEY); }catch(e){} }

  /* ---------- parsing helpers ---------- */
  function trim(s){ return String(s||'').trim(); }
  function isTruthyFlag(v){
    return ['1','true','yes','y','on'].includes(String(v||'').toLowerCase());
  }
  function toUSDateStr(d=new Date()){
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }
  function normalizeMoneyStr(s){
    // Keep the user's formatting if present; else strip junk except digits/.- and reapply
    const raw = String(s||'').trim();
    if (!raw) return '';
    // Already looks like a money-ish token? keep as-is
    if (/^\$?\-?\d+(?:\.\d{1,2})?$/.test(raw)) return raw;
    const v = parseFloat(raw.replace(/[^0-9.\-]/g,''));
    if (!Number.isFinite(v)) return raw;
    // Format with 2 decimals, no currency symbol (PaymentAmount usually accepts either)
    return v.toFixed(2);
  }

  // Accept: "123", "123$45.67", "INV123", "INV123$45.67", "cn123", "CN123$-10.00"
  // Return canonical tokens preserving CN and any $amount; strip INV prefix.
  function normalizeDocTokens(str){
    const seen = new Set();
    const out = [];
    const raw = String(str||'')
      .split(/[,\n\r\t ]+/)
      .map(x=>x.trim())
      .filter(Boolean);

    for (const tok of raw){
      // CN credit?
      let m = /^CN\s*0*(\d+)(\$(\-?\d+(?:\.\d{1,2})?)\s*)?$/i.exec(tok);
      if (m){
        const num = m[1];
        const amt = m[2] ? `$${normalizeMoneyStr(m[2].slice(1))}` : '';
        const canon = `CN${num}${amt}`;
        if (!seen.has(canon)){ seen.add(canon); out.push(canon); }
        continue;
      }
      // Regular invoice (with optional INV) possibly with $amount
      m = /^(?:INV)?\s*0*(\d+)\s*(\$(\-?\d+(?:\.\d{1,2})?)\s*)?$/i.exec(tok);
      if (m){
        const num = m[1];
        const amt = m[2] ? `$${normalizeMoneyStr(m[2].slice(1))}` : '';
        const canon = `${num}${amt}`;
        if (!seen.has(canon)){ seen.add(canon); out.push(canon); }
        continue;
      }
      // Fallback: keep token as-is but trim
      const canon = tok.replace(/\s+/g,'');
      if (!seen.has(canon)){ seen.add(canon); out.push(canon); }
    }
    return out;
  }

  // utm_jobs accepts: "Job A$12.34,Job B$56.78" OR "Job A|12.34" OR "Job A:12.34"
  function parseJobs(str){
    const parts = String(str||'').split(/[,\n]+/).map(s=>s.trim()).filter(Boolean);
    const out = [];
    for (const p of parts){
      // Split by $ or | or :
      let name='', amt='';
      if (p.includes('$')){
        const idx = p.lastIndexOf('$');
        name = p.slice(0, idx).trim();
        amt  = p.slice(idx+1).trim();
      } else if (p.includes('|')){
        [name, amt] = p.split('|').map(s=>s.trim());
      } else if (p.includes(':')){
        [name, amt] = p.split(':').map(s=>s.trim());
      } else {
        name = p.trim();
      }
      if (!name) continue;
      out.push({ name, amount: amt ? normalizeMoneyStr(amt) : '' });
    }
    return out;
  }

  /* ---------- read URL and seed session ---------- */
  const urlInv   = url.searchParams.get('utm_invoices') || url.searchParams.get('utm_docs') || '';
  const urlTot   = url.searchParams.get('utm_total')    || '';
  const urlJobs  = url.searchParams.get('utm_jobs')     || '';
  const urlRemit = url.searchParams.get('utm_remit')    || '';
  const urlNotes = url.searchParams.get('utm_notes')    || '';
  const urlBack  = url.searchParams.get('utm_back')     || '';
  const doClear  = isTruthyFlag(url.searchParams.get('utm_clear'));

  if (urlInv || urlTot || urlJobs || urlRemit || urlNotes || urlBack || doClear){
    const existing = loadPref();
    const docs = normalizeDocTokens(urlInv).join(',');
    savePref({
      docs:     docs || existing.docs || '',
      total:    urlTot || existing.total || '',
      jobs:     urlJobs || existing.jobs || '',
      remit:    urlRemit || existing.remit || '',
      notes:    urlNotes || existing.notes || '',
      back:     urlBack || existing.back || '',
      clear:    doClear || existing.clear || false
    });
  }

  /* =============================
     DOM Apply + Postback Safety
     ============================= */
  function buildRemittanceText(pref){
    const lines = [];
    const docs = String(pref.docs||'').trim();
    if (docs) lines.push(docs); // docs on a single line, e.g. "123$12.34,CN456,789$5.00"

    // Jobs → one line each: "Job name - $12.34 balance as of MM/DD/YYYY"
    const jobList = parseJobs(pref.jobs);
    const today = toUSDateStr();
    for (const j of jobList){
      const a = j.amount ? `$${normalizeMoneyStr(j.amount)}` : '';
      lines.push(`${j.name} - ${a || '$0.00'} balance as of ${today}`);
    }

    if (pref.remit) lines.push(String(pref.remit).trim());
    if (pref.notes) lines.push(String(pref.notes).trim());
    return lines.join('\n');
  }

  function dedupeDocsInto(existingValue, newDocsCsv){
    if (!newDocsCsv) return existingValue || '';
    const existing = String(existingValue||'').replace(/\s+/g,'');
    const tokens = normalizeDocTokens(newDocsCsv);
    const fresh = [];
    for (const t of tokens){
      // if not already present verbatim (ignoring whitespace), append
      if (!existing.includes(t.replace(/\s+/g,''))){
        fresh.push(t);
      }
    }
    if (!fresh.length) return existingValue || '';
    return (existingValue ? (existingValue.replace(/\s+$/,'') + '\n') : '') + fresh.join(',');
  }

  function applyPrefill(){
    const pref = loadPref(); if (!pref) return;

    const rem = $('ctl00_PageBody_RemittanceAdviceTextBox');
    const amt = $('ctl00_PageBody_PaymentAmountTextBox');

    if (rem){
      let finalText = String(rem.value||'').trim();
      if (pref.clear){
        finalText = ''; // explicit clear if requested
      }
      // Insert docs on one line (dedupe), then append jobs/remit/notes
      if (pref.docs){
        finalText = dedupeDocsInto(finalText, pref.docs);
      }
      const addl = buildRemittanceText({ ...pref, docs:'' }); // jobs/remit/notes only
      if (addl){
        finalText = finalText ? (finalText + '\n' + addl) : addl;
      }
      rem.value = finalText;
      rem.defaultValue = rem.value;
    }

    if (amt && pref.total){
      const norm = normalizeMoneyStr(pref.total);
      if (norm && amt.value !== norm) amt.value = norm;
      amt.defaultValue = amt.value;
    }

    renderSummary(pref);
  }

  // Ensure the values are present right before any partial postback
  function stampValuesIntoForm(){
    const pref = loadPref(); if (!pref) return;
    const rem = $('ctl00_PageBody_RemittanceAdviceTextBox');
    const amt = $('ctl00_PageBody_PaymentAmountTextBox');
    if (rem){
      // rebuild expected text and ensure it's stamped
      let finalText = String(rem.value||'').trim();
      if (pref.clear){ finalText = ''; }
      if (pref.docs){ finalText = dedupeDocsInto(finalText, pref.docs); }
      const addl = buildRemittanceText({ ...pref, docs:'' });
      if (addl){ finalText = finalText ? (finalText + '\n' + addl) : addl; }
      rem.value = finalText;
    }
    if (amt && pref.total){
      const norm = normalizeMoneyStr(pref.total);
      if (norm && amt.value !== norm) amt.value = norm;
    }
  }

// Keep Remittance in sync with invoice/job selections made in modals (same-tab changes)
function startSelectionSync(){
  if (window.__WL_AP_SEL_SYNC) return;
  window.__WL_AP_SEL_SYNC = true;

  let lastDocs = null;
  let lastJobs = null;

  function extractDocsString(){
    try{
      const raw = localStorage.getItem('WL_AP_SelectedDocs');
      if (!raw) return '';
      const obj = JSON.parse(raw);
      const docs = obj?.value?.docs || obj?.docs || obj?.value || obj;
      if (!Array.isArray(docs)) return '';
      // Build a concise "INV 123, CR 456" style list
      return docs.map(d=>{
        const t = (d.type||d.DocType||'').toString().toUpperCase().startsWith('C') ? 'CN' : 'INV';
        const n = (d.doc || d.Doc || d.docNumber || d.DocumentNumber || '').toString().trim();
        return n ? `${t}${n}` : '';
      }).filter(Boolean).join(',');
    }catch{ return ''; }
  }

  function extractJobsString(){
    try{
      const raw = sessionStorage.getItem('__WL_JobsSelection');
      if (!raw) return '';
      const obj = JSON.parse(raw);
      if (Array.isArray(obj)) return obj.join(',');
      if (obj && typeof obj === 'object') return Object.keys(obj).join(',');
      return '';
    }catch{ return ''; }
  }

  setInterval(function(){
    try{
      const docsStr = extractDocsString();
      const jobsStr = extractJobsString();

      if (docsStr !== lastDocs || jobsStr !== lastJobs){
        lastDocs = docsStr;
        lastJobs = jobsStr;

        const pref = loadPref();
        const next = { ...pref, docs: docsStr || '', jobs: jobsStr || '', clear:false };
        savePref(next);
        applyPrefill();
      }
    }catch(e){}
  }, 700);
}


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
    }catch(e){}
  }

  // Persist user edits too (keeps docs clean + total)
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
          // Re-extract docs only (first line with commas), leave jobs/notes/remit as-is
          let docsLine = '';
          if (rem && rem.value){
            const firstLine = String(rem.value).split('\n')[0];
            if (firstLine.includes(',')){
              docsLine = normalizeDocTokens(firstLine).join(',');
            }
          }
          savePref({
            docs:  docsLine || (pref.docs||''),
            total: amt ? amt.value : (pref.total||''),
            jobs:  pref.jobs || '',
            remit: pref.remit || '',
            notes: pref.notes || '',
            back:  pref.back || '',
            clear: !!pref.clear
          });
        };
        el.addEventListener('input',  saveNow);
        el.addEventListener('change', saveNow);
        el.__wlBound = true;
      }
    });
    renderSummary(loadPref());
  }

  /* =============================
     Boot
     ============================= */
  injectCSS();
  wireAjax();
  startSelectionSync();
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
      div#wlcheaderquicklinks{ display: none !important;}
      div#wlcheader{height: auto !important;}
      div#siteHeaderContent{height: 75px !important;}

      .wl-shell{ display:grid; gap:18px; grid-template-areas:"left right" "tx tx"; }
      @media(min-width:1200px){ .wl-shell{ grid-template-columns: 1fr 380px; } }
      @media(min-width:1024px) and (max-width:1199px){ .wl-shell{ grid-template-columns: 1fr 360px; } }
      @media(max-width:1023px){ .wl-shell{ grid-template-areas:"left" "right" "tx"; grid-template-columns: 1fr; } }

      #wlLeftCard{ grid-area:left; }  #wlRightCard{ grid-area:right; }  #wlTxCard{ grid-area:tx; }
      /* Keep recent transactions in DOM for selection logic, but hide from users */
      #wlTxCard{ position:absolute !important; left:-99999px !important; top:auto !important; width:1px !important; height:1px !important; overflow:hidden !important; }


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
      .wl-chipbtn{ border:1px solid var(--wl-border); border-radius:999px; padding:7px 12px; font-weight:normal; font-size:12px; cursor:pointer; background:#6b0016 !important; color:white; max-height:30px; }

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


      /* ===========================
         Pay Method Cards
         =========================== */
      .wl-hidden-native{
        position:absolute!important;
        left:-20000px!important;
        top:auto!important;
        width:1px!important;
        height:1px!important;
        overflow:hidden!important;
      }
      #w3PayInner .wl-pay-methods{
        display:grid;
        grid-template-columns: 1fr 1fr;
        gap:12px;
      }
      @media (max-width:720px){
        #w3PayInner .wl-pay-methods{ grid-template-columns: 1fr; }
      }
      #w3PayInner .wl-pay-bank{
        display:grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap:12px;
        margin-top:12px;
      }
      @media (max-width:720px){
        #w3PayInner .wl-pay-bank{ grid-template-columns: 1fr; }
      }

      #w3PayInner .wl-pay-cardlvl{
        display:grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap:12px;
        margin-top:12px;
      }
      @media (max-width:720px){
        #w3PayInner .wl-pay-cardlvl{ grid-template-columns: 1fr; }
      }
      #w3PayInner .wl-pay-card{
        appearance:none;
        border:2px solid #6b0015;
        border-radius:14px;
        background:#fff;
        color:#000;
        text-align:left;
        padding:14px 14px;
        cursor:pointer;
        display:block;
      }
      #w3PayInner .wl-pay-title{ font-weight:900; }
      #w3PayInner .wl-pay-sub{ margin-top:4px; opacity:.85; font-size:12px; }
      #w3PayInner .wl-pay-card.is-selected{
        background:#6b0015;
        color:#fff;
      }

      #w3PayInner .wl-pay-card.is-disabled{
        opacity:.55;
        cursor:not-allowed;
      }
      #w3PayInner .wl-pay-card.is-disabled *{ pointer-events:none; }
      #w3PayInner .wl-pay-card:focus-visible{
        outline:0;
        box-shadow:0 0 0 3px rgba(107,0,21,.25);
      }

    
      /* Billing saved inline confirm */
      .wl-inline-confirm{margin-top:8px;font-size:12px;padding:8px 10px;border-radius:10px;border:1px solid rgba(107,0,21,.35);background:rgba(107,0,21,.06);color:#111;display:none}
      .wl-inline-confirm.on{display:block}
      .wl-inline-confirm.ok{border-color:rgba(46,125,50,.35);background:rgba(46,125,50,.08)}
      .wl-inline-confirm.bad{border-color:rgba(183,28,28,.35);background:rgba(183,28,28,.06)}
      .wl-edit-btn{margin-left:8px}

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
    const wizInfo = byId('w3InfoInner'); // Wizard v3 Step 1
    const grid    = byId('wlFormGrid') || document; // Payment step container (legacy)

    // Primary known IDs
    let billBox = byId('ctl00_PageBody_BillingAddressTextBox') ||
                  byId('ctl00_PageBody_BillingAddress') ||
                  byId('ctl00$PageBody$BillingAddressTextBox');

    // Broad fallback (WebTrack markup varies by patch/version)
    if (!billBox){
      billBox = document.querySelector('input[id*="Billing"][id*="Address"], textarea[id*="Billing"][id*="Address"], input[name*="Billing"][name*="Address"], textarea[name*="Billing"][name*="Address"]');
    }

    let billContainer =
      byId('ctl00_PageBody_BillingAddressContainer') ||
      (billBox && (billBox.closest('.epi-form-group-acctPayment') || billBox.closest('.epi-form-group') || billBox.closest('.wl-field') || billBox.closest('tr') || billBox.parentElement));

    if (billContainer){
      billContainer.classList.add('wl-force-show');
      billContainer.style.removeProperty('display');

      // If it's a table row, force correct display
      if (billContainer.tagName === 'TR'){
        billContainer.style.display = 'table-row';
      }

      // Only relocate non-table-row containers (moving TR breaks DOM)
      if (wizInfo && billContainer.tagName !== 'TR'){
        if (!wizInfo.contains(billContainer)) wizInfo.appendChild(billContainer);
      } else if (!wizInfo){
        if (grid && billContainer.tagName !== 'TR' && !grid.contains(billContainer)) grid.appendChild(billContainer);
      }

      log.info('ensureBillingVisible: ensured', { id: billContainer.id || '(no-id)', box: billBox?.id || '(no-box)' });
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
      leftCard.innerHTML = `<div class="wl-card-head">Payment Details</div><div class="wl-card-body"><div id="wlFormGrid" class="wl-form-grid"></div></div>`;
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

    // Place fields (explicit order; keep Billing before Email even after postbacks)

    const WIZ_V3_ACTIVE = !!document.getElementById('w3InfoInner');

    function isWizardInfoField(el){
      if (!el) return false;
      // Any wrapper containing these server controls belongs on Step 1 in Wizard v3
      return !!(el.querySelector && (
        el.querySelector('#ctl00_PageBody_BillingAddressTextBox') ||
        el.querySelector('#ctl00_PageBody_PostalCodeTextBox') ||
        el.querySelector('#ctl00_PageBody_EmailAddressTextBox') ||
        el.id === 'ctl00_PageBody_BillingAddressContainer'
      ));
    }

    let ordered = [grp.owing, grp.amount, grp.addrDDL, grp.billAddr, grp.zip, grp.email, grp.notes, grp.remit, grp.payWrap]
      .filter(Boolean);

    if (WIZ_V3_ACTIVE){
      // Wizard v3 renders Billing/ZIP/Email on Step 1; don't let legacy placer pull them into payment step.
      ordered = ordered.filter(el => !isWizardInfoField(el));
    }

    ordered.forEach(el=>{
      if (!grid.contains(el)) { grid.appendChild(el); log.debug('moved to grid', el.id||'(no-id)'); }
    });

    // Billing must appear before Email in Step 1 (users fill billing first)
    (function enforceBillingBeforeEmail(){
      if (WIZ_V3_ACTIVE) return;
      const bill = grp.billAddr
        || byId('ctl00_PageBody_BillingAddressContainer')
        || byId('ctl00_PageBody_BillingAddressTextBox')?.closest('.epi-form-group-acctPayment');
      const email = grp.email
        || byId('ctl00_PageBody_EmailAddressTextBox')?.closest('.epi-form-group-acctPayment');

      if (!grid || !bill || !email) return;
      if (!grid.contains(bill) || !grid.contains(email)) return;

      // If Billing is after Email, move it just before Email (do not interfere with postbacks)
      const pos = bill.compareDocumentPosition(email);
      if (pos & Node.DOCUMENT_POSITION_PRECEDING){
        grid.insertBefore(bill, email);
        log.info('enforceBillingBeforeEmail: moved Billing before Email');
      }
    })();

    if (grp.payWrap) grp.payWrap.classList.add('wl-span-2');

    // Radios: ensure visible only (selection handled in guards)
    ensurePayByCheckVisibleAndSelected();


    // Amount quick chips
    const amountInput = byId('ctl00_PageBody_PaymentAmountTextBox');
    const owingVal = (function(){ const el = byId('ctl00_PageBody_AmountOwingLiteral'); return el ? parseMoney(el.value || el.textContent) : 0; })();
    if (grp.amount && !grp.amount.querySelector('.wl-chips')){
      const chips = document.createElement('div'); chips.className='wl-chips';
      chips.innerHTML = `<button type="button" class="wl-chipbtn" data-act="clear-amt">Clear</button>`;
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

  // Payment method / bank account selection (from cards state first)
let payMethod = '';
let payAccount = '';
try{
  const raw = sessionStorage.getItem('wlPayState');
  if (raw){
    const st = JSON.parse(raw);
    if (st?.method === 'credit' || st?.method === 'card') payMethod = 'Credit Card';
    if (st?.method === 'bank')   payMethod = 'Bank (ACH)';
    if (st?.method === 'bank'){
      if (st?.bank?.mode === 'new') payAccount = 'Add new bank account';
      if (st?.bank?.mode === 'saved') payAccount = st?.bank?.text || 'Saved bank account';
    }
  }
}catch(e){}
// Fallback: infer from native controls if state missing
try{
  const rbCheck = byId('ctl00_PageBody_RadioButton_PayByCheck');
  const rbCof   = byId('ctl00_PageBody_RadioButton_PayByCheckOnFile');
  const rbCred  = byId('ctl00_PageBody_RadioButton_PayByCredit');
  const cof1 = byId('ctl00_PageBody_ChecksOnFileContainer');
  const cof2 = byId('ctl00_PageBody_ChecksOnFileContainer1');
  const cofSel = (cof1?.querySelector('select') || cof2?.querySelector('select')) || null;

  if (!payMethod){
    if (rbCardNew?.checked) payMethod = 'Credit Card';
    else payMethod = 'Bank (ACH)';
  }
  if (!payAccount && payMethod === 'Bank (ACH)'){
    if (rbBankNew?.checked) payAccount = 'Add new bank account';
    else if (rbBankSaved?.checked && cofSel && cofSel.value && cofSel.value !== '-1'){
      payAccount = cofSel.options[cofSel.selectedIndex]?.text || 'Saved bank account';
    }
  }
}catch(e){}

return {
  total: totalStr ? formatUSD(parseMoney(totalStr)) : '',
  addrSelText, billing, zip, email,
  payMethod, payAccount,
  invCount: invs.length,
  invs
};
}


  // Jump to a wizard step from outside the wizard module (used by Summary "Edit" buttons)
  function jumpToWizardStep(n){
    const wiz = document.getElementById('wlApWizard3');
    if (!wiz) return false;
    const step = Math.max(0, Math.min(3, Number(n||0)));
    try{ sessionStorage.setItem('__WL_AP_WIZ3_STEP', String(step)); }catch(e){}
    try{
      wiz.querySelectorAll('[data-pill]').forEach(p=>{
        p.classList.toggle('on', Number(p.getAttribute('data-pill')) === step);
      });
      wiz.querySelectorAll('.w3-panel').forEach(p=>{
        p.classList.toggle('on', Number(p.getAttribute('data-step')) === step);
      });
      const back = wiz.querySelector('#w3Back');
      const next = wiz.querySelector('#w3Next');
      if (back) back.disabled = (step === 0);
      if (next) next.textContent = (step === 3) ? 'Ready' : 'Next';
    }catch(e){}
    try{ wiz.scrollIntoView({behavior:'smooth', block:'start'}); }catch(e){}
    return true;
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
      <div class="wl-row"><div class="wl-key">Invoices</div><div class="wl-val">${d.invCount} item${d.invCount===1?'':'s'} <button type="button" class="wl-link wl-edit-btn" data-editstep="1">Edit</button> ${d.invCount>6?`<button type="button" class="wl-link" id="wlShowAllInv">View all</button>`:''}</div></div>
      <div class="wl-row"><div class="wl-key">Total</div><div class="wl-val">${d.total || '<small>—</small>'} <button type="button" class="wl-link wl-edit-btn" data-editstep="1">Edit</button></div></div>
      <div class="wl-row"><div class="wl-key">Payment</div><div class="wl-val">${(d.payMethod || '<small>—</small>')}${d.payAccount ? `<br><small>${d.payAccount}</small>` : ''}</div></div>
      <div class="wl-row"><div class="wl-key">Address</div><div class="wl-val">${d.addrSelText || '<small>(none)</small>'}</div></div>
      <div class="wl-row"><div class="wl-key">Billing</div><div class="wl-val">${d.billing || '<small>—</small>'} <button type="button" class="wl-link wl-edit-btn" data-editstep="0">Edit</button><br>${d.zip ? `<small>ZIP ${d.zip}</small>` : ''}</div></div>
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
    // Edit buttons (jump back into wizard)
    try{
      list.querySelectorAll('[data-editstep]').forEach(b=>{
        b.addEventListener('click', ()=>{
          const s = Number(b.getAttribute('data-editstep')||'0');
          try{ sessionStorage.setItem(STEP_KEY, String(s)); }catch(e){}
          try{ jumpToWizardStep(s); }catch(e){}
          try{ document.getElementById('wlApWizard3')?.scrollIntoView({behavior:'smooth', block:'start'}); }catch(e){}
        });
      });
    }catch(e){}
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

  
  // Shadow pay-by selection used by legacy paths. Some builds omitted the helper; keep it safe.
  // This prevents a hard crash that breaks wizard navigation.
  function ensureShadowPayBy(mode){
    try{
      // Prefer a hidden input if present; otherwise store in sessionStorage
      const hid = document.getElementById('wlShadowPayBy');
      if (hid) hid.value = String(mode||'');
      sessionStorage.setItem('wl_shadowPayBy', String(mode||''));
      return true;
    }catch(e){}
    return false;
  }

const IDS = {
    rbCheck: 'ctl00_PageBody_RadioButton_PayByCheck',
    rbCredit:'ctl00_PageBody_RadioButton_PayByCredit',
    rbCOF:  'ctl00_PageBody_RadioButton_PayByCheckOnFile',
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
    const cof = document.getElementById(IDS.rbCOF);

    // If the user already made a choice this session, don't override defaults.
    try{
      if (sessionStorage.getItem('wlPayState')) return false;
    }catch(e){}

    const cofSel = document.querySelector('#ctl00_PageBody_ChecksOnFileContainer select, #ctl00_PageBody_ChecksOnFileContainer1 select');
    const hasSaved = !!(cofSel && Array.from(cofSel.options||[]).some(o=>{
      const v = String(o.value||'').trim();
      return v && v !== '-1';
    }));

    if (!chk && !cr && !cof){ log.warn('setPayByCheckDefaultIfUnset: radios missing'); return false; }

    // If credit is already selected, honor it.
    if (cr && cr.checked){
      ensureShadowPayBy('credit');
      log.info('setPayByCheckDefaultIfUnset:', evtLabel||'(boot)', { honored:'credit' });
      return true;
    }

    // Prefer "Check on File" (saved bank) when available so saved accounts are visible by default.
    if (cof && (cof.checked || (!chk?.checked && hasSaved))){
      if (!cof.checked) cof.checked = true;
      if (chk) chk.checked = false;
      if (cr) cr.checked = false;
      ensureShadowPayBy('cof');
      log.info('setPayByCheckDefaultIfUnset:', evtLabel||'(boot)', { set:'cof' });
      return true;
    }

    // Otherwise honor check if already selected
    if (chk && chk.checked){
      ensureShadowPayBy('check');
      log.info('setPayByCheckDefaultIfUnset:', evtLabel||'(boot)', { honored:'check' });
      return true;
    }

    // Default to check
    if (chk){
      chk.checked = true;
      if (cof) cof.checked = false;
      if (cr) cr.checked = false;
      ensureShadowPayBy('check');
      log.info('setPayByCheckDefaultIfUnset:', evtLabel||'(boot)', { set:'check' });
      return true;
    }

    return false;
  }

  // Hidden input mirrors the CURRENT pay mode (does not force a mode)
  function readPayMode(){
    // Prefer real radios on the page (Check, Check-on-file, Credit)
    const cof = document.getElementById('ctl00_PageBody_RadioButton_PayByCheckOnFile');
    const cr  = document.getElementById('ctl00_PageBody_RadioButton_PayByCredit');
    const ck  = document.getElementById('ctl00_PageBody_RadioButton_PayByCheck');
    if (cof && cof.checked) return 'check_on_file';
    if (cr  && cr.checked)  return 'credit';
    return 'check';
  }

  function setPayMode(mode){
    const m = String(mode||'').toLowerCase();
    const cof = document.getElementById('ctl00_PageBody_RadioButton_PayByCheckOnFile');
    const cr  = document.getElementById('ctl00_PageBody_RadioButton_PayByCredit');
    const ck  = document.getElementById('ctl00_PageBody_RadioButton_PayByCheck');

    const target = (m === 'check_on_file' || m === 'cof' || m === 'checkonfile') ? cof
                 : (m === 'credit') ? cr
                 : ck;

    if (!target) return false;

    // Some WebForms radios trigger postbacks via onclick — use click(), not checked=true.
    try { target.disabled = false; target.removeAttribute('disabled'); } catch {}
    target.click();
    return true;
  }

  function ensureCheckOnFileUI(){
    const c1 = document.getElementById('ctl00_PageBody_ChecksOnFileContainer');
    const c2 = document.getElementById('ctl00_PageBody_ChecksOnFileContainer1');
    const rb = document.getElementById('ctl00_PageBody_RadioButton_PayByCheckOnFile');

    // Force containers visible (they may be display:none until postback)
    [c1,c2].forEach(c=>{
      if (!c) return;
      c.hidden = false;
      c.style.setProperty('display','block','important');
      c.style.setProperty('visibility','visible','important');
      c.style.setProperty('opacity','1','important');
    });

    if (rb){
      rb.disabled = false;
      rb.removeAttribute('disabled');
      rb.style.pointerEvents = 'auto';
    }

    // Ensure select is usable
    const sel = (c1?.querySelector('select') || c2?.querySelector('select'));
    if (sel){
      sel.disabled = false;
      sel.removeAttribute('disabled');
      sel.style.pointerEvents = 'auto';
    }
  }

  // expose for other modules
  window.WLPayMode = { readPayMode, setPayMode, ensureCheckOnFileUI };

  function showBilling(){
    const box = document.getElementById(IDS.billBox);
    // try explicit container first
    let wrap = document.getElementById(IDS.billWrap) || null;

    // fall back to closest reasonable wrapper around the textbox
    if (!wrap && box){
      wrap =
        box.closest('#'+IDS.billWrap) ||
        box.closest('.epi-form-group-acctPayment') ||
        box.closest('.epi-form-group') ||
        box.closest('.form-group') ||
        box.closest('tr') ||
        box.parentElement;
    }

    if (wrap){
      wrap.style.removeProperty('display');
      wrap.classList.add('wl-force-show');

      // Ensure our Step 1 grid exists so the field has a stable home
      let grid = document.getElementById('wlFormGrid');
      if (!grid){
        const s1 = document.getElementById('wlStep1') || document.querySelector('[data-wl-step="1"]') || document.getElementById('w1') || null;
        if (s1){
          grid = document.createElement('div');
          grid.id = 'wlFormGrid';
          grid.className = 'wl-form-grid';
          s1.appendChild(grid);
        }
      }

      if (grid && !grid.contains(wrap)) grid.appendChild(wrap);

      log.info('showBilling: ensured', { id: wrap.id || '(no id)', parent: wrap.parentElement?.id || '(none)' });
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
            try{ if (window.WLPayPending && typeof window.WLPayPending.apply === 'function') window.WLPayPending.apply(); }catch(e){}
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
    try{ window.ensureShadowPayBy?.(); }catch(e){}
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
    }catch(e){}
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();





























/* ==========================================================
   Woodson — Quick Payment Actions (v2.1)
   - Cross-mode clearing (Amount + our Remittance lines)
   - Delegated click for Jobs modal (survives re-mounts/postbacks)
   - Pointerdown clear for Fill/Invoice/Job to avoid stacking
   - Exposes WL_AP.jobs.clearSelection()
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
      .wl-quick { border:1px solid #e5e7eb; border-radius:14px; background:#fff; padding:12px 14px; box-shadow:0 4px 14px rgba(15,23,42,.06); }
      .wl-quick-title { font-weight:900; margin:0 0 8px 0; font-size:14px; color:#0f172a; }
      .wl-quick-row { display:flex; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:6px; }
      .wl-chipbtn{ border:1px solid #e5e7eb; border-radius:999px; padding:6px 12px; background:#fff; font-weight:800; font-size:12px; cursor:pointer; }
      .wl-chipbtn[disabled]{ opacity:.6; cursor:not-allowed; }
      .wl-modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.5); display:none; z-index:9999; }
      .wl-modal-shell { position:fixed; inset:0; display:none; z-index:10000; }
      .wl-modal-card { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); background:#fff; border-radius:16px; width:min(1100px,94vw); max-height:86vh; box-shadow:0 20px 60px rgba(0,0,0,.25); display:flex; flex-direction:column; }
      .wl-modal-head { padding:12px 16px; background:#6b0016; color:#fff; font-weight:900; display:flex; justify-content:space-between; align-items:center; border-radius:16px 16px 0 0; }
      .wl-modal-head .right { display:flex; align-items:center; gap:8px; }
      .wl-modal-pill { background:rgba(255,255,255,.16); border:1px solid rgba(255,255,255,.25); border-radius:999px; padding:4px 8px; font-weight:800; }
      .wl-modal-body { padding:12px 16px; overflow:auto; }
      .wl-modal-foot { padding:12px 16px; display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #e5e7eb; }
      .wl-btn { border:1px solid #e5e7eb; border-radius:10px; padding:8px 12px; font-weight:800; background:#fff; cursor:pointer; }
      .wl-btn:focus-visible { outline:0; box-shadow:0 0 0 3px #93c5fd; }
      .wl-btn-primary { background:#6b0016; color:#fff; border-color:#6b0016; }
      .wl-btn-ghost { background:transparent; color:#fff; border-color:rgba(255,255,255,.35); }
      .wl-jobs-list { display:grid; gap:8px; }
      .wl-job-line { display:flex; align-items:center; gap:10px; }
      .wl-job-line input { transform:translateY(1px); }
      .wl-modern-grid table { border-collapse:separate; border-spacing:0; width:100%; font-size:14px; }
      .wl-modern-grid thead th { position:sticky; top:0; background:#f8fafc; z-index:1; font-weight:800; letter-spacing:.01em; border-bottom:1px solid #e5e7eb; padding:10px 12px; }
      .wl-modern-grid tbody tr { transition:background .15s ease, box-shadow .15s ease; }
      .wl-modern-grid tbody tr:hover { background:#f9fafb; }
      .wl-modern-grid td { border-bottom:1px solid #eef2f7; padding:10px 12px; }
      .wl-modern-grid .rgPager, .wl-modern-grid .paging-control { border-top:1px solid #e5e7eb; padding-top:8px; margin-top:8px; }
      .wl-modern-grid .rgHeader, .wl-modern-grid .panelHeaderMidProductInfo1, .wl-modern-grid .ViewHeader { display:none !important; }
      @media (min-width:768px){ .wl-form-grid{ gap:14px 16px; } .wl-field{ gap:6px; width:80%; } }
    `;
    const s = document.createElement('style'); s.id='wl-quick-widget-css'; s.textContent = css;
    document.head.appendChild(s);
  })();

  /* ---------- helpers ---------- */
  const $id = (x)=> document.getElementById(x);
  const $1  = (sel,root=document)=> root.querySelector(sel);
  function parseMoney(s){ const v = parseFloat(String(s||'').replace(/[^0-9.\-]/g,'')); return Number.isFinite(v)?v:0; }
  function format2(n){ const v = Number(n||0); return v.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2}); }
  const amtEl = ()=> $id('ctl00_PageBody_PaymentAmountTextBox');
  const remEl = ()=> $id('ctl00_PageBody_RemittanceAdviceTextBox');
  const owingVal = ()=> { const el = $id('ctl00_PageBody_AmountOwingLiteral'); return el ? parseMoney(el.value || el.textContent) : 0; };
  function triggerChange(el){ try{ el.dispatchEvent(new Event('change',{bubbles:true})); }catch(e){} }

  /* ---------- cross-mode clearing ---------- */
  const MODE = { STATEMENT:'statement', INVOICE:'invoice', JOB:'job', FILL:'fill' };

  function clearRemittanceInjectedLines(){
    const r = remEl(); if (!r) return;
    const kept = (r.value||'').split(/\r?\n/)
      .filter(Boolean)
      .filter(l => !/^\s*(Docs:|Documents:)\s*/i.test(l))
      .filter(l => !/^\s*JOB\s+/i.test(l))
      .filter(l => !/^\s*STATEMENT\b/i.test(l));
    r.value = kept.join('\n');
    triggerChange(r);
  }
  function clearAmount(){ const a = amtEl(); if (!a) return; a.value = ''; triggerChange(a); }
  function clearLastStmtRadio(){ const r = $id('lastStatementRadio'); if (r) r.checked = false; }

  function clearInvoiceSelectionUI(){
    try{ window.WL_AP?.invoice?.clearSelection?.(); }catch(e){}
  }
  function clearJobsSelectionUI(){
    try{ window.WL_AP?.jobs?.clearSelection?.(); }catch(e){}
  }
  function clearQuickState(exceptMode){
    clearAmount();
    clearRemittanceInjectedLines();
    clearLastStmtRadio();
    if (exceptMode !== MODE.INVOICE) clearInvoiceSelectionUI();
    if (exceptMode !== MODE.JOB)     clearJobsSelectionUI();
  }

  /* ---------- Pay My Last Statement ---------- */
  async function fetchLastStatement_jq(){
    return new Promise((resolve,reject)=>{
      try{
        window.jQuery.ajax({
          url:'https://webtrack.woodsonlumber.com/Statements_R.aspx',
          method:'GET',
          success:(data)=> {
            try{
              const $ = window.jQuery;
              const row = $(data).find('tr#ctl00_PageBody_StatementsDataGrid_ctl00__0');
              const closing = row.find('td[data-title="Closing Balance"]').text().trim();
              const date = row.find('td[data-title="Statement Date"]').text().trim()
                         || row.find('td[data-title*="Date"]').first().text().trim()
                         || '';
              resolve({ closing, date });
            }catch(e){ reject(e); }
          },
          error:()=>reject(new Error('Ajax error'))
        });
      }catch(e){ reject(e); }
    });
  }
  async function fetchLastStatement_fetch(){
    const res = await fetch('https://webtrack.woodsonlumber.com/Statements_R.aspx', { credentials:'include' });
    if (!res.ok) throw new Error('HTTP '+res.status);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html,'text/html');
    const row = doc.querySelector('tr#ctl00_PageBody_StatementsDataGrid_ctl00__0');
    const closing = (row?.querySelector('td[data-title="Closing Balance"]')?.textContent || '').trim();
    const date = (row?.querySelector('td[data-title="Statement Date"]')?.textContent
               || row?.querySelector('td[data-title*="Date"]')?.textContent
               || '').trim();
    return { closing, date };
  }
  function upsertRemittanceStatement(dateStr, amountNum){
    clearRemittanceInjectedLines();
    const r = remEl(); if (!r) return;
    const line = `STATEMENT ${dateStr || 'LAST'} — $${format2(amountNum)}`;
    r.value = line;
    triggerChange(r);
  }
  async function handlePayLastStatement(btn){
    if (!btn) return;
    clearQuickState(MODE.STATEMENT);
    const orig = btn.textContent;
    btn.textContent = 'Fetching…';
    btn.disabled = true;
    try{
      const { closing, date } = (window.jQuery ? await fetchLastStatement_jq() : await fetchLastStatement_fetch());
      if (!closing){ alert('Could not find last statement amount.'); return; }
      const amtNum = parseMoney(closing);
      const a = amtEl(); if (a){ a.value = Number.isFinite(amtNum) ? format2(amtNum) : closing; triggerChange(a); }
      upsertRemittanceStatement(date, amtNum);
      btn.textContent = 'Last Statement Applied';
      setTimeout(()=>{ btn.textContent = orig; btn.disabled = false; }, 900);
    }catch(e){
      console.warn(e);
      alert('Error fetching data.');
      btn.textContent = orig; btn.disabled = false;
    }
  }

  /* ---------- Jobs Modal (self-contained) ---------- */
  const SESS_JOBS_OPEN = '__WL_JobsModalOpen';
  const SESS_JOBS_SEL  = '__WL_JobsSelection';

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

  const list = document.getElementById('wlJobsList');
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
    const prevSel = JSON.parse(sessionStorage.getItem(SESS_JOBS_SEL) || '{}');
    if (prevSel && Object.keys(prevSel).length){
      list.querySelectorAll('input[type="checkbox"]').forEach(cb=>{
        if (prevSel[cb.dataset.job] != null) cb.checked = true;
      });
    }
    list.addEventListener('change', jobsUpdateSummary, { passive:true });
  }
  jobsUpdateSummary();
  document.getElementById('wlJobsModalBackdrop').style.display='block';
  document.getElementById('wlJobsModal').style.display='block';
  document.body.style.overflow='hidden';
  sessionStorage.setItem(SESS_JOBS_OPEN,'1');
  const btn = document.getElementById('wlOpenJobsModalBtn'); if (btn){ btn.disabled = true; btn.setAttribute('aria-disabled','true'); }
}

  function closeJobsModal(){
    $id('wlJobsModalBackdrop').style.display='none';
    $id('wlJobsModal').style.display='none';
    document.body.style.overflow='';
    sessionStorage.removeItem(SESS_JOBS_OPEN);
    const btn = $id('wlOpenJobsModalBtn'); if (btn){ btn.disabled = false; btn.removeAttribute('aria-disabled'); btn.focus?.(); }
  }
 function commitJobsSelection(){
  const list = document.getElementById('wlJobsList'); 
  if (!list){ closeJobsModal(); return; }

  const checks = Array.from(list.querySelectorAll('input[type="checkbox"]'));
  const sel = checks.filter(c => c.checked);
  if (sel.length === 0){
    alert('Select at least one job.');
    return;
  }

  // Build { job -> amount } and compute total
  const newSel = {};
  sel.forEach(c => newSel[c.dataset.job] = parseMoney(c.value));
  const total = Object.values(newSel).reduce((s,v)=> s + Number(v||0), 0);

  // Format: "Job name - $12.34 balance as of <Today>"
  const dateStr = new Date().toLocaleDateString(undefined, { year:'numeric', month:'long', day:'numeric' });
  const sanitizeJob = (name) => String(name||'').replace(/[\r\n]+/g, ' ').replace(/,+/g, ' ').trim();

  const tokens = Object.entries(newSel).map(([job, amt]) => {
    const j = sanitizeJob(job);
    const a = Number(amt||0).toFixed(2);            // 2 decimals
    return `${j} - $${a} balance as of ${dateStr}`;
  });

  const remitVal = tokens.join(', ');               // comma-separated on one line

  // Defer remittance write until after amount postback finishes
  try { window.WL_AP?.remit?.defer(remitVal); } catch {}

  // Amount = sum of selected jobs (and make it stick server-side)
  const a = amtEl();
  if (a){
    a.value = format2(total);
    try {
      a.dispatchEvent(new Event('input',  { bubbles:true }));
      a.dispatchEvent(new Event('change', { bubbles:true }));
    } catch {}
    try {
      if (typeof window.__doPostBack === 'function'){
        const uniqueId = a.id.replace(/_/g, '$');
        setTimeout(() => window.__doPostBack(uniqueId, ''), 0);
      }
    } catch {}
  }

  // Persist and clear invoice selections so modes don't stack
  try { sessionStorage.setItem('__WL_JobsSelection', JSON.stringify(newSel)); } catch {}
  try { window.WL_AP?.invoice?.clearSelection?.(); } catch {}

  closeJobsModal();
}






  // Export clearer for cross-mode wipes
  window.WL_AP = window.WL_AP || {};
  window.WL_AP.jobs = {
    clearSelection(){
      try{ sessionStorage.removeItem(SESS_JOBS_SEL); }catch(e){}
      const list = $id('wlJobsList');
      if (list){
        list.querySelectorAll('input[type="checkbox"]').forEach(cb=> cb.checked = false);
        jobsUpdateSummary();
      }
      const r = remEl();
      if (r){
        const kept = (r.value||'').split(/\r?\n/).filter(Boolean).filter(l=> !/^\s*JOB\s+/i.test(l));
        r.value = kept.join('\n');
        triggerChange(r);
      }
    }
  };

  /* ---------- Build the widget ---------- */
  
  /* =======================
     PATCH: keep Billing on Step 1 (Info)
     ======================= */
  function pinBillingToStep1(opts){
    // Proxy workaround:
    // Keep the REAL WebForms BillingAddressTextBox in its native location so its onchange postback works.
    // Render a proxy input on Step 1 that mirrors/syncs to the real control.
    opts = opts || {};
    const attempt = opts.attempt || 0;

    const infoInner = document.getElementById('w3InfoInner');
    const realInput = document.getElementById('ctl00_PageBody_BillingAddressTextBox');

    if (!infoInner || !realInput){
      // If the server hid the real billing control after postback, still show the captured value.
      try{
        const locked = loadBillingLock();
        if (infoInner && locked){
          renderBillingDisplay(infoInner, locked, 'form-control');
        }
      }catch(e){}
      if (attempt < 10){
        setTimeout(()=>{ try{ pinBillingToStep1({ attempt: attempt + 1 }); }catch(e){} }, 80 * (attempt + 1));
      }
      return;
    }

    const realWrap = realInput.closest('.epi-form-group-acctPayment') || realInput.parentElement;
    const emailWrap = document.getElementById('ctl00_PageBody_EmailTextBox')?.closest('.epi-form-group-acctPayment') || null;

    // Create proxy wrapper once
    let proxyWrap = document.getElementById('wlProxyBillingWrap');
    if (!proxyWrap){
      proxyWrap = document.createElement('div');
      proxyWrap.id = 'wlProxyBillingWrap';
      proxyWrap.className = (realWrap && realWrap.className) ? realWrap.className : 'epi-form-group-acctPayment';

      // Try to reuse existing label text if present
      let labelHtml = '';
      const realLabel = realWrap ? realWrap.querySelector('label') : null;
      if (realLabel){
        labelHtml = `<label class="${realLabel.className}">${realLabel.textContent || 'Billing Address'}</label>`;
      } else {
        labelHtml = `<label>Billing Address</label>`;
      }

      proxyWrap.innerHTML = `${labelHtml}
        <input id="wlProxyBillingInput" type="text" maxlength="${realInput.getAttribute('maxlength')||'30'}"
               class="${realInput.className || 'form-control'}" autocomplete="billing address-line1">`;

      // Insert proxy before Email when possible
      if (emailWrap && emailWrap.parentElement === infoInner){
        infoInner.insertBefore(proxyWrap, emailWrap);
      } else {
        infoInner.appendChild(proxyWrap);
      }

      // Wire sync behavior
      const proxyInput = proxyWrap.querySelector('#wlProxyBillingInput');

      // Inline confirmation message (reassures billing saved)
      let billConfirm = document.getElementById('wlBillingInlineConfirm');
      if (!billConfirm){
        billConfirm = document.createElement('div');
        billConfirm.id = 'wlBillingInlineConfirm';
        billConfirm.className = 'wl-inline-confirm';
        billConfirm.textContent = '';
        // Place it right under the billing input
        proxyWrap.appendChild(billConfirm);
      }
      let billConfirmTimer = 0;
      function showBillConfirm(msg, ok){
        try{
          if (!billConfirm) return;
          billConfirm.textContent = String(msg||'');
          billConfirm.classList.add('on');
          billConfirm.classList.toggle('ok', !!ok);
          billConfirm.classList.toggle('bad', ok===false);
          if (billConfirmTimer) clearTimeout(billConfirmTimer);
          billConfirmTimer = setTimeout(()=>{ try{ billConfirm.classList.remove('on'); }catch(e){} }, ok===false ? 6500 : 3500);
        }catch(e){}
      }


      // Restore draft after reload (if WebForms didn't keep it)
      try{
        const draft = loadBillDraft();
        if (draft && !realInput.value) realInput.value = draft;
      }catch(e){}

      // Initial mirror
      proxyInput.value = realInput.value || '';

      // If we already have a locked billing value (after a round-trip), show it and hide proxy input.
      try{
        const locked = (loadBillingLock() || '').trim();
        if (locked){
          renderBillingDisplay(infoInner, locked, realInput.className || 'form-control');
          proxyWrap.style.display = 'none';
          proxyWrap.setAttribute('aria-hidden','true');
        } else {
          const disp = document.getElementById('wlBillingDisplayWrap');
          if (disp) disp.remove();
          proxyWrap.style.removeProperty('display');
          proxyWrap.removeAttribute('aria-hidden');
        }
      }catch(e){}

      // Keep proxy updated after postbacks (when real input value might change)
      proxyInput.addEventListener('focus', () => {
        try { proxyInput.value = realInput.value || ''; } catch {}
      });

      // On typing, just mirror value (no postback)
      proxyInput.addEventListener('input', () => {
        try { realInput.value = proxyInput.value; } catch {}
      });

      // On blur/change: save draft, lock it for display, and force the same server round-trip as "Make Payment"
      // (this re-renders the WebForms controls and prevents the "vanishing billing" blank state).
      const commit = (opts) => {
        opts = opts || {};
        const v = (proxyInput.value || '').trim();
        try { realInput.value = v; } catch {}
        try { saveBillDraft(v); } catch {}

        // Reassure the user the value is captured (no forced postback here)
        try{
          if (v) showBillConfirm('Billing address saved ✔', true);
          else showBillConfirm('Billing address is blank — please enter it before continuing.', false);
        }catch(e){}

        // fire events so any existing listeners still run
        try { realInput.dispatchEvent(new Event('input', {bubbles:true})); } catch {}
        try { realInput.dispatchEvent(new Event('change', {bubbles:true})); } catch {}
      };
      proxyInput.addEventListener('blur', ()=>commit());
      proxyInput.addEventListener('change', ()=>commit());
      proxyInput.addEventListener('keydown', (e)=>{
        if (e.key === 'Enter'){
          e.preventDefault();
          commit();
        }
      });
    } else {
      // Ensure proxy stays in Step 1, before Email
      const proxyInput = proxyWrap.querySelector('#wlProxyBillingInput');
      if (proxyInput) proxyInput.value = realInput.value || '';

      if (proxyWrap.parentElement !== infoInner){
        if (emailWrap && emailWrap.parentElement === infoInner){
          infoInner.insertBefore(proxyWrap, emailWrap);
        } else {
          infoInner.appendChild(proxyWrap);
        }
      } else {
        if (emailWrap && emailWrap.parentElement === infoInner){
          if (proxyWrap.nextElementSibling !== emailWrap){
            infoInner.insertBefore(proxyWrap, emailWrap);
          }
        }
      }
    }

    // Keep REAL billing control present but hidden (so it doesn't appear on Step 2)
    if (realWrap){
      realWrap.style.display = 'none';
      realWrap.setAttribute('aria-hidden', 'true');
    }

    // Make proxy interactable
    proxyWrap.style.removeProperty('display');
    proxyWrap.style.removeProperty('visibility');
    proxyWrap.style.pointerEvents = 'auto';
    proxyWrap.classList.add('wl-force-show');
  }

function mountWidget(){
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
          <button type="button" class="wl-chipbtn" id="wlLastStmtBtn">Pay My Last Statement</button>
          <button type="button" class="wl-chipbtn" id="wlFillOwingBtn">Fill Owing</button>
          <button type="button" class="wl-chipbtn" id="wlOpenTxModalBtn">Pay by Invoice</button>
          <button type="button" class="wl-chipbtn" id="wlOpenJobsModalBtn">Pay by Job</button>
        </div>
      </div>
    `;

    // Hide Last Statement on disallowed views
    const hdrText = ($1('.bodyFlexItem.listPageHeader')?.textContent || '').trim();
    if (/Load Cash Account Balance/i.test(hdrText)){
      $id('wlLastStmtBtn').style.display = 'none';
    }

    // Wire with clear-first
    $id('wlLastStmtBtn').addEventListener('click', (e)=> handlePayLastStatement(e.currentTarget));

    const fill = $id('wlFillOwingBtn');
    fill.addEventListener('pointerdown', ()=> clearQuickState(MODE.FILL), { capture:true });
    fill.addEventListener('click', ()=>{
      const v=owingVal(); const a=amtEl(); if (a && v>0){ a.value = format2(v); triggerChange(a);}
    });

 
    // --- inside mountWidget(), replace your Invoice/Job wiring with:
const invBtn = document.getElementById('wlOpenTxModalBtn');
if (invBtn){
  // No pre-clear here. The Invoice Picker script handles opening via its own delegated listener.
}

const jobBtn = document.getElementById('wlOpenJobsModalBtn');
if (jobBtn){
  // No pointerdown clear here anymore; just open the modal.
  jobBtn.addEventListener('click', (e)=>{
    e.preventDefault();
    e.stopPropagation();
    openJobsModal();
  });
}


    log.info('Quick Payment Actions mounted');
  }

  /* ---------- Delegated opener for Jobs (survives re-mounts) ---------- */
  document.addEventListener('click', function(e){
    const btn = e.target?.closest?.('#wlOpenJobsModalBtn');
    if (!btn) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.();
    openJobsModal();
  }, true);

  /* ---------- Boot + MS AJAX handling ---------- */
  function boot(){
    mountWidget();
    try{
      if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager){
        const prm = window.Sys.WebForms.PageRequestManager.getInstance();
        if (!prm.__wlQuickWidBound){
          prm.add_endRequest(()=> setTimeout(mountWidget, 30));
          prm.__wlQuickWidBound = true;
        }
      }
    }catch(e){} 
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();














/* ==========================================================
   Woodson — Client-side "Pay by Invoice" picker (v3.2 + TTL)
   - Mobile-friendly stacked rows (labels shown per cell)
   - Delegated click: opens modal on #wlOpenTxModalBtn reliably
   - Cross-mode friendly (exposes WL_AP.invoice.clearSelection/open)
   - Writes "Docs:" line and sets Amount; strips JOB/STATEMENT lines
   - Persists WL_AP_SelectedDocs in localStorage with 30m TTL
   ========================================================== */
(function(){
  'use strict';
  if (!/AccountPayment_r\.aspx/i.test(location.pathname)) return;

  const LOG = (window.WLPayDiag?.getLevel?.() ?? 2), LVL = window.WLPayDiag?.LVL || { error:0, warn:1, info:2, debug:3 };
  const log = {
    error: (...a)=> { if (LOG>=LVL.error) console.error('[AP:TXPICK]', ...a); },
    warn:  (...a)=> { if (LOG>=LVL.warn ) console.warn ('[AP:TXPICK]', ...a); },
    info:  (...a)=> { if (LOG>=LVL.info ) console.log  ('[AP:TXPICK]', ...a); },
    debug: (...a)=> { if (LOG>=LVL.debug) console.log  ('[AP:TXPICK]', ...a); },
  };

  const TX_PANEL_SEL = '#ctl00_PageBody_accountsTransactionsPanel';
  const GRID_SEL     = '#ctl00_PageBody_InvoicesGrid .rgMasterTable, .RadGrid .rgMasterTable';
  const IN_PAGE_URL  = location.pathname + location.search;

  /* ---------- Persisted selection key + TTL helpers ---------- */
  const LS_KEY       = 'WL_AP_SelectedDocs';
  const LS_TTL_MIN   = 30;

  function lsSetWithExpiry(key, value, ttlMinutes = LS_TTL_MIN){
    try{
      const rec = { v: value, exp: Date.now() + ttlMinutes * 60 * 1000 };
      localStorage.setItem(key, JSON.stringify(rec));
    }catch(e){}
  }
  function lsGetWithExpiry(key){
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try{
      const obj = JSON.parse(raw);
      // New format {v,exp}
      if (obj && typeof obj === 'object' && 'exp' in obj && 'v' in obj){
        if (Date.now() > Number(obj.exp || 0)){
          localStorage.removeItem(key);
          return null;
        }
        return obj.v;
      }
      // Legacy array format: migrate + return
      lsSetWithExpiry(key, obj, LS_TTL_MIN);
      return obj;
    }catch{
      localStorage.removeItem(key);
      return null;
    }
  }
  function lsRemove(key){ try{ localStorage.removeItem(key); }catch(e){} }
  function lsTouch(key, ttlMinutes = LS_TTL_MIN){
    const v = lsGetWithExpiry(key);
    if (v == null) return false;
    lsSetWithExpiry(key, v, ttlMinutes);
    return true;
  }
  function saveSelectedDocs(docs, ttlMinutes = LS_TTL_MIN){ lsSetWithExpiry(LS_KEY, docs, ttlMinutes); }
  function loadSelectedDocs(){ return lsGetWithExpiry(LS_KEY); }
  function clearSelectedDocs(){ lsRemove(LS_KEY); }

  const MONEY = s => { const v = parseFloat(String(s||'').replace(/[^0-9.\-]/g,'')); return Number.isFinite(v)?v:0; };
  const FMT2  = n => Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2});

  function nativeSet(el, val){
    if (!el) return false;
    const tag = (el.tagName||'').toLowerCase();
    try{
      if (tag==='input' || tag==='textarea'){
        const proto = tag==='input' ? HTMLInputElement.prototype :
                      tag==='textarea' ? HTMLTextAreaElement.prototype : null;
        const desc = proto && Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && desc.set) desc.set.call(el, val); else el.value = val;
        el.dispatchEvent(new Event('input',{bubbles:true}));
        el.dispatchEvent(new Event('change',{bubbles:true}));
        return true;
      }
      if (el.isContentEditable){
        el.textContent = val;
        el.dispatchEvent(new Event('input',{bubbles:true}));
        el.dispatchEvent(new Event('change',{bubbles:true}));
        return true;
      }
    }catch(e){ log.warn('nativeSet failed', e); }
    return false;
  }
  function setViaTelerik(id, val){
    try{
      const ctl = typeof $find==='function' ? $find(id) : null;
      if (ctl && typeof ctl.set_value === 'function'){ ctl.set_value(val); return true; }
      if (ctl && typeof ctl.set_text === 'function'){ ctl.set_text(val); return true; }
    }catch(e){ log.debug('setViaTelerik error', e); }
    return false;
  }
  function findInnerRadInput(idOrEl){
    const root = typeof idOrEl==='string' ? document.getElementById(idOrEl) : idOrEl;
    if (!root) return null;
    return root.querySelector('.riTextBox, textarea, input[type="text"], input[type="number"]');
  }
  function cssEscape(s){ return String(s).replace(/["\\]/g, '\\$&'); }
  function findFieldByHints({ id, fuzzy, altNames=[] }){
    let el = id ? document.getElementById(id) : null;
    if (el) return el;
    if (id){
      el = findInnerRadInput(id+'_wrapper') || findInnerRadInput(id);
      if (el) return el;
    }
    const sels = [
      id ? `[name="${cssEscape(id)}"]` : null,
      fuzzy ? `[id*="${cssEscape(fuzzy)}"],[name*="${cssEscape(fuzzy)}"]` : null,
      ...altNames.map(n => `[id*="${cssEscape(n)}"],[name*="${cssEscape(n)}"]`)
    ].filter(Boolean).join(',');
    if (sels){
      el = document.querySelector(sels);
      if (el) return el;
      const wrap = document.querySelector(sels);
      if (wrap){
        const inner = findInnerRadInput(wrap);
        if (inner) return inner;
      }
    }
    return null;
  }

  function setRemittanceText(val){
    const idGuess = 'ctl00_PageBody_RemittanceAdviceTextBox';
    if (setViaTelerik(idGuess, val)) return true;
    const el = findFieldByHints({
      id: idGuess,
      fuzzy: 'Remittance',
      altNames: ['RemittanceAdvice','Remit','AdviceText']
    }) || (function(){
      const label = Array.from(document.querySelectorAll('label')).find(l => /remittance/i.test(l.textContent||''));
      if (!label) return null;
      const forId = label.getAttribute('for');
      return (forId && document.getElementById(forId)) || label.closest('div,td,th,section,fieldset')?.querySelector('textarea, input[type="text"]');
    })();
    return el ? nativeSet(el, val) : false;
  }
  function setPaymentAmount(valNumber){
    const show = FMT2(valNumber);
    const idGuess = 'ctl00_PageBody_PaymentAmountTextBox';
    if (setViaTelerik(idGuess, show)) return true;
    const el = findFieldByHints({
      id: idGuess,
      fuzzy: 'PaymentAmount',
      altNames: ['AmountTextBox','PaymentAmountText','Amount','PayAmount']
    });
    return el ? nativeSet(el, show) : false;
  }
  function getRemittanceText(){
    try{
      const idGuess = 'ctl00_PageBody_RemittanceAdviceTextBox';
      const ctl = typeof $find==='function' ? $find(idGuess) : null;
      if (ctl && typeof ctl.get_value === 'function'){ return String(ctl.get_value()||''); }
      if (ctl && typeof ctl.get_text === 'function'){ return String(ctl.get_text()||''); }
    }catch(e){}
    const el = findFieldByHints({
      id: 'ctl00_PageBody_RemittanceAdviceTextBox',
      fuzzy: 'Remittance',
      altNames: ['RemittanceAdvice','Remit','AdviceText']
    }) || (function(){
      const label = Array.from(document.querySelectorAll('label')).find(l => /remittance/i.test(l.textContent||''));
      if (!label) return null;
      const forId = label.getAttribute('for');
      return (forId && document.getElementById(forId)) || label.closest('div,td,th,section,fieldset')?.querySelector('textarea, input[type="text"]');
    })();
    return el ? String(el.value||'') : '';
  }

  /* ---------- State ---------- */
  const state = {
    rows: [],               // [{key, doc, type, tDate, dDate, job, desc, amount, outstanding}]
    selected: new Map(),    // key -> outstanding (Number)
    open: false,
    nextPost: null,
    pageCount: 0,
    maxPages: 50,
    fetchingAll: false,
    fetchedPageIndexes: new Set(),
  };

  /* ---------- CSS ---------- */
  (function css(){
    if (document.getElementById('wl-inv-modal-css')) return;
    const s=document.createElement('style'); s.id='wl-inv-modal-css';
    s.textContent = `
      .wl-modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.5); display:none; z-index:9999; }
      .wl-modal-shell    { position:fixed; inset:0; display:none; z-index:10000; }
      .wl-modal-card     { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
                           background:#fff; border-radius:16px; width:min(1200px,94vw); max-height:86vh;
                           box-shadow:0 20px 60px rgba(0,0,0,.25); display:flex; flex-direction:column; }
      .wl-modal-head     { padding:12px 16px; background:#6b0016; color:#fff; font-weight:900; display:flex;
                           gap:10px; align-items:center; justify-content:space-between; border-radius:16px 16px 0 0; }
      .wl-modal-head .right { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
      .wl-pill           { background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.25);
                           border-radius:999px; padding:4px 8px; font-weight:800; }
      .wl-modal-body     { padding:12px 16px; overflow:auto; }
      .wl-modal-foot     { padding:12px 16px; display:flex; justify-content:space-between; gap:10px; border-top:1px solid #e5e7eb; }
      .wl-btn            { border:1px solid #e5e7eb; border-radius:10px; padding:8px 12px; font-weight:800; background:#fff; cursor:pointer; }
      .wl-btn:focus-visible { outline:0; box-shadow:0 0 0 3px #93c5fd; }
      .wl-btn-primary    { background:#6b0016; color:#fff; border-color:#6b0016; }
      .wl-input          { border:1px solid #e5e7eb; border-radius:10px; padding:8px 10px; min-width:220px; }
      .wl-table-wrap     { border:1px solid #e5e7eb; border-radius:12px; overflow:auto; } /* was hidden */
      table.wl-grid      { width:100%; border-collapse:separate; border-spacing:0; font-size:14px; }
      .wl-grid thead th  { position:sticky; top:0; background:#f8fafc; z-index:1; font-weight:800; letter-spacing:.01em;
                           border-bottom:1px solid #e5e7eb; padding:10px 12px; text-align:left; }
      .wl-grid tbody tr  { transition:background .15s ease; }
      .wl-grid tbody tr:hover { background:#f9fafb; }
      .wl-grid td        { border-bottom:1px solid #eef2f7; padding:10px 12px; vertical-align:top; word-break:break-word; }
      .wl-grid .right    { text-align:right; }
      .wl-type-pill      { display:inline-block; border-radius:999px; padding:2px 8px; font-size:12px; font-weight:800; }
      .wl-type-inv       { background:#eef6ff; color:#1e40af; border:1px solid #c7ddff; }
      .wl-type-cr        { background:#fff7ed; color:#9a3412; border:1px solid #fde1c7; }
      .wl-foot-left      { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
      .wl-btn.wl-btn-ghost{color:#6b0016;}

      /* ---------- Mobile stacked layout ---------- */
      @media (max-width: 680px){
        .wl-modal-card { width:96vw; max-height:92vh; }
        .wl-modal-head .right { gap:6px; }
        .wl-grid thead { display:none; }
        .wl-grid tbody tr { display:block; padding:6px 0; border-bottom:1px solid #e5e7eb; }
        .wl-grid td { display:grid; grid-template-columns: 40% 60%; gap:6px; border-bottom:0; padding:8px 12px; }
        .wl-grid td::before { content: attr(data-label); font-weight:700; color:#374151; }
        .wl-grid td.right { text-align:left; }
        .wl-grid td input[type="checkbox"]{ transform: scale(1.2); }
      }
    `;
    document.head.appendChild(s);
  })();

  /* ---------- Modal DOM ---------- */
  function ensureModal(){
    if (document.getElementById('wlInvModal')) return;
    document.querySelectorAll('#wlInvBackdrop, #wlInvModal').forEach(n=>n.remove());

    const back = document.createElement('div'); back.id='wlInvBackdrop'; back.className='wl-modal-backdrop';
    const shell = document.createElement('div'); shell.id='wlInvModal'; shell.className='wl-modal-shell';
    shell.innerHTML = `
      <div class="wl-modal-card" role="dialog" aria-modal="true" aria-labelledby="wlInvTitle">
        <div class="wl-modal-head">
          <div id="wlInvTitle">Select Invoices (Recent Transactions)</div>
          <div class="right">
            <input id="wlInvFilter" class="wl-input" type="text" placeholder="Search doc #, job, PO, notes">
            <span class="wl-pill" id="wlInvStats">0 selected · $0.00</span>
            <button type="button" class="wl-btn" id="wlTxReloadBtn" title="Reload from page">Reload</button>
            <button type="button" class="wl-btn" id="wlTxLoadAllBtn" title="Fetch all pages">Load all</button>
            <button type="button" class="wl-btn wl-btn-primary" id="wlInvDoneBtn">Done</button>
            <button type="button" class="wl-btn" id="wlInvCloseX" aria-label="Close">Close</button>
          </div>
        </div>
        <div class="wl-modal-body">
          <div class="wl-table-wrap">
            <table class="wl-grid" id="wlInvTable" aria-describedby="wlInvLoadedBadge">
              <thead>
                <tr>
                  <th style="width:40px;"><input type="checkbox" id="wlInvSelectAll"></th>
                  <th>Doc #</th>
                  <th>Type</th>
                  <th>Trans Date</th>
                  <th>Due Date</th>
                  <th>Job Ref</th>
                  <th>Description</th>
                  <th class="right">Amount</th>
                  <th class="right">Outstanding</th>
                </tr>
              </thead>
              <tbody id="wlInvTbody">
                <tr><td colspan="9" style="padding:14px;">Loading…</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="wl-modal-foot">
          <div class="wl-foot-left">
            <span id="wlInvLoadedBadge" class="muted"></span>
          </div>
          <div class="wl-foot-right"></div>
        </div>
      </div>`;
    document.body.appendChild(back);
    document.body.appendChild(shell);

    back.addEventListener('click', closeModal);
    document.getElementById('wlInvCloseX').addEventListener('click', closeModal);

    document.getElementById('wlInvFilter').addEventListener('input', renderRows);
    document.getElementById('wlInvSelectAll').addEventListener('change', (e)=>{
      const c = e.currentTarget.checked;
      document.querySelectorAll('#wlInvTbody input[type="checkbox"]').forEach(cb=>{
        cb.checked = c; toggleSel(cb.dataset.key, MONEY(cb.dataset.outstanding), c);
      });
      persistSelection(); renderStats();
    });
    document.getElementById('wlTxReloadBtn').addEventListener('click', ()=> { loadFromCurrentDOM(); });
    document.getElementById('wlTxLoadAllBtn').addEventListener('click', loadAllPages);
    document.getElementById('wlInvDoneBtn').addEventListener('click', commitSelection);
    document.addEventListener('keydown', (e)=>{ if (e.key==='Escape' && state.open) closeModal(); });
  }

  function openModal(){
    if (state.open) return;
    ensureModal();
    document.getElementById('wlInvBackdrop').style.display = 'block';
    document.getElementById('wlInvModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
    state.open = true;

    // Refresh TTL on active use
    lsTouch(LS_KEY);

    seedSelectionKeys();     // from LS + Remittance
    loadFromCurrentDOM();    // immediate
    loadAllPages().catch(e=> log.error('auto loadAll error', e)); // async fill
  }
  function closeModal(){
    document.getElementById('wlInvBackdrop')?.style && (document.getElementById('wlInvBackdrop').style.display = 'none');
    document.getElementById('wlInvModal')?.style && (document.getElementById('wlInvModal').style.display = 'none');
    document.body.style.overflow = '';
    state.open = false;
  }

  /* ---------- Extract + Loaders ---------- */
  function extractFromRoot(root){
    const out = [];
    const panel = root.querySelector(TX_PANEL_SEL);
    if (!panel) return out;
    const grid = panel.querySelector(GRID_SEL);
    if (!grid) return out;

    const bodyRows = Array.from(grid.querySelectorAll('tbody > tr'));
    bodyRows.forEach(tr=>{
      if (tr.querySelector('th')) return;
      const cell = (title)=> tr.querySelector(`td[data-title="${title}"]`)?.textContent.trim() || '';
      const type  = cell('Type');
      const tDate = cell('Transaction Date') || cell('Trans Date') || cell('Date');
      const doc   = cell('Doc. #') || cell('Document #') || cell('Doc #') || cell('Invoice #') || cell('Invoice');
      const dDate = cell('Due Date');
      const job   = cell('Job Ref') || cell('Job') || cell('Job Name') || cell('Project');
      const desc  = cell('Customer Ref') || cell('Description') || cell('Notes') || cell('Reference');
      const amt   = cell('Amount') || cell('Doc Amount') || cell('Amount With Tax');
      const outst = cell('Amount Outstanding') || cell('Outstanding') || cell('Balance');
      const key   = String(doc||'').trim();
      if (!key) return;
      out.push({ key, doc:key, type:(type||'').trim(), tDate, dDate, job:job||'', desc:desc||'', amount:amt||'0', outstanding:outst||amt||'0' });
    });
    return out;
  }

  function forceAmountPostback(){
    const a = document.getElementById('ctl00_PageBody_PaymentAmountTextBox');
    if (!a) return;
    try{ a.dispatchEvent(new Event('input', { bubbles:true })); a.dispatchEvent(new Event('change', { bubbles:true })); }catch(e){}
    try{
      if (typeof window.__doPostBack === 'function'){
        const uniqueId = a.id.replace(/_/g,'$');
        setTimeout(()=> window.__doPostBack(uniqueId, ''), 0);
      }
    }catch(e){}
  }

  function loadFromCurrentDOM(){
    const tbody = document.getElementById('wlInvTbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="padding:14px;">Reading recent transactions…</td></tr>`;
    const rows = extractFromRoot(document);
    state.rows = rows;
    state.pageCount = 1;
    state.nextPost = parseNextFromRoot(document) || null;

    const hereIdx = getCurrentPageIndexFromDoc(document);
    if (hereIdx != null) state.fetchedPageIndexes.add(hereIdx);

    reconcileSelectedAmounts();
    renderRows();

    badge(`Loaded ${rows.length} row(s) from current page${hasAnchorPager(document)?' · more available':''}`);
    log.info('Loaded current DOM rows', { count: rows.length, hasNext: !!state.nextPost });
  }
  function badge(t){ const b = document.getElementById('wlInvLoadedBadge'); if (b) b.textContent = t; }

  /* ---------- Anchor pager helpers ---------- */
  function hasAnchorPager(root){
    const panel = root.querySelector(TX_PANEL_SEL);
    return !!panel?.querySelector('ul.pagination a[href*="pageIndex="]');
  }
  function getCurrentPageIndexFromDoc(root){
    const active = root.querySelector('ul.pagination li.page-item.active a.page-link[href*="pageIndex="]');
    if (!active) return null;
    try{
      const u = new URL(active.getAttribute('href'), location.href);
      const idx = parseInt(u.searchParams.get('pageIndex')||'0',10);
      return Number.isFinite(idx) ? idx : null;
    }catch{ return null; }
  }
  function collectPageLinks(root){
    const panel = root.querySelector(TX_PANEL_SEL); if (!panel) return [];
    const as = Array.from(panel.querySelectorAll('ul.pagination a.page-link[href*="pageIndex="]'));
    const links = new Map();
    as.forEach(a=>{
      const href = a.getAttribute('href')||'';
      try{
        const u = new URL(href, location.href);
        if (!u.searchParams.has('pageIndex')) return;
        const idx = parseInt(u.searchParams.get('pageIndex')||'0',10);
        if (!Number.isFinite(idx)) return;
        links.set(idx, u.toString());
      }catch(e){}
    });
    if (!links.has(0)) links.set(0, new URL(location.href).toString());
    return Array.from(links.entries()).sort((a,b)=> a[0]-b[0]).map(([_, url])=> url);
  }
  async function fetchAnchorPage(url){
    const res = await fetch(url, { credentials:'include' });
    if (!res.ok) throw new Error('HTTP '+res.status);
    const html = await res.text();
    const doc  = new DOMParser().parseFromString(html, 'text/html');
    const rows = extractFromRoot(doc);
    const idx = getCurrentPageIndexFromDoc(doc);
    if (idx != null) state.fetchedPageIndexes.add(idx);
    return { rows };
  }

  /* ---------- Legacy WebForms pager ---------- */
  function squishHidden(doc){
    const hid = {};
    doc.querySelectorAll('input[type="hidden"]').forEach(i=>{ if (i.name) hid[i.name] = i.value || ''; });
    return hid;
  }
  function parseNextFromRoot(root){
    const panel = root.querySelector(TX_PANEL_SEL); if (!panel) return null;
    let a = panel.querySelector('a.rgPageNext') ||
            Array.from(panel.querySelectorAll('a[href*="__doPostBack"]')).find(x=> /Next|›|>>/i.test(x.textContent||''));
    if (!a) return null;
    const src = a.getAttribute('href') || a.getAttribute('onclick') || '';
    const m = src.match(/__doPostBack\(\s*'([^']+)'\s*,\s*'([^']*)'\s*\)/);
    if (!m) return null;
    return { hidden: squishHidden(document), evtTarget: m[1], evtArg: m[2] || '' };
  }
  async function fetchNextPage(current){
    const data = new URLSearchParams();
    Object.entries(current.hidden||{}).forEach(([k,v])=> data.append(k,v));
    data.set('__EVENTTARGET', current.evtTarget);
    data.set('__EVENTARGUMENT', current.evtArg);

    const res = await fetch(IN_PAGE_URL, {
      method:'POST',
      headers: { 'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8' },
      credentials:'include',
      body: data.toString()
    });
    if (!res.ok) throw new Error('HTTP '+res.status);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rows = extractFromRoot(doc);

    let next = null;
    const panel = doc.querySelector(TX_PANEL_SEL);
    if (panel){
      const a = panel.querySelector('a.rgPageNext') ||
                Array.from(panel.querySelectorAll('a[href*="__doPostBack"]')).find(x=> /Next|›|>>/i.test(x.textContent||'')); 
      if (a){
        const src = a.getAttribute('href') || a.getAttribute('onclick') || '';
        const m = src.match(/__doPostBack\(\s*'([^']+)'\s*,\s*'([^']*)'\s*\)/);
        if (m){ next = { hidden: squishHidden(doc), evtTarget: m[1], evtArg: m[2]||'' }; }
      }
    }
    return { rows, next };
  }

  /* ---------- Load all pages ---------- */
  async function loadAllPages(){
    if (state.fetchingAll) return;
    state.fetchingAll = true;
    const btn = document.getElementById('wlTxLoadAllBtn'); if (btn) btn.disabled = true;

    try{
      const anchorLinks = hasAnchorPager(document) ? collectPageLinks(document) : [];
      if (anchorLinks.length > 1){
        let done = 0;
        for (const url of anchorLinks){
          const idx = (()=>{ try{ return parseInt(new URL(url).searchParams.get('pageIndex')||'0',10);}catch{ return null; }})();
          if (idx!=null && state.fetchedPageIndexes.has(idx)) { done++; continue; }
          const { rows } = await fetchAnchorPage(url);
          mergeRows(rows);
          done++;
          badge(`Loaded ${state.rows.length} rows · page ${done}/${anchorLinks.length}`);
          renderRows();
        }
        badge(`All pages loaded · ${state.rows.length} total`);
        log.info('Anchor pager load complete', { total: state.rows.length, pages: anchorLinks.length });
      }else{
        if (!state.nextPost){ badge('No more pages detected.'); return; }
        let pages = 0;
        while (state.nextPost && pages < state.maxPages){
          const { rows, next } = await fetchNextPage(state.nextPost);
          mergeRows(rows);
          state.pageCount += 1; pages += 1; state.nextPost = next;
          badge(`Loaded ${state.rows.length} rows · page ${state.pageCount}${state.nextPost?'…':''}`);
          renderRows();
        }
        if (state.nextPost) badge(`Stopped at cap (${state.maxPages}). Showing ${state.rows.length}.`);
        else badge(`All pages loaded · ${state.rows.length} total`);
      }
    }catch(e){
      log.error('loadAllPages error', e);
      badge('Error while loading all pages. Showing what we have.');
    }finally{
      if (btn) btn.disabled = false;
      state.fetchingAll = false;
    }
  }
  function mergeRows(newRows){
    const known = new Set(state.rows.map(r=> r.key));
    let added = 0;
    newRows.forEach(r=> { if (r && r.key && !known.has(r.key)) { state.rows.push(r); known.add(r.key); added++; } });
    if (added) reconcileSelectedAmounts();
  }
  function reconcileSelectedAmounts(){
    const index = new Map(state.rows.map(r=> [r.key, MONEY(r.outstanding)]));
    let changed = false;
    state.selected.forEach((val,key)=>{
      if (index.has(key)){
        const v = index.get(key);
        if (val !== v){ state.selected.set(key, v); changed = true; }
      }
    });
    if (changed) renderStats();
  }

  /* ---------- Selection + rendering ---------- */
  function persistSelection(){
    try{
      const docs = Array.from(state.selected.keys());
      saveSelectedDocs(docs); // with TTL
    }catch(e){}
  }
  function seedSelectionKeys(){
    const docs = new Set();

    // From Remittance
    const remText = getRemittanceText();
    if (remText){
      const line = remText.split(/\r?\n/).find(l => /^\s*(Docs:|Documents:)\s*/i.test(l));
      let tokens = [];
      if (line){
        tokens = line.replace(/^\s*(Docs:|Documents:)\s*/i,'').split(/[,\s]+/);
      }else{
        tokens = remText.split(/[,\n\r\t ]+/);
      }
      tokens.map(t=>t.trim()).filter(Boolean).forEach(t=> docs.add(t));
    }

    // From localStorage (with TTL)
    try{
      const a = loadSelectedDocs();
      if (Array.isArray(a)) a.forEach(k=> docs.add(k));
    }catch(e){}

    docs.forEach(k=> { if (!state.selected.has(k)) state.selected.set(k, 0); });
  }
  function renderStats(){
    const count = state.selected.size;
    const total = Array.from(state.selected.values()).reduce((s,v)=> s+v, 0);
    const pill = document.getElementById('wlInvStats');
    if (pill) pill.textContent = `${count} selected · $${FMT2(total)}`;
  }
  function toggleSel(key, outstandingVal, checked){
    if (!key) return;
    if (checked) state.selected.set(key, Number(outstandingVal||0));
    else state.selected.delete(key);
  }
  function renderRows(){
    const tbody = document.getElementById('wlInvTbody');
    if (!tbody) return;
    const q = (document.getElementById('wlInvFilter')?.value || '').trim().toLowerCase();
    const rows = state.rows.filter(r=>{
      if (!q) return true;
      return (r.doc||'').toLowerCase().includes(q) ||
             (r.type||'').toLowerCase().includes(q) ||
             (r.job||'').toLowerCase().includes(q) ||
             (r.desc||'').toLowerCase().includes(q) ||
             (r.tDate||'').toLowerCase().includes(q) ||
             (r.dDate||'').toLowerCase().includes(q);
    });

    const frag = document.createDocumentFragment();
    rows.forEach(r=>{
      const credit = (String(r.type||'').toLowerCase().includes('credit') || MONEY(r.amount) < 0);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Select"><input type="checkbox" data-key="${r.key}" data-outstanding="${r.outstanding}" ${state.selected.has(r.key)?'checked':''}></td>
        <td data-label="Doc #">${r.doc}</td>
        <td data-label="Type"><span class="wl-type-pill ${credit?'wl-type-cr':'wl-type-inv'}">${credit?'Credit':'Invoice'}</span></td>
        <td data-label="Trans Date">${r.tDate||''}</td>
        <td data-label="Due Date">${r.dDate||''}</td>
        <td data-label="Job Ref">${r.job||''}</td>
        <td data-label="Description">${r.desc||''}</td>
        <td data-label="Amount" class="right">$${FMT2(MONEY(r.amount))}</td>
        <td data-label="Outstanding" class="right">$${FMT2(MONEY(r.outstanding))}</td>
      `;
      const cb = tr.querySelector('input[type="checkbox"]');
      cb.addEventListener('change', (e)=>{
        toggleSel(r.key, MONEY(r.outstanding), e.currentTarget.checked);
        persistSelection();
        renderStats();
      });
      frag.appendChild(tr);
    });
    tbody.innerHTML = '';
    tbody.appendChild(frag);

    const all = document.getElementById('wlInvSelectAll');
    if (all){
      const total = rows.length, sel = rows.filter(r=> state.selected.has(r.key)).length;
      all.indeterminate = sel>0 && sel<total;
      all.checked = total>0 && sel===total;
    }
    renderStats();
  }

  /* ---------- Commit to form ---------- */
  function commitSelection(){
    if (state.selected.size === 0){
      alert('Select at least one item.');
      return;
    }

    // Index for lookups
    const rowByKey = new Map(state.rows.map(r => [r.key, r]));
    const amtByKey = new Map(state.rows.map(r => [r.key, MONEY(r.outstanding)]));

    // Keep only docs present in loaded rows
    const docs = Array.from(state.selected.keys()).filter(k => rowByKey.has(k));

    // Build tokens & compute net
    const tokens = [];
    let netTotal = 0;

    docs.forEach(k => {
      const r = rowByKey.get(k);
      const selAmt = Number(amtByKey.get(k) || 0);

      const isCredit =
        (String(r?.type || '').toLowerCase().includes('credit')) ||
        MONEY(r?.amount) < 0 ||
        selAmt < 0;

      if (isCredit) {
        const raw = String(r?.doc || k).trim().replace(/\s+/g,'');
        const token = /^CN/i.test(raw) ? raw.replace(/^cn/i,'CN') : 'CN' + raw;
        tokens.push(token);
        netTotal += selAmt; // typically negative
      } else {
        const pay = Math.max(0, Math.abs(selAmt));
        const token = `${String(r?.doc || k).trim()}$${pay.toFixed(2)}`;
        tokens.push(token);
        netTotal += selAmt; // positive
      }
    });

    const remString = tokens.join(',');
    const payTotal = Math.max(0, netTotal);

    const aEl = document.getElementById('ctl00_PageBody_PaymentAmountTextBox');
    const currNum = aEl ? MONEY(aEl.value) : 0;

    function setAmountField(valNum){
      if (!aEl) return;
      const show = Number(valNum||0).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2});
      try{
        const proto = HTMLInputElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && desc.set) desc.set.call(aEl, show); else aEl.value = show;
      }catch{ aEl.value = show; }
      try{
        aEl.dispatchEvent(new Event('input',  { bubbles:true }));
        aEl.dispatchEvent(new Event('change', { bubbles:true }));
      }catch(e){}
    }

    setAmountField(payTotal);

    const changed = Number(currNum.toFixed(2)) !== Number(payTotal.toFixed(2));

    if (changed) {
      try{ window.WL_AP?.remit?.defer(remString); }catch(e){}
      try{
        if (typeof window.__doPostBack === 'function'){
          const uniqueId = aEl.id.replace(/_/g,'$');
          setTimeout(()=> window.__doPostBack(uniqueId, ''), 0);
        }
      }catch(e){}
    } else {
      try {
        window.WL_AP?.remit?._setNow?.(remString, /*fireInputOnly*/true);
        try{ sessionStorage.removeItem('__WL_PendingRemitV2'); }catch(e){}
      } catch {}
    }

    // Save docs with TTL
    try { saveSelectedDocs(docs); } catch {}

    try { window.WL_AP?.jobs?.clearSelection?.(); } catch {}

    closeModal();
  }

  // Delegated opener (and direct wire for redundancy)
  document.addEventListener('click', function(e){
    const btn = e.target?.closest?.('#wlOpenTxModalBtn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation?.();
    openModal();
  }, true);

  function wire(){
    const btn = document.getElementById('wlOpenTxModalBtn');
    if (!btn || btn.__wlTxPickBound) return;
    btn.addEventListener('click', (e)=>{
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.();
      openModal();
      return false;
    }, { capture:true });
    btn.__wlTxPickBound = true;
    log.info('Invoice picker bound.');
  }

  // Export helpers
  window.WL_AP = window.WL_AP || {};
  window.WL_AP.invoice = Object.assign(window.WL_AP.invoice || {}, {
    clearSelection(){
      state.selected.clear();
      try{ clearSelectedDocs(); }catch(e){}
      renderRows(); renderStats();
      const current = getRemittanceText();
      const kept = String(current||'').split(/\r?\n/)
        .filter(Boolean)
        .filter(l => !/^\s*(Docs:|Documents:)\s*/i.test(l));
      setRemittanceText(kept.join('\n'));
    },
    open: openModal
  });

  /* ---------- Boot + survive partial postbacks ---------- */
  function boot(){
    wire();
    try{
      if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager){
        const prm = window.Sys.WebForms.PageRequestManager.getInstance();
        if (!prm.__wlTxPickBound){
          prm.add_endRequest(()=> setTimeout(wire, 30));
          prm.__wlTxPickBound = true;
        }
      }
    }catch(e){}
  }

  if (document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', boot, { once:true }); }
  else { boot(); }
})();





















/* --- WL_AP.remit: defer remittance writes until after postback --- */
(function setupWlRemit(){
  if (!/AccountPayment_r\.aspx/i.test(location.pathname)) return;

  window.WL_AP = window.WL_AP || {};
  if (window.WL_AP.remit) return;   // already set up

  const KEY = '__WL_PendingRemitV2';

  function cssEscape(s){ return String(s).replace(/["\\]/g, '\\$&'); }

  function findInnerRadInput(idOrEl){
    const root = typeof idOrEl==='string' ? document.getElementById(idOrEl) : idOrEl;
    if (!root) return null;
    return root.querySelector('.riTextBox, textarea, input[type="text"], input[type="number"]');
  }

  function findRemitField(){
    // 1) Telerik client object
    try{
      const idGuess = 'ctl00_PageBody_RemittanceAdviceTextBox';
      const ctl = typeof $find==='function' ? $find(idGuess) : null;
      if (ctl && (typeof ctl.get_value === 'function' || typeof ctl.get_text === 'function')) return { telerik: ctl };
    }catch(e){}

    // 2) Direct / wrapper / fuzzy
    const id = 'ctl00_PageBody_RemittanceAdviceTextBox';
    let el = document.getElementById(id) ||
             findInnerRadInput(id+'_wrapper') || findInnerRadInput(id) ||
             document.querySelector(`[name="${cssEscape(id)}"]`) ||
             document.querySelector(`[id*="Remittance"],[name*="Remittance"]`);
    if (!el){
      // 3) Near a label mentioning remittance
      const label = Array.from(document.querySelectorAll('label')).find(l => /remittance/i.test(l.textContent||''));
      if (label){
        const forId = label.getAttribute('for');
        el = (forId && document.getElementById(forId)) || label.closest('div,td,th,section,fieldset')?.querySelector('textarea, input[type="text"]');
      }
    }
    return el ? { el } : null;
  }

  function setRemittanceValue(val, fireInputOnly=true){
    const ref = findRemitField();
    if (!ref) return false;

    // Telerik first
    if (ref.telerik){
      try{
        if (typeof ref.telerik.set_value === 'function'){ ref.telerik.set_value(val); return true; }
        if (typeof ref.telerik.set_text  === 'function'){ ref.telerik.set_text(val);  return true; }
      }catch(e){}
    }

    // Native element
    if (ref.el){
      try{
        const el = ref.el;
        const proto = el.tagName==='INPUT' ? HTMLInputElement.prototype :
                      el.tagName==='TEXTAREA' ? HTMLTextAreaElement.prototype : null;
        const desc = proto && Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && desc.set) desc.set.call(el, val); else el.value = val;
        // Update UI without triggering a change-postback
        if (fireInputOnly) el.dispatchEvent(new Event('input', { bubbles:true }));
        return true;
      }catch(e){}
    }
    return false;
  }

  function applyPending(){
    // Try sessionStorage first; if we had a full reload, sessionStorage survives in-tab.
    let raw = null;
    try{ raw = sessionStorage.getItem(KEY) || localStorage.getItem(KEY); }catch(e){}
    if (!raw) return;

    let val = '';
    try{ const obj = JSON.parse(raw); val = obj && obj.value != null ? String(obj.value) : String(raw); }
    catch{ val = String(raw); }

    setRemittanceValue(val, /*fireInputOnly*/true);

    try{ sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); }catch(e){}
  }

  function bindPRM(){
    try{
      if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager){
        const prm = Sys.WebForms.PageRequestManager.getInstance();
        if (!prm.__wlRemitBound){
          prm.add_endRequest(()=> setTimeout(applyPending, 0));
          prm.__wlRemitBound = true;
        }
      }
    }catch(e){}
  }

  window.WL_AP.remit = {
    defer(val){
      try{ sessionStorage.setItem(KEY, JSON.stringify({ value: String(val||''), t: Date.now() })); }catch(e){}
    },
    applyNow: applyPending,
    _setNow: setRemittanceValue
  };

  // Bind and also apply immediately on load (covers full page loads)
  bindPRM();
  setTimeout(applyPending, 0);
})();

































































/* ============================================================================
   WL Pay-By-Invoice: SUCCESS PAGE PATCH v2
   - Renames "Invoice number" -> "Payment confirmation #"
   - Adds "Selected items" row (docs/jobs/cab)
   - Print Receipt uses the same terms + includes selection summary
   Paste at the VERY BOTTOM of PayByInvoice.js
   ============================================================================ */
(function () {
  'use strict';
  if (!/AccountPayment_r\.aspx/i.test(location.pathname)) return;

  // Your existing PayByInvoice.js uses this session key
  const PREF_KEY = 'wl_ap_prefill_v3';

  function loadPrefSafe() {
    try { return JSON.parse(sessionStorage.getItem(PREF_KEY) || '{}'); }
    catch { return {}; }
  }

  // Detect confirmation view by presence of the success payment table
  function isSuccessView() {
    const t = document.querySelector('table.paymentDataTable');
    if (!t) return false;
    const txt = (document.querySelector('.bodyFlexItem')?.innerText || document.body.innerText || '');
    return /account payment was successful/i.test(txt) || /payment was successful/i.test(txt);
  }

  function getEmailFromSuccessText() {
    const strongs = Array.from(document.querySelectorAll('.bodyFlexItem strong'));
    for (const st of strongs) {
      const v = (st.textContent || '').trim();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return v;
    }
    return '';
  }

  function parseList(str) {
    return String(str || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }

  function buildSelectionSummary(pref) {
    const docs = parseList(pref.docs);
    const jobs = parseList(pref.jobs);

    // Future: cab load — you can set pref.cab = true later (or a string)
    const cab = !!pref.cab || String(pref.cab || '').toLowerCase() === 'true';

    const parts = [];
    if (docs.length) parts.push(`${docs.length} invoice/credit item${docs.length === 1 ? '' : 's'}`);
    if (jobs.length) parts.push(`${jobs.length} job${jobs.length === 1 ? '' : 's'}`);
    if (cab) parts.push('Cab Load');

    // Human-friendly fallback
    if (!parts.length) return { text: '(not available)', docs, jobs, cab };

    return { text: parts.join(' • '), docs, jobs, cab };
  }

  // --- Table tweaks on the success screen ---
  function renameInvoiceNumberToConfirmation(table) {
    const ths = Array.from(table.querySelectorAll('th'));
    for (const th of ths) {
      const norm = (th.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
      if (norm === 'invoice number:' || norm === 'invoice number') {
        th.textContent = 'Payment confirmation #:';
        return true;
      }
    }
    return false;
  }

  function injectSelectedRow(table, summaryText) {
    if (document.getElementById('wlSelectedItemsRow')) return;

    const tr = document.createElement('tr');
    tr.id = 'wlSelectedItemsRow';
    tr.innerHTML = `
      <th>Selected&nbsp;items:</th>
      <td colspan="2">${escapeHtml(summaryText)}</td>
    `;

    // Insert right after the confirmation # row if we can find it, otherwise before Notes
    const rows = Array.from(table.querySelectorAll('tr'));
    let inserted = false;

    // Try after "Payment confirmation #"
    for (const r of rows) {
      const th = r.querySelector('th');
      const norm = (th?.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
      if (norm.startsWith('payment confirmation')) {
        r.parentNode.insertBefore(tr, r.nextSibling);
        inserted = true;
        break;
      }
    }

    // Fallback: insert before Notes
    if (!inserted) {
      for (const r of rows) {
        const th = r.querySelector('th');
        const norm = (th?.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
        if (norm.startsWith('notes')) {
          r.parentNode.insertBefore(tr, r);
          inserted = true;
          break;
        }
      }
    }

    // Last fallback: append
    if (!inserted) table.querySelector('tbody')?.appendChild(tr);
  }

  // --- Printable receipt (formatted) ---
  function parsePaymentDataTable() {
    const table = document.querySelector('table.paymentDataTable');
    if (!table) return null;

    const rows = Array.from(table.querySelectorAll('tr'));
    const data = {
      LocationBlock: '',
      DateAndTime: '',
      Amount: '',
      Method: '',
      AuthorizationCode: '',
      PaymentConfirmation: '',
      Address: '',
      Notes: '',
      RemittanceAdvice: '',
      Email: getEmailFromSuccessText(),
    };

    for (const r of rows) {
      const th = (r.querySelector('th')?.textContent || '').replace(/\s+/g, ' ').trim();
      const td = (r.querySelector('td')?.textContent || '').replace(/\s+\n/g, '\n').trim();

      if (!th && td) {
        data.LocationBlock = td.replace(/\n{3,}/g, '\n\n');
        continue;
      }

      const key = th
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/:$/, '')
        .trim()
        .toLowerCase();

      if (key === 'date and time') data.DateAndTime = td;
      else if (key === 'amount') data.Amount = td;
      else if (key === 'card type') data.Method = td;
      else if (key === 'authorization code') data.AuthorizationCode = td;
      else if (key === 'invoice number') data.PaymentConfirmation = td; // the page label is misleading; treat as confirmation
      else if (key === 'address') data.Address = td;
      else if (key === 'notes') data.Notes = td;
      else if (key === 'remittance advice') data.RemittanceAdvice = td;
    }

    return data;
  }

  function buildReceiptHTML(payment, selectionSummaryText) {
    const safe = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const now = new Date();

    const locLines = String(payment.LocationBlock || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    const storeName = locLines[0] || 'Woodson Lumber';
    const addrBlock = locLines.length ? locLines.join('<br>') : '';

    const details = [
      ['Store', storeName],
      ['Date/Time', payment.DateAndTime],
      ['Amount Paid', payment.Amount],
      ['Payment Method', payment.Method],
      ['Authorization Code', payment.AuthorizationCode],
      ['Payment Confirmation #', payment.PaymentConfirmation],
      ['Selected Items', selectionSummaryText],
      ['Email Receipt Sent To', payment.Email || ''],
    ].filter(([_, v]) => String(v || '').trim() !== '');

    const notes = safe(payment.Notes).trim();
    const remit = safe(payment.RemittanceAdvice).trim();

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Woodson Lumber - Account Payment Receipt</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { --fg:#0f172a; --muted:#475569; --line:#e2e8f0; }
  * { box-sizing:border-box; }
  body { margin:0; font-family: Arial, Helvetica, sans-serif; color:var(--fg); background:#fff; }
  .page { max-width: 780px; margin: 24px auto; padding: 0 18px 40px; }
  .top { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; border-bottom:2px solid var(--line); padding-bottom:14px; margin-bottom:16px; }
  .brand { font-size: 20px; font-weight: 800; letter-spacing: .2px; }
  .subtitle { color:var(--muted); margin-top:4px; font-size: 12px; }
  .meta { text-align:right; color:var(--muted); font-size:12px; white-space:nowrap; }
  .card { border:1px solid var(--line); border-radius:12px; padding:14px; margin: 12px 0; }
  .h { font-weight: 800; margin:0 0 10px; }
  table { width:100%; border-collapse:collapse; }
  td { padding:10px 8px; border-top:1px solid var(--line); vertical-align:top; }
  td.k { width: 44%; color:var(--muted); font-weight:700; }
  .addr { line-height: 1.25rem; }
  .small { font-size: 12px; color:var(--muted); }
  .foot { margin-top: 14px; font-size: 12px; color: var(--muted); border-top: 1px solid var(--line); padding-top: 10px; }
  @media print { .page { margin: 0; max-width: none; } .card { break-inside: avoid; } }
</style>
</head>
<body>
  <div class="page">
    <div class="top">
      <div>
        <div class="brand">Woodson Lumber</div>
        <div class="subtitle">Account Payment Receipt</div>
      </div>
      <div class="meta">Printed: ${safe(now.toLocaleString())}</div>
    </div>

    <div class="card">
      <p class="h">Payment Summary</p>
      <table><tbody>
        ${details.map(([k,v]) => `
          <tr><td class="k">${safe(k)}</td><td>${safe(v)}</td></tr>
        `).join('')}
      </tbody></table>
    </div>

    ${addrBlock ? `<div class="card"><p class="h">Store Information</p><div class="addr">${addrBlock}</div></div>` : ''}

    ${(notes || remit) ? `
      <div class="card">
        <p class="h">Additional Information</p>
        ${notes ? `<div><div class="small">Notes</div><div>${notes || '(none)'}</div></div>` : ''}
        ${remit ? `<div style="margin-top:10px;"><div class="small">Remittance Advice</div><div>${remit || '(none)'}</div></div>` : ''}
      </div>` : ''}

    <div class="foot">Keep this receipt for your records. If you have questions, contact your Woodson Lumber location.</div>
  </div>
</body>
</html>`;
  }

  function openPrintWindow(html) {
    const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
    if (!w) { alert('Pop-up blocked. Please allow pop-ups to print your receipt.'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch {} }, 250);
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  }

  // --- Buttons section: rename token + replace Print button with Receipt print ---
  function patchButtons(selectionSummaryText) {
    // Rename Save Token
    const saveBtn = document.getElementById('ctl00_PageBody_btnSaveToken');
    if (saveBtn && saveBtn.tagName === 'INPUT') {
      saveBtn.value = 'Save payment for future';
      saveBtn.title = 'Save this payment method for future use';
    }

    // Hide default "Print This"
    const oldPrint = document.querySelector('.bodyFlexItem a[onclick*="window.print"]');
    if (oldPrint) oldPrint.style.display = 'none';

    // Add Print Receipt
    if (document.getElementById('wlPrintReceiptBtnV2')) return;

    const btnHost =
      saveBtn?.parentElement ||
      document.querySelector('.bodyFlexItem') ||
      null;

    if (!btnHost) return;

    const a = document.createElement('a');
    a.id = 'wlPrintReceiptBtnV2';
    a.href = '#';
    a.className = 'epi-button';
    a.title = 'Print Receipt';
    a.innerHTML = '<span>Print Receipt</span>';
    a.style.marginRight = '8px';

    a.addEventListener('click', function (e) {
      e.preventDefault();
      const payment = parsePaymentDataTable();
      if (!payment) { alert('Could not read receipt details from the page.'); return; }
      const html = buildReceiptHTML(payment, selectionSummaryText);
      openPrintWindow(html);
    });

    // Insert before Save Token if possible
    if (saveBtn && saveBtn.parentElement) {
      saveBtn.parentElement.insertBefore(a, saveBtn);
    } else {
      btnHost.prepend(a);
    }
  }

  function applySuccessEnhancements() {
    const table = document.querySelector('table.paymentDataTable');
    if (!table) return;

    // Get selection info from sessionStorage pref object
    const pref = loadPrefSafe();
    const sel = buildSelectionSummary(pref);

    // 1) Rename label
    renameInvoiceNumberToConfirmation(table);

    // 2) Inject "Selected items" row on-screen
    injectSelectedRow(table, sel.text);

    // 3) Patch buttons (Print Receipt + Save payment for future)
    patchButtons(sel.text);
  }

  function boot() {
    if (!isSuccessView()) return;
    applySuccessEnhancements();
  }

  // Initial
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // Re-run after async updates (WebForms/Telerik)
  try {
    if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager) {
      const prm = Sys.WebForms.PageRequestManager.getInstance();
      prm.add_endRequest(function () { boot(); });
    }
  } catch {}
})();




















































/* ============================================================================
   WL AccountPayment — Wizard UI v3 (integrated, mounts on load)
   Goal: wizard is the FIRST-class DOM, not an afterthought.
   ============================================================================ */
(function () {
  'use strict';
  if (!/AccountPayment_r\.aspx/i.test(location.pathname)) return;
  if (window.__WL_AP_WIZ3) return;
  window.__WL_AP_WIZ3 = true;

  const $ = (id)=>document.getElementById(id);
  const qs = (sel, root=document)=>root.querySelector(sel);

  const STEP_KEY = '__WL_AP_WIZ3_STEP';

  // Reset wizard state when arriving from another page (but keep state across same-page postbacks).
  const PAGE_KEY = "wl_ap_lastPath";
  function cameFromOtherPage(){
    try{
      const ref = document.referrer || "";
      // If referrer is empty (direct open) treat as fresh.
      if (!ref) return true;
      // If coming from another page (not AccountPayment), reset.
      return !/AccountPayment_r\.aspx/i.test(ref);
    }catch{ return true; }
  }
  function resetWizardState(){
    try{ sessionStorage.removeItem(STEP_KEY); }catch(e){}
    try{ localStorage.removeItem(STEP_KEY); }catch(e){}
    try{ sessionStorage.removeItem("wl_bill_lock"); }catch(e){}
    try{ sessionStorage.removeItem("wl_bill_draft"); }catch(e){}
    try{ sessionStorage.removeItem("wl_bill_postback_pending"); }catch(e){}
  }
  // If we navigated in from elsewhere, clear step so customers start at Step 1.
  try{
    if (cameFromOtherPage()){
      resetWizardState();
    }
    try{ sessionStorage.setItem(PAGE_KEY, location.pathname + location.search); }catch(e){}
  }catch(e){}


  function injectCSS(){
    if ($('wl-ap-wiz3-css')) return;
    const css = `
      #wlApWizard3{border:1px solid #e5e7eb; border-radius:16px; background:#fff; margin-bottom:16px; position:relative; z-index:5000; }
      #wlApWizard3 .w3-head{ display:flex; justify-content:space-between; gap:12px; align-items:center; padding:12px 14px; border-bottom:1px solid #e5e7eb; }
      #wlApWizard3 .w3-title{ font-weight:1000; font-size:16px; }
      #wlApWizard3 .w3-steps{ display:flex; gap:6px; flex-wrap:wrap; }
      #wlApWizard3 .w3-pill{ font-size:12px; font-weight:900; padding:6px 10px; border-radius:999px; border:1px solid #e5e7eb; background:#f8fafc; }
      #wlApWizard3 .w3-pill.on{ background:#111827; color:#fff; border-color:#111827; }
      #wlApWizard3 .w3-body{ padding:14px; }
      #wlApWizard3 .w3-panel{ display:none; }
      #wlApWizard3 .w3-panel.on{ display:block; }
      #wlApWizard3 .w3-nav{ display:flex; justify-content:space-between; gap:10px; margin-top:16px; position:sticky; bottom:12px; width:100%; background:#fff; padding:12px 14px; border:1px solid #e5e7eb; border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,.08); z-index:6000; pointer-events:auto; }
      .RadAjaxLoadingPanel, .RadAjaxLoadingPanel *{ pointer-events:none !important; }
      div[id*="LoadingPanel"], div[id*="loadingpanel"], div[id*="_LoadingPanel"], div[id*="_loadingPanel"]{ pointer-events:none !important; }

      #wlApWizard3 .w3-btn{ pointer-events:auto;  border:1px solid #e5e7eb; background:#fff; border-radius:12px; padding:10px 12px; font-weight:1000; cursor:pointer; }
      #wlApWizard3 .w3-btn.primary{ background:#111827; color:#fff; border-color:#111827; }
      #wlApWizard3 .w3-btn[disabled]{ opacity:.5; cursor:not-allowed; }
      #wlApWizard3 .w3-help{ font-size:12px; color:#475569; margin-top:8px; line-height:1.35; }

      /* COF hard-show */
      #ctl00_PageBody_ChecksOnFileContainer,
      #ctl00_PageBody_ChecksOnFileContainer1{ display:block !important; visibility:visible !important; opacity:1 !important; }
      #ctl00_PageBody_ChecksOnFileContainer select,
      #ctl00_PageBody_ChecksOnFileContainer1 select{ width:100% !important; pointer-events:auto !important; }
    `;
    const s = document.createElement('style');
    s.id = 'wl-ap-wiz3-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function moneyNum(v){
    const n = parseFloat(String(v||'').replace(/[^0-9.\-]/g,''));
    return Number.isFinite(n) ? n : 0;
  }

  function getAmount(){
    const el = $('ctl00_PageBody_PaymentAmountTextBox');
    return moneyNum(el?.value || '');
  }

  function sanitizeEmailInPlace(){
  const el = $('ctl00_PageBody_EmailAddressTextBox');
  if (!el) return;
  const raw = String(el.value || '').trim();
  if (!raw) return;
  // If something like "(ckunkel) ckunkel@woodsonlumber.com", extract the first valid email token.
  const tokens = raw.split(/[\s,;<>\(\)]+/).filter(Boolean);
  const email = tokens.find(t => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) || '';
  if (email && email !== raw) el.value = email;
}

function buildReviewHTML(){
    const amtEl = $('ctl00_PageBody_PaymentAmountTextBox');
    const remit = $('ctl00_PageBody_RemittanceAdviceTextBox')?.value || '';
    const notes = $('ctl00_PageBody_NotesTextBox')?.value || '';
    const email = $('ctl00_PageBody_EmailAddressTextBox')?.value || '';

    // If your core script exposes a summary method, use it.
    let sel = '';
    try{
      if (typeof window.getSelectionSummaryText === 'function') sel = window.getSelectionSummaryText();
    } catch {}
    if (!sel) sel = (remit || notes) ? [remit, notes].filter(Boolean).join(' • ') : '(none)';

    const amtDisp = amtEl?.value ? ('$' + String(amtEl.value).trim()) : '(none)';
    return `
      <div class="wl-card" style="margin-bottom:14px;">
        <div class="wl-card-head">Review</div>
        <div class="wl-card-body">
          <div style="display:grid; gap:10px;">
            <div><b>Amount:</b> <span style="font-weight:1000;">${amtDisp}</span></div>
            <div><b>Selection:</b> ${sel || '(none)'}</div>
            <div><b>Email:</b> ${email || '(not provided)'}</div>
            ${(remit||notes) ? `<div><b>Remit/Notes:</b><div style="white-space:pre-wrap;margin-top:4px;">${[remit,notes].filter(Boolean).join('\n\n')}</div></div>` : ``}
          </div>
        </div>
      </div>
    `;
  }

  function findMakePaymentButton(){
    const inputs = Array.from(document.querySelectorAll('input[type="submit"], input[type="button"], button'));
    return inputs.find(x => /make\s+payment|process\s+payment|submit\s+payment/i.test((x.value||x.textContent||'').trim())) || null;
  }

  function ensureCOFLoaded(){
  // Only attempt to load COF accounts when COF is actually selected.
  window.WLPayMode?.ensureCheckOnFileUI?.();

  const rb = $('ctl00_PageBody_RadioButton_PayByCheckOnFile');
  if (!rb || !rb.checked) return;

  const c1 = $('ctl00_PageBody_ChecksOnFileContainer');
  const c2 = $('ctl00_PageBody_ChecksOnFileContainer1');
  const sel = (c1?.querySelector('select') || c2?.querySelector('select'));

  // Throttle retries to avoid infinite postback loops
  const TRY_KEY = '__WL_COF_LOAD_TRIES';
  const TS_KEY  = '__WL_COF_LOAD_LAST_TS';
  const tries = Number(sessionStorage.getItem(TRY_KEY) || '0');
  const lastTs = Number(sessionStorage.getItem(TS_KEY) || '0');
  const now = Date.now();

  // If select looks empty, try at most 2 times, no more than once per 2 seconds
  const looksEmpty = !!(sel && sel.options && sel.options.length <= 1);
  if (!looksEmpty) return;

  if (tries >= 2) return;
  if (now - lastTs < 2000) return;

  sessionStorage.setItem(TRY_KEY, String(tries + 1));
  sessionStorage.setItem(TS_KEY, String(now));

  try { rb.click(); } catch {}
  // Fallback: manual postback
  try {
    if (typeof window.__doPostBack === 'function' && rb.name){
      window.__doPostBack(rb.name, '');
    }
  } catch {}
}

  function mount(){
    injectCSS();

    const shell = qs('.wl-shell');
    const left  = $('wlLeftCard');
    const right = $('wlRightCard');
    const tx    = $('wlTxCard');

    // Wait until the core layout module has created the cards.
    if (!shell || !left || !right){
      return false;
    }

    if ($('wlApWizard3')) return true;

    // Build wizard wrapper above shell
    const wiz = document.createElement('div');
    wiz.id = 'wlApWizard3';
    wiz.innerHTML = `
      <div class="w3-head">
        <div class="w3-title">Payment Details</div>
        <div class="w3-steps">
          <span class="w3-pill" data-pill="0">1) Info</span>
          <span class="w3-pill" data-pill="1">2) Select</span>
          <span class="w3-pill" data-pill="2">3) Review</span>
          <span class="w3-pill" data-pill="3">4) Pay</span>
        </div>
      </div>
      <div class="w3-body">
        <div class="w3-panel" data-step="0"><div id="w3Step0"></div><div class="w3-help">Confirm contact + billing details, then continue.</div></div>
        <div class="w3-panel" data-step="1"><div id="w3Step1"></div><div class="w3-help">Pick statement / jobs / invoices or set a manual amount.</div></div>
        <div class="w3-panel" data-step="2"><div id="w3Review"></div></div>
        <div class="w3-panel" data-step="3"><div id="w3Step3"></div><div class="w3-help">Choose payment method and submit.</div></div>
        <div class="w3-nav">
          <button type="button" class="w3-btn" id="w3Back">Back</button>
          <button type="button" class="w3-btn primary" id="w3Next">Next</button>
        </div>
      </div>
    `;
    shell.parentNode.insertBefore(wiz, shell);

    // Move cards into steps (keeps all original logic intact)
    
// Step 0 (Info): only show Email + Billing Address + ZIP
const step0 = $('w3Step0');
const infoCard = document.createElement('div');
infoCard.className = 'wl-card';
infoCard.innerHTML = `<div class="wl-card-head">Your information</div><div class="wl-card-body"><div id="w3InfoInner" style="display:grid;gap:12px;"></div></div>`;
step0.appendChild(infoCard);

const infoInner = $('w3InfoInner');

// Hide Address dropdown (not needed in Step 1)
(function hideAddressDropdownOnStep1(){
  const ddl = $('ctl00_PageBody_AddressDropdownList');
  const wrap = ddl ? (ddl.closest('.wl-field') || ddl.closest('.epi-form-group-acctPayment') || ddl.closest('tr') || ddl.parentElement) : null;
  if (wrap) wrap.style.display = 'none';
})();

function moveFieldGroupById(id, to){
  const el = $(id);
  if (!el || !to) return;
  const wrap = el.closest('.epi-form-group-acctPayment') || el.closest('tr') || el.parentElement;
  if (wrap) to.appendChild(wrap);
}

// Prefer the BillingAddressContainer if present (may wrap multiple controls)
const billWrap =
  $('ctl00_PageBody_BillingAddressContainer') ||
  $('ctl00_PageBody_BillingAddressTextBox')?.closest('.epi-form-group-acctPayment');

sanitizeEmailInPlace();

// Address / billing / zip / email (only) on Step 0
// Put Billing BEFORE Email so users can complete address details first.
moveFieldGroupById('ctl00_PageBody_AddressDropdownList', infoInner);
moveFieldGroupById('ctl00_PageBody_PostalCodeTextBox', infoInner);

// Billing address block (may include textarea + helper controls)
if (billWrap) infoInner.appendChild(billWrap);

// Billing zip (if separate)
moveFieldGroupById('ctl00_PageBody_BillingPostalCodeTextBox', infoInner);

// Email last (after billing info)
moveFieldGroupById('ctl00_PageBody_EmailAddressTextBox', infoInner);

// Keep the rest of the original UI (amount/quick-pay/remit/etc.) out of Step 0:
// put the existing cards into Step 1 instead.
    const step1 = $('w3Step1');
    step1.appendChild(left);
    step1.appendChild(right);
    if (tx) step1.appendChild(tx);

    // Build pay step: move pay-by radios/containers + make payment button into a clean card
    const payHost = $('w3Step3');
    const payCard = document.createElement('div');
    payCard.className = 'wl-card';
    payCard.innerHTML = `<div class="wl-card-head">Payment method</div><div class="wl-card-body"><div id="w3PayInner" style="display:grid;gap:14px;"></div></div>`;
    payHost.appendChild(payCard);

    const payInner = $('w3PayInner');

    /* ===========================
       Pay Method UI -> Card UI
       (keeps real radios/selects for WebForms postbacks)
       =========================== */

    // Grab the real controls (WebTrack IDs can vary by patch; include robust fallbacks)
    const rbCheck = $('ctl00_PageBody_RadioButton_PayByCheck')
      || document.querySelector('input[type="radio"][id*="PayByCheck"], input[type="radio"][name*="PayByCheck"]');        // add new bank account (ACH)
    const rbCof   = $('ctl00_PageBody_RadioButton_PayByCheckOnFile')
      || document.querySelector('input[type="radio"][id*="CheckOnFile"], input[type="radio"][name*="CheckOnFile"], input[type="radio"][id*="PayByCheckOnFile"], input[type="radio"][name*="PayByCheckOnFile"]');  // saved bank accounts
    const rbCred  = $('ctl00_PageBody_RadioButton_PayByCredit')
      || document.querySelector('input[type="radio"][id*="PayByCredit"], input[type="radio"][name*="PayByCredit"], input[type="radio"][id*="PayByCard"], input[type="radio"][name*="PayByCard"]');       // pay by card (new card)
    const rbCardOnFile = $('ctl00_PageBody_RadioButton_PayByCardOnFile')
      || document.querySelector('input[type="radio"][id*="CardOnFile"], input[type="radio"][name*="CardOnFile"], input[type="radio"][id*="PayByCardOnFile"], input[type="radio"][name*="PayByCardOnFile"]');

    // -------------------------------------------------------------------
    // Radio wiring sanity-check:
    // WebTrack patches sometimes swap which underlying radio triggers which
    // payment UI (ACH vs Card). We infer intent from the LABEL text so that
    // "Add new card" actually triggers the card radio, and "Add new bank"
    // triggers the bank/ACH radio, even if IDs are mis-wired by a patch.
    // -------------------------------------------------------------------
    const __wlLabelText = (rb)=>{
      try{
        if (!rb) return '';
        const byFor = document.querySelector(`label[for="${rb.id}"]`);
        const txt = (byFor?.textContent || rb.closest?.('label')?.textContent || '').trim();
        return txt.toLowerCase();
      }catch(e){ return ''; }
    };
    const __wlLooksBank = (t)=> /\bach\b|bank|check|routing|account\b|e-?check|eft/.test(t||'');
    const __wlLooksCard = (t)=> /card|credit|debit|visa|mastercard|amex|discover/.test(t||'');

    let rbBankNew   = rbCheck;
    let rbBankSaved = rbCof;
    let rbCardNew   = rbCred;
    let rbCardSaved = rbCardOnFile;

    try{
      const tCheck = __wlLabelText(rbCheck);
      const tCred  = __wlLabelText(rbCred);

      // If "PayByCredit" looks like ACH/Bank and "PayByCheck" looks like Card, swap.
      if (__wlLooksBank(tCred) && __wlLooksCard(tCheck) && !__wlLooksBank(tCheck)){
        rbBankNew = rbCred;
        rbCardNew = rbCheck;
      }

      const tCof  = __wlLabelText(rbCof);
      const tCof2 = __wlLabelText(rbCardOnFile);

      // If the on-file radios appear swapped, fix those too.
      if (__wlLooksBank(tCof2) && __wlLooksCard(tCof) && !__wlLooksBank(tCof)){
        rbBankSaved = rbCardOnFile;
        rbCardSaved = rbCof;
      }

      log.debug('WL Pay wiring:', {
        bankNew: rbBankNew?.id, bankSaved: rbBankSaved?.id,
        cardNew: rbCardNew?.id, cardSaved: rbCardSaved?.id,
        labels: { rbCheck:tCheck, rbCred:tCred, rbCof:tCof, rbCardOnFile:tCof2 }
      });
    }catch(e){}
 // saved card on file (CAB)

    const cof1 = $('ctl00_PageBody_ChecksOnFileContainer');
    const cof2 = $('ctl00_PageBody_ChecksOnFileContainer1');
    const cofSel = (cof1?.querySelector('select') || cof2?.querySelector('select')) || null;

    // Saved cards-on-file controls (only appear for some Cash Account Balance scenarios)
    const card1 = $('ctl00_PageBody_CardsOnFileContainer') || $('ctl00_PageBody_CardOnFileContainer');
    const card2 = $('ctl00_PageBody_CardsOnFileContainer1') || $('ctl00_PageBody_CardOnFileContainer1');
    const cardSel0 =
      (card1?.querySelector('select') || card2?.querySelector('select'))
      || $('ctl00_PageBody_CardOnFileList')
      || document.querySelector('select[id*="CardOnFile"],select[name*="CardOnFile"],select[id*="CardsOnFile"],select[name*="CardsOnFile"],select[id*="PayByCardOnFile"],select[name*="PayByCardOnFile"]')
      || null;

    function getCardSel(){
      // On WebForms postbacks, the select element can be replaced; always re-resolve when needed.
      try{
        const s =
          $('ctl00_PageBody_CardOnFileList')
          || (card1?.querySelector?.('select') || card2?.querySelector?.('select') || null)
          || cardSel0
          || document.querySelector('select[id*="CardOnFile"],select[name*="CardOnFile"],select[id*="CardsOnFile"],select[name*="CardsOnFile"],select[id*="PayByCardOnFile"],select[name*="PayByCardOnFile"]');
        return s || null;
      }catch(e){ return null; }
    
function getCofSel(){
      try{
        // Common selectors for "Checks on File" dropdown
        const sel =
          document.querySelector('select[id*="ChecksOnFile"], select[id*="CheckOnFile"], select[name*="ChecksOnFile"], select[name*="CheckOnFile"]') ||
          (typeof cofSel !== 'undefined' ? cofSel : null);
        return sel || null;
      }catch(e){ return null; }
    }

}

    // Pending selection bridge: selecting a saved card often triggers a partial postback that replaces the <select>.
    // We store the intended value and apply it on MS AJAX endRequest.
    window.WLPayPending = window.WLPayPending || {};
    if (typeof window.WLPayPending.apply !== 'function'){
      window.WLPayPending.apply = function(){
        try{
          // Apply pending saved-card selection (postback can replace the <select>)
          if (this.__cardPendingVal){
            const val = this.__cardPendingVal;
            const sel = getCardSel();
            if (sel){
              sel.value = val;
              sel.dispatchEvent(new Event('change', { bubbles:true }));
              this.__cardPendingVal = null;
              this.__cardPendingText = null;
            }
          }

          // Apply pending bank (check-on-file) selection or clear (postback can replace the <select>)
          if (this.__cofPendingVal !== undefined){
            const sel2 = (typeof getCofSel === 'function') ? getCofSel() : (window.cofSel || null);
            if (sel2){
              if (String(this.__cofPendingVal) === '__CLEAR__'){
                clearSelectToPlaceholder(sel2, true);
              } else {
                try{
                  sel2.value = String(this.__cofPendingVal);
                  sel2.dispatchEvent(new Event('change', { bubbles:true }));
                }catch(e){}
              }
              this.__cofPendingVal = undefined;
              this.__cofPendingText = null;
            }
          }
        }catch(e){}
      };
    }


    // Wrap the native WebForms controls off-screen (NOT display:none)
    let nativeHost = $('wlPayNativeHost');
    if (!nativeHost){
      nativeHost = document.createElement('div');
      nativeHost.id = 'wlPayNativeHost';
      nativeHost.className = 'wl-hidden-native';
      payInner.appendChild(nativeHost);
    }

    // Move the native radio wrappers + COF containers into nativeHost (so they stay functional)
    const wCheck = rbCheck?.closest('.radiobutton') || rbCheck?.parentElement;
    const wCof   = rbCof?.closest('.radiobutton')   || rbCof?.parentElement;
    const wCred  = rbCred?.closest('.radiobutton')  || rbCred?.parentElement;

    [wCheck, wCof, wCred, cof1, cof2, card1, card2, (getCardSel() ? getCardSel().closest('tr,div,span') : null)].forEach(el=>{
      if (el && el.parentElement !== nativeHost) nativeHost.appendChild(el);
    });

    // Rename the *label text* for PayByCheck (optional, but nice if it ever shows)
    try{
      const lbl = document.querySelector('label[for="ctl00_PageBody_RadioButton_PayByCheck"]');
      if (lbl) lbl.textContent = 'Pay by Bank (ACH)';
    }catch(e){}

    // Visible card UI mount
    let cardHost = $('wlPayCardsHost');
    if (!cardHost){
      cardHost = document.createElement('div');
      cardHost.id = 'wlPayCardsHost';
      cardHost.innerHTML = `
        <div class="wl-pay-methods" id="wlPayMethodCards"></div>
        <div class="wl-pay-bank" id="wlPayBankCards"></div>
    <div class="wl-pay-cardlvl" id="wlPayCardCards" style="display:none;"></div>
      `;
      payInner.appendChild(cardHost);
    }

    
// Persist selection so cards stay highlighted even after WebForms partial postbacks
const PAY_STATE_KEY = 'wlPayState';
function loadPayState(){
  try{
    const raw = sessionStorage.getItem(PAY_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch{ return null; }
}
function savePayState(st){
  try{ sessionStorage.setItem(PAY_STATE_KEY, JSON.stringify(st||{})); }catch(e){}
}

function isElementVisible(el){
  // Native controls are moved into an off-screen host for WebForms,
  // so bounding-rect checks will incorrectly report "not visible".
  // Only honor explicit hiding (display:none/visibility:hidden/hidden attr).
  if (!el) return false;
  try{
    if (el.hasAttribute && el.hasAttribute('hidden')) return false;
    const cs = window.getComputedStyle(el);
    if (!cs) return true;
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  }catch{ return true; }
}

function isRadioAvailable(r){
  try{
    if (!r) return false;
    if (r.disabled) return false;
    const aria = r.getAttribute && r.getAttribute('aria-disabled');
    if (aria && String(aria).toLowerCase() === 'true') return false;

    // Respect explicit hiding (server-side gating)
    const wrap = r.closest ? (r.closest('.radiobutton') || r.parentElement) : r.parentElement;
    if (wrap){
      const cs = window.getComputedStyle(wrap);
      if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) return false;
      if (wrap.hasAttribute && wrap.hasAttribute('hidden')) return false;
    }
    const csI = window.getComputedStyle(r);
    if (csI && (csI.display === 'none' || csI.visibility === 'hidden')) return false;

    return true;
  }catch(e){
    return !!r;
  }
}

function isCreditAvailable(){
  // "Card" methods are only available when WebTrack actually enables/renders them for the account.
  // We move natives off-screen, so do NOT use layout/rect checks.
  return isRadioAvailable(rbCardNew) || isRadioAvailable(rbCardSaved);
}


function reconcileNativeFromState(){
  const st = loadPayState();
  if (!st) return;
  try{
    // CARD (new card) selected
    if ((st.method === 'credit' || st.method === 'card') && isCreditAvailable() && rbCred){
      rbCred.checked = true;
      if (rbCheck) rbCheck.checked = false;
      if (rbBankSaved) rbBankSaved.checked = false;
      if (rbCardOnFile) rbCardOnFile.checked = false;

      // If we're using a saved card, ensure CardOnFile radio + dropdown are set after any postback
      if (st.card?.mode === 'saved' && rbCardOnFile){
        rbCardOnFile.checked = true;
        rbCred.checked = false;
        const sel = getCardSel();
        if (sel && st.card?.value && sel.value !== st.card.value){
          try{ sel.value = st.card.value; }catch(e){}
        }
      }
      return;
    }
    // default bank
    if (rbCred) rbCred.checked = false;
    if (st.method !== 'bank') st.method = 'bank';

    if (st.bank?.mode === 'saved'){
      if (rbCof) rbCof.checked = true;
      if (rbCheck) rbCheck.checked = false;
      if (cofSel && st.bank?.value && cofSel.value !== st.bank.value){
        cofSel.value = st.bank.value;
      }
    } else {
      if (rbCheck) rbCheck.checked = true;
      if (rbBankSaved) rbBankSaved.checked = false;
      try{
        const sel = getCofSel();
        if (sel) clearSelectToPlaceholder(sel, false);
      }catch(e){}
    }
  }catch(e){}
}

function clickWebFormsRadio(rb){
  try{
    if (!rb) return;
    // click the actual input so WebForms validation stays happy
    rb.click();
  }catch(e){}
  try{
    // fallback: explicitly invoke postback for this control using its UniqueID
    if (window.__doPostBack && rb && rb.id){
      const target = String(rb.id).replace(/_/g,'$');
      setTimeout(function(){ try{ __doPostBack(target,''); }catch(e){} }, 0);
    }
  }catch(e){}
}


function clearSelectToPlaceholder(sel, fireChange){
  try{
    if (!sel) return;

    // IMPORTANT (WebForms event validation):
    // Do NOT inject new <option> values client-side. If we post back a value
    // the server didn't render/whitelist, WebForms can ignore it and keep the prior
    // saved selection. Instead, move to an existing placeholder option.
    const opts = Array.from(sel.options || []);
    if (!opts.length) return;

    // Prefer an existing "-1" placeholder if WebTrack rendered it; otherwise use the first option.
    const placeholderOpt = opts.find(o => String(o.value) === '-1') || opts[0];

    try{
      sel.value = placeholderOpt.value;
    }catch(e){
      try{ sel.selectedIndex = Math.max(0, opts.indexOf(placeholderOpt)); }catch(e2){}
    }
    // Ensure selectedIndex matches value
    try{
      const idx = opts.findIndex(o => o.value === sel.value);
      if (idx >= 0) sel.selectedIndex = idx;
    }catch(e){}

    if (fireChange){
      try{ sel.dispatchEvent(new Event('change', { bubbles:true })); }catch(e){}
    }
  }catch(e){}
}


function setSelectedCard(cardEl, isSelected){
      if (!cardEl) return;
      cardEl.classList.toggle('is-selected', !!isSelected);
      cardEl.setAttribute('aria-pressed', !!isSelected ? 'true' : 'false');
    }

    function currentMode(){
      const st = loadPayState();

      // If credit isn't available, force bank
      if (st && st.method === 'credit' && !isCreditAvailable()){
        st.method = 'bank';
        st.bank = st.bank || { mode:'new' };
        savePayState(st);
      }

      // If native radios say Credit and it's allowed, honor that
      if (rbCardNew?.checked && isCreditAvailable()) return 'credit';

      // Prefer persisted intent to avoid "snapping back" due to COF select retaining a value
      if (st?.method === 'credit' && isCreditAvailable()) return 'credit';
      if (st?.method === 'bank' && st?.bank?.mode === 'saved') return 'bank_saved';
      if (st?.method === 'bank' && st?.bank?.mode === 'new') return 'bank_new';

      // Fallback inference (no saved state)
      const hasCofSelection = !!(cofSel && cofSel.value && cofSel.value !== '-1');
      // If PayByCheck is checked, treat as NEW regardless of COF select retaining a value
      if (rbBankNew?.checked) return 'bank_new';
      if (rbBankSaved?.checked) return 'bank_saved';
      if (hasCofSelection) return 'bank_saved';

      return 'bank_new';
    }

    function ensureCofVisible(){
      try{ window.WLPayMode?.ensureCheckOnFileUI?.(); }catch(e){}
      try{
        if (rbCof && !rbCof.checked) clickWebFormsRadio(rbCof);
      }catch(e){}
    }

    
    function renderPayCards(){
      const methodMount = $('wlPayMethodCards');
      const bankMount   = $('wlPayBankCards');
      const cardMount   = $('wlPayCardCards');
      if (!methodMount || !bankMount || !cardMount) return;

      // Credit availability: only when WebTrack actually offers pay-by-card OR card-on-file on this account (e.g., CAB)
      function isCardSupported(){
  try{
    // Card is supported when WebTrack exposes Cards-On-File UI OR when the credit radio label clearly indicates a card method.
    const hasCardOnFileUI = !!(rbCardSaved || cardSel0 || card1 || card2);
    const tCred = (__wlLabelText ? __wlLabelText(rbCred) : '');
    const labelSaysCard = __wlLooksCard && __wlLooksCard(tCred) && !(__wlLooksBank && __wlLooksBank(tCred));
    return hasCardOnFileUI || labelSaysCard;
  }catch(e){ return false; }
}

const hasSavedCards = !!(rbCardSaved || cardSel0 || card1 || card2);

      // Only allow CARDS ON FILE (no adding new card here)
      const cardAvail = hasSavedCards;

// Top-level method row:
      // - Always show Bank
      // - Only show Card when WebTrack actually offers it for this account (e.g., CAB)
      methodMount.style.display = 'grid';
      methodMount.style.gridTemplateColumns = 'repeat(auto-fit, minmax(0, 1fr))';
      methodMount.innerHTML = `
        <button type="button" class="wl-pay-card" data-method="bank">
          <div class="wl-pay-title">Pay by Bank (ACH)</div>
          <div class="wl-pay-sub">Use a bank account (new or saved).</div>
        </button>
        ${cardAvail ? `
        <button type="button" class="wl-pay-card" data-method="card">
          <div class="wl-pay-title">Pay by Card (On File)</div>
          <div class="wl-pay-sub">Use a saved card on file.</div>
        </button>` : ``}
      `;

      // ----- Detect current mode (persisted intent wins) -----
      function currentMode2(){
        const st = loadPayState() || {};

        // If card isn't available, force bank
        if (st.method === 'card' && !cardAvail){
          st.method = 'bank';
          st.bank = st.bank || { mode:'new' };
          delete st.card;
          savePayState(st);
        }

        // Native radios may be set by server on CAB loads. ONLY honor them if the user actually chose Card.
// Otherwise, keep Bank (ACH) as the default even when Card is available.
        if (cardAvail && st.method === 'card'){
          if (rbCardSaved?.checked) return 'card_saved';
          if (st.card?.mode === 'saved') return 'card_saved';
        }
        if (st.method === 'bank' && st.bank?.mode === 'saved') return 'bank_saved';
        if (st.method === 'bank' && st.bank?.mode === 'new') return 'bank_new';

        // Fallback inference (no saved state)
        const hasCofSelection = !!(cofSel && cofSel.value && cofSel.value !== '-1');
        // If "Add new" is selected (PayByCheck), treat as NEW regardless of COF select retaining a value
        if (rbBankNew?.checked) return 'bank_new';
        if (rbBankSaved?.checked || hasCofSelection) return 'bank_saved';

        return 'bank_new';
      }

      const mode = currentMode2();
      const isCardMode = (mode === 'card_saved');

      // ----- Top-level selection styles -----
      const bankMethodCard = methodMount.querySelector?.('[data-method="bank"]');
      const cardMethodCard = methodMount.querySelector?.('[data-method="card"]');
      const stSel = loadPayState() || {};
      const userPicked = !!stSel.__userPicked;

      if (!userPicked){
        setSelectedCard(bankMethodCard, false);
        setSelectedCard(cardMethodCard, false);
      } else {
        setSelectedCard(bankMethodCard, !isCardMode);
        setSelectedCard(cardMethodCard, isCardMode);
      }
      // ----- Second level visibility -----
      // Keep everything visually unselected at first load. Once the customer picks a method,
      // show the appropriate second level (Bank accounts or Cards) and let the native radios postback
      // to populate the saved lists.
      const stPick = loadPayState() || {};
      const userPicked2 = !!stPick.__userPicked;

      bankMount.style.display = (userPicked2 && !isCardMode) ? 'grid' : 'none';
      cardMount.style.display = (userPicked2 && isCardMode) ? 'grid' : 'none';

      // Bank account cards (Add new + saved)
      const bankOpts = [];
      try{
        if (cofSel && cofSel.options){
          for (const o of Array.from(cofSel.options)){
            const val = String(o.value || '').trim();
            const txt = String(o.text || '').trim();
            if (!val || val === '-1') continue;
            if (!txt || /select/i.test(txt)) continue;
            bankOpts.push({ value: val, text: txt });
          }
        }
      }catch(e){}

      const stBank = loadPayState() || {};
      
      // If we're in ACH mode and saved accounts exist but aren't visible yet (common until COF mode is activated),
      // prefer showing saved accounts by default.
      if (!isCardMode && (!bankOpts.length) && rbCof && !rbCof.checked){
        try{
          // Switch to COF behind the scenes so the select options populate.
          clickWebFormsRadio(rbCof);
          const st = loadPayState() || {};
          st.method = 'bank';
          st.bank = st.bank || {};
          st.bank.mode = 'saved';
          savePayState(st);
        }catch(e){}
      }
const selectedCofVal = (cofSel && cofSel.value) ? String(cofSel.value) : '';
      const desiredSavedVal = (stBank?.method === 'bank' && stBank?.bank?.mode === 'saved' && stBank?.bank?.value) ? String(stBank.bank.value) : '';
      const bankMatchVal = desiredSavedVal || selectedCofVal;

      const bankSavedCards = bankOpts.map(o=>{
        const selected = (mode === 'bank_saved' && bankMatchVal && bankMatchVal === o.value);
        return `
          <button type="button" class="wl-pay-card wl-bank-card ${selected ? 'is-selected':''}"
                  data-bank="saved" data-value="${o.value}">
            <div class="wl-pay-title">${o.text}</div>
            <div class="wl-pay-sub">Saved bank account</div>
          </button>
        `;
      }).join('');

      const bankAddNewSelected = (mode === 'bank_new' || (!cardAvail && bankOpts.length === 0));
      bankMount.innerHTML = `
        <button type="button" class="wl-pay-card wl-bank-card ${bankAddNewSelected ? 'is-selected':''}"
                data-bank="new">
          <div class="wl-pay-title">Add new bank account</div>
          <div class="wl-pay-sub">Enter bank details (ACH).</div>
        </button>
        ${bankSavedCards || ''}
      `;

      // ----- CARD second level (only shown when card selected) -----
      cardMount.style.display = (isCardMode && cardAvail) ? 'grid' : 'none';
      if (cardAvail){
        // Resolve cards-on-file select (can be replaced during partial postbacks)
        const cardSel = getCardSel();

        const cardOpts = [];
        try{
          if (cardSel && cardSel.options){
            for (const o of Array.from(cardSel.options)){
              const val = String(o.value || '').trim();
              const txt = String(o.text || '').trim();
              if (!val || val === '-1') continue;
              if (!txt || /select/i.test(txt)) continue;
              cardOpts.push({ value: val, text: txt });
            }
          }
        }catch(e){}

        const stCard = loadPayState() || {};
        const desiredCardVal = (stCard?.method === 'card' && stCard?.card?.mode === 'saved' && stCard?.card?.value) ? String(stCard.card.value) : '';
        const selectedCardVal = (cardSel && cardSel.value) ? String(cardSel.value) : '';
        const cardMatchVal = desiredCardVal || selectedCardVal;

        const showAddNewCard = false; // disabled: only allow cards on file
        const showSavedCards = isRadioAvailable(rbCardSaved) && cardOpts.length > 0;

        const addNewCardSelected = false;
const savedCardCards = cardOpts.map(o=>{
          const selected = (mode === 'card_saved' && cardMatchVal && cardMatchVal === o.value);
          return `
            <button type="button" class="wl-pay-card wl-card-card ${selected ? 'is-selected':''}"
                    data-card="saved" data-value="${o.value}">
              <div class="wl-pay-title">${o.text}</div>
              <div class="wl-pay-sub">Saved card</div>
            </button>
          `;
        }).join('');

        cardMount.innerHTML = `
          ${showAddNewCard ? `
            <button type="button" class="wl-pay-card wl-card-card ${addNewCardSelected ? 'is-selected':''}"
                    data-card="new">
              <div class="wl-pay-title">Add new card</div>
              <div class="wl-pay-sub">Enter card details.</div>
            </button>
          ` : ''}
          ${showSavedCards ? savedCardCards : ''}
        `;

        // Card level click handler (wire each render so it always works after MS AJAX updates)
        cardMount.onclick = (e)=>{
          const btn = e.target.closest('.wl-pay-card[data-card]');
          if (!btn) return;
          const kind = btn.getAttribute('data-card');

          if (kind === 'new'){
            // "Add new card" is disabled. If this ever appears (legacy), treat it as NEW BANK (ACH).
            savePayState({ __userPicked:true, method:'bank', bank:{ mode:'new' } });
            try{ clickWebFormsRadio(rbBankNew); }catch(e){}
            ensureCofVisible();
            setTimeout(()=>{ reconcileNativeFromState(); renderPayCards(); try{ renderSummary(); }catch(e){} }, 80);
            return;
          }

          const val = btn.getAttribute('data-value') || '';
          if (!val) return;
          const text = (btn.querySelector('.wl-pay-title')?.textContent || '').trim();
          savePayState({ __userPicked:true, method:'card', card:{ mode:'saved', value: val, text } });

          // Store intended selection and let MS AJAX endRequest apply it after the postback replaces the select.
          try{
            window.WLPayPending = window.WLPayPending || {};
            window.WLPayPending.__cardPendingVal = val;
            window.WLPayPending.__cardPendingText = text;
          }catch(e){}

          try{
            if (rbCardOnFile && !rbCardOnFile.checked) clickWebFormsRadio(rbCardSaved);
          }catch(e){}

          // Try applying immediately as well (covers no-postback cases)
          setTimeout(()=>{
            try{ if (window.WLPayPending && typeof window.WLPayPending.apply === 'function') window.WLPayPending.apply(); }catch(e){}
            setTimeout(()=>{ reconcileNativeFromState(); renderPayCards(); try{ renderSummary(); }catch(e){} }, 120);
          }, 80);
        };
      } else {
        cardMount.innerHTML = '';
        cardMount.onclick = null;
      }

      // ----- Top-level method click handler -----
      methodMount.onclick = (e)=>{
        const btn = e.target.closest('.wl-pay-card[data-method]');
        if (!btn) return;
        const method = btn.getAttribute('data-method');

        if (method === 'card'){
          // Cards: ONLY allow Cards On File here.
          if (!cardAvail) return;

          const st = loadPayState() || {};
          const preferSaved = !!(st?.card?.mode === 'saved' && st?.card?.value);
          savePayState({ __userPicked:true, method:'card', card: preferSaved ? st.card : { mode:'saved' } });

          try{
            if (isRadioAvailable(rbCardSaved)) clickWebFormsRadio(rbCardSaved);
          }catch(e){}
        } else {
          // Bank is the default
          const st = loadPayState() || {};
          const preferSaved = !!(st?.bank?.mode === 'saved' && st?.bank?.value);
          savePayState({ __userPicked:true, method:'bank', bank: preferSaved ? st.bank : { mode:'new' } });

          try{
            if (preferSaved) clickWebFormsRadio(rbCof);
            else clickWebFormsRadio(rbBankNew);
          }catch(e){}
          ensureCofVisible();
        }

        setTimeout(()=>{ reconcileNativeFromState(); renderPayCards(); try{ renderSummary(); }catch(e){} }, 80);
      };

      // ----- Bank level click handler (wire each render so it always works after MS AJAX updates) -----
      bankMount.onclick = (e)=>{
        const btn = e.target.closest('.wl-pay-card[data-bank]');
        if (!btn) return;

        const kind = btn.getAttribute('data-bank');

        if (kind === 'new'){
          // User intends to enter a NEW bank account
          savePayState({ __userPicked:true, method:'bank', bank:{ mode:'new' } });

          // Clear any pending selections so we don't "snap back" to a saved method after postback
          try{
            window.WLPayPending = window.WLPayPending || {};
            window.WLPayPending.__cofPendingVal = '__CLEAR__';
            window.WLPayPending.__cofPendingText = null;
          }catch(e){}

          // Clear current COF dropdown value immediately (if present) and trigger postback
          try{
            const sel = getCofSel();
            if (sel){
              // IMPORTANT: fire change so WebForms updates server state; otherwise it may keep using the prior saved selection
              clearSelectToPlaceholder(sel, true);
            }
          }catch(e){}

          // Immediate visual update
          renderPayCards();
          try{ renderSummary(); }catch(e){}

          // Trigger the REAL WebForms radio for "Pay by Bank (new)"
          try{
            if (rbBankSaved) rbBankSaved.checked = false;
            clickWebFormsRadio(rbBankNew);
          }catch(e){}

          // After postback, ensure COF selection is cleared and UI/summary match the true native state
          setTimeout(()=>{
            try{ if (window.WLPayPending && typeof window.WLPayPending.apply === 'function') window.WLPayPending.apply(); }catch(e){}
            reconcileNativeFromState();
            renderPayCards();
            try{ renderSummary(); }catch(e){}
          }, 180);

          return;
        }

        const val = btn.getAttribute('data-value') || '';
        if (!val) return;

        const text = (btn.querySelector('.wl-pay-title')?.textContent || '').trim();
        savePayState({ __userPicked:true, method:'bank', bank:{ mode:'saved', value: val, text } });

        ensureCofVisible();

        // Store intended COF selection; applying after MS AJAX endRequest is more reliable
        try{
          window.WLPayPending = window.WLPayPending || {};
          window.WLPayPending.__cofPendingVal = val;
          window.WLPayPending.__cofPendingText = text;
        }catch(e){}

        setTimeout(()=>{
          try{
            if (rbCof && !rbCof.checked) clickWebFormsRadio(rbCof);
            else if (rbCof && rbCof.checked){
              // even if already checked, a change in dropdown may still require a postback
              // apply will dispatch change on the select
            }
          }catch(e){}

          // Try applying immediately, and endRequest will re-apply if the select gets replaced
          setTimeout(()=>{
            try{ if (window.WLPayPending && typeof window.WLPayPending.apply === 'function') window.WLPayPending.apply(); }catch(e){}
            setTimeout(()=>{ reconcileNativeFromState(); renderPayCards(); try{ renderSummary(); }catch(e){} }, 160);
          }, 120);
        }, 80);
      };
    }
// Initial render + rerender after MS AJAX updates
    if (!loadPayState()){
      savePayState({ method:'bank', bank:{ mode:'new' } });
    } else {
      const st0 = loadPayState();
      if ((st0?.method === 'credit' || st0?.method === 'card') && !isCreditAvailable()){
        savePayState({ method:'bank', bank:{ mode:'new' } });
      }
    }
    reconcileNativeFromState();
    renderPayCards();
    try{ renderSummary(); }catch(e){}
    try{
      if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager){
        const prm = Sys.WebForms.PageRequestManager.getInstance();
        if (!prm.__wlPayCardsBound){
          prm.add_endRequest(()=>{ setTimeout(()=>{ reconcileNativeFromState(); renderPayCards(); try{ renderSummary(); }catch(e){} }, 0); });
          prm.__wlPayCardsBound = true;
        }
      }
    }catch(e){}


    // Move Make Payment button
    const mp = findMakePaymentButton();
    if (mp){
      const wrap = mp.closest('.epi-form-group-acctPayment') || mp.parentElement;
      const submitCard = document.createElement('div');
      submitCard.className = 'wl-card';
      submitCard.innerHTML = `<div class="wl-card-head">Submit</div><div class="wl-card-body" id="w3SubmitInner"></div>`;
      payHost.appendChild(submitCard);
      const sub = $('w3SubmitInner');
      if (wrap) sub.appendChild(wrap);
      else sub.appendChild(mp);
    }

    // Step state
    // Preserve wizard step across full postbacks/reloads so a delayed WebForms postback
    // (like Billing onchange) doesn't yank the user back to Step 1 later.
    let step = Number(sessionStorage.getItem(STEP_KEY) || '0');
    if (!Number.isFinite(step)) step = 0;
    step = Math.max(0, Math.min(3, step));
    sessionStorage.setItem(STEP_KEY, String(step));

let __wlSubmitted = false;
// Warn only on real navigation (not WebForms postbacks)
document.addEventListener('click', function (ev) {
  try {
    if (__wlSubmitted) return;
    const a = ev.target?.closest?.('a[href]');
    if (!a) return;

    const href = (a.getAttribute('href') || '').trim();
    if (!href) return;

    // Ignore WebForms postbacks / JS links / same-page anchors
    if (href.startsWith('#') || /^javascript:/i.test(href) || /__doPostBack/i.test(href)) return;

    // If user has progressed in the wizard, warn before leaving
    const s = Number(sessionStorage.getItem(STEP_KEY) || '0');
    if (s > 0) {
      const ok = window.confirm('Any progress on this payment may be lost. Continue?');
      if (!ok) { ev.preventDefault(); ev.stopPropagation(); }
    }
  } catch {}
}, true);
function setStep(n){
      step = Math.max(0, Math.min(3, Number(n||0)));
      sessionStorage.setItem(STEP_KEY, String(step));

      wiz.querySelectorAll('[data-pill]').forEach(p=>{
        p.classList.toggle('on', Number(p.getAttribute('data-pill')) === step);
      });
      wiz.querySelectorAll('.w3-panel').forEach(p=>{
        p.classList.toggle('on', Number(p.getAttribute('data-step')) === step);
      });

      $('w3Back').disabled = (step === 0);
      $('w3Next').textContent = (step === 3) ? 'Ready' : 'Next';

      if (step === 2){
        $('w3Review').innerHTML = buildReviewHTML();
      }
      if (step === 3){
        // Make sure COF is actually usable
        window.WLPayMode?.ensureCheckOnFileUI?.();
        const rb = $('ctl00_PageBody_RadioButton_PayByCheckOnFile');
        const ck = $('ctl00_PageBody_RadioButton_PayByCheck');
        rb?.addEventListener('change', ensureCOFLoaded);
        ck?.addEventListener('change', ()=>window.WLPayMode?.ensureCheckOnFileUI?.());
        ensureCOFLoaded();
      }
    }

    function validateStep(){
      if (step === 1){
        if (!(getAmount() > 0)){
          alert('Enter a payment amount (or use statement/jobs/invoices to fill it).');
          return false;
        }
      }
      return true;
    }

    $('w3Back').addEventListener('click', ()=>setStep(step-1));
    $('w3Next').addEventListener('click', ()=>{
      if (!validateStep()) return;

      // Step 0 -> Step 1: persist Billing; if present, lock + force a server round-trip so the WebForms state is stable.
      if (step === 0){
        let v = '';
        try{
          const real = $('ctl00_PageBody_BillingAddressTextBox');
          const proxy = document.getElementById('wlProxyBillingInput');
          v = (proxy?.value || real?.value || '').trim();
          saveBillDraft(v);
          if (v) lockBilling(v);
        }catch(e){}

        // Keep them on Step 1 after any round-trip.
        try{ sessionStorage.setItem(STEP_KEY, '1'); }catch(e){}

        // If they already typed billing, trigger the same postback path as "Make Payment" (throttled).
        if (v){
          try{ forceWizardRoundTrip('step0-next'); }catch(e){}
        }

        setStep(1);
        return;
      }

      setStep(step+1);
    });

    setStep(step);
    return true;
  
    try { pinBillingToStep1({ attempt: 0 }); } catch {}

    try{ sessionStorage.removeItem('wl_billDraft_reloading'); }catch(e){}
}

  function boot(){
    sanitizeEmailInPlace();

    // try a few times — layout may build after async scripts
    let tries = 0;
    const max = 80; // ~4s at 50ms
    const t = setInterval(()=>{
      tries++;
      const ok = mount();
      if (ok || tries >= max) clearInterval(t);
    }, 50);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

  // Re-attach after WebForms async updates (Telerik grids, etc.)
  try {
    if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager) {
      const prm = Sys.WebForms.PageRequestManager.getInstance();
      prm.add_endRequest(function(){
        try { mount(); } catch {}
        try { pinBillingToStep1({ attempt: 0 }); } catch {}
      });
    }
  } catch {}
})();
