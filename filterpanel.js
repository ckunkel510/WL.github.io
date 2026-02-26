/* wl-refine-panel.js
   - Collapses "REFINE BY" refinements into click-to-open sections
   - Hides "Keywords" refinement group entirely
   - De-dupes obvious duplicate option values inside each refinement (ex: 10', 10 feet, 10 foot)
     NOTE: This is UI de-dup only (keeps the first option, hides the rest) to avoid changing filter logic.
*/

(function () {
  "use strict";

  // -----------------------------
  // Config
  // -----------------------------
  const CFG = {
    // Pages where this should run
    allowPages: new Set(["products.aspx"]),

    // Which refinement sections should start open (case-insensitive match on header text)
    defaultOpen: ["brand"],

    // Hide these refinement section headers entirely (case-insensitive)
    hideSections: ["keywords"],

    // Insert "Expand all / Collapse all" controls at top of REFINE BY
    addControls: true,

    // De-dupe option rows within each section
    dedupeOptions: true,
  };

  // -----------------------------
  // Helpers
  // -----------------------------
  const log = (...args) => console.log("[WL RefinePanel]", ...args);

  function getPageFile() {
    return (location.pathname.split("/").pop() || "").toLowerCase();
  }

  function textEq(a, b) {
    return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
  }

  function normSpace(s) {
    return String(s || "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Canonicalize “same meaning” strings so we can dedupe:
  // 10' / 10 feet / 10 foot -> "10 ft"
  // 12 inches / 12 inch -> "12 in"
  // also normalizes weird quotes/primes.
  function canonicalizeValue(labelText) {
    let s = normSpace(labelText)
      .toLowerCase()
      // normalize primes/quotes people paste in from different sources
      .replace(/[′’‛`]/g, "'")
      .replace(/[″“”]/g, '"');

    // common unit words -> abbreviations
    s = s
      .replace(/\b(feet|foot)\b/g, "ft")
      .replace(/\b(inches|inch)\b/g, "in");

    // numeric foot patterns:
    // "10 '"  or "10'"  -> "10 ft"
    s = s.replace(/\b(\d+(?:\.\d+)?)\s*'\b/g, "$1 ft");
    // "10 ft." -> "10 ft"
    s = s.replace(/\bft\.\b/g, "ft");
    // "10 in." -> "10 in"
    s = s.replace(/\bin\.\b/g, "in");

    // collapse spaces again
    s = normSpace(s);

    return s;
  }

  // Try to find the REFINE BY root <li> inside the RadPanelBar
  function findRefineByRoot(panelBarEl) {
    const links = panelBarEl.querySelectorAll("a.rpLink");
    for (const a of links) {
      const t = normSpace(a.textContent);
      if (t && t.toLowerCase() === "refine by") {
        return a.closest("li.rpItem");
      }
    }
    return null;
  }

  function setExpanded(li, expanded) {
    const link = li.querySelector(":scope > a.rpLink");
    const slide = li.querySelector(":scope > .rpSlide");
    if (!link || !slide) return;

    li.classList.toggle("rpExpanded", !!expanded);

    // Telerik uses inline display styles; we override consistently.
    slide.style.display = expanded ? "block" : "none";

    // Keep "expandable" behavior visually consistent
    link.classList.toggle("rpExpanded", !!expanded);
    link.classList.toggle("rpCollapsed", !expanded);
  }

  function attachToggle(li) {
    const link = li.querySelector(":scope > a.rpLink");
    const slide = li.querySelector(":scope > .rpSlide");
    if (!link || !slide) return;

    // Make the header behave like an accordion toggle
    link.addEventListener(
      "click",
      (e) => {
        // Prevent # navigation
        e.preventDefault();
        e.stopPropagation();

        const isOpen = slide.style.display !== "none";
        setExpanded(li, !isOpen);
      },
      true
    );
  }

  function getSectionHeaderText(sectionLi) {
    const headerA = sectionLi.querySelector(":scope > a.rpLink .rpText");
    return normSpace(headerA ? headerA.textContent : "");
  }

  function hideSection(sectionLi) {
    sectionLi.style.display = "none";
  }

  // De-dupe options inside a section:
  // The options are typically spans with refinequery + input + label.
  function dedupeSectionOptions(sectionLi) {
    const table = sectionLi.querySelector(".rpTemplate table");
    if (!table) return;

    const spans = table.querySelectorAll("span[refinequery]");
    if (!spans || spans.length < 2) return;

    const seen = new Map(); // canonical -> { span, labelEl }
    let hiddenCount = 0;

    spans.forEach((sp) => {
      const labelEl = sp.querySelector("label");
      if (!labelEl) return;

      const original = normSpace(labelEl.textContent);
      const canon = canonicalizeValue(original);

      if (!canon) return;

      if (!seen.has(canon)) {
        // Keep first occurrence. Optionally rewrite label to canonical if it changes.
        seen.set(canon, { span: sp, labelEl });

        // If canonical differs (ex: "10 feet" -> "10 ft"), update the label text for cleanliness.
        if (canon !== original.toLowerCase()) {
          // Preserve leading space that Telerik labels often have
          labelEl.textContent = " " + canon;
        }
      } else {
        // Hide duplicates (UI-only). Do NOT auto-check multiple, because that would AND filters.
        const { span: keepSpan } = seen.get(canon);

        // If the kept one is currently hidden for some reason, swap (rare)
        if (keepSpan.style.display === "none") {
          seen.set(canon, { span: sp, labelEl });
          sp.style.display = "";
          keepSpan.style.display = "none";
          hiddenCount++;
          return;
        }

        sp.style.display = "none";
        hiddenCount++;
      }
    });

    if (hiddenCount) {
      sectionLi.setAttribute("data-wl-deduped", String(hiddenCount));
    }
  }

  function addExpandCollapseControls(refineRootLi) {
    const slide = refineRootLi.querySelector(":scope > .rpSlide");
    if (!slide) return;

    const container = slide.querySelector(":scope > ul.rpGroup") || slide;

    // Avoid double-injection
    if (container.querySelector(".wl-refine-controls")) return;

    const controls = document.createElement("div");
    controls.className = "wl-refine-controls";
    controls.style.cssText =
      "display:flex; gap:8px; align-items:center; padding:6px 6px 8px; border-bottom:1px solid rgba(0,0,0,.08);";

    const mkBtn = (txt) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = txt;
      b.style.cssText =
        "font:inherit; font-size:12px; padding:4px 8px; border:1px solid rgba(0,0,0,.25); background:#fff; cursor:pointer; border-radius:6px;";
      return b;
    };

    const btnExpand = mkBtn("Expand all");
    const btnCollapse = mkBtn("Collapse all");

    btnExpand.addEventListener("click", () => {
      const sections = container.querySelectorAll(":scope > li.rpItem");
      sections.forEach((li) => {
        const header = getSectionHeaderText(li).toLowerCase();
        if (CFG.hideSections.includes(header)) return;
        setExpanded(li, true);
      });
    });

    btnCollapse.addEventListener("click", () => {
      const sections = container.querySelectorAll(":scope > li.rpItem");
      sections.forEach((li) => {
        const header = getSectionHeaderText(li).toLowerCase();
        if (CFG.hideSections.includes(header)) return;
        setExpanded(li, false);
      });
    });

    controls.appendChild(btnExpand);
    controls.appendChild(btnCollapse);

    // Insert at top of the refine list
    container.insertBefore(controls, container.firstChild);
  }

  // -----------------------------
  // Main
  // -----------------------------
  function init() {
    const page = getPageFile();
    if (!CFG.allowPages.has(page)) return;

    // Find the RadPanelBar used for refine nav
    const panelBar = document.querySelector('[id*="RefineSearchRadPanelBar"].RadPanelBar');
    if (!panelBar) return;

    const refineRoot = findRefineByRoot(panelBar);
    if (!refineRoot) return;

    // REFINE BY sections live under this root's slide/group
    const rootGroup =
      refineRoot.querySelector(":scope > .rpSlide > ul.rpGroup") ||
      refineRoot.querySelector(":scope > .rpSlide");

    if (!rootGroup) return;

    if (CFG.addControls) addExpandCollapseControls(refineRoot);

    const sectionLis = rootGroup.querySelectorAll(":scope > li.rpItem");
    sectionLis.forEach((li) => {
      const header = getSectionHeaderText(li);
      const headerLower = header.toLowerCase();

      // Hide whole section(s), especially Keywords (this is the huge one in your panel)
      // Your markup shows it as a section named "Keywords". :contentReference[oaicite:1]{index=1}
      if (CFG.hideSections.includes(headerLower)) {
        hideSection(li);
        return;
      }

      // Always make sections collapsible
      attachToggle(li);

      // Default open/closed behavior
      const shouldOpen = CFG.defaultOpen.some((x) => headerLower.includes(String(x).toLowerCase()));
      setExpanded(li, shouldOpen);

      // De-dupe internal checkbox rows by canonical label text
      if (CFG.dedupeOptions) {
        try {
          dedupeSectionOptions(li);
        } catch (e) {
          // Don't break the panel if one section is weird
          console.warn("[WL RefinePanel] dedupe failed for", header, e);
        }
      }
    });

    log("initialized");
  }

  // Run after load, and also after partial updates (RadControls sometimes re-render)
  function safeInit() {
    try {
      init();
    } catch (e) {
      console.warn("[WL RefinePanel] init error", e);
    }
  }

  // 1) normal load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", safeInit);
  } else {
    safeInit();
  }

  // 2) watch for re-renders
  const mo = new MutationObserver(() => {
    // debounce-ish: if the panel gets rebuilt, rerun
    window.clearTimeout(window.__WL_REFINE_REINIT__);
    window.__WL_REFINE_REINIT__ = window.setTimeout(safeInit, 150);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
