(function () {
  "use strict";

  var LOG = "[WL StorePage]";
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

  var stores = {
    "4733": {
      pg: "4733",
      view: "store-brenham",
      slug: "brenham",
      name: "Brenham",
      company: "Woodson Lumber Co. of Brenham",
      phoneLabel: "Phone",
      phoneDisplay: "(979) 836-7933",
      phoneHref: "tel:+19798367933",
      address1: "301 E. Clinton St.",
      cityStateZip: "Brenham, TX 77833",
      directionsUrl: "https://www.google.com/maps/search/?api=1&query=301+E.+Clinton+St.+Brenham+TX+77833",
      shopUrl: "/Products.aspx",
      makeMyStoreUrl: "/AccountSettings.aspx?cms=1",
      reviewUrl: "#",
      heroImage: "https://static.wixstatic.com/media/aba64d_e4bef13eccc0407385a7152fcff2f035~mv2.png/v1/crop/x_128%2Cy_20%2Cw_1126%2Ch_516/fill/w_980%2Ch_456%2Cal_c%2Cq_95%2Cusm_0.66_1.00_0.01%2Cenc_avif%2Cquality_auto/aba64d_e4bef13eccc0407385a7152fcff2f035~mv2.png",
      intro:
        "Brenham is built to serve homeowners, DIY customers, and pros with the lumber, hardware, and project support they need from a local team they know.",
      hours: [
        { label: "Monday - Friday", value: "7:30am - 5:30pm" },
        { label: "Saturday", value: "7:30am - 12:00pm" },
        { label: "Sunday", value: "Closed" }
      ]
    },

    "4734": {
      pg: "4734",
      view: "store-bryan",
      slug: "bryan",
      name: "Bryan",
      company: "Woodson Lumber &Hardware Bryan",
      phoneLabel: "Phone / Call & Text",
      phoneDisplay: "(979) 822-3765",
      phoneHref: "tel:+19798223765",
      address1: "105 Pease St.",
      cityStateZip: "Bryan, TX 77803",
      directionsUrl: "https://www.google.com/maps/search/?api=1&query=105+Pease+St.+Bryan+TX+77803",
      shopUrl: "/Products.aspx",
      makeMyStoreUrl: "/AccountSettings.aspx?cms=1",
      reviewUrl: "#",
      heroImage: "https://static.wixstatic.com/media/aba64d_bac1afac1160451b8a1872fbdbde7363~mv2.png/v1/crop/x_144%2Cy_0%2Cw_1191%2Ch_554/fill/w_980%2Ch_456%2Cal_c%2Cq_95%2Cusm_0.66_1.00_0.01%2Cenc_avif%2Cquality_auto/store-bryan.png",
      intro:
        "Bryan is positioned as a contractor-friendly lumber yard and hardware location with convenient pickup, delivery support, and strong day-to-day project coverage.",
      hours: [
        { label: "Monday - Friday", value: "7:30am - 5:30pm" },
        { label: "Saturday", value: "7:30am - 12:00pm" },
        { label: "Sunday", value: "Closed" }
      ]
    },

    "4735": {
      pg: "4735",
      view: "store-caldwell",
      slug: "caldwell",
      name: "Caldwell",
      company: "Woodson Lumber Co. of Caldwell",
      phoneLabel: "Phone",
      phoneDisplay: "(979) 567-9805",
      phoneHref: "tel:+19795679805",
      address1: "702 W. Buck St.",
      cityStateZip: "Caldwell, TX 77836",
      directionsUrl: "https://www.google.com/maps/search/?api=1&query=702+W.+Buck+St.+Caldwell+TX+77836",
      shopUrl: "/Products.aspx",
      makeMyStoreUrl: "/AccountSettings.aspx?cms=1",
      reviewUrl: "#",
      heroImage: "https://static.wixstatic.com/media/aba64d_10d6752e582f4cf5b147bef46f4ee4a2~mv2.png/v1/crop/x_144%2Cy_0%2Cw_1191%2Ch_554/fill/w_980%2Ch_456%2Cal_c%2Cq_95%2Cusm_0.66_1.00_0.01%2Cenc_avif%2Cquality_auto/store-caldwell.png",
      intro:
        "Caldwell serves as a full local hardware and lumber store with paint, garden, pickup, and delivery support for both quick needs and larger projects.",
      hours: [
        { label: "Monday - Friday", value: "7:30am - 5:30pm" },
        { label: "Saturday", value: "7:30am - 4:00pm" },
        { label: "Sunday", value: "Closed" }
      ]
    },

    "4736": {
      pg: "4736",
      view: "store-lexington",
      slug: "lexington",
      name: "Lexington",
      company: "Woodson Lumber Co. of Lexington",
      phoneLabel: "Phone",
      phoneDisplay: "(979) 773-2238",
      phoneHref: "tel:+19797732238",
      address1: "8714 N. Hwy. 77",
      cityStateZip: "Lexington, TX 78947",
      directionsUrl: "https://www.google.com/maps/search/?api=1&query=8714+N.+Hwy.+77+Lexington+TX+78947",
      shopUrl: "/Products.aspx",
      makeMyStoreUrl: "/AccountSettings.aspx?cms=1",
      reviewUrl: "#",
      heroImage: "https://static.wixstatic.com/media/aba64d_5d638a9ba44446ab879100b3e51c3d19~mv2.png/v1/crop/x_144%2Cy_0%2Cw_1191%2Ch_554/fill/w_980%2Ch_456%2Cal_c%2Cq_95%2Cusm_0.66_1.00_0.01%2Cenc_avif%2Cquality_auto/store-lexington.png",
      intro:
        "Lexington combines local hardware and lumber access with delivery support and a straightforward pickup experience for customers across the surrounding area.",
      hours: [
        { label: "Monday - Friday", value: "7:30am - 5:30pm" },
        { label: "Saturday", value: "7:30am - 4:00pm" },
        { label: "Sunday", value: "Closed" }
      ]
    },

    "4737": {
      pg: "4737",
      view: "store-groesbeck",
      slug: "groesbeck",
      name: "Groesbeck",
      company: "Woodson Lumber & Hardware Groesbeck",
      phoneLabel: "Phone",
      phoneDisplay: "(254) 729-2865",
      phoneHref: "tel:+12547292865",
      address1: "1219 E. Yeagua St.",
      cityStateZip: "Groesbeck, TX 76642",
      directionsUrl: "https://www.google.com/maps/search/?api=1&query=1219+E.+Yeagua+St.+Groesbeck+TX+76642",
      shopUrl: "/Products.aspx",
      makeMyStoreUrl: "/AccountSettings.aspx?cms=1",
      reviewUrl: "#",
      heroImage: "https://static.wixstatic.com/media/aba64d_9c60a78b90c1467d9a82f162181f0f3e~mv2.png/v1/crop/x_144%2Cy_0%2Cw_1191%2Ch_554/fill/w_980%2Ch_456%2Cal_c%2Cq_95%2Cusm_0.66_1.00_0.01%2Cenc_avif%2Cquality_auto/store-groesbeck.png",
      intro:
        "Groesbeck is set up as a local source for lumber, hardware, paint, and building materials with pickup and delivery options built into the store experience.",
      hours: [
        { label: "Monday - Friday", value: "7:30am - 5:30pm" },
        { label: "Saturday", value: "7:30am - 4:00pm" },
        { label: "Sunday", value: "Closed" }
      ]
    },

    "4738": {
      pg: "4738",
      view: "store-mexia",
      slug: "mexia",
      name: "Mexia",
      company: "Woodson Lumber & Hardware Mexia",
      phoneLabel: "Phone",
      phoneDisplay: "(254) 562-9351",
      phoneHref: "tel:+12545629351",
      address1: "1127 Hwy. 84",
      cityStateZip: "Mexia, TX 76667",
      directionsUrl: "https://www.google.com/maps/search/?api=1&query=1127+Hwy.+84+Mexia+TX+76667",
      shopUrl: "/Products.aspx",
      makeMyStoreUrl: "/AccountSettings.aspx?cms=1",
      reviewUrl: "#",
      heroImage: "https://static.wixstatic.com/media/aba64d_a640e6f19e2a49ea849b31d2dd5007fd~mv2.png/v1/crop/x_144%2Cy_0%2Cw_1191%2Ch_554/fill/w_980%2Ch_456%2Cal_c%2Cq_95%2Cusm_0.66_1.00_0.01%2Cenc_avif%2Cquality_auto/store-mexia.png",
      intro:
        "Mexia is positioned as a local hardware and lumber store with a practical mix of building materials, pickup convenience, and delivery support.",
      hours: [
        { label: "Monday - Friday", value: "7:30am - 5:30pm" },
        { label: "Saturday", value: "7:30am - 4:00pm" },
        { label: "Sunday", value: "Closed" }
      ]
    },

    "4739": {
      pg: "4739",
      view: "store-buffalo",
      slug: "buffalo",
      name: "Buffalo",
      company: "Woodson Lumber & Hardware Buffalo",
      phoneLabel: "Phone",
      phoneDisplay: "(903) 322-4638",
      phoneHref: "tel:+19033224638",
      address1: "2871 W. Commerce St.",
      cityStateZip: "Buffalo, TX 75831",
      directionsUrl: "https://www.google.com/maps/search/?api=1&query=2871+W.+Commerce+St.+Buffalo+TX+75831",
      shopUrl: "/Products.aspx",
      makeMyStoreUrl: "/AccountSettings.aspx?cms=1",
      reviewUrl: "#",
      heroImage: "https://static.wixstatic.com/media/aba64d_f374f2a488944e169c04fe0ecfd41300~mv2.png/v1/crop/x_144%2Cy_0%2Cw_1191%2Ch_554/fill/w_980%2Ch_456%2Cal_c%2Cq_95%2Cusm_0.66_1.00_0.01%2Cenc_avif%2Cquality_auto/store-buffalo.png",
      intro:
        "Buffalo offers local access to lumber, hardware, paint, and building materials with in-store pickup, curbside pickup, and delivery options.",
      hours: [
        { label: "Monday - Friday", value: "7:30am - 5:30pm" },
        { label: "Saturday", value: "7:30am - 4:00pm" },
        { label: "Sunday", value: "Closed" }
      ]
    }
  };

  var currentStore = null;

  if (pg && stores[pg]) {
    currentStore = stores[pg];
  } else if (pl1 && stores[pl1]) {
    currentStore = stores[pl1];
  }

  if (!currentStore) {
    console.log(LOG, "Not a supported store product group. Exiting.");
    return;
  }

  console.log(LOG, "Matched store:", currentStore.name);

  function injectStyles() {
    if (document.getElementById("wl-storepage-styles")) return;

    var css = `
      #MainLayoutRow {
        display: block !important;
      }

      #wl-storepage-root {
        width: 100%;
        max-width: 1460px;
        margin: 0 auto;
        padding: 20px;
        box-sizing: border-box;
        font-family: Arial, Helvetica, sans-serif;
        color: #222;
      }

      .wlsp-breadcrumb {
        margin: 4px 0 18px;
        font-size: 14px;
      }

      .wlsp-breadcrumb a {
        color: #6b0014;
        text-decoration: none;
        font-weight: 700;
      }

      .wlsp-breadcrumb a:hover {
        text-decoration: underline;
      }

      .wlsp-hero {
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        gap: 24px;
        align-items: stretch;
        margin-bottom: 24px;
      }

      .wlsp-hero-copy {
        background: linear-gradient(135deg, #6b0014 0%, #8d1028 100%);
        color: #fff;
        border-radius: 22px;
        padding: 30px 28px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.14);
      }

      .wlsp-kicker {
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 1.4px;
        opacity: 0.9;
        margin-bottom: 10px;
      }

      .wlsp-title {
        font-size: 42px;
        line-height: 1.04;
        font-weight: 800;
        margin: 0 0 12px;
      }

      .wlsp-subtitle {
        font-size: 17px;
        line-height: 1.65;
        margin: 0 0 18px;
        max-width: 760px;
        opacity: 0.97;
      }

      .wlsp-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 18px;
      }

      .wlsp-btn {
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

      .wlsp-btn-primary {
        background: #ffffff;
        color: #6b0014;
      }

      .wlsp-btn-primary:hover {
        background: #f6eef0;
        color: #540010;
      }

      .wlsp-btn-secondary {
        background: transparent;
        color: #ffffff;
        border-color: rgba(255,255,255,0.55);
      }

      .wlsp-btn-secondary:hover {
        background: rgba(255,255,255,0.10);
        color: #ffffff;
      }

      .wlsp-quickfacts {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        margin-top: 22px;
      }

      .wlsp-fact {
        background: rgba(255,255,255,0.12);
        border: 1px solid rgba(255,255,255,0.16);
        border-radius: 16px;
        padding: 14px;
      }

      .wlsp-fact-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 1.2px;
        opacity: 0.85;
        margin-bottom: 6px;
      }

      .wlsp-fact-value {
        font-size: 15px;
        line-height: 1.45;
        font-weight: 700;
      }

      .wlsp-fact-value a {
        color: #fff;
        text-decoration: none;
      }

      .wlsp-hero-media {
        border-radius: 22px;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0,0,0,0.10);
        min-height: 100%;
        background: #f3f3f3;
      }

      .wlsp-hero-media img {
        display: block;
        width: 100%;
        height: 100%;
        min-height: 420px;
        object-fit: cover;
      }

      .wlsp-main-grid {
        display: grid;
        grid-template-columns: 1.15fr 0.85fr;
        gap: 22px;
        margin-bottom: 22px;
      }

      .wlsp-card {
        background: #fff;
        border: 1px solid #e8e8e8;
        border-radius: 18px;
        padding: 22px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.05);
      }

      .wlsp-card h2 {
        margin: 0 0 14px;
        font-size: 26px;
        line-height: 1.15;
        color: #1f1f1f;
      }

      .wlsp-card p {
        margin: 0 0 14px;
        font-size: 15px;
        line-height: 1.7;
        color: #444;
      }

      .wlsp-info-list {
        display: grid;
        gap: 14px;
      }

      .wlsp-info-row {
        display: grid;
        grid-template-columns: 150px 1fr;
        gap: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid #efefef;
      }

      .wlsp-info-row:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }

      .wlsp-info-label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 1.1px;
        color: #777;
        font-weight: 800;
      }

      .wlsp-info-value,
      .wlsp-info-value a {
        font-size: 16px;
        color: #222;
        text-decoration: none;
        font-weight: 700;
      }

      .wlsp-info-value a:hover {
        color: #6b0014;
      }

      .wlsp-hours {
        display: grid;
        gap: 12px;
      }

      .wlsp-hours-row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 0;
        border-bottom: 1px solid #efefef;
      }

      .wlsp-hours-row:last-child {
        border-bottom: none;
      }

      .wlsp-hours-day {
        font-weight: 700;
        color: #222;
      }

      .wlsp-hours-time {
        color: #555;
        font-weight: 700;
        text-align: right;
      }

      .wlsp-feature-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
      }

      .wlsp-feature {
        background: #fff;
        border: 1px solid #e8e8e8;
        border-radius: 18px;
        padding: 22px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.05);
      }

      .wlsp-feature h3 {
        margin: 0 0 10px;
        font-size: 21px;
        line-height: 1.2;
        color: #6b0014;
      }

      .wlsp-feature p {
        margin: 0;
        font-size: 15px;
        line-height: 1.7;
        color: #444;
      }

      .wlsp-bottom-cta {
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

      .wlsp-bottom-cta-copy h2 {
        margin: 0 0 8px;
        font-size: 28px;
        color: #222;
      }

      .wlsp-bottom-cta-copy p {
        margin: 0;
        color: #4c4c4c;
        font-size: 15px;
        line-height: 1.7;
      }

      .wlsp-bottom-cta-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      .wlsp-bottom-cta .wlsp-btn-primary {
        background: #6b0014;
        color: #fff;
      }

      .wlsp-bottom-cta .wlsp-btn-primary:hover {
        background: #540010;
        color: #fff;
      }

      .wlsp-bottom-cta .wlsp-btn-secondary {
        color: #6b0014;
        border-color: #6b0014;
        background: #fff;
      }

      .wlsp-bottom-cta .wlsp-btn-secondary:hover {
        background: #f9f4f5;
      }

      @media (max-width: 1100px) {
        .wlsp-hero,
        .wlsp-main-grid,
        .wlsp-feature-grid {
          grid-template-columns: 1fr;
        }

        .wlsp-quickfacts {
          grid-template-columns: 1fr;
        }

        .wlsp-hero-media img {
          min-height: 300px;
        }

        .wlsp-bottom-cta {
          flex-direction: column;
          align-items: flex-start;
        }
      }

      @media (max-width: 700px) {
        #wl-storepage-root {
          padding: 14px;
        }

        .wlsp-hero-copy,
        .wlsp-card,
        .wlsp-feature,
        .wlsp-bottom-cta {
          padding: 18px;
        }

        .wlsp-title {
          font-size: 32px;
        }

        .wlsp-info-row {
          grid-template-columns: 1fr;
          gap: 6px;
        }

        .wlsp-hours-row {
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
        }

        .wlsp-hours-time {
          text-align: left;
        }
      }
    `;

    var style = document.createElement("style");
    style.id = "wl-storepage-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function setPrettyUrl(store) {
    if (!store || !store.view) return;

    try {
      window.history.replaceState(
        { wlPrettyRoute: store.view },
        "",
        "/Default.aspx?view=" + encodeURIComponent(store.view)
      );
      console.log(LOG, "Pretty URL applied.");
    } catch (e) {
      console.warn(LOG, "replaceState failed:", e);
    }
  }

  function buildHoursMarkup(store) {
    return store.hours.map(function (row) {
      return [
        '<div class="wlsp-hours-row">',
        '  <div class="wlsp-hours-day">' + row.label + '</div>',
        '  <div class="wlsp-hours-time">' + row.value + '</div>',
        '</div>'
      ].join("");
    }).join("");
  }

  function buildFeaturesMarkup() {
    var features = [
      {
        title: "Same-Day In-Store Pickup",
        text: "Available on in-stock items so customers can get what they need quickly and keep their projects moving."
      },
      {
        title: "Curbside Pickup Available",
        text: "A convenient option for customers who want the speed of pickup with less time spent in-store."
      },
      {
        title: "Delivery Available",
        text: "From jobsite needs to larger purchases, delivery support extends the store beyond the counter."
      }
    ];

    return features.map(function (item) {
      return [
        '<div class="wlsp-feature">',
        '  <h3>' + item.title + '</h3>',
        '  <p>' + item.text + '</p>',
        '</div>'
      ].join("");
    }).join("");
  }

  function buildHeroMedia(store) {
    return [
      '<div class="wlsp-hero-media">',
      '  <img src="' + store.heroImage + '" alt="Woodson Lumber ' + store.name + ' store image" loading="eager">',
      '</div>'
    ].join("");
  }

  function buildMarkup(store) {
    return [
      '<div id="wl-storepage-root">',

      '  <div class="wlsp-breadcrumb">',
      '    <a href="/Default.aspx?view=storelocations">← Back to Store Locations</a>',
      '  </div>',

      '  <section class="wlsp-hero">',
      '    <div class="wlsp-hero-copy">',
      '      <div class="wlsp-kicker">Woodson Lumber Location</div>',
      '      <h1 class="wlsp-title">' + store.name + '</h1>',
      '      <p class="wlsp-subtitle">' + store.intro + '</p>',

      '      <div class="wlsp-actions">',
      '        <a class="wlsp-btn wlsp-btn-primary" href="' + store.shopUrl + '">Shop This Store</a>',
      '        <a class="wlsp-btn wlsp-btn-secondary" href="' + store.makeMyStoreUrl + '">Make This My Store</a>',
      '      </div>',

      '      <div class="wlsp-quickfacts">',
      '        <div class="wlsp-fact">',
      '          <div class="wlsp-fact-label">' + store.phoneLabel + '</div>',
      '          <div class="wlsp-fact-value"><a href="' + store.phoneHref + '">' + store.phoneDisplay + '</a></div>',
      '        </div>',
      '        <div class="wlsp-fact">',
      '          <div class="wlsp-fact-label">Address</div>',
      '          <div class="wlsp-fact-value">' + store.address1 + '<br>' + store.cityStateZip + '</div>',
      '        </div>',
      '        <div class="wlsp-fact">',
      '          <div class="wlsp-fact-label">Pickup</div>',
      '          <div class="wlsp-fact-value">Same-Day In-Store Pickup Available</div>',
      '        </div>',
      '      </div>',
      '    </div>',

      buildHeroMedia(store),
      '  </section>',

      '  <section class="wlsp-main-grid">',
      '    <div class="wlsp-card">',
      '      <h2>Contact & Store Details</h2>',
      '      <div class="wlsp-info-list">',
      '        <div class="wlsp-info-row"><div class="wlsp-info-label">Location</div><div class="wlsp-info-value">' + store.company + '</div></div>',
      '        <div class="wlsp-info-row"><div class="wlsp-info-label">' + store.phoneLabel + '</div><div class="wlsp-info-value"><a href="' + store.phoneHref + '">' + store.phoneDisplay + '</a></div></div>',
      '        <div class="wlsp-info-row"><div class="wlsp-info-label">Address</div><div class="wlsp-info-value">' + store.address1 + '<br>' + store.cityStateZip + '</div></div>',
      '        <div class="wlsp-info-row"><div class="wlsp-info-label">Directions</div><div class="wlsp-info-value"><a href="' + store.directionsUrl + '" target="_blank" rel="noopener">Open in Maps</a></div></div>',
      '        <div class="wlsp-info-row"><div class="wlsp-info-label">Reviews</div><div class="wlsp-info-value"><a href="' + store.reviewUrl + '">Leave a Review</a></div></div>',
      '      </div>',
      '    </div>',

      '    <div class="wlsp-card">',
      '      <h2>Store Hours</h2>',
      '      <div class="wlsp-hours">' + buildHoursMarkup(store) + '</div>',
      '    </div>',
      '  </section>',

      '  <section class="wlsp-feature-grid">' + buildFeaturesMarkup() + '</section>',

      '  <section class="wlsp-bottom-cta">',
      '    <div class="wlsp-bottom-cta-copy">',
      '      <h2>Ready to shop ' + store.name + '?</h2>',
      '      <p>Use this page as the local hub for ' + store.name + '-specific shopping, services, contact information, and future branch promotions or events.</p>',
      '    </div>',
      '    <div class="wlsp-bottom-cta-actions">',
      '      <a class="wlsp-btn wlsp-btn-primary" href="' + store.shopUrl + '">Start Shopping</a>',
      '      <a class="wlsp-btn wlsp-btn-secondary" href="/Default.aspx?view=storelocations">All Locations</a>',
      '    </div>',
      '  </section>',

      '</div>'
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
    container.innerHTML = buildMarkup(currentStore);
    setPrettyUrl(currentStore);
    console.log(LOG, "Store page rendered.");
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
