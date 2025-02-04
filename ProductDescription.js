<script>
window.onload = async function () {
    console.log("Script loaded. Starting data fetching and tab creation...");

    const productId = getProductIdFromUrl();
    if (!productId) {
        console.error("Product ID not found in URL.");
        return;
    }

    console.log("Product ID detected:", productId);

    const googleSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSz4pwwlgmNw8642O1eDV8Jir2GBslQyyTX4ykx_rRlAb6k2EHe_QYy2gwk7R9bq5gV3KZpYOdXA3HW/pub?output=csv';

    try {
        console.log("Fetching data from Google Sheet...");
        const response = await fetch(googleSheetUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch data. Status: ${response.status}`);
        }

        let csvText = await response.text();
        console.log("Raw CSV Response Text:", csvText);

        // Preprocess CSV to fix broken lines inside fields
        csvText = preprocessCsv(csvText);

        // Parse and merge rows by product ID
        const parsedData = parseCsvToJson(csvText);
        console.log("Parsed Data (before merging):", parsedData);

        const mergedData = mergeRowsByProductId(parsedData);
        console.log("Merged Data by Product ID:", mergedData);

        const productEntry = mergedData[productId];
        if (productEntry) {
            console.log("Product Entry Found:", productEntry);
            createTabs(productEntry);
        } else {
            console.warn("No matching product entry found for product ID:", productId);
        }
    } catch (error) {
        console.error("An error occurred:", error);
    }
};

function getProductIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('pid');
}

function preprocessCsv(csvText) {
    // Remove line breaks inside quoted fields
    return csvText.replace(/"([^"]*)"/gs, match => match.replace(/\r?\n/g, ' '));
}

function parseCsvToJson(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) {
        console.warn("No lines found in CSV.");
        return [];
    }

    const headers = lines[0].split(',').map(header => header.trim().toLowerCase());
    console.log("CSV Headers Detected:", headers);

    return lines.slice(1).map(line => {
        const values = line.split(',').map(value => value.trim());
        return headers.reduce((obj, header, i) => {
            obj[header] = values[i] || '';
            return obj;
        }, {});
    });
}

function mergeRowsByProductId(sheetData) {
    console.log("Merging rows by product ID...");

    return sheetData.reduce((result, row) => {
        const productId = row['productid'];
        if (!productId) return result;

        if (!result[productId]) {
            result[productId] = { ...row };
        } else {
            Object.keys(row).forEach(key => {
                if (key !== 'productid' && row[key]) {
                    result[productId][key] += '\n' + row[key];  // Append values with line breaks
                }
            });
        }

        return result;
    }, {});
}

function createTabs(productEntry) {
    console.log("Creating tabs...");

    const container = document.createElement('div');
    container.className = 'tab-container';

    const tabHeaders = document.createElement('div');
    tabHeaders.className = 'tab-headers';

    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content';

    Object.entries(productEntry).forEach(([key, value], index) => {
        if (key === 'productid' || !value) return;

        // Create tab header
        const tabHeader = document.createElement('button');
        tabHeader.className = 'tab-header';
        tabHeader.textContent = key;
        tabHeader.dataset.tabTarget = `tab-${index}`;
        tabHeader.onclick = () => activateTab(`tab-${index}`);

        // Create tab content
        const tabPane = document.createElement('div');
        tabPane.id = `tab-${index}`;
        tabPane.className = 'tab-pane';
        tabPane.innerHTML = `<pre>${value}</pre>`;  // Use <pre> to preserve line breaks

        tabHeaders.appendChild(tabHeader);
        tabContent.appendChild(tabPane);
    });

    container.appendChild(tabHeaders);
    container.appendChild(tabContent);
    document.body.appendChild(container);  // Append to body or another target element

    console.log("Tabs created. Activating first tab...");
    activateTab('tab-0');
}

function activateTab(tabId) {
    const allTabs = document.querySelectorAll('.tab-pane');
    const allHeaders = document.querySelectorAll('.tab-header');

    // Hide all tabs and deactivate all headers
    allTabs.forEach(tab => tab.style.display = 'none');
    allHeaders.forEach(header => header.classList.remove('active'));

    // Show the selected tab and activate its header
    const activeTab = document.getElementById(tabId);
    if (activeTab) activeTab.style.display = 'block';

    const activeHeader = document.querySelector(`[data-tab-target="${tabId}"]`);
    if (activeHeader) activeHeader.classList.add('active');
}
</script>

<style>
.tab-container {
    margin: 20px;
    font-family: Arial, sans-serif;
}

.tab-headers {
    display: flex;
    background-color: #f1f1f1;
    border-bottom: 2px solid #ccc;
}

.tab-header {
    flex: 1;
    padding: 10px;
    text-align: center;
    cursor: pointer;
    background-color: #ddd;
    border: none;
    outline: none;
    transition: background-color 0.3s;
}

.tab-header.active {
    background-color: #6b0016;
    color: white;
    font-weight: bold;
}

.tab-content {
    padding: 15px;
    background-color: #fff;
    border: 1px solid #ccc;
}

.tab-pane {
    display: none;
}

.tab-pane pre {
    white-space: pre-wrap;
}
</style>
