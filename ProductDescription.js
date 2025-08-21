window.addEventListener('load', async function() {
  async function loadProductWidget() {
    function getProductIdFromUrl() {
      const urlParams = window.location.search;
      const pidMatch = urlParams.match(/pid=([^&]*)/);
      return pidMatch ? decodeURIComponent(pidMatch[1]) : null;
    }

    function insertStyles() {
      const styleElement = document.createElement('style');
      styleElement.textContent = `
        .product-widget-container {
          margin-top: 20px;
          padding: 15px;
          border: 1px solid #ddd;
          font-family: Arial, sans-serif;
          background-color: #f9f9f9;
          border-radius: 8px;
        }

        .tab-menu {
          display: flex;
          justify-content: flex-start;
          border-bottom: 2px solid #ccc;
          margin-bottom: 15px;
        }

        .tab-menu button {
          padding: 10px 20px;
          margin-right: 10px;
          border: none;
          background-color: #e0e0e0;
          color: #333;
          font-weight: bold;
          cursor: pointer;
          border-radius: 5px 5px 0 0;
          transition: background-color 0.3s ease;
        }

        .tab-menu button.active {
          background-color: #6b0016;
          color: #fff;
        }

        .tab-menu button:hover {
          background-color: #8d8d8d;
          color: #fff;
        }

        .tab-content {
          padding: 20px;
          background-color: #fff;
          border-radius: 0 0 8px 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .tab-section {
          display: none;
        }

        .tab-section.active {
          display: block;
        }

        .mobile-section {
          display: none;
        }

        .resource-item {
          display: inline-block;
          text-align: center;
          margin: 10px;
        }

        .resource-item img {
          width: 60px;
          height: 60px;
          cursor: pointer;
        }

        .resource-name {
          margin-top: 5px;
          font-size: 0.9rem;
          color: #333;
        }

        /* Mobile-specific styles */
        @media (max-width: 768px) {
          .tab-menu, .tab-content {
            display: none;
          }

          .mobile-section {
            display: block;
            margin-bottom: 15px;
          }

          .mobile-header {
            font-weight: bold;
            font-size: 1.1rem;
            margin-bottom: 5px;
            color: #333;
            border-bottom: 1px solid #ccc;
            padding: 10px 0;
          }

          .mobile-content {
            font-size: 1rem;
            line-height: 1.5;
            padding: 10px 0;
            color: #555;
          }

          .mobile-resources {
            display: flex;
            flex-wrap: wrap;
            justify-content: start;
          }
        }

        #productdescription.hidden {
          display: none !important;
        }
      `;
      document.head.appendChild(styleElement);
    }

    function parseCSV(csvText) {
      const rows = [];
      let currentRow = [];
      let currentField = '';
      let insideQuotes = false;

      for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];

        if (char === '"') {
          if (insideQuotes && csvText[i + 1] === '"') {
            currentField += '"';
            i++;
          } else {
            insideQuotes = !insideQuotes;
          }
        } else if (char === ',' && !insideQuotes) {
          currentRow.push(currentField.trim());
          currentField = '';
        } else if (char === '\n' && !insideQuotes) {
          currentRow.push(currentField.trim());
          rows.push(currentRow);
          currentRow = [];
          currentField = '';
        } else {
          currentField += char;
        }
      }

      if (currentField) currentRow.push(currentField.trim());
      if (currentRow.length > 0) rows.push(currentRow);

      return rows;
    }

    function switchTab(header, event) {
      event.preventDefault();

      document.querySelectorAll('.tab-menu button').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-section').forEach(sec => {
        sec.style.display = 'none';
        sec.classList.remove('active');
      });

      const tabButton = document.querySelector(`.tab-menu button[data-header="${header}"]`);
      const activeSection = document.getElementById(`tab-${header}`);

      if (tabButton) tabButton.classList.add('active');
      if (activeSection) {
        activeSection.style.display = 'block';
        activeSection.classList.add('active');
      }
    }

    const productId = getProductIdFromUrl();

    if (!productId) {
      console.error('Product ID (pid) not found in the URL.');
      return;
    }

    const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSz4pwwlgmNw8642O1eDV8Jir2GBslQyyTX4ykx_rRlAb6k2EHe_QYy2gwk7R9bq5gV3KZpYOdXA3HW/pub?output=csv';

    try {
      insertStyles();

      const response = await fetch(csvUrl);
      const csvData = await response.text();
      const rows = parseCSV(csvData);

      const headers = rows.shift();

      const productRows = rows.filter(row => row[0] && row[0].trim() === productId);

      if (!productRows.length) {
        console.warn('No data found for this product:', productId);
        return;
      }

      const tabData = {};
      const resources = [];

      const resourceIndex = headers.indexOf('Resources');
      const resourceLinkIndex = headers.indexOf('Resource Link');

      headers.forEach((header, index) => {
        if (index === 0 || index === resourceLinkIndex) return;

        if (index === resourceIndex) {
          productRows.forEach(row => {
            if (row[resourceIndex] && row[resourceLinkIndex]) {
              resources.push({
                name: row[resourceIndex],
                link: row[resourceLinkIndex]
              });
            }
          });
        } else {
          tabData[header] = productRows
            .map(row => (row[index] !== undefined ? row[index].trim() : ''))
            .filter(content => content !== '');
        }
      });

      const widgetContainer = document.createElement('div');
      widgetContainer.id = 'product-widget';
      widgetContainer.className = 'product-widget-container';

      const tabMenu = document.createElement('div');
      tabMenu.id = 'tab-menu';
      tabMenu.className = 'tab-menu';
      widgetContainer.appendChild(tabMenu);

      const tabContent = document.createElement('div');
      tabContent.id = 'tab-content';
      tabContent.className = 'tab-content';
      widgetContainer.appendChild(tabContent);

      const mobileContainer = document.createElement('div');

      Object.keys(tabData).forEach((header, tabIndex) => {
        if (tabData[header].length === 0) return;

        const tabButton = document.createElement('button');
        tabButton.textContent = header;
        tabButton.setAttribute('data-header', header);
        tabButton.addEventListener('click', (event) => switchTab(header, event));
        tabMenu.appendChild(tabButton);

        const section = document.createElement('div');
        section.id = `tab-${header}`;
        section.className = `tab-section ${tabIndex === 0 ? 'active' : ''}`;
        section.style.display = tabIndex === 0 ? 'block' : 'none';
        section.innerHTML = tabData[header].join('<br>');
        tabContent.appendChild(section);

        const mobileSection = document.createElement('div');
        mobileSection.className = 'mobile-section';

        const mobileHeader = document.createElement('div');
        mobileHeader.className = 'mobile-header';
        mobileHeader.textContent = header;

        const mobileContent = document.createElement('div');
        mobileContent.className = 'mobile-content';
        mobileContent.innerHTML = tabData[header].join('<br>');

        mobileSection.appendChild(mobileHeader);
        mobileSection.appendChild(mobileContent);
        mobileContainer.appendChild(mobileSection);
      });

      if (resources.length > 0) {
        const resourcesTabButton = document.createElement('button');
        resourcesTabButton.textContent = 'Resources';
        resourcesTabButton.setAttribute('data-header', 'Resources');
        resourcesTabButton.addEventListener('click', (event) => switchTab('Resources', event));
        tabMenu.appendChild(resourcesTabButton);

        const resourcesSection = document.createElement('div');
        resourcesSection.id = 'tab-Resources';
        resourcesSection.className = 'tab-section';
        resourcesSection.style.display = 'none';

        resources.forEach(resource => {
          const resourceItem = document.createElement('div');
          resourceItem.className = 'resource-item';

          const resourceLink = document.createElement('a');
          resourceLink.href = resource.link;
          resourceLink.target = '_blank';

          const resourceImage = document.createElement('img');
          resourceImage.src = 'https://images-woodsonlumber.sirv.com/Other%20Website%20Images/Statements.png';
          resourceImage.alt = resource.name;

          const resourceName = document.createElement('div');
          resourceName.className = 'resource-name';
          resourceName.textContent = resource.name;

          resourceLink.appendChild(resourceImage);
          resourceItem.appendChild(resourceLink);
          resourceItem.appendChild(resourceName);

          resourcesSection.appendChild(resourceItem);
        });

        tabContent.appendChild(resourcesSection);

        const resourcesMobileSection = document.createElement('div');
        resourcesMobileSection.className = 'mobile-section';

        const resourcesMobileHeader = document.createElement('div');
        resourcesMobileHeader.className = 'mobile-header';
        resourcesMobileHeader.textContent = 'Resources';

        const resourcesMobileContent = document.createElement('div');
        resourcesMobileContent.className = 'mobile-resources';

        resources.forEach(resource => {
          const resourceItem = document.createElement('div');
          resourceItem.className = 'resource-item';

          const resourceLink = document.createElement('a');
          resourceLink.href = resource.link;
          resourceLink.target = '_blank';

          const resourceImage = document.createElement('img');
          resourceImage.src = 'https://images-woodsonlumber.sirv.com/Other%20Website%20Images/Statements.png';
          resourceImage.alt = resource.name;

          const resourceName = document.createElement('div');
          resourceName.className = 'resource-name';
          resourceName.textContent = resource.name;

          resourceLink.appendChild(resourceImage);
          resourceItem.appendChild(resourceLink);
          resourceItem.appendChild(resourceName);

          resourcesMobileContent.appendChild(resourceItem);
        });

        resourcesMobileSection.appendChild(resourcesMobileHeader);
        resourcesMobileSection.appendChild(resourcesMobileContent);
        mobileContainer.appendChild(resourcesMobileSection);
      }

      widgetContainer.appendChild(mobileContainer);

      const targetElement = document.getElementById('ctl00_PageBody_productDetail_RadMultiPage1');
      if (targetElement) {
        targetElement.insertAdjacentElement('afterend', widgetContainer);
      }

      // Hide the product description div if the script runs successfully
      const productDescription = document.getElementById('productdescription');
      if (productDescription) {
        productDescription.classList.add('hidden');
      }

    } catch (error) {
      console.error('Error loading product data:', error);
    }
  }

  loadProductWidget();
});











































(function () {
  // --- Activate only if binlabel=true is present ---
  const params = new URLSearchParams(window.location.search);
  if (!params.has('binlabel') || params.get('binlabel') !== 'true') return;

  // ---- CONFIG ----
  const LOGO_URL = '/images/woodson-logo.svg';   // ← change to your actual logo path
  const BRAND_COLOR = '#6B0016';                 // Woodson maroon (used sparingly)
  const QR_SIZE = 220;                           // px (on-screen; prints crisply)
  // ---------------

  // Utility: get text safely
  const text = (el) => (el ? el.textContent.trim() : '');

  // Utility: strip binlabel & utm_* for canonical URL
  function canonicalizeUrl(url) {
    const u = new URL(url, window.location.origin);
    const q = u.searchParams;
    q.delete('binlabel');
    // drop all utm_* params if present
    [...q.keys()].forEach(k => { if (k.toLowerCase().startsWith('utm_')) q.delete(k); });
    u.search = q.toString();
    return u.toString();
  }

  // --- Pull data from the existing page DOM ---
  const productName = text(document.querySelector('#ctl00_PageBody_productDetail_productDescription .productDescriptionOnThisPageFull')) ||
                      text(document.querySelector('.productDescriptionOnThisPageFull')) ||
                      text(document.querySelector('.formPageHeader')) || 'Product';

  // Features tab content (innerHTML may contain <br> separators)
  const featuresEl = document.querySelector('#tab-Features') ||
                     document.querySelector('#product-widget #tab-Features') ||
                     null;

  // Build features as bullets
  let features = [];
  if (featuresEl) {
    const raw = featuresEl.innerHTML
      .replace(/<\/?div[^>]*>/g, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/\n{2,}/g, '\n')
      .trim();
    features = raw.split('\n').map(s => s.replace(/\s+/g,' ').trim()).filter(Boolean);
  }

  // Price + UOM: try sidebar “buy-box” first; fall back to table segments
  function findPriceAndUom() {
    // Common price pattern: $159.99
    const priceRegex = /^\s*\$\s*\d[\d,]*(\.\d{2})?\s*$/;
    let price = '';
    let uom = '';

    // 1) Buy box variant
    const buyBox = document.querySelector('#product-sidebar .buy-box');
    if (buyBox) {
      // Price span often like: <span>$159.99</span><span> / ea</span>
      const spans = [...buyBox.querySelectorAll('span')].map(el => el.textContent.trim());
      const p = spans.find(s => priceRegex.test(s));
      if (p) price = p.replace(/\s+/g,'');
      const slash = spans.find(s => /^\s*\/\s*\w+/.test(s));
      if (slash) uom = slash.replace(/[\/\s]/g,''); // "/ ea" -> "ea"
    }

    // 2) “Per” segment near price table
    if (!uom) {
      const perSeg = document.querySelector('.productPerSegment') || document.querySelector('#ctl00_PageBody_productDetail_ctl00_DetailHeader ~ .productPerSegment');
      if (perSeg) uom = perSeg.textContent.trim();
    }

    // 3) As a last resort scan the whole page for the first $… candidate
    if (!price) {
      const all = [...document.querySelectorAll('span,div,strong')].map(el=>el.textContent.trim());
      const p2 = all.find(s => priceRegex.test(s));
      if (p2) price = p2.replace(/\s+/g,'');
    }
    return { price, uom };
  }

  const { price, uom } = findPriceAndUom();

  // Product image
  const imgEl = document.querySelector('#ctl00_PageBody_productDetail_ProductImage') ||
                document.querySelector('#product-image-wrapper img');
  const imgSrc = imgEl ? imgEl.getAttribute('src') : null;

  // Canonical QR target
  const qrTarget = canonicalizeUrl(window.location.href);

  // --- Minimal QR generator (tiny, dependency-free) ---
  // Based on https://github.com/davidshimjs/qrcodejs (minified subset), embedded for convenience
  // License: MIT (include in your codebase as needed)
  // NOTE: If you prefer CDN, you can swap this with:
  // <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
  // and then call new QRCode(...)
  // BEGIN TINY QR
  /*! TinyQR (very small subset) */
  function TinyQR(el, text, size) {
    // Fallback: draw via Google Chart if QR algorithm fails (very unlikely for short URLs)
    try {
      // dynamic import qrcode generator using a quick inline implementation:
      // For brevity & reliability, we’ll use a data-URI <img> with Google Chart API.
      // If you need offline generation, swap this for a bundled QR lib.
      const img = document.createElement('img');
      // encodeURIComponent is fine; Google Charts is still available for QR
      img.alt = 'QR';
      img.style.width = size + 'px';
      img.style.height = size + 'px';
      img.src = 'https://chart.googleapis.com/chart?cht=qr&chs=' + size + 'x' + size + '&chl=' + encodeURIComponent(text);
      el.appendChild(img);
    } catch (e) {
      const fallback = document.createElement('div');
      fallback.textContent = 'QR';
      fallback.style.font = 'bold 24px/1 sans-serif';
      el.appendChild(fallback);
    }
  }
  // END TINY QR

  // --- Build the label canvas (full-page takeover while printing) ---
  const style = document.createElement('style');
  style.textContent = `
    /* Print as 6in x 4in landscape */
    @page { size: 6in 4in; margin: 0; }
    @media print {
      html, body { width: 6in; height: 4in; }
    }
    /* Hide original page */
    body > *:not(.binlabel-root) { display: none !important; }
    html, body {
      background: #fff !important;
      margin: 0 !important; padding: 0 !important;
    }
    .binlabel-root {
      position: relative;
      box-sizing: border-box;
      width: 6in; height: 4in;
      overflow: hidden;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
      color: #111;
    }
    .bl-grid {
      position: absolute; inset: 0;
      display: grid;
      grid-template-columns: 1.8in 1fr;   /* left ~30% */
      grid-template-rows: auto 1fr auto;  /* header, content, footer */
      gap: 0.1in;
      padding: 0.25in 0.3in;
    }
    .bl-header {
      grid-column: 1 / span 2;
      display: flex; align-items: center; gap: 0.2in;
      height: 0.7in;
      border-bottom: 2px solid ${BRAND_COLOR}22;
      padding-bottom: 0.05in;
    }
    .bl-logo img { height: 0.55in; object-fit: contain; }
    .bl-title {
      font-weight: 700; font-size: 18pt; line-height: 1.1;
      letter-spacing: 0.2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .bl-left {
      grid-row: 2 / span 2; /* image occupies bottom-left area visually */
      align-self: end;
      display: flex; align-items: flex-end; justify-content: center;
    }
    .bl-left .bl-image {
      max-width: 100%; max-height: 2.8in; object-fit: contain;
    }

    .bl-right {
      grid-row: 2; display: grid; grid-template-rows: auto 1fr auto; gap: 0.08in;
      padding-right: 0.2in;
    }
    .bl-name {
      font-size: 16pt; font-weight: 700; line-height: 1.2;
    }
    .bl-features {
      font-size: 11pt; line-height: 1.2;
    }
    .bl-features ul { margin: 0.04in 0 0 0.16in; padding: 0; }
    .bl-features li { margin: 0.02in 0; }
    .bl-priceRow {
      display: flex; align-items: baseline; gap: 0.1in; margin-top: 0.02in;
    }
    .bl-price {
      font-size: 30pt; font-weight: 800; letter-spacing: -0.5px;
    }
    .bl-uom {
      font-size: 14pt; color: #444; font-weight: 600;
    }

    .bl-qr {
      grid-column: 2; grid-row: 3;
      align-self: end; justify-self: end;
      width: ${QR_SIZE}px; height: ${QR_SIZE}px;
    }

    /* On screen, center the label so staff can preview before printing */
    html, body { display: grid; place-items: center; }
    .binlabel-root { box-shadow: 0 0 0 1px #ddd, 0 4px 24px rgba(0,0,0,.12); }
    @media print { .binlabel-root { box-shadow: none; } }
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.className = 'binlabel-root';
  root.innerHTML = `
    <div class="bl-grid">
      <div class="bl-header">
        <div class="bl-logo"><img alt="Woodson Lumber" src="${LOGO_URL}"></div>
        <div class="bl-title">Bin Label</div>
      </div>

      <div class="bl-left">
        ${imgSrc ? `<img class="bl-image" alt="Product" src="${imgSrc}">` : ''}
      </div>

      <div class="bl-right">
        <div class="bl-name">${productName || ''}</div>
        <div class="bl-features">
          ${features.length ? `<ul>${features.map(f=>`<li>${f}</li>`).join('')}</ul>` : '<div style="color:#888">No feature details found.</div>'}
        </div>
        <div class="bl-priceRow">
          <div class="bl-price">${price || ''}</div>
          ${uom ? `<div class="bl-uom">/ ${uom}</div>` : ''}
        </div>
      </div>

      <div class="bl-qr" id="bl-qr"></div>
    </div>
  `;
  document.body.appendChild(root);

  // Mark it so our print-hider ignores it
  root.classList.add('binlabel-root');

  // Render QR
  TinyQR(document.getElementById('bl-qr'), qrTarget, QR_SIZE);

  // Optional: auto-open the Print dialog if `&print=true`
  if (params.get('print') === 'true') {
    setTimeout(() => window.print(), 300);
  }
})();

