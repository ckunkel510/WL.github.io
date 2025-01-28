<script>
document.addEventListener('DOMContentLoaded', function () {
    // Define the possible target div IDs
    const targetDivIds = [
        'ctl00_PageBody_productDetail_ctl01',
        'ctl00_PageBody_productDetail_ctl02'
    ];

    let targetDiv = null;
    let iframeElement = null;

    // Loop through the target IDs to find the first existing target div
    for (const id of targetDivIds) {
        targetDiv = document.getElementById(id);
        if (targetDiv) {
            iframeElement = targetDiv.querySelector('iframe');
            if (iframeElement) {
                iframeElement.id = 'DescriptionIframe'; // Assign the desired ID
                break;
            }
        }
    }

    if (!iframeElement) {
        console.error("No iframe found in the target divs.");
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
</script>
