
(function () {
  // =========================
  // Config + Debug Utilities
  // =========================
  const UPS_REGEX = /^1Z[0-9A-Z]{16}$/i;              // optional sanity check
  const GRID_SEL = '#ctl00_PageBody_OrdersGrid_ctl00';
  const VEH_TRACK_SEL = 'td[data-title="Vehicle Tracking"] span[id*="VehicleTracking"]';
  const DEBUG = true;                                  // <-- toggle here
  const startTs = performance.now();

  // Lightweight on-page log panel (plus console)
  let logPanel;
  function ensureLogPanel() {
    if (logPanel) return logPanel;
    logPanel = document.createElement('div');
    logPanel.id = 'wl-debug-console';
    logPanel.style.cssText = `
      position: fixed; right: 12px; bottom: 12px; width: 360px; max-height: 40vh;
      background: #0b1020; color: #dbeafe; font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      border: 1px solid #334155; border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,.25);
      padding: 8px 8px 8px 8px; overflow: auto; z-index: 99999;
    `;
    const header = document.createElement('div');
    header.textContent = 'OpenOrders Tracker — Debug';
    header.style.cssText = 'font-weight:700;margin-bottom:6px;color:#93c5fd;';
    const small = document.createElement('div');
    small.style.cssText = 'margin-bottom:6px;color:#94a3b8;';
    small.innerHTML = 'Logs here + in console. <button id="wl-debug-clear" style="float:right;background:#1e293b;color:#fff;border-radius:6px;padding:2px 6px;border:0;cursor:pointer;">Clear</button>';
    logPanel.appendChild(header);
    logPanel.appendChild(small);
    const list = document.createElement('div');
    list.id = 'wl-debug-lines';
    logPanel.appendChild(list);
    document.body.appendChild(logPanel);
    document.getElementById('wl-debug-clear').onclick = () => { list.innerHTML = ''; };
    return logPanel;
  }
  function log(...args) {
    const t = (performance.now() - startTs).toFixed(1).padStart(6, ' ');
    const line = `[+${t}ms] ${args.join(' ')}`;
    console.log('%cOpenOrders Tracker','color:#6b0016;font-weight:bold;', line);
    if (!DEBUG) return;
    const panel = ensureLogPanel();
    const list = panel.querySelector('#wl-debug-lines');
    const div = document.createElement('div');
    div.textContent = line;
    list.appendChild(div);
    // keep scrolled to bottom
    panel.scrollTop = panel.scrollHeight;
  }
  function warn(...args){ console.warn('OpenOrders Tracker', ...args); log('WARN:', ...args); }
  function errorLog(...args){ console.error('OpenOrders Tracker', ...args); log('ERROR:', ...args); }

  // =========================
  // Core helpers
  // =========================
  function getGrid() {
    const node = document.querySelector(GRID_SEL);
    if (!node) log('Grid not found:', GRID_SEL);
    else log('Grid found.');
    return node;
  }

  function getOidFromRow(tr) {
    const a = tr.querySelector('td.wide-only a[href*="oid="]') ||
              tr.querySelector('td.narrow-only a[href*="oid="]');
    if (!a) { log('No Order# link in row id=', tr.id || '(no id)'); return null; }
    const href = a.getAttribute('href') || '';
    const m = /[?&]oid=(\d+)/.exec(href);
    if (!m) { log('OID not found in href:', href); return null; }
    return m[1];
  }

  async function hasUPSTracking(oid) {
    const url = `/OrderDetails_r.aspx?oid=${encodeURIComponent(oid)}`;
    log('Fetching details for OID', oid, '→', url);
    let res, html;
    try {
      res = await fetch(url, { credentials: 'same-origin', redirect: 'follow' });
    } catch (e) {
      errorLog('Fetch failed for OID', oid, e && e.message ? e.message : e);
      return { has: false, reason: 'fetch_error' };
    }

    log('Fetch status for OID', oid, String(res.status), res.redirected ? '(redirected)' : '');
    if (!res.ok) return { has: false, reason: `http_${res.status}` };

    try {
      html = await res.text();
    } catch (e) {
      errorLog('Read body failed for OID', oid, e && e.message ? e.message : e);
      return { has: false, reason: 'body_error' };
    }

    // Quick auth/redirect guard
    if (html && html.toLowerCase().includes('login') && html.toLowerCase().includes('password')) {
      warn('Looks like a login page for OID', oid, '(auth redirect?)');
      return { has: false, reason: 'auth_redirect' };
    }

    let doc;
    try {
      doc = new DOMParser().parseFromString(html, 'text/html');
    } catch (e) {
      errorLog('DOMParser failed for OID', oid, e && e.message ? e.message : e);
      return { has: false, reason: 'parse_error' };
    }

    const table = doc.querySelector('#ctl00_PageBody_ctl02_OrderDetailsGrid_ctl00');
    if (!table) {
      log('Details grid not found for OID', oid);
      return { has: false, reason: 'details_grid_missing' };
    }

    let found = false, rawNums = [];
    table.querySelectorAll('tr').forEach(tr => {
      const code = tr.querySelector('td[data-title="Product Code"]');
      const desc = tr.querySelector('td[data-title="Description"]');
      if (!code || !desc) return;
      if (code.textContent.trim().toUpperCase() === 'UPS') {
        const raw = desc.textContent.trim().replace(/\s+/g, '');
        if (raw) {
          rawNums.push(raw);
          if (UPS_REGEX.test(raw) || raw.length >= 8) found = true;
        }
      }
    });
    log('OID', oid, 'UPS candidates:', rawNums.length ? rawNums.join(',') : '(none)');
    return { has: found, reason: found ? 'ok' : 'no_ups_line' };
  }

  function injectButton(tr, oid) {
    const cellSpan = tr.querySelector(VEH_TRACK_SEL);
    let target = cellSpan;
    if (!target) {
      target = tr.lastElementChild;
      log('VehicleTracking span missing; falling back to last cell for OID', oid);
    }
    if (!target) { warn('No cell to inject into for OID', oid); return; }

    const a = document.createElement('a');
    a.className = 'wl-track-btn';
    a.href = `/OpenOrders_r.aspx?oid=${encodeURIComponent(oid)}&tracking=yes#detailsAnchor`;
    a.textContent = 'Track order';
    target.appendChild(a);
    log('Injected Track button for OID', oid);
  }

  // =========================
  // Main flow
  // =========================
  // Style (kept minimal)
  const css = document.createElement('style');
  css.textContent = `
    .wl-track-btn {
      display:inline-block; padding:6px 10px; border-radius:8px; font-weight:700;
      text-decoration:none; background:#6b0016; color:#fff; white-space:nowrap; margin-left:4px;
    }
    .wl-track-btn:hover { opacity:.9; }
    .wl-track-checking { font-size:12px; color:#6b7280; margin-left:4px; }
  `;
  document.head.appendChild(css);

  async function processRows() {
    const grid = getGrid();
    if (!grid) { warn('Abort: grid missing'); return; }

    const rows = Array.from(grid.querySelectorAll('tbody > tr.rgRow, tbody > tr.rgAltRow'));
    log('Rows found:', rows.length);

    for (const tr of rows) {
      const rowId = tr.id || '(no id)';
      const oid = getOidFromRow(tr);
      if (!oid) { log('Skip row', rowId, '— no OID'); continue; }

      // Show a light "checking…" status
      const vt = tr.querySelector(VEH_TRACK_SEL);
      let note;
      if (vt) {
        note = document.createElement('span');
        note.className = 'wl-track-checking';
        note.textContent = ' Checking tracking…';
        vt.appendChild(note);
      }

      try {
        const { has, reason } = await hasUPSTracking(oid);
        if (note) note.remove();
        log('OID', oid, 'hasUPSTracking =', String(has), 'reason=', reason);
        if (has) injectButton(tr, oid);
      } catch (e) {
        if (note) note.remove();
        errorLog('Unexpected error for OID', oid, e && e.message ? e.message : e);
      }
    }
    log('Done processing rows.');
  }

  function boot() {
    const ok = !!getGrid();
    if (!ok) return false;
    processRows();
    return true;
  }

  // Boot now or after async render
  if (!boot()) {
    log('Grid not ready — observing DOM…');
    const mo = new MutationObserver(() => {
      if (boot()) {
        log('Grid appeared — disconnecting observer.');
        mo.disconnect();
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => { mo.disconnect(); log('Observer timeout (10s) — stopped watching.'); }, 10000);
  }
})();

