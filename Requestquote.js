/* =========================================================
   Woodson Quote CTA Injector (Combined)
   Handles:
   ✓ ShoppingCart* (ShoppingCart.aspx, ShoppingCart_r.aspx, etc.)
   ✓ ProductDetail.aspx
   Safe • standalone • no dependencies • retries for late DOM
   ========================================================= */

(function WLQuoteCTA() {
  "use strict";

  const CONFIG = {
    quoteUrl: "https://woodsonwholesaleinc.formstack.com/forms/request_a_quote",
    brandColor: "#6b0016", // Woodson maroon
    debug: true
  };

  const log = (...a) => CONFIG.debug && console.log("[QuoteCTA]", ...a);
  const warn = (...a) => CONFIG.debug && console.warn("[QuoteCTA]", ...a);

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  // WebTrack pages can vary (ShoppingCart.aspx, ShoppingCart_r.aspx, etc.)
  function onCartPage() {
    const href = String(window.location.href || "");
    const path = String(window.location.pathname || "");
    return /ShoppingCart/i.test(href) || /ShoppingCart/i.test(path);
  }

  function onProductPage() {
    const href = String(window.location.href || "");
    const path = String(window.location.pathname || "");
    return /ProductDetail\.aspx/i.test(href) || /ProductDetail\.aspx/i.test(path);
  }

  /* =====================================================
     Shared CTA Builder
  ===================================================== */
  function createCTA(className, message) {
    const wrap = document.createElement("div");
    wrap.className = className;
    wrap.setAttribute("data-wl", "quote-cta");

    wrap.style.margin = "12px 0";
    wrap.style.padding = "12px 14px";
    wrap.style.border = "1px solid rgba(0,0,0,.1)";
    wrap.style.borderRadius = "10px";
    wrap.style.background = "#fff";
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.justifyContent = "space-between";
    wrap.style.gap = "12px";
    wrap.style.flexWrap = "wrap";

    wrap.innerHTML = `
      <div>
        <div style="font-weight:700;">Need a Quote?</div>
        <div style="font-size:14px;color:#6c757d;line-height:1.35;">
          ${message}
        </div>
      </div>

      <a href="${CONFIG.quoteUrl}"
         target="_blank"
         rel="noopener"
         style="
           background:${CONFIG.brandColor};
           color:#ffffff;
           padding:9px 16px;
           border-radius:8px;
           font-weight:700;
           text-decoration:none;
           white-space:nowrap;
         ">
        Request a Quote
      </a>
    `;

    return wrap;
  }

  /* =====================================================
     CART PAGE (inject under .cart-header)
     Includes retries to survive late DOM or other scripts
  ===================================================== */
  function injectCartCTA() {
    if (!onCartPage()) return;

    // Avoid duplicates
    if (document.querySelector(".wl-quote-cart")) {
      log("Cart CTA already present");
      return;
    }

    let attempts = 0;
    const maxAttempts = 20; // ~10 seconds (20 * 500ms)

    const timer = setInterval(() => {
      attempts++;

      // Prefer the cart header you showed
      const header = document.querySelector(".cart-header");

      if (header && !document.querySelector(".wl-quote-cart")) {
        const cta = createCTA(
          "wl-quote-cart",
          "Pricing a bigger order or special materials? Submit a quick request and we’ll get back to you fast."
        );

        header.insertAdjacentElement("afterend", cta);
        log("Cart CTA injected");
        clearInterval(timer);
        return;
      }

      if (attempts >= maxAttempts) {
        warn("Cart CTA: .cart-header not found after retries");
        clearInterval(timer);
      }
    }, 500);
  }

  /* =====================================================
     PRODUCT DETAIL PAGE (inject under Product Code header)
  ===================================================== */
  function injectProductCTA() {
    if (!onProductPage()) return;

    if (document.querySelector(".wl-quote-product")) {
      log("Product CTA already present");
      return;
    }

    const headers = document.querySelectorAll(".formPageHeader");
    let target = null;

    headers.forEach((h) => {
      if (String(h.textContent || "").includes("Product Code")) target = h;
    });

    if (!target) {
      warn("Product CTA: Product Code header not found");
      return;
    }

    const cta = createCTA(
      "wl-quote-product",
      "Buying in bulk or pricing a larger project? We’ll get you contractor pricing fast."
    );

    target.insertAdjacentElement("afterend", cta);
    log("Product CTA injected");
  }

  /* =====================================================
     INIT
  ===================================================== */
  ready(() => {
    injectCartCTA();
    injectProductCTA();
  });

})();
