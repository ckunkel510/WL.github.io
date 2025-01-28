<script>
document.addEventListener('DOMContentLoaded', function () {
    // Add styles after the iframe content is embedded
    setTimeout(function () {
        // Check if the URL contains 'ProductDetail.aspx'
        if (!window.location.href.includes('ProductDetail.aspx')) {
            return; // Exit if not on a ProductDetail page
        }

        // Find the target divs that may contain the embedded content
        var targetDivs = [
            document.getElementById('ctl00_PageBody_productDetail_ctl01'),
            document.getElementById('ctl00_PageBody_productDetail_ctl02')
        ];

        targetDivs.forEach(function (div) {
            if (div) {
                // Locate embedded content
                var embeddedContent = div.querySelector(':scope > div:not([class])');
                if (embeddedContent) {
                    // Add necessary styles and classes to the embedded content
                    embeddedContent.classList.add('widget-container', 'styled-description');

                    // Additional styling (if needed)
                    embeddedContent.style.border = '1px solid #ccc';
                    embeddedContent.style.padding = '10px';
                    embeddedContent.style.borderRadius = '8px';
                    embeddedContent.style.marginTop = '15px';
                    embeddedContent.style.backgroundColor = '#f9f9f9';
                    embeddedContent.style.fontFamily = 'Arial, sans-serif';
                    embeddedContent.style.fontSize = '14px';
                    embeddedContent.style.color = '#333';
                    embeddedContent.style.lineHeight = '1.6';

                    console.log("Styles applied to embedded content.");
                }
            }
        });
    }, 500); // Delay to ensure content is embedded first
});
</script>
