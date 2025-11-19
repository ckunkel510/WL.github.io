
$(document).ready(function () {
  const cacheBust = Date.now();
  const EXPIRES_LABEL = 'Expires'; // Change to 'Offer expires' if you prefer

  const urls = {
    sale: `https://docs.google.com/spreadsheets/d/e/2PACX-1vS-exMk9OF0fqSsiar-2i0Ui22bZ8t6KWL5x5hkWbd_3NSUuJ6Drz6ycFAj2mmUHVrhT4CDuDFNwaq9/pub?gid=0&single=true&output=csv&t=${cacheBust}`,
    newItem: `https://docs.google.com/spreadsheets/d/e/2PACX-1vS-exMk9OF0fqSsiar-2i0Ui22bZ8t6KWL5x5hkWbd_3NSUuJ6Drz6ycFAj2mmUHVrhT4CDuDFNwaq9/pub?gid=1286930330&single=true&output=csv&t=${cacheBust}`,
    clearance: `https://docs.google.com/spreadsheets/d/e/2PACX-1vS-exMk9OF0fqSsiar-2i0Ui22bZ8t6KWL5x5hkWbd_3NSUuJ6Drz6ycFAj2mmUHVrhT4CDuDFNwaq9/pub?gid=1769959350&single=true&output=csv&t=${cacheBust}`
  };

  // Basic CSV parser (works for your simple sheets)
  const parseCSV = (csv) => {
    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const row = {};
      headers.forEach((h, i) => row[h] = values[i] || '');
      return row;
    });
  };

  // Parse dates safely: accepts ISO (YYYY-MM-DD) or US (MM/DD/YYYY)
  const parseDate = (str) => {
    if (!str) return null;
    const s = String(str).trim();
    if (!s) return null;

    // ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const d = new Date(s + 'T23:59:59');
      return isNaN(d) ? null : d;
    }
    // MM/DD/YYYY
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const mm = parseInt(m[1], 10) - 1;
      const dd = parseInt(m[2], 10);
      const yy = parseInt(m[3], 10);
      const d = new Date(yy, mm, dd, 23, 59, 59);
      return isNaN(d) ? null : d;
    }
    // Fallback
    const d = new Date(s);
    return isNaN(d) ? null : d;
  };

  Promise.all([
    fetch(urls.newItem).then(r => r.text()),
    fetch(urls.clearance).then(r => r.text()),
    fetch(urls.sale).then(r => r.text())
  ]).then(([newCSV, clearanceCSV, saleCSV]) => {
    const newItems = parseCSV(newCSV).map(item => item.productid);
    const clearanceItems = parseCSV(clearanceCSV); // expect productid, wasprice
    const saleItems = parseCSV(saleCSV);           // expect productid, wasprice, expirationdate

    setTimeout(() => {
      // Remove any old badges (in case script re-runs)
      $(".wl-flags, .newitem-tag, .Clearance-tag, .SaleTag").remove();

      const now = new Date();

      $("img").each(function () {
        const $img = $(this);
        const src = $img.attr("src") || '';
        if (!src || src.includes('groups')) return;

        const productId = src.substring(src.lastIndexOf('/') + 1, src.lastIndexOf('.'));
        if (!productId) return;

        // Ensure a wrapper around the image so we can append flags just below it
        if (!$img.parent().hasClass("image-with-flags")) {
          $img.wrap("<div class='image-with-flags' style='display:inline-block; width:100%;'></div>");
        }
        const $wrap = $img.parent();

        // Ensure a flags container right after the image
        let $flags = $wrap.children(".wl-flags");
        if ($flags.length === 0) {
          $flags = $("<div class='wl-flags'></div>");
          $img.after($flags);
        }

        // NEW ITEM
        if (newItems.includes(productId)) {
          $flags.append('<span class="badge newitem-tag animated">New Item</span>');
        }

        // CLEARANCE
        const clearanceMatch = clearanceItems.find(row => row.productid === productId);
        if (clearanceMatch && clearanceMatch.wasprice) {
          $flags.append(
            `<span class="badge clearance-tag animated">Clearance <em>Regular: $${clearanceMatch.wasprice}</em></span>`
          );
        }

        // SALE with expiration handling
        const saleMatch = saleItems.find(row => row.productid === productId);
        if (saleMatch && saleMatch.wasprice) {
          const expDate = parseDate(saleMatch.expirationdate);
          const isExpired = expDate ? now > expDate : false;

          if (!isExpired) {
            const expiresText = expDate
              ? ` <small class="expires">(${EXPIRES_LABEL}: ${saleMatch.expirationdate})</small>`
              : '';
            $flags.append(
              `<span class="badge sale-tag animated">Holiday Deals! <em>Was: $${saleMatch.wasprice}</em>${expiresText}</span>`
            );
          }
        }

        // If no flags ended up being added, remove empty container
        if ($flags.children().length === 0) $flags.remove();
      });
    }, 1000);

    // Styles for below-image badges
    $("<style type='text/css'> \
      .animated { animation: popIn 0.35s ease-out; } \
      @keyframes popIn { from { transform: scale(.96); opacity: 0; } to { transform: scale(1); opacity: 1; } } \
      .wl-flags { \
        display: flex; flex-wrap: wrap; gap: 6px; \
        align-items: center; margin-top: 8px; \
      } \
      .badge { \
        display: inline-flex; align-items: center; gap: 6px; \
        padding: 6px 10px; border-radius: 999px; font-weight: 700; \
        font-size: 12px; line-height: 1; white-space: nowrap; \
      } \
      .badge em { font-style: normal; font-weight: 600; opacity: .85; } \
      .badge small.expires { font-weight: 600; opacity: .85; } \
      .newitem-tag { background-color: #c20000; color: #fff; } \
      .clearance-tag { background: #000; color: #fff; } \
      .sale-tag { background: #007d0c; color: #000; } \
      /* Optional: make badges stack nicely on tight grids */ \
      .image-with-flags { max-width: 100%; } \
    </style>").appendTo("head");

  }).catch(err => {
    console.error('Error fetching or processing CSV data:', err);
  });
});

