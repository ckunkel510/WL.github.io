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

    console.log("[CartBranch] Total valid cart items:", cartItems.length);

    if (cartItems.length) {
      getStockForCart();
    } else {
      console.warn("[CartBranch] No valid cart items found.");
    }
  });

  async function getStockForCart() {
    console.log("[CartBranch] Checking stock availability across branches...");

    const useActualColumn = await getSignedInBranch() !== null;
    const columnIndex = useActualColumn ? 4 : 2;

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
          if (cells.length <= columnIndex) continue;

          const branchName = cells[0].textContent.trim();
          const rawQty = cells[columnIndex].textContent.trim().replace(/,/g, "");
          const qty = parseFloat(rawQty);

          if (STORES.includes(branchName)) {
            if (isNaN(qty)) {
              console.warn(`[CartBranch] Branch ${branchName} has invalid quantity "${rawQty}" for PID ${item.pid} (need ${item.qty})`);
            } else {
              console.log(`[CartBranch] Branch ${branchName} has ${qty} for PID ${item.pid} (need ${item.qty})`);

              if (qty >= item.qty) {
                branchScores[branchName] = (branchScores[branchName] || 0) + 1;
                console.log(`[CartBranch] --> ${branchName} can fulfill this item.`);
              }
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
      console.log(`[CartBranch] All items are available at ${branch}. Setting as selected.`);
      localStorage.setItem("woodson_cart_branch", branch);
      updateBranchDropdown(branch);
      showCartBranchNotice(branch, false);
    } else {
      const fallback = Object.entries(branchScores).sort((a, b) => b[1] - a[1])[0];
      if (fallback) {
        const [branch] = fallback;
        console.log(`[CartBranch] Partial match: ${branch} can fulfill ${branchScores[branch]} of ${itemCount} items.`);
        localStorage.setItem("woodson_cart_branch", branch);
        updateBranchDropdown(branch);
        showCartBranchNotice(branch, true);
      } else {
        console.warn("[CartBranch] No matching branch could fulfill any items.");
      }
    }
  }

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
      console.warn("[CartBranch] Could not retrieve signed-in branch");
      return null;
    }
  }

  function updateBranchDropdown(branchName) {
    const $dropdown = $("#ctl00_PageBody_BranchDropDownList");
    const matchOption = $dropdown.find("option").filter((_, opt) =>
      $(opt).text().toLowerCase().startsWith(branchName.toLowerCase())
    );

    if (matchOption.length) {
      console.log(`[CartBranch] Selecting dropdown option for: ${branchName}`);
      matchOption.prop("selected", true);
      $dropdown.trigger("change");
    } else {
      console.warn(`[CartBranch] Could not match branch in dropdown: ${branchName}`);
    }
  }

  function showCartBranchNotice(branch, isPartial) {
    const message = isPartial
      ? `Some items in your cart are available at ${branch}. We've updated your selected store to improve fulfillment.`
      : `All items in your cart are available at ${branch}. We've updated your selected store to ensure fulfillment.`;

    const $notice = $("<div>")
      .addClass("alert alert-info mt-3")
      .text(message);

    $("#ctl00_PageBody_BranchSelector").after($notice);
    console.log("[CartBranch] User notified:", message);
  }
}
