window.addEventListener("load", function () {
    try {
        // Function to fetch data with retries
        function fetchDataWithRetry(url, retries = 3) {
            return fetch(url).then(response => {
                if (!response.ok) {
                    if (retries > 0) {
                        console.warn('Retrying fetch...', retries);
                        return fetchDataWithRetry(url, retries - 1);
                    } else {
                        throw new Error(`Network response was not ok: ${response.statusText}`);
                    }
                }
                return response.text();
            });
        }

        // Extract the product ID (pid) from the URL manually
        const url = window.location.href;
        const pidMatch = url.match(/pid=(\d+)(?:&|$)/);
        const productId = pidMatch ? pidMatch[1] : null;

        if (!productId) {
            console.warn('Product ID not found in URL.');
            return;
        }

        // Google Sheet URL for CSV
        const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQQ-ZOrdYefnmGgY5ftFm_QfQDsOo419SDM-TQxyID5ssMpdA9yyeLfQSjuRZT1qtlzUc-qk9AYoll3/pub?output=csv';

        // Wait for the main image element to be available
        const mainImageElement = document.getElementById("ctl00_PageBody_productDetail_ProductImage");
        if (!mainImageElement) {
            console.warn('Main product image element not found on the page.');
            return;
        }

        fetchDataWithRetry(sheetUrl)
            .then(data => {
                const rows = data.split('\n').map(row => row.split(','));
                const filteredRows = rows.filter(row => row[0].trim() === productId);

                if (filteredRows.length === 0) {
                    console.warn('No images found for product ID:', productId);
                    return;
                }

                // Create a container for image thumbnails
                const thumbnailContainer = document.createElement('div');
                thumbnailContainer.style.display = 'flex';
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
                filteredRows.forEach((row, index) => {
                    const imageUrl = row[1].trim();

                    if (imageUrl) {
                        const thumbnail = document.createElement('img');
                        thumbnail.src = imageUrl;
                        thumbnail.style.width = '50px';
                        thumbnail.style.height = '50px';
                        thumbnail.style.cursor = 'pointer';
                        thumbnail.addEventListener('click', function () {
                            mainImageElement.src = thumbnail.src;
                        });
                        thumbnailContainer.appendChild(thumbnail);
                    } else {
                        console.warn(`Row ${index + 1} has an empty image URL.`);
                    }
                });

                // Append the thumbnail container after the main image
                mainImageElement.insertAdjacentElement('afterend', thumbnailContainer);
            })
            .catch(error => {
                console.error('Error fetching or processing Google Sheet data:', error);
            });
    } catch (error) {
        console.error('Unexpected error:', error);
    }
});
