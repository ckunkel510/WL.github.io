<!-- Take the Description from the iframe and move it to embedded in the page -->
<script>
window.onload = function () {
    // Check if the URL contains 'ProductDetail.aspx'
    if (!window.location.href.includes('ProductDetail.aspx')) {
        return; // Exit the script if not on a ProductDetail page
    }

    // Get the iframe element
    var iframe = document.getElementById('DescriptionIframe');

    // Check for both possible IDs and assign the first one that exists to targetDiv
    var targetDiv = document.getElementById('ctl00_PageBody_productDetail_ctl01') || 
                    document.getElementById('ctl00_PageBody_productDetail_ctl02');

    if (!iframe) {
        console.error("Description iframe not found.");
        return;
    }

    if (!targetDiv) {
        console.error("Target div for embedding content not found.");
        return;
    }

    // Try to access iframe content
    try {
        // Ensure iframe content is accessible
        var iframeContent = iframe.contentDocument || iframe.contentWindow.document;

        // Ensure the iframe content is loaded and contains a valid body
        if (!iframeContent || !iframeContent.body) {
            console.error("Iframe content or body is not accessible.");
            return;
        }

        // Debugging: Log the content to verify what you are receiving
        console.log("Iframe content:", iframeContent.body.innerHTML);

        // Check if the iframe body contains valid content
        var content = iframeContent.body.innerHTML.trim();
        if (!content) {
            console.warn("Iframe content is empty or invalid.");
            return;
        }

        // Safely append the content to the target div
        appendIframeContent(iframe, content, targetDiv);
    } catch (e) {
        console.error("An error occurred while accessing the iframe content.", e);
    }
};

function appendIframeContent(iframe, content, targetDiv) {
    try {
        // Append content and hide the iframe
        targetDiv.insertAdjacentHTML('beforeend', content);
        iframe.style.display = 'none';
        console.log("Iframe content successfully appended.");
    } catch (e) {
        console.error("An error occurred while appending iframe content.", e);
    }
}
</script>
