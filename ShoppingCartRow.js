
$(function(){
  if (!document.getElementById('wl-cart-qty-stepper-styles')) {
    $('<style id="wl-cart-qty-stepper-styles">\
      .qty-section{gap:8px;min-height:40px;}\
      .wl-native-qty-hidden{display:none!important;}\
      .wl-qty-label,.wl-qty-unit{font-size:13px;color:#555;}\
      .wl-qty-stepper{display:inline-grid;grid-template-columns:40px 46px 40px;height:40px;border:1px solid #b9bec5;border-radius:6px;overflow:hidden;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.06);}\
      .wl-qty-stepper button{width:40px;height:40px;padding:0;border:0;border-radius:0;background:#f2f4f6;color:#292d32;font-size:22px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;touch-action:manipulation;}\
      .wl-qty-stepper button.wl-qty-increase{background:#6b0016;color:#fff;}\
      .wl-qty-stepper button:focus-visible{outline:3px solid rgba(107,0,22,.25);outline-offset:-3px;}\
      .wl-qty-stepper button:disabled{opacity:.42;cursor:default;}\
      .wl-qty-value{min-width:46px;height:40px;display:flex;align-items:center;justify-content:center;border-left:1px solid #d8dce1;border-right:1px solid #d8dce1;font-size:16px;font-weight:700;color:#222;font-variant-numeric:tabular-nums;background:#fff;}\
    </style>').appendTo('head');
  }

  $('.shopping-cart-details .shopping-cart-item').each(function(){
    var $item = $(this);

    var $infoCol = $item.find('.row.pl-2.w-100 .col-12.col-sm-6').first();
    var $link = $infoCol.find('a:has(.portalGridLink)').first();
    var code = $link.find('.portalGridLink').text().trim();
    var href = $link.attr('href');
    var $origQtyWrap = $item.find('span.RadInput').first();

    // WebTrack can render responsive/helper cart rows that do not contain a
    // product. Skip those so we do not create ghost cards like "ea / Delete".
    if (!code || !href || !$origQtyWrap.length) return;

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
    $origQtyWrap = $origQtyWrap.detach();

    // 5) Grab the rest of your data
    var imgSrc = $item.find('img.ThumbnailImage').attr('src');
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
              <div><span class="fw-bold">${totalText}</span></div>
              <div class="mt-1"></div>
              <div class="sfl-placeholder mt-1"></div>
            </div>
          </div>
        </div>
      </div>
    `);

    // 8) Keep WebTrack's field hidden and expose a Safari-safe quantity stepper.
    var $qtyClone = $origQtyWrap.clone();
    var $qtySection = $card.find('.qty-section');
    var $input = $qtyClone.find('input.riTextBox');
    var $qtyState = $qtyClone.find("input[type='hidden'][id$='_ClientState']");
    $qtySection.append($qtyClone);

    if ($input.length) {
      var currentQty = parseFloat($input.val());
      if (!isFinite(currentQty) || currentQty <= 0) currentQty = 1;

      $qtyClone.addClass('wl-native-qty-hidden');
      $input.attr({
        type: 'hidden',
        tabindex: '-1',
        autocomplete: 'off',
        'aria-hidden': 'true',
        'data-wl-qty-native': '1',
        'data-form-type': 'other',
        'data-1p-ignore': 'true',
        'data-lpignore': 'true'
      });

      var $stepper = $('<div class="wl-qty-stepper" role="group" aria-label="Quantity"></div>');
      var $decrease = $('<button type="button" class="wl-qty-decrease" aria-label="Decrease quantity"><span aria-hidden="true">&minus;</span></button>');
      var $value = $('<span class="wl-qty-value" aria-live="polite" aria-atomic="true"></span>');
      var $increase = $('<button type="button" class="wl-qty-increase" aria-label="Increase quantity"><span aria-hidden="true">+</span></button>');
      var busy = false;

      function renderQty() {
        var text = String(currentQty);
        $value.text(text).attr('aria-label', 'Quantity ' + text);
        $decrease.prop('disabled', busy || currentQty <= 1);
        $increase.prop('disabled', busy);
      }

      function syncWebTrackQty() {
        var text = String(currentQty);
        $input.val(text);
        if ($qtyState.length && $qtyState.val()) {
          try {
            var state = JSON.parse($qtyState.val());
            state.validationText = text;
            state.valueAsString = text;
            state.lastSetTextBoxValue = text;
            $qtyState.val(JSON.stringify(state));
          } catch (e) {}
        }
      }

      function changeQty(delta) {
        if (busy) return;
        var next = Math.max(1, currentQty + delta);
        if (next === currentQty) return;
        currentQty = next;
        busy = true;
        syncWebTrackQty();
        renderQty();
        if (refJs) {
          try { eval(refJs); }
          catch (e) { busy = false; renderQty(); throw e; }
        } else {
          busy = false;
          renderQty();
        }
      }

      $decrease.on('click', function(){ changeQty(-1); });
      $increase.on('click', function(){ changeQty(1); });
      $stepper.append($decrease, $value, $increase);
      $qtySection.append('<span class="wl-qty-label">Qty</span>', $stepper, '<span class="wl-qty-unit">ea</span>');
      syncWebTrackQty();
      renderQty();
    } else {
      $qtySection.append(' ea');
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



(function () {
  document.addEventListener('DOMContentLoaded', function () {
    const placeOrderBtn = document.getElementById('ctl00_PageBody_PlaceOrderButton');
    

    function overrideSessionState() {
      console.log('[Checkout] Overriding localStorage: sameAsDelivery = false, currentStep = 2');
      localStorage.setItem('sameAsDelivery', 'false');
      localStorage.setItem('currentStep', '2');
    }

    if (placeOrderBtn) {
      placeOrderBtn.addEventListener('click', overrideSessionState);
    }

});
})();


















(function () {
  const wrapper = document.querySelector('.custom-subtotal-wrapper');
  if (!wrapper) return;

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) {
        // User scrolled past the element — stick to top
        wrapper.classList.remove('fixed-bottom');
        wrapper.classList.add('sticky-top');
      } else {
        // User scrolled back up — return to bottom if it was originally off-screen
        if (wasOffScreen) {
          wrapper.classList.add('fixed-bottom');
          wrapper.classList.remove('sticky-top');
        }
      }
    },
    {
      threshold: 0,
    }
  );

  // Check if element is below the fold on initial load
  const rect = wrapper.getBoundingClientRect();
  const wasOffScreen = rect.top > window.innerHeight;

  if (wasOffScreen) {
    wrapper.classList.add('fixed-bottom');
  } else {
    wrapper.classList.add('sticky-top');
  }

  observer.observe(wrapper);
})();
