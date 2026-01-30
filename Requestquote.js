/* WL-QuoteCTA.js
   Injects a "Need a Quote?" callout under the Shopping Cart header.
   Safe: guarded, no dependencies, avoids duplicates, logs status.
*/
(function WLQuoteCTAInjector() {
  "use strict";

  // ====== CONFIG ======
  var CONFIG = {
    // Keep this true to only run on ShoppingCart.aspx
    onlyOnShoppingCart: true,

    quoteUrl: "https://woodsonwholesaleinc.formstack.com/forms/request_a_quote",

    // Text
    title: "Need a Quote?",
    body:
      "Pricing a bigger order or not seeing exactly what you need? Submit a quick request and we’ll get back to you.",
    buttonText: "Request a Quote",

    // Class name used to avoid duplicates
    ctaClass: "wl-quote-cta",

    // Logging
    debug: true
  };

  function log() {
    if (!CONFIG.debug) return;
    try {
      console.log.apply(console, arguments);
    } catch (e) {}
  }

  function warn() {
    if (!CONFIG.debug) return;
    try {
      console.warn.apply(console, arguments);
    } catch (e) {}
  }

  function err() {
    if (!CONFIG.debug) return;
    try {
      console.error.apply(console, arguments);
    } catch (e) {}
  }

  function isShoppingCartPage() {
    var href = String(window.location.href || "");
    var path = String(window.location.pathname || "");
    return /ShoppingCart\.aspx/i.test(href) || /ShoppingCart\.aspx/i.test(path);
  }

  function ready(fn) {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      setTimeout(fn, 0);
    } else {
      document.addEventListener("DOMContentLoaded", fn);
    }
  }

  function createCTA() {
    var wrap = document.createElement("div");
    wrap.className = CONFIG.ctaClass + " card mb-3";
    wrap.setAttribute("data-wl", "quote-cta");

    // Minimal inline style so it looks good even if bootstrap classes differ
    wrap.style.border = "1px solid rgba(0,0,0,.125)";
    wrap.style.borderRadius = "10px";
    wrap.style.overflow = "hidden";

    wrap.innerHTML =
      '<div class="card-body p-3" style="background:#fff;">' +
      '  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">' +
      '    <div style="min-width:240px;flex:1;">' +
      '      <div style="font-weight:700;font-size:1.05rem;margin-bottom:4px;">' +
      CONFIG.title +
      "</div>" +
      '      <div style="color:#6c757d;line-height:1.35;">' +
      CONFIG.body +
      "</div>" +
      "    </div>" +
      '    <a href="' +
      CONFIG.quoteUrl +
      '" target="_blank" rel="noopener" ' +
      '       class="btn btn-primary text-white" ' +
      '       style="white-space:nowrap;border-radius:8px;font-weight:700;">' +
      CONFIG.buttonText +
      "</a>" +
      "  </div>" +
      "</div>";

    return wrap;
  }

  function alreadyInjected(scope) {
    return !!(scope || document).querySelector("." + CONFIG.ctaClass + "[data-wl='quote-cta']");
  }

  function findCartHeader() {
    // Primary: the markup you showed
    // <div class="cart-header mb-3"><h2>Shopping Cart</h2>...</div>
    var headers = document.querySelectorAll(".cart-header");
    if (headers && headers.length) {
      for (var i = 0; i < headers.length; i++) {
        var h2 = headers[i].querySelector("h2");
        var txt = (h2 && h2.textContent ? h2.textContent : "").trim().toLowerCase();
        if (!txt || txt === "shopping cart") return headers[i];
      }
      return headers[0];
    }

    // Fallback: find any h2 that says Shopping Cart, then use its parent container
    var allH2 = document.querySelectorAll("h2");
    for (var j = 0; j < allH2.length; j++) {
      var t = (allH2[j].textContent || "").trim().toLowerCase();
      if (t === "shopping cart") {
        return allH2[j].closest("div") || allH2[j].parentElement;
      }
    }

    return null;
  }

  function inject() {
    try {
      if (CONFIG.onlyOnShoppingCart && !isShoppingCartPage()) {
        log("[QuoteCTA] Not ShoppingCart.aspx — skipping.");
        return;
      }

      // Optional scope: the shopping cart panel if present (more stable)
      var cartPanel = document.querySelector("#ctl00_PageBody_ShoppingCartDetailPanel") || document;

      if (alreadyInjected(cartPanel)) {
        log("[QuoteCTA] Already injected — skipping.");
        return;
      }

      var header = findCartHeader();
      if (!header) {
        warn("[QuoteCTA] Could not find cart header. Will retry once in 750ms.");
        setTimeout(function () {
          try {
            var header2 = findCartHeader();
            if (!header2) {
              warn("[QuoteCTA] Still no header found — aborting.");
              return;
            }
            if (alreadyInjected(document)) return;
            header2.insertAdjacentElement("afterend", createCTA());
            log("[QuoteCTA] Injected after header (retry).");
          } catch (e2) {
            err("[QuoteCTA] Retry injection failed:", e2);
          }
        }, 750);
        return;
      }

      header.insertAdjacentElement("afterend", createCTA());
      log("[QuoteCTA] Injected after header.");
    } catch (e) {
      err("[QuoteCTA] Injection failed:", e);
    }
  }

  ready(inject);
})();
