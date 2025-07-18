if (window.location.pathname === "/ShoppingCart.aspx") {
  console.log("[CartBranch] Script started.");

  const STORES = [
    "Brenham",
    "Bryan",
    "Caldwell",
    "Lexington",
    "Groesbeck",
    "Mexia",
    "Buffalo"
  ];

  const branchScores = {}; // branchName => # of items it can fulfill
  const cartItems = [];

  $(document).ready(() => {
    console.log("[CartBranch] Document ready. Finding cart items...");

    $(".shopping-cart-item").each(function (i) {
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

    console.log(`[CartBranch] Total valid cart items: ${cartItems.length}`);

    if (cartItems.length) {
      getSignedInBranch().then(accountBranch => {
        getStockForCart(accountBranch);
      });
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
      const branch = selected?.textContent.trim() || null;
      console.log(`[CartBranch] Signed-in account branch: ${branch}`);
      return branch;
    } catch (err) {
      console.warn("[CartBranch] Error fetching signed-in branch:", err);
      return null;
    }
  }

  async function getStockForCart(accountBranch) {
    console.log("[CartBranch] Checking stock availability across branches...");

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
        let accountBranchHasStock = false;

        for (const row of rows) {
          const cells = row.querySelectorAll("td");
          if (cells.length < 5) continue;

          const branchName = cells[0].textContent.trim();
          const qtyText = cells[2].textContent.trim();
          const qty = parseFloat(qtyText.replace(/,/g, ""));

          if (!STORES.includes(branchName)) continue;

          console.log(`[CartBranch] Branch ${branchName} has ${qty} for PID ${item.pid} (need ${item.qty})`);

          if (branchName === accountBranch && qty >= item.qty) {
            accountBranchHasStock = true;
            console.log(`[CartBranch] --> Account branch ${accountBranch} can fulfill PID ${item.pid}`);
          }

          if (qty >= item.qty) {
            branchScores[branchName] = (branchScores[branchName] || 0) + 1;
          }
        }

        if (accountBranchHasStock === false) {
          console.log(`[CartBranch] Account branch cannot fulfill PID ${item.pid}`);
        }

      } catch (err) {
        console.error(`[CartBranch] Failed to fetch stock for PID ${item.pid}:`, err);
      }
    }

    console.log("[CartBranch] Final branch scores:", branchScores);

    const itemCount = cartItems.length;

    if (accountBranch && branchScores[accountBranch] === itemCount) {
      console.log(`[CartBranch] Account branch ${accountBranch} can fulfill all items. Storing...`);
      localStorage.setItem("woodson_cart_branch", accountBranch);
    } else {
      const fullMatch = Object.entries(branchScores).find(([_, count]) => count === itemCount);
      if (fullMatch) {
        const [branch] = fullMatch;
        console.log(`[CartBranch] Alternate branch ${branch} can fulfill all items.`);
        localStorage.setItem("woodson_cart_branch", branch);
      } else {
        const fallback = Object.entries(branchScores).sort((a, b) => b[1] - a[1])[0];
        if (fallback) {
          const [branch] = fallback;
          console.log(`[CartBranch] Partial match: ${branch} can fulfill ${branchScores[branch]} of ${itemCount} items.`);
          localStorage.setItem("woodson_cart_branch", branch);
        } else {
          console.warn("[CartBranch] No matching branch could fulfill any items.");
        }
      }
    }
  }
}

