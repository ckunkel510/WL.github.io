$(function(){
  $('.shopping-cart-details .shopping-cart-item').each(function(){
    var $item = $(this);

    // 1) Remove legacy update rows & validators
    $item.find('[style*="display: table-row"]').remove();
    $item.find('span[id$="_QuantityValidator"]').remove();

    // 2) Capture & remove the original Delete link
    var $origDel = $item.find('a[id*="_del_"]').first();
    var delJs = '';
    if ($origDel.length) {
      var href = $origDel.attr('href') || '';
      delJs = href.replace(/^javascript:/, '');
    }
    $origDel.remove();

    // 3) Capture & remove the original Refresh link
    var $origRef = $item.find('a.refresh-cart-line-total').first();
    var refJs = '';
    if ($origRef.length) {
      var href2 = $origRef.attr('href') || '';
      refJs = href2.replace(/^javascript:/, '');
    }
    $origRef.remove();

    // 4) Grab the qty input
    var $origQty = $item.find('span.RadInput input.riTextBox').first();

    // 5) Pull other data
    var imgSrc = $item.find('img.ThumbnailImage').attr('src');
    var $infoCol = $item.find('.row.pl-2.w-100 .col-12.col-sm-6').first();
    var $link   = $infoCol.find('a:has(.portalGridLink)').first();
    var code    = $link.find('.portalGridLink').text().trim();
    var href    = $link.attr('href');
    var desc    = $infoCol.find('> div:nth-child(3) div').text().trim();
    var priceText = $item
      .find('.col-12.col-sm-9 .col-6')
      .contents().filter((i,n)=>n.nodeType===3)
      .text().trim();
    var totalText = $item
      .find('.col-12.col-sm-3 .d-flex div').first()
      .text().trim();

    // 6) Build Delete button with safe eval
    var $delBtn = $('<button type="button" class="btn btn-outline-danger btn-sm mb-1">Delete</button>');
    if (delJs) {
      $delBtn.on('click', function(){ eval(delJs); });
    }

    // 7) Build the card
    var $card = $(`
      <div class="card mb-2 cart-item-card">
        <div class="card-body p-2">
          <div class="d-flex align-items-center">
            <div class="flex-shrink-0">
              <img src="${imgSrc}" alt="${code}"
                   style="
                     width:14vw; max-width:140px;
                     max-height:14vh; height:auto;
                     object-fit:cover; border-radius:4px;
                   ">
            </div>
            <div class="flex-grow-1 ms-3">
              <h6 class="mb-1"><a href="${href}">${code}</a></h6>
              <p class="mb-1 small text-secondary">${desc}</p>
              <div class="d-flex flex-wrap align-items-center">
                <div class="me-3"><span class="fw-bold">${priceText}</span></div>
                <div class="me-3 d-flex align-items-center qty-section"></div>
                <div class="me-3"><span class="fw-bold">${totalText}</span></div>
              </div>
            </div>
            <div class="flex-shrink-0 text-end action-section"></div>
          </div>
        </div>
      </div>
    `);

    // 8) Insert qty input and wire auto-postback
    var $qtyClone = $origQty.clone();
    $card.find('.qty-section')
      .append($qtyClone)
      .append(' ea');
    if (refJs) {
      $qtyClone
        .on('blur', () => eval(refJs))
        .on('keydown', e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            eval(refJs);
            $qtyClone.blur();
          }
        });
    }

    // 9) Insert Delete button + SFL placeholder
    var $actions = $card.find('.action-section');
    $actions.append($delBtn);
    $actions.append('<div class="sfl-placeholder mt-1"></div>');

    // 10) Swap in
    $item.empty().append($card);
  });
});

