function jsonp(url, callbackName) {
  return new Promise((resolve, reject) => {
    const name = callbackName || `promoCallback_${Date.now()}`;
    const script = document.createElement('script');

    // Define the global handler the server calls
    window[name] = (data) => {
      try { resolve(data); }
      finally {
        delete window[name];
        script.remove();
      }
    };

    script.onerror = () => {
      delete window[name];
      script.remove();
      reject(new Error("JSONP request failed"));
    };

    // Append callback param
    const sep = url.includes('?') ? '&' : '?';
    script.src = `${url}${sep}callback=${name}`;
    document.head.appendChild(script);
  });
}

// In your click handler:
applyButton.addEventListener("click", async (e) => {
  e.preventDefault();
  const code = promoInput.value.trim().toUpperCase();
  if (!code) return alert("Please enter a promo code.");

  const subtotal = parseFloat(
    document.querySelector("#SummaryEntry2 .summaryTotals tr:nth-child(1) td.numeric")
      ?.textContent.replace(/[^0-9.]/g, "") || "0"
  );

  try {
    const url = `https://script.google.com/macros/s/AKfycbwhHN33SIV2m1Z1Fb_xk_N2yqVDtTCsDI1OMAQBxVa1DHyTBg0YFOfAq7Q8_JYP7Wv6yQ/exec?code=${encodeURIComponent(code)}&subtotal=${encodeURIComponent(subtotal)}`;
    const data = await jsonp(url);

    if (!data?.valid) {
      alert("Promo code is invalid or conditions not met.");
      return;
    }

    const discount = Number(data.discount || 0);
    const tax = parseFloat(
      document.querySelector("#ctl00_PageBody_CartSummary2_TaxTotals td.numeric")
        ?.textContent.replace(/[^0-9.]/g, "") || "0"
    );
    const totalCell = document.querySelector("#ctl00_PageBody_CartSummary2_GrandTotalRow td.numeric.totalRow");
    const discountCell = document.querySelector("#SummaryEntry2 .summaryTotals tr:nth-child(2) td.numeric");

    discountCell.textContent = `$${discount.toFixed(2)}`;
    const newTotal = (subtotal - discount + tax);
    totalCell.textContent = `$${newTotal.toFixed(2)}`;

    alert(`Promo applied: $${discount.toFixed(2)} off`);
  } catch (err) {
    console.error("[PromoCodeOverride] JSONP error:", err);
    alert("Failed to validate promo code. Please try again.");
  }
});
