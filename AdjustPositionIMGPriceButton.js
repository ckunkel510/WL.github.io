<script>
if (window.matchMedia("(min-width: 1030px)").matches) {
    if (window.location.href.includes("ProductDetail.aspx")) {
        window.onscroll = function() { adjustDivPosition(); };

        function adjustDivPosition() {
            var entryInputDiv = document.getElementById("ctl00_PageBody_productDetail_entryInputDiv");
            var productDetailDiv = document.getElementById("ctl00_PageBody_productDetail_ctl02") || 
                                   document.getElementById("ctl00_PageBody_productDetail_ctl01");

            // Check if both elements exist on the page before proceeding
            if (!entryInputDiv || !productDetailDiv) {
                console.warn("One or more required elements are missing from the page.");
                return; // Exit the function if any of the elements are not found
            }

            var productDetailHeight = productDetailDiv.offsetHeight;
            var productDetailTop = productDetailDiv.offsetTop;
            var scrollPosition = window.pageYOffset || document.documentElement.scrollTop;

            // Add condition to check if the user has scrolled back to the top of the page
            if (scrollPosition <= productDetailTop) {
                // User is at the top of the page, remove the sticky class
                entryInputDiv.classList.remove("sticky");
            } else if (scrollPosition >= productDetailTop && scrollPosition <= (productDetailTop + productDetailHeight)) {
                // User is within the scrolling range of productDetailDiv, add the sticky class
                entryInputDiv.classList.add("sticky");
            } else {
                // User has scrolled past the productDetailDiv, remove the sticky class
                entryInputDiv.classList.remove("sticky");
            }
        }
    } else {
        console.info("This script only runs on pages with 'ProductDetail.aspx' in the URL.");
    }
} else {
    console.info("This script only runs on screens with a minimum width of 1030px.");
}
</script>
