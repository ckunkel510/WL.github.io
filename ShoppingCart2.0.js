
window.addEventListener("load", function () {
  const cartPanel = document.querySelector("#ctl00_PageBody_ShoppingCartDetailPanel");
  if (!cartPanel) return;

  // Build a wrapper for the custom cart
  const customCartWrapper = document.createElement("div");
  customCartWrapper.style.padding = "2rem";
  customCartWrapper.style.marginTop = "1rem";
  customCartWrapper.style.background = "#f8f8f8";
  customCartWrapper.style.borderRadius = "8px";

  let subtotal = 0;

  // Loop through real cart rows
  const cartItems = cartPanel.querySelectorAll(".shopping-cart-item");
  cartItems.forEach((row) => {
    const img = row.querySelector("img.ThumbnailImage");
    const codeLink = row.querySelector("a.portalGridLink")?.closest("a");
    const code = codeLink?.innerText?.trim() || "";
    const name = codeLink?.parentElement?.nextElementSibling?.innerText?.trim() || "";
    const stock = row.querySelector(".col-sm-6 div:nth-child(2) div")?.innerText?.trim() || "";
    const qtyInput = row.querySelector("input.riTextBox");
    const qtyState = row.querySelector("input[type='hidden'][id$='_ClientState']");
    const updateBtn = row.querySelector("a.refresh-cart-line-total");
    const deleteBtn = row.querySelector("a i.fas.fa-times")?.parentElement;

    // Total parsing
    const totalMatch = row.querySelector(".col-sm-3")?.textContent?.match(/\$([\d,.]+)/);
    const total = totalMatch ? parseFloat(totalMatch[1].replace(",", "")) : 0;
    subtotal += total;

    const priceText = row.querySelector(".col-6")?.textContent?.match(/\$([\d,.]+)/)?.[0] || "";

    // Create visual cart item
    const itemDiv = document.createElement("div");
    itemDiv.style.display = "flex";
    itemDiv.style.justifyContent = "space-between";
    itemDiv.style.alignItems = "center";
    itemDiv.style.borderBottom = "1px solid #ccc";
    itemDiv.style.padding = "12px 0";

    itemDiv.innerHTML = `
      <div style="display: flex; gap: 16px; align-items: center;">
        <img src="${img?.src}" style="width: 80px; height: auto; border-radius: 4px;" />
        <div>
          <a href="${codeLink?.href}" style="font-weight: bold; color: #004080;">${code}</a>
          <div>${name}</div>
          <div style="color: green;">${stock}</div>
        </div>
      </div>
      <div style="text-align: right;">
        <div><strong>${priceText}</strong> ea</div>
        <div style="margin-top: 4px;">
          Qty: <input type="number" value="${qtyInput.value}" style="width: 60px; padding: 4px;" 
            data-qty-id="${qtyInput.id}" data-state-id="${qtyState?.id}" data-update-id="${updateBtn?.id}" />
        </div>
        <div style="margin-top: 4px;">Total: <strong>$${total.toFixed(2)}</strong></div>
        <button class="remove-btn" data-delete-id="${deleteBtn?.id}" 
          style="margin-top: 6px; background: none; color: red; border: none; cursor: pointer;">
          ✕ Remove
        </button>
      </div>
    `;
    customCartWrapper.appendChild(itemDiv);
  });

  // Subtotal + action row
  const footerDiv = document.createElement("div");
  footerDiv.style.marginTop = "2rem";
  footerDiv.style.display = "flex";
  footerDiv.style.justifyContent = "space-between";
  footerDiv.style.alignItems = "center";
  footerDiv.innerHTML = `
    <div style="font-size: 1.2rem;"><strong>Subtotal:</strong> $${subtotal.toFixed(2)}</div>
    <div style="display: flex; gap: 10px;">
      <a class="btn btn-success" href="javascript:WebForm_DoPostBackWithOptions(new WebForm_PostBackOptions('ctl00$PageBody$PlaceOrderButton', '', true, '', '', false, true))">
        Place Order
      </a>
      <a class="btn btn-secondary" href="https://webtrack.woodsonlumber.com/ProductDetail.aspx?pg=4553&pid=152">
        Shop for More
      </a>
      <a class="btn btn-danger" href="#" onclick="event.preventDefault(); WebForm_DoPostBackWithOptions(new WebForm_PostBackOptions('ctl00$PageBody$EmptyCartButton', '', true, '', '', false, true));">
        Empty Cart
      </a>
    </div>
  `;
  customCartWrapper.appendChild(footerDiv);


    /* =============================
     Quote request CTA (below subtotal/proceed area)
     ============================= */
  (function injectQuoteCTA() {
    const QUOTE_URL = "https://woodsonwholesaleinc.formstack.com/forms/request_a_quote";

    // Build the section
    const quoteWrap = document.createElement("div");
    quoteWrap.className = "wl-quote-cta";
    quoteWrap.style.marginTop = "14px";
    quoteWrap.style.padding = "14px 16px";
    quoteWrap.style.border = "1px solid #d9d9d9";
    quoteWrap.style.borderRadius = "10px";
    quoteWrap.style.background = "#ffffff";
    quoteWrap.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)";

    quoteWrap.innerHTML = `
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
        <div style="min-width:220px; flex:1;">
          <div style="font-weight:700; font-size:1.05rem; margin-bottom:4px;">
            Need a Quote?
          </div>
          <div style="color:#555; line-height:1.35;">
            Not seeing exactly what you need, or pricing a bigger order? Submit a quick quote request and we’ll get back to you.
          </div>
        </div>

        <a href="${QUOTE_URL}" target="_blank" rel="noopener"
           style="display:inline-flex; align-items:center; justify-content:center; padding:10px 14px;
                  border-radius:8px; text-decoration:none; font-weight:700; white-space:nowrap;
                  border:1px solid #004080; color:#004080; background:#f3f7ff;">
          Request a Quote
        </a>
      </div>
    `;

    // Prefer inserting under the element you referenced if it exists
    const customSubtotalWrapper = document.querySelector(".custom-subtotal-wrapper");

    if (customSubtotalWrapper) {
      // Avoid duplicates
      if (!customSubtotalWrapper.querySelector(".wl-quote-cta")) {
        customSubtotalWrapper.insertAdjacentElement("beforeend", quoteWrap);
      }
      return;
    }

    // Fallback: insert under our generated footer area
    if (!customCartWrapper.querySelector(".wl-quote-cta")) {
      customCartWrapper.appendChild(quoteWrap);
    }
  })();


  // Insert after the real panel (still present for WebForms)
  cartPanel.insertAdjacentElement("afterend", customCartWrapper);

  // Update qty and trigger real update
  customCartWrapper.querySelectorAll("input[type='number']").forEach(input => {
    input.addEventListener("change", function () {
      const realQtyInput = document.getElementById(this.dataset.qtyId);
      const stateInput = document.getElementById(this.dataset.stateId);
      const updateBtn = document.getElementById(this.dataset.updateId);
      if (realQtyInput && stateInput && updateBtn) {
        realQtyInput.value = this.value;
        // Update Telerik state field
        const state = JSON.parse(stateInput.value);
        state.validationText = this.value;
        state.valueAsString = this.value;
        state.lastSetTextBoxValue = this.value;
        stateInput.value = JSON.stringify(state);
        updateBtn.click();
      }
    });
  });

  // Remove item logic
  customCartWrapper.querySelectorAll(".remove-btn").forEach(btn => {
    btn.addEventListener("click", function () {
      const realDelete = document.getElementById(this.dataset.deleteId);
      if (realDelete) realDelete.click();
    });
  });
});

