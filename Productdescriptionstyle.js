(function (document) {
  "use strict";

  if (!document || document.getElementById("wl-product-content-css")) return;

  var style = document.createElement("style");
  style.id = "wl-product-content-css";
  style.textContent = `
    .wl-product-content {
      width: 100%;
      margin: 8px 0 30px;
      padding: 22px 0 0;
      border-top: 3px solid #6b0016;
      color: #252a30;
      font-family: Arial, sans-serif;
    }

    .wl-product-content__title {
      margin: 0 0 20px;
      color: #20262d;
      font-size: clamp(1.45rem, 2.4vw, 1.9rem);
      font-weight: 850;
      line-height: 1.2;
    }

    .wl-product-content__section + .wl-product-content__section {
      margin-top: 24px;
    }

    .wl-product-content__heading {
      margin: 0 0 10px;
      color: #343a40;
      font-size: 1.05rem;
      font-weight: 800;
      line-height: 1.3;
    }

    .wl-product-content__description {
      max-width: 80ch;
      margin: 0 0 10px;
      color: #434b54;
      font-size: 1rem;
      line-height: 1.65;
    }

    .wl-product-content__features {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 22px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .wl-product-content__features li {
      position: relative;
      min-width: 0;
      padding: 0 0 0 20px;
      color: #343b43;
      line-height: 1.5;
    }

    .wl-product-content__features li::before {
      position: absolute;
      top: .55em;
      left: 2px;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #6b0016;
      content: "";
    }

    .wl-product-content__specifications {
      width: 100%;
      margin: 0;
      overflow: hidden;
      border: 1px solid #d9dde1;
      border-radius: 7px;
      background: #fff;
    }

    .wl-product-content__specification {
      display: grid;
      grid-template-columns: minmax(150px, .7fr) minmax(0, 1.3fr);
      margin: 0;
    }

    .wl-product-content__specification + .wl-product-content__specification {
      border-top: 1px solid #e3e6e9;
    }

    .wl-product-content__specification:nth-child(even) {
      background: #f7f8f9;
    }

    .wl-product-content__specification dt,
    .wl-product-content__specification dd {
      min-width: 0;
      margin: 0;
      padding: 11px 14px;
      overflow-wrap: anywhere;
      line-height: 1.4;
    }

    .wl-product-content__specification dt {
      color: #343a40;
      font-weight: 750;
    }

    .wl-product-content__specification dd {
      color: #4d555e;
    }

    .wl-product-content__resources {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .wl-product-content__resource {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      min-height: 42px;
      padding: 9px 13px;
      border: 1px solid #cbd0d5;
      border-radius: 6px;
      background: #fff;
      color: #6b0016;
      font-weight: 750;
      line-height: 1.3;
      text-decoration: none;
    }

    .wl-product-content__resource:hover,
    .wl-product-content__resource:focus-visible {
      border-color: #6b0016;
      background: #fff7f8;
      color: #6b0016;
      text-decoration: underline;
    }

    .wl-product-content__resource:focus-visible {
      outline: 3px solid rgba(107, 0, 22, .22);
      outline-offset: 2px;
    }

    .wl-product-content__resource-icon {
      font-size: 1.05em;
      line-height: 1;
    }

    @media (max-width: 767px) {
      .wl-product-content {
        margin-bottom: 24px;
        padding-top: 18px;
      }

      .wl-product-content__features {
        grid-template-columns: minmax(0, 1fr);
      }

      .wl-product-content__specification {
        grid-template-columns: minmax(0, 1fr);
      }

      .wl-product-content__specification dt {
        padding-bottom: 3px;
      }

      .wl-product-content__specification dd {
        padding-top: 3px;
      }

      .wl-product-content__resources,
      .wl-product-content__resources li,
      .wl-product-content__resource {
        width: 100%;
      }
    }
  `;
  document.head.appendChild(style);
})(document);
