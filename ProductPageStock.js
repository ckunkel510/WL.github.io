$(document).ready(function() {
    // Get the current page's URL
    var currentUrl = window.location.href;

    // Check if the URL contains 'ProductDetail.aspx'
    if (currentUrl.indexOf('ProductDetail.aspx') !== -1) {
        // Refined regular expression to extract the product ID after 'pid=' and before any '&'
        var pidMatch = currentUrl.match(/pid=([0-9]+)/);

        if (pidMatch && pidMatch[1]) {
            var productId = pidMatch[1];

            // Construct the URL for the stock data page
            var stockDataUrl = 'https://webtrack.woodsonlumber.com/Catalog/ShowStock.aspx?productid=' + productId;

            // Use AJAX to load the content from the stock data page
            $.ajax({
                url: stockDataUrl,
                success: function(data) {
                    // Parse the returned HTML and find the element with id 'StockDataGrid_ctl00'
                    var stockData = $(data).find('#StockDataGrid_ctl00');

                    // Check if stock data was found
                    if (stockData.length) {
                        // Set the width of StockDataGrid_ctl00 to 20% with !important
                        $(stockData).css('width', '20%').css('important', 'true');

                        // Prepend the StockDataGrid content before the product description
                        $('#ctl00_PageBody_productDetail_productDescription').before(stockData);

                        // Hide the th elements containing "Lead Time" and "Location"
                        $(stockData).find('th:contains("Lead Time"), th:contains("Location")').css('display', 'none');

                        // Hide the td element with the data-title "Location"
                        $(stockData).find('td[data-title="Location"]').css('display', 'none');

                        // Hide any td element that contains just a dash (-)
                        $(stockData).find('td:contains("-")').filter(function() {
                            return $(this).text().trim() === "-";
                        }).css('display', 'none');
                    } else {
                        console.error('Stock data not found.');
                    }
                },
                error: function() {
                    console.error('Failed to load the stock data.');
                }
            });
        } else {
            alert("Product ID not found in the URL.");
        }
    }
});
