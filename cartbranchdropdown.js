
if (window.location.pathname === "/ShoppingCart.aspx") {
  console.log("[CartBranch] Dropdown handler loaded.");

  const SELECTED_KEY = "woodson_cart_branch";
  const DROPDOWN_ID = "#ctl00_PageBody_BranchDropDownList";

  window.addEventListener("load", () => {
    const storedBranch = localStorage.getItem(SELECTED_KEY);
    console.log("[CartBranch] Stored branch in localStorage:", storedBranch);

    const $dropdown = $(DROPDOWN_ID);
    if ($dropdown.length === 0) {
      console.warn("[CartBranch] Branch dropdown not found.");
      return;
    }

    const currentSelected = $dropdown.find("option:selected").text().trim();
    console.log("[CartBranch] Current selected branch:", currentSelected);

    // Only apply if no manual override has been done
    const manuallySelected = sessionStorage.getItem("woodson_user_selected_branch");
    if (manuallySelected) {
      console.log("[CartBranch] User has manually selected a branch. Aborting auto-set.");
      return;
    }

    if (storedBranch && !currentSelected.toLowerCase().startsWith(storedBranch.toLowerCase())) {
      const matchOption = $dropdown.find("option").filter((_, opt) =>
        $(opt).text().toLowerCase().startsWith(storedBranch.toLowerCase())
      );

      if (matchOption.length > 0) {
        console.log(`[CartBranch] Setting dropdown to stored branch: ${storedBranch}`);
        matchOption.prop("selected", true);
        $dropdown.trigger("change");
      } else {
        console.warn(`[CartBranch] No matching option found for: ${storedBranch}`);
      }
    } else {
      console.log("[CartBranch] No update needed. Dropdown already matches stored branch.");
    }

    // Listen for user manual changes to prevent future overrides
    $dropdown.on("change", function () {
      const newSelected = $(this).find("option:selected").text().trim();
      sessionStorage.setItem("woodson_user_selected_branch", newSelected);
      console.log("[CartBranch] User manually changed branch to:", newSelected);
    });
  });
}
