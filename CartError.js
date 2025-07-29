document.addEventListener("DOMContentLoaded", function () {
  const cameFromCart = sessionStorage.getItem("CartErrorRedirect") === "true";

  if (!cameFromCart) return;

  console.log("[Cart Recovery] Cart error redirect detected. Preparing retry...");

  sessionStorage.removeItem("CartErrorRedirect");

  // Increment a retry counter to avoid infinite loop
  let retryCount = parseInt(sessionStorage.getItem("CartRecoveryAttemptCount") || "0", 10);
  retryCount++;
  sessionStorage.setItem("CartRecoveryAttemptCount", retryCount);

  if (retryCount > 2) {
    console.warn("[Cart Recovery] Too many attempts. Not retrying again.");
    sessionStorage.removeItem("CartRecoveryAttemptCount");
    return;
  }

  sessionStorage.setItem("CartNeedsEmpty", "true");
  window.location.href = "/ShoppingCart.aspx";
});

