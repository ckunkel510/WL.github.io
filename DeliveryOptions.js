
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
  // Add business days (skip weekends)
  function addBusinessDays(date, days) {
    var d = new Date(date);
    while (days > 0) {
      d.setDate(d.getDate() + 1);
      var wd = d.getDay();
      if (wd > 0 && wd < 6) days--;
    }
    return d;
  }

  function initializeDeliveryWidget() {
    var $summary   = $('#SummaryEntry2');
    var $select    = $('#ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_DeliveryOptionsDropDownList');
    if (!$summary.length || !$select.length || !$select.is(':visible')) return;

    console.log("[DeliveryOptions] Initializing widget");

    // Remove old
    $('.shipping-method-widget, .order-totals-widget').remove();

    // Hide originals
    $summary.find('.summaryTotals').hide();
    $summary.find('.summaryTotals tr')
      .filter((_,tr) => $(tr).find('td:first').text().trim()==='Total discount')
      .hide();
    $('#ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_lstDeliveryAreas').closest('tr').hide();
    $select.closest('tr').hide();

    // Read summary values
    var subtotal = $summary.find('tr:has(td:contains("Subtotal")) .numeric').text().trim();
    var delivery = $summary.find('#ctl00_PageBody_CartSummary2_DeliveryCostsRow .numeric').text().trim();
    var tax      = $summary.find('#ctl00_PageBody_CartSummary2_TaxTotals .numeric').text().trim();
    var total    = $summary.find('#ctl00_PageBody_CartSummary2_GrandTotalRow .numeric').text().trim();
    var baseCost = parseFloat(delivery.replace(/[^0-9.-]/g,''));

    // Build options data
    var transitMap = { 'Standard delivery':5,'3 Day Select':3,'2nd Day Air':2,'Next Day Air':1 };
    var descMap    = {
      'Standard delivery':'Traditional Ground',
      '3 Day Select':'3 Day Service',
      '2nd Day Air':'2nd Day Air',
      'Next Day Air':'Next Day Air'
    };
    var opts = $select.find('option').map(function(){
      var txt = $(this).text().trim();
      var label = txt.replace(/\s*\(.*\)/,'').trim();
      var extra = (txt.match(/\(([^)]+)\)/)||[])[1]||'';
      var cost = extra.startsWith('+')
        ? baseCost + parseFloat(extra.replace(/[^0-9.-]/g,''))
        : parseFloat(extra.replace(/[^0-9.-]/g,''))||baseCost;
      return {
        value: $(this).val(),
        label,
        costLabel: '$'+cost.toFixed(2),
        transitDays: transitMap[label]||0,
        description: descMap[label]||label
      };
    }).get();

    // Shipping Method card
    var $shipCard = $(`
      <div class="card mb-3 shipping-method-widget">
        <div class="card-body p-3">
          <h5 class="card-title mb-3">Shipping Method</h5>
        </div>
      </div>`);
    var $shipBody = $shipCard.find('.card-body');
    var $list     = $('<div class="d-flex flex-column mb-3"></div>');

    // Build buttons
    opts.forEach(opt => {
      var selected = ($select.val() === opt.value);
      var $btn = $(`<button type="button" class="btn mb-2 text-start"></button>`)
        .append(`<div class="fw-semibold">${opt.label}</div>`)
        .append(`<div class="fw-bold text-white">${opt.costLabel}</div>`)
        .data('opt', opt)
        .toggleClass('btn-primary', selected)
        .toggleClass('btn-outline-primary', !selected);

      $btn.on('click', function(){
        // on user click only: store and postback
        localStorage.setItem('selectedShippingValue', opt.value);
        $select.val(opt.value);
        __doPostBack(
          'ctl00$PageBody$CartSummary2$LocalDeliveryChargeControl$DeliveryOptionsDropDownList',''
        );
      });
      $list.append($btn);
    });

    $shipBody.append($list);

    // Change Speed button
    var $change = $(`<button type="button" class="btn btn-link mb-3">Change Shipping Speed</button>`)
      .on('click', function(){
        localStorage.removeItem('selectedShippingValue');
        renderSelection(); // just re-render UI without posting back
      }).hide();
    $shipBody.append($change);

    // Totals card
    var $totalsCard = $(`
      <div class="card order-totals-widget mb-3">
        <div class="card-body p-3">
          <h5 class="card-title mb-3">Order Summary</h5>
        </div>
      </div>`);
    var $totalsBody = $totalsCard.find('.card-body');
    function row(label,val,strong){
      var tag = strong?'strong':'span';
      return $(`<div class="d-flex justify-content-between mb-2">
        <${tag}>${label}</${tag}><${tag}>${val}</${tag}>
      </div>`);
    }
    $totalsBody
      .append(row('Subtotal',subtotal))
      .append(row('Delivery',delivery))
      .append(row('Tax',tax))
      .append('<hr>')
      .append(row('Total (inc. Tax)',total,true));

    // Inject
    $summary.empty().append($shipCard).append($totalsCard);

    // Render selection without triggering postback
    renderSelection();

    function renderSelection(){
      var sel = localStorage.getItem('selectedShippingValue');
      $shipBody.find('.shipping-banner').remove();
      $list.find('button').each(function(){
        var o = $(this).data('opt');
        var isSel = sel? o.value===sel : $select.val()===o.value;
        $(this)
          .toggleClass('btn-primary',  isSel)
          .toggleClass('btn-outline-primary', !isSel)
          .toggle(true); // always show buttons
        if (isSel){
          // banner
          var dt = addBusinessDays(new Date(), o.transitDays+1);
          var ds = dt.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
          var $b = $(`<div class="alert alert-info shipping-banner mb-3">
            <strong>${o.description}</strong><br>Expected arrival: ${ds}
          </div>`);
          $shipBody.prepend($b);
          if (sel) {
            // hide others only after initial render?
            $list.find('button').not(this).hide();
            $change.show();
          }
        }
      });
    }
  }

  // Bind
  $(document).ready(initializeDeliveryWidget);
  if (window.Sys?.WebForms?.PageRequestManager) {
    Sys.WebForms.PageRequestManager.getInstance().add_endRequest(initializeDeliveryWidget);
  }
})();




















