
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











(function(){
  // Utility to add business days
  function addBusinessDays(date, days) {
    var d = new Date(date);
    while (days > 0) {
      d.setDate(d.getDate() + 1);
      var wd = d.getDay();
      if (wd > 0 && wd < 6) days--;
    }
    return d;
  }

  // Main initializer
  function initializeDeliveryWidget() {
    var $summary   = $('#SummaryEntry2');
    var $optSelect = $('#ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl$DeliveryOptionsDropDownList, #ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_DeliveryOptionsDropDownList');
    // ensure we have the real dropdown
    $optSelect = $('#ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_DeliveryOptionsDropDownList');
    if (!$summary.length || !$optSelect.length || !$optSelect.is(':visible')) return;
    console.log("[DeliveryOptions] Initializing widget");

    // Remove any previous widgets
    $('.shipping-method-widget, .order-totals-widget').remove();
    $summary.find('.summaryTotals').hide();
    $summary.find('.summaryTotals tr').filter((_,tr) =>
      $(tr).find('td:first').text().trim() === 'Total discount'
    ).hide();
    $summary.find('#ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_lstDeliveryAreas').closest('tr').hide();
    $optSelect.closest('tr').hide();

    // Grab up‐to‐date values
    var subtotalText = $summary.find('tr:has(td:contains("Subtotal")) .numeric').text().trim();
    var deliveryText = $summary.find('#ctl00_PageBody_CartSummary2_DeliveryCostsRow .numeric').text().trim();
    var taxText      = $summary.find('#ctl00_PageBody_CartSummary2_TaxTotals .numeric').text().trim();
    var totalText    = $summary.find('#ctl00_PageBody_CartSummary2_GrandTotalRow .numeric').text().trim();
    var baseCost     = parseFloat(deliveryText.replace(/[^0-9.-]/g, ''));

    // Build shipping options array
    var transitMap = { 'Standard delivery':5,'3 Day Select':3,'2nd Day Air':2,'Next Day Air':1 };
    var descMap    = {
      'Standard delivery':'Traditional Ground',
      '3 Day Select':'3 Day Service',
      '2nd Day Air':'2nd Day Air',
      'Next Day Air':'Next Day Air'
    };
    var shippingOptions = $optSelect.find('option').map(function(){
      var $o   = $(this),
          txt  = $o.text().trim(),
          label= txt.replace(/\s*\(.*\)/,'').trim(),
          extra= (txt.match(/\(([^)]+)\)/)||[])[1]||'',
          cost = extra.startsWith('+')
            ? baseCost + parseFloat(extra.replace(/[^0-9.-]/g,''))
            : parseFloat(extra.replace(/[^0-9.-]/g,''))||baseCost;
      return {
        value:       $o.val(),
        label:       label,
        costLabel:   '$' + cost.toFixed(2),
        transitDays: transitMap[label] || 0,
        description: descMap[label]    || label
      };
    }).get();

    // Build Shipping Method card
    var $shipCard = $(`
      <div class="card mb-3 shipping-method-widget">
        <div class="card-body p-3">
          <h5 class="card-title mb-3">Shipping Method</h5>
        </div>
      </div>
    `);
    var $shipBody = $shipCard.find('.card-body');
    var $list     = $('<div class="d-flex flex-column mb-3"></div>');

    shippingOptions.forEach(opt => {
      var selected = $optSelect.val() === opt.value;
      var $btn = $(`
        <button type="button" class="btn mb-2 text-start ${selected ? 'btn-primary' : 'btn-outline-primary'}">
          <div class="fw-semibold">${opt.label}</div>
          <div class="fw-bold text-white">${opt.costLabel}</div>
        </button>
      `).data('opt', opt);

      $btn.on('click', function(){
        localStorage.setItem('selectedShippingValue', opt.value);
        $optSelect.val(opt.value);
        // trigger the real postback
        __doPostBack(
          'ctl00$PageBody$CartSummary2$LocalDeliveryChargeControl$DeliveryOptionsDropDownList',''
        );
      });

      $list.append($btn);
    });

    $shipBody.append($list);

    // Change Shipping Speed button
    var $changeBtn = $(`
      <button type="button" class="btn btn-link mb-3" style="display:none;">
        Change Shipping Speed
      </button>
    `).on('click', function(){
      localStorage.removeItem('selectedShippingValue');
      initializeDeliveryWidget(); // re-render fresh
    });
    $shipBody.append($changeBtn);

    // Build Totals card
    var $totalsCard = $(`
      <div class="card order-totals-widget mb-3">
        <div class="card-body p-3">
          <h5 class="card-title mb-3">Order Summary</h5>
        </div>
      </div>
    `);
    var $totalsBody = $totalsCard.find('.card-body');
    function row(label, value, strong) {
      var tag = strong ? 'strong' : 'span';
      return $(`
        <div class="d-flex justify-content-between mb-2">
          <${tag}>${label}</${tag}><${tag}>${value}</${tag}>
        </div>
      `);
    }
    $totalsBody
      .append(row('Subtotal',       subtotalText))
      .append(row('Delivery',       deliveryText))
      .append(row('Tax',            taxText))
      .append('<hr>')
      .append(row('Total (inc. Tax)', totalText, true));

    // Inject cards
    $summary.empty()
            .append($shipCard)
            .append($totalsCard);
  }

  // Kick off on load and after ASP.NET partial postbacks
  $(document).ready(initializeDeliveryWidget);
  if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager) {
    Sys.WebForms.PageRequestManager.getInstance()
      .add_endRequest(initializeDeliveryWidget);
  }
})();


















