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

  var hubPage = {
    type: "hub",
    name: "Store Locations",
    view: "storelocations",
    pl1: "4731",
    pg: "4731"
  };

  var storeCards = [
    {
      name: "Brenham",
      view: "store-brenham",
      image: "https://static.wixstatic.com/media/aba64d_e4bef13eccc0407385a7152fcff2f035~mv2.png/v1/crop/x_128%2Cy_20%2Cw_1126%2Ch_516/fill/w_980%2Ch_456%2Cal_c%2Cq_95%2Cusm_0.66_1.00_0.01%2Cenc_avif%2Cquality_auto/aba64d_e4bef13eccc0407385a7152fcff2f035~mv2.png",
      teaser: " "
    },
    {
      name: "Bryan",
      view: "store-bryan",
      image: "https://static.wixstatic.com/media/aba64d_bac1afac1160451b8a1872fbdbde7363~mv2.png/v1/crop/x_144%2Cy_0%2Cw_1191%2Ch_554/fill/w_980%2Ch_456%2Cal_c%2Cq_95%2Cusm_0.66_1.00_0.01%2Cenc_avif%2Cquality_auto/store-bryan.png",
      teaser: " "
    },
    {
      name: "Caldwell",
      view: "store-caldwell",
      image: "https://static.wixstatic.com/media/aba64d_10d6752e582f4cf5b147bef46f4ee4a2~mv2.png/v1/crop/x_144%2Cy_0%2Cw_1191%2Ch_554/fill/w_980%2Ch_456%2Cal_c%2Cq_95%2Cusm_0.66_1.00_0.01%2Cenc_avif%2Cquality_auto/store-caldwell.png",
      teaser: " "
    },
    {
      name: "Lexington",
      view: "store-lexington",
      image: "https://static.wixstatic.com/media/aba64d_5d638a9ba44446ab879100b3e51c3d19~mv2.png/v1/crop/x_144%2Cy_0%2Cw_1191%2Ch_554/fill/w_980%2Ch_456%2Cal_c%2Cq_95%2Cusm_0.66_1.00_0.01%2Cenc_avif%2Cquality_auto/store-lexington.png",
      teaser: " "
    },
    {
      name: "Groesbeck",
      view: "store-groesbeck",
      image: "https://static.wixstatic.com/media/aba64d_9c60a78b90c1467d9a82f162181f0f3e~mv2.png/v1/crop/x_144%2Cy_0%2Cw_1191%2Ch_554/fill/w_980%2Ch_456%2Cal_c%2Cq_95%2Cusm_0.66_1.00_0.01%2Cenc_avif%2Cquality_auto/store-groesbeck.png",
      teaser: " "
    },
    {
      name: "Mexia",
      view: "store-mexia",
      image: "https://static.wixstatic.com/media/aba64d_a640e6f19e2a49ea849b31d2dd5007fd~mv2.png/v1/crop/x_144%2Cy_0%2Cw_1191%2Ch_554/fill/w_980%2Ch_456%2Cal_c%2Cq_95%2Cusm_0.66_1.00_0.01%2Cenc_avif%2Cquality_auto/store-mexia.png",
      teaser: " "
    },
    {
      name: "Buffalo",
      view: "store-buffalo",
      image: "https://static.wixstatic.com/media/aba64d_f374f2a488944e169c04fe0ecfd41300~mv2.png/v1/crop/x_144%2Cy_0%2Cw_1191%2Ch_554/fill/w_980%2Ch_456%2Cal_c%2Cq_95%2Cusm_0.66_1.00_0.01%2Cenc_avif%2Cquality_auto/store-buffalo.png",
      teaser: " "
    }
  ];

  var pg = (params.get("pg") || "").trim();
  var pl1 = (params.get("pl1") || "").trim();

  console.log(LOG, "pg:", pg || "(none)");
  console.log(LOG, "pl1:", pl1 || "(none)");

  var isHub = (pg === hubPage.pg || pl1 === hubPage.pl1);

  if (!isHub) {
    console.log(LOG, "Not the Store Locations hub. Exiting.");
    return;
  }

  console.log(LOG, "Matched hub page:", hubPage);

  function injectStyles() {
    if (document.getElementById("wl-storelocations-styles")) return;

    var css = `
      #MainLayoutRow {
        display: block !important;
      }

      #wl-storelocations-root {
        width: 100%;
        max-width: 1460px;
        margin: 0 auto 32px auto;
        padding: 20px;
        box-sizing: border-box;
        font-family: Arial, Helvetica, sans-serif;
      }

      .wl-store-hero {
        position: relative;
        overflow: hidden;
        background: linear-gradient(135deg, #6b0014 0%, #8d1028 100%);
        color: #fff;
        border-radius: 24px;
        padding: 34px 30px;
        margin-bottom: 26px;
        box-shadow: 0 12px 32px rgba(0,0,0,0.12);
      }

      .wl-store-hero::after {
        content: "";
        position: absolute;
        right: -40px;
        top: -40px;
        width: 220px;
        height: 220px;
        border-radius: 50%;
        background: rgba(255,255,255,0.08);
        pointer-events: none;
      }

      .wl-store-kicker {
        position: relative;
        z-index: 1;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 1.3px;
        opacity: 0.92;
        margin-bottom: 10px;
      }

      .wl-store-title {
        position: relative;
        z-index: 1;
        font-size: 40px;
        line-height: 1.05;
        font-weight: 800;
        margin: 0 0 12px 0;
      }

      .wl-store-subtitle {
        position: relative;
        z-index: 1;
        font-size: 17px;
        line-height: 1.65;
        max-width: 860px;
        margin: 0;
        opacity: 0.96;
      }

      .wl-store-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(255px, 1fr));
        gap: 18px;
      }

      .wl-store-card {
        position: relative;
        display: block;
        min-height: 350px;
        border-radius: 22px;
        overflow: hidden;
        text-decoration: none;
        color: #fff;
        background: #ddd center center / cover no-repeat;
        box-shadow: 0 10px 28px rgba(0,0,0,0.12);
        transition: transform 0.22s ease, box-shadow 0.22s ease;
      }

      .wl-store-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 16px 34px rgba(0,0,0,0.18);
      }

      .wl-store-card::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.30) 45%, rgba(0,0,0,0.12) 100%);
      }

      .wl-store-card-inner {
        position: relative;
        z-index: 1;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        padding: 22px 20px;
      }

      .wl-store-card-eyebrow {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 1.2px;
        opacity: 0.88;
        margin-bottom: 8px;
      }

      .wl-store-card h3 {
        margin: 0 0 10px 0;
        font-size: 28px;
        line-height: 1.1;
        font-weight: 800;
        color: #fff;
      }

      .wl-store-card p {
        margin: 0 0 14px 0;
        font-size: 14px;
        line-height: 1.55;
        color: rgba(255,255,255,0.94);
        max-width: 95%;
      }

      .wl-store-card-cta {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 800;
        color: #fff;
      }

      .wl-store-card-cta::after {
        content: "→";
        font-size: 16px;
        line-height: 1;
        transition: transform 0.18s ease;
      }

      .wl-store-card:hover .wl-store-card-cta::after {
        transform: translateX(3px);
      }

      @media (max-width: 900px) {
        .wl-store-title {
          font-size: 31px;
        }

        .wl-store-subtitle {
          font-size: 15px;
        }

        .wl-store-card {
          min-height: 300px;
        }
      }

      @media (max-width: 640px) {
        #wl-storelocations-root {
          padding: 14px;
        }

        .wl-store-hero {
          padding: 24px 18px;
          border-radius: 18px;
        }

        .wl-store-card {
          min-height: 260px;
          border-radius: 18px;
        }

        .wl-store-card h3 {
          font-size: 24px;
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
    var cards = storeCards.map(function (store) {
      return `
        <a class="wl-store-card" href="/Default.aspx?view=${encodeURIComponent(store.view)}" style="background-image:url('${store.image}');">
          <div class="wl-store-card-inner">
            <div class="wl-store-card-eyebrow"></div>
            <h3>${store.name}</h3>
            <p>${store.teaser}</p>
            <span class="wl-store-card-cta">Store Details</span>
          </div>
        </a>
      `;
    }).join("");

    return `
      <div id="wl-storelocations-root">
        <section class="wl-store-hero">
          <div class="wl-store-kicker">Woodson Lumber</div>
          <h1 class="wl-store-title">Store Locations</h1>
          <p class="wl-store-subtitle">
            Choose a location to explore its page, see the space, and dive into a more local Woodson experience.
          </p>
        </section>

        <section class="wl-store-grid">
          ${cards}
        </section>
      </div>
    `;
  }

  function render() {
    injectStyles();

    var container = findContentContainer();
    if (!container) return;

    console.log(LOG, "Rendering hub into #MainLayoutRow");
    container.innerHTML = createHubMarkup();
    setPrettyUrl(hubPage);
    console.log(LOG, "Store Locations hub rendered.");
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
