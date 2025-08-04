(function () {
  const main = document.querySelector(".mainContents");
  const legacySummary = document.querySelector("#summary");
  if (!main || !legacySummary) return;

  // --- Hide legacy T&C row and action buttons, but keep their functionality alive
  const tnCRow = main.querySelector('.row.mt-2');
  const backBtn = document.getElementById('ctl00_PageBody_BackToCartButton5');
  const printLink = Array.from(main.querySelectorAll('a.epi-button')).find(a => a.textContent.trim().match(/^Print Cart/i));
  const completeBtn = document.getElementById('ctl00_PageBody_CompleteCheckoutButton');

  // Precheck the platform T&C box (to satisfy server validation) & hide legacy row
  const platformTnC = document.getElementById('ctl00_PageBody_AgreeToTermsAndConditionsCheckBox');
  if (platformTnC) {
    platformTnC.checked = true;
    if (tnCRow) tnCRow.style.display = 'none';
  }
  if (backBtn) backBtn.closest('.col-12')?.parentElement?.parentElement?.style && (backBtn.closest('.row').style.display = 'none');
  if (printLink) printLink.closest('.col-12')?.style && (printLink.closest('.col-12').style.display = 'none');
  if (completeBtn) completeBtn.closest('.row')?.style && (completeBtn.closest('.row').style.display = 'none');

  // Hide original summary block; we’ll rebuild UI
  legacySummary.style.display = 'none';

  // --- Extract data from page
  const methodLabelEl = Array.from(legacySummary.querySelectorAll('.row .font-weight-bold'))
    .find(el => /Shipping Method/i.test(el.textContent));
  const methodValue = methodLabelEl?.parentElement?.querySelector('.col')?.textContent.trim() || '';
  const isPickup = /^pickup/i.test(methodValue);

  const branchRow = document.getElementById("ctl00_PageBody_ShoppingCartSummaryTableControl_BranchRow");
  const branchFull = branchRow?.querySelector('.col:last-child')?.textContent.trim() || '';
  // Expect format: "Buffalo - 2871 W Commerce St, PO BOX 750, Buffalo, Texas, 75831, United States"
  const city = branchFull.split(' - ')[0].trim();
  const street = (branchFull.split(' - ')[1] || '').split(',')[0]?.trim() || '';

  const requiredDate = (function() {
    const row = Array.from(legacySummary.querySelectorAll('.row'))
      .find(r => /Date Required:/i.test(r.textContent));
    return row?.querySelector('.col')?.textContent.trim() || '';
  })();

  const poRef = (function() {
    const row = Array.from(legacySummary.querySelectorAll('.row'))
      .find(r => /PO#|Your Ref/i.test(r.textContent));
    return row?.querySelector('.col')?.textContent.trim() || '';
  })();

  const specialInstr = (function() {
    const row = Array.from(legacySummary.querySelectorAll('.row'))
      .find(r => /Special Instructions/i.test(r.textContent));
    return row?.querySelector('.col')?.textContent.trim() || '';
  })();

  const delivery = collectAddress("Delivery");  // Sales Address
  const invoice  = collectAddress("Invoice");

  const totals = collectTotals();

  // Lines table
  const linesHTML = collectLinesHTML();

  // --- Store link/image maps (fill out the rest)
  const storeLinks = {
    "Buffalo": "https://www.woodsonlumber.com/buffalo",
    // "Brenham": "https://www.woodsonlumber.com/brenham",
    // "Bryan": "https://www.woodsonlumber.com/bryan",
    // "Caldwell": "https://www.woodsonlumber.com/caldwell",
    // "Groesbeck": "https://www.woodsonlumber.com/groesbeck",
    // "Lexington": "https://www.woodsonlumber.com/lexington",
    // "Mexia": "https://www.woodsonlumber.com/mexia",
  };
  const storeImages = {
    "Buffalo": "https://images-woodsonlumber.sirv.com/Store-Images/buffalo.jpg",
    // "Brenham": "https://images-woodsonlumber.sirv.com/Store-Images/brenham.jpg",
    // ...
  };
  const storeUrl = storeLinks[city] || "#";
  const storeImg = storeImages[city] || "https://images-woodsonlumber.sirv.com/Store-Images/default.jpg";

  // --- Build modern UI
  const shell = document.createElement('div');
  shell.className = "wl-modern-summary";
  shell.innerHTML = `
    <div class="wl-topbar">
      <a href="${storeUrl}" target="_blank" aria-label="${city} store">
        <img class="wl-store-img" src="${storeImg}" alt="${city} store">
      </a>
      <div>
        <p class="wl-method">${isPickup ? 'Pickup' : 'Delivery'} <span class="wl-pill">${methodValue}</span></p>
        <h3 class="wl-store-name">${city}</h3>
        <p class="wl-store-street">${street || ''}</p>
      </div>
      <div class="wl-date">
        <div><strong>${isPickup ? 'Pickup Date' : 'Expected Delivery'}:</strong> ${requiredDate || '-'}</div>
      </div>
    </div>

    <div class="wl-sections">
      <div class="wl-card">
        <h4>Contact & Notes</h4>
        <div class="wl-grid-2">
          <div class="wl-kv">
            <div class="k">Name</div><div class="v">${safe(delivery.contact)}</div>
            <div class="k">Phone</div><div class="v">${safe(delivery.phone)}</div>
            <div class="k">Email</div><div class="v">${safe(invoice.email)}</div>
          </div>
          <div class="wl-kv">
            <div class="k">PO / Your Ref</div><div class="v">${safe(poRef) || '-'}</div>
            <div class="k">Special Instructions</div><div class="v">${safe(specialInstr) || '-'}</div>
          </div>
        </div>
      </div>

      <div class="wl-card">
        <h4>Addresses</h4>
        <div class="wl-grid-2">
          <div>
            <div class="k" style="color:#555;margin-bottom:4px;">Sales Address</div>
            <p class="wl-address">${formatMultiline(delivery.addrLines)}</p>
          </div>
          <div>
            <div class="k" style="color:#555;margin-bottom:4px;">Invoice Address</div>
            <p class="wl-address">${formatMultiline(invoice.addrLines)}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="wl-card wl-lines">
      <h4>Order</h4>
      <div class="wl-table-wrap">
        <table class="wl-table">
          <thead>
            <tr>
              <th>Product Code</th>
              <th>Description</th>
              <th style="text-align:right;">Qty</th>
              <th>UOM</th>
              <th style="text-align:right;">Price</th>
              <th style="text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>${linesHTML}</tbody>
        </table>
      </div>
      <div class="wl-totals">
        <div class="row"><div>Subtotal <span style="color:#666;">(without Tax)</span></div><div>${totals.subtotal}</div></div>
        ${totals.discountRow}
        ${totals.taxRow}
        <div class="row total"><div>Total inc Tax</div><div>${totals.total}</div></div>
      </div>
    </div>

    <div class="wl-legal">
      By clicking <strong>Complete Order</strong>, you agree to our
      <a href="TermsAndConditions.aspx" target="_blank">Terms and Conditions</a> of sale.
      <div class="sub">
        <strong>Returns & Cancellations:</strong> Most items can be returned within 30 days in new condition with receipt.
        Custom/special orders may be non‑returnable or subject to a restocking fee. See Terms for full details.
      </div>
    </div>

    <div class="wl-actions">
      <button class="wl-btn secondary" type="button" id="wl-back">Back</button>
      <button class="wl-btn" type="button" id="wl-complete">Complete Order</button>
    </div>
  `;

  main.insertBefore(shell, main.firstChild);

  // --- Wire up buttons
  document.getElementById('wl-back')?.addEventListener('click', () => {
    backBtn?.click();
  });
  document.getElementById('wl-complete')?.addEventListener('click', () => {
    // Ensure platform checkbox is checked (defensive)
    if (platformTnC && !platformTnC.checked) platformTnC.checked = true;
    completeBtn?.click();
  });

  // -------- helpers --------
  function safe(s) { return (s || '').replace(/\s+$/, ''); }

  function collectAddress(prefixHuman) {
    const prefix = /invoice/i.test(prefixHuman) ? 'Invoice' : 'Delivery';
    const contact = document.querySelector('#ctl00_PageBody_ShoppingCartSummaryTableControl_DeliveryContactName')?.textContent?.trim() || '';
    const phone   = document.querySelector('#ctl00_PageBody_ShoppingCartSummaryTableControl_DeliveryTelephone')?.textContent?.trim() || '';
    const email   = document.querySelector('#ctl00_PageBody_ShoppingCartSummaryTableControl_InvoiceEmailAddress')?.textContent?.trim() || '';
    const line1   = document.querySelector(`#ctl00_PageBody_ShoppingCartSummaryTableControl_${prefix}AddressLines`)?.textContent?.trim() || '';
    const city    = document.querySelector(`#ctl00_PageBody_ShoppingCartSummaryTableControl_${prefix}City`)?.textContent?.trim() || '';
    const state   = document.querySelector(`#ctl00_PageBody_ShoppingCartSummaryTableControl_${prefix}State`)?.textContent?.trim() || '';
    const zip     = document.querySelector(`#ctl00_PageBody_ShoppingCartSummaryTableControl_${prefix}${prefix==='Invoice'?'ZipCode':'PostalCode'}`)?.textContent?.trim() || '';
    const country = document.querySelector(`#ctl00_PageBody_ShoppingCartSummaryTableControl_${prefix}Country`)?.textContent?.trim() || '';
    const addrLines = [line1, [city, state].filter(Boolean).join(', '), zip, country].filter(Boolean);
    return { contact, phone, email, addrLines };
  }

  function formatMultiline(lines) {
    return (lines || []).filter(Boolean).join('\n');
  }

  function collectLinesHTML() {
    const grid = document.querySelector("#ctl00_PageBody_ShoppingCartSummaryTableControl_BasketLinesGrid_ctl00");
    if (!grid) return "";
    const rows = grid.querySelectorAll("tr.rgRow, tr.rgAltRow");
    return Array.from(rows).map(r => {
      const tds = r.querySelectorAll("td");
      const code = tds[0]?.textContent?.trim() || "";
      const desc = tds[1]?.textContent?.trim() || "";
      const qty  = tds[3]?.textContent?.trim() || "";
      const uom  = tds[4]?.textContent?.trim() || "";
      const price= tds[5]?.textContent?.trim() || "";
      const total= tds[7]?.textContent?.trim() || "";
      return `<tr>
        <td>${escapeHTML(code)}</td>
        <td>${escapeHTML(desc)}</td>
        <td style="text-align:right;">${escapeHTML(qty)}</td>
        <td>${escapeHTML(uom)}</td>
        <td style="text-align:right;">${escapeHTML(price)}</td>
        <td style="text-align:right;">${escapeHTML(total)}</td>
      </tr>`;
    }).join("");
  }

  function collectTotals() {
    const subtotalCell = Array.from(legacySummary.querySelectorAll('table tbody tr td.numeric'))
      .find(td => td.previousElementSibling?.textContent?.match(/Subtotal/i));
    const discountRow = document.getElementById('ctl00_PageBody_ShoppingCartSummaryTableControl_DiscountSummaryRow');
    const taxRow = document.getElementById('ctl00_PageBody_ShoppingCartSummaryTableControl_VatSummaryRow');
    const totalCell = legacySummary.querySelector('.totalRow');

    const subtotal = subtotalCell?.textContent?.trim() || '';
    const discountVal = discountRow?.querySelector('td.numeric')?.textContent?.trim();
    const taxVal = taxRow?.querySelector('td.numeric')?.textContent?.trim();
    const total = totalCell?.textContent?.trim() || '';

    return {
      subtotal,
      total,
      discountRow: (typeof discountVal === 'string')
        ? `<div class="row"><div>Total discount</div><div>${discountVal}</div></div>` : '',
      taxRow: (typeof taxVal === 'string')
        ? `<div class="row"><div>Tax</div><div>${taxVal}</div></div>` : '',
    };
  }

  function escapeHTML(s) {
    return (s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
})();