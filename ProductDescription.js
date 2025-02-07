async function loadProductWidget() {
  // Function to extract the 'pid' from the URL
  function getProductIdFromUrl() {
    const urlParams = window.location.search;
    const pidMatch = urlParams.match(/pid=([^&]*)/);
    return pidMatch ? decodeURIComponent(pidMatch[1]) : null;
  }

  // Get the current productId from the URL
  const productId = getProductIdFromUrl();

  if (!productId) {
    console.error('Product ID (pid) not found in the URL.');
    return;
  }

  const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSz4pwwlgmNw8642O1eDV8Jir2GBslQyyTX4ykx_rRlAb6k2EHe_QYy2gwk7R9bq5gV3KZpYOdXA3HW/pub?output=csv';

  try {
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

    // Create the tab menu
    const tabMenu = document.createElement('div');
    tabMenu.id = 'tab-menu';
    tabMenu.className = 'tab-menu';
    widgetContainer.appendChild(tabMenu);

    // Create the tab content container
    const tabContent = document.createElement('div');
    tabContent.id = 'tab-content';
    tabContent.className = 'tab-content';
    widgetContainer.appendChild(tabContent);

    // Generate tabs and content
    Object.keys(tabData).forEach((header, tabIndex) => {
      if (tabData[header].length === 0) return; // Skip empty tabs

      // Create tab button
      const tabButton = document.createElement('button');
      tabButton.textContent = header;
      tabButton.className = tabIndex === 0 ? 'active' : '';
      tabButton.addEventListener('click', () => switchTab(header));
      tabMenu.appendChild(tabButton);

      // Create tab content section
      const section = document.createElement('div');
      section.className = `tab-section ${tabIndex === 0 ? 'active' : ''}`;
      section.innerHTML = tabData[header].join('<br>'); // Combine rows for this tab
      section.id = `tab-${header}`;
      tabContent.appendChild(section);
    });

    // Function to switch tabs
    function switchTab(header) {
      document.querySelectorAll('.tab-menu button').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-section').forEach(sec => sec.classList.remove('active'));

      // Activate selected tab
      const tabButton = Array.from(document.querySelectorAll('.tab-menu button'))
        .find(btn => btn.textContent === header);
      if (tabButton) tabButton.classList.add('active');

      document.getElementById(`tab-${header}`).classList.add('active');
    }

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
