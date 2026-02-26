/* wl-refine-flyout.js
   - Accordion behavior: only one section "active" at a time
   - Flyout panel opens to the RIGHT of the refine panel (keeps left panel compact)
   - Fixes Telerik "open then close" by using stopImmediatePropagation + capture handlers
   - Optional: hide Keywords group
   - Optional: de-dupe option labels (10', 10 feet, 10 foot -> 10 ft) UI-only
*/

(function () {
  "use strict";

  const CFG = {
    allowPages: new Set(["products.aspx"]),
    hideSections: ["keywords"], // hide whole section(s)
    defaultOpen: ["brand"],     // open first time if flyout enabled
    dedupeOptions: true,
    flyout: {
      enabled: true,
      width: 420,
      maxHeightVh: 72,     // flyout scroll height (vh)
      offsetPx: 12,        // gap from left panel
      closeOnOutsideClick: true,
      closeOnEsc: true,
    },
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
    if (document.getElementById("wl-refine-flyout-css")) return;

    const css = `
/* --- Modernize the refine panel --- */
.RadPanelBar[id*="RefineSearchRadPanelBar"] {
  font-family: inherit;
}

.RadPanelBar[id*="RefineSearchRadPanelBar"] .rpRootGroup,
.RadPanelBar[id*="RefineSearchRadPanelBar"] .rpGroup {
  padding: 0 !important;
}

.RadPanelBar[id*="RefineSearchRadPanelBar"] a.rpLink {
  border-radius: 10px;
  margin: 6px 8px;
  padding: 10px 12px !important;
  background: #fff;
  border: 1px solid rgba(0,0,0,.10);
  box-shadow: 0 1px 2px rgba(0,0,0,.05);
  transition: transform .08s ease, box-shadow .08s ease, border-color .08s ease;
}

.RadPanelBar[id*="RefineSearchRadPanelBar"] a.rpLink:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 10px rgba(0,0,0,.08);
  border-color: rgba(0,0,0,.18);
}

.RadPanelBar[id*="RefineSearchRadPanelBar"] a.rpLink .rpText {
  font-weight: 600;
}

/* Visually indicate active section */
.wl-refine-active > a.rpLink {
  border-color: rgba(0,0,0,.25) !important;
  box-shadow: 0 2px 12px rgba(0,0,0,.10) !important;
}

/* Hide Telerik slide area since we’ll use flyout for options */
.wl-refine-hide-slide > .rpSlide {
  display: none !important;
}

/* Flyout shell */
.wl-refine-flyout {
  position: absolute;
  z-index: 99999;
  background: #fff;
  border: 1px solid rgba(0,0,0,.12);
  box-shadow: 0 14px 50px rgba(0,0,0,.18);
  border-radius: 14px;
  overflow: hidden;
}

.wl-refine-flyout-header {
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(0,0,0,.08);
  background: linear-gradient(to bottom, #fff, rgba(0,0,0,.02));
}

.wl-refine-flyout-title {
  font-weight: 700;
  font-size: 14px;
}

.wl-refine-flyout-close {
  border: 1px solid rgba(0,0,0,.18);
  background: #fff;
  border-radius: 10px;
  padding: 6px 10px;
  cursor: pointer;
}

.wl-refine-flyout-body {
  padding: 10px 14px;
  overflow: auto;
}

.wl-refine-flyout-body table {
  width: 100%;
  border-collapse: collapse;
}

.wl-refine-flyout-body td {
  padding: 6px 0;
}

.wl-refine-flyout-body label {
  cursor: pointer;
}

/* Slightly bigger checkbox click targets */
.wl-refine-flyout-body input[type="checkbox"] {
  transform: scale(1.05);
  margin-right: 10px;
}
    `.trim();

    const style = document.createElement("style");
    style.id = "wl-refine-flyout-css";
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

  // UI-only dedupe (hide duplicates, optionally rewrite kept label to canonical)
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
        // rewrite label to more consistent display (optional)
        if (canon !== original.toLowerCase()) labelEl.textContent = " " + canon;
      } else {
        sp.style.display = "none";
      }
    });
  }

  // -----------------------------
  // Flyout
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

  function positionFlyoutNear(sectionLi) {
    const panelBar = findPanelBar();
    if (!panelBar) return;

    const rect = panelBar.getBoundingClientRect();

    const left = Math.round(rect.right + CFG.flyout.offsetPx + window.scrollX);
    // top aligned roughly with the clicked section header
    const headerRect = sectionLi.querySelector(":scope > a.rpLink").getBoundingClientRect();
    let top = Math.round(headerRect.top + window.scrollY);

    // keep flyout within viewport vertically
    const fly = ensureFlyout();
    const flyRect = fly.getBoundingClientRect();
    const maxTop = window.scrollY + window.innerHeight - flyRect.height - 12;
    if (top > maxTop) top = Math.max(window.scrollY + 12, maxTop);

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

  function openFlyoutForSection(sectionLi) {
    const headerText = getSectionHeaderText(sectionLi) || "Filter";
    const fly = ensureFlyout();

    // Mark active
    if (activeSectionLi && activeSectionLi !== sectionLi) {
      activeSectionLi.classList.remove("wl-refine-active");
    }
    activeSectionLi = sectionLi;
    sectionLi.classList.add("wl-refine-active");

    // Fill content: clone ONLY the template table and wire inputs back to originals
    const body = fly.querySelector(".wl-refine-flyout-body");
    body.innerHTML = "";

    const origTable = sectionLi.querySelector(".rpTemplate table");
    if (!origTable) {
      body.textContent = "No options found.";
    } else {
      const cloned = origTable.cloneNode(true);

      // Wire checkbox changes back to original inputs (by id)
      const clonedInputs = cloned.querySelectorAll('input[type="checkbox"]');
      clonedInputs.forEach((ci) => {
        const origId = ci.getAttribute("id");
        if (!origId) return;

        const origInput = document.getElementById(origId);
        if (!origInput) return;

        // sync initial state
        ci.checked = origInput.checked;

        // when user changes clone, change the original + trigger click so the site applies filter
        ci.addEventListener("change", () => {
          if (origInput.checked !== ci.checked) {
            // clicking original is safest for Telerik / postback logic
            origInput.click();
          }
        });

        // also if original changes (AJAX rerender), try to keep clone synced
        // (best-effort; rerenders will also be handled by our MutationObserver re-init)
      });

      body.appendChild(cloned);
    }

    // Set title + show
    fly.querySelector(".wl-refine-flyout-title").textContent = headerText;
    fly.style.display = "block";
    positionFlyoutNear(sectionLi);
  }

  // -----------------------------
  // Accordion / event handling
  // -----------------------------
  function makeHeaderOpenFlyout(li) {
    const link = li.querySelector(":scope > a.rpLink");
    if (!link) return;

    // prevent double binding
    if (link.__WL_BOUND__) return;
    link.__WL_BOUND__ = true;

    // IMPORTANT: Telerik will also bind click. We must beat it:
    // - use CAPTURE phase
    // - stopImmediatePropagation
    // - preventDefault
    const handler = (e) => {
      // Only handle real user clicks
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

      // Toggle logic: clicking the active section closes the flyout
      if (activeSectionLi === li && flyoutEl && flyoutEl.style.display !== "none") {
        closeFlyout();
        return;
      }

      // Open new section in flyout
      openFlyoutForSection(li);
    };

    // capture-phase click
    link.addEventListener("click", handler, true);
    // Some builds fire mousedown/pointerdown handlers; intercept those too
    link.addEventListener("pointerdown", handler, true);
  }

  function setOnlyOneActive(rootGroup, activeLi) {
    const items = rootGroup.querySelectorAll(":scope > li.rpItem");
    items.forEach((li) => {
      if (li === activeLi) li.classList.add("wl-refine-active");
      else li.classList.remove("wl-refine-active");
    });
  }

  // -----------------------------
  // Init / Re-init (AJAX safe)
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

    // Hide the built-in slide growth (we are using flyout)
    if (CFG.flyout.enabled) {
      // Hide only child slides (sections). Keep root slide visible.
      const sectionLis = rootGroup.querySelectorAll(":scope > li.rpItem");
      sectionLis.forEach((li) => li.classList.add("wl-refine-hide-slide"));
    }

    const sectionLis = rootGroup.querySelectorAll(":scope > li.rpItem");
    sectionLis.forEach((li) => {
      const header = getSectionHeaderText(li).toLowerCase();

      // Hide certain sections entirely
      if (CFG.hideSections.includes(header)) {
        hideSection(li);
        return;
      }

      // Dedupe inside the ORIGINAL table so clones inherit it
      if (CFG.dedupeOptions) {
        try { dedupeSectionOptions(li); } catch (_) {}
      }

      // Make header open flyout (and prevent Telerik toggling)
      if (CFG.flyout.enabled) {
        makeHeaderOpenFlyout(li);
      }
    });

    // Default open (optional)
    if (CFG.flyout.enabled && !activeSectionLi) {
      const first = Array.from(sectionLis).find((li) => {
        const t = getSectionHeaderText(li).toLowerCase();
        return CFG.defaultOpen.some((x) => t.includes(String(x).toLowerCase()));
      }) || Array.from(sectionLis).find((li) => li.style.display !== "none");

      if (first) openFlyoutForSection(first);
    }

    // Close controls
    if (CFG.flyout.closeOnEsc && !window.__WL_REFINE_ESC__) {
      window.__WL_REFINE_ESC__ = true;
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeFlyout();
      });
    }

    if (CFG.flyout.closeOnOutsideClick && !window.__WL_REFINE_OUTSIDE__) {
      window.__WL_REFINE_OUTSIDE__ = true;
      document.addEventListener("mousedown", (e) => {
        if (!flyoutEl || flyoutEl.style.display === "none") return;
        const link = activeSectionLi?.querySelector(":scope > a.rpLink");
        if (flyoutEl.contains(e.target)) return;
        if (link && link.contains(e.target)) return;
        closeFlyout();
      });
    }
  }

  function safeInit() {
    try { init(); } catch (e) { console.warn("[WL RefineFlyout] init error", e); }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", safeInit);
  } else {
    safeInit();
  }

  // Re-render watcher (Telerik often rebuilds HTML after you click filters)
  const mo = new MutationObserver(() => {
    clearTimeout(window.__WL_REFINE_REINIT__);
    window.__WL_REFINE_REINIT__ = setTimeout(() => {
      // If the active section got re-rendered, keep flyout open by trying to re-open by header text
      const activeTitle = activeSectionLi ? getSectionHeaderText(activeSectionLi) : null;
      safeInit();
      if (activeTitle) {
        const panelBar = findPanelBar();
        const refineRoot = panelBar ? findRefineRoot(panelBar) : null;
        const rootGroup =
          refineRoot?.querySelector(":scope > .rpSlide > ul.rpGroup") ||
          refineRoot?.querySelector(":scope > .rpSlide");
        if (rootGroup) {
          const match = Array.from(rootGroup.querySelectorAll(":scope > li.rpItem")).find(
            (li) => normSpace(getSectionHeaderText(li)).toLowerCase() === normSpace(activeTitle).toLowerCase()
          );
          if (match && match.style.display !== "none") openFlyoutForSection(match);
        }
      }
    }, 180);
  });

  mo.observe(document.documentElement, { childList: true, subtree: true });
})();