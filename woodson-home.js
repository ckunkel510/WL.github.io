<script>
/**
 * Woodson Shared Home Module
 * - Works in WebTrack Default.aspx and in Wix HTML embed
 * - Single JS file + JSON config (edit content without redesign)
 *
 * Usage:
 *   <script src="https://YOUR-CDN/woodson-home.js" data-config-url="https://YOUR-CDN/home-config.json"></script>
 *
 * Optional:
 *   <div id="wl-home-mount"></div>  // if not present, script will create one
 */
(function () {
  "use strict";

  // -------------------------
  // Settings / hooks
  // -------------------------
  var SCRIPT_EL = document.currentScript;
  var CONFIG_URL =
    (SCRIPT_EL && SCRIPT_EL.getAttribute("data-config-url")) ||
    window.WL_HOME_CONFIG_URL ||
    null;

  // Where to mount:
  // - If #wl-home-mount exists, use it.
  // - Else try to prepend to a likely main container.
  function resolveMount() {
    var existing = document.getElementById("wl-home-mount");
    if (existing) return existing;

    var mount = document.createElement("div");
    mount.id = "wl-home-mount";

    // Try common containers (WebTrack-ish + general fallbacks)
    var candidates = [
      document.querySelector("#MainLayoutRow"),
      document.querySelector("main"),
      document.querySelector(".container"),
      document.querySelector("form"),
      document.body
    ].filter(Boolean);

    (candidates[0] || document.body).insertBefore(mount, (candidates[0] || document.body).firstChild);
    return mount;
  }

  // -------------------------
  // CSS
  // -------------------------
  function injectCSS() {
    if (document.getElementById("wl-home-css")) return;

    var css = `
      :root{
        --wl-bg: #0b0b0c;
        --wl-card: #111114;
        --wl-card2: #141419;
        --wl-text: #f3f3f3;
        --wl-muted: rgba(243,243,243,.72);
        --wl-accent: #6b0016; /* Woodson deep red */
        --wl-accent2: #8d8d8d;
        --wl-radius: 18px;
        --wl-shadow: 0 10px 25px rgba(0,0,0,.25);
      }

      #wl-home {
        color: var(--wl-text);
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        padding: 14px 14px 24px;
      }

      /* Make it play nice if the host page has a light background */
      #wl-home .wl-shell{
        background: linear-gradient(180deg, rgba(0,0,0,.55), rgba(0,0,0,.15));
        border-radius: var(--wl-radius);
        padding: 14px;
      }

      #wl-home .wl-topbar{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:12px;
        margin-bottom: 12px;
      }

      #wl-home .wl-title{
        font-size: clamp(18px, 2.2vw, 28px);
        font-weight: 800;
        letter-spacing: .2px;
        margin: 0;
        line-height: 1.1;
      }
      #wl-home .wl-subtitle{
        margin: 6px 0 0;
        color: var(--wl-muted);
        font-size: 13px;
      }

      /* Hero */
      #wl-home .wl-hero{
        position: relative;
        border-radius: var(--wl-radius);
        overflow: hidden;
        box-shadow: var(--wl-shadow);
        background: #000;
      }
      #wl-home .wl-hero-media{
        width: 100%;
        aspect-ratio: 16/7;
        min-height: 220px;
        max-height: 520px;
        display:block;
        object-fit: cover;
        background:#000;
      }
      #wl-home .wl-hero-overlay{
        position:absolute;
        inset:0;
        display:flex;
        align-items:flex-end;
        padding: 18px;
        background: linear-gradient(180deg, rgba(0,0,0,.15) 25%, rgba(0,0,0,.75) 100%);
      }
      #wl-home .wl-hero-copy{
        max-width: 820px;
      }
      #wl-home .wl-hero-h{
        margin:0;
        font-size: clamp(18px, 2.4vw, 34px);
        font-weight: 900;
        line-height: 1.05;
      }
      #wl-home .wl-hero-p{
        margin:8px 0 0;
        color: rgba(255,255,255,.82);
        font-size: 14px;
        line-height: 1.35;
      }
      #wl-home .wl-hero-ctas{
        display:flex;
        flex-wrap:wrap;
        gap:10px;
        margin-top: 12px;
      }
      #wl-home .wl-btn{
        border: 0;
        cursor:pointer;
        border-radius: 999px;
        padding: 10px 14px;
        font-weight: 800;
        font-size: 13px;
        text-decoration:none;
        display:inline-flex;
        align-items:center;
        gap:8px;
        transition: transform .12s ease, opacity .12s ease;
        user-select:none;
      }
      #wl-home .wl-btn:active{ transform: scale(.98); }
      #wl-home .wl-btn-primary{
        background: var(--wl-accent);
        color: #fff;
      }
      #wl-home .wl-btn-ghost{
        background: rgba(255,255,255,.12);
        color:#fff;
        backdrop-filter: blur(6px);
      }
      #wl-home .wl-btn:hover{ opacity:.92; }

      /* Carousel dots */
      #wl-home .wl-dots{
        position:absolute;
        right: 14px;
        bottom: 14px;
        display:flex;
        gap:6px;
        z-index:2;
      }
      #wl-home .wl-dot{
        width: 9px; height: 9px;
        border-radius: 99px;
        background: rgba(255,255,255,.35);
        border: 1px solid rgba(255,255,255,.35);
        cursor:pointer;
      }
      #wl-home .wl-dot.is-active{
        background: #fff;
      }

      /* Section */
      #wl-home .wl-section{
        margin-top: 16px;
      }
      #wl-home .wl-section-h{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        margin: 0 0 10px;
      }
      #wl-home .wl-section-title{
        margin:0;
        font-size: 16px;
        font-weight: 900;
      }
      #wl-home .wl-section-note{
        color: var(--wl-muted);
        font-size: 12px;
        margin:0;
      }

      /* Horizontal scroller */
      #wl-home .wl-scroller-wrap{
        position:relative;
      }
      #wl-home .wl-scroller{
        display:flex;
        gap: 12px;
        overflow:auto;
        scroll-snap-type: x mandatory;
        padding: 2px 2px 10px;
        scrollbar-width: none;
      }
      #wl-home .wl-scroller::-webkit-scrollbar{ display:none; }

      #wl-home .wl-card{
        min-width: 230px;
        max-width: 310px;
        flex: 0 0 auto;
        scroll-snap-align: start;
        border-radius: var(--wl-radius);
        background: linear-gradient(180deg, var(--wl-card), var(--wl-card2));
        box-shadow: var(--wl-shadow);
        overflow:hidden;
        border: 1px solid rgba(255,255,255,.06);
        text-decoration:none;
        color: var(--wl-text);
        position:relative;
      }
      #wl-home .wl-card-img{
        width:100%;
        height: 140px;
        object-fit: cover;
        display:block;
        background:#000;
      }
      #wl-home .wl-card-body{
        padding: 12px 12px 14px;
      }
      #wl-home .wl-card-title{
        margin:0;
        font-weight: 900;
        font-size: 15px;
        line-height: 1.15;
      }
      #wl-home .wl-card-sub{
        margin: 6px 0 0;
        color: var(--wl-muted);
        font-size: 12.5px;
        line-height: 1.25;
      }
      #wl-home .wl-chip{
        position:absolute;
        top:10px; left:10px;
        background: rgba(0,0,0,.55);
        color:#fff;
        font-size: 11px;
        padding: 6px 9px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.14);
        backdrop-filter: blur(6px);
      }

      #wl-home .wl-arrow{
        position:absolute;
        top:50%;
        transform: translateY(-50%);
        width: 38px;
        height: 38px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.16);
        background: rgba(0,0,0,.45);
        color:#fff;
        cursor:pointer;
        display:flex;
        align-items:center;
        justify-content:center;
        z-index:2;
      }
      #wl-home .wl-arrow:hover{ background: rgba(0,0,0,.60); }
      #wl-home .wl-arrow-left{ left: 8px; }
      #wl-home .wl-arrow-right{ right: 8px; }

      /* Banners grid */
      #wl-home .wl-banners{
        display:grid;
        grid-template-columns: repeat(12, 1fr);
        gap: 12px;
      }
      #wl-home .wl-banner{
        grid-column: span 12;
        border-radius: var(--wl-radius);
        overflow:hidden;
        background: linear-gradient(180deg, var(--wl-card), var(--wl-card2));
        border: 1px solid rgba(255,255,255,.06);
        box-shadow: var(--wl-shadow);
        text-decoration:none;
        color: var(--wl-text);
        position:relative;
        min-height: 120px;
      }
      #wl-home .wl-banner img{
        width:100%;
        height: 180px;
        object-fit: cover;
        display:block;
        opacity: .95;
      }
      #wl-home .wl-banner .wl-banner-copy{
        position:absolute;
        inset:0;
        display:flex;
        align-items:flex-end;
        padding: 14px;
        background: linear-gradient(180deg, rgba(0,0,0,.10) 35%, rgba(0,0,0,.70) 100%);
      }
      #wl-home .wl-banner .wl-banner-h{
        margin:0;
        font-weight: 900;
        font-size: 16px;
      }
      #wl-home .wl-banner .wl-banner-p{
        margin:6px 0 0;
        color: rgba(255,255,255,.82);
        font-size: 12.5px;
        line-height: 1.25;
      }

      @media (min-width: 900px){
        #wl-home{ padding: 18px 18px 26px; }
        #wl-home .wl-shell{ padding: 18px; }
        #wl-home .wl-banner{ grid-column: span 6; }
      }
    `;

    var style = document.createElement("style");
    style.id = "wl-home-css";
    style.textContent = css;
    document.head.appendChild(style);
  }

  // -------------------------
  // Helpers
  // -------------------------
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") n.className = attrs[k];
        else if (k === "html") n.innerHTML = attrs[k];
        else if (k === "text") n.textContent = attrs[k];
        else n.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }

  function safeUrl(url) {
    if (!url) return "";
    return String(url).trim();
  }

  function isYouTube(url) {
    return /youtube\.com|youtu\.be/.test(url || "");
  }

  // For WebTrack product groups, you can build links like:
  // Products.aspx?pg=4677&pl1=4677&sort=StockClassSort&direction=asc
  function buildHref(href) {
    return safeUrl(href || "#");
  }

  function scrollByCard(scroller, dir) {
    var card = scroller.querySelector(".wl-card");
    var amount = card ? (card.getBoundingClientRect().width + 12) : 260;
    scroller.scrollBy({ left: dir * amount * 1.6, behavior: "smooth" });
  }

  function addDragScroll(scroller) {
    var isDown = false, startX = 0, scrollLeft = 0;

    scroller.addEventListener("pointerdown", function (e) {
      isDown = true;
      scroller.setPointerCapture(e.pointerId);
      startX = e.clientX;
      scrollLeft = scroller.scrollLeft;
    });

    scroller.addEventListener("pointermove", function (e) {
      if (!isDown) return;
      var dx = e.clientX - startX;
      scroller.scrollLeft = scrollLeft - dx;
    });

    function end(e){
      isDown = false;
      try { scroller.releasePointerCapture(e.pointerId); } catch(_){}
    }

    scroller.addEventListener("pointerup", end);
    scroller.addEventListener("pointercancel", end);
    scroller.addEventListener("pointerleave", function(){ isDown = false; });
  }

  // -------------------------
  // Renderers
  // -------------------------
  function renderHero(hero) {
    // hero = { type: "carousel"|"video", slides: [...], heading, text, ctas:[{label,href,variant}] }
    var wrap = el("div", { class: "wl-hero" });

    var mediaHolder = null;

    if (hero && hero.type === "video" && hero.videoUrl) {
      var vUrl = safeUrl(hero.videoUrl);

      if (isYouTube(vUrl)) {
        // YouTube embed
        var iframe = el("iframe", {
          class: "wl-hero-media",
          src: vUrl.replace("watch?v=", "embed/").replace("youtu.be/", "www.youtube.com/embed/"),
          title: "Promo video",
          frameborder: "0",
          allow:
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
          allowfullscreen: "true"
        });
        mediaHolder = iframe;
      } else {
        // MP4 (or similar)
        var video = el("video", {
          class: "wl-hero-media",
          playsinline: "true",
          muted: "true",
          autoplay: "true",
          loop: "true"
        });
        video.appendChild(el("source", { src: vUrl }));
        mediaHolder = video;
      }

      wrap.appendChild(mediaHolder);
    } else {
      // Carousel (default)
      var slides = (hero && hero.slides) || [];
      if (!slides.length) {
        slides = [{
          image: "https://images-woodsonlumber.sirv.com/Other%20Website%20Images/Statements.png",
          heading: "Welcome to Woodson",
          text: "Update this hero by editing your JSON config—no redesign needed.",
          ctas: [{ label: "Shop Now", href: "Products.aspx", variant: "primary" }]
        }];
      }

      var img = el("img", { class: "wl-hero-media", alt: "", src: safeUrl(slides[0].image) });
      wrap.appendChild(img);

      var dots = el("div", { class: "wl-dots" });
      wrap.appendChild(dots);

      var idx = 0;
      var interval = Math.max(2500, Number(hero && hero.intervalMs) || 6000);

      function applySlide(i) {
        idx = i;
        var s = slides[idx];
        img.src = safeUrl(s.image);
        img.alt = s.alt || "";

        // Update overlay text (handled below by data binding)
        wrap.setAttribute("data-slide-idx", String(idx));

        Array.prototype.forEach.call(dots.children, function (d, di) {
          d.classList.toggle("is-active", di === idx);
        });
      }

      slides.forEach(function (_s, i) {
        var d = el("button", { class: "wl-dot", type: "button", "aria-label": "Slide " + (i + 1) });
        d.addEventListener("click", function () { applySlide(i); });
        dots.appendChild(d);
      });

      // autoplay
      setTimeout(function () {
        applySlide(0);
        if (slides.length > 1) {
          setInterval(function () {
            applySlide((idx + 1) % slides.length);
          }, interval);
        }
      }, 20);

      // Store slides on element for overlay renderer
      wrap.__wlSlides = slides;
    }

    // Overlay copy (supports either hero-level text OR per-slide)
    var overlay = el("div", { class: "wl-hero-overlay" });
    var copy = el("div", { class: "wl-hero-copy" });

    var h = el("h2", { class: "wl-hero-h", text: (hero && hero.heading) || "" });
    var p = el("p", { class: "wl-hero-p", text: (hero && hero.text) || "" });
    var ctasWrap = el("div", { class: "wl-hero-ctas" });

    function renderCtas(ctas) {
      ctasWrap.innerHTML = "";
      (ctas || []).slice(0, 3).forEach(function (c) {
        var variant = (c.variant || "ghost").toLowerCase();
        var cls = "wl-btn " + (variant === "primary" ? "wl-btn-primary" : "wl-btn-ghost");
        var a = el("a", { class: cls, href: buildHref(c.href), target: c.target || "_self" }, [
          el("span", { text: c.label || "Learn More" })
        ]);
        ctasWrap.appendChild(a);
      });
    }

    // If carousel slides exist, bind overlay to current slide
    if (wrap.__wlSlides) {
      var slides = wrap.__wlSlides;

      function syncOverlayFromSlide() {
        var sidx = Number(wrap.getAttribute("data-slide-idx") || "0");
        var s = slides[sidx] || slides[0];

        h.textContent = s.heading || hero.heading || "";
        p.textContent = s.text || hero.text || "";
        renderCtas(s.ctas || hero.ctas || []);
      }

      // Poll lightly; simple + robust across hosts
      var last = -1;
      setInterval(function () {
        var now = Number(wrap.getAttribute("data-slide-idx") || "0");
        if (now !== last) {
          last = now;
          syncOverlayFromSlide();
        }
      }, 200);
      setTimeout(syncOverlayFromSlide, 30);
    } else {
      // Video hero uses hero-level copy
      if (!h.textContent) h.textContent = "Weekly Deals, Local Help, Fast Pickup";
      if (!p.textContent) p.textContent = "Update this hero copy anytime via config JSON.";
      renderCtas((hero && hero.ctas) || [{ label: "Shop Now", href: "Products.aspx", variant: "primary" }]);
    }

    copy.appendChild(h);
    copy.appendChild(p);
    copy.appendChild(ctasWrap);
    overlay.appendChild(copy);
    wrap.appendChild(overlay);

    return wrap;
  }

  function renderCategoryScroller(section) {
    // section = { title, note, items:[{title,sub,image,href,chip}] }
    var root = el("div", { class: "wl-section" });

    var head = el("div", { class: "wl-section-h" });
    head.appendChild(el("h3", { class: "wl-section-title", text: section.title || "Shop Categories" }));
    head.appendChild(el("p", { class: "wl-section-note", text: section.note || "Swipe or use arrows" }));
    root.appendChild(head);

    var wrap = el("div", { class: "wl-scroller-wrap" });
    var scroller = el("div", { class: "wl-scroller" });

    (section.items || []).forEach(function (it) {
      var a = el("a", { class: "wl-card", href: buildHref(it.href), target: it.target || "_self" });

      if (it.chip) a.appendChild(el("div", { class: "wl-chip", text: it.chip }));

      if (it.image) {
        a.appendChild(el("img", { class: "wl-card-img", alt: it.title || "", src: safeUrl(it.image) }));
      }

      var body = el("div", { class: "wl-card-body" });
      body.appendChild(el("div", { class: "wl-card-title", text: it.title || "Category" }));
      body.appendChild(el("div", { class: "wl-card-sub", text: it.sub || "" }));
      a.appendChild(body);

      scroller.appendChild(a);
    });

    addDragScroll(scroller);

    var left = el("button", { class: "wl-arrow wl-arrow-left", type: "button", "aria-label": "Scroll left" }, ["‹"]);
    var right = el("button", { class: "wl-arrow wl-arrow-right", type: "button", "aria-label": "Scroll right" }, ["›"]);

    left.addEventListener("click", function () { scrollByCard(scroller, -1); });
    right.addEventListener("click", function () { scrollByCard(scroller, 1); });

    wrap.appendChild(left);
    wrap.appendChild(right);
    wrap.appendChild(scroller);

    root.appendChild(wrap);
    return root;
  }

  function renderBanners(section) {
    // section = { title, items:[{heading,text,image,href}] }
    var root = el("div", { class: "wl-section" });

    var head = el("div", { class: "wl-section-h" });
    head.appendChild(el("h3", { class: "wl-section-title", text: section.title || "Featured" }));
    head.appendChild(el("p", { class: "wl-section-note", text: section.note || "" }));
    root.appendChild(head);

    var grid = el("div", { class: "wl-banners" });

    (section.items || []).forEach(function (b) {
      var a = el("a", { class: "wl-banner", href: buildHref(b.href), target: b.target || "_self" });
      if (b.image) a.appendChild(el("img", { alt: b.heading || "", src: safeUrl(b.image) }));
      var copy = el("div", { class: "wl-banner-copy" });
      var inner = el("div", null, [
        el("div", { class: "wl-banner-h", text: b.heading || "" }),
        el("div", { class: "wl-banner-p", text: b.text || "" })
      ]);
      copy.appendChild(inner);
      a.appendChild(copy);
      grid.appendChild(a);
    });

    root.appendChild(grid);
    return root;
  }

  // -------------------------
  // Main render
  // -------------------------
  function render(config) {
    injectCSS();

    var mount = resolveMount();
    var outer = el("section", { id: "wl-home" });
    var shell = el("div", { class: "wl-shell" });

    // Top title (optional)
    var topbar = el("div", { class: "wl-topbar" });
    var titleBlock = el("div", null, [
      el("h1", { class: "wl-title", text: (config && config.pageTitle) || "Woodson Home" }),
      el("p", { class: "wl-subtitle", text: (config && config.pageSubtitle) || "Updated from one shared config — WebTrack + Wix." })
    ]);
    topbar.appendChild(titleBlock);
    shell.appendChild(topbar);

    // Hero
    shell.appendChild(renderHero(config && config.hero));

    // Sections
    (config.sections || []).forEach(function (s) {
      if (!s || !s.type) return;
      if (s.type === "categoryScroller") shell.appendChild(renderCategoryScroller(s));
      else if (s.type === "banners") shell.appendChild(renderBanners(s));
    });

    outer.appendChild(shell);

    // Replace existing module if rerender
    var existing = document.getElementById("wl-home");
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    mount.appendChild(outer);
  }

  // -------------------------
  // Config loader
  // -------------------------
  function boot() {
    // Basic default config if none provided
    var fallback = {
      pageTitle: "Woodson Home",
      pageSubtitle: "Edit the JSON config to change hero, categories, and banners.",
      hero: {
        type: "carousel",
        intervalMs: 6500,
        slides: [
          {
            image: "https://images-woodsonlumber.sirv.com/Other%20Website%20Images/Statements.png",
            heading: "Deals, delivery, and local help",
            text: "Swap these slides by editing one JSON file.",
            ctas: [
              { label: "Shop All", href: "Products.aspx", variant: "primary" },
              { label: "Weekly Ad", href: "Resources.aspx", variant: "ghost" }
            ]
          }
        ]
      },
      sections: [
        {
          type: "categoryScroller",
          title: "Shop by department",
          note: "Tap a card to jump to a product group",
          items: [
            { title: "Plumbing", sub: "Pipes, fittings, repair", href: "Products.aspx", chip: "Popular" },
            { title: "Paint", sub: "Interior & exterior", href: "Products.aspx" },
            { title: "Tools", sub: "Power tools & hand tools", href: "Products.aspx" }
          ]
        }
      ]
    };

    if (!CONFIG_URL) {
      render(fallback);
      return;
    }

    fetch(CONFIG_URL, { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("Config fetch failed: " + r.status);
        return r.json();
      })
      .then(function (cfg) {
        render(cfg || fallback);
      })
      .catch(function (err) {
        console.warn("[WL Home] Using fallback config due to error:", err);
        render(fallback);
      });
  }

  // Run
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
</script>
