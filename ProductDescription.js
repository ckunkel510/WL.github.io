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

      /* Mobile styles */
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

  // Function to handle tab switching on desktop
  function switchTab(header) {
    document.querySelectorAll('.tab-menu button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-section').forEach(sec => {
      sec.style.display = 'none';
      sec.classList.remove('active');
    });

    // Activate selected tab
    const tabButton = Array.from(document.querySelectorAll('.tab-menu button'))
      .find(btn => btn.textContent === header);
    if (tabButton) tabButton.classList.add('active');

    const activeSection = document.getElementById(`tab-${header}`);
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

      // Collapse all sections
      document.querySelectorAll('.mobile-header').forEach(hdr => hdr.classList.remove('active'));
      document.querySelectorAll('.mobile-section').forEach(sec => sec.classList.remove('active'));

      // Toggle the clicked section
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
    // Insert styles
    insertStyles();

    // Fetch and parse CSV data
    const response = await fetch(csvUrl);
    const csvData = await response.text();
    const rows = csvData.split('\n').map(row => row.split(','));

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

    // Dynamically create the entire widget
    const widgetContainer = document.createElement('div');
    widgetContainer.id = 'product-widget';
    widgetContainer.className = 'product-widget-container';

    // Create the tab menu (for desktop)
    const tabMenu = document.createElement('div');
    tabMenu.id = 'tab-menu';
    tabMenu.className = 'tab-menu';
    widgetContainer.appendChild(tabMenu);

    // Create the tab content container (for desktop)
    const tabContent = document.createElement('div');
    tabContent.id = 'tab-content';
    tabContent.className = 'tab-content';
    widgetContainer.appendChild(tabContent);

    // Generate tabs and content
    Object.keys(tabData).forEach((header, tabIndex) => {
      if (tabData[header].length === 0) return; // Skip empty tabs

      // Desktop: Create tab button and section
      const tabButton = document.createElement('button');
      tabButton.textContent = header;
      tabButton.className = tabIndex === 0 ? 'active' : '';
      tabButton.addEventListener('click', () => switchTab(header));
      tabMenu.appendChild(tabButton);

      const section = document.createElement('div');
      section.className = `tab-section ${tabIndex === 0 ? 'active' : ''}`;
      section.style.display = tabIndex === 0 ? 'block' : 'none';
      section.innerHTML = tabData[header].join('<br>');
      section.id = `tab-${header}`;
      tabContent.appendChild(section);

      // Mobile: Create collapsible header and section
      const mobileHeader = document.createElement('div');
      mobileHeader.className = 'mobile-header';
      mobileHeader.textContent = header;
      mobileHeader.setAttribute('data-header', header);
      mobileHeader.addEventListener('click', () => toggleMobileSection(header));
      widgetContainer.appendChild(mobileHeader);

      const mobileSection = document.createElement('div');
      mobileSection.className = 'mobile-section';
      mobileSection.innerHTML = tabData[header].join('<br>');
      mobileSection.setAttribute('data-header', header);
      widgetContainer.appendChild(mobileSection);
    });

    // Append the widget to the specified location
    const targetElement = document.getElementById('ctl00_PageBody_productDetail_RadMultiPage1');
    if (targetElement) {
      targetElement.insertAdjacentElement('afterend', widgetContainer);
    } else {
      console.error('Target element not found: ctl00_PageBody_productDetail_RadMultiPage1');
    }

  } catch (error) {
    console.error('Error loading product data:', error);
  }
}

// Automatically load the widget on page load
loadProductWidget();
