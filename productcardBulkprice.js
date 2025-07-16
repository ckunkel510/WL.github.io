  document.addEventListener("DOMContentLoaded", async () => {
    // Step 1: Get the PID from the image link
    const productImageLink = document.querySelector("#ProductImageRow a")?.href;
    const pidMatch = productImageLink?.match(/pid=(\d+)/);
    const pid = pidMatch ? pidMatch[1] : null;

    if (!pid) return;

    // Step 2: Fetch data from your published Google Sheet
    const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vYourGoogleSheetID/pub?output=csv";
    const response = await fetch(sheetUrl);
    const csvText = await response.text();

    // Step 3: Parse CSV and filter for current pid
    const rows = csvText.trim().split("\n").map(row => row.split(","));
    const headers = rows[0];
    const dataRows = rows.slice(1);

    const bulkPrices = dataRows.filter(row => row[headers.indexOf("pid")] === pid);

    if (bulkPrices.length === 0) return;

    // Step 4: Build the HTML row
    const bulkPriceTd = document.createElement("td");
    bulkPriceTd.colSpan = 1; // Adjust if needed
    bulkPriceTd.innerHTML = `
      <div style="text-align:center; font-size: 0.9em; color: #444;">
        <strong>Bulk Pricing:</strong><br>
        ${bulkPrices.map(row =>
          `${row[headers.indexOf("qty")]}+ for $${row[headers.indexOf("price")]} ea`
        ).join("<br>")}
      </div>
    `;

    const bulkPriceTr = document.createElement("tr");
    bulkPriceTr.id = "BulkPricingRow";
    bulkPriceTr.appendChild(bulkPriceTd);

    // Step 5: Insert after PriceRow
    const priceRow = document.getElementById("PriceRow");
    priceRow.parentNode.insertBefore(bulkPriceTr, priceRow.nextSibling);
  });

