if (window.location.pathname === "/ShoppingCart.aspx") {
  console.log("[CartBranch] Script started (Cart Rows Mode).");

  const STORES = [
    "Brenham",
    "Bryan",
    "Caldwell",
    "Lexington",
    "Groesbeck",
    "Mexia",
    "Buffalo"
  ];

  const branchScores = {}; // branchName => number of items it can fulfill
  const cartItems = [];

  $(document).ready(() => {
    const cartRows = $(".shopping-cart-item");
    if (!cartRows.length) {
      console.log("[CartBranch] No cart rows found. Skipping branch analysis.");
      return;
    }

    console.log("[CartBranch] Found cart rows. Scanning...");

    cartRows.each(function (i) {
      const $item = $(this);

      // Find the product URL
      const productLink = $item.find("a[href*='ProductDetail.aspx']").attr("href") || "";
      const pidMatch = productLink.match(/pid=(\d+)/i);
      const pid = pidMatch ? pidMatch[1] : null;

      // Quantity: find any visible or hidden input with 'qty' in its ID and a numeric value
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
      getStockForCart();
    }
  });

  async function getStockForCart() {
    console.log("[CartBranch] Checking stock availability across branches...");

    for (const item of cartItems) {
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
          const qtyText = cells[2].textContent.trim().replace(/,/g, "");
          const qty = parseFloat(qtyText);

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
      console.log(`[CartBranch] All items available at ${branch}. Storing in localStorage.`);
      localStorage.setItem("woodson_cart_branch", branch);
    } else {
      const fallback = Object.entries(branchScores).sort((a, b) => b[1] - a[1])[0];
      if (fallback) {
        const [branch] = fallback;
        console.log(`[CartBranch] Best partial match: ${branch}. Storing in localStorage.`);
        localStorage.setItem("woodson_cart_branch", branch);
      } else {
        console.warn("[CartBranch] No branch can fulfill any items.");
      }
    }
  }
}
