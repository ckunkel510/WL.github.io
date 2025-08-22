
/* ==========================================================
   Woodson — Account Overview Dashboard (AccountInfo_R.aspx)
   v1.0  (vanilla JS, no deps)
   - Replaces legacy table view with card-based dashboard
   - Scrapes on-page figures; same-origin fetch for “recent”
   - Safe for WebForms (no tampering with __doPostBack)
   ========================================================== */
(function(){
  'use strict';
  if (!/AccountInfo_R\.aspx/i.test(location.pathname)) return;

  /* ---------- tiny logger ---------- */
  const LOG = 2; // 0=errors,1=warn,2=info,3=debug
  const log = {
    error: (...a)=>{ if (LOG>=0) console.error('[AcctDash]',...a); },
    warn:  (...a)=>{ if (LOG>=1) console.warn ('[AcctDash]',...a); },
    info:  (...a)=>{ if (LOG>=2) console.info ('[AcctDash]',...a); },
    debug: (...a)=>{ if (LOG>=3) console.debug('[AcctDash]',...a); },
  };

  /* ---------- helpers ---------- */
  const $    = (sel,root=document)=> root.querySelector(sel);
  const $$   = (sel,root=document)=> Array.from(root.querySelectorAll(sel));
  const txt  = (el)=> (el?.textContent||'').trim();
  const href = (el)=> el?.getAttribute('href')||'#';
  const moneyNum = (s)=> {
    const v = parseFloat(String(s||'').replace(/[^0-9.\-]/g,''));
    return Number.isFinite(v) ? v : 0;
  };
  const moneyFmt = (n)=> n.toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:2});
  const dom = (html)=> {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };
  const safeCopyAnchor = (a, label)=> {
    if (!a) return dom(`<a class="btn btn-primary text-white" href="#">${label||'Open'}</a>`);
    const c = document.createElement('a');
    c.className = 'wl-btn';
    c.href = a.href;
    c.target = a.target || '_self';
    c.rel = 'noopener';
    c.textContent = label || txt(a) || 'Open';
    return c;
  };

  /* ---------- inject styles ---------- */
  const styles = `
  .wl-acct-root{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif}
  .wl-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:16px}
  .wl-row{margin:12px 0}
  .wl-card{background:#fff;border:1px solid #e6e6e6;border-radius:16px;box-shadow:0 1px 2px rgba(0,0,0,.05);padding:16px}
  .wl-card h3{font-size:1rem;margin:0 0 8px;font-weight:650}
  .wl-card h4{font-size:.95rem;margin:0 0 8px;font-weight:600}
  .wl-kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
  .wl-kpi{background:#fafafa;border:1px solid #eee;border-radius:12px;padding:12px}
  .wl-kpi .lbl{font-size:.8rem;color:#666}
  .wl-kpi .val{font-weight:700;font-size:1.05rem;margin-top:2px}
  .wl-actions{display:flex;flex-wrap:wrap;gap:8px}
  .wl-btn{display:inline-flex;align-items:center;justify-content:center;padding:8px 12px;border-radius:10px;border:1px solid #d9d9d9;background:#f8f8f8;text-decoration:none;color:#111;font-weight:600}
  .wl-btn.primary{background:#1f6feb;border-color:#1f6feb;color:#fff}
  .wl-list{margin:0;padding:0;list-style:none}
  .wl-list li{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #f0f0f0}
  .wl-list li:last-child{border-bottom:none}
  .wl-list .meta{font-size:.85rem;color:#666}
  .wl-pill{display:inline-block;padding:2px 8px;border-radius:999px;border:1px solid #e0e0e0;font-size:.75rem;color:#444;background:#fafafa}
  .wl-aging{display:flex;flex-direction:column;gap:8px}
  .wl-bar{display:flex;align-items:center;gap:8px}
  .wl-bar .label{min-width:64px;font-size:.85rem;color:#555}
  .wl-bar .track{flex:1;height:10px;border-radius:999px;background:#efefef;overflow:hidden}
  .wl-bar .fill{height:100%}
  .wl-note{font-size:.85rem;color:#666}
  .wl-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .wl-stack{display:flex;flex-direction:column;gap:8px}
  .wl-mini{font-size:.9rem}
  .wl-muted{color:#666}
  .wl-right{margin-left:auto}
  .wl-cta-row{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 0}
  /* layout columns */
  .col-12{grid-column:span 12}
  .col-9{grid-column:span 9}
  .col-8{grid-column:span 8}
  .col-6{grid-column:span 6}
  .col-4{grid-column:span 4}
  .col-3{grid-column:span 3}
  .col-2{grid-column:span 2}
  /* Header */
  .wl-top{display:flex;align-items:center;justify-content:space-between;margin:8px 0 16px}
  .wl-title{font-size:1.25rem;font-weight:750}
  .wl-top .wl-actions{gap:10px}
  /* Rep & Contact */
  .wl-contact dt{font-weight:600}
  .wl-contact dd{margin:0 0 6px}
  /* Footer note */
  .wl-foot{font-size:.82rem;color:#666;margin-top:6px}
  /* Mobile sticky action bar */
  .wl-stick{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid #e6e6e6;padding:10px;display:none;gap:8px;z-index:999}
  .wl-stick .wl-btn{flex:1}
  /* Left nav collapse */
  .wl-nav-toggle{position:sticky;top:8px;display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer;font-size:.85rem}
  .wl-left-collapsed #ctl00_LeftSidebarContents_MainNav_NavigationMenu{width:40px;overflow:hidden}
  .wl-left-collapsed #ctl00_LeftSidebarContents_MainNav_NavigationMenu .rmText{display:none}
  .wl-left-collapsed .wl-nav-toggle .label{display:none}
  /* Responsive */
  @media (max-width: 1024px){
    .wl-kpis{grid-template-columns:1fr}
    .col-9{grid-column:span 12}
    .col-8{grid-column:span 12}
    .col-6{grid-column:span 12}
    .col-4{grid-column:span 12}
    .col-3{grid-column:span 12}
    .col-2{grid-column:span 6}
  }
  @media (max-width: 768px){
    .wl-stick{display:flex}
    .wl-top .wl-actions{display:none}
  }
  `;
  document.head.appendChild(dom(`<style>${styles}</style>`));

  /* ---------- extract data from current page ---------- */
  const data = {
    snapshot:{}, last:{}, links:{}, address:[], contact:{}, reps:[], aging:[],
    acctName: txt($('.panel.panelAccountInfo .listPageHeader'))?.replace('Account Information for','').trim() || 'Your Account'
  };

  // Address
  $$('.accountInfoAddress li').forEach(li=> data.address.push(txt(li)));

  // Contact
  data.contact.tel = txt($('#ctl00_PageBody_TelephoneLink_TelephoneLink'));
  data.contact.telHref = href($('#ctl00_PageBody_TelephoneLink_TelephoneLink'));
  data.contact.fax = (()=>{
    const tr = $$('table.contactInfo tr').find(r=> /Fax/i.test(txt($('th',r))));
    return tr ? txt($('td',tr)) : '';
  })();
  data.contact.person = (()=>{
    const tr = $$('table.contactInfo tr').find(r=> /Contact/i.test(txt($('th',r))));
    return tr ? txt($('td',tr)) : '';
  })();

  // Sales reps
  const repRows = $$('#ctl00_PageBody_lstSalesReps table tr');
  repRows.forEach(r=>{
    const tds = $$('td',r);
    if (!tds.length) return;
    const contact = txt(tds[0]).replace(/^Contact:\s*/,'');
    const tel = txt(tds[1]||{}).replace(/^Tel:\s*/,'');
    const mobile = txt(tds[2]||{}).replace(/^Mobile:\s*/,'');
    const email = (tds[3] ? txt(tds[3]).replace(/^Email:\s*/,'') : '');
    const telA = $('a[href^="tel:"]', tds[1]||document);
    const mobA = $('a[href^="tel:"]', tds[2]||document);
    const emA  = $('a[href^="mailto:"]', tds[3]||document);
    data.reps.push({
      contact, tel, mobile, email,
      telHref: href(telA), mobileHref: href(mobA), emailHref: href(emA)
    });
  });

  // Snapshot left column
  $$('#ctl00_PageBody_AccountActivity_AccountActivityLeftColumn tr').forEach(tr=>{
    const k = txt($('th',tr)).replace(/:$/,'');
    const v = txt($('td',tr));
    data.snapshot[k] = v;
  });

  // Last activity right column
  $$('.accountActivity_r tr').forEach(tr=>{
    const k = txt($('th',tr)).replace(/:$/,'');
    const d = txt($('td:nth-child(2)',tr));
    const a = txt($('td:nth-child(3)',tr));
    if (k) data.last[k] = {date:d, amount:a};
  });

  // Links
  data.links.payment   = $('#ctl00_PageBody_AccountActivity_MakePaymentLink');
  data.links.cards     = $('#ctl00_PageBody_AccountActivity_ManageStoredCardsForNonCashCustomers');
  data.links.jobs      = $('#JobBalancesButton');
  data.links.statement = $('#GetInterimStatementLink');

  // Aging
  $$('#ctl00_PageBody_AgingTable_AgingGrid_ctl00 tbody tr').forEach(r=>{
    const row = {
      bucket: txt($('td[data-title="Overdue"]',r)),
      count:  moneyNum(txt($('td[data-title="No. of Transactions"]',r))),
      value:  moneyNum(txt($('td[data-title="Value of Transactions"]',r))),
      pct:    txt($('td[data-title="% of Transactions"]',r))
    };
    if (row.bucket) data.aging.push(row);
  });

  log.debug('Extracted', data);

  /* ---------- build container ---------- */
  const container = dom(`
    <div class="wl-acct-root">
      <div class="wl-top">
        <div class="wl-title">Account Overview — ${data.acctName}</div>
        <div class="wl-actions">
          <a class="wl-btn primary" href="${href(data.links.payment)}">Make a Payment</a>
          <a class="wl-btn" href="${href(data.links.cards)}">Manage Stored Cards</a>
          <a class="wl-btn" href="${href(data.links.jobs)}">Job Balances</a>
        </div>
      </div>

      <div class="wl-grid wl-row">
        <!-- Snapshot -->
        <div class="wl-card col-8" id="wl-snapshot">
          <h3>Account Snapshot</h3>
          <div class="wl-kpis">
            ${['Open Invoices','On Order','Credit Limit','Unapplied Cash','Unapplied Credits','Net Balance','Amount Owing','Available Credit'].map(k=>{
              const v = data.snapshot[k] ?? '';
              const n = moneyNum(v);
              const cls = (k==='Available Credit' && n>0) ? 'style="background:#f0faf0;border-color:#dcefe0"' :
                          (k==='Open Invoices' && n>0) ? 'style="background:#fff7f7;border-color:#ffe0e0"' : '';
              return `
                <div class="wl-kpi" ${cls}>
                  <div class="lbl">${k}</div>
                  <div class="val">${v||'-'}</div>
                </div>`;
            }).join('')}
          </div>
          <div class="wl-cta-row">
            <a class="wl-btn primary" href="${href(data.links.payment)}">Pay Now</a>
            <a class="wl-btn" href="${href(data.links.statement)}" target="_blank" rel="noopener">Generate Interim Statement</a>
          </div>
          <div class="wl-foot wl-note">Net Balance = Balance – unapplied cash/credits. Amount Owing = Net Balance – settlement discounts.</div>
        </div>

        <!-- Recent Invoices -->
        <div class="wl-card col-4" id="wl-recent-invoices">
          <h3>Recent Invoices</h3>
          <ul class="wl-list" data-empty="Loading…"></ul>
          <div class="wl-cta-row">
            <a class="wl-btn" href="Invoices_r.aspx">View All Invoices</a>
          </div>
        </div>

        <!-- Recent Credits -->
        <div class="wl-card col-4" id="wl-recent-credits">
          <h3>Recent Credits</h3>
          <ul class="wl-list" data-empty="Loading…"></ul>
          <div class="wl-cta-row">
            <a class="wl-btn" href="CreditNotes_r.aspx">View All Credits</a>
          </div>
        </div>

        <!-- Recent Orders -->
        <div class="wl-card col-8" id="wl-recent-orders">
          <h3>Recent Orders</h3>
          <ul class="wl-list" data-empty="Loading…"></ul>
          <div class="wl-cta-row">
            <a class="wl-btn" href="OpenOrders_r.aspx">View All Orders</a>
          </div>
        </div>

        <!-- Statements -->
        <div class="wl-card col-6" id="wl-statements">
          <h3>Statements</h3>
          <div class="wl-two">
            <div class="wl-stack">
              <div><span class="wl-muted">Last Statement:</span> ${data.last['Last Statement Amount']?.date || '—'}</div>
              <div><span class="wl-muted">Amount:</span> ${data.last['Last Statement Amount']?.amount || '—'}</div>
              <div><span class="wl-muted">Net Amount:</span> ${data.last['Last Statement Net Amount']?.amount || '—'}</div>
              <div><span class="wl-muted">Finance Charges:</span> ${data.last['Last Statement Finance Charges']?.amount || '—'}</div>
            </div>
            <div class="wl-stack">
              <a class="wl-btn primary" href="${href(data.links.statement)}" target="_blank" rel="noopener">Generate Interim Statement</a>
              <a class="wl-btn" href="Statements_R.aspx">All Statements</a>
            </div>
          </div>
        </div>

        <!-- Aging -->
        <div class="wl-card col-6" id="wl-aging">
          <h3>Account Aging</h3>
          <div class="wl-aging"></div>
        </div>

        <!-- Address & Contact -->
        <div class="wl-card col-6" id="wl-contact">
          <h3>Contact & Address</h3>
          <div class="wl-two">
            <div>
              <h4>Billing/Primary Address</h4>
              <div class="wl-mini">${data.address.length ? data.address.map(a=>a).join('<br>') : '—'}</div>
            </div>
            <div>
              <h4>Account Contact</h4>
              <dl class="wl-contact wl-mini">
                <dt>Name</dt><dd>${data.contact.person||'—'}</dd>
                <dt>Phone</dt><dd>${data.contact.tel ? `<a href="${data.contact.telHref}">${data.contact.tel}</a>`:'—'}</dd>
                <dt>Fax</dt><dd>${data.contact.fax||'—'}</dd>
              </dl>
              <div class="wl-cta-row">
                <a class="wl-btn" href="Contacts_r.aspx">Update Contacts</a>
                <a class="wl-btn" href="AddressList_R.aspx">Manage Addresses</a>
              </div>
            </div>
          </div>
        </div>

        <!-- Sales Reps -->
        <div class="wl-card col-6" id="wl-reps">
          <h3>Assigned Sales Rep(s)</h3>
          <ul class="wl-list">
            ${data.reps.length ? data.reps.map(r=>`
              <li>
                <div>
                  <div><strong>${r.contact||'—'}</strong></div>
                  <div class="meta">
                    ${r.tel ? `<a href="${r.telHref}">Tel ${r.tel}</a>`:''}
                    ${r.mobile ? ` &nbsp;•&nbsp; <a href="${r.mobileHref}">Mobile ${r.mobile}</a>`:''}
                    ${r.email ? ` &nbsp;•&nbsp; <a href="${r.emailHref}">${r.email}</a>`:''}
                  </div>
                </div>
              </li>
            `).join('') : `<li><div class="meta">No reps listed.</div></li>`}
          </ul>
        </div>

        <!-- Recent Purchases (placeholder + fetch) -->
        <div class="wl-card col-12" id="wl-recent-purchases">
          <h3>Recent Purchases</h3>
          <ul class="wl-list" data-empty="Loading…"></ul>
          <div class="wl-cta-row">
            <a class="wl-btn" href="ProductsPurchased_R.aspx">View All Purchased Products</a>
          </div>
        </div>

        <!-- Communication Preferences (future-ready, saved locally for now) -->
        <div class="wl-card col-12" id="wl-comm">
          <h3>Communication Preferences</h3>
          <div class="wl-two">
            <div class="wl-stack">
              <label><input type="checkbox" id="wl-comm-acct"> Account notices (email)</label>
              <label><input type="checkbox" id="wl-comm-marketing"> Marketing emails</label>
              <label><input type="checkbox" id="wl-comm-sms"> SMS updates</label>
              <div class="wl-foot">These toggles are saved on this device for now. We’ll wire to your account when backend is ready.</div>
            </div>
            <div class="wl-stack">
              <a class="wl-btn" href="CustomerNotepad_r.aspx">Account Notes</a>
              <a class="wl-btn" href="UploadedFiles.aspx">Uploaded Files</a>
              <a class="wl-btn" href="ETraining.aspx">eTraining</a>
            </div>
          </div>
        </div>
      </div>

      <!-- Mobile sticky actions -->
      <div class="wl-stick">
        <a class="wl-btn primary" href="${href(data.links.payment)}">Pay</a>
        <a class="wl-btn" href="${href(data.links.cards)}">Cards</a>
        <a class="wl-btn" href="Invoices_r.aspx">Invoices</a>
        <a class="wl-btn" href="OpenOrders_r.aspx">Orders</a>
      </div>
    </div>
  `);

  /* ---------- left nav collapse toggle (optional) ---------- */
  const leftNav = $('#ctl00_LeftSidebarContents_MainNav_NavigationMenu');
  if (leftNav && leftNav.parentElement) {
    const toggle = dom(`<button class="wl-nav-toggle" type="button" aria-pressed="false" title="Collapse/expand menu">
       <span class="chev">⟨⟩</span> <span class="label">Collapse menu</span>
     </button>`);
    leftNav.parentElement.insertBefore(toggle, leftNav);
    toggle.addEventListener('click', ()=>{
      document.body.classList.toggle('wl-left-collapsed');
      toggle.setAttribute('aria-pressed', document.body.classList.contains('wl-left-collapsed')?'true':'false');
    });
  }

  /* ---------- aging bars ---------- */
  const agingWrap = $('.wl-aging', container);
  (function renderAging(){
    const maxVal = Math.max(1, ...data.aging.map(a=>a.value||0));
    data.aging.forEach(a=>{
      const w = Math.round((a.value/maxVal)*100);
      const fill = dom(`<div class="fill"></div>`);
      // simple color cue by bucket
      let bg = '#dbeafe'; // blue
      if (/31/.test(a.bucket)) bg = '#fde68a'; // amber
      if (/61|90/.test(a.bucket)) bg = '#fca5a5'; // red-ish
      if (/181/.test(a.bucket)) bg = '#ef4444'; // deeper red
      fill.style.background = bg;
      fill.style.width = w+'%';

      const bar = dom(`
        <div class="wl-bar">
          <div class="label">${a.bucket}</div>
          <div class="track"></div>
          <div class="val">${moneyFmt(a.value||0)}</div>
        </div>`);
      $('.track',bar).appendChild(fill);
      agingWrap.appendChild(bar);
    });
    if (!data.aging.length) {
      agingWrap.appendChild(dom(`<div class="wl-note">No aging data.</div>`));
    }
  })();

  /* ---------- communication prefs (local) ---------- */
  const COMM_KEY='wl_comm_prefs_v1';
  const commEl = {
    acct: $('#wl-comm-acct', container),
    mkt:  $('#wl-comm-marketing', container),
    sms:  $('#wl-comm-sms', container),
  };
  try{
    const saved = JSON.parse(localStorage.getItem(COMM_KEY)||'{}');
    commEl.acct.checked = !!saved.acct;
    commEl.mkt.checked  = !!saved.mkt;
    commEl.sms.checked  = !!saved.sms;
  }catch{}
  const saveComm = ()=> {
    const v = {acct:commEl.acct.checked, mkt:commEl.mkt.checked, sms:commEl.sms.checked};
    try{ localStorage.setItem(COMM_KEY, JSON.stringify(v)); }catch{}
  };
  Object.values(commEl).forEach(inp=> inp?.addEventListener('change', saveComm));

  /* ---------- recent lists via same-origin fetch (robust fallback) ---------- */
  const parser = new DOMParser();
  async function fetchList(url, mapFn){
    try{
      const res = await fetch(url, {credentials:'same-origin'});
      if (!res.ok) throw new Error('HTTP '+res.status);
      const html = await res.text();
      const doc  = parser.parseFromString(html,'text/html');
      return mapFn(doc);
    }catch(e){
      log.warn('Fetch list failed', url, e);
      return [];
    }
  }

  function mapRadGridRows(doc, wantedTitles){
    const tbl = doc.querySelector('.rgMasterTable');
    if (!tbl) return [];
    const rows = Array.from(tbl.querySelectorAll('tbody tr')).slice(0,5);
    return rows.map(r=>{
      const obj = {};
      wantedTitles.forEach(t=>{
        obj[t] = txt(r.querySelector(`td[data-title="${t}"]`));
      });
      const a = r.querySelector('a[href]');
      obj.link = a ? new URL(a.getAttribute('href'), location.origin).toString() : null;
      return obj;
    }).filter(o=>Object.keys(o).length>0);
  }

  function renderList(ul, items, builder){
    ul.innerHTML = '';
    if (!items.length){
      ul.innerHTML = `<li><div class="meta">${ul.getAttribute('data-empty')||'No items found.'}</div></li>`;
      return;
    }
    items.forEach(it=> ul.appendChild(builder(it)));
  }

  // Recent Invoices
  const invUL = $('#wl-recent-invoices .wl-list', container);
  fetchList('Invoices_r.aspx', (doc)=> mapRadGridRows(doc, ['Invoice #','Date','Outstanding','Amount','Status']))
  .then(items=>{
    renderList(invUL, items, (it)=>{
      const li = dom(`<li>
        <div>
          <div><a href="${it.link||'Invoices_r.aspx'}"><strong>${it['Invoice #']||'Invoice'}</strong></a></div>
          <div class="meta">${it.Date||''} &nbsp;•&nbsp; ${it.Status||''}</div>
        </div>
        <div class="right"><span class="wl-pill">${it.Outstanding ? ('Owes '+it.Outstanding) : (it.Amount||'')}</span></div>
      </li>`);
      return li;
    });
  });

  // Recent Credits
  const crUL = $('#wl-recent-credits .wl-list', container);
  fetchList('CreditNotes_r.aspx', (doc)=> mapRadGridRows(doc, ['Credit #','Date','Amount','Status']))
  .then(items=>{
    // Some sites use "Credit Note #" vs "Credit #"; normalize
    if (!items.length){
      return fetchList('CreditNotes_r.aspx', (doc)=> mapRadGridRows(doc, ['Credit Note #','Date','Amount','Status']));
    }
    return items;
  })
  .then(items=>{
    renderList(crUL, Array.isArray(items)?items:[], (it)=>{
      const id = it['Credit #'] || it['Credit Note #'] || 'Credit';
      const li = dom(`<li>
        <div>
          <div><a href="${it.link||'CreditNotes_r.aspx'}"><strong>${id}</strong></a></div>
          <div class="meta">${it.Date||''} &nbsp;•&nbsp; ${it.Status||''}</div>
        </div>
        <div class="right"><span class="wl-pill">${it.Amount||''}</span></div>
      </li>`);
      return li;
    });
  });

  // Recent Orders
  const ordUL = $('#wl-recent-orders .wl-list', container);
  fetchList('OpenOrders_r.aspx', (doc)=> mapRadGridRows(doc, ['Order #','Created','Status','Goods Total','Total Amount']))
  .then(items=>{
    renderList(ordUL, items, (it)=>{
      const amt = it['Total Amount'] || it['Goods Total'] || '';
      const li = dom(`<li>
        <div>
          <div><a href="${it.link||'OpenOrders_r.aspx'}"><strong>${it['Order #']||'Order'}</strong></a></div>
          <div class="meta">${it.Created||''} &nbsp;•&nbsp; ${it.Status||''}</div>
        </div>
        <div class="right"><span class="wl-pill">${amt}</span></div>
      </li>`);
      return li;
    });
  });

  // Recent Purchases
  const purUL = $('#wl-recent-purchases .wl-list', container);
  fetchList('ProductsPurchased_R.aspx', (doc)=> {
    // Columns vary; try common titles
    let rows = mapRadGridRows(doc, ['Product','Description','Last Purchased','Qty','Price','Total','Product Code','Product #']);
    if (!rows.length) rows = mapRadGridRows(doc, ['Product','Description','Date','Qty','Price','Product Code']);
    return rows;
  })
  .then(items=>{
    renderList(purUL, items, (it)=>{
      const title = it.Product || it['Product #'] || it['Product Code'] || 'Product';
      const desc  = it.Description ? ` — ${it.Description}` : '';
      const when  = it['Last Purchased'] || it['Date'] || '';
      const total = it.Total || (it.Price ? `@ ${it.Price}` : '');
      const li = dom(`<li>
        <div>
          <div><strong>${title}</strong>${desc}</div>
          <div class="meta">${when}${it.Qty?` &nbsp;•&nbsp; Qty ${it.Qty}`:''}</div>
        </div>
        <div class="right"><span class="wl-pill">${total||''}</span></div>
      </li>`);
      return li;
    });
  });

  /* ---------- mount + hide legacy blocks (but keep in DOM) ---------- */
  const pageBody = document.querySelector('td.pageContentBody') || document.body;
  // Insert our dashboard at top
  pageBody.insertBefore(container, pageBody.firstChild);

  // Soft-hide legacy content blocks that clutter UI (keep for scraping/postbacks)
  [
    '.panel.panelAccountInfo',     // old title/table wrappers
    '#WTAccountActivity',          // raw account activity layout
    '.account-aging-title',        // old aging section titles
    '#ctl00_PageBody_AgingTable_AgingGrid', // raw aging grid
    '.documentRequest',            // raw interim statement section below
  ].forEach(sel=>{
    $$(sel).forEach(el=> { el.style.position='absolute'; el.style.left='-9999px'; el.style.width='1px'; el.style.height='1px'; el.setAttribute('aria-hidden','true'); });
  });

  log.info('Account Overview dashboard ready');
})();
