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
          <td>${escapeHTML(desc)}</td>
          <td style="text-align:right;">${escapeHTML(qty)}</td>
          <td>${escapeHTML(uom)}</td>
          <td style="text-align:right;">${escapeHTML(price)}</td>
          <td style="text-align:right;">${escapeHTML(total)}</td>
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

          <div class="wl-card">
            <h4>Addresses</h4>
            <div class="wl-address-wrap">
              <div>
                <div class="section-label">Sales Address</div>
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

  function getShipping() {
    const deliveryRow = document.getElementById('ctl00_PageBody_ShoppingCartSummaryTableControl_DeliverySummaryRow');
    const deliveryAmt = deliveryRow?.querySelector('td.numeric')?.textContent?.trim();
    if (deliveryAmt) return { label: 'Delivery', amount: deliveryAmt };
    return { label: 'Pickup', amount: 'Free' };
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
      td.innerHTML = imgUrl
        ? `<img src="${imgUrl}" alt="${code}" loading="lazy" style="width:48px;height:48px;object-fit:cover;border-radius:6px;">`
        : `<div style="width:48px;height:48px;border-radius:6px;background:#f0f0f3;"></div>`;
      tr.insertBefore(td, tr.firstChild);
      tr._wlThumbAdded = true;
    });

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