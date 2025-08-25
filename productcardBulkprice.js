console.log("[BulkPricing] Script loaded (per-row scope).");

(function () {
  'use strict';
  setTimeout(init, 500);

  async function init() {
    try {
      const productAnchors = Array.from(
        document.querySelectorAll('tr[id*="ProductImageRow"] a[href*="pid="], a[href*="pid="][id*="ProductImageRow"]')
      );
      if (!productAnchors.length) {
        console.warn("[BulkPricing] No product anchors found under ProductImageRow.");
        return;
      }

      const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRmHLHJE9OebjPpi7wMvOHxX6fOdarKQRRbd1W-Vf2o04kLwd9kc0jpm78WFCU4y1ErzCIWVqoUvAwn/pub?output=csv";
      const csvText = await (await fetch(sheetUrl)).text();
      const { headers, rows } = quickCSV(csvText);

      const idx = (h) => headers.indexOf(h.toLowerCase());
      const pidIdx = idx("pid"), qtyIdx = idx("qty"), priceIdx = idx("price");
      if (pidIdx < 0 || qtyIdx < 0 || priceIdx < 0) {
        console.error("[BulkPricing] Missing required headers pid/qty/price.");
        return;
      }

      const tiersByPid = new Map();
      for (const r of rows) {
        const pid = (r[pidIdx] || "").trim();
        if (!pid) continue;
        const tier = { qty: (r[qtyIdx] || "").trim(), price: (r[priceIdx] || "").trim() };
        if (!tiersByPid.has(pid)) tiersByPid.set(pid, []);
        tiersByPid.get(pid).push(tier);
      }

      let inserted = 0;

      for (const a of productAnchors) {
        const pidMatch = a.href.match(/pid=(\d+)/i);
        const pid = pidMatch ? pidMatch[1] : null;
        if (!pid) continue;

        const tiers = tiersByPid.get(pid);
        if (!tiers || !tiers.length) continue;

        const imgRow = a.closest('tr');
        if (!imgRow) continue;
        if (imgRow.dataset.bulkApplied === "1") continue;

        const tbody = imgRow.closest('tbody') || imgRow.parentElement;

        // find the "block" for this card = rows until the next ProductImageRow
        const blockRows = collectBlockRows(imgRow);

        // prefer an explicit price row if present
        const priceRow = blockRows.find(tr =>
          /PriceRow/i.test(tr.id || "") || tr.classList?.contains("PriceRow")
        ) || null;

        // --- KEY: Get customer price strictly within this card block
        const customerPrice = findCustomerPriceInBlock(blockRows, priceRow);

        // If we can't find a customer price, do NOT show the banner (fail-safe)
        if (!Number.isFinite(customerPrice) || customerPrice <= 0) {
          console.debug("[BulkPricing] No customer price found in this card; skipping banner for pid:", pid);
          continue;
        }

        // Compute the lowest bulk price from tiers (sheet uses plain numbers like 26.72)
        const minBulkPrice = tiers
          .map(t => parseMoney(t.price))   // handles "26.72" and safety
          .filter(v => Number.isFinite(v) && v > 0)
          .reduce((min, v) => Math.min(min, v), Infinity);

        // If customer price is cheaper or equal, don't show banner
        if (Number.isFinite(minBulkPrice) && customerPrice <= minBulkPrice) {
          console.debug(`[BulkPricing] Skip: customer ${customerPrice} <= min bulk ${minBulkPrice} (pid ${pid})`);
          continue;
        }

        // Build row text
        const line = tiers.map(t => {
          const q = t.qty || 'Qty';
          const p = parseMoney(t.price);
          const pTxt = Number.isFinite(p) ? `$${p.toFixed(2)}` : '(price missing)';
          return `${q}+ at ${pTxt} ea`;
        }).join(' • ');

        // Insert banner after priceRow if available, else after image row
        const insertAfter = priceRow || imgRow;
        const bulkTr = document.createElement('tr');
        bulkTr.className = 'wl-bulk-pricing-row';
        const td = document.createElement('td');
        td.colSpan = (insertAfter.children?.length || imgRow.children?.length || 1);
        td.innerHTML = `
          <div style="text-align:center;font-weight:600;color:#2c3e70;font-size:1.05em;padding:4px 0;">
            Bulk Price: ${line}
          </div>`;
        bulkTr.appendChild(td);
        insertAfter.after(bulkTr);

        imgRow.dataset.bulkApplied = "1";
        inserted++;
      }

      console.log(`[BulkPricing] Inserted bulk pricing on ${inserted} item(s).`);
    } catch (e) {
      console.error("[BulkPricing] Error:", e);
    }
  }

  /* -------- helpers -------- */

  // Collect consecutive rows that belong to this product "card"
  function collectBlockRows(startTr) {
    const rows = [startTr];
    let tr = startTr.nextElementSibling;
    for (let i = 0; tr && i < 20; i++, tr = tr.nextElementSibling) {
      if (tr.id && /ProductImageRow/i.test(tr.id)) break; // next card starts
      rows.push(tr);
    }
    return rows;
  }

  // Find customer price inside this card’s rows only
  function findCustomerPriceInBlock(blockRows, priceRow) {
    // 1) If we have a known price row, try that first
    if (priceRow) {
      const v = extractMoneyFromNode(priceRow);
      if (Number.isFinite(v) && v > 0) return v;
    }
    // 2) Look for the most specific spans first
    for (const tr of blockRows) {
      const span = tr.querySelector('span[id*="lblPrice"], span[id*="Price"]');
      if (span) {
        const v = parseMoney(span.textContent);
        if (Number.isFinite(v) && v > 0) return v;
      }
    }
    // 3) Fallback: any money-looking text within block
    for (const tr of blockRows) {
      const v = extractMoneyFromNode(tr);
      if (Number.isFinite(v) && v > 0) return v;
    }
    return NaN;
  }

  function extractMoneyFromNode(node) {
    // Match $12.34 or 12.34 (allow comma thousands + optional $)
    const m = (node.textContent || "").match(/\$?\s*([\d,]+\.\d{2})/);
    if (!m) return NaN;
    return parseMoney(m[0]);
  }

  function parseMoney(s) {
    // Handles "$18.22", "26.72", "1,234.56", " $ 9.99 / EA"
    const v = parseFloat(String(s || '').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(v) ? v : NaN;
  }

  function quickCSV(text) {
    const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
    const parseLine = (line) => {
      const out = []; let cur = ""; let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQ && line[i+1] === '"') { cur += '"'; i++; }
          else { inQ = !inQ; }
        } else if (ch === ',' && !inQ) { out.push(cur); cur = ""; }
        else { cur += ch; }
      }
      out.push(cur);
      return out.map(s => s.trim());
    };
    const header = parseLine(lines.shift());
    const lower = header.map(h => h.toLowerCase());
    const rows = lines.map(parseLine);
    return { headers: lower, rows };
  }
})();



























































