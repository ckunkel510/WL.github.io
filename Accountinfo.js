
/* ==========================================================
   Woodson — Account Overview Dashboard (AccountInfo_R.aspx)
   v1.5 — fixes: menu redirect, pay stmt prefill; layout tightened
   ========================================================== */
(function(){
  'use strict';
  if (!/AccountInfo_R\.aspx/i.test(location.pathname)) return;

  /* ---------- config & utils ---------- */
  const BRAND = { primary:'#6b0016', primaryHover:'#540011', light:'#f8f8f8', border:'#e6e6e6' };
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const txt=(el)=> (el?.textContent||'').trim();
  const href=(el)=> el?.getAttribute('href')||'#';
  const dom=(html)=>{ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; };
  const moneyNum=(s)=>{ const v=parseFloat(String(s||'').replace(/[^0-9.\-]/g,'')); return Number.isFinite(v)?v:0; };
  const parseUSDate=(s)=>{ const m=String(s||'').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m? new Date(+m[3],+m[1]-1,+m[2]) : null; };
  const nextTenthFrom=(d)=>{ if(!(d instanceof Date)) return '—'; const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); (x.getDate()<10)?x.setDate(10):x.setMonth(x.getMonth()+1,10); return x.toLocaleDateString(); };

  /* ---------- styles ---------- */
  const styles = `
  .wl-acct-root{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif}
  .wl-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:16px}
  .wl-card{background:#fff;border:1px solid ${BRAND.border};border-radius:16px;box-shadow:0 1px 2px rgba(0,0,0,.05);padding:16px}
  .wl-title{font-size:1.25rem;font-weight:750}
  .wl-actions{display:flex;gap:10px;flex-wrap:wrap}
  .wl-btn{display:inline-flex;align-items:center;justify-content:center;padding:8px 12px;border-radius:10px;border:1px solid ${BRAND.border};background:${BRAND.light};text-decoration:none;color:#111;font-weight:600}
  .wl-btn.primary{background:${BRAND.primary};border-color:${BRAND.primary};color:#fff}
  .wl-btn.primary:hover{background:${BRAND.primaryHover};border-color:${BRAND.primaryHover}}
  .wl-list{margin:0;padding:0;list-style:none}
  .wl-list li{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #f0f0f0}
  .wl-list li:last-child{border-bottom:none}
  .wl-meta{font-size:.85rem;color:#666}
  .wl-pill{display:inline-block;padding:2px 8px;border-radius:999px;border:1px solid #e0e0e0;font-size:.75rem;color:#444;background:#fafafa}
  .wl-kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
  .wl-kpi{background:#fafafa;border:1px solid #eee;border-radius:12px;padding:12px}
  .wl-kpi .lbl{font-size:.8rem;color:#666}.wl-kpi .val{font-weight:700;font-size:1.05rem;margin-top:2px}
  .col-12{grid-column:span 12}.col-8{grid-column:span 8}.col-6{grid-column:span 6}.col-4{grid-column:span 4}
  @media (max-width:1024px){.col-8,.col-6,.col-4{grid-column:span 12}}
  /* Top with hamburger */
  .wl-top{position:relative;display:flex;align-items:center;justify-content:space-between;margin:8px 0 16px}
  .wl-ham{display:inline-flex;align-items:center;gap:10px}
  .wl-ham button{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid ${BRAND.border};border-radius:10px;background:#fff;cursor:pointer;font-weight:600}
  .wl-ham button:focus{outline:2px solid ${BRAND.primary};outline-offset:2px}
  .wl-ham-menu{position:absolute;left:8px;top:56px;z-index:1000;background:#fff;border:1px solid ${BRAND.border};border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.08);padding:8px;width:min(360px,92vw);max-height:70vh;overflow:auto;
    transition:max-height .25s ease, opacity .2s ease; max-height:0; opacity:0; pointer-events:none}
  .wl-ham-menu.open{max-height:70vh; opacity:1; pointer-events:auto}
  .wl-ham-menu a{display:block;padding:10px 12px;border-radius:8px;color:#111;text-decoration:none}
  .wl-ham-menu a:hover{background:#f5f5f5}
  /* Hide original left nav */
  .wl-hide{position:absolute !important;left:-9999px !important;width:1px !important;height:1px !important;overflow:hidden !important}
  .wl-section-title{border-left:4px solid ${BRAND.primary};padding-left:8px;margin:0 0 8px;font-size:1rem;font-weight:700}
  `;
  document.head.appendChild(dom(`<style>${styles}</style>`));

  /* ---------- scrape essentials ---------- */
  const snapshot={};
  $$('#ctl00_PageBody_AccountActivity_AccountActivityLeftColumn tr').forEach(tr=>{
    snapshot[txt($('th',tr)).replace(/:$/,'')] = txt($('td',tr));
  });
  const last={};
  $$('.accountActivity_r tr').forEach(tr=>{
    const k=txt($('th',tr)).replace(/:$/,''); const d=txt($('td:nth-child(2)',tr)); const a=txt($('td:nth-child(3)',tr));
    if(k) last[k]={date:d,amount:a};
  });

  const links={
    cards:$('#ctl00_PageBody_AccountActivity_ManageStoredCardsForNonCashCustomers'),
    jobs: $('#JobBalancesButton'),
    statement: $('#GetInterimStatementLink')
  };

  /* ---------- build "pay this statement" to AccountPayment_r.aspx with utm_total ---------- */
  const stmtNetAmt = moneyNum(last['Last Statement Net Amount']?.amount);
  const stmtDate   = parseUSDate(last['Last Statement Amount']?.date || last['Last Statement Net Amount']?.date);
  const stmtDue    = nextTenthFrom(stmtDate);
  function buildPayStatementUrl(){
    const base = 'AccountPayment_r.aspx'; // your pay-by-invoice script keys live here
    const q = new URLSearchParams();
    if (stmtNetAmt>0) q.set('utm_total', stmtNetAmt.toFixed(2));
    if (stmtDate)     q.set('utm_note', `Statement ${stmtDate.toLocaleDateString()}`); // optional
    q.set('utm_source','AccountInfo');
    q.set('utm_action','PayStatement');
    return `${base}?${q.toString()}`;
  }

  /* ---------- frame UI ---------- */
  const acctName = (txt($('.panel.panelAccountInfo .listPageHeader'))||'').replace(/Account Information for/i,'').trim() || 'Your Account';

  const container = dom(`
    <div class="wl-acct-root">
      <div class="wl-top">
        <div class="wl-ham">
          <button id="wl-ham-btn" type="button" aria-expanded="false" aria-controls="wl-ham-menu">☰ Menu</button>
          <div class="wl-title">Account Overview — ${acctName}</div>
          <div id="wl-ham-menu" class="wl-ham-menu" role="menu"></div>
        </div>
        <div class="wl-actions">
          <a class="wl-btn" href="${href(links.cards)}">Manage Cards</a>
          <a class="wl-btn" href="${href(links.jobs)}">Job Balances</a>
        </div>
      </div>

      <div class="wl-grid">
        <!-- Snapshot small (col-4) -->
        <div class="wl-card col-4" id="wl-snapshot">
          <h3 class="wl-section-title">Account Snapshot</h3>
          <div class="wl-kpis">
            <div class="wl-kpi"><div class="lbl">Net Balance</div><div class="val">${snapshot['Net Balance'] ?? '—'}</div></div>
            <div class="wl-kpi"><div class="lbl">On Order</div><div class="val">${snapshot['On Order'] ?? '—'}</div></div>
          </div>
        </div>

        <!-- Statements larger (col-8) with Pay -->
        <div class="wl-card col-8" id="wl-statements">
          <h3 class="wl-section-title">Statements</h3>
          <div class="wl-meta">Last Statement Date: <strong>${last['Last Statement Amount']?.date || '—'}</strong></div>
          <div class="wl-meta">Last Statement Amount: <strong>${last['Last Statement Amount']?.amount || '—'}</strong></div>
          <div class="wl-meta">Net Amount: <strong>${last['Last Statement Net Amount']?.amount || '—'}</strong></div>
          <div class="wl-meta">Finance Charges: <strong>${last['Last Statement Finance Charges']?.amount || '—'}</strong></div>
          <div class="wl-meta">Due Date: <strong>${stmtDue}</strong></div>
          <div class="wl-actions" style="margin-top:8px">
            <a class="wl-btn primary" id="wl-pay-statement" href="${buildPayStatementUrl()}">Pay This Statement</a>
            <a class="wl-btn" href="${href(links.statement)}" target="_blank" rel="noopener">Generate Interim Statement</a>
            <a class="wl-btn" href="Statements_R.aspx">View All Statements</a>
          </div>
        </div>

        <!-- Activity (col-4) -->
        <div class="wl-card col-4" id="wl-activity">
          <h3 class="wl-section-title">Recent Activity</h3>
          <ul class="wl-list" data-empty="Loading…"></ul>
          <div class="wl-actions" style="margin-top:8px">
            <a class="wl-btn" href="Invoices_r.aspx">View Invoices</a>
            <a class="wl-btn" href="CreditNotes_r.aspx">View Credits</a>
          </div>
        </div>

        <!-- Orders (col-4) -->
        <div class="wl-card col-4" id="wl-orders">
          <h3 class="wl-section-title">Open Orders</h3>
          <ul class="wl-list" data-empty="Loading…"></ul>
          <div class="wl-actions" style="margin-top:8px">
            <a class="wl-btn" href="OpenOrders_r.aspx">View All Orders</a>
          </div>
        </div>

        <!-- Purchases (col-4) -->
        <div class="wl-card col-4" id="wl-purchases">
          <h3 class="wl-section-title">Recent Purchases</h3>
          <ul class="wl-list" data-empty="Loading…"></ul>
          <div class="wl-actions" style="margin-top:8px">
            <a class="wl-btn" href="ProductsPurchased_R.aspx">View More Purchased Products</a>
          </div>
        </div>

        <!-- Quick Links (your legacy set) -->
        <div class="wl-card col-12" id="wl-quicklinks">
          <h3 class="wl-section-title">Quick Links</h3>
          <div class="wl-actions">
            <a class="wl-btn" href="AccountPayment_r.aspx">Make a Payment</a>
            <a class="wl-btn" href="OpenOrders_r.aspx">Open Orders</a>
            <a class="wl-btn" href="Invoices_r.aspx">Invoices</a>
            <a class="wl-btn" href="CreditNotes_r.aspx">Credits</a>
            <a class="wl-btn" href="OpenQuotes_r.aspx">Quotes</a>
            <a class="wl-btn" href="Quicklists_R.aspx">Your Lists</a>
            <a class="wl-btn" href="Statements_R.aspx">Statements</a>
            <a class="wl-btn" href="ProductsPurchased_R.aspx">Products Purchased</a>
            <a class="wl-btn" href="CustomerCards.aspx">Manage Stored Cards</a>
            <a class="wl-btn" href="AddressList_R.aspx">Addresses</a>
            <a class="wl-btn" href="Contacts_r.aspx">Account Contacts</a>
            <a class="wl-btn" href="https://woodsonwholesaleinc.formstack.com/forms/agtimber2027" target="_blank" rel="noopener">Apply Tax Exemption</a>
          </div>
        </div>
      </div>
    </div>
  `);

  /* ---------- mount & hide legacy ---------- */
  const pageBody = document.querySelector('td.pageContentBody') || document.body;
  pageBody.insertBefore(container, pageBody.firstChild);

  // Hide original left nav, aging, old blocks
  const leftNav = $('#ctl00_LeftSidebarContents_MainNav_NavigationMenu');
  if (leftNav) leftNav.classList.add('wl-hide');
  ['.account-aging-title','#ctl00_PageBody_AgingTable_AgingGrid','.documentRequest','#WTAccountActivity','.panel.panelAccountInfo']
    .forEach(sel=> $$(sel).forEach(el=> el.classList.add('wl-hide')));

  /* ---------- hamburger wiring (no redirect) ---------- */
  (function setupHamburger(){
    const btn = $('#wl-ham-btn', container);
    const menu= $('#wl-ham-menu', container);
    // Fill menu with left nav links (if present) else with quick links
    if (leftNav) {
      $$('.rmRootGroup .rmItem a', leftNav).forEach(a=>{
        menu.appendChild(dom(`<a role="menuitem" href="${a.href}">${txt(a)}</a>`));
      });
    } else {
      // mirror the Quick Links
      $$('#wl-quicklinks .wl-actions a', container).forEach(a=>{
        menu.appendChild(dom(`<a role="menuitem" href="${a.href}" ${a.target?'target="'+a.target+'"':''}>${txt(a)}</a>`));
      });
    }
    const toggle=(open)=>{ menu.classList.toggle('open', open); btn.setAttribute('aria-expanded', open?'true':'false'); };
    btn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); toggle(!menu.classList.contains('open')); return false; });
    document.addEventListener('click', (e)=>{ if(!menu.classList.contains('open')) return; if(!menu.contains(e.target) && e.target!==btn){ toggle(false);} });
    // Prevent any accidental form submit behavior in WebForms
    btn.setAttribute('onclick','return false;');
  })();

  /* ---------- loaders ---------- */
  const parser = new DOMParser();
  async function fetchDoc(url){ try{ const r=await fetch(url,{credentials:'same-origin'}); if(!r.ok) throw 0; return parser.parseFromString(await r.text(),'text/html'); }catch{ return null; } }
  function mapRows(doc, cols){ if(!doc) return []; const t=doc.querySelector('.rgMasterTable'); if(!t) return []; return Array.from(t.querySelectorAll('tbody tr')).map(r=>{ const o={}; cols.forEach(c=> o[c]=txt(r.querySelector(`td[data-title="${c}"]`))); const a=r.querySelector('a[href]'); o.link=a? new URL(a.getAttribute('href'), location.origin).toString():null; return o; }); }
  function renderList(ul, items, builder, empty){ ul.innerHTML=''; if(!items.length){ ul.innerHTML=`<li><div class="wl-meta">${empty||'No items found.'}</div></li>`; return;} items.forEach(it=> ul.appendChild(builder(it))); }

  // Recent Activity: merge Invoices + Credits by date (limit 6)
  (async function(){
    const invDoc=await fetchDoc('Invoices_r.aspx');
    let invs=mapRows(invDoc,['Invoice #','Date','Outstanding','Amount','Status']); if(!invs.length) invs=mapRows(invDoc,['Invoice Number','Date','Outstanding','Amount','Status']);
    invs=invs.map(x=>({type:'Invoice',id:x['Invoice #']||x['Invoice Number']||'Invoice',date:x['Date']||'',amount:x['Outstanding']||x['Amount']||'',status:x['Status']||'',link:x.link||'Invoices_r.aspx'}));
    const crDoc=await fetchDoc('CreditNotes_r.aspx');
    let crs=mapRows(crDoc,['Credit #','Date','Amount','Status']); if(!crs.length) crs=mapRows(crDoc,['Credit Note #','Date','Amount','Status']);
    crs=crs.map(x=>({type:'Credit',id:x['Credit #']||x['Credit Note #']||'Credit',date:x['Date']||'',amount:x['Amount']||'',status:x['Status']||'',link:x.link||'CreditNotes_r.aspx'}));
    const all=invs.concat(crs).map(x=>({ ...x, _ts: (parseUSDate(x.date)||new Date(0)).getTime() }))
      .sort((a,b)=> b._ts-a._ts).slice(0,6);
    const ul=$('#wl-activity .wl-list', container);
    renderList(ul, all, it=> dom(`<li>
      <div><div><a href="${it.link}"><strong>${it.id}</strong></a> <span class="wl-pill">${it.type}</span></div><div class="wl-meta">${it.date}${it.status?` • ${it.status}`:''}</div></div>
      <div><span class="wl-pill">${it.amount||''}</span></div>
    </li>`), 'No recent activity.');
  })();

  // Open Orders: top 5
  (async function(){
    const doc=await fetchDoc('OpenOrders_r.aspx');
    const rows=mapRows(doc,['Order #','Created','Status','Total Amount','Goods Total']).slice(0,5);
    const ul=$('#wl-orders .wl-list', container);
    renderList(ul, rows, it=> dom(`<li>
      <div><div><a href="${it.link||'OpenOrders_r.aspx'}"><strong>${it['Order #']||'Order'}</strong></a></div><div class="wl-meta">${it.Created||''}${it.Status?` • ${it.Status}`:''}</div></div>
      <div><span class="wl-pill">${it['Total Amount']||it['Goods Total']||''}</span></div>
    </li>`), 'No open orders.');
  })();

  // Purchases: top 10 + View Product
  (async function(){
    const doc=await fetchDoc('ProductsPurchased_R.aspx');
    let rows=mapRows(doc,['Product','Description','Last Purchased','Qty','Price','Total','Product Code','Product #']);
    if(!rows.length) rows=mapRows(doc,['Product','Description','Date','Qty','Price','Product Code','Product #']);
    rows=rows.slice(0,10);
    const ul=$('#wl-purchases .wl-list', container);
    renderList(ul, rows, it=>{
      const sku=it['Product Code']||it['Product #']||it['Product']||'';
      const title=it['Product']||it['Product #']||sku||'Product';
      const desc =it.Description?` — ${it.Description}`:'';
      const when=it['Last Purchased']||it['Date']||'';
      const total=it.Total||(it.Price?`@ ${it.Price}`:'');
      const view=`Products.aspx?&searchText=${encodeURIComponent(sku)}`;
      return dom(`<li>
        <div><div><strong>${title}</strong>${desc}</div><div class="wl-meta">${when}${it.Qty?` • Qty ${it.Qty}`:''}</div></div>
        <div>${total?`<span class="wl-pill" style="margin-right:8px">${total}</span>`:''}<a class="wl-btn" href="${view}">View Product</a></div>
      </li>`);
    }, 'No recent purchases.');
  })();

  // Done.
})();

