/* ============================================================================
WL Promo Calendar (BisTrack Dashboard) + Promo Sales Heatmap + Product Line Sales
Tables used:
- PromoHeader:            table.Table208993
- PromoLine:              table.Table208994
- PromoSales Daily:       table.Table208998   (PromotionID, BranchID, SalesDate, Sales, Cost, Profit, Margin)
- PromoSales By Product:  table.Table208999   (PromotionID, BranchID, SalesDate, ProductID, Sales, Cost, Profit, Margin)

UPDAT
============================================================================ */
(function () {
  "use strict";

  // ====== Config / Selectors ======
  const PROMO_HEADER_TABLE_SELECTOR = "table.Table208993";
  const PROMO_LINE_TABLE_SELECTOR   = "table.Table208994";
  const PROMO_SALES_TABLE_SELECTOR  = "table.Table208998";
  const PROMO_SALES_BY_PRODUCT_TABLE_SELECTOR = "table.Table208999";

  const CREATE_PROMO_LINK_HREF = "dislinkDrillDown209001";
  const CREATE_PROMO_LINK_SELECTOR = `a.dashboard-link[href="${CREATE_PROMO_LINK_HREF}"]`;
  const GRID_ID = "wlPromoGrid";
  const MONTH_LABEL_ID = "wlMonthLabel";
  const PREV_ID = "wlPrevMonth";
  const NEXT_ID = "wlNextMonth";

  const BADGE_CLASS = "wlPromoBadge";
  const TOOLTIP_PREVIEW_COUNT = 5;

  // Heatmap tuning (more contrast)
  const HEAT_MIN_ALPHA = 0.08; // base tint
  const HEAT_MAX_ALPHA = 0.88; // max tint
  const HEAT_POWER = 0.55;     // <1 = more contrast in low/mid values

  // ====== State ======
  let CURRENT_MONTH = startOfMonth(new Date());
  let PROMOS = [];
  let LINES_BY_PROMO = {};
  let SALES_INDEX = null;
  let SALES_BY_PRODUCT_INDEX = null;

  // ====== Helpers ======
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function safeText(el) {
    return (el && el.textContent ? el.textContent : "").trim();
  }

  function parseFloatSafe(v) {
    if (v == null) return 0;
    const s = String(v).replace(/[^0-9.\-]/g, "");
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  function parseIntSafe(v) {
    if (v == null) return 0;
    const s = String(v).replace(/[^0-9\-]/g, "");
    const n = parseInt(s, 10);
    return isNaN(n) ? 0 : n;
  }

  function dateKey(d) {
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function ymKey(d) {
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  function parseAnyDate(v) {
    // accepts: 2/5/2026, 02/05/2026, 2026-02-05, etc.
    if (!v) return null;
    const s = String(v).trim();
    // ISO?
    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) {
      const y = parseInt(iso[1], 10);
      const m = parseInt(iso[2], 10) - 1;
      const d = parseInt(iso[3], 10);
      const dt = new Date(y, m, d);
      return isNaN(dt.getTime()) ? null : dt;
    }
    // US slash?
    const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (us) {
      let y = parseInt(us[3], 10);
      if (y < 100) y += 2000;
      const m = parseInt(us[1], 10) - 1;
      const d = parseInt(us[2], 10);
      const dt = new Date(y, m, d);
      return isNaN(dt.getTime()) ? null : dt;
    }
    const dt = new Date(s);
    return isNaN(dt.getTime()) ? null : dt;
  }

  function startOfMonth(d) {
    const dt = new Date(d);
    return new Date(dt.getFullYear(), dt.getMonth(), 1);
  }

  function endOfMonth(d) {
    const dt = new Date(d);
    return new Date(dt.getFullYear(), dt.getMonth() + 1, 0);
  }

  function inRange(day, from, to) {
    const t = new Date(day).setHours(0, 0, 0, 0);
    const f = new Date(from).setHours(0, 0, 0, 0);
    const tt = new Date(to).setHours(0, 0, 0, 0);
    return t >= f && t <= tt;
  }

  function monthLabel(d) {
    const dt = new Date(d);
    return dt.toLocaleString(undefined, { month: "long", year: "numeric" });
  }

  function compactCurrency(v) {
    // Use a simple formatter; BisTrack browser may not always support Intl well but usually does.
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(v);
    } catch (e) {
      return "$" + Math.round(v).toLocaleString();
    }
  }

  function compactCurrency2(v) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(v);
    } catch (e) {
      return "$" + (Math.round(v * 100) / 100).toLocaleString();
    }
  }

  // ====== Create Promotion Drilldown Link ======
  function getCreatePromoLink() {
    // prefer exact match, but fall back to contains in case dashboard rewrites
    return (
      document.querySelector(CREATE_PROMO_LINK_SELECTOR) ||
      document.querySelector(`a.dashboard-link[href*="${CREATE_PROMO_LINK_HREF}"]`) ||
      document.querySelector(`a[href*="${CREATE_PROMO_LINK_HREF}"]`)
    );
  }

  function hideCreatePromoLink() {
    const link = getCreatePromoLink();
    if (!link) return;

    // Hide visually but keep in DOM for programmatic click
    link.style.display = "none";

    // If there is surrounding text/spacing, hide the closest container too (safe)
    const wrap = link.closest("td, div, span");
    if (wrap && wrap !== document.body && wrap.children.length === 1) {
      // only hide wrapper if it only contains this link
      wrap.style.display = "none";
    }
  }

  function openCreatePromotionForDate(dk) {
    // Expose selected date for any drilldown params/logic you add later
    window.WL_PROMOCAL_SELECTED_DATE = dk;
    try { localStorage.setItem("WL_PROMOCAL_SELECTED_DATE", dk); } catch (e) {}

    const link = getCreatePromoLink();
    if (!link) {
      console.warn("[WL PromoCal] Create Promotion link not found:", CREATE_PROMO_LINK_HREF);
      return;
    }
    // Trigger BisTrack drilldown
    link.click();
  }

  // ====== Heatmap ======
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function heatAlpha(value, maxValue) {
    if (!value || value <= 0 || !maxValue || maxValue <= 0) return 0;
    const n = clamp(value / maxValue, 0, 1);
    // apply power curve for contrast
    const curved = Math.pow(n, HEAT_POWER);
    return HEAT_MIN_ALPHA + (HEAT_MAX_ALPHA - HEAT_MIN_ALPHA) * curved;
  }

  // warmer high end; keep readable
  function heatColor(a) {
    if (!a || a <= 0) return "";
    // red-ish overlay
    const base = { r: 220, g: 20, b: 60 }; // crimson-like
    return `rgba(${base.r}, ${base.g}, ${base.b}, ${a})`;
  }

  // ====== Table Parsing ======
  function tableRows(sel) {
    const t = qs(sel);
    if (!t) return [];
    const body = qs("tbody", t);
    if (!body) return [];
    return qsa("tr", body);
  }

  // PromoHeader columns: PromotionID, BranchID, PromotionCode, PromotionName, ..., ValidFrom, ValidTo, ...
  function getPromosFromHeaderTable() {
    const rows = tableRows(PROMO_HEADER_TABLE_SELECTOR);
    const promos = [];

    rows.forEach((tr) => {
      const tds = qsa("td", tr);
      if (tds.length < 9) return;

      const id = parseIntSafe(safeText(tds[0]));
      if (!id) return;

      const branchIdText = safeText(tds[1]);
      const branchId = branchIdText ? parseIntSafe(branchIdText) : null;

      const code = safeText(tds[2]);
      const name = safeText(tds[3]);
      const docText = safeText(tds[4]);
      const promoType = parseIntSafe(safeText(tds[5]));

      // ValidFrom / ValidTo appear later (per your header list)
      // In your earlier SQL output you had them as CAST(date) and also had time-only columns present in some versions.
      // We'll scan for the first two date-like cells after column 5.
      let from = null;
      let to = null;
      for (let i = 6; i < tds.length; i++) {
        const dt = parseAnyDate(safeText(tds[i]));
        if (dt && !from) {
          from = dt;
          continue;
        }
        if (dt && from && !to) {
          to = dt;
          break;
        }
      }
      if (!from || !to) {
        // can't place on calendar without dates
        return;
      }

      promos.push({
        id,
        branchId,
        code,
        name,
        docText,
        promoType,
        from,
        to,
      });
    });

    return promos;
  }

  // PromoLine columns: PromotionLineID, PromotionID, LineType, ProductID, ProductGroupID, SellPriceGroupID, OfferType, OfferValue, ...
  function buildLinesByPromoId() {
    const rows = tableRows(PROMO_LINE_TABLE_SELECTOR);
    const byPromo = {};

    rows.forEach((tr) => {
      const tds = qsa("td", tr);
      if (tds.length < 8) return;

      const promotionId = parseIntSafe(safeText(tds[1]));
      if (!promotionId) return;

      const line = {
        promotionLineId: parseIntSafe(safeText(tds[0])),
        promotionId,
        lineType: parseIntSafe(safeText(tds[2])),
        productId: parseIntSafe(safeText(tds[3])),
        productGroupId: parseIntSafe(safeText(tds[4])),
        sellPriceGroupId: parseIntSafe(safeText(tds[5])),
        offerType: parseIntSafe(safeText(tds[6])),
        offerValue: parseFloatSafe(safeText(tds[7])),
      };

      if (!byPromo[promotionId]) byPromo[promotionId] = [];
      byPromo[promotionId].push(line);
    });

    return byPromo;
  }

  // PromoSales Daily: PromotionID, BranchID, SalesDate, Sales, Cost, Profit, Margin
  function buildSalesIndexFromTable() {
    const rows = tableRows(PROMO_SALES_TABLE_SELECTOR);
    if (!rows.length) return { byDay: {}, byDayPromo: {}, byPromoMonth: {} };

    const byDay = {};      // dk -> { sales, cost, profit }
    const byDayPromo = {}; // dk -> { promoId: { sales, cost, profit, margin } }
    const byPromoMonth = {}; // promoId -> ym -> { sales, cost, profit, margin }

    rows.forEach((tr) => {
      const tds = qsa("td", tr);
      if (tds.length < 7) return;

      const promoId = String(safeText(tds[0])).trim();
      const dk = dateKey(parseAnyDate(safeText(tds[2])));

      const sales = parseFloatSafe(safeText(tds[3]));
      const cost = parseFloatSafe(safeText(tds[4]));
      const profit = parseFloatSafe(safeText(tds[5]));
      const margin = parseFloatSafe(safeText(tds[6]));

      if (!byDay[dk]) byDay[dk] = { sales: 0, cost: 0, profit: 0 };
      byDay[dk].sales += sales;
      byDay[dk].cost += cost;
      byDay[dk].profit += profit;

      if (!byDayPromo[dk]) byDayPromo[dk] = {};
      if (!byDayPromo[dk][promoId]) byDayPromo[dk][promoId] = { sales: 0, cost: 0, profit: 0, margin: 0 };
      byDayPromo[dk][promoId].sales += sales;
      byDayPromo[dk][promoId].cost += cost;
      byDayPromo[dk][promoId].profit += profit;
      // margin is recalculated later

      const ym = dk.slice(0, 7);
      if (!byPromoMonth[promoId]) byPromoMonth[promoId] = {};
      if (!byPromoMonth[promoId][ym]) byPromoMonth[promoId][ym] = { sales: 0, cost: 0, profit: 0 };
      byPromoMonth[promoId][ym].sales += sales;
      byPromoMonth[promoId][ym].cost += cost;
      byPromoMonth[promoId][ym].profit += profit;
    });

    // calculate margins for promo+day and promo+month
    Object.keys(byDayPromo).forEach((dk) => {
      const perPromo = byDayPromo[dk];
      Object.keys(perPromo).forEach((pid) => {
        const x = perPromo[pid];
        x.margin = x.sales > 0 ? x.profit / x.sales : 0;
      });
    });
    Object.keys(byPromoMonth).forEach((pid) => {
      const perMonth = byPromoMonth[pid];
      Object.keys(perMonth).forEach((ym) => {
        const x = perMonth[ym];
        x.margin = x.sales > 0 ? x.profit / x.sales : 0;
      });
    });

    return { byDay, byDayPromo, byPromoMonth };
  }

  // PromoSales By Product: PromotionID, BranchID, SalesDate, ProductID, Sales, Cost, Profit, Margin
  function buildSalesByProductIndexFromTable() {
    const rows = tableRows(PROMO_SALES_BY_PRODUCT_TABLE_SELECTOR);
    if (!rows.length) return null;

    const byDayPromoProduct = {}; // dk -> promoId -> productId -> {sales,cost,profit,margin}
    const byPromoProductMonth = {}; // promoId -> ym -> productId -> {sales,cost,profit,margin}

    rows.forEach((tr) => {
      const tds = qsa("td", tr);
      if (tds.length < 8) return;

      const promoId = String(safeText(tds[0])).trim();
      const dk = dateKey(parseAnyDate(safeText(tds[2])));
      const productId = String(parseIntSafe(safeText(tds[3])));

      const sales = parseFloatSafe(safeText(tds[4]));
      const cost = parseFloatSafe(safeText(tds[5]));
      const profit = parseFloatSafe(safeText(tds[6]));
      const margin = parseFloatSafe(safeText(tds[7]));

      if (!byDayPromoProduct[dk]) byDayPromoProduct[dk] = {};
      if (!byDayPromoProduct[dk][promoId]) byDayPromoProduct[dk][promoId] = {};
      if (!byDayPromoProduct[dk][promoId][productId]) {
        byDayPromoProduct[dk][promoId][productId] = { sales: 0, cost: 0, profit: 0, margin: 0 };
      }
      const dayRec = byDayPromoProduct[dk][promoId][productId];
      dayRec.sales += sales;
      dayRec.cost += cost;
      dayRec.profit += profit;

      const ym = dk.slice(0, 7);
      if (!byPromoProductMonth[promoId]) byPromoProductMonth[promoId] = {};
      if (!byPromoProductMonth[promoId][ym]) byPromoProductMonth[promoId][ym] = {};
      if (!byPromoProductMonth[promoId][ym][productId]) {
        byPromoProductMonth[promoId][ym][productId] = { sales: 0, cost: 0, profit: 0, margin: 0 };
      }
      const monthRec = byPromoProductMonth[promoId][ym][productId];
      monthRec.sales += sales;
      monthRec.cost += cost;
      monthRec.profit += profit;
    });

    // recompute margins
    Object.keys(byDayPromoProduct).forEach((dk) => {
      Object.keys(byDayPromoProduct[dk]).forEach((pid) => {
        Object.keys(byDayPromoProduct[dk][pid]).forEach((prod) => {
          const x = byDayPromoProduct[dk][pid][prod];
          x.margin = x.sales > 0 ? x.profit / x.sales : 0;
        });
      });
    });
    Object.keys(byPromoProductMonth).forEach((pid) => {
      Object.keys(byPromoProductMonth[pid]).forEach((ym) => {
        Object.keys(byPromoProductMonth[pid][ym]).forEach((prod) => {
          const x = byPromoProductMonth[pid][ym][prod];
          x.margin = x.sales > 0 ? x.profit / x.sales : 0;
        });
      });
    });

    return { byDayPromoProduct, byPromoProductMonth };
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

    // Visible max for contrast
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

      const dayAgg = salesIndex && salesIndex.byDay ? salesIndex.byDay[dk] : null;
      const daySales = dayAgg ? dayAgg.sales : 0;

      const a01 = heatAlpha(daySales, maxVisible);
      const bg = heatColor(a01);
      if (bg) cell.style.background = bg;

      const num = document.createElement("div");
      num.className = "wl-day__num";
      num.textContent = day.getDate();
      cell.appendChild(num);

      // + button (Create Promotion)
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "wl-day__add";
      addBtn.textContent = "+";
      addBtn.title = "Create a Promotion";
      // Inline styles so it works even if dashboard CSS is missing
      addBtn.style.position = "absolute";
      addBtn.style.top = "4px";
      addBtn.style.right = "4px";
      addBtn.style.width = "20px";
      addBtn.style.height = "20px";
      addBtn.style.lineHeight = "18px";
      addBtn.style.borderRadius = "999px";
      addBtn.style.border = "1px solid rgba(0,0,0,0.25)";
      addBtn.style.background = "rgba(255,255,255,0.85)";
      addBtn.style.cursor = "pointer";
      addBtn.style.fontWeight = "700";
      addBtn.style.padding = "0";
      addBtn.style.zIndex = "3";
      // Ensure cell can position the button
      if (!cell.style.position) cell.style.position = "relative";

      addBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        openCreatePromotionForDate(dk);
      });

      cell.appendChild(addBtn);

      const daySalesEl = document.createElement("div");
      daySalesEl.className = "wl-day__sales";
      daySalesEl.textContent = daySales > 0 ? compactCurrency(daySales) : "";
      cell.appendChild(daySalesEl);

      const stack = document.createElement("div");
      stack.className = "wl-promo-stack";

      const todays = promos.filter((p) => p.from && p.to && inRange(day, p.from, p.to));
      todays.forEach((p) => {
        const badge = document.createElement("div");
        badge.className = "wl-promo " + BADGE_CLASS;
        badge.dataset.promotionid = String(p.id).trim();
        badge.dataset.day = dk;
        badge.title = p.name || p.code || "Promotion";
        badge.textContent = p.code || p.name || `Promo ${p.id}`;

        attachBadgeEvents(badge, p, linesByPromoId, salesIndex);
        stack.appendChild(badge);
      });

      cell.appendChild(stack);
      grid.appendChild(cell);
    }
  }

  // ====== Promo Badge Events ======
  function getPromoDaySales(promoId, dk, salesIndex) {
    if (!salesIndex || !salesIndex.byDayPromo) return null;
    const perDay = salesIndex.byDayPromo[dk];
    if (!perDay || !perDay[promoId]) return null;
    return perDay[promoId];
  }

  function getLineDayMonthSales(promoId, productId, dk, ym) {
    if (!SALES_BY_PRODUCT_INDEX) return { day: null, month: null };

    const dayRec =
      SALES_BY_PRODUCT_INDEX.byDayPromoProduct &&
      SALES_BY_PRODUCT_INDEX.byDayPromoProduct[dk] &&
      SALES_BY_PRODUCT_INDEX.byDayPromoProduct[dk][promoId] &&
      SALES_BY_PRODUCT_INDEX.byDayPromoProduct[dk][promoId][String(productId)]
        ? SALES_BY_PRODUCT_INDEX.byDayPromoProduct[dk][promoId][String(productId)]
        : null;

    const monthRec =
      SALES_BY_PRODUCT_INDEX.byPromoProductMonth &&
      SALES_BY_PRODUCT_INDEX.byPromoProductMonth[promoId] &&
      SALES_BY_PRODUCT_INDEX.byPromoProductMonth[promoId][ym] &&
      SALES_BY_PRODUCT_INDEX.byPromoProductMonth[promoId][ym][String(productId)]
        ? SALES_BY_PRODUCT_INDEX.byPromoProductMonth[promoId][ym][String(productId)]
        : null;

    return { day: dayRec, month: monthRec };
  }

  function attachBadgeEvents(badge, promo, linesByPromoId, salesIndex) {
    badge.addEventListener("mouseenter", (ev) => {
      showTooltip(ev, promo, linesByPromoId, salesIndex);
    });
    badge.addEventListener("mousemove", (ev) => {
      positionTooltip(ev);
    });
    badge.addEventListener("mouseleave", () => {
      hideTooltip();
    });
    badge.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openDetailsPanel(promo, linesByPromoId, salesIndex);
    });
  }

  // ====== Tooltip ======
  function tooltipEl() {
    return qs("#wlPromoTooltip");
  }

  function showTooltip(ev, promo, linesByPromoId, salesIndex) {
    const tip = tooltipEl();
    if (!tip) return;

    const badge = ev.currentTarget;
    const dk = badge && badge.dataset ? badge.dataset.day : null;
    const promoId = String(promo.id).trim();
    const ym = dk ? dk.slice(0, 7) : ymKey(CURRENT_MONTH);

    const dayAgg = dk ? getPromoDaySales(promoId, dk, salesIndex) : null;
    const monthAgg =
      salesIndex && salesIndex.byPromoMonth && salesIndex.byPromoMonth[promoId] && salesIndex.byPromoMonth[promoId][ym]
        ? salesIndex.byPromoMonth[promoId][ym]
        : null;

    const lines = (linesByPromoId && linesByPromoId[promo.id]) ? linesByPromoId[promo.id] : [];

    // Build top-selling by product for that day
    let topByDay = [];
    if (SALES_BY_PRODUCT_INDEX && dk) {
      const perPromo =
        SALES_BY_PRODUCT_INDEX.byDayPromoProduct &&
        SALES_BY_PRODUCT_INDEX.byDayPromoProduct[dk] &&
        SALES_BY_PRODUCT_INDEX.byDayPromoProduct[dk][promoId]
          ? SALES_BY_PRODUCT_INDEX.byDayPromoProduct[dk][promoId]
          : null;

      if (perPromo) {
        topByDay = Object.keys(perPromo)
          .map((pid) => ({ productId: pid, sales: perPromo[pid].sales }))
          .sort((a, b) => b.sales - a.sales)
          .slice(0, TOOLTIP_PREVIEW_COUNT);
      }
    }

    const html = [];
    html.push(`<div class="wl-tip">`);
    html.push(`<div class="wl-tip__title"><strong>${escapeHtml(promo.code || promo.name || ("Promo " + promo.id))}</strong></div>`);
    html.push(`<div class="wl-tip__sub">${escapeHtml(promo.name || "")}</div>`);

    if (dk) {
      html.push(`<div class="wl-tip__row"><span>Day:</span> <strong>${escapeHtml(dk)}</strong></div>`);
    }

    if (dayAgg) {
      html.push(
        `<div class="wl-tip__row"><span>Promo Sales (Day):</span> <strong>${compactCurrency2(dayAgg.sales)}</strong> ` +
          `<span class="wl-tip__muted">Profit ${compactCurrency2(dayAgg.profit)} • Margin ${(dayAgg.margin * 100).toFixed(1)}%</span></div>`
      );
    } else if (dk) {
      html.push(`<div class="wl-tip__row"><span>Promo Sales (Day):</span> <span class="wl-tip__muted">—</span></div>`);
    }

    if (monthAgg) {
      html.push(
        `<div class="wl-tip__row"><span>Promo Sales (Month):</span> <strong>${compactCurrency2(monthAgg.sales)}</strong> ` +
          `<span class="wl-tip__muted">Profit ${compactCurrency2(monthAgg.profit)} • Margin ${(monthAgg.margin * 100).toFixed(1)}%</span></div>`
      );
    }

    if (topByDay.length) {
      html.push(`<div class="wl-tip__hr"></div>`);
      html.push(`<div class="wl-tip__section"><strong>Top sellers (Day)</strong></div>`);
      html.push(`<ol class="wl-tip__list">`);
      topByDay.forEach((r) => {
        html.push(`<li><span>${escapeHtml(r.productId)}</span> <strong>${compactCurrency2(r.sales)}</strong></li>`);
      });
      html.push(`</ol>`);
    }

    if (lines.length) {
      html.push(`<div class="wl-tip__hr"></div>`);
      html.push(`<div class="wl-tip__section"><strong>Promo Lines</strong></div>`);
      html.push(`<ul class="wl-tip__lines">`);
      lines.slice(0, 6).forEach((ln) => {
        const prod = ln.productId ? `Product ${ln.productId}` : (ln.productGroupId ? `Group ${ln.productGroupId}` : "Line");
        html.push(`<li>${escapeHtml(prod)} <span class="wl-tip__muted">Offer ${ln.offerValue}</span></li>`);
      });
      if (lines.length > 6) html.push(`<li class="wl-tip__muted">+ ${lines.length - 6} more…</li>`);
      html.push(`</ul>`);
    }

    html.push(`</div>`);

    tip.innerHTML = html.join("");
    tip.style.display = "block";
    positionTooltip(ev);
  }

  function positionTooltip(ev) {
    const tip = tooltipEl();
    if (!tip || tip.style.display === "none") return;

    const pad = 12;
    const w = tip.offsetWidth || 260;
    const h = tip.offsetHeight || 180;

    let x = ev.clientX + pad;
    let y = ev.clientY + pad;

    if (x + w > window.innerWidth - 8) x = ev.clientX - w - pad;
    if (y + h > window.innerHeight - 8) y = ev.clientY - h - pad;

    tip.style.left = x + "px";
    tip.style.top = y + "px";
  }

  function hideTooltip() {
    const tip = tooltipEl();
    if (!tip) return;
    tip.style.display = "none";
    tip.innerHTML = "";
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ====== Details Panel ======
  function openDetailsPanel(promo, linesByPromoId, salesIndex) {
    const panel = qs("#wlPromoDetailsPanel");
    const title = qs("#wlPanelTitle");
    const body = qs("#wlPanelBody");
    if (!panel || !title || !body) return;

    const promoId = String(promo.id).trim();
    const ym = ymKey(CURRENT_MONTH);

    const monthAgg =
      salesIndex && salesIndex.byPromoMonth && salesIndex.byPromoMonth[promoId] && salesIndex.byPromoMonth[promoId][ym]
        ? salesIndex.byPromoMonth[promoId][ym]
        : null;

    title.textContent = promo.code || promo.name || ("Promotion " + promo.id);

    const lines = (linesByPromoId && linesByPromoId[promo.id]) ? linesByPromoId[promo.id] : [];

    const parts = [];
    parts.push(`<div class="wl-panel__meta">`);
    parts.push(`<div><strong>${escapeHtml(promo.name || "")}</strong></div>`);
    parts.push(`<div class="wl-panel__muted">${escapeHtml(promo.docText || "")}</div>`);
    parts.push(`<div class="wl-panel__muted">Valid: ${escapeHtml(dateKey(promo.from))} → ${escapeHtml(dateKey(promo.to))}</div>`);
    if (monthAgg) {
      parts.push(
        `<div class="wl-panel__kpi"><strong>${compactCurrency2(monthAgg.sales)}</strong> Sales • ` +
          `${compactCurrency2(monthAgg.profit)} Profit • ${(monthAgg.margin * 100).toFixed(1)}% Margin</div>`
      );
    }
    parts.push(`</div>`);

    if (lines.length) {
      parts.push(`<div class="wl-panel__section"><strong>Lines</strong></div>`);
      parts.push(`<table class="wl-panel__table"><thead><tr><th>Type</th><th>Target</th><th>Offer</th></tr></thead><tbody>`);
      lines.forEach((ln) => {
        const type = ln.lineType;
        const target = ln.productId ? ("Product " + ln.productId) : (ln.productGroupId ? ("Group " + ln.productGroupId) : "—");
        parts.push(`<tr><td>${escapeHtml(type)}</td><td>${escapeHtml(target)}</td><td>${escapeHtml(ln.offerValue)}</td></tr>`);
      });
      parts.push(`</tbody></table>`);
    }

    body.innerHTML = parts.join("");
    panel.style.display = "block";
  }

  function bindCloseButton() {
    const btn = qs("#wlPanelClose");
    const panel = qs("#wlPromoDetailsPanel");
    if (!btn || !panel) return;
    if (btn.__wlBound) return;
    btn.__wlBound = true;
    btn.addEventListener("click", () => {
      panel.style.display = "none";
    });
  }

  // ====== UI Ensure ======
  function ensureUIOnce() {
    const grid = qs("#" + GRID_ID);
    if (!grid) return;

    // ensure a minimal layout if dashboard css doesn't include it
    if (grid.__wlStyled) return;
    grid.__wlStyled = true;

    const style = document.createElement("style");
    style.textContent = `
      .wl-promo-cal__grid { display:grid; grid-template-columns: repeat(7, 1fr); gap:6px; }
      .wl-day { position:relative; border:1px solid rgba(0,0,0,0.12); border-radius:10px; padding:8px; min-height:86px; overflow:hidden; }
      .wl-day--muted { opacity:0.55; }
      .wl-day__num { font-weight:700; font-size:12px; }
      .wl-day__sales { font-size:12px; margin-top:2px; font-weight:600; }
      .wl-promo-stack { margin-top:6px; display:flex; flex-direction:column; gap:4px; max-height:50px; overflow:auto; }
      .wl-promo { font-size:11px; padding:3px 6px; border-radius:999px; background:rgba(255,255,255,0.7); border:1px solid rgba(0,0,0,0.10); cursor:pointer; white-space:nowrap; text-overflow:ellipsis; overflow:hidden; }
      #wlPromoTooltip { background:#fff; border:1px solid rgba(0,0,0,0.2); border-radius:10px; padding:10px; box-shadow:0 8px 22px rgba(0,0,0,0.18); max-width:340px; font-size:12px; }
      .wl-tip__title { margin-bottom:4px; }
      .wl-tip__sub { color:#555; margin-bottom:6px; }
      .wl-tip__row { display:flex; gap:8px; margin:2px 0; }
      .wl-tip__row span { color:#555; }
      .wl-tip__muted { color:#666; margin-left:6px; }
      .wl-tip__hr { height:1px; background:rgba(0,0,0,0.08); margin:8px 0; }
      .wl-tip__list { margin:6px 0 0 18px; padding:0; }
      .wl-tip__lines { margin:6px 0 0 18px; padding:0; }
      .wl-promo-panel { position:fixed; right:20px; top:80px; width:420px; max-width:92vw; background:#fff; border:1px solid rgba(0,0,0,0.2); border-radius:14px; box-shadow:0 10px 30px rgba(0,0,0,0.2); z-index:99999; }
      .wl-promo-panel__header { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border-bottom:1px solid rgba(0,0,0,0.1); }
      .wl-panel__meta { padding:12px; }
      .wl-panel__muted { color:#666; margin-top:4px; }
      .wl-panel__kpi { margin-top:10px; }
      .wl-panel__section { padding:0 12px 6px; }
      .wl-panel__table { width:100%; border-collapse:collapse; margin:0 0 12px; }
      .wl-panel__table th, .wl-panel__table td { border-top:1px solid rgba(0,0,0,0.08); padding:8px 12px; font-size:12px; text-align:left; }
    `;
    document.head.appendChild(style);
  }

  function bindNavButtons() {
    const prev = qs("#" + PREV_ID);
    const next = qs("#" + NEXT_ID);
    if (prev && !prev.__wlBound) {
      prev.__wlBound = true;
      prev.addEventListener("click", () => {
        CURRENT_MONTH = startOfMonth(new Date(CURRENT_MONTH.getFullYear(), CURRENT_MONTH.getMonth() - 1, 1));
        refreshAllAndRender();
      });
    }

    if (next && !next.__wlBound) {
      next.__wlBound = true;
      next.addEventListener("click", () => {
        CURRENT_MONTH = startOfMonth(new Date(CURRENT_MONTH.getFullYear(), CURRENT_MONTH.getMonth() + 1, 1));
        refreshAllAndRender();
      });
    }
  }

  function refreshAllAndRender() {
    ensureUIOnce();
    hideCreatePromoLink();
    bindCloseButton();
    bindNavButtons();

    PROMOS = getPromosFromHeaderTable();
    LINES_BY_PROMO = buildLinesByPromoId();
    SALES_INDEX = buildSalesIndexFromTable();
    SALES_BY_PRODUCT_INDEX = buildSalesByProductIndexFromTable();

    renderCalendar(CURRENT_MONTH, PROMOS, LINES_BY_PROMO, SALES_INDEX);
  }

  function initWithRetry(maxMs = 15000) {
    const start = Date.now();
    function tick() {
      const grid = qs("#" + GRID_ID);
      const hasHeader = !!qs(PROMO_HEADER_TABLE_SELECTOR);
      if (grid && hasHeader) {
        refreshAllAndRender();
        return;
      }
      if (Date.now() - start > maxMs) {
        console.warn("[WL PromoCal] Init timed out waiting for dashboard tables/grid.");
        if (grid) refreshAllAndRender();
        return;
      }
      setTimeout(tick, 250);
    }
    tick();
  }

  try {
    initWithRetry();
  } catch (e) {
    console.error("[WL PromoCal] Fatal init error:", e);
  }
})();
