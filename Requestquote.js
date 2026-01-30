  /* =============================
     Quote request CTA (under Shopping Cart header)
     ============================= */
  (function injectQuoteUnderHeader() {
    try {
      const QUOTE_URL = "https://woodsonwholesaleinc.formstack.com/forms/request_a_quote";

      // Find the cart header (native markup on the page)
      const header = cartPanel.querySelector(".cart-header");
      if (!header) {
        console.warn("[QuoteCTA] .cart-header not found inside cartPanel");
        return;
      }

      // Avoid duplicates
      if (cartPanel.querySelector(".wl-quote-cta")) return;

      const wrap = document.createElement("div");
      wrap.className = "wl-quote-cta card mb-3";
      wrap.style.border = "1px solid rgba(0,0,0,.125)";

      wrap.innerHTML = `
        <div class="card-body p-3">
          <div class="d-flex flex-wrap align-items-start justify-content-between gap-2">
            <div style="min-width:240px; flex:1;">
              <div class="fw-bold" style="font-size: 1.05rem;">Need a Quote?</div>
              <div class="text-muted" style="line-height:1.35;">
                Pricing a bigger order or not seeing exactly what you need? Submit a quick request and we’ll get back to you.
              </div>
            </div>

            <a class="btn btn-outline-primary"
               href="${QUOTE_URL}"
               target="_blank"
               rel="noopener">
              Request a Quote
            </a>
          </div>
        </div>
      `;

      // Insert right under the header
      header.insertAdjacentElement("afterend", wrap);

      console.log("[QuoteCTA] Injected under Shopping Cart header");
    } catch (e) {
      console.error("[QuoteCTA] Failed to inject:", e);
    }
  })();
