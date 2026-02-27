/* wl-refine-flyout.js (responsive)
   Desktop: right-side flyout
   Mobile: inline accordion with scrollable option area
*/

(function () {
  "use strict";

  const CFG = {
    allowPages: new Set(["products.aspx"]),
    hideSections: ["keywords"],
    dedupeOptions: true,

    responsive: {
      // below this width, use INLINE mode (no flyout)
      inlineMaxWidth: 860,
      // max height of the inline options area (px) before it scrolls
      inlineOptionsMaxHeight: 320,
    },

    flyout: {
      width: 420,
      maxHeightVh: 72,
      offsetPx: 12,
      closeOnOutsideClick: true,
      closeOnEsc: true,
    },

    // inline default open section(s) (case-insensitive includes)
    defaultOpenInline: ["brand"],
  };

  // -----------------------------
  // Utils
  // -----------------------------
  const normSpace = (s) =>
    String(s || "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const pageFile = () => (location.pathname.split("/").pop() || "").toLowerCase();

  function isInlineMode() {
    // prefer viewport width because it matches the actual rendering constraints
    return window.innerWidth <= CFG.responsive.inlineMaxWidth;
  }

  const canonicalizeValue = (labelText) => {
    let s = normSpace(labelText)
      .toLowerCase()
      .replace(/[′’‛`]/g, "'")
      .replace(/[″“”]/g, '"')
      .replace(/\b(feet|foot)\b/g, "ft")
      .replace(/\b(inches|inch)\b/g, "in");

    s = s.replace(/\b(\d+(?:\.\d+)?)\s*'\b/g, "$1 ft");
    s = s.replace(/\bft\.\b/g, "ft").replace(/\bin\.\b/g, "in");
    return normSpace(s);
  };

  function injectStylesOnce() {
    if (document.getElementById("wl-refine-responsive-css")) return;

    const css = `
/* Modernize base headers */
.RadPanelBar[id*="RefineSearchRadPanelBar"] a.rpLink{
  border-radius: 10px;
  margin: 6px 8px;
  padding: 10px 12px !important;
  background:#fff;
  border:1px solid rgba(0,0,0,.10);
  box-shadow:0 1px 2px rgba(0,0,0,.05);
  transition:transform .08s ease, box-shadow .08s ease, border-color .08s ease;
}
.RadPanelBar[id*="RefineSearchRadPanelBar"] a.rpLink:hover{
  transform:translateY(-1px);
  box-shadow:0 2px 10px rgba(0,0,0,.08);
  border-color:rgba(0,0,0,.18);
}
.RadPanelBar[id*="RefineSearchRadPanelBar"] a.rpLink .rpText{ font-weight:600; }

/* Active section */
.wl-refine-active > a.rpLink{
  border-color:rgba(0,0,0,.25) !important;
  box-shadow:0 2px 12px rgba(0,0,0,.10) !important;
}

/* Inline mode: make section slide look like a card */
.wl-inline .rpSlide{
  margin: 0 8px 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid rgba(0,0,0,.10);
  box-shadow: 0 8px 22px rgba(0,0,0,.06);
}

/* Inline mode: options area scrolls instead of page growing forever */
.wl-inline .wl-inline-options-scroll{
  overflow:auto;
  -webkit-overflow-scrolling: touch;
  border-top:1px solid rgba(0,0,0,.06);
  margin-top:10px;
  padding-top:10px;
}

/* Flyout shell */
.wl-refine-flyout{
  position:absolute;
  z-index:99999;
  background:#fff;
  border:1px solid rgba(0,0,0,.12);
  box-shadow:0 14px 50px rgba(0,0,0,.18);
  border-radius:14px;
  overflow:hidden;
}
.wl-refine-flyout-header{
  display:flex; align-items:center; justify-content:space-between;
  padding:12px 14px;
  border-bottom:1px solid rgba(0,0,0,.08);
  background:linear-gradient(to bottom, #fff, rgba(0,0,0,.02));
}
.wl-refine-flyout-title{ font-weight:700; font-size:14px; }
.wl-refine-flyout-close{
  border:1px solid rgba(0,0,0,.18);
  background:#fff;
  border-radius:10px;
  padding:6px 10px;
  cursor:pointer;
}
.wl-refine-flyout-body{ padding:10px 14px; overflow:auto; }
.wl-refine-flyout-body input[type="checkbox"]{ transform:scale(1.05); margin-right:10px; }

/* Safety: on small screens, force flyout hidden (prevents left-peek/offscreen issues) */
@media (max-width: 860px){
  .wl-refine-flyout{ display:none !important; }
}
    `.trim();

    const style = document.createElement("style");
    style.id = "wl-refine-responsive-css";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function findPanelBar() {
    return document.querySelector('[id*="RefineSearchRadPanelBar"].RadPanelBar');
  }

  function findRefineRoot(panelBarEl) {
    const links = panelBarEl.querySelectorAll("a.rpLink");
    for (const a of links) {
      const t = normSpace(a.textContent).toLowerCase();
      if (t === "refine by") return a.closest("li.rpItem");
    }
    return null;
  }

  function getSectionHeaderText(sectionLi) {
    const t = sectionLi.querySelector(":scope > a.rpLink .rpText");
    return normSpace(t ? t.textContent : "");
  }

  function hideSection(li) {
    li.style.display = "none";
  }

  function dedupeSectionOptions(sectionLi) {
    const table = sectionLi.querySelector(".rpTemplate table");
    if (!table) return;
    const spans = table.querySelectorAll("span[refinequery]");
    if (!spans || spans.length < 2) return;

    const seen = new Map();
    spans.forEach((sp) => {
      const labelEl = sp.querySelector("label");
      if (!labelEl) return;
      const original = normSpace(labelEl.textContent);
      const canon = canonicalizeValue(original);
      if (!canon) return;

      if (!seen.has(canon)) {
        seen.set(canon, sp);
        if (canon !== original.toLowerCase()) labelEl.textContent = " " + canon;
      } else {
        sp.style.display = "none";
      }
    });
  }

  // -----------------------------
  // Inline accordion mode (mobile)
  // -----------------------------
  function setSlideOpen(li, open) {
    const slide = li.querySelector(":scope > .rpSlide");
    if (!slide) return;
    slide.style.display = open ? "block" : "none";
    li.classList.toggle("wl-refine-active", !!open);
  }

  function makeInlineScrollable(li) {
    const slide = li.querySelector(":scope > .rpSlide");
    if (!slide) return;

    // wrap the template content in a scroll container once
    const templ = slide.querySelector(".rpTemplate");
    if (!templ || templ.__WL_WRAPPED__) return;
    templ.__WL_WRAPPED__ = true;

    const wrap = document.createElement("div");
    wrap.className = "wl-inline-options-scroll";
    wrap.style.maxHeight = CFG.responsive.inlineOptionsMaxHeight + "px";

    // move template content into wrapper
    wrap.appendChild(templ.cloneNode(true));
    templ.parentNode.replaceChild(wrap, templ);
  }

  function bindInlineAccordion(sectionLis) {
    sectionLis.forEach((li) => {
      const link = li.querySelector(":scope > a.rpLink");
      const slide = li.querySelector(":scope > .rpSlide");
      if (!link || !slide) return;

      // avoid double binding
      if (link.__WL_INLINE_BOUND__) return;
      link.__WL_INLINE_BOUND__ = true;

      // prevent Telerik from fighting us
      const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

        const isOpen = slide.style.display !== "none";

        // close all others (accordion)
        sectionLis.forEach((other) => setSlideOpen(other, false));

        // toggle this one
        setSlideOpen(li, !isOpen);

        // keep it usable: make options area scroll
        if (!isOpen) makeInlineScrollable(li);
      };

      link.addEventListener("click", handler, true);
      link.addEventListener("pointerdown", handler, true);
    });
  }

  // -----------------------------
  // Flyout mode (desktop)
  // -----------------------------
  let flyoutEl = null;
  let activeSectionLi = null;

  function ensureFlyout() {
    if (flyoutEl) return flyoutEl;

    flyoutEl = document.createElement("div");
    flyoutEl.className = "wl-refine-flyout";
    flyoutEl.style.width = CFG.flyout.width + "px";

    const header = document.createElement("div");
    header.className = "wl-refine-flyout-header";

    const title = document.createElement("div");
    title.className = "wl-refine-flyout-title";
    title.textContent = "Filter";

    const close = document.createElement("button");
    close.type = "button";
    close.className = "wl-refine-flyout-close";
    close.textContent = "Close";
    close.addEventListener("click", () => closeFlyout());

    header.appendChild(title);
    header.appendChild(close);

    const body = document.createElement("div");
    body.className = "wl-refine-flyout-body";
    body.style.maxHeight = CFG.flyout.maxHeightVh + "vh";

    flyoutEl.appendChild(header);
    flyoutEl.appendChild(body);

    document.body.appendChild(flyoutEl);
    return flyoutEl;
  }

  function positionFlyout(panelBar, sectionLi) {
    const rect = panelBar.getBoundingClientRect();
    const left = Math.round(rect.right + CFG.flyout.offsetPx + window.scrollX);

    const headerRect = sectionLi.querySelector(":scope > a.rpLink").getBoundingClientRect();
    let top = Math.round(headerRect.top + window.scrollY);

    const fly = ensureFlyout();
    fly.style.left = left + "px";
    fly.style.top = top + "px";
  }

  function closeFlyout() {
    if (!flyoutEl) return;
    flyoutEl.style.display = "none";
    if (activeSectionLi) {
      activeSectionLi.classList.remove("wl-refine-active");
      activeSectionLi = null;
    }
  }

  function openFlyoutForSection(panelBar, sectionLi) {
    if (isInlineMode()) return; // safety

    const fly = ensureFlyout();
    const body = fly.querySelector(".wl-refine-flyout-body");
    const title = fly.querySelector(".wl-refine-flyout-title");
    const headerText = getSectionHeaderText(sectionLi) || "Filter";

    // active styling
    if (activeSectionLi && activeSectionLi !== sectionLi) {
      activeSectionLi.classList.remove("wl-refine-active");
    }
    activeSectionLi = sectionLi;
    sectionLi.classList.add("wl-refine-active");

    title.textContent = headerText;
    body.innerHTML = "";

    const origTable = sectionLi.querySelector(".rpTemplate table");
    if (!origTable) {
      body.textContent = "No options found.";
    } else {
      const cloned = origTable.cloneNode(true);

      // wire cloned checkbox -> original checkbox click
      cloned.querySelectorAll('input[type="checkbox"]').forEach((ci) => {
        const origId = ci.getAttribute("id");
        if (!origId) return;
        const origInput = document.getElementById(origId);
        if (!origInput) return;

        ci.checked = origInput.checked;

        ci.addEventListener("change", () => {
          if (origInput.checked !== ci.checked) origInput.click();
        });
      });

      body.appendChild(cloned);
    }

    fly.style.display = "block";
    positionFlyout(panelBar, sectionLi);
  }

  function bindFlyoutHeaders(panelBar, sectionLis) {
    sectionLis.forEach((li) => {
      const link = li.querySelector(":scope > a.rpLink");
      if (!link) return;

      if (link.__WL_FLYOUT_BOUND__) return;
      link.__WL_FLYOUT_BOUND__ = true;

      const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

        if (activeSectionLi === li && flyoutEl && flyoutEl.style.display !== "none") {
          closeFlyout();
          return;
        }
        openFlyoutForSection(panelBar, li);
      };

      link.addEventListener("click", handler, true);
      link.addEventListener("pointerdown", handler, true);
    });
  }

  // -----------------------------
  // Init / Reinit
  // -----------------------------
  function init() {
    if (!CFG.allowPages.has(pageFile())) return;

    injectStylesOnce();

    const panelBar = findPanelBar();
    if (!panelBar) return;

    const refineRoot = findRefineRoot(panelBar);
    if (!refineRoot) return;

    const rootGroup =
      refineRoot.querySelector(":scope > .rpSlide > ul.rpGroup") ||
      refineRoot.querySelector(":scope > .rpSlide");

    if (!rootGroup) return;

    // mark panelBar for responsive CSS hooks
    panelBar.classList.toggle("wl-inline", isInlineMode());

    const sectionLis = Array.from(rootGroup.querySelectorAll(":scope > li.rpItem"));

    sectionLis.forEach((li) => {
      const header = getSectionHeaderText(li).toLowerCase();

      if (CFG.hideSections.includes(header)) {
        hideSection(li);
        return;
      }

      if (CFG.dedupeOptions) {
        try { dedupeSectionOptions(li); } catch (_) {}
      }
    });

    // MODE SWITCH
    if (isInlineMode()) {
      // Ensure flyout is hidden (prevents “something on the left”)
      closeFlyout();

      // Show slides (inline) and start collapsed
      sectionLis.forEach((li) => {
        const slide = li.querySelector(":scope > .rpSlide");
        if (slide) slide.style.display = "none";
        li.classList.remove("wl-refine-active");
      });

      bindInlineAccordion(sectionLis);

      // default open one (optional)
      const first = sectionLis.find((li) => {
        const t = getSectionHeaderText(li).toLowerCase();
        return CFG.defaultOpenInline.some((x) => t.includes(String(x).toLowerCase()));
      }) || sectionLis.find((li) => li.style.display !== "none");

      if (first) {
        setSlideOpen(first, true);
        makeInlineScrollable(first);
      }
    } else {
      // Desktop: hide slide growth by keeping slides hidden;
      // we still rely on the original DOM for checkbox IDs.
      sectionLis.forEach((li) => {
        const slide = li.querySelector(":scope > .rpSlide");
        if (slide) slide.style.display = "none";
      });

      bindFlyoutHeaders(panelBar, sectionLis);

      // close flyout if it would be offscreen
      if (flyoutEl && flyoutEl.style.display !== "none") {
        // reposition to current active if any
        if (activeSectionLi) positionFlyout(panelBar, activeSectionLi);
      }

      // esc / outside close once
      if (!window.__WL_REFINE_CLOSE_BOUND__) {
        window.__WL_REFINE_CLOSE_BOUND__ = true;

        document.addEventListener("keydown", (e) => {
          if (CFG.flyout.closeOnEsc && e.key === "Escape") closeFlyout();
        });

        document.addEventListener("mousedown", (e) => {
          if (!CFG.flyout.closeOnOutsideClick) return;
          if (!flyoutEl || flyoutEl.style.display === "none") return;
          const link = activeSectionLi?.querySelector(":scope > a.rpLink");
          if (flyoutEl.contains(e.target)) return;
          if (link && link.contains(e.target)) return;
          closeFlyout();
        });
      }
    }
  }

  function safeInit() {
    try { init(); } catch (e) { console.warn("[WL RefineResponsive] init error", e); }
  }

  // load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", safeInit);
  } else {
    safeInit();
  }

  // re-render watcher (telerik ajax rebuilds)
  const mo = new MutationObserver(() => {
    clearTimeout(window.__WL_REFINE_REINIT__);
    window.__WL_REFINE_REINIT__ = setTimeout(safeInit, 180);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // responsive re-init on resize/orientation
  let lastModeInline = isInlineMode();
  window.addEventListener("resize", () => {
    const nowInline = isInlineMode();
    if (nowInline !== lastModeInline) {
      lastModeInline = nowInline;
      safeInit();
    }
  });
})();