$(document).ready(function () {
    const stores = [
        { name: 'Brenham', zip: 77833, lat: 30.1669, lon: -96.3977 },
        { name: 'Bryan', zip: 77803, lat: 30.6744, lon: -96.3743 },
        { name: 'Caldwell', zip: 77836, lat: 30.5316, lon: -96.6939 },
        { name: 'Lexington', zip: 78947, lat: 30.4152, lon: -97.0105 },
        { name: 'Groesbeck', zip: 76642, lat: 31.5249, lon: -96.5336 },
        { name: 'Mexia', zip: 76667, lat: 31.6791, lon: -96.4822 },
        { name: 'Buffalo', zip: 75831, lat: 31.4632, lon: -96.0580 }
    ];

    const DEFAULT_STORE = 'Groesbeck';
    const SIGN_IN_URL = 'https://webtrack.woodsonlumber.com/SignIn.aspx';

    if (window.location.href.includes('ProductDetail.aspx')) {
        const productId = extractProductId(window.location.href);

        if (productId) {
            getSelectedBranch().then(selectedBranch => {
                if (selectedBranch) {
                    loadStockData(productId, selectedBranch);
                } else {
                    determineUserLocation().then(userZip => {
                        const nearestStore = findNearestStore(userZip, stores);
                        loadStockData(productId, nearestStore ? nearestStore.name : DEFAULT_STORE);
                    }).catch(() => {
                        loadStockData(productId, DEFAULT_STORE);
                        displayWidget(DEFAULT_STORE, 'No stock available', true);
                    });
                }
            }).catch(() => {
                displayWidget(DEFAULT_STORE, 'No stock available', true);
            });
        } else {
            console.error("Product ID not found in the URL.");
        }
    }

    function extractProductId(url) {
        const match = url.match(/pid=([0-9]+)/);
        return match ? match[1] : null;
    }

    function getSelectedBranch() {
        const accountSettingsUrl = 'https://webtrack.woodsonlumber.com/AccountSettings.aspx?cms=1';

        return $.ajax({
            url: accountSettingsUrl,
            method: 'GET',
        }).then(data => {
            const dropdown = $(data).find('#ctl00_PageBody_ChangeUserDetailsControl_ddBranch');
            if (!dropdown.length) return null;

            const selectedOption = dropdown.find('option[selected="selected"]');
            return selectedOption.length ? selectedOption.text().trim() : null;
        });
    }

    function loadStockData(productId, branch) {
        const stockDataUrl = `https://webtrack.woodsonlumber.com/Catalog/ShowStock.aspx?productid=${productId}`;

        $.ajax({
            url: stockDataUrl,
            method: 'GET',
            success: function (data) {
                const stockData = $(data).find('#StockDataGrid_ctl00');

                if (stockData.length) {
                    console.log('Stock data table found. Inspecting headers and rows...');
                    inspectTable(stockData);
                    filterAndDisplayStockData(stockData, branch);
                } else {
                    console.error('Stock table not found in AJAX response.');
                    displayWidget(branch, 'No stock available', true);
                }
            },
            error: function (xhr, status, error) {
                console.error('Failed to load the stock data:', status, error);
                displayWidget(branch, 'No stock available', true);
            }
        });
    }

    function inspectTable(stockData) {
        stockData.find('th').each((index, th) => {
            console.log(`Header ${index}: "${$(th).text().trim()}"`);
        });

        stockData.find('tr').each((index, row) => {
            const branchCell = $(row).find('td').eq(0).text().trim();
            console.log(`Row ${index}, Branch: "${branchCell}"`);
        });
    }

    function filterAndDisplayStockData(stockData, branch) {
        const columnIndex = 2; // Always use the 3rd column (index 2) for stock quantity
        console.log(`Using column index: ${columnIndex} for quantity.`);

        const filteredRow = stockData.find('tr').filter((_, row) => {
            const branchCell = $(row).find('td').eq(0).text().trim();
            console.log(`Checking branch: "${branchCell}" against "${branch}"`);
            return branchCell.toLowerCase().trim() === branch.toLowerCase().trim();
        });

        if (filteredRow.length) {
            console.log('Matched row for branch:', filteredRow.html());
            const stockValue = filteredRow.find(`td:eq(${columnIndex})`).text().trim();
            console.log(`Stock value for "${branch}": "${stockValue}"`);
            displayWidget(branch, stockValue || 'No stock available', false);
        } else {
            console.error(`Branch "${branch}" not found in stock table.`);
            displayWidget(branch, 'No stock available', true);
        }
    }

    function displayWidget(branch, quantity, showSignInButton) {
        $('#stock-widget').remove();

        const buttonHtml = showSignInButton ? `
            <a href="${SIGN_IN_URL}" style="display: inline-block; padding: 10px 20px; background: #6b0016; color: white; text-decoration: none; border: 1px solid transparent; border-radius: 4px; font-weight: bold; text-align: center; margin-top: 10px;">
                Check Your Local Store Inventory
            </a>` : '';

        const widgetHtml = `
            <div id="stock-widget" style="display: table; border: 1px solid #ccc; padding: 10px; margin: 20px 0; background: #f9f9f9; text-align: center;">
                <h3>Stock Information</h3>
                <p><strong>Branch:</strong> ${branch}</p>
                <p><strong>Available Quantity:</strong> ${quantity}</p>
                ${buttonHtml}
            </div>
        `;

        $('#ctl00_PageBody_productDetail_productDescription').before(widgetHtml);
    }
});
