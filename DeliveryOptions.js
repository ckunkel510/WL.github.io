
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







$(function(){
  var $areaSelect = $('#ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_lstDeliveryAreas');
  var $optSelect  = $('#ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_DeliveryOptionsDropDownList');
  var $summary    = $('#SummaryEntry2');

  // Only run on delivered flow when those selects are visible
  if ($areaSelect.is(':visible') && $optSelect.is(':visible')) {
    console.log('[DeliveryOptions] Modernizing summary & delivery selector');

    // 1) Hide the Total discount row
    $summary.find('.summaryTotals tr').filter(function(){
      return $(this).find('td:first').text().trim() === 'Total discount';
    }).hide();

    // 2) Wrap the summary in a Bootstrap card (only once)
    if (!$summary.find('.summary-card').length) {
      $summary.wrapInner('<div class="card summary-card shadow-sm mb-3"></div>');
      $summary.find('.summary-card').addClass('p-3');
      // Make the table borderless
      $summary.find('.summaryTotals').addClass('table table-borderless mb-0');
    }

    // 3) Build inline delivery-options pills
    var baseCost = parseFloat(
      $('#ctl00_PageBody_CartSummary2_DeliveryCostsRow td.numeric')
        .text().replace(/[^0-9.-]/g,'')
    );
    var $inline = $('<div class="delivery-options-inline d-flex flex-wrap mb-3"></div>');

    $optSelect.find('option').each(function(){
      var $opt = $(this);
      var txt  = $opt.text().trim();
      var label = txt.replace(/\s*\(.*\)/,'').trim();
      var m     = txt.match(/\(([^)]+)\)/);
      var extra = m ? m[1] : '';
      var total = extra.startsWith('+')
        ? baseCost + parseFloat(extra.replace(/[^0-9.-]/g,''))
        : parseFloat(extra.replace(/[^0-9.-]/g,'')) || baseCost;
      var costLabel = '$' + total.toFixed(2);

      var $btn = $(`
        <button type="button" class="btn btn-outline-primary m-1">
          ${label}<br><small>${costLabel}</small>
        </button>
      `);

      if ($opt.is(':selected')) {
        $btn.removeClass('btn-outline-primary').addClass('btn-primary');
      }

      $btn.on('click', function(){
        $optSelect.val($opt.val());
        $inline.find('button').removeClass('btn-primary').addClass('btn-outline-primary');
        $btn.removeClass('btn-outline-primary').addClass('btn-primary');
        // trigger the postback exactly like the select would
        setTimeout(function(){
          __doPostBack(
            'ctl00$PageBody$CartSummary2$LocalDeliveryChargeControl$DeliveryOptionsDropDownList',
            ''
          );
        }, 0);
      });

      $inline.append($btn);
    });

    // 4) Hide the original “Area” and “Options” rows
    $areaSelect.closest('tr').hide();
    $optSelect.closest('tr').hide();

    // 5) Inject our inline pills at the top of the panel
    $('#ctl00_PageBody_CartSummary2_LocalDeliveryPanel').prepend($inline);
  }
});



