$(function(){
  $('.shopping-cart-details .shopping-cart-item').each(function(){
    var $item       = $(this);
    // — grab all the bits we need —
    var imgSrc      = $item.find('img.ThumbnailImage').attr('src');
    var $prodLink   = $item.find('a:has(.portalGridLink)').first();
    var prodCode    = $prodLink.find('.portalGridLink').text().trim();
    var prodHref    = $prodLink.attr('href');
    var desc        = $item
      .find('.col-12.col-sm-6').first()         // first col = code & description
      .children('div').eq(2)                    // third <div> in there
      .text().trim();
    var branch      = $item
      .find('.col-12.col-sm-6').last()          // second col = stock info
      .find('div div').eq(0).text().trim();
    var stock       = $item
      .find('.col-12.col-sm-6').last()
      .find('div div').eq(1).text().trim();
    // price text node (e.g. “$2.84 ea”)
    var price       = $item
      .find('.col-12.col-sm-9 .col-6').first()
      .contents().filter(function(){ return this.nodeType===3; })
      .text().trim();
    // quantity input + its wrapper and the refresh button
    var $qtyWrapper = $item.find('span.RadInput').parent();
    var $refreshBtn = $item.find('a.refresh-cart-line-total');
    // total and remove/save buttons
    var total       = $item.find('.col-12.col-sm-3 .d-flex div').first().text().trim();
    var $removeBtn  = $item.find('a[id*="_del_"]');
    var $saveBtn    = $item.find('button.sfl-button');

    // — build our new card structure —
    var $card = $('<div class="card mb-3 cart-item-card"></div>');
    var $cardBody = $('<div class="card-body p-3"></div>');
    var $row = $('<div class="row g-0"></div>');

    // image column
    var $imgCol = $(`
      <div class="col-auto">
        <img src="${imgSrc}" class="img-fluid rounded" alt="Product image">
      </div>`);

    // content column
    var $contentCol = $('<div class="col"></div>');
    var $content = $('<div></div>')
      .append(`<h5 class="card-title"><a href="${prodHref}">${prodCode}</a></h5>`)
      .append(`<p class="card-text">${desc}</p>`)
      .append(`<p class="card-text"><small class="text-muted">${branch} | ${stock}</small></p>`)
      .append(
        $('<div class="d-flex justify-content-between align-items-center"></div>')
          .append(
            $('<div></div>')
              .append(`<span class="fw-bold">${price}</span> `)
              .append($qtyWrapper)
              .append(' ')
              .append($refreshBtn)
          )
          .append(
            $('<div></div>')
              .append(`<span class="fw-bold">${total}</span> `)
              .append($removeBtn)
              .append(' ')
              .append($saveBtn)
          )
      );

    $contentCol.append($content);
    $row.append($imgCol).append($contentCol);
    $cardBody.append($row);
    $card.append($cardBody);

    // — swap it in —
    $item.empty().append($card);
  });
});
