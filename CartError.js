
document.addEventListener("DOMContentLoaded", function () {
  const cameFromCart = sessionStorage.getItem("CartErrorRedirect") === "true";

  if (cameFromCart) {
    console.log("[Cart Recovery] Redirected to Error.aspx after cart access");

    // Clear flag to avoid infinite loop
    sessionStorage.removeItem("CartErrorRedirect");

    // Attempt to empty cart by simulating click
    const emptyCartBtn = document.querySelector("#ctl00_PageBody_EmptyCartButtonTop");

    if (emptyCartBtn) {
      console.log("[Cart Recovery] Found Empty Cart button – clicking to clear cart");
      emptyCartBtn.click();
    } else {
      console.warn("[Cart Recovery] Empty Cart button not found – proceeding anyway");
    }

    // Delay then return to cart
    setTimeout(() => {
      window.location.href = "/ShoppingCart.aspx";
    }, 1500);
  }
});

