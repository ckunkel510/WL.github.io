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
                    console.log(`Signed-in user. Selected branch: ${selectedBranch}`);
                    loadStockData(productId, selectedBranch, true); // Signed-in, use column 4
                } else {
                    console.warn('Branch could not be determined. Attempting to find nearest store...');
                    determineUserLocation().then(userZip => {
                        const nearestStore = findNearestStore(userZip, stores);
                        console.log(`Nearest store determined: ${nearestStore.name}`);
                        loadStockData(productId, nearestStore.name, false); // Not signed-in, use column 3
                    }).catch(() => {
                        console.warn('User location could not be determined. Defaulting to Groesbeck.');
                        loadStockData(productId, DEFAULT_STORE, false); // Not signed-in, use column 3
                        displayWidget(DEFAULT_STORE, 'No stock available', true);
                    });
                }
            }).catch(() => {
                console.error('Failed to fetch account settings. Adding fallback button.');
                loadStockData(productId, DEFAULT_STORE, false); // Not signed-in, use column 3
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
                console.warn('Branch dropdown not found in account settings.');
                return null;
            }

            const selectedOption = dropdown.find('option[selected="selected"]');
            return selectedOption.length ? selectedOption.text().trim() : null;
        });
    }

    function loadStockData(productId, branch, useActualColumn) {
        const stockDataUrl = `https://webtrack.woodsonlumber.com/Catalog/ShowStock.aspx?productid=${productId}`;
        console.log(`Fetching stock data from URL: ${stockDataUrl}`);

        $.ajax({
            url: stockDataUrl,
            method: 'GET',
            success: function (data) {
                const stockData = $(data).find('#StockDataGrid_ctl00');
                if (stockData.length) {
                    console.log('Stock data table found. Inspecting headers and rows...');
                    inspectTable(stockData);
                    filterAndDisplayStockData(stockData, branch, useActualColumn);
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

    function filterAndDisplayStockData(stockData, branch, useActualColumn) {
        const columnIndex = useActualColumn ? 4 : 2; // Use column 4 if signed-in, otherwise column 3
        console.log(`Using column index: ${columnIndex} for quantity`);

        const filteredRow = stockData.find('tr').filter((_, row) => {
            const branchCell = $(row).find('td').eq(0).text().trim();
            console.log(`Checking branch: "${branchCell}" against "${branch}"`);
            return branchCell.toLowerCase().trim() === branch.toLowerCase().trim();
        });

        if (filteredRow.length) {
            console.log('Matched row for branch:', filteredRow.html());
            const stockValue = filteredRow.find(`td:eq(${columnIndex})`).text().trim();
            console.log(`Stock value for "${branch}" (column ${columnIndex}): "${stockValue}"`);
            displayWidget(branch, stockValue || 'No stock available', false);
        } else {
            console.error(`Branch "${branch}" not found in stock table.`);
            displayWidget(branch, 'No stock available', true);
        }
    }

    function determineUserLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                console.error('Geolocation is not supported by this browser.');
                reject('Geolocation is not supported.');
                return;
            }

            console.log('Attempting to fetch user location...');
            navigator.geolocation.getCurrentPosition(
                position => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    console.log(`User location retrieved: Latitude ${lat}, Longitude ${lon}`);
                    resolve({ lat, lon });
                },
                error => {
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            console.error('User denied the request for Geolocation.');
                            break;
                        case error.POSITION_UNAVAILABLE:
                            console.error('Location information is unavailable.');
                            break;
                        case error.TIMEOUT:
                            console.error('The request to get user location timed out.');
                            break;
                        default:
                            console.error('An unknown error occurred while fetching geolocation.');
                    }
                    reject(error.message);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    }

    function findNearestStore(userLocation, stores) {
        console.log(`Finding nearest store to user location: ${JSON.stringify(userLocation)}`);
        let nearestStore = null;
        let shortestDistance = Infinity;

        stores.forEach(store => {
            const distance = calculateDistance(
                userLocation.lat,
                userLocation.lon,
                store.lat,
                store.lon
            );
            console.log(`Distance to ${store.name}: ${distance} miles`);
            if (distance < shortestDistance) {
                nearestStore = store;
                shortestDistance = distance;
            }
        });

        return nearestStore || { name: DEFAULT_STORE };
    }

    function calculateDistance(lat1, lon1, lat2, lon2) {
        const toRadians = degrees => (degrees * Math.PI) / 180;
        const R = 3958.8; // Radius of Earth in miles
        const dLat = toRadians(lat2 - lat1);
        const dLon = toRadians(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function displayWidget(branch, quantity, showSignInButton) {
        // Ensure only one widget exists
        $('#stock-widget').remove();

        let buttonHtml = '';

        if (showSignInButton) {
            buttonHtml = `
                <a href="${SIGN_IN_URL}" style="display: inline-block; padding: 10px 20px; background: #6b0016; color: white; text-decoration: none; border: 1px solid transparent; border-radius: 4px; font-weight: bold; text-align: center; margin-top: 10px;">
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
