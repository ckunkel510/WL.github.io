/* ============================================================================
WL Promo Calendar (BisTrack Dashboard) + Promo Sales Heatmap
- Renders a month grid calendar from PromotionHeader table (Table208993)
- Uses PromotionLine table (Table208994) for hover/click details
- Uses PromoSales daily table (Table208998) to build a heatmap + daily totals
- Image JSONP is DISABLED by default because it is currently crashing execution
  (Unexpected token '<', callback not defined, etc.)
============================================================================ */

(function () {
  "use strict";

  // ====== CONFIG ======
  const PROMO_HEADER_TABLE_SELECTOR = "table.Table208993";
  const PROMO_LINE_TABLE_SELECTOR = "table.Table208994";
  const PROMO_SALES_TABLE_SELECTOR = "table.Table208998"; // <-- your new table

  // Your injected calendar container
  const CAL_ID = "wlPromoCal";
  const GRID_ID = "wlPromoGrid";
  const MONTH_LABEL_ID = "wlMonthLabel";
  const PREV_ID = "wlPrevMonth";
  const NEXT_ID = "wlNextMonth";

  const BADGE_CLASS = "wlPromoBadge";
  const TOOLTIP_PREVIEW_COUNT = 5;

  // Heatmap tuning
  const HEAT_MIN_ALPHA = 0.06; // faint tint
  const HEAT_MAX_ALPHA = 0.55; // strongest tint
  const HEAT_COLOR_RGB = { r: 107, g: 0, b: 22 }; // WL maroon-ish (#6b0016)

  // IMPORTANT: set to true only after your JSONP endpoint is fixed
  const ENABLE_IMAGE_MAP_JSONP = false;

  // Apps Script Web App URL (must support true JSONP: callbackName({...});)
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
      return {
        byDay: {},
        byDayPromo: {},
        maxDaySales: 0,
      };
    }

    const rows = tableToObjects(t);
    const byDay = {}; // dateKey -> {sales,cost,profit,rows:[]}
    const byDayPromo = {}; // dateKey -> promoId -> agg

    let maxDaySales = 0;

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

      if (byDay[dk].sales > maxDaySales) maxDaySales = byDay[dk].sales;
    });

    return { byDay, byDayPromo, maxDaySales };
  }

  // ====== Heatmap ======
  function heatAlpha(daySales, maxSales) {
    if (!maxSales || daySales <= 0) return 0;
    // log scale so 1 huge day doesn't make everything else invisible
    const a = Math.log10(daySales + 1) / Math.log10(maxSales + 1);
    return clamp(a, 0, 1);
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
      const max = salesIndex ? salesIndex.maxDaySales : 0;
      const a01 = heatAlpha(daySales, max);
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
      // case-insensitive search
      const key = Object.keys(obj).find((k) => k.toLowerCase() === String(n).toLowerCase());
      if (key && obj[key] != null && String(obj[key]).trim() !== "") return String(obj[key]).trim();
    }
    return "";
  }

  function attachBadgeEvents(el, promo, linesByPromoId, salesIndex) {
    if (!el || el.__wlPromoBound) return;
    el.__wlPromoBound = true;

    el.addEventListener("mousemove", (ev) => {
      const id = String(el.dataset.promotionid || "").trim();
      const lines = linesByPromoId[id] || [];
      const count = lines.length;

      const chips = [
        promo.branchId ? `<span class="wl-chip">Branch: ${escHtml(promo.branchId)}</span>` : "",
        `<span class="wl-chip">Lines: ${count}</span>`,
        salesIndex ? `<span class="wl-chip">Sales loaded</span>` : `<span class="wl-chip">Sales not loaded</span>`,
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
      const lines = linesByPromoId[id] || [];

      // Sales summary for this promo (within current visible month range)
      const promoSalesSummary = buildPromoSalesSummaryForCurrentMonth(id, salesIndex);

      const dateLine =
        promo.from && promo.to
          ? `<span class="wl-muted">(${escHtml(formatDate(promo.from))} – ${escHtml(formatDate(promo.to))})</span>`
          : "";

      const title = `${escHtml(promo.name || promo.code || "Promotion")} ${dateLine}`;

      const salesBlock = promoSalesSummary
        ? `
          <div style="margin:10px 0;">
            <span class="wl-chip">Month Sales: ${escHtml(currency(promoSalesSummary.sales))}</span>
            <span class="wl-chip">Month Profit: ${escHtml(currency(promoSalesSummary.profit))}</span>
            <span class="wl-chip">Days w/ Sales: ${escHtml(String(promoSalesSummary.days))}</span>
          </div>
        `
        : `<div class="wl-muted" style="margin:10px 0;">No sales summary found for this promo in the visible month.</div>`;

      const body =
        salesBlock +
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
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0); // last day of month

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
    console.log("[WL PromoCal] Tables found:", {
      header: hasHeader,
      line: hasLine,
      sales: hasSales,
    });
  }

  function refreshAllAndRender() {
    ensureUIOnce();
    bindCloseButton();
    bindNavButtons();

    PROMOS = getPromosFromHeaderTable();
    LINES_BY_PROMO = buildLinesByPromoId();
    SALES_INDEX = buildSalesIndexFromTable();

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
            // You can optionally refresh panel images here later if you want
          });
        }
        return;
      }

      if (Date.now() - start > maxMs) {
        console.warn("[WL PromoCal] Init timed out waiting for dashboard tables/grid.");
        logStatus();
        // Try rendering anyway if grid exists
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
