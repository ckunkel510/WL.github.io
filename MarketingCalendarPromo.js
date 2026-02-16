/* ============================================================================
WL Promo Calendar (BisTrack Dashboard) + Promo Sales Heatmap
- Renders a month grid calendar from PromotionHeader table (Table208993)
- Uses PromotionLine table (Table208994) for hover/click details
- NEW: Uses Promo Sales By Day table (Table208998) to add a day heat map + totals
- Loads Product images via JSONP from Apps Script (works from file://)
- IMPORTANT: Google Sheet uses "id" + "image_link"
============================================================================ */

(function () {
  "use strict";

  // ====== CONFIG ======
  const PROMO_HEADER_TABLE_SELECTOR = "table.Table208993";
  const PROMO_LINE_TABLE_SELECTOR = "table.Table208994";

  // NEW: Promo Sales table selector (your pasted component shows table.Table208998)
  const PROMO_SALES_TABLE_SELECTOR = "table.Table208998";

  // Apps Script Web App URL (must support ?callback= for JSONP)
  const IMAGE_MAP_URL =
    "https://script.google.com/macros/s/AKfycbxuC8mU6Bw9e_OX5akSfTKfNJtj3QHHUbAdYafnO8c2NryihJk-4pU2K77negMebo9p/exec";

  // Your injected calendar container
  const CAL_ID = "wlPromoCal";
  const GRID_ID = "wlPromoGrid";
  const MONTH_LABEL_ID = "wlMonthLabel";
  const PREV_ID = "wlPrevMonth";
  const NEXT_ID = "wlNextMonth";

  const BADGE_CLASS = "wlPromoBadge";
  const TOOLTIP_PREVIEW_COUNT = 5;

  // Heatmap tuning
  const HEAT_ALPHA_MIN = 0.05;
  const HEAT_ALPHA_MAX = 0.28;
  const HEAT_BASE_RGB = { r: 107, g: 0, b: 22 }; // WL maroon-ish (matches your brand tone)

  const IMAGE_FIELD_CANDIDATES = ["ImageURL", "ImageUrl", "Image", "ImageLink", "image_link", "image link"];

  const PLACEHOLDER_DATA_URI =
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140">
        <rect width="100%" height="100%" fill="#f4f4f4"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
              font-family="Tahoma,Arial" font-size="12" fill="#777">No image</text>
      </svg>`
    );

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

  function parseNumberLoose(x) {
    const s = safeText(x).trim();
    if (!s) return 0;
    const cleaned = s.replace(/[$,]/g, "");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function fmtMoney(n) {
    const v = Number.isFinite(n) ? n : 0;
    try {
      return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
    } catch {
      // fallback
      const sign = v < 0 ? "-" : "";
      return sign + "$" + Math.abs(v).toFixed(2);
    }
  }

  function fmtPct(n) {
    const v = Number.isFinite(n) ? n : 0;
    return (v * 100).toFixed(1) + "%";
  }

  // Normalize IDs (works for ProductID from PromotionLine AND "id" from sheet)
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

  function parseDateLoose(s) {
    const str = safeText(s).trim();
    if (!str) return null;

    const d = new Date(str);
    if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), d.getDate());

    const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const mm = parseInt(m[1], 10) - 1;
      const dd = parseInt(m[2], 10);
      const yy = parseInt(m[3], 10);
      const d2 = new Date(yy, mm, dd);
      if (!isNaN(d2.getTime())) return d2;
    }
    return null;
  }

  function dateKey(d) {
    if (!d) return "";
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  }

  function formatDate(d) {
    try {
      return d ? d.toLocaleDateString() : "";
    } catch {
      return "";
    }
  }

  function inRange(day, from, to) {
    if (!day || !from || !to) return false;
    const t = day.getTime();
    return t >= from.getTime() && t <= to.getTime();
  }

  function pickFirstField(obj, candidates) {
    for (const k of candidates) {
      if (obj && obj[k] != null && String(obj[k]).trim() !== "") return String(obj[k]).trim();
    }
    return "";
  }

  function getFieldLoose(obj, names) {
    for (const k of names) {
      if (obj && obj[k] != null && String(obj[k]).trim() !== "") return String(obj[k]).trim();
    }
    return "";
  }

  // ====== Image Map (id -> image_link) via JSONP ======
  let PRODUCT_IMAGE_MAP = {};
  let PRODUCT_IMAGE_MAP_READY = false;
  let IMAGE_MAP_PROMISE = null;

  function loadProductImageMapJSONP(timeoutMs = 10000) {
    PRODUCT_IMAGE_MAP_READY = false;
    PRODUCT_IMAGE_MAP = {};

    return new Promise((resolve) => {
      const cbName = "__wlImgMapCb_" + Math.random().toString(36).slice(2);
      const url = IMAGE_MAP_URL + (IMAGE_MAP_URL.includes("?") ? "&" : "?") + "callback=" + cbName + "&_=" + Date.now();

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

          refreshPanelImages();
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

  function getImageForProductId(productId, lineObj) {
    const pid = normalizeId(productId);
    if (pid && PRODUCT_IMAGE_MAP_READY && PRODUCT_IMAGE_MAP[pid]) return PRODUCT_IMAGE_MAP[pid];

    const fallback = pickFirstField(lineObj, IMAGE_FIELD_CANDIDATES);
    return fallback || "";
  }

  // ====== UI Ensure ======
  function ensureUIOnce() {
    injectStylesOnce();

    if (!qs("#wlPromoTooltip")) {
      const tip = document.createElement("div");
      tip.id = "wlPromoTooltip";
      tip.style.display = "none";
      tip.style.position = "fixed";
      tip.style.zIndex = "99999";
      tip.className = "wl-tooltip";
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

  function injectStylesOnce() {
    if (qs("#wlPromoCalStyles")) return;
    const s = document.createElement("style");
    s.id = "wlPromoCalStyles";
    s.type = "text/css";
    s.textContent = `
      .wl-tooltip{
        background:#111; color:#fff; padding:10px 12px; border-radius:10px;
        box-shadow:0 12px 30px rgba(0,0,0,.35);
        font-family:Tahoma,Arial,sans-serif; font-size:12px; max-width:380px;
      }
      .wl-chip{ display:inline-block; padding:2px 8px; margin:0 6px 6px 0; border-radius:999px; background:rgba(255,255,255,.12); }
      .wl-muted{ opacity:.75; }
      .wl-day{ position:relative; border-radius:12px; overflow:hidden; }
      .wl-day__sales{
        position:absolute; right:8px; bottom:6px; font-size:11px;
        background:rgba(0,0,0,.55); color:#fff; padding:2px 6px; border-radius:999px;
        pointer-events:none;
      }
      .wl-heat-legend{
        display:flex; gap:8px; align-items:center; font-family:Tahoma,Arial,sans-serif; font-size:12px; margin:6px 0 10px;
      }
      .wl-heat-swatch{ width:18px; height:10px; border-radius:3px; border:1px solid rgba(0,0,0,.15); }
      .wl-panel-row{ margin:6px 0; }
      .wl-kv{ display:inline-block; margin-right:10px; }
      .wl-sales-table{ width:100%; border-collapse:collapse; margin-top:10px; }
      .wl-sales-table th,.wl-sales-table td{ padding:6px 8px; border-bottom:1px solid rgba(0,0,0,.08); text-align:left; font-size:12px; }
      .wl-sales-table th{ font-weight:700; }
    `;
    document.head.appendChild(s);
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

  function refreshPanelImages() {
    const panel = qs("#wlPromoDetailsPanel");
    if (!panel || panel.style.display === "none") return;

    qsa("img.wl-line-img[data-productid]", panel).forEach((img) => {
      const pid = normalizeId(img.getAttribute("data-productid") || "");
      if (!pid) return;

      const url = PRODUCT_IMAGE_MAP_READY && PRODUCT_IMAGE_MAP[pid] ? PRODUCT_IMAGE_MAP[pid] : "";
      if (url) {
        const current = safeText(img.getAttribute("src")).trim();
        if (!current || current === PLACEHOLDER_DATA_URI) img.src = url;
      }
    });

    qsa("[data-img-status][data-productid]", panel).forEach((el) => {
      const pid = normalizeId(el.getAttribute("data-productid") || "");
      const has = !!(pid && PRODUCT_IMAGE_MAP_READY && PRODUCT_IMAGE_MAP[pid]);
      el.textContent = has ? "Image: ✓" : "Image: —";
    });
  }

  // ====== Data Read ======
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
        return { id, branchId, code, name, from, to };
      })
      .filter(Boolean);
  }

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

  function buildLinesByPromoId() {
    const t = qs(PROMO_LINE_TABLE_SELECTOR);
    if (!t) return {};
    const objs = tableToObjects(t);

    const map = {};
    objs.forEach((o) => {
      const pid = (o["PromotionID"] || o["PromotionId"] || o["promotionid"] || "").trim();
      if (!pid) return;
      if (!map[pid]) map[pid] = [];
      map[pid].push(o);
    });
    return map;
  }

  // NEW: Sales indexing
  function buildSalesIndex() {
    const t = qs(PROMO_SALES_TABLE_SELECTOR);
    if (!t) {
      return {
        byDay: {},          // dayKey -> {sales,cost,profit, promos:{promoId:{...}}}
        byPromo: {},        // promoId -> {sales,cost,profit, days:[{dayKey,...}]}
        maxDaySales: 0
      };
    }

    const objs = tableToObjects(t);

    const byDay = {};
    const byPromo = {};
    let maxDaySales = 0;

    objs.forEach((o) => {
      const promoId = String(o["PromotionID"] || o["PromotionId"] || o["promotionid"] || "").trim();
      const d = parseDateLoose(o["SalesDate"] || o["salesdate"] || o["Date"] || o["date"]);
      if (!promoId || !d) return;

      const dk = dateKey(d);

      const sales = parseNumberLoose(o["Sales"] || o["sales"]);
      const cost = parseNumberLoose(o["Cost"] || o["cost"]);
      const profit = parseNumberLoose(o["Profit"] || o["profit"]);
      const margin = parseNumberLoose(o["Margin"] || o["margin"]);

      if (!byDay[dk]) byDay[dk] = { sales: 0, cost: 0, profit: 0, promos: {} };
      byDay[dk].sales += sales;
      byDay[dk].cost += cost;
      byDay[dk].profit += profit;

      if (!byDay[dk].promos[promoId]) byDay[dk].promos[promoId] = { sales: 0, cost: 0, profit: 0, marginSum: 0, marginCount: 0 };
      const dp = byDay[dk].promos[promoId];
      dp.sales += sales;
      dp.cost += cost;
      dp.profit += profit;
      if (Number.isFinite(margin) && margin !== 0) {
        dp.marginSum += margin;
        dp.marginCount += 1;
      }

      if (!byPromo[promoId]) byPromo[promoId] = { sales: 0, cost: 0, profit: 0, days: [] };
      byPromo[promoId].sales += sales;
      byPromo[promoId].cost += cost;
      byPromo[promoId].profit += profit;
      byPromo[promoId].days.push({ dayKey: dk, sales, cost, profit, margin });

      if (byDay[dk].sales > maxDaySales) maxDaySales = byDay[dk].sales;
    });

    // Sort promo day lists descending by sales
    Object.keys(byPromo).forEach((pid) => {
      byPromo[pid].days.sort((a, b) => (b.sales || 0) - (a.sales || 0));
    });

    return { byDay, byPromo, maxDaySales };
  }

  function heatAlpha(daySales, maxDaySales) {
    if (!maxDaySales || maxDaySales <= 0) return 0;
    // log scaling so one huge day doesn’t flatten the rest
    const a = Math.log10(1 + Math.max(0, daySales));
    const b = Math.log10(1 + maxDaySales);
    const t = b ? a / b : 0;
    return HEAT_ALPHA_MIN + (HEAT_ALPHA_MAX - HEAT_ALPHA_MIN) * clamp(t, 0, 1);
  }

  function heatColor(alpha) {
    const { r, g, b } = HEAT_BASE_RGB;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // ====== Calendar Render ======
  function monthLabel(d) {
    const m = d.toLocaleString(undefined, { month: "long" });
    return `${m} ${d.getFullYear()}`;
  }

  function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function renderCalendar(currentMonth, promos, linesByPromoId, salesIndex) {
    const grid = qs("#" + GRID_ID);
    const label = qs("#" + MONTH_LABEL_ID);
    if (!grid || !label) return;

    grid.innerHTML = "";
    label.textContent = monthLabel(currentMonth);

    const start = startOfMonth(currentMonth);
    const startDay = new Date(start);
    startDay.setDate(start.getDate() - start.getDay());

    for (let i = 0; i < 42; i++) {
      const day = new Date(startDay);
      day.setDate(startDay.getDate() + i);

      const cell = document.createElement("div");
      cell.className = "wl-day" + (day.getMonth() !== currentMonth.getMonth() ? " wl-day--muted" : "");

      // Apply heat map background
      const dk = dateKey(day);
      const daySales = salesIndex && salesIndex.byDay && salesIndex.byDay[dk] ? salesIndex.byDay[dk].sales : 0;
      const a = heatAlpha(daySales, salesIndex ? salesIndex.maxDaySales : 0);
      if (daySales > 0 && a > 0) {
        cell.style.background = heatColor(a);
      }

      const num = document.createElement("div");
      num.className = "wl-day__num";
      num.textContent = day.getDate();
      cell.appendChild(num);

      // Small $ label in the corner when there are sales
      if (daySales > 0) {
        const salesBadge = document.createElement("div");
        salesBadge.className = "wl-day__sales";
        // compact display
        const compact = daySales >= 1000 ? (daySales / 1000).toFixed(1) + "k" : daySales.toFixed(0);
        salesBadge.textContent = "$" + compact;
        cell.appendChild(salesBadge);
      }

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

      // Day hover tooltip (totals + top promos that day)
      attachDayEvents(cell, day, todays, salesIndex);

      grid.appendChild(cell);
    }

    // Optional legend (only if sales table exists and has maxDaySales)
    renderHeatLegendOnce(salesIndex);
  }

  function renderHeatLegendOnce(salesIndex) {
    if (!salesIndex || !salesIndex.maxDaySales) return;
    const cal = qs("#" + CAL_ID);
    if (!cal) return;
    if (qs("#wlHeatLegend", cal)) return;

    const legend = document.createElement("div");
    legend.id = "wlHeatLegend";
    legend.className = "wl-heat-legend";

    const a1 = heatAlpha(salesIndex.maxDaySales * 0.15, salesIndex.maxDaySales);
    const a2 = heatAlpha(salesIndex.maxDaySales * 0.45, salesIndex.maxDaySales);
    const a3 = heatAlpha(salesIndex.maxDaySales, salesIndex.maxDaySales);

    legend.innerHTML = `
      <span class="wl-muted">Promo sales heat:</span>
      <span class="wl-heat-swatch" style="background:${heatColor(a1)}"></span>
      <span class="wl-heat-swatch" style="background:${heatColor(a2)}"></span>
      <span class="wl-heat-swatch" style="background:${heatColor(a3)}"></span>
      <span class="wl-muted">higher = more sales</span>
    `;
    // Put legend just above grid
    const grid = qs("#" + GRID_ID);
    if (grid && grid.parentNode) grid.parentNode.insertBefore(legend, grid);
  }

  function attachDayEvents(cellEl, day, todaysPromos, salesIndex) {
    if (!cellEl || cellEl.__wlDayBound) return;
    cellEl.__wlDayBound = true;

    cellEl.addEventListener("mousemove", (ev) => {
      const dk = dateKey(day);
      const dayRec = salesIndex && salesIndex.byDay ? salesIndex.byDay[dk] : null;
      if (!dayRec || !dayRec.sales) {
        // If no sales, don’t show a tooltip (keeps UI clean)
        hideTooltip();
        return;
      }

      // Top promos by sales for that day
      const promoRows = Object.keys(dayRec.promos || {})
        .map((pid) => ({ pid, sales: dayRec.promos[pid].sales }))
        .sort((a, b) => (b.sales || 0) - (a.sales || 0))
        .slice(0, 6);

      const topHtml = promoRows
        .map((r) => {
          const promo = (todaysPromos || []).find((p) => String(p.id).trim() === String(r.pid).trim());
          const label = promo ? (promo.code || promo.name || `Promo ${r.pid}`) : `Promo ${r.pid}`;
          return `<div class="wl-panel-row"><strong>${escHtml(label)}</strong> <span class="wl-muted">${escHtml(fmtMoney(r.sales))}</span></div>`;
        })
        .join("");

      const html = `
        <div style="font-weight:700; margin-bottom:6px;">${escHtml(formatDate(day))}</div>
        <div style="margin-bottom:8px;">
          <span class="wl-chip">Sales: ${escHtml(fmtMoney(dayRec.sales))}</span>
          <span class="wl-chip">Profit: ${escHtml(fmtMoney(dayRec.profit))}</span>
          <span class="wl-chip">Margin: ${escHtml(dayRec.sales ? fmtPct(dayRec.profit / dayRec.sales) : "0.0%")}</span>
        </div>
        ${topHtml || `<div class="wl-muted">No promo breakdown found.</div>`}
      `;
      showTooltip(html, ev.clientX, ev.clientY);
    });

    cellEl.addEventListener("mouseleave", hideTooltip);
  }

  // ====== Tooltip / Panel Binding ======
  function attachBadgeEvents(el, promo, linesByPromoId, salesIndex) {
    if (!el || el.__wlPromoBound) return;
    el.__wlPromoBound = true;

    el.addEventListener("mousemove", (ev) => {
      const id = String(el.dataset.promotionid || "").trim();
      const lines = linesByPromoId[id] || [];
      const count = lines.length;

      const promoSales = salesIndex && salesIndex.byPromo ? salesIndex.byPromo[id] : null;

      const chips = [
        promo.branchId ? `<span class="wl-chip">Branch: ${escHtml(promo.branchId)}</span>` : "",
        `<span class="wl-chip">Lines: ${count}</span>`,
        promoSales ? `<span class="wl-chip">Promo Sales: ${escHtml(fmtMoney(promoSales.sales))}</span>` : `<span class="wl-chip">Promo Sales: —</span>`,
        promoSales ? `<span class="wl-chip">Profit: ${escHtml(fmtMoney(promoSales.profit))}</span>` : "",
        PRODUCT_IMAGE_MAP_READY ? `<span class="wl-chip">Images ready</span>` : `<span class="wl-chip">Images loading…</span>`,
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
      hideTooltip();

      const id = String(el.dataset.promotionid || "").trim();
      const lines = linesByPromoId[id] || [];
      const promoSales = salesIndex && salesIndex.byPromo ? salesIndex.byPromo[id] : null;

      const dateLine =
        promo.from && promo.to
          ? `<span class="wl-muted">(${escHtml(formatDate(promo.from))} – ${escHtml(formatDate(promo.to))})</span>`
          : "";

      const title = `${escHtml(promo.name || promo.code || "Promotion")} ${dateLine}`;

      // Sales section (top days)
      let salesHtml = `<div class="wl-panel-row wl-muted">No sales rows found for this PromotionID.</div>`;
      if (promoSales && promoSales.days && promoSales.days.length) {
        const topDays = promoSales.days.slice(0, 12);
        salesHtml = `
          <div class="wl-panel-row">
            <strong>Promo Sales:</strong> ${escHtml(fmtMoney(promoSales.sales))} &nbsp;
            <span class="wl-muted">(Profit: ${escHtml(fmtMoney(promoSales.profit))}, Margin: ${escHtml(promoSales.sales ? fmtPct(promoSales.profit / promoSales.sales) : "0.0%")})</span>
          </div>
          <table class="wl-sales-table">
            <thead>
              <tr><th>Date</th><th>Sales</th><th>Profit</th><th>Margin</th></tr>
            </thead>
            <tbody>
              ${topDays
                .map((r) => {
                  const d = parseDateLoose(r.dayKey) || new Date(r.dayKey);
                  const margin = r.sales ? (r.profit / r.sales) : 0;
                  return `<tr>
                    <td>${escHtml(r.dayKey)}</td>
                    <td>${escHtml(fmtMoney(r.sales))}</td>
                    <td>${escHtml(fmtMoney(r.profit))}</td>
                    <td>${escHtml(fmtPct(margin))}</td>
                  </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        `;
      }

      const linesHtml =
        lines.length > 0
          ? `<div class="wl-lines">` +
            lines
              .map((l) => {
                const prodIdRaw = getFieldLoose(l, ["ProductID", "productid"]);
                const prodId = normalizeId(prodIdRaw);

                const code = getFieldLoose(l, ["ProductCode", "productcode"]);
                const desc = getFieldLoose(l, ["Description", "description"]);

                const imgUrl = getImageForProductId(prodId, l);
                const hasImg = !!(prodId && PRODUCT_IMAGE_MAP_READY && PRODUCT_IMAGE_MAP[prodId]);

                return `
                  <div class="wl-line-card">
                    <div class="wl-line-grid">
                      <img class="wl-line-img"
                           data-productid="${escHtml(prodId)}"
                           src="${escHtml(imgUrl || PLACEHOLDER_DATA_URI)}"
                           alt=""
                           onerror="this.src='${PLACEHOLDER_DATA_URI}'">
                      <div>
                        <div class="wl-line-title">${escHtml(code || "Item")}</div>
                        <div class="wl-line-meta">
                          <span class="wl-kv" data-img-status="1" data-productid="${escHtml(prodId)}">${hasImg ? "Image: ✓" : "Image: —"}</span>
                        </div>
                        ${desc ? `<div class="wl-line-desc">${escHtml(desc)}</div>` : `<div class="wl-line-desc wl-muted">No description.</div>`}
                      </div>
                    </div>
                  </div>
                `;
              })
              .join("") +
            `</div>`
          : `<div class="wl-panel-row wl-muted">No line rows were found for this PromotionID.</div>`;

      const body = `
        <div class="wl-panel-row"><strong>Branch:</strong> ${escHtml(promo.branchId || "All")}</div>
        <div class="wl-panel-row"><strong>Promo Code:</strong> ${escHtml(promo.code || "")}</div>
        <div class="wl-panel-row"><strong>Lines:</strong> ${lines.length}</div>
        <hr style="border:none;border-top:1px solid rgba(0,0,0,.12); margin:10px 0;">
        ${salesHtml}
        <hr style="border:none;border-top:1px solid rgba(0,0,0,.12); margin:10px 0;">
        ${linesHtml}
      `;

      openPanel(title, body);

      if (!PRODUCT_IMAGE_MAP_READY && IMAGE_MAP_PROMISE) {
        IMAGE_MAP_PROMISE.then(() => refreshPanelImages());
      } else {
        refreshPanelImages();
      }
    });
  }

  // ====== Init ======
  function init() {
    ensureUIOnce();
    bindCloseButton();

    const cal = qs("#" + CAL_ID);
    if (!cal) return;

    const promos = getPromosFromHeaderTable();
    const lines = buildLinesByPromoId();

    // NEW: build sales index from the new table
    const salesIndex = buildSalesIndex();

    let current = new Date();
    current = new Date(current.getFullYear(), current.getMonth(), 1);

    const prev = qs("#" + PREV_ID);
    const next = qs("#" + NEXT_ID);

    function rerender() {
      renderCalendar(current, promos, lines, salesIndex);
    }

    if (prev) {
      prev.addEventListener("click", () => {
        current = new Date(current.getFullYear(), current.getMonth() - 1, 1);
        rerender();
      });
    }
    if (next) {
      next.addEventListener("click", () => {
        current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
        rerender();
      });
    }

    // Render immediately
    rerender();

    // Load image map in background
    IMAGE_MAP_PROMISE = loadProductImageMapJSONP();

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        hideTooltip();
        closePanel();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
