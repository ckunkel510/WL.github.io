(function () {
  const main = document.querySelector(".mainContents");
  const legacySummary = document.querySelector("#summary");
  if (!main || !legacySummary) return;

  // --- Hide legacy T&C row and action buttons, but keep their functionality alive
  const tnCRow = main.querySelector('.row.mt-2');
  const backBtn = document.getElementById('ctl00_PageBody_BackToCartButton5');
  const printLink = Array.from(main.querySelectorAll('a.epi-button')).find(a => a.textContent.trim().match(/^Print Cart/i));
  const completeBtn = document.getElementById('ctl00_PageBody_CompleteCheckoutButton');
  const oldActionRow = main.querySelector(".row.justify-content-center");
if (oldActionRow) {
  oldActionRow.style.display = "none";
}


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


  const poRef = getValueByLabel(/PO\s*#?\s*\/\s*Your\s+Ref:?/i);
const specialInstr = getValueByLabel(/Special\s+Instructions:?/i);


  const delivery = collectAddress("Delivery");  // Sales Address
  const invoice  = collectAddress("Invoice");

  const totals = collectTotals();

  // Lines table
  const linesHTML = collectLinesHTML();

  // --- Store link/image maps (fill out the rest)
  const storeLinks = {
    "Buffalo": "https://www.woodsonlumber.com/buffalo",
     "Brenham": "https://www.woodsonlumber.com/brenham",
     "Bryan": "https://www.woodsonlumber.com/bryan",
     "Caldwell": "https://www.woodsonlumber.com/caldwell",
     "Groesbeck": "https://www.woodsonlumber.com/groesbeck",
     "Lexington": "https://www.woodsonlumber.com/lexington",
     "Mexia": "https://www.woodsonlumber.com/mexia",
  };
  const storeImages = {
    "Buffalo": "https://images-woodsonlumber.sirv.com/Store-Images/store-buffalo.png",
    "Brenham": "https://images-woodsonlumber.sirv.com/Store-Images/store-brenham.png",
    "Caldwell": "https://images-woodsonlumber.sirv.com/Store-Images/store-caldwell.png",
    "Bryan": "https://images-woodsonlumber.sirv.com/Store-Images/store-bryan.png",
    "Lexington": "https://images-woodsonlumber.sirv.com/Store-Images/store-lexington.png",
    "Groesbeck": "https://images-woodsonlumber.sirv.com/Store-Images/store-groesbeck.png",
    "Mexia": "https://images-woodsonlumber.sirv.com/Store-Images/store-mexia.png",
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
  <div class="wl-left-stack">
    <div class="wl-card">
  <h4>Contact</h4>
  <div class="wl-kv">
    <div class="k">Name</div><div class="v">${safe(delivery.contact)}</div>
    <div class="k">Phone</div><div class="v">${safe(delivery.phone)}</div>
    <div class="k">Email</div><div class="v">${safe(invoice.email)}</div>
  </div>
  <div class="wl-kv wl-kv-wide">
    <div class="k">PO / Your Ref</div><div class="v">${safe(poRef) || '-'}</div>
  </div>
  <div class="wl-kv wl-kv-wide">
    <div class="k">Special Instructions</div><div class="v">${safe(specialInstr) || '-'}</div>
  </div>
</div>

    </div>

    <div class="wl-card">
      <h4>Addresses</h4>
      <div class="wl-address-wrap">
        <div>
          <div class="section-label">Sales Address</div>
          <p class="wl-address">${formatMultiline(delivery.addrLines)}</p>
        </div>
        <div>
          <div class="section-label">Invoice Address</div>
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
  updateSummaryHeader();
hideLegacyButtons();

(function addStickyBarMobile(){
  const sticky = document.createElement('div');
  sticky.className = 'wl-sticky-bar';
  sticky.innerHTML = `
    <div class="wl-sticky-legal">
      By tapping <strong>Complete Order</strong>, you agree to our
      <a href="TermsAndConditions.aspx" target="_blank">Terms & Conditions</a>.
    </div>
    <button class="wl-sticky-btn" type="button" id="wl-sticky-complete">Complete Order</button>
  `;
  // Append at the very end of our modern summary (so it stays visible)
  shell.appendChild(sticky);

  // Wire up
  document.getElementById('wl-sticky-complete')?.addEventListener('click', () => {
    if (platformTnC && !platformTnC.checked) platformTnC.checked = true;
    completeBtn?.click();
  });
})();

(function moveBackBeforeHeader(){
  const headerEl = document.getElementById("ctl00_PageBody_SummaryHeading_HeaderText");
  if (!headerEl) return;
  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'wl-btn secondary';
  backBtn.style.margin = '10px 0';
  backBtn.textContent = 'Back';
  backBtn.addEventListener('click', () => {
    document.getElementById("ctl00_PageBody_BackToCartButton5")?.click();
  });
  headerEl.parentElement?.insertBefore(backBtn, headerEl);
})();


  // After: main.insertBefore(shell, main.firstChild);

(function moveTotalsIntoTable(){
  const table = shell.querySelector('.wl-table');
  if (!table) return;

  const tf = document.createElement('tfoot');
  const shipping = getShipping();

  tf.innerHTML = `
    <tr>
      <td colspan="4"></td>
      <td>Subtotal</td>
      <td class="wl-right">${escapeHTML(totals.subtotal)}</td>
    </tr>
    <tr>
      <td colspan="4"></td>
      <td>${escapeHTML(shipping.label)}</td>
      <td class="wl-right">${escapeHTML(shipping.amount)}</td>
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

  const totalsDiv = shell.querySelector('.wl-totals');
  if (totalsDiv) totalsDiv.remove();
})();

(function cacheCartImages(){
  try {
    const map = {}; // { productCode: imageUrl }
    document.querySelectorAll('[data-title="Product Code"], td[data-title="Product Code"]').forEach(td => {
      const code = (td.textContent || '').trim();
      // Find the row image (adjust selector to your cart row image)
      const row = td.closest('tr');
      const img = row?.querySelector('img');
      const src = img?.getAttribute('src');
      if (code && src) map[code] = src;
    });
    if (Object.keys(map).length) {
      sessionStorage.setItem('wlCartImages', JSON.stringify(map));
    }
  } catch(e) { /* no-op */ }
})();


(async function addThumbnailsToLines(){
  const table = shell.querySelector('.wl-table');
  if (!table) return;

  // 1) Build an image map from session first
  let imgMap = {};
  try { imgMap = JSON.parse(sessionStorage.getItem('wlCartImages') || '{}'); } catch(e){}

  // 2) If map is empty or missing items, optionally merge the CSV fallback
  const needFallback = table.querySelectorAll('tbody tr').length && !Object.keys(imgMap).length;
  if (needFallback) {
    try {
      const sheetMap = await fetchImageMapFromCSV();
      imgMap = { ...sheetMap, ...imgMap }; // session wins
    } catch(e) { /* ignore */ }
  }

  // 3) Insert a new thumbnail column as first column
  const theadRow = table.querySelector('thead tr');
  const th = document.createElement('th');
  th.textContent = 'Item';
  theadRow.insertBefore(th, theadRow.firstChild);

  table.querySelectorAll('tbody tr').forEach(tr => {
    const codeCell = tr.children[0]; // old first col (Product Code)
    const code = (codeCell?.textContent || '').trim();
    const thumbUrl = imgMap[code];

    const td = document.createElement('td');
    if (thumbUrl) {
      td.innerHTML = `<img src="${thumbUrl}" alt="${code}" loading="lazy" style="width:48px;height:48px;object-fit:cover;border-radius:6px;">`;
    } else {
      td.innerHTML = `<div style="width:48px;height:48px;border-radius:6px;background:#f0f0f3;"></div>`;
    }
    tr.insertBefore(td, tr.firstChild);
  });

  // 4) Rebalance desktop widths so Description still has space
  const css = document.createElement('style');
  css.textContent = `
    @media (min-width: 992px) {
      .wl-lines .wl-table th:nth-child(1),
      .wl-lines .wl-table td:nth-child(1) { width: 64px; } /* thumbnail */
      .wl-lines .wl-table th:nth-child(2),
      .wl-lines .wl-table td:nth-child(2) { width: 110px; } /* Product Code */
      .wl-lines .wl-table th:nth-child(3),
      .wl-lines .wl-table td:nth-child(3) { width: auto; } /* Description (widest) */
      .wl-lines .wl-table th:nth-child(4),
      .wl-lines .wl-table td:nth-child(4) { width: 70px; text-align:right; } /* Qty */
      .wl-lines .wl-table th:nth-child(5),
      .wl-lines .wl-table td:nth-child(5) { width: 60px; } /* UOM */
      .wl-lines .wl-table th:nth-child(6),
      .wl-lines .wl-table td:nth-child(6) { width: 110px; text-align:right; } /* Price */
      .wl-lines .wl-table th:nth-child(7),
      .wl-lines .wl-table td:nth-child(7) { width: 120px; text-align:right; } /* Total */
    }
    @media (max-width: 599px) {
      .wl-lines .wl-table th:nth-child(1),
      .wl-lines .wl-table td:nth-child(1) { width: 48px; }
    }
  `;
  document.head.appendChild(css);
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

  function hideLegacyButtons() {
  const backBtn = document.getElementById("ctl00_PageBody_BackToCartButton5");
  const completeBtn = document.getElementById("ctl00_PageBody_CompleteCheckoutButton");
  if (backBtn) backBtn.style.setProperty("display", "none", "important");
  if (completeBtn) completeBtn.style.setProperty("display", "none", "important");
}

// Call this after inserting shell


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

function getValueByLabel(labelRe) {
  const el = Array.from(legacySummary.querySelectorAll('.row .font-weight-bold'))
    .find(n => labelRe.test((n.textContent || '').replace(/\s+/g, ' ')));
  return el ? el.parentElement.querySelector('.col')?.textContent.trim() || '' : '';
}

function getShipping() {
  // If platform renders a delivery row, use it
  const deliveryRow = document.getElementById('ctl00_PageBody_ShoppingCartSummaryTableControl_DeliverySummaryRow');
  const deliveryAmt = deliveryRow?.querySelector('td.numeric')?.textContent?.trim();
  if (deliveryAmt) return { label: 'Delivery', amount: deliveryAmt };

  // Otherwise treat as Pickup
  return { label: 'Pickup', amount: 'Free' };
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

function updateSummaryHeader(newText = "Review & Complete Your Order") {
  const headerEl = document.getElementById("ctl00_PageBody_SummaryHeading_HeaderText");
  if (headerEl) {
    headerEl.textContent = newText;
  }
}


  function escapeHTML(s) {
    return (s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
})();