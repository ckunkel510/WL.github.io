
document.addEventListener("DOMContentLoaded", function () {
  const panel = document.getElementById("ctl00_PageBody_ShoppingCartDetailPanel");
  if (!panel) return;

  // Hide original layout
  panel.style.display = "none";

  // Build custom layout container
  const customCart = document.createElement("div");
  customCart.id = "customCartLayout";
  customCart.style.cssText = "padding: 20px; font-family: sans-serif;";

  // Heading
  customCart.innerHTML = "<h2>Your Cart</h2>";

  // Loop through existing items
  const items = document.querySelectorAll(".shopping-cart-item");
  items.forEach((item, i) => {
    const img = item.querySelector("img")?.src || "";
    const code = item.querySelector(".portalGridLink")?.textContent || "";
    const desc = item.querySelectorAll("div")[7]?.textContent?.trim() || "";
    const location = item.querySelectorAll("div")[13]?.textContent?.trim() || "";
    const stock = item.querySelectorAll("div")[15]?.textContent?.trim() || "";
    const price = item.querySelectorAll(".col-6")[0]?.textContent?.trim() || "";
    const qtyInput = item.querySelector("input[type='text']");
    const qty = qtyInput?.value || "";
    const total = item.querySelectorAll(".col-12.col-sm-3")[0]?.innerText.trim().split("\n")[1] || "";

    const updateLink = item.querySelector("a[id*='refQty_']")?.outerHTML || "";
    const deleteLink = item.querySelector("a[id*='del_']")?.outerHTML || "";

    const row = document.createElement("div");
    row.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 15px 0; border-bottom: 1px solid #ccc; flex-wrap: wrap;";
    row.innerHTML = `
      <div style="display:flex; align-items:center; flex:1; min-width:250px;">
        <img src="${img}" alt="" style="width:60px; height:60px; object-fit:cover; margin-right:10px;">
        <div>
          <strong>${desc}</strong><br>
          <small>${code} – ${location} (${stock})</small>
        </div>
      </div>
      <div style="text-align:right; min-width:200px;">
        <div>Price: ${price}</div>
        <div>Qty: <input style="width:60px;" value="${qty}" disabled></div>
        <div>Total: <strong>${total}</strong></div>
        <div style="margin-top:5px;">${updateLink} ${deleteLink}</div>
      </div>
    `;
    customCart.appendChild(row);
  });

  // Add subtotal
  const subtotal = document.querySelector(".SubtotalWrapper")?.textContent.match(/\$[\d,.]+/)?.[0] || "—";
  const summary = document.createElement("div");
  summary.style.cssText = "text-align:right; font-size:18px; margin-top:20px;";
  summary.innerHTML = `<strong>Subtotal:</strong> ${subtotal}`;
  customCart.appendChild(summary);

  // Add action buttons
  const actions = document.createElement("div");
  actions.style.cssText = "display:flex; justify-content:flex-end; gap:10px; margin-top:20px;";
  actions.innerHTML = `
    <a href="javascript:WebForm_DoPostBackWithOptions(new WebForm_PostBackOptions('ctl00$PageBody$PlaceOrderButton', '', true, '', '', false, true))">
      <button style="background:#007b00; color:white; border:none; padding:10px 20px; border-radius:4px;">Place Order</button>
    </a>
    <a href="/ProductDetail.aspx?pid=6750">
      <button style="background:#6b0016; color:white; border:none; padding:10px 20px; border-radius:4px;">Shop More</button>
    </a>
  `;
  customCart.appendChild(actions);

  // Add to page
  panel.parentNode.insertBefore(customCart, panel.nextSibling);
});

