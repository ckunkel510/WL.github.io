/* ==========================================================================
   Woodson tawk.to Commerce Assist
   - Opens one verified WebTrack product after an explicit visitor request.
   - Adds one verified product to the visitor's cart after an explicit request.
   - Never starts checkout, submits an order, or acts on ambiguous/multiple items.
   ========================================================================== */

(function (factory) {
  "use strict";

  var api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    window.WLTawkCommerceAssist = api;
    api.init(window, document);
  }
})(function () {
  "use strict";

  var VERSION = "1.0.0";
  var WEBTRACK_ORIGIN = "https://webtrack.woodsonlumber.com";
  var INTENT_KEY = "wl_tawk_commerce_intent_v1";
  var INTENT_MAX_AGE_MS = 3 * 60 * 1000;
  var ACTION_DEDUP_MS = 30 * 1000;
  var MAX_QUANTITY = 25;
  var lastAction = { key: "", at: 0 };

  function messageText(payload) {
    if (typeof payload === "string") return payload.trim();
    if (!payload || typeof payload !== "object") return "";
    if (typeof payload.message === "string") return payload.message.trim();
    if (typeof payload.msg === "string") return payload.msg.trim();
    if (typeof payload.text === "string") return payload.text.trim();
    return "";
  }

  function detectIntent(value) {
    var text = messageText(value);
    if (!text) return null;

    var normalized = text.replace(/\s+/g, " ").trim();
    var negatedAction = /\b(?:do\s+not|don't|dont|never|not\s+yet)\b.{0,35}\b(?:add|put|buy|purchase|open|show|view|redirect|take)\b/i;
    if (negatedAction.test(normalized)) return null;

    var orderAction =
      /\b(?:(?:checkout|check\s+out|place|submit|complete|finish|finalize|process)\b.{0,35}\b(?:order|purchase)|(?:order|purchase)\b.{0,35}\b(?:checkout|check\s+out|place|submit|complete|finish|finalize|process))\b/i;
    if (
      orderAction.test(normalized) ||
      /\border\s+(?:it|that|this|one|now|\d+)\b/i.test(normalized)
    ) {
      return { action: "view_cart", quantity: 0 };
    }

    var addToCart =
      /\b(?:add|put|place)\b.{0,50}\b(?:cart|basket)\b/i.test(normalized) ||
      /\b(?:cart|basket)\b.{0,35}\b(?:add|put)\b/i.test(normalized) ||
      /\b(?:i\s+(?:want|would\s+like|am\s+ready|wanna)|i'd\s+like|ready)\b.{0,30}\b(?:buy|purchase)\b/i.test(normalized) ||
      /\b(?:can|could|would)\s+you\b.{0,30}\b(?:add|put)\b/i.test(normalized);

    if (addToCart) {
      return {
        action: "add_to_cart",
        quantity: extractQuantity(normalized)
      };
    }

    var viewProduct =
      /\b(?:open|show|view|take|go|navigate|redirect)\b.{0,55}\b(?:product|item|page|it|that|this|one|there)\b/i.test(normalized) ||
      /\b(?:product|item)\b.{0,35}\b(?:open|show|view|page)\b/i.test(normalized);

    if (viewProduct) return { action: "view_product", quantity: 0 };
    return null;
  }

  function extractQuantity(value) {
    var text = String(value || "");
    var numberWords = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10
    };
    var match =
      text.match(/\b(?:quantity|qty)\s*(?:of|is|:|=)?\s*(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\b/i) ||
      text.match(/\b(?:add|put|buy|purchase)\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\b/i) ||
      text.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:of\s+)?(?:these|those|them|items?|products?)\b/i);
    if (!match) return 1;
    var raw = match[1].toLowerCase();
    var quantity = numberWords[raw] || parseInt(raw, 10) || 1;
    return Math.max(1, Math.min(MAX_QUANTITY, quantity));
  }

  function safeProductUrl(value) {
    var raw = String(value || "").replace(/&amp;/gi, "&").trim();
    if (!raw) return null;

    try {
      var parsed = new URL(raw, WEBTRACK_ORIGIN);
      if (parsed.protocol !== "https:" || parsed.hostname.toLowerCase() !== "webtrack.woodsonlumber.com") return null;
      if (parsed.pathname.toLowerCase() !== "/productdetail.aspx") return null;

      var pid = parsed.searchParams.get("pid") || "";
      if (!/^\d{1,12}$/.test(pid)) return null;

      return {
        pid: pid,
        url: WEBTRACK_ORIGIN + "/ProductDetail.aspx?pid=" + encodeURIComponent(pid)
      };
    } catch (error) {
      return null;
    }
  }

  function productLinksFromMessage(value) {
    var text = messageText(value);
    if (!text) return [];

    var candidates = text.match(
      /https?:\/\/[^)\]\s<>"']+\/ProductDetail\.aspx\?[^)\]\s<>"']+/gi
    ) || [];
    var relativePattern = /(?:^|[\s(\["'])(\/ProductDetail\.aspx\?[^)\]\s<>"']+)/gi;
    var relativeMatch;
    while ((relativeMatch = relativePattern.exec(text))) {
      candidates.push(relativeMatch[1]);
    }
    var byPid = Object.create(null);

    candidates.forEach(function (candidate) {
      var product = safeProductUrl(candidate.replace(/[.,;:!?]+$/, ""));
      if (product) byPid[product.pid] = product;
    });

    return Object.keys(byPid).map(function (pid) {
      return byPid[pid];
    });
  }

  function extractPostbackTarget(href) {
    var value = String(href || "");
    var direct = value.match(/__doPostBack\(\s*['"]([^'"]+)['"]/i);
    if (direct && direct[1]) return direct[1];
    var options = value.match(/WebForm_PostBackOptions\(\s*['"]([^'"]+)['"]/i);
    return options && options[1] ? options[1] : "";
  }

  function findAddToCartTarget(doc) {
    var blocked = /saved|later|quicklist|wish|favorite/i;
    var explicitCart = /add\s*(?:to)?\s*(?:cart|basket)|cart|basket|addproductbutton/i;
    var selectors = [
      'a[id*="AddProductButton"]',
      'a[id*="AddToCart"]',
      'a[id*="AddCart"]',
      'button[id*="AddProductButton"]',
      'button[id*="AddToCart"]',
      'input[id*="AddProductButton"]',
      'input[id*="AddToCart"]'
    ];

    for (var i = 0; i < selectors.length; i += 1) {
      var controls = Array.prototype.slice.call(doc.querySelectorAll(selectors[i]));
      for (var j = 0; j < controls.length; j += 1) {
        var control = controls[j];
        var combined = [
          control.textContent || control.value || "",
          control.getAttribute("title") || "",
          control.getAttribute("aria-label") || "",
          control.id || "",
          control.name || "",
          control.getAttribute("href") || ""
        ].join(" ");
        if (blocked.test(combined) || !explicitCart.test(combined)) continue;

        var target = extractPostbackTarget(control.getAttribute("href") || "");
        if (target) return target;
        if (control.name) return control.name;
        if (control.id) return control.id.replace(/_/g, "$");
      }
    }

    return "ctl00$PageBody$productDetail$ctl00$AddProductButton";
  }

  function productNameFromDocument(doc, pid) {
    var candidates = [
      "h1",
      "[data-wl-product-name]",
      ".product-description",
      "#ProductDescriptionRow a",
      "title"
    ];
    for (var i = 0; i < candidates.length; i += 1) {
      var element = doc.querySelector(candidates[i]);
      var text = String((element && element.textContent) || "").replace(/\s+/g, " ").trim();
      if (text) return text.slice(0, 140);
    }
    return "Product " + pid;
  }

  async function addPidToCart(win, pid, quantity) {
    if (!win || win.location.origin !== WEBTRACK_ORIGIN) throw new Error("Cart access is available only on WebTrack.");
    if (!/^\d{1,12}$/.test(String(pid || ""))) throw new Error("A valid product is required.");

    var qty = Math.max(1, Math.min(MAX_QUANTITY, parseInt(quantity, 10) || 1));
    var productPath = "/ProductDetail.aspx?pid=" + encodeURIComponent(pid);
    var productResponse = await win.fetch(productPath, {
      credentials: "include",
      cache: "no-cache"
    });
    if (!productResponse.ok) throw new Error("The product page could not be loaded.");

    var productHtml = await productResponse.text();
    var doc = new win.DOMParser().parseFromString(productHtml, "text/html");
    var fields = {};
    Array.prototype.forEach.call(doc.querySelectorAll('input[type="hidden"]'), function (input) {
      if (input.name) fields[input.name] = input.value || "";
    });

    var quantityInput =
      doc.querySelector('input[name*="Quantity"]') ||
      doc.querySelector('input[name*="Qty"]') ||
      doc.querySelector('input[name*="qty"]');
    if (quantityInput && quantityInput.name) fields[quantityInput.name] = String(qty);

    fields.__EVENTTARGET = findAddToCartTarget(doc);
    fields.__EVENTARGUMENT = "";

    var form = doc.querySelector("form");
    var actionUrl = new URL(form ? form.getAttribute("action") || productPath : productPath, WEBTRACK_ORIGIN);
    if (actionUrl.origin !== WEBTRACK_ORIGIN) throw new Error("The cart action was not recognized.");

    var formData = new win.FormData();
    Object.keys(fields).forEach(function (key) {
      formData.append(key, fields[key]);
    });

    var cartResponse = await win.fetch(actionUrl.toString(), {
      method: "POST",
      credentials: "include",
      cache: "no-cache",
      body: formData
    });
    if (!cartResponse.ok) throw new Error("The item could not be added to the cart.");

    return {
      pid: String(pid),
      quantity: qty,
      productName: productNameFromDocument(doc, pid)
    };
  }

  function safeStorage(win, method, value) {
    try {
      if (method === "get") return win.sessionStorage.getItem(INTENT_KEY);
      if (method === "remove") return win.sessionStorage.removeItem(INTENT_KEY);
      return win.sessionStorage.setItem(INTENT_KEY, value);
    } catch (error) {
      return null;
    }
  }

  function storeIntent(win, intent) {
    if (!intent) return;
    safeStorage(win, "set", JSON.stringify({
      action: intent.action,
      quantity: intent.quantity || 0,
      createdAt: Date.now()
    }));
  }

  function takeFreshIntent(win) {
    var raw = safeStorage(win, "get");
    if (!raw) return null;
    safeStorage(win, "remove");

    try {
      var intent = JSON.parse(raw);
      if (!intent || !intent.createdAt || Date.now() - intent.createdAt > INTENT_MAX_AGE_MS) return null;
      return intent;
    } catch (error) {
      return null;
    }
  }

  function showNotice(doc, options) {
    if (!doc || !doc.body) return;
    var existing = doc.getElementById("wl-tawk-commerce-notice");
    if (existing) existing.remove();

    var notice = doc.createElement("aside");
    notice.id = "wl-tawk-commerce-notice";
    notice.setAttribute("role", options.error ? "alert" : "status");
    notice.setAttribute("aria-live", options.error ? "assertive" : "polite");
    notice.style.cssText = [
      "position:fixed",
      "left:16px",
      "bottom:16px",
      "z-index:2147483000",
      "max-width:min(380px,calc(100vw - 32px))",
      "padding:14px 16px",
      "border-radius:12px",
      "background:" + (options.error ? "#fff4f4" : "#ffffff"),
      "border:1px solid " + (options.error ? "#b42318" : "#d7c2c7"),
      "box-shadow:0 10px 30px rgba(0,0,0,.18)",
      "color:#231f20",
      "font:600 14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif"
    ].join(";");

    var message = doc.createElement("div");
    message.textContent = options.message;
    notice.appendChild(message);

    if (options.cartLink) {
      var link = doc.createElement("a");
      link.href = "/ShoppingCart.aspx";
      link.textContent = "View cart";
      link.style.cssText = "display:inline-block;margin-top:8px;color:#6b0016;font-weight:800;text-decoration:underline;";
      notice.appendChild(link);
    }

    doc.body.appendChild(notice);
    if (!options.persistent) {
      window.setTimeout(function () {
        if (notice.parentNode) notice.parentNode.removeChild(notice);
      }, options.error ? 9000 : 7000);
    }
  }

  function chainCallback(api, name, handler) {
    var previous = typeof api[name] === "function" ? api[name] : null;
    api[name] = function (payload) {
      if (previous) {
        try {
          previous.apply(this, arguments);
        } catch (error) {}
      }
      handler(payload);
    };
  }

  function init(win, doc) {
    if (!win || !doc || win.__WL_TAWK_COMMERCE_ASSIST_BOOTED__) return false;
    if (win.location.origin !== WEBTRACK_ORIGIN) return false;
    win.__WL_TAWK_COMMERCE_ASSIST_BOOTED__ = true;

    var tawk = win.Tawk_API = win.Tawk_API || {};

    chainCallback(tawk, "onChatMessageVisitor", function (payload) {
      var intent = detectIntent(payload);
      if (!intent) return;

      if (intent.action === "view_cart") {
        safeStorage(win, "remove");
        showNotice(doc, {
          error: false,
          message: "Taking you to your cart. You will review checkout and submit the order yourself.",
          persistent: true
        });
        if (!/\/ShoppingCart\.aspx$/i.test(win.location.pathname || "")) {
          win.setTimeout(function () {
            win.location.assign("/ShoppingCart.aspx");
          }, 650);
        }
        return;
      }

      storeIntent(win, intent);
    });

    chainCallback(tawk, "onChatMessageAgent", async function (payload) {
      var intent = takeFreshIntent(win);
      if (!intent) return;

      var products = productLinksFromMessage(payload);
      if (products.length !== 1) return;

      var product = products[0];
      var actionKey = intent.action + ":" + product.pid + ":" + (intent.quantity || 0);
      if (lastAction.key === actionKey && Date.now() - lastAction.at < ACTION_DEDUP_MS) return;
      lastAction = { key: actionKey, at: Date.now() };

      if (intent.action === "view_product") {
        showNotice(doc, {
          message: "Opening the product page…",
          persistent: true
        });
        win.setTimeout(function () {
          win.location.assign(product.url);
        }, 650);
        return;
      }

      if (intent.action !== "add_to_cart") return;

      showNotice(doc, {
        message: "Adding the item to your cart…",
        persistent: true
      });

      try {
        var result = await addPidToCart(win, product.pid, intent.quantity);
        showNotice(doc, {
          message: result.quantity + " × " + result.productName + " added to your cart. No order was placed.",
          cartLink: true
        });
        if (win.WLAnalytics && typeof win.WLAnalytics.refresh === "function") {
          win.setTimeout(function () {
            try {
              win.WLAnalytics.refresh();
            } catch (error) {}
          }, 0);
        }
      } catch (error) {
        showNotice(doc, {
          error: true,
          message: "I couldn't add that item automatically. Please use the product link in chat or ask a Woodson team member for help."
        });
      }
    });

    return true;
  }

  return {
    version: VERSION,
    addPidToCart: addPidToCart,
    detectIntent: detectIntent,
    extractPostbackTarget: extractPostbackTarget,
    extractQuantity: extractQuantity,
    messageText: messageText,
    productLinksFromMessage: productLinksFromMessage,
    safeProductUrl: safeProductUrl,
    init: init
  };
});
