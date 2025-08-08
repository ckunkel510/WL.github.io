
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












(function($){
  function initDeliveryWidget() {
    var $area = $('#ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_lstDeliveryAreas'),
        $opts = $('#ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_DeliveryOptionsDropDownList'),
        $summary = $('#SummaryEntry2');

    if (!$area.length || !$opts.length ||
        !$area.is(':visible') || !$opts.is(':visible')) {
      return;
    }

    // hide original rows & discount
    $area.closest('tr').hide();
    $opts.closest('tr').hide();
    $summary.find('.summaryTotals tr').filter(function(){
      return $(this).find('td:first').text().trim()==='Total discount';
    }).hide();

    // wrap summary in card
    if (!$summary.find('.summary-card').length) {
      $summary.wrapInner(
        '<div class="card summary-card shadow-sm mb-4">' +
          '<div class="card-body p-3"></div>' +
        '</div>'
      );
      $summary.find('.summaryTotals')
              .addClass('table table-borderless mb-0');
    }

    // remove any old widget
    $summary.prev('.shipping-card').remove();

    // figure standard base cost from option value=-1
    var standardText = $opts.find('option[value="-1"]').text(),
        mstd = standardText.match(/\(([^)]+)\)/),
        standardCost = mstd
          ? parseFloat(mstd[1].replace(/[^0-9\.-]/g,''))
          : 0;

    // build shipping card
    var $ship = $(
      '<div class="card shipping-card shadow-sm mb-4">' +
        '<div class="card-header bg-light"><strong>Shipping Method</strong></div>' +
        '<div class="card-body">' +
          '<div class="delivery-pills d-flex flex-wrap mb-2"></div>' +
          '<div class="expected-by text-muted small"></div>' +
        '</div>' +
      '</div>'
    );

    function computeExpected(days) {
      var now = new Date(),
          total = new Date(now.getTime() + (days+1)*86400000),
          fmt = total.toLocaleDateString(undefined,{
            month:'long', day:'numeric', year:'numeric'
          });
      return fmt;
    }

    // create pills
    $opts.find('option').each(function(){
      var $o = $(this),
          txt = $o.text().trim(),
          label = txt.replace(/\s*\(.*\)/,'').trim(),
          extraMatch = txt.match(/\(([^)]+)\)/),
          extraRaw = extraMatch ? extraMatch[1] : '',
          extra = parseFloat(extraRaw.replace(/[^0-9\.-]/g,'')) || 0,
          cost = $o.val()==='-1'
                 ? standardCost
                 : standardCost + extra,
          costLbl = '$'+cost.toFixed(2),
          // infer transit days:
          days = /Next\s*Day/i.test(txt)   ? 1
               : /2nd\s*Day/i.test(txt)    ? 2
               : /3\s*Day/i.test(txt)     ? 3
               :                                 5,
          $btn = $(
            '<button type="button" class="btn btn-outline-primary m-1">'+
              label+'<br><small>'+costLbl+'</small>'+
            '</button>'
          );

      // highlight current
      if ($o.is(':selected')) {
        $btn.removeClass('btn-outline-primary')
            .addClass('btn-primary');
        // set initial expected
        $ship.find('.expected-by')
             .text('Expected by '+computeExpected(days));
      }

      $btn.on('click', function(){
        // wire real <select> & fire its change (so ASP.NET postbacks)
        $opts.val($o.val()).change();

        // restyle pills
        $ship.find('button')
             .removeClass('btn-primary')
             .addClass('btn-outline-primary');
        $btn.removeClass('btn-outline-primary')
            .addClass('btn-primary');

        // update expected date
        $ship.find('.expected-by')
             .text('Expected by '+computeExpected(days));
      });

      $ship.find('.delivery-pills').append($btn);
    });

    $summary.before($ship);
  }

  // on page load
  $(initDeliveryWidget);

  // on partial postback
  if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager) {
    Sys.WebForms.PageRequestManager
      .getInstance()
      .add_endRequest(initDeliveryWidget);
  }
})(jQuery);
























document.addEventListener('DOMContentLoaded', function () {
  const deliveryOptionsPanel = document.getElementById('ctl00_PageBody_CartSummary2_DeliveryOptionsPanel');
  if (deliveryOptionsPanel) {
    deliveryOptionsPanel.style.display = 'none';
    console.log('[HIDE] Delivery Options Panel hidden');
  } else {
    console.warn('[HIDE] Delivery Options Panel not found');
  }
});


