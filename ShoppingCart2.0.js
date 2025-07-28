
document.addEventListener("DOMContentLoaded", function () {
  const originalCartPanel = document.getElementById("ctl00_PageBody_ShoppingCartDetailPanel");
  if (!originalCartPanel) return;

  // Step 1: Hide the original panel
  originalCartPanel.style.display = "none";

  // Step 2: Build custom cart container
  const customCart = document.createElement("div");
  customCart.id = "customCart";
  customCart.style.margin = "2rem 0";
  customCart.style.padding = "1rem";
  customCart.style.background = "#f8f8f8";
  customCart.style.borderRadius = "8px";

  // Step 3: Locate all cart rows
  const cartRows = originalCartPanel.querySelectorAll(".row.shopping-cart-item");
  cartRows.forEach(row => {
    const productImage = row.querySelector("img.ThumbnailImage")?.src || '';
    const productLink = row.querySelector("a.portalGridLink")?.closest('a')?.href || '#';
    const productCode = row.querySelector("a.portalGridLink")?.innerText || '';
    const productName = row.querySelector("a.portalGridLink")?.parentElement?.nextElementSibling?.innerText?.trim() || '';
    const stockStatus = row.querySelector(".col-sm-6 div:nth-child(2) div")?.innerText?.trim() || '';
    const price = row.querySelector(".col-6")?.innerText?.trim().split("ea")[0] || '';
    const qtyInput = row.querySelector("input.riTextBox");
    const total = row.querySelector(".col-sm-3")?.innerText?.trim() || '';
    const deleteBtn = row.querySelector("a i.fas.fa-times");

    // Get the postback command for delete
    const deleteHref = deleteBtn?.parentElement?.getAttribute("href");

    const wrapper = document.createElement("div");
    wrapper.className = "custom-cart-item";
    wrapper.style.display = "flex";
    wrapper.style.flexWrap = "wrap";
    wrapper.style.gap = "16px";
    wrapper.style.marginBottom = "24px";
    wrapper.style.borderBottom = "1px solid #ccc";
    wrapper.style.paddingBottom = "12px";

    wrapper.innerHTML = `
      <img src="${productImage}" style="width: 80px; height: auto; border-radius: 4px;">
      <div style="flex: 1;">
        <a href="${productLink}" style="font-weight: bold; color: #0066cc;">${productCode}</a><br>
        <div>${productName}</div>
        <div style="color: green;">${stockStatus}</div>
        <div style="margin-top: 8px;">
          <strong>${price}</strong> ea × 
          <input type="number" value="${qtyInput.value}" style="width: 60px;" 
                 data-update-btn="${row.querySelector("a.refresh-cart-line-total")?.id}"
                 oninput="document.getElementById(this.dataset.updateBtn).click()">
          = <strong>${total}</strong>
          <a href="${deleteHref}" onclick="event.preventDefault(); eval(this.getAttribute('data-postback'));" 
             data-postback="${deleteHref.replace('javascript:', '')}" 
             style="color: red; margin-left: 10px;">✕ Remove</a>
        </div>
      </div>
    `;
    customCart.appendChild(wrapper);
  });

  // Step 4: Insert custom cart before the original one
  originalCartPanel.parentElement.insertBefore(customCart, originalCartPanel);
});
