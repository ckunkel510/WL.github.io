$(document).ready(function () {
  // Exit if layout already injected
  if ($("#product-page").length) return;

  const $entryInput = $("#ctl00_PageBody_productDetail_entryInputDiv");
  const $description = $("#ctl00_PageBody_productDetail_productDescription");
  const $reviews = $("#review-widget");
  const $reviewButton = $("#review-product-button");

  // Sidebar widgets (add more here as needed)
  const widgetSelectors = ["#productoption", "#stock-widget"];

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
  });

  // Move main sections
  $main.append($entryInput);
  $main.append($description);
  if ($reviews.length) $main.append($reviews);
  if ($reviewButton.length) $main.append($reviewButton);

  // Move widgets into sidebar
  widgetSelectors.forEach(selector => {
    const $widget = $(selector);
    if ($widget.length) $sidebar.append($widget);
  });

  // Assemble and insert layout
  $pageWrapper.append($main, $sidebar);
  $entryInput.after($pageWrapper);
});
