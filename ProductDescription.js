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












































document.addEventListener('DOMContentLoaded', function () {
(function () {
  const params = new URLSearchParams(location.search);
  if (params.get('binlabel') !== 'true') return;

  const BRAND = '#6B0016';
  const log = (...a) => { try { console.debug('[binlabel]', ...a); } catch {} };

  /* ------------ helpers ------------ */
  const text = (el) => (el ? el.textContent.trim() : '');
  const abs  = (src) => src && /^https?:\/\//i.test(src) ? src : (src ? new URL(src, location.origin).toString() : '');
  function canonicalizeUrl(url) {
    const u = new URL(url, location.origin);
    const sp = u.searchParams;
    sp.delete('binlabel');
    [...sp.keys()].forEach(k => { if (k.toLowerCase().startsWith('utm')) sp.delete(k); });
    u.search = sp.toString();
    return u.toString();
  }
  function loadScript(src, timeoutMs = 2500) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script'); let done=false, t;
      s.src = src; s.async = true;
      s.onload = () => { if (!done){done=true;clearTimeout(t);resolve();} };
      s.onerror = (e) => { if (!done){done=true;clearTimeout(t);reject(e||new Error('load error'));} };
      document.head.appendChild(s);
      t = setTimeout(()=>{ if(!done){done=true;reject(new Error('timeout'));} }, timeoutMs);
    });
  }
  const printDateStr = () => {
    try { return new Date().toLocaleDateString('en-US'); } catch { return new Date().toISOString().slice(0,10); }
  };

  /* ------------ extract page data ------------ */
  function getProductData() {
    const logoEl  = document.querySelector('img[src*="WebTrackImage_"]') || document.querySelector('img[src*="/images/user_content/"]');
    const logoSrc = abs(logoEl ? logoEl.getAttribute('src') : '');

    const productName =
      text(document.querySelector('#ctl00_PageBody_productDetail_productDescription .productDescriptionOnThisPageFull')) ||
      text(document.querySelector('.productDescriptionOnThisPageFull')) ||
      text(document.querySelector('#product-main .productNameLink')) ||
      (text(document.querySelector('.formPageHeader')).replace(/^Product Code:\s*\d+\s*$/i,'').trim()) ||
      'Product';

    function getProductCode() {
      const header = text(document.querySelector('.formPageHeader'));
      const m = header.match(/Product\s*Code:\s*([A-Za-z0-9\-]+)/i);
      if (m) return m[1];
      const codeSpan = document.querySelector('.productCodeOnSummaryPage');
      if (codeSpan) return text(codeSpan).replace(/\s+/g,'');
      return '';
    }
    const productCode = getProductCode();

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
        const txts = [...document.querySelectorAll('#product-sidebar .buy-box span, .productPriceSegment span, span, strong')].map(el => el.textContent.trim());
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

    function extractFeaturesFrom(htmlStr) {
      if (!htmlStr) return [];
      return htmlStr.replace(/<\/?div[^>]*>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/&nbsp;/g, ' ')
                    .split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
    }
    function readFeaturesOnce() {
      const featuresEl = document.querySelector('#product-widget #tab-content #tab-Features');
      if (featuresEl && featuresEl.innerHTML.trim()) return extractFeaturesFrom(featuresEl.innerHTML);
      const mobileSec = [...document.querySelectorAll('#product-widget .mobile-section')]
        .find(s => /Features/i.test(text(s.querySelector('.mobile-header'))));
      if (mobileSec) {
        const mobileHTML = mobileSec.querySelector('.mobile-content')?.innerHTML || '';
        if (mobileHTML.trim()) return extractFeaturesFrom(mobileHTML);
      }
      const tabBtn = [...document.querySelectorAll('#product-widget #tab-menu button')].find(b => b.classList.contains('active'));
      const activeTab = document.querySelector('#product-widget #tab-content .tab-section.active');
      if (activeTab && /Features/i.test(tabBtn?.getAttribute('data-header') || '')) {
        return extractFeaturesFrom(activeTab.innerHTML);
      }
      return [];
    }

    return { logoSrc, productName, productCode, price, uom, imgSrc, readFeaturesOnce };
  }

  /* ------------ QR & Barcode ------------ */
  async function drawQR(container, sizePx, urlText) {
    try {
      if (!window.QRCode) { try { await loadScript('/scripts/qrcode.min.js', 1200); } catch {} }
      if (!window.QRCode) { try { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'); } catch {} }
      if (window.QRCode) {
        container.innerHTML = '';
        new QRCode(container, { text: urlText, width: sizePx, height: sizePx, correctLevel: (window.QRCode.CorrectLevel||{}).M || 1 });
        return;
      }
      const img = new Image();
      img.alt = 'QR'; img.width = sizePx; img.height = sizePx; img.referrerPolicy = 'no-referrer';
      img.src = 'https://chart.googleapis.com/chart?cht=qr&chs=' + sizePx + 'x' + sizePx + '&chl=' + encodeURIComponent(urlText);
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; setTimeout(()=>rej(new Error('timeout')), 2500); });
      container.innerHTML=''; container.appendChild(img);
    } catch {
      container.innerHTML = `<div style="width:${sizePx}px;height:${sizePx}px;border:2px solid #111;border-radius:6px;display:flex;align-items:center;justify-content:center;padding:8px;text-align:center;font:11px monospace;word-break:break-all">${urlText}</div>`;
    }
  }
  async function drawBarcode(svgEl, code, opts) {
    try {
      if (!code) { svgEl.outerHTML = `<div style="font:12px monospace;color:#444">No product code</div>`; return; }
      if (!window.JsBarcode) { try { await loadScript('/scripts/JsBarcode.all.min.js', 1200); } catch {} }
      if (!window.JsBarcode) { try { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js'); } catch {} }
      if (window.JsBarcode) {
        svgEl.innerHTML = '';
        window.JsBarcode(svgEl, code, Object.assign({ format: 'CODE128', displayValue: true }, opts || {}));
        return;
      }
      svgEl.outerHTML = `<div style="font:12px monospace;color:#444">CODE128: ${code}</div>`;
    } catch {
      svgEl.outerHTML = `<div style="font:12px monospace;color:#444">Barcode error</div>`;
    }
  }

  /* ------------ size presets & builder ------------ */
  const SIZES = {
    // 1×2 — NO logo, bigger price, code above barcode (left), barcode bottom-left, QR bottom-right
    '1x2':   { w: 2,   h: 1,   qr: 70,  imgMaxH: 0,     showImage:false, showFeatures:false,  priceFs: 18,  uomFs: 11,  titleClamp:1, cta:false, featFs: 0, gridCols: '1fr' },
    // 3×5 index card
    '3x5':   { w: 5,   h: 3,   qr: 100, imgMaxH: 1.6,   showImage:true,  showFeatures:true,   priceFs: 20,  uomFs: 12,  titleClamp:2, cta:true,  featFs: 11, gridCols: 'calc(0.42 * var(--w)) 1fr' },
    // 4×6 — bigger image; features nudged right + slightly larger font
    '4x6':   { w: 6,   h: 4,   qr: 120, imgMaxH: 2.7,   showImage:true,  showFeatures:true,   priceFs: 22,  uomFs: 12,  titleClamp:2, cta:true,  featFs: 12, featIndent: '0.12in', gridCols: '44% 56%' },
    // 8.5×11 — much bigger image; larger features font
    'letter':{ w: 8.5, h: 11,  qr: 180, imgMaxH: 8.0,   showImage:true,  showFeatures:true,   priceFs: 32,  uomFs: 16,  titleClamp:3, cta:true,  featFs: 15, gridCols: '48% 52%' }
  };

  function makeStyle(key, cfg){
    const s = document.createElement('style');
    s.setAttribute('data-bl-style', key);
    s.textContent = `
      :root { --w:${cfg.w}in; --h:${cfg.h}in; --brand:${BRAND}; }
      @page { size: var(--w) var(--h); margin:0; }

      html, body { margin:0!important; padding:0!important; background:#fff!important; display:grid; place-items:center; }
      @media print {
        html, body { display:block !important; width: var(--w) !important; height: var(--h) !important; }
        body > *:not(.binlabel-root) { display:none !important; }
        [id^="bl-print-"] { display:none !important; } /* ensure buttons never print */
        .binlabel-root { box-shadow:none !important; margin:0 !important; position:static !important; left:0 !important; top:0 !important; transform:none !important; }
      }

      .binlabel-root {
        position:relative; box-sizing:border-box; width:var(--w); height:var(--h); overflow:hidden;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color:#111;
        box-shadow: 0 0 0 1px #ddd, 0 4px 24px rgba(0,0,0,.12);
        z-index: 2147483000;
      }
      .bl-grid {
        position:absolute; inset:0;
        display:grid;
        grid-template-columns: ${cfg.showImage ? cfg.gridCols : '1fr'};
        grid-template-rows: auto 1fr auto; /* footer row added */
        gap: calc(0.02 * var(--w));
        padding: calc(0.03 * var(--w)) calc(0.035 * var(--w));
        overflow:hidden;
      }
      .bl-header {
        grid-column: 1 / -1;
        display:flex; align-items:center; gap: calc(0.03 * var(--w));
        min-height: ${key==='1x2' ? '0.28in' : 'calc(0.14 * var(--h))'};
        border-bottom: 2px solid var(--brand)22;
        padding-bottom: calc(0.01 * var(--w));
        overflow:hidden;
      }
      .bl-logo { ${key==='1x2' ? 'display:none;' : ''} }
      .bl-logo img { max-height: calc(0.12 * var(--h)); width:auto; object-fit:contain; background:#fff; padding:0.03in; border-radius:4px; }
      .bl-title {
        font-weight:700; line-height:1.1; letter-spacing: 0.2px; overflow:hidden;
        display:-webkit-box; -webkit-line-clamp:${cfg.titleClamp}; -webkit-box-orient:vertical;
        font-size: clamp(10pt, calc(0.09 * var(--w)), 18pt);
      }
      .bl-code { margin-left:auto; font-weight:700; color:#333; font-size: clamp(9pt, calc(0.06 * var(--w)), 12pt); }

      .bl-left { ${cfg.showImage ? 'display:flex;' : 'display:none;'} grid-row:2; grid-column:1; align-items:center; justify-content:center; overflow:hidden; padding: 0 0.04in 0.04in 0; }
      .bl-left .bl-image { max-width:100%; ${cfg.imgMaxH ? `max-height:${cfg.imgMaxH}in;`:'max-height:0;'} height:auto; width:auto; object-fit:contain; display:block; }

      .bl-right { grid-row:2; grid-column:${cfg.showImage ? 2 : 1}; display:grid; grid-template-rows: 1fr auto; gap: 0.06in; min-width:0; overflow:hidden; }
      .bl-features { ${cfg.showFeatures ? '' : 'display:none;'} font-size: ${cfg.featFs ? cfg.featFs+'pt' : '11pt'}; line-height:1.26; overflow:hidden; ${cfg.featIndent ? `margin-left:${cfg.featIndent};` : ''} }
      .bl-features ul { margin: 0.03in 0 0 0.16in; padding:0; }
      .bl-features li { margin: 0.01in 0; }

      .bl-priceQr {
        display:grid;
        ${key==='1x2'
          ? `grid-template-columns: 1fr 1fr; grid-template-rows: auto 1fr;`
          : `grid-template-columns: 1fr auto; grid-template-rows: auto auto auto;`}
        align-items:end; column-gap: 0.08in;
      }
      .bl-price { grid-column:${key==='1x2' ? '1 / span 2' : '2'}; grid-row:1; font-size:${cfg.priceFs}pt; font-weight:800; letter-spacing:-0.2px; text-align:${key==='1x2' ? 'center' : 'right'}; margin:${key==='1x2' ? '0' : '0 0.02in 0 0'}; }
      .bl-uom { font-size:${cfg.uomFs}pt; color:#444; font-weight:600; }
      .bl-cta { ${cfg.cta ? '' : 'display:none;'} grid-column:1; grid-row:2; align-self:end; justify-self:start; font-size: clamp(9pt, calc(0.04 * var(--w)), 11pt); font-weight:700; color: var(--brand); white-space:nowrap; }

      /* QR & barcode positions */
      ${key==='1x2' ? `
        .bl-qr { grid-column:2; grid-row:2; justify-self:end; align-self:end; width:${cfg.qr}px; height:${cfg.qr}px; }
        .bl-bar-left { grid-column:1; grid-row:2; justify-self:start; align-self:end; background:#fff; padding:2px 4px; border-radius:4px; }
      ` : `
        .bl-qr { grid-column:2; grid-row:2; width:${cfg.qr}px; height:${cfg.qr}px; justify-self:end; align-self:end; margin-right:0.02in; margin-bottom:0.02in; overflow:hidden; }
        .bl-barcode { grid-column:2; grid-row:3; justify-self:end; align-self:end; margin-right:0.02in; background:#fff; padding:2px 4px; border-radius:4px; }
      `}

      /* Footer (print date) */
      .bl-footer {
        grid-column: 1 / -1;
        grid-row: 3;
        display:flex; align-items:center; justify-content:flex-start;
        font-size: 9pt; color:#666; border-top: 1px solid #eee; padding-top: 0.04in;
      }
    `;
    return s;
  }

  function clampFeaturesToFit(container) {
    // Remove bullets from the end until content fits without vertical overflow; add ellipsis
    if (!container) return;
    const ul = container.querySelector('ul');
    if (!ul) return;
    const items = Array.from(ul.children);
    if (!items.length) return;

    // If it already fits, do nothing
    if (container.scrollHeight <= container.clientHeight + 1) return;

    // Remove from end until it fits, then append an ellipsis marker
    while (items.length && container.scrollHeight > container.clientHeight + 1) {
      const li = items.pop();
      if (li && li.parentNode) li.parentNode.removeChild(li);
    }
    if (ul.lastElementChild && ul.lastElementChild.textContent.trim().slice(-1) !== '…') {
      const last = ul.lastElementChild;
      if (last) last.textContent = last.textContent.replace(/\.*\s*$/, '') + ' …';
    }
  }

  function buildLabel(sizeKey) {
    try {
      const cfg = SIZES[sizeKey] || SIZES['4x6'];
      const data = getProductData();

      const styleEl = makeStyle(sizeKey, cfg);
      document.head.appendChild(styleEl);

      const root = document.createElement('div');
      root.className = 'binlabel-root';
      root.innerHTML = `
        <div class="bl-grid">
          <div class="bl-header">
            <div class="bl-logo">${sizeKey!=='1x2' && data.logoSrc ? `<img alt="Woodson Lumber" src="${data.logoSrc}">` : ''}</div>
            <div class="bl-title">${data.productName}</div>
            <div class="bl-code">${data.productCode ? `Code: ${data.productCode}` : ''}</div>
          </div>

          <div class="bl-left">
            ${cfg.showImage && data.imgSrc ? `<img class="bl-image" alt="Product" src="${data.imgSrc}">` : ''}
          </div>

          <div class="bl-right">
            <div class="bl-features" id="bl-features-slot">${cfg.showFeatures ? `<div style="color:#888">Loading features…</div>` : ''}</div>
            <div class="bl-priceQr">
              <div class="bl-cta">Learn more online →</div>
              <div class="bl-price">${data.price || ''} ${data.uom ? `<span class="bl-uom">/ ${data.uom}</span>` : ''}</div>
              <div class="bl-qr" id="bl-qr"></div>
              ${sizeKey==='1x2'
                ? `<div style="grid-column:1;grid-row:1;justify-self:start;align-self:center;font-weight:700;font-size:10pt;color:#333;display:${data.productCode?'block':'none'}">Code: ${data.productCode||''}</div>
                   <svg class="bl-bar-left" id="bl-barcode" width="${Math.max(120, cfg.qr+10)}" height="${Math.max(40, Math.round(cfg.qr*0.6))}"></svg>`
                : `<svg class="bl-barcode" id="bl-barcode" width="${Math.max(120, cfg.qr)}" height="${Math.max(36, Math.round(cfg.qr*0.5))}"></svg>`}
            </div>
          </div>

          <div class="bl-footer">
            Printed: ${printDateStr()}
          </div>
        </div>
      `;
      document.body.appendChild(root);

      // hide site chrome (keep buttons visible on screen; they won't print)
      [...document.body.children].forEach(ch => {
        if (ch === root) return;
        const rawId = (ch && (ch.id ?? (ch.getAttribute && ch.getAttribute('id')))) || '';
        const isPrintBtn = String(rawId).indexOf('bl-print-') === 0;
        if (!isPrintBtn) ch.setAttribute('data-bl-hide','1');
      });
      [...document.querySelectorAll('[data-bl-hide="1"]')].forEach(n => n.style.setProperty('display','none','important'));

      // features (non-blocking + clamp to fit on 3x5 and 4x6)
      const shouldClamp = (sizeKey === '3x5' || sizeKey === '4x6' || sizeKey === 'letter'); // letter also clamps just in case
      if (cfg.showFeatures) {
        const slot = root.querySelector('#bl-features-slot');
        const setList = (arr) => {
          if (!slot) return;
          slot.innerHTML = arr.length ? `<ul>${arr.map(f=>`<li>${f}</li>`).join('')}</ul>` : '<div style="color:#888">No feature details found.</div>';
          if (shouldClamp) clampFeaturesToFit(slot);
        };
        let feats = getProductData().readFeaturesOnce(); // fresh call in case DOM changed
        if (feats.length) setList(feats);
        let tries = 0;
        const t = setInterval(() => {
          if ((feats.length && (!shouldClamp || slot.querySelector('ul'))) || tries > 12) { clearInterval(t); return; }
          tries++;
          const a = getProductData().readFeaturesOnce();
          if (a.length) { feats = a; setList(feats); clearInterval(t); }
        }, 250);
        const widget = document.querySelector('#product-widget');
        if (widget) {
          const mo = new MutationObserver(() => {
            if (feats.length) { mo.disconnect(); return; }
            const a = getProductData().readFeaturesOnce();
            if (a.length) { feats = a; setList(feats); mo.disconnect(); }
          });
          mo.observe(widget, { childList:true, subtree:true });
        }
        // safety clamp after images/fonts layout
        setTimeout(()=> slot && shouldClamp && clampFeaturesToFit(slot), 150);
      }

      // QR + barcode
      drawQR(root.querySelector('#bl-qr'), cfg.qr, canonicalizeUrl(location.href));
      drawBarcode(root.querySelector('#bl-barcode'), data.productCode, {
        lineColor: '#000', font: 'monospace',
        fontSize: Math.max(10, Math.round(cfg.qr*0.22)),
        height: Math.max(30, Math.round(cfg.qr*0.5)),
        margin: 0, textMargin: 2, width: sizeKey==='1x2' ? 1.2 : 1.4
      });

      // print
      setTimeout(() => window.print(), 250);

      // cleanup
      const cleanup = () => {
        try {
          if (root && root.parentNode) root.parentNode.removeChild(root);
          if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
          [...document.querySelectorAll('[data-bl-hide="1"]')].forEach(n => { n.style.removeProperty('display'); n.removeAttribute('data-bl-hide'); });
        } catch {}
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);

    } catch (e) {
      console.error('[binlabel] build error', e);
      alert('Could not build label. See console for details.');
    }
  }

  /* ------------ print buttons (UI) ------------ */
  function makeBtn(id, label, sizeKey, topPx) {
    const btn = document.createElement('button');
    btn.id = id; btn.textContent = label; btn.type = 'button';
    btn.style.cssText = `
      position: fixed; right: 10px; top:${topPx}px; z-index: 2147483647;
      background: ${BRAND}; color: #fff; border: 0; border-radius: 8px;
      padding: 8px 12px; font-weight: 700; cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,.18);
    `;
    btn.addEventListener('click', (e) => { e.preventDefault(); buildLabel(sizeKey); });
    return btn;
  }
  const b1 = makeBtn('bl-print-1x2',   'Print 1×2',     '1x2',    10);
  const b2 = makeBtn('bl-print-3x5',   'Print 3×5',     '3x5',    52);
  const b3 = makeBtn('bl-print-4x6',   'Print 4×6',     '4x6',    94);
  const b4 = makeBtn('bl-print-let',   'Print 8.5×11',  'letter', 136);
  document.body.appendChild(b1); document.body.appendChild(b2);
  document.body.appendChild(b3); document.body.appendChild(b4);

  log('Bin label buttons ready.');
})();
});













