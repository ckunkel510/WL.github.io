// Hide login-gated prices before the page is rearranged to prevent a price flash.
(function wlPrehideLoginGatedPrice() {
  try {
    const productId = new URLSearchParams(window.location.search).get("pid");
    if (productId !== "6821" || document.getElementById("wl-login-price-prehide")) return;

    const style = document.createElement("style");
    style.id = "wl-login-price-prehide";
    style.textContent = ".productPriceSegment,.productPerSegment{visibility:hidden!important;}";
    (document.head || document.documentElement).appendChild(style);
  } catch (e) {}
})();

// Assign every enhanced ProductDetail visit to a stable analytics variant before
// the shared analytics runtime emits view_item.
(function wlPrimePdpExperimentContext() {
  try {
    if (!/ProductDetail\.aspx/i.test(window.location.pathname || "")) return;
    const savedMethod = localStorage.getItem("woodson_cart_method");
    sessionStorage.setItem("wl_analytics_experiment_v1", JSON.stringify({
      experiment_id: "pdp_fulfillment_v1_20260909",
      experiment_variant: "similar_products_v1",
      fulfillment_method: savedMethod === "delivery" ? "delivery" : "pickup"
    }));
  } catch (error) {}
})();

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
      #product-page.wl-has-product-options {
        grid-template-columns: minmax(0, 1fr) minmax(220px, 280px) minmax(290px, 330px);
        gap: 20px !important;
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
      #product-options-column {
        display: none;
        grid-column: 2;
        grid-row: 1;
        min-width: 0;
        width: 100%;
      }
      #product-page.wl-has-product-options #product-options-column {
        display: block;
      }
      #product-page.wl-has-product-options #product-sidebar {
        grid-column: 3;
      }
      #productoption.wl-product-options {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 16px !important;
        border: 1px solid #d9dde1;
        border-radius: 6px;
        background: #fff;
        box-sizing: border-box;
      }
      #productoption .wl-product-options-title {
        margin: 0 0 12px;
        color: #20262d;
        font-size: 18px;
        font-weight: 850;
        line-height: 1.2;
      }
      #productoption .wl-product-option-group {
        display: grid;
        gap: 8px;
      }
      #productoption .wl-product-option-group + .wl-product-option-group {
        margin-top: 14px;
        padding-top: 14px;
        border-top: 1px solid #e3e6e9;
      }
      #productoption .wl-product-option-group h4 {
        margin: 0;
        color: #3f4852;
        font-size: 13px;
        font-weight: 800;
        line-height: 1.25;
      }
      #productoption .wl-product-option-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      #productoption .wl-product-option-chip,
      #productoption .wl-product-option-image {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 44px;
        min-height: 38px;
        padding: 8px 10px;
        border: 1px solid #aeb5bd;
        border-radius: 5px;
        background: #fff;
        color: #20262d !important;
        font: inherit;
        font-size: 13px;
        font-weight: 750;
        line-height: 1.15;
        text-align: center;
        text-decoration: none !important;
        cursor: pointer;
        box-sizing: border-box;
      }
      #productoption .wl-product-option-chip:hover,
      #productoption .wl-product-option-chip:focus,
      #productoption .wl-product-option-image:hover,
      #productoption .wl-product-option-image:focus {
        border-color: #6b0016;
        box-shadow: 0 0 0 2px rgba(107, 0, 22, .14);
        outline: none;
      }
      #productoption [aria-current="true"] {
        border-color: #6b0016;
        background: #fff7f8;
        color: #6b0016 !important;
        box-shadow: inset 0 0 0 1px #6b0016;
      }
      #productoption .wl-product-option-image {
        width: 62px;
        height: 62px;
        padding: 5px;
      }
      #productoption .wl-product-option-image img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
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
      .wl-epallet-product-note {
        padding: 12px 13px;
        border: 1px solid #d9dde1;
        border-left: 5px solid #6b0016;
        border-radius: 6px;
        background: #fff;
        color: #25282c;
        font-size: 13px;
        line-height: 1.4;
      }
      .wl-epallet-product-note strong {
        display: block;
        margin-bottom: 4px;
        color: #20242a;
        font-size: 14px;
      }
      .wl-epallet-product-note ul {
        margin: 7px 0 0 18px;
        padding: 0;
      }
      .wl-epallet-product-note li { margin: 3px 0; }
      .wl-pdp-method-row {
        align-items: stretch;
        gap: 8px !important;
      }
      .wl-pdp-method-row .method-box {
        display: flex !important;
        flex: 1 1 0;
        flex-direction: column;
        align-items: flex-start;
        min-width: 0;
        min-height: 112px;
        padding: 10px !important;
        border-radius: 6px !important;
        color: #20262d;
        font: inherit;
        line-height: 1.25;
        text-align: left !important;
      }
      .wl-pdp-method-row .method-box.selected {
        background: #fff7f8 !important;
        box-shadow: inset 0 0 0 1px #6b0016;
      }
      .wl-pdp-method-row .method-box:focus-visible {
        outline: 3px solid rgba(107, 0, 22, .25);
        outline-offset: 2px;
      }
      .wl-pdp-method-row .method-box:disabled {
        cursor: not-allowed !important;
        opacity: .55;
      }
      .wl-method-label {
        display: block;
        color: #20262d;
        font-size: 15px;
        font-weight: 850;
      }
      .wl-method-promise {
        display: block;
        margin-top: 5px;
        color: #6b0016;
        font-size: 13px;
        font-weight: 800;
      }
      .wl-method-meta {
        display: block;
        margin-top: 3px;
        color: #59636e;
        font-size: 12px;
        line-height: 1.3;
      }
      .wl-method-cost {
        display: block;
        margin-top: auto;
        padding-top: 7px;
        color: #14713b;
        font-size: 12px;
        font-weight: 850;
      }
      .wl-method-cost.wl-method-rate { color: #3f4852; }
      .wl-fulfillment-detail {
        display: grid;
        gap: 4px;
        margin-top: -2px;
        padding: 10px 11px;
        border: 1px solid #d9dde1;
        border-left: 4px solid #6b0016;
        border-radius: 6px;
        background: #fff;
        color: #20262d;
      }
      .wl-fulfillment-detail-title {
        font-size: 13px;
        font-weight: 850;
      }
      .wl-fulfillment-detail-copy,
      .wl-fulfillment-detail-extra {
        color: #59636e;
        font-size: 12px;
        line-height: 1.35;
      }
      .wl-fulfillment-detail-extra strong { color: #20262d; }
      .wl-fulfillment-store-action {
        justify-self: start;
        margin-top: 3px;
        padding: 0;
        border: 0;
        background: transparent;
        color: #6b0016;
        font-size: 12px;
        font-weight: 800;
        text-decoration: underline;
        cursor: pointer;
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
      .wl-price-login-gate {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 5px;
        padding: 14px;
        border: 1px solid #d9dde1;
        border-left: 5px solid #6b0016;
        border-radius: 6px;
        background: #fff7f8;
        color: #20262d;
      }
      .wl-price-login-gate strong { color: #6b0016; font-size: 18px; }
      .wl-price-login-gate span { color: #59636e; font-size: 13px; line-height: 1.35; }
      .wl-price-login-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 38px;
        margin-top: 3px;
        padding: 8px 14px;
        border-radius: 5px;
        background: #6b0016;
        color: #fff !important;
        font-weight: 800;
        text-decoration: none !important;
      }
      .wl-price-login-link:hover,
      .wl-price-login-link:focus { background: #8d8d8d; }
      .wl-pdp-action-row {
        display: flex !important;
        align-items: stretch !important;
        flex-wrap: wrap !important;
        gap: 10px !important;
        width: 100%;
      }
      .wl-pdp-action-row > .productQtySegment {
        display: flex !important;
        flex: 0 0 auto !important;
        align-items: center;
        width: auto !important;
        max-width: none !important;
        min-width: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .wl-pdp-action-row > .mb-1 {
        flex: 1 1 120px !important;
        width: auto !important;
        min-width: 120px !important;
        margin: 0 !important;
      }
      .wl-pdp-action-row > .mb-1 > a {
        display: flex !important;
        width: 100% !important;
        min-height: 42px;
        padding: 8px 10px !important;
        border-radius: 5px !important;
        white-space: nowrap;
      }
      #product-main {
        grid-column: 1 / -1;
        grid-row: 2;
        min-width: 0 !important;
        width: 100% !important;
        margin: 0 !important;
      }
      #product-main > * { max-width: 100%; }
      #pdp-complete-project-slot:empty,
      #pdp-similar-products-slot:empty { display: none; }
      .wl-pdp-recommendations {
        width: 100%;
        margin: 32px 0 0;
        padding: 24px 0 0;
        border-top: 3px solid #6b0016;
        box-sizing: border-box;
      }
      .wl-pdp-recommendations__header {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 16px;
      }
      .wl-pdp-recommendations__eyebrow {
        margin: 0 0 4px;
        color: #6b0016;
        font-size: 12px;
        font-weight: 850;
        letter-spacing: .06em;
        text-transform: uppercase;
      }
      .wl-pdp-recommendations__title {
        margin: 0;
        color: #20262d;
        font-size: 24px;
        font-weight: 850;
        line-height: 1.2;
      }
      .wl-pdp-recommendations__copy {
        margin: 5px 0 0;
        color: #59636e;
        font-size: 14px;
        line-height: 1.4;
      }
      .wl-pdp-recommendations__controls {
        display: flex;
        flex: 0 0 auto;
        gap: 8px;
      }
      .wl-pdp-recommendations__control {
        display: inline-grid;
        place-items: center;
        width: 40px;
        height: 40px;
        padding: 0;
        border: 1px solid #aeb5bd;
        border-radius: 50%;
        background: #fff;
        color: #20262d;
        font-size: 23px;
        line-height: 1;
        cursor: pointer;
      }
      .wl-pdp-recommendations__control:hover,
      .wl-pdp-recommendations__control:focus-visible {
        border-color: #6b0016;
        color: #6b0016;
        outline: 3px solid rgba(107, 0, 22, .14);
        outline-offset: 1px;
      }
      .wl-pdp-recommendations__rail {
        display: flex;
        gap: 14px;
        width: 100%;
        max-width: 100%;
        padding: 2px 2px 16px;
        overflow-x: auto;
        overflow-y: hidden;
        overscroll-behavior-inline: contain;
        scroll-behavior: smooth;
        scroll-snap-type: x mandatory;
        scrollbar-width: thin;
        box-sizing: border-box;
      }
      .wl-pdp-recommendation-card {
        display: flex;
        flex: 0 0 calc((100% - 42px) / 4);
        flex-direction: column;
        min-width: 0;
        min-height: 340px;
        padding: 14px;
        border: 1px solid #d9dde1;
        border-radius: 8px;
        background: #fff;
        color: #20262d !important;
        scroll-snap-align: start;
        text-decoration: none !important;
        box-sizing: border-box;
      }
      .wl-pdp-recommendation-card:hover,
      .wl-pdp-recommendation-card:focus-visible {
        border-color: #6b0016;
        box-shadow: 0 6px 18px rgba(25, 31, 38, .11);
        outline: none;
        transform: translateY(-1px);
      }
      .wl-pdp-recommendation-card__image {
        display: block;
        width: 100%;
        height: 170px;
        margin: 0 0 12px;
        object-fit: contain;
      }
      .wl-pdp-recommendation-card__brand,
      .wl-pdp-recommendation-card__category {
        color: #59636e;
        font-size: 12px;
        font-weight: 750;
        line-height: 1.3;
      }
      .wl-pdp-recommendation-card__title {
        display: -webkit-box;
        margin: 7px 0 12px;
        overflow: hidden;
        color: #20262d;
        font-size: 15px;
        font-weight: 800;
        line-height: 1.35;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
      }
      .wl-pdp-recommendation-card__status {
        margin-top: auto;
        color: #14713b;
        font-size: 12px;
        font-weight: 850;
      }
      .wl-pdp-recommendation-card__cta {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 40px;
        margin-top: 10px;
        padding: 8px 10px;
        border-radius: 5px;
        background: #6b0016;
        color: #fff;
        font-size: 13px;
        font-weight: 850;
        text-align: center;
      }
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
        margin: 0 !important;
        padding: 12px !important;
        border: 1px solid #d9dde1;
        border-radius: 6px;
        background: #fff;
        overflow: hidden;
      }
      #WTRelatedProducts .wl-related-card > [class*="col-"] {
        display: block !important;
        flex: none !important;
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        padding: 0 !important;
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
        #product-page,
        #product-page.wl-has-product-options {
          grid-template-columns: minmax(0, 1fr) 300px;
          gap: 18px !important;
        }
        #product-options-column,
        #product-page.wl-has-product-options #product-options-column {
          grid-column: 1;
          grid-row: 2;
        }
        #product-sidebar,
        #product-page.wl-has-product-options #product-sidebar {
          grid-column: 2;
          grid-row: 1 / span 2;
        }
        #product-main { grid-column: 1 / -1; grid-row: 3; }
        .wl-pdp-recommendation-card { flex-basis: calc((100% - 14px) / 2); }
        #WTRelatedProducts .wl-related-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 767px) {
        .wl-pdp-heading { margin-top: 14px; gap: 8px; }
        #wl-product-title { font-size: 24px; }
        .wl-pdp-heading .wl-quote-product { padding: 12px !important; }
        #product-page,
        #product-page.wl-has-product-options {
          grid-template-columns: minmax(0, 1fr);
          gap: 16px !important;
        }
        #product-image-wrapper { grid-column: 1; grid-row: 1; }
        #product-options-column,
        #product-page.wl-has-product-options #product-options-column {
          grid-column: 1;
          grid-row: 2;
        }
        #product-sidebar,
        #product-page.wl-has-product-options #product-sidebar {
          grid-column: 1;
          grid-row: 3;
          padding: 12px !important;
        }
        #product-main { grid-column: 1; grid-row: 4; }
        #ctl00_PageBody_productDetail_ProductImage { max-height: 420px !important; }
        .wl-product-price-row { font-size: 28px !important; }
        .wl-pdp-recommendations { margin-top: 24px; padding-top: 20px; }
        .wl-pdp-recommendations__header { align-items: start; }
        .wl-pdp-recommendations__title { font-size: 21px; }
        .wl-pdp-recommendations__controls { display: none; }
        .wl-pdp-recommendations__rail {
          width: calc(100vw - 36px);
          max-width: calc(100vw - 36px);
          margin-right: calc(50% - 50vw + 18px);
        }
        .wl-pdp-recommendation-card {
          flex-basis: min(78vw, 285px);
          min-height: 325px;
        }
        .wl-pdp-recommendation-card__image { height: 155px; }
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
        #product-page, #product-image-wrapper, #product-options-column, #product-sidebar, #product-main { min-width: 0 !important; }
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

  // Products whose price is visible only after the customer signs in.
  const WL_LOGIN_PRICE_PIDS = new Set(["6821"]);
  const signInLink = Array.from(document.querySelectorAll("a")).find((link) => {
    const label = (link.textContent || "").trim();
    const href = link.getAttribute("href") || "";
    return /^sign in$/i.test(label) && /signin\.aspx/i.test(href);
  });
  const hidePriceUntilSignedIn =
    currentPID &&
    WL_LOGIN_PRICE_PIDS.has(String(currentPID)) &&
    Boolean(signInLink);
  const signInHref = signInLink ? signInLink.getAttribute("href") : "SignIn.aspx";

  const WL_EPALLET_RULES = {
    22444: { code: "ASC", pickupMin: 10, palletQty: 42 },
    23379: { code: "4BSC", pickupMin: 10, palletQty: 30 },
    24896: { code: "PCC", pickupMin: 10, palletQty: 35 },
    25273: { code: "RMMC", pickupMin: 10, palletQty: 42 },
    25274: { code: "RMSC", pickupMin: 10, palletQty: 42 },
    26446: { code: "WMCC", pickupMin: 10, palletQty: 40 },
    26481: { code: "5BSC", pickupMin: 10, palletQty: 30 },
    94106: { code: "FSC", pickupMin: 10, palletQty: 64 },
    12383: { code: "50BLC", pickupMin: 10, palletQty: 50 },
    24315: { code: "3BSC", pickupMin: 10, palletQty: 30 },
    24319: { code: "MCC", pickupMin: 10, palletQty: 45 },
    122893: { code: "MCSC", pickupMin: 10, palletQty: 45 },
    25102: { code: "QC", pickupMin: 10, palletQty: 42 },
    4741: { code: "16164BAC", pickupMin: 10, palletQty: 54 },
    12101: { code: "4816FSC", pickupMin: 20, palletQty: 144 },
    21194: { code: "8816HHBC", pickupMin: 10, palletQty: 72 },
    23008: { code: "CSC", pickupMin: 3, palletQty: 15 },
    23049: { code: "DBC", pickupMin: 10, palletQty: 80 },
    20366: { code: "816158FSC", pickupMin: 25, palletQty: 168 },
    20368: { code: "816214PC", pickupMin: 25, palletQty: 180 },
    21126: { code: "8812BLC", pickupMin: 10, palletQty: 64 },
    12100: { code: "4816BLC", pickupMin: 15, palletQty: 144 },
    2996: { code: "12122BAC", pickupMin: 25, palletQty: 168 },
    3003: { code: "12124BAC", pickupMin: 15, palletQty: 96 },
    21193: { code: "8816BLC", pickupMin: 10, palletQty: 60 },
    26060: { code: "UBC", pickupMin: 100, palletQty: 576 },
    133832: { code: "16162BAC", pickupMin: 15, palletQty: 84 },
    25415: { code: "SB", pickupMin: 3, palletQty: null },
    2999: { code: "12122RBAC", pickupMin: 20, palletQty: 168 },
    4743: { code: "16162RBBAC", pickupMin: 15, palletQty: 84 },
    21475: { code: "888LHBLC", pickupMin: 20, palletQty: 144 },
    4742: { code: "16162BBAC", pickupMin: 15, palletQty: 84 },
    25076: { code: "PR", pickupMin: 75, palletQty: 480 },
    25094: { code: "PT", pickupMin: 75, palletQty: 480 },
    23825: { code: "GWR", pickupMin: 20, palletQty: 144 },
    23826: { code: "GWRB", pickupMin: 20, palletQty: 144 },
    23827: { code: "GWT", pickupMin: 20, palletQty: 144 },
    113992: { code: "612CSC", pickupMin: 15, palletQty: 96 },
    113994: { code: "6CPCC", pickupMin: 10, palletQty: 52 },
    23828: { code: "GWTB", pickupMin: 20, palletQty: 144 }
  };
  const epalletRule = currentPID ? WL_EPALLET_RULES[String(currentPID)] : null;

  function epalletNotice(rule) {
    if (!rule) return $();
    const palletLine = rule.palletQty
      ? `One E-Pallet is added for every ${rule.palletQty} units that require pallet handling.`
      : "This item uses a pallet handling line when the order requires one.";
    return $(`
      <div class="wl-epallet-product-note" role="note">
        <strong>Pallet handling may apply</strong>
        <div>Woodson will add the E-Pallet line automatically when this cart meets the pallet handling rules.</div>
        <ul>
          <li>Pickup: added at ${rule.pickupMin}+ units.</li>
          <li>Delivery: added for any quantity.</li>
          <li>${palletLine}</li>
          <li>The E-Pallet charge is refundable when the pallet is returned in good condition.</li>
        </ul>
      </div>
    `);
  }

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

  const $optionsColumn = $("<aside>", {
    id: "product-options-column",
    "aria-label": "Product options"
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
        if (window.WLAnalytics) {
          window.WLAnalytics.track("share_product", {
            method,
            product_id: productID,
            share_url: redirectURL,
          });
        } else {
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({
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

  // The live price is now detached; the temporary anti-flash rule is no longer needed.
  const prehideStyle = document.getElementById("wl-login-price-prehide");
  if (prehideStyle) prehideStyle.remove();

  // Build buy box
  // === Build price + uom row ===
  const $priceRow = $("<div>").addClass("wl-product-price-row").css({
    display: "flex",
    justifyContent: "flex-end",
    fontSize: "20px",
    fontWeight: "bold",
    color: "#333",
  });

  if ($price.length && !hidePriceUntilSignedIn) {
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

  const $priceDisplay = hidePriceUntilSignedIn
    ? $("<div>", { class: "wl-price-login-gate", role: "note" })
        .append($("<strong>").text("Sign in to see price"))
        .append($("<span>").text("Pricing is available to signed-in customers."))
        .append($("<a>", {
          href: signInHref,
          class: "wl-price-login-link",
          text: "Sign in"
        }))
    : $priceRow;

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
  // Delivery / pickup selector + conversion experiment
  // =========================
  const selectedMethodKey = "woodson_cart_method";
  const experimentId = "pdp_fulfillment_v1_20260909";
  const experimentVariant = "similar_products_v1";
  let pdpStockState = window.WLPdpStockState || null;
  let stockReadyTracked = false;

  function wlSetExperimentMethod(method) {
    try {
      sessionStorage.setItem("wl_analytics_experiment_v1", JSON.stringify({
        experiment_id: experimentId,
        experiment_variant: experimentVariant,
        fulfillment_method: method === "delivery" ? "delivery" : "pickup"
      }));
    } catch (error) {}
  }

  function wlTrack(eventName, parameters) {
    const details = Object.assign({
      experiment_id: experimentId,
      experiment_variant: experimentVariant,
      product_id: String(currentPID || "")
    }, parameters || {});
    try {
      if (window.WLAnalytics && typeof window.WLAnalytics.track === "function") {
        const sent = window.WLAnalytics.track(eventName, details);
        if (sent !== false) return;
      }
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({
        event: "wl_analytics_event",
        event_name: eventName,
        analytics_version: "pdp-fallback-1",
        page_type: "product_detail"
      }, details));
    } catch (error) {}
  }

  function copyDate(date) {
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric"
    });
  }

  function nextPickupDate() {
    const now = new Date();
    for (let offset = 0; offset < 8; offset += 1) {
      const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      const day = candidate.getDay();
      if (day === 0) continue;
      if (offset > 0) return candidate;

      const closeMinutes = day === 6 ? 16 * 60 : 17 * 60 + 30;
      const earliestStart = Math.ceil((now.getHours() * 60 + now.getMinutes() + 120) / 60) * 60;
      if (earliestStart + 60 <= closeMinutes) return candidate;
    }
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  }

  function earliestDeliveryDate() {
    const today = new Date();
    const candidate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
    if (candidate.getDay() === 0) candidate.setDate(candidate.getDate() + 1);
    return candidate;
  }

  function pickupPromise(date) {
    const today = new Date();
    const todayKey = [today.getFullYear(), today.getMonth(), today.getDate()].join("-");
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const tomorrowKey = [tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate()].join("-");
    const dateKey = [date.getFullYear(), date.getMonth(), date.getDate()].join("-");
    if (dateKey === todayKey) return "Ready today";
    if (dateKey === tomorrowKey) return "Ready tomorrow";
    return "Ready " + copyDate(date);
  }

  const $pickupBtn = $("<button>", {
    type: "button",
    class: "method-box",
    "aria-pressed": "false",
    "aria-label": "Choose pickup"
  }).css({
    border: "1px solid #ccc",
    cursor: "pointer",
    backgroundColor: "#fff"
  }).html(
    '<span class="wl-method-label">Pickup</span>' +
    '<span class="wl-method-promise pickup-promise">Checking local stock…</span>' +
    '<span class="wl-method-meta pickup-info">Selected store</span>' +
    '<span class="wl-method-cost">FREE</span>'
  );

  const $deliveryBtn = $("<button>", {
    type: "button",
    class: "method-box",
    "aria-pressed": "false",
    "aria-label": "Choose delivery or shipping"
  }).css({
    border: "1px solid #ccc",
    cursor: "pointer",
    backgroundColor: "#fff"
  }).html(
    '<span class="wl-method-label">Delivery / Ship</span>' +
    '<span class="wl-method-promise delivery-promise">As soon as ' + copyDate(earliestDeliveryDate()) + '</span>' +
    '<span class="wl-method-meta delivery-info">Checking company inventory…</span>' +
    '<span class="wl-method-cost wl-method-rate">Rate based on address</span>'
  );

  const $methodRow = $("<div>").addClass("wl-pdp-method-row").css({
    display: "flex",
    gap: "10px",
    marginBottom: "4px"
  });

  const $banner = $("<div>", {
    class: "wl-delivery-banner wl-fulfillment-detail",
    role: "status",
    "aria-live": "polite"
  }).html(
    '<strong class="wl-fulfillment-detail-title"></strong>' +
    '<span class="wl-fulfillment-detail-copy"></span>' +
    '<span class="wl-fulfillment-detail-extra"></span>' +
    '<button type="button" class="wl-fulfillment-store-action">Check other stores</button>'
  );

  function quantityNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function updateFulfillmentDetail(method) {
    const state = pdpStockState;
    const branch = state && state.branch ? String(state.branch) : "your selected store";
    const hasStock = !!(state && state.hasStock === true);
    const pickupDate = nextPickupDate();
    const deliveryDate = earliestDeliveryDate();
    const $title = $banner.find(".wl-fulfillment-detail-title");
    const $copy = $banner.find(".wl-fulfillment-detail-copy");
    const $extra = $banner.find(".wl-fulfillment-detail-extra");
    const $storeAction = $banner.find(".wl-fulfillment-store-action");

    if (method === "delivery") {
      $title.text("Delivery or shipping");
      $copy.text("Woodson delivery can be scheduled as soon as " + copyDate(deliveryDate) + " with morning or afternoon windows.");
      $extra.html("<strong>UPS:</strong> Rates and arrival dates appear in checkout when the item and address qualify.");
      $storeAction.hide();
      return;
    }

    $title.text(hasStock ? "Pickup at " + branch : "Pickup options near " + branch);
    $copy.text(hasStock
      ? pickupPromise(pickupDate) + ". Choose a one-hour pickup window in checkout; same-day pickup requires at least 2 hours’ notice."
      : "This store is out. Check nearby stores or ship it to your store for free pickup.");
    $extra.text("");
    $storeAction.show();
  }

  function selectMethod(method, trackSelection) {
    if (method === "delivery" && $deliveryBtn.prop("disabled")) return;
    const normalized = method === "delivery" ? "delivery" : "pickup";
    const isPickup = normalized === "pickup";
    $pickupBtn.toggleClass("selected", isPickup)
      .attr("aria-pressed", isPickup ? "true" : "false")
      .css("border", isPickup ? "2px solid #6b0016" : "1px solid #ccc");
    $deliveryBtn.toggleClass("selected", !isPickup)
      .attr("aria-pressed", !isPickup ? "true" : "false")
      .css("border", !isPickup ? "2px solid #6b0016" : "1px solid #ccc");
    try { localStorage.setItem(selectedMethodKey, normalized); } catch (error) {}
    wlSetExperimentMethod(normalized);
    updateFulfillmentDetail(normalized);
    if (trackSelection) {
      wlTrack("pdp_fulfillment_select", {
        fulfillment_method: normalized,
        store_branch: pdpStockState && pdpStockState.branch ? String(pdpStockState.branch) : "unknown"
      });
    }
  }

  function applyFulfillmentState() {
    const state = pdpStockState;
    if (!state) {
      updateFulfillmentDetail($deliveryBtn.hasClass("selected") ? "delivery" : "pickup");
      return;
    }

    const branch = state.branch ? String(state.branch) : "Selected store";
    const branchQuantity = quantityNumber(state.quantity);
    const networkQuantity = quantityNumber(state.totalAvailable);
    const hasPickupStock = state.hasStock === true;
    const totalAvailable = Math.max(networkQuantity || 0, branchQuantity || 0);

    if (hasPickupStock) {
      $(".pickup-promise").text(pickupPromise(nextPickupDate()));
      $(".pickup-info").text(
        branchQuantity !== null
          ? (branchQuantity <= 5 ? "Only " : "") + branchQuantity.toLocaleString() + " at " + branch
          : "In stock at " + branch
      );
    } else if (totalAvailable > 0) {
      $(".pickup-promise").text("Check nearby stores");
      $(".pickup-info").text("Out at " + branch);
    } else {
      $(".pickup-promise").text("Pickup unavailable");
      $(".pickup-info").text("No current store inventory");
    }

    if (totalAvailable > 0) {
      $deliveryBtn.prop("disabled", false);
      $(".delivery-promise").text("As soon as " + copyDate(earliestDeliveryDate()));
      $(".delivery-info").text(totalAvailable.toLocaleString() + " available companywide");
    } else {
      $deliveryBtn.prop("disabled", true);
      $(".delivery-promise").text("Currently unavailable");
      $(".delivery-info").text("No company inventory");
      if ($deliveryBtn.hasClass("selected")) selectMethod("pickup", false);
    }

    updateFulfillmentDetail($deliveryBtn.hasClass("selected") ? "delivery" : "pickup");

    if (!stockReadyTracked) {
      stockReadyTracked = true;
      wlTrack("pdp_fulfillment_ready", {
        store_branch: branch,
        pickup_available: hasPickupStock ? "yes" : "no",
        pickup_quantity: branchQuantity,
        delivery_available: totalAvailable > 0 ? "yes" : "no",
        delivery_quantity: totalAvailable
      });
    }
  }

  $pickupBtn.on("click", () => selectMethod("pickup", true));
  $deliveryBtn.on("click", () => selectMethod("delivery", true));
  $banner.find(".wl-fulfillment-store-action").on("click", function () {
    wlTrack("pdp_store_availability", {
      fulfillment_method: "pickup",
      store_branch: pdpStockState && pdpStockState.branch ? String(pdpStockState.branch) : "unknown"
    });
    if (typeof window.openStockModal === "function") {
      const branch = pdpStockState && pdpStockState.branch ? String(pdpStockState.branch) : "";
      window.openStockModal(
        String(currentPID || ""),
        branch,
        "https://webtrack.woodsonlumber.com/Catalog/ShowStock.aspx?productid=" + encodeURIComponent(String(currentPID || ""))
      );
    } else {
      document.getElementById("stock-widget")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  document.addEventListener("wl:pdp-stock-ready", function (event) {
    if (event && event.detail) pdpStockState = event.detail;
    applyFulfillmentState();
  });

  let initialMethod = "pickup";
  try {
    if (localStorage.getItem(selectedMethodKey) === "delivery") initialMethod = "delivery";
  } catch (error) {}
  selectMethod(initialMethod, false);
  applyFulfillmentState();

  // Hook into Add to Cart (if present) to store method
  $addBtn.on("click", () => {
    const selected = $(".method-box.selected").text().includes("Pickup") ? "pickup" : "delivery";
    try { localStorage.setItem(selectedMethodKey, selected); } catch (error) {}
    wlSetExperimentMethod(selected);
    if (epalletRule) {
      try { sessionStorage.setItem("wl_epallet_sync_pending", "1"); } catch (e) {}
    }
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
    try { localStorage.setItem(selectedMethodKey, "pickup"); } catch (error) {}
    wlSetExperimentMethod("pickup");

    // Only show pickup selector (optional: still clickable, but only one option)
    $methodRow.append($pickupBtn);

    // Don't show qty/add controls at all
    // (We already detached them from the page; we simply don't add them back.)
    // But keep quicklist + stock if you want the “in-store tools” still available.
    $buyBox.empty().append($methodRow, epalletNotice(epalletRule), $priceDisplay, $notEligible, $quicklistBtn.css("marginTop", "10px"), $stockBtn);

  } else {
    // Normal purchase flow
    $methodRow.append($pickupBtn, $deliveryBtn);

    // Assemble actions
    $actionRow.append($qtyInput, $addBtn);

    // Final assembly
    $buyBox.empty().append($methodRow, $banner, epalletNotice(epalletRule), $priceDisplay, $actionRow, $quicklistBtn.css("marginTop", "10px"), $stockBtn);
  }

  $sidebar.append($buyBox);

  // Product description and reviews into main
  const $description = $("#ctl00_PageBody_productDetail_productDescription").first().detach();
  const $reviews = $("#customer-reviews, #review-widget").first().detach();

  $main.append($description, $reviews);

  // Product choices belong between imagery and the buy box. The options script
  // publishes state so cached, delayed, empty, and error responses all settle cleanly.
  let optionViewTracked = false;

  function clearProductOptions() {
    $pageWrapper.removeClass("wl-has-product-options");
    $optionsColumn.empty();
  }

  function mountProductOptions() {
    const $options = $("#productoption").first();
    if (!$options.length) return false;

    if (!$optionsColumn.find("#productoption").length) {
      $optionsColumn.empty().append($options.detach());
    }
    $pageWrapper.addClass("wl-has-product-options");

    if (!optionViewTracked) {
      optionViewTracked = true;
      const optionState = window.WLPdpOptionsState || {};
      wlTrack("pdp_option_view", {
        option_count: Number(optionState.optionCount) || $options.find("[data-wl-product-option]").length,
        option_group_count: Number(optionState.groupCount) || $options.find(".wl-product-option-group").length
      });
    }
    return true;
  }

  document.addEventListener("wl:pdp-options-ready", function (event) {
    const detail = event && event.detail ? event.detail : {};
    if (Number(detail.optionCount) > 0) {
      mountProductOptions();
    } else if (["ready", "empty", "invalid", "error"].includes(detail.status)) {
      clearProductOptions();
    }
  });

  $optionsColumn.on("click", "[data-wl-product-option]", function () {
    wlTrack("pdp_option_select", {
      option_type: String($(this).data("optionType") || "unknown").slice(0, 80),
      option_value: String($(this).data("optionValue") || $(this).text().trim() || "unknown").slice(0, 100),
      option_target_id: String($(this).data("optionTargetId") || "").slice(0, 40)
    });
  });

  // Covers an option response that completed while the blocklist request was pending.
  mountProductOptions();

  // Inject a stable layout at every viewport. CSS controls the responsive order,
  // so rotating a tablet or resizing a browser cannot strand content in the old tree.
  const $imageWrap = $("<div>", { id: "product-image-wrapper" });
  if ($imageTd.length) $imageWrap.append($imageTd);
  $pageWrapper.append($imageWrap, $optionsColumn, $sidebar, $main);

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

  $shippingLink.find("a").on("click", function () {
    wlTrack("pdp_fulfillment_select", {
      fulfillment_method: $deliveryBtn.hasClass("selected") ? "delivery" : "pickup",
      selection_action: "shipping_policy"
    });
  });
  $priceDisplay.find(".wl-price-login-link").on("click", function () {
    wlTrack("pdp_price_sign_in", { price_gate: "login_required" });
  });
  $(document).on("click.wlPdpQuoteTracking", ".wl-quote-product a, a[href*='request_a_quote']", function () {
    wlTrack("generate_lead", { lead_source: "pdp_quote_request" });
  });

  $sidebar.append($shippingLink);

  window.setTimeout(function () {
    wlTrack("pdp_fulfillment_view", {
      default_method: $deliveryBtn.hasClass("selected") ? "delivery" : "pickup",
      stock_state: pdpStockState ? "ready" : "loading"
    });
  }, 0);

  // =========================
  // Product recommendations
  // =========================
  const recommendationApi = "https://wl-upsrates.vercel.app/api/product-recommendations?v=20260909-1";
  const recommendationAttributionKey = "wl_pdp_recommendation_attribution_v1";
  let recommendationRequest = 0;
  let recommendationSignature = "";
  let recommendationViewTracked = false;

  function normalizeProductContentOrder() {
    const $content = $(".wl-product-content").first();
    const $legacyDescription = $("#ctl00_PageBody_productDetail_productDescription").first();
    const $reviews = $("#customer-reviews, #review-widget").first();
    let $completeSlot = $("#pdp-complete-project-slot");
    let $similarSlot = $("#pdp-similar-products-slot");

    if ($content.length && !$content.parent().is($main)) {
      if ($legacyDescription.length && $legacyDescription.parent().is($main)) {
        $content.detach().insertBefore($legacyDescription);
      } else {
        $main.prepend($content.detach());
      }
    }
    if ($reviews.length && !$reviews.parent().is($main)) $main.append($reviews.detach());

    if (!$completeSlot.length) {
      $completeSlot = $("<div>", { id: "pdp-complete-project-slot" });
    }
    if ($content.length && $content.parent().is($main)) {
      if ($content.get(0).nextElementSibling !== $completeSlot.get(0)) $completeSlot.insertAfter($content);
    } else if ($legacyDescription.length && $legacyDescription.parent().is($main)) {
      if ($legacyDescription.get(0).nextElementSibling !== $completeSlot.get(0)) $completeSlot.insertAfter($legacyDescription);
    } else {
      if (!$completeSlot.parent().is($main) || $main.get(0).firstElementChild !== $completeSlot.get(0)) {
        $main.prepend($completeSlot);
      }
    }

    if (
      $reviews.length &&
      $reviews.parent().is($main) &&
      $completeSlot.get(0).nextElementSibling !== $reviews.get(0)
    ) $reviews.insertAfter($completeSlot);

    if (!$similarSlot.length) {
      $similarSlot = $("<div>", { id: "pdp-similar-products-slot" });
    }
    if ($reviews.length && $reviews.parent().is($main)) {
      if ($reviews.get(0).nextElementSibling !== $similarSlot.get(0)) $similarSlot.insertAfter($reviews);
    } else {
      if (!$similarSlot.parent().is($main) || $main.get(0).lastElementChild !== $similarSlot.get(0)) {
        $main.append($similarSlot);
      }
    }
    return { content: $content.length, reviews: $reviews.length, similarSlot: $similarSlot };
  }

  const contentOrderObserver = new MutationObserver(function () {
    normalizeProductContentOrder();
  });
  if (document.body) contentOrderObserver.observe(document.body, { childList: true, subtree: true });
  normalizeProductContentOrder();
  window.setTimeout(function () {
    normalizeProductContentOrder();
    contentOrderObserver.disconnect();
  }, 12000);

  function optionProductIds() {
    const ids = new Set([String(currentPID || "")]);
    document.querySelectorAll("[data-option-target-id]").forEach(function (element) {
      const productId = String(element.getAttribute("data-option-target-id") || "").trim();
      if (/^\d{1,20}$/.test(productId)) ids.add(productId);
    });
    return Array.from(ids).filter(Boolean).sort(function (left, right) {
      return Number(left) - Number(right);
    });
  }

  function safeRecommendationUrl(value, kind) {
    try {
      const url = new URL(String(value || ""));
      if (url.protocol !== "https:") return "";
      if (kind === "product" && url.hostname !== "webtrack.woodsonlumber.com") return "";
      if (kind === "image" && !["webtrack.woodsonlumber.com", "images-woodsonlumber.sirv.com"].includes(url.hostname)) return "";
      return url.href;
    } catch (error) {
      return "";
    }
  }

  function analyticsItems(items, listId, listName) {
    return items.map(function (item, index) {
      const analyticsItem = {
        item_id: String(item.productId),
        item_name: String(item.title).slice(0, 180),
        item_list_id: listId,
        item_list_name: listName,
        index
      };
      if (item.brand) analyticsItem.item_brand = String(item.brand).slice(0, 100);
      if (item.category) analyticsItem.item_category = String(item.category).slice(0, 200);
      return analyticsItem;
    });
  }

  function rememberRecommendation(item, payload) {
    try {
      sessionStorage.setItem(recommendationAttributionKey, JSON.stringify({
        productId: String(item.productId),
        sourceProductId: String(currentPID || ""),
        listId: String(payload.listId || "pdp_similar_products_v1"),
        listName: String(payload.listName || "Compare similar products"),
        algorithm: String(payload.algorithm || "merchant_category_v1"),
        selectedAt: Date.now()
      }));
    } catch (error) {}
  }

  function trackRecommendationView(section, items, payload) {
    if (recommendationViewTracked) return;
    const send = function () {
      if (recommendationViewTracked || !document.documentElement.contains(section)) return;
      recommendationViewTracked = true;
      wlTrack("view_item_list", {
        item_list_id: payload.listId,
        item_list_name: payload.listName,
        recommendation_algorithm: payload.algorithm,
        recommendation_count: items.length,
        ecommerce: { items: analyticsItems(items, payload.listId, payload.listName) }
      });
    };
    if (typeof IntersectionObserver !== "function") {
      window.setTimeout(send, 0);
      return;
    }
    const observer = new IntersectionObserver(function (entries) {
      if (!entries.some(function (entry) { return entry.isIntersecting && entry.intersectionRatio >= 0.35; })) return;
      observer.disconnect();
      send();
    }, { threshold: [0.35] });
    observer.observe(section);
  }

  function renderRecommendations(payload) {
    const layout = normalizeProductContentOrder();
    const $slot = layout.similarSlot;
    const excluded = new Set(optionProductIds());
    const items = Array.isArray(payload.recommendations)
      ? payload.recommendations.filter(function (item) {
          return item &&
            /^\d{1,20}$/.test(String(item.productId || "")) &&
            !excluded.has(String(item.productId)) &&
            safeRecommendationUrl(item.productUrl, "product") &&
            safeRecommendationUrl(item.imageUrl, "image");
        }).slice(0, 8)
      : [];

    $slot.empty();
    if (items.length < 3) return false;

    const listId = String(payload.listId || "pdp_similar_products_v1").slice(0, 100);
    const listName = String(payload.listName || "Compare similar products").slice(0, 100);
    const algorithm = String(payload.algorithm || "merchant_category_v1").slice(0, 100);
    const normalizedPayload = { listId, listName, algorithm };
    const $section = $("<section>", {
      id: "wl-pdp-similar-products",
      class: "wl-pdp-recommendations",
      "aria-labelledby": "wl-pdp-similar-products-title",
      "data-recommendation-algorithm": algorithm
    });
    const $headingText = $("<div>");
    $("<p>", { class: "wl-pdp-recommendations__eyebrow", text: "More choices" }).appendTo($headingText);
    $("<h2>", {
      id: "wl-pdp-similar-products-title",
      class: "wl-pdp-recommendations__title",
      text: listName
    }).appendTo($headingText);
    $("<p>", {
      class: "wl-pdp-recommendations__copy",
      text: "In-stock alternatives selected from the same part of our catalog."
    }).appendTo($headingText);

    const $controls = $("<div>", { class: "wl-pdp-recommendations__controls" });
    const $previous = $("<button>", {
      type: "button",
      class: "wl-pdp-recommendations__control",
      text: "‹",
      "aria-label": "Show previous similar products"
    });
    const $next = $("<button>", {
      type: "button",
      class: "wl-pdp-recommendations__control",
      text: "›",
      "aria-label": "Show more similar products"
    });
    $controls.append($previous, $next);
    $("<div>", { class: "wl-pdp-recommendations__header" }).append($headingText, $controls).appendTo($section);

    const $rail = $("<div>", {
      class: "wl-pdp-recommendations__rail",
      role: "list",
      "aria-label": listName
    });
    items.forEach(function (item, index) {
      const productUrl = safeRecommendationUrl(item.productUrl, "product");
      const imageUrl = safeRecommendationUrl(item.imageUrl, "image");
      const brand = String(item.brand || "").trim();
      const category = String(item.categoryLabel || "").trim();
      const $card = $("<a>", {
        class: "wl-pdp-recommendation-card",
        href: productUrl,
        role: "listitem",
        "data-recommendation-index": index,
        "data-recommendation-product-id": String(item.productId),
        "data-recommendation-match": String(item.match || "same_category")
      });
      $("<img>", {
        class: "wl-pdp-recommendation-card__image",
        src: imageUrl,
        alt: "",
        loading: "lazy",
        decoding: "async"
      }).appendTo($card);
      if (brand) $("<span>", { class: "wl-pdp-recommendation-card__brand", text: brand }).appendTo($card);
      if (category) $("<span>", { class: "wl-pdp-recommendation-card__category", text: category }).appendTo($card);
      $("<span>", { class: "wl-pdp-recommendation-card__title", text: String(item.title || "") }).appendTo($card);
      $("<span>", { class: "wl-pdp-recommendation-card__status", text: "Available to order" }).appendTo($card);
      $("<span>", { class: "wl-pdp-recommendation-card__cta", text: "View price & availability" }).appendTo($card);
      $card.on("click", function () {
        rememberRecommendation(item, normalizedPayload);
        const selectedItem = analyticsItems([item], listId, listName);
        selectedItem[0].index = index;
        wlTrack("select_item", {
          item_list_id: listId,
          item_list_name: listName,
          recommendation_algorithm: algorithm,
          recommendation_rank: index + 1,
          recommendation_match: String(item.match || "same_category"),
          ecommerce: { items: selectedItem }
        });
      });
      $rail.append($card);
    });
    $section.append($rail);
    $slot.append($section);

    const scrollRail = function (direction) {
      const element = $rail.get(0);
      if (!element) return;
      element.scrollBy({ left: direction * Math.max(260, element.clientWidth * 0.82), behavior: "smooth" });
    };
    $previous.on("click", function () { scrollRail(-1); });
    $next.on("click", function () { scrollRail(1); });

    const nativeRelated = document.getElementById("WTRelatedProducts");
    if (nativeRelated) nativeRelated.hidden = true;
    trackRecommendationView($section.get(0), items, normalizedPayload);
    return true;
  }

  async function loadRecommendations() {
    if (!currentPID) return;
    const excluded = optionProductIds();
    const signature = excluded.join(",");
    if (signature === recommendationSignature && $("#wl-pdp-similar-products").length) return;
    recommendationSignature = signature;
    const request = ++recommendationRequest;
    try {
      const url = new URL(recommendationApi);
      url.searchParams.set("pid", String(currentPID));
      url.searchParams.set("exclude", signature);
      const response = await fetch(url.href, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Recommendation request failed.");
      const payload = await response.json();
      if (request !== recommendationRequest || !payload || payload.success !== true) return;
      renderRecommendations(payload);
    } catch (error) {
      if (request === recommendationRequest) $("#pdp-similar-products-slot").empty();
    }
  }

  document.addEventListener("wl:pdp-options-ready", function () {
    window.setTimeout(loadRecommendations, 0);
  });
  window.setTimeout(loadRecommendations, 900);

  function modernizeRelatedProducts() {
    const root = document.getElementById("WTRelatedProducts");
    if (!root || root.dataset.wlModernized === "1") return false;
    const scroller = root.querySelector(".relatedProductsScrollingDiv");
    if (!scroller) return false;

    const cards = Array.from(scroller.children).filter((element) => element.classList.contains("row"));
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
