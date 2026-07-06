(function () {
  // -----------------------------
  // Guards & utilities
  // -----------------------------
  function safe(s) { return (s || '').replace(/\s+$/, ''); }
  function escapeHTML(s) { return (s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  // -----------------------------
  // Builder: creates the modern summary UI
  // -----------------------------
  function buildModernSummary() {
    const main = document.querySelector(".mainContents");
    const legacySummary = document.querySelector("#summary");
    if (!main || !legacySummary) return null;

    // Prevent duplicate builds
    if (main.querySelector('.wl-modern-summary')) return main.querySelector('.wl-modern-summary');

    // Hide legacy T&C row and action buttons, but keep functionality
    const tnCRow = main.querySelector('.row.mt-2');
    const backBtn = document.getElementById('ctl00_PageBody_BackToCartButton5');
    const printLink = Array.from(main.querySelectorAll('a.epi-button')).find(a => a.textContent.trim().match(/^Print Cart/i));
    const completeBtn = document.getElementById('ctl00_PageBody_CompleteCheckoutButton');
    const oldActionRow = main.querySelector(".row.justify-content-center");
    if (oldActionRow) oldActionRow.style.display = "none";

    // Precheck platform T&C & hide legacy row
    const platformTnC = document.getElementById('ctl00_PageBody_AgreeToTermsAndConditionsCheckBox');
    if (platformTnC) {
      platformTnC.checked = true;
      if (tnCRow) tnCRow.style.display = 'none';
    }
    if (backBtn) backBtn.closest('.row')?.style && (backBtn.closest('.row').style.display = 'none');
    if (printLink) printLink.closest('.col-12')?.style && (printLink.closest('.col-12').style.display = 'none');
    if (completeBtn) completeBtn.closest('.row')?.style && (completeBtn.closest('.row').style.display = 'none');

    // Hide original summary block; we’ll rebuild UI
    legacySummary.style.display = 'none';

    // Extract data
    const methodLabelEl = Array.from(legacySummary.querySelectorAll('.row .font-weight-bold'))
      .find(el => /Shipping Method/i.test(el.textContent));
    const methodValue = methodLabelEl?.parentElement?.querySelector('.col')?.textContent.trim() || '';
    const isPickup = /^pickup/i.test(methodValue);
    let fulfillmentIntent = '';
    let shippingSelection = null;
    try {
      fulfillmentIntent = sessionStorage.getItem('wl_fulfillment_intent') || sessionStorage.getItem('wl_fulfillment_method') || '';
      shippingSelection = JSON.parse(sessionStorage.getItem('wl_shipping_selection_v1') || 'null');
    } catch(e){}
    const isShip = !isPickup && fulfillmentIntent === 'ship';
    const methodTitle = isPickup ? 'Pickup' : (isShip ? 'Ship via UPS' : 'Local Delivery');

    const branchRow = document.getElementById("ctl00_PageBody_ShoppingCartSummaryTableControl_BranchRow");
    const branchFull = branchRow?.querySelector('.col:last-child')?.textContent.trim() || '';
    const city = branchFull.split(' - ')[0]?.trim() || '';
    const street = (branchFull.split(' - ')[1] || '').split(',')[0]?.trim() || '';

    const requiredDate = (() => {
      const label = Array.from(legacySummary.querySelectorAll('.row .font-weight-bold'))
        .find(el => /Date Required:/i.test(el.textContent || ''));
      // avoid :scope for compatibility
      return label ? label.parentElement.querySelector('.col')?.textContent.trim() || '' : '';
    })();

    function getValueByLabel(labelRe) {
      const el = Array.from(legacySummary.querySelectorAll('.row .font-weight-bold'))
        .find(n => labelRe.test((n.textContent || '').replace(/\s+/g, ' ')));
      return el ? el.parentElement.querySelector('.col')?.textContent.trim() || '' : '';
    }
    const poRef = getValueByLabel(/PO\s*#?\s*\/\s*Your\s+Ref:?/i);
    const specialInstr = getValueByLabel(/Special\s+Instructions:?/i);

    function collectAddress(prefixHuman) {
      const prefix = /invoice/i.test(prefixHuman) ? 'Invoice' : 'Delivery';
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
    const delivery = collectAddress("Delivery");
    const invoice  = collectAddress("Invoice");

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
    const totals = collectTotals();

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
          <td data-title="Product Code">${escapeHTML(code)}</td>
          <td data-title="Description">${escapeHTML(desc)}</td>
          <td data-title="Qty" style="text-align:right;">${escapeHTML(qty)}</td>
          <td data-title="UOM">${escapeHTML(uom)}</td>
          <td data-title="Price" style="text-align:right;">${escapeHTML(price)}</td>
          <td data-title="Total" style="text-align:right;">${escapeHTML(total)}</td>
        </tr>`;
      }).join("");
    }
    const linesHTML = collectLinesHTML();

    // store link/image maps
    const storeLinks = {
      "Buffalo":"https://www.woodsonlumber.com/buffalo",
      "Brenham":"https://www.woodsonlumber.com/brenham",
      "Bryan":"https://www.woodsonlumber.com/bryan",
      "Caldwell":"https://www.woodsonlumber.com/caldwell",
      "Groesbeck":"https://www.woodsonlumber.com/groesbeck",
      "Lexington":"https://www.woodsonlumber.com/lexington",
      "Mexia":"https://www.woodsonlumber.com/mexia",
    };
    const storeImages = {
      "Buffalo":"https://images-woodsonlumber.sirv.com/Store-Images/store-buffalo.png",
      "Brenham":"https://images-woodsonlumber.sirv.com/Store-Images/store-brenham.png",
      "Caldwell":"https://images-woodsonlumber.sirv.com/Store-Images/store-caldwell.png",
      "Bryan":"https://images-woodsonlumber.sirv.com/Store-Images/store-bryan.png",
      "Lexington":"https://images-woodsonlumber.sirv.com/Store-Images/store-lexington.png",
      "Groesbeck":"https://images-woodsonlumber.sirv.com/Store-Images/store-groesbeck.png",
      "Mexia":"https://images-woodsonlumber.sirv.com/Store-Images/store-mexia.png",
    };
    const storeUrl = storeLinks[city] || "#";
    const storeImg = storeImages[city] || "https://images-woodsonlumber.sirv.com/Store-Images/default.jpg";

    // Build UI
    const shell = document.createElement('div');
    shell.className = "wl-modern-summary";
    injectResponsiveSummaryStyles();
    shell.innerHTML = `
      <div class="wl-topbar">
        <a href="${storeUrl}" target="_blank" aria-label="${city} store">
          <img class="wl-store-img" src="${storeImg}" alt="${city} store">
        </a>
        <div>
          <p class="wl-method">${methodTitle} <span class="wl-pill">${isShip && shippingSelection?.label ? shippingSelection.label : methodValue}</span></p>
          <h3 class="wl-store-name">${city}</h3>
          <p class="wl-store-street">${street || ''}</p>
        </div>
        <div class="wl-date">
          <div><strong>${isPickup ? 'Pickup Date' : (isShip ? 'Estimated Arrival' : 'Expected Delivery')}:</strong> ${(isShip && shippingSelection?.arrival) ? shippingSelection.arrival : (requiredDate || '-')}</div>
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

          <div class="wl-card">
            <h4>Addresses</h4>
            <div class="wl-address-wrap">
              <div>
                <div class="section-label">${isShip ? 'Shipping Address' : 'Sales Address'}</div>
                <p class="wl-address">${delivery.addrLines.filter(Boolean).join('\n')}</p>
              </div>
              <div>
                <div class="section-label">Invoice Address</div>
                <p class="wl-address">${invoice.addrLines.filter(Boolean).join('\n')}</p>
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
        <button class="wl-btn secondary desktop" type="button" id="wl-back">Back</button>
        <button class="wl-btn desktop" type="button" id="wl-complete">Complete Order</button>
      </div>
    `;
    main.insertBefore(shell, main.firstChild);

    // Header text
    updateSummaryHeader();

    // Hide legacy buttons (ensure)
    hideLegacyButtons();

    // Sticky bar (mobile)
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
      shell.appendChild(sticky);
      document.getElementById('wl-sticky-complete')?.addEventListener('click', () => {
        if (platformTnC && !platformTnC.checked) platformTnC.checked = true;
        completeBtn?.click();
      });
    })();

    // Back before header (mobile)
    (function moveBackBeforeHeader(){
      const headerEl = document.getElementById("ctl00_PageBody_SummaryHeading_HeaderText");
      if (!headerEl) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'wl-btn secondary mobile';
      b.style.margin = '10px 0';
      b.textContent = 'Back';
      b.addEventListener('click', () => document.getElementById("ctl00_PageBody_BackToCartButton5")?.click());
      headerEl.parentElement?.insertBefore(b, headerEl);
    })();

    // Totals into tfoot (adds Shipping line)
    (function moveTotalsIntoTable(){
      const table = shell.querySelector('.wl-table');
      if (!table) return;

      const tf = document.createElement('tfoot');
      const shipping = getShipping();
      cacheShippingQuote(shipping);
      const t = collectTotals(); // re-use in case updated

      tf.innerHTML = `
        <tr>
          <td colspan="4"></td>
          <td>Subtotal</td>
          <td class="wl-right">${escapeHTML(t.subtotal)}</td>
        </tr>
        <tr>
          <td colspan="4"></td>
          <td>${escapeHTML(shipping.label)}</td>
          <td class="wl-right">${escapeHTML(shipping.amount)}</td>
        </tr>
        ${t.tax ? `
          <tr>
            <td colspan="4"></td>
            <td>Tax</td>
            <td class="wl-right">${escapeHTML(t.tax)}</td>
          </tr>
        ` : ''}
        <tr>
          <td colspan="4"></td>
          <td>Total</td>
          <td class="wl-right">${escapeHTML(t.total)}</td>
        </tr>
      `;
      table.appendChild(tf);
      shell.querySelector('.wl-totals')?.remove();
    })();

    // Wire buttons
    document.getElementById('wl-back')?.addEventListener('click', () => backBtn?.click());
    document.getElementById('wl-complete')?.addEventListener('click', () => {
      if (platformTnC && !platformTnC.checked) platformTnC.checked = true;
      completeBtn?.click();
    });

    return shell; // so caller can add thumbnails next
  }

  function injectResponsiveSummaryStyles() {
    if (document.getElementById('wl-summary-responsive-fixes')) return;

    const style = document.createElement('style');
    style.id = 'wl-summary-responsive-fixes';
    style.textContent = `
      .wl-modern-summary,
      .wl-modern-summary * { box-sizing: border-box; }

      .wl-modern-summary {
        width: min(100%, 1040px) !important;
        min-width: 0 !important;
        margin-inline: auto !important;
        border-radius: 8px !important;
      }

      .wl-modern-summary .wl-sections {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) !important;
        gap: 18px !important;
        min-width: 0 !important;
      }

      .wl-modern-summary .wl-left-stack {
        display: grid !important;
        grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr) !important;
        gap: 16px !important;
        min-width: 0 !important;
      }

      .wl-modern-summary .wl-card,
      .wl-modern-summary .wl-lines,
      .wl-modern-summary .wl-table-wrap { min-width: 0 !important; }

      .wl-modern-summary .wl-card { border-radius: 8px !important; }

      .wl-modern-summary .wl-kv,
      .wl-modern-summary .wl-kv.wl-kv-wide {
        grid-template-columns: 100px minmax(0, 1fr) !important;
      }

      .wl-modern-summary .wl-kv .v {
        min-width: 0 !important;
        overflow-wrap: anywhere !important;
        word-break: normal !important;
      }

      .wl-modern-summary .wl-table-wrap {
        width: 100% !important;
        max-width: 100% !important;
        overflow-x: auto !important;
        overscroll-behavior-x: contain;
        -webkit-overflow-scrolling: touch;
      }

      @media (min-width: 992px) {
        .wl-modern-summary .wl-lines .wl-table { width: 100% !important; table-layout: fixed !important; }
        .wl-modern-summary .wl-lines .wl-table th:nth-child(1),
        .wl-modern-summary .wl-lines .wl-table td:nth-child(1) { width: 64px !important; }
        .wl-modern-summary .wl-lines .wl-table th:nth-child(2),
        .wl-modern-summary .wl-lines .wl-table td:nth-child(2) { width: 110px !important; }
        .wl-modern-summary .wl-lines .wl-table th:nth-child(3),
        .wl-modern-summary .wl-lines .wl-table td:nth-child(3) { width: auto !important; }
        .wl-modern-summary .wl-lines .wl-table th:nth-child(4),
        .wl-modern-summary .wl-lines .wl-table td:nth-child(4) { width: 64px !important; }
        .wl-modern-summary .wl-lines .wl-table th:nth-child(5),
        .wl-modern-summary .wl-lines .wl-table td:nth-child(5) { width: 58px !important; }
        .wl-modern-summary .wl-lines .wl-table th:nth-child(6),
        .wl-modern-summary .wl-lines .wl-table td:nth-child(6) { width: 92px !important; }
        .wl-modern-summary .wl-lines .wl-table th:nth-child(7),
        .wl-modern-summary .wl-lines .wl-table td:nth-child(7) { width: 100px !important; }
      }

      @media (max-width: 991px) {
        .wl-modern-summary { padding: 16px !important; gap: 16px !important; }
        .wl-modern-summary .wl-left-stack { grid-template-columns: minmax(0, 1fr) !important; }
        .wl-modern-summary .wl-topbar {
          display: grid !important;
          grid-template-columns: 104px minmax(0, 1fr) !important;
          align-items: center !important;
          gap: 14px !important;
        }
        .wl-modern-summary .wl-store-img { width: 104px !important; height: 76px !important; object-fit: cover !important; }
        .wl-modern-summary .wl-date { grid-column: 1 / -1; white-space: normal !important; }
        .wl-modern-summary .wl-lines { overflow: hidden !important; }
        .wl-modern-summary .wl-lines .wl-table { width: 680px !important; min-width: 680px !important; table-layout: fixed !important; }
      }

      @media (max-width: 599px) {
        .wl-modern-summary { width: 100% !important; padding: 12px !important; gap: 14px !important; }
        .wl-modern-summary .wl-topbar {
          grid-template-columns: 84px minmax(0, 1fr) !important;
          padding: 12px !important;
        }
        .wl-modern-summary .wl-store-img { width: 84px !important; height: 66px !important; }
        .wl-modern-summary .wl-method,
        .wl-modern-summary .wl-store-street,
        .wl-modern-summary .wl-date { white-space: normal !important; overflow-wrap: anywhere !important; }
        .wl-modern-summary .wl-kv,
        .wl-modern-summary .wl-kv.wl-kv-wide { grid-template-columns: 90px minmax(0, 1fr) !important; }
        .wl-modern-summary .wl-address-wrap { display: grid !important; grid-template-columns: minmax(0, 1fr) !important; }
        .wl-modern-summary .wl-lines { padding: 12px !important; overflow: visible !important; }
        .wl-modern-summary .wl-table-wrap { overflow: visible !important; }
        .wl-modern-summary .wl-lines .wl-table { width: 100% !important; min-width: 0 !important; table-layout: auto !important; }
        .wl-modern-summary .wl-lines .wl-table thead { display: none !important; }
        .wl-modern-summary .wl-lines .wl-table tbody { display: grid !important; gap: 10px !important; }
        .wl-modern-summary .wl-lines .wl-table tbody tr {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          gap: 5px !important;
          padding: 10px !important;
          border: 1px solid #d9dde2 !important;
          border-radius: 6px !important;
        }
        .wl-modern-summary .wl-lines .wl-table tbody td {
          display: grid !important;
          grid-template-columns: 82px minmax(0, 1fr) !important;
          gap: 8px !important;
          width: auto !important;
          padding: 2px 0 !important;
          text-align: left !important;
          border: 0 !important;
          white-space: normal !important;
          overflow-wrap: anywhere !important;
        }
        .wl-modern-summary .wl-lines .wl-table tbody td::before {
          content: attr(data-title);
          color: #565d63;
          font-size: 12px;
          font-weight: 700;
        }
        .wl-modern-summary .wl-lines .wl-table.wl-has-thumbnails tbody tr {
          grid-template-columns: 56px minmax(0, 1fr) !important;
          column-gap: 10px !important;
        }
        .wl-modern-summary .wl-lines .wl-table.wl-has-thumbnails tbody td:first-child {
          display: block !important;
          grid-column: 1 !important;
          grid-row: 1 / span 6 !important;
        }
        .wl-modern-summary .wl-lines .wl-table.wl-has-thumbnails tbody td:first-child::before { content: none !important; }
        .wl-modern-summary .wl-lines .wl-table.wl-has-thumbnails tbody td:not(:first-child) { grid-column: 2 !important; }
        .wl-modern-summary .wl-lines .wl-table tfoot { display: grid !important; gap: 2px !important; margin-top: 12px !important; }
        .wl-modern-summary .wl-lines .wl-table tfoot tr {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
          gap: 12px !important;
        }
        .wl-modern-summary .wl-lines .wl-table tfoot td { display: block !important; width: auto !important; padding: 7px 0 !important; }
        .wl-modern-summary .wl-lines .wl-table tfoot td:first-child { display: none !important; }
        .wl-modern-summary .wl-actions .desktop { display: none !important; }
        .wl-modern-summary .wl-sticky-bar {
          display: block !important;
          position: sticky !important;
          bottom: 0 !important;
          z-index: 50 !important;
          margin: 4px -12px -12px !important;
          padding: 10px 12px max(10px, env(safe-area-inset-bottom)) !important;
          background: #fff !important;
          border-top: 1px solid #d9dde2 !important;
        }
        .wl-modern-summary .wl-sticky-btn { min-height: 48px !important; border-radius: 6px !important; }
      }
    `;
    document.head.appendChild(style);
  }

  // -----------------------------
  // Helpers used by builder
  // -----------------------------
  function hideLegacyButtons() {
    const backBtn = document.getElementById("ctl00_PageBody_BackToCartButton5");
    const completeBtn = document.getElementById("ctl00_PageBody_CompleteCheckoutButton");
    if (backBtn) backBtn.style.setProperty("display", "none", "important");
    if (completeBtn) completeBtn.style.setProperty("display", "none", "important");
  }

  function updateSummaryHeader(newText = "Review & Complete Your Order") {
    const headerEl = document.getElementById("ctl00_PageBody_SummaryHeading_HeaderText");
    if (headerEl) headerEl.textContent = newText;
  }

  function readCheckoutTotals() {
    try {
      const totals = JSON.parse(sessionStorage.getItem('wl_checkout_totals_v1') || 'null');
      const signature = sessionStorage.getItem('wl_cart_signature_v1') || '';
      if (!totals || !signature || totals.signature !== signature || !totals.total) return null;
      if ((Date.now() - Number(totals.ts || 0)) > 30 * 60 * 1000) return null;
      return totals;
    } catch(e) { return null; }
  }

  function captureCheckoutTotals() {
    const summary = document.getElementById('SummaryEntry2');
    if (!summary) return null;

    const amountFromRow = function(row) {
      const value = row?.querySelector('td.numeric')?.textContent || '';
      const match = String(value).match(/\$\s*([\d,]+(?:\.\d{2})?)/);
      return match ? '$' + match[1] : '';
    };
    const amountByLabel = function(pattern) {
      const row = Array.from(summary.querySelectorAll('tr')).find(function(candidate) {
        const label = candidate.children?.[0]?.textContent?.replace(/\s+/g, ' ').trim() || '';
        return pattern.test(label);
      });
      return amountFromRow(row);
    };

    let signature = '';
    let method = '';
    try {
      signature = sessionStorage.getItem('wl_cart_signature_v1') || '';
      method = sessionStorage.getItem('wl_fulfillment_method') || sessionStorage.getItem('wl_fulfillment_intent') || '';
    } catch(e) {}
    if (!signature) return null;

    const totals = {
      signature: signature,
      method: method,
      subtotal: amountByLabel(/^Subtotal/i),
      discount: amountByLabel(/^Total discount/i),
      delivery: amountFromRow(document.getElementById('ctl00_PageBody_CartSummary2_DeliveryCostsRow')),
      tax: amountFromRow(document.getElementById('ctl00_PageBody_CartSummary2_TaxTotals')),
      total: amountFromRow(document.getElementById('ctl00_PageBody_CartSummary2_GrandTotalRow')),
      ts: Date.now()
    };
    if (!totals.total) return null;
    try { sessionStorage.setItem('wl_checkout_totals_v1', JSON.stringify(totals)); } catch(e) {}
    return totals;
  }

  function buildPaymentChoiceContext() {
    const title = document.getElementById('ctl00_PageBody_CardOnFileViewTitle_HeaderText');
    if (!title || !title.offsetParent || document.getElementById('wl-payment-choice-context')) return;

    let subtotal = '';
    const totals = readCheckoutTotals();
    try {
      const storedValue = sessionStorage.getItem('wl_cart_subtotal_v1');
      const storedSubtotal = Number(storedValue);
      if (storedValue && Number.isFinite(storedSubtotal) && storedSubtotal >= 0) {
        subtotal = '$' + storedSubtotal.toFixed(2);
      }
    } catch(e) {}

    const panel = document.createElement('section');
    panel.id = 'wl-payment-choice-context';
    panel.setAttribute('aria-label', 'Order review information');
    const amountRows = totals ? `
      <div class="wl-payment-choice-amount"><span>Merchandise subtotal</span><strong>${escapeHTML(totals.subtotal || subtotal)}</strong></div>
      ${totals.discount && totals.discount !== '$0.00' ? `<div class="wl-payment-choice-amount"><span>Discount</span><strong>-${escapeHTML(totals.discount)}</strong></div>` : ''}
      <div class="wl-payment-choice-amount"><span>${totals.method === 'ship' ? 'UPS shipping' : (totals.method === 'pickup' ? 'Pickup' : 'Local delivery')}</span><strong>${escapeHTML(totals.delivery || 'Free')}</strong></div>
      ${totals.tax ? `<div class="wl-payment-choice-amount"><span>Tax</span><strong>${escapeHTML(totals.tax)}</strong></div>` : ''}
      <div class="wl-payment-choice-amount wl-payment-choice-total"><span>Total</span><strong>${escapeHTML(totals.total)}</strong></div>` : `
      ${subtotal ? `<div class="wl-payment-choice-amount"><span>Merchandise subtotal</span><strong>${escapeHTML(subtotal)}</strong></div>` : ''}
      <div class="wl-payment-choice-amount"><span>Delivery and tax</span><strong>Confirming</strong></div>`;

    panel.innerHTML = `
      <div class="wl-payment-choice-copy">
        <strong>Order total and payment</strong>
        <span>Select a payment method below. Nothing is placed until you review and click Complete Order.</span>
      </div>
      ${amountRows}`;

    const style = document.createElement('style');
    style.id = 'wl-payment-choice-context-css';
    style.textContent = `
      #wl-payment-choice-context{width:min(100%,760px);margin:0 auto 18px;padding:16px 18px;border:1px solid #d9dde2;border-left:4px solid #6b0016;border-radius:6px;background:#fff;font-family:Arial,sans-serif;color:#20242a;}
      .wl-payment-choice-copy{display:grid;gap:5px;margin-bottom:13px;line-height:1.4;}
      .wl-payment-choice-copy strong{font-size:17px;}
      .wl-payment-choice-copy span{color:#555;font-size:14px;}
      .wl-payment-choice-amount{display:flex;justify-content:space-between;gap:18px;padding-top:9px;border-top:1px solid #eceff1;font-size:14px;}
      .wl-payment-choice-amount+.wl-payment-choice-amount{margin-top:8px;}
      .wl-payment-choice-amount strong{text-align:right;color:#111;}
      .wl-payment-choice-total{font-size:17px;font-weight:800;border-top:2px solid #bfc4c8;}
      @media(max-width:600px){#wl-payment-choice-context{padding:14px;margin-bottom:14px}.wl-payment-choice-amount{align-items:flex-start}.wl-payment-choice-amount strong{max-width:55%;}}
    `;
    if (!document.getElementById(style.id)) document.head.appendChild(style);

    const anchor = title.closest('.row') || title.parentElement;
    if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(panel, anchor.nextSibling);
  }

  function buildChargeReview() {
    const summary = document.getElementById('SummaryEntry2');
    const continueButton = document.getElementById('ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView');
    if (!summary || !continueButton) return;

    captureCheckoutTotals();

    const header = document.getElementById('ctl00_PageBody_PromotionCodesAndDeliveryHeader_HeaderText');
    if (header) header.textContent = 'Review Delivery & Total';
    continueButton.textContent = 'Choose Payment';

    if (!document.getElementById('wl-charge-review-intro')) {
      const intro = document.createElement('div');
      intro.id = 'wl-charge-review-intro';
      intro.innerHTML = '<strong>Confirm the order charges</strong><span>Review delivery, tax, and the final total before choosing a payment method.</span>';
      summary.parentElement?.insertBefore(intro, summary);
    }

    if (!document.getElementById('wl-charge-review-css')) {
      const style = document.createElement('style');
      style.id = 'wl-charge-review-css';
      style.textContent = `
        #wl-charge-review-intro,#SummaryEntry2{width:min(100%,760px);margin-inline:auto;font-family:Arial,sans-serif;box-sizing:border-box;}
        #wl-charge-review-intro{display:grid;gap:4px;margin-bottom:12px;padding:14px 16px;border-left:4px solid #6b0016;background:#f6f7f8;color:#20242a;}
        #wl-charge-review-intro strong{font-size:17px;}#wl-charge-review-intro span{font-size:14px;color:#555;line-height:1.4;}
        #SummaryEntry2>table{width:100%!important;border:1px solid #d9dde2;border-collapse:separate;border-spacing:0;border-radius:6px;overflow:hidden;background:#fff;}
        #SummaryEntry2>table>tbody>tr>td{padding:12px 14px!important;border-bottom:1px solid #e8ebed;vertical-align:top;}
        #SummaryEntry2>table>tbody>tr:last-child>td{border-bottom:0;}
        #SummaryEntry2 td.numeric{text-align:right;font-weight:700;white-space:nowrap;}
        #SummaryEntry2 select{width:100%;min-height:42px;margin-top:6px;padding:7px 34px 7px 10px;border:1px solid #aeb4ba;border-radius:4px;background:#fff;}
        #ctl00_PageBody_BackToCartButton3,#ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView{min-height:44px;padding:11px 18px!important;border-radius:4px!important;}
        #ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView{background:#6b0016!important;color:#fff!important;}
        @media(max-width:600px){#wl-charge-review-intro{padding:12px}#SummaryEntry2>table>tbody>tr>td{padding:10px!important}#SummaryEntry2>table>tbody>tr>td:first-child{width:68%;}}
      `;
      document.head.appendChild(style);
    }

    const deliveryRow = document.getElementById('ctl00_PageBody_CartSummary2_DeliveryCostsRow');
    const amount = deliveryRow?.querySelector('td.numeric')?.textContent?.trim() || '';
    if (!/^\$[\d,]+(?:\.\d{2})?$/.test(amount)) return;

    try {
      const signature = sessionStorage.getItem('wl_cart_signature_v1') || '';
      if (!signature) return;
      const intent = sessionStorage.getItem('wl_fulfillment_intent') || '';
      let selection = null;
      try { selection = JSON.parse(sessionStorage.getItem('wl_shipping_selection_v1') || 'null'); } catch(e) {}
      localStorage.setItem('wl_shipping_quote_v1', JSON.stringify({
        signature: signature,
        kind: intent === 'ship' ? 'ups' : 'local-delivery',
        label: intent === 'ship' ? (selection?.label || 'UPS shipping') : 'Local delivery',
        amount: amount,
        postalCode: intent === 'ship' ? String(selection?.postalCode || '').slice(0, 5) : '',
        ts: Date.now()
      }));
    } catch(e) {}
  }

  function getShipping() {
    const deliveryRow = document.getElementById('ctl00_PageBody_ShoppingCartSummaryTableControl_DeliverySummaryRow');
    const deliveryAmt = deliveryRow?.querySelector('td.numeric')?.textContent?.trim();
    let intent = '';
    try { intent = sessionStorage.getItem('wl_fulfillment_intent') || ''; } catch(e){}
    if (deliveryAmt) return { label: intent === 'ship' ? 'Shipping' : 'Delivery', amount: deliveryAmt };
    return { label: 'Pickup', amount: 'Free' };
  }

  function cacheShippingQuote(shipping) {
    if (!shipping || !/\$/.test(shipping.amount || '')) return;
    try {
      const signature = sessionStorage.getItem('wl_cart_signature_v1') || '';
      if (!signature) return;
      const intent = sessionStorage.getItem('wl_fulfillment_intent') || '';
      if (intent !== 'ship' && !/^delivery/i.test(shipping.label || '')) return;
      let selection = null;
      try { selection = JSON.parse(sessionStorage.getItem('wl_shipping_selection_v1') || 'null'); } catch(e){}
      const postalCode = document.getElementById('ctl00_PageBody_ShoppingCartSummaryTableControl_DeliveryPostalCode')?.textContent?.trim() || '';
      localStorage.setItem('wl_shipping_quote_v1', JSON.stringify({
        signature: signature,
        kind: intent === 'ship' ? 'ups' : 'local-delivery',
        label: intent === 'ship' ? (selection?.label || 'UPS shipping') : 'Estimated delivery',
        amount: shipping.amount,
        postalCode: intent === 'ship' ? postalCode.slice(0, 5) : '',
        ts: Date.now()
      }));
    } catch(e){}
  }

  // -----------------------------
  // Thumbnails: cache (cart page) + add to summary
  // -----------------------------
  function ensureCartImageCache(){
    try {
      const items = document.querySelectorAll('.row.shopping-cart-item');
      if (!items.length) return;
      const map = JSON.parse(sessionStorage.getItem('wlCartImages') || '{}');
      let updated = false;

      items.forEach(item => {
        const img = item.querySelector('.ThumbnailImage') || item.querySelector('.image-wrapper img');
        const code = (item.querySelector('a[title] .portalGridLink')?.textContent || '').trim().toUpperCase();
        let src = img?.getAttribute('src') || '';
        if (!code || !src) return;
        if (src.startsWith('/')) src = location.origin + src;
        if (!map[code]) { map[code] = src; updated = true; }
      });

      if (updated) sessionStorage.setItem('wlCartImages', JSON.stringify(map));
    } catch(e){}
  }

  function addThumbnailsToLinesSafe() {
    const table = document.querySelector('.wl-table');
    if (!table || table._wlThumbsApplied) return;

    let imgMap = {};
    try { imgMap = JSON.parse(sessionStorage.getItem('wlCartImages') || '{}'); } catch(e){}

    const theadRow = table.querySelector('thead tr');
    const bodyRows = table.querySelectorAll('tbody tr');
    if (!theadRow || !bodyRows.length) return;

    // map codes from Product Code cells
    const codes = Array.from(bodyRows).map(tr => {
      const codeCell = tr.querySelector('td[data-title="Product Code"]') || tr.children[0];
      return (codeCell?.textContent || '').trim().toUpperCase();
    });
    const hasAnyImage = codes.some(c => imgMap[c]);
    if (!hasAnyImage) return;

    // Insert Item header once
    if (!theadRow._wlThumbHeader) {
      const th = document.createElement('th'); th.textContent = 'Item';
      theadRow.insertBefore(th, theadRow.firstChild);
      theadRow._wlThumbHeader = true;
    }

    bodyRows.forEach(tr => {
      if (tr._wlThumbAdded) return;
      const codeCell = tr.querySelector('td[data-title="Product Code"]') || tr.children[0];
      const code = (codeCell?.textContent || '').trim().toUpperCase();
      const imgUrl = imgMap[code];

      const td = document.createElement('td');
      td.dataset.title = 'Item';
      td.innerHTML = imgUrl
        ? `<img src="${imgUrl}" alt="${code}" loading="lazy" style="width:48px;height:48px;object-fit:cover;border-radius:6px;">`
        : `<div style="width:48px;height:48px;border-radius:6px;background:#f0f0f3;"></div>`;
      tr.insertBefore(td, tr.firstChild);
      tr._wlThumbAdded = true;
    });

    table.classList.add('wl-has-thumbnails');

    // Fix tfoot colspans
    const tfoot = table.querySelector('tfoot');
    if (tfoot) {
      const colCount = theadRow.children.length;
      const labelSpan = Math.max(colCount - 2, 1);
      tfoot.querySelectorAll('tr').forEach(tr => {
        const tds = tr.querySelectorAll('td');
        const label = tds[tds.length-2]?.textContent || '';
        const amt   = tds[tds.length-1]?.textContent || '';
        tr.innerHTML = `
          <td colspan="${labelSpan}"></td>
          <td>${label}</td>
          <td class="wl-right">${amt}</td>
        `;
      });
    }

    // Desktop widths when thumbnail present
    if (!document.getElementById('wl-thumb-cols')) {
      const style = document.createElement('style');
      style.id = 'wl-thumb-cols';
      style.textContent = `
        @media (min-width: 992px) {
          .wl-lines .wl-table { table-layout: fixed; }
          .wl-lines .wl-table th:nth-child(1),
          .wl-lines .wl-table td:nth-child(1) { width: 64px; }
          .wl-lines .wl-table th:nth-child(2),
          .wl-lines .wl-table td:nth-child(2) { width: 110px; }
          .wl-lines .wl-table th:nth-child(3),
          .wl-lines .wl-table td:nth-child(3) { width: auto; }
          .wl-lines .wl-table th:nth-child(4),
          .wl-lines .wl-table td:nth-child(4) { width: 70px; text-align:right; }
          .wl-lines .wl-table th:nth-child(5),
          .wl-lines .wl-table td:nth-child(5) { width: 60px; }
          .wl-lines .wl-table th:nth-child(6),
          .wl-lines .wl-table td:nth-child(6) { width: 110px; text-align:right; }
          .wl-lines .wl-table th:nth-child(7),
          .wl-lines .wl-table td:nth-child(7) { width: 120px; text-align:right; }
          .wl-lines .wl-table td:nth-child(3) { white-space: normal; overflow-wrap: break-word; hyphens: auto; }
        }
      `;
      document.head.appendChild(style);
    }

    table._wlThumbsApplied = true;
  }

  // -----------------------------
  // WebForms / SPA-like re-init
  // -----------------------------
  function safeInit() {
    // First, cache images if we’re on a cart step that has them
    ensureCartImageCache();
    buildChargeReview();
    buildPaymentChoiceContext();

    // If summary exists and not built, build it
    const hasSummary = !!document.querySelector('#summary');
    const hasModern = !!document.querySelector('.wl-modern-summary');
    if (hasSummary && !hasModern) {
      const shell = buildModernSummary();
      if (shell) addThumbnailsToLinesSafe();
      return;
    }

    // If already built, we may only need to (re)apply thumbs after data updates
    if (hasModern) addThumbnailsToLinesSafe();
  }

  function onReady(fn){ document.readyState !== 'loading' ? fn() : document.addEventListener('DOMContentLoaded', fn); }

  function attachPageRequestManagerHook() {
    try {
      if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager) {
        var prm = Sys.WebForms.PageRequestManager.getInstance();
        if (!prm._wlHooked) {
          prm.add_endRequest(function(){ safeInit(); });
          prm._wlHooked = true;
        }
      }
    } catch(e){}
  }

  function attachMutationObserver() {
    try {
      var target = document.querySelector('.mainContents') || document.body;
      if (!target || target._wlObserver) return;
      var mo = new MutationObserver(function(){
        if (document.querySelector('#summary')) safeInit();
      });
      mo.observe(target, { childList: true, subtree: true });
      target._wlObserver = mo;
    } catch(e){}
  }

  // -----------------------------
  // Boot
  // -----------------------------
  onReady(function(){
    attachPageRequestManagerHook();
    attachMutationObserver();
    // initial pass
    safeInit();
  });
})();
