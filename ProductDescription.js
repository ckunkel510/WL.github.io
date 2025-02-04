<script>
window.onload = async function () {
    console.log("Script loaded. Starting product detail setup...");

    if (!window.location.href.includes('ProductDetail.aspx')) {
        console.warn("Not on a ProductDetail page. Exiting script.");
        return;
    }

    const productId = getProductIdFromUrl();
    if (!productId) {
        console.error("Product ID not found in URL.");
        return;
    }

    console.log("Product ID detected:", productId);

    // Update with your Google Sheet CSV URL
    const googleSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSz4pwwlgmNw8642O1eDV8Jir2GBslQyyTX4ykx_rRlAb6k2EHe_QYy2gwk7R9bq5gV3KZpYOdXA3HW/pub?output=csv';

    try {
        console.log("Fetching Google Sheet data...");
        const sheetData = await fetchSheetData(googleSheetUrl);
        console.log("Parsed Sheet Data:", sheetData);

        const productEntry = getProductEntry(sheetData, productId);
        console.log("Product Entry Found:", productEntry);

        if (productEntry) {
            console.log("Product found in Google Sheet. Creating tabs or mobile-friendly sections...");
            if (isMobileDevice()) {
                createMobileSections(productEntry);
            } else {
                createTabs(productEntry);
            }
            hideIframe();
        } else {
            console.log("No product entry found in Google Sheet. Falling back to iframe content...");
            await loadIframeContent();
        }
    } catch (error) {
        console.error("Error fetching or processing Google Sheet data. Falling back to iframe content.", error);
        await loadIframeContent();
    }
};

function getProductIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('pid');
}

async function fetchSheetData(sheetUrl) {
    try {
        const response = await fetch(sheetUrl);
        if (!response.ok) {
            console.error("Failed to fetch Google Sheet data:", response.statusText);
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const csvText = await response.text();
        console.log("CSV Response Text:", csvText);

        return parseCsvToJson(csvText);
    } catch (error) {
        console.error("Error during fetch operation:", error);
        throw error;
    }
}

function parseCsvToJson(csvText) {
    if (!csvText) {
        console.warn("CSV text is empty or undefined.");
        return [];
    }

    console.log("Parsing CSV data...");
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const headers = lines[0].split(',').map(header => header.trim().toLowerCase());

    console.log("CSV Headers:", headers);

    const parsedData = lines.slice(1).map(line => {
        const values = line.split(',').map(value => value.trim());
        return headers.reduce((obj, header, index) => {
            obj[header] = values[index] || '';
            return obj;
        }, {});
    });

    console.log("Parsed Data Array:", parsedData);
    return parsedData;
}

function getProductEntry(sheetData, productId) {
    const productEntry = sheetData.find(entry => entry['productid']?.toLowerCase() === productId.toLowerCase());
    if (!productEntry) {
        console.warn(`No entry found for Product ID: ${productId}`);
    }
    return productEntry;
}

function createTabs(productEntry) {
    const targetDiv = document.getElementById('ctl00_PageBody_productDetail_ctl01') || 
                      document.getElementById('ctl00_PageBody_productDetail_ctl02');

    if (!targetDiv) {
        console.error("Target div for embedding content not found.");
        return;
    }

    const tabContainer = document.createElement('div');
    tabContainer.className = 'tab-container';

    const tabHeaders = document.createElement('div');
    tabHeaders.className = 'tab-headers';

    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content';

    Object.entries(productEntry).forEach(([key, value], index) => {
        if (key === 'productid' || !value) return;

        const tabHeader = document.createElement('button');
        tabHeader.className = 'tab-header';
        tabHeader.textContent = key;
        tabHeader.dataset.tabTarget = `tab-${index}`;
        tabHeader.onclick = () => activateTab(`tab-${index}`);

        const tabPane = document.createElement('div');
        tabPane.id = `tab-${index}`;
        tabPane.className = 'tab-pane';
        tabPane.innerHTML = `<p>${value}</p>`;

        tabHeaders.appendChild(tabHeader);
        tabContent.appendChild(tabPane);
    });

    tabContainer.appendChild(tabHeaders);
    tabContainer.appendChild(tabContent);
    targetDiv.appendChild(tabContainer);

    activateTab('tab-0');
}

function createMobileSections(productEntry) {
    const targetDiv = document.getElementById('ctl00_PageBody_productDetail_ctl01') || 
                      document.getElementById('ctl00_PageBody_productDetail_ctl02');

    if (!targetDiv) {
        console.error("Target div for embedding content not found.");
        return;
    }

    Object.entries(productEntry).forEach(([key, value]) => {
        if (key === 'productid' || !value) return;

        const section = document.createElement('div');
        section.className = 'mobile-section';

        const header = document.createElement('h3');
        header.textContent = key;
        header.className = 'mobile-section-header';

        const content = document.createElement('p');
        content.textContent = value;
        content.className = 'mobile-section-content';

        section.appendChild(header);
        section.appendChild(content);
        targetDiv.appendChild(section);
    });
}

function activateTab(tabId) {
    const allTabs = document.querySelectorAll('.tab-pane');
    const allHeaders = document.querySelectorAll('.tab-header');

    allTabs.forEach(tab => tab.style.display = 'none');
    allHeaders.forEach(header => header.classList.remove('active'));

    document.getElementById(tabId).style.display = 'block';
    document.querySelector(`[data-tab-target="${tabId}"]`).classList.add('active');
}

async function loadIframeContent() {
    const iframe = document.getElementById('DescriptionIframe');
    const targetDiv = document.getElementById('ctl00_PageBody_productDetail_ctl01') || 
                      document.getElementById('ctl00_PageBody_productDetail_ctl02');

    if (!iframe) {
        console.error("Description iframe not found.");
        return;
    }

    if (!targetDiv) {
        console.error("Target div for embedding content not found.");
        return;
    }

    try {
        const iframeContent = iframe.contentDocument || iframe.contentWindow.document;
        if (iframeContent && iframeContent.body) {
            const content = iframeContent.body.innerHTML.trim();
            if (content) {
                console.log("Iframe content found. Appending to target div...");
                appendIframeContent(iframe, content, targetDiv);
            } else {
                console.warn("Iframe content is empty or invalid.");
            }
        } else {
            console.error("Iframe content or body is not accessible.");
        }
    } catch (e) {
        console.error("An error occurred while accessing the iframe content.", e);
    }
}

function appendIframeContent(iframe, content, targetDiv) {
    try {
        targetDiv.insertAdjacentHTML('beforeend', content);
        iframe.style.display = 'none';
        console.log("Iframe content
