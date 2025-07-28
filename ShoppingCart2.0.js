
document.addEventListener("DOMContentLoaded", function () {
  const panel = document.getElementById("ctl00_PageBody_ShoppingCartDetailPanel");
  if (!panel) return;

  // Hide the original layout
  panel.style.display = "none";

  // Create new custom cart container
  const customCart = document.createElement("div");
  customCart.id = "customCartLayout";
  customCart.style.cssText = "padding: 20px; font-family: sans-serif; max-width: 1000px; margin: 0 auto;";

  // Placeholder for store location (can replace with real logic later)
  const locationName = sessionStorage.getItem("preferredStoreName") || "Caldwell"; // Example fallback
  const locationNotice = document.createElement("div");
  locationNotice.innerHTML = `<p style="font-size: 16px; margin-bottom: 20px;">🛒 You are shopping: <strong>${locationName}</strong></p>`;
  customCart.appendChild(locationNotice);

  // Heading
  customCart.innerHTML += "<h2>Your Cart</h2>";

  // Loop through cart items
  const items = document.querySelectorAll(".shopping-cart-item");
  items.forEach((item) => {
    const img = item.querySelector("img")?.src || "";
    const productLinkEl = item.querySelector("a.portalGridLink")?.closest("a");
    const productURL = productLinkEl?.href || "#";
    const productCode = item.querySelector(".portalGridLink")?.textContent || "";
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
        <a href="${productURL}">
          <img src="${img}" alt="${desc}" style="width: 60px; height: 60px; object-fit: cover; margin-right: 10px;">
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
        <div style="display: none;">Update link exists but hidden</div>
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
  actions.style.cssText = "display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;";
  actions.innerHTML = `
    <a href="javascript:WebForm_DoPostBackWithOptions(new WebForm_PostBackOptions('ctl00$PageBody$PlaceOrderButton', '', true, '', '', false, true))">
      <button style="background:#007b00; color:white; border:none; padding:10px 20px; border-radius:4px;">Place Order</button>
    </a>
    <a href="/ProductDetail.aspx?pid=6750">
      <button style="background:#6b0016; color:white; border:none; padding:10px 20px; border-radius:4px;">Shop More</button>
    </a>
  `;
  customCart.appendChild(actions);

  // Inject the new layout after the original one
  panel.parentNode.insertBefore(customCart, panel.nextSibling);
});

