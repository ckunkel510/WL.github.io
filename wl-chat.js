/* ==========================================================================
   Woodson Customer Chat Assist
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

  var VERSION = "1.3.1";
  var WEBTRACK_ORIGIN = "https://webtrack.woodsonlumber.com";
  var PRODUCT_SEARCH_API = "https://wl-upsrates.vercel.app/api/ai-product-search";
  var INTENT_KEY = "wl_tawk_commerce_intent_v1";
  var LAST_PRODUCT_KEY = "wl_tawk_last_product_v1";
  var INTENT_MAX_AGE_MS = 3 * 60 * 1000;
  var LAST_PRODUCT_MAX_AGE_MS = 15 * 60 * 1000;
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

  function canUseRememberedProduct(value) {
    var text = messageText(value).toLowerCase();
    if (!text) return false;

    text = text
      .replace(/\b(?:add|put|buy|purchase)\s+(?:\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\b/gi, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    var ignorable = {
      a: true,
      add: true,
      also: true,
      am: true,
      an: true,
      and: true,
      another: true,
      basket: true,
      buy: true,
      can: true,
      cart: true,
      could: true,
      do: true,
      for: true,
      go: true,
      i: true,
      id: true,
      in: true,
      into: true,
      it: true,
      item: true,
      just: true,
      like: true,
      me: true,
      my: true,
      navigate: true,
      need: true,
      now: true,
      of: true,
      on: true,
      one: true,
      open: true,
      page: true,
      place: true,
      please: true,
      product: true,
      purchase: true,
      put: true,
      ready: true,
      redirect: true,
      same: true,
      second: true,
      show: true,
      take: true,
      that: true,
      the: true,
      them: true,
      these: true,
      this: true,
      those: true,
      to: true,
      too: true,
      view: true,
      want: true,
      will: true,
      with: true,
      would: true,
      you: true
    };
    var remaining = text ? text.split(" ").filter(function (token) {
      return !ignorable[token];
    }) : [];
    return remaining.length === 0;
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

  function findAddToCartControl(doc) {
    var blocked = /saved|later|quicklist|wish|favorite/i;
    var explicitCart = /add\s*(?:to)?\s*(?:cart|basket)|cart|basket|addproductbutton/i;
    var selectors = [
      'a[id*="AddProductButton"]',
      'a[id*="AddToCart"]',
      'a[id*="AddCart"]',
      'a[href*="AddProductButton"]',
      'a[href*="AddToCart"]',
      'a[href*="AddCart"]',
      'button[id*="AddProductButton"]',
      'button[id*="AddToCart"]',
      'button[name*="AddProductButton"]',
      'button[name*="AddToCart"]',
      'input[id*="AddProductButton"]',
      'input[id*="AddToCart"]',
      'input[name*="AddProductButton"]',
      'input[name*="AddToCart"]'
    ];

    for (var i = 0; i < selectors.length; i += 1) {
      var controls = Array.prototype.slice.call(doc.querySelectorAll(selectors[i]));
      for (var j = 0; j < controls.length; j += 1) {
        var control = controls[j];
        if (control.disabled || String(control.getAttribute("aria-disabled") || "").toLowerCase() === "true") {
          continue;
        }
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
        if (target) {
          return {
            target: target,
            buttonName: "",
            buttonValue: ""
          };
        }
        if (control.name) {
          return {
            target: "",
            buttonName: control.name,
            buttonValue: control.value || control.textContent || "Add to Cart"
          };
        }
        if (control.id) {
          return {
            target: control.id.replace(/_/g, "$"),
            buttonName: "",
            buttonValue: ""
          };
        }
      }
    }

    return null;
  }

  function findAddToCartTarget(doc) {
    var control = findAddToCartControl(doc);
    return control ? control.target || control.buttonName : "";
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
      if (text && !/^products?\s*\|\s*woodson lumber$/i.test(text)) return text.slice(0, 140);
    }
    return "Product " + pid;
  }

  function cartStateFromDocument(doc, pid) {
    var expectedPid = String(pid || "");
    var links = Array.prototype.slice.call(
      doc.querySelectorAll('a[href*="ProductDetail.aspx"],a[href*="productdetail.aspx"]')
    );
    var matchingLink = null;

    for (var i = 0; i < links.length; i += 1) {
      var product = safeProductUrl(links[i].getAttribute("href") || "");
      if (product && product.pid === expectedPid) {
        matchingLink = links[i];
        break;
      }
    }

    if (!matchingLink) return { present: false, quantity: 0 };

    var quantity = null;
    var node = matchingLink;
    var quantitySelector = [
      'select[name*="Quantity"]',
      'select[id*="Quantity"]',
      'input[name*="Quantity"]',
      'input[id*="Quantity"]',
      'select[name*="Qty"]',
      'select[id*="Qty"]',
      'input[name*="Qty"]',
      'input[id*="Qty"]'
    ].join(",");

    for (var depth = 0; node && depth < 9; depth += 1) {
      if (typeof node.querySelector === "function") {
        var quantityControl = node.querySelector(quantitySelector);
        if (quantityControl) {
          var parsed = parseInt(quantityControl.value, 10);
          if (Number.isFinite(parsed) && parsed >= 0) {
            quantity = parsed;
            break;
          }
        }
      }
      node = node.parentElement;
    }

    return { present: true, quantity: quantity };
  }

  async function readCartState(win, pid) {
    var response = await win.fetch("/ShoppingCart.aspx", {
      credentials: "include",
      cache: "no-store"
    });
    if (!response.ok) throw new Error("The cart could not be verified.");
    var html = await response.text();
    var doc = new win.DOMParser().parseFromString(html, "text/html");
    return cartStateFromDocument(doc, pid);
  }

  function productFormPostData(win, doc, pid, quantity) {
    var form = doc.querySelector("form");
    if (!form) throw new Error("The WebTrack product form could not be found.");

    var data = new win.URLSearchParams();
    Array.prototype.forEach.call(form.elements || [], function (element) {
      if (!element.name || element.disabled) return;
      var type = String(element.type || "").toLowerCase();
      if (["button", "submit", "image", "reset", "file"].indexOf(type) !== -1) return;
      if ((type === "checkbox" || type === "radio") && !element.checked) return;
      data.append(element.name, element.value || "");
    });

    var escapedPid = String(pid).replace(/[^0-9]/g, "");
    var quantitySelectors = [
      'input[name="ctl00$PageBody$productDetail$ctl00$qty_' + escapedPid + '"]',
      'input[id="ctl00_PageBody_productDetail_ctl00_qty_' + escapedPid + '"]',
      'input[name*="qty_' + escapedPid + '"]',
      'input[id*="qty_' + escapedPid + '"]',
      'input[name*="Quantity"]',
      'input[name*="Qty"]',
      'input[name*="qty"]'
    ];
    var quantityInput = null;
    for (var i = 0; i < quantitySelectors.length && !quantityInput; i += 1) {
      quantityInput = doc.querySelector(quantitySelectors[i]);
    }
    if (quantityInput && quantityInput.name) {
      data.set(quantityInput.name, String(quantity));
    } else {
      data.set("ctl00$PageBody$productDetail$ctl00$qty_" + escapedPid, String(quantity));
    }

    return { form: form, data: data };
  }

  async function addPidToCart(win, pid, quantity) {
    if (!win || win.location.origin !== WEBTRACK_ORIGIN) throw new Error("Cart access is available only on WebTrack.");
    if (!/^\d{1,12}$/.test(String(pid || ""))) throw new Error("A valid product is required.");

    var qty = Math.max(1, Math.min(MAX_QUANTITY, parseInt(quantity, 10) || 1));
    var before = await readCartState(win, pid);
    var productPath = "/ProductDetail.aspx?pid=" + encodeURIComponent(pid);
    var productResponse = await win.fetch(productPath, {
      credentials: "include",
      cache: "no-cache"
    });
    if (!productResponse.ok) throw new Error("The product page could not be loaded.");

    var productHtml = await productResponse.text();
    var doc = new win.DOMParser().parseFromString(productHtml, "text/html");
    var formBits = productFormPostData(win, doc, pid, qty);
    var formData = formBits.data;

    var addControl = findAddToCartControl(doc);
    if (!addControl) throw new Error("This product does not expose a direct add-to-cart control.");

    formData.set("__EVENTTARGET", addControl.target || "");
    formData.set("__EVENTARGUMENT", "");
    if (addControl.buttonName) {
      formData.set(addControl.buttonName, addControl.buttonValue);
    }

    var actionUrl = new URL(formBits.form.getAttribute("action") || productPath, WEBTRACK_ORIGIN);
    if (actionUrl.origin !== WEBTRACK_ORIGIN) throw new Error("The cart action was not recognized.");

    var cartResponse = await win.fetch(actionUrl.toString(), {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
      },
      body: formData.toString()
    });
    if (!cartResponse.ok) throw new Error("The item could not be added to the cart.");

    var after = await readCartState(win, pid);
    if (!after.present) throw new Error("WebTrack did not confirm the product in the cart.");

    var expectedQuantity = before.present && before.quantity !== null
      ? before.quantity + qty
      : qty;
    var quantityMustBeVerified = qty > 1 || before.present;
    if (
      quantityMustBeVerified &&
      (after.quantity === null || after.quantity < expectedQuantity)
    ) {
      throw new Error("WebTrack did not confirm the requested cart quantity.");
    }

    return {
      pid: String(pid),
      quantity: qty,
      productName: productNameFromDocument(doc, pid),
      cartQuantity: after.quantity
    };
  }

  function safeStorage(win, key, method, value) {
    try {
      if (method === "get") return win.sessionStorage.getItem(key);
      if (method === "remove") return win.sessionStorage.removeItem(key);
      return win.sessionStorage.setItem(key, value);
    } catch (error) {
      return null;
    }
  }

  function storeIntent(win, intent) {
    if (!intent) return;
    safeStorage(win, INTENT_KEY, "set", JSON.stringify({
      action: intent.action,
      quantity: intent.quantity || 0,
      useRememberedProduct: !!intent.useRememberedProduct,
      createdAt: Date.now()
    }));
  }

  function takeFreshIntent(win) {
    var raw = safeStorage(win, INTENT_KEY, "get");
    if (!raw) return null;
    safeStorage(win, INTENT_KEY, "remove");

    try {
      var intent = JSON.parse(raw);
      if (!intent || !intent.createdAt || Date.now() - intent.createdAt > INTENT_MAX_AGE_MS) return null;
      return intent;
    } catch (error) {
      return null;
    }
  }

  function rememberProduct(win, product) {
    if (!product || !product.pid || !product.url) return;
    safeStorage(win, LAST_PRODUCT_KEY, "set", JSON.stringify({
      pid: product.pid,
      url: product.url,
      createdAt: Date.now()
    }));
  }

  function readFreshProduct(win) {
    var raw = safeStorage(win, LAST_PRODUCT_KEY, "get");
    if (!raw) return null;

    try {
      var stored = JSON.parse(raw);
      if (!stored || !stored.createdAt || Date.now() - stored.createdAt > LAST_PRODUCT_MAX_AGE_MS) {
        safeStorage(win, LAST_PRODUCT_KEY, "remove");
        return null;
      }
      return safeProductUrl(stored.url);
    } catch (error) {
      safeStorage(win, LAST_PRODUCT_KEY, "remove");
      return null;
    }
  }

  function safeImageUrl(value) {
    try {
      var parsed = new URL(String(value || "").trim());
      if (parsed.protocol !== "https:") return "";
      if (parsed.hostname.toLowerCase() !== "images-woodsonlumber.sirv.com") return "";
      return parsed.toString();
    } catch (error) {
      return "";
    }
  }

  function productPreviewFromResponse(payload, product) {
    if (!payload || !Array.isArray(payload.results) || !product) return null;
    for (var i = 0; i < payload.results.length; i += 1) {
      var result = payload.results[i] || {};
      var resultProduct = safeProductUrl(result.productUrl);
      var imageUrl = safeImageUrl(result.imageUrl);
      if (!resultProduct || resultProduct.pid !== product.pid || !imageUrl) continue;
      return {
        pid: product.pid,
        productUrl: product.url,
        imageUrl: imageUrl,
        productCode: String(result.productCode || "").trim().slice(0, 80),
        title: String(result.title || "Woodson Lumber product").trim().slice(0, 180),
        price: String(result.salePrice || result.price || "").trim().slice(0, 30)
      };
    }
    return null;
  }

  function clearProductPreview(doc) {
    var existing = doc && doc.getElementById("wl-tawk-product-preview");
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
  }

  function showProductPreview(doc, preview) {
    if (!doc || !doc.body || !preview) return false;
    clearProductPreview(doc);

    var card = doc.createElement("aside");
    card.id = "wl-tawk-product-preview";
    card.setAttribute("aria-label", "Recommended Woodson Lumber product");
    card.style.cssText = [
      "position:fixed",
      "right:16px",
      "bottom:16px",
      "z-index:2147482999",
      "width:min(310px,calc(100vw - 32px))",
      "padding:12px",
      "border-radius:14px",
      "background:#ffffff",
      "border:1px solid #d7c2c7",
      "box-shadow:0 12px 34px rgba(0,0,0,.22)",
      "color:#231f20",
      "font:600 14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif"
    ].join(";");

    var close = doc.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Close product preview");
    close.textContent = "×";
    close.style.cssText = "position:absolute;right:8px;top:6px;width:30px;height:30px;border:0;background:transparent;color:#6b0016;font-size:24px;line-height:1;cursor:pointer;";
    close.addEventListener("click", function () {
      clearProductPreview(doc);
    });
    card.appendChild(close);

    var eyebrow = doc.createElement("div");
    eyebrow.textContent = "Best product match";
    eyebrow.style.cssText = "margin:0 34px 8px 0;color:#6b0016;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;";
    card.appendChild(eyebrow);

    var imageLink = doc.createElement("a");
    imageLink.href = preview.productUrl;
    imageLink.setAttribute("aria-label", "View " + preview.title);
    imageLink.style.cssText = "display:block;border-radius:10px;overflow:hidden;background:#f7f5f5;text-align:center;";

    var image = doc.createElement("img");
    image.src = preview.imageUrl;
    image.alt = preview.title;
    image.loading = "lazy";
    image.style.cssText = "display:block;width:100%;height:150px;object-fit:contain;background:#ffffff;";
    image.addEventListener("error", function () {
      clearProductPreview(doc);
    });
    imageLink.appendChild(image);
    card.appendChild(imageLink);

    var titleLink = doc.createElement("a");
    titleLink.href = preview.productUrl;
    titleLink.textContent = preview.title;
    titleLink.style.cssText = "display:block;margin-top:10px;color:#231f20;font-size:15px;font-weight:800;text-decoration:none;";
    card.appendChild(titleLink);

    if (preview.productCode || preview.price) {
      var meta = doc.createElement("div");
      meta.textContent = [preview.productCode, preview.price].filter(Boolean).join(" · ");
      meta.style.cssText = "margin-top:4px;color:#5f5557;font-size:13px;font-weight:650;";
      card.appendChild(meta);
    }

    var viewLink = doc.createElement("a");
    viewLink.href = preview.productUrl;
    viewLink.textContent = "View product";
    viewLink.style.cssText = "display:inline-block;margin-top:10px;color:#6b0016;font-weight:850;text-decoration:underline;";
    card.appendChild(viewLink);

    doc.body.appendChild(card);
    return true;
  }

  async function loadProductPreview(win, doc, product) {
    if (!win || !doc || !product || typeof win.fetch !== "function") return false;
    try {
      var response = await win.fetch(PRODUCT_SEARCH_API, {
        method: "POST",
        cache: "no-store",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: product.pid })
      });
      if (!response.ok) return false;
      var payload = await response.json();
      var preview = productPreviewFromResponse(payload, product);
      return preview ? showProductPreview(doc, preview) : false;
    } catch (error) {
      return false;
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

    if (options.productLink) {
      var product = safeProductUrl(options.productLink);
      if (product) {
        var productLink = doc.createElement("a");
        productLink.href = product.url;
        productLink.textContent = "Open product";
        productLink.style.cssText = "display:inline-block;margin-top:8px;color:#6b0016;font-weight:800;text-decoration:underline;";
        notice.appendChild(productLink);
      }
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

  async function performProductAction(win, doc, intent, product) {
    if (!intent || !product) return false;

    var actionKey = intent.action + ":" + product.pid + ":" + (intent.quantity || 0);
    if (lastAction.key === actionKey && Date.now() - lastAction.at < ACTION_DEDUP_MS) return false;
    lastAction = { key: actionKey, at: Date.now() };

    if (intent.action === "view_product") {
      showNotice(doc, {
        message: "Opening the product page…",
        persistent: true
      });
      win.setTimeout(function () {
        win.location.assign(product.url);
      }, 650);
      return true;
    }

    if (intent.action !== "add_to_cart") return false;

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
      return true;
    } catch (error) {
      showNotice(doc, {
        error: true,
        message: "WebTrack did not confirm that item in your cart. Please open the product and add it manually, or ask a Woodson team member for help. No order was placed.",
        productLink: product.url
      });
      return false;
    }
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
        safeStorage(win, INTENT_KEY, "remove");
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

      var recentProduct = readFreshProduct(win);
      var useRememberedProduct = canUseRememberedProduct(payload);
      if (recentProduct && useRememberedProduct) {
        safeStorage(win, INTENT_KEY, "remove");
        performProductAction(win, doc, intent, recentProduct);
        return;
      }

      if (!useRememberedProduct) clearProductPreview(doc);
      intent.useRememberedProduct = useRememberedProduct;
      storeIntent(win, intent);
    });

    chainCallback(tawk, "onChatMessageAgent", async function (payload) {
      var products = productLinksFromMessage(payload);
      if (products.length === 1) {
        rememberProduct(win, products[0]);
        loadProductPreview(win, doc, products[0]);
      } else if (products.length > 1) {
        clearProductPreview(doc);
      }

      var intent = takeFreshIntent(win);
      if (!intent) return;

      var product = products.length === 1
        ? products[0]
        : intent.useRememberedProduct
          ? readFreshProduct(win)
          : null;
      if (!product) return;
      await performProductAction(win, doc, intent, product);
    });

    return true;
  }

  return {
    version: VERSION,
    addPidToCart: addPidToCart,
    canUseRememberedProduct: canUseRememberedProduct,
    cartStateFromDocument: cartStateFromDocument,
    clearProductPreview: clearProductPreview,
    detectIntent: detectIntent,
    extractPostbackTarget: extractPostbackTarget,
    extractQuantity: extractQuantity,
    findAddToCartControl: findAddToCartControl,
    findAddToCartTarget: findAddToCartTarget,
    messageText: messageText,
    performProductAction: performProductAction,
    productFormPostData: productFormPostData,
    productPreviewFromResponse: productPreviewFromResponse,
    productLinksFromMessage: productLinksFromMessage,
    readFreshProduct: readFreshProduct,
    rememberProduct: rememberProduct,
    safeImageUrl: safeImageUrl,
    safeProductUrl: safeProductUrl,
    showProductPreview: showProductPreview,
    init: init
  };
});
