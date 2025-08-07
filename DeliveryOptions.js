
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
  // Grab the summary container
  var $summary = $('#SummaryEntry2');
  if (!$summary.length) return;

  // Extract values
  var subtotalText    = $summary.find('tr:has(td:contains("Subtotal")) .numeric').text().trim();
  var deliveryText    = $summary.find('#ctl00_PageBody_CartSummary2_DeliveryCostsRow .numeric').text().trim();
  var taxText         = $summary.find('#ctl00_PageBody_CartSummary2_TaxTotals .numeric').text().trim();
  var totalText       = $summary.find('#ctl00_PageBody_CartSummary2_GrandTotalRow .numeric').text().trim();

  // Extract the shipping method label
  var shipLabel = $('#ctl00_PageBody_CartSummary2_DeliveryOptionsPanel')
                    .find('b:contains("Shipping Method")')
                    .parent()
                    .text()
                    .replace(/Shipping Method\s*:\s*/i, '')
                    .trim();

  // Build the Shipping Method widget
  var $shipWidget = $(`
    <div class="card mb-3 shipping-method-widget">
      <div class="card-body p-3">
        <h5 class="card-title mb-2">Shipping Method</h5>
        <div class="card-text">${shipLabel}</div>
      </div>
    </div>
  `);

  // Build the Order Totals widget (vertical, low→high)
  var $totalsWidget = $(`
    <div class="card mb-3 order-totals-widget">
      <div class="card-body p-3">
        <h5 class="card-title mb-3">Order Summary</h5>
        <div class="d-flex justify-content-between mb-2"><span>Subtotal</span><span>${subtotalText}</span></div>
        <div class="d-flex justify-content-between mb-2"><span>Delivery</span><span>${deliveryText}</span></div>
        <div class="d-flex justify-content-between mb-2"><span>Tax</span><span>${taxText}</span></div>
        <hr>
        <div class="d-flex justify-content-between"><strong>Total (inc. Tax)</strong><strong>${totalText}</strong></div>
      </div>
    </div>
  `);

  // Clear out the existing summary table
  $summary.empty();

  // Inject the new widgets
  $summary
    .append($shipWidget)
    .append($totalsWidget);
});





