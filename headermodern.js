(function () {
  "use strict";

  var LOG = "[WL HeaderEnhancer]";
  var DEBUG = false; // Set to true only when actively troubleshooting.
  var LOCATIONS_URL = "/Default.aspx?view=storelocations";
  var ANALYTICS_URL = "https://ckunkel510.github.io/WL.github.io/wl-events.js?v=20260701-1";
  var ADDRESS_MANAGER_URL = "https://ckunkel510.github.io/WL.github.io/AddressManagement.js?v=20260706-1";
  var QUAGGA_URL = "https://unpkg.com/quagga@0.12.1/dist/quagga.min.js";
  var STORE_NAMES = ["Brenham", "Bryan", "Caldwell", "Lexington", "Groesbeck", "Mexia", "Buffalo"];
  var CENTRAL_TIME_ZONE = "America/Chicago";
  var mobileMenuNameRequest = null;

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

  function loadAddressManager() {
    var path = (window.location.pathname || "").toLowerCase();
    if (!/(?:addresslist_r|addressdetails|shoppingcart)\.aspx$/.test(path)) return;
    if (window.WLAddressManager || document.querySelector("script[data-wl-address-manager]")) return;

    var script = document.createElement("script");
    script.src = ADDRESS_MANAGER_URL;
    script.async = true;
    script.setAttribute("data-wl-address-manager", "true");
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

      body #aspnetForm .site-content > #PageHeaderDiv > #siteHeaderContent {
        display: block !important;
        box-sizing: border-box;
        width: min(1180px, calc(100% - 32px)) !important;
        height: auto !important;
        min-height: 0 !important;
        margin: 0 auto;
      }

      body #aspnetForm #ctl00_PageHeader_branding,
      body #aspnetForm #brandingLogo {
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

      #wlcheader.wl-has-store-hours {
        min-height: 82px !important;
        height: 82px !important;
        flex-direction: column;
        justify-content: center !important;
      }

      #wlcheader.wl-has-store-hours > a:first-child img {
        width: 136px !important;
        max-height: 45px;
      }

      #wl-store-hours {
        display: none !important;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: 160px !important;
        min-width: 160px !important;
        height: auto !important;
        min-height: 25px !important;
        gap: 6px;
        max-width: 170px;
        flex: 0 0 auto !important;
        margin-top: 1px;
        color: #202327 !important;
        font-family: Arial, Helvetica, sans-serif;
        line-height: 1.15;
        text-align: left;
        text-decoration: none !important;
      }

      #wl-store-hours[data-ready="true"] {
        display: inline-flex !important;
      }

      .wl-store-hours-dot {
        width: 7px;
        height: 7px;
        flex: 0 0 7px;
        background: #6f767c;
        border-radius: 50%;
      }

      #wl-store-hours[data-state="open"] .wl-store-hours-dot {
        background: #218739;
      }

      #wl-store-hours[data-state="opening"] .wl-store-hours-dot,
      #wl-store-hours[data-state="closing"] .wl-store-hours-dot {
        background: #b16a00;
      }

      .wl-store-hours-copy {
        display: flex !important;
        flex-direction: column;
        width: 147px !important;
        min-width: 147px !important;
        max-width: 147px !important;
        flex: 0 0 147px !important;
        visibility: visible !important;
        opacity: 1 !important;
      }

      .wl-store-hours-name {
        display: block !important;
        width: 147px !important;
        overflow: hidden;
        color: #6b0016 !important;
        font-size: 11px;
        font-weight: 800;
        line-height: 1.15 !important;
        text-overflow: ellipsis;
        visibility: visible !important;
        opacity: 1 !important;
        white-space: nowrap;
      }

      .wl-store-hours-status {
        display: block !important;
        width: 147px !important;
        overflow: hidden;
        color: #202327 !important;
        font-size: 11px;
        font-weight: 400;
        line-height: 1.15 !important;
        text-overflow: ellipsis;
        visibility: visible !important;
        opacity: 1 !important;
        white-space: nowrap;
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

      body #aspnetForm #barcode-scanner-container {
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

      #wl-mobile-account-menu {
        display: none;
      }

      #wl-mobile-account-menu[hidden] {
        display: none !important;
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

        .sticky-header .menu-t1 {
          display: none !important;
        }

        body.wl-mobile-menu-open {
          overflow: hidden !important;
          touch-action: none;
        }

        #wl-mobile-account-menu {
          position: fixed;
          inset: 0;
          z-index: 100500;
          display: flex;
          box-sizing: border-box;
          width: 100%;
          height: 100vh;
          height: 100dvh;
          flex-direction: column;
          color: #202327;
          background: #f4f5f6;
          font-family: Arial, Helvetica, sans-serif;
        }

        .wl-mobile-menu-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          padding: max(18px, env(safe-area-inset-top)) 18px 20px;
          color: #fff;
          background: #6b0016;
        }

        .wl-mobile-menu-welcome {
          min-width: 0;
          padding-top: 2px;
        }

        #wl-mobile-menu-title {
          margin: 0;
          color: #fff;
          font-size: 24px;
          font-weight: 800;
          line-height: 1.18;
          letter-spacing: 0;
          overflow-wrap: anywhere;
        }

        .wl-mobile-menu-subtitle {
          margin: 6px 0 0;
          color: #f1e8ea;
          font-size: 14px;
          line-height: 1.35;
        }

        .wl-mobile-menu-close {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 50px;
          height: 50px;
          min-width: 50px;
          min-height: 50px;
          padding: 0;
          color: #6b0016;
          font-size: 21px;
          background: #fff;
          border: 2px solid #b8bdc2;
          border-radius: 6px;
          cursor: pointer;
        }

        .wl-mobile-menu-close:focus-visible {
          outline: 3px solid #b8bdc2;
          outline-offset: 2px;
        }

        .wl-mobile-menu-link:focus-visible,
        .wl-mobile-menu-action:focus-visible {
          outline: 3px solid #f5c400;
          outline-offset: 2px;
        }

        .wl-mobile-menu-scroll {
          flex: 1 1 auto;
          min-height: 0;
          padding: 18px 16px max(28px, env(safe-area-inset-bottom));
          overflow-x: hidden;
          overflow-y: auto;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
        }

        .wl-mobile-menu-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 20px;
        }

        .wl-mobile-menu-action {
          display: flex;
          align-items: center;
          gap: 11px;
          box-sizing: border-box;
          min-width: 0;
          min-height: 64px;
          padding: 12px 13px;
          color: #292d31 !important;
          font-size: 15px;
          font-weight: 800;
          line-height: 1.2;
          text-decoration: none !important;
          background: #fff;
          border: 1px solid #d8dbde;
          border-radius: 6px;
        }

        .wl-mobile-menu-action > i {
          color: #6b0016;
          font-size: 20px;
        }

        .wl-mobile-menu-action-label {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .wl-mobile-menu-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 24px;
          height: 24px;
          margin-left: auto;
          padding: 0 6px;
          color: #181818;
          font-size: 12px;
          background: #e2e4e6;
          border-radius: 999px;
        }

        .wl-mobile-menu-section-title {
          margin: 0 0 9px;
          color: #565d63;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0;
          text-transform: uppercase;
        }

        .wl-mobile-menu-list {
          display: grid;
          grid-template-columns: 1fr;
          gap: 7px;
        }

        .wl-mobile-menu-link {
          display: flex;
          align-items: center;
          gap: 13px;
          box-sizing: border-box;
          width: 100%;
          min-height: 56px;
          padding: 11px 14px;
          color: #292d31 !important;
          font-size: 16px;
          font-weight: 750;
          line-height: 1.25;
          text-decoration: none !important;
          background: #fff;
          border: 1px solid #dde0e2;
          border-radius: 6px;
        }

        .wl-mobile-menu-link > i {
          width: 23px;
          flex: 0 0 23px;
          color: #6b0016;
          font-size: 18px;
          text-align: center;
        }

        .wl-mobile-menu-link-label {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .wl-mobile-menu-chevron {
          margin-left: auto;
          color: #80868b;
          font-size: 13px;
        }

        .wl-mobile-menu-link--signout {
          color: #6b0016 !important;
          border-color: #c9aeb4;
        }

        #PageHeaderDiv {
          margin-top: 8px;
        }

        body #aspnetForm .site-content > #PageHeaderDiv > #siteHeaderContent {
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

        #wlcheader.wl-has-store-hours {
          min-height: 76px !important;
          height: 76px !important;
        }

        #wlcheader.wl-has-store-hours > a:first-child img {
          width: 118px !important;
          max-height: 40px;
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

        body #aspnetForm #barcode-scanner-container {
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
          border-top: 1px solid #d6d9dc;
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

      @media (min-width: 600px) and (max-width: 991px) {
        .wl-mobile-menu-scroll {
          padding-right: 24px;
          padding-left: 24px;
        }

        .wl-mobile-menu-list {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 575px) {
        body #aspnetForm .site-content > #PageHeaderDiv > #siteHeaderContent {
          width: calc(100% - 20px) !important;
        }

        #wlcheader > a img {
          width: 126px !important;
          padding: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }

        #wlcheader.wl-has-store-hours > a:first-child img {
          width: 112px !important;
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

  function matchStoreName(value) {
    var text = cleanLabel(value).toLowerCase();
    var match = "";

    STORE_NAMES.some(function (storeName) {
      if (text.indexOf(storeName.toLowerCase()) === -1) return false;
      match = storeName;
      return true;
    });

    return match;
  }

  function getCentralClock(date) {
    try {
      var parts = new Intl.DateTimeFormat("en-US", {
        timeZone: CENTRAL_TIME_ZONE,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      }).formatToParts(date);
      var values = {};

      parts.forEach(function (part) {
        if (part.type !== "literal") values[part.type] = part.value;
      });

      var dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      return {
        day: dayMap[values.weekday],
        minutes: (Number(values.hour) % 24) * 60 + Number(values.minute)
      };
    } catch (error) {
      return { day: date.getDay(), minutes: date.getHours() * 60 + date.getMinutes() };
    }
  }

  function getStoreSchedule(storeName, day) {
    if (day === 0) return null;

    var open = 7 * 60 + 30;
    var close;

    if (day === 6) {
      close = /^(Brenham|Bryan)$/.test(storeName) ? 12 * 60 : 16 * 60;
    } else if (/^(Groesbeck|Mexia)$/.test(storeName) && (day === 2 || day === 4)) {
      close = 19 * 60;
    } else {
      close = 17 * 60 + 30;
    }

    return { open: open, close: close };
  }

  function formatStoreTime(minutes) {
    var hour = Math.floor(minutes / 60);
    var minute = minutes % 60;
    var suffix = hour >= 12 ? "PM" : "AM";
    var displayHour = hour % 12 || 12;
    return displayHour + ":" + String(minute).padStart(2, "0") + " " + suffix;
  }

  function getNextOpening(storeName, day) {
    var weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    for (var offset = 1; offset <= 7; offset++) {
      var nextDay = (day + offset) % 7;
      var schedule = getStoreSchedule(storeName, nextDay);
      if (!schedule) continue;

      return {
        label: offset === 1 ? "tomorrow" : weekdayNames[nextDay],
        time: formatStoreTime(schedule.open)
      };
    }

    return null;
  }

  function getStoreHoursStatus(storeName, date) {
    var clock = getCentralClock(date || new Date());
    var schedule = getStoreSchedule(storeName, clock.day);

    if (schedule && clock.minutes < schedule.open) {
      var opensIn = schedule.open - clock.minutes;
      return {
        state: opensIn <= 60 ? "opening" : "closed",
        text: (opensIn <= 60 ? "Opens soon · " : "Opens at ") + formatStoreTime(schedule.open)
      };
    }

    if (schedule && clock.minutes < schedule.close) {
      var closesIn = schedule.close - clock.minutes;
      return {
        state: closesIn <= 60 ? "closing" : "open",
        text: (closesIn <= 60 ? "Closing soon · " : "Open until ") + formatStoreTime(schedule.close)
      };
    }

    var nextOpening = getNextOpening(storeName, clock.day);
    return {
      state: "closed",
      text: nextOpening ? "Opens " + nextOpening.label + " at " + nextOpening.time : "Closed"
    };
  }

  function detectStoreName() {
    var storeName = "";

    try {
      ["wlDetectedStore", "storeBranchKey", "storeName"].some(function (key) {
        storeName = matchStoreName(window.sessionStorage.getItem(key));
        return Boolean(storeName);
      });
    } catch (error) {
      storeName = "";
    }

    if (storeName) return storeName;

    var selectedBranch = document.querySelector("[id$='ddBranch'] option:checked, [id$='ddBranch'] option[selected='selected']");
    storeName = matchStoreName(selectedBranch ? selectedBranch.textContent : "");
    if (storeName) return storeName;

    var stockMessages = document.querySelectorAll(".wl-stock-message, #LocalStockRow");
    Array.prototype.some.call(stockMessages, function (message) {
      storeName = matchStoreName(message.textContent);
      return Boolean(storeName);
    });

    return storeName;
  }

  function rememberStoreName(storeName) {
    try {
      window.sessionStorage.setItem("wlDetectedStore", storeName);
    } catch (error) {
      debugLog("store context could not be cached", error);
    }
  }

  function addStoreHours() {
    if (document.getElementById("wl-store-hours")) return false;

    var target = document.getElementById("wlcheader");
    if (!target) return false;

    var link = document.createElement("a");
    link.id = "wl-store-hours";
    link.href = LOCATIONS_URL;
    link.title = "Store hours and locations";

    var dot = document.createElement("span");
    dot.className = "wl-store-hours-dot";
    dot.setAttribute("aria-hidden", "true");

    var copy = document.createElement("span");
    copy.className = "wl-store-hours-copy";

    var name = document.createElement("strong");
    name.className = "wl-store-hours-name";

    var status = document.createElement("span");
    status.className = "wl-store-hours-status";

    copy.appendChild(name);
    copy.appendChild(status);
    link.appendChild(dot);
    link.appendChild(copy);
    target.appendChild(link);
    return true;
  }

  function renderStoreHours(storeName) {
    var link = document.getElementById("wl-store-hours");
    var target = document.getElementById("wlcheader");
    if (!link || !target || !storeName) return false;

    var hoursStatus = getStoreHoursStatus(storeName, new Date());
    var name = link.querySelector(".wl-store-hours-name");
    var status = link.querySelector(".wl-store-hours-status");

    name.textContent = storeName;
    status.textContent = hoursStatus.text;
    link.setAttribute("data-ready", "true");
    link.setAttribute("data-state", hoursStatus.state);
    link.setAttribute("data-store", storeName);
    link.setAttribute("aria-label", storeName + ". " + hoursStatus.text);
    target.classList.add("wl-has-store-hours");
    rememberStoreName(storeName);
    return true;
  }

  function renderStoreHoursPrompt() {
    var link = document.getElementById("wl-store-hours");
    var target = document.getElementById("wlcheader");
    if (!link || !target || link.getAttribute("data-store")) return false;

    var name = link.querySelector(".wl-store-hours-name");
    var status = link.querySelector(".wl-store-hours-status");
    name.textContent = "Store hours";
    status.textContent = "Choose a location";
    link.setAttribute("data-ready", "true");
    link.setAttribute("data-state", "unknown");
    link.setAttribute("aria-label", "Choose a location to view store hours");
    target.classList.add("wl-has-store-hours");
    return true;
  }

  function fetchSelectedStore(callback) {
    if (typeof window.fetch !== "function") return;

    window.fetch("/AccountSettings.aspx?cms=1", { credentials: "include" })
      .then(function (response) {
        return response.ok ? response.text() : "";
      })
      .then(function (html) {
        if (!html) return;
        var doc = new DOMParser().parseFromString(html, "text/html");
        var selected = doc.querySelector("#ctl00_PageBody_ChangeUserDetailsControl_ddBranch option:checked, #ctl00_PageBody_ChangeUserDetailsControl_ddBranch option[selected='selected']");
        var storeName = matchStoreName(selected ? selected.textContent : "");
        if (storeName) callback(storeName);
      })
      .catch(function () {});
  }

  function startStoreHoursTracking() {
    var link = document.getElementById("wl-store-hours");
    if (!link || link.getAttribute("data-wl-watching") === "true") return false;

    link.setAttribute("data-wl-watching", "true");
    var discoveryTries = 0;

    function updateDetectedStore() {
      var storeName = detectStoreName() || link.getAttribute("data-store") || "";
      return storeName ? renderStoreHours(storeName) : false;
    }

    if (!updateDetectedStore()) renderStoreHoursPrompt();
    fetchSelectedStore(renderStoreHours);

    var discoveryTimer = window.setInterval(function () {
      discoveryTries++;
      if (updateDetectedStore() || discoveryTries >= 20) window.clearInterval(discoveryTimer);
    }, 750);

    window.setInterval(updateDetectedStore, 60 * 1000);
    return true;
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

  function normalizeHeaderContainers() {
    var elements = [
      document.getElementById("PageHeaderDiv"),
      document.getElementById("siteHeaderContent"),
      document.getElementById("ctl00_PageHeader_branding"),
      document.getElementById("brandingLogo"),
      document.querySelector("#brandingLogo > .UserContent")
    ];
    var changed = false;

    elements.forEach(function (element) {
      if (!element || element.getAttribute("data-wl-header-auto-height") === "true") return;
      element.style.setProperty("height", "auto", "important");
      element.style.setProperty("min-height", "0", "important");
      element.setAttribute("data-wl-header-auto-height", "true");
      changed = true;
    });

    return changed;
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

  function getMobileMenuIcon(label) {
    var normalized = cleanLabel(label).toLowerCase();
    var icons = {
      "home": "fa-home",
      "account information": "fa-user-circle",
      "quicklists": "fa-heart",
      "quotes": "fa-file-alt",
      "orders": "fa-box",
      "invoices": "fa-file-invoice-dollar",
      "credit notes": "fa-receipt",
      "products purchased": "fa-shopping-bag",
      "statements": "fa-list-alt",
      "addresses": "fa-map-marker-alt",
      "contacts": "fa-address-book",
      "dashboards": "fa-chart-line",
      "settings": "fa-cog",
      "help": "fa-question-circle",
      "about us": "fa-info-circle",
      "change my store": "fa-store",
      "sign in": "fa-sign-in-alt",
      "sign out": "fa-sign-out-alt"
    };

    return icons[normalized] || "fa-chevron-circle-right";
  }

  function getAccountDisplayName(doc) {
    var heading = doc && doc.querySelector(".panel.panelAccountInfo .listPageHeader");
    var value = cleanLabel(heading && heading.textContent);

    if (!value) return "";

    return value
      .replace(/^Account Information for\s*/i, "")
      .replace(/\s*\([^)]*\)\s*$/, "")
      .trim();
  }

  function updateMobileMenuGreeting(menu, signedIn, accountName) {
    if (!menu) return;

    var title = menu.querySelector("#wl-mobile-menu-title");
    var subtitle = menu.querySelector(".wl-mobile-menu-subtitle");
    if (!title || !subtitle) return;

    if (!signedIn) {
      title.textContent = "Howdy, welcome to Woodson";
      subtitle.textContent = "Sign in for account tools and saved items.";
      return;
    }

    title.textContent = accountName ? "Howdy, " + accountName : "Howdy, welcome back";
    subtitle.textContent = "Your Woodson account and shopping shortcuts.";
  }

  function hydrateMobileMenuGreeting(menu, signedIn) {
    var storageKey = "wlAccountDisplayName";
    var currentName = getAccountDisplayName(document);

    if (!signedIn) {
      try {
        window.sessionStorage.removeItem(storageKey);
      } catch (error) {
        debugLog("account name cache unavailable", error);
      }
      updateMobileMenuGreeting(menu, false, "");
      return;
    }

    if (currentName) {
      try {
        window.sessionStorage.setItem(storageKey, currentName);
      } catch (error) {
        debugLog("account name cache unavailable", error);
      }
      updateMobileMenuGreeting(menu, true, currentName);
      return;
    }

    try {
      currentName = cleanLabel(window.sessionStorage.getItem(storageKey));
    } catch (error) {
      debugLog("account name cache unavailable", error);
    }

    updateMobileMenuGreeting(menu, true, currentName);
    if (currentName || mobileMenuNameRequest || typeof window.fetch !== "function") return;

    mobileMenuNameRequest = window.fetch("/AccountInfo_R.aspx", { credentials: "same-origin" })
      .then(function (response) {
        if (!response.ok) throw new Error("Account information request failed");
        return response.text();
      })
      .then(function (html) {
        var parsed = new DOMParser().parseFromString(html, "text/html");
        var name = getAccountDisplayName(parsed);
        if (!name) return;

        try {
          window.sessionStorage.setItem(storageKey, name);
        } catch (error) {
          debugLog("account name cache unavailable", error);
        }
        updateMobileMenuGreeting(menu, true, name);
      })
      .catch(function (error) {
        debugLog("account name unavailable", error);
      });
  }

  function buildMobileMenuAction(source, label, iconClass) {
    if (!source) return null;

    var link = document.createElement("a");
    var badge = source.querySelector(".link-badge");
    var count = cleanLabel(badge && badge.textContent) || "0";

    link.className = "wl-mobile-menu-action";
    link.href = source.getAttribute("href") || "#";
    link.innerHTML =
      '<i class="fas ' + iconClass + '" aria-hidden="true"></i>' +
      '<span class="wl-mobile-menu-action-label"></span>' +
      '<span class="wl-mobile-menu-count" aria-label="' + count + ' items">' + count + "</span>";
    link.querySelector(".wl-mobile-menu-action-label").textContent = label;

    return link;
  }

  function buildMobileAccountMenu() {
    if (document.getElementById("wl-mobile-account-menu")) return false;

    var accountNav = document.querySelector(".sticky-header .main-nav");
    var accountMenu = accountNav && accountNav.querySelector(".hamburger");
    var nativeList = accountNav && accountNav.querySelector(".menu-t1");
    if (!accountNav || !accountMenu || !nativeList) return false;

    var menu = document.createElement("section");
    menu.id = "wl-mobile-account-menu";
    menu.hidden = true;
    menu.setAttribute("role", "dialog");
    menu.setAttribute("aria-modal", "true");
    menu.setAttribute("aria-labelledby", "wl-mobile-menu-title");
    menu.innerHTML =
      '<header class="wl-mobile-menu-head">' +
        '<div class="wl-mobile-menu-welcome">' +
          '<h2 id="wl-mobile-menu-title">Howdy, welcome to Woodson</h2>' +
          '<p class="wl-mobile-menu-subtitle">Your account and shopping shortcuts.</p>' +
        '</div>' +
        '<button type="button" class="wl-mobile-menu-close" aria-label="Close menu" title="Close menu">' +
          '<i class="fas fa-times" aria-hidden="true"></i>' +
        '</button>' +
      '</header>' +
      '<div class="wl-mobile-menu-scroll">' +
        '<div class="wl-mobile-menu-actions" aria-label="Shopping shortcuts"></div>' +
        '<nav aria-label="Account menu">' +
          '<h3 class="wl-mobile-menu-section-title">Menu</h3>' +
          '<div class="wl-mobile-menu-list"></div>' +
        '</nav>' +
      '</div>';

    var actions = menu.querySelector(".wl-mobile-menu-actions");
    var list = menu.querySelector(".wl-mobile-menu-list");
    var cart = accountNav.querySelector("a[href*='ShoppingCart.aspx']");
    var saved = accountNav.querySelector("#ctl00_MainMenu_QuickList_QuickListsButton");
    var cartAction = buildMobileMenuAction(cart, "Cart", "fa-shopping-cart");
    var savedAction = buildMobileMenuAction(saved, "Saved items", "fa-heart");

    [cartAction, savedAction].forEach(function (action) {
      if (action) actions.appendChild(action);
    });

    nativeList.querySelectorAll("a").forEach(function (source) {
      var label = cleanLabel(source.textContent);
      var href = source.getAttribute("href");
      if (!label || !href) return;

      var link = document.createElement("a");
      link.className = "wl-mobile-menu-link";
      if (/^sign out$/i.test(label)) link.classList.add("wl-mobile-menu-link--signout");
      link.href = href;
      link.innerHTML =
        '<i class="fas ' + getMobileMenuIcon(label) + '" aria-hidden="true"></i>' +
        '<span class="wl-mobile-menu-link-label"></span>' +
        '<i class="fas fa-chevron-right wl-mobile-menu-chevron" aria-hidden="true"></i>';
      link.querySelector(".wl-mobile-menu-link-label").textContent = label;
      list.appendChild(link);
    });

    var signedIn = !!nativeList.querySelector("a[href*='SignOut=1']");
    var closeButton = menu.querySelector(".wl-mobile-menu-close");

    function closeMenu(restoreFocus) {
      menu.hidden = true;
      document.body.classList.remove("wl-mobile-menu-open");
      accountMenu.classList.remove("is-active");
      accountMenu.setAttribute("aria-expanded", "false");
      if (restoreFocus !== false) accountMenu.focus();
    }

    function openMenu() {
      menu.hidden = false;
      document.body.classList.add("wl-mobile-menu-open");
      accountMenu.classList.add("is-active");
      accountMenu.setAttribute("aria-expanded", "true");
      hydrateMobileMenuGreeting(menu, signedIn);
      closeButton.focus();
    }

    accountMenu.removeAttribute("onclick");
    accountMenu.setAttribute("aria-controls", menu.id);
    accountMenu.setAttribute("aria-expanded", "false");
    accountMenu.addEventListener("click", function (event) {
      if (!window.matchMedia("(max-width: 991px)").matches) {
        if (typeof window.toggleMenu === "function") window.toggleMenu();
        return;
      }

      event.preventDefault();
      menu.hidden ? openMenu() : closeMenu();
    });

    closeButton.addEventListener("click", function () {
      closeMenu();
    });

    menu.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeMenu(false);
    });

    menu.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }

      if (event.key !== "Tab") return;
      var focusable = menu.querySelectorAll("a[href], button:not([disabled])");
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    window.addEventListener("resize", function () {
      if (!menu.hidden && !window.matchMedia("(max-width: 991px)").matches) closeMenu(false);
    });

    document.body.appendChild(menu);
    hydrateMobileMenuGreeting(menu, signedIn);
    return true;
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
      !!document.getElementById("wl-store-hours") &&
      !!document.getElementById("wl-mobile-account-menu") &&
      !!quick.querySelector(".wl-header-locations-desktop") &&
      !!row.querySelector(".wl-header-locations-mobile");
  }

  function run() {
    var changed = false;

    changed = injectStyles() || changed;
    changed = normalizeHeaderContainers() || changed;
    changed = buildDepartmentMenu() || changed;
    changed = enhanceHeaderControls() || changed;
    changed = buildMobileAccountMenu() || changed;
    changed = removeUnusedHeaderSections() || changed;
    changed = upgradeTopLinksAccessibility() || changed;
    changed = addStoreHours() || changed;
    changed = startStoreHoursTracking() || changed;
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
  loadAddressManager();

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
