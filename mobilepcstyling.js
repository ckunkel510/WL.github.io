  document.addEventListener("DOMContentLoaded", function () {
    const style = document.createElement("style");

    const css = `
      @media (max-width: 768px) {
        table.ProductCard {
          width: 100% !important;
          margin-bottom: 20px !important;
          border-collapse: separate !important;
          border-spacing: 0 !important;
          border: 1px solid #ddd !important;
          border-radius: 6px !important;
          overflow: hidden !important;
        }

        table.ProductCard td {
          display: block !important;
          width: 100% !important;
          text-align: center !important;
          box-sizing: border-box !important;
          padding: 10px !important;
        }

        table.ProductCard .productImageCell img {
          max-width: 100% !important;
          height: auto !important;
          margin: 0 auto !important;
        }

        table.ProductCard .productDescriptionRow {
          font-size: 1.05em !important;
          font-weight: bold !important;
        }

        table.ProductCard #PriceRow,
        table.ProductCard #BulkPricingRow,
        table.ProductCard #LocalStockRow,
        table.ProductCard #QuantityRow {
          font-size: 1em !important;
        }

        table.ProductCard input[type="text"] {
          width: 100% !important;
          max-width: 120px !important;
          margin: 0 auto !important;
        }

        table.ProductCard .riSingle {
          display: inline-block !important;
        }
      }

      @media (max-width: 480px) {
        table.ProductCard .productDescriptionRow {
          font-size: 1em !important;
        }

        table.ProductCard #PriceRow,
        table.ProductCard #BulkPricingRow,
        table.ProductCard #LocalStockRow {
          font-size: 0.95em !important;
        }
      }
    `;

    style.textContent = css;
    document.head.appendChild(style);

    console.log("[ResponsiveCard] Stylesheet injected ✅");

    // Confirm application by checking computed style on first card
    const firstCard = document.querySelector("table.ProductCard");

    if (firstCard) {
      console.log("[ResponsiveCard] First ProductCard found ✅");

      const sampleTd = firstCard.querySelector("td");
      const compStyle = window.getComputedStyle(sampleTd);

      console.log("[ResponsiveCard] Sample <td> styles:", {
        display: compStyle.display,
        width: compStyle.width,
        textAlign: compStyle.textAlign,
        padding: compStyle.padding,
      });

    } else {
      console.warn("[ResponsiveCard] No .ProductCard table found ❌");
    }
  });

