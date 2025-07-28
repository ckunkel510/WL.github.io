
document.addEventListener("DOMContentLoaded", function () {
  // 🧠 Find the <tr> that wraps .productAddedMessage
  const messageSpan = document.querySelector(".productAddedMessage");
  let parentRow = messageSpan?.closest("tr");
  let lastDisplay = parentRow ? getComputedStyle(parentRow).display : "none";

  if (!parentRow) return; // bail if we can't find the container

  // 🧠 Inject Modal
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

  // Close and hide original row
  document.getElementById("customCartCloseBtn").onclick = () => {
    modal.style.display = "none";
    parentRow.style.display = "none";
  };

  // Trigger postback like real Place Order
  document.getElementById("customCheckoutBtn").onclick = () => {
    __doPostBack("ctl00$PageBody$PlaceOrderButton", "");
  };

  // Watch for style change on the <tr>
  const observer = new MutationObserver(() => {
    const currentDisplay = getComputedStyle(parentRow).display;
    if (lastDisplay === "none" && currentDisplay !== "none") {
      lastDisplay = currentDisplay;
      parentRow.style.display = "none";
      showCustomCartModal();
    } else {
      lastDisplay = currentDisplay;
    }
  });

  observer.observe(parentRow, { attributes: true, attributeFilter: ["style"] });

  // Fetch cart data from ShoppingCart.aspx
  function showCustomCartModal() {
    fetch("/ShoppingCart.aspx")
      .then(res => res.text())
      .then(html => {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = html;

        const subtotalEl = tempDiv.querySelector(".SubtotalWrapper");
        const subtotalText = subtotalEl ? subtotalEl.textContent.match(/\$[\d,.]+/)?.[0] : "—";
        document.getElementById("cartSubtotal").innerHTML = `Subtotal: ${subtotalText}`;

        const items = tempDiv.querySelectorAll(".shopping-cart-item");
        const previewContainer = document.getElementById("cartItemsPreview");
        previewContainer.innerHTML = "";

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

        document.getElementById("customCartModal").style.display = "block";
      })
      .catch(err => {
        console.error("Failed to fetch cart:", err);
        document.getElementById("cartSubtotal").innerHTML = "Subtotal: unavailable";
        document.getElementById("customCartModal").style.display = "block";
      });
  }
});
