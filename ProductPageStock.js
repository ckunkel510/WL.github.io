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
                        if (nearestStore) {
                            loadStockData(productId, nearestStore.name);
                        } else {
                            loadStockData(productId, DEFAULT_STORE);
                        }
                    }).catch(error => {
                        console.error('Geolocation error:', error);
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
            if (!dropdown.length) {
                return null;
            }

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
                    filterAndDisplayStockData(stockData, branch);
                } else {
                    console.error('Stock table not found in AJAX response.');
                    displayWidget(branch, 'No stock available', true);
                }
            },
            error: function () {
                console.error('Failed to load the stock data.');
                displayWidget(branch, 'No stock available', true);
            }
        });
    }

    function filterAndDisplayStockData(stockData, branch) {
        const actualStockColumnIndex = 4; // Confirmed column for "Actual Stock"

        const filteredRow = stockData.find('tr').filter((_, row) => {
            const branchCell = $(row).find('td').eq(0).text().trim();
            return branchCell.toLowerCase().trim() === branch.toLowerCase().trim();
        });

        if (filteredRow.length) {
            const actualStock = filteredRow.find('td').eq(actualStockColumnIndex).text().trim();
            displayWidget(branch, actualStock || 'No stock available', false);
        } else {
            console.error(`Branch "${branch}" not found in stock table.`);
            displayWidget(branch, 'No stock available', true);
        }
    }

    function determineUserLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject('Geolocation is not supported by this browser.');
                return;
            }

            navigator.geolocation.getCurrentPosition(
                position => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    resolve(getZipFromCoordinates(lat, lon));
                },
                error => reject(error.message)
            );
        });
    }

    function getZipFromCoordinates(lat, lon) {
        console.log(`Lat: ${lat}, Lon: ${lon}`);
        return 77833; // Example zip code for Brenham
    }

    function findNearestStore(userZip, stores) {
        let nearestStore = null;
        let shortestDistance = Infinity;

        stores.forEach(store => {
            const distance = calculateDistance(userZip, store.zip);
            if (distance <= 75 && distance < shortestDistance) {
                nearestStore = store;
                shortestDistance = distance;
            }
        });

        return nearestStore || { name: DEFAULT_STORE };
    }

    function calculateDistance(zip1, zip2) {
        return 50; // Placeholder distance calculation
    }

    function displayWidget(branch, quantity, showSignInButton) {
        // Ensure only one widget exists
        $('#stock-widget').remove();

        let buttonHtml = '';

        if (showSignInButton) {
            buttonHtml = `
                <a href="${SIGN_IN_URL}" style="display: inline-block; padding: 10px 20px; background: #6b0016; color: white; text-decoration: none; border: none; border-radius: 4px; font-weight: bold; text-align: center; margin-top: 10px;">
                    Check Your Local Store Inventory
                </a>
            `;
        }

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
