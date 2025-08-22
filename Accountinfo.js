
/* ==========================================================
   Woodson — Account Overview Dashboard (AccountInfo_R.aspx)
   v2.1 — 3-up top row, 2-up second row, full-width purchases;
          denser spacing, brand headers, robust init
   ========================================================== */
(function(){
  'use strict';
  if (!/AccountInfo_R\.aspx/i.test(location.pathname)) return;

  /* ---------- config & utils ---------- */
  const BRAND = {
    primary: '#6b0016',
    primaryHover: '#540011',
    bgSoft: '#fbf5f6',
    border: '#e6e6e6'
  };
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const txt=(el)=> (el?.textContent||'').trim();
  const href=(el)=> el?.getAttribute('href')||'#';
  const dom=(html)=>{ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; };
  const mNum=(s)=>{ const v=parseFloat(String(s||'').replace(/[^0-9.\-]/g,'')); return Number.isFinite(v)?v:0; };
  const parseUS=(s)=>{ const m=String(s||'').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m? new Date(+m[3],+m[1]-1,+m[2]) : null; };
  const next10=(d)=>{ if(!(d instanceof Date)) return '—'; const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); (x.getDate()<10)?x.setDate(10):x.setMonth(x.getMonth()+1,10); return x.toLocaleDateString(); };

  // Wait for important elements to exist (handles slow WebForms)
  function waitFor(sel, {timeout=10000, interval=120}={}){
    return new Promise((resolve,reject)=>{
      const t0=Date.now();
      const tick=()=>{
        const el=$(sel);
        if (el) return resolve(el);
        if (Date.now()-t0>=timeout) return reject(new Error('timeout '+sel));
        setTimeout(tick, interval);
      };
      if (document.readyState==='loading'){
        document.addEventListener('DOMContentLoaded', tick, {once:true});
      } else tick();
    });
  }

  /* ---------- styles (denser, branded) ---------- */
  const styles = `
  .wl-acct-root{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif}
  .wl-row{display:grid;grid-template-columns:repeat(12,1fr);gap:12px;margin-bottom:16px}
  .wl-card{background:#fff;border:1px solid ${BRAND.border};border-radius:14px;box-shadow:0 1px 5px rgba(0,0,0,.05);overflow:hidden}
  .wl-head{background:${BRAND.primary};color:#fff;padding:10px 14px;font-weight:750;letter-spacing:.2px}
  .wl-body{padding:12px;background:${BRAND.bgSoft}}
  .wl-actions{display:flex;gap:8px;flex-wrap:wrap}
  .wl-btn{display:inline-flex;align-items:center;justify-content:center;padding:8px 12px;border-radius:9px;border:1px solid ${BRAND.border};background:#fff;text-decoration:none;color:#111;font-weight:600;line-height:1}
  .wl-btn.primary{background:${BRAND.primary};border-color:${BRAND.primary};color:#fff}
  .wl-btn.primary:hover{background:${BRAND.primaryHover};border-color:${BRAND.primaryHover}}
  .wl-btn.disabled{opacity:.55;cursor:not-allowed;pointer-events:none}
  .wl-list{margin:0;padding:0;list-style:none}
  .wl-list li{display:flex;justify-content:space-between;gap:10px;padding:10px;border-bottom:1px dashed #e7d6d9;background:#fff;border-radius:10px}
  .wl-list li + li{margin-top:6px}
  .wl-meta{font-size:.86rem;color:#5f5f5f}
  .wl-pill{display:inline-block;padding:2px 10px;border-radius:999px;background:#fff;border:1px solid #e0c7cc;font-size:.76rem;color:${BRAND.primary};font-weight:700}
  .wl-kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
  .wl-kpi{background:#fff;border:1px solid #ecd6db;border-radius:10px;padding:10px}
  .wl-kpi .lbl{font-size:.82rem;color:#6e5f61}.wl-kpi .val{font-weight:800;font-size:1.05rem;margin-top:2px;color:${BRAND.primary}}
  .col-12{grid-column:span 12}.col-8{grid-column:span 8}.col-6{grid-column:span 6}.col-4{grid-column:span 4}
  @media (max-width:1200px){.col-8,.col-6,.col-4{grid-column:span 12}}
  /* Top with hamburger + primary action */
  .wl-top{position:relative;display:flex;align-items:center;justify-content:space-between;margin:6px 0 12px}
  .wl-ham{display:inline-flex;align-items:center;gap:10px}
  .wl-title{font-size:1.2rem;font-weight:800;color:${BRAND.primary}}
  .wl-ham button{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid ${BRAND.border};border-radius:9px;background:#fff;cursor:pointer;font-weight:700;color:${BRAND.primary}}
  .wl-ham button:focus{outline:2px solid ${BRAND.primary};outline-offset:2px}
  .wl-ham-menu{position:absolute;left:8px;top:48px;z-index:1000;background:#fff;border:1px solid ${BRAND.border};border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.12);padding:8px;width:min(380px,92vw);max-height:70vh;overflow:auto;transition:max-height .25s ease, opacity .2s ease; max-height:0; opacity:0; pointer-events:none}
  .wl-ham-menu.open{max-height:70vh; opacity:1; pointer-events:auto}
  .wl-ham-menu a{display:block;padding:8px 10px;border-radius:8px;color:#111;text-decoration:none}
  .wl-ham-menu a:hover{background:${BRAND.bgSoft}}
  /* Hide original left nav + legacy blocks */
  .wl-hide{position:absolute !important;left:-9999px !important;width:1px !important;height:1px !important;overflow:hidden !important}
  `;
  document.head.appendChild(dom(`<style>${styles}</style>`));

  /* ---------- start when ready ---------- */
  init().catch(()=>{});

  async function init(){
    await waitFor('td.pageContentBody', {timeout:12000});
    await Promise.race([
      waitFor('#ctl00_PageBody_AccountActivity_AccountActivityLeftColumn', {timeout:12000}),
      waitFor('.accountActivity_r', {timeout:12000})
    ]).catch(()=>{});
    buildUI();
    loadLists();
  }

  function buildUI(){
    /* scrape essentials */
    const snapshot={}, last={};
    $$('#ctl00_PageBody_AccountActivity_AccountActivityLeftColumn tr').forEach(tr=>{
      snapshot[txt($('th',tr)).replace(/:$/,'')] = txt($('td',tr));
    });
    $$('.accountActivity_r tr').forEach(tr=>{
      const k=txt($('th',tr)).replace(/:$/,''); const d=txt($('td:nth-child(2)',tr)); const a=txt($('td:nth-child(3)',tr));
      if(k) last[k]={date:d,amount:a};
    });
    const links={
      cards:$('#CustomerCardsLink') || $('#ctl00_PageBody_AccountActivity_ManageStoredCardsForNonCashCustomers') || $('#CustomerCards'),
      jobs: $('#JobBalancesButton'),
      statement: $('#GetInterimStatementLink')
    };
    const acctName=(txt($('.panel.panelAccountInfo .listPageHeader'))||'').replace(/Account Information for/i,'').trim() || 'Your Account';

    // Pay-this-statement URL (prefill)
    const stmtNetAmt = mNum(last['Last Statement Net Amount']?.amount);
    const stmtDate   = parseUS(last['Last Statement Amount']?.date || last['Last Statement Net Amount']?.date);
    const stmtDue    = next10(stmtDate);
    const payStmtUrl = (()=> {
      const base = 'AccountPayment_r.aspx';
      const q = new URLSearchParams();
      if (stmtNetAmt>0) q.set('utm_total', stmtNetAmt.toFixed(2));
      if (stmtDate)     q.set('utm_note', `Statement ${stmtDate.toLocaleDateString()}`);
      q.set('utm_source','AccountInfo'); q.set('utm_action','PayStatement');
      return `${base}?${q.toString()}`;
    })();
    const payTopUrl = 'AccountPayment_r.aspx?utm_source=AccountInfo&utm_action=MakePayment';

    /* mount UI — EXACT LAYOUT:
       Row 1: Snapshot (4) + Settings (4) + Statements (4)
       Row 2: Recent Activity (6) + Open Orders (6)
       Row 3: Recent Purchases (12)
    */
    const container = dom(`
      <div class="wl-acct-root">
        <div class="wl-top">
          <div class="wl-ham">
            <button id="wl-ham-btn" type="button" aria-expanded="false" aria-controls="wl-ham-menu">☰ Menu</button>
            <div class="wl-title">Account Overview — ${acctName}</div>
            <div id="wl-ham-menu" class="wl-ham-menu" role="menu"></div>
          </div>
          <div class="wl-actions">
            <a class="wl-btn primary" href="${payTopUrl}">Make a Payment</a>
          </div>
        </div>

        <!-- Row 1: 3-up -->
        <div class="wl-row">
          <div class="wl-card col-4" id="wl-snapshot">
            <div class="wl-head">Account Snapshot</div>
            <div class="wl-body">
              <div class="wl-kpis">
                <div class="wl-kpi"><div class="lbl">Net Balance</div><div class="val">${snapshot['Net Balance'] ?? '—'}</div></div>
                <div class="wl-kpi"><div class="lbl">On Order</div><div class="val">${snapshot['On Order'] ?? '—'}</div></div>
              </div>
              <div class="wl-actions" style="margin-top:8px">
                <a class="wl-btn" href="${href(links.jobs)||'JobBalances_R.aspx'}">Job Balances</a>
              </div>
            </div>
          </div>

          <div class="wl-card col-4" id="wl-settings">
            <div class="wl-head">Account Settings</div>
            <div class="wl-body">
              <div class="wl-actions" style="margin-bottom:6px">
                <a class="wl-btn" href="AccountSettings.aspx">Edit Account Settings</a>
                <a class="wl-btn" href="CustomerCards.aspx">Manage Stored Cards</a>
                <a class="wl-btn" href="AddressList_R.aspx">Addresses</a>
                <a class="wl-btn" href="Contacts_r.aspx">Contacts</a>
                <a class="wl-btn" href="https://woodsonwholesaleinc.formstack.com/forms/agtimber2027" target="_blank" rel="noopener">Apply Tax Exemption</a>
                <a class="wl-btn disabled" href="#" aria-disabled="true" title="Coming soon">Edit Communication Preferences</a>
              </div>
              <div class="wl-meta">Update your profile (name, email, password), manage cards, and maintain addresses/contacts. Communication preferences coming soon.</div>
            </div>
          </div>

          <div class="wl-card col-4" id="wl-statements">
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

        <!-- Row 2: 2-up -->
        <div class="wl-row">
          <div class="wl-card col-6" id="wl-activity">
            <div class="wl-head">Recent Activity</div>
            <div class="wl-body">
              <ul class="wl-list" data-empty="Loading…"></ul>
              <div class="wl-actions" style="margin-top:8px">
                <a class="wl-btn" href="Invoices_r.aspx">View Invoices</a>
                <a class="wl-btn" href="CreditNotes_r.aspx">View Credits</a>
              </div>
            </div>
          </div>

          <div class="wl-card col-6" id="wl-orders">
            <div class="wl-head">Open Orders</div>
            <div class="wl-body">
              <ul class="wl-list" data-empty="Loading…"></ul>
              <div class="wl-actions" style="margin-top:8px">
                <a class="wl-btn" href="OpenOrders_r.aspx">View All Orders</a>
              </div>
            </div>
          </div>
        </div>

        <!-- Row 3: full-width purchases -->
        <div class="wl-row">
          <div class="wl-card col-12" id="wl-purchases">
            <div class="wl-head">Recent Purchases</div>
            <div class="wl-body">
              <ul class="wl-list" data-empty="Loading…"></ul>
              <div class="wl-actions" style="margin-top:8px">
                <a class="wl-btn" href="ProductsPurchased_R.aspx">View More Purchased Products</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    `);

    const pageBody = $('td.pageContentBody') || document.body;
    pageBody.insertBefore(container, pageBody.firstChild);

    // Hide original left nav, aging, raw blocks
    const leftNav = $('#ctl00_LeftSidebarContents_MainNav_NavigationMenu');
    if (leftNav) leftNav.classList.add('wl-hide');
    ['.account-aging-title','#ctl00_PageBody_AgingTable_AgingGrid','.documentRequest','#WTAccountActivity','.panel.panelAccountInfo']
      .forEach(sel=> $$(sel).forEach(el=> el.classList.add('wl-hide')));

    // Hamburger (no redirect)
    (function menu(){
      const btn = $('#wl-ham-btn', container);
      const menu = $('#wl-ham-menu', container);
      if (leftNav) {
        $$('.rmRootGroup .rmItem a', leftNav).forEach(a=>{
          menu.appendChild(dom(`<a role="menuitem" href="${a.href}">${txt(a)}</a>`));
        });
      } else {
        ['Invoices_r.aspx','CreditNotes_r.aspx','OpenOrders_r.aspx','Statements_R.aspx','ProductsPurchased_R.aspx','AccountPayment_r.aspx','AccountSettings.aspx','AddressList_R.aspx','Contacts_r.aspx']
          .forEach(h=> menu.appendChild(dom(`<a role="menuitem" href="${h}">${h.replace(/_r\.aspx|\.aspx/,'').replace(/_/g,' ')}</a>`)));
      }
      const toggle=(open)=>{ menu.classList.toggle('open', open); btn.setAttribute('aria-expanded', open?'true':'false'); };
      btn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); toggle(!menu.classList.contains('open')); return false; });
      document.addEventListener('click', (e)=>{ if(!menu.classList.contains('open')) return; if(!menu.contains(e.target) && e.target!==btn){ toggle(false); } });
      btn.setAttribute('onclick','return false;'); // block WebForms default submit
    })();
  }

  /* ---------- async lists ---------- */
  async function loadLists(){
    const parser=new DOMParser();
    async function fetchDoc(url){
      try{ const r=await fetch(url,{credentials:'same-origin'}); if(!r.ok) throw 0; return parser.parseFromString(await r.text(),'text/html'); }
      catch{ return null; }
    }
    function mapRows(doc, cols){
      if(!doc) return [];
      const t=doc.querySelector('.rgMasterTable'); if(!t) return [];
      return Array.from(t.querySelectorAll('tbody tr')).map(r=>{
        const o={}; cols.forEach(c=> o[c]=txt(r.querySelector(`td[data-title="${c}"]`)));
        const a=r.querySelector('a[href]'); o.link=a? new URL(a.getAttribute('href'), location.origin).toString():null;
        return o;
      });
    }
    function renderList(ul, items, builder, empty){
      if(!ul) return;
      ul.innerHTML='';
      if(!items.length){ ul.innerHTML=`<li><div class="wl-meta">${empty||'No items found.'}</div></li>`; return; }
      items.forEach(it=> ul.appendChild(builder(it)));
    }

    // Recent Activity: Invoices + Credits merged, newest first, limit 6
    (async ()=>{
      const invDoc=await fetchDoc('Invoices_r.aspx');
      let invs=mapRows(invDoc,['Invoice #','Date','Outstanding','Amount','Status']); if(!invs.length) invs=mapRows(invDoc,['Invoice Number','Date','Outstanding','Amount','Status']);
      invs=invs.map(x=>({type:'Invoice',id:x['Invoice #']||x['Invoice Number']||'Invoice',date:x['Date']||'',amount:x['Outstanding']||x['Amount']||'',status:x['Status']||'',link:x.link||'Invoices_r.aspx'}));

      const crDoc=await fetchDoc('CreditNotes_r.aspx');
      let crs=mapRows(crDoc,['Credit #','Date','Amount','Status']); if(!crs.length) crs=mapRows(crDoc,['Credit Note #','Date','Amount','Status']);
      crs=crs.map(x=>({type:'Credit',id:x['Credit #']||x['Credit Note #']||'Credit',date:x['Date']||'',amount:x['Amount']||'',status:x['Status']||'',link:x.link||'CreditNotes_r.aspx'}));

      const all=invs.concat(crs).map(x=>({ ...x, _ts:(parseUS(x.date)||new Date(0)).getTime() }))
        .sort((a,b)=> b._ts-a._ts).slice(0,6);

      const ul=$('#wl-activity .wl-list');
      renderList(ul, all, it=> dom(`<li>
        <div>
          <div><a href="${it.link}"><strong>${it.id}</strong></a> <span class="wl-pill">${it.type}</span></div>
          <div class="wl-meta">${it.date}${it.status?` • ${it.status}`:''}</div>
        </div>
        <div><span class="wl-pill">${it.amount||''}</span></div>
      </li>`), 'No recent activity.');
    })();

    // Open Orders: top 5
    (async ()=>{
      const doc=await fetchDoc('OpenOrders_r.aspx');
      const rows=mapRows(doc,['Order #','Created','Status','Total Amount','Goods Total']).slice(0,5);
      const ul=$('#wl-orders .wl-list');
      renderList(ul, rows, it=> dom(`<li>
        <div>
          <div><a href="${it.link||'OpenOrders_r.aspx'}"><strong>${it['Order #']||'Order'}</strong></a></div>
          <div class="wl-meta">${it.Created||''}${it.Status?` • ${it.Status}`:''}</div>
        </div>
        <div><span class="wl-pill">${it['Total Amount']||it['Goods Total']||''}</span></div>
      </li>`), 'No open orders.');
    })();

    // Recent Purchases: top 10 + link to Products.aspx?searchText=SKU
    (async ()=>{
      const doc=await fetchDoc('ProductsPurchased_R.aspx');
      let rows=mapRows(doc,['Product','Description','Last Purchased','Qty','Price','Total','Product Code','Product #']);
      if(!rows.length) rows=mapRows(doc,['Product','Description','Date','Qty','Price','Product Code','Product #']);
      rows=rows.slice(0,10);
      const ul=$('#wl-purchases .wl-list');
      renderList(ul, rows, it=>{
        const sku=it['Product Code']||it['Product #']||it['Product']||'';
        const title=it['Product']||it['Product #']||sku||'Product';
        const desc =it.Description?` — ${it.Description}`:'';
        const when=it['Last Purchased']||it['Date']||'';
        const total=it.Total||(it.Price?`@ ${it.Price}`:'');
        const view=`Products.aspx?&searchText=${encodeURIComponent(sku)}`;
        return dom(`<li>
          <div>
            <div><strong>${title}</strong>${desc}</div>
            <div class="wl-meta">${when}${it.Qty?` • Qty ${it.Qty}`:''}</div>
          </div>
          <div>
            ${total?`<span class="wl-pill" style="margin-right:8px">${total}</span>`:''}
            <a class="wl-btn" href="${view}">View Product</a>
          </div>
        </li>`);
      }, 'No recent purchases.');
    })();
  }
})();

