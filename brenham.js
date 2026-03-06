(function () {
  "use strict";

  var LOG = "[WL Brenham]";
  var loc = window.location;
  var path = (loc.pathname || "").toLowerCase();
  var params = new URLSearchParams(loc.search || "");
  var pg = (params.get("pg") || "").trim();
  var pl1 = (params.get("pl1") || "").trim();

  console.log(LOG, "loaded");
  console.log(LOG, "href:", loc.href);

  if (!path.includes("products.aspx")) {
    console.log(LOG, "Not on Products.aspx. Exiting.");
    return;
  }

  // Brenham store product group only
  if (!(pg === "4733" || pl1 === "4733")) {
    console.log(LOG, "Not Brenham product group. Exiting.");
    return;
  }

  var store = {
    name: "Brenham",
    company: "Woodson Lumber Co. of Brenham",
    phoneDisplay: "(979) 836-7933",
    phoneHref: "tel:+19798367933",
    address1: "301 E. Clinton St.",
    address2: "Brenham, TX 77833",
    directionsUrl: "https://www.google.com/maps/search/?api=1&query=301+E.+Clinton+St.+Brenham+TX+77833",
    reviewUrl: "https://g.page/r/CfQ5jL2A8vA5EBM/review",
    shopUrl: "/Products.aspx",
    makeMyStoreUrl: "/AccountSettings.aspx?cms=1",
    heroImage: "https://static.wixstatic.com/media/08f6fd_447518369a884dbf9e64c8e6f7c64d6b~mv2.jpg",
    hours: [
      { label: "Monday - Friday", value: "7:30am - 5:30pm" },
      { label: "Saturday", value: "7:30am - 12:00pm" },
      { label: "Sunday", value: "Closed" }
    ],
    features: [
      {
        title: "Same-Day In-Store Pickup",
        text: "Available on in-stock items so you can get what you need and keep the job moving."
      },
      {
        title: "Curbside Pickup Available",
        text: "Convenient pickup options help customers get in and out quickly."
      },
      {
        title: "Delivery Available",
        text: "From planned projects to everyday needs, delivery support helps extend the store to your jobsite."
      }
    ],
    intro:
      "From building materials and lumber to everyday hardware needs, Brenham is one of Woodson’s local store pages where we can highlight branch-specific services, shopping paths, and community presence."
  };

  function injectStyles() {
    if (document.getElementById("wl-brenham-styles")) return;

    var css = `
      #MainLayoutRow {
        display: block !important;
      }

      #wl-brenham-root {
        width: 100%;
        max-width: 1440px;
        margin: 0 auto;
        padding: 20px;
        box-sizing: border-box;
        font-family: Arial, Helvetica, sans-serif;
        color: #222;
      }

      .wlb-breadcrumb {
        margin: 4px 0 18px;
        font-size: 14px;
      }

      .wlb-breadcrumb a {
        color: #6b0014;
        text-decoration: none;
        font-weight: 700;
      }

      .wlb-breadcrumb a:hover {
        text-decoration: underline;
      }

      .wlb-hero {
        display: grid;
        grid-template-columns: 1.15fr 0.85fr;
        gap: 22px;
        align-items: stretch;
        margin-bottom: 24px;
      }

      .wlb-hero-copy {
        background: linear-gradient(135deg, #6b0014 0%, #8c1630 100%);
        color: #fff;
        border-radius: 22px;
        padding: 30px 28px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.14);
      }

      .wlb-kicker {
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 1.4px;
        opacity: 0.9;
        margin-bottom: 10px;
      }

      .wlb-title {
        font-size: 42px;
        line-height: 1.04;
        font-weight: 800;
        margin: 0 0 12px;
      }

      .wlb-subtitle {
        font-size: 17px;
        line-height: 1.6;
        margin: 0 0 18px;
        max-width: 760px;
        opacity: 0.96;
      }

      .wlb-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 18px;
      }

      .wlb-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 46px;
        padding: 12px 18px;
        border-radius: 999px;
        text-decoration: none;
        font-weight: 800;
        border: 1px solid transparent;
        transition: all 0.18s ease;
      }

      .wlb-btn-primary {
        background: #ffffff;
        color: #6b0014;
      }

      .wlb-btn-primary:hover {
        background: #f5eef0;
        color: #540010;
      }

      .wlb-btn-secondary {
        background: transparent;
        color: #ffffff;
        border-color: rgba(255,255,255,0.55);
      }

      .wlb-btn-secondary:hover {
        background: rgba(255,255,255,0.1);
        color: #ffffff;
      }

      .wlb-quickfacts {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        margin-top: 22px;
      }

      .wlb-fact {
        background: rgba(255,255,255,0.12);
        border: 1px solid rgba(255,255,255,0.16);
        border-radius: 16px;
        padding: 14px;
      }

      .wlb-fact-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 1.2px;
        opacity: 0.85;
        margin-bottom: 6px;
      }

      .wlb-fact-value {
        font-size: 15px;
        line-height: 1.45;
        font-weight: 700;
      }

      .wlb-hero-media {
        min-height: 100%;
        border-radius: 22px;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0,0,0,0.10);
        background: #f3f3f3;
      }

      .wlb-hero-media img {
        display: block;
        width: 100%;
        height: 100%;
        min-height: 420px;
        object-fit: cover;
      }

      .wlb-main-grid {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 22px;
        margin-bottom: 24px;
      }

      .wlb-card {
        background: #fff;
        border: 1px solid #e8e8e8;
        border-radius: 18px;
        padding: 22px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.05);
      }

      .wlb-card h2 {
        margin: 0 0 14px;
        font-size: 26px;
        line-height: 1.15;
        color: #1f1f1f;
      }

      .wlb-card p {
        margin: 0 0 14px;
        font-size: 15px;
        line-height: 1.7;
        color: #444;
      }

      .wlb-info-list {
        display: grid;
        gap: 14px;
      }

      .wlb-info-row {
        display: grid;
        grid-template-columns: 130px 1fr;
        gap: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid #efefef;
      }

      .wlb-info-row:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }

      .wlb-info-label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 1.1px;
        color: #777;
        font-weight: 800;
      }

      .wlb-info-value,
      .wlb-info-value a {
        font-size: 16px;
        color: #222;
        text-decoration: none;
        font-weight: 700;
      }

      .wlb-info-value a:hover {
        color: #6b0014;
      }

      .wlb-hours {
        display: grid;
        gap: 12px;
      }

      .wlb-hours-row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 0;
        border-bottom: 1px solid #efefef;
      }

      .wlb-hours-row:last-child {
        border-bottom: none;
      }

      .wlb-hours-day {
        font-weight: 700;
        color: #222;
      }

      .wlb-hours-time {
        color: #555;
        font-weight: 700;
        text-align: right;
      }

      .wlb-feature-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
      }

      .wlb-feature {
        background: #fff;
        border: 1px solid #e8e8e8;
        border-radius: 18px;
        padding: 22px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.05);
      }

      .wlb-feature h3 {
        margin: 0 0 10px;
        font-size: 21px;
        line-height: 1.2;
        color: #6b0014;
      }

      .wlb-feature p {
        margin: 0;
        font-size: 15px;
        line-height: 1.7;
        color: #444;
      }

      .wlb-bottom-cta {
        margin-top: 24px;
        background: #f7f2f3;
        border: 1px solid #eadcdf;
        border-radius: 22px;
        padding: 26px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 18px;
      }

      .wlb-bottom-cta-copy h2 {
        margin: 0 0 8px;
        font-size: 28px;
        color: #222;
      }

      .wlb-bottom-cta-copy p {
        margin: 0;
        color: #4c4c4c;
        font-size: 15px;
        line-height: 1.7;
      }

      .wlb-bottom-cta-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      .wlb-bottom-cta .wlb-btn-primary {
        background: #6b0014;
        color: #fff;
      }

      .wlb-bottom-cta .wlb-btn-primary:hover {
        background: #540010;
        color: #fff;
      }

      .wlb-bottom-cta .wlb-btn-secondary {
        color: #6b0014;
        border-color: #6b0014;
        background: #fff;
      }

      .wlb-bottom-cta .wlb-btn-secondary:hover {
        background: #f9f4f5;
      }

      @media (max-width: 1100px) {
        .wlb-hero,
        .wlb-main-grid,
        .wlb-feature-grid {
          grid-template-columns: 1fr;
        }

        .wlb-quickfacts {
          grid-template-columns: 1fr;
        }

        .wlb-hero-media img {
          min-height: 300px;
        }

        .wlb-bottom-cta {
          flex-direction: column;
          align-items: flex-start;
        }
      }

      @media (max-width: 700px) {
        #wl-brenham-root {
          padding: 14px;
        }

        .wlb-hero-copy,
        .wlb-card,
        .wlb-feature,
        .wlb-bottom-cta {
          padding: 18px;
        }

        .wlb-title {
          font-size: 32px;
        }

        .wlb-info-row {
          grid-template-columns: 1fr;
          gap: 6px;
        }

        .wlb-hours-row {
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
        }

        .wlb-hours-time {
          text-align: left;
        }
      }
    `;

    var style = document.createElement("style");
    style.id = "wl-brenham-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function setPrettyUrl() {
    try {
      window.history.replaceState(
        { wlPrettyRoute: "store-brenham" },
        "",
        "/Default.aspx?view=store-brenham"
      );
      console.log(LOG, "Pretty URL applied.");
    } catch (e) {
      console.warn(LOG, "replaceState failed:", e);
    }
  }

  function buildHoursMarkup() {
    return store.hours.map(function (row) {
      return [
        '<div class="wlb-hours-row">',
        '  <div class="wlb-hours-day">' + row.label + "</div>",
        '  <div class="wlb-hours-time">' + row.value + "</div>",
        "</div>"
      ].join("");
    }).join("");
  }

  function buildFeaturesMarkup() {
    return store.features.map(function (item) {
      return [
        '<div class="wlb-feature">',
        "  <h3>" + item.title + "</h3>",
        "  <p>" + item.text + "</p>",
        "</div>"
      ].join("");
    }).join("");
  }

  function buildMarkup() {
    return [
      '<div id="wl-brenham-root">',
      '  <div class="wlb-breadcrumb"><a href="/Default.aspx?view=storelocations">← Back to Store Locations</a></div>',

      '  <section class="wlb-hero">',
      '    <div class="wlb-hero-copy">',
      '      <div class="wlb-kicker">Woodson Lumber Location</div>',
      '      <h1 class="wlb-title">' + store.name + "</h1>",
      '      <p class="wlb-subtitle">' + store.intro + "</p>",
      '      <div class="wlb-actions">',
      '        <a class="wlb-btn wlb-btn-primary" href="' + store.shopUrl + '">Shop This Store</a>',
      '        <a class="wlb-btn wlb-btn-secondary" href="' + store.makeMyStoreUrl + '">Make This My Store</a>',
      "      </div>",
      '      <div class="wlb-quickfacts">',
      '        <div class="wlb-fact"><div class="wlb-fact-label">Phone</div><div class="wlb-fact-value"><a href="' + store.phoneHref + '" style="color:#fff;text-decoration:none;">' + store.phoneDisplay + "</a></div></div>",
      '        <div class="wlb-fact"><div class="wlb-fact-label">Address</div><div class="wlb-fact-value">' + store.address1 + "<br>" + store.address2 + "</div></div>",
      '        <div class="wlb-fact"><div class="wlb-fact-label">Pickup</div><div class="wlb-fact-value">Same-Day In-Store Pickup Available</div></div>",
      "      </div>",
      "    </div>",
      '    <div class="wlb-hero-media">',
      '      <img src="' + store.heroImage + '" alt="Woodson Lumber Brenham store photo">',
      "    </div>",
      "  </section>",

      '  <section class="wlb-main-grid">',
      '    <div class="wlb-card">',
      "      <h2>Contact & Store Details</h2>",
      '      <div class="wlb-info-list">',
      '        <div class="wlb-info-row"><div class="wlb-info-label">Location</div><div class="wlb-info-value">' + store.company + "</div></div>",
      '        <div class="wlb-info-row"><div class="wlb-info-label">Phone</div><div class="wlb-info-value"><a href="' + store.phoneHref + '">' + store.phoneDisplay + "</a></div></div>",
      '        <div class="wlb-info-row"><div class="wlb-info-label">Address</div><div class="wlb-info-value">' + store.address1 + "<br>" + store.address2 + "</div></div>",
      '        <div class="wlb-info-row"><div class="wlb-info-label">Directions</div><div class="wlb-info-value"><a href="' + store.directionsUrl + '" target="_blank" rel="noopener">Open in Maps</a></div></div>',
      '        <div class="wlb-info-row"><div class="wlb-info-label">Review Us</div><div class="wlb-info-value"><a href="' + store.reviewUrl + '" target="_blank" rel="noopener">Leave a Review</a></div></div>',
      "      </div>",
      "    </div>",

      '    <div class="wlb-card">',
      "      <h2>Store Hours</h2>",
      '      <div class="wlb-hours">' + buildHoursMarkup() + "</div>",
      "    </div>",
      "  </section>",

      '  <section class="wlb-feature-grid">' + buildFeaturesMarkup() + "</section>",

      '  <section class="wlb-bottom-cta">',
      '    <div class="wlb-bottom-cta-copy">',
      "      <h2>Ready to shop Brenham?</h2>",
      "      <p>Use this location page as the branch hub for Brenham-specific shopping, local updates, featured departments, and services.</p>",
      "    </div>",
      '    <div class="wlb-bottom-cta-actions">',
      '      <a class="wlb-btn wlb-btn-primary" href="' + store.shopUrl + '">Start Shopping</a>',
      '      <a class="wlb-btn wlb-btn-secondary" href="/Default.aspx?view=storelocations">All Locations</a>',
      "    </div>",
      "  </section>",
      "</div>"
    ].join("");
  }

  function render() {
    injectStyles();

    var container = document.getElementById("MainLayoutRow");
    if (!container) {
      console.warn(LOG, "#MainLayoutRow not found.");
      return;
    }

    console.log(LOG, "Rendering into #MainLayoutRow");
    container.innerHTML = buildMarkup();
    setPrettyUrl();
    console.log(LOG, "Brenham page rendered.");
  }

  function waitForContainerThenRender() {
    var tries = 0;
    var maxTries = 50;

    var iv = setInterval(function () {
      tries++;

      if (document.getElementById("MainLayoutRow")) {
        clearInterval(iv);
        render();
        return;
      }

      if (tries >= maxTries) {
        clearInterval(iv);
        console.warn(LOG, "Timed out waiting for #MainLayoutRow.");
      }
    }, 200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", waitForContainerThenRender, { once: true });
  } else {
    waitForContainerThenRender();
  }
})();
