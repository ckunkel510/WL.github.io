(function () {
  "use strict";

  var LOG = "[WL StoreLocations]";
  var loc = window.location;
  var path = (loc.pathname || "").toLowerCase();
  var search = loc.search || "";
  var params = new URLSearchParams(search);

  console.log(LOG, "loaded");
  console.log(LOG, "href:", loc.href);

  if (!path.includes("products.aspx")) {
    console.log(LOG, "Not on Products.aspx. Exiting.");
    return;
  }

  var routeMap = {
    "4731": {
      type: "hub",
      name: "Store Locations",
      view: "storelocations",
      pl1: "4731",
      pg: "4731"
    },
    "4733": {
      type: "store",
      name: "Brenham",
      view: "store-brenham",
      pl1: "4733",
      pg: "4733"
    },
    "4734": {
      type: "store",
      name: "Bryan",
      view: "store-bryan",
      pl1: "4734",
      pg: "4734"
    },
    "4735": {
      type: "store",
      name: "Caldwell",
      view: "store-caldwell",
      pl1: "4735",
      pg: "4735"
    },
    "4736": {
      type: "store",
      name: "Lexington",
      view: "store-lexington",
      pl1: "4736",
      pg: "4736"
    },
    "4737": {
      type: "store",
      name: "Groesbeck",
      view: "store-groesbeck",
      pl1: "4737",
      pg: "4737"
    },
    "4738": {
      type: "store",
      name: "Mexia",
      view: "store-mexia",
      pl1: "4738",
      pg: "4738"
    },
    "4739": {
      type: "store",
      name: "Buffalo",
      view: "store-buffalo",
      pl1: "4739",
      pg: "4739"
    }
  };

  var pg = (params.get("pg") || "").trim();
  var pl1 = (params.get("pl1") || "").trim();
  var pretty = (params.get("pretty") || "").trim().toLowerCase();

  console.log(LOG, "pg:", pg || "(none)");
  console.log(LOG, "pl1:", pl1 || "(none)");
  console.log(LOG, "pretty:", pretty || "(none)");

  var currentKey = null;

  if (pg && routeMap[pg]) {
    currentKey = pg;
  } else if (pl1 && routeMap[pl1]) {
    currentKey = pl1;
  }

  if (!currentKey) {
    console.log(LOG, "Not a store-locations page. Exiting.");
    return;
  }

  var currentPage = routeMap[currentKey];
  console.log(LOG, "Matched route:", currentPage);

  function injectStyles() {
    if (document.getElementById("wl-storelocations-styles")) return;

    var css = `
      #MainLayoutRow {
        display: block !important;
      }

      #wl-storelocations-root {
        width: 100%;
        max-width: 1400px;
        margin: 20px auto 30px auto;
        padding: 20px;
        box-sizing: border-box;
        font-family: Arial, sans-serif;
      }

      .wl-store-hero {
        background: linear-gradient(135deg, #6b0014 0%, #8d1028 100%);
        color: #fff;
        border-radius: 16px;
        padding: 28px 24px;
        margin-bottom: 24px;
      }

      .wl-store-kicker {
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 1.2px;
        opacity: 0.9;
        margin-bottom: 8px;
      }

      .wl-store-title {
        font-size: 34px;
        line-height: 1.1;
        font-weight: 700;
        margin: 0 0 10px 0;
      }

      .wl-store-subtitle {
        font-size: 16px;
        line-height: 1.5;
        max-width: 850px;
        margin: 0;
        opacity: 0.95;
      }

      .wl-store-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
        margin-top: 24px;
      }

      .wl-store-card {
        display: block;
        text-decoration: none;
        color: #222;
        background: #fff;
        border: 1px solid #e6e6e6;
        border-radius: 14px;
        padding: 18px;
        box-shadow: 0 4px 18px rgba(0,0,0,0.05);
        transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
      }

      .wl-store-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.08);
        border-color: #d7c0c6;
      }

      .wl-store-card h3 {
        margin: 0 0 8px 0;
        font-size: 21px;
        color: #6b0014;
      }

      .wl-store-card p {
        margin: 0;
        font-size: 14px;
        line-height: 1.5;
        color: #444;
      }

      .wl-store-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 20px;
      }

      .wl-store-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 12px 18px;
        border-radius: 999px;
        text-decoration: none;
        font-weight: 700;
        border: 1px solid #6b0014;
        transition: all 0.18s ease;
      }

      .wl-store-btn-primary {
        background: #6b0014;
        color: #fff;
      }

      .wl-store-btn-primary:hover {
        background: #540010;
        color: #fff;
      }

      .wl-store-btn-secondary {
        background: #fff;
        color: #6b0014;
      }

      .wl-store-btn-secondary:hover {
        background: #f9f4f5;
        color: #6b0014;
      }

      .wl-store-panels {
        display: grid;
        grid-template-columns: 1.2fr 1fr;
        gap: 18px;
        margin-top: 22px;
      }

      .wl-store-panel {
        background: #fff;
        border: 1px solid #e8e8e8;
        border-radius: 14px;
        padding: 20px;
        box-shadow: 0 4px 18px rgba(0,0,0,0.04);
      }

      .wl-store-panel h2 {
        margin: 0 0 12px 0;
        font-size: 22px;
        color: #222;
      }

      .wl-store-panel p,
      .wl-store-panel li {
        font-size: 15px;
        line-height: 1.6;
        color: #444;
      }

      .wl-store-panel ul {
        margin: 0;
        padding-left: 18px;
      }

      .wl-store-breadcrumb {
        margin-bottom: 14px;
        font-size: 14px;
      }

      .wl-store-breadcrumb a {
        color: #6b0014;
        text-decoration: none;
        font-weight: 600;
      }

      .wl-store-breadcrumb a:hover {
        text-decoration: underline;
      }

      @media (max-width: 900px) {
        .wl-store-panels {
          grid-template-columns: 1fr;
        }

        .wl-store-title {
          font-size: 28px;
        }
      }
    `;

    var style = document.createElement("style");
    style.id = "wl-storelocations-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function findContentContainer() {
    var el = document.getElementById("MainLayoutRow");

    if (el) {
      console.log(LOG, "Using #MainLayoutRow as content container:", el);
      return el;
    }

    console.warn(LOG, "Could not find #MainLayoutRow.");
    return null;
  }

  function setPrettyUrl(page) {
    if (!page || !page.view) return;

    var prettyUrl = "/Default.aspx?view=" + encodeURIComponent(page.view);

    try {
      window.history.replaceState(
        { wlPrettyRoute: page.view },
        "",
        prettyUrl
      );
      console.log(LOG, "Browser bar updated to:", prettyUrl);
    } catch (e) {
      console.warn(LOG, "replaceState failed:", e);
    }
  }

  function createHubMarkup() {
    var stores = [
      routeMap["4733"],
      routeMap["4734"],
      routeMap["4735"],
      routeMap["4736"],
      routeMap["4737"],
      routeMap["4738"],
      routeMap["4739"]
    ];

    var cards = stores.map(function (store) {
      return `
        <a class="wl-store-card" href="/Default.aspx?view=${encodeURIComponent(store.view)}">
          <h3>${store.name}</h3>
          <p>Visit the ${store.name} location page for store details, featured departments, services, and shopping links.</p>
        </a>
      `;
    }).join("");

    return `
      <div id="wl-storelocations-root">
        <section class="wl-store-hero">
          <div class="wl-store-kicker">Woodson Lumber</div>
          <h1 class="wl-store-title">Store Locations</h1>
          <p class="wl-store-subtitle">
            Choose a location to view branch-specific details, local services, and a more tailored shopping experience.
          </p>
        </section>

        <section class="wl-store-grid">
          ${cards}
        </section>
      </div>
    `;
  }

  function createStoreMarkup(page) {
    return `
      <div id="wl-storelocations-root">
        <div class="wl-store-breadcrumb">
          <a href="/Default.aspx?view=storelocations">← Back to Store Locations</a>
        </div>

        <section class="wl-store-hero">
          <div class="wl-store-kicker">Woodson Lumber Location</div>
          <h1 class="wl-store-title">${page.name}</h1>
          <p class="wl-store-subtitle">
            This is the custom location page shell for ${page.name}. Next we can drop in store-specific content like hours, services, featured categories, map links, contact info, promotions, and “shop this store” actions.
          </p>

          <div class="wl-store-actions">
            <a class="wl-store-btn wl-store-btn-primary" href="/Products.aspx">Start Shopping</a>
            <a class="wl-store-btn wl-store-btn-secondary" href="/Default.aspx?view=storelocations">All Locations</a>
          </div>
        </section>

        <section class="wl-store-panels">
          <div class="wl-store-panel">
            <h2>Store Page Placeholder</h2>
            <p>
              You are successfully routing into the <strong>${page.name}</strong> store page product group.
              This confirms the router and injected page shell are working.
            </p>
            <p>
              In the next step, we can replace this with the actual branch layout and store-specific content.
            </p>
          </div>

          <div class="wl-store-panel">
            <h2>Suggested Next Content</h2>
            <ul>
              <li>Store photo or hero image</li>
              <li>Address, phone, and hours</li>
              <li>Store services</li>
              <li>Featured departments and brands</li>
              <li>Branch-specific promo/event blocks</li>
              <li>Set this as my store button</li>
            </ul>
          </div>
        </section>
      </div>
    `;
  }

  function render() {
    injectStyles();

    var container = findContentContainer();
    if (!container) return;

    console.log(LOG, "Rendering into #MainLayoutRow");

    container.innerHTML = currentPage.type === "hub"
      ? createHubMarkup()
      : createStoreMarkup(currentPage);

    setPrettyUrl(currentPage);

    console.log(LOG, "Custom store page rendered into #MainLayoutRow.");
  }

  function waitForContainerThenRender() {
    var tries = 0;
    var maxTries = 50;

    var iv = setInterval(function () {
      tries++;
      var container = findContentContainer();

      if (container) {
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
