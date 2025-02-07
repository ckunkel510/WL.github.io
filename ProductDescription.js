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
      const resourcesSection = document.createElement('div');
      resourcesSection.className = 'mobile-section';

      const resourcesHeader = document.createElement('div');
      resourcesHeader.className = 'mobile-header';
      resourcesHeader.textContent = 'Resources';

      const resourcesContent = document.createElement('div');
      resourcesContent.className = 'mobile-resources';

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

        resourcesContent.appendChild(resourceItem);
      });

      resourcesSection.appendChild(resourcesHeader);
      resourcesSection.appendChild(resourcesContent);
      mobileContainer.appendChild(resourcesSection);
    }

    widgetContainer.appendChild(mobileContainer);

    const targetElement = document.getElementById('ctl00_PageBody_productDetail_RadMultiPage1');
    if (targetElement) {
      targetElement.insertAdjacentElement('afterend', widgetContainer);
    }

  } catch (error) {
    console.error('Error loading product data:', error);
  }
}

loadProductWidget();
