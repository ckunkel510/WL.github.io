$(document).ready(function () {
  if ($("#product-page").length) return;

  const $insertionPoint = $(".bodyFlexItem.d-flex").first();
  if (!$insertionPoint.length) return;

  // =========================
  // Online-purchase blocking
  // =========================
  // ✅ Add ProductIDs that are NOT eligible for online purchase
  const BLOCKED_PIDS = [3158
    // 3158,
  ].map(String);

  // Current product id (first pid= in the URL)
  const currentPID = new URLSearchParams(window.location.search).get("pid");
  const isBlockedProduct = currentPID && BLOCKED_PIDS.includes(String(currentPID));

  const NOT_ELIGIBLE_MSG = "This item is not eligible for online purchase.";

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

    // === Share Button ===
    const productID = new URLSearchParams(window.location.search).get("pid");
    console.log("[ShareButton] Extracted productID from URL:", productID);

    if (productID) {
      const webtrackURL = `${window.location.origin}/ProductDetail.aspx?pid=${productID}`;
      const redirectURL = `https://wlmarketingdashboard.vercel.app/product/${productID}?utm_source=share&utm_medium=button&utm_campaign=product_share`;

      console.log("[ShareButton] WebTrack URL:", webtrackURL);
      console.log("[ShareButton] Redirect URL:", redirectURL);

      const $shareBtn = $("<button>", { id: "share-product-button" })
        .html(`
          <svg width="20" height="20" viewBox="0 0 20 20" fill="white" xmlns="http://www.w3.org/2000/svg" aria-label="Share" class="icon">
            <path d="M2.66821 12.6663V12.5003C2.66821 12.1331 2.96598 11.8353 3.33325 11.8353C3.70052 11.8353 3.99829 12.1331 3.99829 12.5003V12.6663C3.99829 13.3772 3.9992 13.8707 4.03052 14.2542C4.0612 14.6298 4.11803 14.8413 4.19849 14.9993L4.2688 15.1263C4.44511 15.4137 4.69813 15.6481 5.00024 15.8021L5.13013 15.8577C5.2739 15.9092 5.46341 15.947 5.74536 15.97C6.12888 16.0014 6.62221 16.0013 7.33325 16.0013H12.6663C13.3771 16.0013 13.8707 16.0014 14.2542 15.97C14.6295 15.9394 14.8413 15.8825 14.9993 15.8021L15.1262 15.7308C15.4136 15.5545 15.6481 15.3014 15.802 14.9993L15.8577 14.8695C15.9091 14.7257 15.9469 14.536 15.97 14.2542C16.0013 13.8707 16.0012 13.3772 16.0012 12.6663V12.5003C16.0012 12.1332 16.2991 11.8355 16.6663 11.8353C17.0335 11.8353 17.3313 12.1331 17.3313 12.5003V12.6663C17.3313 13.3553 17.3319 13.9124 17.2952 14.3626C17.2624 14.7636 17.1974 15.1247 17.053 15.4613L16.9866 15.6038C16.7211 16.1248 16.3172 16.5605 15.8215 16.8646L15.6038 16.9866C15.227 17.1786 14.8206 17.2578 14.3625 17.2952C13.9123 17.332 13.3553 17.3314 12.6663 17.3314H7.33325C6.64416 17.3314 6.0872 17.332 5.63696 17.2952C5.23642 17.2625 4.87552 17.1982 4.53931 17.054L4.39673 16.9866C3.87561 16.7211 3.43911 16.3174 3.13501 15.8216L3.01294 15.6038C2.82097 15.2271 2.74177 14.8206 2.70435 14.3626C2.66758 13.9124 2.66821 13.3553 2.66821 12.6663ZM9.33521 12.5003V4.9388L7.13696 7.13704C6.87732 7.39668 6.45625 7.39657 6.19653 7.13704C5.93684 6.87734 5.93684 6.45631 6.19653 6.19661L9.52954 2.86263L9.6311 2.77962C9.73949 2.70742 9.86809 2.66829 10.0002 2.66829C10.1763 2.66838 10.3454 2.73819 10.47 2.86263L13.804 6.19661C14.0633 6.45628 14.0634 6.87744 13.804 7.13704C13.5443 7.39674 13.1222 7.39674 12.8625 7.13704L10.6653 4.93977V12.5003C10.6651 12.8673 10.3673 13.1652 10.0002 13.1654C9.63308 13.1654 9.33538 12.8674 9.33521 12.5003Z"/>
          </svg>
        `)
        .css({
          width: "40px",
          height: "40px",
          backgroundColor: "#6b0016",
          color: "white",
          border: "none",
          borderRadius: "50%",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "10px auto 0",
        })
        .attr("title", "Share This Product")
        .on("click", () => {
          if (navigator.share) {
            navigator
              .share({
                title: document.title,
                url: redirectURL,
              })
              .then(() => {
                logShareEvent("native");
              })
              .catch(console.error);
          } else {
            navigator.clipboard.writeText(webtrackURL).then(() => {
              alert("Link copied to clipboard!");
              logShareEvent("copy");
            });
          }
        });

      function logShareEvent(method) {
        console.log("[ShareButton] Logging GA4 event:", method);
        if (window.dataLayer) {
          dataLayer.push({
            event: "share_product",
            method,
            product_id: productID,
            share_url: redirectURL,
          });
        }
      }

      if ($imageTd && $imageTd.length) {
        console.log("[ShareButton] Appending share button to imageTd");
        $imageTd.append($shareBtn);
      } else {
        console.warn("[ShareButton] $imageTd not available; share button not appended");
      }
    }
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

  // Tighten input styling (if we end up using it)
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
  $addBtn
    .find("a")
    .css({
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
    })
    .hover(
      function () {
        $(this).css("backgroundColor", "#8d8d8d");
      },
      function () {
        $(this).css("backgroundColor", "#6b0016");
      }
    );

  // =========================
  // Delivery / pickup selector
  // =========================
  const selectedMethodKey = "woodson_cart_method";

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

  // Banner: “Schedule delivery in checkout.”
  const $banner = $("<div>")
    .addClass("wl-delivery-banner")
    .css({
      display: "flex",
      alignItems: "center",
      gap: "10px",
      marginTop: "10px",
      fontSize: "14px",
    })
    .html(`🚚 <strong>Schedule delivery in checkout.</strong>`);

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

  // Hook into Add to Cart (if present) to store method
  $addBtn.on("click", () => {
    const selected = $(".method-box.selected").text().includes("Pickup") ? "pickup" : "delivery";
    localStorage.setItem(selectedMethodKey, selected);
  });

  // =========================
  // Blocked item UI handling
  // =========================
  const $notEligible = $("<div>")
    .addClass("wl-not-eligible")
    .css({
      padding: "10px 12px",
      border: "1px solid #e1e1e1",
      borderLeft: "4px solid #6b0016",
      borderRadius: "8px",
      background: "#fff7f8",
      color: "#6b0016",
      fontWeight: "800",
      textAlign: "center",
      fontSize: "0.95em",
      lineHeight: "1.2",
    })
    .text(NOT_ELIGIBLE_MSG);

  if (isBlockedProduct) {
    // Force pickup preference for these items (and hide delivery UI)
    localStorage.setItem(selectedMethodKey, "pickup");

    // Only show pickup selector (optional: still clickable, but only one option)
    $methodRow.append($pickupBtn);

    // Don't show qty/add controls at all
    // (We already detached them from the page; we simply don't add them back.)
    // But keep quicklist + stock if you want the “in-store tools” still available.
    $buyBox.empty().append($methodRow, $priceRow, $notEligible, $quicklistBtn.css("marginTop", "10px"), $stockBtn);

  } else {
    // Normal purchase flow
    $methodRow.append($pickupBtn, $deliveryBtn);

    // Assemble actions
    $actionRow.append($qtyInput, $addBtn);

    // Final assembly
    $buyBox.empty().append($methodRow, $banner, $priceRow, $actionRow, $quicklistBtn.css("marginTop", "10px"), $stockBtn);
  }

  $sidebar.append($buyBox);

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
  const $shippingLink = $("<div>")
    .css({
      marginTop: "20px",
      textAlign: "center",
    })
    .append(
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
