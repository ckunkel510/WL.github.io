$(document).ready(function () {
    // Check if the current URL contains 'ProductDetail.aspx'
    if (window.location.href.includes('ProductDetail.aspx')) {
        const productId = extractProductId(window.location.href);

        if (productId) {
            // First, get the customer's selected branch
            getSelectedBranch().then(selectedBranch => {
                if (selectedBranch) {
                    // Then, load stock data for the product and filter by branch
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

    /**
     * Extracts the product ID from the URL using a regular expression.
     * @param {string} url - The current page URL.
     * @returns {string|null} - The extracted product ID or null if not found.
     */
    function extractProductId(url) {
        const match = url.match(/pid=([0-9]+)/);
        return match ? match[1] : null;
    }

    /**
     * Fetches the customer's selected branch from the account settings page.
     * @returns {Promise<string>} - A promise that resolves to the selected branch name.
     */
    function getSelectedBranch() {
        const accountSettingsUrl = 'https://webtrack.woodsonlumber.com/AccountSettings.aspx?cms=1';

        return $.ajax({
            url: accountSettingsUrl,
            method: 'GET',
        }).then(data => {
            const selectedOption = $(data).find('#ctl00_PageBody_ChangeUserDetailsControl_ddBranch option[selected="selected"]');
            return selectedOption.length ? selectedOption.text().trim() : null;
        });
    }

    /**
     * Loads stock data, filters by branch, and displays it in a widget.
     * @param {string} productId - The product ID to fetch stock data for.
     * @param {string} branch - The customer's selected branch.
     */
    function loadStockData(productId, branch) {
        const stockDataUrl = `https://webtrack.woodsonlumber.com/Catalog/ShowStock.aspx?productid=${productId}`;

        $.ajax({
            url: stockDataUrl,
            method: 'GET',
            success: function (data) {
                const stockData = $(data).find('#StockDataGrid_ctl00');

                if (stockData.length) {
                    // Filter and display data for the selected branch
                    filterAndDisplayStockData(stockData, branch);
                } else {
                    console.error('Stock data not found.');
                }
            },
            error: function () {
                console.error('Failed to load the stock data.');
            }
        });
    }

    /**
     * Filters the stock data table for the selected branch and displays it as a widget.
     * @param {jQuery} stockData - The stock data element.
     * @param {string} branch - The selected branch name.
     */
    function filterAndDisplayStockData(stockData, branch) {
        // Filter rows matching the selected branch
        const filteredRows = stockData.find('tr').filter((_, row) => {
            const branchCell = $(row).find('td[data-title="Location"]').text().trim();
            return branchCell === branch;
        });

        if (filteredRows.length) {
            // Extract and display the quantity for the branch
            const quantity = filteredRows.find('td[data-title="Quantity"]').text().trim();
            displayWidget(branch, quantity);
        } else {
            displayWidget(branch, 'No stock available');
        }
    }

    /**
     * Displays the stock data as a widget on the page.
     * @param {string} branch - The branch name.
     * @param {string} quantity - The stock quantity.
     */
    function displayWidget(branch, quantity) {
        const widgetHtml = `
            <div id="stock-widget" style="border: 1px solid #ccc; padding: 10px; margin: 20px 0; background: #f9f9f9;">
                <h3>Stock Information</h3>
                <p><strong>Branch:</strong> ${branch}</p>
                <p><strong>Available Quantity:</strong> ${quantity}</p>
            </div>
        `;

        // Add the widget before the product description
        $('#ctl00_PageBody_productDetail_productDescription').before(widgetHtml);
    }
});
