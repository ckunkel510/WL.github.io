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
        const sheetUrl = 'https://images-woodsonlumber.sirv.com/csv/Additional%20Images%20-%20Sheet1.csv';

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

                // Function to style a thumbnail wrapper
                function createThumbnailWrapper(imageElement) {
                    const wrapper = document.createElement('div');
                    wrapper.style.border = '2px solid #ccc';
                    wrapper.style.padding = '5px';
                    wrapper.style.borderRadius = '8px';
                    wrapper.style.transition = 'border-color 0.3s ease';
                    wrapper.style.display = 'inline-block';
                    wrapper.style.cursor = 'pointer';
                    wrapper.addEventListener('mouseover', () => {
                        wrapper.style.borderColor = '#6b0016';
                    });
                    wrapper.addEventListener('mouseout', () => {
                        wrapper.style.borderColor = '#ccc';
                    });
                    wrapper.appendChild(imageElement);
                    return wrapper;
                }

                // Add the current main image as the first thumbnail
                const mainThumbnail = document.createElement('img');
                mainThumbnail.src = mainImageElement.src;
                mainThumbnail.style.width = '50px';
                mainThumbnail.style.height = '50px';
                mainThumbnail.addEventListener('click', function () {
                    mainImageElement.src = mainThumbnail.src;
                });
                thumbnailContainer.appendChild(createThumbnailWrapper(mainThumbnail));

                // Add thumbnails from the filtered rows
                filteredRows.forEach((row, index) => {
                    const imageUrl = row[1].trim();

                    if (imageUrl) {
                        const thumbnail = document.createElement('img');
                        thumbnail.src = imageUrl;
                        thumbnail.style.width = '50px';
                        thumbnail.style.height = '50px';
                        thumbnail.addEventListener('click', function () {
                            mainImageElement.src = thumbnail.src;
                        });
                        thumbnailContainer.appendChild(createThumbnailWrapper(thumbnail));
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
