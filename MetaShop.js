
document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const cartOrigin = params.get("cart_origin");
  const productsParam = params.get("products");

  if (cartOrigin !== "meta_shops" || !productsParam) return;

  // Only run once
  if (sessionStorage.getItem("metaCartBuilt")) return;
  sessionStorage.setItem("metaCartBuilt", "true");

  const productEntries = productsParam.split(",");
  const products = productEntries.map(entry => {
    const [id, qty] = entry.split(":");
    return { productId: id, quantity: parseInt(qty || "1", 10) };
  });

  console.log("[MetaShops] Starting cart build for:", products);

  for (const { productId, quantity } of products) {
    for (let i = 0; i < quantity; i++) {
      await addToCartViaIframe(productId);
    }
  }

  console.log("[MetaShops] All items processed. Redirecting to cart...");
  setTimeout(() => {
    window.location.href = "/ShoppingCart.aspx";
  }, 1000);
});

function addToCartViaIframe(productId) {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = `/ProductDetail.aspx?pid=${productId}`;

    iframe.onload = () => {
      try {
        const button = iframe.contentWindow.document.querySelector("#ctl00_PageBody_productDetail_ctl00_AddProductButton");
        if (button) {
          button.click();
          console.log(`[MetaShops] Added product ${productId} via iframe`);
        } else {
          console.warn(`[MetaShops] Add to Cart button not found for ${productId}`);
        }
      } catch (e) {
        console.error(`[MetaShops] Error accessing iframe for ${productId}:`, e);
      }

      // Clean up iframe and resolve after a short delay
      setTimeout(() => {
        iframe.remove();
        resolve();
      }, 750); // Delay allows postback to register
    };

    document.body.appendChild(iframe);
  });
}

