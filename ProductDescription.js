<script>
document.addEventListener('DOMContentLoaded', function () {
    console.log("Script initialized. Waiting for elements...");

    // Function to wait for elements to be available
    function waitForElements(ids, callback) {
        const interval = setInterval(() => {
            console.log(`Checking for elements: ${ids}`);
            const elements = ids.map(id => document.getElementById(id));
            if (elements.every(el => el !== null)) {
                console.log("All elements found:", elements);
                clearInterval(interval); // Stop checking once all elements are found
                callback(elements);
            } else {
                console.warn("Some elements are still missing. Retrying...");
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
                    console.log(`Iframe found in div with ID: ${div.id}`);
                    iframeElement.id = 'DescriptionIframe'; // Assign the desired ID
                    targetDiv = div;
                    break;
                }
            }
        }

        if (!iframeElement) {
            console.error("No iframe found in the target divs.");
            return;
        }
        if (!targetDiv) {
            console.error("No target div found.");
            return;
        }

        // Check if the URL contains 'ProductDetail.aspx'
        const currentURL = window.location.href;
        if (typeof currentURL !== 'string' || !currentURL.includes('ProductDetail.aspx')) {
            console.error("Current URL does not contain 'ProductDetail.aspx':", currentURL);
            return;
        }
        console.log("URL check passed:", currentURL);

        // Try to access and move iframe content
        try {
            const iframeContent = iframeElement.contentDocument || iframeElement.contentWindow.document;

            // Ensure the iframe content is loaded and valid
            if (!iframeContent || !iframeContent.body) {
                console.warn("Iframe content is empty or inaccessible:", iframeContent);
                return;
            }
            const iframeHTML = iframeContent.body.innerHTML.trim();
            if (!iframeHTML) {
                console.warn("Iframe content is empty or invalid:", iframeHTML);
                return;
            }

            console.log("Iframe content fetched successfully:", iframeHTML);

            // Append the content from the iframe to the target div
            targetDiv.insertAdjacentHTML('beforeend', iframeHTML);
            iframeElement.style.display = 'none'; // Hide the iframe after transferring content
            console.log("Iframe content successfully appended to target div.");
        } catch (e) {
            console.error("An error occurred while accessing or appending iframe content:", e);
        }
    });
});
</script>
