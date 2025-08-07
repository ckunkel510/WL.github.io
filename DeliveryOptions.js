
$(function(){
  // 1) Check if delivery cost row shows $250.00
  var costText = $('#ctl00_PageBody_CartSummary2_DeliveryCostsRow td.numeric').text().trim();
  if (costText === '$250.00') {
    console.log('[DeliveryCheck] High delivery cost detected:', costText);

    // 2) Detach the BackToCart button and rename it
    var $backBtn = $('#ctl00_PageBody_BackToCartButton3').detach();
    $backBtn.find('span').text('Change Address');

    // 3) Hard‐wire to ShoppingCart.aspx
    $backBtn
      .removeAttr('onclick')
      .attr('href', 'ShoppingCart.aspx');

    // 4) Clear out everything else in .mainContents
    var $container = $('.mainContents');
    $container.empty();

    // 5) Re‐append just the Change Address button, centered
    var $wrapper = $('<div class="text-center my-4"></div>').append($backBtn);
    $container.append($wrapper);

    console.log('[DeliveryCheck] Switched to Change Address mode');
  }
});

