(function () {
  "use strict";

  var LOG = "[WL HeaderEnhancer]";
  var DEBUG = false; // Set to true only when actively troubleshooting.
  var LOCATIONS_URL = "/Default.aspx?view=storelocations";
  var ANALYTICS_URL = "https://ckunkel510.github.io/WL.github.io/wl-events.js?v=20260701-1";
  var QUAGGA_URL = "https://unpkg.com/quagga@0.12.1/dist/quagga.min.js";

  function debugLog() {
    if (!DEBUG || !window.console || typeof window.console.log !== "function") return;
    window.console.log.apply(window.console, [LOG].concat(Array.prototype.slice.call(arguments)));
  }

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  function loadAnalytics() {
    if (window.WLAnalytics || document.querySelector("script[data-wl-analytics]")) return;

    var script = document.createElement("script");
    script.src = ANALYTICS_URL;
    script.async = true;
    script.setAttribute("data-wl-analytics", "true");
    document.head.appendChild(script);
  }

  function injectStyles() {
    if (document.getElementById("wl-header-enhancer-styles")) return false;

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

      /* Header v2: compact hierarchy, persistent search, and responsive departments. */
      .sticky-header {
        min-height: 38px !important;
        background: #6b0016 !important;
        border-bottom: 1px solid #d6d9dc;
        box-shadow: none !important;
      }

      .sticky-header .main-nav {
        box-sizing: border-box;
        width: min(1180px, calc(100% - 32px));
        min-height: 38px;
        margin: 0 auto;
        justify-content: flex-end;
      }

      .sticky-header .nav-link,
      .sticky-header .header-link,
      .sticky-header .hamburger {
        color: #fff !important;
      }

      body #aspnetForm .site-content > #PageHeaderDiv {
        width: 100vw !important;
        max-width: none !important;
        height: auto !important;
        min-height: 0 !important;
        margin: 0 !important;
        background: #fff;
        border-bottom: 1px solid #dfe2e5;
        box-shadow: 0 5px 18px rgba(23, 27, 31, 0.08);
      }

      #siteHeaderContent {
        display: block !important;
        box-sizing: border-box;
        width: min(1180px, calc(100% - 32px)) !important;
        height: auto !important;
        min-height: 0 !important;
        margin: 0 auto;
      }

      #ctl00_PageHeader_branding,
      #brandingLogo {
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
      }

      #brandingLogo > .UserContent {
        display: grid !important;
        grid-template-columns: 170px auto minmax(0, 1fr);
        align-items: center;
        gap: 18px;
        min-height: 72px;
      }

      #brandingLogo > .UserContent > span:last-child {
        display: none !important;
      }

      #wlcheader {
        width: auto !important;
        min-height: 72px !important;
        height: 72px !important;
        gap: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
      }

      #wlcheader > a img {
        display: block;
        width: 158px !important;
        max-height: 60px;
        padding: 0 !important;
        object-fit: contain;
        background: transparent !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }

      #wlcheaderpromolinks,
      #wlcheaderquicklinks {
        width: auto !important;
        min-height: 40px !important;
        padding: 0 !important;
        background: transparent !important;
        flex-wrap: nowrap !important;
      }

      #wlcheaderpromolinks {
        gap: 7px;
      }

      #wlcheaderquicklinks {
        justify-content: flex-end !important;
        gap: 2px;
        overflow: hidden;
      }

      #wlcheaderpromolinks a {
        min-height: 34px;
        padding: 7px 10px !important;
        color: #181818 !important;
        background: #f5c400 !important;
        border: 1px solid #d5aa00;
        border-radius: 6px !important;
        white-space: nowrap;
      }

      #wlcheaderpromolinks a:hover {
        color: #181818 !important;
        background: #ffd529 !important;
      }

      #wlcheaderquicklinks a {
        min-height: 34px;
        padding: 7px 8px !important;
        color: #30343a !important;
        background: transparent !important;
        border-radius: 4px !important;
        white-space: nowrap;
      }

      #wlcheaderquicklinks a:hover {
        color: #6b0016 !important;
        background: #f2f3f4 !important;
      }

      #wlcheaderquicklinks .wl-header-locations-desktop {
        min-height: 38px;
        margin-right: 5px;
        padding: 8px 12px !important;
        color: #fff !important;
        background: #6b0016 !important;
        border-radius: 6px !important;
        box-shadow: none;
      }

      #wlcheaderquicklinks .wl-header-locations-desktop:hover {
        color: #fff !important;
        background: #510010 !important;
        transform: none;
      }

      #pageTitleHeader {
        display: none !important;
      }

      #ctl00_PageHeader_searchBarTableRow {
        position: relative !important;
        top: auto !important;
        right: auto !important;
        bottom: auto !important;
        left: auto !important;
        z-index: 110;
        display: grid !important;
        box-sizing: border-box;
        width: 100% !important;
        grid-template-columns: 218px minmax(0, 1fr);
        align-items: center !important;
        gap: 14px;
        min-height: 72px;
        padding: 11px 0 13px !important;
        background: #f6f7f8 !important;
        border-top: 1px solid #e4e6e8;
      }

      #ctl00_PageHeader_searchBarTableRow::before {
        position: absolute;
        inset: 0 calc(50% - 50vw);
        z-index: -1;
        content: "";
        background: #f6f7f8;
        border-top: 1px solid #e4e6e8;
      }

      #ctl00_PageHeader_searchBarTableRow > .flex-grow-1 {
        grid-column: 2;
        min-width: 0;
      }

      .wl-native-department-menu {
        display: none !important;
      }

      #wl-department-nav {
        position: relative;
        z-index: 130;
        grid-column: 1;
        min-width: 0;
      }

      #wl-department-trigger {
        display: inline-flex;
        align-items: center;
        justify-content: flex-start;
        gap: 10px;
        width: 100%;
        min-height: 48px;
        padding: 10px 14px;
        color: #fff;
        font-size: 14px;
        font-weight: 800;
        text-align: left;
        background: #6b0016;
        border: 1px solid #6b0016;
        border-radius: 6px;
        cursor: pointer;
      }

      #wl-department-trigger:hover,
      #wl-department-trigger[aria-expanded="true"] {
        background: #510010;
      }

      #wl-department-trigger .wl-department-chevron {
        margin-left: auto;
        transition: transform 0.18s ease;
      }

      #wl-department-trigger[aria-expanded="true"] .wl-department-chevron {
        transform: rotate(180deg);
      }

      #wl-department-panel[hidden] {
        display: none !important;
      }

      #wl-department-panel {
        position: absolute;
        top: calc(100% + 9px);
        left: 0;
        box-sizing: border-box;
        width: min(980px, calc(100vw - 32px));
        padding: 18px;
        color: #24272b;
        background: #fff;
        border: 1px solid #d8dbde;
        border-top: 4px solid #6b0016;
        border-radius: 0 0 8px 8px;
        box-shadow: 0 18px 46px rgba(20, 24, 28, 0.22);
      }

      .wl-department-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 14px;
      }

      .wl-department-panel-title {
        margin: 0;
        color: #24272b;
        font-size: 20px;
        font-weight: 800;
      }

      .wl-department-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        padding: 0;
        color: #4b5055;
        background: #f2f3f4;
        border: 1px solid #d8dbde;
        border-radius: 6px;
        cursor: pointer;
      }

      .wl-department-search {
        position: relative;
        margin-bottom: 14px;
      }

      .wl-department-search > i {
        position: absolute;
        top: 50%;
        left: 14px;
        color: #6b0016;
        transform: translateY(-50%);
        pointer-events: none;
      }

      .wl-department-search input {
        box-sizing: border-box;
        width: 100%;
        min-height: 44px;
        padding: 10px 14px 10px 40px;
        color: #202327;
        font-size: 16px;
        background: #fff;
        border: 1px solid #bfc4c8;
        border-radius: 6px;
      }

      .wl-department-search input:focus {
        border-color: #6b0016;
        outline: 3px solid rgba(107, 0, 22, 0.15);
      }

      .wl-department-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 4px 14px;
        max-height: min(58vh, 520px);
        overflow: auto;
        overscroll-behavior: contain;
      }

      .wl-department-featured-row {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 10px;
      }

      .wl-department-featured-row .wl-department-link {
        justify-content: center;
        min-height: 44px;
        border: 1px solid #d5aa00;
      }

      .wl-department-link {
        display: flex;
        align-items: center;
        min-height: 42px;
        padding: 8px 10px;
        color: #292d31 !important;
        font-size: 14px;
        font-weight: 700;
        line-height: 1.25;
        text-decoration: none !important;
        border-bottom: 1px solid #eceeef;
        border-radius: 4px;
      }

      .wl-department-link:hover,
      .wl-department-link:focus {
        color: #6b0016 !important;
        background: #f2f3f4;
        outline: none;
      }

      .wl-department-link--featured {
        color: #181818 !important;
        background: #f5c400;
        border-bottom-color: #d5aa00;
      }

      .wl-department-results {
        max-height: min(58vh, 520px);
        overflow: auto;
        overscroll-behavior: contain;
      }

      .wl-department-result-status {
        margin: 0 0 9px;
        color: #5a6066;
        font-size: 13px;
        font-weight: 700;
      }

      .wl-department-result-list {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px 12px;
      }

      .wl-department-result {
        display: flex;
        flex-direction: column;
        justify-content: center;
        min-height: 48px;
        padding: 8px 10px;
        color: #292d31 !important;
        font-size: 14px;
        font-weight: 750;
        line-height: 1.25;
        text-decoration: none !important;
        background: #fff;
        border: 1px solid #e0e3e5;
        border-radius: 6px;
      }

      .wl-department-result:hover,
      .wl-department-result:focus {
        color: #6b0016 !important;
        background: #f6f7f8;
        border-color: #b8bdc1;
        outline: none;
      }

      .wl-department-result-context {
        margin-top: 3px;
        color: #6a7075;
        font-size: 12px;
        font-weight: 600;
      }

      .wl-department-empty {
        grid-column: 1 / -1;
        padding: 22px 8px;
        color: #5a6066;
        text-align: center;
      }

      .wl-department-link[hidden],
      .wl-department-empty[hidden],
      .wl-department-featured-row[hidden],
      .wl-department-grid[hidden],
      .wl-department-results[hidden] {
        display: none !important;
      }

      #Div_SearchControls {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr);
        align-items: center;
        width: 100% !important;
      }

      .prod-search-wrapper {
        width: 100% !important;
      }

      #c50_1 {
        display: none !important;
      }

      #c50_2,
      #ctl00_PageHeader_GlobalSearchControl_SearchPanel,
      #ctl00_PageHeader_GlobalSearchControl_RadSearchBox1 {
        position: relative !important;
        top: auto !important;
        right: auto !important;
        bottom: auto !important;
        left: auto !important;
        width: 100% !important;
        min-width: 0 !important;
        height: auto !important;
        transform: none !important;
      }

      #ctl00_PageHeader_GlobalSearchControl_RadSearchBox1 {
        flex: 1 1 100% !important;
      }

      #ctl00_PageHeader_GlobalSearchControl_RadSearchBox1 .rsbInner {
        box-sizing: border-box;
        min-height: 48px;
        background: #fff;
        border: 1px solid #aeb4b9;
        border-radius: 6px !important;
        box-shadow: 0 2px 8px rgba(20, 24, 28, 0.06);
      }

      #ctl00_PageHeader_GlobalSearchControl_RadSearchBox1_Input {
        box-sizing: border-box;
        min-height: 44px;
        padding-left: 14px !important;
        color: #1f2327;
        font-size: 16px !important;
      }

      #ctl00_PageHeader_GlobalSearchControl_RadSearchBox1 .rsbButton {
        min-width: 48px;
        color: #fff !important;
        background: #6b0016 !important;
        border-radius: 0 5px 5px 0 !important;
      }

      #barcode-scanner-container {
        display: none !important;
        flex: 0 0 auto;
      }

      #start-scanner {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        width: 48px !important;
        height: 48px !important;
        min-width: 48px !important;
        min-height: 48px !important;
        padding: 0;
        color: #6b0016;
        font-size: 20px;
        background: #fff !important;
        border: 1px solid #aeb4b9 !important;
        border-radius: 6px !important;
        box-shadow: 0 2px 8px rgba(20, 24, 28, 0.06);
        cursor: pointer;
      }

      #start-scanner:hover,
      #start-scanner:focus {
        color: #fff;
        background: #6b0016 !important;
        outline: none;
      }

      #wl-barcode-overlay[hidden] {
        display: none !important;
      }

      #wl-barcode-overlay {
        position: fixed;
        inset: 0;
        z-index: 100000;
        color: #fff;
        background: #111;
      }

      #wl-barcode-reader,
      #wl-barcode-reader video,
      #wl-barcode-reader canvas {
        width: 100% !important;
        height: 100% !important;
      }

      #wl-barcode-reader video,
      #wl-barcode-reader canvas {
        position: absolute;
        inset: 0;
        object-fit: cover;
      }

      .wl-barcode-guide {
        position: absolute;
        top: 50%;
        left: 50%;
        width: min(72vw, 520px);
        height: min(24vh, 190px);
        border: 3px solid #f5c400;
        border-radius: 8px;
        box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.28);
        transform: translate(-50%, -50%);
        pointer-events: none;
      }

      .wl-barcode-status {
        position: absolute;
        right: 20px;
        bottom: 28px;
        left: 20px;
        margin: 0;
        font-size: 16px;
        font-weight: 750;
        text-align: center;
        text-shadow: 0 1px 4px #000;
      }

      .wl-barcode-close {
        position: absolute;
        top: 16px;
        right: 16px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 46px;
        height: 46px;
        padding: 0;
        color: #292d31;
        background: #fff;
        border: 1px solid #d8dbde;
        border-radius: 6px;
        cursor: pointer;
      }

      body.wl-barcode-open {
        overflow: hidden !important;
      }

      .RadComboBox_MetroTouch,
      .RadComboBox_MetroTouch .rcbInner,
      .RadSearchBox_MetroTouch,
      .RadSearchBox_MetroTouch .rsbInner {
        border-radius: 6px !important;
      }

      @media (max-width: 1100px) {
        #brandingLogo > .UserContent {
          grid-template-columns: 155px auto minmax(0, 1fr);
          gap: 10px;
        }

        #wlcheader > a img {
          width: 145px !important;
        }

        #wlcheaderquicklinks a {
          padding: 7px 6px !important;
          font-size: 12px !important;
        }

        .wl-department-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }

      @media (max-width: 991px) {
        .sticky-header,
        .sticky-header .main-nav {
          min-height: 42px !important;
        }

        .sticky-header .main-nav {
          width: 100%;
          padding-left: 10px;
          padding-right: 4px;
        }

        #PageHeaderDiv {
          margin-top: 8px;
        }

        #siteHeaderContent {
          width: min(760px, calc(100% - 24px)) !important;
        }

        #brandingLogo > .UserContent {
          display: block !important;
          min-height: 64px;
        }

        #wlcheader {
          width: 100% !important;
          min-height: 64px !important;
          height: 64px !important;
          justify-content: center !important;
        }

        #wlcheader > a img {
          width: 138px !important;
          max-height: 52px;
        }

        #wlcheaderpromolinks,
        #wlcheaderquicklinks {
          display: none !important;
        }

        #ctl00_PageHeader_searchBarTableRow {
          grid-template-columns: minmax(0, 1fr) 48px;
          grid-template-areas:
            "departments location"
            "search search";
          gap: 9px;
          min-height: 118px;
          padding: 10px 0 12px !important;
        }

        #wl-department-nav {
          grid-area: departments;
          grid-column: auto;
        }

        .wl-header-locations-mobile {
          grid-area: location;
          display: inline-flex !important;
          width: 48px;
          height: 48px;
          min-width: 48px;
          min-height: 48px;
          color: #6b0016 !important;
          background: #fff;
          border: 1px solid #bfc4c8;
          border-radius: 6px;
          box-shadow: none;
        }

        .wl-header-locations-mobile:hover {
          color: #fff !important;
          background: #6b0016;
        }

        #ctl00_PageHeader_searchBarTableRow > .flex-grow-1 {
          grid-area: search;
          grid-column: auto;
          width: 100%;
        }

        #Div_SearchControls {
          display: block !important;
        }

        #c50_1 {
          display: none !important;
        }

        #c50_2 {
          display: flex !important;
          gap: 8px;
          width: 100% !important;
        }

        #barcode-scanner-container {
          display: inline-flex !important;
        }

        #wl-department-trigger {
          min-height: 48px;
        }

        #wl-department-panel {
          position: fixed;
          top: 42px;
          right: 0;
          bottom: 0;
          left: 0;
          width: 100%;
          max-height: none;
          padding: 18px 20px 28px;
          overflow: auto;
          border: 0;
          border-top: 4px solid #f5c400;
          border-radius: 0;
          box-shadow: none;
        }

        .wl-department-panel-header {
          position: sticky;
          top: -18px;
          z-index: 2;
          padding: 14px 0 10px;
          background: #fff;
        }

        .wl-department-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          max-height: none;
          overflow: visible;
        }

        body.wl-department-open {
          overflow: hidden !important;
        }
      }

      @media (max-width: 575px) {
        #siteHeaderContent {
          width: calc(100% - 20px) !important;
        }

        #wlcheader > a img {
          width: 126px !important;
          padding: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }

        #ctl00_PageHeader_searchBarTableRow {
          min-height: 116px;
          padding-top: 9px !important;
        }

        #wl-department-trigger {
          padding: 9px 12px;
          font-size: 13px;
        }

        #wl-department-panel {
          padding-right: 14px;
          padding-left: 14px;
        }

        .wl-department-panel-title {
          font-size: 18px;
        }

        .wl-department-grid {
          grid-template-columns: 1fr;
          gap: 2px;
        }

        .wl-department-result-list {
          grid-template-columns: 1fr;
        }

        .wl-department-link {
          min-height: 44px;
        }
      }
    `;

    var style = document.createElement("style");
    style.id = "wl-header-enhancer-styles";
    style.textContent = css;
    document.head.appendChild(style);
    return true;
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

  function cleanLabel(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function collectDepartmentData() {
    var root = document.querySelector("#ctl00_PageHeader_RadMenuDesktop .rmLevel1");
    if (!root) return [];

    var seen = Object.create(null);
    var departments = [];

    Array.prototype.slice.call(root.children).forEach(function (item) {
      var link = null;

      Array.prototype.slice.call(item.children).some(function (child) {
        if (!child.matches || !child.matches("a.rmLink[href]")) return false;
        link = child;
        return true;
      });

      if (!link) return;

      var labelNode = link.querySelector(".rmText");
      var name = cleanLabel(labelNode ? labelNode.textContent : link.textContent);
      var href = link.href || link.getAttribute("href");
      var key = name + "|" + href;
      var subcategorySeen = Object.create(null);
      var subcategories = [];

      Array.prototype.forEach.call(item.querySelectorAll("a.rsmLink[href]"), function (subcategoryLink) {
        var subcategoryName = cleanLabel(subcategoryLink.textContent);
        var subcategoryHref = subcategoryLink.href || subcategoryLink.getAttribute("href");
        var subcategoryKey = subcategoryName + "|" + subcategoryHref;

        if (!subcategoryName || !subcategoryHref || subcategorySeen[subcategoryKey]) return;
        subcategorySeen[subcategoryKey] = true;
        subcategories.push({ name: subcategoryName, href: subcategoryHref });
      });

      if (!name || !href || seen[key]) return;
      if (/^store locations$/i.test(name)) return;
      if (!subcategories.length && !/^clearance$/i.test(name)) return;

      seen[key] = true;
      departments.push({ name: name, href: href, subcategories: subcategories });
    });

    return departments;
  }

  function markNativeDepartmentMenus(row) {
    [
      document.getElementById("ctl00_PageHeader_RadMenuMobile"),
      document.getElementById("RealMonsterMegaDropDown")
    ].forEach(function (menu) {
      if (!menu) return;

      var wrapper = menu;
      while (wrapper.parentElement && wrapper.parentElement !== row) {
        wrapper = wrapper.parentElement;
      }

      if (wrapper.parentElement === row) {
        wrapper.classList.add("wl-native-department-menu");
      }
    });
  }

  function buildDepartmentMenu() {
    if (document.getElementById("wl-department-nav")) return false;

    var row = document.getElementById("ctl00_PageHeader_searchBarTableRow");
    var departments = collectDepartmentData();
    if (!row || !departments.length) return false;

    markNativeDepartmentMenus(row);

    var nav = document.createElement("div");
    nav.id = "wl-department-nav";
    nav.setAttribute("data-wl-header-departments", "true");

    var trigger = document.createElement("button");
    trigger.id = "wl-department-trigger";
    trigger.type = "button";
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", "wl-department-panel");
    trigger.innerHTML =
      '<i class="fas fa-th-large" aria-hidden="true"></i>' +
      "<span>Departments</span>" +
      '<i class="fas fa-chevron-down wl-department-chevron" aria-hidden="true"></i>';

    var panel = document.createElement("div");
    panel.id = "wl-department-panel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Shop departments");

    var panelHeader = document.createElement("div");
    panelHeader.className = "wl-department-panel-header";

    var title = document.createElement("h2");
    title.className = "wl-department-panel-title";
    title.textContent = "Shop departments";

    var closeButton = document.createElement("button");
    closeButton.className = "wl-department-close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close departments");
    closeButton.title = "Close departments";
    closeButton.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';

    panelHeader.appendChild(title);
    panelHeader.appendChild(closeButton);

    var searchWrap = document.createElement("div");
    searchWrap.className = "wl-department-search";
    searchWrap.innerHTML = '<i class="fas fa-search" aria-hidden="true"></i>';

    var search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Search departments and subcategories";
    search.setAttribute("aria-label", "Search departments and subcategories");
    search.autocomplete = "off";
    searchWrap.appendChild(search);

    var featuredRow = document.createElement("div");
    featuredRow.className = "wl-department-featured-row";

    var grid = document.createElement("div");
    grid.className = "wl-department-grid";

    var searchEntries = [];
    var searchEntrySeen = Object.create(null);

    function addSearchEntry(name, href, context, isDepartment) {
      var key = name + "|" + href;
      if (searchEntrySeen[key]) return;
      searchEntrySeen[key] = true;
      searchEntries.push({
        name: name,
        href: href,
        context: context,
        isDepartment: isDepartment,
        searchText: (name + " " + context).toLowerCase()
      });
    }

    function createDepartmentLink(department, featured) {
      var link = document.createElement("a");
      link.className = "wl-department-link";
      link.href = department.href;
      link.textContent = department.name;

      if (featured) link.classList.add("wl-department-link--featured");
      return link;
    }

    departments.forEach(function (department) {
      var featured = /^(deals|clearance)$/i.test(department.name);
      var link = createDepartmentLink(department, featured);

      addSearchEntry(department.name, department.href, "Department", true);
      department.subcategories.forEach(function (subcategory) {
        addSearchEntry(subcategory.name, subcategory.href, department.name, false);
      });

      (featured ? featuredRow : grid).appendChild(link);
    });

    var results = document.createElement("div");
    results.className = "wl-department-results";
    results.hidden = true;

    var resultStatus = document.createElement("p");
    resultStatus.className = "wl-department-result-status";
    resultStatus.setAttribute("aria-live", "polite");

    var resultList = document.createElement("div");
    resultList.className = "wl-department-result-list";

    var empty = document.createElement("div");
    empty.className = "wl-department-empty";
    empty.hidden = true;
    empty.textContent = "No departments or subcategories match your search.";

    results.appendChild(resultStatus);
    results.appendChild(resultList);
    results.appendChild(empty);

    panel.appendChild(panelHeader);
    panel.appendChild(searchWrap);
    panel.appendChild(featuredRow);
    panel.appendChild(grid);
    panel.appendChild(results);
    nav.appendChild(trigger);
    nav.appendChild(panel);
    row.insertBefore(nav, row.firstChild);

    function renderSearch(value) {
      var query = cleanLabel(value).toLowerCase();

      if (!query) {
        featuredRow.hidden = false;
        grid.hidden = false;
        results.hidden = true;
        resultList.textContent = "";
        resultStatus.textContent = "";
        empty.hidden = true;
        return;
      }

      var tokens = query.split(/\s+/);
      var matches = searchEntries.filter(function (entry) {
        return tokens.every(function (token) {
          return entry.searchText.indexOf(token) !== -1;
        });
      });

      matches.sort(function (a, b) {
        var aStarts = a.name.toLowerCase().indexOf(query) === 0 ? 0 : 1;
        var bStarts = b.name.toLowerCase().indexOf(query) === 0 ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        if (a.isDepartment !== b.isDepartment) return a.isDepartment ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      featuredRow.hidden = true;
      grid.hidden = true;
      results.hidden = false;
      resultList.textContent = "";
      empty.hidden = matches.length !== 0;

      var visibleMatches = matches.slice(0, 80);
      resultStatus.textContent = matches.length > visibleMatches.length
        ? "Showing " + visibleMatches.length + " of " + matches.length + " results"
        : matches.length + (matches.length === 1 ? " result" : " results");

      visibleMatches.forEach(function (entry) {
        var resultLink = document.createElement("a");
        resultLink.className = "wl-department-result";
        resultLink.href = entry.href;

        var resultName = document.createElement("span");
        resultName.textContent = entry.name;

        var resultContext = document.createElement("span");
        resultContext.className = "wl-department-result-context";
        resultContext.textContent = entry.context;

        resultLink.appendChild(resultName);
        resultLink.appendChild(resultContext);
        resultList.appendChild(resultLink);
      });
    }

    function setOpen(open) {
      panel.hidden = !open;
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.classList.toggle("wl-department-open", open);

      if (!open) {
        search.value = "";
        renderSearch("");
      }
    }

    trigger.addEventListener("click", function () {
      setOpen(trigger.getAttribute("aria-expanded") !== "true");
    });

    closeButton.addEventListener("click", function () {
      setOpen(false);
      trigger.focus();
    });

    search.addEventListener("input", function () {
      renderSearch(search.value);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape" || panel.hidden) return;
      setOpen(false);
      trigger.focus();
    });

    document.addEventListener("click", function (event) {
      if (panel.hidden || nav.contains(event.target)) return;
      setOpen(false);
    });

    return true;
  }

  function loadQuagga(callback) {
    if (window.Quagga) {
      callback(null);
      return;
    }

    var existing = document.querySelector("script[data-wl-quagga]");
    if (existing) {
      existing.addEventListener("load", function () { callback(null); }, { once: true });
      existing.addEventListener("error", function () { callback(new Error("Scanner library failed to load")); }, { once: true });
      return;
    }

    var script = document.createElement("script");
    script.src = QUAGGA_URL;
    script.async = true;
    script.setAttribute("data-wl-quagga", "true");
    script.addEventListener("load", function () { callback(null); }, { once: true });
    script.addEventListener("error", function () { callback(new Error("Scanner library failed to load")); }, { once: true });
    document.head.appendChild(script);
  }

  function addBarcodeScanner() {
    if (document.getElementById("barcode-scanner-container")) return false;

    var target = document.getElementById("c50_2");
    if (!target) return false;

    var container = document.createElement("div");
    container.id = "barcode-scanner-container";

    var startButton = document.createElement("button");
    startButton.id = "start-scanner";
    startButton.type = "button";
    startButton.setAttribute("aria-label", "Scan a product barcode");
    startButton.title = "Scan a product barcode";
    startButton.innerHTML = '<i class="fas fa-barcode" aria-hidden="true"></i>';
    container.appendChild(startButton);
    target.appendChild(container);

    var overlay = document.createElement("div");
    overlay.id = "wl-barcode-overlay";
    overlay.hidden = true;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Barcode scanner");

    var reader = document.createElement("div");
    reader.id = "wl-barcode-reader";

    var guide = document.createElement("div");
    guide.className = "wl-barcode-guide";
    guide.setAttribute("aria-hidden", "true");

    var status = document.createElement("p");
    status.className = "wl-barcode-status";
    status.setAttribute("aria-live", "polite");
    status.textContent = "Point the camera at a product barcode";

    var closeButton = document.createElement("button");
    closeButton.className = "wl-barcode-close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close barcode scanner");
    closeButton.title = "Close barcode scanner";
    closeButton.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';

    overlay.appendChild(reader);
    overlay.appendChild(guide);
    overlay.appendChild(status);
    overlay.appendChild(closeButton);
    document.body.appendChild(overlay);

    var scannerSession = 0;
    var activeHandler = null;

    function stopScanner() {
      scannerSession++;

      if (window.Quagga) {
        try {
          if (activeHandler && typeof window.Quagga.offDetected === "function") {
            window.Quagga.offDetected(activeHandler);
          }
          window.Quagga.stop();
        } catch (error) {
          debugLog("scanner stop failed", error);
        }
      }

      activeHandler = null;
      reader.textContent = "";
      overlay.hidden = true;
      startButton.disabled = false;
      document.body.classList.remove("wl-barcode-open");
    }

    function showScannerError(message) {
      status.textContent = message;
      startButton.disabled = false;
    }

    function startScanner() {
      var session = ++scannerSession;
      var detections = Object.create(null);

      overlay.hidden = false;
      startButton.disabled = true;
      status.textContent = "Starting camera...";
      document.body.classList.add("wl-barcode-open");

      loadQuagga(function (loadError) {
        if (session !== scannerSession) return;
        if (loadError || !window.Quagga) {
          showScannerError("The scanner could not load. Close it and try again.");
          return;
        }

        window.Quagga.init({
          inputStream: {
            name: "Live",
            type: "LiveStream",
            target: reader,
            constraints: {
              facingMode: "environment"
            }
          },
          decoder: {
            readers: ["upc_reader", "ean_reader", "code_128_reader"]
          },
          locate: true,
          frequency: 8
        }, function (initError) {
          if (session !== scannerSession) return;
          if (initError) {
            showScannerError("Camera access is unavailable. Check permission and try again.");
            return;
          }

          status.textContent = "Point the camera at a product barcode";
          activeHandler = function (result) {
            var code = result && result.codeResult && result.codeResult.code;
            if (!code) return;

            detections[code] = (detections[code] || 0) + 1;
            if (detections[code] < 3) return;

            status.textContent = "Barcode found";
            stopScanner();
            window.location.href = "/Products.aspx?pg=0&searchText=" + encodeURIComponent(code);
          };

          window.Quagga.onDetected(activeHandler);
          window.Quagga.start();
        });
      });
    }

    startButton.addEventListener("click", startScanner);
    closeButton.addEventListener("click", stopScanner);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !overlay.hidden) stopScanner();
    });

    return true;
  }

  function enhanceHeaderControls() {
    var changed = false;
    var search = document.getElementById("ctl00_PageHeader_GlobalSearchControl_RadSearchBox1_Input");
    var logo = document.querySelector("#wlcheader img");
    var accountNav = document.querySelector(".sticky-header .main-nav");
    var cart = document.querySelector(".sticky-header a[href*='ShoppingCart.aspx']");
    var saved = document.getElementById("ctl00_MainMenu_QuickList_QuickListsButton");
    var accountMenu = document.querySelector(".sticky-header .hamburger");

    if (search && search.getAttribute("data-wl-header-search") !== "true") {
      search.placeholder = "Search products, brands, or item numbers";
      search.setAttribute("aria-label", "Search products");
      search.setAttribute("data-wl-header-search", "true");
      changed = true;
    }

    if (logo && !cleanLabel(logo.alt)) {
      logo.alt = "Woodson Lumber";
      changed = true;
    }

    if (accountNav && !accountNav.getAttribute("aria-label")) {
      accountNav.setAttribute("aria-label", "Account and cart");
      changed = true;
    }

    [
      { element: cart, label: "Shopping cart" },
      { element: saved, label: "Saved items" },
      { element: accountMenu, label: "Account menu" }
    ].forEach(function (control) {
      if (!control.element || control.element.getAttribute("data-wl-header-label") === "true") return;
      control.element.setAttribute("aria-label", control.label);
      control.element.setAttribute("title", control.label);
      control.element.setAttribute("data-wl-header-label", "true");
      changed = true;
    });

    return changed;
  }

  function removeUnusedHeaderSections() {
    var changed = false;
    ["wlcheadersect2", "wlcheadersect3", "wlcheadersect4", "wlcheadersect5"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (el.getAttribute("data-wl-header-hidden") === "true") return;
      el.style.setProperty("display", "none", "important");
      el.setAttribute("data-wl-header-hidden", "true");
      changed = true;
    });
    return changed;
  }

  function addDesktopLocationsButton() {
    var target = document.getElementById("wlcheaderquicklinks");
    if (!target) return false;
    if (target.querySelector(".wl-header-locations-desktop")) return false;

    var a = document.createElement("a");
    a.className = "wl-header-locations-desktop";
    a.href = LOCATIONS_URL;
    a.innerHTML = pinIconMarkup() + "<span>Locations</span>";

    target.insertAdjacentElement("afterbegin", a);
    return true;
  }

  function addMobileLocationsButton() {
    var row = document.getElementById("ctl00_PageHeader_searchBarTableRow");
    if (!row) return false;
    if (row.querySelector(".wl-header-locations-mobile")) return false;

    var anchor = document.createElement("a");
    anchor.className = "wl-header-locations-mobile";
    anchor.href = LOCATIONS_URL;
    anchor.setAttribute("aria-label", "Store Locations");
    anchor.innerHTML = pinIconMarkup();

    row.insertBefore(anchor, row.lastElementChild);
    return true;
  }

  function upgradeTopLinksAccessibility() {
    var changed = false;
    var promo = document.getElementById("wlcheaderpromolinks");
    var quick = document.getElementById("wlcheaderquicklinks");

    [promo, quick].forEach(function (group) {
      if (!group) return;
      group.querySelectorAll("a").forEach(function (a) {
        var title = (a.textContent || "").trim();
        if (!title || a.getAttribute("title") === title) return;
        a.setAttribute("title", title);
        changed = true;
      });
    });

    return changed;
  }

  function isFullyEnhanced() {
    var quick = document.getElementById("wlcheaderquicklinks");
    var row = document.getElementById("ctl00_PageHeader_searchBarTableRow");

    return !!document.getElementById("wl-header-enhancer-styles") &&
      !!quick &&
      !!row &&
      !!document.getElementById("wl-department-nav") &&
      !!document.getElementById("barcode-scanner-container") &&
      !!quick.querySelector(".wl-header-locations-desktop") &&
      !!row.querySelector(".wl-header-locations-mobile");
  }

  function run() {
    var changed = false;

    changed = injectStyles() || changed;
    changed = buildDepartmentMenu() || changed;
    changed = enhanceHeaderControls() || changed;
    changed = removeUnusedHeaderSections() || changed;
    changed = upgradeTopLinksAccessibility() || changed;
    changed = addDesktopLocationsButton() || changed;
    changed = addMobileLocationsButton() || changed;
    changed = addBarcodeScanner() || changed;

    debugLog(changed ? "header enhanced" : "no header changes needed");

    return {
      changed: changed,
      complete: isFullyEnhanced()
    };
  }

  loadAnalytics();

  onReady(function () {
    var firstRun = run();
    if (firstRun.complete) return;

    // Header pieces can render a little late on WebTrack. Poll briefly, then stop
    // as soon as the desktop and mobile location buttons are in place.
    var tries = 0;
    var maxTries = 20;
    var iv = setInterval(function () {
      tries++;

      var result = run();
      if (result.complete || tries >= maxTries) {
        clearInterval(iv);
      }
    }, 250);
  });
})();
