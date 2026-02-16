/* ============================================================================
WL Promo Calendar (BisTrack Dashboard) + Promo Sales Heatmap
- Renders a month grid calendar from PromotionHeader table (Table208993)
- Uses PromotionLine table (Table208994) for hover/click details
- Uses PromoSales daily table (Table208998) to build a heatmap + daily totals

UPDATES IN THIS VERSION:
- Heatmap contrast improved (scales to visible 42-day grid + gamma curve)
- Badge tooltip shows promo sales for THAT day (if available)
- Promo panel shows Day Sales (when clicked from a specific day cell) + Month summary
- Supports optional "Promo Sales By Product" table auto-detection (doesn't require it)
============================================================================ */

(function () {
  "use strict";

  // ====== CONFIG ======
  const PROMO_HEADER_TABLE_SELECTOR = "table.Table208993";
  const PROMO_LINE_TABLE_SELECTOR   = "table.Table208994";
  const PROMO_SALES_TABLE_SELECTOR  = "table.Table208998"; // daily promo totals

  // Optional: if you later add a detailed table with ProductID/ProductCode per day,
  // this script will attempt to auto-detect it. No selector required.
  // If you DO want to force a selector later, set it here:
  const PROMO_SALES_BY_PRODUCT_TABLE_SELECTOR = "table.Table208999"; // e.g. "table.Table209123" (optional)

  // Your injected calendar container
  const CAL_ID = "wlPromoCal";
  const GRID_ID = "wlPromoGrid";
  const MONTH_LABEL_ID = "wlMonthLabel";
  const PREV_ID = "wlPrevMonth";
  const NEXT_ID = "wlNextMonth";

  const BADGE_CLASS = "wlPromoBadge";
  const TOOLTIP_PREVIEW_COUNT = 5;

  // Heatmap tuning (more contrast)
  // - alpha range expanded
  // - gamma curve applied
  const HEAT_MIN_ALPHA = 0.10;
  const HEAT_MAX_ALPHA = 0.88;
  const HEAT_GAMMA = 0.55; // <1 boosts low/mid values
  const HEAT_COLOR_RGB = { r: 107, g: 0, b: 22 }; // WL maroon-ish (#6b0016)

  // IMPORTANT: set to true only if your JSONP endpoint is stable
  const ENABLE_IMAGE_MAP_JSONP = false;

  // Apps Script Web App URL (must support JSONP: callbackName({...});)
  const IMAGE_MAP_URL =
    "https://script.google.com/macros/s/AKfycbxuC8mU6Bw9e_OX5akSfTKfNJtj3QHHUbAdYafnO8c2NryihJk-4pU2K77negMebo9p/exec";

  const PLACEHOLDER_DATA_URI =
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140">
        <rect width="100%" height="100%" fill="#f4f4f4"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
              font-family="Tahoma,Arial" font-size="12" fill="#777">No image</text>
      </svg>`
    );

  // ====== STATE ======
  let PRODUCT_IMAGE_MAP_READY = false;
  let PRODUCT_IMAGE_MAP = {};
  let CURRENT_MONTH = startOfMonth(new Date());
  let PROMOS = [];
  let LINES_BY_PROMO = {};
  let SALES_INDEX = null;

  // Optional detailed index if a product-level table exists
  let SALES_BY_PRODUCT_INDEX = null;

  // ====== Helpers ======
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const safeText = (x) => (x == null ? "" : String(x));
  const clamp = (n, min, max) => Math.max(min, Math.min(n, max));

  function escHtml(str) {
    return safeText(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeId(x) {
    let s = safeText(x).trim();
    if (!s) return "";
    s = s.replace(/,/g, "");
    s = s.replace(/\.0+$/, "");
    if (/^\d+(\.\d+)?$/.test(s)) {
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? String(n) : s;
    }
    if (/^0+\d+$/.test(s)) {
      const n2 = parseInt(s, 10);
      return Number.isFinite(n2) ? String(n2) : s;
    }
    return s;
  }

  function parseNumberLoose(x) {
    const s = safeText(x).trim().replace(/[$,]/g, "");
    if (!s) return 0;
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function parseDateLoose(str) {
    const s = safeText(str).trim();
    if (!s) return null;

    // Try Date() parse first (often works with M/D/YYYY)
    const d1 = new Date(s);
    if (!isNaN(d1.getTime())) return new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());

    // Fallback: M/D/YYYY or MM/DD/YYYY
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      const mm = parseInt(m[1], 10) - 1;
      const dd = parseInt(m[2], 10);
      let yy = parseInt(m[3], 10);
      if (yy < 100) yy += 2000;
      const d = new Date(yy, mm, dd);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  }

  function formatDate(d) {
    if (!d) return "";
    const mm = d.getMonth() + 1;
    const dd = d.getDate();
    const yy = d.getFullYear();
    return `${mm}/${dd}/${yy}`;
  }

  function dateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function currency(n) {
    const v = Number(n || 0);
    try {
      return v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    } catch {
      return "$" + Math.round(v).toString();
    }
  }

  function compactCurrency(n) {
    const v = Number(n || 0);
    const abs = Math.abs(v);
    if (abs >= 1000000) return "$" + (v / 1000000).toFixed(1) + "M";
    if (abs >= 1000) return "$" + (v / 1000).toFixed(1) + "k";
    return "$" + Math.round(v).toString();
  }

  function inRange(day, from, to) {
    if (!day || !from || !to) return false;
    const a = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    const b = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
    const c = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
    return a >= b && a <= c;
  }

  function monthLabel(d) {
    const m = d.toLocaleString(undefined, { month: "long" });
    return `${m} ${d.getFullYear()}`;
  }

  function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function endOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
  }

  // ====== Tooltip / Panel ======
  function ensureUIOnce() {
    if (!qs("#wlPromoTooltip")) {
      const tip = document.createElement("div");
      tip.id = "wlPromoTooltip";
      tip.style.display = "none";
      tip.style.position = "fixed";
      tip.style.zIndex = "99999";
      document.body.appendChild(tip);
    }
    if (!qs("#wlPromoDetailsPanel")) {
      const panel = document.createElement("div");
      panel.id = "wlPromoDetailsPanel";
      panel.style.display = "none";
      panel.className = "wl-promo-panel";
      panel.innerHTML = `
        <div class="wl-promo-panel__header">
          <div id="wlPanelTitle"></div>
          <button type="button" id="wlPanelClose" aria-label="Close">✕</button>
        </div>
        <div id="wlPanelBody"></div>
      `;
      document.body.appendChild(panel);
    }
  }

  function bindCloseButton() {
    const closeBtn = qs("#wlPanelClose");
    if (closeBtn && !closeBtn.__wlBound) {
      closeBtn.__wlBound = true;
      closeBtn.addEventListener("click", closePanel);
    }
  }

  function showTooltip(html, x, y) {
    const tip = qs("#wlPromoTooltip");
    if (!tip) return;
    tip.innerHTML = html;
    tip.style.display = "block";

    const pad = 12;
    const maxX = window.innerWidth - tip.offsetWidth - pad;
    const maxY = window.innerHeight - tip.offsetHeight - pad;

    tip.style.left = clamp(x + 12, pad, maxX) + "px";
    tip.style.top = clamp(y + 12, pad, maxY) + "px";
  }

  function hideTooltip() {
    const tip = qs("#wlPromoTooltip");
    if (tip) tip.style.display = "none";
  }

  function openPanel(titleHtml, bodyHtml) {
    const panel = qs("#wlPromoDetailsPanel");
    const t = qs("#wlPanelTitle");
    const b = qs("#wlPanelBody");
    if (!panel || !t || !b) return;
    t.innerHTML = titleHtml;
    b.innerHTML = bodyHtml;
    panel.style.display = "block";
    bindCloseButton();
  }

  function closePanel() {
    const panel = qs("#wlPromoDetailsPanel");
    if (panel) panel.style.display = "none";
  }

  // ====== Data Read ======
  function tableToObjects(table) {
    const headers = qsa("thead th", table).map((th) => (th.innerText || "").trim());
    const rows = qsa("tbody tr", table);
    return rows.map((tr) => {
      const tds = qsa("td", tr);
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = tds[idx] ? (tds[idx].innerText || "").trim() : "";
      });
      return obj;
    });
  }

  function getPromosFromHeaderTable() {
    const table = qs(PROMO_HEADER_TABLE_SELECTOR);
    if (!table) return [];

    const rows = qsa("tbody tr", table);
    const headers = qsa("thead th", table).map((th) => (th.innerText || "").trim());
    const idx = (name) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());

    const iPromoId = idx("PromotionID");
    const iBranchId = idx("BranchID");
    const iCode = idx("PromotionCode");
    const iName = idx("PromotionName");
    const iFrom = idx("ValidFrom");
    const iTo = idx("ValidTo");

    return rows
      .map((tr) => {
        const tds = qsa("td", tr);
        const id = (tds[iPromoId]?.innerText || "").trim();
        if (!id) return null;
        const branchId = (tds[iBranchId]?.innerText || "").trim();
        const code = (tds[iCode]?.innerText || "").trim();
        const name = (tds[iName]?.innerText || "").trim();
        const from = parseDateLoose((tds[iFrom]?.innerText || "").trim());
        const to = parseDateLoose((tds[iTo]?.innerText || "").trim());
        return { id: normalizeId(id), branchId: normalizeId(branchId), code, name, from, to };
      })
      .filter(Boolean);
  }

  function buildLinesByPromoId() {
    const t = qs(PROMO_LINE_TABLE_SELECTOR);
    if (!t) return {};
    const objs = tableToObjects(t);
    const map = {};
    objs.forEach((o) => {
      const pid = normalizeId(o["PromotionID"] || o["PromotionId"] || o["promotionid"] || "");
      if (!pid) return;
      if (!map[pid]) map[pid] = [];
      map[pid].push(o);
    });
    return map;
  }

  function buildSalesIndexFromTable() {
    const t = qs(PROMO_SALES_TABLE_SELECTOR);
    if (!t) {
      return { byDay: {}, byDayPromo: {}, maxDaySalesGlobal: 0 };
    }

    const rows = tableToObjects(t);
    const byDay = {}; // dateKey -> {sales,cost,profit,rows:[]}
    const byDayPromo = {}; // dateKey -> promoId -> agg

    let maxDaySalesGlobal = 0;

    rows.forEach((r) => {
      const promoId = normalizeId(r["PromotionID"] || r["PromotionId"] || r["promotionid"]);
      const branchId = normalizeId(r["BranchID"] || r["branchid"]);
      const d = parseDateLoose(r["SalesDate"] || r["salesdate"] || r["Date"] || r["date"]);
      if (!promoId || !d) return;

      const dk = dateKey(d);

      const sales = parseNumberLoose(r["Sales"] || r["sales"]);
      const cost = parseNumberLoose(r["Cost"] || r["cost"]);
      const profit = parseNumberLoose(r["Profit"] || r["profit"]);
      const margin = parseNumberLoose(r["Margin"] || r["margin"]);

      if (!byDay[dk]) byDay[dk] = { sales: 0, cost: 0, profit: 0, rows: [] };
      byDay[dk].sales += sales;
      byDay[dk].cost += cost;
      byDay[dk].profit += profit;
      byDay[dk].rows.push({ promoId, branchId, sales, cost, profit, margin });

      if (!byDayPromo[dk]) byDayPromo[dk] = {};
      if (!byDayPromo[dk][promoId]) byDayPromo[dk][promoId] = { promoId, sales: 0, cost: 0, profit: 0, branchIds: {} };
      byDayPromo[dk][promoId].sales += sales;
      byDayPromo[dk][promoId].cost += cost;
      byDayPromo[dk][promoId].profit += profit;
      if (branchId) byDayPromo[dk][promoId].branchIds[branchId] = true;

      if (byDay[dk].sales > maxDaySalesGlobal) maxDaySalesGlobal = byDay[dk].sales;
    });

    return { byDay, byDayPromo, maxDaySalesGlobal };
  }

  // ====== Optional: detect a "Promo Sales By Product" table ======
  function findSalesByProductTable() {
    if (PROMO_SALES_BY_PRODUCT_TABLE_SELECTOR) {
      const forced = qs(PROMO_SALES_BY_PRODUCT_TABLE_SELECTOR);
      return forced || null;
    }

    // Heuristic: any table with headers that include PromotionID + SalesDate + (ProductID or ProductCode)
    const tables = qsa("table");
    for (const t of tables) {
      const ths = qsa("thead th", t);
      if (!ths.length) continue;
      const headers = ths.map((x) => (x.innerText || "").trim().toLowerCase());
      const hasPromo = headers.includes("promotionid");
      const hasDate = headers.includes("salesdate") || headers.includes("date");
      const hasProd = headers.includes("productid") || headers.includes("productcode") || headers.includes("product");
      const hasSales = headers.includes("sales");
      if (hasPromo && hasDate && hasProd && hasSales) return t;
    }
    return null;
  }

  function buildSalesByProductIndex() {
    const t = findSalesByProductTable();
    if (!t) return null;

    const rows = tableToObjects(t);
    // byDayPromoProd[dk][promoId][productKey] = agg
    const byDayPromoProd = {};

    rows.forEach((r) => {
      const promoId = normalizeId(r["PromotionID"] || r["promotionid"]);
      const d = parseDateLoose(r["SalesDate"] || r["salesdate"] || r["Date"] || r["date"]);
      if (!promoId || !d) return;

      const dk = dateKey(d);
      const productId = normalizeId(r["ProductID"] || r["productid"] || "");
      const productCode = safeText(r["ProductCode"] || r["productcode"] || r["Product"] || "").trim();
      const description = safeText(r["Description"] || r["description"] || "").trim();

      const sales = parseNumberLoose(r["Sales"] || r["sales"]);
      const cost = parseNumberLoose(r["Cost"] || r["cost"]);
      const profit = parseNumberLoose(r["Profit"] || r["profit"]);

      const pkey = productId || productCode || description || "line";

      if (!byDayPromoProd[dk]) byDayPromoProd[dk] = {};
      if (!byDayPromoProd[dk][promoId]) byDayPromoProd[dk][promoId] = {};
      if (!byDayPromoProd[dk][promoId][pkey]) {
        byDayPromoProd[dk][promoId][pkey] = { productId, productCode, description, sales: 0, cost: 0, profit: 0 };
      }
      const agg = byDayPromoProd[dk][promoId][pkey];
      agg.sales += sales;
      agg.cost += cost;
      agg.profit += profit;
      if (!agg.productId && productId) agg.productId = productId;
      if (!agg.productCode && productCode) agg.productCode = productCode;
      if (!agg.description && description) agg.description = description;
    });

    return { byDayPromoProd };
  }

  // ====== Heatmap ======
  function heatAlpha(daySales, maxSalesVisible) {
    if (!maxSalesVisible || daySales <= 0) return 0;

    // log scale -> normalize -> gamma
    const norm = Math.log10(daySales + 1) / Math.log10(maxSalesVisible + 1);
    const curved = Math.pow(clamp(norm, 0, 1), HEAT_GAMMA);
    return clamp(curved, 0, 1);
  }

  function heatColor(alpha01) {
    if (alpha01 <= 0) return "";
    const a = HEAT_MIN_ALPHA + (HEAT_MAX_ALPHA - HEAT_MIN_ALPHA) * alpha01;
    return `rgba(${HEAT_COLOR_RGB.r}, ${HEAT_COLOR_RGB.g}, ${HEAT_COLOR_RGB.b}, ${a})`;
  }

  // ====== Calendar Render ======
  function renderCalendar(currentMonth, promos, linesByPromoId, salesIndex) {
    const grid = qs("#" + GRID_ID);
    const label = qs("#" + MONTH_LABEL_ID);
    if (!grid || !label) return;

    grid.innerHTML = "";
    label.textContent = monthLabel(currentMonth);

    const start = startOfMonth(currentMonth);
    const startDay = new Date(start);
    startDay.setDate(start.getDate() - start.getDay()); // Sunday-start grid

    // Compute max sales only across the visible 42-day grid (boost contrast)
    let maxVisible = 0;
    if (salesIndex && salesIndex.byDay) {
      for (let i = 0; i < 42; i++) {
        const day = new Date(startDay);
        day.setDate(startDay.getDate() + i);
        const dk = dateKey(day);
        const agg = salesIndex.byDay[dk];
        if (agg && agg.sales > maxVisible) maxVisible = agg.sales;
      }
    }

    for (let i = 0; i < 42; i++) {
      const day = new Date(startDay);
      day.setDate(startDay.getDate() + i);

      const dk = dateKey(day);

      const cell = document.createElement("div");
      cell.className = "wl-day" + (day.getMonth() !== currentMonth.getMonth() ? " wl-day--muted" : "");
      cell.dataset.date = dk;

      // heat + sales label (day total across promos)
      const dayAgg = salesIndex && salesIndex.byDay ? salesIndex.byDay[dk] : null;
      const daySales = dayAgg ? dayAgg.sales : 0;

      const a01 = heatAlpha(daySales, maxVisible);
      const bg = heatColor(a01);
      if (bg) cell.style.background = bg;

      const num = document.createElement("div");
      num.className = "wl-day__num";
      num.textContent = day.getDate();
      cell.appendChild(num);

      const daySalesEl = document.createElement("div");
      daySalesEl.className = "wl-day__sales";
      daySalesEl.textContent = daySales > 0 ? compactCurrency(daySales) : "";
      cell.appendChild(daySalesEl);

      // promos that are active on this day
      const stack = document.createElement("div");
      stack.className = "wl-promo-stack";

      const todays = promos.filter((p) => p.from && p.to && inRange(day, p.from, p.to));
      todays.forEach((p) => {
        const badge = document.createElement("div");
        badge.className = "wl-promo " + BADGE_CLASS;
        badge.dataset.promotionid = String(p.id).trim();
        badge.dataset.day = dk; // IMPORTANT: gives tooltip/panel day context
        badge.title = p.name || p.code || "Promotion";
        badge.textContent = p.code || p.name || `Promo ${p.id}`;

        attachBadgeEvents(badge, p, linesByPromoId, salesIndex);
        stack.appendChild(badge);
      });

      cell.appendChild(stack);

      // click on day -> day sales breakdown panel
      cell.addEventListener("click", (ev) => {
        // don't steal clicks from promo badges
        if (ev.target && ev.target.closest && ev.target.closest(".wl-promo")) return;
        openDayPanel(day, salesIndex, promos);
      });

      grid.appendChild(cell);
    }
  }

  function openDayPanel(day, salesIndex, promos) {
    const dk = dateKey(day);
    const dayAgg = salesIndex && salesIndex.byDay ? salesIndex.byDay[dk] : null;
    const promoAgg = salesIndex && salesIndex.byDayPromo ? salesIndex.byDayPromo[dk] : null;

    const title = `<strong>Promo Sales – ${escHtml(formatDate(day))}</strong>`;

    if (!dayAgg || !dayAgg.sales) {
      openPanel(title, `<div class="wl-muted">No promo sales found for this day.</div>`);
      return;
    }

    const rows = promoAgg ? Object.values(promoAgg) : [];
    rows.sort((a, b) => (b.sales || 0) - (a.sales || 0));

    const promoName = (pid) => {
      const p = promos.find((x) => String(x.id) === String(pid));
      return p ? (p.name || p.code || `Promo ${pid}`) : `Promo ${pid}`;
    };

    const table = `
      <div style="margin-bottom:10px;">
        <span class="wl-chip">Sales: ${escHtml(currency(dayAgg.sales))}</span>
        <span class="wl-chip">Cost: ${escHtml(currency(dayAgg.cost))}</span>
        <span class="wl-chip">Profit: ${escHtml(currency(dayAgg.profit))}</span>
      </div>
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Promotion</th>
            <th style="text-align:right; padding:6px; border-bottom:1px solid #ddd;">Sales</th>
            <th style="text-align:right; padding:6px; border-bottom:1px solid #ddd;">Profit</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((r) => {
              const branches = r.branchIds ? Object.keys(r.branchIds).join(", ") : "";
              return `
                <tr>
                  <td style="padding:6px; border-bottom:1px solid #f0f0f0;">
                    <div style="font-weight:600;">${escHtml(promoName(r.promoId))}</div>
                    ${branches ? `<div class="wl-muted">Branches: ${escHtml(branches)}</div>` : ""}
                    <div class="wl-muted">PromoID: ${escHtml(r.promoId)}</div>
                  </td>
                  <td style="padding:6px; border-bottom:1px solid #f0f0f0; text-align:right;">${escHtml(currency(r.sales))}</td>
                  <td style="padding:6px; border-bottom:1px solid #f0f0f0; text-align:right;">${escHtml(currency(r.profit))}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    `;

    openPanel(title, table);
  }

  // ====== Promo Badge Events ======
  function getFieldLoose(obj, names) {
    if (!obj) return "";
    for (const n of names) {
      if (obj[n] != null && String(obj[n]).trim() !== "") return String(obj[n]).trim();
      const key = Object.keys(obj).find((k) => k.toLowerCase() === String(n).toLowerCase());
      if (key && obj[key] != null && String(obj[key]).trim() !== "") return String(obj[key]).trim();
    }
    return "";
  }

  function getPromoDaySales(promoId, dk, salesIndex) {
    if (!salesIndex || !salesIndex.byDayPromo) return null;
    const perDay = salesIndex.byDayPromo[dk];
    if (!perDay || !perDay[promoId]) return null;
    return perDay[promoId]; // {sales,cost,profit,...}
  }

  function attachBadgeEvents(el, promo, linesByPromoId, salesIndex) {
    if (!el || el.__wlPromoBound) return;
    el.__wlPromoBound = true;

    el.addEventListener("mousemove", (ev) => {
      const id = String(el.dataset.promotionid || "").trim();
      const dk = String(el.dataset.day || "").trim(); // day context
      const lines = linesByPromoId[id] || [];
      const count = lines.length;

      const dayAgg = dk ? getPromoDaySales(id, dk, salesIndex) : null;

      const chips = [
        promo.branchId ? `<span class="wl-chip">Branch: ${escHtml(promo.branchId)}</span>` : "",
        `<span class="wl-chip">Lines: ${count}</span>`,
        dayAgg ? `<span class="wl-chip">Day Sales: ${escHtml(compactCurrency(dayAgg.sales || 0))}</span>` : "",
      ].join("");

      const dateLine = promo.from && promo.to ? `${formatDate(promo.from)} – ${formatDate(promo.to)}` : "";

      const preview = lines
        .slice(0, TOOLTIP_PREVIEW_COUNT)
        .map((l) => {
          const code = getFieldLoose(l, ["ProductCode", "productcode"]);
          const desc = getFieldLoose(l, ["Description", "description"]);
          const label = code ? escHtml(code) : "Line item";
          return `<div class="wl-panel-row"><strong>${label}</strong><div class="wl-muted">${escHtml(desc)}</div></div>`;
        })
        .join("");

      const html = `
        <div style="font-weight:700; margin-bottom:6px;">
          ${escHtml(promo.name || promo.code || "Promotion")}
        </div>
        ${dateLine ? `<div class="wl-muted" style="margin-bottom:8px;">${escHtml(dateLine)}</div>` : ""}
        <div style="margin-bottom:8px;">${chips}</div>
        ${preview || `<div class="wl-muted">No line details found.</div>`}
      `;

      showTooltip(html, ev.clientX, ev.clientY);
    });

    el.addEventListener("mouseleave", hideTooltip);

    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      hideTooltip();

      const id = String(el.dataset.promotionid || "").trim();
      const dk = String(el.dataset.day || "").trim(); // the day you clicked it from
      const lines = linesByPromoId[id] || [];

      // Month summary for this promo (current month)
      const promoSalesSummary = buildPromoSalesSummaryForCurrentMonth(id, salesIndex);

      // Day summary for this promo (if clicked from a day cell)
      const dayAgg = dk ? getPromoDaySales(id, dk, salesIndex) : null;

      const dateLine =
        promo.from && promo.to
          ? `<span class="wl-muted">(${escHtml(formatDate(promo.from))} – ${escHtml(formatDate(promo.to))})</span>`
          : "";

      const title = `${escHtml(promo.name || promo.code || "Promotion")} ${dateLine}`;

      const dayBlock = dayAgg
        ? `
          <div style="margin:10px 0;">
            <span class="wl-chip">Day (${escHtml(dk)}): ${escHtml(currency(dayAgg.sales || 0))}</span>
            <span class="wl-chip">Day Profit: ${escHtml(currency(dayAgg.profit || 0))}</span>
          </div>
        `
        : "";

      const monthBlock = promoSalesSummary
        ? `
          <div style="margin:10px 0;">
            <span class="wl-chip">Month Sales: ${escHtml(currency(promoSalesSummary.sales))}</span>
            <span class="wl-chip">Month Profit: ${escHtml(currency(promoSalesSummary.profit))}</span>
            <span class="wl-chip">Days w/ Sales: ${escHtml(String(promoSalesSummary.days))}</span>
          </div>
        `
        : `<div class="wl-muted" style="margin:10px 0;">No sales summary found for this promo in the visible month.</div>`;

      // Optional product-level breakdown (only if a product sales table exists)
      const productBreakdownHtml = buildOptionalProductBreakdownHtml(id, dk);

      const body =
        dayBlock +
        monthBlock +
        productBreakdownHtml +
        (lines.length
          ? `
        <div style="max-height:340px; overflow:auto; border-top:1px solid #eee; padding-top:10px;">
          ${lines
            .map((l) => {
              const pid = normalizeId(getFieldLoose(l, ["ProductID", "productid"]));
              const code = getFieldLoose(l, ["ProductCode", "productcode"]);
              const desc = getFieldLoose(l, ["Description", "description"]);
              return `
                <div class="wl-panel-row" style="display:flex; gap:10px; align-items:flex-start; margin-bottom:10px;">
                  <img class="wl-line-img" data-productid="${escHtml(pid)}"
                       src="${PLACEHOLDER_DATA_URI}"
                       style="width:42px; height:42px; object-fit:cover; border-radius:6px; border:1px solid #ddd;" />
                  <div style="flex:1;">
                    <div style="font-weight:700;">${escHtml(code || "Line item")}</div>
                    <div class="wl-muted">${escHtml(desc)}</div>
                    ${pid ? `<div class="wl-muted">ProductID: ${escHtml(pid)}</div>` : ""}
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      `
          : `<div class="wl-muted">No line details found.</div>`);

      openPanel(title, body);
    });
  }

  function buildPromoSalesSummaryForCurrentMonth(promoId, salesIndex) {
    if (!salesIndex || !salesIndex.byDayPromo) return null;

    const start = startOfMonth(CURRENT_MONTH);
    const end = endOfMonth(CURRENT_MONTH);

    let sales = 0;
    let profit = 0;
    let days = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dk = dateKey(d);
      const perDay = salesIndex.byDayPromo[dk];
      if (!perDay || !perDay[promoId]) continue;
      const rec = perDay[promoId];
      if (rec.sales) {
        sales += rec.sales;
        profit += rec.profit;
        days += 1;
      }
    }

    if (sales <= 0 && profit === 0 && days === 0) return null;
    return { sales, profit, days };
  }

  function buildOptionalProductBreakdownHtml(promoId, dk) {
    if (!SALES_BY_PRODUCT_INDEX || !SALES_BY_PRODUCT_INDEX.byDayPromoProd) return "";

    // If we have a day key, show day breakdown; otherwise show nothing.
    if (!dk) return "";

    const dayPromo = SALES_BY_PRODUCT_INDEX.byDayPromoProd[dk];
    if (!dayPromo || !dayPromo[promoId]) return "";

    const items = Object.values(dayPromo[promoId]);
    items.sort((a, b) => (b.sales || 0) - (a.sales || 0));

    const top = items.slice(0, 12);

    return `
      <div style="margin:10px 0; border-top:1px solid #eee; padding-top:10px;">
        <div style="font-weight:700; margin-bottom:6px;">Day Breakdown (Top Items)</div>
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Item</th>
              <th style="text-align:right; padding:6px; border-bottom:1px solid #ddd;">Sales</th>
              <th style="text-align:right; padding:6px; border-bottom:1px solid #ddd;">Profit</th>
            </tr>
          </thead>
          <tbody>
            ${top
              .map((x) => {
                const label = (x.productCode || x.productId || "Item").trim();
                const sub = (x.description || "").trim();
                return `
                  <tr>
                    <td style="padding:6px; border-bottom:1px solid #f0f0f0;">
                      <div style="font-weight:600;">${escHtml(label)}</div>
                      ${sub ? `<div class="wl-muted">${escHtml(sub)}</div>` : ""}
                    </td>
                    <td style="padding:6px; border-bottom:1px solid #f0f0f0; text-align:right;">${escHtml(currency(x.sales || 0))}</td>
                    <td style="padding:6px; border-bottom:1px solid #f0f0f0; text-align:right;">${escHtml(currency(x.profit || 0))}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
        <div class="wl-muted" style="margin-top:6px;">(This section appears only if a product-level promo sales table is present.)</div>
      </div>
    `;
  }

  // ====== (Optional) Image JSONP - DISABLED by default ======
  function loadProductImageMapJSONP(timeoutMs = 10000) {
    PRODUCT_IMAGE_MAP_READY = false;
    PRODUCT_IMAGE_MAP = {};

    return new Promise((resolve) => {
      const cbName = "__wlImgMapCb_" + Math.random().toString(36).slice(2);
      const url =
        IMAGE_MAP_URL +
        (IMAGE_MAP_URL.includes("?") ? "&" : "?") +
        "callback=" +
        cbName +
        "&_=" +
        Date.now();

      let done = false;

      function cleanup() {
        try {
          delete window[cbName];
        } catch {}
        const s = document.getElementById(cbName);
        if (s && s.parentNode) s.parentNode.removeChild(s);
      }

      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        cleanup();
        PRODUCT_IMAGE_MAP_READY = false;
        console.warn("[WL PromoCal] Image map JSONP timed out");
        resolve(false);
      }, timeoutMs);

      window[cbName] = function (data) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        cleanup();

        try {
          const rawMap = data && data.ok && data.map ? data.map : null;
          if (!rawMap) {
            PRODUCT_IMAGE_MAP_READY = false;
            resolve(false);
            return;
          }

          const normalized = {};
          for (const k in rawMap) {
            const nk = normalizeId(k);
            const v = rawMap[k];
            if (nk && v) normalized[nk] = String(v).trim();
          }

          PRODUCT_IMAGE_MAP = normalized;
          PRODUCT_IMAGE_MAP_READY = true;
          resolve(true);
        } catch (e) {
          PRODUCT_IMAGE_MAP_READY = false;
          resolve(false);
        }
      };

      const script = document.createElement("script");
      script.id = cbName;
      script.src = url;
      script.async = true;
      script.onerror = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        cleanup();
        PRODUCT_IMAGE_MAP_READY = false;
        console.warn("[WL PromoCal] Image map JSONP failed to load script");
        resolve(false);
      };

      document.head.appendChild(script);
    });
  }

  // ====== Wiring / Init ======
  function bindNavButtons() {
    const prev = qs("#" + PREV_ID);
    const next = qs("#" + NEXT_ID);

    if (prev && !prev.__wlBound) {
      prev.__wlBound = true;
      prev.addEventListener("click", () => {
        CURRENT_MONTH = startOfMonth(new Date(CURRENT_MONTH.getFullYear(), CURRENT_MONTH.getMonth() - 1, 1));
        renderCalendar(CURRENT_MONTH, PROMOS, LINES_BY_PROMO, SALES_INDEX);
      });
    }

    if (next && !next.__wlBound) {
      next.__wlBound = true;
      next.addEventListener("click", () => {
        CURRENT_MONTH = startOfMonth(new Date(CURRENT_MONTH.getFullYear(), CURRENT_MONTH.getMonth() + 1, 1));
        renderCalendar(CURRENT_MONTH, PROMOS, LINES_BY_PROMO, SALES_INDEX);
      });
    }
  }

  function logStatus() {
    const hasHeader = !!qs(PROMO_HEADER_TABLE_SELECTOR);
    const hasLine = !!qs(PROMO_LINE_TABLE_SELECTOR);
    const hasSales = !!qs(PROMO_SALES_TABLE_SELECTOR);
    const hasSalesProd = !!findSalesByProductTable();
    console.log("[WL PromoCal] Tables found:", {
      header: hasHeader,
      line: hasLine,
      salesDaily: hasSales,
      salesByProduct: hasSalesProd,
    });
  }

  function refreshAllAndRender() {
    ensureUIOnce();
    bindCloseButton();
    bindNavButtons();

    PROMOS = getPromosFromHeaderTable();
    LINES_BY_PROMO = buildLinesByPromoId();
    SALES_INDEX = buildSalesIndexFromTable();

    // Optional: build if present
    SALES_BY_PRODUCT_INDEX = buildSalesByProductIndex();

    renderCalendar(CURRENT_MONTH, PROMOS, LINES_BY_PROMO, SALES_INDEX);
  }

  // Dashboard tables sometimes render after scripts run; wait + retry
  function initWithRetry(maxMs = 15000) {
    const start = Date.now();

    function tick() {
      const grid = qs("#" + GRID_ID);
      const hasHeader = !!qs(PROMO_HEADER_TABLE_SELECTOR);

      // we can render without sales, but we at least need the calendar grid + header promos
      if (grid && hasHeader) {
        logStatus();
        refreshAllAndRender();

        if (ENABLE_IMAGE_MAP_JSONP) {
          loadProductImageMapJSONP(10000).then(() => {
            // optional: refresh images later
          });
        }
        return;
      }

      if (Date.now() - start > maxMs) {
        console.warn("[WL PromoCal] Init timed out waiting for dashboard tables/grid.");
        logStatus();
        if (grid) refreshAllAndRender();
        return;
      }

      setTimeout(tick, 250);
    }

    tick();
  }

  // Start
  try {
    initWithRetry();
  } catch (e) {
    console.error("[WL PromoCal] Fatal init error:", e);
  }
})();
