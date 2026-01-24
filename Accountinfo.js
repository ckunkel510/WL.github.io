
/* ==========================================================
   Woodson — Account Overview (AccountInfo_R.aspx)
   v3.5 — Cart Snapshot from ShoppingCart.aspx (only),
          robust parsing + silent hides
   ========================================================== */
(function(){
  'use strict';
  if (!/AccountInfo_R\.aspx/i.test(location.pathname)) return;

  /* Optional: Google Sheet endpoints (leave blank for local only) */
  const SHEET_API_GET  = '';
  const SHEET_API_POST = '';
  const SHEET_REQ_POST = '';

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
  function getCashBalanceCredit(){
    const el=document.getElementById('ctl00_PageBody_lblBalanceLabel');
    if(!el) return 0;
    // e.g. "Cash balance: $10.00"
    return mNum(el.textContent);
  }
  function waitFor(sel,{timeout=1000,interval=120}={}){return new Promise((res,rej)=>{const t0=Date.now();const tick=()=>{const el=$(sel);if(el) return res(el); if(Date.now()-t0>=timeout) return rej(new Error('timeout '+sel)); setTimeout(tick,interval)}; (document.readyState==='loading')?document.addEventListener('DOMContentLoaded',tick,{once:true}):tick();});}

  /* ----------- styles ----------- */
  const styles = `
  .wl-acct-root, .wl-acct-root * { box-sizing: border-box; }
  .wl-acct-root{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif; width:100%}
  .wl-top{position:relative;display:flex;align-items:center;justify-content:space-between;margin:6px 0 12px}
  .wl-ham{display:inline-flex;align-items:center;gap:10px}
  .wl-title{font-size:1.15rem;font-weight:800;color:${BRAND.primary}}
  .wl-ham button{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid ${BRAND.border};border-radius:9px;background:#fff;cursor:pointer;font-weight:700;color:${BRAND.primary}}
  .wl-ham-menu{position:absolute;left:8px;top:44px;z-index:1000;background:#fff;border:1px solid ${BRAND.border};border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.12);padding:8px;width:min(380px,92vw);max-height:70vh;overflow:auto;transition:max-height .25s ease, opacity .2s ease; max-height:0; opacity:0; pointer-events:none}
  .wl-ham-menu.open{max-height:70vh; opacity:1; pointer-events:auto}
  .wl-ham-menu a{display:block;padding:8px 10px;border-radius:8px;color:#111;text-decoration:none}
  .wl-ham-menu a:hover{background:${BRAND.bgSoft}}
  .wl-hide{position:absolute !important;left:-9999px !important;width:1px !important;height:1px !important;overflow:hidden !important}

  /* GRID ROWS */
  .wl-row{display:grid;gap:14px;margin-bottom:14px}
  .wl-row-3{grid-template-columns:repeat(auto-fit, minmax(340px, 1fr));}
  .wl-row-2{grid-template-columns:repeat(auto-fit, minmax(420px, 1fr));}
  .wl-row-1{grid-template-columns:1fr;}
  @media (max-width: 1024px){ .wl-row-2{grid-template-columns:repeat(auto-fit, minmax(340px, 1fr));} }
  @media (max-width: 720px){ .wl-row-3,.wl-row-2{grid-template-columns:1fr;} .wl-top{flex-wrap:wrap; gap:10px} }

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
  .wl-list li{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px;border-bottom:1px dashed #e7d6d9;background:#fff;border-radius:9px;min-width:0}
  .wl-meta{font-size:.9rem;color:#5f5f5f}
  .wl-pill{display:inline-block;padding:2px 10px;border-radius:999px;background:#fff;border:1px solid #e0c7cc;font-size:.8rem;color:${BRAND.primary};font-weight:700;white-space:nowrap}

  .wl-actions{display:flex;gap:8px;flex-wrap:wrap}
  .wl-btn{display:inline-flex;align-items:center;justify-content:center;padding:9px 14px;border-radius:9px;border:1px solid ${BRAND.border};background:#fff;text-decoration:none;color:#111;font-weight:700;line-height:1.2;white-space:nowrap;min-width:150px}
  .wl-btn.primary{background:${BRAND.primary};border-color:${BRAND.primary};color:#fff}
  .wl-btn.primary:hover{background:${BRAND.primaryHover};border-color:${BRAND.primaryHover}}
  @media (max-width: 560px){ .wl-btn{flex:1 1 auto; min-width:unset} }

  /* Cart Snapshot visuals */
  .wl-cart-list li{gap:12px}
  .wl-cart-left{display:flex;align-items:center;justify-content:center}
  .wl-cart-thumb{width:64px;height:64px;object-fit:contain;border-radius:6px;background:#fff;border:1px solid #eee}
  .wl-cart-mid{flex:1 1 auto;min-width:0}
  .wl-cart-code{font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:340px}
  .wl-cart-right{display:flex;align-items:center;gap:8px}

  /* MODALS (same as previous) */
  .wl-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.35);z-index:9999}
  .wl-modal.open{display:flex}
  .wl-modal-card{width:min(780px,94vw);background:#fff;border-radius:12px;border:1px solid ${BRAND.border};box-shadow:0 10px 28px rgba(0,0,0,.18);overflow:hidden}
  .wl-modal-head{background:${BRAND.primary};color:#fff;padding:12px 16px;font-weight:750}
  .wl-modal-body{padding:16px}
  .wl-form{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:10px}
  .wl-field{grid-column:span 12}
  .wl-field.half{grid-column:span 6}
  .wl-field label{display:flex;gap:8px;align-items:center;font-weight:600;margin-bottom:6px}
  .wl-field input[type="text"], .wl-field input[type="email"], .wl-field input[type="tel"], .wl-field select, .wl-field textarea{
    width:100%; padding:10px 12px; border:1px solid #ddd; border-radius:8px; background:#fff; font:inherit;
  }
  .wl-modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:12px}
  .wl-modal-actions .wl-btn{min-width:160px}
  @media (max-width:560px){ .wl-form .half{grid-column:span 12} .wl-modal-actions{flex-wrap:wrap} .wl-modal-actions .wl-btn{flex:1 1 100%} }

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
    buildUI();
    loadLists();
  }

  function buildUI(){
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

    const stmtNetAmt = mNum(last['Last Statement Net Amount']?.amount);
    const stmtDate   = parseUS(last['Last Statement Amount']?.date || last['Last Statement Net Amount']?.date);
    const lastStmtAmtVal = mNum(last['Last Statement Amount']?.amount);
    const hasStatements  = !!(stmtDate || stmtNetAmt>0 || lastStmtAmtVal>0);
    const stmtDue    = next10(stmtDate);
    const payStmtUrl = (()=>{ const q=new URLSearchParams(); if(stmtNetAmt>0) q.set('utm_total', stmtNetAmt.toFixed(2)); if(stmtDate) q.set('utm_note',`Statement ${stmtDate.toLocaleDateString()}`); q.set('utm_source','AccountInfo'); q.set('utm_action','PayStatement'); return `AccountPayment_r.aspx?${q.toString()}`; })();

    // Cash account (store credit) — shown separately from Net Balance
    const cashCredit = getCashBalanceCredit();
    const cashCreditDisplay = cashCredit > 0 ? fmtMoney(cashCredit) : '—';

    /* mount */
    const container = dom(`
      <div class="wl-acct-root">
        <div class="wl-top">
          <div class="wl-ham">
            <button id="wl-ham-btn" type="button" aria-expanded="false" aria-controls="wl-ham-menu">☰ Menu</button>
            <div class="wl-title">Account Overview — ${acctName}</div>
            <div id="wl-ham-menu" class="wl-ham-menu" role="menu"></div>
          </div>
          <div class="wl-actions">
            <a class="wl-btn primary" id="wl-top-pay" href="AccountPayment_r.aspx?utm_source=AccountInfo&utm_action=MakePayment">Make a Payment</a>
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
                <a class="wl-btn" href="CustomerCards.aspx">Manage Stored Cards</a>
                <a class="wl-btn" href="AddressList_R.aspx">Addresses</a>
                <a class="wl-btn" href="Contacts_r.aspx">Contacts</a>
                <a class="wl-btn" href="https://woodsonwholesaleinc.formstack.com/forms/agtimber2027" target="_blank" rel="noopener">Apply Tax Exemption</a>
                <a class="wl-btn" id="wl-comm-open" href="#">Edit Communication Preferences</a>
                <a class="wl-btn" id="wl-req-open" href="#">Request Account Changes</a>
              </div>
              <div class="wl-meta">Manage profile, cards, addresses, contacts, and preferences.</div>
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
              <div class="wl-actions" style="margin-top:8px">
                <a class="wl-btn primary" id="wl-pay-statement" href="${payStmtUrl}">Pay This Statement</a>
                <a class="wl-btn" href="${href(links.statement)}" target="_blank" rel="noopener">Generate Interim Statement</a>
                <a class="wl-btn" href="Statements_R.aspx">View All</a>
              </div>
            </div>
          </div>
        </div>

        <!-- Row 2 -->
        <div class="wl-row wl-row-2" id="wl-row2">
          <div class="wl-card" id="wl-activity">
            <div class="wl-head">Recent Activity</div>
            <div class="wl-body">
              <ul class="wl-list" data-empty="Loading…"></ul>
              <div class="wl-actions" style="margin-top:8px">
                <a class="wl-btn" id="wl-invoices-btn" href="Invoices_r.aspx">View Invoices</a>
                <a class="wl-btn" id="wl-credits-btn" href="CreditNotes_r.aspx">View Credits</a>
              </div>
            </div>
          </div>

          <div class="wl-card" id="wl-orders">
            <div class="wl-head">Open Orders</div>
            <div class="wl-body">
              <ul class="wl-list" data-empty="Loading…"></ul>
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
          <div class="wl-card" id="wl-purchases">
            <div class="wl-head">Recent Purchases</div>
            <div class="wl-body">
              <ul class="wl-list" data-empty="Loading…"></ul>
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
                <div class="wl-field half"><label for="comm_email">Email address</label><input type="email" id="comm_email" placeholder="name@example.com"></div>
                <div class="wl-field half"><label><input type="checkbox" id="comm_sms_mkt"> SMS marketing</label></div>
                <div class="wl-field half"><label for="comm_sms_phone">SMS phone</label><input type="tel" id="comm_sms_phone" placeholder="(###) ###-####"></div>
                <div class="wl-field"><div class="wl-meta">We’ll remember these on this device and (optionally) in our preference store.</div></div>
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
      if (topPay) topPay.style.display = 'none';
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
      if (leftNav) { $$('.rmRootGroup .rmItem a', leftNav).forEach(a=> menu.appendChild(dom(`<a role="menuitem" href="${a.href}">${a.textContent.trim()}</a>`))); }
      else { ['Invoices_r.aspx','CreditNotes_r.aspx','OpenOrders_r.aspx','Statements_R.aspx','ProductsPurchased_R.aspx','AccountPayment_r.aspx','AccountSettings.aspx','AddressList_R.aspx','Contacts_r.aspx','ShoppingCart.aspx']
        .forEach(h=> menu.appendChild(dom(`<a role="menuitem" href="${h}">${h.replace(/_r\.aspx|\.aspx/,'').replace(/_/g,' ')}</a>`))); }
      const toggle=(open)=>{ menu.classList.toggle('open', open); btn.setAttribute('aria-expanded', open?'true':'false'); };
      btn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); toggle(!menu.classList.contains('open')); return false; });
      document.addEventListener('click', (e)=>{ if(!menu.classList.contains('open')) return; if(!menu.contains(e.target) && e.target!==btn){ toggle(false); } });
      btn.setAttribute('onclick','return false;');
    })();

    /* COMM PREFS storage */
    const COMM_KEY = (k)=> `wl_comm_prefs_v3_${k}`;
    function getLocalPrefs(){ try { return JSON.parse(localStorage.getItem(COMM_KEY(accountKey))||'{}'); } catch { return {}; } }
    function setLocalPrefs(v){ try { localStorage.setItem(COMM_KEY(accountKey), JSON.stringify(v)); } catch {} }
    async function fetchRemotePrefs(){ if (!SHEET_API_GET) return null; try{ const u=new URL(SHEET_API_GET); u.searchParams.set('accountKey',accountKey); const r=await fetch(u.toString(),{credentials:'omit'}); if(!r.ok) return null; return await r.json(); }catch{ return null; } }
    async function postRemotePrefs(v){ if (!SHEET_API_POST) return false; try{ const r=await fetch(SHEET_API_POST,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(v)}); return r.ok; }catch{ return false; } }

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
        sms_mkt: $('#comm_sms_mkt', modal),
        sms_phone: $('#comm_sms_phone', modal)
      };
      async function hydrate(){ const local=getLocalPrefs(); const remote=await fetchRemotePrefs(); const v=Object.assign({}, local, remote||{}); f.email_mkt.checked=!!v.emailMarketing; f.email_billing.checked=!!v.emailBilling; f.email_delivery.checked=!!v.emailDelivery; if(v.email) f.email.value=v.email; f.sms_mkt.checked=!!v.smsMarketing; if(v.smsPhone) f.sms_phone.value=v.smsPhone; }
      openBtn.addEventListener('click', (e)=>{ e.preventDefault(); hydrate(); openModal('#wl-comm-modal'); });
      cancel.addEventListener('click', ()=> closeModal('#wl-comm-modal'));
      modal.addEventListener('click', (e)=>{ if (e.target===modal) closeModal('#wl-comm-modal'); });
      form.addEventListener('submit', async (e)=>{
        e.preventDefault();
        const wantsEmail = $('#comm_email_mkt').checked || $('#comm_email_billing').checked || $('#comm_email_delivery').checked;
        const wantsSMS   = $('#comm_sms_mkt').checked;
        if (wantsEmail && !emailOK($('#comm_email').value)) { alert('Please enter a valid email address.'); $('#comm_email').focus(); return; }
        if (wantsSMS) { const p=digits($('#comm_sms_phone').value); if (p.length<7) { alert('Please enter a valid phone number for SMS.'); $('#comm_sms_phone').focus(); return; } $('#comm_sms_phone').value=p; }
        const payload = {
          accountKey,
          email: ($('#comm_email').value||'').trim(),
          emailMarketing: $('#comm_email_mkt').checked,
          emailBilling: $('#comm_email_billing').checked,
          emailDelivery: $('#comm_email_delivery').checked,
          smsMarketing: $('#comm_sms_mkt').checked,
          smsPhone: digits($('#comm_sms_phone').value||''),
          updatedAt: new Date().toISOString()
        };
        setLocalPrefs(payload);
        if (SHEET_API_POST) await postRemotePrefs(payload);
        closeModal('#wl-comm-modal'); alert('Your communication preferences have been saved.');
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
      modal.addEventListener('click', (e)=>{ if (e.target===modal) closeModal('#wl-req-modal'); });

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
    function mapRows(doc, cols){ if(!doc) return []; const t=doc.querySelector('.rgMasterTable'); if(!t) return []; return Array.from(t.querySelectorAll('tbody tr')).map(r=>{ const o={}; cols.forEach(c=> o[c]=get(r.querySelector(`td[data-title="${c}"]`))); const a=r.querySelector('a[href]'); o.link=a? new URL(a.getAttribute('href'), location.origin).toString():null; return o; }); }

    const parseUS=(s)=>{ const m=String(s||'').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m? new Date(+m[3],+m[1]-1,+m[2]) : null; };

    // Recent Activity
    (async ()=>{
      const invDoc=await fetchDoc('Invoices_r.aspx');
      let invs=mapRows(invDoc,['Invoice #','Date','Outstanding','Amount','Status']); if(!invs.length) invs=mapRows(invDoc,['Invoice Number','Date','Outstanding','Amount','Status']);
      invs=invs.map(x=>({type:'Invoice',id:x['Invoice #']||x['Invoice Number']||'Invoice',date:x['Date']||'',amount:x['Outstanding']||x['Amount']||'',status:x['Status']||'',link:x.link||'Invoices_r.aspx'}));
      const crDoc=await fetchDoc('CreditNotes_r.aspx');
      let crs=mapRows(crDoc,['Credit #','Date','Amount','Status']); if(!crs.length) crs=mapRows(crDoc,['Credit Note #','Date','Amount','Status']);
      crs=crs.map(x=>({type:'Credit',id:x['Credit #']||x['Credit Note #']||'Credit',date:x['Date']||'',amount:x['Amount']||'',status:x['Status']||'',link:x.link||'CreditNotes_r.aspx'}));
      const all=invs.concat(crs).map(x=>({ ...x, _ts:(parseUS(x.date)||new Date(0)).getTime() })).sort((a,b)=> b._ts-a._ts).slice(0,6);
      const card=$('#wl-activity'); const ul=card?.querySelector('.wl-list'); if(!card) return;
      if (!all.length){ card.remove(); } else { ul.innerHTML=''; all.forEach(it=> ul.appendChild(dom(`<li>
        <div><div><a href="${it.link}"><strong>${it.id}</strong></a> <span class="wl-pill">${it.type}</span></div><div class="wl-meta">${it.date}${it.status?` • ${it.status}`:''}</div></div>
        <div><span class="wl-pill">${it.amount||''}</span></div>
      </li>`))); if (!crs.length) $('#wl-credits-btn')?.remove(); }
    })();

    // Open Orders
    (async ()=>{
      const doc=await fetchDoc('OpenOrders_r.aspx');
      const rows=mapRows(doc,['Order #','Created','Status','Total Amount','Goods Total']).slice(0,5);
      const card=$('#wl-orders'); if (!card) return;
      if (!rows.length){ card.remove(); return; }
      const ul=card.querySelector('.wl-list'); ul.innerHTML='';
      rows.forEach(it=> ul.appendChild(dom(`<li>
        <div><div><a href="${it.link||'OpenOrders_r.aspx'}"><strong>${it['Order #']||'Order'}</strong></a></div><div class="wl-meta">${it.Created||''}${it.Status?` • ${it.Status}`:''}</div></div>
        <div><span class="wl-pill">${it['Total Amount']||it['Goods Total']||''}</span></div>
      </li>`)));
    })();

    // Recent Purchases
    (async ()=>{
      const doc=await fetchDoc('ProductsPurchased_R.aspx');
      let rows=mapRows(doc,['Product','Description','Last Purchased','Qty','Price','Total','Product Code','Product #']);
      if(!rows.length) rows=mapRows(doc,['Product','Description','Date','Qty','Price','Product Code','Product #']);
      rows=rows.slice(0,10);
      const card=$('#wl-purchases'); if(!card) return;
      if (!rows.length){ card.remove(); return; }
      const ul=card.querySelector('.wl-list'); ul.innerHTML='';
      rows.forEach(it=>{
        const sku=it['Product Code']||it['Product #']||it['Product']||'';
        const title=it['Product']||it['Product #']||sku||'Product';
        const when=it['Last Purchased']||it['Date']||'';
        const total=it.Total||(it.Price?`@ ${it.Price}`:'');
        const view=`Products.aspx?&searchText=${encodeURIComponent(sku)}`;
        ul.appendChild(dom(`<li>
          <div class="wl-cart-left"></div>
          <div><div><strong>${title}</strong></div><div class="wl-meta">${when}${it.Qty?` • Qty ${it.Qty}`:''}</div></div>
          <div>${total?`<span class="wl-pill">${total}</span>`:''}<a class="wl-btn" href="${view}">View Product</a></div>
        </li>`));
      });
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

  container.appendChild(branded);
}


