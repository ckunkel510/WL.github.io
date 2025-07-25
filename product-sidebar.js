$(document).ready(function () {
  if ($("#product-page").length) return;

  const $insertionPoint = $(".bodyFlexItem.d-flex").first();
  if (!$insertionPoint.length) return;

  // Layout wrappers
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
  const $mainBlock = $("<div>", { id: "main-block" }).css({
  display: "flex",
  flexDirection: "column",
  gap: "20px",
  flex: "1 1 auto",
});


  // Buy box container
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

  // Move product image to main
  const $imageTd = $("#ctl00_PageBody_productDetail_ProductImage").first().closest("td");
  if ($imageTd.length) {
  const $imageWrap = $("<div>", { id: "product-image-wrapper" }).css({
    order: 1,
  });
  $imageWrap.append($imageTd);
  
}


  // Move elements into sidebar (first instances only)
  const $price = $(".productPriceSegment").first().detach();
  const $unit = $(".productPerSegment").first().detach();
  const $qtyInput = $(".productQtySegment").first().detach();
  const $addBtn = $("#ctl00_PageBody_productDetail_ctl00_AddProductButton").first().closest("div.mb-1").detach();
  const $quicklistBtn = $("#ctl00_PageBody_productDetail_ctl00_QuickList_QuickListLink").first().closest("div.mb-1").detach();
  const $stockBtn = $("#ctl00_PageBody_productDetail_ctl00_btnShowStock").first().closest("div").detach();

  // Build buy box
  // === Build price + uom row ===
const $priceRow = $("<div>").css({
  display: "flex",
  justifyContent: "flex-end",
  fontSize: "20px",
  fontWeight: "bold",
  color: "#333",
});

if ($price.length && $unit.length) {
  $priceRow.append(
    $("<span>").text($price.text().trim()),
    $("<span>").text(" / " + $unit.text().trim()).css({
      marginLeft: "5px",
      fontSize: "16px",
      color: "#777",
    })
  );
}

// === Quantity + Add to Cart in one row ===
const $actionRow = $("<div>").css({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
});

// Tighten input styling
$qtyInput.find("input").css({
  width: "60px",
  height: "36px",
  padding: "6px",
  fontSize: "16px",
  textAlign: "center",
  border: "1px solid #ccc",
  borderRadius: "4px",
});

// Stylize "Add to Cart" with cart icon
const $cartIcon = $("<span>").html("🛒").css({
  marginRight: "6px",
});
$addBtn.find("span").html("").append($cartIcon).append("Add to Cart");
$addBtn.find("a").css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 16px",
  fontSize: "16px",
  fontWeight: "bold",
  backgroundColor: "#6b0016",
  color: "#fff",
  border: "none",
  borderRadius: "4px",
  textDecoration: "none",
  transition: "background 0.2s",
}).hover(
  function () {
    $(this).css("backgroundColor", "#8d8d8d");
  },
  function () {
    $(this).css("backgroundColor", "#6b0016");
  }
);

// Assemble actions
$actionRow.append($qtyInput, $addBtn);

// === Final assembly ===
$buyBox.empty().append(
  $priceRow,
  $actionRow,
  $quicklistBtn.css("marginTop", "10px"),
  $stockBtn
);

  $sidebar.append($buyBox);
  // === Delivery Option Selector ===
const selectedMethodKey = "woodson_cart_method";

// Containers
const $pickupBtn = $("<div>")
  .addClass("method-box selected")
  .css({
    flex: "1",
    border: "2px solid #6b0016",
    borderRadius: "8px",
    padding: "10px",
    cursor: "pointer",
    textAlign: "center",
    backgroundColor: "#fff",
  })
  .html(`<strong>Pickup</strong><br><span class="pickup-info"></span><br><span style="color:green;font-weight:bold;">FREE</span>`);

const $deliveryBtn = $("<div>")
  .addClass("method-box")
  .css({
    flex: "1",
    border: "1px solid #ccc",
    borderRadius: "8px",
    padding: "10px",
    cursor: "pointer",
    textAlign: "center",
    backgroundColor: "#fff",
  })
  .html(`<strong>Delivery</strong><br><span class="delivery-info">Shipping Available</span>`);

const $methodRow = $("<div>").css({
  display: "flex",
  gap: "10px",
  marginBottom: "10px",
});
$methodRow.append($pickupBtn, $deliveryBtn);

// === Truck Banner ===
const $banner = $("<div>")
  .css({
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginTop: "10px",
    fontSize: "14px",
  })
  .html(`🚚 <strong>Schedule delivery in checkout.</strong>`);

// === Handle Selection + Cache ===
function selectMethod(method) {
  if (method === "pickup") {
    $pickupBtn.addClass("selected").css("border", "2px solid #6b0016");
    $deliveryBtn.removeClass("selected").css("border", "1px solid #ccc");
  } else {
    $deliveryBtn.addClass("selected").css("border", "2px solid #6b0016");
    $pickupBtn.removeClass("selected").css("border", "1px solid #ccc");
  }
  localStorage.setItem(selectedMethodKey, method);
}
$pickupBtn.on("click", () => selectMethod("pickup"));
$deliveryBtn.on("click", () => selectMethod("delivery"));

// === Hook into Add to Cart
$addBtn.on("click", () => {
  const selected = $(".method-box.selected").text().includes("Pickup") ? "pickup" : "delivery";
  localStorage.setItem(selectedMethodKey, selected);
});

// === Inject into UI
$buyBox.prepend($methodRow, $banner);


  // Product description and reviews into main
  const $description = $("#ctl00_PageBody_productDetail_productDescription").first().detach();
  const $reviews = $("#review-widget").first().detach();
  const $reviewButton = $("#review-product-button").first().detach();

  $main.append($description, $reviews, $reviewButton);

  // Watch for and pull in widgets
  function tryMoveWidget(selector) {
    const $el = $(selector).first();
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
  if ($imageTd.length) {
  const $imageWrap = $("<div>", { id: "product-image-wrapper" });
  $imageWrap.append($imageTd);

  if (window.innerWidth > 1024) {
    $mainBlock.append($imageWrap, $main);
    $pageWrapper.append($mainBlock, $sidebar);
  } else {
    // Mobile layout: image first, then sidebar, then description
    $pageWrapper.append($imageWrap, $sidebar, $main);
  }
}

  $insertionPoint.after($pageWrapper);
  // === Add Shipping Policy Link ===
const $shippingLink = $("<div>").css({
  marginTop: "20px",
  textAlign: "center",
}).append(
  $("<a>", {
    href: "https://www.woodsonlumber.com/shipping-policy",
    target: "_blank",
    text: "View our Shipping Policy",
  }).css({
    color: "#6b0016",
    fontSize: "14px",
    textDecoration: "underline",
  })
);

$sidebar.append($shippingLink);

});
