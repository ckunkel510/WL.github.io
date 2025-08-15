console.log("[LocalStock] Script loaded.");

setTimeout(() => {
  (async function () {
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
    const signedInBranch = await getSignedInBranch();
    const useActualColumn = !!signedInBranch;
    const finalBranch = signedInBranch || (await getNearestStoreBranch(stores)) || DEFAULT_STORE;

    console.log(`[LocalStock] Final branch: ${finalBranch}`);

    // Find all product cards
    const productCards = document.querySelectorAll("table.ProductCard");
    productCards.forEach(async (card, index) => {
      const imgLink = card.querySelector("#ProductImageRow a")?.href;
      const pidMatch = imgLink?.match(/pid=(\d+)/);
      const pid = pidMatch ? pidMatch[1] : null;
      if (!pid) return;

      console.log(`[LocalStock] Card ${index + 1} PID: ${pid}`);

      // Fetch stock data for this PID
      const stockDataUrl = `https://webtrack.woodsonlumber.com/Catalog/ShowStock.aspx?productid=${pid}`;
      let text;
      try {
        const res = await fetch(stockDataUrl, { credentials: "include" });
        text = await res.text();
      } catch (e) {
        console.warn(`[LocalStock] Fetch failed for PID ${pid}`, e);
        return;
      }

      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = text;
      const table = tempDiv.querySelector("#StockDataGrid_ctl00");
      if (!table) {
        console.warn(`[LocalStock] No stock table for PID ${pid}`);
        return;
      }

      const rows = table.querySelectorAll("tr");
      const columnIndex = useActualColumn ? 4 : 2;

      let rawQtyText = null;
      for (let row of rows) {
        const branchCell = row.querySelector("td");
        if (!branchCell) continue;
        const branchName = branchCell.textContent.trim();
        if (branchName.toLowerCase() === finalBranch.toLowerCase()) {
          const qtyCell = row.querySelectorAll("td")[columnIndex];
          rawQtyText = qtyCell?.textContent.trim() || "";
          break;
        }
      }

      // Normalize quantity text
      // Examples we handle: "0", "12", "No Stock", "0 (On Order)"
      const normalized = (rawQtyText || "").toLowerCase();
      const isNoStockText = normalized.includes("no stock");
      const numericMatch = (rawQtyText || "").replace(/,/g, "").match(/-?\d+/);
      const qtyNumber = numericMatch ? parseInt(numericMatch[0], 10) : null;
      const isZero = qtyNumber === 0;

      // If we couldn't find a qty for the branch at all, do nothing (keeps current behavior)
      if (rawQtyText == null) {
        console.log(`[LocalStock] No branch qty cell found for PID ${pid}`);
        return;
      }

      // Build the display message
      let displayHTML;
      if (isNoStockText || isZero) {
        // Your requested fallback message when the chosen branch shows zero
        displayHTML = `
          <div style="
            text-align:center;
            font-weight:600;
            font-size:0.95em;
            padding:4px 8px;
            border-radius:8px;
            border:1px solid #e5e7eb;
          ">
            Ship to your store — <span style="white-space:nowrap;">Free pickup at checkout</span>
          </div>
        `;
      } else {
        // Positive quantity
        displayHTML = `
          <div style="
            text-align:center;
            font-weight:bold;
            color:#004080;
            font-size:0.95em;
            padding:4px 0;
          ">
            ${rawQtyText} in stock at ${finalBranch}
          </div>
        `;
      }

      // Find QuantityRow inside this card
      const quantityRow = card.querySelector("#QuantityRow");
      if (!quantityRow) return;

      const existing = card.querySelector("#LocalStockRow");
      if (existing) existing.remove();

      const localRow = document.createElement("tr");
      localRow.id = "LocalStockRow";

      const td = document.createElement("td");
      td.colSpan = 1;
      td.innerHTML = displayHTML;

      localRow.appendChild(td);
      quantityRow.parentNode.insertBefore(localRow, quantityRow.nextSibling);
      console.log(`[LocalStock] Inserted for PID ${pid}`);
    });

    // === Helper Functions ===

    async function getSignedInBranch() {
      try {
        const res = await fetch("https://webtrack.woodsonlumber.com/AccountSettings.aspx?cms=1", { credentials: "include" });
        const text = await res.text();
        const temp = document.createElement("div");
        temp.innerHTML = text;
        const dropdown = temp.querySelector("#ctl00_PageBody_ChangeUserDetailsControl_ddBranch");
        const selected = dropdown?.querySelector("option[selected='selected']");
        return selected?.textContent.trim() || null;
      } catch (err) {
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
      } catch {
        return null;
      }
    }

    function haversine(lat1, lon1, lat2, lon2) {
      const toRad = deg => (deg * Math.PI) / 180;
      const R = 3958.8; // miles
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.asin(Math.sqrt(a));
    }

  })();
}, 600); // wait for DOM + product card render
