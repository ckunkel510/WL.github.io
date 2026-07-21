(function (window, document) {
  "use strict";

  if (window.WLAnalytics) return;

  var VERSION = "1.2.2";
  var EVENT_NAME = "wl_analytics_event";
  var GA_MEASUREMENT_ID = "G-4ZLV1YB6GY";
  var META_PIXEL_ID = "188974749776655";
  var CART_STORAGE_KEY = "wl_analytics_cart_v1";
  var CHECKOUT_STORAGE_KEY = "wl_analytics_checkout_v1";
  var PURCHASE_STORAGE_KEY = "wl_analytics_purchases_v1";
  var PENDING_ADD_STORAGE_KEY = "wl_analytics_pending_add_v1";
  var CART_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  var sent = Object.create(null);
  var observedProductIds = Object.create(null);
  var observerTimer = 0;
  var lastShippingEvent = { key: "", at: 0 };

  var ALLOWED_EVENTS = {
    search: true,
    view_item_list: true,
    select_item: true,
    view_item: true,
    add_to_cart: true,
    remove_from_cart: true,
    cart_quantity_change: true,
    view_cart: true,
    begin_checkout: true,
    add_shipping_info: true,
    add_payment_info: true,
    checkout_submit: true,
    purchase: true,
    share_product: true
  };

  var BLOCKED_KEYS = /(?:^|_)(?:name|first_name|last_name|email|phone|telephone|address|street|city|state|zip|postal|country|payment|card|account|password|user_id|customer_id|contact|instructions|po_number)(?:$|_)/i;
  var EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  var PHONE_PATTERN = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/;

  function ready(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  function text(element) {
    return String((element && element.textContent) || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function toNumber(value) {
    var match = String(value == null ? "" : value).match(/-?[\d,]+(?:\.\d{1,2})?/);
    if (!match) return null;
    var number = parseFloat(match[0].replace(/,/g, ""));
    return isFinite(number) ? number : null;
  }

  function roundMoney(value) {
    return Math.round(value * 100) / 100;
  }

  function safeStorage(storage, method, key, value) {
    try {
      if (method === "get") return storage.getItem(key);
      if (method === "remove") storage.removeItem(key);
      else storage.setItem(key, value);
    } catch (error) {
      return null;
    }
    return null;
  }

  function cleanString(value) {
    var cleaned = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
    if (!cleaned || EMAIL_PATTERN.test(cleaned) || PHONE_PATTERN.test(cleaned)) return null;
    return cleaned.slice(0, 200);
  }

  function sanitize(value, key, depth) {
    var safeAnalyticsKey = /^(?:item_name|item_list_name|payment_type)$/i.test(key || "");
    if (depth > 5 || (key && BLOCKED_KEYS.test(key) && !safeAnalyticsKey)) return undefined;
    if (value == null) return undefined;
    if (typeof value === "string") return cleanString(value);
    if (typeof value === "number") return isFinite(value) ? value : undefined;
    if (typeof value === "boolean") return value;
    if (Array.isArray(value)) {
      return value.slice(0, 100).map(function (entry) {
        return sanitize(entry, "", depth + 1);
      }).filter(function (entry) {
        return entry !== undefined && entry !== null;
      });
    }
    if (typeof value === "object") {
      var result = {};
      Object.keys(value).forEach(function (childKey) {
        var child = sanitize(value[childKey], childKey, depth + 1);
        if (child !== undefined && child !== null && child !== "") result[childKey] = child;
      });
      return result;
    }
    return undefined;
  }

  function isVisible(element) {
    if (!element) return false;
    var style = window.getComputedStyle ? window.getComputedStyle(element) : null;
    if (style && (style.display === "none" || style.visibility === "hidden")) return false;
    return !element.getClientRects || element.getClientRects().length > 0;
  }

  function hasOrderConfirmation() {
    var response = document.getElementById("CartResponseMessage");
    var merchant = document.getElementById("ctl00_PageBody_SuccessfulPaymentResults_MerchantDetailsPanel");
    return !!(response && merchant && text(response) && text(merchant));
  }

  function pageType() {
    var path = String(window.location.pathname || "").toLowerCase();
    if (/productdetail\.aspx/.test(path)) return "product_detail";
    if (/products\.aspx/.test(path)) return "product_list";
    if (/shoppingcart\.aspx/.test(path)) {
      if (hasOrderConfirmation()) return "order_confirmation";
      if (document.getElementById("ctl00_PageBody_CompleteCheckoutButton")) return "checkout_review";
      if (document.querySelector(".checkout-wizard, .SaleTypeSelector, [id*='SaleTypeSelector']")) return "checkout";
      return "cart";
    }
    return "other";
  }

  function initializeGa4() {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () {
      window.dataLayer.push(arguments);
    };

    if (!window.__wlGa4Initialized) {
      window.__wlGa4Initialized = true;
      window.gtag("js", new Date());
      window.gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });
    }

    if (!document.querySelector("script[data-wl-ga4]") &&
        !document.querySelector("script[src*='googletagmanager.com/gtag/js']")) {
      var script = document.createElement("script");
      script.async = true;
      script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_MEASUREMENT_ID);
      script.setAttribute("data-wl-ga4", "true");
      document.head.appendChild(script);
    }
  }

  function hasExistingMetaPixel() {
    var scripts = document.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i += 1) {
      var source = String(scripts[i].src || "");
      if (source.indexOf("connect.facebook.net/signals/config/" + META_PIXEL_ID) !== -1) return true;
    }
    return false;
  }

  function initializeMeta() {
    if (window.__wlMetaInitialized) return;
    window.__wlMetaInitialized = true;

    var fbq = window.fbq;
    var existingBase = !!fbq && hasExistingMetaPixel();

    if (!fbq) {
      fbq = window.fbq = function () {
        if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments);
        else fbq.queue.push(arguments);
      };
      if (!window._fbq) window._fbq = fbq;
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = "2.0";
      fbq.queue = [];
    }

    if (!existingBase) {
      fbq("init", META_PIXEL_ID);
      fbq("trackSingle", META_PIXEL_ID, "PageView");
    }

    if (!document.querySelector("script[src*='connect.facebook.net'][src*='fbevents.js']")) {
      var script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      script.setAttribute("data-wl-meta", "true");
      document.head.appendChild(script);
    }
  }

  function metaEventPayload(payload) {
    var ecommerceData = payload.ecommerce || {};
    var items = Array.isArray(ecommerceData.items) ? ecommerceData.items : [];
    var parameters = {
      content_type: "product",
      content_ids: items.map(function (item) {
        return String(item.item_id || "");
      }).filter(Boolean),
      contents: items.map(function (item) {
        var content = {
          id: String(item.item_id || ""),
          quantity: typeof item.quantity === "number" ? item.quantity : 1
        };
        if (typeof item.price === "number") content.item_price = item.price;
        return content;
      }).filter(function (item) {
        return item.id;
      }),
      num_items: items.reduce(function (total, item) {
        return total + (typeof item.quantity === "number" ? item.quantity : 1);
      }, 0),
      analytics_version: payload.analytics_version
    };

    if (typeof ecommerceData.value === "number") parameters.value = ecommerceData.value;
    if (ecommerceData.currency) parameters.currency = ecommerceData.currency;
    if (ecommerceData.transaction_id) parameters.order_id = ecommerceData.transaction_id;
    if (items[0] && items[0].item_name) parameters.content_name = items[0].item_name;
    return parameters;
  }

  function sendToMeta(name, payload) {
    var eventMap = {
      view_item: "ViewContent",
      add_to_cart: "AddToCart",
      begin_checkout: "InitiateCheckout",
      purchase: "Purchase"
    };
    var metaEventName = eventMap[name];
    if (!metaEventName) return;

    initializeMeta();
    window.fbq("trackSingle", META_PIXEL_ID, metaEventName, metaEventPayload(payload));
  }

  function sendToGa4(name, payload) {
    initializeGa4();

    var parameters = {
      send_to: GA_MEASUREMENT_ID,
      analytics_version: payload.analytics_version,
      page_type: payload.page_type
    };

    Object.keys(payload).forEach(function (key) {
      if (key === "event" || key === "event_name" || key === "ecommerce") return;
      parameters[key] = payload[key];
    });

    if (payload.ecommerce) {
      Object.keys(payload.ecommerce).forEach(function (key) {
        parameters[key] = payload.ecommerce[key];
      });
    }

    window.gtag("event", name, parameters);
  }

  function pushEvent(name, parameters) {
    if (!ALLOWED_EVENTS[name]) return false;

    var payload = sanitize(parameters || {}, "", 0) || {};
    payload.event = EVENT_NAME;
    payload.event_name = name;
    payload.analytics_version = VERSION;
    payload.page_type = pageType();

    window.dataLayer = window.dataLayer || [];
    if (payload.ecommerce) window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push(payload);
    sendToGa4(name, payload);
    sendToMeta(name, payload);

    try {
      window.dispatchEvent(new CustomEvent("wl:analytics", { detail: payload }));
    } catch (error) {}
    return true;
  }

  function trackOnce(key, name, parameters) {
    if (sent[key]) return false;
    sent[key] = true;
    return pushEvent(name, parameters);
  }

  function productIdFromLink(link) {
    if (!link) return "";
    var match = String(link.getAttribute("href") || link.href || "").match(/[?&]pid=([^&#]+)/i);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function findProductLink(root) {
    root = root || document;
    if (root.matches && root.matches("a[href*='ProductDetail.aspx']")) return root;
    return root.querySelector ? root.querySelector("a[href*='ProductDetail.aspx']") : null;
  }

  function findPrice(root) {
    var selectors = [
      "[data-price]",
      ".wl-product-price-row",
      ".productPriceSegment",
      ".priceRowProductCode",
      "[id$='_lblPrice']",
      "[id*='PriceLabel']",
      ".unit-price",
      ".cart-item-card .fw-bold",
      ".cart-line-total"
    ];
    for (var i = 0; i < selectors.length; i += 1) {
      var element = root.querySelector && root.querySelector(selectors[i]);
      var amount = element ? toNumber(element.getAttribute("data-price") || text(element)) : null;
      if (amount !== null && amount >= 0) return roundMoney(amount);
    }
    return null;
  }

  function findQuantity(root) {
    var element = root.querySelector && root.querySelector(
      ".wl-qty-value, input[data-wl-qty-native='1'], input[id*='Quantity'], input[id*='Qty']"
    );
    var amount = element ? toNumber(element.value || text(element)) : null;
    return amount !== null && amount > 0 ? amount : 1;
  }

  function findProductName(root, link, productId) {
    var selectors = [
      "[data-wl-product-name]",
      ".wl-product-title",
      "#ProductDescriptionRow a",
      ".product-description",
      ".cart-item-card p.text-secondary",
      "h1",
      "h2",
      "h3"
    ];
    for (var i = 0; i < selectors.length; i += 1) {
      var candidate = root.querySelector && root.querySelector(selectors[i]);
      var value = cleanString(text(candidate));
      if (value) return value;
    }
    var linkText = cleanString(text(link));
    if (linkText) return linkText;
    if (pageType() === "product_detail") {
      var title = cleanString(String(document.title || "").replace(/\s*[|\-].*$/, ""));
      if (title) return title;
    }
    return productId ? "Product " + productId : "Product";
  }

  function itemFromRoot(root, index) {
    root = root || document;
    var link = findProductLink(root);
    var productId = productIdFromLink(link);
    if (!productId && pageType() === "product_detail") {
      productId = new URLSearchParams(window.location.search).get("pid") || "";
    }
    if (!productId) {
      var code = root.querySelector && root.querySelector(".portalGridLink, .cart-item-card h6 a");
      productId = cleanString(text(code)) || "";
    }
    if (!productId) return null;

    var item = {
      item_id: productId,
      item_name: findProductName(root, link, productId),
      quantity: findQuantity(root)
    };
    var price = findPrice(root);
    if (price !== null) item.price = price;
    if (typeof index === "number") item.index = index;
    return item;
  }

  function productCardFor(element) {
    if (!element || !element.closest) return null;
    return element.closest(".wl-product-card, .cart-item-card, .shopping-cart-item, table, fieldset") || document;
  }

  function valueForItems(items) {
    return roundMoney(items.reduce(function (total, item) {
      var price = typeof item.price === "number" ? item.price : 0;
      var quantity = typeof item.quantity === "number" ? item.quantity : 1;
      return total + price * quantity;
    }, 0));
  }

  function ecommerce(items, value) {
    var result = { currency: "USD", items: items };
    if (typeof value === "number" && isFinite(value)) result.value = roundMoney(value);
    return result;
  }

  function queueAddToCart(item) {
    if (!item) return;
    safeStorage(window.sessionStorage, "set", PENDING_ADD_STORAGE_KEY, JSON.stringify({
      created_at: Date.now(),
      item: item
    }));
  }

  function emitQueuedAddToCart() {
    var raw = safeStorage(window.sessionStorage, "get", PENDING_ADD_STORAGE_KEY);
    if (!raw) return false;

    try {
      var pending = JSON.parse(raw);
      if (!pending || !pending.item || !pending.created_at ||
          Date.now() - pending.created_at > 2 * 60 * 1000) {
        safeStorage(window.sessionStorage, "remove", PENDING_ADD_STORAGE_KEY);
        return false;
      }

      var confirmation = document.getElementById("customCartModal");
      if (!confirmation || text(confirmation).indexOf("Added to Cart!") === -1) return false;

      safeStorage(window.sessionStorage, "remove", PENDING_ADD_STORAGE_KEY);
      var quantity = typeof pending.item.quantity === "number" ? pending.item.quantity : 1;
      var value = typeof pending.item.price === "number" ? pending.item.price * quantity : null;
      return pushEvent("add_to_cart", {
        ecommerce: ecommerce([pending.item], value)
      });
    } catch (error) {
      safeStorage(window.sessionStorage, "remove", PENDING_ADD_STORAGE_KEY);
      return false;
    }
  }

  function listName() {
    var term = getSearchTerm();
    if (term) return "Search Results";
    var heading = document.querySelector("h1, .page-title, [id*='HeaderText']");
    return cleanString(text(heading)) || "Product Listing";
  }

  function getSearchTerm() {
    var params = new URLSearchParams(window.location.search || "");
    var keys = ["searchText", "searchtext", "q", "query", "keyword", "term"];
    for (var i = 0; i < keys.length; i += 1) {
      var value = cleanString(params.get(keys[i]));
      if (value) return value;
    }
    return "";
  }

  function collectVisibleProducts(onlyNew) {
    var roots = Array.prototype.slice.call(document.querySelectorAll(
      "#productlistcards .wl-product-card, #productlistcards table, .wl-product-card"
    ));
    var items = [];
    var seenThisPass = Object.create(null);

    roots.forEach(function (root) {
      var item = itemFromRoot(root, items.length);
      if (!item || seenThisPass[item.item_id]) return;
      seenThisPass[item.item_id] = true;
      if (onlyNew && observedProductIds[item.item_id]) return;
      observedProductIds[item.item_id] = true;
      item.item_list_name = listName();
      items.push(item);
    });
    return items.slice(0, 100);
  }

  function emitProductList(onlyNew) {
    if (pageType() !== "product_list") return;
    var items = collectVisibleProducts(onlyNew);
    if (!items.length) return;
    pushEvent("view_item_list", {
      item_list_name: listName(),
      ecommerce: ecommerce(items, null)
    });
  }

  function cartItems() {
    var roots = Array.prototype.slice.call(document.querySelectorAll(
      ".cart-item-card, .shopping-cart-details .shopping-cart-item"
    ));
    var items = [];
    var ids = Object.create(null);
    roots.forEach(function (root) {
      if (root.closest && root.closest(".shopping-cart-item") && root.classList.contains("cart-item-card") === false && root.querySelector(".cart-item-card")) return;
      var item = itemFromRoot(root, items.length);
      if (!item || ids[item.item_id]) return;
      ids[item.item_id] = true;
      items.push(item);
    });
    return items;
  }

  function storeCartSnapshot(items, value) {
    if (!items.length) return;
    var snapshot = {
      updated_at: new Date().toISOString(),
      currency: "USD",
      value: value,
      items: items
    };
    safeStorage(window.localStorage, "set", CART_STORAGE_KEY, JSON.stringify(snapshot));
    safeStorage(window.sessionStorage, "set", CART_STORAGE_KEY, JSON.stringify(snapshot));
  }

  function readCartSnapshot() {
    var raw = safeStorage(window.sessionStorage, "get", CART_STORAGE_KEY) ||
      safeStorage(window.localStorage, "get", CART_STORAGE_KEY);
    try {
      if (!raw) return null;
      var snapshot = JSON.parse(raw);
      var updatedAt = Date.parse(snapshot && snapshot.updated_at);
      if (!snapshot || !Array.isArray(snapshot.items) || !updatedAt || Date.now() - updatedAt > CART_MAX_AGE_MS) {
        safeStorage(window.localStorage, "remove", CART_STORAGE_KEY);
        safeStorage(window.sessionStorage, "remove", CART_STORAGE_KEY);
        return null;
      }
      return snapshot;
    } catch (error) {
      return null;
    }
  }

  function cartValue(items) {
    var subtotal = document.querySelector(".SubtotalWrapper, .custom-subtotal-wrapper");
    var amount = subtotal ? toNumber(text(subtotal)) : null;
    return amount !== null ? roundMoney(amount) : valueForItems(items);
  }

  function emitViewCart() {
    var items = cartItems();
    if (!items.length) return;
    var value = cartValue(items);
    storeCartSnapshot(items, value);
    trackOnce("view_cart:" + items.map(function (item) { return item.item_id + ":" + item.quantity; }).join("|"), "view_cart", {
      ecommerce: ecommerce(items, value)
    });
  }

  function shippingMethod() {
    var pickup = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbCollectLater");
    var delivered = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbDelivered");
    if (pickup && pickup.checked) return "pickup";
    if (delivered && delivered.checked) return "delivery";
    var selected = document.querySelector(".modern-shipping-selector button.wl-selected, .modern-shipping-selector button.is-selected");
    var value = selected && selected.getAttribute("data-value");
    if (/CollectLater/i.test(value || "")) return "pickup";
    if (/Delivered/i.test(value || "")) return "delivery";
    return "";
  }

  function emitShipping(method) {
    method = method || shippingMethod();
    if (!method) return;
    var snapshot = readCartSnapshot();
    var key = method + ":" + (snapshot ? cartSignature(snapshot) : "empty");
    var now = Date.now();
    if (lastShippingEvent.key === key && now - lastShippingEvent.at < 1500) return;
    lastShippingEvent = { key: key, at: now };
    pushEvent("add_shipping_info", {
      shipping_tier: method,
      ecommerce: snapshot ? ecommerce(snapshot.items || [], snapshot.value) : undefined
    });
  }

  function hasPaymentStep() {
    var candidates = document.querySelectorAll(
      "iframe[src*='epx' i], iframe[title*='payment' i], [id*='PaymentMethod'], [id*='PaymentType'], [class*='payment-method']"
    );
    for (var i = 0; i < candidates.length; i += 1) {
      if (isVisible(candidates[i])) return true;
    }
    return false;
  }

  function emitPaymentStep() {
    if (!hasPaymentStep()) return;
    var snapshot = readCartSnapshot();
    trackOnce("add_payment_info", "add_payment_info", {
      payment_type: "EPX",
      ecommerce: snapshot ? ecommerce(snapshot.items || [], snapshot.value) : undefined
    });
  }

  function purchaseIds() {
    var raw = safeStorage(window.localStorage, "get", PURCHASE_STORAGE_KEY);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      return [];
    }
  }

  function markPurchased(transactionId) {
    var ids = purchaseIds().filter(function (id) { return id !== transactionId; });
    ids.unshift(transactionId);
    safeStorage(window.localStorage, "set", PURCHASE_STORAGE_KEY, JSON.stringify(ids.slice(0, 25)));
  }

  function emitPurchase() {
    var response = document.getElementById("CartResponseMessage");
    var merchant = document.getElementById("ctl00_PageBody_SuccessfulPaymentResults_MerchantDetailsPanel");
    if (!hasOrderConfirmation()) return false;

    var strong = response.querySelector("strong");
    var transactionId = cleanString(text(strong));
    if (!transactionId) {
      var match = text(response).match(/(?:order|confirmation)\s*(?:number|#)?\s*[:#]?\s*([A-Z0-9-]+)/i);
      transactionId = match ? cleanString(match[1]) : null;
    }
    if (!transactionId || purchaseIds().indexOf(transactionId) !== -1) return false;

    var snapshot = readCartSnapshot() || { items: [], value: null };
    var storedSubtotal = toNumber(safeStorage(window.sessionStorage, "get", "purchaseSubtotal"));
    var value = storedSubtotal !== null ? storedSubtotal : snapshot.value;
    pushEvent("purchase", {
      ecommerce: {
        transaction_id: transactionId,
        currency: "USD",
        value: typeof value === "number" ? roundMoney(value) : undefined,
        items: snapshot.items || []
      }
    });
    markPurchased(transactionId);
    safeStorage(window.localStorage, "remove", CART_STORAGE_KEY);
    safeStorage(window.sessionStorage, "remove", CART_STORAGE_KEY);
    safeStorage(window.sessionStorage, "remove", CHECKOUT_STORAGE_KEY);
    return true;
  }

  function cartSignature(snapshot) {
    var items = snapshot && Array.isArray(snapshot.items) ? snapshot.items : [];
    return items.map(function (item) {
      return [item.item_id || "", item.quantity || 1, item.price || ""].join(":");
    }).sort().join("|");
  }

  function emitBeginCheckout(stage, snapshot) {
    snapshot = snapshot || readCartSnapshot();
    var signature = snapshot ? cartSignature(snapshot) : "empty";
    if (safeStorage(window.sessionStorage, "get", CHECKOUT_STORAGE_KEY) === signature) return false;
    var pushed = pushEvent("begin_checkout", {
      checkout_stage: stage,
      ecommerce: snapshot ? ecommerce(snapshot.items || [], snapshot.value) : undefined
    });
    if (pushed) safeStorage(window.sessionStorage, "set", CHECKOUT_STORAGE_KEY, signature);
    return pushed;
  }

  function emitInitialPageEvents() {
    var type = pageType();
    if (type === "product_list") {
      var term = getSearchTerm();
      if (term) trackOnce("search:" + term.toLowerCase(), "search", { search_term: term });
      window.setTimeout(function () { emitProductList(false); }, 500);
      return;
    }

    if (type === "product_detail") {
      window.setTimeout(function () {
        var item = itemFromRoot(document, 0);
        if (!item) return;
        trackOnce("view_item:" + item.item_id, "view_item", {
          ecommerce: ecommerce([item], typeof item.price === "number" ? item.price : null)
        });
      }, 350);
      return;
    }

    if (type === "order_confirmation") {
      emitPurchase();
      return;
    }

    if (type === "cart") window.setTimeout(emitViewCart, 450);
    if (type === "checkout" || type === "checkout_review") {
      var snapshot = readCartSnapshot();
      emitBeginCheckout(type, snapshot);
      emitPaymentStep();
    }
  }

  function itemForAction(target) {
    return itemFromRoot(productCardFor(target) || document, 0);
  }

  function handleClick(event) {
    var target = event.target && event.target.closest ? event.target.closest("a, button, input") : null;
    if (!target) return;

    var productLink = target.closest("a[href*='ProductDetail.aspx']");
    if (productLink && pageType() === "product_list") {
      var selected = itemForAction(productLink);
      if (selected) {
        selected.item_list_name = listName();
        pushEvent("select_item", {
          item_list_name: listName(),
          ecommerce: ecommerce([selected], typeof selected.price === "number" ? selected.price : null)
        });
      }
      return;
    }

    var id = target.id || "";
    if (/AddProductButton/i.test(id) || target.matches("[data-wl-action='add-to-cart']")) {
      var added = itemForAction(target);
      if (added) {
        var nativeForm = target.form || (target.closest && target.closest("form"));
        var buttonType = String(target.getAttribute("type") || "").toLowerCase();
        if (nativeForm && buttonType !== "button") {
          queueAddToCart(added);
          return;
        }
        pushEvent("add_to_cart", {
          ecommerce: ecommerce([added], typeof added.price === "number" ? added.price * added.quantity : null)
        });
      }
      return;
    }

    if (target.matches(".delete-link, [id*='_del_']")) {
      var removed = itemForAction(target);
      if (removed) {
        pushEvent("remove_from_cart", {
          ecommerce: ecommerce([removed], typeof removed.price === "number" ? removed.price * removed.quantity : null)
        });
      }
      return;
    }

    if (target.matches(".wl-qty-increase, .wl-qty-decrease")) {
      window.setTimeout(function () {
        var changed = itemForAction(target);
        if (changed) pushEvent("cart_quantity_change", {
          change_type: target.matches(".wl-qty-increase") ? "increase" : "decrease",
          ecommerce: ecommerce([changed], typeof changed.price === "number" ? changed.price * changed.quantity : null)
        });
      }, 0);
      return;
    }

    if (/PlaceOrderButton/i.test(id) || target.id === "customCheckoutBtn") {
      var currentItems = cartItems();
      var snapshot = readCartSnapshot();
      if (currentItems.length) {
        var value = cartValue(currentItems);
        storeCartSnapshot(currentItems, value);
        snapshot = { items: currentItems, value: value };
      }
      safeStorage(window.sessionStorage, "remove", CHECKOUT_STORAGE_KEY);
      return;
    }

    if (target.closest(".modern-shipping-selector") && target.matches("button[data-value]")) {
      var method = /CollectLater/i.test(target.getAttribute("data-value") || "") ? "pickup" : "delivery";
      window.setTimeout(function () { emitShipping(method); }, 0);
      return;
    }

    if (/CompleteCheckoutButton/i.test(id) || id === "wl-complete" || id === "wl-sticky-complete") {
      var finalSnapshot = readCartSnapshot();
      trackOnce("checkout_submit", "checkout_submit", {
        ecommerce: finalSnapshot ? ecommerce(finalSnapshot.items || [], finalSnapshot.value) : undefined
      });
    }
  }

  function handleChange(event) {
    var target = event.target;
    if (!target) return;
    if (target.id === "ctl00_PageBody_SaleTypeSelector_rbDelivered" && target.checked) emitShipping("delivery");
    if (target.id === "ctl00_PageBody_SaleTypeSelector_rbCollectLater" && target.checked) emitShipping("pickup");
  }

  function observeDynamicContent() {
    if (!window.MutationObserver || !document.body) return;
    var observer = new MutationObserver(function () {
      window.clearTimeout(observerTimer);
      observerTimer = window.setTimeout(function () {
        if (pageType() === "product_list") emitProductList(true);
        if (pageType() === "cart") emitViewCart();
        if (pageType() === "order_confirmation") emitPurchase();
        emitPaymentStep();
      }, 300);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "aria-hidden"]
    });
  }

  window.WLAnalytics = {
    version: VERSION,
    track: pushEvent,
    trackOnce: trackOnce,
    getCartSnapshot: readCartSnapshot,
    refresh: emitInitialPageEvents
  };

  initializeGa4();
  initializeMeta();

  ready(function () {
    document.addEventListener("click", handleClick, true);
    document.addEventListener("change", handleChange, true);
    emitInitialPageEvents();
    window.setTimeout(emitQueuedAddToCart, 700);
    observeDynamicContent();
  });
})(window, document);
