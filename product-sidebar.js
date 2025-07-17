$(document).ready(function () {
  if ($("#product-page").length) return;

  const $insertionPoint = $(".bodyFlexItem.d-flex").first();
  if (!$insertionPoint.length) return;

  // Layout structure
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

  // Buy Box Container
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

  // Move the image to main content
  const $imageTd = $("#ctl00_PageBody_productDetail_ProductImage").closest("td");
  if ($imageTd.length) {
    $main.append($imageTd);
  }

  // Move important elements to sidebar
  const $price = $(".productPriceSegment").detach();
  const $unit = $(".productPerSegment").first().detach(); // first occurrence of unit
  const $qtyInput = $(".productQtySegment").detach();
  const $addBtn = $("#ctl00_PageBody_productDetail_ctl00_AddProductButton").closest("div.mb-1").detach();
  const $quicklistBtn = $("#ctl00_PageBody_productDetail_ctl00_QuickList_QuickListLink").closest("div.mb-1").detach();
  const $stockBtn = $("#ctl00_PageBody_productDetail_ctl00_btnShowStock").closest("div").detach();

  // Append in order
  $buyBox.append($price);
  $buyBox.append($unit);
  $buyBox.append($qtyInput);
  $buyBox.append($addBtn);
  $buyBox.append($quicklistBtn);
  $buyBox.append($stockBtn);

  $sidebar.append($buyBox);

  // Product description and reviews to main
  const $description = $("#ctl00_PageBody_productDetail_productDescription");
  const $reviews = $("#review-widget");
  const $reviewButton = $("#review-product-button");

  if ($description.length) $main.append($description.detach());
  if ($reviews.length) $main.append($reviews.detach());
  if ($reviewButton.length) $main.append($reviewButton.detach());

  // Custom widgets into sidebar
  function tryMoveWidget(selector) {
    const $el = $(selector);
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
