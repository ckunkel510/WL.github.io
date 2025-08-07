
$(function(){
  $('.shopping-cart-details .shopping-cart-item').each(function(){
    var $item     = $(this);
    // pull out what we need
    var imgSrc    = $item.find('img.ThumbnailImage').attr('src');
    var $link     = $item.find('a:has(.portalGridLink)').first();
    var code      = $link.find('.portalGridLink').text().trim();
    var href      = $link.attr('href');
    var desc      = $item.find('.col-12.col-sm-6')
                         .first().find('> div').eq(2).text().trim();
    var priceText = $item.find('.col-12.col-sm-9 .col-6')
                         .contents().filter((i,n)=>n.nodeType===3).text().trim();
    var $qtyWrap  = $item.find('span.RadInput').parent();
    var $refresh  = $item.find('a.refresh-cart-line-total');
    var totalText = $item.find('.col-12.col-sm-3 .d-flex div')
                         .first().text().trim();
    var $delBtn   = $item.find('a[id*="_del_"]');
    var $saveBtn  = $item.find('button.sfl-button');

    // hide the old validator text
    $item.find('.QuantityValidator').hide();

    // build new compact row
    var $row = $(`
      <div class="card mb-2 cart-item-card">
        <div class="card-body p-2">
          <div class="d-flex align-items-center">
            <div class="flex-shrink-0">
              <img src="${imgSrc}"
                   style="width:60px; height:60px; object-fit:cover; border-radius:4px;">
            </div>
            <div class="flex-grow-1 ms-3">
              <h6 class="mb-1">
                <a href="${href}">${code}</a>
              </h6>
              <p class="mb-1 small text-secondary">${desc}</p>
              <div class="d-flex flex-wrap align-items-center">
                <div class="me-3">
                  <span class="fw-bold">${priceText}</span>
                </div>
                <div class="me-3 d-flex align-items-center">
                  ${$qtyWrap.prop('outerHTML')}
                  ${$refresh.prop('outerHTML')}
                </div>
                <div class="me-3">
                  <span class="fw-bold">${totalText}</span>
                </div>
              </div>
            </div>
            <div class="flex-shrink-0 text-end">
              ${$delBtn.prop('outerHTML')}
              ${$saveBtn.prop('outerHTML')}
            </div>
          </div>
        </div>
      </div>
    `);

    // swap in
    $item.empty().append($row);
  });
});

