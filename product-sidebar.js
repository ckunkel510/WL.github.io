$(document).ready(async function () {
  if ($("#product-page").length) return;

  const $insertionPoint = $(".bodyFlexItem.d-flex").first();
  if (!$insertionPoint.length) return;

  function injectProductDetailStyles() {
    if (document.getElementById("wl-product-detail-modern-css")) return;
    const style = document.createElement("style");
    style.id = "wl-product-detail-modern-css";
    style.textContent = `
      .wl-pdp-heading {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) minmax(320px, 0.9fr);
        align-items: center !important;
        gap: 8px 20px;
        width: 100%;
        margin: 20px 0 16px;
      }
      #wl-product-title {
        grid-column: 1 / -1;
        margin: 0;
        color: #20262d;
        font-size: 34px;
        font-weight: 850;
        line-height: 1.15;
      }
      .wl-pdp-heading .formPageHeader {
        min-width: 0;
        color: #59636e;
        font-size: 14px;
        font-weight: 750;
        white-space: normal;
      }
      .wl-pdp-heading .wl-quote-product {
        grid-column: 2;
        grid-row: 2;
        width: 100%;
        margin: 0 !important;
      }
      #product-page {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) minmax(290px, 330px);
        align-items: start !important;
        gap: 24px !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 0 24px;
      }
      #product-image-wrapper {
        grid-column: 1;
        grid-row: 1;
        min-width: 0;
        width: 100% !important;
        margin: 0 !important;
      }
      #product-image-wrapper > td,
      #product-image-wrapper td {
        display: block;
        width: 100% !important;
        max-width: 100% !important;
        padding: 0 !important;
      }
      #product-image-wrapper .image-with-flags {
        display: flex !important;
        flex-direction: column;
        align-items: center;
        width: 100% !important;
      }
      #ctl00_PageBody_productDetail_ProductImage {
        display: block;
        width: auto !important;
        height: auto !important;
        max-width: min(100%, 620px) !important;
        max-height: 560px !important;
        margin: 0 auto;
        object-fit: contain;
      }
      .wl-product-thumbnails {
        display: flex !important;
        flex-wrap: wrap;
        justify-content: center;
        gap: 10px !important;
        width: 100%;
        margin: 14px 0 0 !important;
      }
      .wl-product-thumbnail {
        display: grid !important;
        place-items: center;
        width: 64px;
        height: 64px;
        padding: 5px !important;
        border: 1px solid #cbd0d5 !important;
        border-radius: 6px !important;
        background: #fff;
      }
      .wl-product-thumbnail img { width: 100% !important; height: 100% !important; object-fit: contain; }
      #product-sidebar {
        grid-column: 2;
        grid-row: 1;
        min-width: 0 !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 16px !important;
        border: 1px solid #d9dde1 !important;
        border-radius: 6px !important;
        background: #f7f8f9 !important;
        box-shadow: none !important;
      }
      #product-sidebar .buy-box {
        gap: 12px !important;
        margin: 0 !important;
        padding: 14px !important;
        border: 1px solid #d9dde1 !important;
        border-radius: 6px !important;
        box-shadow: 0 4px 12px rgba(25, 31, 38, .06);
      }
      .wl-pdp-method-row { gap: 8px !important; }
      .wl-pdp-method-row .method-box {
        min-width: 0;
        padding: 10px 8px !important;
        border-radius: 6px !important;
      }
      .wl-product-price-row {
        justify-content: flex-start !important;
        align-items: baseline;
        margin-top: 2px;
        color: #20262d !important;
        font-size: 30px !important;
        line-height: 1;
      }
      .wl-product-price-row .wl-product-unit { font-size: 15px !important; }
      .wl-pdp-action-row {
        display: grid !important;
        grid-template-columns: auto minmax(0, 1fr);
        align-items: stretch !important;
        gap: 10px !important;
      }
      .wl-pdp-action-row > * { min-width: 0; margin: 0 !important; }
      .wl-pdp-action-row a { min-height: 42px; border-radius: 5px !important; }
      #product-main {
        grid-column: 1 / -1;
        grid-row: 2;
        min-width: 0 !important;
        width: 100% !important;
        margin: 0 !important;
      }
      #product-main > * { max-width: 100%; }
      #WTRelatedProducts {
        width: 100% !important;
        max-width: 100% !important;
        margin: 32px 0 0 !important;
        overflow: hidden;
        border-top: 3px solid #6b0016;
        box-shadow: none !important;
      }
      #WTRelatedProducts > table,
      #WTRelatedProducts > table > tbody,
      #WTRelatedProducts > table > tbody > tr,
      #WTRelatedProducts > table > tbody > tr > td {
        display: block;
        width: 100% !important;
        max-width: 100% !important;
      }
      #WTRelatedProducts > table > tbody > tr:first-child > td {
        padding: 18px 0 12px !important;
        color: #20262d;
        font-size: 24px;
        font-weight: 850;
      }
      #WTRelatedProducts .wl-related-grid {
        display: grid !important;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        padding: 2px 0 14px;
      }
      #WTRelatedProducts .wl-related-card {
        display: block !important;
        width: auto !important;
        max-width: none !important;
        min-width: 0 !important;
        padding: 12px !important;
        border: 1px solid #d9dde1;
        border-radius: 6px;
        background: #fff;
        overflow: hidden;
      }
      #WTRelatedProducts .wl-related-card table { width: 100% !important; max-width: 100% !important; }
      #WTRelatedProducts .wl-related-card img {
        display: block;
        width: 100% !important;
        height: 150px !important;
        margin: 0 auto 10px;
        object-fit: contain;
      }
      #WTRelatedProducts .wl-related-card a[href*="ProductDetail"] {
        color: #20262d;
        font-weight: 750;
        line-height: 1.3;
      }
      #WTRelatedProducts .wl-related-card input[type="text"] { max-width: 64px; }
      #WTRelatedProducts .wl-related-card a[id*="AddProductButton"] {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 38px;
        padding: 8px 12px;
        border-radius: 5px;
        background: #6b0016;
        color: #fff !important;
        text-decoration: none;
      }
      @media (max-width: 1050px) {
        .wl-pdp-heading { grid-template-columns: 1fr; }
        .wl-pdp-heading .wl-quote-product { grid-column: 1; grid-row: auto; }
        #product-page { grid-template-columns: minmax(0, 1fr) 300px; gap: 18px !important; }
        #WTRelatedProducts .wl-related-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 767px) {
        .wl-pdp-heading { margin-top: 14px; gap: 8px; }
        #wl-product-title { font-size: 24px; }
        .wl-pdp-heading .wl-quote-product { padding: 12px !important; }
        #product-page { grid-template-columns: minmax(0, 1fr); gap: 16px !important; }
        #product-image-wrapper { grid-column: 1; grid-row: 1; }
        #product-sidebar { grid-column: 1; grid-row: 2; padding: 12px !important; }
        #product-main { grid-column: 1; grid-row: 3; }
        #ctl00_PageBody_productDetail_ProductImage { max-height: 420px !important; }
        .wl-product-price-row { font-size: 28px !important; }
        #WTRelatedProducts { overflow: visible; }
        #WTRelatedProducts .relatedProductsScrollingDiv {
          width: calc(100vw - 36px) !important;
          min-width: 0 !important;
          max-width: calc(100vw - 36px) !important;
          overflow: hidden !important;
        }
        #WTRelatedProducts .wl-related-grid {
          display: flex !important;
          gap: 12px;
          width: calc(100vw - 36px) !important;
          min-width: 0 !important;
          max-width: calc(100vw - 36px) !important;
          overflow-x: auto;
          overflow-y: hidden;
          overscroll-behavior-inline: contain;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          padding: 2px 2px 16px;
        }
        #WTRelatedProducts .wl-related-card {
          flex: 0 0 min(78vw, 290px) !important;
          scroll-snap-align: start;
        }
      }
      @supports (-webkit-touch-callout: none) {
        #product-page, #product-image-wrapper, #product-sidebar, #product-main { min-width: 0 !important; }
        .wl-product-thumbnails { width: 100% !important; }
      }
    `;
    document.head.appendChild(style);
  }

  injectProductDetailStyles();

  const productTitle = $(".productDescriptionOnThisPageFull").first().text().trim().replace(/^\*+\s*/, "");
  $insertionPoint.addClass("wl-pdp-heading");
  if (productTitle && !$("#wl-product-title").length) {
    $("<h1>", { id: "wl-product-title", text: productTitle }).prependTo($insertionPoint);
  }

  
  // =========================
  // Online-purchase blocking (GitHub JSON)
  // =========================
  // TODO: Set this to your GitHub RAW URL for blocked-products.json
  // Example:
  // https://raw.githubusercontent.com/<USER>/<REPO>/<BRANCH>/path/blocked-products.json
  const WL_BLOCKLIST_URL = "https://ckunkel510.github.io/WL.github.io/blocked-products.json";

  async function wlLoadBlocklist() {
    const fallback = {
      blockedProductIds: [3158], // fallback so behavior stays active if JSON can't load
      message: "This item is not eligible for online purchase."
    };

    try {
      if (!WL_BLOCKLIST_URL || WL_BLOCKLIST_URL.startsWith("REPLACE_WITH_")) return fallback;

      const url = WL_BLOCKLIST_URL + (WL_BLOCKLIST_URL.includes("?") ? "&" : "?") + "v=" + Date.now();
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return fallback;

      const json = await res.json();
      const ids = (json.blockedProductIds || json.blockedProductIDs || json.blockedProductIdList || []).map(String);
      return { blockedProductIds: ids, message: (json.message || fallback.message) };
    } catch (e) {
      return fallback;
    }
  }

  const cfg = await wlLoadBlocklist();
  const BLOCKED_PIDS = (cfg.blockedProductIds || []).map(String);
  const NOT_ELIGIBLE_MSG = cfg.message || "This item is not eligible for online purchase.";

  // Current product id (first pid= in the URL)
  const currentPID = new URLSearchParams(window.location.search).get("pid");
  const isBlockedProduct = currentPID && BLOCKED_PIDS.includes(String(currentPID));

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

  // Buy box container
  const $buyBox = $("<div>").addClass("buy-box wl-pdp-buybox").css({
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
  const $priceRow = $("<div>").addClass("wl-product-price-row").css({
    display: "flex",
    justifyContent: "flex-end",
    fontSize: "20px",
    fontWeight: "bold",
    color: "#333",
  });

  if ($price.length) {
    $priceRow.append($("<span>").text($price.text().trim()));
    if ($unit.length) {
      $priceRow.append(
        $("<span>").addClass("wl-product-unit").text(" / " + $unit.text().trim()).css({
          marginLeft: "5px",
          fontSize: "16px",
          color: "#777",
        })
      );
    }
  }

  // === Quantity + Add to Cart in one row ===
  const $actionRow = $("<div>").addClass("wl-pdp-action-row").css({
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

  const $methodRow = $("<div>").addClass("wl-pdp-method-row").css({
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

  // Inject a stable layout at every viewport. CSS controls the responsive order,
  // so rotating a tablet or resizing a browser cannot strand content in the old tree.
  if ($imageTd.length) {
    const $imageWrap = $("<div>", { id: "product-image-wrapper" });
    $imageWrap.append($imageTd);
    $pageWrapper.append($imageWrap, $sidebar, $main);
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

  function modernizeRelatedProducts() {
    const root = document.getElementById("WTRelatedProducts");
    if (!root || root.dataset.wlModernized === "1") return false;
    const scroller = root.querySelector(".relatedProductsScrollingDiv");
    if (!scroller) return false;

    const cards = Array.from(scroller.querySelectorAll(".col-12.col-sm-6.col-lg-3"));
    if (!cards.length) return false;

    const grid = document.createElement("div");
    grid.className = "wl-related-grid";
    cards.forEach((card) => {
      card.classList.add("wl-related-card");
      grid.appendChild(card);
    });
    scroller.replaceChildren(grid);
    root.dataset.wlModernized = "1";
    return true;
  }

  if (!modernizeRelatedProducts()) {
    let relatedAttempts = 0;
    const relatedTimer = setInterval(() => {
      relatedAttempts += 1;
      if (modernizeRelatedProducts() || relatedAttempts >= 24) clearInterval(relatedTimer);
    }, 250);
  }
});
