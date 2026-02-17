/* ============================================================================
WL Promo Calendar (BisTrack Dashboard) + Promo Sales Heatmap + Product Line Sales
Tables used:
- PromoHeader:            table.Table208993
- PromoLine:              table.Table208994
- PromoSales Daily:       table.Table208998   (PromotionID, BranchID, SalesDate, Sales, Cost, Profit, Margin)
- PromoSales By Product:  table.Table208999   (PromotionID, BranchID, SalesDate, ProductID, Sales, Cost, Profit, Margin)

UPDATES IN THIS VERSION:
- Uses Table208999 to show per-line Day + Month sales in tooltip + panel
- Heatmap is higher contrast (visible 42-day max + gamma)
- "Top Items (Day)" shows ProductCode + Description (via PromoLine lookup) instead of ProductID
============================================================================ */

(function () {
  "use strict";

  // ====== CONFIG ======
  const PROMO_HEADER_TABLE_SELECTOR = "table.Table208993";
  const PROMO_LINE_TABLE_SELECTOR   = "table.Table208994";
  const PROMO_SALES_TABLE_SELECTOR  = "table.Table208998";
  const PROMO_SALES_BY_PRODUCT_TABLE_SELECTOR = "table.Table208999";
  const PRODUCT_GROUP_TABLE_SELECTOR = "table.Table209003"; // ProductID -> Level1 (JRHProductGroup)
  const CREATE_PROMO_LINK_HREF = "dislinkDrillDown209001";
  const CREATE_PROMO_LINK_SELECTOR = `a.dashboard-link[href="${CREATE_PROMO_LINK_HREF}"]`;

  const SELLING_PRICE_RULES_HREF = "dislinkSellingPriceRules";
  const SELLING_PRICE_RULES_SELECTOR = `a.dashboard-link[href="${SELLING_PRICE_RULES_HREF}"]`;
  const GRID_ID = "wlPromoGrid";
  const MONTH_LABEL_ID = "wlMonthLabel";
  const PREV_ID = "wlPrevMonth";
  const NEXT_ID = "wlNextMonth";

  const BADGE_CLASS = "wlPromoBadge";
  const TOOLTIP_PREVIEW_COUNT = 5;

  // Heatmap tuning (more contrast)
  const HEAT_MIN_ALPHA = 0.12;
  const HEAT_MAX_ALPHA = 0.92;
  const HEAT_GAMMA = 0.55; // <1 boosts low/mid values
  const HEAT_COLOR_RGB = { r: 107, g: 0, b: 22 }; // #6b0016

  // Images (optional) - left disabled to avoid JSONP issues in dashboards
  const ENABLE_IMAGE_MAP_JSONP = false;

  const PLACEHOLDER_DATA_URI =
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140">
        <rect width="100%" height="100%" fill="#f4f4f4"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
              font-family="Tahoma,Arial" font-size="12" fill="#777">No image</text>
      </svg>`
    );

  
  // ====== Product Image Proxy (optional) ======
  // Set this BEFORE the script runs (in the dashboard HTML or a preceding script tag):
  //   window.WL_PROMOCAL_IMAGE_PROXY_BASE = "https://script.google.com/macros/s/XXXX/exec";
  //
  // Proxy should accept: ?productid=123
  // It may return:
  //   1) image/* bytes (jpeg/png)
  //   2) JSON { "url": "https://..." }
  //   3) JSON { "dataUri": "data:image/jpeg;base64,..." }
  const IMAGE_PROXY_BASE =
  "https://script.google.com/macros/s/AKfycbxuC8mU6Bw9e_OX5akSfTKfNJtj3QHHUbAdYafnO8c2NryihJk-4pU2K77negMebo9p/exec";

  const IMAGE_SRC_CACHE = {}; // ProductID -> resolved src (objectURL or url/dataUri)

// ====== STATE ======
  let CURRENT_MONTH = startOfMonth(new Date());
    let GROUP_BY_PRODUCT = {}; // productId -> Level1
let PROMOS = [];
  let LINES_BY_PROMO = {};
  let SALES_INDEX = null;
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

  // Back-compat alias (some sections call escapeHtml)
  function escapeHtml(str) { return escHtml(str); }


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

    const d1 = new Date(s);
    if (!isNaN(d1.getTime())) return new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());

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
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  }

  function dateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function monthKeyFromDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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
// Discrete, log-scaled bands for better contrast across small & large days
function heatBandColor(value, maxValue) {
  if (!value || value <= 0 || !maxValue || maxValue <= 0) return "";
  const n = Math.log1p(value) / Math.log1p(maxValue); // 0..1
  const bands = [0.08, 0.14, 0.22, 0.32, 0.45, 0.60, 0.76, 0.90, 0.98]; // 9 bands
  const idx = Math.min(bands.length - 1, Math.max(0, Math.floor(n * bands.length)));
  const a = bands[idx];
  const base = { r: 220, g: 20, b: 60 }; // crimson-like
  return `rgba(${base.r}, ${base.g}, ${base.b}, ${a})`;
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
function ensureHeaderViewPromosButton() {
  const cal = qs("#wlPromoCal");
  if (!cal) return;
  const header = cal.querySelector(".wl-promo-cal__header");
  if (!header) return;

  // Avoid duplicates
  let btn = header.querySelector("#wlViewPromosBtn");
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.id = "wlViewPromosBtn";
    btn.className = "wl-header__action";
    btn.textContent = "View Promotions";
    btn.title = "Open Selling Price Rules (Promotions)";
    btn.style.marginLeft = "8px";
    btn.style.padding = "6px 10px";
    btn.style.borderRadius = "10px";
    btn.style.border = "1px solid rgba(0,0,0,0.18)";
    btn.style.background = "rgba(255,255,255,0.95)";
    btn.style.cursor = "pointer";
    btn.style.fontWeight = "700";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openSellingPriceRulesFromPanel();
    });

    // Put it on the right side of the header (after next button)
    const nextBtn = header.querySelector("#wlNextMonth");
    if (nextBtn) header.insertBefore(btn, nextBtn.nextSibling);
    else header.appendChild(btn);
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
    hydratePanelImages();
  }

  function closePanel() {
    const panel = qs("#wlPromoDetailsPanel");
    if (panel) panel.style.display = "none";
  }

  
  async function resolveImageSrcForProduct(productId) {
    const pid = String(productId || "").trim();
    if (!pid) return null;

    if (IMAGE_SRC_CACHE[pid]) return IMAGE_SRC_CACHE[pid];
    if (!IMAGE_PROXY_BASE) return null;

    const sep = IMAGE_PROXY_BASE.includes("?") ? "&" : "?";
    const url = `${IMAGE_PROXY_BASE}${sep}productid=${encodeURIComponent(pid)}`;

    try {
      const resp = await fetch(url, { method: "GET",
  mode: "cors",
  credentials: "omit",   // <-- important
  cache: "no-store", });
      const ct = (resp.headers.get("content-type") || "").toLowerCase();

      // Direct image bytes
      if (ct.startsWith("image/")) {
        const blob = await resp.blob();
        const objUrl = URL.createObjectURL(blob);
        IMAGE_SRC_CACHE[pid] = objUrl;
        return objUrl;
      }

      // Try JSON
      const text = await resp.text();
      const json = JSON.parse(text);
      const candidate = json && (json.dataUri || json.dataURI || json.url || json.src);
      if (candidate) {
        IMAGE_SRC_CACHE[pid] = String(candidate);
        return IMAGE_SRC_CACHE[pid];
      }

      return null;
    } catch (err) {
      // If the proxy returned HTML (login page / error), JSON.parse will throw; that's OK.
      console.warn("[WL PromoCal] Image proxy failed for ProductID", pid, err);
      return null;
    }
  }

  function hydratePanelImages() {
    if (!IMAGE_PROXY_BASE) return;
    const panel = qs("#wlPromoDetailsPanel");
    if (!panel || panel.style.display === "none") return;

    const imgs = qsa("img.wl-line-img[data-productid]", panel);
    imgs.forEach(async (img) => {
      const pid = img.getAttribute("data-productid");
      if (!pid) return;

      const current = img.getAttribute("src") || "";
      // Only replace placeholders / svg no-image
      const isPlaceholder = !current || current === PLACEHOLDER_DATA_URI || current.startsWith("data:image/svg+xml");
      if (!isPlaceholder) return;

      const resolved = await resolveImageSrcForProduct(pid);
      if (resolved) img.src = resolved;
    });
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

  
  function normalizeKey(k) {
    return String(k || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ""); // remove spaces, underscores, punctuation
  }

function getFieldLoose(obj, names) {
    if (!obj) return "";
    for (const n of names) {
      if (obj[n] != null && String(obj[n]).trim() !== "") return String(obj[n]).trim();
      const key = Object.keys(obj).find((k) => k.toLowerCase() === String(n).toLowerCase());
      if (key && obj[key] != null && String(obj[key]).trim() !== "") return String(obj[key]).trim();
    }
    return "";
  }

  function getPromosFromHeaderTable() {
    const table = qs(PROMO_HEADER_TABLE_SELECTOR);
    if (!table) return [];

    const headers = qsa("thead th", table).map((th) => (th.innerText || "").trim());
    const idx = (name) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    const iPromoId = idx("PromotionID");
    const iBranchId = idx("BranchID");
    const iCode = idx("PromotionCode");
    const iName = idx("PromotionName");
    const iFrom = idx("ValidFrom");
    const iTo = idx("ValidTo");

    return qsa("tbody tr", table)
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
    if (!t) return { byDay: {}, byDayPromo: {} };

    const rows = tableToObjects(t);
    const byDay = {}; // dateKey -> {sales,cost,profit}
    const byDayPromo = {}; // dateKey -> promoId -> {sales,cost,profit}

    rows.forEach((r) => {
      const promoId = normalizeId(r["PromotionID"]);
      const d = parseDateLoose(r["SalesDate"]);
      if (!promoId || !d) return;

      const dk = dateKey(d);
      const sales = parseNumberLoose(r["Sales"]);
      const cost = parseNumberLoose(r["Cost"]);
      const profit = parseNumberLoose(r["Profit"]);

      byDay[dk] ||= { sales: 0, cost: 0, profit: 0 };
      byDay[dk].sales += sales;
      byDay[dk].cost += cost;
      byDay[dk].profit += profit;

      byDayPromo[dk] ||= {};
      byDayPromo[dk][promoId] ||= { promoId, sales: 0, cost: 0, profit: 0 };
      byDayPromo[dk][promoId].sales += sales;
      byDayPromo[dk][promoId].cost += cost;
      byDayPromo[dk][promoId].profit += profit;
    });

    return { byDay, byDayPromo };
  }

  // Product-level index:
  // byDayPromoProduct[dk][promoId][productId] = {sales,cost,profit}
  // byMonthPromoProduct[ym][promoId][productId] = {sales,cost,profit}
  function buildSalesByProductIndexFromTable() {
    const t = qs(PROMO_SALES_BY_PRODUCT_TABLE_SELECTOR);
    if (!t) return null;

    const rows = tableToObjects(t);
    const byDayPromoProduct = {};
    const byMonthPromoProduct = {};

    rows.forEach((r) => {
      const promoId = normalizeId(r["PromotionID"]);
      const productId = normalizeId(r["ProductID"]);
      const d = parseDateLoose(r["SalesDate"]);
      if (!promoId || !productId || !d) return;

      const dk = dateKey(d);
      const ym = monthKeyFromDate(d);

      const sales = parseNumberLoose(r["Sales"]);
      const cost = parseNumberLoose(r["Cost"]);
      const profit = parseNumberLoose(r["Profit"]);

      byDayPromoProduct[dk] ||= {};
      byDayPromoProduct[dk][promoId] ||= {};
      byDayPromoProduct[dk][promoId][productId] ||= { sales: 0, cost: 0, profit: 0 };
      byDayPromoProduct[dk][promoId][productId].sales += sales;
      byDayPromoProduct[dk][promoId][productId].cost += cost;
      byDayPromoProduct[dk][promoId][productId].profit += profit;

      byMonthPromoProduct[ym] ||= {};
      byMonthPromoProduct[ym][promoId] ||= {};
      byMonthPromoProduct[ym][promoId][productId] ||= { sales: 0, cost: 0, profit: 0 };
      byMonthPromoProduct[ym][promoId][productId].sales += sales;
      byMonthPromoProduct[ym][promoId][productId].cost += cost;
      byMonthPromoProduct[ym][promoId][productId].profit += profit;
    });

    return { byDayPromoProduct, byMonthPromoProduct };
  }


  // Build lookup: ProductID -> Level1 (from PRODUCT_GROUP_TABLE_SELECTOR)
  function buildProductGroupLookupFromTable() {
    const t = qs(PRODUCT_GROUP_TABLE_SELECTOR);
    if (!t) return {};

    const rows = tableToObjects(t);
    const map = {};
    rows.forEach((r) => {
      const productId = normalizeId(getFieldLoose(r, ["ProductID", "productid"]));
      if (!productId) return;

      const level1 = (getFieldLoose(r, ["Level1", "level1", "Group", "group"]) || "").trim();
      if (!level1) return;

      map[productId] = level1;
    });
    return map;
  }

  // Build a lookup for ProductID -> { productCode, description } from PromoLine table (for a specific promo)
  function buildPromoLineMetaLookup(promoId, linesByPromoId) {
    const lines = (linesByPromoId && linesByPromoId[promoId]) ? linesByPromoId[promoId] : [];
    const map = {};
    lines.forEach((l) => {
      const productId = normalizeId(getFieldLoose(l, ["ProductID", "productid"]));
      if (!productId) return;

      const productCode = (getFieldLoose(l, ["ProductCode", "productcode"]) || "").trim();
      const description = (getFieldLoose(l, ["Description", "description"]) || "").trim();

      if (!map[productId]) map[productId] = { productCode, description };
      else {
        if (!map[productId].productCode && productCode) map[productId].productCode = productCode;
        if (!map[productId].description && description) map[productId].description = description;
      }
    });
    return map;
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

  
function ensureViewPromoButton(panel, promo) {
  try {
    window.WL_PROMOCAL_OPEN_PROMO_ID = promo && promo.id ? promo.id : null;
    window.WL_PROMOCAL_OPEN_PROMO_CODE = promo && promo.code ? promo.code : "";
    window.WL_PROMOCAL_OPEN_PROMO_NAME = promo && promo.name ? promo.name : "";
  } catch (e) {}

  if (!panel) return;
  const header = panel.querySelector(".wl-promo-panel__header");
  if (!header) return;

  const closeBtn = panel.querySelector("#wlPanelClose");
  // Create or reuse button
  let viewBtn = panel.querySelector("#wlPanelViewPromo");
  if (!viewBtn) {
    viewBtn = document.createElement("button");
    viewBtn.type = "button";
    viewBtn.id = "wlPanelViewPromo";
    viewBtn.className = "wl-panel__view";
    viewBtn.textContent = "View Promo";
    viewBtn.title = "Open Selling Price Rules (filter to find this promotion)";
    viewBtn.style.marginLeft = "8px";
    viewBtn.style.padding = "6px 10px";
    viewBtn.style.borderRadius = "10px";
    viewBtn.style.border = "1px solid rgba(0,0,0,0.18)";
    viewBtn.style.background = "rgba(255,255,255,0.95)";
    viewBtn.style.cursor = "pointer";
    viewBtn.style.fontWeight = "600";
    viewBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openSellingPriceRulesFromPanel();
    });
    if (closeBtn) header.insertBefore(viewBtn, closeBtn);
    else header.appendChild(viewBtn);
  } else {
    // Ensure it's placed in header
    if (viewBtn.parentElement !== header) {
      if (closeBtn) header.insertBefore(viewBtn, closeBtn);
      else header.appendChild(viewBtn);
    }
    viewBtn.style.display = "";
  }
}

// ====== Selling Price Rules Link ======
  function getSellingPriceRulesLink() {
    return (
      document.querySelector(SELLING_PRICE_RULES_SELECTOR) ||
      document.querySelector(`a.dashboard-link[href*="${SELLING_PRICE_RULES_HREF}"]`) ||
      document.querySelector(`a[href*="${SELLING_PRICE_RULES_HREF}"]`)
    );
  }

  function hideSellingPriceRulesLink() {
    const link = getSellingPriceRulesLink();
    if (!link) return;

    // Hide visually but keep in DOM
    link.style.display = "none";

    const wrap = link.closest("td, div, span");
    if (wrap && wrap !== document.body && wrap.children.length === 1) {
      wrap.style.display = "none";
    }
  }

  function openSellingPriceRulesFromPanel() {
    // Provide context for the user (and for future automation)
    try {
      if (window.WL_PROMOCAL_OPEN_PROMO_ID) localStorage.setItem("WL_PROMOCAL_OPEN_PROMO_ID", String(window.WL_PROMOCAL_OPEN_PROMO_ID));
      if (window.WL_PROMOCAL_OPEN_PROMO_CODE) localStorage.setItem("WL_PROMOCAL_OPEN_PROMO_CODE", String(window.WL_PROMOCAL_OPEN_PROMO_CODE));
      if (window.WL_PROMOCAL_OPEN_PROMO_NAME) localStorage.setItem("WL_PROMOCAL_OPEN_PROMO_NAME", String(window.WL_PROMOCAL_OPEN_PROMO_NAME));
    } catch (e) {}

    const link = getSellingPriceRulesLink();
    if (!link) {
      console.warn("[WL PromoCal] Selling Price Rules link not found:", SELLING_PRICE_RULES_HREF);
      return;
    }
    link.click();
  }

// ====== Heatmap ======
  function heatAlpha(daySales, maxSalesVisible) {
    if (!maxSalesVisible || daySales <= 0) return 0;
    const norm = Math.log10(daySales + 1) / Math.log10(maxSalesVisible + 1);
    const curved = Math.pow(clamp(norm, 0, 1), HEAT_GAMMA);
    return clamp(curved, 0, 1);
  }

  function heatColor(alpha01) {
    if (alpha01 <= 0) return "";
    const a = HEAT_MIN_ALPHA + (HEAT_MAX_ALPHA - HEAT_MIN_ALPHA) * alpha01;
    return `rgba(${HEAT_COLOR_RGB.r}, ${HEAT_COLOR_RGB.g}, ${HEAT_COLOR_RGB.b}, ${a})`;
  }


  // ====== Insights (YoY Monthly + Group Rollups) ======
  function ensureInsightsUIOnce() {
    const cal = qs("#wlPromoCal");
    const grid = qs("#" + GRID_ID);
    if (!cal || !grid) return;

    if (qs("#wlPromoInsights")) return;

    const box = document.createElement("div");
    box.id = "wlPromoInsights";
    box.style.marginTop = "12px";
    box.style.padding = "12px";
    box.style.borderRadius = "14px";
    box.style.border = "1px solid rgba(0,0,0,0.12)";
    box.style.background = "rgba(255,255,255,0.92)";

    box.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
        <div style="font-weight:900;">Promo Insights</div>
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <div style="font-size:12px; opacity:0.75;">Year</div>
          <select id="wlInsightYear" style="padding:8px 10px; border-radius:12px; border:1px solid rgba(0,0,0,0.18);"></select>
        </div>
      </div>

      <div style="margin-top:10px;">
        <div style="font-weight:800; margin-bottom:6px;">Year-over-Year Monthly Promo Sales</div>
        <div id="wlYoYChart"></div>
        <div id="wlYoYSummary" style="margin-top:6px; font-size:12px; opacity:0.8;"></div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr; gap:12px; margin-top:12px;">
        <div>
          <div style="font-weight:800; margin-bottom:6px;">Top Product Groups (Selected Month)</div>
          <div id="wlTopGroups"></div>
        </div>
      </div>
    `;

    // Insert right after the calendar grid
    grid.parentElement.insertBefore(box, grid.nextSibling);

    const yearSel = qs("#wlInsightYear");
    if (yearSel && !yearSel.__wlBound) {
      yearSel.__wlBound = true;
      yearSel.addEventListener("change", () => renderInsights(CURRENT_MONTH));
    }
  }

  function computeMonthlyTotalsForYear(byDay, year, cutoffDate /* optional Date */) {
    const arr = new Array(12).fill(0);
    if (!byDay) return arr;

    const cutoffKey = cutoffDate ? dateKey(cutoffDate) : null;

    Object.keys(byDay).forEach((dk) => {
      // dk is YYYY-MM-DD
      const y = parseInt(dk.slice(0, 4), 10);
      if (y !== year) return;

      if (cutoffKey && dk > cutoffKey) return;

      const m = parseInt(dk.slice(5, 7), 10) - 1;
      if (m < 0 || m > 11) return;
      arr[m] += (byDay[dk]?.sales || 0);
    });
    return arr;
  }

  function fmtMoney(n) {
    const v = Number(n || 0);
    return v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }

  function renderYoYSvgChart(curYear, curArr, prevYear, prevArr) {
    const mount = qs("#wlYoYChart");
    if (!mount) return;

    const w = 860;
    const h = 240;
    const padL = 44;
    const padR = 16;
    const padT = 18;
    const padB = 34;

    const maxV = Math.max(1, ...curArr, ...prevArr);
    const xStep = (w - padL - padR) / 11;

    const x = (i) => padL + i * xStep;
    const y = (v) => padT + (h - padT - padB) * (1 - (v / maxV));
    const segments = (arr) => {
      const segs = [];
      let cur = [];
      arr.forEach((v, i) => {
        if (v == null || !Number.isFinite(v)) {
          if (cur.length) { segs.push(cur); cur = []; }
          return;
        }
        cur.push({ i, v });
      });
      if (cur.length) segs.push(cur);
      return segs;
    };

    const polyPoints = (seg) => seg.map((p) => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");

    const monthLabels = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    // Use two clear strokes; rely on default theme + light alpha
    mount.innerHTML = `
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="240" role="img" aria-label="YoY Monthly Promo Sales">
        <rect x="0" y="0" width="${w}" height="${h}" fill="transparent"></rect>

        <!-- gridlines -->
        ${[0.25,0.5,0.75,1].map((p)=> {
          const yy = padT + (h - padT - padB) * (1 - p);
          const label = fmtMoney(maxV * p);
          return `
            <line x1="${padL}" y1="${yy}" x2="${w-padR}" y2="${yy}" stroke="rgba(0,0,0,0.08)" />
            <text x="${padL-8}" y="${yy+4}" text-anchor="end" font-size="11" fill="rgba(0,0,0,0.55)">${label}</text>
          `;
        }).join("")}

        <!-- axes -->
        <line x1="${padL}" y1="${h-padB}" x2="${w-padR}" y2="${h-padB}" stroke="rgba(0,0,0,0.18)" />
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${h-padB}" stroke="rgba(0,0,0,0.18)" />

        <!-- previous year -->
        ${segments(prevArr).map((seg)=>`<polyline points="${polyPoints(seg)}" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="3" />`).join("")}
        ${prevArr.map((v,i)=> (v==null || !Number.isFinite(v)) ? "" : `<circle cx="${x(i)}" cy="${y(v)}" r="3.5" fill="rgba(0,0,0,0.35)"></circle>`).join("")}

        <!-- current year -->
        ${segments(curArr).map((seg)=>`<polyline points="${polyPoints(seg)}" fill="none" stroke="rgba(${HEAT_COLOR_RGB.r},${HEAT_COLOR_RGB.g},${HEAT_COLOR_RGB.b},0.85)" stroke-width="3.5" />`).join("")}
        ${curArr.map((v,i)=> (v==null || !Number.isFinite(v)) ? "" : `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="rgba(${HEAT_COLOR_RGB.r},${HEAT_COLOR_RGB.g},${HEAT_COLOR_RGB.b},0.85)"></circle>`).join("")}

        <!-- x labels -->
        ${monthLabels.map((m,i)=>`<text x="${x(i)}" y="${h-12}" text-anchor="middle" font-size="11" fill="rgba(0,0,0,0.65)">${m}</text>`).join("")}

        <!-- legend -->
        <g transform="translate(${padL}, ${padT-4})">
          <rect x="0" y="0" width="12" height="4" fill="rgba(${HEAT_COLOR_RGB.r},${HEAT_COLOR_RGB.g},${HEAT_COLOR_RGB.b},0.85)"></rect>
          <text x="18" y="5" font-size="11" fill="rgba(0,0,0,0.75)">${curYear}</text>

          <rect x="64" y="0" width="12" height="4" fill="rgba(0,0,0,0.35)"></rect>
          <text x="82" y="5" font-size="11" fill="rgba(0,0,0,0.75)">${prevYear}</text>
        </g>
      </svg>
    `;
  }

  function renderTopGroupsForMonth(monthDate) {
    const mount = qs("#wlTopGroups");
    if (!mount) return;

    const ym = monthKeyFromDate(monthDate);
    const prevYm = `${monthDate.getFullYear() - 1}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;

    const cur = aggregateGroupSalesForYm(ym);
    const prev = aggregateGroupSalesForYm(prevYm);

    const rows = Object.keys(cur).map((g) => {
      const a = cur[g] || 0;
      const b = prev[g] || 0;
      const pct = (b > 0) ? ((a - b) / b) : null;
      return { g, a, b, pct };
    }).sort((x,y)=> (y.a - x.a)).slice(0, 12);

    if (!rows.length) {
      mount.innerHTML = `<div style="opacity:0.7; font-size:12px;">No group sales found for ${ym}. (Make sure Table209003 is on the dashboard.)</div>`;
      return;
    }

    mount.innerHTML = `
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="text-align:left; font-size:12px; opacity:0.75;">
              <th style="padding:6px 6px; border-bottom:1px solid rgba(0,0,0,0.10);">Group</th>
              <th style="padding:6px 6px; border-bottom:1px solid rgba(0,0,0,0.10); text-align:right;">This Month</th>
              <th style="padding:6px 6px; border-bottom:1px solid rgba(0,0,0,0.10); text-align:right;">Last Year</th>
              <th style="padding:6px 6px; border-bottom:1px solid rgba(0,0,0,0.10); text-align:right;">YoY</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r)=> {
              const yoy = (r.pct===null) ? "—" : `${(r.pct*100).toFixed(0)}%`;
              return `
                <tr>
                  <td style="padding:6px 6px; border-bottom:1px solid rgba(0,0,0,0.06); font-weight:700;">${escapeHtml(r.g)}</td>
                  <td style="padding:6px 6px; border-bottom:1px solid rgba(0,0,0,0.06); text-align:right;">${fmtMoney(r.a)}</td>
                  <td style="padding:6px 6px; border-bottom:1px solid rgba(0,0,0,0.06); text-align:right;">${fmtMoney(r.b)}</td>
                  <td style="padding:6px 6px; border-bottom:1px solid rgba(0,0,0,0.06); text-align:right;">${yoy}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function aggregateGroupSalesForYm(ym) {
    const out = {};
    const idx = SALES_BY_PRODUCT_INDEX && SALES_BY_PRODUCT_INDEX.byMonthPromoProduct;
    const monthNode = idx ? idx[ym] : null;
    if (!monthNode) return out;

    Object.keys(monthNode).forEach((promoId) => {
      const prodNode = monthNode[promoId] || {};
      Object.keys(prodNode).forEach((productId) => {
        const v = prodNode[productId]?.sales || 0;
        const g = GROUP_BY_PRODUCT[productId] || "Unassigned";
        out[g] = (out[g] || 0) + v;
      });
    });

    return out;
  }

  function renderInsights(monthDate) {
    ensureInsightsUIOnce();

    const yearSel = qs("#wlInsightYear");
    const summary = qs("#wlYoYSummary");

    // fill year selector based on available byDay dates
    const years = new Set();
    if (SALES_INDEX && SALES_INDEX.byDay) {
      Object.keys(SALES_INDEX.byDay).forEach((dk) => {
        const y = parseInt(dk.slice(0, 4), 10);
        if (Number.isFinite(y)) years.add(y);
      });
    }
    const fallbackY = monthDate.getFullYear();
    if (years.size === 0) years.add(fallbackY), years.add(fallbackY - 1);

    if (yearSel && !yearSel.__wlFilled) {
      yearSel.__wlFilled = true;
      Array.from(years).sort((a,b)=>b-a).forEach((y) => {
        const opt = document.createElement("option");
        opt.value = String(y);
        opt.textContent = String(y);
        yearSel.appendChild(opt);
      });
    }

    const selectedYear = yearSel ? parseInt(yearSel.value || String(monthDate.getFullYear()), 10) : monthDate.getFullYear();
    const curYear = Number.isFinite(selectedYear) ? selectedYear : monthDate.getFullYear();
    const prevYear = curYear - 1;

    if (yearSel) {
      // keep options fresh if new years appear
      const existing = new Set(Array.from(yearSel.options).map(o=>parseInt(o.value,10)));
      Array.from(years).forEach((y)=>{
        if (!existing.has(y)) {
          const opt=document.createElement("option");
          opt.value=String(y);
          opt.textContent=String(y);
          yearSel.appendChild(opt);
        }
      });
      yearSel.value = String(curYear);
    }

    const now = new Date();
    const isCurrentYear = (curYear === now.getFullYear());

    // If we're comparing the *current* year, only compare through today's date,
    // and compare the prior year through the same month/day cutoff (same time period).
    let cutoffCur = null;
    let cutoffPrev = null;
    if (isCurrentYear) {
      cutoffCur = now;

      // Build a safe "same day" cutoff for prev year (handles Feb 29 etc.)
      const m = now.getMonth();
      const d = now.getDate();
      const lastDayPrev = new Date(prevYear, m + 1, 0).getDate();
      cutoffPrev = new Date(prevYear, m, Math.min(d, lastDayPrev));
    }

    const curArr = computeMonthlyTotalsForYear(SALES_INDEX?.byDay, curYear, cutoffCur);
    const prevArr = computeMonthlyTotalsForYear(SALES_INDEX?.byDay, prevYear, cutoffPrev);

    const cutoffMonthIdx = isCurrentYear ? now.getMonth() : 11;

    const curArrMasked = curArr.map((v, i) => (i <= cutoffMonthIdx ? v : null));
    const prevArrMasked = isCurrentYear ? prevArr.map((v, i) => (i <= cutoffMonthIdx ? v : null)) : prevArr;

    renderYoYSvgChart(curYear, curArrMasked, prevYear, prevArrMasked);

    if (summary) {
      const curTotal = curArrMasked.filter(v=>v!=null).reduce((a,b)=>a+b,0);
      const prevTotal = prevArrMasked.filter(v=>v!=null).reduce((a,b)=>a+b,0);
      const pct = (prevTotal>0) ? ((curTotal - prevTotal)/prevTotal)*100 : null;
      summary.textContent = `Total ${curYear}: ${fmtMoney(curTotal)}  •  Total ${prevYear}: ${fmtMoney(prevTotal)}${pct===null ? "" : `  •  YoY: ${pct.toFixed(1)}%`}`;
    }

    renderTopGroupsForMonth(monthDate);
  }

  // ====== Calendar Render ======
  function renderCalendar(currentMonth, promos, linesByPromoId, salesIndex) {
    const grid = qs("#" + GRID_ID);
    const label = qs("#" + MONTH_LABEL_ID);
    if (!grid || !label) return;

    grid.innerHTML = "";
    label.textContent = monthLabel(currentMonth);

    // Weekday header (Monday-first)
    const dows = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    dows.forEach((d) => {
      const h = document.createElement("div");
      h.className = "wl-dow";
      h.textContent = d;
      grid.appendChild(h);
    });

    const start = startOfMonth(currentMonth);
    const startDay = new Date(start);
    const mondayOffset = (start.getDay() + 6) % 7; // Monday=0
    startDay.setDate(start.getDate() - mondayOffset); // Monday-start grid

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

            const bg = heatBandColor(daySales, maxVisible);
if (bg) cell.style.background = bg;

      // Date + Sales label (white background for readability over heatmap)
      const meta = document.createElement("div");
      meta.className = "wl-day__meta";
      meta.style.display = "inline-flex";
      meta.style.alignItems = "baseline";
      meta.style.gap = "8px";
      meta.style.padding = "4px 8px";
      meta.style.borderRadius = "10px";
      meta.style.background = "rgba(255,255,255,0.92)";
      meta.style.border = "1px solid rgba(0,0,0,0.10)";
      meta.style.boxShadow = "0 1px 2px rgba(0,0,0,0.06)";
      meta.style.maxWidth = "calc(100% - 28px)"; // leave room for +
      meta.style.overflow = "hidden";

      const num = document.createElement("div");
      num.className = "wl-day__num";
      num.textContent = day.getDate();
      meta.appendChild(num);

      if (daySales > 0) {
        const daySalesEl = document.createElement("div");
        daySalesEl.className = "wl-day__sales";
        daySalesEl.textContent = compactCurrency(daySales);
        meta.appendChild(daySalesEl);
      }

      cell.appendChild(meta);

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
      SALES_BY_PRODUCT_INDEX.byDayPromoProduct[dk][promoId][productId]
        ? SALES_BY_PRODUCT_INDEX.byDayPromoProduct[dk][promoId][productId]
        : null;

    const monthRec =
      SALES_BY_PRODUCT_INDEX.byMonthPromoProduct &&
      SALES_BY_PRODUCT_INDEX.byMonthPromoProduct[ym] &&
      SALES_BY_PRODUCT_INDEX.byMonthPromoProduct[ym][promoId] &&
      SALES_BY_PRODUCT_INDEX.byMonthPromoProduct[ym][promoId][productId]
        ? SALES_BY_PRODUCT_INDEX.byMonthPromoProduct[ym][promoId][productId]
        : null;

    return { day: dayRec, month: monthRec };
  }

  function attachBadgeEvents(el, promo, linesByPromoId, salesIndex) {
    if (!el || el.__wlPromoBound) return;
    el.__wlPromoBound = true;

    el.addEventListener("mousemove", (ev) => {
      const promoId = String(el.dataset.promotionid || "").trim();
      const dk = String(el.dataset.day || "").trim();
      const ym = monthKeyFromDate(CURRENT_MONTH);

      const lines = linesByPromoId[promoId] || [];
      const count = lines.length;

      const dayAgg = dk ? getPromoDaySales(promoId, dk, salesIndex) : null;

      const chips = [
        promo.branchId ? `<span class="wl-chip">Branch: ${escHtml(promo.branchId)}</span>` : "",
        `<span class="wl-chip">Lines: ${count}</span>`,
        dayAgg ? `<span class="wl-chip">Day Sales: ${escHtml(compactCurrency(dayAgg.sales || 0))}</span>` : "",
      ].filter(Boolean).join("");

      const dateLine = promo.from && promo.to ? `${formatDate(promo.from)} – ${formatDate(promo.to)}` : "";

      // Preview lines with day+month sales if possible
      const preview = lines.slice(0, TOOLTIP_PREVIEW_COUNT).map((l) => {
        const productId = normalizeId(getFieldLoose(l, ["ProductID", "productid"]));
        const code = getFieldLoose(l, ["ProductCode", "productcode"]);
        const desc = getFieldLoose(l, ["Description", "description"]);

        let salesBits = "";
        if (productId && SALES_BY_PRODUCT_INDEX) {
          const { day, month } = getLineDayMonthSales(promoId, productId, dk, ym);
          const daySales = day ? day.sales : 0;
          const monSales = month ? month.sales : 0;
          salesBits = `
            <div style="margin-top:4px;">
              <span class="wl-chip">Day: ${escHtml(compactCurrency(daySales))}</span>
              <span class="wl-chip">Month: ${escHtml(compactCurrency(monSales))}</span>
            </div>
          `;
        }

        return `
          <div class="wl-panel-row">
            <strong>${escHtml(code || (productId ? ("Product " + productId) : "Line item"))}</strong>
            <div class="wl-muted">${escHtml(desc)}</div>
            ${salesBits}
          </div>
        `;
      }).join("");

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

      const promoId = String(el.dataset.promotionid || "").trim();
      const dk = String(el.dataset.day || "").trim();
      const ym = monthKeyFromDate(CURRENT_MONTH);

      const lines = linesByPromoId[promoId] || [];
      const dayAgg = dk ? getPromoDaySales(promoId, dk, salesIndex) : null;

      const monthSummary = buildPromoSalesSummaryForCurrentMonth(promoId, salesIndex);

      const title = `${escHtml(promo.name || promo.code || "Promotion")} ${
        promo.from && promo.to ? `<span class="wl-muted">(${escHtml(formatDate(promo.from))} – ${escHtml(formatDate(promo.to))})</span>` : ""
      }`;

      const dayBlock = dayAgg
        ? `
          <div style="margin:10px 0;">
            <span class="wl-chip">Day (${escHtml(dk)}): ${escHtml(currency(dayAgg.sales || 0))}</span>
            <span class="wl-chip">Day Profit: ${escHtml(currency(dayAgg.profit || 0))}</span>
          </div>
        `
        : "";

      const monthBlock = monthSummary
        ? `
          <div style="margin:10px 0;">
            <span class="wl-chip">Month Sales: ${escHtml(currency(monthSummary.sales))}</span>
            <span class="wl-chip">Month Profit: ${escHtml(currency(monthSummary.profit))}</span>
            <span class="wl-chip">Days w/ Sales: ${escHtml(String(monthSummary.days))}</span>
          </div>
        `
        : `<div class="wl-muted" style="margin:10px 0;">No sales summary found for this promo in the visible month.</div>`;

      // UPDATED: Top items now show ProductCode + Description using PromoLine lookup
      const topItems = buildTopItemsDaySummaryHtml(promoId, dk, linesByPromoId);

      const lineHtml = lines.length
        ? `
          <div style="max-height:380px; overflow:auto; border-top:1px solid #eee; padding-top:10px;">
            ${lines.map((l) => {
              const productId = normalizeId(getFieldLoose(l, ["ProductID", "productid"]));
              const code = getFieldLoose(l, ["ProductCode", "productcode"]);
              const desc = getFieldLoose(l, ["Description", "description"]);

              let chips = "";
              if (productId && SALES_BY_PRODUCT_INDEX) {
                const { day, month } = getLineDayMonthSales(promoId, productId, dk, ym);
                const daySales = day ? day.sales : 0;
                const dayProfit = day ? day.profit : 0;
                const monSales = month ? month.sales : 0;
                const monProfit = month ? month.profit : 0;

                chips = `
                  <div style="margin-top:6px;">
                    <span class="wl-chip">Day: ${escHtml(compactCurrency(daySales))}</span>
                    <span class="wl-chip">Day Profit: ${escHtml(compactCurrency(dayProfit))}</span>
                    <span class="wl-chip">Month: ${escHtml(compactCurrency(monSales))}</span>
                    <span class="wl-chip">Month Profit: ${escHtml(compactCurrency(monProfit))}</span>
                  </div>
                `;
              }

              return `
                <div class="wl-panel-row" style="display:flex; gap:10px; align-items:flex-start; margin-bottom:12px;">
                  <img class="wl-line-img" data-productid="${escHtml(productId)}"
                       src="${PLACEHOLDER_DATA_URI}"
                       style="width:42px; height:42px; object-fit:cover; border-radius:6px; border:1px solid #ddd;" />
                  <div style="flex:1;">
                    <div style="font-weight:700;">${escHtml(code || (productId ? ("Product " + productId) : "Line item"))}</div>
                    <div class="wl-muted">${escHtml(desc)}</div>
                    ${productId ? `<div class="wl-muted">ProductID: ${escHtml(productId)}</div>` : ""}
                    ${chips}
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        `
        : `<div class="wl-muted">No line details found.</div>`;

      openPanel(title, dayBlock + monthBlock + topItems + lineHtml);
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

  // UPDATED FUNCTION: Top Items uses ProductCode/Description from PromoLine table
  function buildTopItemsDaySummaryHtml(promoId, dk, linesByPromoId) {
    if (!SALES_BY_PRODUCT_INDEX || !dk) return "";

    const dayPromo =
      SALES_BY_PRODUCT_INDEX.byDayPromoProduct &&
      SALES_BY_PRODUCT_INDEX.byDayPromoProduct[dk] &&
      SALES_BY_PRODUCT_INDEX.byDayPromoProduct[dk][promoId]
        ? SALES_BY_PRODUCT_INDEX.byDayPromoProduct[dk][promoId]
        : null;

    if (!dayPromo) return "";

    const meta = buildPromoLineMetaLookup(promoId, linesByPromoId);

    const items = Object.entries(dayPromo)
      .map(([productId, agg]) => ({
        productId,
        productCode: (meta[productId] && meta[productId].productCode) ? meta[productId].productCode : "",
        description: (meta[productId] && meta[productId].description) ? meta[productId].description : "",
        sales: agg.sales || 0,
        profit: agg.profit || 0,
      }))
      .sort((a, b) => (b.sales || 0) - (a.sales || 0))
      .slice(0, 10);

    if (!items.length) return "";

    return `
      <div style="margin:10px 0; border-top:1px solid #eee; padding-top:10px;">
        <div style="font-weight:700; margin-bottom:6px;">Top Items (Day)</div>
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Item</th>
              <th style="text-align:right; padding:6px; border-bottom:1px solid #ddd;">Sales</th>
              <th style="text-align:right; padding:6px; border-bottom:1px solid #ddd;">Profit</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((x) => {
              const title = x.productCode ? x.productCode : (x.productId ? ("Product " + x.productId) : "Item");
              const desc = x.description || "";
              return `
                <tr>
                  <td style="padding:6px; border-bottom:1px solid #f0f0f0;">
                    <div style="font-weight:700;">${escHtml(title)}</div>
                    ${desc ? `<div class="wl-muted">${escHtml(desc)}</div>` : ""}
                    ${x.productId ? `<div class="wl-muted">ProductID: ${escHtml(x.productId)}</div>` : ""}
                  </td>
                  <td style="padding:6px; border-bottom:1px solid #f0f0f0; text-align:right;">${escHtml(currency(x.sales))}</td>
                  <td style="padding:6px; border-bottom:1px solid #f0f0f0; text-align:right;">${escHtml(currency(x.profit))}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  // ====== Wiring / Init ======
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

  // ====== Month/Year Jump Picker ======
  function ensureMonthYearPickerUIOnce() {
    if (qs("#wlMonthYearModal")) return;

    const modal = document.createElement("div");
    modal.id = "wlMonthYearModal";
    modal.style.display = "none";
    modal.style.position = "fixed";
    modal.style.inset = "0";
    modal.style.zIndex = "100000";
    modal.style.background = "rgba(0,0,0,0.35)";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.padding = "16px";

    modal.innerHTML = `
      <div id="wlMonthYearDialog"
           style="width:min(420px, 100%); background:#fff; border-radius:14px;
                  box-shadow:0 14px 50px rgba(0,0,0,0.25); border:1px solid rgba(0,0,0,0.15);">
        <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid #eee;">
          <div style="font-weight:800;">Jump to month</div>
          <button type="button" id="wlMonthYearClose"
                  style="border:1px solid rgba(0,0,0,0.18); background:#fff; border-radius:10px; padding:6px 10px; cursor:pointer;">
            ✕
          </button>
        </div>

        <div style="padding:14px;">
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <div style="flex:1; min-width:160px;">
              <div class="wl-muted" style="font-size:12px; margin-bottom:6px;">Month</div>
              <select id="wlPickMonth" style="width:100%; padding:10px; border-radius:12px; border:1px solid rgba(0,0,0,0.18);"></select>
            </div>
            <div style="flex:1; min-width:140px;">
              <div class="wl-muted" style="font-size:12px; margin-bottom:6px;">Year</div>
              <select id="wlPickYear" style="width:100%; padding:10px; border-radius:12px; border:1px solid rgba(0,0,0,0.18);"></select>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:14px;">
            <button type="button" id="wlMonthYearCancel"
                    style="border:1px solid rgba(0,0,0,0.18); background:#fff; border-radius:12px; padding:10px 12px; cursor:pointer; font-weight:700;">
              Cancel
            </button>
            <button type="button" id="wlMonthYearApply"
                    style="border:1px solid rgba(0,0,0,0.18); background:rgba(107,0,22,0.08); border-radius:12px; padding:10px 12px; cursor:pointer; font-weight:800;">
              Go
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => hideMonthYearPicker();
    qs("#wlMonthYearClose").addEventListener("click", close);
    qs("#wlMonthYearCancel").addEventListener("click", close);

    // Click outside dialog closes
    modal.addEventListener("click", (e) => {
      const dialog = qs("#wlMonthYearDialog");
      if (dialog && !dialog.contains(e.target)) close();
    });

    // ESC closes
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hideMonthYearPicker();
    });

    // Apply
    qs("#wlMonthYearApply").addEventListener("click", () => {
      const m = parseInt(qs("#wlPickMonth").value, 10);
      const y = parseInt(qs("#wlPickYear").value, 10);
      if (!Number.isFinite(m) || !Number.isFinite(y)) return;

      CURRENT_MONTH = startOfMonth(new Date(y, m, 1));
      hideMonthYearPicker();
      refreshAllAndRender();
    });
  }

  function showMonthYearPicker() {
    ensureMonthYearPickerUIOnce();

    const modal = qs("#wlMonthYearModal");
    const monthSel = qs("#wlPickMonth");
    const yearSel = qs("#wlPickYear");
    if (!modal || !monthSel || !yearSel) return;

    // Populate months (once)
    if (!monthSel.__wlFilled) {
      monthSel.__wlFilled = true;
      const monthNames = Array.from({ length: 12 }).map((_, i) =>
        new Date(2000, i, 1).toLocaleString(undefined, { month: "long" })
      );
      monthNames.forEach((name, i) => {
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = name;
        monthSel.appendChild(opt);
      });
    }

    // Populate years (based on promo range if possible, else fallback)
    const years = new Set();
    if (Array.isArray(PROMOS) && PROMOS.length) {
      PROMOS.forEach((p) => {
        if (p && p.from) years.add(p.from.getFullYear());
        if (p && p.to) years.add(p.to.getFullYear());
      });
    }
    const nowY = new Date().getFullYear();
    if (years.size === 0) {
      for (let y = nowY - 5; y <= nowY + 5; y++) years.add(y);
    } else {
      const minY = Math.min(...Array.from(years));
      const maxY = Math.max(...Array.from(years));
      years.clear();
      for (let y = minY - 1; y <= maxY + 1; y++) years.add(y);
    }

    yearSel.innerHTML = "";
    Array.from(years).sort((a, b) => a - b).forEach((y) => {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      yearSel.appendChild(opt);
    });

    monthSel.value = String(CURRENT_MONTH.getMonth());
    yearSel.value = String(CURRENT_MONTH.getFullYear());

    modal.style.display = "flex";
  }

  function hideMonthYearPicker() {
    const modal = qs("#wlMonthYearModal");
    if (modal) modal.style.display = "none";
  }

  function bindMonthYearPickerTrigger() {
    const label = qs("#" + MONTH_LABEL_ID);
    if (!label || label.__wlBoundPicker) return;
    label.__wlBoundPicker = true;

    label.style.cursor = "pointer";
    label.title = "Click to jump to a month/year";

    label.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showMonthYearPicker();
    });
  }


  function refreshAllAndRender() {
    ensureUIOnce();
    ensureHeaderViewPromosButton();
    hideCreatePromoLink();
    hideSellingPriceRulesLink();
    bindCloseButton();
    bindNavButtons();
    bindMonthYearPickerTrigger();

    PROMOS = getPromosFromHeaderTable();
    LINES_BY_PROMO = buildLinesByPromoId();
    SALES_INDEX = buildSalesIndexFromTable();
    SALES_BY_PRODUCT_INDEX = buildSalesByProductIndexFromTable();
    GROUP_BY_PRODUCT = buildProductGroupLookupFromTable();

    renderCalendar(CURRENT_MONTH, PROMOS, LINES_BY_PROMO, SALES_INDEX);
    renderInsights(CURRENT_MONTH);
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
