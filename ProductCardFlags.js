<script>
$(document).ready(function () {
    const urls = {
        sale: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS-exMk9OF0fqSsiar-2i0Ui22bZ8t6KWL5x5hkWbd_3NSUuJ6Drz6ycFAj2mmUHVrhT4CDuDFNwaq9/pub?gid=0&single=true&output=csv',
        newItem: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS-exMk9OF0fqSsiar-2i0Ui22bZ8t6KWL5x5hkWbd_3NSUuJ6Drz6ycFAj2mmUHVrhT4CDuDFNwaq9/pub?gid=1286930330&single=true&output=csv',
        clearance: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS-exMk9OF0fqSsiar-2i0Ui22bZ8t6KWL5x5hkWbd_3NSUuJ6Drz6ycFAj2mmUHVrhT4CDuDFNwaq9/pub?gid=1769959350&single=true&output=csv'
    };

    Promise.all([
        fetch(urls.newItem).then(res => res.text()),
        fetch(urls.clearance).then(res => res.text()),
        fetch(urls.sale).then(res => res.text())
    ]).then(([newCSV, clearanceCSV, saleCSV]) => {
        // More reliable CSV parser using headers
        const parseCSV = (csv) => {
            const lines = csv.trim().split('\n');
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
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

        $("img").each(function () {
            const src = $(this).attr("src") || '0';
            if (src.includes('groups')) return;

            const extractedNumber = src.substring(src.lastIndexOf('/') + 1, src.lastIndexOf('.'));

            // New Item
            if (newItems.includes(extractedNumber)) {
                $(this).before('<div class="newitem-tag">New Item</div>');
            }

            // Clearance
            const clearanceMatch = clearanceItems.find(item => item.productid === extractedNumber);
            if (clearanceMatch && clearanceMatch.wasprice) {
                $(this).before('<div class="Clearance-tag">Clearance<br>Regular: ' + clearanceMatch.wasprice + '</div>');
            }

            // Sale
            const saleMatch = saleItems.find(item => item.productid === extractedNumber);
            if (saleMatch && saleMatch.wasprice) {
                $(this).before('<div class="SaleTag">Ready, Set, Save!<br>Was: ' + saleMatch.wasprice + '</div>');
            }
        });

        // Tag Styles
        $("<style type='text/css'> .newitem-tag{ position: absolute; background-color: red; color: white; padding: 10px; font-weight: bold; z-index: 10; border-radius: 20px; max-width: 100px; } </style>").appendTo("head");
        $("<style type='text/css'> .Clearance-tag{ display: block; margin-bottom:10px; background-color: black; color: white; padding: 10px; font-weight: bold; border-radius: 20px; max-width: 200px; } </style>").appendTo("head");
        $("<style type='text/css'> .SaleTag{ display: block; margin-bottom:10px; background-color: yellow; color: black; padding: 10px; font-weight: bold; border-radius: 20px; max-width: 200px; } </style>").appendTo("head");

    }).catch(error => {
        console.error('Error fetching or processing CSV data:', error);
    });
});
</script>
