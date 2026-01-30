/* =========================================================
   Woodson Quote CTA Injector
   Handles:
   ✓ ShoppingCart.aspx
   ✓ ProductDetail.aspx
   Safe • standalone • no dependencies
   ========================================================= */

(function WLQuoteCTA() {
  "use strict";

  const CONFIG = {
    quoteUrl: "https://woodsonwholesaleinc.formstack.com/forms/request_a_quote",
    brandColor: "#6b0016", // Woodson maroon
    debug: true
  };

  const log = (...a) => CONFIG.debug && console.log("[QuoteCTA]", ...a);

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  function onCartPage() {
    return /ShoppingCart\.aspx/i.test(window.location.pathname);
  }

  function onProductPage() {
    return /ProductDetail\.aspx/i.test(window.location.pathname);
  }

  /* =====================================================
     Shared CTA Builder
  ===================================================== */
  function createCTA(className, message) {
    const wrap = document.createElement("div");
    wrap.className = className;

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
        <div style="font-size:14px;color:#6c757d;">
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
     CART PAGE
  ===================================================== */
  function injectCartCTA() {
    if (!onCartPage()) return;

    if (document.querySelector(".wl-quote-cart")) return;

    const header = document.querySelector(".cart-header");
    if (!header) return;

    const cta = createCTA(
      "wl-quote-cart",
      "Pricing a bigger order or special materials? Submit a quick request and we’ll get back to you fast."
    );

    header.insertAdjacentElement("afterend", cta);

    log("Cart CTA injected");
  }

  /* =====================================================
     PRODUCT DETAIL PAGE
  ===================================================== */
  function injectProductCTA() {
    if (!onProductPage()) return;

    if (document.querySelector(".wl-quote-product")) return;

    const headers = document.querySelectorAll(".formPageHeader");

    let target = null;
    headers.forEach(h => {
      if (h.textContent.includes("Product Code")) target = h;
    });

    if (!target) return;

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
