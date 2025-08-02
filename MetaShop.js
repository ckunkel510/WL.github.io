
document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const cartOrigin = params.get("cart_origin");
  const productsParam = params.get("products");

  if (cartOrigin !== "meta_shops" || !productsParam) return;
  if (sessionStorage.getItem("metaCartBuilt")) return;

  // ✅ Show modal before doing anything
  showMetaCartModal();

  sessionStorage.setItem("metaCartBuilt", "true");

  const productEntries = productsParam.split(",");
  const products = productEntries.map(entry => {
    const [id, qty] = entry.split(":");
    const parsedQty = parseInt(qty || "1", 10);
    return { productId: id, quantity: parsedQty };
  });

  console.log(`[MetaShops] Starting cart build for ${products.length} product(s)...`);

  for (const { productId, quantity } of products) {
    console.log(`[MetaShops] Adding product ${productId} with quantity ${quantity}...`);
    await addToCartViaIframe(productId, quantity);
  }

  console.log("[MetaShops] All products processed. Redirecting to cart...");
  removeMetaCartModal();
  setTimeout(() => {
    window.location.href = "/ShoppingCart.aspx";
  }, 1000);
});

function addToCartViaIframe(productId, quantity) {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = `/ProductDetail.aspx?pid=${productId}`;

    iframe.onload = () => {
      try {
        const doc = iframe.contentWindow.document;
        const qtyInputId = `ctl00_PageBody_productDetail_ctl00_qty_${productId}`;
        const qtyInput = doc.getElementById(qtyInputId);

        if (qtyInput) {
          qtyInput.value = quantity;
          qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
          qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
          qtyInput.dispatchEvent(new Event('blur'));
        }

        const button = doc.querySelector("#ctl00_PageBody_productDetail_ctl00_AddProductButton");
        if (button) {
          button.click();
        }
      } catch (e) {
        console.error(`[MetaShops] Error processing iframe for ${productId}:`, e);
      }

      setTimeout(() => {
        iframe.remove();
        resolve();
      }, 1000);
    };

    iframe.onerror = () => {
      console.error(`[MetaShops] Failed to load iframe for ${productId}`);
      resolve();
    };

    document.body.appendChild(iframe);
  });
}

function showMetaCartModal() {
  const modal = document.createElement("div");
  modal.id = "metaCartModal";
  modal.innerHTML = `
    <div style="background: white; border-radius: 8px; padding: 2rem; max-width: 500px; width: 90%; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-family: sans-serif;">
      <h2 style="color: #6b0016; margin-bottom: 1rem;">Building Your Cart</h2>
      <p style="font-size: 1rem; color: #333;">We’re adding your selected items from Facebook into your cart.</p>
      <p style="font-size: 0.9rem; color: #666; margin-top: 1rem;">Please allow us just a few moments. Your cart will be ready shortly!</p>
      <div style="margin-top: 1.5rem;">
        <div class="loader" style="margin: 0 auto; width: 36px; height: 36px; border: 4px solid #eee; border-top: 4px solid #6b0016; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      </div>
    </div>
  `;
  modal.style.position = "fixed";
  modal.style.top = 0;
  modal.style.left = 0;
  modal.style.width = "100vw";
  modal.style.height = "100vh";
  modal.style.backgroundColor = "rgba(255,255,255,0.9)";
  modal.style.zIndex = "9999";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";

  // Add CSS animation
  const style = document.createElement("style");
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(modal);
}

function removeMetaCartModal() {
  const modal = document.getElementById("metaCartModal");
  if (modal) modal.remove();
}
