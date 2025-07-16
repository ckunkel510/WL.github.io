console.log("[LocalStock] Script loaded.");

// Delay execution slightly to ensure DOM is fully available
setTimeout(() => {
  (async function () {
    console.log("[LocalStock] Running...");

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

    // Step 1: Get PID from image row link
    const productImageLink = document.querySelector("#ProductImageRow a")?.href;
    const pidMatch = productImageLink?.match(/pid=(\d+)/);
    const productId = pidMatch ? pidMatch[1] : null;
    console.log("[LocalStock] Parsed PID:", productId);

    if (!productId) return;

    // Step 2: Determine location
    const userBranch = await getSignedInBranch();
    const finalBranch = userBranch || await getNearestStoreBranch(stores) || DEFAULT_STORE;
    const useActualColumn = !!userBranch;

    console.log(`[LocalStock] Final branch: ${finalBranch} | Use actual column: ${useActualColumn}`);

    // Step 3: Fetch stock table and extract qty
    const stockDataUrl = `https://webtrack.woodsonlumber.com/Catalog/ShowStock.aspx?productid=${productId}`;
    const res = await fetch(stockDataUrl);
    const text = await res.text();
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = text;
    const table = tempDiv.querySelector("#StockDataGrid_ctl00");

    if (!table) {
      console.warn("[LocalStock] No stock table found.");
      return;
    }

    const rows = table.querySelectorAll("tr");
    const columnIndex = useActualColumn ? 4 : 2;
    let quantity = null;

    for (let row of rows) {
      const branchCell = row.querySelector("td");
      if (!branchCell) continue;

      const branchName = branchCell.textContent.trim();
      if (branchName.toLowerCase() === finalBranch.toLowerCase()) {
        const qtyCell = row.querySelectorAll("td")[columnIndex];
        quantity = qtyCell?.textContent.trim();
        console.log(`[LocalStock] Found quantity: ${quantity} at ${branchName}`);
        break;
      }
    }

    if (!quantity || quantity.toLowerCase().includes("no stock")) {
      console.log("[LocalStock] No quantity to display.");
      return;
    }

    // Step 4: Insert a new row under BulkPricingRow or PriceRow
    const bulkRow = document.getElementById("BulkPricingRow");
    const priceRow = document.getElementById("PriceRow");
    const insertAfter = bulkRow || priceRow;

    if (!insertAfter) {
      console.warn("[LocalStock] No suitable row to insert after.");
      return;
    }

    // Clean up previous row if it exists
    const oldRow = document.getElementById("LocalStockRow");
    if (oldRow) oldRow.remove();

    const localRow = document.createElement("tr");
    localRow.id = "LocalStockRow";

    const td = document.createElement("td");
    td.colSpan = 1;
    td.innerHTML = `
      <div style="
        text-align: center;
        font-weight: bold;
        color: #004080;
        font-size: 0.95em;
        padding: 4px 0;
      ">
        ${quantity} in stock at ${finalBranch}
      </div>
    `;
    localRow.appendChild(td);
    insertAfter.parentNode.insertBefore(localRow, insertAfter.nextSibling);

    console.log("[LocalStock] Inserted stock row.");

    // === Helper Functions ===

    async function getSignedInBranch() {
      try {
        const res = await fetch("https://webtrack.woodsonlumber.com/AccountSettings.aspx?cms=1");
        const text = await res.text();
        const temp = document.createElement("div");
        temp.innerHTML = text;
        const dropdown = temp.querySelector("#ctl00_PageBody_ChangeUserDetailsControl_ddBranch");
        const selected = dropdown?.querySelector("option[selected='selected']");
        return selected?.textContent.trim() || null;
      } catch (err) {
        console.warn("[LocalStock] Failed to fetch signed-in branch:", err);
        return null;
      }
    }

    async function getNearestStoreBranch(stores) {
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          });
        });

        const { latitude, longitude } = pos.coords;
        let nearest = stores[0];
        let minDist = Infinity;

        for (const store of stores) {
          const dist = haversine(latitude, longitude, store.lat, store.lon);
          if (dist < minDist) {
            nearest = store;
            minDist = dist;
          }
        }

        return nearest.name;
      } catch (err) {
        console.warn("[LocalStock] Geolocation failed, falling back.");
        return null;
      }
    }

    function haversine(lat1, lon1, lat2, lon2) {
      const toRad = deg => (deg * Math.PI) / 180;
      const R = 3958.8;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.asin(Math.sqrt(a));
    }

  })();
}, 600); // delay to wait for product HTML to fully load
