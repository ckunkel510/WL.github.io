$(document).ready(function () {
  "use strict";

  const currentPid = (window.location.search.match(/[?&]pid=([^&]*)/) || [])[1] || "";
  if (!currentPid) return;

  const inputId = "ctl00_PageBody_productDetail_ctl00_qty_" + currentPid;
  const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR5nZGRFSLOS6_0LhN-uXF2oraESccvFP43BdCQQEqn43vned5cHRhHux2d4-BzY6vmGfk-nzNM8G67/pub?output=csv";
  const cacheKey = "wl_product_options_csv_v2";
  const cacheTtlMs = 30 * 60 * 1000;

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    const source = String(text || "");

    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      if (char === '"') {
        if (quoted && source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (char === "," && !quoted) {
        row.push(field);
        field = "";
      } else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && source[index + 1] === "\n") index += 1;
        row.push(field);
        if (row.some(value => String(value || "").trim())) rows.push(row);
        row = [];
        field = "";
      } else {
        field += char;
      }
    }

    row.push(field);
    if (row.some(value => String(value || "").trim())) rows.push(row);
    return rows;
  }

  function cachedSheet() {
    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
      if (!cached || !cached.text || Date.now() - Number(cached.savedAt || 0) > cacheTtlMs) return null;
      return cached.text;
    } catch (error) {
      return null;
    }
  }

  function rememberSheet(text) {
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ text, savedAt: Date.now() }));
    } catch (error) {}
  }

  function publishOptions(status, optionCount, groupCount) {
    const detail = {
      productId: currentPid,
      status,
      optionCount: Number(optionCount) || 0,
      groupCount: Number(groupCount) || 0
    };
    window.WLPdpOptionsState = detail;
    try {
      document.dispatchEvent(new CustomEvent("wl:pdp-options-ready", { detail }));
    } catch (error) {}
  }

  function optionParts(rawValue) {
    const raw = String(rawValue || "").trim();
    const separator = raw.indexOf("-");
    if (separator > 0) {
      const possiblePid = raw.slice(0, separator).trim();
      if (/^\d+$/.test(possiblePid)) {
        return {
          productId: possiblePid,
          label: raw.slice(separator + 1).trim() || raw
        };
      }
    }
    return { productId: "", label: raw };
  }

  function optionAttributes(element, type, value, targetPid) {
    return element
      .attr("data-wl-product-option", "true")
      .attr("data-option-type", type)
      .attr("data-option-value", value)
      .attr("data-option-target-id", targetPid || "");
  }

  function renderOptions(csvText) {
    const rows = parseCsv(csvText);
    if (!rows.length) {
      publishOptions("empty", 0, 0);
      return;
    }

    const header = rows.shift().map((value, index) => {
      const normalized = String(value || "").trim();
      return index === 0 ? normalized.replace(/^\uFEFF/, "") : normalized;
    });
    const lowerHeader = header.map(value => value.toLowerCase());
    const productIdIndex = lowerHeader.indexOf("productid");
    const optionTypeIndex = lowerHeader.indexOf("optiontype");
    const headerIndex = lowerHeader.indexOf("header");
    const optionIndexes = header
      .map((value, index) => ({ value: String(value || "").toLowerCase(), index }))
      .filter(item => /^option\d+$/.test(item.value))
      .sort((a, b) => Number(a.value.replace("option", "")) - Number(b.value.replace("option", "")));

    if (productIdIndex < 0 || optionTypeIndex < 0 || headerIndex < 0 || !optionIndexes.length) {
      publishOptions("invalid", 0, 0);
      return;
    }

    const matchingRows = rows.filter(row => String(row[productIdIndex] || "").trim() === currentPid);
    $("#productoption").remove();
    if (!matchingRows.length) {
      publishOptions("ready", 0, 0);
      return;
    }

    const $container = $("<section>", {
      id: "productoption",
      class: "wl-product-options",
      role: "region",
      "aria-label": "Product options"
    });
    let optionCount = 0;
    let groupCount = 0;

    matchingRows.forEach(row => {
      const optionType = String(row[optionTypeIndex] || "").trim().toLowerCase();
      const dynamicHeader = String(row[headerIndex] || "").trim() || "Choose an option";
      const $group = $("<div>", {
        class: "wl-product-option-group",
        "data-option-group": dynamicHeader
      });
      $("<h4>").text(dynamicHeader).appendTo($group);
      const $options = $("<div>", { class: "wl-product-option-list" });
      let groupOptions = 0;

      optionIndexes.forEach((item, position) => {
        const rawOption = String(row[item.index] || "").trim();
        if (!rawOption) return;
        const parsed = optionParts(rawOption);
        const targetPid = parsed.productId;
        const label = parsed.label || rawOption;
        const isActive = targetPid && targetPid === currentPid;

        if (optionType === "text") {
          if (!targetPid) return;
          const $link = optionAttributes(
            $("<a>", {
              href: "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=" + encodeURIComponent(targetPid),
              text: label,
              class: "wl-product-option-chip"
            }),
            "text",
            label,
            targetPid
          );
          if (isActive) {
            $link.addClass("is-active").attr("aria-current", "true").on("click", function (event) {
              event.preventDefault();
            });
          }
          $link.appendTo($options);
          groupOptions += 1;
        } else if (optionType === "image") {
          if (!targetPid) return;
          const imageIndex = lowerHeader.indexOf("o" + (position + 1) + "imglink");
          const imageUrl = imageIndex >= 0 ? String(row[imageIndex] || "").trim() : "";
          if (!imageUrl) return;
          const $link = optionAttributes(
            $("<a>", {
              href: "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=" + encodeURIComponent(targetPid),
              title: label,
              class: "wl-product-option-image"
            }),
            "image",
            label,
            targetPid
          );
          if (isActive) $link.addClass("is-active").attr("aria-current", "true");
          $("<img>", { src: imageUrl, alt: label, loading: "lazy" }).appendTo($link);
          $link.appendTo($options);
          groupOptions += 1;
        } else if (optionType === "uom") {
          const numericValue = (label.match(/\d+(?:\.\d+)?/) || [])[0] || "";
          if (!numericValue) return;
          optionAttributes(
            $("<button>", {
              type: "button",
              text: label,
              class: "wl-product-option-chip wl-product-uom-option"
            }),
            "uom",
            numericValue,
            ""
          ).on("click", function () {
            const $quantity = $("#" + inputId);
            if (!$quantity.length) return;
            $quantity.val(numericValue).trigger("input").trigger("change");
          }).appendTo($options);
          groupOptions += 1;
        }
      });

      if (groupOptions) {
        $group.append($options).appendTo($container);
        optionCount += groupOptions;
        groupCount += 1;
      }
    });

    if (!optionCount) {
      publishOptions("ready", 0, 0);
      return;
    }

    const $target = $("#product-options-column");
    if ($target.length) $target.empty().append($container);
    else $("#ctl00_PageBody_productDetail_productDescription").before($container);
    publishOptions("ready", optionCount, groupCount);
  }

  const cached = cachedSheet();
  if (cached) {
    renderOptions(cached);
    return;
  }

  publishOptions("loading", 0, 0);
  $.ajax({
    url: sheetUrl,
    method: "GET",
    dataType: "text",
    cache: true,
    timeout: 15000
  }).done(function (data) {
    rememberSheet(data);
    renderOptions(data);
  }).fail(function () {
    publishOptions("error", 0, 0);
  });
});
