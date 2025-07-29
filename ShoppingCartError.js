document.addEventListener("DOMContentLoaded", function () {
  try {
    // Just a safety net: If this page has invalid rows that trigger errors
    // we set a flag before navigating, or a known error case
    const hasError = document.body.innerText.includes("Error loading product") || document.title.includes("Error");
    if (hasError) {
      sessionStorage.setItem("CartErrorRedirect", "true");
    }
  } catch (e) {
    console.warn("Cart error detection failed", e);
  }
});

