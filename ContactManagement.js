(function (root, factory) {
  "use strict";

  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WLContactManager = api;
})(typeof window !== "undefined" ? window : null, function (win) {
  "use strict";

  var doc = win && win.document;
  var RETURN_KEY = "wl_contact_return_path";
  var CONTACT_PAYLOAD_KEY = "wl_checkout_contact_payload";
  var REQUEST_PREFILL_KEY = "wl_request_access_prefill_v1";
  var DEFAULT_CONTACT_IDS_KEY = "wl_default_contact_oids";
  var PORTAL_MANAGER_KEY = "wl_contact_portal_manager_v1";
  var STYLE_ID = "wl-contact-management-styles";

  function clean(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function emailKey(value) {
    return clean(value).toLowerCase();
  }

  function isDefaultContactValue(value) {
    var normalized = clean(value).toLowerCase();
    return normalized === "yes" || normalized === "true" || normalized === "1" || normalized === "default";
  }

  function isDefaultContactMeta(typeTitle, value) {
    return /default/i.test(clean(typeTitle)) || isDefaultContactValue(value);
  }

  function contactOid(href) {
    try {
      return new URL(href, win && win.location ? win.location.href : "https://webtrack.woodsonlumber.com/").searchParams.get("oid") || "";
    } catch (_) {
      var match = String(href || "").match(/[?&]oid=([^&]+)/i);
      return match ? decodeURIComponent(match[1]) : "";
    }
  }

  function splitDisplayName(value) {
    var parts = clean(value).split(" ").filter(Boolean);
    if (!parts.length) return { first: "", last: "" };
    if (parts.length === 1) return { first: parts[0], last: "" };
    return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
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

  function safeSessionRemove(key) {
    try { win.sessionStorage.removeItem(key); } catch (_) {}
  }

  function defaultContactIds() {
    try {
      var parsed = JSON.parse(safeSessionGet(DEFAULT_CONTACT_IDS_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch (_) {
      return [];
    }
  }

  function saveDefaultContactIds(ids) {
    safeSessionSet(DEFAULT_CONTACT_IDS_KEY, JSON.stringify(ids.map(String)));
  }

  function injectStyles() {
    if (!doc || doc.getElementById(STYLE_ID)) return;

    var style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      ":root{--wl-maroon:#6b0016;--wl-maroon-dark:#4f0010;--wl-border:#d8dadd;--wl-muted:#62666b;--wl-soft:#f5f6f7;--wl-yellow:#ffc72c;}",
      ".wl-contact-page{font-family:Arial,sans-serif;color:#1e1f21;}",
      ".wl-contact-shell{max-width:1120px;margin:18px auto 32px;padding:0 18px;box-sizing:border-box;}",
      ".wl-contact-page-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px;}",
      ".wl-contact-page-header h1{margin:0 0 5px;font-size:28px;line-height:1.2;letter-spacing:0;color:#1e1f21;}",
      ".wl-contact-page-header p{margin:0;color:var(--wl-muted);font-size:15px;line-height:1.45;}",
      ".wl-contact-primary,.wl-contact-secondary,.wl-contact-link-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:9px 14px;border:1px solid transparent;border-radius:6px;font-size:14px;font-weight:700;line-height:1.2;text-decoration:none!important;cursor:pointer;box-sizing:border-box;}",
      ".wl-contact-primary{background:var(--wl-maroon);color:#fff!important;}",
      ".wl-contact-primary:hover{background:var(--wl-maroon-dark);color:#fff!important;}",
      ".wl-contact-secondary,.wl-contact-link-button{background:#fff;color:var(--wl-maroon)!important;border-color:#b9bdc2;}",
      ".wl-contact-secondary:hover,.wl-contact-link-button:hover{background:#f7f1f2;color:var(--wl-maroon)!important;border-color:var(--wl-maroon);}",
      ".wl-contact-return{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 16px;padding:12px 14px;border-left:4px solid var(--wl-maroon);background:#f8f3f4;}",
      ".wl-contact-return strong{display:block;margin-bottom:2px;font-size:14px;}",
      ".wl-contact-return span{font-size:13px;color:var(--wl-muted);}",
      ".wl-contact-toolbar{display:flex;align-items:center;gap:12px;margin-bottom:16px;}",
      ".wl-contact-search-wrap{position:relative;flex:1 1 420px;max-width:620px;}",
      ".wl-contact-search-wrap .fa{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#73777c;pointer-events:none;}",
      ".wl-contact-search{width:100%;height:44px;padding:9px 42px;border:1px solid #aeb2b7;border-radius:6px;background:#fff;color:#1f2022;font-size:16px;box-sizing:border-box;}",
      ".wl-contact-search:focus{outline:3px solid rgba(107,0,22,.14);border-color:var(--wl-maroon);}",
      ".wl-contact-count{white-space:nowrap;color:var(--wl-muted);font-size:14px;}",
      ".wl-contact-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;}",
      ".wl-contact-card{position:relative;display:flex;flex-direction:column;min-width:0;padding:17px;border:1px solid var(--wl-border);border-radius:8px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.04);}",
      ".wl-contact-card.is-default{border-color:var(--wl-maroon);box-shadow:inset 4px 0 0 var(--wl-maroon),0 2px 8px rgba(0,0,0,.04);}",
      ".wl-contact-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px;}",
      ".wl-contact-name{margin:0;font-size:18px;font-weight:800;color:#202124;letter-spacing:0;overflow-wrap:anywhere;}",
      ".wl-contact-badge{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;padding:5px 8px;border-radius:4px;background:#f2e8ea;color:var(--wl-maroon);font-size:12px;font-weight:800;}",
      ".wl-contact-lines{margin:0 0 8px;font-size:15px;line-height:1.45;color:#303236;overflow-wrap:anywhere;}",
      ".wl-contact-meta{display:flex;flex-wrap:wrap;gap:8px 16px;margin:0 0 14px;color:var(--wl-muted);font-size:13px;}",
      ".wl-contact-meta a{color:var(--wl-maroon);text-decoration:none;font-weight:700;}",
      ".wl-contact-card-actions{display:flex;flex-wrap:wrap;align-items:center;gap:9px;margin-top:auto;padding-top:4px;}",
      ".wl-contact-protected-note{margin:0;color:var(--wl-muted);font-size:12px;line-height:1.35;}",
      ".wl-contact-empty{display:none;padding:28px;border:1px dashed #b7bbc0;text-align:center;color:var(--wl-muted);background:#fafafa;}",
      "body.wl-contact-list-page #ctl00_PageBody_ContactsGrid,body.wl-contact-list-page #ctl00_PageBody_AddNewItem{display:none!important;}",
      "body.wl-contact-list-page .wl-contact-legacy-control{display:none!important;}",
      ".wl-contact-detail-shell{max-width:1040px;margin:18px auto 34px;padding:0 18px;box-sizing:border-box;}",
      ".wl-contact-lock-banner{display:flex;align-items:flex-start;gap:12px;margin:0 0 18px;padding:15px 16px;border-left:5px solid var(--wl-maroon);background:#f7f1f2;color:#242527;}",
      ".wl-contact-lock-banner .fa{margin-top:2px;color:var(--wl-maroon);font-size:18px;}",
      ".wl-contact-lock-banner strong{display:block;margin-bottom:3px;font-size:15px;}",
      ".wl-contact-lock-banner p{margin:0;color:#55595e;font-size:14px;line-height:1.45;}",
      "body.wl-contact-detail-page .wl-contact-form-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px 18px;max-width:1040px!important;margin:0 auto!important;padding:20px!important;border:1px solid var(--wl-border);border-radius:8px;background:#fff;box-sizing:border-box;}",
      "body.wl-contact-detail-page .wl-contact-native-empty{display:none!important;}",
      "body.wl-contact-detail-page .epi-form-group-contact{min-width:0;margin:0!important;}",
      "body.wl-contact-detail-page .epi-form-group-contact>label{display:block;margin:0 0 6px!important;color:#303236;font-size:13px!important;font-weight:700!important;}",
      "body.wl-contact-detail-page .epi-form-group-contact .form-control{width:100%!important;min-height:42px!important;padding:9px 10px!important;border:1px solid #afb3b8!important;border-radius:5px!important;background:#fff!important;color:#202124!important;font-size:15px!important;box-sizing:border-box!important;}",
      "body.wl-contact-detail-page .epi-form-group-contact .form-control:focus{outline:3px solid rgba(107,0,22,.14)!important;border-color:var(--wl-maroon)!important;box-shadow:none!important;}",
      "body.wl-contact-detail-page .wl-contact-field-full{grid-column:1/-1;}",
      "body.wl-contact-detail-page .wl-contact-notification-field{padding:10px 12px!important;border:1px solid #eceeef;border-radius:6px;background:#fafafa;}",
      "body.wl-contact-detail-page .submit-button-panel{grid-column:1/-1;display:flex!important;justify-content:flex-end;gap:10px;margin:4px 0 0!important;padding:16px 0 0!important;border-top:1px solid #e1e3e5;}",
      "body.wl-contact-detail-page .submit-button-panel .epi-button{min-height:42px!important;padding:9px 16px!important;border-radius:6px!important;font-weight:700!important;}",
      "body.wl-contact-detail-page #ctl00_PageBody_SaveContactDetails{background:var(--wl-maroon)!important;border-color:var(--wl-maroon)!important;color:#fff!important;}",
      "body.wl-contact-detail-page #ctl00_PageBody_CancelContactDetails{background:#fff!important;border:1px solid #aeb2b7!important;color:#333!important;}",
      "body.wl-contact-detail-page.wl-default-contact-locked #ctl00_PageBody_ContactDefaultDropDown{opacity:1!important;background:#f2f3f4!important;color:#45484c!important;-webkit-text-fill-color:#45484c!important;cursor:not-allowed;}",
      ".wl-contact-detail-actions{display:flex;justify-content:space-between;gap:10px;margin-top:14px;}",
      ".wl-contact-request-panel{grid-column:1/-1;margin:4px 0 0;padding:12px 13px;border:1px solid #e1e3e5;border-left:4px solid var(--wl-maroon);border-radius:6px;background:#fafafa;}",
      ".wl-contact-request-panel strong{display:block;margin-bottom:4px;font-size:14px;}",
      ".wl-contact-request-panel p{margin:0 0 10px;color:var(--wl-muted);font-size:13px;line-height:1.4;}",
      "@media(max-width:760px){.wl-contact-shell,.wl-contact-detail-shell{padding:0 12px;}.wl-contact-page-header{display:block;}.wl-contact-page-header .wl-contact-primary{margin-top:14px;width:100%;}.wl-contact-toolbar{align-items:stretch;flex-direction:column;}.wl-contact-search-wrap{flex-basis:auto;max-width:none;}.wl-contact-count{white-space:normal;}.wl-contact-grid{grid-template-columns:1fr;}.wl-contact-return{align-items:stretch;flex-direction:column;}.wl-contact-return .wl-contact-secondary{width:100%;}.wl-contact-card-actions{align-items:stretch;flex-direction:column;}.wl-contact-card-actions .wl-contact-secondary{width:100%;}body.wl-contact-detail-page .wl-contact-form-grid{grid-template-columns:1fr!important;padding:15px!important;}body.wl-contact-detail-page .wl-contact-field-full{grid-column:1;}.wl-contact-detail-actions{flex-direction:column;}.wl-contact-detail-actions .wl-contact-secondary{width:100%;}}"
    ].join("");
    doc.head.appendChild(style);
  }

  function selectedText(select) {
    if (!select) return "";
    var option = select.selectedOptions && select.selectedOptions[0];
    return clean(option ? option.textContent : select.value);
  }

  function rowData(row) {
    var cells = row && row.cells ? Array.prototype.slice.call(row.cells) : [];
    if (!cells.length) return null;

    var nameLink = cells[1] && cells[1].querySelector("a[href*='ContactDetails']");
    if (!nameLink) return null;

    var typeImage = cells[0] && cells[0].querySelector("img");
    var typeTitle = typeImage ? (typeImage.getAttribute("title") || typeImage.getAttribute("alt") || "") : "";
    var displayName = clean(nameLink.textContent);
    var nameParts = splitDisplayName(displayName);
    var href = nameLink.getAttribute("href") || "";
    var oid = contactOid(href);

    return {
      displayName: displayName,
      firstName: nameParts.first,
      lastName: nameParts.last,
      href: href,
      oid: oid,
      isDefault: isDefaultContactMeta(typeTitle, ""),
      salutation: clean(cells[2] && cells[2].textContent),
      telephone: clean(cells[3] && cells[3].textContent),
      fax: clean(cells[4] && cells[4].textContent),
      email: clean(cells[5] && cells[5].textContent),
      webAddress: clean(cells[6] && cells[6].textContent)
    };
  }

  function contactPayloadFromData(data) {
    return {
      ts: Date.now(),
      oid: data.oid || "",
      displayName: data.displayName || [data.firstName, data.lastName].filter(Boolean).join(" "),
      firstName: data.firstName || splitDisplayName(data.displayName).first,
      lastName: data.lastName || splitDisplayName(data.displayName).last,
      email: data.email || "",
      telephone: data.telephone || "",
      mobile: data.mobile || ""
    };
  }

  function storeContactPayload(data) {
    safeSessionSet(CONTACT_PAYLOAD_KEY, JSON.stringify(contactPayloadFromData(data)));
  }

  function requestPrefillPayload(data, signedInEmail) {
    return {
      ts: Date.now(),
      source: "contact-management",
      requestedBy: signedInEmail || "",
      firstName: data.firstName || splitDisplayName(data.displayName).first,
      lastName: data.lastName || splitDisplayName(data.displayName).last,
      displayName: data.displayName || [data.firstName, data.lastName].filter(Boolean).join(" "),
      email: data.email || "",
      phone: data.telephone || data.mobile || ""
    };
  }

  function portalManagerState() {
    try {
      var parsed = JSON.parse(safeSessionGet(PORTAL_MANAGER_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function savePortalManagerState(value) {
    safeSessionSet(PORTAL_MANAGER_KEY, JSON.stringify(value || {}));
  }

  function getSignedInEmail() {
    var cached = portalManagerState();
    if (cached.email && Date.now() - (cached.ts || 0) < 10 * 60 * 1000) return Promise.resolve(cached.email);
    return fetch("/AccountSettings.aspx", { credentials: "same-origin" })
      .then(function (res) { return res.text(); })
      .then(function (html) {
        var parsed = new DOMParser().parseFromString(html, "text/html");
        var input = parsed.getElementById("ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput");
        var email = emailKey(input && input.value);
        savePortalManagerState(Object.assign({}, cached, { email: email, ts: Date.now() }));
        return email;
      })
      .catch(function () { return cached.email || ""; });
  }

  function findCurrentUserContact(signedInEmail) {
    if (!signedInEmail) return Promise.resolve(null);
    return fetch("/Contacts_r.aspx", { credentials: "same-origin" })
      .then(function (res) { return res.text(); })
      .then(function (html) {
        var parsed = new DOMParser().parseFromString(html, "text/html");
        var table = parsed.getElementById("ctl00_PageBody_ContactsGrid_ctl00");
        var rows = table ? Array.prototype.slice.call(table.querySelectorAll("tbody tr")) : [];
        var match = null;
        rows.some(function (row) {
          var item = rowData.call({ document: parsed }, row);
          if (item && emailKey(item.email) === signedInEmail) {
            match = item;
            return true;
          }
          return false;
        });
        return match;
      })
      .catch(function () { return null; });
  }

  function fetchContactDefault(item) {
    if (!item || !item.href) return Promise.resolve(false);
    if (item.isDefault) return Promise.resolve(true);
    return fetch(item.href, { credentials: "same-origin" })
      .then(function (res) { return res.text(); })
      .then(function (html) {
        var parsed = new DOMParser().parseFromString(html, "text/html");
        var dropdown = parsed.getElementById("ctl00_PageBody_ContactDefaultDropDown");
        return isDefaultContactValue(dropdown && dropdown.value);
      })
      .catch(function () { return false; });
  }

  function currentUserCanRequestAccess() {
    var cached = portalManagerState();
    if (cached.checked && Date.now() - (cached.ts || 0) < 10 * 60 * 1000) return Promise.resolve(!!cached.canRequest);

    return getSignedInEmail().then(function (signedInEmail) {
      return findCurrentUserContact(signedInEmail).then(function (contact) {
        return fetchContactDefault(contact).then(function (isDefault) {
          savePortalManagerState({
            checked: true,
            canRequest: !!(signedInEmail && contact && isDefault),
            email: signedInEmail,
            contactOid: contact && contact.oid || "",
            ts: Date.now()
          });
          return !!(signedInEmail && contact && isDefault);
        });
      });
    });
  }

  function addPortalRequestAction(host, data) {
    if (!host || !data || !data.email || emailKey(data.email) === emailKey(portalManagerState().email)) return;
    if (host.querySelector(".wl-contact-request-access")) return;

    currentUserCanRequestAccess().then(function (allowed) {
      if (!allowed || !host.isConnected) return;
      var signedInEmail = portalManagerState().email || "";
      if (emailKey(data.email) === emailKey(signedInEmail)) return;
      var action = create("a", "wl-contact-secondary wl-contact-request-access");
      action.href = "/UserSignup.aspx?existing=1&from=contact";
      action.appendChild(icon("user-plus"));
      action.appendChild(doc.createTextNode("Request portal access"));
      action.addEventListener("click", function () {
        safeSessionSet(REQUEST_PREFILL_KEY, JSON.stringify(requestPrefillPayload(data, signedInEmail)));
      });
      host.appendChild(action);
    });
  }

  function returnToSourceBlock() {
    var returnPath = safeSessionGet(RETURN_KEY);
    if (!returnPath) return null;

    var block = create("div", "wl-contact-return");
    var copy = create("div");
    copy.appendChild(create("strong", "", "Saved contacts"));
    copy.appendChild(create("span", "", "When you are finished, return to the page you were working on."));
    var link = create("a", "wl-contact-secondary");
    link.href = returnPath;
    link.appendChild(icon("arrow-left"));
    link.appendChild(doc.createTextNode(/ShoppingCart/i.test(returnPath) ? "Return to checkout" : "Return to previous page"));
    link.addEventListener("click", function () {
      safeSessionRemove(RETURN_KEY);
    });
    block.appendChild(copy);
    block.appendChild(link);
    return block;
  }

  function buildContactCard(data) {
    var article = create("article", "wl-contact-card" + (data.isDefault ? " is-default" : ""));
    article.dataset.search = clean([
      data.displayName, data.salutation, data.telephone, data.email, data.webAddress
    ].join(" ")).toLowerCase();

    var top = create("div", "wl-contact-card-top");
    var title = create("h2", "wl-contact-name", data.displayName || "Saved contact");
    top.appendChild(title);
    if (data.isDefault) {
      var badge = create("span", "wl-contact-badge");
      badge.appendChild(icon("lock"));
      badge.appendChild(doc.createTextNode("Default"));
      top.appendChild(badge);
    }
    article.appendChild(top);

    var lines = create("p", "wl-contact-lines");
    lines.textContent = [data.salutation, data.telephone].filter(Boolean).join(" - ") || "Contact details";
    article.appendChild(lines);

    var meta = create("div", "wl-contact-meta");
    if (data.email) {
      var email = create("a", "", data.email);
      email.href = "mailto:" + data.email;
      meta.appendChild(email);
    }
    if (data.webAddress) meta.appendChild(create("span", "", data.webAddress));
    article.appendChild(meta);

    var actions = create("div", "wl-contact-card-actions");
    var action = create("a", "wl-contact-secondary");
    action.href = data.href;
    action.appendChild(icon("pencil"));
    action.appendChild(doc.createTextNode("Edit contact"));
    actions.appendChild(action);

    if (safeSessionGet(RETURN_KEY)) {
      var use = create("a", "wl-contact-secondary");
      use.href = safeSessionGet(RETURN_KEY);
      use.appendChild(icon("check"));
      use.appendChild(doc.createTextNode("Use this contact"));
      use.addEventListener("click", function () {
        storeContactPayload(data);
        safeSessionRemove(RETURN_KEY);
      });
      actions.appendChild(use);
    }

    if (data.isDefault) {
      actions.appendChild(create("p", "wl-contact-protected-note", "Default contacts can only be removed by Woodson Lumber."));
    } else {
      addPortalRequestAction(actions, data);
    }
    article.appendChild(actions);
    return article;
  }

  function enhanceContactList() {
    var table = doc.getElementById("ctl00_PageBody_ContactsGrid_ctl00");
    if (!table || doc.querySelector(".wl-contact-shell")) return false;

    var rows = Array.prototype.slice.call(table.querySelectorAll("tbody tr"));
    var contacts = rows.map(rowData).filter(Boolean);
    var storedDefaults = defaultContactIds();
    contacts.forEach(function (item) {
      if (storedDefaults.indexOf(String(item.oid)) !== -1) item.isDefault = true;
    });
    var defaultIds = contacts.filter(function (item) { return item.isDefault && item.oid; }).map(function (item) { return item.oid; });
    if (defaultIds.length) saveDefaultContactIds(defaultIds);

    doc.body.classList.add("wl-contact-page", "wl-contact-list-page");
    var shell = create("main", "wl-contact-shell");
    shell.setAttribute("aria-labelledby", "wl-contact-title");

    var returning = returnToSourceBlock();
    if (returning) shell.appendChild(returning);

    var header = create("header", "wl-contact-page-header");
    var headerCopy = create("div");
    var h1 = create("h1", "", "Account Contacts");
    h1.id = "wl-contact-title";
    headerCopy.appendChild(h1);
    headerCopy.appendChild(create("p", "", "Search and manage the people connected to this account."));
    header.appendChild(headerCopy);

    var add = create("a", "wl-contact-primary");
    var addUrl = "/ContactDetails_r.aspx?oid=0&action=1";
    if (safeSessionGet(RETURN_KEY)) {
      addUrl += (/ShoppingCart/i.test(safeSessionGet(RETURN_KEY)) ? "&from=checkout" : "&from=return");
    }
    add.href = addUrl;
    add.appendChild(icon("plus"));
    add.appendChild(doc.createTextNode("Add contact"));
    add.addEventListener("click", function () {
      if (safeSessionGet(RETURN_KEY)) safeSessionSet(RETURN_KEY, safeSessionGet(RETURN_KEY));
    });
    header.appendChild(add);
    shell.appendChild(header);

    var toolbar = create("div", "wl-contact-toolbar");
    var searchWrap = create("div", "wl-contact-search-wrap");
    searchWrap.appendChild(icon("search"));
    var search = create("input", "wl-contact-search");
    search.type = "search";
    search.placeholder = "Search by name, phone, email, or web address";
    search.setAttribute("aria-label", "Search account contacts");
    searchWrap.appendChild(search);
    var count = create("div", "wl-contact-count");
    count.setAttribute("aria-live", "polite");
    toolbar.appendChild(searchWrap);
    toolbar.appendChild(count);
    shell.appendChild(toolbar);

    var grid = create("div", "wl-contact-grid");
    var cards = contacts.map(function (item) {
      var card = buildContactCard(item);
      grid.appendChild(card);
      return card;
    });
    shell.appendChild(grid);

    var empty = create("div", "wl-contact-empty", "No contacts match your search.");
    shell.appendChild(empty);

    function applyFilter() {
      var query = clean(search.value).toLowerCase();
      var shown = 0;
      cards.forEach(function (card) {
        var match = !query || (card.dataset.search || "").indexOf(query) !== -1;
        card.hidden = !match;
        if (match) shown++;
      });
      count.textContent = shown + " " + (shown === 1 ? "contact" : "contacts");
      empty.style.display = shown ? "none" : "block";
    }

    search.addEventListener("input", applyFilter);
    applyFilter();

    var nativeRoot = doc.getElementById("ctl00_PageBody_ContactsGrid") || table;
    nativeRoot.parentNode.insertBefore(shell, nativeRoot);
    var gridItem = nativeRoot.parentElement;
    var pageContainer = gridItem && gridItem.parentElement;
    if (pageContainer) {
      Array.prototype.forEach.call(pageContainer.children, function (child) {
        if (child !== gridItem) child.classList.add("wl-contact-legacy-control");
      });
    }
    return true;
  }

  function fieldGroup(id) {
    var field = doc.getElementById(id);
    return field && field.closest ? field.closest(".epi-form-group-contact") : null;
  }

  function markFullWidth(id) {
    var group = fieldGroup(id);
    if (group) group.classList.add("wl-contact-field-full");
  }

  function markNotificationField(id) {
    var group = fieldGroup(id);
    if (group) group.classList.add("wl-contact-notification-field");
  }

  function isDefaultDetail() {
    var dropdown = doc.getElementById("ctl00_PageBody_ContactDefaultDropDown");
    var oid = "";
    try { oid = new URL(win.location.href).searchParams.get("oid") || ""; } catch (_) {}
    return isDefaultContactValue(dropdown && dropdown.value) || defaultContactIds().indexOf(String(oid)) !== -1;
  }

  function contactDataFromDetail() {
    var first = doc.getElementById("ctl00_PageBody_ContactFirstName");
    var last = doc.getElementById("ctl00_PageBody_ContactLastName");
    var display = doc.getElementById("ctl00_PageBody_ContactDisplayNameDropDown");
    var email = doc.getElementById("ctl00_PageBody_ContactEmail");
    var telephone = doc.getElementById("ctl00_PageBody_ContactTelephone");
    var mobile = doc.getElementById("ctl00_PageBody_ContactMobile");
    var oid = doc.getElementById("ctl00_PageBody_HiddenContactID");
    var displayName = selectedText(display) || [clean(first && first.value), clean(last && last.value)].filter(Boolean).join(" ");
    return {
      oid: clean(oid && oid.value),
      displayName: displayName,
      firstName: clean(first && first.value) || splitDisplayName(displayName).first,
      lastName: clean(last && last.value) || splitDisplayName(displayName).last,
      email: clean(email && email.value),
      telephone: clean(telephone && telephone.value),
      mobile: clean(mobile && mobile.value)
    };
  }

  function captureReturnContact() {
    if (!safeSessionGet(RETURN_KEY) && !/[?&]from=(checkout|address|return)\b/i.test(win.location.search || "")) return;
    storeContactPayload(contactDataFromDetail());
  }

  function lockDefaultRemoval() {
    doc.body.classList.add("wl-default-contact-locked");
    var dropdown = doc.getElementById("ctl00_PageBody_ContactDefaultDropDown");
    if (!dropdown) return;
    dropdown.disabled = true;
    dropdown.setAttribute("aria-disabled", "true");
    var hidden = doc.createElement("input");
    hidden.type = "hidden";
    hidden.name = dropdown.name;
    hidden.value = dropdown.value;
    dropdown.parentNode.insertBefore(hidden, dropdown.nextSibling);
  }

  function enhanceContactDetail() {
    var firstName = doc.getElementById("ctl00_PageBody_ContactFirstName");
    if (!firstName || doc.querySelector(".wl-contact-detail-shell")) return false;

    var contactGroups = Array.prototype.slice.call(doc.querySelectorAll(".epi-form-group-contact"));
    if (!contactGroups.length) return false;
    var firstWrapper = contactGroups[0].closest(".epi-form-col-single-contact") || contactGroups[0].parentElement;
    if (!firstWrapper || !firstWrapper.parentNode) return false;

    var query = "";
    try { query = new URL(win.location.href).searchParams.get("action") || ""; } catch (_) {}
    var isNew = query === "1";
    var isDefault = isDefaultDetail();
    if (isDefault) {
      var oid = doc.getElementById("ctl00_PageBody_HiddenContactID");
      if (oid && oid.value) saveDefaultContactIds([oid.value].concat(defaultContactIds()).filter(function (value, index, list) {
        return value && list.indexOf(value) === index;
      }));
    }

    doc.body.classList.add("wl-contact-page", "wl-contact-detail-page");

    [
      "ctl00_PageBody_ContactEmail",
      "ctl00_PageBody_ContactWebAddress"
    ].forEach(markFullWidth);

    [
      "ctl00_PageBody_chkBox_Email",
      "ctl00_PageBody_chkBox_SMS",
      "ctl00_PageBody_CheckBox1_email",
      "ctl00_PageBody_CheckBox2_email",
      "ctl00_PageBody_CheckBox3_email",
      "ctl00_PageBody_CheckBox1_SMS",
      "ctl00_PageBody_CheckBox2_SMS",
      "ctl00_PageBody_CheckBox3_SMS"
    ].forEach(markNotificationField);

    var shell = create("div", "wl-contact-detail-shell");
    var returning = returnToSourceBlock();
    if (returning) shell.appendChild(returning);

    var header = create("header", "wl-contact-page-header");
    var headerCopy = create("div");
    var heading = create("h1", "", isNew ? "Add Contact" : "Edit Contact");
    headerCopy.appendChild(heading);
    headerCopy.appendChild(create("p", "", "Keep contact details and notification preferences current for this account."));
    header.appendChild(headerCopy);
    shell.appendChild(header);

    if (isDefault) {
      var banner = create("div", "wl-contact-lock-banner");
      banner.setAttribute("role", "status");
      banner.appendChild(icon("lock"));
      var bannerCopy = create("div");
      bannerCopy.appendChild(create("strong", "", "Default contact is protected"));
      bannerCopy.appendChild(create("p", "", "This contact cannot be removed from the account by customers. Woodson Lumber can make that account-level change for you."));
      banner.appendChild(bannerCopy);
      shell.appendChild(banner);
    }

    firstWrapper.parentNode.insertBefore(shell, firstWrapper);
    var formGrid = create("div", "wl-contact-form-grid");
    contactGroups.forEach(function (group) {
      var sourceWrapper = group.closest(".epi-form-col-single-contact");
      formGrid.appendChild(group);
      if (sourceWrapper && !sourceWrapper.querySelector(".epi-form-group-contact,.submit-button-panel")) {
        sourceWrapper.classList.add("wl-contact-native-empty");
      }
    });

    var requestPanel = create("div", "wl-contact-request-panel");
    requestPanel.hidden = true;
    requestPanel.innerHTML = "<strong>Portal access</strong><p>Send this contact into the existing-account request form with their name, email, and phone prefilled.</p>";
    addPortalRequestAction(requestPanel, contactDataFromDetail());
    currentUserCanRequestAccess().then(function (allowed) {
      var data = contactDataFromDetail();
      requestPanel.hidden = !(allowed && data.email && emailKey(data.email) !== emailKey(portalManagerState().email));
    });
    formGrid.appendChild(requestPanel);

    var submitPanel = doc.querySelector(".submit-button-panel");
    if (submitPanel) {
      var save = doc.getElementById("ctl00_PageBody_SaveContactDetails");
      var cancel = doc.getElementById("ctl00_PageBody_CancelContactDetails");
      if (save) {
        save.value = "Save Contact";
        save.addEventListener("click", captureReturnContact, true);
      }
      if (cancel) cancel.value = "Cancel";
      var submitWrapper = submitPanel.closest(".epi-form-col-single-contact");
      formGrid.appendChild(submitPanel);
      if (submitWrapper && !submitWrapper.querySelector(".epi-form-group-contact,.submit-button-panel")) {
        submitWrapper.classList.add("wl-contact-native-empty");
      }
    }
    shell.appendChild(formGrid);

    var nativeCancel = doc.getElementById("ctl00_PageBody_CancelContactDetails");
    if (nativeCancel) nativeCancel.style.display = "none";
    var detailActions = create("div", "wl-contact-detail-actions");
    var back = create("a", "wl-contact-secondary", safeSessionGet(RETURN_KEY) ? "Back to previous page" : "Back to contacts");
    back.href = safeSessionGet(RETURN_KEY) || "Contacts_r.aspx";
    back.addEventListener("click", function () {
      if (safeSessionGet(RETURN_KEY)) safeSessionRemove(RETURN_KEY);
    });
    detailActions.appendChild(back);
    shell.appendChild(detailActions);

    var emailInput = doc.getElementById("ctl00_PageBody_ContactEmail");
    if (emailInput) {
      emailInput.setAttribute("inputmode", "email");
      emailInput.setAttribute("autocomplete", "email");
      emailInput.setAttribute("autocapitalize", "none");
      emailInput.setAttribute("spellcheck", "false");
    }
    ["ctl00_PageBody_ContactTelephone", "ctl00_PageBody_ContactMobile"].forEach(function (id) {
      var input = doc.getElementById(id);
      if (input) {
        input.setAttribute("type", "tel");
        input.setAttribute("autocomplete", "tel");
        input.setAttribute("inputmode", "tel");
      }
    });

    if (isDefault) lockDefaultRemoval();
    return true;
  }

  function run() {
    if (!doc) return false;
    injectStyles();
    var path = pathName();
    if (/\/contacts_r\.aspx$/.test(path)) return enhanceContactList();
    if (/\/contactdetails_r\.aspx$/.test(path)) return enhanceContactDetail();
    return false;
  }

  if (doc) {
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", run, { once: true });
    else run();
  }

  return {
    clean: clean,
    contactOid: contactOid,
    isDefaultContactValue: isDefaultContactValue,
    isDefaultContactMeta: isDefaultContactMeta,
    splitDisplayName: splitDisplayName,
    run: run
  };
});
