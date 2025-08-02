
document.addEventListener("DOMContentLoaded", async () => {
  console.log("[MetaShops] Checking for Meta Shops cart injection...");

  const params = new URLSearchParams(window.location.search);
  const cartOrigin = params.get("cart_origin");
  const productsParam = params.get("products");

  if (cartOrigin !== "meta_shops") {
    console.log("[MetaShops] cart_origin is not 'meta_shops'. Exiting.");
    return;
  }

  if (!productsParam) {
    console.log("[MetaShops] No products parameter found. Exiting.");
    return;
  }

  if (sessionStorage.getItem("metaCartBuilt")) {
    console.log("[MetaShops] Cart was already built this session. Skipping.");
    return;
  }

  sessionStorage.setItem("metaCartBuilt", "true");

  const productEntries = productsParam.split(",");
  const products = productEntries.map(entry => {
    const [id, qty] = entry.split(":");
    const parsedQty = parseInt(qty || "1", 10);
    console.log(`[MetaShops] Queued product ${id} x${parsedQty}`);
    return { productId: id, quantity: parsedQty };
  });

  console.log(`[MetaShops] Starting cart build for ${products.length} product(s)...`);

  for (const { productId, quantity } of products) {
    console.log(`[MetaShops] Processing product ${productId} with quantity ${quantity}`);
    for (let i = 0; i < quantity; i++) {
      console.log(`[MetaShops] Adding ${productId} [${i + 1} of ${quantity}]`);
      await addToCartViaIframe(productId);
    }
  }

  console.log("[MetaShops] All products processed. Redirecting to cart...");
  setTimeout(() => {
    window.location.href = "/ShoppingCart.aspx";
  }, 1000);
});

function addToCartViaIframe(productId) {
  return new Promise((resolve) => {
    console.log(`[MetaShops] Creating iframe for product ${productId}...`);

    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = `/ProductDetail.aspx?pid=${productId}`;

    iframe.onload = () => {
      console.log(`[MetaShops] Iframe loaded for ${productId}`);

      try {
        const button = iframe.contentWindow.document.querySelector("#ctl00_PageBody_productDetail_ctl00_AddProductButton");
        if (button) {
          console.log(`[MetaShops] Add to Cart button found for ${productId}. Clicking...`);
          button.click();
        } else {
          console.warn(`[MetaShops] Add to Cart button NOT FOUND for ${productId}`);
        }
      } catch (e) {
        console.error(`[MetaShops] Error accessing iframe content for ${productId}:`, e);
      }

      setTimeout(() => {
        console.log(`[MetaShops] Cleaning up iframe for ${productId}`);
        iframe.remove();
        resolve();
      }, 750);
    };

    iframe.onerror = () => {
      console.error(`[MetaShops] Failed to load iframe for ${productId}`);
      resolve();
    };

    document.body.appendChild(iframe);
  });
}

