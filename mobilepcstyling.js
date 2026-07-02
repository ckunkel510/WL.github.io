(function () {
  "use strict";

  const STYLE_ID = "wl-modern-product-cards";
  const REVIEW_CACHE_KEY = "wl_product_review_summary_v1";
  const REVIEW_CACHE_MS = 15 * 60 * 1000;
  const PRODUCT_PAGE_SIZE = 48;
  const PRODUCT_PAGE_LOAD_TIMEOUT_MS = 60 * 1000;
  const REVIEW_SHEET_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZGjAjfdB4m_XfqFQC3i3-n09g-BlRp_oVBo0sD1eyMV9OlwMFbCaVQ3Urrw6rwWPr9VPu5vDXcMyo/pubhtml/sheet?headers=false&gid=220983932";
  let reviewSummaryPromise;
  let savedForLaterStatePromise;

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #productlistcards.Cards {
        display: grid !important;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        align-items: stretch;
        gap: 16px;
        width: 100% !important;
        padding: 0 !important;
        margin: 0 0 28px !important;
        border: 0 !important;
        text-align: left !important;
      }

      #productlistcards > .wl-product-card {
        position: relative;
        display: flex !important;
        flex-direction: column;
        min-width: 0;
        width: auto !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible;
        background: #fff;
        border: 1px solid #d9dcdf !important;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(28, 31, 35, 0.08);
      }

      #productlistcards .wl-product-card > table.ProductCard,
      #productlistcards .wl-product-card > table.ProductCard > tbody {
        display: block !important;
        width: 100% !important;
        height: auto !important;
        margin: 0 !important;
        border: 0 !important;
        border-radius: 0 !important;
        border-collapse: separate !important;
        border-spacing: 0 !important;
      }

      #productlistcards .wl-product-card table.ProductCard tr {
        display: block !important;
        float: none !important;
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        margin: 0 !important;
      }

      #productlistcards .wl-product-card table.ProductCard td {
        display: block !important;
        float: none !important;
        box-sizing: border-box !important;
        width: 100% !important;
        min-width: 0 !important;
        height: auto !important;
        margin: 0 !important;
        text-align: left !important;
      }

      #productlistcards .wl-product-card #ProductImageRow .productImageCell {
        height: 200px !important;
        padding: 14px !important;
        overflow: hidden;
        background: #f7f7f6;
        border: 0 !important;
        border-radius: 7px 7px 0 0;
      }

      #productlistcards .wl-product-card #ProductImageRow .productImageCell:hover {
        background: #f1f2f0;
        border: 0 !important;
      }

      #productlistcards .wl-product-card .image-with-flags,
      #productlistcards .wl-product-card .image-with-flags > a,
      #productlistcards .wl-product-card #ProductImageRow .productImageCell > a {
        display: flex !important;
        align-items: center;
        justify-content: center;
        width: 100% !important;
        height: 100% !important;
      }

      #productlistcards .wl-product-card img.productImage {
        display: block;
        width: 100% !important;
        height: 100% !important;
        max-width: 100% !important;
        max-height: 100% !important;
        margin: 0 auto !important;
        object-fit: contain;
      }

      #productlistcards .wl-product-card #ProductDescriptionRow td {
        min-height: 58px !important;
        padding: 13px 16px 4px !important;
      }

      #productlistcards .wl-product-card .productDescriptionRow {
        width: 100% !important;
        min-width: 0 !important;
        max-width: none !important;
        overflow: visible !important;
        line-height: 1.35 !important;
      }

      #productlistcards .wl-product-card .productNameLink {
        display: -webkit-box !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: none !important;
        overflow: hidden;
        color: #202326 !important;
        font-size: 15px !important;
        font-weight: 700;
        line-height: 1.35 !important;
        white-space: normal !important;
        text-decoration: none;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
      }

      #productlistcards .wl-product-card .productNameLink:hover {
        color: #6b0005 !important;
        text-decoration: underline;
      }

      #productlistcards .wl-product-card .wl-product-rating-row td {
        min-height: 27px !important;
        padding: 0 16px 8px !important;
      }

      #productlistcards .wl-product-card .wl-product-rating-link {
        display: inline-flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 5px;
        color: #5b6065;
        font-size: 12px;
        font-weight: 650;
        line-height: 1.3;
        text-decoration: none;
      }

      #productlistcards .wl-product-card .wl-product-rating-link:hover,
      #productlistcards .wl-product-card .wl-product-rating-link:focus {
        color: #6b0005;
        text-decoration: underline;
      }

      #productlistcards .wl-product-card .wl-card-stars {
        display: inline-flex;
        gap: 1px;
        color: #b5b9bc;
        font-size: 14px;
        line-height: 1;
      }

      #productlistcards .wl-product-card .wl-card-star.is-filled {
        color: #b26a00;
      }

      #productlistcards .wl-product-card .wl-product-rating-row.wl-is-hidden {
        display: none !important;
      }

      #productlistcards .wl-product-card #ProductCodeRow td {
        padding: 0 16px 8px !important;
      }

      #productlistcards .wl-product-card #ProductCodeRow .text-truncate {
        width: 100% !important;
        max-width: none !important;
        overflow: hidden;
        color: #666b70;
        font-size: 12px;
        line-height: 1.4;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      #productlistcards .wl-product-card #PriceRow td {
        display: flex !important;
        align-items: baseline;
        flex-wrap: wrap;
        gap: 4px;
        width: 100% !important;
        min-width: 0 !important;
        max-width: none !important;
        min-height: 38px !important;
        padding: 2px 16px 10px !important;
      }

      #productlistcards .wl-product-card #PriceRow,
      #productlistcards .wl-product-card .priceRowProductCode {
        color: #202326 !important;
        font-size: 18px !important;
        font-weight: 750 !important;
        line-height: 1.3 !important;
      }

      #productlistcards .wl-product-card #PriceRow td > span + span {
        color: #666b70 !important;
        font-size: 12px !important;
        font-weight: 500 !important;
      }

      #productlistcards .wl-product-card #QuantityRow {
        margin-top: auto !important;
      }

      #productlistcards .wl-product-card #QuantityRow td {
        display: flex !important;
        align-items: center;
        gap: 8px;
        min-height: 58px !important;
        padding: 9px 16px !important;
        border-top: 1px solid #eceeed;
      }

      #productlistcards .wl-product-card #QuantityRow td::before {
        content: "Qty";
        color: #3f4448;
        font-size: 13px;
        font-weight: 700;
      }

      #productlistcards .wl-product-card #QuantityRow .riSingle {
        display: inline-flex !important;
        width: auto !important;
        height: auto !important;
      }

      #productlistcards .wl-product-card #QuantityRow input[type="text"] {
        box-sizing: border-box !important;
        width: 68px !important;
        height: 40px !important;
        margin: 0 !important;
        padding: 6px 8px !important;
        color: #202326 !important;
        font-size: 16px !important;
        font-weight: 650;
        text-align: center !important;
        background: #fff !important;
        border: 1px solid #aeb3b7 !important;
        border-radius: 6px !important;
      }

      #productlistcards .wl-product-card #QuantityRow input[type="text"]:focus {
        outline: 3px solid rgba(107, 0, 5, 0.16) !important;
        outline-offset: 1px;
        border-color: #6b0005 !important;
      }

      #productlistcards .wl-product-card #LocalStockRow td {
        padding: 0 16px 12px !important;
      }

      #productlistcards .wl-product-card #LocalStockRow td > div,
      #productlistcards .wl-product-card .wl-stock-message {
        padding: 8px 10px !important;
        color: #454a4f !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        line-height: 1.35;
        text-align: left !important;
        background: #f6f7f5;
        border: 1px solid #e1e3e0 !important;
        border-radius: 6px !important;
      }

      #productlistcards .wl-product-card .wl-stock-message--available {
        color: #155b39 !important;
        background: #f1f8f4;
        border-color: #cfe5d8 !important;
      }

      #productlistcards .wl-product-card .wl-stock-message--loading {
        color: #5b6065 !important;
        background: #f7f7f6;
      }

      #productlistcards .wl-product-card .wl-stock-message--unavailable {
        color: #656a6f !important;
        background: #f7f7f6;
      }

      #productlistcards .wl-product-card #QuantityValidatorAndAddButtonRow td {
        padding: 0 16px !important;
      }

      #productlistcards .wl-product-card > .wl-product-actions {
        display: block !important;
        width: auto !important;
        margin: 0 !important;
        padding: 0 16px 16px !important;
      }

      #productlistcards .wl-product-actions > .mb-1 {
        float: none !important;
        clear: none !important;
        width: auto !important;
        min-width: 0;
        margin: 0 !important;
      }

      #productlistcards .wl-product-actions > [id$="AddProductButton_TR"] {
        width: 100% !important;
      }

      #productlistcards .wl-product-actions .mb-1 > div {
        display: block !important;
        clear: none !important;
        padding: 0 !important;
      }

      #productlistcards .wl-product-actions a.epi-button {
        display: flex !important;
        float: none !important;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: 100% !important;
        min-width: 0;
        min-height: 42px;
        margin: 0 !important;
        padding: 9px 10px !important;
        color: #3f4448 !important;
        font-size: 13px;
        font-weight: 700;
        line-height: 1.2;
        text-align: center;
        text-decoration: none;
        background: #fff !important;
        border: 1px solid #c8cccf !important;
        border-radius: 6px !important;
      }

      #productlistcards .wl-product-actions a[title="Add to cart"] {
        color: #fff !important;
        font-size: 15px;
        background: #6b0005 !important;
        border-color: #6b0005 !important;
      }

      #productlistcards .wl-product-actions a.epi-button:hover,
      #productlistcards .wl-product-actions a.epi-button:focus {
        color: #202326 !important;
        background: #f1f2f0 !important;
        border-color: #8e9499 !important;
      }

      #productlistcards .wl-product-actions a[title="Add to cart"]:hover,
      #productlistcards .wl-product-actions a[title="Add to cart"]:focus {
        color: #fff !important;
        background: #4f0004 !important;
        border-color: #4f0004 !important;
      }

      #productlistcards .wl-product-actions > .wl-stock-action {
        display: none !important;
      }

      #productlistcards .wl-product-actions > .wl-save-row {
        position: absolute !important;
        top: 12px;
        right: 12px;
        z-index: 8;
        display: block !important;
        width: 42px !important;
        height: 42px;
      }

      #productlistcards .wl-save-row > div:first-child {
        width: 42px !important;
        height: 42px;
      }

      #productlistcards .wl-product-actions a.wl-save-heart {
        position: relative;
        display: flex !important;
        width: 42px !important;
        height: 42px;
        min-height: 42px;
        padding: 0 !important;
        color: #6b0005 !important;
        background: rgba(255, 255, 255, 0.96) !important;
        border: 1px solid #d4d7d9 !important;
        border-radius: 50% !important;
        box-shadow: 0 2px 7px rgba(25, 28, 30, 0.14);
      }

      #productlistcards .wl-product-actions a.wl-save-heart::before {
        content: "\\2661";
        color: currentColor;
        font-size: 28px;
        font-weight: 500;
        line-height: 1;
      }

      #productlistcards .wl-product-actions a.wl-save-heart:hover,
      #productlistcards .wl-product-actions a.wl-save-heart:focus {
        color: #fff !important;
        background: #6b0005 !important;
        border-color: #6b0005 !important;
      }

      #productlistcards .wl-product-actions a.wl-save-heart.is-saved {
        color: #fff !important;
        background: #6b0005 !important;
        border-color: #6b0005 !important;
      }

      #productlistcards .wl-product-actions a.wl-save-heart.is-saved::before {
        content: "\\2665";
      }

      #productlistcards .wl-product-actions a.wl-save-heart.is-saving::before {
        content: "\\2026";
        font-size: 22px;
      }

      #productlistcards .wl-product-actions a.wl-save-heart span {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important;
        border: 0 !important;
      }

      #productlistcards .wl-product-actions .quicklist-wrap {
        position: absolute;
        top: 48px;
        right: 0;
        z-index: 20;
      }

      #productlistcards .wl-product-actions .quicklist-dropdown {
        left: auto !important;
        right: 0 !important;
        box-sizing: border-box;
        width: max-content !important;
        min-width: 170px;
        max-width: calc(100vw - 32px);
      }

      body.wl-products-48 .items-per-page,
      body.wl-infinite-products-active .items-per-page {
        display: none !important;
      }

      body.wl-products-48 ul.pagination {
        display: flex !important;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: 6px;
        width: 100%;
        margin: 24px auto 30px !important;
        padding: 0 !important;
        list-style: none;
      }

      body.wl-products-48 ul.pagination .page-item {
        margin: 0 !important;
      }

      body.wl-products-48 ul.pagination .page-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        min-width: 40px;
        min-height: 40px;
        padding: 8px 11px;
        color: #34383d;
        font-size: 14px;
        font-weight: 700;
        line-height: 1;
        text-decoration: none;
        background: #fff;
        border: 1px solid #d4d8dc;
        border-radius: 6px;
        box-shadow: 0 1px 2px rgba(28, 31, 35, 0.05);
      }

      body.wl-products-48 ul.pagination .page-link:hover,
      body.wl-products-48 ul.pagination .page-link:focus {
        color: #6b0005;
        border-color: #6b0005;
        outline: 2px solid rgba(107, 0, 5, 0.12);
        outline-offset: 1px;
      }

      body.wl-products-48 ul.pagination .page-item.active .page-link {
        color: #fff;
        background: #6b0005;
        border-color: #6b0005;
      }

      body.wl-products-48 ul.pagination .page-item.disabled .page-link {
        color: #8a9096;
        background: #f4f5f6;
        border-color: #e1e3e5;
        box-shadow: none;
        pointer-events: none;
      }

      body.wl-infinite-products-active #productlistcards.Cards {
        margin-bottom: 16px !important;
      }

      #wl-infinite-products {
        width: 100%;
        margin: 0 0 28px;
        overflow-anchor: none;
      }

      #wl-infinite-products .wl-product-page-frame {
        display: block;
        visibility: hidden;
        width: 100%;
        min-height: 420px;
        margin: 0 0 16px;
        overflow: hidden;
        overflow-anchor: none;
        background: transparent;
        border: 0;
      }

      #wl-infinite-products .wl-product-page-frame.is-ready {
        visibility: visible;
      }

      #wl-infinite-status {
        min-height: 24px;
        padding: 6px 0;
        color: #5b6065;
        font-size: 13px;
        line-height: 1.4;
        text-align: center;
      }

      #wl-infinite-status:empty {
        display: none;
      }

      #wl-infinite-retry {
        min-height: 40px;
        margin: 6px auto;
        padding: 8px 14px;
        color: #6b0005;
        font-size: 13px;
        font-weight: 700;
        background: #fff;
        border: 1px solid #6b0005;
        border-radius: 6px;
        cursor: pointer;
      }

      #wl-infinite-sentinel {
        width: 100%;
        height: 1px;
      }

      .wl-related-categories {
        box-sizing: border-box;
        width: 100%;
        margin: 0 0 14px;
        overflow: hidden;
        background: #fff;
        border: 1px solid #d9dcdf;
        border-radius: 6px;
      }

      .wl-related-categories > summary {
        position: relative;
        display: block;
        padding: 11px 36px 11px 12px;
        color: #303438;
        font-size: 14px;
        font-weight: 750;
        line-height: 1.3;
        cursor: pointer;
        list-style: none;
      }

      .wl-related-categories > summary::-webkit-details-marker {
        display: none;
      }

      .wl-related-categories > summary::after {
        content: "+";
        position: absolute;
        top: 50%;
        right: 12px;
        color: #6b0005;
        font-size: 20px;
        font-weight: 500;
        line-height: 1;
        transform: translateY(-50%);
      }

      .wl-related-categories[open] > summary::after {
        content: "\\2212";
      }

      .wl-related-categories[open] > summary {
        border-bottom: 1px solid #e4e6e7;
      }

      .wl-related-categories #ctl00_PageBody_ProductGroupDrillDownPanel,
      .wl-related-categories #ctl00_PageBody_ProductGroupDrillDownUpdatePanel,
      .wl-related-categories .productGroupScrollingPanelFull {
        display: block !important;
        box-sizing: border-box !important;
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
      }

      .wl-related-categories .paging-control,
      .wl-related-categories style,
      .wl-related-categories input[type="hidden"],
      .wl-related-categories #ProductGroupCardImageRow,
      .wl-related-categories #ProductGroupCardFooter {
        display: none !important;
      }

      .wl-related-categories fieldset.Cards {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) !important;
        width: 100% !important;
        height: auto !important;
        margin: 0 !important;
        padding: 4px 0 !important;
        border: 0 !important;
      }

      .wl-related-categories #productGroupCard {
        display: block !important;
        float: none !important;
        box-sizing: border-box !important;
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
      }

      .wl-related-categories #ProductGroupCardContainer {
        display: block !important;
        box-sizing: border-box !important;
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        background: transparent !important;
        border: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }

      .wl-related-categories #ProductGroupCardHeader {
        position: static !important;
        display: block !important;
        box-sizing: border-box !important;
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        text-align: left !important;
        background: transparent !important;
        border: 0 !important;
      }

      .wl-related-categories #ProductGroupCardHeader a {
        display: block !important;
        padding: 9px 12px !important;
        color: #303438 !important;
        font-size: 13px !important;
        font-weight: 650 !important;
        line-height: 1.3 !important;
        text-decoration: none !important;
        border-bottom: 1px solid #eceeed;
      }

      .wl-related-categories #productGroupCard:last-of-type #ProductGroupCardHeader a {
        border-bottom: 0;
      }

      .wl-related-categories #ProductGroupCardHeader a:hover,
      .wl-related-categories #ProductGroupCardHeader a:focus {
        color: #6b0005 !important;
        background: #f6f7f5;
        text-decoration: underline !important;
      }

      @media (max-width: 899px) {
        .wl-related-categories {
          margin-top: 10px;
        }
      }

      @media (max-width: 520px) {
        #productlistcards.Cards {
          grid-template-columns: minmax(0, 1fr);
          gap: 14px;
        }

        #productlistcards .wl-product-card #ProductImageRow .productImageCell {
          height: 190px !important;
        }
      }

      @media (min-width: 900px) {
        #productlistcards .wl-product-card #ProductImageRow .productImageCell {
          height: 180px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function findHeader(headers, candidates) {
    return headers.findIndex(function (header) {
      return candidates.some(function (candidate) {
        return header === candidate || header.includes(candidate);
      });
    });
  }

  function parseReviewSummaries(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const table = doc.querySelector("table.waffle") || doc.querySelector("table");
    if (!table) return {};

    const rows = Array.from(table.querySelectorAll("tbody tr"));
    if (rows.length < 2) return {};

    const headers = Array.from(rows[0].querySelectorAll("td,th")).map(function (cell) {
      return String(cell.textContent || "").trim().toLowerCase();
    });
    const starsColumn = findHeader(headers, ["stars", "rating", "score", "column 2"]);
    const productColumn = findHeader(headers, ["productid", "product id", "pid", "product"]);
    if (starsColumn === -1 || productColumn === -1) return {};

    const summaries = {};
    rows.slice(1).forEach(function (row) {
      const cells = Array.from(row.querySelectorAll("td,th"));
      const productId = String(cells[productColumn]?.textContent || "").replace(/\D+/g, "");
      const stars = Number.parseFloat(String(cells[starsColumn]?.textContent || "").replace(/[^0-9.]/g, ""));
      if (!productId || !Number.isFinite(stars) || stars <= 0) return;

      if (!summaries[productId]) summaries[productId] = { count: 0, total: 0 };
      summaries[productId].count += 1;
      summaries[productId].total += Math.max(0, Math.min(5, stars));
    });

    Object.keys(summaries).forEach(function (productId) {
      const summary = summaries[productId];
      summary.average = summary.total / summary.count;
      delete summary.total;
    });
    return summaries;
  }

  function getCachedReviewSummaries() {
    try {
      const cached = JSON.parse(sessionStorage.getItem(REVIEW_CACHE_KEY) || "null");
      if (cached && Date.now() - cached.savedAt < REVIEW_CACHE_MS && cached.summaries) {
        return cached.summaries;
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  function loadReviewSummaries() {
    if (reviewSummaryPromise) return reviewSummaryPromise;

    const cached = getCachedReviewSummaries();
    if (cached) {
      reviewSummaryPromise = Promise.resolve(cached);
      return reviewSummaryPromise;
    }

    reviewSummaryPromise = fetch(REVIEW_SHEET_URL + "&cacheBust=" + Date.now())
      .then(function (response) {
        if (!response.ok) throw new Error("Review feed returned " + response.status);
        return response.text();
      })
      .then(function (html) {
        const summaries = parseReviewSummaries(html);
        try {
          sessionStorage.setItem(REVIEW_CACHE_KEY, JSON.stringify({
            savedAt: Date.now(),
            summaries: summaries
          }));
        } catch (error) {
          // Private browsing can disable session storage; reviews still render normally.
        }
        return summaries;
      });
    return reviewSummaryPromise;
  }

  function buildCardStars(rating) {
    const stars = document.createElement("span");
    stars.className = "wl-card-stars";
    stars.setAttribute("role", "img");
    stars.setAttribute("aria-label", rating.toFixed(1) + " out of 5 stars");
    const filled = Math.round(rating);

    for (let index = 1; index <= 5; index += 1) {
      const star = document.createElement("span");
      star.className = "wl-card-star" + (index <= filled ? " is-filled" : "");
      star.setAttribute("aria-hidden", "true");
      star.innerHTML = "&#9733;";
      stars.appendChild(star);
    }
    return stars;
  }

  function ensureRatingRow(card) {
    let row = card.querySelector(".wl-product-rating-row");
    if (row) return row;

    const descriptionRow = card.querySelector("#ProductDescriptionRow");
    if (!descriptionRow || !descriptionRow.parentNode) return null;

    row = document.createElement("tr");
    row.className = "wl-product-rating-row wl-is-hidden";
    const cell = document.createElement("td");
    const link = document.createElement("a");
    link.className = "wl-product-rating-link";
    cell.appendChild(link);
    row.appendChild(cell);
    descriptionRow.parentNode.insertBefore(row, descriptionRow.nextSibling);
    return row;
  }

  function renderCardRating(card, summaries) {
    const row = ensureRatingRow(card);
    if (!row) return;

    const productLink = card.querySelector("#ProductImageRow a[href*='ProductDetail.aspx']") ||
      card.querySelector("#ProductDescriptionRow a[href*='ProductDetail.aspx']");
    const href = productLink?.href || "";
    const match = href.match(/[?&]pid=(\d+)/i);
    if (!match) return;

    const productId = match[1];
    const summary = summaries[productId];
    const link = row.querySelector(".wl-product-rating-link");
    link.href = href.split("#")[0] + "#customer-reviews";
    link.replaceChildren();

    if (!summary) {
      link.textContent = "Be the first to review";
      link.title = "Review this product";
    } else {
      link.appendChild(buildCardStars(summary.average));
      link.appendChild(document.createTextNode(
        summary.average.toFixed(1) + " (" + summary.count + ")"
      ));
      link.title = "Read customer reviews";
    }
    row.classList.remove("wl-is-hidden");
  }

  function getCardProductId(card) {
    const link = card.querySelector("#ProductImageRow a[href*='ProductDetail.aspx']") ||
      card.querySelector("#ProductDescriptionRow a[href*='ProductDetail.aspx']");
    const match = (link?.href || "").match(/[?&]pid=(\d+)/i);
    return match ? match[1] : "";
  }

  function navigateTop(url) {
    try {
      window.top.location.href = url;
    } catch (error) {
      window.location.href = url;
    }
  }

  function fetchDocument(url) {
    return fetch(url, { credentials: "include" }).then(function (response) {
      if (!response.ok) throw new Error("Request returned " + response.status);
      return response.text();
    }).then(function (html) {
      return new DOMParser().parseFromString(html, "text/html");
    });
  }

  function loadSavedForLaterState() {
    if (savedForLaterStatePromise) return savedForLaterStatePromise;

    savedForLaterStatePromise = (async function () {
      if (getCustomerAccountState(null) === "signed-out") {
        return { detailUrl: "", productIds: new Set() };
      }

      const listDocument = await fetchDocument("/Quicklists_R.aspx");
      const savedLink = Array.from(listDocument.querySelectorAll("a")).find(function (link) {
        const text = String(link.textContent || "").trim();
        const href = link.getAttribute("href") || "";
        return /^Saved\s+For\s+Later$/i.test(text) && /Quicklists_R\.aspx|QuicklistDetails\.aspx/i.test(href);
      });
      if (!savedLink) return { detailUrl: "", productIds: new Set() };

      const detailUrl = new URL(savedLink.getAttribute("href"), window.location.origin).toString()
        .replace("QuicklistDetails.aspx", "Quicklists_R.aspx");
      const detailDocument = await fetchDocument(detailUrl);
      const productIds = new Set();
      detailDocument.querySelectorAll("a[href*='ProductDetail.aspx']").forEach(function (link) {
        const match = (link.getAttribute("href") || "").match(/[?&]pid=(\d+)/i);
        if (match) productIds.add(match[1]);
      });
      return { detailUrl: detailUrl, productIds: productIds };
    })().catch(function (error) {
      console.warn("Saved For Later state could not be loaded.", error);
      return { detailUrl: "", productIds: new Set() };
    });

    return savedForLaterStatePromise;
  }

  function applySavedHeartState(card, state) {
    const heart = card.querySelector(".wl-save-heart");
    const productId = getCardProductId(card);
    if (!heart || !productId) return;

    const isSaved = state.productIds.has(productId);
    heart.classList.toggle("is-saved", isSaved);
    heart.dataset.wlSaved = isSaved ? "true" : "false";
    if (state.detailUrl) heart.dataset.wlSavedListUrl = state.detailUrl;

    if (isSaved) {
      heart.setAttribute("aria-label", "Saved for later");
      heart.title = "Saved for later - view saved items";
    }
  }

  function getCustomerAccountState(quicklistRow) {
    try {
      if (localStorage.getItem("wl_user_id")) return "signed-in";
    } catch (error) {
      // Continue with page markers when storage is unavailable.
    }

    if (quicklistRow) {
      const hasSavedForLater = Array.from(quicklistRow.querySelectorAll(".quicklist-dropdown a")).some(function (link) {
        return /Saved\s+For\s+Later/i.test(String(link.textContent || ""));
      });
      if (hasSavedForLater) return "signed-in";
    }

    const accountLinks = Array.from(document.querySelectorAll("a"));
    const hasSignOut = accountLinks.some(function (link) {
      const text = String(link.textContent || "").trim();
      const href = link.getAttribute("href") || "";
      return /^(Sign Out|Log Out|Logout)$/i.test(text) || /SignOut\.aspx|Logout\.aspx/i.test(href);
    });
    if (hasSignOut) return "signed-in";

    const hasExplicitSignIn = accountLinks.some(function (link) {
      const text = String(link.textContent || "").trim();
      const href = link.getAttribute("href") || "";
      return /^Sign In$/i.test(text) && /SignIn\.aspx/i.test(href);
    });
    return hasExplicitSignIn ? "signed-out" : "unknown";
  }

  function configureSaveHeart(card, actions) {
    if (!actions) return;

    const quicklistRow = actions.querySelector("[id$='QuickListRow_TD']");
    const stockRow = actions.querySelector("[id$='StockRow_TD']");
    if (stockRow) stockRow.classList.add("wl-stock-action");
    if (!quicklistRow) return;

    quicklistRow.classList.add("wl-save-row");
    const heart = quicklistRow.querySelector("a[id*='QuickList_QuickListLink']");
    if (!heart) return;

    heart.classList.add("wl-save-heart");
    const accountState = getCustomerAccountState(quicklistRow);
    const label = accountState === "signed-out" ? "Sign in to save for later" : "Save for later";
    heart.setAttribute("aria-label", label);
    heart.title = label;
    const nativeLabel = heart.querySelector("span");
    if (nativeLabel) nativeLabel.textContent = label;

    const dropdownLinks = Array.from(quicklistRow.querySelectorAll(".quicklist-dropdown a"));
    dropdownLinks.forEach(function (link) {
      const text = String(link.textContent || "").trim();
      if (/Add to New List/i.test(text)) link.textContent = "Create a shopping list";
      if (/Edit Quicklists/i.test(text)) link.textContent = "Manage shopping lists";
    });

    if (heart.dataset.wlSaveReady === "true") return;
    heart.dataset.wlSaveReady = "true";
    heart.addEventListener("click", function (event) {
      const currentAccountState = getCustomerAccountState(quicklistRow);
      if (currentAccountState === "signed-out") {
        event.preventDefault();
        event.stopImmediatePropagation();
        try {
          sessionStorage.setItem("wl_save_after_signin", window.location.href);
        } catch (error) {
          // Navigation still works when storage is unavailable.
        }
        navigateTop("/SignIn.aspx?from=save_for_later");
        return;
      }

      if (heart.dataset.wlSaved === "true") {
        event.preventDefault();
        event.stopImmediatePropagation();
        navigateTop(heart.dataset.wlSavedListUrl || "/Quicklists_R.aspx");
        return;
      }

      const savedForLater = Array.from(quicklistRow.querySelectorAll(".quicklist-dropdown a")).find(function (link) {
        return /Saved\s+For\s+Later/i.test(String(link.textContent || ""));
      });
      if (!savedForLater) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      heart.classList.add("is-saving");
      heart.setAttribute("aria-label", "Saving for later");
      savedForLaterStatePromise = null;
      savedForLater.click();
    }, true);
  }

  function enhanceCard(card) {
    card.classList.add("wl-product-card");

    const actions = card.querySelector(":scope > .mx-2");
    if (actions) {
      actions.classList.add("wl-product-actions");
      configureSaveHeart(card, actions);
    }

    const quantity = card.querySelector("#QuantityRow input[type='text']");
    if (quantity) {
      quantity.setAttribute("aria-label", "Quantity");
      quantity.setAttribute("inputmode", "decimal");
      quantity.setAttribute("autocomplete", "off");
      if (!String(quantity.value || "").trim()) {
        const control = typeof window.$find === "function" ? window.$find(quantity.id) : null;
        if (control && typeof control.set_value === "function") {
          control.set_value("1");
        } else {
          quantity.value = "1";
          quantity.setAttribute("value", "1");
        }
      }
    }

    loadSavedForLaterState().then(function (state) {
      applySavedHeartState(card, state);
    });

    ensureRatingRow(card);
    loadReviewSummaries()
      .then(function (summaries) {
        renderCardRating(card, summaries);
      })
      .catch(function (error) {
        console.error("Product card reviews could not load.", error);
      });
  }

  function enhanceCards(root) {
    const cards = root.querySelectorAll
      ? root.querySelectorAll("#productlistcards > fieldset.CardSet")
      : [];
    cards.forEach(enhanceCard);
  }

  function redirectToPreferredProductPageSize() {
    if (window.top !== window.self || !/\/products\.aspx$/i.test(window.location.pathname)) return false;

    const url = new URL(window.location.href);
    if (url.searchParams.get("itemsPerPage") === String(PRODUCT_PAGE_SIZE)) return false;

    url.searchParams.set("itemsPerPage", String(PRODUCT_PAGE_SIZE));
    url.searchParams.set("pageIndex", "0");
    window.location.replace(url.toString());
    return true;
  }

  function enforceProductPageSize(url) {
    const productUrl = new URL(url, window.location.origin);
    productUrl.searchParams.set("itemsPerPage", String(PRODUCT_PAGE_SIZE));
    return productUrl.toString();
  }

  function getNextProductPageUrl(doc, baseUrl) {
    const currentUrl = new URL(baseUrl, window.location.origin);
    const currentIndex = Number.parseInt(currentUrl.searchParams.get("pageIndex") || "0", 10) || 0;
    const candidates = Array.from(doc.querySelectorAll("ul.pagination a[href*='pageIndex=']")).map(function (link) {
      try {
        const url = new URL(link.getAttribute("href"), currentUrl);
        const index = Number.parseInt(url.searchParams.get("pageIndex") || "0", 10) || 0;
        return { index: index, url: enforceProductPageSize(url) };
      } catch (error) {
        return null;
      }
    }).filter(function (candidate) {
      return candidate && candidate.index > currentIndex;
    }).sort(function (left, right) {
      return left.index - right.index;
    });
    return candidates.length ? candidates[0].url : "";
  }

  function prepareProductFrame(frame) {
    const frameDocument = frame.contentDocument;
    const frameWindow = frame.contentWindow;
    const grid = frameDocument?.querySelector("#productlistcards");
    const form = frameDocument?.forms?.[0];
    if (!frameDocument || !frameWindow || !grid || !form) return { ok: false, nextUrl: "" };

    const nextUrl = getNextProductPageUrl(frameDocument, frame.src);
    const hiddenInputs = Array.from(form.querySelectorAll("input[type='hidden']"));
    hiddenInputs.forEach(function (input) {
      form.appendChild(input);
    });
    form.appendChild(grid);
    Array.from(form.children).forEach(function (child) {
      const keepHiddenInput = child.tagName === "INPUT" && child.type === "hidden";
      if (child !== grid && !keepHiddenInput) child.remove();
    });
    frameDocument.body.replaceChildren(form);
    frameDocument.body.classList.add("wl-infinite-frame-body");

    const frameStyle = frameDocument.createElement("style");
    frameStyle.textContent = `
      html, body {
        width: 100% !important;
        min-width: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        background: transparent !important;
      }
      body > :not(form) { display: none !important; }
      form {
        display: block !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      form > input[type="hidden"] { display: none !important; }
      form > :not(#productlistcards):not(input[type="hidden"]) { display: none !important; }
      #productlistcards.Cards { margin-bottom: 0 !important; }
    `;
    frameDocument.head.appendChild(frameStyle);

    grid.querySelectorAll("a[href*='ProductDetail.aspx'], a[href*='Quicklists_R.aspx']").forEach(function (link) {
      link.target = "_top";
    });

    const resize = function () {
      const height = Math.max(grid.scrollHeight, form.scrollHeight, 420);
      frame.style.height = Math.ceil(height + 2) + "px";
    };
    resize();
    frameDocument.querySelectorAll("img").forEach(function (image) {
      if (!image.complete) image.addEventListener("load", resize, { once: true });
    });
    if (typeof frameWindow.ResizeObserver === "function") {
      const observer = new frameWindow.ResizeObserver(resize);
      observer.observe(grid);
      frame._wlResizeObserver = observer;
    }
    frameWindow.setTimeout(resize, 800);
    frameWindow.setTimeout(resize, 3000);
    return { ok: true, nextUrl: nextUrl };
  }

  function initializeRelatedCategories() {
    const groupPanel = document.querySelector("#ctl00_PageBody_ProductGroupDrillDownPanel");
    const productGrid = document.querySelector("#productlistcards");
    const filter = document.querySelector("#ctl00_PageBody_ProductFilterDiv");
    const filterButton = document.querySelector("button.filter-button");
    if (!groupPanel || !productGrid || !filter || !filterButton) return;

    const details = document.createElement("details");
    details.className = "wl-related-categories";
    const summary = document.createElement("summary");
    summary.textContent = "Shop by subcategory";
    details.append(summary, groupPanel);

    let mobileLayout;
    const syncLayout = function () {
      const isMobile = window.matchMedia("(max-width: 899px)").matches;
      if (mobileLayout === isMobile && details.isConnected) return;
      mobileLayout = isMobile;

      if (isMobile) {
        filterButton.insertAdjacentElement("afterend", details);
        details.open = false;
      } else {
        filter.insertBefore(details, filter.children[1] || null);
        details.open = true;
      }
    };

    syncLayout();
    window.addEventListener("resize", syncLayout, { passive: true });
  }

  function initializeInfiniteScroll() {
    if (window.top !== window.self || document.getElementById("wl-infinite-products")) return;

    const grid = document.querySelector("#productlistcards");
    if (!grid) return;

    let nextUrl = getNextProductPageUrl(document, window.location.href);
    if (!nextUrl) return;

    document.body.classList.add("wl-infinite-products-active");
    const container = document.createElement("div");
    container.id = "wl-infinite-products";
    const status = document.createElement("div");
    status.id = "wl-infinite-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const retry = document.createElement("button");
    retry.id = "wl-infinite-retry";
    retry.type = "button";
    retry.textContent = "Load more products";
    retry.hidden = true;
    const sentinel = document.createElement("div");
    sentinel.id = "wl-infinite-sentinel";
    sentinel.setAttribute("aria-hidden", "true");
    container.append(status, retry, sentinel);
    grid.insertAdjacentElement("afterend", container);

    let loading = false;
    let observer;
    const supportsObserver = typeof window.IntersectionObserver === "function";
    const loadNextPage = function () {
      if (loading || !nextUrl) return;
      loading = true;
      retry.hidden = true;
      status.textContent = "Loading more products...";
      container.setAttribute("aria-busy", "true");

      const sourceUrl = nextUrl;
      nextUrl = "";
      const scrollTopBeforeLoad = window.scrollY;
      const frame = document.createElement("iframe");
      frame.className = "wl-product-page-frame";
      frame.title = "Additional product results";
      frame.setAttribute("scrolling", "no");
      frame.setAttribute("tabindex", "-1");
      frame.src = sourceUrl;
      container.insertBefore(frame, status);

      let initialLoadHandled = false;
      const finishFailedLoad = function (message) {
        if (initialLoadHandled) return;
        initialLoadHandled = true;
        loading = false;
        frame.remove();
        nextUrl = sourceUrl;
        container.removeAttribute("aria-busy");
        status.textContent = message;
        retry.hidden = false;
      };
      const loadTimeout = window.setTimeout(function () {
        finishFailedLoad("More products are taking longer than expected. Try again when ready.");
      }, PRODUCT_PAGE_LOAD_TIMEOUT_MS);

      frame.addEventListener("load", function () {
        if (initialLoadHandled) return;
        const result = prepareProductFrame(frame);
        initialLoadHandled = true;
        window.clearTimeout(loadTimeout);
        loading = false;
        container.removeAttribute("aria-busy");

        if (!result.ok) {
          frame.remove();
          nextUrl = sourceUrl;
          status.textContent = "More products could not be loaded.";
          retry.hidden = false;
          return;
        }

        if (document.activeElement === frame) {
          frame.blur();
          window.scrollTo(0, scrollTopBeforeLoad);
        }
        frame.classList.add("is-ready");
        nextUrl = result.nextUrl;
        status.textContent = nextUrl ? "" : "All products loaded.";
        if (!nextUrl && observer) observer.disconnect();
        if (nextUrl && !supportsObserver) retry.hidden = false;
      });
      frame.addEventListener("error", function () {
        window.clearTimeout(loadTimeout);
        finishFailedLoad("More products could not be loaded. Try again when ready.");
      }, { once: true });
    };

    retry.addEventListener("click", loadNextPage);
    if (supportsObserver) {
      observer = new IntersectionObserver(function (entries) {
        if (entries.some(function (entry) { return entry.isIntersecting; })) loadNextPage();
      }, { rootMargin: "1400px 0px" });
      observer.observe(sentinel);
    }

    loadNextPage();
  }

  function initialize() {
    if (/\/products\.aspx$/i.test(window.location.pathname)) {
      document.body.classList.add("wl-products-48");
    }
    enhanceCards(document);
    initializeRelatedCategories();

    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.matches && node.matches("#productlistcards > fieldset.CardSet")) {
            enhanceCard(node);
          }
          enhanceCards(node);
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  installStyles();

  if (redirectToPreferredProductPageSize()) return;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
