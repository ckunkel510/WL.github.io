
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
    console.log(`[MetaShops] Adding product ${productId} with quantity ${quantity}...`);
    await addToCartViaIframe(productId, quantity);
  }

  console.log("[MetaShops] All products processed. Redirecting to cart...");
  setTimeout(() => {
    window.location.href = "/ShoppingCart.aspx";
  }, 1000);
});

function addToCartViaIframe(productId, quantity) {
  return new Promise((resolve) => {
    console.log(`[MetaShops] Creating iframe for product ${productId}...`);

    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = `/ProductDetail.aspx?pid=${productId}`;

    iframe.onload = () => {
      console.log(`[MetaShops] Iframe loaded for ${productId}`);

      try {
        const doc = iframe.contentWindow.document;

        const qtyInputId = `ctl00_PageBody_productDetail_ctl00_qty_${productId}`;
        const qtyInput = doc.getElementById(qtyInputId);

        if (qtyInput) {
  qtyInput.value = quantity;

  // Dispatch events to simulate a real user interaction
  qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
  qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
  qtyInput.dispatchEvent(new Event('blur'));

  console.log(`[MetaShops] Set quantity ${quantity} on input ${qtyInputId} and dispatched events`);
}
 else {
          console.warn(`[MetaShops] Quantity input NOT FOUND for ${productId} (expected id: ${qtyInputId})`);
        }

        const button = doc.querySelector("#ctl00_PageBody_productDetail_ctl00_AddProductButton");
        if (button) {
          console.log(`[MetaShops] Clicking Add to Cart button for ${productId}`);
          button.click();
        } else {
          console.warn(`[MetaShops] Add to Cart button NOT FOUND for ${productId}`);
        }

      } catch (e) {
        console.error(`[MetaShops] Error processing iframe for ${productId}:`, e);
      }

      setTimeout(() => {
        console.log(`[MetaShops] Cleaning up iframe for ${productId}`);
        iframe.remove();
        resolve();
      }, 1000); // Delay to ensure click registers
    };

    iframe.onerror = () => {
      console.error(`[MetaShops] Failed to load iframe for ${productId}`);
      resolve();
    };

    document.body.appendChild(iframe);
  });
}

