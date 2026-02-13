/* ============================================================================
WL Promotions: PromotionHeader + PromotionLine join
- Adds hover tooltip + click details panel for each promo badge
- Assumes you ALREADY render promo badges in the calendar (or you can map them)
- Safe: only adds UI + listeners, does not remove native BisTrack elements

HOW TO USE (minimal):
1) Paste this JS into your existing script (or load externally)
2) Set BADGE_SELECTOR to whatever your promo badge elements are
3) Make sure each badge has data-promotionid (or adjust getBadgePromotionId)

============================================================================ */

(function () {
  "use strict";

  /* =========================
     CONFIG (adjust these)
     ========================= */

  // Table containing PromotionHeader results (your working one)
  const PROMO_HEADER_TABLE_SELECTOR = "table.Table208993";

  // PromotionLine results table: set if you know it. Otherwise it will auto-detect by headers containing "PromotionID".
  const PROMO_LINE_TABLE_SELECTOR = null; // e.g. "table.Table208994"

  // Your existing promo badges in the calendar view:
  // Set this to a selector that matches the badge elements you already inject.
  // Example: ".wlPromoBadge" or ".calendar-promo" etc.
  const BADGE_SELECTOR = ".wlPromoBadge";

  // Where is the promotion id stored on the badge?
  // Recommended: <div class="wlPromoBadge" data-promotionid="123">...</div>
  function getBadgePromotionId(el) {
    return (el.dataset && (el.dataset.promotionid || el.dataset.promoId || el.dataset.promotionId)) || "";
  }

  const TOOLTIP_PREVIEW_COUNT = 5;

  /* =========================
     Helpers
     ========================= */

  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const safeText = (x) => (x == null ? "" : String(x));
  const clamp = (n, min, max) => Math.max(min, Math.min(n, max));

  function parseDateLoose(s) {
    const str = safeText(s).trim();
    if (!str) return null;

    // Native parse first
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;

    // MM/DD/YYYY
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

  function ensureStyleOnce() {
    if (qs("#wlPromoUIStyles")) return;
    const style = document.createElement("style");
    style.id = "wlPromoUIStyles";
    style.textContent = `
      #wlPromoTooltip{
        display:none; position:fixed; z-index:99999; background:#fff;
        border:1px solid #ccc; border-radius:10px; padding:10px;
        box-shadow:0 10px 30px rgba(0,0,0,.15); max-width:360px;
        font-size:12px; text-align:left;
      }
      #wlPromoDetailsPanel{
        display:none; position:fixed; right:16px; top:16px; width:420px;
        max-width: calc(100vw - 32px); max-height: calc(100vh - 32px);
        overflow:auto; background:#fff; border:1px solid #ccc;
        border-radius:14px; box-shadow:0 12px 40px rgba(0,0,0,.2);
        z-index:99998;
      }
      #wlPromoDetailsPanel .wl-promo-panel__header{
        display:flex; justify-content:space-between; align-items:center;
        padding:12px 12px; border-bottom:1px solid #eee; font-weight:700;
      }
      #wlPromoDetailsPanel .wl-promo-panel__header button{
        cursor:pointer; border:none; background:transparent; font-size:16px;
      }
      .wl-panel-row{ padding:10px 12px; border-bottom:1px solid #f1f1f1; }
      .wl-muted{ color:#666; font-weight:400; }
      .wl-chip{ display:inline-block; padding:2px 8px; border-radius:999px;
        border:1px solid #ddd; background:#fafafa; margin-right:6px; margin-top:6px; }
      .wlPromoBadge{ cursor:pointer; }
    `;
    document.head.appendChild(style);
  }

  function ensureUIOnce() {
    ensureStyleOnce();

    if (!qs("#wlPromoTooltip")) {
      const tip = document.createElement("div");
      tip.id = "wlPromoTooltip";
      document.body.appendChild(tip);
    }
    if (!qs("#wlPromoDetailsPanel")) {
      const panel = document.createElement("div");
      panel.id = "wlPromoDetailsPanel";
      panel.innerHTML = `
        <div class="wl-promo-panel__header">
          <div id="wlPanelTitle"></div>
          <button type="button" id="wlPanelClose" aria-label="Close promotion details">✕</button>
        </div>
        <div id="wlPanelBody"></div>
      `;
      document.body.appendChild(panel);
      qs("#wlPanelClose").addEventListener("click", closePanel);
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
  }

  function closePanel() {
    const panel = qs("#wlPromoDetailsPanel");
    if (panel) panel.style.display = "none";
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

  function findPromotionLineTable() {
    if (PROMO_LINE_TABLE_SELECTOR) {
      const forced = qs(PROMO_LINE_TABLE_SELECTOR);
      if (forced) return forced;
    }

    // Auto-detect: any table whose header includes PromotionID and looks "line-like"
    const tables = qsa("table");
    const getHeaders = (t) =>
      qsa("thead th", t)
        .map((x) => (x.innerText || "").trim().toLowerCase())
        .filter(Boolean);

    for (const t of tables) {
      if (!qs("thead", t)) continue;
      const hs = getHeaders(t);
      const hasPromoId = hs.includes("promotionid");
      const looksLine =
        hs.some((h) => h.includes("product")) ||
        hs.some((h) => h.includes("line")) ||
        hs.some((h) => h.includes("discount")) ||
        hs.some((h) => h.includes("group")) ||
        hs.some((h) => h.includes("price"));
      if (hasPromoId && looksLine) return t;
    }

    for (const t of tables) {
      if (!qs("thead", t)) continue;
      const hs = getHeaders(t);
      if (hs.includes("promotionid")) return t;
    }

    return null;
  }

  function buildLinesByPromoId() {
    const t = findPromotionLineTable();
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

  function getPromosFromHeaderTable() {
    const table = qs(PROMO_HEADER_TABLE_SELECTOR);
    if (!table) return [];

    // If your column ordering differs, adjust these indexes:
    // 0 PromotionID
    // 1 Promo Code
    // 2 Promo Name
    // 3 Start Date
    // 4 End Date
    // 5 Branch (optional)
    const rows = qsa("tbody tr", table);

    return rows
      .map((tr) => {
        const tds = qsa("td", tr);
        if (!tds.length) return null;

        const id = (tds[0]?.innerText || "").trim();
        const code = (tds[1]?.innerText || "").trim();
        const name = (tds[2]?.innerText || "").trim();
        const startRaw = (tds[3]?.innerText || "").trim();
        const endRaw = (tds[4]?.innerText || "").trim();
        const branchId = (tds[5]?.innerText || "").trim();

        return {
          id,
          code,
          name,
          from: parseDateLoose(startRaw),
          to: parseDateLoose(endRaw),
          branchId,
        };
      })
      .filter(Boolean);
  }

  function indexPromosById(promos) {
    const map = {};
    promos.forEach((p) => {
      if (p && p.id) map[String(p.id).trim()] = p;
    });
    return map;
  }

  function attachBadgeEvents(el, promo, linesByPromoId) {
    if (!el || el.__wlPromoBound) return;
    el.__wlPromoBound = true;

    const promoId = String(promo.id || "").trim();
    el.dataset.promotionid = promoId; // enforce
    el.classList.add("wlPromoBadge");

    el.addEventListener("mousemove", (ev) => {
      const id = el.dataset.promotionid;
      const lines = linesByPromoId[id] || [];
      const count = lines.length;

      const chips = [
        `<span class="wl-chip">PromoID: ${id || "?"}</span>`,
        promo.branchId ? `<span class="wl-chip">Branch: ${promo.branchId}</span>` : "",
        `<span class="wl-chip">Lines: ${count}</span>`,
      ].join("");

      const dateLine =
        promo.from && promo.to ? `${formatDate(promo.from)} – ${formatDate(promo.to)}` : "";

      const preview = lines
        .slice(0, TOOLTIP_PREVIEW_COUNT)
        .map((l) => {
          const prod = l["ProductID"] || l["productid"] || "";
          const grp = l["GroupID"] || l["groupid"] || "";
          const desc = prod ? `Product ${prod}` : grp ? `Group ${grp}` : "Line item";
          return `<div class="wl-panel-row">${desc}</div>`;
        })
        .join("");

      const html = `
        <div style="font-weight:700; margin-bottom:6px;">
          ${promo.name || promo.code || "Promotion"}
        </div>
        ${dateLine ? `<div class="wl-muted" style="margin-bottom:8px;">${dateLine}</div>` : ""}
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

      const id = el.dataset.promotionid;
      const lines = linesByPromoId[id] || [];

      const dateLine =
        promo.from && promo.to
          ? `<span class="wl-muted">(${formatDate(promo.from)} – ${formatDate(promo.to)})</span>`
          : "";

      const title = `${promo.name || promo.code || "Promotion"} ${dateLine}`;

      const linesHtml =
        lines.length > 0
          ? lines
              .map((l) => {
                const prod = l["ProductID"] || l["productid"] || "";
                const grp = l["GroupID"] || l["groupid"] || "";
                const amountOff =
                  l["AmountOff"] || l["amountoff"] || l["DiscountAmount"] || l["discountamount"] || "";
                const percentOff =
                  l["PercentOff"] || l["percentoff"] || l["DiscountPercent"] || l["discountpercent"] || "";
                const salePrice =
                  l["SalePrice"] || l["saleprice"] || l["PromoPrice"] || l["promoprice"] || "";

                let bits = "";
                if (prod) bits += `<div><strong>ProductID:</strong> ${prod}</div>`;
                if (grp) bits += `<div><strong>GroupID:</strong> ${grp}</div>`;
                if (salePrice) bits += `<div><strong>Sale Price:</strong> ${salePrice}</div>`;
                if (percentOff) bits += `<div><strong>% Off:</strong> ${percentOff}</div>`;
                if (amountOff) bits += `<div><strong>$ Off:</strong> ${amountOff}</div>`;

                if (!bits) {
                  const keys = Object.keys(l).slice(0, 8);
                  bits = `<div class="wl-muted">Line data present (columns: ${keys.join(", ")}...)</div>`;
                }

                return `<div class="wl-panel-row">${bits}</div>`;
              })
              .join("")
          : `<div class="wl-panel-row wl-muted">No line rows were found for this PromotionID.</div>`;

      const body = `
        <div class="wl-panel-row"><strong>PromotionID:</strong> ${id || "?"}</div>
        <div class="wl-panel-row"><strong>Branch:</strong> ${promo.branchId || "All"}</div>
        <div class="wl-panel-row"><strong>Promo Code:</strong> ${promo.code || ""}</div>
        <div class="wl-panel-row"><strong>Lines:</strong> ${lines.length}</div>
        <div class="wl-panel-row"><strong>Details</strong> <span class="wl-muted">(PromotionLine)</span></div>
        ${linesHtml}
      `;

      openPanel(title, body);
    });
  }

  function bindBadges(promosById, linesByPromoId) {
    const badges = qsa(BADGE_SELECTOR);
    if (!badges.length) return;

    badges.forEach((el) => {
      const id = String(getBadgePromotionId(el)).trim();
      if (!id) return;

      const promo = promosById[id];
      if (!promo) return;

      attachBadgeEvents(el, promo, linesByPromoId);
    });
  }

  function init() {
    ensureUIOnce();

    const promos = getPromosFromHeaderTable();
    const promosById = indexPromosById(promos);
    const linesByPromoId = buildLinesByPromoId();

    bindBadges(promosById, linesByPromoId);

    // Escape closes
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        hideTooltip();
        closePanel();
      }
    });
  }

  // Run once DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
