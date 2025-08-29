$(document).ready(function () {
    const now = new Date().getTime();
    const urls = {
        sale: `https://docs.google.com/spreadsheets/d/e/2PACX-1vS-exMk9OF0fqSsiar-2i0Ui22bZ8t6KWL5x5hkWbd_3NSUuJ6Drz6ycFAj2mmUHVrhT4CDuDFNwaq9/pub?gid=0&single=true&output=csv&t=${now}`,
        newItem: `https://docs.google.com/spreadsheets/d/e/2PACX-1vS-exMk9OF0fqSsiar-2i0Ui22bZ8t6KWL5x5hkWbd_3NSUuJ6Drz6ycFAj2mmUHVrhT4CDuDFNwaq9/pub?gid=1286930330&single=true&output=csv&t=${now}`,
        clearance: `https://docs.google.com/spreadsheets/d/e/2PACX-1vS-exMk9OF0fqSsiar-2i0Ui22bZ8t6KWL5x5hkWbd_3NSUuJ6Drz6ycFAj2mmUHVrhT4CDuDFNwaq9/pub?gid=1769959350&single=true&output=csv&t=${now}`
    };

    Promise.all([
        fetch(urls.newItem).then(res => res.text()),
        fetch(urls.clearance).then(res => res.text()),
        fetch(urls.sale).then(res => res.text())
    ]).then(([newCSV, clearanceCSV, saleCSV]) => {
        const parseCSV = (csv) => {
            const lines = csv.trim().split('\n');
            const headers = lines[0].split(',').map(h => h.trim());
            return lines.slice(1).map(line => {
                const values = line.split(',').map(v => v.trim());
                const entry = {};
                headers.forEach((header, i) => {
                    entry[header] = values[i] || '';
                });
                return entry;
            });
        };

        const newItems = parseCSV(newCSV).map(item => item.productid);
        const clearanceItems = parseCSV(clearanceCSV);
        const saleItems = parseCSV(saleCSV);

        setTimeout(() => {
            $(".newitem-tag, .Clearance-tag, .SaleTag").remove();

            $("img").each(function () {
                const src = $(this).attr("src") || '0';
                if (src.includes('groups')) return;

                const extractedNumber = src.substring(src.lastIndexOf('/') + 1, src.lastIndexOf('.'));

                // Wrap image in relative-positioned container if not already wrapped
                if (!$(this).parent().hasClass("image-wrapper")) {
                    $(this).wrap("<div class='image-wrapper' style='position:relative; display:inline-block;'></div>");
                }

                const $wrapper = $(this).parent();

                if (newItems.includes(extractedNumber)) {
                    $wrapper.append('<div class="newitem-tag animated">New Item</div>');
                }

                const clearanceMatch = clearanceItems.find(item => item.productid === extractedNumber);
                if (clearanceMatch && clearanceMatch.wasprice) {
                    $wrapper.append('<div class="Clearance-tag animated">Clearance<br><span>Regular: $' + clearanceMatch.wasprice + '</span></div>');
                }

                const saleMatch = saleItems.find(item => item.productid === extractedNumber);
                if (saleMatch && saleMatch.wasprice) {
                    $wrapper.append('<div class="SaleTag animated">Labor Day Savings!<br><span>Was: $' + saleMatch.wasprice + '</span></div>');
                }
            });
        }, 1000);

        // Tag styles
        $("<style type='text/css'> \
            .animated { animation: popIn 0.5s ease-out; } \
            @keyframes popIn { \
                from { transform: scale(0.7); opacity: 0; } \
                to { transform: scale(1); opacity: 1; } \
            } \
            .newitem-tag { \
                position: absolute; top: 8px; left: 8px; background-color: #c20000; \
                color: white; padding: 6px 12px; font-weight: bold; border-radius: 4px; \
                font-size: 13px; box-shadow: 0 2px 5px rgba(0,0,0,0.3); \
                transform: rotate(-10deg); z-index: 10; \
            } \
            .Clearance-tag { \
                position: absolute; bottom: 8px; left: 8px; background: black; color: white; \
                padding: 10px; font-weight: bold; border-radius: 12px; font-size: 16px; \
                box-shadow: 0 0 10px rgba(255,255,255,0.3); \
            } \
            .Clearance-tag span { display: block; font-size: 14px; color: #ccc; } \
            .SaleTag { \
                position: absolute; bottom: 2px; right: 2px; background: #38B6FF; color: #000; \
                padding: 10px; font-weight: bold; border-radius: 12px; font-size: 16px; \
                box-shadow: 0 0 10px rgba(255, 215, 0, 0.5); \
            } \
            .SaleTag span { display: block; font-size: 14px; color: #444; } \
        </style>").appendTo("head");

    }).catch(error => {
        console.error('Error fetching or processing CSV data:', error);
    });
});
