(function () {
  "use strict";

  var BUILD_VERSION = "20260707-1";
  if (window.WLTurtleboxPromo && window.WLTurtleboxPromo.version === BUILD_VERSION) return;

  var PROMO_END = "2026-09-01T00:00:00-05:00";
  var POPUP_COOLDOWN_MS = 48 * 60 * 60 * 1000;
  var POPUP_STORAGE_KEY = "wl_turtlebox_shipping_popup_seen_v1";
  var PROMO_URL = "https://webtrack.woodsonlumber.com/Products.aspx?pg=0&sort=Relevance&searchText=turtlebox&itemsPerPage=48&pageIndex=0";
  var ASSET_BASE = "https://ckunkel510.github.io/WL.github.io/assets/";
  var BANNER_IMAGE = ASSET_BASE + "turtlebox-shipping-banner.jpg";
  var POPUP_IMAGE = ASSET_BASE + "turtlebox-shipping-popup.jpg";

  window.WLTurtleboxPromo = {
    version: BUILD_VERSION,
    active: isPromoActive()
  };

  function now() {
    return Date.now ? Date.now() : new Date().getTime();
  }

  function isPromoActive() {
    var endTime = new Date(PROMO_END).getTime();
    return Number.isFinite(endTime) && now() < endTime;
  }

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  function readStorage(key) {
    try { return Number(window.localStorage.getItem(key) || 0) || 0; } catch (error) { return 0; }
  }

  function writeStorage(key, value) {
    try { window.localStorage.setItem(key, String(value)); } catch (error) {}
  }

  function shouldShowPopup() {
    var path = window.location.pathname || "";
    var query = window.location.search || "";
    var lastSeen = readStorage(POPUP_STORAGE_KEY);

    if (!isPromoActive()) return false;
    if (lastSeen && now() - lastSeen < POPUP_COOLDOWN_MS) return false;
    if (/\/(?:ShoppingCart|PayByInvoice|Paymentlink|Invoices|OpenOrders|Statements|CreditNotes|ProductsPurchased|AccountInfo|AccountSettings|AddressList|AddressDetails|Contacts|ContactDetails|SignIn|UserSignup)\.aspx$/i.test(path)) return false;
    if (/[\?&]portal=1(?:&|$)/i.test(query)) return false;

    return true;
  }

  function markPopupSeen() {
    writeStorage(POPUP_STORAGE_KEY, now());
  }

  function injectStyles() {
    if (document.getElementById("wl-turtlebox-promo-styles")) return;

    var css = `
      #wl-turtlebox-header-promo {
        box-sizing: border-box;
        width: 100%;
        padding: 8px 0;
        background: #fff7eb;
        border-top: 1px solid #ead9c7;
        border-bottom: 1px solid #ead9c7;
      }

      #wl-turtlebox-header-promo > a {
        display: block;
        box-sizing: border-box;
        width: min(900px, 100%);
        margin: 0 auto;
        color: inherit;
        line-height: 0;
        text-decoration: none;
        border-radius: 4px;
        overflow: hidden;
      }

      #wl-turtlebox-header-promo img {
        display: block;
        width: 100%;
        height: auto;
        border: 0;
      }

      #wl-turtlebox-popup[hidden] {
        display: none !important;
      }

      #wl-turtlebox-popup {
        position: fixed;
        inset: 0;
        z-index: 100900;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        padding: 22px;
        background: rgba(17, 18, 20, 0.64);
      }

      .wl-turtlebox-popup-dialog {
        position: relative;
        width: min(860px, 100%);
        max-height: min(82vh, 680px);
        background: #fff7eb;
        border-radius: 8px;
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.32);
        overflow: hidden;
      }

      .wl-turtlebox-popup-link {
        display: block;
        color: inherit;
        line-height: 0;
        text-decoration: none;
      }

      .wl-turtlebox-popup-link img {
        display: block;
        width: 100%;
        height: auto;
        max-height: min(82vh, 680px);
        object-fit: contain;
        border: 0;
      }

      .wl-turtlebox-popup-close {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 2;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 42px;
        height: 42px;
        padding: 0;
        color: #1e2327;
        font-size: 20px;
        line-height: 1;
        background: rgba(255, 255, 255, 0.94);
        border: 1px solid rgba(30, 35, 39, 0.18);
        border-radius: 999px;
        box-shadow: 0 7px 18px rgba(0, 0, 0, 0.18);
        cursor: pointer;
      }

      .wl-turtlebox-popup-close:hover,
      .wl-turtlebox-popup-close:focus {
        color: #fff;
        background: #6b0016;
        outline: none;
      }

      body.wl-turtlebox-popup-open {
        overflow: hidden !important;
      }

      @media (max-width: 991px) {
        #wl-turtlebox-header-promo {
          padding: 6px 10px;
        }
      }

      @media (max-width: 575px) {
        #wl-turtlebox-popup {
          padding: 12px;
        }

        .wl-turtlebox-popup-close {
          top: 8px;
          right: 8px;
          width: 38px;
          height: 38px;
        }
      }
    `;

    var style = document.createElement("style");
    style.id = "wl-turtlebox-promo-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function placeBanner() {
    if (!isPromoActive()) return true;
    if (document.getElementById("wl-turtlebox-header-promo")) return true;

    var row = document.getElementById("ctl00_PageHeader_searchBarTableRow");
    var header = document.getElementById("siteHeaderContent");
    var unifiedHeader = document.querySelector("woodson-unified-header");
    if (!row && !header && !unifiedHeader) return false;

    var banner = document.createElement("div");
    banner.id = "wl-turtlebox-header-promo";
    banner.innerHTML =
      '<a href="' + PROMO_URL + '" aria-label="Shop Turtlebox speakers with free standard shipping">' +
        '<img src="' + BANNER_IMAGE + '" alt="Free standard shipping on Turtlebox speakers. Use code SummerChill26. Now through 8/31/26. Shop now." width="900" height="100" loading="lazy" decoding="async">' +
      '</a>';

    if (row && row.parentNode) {
      row.parentNode.insertBefore(banner, row.nextSibling);
    } else if (unifiedHeader && unifiedHeader.parentNode) {
      unifiedHeader.parentNode.insertBefore(banner, unifiedHeader.nextSibling);
    } else {
      header.appendChild(banner);
    }

    return true;
  }

  function installBanner() {
    var tries = 0;
    var maxTries = 40;

    if (placeBanner()) return;

    var timer = window.setInterval(function () {
      tries++;
      if (placeBanner() || tries >= maxTries) {
        window.clearInterval(timer);
      }
    }, 250);
  }

  function closePopup(popup) {
    markPopupSeen();
    popup.hidden = true;
    document.body.classList.remove("wl-turtlebox-popup-open");
    window.removeEventListener("keydown", popup._wlKeyHandler);
  }

  function showPopup() {
    if (!shouldShowPopup()) return;
    if (document.getElementById("wl-turtlebox-popup")) return;

    var popup = document.createElement("div");
    popup.id = "wl-turtlebox-popup";
    popup.hidden = true;
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-modal", "true");
    popup.setAttribute("aria-label", "Free standard shipping on Turtlebox speakers");
    popup.innerHTML =
      '<div class="wl-turtlebox-popup-dialog">' +
        '<button type="button" class="wl-turtlebox-popup-close" aria-label="Close Turtlebox promotion" title="Close">' +
          '<span aria-hidden="true">&times;</span>' +
        '</button>' +
        '<a class="wl-turtlebox-popup-link" href="' + PROMO_URL + '" aria-label="Shop Turtlebox speakers with free standard shipping">' +
          '<img src="' + POPUP_IMAGE + '" alt="Free standard shipping on Turtlebox speakers. Use code SummerChill26. Now through 8/31/26. Shop now." width="1200" height="630" decoding="async">' +
        '</a>' +
      '</div>';

    var close = popup.querySelector(".wl-turtlebox-popup-close");
    var link = popup.querySelector(".wl-turtlebox-popup-link");

    popup._wlKeyHandler = function (event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closePopup(popup);
    };

    popup.addEventListener("click", function (event) {
      if (event.target === popup) closePopup(popup);
    });

    close.addEventListener("click", function () {
      closePopup(popup);
    });

    link.addEventListener("click", markPopupSeen);

    document.body.appendChild(popup);

    window.setTimeout(function () {
      if (!shouldShowPopup()) {
        popup.remove();
        return;
      }

      popup.hidden = false;
      document.body.classList.add("wl-turtlebox-popup-open");
      window.addEventListener("keydown", popup._wlKeyHandler);
      close.focus();
    }, 900);
  }

  if (!isPromoActive()) return;

  onReady(function () {
    injectStyles();
    installBanner();
    showPopup();
  });
})();
