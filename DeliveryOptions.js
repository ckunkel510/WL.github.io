
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








document.addEventListener('DOMContentLoaded', function () {
  const headers = document.querySelectorAll('th');
  headers.forEach(th => {
    if (th.textContent.trim() === 'Summary') {
      th.textContent = 'Shipping Options';
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

    var $ship = $(
      '<div class="card shipping-card shadow-sm mb-4">' +
        '<div class="card-header bg-light"><strong>Shipping Method</strong></div>' +
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
      const now = new Date();
      const total = new Date(now.getTime() + (days + 2) * 86400000);
      return total.toLocaleDateString(undefined, {
        month: 'long', day: 'numeric', year: 'numeric'
      });
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
            cost = $o.val() === '-1' ? standardCost : standardCost + extra,
            costLbl = '$' + cost.toFixed(2),
            days = /Next\s*Day/i.test(txt) ? 1 :
                   /2nd\s*Day/i.test(txt)  ? 2 :
                   /3\s*Day/i.test(txt)    ? 3 : 5,
            speedLevel = /Next\s*Day/i.test(txt) ? 8 :
                         /2nd\s*Day/i.test(txt)  ? 6 :
                         /3\s*Day/i.test(txt)    ? 3 : 1,
            $btn = $('<button type="button" class="btn btn-outline-primary m-1">' +
                    label + '<br><small>' + costLbl + '</small></button>');

      if ($o.is(':selected')) {
        $btn.removeClass('btn-outline-primary').addClass('btn-primary');
        $expectedWidget.find('.shipping-speed-graphic').html(getArrowGraphic(speedLevel));
        $expectedWidget.find('.expected-by-text').html(getSpeedLabel(speedLevel) + ' – Expected by ' + computeExpected(days));
      }

      $btn.on('click', function () {
        $opts.val($o.val()).change();
        $ship.find('button')
          .removeClass('btn-primary')
          .addClass('btn-outline-primary');
        $btn.removeClass('btn-outline-primary').addClass('btn-primary');
        $expectedWidget.find('.shipping-speed-graphic').html(getArrowGraphic(speedLevel));
        $expectedWidget.find('.expected-by-text').html(getSpeedLabel(speedLevel) + ' – Expected by ' + computeExpected(days));
      });

      $ship.find('.delivery-pills').append($btn);
    });

    $summary.before($expectedWidget);
    $summary.before($ship);
  }

  $(initDeliveryWidget);

  if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager) {
    Sys.WebForms.PageRequestManager.getInstance()
      .add_endRequest(initDeliveryWidget);
  }
})(jQuery);

















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









