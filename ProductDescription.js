<script>
window.onload = async function () {
    if (!window.location.href.includes('ProductDetail.aspx')) {
        return; // Exit the script if not on a ProductDetail page
    }

    const productId = getProductIdFromUrl();
    if (!productId) {
        console.error("Product ID not found in URL.");
        return;
    }

    const googleSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSz4pwwlgmNw8642O1eDV8Jir2GBslQyyTX4ykx_rRlAb6k2EHe_QYy2gwk7R9bq5gV3KZpYOdXA3HW/pub?output=csv';

    try {
        const sheetData = await fetchSheetData(googleSheetUrl);
        const productEntry = getProductEntry(sheetData, productId);

        if (productEntry) {
            createTabs(productEntry);
            hideIframe();
            console.log("Description from Google Sheet applied with tabs.");
        } else {
            console.warn("No product description found in Google Sheet.");
        }
    } catch (error) {
        console.error("Error fetching or processing Google Sheet data:", error);
    }
};

function getProductIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('pid'); // Assuming 'pid' is the product ID parameter in the URL
}

async function fetchSheetData(sheetUrl) {
    const response = await fetch(sheetUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch Google Sheet data: ${response.statusText}`);
    }

    const csvText = await response.text();
    return parseCsvToJson(csvText);
}

function parseCsvToJson(csvText) {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(header => header.trim());
    return lines.slice(1).map(line => {
        const values = line.split(',').map(value => value.trim());
        return headers.reduce((obj, header, index) => {
            obj[header] = values[index] || '';
            return obj;
        }, {});
    });
}

function getProductEntry(sheetData, productId) {
    return sheetData.find(entry => entry['ProductID'] === productId);
}

function createTabs(productEntry) {
    const targetDiv = document.getElementById('ctl00_PageBody_productDetail_ctl01') || 
                      document.getElementById('ctl00_PageBody_productDetail_ctl02');

    if (!targetDiv) {
        console.error("Target div for embedding content not found.");
        return;
    }

    // Create tab headers and content containers
    const tabContainer = document.createElement('div');
    tabContainer.className = 'tab-container';

    const tabHeaders = document.createElement('div');
    tabHeaders.className = 'tab-headers';

    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content';

    Object.entries(productEntry).forEach(([key, value], index) => {
        if (key === 'ProductID' || !value) return;

        // Create tab header
        const tabHeader = document.createElement('button');
        tabHeader.className = 'tab-header';
        tabHeader.textContent = key;
        tabHeader.dataset.tabTarget = `tab-${index}`;
        tabHeader.onclick = () => activateTab(`tab-${index}`);

        // Create corresponding tab content
        const tabPane = document.createElement('div');
        tabPane.id = `tab-${index}`;
        tabPane.className = 'tab-pane';
        tabPane.innerHTML = `<p>${value}</p>`;

        // Add tab header and content to containers
        tabHeaders.appendChild(tabHeader);
        tabContent.appendChild(tabPane);
    });

    // Append tabs to the target div
    tabContainer.appendChild(tabHeaders);
    tabContainer.appendChild(tabContent);
    targetDiv.appendChild(tabContainer);

    // Activate the first tab by default
    activateTab('tab-0');
}

function activateTab(tabId) {
    const allTabs = document.querySelectorAll('.tab-pane');
    const allHeaders = document.querySelectorAll('.tab-header');

    // Hide all tabs and deactivate headers
    allTabs.forEach(tab => tab.style.display = 'none');
    allHeaders.forEach(header => header.classList.remove('active'));

    // Show the selected tab and activate its header
    document.getElementById(tabId).style.display = 'block';
    document.querySelector(`[data-tab-target="${tabId}"]`).classList.add('active');
}

function hideIframe() {
    const iframe = document.getElementById('DescriptionIframe');
    if (iframe) iframe.style.display = 'none';
}
</script>

<style>
.tab-container {
    margin-top: 20px;
    border: 1px solid #ccc;
    border-radius: 8px;
    overflow: hidden;
    font-family: Arial, sans-serif;
}

.tab-headers {
    display: flex;
    background-color: #f1f1f1;
    border-bottom: 1px solid #ccc;
}

.tab-header {
    flex: 1;
    padding: 10px;
    cursor: pointer;
    text-align: center;
    background-color: #ddd;
    border: none;
    outline: none;
    transition: background-color 0.3s;
}

.tab-header:hover {
    background-color: #bbb;
}

.tab-header.active {
    background-color: #6b0016;
    color: white;
    font-weight: bold;
}

.tab-content {
    padding: 15px;
    background-color: #fff;
}

.tab-pane {
    display: none;
}
</style>
