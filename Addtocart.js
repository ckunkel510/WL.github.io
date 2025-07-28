
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

          previewContainer.innerHTML += `
            <div style="display:flex; align-items:center; margin-bottom:10px;">
              <img src="${img}" alt="" style="width:50px; height:50px; object-fit:cover; margin-right:10px;">
              <div>
                <strong>${name}</strong><br>
                <small>${desc}</small><br>
                <span>${price}</span>
              </div>
            </div>`;
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

