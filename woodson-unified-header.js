(function () {
  "use strict";

  if (window.customElements && window.customElements.get("woodson-unified-header")) return;

  var scriptUrl = document.currentScript && document.currentScript.src
    ? document.currentScript.src
    : "https://ckunkel510.github.io/WL.github.io/woodson-unified-header.js";
  var assetBase = scriptUrl.slice(0, scriptUrl.lastIndexOf("/") + 1);
  var DATA_URL = assetBase + "webtrack-departments.json";
  var LOGO_URL = assetBase + "assets/woodson-built-on-quality-logo.png";
  var WEBTRACK = "https://webtrack.woodsonlumber.com";
  var MAIN_SITE = "https://www.woodsonlumber.com";

  var FALLBACK_DEPARTMENTS = [
    ["Deals", 4546], ["Lawn & Garden", 18], ["Building Materials", 4402],
    ["Tools", 26], ["Hardware", 19], ["Outdoor Living & Patio", 2357],
    ["Lighting & Electrical", 16], ["Home Decor & Accents", 4322],
    ["Housewares", 2153], ["Storage & Organization", 4388], ["Plumbing", 24],
    ["Doors & Windows", 4415], ["Gifts & Accessories", 2727],
    ["Bolts, Screws, Nails", 1822], ["Farm & Ranch Supplies", 17],
    ["Clearance", 4312], ["Animals/Pets", 2683], ["Heating & Cooling", 2076],
    ["Paint & Caulking", 12], ["Automotive", 2270], ["Floors & Ceilings", 1842]
  ].map(function (item) {
    return {
      name: item[0],
      href: WEBTRACK + "/Products.aspx?pl1=" + item[1] + "&pg=" + item[1] + "&sort=StockClassSort&direction=asc",
      subcategories: []
    };
  });

  var SITE_LINKS = [
    { label: "Project Center", href: MAIN_SITE + "/project-center" },
    { label: "Learn More", href: MAIN_SITE + "/history" },
    { label: "Faucets", href: WEBTRACK + "/Products.aspx?pl1=24&pg=549&sort=StockClassSort&direction=asc" },
    { label: "Building Supplies", href: WEBTRACK + "/Products.aspx?pl1=4402&pg=4402&sort=StockClassSort&direction=asc" },
    { label: "Lighting", href: WEBTRACK + "/Products.aspx?pl1=16&pg=16&sort=StockClassSort&direction=asc" },
    { label: "Hunting", href: WEBTRACK + "/Products.aspx?pl1=2357&pg=2650&sort=StockClassSort&direction=asc" },
    { label: "Credit", href: MAIN_SITE + "/credit" },
    { label: "Careers", href: MAIN_SITE + "/employment" },
    { label: "Contact Us", href: MAIN_SITE + "/contact-us" }
  ];

  var ACCOUNT_LINKS = [
    { label: "Account Information", href: WEBTRACK + "/Default.aspx?portal=1" },
    { label: "Sign In", href: WEBTRACK + "/SignIn.aspx" },
    { label: "Saved Items", href: WEBTRACK + "/signin.aspx?itemsPerPage=48" },
    { label: "Help", href: WEBTRACK + "/Help.aspx" },
    { label: "About Us", href: WEBTRACK + "/AboutUs.aspx" },
    { label: "Change My Store", href: WEBTRACK + "/AccountSettings.aspx?cms=1" }
  ];

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function icon(name) {
    var paths = {
      menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
      close: '<path d="M18 6 6 18M6 6l12 12"/>',
      search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
      cart: '<circle cx="9" cy="20" r="1"/><circle cx="19" cy="20" r="1"/><path d="M3 4h2l2.4 10.4A2 2 0 0 0 9.3 16H18a2 2 0 0 0 2-1.6L21 8H6"/>',
      user: '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>',
      pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
      grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
      chevron: '<path d="m9 18 6-6-6-6"/>',
      heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
      scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M10 8v8M14 8v8M17 8v8"/>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (paths[name] || "") + "</svg>";
  }

  function linkMarkup(link, className) {
    return '<a class="' + (className || "") + '" href="' + escapeHtml(link.href) + '">' +
      escapeHtml(link.label) + "</a>";
  }

  function isUsefulDepartment(department) {
    if (/^(store locations|miscellaneous)$/i.test(department.name)) return false;
    return department.subcategories.length > 0 || /^(deals|clearance)$/i.test(department.name);
  }

  function createStyles() {
    return `
      :host {
        --wl-maroon: #6b0016;
        --wl-maroon-dark: #4e0010;
        --wl-yellow: #f4c400;
        --wl-ink: #171717;
        --wl-muted: #666;
        --wl-line: #d9d9d9;
        --wl-soft: #f4f4f4;
        display: block;
        width: 100%;
        color: var(--wl-ink);
        font-family: Arial, Helvetica, sans-serif;
        letter-spacing: 0;
        position: relative;
        z-index: 1000;
        pointer-events: none;
      }

      *, *::before, *::after { box-sizing: border-box; }
      a { color: inherit; }
      button, input { font: inherit; letter-spacing: 0; }
      button { cursor: pointer; }
      svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
      [hidden] { display: none !important; }

      .wl-shell, .wl-department-panel, .wl-mobile-drawer, .wl-scanner-dialog { pointer-events: auto; }
      .wl-shell { background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,.08); }
      .wl-utility { min-height: 34px; padding: 0 max(18px, calc((100vw - 1180px) / 2)); background: var(--wl-maroon); color: #fff; display: flex; align-items: center; justify-content: space-between; gap: 18px; }
      .wl-utility-links, .wl-utility-actions { display: flex; align-items: center; gap: 4px; }
      .wl-utility a { padding: 9px 8px; font-size: 12px; font-weight: 700; text-decoration: none; white-space: nowrap; }
      .wl-utility a:hover, .wl-utility a:focus-visible { text-decoration: underline; }

      .wl-main { max-width: 1180px; min-height: 78px; margin: 0 auto; padding: 9px 16px; display: grid; grid-template-columns: 170px minmax(0, 1fr) auto; align-items: center; gap: 18px; }
      .wl-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
      .wl-logo { display: block; width: 152px; height: auto; }
      .wl-location { display: inline-flex; align-items: center; gap: 7px; padding: 7px 9px; border: 0; background: transparent; color: var(--wl-maroon); font-size: 12px; font-weight: 800; text-decoration: none; white-space: nowrap; }
      .wl-location svg { width: 18px; height: 18px; }

      .wl-feature-links { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 5px; min-width: 0; }
      .wl-feature-links a { min-height: 34px; display: inline-flex; align-items: center; padding: 7px 9px; border-radius: 5px; font-size: 13px; font-weight: 700; text-decoration: none; white-space: nowrap; }
      .wl-feature-links a:hover, .wl-feature-links a:focus-visible { background: var(--wl-soft); }
      .wl-feature-links .wl-promo { background: var(--wl-yellow); color: #111; }
      .wl-feature-links .wl-promo:hover, .wl-feature-links .wl-promo:focus-visible { background: #ddb400; }

      .wl-user-actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
      .wl-action { min-width: 56px; min-height: 48px; padding: 5px 8px; border: 0; border-radius: 5px; background: #fff; color: #111; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; font-size: 11px; font-weight: 800; text-decoration: none; position: relative; }
      .wl-action:hover, .wl-action:focus-visible, .wl-action[aria-expanded="true"] { background: var(--wl-soft); }
      .wl-badge { position: absolute; top: 0; right: 3px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: #e3e3e3; color: #111; display: grid; place-items: center; font-size: 10px; font-weight: 800; }
      .wl-menu-button { display: none; }

      .wl-account-wrap { position: relative; }
      .wl-account-popover { position: absolute; top: calc(100% + 8px); right: 0; width: 255px; padding: 8px; background: #fff; border: 1px solid var(--wl-line); border-radius: 6px; box-shadow: 0 14px 32px rgba(0,0,0,.18); z-index: 20; }
      .wl-account-popover a { display: flex; align-items: center; min-height: 42px; padding: 9px 10px; border-radius: 4px; font-size: 14px; font-weight: 700; text-decoration: none; }
      .wl-account-popover a:hover, .wl-account-popover a:focus-visible { background: var(--wl-soft); color: var(--wl-maroon); }

      .wl-search-row { background: #efefef; border-top: 1px solid var(--wl-line); }
      .wl-search-inner { max-width: 1180px; min-height: 66px; margin: 0 auto; padding: 9px 16px; display: grid; grid-template-columns: 190px minmax(0, 1fr) auto; align-items: center; gap: 10px; }
      .wl-departments-trigger { min-height: 46px; padding: 10px 14px; border: 1px solid var(--wl-maroon); border-radius: 6px; background: var(--wl-maroon); color: #fff; display: inline-flex; align-items: center; justify-content: center; gap: 9px; font-size: 14px; font-weight: 800; }
      .wl-departments-trigger:hover, .wl-departments-trigger:focus-visible, .wl-departments-trigger[aria-expanded="true"] { background: var(--wl-maroon-dark); }
      .wl-product-search { display: grid; grid-template-columns: minmax(0, 1fr) 48px; min-width: 0; }
      .wl-product-search input { min-width: 0; min-height: 46px; padding: 10px 14px; border: 1px solid #aaa; border-right: 0; border-radius: 6px 0 0 6px; background: #fff; color: #111; font-size: 16px; }
      .wl-product-search input:focus { outline: 2px solid var(--wl-yellow); outline-offset: 1px; }
      .wl-product-search button { min-width: 48px; border: 0; border-radius: 0 6px 6px 0; background: var(--wl-maroon); color: #fff; display: grid; place-items: center; }
      .wl-product-search button:hover, .wl-product-search button:focus-visible { background: var(--wl-maroon-dark); }
      .wl-scanner { width: 46px; height: 46px; border: 1px solid #aaa; border-radius: 6px; background: #fff; color: var(--wl-maroon); display: grid; place-items: center; }
      .wl-scanner:hover, .wl-scanner:focus-visible { background: #fff7d2; }

      dialog:not([open]) { display: none; }
      .wl-department-panel { position: fixed; top: 16px; left: 16px; right: 16px; width: auto; max-width: 1160px; max-height: calc(100dvh - 32px); margin: 0 auto; padding: 16px; overflow: auto; border: 1px solid var(--wl-line); border-radius: 6px; background: #fff; box-shadow: 0 22px 50px rgba(0,0,0,.22); color: var(--wl-ink); z-index: 100; }
      .wl-department-panel::backdrop, .wl-mobile-drawer::backdrop, .wl-scanner-dialog::backdrop { background: rgba(0,0,0,.28); }
      .wl-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
      .wl-panel-head h2 { margin: 0; font-size: 22px; }
      .wl-icon-button { width: 42px; height: 42px; flex: 0 0 42px; border: 1px solid var(--wl-line); border-radius: 6px; background: #fff; display: grid; place-items: center; }
      .wl-icon-button:hover, .wl-icon-button:focus-visible { background: var(--wl-soft); }
      .wl-department-search { position: relative; margin-bottom: 12px; }
      .wl-department-search svg { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: #666; }
      .wl-department-search input { width: 100%; min-height: 46px; padding: 10px 14px 10px 42px; border: 1px solid #aaa; border-radius: 6px; font-size: 16px; }
      .wl-department-search input:focus { outline: 2px solid var(--wl-yellow); outline-offset: 1px; }
      .wl-department-status { margin: 0 0 10px; color: var(--wl-muted); font-size: 13px; }
      .wl-department-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; }
      .wl-department-link, .wl-department-result { min-height: 44px; padding: 10px 11px; border: 1px solid var(--wl-line); border-radius: 5px; background: #fff; color: #222; display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 14px; font-weight: 800; text-decoration: none; }
      .wl-department-link:hover, .wl-department-link:focus-visible, .wl-department-result:hover, .wl-department-result:focus-visible { border-color: var(--wl-maroon); color: var(--wl-maroon); background: #fff8fa; }
      .wl-department-link.wl-featured { background: var(--wl-yellow); border-color: #ddb400; color: #111; }
      .wl-department-results { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
      .wl-department-result span:last-child { color: var(--wl-muted); font-size: 12px; font-weight: 700; text-align: right; }
      .wl-loading { padding: 24px; text-align: center; color: var(--wl-muted); }

      .wl-mobile-drawer { position: fixed; inset: 0; width: 100vw; max-width: none; height: 100dvh; max-height: none; margin: 0; padding: 0; overflow: auto; border: 0; background: #fff; color: var(--wl-ink); z-index: 200; }
      .wl-mobile-head { min-height: 76px; padding: 12px 16px; background: var(--wl-maroon); color: #fff; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
      .wl-mobile-head h2 { margin: 0; font-size: 21px; }
      .wl-mobile-head p { margin: 3px 0 0; color: #eee; font-size: 13px; }
      .wl-mobile-head .wl-icon-button { border-color: #aaa; background: transparent; color: #fff; }
      .wl-mobile-head .wl-icon-button:focus-visible { outline: 2px solid #bbb; outline-offset: 2px; }
      .wl-mobile-body { padding: 14px 16px 32px; }
      .wl-mobile-shortcuts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 18px; }
      .wl-mobile-shortcut { min-height: 72px; padding: 9px 6px; border: 1px solid var(--wl-line); border-radius: 6px; background: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font-size: 12px; font-weight: 800; text-decoration: none; text-align: center; }
      .wl-mobile-section { margin-top: 18px; }
      .wl-mobile-section h3 { margin: 0 0 7px; color: var(--wl-muted); font-size: 12px; text-transform: uppercase; }
      .wl-mobile-list { display: grid; gap: 2px; }
      .wl-mobile-list a, .wl-mobile-list button { width: 100%; min-height: 48px; padding: 11px 4px; border: 0; border-bottom: 1px solid #ececec; background: #fff; display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #222; font-size: 15px; font-weight: 700; text-decoration: none; text-align: left; }
      .wl-mobile-list a:hover, .wl-mobile-list a:focus-visible, .wl-mobile-list button:hover, .wl-mobile-list button:focus-visible { color: var(--wl-maroon); background: #fff8fa; }
      .wl-mobile-sale { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
      .wl-mobile-sale a { min-height: 44px; padding: 10px; border-radius: 5px; background: var(--wl-yellow); color: #111; display: grid; place-items: center; font-size: 14px; font-weight: 800; text-decoration: none; }

      .wl-scanner-dialog { position: fixed; inset: 0; width: 100vw; max-width: none; height: 100dvh; max-height: none; margin: 0; padding: 20px; border: 0; background: rgba(0,0,0,.72); z-index: 300; place-items: center; }
      .wl-scanner-dialog[open] { display: grid; }
      .wl-scanner-card { width: min(520px, 100%); padding: 14px; border-radius: 6px; background: #fff; }
      .wl-scanner-card video { width: 100%; min-height: 260px; max-height: 65dvh; margin-top: 10px; border-radius: 5px; background: #111; object-fit: cover; }
      .wl-scanner-message { margin: 10px 0 0; color: var(--wl-muted); font-size: 14px; }

      @media (max-width: 980px) {
        :host { background: #fff; }
        .wl-utility, .wl-feature-links { display: none; }
        .wl-main { min-height: 70px; grid-template-columns: auto minmax(125px, 1fr) auto; gap: 8px; padding: 7px 12px; }
        .wl-brand { justify-content: center; }
        .wl-logo { width: 145px; }
        .wl-location { min-width: 46px; padding: 6px; font-size: 0; justify-content: center; }
        .wl-location svg { width: 23px; height: 23px; }
        .wl-user-actions .wl-account-wrap, .wl-user-actions .wl-saved-action { display: none; }
        .wl-menu-button { display: grid; width: 46px; height: 46px; padding: 0; border: 0; border-radius: 5px; background: #fff; place-items: center; }
        .wl-menu-button:hover, .wl-menu-button:focus-visible { background: var(--wl-soft); }
        .wl-action { min-width: 46px; padding: 4px; }
        .wl-action > span:not(.wl-badge) { display: none; }
        .wl-search-inner { min-height: 64px; grid-template-columns: minmax(0, 1fr) 46px; padding: 8px 12px; }
        .wl-departments-trigger { display: none; }
        .wl-department-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .wl-department-panel { top: 0 !important; left: 0; right: 0; bottom: 0; max-height: 100dvh; border: 0; border-radius: 0; }
      }

      @media (max-width: 520px) {
        .wl-logo { width: 120px; }
        .wl-main { grid-template-columns: auto minmax(100px, 1fr) auto; }
        .wl-user-actions { gap: 1px; }
        .wl-search-inner { grid-template-columns: minmax(0, 1fr) 44px; }
        .wl-scanner { width: 44px; }
        .wl-department-grid, .wl-department-results { grid-template-columns: 1fr; }
      }
    `;
  }

  function WoodsonUnifiedHeader() {
    var self = Reflect.construct(HTMLElement, [], WoodsonUnifiedHeader);
    self.attachShadow({ mode: "open" });
    self.departments = FALLBACK_DEPARTMENTS;
    self.entries = [];
    self.lastFocus = null;
    self.scannerStream = null;
    self.scanTimer = null;
    return self;
  }

  WoodsonUnifiedHeader.prototype = Object.create(HTMLElement.prototype);
  WoodsonUnifiedHeader.prototype.constructor = WoodsonUnifiedHeader;

  WoodsonUnifiedHeader.prototype.connectedCallback = function () {
    if (this.dataset.ready === "true") return;
    this.dataset.ready = "true";
    this.render();
    this.bindEvents();
    this.setDepartments(this.departments);
    this.loadDepartments();
    this.listenForWebTrackState();
  };

  WoodsonUnifiedHeader.prototype.render = function () {
    var utilityLinks = [
      { label: "Home", href: MAIN_SITE },
      { label: "Account Information", href: WEBTRACK + "/Default.aspx?portal=1" },
      { label: "Sign In", href: WEBTRACK + "/SignIn.aspx" },
      { label: "Help", href: WEBTRACK + "/Help.aspx" },
      { label: "About Us", href: WEBTRACK + "/AboutUs.aspx" }
    ].map(function (link) { return linkMarkup(link); }).join("");

    var featureLinks = SITE_LINKS.map(function (link) { return linkMarkup(link); }).join("");
    var accountLinks = ACCOUNT_LINKS.map(function (link) { return linkMarkup(link); }).join("");
    var mobileSiteLinks = SITE_LINKS.map(function (link) {
      return '<a href="' + escapeHtml(link.href) + '"><span>' + escapeHtml(link.label) + '</span>' + icon("chevron") + "</a>";
    }).join("");
    var mobileAccountLinks = ACCOUNT_LINKS.map(function (link) {
      return '<a href="' + escapeHtml(link.href) + '"><span>' + escapeHtml(link.label) + '</span>' + icon("chevron") + "</a>";
    }).join("");

    this.shadowRoot.innerHTML = '<style>' + createStyles() + "</style>" +
      '<header class="wl-shell">' +
        '<div class="wl-utility">' +
          '<nav class="wl-utility-links" aria-label="Woodson links">' + utilityLinks + "</nav>" +
          '<div class="wl-utility-actions">' +
            '<a href="' + WEBTRACK + '/AccountSettings.aspx?cms=1">Change My Store</a>' +
            '<a href="' + WEBTRACK + '/ShoppingCart.aspx">Cart <span data-cart-count>0</span></a>' +
            '<a href="' + WEBTRACK + '/signin.aspx?itemsPerPage=48">Saved <span data-saved-count>0</span></a>' +
          "</div>" +
        "</div>" +
        '<div class="wl-main">' +
          '<button class="wl-menu-button" type="button" aria-label="Open menu" aria-expanded="false">' + icon("menu") + "</button>" +
          '<div class="wl-brand">' +
            '<a href="' + MAIN_SITE + '" aria-label="Woodson Lumber home"><img class="wl-logo" src="' + LOGO_URL + '" alt="Woodson Lumber"></a>' +
            '<a class="wl-location" href="' + MAIN_SITE + '/stores" title="Locations">' + icon("pin") + '<span data-store-name>Locations</span></a>' +
          "</div>" +
          '<nav class="wl-feature-links" aria-label="Featured links">' +
            '<a class="wl-promo" href="' + WEBTRACK + '/Products.aspx?pl1=4518&pg=4518&sort=StockClassSort&direction=asc">On Sale</a>' +
            '<a class="wl-promo" href="' + WEBTRACK + '/Products.aspx?pl1=4312&pg=4312&sort=StockClassSort&direction=asc">Clearance</a>' +
            featureLinks +
          "</nav>" +
          '<div class="wl-user-actions">' +
            '<div class="wl-account-wrap">' +
              '<button class="wl-action wl-account-trigger" type="button" aria-label="Account menu" aria-expanded="false">' + icon("user") + '<span data-account-label>Account</span></button>' +
              '<div class="wl-account-popover" hidden>' + accountLinks + "</div>" +
            "</div>" +
            '<a class="wl-action wl-saved-action" href="' + WEBTRACK + '/signin.aspx?itemsPerPage=48" aria-label="Saved items">' + icon("heart") + '<span>Saved</span><span class="wl-badge" data-saved-count>0</span></a>' +
            '<a class="wl-action" href="' + WEBTRACK + '/ShoppingCart.aspx" aria-label="Shopping cart">' + icon("cart") + '<span>Cart</span><span class="wl-badge" data-cart-count>0</span></a>' +
          "</div>" +
        "</div>" +
        '<div class="wl-search-row"><div class="wl-search-inner">' +
          '<button class="wl-departments-trigger" type="button" aria-expanded="false">' + icon("grid") + '<span>Departments</span></button>' +
          '<form class="wl-product-search" action="' + WEBTRACK + '/Products.aspx" method="get">' +
            '<input type="hidden" name="pg" value="0">' +
            '<input type="search" name="searchText" aria-label="Search products" placeholder="Search products, brands, or item numbers" autocomplete="off">' +
            '<button type="submit" aria-label="Search">' + icon("search") + "</button>" +
          "</form>" +
          '<button class="wl-scanner" type="button" aria-label="Scan barcode" title="Scan barcode">' + icon("scan") + "</button>" +
        "</div></div>" +
      "</header>" +
      '<dialog class="wl-department-panel" aria-label="Shop departments">' +
        '<div class="wl-panel-head"><h2>Shop departments</h2><button class="wl-icon-button wl-department-close" type="button" aria-label="Close departments">' + icon("close") + "</button></div>" +
        '<label class="wl-department-search">' + icon("search") + '<input type="search" placeholder="Search departments and subcategories" aria-label="Search departments and subcategories" autocomplete="off"></label>' +
        '<p class="wl-department-status" aria-live="polite"></p>' +
        '<div class="wl-department-grid"></div>' +
        '<div class="wl-department-results" hidden></div>' +
      "</dialog>" +
      '<dialog class="wl-mobile-drawer" aria-label="Woodson menu">' +
        '<div class="wl-mobile-head"><div><h2 data-mobile-greeting>Howdy, welcome to Woodson</h2><p>Shop, manage your account, or plan your next project.</p></div><button class="wl-icon-button wl-mobile-close" type="button" aria-label="Close menu">' + icon("close") + "</button></div>" +
        '<div class="wl-mobile-body">' +
          '<div class="wl-mobile-sale"><a href="' + WEBTRACK + '/Products.aspx?pl1=4518&pg=4518&sort=StockClassSort&direction=asc">On Sale</a><a href="' + WEBTRACK + '/Products.aspx?pl1=4312&pg=4312&sort=StockClassSort&direction=asc">Clearance</a></div>' +
          '<div class="wl-mobile-shortcuts">' +
            '<a class="wl-mobile-shortcut" href="' + WEBTRACK + '/Default.aspx?portal=1">' + icon("user") + '<span>Account</span></a>' +
            '<a class="wl-mobile-shortcut" href="' + WEBTRACK + '/ShoppingCart.aspx">' + icon("cart") + '<span>Cart (<span data-cart-count>0</span>)</span></a>' +
            '<a class="wl-mobile-shortcut" href="' + WEBTRACK + '/signin.aspx?itemsPerPage=48">' + icon("heart") + '<span>Saved (<span data-saved-count>0</span>)</span></a>' +
          "</div>" +
          '<section class="wl-mobile-section"><h3>Shop</h3><div class="wl-mobile-list"><button class="wl-mobile-departments" type="button"><span>Shop departments</span>' + icon("chevron") + "</button>" +
            '<a href="' + WEBTRACK + '/Products.aspx"><span>All products</span>' + icon("chevron") + "</a></div></section>" +
          '<section class="wl-mobile-section"><h3>Woodson</h3><div class="wl-mobile-list">' + mobileSiteLinks + "</div></section>" +
          '<section class="wl-mobile-section"><h3>Account & help</h3><div class="wl-mobile-list">' + mobileAccountLinks + "</div></section>" +
        "</div>" +
      "</dialog>" +
      '<dialog class="wl-scanner-dialog" aria-label="Barcode scanner">' +
        '<div class="wl-scanner-card"><div class="wl-panel-head"><h2>Scan a barcode</h2><button class="wl-icon-button wl-scanner-close" type="button" aria-label="Close scanner">' + icon("close") + '</button></div><video playsinline muted></video><p class="wl-scanner-message" aria-live="polite">Center the product barcode in the camera view.</p></div>' +
      "</dialog>";
  };

  WoodsonUnifiedHeader.prototype.bindEvents = function () {
    var self = this;
    var root = this.shadowRoot;
    var departmentTrigger = root.querySelector(".wl-departments-trigger");
    var departmentClose = root.querySelector(".wl-department-close");
    var departmentSearch = root.querySelector(".wl-department-search input");
    var accountTrigger = root.querySelector(".wl-account-trigger");
    var accountPopover = root.querySelector(".wl-account-popover");
    var menuButton = root.querySelector(".wl-menu-button");
    var menuClose = root.querySelector(".wl-mobile-close");
    var mobileDepartments = root.querySelector(".wl-mobile-departments");
    var scannerButton = root.querySelector(".wl-scanner");
    var scannerClose = root.querySelector(".wl-scanner-close");

    departmentTrigger.addEventListener("click", function () { self.setDepartmentsOpen(true, departmentTrigger); });
    departmentClose.addEventListener("click", function () { self.setDepartmentsOpen(false); });
    departmentSearch.addEventListener("input", function () { self.renderDepartmentSearch(departmentSearch.value); });

    accountTrigger.addEventListener("click", function () {
      var open = accountPopover.hidden;
      accountPopover.hidden = !open;
      accountTrigger.setAttribute("aria-expanded", open ? "true" : "false");
    });

    menuButton.addEventListener("click", function () { self.setMobileMenuOpen(true); });
    menuClose.addEventListener("click", function () { self.setMobileMenuOpen(false); });
    mobileDepartments.addEventListener("click", function () {
      self.setMobileMenuOpen(false, false);
      self.setDepartmentsOpen(true, mobileDepartments);
    });

    scannerButton.addEventListener("click", function () { self.openScanner(); });
    scannerClose.addEventListener("click", function () { self.closeScanner(); });

    root.querySelector(".wl-department-panel").addEventListener("cancel", function (event) {
      event.preventDefault();
      self.setDepartmentsOpen(false);
    });
    root.querySelector(".wl-mobile-drawer").addEventListener("cancel", function (event) {
      event.preventDefault();
      self.setMobileMenuOpen(false);
    });
    root.querySelector(".wl-scanner-dialog").addEventListener("cancel", function (event) {
      event.preventDefault();
      self.closeScanner();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      if (root.querySelector(".wl-scanner-dialog").open) self.closeScanner();
      else if (root.querySelector(".wl-department-panel").open) self.setDepartmentsOpen(false);
      else if (root.querySelector(".wl-mobile-drawer").open) self.setMobileMenuOpen(false);
      else if (!accountPopover.hidden) {
        accountPopover.hidden = true;
        accountTrigger.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("click", function (event) {
      if (!self.contains(event.target) && !accountPopover.hidden) {
        accountPopover.hidden = true;
        accountTrigger.setAttribute("aria-expanded", "false");
      }
    });
  };

  WoodsonUnifiedHeader.prototype.loadDepartments = function () {
    var self = this;
    var source = this.getAttribute("data-source") || DATA_URL;
    fetch(source, { credentials: "omit" })
      .then(function (response) {
        if (!response.ok) throw new Error("Department data request failed");
        return response.json();
      })
      .then(function (payload) {
        if (!payload || !Array.isArray(payload.departments)) throw new Error("Invalid department data");
        self.setDepartments(payload.departments.filter(isUsefulDepartment));
      })
      .catch(function () {
        self.setDepartments(FALLBACK_DEPARTMENTS);
      });
  };

  WoodsonUnifiedHeader.prototype.setDepartments = function (departments) {
    this.departments = departments;
    this.entries = [];
    var self = this;
    departments.forEach(function (department) {
      self.entries.push({ name: department.name, href: department.href, context: "Department", department: true });
      department.subcategories.forEach(function (subcategory) {
        self.entries.push({ name: subcategory.name, href: subcategory.href, context: department.name, department: false });
      });
    });
    this.renderDepartmentGrid();
  };

  WoodsonUnifiedHeader.prototype.renderDepartmentGrid = function () {
    var grid = this.shadowRoot.querySelector(".wl-department-grid");
    var results = this.shadowRoot.querySelector(".wl-department-results");
    var status = this.shadowRoot.querySelector(".wl-department-status");
    grid.hidden = false;
    results.hidden = true;
    status.textContent = this.departments.length + " departments";
    grid.innerHTML = this.departments.map(function (department) {
      var featured = /^(deals|clearance)$/i.test(department.name) ? " wl-featured" : "";
      return '<a class="wl-department-link' + featured + '" href="' + escapeHtml(department.href) + '"><span>' + escapeHtml(department.name) + '</span>' + icon("chevron") + "</a>";
    }).join("");
  };

  WoodsonUnifiedHeader.prototype.renderDepartmentSearch = function (value) {
    var query = String(value || "").trim().toLowerCase();
    if (!query) {
      this.renderDepartmentGrid();
      return;
    }

    var tokens = query.split(/\s+/);
    var matches = this.entries.filter(function (entry) {
      var haystack = (entry.name + " " + entry.context).toLowerCase();
      return tokens.every(function (token) { return haystack.indexOf(token) !== -1; });
    }).sort(function (a, b) {
      var aStarts = a.name.toLowerCase().indexOf(query) === 0 ? 0 : 1;
      var bStarts = b.name.toLowerCase().indexOf(query) === 0 ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      if (a.department !== b.department) return a.department ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    var visible = matches.slice(0, 80);
    var grid = this.shadowRoot.querySelector(".wl-department-grid");
    var results = this.shadowRoot.querySelector(".wl-department-results");
    var status = this.shadowRoot.querySelector(".wl-department-status");
    grid.hidden = true;
    results.hidden = false;
    status.textContent = matches.length ? (matches.length + (matches.length === 1 ? " result" : " results")) : "No matching departments or subcategories";
    results.innerHTML = visible.map(function (entry) {
      return '<a class="wl-department-result" href="' + escapeHtml(entry.href) + '"><span>' + escapeHtml(entry.name) + '</span><span>' + escapeHtml(entry.context) + "</span></a>";
    }).join("");
  };

  WoodsonUnifiedHeader.prototype.setDepartmentsOpen = function (open, source) {
    var panel = this.shadowRoot.querySelector(".wl-department-panel");
    var trigger = this.shadowRoot.querySelector(".wl-departments-trigger");
    var search = this.shadowRoot.querySelector(".wl-department-search input");
    if (open) {
      this.lastFocus = source || document.activeElement;
      this.openDialog(panel);
      trigger.setAttribute("aria-expanded", "true");
      document.documentElement.style.overflow = "hidden";
      window.setTimeout(function () { search.focus(); }, 0);
    } else {
      this.closeDialog(panel);
      trigger.setAttribute("aria-expanded", "false");
      search.value = "";
      this.renderDepartmentGrid();
      document.documentElement.style.overflow = "";
      if (this.lastFocus && typeof this.lastFocus.focus === "function") this.lastFocus.focus();
    }
  };

  WoodsonUnifiedHeader.prototype.setMobileMenuOpen = function (open, restoreFocus) {
    var drawer = this.shadowRoot.querySelector(".wl-mobile-drawer");
    var trigger = this.shadowRoot.querySelector(".wl-menu-button");
    if (open) this.openDialog(drawer);
    else this.closeDialog(drawer);
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
    document.documentElement.style.overflow = open ? "hidden" : "";
    if (open) this.shadowRoot.querySelector(".wl-mobile-close").focus();
    else if (restoreFocus !== false) trigger.focus();
  };

  WoodsonUnifiedHeader.prototype.openScanner = function () {
    var self = this;
    var dialog = this.shadowRoot.querySelector(".wl-scanner-dialog");
    var video = dialog.querySelector("video");
    var message = dialog.querySelector(".wl-scanner-message");
    this.openDialog(dialog);
    document.documentElement.style.overflow = "hidden";

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !("BarcodeDetector" in window)) {
      message.textContent = "Barcode scanning is not supported by this browser. Enter the item number in product search.";
      video.hidden = true;
      return;
    }

    message.textContent = "Center the product barcode in the camera view.";
    video.hidden = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then(function (stream) {
        self.scannerStream = stream;
        video.srcObject = stream;
        return video.play();
      })
      .then(function () {
        var detector = new BarcodeDetector({ formats: ["upc_a", "upc_e", "ean_13", "ean_8", "code_128"] });
        var scan = function () {
          detector.detect(video).then(function (codes) {
            if (codes && codes[0] && codes[0].rawValue) {
              var code = codes[0].rawValue;
              self.closeScanner();
              window.location.href = WEBTRACK + "/Products.aspx?pg=0&searchText=" + encodeURIComponent(code);
              return;
            }
            self.scanTimer = window.setTimeout(scan, 300);
          }).catch(function () {
            self.scanTimer = window.setTimeout(scan, 500);
          });
        };
        scan();
      })
      .catch(function () {
        message.textContent = "Camera access was not available. Enter the item number in product search.";
        video.hidden = true;
      });
  };

  WoodsonUnifiedHeader.prototype.closeScanner = function () {
    var dialog = this.shadowRoot.querySelector(".wl-scanner-dialog");
    var video = dialog.querySelector("video");
    this.closeDialog(dialog);
    document.documentElement.style.overflow = "";
    if (this.scanTimer) window.clearTimeout(this.scanTimer);
    this.scanTimer = null;
    if (this.scannerStream) {
      this.scannerStream.getTracks().forEach(function (track) { track.stop(); });
      this.scannerStream = null;
    }
    video.srcObject = null;
    this.shadowRoot.querySelector(".wl-scanner").focus();
  };

  WoodsonUnifiedHeader.prototype.openDialog = function (dialog) {
    if (dialog.open) return;
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
      return;
    }
    dialog.setAttribute("open", "");
  };

  WoodsonUnifiedHeader.prototype.closeDialog = function (dialog) {
    if (!dialog.open) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  };

  WoodsonUnifiedHeader.prototype.listenForWebTrackState = function () {
    var self = this;
    window.addEventListener("message", function (event) {
      if (event.origin !== WEBTRACK || !event.data || event.data.type !== "WL_HEADER_STATE") return;
      self.applyWebTrackState(event.data.payload || {});
    });
  };

  WoodsonUnifiedHeader.prototype.applyWebTrackState = function (state) {
    var root = this.shadowRoot;
    var cartCount = Number(state.cartCount) || 0;
    var savedCount = Number(state.savedCount) || 0;
    Array.prototype.forEach.call(root.querySelectorAll("[data-cart-count]"), function (node) { node.textContent = cartCount; });
    Array.prototype.forEach.call(root.querySelectorAll("[data-saved-count]"), function (node) { node.textContent = savedCount; });
    if (state.storeName) root.querySelector("[data-store-name]").textContent = state.storeName;
    if (state.accountName) {
      root.querySelector("[data-account-label]").textContent = state.accountName;
      root.querySelector("[data-mobile-greeting]").textContent = "Howdy, " + state.accountName;
    }
  };

  window.customElements.define("woodson-unified-header", WoodsonUnifiedHeader);
}());
