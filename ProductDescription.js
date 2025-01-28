// Ensure scripts run only after the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function () {
    // Assign IDs to iframes within specific divs
    ['ctl00_PageBody_productDetail_ctl01', 'ctl00_PageBody_productDetail_ctl02'].forEach(function (divId) {
        var divElement = document.getElementById(divId);
        if (divElement) {
            var iframeElement = divElement.querySelector('iframe');
            if (iframeElement) {
                iframeElement.id = 'DescriptionIframe'; // Assign the same ID to all matching iframes
            }
        }
    });

    // Load iframe content into the page
    window.onload = function () {
        if (!window.location.href.includes('ProductDetail.aspx')) {
            return; // Exit if not on a ProductDetail page
        }

        var iframe = document.getElementById('DescriptionIframe');
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

        try {
            var iframeContent = iframe.contentDocument || iframe.contentWindow.document;

            if (!iframeContent || !iframeContent.body) {
                console.error("Iframe content or body is not accessible.");
                return;
            }

            var content = iframeContent.body.innerHTML.trim();
            if (!content) {
                console.warn("Iframe content is empty or invalid.");
                return;
            }

            // Embed the iframe content into the target div and hide the iframe
            targetDiv.insertAdjacentHTML('beforeend', content);
            iframe.style.display = 'none';
            console.log("Iframe content successfully appended.");
        } catch (e) {
            console.error("An error occurred while accessing or appending iframe content.", e);
        }
    };
});
