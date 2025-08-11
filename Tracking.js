
(function () {
  // --- Config ---
  const UPS_REGEX = /^1Z[0-9A-Z]{16}$/i; // optional sanity check (kept lenient)
  const GRID_SEL = '#ctl00_PageBody_OrdersGrid_ctl00'; // master table
  const VEH_TRACK_SEL = 'td[data-title="Vehicle Tracking"] span[id*="VehicleTracking"]';

  // Style
  const css = document.createElement('style');
  css.textContent = `
    .wl-track-btn {
      display:inline-block; padding:6px 10px; border-radius:8px; font-weight:700;
      text-decoration:none; background:#6b0016; color:#fff; white-space:nowrap;
    }
    .wl-track-btn:hover { opacity:.9; }
    .wl-track-checking { font-size:12px; color:#6b7280; }
  `;
  document.head.appendChild(css);

  function getGrid() {
    return document.querySelector(GRID_SEL);
  }

  function getOidFromRow(tr) {
    // Prefer wide-only, then narrow-only
    const wide = tr.querySelector('td.wide-only a[href*="oid="]') ||
                 tr.querySelector('td.narrow-only a[href*="oid="]');
    if (!wide) return null;
    const m = /[?&]oid=(\d+)/.exec(wide.getAttribute('href'));
    return m ? m[1] : null;
  }

  async function hasUPSTracking(oid) {
    try {
      const res = await fetch(`/OrderDetails_r.aspx?oid=${encodeURIComponent(oid)}`, { credentials: 'same-origin' });
      if (!res.ok) return false;
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const table = doc.querySelector('#ctl00_PageBody_ctl02_OrderDetailsGrid_ctl00');
      if (!table) return false;

      let found = false;
      table.querySelectorAll('tr').forEach(tr => {
        const code = tr.querySelector('td[data-title="Product Code"]');
        const desc = tr.querySelector('td[data-title="Description"]');
        if (!code || !desc) return;
        if (code.textContent.trim().toUpperCase() === 'UPS') {
          const raw = desc.textContent.trim().replace(/\s+/g, '');
          if (raw) {
            // keep even if it doesn't strictly match UPS format
            if (UPS_REGEX.test(raw) || raw.length >= 8) found = true;
          }
        }
      });
      return found;
    } catch (e) {
      return false;
    }
  }

  function injectButton(tr, oid) {
    const cellSpan = tr.querySelector(VEH_TRACK_SEL);
    const target = cellSpan || tr.lastElementChild; // fallback to last cell
    if (!target) return;

    const a = document.createElement('a');
    a.className = 'wl-track-btn';
    a.href = `/OpenOrders_r.aspx?oid=${encodeURIComponent(oid)}&tracking=yes#detailsAnchor`;
    a.textContent = 'Track order';
    target.appendChild(a);
  }

  async function processRows() {
    const grid = getGrid();
    if (!grid) return;

    const rows = Array.from(grid.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
    for (const tr of rows) {
      const oid = getOidFromRow(tr);
      if (!oid) continue;

      // Optional: show lightweight "checking…" text while we fetch
      const vt = tr.querySelector(VEH_TRACK_SEL);
      if (vt) {
        const note = document.createElement('span');
        note.className = 'wl-track-checking';
        note.textContent = ' Checking tracking…';
        vt.appendChild(note);
        hasUPSTracking(oid).then(has => {
          note.remove();
          if (has) injectButton(tr, oid);
        }).catch(() => note.remove());
      } else {
        // No vehicle tracking cell; just check and inject into last cell if found
        if (await hasUPSTracking(oid)) injectButton(tr, oid);
      }
    }
  }

  function boot() {
    if (!getGrid()) return false;
    processRows();
    return true;
  }

  if (!boot()) {
    const mo = new MutationObserver(() => {
      if (boot()) mo.disconnect();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 10000);
  }
})();

