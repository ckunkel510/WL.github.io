console.log("[PromoCodeOverride] Script injected ✅");

document.addEventListener("DOMContentLoaded", () => {
  const applyButton = document.querySelector("#ctl00_PageBody_PromotionCodeEntry_ApplyPromotionalCodeButton");
  const promoInput = document.querySelector("#ctl00_PageBody_PromotionCodeEntry_PromoCodeTextBox");

  if (!applyButton || !promoInput) {
    console.warn("[PromoCodeOverride] Promo input or button not found.");
    return;
  }

  // Replace click behavior
  applyButton.addEventListener("click", async (e) => {
    e.preventDefault();
    const code = promoInput.value.trim().toUpperCase();

    if (!code) return alert("Please enter a promo code.");

    console.log(`[PromoCodeOverride] Checking promo code: ${code}`);

    const subtotal = parseFloat(
      document.querySelector("#SummaryEntry2 .summaryTotals tr:nth-child(1) td.numeric")?.textContent.replace("$", "") || "0"
    );

    try {
      const res = await fetch(`https://script.google.com/macros/s/AKfycbwhHN33SIV2m1Z1Fb_xk_N2yqVDtTCsDI1OMAQBxVa1DHyTBg0YFOfAq7Q8_JYP7Wv6yQ/exec?code=${code}&subtotal=${subtotal}`);
      const data = await res.json();

      if (!data.valid) {
        alert("Promo code is invalid or conditions not met.");
        return;
      }

      // Update DOM
      const discountAmount = data.discount.toFixed(2);
      const tax = parseFloat(
        document.querySelector("#ctl00_PageBody_CartSummary2_TaxTotals td.numeric")?.textContent.replace("$", "") || "0"
      );
      const newTotal = (subtotal - data.discount + tax).toFixed(2);

      document.querySelector("#SummaryEntry2 .summaryTotals tr:nth-child(2) td.numeric").textContent = `$${discountAmount}`;
      document.querySelector("#ctl00_PageBody_CartSummary2_GrandTotalRow td.numeric.totalRow").textContent = `$${newTotal}`;

      alert(`Promo applied: $${discountAmount} off`);
    } catch (err) {
      console.error("[PromoCodeOverride] Error:", err);
      alert("Failed to validate promo code. Try again later.");
    }
  });
});
