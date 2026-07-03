
document.addEventListener("DOMContentLoaded", function () {
  console.log("[CartModal] DOMContentLoaded ✅");

  // ✅ Step 1: Hook into your exact Add to Cart button
  const addToCartButton = document.querySelector("#ctl00_PageBody_productDetail_ctl00_AddProductButton");

  if (addToCartButton) {
    console.log("[CartModal] Add to Cart button found 🎯");

    addToCartButton.addEventListener("click", () => {
      console.log("[CartModal] Add to Cart clicked – setting session flag");
      sessionStorage.setItem("showAddToCartModal", "true");
    });
  } else {
    console.warn("[CartModal] Add to Cart button NOT FOUND ❌");
  }



  // ✅ Step 2: Check if we should show modal
  const modalFlag = sessionStorage.getItem("showAddToCartModal");
  console.log("[CartModal] Modal flag is:", modalFlag);

  if (modalFlag === "true") {
    sessionStorage.removeItem("showAddToCartModal");
    console.log("[CartModal] Flag detected – triggering modal load");
    setTimeout(() => {
      showCustomCartModal();
    }, 500);
  }

  // ✅ Step 3: Inject modal structure
  const modal = document.createElement("div");
  modal.id = "customCartModal";
  modal.style.cssText = `
    display: none;
    position: fixed;
    top: 10%;
    left: 50%;
    transform: translateX(-50%);
    background: white;
    padding: 20px;
    z-index: 10000;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 0 15px rgba(0,0,0,0.3);
    border-radius: 10px;
    font-family: sans-serif;
  `;
  modal.innerHTML = `
    <h3 style="margin-top: 0;">🛒 Added to Cart!</h3>
    <div id="cartSubtotal" style="font-weight:bold; margin-bottom:10px;"></div>
    <div id="cartItemsPreview" style="margin-bottom:15px;"></div>
    <div style="display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap;">
      <a href="/ShoppingCart.aspx" style="text-decoration: none;">
        <button style="background:#6b0016; color:white; border:none; padding:8px 14px; border-radius:5px; cursor:pointer;">
          View Cart
        </button>
      </a>
      <button id="customCheckoutBtn" style="background:#007b00; color:white; border:none; padding:8px 14px; border-radius:5px; cursor:pointer;">
        Checkout
      </button>
    </div>
    <div style="text-align:center; margin-top:10px;">
      <button id="customCartCloseBtn" style="background:none; border:none; color:#666; text-decoration:underline; cursor:pointer;">Keep Shopping</button>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById("customCartCloseBtn").onclick = () => {
    console.log("[CartModal] Keep Shopping clicked – closing modal");
    modal.style.display = "none";
  };

  document.getElementById("customCheckoutBtn").onclick = () => {
  console.log("[CartModal] Checkout clicked – setting flag & redirecting");
  sessionStorage.setItem("triggerPlaceOrder", "true");
  window.location.href = "/ShoppingCart.aspx";
};


  // ✅ Step 4: Fetch cart data and show modal
  function showCustomCartModal() {
    console.log("[CartModal] Fetching cart from /ShoppingCart.aspx");

    fetch("/ShoppingCart.aspx")
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then(html => {
        console.log("[CartModal] Cart page fetched successfully");
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = html;

        const subtotalEl = tempDiv.querySelector(".SubtotalWrapper");
        const subtotalText = subtotalEl ? subtotalEl.textContent.match(/\$[\d,.]+/)?.[0] : "—";
        document.getElementById("cartSubtotal").innerHTML = `Subtotal: ${subtotalText}`;
        console.log("[CartModal] Subtotal parsed:", subtotalText);

        const items = tempDiv.querySelectorAll(".shopping-cart-item");
        const previewContainer = document.getElementById("cartItemsPreview");
        previewContainer.innerHTML = "";
        console.log(`[CartModal] Found ${items.length} cart items`);

        items.forEach((item, i) => {
          if (i >= 3) return;
          const img = item.querySelector("img")?.src || "";
          const name = item.querySelector("a span.portalGridLink")?.textContent || "";
          const desc = item.querySelector("div > div:nth-child(3) > div")?.textContent || "";
          const price = item.querySelector(".col-6")?.textContent?.trim() || "";

          if (img || name || price) {
  previewContainer.innerHTML += `
    <div style="display:flex; align-items:center; margin-bottom:10px;">
      ${img ? `<img src="${img}" alt="" style="width:50px; height:50px; object-fit:cover; margin-right:10px;">` : ''}
      <div>
        ${name ? `<strong>${name}</strong><br>` : ''}
        ${desc ? `<small>${desc}</small><br>` : ''}
        ${price ? `<span>${price}</span>` : ''}
      </div>
    </div>`;
}

        });

        modal.style.display = "block";
        console.log("[CartModal] Modal shown ✅");
      })
      .catch(err => {
        console.error("[CartModal] Failed to fetch cart:", err);
        document.getElementById("cartSubtotal").innerHTML = "Subtotal: unavailable";
        modal.style.display = "block";
      });
  }
});

/* Temporary WDoor bridge: bypasses WebTrack's broken SpecialOrder.aspx wrapper. */
(function setupWoodsonSpecialOrderBridge() {
  "use strict";

  var PRODUCT_ID = "245809";
  var PRODUCT_CODE = "WDoor";
  var CONFIGURATOR_ORIGIN = "https://wl-upsrates.vercel.app";
  var CONFIGURATOR_URL = CONFIGURATOR_ORIGIN + "/api/special-order-designer";
  var SPECIAL_ORDER_BUTTON_ID = "ctl00_PageBody_productDetail_ctl00_btnSpecialOrder";
  var DESCRIPTION_FIELD_ID = "ctl00_PageBody_productDetail_ctl00_txtSpecialProductDescription";
  var CODE_FIELD_ID = "ctl00_PageBody_productDetail_ctl00_txtSpecialProductCode";
  var QUANTITY_FIELD_ID = "ctl00_PageBody_productDetail_ctl00_qty_" + PRODUCT_ID;
  var ADD_BUTTON_TARGET = "ctl00$PageBody$productDetail$ctl00$AddProductButton";
  var overlay = null;
  var frame = null;
  var previousBodyOverflow = "";

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  function isTargetProduct() {
    var params = new URLSearchParams(window.location.search);
    return /\/ProductDetail\.aspx$/i.test(window.location.pathname) && params.get("pid") === PRODUCT_ID;
  }

  function closeConfigurator() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    frame = null;
    document.body.style.overflow = previousBodyOverflow;
  }

  function showBridgeError(message) {
    if (!overlay) return;
    var status = overlay.querySelector(".wl-special-order-status");
    if (status) {
      status.textContent = message;
      status.hidden = false;
    }
  }

  function openConfigurator(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (overlay) return false;

    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    overlay = document.createElement("div");
    overlay.className = "wl-special-order-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Configure special order");
    overlay.innerHTML = [
      '<div class="wl-special-order-shell">',
      '  <div class="wl-special-order-toolbar">',
      '    <strong>Configure special order</strong>',
      '    <button class="wl-special-order-close" type="button" aria-label="Close configurator" title="Close">&times;</button>',
      "  </div>",
      '  <p class="wl-special-order-status" role="alert" hidden></p>',
      '  <iframe class="wl-special-order-frame" title="Woodson special order configurator"></iframe>',
      "</div>"
    ].join("");
    document.body.appendChild(overlay);

    overlay.querySelector(".wl-special-order-close").addEventListener("click", closeConfigurator);
    overlay.addEventListener("click", function (overlayEvent) {
      if (overlayEvent.target === overlay) closeConfigurator();
    });

    frame = overlay.querySelector(".wl-special-order-frame");
    frame.src = CONFIGURATOR_URL + "?productid=" + encodeURIComponent(PRODUCT_ID) +
      "&productcode=" + encodeURIComponent(PRODUCT_CODE) + "&qty=1&bridge=1";
    return false;
  }

  function ensureQuantityField(quantity) {
    var field = document.getElementById(QUANTITY_FIELD_ID);
    if (!field) {
      field = document.createElement("input");
      field.type = "hidden";
      field.id = QUANTITY_FIELD_ID;
      field.name = "ctl00$PageBody$productDetail$ctl00$qty_" + PRODUCT_ID;
      var form = document.forms[0];
      if (!form) throw new Error("The WebTrack order form is unavailable.");
      form.appendChild(field);
    }
    field.value = String(quantity);
    return field;
  }

  function handleConfiguratorMessage(event) {
    if (event.origin !== CONFIGURATOR_ORIGIN || !frame || event.source !== frame.contentWindow) return;
    var data = event.data || {};
    if (data.type !== "woodson-special-order-complete" || data.version !== 1) return;
    if (String(data.productId) !== PRODUCT_ID || String(data.productCode) !== PRODUCT_CODE) {
      showBridgeError("This configuration does not match the product page. Please close it and try again.");
      return;
    }

    var configurationId = String(data.sID || "").trim().slice(0, 120);
    var description = String(data.sDescription || "").trim().slice(0, 500);
    var quantity = Math.max(1, Math.min(99, parseInt(data.iQty, 10) || 1));
    var descriptionField = document.getElementById(DESCRIPTION_FIELD_ID);
    var codeField = document.getElementById(CODE_FIELD_ID);

    if (!configurationId || !description || !descriptionField || !codeField) {
      showBridgeError("WebTrack could not receive this configuration. Please close it and try again.");
      return;
    }

    try {
      ensureQuantityField(quantity);
      descriptionField.value = description;
      codeField.value = configurationId;
      sessionStorage.setItem("showAddToCartModal", "true");

      if (typeof window.__doPostBack !== "function") {
        throw new Error("WebTrack's cart action is unavailable.");
      }
      var status = overlay && overlay.querySelector(".wl-special-order-status");
      if (status) {
        status.textContent = "Adding this configured item to your cart...";
        status.hidden = false;
      }
      window.__doPostBack(ADD_BUTTON_TARGET, "");
    } catch (error) {
      console.error("[SpecialOrderBridge] Add to cart failed", error);
      showBridgeError(error && error.message ? error.message : "The item could not be added to the cart.");
    }
  }

  function injectStyles() {
    if (document.getElementById("wl-special-order-bridge-styles")) return;
    var style = document.createElement("style");
    style.id = "wl-special-order-bridge-styles";
    style.textContent = [
      ".wl-special-order-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.58);font-family:Arial,sans-serif}",
      ".wl-special-order-shell{display:flex;flex-direction:column;width:min(760px,100%);height:min(720px,calc(100vh - 36px));overflow:hidden;border:1px solid #bbb;border-radius:8px;background:#fff;box-shadow:0 18px 60px rgba(0,0,0,.35)}",
      ".wl-special-order-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:54px;padding:8px 10px 8px 18px;border-bottom:1px solid #d7d9dc;color:#171717;font-size:17px}",
      ".wl-special-order-close{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;padding:0;border:1px solid #aaa;border-radius:4px;background:#fff;color:#222;font:30px/1 Arial,sans-serif;cursor:pointer}",
      ".wl-special-order-close:hover{background:#f0f1f2}",
      ".wl-special-order-status{margin:0;padding:10px 16px;border-bottom:1px solid #e3b2bc;background:#fff1f4;color:#6b0016;font-weight:700}",
      ".wl-special-order-frame{width:100%;height:100%;border:0;background:#f4f5f6}",
      "@media(max-width:600px){.wl-special-order-overlay{padding:0}.wl-special-order-shell{width:100%;height:100%;border:0;border-radius:0}.wl-special-order-toolbar{min-height:58px}}"
    ].join("");
    document.head.appendChild(style);
  }

  onReady(function () {
    if (!isTargetProduct()) return;
    var button = document.getElementById(SPECIAL_ORDER_BUTTON_ID);
    if (!button || button.dataset.wlConfiguratorBridge === "1") return;
    injectStyles();
    button.dataset.wlConfiguratorBridge = "1";
    button.addEventListener("click", openConfigurator, true);
    window.addEventListener("message", handleConfiguratorMessage);
  });
})();


document.addEventListener("DOMContentLoaded", function () {
  const shouldTrigger = sessionStorage.getItem("triggerPlaceOrder");
  if (shouldTrigger === "true") {
    sessionStorage.removeItem("triggerPlaceOrder");
    console.log("[CartModal] Triggering Place Order button automatically");

    // Wait for DOM and WebForms JS to initialize
    setTimeout(() => {
      const placeOrderButton = document.querySelector("#ctl00_PageBody_PlaceOrderButton");
      if (placeOrderButton) {
        placeOrderButton.click();
        console.log("[CartModal] Place Order button clicked ✅");
      } else {
        console.warn("[CartModal] Place Order button not found ❌");
      }
    }, 500);
  }
});
