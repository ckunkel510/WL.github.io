
/* =========================================================
   Woodson — Invoices UI Enhancer
   - Invoices_r.aspx (list): card UI + keep checkboxes
   - Paid/Open badge via AccountPayment_r.aspx (all pages)
   - Lazy inline details preview
   - Invoice details page header actions
   - Back-to-My-Account button
   ========================================================= */

(function(){
  const t0 = performance.now();
  const log  = (...a)=>console.log('%cINV','color:#005d6e;font-weight:700;',`[+${(performance.now()-t0).toFixed(1)}ms]`,...a);
  const warn = (...a)=>console.warn('%cINV','color:#b45309;font-weight:700;',`[+${(performance.now()-t0).toFixed(1)}ms]`,...a);

  /* ---------------------------
     Back to My Account button
     --------------------------- */
  (function backBtn(){
    if (window.__WL_BACKBTN_DONE__) return;
    window.__WL_BACKBTN_DONE__ = true;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', backBtn, { once:true });
      return;
    }
    const panel = document.getElementById("ctl00_PageBody_Panel1");
    if (!panel) return;
    const back = document.createElement('a');
    back.href = "https://webtrack.woodsonlumber.com/AccountInfo_R.aspx";
    back.textContent = "← Back to My Account";
    Object.assign(back.style, {
      display: "inline-block", marginBottom: "12px", padding: "8px 14px",
      background: "#6b0016", color: "#fff", borderRadius: "6px",
      textDecoration: "none", fontWeight: "bold"
    });
    back.addEventListener('mouseover', ()=> back.style.background="#8d8d8d");
    back.addEventListener('mouseout',  ()=> back.style.background="#6b0016");
    panel.parentNode.insertBefore(back, panel);
  })();

  /* --------------------------------------------------------
     Shared: Build AccountPayment index (Doc# -> status)
     -------------------------------------------------------- */
  if (!window.__WL_AP_INDEX_PROMISE__){
    window.__WL_AP_INDEX_PROMISE__ = (async function buildAccountsIndex(){
      try{
        const index = new Map(); // docNo -> { outstanding:number, type:string }
        const base = '/AccountPayment_r.aspx';
        const fetchText = (u)=>fetch(u, { credentials:'same-origin' }).then(r=>r.text());

        const parsePage = (html) => {
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const tbl = doc.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00, .rgMasterTable');
          const items = [];
          if (tbl){
            tbl.querySelectorAll('tbody > tr').forEach(tr=>{
              const grab = (sel)=>{ const el = tr.querySelector(sel); return el ? el.textContent.trim() : ''; };
              const type = grab('td[data-title="Type"]');
              const docNo = grab('span[id*="_DocumentNumber"]');
              const outstandingTxt = grab('td[data-title="Amount Outstanding"]');
              const outVal = parseFloat((outstandingTxt||'').replace(/[^0-9.\-]/g,''));
              if (docNo) items.push({ type, docNo, outstanding: isFinite(outVal)? outVal : 0 });
            });
            items.forEach(x=> index.set(x.docNo, { outstanding:x.outstanding, type:x.type }));
          }
          return { doc, index };
        };

        const firstHTML = await fetchText(base).catch(()=>null);
        if (!firstHTML) return index;
        const firstParsed = parsePage(firstHTML);

        // find pager links with pageIndex=...
        const pager = firstParsed.doc && firstParsed.doc.querySelector('ul.pagination');
        const hrefs = new Set();
        if (pager){
          pager.querySelectorAll('a.page-link[href*="pageIndex="]').forEach(a=>{
            try{
              const u = new URL(a.getAttribute('href'), location.origin);
              hrefs.add(u.pathname + '?' + u.searchParams.toString());
            }catch{}
          });
        }
        // fetch unique pages other than the landing page
        const tasks = [];
        for (const h of hrefs){
          if (h === '/AccountPayment_r.aspx') continue;
          tasks.push(fetchText(h).then(html=>parsePage(html)).catch(()=>null));
        }
        const results = await Promise.allSettled(tasks);
        results.forEach(r=>{
          if (r.status==='fulfilled' && r.value && r.value.index){
            r.value.index.forEach((v,k)=> index.set(k,v));
          }
        });

        log('AccountPayment index size:', index.size);
        return index;
      }catch(ex){
        warn('AccountPayment crawl failed', ex);
        return new Map();
      }
    })();
  }
  const getAccountIndex = ()=>window.__WL_AP_INDEX_PROMISE__;

  /* ============================================
     PART A — Invoices_r.aspx (LIST ENHANCER)
     ============================================ */
  (function listEnhancer(){
    if (!/Invoices_r\.aspx/i.test(location.pathname)) return;
    if (window.__WL_INVOICES_LIST__) return;
    window.__WL_INVOICES_LIST__ = true;

    // CSS
    (function injectCSS(){
      const css = document.createElement('style');
      css.textContent = `
        /* Keep first header (Select All), hide others */
        #ctl00_PageBody_InvoicesGrid thead th:not(:first-child),
        .RadGrid[id*="InvoicesGrid"] thead th:not(:first-child){ display:none !important; }

        /* Cardify rows but keep first td (checkbox) visible and clickable */
        .wl-inv-cardify tr.rgRow, .wl-inv-cardify tr.rgAltRow{
          display:block; background:#fff; border:1px solid #e5e7eb; border-radius:16px;
          margin:12px 0; box-shadow:0 6px 18px rgba(0,0,0,.05); overflow:hidden; position:relative
        }
        .wl-inv-cardify tr.rgRow > td, .wl-inv-cardify tr.rgAltRow > td{
          display:none !important;
        }
        .wl-inv-cardify tr.rgRow > td:first-child,
        .wl-inv-cardify tr.rgAltRow > td:first-child{
          display:block !important; position:absolute; left:10px; top:12px;
          background:transparent; border:none !important; padding:0 0 0 0 !important;
        }

        .wl-row-head{
          display:grid; gap:8px; padding:14px 14px 12px 46px; align-items:center;
          grid-template-columns: 1fr auto;
        }
        .wl-head-left{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .wl-head-right{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:flex-end; }

        .wl-inv-no{ font-weight:900; font-size:16px; letter-spacing:.2px; }
        @media (min-width:1024px){ .wl-inv-no{ font-size:18px; } }

        .wl-chip{ display:inline-flex; align-items:center; gap:6px; font-weight:800; border-radius:999px; padding:6px 10px; font-size:12px; }
        .wl-chip--slate{ background:#e2e8f0; color:#0f172a; }
        .wl-chip--green{ background:#dcfce7; color:#065f46; }
        .wl-chip--amber{ background:#fef3c7; color:#92400e; }

        .wl-meta{ display:flex; gap:12px; flex-wrap:wrap; font-size:12px; color:#475569; }
        .wl-meta span{ white-space:nowrap; }

        .wl-actions{ display:flex; gap:8px; flex-wrap:wrap; }
        .wl-btn{ appearance:none; border:none; border-radius:12px; font-weight:900; padding:10px 14px; text-decoration:none; cursor:pointer; }
        .wl-btn--primary{ background:#6b0016; color:#fff; }
        .wl-btn--ghost{ background:#f8fafc; color:#111827; border:1px solid #e5e7eb; }

        .wl-details{ display:none; border-top:1px solid #eef0f3; padding:12px 14px 14px 46px; }
        .wl-details.show{ display:block; }

        .wl-badge-skel{ background:repeating-linear-gradient(90deg,#f1f5f9,#f1f5f9 8px,#e2e8f0 8px,#e2e8f0 16px); color:transparent }
      `;
      document.head.appendChild(css);
    })();

    const host = document.querySelector('#ctl00_PageBody_InvoicesGrid, .RadGrid[id*="InvoicesGrid"]');
    if (!host) { warn('Invoices grid host not found'); return; }
    const master = host.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00, .rgMasterTable');
    if (!master) { warn('Invoices master table not found'); return; }
    master.classList.add('wl-inv-cardify');

    const rows = Array.from(master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
    const grab = (tr, sel)=>{ const el = tr.querySelector(sel); return el ? el.textContent.trim() : ''; };
    const findInvoiceAnchor = (tr) =>
      tr.querySelector('td[data-title="Invoice #"] a[href*="InvoiceDetails_r.aspx"], td[data-title="Invoice #"] a[href*="/Invoices_r.aspx"]');
    const abs = (u)=>{ try{ return new URL(u, location.origin).toString(); }catch{ return u; } };

    async function annotateBadge(invNo, badgeEl){
      try{
        const idx = await getAccountIndex();
        let info = idx.get(invNo);
        if (info && (info.type||'').toLowerCase() !== 'invoice') info = null; // ignore Credit Notes
        if (!info){
          badgeEl.className = 'wl-chip wl-chip--green wl-badge';
          badgeEl.textContent = 'Paid';
        }else{
          const amt = info.outstanding || 0;
          if (amt > 0.009){
            badgeEl.className = 'wl-chip wl-chip--amber wl-badge';
            badgeEl.textContent = `Open · ${amt.toLocaleString(undefined,{style:'currency',currency:'USD'})}`;
            badgeEl.title = 'Amount Outstanding (Account Payment)';
          }else{
            badgeEl.className = 'wl-chip wl-chip--green wl-badge';
            badgeEl.textContent = 'Paid';
          }
        }
      }catch{
        badgeEl.className = 'wl-chip wl-chip--slate wl-badge';
        badgeEl.textContent = 'Status unavailable';
      }
    }

    function enhanceRow(tr){
      const a = findInvoiceAnchor(tr);
      if (!a) return;

      const invNo  = (a.textContent||'').trim();
      const invHref = abs(a.getAttribute('href')||'#');

      const orderNo = grab(tr, 'td[data-title="Order #"]');
      const yourRef = grab(tr, 'td[data-title="Your Ref"]');
      const jobRef  = grab(tr, 'td[data-title="Job Ref"]');
      const invDate = grab(tr, 'td[data-title="Invoice Date"]');
      const dueDate = grab(tr, 'td[data-title="Due Date"]');
      const goods   = grab(tr, 'td[data-title="Goods Total"]');
      const tax     = grab(tr, 'td[data-title="Tax"]');
      const total   = grab(tr, 'td[data-title="Total Amount"]');
      const lines   = grab(tr, 'td[data-title="Lines"]');
      const branch  = grab(tr, 'td[data-title="Branch"]');

      // hide original anchor but keep it
      a.style.position='absolute'; a.style.width='1px'; a.style.height='1px';
      a.style.overflow='hidden'; a.style.clip='rect(1px,1px,1px,1px)'; a.setAttribute('aria-hidden','true');

      const head = document.createElement('div');
      head.className = 'wl-row-head';
      head.innerHTML = `
        <div class="wl-head-left">
          <span class="wl-inv-no">Invoice #${invNo}</span>
          <span class="wl-chip wl-chip--slate wl-badge"><span class="wl-badge-skel">checking…</span></span>
          <div class="wl-meta">
            ${invDate ? `<span>Inv: ${invDate}</span>` : ``}
            ${dueDate ? `<span>Due: ${dueDate}</span>` : ``}
            ${orderNo ? `<span>Order: ${orderNo}</span>` : ``}
            ${branch  ? `<span>Branch: ${branch}</span>` : ``}
            ${lines   ? `<span>Lines: ${lines}</span>` : ``}
            ${yourRef && yourRef!=='-' ? `<span>Your Ref: ${yourRef}</span>` : ``}
            ${jobRef  && jobRef!=='-'  ? `<span>Job: ${jobRef}</span>` : ``}
            ${(total||goods||tax) ? `<span>Total: ${total||goods}</span>` : ``}
          </div>
        </div>
        <div class="wl-head-right">
          <a class="wl-btn wl-btn--ghost" href="${invHref}">Open</a>
          <button class="wl-btn wl-btn--primary" type="button" data-act="toggle">View details</button>
        </div>
      `;
      tr.insertAdjacentElement('afterbegin', head);

      annotateBadge(invNo, head.querySelector('.wl-badge'));

      const details = document.createElement('div');
      details.className = 'wl-details';
      tr.appendChild(details);

      head.querySelector('[data-act="toggle"]').addEventListener('click', async (e)=>{
        e.preventDefault();
        const btn = e.currentTarget;
        if (!details.dataset.loaded){
          details.dataset.loaded = '1';
          details.innerHTML = `<div style="color:#475569;">Loading…</div>`;
          try{
            const html = await fetch(invHref, { credentials:'same-origin' }).then(r=>r.text());
            const doc  = new DOMParser().parseFromString(html, 'text/html');
            const table = doc.querySelector('#ctl00_PageBody_ctl02_InvoiceDetailsGrid_ctl00, .rgMasterTable');
            if (table){
              const lines = [];
              table.querySelectorAll('tbody > tr').forEach(tr2=>{
                const code = (tr2.querySelector('td[data-title="Product Code"]')||{}).textContent||'';
                const desc = (tr2.querySelector('td[data-title="Description"]')||{}).textContent||'';
                const qty  = (tr2.querySelector('td[data-title="Qty"]')||{}).textContent||'';
                const tot  = (tr2.querySelector('td[data-title="Total"]')||{}).textContent||'';
                if ((code+desc).trim()) lines.push({code:code.trim(),desc:desc.trim(),qty:qty.trim(),tot:tot.trim()});
              });
              details.innerHTML = lines.slice(0,6).map(l=>`
                <div style="display:flex;gap:12px;justify-content:space-between;border:1px solid #eef0f3;border-radius:12px;padding:10px;">
                  <div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:800;min-width:86px">${l.code||'-'}</div>
                  <div style="flex:1;min-width:160px">${l.desc||''}</div>
                  <div style="white-space:nowrap;font-weight:700">${l.qty?`Qty: ${l.qty}`:''}${l.tot?` · ${l.tot}`:''}</div>
                </div>
              `).join('') || `<div style="color:#475569;">No line items found.</div>`;
            } else {
              details.innerHTML = `<div style="color:#475569;">Couldn’t read details. <a href="${invHref}">Open invoice page</a>.</div>`;
            }
          }catch{
            details.innerHTML = `<div style="color:#7f1d1d;background:#fee2e2;border:1px solid #fecaca;border-radius:10px;padding:10px;">
              Sorry, we couldn’t load details. You can still <a href="${invHref}">open the invoice page</a>.
            </div>`;
          }
        }
        details.classList.toggle('show');
        btn.textContent = details.classList.contains('show') ? 'Hide details' : 'View details';
      });
    }

    rows.forEach(tr=>{ try{ enhanceRow(tr); }catch(e){ warn('Row enhance fail', e); }});
    log('List enhanced:', rows.length);
  })();

  /* ==========================================================
     PART B — Invoice Details header (both locations)
     - /InvoiceDetails_r.aspx
     - or Invoices_r.aspx (when details section is present)
     ========================================================== */
  (function detailsEnhancer(){
    const onInvoiceDetailsStandalone = /InvoiceDetails_r\.aspx/i.test(location.pathname);
    const onInvoicesPage = /Invoices_r\.aspx/i.test(location.pathname);
    const gridPresentOnList = document.querySelector('#ctl00_PageBody_ctl02_InvoiceDetailsGrid'); // details section on list page
    if (!onInvoiceDetailsStandalone && !(onInvoicesPage && gridPresentOnList)) return;
    if (window.__WL_INVOICE_DETAILS__) return;
    window.__WL_INVOICE_DETAILS__ = true;

    // CSS
    (function css(){
      const style = document.createElement('style');
      style.textContent = `
        .listPageHeader{ display:none !important; }

        .wl-od-header{
          display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between;
          background:#fff; border:1px solid #e5e7eb; border-radius:16px; padding:14px 16px;
          box-shadow:0 6px 18px rgba(0,0,0,.05);
        }
        .wl-od-header-inner{ display:flex; flex-direction:column; gap:8px; width:100%; }
        .wl-od-top{ display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between; }
        .wl-od-title{ display:flex; flex-wrap:wrap; align-items:center; gap:10px; }
        .wl-order-no{ font-weight:900; font-size:20px; letter-spacing:.2px; }

        .wl-chip{ display:inline-flex; align-items:center; gap:6px; font-weight:800; border-radius:999px; padding:6px 10px; font-size:12px; }
        .wl-chip--slate{ background:#e2e8f0; color:#0f172a }
        .wl-chip--green{ background:#dcfce7; color:#065f46 }
        .wl-chip--amber{ background:#fef3c7; color:#92400e }

        .wl-od-actions{ display:flex; gap:8px; flex-wrap:wrap; }
        .wl-btn{ appearance:none; border:none; border-radius:12px; font-weight:900; padding:10px 14px; text-decoration:none; cursor:pointer; }
        .wl-btn--primary{ background:#6b0016; color:#fff }
        .wl-btn--ghost{ background:#f8fafc; color:#111827; border:1px solid #e5e7eb }

        /* Beautify the details grid a bit */
        #ctl00_PageBody_ctl02_InvoiceDetailsGrid thead{ display:none !important; }
        #ctl00_PageBody_ctl02_InvoiceDetailsGrid .rgMasterTable{
          border-collapse:separate !important; border-spacing:0 10px; table-layout:auto;
        }
        #ctl00_PageBody_ctl02_InvoiceDetailsGrid .rgRow,
        #ctl00_PageBody_ctl02_InvoiceDetailsGrid .rgAltRow{
          background:#fff; border:1px solid #eef0f3; border-radius:12px;
        }
        #ctl00_PageBody_ctl02_InvoiceDetailsGrid td{
          padding:10px; border:none !important; vertical-align:top;
        }
        #ctl00_PageBody_ctl02_InvoiceDetailsGrid td[data-title="Product Code"]{
          font-family:ui-monospace,Menlo,Consolas,monospace; font-weight:800; min-width:86px;
        }
      `;
      document.head.appendChild(style);
    })();

    const container = document.querySelector('.bodyFlexContainer');
    if (!container) { warn('details: no .bodyFlexContainer'); return; }

    // Parse invoice number from header text ("Details for Invoice XXXXX")
    let invNo = '';
    const hdr = document.querySelector('.bodyFlexItem.listPageHeader');
    if (hdr){
      const txt = hdr.textContent||'';
      const m = txt.match(/\b(\d{4,})\b/);
      if (m) invNo = m[1];
    }

    // Links
    const backLink = document.querySelector('#ctl00_PageBody_ctl02_BackButton, #ctl00_PageBody_ctl00_BackButton');
    const showInvoice = document.getElementById('ctl00_PageBody_ctl02_ShowInvoiceLink')
                      || document.getElementById('ctl00_PageBody_ctl02_ShowInvoiceDropDown');
    const orderImg   = document.getElementById('ctl00_PageBody_ctl02_ShowOrderImageLink')
                      || document.getElementById('ctl00_PageBody_ctl02_ShowOrderImageDropDown');
    const orderDoc   = document.getElementById('ctl00_PageBody_ctl02_ShowOrderDocumentLink')
                      || document.getElementById('ctl00_PageBody_ctl02_ShowOrderDocumentDropDown');
    const copyLink   = document.getElementById('ctl00_PageBody_ctl02_AddToCart')
                      || document.getElementById('ctl00_PageBody_ctl02_AddToCartDropDown');

    const abs = (u)=>{ try{ return new URL(u, location.origin).toString(); }catch{ return u; } };
    const pickDocLinks = ()=>{
      const imgHref = orderImg && orderImg.getAttribute('href');
      const invGen  = showInvoice && showInvoice.getAttribute('href'); // ProcessDocument.aspx (documentType=6)
      const docHref = orderDoc && orderDoc.getAttribute('href'); // ProcessDocument.aspx for order
      return {
        pdf: (imgHref && /toPdf=1/i.test(imgHref)) ? abs(imgHref) : null, // have a direct pdf (order image)
        generator: invGen ? abs(invGen) : (docHref ? abs(docHref) : null)
      };
    };

    async function tryFetchOk(url){
      try{
        const r = await fetch(url, { credentials:'same-origin', cache:'no-cache' });
        return r.ok;
      }catch{ return false; }
    }

    // Build header
    const head = document.createElement('div');
    head.className = 'wl-od-header';
    head.innerHTML = `
      <div class="wl-od-header-inner">
        <div class="wl-od-top">
          <div class="wl-od-title">
            <div class="wl-order-no">Invoice #${invNo||''}</div>
            <span class="wl-chip wl-chip--slate wl-badge"><span class="wl-badge-skel">checking…</span></span>
          </div>
          <div class="wl-od-actions">
            ${backLink ? `<a class="wl-btn wl-btn--ghost" href="${backLink.getAttribute('href')||'/Invoices_r.aspx'}">← Back</a>` : ``}
            ${showInvoice ? `<a class="wl-btn wl-btn--ghost" target="_blank" rel="noopener" href="${showInvoice.getAttribute('href')||'#'}">Show Invoice</a>` : ``}
            ${orderImg   ? `<a class="wl-btn wl-btn--ghost" target="_blank" rel="noopener" href="${orderImg.getAttribute('href')||'#'}">Show Order Image</a>` : ``}
            ${orderDoc   ? `<a class="wl-btn wl-btn--ghost" target="_blank" rel="noopener" href="${orderDoc.getAttribute('href')||'#'}">Show Order Doc</a>` : ``}
            ${(showInvoice || orderImg || orderDoc) ? `<button class="wl-btn wl-btn--ghost" type="button" id="wl-share-doc">Share</button>` : ``}
            ${(showInvoice || orderImg || orderDoc) ? `<button class="wl-btn wl-btn--ghost" type="button" id="wl-download-doc">Download PDF</button>` : ``}
            ${copyLink ? `<button class="wl-btn wl-btn--primary" type="button" id="wl-copy-lines">Copy Lines to Cart</button>` : ``}
          </div>
        </div>
      </div>
    `;
    container.insertAdjacentElement('afterbegin', head);

    // Badge (Paid/Open) using the shared index
    (async ()=>{
      const badge = head.querySelector('.wl-badge');
      try{
        const idx = await getAccountIndex();
        let info = invNo ? idx.get(invNo) : null;
        if (info && (info.type||'').toLowerCase() !== 'invoice') info = null;
        if (!info){
          badge.className = 'wl-chip wl-chip--green wl-badge';
          badge.textContent = 'Paid';
        }else{
          const amt = info.outstanding || 0;
          if (amt > 0.009){
            badge.className = 'wl-chip wl-chip--amber wl-badge';
            badge.textContent = `Open · ${amt.toLocaleString(undefined,{style:'currency',currency:'USD'})}`;
            badge.title = 'Amount Outstanding (Account Payment)';
          }else{
            badge.className = 'wl-chip wl-chip--green wl-badge';
            badge.textContent = 'Paid';
          }
        }
      }catch{
        badge.className = 'wl-chip wl-chip--slate wl-badge';
        badge.textContent = 'Status unavailable';
      }
    })();

    // Share
    head.querySelector('#wl-share-doc')?.addEventListener('click', async (e)=>{
      e.preventDefault();
      const { generator, pdf } = pickDocLinks();
      const url = pdf || generator;
      if (!url) { alert('Document not available yet.'); return; }
      const title = `Invoice #${invNo||''}`;
      const text  = `Document for Invoice #${invNo||''}`;
      try{
        if (navigator.share){ await navigator.share({ title, text, url }); }
        else { location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text+':\n\n'+url)}`; }
      }catch{}
    });

    // Download (generator-first)
    head.querySelector('#wl-download-doc')?.addEventListener('click', async (e)=>{
      e.preventDefault();
      const { generator, pdf } = pickDocLinks();
      if (!generator && !pdf) { alert('Document not available yet.'); return; }

      if (pdf && await tryFetchOk(pdf)){
        const a = document.createElement('a'); a.href = pdf; a.download=''; document.body.appendChild(a); a.click(); requestAnimationFrame(()=>a.remove());
        return;
      }
      if (generator){
        const iframe = document.createElement('iframe');
        iframe.style.display='none'; iframe.src = generator; document.body.appendChild(iframe);
        setTimeout(async ()=>{
          if (pdf && await tryFetchOk(pdf)){
            const a = document.createElement('a'); a.href = pdf; a.download=''; document.body.appendChild(a); a.click(); requestAnimationFrame(()=>a.remove());
          }else{
            window.open(generator, '_blank', 'noopener');
          }
          requestAnimationFrame(()=>iframe.remove());
        }, 900);
      }else if (pdf){
        window.open(pdf, '_blank', 'noopener');
      }
    });

    // Copy Lines to Cart (invoke existing postback/JS)
    head.querySelector('#wl-copy-lines')?.addEventListener('click', (e)=>{
      e.preventDefault();
      const href = copyLink.getAttribute('href')||'';
      try{
        if (href.startsWith('javascript:')) { /* eslint-disable-next-line no-eval */ eval(href.replace(/^javascript:/,'')); }
        else { location.assign(new URL(href, location.origin).toString()); }
      }catch(ex){ warn('Copy Lines failed', ex); }
    });

    log('Details enhanced (header/actions)');
  })();

})();

