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

  const branchScores = {}; // branchName => how many items it can fulfill
  const cartItems = [];

  $(document).ready(() => {
    $(".shopping-cart-item").each(function () {
      const $item = $(this);
      const productLink = $item.find("a[href*='ProductDetail.aspx?pid=']").attr("href");
      const pidMatch = productLink?.match(/pid=(\d+)/);
      const pid = pidMatch ? pidMatch[1] : null;

      const qty = parseFloat($item.find("input[type='text']").val());

      if (pid && qty) {
        cartItems.push({ pid, qty });
      }
    });

    if (cartItems.length) {
      getStockForCart();
    }
  });

  async function getStockForCart() {
    console.log("[CartBranch] Checking stock for:", cartItems);
    for (const item of cartItems) {
      const res = await fetch(`https://webtrack.woodsonlumber.com/Catalog/ShowStock.aspx?productid=${item.pid}`);
      const html = await res.text();
      const temp = document.createElement("div");
      temp.innerHTML = html;

      const table = temp.querySelector("#StockDataGrid_ctl00");
      if (!table) continue;

      const rows = table.querySelectorAll("tr");

      for (const row of rows) {
        const cells = row.querySelectorAll("td");
        if (cells.length < 5) continue;

        const branchName = cells[0].textContent.trim();
        const qtyText = cells[2].textContent.trim(); // column 3 = available
        const qty = parseFloat(qtyText.replace(/,/g, ""));

        if (STORES.includes(branchName) && qty >= item.qty) {
          branchScores[branchName] = (branchScores[branchName] || 0) + 1;
        }
      }
    }

    console.log("[CartBranch] Branch scores:", branchScores);

    const itemCount = cartItems.length;
    const fullMatch = Object.entries(branchScores).find(([_, count]) => count === itemCount);

    if (fullMatch) {
      const [branch] = fullMatch;
      localStorage.setItem("woodson_cart_branch", branch);
      updateBranchDropdown(branch);
      showCartBranchNotice(branch, false);
    } else {
      const fallback = Object.entries(branchScores).sort((a, b) => b[1] - a[1])[0];
      if (fallback) {
        const [branch] = fallback;
        localStorage.setItem("woodson_cart_branch", branch);
        updateBranchDropdown(branch);
        showCartBranchNotice(branch, true);
      }
    }
  }

  function updateBranchDropdown(branchName) {
    const $dropdown = $("#ctl00_PageBody_BranchDropDownList");
    const matchOption = $dropdown.find("option").filter((_, opt) =>
      $(opt).text().toLowerCase().startsWith(branchName.toLowerCase())
    );

    if (matchOption.length && !matchOption.prop("selected")) {
      matchOption.prop("selected", true);
      $dropdown.trigger("change");
    }
  }

  function showCartBranchNotice(branch, isPartial) {
    const $notice = $("<div>")
      .addClass("alert alert-info mt-3")
      .text(
        isPartial
          ? `Some items in your cart are available at ${branch}. We've updated your selected store to improve fulfillment.`
          : `All items in your cart are available at ${branch}. We've updated your selected store to ensure fulfillment.`
      );

    $("#ctl00_PageBody_BranchSelector").after($notice);
  }
}

