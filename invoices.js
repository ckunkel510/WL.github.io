
/* =========================================================
   Woodson — Invoices UI Enhancer (cards-off, selectors-safe)
   - Preserves Telerik grid + Select-All + per-row selectors
   - Builds Paid/Open via AccountPayment_r.aspx (all pages)
   - Per-row "Details" preview (non-invasive)
   - Invoice details page header badge
   - Back to My Account button
   ========================================================= */

(function(){
  if (window.__WL_INVOICES_ENHANCED__) return;
  window.__WL_INVOICES_ENHANCED__ = true;

  const t0 = performance.now();
  const log  = (...a)=>console.log('%cINV','color:#005d6e;font-weight:700;',`[+${(performance.now()-t0).toFixed(1)}ms]`,...a);
  const warn = (...a)=>console.warn('%cINV','color:#b45309;font-weight:700;',`[+${(performance.now()-t0).toFixed(1)}ms]`,...a);

  /* -----------------------------
     Light CSS (does NOT alter grid layout/thead/td)
     ----------------------------- */
  (function injectCSS(){
    const css = `
      .wl-badge{display:inline-flex;align-items:center;gap:6px;font-weight:800;border-radius:999px;padding:4px 8px;font-size:12px;margin-left:8px;vertical-align:middle}
      .wl-badge--green{background:#dcfce7;color:#065f46}
      .wl-badge--amber{background:#fef3c7;color:#92400e}
      .wl-badge--slate{background:#e2e8f0;color:#0f172a}
      .wl-skel{background:repeating-linear-gradient(90deg,#f1f5f9,#f1f5f9 8px,#e2e8f0 8px,#e2e8f0 16px);color:transparent}
      .wl-details-toggle{margin-left:8px;font-size:12px;font-weight:800;border:1px solid #e5e7eb;background:#f8fafc;border-radius:10px;padding:4px 8px;cursor:pointer}
      .wl-details-row td{background:#fff;border:1px solid #eef0f3;border-radius:12px;padding:12px}
      .wl-details-lines{display:grid;gap:10px}
      .wl-line{display:flex;gap:12px;justify-content:space-between;border:1px solid #eef0f3;border-radius:10px;padding:10px}
      .wl-code{font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:800;min-width:86px}
      .wl-meta{white-space:nowrap;font-weight:700}
      .wl-details-error{color:#7f1d1d;background:#fee2e2;border:1px solid #fecaca;border-radius:10px;padding:10px}
    `;
    const el = document.createElement('style'); el.textContent = css; document.head.appendChild(el);
  })();

  /* =========================================================
     AccountPayment index builder: Doc# => {outstanding,type}
     - Reads ALL pages from #ctl00_PageBody_ctl31_Pager (or fallback)
     - Caches in sessionStorage for 10 minutes
     ========================================================= */
  const AP_CACHE_KEY = 'wl_ap_index_v1';
  const AP_CACHE_TTL_MS = 10*60*1000;

  async function buildAccountPaymentIndex(){
    // session cache
    try{
      const raw = sessionStorage.getItem(AP_CACHE_KEY);
      if (raw){
        const { at, data } = JSON.parse(raw);
        if (Date.now() - at < AP_CACHE_TTL_MS){
          const map = new Map(data); // array of [key,val]
          log('Using cached AccountPayment index:', map.size);
          return map;
        }
      }
    }catch{}

    const index = new Map();
    const basePath = '/AccountPayment_r.aspx';
    const parser = new DOMParser();

    const abs = (href)=>{
      try{
        // Ensure links like "?pageIndex=12" resolve to the same path
        const u = new URL(href, location.origin + basePath);
        // Normalize path to the AccountPayment page
        u.pathname = basePath;
        return u.toString();
      }catch{ return basePath; }
    };

    const fetchText = (u)=>fetch(u, { credentials:'same-origin', cache:'no-cache' }).then(r=>r.text());

    function parseRows(doc){
      const host = doc.querySelector('#ctl00_PageBody_InvoicesGrid') || doc;
      const tbl  = host.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || host.querySelector('.rgMasterTable');
      if (!tbl) return 0;
      const rows = tbl.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow');
      let got = 0;
      rows.forEach(tr=>{
        const get = (sel)=>{ const el = tr.querySelector(sel); return el ? el.textContent.trim() : ''; };
        const type = get('td[data-title="Type"]') || get('td:nth-child(2)');

        // Document number appears as a <span id="..._DocumentNumber">####</span>
        let docNo = get('span[id*="_DocumentNumber"]');
        if (!docNo) {
          // robust fallback: look for a "Doc. #" data-title cell or spans
          docNo = get('td[data-title="Doc. #"] span') || get('td[data-title="Document #"] span') || get('td[data-title="Invoice #"] span');
        }

        const outTxt = get('td[data-title="Amount Outstanding"]') || get('td:nth-child(9)') || '';
        const outVal = parseFloat((outTxt||'').replace(/[^0-9.\-]/g,'') || '0');

        if (docNo){
          index.set(docNo, { outstanding: isFinite(outVal) ? outVal : 0, type: (type||'').trim() });
          got++;
        }
      });
      return got;
    }

    function collectPagerHrefs(doc){
      const set = new Set();
      const ul = doc.querySelector('#ctl00_PageBody_ctl31_Pager') || doc.querySelector('#ctl00_PageBody_ctl30_Pager') || doc.querySelector('ul.pagination');
      if (ul){
        ul.querySelectorAll('a.page-link[href]').forEach(a=>{
          const href = a.getAttribute('href') || '';
          if (/pageIndex=\d+/.test(href)) set.add(abs(href));
        });
      }
      // Always include page 0
      set.add(basePath);
      return Array.from(set);
    }

    try{
      // 1) Load first page (no query) and parse + capture pager
      const firstHTML = await fetchText(basePath);
      const firstDoc = parser.parseFromString(firstHTML, 'text/html');
      parseRows(firstDoc);

      // 2) Visit all unique pageIndex links
      const pages = collectPagerHrefs(firstDoc)
        .filter(h => !h.endsWith('/AccountPayment_r.aspx')); // we already parsed basePath

      if (pages.length){
        const results = await Promise.allSettled(pages.map(h=>fetchText(h)));
        results.forEach(r=>{
          if (r.status === 'fulfilled'){
            const d = parser.parseFromString(r.value, 'text/html');
            parseRows(d);
          }
        });
      }

      log('AccountPayment index built:', index.size, 'docs');
    }catch(ex){
      warn('AccountPayment crawl failed:', ex);
    }

    // persist cache
    try{
      const serial = JSON.stringify({ at: Date.now(), data: Array.from(index.entries()) });
      sessionStorage.setItem(AP_CACHE_KEY, serial);
    }catch{}

    return index;
  }

  if (!window.__WL_AP_INDEX_PROMISE__){
    window.__WL_AP_INDEX_PROMISE__ = buildAccountPaymentIndex();
  }
  const getAPIndex = ()=>window.__WL_AP_INDEX_PROMISE__;

  /* =========================================================
     Invoices list page enhancer (keeps grid + selectors)
     ========================================================= */
  (function enhanceInvoicesList(){
    if (!/Invoices_r\.aspx/i.test(location.pathname)) return;

    const grid = document.querySelector('#ctl00_PageBody_InvoicesGrid');
    const master = grid && (grid.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || grid.querySelector('.rgMasterTable'));
    if (!master) { log('No invoices grid found'); return; }

    const rows = Array.from(master.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
    if (!rows.length) { log('No invoice rows'); return; }

    // Calculate column count for details row colspan
    const thead = master.querySelector('thead');
    const colCount = thead ? thead.querySelectorAll('th').length : (rows[0]?.children?.length || 10);

    const getInvoiceNoFromRow = (tr) => {
      // Prefer explicit Invoice # or Doc. #
      let cell = tr.querySelector('td[data-title="Invoice #"]') || tr.querySelector('td[data-title="Doc. #"]');
      let invNo = (cell?.querySelector('a, span')?.textContent || '').trim();
      if (!invNo) {
        // scan by header text fallback
        const a = tr.querySelector('a[href*="InvoiceDetails_r.aspx"], a[href*="/Invoices_r.aspx"]');
        invNo = (a?.textContent || '').trim();
      }
      return invNo;
    };

    const getInvoiceDetailsHref = (tr) => {
      // Narrow view has InvoiceDetails link; wide view sometimes points back to list.
      const narrowA = tr.querySelector('td.narrow-only a[href*="InvoiceDetails_r.aspx"]');
      if (narrowA) return new URL(narrowA.getAttribute('href'), location.origin).toString();

      // Otherwise, try to build from the hidden invoice id in the selector span
      const selSpan = tr.querySelector('span[invoiceid]');
      const invId = selSpan ? selSpan.getAttribute('invoiceid') : null;
      if (invId) {
        const href = `InvoiceDetails_r.aspx?id=${encodeURIComponent(invId)}&returnUrl=%7e%2fInvoices_r.aspx`;
        return new URL(href, location.origin).toString();
      }

      // As last fallback, use any anchor on the row
      const anyA = tr.querySelector('a[href*="InvoiceDetails_r.aspx"]');
      return anyA ? new URL(anyA.getAttribute('href'), location.origin).toString() : null;
    };

    rows.forEach(tr=>{
      const invCell = tr.querySelector('td[data-title="Invoice #"], td[data-title="Doc. #"]') || tr.querySelector('td');
      if (!invCell) return;

      // Append status badge placeholder (don’t duplicate)
      if (!invCell.querySelector('.wl-badge')){
        const badge = document.createElement('span');
        badge.className = 'wl-badge wl-badge--slate';
        badge.innerHTML = '<span class="wl-skel">checking…</span>';
        invCell.appendChild(badge);

        // Resolve + render status
        (async ()=>{
          const invNo = getInvoiceNoFromRow(tr);
          const idx = await getAPIndex();
          let info = invNo ? idx.get(invNo) : null;

          // Only treat 'Invoice' rows as invoices (ignore credit notes when crawling)
          if (info && (info.type||'').toLowerCase() !== 'invoice') info = null;

          if (!info){
            // Not present in AccountPayment table under active filters => considered paid/applied
            badge.className = 'wl-badge wl-badge--green';
            badge.textContent = 'Paid';
          }else{
            const amt = info.outstanding || 0;
            if (amt > 0.009){
              badge.className = 'wl-badge wl-badge--amber';
              badge.textContent = `Open · ${amt.toLocaleString(undefined,{style:'currency',currency:'USD'})}`;
              badge.title = 'Amount Outstanding (Account Payment)';
            }else{
              badge.className = 'wl-badge wl-badge--green';
              badge.textContent = 'Paid';
            }
          }
        })().catch(()=>{ badge.className='wl-badge wl-badge--slate'; badge.textContent='Status unavailable'; });

        // Add a Details toggle button (non-invasive)
        const href = getInvoiceDetailsHref(tr);
        if (href){
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'wl-details-toggle';
          btn.textContent = 'Details';
          invCell.appendChild(btn);

          let open = false;
          let detailsTr = null;

          btn.addEventListener('click', async ()=>{
            open = !open;
            btn.textContent = open ? 'Hide' : 'Details';

            if (open && !detailsTr){
              detailsTr = document.createElement('tr');
              detailsTr.className = 'wl-details-row';
              const td = document.createElement('td');
              td.colSpan = colCount;
              td.innerHTML = '<div>Loading…</div>';
              detailsTr.appendChild(td);
              tr.insertAdjacentElement('afterend', detailsTr);

              try{
                const html = await fetch(href, { credentials:'same-origin' }).then(r=>r.text());
                const doc = new DOMParser().parseFromString(html, 'text/html');
                const grid2 = doc.querySelector('#ctl00_PageBody_ctl02_InvoiceDetailsGrid_ctl00, .rgMasterTable');
                if (grid2){
                  const lines = [];
                  grid2.querySelectorAll('tbody > tr').forEach(r2=>{
                    const get = sel => (r2.querySelector(sel)?.textContent || '').trim();
                    const code = get('td[data-title="Product Code"]');
                    const desc = get('td[data-title="Description"]');
                    const qty  = get('td[data-title="Qty"]');
                    const tot  = get('td[data-title="Total"]');
                    if ((code||desc)) lines.push({code,desc,qty,tot});
                  });
                  td.innerHTML = lines.length ? `
                    <div class="wl-details-lines">
                      ${lines.slice(0,6).map(l=>`
                        <div class="wl-line">
                          <div class="wl-code">${l.code||'-'}</div>
                          <div style="flex:1">${l.desc||''}</div>
                          <div class="wl-meta">${l.qty?`Qty: ${l.qty}`:''}${l.tot?` · ${l.tot}`:''}</div>
                        </div>`).join('')}
                      ${lines.length>6?`<div style="font-size:12px;color:#475569">(+${lines.length-6} more… open the invoice to see all)</div>`:''}
                    </div>` : '<div style="color:#475569">No line items found.</div>';
                }else{
                  td.innerHTML = \`<div class="wl-details-error">Couldn’t read details. <a href="\${href}">Open invoice page</a>.</div>\`;
                }
              }catch{
                td.innerHTML = \`<div class="wl-details-error">Error loading details. <a href="\${href}">Open invoice page</a>.</div>\`;
              }
            } else if (detailsTr){
              detailsTr.style.display = open ? '' : 'none';
            }
          });
        }
      }
    });

    log('Invoices list enhanced. Rows:', rows.length);
  })();

  /* =========================================================
     Invoice details page: header badge + quick actions
     ========================================================= */
  (function enhanceInvoiceDetails(){
    if (!/InvoiceDetails_r\.aspx/i.test(location.pathname)) return;

    const container = document.querySelector('.bodyFlexContainer');
    const hdr = document.querySelector('.bodyFlexItem.listPageHeader');
    if (!container) return;

    // Extract invoice number from header text
    let invNo = '';
    if (hdr){
      const m = (hdr.textContent||'').match(/\b(\d{4,})\b/);
      if (m) invNo = m[1];
    }

    const backLink = document.querySelector('#ctl00_PageBody_ctl02_BackButton, #ctl00_PageBody_ctl00_BackButton');
    const showInvoice = document.getElementById('ctl00_PageBody_ctl02_ShowInvoiceLink') || document.getElementById('ctl00_PageBody_ctl02_ShowInvoiceDropDown');
    const showOrderImg = document.getElementById('ctl00_PageBody_ctl02_ShowOrderImageLink') || document.getElementById('ctl00_PageBody_ctl02_ShowOrderImageDropDown');
    const showOrderDoc = document.getElementById('ctl00_PageBody_ctl02_ShowOrderDocumentLink') || document.getElementById('ctl00_PageBody_ctl02_ShowOrderDocumentDropDown');
    const copyLines    = document.getElementById('ctl00_PageBody_ctl02_AddToCart') || document.getElementById('ctl00_PageBody_ctl02_AddToCartDropDown');

    const head = document.createElement('div');
    head.style.cssText = 'display:flex;gap:12px;align-items:center;justify-content:space-between;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:12px 14px;box-shadow:0 6px 18px rgba(0,0,0,.05);margin-bottom:10px;';
    head.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <div style="font-weight:900;font-size:20px">Invoice #${invNo||''}</div>
        <span class="wl-badge wl-badge--slate"><span class="wl-skel">checking…</span></span>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${backLink ? `<a class="wl-details-toggle" href="${backLink.getAttribute('href')||'/Invoices_r.aspx'}">← Back</a>` : ``}
        ${showInvoice ? `<a class="wl-details-toggle" target="_blank" rel="noopener" href="${showInvoice.getAttribute('href')||'#'}">Show Invoice</a>` : ``}
        ${showOrderImg ? `<a class="wl-details-toggle" target="_blank" rel="noopener" href="${showOrderImg.getAttribute('href')||'#'}">Show Order Image</a>` : ``}
        ${showOrderDoc ? `<a class="wl-details-toggle" target="_blank" rel="noopener" href="${showOrderDoc.getAttribute('href')||'#'}">Show Order Document</a>` : ``}
        ${copyLines ? `<button class="wl-details-toggle" type="button" id="wl-copy-lines">Copy Lines to Cart</button>` : ``}
      </div>
    `;
    container.insertAdjacentElement('afterbegin', head);

    // Badge resolve
    (async ()=>{
      const badge = head.querySelector('.wl-badge');
      try{
        const idx = await getAPIndex();
        let info = invNo ? idx.get(invNo) : null;
        if (info && (info.type||'').toLowerCase() !== 'invoice') info = null;

        if (!info){
          badge.className = 'wl-badge wl-badge--green'; badge.textContent = 'Paid';
        }else{
          const amt = info.outstanding || 0;
          if (amt > 0.009){
            badge.className = 'wl-badge wl-badge--amber';
            badge.textContent = `Open · ${amt.toLocaleString(undefined,{style:'currency',currency:'USD'})}`;
            badge.title = 'Amount Outstanding (Account Payment)';
          }else{
            badge.className = 'wl-badge wl-badge--green'; badge.textContent = 'Paid';
          }
        }
      }catch{
        badge.className = 'wl-badge wl-badge--slate'; badge.textContent = 'Status unavailable';
      }
    })();

    // Copy Lines to Cart proxy
    const copyBtn = head.querySelector('#wl-copy-lines');
    if (copyBtn && copyLines){
      copyBtn.addEventListener('click', (e)=>{
        e.preventDefault();
        const href = copyLines.getAttribute('href')||'';
        try{
          if (href.startsWith('javascript:')) { /* eslint-disable-next-line no-eval */ eval(href.replace(/^javascript:/,'')); }
          else { location.assign(new URL(href, location.origin).toString()); }
        }catch(ex){ warn('Copy Lines failed', ex); }
      });
    }
  })();

  /* =========================================================
     Back to My Account button (above search panel)
     ========================================================= */
  (function addBackToAccount(){
    const panel = document.getElementById("ctl00_PageBody_Panel1");
    if (!panel) return;
    const backBtn = document.createElement("a");
    backBtn.href = "https://webtrack.woodsonlumber.com/AccountInfo_R.aspx";
    backBtn.textContent = "← Back to My Account";
    backBtn.style.display = "inline-block";
    backBtn.style.marginBottom = "12px";
    backBtn.style.padding = "8px 14px";
    backBtn.style.background = "#6b0016";
    backBtn.style.color = "#fff";
    backBtn.style.borderRadius = "6px";
    backBtn.style.textDecoration = "none";
    backBtn.style.fontWeight = "bold";
    backBtn.addEventListener('mouseover', ()=>{ backBtn.style.background = "#8d8d8d"; });
    backBtn.addEventListener('mouseout', ()=>{ backBtn.style.background = "#6b0016"; });
    panel.parentNode.insertBefore(backBtn, panel);
  })();

})();

