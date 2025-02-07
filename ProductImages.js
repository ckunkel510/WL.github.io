document.addEventListener("DOMContentLoaded", function () {
    // Extract the product ID (pid) from the URL manually
    const url = window.location.href;
    const pidMatch = url.match(/pid=(\d+)(?:&|$)/);
    const productId = pidMatch ? pidMatch[1] : null;

    // Google Sheet URL for CSV
    const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQQ-ZOrdYefnmGgY5ftFm_QfQDsOo419SDM-TQxyID5ssMpdA9yyeLfQSjuRZT1qtlzUc-qk9AYoll3/pub?output=csv';

    // ID of the main product image
    const mainImageElement = document.getElementById("ctl00_PageBody_productDetail_ProductImage");

    if (productId && mainImageElement) {
        // Fetch and parse the CSV data
        fetch(sheetUrl)
            .then(response => response.text())
            .then(data => {
                const rows = data.split('\n').map(row => row.split(','));
                const filteredRows = rows.filter(row => row[0].trim() === productId);

                if (filteredRows.length > 0) {
                    // Create a container for image thumbnails
                    const thumbnailContainer = document.createElement('div');
                    thumbnailContainer.style.display = 'flex';
                    thumbnailContainer.style.flexWrap = 'wrap';
                    thumbnailContainer.style.gap = '10px';
                    thumbnailContainer.style.marginTop = '10px';

                    // Add the current main image as the first thumbnail
                    const mainThumbnail = document.createElement('img');
                    mainThumbnail.src = mainImageElement.src;
                    mainThumbnail.style.width = '50px';
                    mainThumbnail.style.height = '50px';
                    mainThumbnail.style.cursor = 'pointer';
                    mainThumbnail.addEventListener('click', function () {
                        mainImageElement.src = mainThumbnail.src;
                    });
                    thumbnailContainer.appendChild(mainThumbnail);

                    // Add thumbnails from the filtered rows
                    filteredRows.forEach(row => {
                        const imageUrl = row[1].trim();

                        if (imageUrl) {
                            const thumbnail = document.createElement('img');
                            thumbnail.src = imageUrl;
                            thumbnail.style.width = '50px';
                            thumbnail.style.height = '50px';
                            thumbnail.style.cursor = 'pointer';
                            thumbnail.style.transition = 'all 0.2s ease';
                            thumbnail.addEventListener('click', function () {
                                mainImageElement.src = thumbnail.src;
                            });

                            // Add hover effect for desktop only
                            thumbnail.addEventListener('mouseenter', function () {
                                if (window.innerWidth >= 1024) { // Desktop breakpoint
                                    thumbnail.style.transform = 'scale(2)';
                                }
                            });

                            thumbnail.addEventListener('mouseleave', function () {
                                if (window.innerWidth >= 1024) {
                                    thumbnail.style.transform = 'scale(1)';
                                }
                            });

                            thumbnailContainer.appendChild(thumbnail);
                        }
                    });

                    // Append the thumbnail container after the main image
                    mainImageElement.insertAdjacentElement('afterend', thumbnailContainer);
                } else {
                    console.warn('No images found for product ID:', productId);
                }
            })
            .catch(error => {
                console.error('Error fetching or processing Google Sheet data:', error);
            });
    } else {
        console.warn('Product ID not found or main image element missing.');
    }
});
