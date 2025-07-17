$(document).ready(function () {
  if ($("#product-page").length) return;

  const $insertionPoint = $(".bodyFlexItem.d-flex").first();
  if (!$insertionPoint.length) return;

  const $pageWrapper = $("<div>", { id: "product-page" }).css({
    display: "flex",
    flexWrap: "wrap",
    gap: "20px",
  });

  const $main = $("<div>", { id: "product-main" }).css({
    flex: "1 1 65%",
    minWidth: "300px",
  });

  const $sidebar = $("<div>", { id: "product-sidebar" }).css({
    flex: "1 1 30%",
    minWidth: "250px",
    backgroundColor: "#f6f6f6",
    padding: "20px",
    borderLeft: "2px solid #ccc",
    borderRadius: "8px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
  });

  // ⬅️ Move product image block to main
  const $productImageTable = $("#ctl00_PageBody_productDetail_ProductImage").closest("table");
  if ($productImageTable.length) $main.append($productImageTable);

  // 📄 Add description and reviews
  const $description = $("#ctl00_PageBody_productDetail_productDescription");
  const $reviews = $("#review-widget");
  const $reviewButton = $("#review-product-button");

  if ($description.length) $main.append($description);
  if ($reviews.length) $main.append($reviews);
  if ($reviewButton.length) $main.append($reviewButton);

  // ✅ Move the full price + qty + button row
  const $entryRow = $("#ctl00_PageBody_productDetail_ctl00_DetailHeader").closest("table").find("tr").eq(2); // This is the row with price, qty, and buttons

  if ($entryRow.length) {
    const $buyBox = $("<div>").addClass("buy-box").css({
      padding: "15px",
      backgroundColor: "#fff",
      borderRadius: "8px",
      border: "1px solid #ddd",
      marginBottom: "20px",
    });

    $buyBox.append($entryRow.detach());
    $sidebar.append($buyBox);
  }

  // 🧩 Utility actions (Quicklist & Stock buttons)
  const $quicklist = $("#ctl00_PageBody_productDetail_ctl00_QuickList_QuickListLink").closest("div").detach();
  const $stockBtn = $("#ctl00_PageBody_productDetail_ctl00_btnShowStock").closest("div").detach();

  const $utilities = $("<div>").addClass("utility-links").css({
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  });

  $utilities.append($quicklist, $stockBtn);
  $sidebar.append($utilities);

  // 🎯 Move optional widgets if present
  function tryMoveWidget(selector) {
    const $el = $(selector);
    if ($el.length && !$sidebar.find(selector).length) {
      $sidebar.append($el);
    }
  }

  const intervalId = setInterval(() => {
    tryMoveWidget("#productoption");
    tryMoveWidget("#stock-widget");

    if ($("#productoption").length && $("#stock-widget").length) {
      clearInterval(intervalId);
    }
  }, 250);

  // Inject the layout
  $pageWrapper.append($main, $sidebar);
  $insertionPoint.after($pageWrapper);
});
