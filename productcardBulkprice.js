
console.log("[BulkPricing] Script loaded (multi-card).");

(function () {
  'use strict';

  // Small wait so WebForms/grids finish rendering
  setTimeout(init, 500);

  async function init() {
    try {
      console.log("[BulkPricing] Executing after slight delay…");

      // 1) Collect all product links that have a pid
      const productLinks = Array.from(document.querySelectorAll('a[href*="pid="]'));
      if (!productLinks.length) {
        console.warn("[BulkPricing] No product links with pid= found.");
        return;
      }

      // 2) Fetch + parse sheet ONCE
      const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRmHLHJE9OebjPpi7wMvOHxX6fOdarKQRRbd1W-Vf2o04kLwd9kc0jpm78WFCU4y1ErzCIWVqoUvAwn/pub?output=csv";
      const csvText = await (await fetch(sheetUrl)).text();
      console.log("[BulkPricing] CSV fetched. (first 200 chars)", csvText.slice(0, 200));

      const { headers, rows } = quickCSV(csvText);
      const toIdx = (name) => headers.indexOf(name.toLowerCase());
      const pidIdx   = toIdx("pid");
      const qtyIdx   = toIdx("qty");
      const priceIdx = toIdx("price");

      if (pidIdx === -1 || qtyIdx === -1 || priceIdx === -1) {
        console.error("[BulkPricing] Required headers not found: 'pid', 'qty', 'price'");
        return;
      }

      // Build a lookup: pid -> [{qty, price}, …]
      const tiersByPid = new Map();
      for (const r of rows) {
        const pid = (r[pidIdx] || "").trim();
        if (!pid) continue;
        const tier = {
          qty: (r[qtyIdx] || "").trim(),
          price: (r[priceIdx] || "").trim()
        };
        if (!tiersByPid.has(pid)) tiersByPid.set(pid, []);
        tiersByPid.get(pid).push(tier);
      }

      // 3) For each product card/link, insert the bulk pricing row (if any)
      let insertedCount = 0;
      for (const a of productLinks) {
        const pidMatch = a.href.match(/pid=(\d+)/i);
        const pid = pidMatch ? pidMatch[1] : null;
        if (!pid) continue;

        const tiers = tiersByPid.get(pid);
        if (!tiers || !tiers.length) {
          // No bulk tiers for this pid
          continue;
        }

        // Find the nearest "card" container (table/row/div) to keep scope tight
        const cardRoot =
          a.closest('table') ||
          a.closest('.card, .product-card, .row, tr') ||
          a.parentElement;

        if (!cardRoot) continue;

        // Avoid duplicate inserts on the same card
        if (cardRoot.querySelector('.wl-bulk-pricing-row')) continue;

        // Locate the price row within THIS card
        // Try a few common patterns, scoped to cardRoot
        const priceRow =
          cardRoot.querySelector('tr#PriceRow') ||
          cardRoot.querySelector('tr[id$="PriceRow"]') ||
          cardRoot.querySelector('tr.PriceRow') ||
          // Fallbacks: a row that contains a price label/value
          Array.from(cardRoot.querySelectorAll('tr')).find(tr =>
            /\bprice\b/i.test(tr.textContent || '')
          );

        // Build the row we’ll insert
        const bulkTr = document.createElement('tr');
        bulkTr.className = 'wl-bulk-pricing-row';
        const td = document.createElement('td');
        td.colSpan = (priceRow && priceRow.children.length) ? priceRow.children.length : 1;

        const line = tiers.map(t => {
          const q = t.qty || 'Qty';
          const p = t.price ? `$${t.price}` : '(price missing)';
          return `${q}+ at ${p} ea`;
        }).join(' • ');

        td.innerHTML = `
          <div style="
            text-align:center;
            font-weight:600;
            color:#2c3e70;
            font-size:1.05em;
            padding:4px 0;
          ">
            Bulk Price: ${line}
          </div>
        `;
        bulkTr.appendChild(td);

        if (priceRow && priceRow.parentNode) {
          priceRow.parentNode.insertBefore(bulkTr, priceRow.nextSibling);
          insertedCount++;
        } else {
          // If we can’t find a price row, append at end of the local table/card
          (cardRoot.querySelector('tbody') || cardRoot).appendChild(bulkTr);
          insertedCount++;
          console.warn("[BulkPricing] Price row not found; appended bulk row to card root.", { pid });
        }
      }

      console.log(`[BulkPricing] Inserted bulk pricing on ${insertedCount} card(s).`);

    } catch (err) {
      console.error("[BulkPricing] Error:", err);
    }
  }

  // Simple CSV that handles quoted fields (commas inside quotes)
  function quickCSV(text) {
    const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
    const parseLine = (line) => {
      const out = [];
      let cur = '';
      let inQ = false;

      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"' ) {
          if (inQ && line[i+1] === '"') { // escaped quote
            cur += '"'; i++;
          } else {
            inQ = !inQ;
          }
        } else if (ch === ',' && !inQ) {
          out.push(cur); cur = '';
        } else {
          cur += ch;
        }
      }
      out.push(cur);
      return out.map(s => s.trim());
    };

    const header = parseLine(lines.shift());
    const lowerHeaders = header.map(h => h.toLowerCase());
    const rows = lines.map(parseLine);
    return { headers: lowerHeaders, rows };
  }

})();

























































/* ==========================================================
   Woodson — Bulk Pricing Banner (ProductDetail) + Click-to-Qty
   - Runs only on ProductDetail.aspx
   - Detects PID robustly (URL, stock btn, qty_ ID, etc.)
   - Pulls tiers from Google Sheet (pid, qty, price)
   - Shows a "WOODSON BULK" banner under Add to Cart
   - Clicking a tier sets the qty input and highlights price
   ========================================================== */
(function(){
  'use strict';
  if (!/ProductDetail\.aspx/i.test(location.pathname)) return;

  const LOG = (...a)=>console.log('[BulkBanner]', ...a);
  const WARN = (...a)=>console.warn('[BulkBanner]', ...a);
  const ERR = (...a)=>console.error('[BulkBanner]', ...a);

  const SHEET_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRmHLHJE9OebjPpi7wMvOHxX6fOdarKQRRbd1W-Vf2o04kLwd9kc0jpm78WFCU4y1ErzCIWVqoUvAwn/pub?output=csv';

  /* ---------- helpers ---------- */
  function waitFor(sel, timeout=6000, step=120){
    return new Promise((resolve, reject)=>{
      const t0 = Date.now();
      (function poll(){
        const el = document.querySelector(sel);
        if (el) return resolve(el);
        if (Date.now()-t0 > timeout) return reject(new Error('Timeout: '+sel));
        setTimeout(poll, step);
      })();
    });
  }
  function insertAfter(refEl, newEl){
    if (!refEl?.parentNode) return;
    if (refEl.nextSibling) refEl.parentNode.insertBefore(newEl, refEl.nextSibling);
    else refEl.parentNode.appendChild(newEl);
  }
  function parseCSVLine(line){
    const out = []; let cur=''; let q=false;
    for (let i=0;i<line.length;i++){
      const c=line[i];
      if (c === '"'){
        if (q && line[i+1] === '"'){ cur+='"'; i++; }
        else q = !q;
      } else if (c===',' && !q){ out.push(cur); cur=''; }
      else cur += c;
    }
    out.push(cur); return out;
  }
  function parseCSV(text){
    const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(l=>l.trim());
    if (!lines.length) return {headers:[],rows:[]};
    const headers = parseCSVLine(lines[0]).map(h=>String(h||'').trim().toLowerCase());
    const rows = lines.slice(1).map(parseCSVLine);
    return {headers,rows};
  }
  function getPID(){
    try { const u=new URL(location.href); const p=u.searchParams.get('pid'); if (p && /^\d+$/.test(p)) return p; } catch{}
    try { const href=document.querySelector('#ProductImageRow a')?.href||''; const m=href.match(/pid=(\d+)/i); if (m) return m[1]; } catch{}
    try { const el=[...document.querySelectorAll('[onclick]')].find(e=>/productid=\d+/.test(e.getAttribute('onclick')||'')); if (el){ const m=el.getAttribute('onclick').match(/productid=(\d+)/); if (m) return m[1]; } } catch{}
    try { const el=[...document.querySelectorAll('[onclick]')].find(e=>/openStockModal\(['"]\d+['"]/.test(e.getAttribute('onclick')||'')); if (el){ const m=el.getAttribute('onclick').match(/openStockModal\(['"](\d+)['"]/); if (m) return m[1]; } } catch{}
    try { const qty=document.querySelector('input.productQtyInput,[id*="_qty_"]'); if (qty){ const m=qty.id.match(/_qty_(\d+)/); if (m) return m[1]; } } catch{}
    return null;
  }
  const money = v => {
    const n = parseFloat(String(v).replace(/[^0-9.\-]/g,'')); 
    return Number.isFinite(n) ? n.toFixed(2) : String(v);
  };

  function injectStyles(){
    if (document.getElementById('wbk-styles')) return;
    const style = document.createElement('style');
    style.id = 'wbk-styles';
    style.textContent = `
      .wbk{border:2px solid #6b0016;border-radius:12px;padding:14px 14px 12px;background:linear-gradient(180deg,#fff,#fff8fa);box-shadow:0 4px 14px rgba(0,0,0,.06);margin-top:10px}
      .wbk-head{display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap}
      .wbk-badge{display:inline-block;font-weight:800;letter-spacing:.4px;background:#6b0016;color:#fff;padding:6px 10px;border-radius:999px;font-size:12px}
      .wbk-sub{color:#6b0016;font-weight:600;font-size:13px}
      .wbk-tiers{display:flex;flex-wrap:wrap;gap:8px}
      .wbk-chip{appearance:none;border:1px solid #e2c3cb;background:#fff;border-radius:999px;padding:6px 12px;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:transform .05s ease, box-shadow .15s ease}
      .wbk-chip:active{transform:translateY(1px)}
      .wbk-chip strong{font-weight:800}
      .wbk-chip[data-active="true"]{border-color:#6b0016;box-shadow:0 0 0 3px rgba(107,0,22,.1)}
      .wbk-foot{margin-top:10px;font-size:12px;color:#444;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
      .wbk-applied{font-weight:700;color:#2c3e50}
      .wbk-note{opacity:.85}
      @media (min-width:480px){ .wbk-sub{font-size:14px} .wbk-chip{font-size:14px} }
      .wbk-flash{animation:wbkflash .8s ease}
      @keyframes wbkflash { 0%{background:#fff8fa} 100%{background:transparent} }
    `;
    document.head.appendChild(style);
  }

  function buildBanner(tiers){
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div id="woodson-bulk-banner" class="wbk" aria-live="polite">
        <div class="wbk-head">
          <span class="wbk-badge">WOODSON BULK</span>
          <span class="wbk-sub">Save more when you buy more</span>
        </div>
        <div class="wbk-tiers">
          ${tiers.map(t => `
            <button class="wbk-chip" type="button" role="button"
                data-qty="${t.qty}" data-price="${t.price}"
                aria-label="Set quantity to ${t.qty} for $${money(t.price)} per each">
              <span>${t.qty}+</span> <strong>$${money(t.price)}</strong>
            </button>
          `).join('')}
        </div>
        <div class="wbk-foot">
          <span class="wbk-applied" id="wbk-applied-text">Add a quantity to see bulk price.</span>
          <span class="wbk-note">Displayed bulk pricing reflects at checkout if eligible.</span>
        </div>
      </div>
    `;
    return wrap.firstElementChild;
  }

  function findQtyInput(buyBox){
    // Prefer explicit productQtyInput class
    let inp = buyBox.querySelector('input.productQtyInput');
    if (!inp) inp = buyBox.querySelector('input[id*="_qty_"]');
    return inp;
  }

  function getBestTierForQty(tiers, qty){
    // Highest tier whose qty <= current qty
    const q = Number(qty)||0;
    let best=null;
    for(const t of tiers){ if (q >= t.qty) best = t; else break; }
    return best;
  }

  function setQty(input, n){
    if (!input) return;
    input.value = String(n);
    // Fire events so any site scripts react
    input.dispatchEvent(new Event('input', {bubbles:true}));
    input.dispatchEvent(new Event('change', {bubbles:true}));
    // Visual flash for feedback
    input.classList.add('wbk-flash');
    setTimeout(()=>input.classList.remove('wbk-flash'), 900);
  }

  function wireInteractions(banner, buyBox, tiers){
    const chips = [...banner.querySelectorAll('.wbk-chip')];
    const applied = banner.querySelector('#wbk-applied-text');
    const qtyInput = findQtyInput(buyBox);

    function refreshUI(){
      const currentQty = Number(qtyInput?.value || 0);
      const best = getBestTierForQty(tiers, currentQty);
      chips.forEach(ch => {
        const q = Number(ch.dataset.qty);
        ch.dataset.active = String(currentQty >= q);
      });
      if (best){
        applied.textContent = `Qty ${currentQty} → $${money(best.price)}/ea`;
      } else {
        applied.textContent = currentQty > 0
          ? `Qty ${currentQty} → Standard price/ea`
          : 'Add a quantity to see bulk price.';
      }
    }

    // Clicking a chip sets the qty and updates applied price
    banner.addEventListener('click', (e)=>{
      const btn = e.target.closest('.wbk-chip');
      if (!btn) return;
      const q = Number(btn.dataset.qty);
      if (!q) return;
      const input = findQtyInput(buyBox);
      setQty(input, q);
      refreshUI();
    });

    // Keep banner in sync if user types or uses +/- buttons
    if (qtyInput){
      qtyInput.addEventListener('input', refreshUI);
      qtyInput.addEventListener('change', refreshUI);
      // Initial sync
      refreshUI();
    }
  }

  async function main(){
    await waitFor('#product-sidebar .buy-box').catch(()=>{});
    const buyBox = document.querySelector('#product-sidebar .buy-box');
    if (!buyBox){ WARN('No .buy-box found'); return; }

    const pid = getPID();
    LOG('PID:', pid);
    if (!pid){ WARN('PID not found'); return; }

    let text='';
    try{
      const res = await fetch(SHEET_CSV, {cache:'no-store'});
      text = await res.text();
    }catch(e){ ERR('CSV fetch failed', e); return; }

    const {headers, rows} = parseCSV(text);
    const h = Object.fromEntries(headers.map((v,i)=>[v,i]));
    if (h.pid==null || h.qty==null || h.price==null){
      ERR('CSV missing required headers (pid, qty, price):', headers);
      return;
    }

    const tiers = rows
      .filter(r => String((r[h.pid]||'').trim()) === String(pid))
      .map(r => ({
        qty: parseFloat(String(r[h.qty]||'').replace(/[^0-9.]/g,'')) || 0,
        price: parseFloat(String(r[h.price]||'').replace(/[^0-9.]/g,'')) || 0
      }))
      .filter(t => t.qty>0 && t.price>0)
      .sort((a,b)=> a.qty - b.qty);

    if (!tiers.length){ LOG('No tiers found for pid', pid); return; }

    injectStyles();

    // Place the banner just under the Add to Cart row
    const addToCart = buyBox.querySelector('#ctl00_PageBody_productDetail_ctl00_AddProductButton');
    const addRow = addToCart ? addToCart.closest('.mb-1') || addToCart.parentElement : null;

    if (buyBox.querySelector('#woodson-bulk-banner')){ LOG('Banner already present'); return; }

    const banner = buildBanner(tiers);
    if (addRow) insertAfter(addRow, banner); else buyBox.appendChild(banner);

    wireInteractions(banner, buyBox, tiers);
    LOG('Banner injected and wired.');
  }

  setTimeout(()=>{ main().catch(e=>ERR('Unhandled:', e)); }, 350);
})();

