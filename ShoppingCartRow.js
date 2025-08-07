
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
  // 1) Grab and clone the original subtotal panel, then hide it
  var $origSub = $('.SubtotalWrapper');
  var $cloneSub = $origSub.clone();
  $origSub.hide();

  // 2) Clean the clone (remove any free-shipping note)
  $cloneSub.find('div[style]').remove();

  // 3) Detach & relabel the Place Order button so no other script can remove it
  var $btn = $('#ctl00_PageBody_PlaceOrderButton').detach();
  $btn.find('span').text('Proceed to checkout');

  // 4) Build your own wrapper
  var $newWrapper = $('<div class="custom-subtotal-wrapper"></div>')
    .append($cloneSub)
    .append($btn);

  // 5) Insert it at the top of the shopping-cart-details
  $('.ShoppingCartDetailPanel').append($newWrapper);
});












$(function(){
  // Detach the “Empty Cart” button
  var $emptyBtn = $('#ctl00_PageBody_EmptyCartButton').detach();

  // Append it to the bottom of .shopping-cart-details
  $('.shopping-cart-details').append($emptyBtn);
});


$(function(){
  // Hide the top/bottom “Shop for More”, “Place Order”, and “Empty Cart” buttons
  $('#ctl00_PageBody_ShopForMoreButton, \
    #ctl00_PageBody_PlaceOrderButtonTop, \
    #ctl00_PageBody_ShopForMoreButtonTop, \
    #ctl00_PageBody_EmptyCartButtonTop').hide();
});




$(function(){
  // 1) Detach the existing title span
  var $oldTitle = $('#ctl00_PageBody_ShoppingCartTitle_HeaderText').detach();

  // 2) Extract the item count
  var match = $oldTitle.text().match(/\d+/);
  var count = match ? parseInt(match[0], 10) : 0;

  // 3) Build new header block
  var $newHeader = $(`
    <div class="cart-header mb-3">
      <h2>Shopping Cart</h2>
      <p>${count} item${count === 1 ? '' : 's'}</p>
    </div>
  `);

  // 4) Insert it immediately before .shopping-cart-details
  $('.shopping-cart-details').before($newHeader);
});

