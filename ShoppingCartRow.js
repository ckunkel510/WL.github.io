
$(function(){
  $('.shopping-cart-details .shopping-cart-item').each(function(){
    var $item = $(this);

    // 1) Remove legacy update rows & validators
    $item.find('[style*="display: table-row"]').remove();
    $item.find('span[id$="_QuantityValidator"]').remove();

    // 2) Capture & remove original Delete link
    var $origDel = $item.find('a[id*="_del_"]').first();
    var delJs = '';
    if ($origDel.length) {
      delJs = ($origDel.attr('href') || '').replace(/^javascript:/, '');
    }
    $origDel.remove();

    // 3) Capture & remove original Refresh link
    var $origRef = $item.find('a.refresh-cart-line-total').first();
    var refJs = '';
    if ($origRef.length) {
      refJs = ($origRef.attr('href') || '').replace(/^javascript:/, '');
    }
    $origRef.remove();

    // 4) Detach the entire RadInput wrapper for qty
    var $origQtyWrap = $item.find('span.RadInput').first().detach();

    // 5) Grab the rest of your data
    var imgSrc = $item.find('img.ThumbnailImage').attr('src');
    var $infoCol = $item.find('.row.pl-2.w-100 .col-12.col-sm-6').first();
    var $link   = $infoCol.find('a:has(.portalGridLink)').first();
    var code    = $link.find('.portalGridLink').text().trim();
    var href    = $link.attr('href');
    var desc    = $infoCol.find('> div:nth-child(3) div').text().trim();
    var priceText = $item
      .find('.col-12.col-sm-9 .col-6')
      .contents().filter(function(i,n){ return n.nodeType===3; })
      .text().trim();
    var totalText = $item
      .find('.col-12.col-sm-3 .d-flex div').first()
      .text().trim();

    // 6) Build a plain “Delete” text link
    var $delBtn = $('<a href="#" class="delete-link ms-2">Delete</a>');
    if (delJs) {
      $delBtn.on('click', function(e){
        e.preventDefault();
        eval(delJs);
      });
    }

    // 7) Build the card structure
    var $card = $(`
      <div class="card mb-2 cart-item-card">
        <div class="card-body p-2">
          <!-- Top row: Image, title/desc, price -->
          <div class="d-flex align-items-center">
            <div class="flex-shrink-0">
              <a href="${href}">
                <img src="${imgSrc}" alt="${code}"
                     style="
                       width:14vw; max-width:140px;
                       height:auto;
                       object-fit:contain;
                       border-radius:4px;
                     ">
              </a>
            </div>
            <div class="flex-grow-1 flex-shrink-1 ms-3">
              <h6 class="mb-1"><a href="${href}">${code}</a></h6>
              <p class="mb-1 small text-secondary text-wrap">${desc}</p>
            </div>
            <div class="flex-shrink-0 text-end">
              <span class="fw-bold">${priceText}</span>
            </div>
          </div>
          <hr class="my-2">
          <!-- Bottom row: Qty on left, Total/Delete/SFL on right -->
          <div class="d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center qty-section"></div>
            <div class="text-end action-block">
              <div>Total: <span class="fw-bold">${totalText}</span></div>
              <div class="mt-1"></div>
              <div class="sfl-placeholder mt-1"></div>
            </div>
          </div>
        </div>
      </div>
    `);

    // 8) Insert cloned qty wrapper & wire auto-postback
    var $qtyClone = $origQtyWrap.clone();
    $card.find('.qty-section')
         .append($qtyClone)
         .append(' ea');
    if (refJs) {
      var $input = $qtyClone.find('input.riTextBox');
      $input.on('blur', function(){ eval(refJs); })
            .on('keydown', function(e){
              if (e.key === 'Enter') {
                e.preventDefault();
                eval(refJs);
                $input.blur();
              }
            });
    }

    // 9) Attach the Delete link
    $card.find('.action-block > div:nth-child(2)')
         .append($delBtn);

    // 10) Swap out the old row for our new card
    $item.empty().append($card);
  });
});










$(function(){
  // 1) Detach the subtotal panel
  var $subtotal = $('.SubtotalWrapper').detach();

  // 2) Detach the entire buttons div, then grab only the Place Order button
  var $buttonsDiv = $subtotal.next('div').detach();
  var $placeOrder = $buttonsDiv.find('#ctl00_PageBody_PlaceOrderButton').detach();

  // 3) Build a new summary widget
  var $widget = $(`
    <div class="cart-summary-widget p-3 border rounded ms-3" style="min-width:260px;">
      <div class="summary-subtotal mb-3"></div>
      <div class="summary-action"></div>
    </div>
  `);
  $widget.find('.summary-subtotal').append($subtotal);
  // style the Place Order button nice and big
  $placeOrder
    .addClass('btn btn-primary btn-lg w-100')
    .find('span').css('font-size','1.1rem');
  $widget.find('.summary-action').append($placeOrder);

  // 4) Insert into the page: make the cart-details flex and append widget
  $('.shopping-cart-details')
    .css({ display:'flex', alignItems:'flex-start' })
    // ensure the items container flex-grows to fill
    .children().first().css('flex','1')
    .end()
    .append($widget);
});

