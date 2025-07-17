$(document).ready(function () {
  if ($("#product-page").length) return;

  const $insertionPoint = $(".bodyFlexItem.d-flex").first();
  if (!$insertionPoint.length) return;

  // Layout wrappers
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

  // Buy box container
  const $buyBox = $("<div>").addClass("buy-box").css({
    padding: "15px",
    backgroundColor: "#fff",
    borderRadius: "8px",
    border: "1px solid #ddd",
    marginBottom: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  });

  // Move product image to main
  const $imageTd = $("#ctl00_PageBody_productDetail_ProductImage").first().closest("td");
  if ($imageTd.length) $main.append($imageTd);

  // Move elements into sidebar (first instances only)
  const $price = $(".productPriceSegment").first().detach();
  const $unit = $(".productPerSegment").first().detach();
  const $qtyInput = $(".productQtySegment").first().detach();
  const $addBtn = $("#ctl00_PageBody_productDetail_ctl00_AddProductButton").first().closest("div.mb-1").detach();
  const $quicklistBtn = $("#ctl00_PageBody_productDetail_ctl00_QuickList_QuickListLink").first().closest("div.mb-1").detach();
  const $stockBtn = $("#ctl00_PageBody_productDetail_ctl00_btnShowStock").first().closest("div").detach();

  // Build buy box
  $buyBox.append($price, $unit, $qtyInput, $addBtn, $quicklistBtn, $stockBtn);
  $sidebar.append($buyBox);

  // Product description and reviews into main
  const $description = $("#ctl00_PageBody_productDetail_productDescription").first().detach();
  const $reviews = $("#review-widget").first().detach();
  const $reviewButton = $("#review-product-button").first().detach();

  $main.append($description, $reviews, $reviewButton);

  // Watch for and pull in widgets
  function tryMoveWidget(selector) {
    const $el = $(selector).first();
    if ($el.length && !$sidebar.find(selector).length) {
      $sidebar.append($el.detach());
    }
  }

  const intervalId = setInterval(() => {
    tryMoveWidget("#productoption");
    tryMoveWidget("#stock-widget");

    if ($("#productoption").length && $("#stock-widget").length) {
      clearInterval(intervalId);
    }
  }, 250);

  // Inject layout
  $pageWrapper.append($main, $sidebar);
  $insertionPoint.after($pageWrapper);
});
