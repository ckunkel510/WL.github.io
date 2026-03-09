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
      #PageHeaderDiv {
        position: relative;
        z-index: 50;
        box-shadow: 0 2px 12px rgba(0,0,0,0.05);
      }

      #siteHeaderContent,
      #ctl00_PageHeader_branding,
      #brandingLogo {
        width: 100%;
        background: #ffffff !important;
      }

      #wlcheader {
        width: 100% !important;
        min-height: 88px !important;
        height: auto !important;
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 18px !important;
        padding: 10px 16px !important;
        box-sizing: border-box !important;
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
        display: none !important;
      }

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

      #ctl00_PageHeader_searchBarTableRow {
        display: flex !important;
        align-items: center !important;
        gap: 12px;
        padding: 10px 16px 14px 16px;
        background: #ffffff;
        border-top: 1px solid #f0f0f0;
      }

      #ctl00_PageHeader_searchBarTableRow > div:first-child {
        flex: 0 0 auto;
      }

      #ctl00_PageHeader_searchBarTableRow > .flex-grow-1 {
        flex: 1 1 auto;
        min-width: 0;
      }

      .prod-search-wrapper {
        width: 100%;
      }

      #Div_SearchControls {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
      }

      #c50_1,
      #c50_2 {
        min-width: 0;
      }

      #c50_1 {
        width: 190px;
        flex: 0 0 190px;
      }

      #c50_2 {
        flex: 1 1 auto;
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      #c50_2 > .RadSearchBox,
      #c50_2 > .RadSearchBox_MetroTouch,
      #c50_2 > div:first-child,
      #ctl00_PageHeader_GlobalSearchControl_SearchPanel {
        min-width: 0;
      }

      #ctl00_PageHeader_GlobalSearchControl_RadSearchBox1 {
        width: 100% !important;
      }

      #ctl00_PageHeader_GlobalSearchControl_RadSearchBox1 .rsbInner {
        display: flex !important;
        align-items: center;
        min-height: 46px;
      }

      #ctl00_PageHeader_GlobalSearchControl_RadSearchBox1_Input {
        width: 100% !important;
      }

      .RadComboBox_MetroTouch,
      .RadSearchBox_MetroTouch .rsbInner {
        border-radius: 14px !important;
        overflow: hidden;
      }

      #barcode-scanner-container {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
      }

      #start-scanner {
        width: 46px !important;
        height: 46px !important;
        min-width: 46px !important;
        min-height: 46px !important;
        border-radius: 12px;
        background-color: #f4f4f4 !important;
        box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08);
      }

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

      .wl-header-locations-mobile {
        display: none;
      }

      @media (max-width: 991px) {
        #wlcheader {
          min-height: 72px !important;
          justify-content: center !important;
          padding: 8px 12px !important;
        }

        #wlcheader > a {
          width: 100%;
          justify-content: center;
        }

        #wlcheader > a img {
          width: 136px !important;
        }

        #wl-weather-closure-banner {
          display: none !important;
        }

        #wlcheaderpromolinks,
        #wlcheaderquicklinks {
          display: none !important;
          float: none !important;
          width: 100% !important;
          justify-content: flex-start !important;
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
          order: 2;
        }

        .wl-header-locations-mobile:hover {
          color: #fff !important;
          background: #540010;
        }

        #ctl00_PageHeader_searchBarTableRow {
          flex-wrap: wrap;
          align-items: stretch !important;
          gap: 10px;
        }

        #ctl00_PageHeader_searchBarTableRow > div:first-child {
          order: 1;
          flex: 0 0 auto;
        }

        #ctl00_PageHeader_searchBarTableRow > .flex-grow-1 {
          order: 3;
          flex: 1 1 100%;
          width: 100%;
        }

        #Div_SearchControls {
          gap: 8px;
        }

        #c50_1 {
          width: 130px;
          flex: 0 0 130px;
        }
      }

      @media (max-width: 767px) {
        #wlcheaderpromolinks,
        #wlcheaderquicklinks,
        #ctl00_PageHeader_searchBarTableRow {
          padding-left: 12px !important;
          padding-right: 12px !important;
        }

        #Div_SearchControls {
          flex-wrap: wrap;
          align-items: stretch;
        }

        #c50_1 {
          width: 100%;
          flex: 1 1 100%;
          order: 1;
        }

        #c50_2 {
          width: 100%;
          flex: 1 1 100%;
          order: 2;
        }

        #c50_2 > div:first-child,
        #c50_2 > .RadSearchBox,
        #c50_2 > .RadSearchBox_MetroTouch,
        #ctl00_PageHeader_GlobalSearchControl_SearchPanel {
          flex: 1 1 auto;
          width: auto !important;
        }

        #barcode-scanner-container {
          flex: 0 0 auto;
          align-self: stretch;
        }

        #start-scanner {
          width: 44px !important;
          height: 44px !important;
          min-width: 44px !important;
          min-height: 44px !important;
        }
      }

      @media (max-width: 575px) {
        #wlcheader {
          min-height: 64px !important;
          gap: 8px !important;
          padding: 6px 10px !important;
        }

        #wlcheader > a img {
          width: 110px !important;
          padding: 5px !important;
          border-radius: 10px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.12);
        }

        #ctl00_PageHeader_searchBarTableRow {
          gap: 8px;
          padding-top: 10px;
        }

        #c50_1 {
          display: none;
        }

        #c50_2 {
          flex-wrap: nowrap;
        }

        #c50_2 > div:first-child,
        #c50_2 > .RadSearchBox,
        #c50_2 > .RadSearchBox_MetroTouch,
        #ctl00_PageHeader_GlobalSearchControl_SearchPanel {
          flex: 1 1 auto;
          min-width: 0;
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

  function removeUnusedHeaderSections() {
    ["wlcheadersect2", "wlcheadersect3", "wlcheadersect4", "wlcheadersect5"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.setProperty("display", "none", "important");
    });
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
    removeUnusedHeaderSections();
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
