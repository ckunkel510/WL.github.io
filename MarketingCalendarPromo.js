/* ============================================================================
WL Promo Calendar (BisTrack Dashboard)
- Renders a month grid calendar from PromotionHeader table (Table208993)
- Creates promo badges with data-promotionid so tooltips/panel can bind
- Uses PromotionLine table (Table208994) for hover/click details
- Loads Product images via JSONP from Apps Script (works from file://)
- Optimized: calendar renders immediately; images load in background
============================================================================ */

(function () {
  "use strict";

  // ====== CONFIG ======
  const PROMO_HEADER_TABLE_SELECTOR = "table.Table208993";
  const PROMO_LINE_TABLE_SELECTOR = "table.Table208994";

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

  // Optional fallback if PromotionLine includes an image field later
  const IMAGE_FIELD_CANDIDATES = ["ImageURL", "ImageUrl", "Image", "ImageLink", "image_link", "image link"];

  // Simple placeholder (no external request). You can swap this for a local icon if you want.
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

  // Normalize ProductID so "12345.0" / "12,345" / " 12345 " all become "12345"
  function normalizeProductId(x) {
    let s = safeText(x).trim();
    if (!s) return "";
    s = s.replace(/,/g, "");
    // If it looks numeric with .0 trailing, strip it
    s = s.replace(/\.0+$/, "");
    // If it’s purely numeric after cleanup, keep digits only
    if (/^\d+(\.\d+)?$/.test(s)) {
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? String(n) : s;
    }
    // last resort: trim again
    return s.trim();
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

  // ====== Image Map (ProductID -> ImageURL) via JSONP ======
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
        try { delete window[cbName]; } catch {}
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
          const rawMap = (data && data.ok && data.map) ? data.map : null;
          if (!rawMap) {
            PRODUCT_IMAGE_MAP_READY = false;
            resolve(false);
            return;
          }

          // Normalize keys so they match PromotionLine ProductID formatting
          const normalized = {};
          for (const k in rawMap) {
            const nk = normalizeProductId(k);
            const v = rawMap[k];
            if (nk && v) normalized[nk] = String(v).trim();
          }

          PRODUCT_IMAGE_MAP = normalized;
          PRODUCT_IMAGE_MAP_READY = true;

          // If panel is open, update images in place
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
    const pid = normalizeProductId(productId);
    if (pid && PRODUCT_IMAGE_MAP && PRODUCT_IMAGE_MAP[pid]) return PRODUCT_IMAGE_MAP[pid];

    // fallback: if PromotionLine happens to include an image field
    const fallback = pickFirstField(lineObj, IMAGE_FIELD_CANDIDATES);
    return fallback || "";
  }

  // ====== UI Ensure ======
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

  function refreshPanelImages() {
    const panel = qs("#wlPromoDetailsPanel");
    if (!panel || panel.style.display === "none") return;

    // Find any images that were rendered without a src (or placeholder), and try to populate them now
    qsa("img.wl-line-img[data-productid]", panel).forEach((img) => {
      const pid = normalizeProductId(img.getAttribute("data-productid") || "");
      if (!pid) return;

      const url = PRODUCT_IMAGE_MAP_READY && PRODUCT_IMAGE_MAP[pid] ? PRODUCT_IMAGE_MAP[pid] : "";
      if (url) {
        // Only replace if currently placeholder / empty
        const current = safeText(img.getAttribute("src")).trim();
        if (!current || current === PLACEHOLDER_DATA_URI) img.src = url;
      }
    });

    // Update “Image ✓/—” indicators too
    qsa("[data-img-status][data-productid]", panel).forEach((el) => {
      const pid = normalizeProductId(el.getAttribute("data-productid") || "");
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

  // ====== Calendar Render ======
  function monthLabel(d) {
    const m = d.toLocaleString(undefined, { month: "long" });
    return `${m} ${d.getFullYear()}`;
  }

  function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function renderCalendar(currentMonth, promos, linesByPromoId) {
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

      const num = document.createElement("div");
      num.className = "wl-day__num";
      num.textContent = day.getDate();
      cell.appendChild(num);

      const stack = document.createElement("div");
      stack.className = "wl-promo-stack";

      const todays = promos.filter((p) => p.from && p.to && inRange(day, p.from, p.to));

      todays.forEach((p) => {
        const badge = document.createElement("div");
        badge.className = "wl-promo " + BADGE_CLASS;
        badge.dataset.promotionid = String(p.id).trim();
        badge.title = p.name || p.code || "Promotion";
        badge.textContent = p.code || p.name || `Promo ${p.id}`;

        attachBadgeEvents(badge, p, linesByPromoId);
        stack.appendChild(badge);
      });

      cell.appendChild(stack);
      grid.appendChild(cell);
    }
  }

  // ====== Tooltip / Panel Binding ======
  function attachBadgeEvents(el, promo, linesByPromoId) {
    if (!el || el.__wlPromoBound) return;
    el.__wlPromoBound = true;

    el.addEventListener("mousemove", (ev) => {
      const id = String(el.dataset.promotionid || "").trim();
      const lines = linesByPromoId[id] || [];
      const count = lines.length;

      const chips = [
        promo.branchId ? `<span class="wl-chip">Branch: ${escHtml(promo.branchId)}</span>` : "",
        `<span class="wl-chip">Lines: ${count}</span>`,
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
        ${
          count > TOOLTIP_PREVIEW_COUNT
            ? `<div class="wl-muted" style="margin-top:6px;">+${count - TOOLTIP_PREVIEW_COUNT} more… (click)</div>`
            : ""
        }
      `;

      showTooltip(html, ev.clientX, ev.clientY);
    });

    el.addEventListener("mouseleave", hideTooltip);

    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      hideTooltip();

      const id = String(el.dataset.promotionid || "").trim();
      const lines = linesByPromoId[id] || [];

      const dateLine =
        promo.from && promo.to
          ? `<span class="wl-muted">(${escHtml(formatDate(promo.from))} – ${escHtml(formatDate(promo.to))})</span>`
          : "";

      const title = `${escHtml(promo.name || promo.code || "Promotion")} ${dateLine}`;

      const linesHtml =
        lines.length > 0
          ? `<div class="wl-lines">` +
            lines
              .map((l) => {
                const prodIdRaw = getFieldLoose(l, ["ProductID", "productid"]); // internal only
                const prodId = normalizeProductId(prodIdRaw);

                const code = getFieldLoose(l, ["ProductCode", "productcode"]);
                const desc = getFieldLoose(l, ["Description", "description"]);
                const qty = getFieldLoose(l, ["Quantity", "Qty", "qty"]);
                const price = getFieldLoose(l, ["SalePrice", "Price", "price"]);
                const uom = getFieldLoose(l, ["UOM", "Uom", "uom"]);
                const group = getFieldLoose(l, ["ProductGroupID", "GroupID", "groupid"]);

                const imgUrl = getImageForProductId(prodId, l);
                const titleText = code || "Promotion Line Item";

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
                        <div class="wl-line-title">${escHtml(titleText)}</div>

                        <div class="wl-line-meta">
                          ${uom ? `<span class="wl-kv">UOM: ${escHtml(uom)}</span>` : ""}
                          ${qty ? `<span class="wl-kv">Qty: ${escHtml(qty)}</span>` : ""}
                          ${price ? `<span class="wl-kv">Price: ${escHtml(price)}</span>` : ""}
                          ${group ? `<span class="wl-kv">Group: ${escHtml(group)}</span>` : ""}
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
        ${linesHtml}
      `;

      openPanel(title, body);

      // If images weren’t ready at click time, refresh once the map arrives.
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

    let current = new Date();
    current = new Date(current.getFullYear(), current.getMonth(), 1);

    const prev = qs("#" + PREV_ID);
    const next = qs("#" + NEXT_ID);

    function rerender() {
      renderCalendar(current, promos, lines);
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

    // Render immediately (fast)
    rerender();

    // Kick off image map load in background (do NOT block dashboard)
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
