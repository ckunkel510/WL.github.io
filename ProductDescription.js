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
  const params = new URLSearchParams(location.search);
  if (params.get('binlabel') !== 'true') return;

  // ---------- helpers ----------
  const text = (el) => (el ? el.textContent.trim() : '');
  const abs  = (src) => src && /^https?:\/\//i.test(src) ? src : (src ? new URL(src, location.origin).toString() : '');

  function canonicalizeUrl(url) {
    const u = new URL(url, location.origin);
    const sp = u.searchParams;
    sp.delete('binlabel');
    [...sp.keys()].forEach(k => { if (k.toLowerCase().startsWith('utm_')) sp.delete(k); });
    u.search = sp.toString();
    return u.toString();
  }

  // ---------- page data ----------
  const logoEl  = document.querySelector('img[src*="WebTrackImage_"]') || document.querySelector('img[src*="/images/user_content/"]');
  const logoSrc = abs(logoEl ? logoEl.getAttribute('src') : '');

  const productName =
    text(document.querySelector('#ctl00_PageBody_productDetail_productDescription .productDescriptionOnThisPageFull')) ||
    text(document.querySelector('.productDescriptionOnThisPageFull')) ||
    text(document.querySelector('#product-main .productNameLink')) ||
    text(document.querySelector('.formPageHeader')) || 'Product';

  function extractFeaturesFrom(htmlStr) {
    if (!htmlStr) return [];
    return htmlStr
      .replace(/<\/?div[^>]*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/&nbsp;/g, ' ')
      .split('\n')
      .map(s => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  }

  function getFeaturesOnce() {
    // Desktop tab
    const featuresEl = document.querySelector('#product-widget #tab-content #tab-Features');
    if (featuresEl && featuresEl.innerHTML.trim()) return extractFeaturesFrom(featuresEl.innerHTML);

    // Mobile section
    const mobileSec = [...document.querySelectorAll('#product-widget .mobile-section')]
      .find(s => /Features/i.test(text(s.querySelector('.mobile-header'))));
    if (mobileSec) {
      const mobileHTML = mobileSec.querySelector('.mobile-content')?.innerHTML || '';
      if (mobileHTML.trim()) return extractFeaturesFrom(mobileHTML);
    }

    // Active tab fallback when Features is selected
    const activeTab = document.querySelector('#product-widget #tab-content .tab-section.active');
    const tabBtn = [...document.querySelectorAll('#product-widget #tab-menu button')].find(b => b.classList.contains('active'));
    if (activeTab && /Features/i.test(tabBtn?.getAttribute('data-header') || '')) {
      return extractFeaturesFrom(activeTab.innerHTML);
    }

    return [];
  }

  // Try immediately, then once more after a tick (in case the widget hydrates after load)
  let features = getFeaturesOnce();
  setTimeout(() => { if (!features.length) features = getFeaturesOnce(); }, 150);

  function findPriceAndUom() {
    const priceRegex = /^\$?\s*\d[\d,]*(\.\d{2})?$/;
    let price = '', uom = '';

    const buyBox = document.querySelector('#product-sidebar .buy-box');
    if (buyBox) {
      const spans = [...buyBox.querySelectorAll('span')].map(s => s.textContent.trim());
      const p = spans.find(s => priceRegex.test(s.replace(/^\$/, '')));
      if (p) price = p.startsWith('$') ? p : ('$' + p);
      const slash = spans.find(s => /^\s*\/\s*\w+/.test(s));
      if (slash) uom = slash.replace(/[\/\s]/g, '');
    }
    if (!uom) {
      const perSeg = document.querySelector('.productPerSegment');
      if (perSeg) uom = perSeg.textContent.trim();
    }
    if (!price) {
      const txts = [...document.querySelectorAll('#product-sidebar .buy-box span, .productPriceSegment span, span, strong')]
        .map(el => el.textContent.trim());
      const p2 = txts.find(s => /^\$[\d,]+(\.\d{2})?$/.test(s));
      if (p2) price = p2;
    }
    return { price, uom };
  }
  const { price, uom } = findPriceAndUom();

  const imgEl  = document.querySelector('#ctl00_PageBody_productDetail_ProductImage') ||
                 document.querySelector('#product-image-wrapper img') ||
                 document.querySelector('#main-block img');
  const imgSrc = abs(imgEl ? imgEl.getAttribute('src') : '');

  const qrTarget = canonicalizeUrl(location.href);

  // ---------- QR with robust fallback ----------
  const QR_SIZE = 180; // slightly smaller so it never crowds the footer

  function loadScript(src, timeoutMs = 2000) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      let done = false, t;
      s.src = src; s.async = true;
      s.onload = () => { if (!done) { done = true; clearTimeout(t); resolve(); } };
      s.onerror = () => { if (!done) { done = true; clearTimeout(t); reject(new Error('load error')); } };
      document.head.appendChild(s);
      t = setTimeout(() => { if (!done) { done = true; reject(new Error('timeout')); } }, timeoutMs);
    });
  }

  async function renderQR(el, text, size) {
    try {
      if (!window.QRCode) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js', 2500);
      }
      if (window.QRCode) {
        el.innerHTML = '';
        new QRCode(el, { text, width: size, height: size, correctLevel: window.QRCode.CorrectLevel.M });
        return true;
      }
    } catch (_) {}

    // Fallback: Google Chart PNG
    try {
      const img = new Image();
      img.alt = 'QR';
      img.width = size; img.height = size;
      img.referrerPolicy = 'no-referrer';
      img.src = 'https://chart.googleapis.com/chart?cht=qr&chs=' + size + 'x' + size + '&chl=' + encodeURIComponent(text);
      await new Promise((res, rej) => {
        img.onload = () => res(true);
        img.onerror = () => rej(new Error('qr img fail'));
        setTimeout(() => rej(new Error('qr img timeout')), 2500);
      });
      el.innerHTML = ''; el.appendChild(img);
      return true;
    } catch (_) {}

    // Last resort: URL box (never fails)
    const box = document.createElement('div');
    box.style.width = size + 'px';
    box.style.height = size + 'px';
    box.style.border = '2px solid #111';
    box.style.borderRadius = '6px';
    box.style.display = 'flex';
    box.style.flexDirection = 'column';
    box.style.alignItems = 'center';
    box.style.justifyContent = 'center';
    box.style.padding = '8px';
    box.style.textAlign = 'center';
    box.innerHTML = `
      <div style="font:700 13px/1.2 sans-serif;margin-bottom:6px;">Scan URL</div>
      <div style="font:11px/1.2 monospace;word-break:break-all;max-width:${size-16}px">${text}</div>
    `;
    el.innerHTML = ''; el.appendChild(box);
    return false;
  }

  // ---------- styles (4x6 landscape, safer scaling) ----------
  const BRAND_COLOR = '#6B0016';
  const style = document.createElement('style');
  style.textContent = `
    @page { size: 6in 4in; margin: 0; }
    @media print { html, body { width: 6in; height: 4in; } }
    body > *:not(.binlabel-root) { display: none !important; }
    html, body { background:#fff!important; margin:0!important; padding:0!important; }

    .binlabel-root {
      position:relative; box-sizing:border-box; width:6in; height:4in; overflow:hidden;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color:#111;
    }
    .bl-grid {
      position:absolute; inset:0;
      display:grid;
      grid-template-columns: 2.0in 1fr; /* give image a hair more room but cap its max-height */
      grid-template-rows: auto 1fr auto;
      gap: 0.1in;
      padding: 0.2in 0.25in; /* slightly tighter padding to keep everything inside */
    }

    .bl-header {
      grid-column: 1 / span 2;
      display:flex; align-items:center; gap:0.18in;
      min-height: 0.55in;
      border-bottom: 2px solid ${BRAND_COLOR}22;
      padding-bottom: 0.04in;
    }
    .bl-logo img {
      max-height: 0.5in; width:auto; object-fit:contain; background:#fff; padding:0.03in; border-radius:4px;
    }
    .bl-title {
      font-weight:700; font-size: 15pt; line-height:1.1;
      letter-spacing: 0.2px; max-height: 0.5in; overflow: hidden;
      display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; /* clamp long names */
    }

    .bl-left {
      grid-row: 2 / span 2;
      display:flex; align-items:flex-end; justify-content:center;
      overflow:hidden; /* prevent spillover */
      padding: 0 0.05in 0.05in 0; /* tiny breathing room */
    }
    .bl-left .bl-image {
      max-width: 100%;
      max-height: 2.4in; /* lowered to ensure QR + footer always fit */
      height:auto; width:auto;
      object-fit: contain;
      display:block;
    }

    .bl-right {
      grid-row: 2; display:grid; grid-template-rows: auto 1fr auto; gap: 0.06in;
      padding-right: 0.1in; min-width: 0; /* allow shrinking */
    }
    .bl-name { display:none; } /* moved name into header */
    .bl-features { font-size: 10.5pt; line-height: 1.25; overflow:hidden; }
    .bl-features ul { margin: 0.03in 0 0 0.16in; padding: 0; }
    .bl-features li { margin: 0.01in 0; }

    .bl-priceRow {
      display:flex; align-items:baseline; gap: 0.07in; margin-top: 0.02in;
      flex-wrap: wrap;
    }
    .bl-price { font-size: 26pt; font-weight: 800; letter-spacing: -0.3px; }
    .bl-uom { font-size: 13pt; color:#444; font-weight:600; }

    .bl-qr {
      grid-column: 2; grid-row: 3;
      align-self: end; justify-self: end;
      width: ${QR_SIZE}px; height: ${QR_SIZE}px;
      margin-right: 0.05in; margin-bottom: 0.05in; /* keep it inside bounds */
      overflow:hidden;
    }

    /* Center on screen for preview */
    html, body { display:grid; place-items:center; }
    .binlabel-root { box-shadow: 0 0 0 1px #ddd, 0 4px 24px rgba(0,0,0,.12); }
    @media print { .binlabel-root { box-shadow:none; } }
  `;
  document.head.appendChild(style);

  // ---------- render ----------
  const root = document.createElement('div');
  root.className = 'binlabel-root';
  root.innerHTML = `
    <div class="bl-grid">
      <div class="bl-header">
        <div class="bl-logo">${logoSrc ? `<img alt="Woodson Lumber" src="${logoSrc}">` : ''}</div>
        <div class="bl-title">${productName}</div>
      </div>

      <div class="bl-left">
        ${imgSrc ? `<img class="bl-image" alt="Product" src="${imgSrc}">` : ''}
      </div>

      <div class="bl-right">
        <div class="bl-features" id="bl-features-slot">
          ${features.length ? `<ul>${features.map(f => `<li>${f}</li>`).join('')}</ul>` : '<div style="color:#888">Loading features…</div>'}
        </div>
        <div class="bl-priceRow">
          <div class="bl-price">${(price || '')}</div>
          ${uom ? `<div class="bl-uom">/ ${uom}</div>` : ''}
        </div>
      </div>

      <div class="bl-qr" id="bl-qr"></div>
    </div>
  `;
  document.body.appendChild(root);

  // second-pass fill for features after 150ms retry (if first read was empty)
  setTimeout(() => {
    if (!features.length) {
      const retry = getFeaturesOnce();
      if (retry.length) {
        const slot = document.getElementById('bl-features-slot');
        if (slot) slot.innerHTML = `<ul>${retry.map(f => `<li>${f}</li>`).join('')}</ul>`;
      } else {
        const slot = document.getElementById('bl-features-slot');
        if (slot) slot.innerHTML = '<div style="color:#888">No feature details found.</div>';
      }
    }
  }, 170);

  // Draw QR (will always render something, even if libraries/network fail)
  renderQR(document.getElementById('bl-qr'), canonicalizeUrl(location.href), QR_SIZE);

  if (params.get('print') === 'true') setTimeout(() => window.print(), 300);
})();


