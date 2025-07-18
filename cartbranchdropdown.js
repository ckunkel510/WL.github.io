if (window.location.pathname === "/ShoppingCart.aspx") {
  console.log("[CartBranchDropdown] Script started (Dropdown Mode).");

  const SELECTED_KEY = "woodson_cart_branch";
  const hasCartRows = $(".shopping-cart-item").length > 0;

  if (hasCartRows) {
    console.log("[CartBranchDropdown] Detected cart rows. This script will skip execution.");
    return; // Let the row script handle this part
  }

  // Only run if dropdown is visible
  const interval = setInterval(() => {
    const $dropdown = $("#ctl00_PageBody_BranchDropDownList");

    if ($dropdown.length && $dropdown.is(":visible")) {
      clearInterval(interval);

      const userSelected = $dropdown.find("option:selected").val();
      const savedBranch = localStorage.getItem(SELECTED_KEY);

      if (!savedBranch) {
        console.log("[CartBranchDropdown] No stored branch found.");
        return;
      }

      const alreadyMatches = $dropdown.find("option:selected").text().toLowerCase().includes(savedBranch.toLowerCase());
      if (alreadyMatches) {
        console.log(`[CartBranchDropdown] Branch already selected by user: ${userSelected}`);
        return;
      }

      // Attempt to match and select saved branch
      const $match = $dropdown.find("option").filter((_, opt) =>
        $(opt).text().toLowerCase().startsWith(savedBranch.toLowerCase())
      );

      if ($match.length) {
        console.log(`[CartBranchDropdown] Auto-selecting stored branch: ${savedBranch}`);
        $match.prop("selected", true);
        $dropdown.trigger("change");

        const $notice = $("<div>")
          .addClass("alert alert-info mt-3")
          .text(`We've pre-selected ${savedBranch} to help improve order fulfillment.`);

        $("#ctl00_PageBody_BranchSelector").after($notice);
      } else {
        console.warn(`[CartBranchDropdown] Could not match stored branch: ${savedBranch}`);
      }
    }
  }, 400);
}
