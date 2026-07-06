(function (root, factory) {
  "use strict";

  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WLAddressManager = api;
})(typeof window !== "undefined" ? window : null, function (win) {
  "use strict";

  var doc = win && win.document;
  var RETURN_KEY = "wl_address_return_path";
  var DEFAULT_IDS_KEY = "wl_default_address_oids";
  var STYLE_ID = "wl-address-management-styles";

  function clean(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function isDefaultAddressCode(code) {
    return clean(code).toUpperCase() === "MAIN";
  }

  function isDefaultAddressMeta(typeTitle, code) {
    return clean(typeTitle).toLowerCase() === "default address" || isDefaultAddressCode(code);
  }

  function pathName() {
    return win && win.location ? win.location.pathname.toLowerCase() : "";
  }

  function create(tag, className, text) {
    var el = doc.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  }

  function icon(name) {
    var el = create("span", "fa fa-" + name);
    el.setAttribute("aria-hidden", "true");
    return el;
  }

  function safeSessionGet(key) {
    try { return win.sessionStorage.getItem(key) || ""; } catch (_) { return ""; }
  }

  function safeSessionSet(key, value) {
    try { win.sessionStorage.setItem(key, value); } catch (_) {}
  }

  function defaultAddressIds() {
    try {
      var parsed = JSON.parse(safeSessionGet(DEFAULT_IDS_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch (_) {
      return [];
    }
  }

  function saveDefaultAddressIds(ids) {
    safeSessionSet(DEFAULT_IDS_KEY, JSON.stringify(ids.map(String)));
  }

  function addressOid(href) {
    try {
      return new URL(href, win.location.href).searchParams.get("oid") || "";
    } catch (_) {
      var match = String(href || "").match(/[?&]oid=([^&]+)/i);
      return match ? decodeURIComponent(match[1]) : "";
    }
  }

  function injectStyles() {
    if (!doc || doc.getElementById(STYLE_ID)) return;

    var style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      ":root{--wl-maroon:#6b0016;--wl-maroon-dark:#4f0010;--wl-border:#d8dadd;--wl-muted:#62666b;--wl-soft:#f5f6f7;--wl-yellow:#ffc72c;}",
      ".wl-address-page{font-family:Arial,sans-serif;color:#1e1f21;}",
      ".wl-address-shell{max-width:1120px;margin:18px auto 32px;padding:0 18px;box-sizing:border-box;}",
      ".wl-address-page-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px;}",
      ".wl-address-page-header h1{margin:0 0 5px;font-size:28px;line-height:1.2;letter-spacing:0;color:#1e1f21;}",
      ".wl-address-page-header p{margin:0;color:var(--wl-muted);font-size:15px;line-height:1.45;}",
      ".wl-address-primary,.wl-address-secondary,.wl-address-link-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:9px 14px;border:1px solid transparent;border-radius:6px;font-size:14px;font-weight:700;line-height:1.2;text-decoration:none!important;cursor:pointer;box-sizing:border-box;}",
      ".wl-address-primary{background:var(--wl-maroon);color:#fff!important;}",
      ".wl-address-primary:hover{background:var(--wl-maroon-dark);color:#fff!important;}",
      ".wl-address-secondary,.wl-address-link-button{background:#fff;color:var(--wl-maroon)!important;border-color:#b9bdc2;}",
      ".wl-address-secondary:hover,.wl-address-link-button:hover{background:#f7f1f2;color:var(--wl-maroon)!important;border-color:var(--wl-maroon);}",
      ".wl-address-return{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 16px;padding:12px 14px;border-left:4px solid var(--wl-maroon);background:#f8f3f4;}",
      ".wl-address-return strong{display:block;margin-bottom:2px;font-size:14px;}",
      ".wl-address-return span{font-size:13px;color:var(--wl-muted);}",
      ".wl-address-toolbar{display:flex;align-items:center;gap:12px;margin-bottom:16px;}",
      ".wl-address-search-wrap{position:relative;flex:1 1 420px;max-width:620px;}",
      ".wl-address-search-wrap .fa{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#73777c;pointer-events:none;}",
      ".wl-address-search{width:100%;height:44px;padding:9px 42px;border:1px solid #aeb2b7;border-radius:6px;background:#fff;color:#1f2022;font-size:16px;box-sizing:border-box;}",
      ".wl-address-search:focus{outline:3px solid rgba(107,0,22,.14);border-color:var(--wl-maroon);}",
      ".wl-address-count{white-space:nowrap;color:var(--wl-muted);font-size:14px;}",
      ".wl-address-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;}",
      ".wl-address-card{position:relative;display:flex;flex-direction:column;min-width:0;padding:17px;border:1px solid var(--wl-border);border-radius:8px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.04);}",
      ".wl-address-card.is-default{border-color:var(--wl-maroon);box-shadow:inset 4px 0 0 var(--wl-maroon),0 2px 8px rgba(0,0,0,.04);}",
      ".wl-address-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px;}",
      ".wl-address-code{margin:0;font-size:18px;font-weight:800;color:#202124;letter-spacing:0;overflow-wrap:anywhere;}",
      ".wl-address-badge{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;padding:5px 8px;border-radius:4px;background:#f2e8ea;color:var(--wl-maroon);font-size:12px;font-weight:800;}",
      ".wl-address-location{margin:0 0 8px;font-size:15px;line-height:1.45;color:#303236;overflow-wrap:anywhere;}",
      ".wl-address-meta{display:flex;flex-wrap:wrap;gap:8px 16px;margin:0 0 14px;color:var(--wl-muted);font-size:13px;}",
      ".wl-address-meta a{color:var(--wl-maroon);text-decoration:none;font-weight:700;}",
      ".wl-address-card-actions{display:flex;align-items:center;gap:9px;margin-top:auto;padding-top:4px;}",
      ".wl-address-protected-note{margin:0;color:var(--wl-muted);font-size:12px;line-height:1.35;}",
      ".wl-address-empty{display:none;padding:28px;border:1px dashed #b7bbc0;text-align:center;color:var(--wl-muted);background:#fafafa;}",
      "body.wl-address-list-page #ctl00_PageBody_AddressRadGrid,body.wl-address-list-page #ctl00_PageBody_AddButtonLink{display:none!important;}",
      ".wl-address-detail-shell{max-width:1040px;margin:18px auto 34px;padding:0 18px;box-sizing:border-box;}",
      ".wl-address-lock-banner{display:flex;align-items:flex-start;gap:12px;margin:0 0 18px;padding:15px 16px;border-left:5px solid var(--wl-maroon);background:#f7f1f2;color:#242527;}",
      ".wl-address-lock-banner .fa{margin-top:2px;color:var(--wl-maroon);font-size:18px;}",
      ".wl-address-lock-banner strong{display:block;margin-bottom:3px;font-size:15px;}",
      ".wl-address-lock-banner p{margin:0;color:#55595e;font-size:14px;line-height:1.45;}",
      "body.wl-address-detail-page .epi-form-col-single-address{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px 18px;max-width:1040px!important;margin:0 auto!important;padding:20px!important;border:1px solid var(--wl-border);border-radius:8px;background:#fff;box-sizing:border-box;}",
      "body.wl-address-detail-page .epi-form-group-address{min-width:0;margin:0!important;}",
      "body.wl-address-detail-page .epi-form-group-address>label{display:block;margin:0 0 6px!important;color:#303236;font-size:13px!important;font-weight:700!important;}",
      "body.wl-address-detail-page .epi-form-group-address .form-control{width:100%!important;min-height:42px!important;padding:9px 10px!important;border:1px solid #afb3b8!important;border-radius:5px!important;background:#fff!important;color:#202124!important;font-size:15px!important;box-sizing:border-box!important;}",
      "body.wl-address-detail-page .epi-form-group-address .form-control:focus{outline:3px solid rgba(107,0,22,.14)!important;border-color:var(--wl-maroon)!important;box-shadow:none!important;}",
      "body.wl-address-detail-page .wl-address-field-full{grid-column:1/-1;}",
      "body.wl-address-detail-page .wl-address-internal-field{display:none!important;}",
      "body.wl-address-detail-page .submit-button-panel{grid-column:1/-1;display:flex!important;justify-content:flex-end;gap:10px;margin:4px 0 0!important;padding:16px 0 0!important;border-top:1px solid #e1e3e5;}",
      "body.wl-address-detail-page .submit-button-panel .epi-button{min-height:42px!important;padding:9px 16px!important;border-radius:6px!important;font-weight:700!important;}",
      "body.wl-address-detail-page #ctl00_PageBody_cmdSave{background:var(--wl-maroon)!important;border-color:var(--wl-maroon)!important;color:#fff!important;}",
      "body.wl-address-detail-page #ctl00_PageBody_cmdCancel{background:#fff!important;border:1px solid #aeb2b7!important;color:#333!important;}",
      "body.wl-address-detail-page.wl-default-address-locked .form-control:disabled{opacity:1!important;background:#f2f3f4!important;color:#45484c!important;-webkit-text-fill-color:#45484c!important;cursor:not-allowed;}",
      "body.wl-address-detail-page.wl-default-address-locked #ctl00_PageBody_cmdSave{display:none!important;}",
      ".wl-address-detail-actions{display:flex;justify-content:flex-end;margin-top:14px;}",
      ".wl-checkout-address-tools{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 2px;}",
      ".wl-checkout-address-tools .wl-address-link-button{min-height:38px;padding:7px 11px;font-size:13px;}",
      "@media(max-width:760px){.wl-address-shell,.wl-address-detail-shell{padding:0 12px;}.wl-address-page-header{display:block;}.wl-address-page-header .wl-address-primary{margin-top:14px;width:100%;}.wl-address-toolbar{align-items:stretch;flex-direction:column;}.wl-address-search-wrap{flex-basis:auto;max-width:none;}.wl-address-count{white-space:normal;}.wl-address-grid{grid-template-columns:1fr;}.wl-address-return{align-items:stretch;flex-direction:column;}.wl-address-return .wl-address-secondary{width:100%;}body.wl-address-detail-page .epi-form-col-single-address{grid-template-columns:1fr!important;padding:15px!important;}body.wl-address-detail-page .wl-address-field-full{grid-column:1;}.wl-address-card-actions{align-items:stretch;flex-direction:column;}.wl-address-card-actions .wl-address-secondary{width:100%;}.wl-address-detail-actions .wl-address-secondary{width:100%;}}"
    ].join("");
    doc.head.appendChild(style);
  }

  function rowData(row) {
    var cells = row && row.cells ? Array.prototype.slice.call(row.cells) : [];
    if (!cells.length) return null;

    var codeLink = cells[0] && cells[0].querySelector("a[href*='AddressDetails.aspx']");
    if (!codeLink) return null;

    var typeImage = cells[1] && cells[1].querySelector("img");
    var typeTitle = typeImage ? (typeImage.getAttribute("title") || typeImage.getAttribute("alt") || "") : "";
    var code = clean(codeLink.textContent);
    var href = codeLink.getAttribute("href") || "";

    return {
      code: code,
      href: href,
      oid: addressOid(href),
      isDefault: isDefaultAddressMeta(typeTitle, code),
      jobReference: clean(cells[2] && cells[2].textContent),
      address: clean(cells[3] && cells[3].textContent),
      telephone: clean(cells[4] && cells[4].textContent),
      telephoneHref: (cells[4] && cells[4].querySelector("a") && cells[4].querySelector("a").getAttribute("href")) || "",
      contact: clean(cells[6] && cells[6].textContent),
      contactTelephone: clean(cells[7] && cells[7].textContent)
    };
  }

  function buildAddressCard(data) {
    var article = create("article", "wl-address-card" + (data.isDefault ? " is-default" : ""));
    article.dataset.search = clean([
      data.code, data.address, data.telephone, data.jobReference, data.contact, data.contactTelephone
    ].join(" ")).toLowerCase();

    var top = create("div", "wl-address-card-top");
    var title = create("h2", "wl-address-code", data.code || "Saved address");
    top.appendChild(title);
    if (data.isDefault) {
      var badge = create("span", "wl-address-badge");
      badge.appendChild(icon("lock"));
      badge.appendChild(doc.createTextNode("Default - protected"));
      top.appendChild(badge);
    }
    article.appendChild(top);

    article.appendChild(create("p", "wl-address-location", data.address || "Address details unavailable"));

    var meta = create("div", "wl-address-meta");
    if (data.telephone) {
      var phone = create("a", "", data.telephone);
      phone.href = data.telephoneHref || ("tel:" + data.telephone.replace(/[^0-9+]/g, ""));
      phone.appendChild(doc.createTextNode(""));
      meta.appendChild(phone);
    }
    if (data.jobReference) meta.appendChild(create("span", "", "Job: " + data.jobReference));
    if (data.contact) meta.appendChild(create("span", "", "Contact: " + data.contact));
    article.appendChild(meta);

    var actions = create("div", "wl-address-card-actions");
    var action = create("a", "wl-address-secondary");
    action.href = data.href;
    action.appendChild(icon(data.isDefault ? "eye" : "pencil"));
    action.appendChild(doc.createTextNode(data.isDefault ? "View details" : "Edit address"));
    if (data.isDefault) {
      try {
        var u = new URL(action.href, win.location.href);
        u.searchParams.set("wlDefault", "1");
        action.href = u.pathname + u.search;
      } catch (_) {}
    }
    actions.appendChild(action);

    if (data.isDefault) {
      actions.appendChild(create("p", "wl-address-protected-note", "Contact Woodson Lumber to request changes."));
    }
    article.appendChild(actions);
    return article;
  }

  function returnToCheckoutBlock() {
    var returnPath = safeSessionGet(RETURN_KEY);
    if (!returnPath) return null;

    var block = create("div", "wl-address-return");
    var copy = create("div");
    copy.appendChild(create("strong", "", "Saved addresses"));
    copy.appendChild(create("span", "", "When you are finished, return to checkout and choose the address."));
    var link = create("a", "wl-address-secondary");
    link.href = returnPath;
    link.appendChild(icon("arrow-left"));
    link.appendChild(doc.createTextNode("Return to checkout"));
    link.addEventListener("click", function () {
      try { win.sessionStorage.removeItem(RETURN_KEY); } catch (_) {}
    });
    block.appendChild(copy);
    block.appendChild(link);
    return block;
  }

  function enhanceAddressList() {
    var table = doc.getElementById("ctl00_PageBody_AddressRadGrid_ctl00");
    if (!table || doc.querySelector(".wl-address-shell")) return false;

    var rows = Array.prototype.slice.call(table.querySelectorAll("tbody tr"));
    var addresses = rows.map(rowData).filter(Boolean);
    var defaultIds = addresses.filter(function (item) { return item.isDefault && item.oid; }).map(function (item) { return item.oid; });
    if (defaultIds.length) saveDefaultAddressIds(defaultIds);

    doc.body.classList.add("wl-address-page", "wl-address-list-page");
    var shell = create("main", "wl-address-shell");
    shell.setAttribute("aria-labelledby", "wl-address-title");

    var returning = returnToCheckoutBlock();
    if (returning) shell.appendChild(returning);

    var header = create("header", "wl-address-page-header");
    var headerCopy = create("div");
    var h1 = create("h1", "", "Saved Addresses");
    h1.id = "wl-address-title";
    headerCopy.appendChild(h1);
    headerCopy.appendChild(create("p", "", "Search and manage delivery locations for this account."));
    header.appendChild(headerCopy);

    var nativeAdd = doc.getElementById("ctl00_PageBody_AddButtonLink");
    var add = create("a", "wl-address-primary");
    add.href = nativeAdd ? nativeAdd.getAttribute("href") : "AddressDetails.aspx?oid=0&action=1";
    add.appendChild(icon("plus"));
    add.appendChild(doc.createTextNode("Add address"));
    header.appendChild(add);
    shell.appendChild(header);

    var toolbar = create("div", "wl-address-toolbar");
    var searchWrap = create("div", "wl-address-search-wrap");
    searchWrap.appendChild(icon("search"));
    var search = create("input", "wl-address-search");
    search.type = "search";
    search.placeholder = "Search by code, address, job, phone, or contact";
    search.setAttribute("aria-label", "Search saved addresses");
    searchWrap.appendChild(search);
    var count = create("div", "wl-address-count");
    count.setAttribute("aria-live", "polite");
    toolbar.appendChild(searchWrap);
    toolbar.appendChild(count);
    shell.appendChild(toolbar);

    var grid = create("div", "wl-address-grid");
    var cards = addresses.map(function (item) {
      var card = buildAddressCard(item);
      grid.appendChild(card);
      return card;
    });
    shell.appendChild(grid);

    var empty = create("div", "wl-address-empty", "No saved addresses match your search.");
    shell.appendChild(empty);

    function applyFilter() {
      var query = clean(search.value).toLowerCase();
      var shown = 0;
      cards.forEach(function (card) {
        var match = !query || (card.dataset.search || "").indexOf(query) !== -1;
        card.hidden = !match;
        if (match) shown++;
      });
      count.textContent = shown + " " + (shown === 1 ? "address" : "addresses");
      empty.style.display = shown ? "none" : "block";
    }

    search.addEventListener("input", applyFilter);
    applyFilter();

    var nativeRoot = doc.getElementById("ctl00_PageBody_AddressRadGrid") || table;
    nativeRoot.parentNode.insertBefore(shell, nativeRoot);
    return true;
  }

  function fieldGroup(id) {
    var field = doc.getElementById(id);
    return field && field.closest ? field.closest(".epi-form-group-address") : null;
  }

  function markFullWidth(id) {
    var group = fieldGroup(id);
    if (group) group.classList.add("wl-address-field-full");
  }

  function hideInternalField(id) {
    var group = fieldGroup(id);
    if (group) group.classList.add("wl-address-internal-field");
  }

  function isDefaultDetail() {
    var codeField = doc.getElementById("ctl00_PageBody_HiddenAddressCode") || doc.getElementById("ctl00_PageBody_addressCode");
    var code = codeField ? codeField.value : "";
    var oid = "";
    try { oid = new URL(win.location.href).searchParams.get("oid") || ""; } catch (_) {}
    var queryMarker = /(?:\?|&)wlDefault=1(?:&|$)/i.test(win.location.search || "");
    return queryMarker || defaultAddressIds().indexOf(String(oid)) !== -1 || isDefaultAddressCode(code);
  }

  function lockDefaultDetail(container) {
    doc.body.classList.add("wl-default-address-locked");
    var save = doc.getElementById("ctl00_PageBody_cmdSave");
    var form = save && save.form;

    function applyLock() {
      var controls = container.querySelectorAll("input,select,textarea,button");
      Array.prototype.forEach.call(controls, function (control) {
        if (control.id === "ctl00_PageBody_cmdCancel") return;
        control.disabled = true;
        control.setAttribute("aria-disabled", "true");
        if (control.tagName === "INPUT" || control.tagName === "TEXTAREA") control.readOnly = true;
      });
      if (save) {
        save.disabled = true;
        save.hidden = true;
        save.setAttribute("aria-hidden", "true");
      }
    }

    applyLock();
    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return false;
      }, true);
    }

    if (win.MutationObserver) {
      var observer = new win.MutationObserver(applyLock);
      observer.observe(container, { childList: true, subtree: true });
    }
  }

  function enhanceAddressDetail() {
    var codeField = doc.getElementById("ctl00_PageBody_addressCode");
    if (!codeField || doc.querySelector(".wl-address-detail-shell")) return false;

    var formGrid = codeField.closest(".epi-form-col-single-address");
    if (!formGrid) return false;

    var query = "";
    try { query = new URL(win.location.href).searchParams.get("action") || ""; } catch (_) {}
    var isNew = query === "1" || !clean(codeField.value);
    var isDefault = isDefaultDetail();

    doc.body.classList.add("wl-address-page", "wl-address-detail-page");

    [
      "ctl00_PageBody_addressLine1",
      "ctl00_PageBody_addressLine2",
      "ctl00_PageBody_addressLine3",
      "ctl00_PageBody_email",
      "ctl00_PageBody_webaddress"
    ].forEach(markFullWidth);

    [
      "ctl00_PageBody_DeliveryAreaDropDown",
      "ctl00_PageBody_CongestionCharge",
      "ctl00_PageBody_SalesRepDropDown",
      "ctl00_PageBody_SalesAreaDropDown"
    ].forEach(hideInternalField);

    var shell = create("div", "wl-address-detail-shell");
    var header = create("header", "wl-address-page-header");
    var headerCopy = create("div");
    var heading = create("h1", "", isDefault ? "Default Account Address" : (isNew ? "Add a Saved Address" : "Edit Saved Address"));
    headerCopy.appendChild(heading);
    headerCopy.appendChild(create("p", "", isDefault ? "Review the address maintained for this account." : "Keep delivery and contact information current for future orders."));
    header.appendChild(headerCopy);
    shell.appendChild(header);

    if (isDefault) {
      var banner = create("div", "wl-address-lock-banner");
      banner.setAttribute("role", "status");
      banner.appendChild(icon("lock"));
      var bannerCopy = create("div");
      bannerCopy.appendChild(create("strong", "", "This address is protected"));
      bannerCopy.appendChild(create("p", "", "The default account address can only be changed by Woodson Lumber. Contact us to request an update."));
      banner.appendChild(bannerCopy);
      shell.appendChild(banner);
    }

    formGrid.parentNode.insertBefore(shell, formGrid);
    shell.appendChild(formGrid);

    var nativeCancel = doc.getElementById("ctl00_PageBody_cmdCancel");
    if (nativeCancel) nativeCancel.style.display = "none";
    var detailActions = create("div", "wl-address-detail-actions");
    var back = create("a", "wl-address-secondary", "Back to addresses");
    back.href = "AddressList_R.aspx";
    detailActions.appendChild(back);
    shell.appendChild(detailActions);

    var placeSearch = doc.querySelector("input[placeholder*='address' i]");
    if (placeSearch && placeSearch !== codeField) {
      placeSearch.placeholder = "Start typing an address";
      if (isDefault) {
        placeSearch.disabled = true;
        placeSearch.setAttribute("aria-disabled", "true");
      }
    }

    if (isDefault) lockDefaultDetail(formGrid);
    return true;
  }

  function beginAddAddress() {
    safeSessionSet(RETURN_KEY, "/ShoppingCart.aspx");
  }

  function addCheckoutAddressTools() {
    var line1 = doc.getElementById("ctl00_PageBody_DeliveryAddress_AddressLine1");
    if (!line1 || doc.querySelector(".wl-checkout-address-tools")) return false;

    var target = null;
    var headings = doc.querySelectorAll(".wl-section-heading");
    Array.prototype.some.call(headings, function (heading) {
      var title = heading.querySelector(".wl-section-title");
      if (title && /delivery|shipping address/i.test(title.textContent || "")) {
        target = heading.parentElement;
        return true;
      }
      return false;
    });
    if (!target) target = line1.closest(".checkout-step") || line1.parentElement;
    if (!target) return false;

    var tools = create("div", "wl-checkout-address-tools");
    tools.setAttribute("aria-label", "Saved address actions");
    var selector = doc.getElementById("ctl00_PageBody_CustomerAddressSelector_PopupTrigger");
    if (selector) {
      var choose = create("button", "wl-address-link-button");
      choose.type = "button";
      choose.appendChild(icon("address-book"));
      choose.appendChild(doc.createTextNode("Choose saved address"));
      choose.addEventListener("click", function () { selector.click(); });
      tools.appendChild(choose);
    }

    var add = create("a", "wl-address-link-button");
    add.href = "/AddressDetails.aspx?oid=0&action=1&from=checkout";
    add.appendChild(icon("plus"));
    add.appendChild(doc.createTextNode("Add saved address"));
    add.addEventListener("click", beginAddAddress);
    tools.appendChild(add);

    var headingNode = target.querySelector(".wl-section-heading");
    if (headingNode && headingNode.nextSibling) target.insertBefore(tools, headingNode.nextSibling);
    else if (headingNode) target.appendChild(tools);
    else target.insertBefore(tools, target.firstChild);
    return true;
  }

  function observeCheckout() {
    if (addCheckoutAddressTools()) return;
    if (!win.MutationObserver) return;

    var observer = new win.MutationObserver(function () {
      if (addCheckoutAddressTools()) observer.disconnect();
    });
    observer.observe(doc.body, { childList: true, subtree: true });
    win.setTimeout(function () { observer.disconnect(); }, 15000);
  }

  function run() {
    if (!doc) return false;
    injectStyles();
    var path = pathName();
    if (/\/addresslist_r\.aspx$/.test(path)) return enhanceAddressList();
    if (/\/addressdetails\.aspx$/.test(path)) return enhanceAddressDetail();
    if (/\/shoppingcart\.aspx$/.test(path)) {
      doc.body.classList.add("wl-address-page");
      observeCheckout();
      return true;
    }
    return false;
  }

  if (doc) {
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", run, { once: true });
    else run();
  }

  return {
    clean: clean,
    isDefaultAddressCode: isDefaultAddressCode,
    isDefaultAddressMeta: isDefaultAddressMeta,
    addressOid: addressOid,
    run: run
  };
});
