$(document).ready(function () {
  // Avoid duplicate layout
  if ($("#product-page").length) return;

  // Select the new insertion point
  const $insertionPoint = $(".bodyFlexItem.d-flex").first();

  // Core sections
  const $entryInput = $("#ctl00_PageBody_productDetail_entryInputDiv");
  const $description = $("#ctl00_PageBody_productDetail_productDescription");
  const $reviews = $("#review-widget");
  const $reviewButton = $("#review-product-button");

  // Sidebar widgets (add more IDs as needed)
  const widgetSelectors = ["#productoption", "#stock-widget"];

  // Create new layout containers
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

  // Move core content to #product-main
  $main.append($entryInput, $description);
  if ($reviews.length) $main.append($reviews);
  if ($reviewButton.length) $main.append($reviewButton);

  // Move any present widgets into #product-sidebar
  widgetSelectors.forEach(selector => {
    const $widget = $(selector);
    if ($widget.length) $sidebar.append($widget);
  });

  // Assemble final layout
  $pageWrapper.append($main, $sidebar);

  // Insert new layout after the correct point
  $insertionPoint.after($pageWrapper);
});
