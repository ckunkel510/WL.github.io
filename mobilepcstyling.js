(function () {
  "use strict";

  const STYLE_ID = "wl-modern-product-cards";

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

      #productlistcards .wl-product-card #QuantityValidatorAndAddButtonRow td {
        padding: 0 16px !important;
      }

      #productlistcards .wl-product-card > .wl-product-actions {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 8px;
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
        grid-column: 1 / -1;
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

      #productlistcards .wl-product-actions a[title="Show Stock Levels for Product"] {
        display: flex !important;
      }

      #productlistcards .wl-product-actions a span {
        display: inline !important;
      }

      #productlistcards .wl-product-actions .quicklist-wrap {
        position: relative;
        z-index: 20;
      }

      #productlistcards .wl-product-actions .quicklist-dropdown {
        box-sizing: border-box;
        width: max-content !important;
        min-width: 170px;
        max-width: calc(100vw - 32px);
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

  function enhanceCard(card) {
    card.classList.add("wl-product-card");

    const actions = card.querySelector(":scope > .mx-2");
    if (actions) actions.classList.add("wl-product-actions");

    const quantity = card.querySelector("#QuantityRow input[type='text']");
    if (quantity) {
      quantity.setAttribute("aria-label", "Quantity");
      quantity.setAttribute("inputmode", "decimal");
      quantity.setAttribute("autocomplete", "off");
    }
  }

  function enhanceCards(root) {
    const cards = root.querySelectorAll
      ? root.querySelectorAll("#productlistcards > fieldset.CardSet")
      : [];
    cards.forEach(enhanceCard);
  }

  function initialize() {
    enhanceCards(document);

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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
