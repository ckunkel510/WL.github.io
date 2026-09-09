(function (window, document) {
  "use strict";

  if (window.WLSmartSearch) return;

  var BUILD = "20260909-2";
  var API_URL = "https://wl-upsrates.vercel.app/api/smart-search-suggestions?v=" + BUILD;
  var RESULTS_PANEL_ID = "ctl00_PageBody_ProductGroupStandardPanel";
  var ATTRIBUTION_KEY = "wl_product_discovery_attribution_v1";
  var MAX_WAIT_MS = 4000;
  var analyticsQueue = [];
  var analyticsTimer = 0;
  var analyticsAttempts = 0;
  var enhancementStarted = false;
  var viewTracked = Object.create(null);

  function ready(callback) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", callback, { once: true });
    else callback();
  }

  function cleanText(value, limit) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, limit || 200);
  }

  function searchTerm() {
    var term = cleanText(new URLSearchParams(window.location.search || "").get("searchText"), 160);
    if (term.length < 2) return "";
    if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(term)) return "";
    if (/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/.test(term)) return "";
    return term;
  }

  function isVisible(element) {
    if (!element) return false;
    var rect = element.getBoundingClientRect();
    var style = window.getComputedStyle ? window.getComputedStyle(element) : null;
    return rect.width > 0 && rect.height > 0 && (!style || (style.display !== "none" && style.visibility !== "hidden"));
  }

  function productIdFromLink(link) {
    try { return new URL(link.href, window.location.href).searchParams.get("pid") || ""; }
    catch (error) { return ""; }
  }

  function nativeSearchState(panel) {
    var links = Array.prototype.slice.call(panel.querySelectorAll("#productlistcards a[href*='ProductDetail.aspx']"));
    var seen = Object.create(null);
    var productIds = [];
    links.forEach(function (link) {
      if (!isVisible(link)) return;
      var productId = productIdFromLink(link);
      if (!/^\d{1,20}$/.test(productId) || seen[productId]) return;
      seen[productId] = true;
      productIds.push(productId);
    });

    var total = productIds.length;
    var resultText = "";
    Array.prototype.slice.call(panel.querySelectorAll(".paging-control")).some(function (element) {
      var candidate = cleanText(element.textContent, 300);
      if (!/Results\s+\d/i.test(candidate)) return false;
      resultText = candidate;
      return true;
    });
    var totalMatch = resultText.match(/\(of\s+([\d,]+)\)/i);
    if (totalMatch) total = Number(totalMatch[1].replace(/,/g, "")) || productIds.length;
    return { count: productIds.length, total: total, productIds: productIds };
  }

  function analyticsReady() {
    return !!(window.WLAnalytics && typeof window.WLAnalytics.track === "function");
  }

  function flushAnalytics() {
    if (!analyticsReady()) {
      analyticsAttempts += 1;
      if (analyticsQueue.length && analyticsAttempts < 40) {
        analyticsTimer = window.setTimeout(flushAnalytics, 150);
        return;
      }
      window.dataLayer = window.dataLayer || [];
      while (analyticsQueue.length) {
        var fallback = analyticsQueue.shift();
        window.dataLayer.push(Object.assign({
          event: "wl_analytics_event",
          event_name: fallback.name,
          analytics_version: "smart-search-fallback-1",
          page_type: "product_list"
        }, fallback.parameters));
      }
      return;
    }
    window.clearTimeout(analyticsTimer);
    analyticsAttempts = 0;
    while (analyticsQueue.length) {
      var entry = analyticsQueue.shift();
      window.WLAnalytics.track(entry.name, entry.parameters);
    }
  }

  function track(name, parameters) {
    analyticsQueue.push({ name: name, parameters: parameters || {} });
    flushAnalytics();
  }

  function safeUrl(value, kind) {
    try {
      var url = new URL(String(value || ""));
      if (url.protocol !== "https:") return "";
      if (kind === "product" && url.hostname !== "webtrack.woodsonlumber.com") return "";
      if (kind === "image" && ["webtrack.woodsonlumber.com", "images-woodsonlumber.sirv.com"].indexOf(url.hostname) === -1) return "";
      return url.href;
    } catch (error) {
      return "";
    }
  }

  function element(tagName, className, text) {
    var node = document.createElement(tagName);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function injectStyles() {
    if (document.getElementById("wl-smart-search-styles")) return;
    var style = document.createElement("style");
    style.id = "wl-smart-search-styles";
    style.textContent = [
      ".wl-smart-search{clear:both;width:100%;margin:28px 0 22px;padding:24px;border:1px solid #d7dce1;border-top:4px solid #6b0016;border-radius:10px;background:#fff;box-shadow:0 6px 22px rgba(25,31,38,.07);box-sizing:border-box}",
      ".wl-smart-search--recovery{margin-top:18px;background:linear-gradient(180deg,#fff 0%,#fbf8f9 100%)}",
      ".wl-smart-search__header{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:16px}",
      ".wl-smart-search__eyebrow{margin:0 0 4px;color:#6b0016;font-size:12px;font-weight:850;letter-spacing:.06em;text-transform:uppercase}",
      ".wl-smart-search__title{margin:0;color:#20262d;font-size:24px;font-weight:850;line-height:1.2}",
      ".wl-smart-search__message{max-width:760px;margin:8px 0 0;color:#4f5964;font-size:14px;line-height:1.5}",
      "#productlistcards>.wl-smart-search--in-grid{grid-column:1/-1;width:100%;margin:8px 0 18px}",
      ".wl-smart-search--in-grid{padding:20px}",
      ".wl-smart-search__search-links{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:13px 0 2px}",
      ".wl-smart-search__search-link-label{color:#37414b;font-size:13px;font-weight:800}",
      ".wl-smart-search__search-chip{display:inline-flex;align-items:center;min-height:34px;padding:6px 11px;border:1px solid #b9bec4;border-radius:999px;background:#fff;color:#6b0016!important;font-size:13px;font-weight:850;text-decoration:none!important;box-sizing:border-box}",
      ".wl-smart-search__search-chip:hover,.wl-smart-search__search-chip:focus-visible{border-color:#6b0016;background:#fbf4f6;outline:3px solid rgba(107,0,22,.14);outline-offset:1px}",
      ".wl-smart-search__controls{display:flex;flex:0 0 auto;gap:8px}",
      ".wl-smart-search__control{display:inline-grid;place-items:center;width:40px;height:40px;padding:0;border:1px solid #aeb5bd;border-radius:50%;background:#fff;color:#20262d;font-size:23px;line-height:1;cursor:pointer}",
      ".wl-smart-search__control:hover,.wl-smart-search__control:focus-visible{border-color:#6b0016;color:#6b0016;outline:3px solid rgba(107,0,22,.14);outline-offset:1px}",
      ".wl-smart-search__rail{display:flex;gap:14px;width:100%;max-width:100%;padding:2px 2px 10px;overflow-x:auto;overflow-y:hidden;overscroll-behavior-inline:contain;scroll-behavior:smooth;scroll-snap-type:x mandatory;scrollbar-width:thin;box-sizing:border-box}",
      ".wl-smart-search-card{display:flex;flex:0 0 calc((100% - 42px)/4);flex-direction:column;min-width:0;min-height:338px;padding:14px;border:1px solid #d9dde1;border-radius:8px;background:#fff;color:#20262d!important;scroll-snap-align:start;text-decoration:none!important;box-sizing:border-box;transition:border-color .16s,box-shadow .16s,transform .16s}",
      ".wl-smart-search-card:hover,.wl-smart-search-card:focus-visible{border-color:#6b0016;box-shadow:0 6px 18px rgba(25,31,38,.11);outline:none;transform:translateY(-1px)}",
      ".wl-smart-search-card__image{display:block;width:100%;height:165px;margin:0 0 12px;object-fit:contain}",
      ".wl-smart-search-card__image-fallback{display:grid;place-items:center;width:100%;height:165px;margin:0 0 12px;border:1px dashed #c7ccd1;border-radius:6px;background:#f6f7f8;color:#68727d;font-size:13px;font-weight:750;text-align:center;box-sizing:border-box}",
      ".wl-smart-search-card__brand,.wl-smart-search-card__category{color:#59636e;font-size:12px;font-weight:750;line-height:1.3}",
      ".wl-smart-search-card__title{display:-webkit-box;margin:7px 0 12px;overflow:hidden;color:#20262d;font-size:15px;font-weight:800;line-height:1.35;-webkit-box-orient:vertical;-webkit-line-clamp:3}",
      ".wl-smart-search-card__status{margin-top:auto;color:#14713b;font-size:12px;font-weight:850}",
      ".wl-smart-search-card__cta{display:inline-flex;align-items:center;justify-content:center;min-height:40px;margin-top:10px;padding:8px 10px;border-radius:5px;background:#6b0016;color:#fff;font-size:13px;font-weight:850;text-align:center}",
      ".wl-smart-search__empty{padding:18px;border-radius:8px;background:#f5f6f7;color:#3f4852}",
      ".wl-smart-search__empty p{margin:0 0 12px;line-height:1.5}",
      ".wl-smart-search__edit{min-height:42px;padding:9px 16px;border:0;border-radius:5px;background:#6b0016;color:#fff;font-weight:800;cursor:pointer}",
      "@media(max-width:900px){.wl-smart-search-card{flex-basis:calc((100% - 14px)/2)}}",
      "@media(max-width:600px){.wl-smart-search{margin:18px 0;padding:18px 14px}.wl-smart-search__header{align-items:flex-start}.wl-smart-search__title{font-size:21px}.wl-smart-search__controls{display:none}.wl-smart-search__rail{margin-right:-14px;padding-right:14px}.wl-smart-search-card{flex-basis:78%;min-height:318px}.wl-smart-search-card__image,.wl-smart-search-card__image-fallback{height:150px}#productlistcards>.wl-smart-search--in-grid{margin:6px 0 14px}.wl-smart-search__search-links{align-items:flex-start}}"
    ].join("");
    document.head.appendChild(style);
  }

  function analyticsItems(items, listId, listName) {
    return items.map(function (item, index) {
      var result = {
        item_id: String(item.productId),
        item_name: cleanText(item.title, 180),
        item_list_id: listId,
        item_list_name: listName,
        index: index
      };
      if (item.brand) result.item_brand = cleanText(item.brand, 100);
      if (item.category) result.item_category = cleanText(item.category, 200);
      return result;
    });
  }

  function rememberSelection(item, payload) {
    try {
      window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify({
        productId: String(item.productId),
        listId: payload.listId,
        listName: payload.listName,
        algorithm: payload.algorithm,
        strategy: payload.strategy,
        selectedAt: Date.now()
      }));
    } catch (error) {}
  }

  function focusSearchBox() {
    var input = document.querySelector("input[type='search'], input[placeholder*='Search' i], input[id*='SearchTextBox']");
    if (!input) return;
    input.scrollIntoView({ behavior: "smooth", block: "center" });
    input.focus();
    if (typeof input.select === "function") input.select();
  }

  function insertionPoint(panel) {
    var children = Array.prototype.slice.call(panel.children);
    var notice = children.filter(function (child) {
      return child.tagName === "TABLE" && /customer specific prices/i.test(child.textContent || "");
    }).pop();
    return notice || null;
  }

  function canonicalSearchUrl(term) {
    return "/Products.aspx?pg=0&sort=Relevance&direction=desc&itemsPerPage=48&searchText=" + encodeURIComponent(cleanText(term, 100));
  }

  function renderSearchLinks(container, term, payload) {
    var raw = Array.isArray(payload && payload.searchSuggestions) ? payload.searchSuggestions : [];
    var seen = Object.create(null);
    var suggestions = raw.filter(function (suggestion) {
      var value = cleanText(suggestion && (suggestion.term || suggestion.label), 100);
      var type = suggestion && suggestion.type === "correction" ? "correction" : "related";
      var key = value.toLowerCase();
      if (!value || seen[key]) return false;
      seen[key] = true;
      suggestion.safeTerm = value;
      suggestion.safeType = type;
      return true;
    }).slice(0, 5);
    if (!suggestions.length) return;

    var navigation = element("nav", "wl-smart-search__search-links");
    navigation.setAttribute("aria-label", "Suggested searches");
    suggestions.forEach(function (suggestion, index) {
      var precedingType = index ? suggestions[index - 1].safeType : "";
      if (suggestion.safeType !== precedingType) {
        navigation.appendChild(element(
          "span",
          "wl-smart-search__search-link-label",
          suggestion.safeType === "correction" ? "Did you mean:" : "Related searches:"
        ));
      }
      var link = element("a", "wl-smart-search__search-chip", cleanText(suggestion.label || suggestion.safeTerm, 100));
      link.href = canonicalSearchUrl(suggestion.safeTerm);
      link.addEventListener("click", function () {
        track("search_suggestion_click", {
          search_term: term,
          suggested_search_term: suggestion.safeTerm,
          suggestion_type: suggestion.safeType,
          search_enhancement_version: "smart_search_v2"
        });
      });
      navigation.appendChild(link);
    });
    container.appendChild(navigation);
  }

  function trackResultState(term, state, payload, nativeState, suggestionCount, sectionCount) {
    track("search_results_enhanced", {
      search_term: term,
      search_enhancement_version: "smart_search_v2",
      search_enhancement_state: state,
      search_match_type: cleanText(payload && payload.matchType || "none", 30),
      suggested_term: cleanText(payload && payload.suggestedTerm || "", 100),
      native_result_count: nativeState.count,
      native_result_total: nativeState.total,
      suggestion_count: suggestionCount,
      merchandising_section_count: Number(sectionCount) || 0,
      recommendation_algorithm: cleanText(payload && payload.algorithm || "merchant_search_discovery_v2", 100)
    });
  }

  function trackListView(section, items, payload) {
    function send() {
      if (viewTracked[payload.listId] || !document.documentElement.contains(section)) return;
      viewTracked[payload.listId] = true;
      track("view_item_list", {
        item_list_id: payload.listId,
        item_list_name: payload.listName,
        recommendation_algorithm: payload.algorithm,
        recommendation_strategy: payload.strategy,
        recommendation_count: items.length,
        ecommerce: { items: analyticsItems(items, payload.listId, payload.listName) }
      });
    }
    if (typeof window.IntersectionObserver !== "function") return window.setTimeout(send, 0);
    var observer = new window.IntersectionObserver(function (entries) {
      if (!entries.some(function (entry) { return entry.isIntersecting && entry.intersectionRatio >= 0.35; })) return;
      observer.disconnect();
      send();
    }, { threshold: [0.35] });
    observer.observe(section);
  }

  function renderEmptyHelp(section, term) {
    var empty = element("div", "wl-smart-search__empty");
    empty.appendChild(element("p", "", "We could not find a confident catalog match yet. Try the brand, item number, UPC, or a shorter product description."));
    var button = element("button", "wl-smart-search__edit", "Edit your search");
    button.type = "button";
    button.addEventListener("click", function () {
      track("search_refine_click", { search_term: term, search_enhancement_version: "smart_search_v2" });
      focusSearchBox();
    });
    empty.appendChild(button);
    section.appendChild(empty);
  }

  function renderLoading(panel, term) {
    injectStyles();
    var section = element("section", "wl-smart-search wl-smart-search--recovery");
    section.id = "wl-smart-search-results";
    section.setAttribute("aria-labelledby", "wl-smart-search-title");
    section.setAttribute("aria-live", "polite");
    var heading = element("div", "wl-smart-search__header");
    var headingText = element("div", "");
    headingText.appendChild(element("p", "wl-smart-search__eyebrow", "Search help"));
    var title = element("h2", "wl-smart-search__title", "Looking for close catalog matches…");
    title.id = "wl-smart-search-title";
    headingText.appendChild(title);
    headingText.appendChild(element("p", "wl-smart-search__message", "WebTrack did not find an exact match for “" + term + ".” We’re checking spelling and related catalog terms."));
    heading.appendChild(headingText);
    section.appendChild(heading);
    panel.insertBefore(section, insertionPoint(panel));
  }

  function validItems(value, limit) {
    return (Array.isArray(value) ? value : []).filter(function (item) {
      return item && /^\d{1,20}$/.test(String(item.productId || "")) &&
        safeUrl(item.productUrl, "product") && safeUrl(item.imageUrl, "image");
    }).slice(0, limit);
  }

  function appendProductRail(section, items, payload, term, label) {
    var rail = element("div", "wl-smart-search__rail");
    rail.setAttribute("role", "list");
    rail.setAttribute("aria-label", label);
    items.forEach(function (item, index) {
      var card = element("a", "wl-smart-search-card");
      card.href = safeUrl(item.productUrl, "product");
      card.setAttribute("role", "listitem");
      card.setAttribute("data-smart-search-product-id", String(item.productId));
      card.setAttribute("data-smart-search-rank", String(index + 1));
      var image = element("img", "wl-smart-search-card__image");
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("error", function () {
        if (image.parentNode) image.parentNode.replaceChild(element("span", "wl-smart-search-card__image-fallback", "Image unavailable"), image);
      }, { once: true });
      image.src = safeUrl(item.imageUrl, "image");
      card.appendChild(image);
      if (item.brand) card.appendChild(element("span", "wl-smart-search-card__brand", cleanText(item.brand, 100)));
      if (item.categoryLabel) card.appendChild(element("span", "wl-smart-search-card__category", cleanText(item.categoryLabel, 100)));
      card.appendChild(element("span", "wl-smart-search-card__title", cleanText(item.title, 180)));
      card.appendChild(element("span", "wl-smart-search-card__status", "Available to order"));
      card.appendChild(element("span", "wl-smart-search-card__cta", "View price & availability"));
      card.addEventListener("click", function () {
        rememberSelection(item, payload);
        var selectedItems = analyticsItems([item], payload.listId, payload.listName);
        selectedItems[0].index = index;
        track("select_item", {
          search_term: term,
          item_list_id: payload.listId,
          item_list_name: payload.listName,
          recommendation_algorithm: payload.algorithm,
          recommendation_strategy: payload.strategy,
          search_match_type: cleanText(payload.matchType || "none", 30),
          recommendation_rank: index + 1,
          ecommerce: { items: selectedItems }
        });
      });
      rail.appendChild(card);
    });
    section.appendChild(rail);
    return rail;
  }

  function appendRailControls(header, rail, label) {
    var controls = element("div", "wl-smart-search__controls");
    var previous = element("button", "wl-smart-search__control", "‹");
    var next = element("button", "wl-smart-search__control", "›");
    previous.type = next.type = "button";
    previous.setAttribute("aria-label", "Show previous " + label);
    next.setAttribute("aria-label", "Show more " + label);
    previous.addEventListener("click", function () { rail.scrollBy({ left: -Math.max(260, rail.clientWidth * 0.82), behavior: "smooth" }); });
    next.addEventListener("click", function () { rail.scrollBy({ left: Math.max(260, rail.clientWidth * 0.82), behavior: "smooth" }); });
    controls.appendChild(previous);
    controls.appendChild(next);
    header.appendChild(controls);
  }

  function renderRecovery(panel, term, nativeState, payload) {
    var items = validItems(payload.suggestions, 8);
    injectStyles();
    var previousSection = document.getElementById("wl-smart-search-results");
    if (previousSection && previousSection.parentNode) previousSection.parentNode.removeChild(previousSection);
    var section = element("section", "wl-smart-search wl-smart-search--recovery");
    section.id = "wl-smart-search-results";
    section.setAttribute("data-wl-self-tracked-product-list", "true");
    section.setAttribute("aria-labelledby", "wl-smart-search-title");
    section.setAttribute("data-search-algorithm", cleanText(payload.algorithm || "merchant_search_discovery_v2", 100));

    var header = element("div", "wl-smart-search__header");
    var heading = element("div", "");
    heading.appendChild(element("p", "wl-smart-search__eyebrow", "Search help"));
    var title = element("h2", "wl-smart-search__title", items.length ? "We found possible matches" : "Let’s try another search");
    title.id = "wl-smart-search-title";
    heading.appendChild(title);
    heading.appendChild(element("p", "wl-smart-search__message", items.length
      ? "WebTrack did not find an exact match for “" + term + ".” These catalog items may be what you meant."
      : "WebTrack did not find an exact match for “" + term + ".” Try one of these catalog-backed searches or edit your wording."));
    renderSearchLinks(heading, term, payload);
    header.appendChild(heading);
    section.appendChild(header);

    if (!items.length) renderEmptyHelp(section, term);
    else {
      var rail = appendProductRail(section, items, payload, term, "Possible product matches");
      appendRailControls(header, rail, "possible products");
      trackListView(section, items, payload);
    }
    panel.insertBefore(section, insertionPoint(panel));
    trackResultState(term, items.length ? "empty_recovery" : (payload.failureState || "empty_no_confident_matches"), payload, nativeState, items.length, 0);
    return true;
  }

  function createMerchandisingSection(term, payload, sectionPayload, index) {
    var items = validItems(sectionPayload.recommendations, 4);
    if (items.length < 3) return null;
    var listPayload = {
      algorithm: payload.algorithm,
      matchType: payload.matchType,
      listId: cleanText(sectionPayload.listId, 100),
      listName: cleanText(sectionPayload.listName, 100),
      strategy: cleanText(sectionPayload.strategy, 100)
    };
    if (!listPayload.listId || !listPayload.listName) return null;
    var section = element("section", "wl-smart-search wl-smart-search--in-grid");
    section.id = "wl-smart-search-merchandising-" + String(index + 1);
    section.setAttribute("data-wl-self-tracked-product-list", "true");
    section.setAttribute("aria-labelledby", section.id + "-title");
    section.setAttribute("data-search-algorithm", cleanText(payload.algorithm || "merchant_search_discovery_v2", 100));

    var header = element("div", "wl-smart-search__header");
    var heading = element("div", "");
    heading.appendChild(element("p", "wl-smart-search__eyebrow", cleanText(sectionPayload.eyebrow || "Keep exploring", 80)));
    var title = element("h2", "wl-smart-search__title", listPayload.listName);
    title.id = section.id + "-title";
    heading.appendChild(title);
    heading.appendChild(element("p", "wl-smart-search__message", "Helpful additions related to “" + term + "” while you compare the original search results."));
    header.appendChild(heading);
    section.appendChild(header);
    var rail = appendProductRail(section, items, listPayload, term, listPayload.listName);
    appendRailControls(header, rail, "recommended products");
    section.wlItems = items;
    section.wlPayload = listPayload;
    section.wlPlacementAfter = Math.max(1, Math.floor(Number(sectionPayload.placementAfter) || (index ? 24 : 8)));
    return section;
  }

  function renderMerchandising(panel, term, nativeState, payload) {
    injectStyles();
    var grid = panel.querySelector("#productlistcards");
    var nativeCards = grid ? Array.prototype.slice.call(grid.children).filter(function (child) {
      return child.matches && child.matches(".wl-product-card");
    }) : [];
    var rendered = (Array.isArray(payload.sections) ? payload.sections : []).slice(0, 2).map(function (sectionPayload, index) {
      return createMerchandisingSection(term, payload, sectionPayload, index);
    }).filter(Boolean);
    if (!grid || !nativeCards.length || !rendered.length) {
      trackResultState(term, "native_no_additions", payload, nativeState, 0, 0);
      return false;
    }
    var productCount = 0;
    var lastInsertedAtPosition = Object.create(null);
    rendered.forEach(function (section) {
      var position = Math.min(nativeCards.length, section.wlPlacementAfter);
      var anchor = lastInsertedAtPosition[position] || nativeCards[position - 1];
      if (anchor.nextSibling) grid.insertBefore(section, anchor.nextSibling);
      else grid.appendChild(section);
      lastInsertedAtPosition[position] = section;
      productCount += section.wlItems.length;
      trackListView(section, section.wlItems, section.wlPayload);
    });
    trackResultState(term, "native_merchandised", payload, nativeState, productCount, rendered.length);
    return true;
  }

  function renderResponse(panel, term, nativeState, payload) {
    return nativeState.count === 0
      ? renderRecovery(panel, term, nativeState, payload)
      : renderMerchandising(panel, term, nativeState, payload);
  }

  function requestSuggestions(term, nativeState) {
    var controller = typeof window.AbortController === "function" ? new window.AbortController() : null;
    var timeout = controller ? window.setTimeout(function () { controller.abort(); }, 14500) : 0;
    return window.fetch(API_URL, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: term,
        nativeResultCount: nativeState.count,
        excludeProductIds: nativeState.productIds
      }),
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      if (!response.ok) throw new Error("Suggestion request failed");
      return response.json();
    }).finally(function () {
      if (timeout) window.clearTimeout(timeout);
    });
  }

  function enhance() {
    if (enhancementStarted || !/\/Products\.aspx$/i.test(window.location.pathname || "")) return;
    var term = searchTerm();
    var panel = document.getElementById(RESULTS_PANEL_ID);
    if (!term || !panel) return;
    enhancementStarted = true;
    var nativeState = nativeSearchState(panel);
    if (nativeState.count === 0) renderLoading(panel, term);
    requestSuggestions(term, nativeState).then(function (payload) {
      if (!payload || payload.success !== true) throw new Error("Suggestion response unavailable");
      renderResponse(panel, term, nativeState, payload);
    }).catch(function () {
      if (nativeState.count > 0) {
        trackResultState(term, "native_service_unavailable", null, nativeState, 0, 0);
        return;
      }
      renderResponse(panel, term, nativeState, {
        algorithm: "merchant_search_discovery_v2",
        listId: "search_recovery_matches_v2",
        listName: "Possible matches",
        matchType: "none",
        strategy: "catalog_correction_and_recovery",
        failureState: "empty_service_unavailable",
        searchSuggestions: [],
        suggestions: []
      });
    });
  }

  function waitForResultsPanel() {
    var started = Date.now();
    (function check() {
      var panel = document.getElementById(RESULTS_PANEL_ID);
      var nativeCards = panel && panel.querySelector("#productlistcards");
      if (panel && (nativeCards || (document.readyState === "complete" && Date.now() - started >= 750))) return enhance();
      if (Date.now() - started < MAX_WAIT_MS) window.setTimeout(check, 250);
    })();
  }

  window.WLSmartSearch = {
    build: BUILD,
    enhance: enhance,
    nativeSearchState: nativeSearchState
  };

  ready(waitForResultsPanel);
})(window, document);
