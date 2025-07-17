$(document).ready(function () {
  if ($("#product-page").length) return;

  const $insertionPoint = $(".bodyFlexItem.d-flex").first();
  if (!$insertionPoint.length) return;

  // Create wrappers
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

  // 🛒 Build Buy Box from selected <td>s inside the first relevant <tr>
  const $targetRow = $(".bodyFlexItem.d-flex").find("tr:has(td.productPriceSegment)").first();

  if ($targetRow.length) {
    const $price = $targetRow.find("td.productPriceSegment").detach();
    const $qty = $targetRow.find("td.productQtySegment").detach();
    const $right = $targetRow.find("td.productRightSegment").detach();

    const $buyBox = $("<div>").addClass("buy-box").css({
      padding: "15px",
      backgroundColor: "#fff",
      borderRadius: "8px",
      border: "1px solid #ddd",
      marginBottom: "20px",
    });

    if ($price.length) {
      $("<div>")
        .addClass("buy-price")
        .css({ fontSize: "24px", fontWeight: "bold", marginBottom: "10px" })
        .append($price.contents())
        .appendTo($buyBox);
    }

    if ($qty.length || $right.length) {
      const $formGroup = $("<div>").css({
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      });

      if ($qty.length) $formGroup.append($qty.contents());
      if ($right.length) $formGroup.append($right.contents());

      $buyBox.append($formGroup);
    }

    $sidebar.append($buyBox);
  } else {
    console.warn("Buy box row not found.");
  }

  // 🧩 Move other widgets after they load
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
