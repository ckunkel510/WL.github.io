
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





















(function($){
  // single “init” that runs on load + after any AJAX postback
  function initDeliveryWidget() {
    var $area = $('#ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_lstDeliveryAreas'),
        $opts = $('#ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_DeliveryOptionsDropDownList'),
        $summary = $('#SummaryEntry2');

    // only on the “Delivered” step if both selects are present & visible
    if (!$area.length || !$opts.length ||
        !$area.is(':visible') || !$opts.is(':visible')) {
      return;
    }

    // 1) hide the old rows
    $area.closest('tr').hide();
    $opts.closest('tr').hide();

    // 2) hide “Total discount”
    $summary.find('.summaryTotals tr').filter(function(){
      return $(this).find('td:first').text().trim()==='Total discount';
    }).hide();

    // 3) wrap summary in its own card (once)
    if (!$summary.find('.summary-card').length) {
      $summary.wrapInner(`
        <div class="card summary-card shadow-sm mb-4">
          <div class="card-body p-3"></div>
        </div>
      `);
      $summary.find('.summaryTotals')
              .addClass('table table-borderless mb-0');
    }

    // 4) build (or rebuild) the shipping‐method widget
    $summary.prev('.shipping-card').remove();  // clear old if re-run
    var baseCost = parseFloat(
      $('#ctl00_PageBody_CartSummary2_DeliveryCostsRow td.numeric')
        .text().replace(/[^0-9\.-]/g,'')
    );
    var $shipCard = $(`
      <div class="card shipping-card shadow-sm mb-4">
        <div class="card-header bg-light">
          <strong>Shipping Method</strong>
        </div>
        <div class="card-body delivery-pills d-flex flex-wrap"></div>
      </div>
    `);

    // populate one pill per <option>
    $opts.find('option').each(function(){
      var $o = $(this),
          txt = $o.text().trim(),
          label = txt.replace(/\s*\(.*\)/,'').trim(),
          m = txt.match(/\(([^)]+)\)/),
          extra = m ? m[1] : '',
          cost = extra.startsWith('+')
                 ? baseCost + parseFloat(extra.replace(/[^0-9\.-]/g,''))
                 : parseFloat(extra.replace(/[^0-9\.-]/g,'')) || baseCost,
          costLbl = '$'+cost.toFixed(2),
          $btn = $(`
            <button type="button" class="btn btn-outline-primary m-1">
              ${label}<br><small>${costLbl}</small>
            </button>
          `);

      // highlight current
      if ($o.is(':selected')) {
        $btn.removeClass('btn-outline-primary')
            .addClass('btn-primary');
      }

      // wire up
      $btn.on('click', function(){
        // set the real <select> + fire its change (posts back)
        $opts.val($o.val()).change();

        // restyle pills
        $shipCard.find('button')
                 .removeClass('btn-primary')
                 .addClass('btn-outline-primary');
        $btn.removeClass('btn-outline-primary')
            .addClass('btn-primary');
      });

      $shipCard.find('.delivery-pills').append($btn);
    });

    // 5) inject shipping widget above the summary card
    $summary.before($shipCard);
  }

  // run on whole-page load
  $(initDeliveryWidget);

  // re-run after partial postback
  if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager) {
    Sys.WebForms.PageRequestManager.getInstance()
      .add_endRequest(initDeliveryWidget);
  }
})(jQuery);



























