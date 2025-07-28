
document.addEventListener("DOMContentLoaded", function () {
  const panel = document.getElementById("ctl00_PageBody_ShoppingCartDetailPanel");
  if (!panel) return;

  panel.style.display = "none";

  const customCart = document.createElement("div");
  customCart.id = "customCartLayout";
  customCart.style.cssText = "padding: 20px; font-family: sans-serif; max-width: 1000px; margin: 0 auto;";

  // Location (fake fallback for now)
  const locationName = sessionStorage.getItem("preferredStoreName") || "Caldwell";
  const locationNotice = document.createElement("div");
  locationNotice.innerHTML = `<p style="font-size: 16px; margin-bottom: 20px;">🛒 You are shopping: <strong>${locationName}</strong></p>`;
  customCart.appendChild(locationNotice);

  // Heading
  const heading = document.createElement("h2");
  heading.textContent = "Your Cart";
  customCart.appendChild(heading);

  // Cart rows
  const items = document.querySelectorAll(".shopping-cart-item");
  items.forEach((item) => {
    const img = item.querySelector("img")?.src || "";
    const productLinkEl = item.querySelector("a.portalGridLink");
    const productURL = productLinkEl?.href || "#";
    const productCode = productLinkEl?.textContent.trim() || "";
    const desc = item.querySelectorAll("div")[7]?.textContent?.trim() || "";
    const price = item.querySelectorAll(".col-6")[0]?.textContent?.trim() || "";
    const qtyInput = item.querySelector("input[type='text']");
    const qtyVal = qtyInput?.value || "";
    const qtyID = qtyInput?.id || "";
    const updateID = item.querySelector("a[id*='refQty_']")?.id || "";
    const total = item.querySelectorAll(".col-12.col-sm-3")[0]?.innerText.trim().split("\n")[1] || "";

    const row = document.createElement("div");
    row.style.cssText = `
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      align-items: center;
      padding: 15px 0;
      border-bottom: 1px solid #ccc;
    `;

    row.innerHTML = `
      <div style="display: flex; align-items: center; flex: 1; min-width: 250px;">
        <a href="${productURL}" style="display:inline-block; margin-right:10px;">
          <img src="${img}" alt="${desc}" style="width: 60px; height: 60px; object-fit: cover;">
        </a>
        <div>
          <a href="${productURL}" style="text-decoration: none; color: #000;">
            <strong>${desc}</strong><br>
            <small>${productCode}</small>
          </a>
        </div>
      </div>
      <div style="text-align: right; min-width: 220px;">
        <div>Price: ${price}</div>
        <div>
          Qty:
          <input id="${qtyID}" value="${qtyVal}" style="width: 60px;" onchange="document.getElementById('${updateID}').click()">
        </div>
        <div>Total: <strong>${total}</strong></div>
      </div>
    `;

    customCart.appendChild(row);
  });

  // Subtotal
  const subtotal = document.querySelector(".SubtotalWrapper")?.textContent.match(/\$[\d,.]+/)?.[0] || "—";
  const summary = document.createElement("div");
  summary.style.cssText = "text-align: right; font-size: 18px; margin-top: 20px;";
  summary.innerHTML = `<strong>Subtotal:</strong> ${subtotal}`;
  customCart.appendChild(summary);

  // Action buttons
  const actions = document.createElement("div");
  actions.style.cssText = "display: flex; justify-content: space-between; margin-top: 20px;";

  const shopMore = document.createElement("a");
  shopMore.href = "/ProductDetail.aspx?pid=6750"; // You can swap this with a dynamic best-seller or category
  shopMore.innerHTML = `<button style="background:#6b0016; color:white; border:none; padding:10px 20px; border-radius:4px;">Shop More</button>`;

  const placeOrderBtn = document.createElement("button");
  placeOrderBtn.textContent = "Place Order";
  placeOrderBtn.style.cssText = "background:#007b00; color:white; border:none; padding:10px 20px; border-radius:4px;";
  placeOrderBtn.onclick = function () {
    const originalBtn = document.getElementById("ctl00_PageBody_PlaceOrderButton");
    if (originalBtn) originalBtn.click();
  };

  actions.appendChild(shopMore);
  actions.appendChild(placeOrderBtn);
  customCart.appendChild(actions);

  // Inject
  panel.parentNode.insertBefore(customCart, panel.nextSibling);
});

