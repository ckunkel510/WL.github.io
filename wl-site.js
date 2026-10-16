(function (window, document) {
  "use strict";

  if (window.WLAnalytics) return;

  var VERSION = "1.8.1";
  var EVENT_NAME = "wl_analytics_event";
  var GA_MEASUREMENT_ID = "G-4ZLV1YB6GY";
  var META_PIXEL_ID = "188974749776655";
  var CART_STORAGE_KEY = "wl_analytics_cart_v1";
  var CHECKOUT_STORAGE_KEY = "wl_analytics_checkout_v1";
  var PURCHASE_STORAGE_KEY = "wl_analytics_purchases_v1";
  var PENDING_ADD_STORAGE_KEY = "wl_analytics_pending_add_v1";
  var EXPERIMENT_STORAGE_KEY = "wl_analytics_experiment_v1";
  var RECOMMENDATION_STORAGE_KEY = "wl_pdp_recommendation_attribution_v1";
  var DISCOVERY_STORAGE_KEY = "wl_product_discovery_attribution_v1";
  var CART_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  var RECOMMENDATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
  var REVIEW_STORAGE_KEY = "wl_analytics_review_v2";
  var confirmedPurchase = false;
  var currentReview = null;
  var sent = Object.create(null);
  var observedProductIds = Object.create(null);
  var observerTimer = 0;
  var pendingCartRoot = null;
  var pageToken = Date.now().toString(36)+Math.random().toString(36).slice(2);
  var PENDING_CART_KEY = "wl_analytics_pending_cart_v1";
  var productListObserver = null;
  var observedProductRoots = typeof WeakSet === "function" ? new WeakSet() : null;
  var lastShippingEvent = { key: "", at: 0 };

  var ALLOWED_EVENTS = {
    search: true,
    search_results_enhanced: true,
    search_refine_click: true,
    search_suggestion_click: true,
    view_item_list: true,
    select_item: true,
    view_item: true,
    add_to_cart: true,
    remove_from_cart: true,
    cart_quantity_change: true,
    cart_remove_click: true,
    cart_quantity_change_start: true,
    cart_action_error: true,
    save_for_later: true,
    navigation_click: true,
    view_cart: true,
    begin_checkout: true,
    add_shipping_info: true,
    add_payment_info: true,
    checkout_submit: true,
    checkout_review: true,
    checkout_cancel: true,
    checkout_error: true,
    checkout_payment_view: true,
    quick_buy_open: true,
    guest_checkout_start: true,
    guest_details_complete: true,
    guest_checkout_error: true,
    save_for_later_click: true,
    saved_item_add_click: true,
    purchase: true,
    share_product: true,
    generate_lead: true,
    pdp_fulfillment_view: true,
    pdp_fulfillment_ready: true,
    pdp_fulfillment_select: true,
    pdp_store_availability: true,
    pdp_price_sign_in: true,
    pdp_option_view: true,
    pdp_option_select: true
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

  function confirmedOrderId(page) {
    page = page || document;
    var search = page.defaultView?.location?.search;
    if (search == null && page === document) search = window.location.search;
    if (!/(?:^|[?&])success=1(?:&|$)/i.test(search || "")) return "";
    var response = page.getElementById("CartResponseMessage");
    var merchant = page.getElementById("ctl00_PageBody_SuccessfulPaymentResults_MerchantDetailsPanel");
    if (!response || !merchant || !text(merchant) || /(?:failed|declined|unsuccessful|error)/i.test(text(response))) return "";
    var strong = response.querySelector("strong");
    var value = text(strong).replace(/^(?:reserved\s+)?order(?:\s+(?:number|no\.?))?\s*[:#-]?\s*/i, "");
    if (!value) value = text(response).match(/(?:order|confirmation)\s*(?:number|no\.?|#)\s*[:#]?\s*([A-Z0-9-]+)/i)?.[1] || "";
    return /^[A-Z0-9][A-Z0-9-]{2,63}$/i.test(value) && /\d/.test(value) ? value : "";
  }

  function hasOrderConfirmation() { return !!confirmedOrderId(document); }

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

  function experimentContext() {
    try {
      var stored = JSON.parse(window.sessionStorage.getItem(EXPERIMENT_STORAGE_KEY) || "null");
      if (!stored || typeof stored !== "object") return {};
      var context = {};
      ["experiment_id", "experiment_variant", "fulfillment_method"].forEach(function (key) {
        var value = cleanString(stored[key]);
        if (value) context[key] = value;
      });
      return context;
    } catch (error) {
      return {};
    }
  }

  function recommendationContext(name, parameters) {
    var candidates = [RECOMMENDATION_STORAGE_KEY, DISCOVERY_STORAGE_KEY].map(function (storageKey) {
      var stored;
      try {
        stored = JSON.parse(safeStorage(window.sessionStorage, "get", storageKey) || "null");
      } catch (error) {
        safeStorage(window.sessionStorage, "remove", storageKey);
        return null;
      }
      if (
        !stored ||
        !/^\d{1,20}$/.test(String(stored.productId || "")) ||
        !Number.isFinite(Number(stored.selectedAt)) ||
        Date.now() - Number(stored.selectedAt) > RECOMMENDATION_MAX_AGE_MS
      ) {
        if (stored) safeStorage(window.sessionStorage, "remove", storageKey);
        return null;
      }
      stored.storageKey = storageKey;
      return stored;
    }).filter(function (candidate) { return !!candidate; });
    var stored = candidates.sort(function (left, right) {
      return Number(right.selectedAt) - Number(left.selectedAt);
    })[0];
    if (!stored) return parameters || {};

    var source = parameters || {};
    var ecommerceData = source.ecommerce;
    var items = ecommerceData && Array.isArray(ecommerceData.items) ? ecommerceData.items : [];
    var matched = false;
    var attributedItems = items.map(function (item) {
      if (String(item && item.item_id || "") !== String(stored.productId)) return item;
      matched = true;
      return Object.assign({}, item, {
        item_list_id: cleanString(stored.listId) || "pdp_compare_similar_v2",
        item_list_name: cleanString(stored.listName) || "Compare similar products"
      });
    });
    if (!matched) return source;

    var enriched = Object.assign({}, source, {
      item_list_id: cleanString(stored.listId) || "pdp_compare_similar_v2",
      item_list_name: cleanString(stored.listName) || "Compare similar products",
      recommendation_algorithm: cleanString(stored.algorithm) || "merchant_category_affinity_v2",
      recommendation_strategy: cleanString(stored.strategy) || undefined,
      recommendation_source_product_id: cleanString(stored.sourceProductId) || undefined,
      ecommerce: Object.assign({}, ecommerceData, { items: attributedItems })
    });
    if (name === "purchase") {
      safeStorage(window.sessionStorage, "remove", RECOMMENDATION_STORAGE_KEY);
      safeStorage(window.sessionStorage, "remove", DISCOVERY_STORAGE_KEY);
    }
    return enriched;
  }

  function pushEvent(name, parameters) {
    if (!ALLOWED_EVENTS[name] || (name === "purchase" && !confirmedPurchase)) return false;

    var enriched = Object.assign({}, experimentContext(), recommendationContext(name, parameters));
    var payload = sanitize(enriched, "", 0) || {};
    payload.sign_in_state = document.querySelector("a[href*='SignOut=1' i]") ? "signed_in" : "signed_out";
    payload.event = EVENT_NAME;
    payload.event_name = name;
    payload.analytics_version = VERSION;
    payload.page_type = name === "purchase" ? "order_confirmation" : enriched.checkout_flow ? "compact_checkout" : pageType();

    window.dataLayer = window.dataLayer || [];
    if (payload.ecommerce) window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push(payload);
    try { sendToGa4(name, payload); } catch (_) {}
    try { sendToMeta(name, payload); } catch (_) {}

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
      ".sflPrice",
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
      ".wl-qty-control select, .wl-qty-value, input[data-wl-qty-native='1'], input[id*='_qty_'], input[id*='Quantity'], input[id*='Qty']"
    );
    var amount = element ? toNumber(element.value || text(element)) : null;
    return amount !== null && amount > 0 ? amount : 1;
  }

  function findProductName(root, link, productId) {
    var selectors = [
      "#wl-product-title, .productDescriptionOnThisPageFull",
      ".sflDesc",
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
    if (pageType() === "product_detail") {
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
    return element.closest(".wl-product-card, .cart-item-card, .shopping-cart-item, .sflRow, table, fieldset") || document;
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

  function queueCartMutation(kind, item, requestedQuantity, root) {
    if (!item || !/^\d{1,20}$/.test(String(item.item_id || ""))) return false;
    var previous=cartItems().find(function (row) { return row.item_id===item.item_id; });
    var before=kind==="add_saved" ? Number(previous?.quantity || 0) : Number(item.quantity);
    var after=Number(requestedQuantity);
    if (!Number.isFinite(before) || !Number.isFinite(after) || before<0 || after<0 || before===after) return false;
    var pending={at:Date.now(),from:pageToken,kind:kind,item:item,before:before,after:after};
    pendingCartRoot=root || null;
    safeStorage(window.sessionStorage,"set",PENDING_CART_KEY,JSON.stringify(pending));
    return true;
  }

  function pendingCartMutation() {
    try {
      var value=JSON.parse(safeStorage(window.sessionStorage,"get",PENDING_CART_KEY) || "null");
      if (!value || !["quantity","remove","save","add_saved"].includes(value.kind) || !Number.isFinite(value.at) || Date.now()-value.at<0 || Date.now()-value.at>120000 || !value.item || !/^\d{1,20}$/.test(String(value.item.item_id)) || !Number.isFinite(value.before) || !Number.isFinite(value.after) || value.before<0 || value.after<0 || value.before===value.after || typeof value.from!=="string") return null;
      return value;
    } catch (_) { return null; }
  }

  function confirmCartMutation(items) {
    var pending=pendingCartMutation();
    if (!pending) { safeStorage(window.sessionStorage,"remove",PENDING_CART_KEY); return false; }
    // A locally edited input is not proof. Wait for a new document or native row replacement.
    if (pending.from===pageToken && (!pendingCartRoot || document.documentElement.contains(pendingCartRoot))) return false;
    var current=items.find(function (item) { return item.item_id===pending.item.item_id; });
    var quantity=current ? current.quantity : 0;
    safeStorage(window.sessionStorage,"remove",PENDING_CART_KEY); pendingCartRoot=null;
    if (Math.abs(quantity-pending.after)>0.000001) return pushEvent("cart_action_error",{cart_action:pending.kind,error_code:"cart_change_not_confirmed"});
    var item=Object.assign({},pending.item,current || {},{quantity:Math.abs(quantity-pending.before)});
    var value=typeof item.price==="number" ? item.price*item.quantity : null;
    var params={cart_action:pending.kind,ecommerce:ecommerce([item],value)};
    pushEvent(quantity>pending.before ? "add_to_cart" : "remove_from_cart",params);
    if (pending.kind==="quantity") pushEvent("cart_quantity_change",{previous_quantity:pending.before,quantity:quantity,change_type:quantity>pending.before?"increase":"decrease",ecommerce:ecommerce([Object.assign({},item,{quantity:quantity})],typeof item.price==="number"?item.price*quantity:null)});
    if (pending.kind==="save") pushEvent("save_for_later",params);
    return true;
  }

  function cartRow(element) {
    return element?.closest?.(".shopping-cart-item,.sflRow,.cart-item-card") || null;
  }

  function trackNavigation(target) {
    if (!target.matches?.("a[href]")) return;
    var href=target.getAttribute("href");
    if (!href || /^(?:#|javascript:)/i.test(href)) return;
    var url;
    try { url=new URL(href,window.location.href || "https://webtrack.woodsonlumber.com/"); } catch (_) { return; }
    if (!["webtrack.woodsonlumber.com","www.woodsonlumber.com","woodsonlumber.com"].includes(url.hostname)) return;
    var path=url.pathname.toLowerCase(),type="";
    var types={"/shoppingcart.aspx":"cart","/signin.aspx":"sign_in","/accountinfo_r.aspx":"my_account","/quicklists_r.aspx":"saved_lists","/default.aspx":"home","/":"home","/stores":"locations","/credit":"credit","/contact-us":"contact","/employment":"careers","/shipping-policy":"shipping_policy"};
    if (path==="/signin.aspx" && url.searchParams.get("SignOut")==="1") type="sign_out";
    else if (path==="/products.aspx") type=url.searchParams.has("pg") || url.searchParams.has("pl1") ? "product_category" : "product_list";
    else type=types[path] || "";
    if (!type) return;
    var area=target.closest("#wl-department-nav")?"departments":target.closest("#wl-desktop-primary-nav")?"main_menu":target.closest("#siteHeaderContent,nav[aria-label='Account and cart']")?"header":"content";
    var params={navigation_area:area,destination_type:type,destination_path:url.pathname};
    if (type==="product_category") {
      var id=url.searchParams.get("pg") || url.searchParams.get("pl1");
      if (/^\d{1,20}$/.test(id || "")) params.category_id=id;
      params.category_label=cleanString(text(target));
    }
    pushEvent("navigation_click",params);
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
      if (root.closest?.("[data-wl-self-tracked-product-list='true']")) return;
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
    var roots=Array.from(document.querySelectorAll("#productlistcards .wl-product-card, #productlistcards table, .wl-product-card")).filter(function (root) {
      return !root.closest("[data-wl-self-tracked-product-list='true']") && !(root.tagName==="TABLE" && (root.closest(".wl-product-card") || Array.from(root.querySelectorAll("table")).some(function (nested) { return !!findProductLink(nested); })));
    });
    if (typeof window.IntersectionObserver!=="function") {
      var items=collectVisibleProducts(onlyNew); if (items.length) pushEvent("view_item_list",{item_list_name:listName(),ecommerce:ecommerce(items,null)}); return;
    }
    if (!productListObserver) productListObserver=new window.IntersectionObserver(function (entries) {
      var items=[];
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || entry.intersectionRatio<0.35) return;
        var root=entry.target;
        productListObserver.unobserve(root);
        var item=itemFromRoot(root,Number(root.getAttribute("data-wl-list-position")) || 0);
        if (!item || observedProductIds[item.item_id]) return;
        observedProductIds[item.item_id]=true; item.item_list_name=listName(); items.push(item);
      });
      if (items.length) pushEvent("view_item_list",{item_list_name:listName(),ecommerce:ecommerce(items.slice(0,100),null)});
    },{threshold:[0.35]});
    roots.forEach(function (root,index) {
      if (observedProductRoots?.has(root)) return;
      observedProductRoots?.add(root); root.setAttribute("data-wl-list-position",String(index)); productListObserver.observe(root);
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
    // A previous browser/account session must never supply a new order’s basket.
    var raw = safeStorage(window.sessionStorage, "get", CART_STORAGE_KEY);
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

  function cartFullyRendered(items) {
    // Cart row customizations can finish at different times. Never report a partial basket.
    var links=Array.from(document.querySelectorAll?.("#ctl00_PageBody_ShoppingCartDetailPanel .shopping-cart-item a[href*='ProductDetail.aspx']") || []);
    return links.every(function (link) { var id=productIdFromLink(link); return !id || items.some(function (item) { return item.item_id===id; }); });
  }

  function emitViewCart() {
    var items = cartItems();
    if (!cartFullyRendered(items)) return;
    if (!items.length) {
      if (/your cart (?:is (?:currently )?)?empty/i.test(text(document.querySelector(".mainContents")))) {
        confirmCartMutation([]);
        safeStorage(window.sessionStorage, "remove", CART_STORAGE_KEY);
        safeStorage(window.localStorage, "remove", CART_STORAGE_KEY);
      }
      return;
    }
    confirmCartMutation(items);
    var value = cartValue(items);
    storeCartSnapshot(items, value);
    trackOnce("view_cart:" + items.map(function (item) { return item.item_id + ":" + item.quantity; }).join("|"), "view_cart", {
      ecommerce: ecommerce(items, value)
    });
  }

  function shippingMethod() {
    if (document.querySelector('#btnShip[aria-pressed="true"]')) return "ship";
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
    trackOnce("checkout_payment_view", "checkout_payment_view", {
      payment_type: "EPX",
      ecommerce: snapshot ? ecommerce(snapshot.items || [], snapshot.value) : undefined
    });
  }

  function purchaseIds() {
    var ids = [];
    [window.localStorage, window.sessionStorage].forEach(function (storage) {
      try { var value=JSON.parse(safeStorage(storage,"get",PURCHASE_STORAGE_KEY) || "[]"); if (Array.isArray(value)) ids=ids.concat(value.filter(function (id) { return typeof id === "string"; })); } catch (_) {}
    });
    return Array.from(new Set(ids));
  }

  function markPurchased(transactionId) {
    var ids=purchaseIds().filter(function (id) { return id!==transactionId; }); ids.unshift(transactionId);
    [window.localStorage,window.sessionStorage].forEach(function (storage) { safeStorage(storage,"set",PURCHASE_STORAGE_KEY,JSON.stringify(ids.slice(0,200))); });
  }

  function validMoney(value) {
    var amount=typeof value === "number" ? value : toNumber(value);
    return typeof amount === "number" && amount>=0 && isFinite(amount) ? roundMoney(amount) : null;
  }

  function checkoutItems(rows, page) {
    var items=(Array.isArray(rows)?rows:[]).map(function (row) {
      var id=String(row.item_id || row.pid || ""), quantity=Number(row.quantity);
      if (!/^\d{1,20}$/.test(id) || !Number.isFinite(quantity) || quantity<=0) return null;
      var item={item_id:id,quantity:quantity,item_name:cleanString(row.item_name || row.name || row.code) || "Product "+id};
      if (typeof row.price === "number" && validMoney(row.price)!==null) item.price=validMoney(row.price);
      return item;
    }).filter(Boolean);
    var grid=page?.getElementById("ctl00_PageBody_ShoppingCartSummaryTableControl_BasketLinesGrid_ctl00");
    if (grid) {
      var headers=Array.from(grid.querySelectorAll("thead th"));
      var priceIndex=headers.findIndex(function (header) { return /^(?:unit )?price(?:\s|$)/i.test(text(header)); });
      Array.from(grid.querySelectorAll("tr.rgRow,tr.rgAltRow")).forEach(function (row) {
        var cells=row.querySelectorAll("td"), item=items.find(function (entry) { return (rows || []).some(function (source) { return String(source.item_id || source.pid)===entry.item_id && cleanString(source.code)===text(cells[0]); }); });
        var price=priceIndex>=0 ? validMoney(text(cells[priceIndex])) : null;
        if (item && price!==null) item.price=price;
      });
    }
    return items;
  }

  function readReview() {
    try {
      var value=currentReview || JSON.parse(safeStorage(window.sessionStorage,"get",REVIEW_STORAGE_KEY) || "null");
      if (!value || typeof value.key!=="string" || !Number.isFinite(value.at) || Date.now()-value.at<0 || Date.now()-value.at>=2*60*60*1000 || !Array.isArray(value.items) || !value.items.length) return null;
      var items=checkoutItems(value.items), amounts={};
      if (items.length!==value.items.length) return null;
      for (var key of ["value","tax","shipping"]) { if (validMoney(value.amounts?.[key])===null) return null; amounts[key]=validMoney(value.amounts[key]); }
      return {at:value.at,key:value.key,items:items,amounts:amounts};
    } catch (_) { return null; }
  }

  function reviewAmounts(page, supplied) {
    var totals=supplied || {};
    if (!supplied) Array.from(page?.querySelectorAll("#summary table tbody tr") || []).forEach(function (row) {
      var label=text(row.children[0]), amount=text(row.querySelector("td.numeric"));
      if (/^Subtotal\b/i.test(label)) totals.subtotal=amount;
      else if (/^Tax$/i.test(label)) totals.tax=amount;
      else if (/^(?:Shipping|Delivery)(?:\s|$)/i.test(label)) totals.shipping=amount;
      else if (/^Total(?: inc Tax)?$/i.test(label)) totals.total=amount;
    });
    var value=validMoney(totals.subtotal), tax=validMoney(totals.tax), shipping=validMoney(totals.shipping), total=validMoney(totals.total);
    if ([value,tax,total].includes(null)) return null;
    if (shipping===null && Math.abs(total-value-tax)<0.02) shipping=0;
    if (shipping===null || Math.abs(total-value-tax-shipping)>0.02) return null;
    return {value:value,tax:tax,shipping:shipping};
  }

  function rememberReview(page, details) {
    if (!page?.getElementById("ctl00_PageBody_CompleteCheckoutButton")) return null;
    var amounts=reviewAmounts(page,details?.totals); if (!amounts) return null;
    var items=details ? checkoutItems(details.items,page) : checkoutItems(readCartSnapshot()?.items || [],page);
    if (!items.length) return null;
    var record={at:Date.now(),key:details?.id || "native",items:items,amounts:amounts};
    currentReview=record; safeStorage(window.sessionStorage,"set",REVIEW_STORAGE_KEY,JSON.stringify(record)); return record;
  }

  function sameCheckoutItems(left, right) {
    var signature=function (items) { return checkoutItems(items).map(function (item) { return item.item_id+":"+item.quantity; }).sort().join("|"); };
    return signature(left)===signature(right);
  }

  function emitPurchase(page, details) {
    page=page || document;
    var transactionId=confirmedOrderId(page);
    if (!transactionId || details && transactionId!==details.orderNumber || sent["purchase:"+transactionId] || purchaseIds().includes(transactionId)) return false;
    var review=readReview();
    if (details && (!review || review.key!==details.id || !sameCheckoutItems(review.items,details.items))) return false;
    if (!details && review?.key!=="native") review=null;
    var params={ecommerce:Object.assign({transaction_id:transactionId,currency:"USD",items:review?.items || []},review?.amounts || {})};
    if (details) {
      params.checkout_flow=details.flow; params.checkout_stage="confirmed"; params.customer_type=details.customerType; params.included_cart_items=Math.max(0,Math.floor(Number(details.includedCartItems)||0));
      if (["pickup","delivery","ship"].includes(details.method)) { params.shipping_tier=details.method; params.fulfillment_method=details.method; }
      if (["stored_card","new_card","no_payment_due","webtrack"].includes(details.paymentType)) params.payment_type=details.paymentType;
    }
    // Set the guard before dispatch, including reentrant callbacks/storage failures.
    sent["purchase:"+transactionId]=true; confirmedPurchase=true;
    try { pushEvent("purchase",params); } finally { confirmedPurchase=false; }
    markPurchased(transactionId); currentReview=null;
    [CART_STORAGE_KEY,CHECKOUT_STORAGE_KEY,REVIEW_STORAGE_KEY,PENDING_CART_KEY,PENDING_ADD_STORAGE_KEY].forEach(function (key) { safeStorage(window.sessionStorage,"remove",key); });
    safeStorage(window.localStorage,"remove",CART_STORAGE_KEY);
    return true;
  }

  function checkout(stage, details, page) {
    details=details || {};
    if (!["quick_buy","compact_cart"].includes(details.flow) || !["guest","signed_in"].includes(details.customerType) || !details.id) return false;
    if (stage==="purchase") return emitPurchase(page,details);
    var names={begin:"begin_checkout",shipping:"add_shipping_info",payment:"add_payment_info",review:"checkout_review",submit:"checkout_submit",cancel:"checkout_cancel",error:"checkout_error"};
    var name=names[stage]; if (!name) return false;
    var items=checkoutItems(details.items,page); if (!items.length) return false;
    var params={checkout_flow:details.flow,checkout_stage:stage,customer_type:details.customerType,included_cart_items:Math.max(0,Math.floor(Number(details.includedCartItems)||0)),ecommerce:ecommerce(items,null)};
    var record=stage==="review" ? rememberReview(page,details) : readReview();
    if ((["review","submit"].includes(stage) || ["shipping","payment"].includes(stage) && page?.getElementById("ctl00_PageBody_CompleteCheckoutButton")) && record?.key===details.id && sameCheckoutItems(record.items,items)) params.ecommerce=Object.assign(ecommerce(record.items,null),record.amounts);
    if (stage==="review" && !record) return false;
    if (stage==="review" && Number.isFinite(details.readyMs) && details.readyMs>=0 && details.readyMs<=1800000) params.checkout_ready_ms=Math.round(details.readyMs);
    if (stage==="submit" && (!record || record.key!==details.id || !sameCheckoutItems(record.items,items))) return false;
    if (["pickup","delivery","ship"].includes(details.method)) { params.shipping_tier=details.method; params.fulfillment_method=details.method; }
    if (["stored_card","new_card","no_payment_due","webtrack"].includes(details.paymentType)) params.payment_type=details.paymentType;
    if (stage==="error") params.error_code="checkout_unavailable";
    if (stage==="cancel" && record?.key===details.id) { currentReview=null; safeStorage(window.sessionStorage,"remove",REVIEW_STORAGE_KEY); }
    var signature=stage==="begin" ? "" : items.map(function (item) { return item.item_id+":"+item.quantity; }).sort().join("|");
    var choice=stage==="shipping"?details.method:stage==="payment"?details.paymentType:stage==="review"?JSON.stringify(record?.amounts):"";
    return trackOnce("checkout:"+details.id+":"+stage+":"+signature+":"+choice,name,params);
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
    if (type === "checkout_review") {
      rememberReview(document);
      trackOnce("native_payment_accepted","add_payment_info",{payment_type:"webtrack"});
    }
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
    trackNavigation(target);
    if (/SignOut=1/i.test(target.getAttribute("href") || "")) {
      currentReview=null;
      [CART_STORAGE_KEY,CHECKOUT_STORAGE_KEY,REVIEW_STORAGE_KEY,PENDING_CART_KEY,PENDING_ADD_STORAGE_KEY].forEach(function (key) { safeStorage(window.sessionStorage,"remove",key); });
      safeStorage(window.localStorage,"remove",CART_STORAGE_KEY); return;
    }

    var productLink = target.closest("a[href*='ProductDetail.aspx']");
    if (productLink && (pageType() === "product_list" || productLink.closest(".sflRow"))) {
      if (productLink.closest("[data-wl-self-tracked-product-list='true']")) return;
      var selected = itemForAction(productLink);
      if (selected) {
        selected.item_list_name = productLink.closest(".sflRow") ? "Saved for Later" : listName();
        pushEvent("select_item", {
          item_list_name: selected.item_list_name,
          ecommerce: ecommerce([selected], typeof selected.price === "number" ? selected.price : null)
        });
      }
      return;
    }

    if (target.matches(".sfl-button,.js-sfl-add")) {
      var savedItem=itemFromRoot(target.closest(".sflRow,.shopping-cart-item") || document,0);
      pushEvent(target.matches(".sfl-button")?"save_for_later_click":"saved_item_add_click",{ecommerce:savedItem?ecommerce([savedItem],null):undefined});
      if (savedItem) {
        var adding=target.matches(".js-sfl-add"),before=cartItems().find(function (item) { return item.item_id===savedItem.item_id; });
        queueCartMutation(adding?"add_saved":"save",savedItem,adding?Number(before?.quantity || 0)+1:0,cartRow(target));
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
        var pending=pendingCartMutation();
        if (!pending || pending.kind!=="save" || pending.item.item_id!==removed.item_id) queueCartMutation("remove",removed,0,cartRow(target));
        pushEvent("cart_remove_click",{ecommerce:ecommerce([removed],null)});
      }
      return;
    }

    if (target.matches(".wl-qty-increase, .wl-qty-decrease")) {
      var changed=itemForAction(target);
      if (changed && !target.disabled) {
        var wanted=changed.quantity+(target.matches(".wl-qty-increase")?1:-1);
        if (wanted>0 && queueCartMutation("quantity",changed,wanted,cartRow(target))) pushEvent("cart_quantity_change_start",{previous_quantity:changed.quantity,quantity:wanted});
      }
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
      rememberReview(document);
      var finalSnapshot = readCartSnapshot();
      trackOnce("checkout_submit", "checkout_submit", {
        ecommerce: finalSnapshot ? ecommerce(finalSnapshot.items || [], finalSnapshot.value) : undefined
      });
    }
  }

  function handleChange(event) {
    var target = event.target;
    if (!target) return;
    if (target.matches?.(".wl-qty-select")) {
      var root=cartRow(target),item=itemFromRoot(root,0),native=root?.querySelector("input[data-wl-qty-native='1']"),before=Number(native?.value),wanted=Number(target.value);
      if (item && Number.isFinite(before) && before>0) { item.quantity=before; if (queueCartMutation("quantity",item,wanted,root)) pushEvent("cart_quantity_change_start",{previous_quantity:before,quantity:wanted}); }
    }
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
        emitQueuedAddToCart();
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
    checkout: checkout,
    trackOnce: trackOnce,
    getCartSnapshot: readCartSnapshot,
    refresh: emitInitialPageEvents
  };

  try { initializeGa4(); } catch (_) {}
  try { initializeMeta(); } catch (_) {}

  ready(function () {
    document.addEventListener("click", function (event) { try { handleClick(event); } catch (_) {} }, true);
    document.addEventListener("change", function (event) { try { handleChange(event); } catch (_) {} }, true);
    emitInitialPageEvents();
    window.setTimeout(emitQueuedAddToCart, 700);
    observeDynamicContent();
  });
})(window, document);
