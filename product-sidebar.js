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

  // 🖼️ Move product image block to main section (if needed)
  const $productImageTable = $("#ctl00_PageBody_productDetail_ProductImage").closest("tr").parent().closest("table");
  if ($productImageTable.length) $main.append($productImageTable);

  // 📄 Description and reviews remain in main content
  const $description = $("#ctl00_PageBody_productDetail_productDescription");
  const $reviews = $("#review-widget");
  const $reviewButton = $("#review-product-button");

  if ($description.length) $main.append($description);
  if ($reviews.length) $main.append($reviews);
  if ($reviewButton.length) $main.append($reviewButton);

  // 🎯 Move specific elements from entryInputDiv to sidebar
  const $entryDiv = $("#ctl00_PageBody_productDetail_entryInputDiv");

  if ($entryDiv.length) {
    const $buyBox = $("<div>").addClass("buy-box").css({
      padding: "15px",
      backgroundColor: "#fff",
      borderRadius: "8px",
      border: "1px solid #ddd",
      marginBottom: "20px",
    });

    // Move (not clone) the actual elements into sidebar
    const $price = $entryDiv.find(".productPriceSegment").first().detach();
    const $unitBefore = $entryDiv.find(".productPerSegment").first().detach();
    const $qtyInput = $entryDiv.find(".productQtySegment").first().detach();
    const $unitAfter = $entryDiv.find(".productPerSegment").eq(0).detach(); // now first again
    const $addBtn = $entryDiv.find("#ctl00_PageBody_productDetail_ctl00_AddProductButton").first().closest("div").detach();
    const $quicklist = $entryDiv.find("#ctl00_PageBody_productDetail_ctl00_QuickList_QuickListLink").closest("div").detach();
    const $stockBtn = $entryDiv.find("#ctl00_PageBody_productDetail_ctl00_btnShowStock").closest("div").detach();

    // Assemble buy box layout
    $buyBox.append(
      $("<div>").css({
        fontSize: "22px",
        fontWeight: "bold",
        marginBottom: "10px"
      }).append($price).append(" ").append($unitBefore),

      $("<div>").css({
        display: "flex",
        alignItems: "center",
        gap: "10px",
        marginBottom: "10px"
      }).append($qtyInput).append($unitAfter),

      $addBtn
    );

    // Utility links below
    const $utilities = $("<div>").addClass("utility-links").css({
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    });

    $utilities.append($quicklist, $stockBtn);

    $sidebar.append($buyBox, $utilities);
  }

  // 🧩 Watch for dynamically loaded widgets
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

  // Insert final structure
  $pageWrapper.append($main, $sidebar);
  $insertionPoint.after($pageWrapper);
});
