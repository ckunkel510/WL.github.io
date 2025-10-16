/* Woodson Hero Carousel
 * - Supports multiple slides (image or video)
 * - Desktop/Mobile sources per slide
 * - Per-slide click-through URL (overlay link)
 * - Auto-rotate with optional pause-on-hover
 * - Accessible tabs (pills), keyboard left/right nav
 * - Responsive: 1920x500 desktop, square on mobile
 *
 * HOW TO USE:
 * 1) Host this file and woodson-hero.css on GitHub Pages or Vercel.
 * 2) In Wix, paste the minimal HTML snippet (see readme / instructions) and link to these files.
 * 3) Edit the SLIDES array below to change media + destinations.
 */

(function () {
  "use strict";

  /*** CONFIG (edit as needed) ***/
  const DESKTOP_MIN = 1032;                 // screen px breakpoint for desktop asset
  const DEFAULT_IMAGE_DURATION = 5000;      // ms per image slide
  const DEFAULT_VIDEO_FALLBACK_DURATION = 12000; // ms per video if 'ended' not used
  const PAUSE_ON_HOVER = true;              // pause auto-rotation on hover (desktop)
  const START_INDEX = 0;                    // initial slide

  // Slides: add/remove objects. Each slide:
  // - type: "image" | "video"
  // - desktopSrc, mobileSrc: required
  // - href: click-through URL (overlay)
  // - label: for aria/tooltip/tab
  // - alt: img alt text (images)
  // - poster: video poster frame (optional)
  // - duration: ms override (optional)
  // - target: link target (default "_top")
  const SLIDES = [
    {
      type: "image",
      desktopSrc: "https://images-woodsonlumber.sirv.com/Other%20Website%20Images/FallCleanupHeader.jpg",
      mobileSrc:  "https://images-woodsonlumber.sirv.com/Other%20Website%20Images/FallCleanupHeaderMobile.jpg",
      poster:     "https://images-woodsonlumber.sirv.com/Other%20Website%20Images/FallCleanupHeader.jpg",
      href: "https://webtrack.woodsonlumber.com/Products.aspx?pl1=4677&pg=4643",
      label: "Fall Cleanup Days",
      duration: 6000
    },
    {
      type: "image",
      desktopSrc: "https://images-woodsonlumber.sirv.com/Other%20Website%20Images/ChristmasLightsHeader2.jpg",
      mobileSrc:  "https://images-woodsonlumber.sirv.com/Other%20Website%20Images/ChristmasLightsHeaderMobile.jpg",
      alt: "Christmas Lights Now In Stock",
      href: "https://webtrack.woodsonlumber.com/Products.aspx?pl1=4647&pg=4649",
      label: "Christmas Lights & Decor Now In Stock",
      duration: 6000
    }
  ];

  /*** DOM bootstrap (safe to call multiple times) ***/
  function ensureMarkup() {
    let root = document.getElementById("wl-hero");
    if (!root) {
      root = document.createElement("div");
      root.id = "wl-hero";
      document.body.appendChild(root);
    }
    let frame = root.querySelector(".wl-hero-frame");
    if (!frame) {
      frame = document.createElement("div");
      frame.className = "wl-hero-frame";
      frame.setAttribute("role", "region");
      frame.setAttribute("aria-label", "Featured promotions carousel");
      root.appendChild(frame);
    }
    let link = root.querySelector(".wl-hero-link");
    if (!link) {
      link = document.createElement("a");
      link.className = "wl-hero-link";
      link.id = "wl-hero-link";
      link.setAttribute("target", "_top");
      link.setAttribute("aria-label", "");
      frame.appendChild(link);
    }
    if (!root.querySelector(".wl-hero-tabbar-bg")) {
      const bg = document.createElement("div");
      bg.className = "wl-hero-tabbar-bg";
      frame.appendChild(bg);
    }
    let tabs = root.querySelector(".wl-hero-tabs");
    if (!tabs) {
      tabs = document.createElement("div");
      tabs.className = "wl-hero-tabs";
      tabs.id = "wl-hero-tabs";
      tabs.setAttribute("role", "tablist");
      tabs.setAttribute("aria-label", "Carousel slides");
      frame.appendChild(tabs);
    }
    return { root, frame, link, tabs };
  }

  /*** State ***/
  let current = START_INDEX % SLIDES.length;
  let autoTimer = null;
  let videoEl = null;
  let imgEl = null;
  let hovering = false;

  /*** Utils ***/
  const pickSrc = (slide) => {
    const deviceWidth = (window.screen && window.screen.width) ? window.screen.width : window.innerWidth || 1024;
    return (deviceWidth >= DESKTOP_MIN) ? slide.desktopSrc : slide.mobileSrc;
  };

  const clearMedia = () => {
    if (videoEl) {
      try { videoEl.pause(); } catch (e) {}
      videoEl.remove();
      videoEl = null;
    }
    if (imgEl) {
      imgEl.remove();
      imgEl = null;
    }
  };

  const scheduleNext = (ms) => {
    if (autoTimer) clearTimeout(autoTimer);
    if (hovering && PAUSE_ON_HOVER) return; // paused due to hover
    autoTimer = setTimeout(() => {
      const next = (current + 1) % SLIDES.length;
      show(next);
    }, Math.max(1000, ms || DEFAULT_IMAGE_DURATION));
  };

  /*** Tabs ***/
  const buildTabs = (tabsWrap) => {
    tabsWrap.innerHTML = "";
    SLIDES.forEach((s, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wl-hero-tab";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-label", s.label ? `Show: ${s.label}` : `Slide ${i + 1}`);
      b.addEventListener("click", () => show(i, true));
      tabsWrap.appendChild(b);
    });
  };

  const markActiveTab = (tabsWrap, idx) => {
    tabsWrap.querySelectorAll(".wl-hero-tab").forEach((btn, i) => {
      if (i === idx) btn.setAttribute("aria-current", "true");
      else btn.removeAttribute("aria-current");
    });
  };

  /*** Hover pause ***/
  const attachHoverPause = (frame) => {
    if (!PAUSE_ON_HOVER) return;
    frame.addEventListener("mouseenter", () => {
      hovering = true;
      if (autoTimer) clearTimeout(autoTimer);
      if (videoEl) try { videoEl.pause(); } catch (e) {}
    });
    frame.addEventListener("mouseleave", () => {
      hovering = false;
      if (videoEl) {
        const p = videoEl.play?.();
        if (p && typeof p.then === "function") p.catch(() => {});
      }
      scheduleNext(1500); // resume shortly
    });
  };

  /*** Render ***/
  function show(index, userTriggered = false) {
    const { frame, link, tabs } = ensureMarkup();
    current = index % SLIDES.length;
    const s = SLIDES[current];
    clearMedia();

    // Overlay link
    link.href = s.href || "#";
    link.target = s.target || "_top";
    link.setAttribute("aria-label", s.label || "Open promotion");

    // Media
    const src = pickSrc(s);

    if (s.type === "video") {
      videoEl = document.createElement("video");
      videoEl.className = "wl-hero-media";
      videoEl.setAttribute("playsinline", "");
      videoEl.setAttribute("muted", "");
      videoEl.setAttribute("loop", "");
      videoEl.setAttribute("autoplay", "");
      videoEl.setAttribute("preload", "metadata");
      videoEl.setAttribute("disablepictureinpicture", "");
      videoEl.setAttribute("disableremoteplayback", "");
      if (s.poster) videoEl.setAttribute("poster", s.poster);

      const source = document.createElement("source");
      source.src = src;
      source.type = "video/mp4";
      videoEl.appendChild(source);
      frame.appendChild(videoEl);

      // Try playing; swallow autoplay errors
      const playPromise = videoEl.play?.();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise.catch(() => {});
      }

      // Advance to next after duration (since we loop videos visually)
      scheduleNext(s.duration || DEFAULT_VIDEO_FALLBACK_DURATION);
    } else {
      imgEl = document.createElement("img");
      imgEl.className = "wl-hero-media";
      imgEl.decoding = "async";
      imgEl.loading = "eager";
      imgEl.alt = s.alt || (s.label || "Promotion");
      imgEl.src = src;
      frame.appendChild(imgEl);

      scheduleNext(s.duration || DEFAULT_IMAGE_DURATION);
    }

    // Tabs
    markActiveTab(tabs, current);

    // If user clicked a tab, give a full interval on that slide
    if (userTriggered) {
      scheduleNext(
        SLIDES[current].duration ||
        (SLIDES[current].type === "video" ? DEFAULT_VIDEO_FALLBACK_DURATION : DEFAULT_IMAGE_DURATION)
      );
    }
  }

  /*** Resize: re-render current slide for correct asset ***/
  let resizeTimer;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => show(current, true), 150);
  }

  /*** Init ***/
  document.addEventListener("DOMContentLoaded", () => {
    const { frame, tabs } = ensureMarkup();
    buildTabs(tabs);
    attachHoverPause(frame);
    show(current);

    // Keyboard nav
    frame.tabIndex = 0;
    frame.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        show((current + 1) % SLIDES.length, true);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        show((current - 1 + SLIDES.length) % SLIDES.length, true);
      }
    });

    // Listeners
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
  });
})();
