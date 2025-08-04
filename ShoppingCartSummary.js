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

  const requiredDate = (() => {
  // find the bold label that says "Date Required:" then read its sibling .col
  const label = Array.from(legacySummary.querySelectorAll('.row .font-weight-bold'))
    .find(el => /Date Required:/i.test(el.textContent || ''));
  return label ? label.parentElement.querySelector(':scope > .col')?.textContent.trim() || '' : '';
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
    "Buffalo": "https://images-woodsonlumber.sirv.com/Store-Images/store-buffalo.avif",
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
  <div class="row"><div>Subtotal</div><div>${totals.subtotal}</div></div>
  ${totals.tax ? `<div class="row"><div>Tax</div><div>${totals.tax}</div></div>` : ''}
  <div class="row total"><div>Total</div><div>${totals.total}</div></div>
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

  // After: main.insertBefore(shell, main.firstChild);

(function moveTotalsIntoTable(){
  const table = shell.querySelector('.wl-table');
  if (!table) return;

  const tf = document.createElement('tfoot');
  tf.innerHTML = `
    <tr>
      <td colspan="4"></td>
      <td>Subtotal</td>
      <td class="wl-right">${escapeHTML(totals.subtotal)}</td>
    </tr>
    ${totals.tax ? `
      <tr>
        <td colspan="4"></td>
        <td>Tax</td>
        <td class="wl-right">${escapeHTML(totals.tax)}</td>
      </tr>
    ` : ''}
    <tr>
      <td colspan="4"></td>
      <td>Total</td>
      <td class="wl-right">${escapeHTML(totals.total)}</td>
    </tr>
  `;
  table.appendChild(tf);

  // Remove the separate totals block so the footer is the single source of truth
  const totalsDiv = shell.querySelector('.wl-totals');
  if (totalsDiv) totalsDiv.remove();
})();


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
  // scope to legacySummary to avoid any duplicate IDs elsewhere
  const q = sel => legacySummary.querySelector(sel)?.textContent?.trim() || '';

  const contact = q('#ctl00_PageBody_ShoppingCartSummaryTableControl_DeliveryContactName');
  const phone   = q('#ctl00_PageBody_ShoppingCartSummaryTableControl_DeliveryTelephone');
  const email   = q('#ctl00_PageBody_ShoppingCartSummaryTableControl_InvoiceEmailAddress');

  const line1   = q(`#ctl00_PageBody_ShoppingCartSummaryTableControl_${prefix}AddressLines`);
  const city    = q(`#ctl00_PageBody_ShoppingCartSummaryTableControl_${prefix}City`);
  const state   = q(`#ctl00_PageBody_ShoppingCartSummaryTableControl_${prefix}State`);
  const zip     = q(`#ctl00_PageBody_ShoppingCartSummaryTableControl_${prefix}${prefix==='Invoice' ? 'ZipCode' : 'PostalCode'}`);
  const country = q(`#ctl00_PageBody_ShoppingCartSummaryTableControl_${prefix}Country`);

  const addrLines = [line1, [city, state].filter(Boolean).join(', '), zip, country].filter(Boolean);
  return { contact, phone, email, addrLines };
}


  function formatMultiline(lines) {
    return (lines || []).filter(Boolean).join('\n');
  }

  function collectLinesHTML() {
  const table =
    document.querySelector("#ctl00_PageBody_ShoppingCartSummaryTableControl_BasketLinesGrid_ctl00")
    || document.querySelector("#ctl00_PageBody_ShoppingCartSummaryTableControl_BasketLinesGrid .rgMasterTable");
  if (!table) return "";
  const rows = table.querySelectorAll("tr.rgRow, tr.rgAltRow");
  return Array.from(rows).map(r => {
    const tds = r.querySelectorAll("td");
    const code  = tds[0]?.textContent?.trim() || "";
    const desc  = tds[1]?.textContent?.trim() || "";
    const qty   = tds[3]?.textContent?.trim() || "";
    const uom   = tds[4]?.textContent?.trim() || "";
    const price = tds[5]?.textContent?.trim() || "";
    const total = tds[7]?.textContent?.trim() || "";
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
  const rows = Array.from(legacySummary.querySelectorAll('table tbody tr'));
  let subtotal = '', tax = '', total = '';
  for (const tr of rows) {
    const label = tr.children[0]?.textContent?.replace(/\s+/g,' ')?.trim() || '';
    const val   = tr.querySelector('td.numeric')?.textContent?.trim() || '';
    if (/^Subtotal/i.test(label)) subtotal = val;
    else if (/^Tax$/i.test(label)) tax = val;
    else if (/^Total(\s*inc\s*Tax)?$/i.test(label)) total = tr.querySelector('td.numeric.totalRow, td.numeric')?.textContent?.trim() || val;
  }
  return { subtotal, tax, total };
}


  function escapeHTML(s) {
    return (s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
})();