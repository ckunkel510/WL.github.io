$(document).ready(function () {
  // Ensure we only inject once
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

  // Move content to the proper side
  const $entryInput = $("#ctl00_PageBody_productDetail_entryInputDiv");
  const $description = $("#ctl00_PageBody_productDetail_productDescription");
  const $reviews = $("#review-widget");
  const $reviewButton = $("#review-product-button");

  if ($entryInput.length) $sidebar.append($entryInput);
  if ($description.length) $main.append($description);
  if ($reviews.length) $main.append($reviews);
  if ($reviewButton.length) $main.append($reviewButton);

  // Helper: try to move widget to sidebar if it appears
  function tryMoveWidget(selector) {
    const $el = $(selector);
    if ($el.length && !$sidebar.find(selector).length) {
      $sidebar.append($el);
    }
  }

  // Watch for delayed widgets (like stock or options)
  const intervalId = setInterval(() => {
    tryMoveWidget("#productoption");
    tryMoveWidget("#stock-widget");

    // If both are found and moved, stop polling
    if ($("#productoption").length && $("#stock-widget").length) {
      clearInterval(intervalId);
    }
  }, 250);

  // Assemble and insert layout
  $pageWrapper.append($main, $sidebar);
  $insertionPoint.after($pageWrapper);
});
