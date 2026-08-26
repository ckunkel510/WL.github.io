
$(function(){
  // 1) Check delivery cost
  var costText = $('#ctl00_PageBody_CartSummary2_DeliveryCostsRow td.numeric').text().trim();
  if (costText === '$250.00') {
    console.log('[DeliveryCheck] High delivery cost detected:', costText);

    // 2) Grab & detach the original Back-to-Cart anchor
    var $origBack = $('#ctl00_PageBody_BackToCartButton3').detach();
    var backJs = ($origBack.attr('href') || '')
      .replace(/^javascript:/, '');

    // 3) Build a “Change Address” link that sets currentStep=5 and then fires the same postback
    var $changeAddr = $(`
      <a href="#" id="changeAddressBtn" class="epi-button mr-2">
        <span>Change Address</span>
      </a>
    `).on('click', function(e){
      e.preventDefault();
      console.log('[DeliveryCheck] Change Address clicked');
      // set the localStorage step
      localStorage.setItem('currentStep', '5');
      // invoke the original postback
      try {
        eval(backJs);
      } catch (err) {
        console.error('[DeliveryCheck] Postback failed:', err);
      }
    });

    // 4) Build a new “Edit Cart” button
    var $editCart = $(`
      <a id="editCartBtn" class="epi-button" href="ShoppingCart.aspx">
        <span>Edit Cart</span>
      </a>
    `);

    // 5) Empty the mainContents and show a message + our two buttons
    var $container = $('.mainContents').empty();
    var $message = $(`
      <div class="delivery-error-message mb-4">
        An item in your cart is not eligible for delivery to your selected delivery address.<br>
        Please select a new address or remove the item from your cart.
      </div>
    `);

    $container
      .append($message)
      .append($('<div class="button-group"></div>')
        .append($changeAddr)
        .append($editCart)
      );

    console.log('[DeliveryCheck] Switched to delivery-error view');
  }
});


(function () {
  const CART_SIGNATURE_KEY = "wl_cart_signature_v1";
  const SHIPPING_QUOTE_KEY = "wl_shipping_quote_v1";

  function normalizeAmount(raw) {
    const match = String(raw || "").match(/\$\s*([\d,]+(?:\.\d{2})?)/);
    return match ? "$" + match[1] : "";
  }

  function normalizeServiceLabel(raw) {
    return String(raw || "")
      .replace(/\s*\([^)]*\$[^)]*\)\s*$/, "")
      .replace(/\s+\$\s*[\d,]+(?:\.\d{2})?(?:\s+USD)?\s*$/i, "")
      .trim();
  }

  function captureShippingQuote() {
    let method = "";
    let signature = "";
    try {
      method = sessionStorage.getItem("wl_fulfillment_method") || "";
      signature = sessionStorage.getItem(CART_SIGNATURE_KEY) || "";
    } catch {}
    if (!["delivery", "ship"].includes(method) || !signature) return;

    const deliveryRow = document.querySelector("#ctl00_PageBody_CartSummary2_DeliveryCostsRow td.numeric");
    const selectedOption = document.querySelector("#ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_DeliveryOptionsDropDownList option:checked");
    const amount = normalizeAmount(deliveryRow?.textContent) || normalizeAmount(selectedOption?.textContent);
    if (!amount) return;
    let savedSelection = null;
    try { savedSelection = JSON.parse(sessionStorage.getItem("wl_shipping_selection_v1") || "null"); } catch {}
    const serviceLabel = normalizeServiceLabel(savedSelection?.label || selectedOption?.textContent);
    const postalCode = document.querySelector("#ctl00_PageBody_DeliveryAddress_Postcode")?.value || "";

    try {
      localStorage.setItem(SHIPPING_QUOTE_KEY, JSON.stringify({
        signature: signature,
        kind: method === "ship" ? "ups" : "local-delivery",
        label: method === "ship" ? (serviceLabel || "UPS shipping") : "Woodson Local Delivery",
        amount: amount,
        postalCode: method === "ship" ? postalCode.slice(0, 5) : "",
        ts: Date.now()
      }));
    } catch {}
  }

  function bootShippingQuoteCapture() {
    captureShippingQuote();
    window.setTimeout(captureShippingQuote, 250);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootShippingQuoteCapture, { once: true });
  } else {
    bootShippingQuoteCapture();
  }

  document.addEventListener("change", function (event) {
    if (event.target && /DeliveryOptionsDropDownList/.test(event.target.id || "")) captureShippingQuote();
  }, true);

  try {
    const manager = window.Sys && window.Sys.WebForms && window.Sys.WebForms.PageRequestManager
      ? window.Sys.WebForms.PageRequestManager.getInstance()
      : null;
    if (manager && !manager.__wlShippingQuoteCaptureHooked) {
      manager.__wlShippingQuoteCaptureHooked = true;
      manager.add_endRequest(bootShippingQuoteCapture);
    }
  } catch {}
})();


(function () {
  "use strict";

  if (window.__wlShippingChargeGuardBound) return;
  window.__wlShippingChargeGuardBound = true;

  const FULFILLMENT_METHOD_KEY = "wl_fulfillment_method";
  const OFFER_KEY = "wl_shipping_offer_v1";
  const PROMO_KEY = "wl_shipping_promo_v1";
  const PLACE_ORDER_SELECTOR = "#ctl00_PageBody_PlaceOrderButton, [name='ctl00$PageBody$PlaceOrderButton']";

  function shippingAmount(raw) {
    const source = String(raw || "").replace(/,/g, "");
    const match = source.match(/\$\s*(-?\d+(?:\.\d{1,2})?)/) || source.match(/(-?\d+(?:\.\d{1,2})?)\s*USD\b/i);
    if (!match) return 0;
    const amount = Number(match[1]);
    return Number.isFinite(amount) ? amount : 0;
  }

  function shippingChargeDecision(input) {
    const method = String(input && input.method || "").toLowerCase();
    const nativeAmount = Number(input && input.nativeAmount);
    if (method !== "ship" && method !== "delivery") return { ok: true, reason: "not-shipping" };
    if (Number.isFinite(nativeAmount) && nativeAmount > 0) return { ok: true, reason: "positive-native-charge" };
    if (method === "ship" && input && input.promoAllowsFree === true) return { ok: true, reason: "validated-free-shipping-promo" };
    return { ok: false, reason: "missing-positive-native-charge" };
  }

  function storedJson(key) {
    try {
      const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function currentFulfillmentMethod() {
    try {
      const stored = sessionStorage.getItem(FULFILLMENT_METHOD_KEY) || localStorage.getItem("woodson_cart_method") || "";
      if (stored) return stored;
    } catch {
      // Continue with native WebTrack controls below. Storage is an enhancement,
      // not a safe source of truth for whether an order needs a shipping charge.
    }

    const summary = String(document.body && document.body.textContent || "").replace(/\s+/g, " ");
    if (/Shipping Method\s*:\s*UPS\b/i.test(summary)) return "ship";
    if (/Shipping Method\s*:\s*(?:Delivered|Delivery)\b/i.test(summary)) return "delivery";

    const pickup = document.querySelector("#ctl00_PageBody_SaleTypeSelector_rbCollectLater");
    if (pickup && pickup.checked) return "pickup";
    const delivery = document.querySelector("#ctl00_PageBody_SaleTypeSelector_rbDelivered");
    const ups = document.querySelector("#ctl00_PageBody_SaleTypeSelector_rbUPSDelivery");
    // Delivery and UPS share a native radio in this WebTrack build. If browser
    // intent was lost, treat either native delivery-like state as chargeable.
    if ((delivery && delivery.checked) || (ups && ups.checked)) return "delivery";
    return "";
  }

  function validatedFreeShippingPromoActive() {
    const promo = storedJson(PROMO_KEY);
    const offer = storedJson(OFFER_KEY);
    const code = String(promo && promo.code || "").replace(/[\s-]+/g, "").toUpperCase();
    const expiresAt = Date.parse(promo && promo.serverClaim && promo.serverClaim.expiresAt || "");
    const sameCart = Boolean(promo && promo.cartSignature && offer && offer.cartSignature && promo.cartSignature === offer.cartSignature);
    return code === "SUMMERCHILL26" && promo && promo.eligible === true && sameCart && Number.isFinite(expiresAt) && expiresAt > Date.now();
  }

  function nativeShippingAmount() {
    const deliveryRow = document.querySelector("#ctl00_PageBody_CartSummary2_DeliveryCostsRow td.numeric");
    const selectedOption = document.querySelector("#ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_DeliveryOptionsDropDownList option:checked");
    return Math.max(shippingAmount(deliveryRow && deliveryRow.textContent), shippingAmount(selectedOption && selectedOption.textContent));
  }

  function showChargeError(target) {
    let warning = document.getElementById("wl-shipping-charge-guard");
    if (!warning) {
      warning = document.createElement("div");
      warning.id = "wl-shipping-charge-guard";
      warning.setAttribute("role", "alert");
      warning.style.cssText = "margin:12px 0;padding:12px 14px;border:1px solid #b00020;border-radius:8px;background:#fff5f6;color:#7a0015;font-weight:700;line-height:1.4;";
      target.insertAdjacentElement("beforebegin", warning);
    }
    warning.textContent = "The shipping charge could not be confirmed, so this order was not submitted. Return to the shipping selection, choose Ship via UPS or Woodson Delivery again, and confirm that a charge appears in the order summary.";
    try { warning.scrollIntoView({ behavior: "smooth", block: "center" }); } catch {}
  }

  function removeChargeError() {
    const warning = document.getElementById("wl-shipping-charge-guard");
    if (warning) warning.remove();
  }

  function allowPlaceOrder(target) {
    const decision = shippingChargeDecision({
      method: currentFulfillmentMethod(),
      nativeAmount: nativeShippingAmount(),
      promoAllowsFree: validatedFreeShippingPromoActive()
    });
    if (decision.ok) {
      removeChargeError();
      return true;
    }
    showChargeError(target);
    return false;
  }

  function blockEvent(event, target) {
    if (allowPlaceOrder(target)) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
  }

  document.addEventListener("click", function (event) {
    const target = event.target && event.target.closest ? event.target.closest(PLACE_ORDER_SELECTOR) : null;
    if (target) blockEvent(event, target);
  }, true);

  document.addEventListener("submit", function (event) {
    const target = event.submitter && event.submitter.matches && event.submitter.matches(PLACE_ORDER_SELECTOR)
      ? event.submitter
      : null;
    if (target) blockEvent(event, target);
  }, true);
})();








document.addEventListener('DOMContentLoaded', function () {
  const headers = document.querySelectorAll('th');
  headers.forEach(th => {
    if (th.textContent.trim() === 'Summary') {
      th.textContent = 'Shipping';
    }
  });
});









(function ($) {
  function initDeliveryWidget() {
    var $area = $('#ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_lstDeliveryAreas'),
        $opts = $('#ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_DeliveryOptionsDropDownList'),
        $summary = $('#SummaryEntry2'),
        $panel = $('#ctl00_PageBody_CartSummary2_DeliveryOptionsPanel');

    if (!$area.length || !$opts.length || !$area.is(':visible') || !$opts.is(':visible')) return;

    // Hide the select boxes (not removed for ASP.NET postback support)
    $area.closest('tr').css({
      position: 'absolute', width: '1px', height: '1px',
      overflow: 'hidden', clip: 'rect(1px, 1px, 1px, 1px)',
      clipPath: 'inset(50%)', whiteSpace: 'nowrap'
    });

    $opts.closest('tr').css({
      position: 'absolute', width: '1px', height: '1px',
      overflow: 'hidden', clip: 'rect(1px, 1px, 1px, 1px)',
      clipPath: 'inset(50%)', whiteSpace: 'nowrap'
    });

    $summary.find('.summaryTotals tr').filter(function () {
      return $(this).find('td:first').text().trim() === 'Total discount';
    }).hide();

    if (!$summary.find('.summary-card').length) {
      $summary.wrapInner(
        '<div class="card summary-card shadow-sm mb-4"><div class="card-body p-3"></div></div>'
      );
      $summary.find('.summaryTotals').addClass('table table-borderless mb-0');
    }

    $summary.prev('.shipping-card').remove();
    $summary.prev('.expected-widget').remove(); // clean up existing widget

    var standardText = $opts.find('option[value="-1"]').text(),
        mstd = standardText.match(/\(([^)]+)\)/),
        standardCost = mstd ? parseFloat(mstd[1].replace(/[^0-9\.-]/g, '')) : 0;

    var fulfillmentMethod = '';
    try { fulfillmentMethod = sessionStorage.getItem('wl_fulfillment_method') || ''; } catch (e) {}

    var $ship = $(
      '<div class="card shipping-card shadow-sm mb-4">' +
        '<div class="card-header bg-light"><strong>' + (fulfillmentMethod === 'ship' ? 'UPS Shipping Speed' : 'Woodson Local Delivery') + '</strong></div>' +
        '<div class="card-body">' +
          '<div class="delivery-summary text-muted small mb-2"></div>' +
          '<div class="delivery-pills d-flex flex-wrap mb-2"></div>' +
        '</div>' +
      '</div>'
    );

    if ($panel.length) {
      var summaryText = $panel.clone().children().first().html();
      if (summaryText) {
        $ship.find('.delivery-summary').html(summaryText);
      }
      $panel.css({
        position: 'absolute', width: '1px', height: '1px',
        overflow: 'hidden', clip: 'rect(1px, 1px, 1px, 1px)',
        clipPath: 'inset(50%)', whiteSpace: 'nowrap'
      });
    }

    function computeExpected(days) {
      const total = new Date();
      let remaining = Math.max(1, Number(days) || 1) + 1;
      while (remaining > 0) {
        total.setDate(total.getDate() + 1);
        if (total.getDay() !== 0 && total.getDay() !== 6) remaining -= 1;
      }
      return total.toLocaleDateString(undefined, {
        month: 'long', day: 'numeric', year: 'numeric'
      });
    }

    function rememberShippingChoice(label, cost, days) {
      try {
        sessionStorage.setItem('wl_shipping_selection_v1', JSON.stringify({
          label: label,
          cost: cost,
          arrival: computeExpected(days),
          ts: Date.now()
        }));
      } catch (e) {}
    }

    function getArrowGraphic(speedLevel) {
      const totalArrows = 8;
      let arrows = '';
      for (let i = 1; i <= totalArrows; i++) {
        arrows += i <= speedLevel
          ? '<span class="maroon-arrow">➤</span>'
          : '<span class="gray-arrow">➤</span>';
      }
      return arrows;
    }

    function getSpeedLabel(speedLevel) {
      switch (speedLevel) {
        case 1: return 'Slowest Shipping';
        case 3: return 'Moderate Speed';
        case 6: return 'Fast Shipping';
        case 8: return 'Fastest Shipping';
        default: return 'Estimated Shipping';
      }
    }

    // Expected widget that appears after shipping card
    const $expectedWidget = $(
      '<div class="expected-widget text-center my-3">' +
        '<div class="shipping-speed-graphic mb-2"></div>' +
        '<div class="expected-by-text fw-bold fs-5 text-maroon"></div>' +
      '</div>'
    );

    $opts.find('option').each(function () {
      const $o = $(this),
            txt = $o.text().trim(),
            label = txt.replace(/\s*\(.*\)/, '').trim(),
            extraMatch = txt.match(/\(([^)]+)\)/),
            extraRaw = extraMatch ? extraMatch[1] : '',
            extra = parseFloat(extraRaw.replace(/[^0-9\.-]/g, '')) || 0,
            rawCost = $o.val() === '-1' ? standardCost : standardCost + extra,
            cost = rawCost,
            costLbl = '$' + cost.toFixed(2),
            costHtml = costLbl,
            days = /Next\s*Day/i.test(txt) ? 1 :
                   /2nd\s*Day/i.test(txt)  ? 2 :
                   /3\s*Day/i.test(txt)    ? 3 : 5,
            speedLevel = /Next\s*Day/i.test(txt) ? 8 :
                         /2nd\s*Day/i.test(txt)  ? 6 :
                         /3\s*Day/i.test(txt)    ? 3 : 1,
            $btn = $('<button type="button" class="btn btn-outline-primary m-1">' +
                    label + '<br><small>' + costHtml + '</small></button>');

      if ($o.is(':selected')) {
        $btn.removeClass('btn-outline-primary').addClass('btn-primary');
        $expectedWidget.find('.shipping-speed-graphic').html(getArrowGraphic(speedLevel));
        $expectedWidget.find('.expected-by-text').text('Estimated arrival: ' + computeExpected(days));
        rememberShippingChoice(label, costLbl, days);
      }

      $btn.on('click', function () {
        $opts.val($o.val()).change();
        $ship.find('button')
          .removeClass('btn-primary')
          .addClass('btn-outline-primary');
        $btn.removeClass('btn-outline-primary').addClass('btn-primary');
        $expectedWidget.find('.shipping-speed-graphic').html(getArrowGraphic(speedLevel));
        $expectedWidget.find('.expected-by-text').text('Estimated arrival: ' + computeExpected(days));
        rememberShippingChoice(label, costLbl, days);
      });

      $ship.find('.delivery-pills').append($btn);
    });

    $summary.before($expectedWidget);
    $summary.before($ship);
  }

  $(initDeliveryWidget);
  document.addEventListener('wl:shipping-offer-change', initDeliveryWidget);

  if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager) {
    Sys.WebForms.PageRequestManager.getInstance()
      .add_endRequest(initDeliveryWidget);
  }
})(jQuery);

(function () {
  const METHOD_KEY = "wl_fulfillment_method";
  const CONTINUE_ID = "ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView";

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
  }

  function hasShippingChoice() {
    const selectors = [
      "#ctl00_PageBody_CartSummary2_DeliveryOptionsPanel select:not([id*='lstDeliveryAreas'])",
      "#ctl00_PageBody_CartSummary2_DeliveryOptionsPanel input:not([type='hidden'])",
      "[id*='PromotionCode'] input:not([type='hidden'])",
      "[id*='PromoCode'] input:not([type='hidden'])",
      ".delivery-pills button"
    ];
    return selectors.some(function (selector) {
      return Array.from(document.querySelectorAll(selector)).some(isVisible);
    });
  }

  function addPickupProgress() {
    if (document.getElementById("wl-pickup-payment-progress")) return;
    const main = document.querySelector(".mainContents");
    if (!main) return;
    const status = document.createElement("div");
    status.id = "wl-pickup-payment-progress";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.textContent = "Preparing your payment options...";
    status.style.cssText = "max-width:720px;margin:24px auto;padding:18px;text-align:center;font-weight:700;color:#3d4248;background:#f4f5f6;border:1px solid #d9dde2;border-radius:6px;";
    main.insertBefore(status, main.firstChild);
  }

  function autoAdvancePickupShipping() {
    if (window.__wlPickupShippingAutoAdvance) return;

    let method = "";
    try { method = sessionStorage.getItem(METHOD_KEY) || ""; } catch {}
    // UPS shipping must remain on this screen so the customer can choose a speed.
    // Woodson delivery uses the unified rate bridge and returns one recommended rate,
    // so the default option can be accepted without asking the customer to choose speed.
    if (method !== "pickup" && method !== "delivery") return;

    if (method === "delivery") {
      const options = document.querySelector("#ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_DeliveryOptionsDropDownList");
      if (options && options.options.length) {
        options.selectedIndex = 0;
        try { options.dispatchEvent(new Event("change", { bubbles: true })); } catch {}
      }
    }

    const continueButton = document.getElementById(CONTINUE_ID);
    if (!continueButton || (method === "pickup" && hasShippingChoice())) return;

    window.__wlPickupShippingAutoAdvance = true;
    addPickupProgress();
    window.setTimeout(function () {
      if (document.documentElement.contains(continueButton)) continueButton.click();
    }, 180);
  }

  function bootPickupAdvance() {
    autoAdvancePickupShipping();
    window.setTimeout(autoAdvancePickupShipping, 350);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootPickupAdvance, { once: true });
  } else {
    bootPickupAdvance();
  }

  try {
    const manager = window.Sys && window.Sys.WebForms && window.Sys.WebForms.PageRequestManager
      ? window.Sys.WebForms.PageRequestManager.getInstance()
      : null;
    if (manager && !manager.__wlPickupShippingAdvanceHooked) {
      manager.__wlPickupShippingAdvanceHooked = true;
      manager.add_endRequest(bootPickupAdvance);
    }
  } catch {}
})();

















(function ($) {
  function hideDeliveryPanelIfOnlyAreaDropdownShown() {
    var $areaDropdown = $('#ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_lstDeliveryAreas');
    var $deliveryPanel = $('#ctl00_PageBody_CartSummary2_DeliveryOptionsPanel');

    // Bail if either doesn't exist
    if (!$areaDropdown.length || !$deliveryPanel.length) return;

    // Hide delivery panel if only area dropdown is shown
    var $otherVisibleSelects = $deliveryPanel.find('select').filter(function () {
      return $(this).attr('id') !== $areaDropdown.attr('id') && $(this).is(':visible');
    });

    if ($areaDropdown.is(':visible') && $otherVisibleSelects.length === 0) {
      $deliveryPanel.css({
        position: 'absolute',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
        clip: 'rect(1px, 1px, 1px, 1px)',
        clipPath: 'inset(50%)',
        whiteSpace: 'nowrap'
      });
    }

    // Hide "Total discount" row wherever it appears
    $('tr').filter(function () {
      return $(this).find('td:first').text().trim() === 'Total discount';
    }).hide();
  }

  // Run on load
  $(hideDeliveryPanelIfOnlyAreaDropdownShown);

  // Run on partial postbacks
  if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager) {
    Sys.WebForms.PageRequestManager.getInstance()
      .add_endRequest(hideDeliveryPanelIfOnlyAreaDropdownShown);
  }
})(jQuery);
