console.log("[BulkPricing] Script loaded.");

// Force a short delay to ensure DOM is fully parsed before running
setTimeout(async () => {
  console.log("[BulkPricing] Executing after slight delay...");

  try {
    // Step 1: Extract PID from the image link
    const productImageLink = document.querySelector("#ProductImageRow a")?.href;
    console.log("[BulkPricing] Product link:", productImageLink);

    const pidMatch = productImageLink?.match(/pid=(\d+)/);
    const pid = pidMatch ? pidMatch[1] : null;
    console.log("[BulkPricing] Parsed PID:", pid);

    if (!pid) {
      console.warn("[BulkPricing] PID not found, exiting.");
      return;
    }

    // Step 2: Fetch the Google Sheet CSV
    const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRmHLHJE9OebjPpi7wMvOHxX6fOdarKQRRbd1W-Vf2o04kLwd9kc0jpm78WFCU4y1ErzCIWVqoUvAwn/pub?output=csv";
    const response = await fetch(sheetUrl);
    const csvText = await response.text();

    console.log("[BulkPricing] Fetched CSV (first 200 chars):", csvText.slice(0, 200));

    // Step 3: Parse CSV with case-insensitive headers
    const rows = csvText.trim().split("\n").map(row => row.split(","));
    const headers = rows[0].map(h => h.trim().toLowerCase());
    const dataRows = rows.slice(1);

    const pidIndex = headers.indexOf("pid");
    const qtyIndex = headers.indexOf("qty");
    const priceIndex = headers.indexOf("price");

    console.log("[BulkPricing] Header indices:", { pidIndex, qtyIndex, priceIndex });

    if (pidIndex === -1 || qtyIndex === -1 || priceIndex === -1) {
      console.error("[BulkPricing] Required headers not found: 'pid', 'qty', 'price'");
      return;
    }

    // Step 4: Filter for matching PID
    const matchingRows = dataRows.filter(row => row[pidIndex] === pid);
    console.log(`[BulkPricing] Found ${matchingRows.length} rows for pid ${pid}`);

    if (matchingRows.length === 0) {
      console.log("[BulkPricing] No bulk pricing available for this product.");
      return;
    }

    // Step 5: Build and insert TR after PriceRow
    const bulkPriceRow = document.createElement("tr");
    bulkPriceRow.id = "BulkPricingRow";

    const td = document.createElement("td");
    td.colSpan = 1;
    td.innerHTML = `
  <div style="
    text-align: center;
    font-weight: bold;
    color: #2c3e70;
    font-size: 0.95em;
    padding: 4px 0;
  ">
    Bulk Pricing: 
    ${matchingRows.map(row => {
      const qty = row[qtyIndex];
      const price = row[priceIndex];
      return price ? `${qty}+ for $${price} ea` : `${qty}+ (price missing)`;
    }).join(" • ")}
  </div>
`;


    bulkPriceRow.appendChild(td);

    const priceRow = document.getElementById("PriceRow");
    if (priceRow) {
      priceRow.parentNode.insertBefore(bulkPriceRow, priceRow.nextSibling);
      console.log("[BulkPricing] Bulk pricing row inserted.");
    } else {
      console.warn("[BulkPricing] Could not find #PriceRow to insert after.");
    }

  } catch (err) {
    console.error("[BulkPricing] Error in script:", err);
  }

}, 500);
