
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
  function addBusinessDays(date, days) {
    const d = new Date(date);
    while (days > 0) {
      d.setDate(d.getDate() + 1);
      const wd = d.getDay();
      if (wd > 0 && wd < 6) days--;
    }
    return d;
  }

  function initializeDeliveryWidget() {
    const $summary = $('#SummaryEntry2');
    const $select = $('#ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_DeliveryOptionsDropDownList');
    if (!$summary.length || !$select.length || !$select.is(':visible')) {
      console.log('[DeliveryOptions] Summary or select not visible; abort');
      return;
    }
    console.log('[DeliveryOptions] Initializing widget');

    // Clean up any existing widgets
    $('.shipping-method-widget, .order-totals-widget').remove();
    $summary.find('.summaryTotals').hide();
    $summary.find('.summaryTotals tr').filter((_, tr) =>
      $(tr).find('td:first').text().trim() === 'Total discount'
    ).hide();
    $('#ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_lstDeliveryAreas').closest('tr').hide();
    $select.closest('tr').hide();

    // Read current summary values
    const subtotalText = $summary.find('tr:has(td:contains("Subtotal")) .numeric').text().trim();
    const deliveryText = $summary.find('#ctl00_PageBody_CartSummary2_DeliveryCostsRow .numeric').text().trim();
    const taxText      = $summary.find('#ctl00_PageBody_CartSummary2_TaxTotals .numeric').text().trim();
    const totalText    = $summary.find('#ctl00_PageBody_CartSummary2_GrandTotalRow .numeric').text().trim();
    console.log('[DeliveryOptions] Summary:', {subtotalText, deliveryText, taxText, totalText});
    const baseCost = parseFloat(deliveryText.replace(/[^0-9.-]/g, ''));

    // Build options array
    const transitMap = { 'Standard delivery':5, '3 Day Select':3, '2nd Day Air':2, 'Next Day Air':1 };
    const descMap    = {
      'Standard delivery':'Traditional Ground',
      '3 Day Select':'3 Day Service',
      '2nd Day Air':'2nd Day Air',
      'Next Day Air':'Next Day Air'
    };
    const options = [];
    $select.find('option').each(function(){
      const $o = $(this);
      const txt = $o.text().trim();
      const label = txt.replace(/\s*\(.*\)/,'').trim();
      const extra = (txt.match(/\(([^)]+)\)/)||[])[1]||'';
      let cost = baseCost;
      if (extra.startsWith('+')) cost = baseCost + parseFloat(extra.replace(/[^0-9.-]/g,''));
      else {
        const p = parseFloat(extra.replace(/[^0-9.-]/g,''));
        if (!isNaN(p)) cost = p;
      }
      options.push({
        value: $o.val(),
        label,
        costLabel: '$' + cost.toFixed(2),
        transitDays: transitMap[label]||0,
        description: descMap[label]||label
      });
    });
    console.log('[DeliveryOptions] Options:', options);

    // Create Shipping Method card
    const $shipCard = $(
      `<div class="card mb-3 shipping-method-widget">
         <div class="card-body p-3">
           <h5 class="card-title mb-3">Shipping Method</h5>
         </div>
       </div>`
    );
    const $shipBody = $shipCard.find('.card-body');
    const $list = $('<div class="d-flex flex-column mb-3"></div>');

    // Build buttons
    options.forEach(opt=>{
      const isSel = ($select.val()===opt.value);
      const $btn = $(
        `<button type="button" class="btn mb-2 text-start ${isSel?'btn-primary':'btn-outline-primary'}">
           <div class="fw-semibold">${opt.label}</div>
           <div class="fw-bold text-white">${opt.costLabel}</div>
         </button>`
      ).data('opt',opt);

      $btn.on('click', function(){
        console.log('[DeliveryOptions] Clicked:', opt);
        localStorage.setItem('selectedShippingValue', opt.value);
        $select.val(opt.value);
        console.log('[DeliveryOptions] Triggering postback');
        if (typeof __doPostBack === 'function') {
          __doPostBack(
            'ctl00$PageBody$CartSummary2$LocalDeliveryChargeControl$DeliveryOptionsDropDownList',''
          );
        } else if (window.WebForm_DoPostBackWithOptions) {
          WebForm_DoPostBackWithOptions(
            new WebForm_PostBackOptions(
              'ctl00$PageBody$CartSummary2$LocalDeliveryChargeControl$DeliveryOptionsDropDownList',
              '', true,'','',false,true
            )
          );
        } else {
          console.error('[DeliveryOptions] No postback function');
        }
      });
      $list.append($btn);
    });
    $shipBody.append($list);

    // Change Shipping Speed button
    const $changeBtn = $(
      `<button type="button" class="btn btn-link mb-3" style="display:none;">Change Shipping Speed</button>`
    ).on('click', function(){
      console.log('[DeliveryOptions] Change clicked');
      localStorage.removeItem('selectedShippingValue');
      renderSelection(true);
    });
    $shipBody.append($changeBtn);

    // Create Totals card
    const $totalsCard = $(
      `<div class="card order-totals-widget mb-3">
         <div class="card-body p-3">
           <h5 class="card-title mb-3">Order Summary</h5>
         </div>
       </div>`
    );
    const $totalsBody = $totalsCard.find('.card-body');
    function row(label, value, strong) {
      const tag = strong ? 'strong' : 'span';
      return $(
        `<div class="d-flex justify-content-between mb-2">
           <${tag}>${label}</${tag}><${tag}>${value}</${tag}>
         </div>`
      );
    }
    $totalsBody
      .append(row('Subtotal', subtotalText))
      .append(row('Delivery', deliveryText))
      .append(row('Tax', taxText))
      .append('<hr>')
      .append(row('Total (inc. Tax)', totalText, true));

    // Inject cards
    $summary.empty().append($shipCard).append($totalsCard);

    // Render selection & banner
    function renderSelection(reset) {
      const sel = localStorage.getItem('selectedShippingValue');
      console.log('[DeliveryOptions] render sel=', sel, ' reset=', reset);
      $shipBody.find('.shipping-banner').remove();
      $list.children('button').each(function(){
        const o = $(this).data('opt');
        let isSel = false;
        if (!reset && sel) isSel = (o.value === sel);
        else if (!reset && !sel) isSel = ($select.val() === o.value);
        console.log('[DeliveryOptions] Option', o.label, 'isSel=', isSel);
        if (isSel) {
          $(this).show().removeClass('btn-outline-primary').addClass('btn-primary');
          const arrival = addBusinessDays(new Date(), o.transitDays + 1);
          const ds = arrival.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
          $shipBody.prepend(
            `<div class="alert alert-info shipping-banner mb-3">
               <strong>${o.description}</strong><br>
               Expected arrival: ${ds}
             </div>`
          );
        } else {
          // show unselected only on reset
          if (reset) $(this).show().removeClass('btn-primary').addClass('btn-outline-primary');
          else $(this).hide();
        }
      });
      $changeBtn.toggle(!!sel && !reset);
      console.log('[DeliveryOptions] render complete');
    }

    renderSelection(false);
  }

  // Bind initialization and partial-postbacks
  $(document).ready(initializeDeliveryWidget);
  if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager) {
    Sys.WebForms.PageRequestManager.getInstance().add_endRequest(initializeDeliveryWidget);
  }
})();
























