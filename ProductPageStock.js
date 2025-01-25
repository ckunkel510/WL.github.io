$(document).ready(function () {
    if (window.location.href.includes('ProductDetail.aspx')) {
        const productId = extractProductId(window.location.href);

        if (productId) {
            getSelectedBranch().then(selectedBranch => {
                if (selectedBranch) {
                    loadStockData(productId, selectedBranch);
                } else {
                    console.error('Selected branch not found.');
                }
            }).catch(() => {
                console.error('Failed to fetch account settings.');
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
            console.log('Account settings HTML:', data);

            const dropdown = $(data).find('#ctl00_PageBody_ChangeUserDetailsControl_ddBranch');
            if (!dropdown.length) {
                console.error('Dropdown not found in account settings.');
                return null;
            }

            console.log('Dropdown found:', dropdown.html());

            const selectedOption = dropdown.find('option[selected="selected"]');
            if (!selectedOption.length) {
                console.warn('No option with selected="selected" found. Trying :selected pseudo-class.');
                return dropdown.find('option:selected').text().trim() || null;
            }

            const branch = selectedOption.text().trim();
            console.log(`Selected branch: "${branch}"`);
            return branch;
        }).catch(error => {
            console.error('Error fetching account settings:', error);
            return null;
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
                    console.log('Stock table HTML:', stockData.html());
                    filterAndDisplayStockData(stockData, branch);
                } else {
                    console.error('Stock table not found in AJAX response.');
                }
            },
            error: function () {
                console.error('Failed to load the stock data.');
            }
        });
    }

    function filterAndDisplayStockData(stockData, branch) {
        // Log all headers to verify their text
        stockData.find('th').each((index, th) => {
            console.log(`Header ${index}: "${$(th).text().trim()}"`);
        });

        // Dynamically find the "Actual" column index
        const actualStockColumnIndex = stockData.find('th').index((_, th) => {
            return $(th).text().trim().toLowerCase() === 'actual';
        });

        // Fallback if the column isn't found
        if (actualStockColumnIndex === -1) {
            console.error('Actual column not found in stock table. Please verify the header text.');
            displayWidget(branch, 'Stock information unavailable');
            return;
        }

        console.log('Actual Stock column index:', actualStockColumnIndex);

        stockData.find('tr').each((index, row) => {
            const branchCell = $(row).find('td').eq(0).text().trim();
            console.log(`Row ${index}, Branch cell: "${branchCell}"`);
        });

        const filteredRow = stockData.find('tr').filter((_, row) => {
            const branchCell = $(row).find('td').eq(0).text().trim();
            console.log(`Checking branch in stock table: "${branchCell}"`);
            return branchCell.toLowerCase().trim() === branch.toLowerCase().trim();
        });

        if (filteredRow.length) {
            const actualStock = filteredRow.find(`td:eq(${actualStockColumnIndex})`).text().trim();
            displayWidget(branch, actualStock || 'No stock available');
        } else {
            console.error(`Branch "${branch}" not found in stock table.`);
            displayWidget(branch, 'No stock available');
        }
    }

    function displayWidget(branch, quantity) {
        const widgetHtml = `
            <div id="stock-widget" style="display: table; border: 1px solid #ccc; padding: 10px; margin: 20px 0; background: #f9f9f9;">
                <h3>Stock Information</h3>
                <p><strong>Branch:</strong> ${branch}</p>
                <p><strong>Available Quantity:</strong> ${quantity}</p>
            </div>
        `;

        $('#ctl00_PageBody_productDetail_productDescription').before(widgetHtml);
    }
});