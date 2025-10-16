/* Woodson – 3-up Squares (desktop) / Tabs (mobile)
 * - Desktop: 3 square cards with per-item links
 * - Mobile: tabbed single panel with auto-rotate (5s)
 * - Supports image or video per item (type: "image" | "video")
 * - Safe to load via <script src> (runs after DOMContentLoaded)
 */

(function () {
  "use strict";

  /* =========================
   * EDIT ONLY THIS SECTION
   * ========================= */
  const ITEMS = [
    {
      title: "Feeders",
      type: "image",                           // "image" or "video"
      src:  "https://images-woodsonlumber.sirv.com/Other%20Website%20Images/Labor%20Day%20Feeders.jpg",
      alt:  "Shop Feeders",
      href: "https://webtrack.woodsonlumber.com/Products.aspx?pl1=2357&pg=2722"
    },
    {
      title: "Hunting Blinds",
      type: "image",
      src:  "https://images-woodsonlumber.sirv.com/Other%20Website%20Images/Labor%20Day%20Blinds.jpg",
      alt:  "Browse Blinds",
      href: "https://webtrack.woodsonlumber.com/Products.aspx?pl1=2357&pg=2720"
    },
    {
      title: "Game Cameras",
      type: "image",
      src:  "https://images-woodsonlumber.sirv.com/Other%20Website%20Images/Labor%20Day%20Game%20Cameras.jpg",
      alt:  "Shop Cameras",
      href: "https://webtrack.woodsonlumber.com/Products.aspx?pl1=2357&pg=2736"
    }
    // You can add more; desktop shows first 3, mobile tabs show all.
  ];

  const AUTOROTATE_MS = 5000;  // mobile tab auto-rotate
  /* ======= end editable ======= */

  function $(sel, root = document) { return root.querySelector(sel); }
  function el(tag, props = {}) {
    const e = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k in e) e[k] = v;
      else e.setAttribute(k, v);
    });
    return e;
  }

  function renderDesktop(root) {
    const grid = $("#wl-shelf-grid", root);
    if (!grid) return;
    grid.innerHTML = "";

    // show first 3 (classic three-up). If you want more rows, loop all ITEMS.
    ITEMS.slice(0, 3).forEach((item) => {
      const card = el("div", { class: "wl-card" });
      const link = el("a", { href: item.href || "#", target: "_top", "aria-label": item.title || "" });

      if (item.type === "video") {
        const v = el("video", {
          autoplay: true, muted: true, loop: true, playsInline: true, preload: "metadata"
        });
        const src = el("source", { src: item.src, type: "video/mp4" });
        v.appendChild(src);
        card.appendChild(v);
      } else {
        const img = el("img", { src: item.src, alt: item.alt || item.title || "", loading: "lazy" });
        card.appendChild(img);
      }

      card.appendChild(link);
      grid.appendChild(card);
    });
  }

  function renderMobile(root) {
    const tablist = $("#wl-tablist", root);
    const panel = $("#wl-tabpanel", root);
    const panelLink = $("#wl-tablink", root);
    const existingImg = $("#wl-tabimg", root);

    if (!tablist || !panel || !panelLink) return;
    tablist.innerHTML = "";

    // Replace the single <img> with a container that can swap <img>/<video>
    let mediaMount = existingImg?.parentElement || panel;
    if (existingImg) existingImg.remove();
    let activeIndex = 0;
    let intervalId;

    function setMedia(item) {
      // remove existing media
      const oldMedia = mediaMount.querySelector("img, video");
      if (oldMedia) oldMedia.remove();

      if (item.type === "video") {
        const v = el("video", {
          autoplay: true, muted: true, loop: true, playsInline: true, preload: "metadata"
        });
        const src = el("source", { src: item.src, type: "video/mp4" });
        v.appendChild(src);
        mediaMount.appendChild(v);
      } else {
        const img = el("img", { src: item.src, alt: item.alt || item.title || "", loading: "lazy" });
        mediaMount.appendChild(img);
      }
    }

    function setActive(i, userClick = false) {
      activeIndex = i;

      [...tablist.querySelectorAll('[role="tab"]')].forEach((btn, idx) => {
        btn.setAttribute("aria-selected", idx === activeIndex ? "true" : "false");
        btn.setAttribute("tabindex", idx === activeIndex ? "0" : "-1");
      });

      const item = ITEMS[activeIndex];
      panelLink.href = item.href || "#";
      panelLink.setAttribute("aria-label", item.title || "");
      setMedia(item);

      if (userClick) {
        clearInterval(intervalId);
        startAutoRotate();
      }
    }

    ITEMS.forEach((item, i) => {
      const btn = el("button", {
        type: "button", role: "tab", id: `wl-tab-${i}`, text: item.title || `Tab ${i + 1}`
      });
      btn.setAttribute("aria-controls", "wl-tabpanel");
      btn.setAttribute("aria-selected", i === 0 ? "true" : "false");
      btn.setAttribute("tabindex", i === 0 ? "0" : "-1");
      btn.addEventListener("click", () => setActive(i, true));
      tablist.appendChild(btn);
    });

    setActive(0);

    function startAutoRotate() {
      intervalId = setInterval(() => setActive((activeIndex + 1) % ITEMS.length), AUTOROTATE_MS);
    }
    startAutoRotate();

    // Keyboard support
    tablist.addEventListener("keydown", (e) => {
      const tabs = [...tablist.querySelectorAll('[role="tab"]')];
      let idx = tabs.findIndex(t => t.getAttribute("aria-selected") === "true");
      if (e.key === "ArrowRight") { idx = (idx + 1) % tabs.length; tabs[idx].click(); tabs[idx].focus(); }
      if (e.key === "ArrowLeft")  { idx = (idx - 1 + tabs.length) % tabs.length; tabs[idx].click(); tabs[idx].focus(); }
    });
  }

  function ensureMarkup() {
    let root = document.getElementById("wl-shelf");
    if (!root) {
      // If user only added the loader tags, create the mount automatically
      root = el("div", { id: "wl-shelf" });
      document.body.appendChild(root);
    }
    if (!$("#wl-shelf-grid", root)) root.appendChild(el("div", { class: "wl-shelf-grid", id: "wl-shelf-grid" }));
    if (!$("#wl-tabs", root)) {
      const tabsWrap = el("div", { class: "wl-tabs", id: "wl-tabs" });
      const tablist = el("div", { role: "tablist", "aria-label": "Promo categories", class: "wl-tablist", id: "wl-tablist" });
      const panel = el("div", { id: "wl-tabpanel", class: "wl-tabpanel", role: "tabpanel", tabindex: "0", "aria-live": "polite" });
      const link = el("a", { id: "wl-tablink", href: "#", target: "_top", "aria-label": "" });
      // a default img placeholder (will be replaced by setMedia)
      const img = el("img", { id: "wl-tabimg", alt: "", src: "", loading: "lazy" });
      panel.appendChild(link);
      panel.appendChild(img);
      tabsWrap.appendChild(tablist);
      tabsWrap.appendChild(panel);
      root.appendChild(tabsWrap);
    }
    return root;
  }

  function init() {
    const root = ensureMarkup();
    renderDesktop(root);
    renderMobile(root);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
