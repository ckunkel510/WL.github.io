
if (window.location.pathname === "/ShoppingCart.aspx") {
  console.log("[CartBranch] Script started (Cart Rows Mode).");

  const STORES = [
    "Brenham", "Bryan", "Caldwell", "Lexington",
    "Groesbeck", "Mexia", "Buffalo"
  ];

  const branchScores = {}; // branchName => # of items it can fulfill
  const cartItems = [];
  const SELECTED_KEY = "woodson_cart_branch";

  $(document).ready(async () => {
    console.log("[CartBranch] Document ready. Finding cart items...");

    // Find all shopping cart items
    $(".shopping-cart-item").each(function (i) {
      const $item = $(this);

      // Extract PID
      const productLink = $item.find("a[href*='ProductDetail.aspx']").attr("href") || "";
      const pidMatch = productLink.match(/pid=(\d+)/i);
      const pid = pidMatch ? pidMatch[1] : null;

      // Extract Quantity
      let qty = null;
      $item.find("input[id*='qty']").each(function () {
        const val = parseFloat($(this).val());
        if (!isNaN(val)) qty = val;
      });

      if (pid && qty != null) {
        cartItems.push({ pid, qty });
        console.log(`[CartBranch] Found item ${i + 1}: PID=${pid}, Qty=${qty}`);
      } else {
        console.warn(`[CartBranch] Skipped item ${i + 1}: PID=${pid}, Qty=${qty}`);
      }
    });

    console.log("[CartBranch] Total valid cart items:", cartItems.length);

    if (cartItems.length) {
      const useActualColumn = !!(await getSignedInBranch());
      await getStockForCart(useActualColumn);
    } else {
      console.warn("[CartBranch] No valid cart items found.");
    }
  });

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
      return null;
    }
  }

  async function getStockForCart(useActualColumn) {
    console.log(`[CartBranch] Checking stock availability (use column ${useActualColumn ? 4 : 2})...`);

    for (const item of cartItems) {
      console.log(`[CartBranch] Fetching stock for PID ${item.pid}...`);

      try {
        const res = await fetch(`https://webtrack.woodsonlumber.com/Catalog/ShowStock.aspx?productid=${item.pid}`);
        const html = await res.text();
        const temp = document.createElement("div");
        temp.innerHTML = html;

        const table = temp.querySelector("#StockDataGrid_ctl00");
        if (!table) {
          console.warn(`[CartBranch] No stock table found for PID ${item.pid}`);
          continue;
        }

        const rows = table.querySelectorAll("tr");
        for (const row of rows) {
          const cells = row.querySelectorAll("td");
          if (cells.length < 5) continue;

          const branchName = cells[0].textContent.trim();
          const qtyText = cells[useActualColumn ? 4 : 2].textContent.trim();
          const qty = parseFloat(qtyText.replace(/,/g, ""));

          if (STORES.includes(branchName)) {
            console.log(`[CartBranch] Branch ${branchName} has ${qty} for PID ${item.pid} (need ${item.qty})`);

            if (!isNaN(qty) && qty >= item.qty) {
              branchScores[branchName] = (branchScores[branchName] || 0) + 1;
              console.log(`[CartBranch] --> ${branchName} can fulfill this item.`);
            }
          }
        }
      } catch (err) {
        console.error(`[CartBranch] Failed to fetch stock for PID ${item.pid}:`, err);
      }
    }

    console.log("[CartBranch] Final branch scores:", branchScores);

    const itemCount = cartItems.length;
    const fullMatch = Object.entries(branchScores).find(([_, count]) => count === itemCount);

    if (fullMatch) {
      const [branch] = fullMatch;
      console.log(`[CartBranch] All items are available at ${branch}. Storing in localStorage.`);
      localStorage.setItem(SELECTED_KEY, branch);
    } else {
      const fallback = Object.entries(branchScores).sort((a, b) => b[1] - a[1])[0];
      if (fallback) {
        const [branch] = fallback;
        console.log(`[CartBranch] Partial match: ${branch} can fulfill ${branchScores[branch]} of ${itemCount} items.`);
        localStorage.setItem(SELECTED_KEY, branch);
      } else {
        console.warn("[CartBranch] No matching branch could fulfill any items.");
      }
    }
  }
}
