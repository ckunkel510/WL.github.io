(function () {
  "use strict";

  var BUILD_VERSION = "20260917-custom-cuts-2";
  var RATE_URL = "https://wl-upsrates.vercel.app/api/fulfillment-quote";
  var CUT_POLICY_URL = "https://ckunkel510.github.io/WL.github.io/data/cut-to-ship-products.json?v=20260917-2";
  var STORAGE_KEY = "wl_shipping_offer_v1";
  var CART_DATA_KEY = "wl_shipping_offer_cart_v1";
  var CUT_SELECTION_KEY = "wl_cut_to_ship_v1";
  var SELECTION_SOURCE_KEY = "wl_fulfillment_selection_source_v1";
  var EVENT_NAME = "wl:shipping-offer-change";
  var refreshTimer = null;
  var activeRequest = null;
  var activeSelectionRequest = null;
  var refreshQueued = false;
  var missingContextRetries = 0;
  var MISSING_CONTEXT_MAX_RETRIES = 10;
  var cutPolicyPromise = null;

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
  var US_STATE_CODES_BY_NAME = {
    alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
    connecticut: "CT", delaware: "DE", districtofcolumbia: "DC", florida: "FL", georgia: "GA",
    hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
    kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA",
    michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT",
    nebraska: "NE", nevada: "NV", newhampshire: "NH", newjersey: "NJ", newmexico: "NM",
    newyork: "NY", northcarolina: "NC", northdakota: "ND", ohio: "OH", oklahoma: "OK",
    oregon: "OR", pennsylvania: "PA", rhodeisland: "RI", southcarolina: "SC", southdakota: "SD",
    tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
    westvirginia: "WV", wisconsin: "WI", wyoming: "WY"
  };
  var US_STATE_CODES = {};
  Object.keys(US_STATE_CODES_BY_NAME).forEach(function (name) {
    US_STATE_CODES[US_STATE_CODES_BY_NAME[name]] = true;
  });

  function text(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function normalizeCode(value) {
    return text(value).replace(/\s+/g, "").toUpperCase();
  }

  function itemKey(item) {
    var id = text(item && item.productId);
    return id ? "id:" + id : "code:" + normalizeCode(item && item.productCode);
  }

  function readCutSelections() {
    try {
      var stored = JSON.parse(sessionStorage.getItem(CUT_SELECTION_KEY) || "{}");
      return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
    } catch (error) {
      return {};
    }
  }

  function cutSelection(item) {
    var selected = readCutSelections()[itemKey(item)];
    if (!selected || typeof selected !== "object" || Array.isArray(selected)) return null;
    return selected;
  }

  function cutSelectionSignature(selection) {
    if (!selection || typeof selection !== "object") return "";
    return [
      text(selection.optionId),
      Array.isArray(selection.cutLengthsIn) ? selection.cutLengthsIn.join(",") : "",
      selection.acknowledgedNonRefundable === true ? "accepted" : ""
    ].join(":");
  }

  function writeCutSelection(item, rule, cutLengthsIn) {
    var selections = readCutSelections();
    var key = itemKey(item);
    if (rule) {
      selections[key] = {
        optionId: text(rule.optionId),
        productId: text(rule.productId || item.productId),
        productCode: normalizeCode(rule.productCode || item.productCode),
        label: text(rule.label),
        stockLengthIn: Math.max(0, Number(rule.stockLengthIn) || 0),
        cutLengthsIn: cutLengthsIn.slice(0, Math.max(2, Number(rule.maximumPiecesPerUnit) || 48)),
        cutAndPackagingFeePerUnit: Math.max(0, Number(rule.cutAndPackagingFeePerUnit) || 0),
        acknowledgedNonRefundable: true,
        specialOrder: true,
        nonRefundable: true
      };
    }
    else delete selections[key];
    try { sessionStorage.setItem(CUT_SELECTION_KEY, JSON.stringify(selections)); } catch (error) {}
  }

  function loadCutPolicy() {
    if (cutPolicyPromise) return cutPolicyPromise;
    cutPolicyPromise = fetch(CUT_POLICY_URL, { cache: "no-store" })
      .then(function (response) { return response.ok ? response.json() : { products: [] }; })
      .then(function (policy) { return policy && Array.isArray(policy.products) ? policy : { products: [] }; })
      .catch(function () { return { products: [] }; });
    return cutPolicyPromise;
  }

  function cutRule(item, policy) {
    var id = text(item && item.productId);
    var code = normalizeCode(item && item.productCode);
    return (policy && policy.products || []).find(function (rule) {
      return (id && text(rule.productId) === id) || (code && normalizeCode(rule.productCode) === code);
    }) || null;
  }

  function normalizeUsState(value) {
    var raw = text(value);
    if (!raw) return "";
    var upper = raw.toUpperCase();
    if (US_STATE_CODES[upper]) return upper;
    var tokens = upper.split(/[^A-Z]+/).filter(Boolean);
    var suppliedCode = tokens.find(function (token) { return US_STATE_CODES[token]; });
    if (suppliedCode) return suppliedCode;
    var compact = raw.toLowerCase().replace(/[^a-z]/g, "");
    if (US_STATE_CODES_BY_NAME[compact]) return US_STATE_CODES_BY_NAME[compact];
    var embeddedName = Object.keys(US_STATE_CODES_BY_NAME).find(function (name) {
      return compact.indexOf(name) !== -1;
    });
    return embeddedName ? US_STATE_CODES_BY_NAME[embeddedName] : "";
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
        quantity: Math.max(1, Number(select && select.value || input && input.value || locked && locked.textContent || 1) || 1),
        cutToShip: cutSelection({ productId: productId(row), productCode: productCode(row) })
      };
    });
    if (items.length) return items;
    var stored = storedCartData();
    return stored && stored.items ? stored.items.map(function (item) {
      return Object.assign({}, item, { cutToShip: cutSelection(item) });
    }) : [];
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
      state: normalizeUsState(stateText) || stateText,
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
        return [item.productId, item.productCode, item.quantity, cutSelectionSignature(item.cutToShip)].join(":");
      }).sort().join("|"),
      shippingOffer: result && result.shippingOffer || null,
      packagePlan: result && result.packagePlan || null,
      recommendation: result && result.recommendation || null,
      options: result && result.options || null,
      cutToShip: result && result.cutToShip || null,
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

  function injectCutStyles() {
    if (document.getElementById("wl-cut-to-ship-css")) return;
    var style = document.createElement("style");
    style.id = "wl-cut-to-ship-css";
    style.textContent = [
      ".wl-cut-to-ship{margin:12px 0 4px;padding:12px 14px;border:1px solid #d4bd77;border-radius:8px;background:#fffaf0;color:#25282c;font-size:13px;line-height:1.4;}",
      ".wl-cut-to-ship label{display:flex;align-items:flex-start;gap:10px;margin:0;cursor:pointer;font-weight:700;}",
      ".wl-cut-to-ship input{margin-top:3px;flex:0 0 auto;}",
      ".wl-cut-to-ship-detail{display:block;margin:5px 0 0 26px;color:#5f6368;font-weight:400;}",
      ".wl-cut-to-ship-fields{display:none;margin:12px 0 0 26px;padding-top:10px;border-top:1px solid #eadcae;}",
      ".wl-cut-to-ship-fields.is-open{display:block;}",
      ".wl-cut-to-ship-fields label{display:block;margin:0 0 5px;font-weight:700;cursor:default;}",
      ".wl-cut-lengths{display:block;box-sizing:border-box;width:100%;max-width:560px;margin:0 0 6px;padding:9px 10px;border:1px solid #8b9299;border-radius:4px;font:inherit;}",
      ".wl-cut-to-ship-help{display:block;color:#5f6368;font-weight:400;}",
      ".wl-cut-to-ship-terms{display:flex!important;align-items:flex-start!important;gap:8px!important;margin:10px 0 0!important;color:#6b0016;font-weight:700!important;cursor:pointer!important;}",
      ".wl-cut-to-ship-status{display:block;margin:6px 0 0 26px;color:#6b0016;font-weight:700;}",
      ".modern-shipping-selector + .wl-cut-to-ship-list,.wl-outstate-shipping-note + .wl-cut-to-ship-list{margin-top:10px;}",
      "@media(max-width:700px){.wl-cut-to-ship{padding:11px 12px;}}"
    ].join("");
    document.head.appendChild(style);
  }

  function parseCutLengths(value, maximumPieces) {
    var tokens = String(value || "").split(/[,;]+/).map(function (token) { return text(token); }).filter(Boolean);
    var lengths = [];
    var limit = Math.max(2, Number(maximumPieces) || 48);
    if (!tokens.length) return { lengths: [], error: "Enter the finished lengths in inches." };
    for (var index = 0; index < tokens.length; index += 1) {
      var token = tokens[index];
      var repeated = token.match(/^(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)$/i);
      var count = repeated ? Number(repeated[1]) : 1;
      var length = Number(repeated ? repeated[2] : token);
      if (!Number.isFinite(length) || length <= 0 || !Number.isInteger(count) || count <= 0) {
        return { lengths: [], error: "Use inches separated by commas, such as 48, 48, 24, 24—or use 12 x 12." };
      }
      if (lengths.length + count > limit) {
        return { lengths: [], error: "No more than " + limit + " pieces may be requested per stock length." };
      }
      while (count > 0) {
        lengths.push(Math.round(length * 1000) / 1000);
        count -= 1;
      }
    }
    return { lengths: lengths, error: "" };
  }

  function validateCutLengths(value, rule) {
    var parsed = parseCutLengths(value, rule.maximumPiecesPerUnit);
    if (parsed.error) return parsed;
    var minimum = Math.max(0, Number(rule.minimumPieceLengthIn) || 1);
    var stock = Math.max(0, Number(rule.stockLengthIn) || 0);
    if (parsed.lengths.length < 2) return { lengths: [], error: "Enter at least two finished pieces." };
    if (parsed.lengths.some(function (length) { return length < minimum || length > stock; })) {
      return { lengths: [], error: "Each finished piece must be between " + minimum + " and " + stock + " inches." };
    }
    var total = Math.round(parsed.lengths.reduce(function (sum, length) { return sum + length; }, 0) * 1000) / 1000;
    if (Math.abs(total - stock) > 0.01) {
      return { lengths: parsed.lengths, error: "The lengths currently total " + total + " inches; they must total " + stock + " inches." };
    }
    return { lengths: parsed.lengths, total: total, error: "" };
  }

  function cutPatternLabel(lengths) {
    var counts = {};
    (lengths || []).forEach(function (length) { counts[length] = (counts[length] || 0) + 1; });
    return Object.keys(counts).map(function (length) { return counts[length] + " × " + length + " in."; }).join(", ");
  }

  function buildCutControl(item, rule, suffix) {
    var panel = document.createElement("div");
    panel.className = "wl-cut-to-ship";
    panel.setAttribute("data-product-id", text(rule.productId));
    var existingSelection = cutSelection(item);
    var selected = existingSelection && text(existingSelection.optionId) === text(rule.optionId);
    var label = document.createElement("label");
    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "wl-cut-to-ship-" + text(rule.productId) + "-" + suffix;
    checkbox.checked = !!selected;
    checkbox.setAttribute("data-option-id", text(rule.optionId));
    var title = document.createElement("span");
    title.textContent = text(rule.label) + " (+$" + Number(rule.cutAndPackagingFeePerUnit || 0).toFixed(2) + " per original length)";
    label.appendChild(checkbox);
    label.appendChild(title);
    var detail = document.createElement("span");
    detail.className = "wl-cut-to-ship-detail";
    detail.textContent = text(rule.customerNote) + " The added charge appears in Shipping & Packaging.";
    var fields = document.createElement("div");
    fields.className = "wl-cut-to-ship-fields" + (selected ? " is-open" : "");
    var inputLabel = document.createElement("label");
    inputLabel.setAttribute("for", checkbox.id + "-lengths");
    inputLabel.textContent = "Finished lengths in inches for each " + Number(rule.stockLengthIn || 0) + "-inch piece";
    var lengthsInput = document.createElement("input");
    lengthsInput.type = "text";
    lengthsInput.id = checkbox.id + "-lengths";
    lengthsInput.className = "wl-cut-lengths";
    lengthsInput.placeholder = "Example: 48, 48, 24, 24";
    lengthsInput.value = selected && Array.isArray(existingSelection.cutLengthsIn)
      ? existingSelection.cutLengthsIn.join(", ")
      : "";
    lengthsInput.disabled = !selected;
    lengthsInput.setAttribute("inputmode", "decimal");
    var help = document.createElement("span");
    help.className = "wl-cut-to-ship-help";
    help.textContent = "Separate lengths with commas. Repeats may be entered as 12 x 12. The same cut pattern applies to every quantity purchased.";
    var termsLabel = document.createElement("label");
    termsLabel.className = "wl-cut-to-ship-terms";
    var terms = document.createElement("input");
    terms.type = "checkbox";
    terms.checked = !!(selected && existingSelection.acknowledgedNonRefundable === true);
    terms.disabled = !selected;
    var termsText = document.createElement("span");
    termsText.textContent = "I understand this customized item is a special order and the merchandise and cut/packaging fee are non-refundable.";
    termsLabel.appendChild(terms);
    termsLabel.appendChild(termsText);
    fields.appendChild(inputLabel);
    fields.appendChild(lengthsInput);
    fields.appendChild(help);
    fields.appendChild(termsLabel);
    var status = document.createElement("span");
    status.className = "wl-cut-to-ship-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    panel.appendChild(label);
    panel.appendChild(detail);
    panel.appendChild(fields);
    panel.appendChild(status);

    function invalidateAndRefresh(message) {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem("wl_shipping_selection_v1");
        localStorage.removeItem("wl_shipping_quote_v1");
      } catch (error) {}
      var items = cartItems();
      rememberCart(items, selectedOrigin());
      status.textContent = message;
      try {
        document.dispatchEvent(new CustomEvent("wl:cut-to-ship-change", {
          detail: { productId: text(rule.productId), optionId: cutSelection(item) ? text(rule.optionId) : "" }
        }));
      } catch (error) {}
      scheduleRefresh(50);
    }

    function commitSelection() {
      var previousSignature = cutSelectionSignature(cutSelection(item));
      fields.classList.toggle("is-open", checkbox.checked);
      lengthsInput.disabled = !checkbox.checked;
      terms.disabled = !checkbox.checked;
      if (!checkbox.checked) {
        writeCutSelection(item, null, []);
        if (previousSignature) invalidateAndRefresh("Custom cut request removed. Recalculating fulfillment choices…");
        else status.textContent = "";
        return;
      }
      var validation = validateCutLengths(lengthsInput.value, rule);
      if (validation.error) {
        writeCutSelection(item, null, []);
        status.textContent = validation.error;
        if (previousSignature) invalidateAndRefresh(validation.error + " UPS will be recalculated after the request is complete.");
        return;
      }
      if (!terms.checked) {
        writeCutSelection(item, null, []);
        status.textContent = "Accept the non-refundable special-order terms to apply this request.";
        if (previousSignature) invalidateAndRefresh(status.textContent);
        return;
      }
      writeCutSelection(item, rule, validation.lengths);
      var nextSignature = cutSelectionSignature(cutSelection(item));
      var savedMessage = "Custom cuts saved: " + cutPatternLabel(validation.lengths) + " Recalculating UPS shipping…";
      if (nextSignature !== previousSignature) invalidateAndRefresh(savedMessage);
      else status.textContent = "Custom cuts saved: " + cutPatternLabel(validation.lengths);
    }

    var inputTimer = null;
    checkbox.addEventListener("change", function () {
      commitSelection();
      if (checkbox.checked && !lengthsInput.value) lengthsInput.focus();
    });
    lengthsInput.addEventListener("input", function () {
      clearTimeout(inputTimer);
      inputTimer = setTimeout(commitSelection, 350);
    });
    lengthsInput.addEventListener("change", commitSelection);
    terms.addEventListener("change", commitSelection);
    return panel;
  }

  function renderCutControls() {
    return loadCutPolicy().then(function (policy) {
      injectCutStyles();
      var rows = cartRows();
      if (rows.length) {
        rows.forEach(function (row, index) {
          var item = { productId: productId(row), productCode: productCode(row) };
          var rule = cutRule(item, policy);
          var existing = row.querySelector(".wl-cut-to-ship");
          if (!rule) {
            if (existing) existing.remove();
            return;
          }
          if (!existing) row.appendChild(buildCutControl(item, rule, "cart-" + index));
        });
        return;
      }

      var selector = document.querySelector(".modern-shipping-selector");
      if (!selector || document.querySelector(".wl-cut-to-ship-list")) return;
      var eligible = cartItems().map(function (item) {
        return { item: item, rule: cutRule(item, policy) };
      }).filter(function (entry) { return entry.rule; });
      if (!eligible.length) return;
      var list = document.createElement("div");
      list.className = "wl-cut-to-ship-list";
      eligible.forEach(function (entry, index) {
        list.appendChild(buildCutControl(entry.item, entry.rule, "checkout-" + index));
      });
      selector.insertAdjacentElement("afterend", list);
    });
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
    select: selectOffer,
    renderCutControls: renderCutControls
  };

  document.addEventListener("input", function (event) {
    if (event.target && /(?:DeliveryAddress|Postcode|PostalCode|ZipCode|gc_del_zip)/i.test(event.target.id || "")) scheduleRefresh(450);
  }, true);
  document.addEventListener("change", function (event) {
    if (event.target && /(?:DeliveryAddress|Postcode|PostalCode|ZipCode|gc_del_zip|wl-qty-select)/i.test(event.target.id || event.target.className || "")) scheduleRefresh(100);
  }, true);

  function boot() {
    renderCutControls();
    scheduleRefresh(150);
    setTimeout(refreshOffer, 1200);
    setTimeout(renderCutControls, 500);
    setTimeout(renderCutControls, 1400);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  try {
    var manager = window.Sys && window.Sys.WebForms && window.Sys.WebForms.PageRequestManager
      ? window.Sys.WebForms.PageRequestManager.getInstance()
      : null;
    if (manager && !manager.__wlShippingOfferHooked) {
      manager.__wlShippingOfferHooked = true;
      manager.add_endRequest(function () {
        renderCutControls();
        scheduleRefresh(150);
      });
    }
  } catch (error) {}
})();
