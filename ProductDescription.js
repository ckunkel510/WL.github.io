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

    const googleSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSz4pwwlgmNw8642O1eDV8Jir2GBslQyyTX4ykx_rRlAb6k2EHe_QYy2gwk7R9bq5gV3KZpYOdXA3HW/pub?output=csv';

    try {
        const sheetData = await fetchSheetData(googleSheetUrl);
        console.log("Parsed Sheet Data:", sheetData);

        const productEntry = getProductEntry(sheetData, productId);
        console.log("Product Entry Found:", productEntry);

        if (productEntry) {
            console.log("Product found in Google Sheet. Creating tabs...");
            createTabs(productEntry);
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
    const response = await fetch(sheetUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch Google Sheet data: ${response.statusText}`);
    }

    const csvText = await response.text();
    console.log("CSV Response Text:", csvText);

    return parseCsvToJson(csvText);
}

function parseCsvToJson(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const headers = lines[0].split(',').map(header => header.trim().toLowerCase());
    return lines.slice(1).map(line => {
        const values = line.split(',').map(value => value.trim());
        return headers.reduce((obj, header, index) => {
            obj[header] = values[index] || '';
            return obj;
        }, {});
    });
}

function getProductEntry(sheetData, productId) {
    return sheetData.find(entry => entry['productid']?.toLowerCase() === productId.toLowerCase());
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
        console.log("Iframe content successfully appended.");
    } catch (e) {
        console.error("An error occurred while appending iframe content.", e);
    }
}

function hideIframe() {
    const iframe = document.getElementById('DescriptionIframe');
    if (iframe) iframe.style.display = 'none';
}
</script>
