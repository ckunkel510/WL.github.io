(function () {
  "use strict";

  var BUILD_VERSION = "20260902-shipping-safety-4";
  var RATE_URL = "https://wl-upsrates.vercel.app/api/fulfillment-quote";
  var STORAGE_KEY = "wl_shipping_offer_v1";
  var CART_DATA_KEY = "wl_shipping_offer_cart_v1";
  var SELECTION_SOURCE_KEY = "wl_fulfillment_selection_source_v1";
  var EVENT_NAME = "wl:shipping-offer-change";
  var refreshTimer = null;
  var activeRequest = null;
  var activeSelectionRequest = null;
  var refreshQueued = false;
  var missingContextRetries = 0;
  var MISSING_CONTEXT_MAX_RETRIES = 10;

  if (!/ShoppingCart\.aspx|Checkout|PlaceOrder/i.test(window.location.pathname || "")) return;
  if (window.WLShippingOffer && window.WLShippingOffer.version === BUILD_VERSION) return;

  var STORE_ORIGINS = {
    brenham: { name: "Brenham", city: "Brenham", state: "TX", postalCode: "77833" },
    bryan: { name: "Bryan", city: "Bryan", state: "TX", postalCode: "77803" },
    caldwell: { name: "Caldwell", city: "Caldwell", state: "TX", postalCode: "77836" },
    lexington: { name: "Lexington", city: "Lexington", state: "TX", postalCode: "78947" },
    buffalo: { name: "Buffalo", city: "Buffalo", state: "TX", postalCode: "75831" },
    mexia: { name: "Mexia", city: "Mexia", state: "TX", postalCode: "76667" },
    groesbeck: { name: "Groesbeck", city: "Groesbeck", state: "TX", postalCode: "76642" }
  };

  function text(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function normalizeCode(value) {
    return text(value).replace(/\s+/g, "").toUpperCase();
  }

  function cartRows() {
    return Array.prototype.slice.call(document.querySelectorAll(".shopping-cart-details .shopping-cart-item, .shopping-cart-item"))
      .filter(function (row) { return productId(row) || productCode(row); });
  }

  function productId(row) {
    var link = Array.prototype.find.call(row.querySelectorAll('a[href*="ProductDetail.aspx"]'), function (candidate) {
      return /[?&]pid=\d+/i.test(candidate.getAttribute("href") || "");
    });
    var match = (link ? link.getAttribute("href") : "").match(/[?&]pid=(\d+)/i);
    return match ? match[1] : "";
  }

  function productCode(row) {
    var link = row.querySelector(".portalGridLink, .cart-item-card h6 a, h6 a[href*='ProductDetail.aspx']") ||
      Array.prototype.find.call(row.querySelectorAll('a[href*="ProductDetail.aspx"]'), function (candidate) {
        return text(candidate.textContent);
      });
    return normalizeCode(link ? link.textContent : "");
  }

  function storedCartData() {
    try {
      var stored = JSON.parse(sessionStorage.getItem(CART_DATA_KEY) || "null");
      return stored && Date.now() - Number(stored.ts || 0) < 4 * 60 * 60 * 1000 ? stored : null;
    } catch (error) {
      return null;
    }
  }

  function rememberCart(items, origin) {
    if (!items.length) return;
    var previous = storedCartData() || {};
    try {
      sessionStorage.setItem(CART_DATA_KEY, JSON.stringify({
        items: items,
        origin: origin || previous.origin || null,
        ts: Date.now()
      }));
    } catch (error) {}
  }

  function cartItems() {
    var items = cartRows().map(function (row) {
      var input = row.querySelector('input[id*="_qty_"]:not([id$="_ClientState"])');
      var select = row.querySelector("select.wl-qty-select");
      var locked = row.querySelector(".wl-qty-locked");
      return {
        productId: productId(row),
        productCode: productCode(row),
        quantity: Math.max(1, Number(select && select.value || input && input.value || locked && locked.textContent || 1) || 1)
      };
    });
    if (items.length) return items;
    return storedCartData() && storedCartData().items || [];
  }

  function selectedOrigin() {
    var locationText = text(Array.prototype.filter.call(document.querySelectorAll("a[href]"), function (link) {
      var href = String(link.getAttribute("href") || "").toLowerCase();
      return href.indexOf("storelocations") !== -1 || /woodsonlumber\.com\/stores(?:[/?#]|$)/.test(href);
    }).map(function (link) { return link.textContent; }).join(" ")).toLowerCase();
    var key = Object.keys(STORE_ORIGINS).find(function (name) { return locationText.indexOf(name) !== -1; });
    var origin = key ? STORE_ORIGINS[key] : null;
    return origin || (storedCartData() && storedCartData().origin) || null;
  }

  function checkoutZip() {
    var selectors = [
      "#ctl00_PageBody_DeliveryAddress_Postcode",
      "#ctl00_PageBody_DeliveryAddress_ZipCodeTextBox",
      "#ctl00_PageBody_DeliveryAddress_PostalCode",
      "#ctl00_PageBody_DeliveryAddress_PostcodeTextBox",
      "#gc_del_zip"
    ];
    for (var index = 0; index < selectors.length; index += 1) {
      var element = document.querySelector(selectors[index]);
      var match = text(element && element.value).match(/\d{5}/);
      if (match) return match[0];
    }
    return "";
  }

  function checkoutAddress() {
    function value(id) {
      var element = document.getElementById(id);
      return text(element && element.value);
    }
    var state = document.getElementById("ctl00_PageBody_DeliveryAddress_CountySelector_CountyList");
    var stateText = text(state && state.selectedOptions && state.selectedOptions[0]
      ? state.selectedOptions[0].text || state.selectedOptions[0].textContent
      : state && state.value);
    return {
      addressLine: [
        value("ctl00_PageBody_DeliveryAddress_AddressLine1"),
        value("ctl00_PageBody_DeliveryAddress_AddressLine2"),
        value("ctl00_PageBody_DeliveryAddress_AddressLine3")
      ].filter(Boolean),
      city: value("ctl00_PageBody_DeliveryAddress_City"),
      state: /^texas$/i.test(stateText) ? "TX" : stateText,
      postalCode: checkoutZip(),
      country: "US",
      residential: true
    };
  }

  function savedZip() {
    try {
      var guest = JSON.parse(sessionStorage.getItem("wl_guest_checkout_payload") || "null");
      var guestZip = text(guest && (guest.zip || guest.postalCode || guest.postcode)).match(/\d{5}/);
      if (guestZip) return Promise.resolve(guestZip[0]);
    } catch (error) {}
    return fetch("/AccountInfo_R.aspx", { credentials: "same-origin", cache: "no-store" })
      .then(function (response) { return response.ok ? response.text() : ""; })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var content = text(Array.prototype.map.call(doc.querySelectorAll(".accountInfoAddress li"), function (item) {
          return item.textContent;
        }).join(" "));
        return (content.match(/\b\d{5}(?:-\d{4})?\b/) || [""])[0].slice(0, 5);
      })
      .catch(function () { return ""; });
  }

  function notifyOffer(payload) {
    try { document.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload })); } catch (error) {}
  }

  function writeOffer(result, zip, items, shouldNotify) {
    var payload = {
      zip: zip,
      cartSignature: items.map(function (item) {
        return [item.productId, item.productCode, item.quantity].join(":");
      }).sort().join("|"),
      shippingOffer: result && result.shippingOffer || null,
      packagePlan: result && result.packagePlan || null,
      recommendation: result && result.recommendation || null,
      options: result && result.options || null,
      packageProfile: result && result.packageProfile || null,
      ts: Date.now()
    };
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch (error) {}
    if (shouldNotify !== false) notifyOffer(payload);
    return payload;
  }

  function rememberedSelection() {
    try {
      var mode = sessionStorage.getItem("wl_fulfillment_intent") || sessionStorage.getItem("wl_fulfillment_method") || "";
      var source = sessionStorage.getItem(SELECTION_SOURCE_KEY) || "";
      return source === "user" && (mode === "ship" || mode === "delivery") ? { mode: mode, source: source } : null;
    } catch (error) {
      return null;
    }
  }

  async function refreshOffer() {
    if (activeRequest) {
      refreshQueued = true;
      return activeRequest;
    }
    activeRequest = (async function () {
      var items = cartItems();
      var origin = selectedOrigin();
      rememberCart(items, origin);
      var address = checkoutAddress();
      var zip = address.postalCode || await savedZip();
      if (!items.length || !origin || !zip) {
        if (items.length && missingContextRetries < MISSING_CONTEXT_MAX_RETRIES) {
          missingContextRetries += 1;
          scheduleRefresh(750);
        }
        return null;
      }
      missingContextRetries = 0;
      address.postalCode = zip;
      var requestBody = {
        shipFrom: origin,
        shipTo: address,
        cart: items
      };
      var response = await fetch(RATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });
      var result = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(result.error || "UPS shipping offer could not be prepared.");
      var payload = writeOffer(result, zip, items, false);
      var selected = rememberedSelection();
      var selectedOption = selected && result.options && result.options[selected.mode];
      if (selectedOption && selectedOption.available && result.recommendation && result.recommendation.mode !== selected.mode) {
        await selectOffer(selected.mode);
        payload = currentOffer() || payload;
      }
      notifyOffer(payload);
      return payload;
    })().catch(function (error) {
      console.warn("[WLShippingOffer] Automatic fulfillment quote could not be prepared.", error);
      return null;
    }).finally(function () {
      activeRequest = null;
      if (refreshQueued) {
        refreshQueued = false;
        scheduleRefresh(50);
      }
    });
    return activeRequest;
  }

  function scheduleRefresh(delay) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshOffer, Number(delay) || 350);
  }

  function currentOffer() {
    try {
      var stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
      var currentZip = checkoutZip();
      var sameZip = !currentZip || !stored || stored.zip === currentZip;
      return stored && sameZip && Date.now() - Number(stored.ts || 0) < 15 * 60 * 1000 ? stored : null;
    } catch (error) {
      return null;
    }
  }

  function selectOffer(mode) {
    if (mode !== "ship" && mode !== "delivery") return Promise.resolve(false);
    if (activeSelectionRequest) return activeSelectionRequest;
    var offer = currentOffer();
    var origin = selectedOrigin();
    var address = checkoutAddress();
    if (!offer || !origin || !address.postalCode) return Promise.resolve(false);
    activeSelectionRequest = fetch(RATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "select",
        mode: mode,
        shipFrom: origin,
        shipTo: address,
        totalWeight: offer.packageProfile && offer.packageProfile.totalWeight
      })
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (result) {
        if (!response.ok || !result.ok) throw new Error(result.error || "The fulfillment choice could not be saved.");
        offer.recommendation = result.recommendation || offer.recommendation;
        offer.ts = Date.now();
        try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(offer)); } catch (error) {}
        return true;
      });
    }).catch(function (error) {
      console.warn("[WLShippingOffer] Fulfillment selection could not be saved.", error);
      return false;
    }).finally(function () { activeSelectionRequest = null; });
    return activeSelectionRequest;
  }

  window.WLShippingOffer = {
    version: BUILD_VERSION,
    refresh: refreshOffer,
    current: currentOffer,
    select: selectOffer
  };

  document.addEventListener("input", function (event) {
    if (event.target && /(?:DeliveryAddress|Postcode|PostalCode|ZipCode|gc_del_zip)/i.test(event.target.id || "")) scheduleRefresh(450);
  }, true);
  document.addEventListener("change", function (event) {
    if (event.target && /(?:DeliveryAddress|Postcode|PostalCode|ZipCode|gc_del_zip|wl-qty-select)/i.test(event.target.id || event.target.className || "")) scheduleRefresh(100);
  }, true);

  function boot() {
    scheduleRefresh(150);
    setTimeout(refreshOffer, 1200);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  try {
    var manager = window.Sys && window.Sys.WebForms && window.Sys.WebForms.PageRequestManager
      ? window.Sys.WebForms.PageRequestManager.getInstance()
      : null;
    if (manager && !manager.__wlShippingOfferHooked) {
      manager.__wlShippingOfferHooked = true;
      manager.add_endRequest(function () { scheduleRefresh(150); });
    }
  } catch (error) {}
})();
