/* ============================================================================
WL Promo Calendar (BisTrack Dashboard)
- Renders a month grid calendar from PromotionHeader table (Table208993)
- Creates promo badges with data-promotionid so tooltips/panel can bind
- Uses PromotionLine table (Table208994) for hover/click details
============================================================================ */

(function () {
  "use strict";

  // ====== CONFIG ======
  const PROMO_HEADER_TABLE_SELECTOR = "table.Table208993";
  const PROMO_LINE_TABLE_SELECTOR = "table.Table208994"; // you have this in the output

  // Your injected calendar container
  const CAL_ID = "wlPromoCal";
  const GRID_ID = "wlPromoGrid";
  const MONTH_LABEL_ID = "wlMonthLabel";
  const PREV_ID = "wlPrevMonth";
  const NEXT_ID = "wlNextMonth";

  const BADGE_CLASS = "wlPromoBadge";
  const TOOLTIP_PREVIEW_COUNT = 5;

  // ====== Helpers ======
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const safeText = (x) => (x == null ? "" : String(x));
  const clamp = (n, min, max) => Math.max(min, Math.min(n, max));

  function parseDateLoose(s) {
    const str = safeText(s).trim();
    if (!str) return null;

    // Native parse first
    const d = new Date(str);
    if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), d.getDate());

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

  function sameDay(a, b) {
    return (
      a && b &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function inRange(day, from, to) {
    if (!day || !from || !to) return false;
    const t = day.getTime();
    return t >= from.getTime() && t <= to.getTime();
  }

  // ====== UI Ensure ======
  function ensureUIOnce() {
    // tooltip
    if (!qs("#wlPromoTooltip")) {
      const tip = document.createElement("div");
      tip.id = "wlPromoTooltip";
      tip.style.display = "none";
      tip.style.position = "fixed";
      tip.style.zIndex = "99999";
      document.body.appendChild(tip);
    }

    // panel
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

  // ====== Data Read ======
  function getPromosFromHeaderTable() {
    const table = qs(PROMO_HEADER_TABLE_SELECTOR);
    if (!table) return [];

    const rows = qsa("tbody tr", table);

    // Based on your header output: PromotionID, BranchID, PromotionCode, PromotionName, ... ValidFrom, ValidTo ...
    // In your HTML the date columns are labeled ValidFrom / ValidTo and appear mid-table. :contentReference[oaicite:5]{index=5}
    // We'll locate columns by header name to be safer.
    const headers = qsa("thead th", table).map(th => (th.innerText || "").trim());

    const idx = (name) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());

    const iPromoId = idx("PromotionID");
    const iBranchId = idx("BranchID");
    const iCode = idx("PromotionCode");
    const iName = idx("PromotionName");
    const iFrom = idx("ValidFrom");
    const iTo = idx("ValidTo");

    return rows.map(tr => {
      const tds = qsa("td", tr);
      const id = (tds[iPromoId]?.innerText || "").trim();
      if (!id) return null;
      const branchId = (tds[iBranchId]?.innerText || "").trim();
      const code = (tds[iCode]?.innerText || "").trim();
      const name = (tds[iName]?.innerText || "").trim();
      const from = parseDateLoose((tds[iFrom]?.innerText || "").trim());
      const to = parseDateLoose((tds[iTo]?.innerText || "").trim());
      return { id, branchId, code, name, from, to };
    }).filter(Boolean);
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

  function promosById(promos) {
    const m = {};
    promos.forEach(p => { m[String(p.id).trim()] = p; });
    return m;
  }

  // ====== Calendar Render ======
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

  function renderCalendar(currentMonth, promos, linesByPromoId) {
    const grid = qs("#" + GRID_ID);
    const label = qs("#" + MONTH_LABEL_ID);
    if (!grid || !label) return;

    grid.innerHTML = "";
    label.textContent = monthLabel(currentMonth);

    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    // Calendar grid: start on Sunday
    const startDay = new Date(start);
    startDay.setDate(start.getDate() - start.getDay());

    // 6 weeks grid (42 cells)
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

      // promos active on this day
      const todays = promos.filter(p => p.from && p.to && inRange(day, p.from, p.to));

      todays.forEach(p => {
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
          const code = l["ProductCode"] || l["productcode"] || "";
          const desc = l["Description"] || l["description"] || "";
          const label = prod ? `${prod}${code ? " • " + code : ""}` : "Line item";
          return `<div class="wl-panel-row"><strong>${label}</strong><div class="wl-muted">${safeText(desc)}</div></div>`;
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

      const id = String(el.dataset.promotionid || "").trim();
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
                const prod = l["ProductID"] || "";
                const code = l["ProductCode"] || "";
                const desc = l["Description"] || "";
                const group = l["ProductGroupID"] || l["GroupID"] || "";
                return `
                  <div class="wl-panel-row">
                    ${prod ? `<div><strong>ProductID:</strong> ${prod}</div>` : ""}
                    ${code ? `<div><strong>ProductCode:</strong> ${code}</div>` : ""}
                    ${group ? `<div><strong>Group:</strong> ${group}</div>` : ""}
                    ${desc ? `<div class="wl-muted" style="margin-top:6px;">${safeText(desc)}</div>` : ""}
                  </div>
                `;
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

  // ====== Init ======
  function init() {
    ensureUIOnce();

    const closeBtn = document.querySelector("#wlPanelClose");
if (closeBtn) closeBtn.addEventListener("click", closePanel);


    const cal = qs("#" + CAL_ID);
    if (!cal) {
      // calendar container not present => nothing to do
      return;
    }

    const promos = getPromosFromHeaderTable();
    const lines = buildLinesByPromoId();

    let current = new Date();
    current = new Date(current.getFullYear(), current.getMonth(), 1);

    // Wire nav buttons
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

    rerender();

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
