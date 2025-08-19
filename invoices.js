
/* =========================================================
   Woodson — Invoices Enhancer (v1.7)
   - Robust, path-agnostic activator (doesn't rely on URL)
   - Preserves Telerik grid, Select-All + per-row selectors
   - Appends Paid/Open badge inside Doc.# / Invoice # cell
   - Crawls all pages of AccountPayment_r.aspx (?pageIndex=)
   - Session cache (10 min), re-runs after Telerik postbacks
   - Adds optional Details toggle row (non-invasive)
   ========================================================= */

(function () {
  'use strict';

  if (window.__WL_INVOICES_ENHANCED__) return;
  window.__WL_INVOICES_ENHANCED__ = true;

  const VERSION = '1.7';
  const t0 = performance.now();
  const log  = (...a)=>console.log('%cINV','color:#005d6e;font-weight:700;',`v${VERSION} [+${(performance.now()-t0).toFixed(1)}ms]`,...a);
  const warn = (...a)=>console.warn('%cINV','color:#b45309;font-weight:700;',`v${VERSION} [+${(performance.now()-t0).toFixed(1)}ms]`,...a);

  /* -----------------------------
     Light CSS (safe; no layout overrides)
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
     Helpers
     ========================================================= */
  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

  async function waitFor(selector, {root=document, tries=50, interval=120} = {}){
    for (let i=0;i<tries;i++){
      const el = root.querySelector(selector);
      if (el) return el;
      await sleep(interval);
    }
    return null;
  }

  function getText(el){ return (el?.textContent || '').trim(); }

  /* =========================================================
     Build AccountPayment index (Doc# => { outstanding, type })
     - Scans ALL pages using #ctl00_PageBody_ctl31_Pager (or 30)
     - Caches for 10 minutes
     ========================================================= */
  const AP_CACHE_KEY = 'wl_ap_index_v2';
  const AP_CACHE_TTL_MS = 10 * 60 * 1000;

  async function buildAccountPaymentIndex(){
    try{
      const raw = sessionStorage.getItem(AP_CACHE_KEY);
      if (raw){
        const { at, data } = JSON.parse(raw);
        if (Date.now() - at < AP_CACHE_TTL_MS){
          const map = new Map(data);
          log('AP index from cache:', map.size);
          return map;
        }
      }
    }catch{}

    const index = new Map();
    const basePath = '/AccountPayment_r.aspx';
    const parser = new DOMParser();

    const toAbs = (href)=>{
      try{
        const u = new URL(href, location.origin + basePath);
        u.pathname = basePath; // normalize to the same page
        return u.toString();
      }catch{
        return basePath;
      }
    };

    const fetchText = async (url) => {
      const res = await fetch(url, { credentials:'same-origin', cache:'no-cache' });
      if (!res.ok) throw new Error('HTTP '+res.status);
      return res.text();
    };

    const parseRows = (doc)=>{
      const host = doc.querySelector('#ctl00_PageBody_InvoicesGrid') || doc;
      const tbl  = host.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || host.querySelector('.rgMasterTable');
      if (!tbl) return 0;

      let got = 0;
      const rows = tbl.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow');
      rows.forEach(tr=>{
        const type = getText(tr.querySelector('td[data-title="Type"]')) || getText(tr.querySelector('td:nth-child(2)'));
        // Prefer <span id="..._DocumentNumber">
        let docNo = getText(tr.querySelector('span[id*="_DocumentNumber"]'));
        if (!docNo){
          docNo = getText(tr.querySelector('td[data-title="Doc. #"] span')) ||
                  getText(tr.querySelector('td[data-title="Document #"] span')) ||
                  getText(tr.querySelector('td[data-title="Invoice #"] span'));
        }
        const outTxt = getText(tr.querySelector('td[data-title="Amount Outstanding"]')) || getText(tr.querySelector('td:nth-child(9)'));
        const outVal = parseFloat((outTxt||'').replace(/[^0-9.\-]/g,'') || '0');
        if (docNo){
          index.set(docNo, { outstanding: Number.isFinite(outVal) ? outVal : 0, type: (type||'').trim() });
          got++;
        }
      });
      return got;
    };

    const collectPagerHrefs = (doc)=>{
      const set = new Set();
      const pager = doc.querySelector('#ctl00_PageBody_ctl31_Pager') ||
                    doc.querySelector('#ctl00_PageBody_ctl30_Pager') ||
                    doc.querySelector('ul.pagination');
      if (pager){
        pager.querySelectorAll('a.page-link[href]').forEach(a=>{
          const href = a.getAttribute('href') || '';
          if (/pageIndex=\d+/.test(href)) set.add(toAbs(href));
        });
      }
      set.add(basePath); // ensure first page
      return Array.from(set);
    };

    try{
      // first page
      const firstHTML = await fetchText(basePath);
      const firstDoc  = parser.parseFromString(firstHTML, 'text/html');
      parseRows(firstDoc);

      const hrefs = collectPagerHrefs(firstDoc).filter(h => !h.endsWith('/AccountPayment_r.aspx'));
      if (hrefs.length){
        const results = await Promise.allSettled(hrefs.map(h=>fetchText(h)));
        results.forEach(r=>{
          if (r.status === 'fulfilled'){
            const d = parser.parseFromString(r.value, 'text/html');
            parseRows(d);
          }
        });
      }
      log('AP index built:', index.size);
    }catch(err){
      warn('AP crawl failed:', err);
    }

    try{
      sessionStorage.setItem(AP_CACHE_KEY, JSON.stringify({at: Date.now(), data: Array.from(index.entries())}));
    }catch{}

    return index;
  }

  if (!window.__WL_AP_INDEX_PROMISE__){
    window.__WL_AP_INDEX_PROMISE__ = buildAccountPaymentIndex();
  }
  const getAPIndex = ()=>window.__WL_AP_INDEX_PROMISE__;

  /* =========================================================
     Invoices grid detection (path-agnostic)
     ========================================================= */
  async function findInvoicesGrid(){
    // Prefer the known container id, but don't rely on URL
    const grid = await waitFor('#ctl00_PageBody_InvoicesGrid', {tries:60, interval:150});
    if (!grid) return null;

    // Telerik master table:
    const table = grid.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || grid.querySelector('.rgMasterTable');
    return table || null;
  }

  /* =========================================================
     Build header map → column indexes (by visible text)
     ========================================================= */
  function buildHeaderMap(masterTable){
    const map = {};
    const ths = masterTable.querySelectorAll('thead th');
    ths.forEach((th, i)=>{
      const txt = (th.textContent || '').replace(/\s+/g,' ').trim().toLowerCase();
      if (!txt) return;
      map[txt] = i;
    });
    return map;
  }

  function findDocCell(tr, headerMap){
    // Try by common header names
    const keys = ['invoice #','doc. #','document #','invoice no','invoice'];
    let idx = -1;
    for (const k of keys){
      if (headerMap[k] != null){ idx = headerMap[k]; break; }
    }
    if (idx >= 0 && tr.children[idx]) return tr.children[idx];

    // Robust fallbacks
    return tr.querySelector('td[data-title="Invoice #"], td[data-title="Doc. #"], td[data-title="Document #"]') || tr.querySelector('td:nth-child(1)');
  }

  function extractDocNumber(tr){
    // Prefer the explicit span used by Telerik
    let docNo = getText(tr.querySelector('span[id*="_DocumentNumber"]'));
    if (docNo) return docNo;

    // Otherwise: any span/anchor inside the doc cell
    const cell = findDocCell(tr, {});
    if (cell){
      docNo = getText(cell.querySelector('span, a'));
      if (docNo) return docNo;
    }

    // Last resort: first number with 4+ digits on the row
    const m = (tr.textContent||'').match(/\b(\d{4,})\b/);
    return m ? m[1] : '';
  }

  function computeColspan(masterTable, rows){
    const thead = masterTable.querySelector('thead');
    return thead ? thead.querySelectorAll('th').length : (rows[0]?.children?.length || 10);
  }

  function getDetailsHref(tr){
    const narrow = tr.querySelector('td.narrow-only a[href*="InvoiceDetails_r.aspx"]');
    if (narrow) return new URL(narrow.getAttribute('href'), location.origin).toString();
    const any = tr.querySelector('a[href*="InvoiceDetails_r.aspx"]');
    return any ? new URL(any.getAttribute('href'), location.origin).toString() : null;
  }

  /* =========================================================
     Apply badges (idempotent; safe to re-run)
     ========================================================= */
  async function applyBadges(masterTable){
    const rows = Array.from(masterTable.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
    if (!rows.length){ log('No invoice rows found'); return; }

    const headerMap = buildHeaderMap(masterTable);
    const colspan = computeColspan(masterTable, rows);
    const apIndex = await getAPIndex().catch(()=>null);

    rows.forEach(tr=>{
      // keep selector cells intact (first td often holds the checkbox/radio)
      const docCell = findDocCell(tr, headerMap);
      if (!docCell) return;

      // Add badge once
      let badge = docCell.querySelector('.wl-badge');
      if (!badge){
        badge = document.createElement('span');
        badge.className = 'wl-badge wl-badge--slate';
        badge.innerHTML = '<span class="wl-skel">checking…</span>';
        docCell.appendChild(badge);
      }

      // Add optional Details toggle (does not replace any cell)
      let toggle = docCell.querySelector('.wl-details-toggle');
      if (!toggle){
        const href = getDetailsHref(tr);
        if (href){
          toggle = document.createElement('button');
          toggle.type = 'button';
          toggle.className = 'wl-details-toggle';
          toggle.textContent = 'Details';
          docCell.appendChild(toggle);

          let open = false;
          let detailsTr = null;

          toggle.addEventListener('click', async ()=>{
            open = !open;
            toggle.textContent = open ? 'Hide' : 'Details';
            if (open && !detailsTr){
              detailsTr = document.createElement('tr');
              detailsTr.className = 'wl-details-row';
              const td = document.createElement('td');
              td.colSpan = colspan;
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
                    const pick = sel => getText(r2.querySelector(sel));
                    const code = pick('td[data-title="Product Code"]');
                    const desc = pick('td[data-title="Description"]');
                    const qty  = pick('td[data-title="Qty"]');
                    const tot  = pick('td[data-title="Total"]');
                    if (code || desc) lines.push({code, desc, qty, tot});
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

      // Resolve invoice number and set status
      (async ()=>{
        const docNo = extractDocNumber(tr);
        if (!docNo){
          badge.className = 'wl-badge wl-badge--slate';
          badge.textContent = 'No Doc #';
          return;
        }

        let info = apIndex && apIndex.get(docNo);
        // only consider "Invoice" entries; ignore credits on AP
        if (info && (info.type||'').toLowerCase() !== 'invoice') info = null;

        if (!info){
          badge.className = 'wl-badge wl-badge--green';
          badge.textContent = 'Paid';
        }else{
          const amt = Number(info.outstanding) || 0;
          if (amt > 0.009){
            badge.className = 'wl-badge wl-badge--amber';
            badge.textContent = `Open · ${amt.toLocaleString(undefined,{style:'currency',currency:'USD'})}`;
            badge.title = 'Amount Outstanding (Account Payment)';
          }else{
            badge.className = 'wl-badge wl-badge--green';
            badge.textContent = 'Paid';
          }
        }
      })().catch(err=>{
        warn('status error', err);
        badge.className = 'wl-badge wl-badge--slate';
        badge.textContent = 'Status unavailable';
      });
    });

    log('Badges applied to rows:', rows.length);
  }

  /* =========================================================
     Re-apply after Telerik postbacks / paging / sorting
     ========================================================= */
  function attachGridObserver(gridRoot, masterTable){
    // When Telerik rebinds, tbody is replaced — observe and re-run
    const target = gridRoot || masterTable?.parentElement || document.body;
    if (!target) return;
    const mo = new MutationObserver((muts)=>{
      for (const m of muts){
        if (m.type === 'childList'){
          // If the master table was replaced or tbody changed, re-apply
          const newMaster = gridRoot.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || gridRoot.querySelector('.rgMasterTable');
          if (newMaster){
            // debounce a tick so DOM settles
            requestAnimationFrame(()=>applyBadges(newMaster));
          }
        }
      }
    });
    mo.observe(target, { subtree:true, childList:true });
    log('Grid observer attached');
  }

  /* =========================================================
     Invoice details page header badge
     ========================================================= */
  async function enhanceInvoiceDetailsPage(){
    if (!/InvoiceDetails_r\.aspx/i.test(location.pathname)) return;
    const container = document.querySelector('.bodyFlexContainer');
    const hdr = document.querySelector('.bodyFlexItem.listPageHeader');
    if (!container) return;

    let invNo = '';
    if (hdr){
      const m = (hdr.textContent||'').match(/\b(\d{4,})\b/);
      if (m) invNo = m[1];
    }

    const head = document.createElement('div');
    head.style.cssText = 'display:flex;gap:12px;align-items:center;justify-content:space-between;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:12px 14px;box-shadow:0 6px 18px rgba(0,0,0,.05);margin-bottom:10px;';
    head.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <div style="font-weight:900;font-size:20px">Invoice #${invNo||''}</div>
        <span class="wl-badge wl-badge--slate"><span class="wl-skel">checking…</span></span>
      </div>
    `;
    container.insertAdjacentElement('afterbegin', head);

    try{
      const idx = await getAPIndex();
      let info = invNo ? idx.get(invNo) : null;
      if (info && (info.type||'').toLowerCase() !== 'invoice') info = null;

      const badge = head.querySelector('.wl-badge');
      if (!info){
        badge.className = 'wl-badge wl-badge--green'; badge.textContent = 'Paid';
      }else{
        const amt = info.outstanding || 0;
        if (amt > 0.009){
          badge.className = 'wl-badge wl-badge--amber';
          badge.textContent = `Open · ${amt.toLocaleString(undefined,{style:'currency',currency:'USD'})}`;
        }else{
          badge.className = 'wl-badge wl-badge--green'; badge.textContent = 'Paid';
        }
      }
      log('Details badge set for invoice', invNo);
    }catch(err){
      warn('Details badge error', err);
    }
  }

  /* =========================================================
     Back to My Account button (above search panel if present)
     ========================================================= */
  function addBackToAccount(){
    const panel = document.getElementById("ctl00_PageBody_Panel1");
    if (!panel) return;
    if (document.getElementById('wl-back-account')) return;
    const backBtn = document.createElement("a");
    backBtn.id = 'wl-back-account';
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
  }

  /* =========================================================
     Boot
     ========================================================= */
  async function boot(){
    addBackToAccount();
    enhanceInvoiceDetailsPage();

    const gridRoot = await waitFor('#ctl00_PageBody_InvoicesGrid', {tries:60, interval:150});
    if (!gridRoot){
      log('No #ctl00_PageBody_InvoicesGrid found on this page');
      return;
    }
    const master = gridRoot.querySelector('#ctl00_PageBody_InvoicesGrid_ctl00') || gridRoot.querySelector('.rgMasterTable');
    if (!master){
      log('No master table found under invoices grid');
      return;
    }

    log('Invoices grid detected — applying badges...');
    await applyBadges(master);
    attachGridObserver(gridRoot, master);
  }

  // Run after DOM ready (and again after load, just in case)
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
  window.addEventListener('load', ()=>boot(), { once:true });

  // Expose manual trigger for debugging
  window.WLInvoices = { run: boot, version: VERSION };

})();
