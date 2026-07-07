
$(async function(){
  var WL_EPALLET_PID = "23297";
  var WL_EPALLET_ADD_URL = "/ProductDetail.aspx?pid=" + WL_EPALLET_PID;
  var WL_EPALLET_ACTION_KEY = "wl_epallet_last_action_v1";
  var WL_EPALLET_SNAPSHOT_KEY = "wl_epallet_cart_snapshot_v1";
  var WL_EPALLET_RETURN_KEY = "wl_epallet_checkout_return_v1";
  var WL_EPALLET_DESIRED_MODE_KEY = "wl_epallet_desired_mode_v1";
  var WL_EPALLET_RULES = {
    22444: { code: "ASC", pickupMin: 10, palletQty: 42 },
    23379: { code: "4BSC", pickupMin: 10, palletQty: 30 },
    24896: { code: "PCC", pickupMin: 10, palletQty: 35 },
    25273: { code: "RMMC", pickupMin: 10, palletQty: 42 },
    25274: { code: "RMSC", pickupMin: 10, palletQty: 42 },
    26446: { code: "WMCC", pickupMin: 10, palletQty: 40 },
    26481: { code: "5BSC", pickupMin: 10, palletQty: 30 },
    94106: { code: "FSC", pickupMin: 10, palletQty: 64 },
    12383: { code: "50BLC", pickupMin: 10, palletQty: 50 },
    24315: { code: "3BSC", pickupMin: 10, palletQty: 30 },
    24319: { code: "MCC", pickupMin: 10, palletQty: 45 },
    122893: { code: "MCSC", pickupMin: 10, palletQty: 45 },
    25102: { code: "QC", pickupMin: 10, palletQty: 42 },
    4741: { code: "16164BAC", pickupMin: 10, palletQty: 54 },
    12101: { code: "4816FSC", pickupMin: 20, palletQty: 144 },
    21194: { code: "8816HHBC", pickupMin: 10, palletQty: 72 },
    23008: { code: "CSC", pickupMin: 3, palletQty: 15 },
    23049: { code: "DBC", pickupMin: 10, palletQty: 80 },
    20366: { code: "816158FSC", pickupMin: 25, palletQty: 168 },
    20368: { code: "816214PC", pickupMin: 25, palletQty: 180 },
    21126: { code: "8812BLC", pickupMin: 10, palletQty: 64 },
    12100: { code: "4816BLC", pickupMin: 15, palletQty: 144 },
    2996: { code: "12122BAC", pickupMin: 25, palletQty: 168 },
    3003: { code: "12124BAC", pickupMin: 15, palletQty: 96 },
    21193: { code: "8816BLC", pickupMin: 10, palletQty: 60 },
    26060: { code: "UBC", pickupMin: 100, palletQty: 576 },
    133832: { code: "16162BAC", pickupMin: 15, palletQty: 84 },
    25415: { code: "SB", pickupMin: 3, palletQty: null },
    2999: { code: "12122RBAC", pickupMin: 20, palletQty: 168 },
    4743: { code: "16162RBBAC", pickupMin: 15, palletQty: 84 },
    21475: { code: "888LHBLC", pickupMin: 20, palletQty: 144 },
    4742: { code: "16162BBAC", pickupMin: 15, palletQty: 84 },
    25076: { code: "PR", pickupMin: 75, palletQty: 480 },
    25094: { code: "PT", pickupMin: 75, palletQty: 480 },
    23825: { code: "GWR", pickupMin: 20, palletQty: 144 },
    23826: { code: "GWRB", pickupMin: 20, palletQty: 144 },
    23827: { code: "GWT", pickupMin: 20, palletQty: 144 },
    113992: { code: "612CSC", pickupMin: 15, palletQty: 96 },
    113994: { code: "6CPCC", pickupMin: 10, palletQty: 52 },
    23828: { code: "GWTB", pickupMin: 20, palletQty: 144 }
  };
  var WL_EPALLET_RULES_BY_CODE = {};
  Object.keys(WL_EPALLET_RULES).forEach(function (pid) {
    var rule = WL_EPALLET_RULES[pid];
    WL_EPALLET_RULES_BY_CODE[String(rule.code || "").replace(/[^A-Z0-9]/gi, "").toUpperCase()] = rule;
  });

  function wlEpalletText(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function wlEpalletNumber(value) {
    var num = Number(String(value == null ? "" : value).replace(/,/g, ""));
    return Number.isFinite(num) ? num : 0;
  }

  function wlEpalletCartMode() {
    var values = [];
    try {
      if (sessionStorage.getItem(WL_EPALLET_RETURN_KEY) === "1") {
        values.push(sessionStorage.getItem(WL_EPALLET_DESIRED_MODE_KEY));
      }
    } catch (e) {}
    try { values.push(localStorage.getItem("woodson_cart_method")); } catch (e) {}
    try { values.push(sessionStorage.getItem("wl_fulfillment_method")); } catch (e) {}
    try { values.push(sessionStorage.getItem("wl_fulfillment_intent")); } catch (e) {}
    try {
      var pickupCookie = document.cookie.match(/(?:^|;\s*)pickupSelected=([^;]+)/);
      if (pickupCookie && pickupCookie[1] === "false") return "delivery";
      if (pickupCookie && pickupCookie[1] === "true") values.push("pickup");
    } catch (e) {}

    var joined = values.filter(Boolean).join(" ").toLowerCase();
    if (/ship|ups|deliver/.test(joined)) return "delivery";
    return "pickup";
  }

  function wlEpalletPidFromRow($row) {
    var href = "";
    $row.find("a[href*='ProductDetail.aspx']").each(function () {
      href = href || ($(this).attr("href") || "");
    });
    var match = href.match(/[?&]pid=(\d+)/i);
    return match ? match[1] : "";
  }

  function wlEpalletQtyInput($row) {
    return $row.find("input[id*='_qty_']:not([id$='_ClientState']), input.riTextBox").filter(function () {
      return !/_ClientState$/i.test(this.id || "");
    }).first();
  }

  function wlEpalletLineQty($row) {
    var $input = wlEpalletQtyInput($row);
    if ($input.length) return Math.max(1, wlEpalletNumber($input.val()));
    var visibleQty = wlEpalletText($row.find(".wl-qty-value").first().text());
    return Math.max(1, wlEpalletNumber(visibleQty) || 1);
  }

  function wlEpalletLineCode($row) {
    return wlEpalletText($row.find(".portalGridLink").first().text() || $row.find("h6 a").first().text()).toUpperCase();
  }

  function wlEpalletNormalizedCode($row) {
    return wlEpalletLineCode($row).replace(/[^A-Z0-9]/g, "");
  }

  function wlEpalletRuleForRow($row) {
    var pid = wlEpalletPidFromRow($row);
    if (pid && WL_EPALLET_RULES[pid]) return WL_EPALLET_RULES[pid];
    return WL_EPALLET_RULES_BY_CODE[wlEpalletNormalizedCode($row)] || null;
  }

  function wlEpalletIsEpalletRow($row) {
    var normalizedCode = wlEpalletNormalizedCode($row);
    return wlEpalletPidFromRow($row) === WL_EPALLET_PID || normalizedCode === "EPALLET" || normalizedCode === "EPALLETS";
  }

  function wlEpalletRows() {
    return $(".shopping-cart-details .shopping-cart-item").filter(function () {
      var $row = $(this);
      return !!(wlEpalletPidFromRow($row) || wlEpalletLineCode($row));
    });
  }

  function wlEpalletCalculateRequired(rows, mode) {
    var quantitiesByRule = {};
    rows.each(function () {
      var $row = $(this);
      if (wlEpalletIsEpalletRow($row)) return;
      var rule = wlEpalletRuleForRow($row);
      if (!rule) return;
      var key = rule.code || wlEpalletPidFromRow($row) || wlEpalletNormalizedCode($row);
      quantitiesByRule[key] = quantitiesByRule[key] || { rule: rule, qty: 0 };
      quantitiesByRule[key].qty += wlEpalletLineQty($row);
    });

    return Object.keys(quantitiesByRule).reduce(function (total, key) {
      var entry = quantitiesByRule[key];
      var rule = entry.rule;
      var qty = entry.qty;
      var required = mode === "delivery" ? qty > 0 : qty >= rule.pickupMin;
      if (!required) return total;
      return total + (rule.palletQty ? Math.ceil(qty / rule.palletQty) : 1);
    }, 0);
  }

  function wlEpalletExistingQty(rows) {
    var qty = 0;
    rows.filter(function () { return wlEpalletIsEpalletRow($(this)); }).each(function () {
      qty += wlEpalletLineQty($(this));
    });
    return qty;
  }

  function wlEpalletSaveSnapshot(rows, mode) {
    try {
      var snapshot = {
        ts: Date.now(),
        mode: mode || wlEpalletCartMode(),
        existingQty: wlEpalletExistingQty(rows),
        requiredByMode: {
          pickup: wlEpalletCalculateRequired(rows, "pickup"),
          delivery: wlEpalletCalculateRequired(rows, "delivery")
        }
      };
      var text = JSON.stringify(snapshot);
      sessionStorage.setItem(WL_EPALLET_SNAPSHOT_KEY, text);
      localStorage.setItem(WL_EPALLET_SNAPSHOT_KEY, text);
    } catch (e) {}
  }

  function wlEpalletActionRecentlyTried(signature) {
    try {
      var parsed = JSON.parse(sessionStorage.getItem(WL_EPALLET_ACTION_KEY) || "null");
      if (parsed && parsed.signature === signature && Date.now() - parsed.ts < 15000) return true;
      sessionStorage.setItem(WL_EPALLET_ACTION_KEY, JSON.stringify({ signature: signature, ts: Date.now() }));
    } catch (e) {}
    return false;
  }

  function wlEpalletShowStatus(message, isError) {
    var $target = $(".ShoppingCartDetailPanel, .shopping-cart-details").first();
    if (!$target.length || $("#wl-epallet-cart-status").length) return;
    $("<div>", {
      id: "wl-epallet-cart-status",
      class: "alert " + (isError ? "alert-warning" : "alert-info"),
      text: message
    }).css({
      margin: "12px 0",
      borderLeft: "4px solid #6b0016",
      fontWeight: 700
    }).prependTo($target);
  }

  function wlEpalletMaybeReturnToCheckout(rows) {
    var shouldReturn = false;
    try { shouldReturn = sessionStorage.getItem(WL_EPALLET_RETURN_KEY) === "1"; } catch (e) {}
    if (!shouldReturn) return;

    var mode = wlEpalletCartMode();
    var required = wlEpalletCalculateRequired(rows, mode);
    var existingQty = wlEpalletExistingQty(rows);
    if (required !== existingQty) {
      try { sessionStorage.removeItem(WL_EPALLET_RETURN_KEY); } catch (e) {}
      try { sessionStorage.removeItem(WL_EPALLET_DESIRED_MODE_KEY); } catch (e) {}
      wlEpalletShowStatus("Please review the E-Pallet line before continuing checkout. The cart still needs a pallet handling adjustment.", true);
      return;
    }

    wlEpalletShowStatus("Pallet handling is updated. Reopening checkout now.", false);
    window.setTimeout(function () {
      var $button = $("#ctl00_PageBody_PlaceOrderButton, [name='ctl00$PageBody$PlaceOrderButton']").first();
      try { sessionStorage.removeItem(WL_EPALLET_RETURN_KEY); } catch (e) {}
      try { sessionStorage.removeItem(WL_EPALLET_DESIRED_MODE_KEY); } catch (e) {}
      if ($button.length) {
        $button.trigger("click");
      } else {
        window.location.href = "/ShoppingCart.aspx";
      }
    }, 700);
  }

  function wlEpalletRunNativeLink($link) {
    if (!$link || !$link.length) return false;
    var href = $link.attr("href") || "";
    try {
      if (/^javascript:/i.test(href)) {
        window.eval(href.replace(/^javascript:/i, ""));
        return true;
      }
    } catch (e) {
      console.warn("[WLEpallet] Native link eval failed.", e);
    }
    try {
      $link.get(0).click();
      return true;
    } catch (e2) {
      console.warn("[WLEpallet] Native link click failed.", e2);
    }
    return false;
  }

  function wlEpalletSetCartLineQty($row, qty) {
    var text = String(Math.max(1, qty));
    var $input = wlEpalletQtyInput($row);
    var $state = $row.find("input[type='hidden'][id$='_ClientState']").first();
    var $refresh = $row.find("a.refresh-cart-line-total").first();
    if (!$input.length || !$refresh.length) return false;

    $input.val(text);
    if ($state.length && $state.val()) {
      try {
        var state = JSON.parse($state.val());
        state.validationText = text;
        state.valueAsString = text;
        state.lastSetTextBoxValue = text;
        $state.val(JSON.stringify(state));
      } catch (e) {}
    }
    return wlEpalletRunNativeLink($refresh);
  }

  function wlEpalletDeleteCartLine($row) {
    return wlEpalletRunNativeLink($row.find("a[id*='_del_'], a[id*='Delete'], a[href*='Delete']").first());
  }

  async function wlEpalletAddToCart(qty) {
    var response = await fetch(WL_EPALLET_ADD_URL, { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw new Error("Could not open E-Pallet product page.");

    var html = await response.text();
    var doc = new DOMParser().parseFromString(html, "text/html");
    var form = doc.querySelector("form");
    if (!form) throw new Error("Could not read E-Pallet add-to-cart form.");

    var data = new URLSearchParams();
    Array.prototype.forEach.call(form.elements, function (element) {
      if (!element.name || element.disabled) return;
      var type = String(element.type || "").toLowerCase();
      if (["button", "submit", "image", "reset", "file"].indexOf(type) !== -1) return;
      if ((type === "checkbox" || type === "radio") && !element.checked) return;
      data.append(element.name, element.value || "");
    });

    data.set("__EVENTTARGET", "ctl00$PageBody$productDetail$ctl00$AddProductButton");
    data.set("__EVENTARGUMENT", "");
    data.set("ctl00$PageBody$productDetail$ctl00$qty_" + WL_EPALLET_PID, String(Math.max(1, qty)));

    var post = await fetch(WL_EPALLET_ADD_URL, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: data.toString()
    });
    if (!post.ok) throw new Error("Could not add the required E-Pallet line.");
  }

  async function wlEpalletEnsureCartSynced() {
    var rows = wlEpalletRows();
    if (!rows.length) return false;

    var mode = wlEpalletCartMode();
    wlEpalletSaveSnapshot(rows, mode);
    var required = wlEpalletCalculateRequired(rows, mode);
    var epalletRows = rows.filter(function () {
      return wlEpalletIsEpalletRow($(this));
    });
    var existingQty = 0;
    epalletRows.each(function () { existingQty += wlEpalletLineQty($(this)); });

    var signature = [mode, required, existingQty, rows.length].join(":");
    if (required === existingQty) {
      try { sessionStorage.removeItem(WL_EPALLET_ACTION_KEY); } catch (e) {}
      return false;
    }
    if (wlEpalletActionRecentlyTried(signature)) {
      wlEpalletShowStatus("We could not automatically finish the E-Pallet adjustment. Please refresh the cart or ask Woodson to review this cart before checkout.", true);
      return false;
    }

    try {
      if (required <= 0 && epalletRows.length) {
        wlEpalletShowStatus("Removing the E-Pallet line because the cart no longer requires it.", false);
        if (wlEpalletDeleteCartLine(epalletRows.first())) return true;
      } else if (required > 0 && epalletRows.length) {
        wlEpalletShowStatus("Updating the E-Pallet quantity to match this cart.", false);
        if (wlEpalletSetCartLineQty(epalletRows.first(), required)) return true;
      } else if (required > 0) {
        wlEpalletShowStatus("Adding the required E-Pallet line to this cart.", false);
        await wlEpalletAddToCart(required);
        window.location.href = "/ShoppingCart.aspx?epallet=added";
        return true;
      }
    } catch (error) {
      console.warn("[WLEpallet] Cart sync failed.", error);
      wlEpalletShowStatus("We could not automatically adjust the E-Pallet line. Please refresh the cart or ask Woodson to review this cart before checkout.", true);
      return false;
    }

    return false;
  }

  if (await wlEpalletEnsureCartSynced()) return;

  if (!document.getElementById('wl-cart-qty-stepper-styles')) {
    $('<style id="wl-cart-qty-stepper-styles">\
      .qty-section{gap:8px;min-height:40px;}\
      .wl-native-qty-hidden{display:none!important;}\
      .wl-qty-label,.wl-qty-unit{font-size:13px;color:#555;white-space:nowrap;flex:0 0 auto;}\
      .wl-qty-control{display:inline-grid;grid-template-columns:40px minmax(74px,92px) 40px;height:40px;flex:0 0 auto;border:1px solid #b9bec5;border-radius:6px;overflow:hidden;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.06);}\
      .wl-qty-control select{width:100%;height:40px;border:0;border-left:1px solid #d8dce1;border-right:1px solid #d8dce1;border-radius:0;background:#fff;color:#222;font-size:15px;font-weight:700;text-align:center;text-align-last:center;appearance:auto;}\
      .wl-qty-stepper button{width:40px;height:40px;padding:0;border:0;border-radius:0;background:#f2f4f6;color:#292d32;font-size:22px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;touch-action:manipulation;}\
      .wl-qty-stepper button.wl-qty-increase{background:#6b0016;color:#fff;}\
      .wl-qty-stepper button:focus-visible{outline:3px solid rgba(107,0,22,.25);outline-offset:-3px;}\
      .wl-qty-stepper button:disabled{opacity:.42;cursor:default;}\
      .wl-qty-value{min-width:46px;height:40px;display:flex;align-items:center;justify-content:center;border-left:1px solid #d8dce1;border-right:1px solid #d8dce1;font-size:16px;font-weight:700;color:#222;font-variant-numeric:tabular-nums;background:#fff;}\
      .wl-qty-locked{display:inline-flex;align-items:center;min-height:40px;padding:0 10px;border:1px solid #d9dde1;border-radius:6px;background:#f7f8f9;color:#25282c;font-size:13px;font-weight:700;}\
      .wl-epallet-refund-note{margin:6px 0 0;color:#555;font-size:12px;line-height:1.35;}\
      .wl-epallet-lock-note{margin-left:4px;color:#666;font-size:12px;line-height:1.3;}\
      @media (max-width:640px){\
        .cart-item-card .card-body>.d-flex.justify-content-between{display:grid!important;grid-template-columns:1fr;gap:10px;align-items:stretch!important;}\
        .cart-item-card .qty-section{width:100%;display:flex!important;flex-wrap:nowrap;justify-content:flex-start;align-items:center;}\
        .cart-item-card .action-block{width:100%;display:grid!important;grid-template-columns:minmax(82px,1fr) auto auto;gap:10px;align-items:center;text-align:left!important;}\
        .cart-item-card .action-block>div{margin:0!important;min-width:0;}\
        .cart-item-card .action-block>div:nth-child(2),.cart-item-card .action-block>div:nth-child(3){text-align:right;}\
        .cart-item-card .delete-link,.cart-item-card .sfl-placeholder button,.cart-item-card .sfl-placeholder a{white-space:nowrap!important;}\
        .cart-item-card .sfl-placeholder button,.cart-item-card .sfl-placeholder a{min-width:0!important;padding:8px 10px!important;}\
      }\
    </style>').appendTo('head');
  }

  $('.shopping-cart-details .shopping-cart-item').each(function(){
    var $item = $(this);

    var $infoCol = $item.find('.row.pl-2.w-100 .col-12.col-sm-6').first();
    var $link = $infoCol.find('a:has(.portalGridLink)').first();
    var code = $link.find('.portalGridLink').text().trim();
    var href = $link.attr('href');
    var $origQtyWrap = $item.find('span.RadInput').first();
    var isEpalletCard = /[?&]pid=23297\b/i.test(href || '') || String(code || '').replace(/[^A-Z0-9]/gi, '').toUpperCase() === 'EPALLETS';

    // WebTrack can render responsive/helper cart rows that do not contain a
    // product. Skip those so we do not create ghost cards like "ea / Delete".
    if (!code || !href || !$origQtyWrap.length) return;

    // 1) Remove legacy update rows & validators
    $item.find('[style*="display: table-row"]').remove();
    $item.find('span[id$="_QuantityValidator"]').remove();

    // 2) Capture & remove original Delete link
    var $origDel = $item.find('a[id*="_del_"]').first();
    var delJs = '';
    if ($origDel.length) {
      delJs = ($origDel.attr('href') || '').replace(/^javascript:/, '');
    }
    $origDel.remove();

    // 3) Capture & remove original Refresh link
    var $origRef = $item.find('a.refresh-cart-line-total').first();
    var refJs = '';
    if ($origRef.length) {
      refJs = ($origRef.attr('href') || '').replace(/^javascript:/, '');
    }
    $origRef.remove();

    // 4) Detach the entire RadInput wrapper for qty
    $origQtyWrap = $origQtyWrap.detach();

    // 5) Grab the rest of your data
    var imgSrc = $item.find('img.ThumbnailImage').attr('src');
    var desc    = $infoCol.find('> div:nth-child(3) div').text().trim();
    var priceText = $item
      .find('.col-12.col-sm-9 .col-6')
      .contents().filter(function(i,n){ return n.nodeType===3; })
      .text().trim();
    var totalText = $item
      .find('.col-12.col-sm-3 .d-flex div').first()
      .text().trim();

    // 6) Build a plain “Delete” text link
    var $delBtn = $('<a href="#" class="delete-link ms-2">Delete</a>');
    if (delJs) {
      $delBtn.on('click', function(e){
        e.preventDefault();
        eval(delJs);
      });
    }

    // 7) Build the card structure
    var $card = $(`
      <div class="card mb-2 cart-item-card">
        <div class="card-body p-2">
          <!-- Top row: Image, title/desc, price -->
          <div class="d-flex align-items-center">
            <div class="flex-shrink-0">
              <a href="${href}">
                <img src="${imgSrc}" alt="${code}"
                     style="
                       width:14vw; max-width:140px;
                       height:auto;
                       object-fit:contain;
                       border-radius:4px;
                     ">
              </a>
            </div>
            <div class="flex-grow-1 flex-shrink-1 ms-3">
              <h6 class="mb-1"><a href="${href}">${code}</a></h6>
              <p class="mb-1 small text-secondary text-wrap">${desc}</p>
              ${isEpalletCard ? '<p class="wl-epallet-refund-note">Refundable when the pallet is returned in good condition.</p>' : ''}
            </div>
            <div class="flex-shrink-0 text-end">
              <span class="fw-bold">${priceText}</span>
            </div>
          </div>
          <hr class="my-2">
          <!-- Bottom row: Qty on left, Total/Delete/SFL on right -->
          <div class="d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center qty-section"></div>
            <div class="text-end action-block">
              <div><span class="fw-bold">${totalText}</span></div>
              <div class="mt-1"></div>
              <div class="sfl-placeholder mt-1"></div>
            </div>
          </div>
        </div>
      </div>
    `);

    // 8) Keep WebTrack's field hidden and expose a Safari-safe quantity stepper.
    var $qtyClone = $origQtyWrap.clone();
    var $qtySection = $card.find('.qty-section');
    var $input = $qtyClone.find('input.riTextBox');
    var $qtyState = $qtyClone.find("input[type='hidden'][id$='_ClientState']");
    $qtySection.append($qtyClone);

    if ($input.length && isEpalletCard) {
      var lockedQty = parseFloat($input.val());
      if (!isFinite(lockedQty) || lockedQty <= 0) lockedQty = 1;
      $qtyClone.addClass('wl-native-qty-hidden');
      $input.attr({
        type: 'hidden',
        tabindex: '-1',
        autocomplete: 'off',
        'aria-hidden': 'true',
        'data-wl-qty-native': '1',
        'data-form-type': 'other',
        'data-1p-ignore': 'true',
        'data-lpignore': 'true'
      });
      $qtySection.append(
        '<span class="wl-qty-label">Qty</span>',
        '<span class="wl-qty-locked">' + lockedQty + '</span>',
        '<span class="wl-qty-unit">ea</span>',
        '<span class="wl-epallet-lock-note">Auto-managed</span>'
      );
    } else if ($input.length) {
      var currentQty = parseFloat($input.val());
      if (!isFinite(currentQty) || currentQty <= 0) currentQty = 1;

      $qtyClone.addClass('wl-native-qty-hidden');
      $input.attr({
        type: 'hidden',
        tabindex: '-1',
        autocomplete: 'off',
        'aria-hidden': 'true',
        'data-wl-qty-native': '1',
        'data-form-type': 'other',
        'data-1p-ignore': 'true',
        'data-lpignore': 'true'
      });

      function qtyChoices(value) {
        var choices = [];
        for (var i = 1; i <= 20; i += 1) choices.push(i);
        for (var j = 25; j <= 100; j += 5) choices.push(j);
        for (var k = 125; k <= 300; k += 25) choices.push(k);
        for (var m = 350; m <= 1000; m += 50) choices.push(m);
        if (choices.indexOf(value) === -1) choices.push(value);
        return choices.sort(function (a, b) { return a - b; });
      }

      var $stepper = $('<div class="wl-qty-stepper wl-qty-control" role="group" aria-label="Quantity"></div>');
      var $decrease = $('<button type="button" class="wl-qty-decrease" aria-label="Decrease quantity"><span aria-hidden="true">&minus;</span></button>');
      var $select = $('<select class="wl-qty-select" aria-label="Quantity"></select>');
      var $increase = $('<button type="button" class="wl-qty-increase" aria-label="Increase quantity"><span aria-hidden="true">+</span></button>');
      var busy = false;

      function renderQty() {
        var choices = qtyChoices(currentQty);
        $select.empty();
        choices.forEach(function (choice) {
          $('<option>', { value: String(choice), text: String(choice) }).appendTo($select);
        });
        $select.val(String(currentQty));
        $select.prop('disabled', busy);
        $decrease.prop('disabled', busy || currentQty <= 1);
        $increase.prop('disabled', busy);
      }

      function syncWebTrackQty() {
        var text = String(currentQty);
        $input.val(text);
        if ($qtyState.length && $qtyState.val()) {
          try {
            var state = JSON.parse($qtyState.val());
            state.validationText = text;
            state.valueAsString = text;
            state.lastSetTextBoxValue = text;
            $qtyState.val(JSON.stringify(state));
          } catch (e) {}
        }
      }

      function applyQty(next) {
        if (busy) return;
        next = Math.max(1, parseFloat(next) || 1);
        if (next === currentQty) return;
        currentQty = next;
        busy = true;
        syncWebTrackQty();
        renderQty();
        if (refJs) {
          try { eval(refJs); }
          catch (e) { busy = false; renderQty(); throw e; }
        } else {
          busy = false;
          renderQty();
        }
      }

      function changeQty(delta) {
        applyQty(currentQty + delta);
      }

      $decrease.on('click', function(){ changeQty(-1); });
      $increase.on('click', function(){ changeQty(1); });
      $select.on('change', function(){ applyQty($(this).val()); });
      $stepper.append($decrease, $select, $increase);
      $qtySection.append('<span class="wl-qty-label">Qty</span>', $stepper, '<span class="wl-qty-unit">ea</span>');
      syncWebTrackQty();
      renderQty();
    } else {
      $qtySection.append(' ea');
    }

    // 9) Attach the Delete link
    if (!isEpalletCard) {
      $card.find('.action-block > div:nth-child(2)')
           .append($delBtn);
    }

    // 10) Swap out the old row for our new card
    $item.empty().append($card);
  });

  wlEpalletMaybeReturnToCheckout(wlEpalletRows());
});














$(function(){
  // 1) Grab and clone the original subtotal panel, then hide it
  var $origSub = $('.SubtotalWrapper');
  var $cloneSub = $origSub.clone();
  $origSub.hide();

  // 2) Clean the clone (remove any free-shipping note)
  $cloneSub.find('div[style]').remove();

  // 3) Detach & relabel the Place Order button so no other script can remove it
  var $btn = $('#ctl00_PageBody_PlaceOrderButton').detach();
  $btn.find('span').text('Proceed to checkout');

  // 4) Build your own wrapper
  var $newWrapper = $('<div class="custom-subtotal-wrapper"></div>')
    .append($cloneSub)
    .append($btn);

  // 5) Insert it at the top of the shopping-cart-details
  $('.ShoppingCartDetailPanel').append($newWrapper);
});












$(function(){
  // Detach the “Empty Cart” button
  var $emptyBtn = $('#ctl00_PageBody_EmptyCartButton').detach();

  // Append it to the bottom of .shopping-cart-details
  $('.shopping-cart-details').append($emptyBtn);
});


$(function(){
  // Hide the top/bottom “Shop for More”, “Place Order”, and “Empty Cart” buttons
  $('#ctl00_PageBody_ShopForMoreButton, \
    #ctl00_PageBody_PlaceOrderButtonTop, \
    #ctl00_PageBody_ShopForMoreButtonTop, \
    #ctl00_PageBody_EmptyCartButtonTop').hide();
});




$(function(){
  // 1) Detach the existing title span
  var $oldTitle = $('#ctl00_PageBody_ShoppingCartTitle_HeaderText').detach();

  // 2) Extract the item count
  var match = $oldTitle.text().match(/\d+/);
  var count = match ? parseInt(match[0], 10) : 0;

  // 3) Build new header block
  var $newHeader = $(`
    <div class="cart-header mb-3">
      <h2>Shopping Cart</h2>
      <p>${count} item${count === 1 ? '' : 's'}</p>
    </div>
  `);

  // 4) Insert it immediately before .shopping-cart-details
  $('.shopping-cart-details').before($newHeader);
});



(function () {
  document.addEventListener('DOMContentLoaded', function () {
    const placeOrderBtn = document.getElementById('ctl00_PageBody_PlaceOrderButton');
    

    function overrideSessionState() {
      console.log('[Checkout] Overriding localStorage: sameAsDelivery = false, currentStep = 2');
      localStorage.setItem('sameAsDelivery', 'false');
      localStorage.setItem('currentStep', '2');
    }

    if (placeOrderBtn) {
      placeOrderBtn.addEventListener('click', overrideSessionState);
    }

});
})();


















(function () {
  const wrapper = document.querySelector('.custom-subtotal-wrapper');
  if (!wrapper) return;

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) {
        // User scrolled past the element — stick to top
        wrapper.classList.remove('fixed-bottom');
        wrapper.classList.add('sticky-top');
      } else {
        // User scrolled back up — return to bottom if it was originally off-screen
        if (wasOffScreen) {
          wrapper.classList.add('fixed-bottom');
          wrapper.classList.remove('sticky-top');
        }
      }
    },
    {
      threshold: 0,
    }
  );

  // Check if element is below the fold on initial load
  const rect = wrapper.getBoundingClientRect();
  const wasOffScreen = rect.top > window.innerHeight;

  if (wasOffScreen) {
    wrapper.classList.add('fixed-bottom');
  } else {
    wrapper.classList.add('sticky-top');
  }

  observer.observe(wrapper);
})();
