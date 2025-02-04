async function loadProductWidget(productId) {
  const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSz4pwwlgmNw8642O1eDV8Jir2GBslQyyTX4ykx_rRlAb6k2EHe_QYy2gwk7R9bq5gV3KZpYOdXA3HW/pub?output=csv';
  
  // Fetch and parse CSV data
  const response = await fetch(csvUrl);
  const csvData = await response.text();
  const rows = csvData.split('\n').map(row => row.split(','));

  // Extract headers
  const headers = rows.shift();
  
  // Filter rows matching the productId
  const productRows = rows.filter(row => row[0].trim() === productId);

  if (!productRows.length) {
    console.error('No data found for this product');
    return;
  }

  // Organize data by tabs
  const tabData = {};
  headers.forEach((header, index) => {
    if (index === 0) return; // Skip productId column
    tabData[header] = productRows.map(row => row[index]).filter(content => content.trim() !== '');
  });

  // Generate tabs and content
  const tabMenu = document.getElementById('tab-menu');
  const tabContent = document.getElementById('tab-content');

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

  // Switch tab function
  function switchTab(header) {
    document.querySelectorAll('.tab-menu button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-section').forEach(sec => sec.classList.remove('active'));

    document.querySelector(`#tab-menu button:contains(${header})`).classList.add('active');
    document.getElementById(`tab-${header}`).classList.add('active');
  }
}

// Load the widget for a specific productId (example usage)
loadProductWidget('12345');
