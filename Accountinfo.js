
/* ==========================================================
   Woodson — Account Overview Dashboard (AccountInfo_R.aspx)
   v1.3  — JS-only, Amazon/HomeDepot vibe, WL branding
   ========================================================== */
(function(){
  'use strict';
  if (!/AccountInfo_R\.aspx/i.test(location.pathname)) return;

  /* ---------- config & utils ---------- */
  const BRAND = {
    primary: '#6b0016',    // Woodson maroon
    primaryHover: '#540011',
    light: '#f8f8f8',
    border: '#e6e6e6'
  };
  const LOG = 1; // 0=errors,1=warn,2=info,3=debug
  const log = {
    error:(...a)=>{ if (LOG>=0) console.error('[AcctDash]',...a); },
    warn: (...a)=>{ if (LOG>=1) console.warn ('[AcctDash]',...a); },
    info: (...a)=>{ if (LOG>=2) console.info ('[AcctDash]',...a); },
    debug:(...a)=>{ if (LOG>=3) console.debug('[AcctDash]',...a); },
  };
  const $ = (s, r=document)=> r.querySelector(s);
  const $$= (s, r=document)=> Array.from(r.querySelectorAll(s));
  const txt = (el)=> (el?.textContent||'').trim();
  const href= (el)=> el?.getAttribute('href')||'#';
  const dom = (html)=> { const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; };
  const moneyNum = (s)=> { const v=parseFloat(String(s||'').replace(/[^0-9.\-]/g,'')); return Number.isFinite(v)?v:0; };
  const moneyFmt = (n)=> n.toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:2});
  const parseUSDate = (s)=> {
    // Accepts MM/DD/YYYY
    const m = String(s||'').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return null;
    return new Date(+m[3], +m[1]-1, +m[2]);
  };
  const nextTenthFrom = (d)=>{
    if (!(d instanceof Date)) return '';
    const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (copy.getDate() < 10) { copy.setDate(10); }
    else { copy.setMonth(copy.getMonth()+1, 10); }
    return copy.toLocaleDateString();
  };

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
  .wl-kpi .lbl{font-size:.8rem;color:#666}
  .wl-kpi .val{font-weight:700;font-size:1.05rem;margin-top:2px}
  .col-12{grid-column:span 12}.col-8{grid-column:span 8}.col-6{grid-column:span 6}.col-4{grid-column:span 4}
  @media (max-width:1024px){.col-8,.col-6,.col-4{grid-column:span 12}}
  /* Top bar with hamburger */
  .wl-top{display:flex;align-items:center;justify-content:space-between;margin:8px 0 16px}
  .wl-ham{display:inline-flex;align-items:center;gap:10px}
  .wl-ham button{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid ${BRAND.border};border-radius:10px;background:#fff;cursor:pointer;font-weight:600}
  .wl-ham-menu{display:none;position:absolute;left:8px;top:56px;z-index:1000;background:#fff;border:1px solid ${BRAND.border};border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.08);padding:8px;width:min(320px,90vw);max-height:70vh;overflow:auto}
  .wl-ham-menu a{display:block;padding:10px 12px;border-radius:8px;color:#111;text-decoration:none}
  .wl-ham-menu a:hover{background:#f5f5f5}
  /* Hide original left nav */
  .wl-hide{position:absolute !important;left:-9999px !important;width:1px !important;height:1px !important;overflow:hidden !important}
  /* Buttons row */
  .wl-cta{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
  /* Small brand touches */
  .wl-section-title{border-left:4px solid ${BRAND.primary};padding-left:8px;margin:0 0 8px;font-size:1rem;font-weight:700}
  `;
  document.head.appendChild(dom(`<style>${styles}</style>`));

  /* ---------- scrape existing values ---------- */
  const snapshot = {};
  $$('#ctl00_PageBody_AccountActivity_AccountActivityLeftColumn tr').forEach(tr=>{
    const k = txt($('th',tr)).replace(/:$/,'');
    const v = txt($('td',tr));
    snapshot[k] = v;
  });

  const last = {};
  $$('.accountActivity_r tr').forEach(tr=>{
    const k = txt($('th',tr)).replace(/:$/,'');
    const d = txt($('td:nth-child(2)',tr));
    const a = txt($('td:nth-child(3)',tr));
    if (k) last[k] = {date:d, amount:a};
  });

  const links = {
    payment:   $('#ctl00_PageBody_AccountActivity_MakePaymentLink'),
    cards:     $('#ctl00_PageBody_AccountActivity_ManageStoredCardsForNonCashCustomers'),
    jobs:      $('#JobBalancesButton'),
    statement: $('#GetInterimStatementLink'),
  };

  /* ---------- “Pay this statement” link (prefill total) ---------- */
  const stmtNetAmt = moneyNum(last['Last Statement Net Amount']?.amount);
  function buildPayStatementUrl(){
    // Prefill via your existing pay-by-invoice/utm convention if used elsewhere.
    // Safe generic prefills (adjust if you have a stricter format):
    const base = 'SelectPaymentMethod.aspx';
    const q = new URLSearchParams();
    if (stmtNetAmt>0) q.set('utm_total', stmtNetAmt.toFixed(2));
    q.set('utm_source','AccountInfo');
    q.set('utm_action','PayStatement');
    return `${base}?${q.toString()}`;
  }

  /* ---------- compute due date = next 10th from statement date ---------- */
  const stmtDate = parseUSDate(last['Last Statement Amount']?.date || last['Last Statement Net Amount']?.date);
  const stmtDue  = stmtDate ? nextTenthFrom(stmtDate) : '—';

  /* ---------- build UI skeleton ---------- */
  const acctNameRaw = txt($('.panel.panelAccountInfo .listPageHeader')) || '';
  const acctName = acctNameRaw.replace(/Account Information for/i,'').trim() || 'Your Account';

  const container = dom(`
    <div class="wl-acct-root">
      <div class="wl-top">
        <div class="wl-ham">
          <button id="wl-ham-btn" aria-expanded="false" aria-controls="wl-ham-menu">☰ Menu</button>
          <div class="wl-title">Account Overview — ${acctName}</div>
          <div id="wl-ham-menu" class="wl-ham-menu" role="menu"></div>
        </div>
        <div class="wl-actions">
          <a class="wl-btn" href="${href(links.cards)}">Manage Cards</a>
          <a class="wl-btn" href="${href(links.jobs)}">Job Balances</a>
        </div>
      </div>

      <div class="wl-grid">
        <!-- Snapshot (only two KPIs) -->
        <div class="wl-card col-6" id="wl-snapshot">
          <h3 class="wl-section-title">Account Snapshot</h3>
          <div class="wl-kpis">
            <div class="wl-kpi">
              <div class="lbl">Net Balance</div>
              <div class="val">${snapshot['Net Balance'] ?? '—'}</div>
            </div>
            <div class="wl-kpi">
              <div class="lbl">On Order</div>
              <div class="val">${snapshot['On Order'] ?? '—'}</div>
            </div>
          </div>
        </div>

        <!-- Statements (with Pay Now & Due Date) -->
        <div class="wl-card col-6" id="wl-statements">
          <h3 class="wl-section-title">Statements</h3>
          <div>
            <div class="wl-meta">Last Statement Date: <strong>${last['Last Statement Amount']?.date || '—'}</strong></div>
            <div class="wl-meta">Last Statement Amount: <strong>${last['Last Statement Amount']?.amount || '—'}</strong></div>
            <div class="wl-meta">Net Amount: <strong>${last['Last Statement Net Amount']?.amount || '—'}</strong></div>
            <div class="wl-meta">Finance Charges: <strong>${last['Last Statement Finance Charges']?.amount || '—'}</strong></div>
            <div class="wl-meta">Due Date: <strong>${stmtDue}</strong></div>
            <div class="wl-cta">
              <a class="wl-btn primary" id="wl-pay-statement" href="${buildPayStatementUrl()}">Pay This Statement</a>
              <a class="wl-btn" href="${href(links.statement)}" target="_blank" rel="noopener">Generate Interim Statement</a>
              <a class="wl-btn" href="Statements_R.aspx">View All Statements</a>
            </div>
          </div>
        </div>

        <!-- Recent Activity (Invoices + Credits merged) -->
        <div class="wl-card col-12" id="wl-activity">
          <h3 class="wl-section-title">Recent Activity</h3>
          <ul class="wl-list" data-empty="Loading…"></ul>
          <div class="wl-cta">
            <a class="wl-btn" href="Invoices_r.aspx">View Invoices</a>
            <a class="wl-btn" href="CreditNotes_r.aspx">View Credits</a>
          </div>
        </div>

        <!-- Open Orders -->
        <div class="wl-card col-12" id="wl-orders">
          <h3 class="wl-section-title">Open Orders</h3>
          <ul class="wl-list" data-empty="Loading…"></ul>
          <div class="wl-cta">
            <a class="wl-btn" href="OpenOrders_r.aspx">View All Orders</a>
          </div>
        </div>

        <!-- Recent Purchases -->
        <div class="wl-card col-12" id="wl-purchases">
          <h3 class="wl-section-title">Recent Purchases</h3>
          <ul class="wl-list" data-empty="Loading…"></ul>
          <div class="wl-cta">
            <a class="wl-btn" href="ProductsPurchased_R.aspx">View More Purchased Products</a>
          </div>
        </div>
      </div>
    </div>
  `);

  /* ---------- mount & hide legacy sections ---------- */
  const pageBody = document.querySelector('td.pageContentBody') || document.body;
  pageBody.insertBefore(container, pageBody.firstChild);

  // Hide original left nav (but keep in DOM)
  const leftNav = $('#ctl00_LeftSidebarContents_MainNav_NavigationMenu');
  if (leftNav) {
    leftNav.classList.add('wl-hide');
    // Clone into hamburger dropdown
    const menu = $('#wl-ham-menu', container);
    $$('.rmRootGroup .rmItem a', leftNav).forEach(a=>{
      const item = dom(`<a role="menuitem" href="${a.href}">${txt(a)}</a>`);
      menu.appendChild(item);
    });
    const btn = $('#wl-ham-btn', container);
    btn.addEventListener('click', ()=>{
      const open = menu.style.display === 'block';
      menu.style.display = open ? 'none' : 'block';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
    document.addEventListener('click', (e)=>{
      const menuOpen = menu.style.display === 'block';
      if (!menuOpen) return;
      if (!menu.contains(e.target) && e.target !== $('#wl-ham-btn', container)) {
        menu.style.display = 'none';
        btn.setAttribute('aria-expanded','false');
      }
    });
  }

  // Soft-hide clutter we no longer surface
  [
    '.account-aging-title',
    '#ctl00_PageBody_AgingTable_AgingGrid',
    '.documentRequest',
    '#WTAccountActivity',
    '.panel.panelAccountInfo',
  ].forEach(sel=> $$(sel).forEach(el=> { el.classList.add('wl-hide'); }));
  // Hide comm prefs & reps (if present block-level elsewhere)
  $$('#wl-comm, #wl-reps').forEach(el=> el?.classList.add('wl-hide'));

  /* ---------- data loaders (same-origin) ---------- */
  const parser = new DOMParser();
  async function fetchDoc(url){
    try{
      const res = await fetch(url,{credentials:'same-origin'});
      if (!res.ok) throw new Error('HTTP '+res.status);
      return parser.parseFromString(await res.text(),'text/html');
    }catch(e){ log.warn('Fetch failed', url, e); return null; }
  }
  function mapRows(doc, cols){
    if (!doc) return [];
    const tbl = doc.querySelector('.rgMasterTable');
    if (!tbl) return [];
    const rows = Array.from(tbl.querySelectorAll('tbody tr'));
    return rows.map(r=>{
      const o = {};
      cols.forEach(c=> o[c] = txt(r.querySelector(`td[data-title="${c}"]`)));
      const a = r.querySelector('a[href]');
      o.link = a ? new URL(a.getAttribute('href'), location.origin).toString() : null;
      return o;
    });
  }
  function renderList(ul, items, builder, empty='No items found.'){
    ul.innerHTML = '';
    if (!items.length){ ul.innerHTML = `<li><div class="wl-meta">${empty}</div></li>`; return; }
    items.forEach(it=> ul.appendChild(builder(it)));
  }

  /* Recent Activity: merge Invoices + Credits by date desc (limit 6) */
  (async function loadActivity(){
    const invDoc = await fetchDoc('Invoices_r.aspx');
    let invs = mapRows(invDoc, ['Invoice #','Date','Outstanding','Amount','Status']);
    if (!invs.length) invs = mapRows(invDoc, ['Invoice Number','Date','Outstanding','Amount','Status']);
    invs = invs.map(x=> ({
      type:'Invoice',
      id: x['Invoice #'] || x['Invoice Number'] || 'Invoice',
      date: x['Date'] || '',
      amount: x['Outstanding'] || x['Amount'] || '',
      status: x['Status'] || '',
      link: x.link || 'Invoices_r.aspx'
    }));

    const crDoc = await fetchDoc('CreditNotes_r.aspx');
    let crs = mapRows(crDoc, ['Credit #','Date','Amount','Status']);
    if (!crs.length) crs = mapRows(crDoc, ['Credit Note #','Date','Amount','Status']);
    crs = crs.map(x=> ({
      type:'Credit',
      id: x['Credit #'] || x['Credit Note #'] || 'Credit',
      date: x['Date'] || '',
      amount: x['Amount'] || '',
      status: x['Status'] || '',
      link: x.link || 'CreditNotes_r.aspx'
    }));

    const all = invs.concat(crs).map(x=>{
      const d = parseUSDate(x.date);
      return { ...x, _ts: d? d.getTime(): 0 };
    }).sort((a,b)=> b._ts - a._ts).slice(0,6);

    const ul = $('#wl-activity .wl-list', container);
    renderList(ul, all, (it)=>{
      const badge = it.type==='Credit' ? `<span class="wl-pill">Credit</span>` : `<span class="wl-pill">Invoice</span>`;
      const li = dom(`<li>
        <div>
          <div><a href="${it.link}"><strong>${it.id}</strong></a> ${badge}</div>
          <div class="wl-meta">${it.date}${it.status?` • ${it.status}`:''}</div>
        </div>
        <div><span class="wl-pill">${it.amount||''}</span></div>
      </li>`);
      return li;
    }, 'No recent activity.');
  })();

  /* Open Orders (top 5) */
  (async function loadOrders(){
    const doc = await fetchDoc('OpenOrders_r.aspx');
    const rows = mapRows(doc, ['Order #','Created','Status','Total Amount','Goods Total']).slice(0,5);
    const ul = $('#wl-orders .wl-list', container);
    renderList(ul, rows, (it)=>{
      const amt = it['Total Amount'] || it['Goods Total'] || '';
      return dom(`<li>
        <div>
          <div><a href="${it.link||'OpenOrders_r.aspx'}"><strong>${it['Order #']||'Order'}</strong></a></div>
          <div class="wl-meta">${it.Created||''}${it.Status?` • ${it.Status}`:''}</div>
        </div>
        <div><span class="wl-pill">${amt}</span></div>
      </li>`);
    }, 'No open orders.');
  })();

  /* Recent Purchases (top 10) + View Product buttons */
  (async function loadPurchases(){
    const doc = await fetchDoc('ProductsPurchased_R.aspx');
    // Try several common headings across installs
    let rows = mapRows(doc, ['Product','Description','Last Purchased','Qty','Price','Total','Product Code','Product #']);
    if (!rows.length) rows = mapRows(doc, ['Product','Description','Date','Qty','Price','Product Code','Product #']);
    rows = rows.slice(0,10);
    const ul = $('#wl-purchases .wl-list', container);
    renderList(ul, rows, (it)=>{
      const sku = it['Product Code'] || it['Product #'] || it['Product'] || '';
      const title = it['Product'] || it['Product #'] || sku || 'Product';
      const desc  = it.Description ? ` — ${it.Description}` : '';
      const when  = it['Last Purchased'] || it['Date'] || '';
      const total = it.Total || (it.Price ? `@ ${it.Price}` : '');
      const viewUrl = sku ? `Products.aspx?&searchText=${encodeURIComponent(sku)}` : 'ProductsPurchased_R.aspx';
      return dom(`<li>
        <div>
          <div><strong>${title}</strong>${desc}</div>
          <div class="wl-meta">${when}${it.Qty?` • Qty ${it.Qty}`:''}</div>
        </div>
        <div>
          ${total?`<span class="wl-pill" style="margin-right:8px">${total}</span>`:''}
          <a class="wl-btn" href="${viewUrl}">View Product</a>
        </div>
      </li>`);
    }, 'No recent purchases.');
  })();

  log.info('Account Overview (v1.3) ready');
})();

