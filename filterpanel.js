/* wl-refine-flyout.js (responsive, FIXED)
   Desktop: right-side flyout (clone is OK because we wire changes back to originals)
   Mobile: inline accordion with scrollable option area (MUST NOT CLONE; keep original inputs)
*/

(function () {
  "use strict";

  const CFG = {
    allowPages: new Set(["products.aspx"]),
    hideSections: ["keywords"],
    dedupeOptions: true,

    responsive: {
      inlineMaxWidth: 860,          // <= uses inline mode
      inlineOptionsMaxHeight: 320,  // inline options scroll box height
    },

    flyout: {
      width: 420,
      maxHeightVh: 72,
      offsetPx: 12,
      closeOnOutsideClick: true,
      closeOnEsc: true,
    },

    defaultOpenInline: ["brand"],
  };

  // Used to prevent touch pointerdown + click double-toggle
  let lastTouchPointerDownAt = 0;


  const normSpace = (s) =>
    String(s || "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const pageFile = () => (location.pathname.split("/").pop() || "").toLowerCase();

  function isInlineMode() {
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

.wl-refine-active > a.rpLink{
  border-color:rgba(0,0,0,.25) !important;
  box-shadow:0 2px 12px rgba(0,0,0,.10) !important;
}

/* Inline mode section content */
.wl-inline .rpSlide{
  margin: 0 8px 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid rgba(0,0,0,.10);
  box-shadow: 0 8px 22px rgba(0,0,0,.06);
}

/* Inline mode options scroll box */
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

/* Safety: force flyout hidden on small screens */
@media (max-width: 860px){
  .wl-refine-flyout{ display:none !important; }
}
    

/* Mobile full-screen drawer (inline mode) */
.wl-refine-drawer{
  position:fixed;
  inset:0;
  z-index:100000;
  background:#fff;
  display:none;
  flex-direction:column;
}
.wl-refine-drawer.is-open{ display:flex; }
.wl-refine-drawer-header{
  display:flex; align-items:center; justify-content:space-between;
  padding:14px 14px;
  border-bottom:1px solid rgba(0,0,0,.10);
  position:sticky; top:0; background:#fff;
}
.wl-refine-drawer-title{ font-weight:800; font-size:16px; }
.wl-refine-drawer-close{
  border:1px solid rgba(0,0,0,.16);
  background:#fff;
  border-radius:12px;
  padding:8px 10px;
  font-weight:700;
}
.wl-refine-drawer-body{
  padding:12px 12px 18px;
  overflow:auto;
  -webkit-overflow-scrolling:touch;
}
@media (max-width: 860px){
  /* when drawer is open, prevent background scroll via body class */
  body.wl-refine-lock{ overflow:hidden !important; }
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
  // Inline (mobile) accordion
  // -----------------------------
  function setSlideOpen(li, open) {
    const slide = li.querySelector(":scope > .rpSlide");
    if (!slide) return;
    slide.style.display = open ? "block" : "none";
    li.classList.toggle("wl-refine-active", !!open);
  }

  // FIXED: wrap the ORIGINAL rpTemplate (do NOT clone) so checkboxes still work
  function makeInlineScrollable(li) {
    const slide = li.querySelector(":scope > .rpSlide");
    if (!slide) return;

    const templ = slide.querySelector(".rpTemplate");
    if (!templ) return;

    // already wrapped?
    if (templ.closest(".wl-inline-options-scroll")) return;

    const wrap = document.createElement("div");
    wrap.className = "wl-inline-options-scroll";
    wrap.style.maxHeight = CFG.responsive.inlineOptionsMaxHeight + "px";

    // Replace template with wrapper, then move template inside wrapper
    const parent = templ.parentNode;
    parent.replaceChild(wrap, templ);
    wrap.appendChild(templ);
  }

  function bindInlineAccordion(sectionLis) {
    sectionLis.forEach((li) => {
      const link = li.querySelector(":scope > a.rpLink");
      const slide = li.querySelector(":scope > .rpSlide");
      if (!link || !slide) return;

      if (link.__WL_INLINE_BOUND__) return;
      link.__WL_INLINE_BOUND__ = true;

      const handler = (e) => {
        // On touch, pointerdown is used; ignore the synthetic click that follows.
        if (e && e.type === "click" && Date.now() - lastTouchPointerDownAt < 700) return;
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

        const isOpen = slide.style.display !== "none";

        // close others
        sectionLis.forEach((other) => setSlideOpen(other, false));

        // toggle this
        setSlideOpen(li, !isOpen);

        if (isOpen) {
          // We just closed the active section; also close the mobile drawer if it's open.
          closeDrawer(true);
        }

        if (!isOpen) {
          makeInlineScrollable(li);

          // Mobile: open options in a full-screen drawer for easier selection
          if (isInlineMode()) {
            openDrawerForSection(li);
          }
        }
      };

      // IMPORTANT: avoid double-fire on mouse (pointerdown + click)
      link.addEventListener("click", handler, true);
      link.addEventListener(
        "pointerdown",
        (e) => {
          // Touch/pen can feel laggy on click; use pointerdown for those only.
          if (e && e.pointerType && e.pointerType !== "mouse") {
            lastTouchPointerDownAt = Date.now();
            handler(e);
          }
        },
        true
      );
    });
  }

  
  // -----------------------------
  // Mobile full-screen drawer (inline mode)
  // -----------------------------
  let drawerEl = null;
  let drawerBodyEl = null;
  let drawerTitleEl = null;
  let drawerCloseBtn = null;

  // Track where to restore the slide content after moving into the drawer
  let drawerRestore = null;

  function ensureDrawer() {
    if (drawerEl) return;
    drawerEl = document.createElement("div");
    drawerEl.className = "wl-refine-drawer";
    drawerEl.setAttribute("role", "dialog");
    drawerEl.setAttribute("aria-modal", "true");

    const header = document.createElement("div");
    header.className = "wl-refine-drawer-header";

    drawerTitleEl = document.createElement("div");
    drawerTitleEl.className = "wl-refine-drawer-title";
    drawerTitleEl.textContent = "Refine";

    drawerCloseBtn = document.createElement("button");
    drawerCloseBtn.type = "button";
    drawerCloseBtn.className = "wl-refine-drawer-close";
    drawerCloseBtn.textContent = "Close";

    header.appendChild(drawerTitleEl);
    header.appendChild(drawerCloseBtn);

    drawerBodyEl = document.createElement("div");
    drawerBodyEl.className = "wl-refine-drawer-body";

    drawerEl.appendChild(header);
    drawerEl.appendChild(drawerBodyEl);
    document.body.appendChild(drawerEl);

    drawerCloseBtn.addEventListener("click", closeDrawer, true);
    drawerEl.addEventListener(
      "click",
      (e) => {
        // Clicking the backdrop (outside body) closes
        if (e.target === drawerEl) closeDrawer();
      },
      true
    );

    document.addEventListener(
      "keydown",
      (e) => {
        if (!drawerEl.classList.contains("is-open")) return;
        if (e.key === "Escape") closeDrawer();
      },
      true
    );
  }

  function openDrawerForSection(sectionLi) {
    ensureDrawer();

    const title = getSectionHeaderText(sectionLi) || "Refine";
    drawerTitleEl.textContent = title;

    const slide = sectionLi.querySelector(":scope > .rpSlide");
    if (!slide) return;

    // If already open for something else, restore first
    if (drawerRestore) closeDrawer(true);

    // Make sure the slide is visible for measurement / content
    slide.style.display = "block";

    // Prepare restore info
    const placeholder = document.createComment("wl-refine-drawer-placeholder");
    slide.parentNode.insertBefore(placeholder, slide);
    drawerRestore = { slide, placeholder, originalDisplay: slide.style.display };

    // Move the ORIGINAL slide (no cloning) into the drawer body
    drawerBodyEl.innerHTML = "";
    drawerBodyEl.appendChild(slide);

    drawerEl.classList.add("is-open");
    document.body.classList.add("wl-refine-lock");
  }

  function closeDrawer(silent) {
    if (!drawerEl || !drawerEl.classList.contains("is-open")) {
      // Still restore if needed
      if (drawerRestore) {
        const { slide, placeholder, originalDisplay } = drawerRestore;
        placeholder.parentNode.insertBefore(slide, placeholder);
        placeholder.remove();
        slide.style.display = originalDisplay || "";
        drawerRestore = null;
      }
      return;
    }

    // Restore content
    if (drawerRestore) {
      const { slide, placeholder, originalDisplay } = drawerRestore;
      placeholder.parentNode.insertBefore(slide, placeholder);
      placeholder.remove();
      slide.style.display = originalDisplay || "";
      drawerRestore = null;
    }

    drawerEl.classList.remove("is-open");
    document.body.classList.remove("wl-refine-lock");

    if (!silent) {
      // noop: reserved for future focus restore
    }
  }


  // -----------------------------
  // Flyout (desktop)
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
    const top = Math.round(headerRect.top + window.scrollY);

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
    if (isInlineMode()) return;

    const fly = ensureFlyout();
    const body = fly.querySelector(".wl-refine-flyout-body");
    const title = fly.querySelector(".wl-refine-flyout-title");

    const headerText = getSectionHeaderText(sectionLi) || "Filter";

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
        // On touch, pointerdown is used; ignore the synthetic click that follows.
        if (e && e.type === "click" && Date.now() - lastTouchPointerDownAt < 700) return;
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

        if (activeSectionLi === li && flyoutEl && flyoutEl.style.display !== "none") {
          closeFlyout();
          return;
        }
        openFlyoutForSection(panelBar, li);
      };

      // IMPORTANT: avoid double-fire on mouse (pointerdown + click)
      link.addEventListener("click", handler, true);
      link.addEventListener(
        "pointerdown",
        (e) => {
          // Touch/pen can feel laggy on click; use pointerdown for those only.
          if (e && e.pointerType && e.pointerType !== "mouse") {
            lastTouchPointerDownAt = Date.now();
            handler(e);
          }
        },
        true
      );
    });
  }

  // -----------------------------
  // Init / re-init
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

    panelBar.classList.toggle("wl-inline", isInlineMode());

    const sectionLis = Array.from(rootGroup.querySelectorAll(":scope > li.rpItem"));

    sectionLis.forEach((li) => {
      const headerLower = getSectionHeaderText(li).toLowerCase();

      if (CFG.hideSections.includes(headerLower)) {
        hideSection(li);
        return;
      }

      if (CFG.dedupeOptions) {
        try { dedupeSectionOptions(li); } catch (_) {}
      }
    });

    if (isInlineMode()) {
      closeFlyout();

      // Start all collapsed
      sectionLis.forEach((li) => {
        const slide = li.querySelector(":scope > .rpSlide");
        if (slide) slide.style.display = "none";
        li.classList.remove("wl-refine-active");
      });

      bindInlineAccordion(sectionLis);

      // Default open one section
      const first =
        sectionLis.find((li) => {
          const t = getSectionHeaderText(li).toLowerCase();
          return CFG.defaultOpenInline.some((x) => t.includes(String(x).toLowerCase()));
        }) ||
        sectionLis.find((li) => li.style.display !== "none");

      if (first) {
        setSlideOpen(first, true);
        makeInlineScrollable(first);
      }
    } else {
      // Desktop: hide slides so left panel stays compact
      sectionLis.forEach((li) => {
        const slide = li.querySelector(":scope > .rpSlide");
        if (slide) slide.style.display = "none";
      });

      bindFlyoutHeaders(panelBar, sectionLis);

      // One-time close handlers
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", safeInit);
  } else {
    safeInit();
  }

  const mo = new MutationObserver(() => {
    clearTimeout(window.__WL_REFINE_REINIT__);
    window.__WL_REFINE_REINIT__ = setTimeout(safeInit, 180);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // Switch modes on resize/orientation change
  let lastInline = isInlineMode();
  window.addEventListener("resize", () => {
    const nowInline = isInlineMode();
    if (nowInline !== lastInline) {
      lastInline = nowInline;
      safeInit();
    }
  });
})();
