
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
    const $select  = $('#ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_DeliveryOptionsDropDownList');
    if (!$summary.length || !$select.length) {
      console.log('[DeliveryOptions] Summary or select not present; abort');
      return;
    }
    console.log('[DeliveryOptions] Initializing widget');

    // hide original dropdown off-screen but keep in DOM for ASP.NET onchange
    $select.css({ position: 'absolute', left: '-9999px', opacity: 0 });

    // cleanup old
    $('.shipping-method-widget, .order-totals-widget').remove();

    // extract summary values
    const subtotalText = $summary.find('tr:has(td:contains("Subtotal")) .numeric').text().trim();
    const deliveryText = $summary.find('#ctl00_PageBody_CartSummary2_DeliveryCostsRow .numeric').text().trim();
    const taxText      = $summary.find('#ctl00_PageBody_CartSummary2_TaxTotals .numeric').text().trim();
    const totalText    = $summary.find('#ctl00_PageBody_CartSummary2_GrandTotalRow .numeric').text().trim();
    console.log('[DeliveryOptions] Summary values:', {subtotalText, deliveryText, taxText, totalText});

    const baseCost = parseFloat(deliveryText.replace(/[^0-9.-]/g, ''));

    // remove original table rows for area and select
    $summary.find('.summaryTotals').remove();
    $('#ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_lstDeliveryAreas').closest('tr').remove();
    $select.closest('tr').remove();

    // parse options
    const transitMap = { 'Standard delivery':5,'3 Day Select':3,'2nd Day Air':2,'Next Day Air':1 };
    const descMap    = { 'Standard delivery':'Traditional Ground','3 Day Select':'3 Day Service','2nd Day Air':'2nd Day Air','Next Day Air':'Next Day Air' };
    const options = [];
    $select.find('option').each(function(){
      const $o = $(this);
      const txt = $o.text().trim();
      const label = txt.replace(/\s*\(.*\)/, '').trim();
      const extra = (txt.match(/\(([^)]+)\)/)||[])[1]||'';
      let cost = baseCost;
      if (extra.startsWith('+')) cost = baseCost + parseFloat(extra.replace(/[^0-9.-]/g,''));
      else {
        const p = parseFloat(extra.replace(/[^0-9.-]/g,''));
        if (!isNaN(p) && extra.indexOf('+')<0) cost = p;
      }
      options.push({ value:$o.val(), label, costLabel:'$'+cost.toFixed(2), transitDays: transitMap[label]||0, description: descMap[label]||label });
    });
    console.log('[DeliveryOptions] Parsed options:', options);

    // build widget
    const $shipCard = $(
      `<div class="card mb-3 shipping-method-widget">
         <div class="card-body p-3">
           <h5 class="card-title mb-3">Shipping Method</h5>
         </div>
       </div>`
    );
    const $shipBody = $shipCard.find('.card-body');
    const $list     = $('<div class="d-flex flex-column mb-3"></div>');

    options.forEach(opt => {
      const selected = ($select.val() === opt.value);
      const $btn = $(
        `<button type="button" class="btn mb-2 text-start ${selected?'btn-primary':'btn-outline-primary'}">
           <div class="fw-semibold">${opt.label}</div>
           <div class="fw-bold text-white">${opt.costLabel}</div>
         </button>`
      ).data('opt', opt);

      $btn.on('click', () => {
        console.log('[DeliveryOptions] Clicked option:', opt);
        // update original select value to trigger native onchange
        $select.val(opt.value).trigger('change');
      });
      $list.append($btn);
    });
    $shipBody.append($list);

    // change button
    const $changeBtn = $('<button type="button" class="btn btn-link mb-3">Change Shipping Speed</button>')
      .on('click', () => {
        console.log('[DeliveryOptions] Change clicked');
        $select.val(options[0].value).trigger('change');
      });
    $shipBody.append($changeBtn);

    // order totals widget
    const $totalsCard = $(
      `<div class="card order-totals-widget mb-3">
         <div class="card-body p-3">
           <h5 class="card-title mb-3">Order Summary</h5>
         </div>
       </div>`
    );
    const $totalsBody = $totalsCard.find('.card-body');
    function row(label,value,strong){
      const tag=strong?'strong':'span';
      return $(`<div class="d-flex justify-content-between mb-2"><${tag}>${label}</${tag}><${tag}>${value}</${tag}></div>`);
    }
    $totalsBody.append(row('Subtotal',subtotalText))
               .append(row('Delivery',deliveryText))
               .append(row('Tax',taxText))
               .append('<hr>')
               .append(row('Total (inc. Tax)',totalText,true));

    $summary.empty().append($shipCard).append($totalsCard);

    function renderSelection() {
      const sel = $select.val();
      console.log('[DeliveryOptions] renderSelection; selected:', sel);
      $shipBody.find('.shipping-banner').remove();
      $list.children('button').each(function(){
        const o = $(this).data('opt');
        const isSel = (o.value===sel);
        console.log(`[DeliveryOptions] ${o.label} selected? ${isSel}`);
        if (isSel) {
          $(this).removeClass('btn-outline-primary').addClass('btn-primary');
          const arr = addBusinessDays(new Date(), o.transitDays+1);
          const ds = arr.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
          $shipBody.prepend(
            `<div class="alert alert-info shipping-banner mb-3">
               <strong>${o.description}</strong><br>
               Expected arrival: ${ds}
             </div>`
          );
        } else {
          $(this).removeClass('btn-primary').addClass('btn-outline-primary');
        }
      });
    }

    // initial render
    renderSelection();

    // re-render after any partial postback
    if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager) {
      Sys.WebForms.PageRequestManager.getInstance().add_endRequest(renderSelection);
    }
  }

  $(document).ready(initializeDeliveryWidget);
  if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager) {
    Sys.WebForms.PageRequestManager.getInstance().add_endRequest(initializeDeliveryWidget);
  }
})();

























