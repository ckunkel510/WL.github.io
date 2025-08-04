// == Promo Code Override (JSONP, WebForms-safe) ==
(() => {
  const APPLY_BTN_SEL   = "#ctl00_PageBody_PromotionCodeEntry_ApplyPromotionalCodeButton";
  const PROMO_INPUT_SEL = "#ctl00_PageBody_PromotionCodeEntry_PromoCodeTextBox";
  const TOTAL_CELL_SEL  = "#ctl00_PageBody_CartSummary2_GrandTotalRow td.numeric.totalRow";
  const TAX_CELL_SEL    = "#ctl00_PageBody_CartSummary2_TaxTotals td.numeric";
  const DISCOUNT_CELL_SEL = "#SummaryEntry2 .summaryTotals tr:nth-child(2) td.numeric";
  const SUBTOTAL_CELL_SEL = "#SummaryEntry2 .summaryTotals tr:nth-child(1) td.numeric";
  const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwhHN33SIV2m1Z1Fb_xk_N2yqVDtTCsDI1OMAQBxVa1DHyTBg0YFOfAq7Q8_JYP7Wv6yQ/exec";

  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const cbName = `promoCB_${Date.now()}`;
      const s = document.createElement("script");
      window[cbName] = (data) => { try { resolve(data); } finally { cleanup(); } };
      s.onerror = () => { cleanup(); reject(new Error("JSONP failed")); };
      const sep = url.includes("?") ? "&" : "?";
      s.src = `${url}${sep}callback=${cbName}`;
      document.head.appendChild(s);
      function cleanup(){ delete window[cbName]; s.remove(); }
    });
  }

  function parseMoney(str) { return parseFloat(String(str || "").replace(/[^0-9.]/g, "")) || 0; }
  function getSubtotal() { return parseMoney(document.querySelector(SUBTOTAL_CELL_SEL)?.textContent); }
  function getTax() { return parseMoney(document.querySelector(TAX_CELL_SEL)?.textContent); }
  function setDiscount(v) { const el = document.querySelector(DISCOUNT_CELL_SEL); if (el) el.textContent = `$${(+v).toFixed(2)}`; }
  function setTotal(v) { const el = document.querySelector(TOTAL_CELL_SEL); if (el) el.textContent = `$${(+v).toFixed(2)}`; }

  async function onApplyClick(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const promoInput = document.querySelector(PROMO_INPUT_SEL);
    const code = (promoInput?.value || "").trim().toUpperCase();
    if (!code) { alert("Please enter a promo code."); return; }

    const subtotal = getSubtotal();
    try {
      const url = `${APPS_SCRIPT_URL}?code=${encodeURIComponent(code)}&subtotal=${encodeURIComponent(subtotal)}`;
      const data = await jsonp(url);
      if (!data?.valid) { alert("Promo code is invalid or conditions not met."); return; }

      const discount = Math.max(0, +data.discount || 0);
      const tax = getTax();
      setDiscount(discount);
      setTotal(subtotal - discount + tax);
      console.log("[PromoCodeOverride] Applied", { code, discount, subtotal, tax });
      alert(`Promo applied: $${discount.toFixed(2)} off`);
    } catch (err) {
      console.error("[PromoCodeOverride] JSONP error:", err);
      alert("Failed to validate promo code. Please try again.");
    }
  }

  function init() {
    const applyBtn = document.querySelector(APPLY_BTN_SEL);
    const promoInput = document.querySelector(PROMO_INPUT_SEL);

    if (!applyBtn || !promoInput) {
      // WebForms/UpdatePanel can delay render — retry shortly
      console.warn("[PromoCodeOverride] Elements not found, retrying…");
      setTimeout(init, 400);
      return;
    }

    // Neutralize built-in postback and bind our handler
    applyBtn.setAttribute("href", "javascript:void(0)");
    applyBtn.addEventListener("click", onApplyClick, true); // capture to beat WebForms handler

    // Also support Enter key in the input
    promoInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") onApplyClick(ev);
    });

    // Safety: delegation in case UpdatePanel re-renders the button later
    document.addEventListener("click", (ev) => {
      const t = ev.target.closest(APPLY_BTN_SEL);
      if (t) onApplyClick(ev);
    });
    console.log("[PromoCodeOverride] Ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
