document.addEventListener("DOMContentLoaded", function () {
  // 🔧 Create and inject modal
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
  <div style="display: flex; justify-content: flex-end; gap: 10px;">
    <a href="/ShoppingCart.aspx" style="text-decoration: none;">
      <button style="background:#6b0016; color:white; border:none; padding:8px 14px; border-radius:5px; cursor:pointer;">
        View Cart
      </button>
    </a>
    <a href="/Checkout.aspx" style="text-decoration: none;">
      <button style="background:#007b00; color:white; border:none; padding:8px 14px; border-radius:5px; cursor:pointer;">
        Checkout
      </button>
    </a>
  </div>
  <div style="text-align:center; margin-top:10px;">
    <button id="customCartCloseBtn" style="background:none; border:none; color:#666; text-decoration:underline; cursor:pointer;">Keep Shopping</button>
  </div>
`;

  document.body.appendChild(modal);

  document.getElementById("customCartCloseBtn").onclick = () => {
    modal.style.display = "none";
  };

  // 🔍 Watch for the productAddedMessage to appear
  const observer = new MutationObserver(() => {
    const message = document.querySelector(".productAddedMessage");
    if (message && message.offsetParent !== null) {
      message.style.display = "none";

      setTimeout(() => {
        showCustomCartModal();
      }, 500); // Give the cart time to update
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // 🎯 Function to show custom modal
  function showCustomCartModal() {
  fetch("/ShoppingCart.aspx")
    .then(res => res.text())
    .then(html => {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;

      // Get subtotal
      const subtotalEl = tempDiv.querySelector(".SubtotalWrapper");
      const subtotalText = subtotalEl ? subtotalEl.textContent.match(/\$[\d,.]+/)?.[0] : "—";
      document.getElementById("cartSubtotal").innerHTML = `Subtotal: ${subtotalText}`;

      // Get cart items
      const items = tempDiv.querySelectorAll(".shopping-cart-item");
      const previewContainer = document.getElementById("cartItemsPreview");
      previewContainer.innerHTML = "";

      items.forEach((item, i) => {
        if (i >= 3) return; // limit preview to 3 items
        const img = item.querySelector("img")?.src || "";
        const name = item.querySelector("a span.portalGridLink")?.textContent || "";
        const desc = item.querySelector("div > div:nth-child(3) > div")?.textContent || "";
        const price = item.querySelector(".col-6")?.textContent?.trim() || "";

        const itemHTML = `
          <div style="display:flex; align-items:center; margin-bottom:10px;">
            <img src="${img}" alt="" style="width:50px; height:50px; object-fit:cover; margin-right:10px;">
            <div>
              <strong>${name}</strong><br>
              <small>${desc}</small><br>
              <span>${price}</span>
            </div>
          </div>`;
        previewContainer.innerHTML += itemHTML;
      });

      // Show the modal after data is ready
      document.getElementById("customCartModal").style.display = "block";
    })
    .catch(err => {
      console.error("Failed to fetch cart data:", err);
      document.getElementById("cartSubtotal").innerHTML = "Subtotal: unavailable";
      document.getElementById("customCartModal").style.display = "block";
    });
}

});

