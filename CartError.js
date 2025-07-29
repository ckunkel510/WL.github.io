document.addEventListener("DOMContentLoaded", function () {
  const shoppingCartUrl = "/ShoppingCart.aspx";

  // Step 1: Detect if we came from ShoppingCart.aspx
  const cameFromCart = document.referrer.includes("ShoppingCart.aspx") || sessionStorage.getItem("CartErrorRedirect") === "true";

  if (cameFromCart) {
    console.log("[Cart Recovery] Detected redirect from ShoppingCart.aspx with error.");

    // Step 2: Clear the flag so it doesn’t loop
    sessionStorage.removeItem("CartErrorRedirect");

    // Step 3: Simulate clicking the Empty Cart button
    const emptyCartBtn = document.querySelector("#ctl00_PageBody_EmptyCartButtonTop");
    if (emptyCartBtn) {
      console.log("[Cart Recovery] Empty Cart button found. Triggering click.");
      emptyCartBtn.click();
    } else {
      console.warn("[Cart Recovery] Empty Cart button not found. Redirecting anyway.");
    }

    // Step 4: Wait briefly, then go back to cart
    setTimeout(() => {
      window.location.href = shoppingCartUrl;
    }, 1500); // Wait a moment for postback (can adjust this)
  }
});
