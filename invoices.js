
/* =========================================================
   INVOICES — Card UI (List) + Details Enhancer
   Mirrors the OpenOrders experience you shipped
   ========================================================= */

/* ============================
   A) INVOICES LIST ENHANCER
   ============================ */
(function(){
  if (!/Invoices_r\.aspx/i.test(location.pathname)) return;
  if (window.__WL_INVOICES_LIST__) return;
  window.__WL_INVOICES_LIST__ = true;

  const t0 = performance.now();
  const log = (...a)=>console.log('%cWL:INV-L','color:#6b0016;font-weight:700;',`[+${(performance.now()-t0).toFixed(1)}ms]`,...a);

  // ---------- CSS ----------
  (function injectCSS(){
    const style = document.createElement('style');
    style.textContent = `
      /* Hide the grid header – we render cards */
      #ctl00_PageBody_InvoicesGrid thead,
      .RadGrid[id*="InvoicesGrid"] thead { display:none !important; }

      /* Cardify */
      .wl-inv-cardify tr.rgRow, .wl-inv-cardify tr.rgAltRow{
        display:block; background:#fff; border:1px solid #e5e7eb; border-radius:16px;
        margin:12px 0; box-shadow:0 6px 18px rgba(0,0,0,.05); overflow:hidden; position:relative
      }
      .wl-inv-cardify tr.rgRow>td, .wl-inv-cardify tr.rgAltRow>td{ display:none !important; }

      .wl-row-head{
        display:grid; gap:8px; padding:14px; align-items:center
      }
      @media (min-width: 1024px){
        .wl-row-head{ grid-template-columns: 1fr auto; }
        .wl-head-left{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .wl-head-right{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; justify-content:flex-end; }
      }
      @media (max-width: 1023.98px){
        .wl-head-left{ display:flex; flex-wrap:wrap; gap:10px; }
        .wl-head-right{ display:flex; flex-wrap:wrap; gap:8px; }
      }

      .wl-inv-id{ font-weight:900; font-size:16px; letter-spacing:.2px; }
      @media (min-width:1024px){ .wl-inv-id{ font-size:18px; } }

      .wl-chip{ display:inline-flex; align-items:center; gap:6px; font-weight:800; border-radius:999px; padding:6px 10px; font-size:12px; text-transform:capitalize; }
      .wl-chip--green{ background:#dcfce7; color:#065f46; }
      .wl-chip--amber{ background:#fef3c7; color:#92400e; }
      .wl-chip--red{ background:#fee2e2; color:#7f1d1d; }
      .wl-chip--slate{ background:#e2e8f0; color:#0f172a; }

      .wl-meta{ display:flex; gap:12px; flex-wrap:wrap; font-size:12px; color:#475569; }
      .wl-meta span{ white-space:nowrap; }

      .wl-btn{ appearance:none; border:none; border-radius:12px; font-weight:900; padding:10px 14px; text-decoration:none; cursor:pointer; }
      .wl-btn--primary{ background:#6b0016; color:#fff; }
      .wl-btn--ghost{ background:#f8fafc; color:#111827; border:1px solid #e5e7eb; }
      .wl-btn:disabled{ opacity:.6; cursor:default; }

      .wl-details{ display:none; border-top:1px solid #eef0f3; padding:12px 14px 16px; }
      .wl-details.show{ display:block; }

      .wl-lines{ display:flex; flex-direction:column; gap:10px; }
      .wl-line{ display:flex; gap:12px; align-items:flex-start; justify-content:space-between; border:1px solid #eef0f3; border-radius:12px; padding:10px; }
      .wl-sku{ font-family:ui-monospace,Menlo,Consolas,monospace; font-weight:800; min-width:86px; }
      .wl-desc{ flex:1; min-width:160px; }
      .wl-qty{ white-space:nowrap; font-weight:700; }

      .wl-foot-actions{ margin-top:12px; display:flex; gap:8px; flex-wrap:wrap; }
    `;
    document.head.appendChild(style);
  })();

  // ---------- DOM ----------
  const host = document.querySelector('#ctl00_PageBody_InvoicesGrid, .RadGrid[id*="InvoicesGrid"]');
  if (!host) { log('Grid host not found'); return; }
  const table = host.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00, .rgMasterTable');
  if (!table) { log('Master table not found'); return; }
  table.classList.add('wl-inv-cardify');

  const rows = Array.from(table.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));

  // Helpers
  const grab = (tr, sel) => (tr.querySelector(sel)?.textContent || '').trim();
  const findInvoiceAnchor = (tr) =>
    tr.querySelector('td[data-title="Invoice #"] a[href*="InvoiceDetails_r.aspx"]') ||
    tr.querySelector('td[data-title="Invoice #"] a[href*="/Invoices_r.aspx?oid="]');

  function parseDuePill(dueStr){
    // dueStr like "09/10/2025"
    const pill = { class:'slate', text:'Invoice' };
    if (!dueStr) return pill;
    const today = new Date(); today.setHours(0,0,0,0);
    const [m,d,y] = (dueStr||'').split('/').map(x=>parseInt(x,10));
    if (!y) return pill;
    const due = new Date(y, m-1, d);
    const diff = Math.floor((due - today)/(1000*60*60*24));
    if (diff < 0) { pill.class='red'; pill.text='Past due'; }
    else if (diff <= 5) { pill.class='amber'; pill.text=`Due in ${diff}d`; }
    else { pill.class='green'; pill.text='Current'; }
    return pill;
  }

  function enhanceRow(tr){
    const invIdSpan = tr.querySelector('span[invoiceid]');
    const internalId = invIdSpan?.getAttribute('invoiceid') || '';
    const a = findInvoiceAnchor(tr);
    if (!a) return;

    const invoiceNo = (a.textContent||'').trim();
    const orderNo   = grab(tr, 'td[data-title="Order #"]');
    const invDate   = grab(tr, 'td[data-title="Invoice Date"]');
    const dueDate   = grab(tr, 'td[data-title="Due Date"]');
    const total     = grab(tr, 'td[data-title="Total Amount"]');
    const branch    = grab(tr, 'td[data-title="Branch"]');

    const pill = parseDuePill(dueDate);

    // Hide the original anchor but keep for fallback
    a.style.position='absolute'; a.style.width='1px'; a.style.height='1px';
    a.style.overflow='hidden'; a.style.clip='rect(1px,1px,1px,1px)'; a.setAttribute('aria-hidden','true');

    // Header
    const head = document.createElement('div');
    head.className = 'wl-row-head';
    head.innerHTML = `
      <div class="wl-head-left">
        <span class="wl-inv-id">Invoice #${invoiceNo}</span>
        <span class="wl-chip wl-chip--${pill.class}">${pill.text}</span>
        <div class="wl-meta">
          ${orderNo ? `<span>Order: ${orderNo}</span>`:''}
          ${invDate ? `<span>Date: ${invDate}</span>`:''}
          ${dueDate ? `<span>Due: ${dueDate}</span>`:''}
          ${branch  ? `<span>Branch: ${branch}</span>`:''}
          ${total   ? `<span>Total: ${total}</span>`:''}
        </div>
      </div>
      <div class="wl-head-right">
        <button class="wl-btn wl-btn--primary" type="button" data-action="toggle-details">View details</button>
        <a class="wl-btn wl-btn--ghost" href="${a.getAttribute('href')}">Open full invoice</a>
      </div>
    `;
    tr.insertAdjacentElement('afterbegin', head);

    // Details container
    const details = document.createElement('div');
    details.className = 'wl-details';
    details.dataset.state = 'idle';
    tr.appendChild(details);

    const btn = head.querySelector('[data-action="toggle-details"]');
    btn.addEventListener('click', async (e)=>{
      e.preventDefault();
      e.stopPropagation();
      if (details.dataset.state === 'idle') {
        await loadInvoiceDetails(details, internalId, a.getAttribute('href')||'#', btn);
      }
      details.classList.toggle('show');
      btn.textContent = details.classList.contains('show') ? 'Hide details' : 'View details';
    });
  }

  async function loadInvoiceDetails(container, internalId, fallbackHref, btn){
    try{
      container.dataset.state='loading';
      btn.disabled = true; btn.textContent='Loading…';

      // Prefer the explicit InvoiceDetails_r.aspx?id= link if present on the row
      let detailsUrl = fallbackHref;
      const m = /InvoiceDetails_r\.aspx\?id=\d+/i.exec(fallbackHref||'');
      if (!m) {
        // build one from internalId (found on the checkbox span[invoiceid])
        if (internalId) detailsUrl = `/InvoiceDetails_r.aspx?id=${encodeURIComponent(internalId)}&returnUrl=%7e%2fInvoices_r.aspx`;
      }

      const html = await fetch(detailsUrl, { credentials:'same-origin' }).then(r=>r.text());
      const doc  = new DOMParser().parseFromString(html, 'text/html');

      // Lines grid in details page
      const linesTable =
        doc.querySelector('#ctl00_PageBody_ctl02_InvoiceDetailsGrid_ctl00') ||
        doc.querySelector('#ctl00_PageBody_ctl02_InvoiceDetailsGrid .rgMasterTable');

      const lines = [];
      if (linesTable){
        linesTable.querySelectorAll('tbody tr').forEach(tr=>{
          const code = (tr.querySelector('td[data-title="Product Code"]')?.textContent||'').trim();
          const desc = (tr.querySelector('td[data-title="Description"]')?.textContent||'').trim().replace(/\s+/g,' ');
          const qty  = (tr.querySelector('td[data-title="Qty"]')?.textContent||'').trim();
          if (code || desc) lines.push({code, desc, qty});
        });
      }

      // Action links from details page (generator-first)
      const showInv = doc.querySelector('#ctl00_PageBody_ctl02_ShowInvoiceLink, #ctl00_PageBody_ctl02_ShowInvoiceDropDown');
      const showImg = doc.querySelector('#ctl00_PageBody_ctl02_ShowOrderImageLink, #ctl00_PageBody_ctl02_ShowOrderImageDropDown');
      const showDoc = doc.querySelector('#ctl00_PageBody_ctl02_ShowOrderDocumentLink, #ctl00_PageBody_ctl02_ShowOrderDocumentDropDown');
      const addCart = doc.querySelector('#ctl00_PageBody_ctl02_AddToCart, #ctl00_PageBody_ctl02_AddToCartDropDown');

      function abs(u){ try{ return new URL(u, location.origin).toString(); }catch{ return u; } }
      const generator = showInv ? abs(showInv.getAttribute('href')||'') : null;          // ProcessDocument invoice
      const pdf       = showImg && /toPdf=1/i.test(showImg.getAttribute('href')||'')
                        ? abs(showImg.getAttribute('href')||'') : null;                  // GetDocument.aspx …toPdf=1

      container.innerHTML = `
        ${lines.length ? `
          <div class="wl-lines">
            ${lines.map(l=>`
              <div class="wl-line">
                <div class="wl-sku">${l.code||'-'}</div>
                <div class="wl-desc">${l.desc||''}</div>
                <div class="wl-qty">${l.qty?`Qty: ${l.qty}`:''}</div>
              </div>
            `).join('')}
          </div>
        ` : `<div style="color:#475569;padding:8px 0;">No line items found.</div>`}

        <div class="wl-foot-actions">
          <a class="wl-btn wl-btn--ghost" href="/Invoices_r.aspx">← Back to Invoices</a>
          ${generator ? `<a class="wl-btn wl-btn--ghost" target="_blank" rel="noopener" href="${generator}">Show Invoice</a>`:''}
          ${showDoc ? `<a class="wl-btn wl-btn--ghost" target="_blank" rel="noopener" href="${abs(showDoc.getAttribute('href')||'#')}">Order Doc</a>`:''}
          ${showImg ? `<a class="wl-btn wl-btn--ghost" target="_blank" rel="noopener" href="${abs(showImg.getAttribute('href')||'#')}">Order Image</a>`:''}
          ${pdf ? `<a class="wl-btn wl-btn--primary" target="_blank" rel="noopener" href="${pdf}">Download PDF</a>`:''}
          ${addCart ? `<button class="wl-btn wl-btn--primary" type="button" data-action="copy-lines">Copy lines to cart</button>`:''}
        </div>
      `;

      // Copy lines button (executes the postback href from details page)
      const copyBtn = container.querySelector('[data-action="copy-lines"]');
      if (copyBtn && addCart){
        copyBtn.addEventListener('click', (e)=>{
          e.preventDefault();
          const href = addCart.getAttribute('href')||'';
          if (href.startsWith('javascript:')) { /* eslint-disable-next-line no-eval */ eval(href.replace(/^javascript:/,'')); }
        });
      }

      container.dataset.state='ready';
    } catch(ex){
      console.error(ex);
      container.innerHTML = `<div style="color:#7f1d1d;background:#fee2e2;border:1px solid #fecaca;border-radius:10px;padding:10px;">
        Sorry, we couldn’t load invoice details. You can still <a href="${fallbackHref}">open the full invoice</a>.
      </div>`;
      container.dataset.state='error';
    } finally {
      btn.disabled = false;
      if (container.classList.contains('show')) btn.textContent = 'Hide details';
      else btn.textContent = 'View details';
    }
  }

  rows.forEach(tr=>{ try{ enhanceRow(tr); }catch(e){ console.warn('INV row enhance failed', e); } });
  log('List enhanced, rows:', rows.length);
})();

/* ==================================
   B) INVOICE DETAILS ENHANCER (UI)
   ================================== */
(function(){
  if (!/InvoiceDetails_r\.aspx/i.test(location.pathname)) return;
  if (window.__WL_INVOICE_DETAILS__) return;
  window.__WL_INVOICE_DETAILS__ = true;

  const t0 = performance.now();
  const log  = (...a)=>console.log('%cWL:INV-D','color:#6b0016;font-weight:700;',`[+${(performance.now()-t0).toFixed(1)}ms]`,...a);
  const warn = (...a)=>console.warn('%cWL:INV-D','color:#c2410c;font-weight:700;',`[+${(performance.now()-t0).toFixed(1)}ms]`,...a);

  // CSS
  (function injectCSS(){
    const css = document.createElement('style');
    css.textContent = `
      .listPageHeader{ display:none !important; }
      .wl-od-header{
        display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between;
        background:#fff; border:1px solid #e5e7eb; border-radius:16px; padding:14px 16px;
        box-shadow:0 6px 18px rgba(0,0,0,.05);
      }
      .wl-od-header-inner{ display:flex; flex-direction:column; gap:8px; width:100%; }
      .wl-od-top{ display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between; }
      .wl-od-title{ display:flex; flex-wrap:wrap; align-items:center; gap:10px; }
      .wl-od-title .wl-invoice-no{ font-weight:900; font-size:20px; letter-spacing:.2px; }
      .wl-chip{ display:inline-flex; align-items:center; gap:6px; font-weight:800; border-radius:999px; padding:6px 10px; font-size:12px; text-transform:capitalize; }
      .wl-chip--slate{ background:#e2e8f0; color:#0f172a }
      .wl-btn{ appearance:none; border:none; border-radius:12px; font-weight:900; padding:10px 14px; text-decoration:none; cursor:pointer; }
      .wl-btn--primary{ background:#6b0016; color:#fff }
      .wl-btn--ghost{ background:#f8fafc; color:#111827; border:1px solid #e5e7eb }
      .panel.panelAccountInfo{
        width:100%; border:1px solid #e5e7eb; border-radius:16px; overflow:hidden;
        box-shadow:0 6px 18px rgba(0,0,0,.05); background:#fff;
      }
      .panel.panelAccountInfo .panelBodyHeader{
        font-weight:800; padding:10px 14px; background:#f8fafc; border-bottom:1px solid #eef0f3;
      }
      .panel.panelAccountInfo .panelBody{ padding:12px 14px; }
      #ctl00_PageBody_ctl02_InvoiceDetailsGrid .rgMasterTable{
        border-collapse:separate !important; border-spacing:0 10px; table-layout:auto;
      }
      #ctl00_PageBody_ctl02_InvoiceDetailsGrid thead{ display:none !important; }
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
      #ctl00_PageBody_ctl02_InvoiceDetailsGrid td[data-title="Description"]{ width:100%; }
    `;
    document.head.appendChild(css);
  })();

  // Parse invoice header bits
  const oldHeader = document.querySelector('.bodyFlexItem.listPageHeader');
  const invText = (oldHeader?.textContent||'').replace(/\s+/g,' ').trim();
  const invMatch = invText.match(/Details for Invoice\s+(\d+)/i);
  const invoiceNo = invMatch ? invMatch[1] : '';

  // Links
  const backLink = '/Invoices_r.aspx';
  const showInv  = document.querySelector('#ctl00_PageBody_ctl02_ShowInvoiceLink, #ctl00_PageBody_ctl02_ShowInvoiceDropDown');
  const showImg  = document.querySelector('#ctl00_PageBody_ctl02_ShowOrderImageLink, #ctl00_PageBody_ctl02_ShowOrderImageDropDown');
  const showDoc  = document.querySelector('#ctl00_PageBody_ctl02_ShowOrderDocumentLink, #ctl00_PageBody_ctl02_ShowOrderDocumentDropDown');
  const copyLink = document.querySelector('#ctl00_PageBody_ctl02_AddToCart, #ctl00_PageBody_ctl02_AddToCartDropDown');

  function abs(u){ try{ return new URL(u, location.origin).toString(); }catch{ return u; } }
  const generator = showInv ? abs(showInv.getAttribute('href')||'') : null;
  const pdf       = showImg && /toPdf=1/i.test(showImg.getAttribute('href')||'')
                    ? abs(showImg.getAttribute('href')||'') : null;

  // Insert modern header
  (function buildHeader(){
    const container = document.querySelector('.bodyFlexContainer');
    if (!container) { warn('No .bodyFlexContainer'); return; }

    const head = document.createElement('div');
    head.className = 'wl-od-header';
    head.innerHTML = `
      <div class="wl-od-header-inner">
        <div class="wl-od-top">
          <div class="wl-od-title">
            <div class="wl-invoice-no">Invoice #${invoiceNo || ''}</div>
            <span class="wl-chip wl-chip--slate">Invoice</span>
          </div>
          <div class="wl-od-actions">
            <a class="wl-btn wl-btn--ghost" href="${backLink}">← Back</a>
            ${generator ? `<a class="wl-btn wl-btn--ghost" target="_blank" rel="noopener" href="${generator}">Show Invoice</a>`:''}
            ${showDoc ? `<a class="wl-btn wl-btn--ghost" target="_blank" rel="noopener" href="${abs(showDoc.getAttribute('href')||'#')}">Order Doc</a>`:''}
            ${showImg ? `<a class="wl-btn wl-btn--ghost" target="_blank" rel="noopener" href="${abs(showImg.getAttribute('href')||'#')}">Order Image</a>`:''}
            ${ (generator || pdf) ? `<button class="wl-btn wl-btn--ghost" type="button" id="wl-share-doc">Share</button>`:''}
            ${ pdf ? `<a class="wl-btn wl-btn--primary" target="_blank" rel="noopener" href="${pdf}">Download PDF</a>`:''}
            ${ copyLink ? `<button class="wl-btn wl-btn--primary" type="button" id="wl-copy-lines">Copy Lines to Cart</button>`:''}
          </div>
        </div>
      </div>
    `;
    container.insertAdjacentElement('afterbegin', head);

    // Share
    const shareBtn = head.querySelector('#wl-share-doc');
    if (shareBtn){
      shareBtn.addEventListener('click', async (e)=>{
        e.preventDefault();
        const url = pdf || generator;
        if (!url) { alert('Document not available yet.'); return; }
        const title = `Invoice #${invoiceNo}`;
        const text  = `Invoice #${invoiceNo}`;
        try{
          if (navigator.share) { await navigator.share({ title, text, url }); }
          else { location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text+':\n\n'+url)}`; }
        }catch(ex){ /* ignore */ }
      });
    }

    // Copy lines to cart (postback)
    const copyBtn = head.querySelector('#wl-copy-lines');
    if (copyBtn && copyLink){
      copyBtn.addEventListener('click', (e)=>{
        e.preventDefault();
        const href = copyLink.getAttribute('href')||'';
        if (href.startsWith('javascript:')) { /* eslint-disable-next-line no-eval */ eval(href.replace(/^javascript:/,'')); }
      });
    }
  })();

  log('Invoice details enhanced');
})();

/* ============================================
   C) Back-to-Account button above the filter
   (same as your OpenOrders insertion)
   ============================================ */
document.addEventListener('DOMContentLoaded', function(){
  const panel = document.getElementById('ctl00_PageBody_Panel1');
  if (panel && !document.getElementById('wl-back-to-account')){
    const backBtn = document.createElement('a');
    backBtn.id = 'wl-back-to-account';
    backBtn.href = 'https://webtrack.woodsonlumber.com/AccountInfo_R.aspx';
    backBtn.textContent = '← Back to My Account';
    backBtn.style.display = 'inline-block';
    backBtn.style.marginBottom = '12px';
    backBtn.style.padding = '8px 14px';
    backBtn.style.background = '#6b0016';
    backBtn.style.color = '#fff';
    backBtn.style.borderRadius = '6px';
    backBtn.style.textDecoration = 'none';
    backBtn.style.fontWeight = 'bold';
    backBtn.onmouseover = ()=> backBtn.style.background = '#8d8d8d';
    backBtn.onmouseout  = ()=> backBtn.style.background = '#6b0016';
    panel.parentNode.insertBefore(backBtn, panel);
  }
});

