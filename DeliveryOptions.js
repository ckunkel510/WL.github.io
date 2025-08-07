
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
  var $summary = $('#SummaryEntry2');
  if (!$summary.length) return;

  // Only run if the delivery-options dropdown is present & visible
  var $optSelect = $('#ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_DeliveryOptionsDropDownList');
  if (!$optSelect.length || !$optSelect.is(':visible')) return;

  console.log('[DeliveryOptions] Rendering modern shipping & totals widgets');

  // 1) Hide the original summary table (but leave selects in DOM)
  $summary.find('.summaryTotals').hide();

  // 2) Extract the four key numbers
  var subtotalText = $summary.find('tr:has(td:contains("Subtotal")) .numeric').text().trim();
  var deliveryText = $summary.find('#ctl00_PageBody_CartSummary2_DeliveryCostsRow .numeric').text().trim();
  var taxText      = $summary.find('#ctl00_PageBody_CartSummary2_TaxTotals .numeric').text().trim();
  var totalText    = $summary.find('#ctl00_PageBody_CartSummary2_GrandTotalRow .numeric').text().trim();

  // 3) Parse out the shipping options from the <select>
  var baseCost = parseFloat(deliveryText.replace(/[^0-9.-]/g,''));
  var shippingOptions = [];
  $optSelect.find('option').each(function(){
    var $opt = $(this), txt = $opt.text().trim();
    var label = txt.replace(/\s*\(.*\)/,'').trim();
    var extra = (txt.match(/\(([^)]+)\)/)||[])[1]||'';
    var total = baseCost;
    if (extra.startsWith('+')) {
      total = baseCost + parseFloat(extra.replace(/[^0-9.-]/g,''));
    } else {
      total = parseFloat(extra.replace(/[^0-9.-]/g,''))||baseCost;
    }
    shippingOptions.push({
      value: $opt.val(),
      label,
      costLabel: '$' + total.toFixed(2),
      selected: $opt.is(':selected')
    });
  });

  // 4) Build the Shipping Method card with inline selectable pills (vertical)
  var $shipCard = $(`
    <div class="card mb-3 shipping-method-widget">
      <div class="card-body p-3">
        <h5 class="card-title mb-3">Shipping Method</h5>
      </div>
    </div>
  `);
  var $shipBody = $shipCard.find('.card-body');
  var $list = $('<div class="d-flex flex-column"></div>');
  shippingOptions.forEach(opt => {
    var $btn = $(`
      <button type="button"
              class="btn mb-2 text-start ${opt.selected ? 'btn-primary' : 'btn-outline-primary'}">
        <div>${opt.label}</div>
        <div class="small text-muted">${opt.costLabel}</div>
      </button>
    `).data('value', opt.value);

    $btn.on('click', function(){
      // update the hidden <select> and re-postback
      $optSelect.val($(this).data('value'));
      $list.find('button').removeClass('btn-primary').addClass('btn-outline-primary');
      $(this).removeClass('btn-outline-primary').addClass('btn-primary');
      setTimeout(function(){
        __doPostBack(
          'ctl00$PageBody$CartSummary2$LocalDeliveryChargeControl$DeliveryOptionsDropDownList',
          ''
        );
      }, 0);
    });

    $list.append($btn);
  });
  $shipBody.append($list);

  // 5) Build the Totals card (vertical low→high)
  var $totalsCard = $(`
    <div class="card mb-3 order-totals-widget">
      <div class="card-body p-3">
        <h5 class="card-title mb-3">Order Summary</h5>
      </div>
    </div>
  `);
  var $totalsBody = $totalsCard.find('.card-body');
  function row(label, value, isStrong) {
    var tag = isStrong ? 'strong' : 'span';
    return $(`
      <div class="d-flex justify-content-between mb-2">
        <${tag}>${label}</${tag}>
        <${tag}>${value}</${tag}>
      </div>
    `);
  }
  $totalsBody
    .append(row('Subtotal', subtotalText))
    .append(row('Delivery', deliveryText))
    .append(row('Tax', taxText))
    .append('<hr>')
    .append(row('Total (inc. Tax)', totalText, true));

  // 6) Inject both cards at the top of the summary container
  $summary.prepend($totalsCard).prepend($shipCard);
});







