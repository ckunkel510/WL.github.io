$(function(){
  $('.shopping-cart-details .shopping-cart-item').each(function(){
    var $item = $(this);

    // — clean up legacy bits —
    $item.find('[style*="display: table-row"]').remove();
    $item.find('span[id$="_QuantityValidator"]').remove();

    // — capture original postbacks & remove old anchors —
    var $origDel = $item.find('a[id*="_del_"]').first();
    var delJs = $origDel.length 
      ? ($origDel.attr('href')||'').replace(/^javascript:/,'') 
      : '';
    $origDel.remove();

    var $origRef = $item.find('a.refresh-cart-line-total').first();
    var refJs = $origRef.length 
      ? ($origRef.attr('href')||'').replace(/^javascript:/,'') 
      : '';
    $origRef.remove();

    // — detach entire RadInput wrapper for qty —
    var $origQtyWrap = $item.find('span.RadInput').first().detach();

    // — grab data —
    var imgSrc    = $item.find('img.ThumbnailImage').attr('src');
    var $infoCol  = $item.find('.row.pl-2.w-100 .col-12.col-sm-6').first();
    var $link     = $infoCol.find('a:has(.portalGridLink)').first();
    var code      = $link.find('.portalGridLink').text().trim();
    var href      = $link.attr('href');
    var desc      = $infoCol.find('> div:nth-child(3) div').text().trim();
    var priceText = $item
      .find('.col-12.col-sm-9 .col-6')
      .contents().filter((i,n)=>n.nodeType===3)
      .text().trim();
    var totalText = $item
      .find('.col-12.col-sm-3 .d-flex div').first()
      .text().trim();

    // — build Delete button —
    var $delBtn = $('<button type="button" class="btn btn-sm btn-outline-danger delete-btn">Delete</button>');
    if (delJs) $delBtn.on('click', ()=>eval(delJs));

    // — build card —
    var $card = $(`
      <div class="card mb-2 cart-item-card">
        <div class="card-body p-2">
          <!-- TOP ROW: Image + Title/Desc + Price -->
          <div class="d-flex align-items-center">
            <div class="flex-shrink-0">
              <a href="${href}">
                <img src="${imgSrc}" alt="${code}"
                     style="width:14vw; max-width:140px; max-height:14vh; object-fit:cover; border-radius:4px;">
              </a>
            </div>
            <div class="flex-grow-1 ms-3">
              <h6 class="mb-1"><a href="${href}">${code}</a></h6>
              <p class="mb-1 small text-secondary">${desc}</p>
            </div>
            <div class="flex-shrink-0 text-end">
              <span class="fw-bold">${priceText}</span>
            </div>
          </div>
          <hr class="my-2">
          <!-- BOTTOM ROW: Qty on left, Total/Delete/SFL on right -->
          <div class="d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center qty-section"></div>
            <div class="text-end action-block">
              <div>Total: <span class="fw-bold">${totalText}</span></div>
              <div class="mt-1"></div><!-- delete goes here -->
              <div class="sfl-placeholder mt-1"></div>
            </div>
          </div>
        </div>
      </div>
    `);

    // — insert qty control & wire auto‐postback —
    var $qtyClone = $origQtyWrap.clone();
    $card.find('.qty-section')
      .append($qtyClone)
      .append(' ea');
    if (refJs) {
      var $input = $qtyClone.find('input.riTextBox');
      $input.on('blur', ()=>eval(refJs))
            .on('keydown', e=>{
              if (e.key==='Enter') {
                e.preventDefault();
                eval(refJs);
                $input.blur();
              }
            });
    }

    // — attach delete button —
    $card.find('.action-block > div:nth-child(2)')
         .append($delBtn);

    // — swap in —
    $item.empty().append($card);
  });
});

