$(function(){
  $('.shopping-cart-details .shopping-cart-item').each(function(){
    var $item = $(this);

    // 1) strip out legacy update rows & validator
    $item.find('[style*="display: table-row"]').remove();
    $item.find('[id*="QuantityValidator"]').remove();

    // 2) grab & detach delete button
    var $delBtn = $item.find('a[id*="_del_"]').first().detach();

    // 3) pull image, link & code, desc, price, qty+refresh, total
    var imgSrc = $item.find('img.ThumbnailImage').attr('src');
    var $infoCol = $item.find('.row.pl-2.w-100 .col-12.col-sm-6').first();
    var $link   = $infoCol.find('a:has(.portalGridLink)').first();
    var code    = $link.find('.portalGridLink').text().trim();
    var href    = $link.attr('href');
    // DESCRIPTION is in the 3rd child DIV
    var desc    = $infoCol.find('> div:nth-child(3) div').text().trim();

    var priceText = $item
      .find('.col-12.col-sm-9 .col-6')
      .contents().filter((i,n)=>n.nodeType===3)
      .text().trim();

    var $qtyWrap = $item.find('span.RadInput').parent().detach();
    var $refresh = $item.find('a.refresh-cart-line-total').detach();

    var totalText = $item
      .find('.col-12.col-sm-3 .d-flex div').first()
      .text().trim();

    // 4) build new compact card with SFL placeholder
    var $card = $(`
      <div class="card mb-2 cart-item-card">
        <div class="card-body p-2">
          <div class="d-flex align-items-center">
            <div class="flex-shrink-0">
              <img src="${imgSrc}" alt="${code}"
                   style="
                     width:12vw; max-width:120px;
                     max-height:12vh; height:auto;
                     object-fit:cover; border-radius:4px;
                   ">
            </div>
            <div class="flex-grow-1 ms-3">
              <h6 class="mb-1"><a href="${href}">${code}</a></h6>
              <p class="mb-1 small text-secondary">${desc}</p>
              <div class="d-flex flex-wrap align-items-center">
                <div class="me-3"><span class="fw-bold">${priceText}</span></div>
                <div class="me-3 d-flex align-items-center">
                  ${$qtyWrap.prop('outerHTML')}
                  ${$refresh.prop('outerHTML')}
                </div>
                <div class="me-3"><span class="fw-bold">${totalText}</span></div>
              </div>
            </div>
            <div class="flex-shrink-0 text-end">
              <span class="del-btn"></span>
              <span class="sfl-placeholder"></span>
            </div>
          </div>
        </div>
      </div>
    `);

    // 5) inject delete button into card
    $card.find('.del-btn').append($delBtn);

    // 6) swap out the old markup
    $item.empty().append($card);
  });
});