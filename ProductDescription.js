async function loadProductWidget() {
  // Function to extract the 'pid' from the URL
  function getProductIdFromUrl() {
    const urlParams = window.location.search;
    const pidMatch = urlParams.match(/pid=([^&]*)/);
    return pidMatch ? decodeURIComponent(pidMatch[1]) : null;
  }

  // Function to dynamically insert styles
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

      @media (max-width: 768px) {
        .tab-menu {
          display: none;
        }

        .mobile-header {
          padding: 15px;
          background-color: #e0e0e0;
          font-weight: bold;
          border: 1px solid #ccc;
          border-radius: 5px;
          margin-bottom: 10px;
          cursor: pointer;
        }

        .mobile-header.active {
          background-color: #6b0016;
          color: #fff;
        }

        .mobile-section {
          display: none;
          padding: 15px;
          background-color: #fff;
          border: 1px solid #ddd;
          border-radius: 5px;
          margin-bottom: 10px;
        }

        .mobile-section.active {
          display: block;
        }
      }
    `;
    document.head.appendChild(styleElement);
  }

  // Function to parse CSV data correctly
  function parseCSV(csvText) {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let insideQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];

      if (char === '"') {
        if (insideQuotes && csvText[i + 1] === '"') {
          // Escaped double quote within a quoted field
          currentField += '"';
          i++;
        } else {
          // Toggle insideQuotes
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        // End of field
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n' && !insideQuotes) {
        // End of row
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        // Regular character
        currentField += char;
      }
    }

    // Push the last field and row
    if (currentField) currentRow.push(currentField.trim());
    if (currentRow.length > 0) rows.push(currentRow);

    return rows;
  }

  // Function to handle tab switching on desktop
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

  // Function to handle mobile header toggling
  function toggleMobileSection(header) {
    const headerElement = document.querySelector(`.mobile-header[data-header="${header}"]`);
    const sectionElement = document.querySelector(`.mobile-section[data-header="${header}"]`);

    if (headerElement && sectionElement) {
      const isActive = headerElement.classList.contains('active');

      document.querySelectorAll('.mobile-header').forEach(hdr => hdr.classList.remove('active'));
      document.querySelectorAll('.mobile-section').forEach(sec => sec.classList.remove('active'));

      if (!isActive) {
        headerElement.classList.add('active');
        sectionElement.classList.add('active');
      }
    }
  }

  // Get the current productId from the URL
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

    // Extract headers
    const headers = rows.shift();

    // Filter rows matching the productId
    const productRows = rows.filter(row => row[0].trim() === productId);

    if (!productRows.length) {
      console.warn('No data found for this product:', productId);
      return;
    }

    // Organize data by tabs
    const tabData = {};
    headers.forEach((header, index) => {
      if (index === 0) return; // Skip productId column
      tabData[header] = productRows.map(row => row[index]).filter(content => content.trim() !== '');
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
    });

    const targetElement = document.getElementById('ctl00_PageBody_productDetail_RadMultiPage1');
    if (targetElement) {
      targetElement.insertAdjacentElement('afterend', widgetContainer);
    }

  } catch (error) {
    console.error('Error loading product data:', error);
  }
}

loadProductWidget();
