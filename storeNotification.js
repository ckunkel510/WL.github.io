
(function() {
  // Only run once
  if (window.__branchNotifyInitialized) return;
  window.__branchNotifyInitialized = true;

  document.addEventListener("DOMContentLoaded", () => {
    // We poll briefly in case the panels render after DOMContentLoaded
    let attempts = 0;
    const maxAttempts = 10;
    const interval = setInterval(() => {
      attempts++;
      const thankYouPanel = document.querySelector("#CartResponseMessage");
      const merchantPanel = document.querySelector("#ctl00_PageBody_SuccessfulPaymentResults_MerchantDetailsPanel");

      if (thankYouPanel && merchantPanel) {
        clearInterval(interval);

        // Extract order number
        const orderNumberEl = thankYouPanel.querySelector("strong");
        const orderNumber = orderNumberEl
          ? orderNumberEl.textContent.trim()
          : "UNKNOWN";

        // Extract branch name (first line of the address block)
        const td = merchantPanel.querySelector("td");
        const branchName = td
          ? td.textContent.split("\n")[0].trim()
          : "UNKNOWN";

        // Post to your Vercel API
        fetch("https://wlmarketingdashboard.vercel.app/api/notify-branch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Optional: add a secret header to protect your endpoint
            "x-notify-secret": "YOUR_SHARED_SECRET"
          },
          body: JSON.stringify({
            orderNumber,
            branchName
          })
        })
        .catch(err => console.error("Branch notify failed:", err));
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 500);
  });
})();

