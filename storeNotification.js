
(function() {
  // ensure it only runs once
  if (window.__orderNotify) return;
  window.__orderNotify = true;

  document.addEventListener("DOMContentLoaded", () => {
    let attempts = 0;
    const maxAttempts = 10;

    const interval = setInterval(() => {
      attempts++;

      const thankYou = document.querySelector("#CartResponseMessage");
      const merchant = document.querySelector("#ctl00_PageBody_SuccessfulPaymentResults_MerchantDetailsPanel");

      if (thankYou && merchant) {
        clearInterval(interval);

        // extract order number
        const orderEl = thankYou.querySelector("strong");
        const orderNumber = orderEl ? orderEl.textContent.trim() : "";

        // extract branch name (first line of the address block)
        const td = merchant.querySelector("td");
        const branchName = td
          ? td.textContent.split("\n")[0].trim()
          : "";

        // POST to your Apps Script Web App
        fetch("https://script.google.com/macros/s/AKfycbyyNX8SshEk5opzF6YUHZpCcBomWWWXv3RG3dh3JPGqVGDsgriFT0s1ZuMEX7m73etF/exec", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ orderNumber, branchName })
        })
        .catch(err => console.error("Order notify failed:", err));
      }

      // stop polling after too many attempts
      if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 500);
  });
})();

