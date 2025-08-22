console.log("[BulkPricing] Script loaded.");

// Force a short delay to ensure DOM is fully parsed before running
setTimeout(async () => {
  console.log("[BulkPricing] Executing after slight delay...");

  try {
    // Step 1: Extract PID from the image link
    const productImageLink = document.querySelector("#ProductImageRow a")?.href;
    console.log("[BulkPricing] Product link:", productImageLink);

    const pidMatch = productImageLink?.match(/pid=(\d+)/);
    const pid = pidMatch ? pidMatch[1] : null;
    console.log("[BulkPricing] Parsed PID:", pid);

    if (!pid) {
      console.warn("[BulkPricing] PID not found, exiting.");
      return;
    }

    // Step 2: Fetch the Google Sheet CSV
    const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRmHLHJE9OebjPpi7wMvOHxX6fOdarKQRRbd1W-Vf2o04kLwd9kc0jpm78WFCU4y1ErzCIWVqoUvAwn/pub?output=csv";
    const response = await fetch(sheetUrl);
    const csvText = await response.text();

    console.log("[BulkPricing] Fetched CSV (first 200 chars):", csvText.slice(0, 200));

    // Step 3: Parse CSV with case-insensitive headers
    const rows = csvText.trim().split("\n").map(row => row.split(","));
    const headers = rows[0].map(h => h.trim().toLowerCase());
    const dataRows = rows.slice(1);

    const pidIndex = headers.indexOf("pid");
    const qtyIndex = headers.indexOf("qty");
    const priceIndex = headers.indexOf("price");

    console.log("[BulkPricing] Header indices:", { pidIndex, qtyIndex, priceIndex });

    if (pidIndex === -1 || qtyIndex === -1 || priceIndex === -1) {
      console.error("[BulkPricing] Required headers not found: 'pid', 'qty', 'price'");
      return;
    }

    // Step 4: Filter for matching PID
    const matchingRows = dataRows.filter(row => row[pidIndex] === pid);
    console.log(`[BulkPricing] Found ${matchingRows.length} rows for pid ${pid}`);

    if (matchingRows.length === 0) {
      console.log("[BulkPricing] No bulk pricing available for this product.");
      return;
    }

    // Step 5: Build and insert TR after PriceRow
    const bulkPriceRow = document.createElement("tr");
    bulkPriceRow.id = "BulkPricingRow";

    const td = document.createElement("td");
    td.colSpan = 1;
    td.innerHTML = `
  <div style="
    text-align: center;
    font-weight: bold;
    color: #2c3e70;
    font-size: 1.10em;
    padding: 4px 0;
  ">
    Bulk Price: 
    ${matchingRows.map(row => {
      const qty = row[qtyIndex];
      const price = row[priceIndex];
      return price ? `${qty} or more at $${price} ea` : `${qty} or more (price missing)`;
    }).join(" • ")}
  </div>
`;



    bulkPriceRow.appendChild(td);

    const priceRow = document.getElementById("PriceRow");
    if (priceRow) {
      priceRow.parentNode.insertBefore(bulkPriceRow, priceRow.nextSibling);
      console.log("[BulkPricing] Bulk pricing row inserted.");
    } else {
      console.warn("[BulkPricing] Could not find #PriceRow to insert after.");
    }

  } catch (err) {
    console.error("[BulkPricing] Error in script:", err);
  }

}, 500);


























































/* ==========================================================
   Woodson — Bulk Pricing Banner (ProductDetail)
   - Runs only on ProductDetail.aspx
   - Detects PID robustly (URL, stock button, qty_ ID, etc.)
   - Pulls tiers from Google Sheet (pid, qty, price)
   - Injects a "WOODSON BULK" banner below Add to Cart
   ========================================================== */
(function(){
  'use strict';
  if (!/ProductDetail\.aspx/i.test(location.pathname)) return;

  const LOG_PREFIX = '[BulkBanner]';
  const SHEET_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRmHLHJE9OebjPpi7wMvOHxX6fOdarKQRRbd1W-Vf2o04kLwd9kc0jpm78WFCU4y1ErzCIWVqoUvAwn/pub?output=csv';

  /* ---------- tiny utils ---------- */
  const log  = (...a)=>console.log(LOG_PREFIX, ...a);
  const warn = (...a)=>console.warn(LOG_PREFIX, ...a);
  const err  = (...a)=>console.error(LOG_PREFIX, ...a);

  // Wait until an element exists, with small retries
  function waitFor(sel, timeout=6000, step=150){
    return new Promise((resolve, reject)=>{
      const t0 = Date.now();
      (function tick(){
        const el = document.querySelector(sel);
        if (el) return resolve(el);
        if (Date.now() - t0 > timeout) return reject(new Error('Timeout waiting for '+sel));
        setTimeout(tick, step);
      })();
    });
  }

  function insertAfter(refEl, newEl){
    if (!refEl?.parentNode) return;
    if (refEl.nextSibling) refEl.parentNode.insertBefore(newEl, refEl.nextSibling);
    else refEl.parentNode.appendChild(newEl);
  }

  // Minimal CSV row parser (handles quoted fields and escaped quotes)
  function parseCSVLine(line){
    const out = [];
    let cur = '';
    let q = false;
    for (let i=0; i<line.length; i++){
      const c = line[i];
      if (c === '"'){
        if (q && line[i+1] === '"'){ cur += '"'; i++; }
        else q = !q;
      } else if (c === ',' && !q){
        out.push(cur); cur = '';
      } else {
        cur += c;
      }
    }
    out.push(cur);
    return out;
  }

  function parseCSV(text){
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l=>l.trim().length);
    if (!lines.length) return { headers:[], rows:[] };
    const headers = parseCSVLine(lines[0]).map(h=>String(h || '').trim().toLowerCase());
    const rows = lines.slice(1).map(l => parseCSVLine(l));
    return { headers, rows };
  }

  function getPID(){
    // 1) URL param
    try {
      const u = new URL(location.href);
      const qp = u.searchParams.get('pid');
      if (qp && /^\d+$/.test(qp)) return qp;
    } catch {}

    // 2) #ProductImageRow a (older pattern)
    try {
      const href = document.querySelector('#ProductImageRow a')?.href || '';
      const m = href.match(/pid=(\d+)/i);
      if (m) return m[1];
    } catch {}

    // 3) Any onclick containing productid=####
    try {
      const el = [...document.querySelectorAll('[onclick]')].find(e => /productid=\d+/.test(e.getAttribute('onclick')||''));
      if (el){
        const m = el.getAttribute('onclick').match(/productid=(\d+)/);
        if (m) return m[1];
      }
    } catch {}

    // 4) openStockModal('####', ...)
    try {
      const el2 = [...document.querySelectorAll('[onclick]')].find(e => /openStockModal\(['"]\d+['"]/.test(e.getAttribute('onclick')||''));
      if (el2){
        const m = el2.getAttribute('onclick').match(/openStockModal\(['"](\d+)['"]/);
        if (m) return m[1];
      }
    } catch {}

    // 5) qty_#### pattern
    try {
      const qty = document.querySelector('input[id*="_qty_"]');
      if (qty){
        const m = qty.id.match(/_qty_(\d+)/);
        if (m) return m[1];
      }
    } catch {}

    return null;
  }

  function fmtMoney(v){
    const n = parseFloat(String(v).replace(/[^0-9.\-]/g,''));
    return Number.isFinite(n) ? n.toFixed(2) : String(v);
  }

  function buildBannerHTML(tiers){
    const chips = tiers.map(t => {
      const qty = t.qty;
      const price = fmtMoney(t.price);
      return `<span class="wbk-chip">${qty}+ <strong>$${price}</strong></span>`;
    }).join('');

    return `
      <div id="woodson-bulk-banner" class="wbk">
        <div class="wbk-head">
          <span class="wbk-badge">WOODSON BULK</span>
          <span class="wbk-sub">Save more when you buy more</span>
        </div>
        <div class="wbk-tiers">${chips}</div>
      </div>
    `;
  }

  function injectStyles(){
    if (document.getElementById('wbk-styles')) return;
    const css = `
      .wbk{border:2px solid #6b0016;border-radius:12px;padding:14px 14px 12px;background:linear-gradient(180deg,#fff, #fff8fa);box-shadow:0 4px 14px rgba(0,0,0,.06);margin-top:10px}
      .wbk-head{display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap}
      .wbk-badge{display:inline-block;font-weight:800;letter-spacing:.4px;background:#6b0016;color:#fff;padding:6px 10px;border-radius:999px;font-size:12px}
      .wbk-sub{color:#6b0016;font-weight:600;font-size:13px}
      .wbk-tiers{display:flex;flex-wrap:wrap;gap:8px}
      .wbk-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid #e2c3cb;background:#fff;border-radius:999px;padding:6px 10px;font-size:13px}
      .wbk-chip strong{font-weight:800}
      @media (min-width: 480px){
        .wbk{padding:16px}
        .wbk-sub{font-size:14px}
        .wbk-chip{font-size:14px}
      }
    `;
    const style = document.createElement('style');
    style.id = 'wbk-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  async function main(){
    // Ensure sidebar is present (so we can place under Add to Cart)
    await waitFor('#product-sidebar .buy-box').catch(()=>{});
    const buyBox = document.querySelector('#product-sidebar .buy-box');
    if (!buyBox) { warn('No .buy-box found; aborting.'); return; }

    const pid = getPID();
    log('Detected PID:', pid);
    if (!pid){ warn('PID not found; aborting.'); return; }

    let csvText = '';
    try{
      const res = await fetch(SHEET_CSV, { cache: 'no-store' });
      csvText = await res.text();
    }catch(e){
      err('Failed to fetch CSV', e);
      return;
    }

    const { headers, rows } = parseCSV(csvText);
    const h = Object.fromEntries(headers.map((v,i)=>[v,i]));
    if (h.pid == null || h.qty == null || h.price == null){
      err('CSV missing required headers (pid, qty, price). Found:', headers);
      return;
    }

    const tiers = rows
      .filter(r => String((r[h.pid]||'').trim()) === String(pid))
      .map(r => ({
        pid: String(r[h.pid]||'').trim(),
        qty: parseFloat(String(r[h.qty]||'').replace(/[^0-9.]/g,'')) || 0,
        price: parseFloat(String(r[h.price]||'').replace(/[^0-9.]/g,'')) || 0
      }))
      .filter(t => t.qty > 0 && t.price > 0)
      .sort((a,b)=> a.qty - b.qty);

    if (!tiers.length){
      log('No bulk tiers for pid', pid);
      return;
    }

    injectStyles();

    // Find the Add to Cart row; default to bottom of buy-box if not found
    const addToCart = buyBox.querySelector('#ctl00_PageBody_productDetail_ctl00_AddProductButton');
    const addRow = addToCart ? addToCart.closest('.mb-1') || addToCart.parentElement : null;

    // Avoid duplicates
    if (buyBox.querySelector('#woodson-bulk-banner')){
      log('Banner already present, skipping injection.');
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildBannerHTML(tiers);
    const banner = wrapper.firstElementChild;

    if (addRow){
      insertAfter(addRow, banner);
      log('Banner inserted below Add to Cart.');
    } else {
      buyBox.appendChild(banner);
      log('Add to Cart not found; banner appended to .buy-box.');
    }
  }

  // Small delay to let WebForms finish initial DOM writes
  setTimeout(()=>{ main().catch(e=>err('Unhandled error:', e)); }, 400);
})();

