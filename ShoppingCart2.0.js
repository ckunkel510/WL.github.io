
window.addEventListener("load", function () {
  const originalCartPanel = document.getElementById("ctl00_PageBody_ShoppingCartDetailPanel");
  if (!originalCartPanel) return;

  originalCartPanel.style.display = "none";

  const customCart = document.createElement("div");
  customCart.id = "customCart";
  customCart.style.margin = "2rem 0";
  customCart.style.padding = "1rem";
  customCart.style.background = "#f8f8f8";
  customCart.style.borderRadius = "8px";

  let subtotal = 0;
  const cartRows = originalCartPanel.querySelectorAll(".row.shopping-cart-item");
  cartRows.forEach(row => {
    const productImage = row.querySelector("img.ThumbnailImage")?.src || '';
    const productLink = row.querySelector("a.portalGridLink")?.closest('a')?.href || '#';
    const productCode = row.querySelector("a.portalGridLink")?.innerText || '';
    const productName = row.querySelector("a.portalGridLink")?.parentElement?.nextElementSibling?.innerText?.trim() || '';
    const stockStatus = row.querySelector(".col-sm-6 div:nth-child(2) div")?.innerText?.trim() || '';
    const price = row.querySelector(".col-6")?.innerText?.trim().split("ea")[0].replace("$", "").trim() || '';
    const qtyInput = row.querySelector("input.riTextBox");
    const deleteBtn = row.querySelector("a i.fas.fa-times");
    const updateBtn = row.querySelector("a.refresh-cart-line-total");

    if (!qtyInput || !updateBtn) return;

    const deleteHref = deleteBtn?.parentElement?.getAttribute("href") || '';

    // ✅ NEW FIXED: Extract total price using regex
    const totalMatch = row.querySelector(".col-sm-3")?.textContent?.match(/\$([\d,.]+)/);
    const totalVal = totalMatch ? parseFloat(totalMatch[1].replace(',', '')) : 0;
    subtotal += totalVal;

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
          <strong>$${price}</strong> ea × 
          <input type="number" value="${qtyInput.value}" style="width: 60px; padding: 4px;" 
                 data-update-btn="${updateBtn.id}"
                 oninput="document.getElementById(this.dataset.updateBtn).click()">
          = <strong>$${totalVal.toFixed(2)}</strong>
          <a href="${deleteHref}" onclick="event.preventDefault(); eval(this.getAttribute('data-postback'));" 
             data-postback="${deleteHref.replace('javascript:', '')}" 
             style="color: red; margin-left: 10px;">✕ Remove</a>
        </div>
      </div>
    `;
    customCart.appendChild(wrapper);
  });

  // Subtotal + Button Row
  const subtotalSection = document.createElement("div");
  subtotalSection.style.display = "flex";
  subtotalSection.style.justifyContent = "space-between";
  subtotalSection.style.alignItems = "center";
  subtotalSection.style.borderTop = "2px solid #ddd";
  subtotalSection.style.paddingTop = "1rem";
  subtotalSection.style.marginTop = "2rem";
  subtotalSection.innerHTML = `
    <div style="font-size: 1.2rem; font-weight: bold;">Subtotal (without Tax): $${subtotal.toFixed(2)}</div>
    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
      <a class="btn btn-success" href="javascript:WebForm_DoPostBackWithOptions(new WebForm_PostBackOptions('ctl00$PageBody$PlaceOrderButton', '', true, '', '', false, true))">
        Place Order
      </a>
      <a class="btn btn-secondary" href="https://webtrack.woodsonlumber.com/ProductDetail.aspx?pg=4553&pid=152">
        Shop for More
      </a>
      <a class="btn btn-danger" href="#" onclick="event.preventDefault(); eval('WebForm_DoPostBackWithOptions(new WebForm_PostBackOptions(\\'ctl00$PageBody$EmptyCartButton\\', \\'\\', true, \\'\\', \\'\\', false, true))');">
        Empty Cart
      </a>
    </div>
  `;
  customCart.appendChild(subtotalSection);

  originalCartPanel.parentElement.insertBefore(customCart, originalCartPanel);
});

