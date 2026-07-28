(function (root, factory) {
  "use strict";

  var productContent = factory();
  if (typeof module === "object" && module.exports) module.exports = productContent;
  if (root && root.document) {
    root.WLProductDescription = productContent;
    productContent.init(root, root.document);
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var API_URL = "https://wl-upsrates.vercel.app/api/product-content";
  var SHEET_ID = "1LGW3XkZhUihvwjp2rxUG8UY9MvwZsorq40gxLjfCVE0";

  function cleanText(value, maxLength) {
    return String(value == null ? "" : value)
      .replace(/\u00a0/g, " ")
      .replace(/\r/g, "")
      .trim()
      .slice(0, maxLength || 5000);
  }

  function productIdFromLocation(location) {
    try {
      var productId = new URLSearchParams(location.search || "").get("pid") || "";
      return /^\d{1,20}$/.test(productId) ? productId : "";
    } catch (error) {
      return "";
    }
  }

  function parseCsv(csvText) {
    var rows = [];
    var row = [];
    var field = "";
    var quoted = false;
    var text = String(csvText || "");

    for (var index = 0; index < text.length; index += 1) {
      var character = text[index];
      if (character === "\"") {
        if (quoted && text[index + 1] === "\"") {
          field += "\"";
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === "," && !quoted) {
        row.push(cleanText(field));
        field = "";
      } else if (character === "\n" && !quoted) {
        row.push(cleanText(field));
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += character;
      }
    }
    if (field || row.length) {
      row.push(cleanText(field));
      rows.push(row);
    }
    return rows;
  }

  function featureKey(value) {
    return cleanText(value)
      .toLowerCase()
      .replace(/[\u2010-\u2015-]/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function uniqueValues(values, keyFunction) {
    var seen = Object.create(null);
    return values.map(function (value) {
      return cleanText(value);
    }).filter(function (value) {
      var key = keyFunction ? keyFunction(value) : value.toLowerCase();
      if (!value || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function headerIndex(headers, name) {
    var target = String(name).toLowerCase();
    return headers.findIndex(function (header) {
      return cleanText(header, 100).toLowerCase() === target;
    });
  }

  function safeResourceUrl(value) {
    try {
      var url = new URL(cleanText(value, 1000));
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch (error) {
      return "";
    }
  }

  function specificationFromText(value) {
    var text = cleanText(value, 1000);
    if (!text) return null;
    var separator = text.indexOf(":");
    if (separator <= 0 || separator === text.length - 1) {
      return { section: "Specifications", name: "Detail", value: text };
    }
    return {
      section: "Specifications",
      name: cleanText(text.slice(0, separator), 200),
      value: cleanText(text.slice(separator + 1), 800)
    };
  }

  function contentFromCsv(csvText, requestedProductId) {
    var rows = parseCsv(csvText);
    var headers = rows.shift() || [];
    var productIndex = headerIndex(headers, "Productid");
    var descriptionIndex = headerIndex(headers, "Description");
    var specificationIndex = headerIndex(headers, "Specifications");
    var featureIndex = headerIndex(headers, "Features");
    var resourceIndex = headerIndex(headers, "Resources");
    var resourceLinkIndex = headerIndex(headers, "Resource Link");
    if (productIndex < 0) return null;

    var productRows = rows.filter(function (row) {
      return cleanText(row[productIndex], 20) === requestedProductId;
    });
    if (!productRows.length) return null;

    var descriptionParagraphs = descriptionIndex >= 0
      ? uniqueValues(productRows.map(function (row) { return row[descriptionIndex]; }))
      : [];
    var features = featureIndex >= 0
      ? uniqueValues(productRows.map(function (row) { return row[featureIndex]; }), featureKey)
      : [];
    var specifications = [];
    var specificationKeys = Object.create(null);
    if (specificationIndex >= 0) {
      productRows.forEach(function (row) {
        var specification = specificationFromText(row[specificationIndex]);
        if (!specification) return;
        var key = (specification.name + "\u0000" + specification.value).toLowerCase();
        if (specificationKeys[key]) return;
        specificationKeys[key] = true;
        specifications.push(specification);
      });
    }

    var resources = [];
    var resourceKeys = Object.create(null);
    if (resourceIndex >= 0 && resourceLinkIndex >= 0) {
      productRows.forEach(function (row) {
        var name = cleanText(row[resourceIndex], 200);
        var url = safeResourceUrl(row[resourceLinkIndex]);
        var key = (name + "\u0000" + url).toLowerCase();
        if (!name || !url || resourceKeys[key]) return;
        resourceKeys[key] = true;
        resources.push({ name: name, url: url });
      });
    }

    return {
      productId: requestedProductId,
      description: descriptionParagraphs.join("\n\n"),
      descriptionParagraphs: descriptionParagraphs,
      features: features,
      specifications: specifications,
      resources: resources,
      source: "google-sheet-fallback"
    };
  }

  function buildSheetQueryUrl(productId) {
    var url = new URL("https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq");
    url.searchParams.set("gid", "0");
    url.searchParams.set("tqx", "out:csv");
    url.searchParams.set("tq", "select A, B, C, D, E, F where A = " + productId);
    return url.toString();
  }

  function normalizeContent(content, productId) {
    if (!content || typeof content !== "object") return null;
    var descriptionParagraphs = Array.isArray(content.descriptionParagraphs)
      ? uniqueValues(content.descriptionParagraphs)
      : uniqueValues(cleanText(content.description).split(/\n{2,}/));
    var features = Array.isArray(content.features)
      ? uniqueValues(content.features, featureKey)
      : [];
    var specifications = Array.isArray(content.specifications)
      ? content.specifications.map(function (specification) {
        if (!specification || typeof specification !== "object") return null;
        var name = cleanText(specification.name, 200);
        var value = cleanText(specification.value, 800);
        return name && value ? {
          section: cleanText(specification.section, 100) || "Specifications",
          name: name,
          value: value
        } : null;
      }).filter(Boolean)
      : [];
    var resources = Array.isArray(content.resources)
      ? content.resources.map(function (resource) {
        if (!resource || typeof resource !== "object") return null;
        var name = cleanText(resource.name, 200);
        var url = safeResourceUrl(resource.url);
        return name && url ? { name: name, url: url } : null;
      }).filter(Boolean)
      : [];

    var normalized = {
      productId: cleanText(content.productId || productId, 20),
      description: descriptionParagraphs.join("\n\n"),
      descriptionParagraphs: descriptionParagraphs,
      features: features,
      specifications: specifications,
      resources: resources,
      source: cleanText(content.source, 80)
    };
    return normalized.description || features.length || specifications.length || resources.length
      ? normalized
      : null;
  }

  function fetchWithTimeout(windowObject, url, responseType) {
    var controller = typeof windowObject.AbortController === "function"
      ? new windowObject.AbortController()
      : null;
    var timeout = windowObject.setTimeout(function () {
      if (controller) controller.abort();
    }, 8000);

    return windowObject.fetch(url, {
      headers: { Accept: responseType === "json" ? "application/json" : "text/csv" },
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      if (!response.ok) throw new Error("Content request returned " + response.status + ".");
      return responseType === "json" ? response.json() : response.text();
    }).finally(function () {
      windowObject.clearTimeout(timeout);
    });
  }

  function loadContent(windowObject, productId) {
    var apiUrl = windowObject.WL_PRODUCT_CONTENT_API_URL || API_URL;
    var apiRequest = apiUrl + (apiUrl.indexOf("?") === -1 ? "?" : "&") + "pid=" + encodeURIComponent(productId);
    return fetchWithTimeout(windowObject, apiRequest, "json")
      .then(function (content) {
        var normalized = normalizeContent(content, productId);
        if (!normalized) throw new Error("The product content response was empty.");
        return normalized;
      })
      .catch(function () {
        return fetchWithTimeout(windowObject, buildSheetQueryUrl(productId), "text")
          .then(function (csvText) {
            return normalizeContent(contentFromCsv(csvText, productId), productId);
          });
      });
  }

  function element(documentObject, tagName, className, text) {
    var node = documentObject.createElement(tagName);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function appendHeading(documentObject, parent, headingId, text) {
    var heading = element(documentObject, "h3", "wl-product-content__heading", text);
    heading.id = headingId;
    parent.appendChild(heading);
  }

  function createWidget(documentObject, content) {
    var widget = element(documentObject, "section", "wl-product-content");
    widget.id = "product-widget";
    widget.setAttribute("aria-labelledby", "wl-product-content-title");
    widget.setAttribute("data-product-id", content.productId);

    var title = element(documentObject, "h2", "wl-product-content__title", "Product details");
    title.id = "wl-product-content-title";
    widget.appendChild(title);

    if (content.descriptionParagraphs.length) {
      var about = element(documentObject, "section", "wl-product-content__section");
      about.setAttribute("aria-labelledby", "wl-product-about-title");
      appendHeading(documentObject, about, "wl-product-about-title", "About this product");
      content.descriptionParagraphs.forEach(function (paragraphText) {
        about.appendChild(element(documentObject, "p", "wl-product-content__description", paragraphText));
      });
      widget.appendChild(about);
    }

    if (content.features.length) {
      var highlights = element(documentObject, "section", "wl-product-content__section");
      highlights.setAttribute("aria-labelledby", "wl-product-highlights-title");
      appendHeading(documentObject, highlights, "wl-product-highlights-title", "Highlights");
      var featureList = element(documentObject, "ul", "wl-product-content__features");
      content.features.forEach(function (feature) {
        featureList.appendChild(element(documentObject, "li", "", feature));
      });
      highlights.appendChild(featureList);
      widget.appendChild(highlights);
    }

    if (content.specifications.length) {
      var specifications = element(documentObject, "section", "wl-product-content__section");
      specifications.setAttribute("aria-labelledby", "wl-product-specifications-title");
      appendHeading(documentObject, specifications, "wl-product-specifications-title", "Specifications");
      var definitionList = element(documentObject, "dl", "wl-product-content__specifications");
      content.specifications.forEach(function (specification) {
        var row = element(documentObject, "div", "wl-product-content__specification");
        row.appendChild(element(documentObject, "dt", "", specification.name));
        row.appendChild(element(documentObject, "dd", "", specification.value));
        definitionList.appendChild(row);
      });
      specifications.appendChild(definitionList);
      widget.appendChild(specifications);
    }

    if (content.resources.length) {
      var resources = element(documentObject, "section", "wl-product-content__section");
      resources.setAttribute("aria-labelledby", "wl-product-resources-title");
      appendHeading(documentObject, resources, "wl-product-resources-title", "Resources & documents");
      var resourceList = element(documentObject, "ul", "wl-product-content__resources");
      content.resources.forEach(function (resource) {
        var item = element(documentObject, "li");
        var link = element(documentObject, "a", "wl-product-content__resource", resource.name);
        link.href = resource.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.appendChild(element(documentObject, "span", "wl-product-content__resource-icon", "↗"));
        item.appendChild(link);
        resourceList.appendChild(item);
      });
      resources.appendChild(resourceList);
      widget.appendChild(resources);
    }
    return widget;
  }

  function findMount(documentObject) {
    return documentObject.getElementById("product-main") ||
      documentObject.getElementById("ctl00_PageBody_productDetail_productDescription") ||
      documentObject.getElementById("ctl00_PageBody_productDetail_RadMultiPage1");
  }

  function waitForMount(windowObject, documentObject) {
    var existing = findMount(documentObject);
    if (existing) return Promise.resolve(existing);
    return new Promise(function (resolve) {
      var completed = false;
      var finish = function (value) {
        if (completed) return;
        completed = true;
        if (observer) observer.disconnect();
        windowObject.clearTimeout(timeout);
        resolve(value);
      };
      var observer = typeof windowObject.MutationObserver === "function"
        ? new windowObject.MutationObserver(function () {
          var mount = findMount(documentObject);
          if (mount) finish(mount);
        })
        : null;
      if (observer && documentObject.body) observer.observe(documentObject.body, { childList: true, subtree: true });
      var timeout = windowObject.setTimeout(function () {
        finish(findMount(documentObject));
      }, 5000);
    });
  }

  function mountWidget(documentObject, mount, widget) {
    var main = documentObject.getElementById("product-main");
    var legacy = documentObject.getElementById("ctl00_PageBody_productDetail_productDescription");
    if (main) {
      main.insertBefore(widget, legacy && legacy.parentNode === main ? legacy : main.firstChild);
    } else if (mount && mount.parentNode) {
      mount.parentNode.insertBefore(widget, mount.nextSibling);
    } else {
      return false;
    }

    [
      legacy,
      documentObject.getElementById("ctl00_PageBody_productDetail_RadMultiPage1"),
      documentObject.getElementById("productdescription")
    ].forEach(function (elementToHide) {
      if (!elementToHide || elementToHide.contains(widget)) return;
      elementToHide.hidden = true;
      elementToHide.setAttribute("aria-hidden", "true");
    });
    return true;
  }

  function findProductSchema(value) {
    if (!value || typeof value !== "object") return null;
    if (value["@type"] === "Product" || (Array.isArray(value["@type"]) && value["@type"].indexOf("Product") !== -1)) {
      return value;
    }
    if (Array.isArray(value)) {
      for (var arrayIndex = 0; arrayIndex < value.length; arrayIndex += 1) {
        var arrayProduct = findProductSchema(value[arrayIndex]);
        if (arrayProduct) return arrayProduct;
      }
    }
    if (Array.isArray(value["@graph"])) return findProductSchema(value["@graph"]);
    return null;
  }

  function mergeProductSchema(schema, content) {
    if (!schema || !content) return schema;
    if (content.description) schema.description = content.description;
    var existing = Array.isArray(schema.additionalProperty) ? schema.additionalProperty.slice() : [];
    var keys = Object.create(null);
    existing.forEach(function (property) {
      if (!property || typeof property !== "object") return;
      keys[(cleanText(property.name, 200) + "\u0000" + cleanText(property.value, 800)).toLowerCase()] = true;
    });
    content.specifications.forEach(function (specification) {
      var key = (specification.name + "\u0000" + specification.value).toLowerCase();
      if (keys[key]) return;
      keys[key] = true;
      existing.push({
        "@type": "PropertyValue",
        name: specification.name,
        value: specification.value
      });
    });
    if (existing.length) schema.additionalProperty = existing;
    return schema;
  }

  function updateStructuredData(documentObject, content) {
    var scripts = documentObject.querySelectorAll('script[type="application/ld+json"]');
    for (var index = 0; index < scripts.length; index += 1) {
      try {
        var parsed = JSON.parse(scripts[index].textContent || "");
        var product = findProductSchema(parsed);
        if (!product) continue;
        mergeProductSchema(product, content);
        scripts[index].textContent = JSON.stringify(parsed);
        return true;
      } catch (error) {}
    }
    return false;
  }

  function load(windowObject, documentObject) {
    if (documentObject.getElementById("product-widget")) return Promise.resolve(false);
    var productId = productIdFromLocation(windowObject.location);
    if (!productId) return Promise.resolve(false);

    return Promise.all([
      loadContent(windowObject, productId),
      waitForMount(windowObject, documentObject)
    ]).then(function (results) {
      var content = results[0];
      var mount = results[1];
      if (!content || !mount || documentObject.getElementById("product-widget")) return false;
      var mounted = mountWidget(documentObject, mount, createWidget(documentObject, content));
      if (!mounted) return false;
      if (!updateStructuredData(documentObject, content)) {
        windowObject.setTimeout(function () {
          updateStructuredData(documentObject, content);
        }, 1500);
      }
      return true;
    }).catch(function (error) {
      if (windowObject.console && typeof windowObject.console.warn === "function") {
        windowObject.console.warn("[WL Product Content] Keeping the native description.", error);
      }
      return false;
    });
  }

  function init(windowObject, documentObject) {
    if (!/ProductDetail\.aspx/i.test(windowObject.location.pathname || "")) return;
    if (documentObject.readyState === "loading") {
      documentObject.addEventListener("DOMContentLoaded", function () {
        load(windowObject, documentObject);
      }, { once: true });
    } else {
      load(windowObject, documentObject);
    }
  }

  return {
    buildSheetQueryUrl: buildSheetQueryUrl,
    contentFromCsv: contentFromCsv,
    createWidget: createWidget,
    init: init,
    load: load,
    mergeProductSchema: mergeProductSchema,
    normalizeContent: normalizeContent,
    parseCsv: parseCsv,
    productIdFromLocation: productIdFromLocation,
    safeResourceUrl: safeResourceUrl
  };
});
