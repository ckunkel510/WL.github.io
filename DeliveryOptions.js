
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

  // Only run if both selects are present and visible
  if ($areaSelect.length && $optSelect.length &&
      $areaSelect.is(':visible') && $optSelect.is(':visible')) {

    console.log('[DeliveryOptions] Replacing dropdown with inline selector');

    // Parse base delivery cost
    var baseCostText = $('#ctl00_PageBody_CartSummary2_DeliveryCostsRow td.numeric')
                         .text().trim();
    var baseCost = parseFloat(baseCostText.replace(/[^0-9.-]/g, ''));

    // Build inline buttons container
    var $inline = $('<div class="delivery-options-inline mb-3"></div>');

    $optSelect.find('option').each(function(){
      var $opt  = $(this);
      var val   = $opt.val();
      var txt   = $opt.text().trim();

      // Extract label and cost info
      var label = txt.replace(/\s*\(.*\)/, '').trim();
      var m     = txt.match(/\(([^)]+)\)/);
      var costInfo = m ? m[1] : '';
      var totalCost = baseCost;
      if (costInfo.startsWith('+')) {
        var diff = parseFloat(costInfo.replace(/[^0-9.-]/g, ''));
        totalCost = baseCost + diff;
      } else {
        totalCost = parseFloat(costInfo.replace(/[^0-9.-]/g, ''));
      }
      var costLabel = '$' + totalCost.toFixed(2);

      // Create button
      var $btn = $('<button type="button" class="delivery-option-btn btn btn-outline-secondary me-2 mb-2"></button>');
      $btn.text(label + ' — ' + costLabel);
      $btn.data('value', val);

      // Highlight selected
      if ($opt.is(':selected')) {
        $btn.addClass('active btn-primary').removeClass('btn-outline-secondary');
      }

      // Click handler
      $btn.on('click', function(){
        // Update the original select value
        $optSelect.val($(this).data('value'));
        // Visually update buttons
        $inline.find('button').removeClass('btn-primary active').addClass('btn-outline-secondary');
        $(this).addClass('btn-primary active').removeClass('btn-outline-secondary');
        // Fire postback just like the onchange
        setTimeout(function(){
          __doPostBack(
            'ctl00$PageBody$CartSummary2$LocalDeliveryChargeControl$DeliveryOptionsDropDownList',
            ''
          );
        }, 0);
      });

      $inline.append($btn);
    });

    // Hide the original area + option rows
    $areaSelect.closest('tr').hide();
    $optSelect.closest('tr').hide();

    // Insert our inline selector at the top of the LocalDeliveryPanel
    $('#ctl00_PageBody_CartSummary2_LocalDeliveryPanel').prepend($inline);
  }
});

