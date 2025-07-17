$(document).ready(function () {
  if ($("#product-page").length) return;

  const $insertionPoint = $(".bodyFlexItem.d-flex").first();
  if (!$insertionPoint.length) return;

  // Create layout wrappers
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

  // 🖼 Move product images
  const $imageTable = $("#ctl00_PageBody_productDetail_ProductImage").closest("table");
  if ($imageTable.length) $main.append($imageTable);

  // 📄 Description & Reviews
  const $description = $("#ctl00_PageBody_productDetail_productDescription");
  const $reviews = $("#review-widget");
  const $reviewButton = $("#review-product-button");

  if ($description.length) $main.append($description);
  if ($reviews.length) $main.append($reviews);
  if ($reviewButton.length) $main.append($reviewButton);

  // 🎯 Find the first matching tr inside .bodyFlexItem
  const $targetRow = $(".bodyFlexItem.d-flex").find("tr:has(td.productPriceSegment)").first();

  if ($targetRow.length) {
    const $buyBox = $("<div>").addClass("buy-box").css({
      padding: "15px",
      backgroundColor: "#fff",
      borderRadius: "8px",
      border: "1px solid #ddd",
      marginBottom: "20px",
    });

    const $wrappedTable = $("<table>").css({ width: "100%" });
    $wrappedTable.append($targetRow.detach()); // detach moves it
    $buyBox.append($wrappedTable);
    $sidebar.append($buyBox);
  } else {
    console.warn("Buy box row not found.");
  }

  // 🧩 Move dynamic widgets after load
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

  // 🧱 Final layout injection
  $pageWrapper.append($main, $sidebar);
  $insertionPoint.after($pageWrapper);
});
