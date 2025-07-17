$(document).ready(function () {
  if ($("#product-page").length) return;

  const $insertionPoint = $(".bodyFlexItem.d-flex").first();
  if (!$insertionPoint.length) return;

  // Create new layout
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

  // Step 1: Extract the <tr> with product image
  const $imageTd = $("#ctl00_PageBody_productDetail_ProductImage").closest("td");
  const $productRow = $imageTd.closest("tr");

  // Step 2: Detach all sibling <td> contents from that row EXCEPT the image
  const $sidebarContents = $("<div>").addClass("buy-box").css({
    padding: "15px",
    backgroundColor: "#fff",
    borderRadius: "8px",
    border: "1px solid #ddd",
    marginBottom: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  });

  $productRow.children("td").each(function () {
    const containsImage = $(this).find("#ctl00_PageBody_productDetail_ProductImage").length > 0;
    if (!containsImage) {
      const contents = $(this).contents().detach();
      $sidebarContents.append(contents);
    } else {
      $main.append($(this)); // keep the image td in main
    }
  });

  $sidebar.append($sidebarContents);

  // Add product description and reviews to main
  const $description = $("#ctl00_PageBody_productDetail_productDescription");
  const $reviews = $("#review-widget");
  const $reviewButton = $("#review-product-button");

  if ($description.length) $main.append($description);
  if ($reviews.length) $main.append($reviews);
  if ($reviewButton.length) $main.append($reviewButton);

  // Move custom widgets into sidebar
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

  // Inject new layout after insertion point
  $pageWrapper.append($main, $sidebar);
  $insertionPoint.after($pageWrapper);
});
