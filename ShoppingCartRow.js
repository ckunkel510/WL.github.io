$(function(){
  $('.shopping-cart-details .shopping-cart-item').each(function(){
    var $item = $(this);

    // 1) clean out any hidden update controls + validators
    $item.find('[style*="display: table-row"]').remove();
    $item.find('[id*="QuantityValidator"]').hide();

    // 2) pull out & detach the interactive bits
    var $saveBtn = $item.find('button.sfl-button').detach();
    var $delBtn  = $item.find('a[id*="_del_"]').first().detach();
    var $qtyWrap = $item.find('span.RadInput').parent().detach();
    var $refresh = $item.find('a.refresh-cart-line-total').detach();

    // 3) clone & clean the delete icon
    var $delClone = $delBtn.clone().empty()
                      .append( $delBtn.find('i').clone() );

    // 4) clone qty & refresh so we get fresh copy
    var $qtyClone = $qtyWrap.clone();
    var $refClone = $refresh.clone();
    var $saveClone= $saveBtn.clone();

    // 5) grab the rest of your data
    var imgSrc    = $item.find('img.ThumbnailImage').attr('src');
    var $link     = $item.find('a:has(.portalGridLink)').first();
    var code      = $link.find('.portalGridLink').text().trim();
    var href      = $link.attr('href');
    var desc      = $item
                      .find('.col-12.col-sm-6').first()
                      .find('> div').eq(2).text().trim();
    var priceText = $item
                      .find('.col-12.col-sm-9 .col-6')
                      .contents().filter((i,n)=>n.nodeType===3)
                      .text().trim();
    var totalText = $item
                      .find('.col-12.col-sm-3 .d-flex div').first()
                      .text().trim();

    // 6) build a compact card
    var $card = $(`
      <div class="card mb-2 cart-item-card">
        <div class="card-body p-2">
          <div class="d-flex align-items-center">
            <div class="flex-shrink-0">
              <img src="${imgSrc}" alt="${code}"
                   style="
                     width:10vw; max-width:100px;
                     max-height:10vh; height:auto;
                     object-fit:cover; border-radius:4px;
                   ">
            </div>
            <div class="flex-grow-1 ms-3">
              <h6 class="mb-1"><a href="${href}">${code}</a></h6>
              <p class="mb-1 small text-secondary">${desc}</p>
              <div class="d-flex flex-wrap align-items-center">
                <div class="me-3"><span class="fw-bold">${priceText}</span></div>
                <div class="me-3 d-flex align-items-center">
                  ${$qtyClone.prop('outerHTML')}
                  ${$refClone.prop('outerHTML')}
                </div>
                <div class="me-3"><span class="fw-bold">${totalText}</span></div>
              </div>
            </div>
            <div class="flex-shrink-0 text-end">
              ${$delClone.prop('outerHTML')}
              ${$saveClone.prop('outerHTML')}
            </div>
          </div>
        </div>
      </div>
    `);

    // 7) replace the old markup
    $item.empty().append($card);
  });
});