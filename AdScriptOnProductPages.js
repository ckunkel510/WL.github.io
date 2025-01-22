$(document).ready(function() {
    // Create an anchor element
    var linkElement = $('<a>', {
        href: 'https://webtrack.woodsonlumber.com/Products.aspx?pl1=4546&pg=4518&sort=StockClassSort&direction=asc', // Replace with the URL you want the image to link to
        target: '_blank',           // Opens the link in a new tab
        title: 'Click to visit'     // Tooltip text
    });

    // Create an image element
    var imgElement = $('<img>', {
        src: 'https://images-woodsonlumber.sirv.com/Other%20Website%20Images/2025.1%20Graphic%20gif.gif', // Replace with the actual image URL
        alt: 'Description of the image', // Add a description for accessibility
        width: '50%', // Adjust the width as needed
        height: 'auto'  // Set height as auto to maintain aspect ratio

    }).css({
        'margin': '20px' , 'min-width':'350px', 'min-height':'105px'// Apply margin as needed, e.g., 20px (adjust this value)
    });

    // Append the image to the anchor element
    linkElement.append(imgElement);

    // Insert the linked image before the element with id 'ctl00_PageBody_productDetail_productDescription'
    $('#ctl00_PageBody_productDetail_productDescription').before(linkElement);
});
