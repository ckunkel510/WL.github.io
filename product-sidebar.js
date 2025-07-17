$(document).ready(function () {
  // Define widgets to move into sidebar
  const widgetSelectors = ['#productoption', '#stock-widget'];

  // Check if sidebar already exists
  if ($("#product-sidebar").length === 0) {
    // Create layout containers
    const $pageWrapper = $("<div>", { id: "product-page", css: { display: "flex", flexWrap: "wrap", gap: "20px" } });
    const $mainContent = $("<div>", { id: "product-main", css: { flex: "1 1 65%", minWidth: "300px" } });
    const $sidebar = $("<div>", { id: "product-sidebar", css: { flex: "1 1 30%", minWidth: "250px", backgroundColor: "#f6f6f6", padding: "15px", borderLeft: "2px solid #ccc", borderRadius: "8px" } });

    // Move all content between entryInputDiv and description into #product-main
    const $entryDiv = $("#ctl00_PageBody_productDetail_entryInputDiv");
    const $insertPoint = $entryDiv.nextUntil("#ctl00_PageBody_productDetail_productDescription");

    $mainContent.append($insertPoint);

    // Also move productDescription into main content
    $mainContent.append($("#ctl00_PageBody_productDetail_productDescription"));

    // Move any known widgets to sidebar if already on page
    widgetSelectors.forEach(selector => {
      const $widget = $(selector);
      if ($widget.length) {
        $sidebar.append($widget);
      }
    });

    // Build final layout
    $pageWrapper.append($mainContent, $sidebar);

    // Inject layout after entryInputDiv
    $entryDiv.after($pageWrapper);
  }
});
