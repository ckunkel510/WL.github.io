$(document).ready(function () {
  if ($("#product-page").length) return;

  const $insertionPoint = $(".bodyFlexItem.d-flex").first();
  if (!$insertionPoint.length) return;

  // Create page layout
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

  // Move image table first
  const $imageTable = $("#ctl00_PageBody_productDetail_ProductImage").closest("table");
  if ($imageTable.length) $main.append($imageTable);

  // Description and other non-action info
  const $description = $("#ctl00_PageBody_productDetail_productDescription");
  const $reviews = $("#review-widget");
  const $reviewButton = $("#review-product-button");

  if ($description.length) $main.append($description);
  if ($reviews.length) $main.append($reviews);
  if ($reviewButton.length) $main.append($reviewButton);

  // 🛒 Directly target and move the relevant td contents
  const $priceSegment = $("td.productPriceSegment").first().detach();
  const $qtySegment = $("td.productQtySegment").first().detach();
  const $rightSegment = $("td.productRightSegment").first().detach();

  // Build sidebar buy box
  const $buyBox = $("<div>").addClass("buy-box").css({
    padding: "15px",
    backgroundColor: "#fff",
    borderRadius: "8px",
    border: "1px solid #ddd",
    marginBottom: "20px",
  });

  if ($priceSegment.length) {
    $("<div>")
      .addClass("buy-price")
      .css({ fontSize: "24px", fontWeight: "bold", marginBottom: "10px" })
      .append($priceSegment.contents())
      .appendTo($buyBox);
  }

  const $formGroup = $("<div>").css({
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  });

  if ($qtySegment.length) $formGroup.append($qtySegment.contents());
  if ($rightSegment.length) $formGroup.append($rightSegment.contents());

  $buyBox.append($formGroup);
  $sidebar.append($buyBox);

  // 🧩 Move productoption and stock-widget once loaded
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

  // Inject layout
  $pageWrapper.append($main, $sidebar);
  $insertionPoint.after($pageWrapper);
});
