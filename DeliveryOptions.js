
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
  // encapsulate all of our injection logic
  function initDeliveryOptions() {
    var $areaSelect = $('#ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_lstDeliveryAreas'),
        $optSelect  = $('#ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_DeliveryOptionsDropDownList'),
        $summary    = $('#SummaryEntry2');

    // only run on delivered flow when both selects exist & are visible
    if (!$areaSelect.length || !$optSelect.length || 
        !$areaSelect.is(':visible') || !$optSelect.is(':visible')) {
      return;
    }

    console.log('[DeliveryOptions] Modernizing summary & delivery selector');

    // hide Total discount row
    $summary.find('.summaryTotals tr').filter(function(){
      return $(this).find('td:first').text().trim() === 'Total discount';
    }).hide();

    // wrap summary in a card (once)
    if (!$summary.find('.summary-card').length) {
      $summary.wrapInner('<div class="card summary-card shadow-sm mb-3 p-3"></div>')
              .find('.summaryTotals').addClass('table table-borderless mb-0');
    }

    // build inline pills container (remove old if re-running)
    $summary.find('.delivery-options-inline').remove();
    var baseCost = parseFloat(
      $('#ctl00_PageBody_CartSummary2_DeliveryCostsRow td.numeric')
        .text().replace(/[^0-9\.-]/g,'')
    );
    var $inline = $('<div class="delivery-options-inline d-flex flex-wrap mb-3"></div>');

    // for each <option> create a pill
    $optSelect.find('option').each(function(){
      var $opt    = $(this),
          txt     = $opt.text().trim(),
          label   = txt.replace(/\s*\(.*\)/,'').trim(),
          match   = txt.match(/\(([^)]+)\)/),
          extra   = match ? match[1] : '',
          total   = extra.startsWith('+')
                    ? baseCost + parseFloat(extra.replace(/[^0-9\.-]/g,'')) 
                    : parseFloat(extra.replace(/[^0-9\.-]/g,'')) || baseCost,
          costLbl = '$' + total.toFixed(2),
          $btn    = $(
            `<button type="button" class="btn btn-outline-primary m-1">
               ${label}<br><small>${costLbl}</small>
             </button>`
          );

      // highlight currently selected option
      if ($opt.is(':selected')) {
        $btn.removeClass('btn-outline-primary').addClass('btn-primary');
      }

      $btn.on('click', function(){
        // set the dropdown to this value and fire its native change
        $optSelect.val($opt.val()).change();

        // update pill styles
        $inline.find('button')
               .removeClass('btn-primary')
               .addClass('btn-outline-primary');
        $btn.removeClass('btn-outline-primary')
            .addClass('btn-primary');
      });

      $inline.append($btn);
    });

    // prepend pills into the delivery panel
    $('#ctl00_PageBody_CartSummary2_LocalDeliveryPanel')
      .prepend($inline);
  }

  // wire up on initial load...
  $(document).ready(initDeliveryOptions);

  // ...and after any ASP.NET AJAX partial postback
  if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager) {
    Sys.WebForms.PageRequestManager.getInstance()
       .add_endRequest(initDeliveryOptions);
  }
})(jQuery);


























