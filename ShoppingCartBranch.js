if (window.location.pathname === "/ShoppingCart.aspx") {
  console.log("[CartBranch] Script started.");

  const STORES = [
    "Brenham", "Bryan", "Caldwell", "Lexington",
    "Groesbeck", "Mexia", "Buffalo"
  ];

  let branchScores = {};
  let cartItems = [];

  const STORAGE_KEY_BRANCH = "woodson_cart_branch";
  const STORAGE_KEY_APPLIED = "woodson_cart_branch_applied";
  const STORAGE_KEY_CART_HASH = "woodson_cart_hash";

  function hashCartItems(items) {
    return items.map(i => `${i.pid}-${i.qty}`).join("|");
  }

  function parseCartItems() {
    const newItems = [];
    $(".shopping-cart-item").each(function (i) {
      const $item = $(this);
      const productLink = $item.find("a[href*='ProductDetail.aspx']").attr("href") || "";
      const pidMatch = productLink.match(/pid=(\d+)/i);
      const pid = pidMatch ? pidMatch[1] : null;

      let qty = null;
      $item.find("input[id*='qty']").each(function () {
        const val = parseFloat($(this).val());
        if (!isNaN(val)) qty = val;
      });

      if (pid && qty != null) {
        newItems.push({ pid, qty });
        console.log(`[CartBranch] Found item ${i + 1}: PID=${pid}, Qty=${qty}`);
      } else {
        console.warn(`[CartBranch] Skipped item ${i + 1}: PID=${pid}, Qty=${qty}`);
      }
    });

    return newItems;
  }

  async function getStockForCart() {
    console.log("[CartBranch] Checking stock availability across branches...");
    branchScores = {};

    for (const item of cartItems) {
      try {
        const res = await fetch(`https://webtrack.woodsonlumber.com/Catalog/ShowStock.aspx?productid=${item.pid}`);
        const html = await res.text();
        const temp = document.createElement("div");
        temp.innerHTML = html;

        const table = temp.querySelector("#StockDataGrid_ctl00");
        if (!table) continue;

        const rows = table.querySelectorAll("tr");
        for (const row of rows) {
          const cells = row.querySelectorAll("td");
          if (cells.length < 3) continue;

          const branchName = cells[0].textContent.trim();
          const qtyText = cells[2].textContent.trim();
          const qty = parseFloat(qtyText.replace(/,/g, ""));

          if (STORES.includes(branchName)) {
            console.log(`[CartBranch] Branch ${branchName} has ${qty} for PID ${item.pid} (need ${item.qty})`);
            if (qty >= item.qty) {
              branchScores[branchName] = (branchScores[branchName] || 0) + 1;
            }
          }
        }
      } catch (err) {
        console.error(`[CartBranch] Error fetching stock for PID ${item.pid}:`, err);
      }
    }

    console.log("[CartBranch] Final branch scores:", branchScores);

    const itemCount = cartItems.length;
    const fullMatch = Object.entries(branchScores).find(([_, count]) => count === itemCount);

    if (fullMatch) {
      const [branch] = fullMatch;
      localStorage.setItem(STORAGE_KEY_BRANCH, branch);
      localStorage.removeItem(STORAGE_KEY_APPLIED);
      console.log(`[CartBranch] All items available at ${branch}. Saved.`);
    } else {
      const fallback = Object.entries(branchScores).sort((a, b) => b[1] - a[1])[0];
      if (fallback) {
        const [branch] = fallback;
        localStorage.setItem(STORAGE_KEY_BRANCH, branch);
        localStorage.removeItem(STORAGE_KEY_APPLIED);
        console.log(`[CartBranch] Partial match at ${branch}. Saved.`);
      } else {
        console.warn("[CartBranch] No branch can fulfill any items.");
      }
    }

    applyStoredBranchToDropdown();
  }

  function applyStoredBranchToDropdown() {
    const savedBranch = localStorage.getItem(STORAGE_KEY_BRANCH);
    const alreadyApplied = localStorage.getItem(STORAGE_KEY_APPLIED);

    if (!savedBranch || alreadyApplied) return;

    const $dropdown = $("#ctl00_PageBody_BranchDropDownList");
    if ($dropdown.length && !$dropdown.prop("disabled")) {
      const selectedText = $dropdown.find("option:selected").text().trim();
      if (!selectedText.toLowerCase().startsWith(savedBranch.toLowerCase())) {
        const match = $dropdown.find("option").filter((_, opt) =>
          $(opt).text().toLowerCase().startsWith(savedBranch.toLowerCase())
        );

        if (match.length) {
          console.log(`[CartBranch] Applying stored branch: ${savedBranch}`);
          match.prop("selected", true);
          $dropdown.trigger("change");
          localStorage.setItem(STORAGE_KEY_APPLIED, "true");
        } else {
          console.warn(`[CartBranch] Could not match branch in dropdown: ${savedBranch}`);
        }
      } else {
        console.log("[CartBranch] Dropdown already matches stored branch.");
        localStorage.setItem(STORAGE_KEY_APPLIED, "true");
      }
    }
  }

  function initCartBranchLogic() {
    console.log("[CartBranch] Document ready. Scanning cart...");

    cartItems = parseCartItems();
    const newHash = hashCartItems(cartItems);
    const oldHash = localStorage.getItem(STORAGE_KEY_CART_HASH);

    if (cartItems.length === 0) {
      console.warn("[CartBranch] No valid items in cart.");
      return;
    }

    if (newHash !== oldHash) {
      console.log("[CartBranch] Cart changed. Recalculating...");
      localStorage.setItem(STORAGE_KEY_CART_HASH, newHash);
      localStorage.removeItem(STORAGE_KEY_APPLIED);
      getStockForCart();
    } else {
      console.log("[CartBranch] Cart unchanged. Applying stored selection...");
      applyStoredBranchToDropdown();
    }
  }

  // === Run on load ===
  $(document).ready(() => {
    initCartBranchLogic();

    // Watch for cart changes (dynamic add/remove)
    const observer = new MutationObserver(() => {
      initCartBranchLogic();
    });

    observer.observe(document.querySelector("form") || document.body, {
      childList: true,
      subtree: true
    });
  });
}
