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
        filterAndDisplayStockData(stockData, branch, useActualColumn, stockDataUrl, productId);
      } else {
        console.error('Stock table not found in AJAX response.');
        displayWidget(branch, 'No stock available', true, stockDataUrl, productId);
      }
    },
    error: function (xhr, status, error) {
      console.error('Failed to load the stock data:', status, error);
      displayWidget(branch, 'No stock available', true, stockDataUrl, productId);
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

  function filterAndDisplayStockData(stockData, branch, useActualColumn, ctaUrl, productId) {
  // Find the index of the "Available" column by header text (more robust than hard-coding)
  const headers = stockData.find('thead th').map((i, th) => $(th).text().trim().toLowerCase()).get();
  let qtyColIndex = headers.findIndex(h => h.includes('available'));
  if (qtyColIndex === -1) {
    // fallback to previous logic if header lookup fails
    qtyColIndex = useActualColumn ? 4 : 2;
  }
  console.log(`Using column index: ${qtyColIndex} for quantity`);

  const filteredRow = stockData.find('tr').filter((_, row) => {
    const branchCell = $(row).find('td').eq(0).text().trim();
    return branchCell.toLowerCase() === branch.toLowerCase();
  });

  if (filteredRow.length) {
    const rawStockValue = filteredRow.find(`td:eq(${qtyColIndex})`).text().trim();
    const normalized = rawStockValue.toLowerCase();
    const isNoStockText = normalized.includes("no stock");
    const numericMatch = rawStockValue.replace(/,/g, "").match(/-?\d+/);
    const qtyNumber = numericMatch ? parseInt(numericMatch[0], 10) : null;
    const isZero = qtyNumber === 0;

    if (isNoStockText || isZero) {
      displayWidget(branch, "Ship to your store — Free pickup at checkout", false, ctaUrl, productId, "Check nearby stores for pickup today");
    } else {
      displayWidget(branch, rawStockValue, false, ctaUrl, productId, "See availability at other stores");
    }
  } else {
    console.error(`Branch "${branch}" not found in stock table.`);
    displayWidget(branch, 'No stock available', true, ctaUrl, productId, "Check nearby stores for pickup today");
  }
}


function displayWidget(branch, quantityMessage, showSignInButton, ctaUrl, productId, ctaLabel = "Check nearby stores for pickup today") {
  // Ensure only one widget exists
  $('#stock-widget').remove();

  let actionsHtml = `
    <button type="button"
      onclick="openStockModal('${productId}', '${branch.replace(/'/g, "\\'")}', '${ctaUrl}')"
      style="display:inline-block; padding:10px 16px; background:#004080; color:white; border:0; border-radius:6px; font-weight:600; margin-top:10px; cursor:pointer;">
      ${ctaLabel}
    </button>
  `;

  if (showSignInButton) {
    actionsHtml += `
      <a href="${SIGN_IN_URL}"
         style="display:inline-block; padding:10px 16px; background:#6b0016; color:white; text-decoration:none; border-radius:6px; font-weight:600; margin:10px 0 0 10px;">
        Check Your Local Store Inventory
      </a>
    `;
  }

  const widgetHtml = `
    <div id="stock-widget" style="display:table; border:1px solid #ccc; padding:12px; margin:20px 0; background:#f9f9f9; text-align:center; border-radius:8px;">
      <h3 style="margin:0 0 8px; font-size:18px;">Stock Information</h3>
      <p style="margin:4px 0;"><strong>Branch:</strong> ${branch}</p>
      <p style="margin:4px 0;"><strong>Available Quantity:</strong> ${quantityMessage}</p>
      ${actionsHtml}
    </div>
  `;

  $('#ctl00_PageBody_productDetail_productDescription').before(widgetHtml);
}


// --- Lightweight Stock Modal ---
(function(){
  // Create modal shell once
  function ensureStockModal() {
    if ($('#wl-stock-modal').length) return;

    const modalHtml = `
      <div id="wl-stock-modal-backdrop" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.45); z-index:9998;"></div>
      <div id="wl-stock-modal" role="dialog" aria-modal="true" aria-labelledby="wl-stock-title"
           style="display:none; position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); width:min(720px,92vw); max-height:80vh; overflow:auto; background:#fff; border-radius:12px; box-shadow:0 10px 40px rgba(0,0,0,.25); z-index:9999;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 16px; border-bottom:1px solid #eee;">
          <div>
            <h3 id="wl-stock-title" style="margin:0; font-size:18px;">Check Availability at Other Stores</h3>
            <div id="wl-stock-subtitle" style="font-size:12px; color:#666;"></div>
          </div>
          <button type="button" id="wl-stock-close" aria-label="Close"
            style="border:0; background:transparent; font-size:22px; line-height:1; cursor:pointer;">×</button>
        </div>
        <div id="wl-stock-content" style="padding:12px 16px;">
          <div id="wl-stock-loading" style="padding:16px; text-align:center;">Loading availability…</div>
          <div id="wl-stock-error" style="display:none; color:#a00; padding:12px;">Couldn’t load store availability. Please try again.</div>
          <table id="wl-stock-table" style="display:none; width:100%; border-collapse:collapse;">
            <thead>
              <tr>
                <th style="text-align:left; padding:8px; border-bottom:1px solid #eee;">Branch</th>
                <th style="text-align:right; padding:8px; border-bottom:1px solid #eee;">Available</th>
                <th style="text-align:left; padding:8px; border-bottom:1px solid #eee;">Status</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
        <div style="padding:12px 16px; border-top:1px solid #eee; display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" id="wl-stock-close-bottom"
            style="padding:10px 14px; border:1px solid #ddd; background:#fff; border-radius:8px; cursor:pointer;">Close</button>
        </div>
      </div>
    `;
    $('body').append(modalHtml);

    function hideModal() {
      $('#wl-stock-modal, #wl-stock-modal-backdrop').hide();
      // cleanup table rows for next open
      $('#wl-stock-table tbody').empty();
      $('#wl-stock-table').hide();
      $('#wl-stock-error').hide();
      $('#wl-stock-loading').show();
    }
    $('#wl-stock-close, #wl-stock-close-bottom, #wl-stock-modal-backdrop').on('click', hideModal);
    $(document).on('keydown', (e) => { if (e.key === 'Escape') hideModal(); });
  }

  // Parse the HTML of ShowStock.aspx and return rows
  function parseStockRows(html) {
    const $html = $(html);
    const $table = $html.find('#StockDataGrid_ctl00');
    if (!$table.length) return [];

    // detect "Available" column index from header
    const headers = $table.find('thead th').map((i, th) => $(th).text().trim().toLowerCase()).get();
    let qtyColIndex = headers.findIndex(h => h.includes('available'));
    if (qtyColIndex === -1) qtyColIndex = 2; // fallback

    const rows = [];
    $table.find('tbody tr').each((_, tr) => {
      const $tds = $(tr).find('td');
      if (!$tds.length) return;

      const branch = $tds.eq(0).text().trim();
      const availableText = $tds.eq(qtyColIndex).text().trim();
      const numMatch = availableText.replace(/,/g,'').match(/-?\d+/);
      const available = numMatch ? parseInt(numMatch[0], 10) : (availableText.toLowerCase().includes('no stock') ? 0 : null);

      rows.push({ branch, availableText, available });
    });
    return rows;
  }

  // Render rows into our modal table
  function renderStockRows(rows, preferredBranch) {
    const $tbody = $('#wl-stock-table tbody');
    if (!rows.length) {
      $('#wl-stock-error').text('No store data found.').show();
      return;
    }

    // sort: in-stock first, then qty desc, then branch asc
    rows.sort((a,b) => {
      const ai = (a.available ?? -1) > 0 ? 0 : 1;
      const bi = (b.available ?? -1) > 0 ? 0 : 1;
      if (ai !== bi) return ai - bi;
      if ((b.available ?? 0) !== (a.available ?? 0)) return (b.available ?? 0) - (a.available ?? 0);
      return a.branch.localeCompare(b.branch);
    });

    rows.forEach(r => {
      const sameDay = (r.available ?? 0) > 0;
      const isPreferred = preferredBranch && r.branch.toLowerCase() === preferredBranch.toLowerCase();

      const status = sameDay
        ? '<span style="display:inline-block; padding:2px 8px; border-radius:999px; border:1px solid #16a34a; color:#166534; font-size:12px;">Same-day pickup</span>'
        : '<span style="display:inline-block; padding:2px 8px; border-radius:999px; border:1px solid #9ca3af; color:#374151; font-size:12px;">Ship to store</span>';

      const trHtml = `
        <tr>
          <td style="padding:8px; border-bottom:1px solid #f1f1f1;">
            ${r.branch}
            ${isPreferred ? '<span style="margin-left:6px; font-size:11px; color:#6b0016; font-weight:600;">(Selected)</span>' : ''}
          </td>
          <td style="padding:8px; border-bottom:1px solid #f1f1f1; text-align:right; font-feature-settings:tnum; font-variant-numeric:tabular-nums;">
            ${r.available != null ? r.available.toLocaleString() : r.availableText}
          </td>
          <td style="padding:8px; border-bottom:1px solid #f1f1f1;">${status}</td>
        </tr>
      `;
      $tbody.append(trHtml);
    });

    $('#wl-stock-loading').hide();
    $('#wl-stock-table').show();
  }

  // Public: open the modal and populate
  window.openStockModal = function(productId, preferredBranch, ctaUrl) {
    ensureStockModal();
    $('#wl-stock-subtitle').text(`Product ID: ${productId}`);
    $('#wl-stock-modal, #wl-stock-modal-backdrop').show();
    $('#wl-stock-loading').show();
    $('#wl-stock-error').hide();
    $('#wl-stock-table').hide();
    $('#wl-stock-table tbody').empty();

    const url = ctaUrl || `https://webtrack.woodsonlumber.com/Catalog/ShowStock.aspx?productid=${productId}`;
    $.ajax({
      url,
      method: 'GET',
      success: function (data) {
        const rows = parseStockRows(data);
        if (!rows.length) {
          $('#wl-stock-loading').hide();
          $('#wl-stock-error').show();
          return;
        }
        renderStockRows(rows, preferredBranch);
      },
      error: function () {
        $('#wl-stock-loading').hide();
        $('#wl-stock-error').show();
      }
    });
  };
})();




    function updatePickupDeliveryDisplay() {
  console.log("Running updatePickupDeliveryDisplay...");

  const $stockTable = $("#StockDataGrid_ctl00");
  if (!$stockTable.length) {
    console.warn("Stock table not found");
    return;
  }

  const pickupBranch = $("#stock-widget p strong:contains('Branch:')")
    .parent()
    .text()
    .replace("Branch:", "")
    .trim();
  console.log("Detected pickup branch:", pickupBranch);

  const pickupRow = $stockTable.find("tr").filter((_, row) => {
    return $(row).find("td").eq(0).text().trim().toLowerCase() === pickupBranch.toLowerCase();
  });

  const pickupQty = pickupRow.find("td").eq(2).text().trim();
  console.log("Pickup quantity:", pickupQty);
  $(".pickup-info").text(pickupQty ? `${pickupQty} in stock` : "Unavailable");

  let totalDelivery = 0;
  $stockTable.find("tr").each((_, row) => {
    const qty = parseInt($(row).find("td").eq(2).text().replace(/,/g, ""), 10);
    if (!isNaN(qty)) totalDelivery += qty;
  });

  console.log("Total delivery quantity:", totalDelivery);
  $(".delivery-info").text(`${totalDelivery.toLocaleString()} available`);

  if (totalDelivery === 0) {
    $(".delivery-info").text("Unavailable");
    $(".method-box:contains('Delivery')").css({ opacity: 0.5, pointerEvents: "none" });
  }
}

const waitForStockAndRun = setInterval(() => {
  if ($("#StockDataGrid_ctl00").length && $("#stock-widget").length) {
    updatePickupDeliveryDisplay();
    clearInterval(waitForStockAndRun);
  }
}, 250);


});
