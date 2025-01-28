<script>
document.addEventListener('DOMContentLoaded', function () {
    // Function to wait for elements to be available
    function waitForElements(ids, callback) {
        const interval = setInterval(() => {
            const elements = ids.map(id => document.getElementById(id));
            if (elements.every(el => el !== null)) {
                clearInterval(interval); // Stop checking once all elements are found
                callback(elements);
            }
        }, 100); // Check every 100ms
    }

    // Target div IDs
    const targetDivIds = [
        'ctl00_PageBody_productDetail_ctl01',
        'ctl00_PageBody_productDetail_ctl02'
    ];

    // Wait for the elements to exist
    waitForElements(targetDivIds, (divs) => {
        let iframeElement = null;
        let targetDiv = null;

        // Find the first valid div with an iframe
        for (const div of divs) {
            if (div) {
                iframeElement = div.querySelector('iframe');
                if (iframeElement) {
                    iframeElement.id = 'DescriptionIframe'; // Assign the desired ID
                    targetDiv = div;
                    break;
                }
            }
        }

        if (!iframeElement || !targetDiv) {
            console.error("No valid iframe or target div found.");
            return;
        }

        // Only proceed if the URL contains 'ProductDetail.aspx'
        if (!window.location.href.includes('ProductDetail.aspx')) {
            return;
        }

        // Try to access and move iframe content
        try {
            const iframeContent = iframeElement.contentDocument || iframeElement.contentWindow.document;

            // Ensure the iframe content is loaded and valid
            if (!iframeContent || !iframeContent.body || !iframeContent.body.innerHTML.trim()) {
                console.warn("Iframe content is empty or inaccessible.");
                return;
            }

            // Append the content from the iframe to the target div
            targetDiv.insertAdjacentHTML('beforeend', iframeContent.body.innerHTML.trim());
            iframeElement.style.display = 'none'; // Hide the iframe after transferring content
            console.log("Iframe content successfully appended.");
        } catch (e) {
            console.error("An error occurred while accessing or appending iframe content.", e);
        }
    });
});
</script>
