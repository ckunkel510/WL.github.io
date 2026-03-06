(function () {
  "use strict";

  var LOG = "[WL HeaderEnhancer]";
  var LOCATIONS_URL = "/Default.aspx?view=storelocations";

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  function injectStyles() {
    if (document.getElementById("wl-header-enhancer-styles")) return;

    var css = `
      /* ===== overall page header polish ===== */
      #PageHeaderDiv {
        position: relative;
        z-index: 50;
        box-shadow: 0 2px 12px rgba(0,0,0,0.05);
      }

      #siteHeaderContent {
        background: #ffffff !important;
      }

      #ctl00_PageHeader_branding {
        background: #ffffff !important;
      }

      #brandingLogo {
        width: 100%;
      }

      /* ===== top custom Woodson header ===== */
      #wlcheader {
        width: 100% !important;
        min-height: 96px !important;
        height: auto !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 18px !important;
        padding: 10px 16px !important;
        box-sizing: border-box !important;
        background: linear-gradient(135deg, #6b0014 0%, #8d1028 100%) !important;
        border-top: none !important;
        border-radius: 0 !important;
      }

      #wlcheader > a {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        text-decoration: none;
      }

      #wlcheader > a img {
        width: 160px !important;
        height: auto !important;
        padding: 8px !important;
        border-radius: 12px;
        background: #ffffff !important;
        box-shadow: 0 6px 18px rgba(0,0,0,0.12);
      }

      #wl-weather-closure-banner {
        display: none;
        max-width: 420px;
      }

      #wlcheadersect2,
      #wlcheadersect3,
      #wlcheadersect4,
      #wlcheadersect5 {
        float: none !important;
      }

      #wlcheadersect2 {
        flex: 1 1 auto !important;
        width: auto !important;
        padding-top: 0 !important;
        padding-left: 0 !important;
        color: #fff !important;
        font-size: 13px !important;
        line-height: 1.5 !important;
        font-weight: 700 !important;
      }

      #wlcheadersect3 {
        display: none !important;
      }

      #wlcheadersect4,
      #wlcheadersect5 {
        width: auto !important;
        padding-top: 0 !important;
        text-align: center !important;
      }

      #wlcheadersect4 a,
      #wlcheadersect5 a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 42px;
        padding: 10px 14px;
        border-radius: 999px;
        color: #fff !important;
        font-size: 14px !important;
        font-weight: 800 !important;
        text-decoration: none !important;
        border: 1px solid rgba(255,255,255,0.32);
        background: rgba(255,255,255,0.08);
        transition: all 0.18s ease;
      }

      #wlcheadersect4 a:hover,
      #wlcheadersect5 a:hover {
        background: rgba(255,255,255,0.16);
      }

      #wlcheadersect4 p,
      #wlcheadersect5 p {
        display: none !important;
      }

      /* ===== second row links ===== */
      #wlcheaderpromolinks,
      #wlcheaderquicklinks {
        height: auto !important;
        min-height: 46px;
        display: flex !important;
        align-items: center !important;
        flex-wrap: wrap;
        gap: 8px;
        padding: 10px 16px !important;
        box-sizing: border-box !important;
        background: #ffffff !important;
      }

      #wlcheaderpromolinks {
        float: left !important;
        margin-left: 0 !important;
        border-right: none !important;
      }

      #wlcheaderquicklinks {
        float: right !important;
        text-align: right !important;
      }

      #wlcheaderpromolinks a,
      #wlcheaderquicklinks a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 34px;
        padding: 7px 12px !important;
        border-radius: 999px;
        font-size: 13px !important;
        font-weight: 700 !important;
        text-decoration: none !important;
        color: #3a3a3a !important;
        background: #f5f5f5;
        transition: all 0.18s ease;
      }

      #wlcheaderpromolinks a:hover,
      #wlcheaderquicklinks a:hover {
        background: #efe7e9;
        color: #6b0014 !important;
      }

      /* ===== search/menu row ===== */
      #ctl00_PageHeader_searchBarTableRow {
        gap: 12px;
        padding: 10px 16px 14px 16px;
        background: #ffffff;
        border-top: 1px solid #f0f0f0;
      }

      .prod-search-wrapper {
        width: 100%;
      }

      #Div_SearchControls {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      #c50_1,
      #c50_2 {
        min-width: 0;
      }

      #c50_1 {
        width: 190px;
      }

      #c50_2 {
        flex: 1 1 auto;
      }

      .RadComboBox_MetroTouch,
      .RadSearchBox_MetroTouch .rsbInner {
        border-radius: 14px !important;
        overflow: hidden;
      }

      /* ===== desktop locations CTA ===== */
      .wl-header-locations-desktop {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
        min-height: 42px;
        padding: 10px 14px;
        border-radius: 999px;
        background: #6b0014;
        color: #fff !important;
        text-decoration: none !important;
        font-size: 14px;
        font-weight: 800;
        white-space: nowrap;
        box-shadow: 0 8px 18px rgba(107,0,20,0.18);
        transition: all 0.18s ease;
      }

      .wl-header-locations-desktop:hover {
        background: #540010;
        color: #fff !important;
        transform: translateY(-1px);
      }

      .wl-pin-icon {
        display: inline-flex;
        width: 18px;
        height: 18px;
        flex: 0 0 18px;
      }

      .wl-pin-icon svg {
        width: 100%;
        height: 100%;
        fill: currentColor;
      }

      /* ===== mobile locations CTA ===== */
      .wl-header-locations-mobile {
        display: none;
      }

      /* ===== responsive ===== */
      @media (max-width: 991px) {
        #wlcheader {
          flex-wrap: wrap !important;
          justify-content: flex-start !important;
        }

        #wlcheader > a {
          margin-right: auto;
        }

        #wlcheadersect2 {
          order: 3;
          width: 100% !important;
        }

        #wlcheadersect4,
        #wlcheadersect5 {
          order: 2;
        }

        #wlcheaderpromolinks,
        #wlcheaderquicklinks {
          float: none !important;
          width: 100% !important;
          justify-content: flex-start !important;
        }

        #ctl00_PageHeader_searchBarTableRow {
          align-items: center !important;
        }

        .wl-header-locations-desktop {
          display: none !important;
        }

        .wl-header-locations-mobile {
          display: inline-flex !important;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          min-width: 44px;
          min-height: 44px;
          border-radius: 999px;
          background: #6b0014;
          color: #fff !important;
          text-decoration: none !important;
          box-shadow: 0 8px 18px rgba(107,0,20,0.18);
          flex: 0 0 auto;
        }

        .wl-header-locations-mobile:hover {
          color: #fff !important;
          background: #540010;
        }

        #Div_SearchControls {
          gap: 8px;
        }

        #c50_1 {
          width: 130px;
        }
      }

      @media (max-width: 767px) {
        #wlcheader {
          padding: 10px 12px !important;
        }

        #wlcheader > a img {
          width: 130px !important;
        }

        #wlcheaderpromolinks,
        #wlcheaderquicklinks,
        #ctl00_PageHeader_searchBarTableRow {
          padding-left: 12px !important;
          padding-right: 12px !important;
        }

        #Div_SearchControls {
          flex-wrap: nowrap;
        }

        #c50_1 {
          width: 115px;
        }
      }

      @media (max-width: 575px) {
        #wlcheadersect4 a,
        #wlcheadersect5 a {
          min-height: 38px;
          padding: 8px 10px;
          font-size: 13px !important;
        }

        #wlcheaderpromolinks a,
        #wlcheaderquicklinks a {
          font-size: 12px !important;
          padding: 6px 10px !important;
        }

        #c50_1 {
          display: none;
        }
      }
    `;

    var style = document.createElement("style");
    style.id = "wl-header-enhancer-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function pinIconMarkup() {
    return (
      '<span class="wl-pin-icon" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">' +
          '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.08 5.45 11.42 6.08 12.14a1.2 1.2 0 0 0 1.84 0C13.55 20.42 19 14.08 19 9c0-3.87-3.13-7-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"></path>' +
        '</svg>' +
      '</span>'
    );
  }

  function updateHeaderActionsText() {
    var signInWrap = document.getElementById("wlcheadersect4");
    var acctWrap = document.getElementById("wlcheadersect5");

    if (signInWrap) {
      var signInLink = signInWrap.querySelector("a");
      if (signInLink && !signInLink.textContent.trim()) {
        signInLink.textContent = "Sign In";
      }
    }

    if (acctWrap) {
      var acctLink = acctWrap.querySelector("a");
      if (acctLink && !acctLink.textContent.trim()) {
        acctLink.textContent = "Account";
      }
    }
  }

  function addDesktopLocationsButton() {
    var target = document.getElementById("wlcheaderquicklinks");
    if (!target) return;
    if (target.querySelector(".wl-header-locations-desktop")) return;

    var a = document.createElement("a");
    a.className = "wl-header-locations-desktop";
    a.href = LOCATIONS_URL;
    a.innerHTML = pinIconMarkup() + "<span>Locations</span>";

    target.insertAdjacentElement("afterbegin", a);
  }

  function addMobileLocationsButton() {
    var row = document.getElementById("ctl00_PageHeader_searchBarTableRow");
    if (!row) return;
    if (row.querySelector(".wl-header-locations-mobile")) return;

    var anchor = document.createElement("a");
    anchor.className = "wl-header-locations-mobile";
    anchor.href = LOCATIONS_URL;
    anchor.setAttribute("aria-label", "Store Locations");
    anchor.innerHTML = pinIconMarkup();

    row.insertBefore(anchor, row.lastElementChild);
  }

  function updateBrandAreaCopy() {
    var sect2 = document.getElementById("wlcheadersect2");
    if (!sect2) return;

    if (!sect2.dataset.wlEnhanced) {
      sect2.innerHTML =
        '<div style="font-size:13px; line-height:1.45; font-weight:700;">' +
          'Your local source for lumber, hardware, building materials, paint, and project support.' +
        '</div>';
      sect2.dataset.wlEnhanced = "true";
    }
  }

  function upgradeTopLinksAccessibility() {
    var promo = document.getElementById("wlcheaderpromolinks");
    var quick = document.getElementById("wlcheaderquicklinks");

    [promo, quick].forEach(function (group) {
      if (!group) return;
      group.querySelectorAll("a").forEach(function (a) {
        a.setAttribute("title", (a.textContent || "").trim());
      });
    });
  }

  function run() {
    console.log(LOG, "running");
    injectStyles();
    updateHeaderActionsText();
    updateBrandAreaCopy();
    upgradeTopLinksAccessibility();
    addDesktopLocationsButton();
    addMobileLocationsButton();
    console.log(LOG, "header enhanced");
  }

  onReady(function () {
    run();

    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      run();
      if (tries >= 15) clearInterval(iv);
    }, 500);
  });
})();
