$(document).ready(function () {
    const DEFAULT_STORE = 'Groesbeck';

    if (window.location.href.includes('ProductDetail.aspx')) {
        const productId = extractProductId(window.location.href);

        if (productId) {
            loadStockData(productId, DEFAULT_STORE);
        } else {
            console.error("Product ID not found in the URL.");
        }
    }

    function extractProductId(url) {
        const match = url.match(/pid=([0-9]+)/);
        return match ? match[1] : null;
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
                    displayWidget(branch, 'No stock available', false);
                }
            },
            error: function (xhr, status, error) {
                console.error('Failed to load the stock data:', status, error);
                displayWidget(branch, 'No stock available', false);
            }
        });
    }

    function inspectTable(stockData) {
        console.log('Inspecting table headers...');
        stockData.find('th').each((index, th) => {
            console.log(`Header ${index}: "${$(th).text().trim()}"`);
        });

        console.log('Inspecting table rows...');
        stockData.find('tr').each((index, row) => {
            const branchCell = $(row).find('td').eq(0).text().trim();
            console.log(`Row ${index}, Branch: "${branchCell}"`);
        });
    }

    function filterAndDisplayStockData(stockData, branch) {
        const actualStockColumnIndex = stockData.find('th').index((_, th) => {
            const headerText = $(th).text().trim();
            console.log(`Checking header: "${headerText}"`);
            return headerText === 'Actual'; // Exact match for 'Actual'
        });

        if (actualStockColumnIndex === -1) {
            console.error('Actual column not found in stock table. Please verify the headers.');
            displayWidget(branch, 'No stock available', false);
            return;
        }

        console.log(`"Actual" column index: ${actualStockColumnIndex}`);

        const filteredRow = stockData.find('tr').filter((_, row) => {
            const branchCell = $(row).find('td').eq(0).text().trim();
            console.log(`Comparing branch: "${branchCell}" with "${branch}"`);
            return branchCell.toLowerCase().trim() === branch.toLowerCase().trim();
        });

        if (filteredRow.length) {
            const actualStock = filteredRow.find(`td:eq(${actualStockColumnIndex})`).text().trim();
            console.log(`Actual Stock for "${branch}": "${actualStock}"`);
            displayWidget(branch, actualStock || 'No stock available', false);
        } else {
            console.error(`Branch "${branch}" not found in stock table.`);
            displayWidget(branch, 'No stock available', false);
        }
    }

    function displayWidget(branch, quantity, showSignInButton) {
        // Ensure only one widget exists
        $('#stock-widget').remove();

        const widgetHtml = `
            <div id="stock-widget" style="display: table; border: 1px solid #ccc; padding: 10px; margin: 20px 0; background: #f9f9f9; text-align: center;">
                <h3>Stock Information</h3>
                <p><strong>Branch:</strong> ${branch}</p>
                <p><strong>Available Quantity:</strong> ${quantity}</p>
            </div>
        `;

        $('#ctl00_PageBody_productDetail_productDescription').before(widgetHtml);
    }
});
