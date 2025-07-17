$(document).ready(function () {
  if ($("#product-page").length) return;

  const $insertionPoint = $(".bodyFlexItem.d-flex").first();
  if (!$insertionPoint.length) {
    console.error("Insertion point (.bodyFlexItem.d-flex) not found.");
    return;
  }

  // Create layout containers
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
    padding: "15px",
    borderLeft: "2px solid #ccc",
    borderRadius: "8px",
    boxShadow: "0 0 10px rgba(0,0,0,0.05)",
  });

  // Description & reviews stay in main
  const $description = $("#ctl00_PageBody_productDetail_productDescription");
  const $reviews = $("#review-widget");
  const $reviewButton = $("#review-product-button");

  if ($description.length) $main.append($description);
  if ($reviews.length) $main.append($reviews);
  if ($reviewButton.length) $main.append($reviewButton);

  // Build sidebar content by cloning specific elements
  const $entryDiv = $("#ctl00_PageBody_productDetail_entryInputDiv");
  if ($entryDiv.length) {
    const $priceQtyBlock = $("<div>").addClass("priceQtyBlock").css({ marginBottom: "15px" });

    // Extract and clone desired parts only
    $priceQtyBlock.append($entryDiv.find(".productPriceSegment").first().clone());
    $priceQtyBlock.append($entryDiv.find(".productPerSegment").first().clone());
    $priceQtyBlock.append($entryDiv.find(".productQtySegment").first().clone());
    $priceQtyBlock.append($entryDiv.find(".productPerSegment").eq(1).clone());
    $priceQtyBlock.append($entryDiv.find("#ctl00_PageBody_productDetail_ctl00_AddProductButton").first().closest("div").clone());
    $priceQtyBlock.append($entryDiv.find("#ctl00_PageBody_productDetail_ctl00_QuickList_QuickListLink").closest("div").clone());
    $priceQtyBlock.append($entryDiv.find("#ctl00_PageBody_productDetail_ctl00_btnShowStock").closest("div").clone());

    $sidebar.append($priceQtyBlock);
  }

  // Helper: move dynamic widgets like stock-widget and productoption
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

  // Final assembly
  $pageWrapper.append($main, $sidebar);
  $insertionPoint.after($pageWrapper);
});
