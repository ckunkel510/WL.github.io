
$(function(){
  $('.shopping-cart-details .shopping-cart-item').each(function(){
    var $item = $(this);

    // 1) Remove any old inline update rows & quantity validators
    $item.find('[style*="display: table-row"]').remove();
    $item.find('span[id$="_QuantityValidator"]').remove();

    // 2) Capture original postback calls, then remove those anchors
    var $origDel = $item.find('a[id*="_del_"]').first();
    var delJs    = $origDel.attr('href').replace(/^javascript:/, '');
    $origDel.remove();

    var $origRef = $item.find('a.refresh-cart-line-total').first();
    var refJs    = $origRef.attr('href').replace(/^javascript:/, '');
    $origRef.remove();

    // 3) Grab the qty input
    var $origQty = $item.find('span.RadInput input.riTextBox').first();

    // 4) Grab the rest of your data
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

    // 5) Build a new Delete button
    var $delBtn = $('<button type="button" class="btn btn-outline-danger btn-sm mb-1">Delete</button>');
    $delBtn.on('click', function(){
      // fire original postback
      eval(delJs);
    });

    // 6) Build the card
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
                <div class="me-3 d-flex align-items-center">
                  <!-- we'll clone the qty input here -->
                </div>
                <div class="me-3"><span class="fw-bold">${totalText}</span></div>
              </div>
            </div>
            <div class="flex-shrink-0 text-end">
              <!-- Delete & Save-for-Later go here -->
            </div>
          </div>
        </div>
      </div>
    `);

    // 7) Insert cloned qty & wire up auto-postback
    var $qtyClone = $origQty.clone();
    $card.find('.d-flex.align-items-center > div:nth-child(3) .d-flex')
      .append($qtyClone)
      .append(' ea'); // keep the unit

    // on blur or Enter, fire your original refresh postback
    $qtyClone
      .on('blur', () => eval(refJs))
      .on('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          eval(refJs);
          $qtyClone.blur();
        }
      });

    // 8) Attach Delete button
    $card.find('.text-end').append($delBtn);

    // 9) Leave a placeholder for SFL
    $card.find('.text-end')
         .append('<div class="sfl-placeholder mt-1"></div>');

    // 10) Swap out the old markup
    $item.empty().append($card);
  });
});

