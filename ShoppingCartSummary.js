document.addEventListener("DOMContentLoaded", () => {
  const mainContents = document.querySelector(".mainContents");
  const summary = document.querySelector("#summary");
  if (!mainContents || !summary) return;

  summary.style.display = "none"; // Hide original content

  const pickupMethod = "Pickup (Free)";
  const branchInfo = document.querySelector("#ctl00_PageBody_ShoppingCartSummaryTableControl_BranchRow .col:last-child")?.textContent || "";
  const storeImageURL = getStoreImageURL(branchInfo); // You'll provide a function or map for this
  const requiredDate = document.querySelectorAll(".row")[2]?.querySelector(".col")?.textContent || "";
  const contactName = document.querySelector("#ctl00_PageBody_ShoppingCartSummaryTableControl_DeliveryContactName")?.textContent || "";
  const phone = document.querySelector("#ctl00_PageBody_ShoppingCartSummaryTableControl_DeliveryTelephone")?.textContent || "";
  const email = document.querySelector("#ctl00_PageBody_ShoppingCartSummaryTableControl_InvoiceEmailAddress")?.textContent || "";
  const deliveryAddress = formatAddress("Delivery");
  const invoiceAddress = formatAddress("Invoice");
  const cartSubtotal = document.querySelector("#ctl00_PageBody_ShoppingCartSummaryTableControl_SubtotalSuffix")?.nextElementSibling?.textContent || "";
  const cartTotal = document.querySelector(".totalRow")?.textContent || "";

  const newSummary = document.createElement("div");
  newSummary.innerHTML = `
    <div class="modern-checkout-summary">
      <div class="pickup-summary">
        <img src="${storeImageURL}" alt="Store Image" class="store-img">
        <div>
          <h3>${pickupMethod}</h3>
          <p>${branchInfo}</p>
        </div>
        <div class="required-date">
          <strong>Date Required:</strong> ${requiredDate}
        </div>
      </div>

      <div class="contact-section">
        <h4>Contact Info</h4>
        <p>${contactName}<br>${phone}<br>${email}</p>
      </div>

      <div class="address-section">
        <div>
          <h4>Sales Address</h4>
          <p>${deliveryAddress}</p>
        </div>
        <div>
          <h4>Invoice Address</h4>
          <p>${invoiceAddress}</p>
        </div>
      </div>

      <div class="order-lines-container">
        <table class="order-lines-table">${getOrderLinesTableHTML()}</table>
        <div class="order-totals">
          <p><strong>Subtotal:</strong> ${cartSubtotal}</p>
          <p><strong>Total:</strong> ${cartTotal}</p>
        </div>
      </div>

      <div class="terms-section">
        <label>
          <input type="checkbox" id="customTnC" checked>
          I agree to the <a href="TermsAndConditions.aspx" target="_blank">Terms and Conditions</a>.
        </label>
      </div>

      <div class="checkout-buttons">
        <button class="btn-back" onclick="document.getElementById('ctl00_PageBody_BackToCartButton5').click()">Back</button>
        <button class="btn-print" onclick="window.open('ShoppingCartPrintout.aspx', '_blank')">Print Cart</button>
        <button class="btn-complete" onclick="document.getElementById('ctl00_PageBody_CompleteCheckoutButton').click()">Complete Order</button>
      </div>
    </div>
  `;
  mainContents.appendChild(newSummary);
});

function getStoreImageURL(branchText) {
  const map = {
    "Buffalo": "https://example.com/buffalo.jpg",
    "Bryan": "https://example.com/bryan.jpg",
    // Add all 7
  };
  const key = Object.keys(map).find(k => branchText.includes(k));
  return map[key] || "https://example.com/default.jpg";
}

function formatAddress(type) {
  const prefix = type === "Invoice" ? "Invoice" : "Delivery";
  const address = [
    document.querySelector(`#ctl00_PageBody_ShoppingCartSummaryTableControl_${prefix}AddressLines`)?.textContent,
    document.querySelector(`#ctl00_PageBody_ShoppingCartSummaryTableControl_${prefix}City`)?.textContent,
    document.querySelector(`#ctl00_PageBody_ShoppingCartSummaryTableControl_${prefix}State`)?.textContent,
    document.querySelector(`#ctl00_PageBody_ShoppingCartSummaryTableControl_${prefix}PostalCode`)?.textContent,
    document.querySelector(`#ctl00_PageBody_ShoppingCartSummaryTableControl_${prefix}Country`)?.textContent,
  ];
  return address.filter(Boolean).join(", ");
}

function getOrderLinesTableHTML() {
  const rows = document.querySelectorAll("#ctl00_PageBody_ShoppingCartSummaryTableControl_BasketLinesGrid_ctl00 tr.rgRow, tr.rgAltRow");
  return Array.from(rows).map(row => {
    const cells = row.querySelectorAll("td");
    return `<tr>${Array.from(cells).map(td => `<td>${td.innerHTML}</td>`).join("")}</tr>`;
  }).join("");
}
