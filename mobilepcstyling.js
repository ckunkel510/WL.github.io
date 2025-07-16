  document.addEventListener("DOMContentLoaded", function () {
    const style = document.createElement("style");
    style.innerHTML = `
      @media (max-width: 768px) {
        table.ProductCard {
          width: 100% !important;
          margin-bottom: 20px;
          border-collapse: separate;
          border-spacing: 0;
          border: 1px solid #ddd;
          border-radius: 6px;
          overflow: hidden;
        }

        table.ProductCard td {
          display: block;
          width: 100% !important;
          text-align: center !important;
          box-sizing: border-box;
          padding: 10px;
        }

        table.ProductCard .productImageCell img {
          max-width: 100%;
          height: auto;
          margin: 0 auto;
        }

        table.ProductCard .productDescriptionRow {
          font-size: 1.05em;
          font-weight: bold;
        }

        table.ProductCard #PriceRow,
        table.ProductCard #BulkPricingRow,
        table.ProductCard #LocalStockRow,
        table.ProductCard #QuantityRow {
          font-size: 1em;
        }

        table.ProductCard input[type="text"] {
          width: 100% !important;
          max-width: 120px;
          margin: 0 auto;
        }

        table.ProductCard .riSingle {
          display: inline-block;
        }
      }

      @media (max-width: 480px) {
        table.ProductCard .productDescriptionRow {
          font-size: 1em;
        }

        table.ProductCard #PriceRow,
        table.ProductCard #BulkPricingRow,
        table.ProductCard #LocalStockRow {
          font-size: 0.95em;
        }
      }
    `;
    document.head.appendChild(style);
    console.log("[ResponsiveCard] Mobile layout styles injected.");
  });
