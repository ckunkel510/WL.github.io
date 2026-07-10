
/* ==========================================================
   Woodson — Account Overview (AccountInfo_R.aspx)
   v4.4 — selected-email preference editing fix,
          customer fields ready + button-only modal close
   ========================================================== */
(function(){
  'use strict';
  if (!/AccountInfo_R\.aspx/i.test(location.pathname)) return;

  /* Optional endpoints (leave blank for local-only fallback)
     IMPORTANT: Constant Contact API calls should go through a secure backend route.
     Do not put Constant Contact client secrets/tokens in this browser file.

     Example Vercel/Apps Script route for COMM_PREFS_POST:
     https://wlmarketingdashboard.vercel.app/api/constant-contact/preferences
  */
  const SHEET_API_GET  = '';
  const SHEET_API_POST = '';
  const SHEET_REQ_POST = '';
  const COMM_PREFS_POST = 'https://script.google.com/macros/s/AKfycbzmUdU2XZ0JGNEzorkbifFLdvnYQxHl6pUFbsJzi29dg_3jFbBLD9zkixZiwSNiUPRJvQ/exec?action=savePreferences';

  // Used to pull the customer's current Constant Contact/list status back into the modal.
  // Apps Script does not reliably support CORS JSON reads, so this route is called by JSONP below.
  const COMM_PREFS_GET = COMM_PREFS_POST.replace('action=savePreferences', 'action=getPreferences');
  const COMM_PREFS_LINK = COMM_PREFS_POST.replace('action=savePreferences', 'action=linkEmail');
  const COMM_PREFS_ACCOUNT_EMAILS = COMM_PREFS_POST.replace('action=savePreferences', 'action=getAccountEmails');

  const PAYMENT_METHODS_URL = 'https://webtrack.woodsonlumber.com/CustomerTokens.aspx';
  const AUTOPAY_CONTEXT_KEY = 'wl_autopay_account_context_v1';
  const AUTOPAY_PENDING_KEY = 'wl_autopay_pending_v1';
  const AUTOPAY_ACTIVE_KEY = 'wl_autopay_active_v1';
  const AUTOPAY_ALLOWED_LOGINS = ['ckunkel2', 'ckunkel3'];

  // Same-origin lookup used to pull the account email from AccountSettings.aspx
  // instead of relying on localStorage or requiring the customer to re-type it.
  const ACCOUNT_SETTINGS_URL = 'AccountSettings.aspx';
  const ACCOUNT_SETTINGS_EMAIL_SELECTOR = '#ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput';
  let accountSettingsDetailsPromise = null;
  let accountSettingsEmailPromise = null;

  /* utils */
  const BRAND = { primary:'#6b0016', primaryHover:'#540011', bgSoft:'#fbf5f6', border:'#e6e6e6' };
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const dom=(html)=>{ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; };
  const txt=(el)=> (el?.textContent||'').trim();
  const href=(el)=> el?.getAttribute('href')||'#';
  const mNum=(s)=>{ const v=parseFloat(String(s||'').replace(/[^0-9.\-]/g,'')); return Number.isFinite(v)?v:0; };
  const parseUS=(s)=>{ const m=String(s||'').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m? new Date(+m[3],+m[1]-1,+m[2]) : null; };
  const next10=(d)=>{ if(!(d instanceof Date)) return '—'; const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); (x.getDate()<10)?x.setDate(10):x.setMonth(x.getMonth()+1,10); return x.toLocaleDateString(); };
  const emailOK=(v)=> /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim());
  const digits=(v)=> String(v||'').replace(/\D+/g,'').slice(0,15);
  const fmtMoney=(n)=> new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
  const displayMoney=(value)=>{
    const raw=String(value||'').trim();
    if(!raw) return '--';
    return /\$/.test(raw)?raw:fmtMoney(mNum(raw));
  };
  const displayQty=(value)=>{
    const raw=String(value||'').trim();
    if(!raw) return '';
    const number=mNum(raw);
    return Number.isInteger(number)?String(number):number.toLocaleString('en-US',{maximumFractionDigits:2});
  };
  const displayDate=(value)=>{
    const raw=String(value||'').trim();
    const match=raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if(!match) return raw;
    return new Date(+match[3],+match[1]-1,+match[2]).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  };
  const ordinal=(value)=>{
    const n=Number(value);
    if(!n) return '';
    if(n%100>=11 && n%100<=13) return `${n}th`;
    if(n%10===1) return `${n}st`;
    if(n%10===2) return `${n}nd`;
    if(n%10===3) return `${n}rd`;
    return `${n}th`;
  };
  const displayISODate=(value)=>{
    const raw=String(value||'').trim();
    const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m) return raw;
    return new Date(Number(m[1]),Number(m[2])-1,Number(m[3])).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  };
  function isAutopayAllowedIdentity(...values){
    const tokens = values
      .flatMap(value => String(value || '').toLowerCase().split(/[^a-z0-9]+/))
      .filter(Boolean);
    return AUTOPAY_ALLOWED_LOGINS.some(login => tokens.includes(login));
  }
  function readJsonLocal(key, fallback){
    try { return JSON.parse(localStorage.getItem(key) || ''); } catch { return fallback; }
  }
  function autopayStatusLabel(value){
    const clean=String(value||'pending_review').replace(/_/g,' ').trim();
    return clean.replace(/\b\w/g, ch=>ch.toUpperCase());
  }
  function findLocalAutopay(accountName){
    const raw=readJsonLocal(AUTOPAY_ACTIVE_KEY, []);
    const records=Array.isArray(raw)?raw:(raw?[raw]:[]);
    const open=records.filter(record => record?.authorization && !/cancelled/i.test(record.authorization.status||''));
    if(!open.length) return null;
    const needle=String(accountName||'').trim().toLowerCase();
    return open.find(record => String(record.authorization.account?.name||'').trim().toLowerCase()===needle) || open[0];
  }
  function getCashBalanceCredit(){
    const el=document.getElementById('ctl00_PageBody_lblBalanceLabel');
    if(!el) return 0;
    // e.g. "Cash balance: $10.00"
    return mNum(el.textContent);
  }
  function waitFor(sel,{timeout=1000,interval=120}={}){return new Promise((res,rej)=>{const t0=Date.now();const tick=()=>{const el=$(sel);if(el) return res(el); if(Date.now()-t0>=timeout) return rej(new Error('timeout '+sel)); setTimeout(tick,interval)}; (document.readyState==='loading')?document.addEventListener('DOMContentLoaded',tick,{once:true}):tick();});}
  function escapeHtml(value){ return String(value||'').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }
  function escapeAttr(value){ return escapeHtml(value).replace(/'/g,'&#39;'); }

  /* ----------- styles ----------- */
  const styles = `
  .wl-acct-root, .wl-acct-root * { box-sizing: border-box; }
  .wl-acct-root{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif; width:100%}
  div#MainLayoutRow{box-sizing:border-box!important;width:calc(100% - 32px)!important;max-width:1180px!important;margin:20px auto 0!important}
  #MainLayoutRow>.container-fluid,#MainLayoutRow>.container-fluid>.row,#MainLayoutRow>.container-fluid>.row>.col,#MainLayoutRow .bodyFlexContainer,#MainLayoutRow .bodyFlexItem{box-sizing:border-box!important;width:100%!important;max-width:100%!important}
  #MainLayoutRow>.container-fluid>.row{margin-right:0!important;margin-left:0!important}
  #MainLayoutRow>.container-fluid>.row>.col{flex:0 0 100%!important;padding-right:0!important;padding-left:0!important}
  #MainLayoutRow .bodyFlexContainer{display:block!important}
  #pageContent,#pageContent>tbody,#pageContent>tbody>tr,td.pageContentBody{box-sizing:border-box!important;width:100%!important;max-width:100%!important}
  .wl-top{position:relative;display:flex;align-items:center;justify-content:space-between;margin:6px 0 12px}
  .wl-ham{display:inline-flex;align-items:center;gap:10px}
  .wl-title{font-size:1.15rem;font-weight:800;color:${BRAND.primary}}
  .wl-ham button{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid ${BRAND.border};border-radius:9px;background:#fff;cursor:pointer;font-weight:700;color:${BRAND.primary}}
  .wl-ham-menu{position:absolute;left:8px;top:44px;z-index:1000;background:#fff;border:1px solid ${BRAND.border};border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.12);padding:8px;width:min(380px,92vw);max-height:70vh;overflow:auto;transition:max-height .25s ease, opacity .2s ease; max-height:0; opacity:0; pointer-events:none}
  .wl-ham-menu.open{max-height:70vh; opacity:1; pointer-events:auto}
  .wl-ham-menu a{display:block;padding:8px 10px;border-radius:8px;color:#111;text-decoration:none}
  .wl-ham-menu a:hover{background:${BRAND.bgSoft}}
  .wl-ham-menu-section{padding:4px 0}
  .wl-ham-menu-section + .wl-ham-menu-section{border-top:1px solid #eee;margin-top:4px;padding-top:8px}
  .wl-ham-menu-label{padding:5px 10px 4px;color:#6f6264;font-size:.72rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
  .wl-ham-menu a[aria-current="page"]{background:${BRAND.bgSoft};color:${BRAND.primary}}
  .wl-hide{position:absolute !important;left:-9999px !important;width:1px !important;height:1px !important;overflow:hidden !important}

  /* GRID ROWS */
  .wl-row{display:grid;gap:14px;margin-bottom:14px}
  .wl-row-3{grid-template-columns:repeat(auto-fit, minmax(340px, 1fr));}
  .wl-row-2{grid-template-columns:repeat(auto-fit, minmax(420px, 1fr));}
  .wl-row-1{grid-template-columns:1fr;}
  @media (max-width: 1024px){ .wl-row-2{grid-template-columns:repeat(auto-fit, minmax(340px, 1fr));} }
  @media (max-width: 720px){
    div#MainLayoutRow{width:100%!important;max-width:none!important;margin:10px 0 0!important}
    #MainLayoutRow>.container-fluid{padding-right:10px!important;padding-left:10px!important}
    .wl-row-3,.wl-row-2{grid-template-columns:1fr}
    .wl-top{flex-wrap:wrap;gap:10px}
  }

  /* CARDS */
  .wl-card{min-width:0;background:#fff;border:1px solid ${BRAND.border};border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.05);overflow:hidden}
  .wl-head{background:${BRAND.primary};color:#fff;padding:10px 14px;font-weight:750;letter-spacing:.2px;white-space:nowrap}
  .wl-body{padding:12px;background:${BRAND.bgSoft}}

  /* KPIs */
  .wl-kpis{display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:10px}
  .wl-kpi{background:#fff;border:1px solid #ecd6db;border-radius:10px;padding:10px;min-width:0}
  .wl-kpi .lbl{font-size:.9rem;color:#6e5f61;white-space:nowrap}
  .wl-kpi .val{font-weight:800;font-size:1.1rem;margin-top:2px;color:${BRAND.primary};white-space:nowrap}

  /* Lists & buttons */
  .wl-list{margin:0;padding:0;list-style:none}
  .wl-list:empty::before{content:attr(data-empty);display:block;padding:18px;color:#70696a;text-align:center;background:#fff;border:1px solid #ece7e8;border-radius:8px}
  .wl-list li{min-width:0}
  .wl-meta{font-size:.9rem;color:#5f5f5f}
  .wl-pill{display:inline-block;padding:2px 10px;border-radius:999px;background:#fff;border:1px solid #e0c7cc;font-size:.8rem;color:${BRAND.primary};font-weight:700;white-space:nowrap}

  /* Account activity, orders, and purchases */
  .wl-detail-section{border:0;border-radius:0;box-shadow:none;overflow:visible;background:transparent}
  .wl-detail-section>.wl-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:8px 2px;background:transparent;color:#211d1e;border-bottom:2px solid ${BRAND.primary};font-size:1.05rem;white-space:normal}
  .wl-head-note{color:#71686a;font-size:.76rem;font-weight:700}
  .wl-detail-section>.wl-body{padding:12px 0 0;background:transparent}
  .wl-section-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;margin-bottom:10px;overflow:hidden;border:1px solid #e8e2e3;border-radius:8px;background:#e8e2e3}
  .wl-summary-stat{min-width:0;padding:9px 10px;background:#fff}
  .wl-summary-label{display:block;color:#70696a;font-size:.72rem;font-weight:700;text-transform:uppercase}
  .wl-summary-value{display:block;margin-top:2px;color:#211d1e;font-size:.98rem;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .wl-entry-list{display:grid;gap:7px}
  .wl-entry{display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:10px;padding:10px 11px;border:1px solid #e8e2e3;border-radius:8px;background:#fff;box-shadow:0 1px 2px rgba(32,24,26,.04)}
  .wl-entry-icon{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:8px;background:${BRAND.bgSoft};color:${BRAND.primary};font-size:1rem}
  .wl-entry-icon.credit{background:#edf7ef;color:#28713a}
  .wl-entry-main{min-width:0}
  .wl-entry-title{display:flex;align-items:center;gap:7px;min-width:0}
  .wl-entry-title a{min-width:0;overflow:hidden;color:#241f20;font-weight:800;text-decoration:none;text-overflow:ellipsis;white-space:nowrap}
  .wl-entry-title a:hover{text-decoration:underline;text-decoration-color:${BRAND.primary}}
  .wl-entry-meta{margin-top:3px;color:#6b6465;font-size:.82rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .wl-entry-side{text-align:right}
  .wl-entry-amount{color:${BRAND.primary};font-size:.94rem;font-weight:850;white-space:nowrap}
  .wl-status{display:inline-flex;align-items:center;gap:5px;margin-top:3px;color:#625c5d;font-size:.72rem;font-weight:750;white-space:nowrap}
  .wl-status::before{content:"";width:6px;height:6px;border-radius:50%;background:#8c8485}
  .wl-status.open::before,.wl-status.processing::before{background:#b16a00}
  .wl-status.complete::before,.wl-status.closed::before{background:#27813c}
  .wl-purchase-summary{grid-template-columns:repeat(3,minmax(0,1fr))}
  .wl-purchase-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:9px}
  .wl-purchase-item{display:grid;grid-template-columns:86px minmax(0,1fr);gap:12px;min-width:0;padding:11px;border:1px solid #e8e2e3;border-radius:8px;background:#fff;box-shadow:0 1px 3px rgba(32,24,26,.05)}
  .wl-purchase-media{position:relative;display:flex;align-items:center;justify-content:center;width:86px;height:86px;overflow:hidden;border:1px solid #ece7e8;border-radius:7px;background:#fff}
  .wl-purchase-media img{display:block;width:100%;height:100%;object-fit:contain;padding:4px}
  .wl-product-fallback{display:flex;align-items:center;justify-content:center;width:100%;height:100%;padding:8px;background:#f6f3f4;color:${BRAND.primary};font-size:.7rem;font-weight:850;text-align:center;word-break:break-word}
  .wl-purchase-content{display:flex;min-width:0;flex-direction:column}
  .wl-product-code{color:${BRAND.primary};font-size:.73rem;font-weight:850;text-transform:uppercase;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .wl-product-name{display:-webkit-box;margin-top:3px;overflow:hidden;color:#211d1e;font-size:.92rem;font-weight:800;line-height:1.3;-webkit-box-orient:vertical;-webkit-line-clamp:2}
  .wl-product-meta{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:5px;color:#6b6465;font-size:.78rem}
  .wl-product-bottom{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;margin-top:auto;padding-top:7px}
  .wl-product-total{color:#211d1e;font-size:.88rem;font-weight:850;white-space:nowrap}
  .wl-product-link{display:inline-flex;align-items:center;gap:5px;color:${BRAND.primary};font-size:.78rem;font-weight:850;text-decoration:none;white-space:nowrap}
  .wl-product-link:hover{text-decoration:underline}

  .wl-actions{display:flex;gap:8px;flex-wrap:wrap}
  .wl-btn{display:inline-flex;align-items:center;justify-content:center;padding:9px 14px;border-radius:9px;border:1px solid ${BRAND.border};background:#fff;text-decoration:none;color:#111;font-weight:700;line-height:1.2;white-space:nowrap;min-width:150px}
  .wl-btn.primary{background:${BRAND.primary};border-color:${BRAND.primary};color:#fff}
  .wl-btn.primary:hover{background:${BRAND.primaryHover};border-color:${BRAND.primaryHover}}
  @media (min-width: 721px){
    .wl-acct-root{font-size:15px;line-height:1.5}
    .wl-title{font-size:18px}
    .wl-ham button,.wl-ham-menu a,.wl-btn{font-size:14px}
    .wl-head{font-size:15px}
    .wl-kpi .lbl,.wl-meta{font-size:13px}
    .wl-kpi .val{font-size:16px}
    .wl-detail-section>.wl-head{font-size:16px}
    .wl-head-note{font-size:12px}
    .wl-summary-label{font-size:11px}
    .wl-summary-value{font-size:14px}
    .wl-entry-title a{font-size:14px}
    .wl-entry-meta{font-size:12px}
    .wl-entry-amount{font-size:14px}
    .wl-status{font-size:11px}
    .wl-product-code{font-size:11px}
    .wl-product-name{font-size:14px;line-height:1.35}
    .wl-product-meta{font-size:12px}
    .wl-product-total{font-size:14px}
    .wl-product-link{font-size:12px}
  }
  @media (max-width: 560px){
    .wl-btn{flex:1 1 auto;min-width:unset}
    .wl-ham{width:100%}
    .wl-ham button{width:40px;min-width:40px;height:40px;padding:0;justify-content:center}
    .wl-ham button span{display:none}
    .wl-title{min-width:0;font-size:1rem;line-height:1.3}
  }
  @media (max-width: 640px){
    .wl-section-summary,.wl-purchase-summary{grid-template-columns:repeat(3,minmax(0,1fr))}
    .wl-summary-stat{padding:8px 7px}
    .wl-summary-label{font-size:.64rem}
    .wl-summary-value{font-size:.86rem}
    .wl-entry{grid-template-columns:34px minmax(0,1fr);padding:9px}
    .wl-entry-icon{width:34px;height:34px}
    .wl-entry-side{grid-column:2;display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left}
    .wl-purchase-grid{grid-template-columns:1fr}
    .wl-purchase-item{grid-template-columns:76px minmax(0,1fr);padding:9px;gap:10px}
    .wl-purchase-media{width:76px;height:76px}
  }

  /* Cart Snapshot visuals */
  .wl-cart-list li{gap:12px}
  .wl-cart-left{display:flex;align-items:center;justify-content:center}
  .wl-cart-thumb{width:64px;height:64px;object-fit:contain;border-radius:6px;background:#fff;border:1px solid #eee}
  .wl-cart-mid{flex:1 1 auto;min-width:0}
  .wl-cart-code{font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:340px}
  .wl-cart-right{display:flex;align-items:center;gap:8px}

  /* MODALS */
  .wl-modal{position:fixed;inset:0;display:none;align-items:flex-start;justify-content:center;background:rgba(0,0,0,.35);z-index:9999;padding:16px;overflow:auto}
  .wl-modal.open{display:flex}
  .wl-modal-card{width:min(780px,94vw);max-height:calc(100vh - 32px);margin:auto 0;background:#fff;border-radius:12px;border:1px solid ${BRAND.border};box-shadow:0 10px 28px rgba(0,0,0,.18);overflow:hidden;display:flex;flex-direction:column}
  .wl-modal-head{background:${BRAND.primary};color:#fff;padding:12px 16px;font-weight:750;flex:0 0 auto}
  .wl-modal-body{padding:16px;overflow:auto;flex:1 1 auto}
  .wl-form{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:10px}
  .wl-field{grid-column:span 12}
  .wl-field.half{grid-column:span 6}
  .wl-field label{display:flex;gap:8px;align-items:center;font-weight:600;margin-bottom:6px}
  .wl-field input[type="text"], .wl-field input[type="email"], .wl-field input[type="tel"], .wl-field select, .wl-field textarea{
    width:100%; padding:10px 12px; border:1px solid #ddd; border-radius:8px; background:#fff; font:inherit;
  }
  .wl-modal-actions{grid-column:1 / -1;display:flex;justify-content:flex-end;gap:10px;margin:12px -16px -16px;padding:12px 16px 16px;position:sticky;bottom:-16px;background:#fff;border-top:1px solid #eee;z-index:2}
  .wl-modal-actions .wl-btn{min-width:160px}
  .wl-consent{font-size:.82rem;color:#666;line-height:1.35;background:#fff;border:1px solid #eee;border-radius:8px;padding:10px}
  .wl-lookup-box{background:#fff;border:1px solid #eee;border-radius:10px;padding:10px}
  .wl-lookup-box label{font-weight:700;margin-bottom:6px}
  .wl-lookup-result{margin-top:8px;font-size:.88rem;color:#444}
  .wl-lookup-result.good{color:#27632a}
  .wl-lookup-result.warn{color:#8a5a00}
  .wl-lookup-result.bad{color:#8a1c1c}
  .wl-btn.small{min-width:auto;padding:8px 10px;font-size:.9rem}
  @media (max-width:560px){ .wl-modal{padding:10px} .wl-modal-card{max-height:calc(100vh - 20px)} .wl-form .half{grid-column:span 12} .wl-modal-actions{flex-wrap:wrap} .wl-modal-actions .wl-btn{flex:1 1 100%} }

  /* Switch toggles */
  .wl-switch{display:flex;align-items:center;justify-content:space-between;background:#fff;border:1px solid #ddd;border-radius:10px;padding:10px}
  .wl-switch .info{display:flex;flex-direction:column;gap:4px}
  .wl-switch .title{font-weight:700}
  .wl-switch .hint{font-size:.85rem;color:#666}
  .switch{--w:44px; --h:24px; --dot:18px; position:relative;width:var(--w);height:var(--h);background:#ddd;border-radius:var(--h);transition:.2s;cursor:pointer;border:1px solid #ccc}
  .switch:after{content:"";position:absolute;top:50%;left:3px;transform:translateY(-50%);width:var(--dot);height:var(--dot);border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:.2s}
  input[type="checkbox"].switch-input{display:none}
  input[type="checkbox"].switch-input:checked + .switch{background:${BRAND.primary};border-color:${BRAND.primary}}
  input[type="checkbox"].switch-input:checked + .switch:after{left:calc(100% - var(--dot) - 3px)}
  .wl-inline{display:flex;gap:10px;align-items:center;margin-top:8px;flex-wrap:wrap}
  .wl-autopay-mini{margin-top:10px;border:1px solid #cfe7d6;border-radius:10px;background:#f0faf3;padding:10px;color:#214f2b}
  .wl-autopay-mini strong{display:block;color:#173d20;font-size:.94rem}
  .wl-autopay-mini span{display:block;margin-top:3px;color:#41684a;font-size:.84rem;font-weight:650}
  .wl-autopay-mini a{margin-top:8px}
  `;
  document.head.appendChild(dom(`<style>${styles}</style>`));

  /* -------- init -------- */
  init().catch(()=>{});
  async function init(){
    await waitFor('td.pageContentBody', {timeout:1000});
    await Promise.race([
      waitFor('#ctl00_PageBody_AccountActivity_AccountActivityLeftColumn', {timeout:1000}),
      waitFor('.accountActivity_r', {timeout:1000})
    ]).catch(()=>{});
    await buildUI();
    loadLists();
  }

  async function buildUI(){
    /* scrape */
    const snapshot={}, last={};
    $$('#ctl00_PageBody_AccountActivity_AccountActivityLeftColumn tr').forEach(tr=>{
      const k=txt(tr.querySelector('th')||{}).replace(/:$/,''); const v=txt(tr.querySelector('td')||{});
      if (k) snapshot[k]=v;
    });
    $$('.accountActivity_r tr').forEach(tr=>{
      const k=txt(tr.querySelector('th')||{}).replace(/:$/,''); const d=txt(tr.querySelector('td:nth-child(2)')||{}); const a=txt(tr.querySelector('td:nth-child(3)')||{});
      if(k) last[k]={date:d,amount:a};
    });

    const links={ jobs: $('#JobBalancesButton'), statement: $('#GetInterimStatementLink') };
    const acctName=(txt($('.panel.panelAccountInfo .listPageHeader'))||'').replace(/Account Information for/i,'').trim() || 'Your Account';
    const accountKey = acctName || 'unknown';
    const accountSettingsDetails = await fetchAccountSettingsDetails().catch(() => ({}));
    const accountLoginName = accountSettingsDetails.loginName || '';
    const isAutopayTestAccount = isAutopayAllowedIdentity(
      accountLoginName,
      accountSettingsDetails.email,
      accountSettingsDetails.companyName,
      acctName,
      accountKey,
      document.body?.innerText || ''
    );
    const localAutopay = isAutopayTestAccount ? findLocalAutopay(acctName || accountKey) : null;

    const stmtNetAmt = mNum(last['Last Statement Net Amount']?.amount);
    const stmtDate   = parseUS(last['Last Statement Amount']?.date || last['Last Statement Net Amount']?.date);
    const lastStmtAmtVal = mNum(last['Last Statement Amount']?.amount);
    const hasStatements  = !!(stmtDate || stmtNetAmt>0 || lastStmtAmtVal>0);
    const stmtDue    = next10(stmtDate);
    const payStmtPayload = (()=>({
      total: stmtNetAmt>0 ? stmtNetAmt.toFixed(2) : '',
      notes: stmtDate ? `Statement ${stmtDate.toLocaleDateString()}` : '',
      source: 'AccountInfo',
      action: 'PayStatement',
      back: 'AccountInfo_R.aspx'
    }))();
    const payStmtUrl = (()=>{ const q=new URLSearchParams(); if(payStmtPayload.total) q.set('utm_total', payStmtPayload.total); if(payStmtPayload.notes) q.set('utm_notes', payStmtPayload.notes); q.set('utm_source', payStmtPayload.source); q.set('utm_action', payStmtPayload.action); q.set('utm_back', payStmtPayload.back); return `AccountPayment_r.aspx?${q.toString()}`; })();

    // Cash account (store credit) — shown separately from Net Balance
    const cashCredit = getCashBalanceCredit();
    const cashCreditDisplay = cashCredit > 0 ? fmtMoney(cashCredit) : '—';
    const isCashAccount = !!document.getElementById('ctl00_PageBody_btnLoadCashAccountBalance');
    try { localStorage.setItem('wl_account_is_cash_v1', isCashAccount ? 'true' : 'false'); } catch(e) {}
    const accountTermsLabel = snapshot['Terms'] || snapshot['Payment Terms'] || snapshot['Account Terms'] || snapshot['Customer Terms'] || '';
    const showAutopaySignup = isAutopayTestAccount;
    const autopayUrl = (() => {
      const url = new URL(PAYMENT_METHODS_URL, location.origin);
      url.searchParams.set('wlAutopay', '1');
      url.searchParams.set('wlAutopayAddBank', '1');
      if (isAutopayTestAccount) url.searchParams.set('wlAutopayTest', '1');
      return url.href;
    })();
    const manageAutopayUrl = (() => {
      const url = new URL(PAYMENT_METHODS_URL, location.origin);
      url.searchParams.set('wlAutopay', '1');
      return url.href;
    })();

    function saveAutopayContext(){
      const context = {
        accountId: accountLoginName || accountSettingsDetails.email || accountKey || '',
        loginName: accountLoginName || '',
        autopayAllowedTest: isAutopayTestAccount,
        accountName: acctName || accountKey || '',
        accountKind: isCashAccount ? (isAutopayTestAccount ? 'test' : 'cash') : 'charge',
        termsLabel: accountTermsLabel || '',
        statementBalance: (last['Last Statement Net Amount']?.amount || last['Last Statement Amount']?.amount || snapshot['Net Balance'] || '').trim(),
        lastStatementDate: (last['Last Statement Amount']?.date || last['Last Statement Net Amount']?.date || '').trim(),
        dueDate: stmtDue || '',
        cycle: 'Statements run on the 26th for the 26th-25th cycle and are generally due on the 10th.',
        source: 'AccountInfo_R.aspx',
        capturedAt: new Date().toISOString()
      };
      try {
        localStorage.setItem(AUTOPAY_CONTEXT_KEY, JSON.stringify(context));
        localStorage.setItem(AUTOPAY_PENDING_KEY, JSON.stringify({ startedAt: Date.now(), source: 'AccountInfo_R.aspx' }));
      } catch(e) {}
    }

    const autopaySummaryHtml = localAutopay ? (() => {
      const auth = localAutopay.authorization || {};
      const method = auth.paymentMethod?.label || 'Saved bank account';
      const ending = auth.paymentMethod?.ending ? ` ending ${escapeHtml(auth.paymentMethod.ending)}` : '';
      const day = auth.schedule?.preferredDay ? `${ordinal(auth.schedule.preferredDay)} monthly` : 'Selected date';
      const scheduleText = auth.schedule?.requiresApproval
        ? `Requested ${day} - pending Woodson approval`
        : day;
      const next = auth.nextAutopay?.isoDate && !auth.schedule?.requiresApproval ? `Next estimated AutoPay: ${displayISODate(auth.nextAutopay.isoDate)}` : '';
      return `<div class="wl-autopay-mini">
        <strong>AutoPay on file</strong>
        <span>${escapeHtml(autopayStatusLabel(auth.status))} · ${escapeHtml(method)}${ending} · ${escapeHtml(scheduleText)}</span>
        ${next ? `<span>${escapeHtml(next)}</span>` : ''}
        <a class="wl-btn" href="${escapeAttr(manageAutopayUrl)}">Manage AutoPay</a>
      </div>`;
    })() : '';

    /* mount */
    const container = dom(`
      <div class="wl-acct-root">
        <div class="wl-top">
          <div class="wl-ham">
            <button id="wl-ham-btn" type="button" aria-expanded="false" aria-controls="wl-ham-menu" aria-label="Account menu"><i class="fas fa-bars" aria-hidden="true"></i><span>Menu</span></button>
            <div class="wl-title">Account Overview — ${acctName}</div>
            <div id="wl-ham-menu" class="wl-ham-menu" role="menu"></div>
          </div>
          <div class="wl-actions">
            <a class="wl-btn primary" id="wl-top-pay" href="AccountPayment_r.aspx?utm_source=AccountInfo&utm_action=${isCashAccount ? 'ReloadBalance' : 'MakePayment'}">${isCashAccount ? 'Reload Balance' : 'Make a Payment'}</a>
          </div>
        </div>

        <!-- Row 1 -->
        <div class="wl-row wl-row-3" id="wl-row1">
          <div class="wl-card" id="wl-snapshot">
            <div class="wl-head">Account Snapshot</div>
            <div class="wl-body">
              <div class="wl-kpis">
                <div class="wl-kpi"><div class="lbl">Account Balance</div><div class="val">${snapshot['Net Balance'] ?? '—'}</div></div>
                <div class="wl-kpi"><div class="lbl">Store Credit</div><div class="val">${cashCreditDisplay}</div></div>
                <div class="wl-kpi"><div class="lbl">On Order</div><div class="val">${snapshot['On Order'] ?? '—'}</div></div>
              </div>
              ${cashCredit > 0 ? `<div class="wl-meta" style="margin-top:8px">Store Credit works like a gift card balance.</div>` : ''}
              <div class="wl-actions" style="margin-top:8px">
                <a class="wl-btn" href="${href(links.jobs)||'JobBalances_R.aspx'}">Job Balances</a>
              </div>
            </div>
          </div>

          <div class="wl-card" id="wl-settings">
            <div class="wl-head">Account Settings</div>
            <div class="wl-body">
              <div class="wl-actions" style="margin-bottom:6px">
                <a class="wl-btn" href="AccountSettings.aspx">Edit Account Settings</a>
                <a class="wl-btn" href="${PAYMENT_METHODS_URL}">Payment Methods</a>
                ${showAutopaySignup ? `<a class="wl-btn primary" data-wl-autopay-start href="${escapeAttr(autopayUrl)}">Set Up AutoPay</a>` : ''}
                <a class="wl-btn" href="AddressList_R.aspx">Addresses</a>
                <a class="wl-btn" href="Contacts_r.aspx">Contacts</a>
                <a class="wl-btn" href="https://woodsonwholesaleinc.formstack.com/forms/agtimber2027" target="_blank" rel="noopener">Apply for Tax Exemption</a>
                <a class="wl-btn" id="wl-comm-open" href="#">Edit Communication Preferences</a>
                <a class="wl-btn" id="wl-req-open" href="#">Request Account Changes</a>
              </div>
              <div class="wl-meta">Manage profile, payment methods, addresses, contacts, and preferences.</div>
            </div>
          </div>

          <div class="wl-card" id="wl-statements">
            <div class="wl-head">Statements</div>
            <div class="wl-body">
              <div class="wl-meta">Last Statement Date: <strong>${last['Last Statement Amount']?.date || '—'}</strong></div>
              <div class="wl-meta">Last Statement Amount: <strong>${last['Last Statement Amount']?.amount || '—'}</strong></div>
              <div class="wl-meta">Net Amount: <strong>${last['Last Statement Net Amount']?.amount || '—'}</strong></div>
              <div class="wl-meta">Finance Charges: <strong>${last['Last Statement Finance Charges']?.amount || '—'}</strong></div>
              <div class="wl-meta">Due Date: <strong>${stmtDue}</strong></div>
              ${autopaySummaryHtml}
              <div class="wl-actions" style="margin-top:8px">
                <a class="wl-btn primary" id="wl-pay-statement" href="${payStmtUrl}">Pay This Statement</a>
                ${showAutopaySignup ? `<a class="wl-btn" data-wl-autopay-start href="${escapeAttr(autopayUrl)}">Set Up AutoPay</a>` : ''}
                <a class="wl-btn" href="${href(links.statement)}" target="_blank" rel="noopener">Generate Interim Statement</a>
                <a class="wl-btn" href="Statements_R.aspx">View All</a>
              </div>
            </div>
          </div>
        </div>

        <!-- Row 2 -->
        <div class="wl-row wl-row-2" id="wl-row2">
          <div class="wl-card wl-detail-section" id="wl-activity">
            <div class="wl-head"><span>Recent Activity</span><span class="wl-head-note">Invoices and credits</span></div>
            <div class="wl-body">
              <ul class="wl-list wl-entry-list" data-empty="Loading recent activity..."></ul>
              <div class="wl-actions" style="margin-top:8px">
                <a class="wl-btn" id="wl-invoices-btn" href="Invoices_r.aspx">View Invoices</a>
                <a class="wl-btn" id="wl-credits-btn" href="CreditNotes_r.aspx">View Credits</a>
              </div>
            </div>
          </div>

          <div class="wl-card wl-detail-section" id="wl-orders">
            <div class="wl-head"><span>Open Orders</span><span class="wl-head-note">Orders still in progress</span></div>
            <div class="wl-body">
              <ul class="wl-list wl-entry-list" data-empty="Loading open orders..."></ul>
              <div class="wl-actions" style="margin-top:8px">
                <a class="wl-btn" href="OpenOrders_r.aspx">View All Orders</a>
              </div>
            </div>
          </div>
        </div>

        <!-- Cart Snapshot (placed top if no statements, else below row2) -->
        <div class="wl-row wl-row-1" id="wl-row-cart" style="display:none"></div>

        <!-- Row 3 -->
        <div class="wl-row wl-row-1" id="wl-row3">
          <div class="wl-card wl-detail-section" id="wl-purchases">
            <div class="wl-head"><span>Recent Purchases</span><span class="wl-head-note">Products you may need again</span></div>
            <div class="wl-body">
              <ul class="wl-list wl-purchase-grid" data-empty="Loading recent purchases..."></ul>
              <div class="wl-actions" style="margin-top:8px">
                <a class="wl-btn" href="ProductsPurchased_R.aspx">View More Purchased Products</a>
              </div>
            </div>
          </div>
        </div>

        <!-- Communication Preferences Modal -->
        <div class="wl-modal" id="wl-comm-modal" aria-hidden="true">
          <div class="wl-modal-card" role="dialog" aria-modal="true" aria-labelledby="wl-comm-title">
            <div class="wl-modal-head" id="wl-comm-title">Communication Preferences</div>
            <div class="wl-modal-body">
              <form id="wl-comm-form" class="wl-form" novalidate>
                <div class="wl-field half"><label><input type="checkbox" id="comm_email_mkt"> Email marketing</label></div>
                <div class="wl-field half"><label><input type="checkbox" id="comm_email_billing"> Email invoices & statements</label></div>
                <div class="wl-field half"><label><input type="checkbox" id="comm_email_delivery"> Email delivery updates</label></div>
                <div class="wl-field half"><label><input type="checkbox" id="comm_sms_mkt"> SMS marketing</label></div>

                <div class="wl-field half"><label for="comm_first_name">First name</label><input type="text" id="comm_first_name" autocomplete="given-name"></div>
                <div class="wl-field half"><label for="comm_last_name">Last name</label><input type="text" id="comm_last_name" autocomplete="family-name"></div>
                <div class="wl-field half"><label for="comm_email">Primary email address</label><input type="email" id="comm_email" placeholder="name@example.com" autocomplete="email"></div>
                <div class="wl-field half"><label for="comm_phone">Primary phone</label><input type="tel" id="comm_phone" placeholder="(###) ###-####" autocomplete="tel"></div>
                <div class="wl-field half"><label for="comm_company">Company / account name</label><input type="text" id="comm_company" autocomplete="organization"></div>
                <div class="wl-field half"><label for="comm_sms_phone">SMS phone</label><input type="tel" id="comm_sms_phone" placeholder="(###) ###-####"></div>

                <div class="wl-field">
                  <div class="wl-lookup-box">
                    <label for="comm_linked_email_select">Emails linked to this account</label>
                    <div class="wl-inline">
                      <select id="comm_linked_email_select" style="min-width:min(360px,100%);flex:1 1 300px">
                        <option value="">Loading linked emails…</option>
                      </select>
                      <button type="button" class="wl-btn small" id="wl-comm-refresh-linked-btn">Refresh</button>
                    </div>
                    <div class="wl-lookup-result" id="wl-comm-linked-result">Choose an email to view or update its preferences.</div>
                  </div>
                </div>

                <div class="wl-field">
                  <div class="wl-lookup-box">
                    <label for="comm_lookup_email">Link another email to this account</label>
                    <div class="wl-inline">
                      <input type="email" id="comm_lookup_email" placeholder="alternate@example.com" style="min-width:min(320px,100%);flex:1 1 260px">
                      <button type="button" class="wl-btn small" id="wl-comm-lookup-btn">Look Up</button>
                      <button type="button" class="wl-btn small" id="wl-comm-use-lookup-btn" style="display:none">Link Email to Account</button>
                    </div>
                    <div class="wl-lookup-result" id="wl-comm-lookup-result">Have another email you use with this account? Look it up and link it here so you can manage preferences for that email too.</div>
                  </div>
                </div>

                <div class="wl-field"><div class="wl-consent">By choosing SMS marketing, you agree to receive marketing text messages from Woodson Lumber at the phone number listed above. Message and data rates may apply. Reply STOP to opt out.</div></div>
                <div class="wl-field"><div class="wl-meta">Select an email above to manage preferences for that contact. Marketing email status is checked from our email system. Invoice, statement, delivery update, and text preferences are saved for the selected email.</div></div>
                <div class="wl-modal-actions">
                  <button type="button" class="wl-btn" id="wl-comm-cancel">Cancel</button>
                  <button type="submit" class="wl-btn primary">Save Preferences</button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <!-- Account Changes (toggle) Modal -->
        <div class="wl-modal" id="wl-req-modal" aria-hidden="true">
          <div class="wl-modal-card" role="dialog" aria-modal="true" aria-labelledby="wl-req-title">
            <div class="wl-modal-head" id="wl-req-title">Request Account Changes</div>
            <div class="wl-modal-body">
              <form id="wl-req-form" class="wl-form" novalidate>
                <div class="wl-field">
                  <div class="wl-switch">
                    <div class="info"><div class="title">Add PO to all future orders</div><div class="hint">Set a default PO value we’ll attach to new orders.</div></div>
                    <input class="switch-input" type="checkbox" id="req_po_toggle"><label class="switch" for="req_po_toggle"></label>
                  </div>
                  <div class="wl-inline" id="req_po_wrap" style="display:none"><input type="text" id="req_po_value" placeholder="Default PO value (e.g., JOB-1234)"></div>
                </div>

                <div class="wl-field">
                  <div class="wl-switch">
                    <div class="info"><div class="title">Select a default contact for future orders</div><div class="hint">We’ll route confirmations and updates to this contact.</div></div>
                    <input class="switch-input" type="checkbox" id="req_contact_toggle"><label class="switch" for="req_contact_toggle"></label>
                  </div>
                  <div class="wl-inline" id="req_contact_wrap" style="display:none">
                    <input type="text" id="req_contact_name" placeholder="Contact name">
                    <input type="text" id="req_contact_email" placeholder="Email (optional)">
                    <input type="text" id="req_contact_phone" placeholder="Phone (optional)">
                  </div>
                </div>

                <div class="wl-field">
                  <div class="wl-switch">
                    <div class="info"><div class="title">Enable email delivery updates</div><div class="hint">We’ll email delivery ETAs and status updates for new orders.</div></div>
                    <input class="switch-input" type="checkbox" id="req_delivery_toggle"><label class="switch" for="req_delivery_toggle"></label>
                  </div>
                  <div class="wl-inline" id="req_delivery_wrap" style="display:none"><input type="email" id="req_delivery_email" placeholder="Destination email for delivery updates"></div>
                </div>

                <div class="wl-field">
                  <div class="wl-switch">
                    <div class="info"><div class="title">Other account change</div><div class="hint">Tell us what you need and we’ll follow up.</div></div>
                    <input class="switch-input" type="checkbox" id="req_other_toggle"><label class="switch" for="req_other_toggle"></label>
                  </div>
                  <div class="wl-field" id="req_other_wrap" style="display:none"><textarea id="req_other_text" rows="3" placeholder="Describe your request…"></textarea></div>
                </div>

                <div class="wl-modal-actions">
                  <button type="button" class="wl-btn" id="wl-req-cancel">Cancel</button>
                  <button type="submit" class="wl-btn primary">Submit Requests</button>
                </div>
              </form>
            </div>
          </div>
        </div>

      </div>
    `);

    const pageBody = $('td.pageContentBody') || document.body;
    pageBody.insertBefore(container, pageBody.firstChild);

     // Mount Cash Account reload button if applicable
const snapshotActions = container.querySelector('#wl-snapshot .wl-actions');
if (snapshotActions) {
  mountCashAccountReload(snapshotActions);
}


    /* Cart shell (we’ll fill it after fetch) */
    const cartCard = dom(`
      <div class="wl-card" id="wl-cart" style="display:none">
        <div class="wl-head">Cart Snapshot</div>
        <div class="wl-body">
          <ul class="wl-list wl-cart-list"></ul>
          <div class="wl-actions" style="margin-top:8px">
            <a class="wl-btn primary" id="wl-cart-cta" href="ShoppingCart.aspx">Go to Cart</a>
          </div>
        </div>
      </div>
    `);

    const row1 = $('#wl-row1', container);
    const rowCart = $('#wl-row-cart', container);
    const stmtCard = $('#wl-statements', container);
    const topPay   = $('#wl-top-pay', container);

    if (hasStatements) {
      rowCart.style.display = '';            // own row below row2
      rowCart.appendChild(cartCard);
    } else {
      if (stmtCard) stmtCard.style.display = 'none';
      if (topPay && !isCashAccount) topPay.style.display = 'none';
      row1.appendChild(cartCard);            // take Statement’s place up top
    }

    /* hide legacy blocks */
    const leftNav = $('#ctl00_LeftSidebarContents_MainNav_NavigationMenu');
    if (leftNav) leftNav.classList.add('wl-hide');
    ['.account-aging-title','#ctl00_PageBody_AgingTable_AgingGrid','.documentRequest','#WTAccountActivity','.panel.panelAccountInfo']
      .forEach(sel=> $$(sel).forEach(el=> el.classList.add('wl-hide')));

    /* menu */
    (function menu(){
      const btn = $('#wl-ham-btn', container);
      const menu = $('#wl-ham-menu', container);
      const currentPath = (window.location.pathname || '').split('/').pop().toLowerCase();

      const paymentHref = 'AccountPayment_r.aspx';
      const paymentLabel = isCashAccount ? 'Reload Balance' : 'Make a Payment';

      let accountSettingLinks = [
        ['Quicklists_R.aspx', 'Shopping Lists']
      ];

      if (!isCashAccount) {
        accountSettingLinks.push(['Statements_R.aspx', 'Statements']);
      }

      accountSettingLinks = accountSettingLinks.concat([
        [PAYMENT_METHODS_URL, 'Payment Methods'],
        ['AccountSettings.aspx', 'Change Password / Account Settings'],
        ['AddressList_R.aspx', 'Addresses'],
        ['Contacts_r.aspx', 'Contacts']
      ]);

      const groups = [
        {
          label: '',
          links: [
            ['AccountInfo_R.aspx', 'Account Dashboard']
          ]
        },
        {
          label: 'Transactions',
          links: [
            [paymentHref, paymentLabel],
            ['OpenQuotes_r.aspx', 'Quotes'],
            ['OpenOrders_r.aspx', 'Orders'],
            ['Invoices_r.aspx', 'Invoices'],
            ['CreditNotes_r.aspx', 'Credit Notes'],
            ['ProductsPurchased_R.aspx', 'Products Purchased'],
            ['ShoppingCart.aspx', 'Shopping Cart']
          ]
        },
        {
          label: 'Account Settings',
          links: accountSettingLinks
        }
      ];

      menu.innerHTML = groups.map(group => {
        const links = group.links.map(([href, label]) => {
          const path = String(href || '').split('?')[0].split('#')[0].split('/').pop().toLowerCase();
          const current = path === currentPath ? ' aria-current="page"' : '';
          return `<a role="menuitem" href="${escapeAttr(href)}"${current}>${escapeHtml(label)}</a>`;
        }).join('');

        return `<div class="wl-ham-menu-section">
          ${group.label ? `<div class="wl-ham-menu-label">${escapeHtml(group.label)}</div>` : ''}
          ${links}
        </div>`;
      }).join('');

      const toggle=(open)=>{ menu.classList.toggle('open', open); btn.setAttribute('aria-expanded', open?'true':'false'); };
      btn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); toggle(!menu.classList.contains('open')); return false; });
      document.addEventListener('click', (e)=>{ if(!menu.classList.contains('open')) return; if(!menu.contains(e.target) && e.target!==btn){ toggle(false); } });
      btn.setAttribute('onclick','return false;');
    })();

    /* payment handoff */
    (function paymentHandoff(){
      const PREF_KEY = 'wl_ap_prefill_v3';
      const payStmtBtn = $('#wl-pay-statement', container);
      const topPayBtn  = $('#wl-top-pay', container);

      function savePref(payload){
        try{ sessionStorage.setItem(PREF_KEY, JSON.stringify(payload||{})); }catch(e){}
      }

      if (payStmtBtn && !payStmtBtn.__wlBound){
        payStmtBtn.__wlBound = true;
        payStmtBtn.addEventListener('click', ()=>{
          savePref({
            docs:'',
            total: payStmtPayload.total || '',
            jobs:'',
            remit:'',
            notes: payStmtPayload.notes || '',
            back: payStmtPayload.back || 'AccountInfo_R.aspx',
            clear:false,
            source: payStmtPayload.source || 'AccountInfo',
            action: payStmtPayload.action || 'PayStatement'
          });
        });
      }

      if (topPayBtn && !topPayBtn.__wlBound){
        topPayBtn.__wlBound = true;
        topPayBtn.addEventListener('click', ()=>{
          savePref({
            docs:'',
            total:'',
            jobs:'',
            remit:'',
            notes:'',
            back:'AccountInfo_R.aspx',
            clear:false,
            source:'AccountInfo',
            action:'MakePayment'
          });
        });
      }

      $$('[data-wl-autopay-start]', container).forEach(btn => {
        if (btn.__wlAutopayBound) return;
        btn.__wlAutopayBound = true;
        btn.addEventListener('click', saveAutopayContext);
      });
    })();

    /* Normalize account/payment links copied from legacy navigation */
    (function normalizePaymentLinks(){
      $$('a', container).forEach(a=>{
        const label = (a.textContent || '').trim();
        const url = a.getAttribute('href') || '';
        if (/CustomerCards\.aspx/i.test(url) || /customer\s*cards/i.test(label) || /stored\s*cards/i.test(label)) {
          a.setAttribute('href', PAYMENT_METHODS_URL);
          a.textContent = 'Payment Methods';
        }
        if (/Apply\s+Tax\s+Exemption/i.test(label)) {
          a.textContent = 'Apply for Tax Exemption';
        }
      });
    })();

    /* COMM PREFS storage */
    const COMM_KEY = (k)=> `wl_comm_prefs_v3_${k}`;
    function getLocalPrefs(){ try { return JSON.parse(localStorage.getItem(COMM_KEY(accountKey))||'{}'); } catch { return {}; } }
    function setLocalPrefs(v){ try { localStorage.setItem(COMM_KEY(accountKey), JSON.stringify(v)); } catch {} }

    function getInputValueByLabel(doc, labelPattern){
      const labels = Array.from(doc.querySelectorAll('label'));
      for (const label of labels) {
        const labelText = (label.textContent || '').replace(/:\s*$/,'').trim();
        if (!labelPattern.test(labelText)) continue;
        let input = null;
        const forId = label.getAttribute('for');
        if (forId) input = doc.getElementById(forId);
        if (!input) input = label.closest('div, .epi-form-group-acctSettings, .form-group')?.querySelector('input, select, textarea');
        if (input) return ((input.value || input.getAttribute('value') || input.textContent || '') + '').trim();
      }
      return '';
    }

    function splitName(fullName){
      const cleaned = String(fullName || '').replace(/\([^)]*\)/g,'').replace(/Account Information for/i,'').trim();
      if (!cleaned) return { firstName:'', lastName:'' };
      const parts = cleaned.split(/\s+/).filter(Boolean);
      if (parts.length === 1) return { firstName:parts[0], lastName:'' };
      return { firstName:parts.slice(0,-1).join(' '), lastName:parts.slice(-1)[0] };
    }

    async function fetchAccountSettingsDetails(){
      if (accountSettingsDetailsPromise) return accountSettingsDetailsPromise;
      accountSettingsDetailsPromise = (async()=>{
        const details = {
          email:'',
          firstName:'',
          lastName:'',
          companyName: accountKey || '',
          phone:'',
          jobTitle:''
        };
        try {
          const r = await fetch(ACCOUNT_SETTINGS_URL, { credentials:'same-origin' });
          if (!r.ok) return details;
          const html = await r.text();
          const doc = new DOMParser().parseFromString(html, 'text/html');

          const emailInput = doc.querySelector(ACCOUNT_SETTINGS_EMAIL_SELECTOR);
          const email = ((emailInput && (emailInput.value || emailInput.getAttribute('value'))) || getInputValueByLabel(doc, /email\s*address|email/i)).trim();
          if (emailOK(email)) details.email = email;
          details.loginName = getInputValueByLabel(doc, /login\s*name|user\s*name|username|login/i);

          details.firstName = getInputValueByLabel(doc, /first\s*name|given\s*name/i);
          details.lastName  = getInputValueByLabel(doc, /last\s*name|surname|family\s*name/i);
          details.phone     = digits(getInputValueByLabel(doc, /phone|mobile|telephone/i));
          details.jobTitle  = getInputValueByLabel(doc, /job\s*title|title/i);

          const company = getInputValueByLabel(doc, /company|business|organization|account\s*name/i);
          if (company) details.companyName = company;

          if (!details.firstName && !details.lastName) {
            const parsed = splitName(acctName || accountKey || '');
            details.firstName = parsed.firstName;
            details.lastName = parsed.lastName;
          }
        } catch(err) {
          // DEBUG ONLY: console.warn('Could not read account details from AccountSettings.aspx:', err);
        }
        return details;
      })();
      return accountSettingsDetailsPromise;
    }

    async function fetchAccountSettingsEmail(){
      if (accountSettingsEmailPromise) return accountSettingsEmailPromise;
      accountSettingsEmailPromise = fetchAccountSettingsDetails().then(d => d.email || '');
      return accountSettingsEmailPromise;
    }

    function jsonpRequest(url, params={}, timeout=8000){
      return new Promise((resolve, reject)=>{
        if (!url) return resolve(null);
        const cbName = `wlCommPrefs_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const script = document.createElement('script');
        const timer = setTimeout(()=>{
          cleanup();
          reject(new Error('Preference lookup timed out.'));
        }, timeout);
        function cleanup(){
          clearTimeout(timer);
          try { delete window[cbName]; } catch { window[cbName] = undefined; }
          script.remove();
        }
        window[cbName] = (data)=>{
          cleanup();
          resolve(data || null);
        };
        try {
          const u = new URL(url);
          Object.entries(params || {}).forEach(([k,v])=>{
            if (v !== undefined && v !== null && String(v).trim() !== '') u.searchParams.set(k, v);
          });
          u.searchParams.set('callback', cbName);
          script.onerror = ()=>{ cleanup(); reject(new Error('Preference lookup failed.')); };
          script.src = u.toString();
          document.head.appendChild(script);
        } catch(err){
          cleanup();
          reject(err);
        }
      });
    }

    async function fetchRemotePrefs(seedEmail=''){
      const accountSettingsEmail = await fetchAccountSettingsEmail();
      // Important: when the user selects a linked email, that selected email must win.
      // The previous version prioritized the AccountSettings email and kept reloading
      // the primary account email, which made linked-email checkbox edits look like
      // they were being undone.
      const email = (seedEmail || accountSettingsEmail || '').trim();

      // This is the source of truth for the popup. It asks Apps Script to query
      // Constant Contact by the AccountSettings email and return current list status.
      if (COMM_PREFS_GET && emailOK(email)) {
        try {
          const data = await jsonpRequest(COMM_PREFS_GET, { accountKey, email });
          if (data && data.ok) return data.preferences || data;
        } catch(err) {
          // DEBUG ONLY: console.warn('Communication preference lookup failed:', err);
        }
      }

      // Optional legacy fallback only. Do not use localStorage as the source of truth.
      if (!SHEET_API_GET) return email ? { email } : null;
      try{
        const u=new URL(SHEET_API_GET);
        u.searchParams.set('accountKey',accountKey);
        if (email) u.searchParams.set('email',email);
        const r=await fetch(u.toString(),{credentials:'omit'});
        if(!r.ok) return email ? { email } : null;
        const v = await r.json();
        return Object.assign({}, email ? { email } : {}, v || {});
      }catch{ return email ? { email } : null; }
    }

    async function postRemotePrefs(v){ if (!SHEET_API_POST) return false; try{ const r=await fetch(SHEET_API_POST,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(v)}); return r.ok; }catch{ return false; } }

    async function postCommunicationPrefs(v){
      if (COMM_PREFS_POST) {
        try {
          // Apps Script web apps usually cannot be read cross-domain by fetch because of CORS.
          // Use a simple no-CORS text/plain POST so the submission reaches doPost reliably.
          await fetch(COMM_PREFS_POST, {
            method:'POST',
            mode:'no-cors',
            headers:{'Content-Type':'text/plain;charset=utf-8'},
            credentials:'omit',
            body:JSON.stringify({ ...v, source: v.source || 'WebTrack AccountInfo' })
          });
          return true;
        } catch(err) {
          // DEBUG ONLY: console.warn('Communication preference submit failed:', err);
          return false;
        }
      }
      return postRemotePrefs(v);
    }

    (function commModal(){
      const openBtn = $('#wl-comm-open', container);
      const modal   = $('#wl-comm-modal');
      const form    = $('#wl-comm-form');
      const cancel  = $('#wl-comm-cancel');
      const f = {
        email_mkt: $('#comm_email_mkt', modal),
        email_billing: $('#comm_email_billing', modal),
        email_delivery: $('#comm_email_delivery', modal),
        email: $('#comm_email', modal),
        first_name: $('#comm_first_name', modal),
        last_name: $('#comm_last_name', modal),
        company: $('#comm_company', modal),
        phone: $('#comm_phone', modal),
        sms_mkt: $('#comm_sms_mkt', modal),
        sms_phone: $('#comm_sms_phone', modal),
        linked_select: $('#comm_linked_email_select', modal),
        linked_result: $('#wl-comm-linked-result', modal),
        refresh_linked_btn: $('#wl-comm-refresh-linked-btn', modal),
        lookup_email: $('#comm_lookup_email', modal),
        lookup_btn: $('#wl-comm-lookup-btn', modal),
        use_lookup_btn: $('#wl-comm-use-lookup-btn', modal),
        lookup_result: $('#wl-comm-lookup-result', modal)
      };

      function resetPrefs(){
        f.email_mkt.checked=false;
        f.email_billing.checked=false;
        f.email_delivery.checked=false;
        f.email.value='';
        f.first_name.value='';
        f.last_name.value='';
        f.company.value='';
        f.phone.value='';
        f.sms_mkt.checked=false;
        f.sms_phone.value='';
        f.lookup_email.value='';
        if (f.linked_select) f.linked_select.innerHTML = '<option value="">Loading linked emails…</option>';
        setLinkedMessage('Choose an email to view or update its preferences.','');
        setLookupMessage('Have another email you use with this account? Look it up and link it here so you can manage preferences for that email too.','');
        f.use_lookup_btn.style.display='none';
      }

      function setLookupMessage(message, tone){
        if (!f.lookup_result) return;
        f.lookup_result.textContent = message || '';
        f.lookup_result.className = `wl-lookup-result${tone ? ' ' + tone : ''}`;
      }

      function setLinkedMessage(message, tone){
        if (!f.linked_result) return;
        f.linked_result.textContent = message || '';
        f.linked_result.className = `wl-lookup-result${tone ? ' ' + tone : ''}`;
      }

      function applyAccountDetails(d){
        if (!d) return;
        if (d.email && !f.email.value) f.email.value = d.email;
        if (d.firstName && !f.first_name.value) f.first_name.value = d.firstName;
        if (d.lastName && !f.last_name.value) f.last_name.value = d.lastName;
        if (d.companyName && !f.company.value) f.company.value = d.companyName;
        if (d.phone && !f.phone.value) f.phone.value = d.phone;
        if (d.phone && !f.sms_phone.value) f.sms_phone.value = d.phone;
      }

      function applyPrefs(v){
        if (!v) return;
        f.email_mkt.checked=!!v.emailMarketing;
        f.email_billing.checked=!!v.emailBilling;
        f.email_delivery.checked=!!v.emailDelivery;
        if(v.email) f.email.value=v.email;
        if(v.firstName) f.first_name.value=v.firstName;
        if(v.lastName) f.last_name.value=v.lastName;
        if(v.companyName) f.company.value=v.companyName;
        if(v.phone) f.phone.value=digits(v.phone);
        f.sms_mkt.checked=!!v.smsMarketing;
        if(v.smsPhone) f.sms_phone.value=digits(v.smsPhone);
      }

      async function loadLinkedEmails(selectedEmail=''){
        const selected = (selectedEmail || f.email.value || '').trim().toLowerCase();
        if (!f.linked_select) return [];

        try {
          f.linked_select.innerHTML = '<option value="">Loading linked emails…</option>';
          const data = await jsonpRequest(COMM_PREFS_ACCOUNT_EMAILS, { accountKey, email: selected });
          const emails = Array.isArray(data && data.emails) ? data.emails : [];
          const seen = new Set();
          const options = [];

          emails.forEach(item=>{
            const email = String(item.email || '').trim().toLowerCase();
            if (!email || seen.has(email)) return;
            seen.add(email);
            const name = [item.firstName, item.lastName].filter(Boolean).join(' ').trim();
            const status = item.isEmailListMember === true ? ' • marketing on' : item.isEmailListMember === false ? ' • marketing off' : '';
            options.push({ email, label: `${email}${name ? ' — ' + name : ''}${status}` });
          });

          if (selected && !seen.has(selected)) options.unshift({ email: selected, label: selected + ' — current account email' });

          if (!options.length) {
            f.linked_select.innerHTML = '<option value="">No additional emails found</option>';
            setLinkedMessage('No additional emails are linked to this account yet. The primary account email will be used by default.','warn');
            return [];
          }

          f.linked_select.innerHTML = options.map(opt => `<option value="${escapeAttr(opt.email)}">${escapeHtml(opt.label)}</option>`).join('');
          if (selected && options.some(opt => opt.email === selected)) f.linked_select.value = selected;
          setLinkedMessage(`${options.length} email${options.length === 1 ? '' : 's'} linked to this account. Select an email to update its preferences.`, 'good');
          return options;
        } catch(err) {
          // DEBUG ONLY: console.warn('Linked email lookup failed:', err);
          f.linked_select.innerHTML = selected ? `<option value="${escapeAttr(selected)}">${escapeHtml(selected)}</option>` : '<option value="">Unable to load emails</option>';
          setLinkedMessage('We could not load additional linked emails right now. You can still save preferences for the email shown.', 'bad');
          return [];
        }
      }

      async function linkEmailToAccount(email){
        email = String(email || '').trim().toLowerCase();
        if (!emailOK(email)) {
          setLookupMessage('Enter a valid email address to link it to this account.','bad');
          return false;
        }

        const payload = {
          accountKey,
          email,
          firstName: ($('#comm_first_name').value||'').trim(),
          lastName: ($('#comm_last_name').value||'').trim(),
          companyName: ($('#comm_company').value||'').trim() || accountKey,
          phone: digits($('#comm_phone').value||''),
          source: 'AccountInfo_R.aspx link email',
          updatedAt: new Date().toISOString()
        };

        try {
          await fetch(COMM_PREFS_LINK, {
            method:'POST',
            mode:'no-cors',
            headers:{'Content-Type':'text/plain;charset=utf-8'},
            credentials:'omit',
            body:JSON.stringify(payload)
          });
          setLookupMessage(`${email} has been linked to this account. You can now select it above and manage its preferences.`, 'good');
          f.email.value = email;
          await loadLinkedEmails(email);
          const remote = await fetchRemotePrefs(email);
          applyPrefs(remote || { email, companyName: payload.companyName });
          return true;
        } catch(err) {
          // DEBUG ONLY: console.warn('Email link failed:', err);
          setLookupMessage('That email could not be linked right now. Please try again in a moment.','bad');
          return false;
        }
      }

      async function hydrate(seedEmail=''){
        resetPrefs();
        const accountDetails = await fetchAccountSettingsDetails();
        applyAccountDetails(accountDetails);
        const startingEmail = seedEmail || accountDetails.email || f.email.value;
        await loadLinkedEmails(startingEmail);
        const remote = await fetchRemotePrefs(startingEmail);
        applyPrefs(remote || accountDetails || null);
      }

      async function lookupEmail(email){
        email = (email || '').trim();
        if (!emailOK(email)) {
          setLookupMessage('Enter a valid email address to look it up.','bad');
          f.use_lookup_btn.style.display='none';
          return null;
        }
        setLookupMessage('Checking email preferences…','');
        try {
          const data = await jsonpRequest(COMM_PREFS_GET.replace('action=getPreferences','action=debugContact'), { email });
          if (!data || !data.ok) {
            setLookupMessage((data && data.error) || 'Could not check that email.','bad');
            f.use_lookup_btn.style.display='none';
            return null;
          }
          if (data.found) {
            const member = data.isEmailListMember ? 'is on the selected marketing list' : 'exists, but is not on the selected marketing list';
            setLookupMessage(`${email} ${member}. Click “Link Email to Account” to connect it to this account.`, data.isEmailListMember ? 'good' : 'warn');
          } else {
            setLookupMessage(`We did not find ${email} in our email preferences yet. Click “Link Email to Account” to add it to this account. It will not be signed up for marketing unless Email marketing is selected and saved.`, 'warn');
          }
          f.use_lookup_btn.style.display='';
          return data;
        } catch(err) {
          // DEBUG ONLY: console.warn('Additional email lookup failed:', err);
          setLookupMessage('Email lookup failed. Check Apps Script execution logs if this keeps happening.','bad');
          f.use_lookup_btn.style.display='none';
          return null;
        }
      }

      openBtn.addEventListener('click', (e)=>{ e.preventDefault(); openModal('#wl-comm-modal'); hydrate(); });

      f.email.addEventListener('blur', async ()=>{
        const email = (f.email.value || '').trim();
        if (!emailOK(email)) return;
        const remote = await fetchRemotePrefs(email);
        applyPrefs(remote || { email });
      });

      f.lookup_btn.addEventListener('click', async ()=>{ await lookupEmail(f.lookup_email.value); });
      f.lookup_email.addEventListener('keydown', async (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); await lookupEmail(f.lookup_email.value); } });
      f.use_lookup_btn.addEventListener('click', async ()=>{
        await linkEmailToAccount(f.lookup_email.value);
      });

      if (f.refresh_linked_btn) {
        f.refresh_linked_btn.addEventListener('click', async ()=>{ await loadLinkedEmails(f.email.value); });
      }

      if (f.linked_select) {
        f.linked_select.addEventListener('change', async ()=>{
          const email = (f.linked_select.value || '').trim();
          if (!emailOK(email)) return;
          f.email.value = email;
          const remote = await fetchRemotePrefs(email);
          applyPrefs(remote || { email });
        });
      }

      cancel.addEventListener('click', ()=> closeModal('#wl-comm-modal'));
      // Intentionally do not close this modal from backdrop clicks.
      // Users should close it only with Cancel or Save so preference edits are not lost accidentally.
      form.addEventListener('submit', async (e)=>{
        e.preventDefault();
        const wantsEmail = $('#comm_email_mkt').checked || $('#comm_email_billing').checked || $('#comm_email_delivery').checked;
        const wantsSMS   = $('#comm_sms_mkt').checked;
        if (wantsEmail && !emailOK($('#comm_email').value)) { alert('Please enter a valid email address.'); $('#comm_email').focus(); return; }
        const mainPhone = digits($('#comm_phone').value || '');
        let smsPhone = digits($('#comm_sms_phone').value || '') || mainPhone;
        if (wantsSMS) { if (smsPhone.length<7) { alert('Please enter a valid phone number for SMS.'); $('#comm_sms_phone').focus(); return; } $('#comm_sms_phone').value=smsPhone; }
        const payload = {
          accountKey,
          source: 'AccountInfo_R.aspx',
          email: ($('#comm_email').value||'').trim(),
          firstName: ($('#comm_first_name').value||'').trim(),
          lastName: ($('#comm_last_name').value||'').trim(),
          companyName: ($('#comm_company').value||'').trim() || accountKey,
          phone: mainPhone,
          emailMarketing: $('#comm_email_mkt').checked,
          emailBilling: $('#comm_email_billing').checked,
          emailDelivery: $('#comm_email_delivery').checked,
          smsMarketing: $('#comm_sms_mkt').checked,
          smsPhone: smsPhone,
          constantContact: {
            emailListIntent: $('#comm_email_mkt').checked ? 'subscribe' : 'unsubscribe',
            smsListIntent: $('#comm_sms_mkt').checked ? 'subscribe' : 'unsubscribe_or_no_change',
            preferenceCustomFieldsReady: true
          },
          updatedAt: new Date().toISOString()
        };
        // Keep a local copy only as a convenience/audit fallback; opening the modal always
        // re-checks AccountSettings + Constant Contact instead of relying on localStorage.
        setLocalPrefs(payload);
        const remoteSaved = await postCommunicationPrefs(payload);
        closeModal('#wl-comm-modal');
        alert(remoteSaved ? 'Your communication preferences have been saved for the selected email.' : 'Your communication preferences have been saved on this device.');
      });
    })();

    /* REQUEST CHANGES */
    function openModal(id){ const m=$(id); if(!m) return; m.classList.add('open'); m.setAttribute('aria-hidden','false'); }
    function closeModal(id){ const m=$(id); if(!m) return; m.classList.remove('open'); m.setAttribute('aria-hidden','true'); }
    (function requestModal(){
      const openBtn = $('#wl-req-open', container);
      const modal   = $('#wl-req-modal');
      const form    = $('#wl-req-form');
      const cancel  = $('#wl-req-cancel');

      const toggles = {
        po: $('#req_po_toggle', modal),
        contact: $('#req_contact_toggle', modal),
        delivery: $('#req_delivery_toggle', modal),
        other: $('#req_other_toggle', modal)
      };
      const wraps = {
        po: $('#req_po_wrap', modal),
        contact: $('#req_contact_wrap', modal),
        delivery: $('#req_delivery_wrap', modal),
        other: $('#req_other_wrap', modal)
      };
      const show=()=>{ wraps.po.style.display=toggles.po.checked?'':'none';
                       wraps.contact.style.display=toggles.contact.checked?'':'none';
                       wraps.delivery.style.display=toggles.delivery.checked?'':'none';
                       wraps.other.style.display=toggles.other.checked?'':'none'; };
      Object.values(toggles).forEach(t=> t.addEventListener('change', show));

      openBtn.addEventListener('click', (e)=>{ e.preventDefault(); show(); openModal('#wl-req-modal'); });
      cancel.addEventListener('click', ()=> closeModal('#wl-req-modal'));
      // Intentionally do not close this modal from backdrop clicks.
      // Users should close it only with Cancel or Submit so request edits are not lost accidentally.

      form.addEventListener('submit', async (e)=>{
        e.preventDefault();
        const data = {
          accountKey,
          po: toggles.po.checked ? { enabled:true, value: ($('#req_po_value').value||'').trim() } : { enabled:false },
          defaultContact: toggles.contact.checked ? {
            enabled:true,
            name: ($('#req_contact_name').value||'').trim(),
            email: ($('#req_contact_email').value||'').trim(),
            phone: digits($('#req_contact_phone').value||'')
          } : { enabled:false },
          deliveryUpdates: toggles.delivery.checked ? {
            enabled:true,
            email: ($('#req_delivery_email').value||'').trim()
          } : { enabled:false },
          other: toggles.other.checked ? { enabled:true, text: ($('#req_other_text').value||'').trim() } : { enabled:false },
          createdAt: new Date().toISOString()
        };
        if (data.po.enabled && !data.po.value) { alert('Please enter a default PO value.'); return; }
        if (data.defaultContact.enabled && !data.defaultContact.name) { alert('Please enter a contact name.'); return; }
        if (data.deliveryUpdates.enabled && !emailOK(data.deliveryUpdates.email)) { alert('Please enter a valid email for delivery updates.'); return; }
        try { localStorage.setItem(`wl_req_settings_${accountKey}`, JSON.stringify(data)); } catch {}
        if (SHEET_REQ_POST) { try { await fetch(SHEET_REQ_POST,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); } catch {} }
        closeModal('#wl-req-modal'); alert('Your account change request has been submitted.');
      });
    })();
  }

  /* -------- async lists + CART (ShoppingCart.aspx only) -------- */
  async function loadLists(){
    const parser=new DOMParser();
    async function fetchDoc(url){ try{ const r=await fetch(url,{credentials:'same-origin'}); if(!r.ok) throw 0; const text=await r.text(); return parser.parseFromString(text,'text/html'); }catch{ return null; } }
    const get=(el)=> (el?.textContent||'').trim();
    function absoluteUrl(value){
      if(!value || /^javascript:/i.test(value)) return '';
      try { return new URL(value, location.origin).toString(); } catch { return ''; }
    }
    function mapRows(doc, cols){
      if(!doc) return [];
      const t=doc.querySelector('.rgMasterTable');
      if(!t) return [];
      return Array.from(t.querySelectorAll('tbody tr')).map(r=>{
        const o={};
        cols.forEach(c=> o[c]=get(r.querySelector(`td[data-title="${c}"]`)));
        const firstLink=r.querySelector('a[href]');
        const productCell=r.querySelector('td[data-title="Product Code"], td[data-title="Product"], td[data-title="Product #"]');
        const productLink=productCell?.querySelector('a[href]');
        const image=r.querySelector('img[src]');
        o.link=absoluteUrl(firstLink?.getAttribute('href'))||null;
        o.productLink=absoluteUrl(productLink?.getAttribute('href'))||'';
        o.image=absoluteUrl(image?.getAttribute('src'))||'';
        return o;
      });
    }

    function summaryHtml(stats, extraClass=''){
      return `<div class="wl-section-summary ${extraClass}">${stats.map(stat=>`
        <div class="wl-summary-stat">
          <span class="wl-summary-label">${escapeHtml(stat.label)}</span>
          <span class="wl-summary-value">${escapeHtml(stat.value)}</span>
        </div>`).join('')}</div>`;
    }

    function statusClass(value){
      const state=String(value||'').toLowerCase();
      if(/complete|closed|shipped|invoiced|paid|applied|ready/.test(state)) return 'complete';
      if(/open|pending|process|progress|backorder/.test(state)) return 'open';
      return '';
    }

    async function mapWithConcurrency(items, limit, worker){
      const results=new Array(items.length);
      let next=0;
      async function run(){
        while(next<items.length){
          const index=next++;
          results[index]=await worker(items[index], index);
        }
      }
      await Promise.all(Array.from({length:Math.min(limit,items.length)}, run));
      return results;
    }

    async function resolveProductMedia(item){
      if(item.image) return {image:item.image, link:item.productLink||item.view};

      let productDoc=null;
      let productLink=item.productLink||'';
      if(productLink && /ProductDetail\.aspx/i.test(productLink)) productDoc=await fetchDoc(productLink);

      if(!productDoc){
        productDoc=await fetchDoc(`/Products.aspx?pg=0&searchText=${encodeURIComponent(item.sku||item.title||'')}`);
        const cardLink=productDoc?.querySelector("tr[id*='ProductImageRow'] a[href*='ProductDetail.aspx'], a[href*='ProductDetail.aspx'][id*='ProductImageRow']");
        productLink=absoluteUrl(cardLink?.getAttribute('href'))||productLink;
      }

      const image=productDoc?.querySelector("tr[id*='ProductImageRow'] img[src], img#ctl00_PageBody_productDetail_ProductImage[src], #ctl00_PageBody_productDetail_ProductImage img[src], #ProductImageRow img[src], img.productImage[src], img#MainProductImage[src]");
      return {image:absoluteUrl(image?.getAttribute('src')),link:productLink||item.view};
    }

    function productFallback(sku){
      return `<span class="wl-product-fallback">${escapeHtml(sku||'Product')}</span>`;
    }

    const parseUS=(s)=>{ const m=String(s||'').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m? new Date(+m[3],+m[1]-1,+m[2]) : null; };

    // Recent Activity
    (async ()=>{
      const invDoc=await fetchDoc('Invoices_r.aspx');
      let invs=mapRows(invDoc,['Invoice #','Invoice Date','Due Date','Goods Total','Tax','Total Amount','Amount Outstanding','Status']);
      if(!invs.some(x=>x['Invoice #'])) invs=mapRows(invDoc,['Invoice Number','Date','Outstanding','Amount','Status']);
      invs=invs.filter(x=>x['Invoice #']||x['Invoice Number']).map(x=>{
        const outstanding=x['Amount Outstanding']||x.Outstanding||'';
        return {
          type:'Invoice',
          id:x['Invoice #']||x['Invoice Number']||'Invoice',
          date:x['Invoice Date']||x.Date||'',
          amount:outstanding||x['Total Amount']||x.Amount||'',
          status:x.Status||(outstanding?(mNum(outstanding)>0?'Open':'Paid'):''),
          link:x.link||'Invoices_r.aspx'
        };
      });
      const crDoc=await fetchDoc('CreditNotes_r.aspx');
      let crs=mapRows(crDoc,['Credit Note #','Credit Date','Goods Total','Tax','Total Amount','Status']);
      if(!crs.some(x=>x['Credit Note #'])) crs=mapRows(crDoc,['Credit #','Date','Amount','Status']);
      crs=crs.filter(x=>x['Credit #']||x['Credit Note #']).map(x=>({
        type:'Credit',
        id:x['Credit Note #']||x['Credit #']||'Credit',
        date:x['Credit Date']||x.Date||'',
        amount:x['Total Amount']||x.Amount||'',
        status:x.Status||'',
        link:x.link||'CreditNotes_r.aspx'
      }));
      const all=invs.concat(crs).map(x=>({ ...x, _ts:(parseUS(x.date)||new Date(0)).getTime() })).sort((a,b)=> b._ts-a._ts).slice(0,6);
      const card=$('#wl-activity'); const ul=card?.querySelector('.wl-list'); if(!card) return;
      if (!all.length){ card.remove(); } else {
        ul.insertAdjacentElement('beforebegin',dom(summaryHtml([
          {label:'Latest entries',value:String(all.length)},
          {label:'Invoices',value:String(all.filter(it=>it.type==='Invoice').length)},
          {label:'Credits',value:String(all.filter(it=>it.type==='Credit').length)}
        ])));
        ul.innerHTML='';
        all.forEach(it=>ul.appendChild(dom(`<li class="wl-entry">
          <span class="wl-entry-icon ${it.type==='Credit'?'credit':''}" aria-hidden="true"><i class="fas ${it.type==='Credit'?'fa-receipt':'fa-file-invoice'}"></i></span>
          <div class="wl-entry-main">
            <div class="wl-entry-title"><a href="${escapeAttr(it.link)}">${escapeHtml(it.id)}</a></div>
            <div class="wl-entry-meta">${escapeHtml(displayDate(it.date)||'Date unavailable')}</div>
          </div>
          <div class="wl-entry-side">
            <div class="wl-entry-amount">${escapeHtml(displayMoney(it.amount))}</div>
            ${it.status?`<span class="wl-status ${statusClass(it.status)}">${escapeHtml(it.status)}</span>`:''}
          </div>
        </li>`)));
        if (!crs.length) $('#wl-credits-btn')?.remove();
      }
    })();

    // Open Orders
    (async ()=>{
      const doc=await fetchDoc('OpenOrders_r.aspx');
      const rows=mapRows(doc,['Order #','Created','Status','Total Amount','Goods Total']).filter(it=>it['Order #']).slice(0,5);
      const card=$('#wl-orders'); if (!card) return;
      if (!rows.length){ card.remove(); return; }
      const total=rows.reduce((sum,it)=>sum+mNum(it['Total Amount']||it['Goods Total']),0);
      const statuses=new Set(rows.map(it=>it.Status).filter(Boolean));
      const ul=card.querySelector('.wl-list');
      ul.insertAdjacentElement('beforebegin',dom(summaryHtml([
        {label:'Open orders',value:String(rows.length)},
        {label:'Order value',value:fmtMoney(total)},
        {label:'Statuses',value:String(statuses.size||1)}
      ])));
      ul.innerHTML='';
      rows.forEach(it=>ul.appendChild(dom(`<li class="wl-entry">
        <span class="wl-entry-icon" aria-hidden="true"><i class="fas fa-box"></i></span>
        <div class="wl-entry-main">
          <div class="wl-entry-title"><a href="${escapeAttr(it.link||'OpenOrders_r.aspx')}">${escapeHtml(it['Order #']||'Order')}</a></div>
          <div class="wl-entry-meta">${escapeHtml(displayDate(it.Created)||'Created date unavailable')}</div>
        </div>
        <div class="wl-entry-side">
          <div class="wl-entry-amount">${escapeHtml(displayMoney(it['Total Amount']||it['Goods Total']))}</div>
          ${it.Status?`<span class="wl-status ${statusClass(it.Status)}">${escapeHtml(it.Status)}</span>`:''}
        </div>
      </li>`)));
    })();

    // Recent Purchases
    (async ()=>{
      const doc=await fetchDoc('ProductsPurchased_R.aspx');
      let rows=mapRows(doc,['Product Code','Description','Order No.','Job Reference','OrderDate','Order Status','Customer Ref','Qty','Per','Sell Price','Total Price']);
      if(!rows.some(it=>it['Product Code']||it.Description)) rows=mapRows(doc,['Product','Description','Last Purchased','Qty','Price','Total','Product Code','Product #']);
      rows=rows.filter(it=>{
        const code=it['Product Code']||it['Product #']||it.Product||'';
        const description=it.Description||it.Product||'';
        return Boolean(code||description) && !/^(delivery|shipping|freight|fuel surcharge|web deliver)/i.test(`${code} ${description}`.trim());
      }).sort((a,b)=>{
        const newer=parseUS(b.OrderDate||b['Last Purchased']);
        const older=parseUS(a.OrderDate||a['Last Purchased']);
        return (newer?newer.getTime():0)-(older?older.getTime():0);
      }).slice(0,8);
      const card=$('#wl-purchases'); if(!card) return;
      if (!rows.length){ card.remove(); return; }
      const items=rows.map(it=>{
        const sku=it['Product Code']||it['Product #']||it.Product||'';
        const title=it.Description||it.Product||it['Product #']||sku||'Product';
        return {
          raw:it,sku,title,
          when:it.OrderDate||it['Last Purchased']||it.Date||'',
          qty:it.Qty||'',
          unit:it['Sell Price']||it.Price||'',
          total:it['Total Price']||it.Total||'',
          image:it.image||'',
          productLink:it.productLink||'',
          view:`Products.aspx?pg=0&searchText=${encodeURIComponent(sku)}`
        };
      });
      const spend=items.reduce((sum,item)=>sum+mNum(item.total),0);
      const units=items.reduce((sum,item)=>sum+mNum(item.qty),0);
      const ul=card.querySelector('.wl-list');
      ul.insertAdjacentElement('beforebegin',dom(summaryHtml([
        {label:'Recent products',value:String(items.length)},
        {label:'Units purchased',value:String(units)},
        {label:'Recent spend',value:fmtMoney(spend)}
      ],'wl-purchase-summary')));
      ul.innerHTML='';
      items.forEach((item,index)=>{
        ul.appendChild(dom(`<li class="wl-purchase-item" data-purchase-index="${index}">
          <a class="wl-purchase-media" href="${escapeAttr(item.productLink||item.view)}" aria-label="View ${escapeAttr(item.title)}">${item.image?`<img src="${escapeAttr(item.image)}" alt="${escapeAttr(item.title)}" loading="lazy">`:productFallback(item.sku)}</a>
          <div class="wl-purchase-content">
            <div class="wl-product-code">${escapeHtml(item.sku||'Product')}</div>
            <div class="wl-product-name">${escapeHtml(item.title)}</div>
            <div class="wl-product-meta">
              ${item.when?`<span>${escapeHtml(displayDate(item.when))}</span>`:''}
              ${item.qty?`<span>Qty ${escapeHtml(displayQty(item.qty))}</span>`:''}
              ${item.unit?`<span>${escapeHtml(displayMoney(item.unit))} each</span>`:''}
            </div>
            <div class="wl-product-bottom">
              <span class="wl-product-total">${escapeHtml(item.total?displayMoney(item.total):'')}</span>
              <a class="wl-product-link" href="${escapeAttr(item.productLink||item.view)}">View product <i class="fas fa-arrow-right" aria-hidden="true"></i></a>
            </div>
          </div>
        </li>`));
      });

      mapWithConcurrency(items,3,resolveProductMedia).then(results=>{
        results.forEach((media,index)=>{
          if(!media) return;
          const item=items[index];
          const row=ul.querySelector(`[data-purchase-index="${index}"]`);
          const mediaLink=row?.querySelector('.wl-purchase-media');
          const productLink=row?.querySelector('.wl-product-link');
          if(!row||!mediaLink) return;
          const destination=media.link||item.view;
          mediaLink.href=destination;
          if(productLink) productLink.href=destination;
          if(!media.image) return;
          mediaLink.innerHTML=`<img src="${escapeAttr(media.image)}" alt="${escapeAttr(item.title)}" loading="lazy">`;
          const image=mediaLink.querySelector('img');
          image?.addEventListener('error',()=>{ mediaLink.innerHTML=productFallback(item.sku); },{once:true});
        });
      }).catch(()=>{});
    })();

    // Cart Snapshot — ShoppingCart.aspx ONLY
    (async ()=>{
      const card=$('#wl-cart'); const rowCart=$('#wl-row-cart');
      const doc = await fetchDoc('ShoppingCart.aspx');  // <— only this page
      if (!doc){ card.remove(); rowCart.style.display='none'; return; }

      const root = doc.querySelector('.shopping-cart-details');
      if (!root){ card.remove(); rowCart.style.display='none'; return; }

      // Collect item cards and filter out placeholders/undefined
      let items = Array.from(root.querySelectorAll('.shopping-cart-item .cart-item-card')).map(c=>{
        const imgEl   = c.querySelector('img');
        const imgSrc  = imgEl?.getAttribute('src')||'';
        const titleA  = c.querySelector('h6 a[href]');
        const code    = (titleA?.textContent||'').trim();
        const hrefA   = titleA?.getAttribute('href') || c.querySelector('.flex-shrink-0 a[href]')?.getAttribute('href') || '#';
        const qtyIn   = c.querySelector('.qty-section input[type="text"]');
        const qty     = qtyIn ? qtyIn.value : '';
        const unitEl  = c.querySelector('.flex-shrink-0.text-end .fw-bold') || c.querySelector('.fw-bold');
        const unitTxt = (unitEl?.textContent||'').replace(/\s+/g,' ').trim(); // "$11.09 ea"
        const valid   = !!code && !!imgSrc && !/undefined/i.test(imgSrc) && !/undefined/i.test(hrefA);
        return valid ? {imgSrc, href: hrefA, code, qty, unitTxt} : null;
      }).filter(Boolean).slice(0,5);

      if (!items.length){ card.remove(); rowCart.style.display='none'; return; }

      const ul = card.querySelector('.wl-cart-list'); ul.innerHTML='';
      items.forEach(it=>{
        ul.appendChild(dom(`<li>
          <div class="wl-cart-left"><a href="${it.href}"><img class="wl-cart-thumb" src="${it.imgSrc}" alt=""></a></div>
          <div class="wl-cart-mid"><div class="wl-cart-code"><a href="${it.href}">${it.code}</a></div><div class="wl-meta">Qty ${it.qty || '—'}</div></div>
          <div class="wl-cart-right"><span class="wl-pill">${it.unitTxt||''}</span></div>
        </li>`));
      });

      // Ensure CTA targets ShoppingCart.aspx
      card.querySelector('#wl-cart-cta')?.setAttribute('href','ShoppingCart.aspx');
      card.style.display='';
      rowCart.style.display = ''; // ensure the row is visible if we had hidden it earlier
    })();
  }
})();

function mountCashAccountReload(container){
  const realBtn = document.getElementById('ctl00_PageBody_btnLoadCashAccountBalance');
  if (!realBtn) return; // Not a cash account (or button not rendered)

  // Hide the original BisTrack button but keep it for postback
  realBtn.classList.add('wl-hide');

  // Build the branded button without `dom()`
  const branded = document.createElement('button');
  branded.type = 'button';
  branded.className = 'wl-btn primary';
  branded.id = 'wl-reload-cash';
  branded.textContent = '🔄 Reload Balance';

  branded.addEventListener('click', () => {
    branded.disabled = true;
    branded.textContent = 'Reloading…';
    realBtn.click(); // Trigger the real ASP.NET postback
  });

  const anchor = document.createElement('span');
  anchor.id = 'reloadBalance';
  anchor.style.position = 'relative';
  anchor.style.top = '-80px';

  container.appendChild(anchor);
  container.appendChild(branded);

  if (window.location.hash === '#reloadBalance') {
    setTimeout(() => {
      branded.scrollIntoView({ behavior: 'smooth', block: 'center' });
      try { branded.focus(); } catch(e) {}
    }, 150);
  }
}
