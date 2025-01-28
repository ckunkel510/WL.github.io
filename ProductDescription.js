document.addEventListener('DOMContentLoaded', function () {
    const targetDivIds = ['ctl00_PageBody_productDetail_ctl01', 'ctl00_PageBody_productDetail_ctl02'];
    let iframeElement = null;

    for (const id of targetDivIds) {
        const div = document.getElementById(id);
        if (div) {
            iframeElement = div.querySelector('iframe');
            if (iframeElement) {
                iframeElement.id = 'DescriptionIframe';
                break;
            }
        }
    }

    if (!iframeElement) {
        console.error("No iframe found in the target divs.");
        return;
    }

    // Ensure the iframe exists and attach a 'load' event listener
    $(iframeElement).on('load', function () {
        console.log("Iframe loaded successfully.");
        try {
            const iframeContent = iframeElement.contentDocument || iframeElement.contentWindow.document;
            if (!iframeContent || !iframeContent.body || !iframeContent.body.innerHTML.trim()) {
                console.warn("Iframe content is empty or inaccessible.");
                return;
            }
            console.log("Iframe content:", iframeContent.body.innerHTML);
        } catch (e) {
            console.error("Error accessing iframe content:", e);
        }
    });
});
