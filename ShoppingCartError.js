
document.addEventListener("DOMContentLoaded", function () {
  const cartLink = document.querySelector('a[href="ShoppingCart.aspx"]');

  if (cartLink) {
    cartLink.addEventListener("click", function () {
      console.log("[Cart Recovery] Cart icon clicked – setting redirect flag");
      sessionStorage.setItem("CartErrorRedirect", "true");
    });
  }
});

