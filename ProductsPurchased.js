/* =========================================================================
   Woodson — Previous Purchases / Reorder Center (v1.3.1)
   - ProductsPurchased_R.aspx rewrite
   - Adds new grouped account menu
   - Reframes page as previous purchases + reorder helper
   - Filters delivery/service lines out of customer-facing product lists
   - Aggregates purchase history by product code
   - Suggests likely reorders from repeat purchase timing
   - Optional product feed lookup hook for real PDP URLs
   ========================================================================== */

(function () {
  'use strict';

  if (!/ProductsPurchased_R\.aspx/i.test(window.location.pathname)) return;
  if (window.__WL_PREVIOUS_PURCHASES_BOOTED__) return;
  window.__WL_PREVIOUS_PURCHASES_BOOTED__ = true;

  var CONFIG = {
    BRAND: '#6b0016',
    AUTO_EXPAND_TO_12_MONTHS: true,
    AUTO_EXPAND_SESSION_KEY: 'wl_previous_purchases_expand_12mo_v1',

    // Optional:
    // Set window.WL_PREVIOUS_PURCHASES_PRODUCT_FEED_URL before this file loads,
    // or paste a published CSV/JSON URL here.
    // Expected helpful headers: id, mpn, ProductCode, productcode, link, Product Page URL, producturl, ProductID, productid.
    PRODUCT_FEED_URL: window.WL_PREVIOUS_PURCHASES_PRODUCT_FEED_URL || 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQgGN3k90_sRn2oHrmM4OZiL6-EaxOT7ggSDfXo5EpBdLJ4mPTh4P1FLEpGlUWu98b_MEhVVRabv1og/pub?output=csv',

    // Fallback when no product URL is available. This keeps customers on WebTrack search by product code.
    PRODUCT_SEARCH_URL: function (productCode, description) {
      var q = productCode || description || '';
      return '/Products.aspx?searchText=' + encodeURIComponent(q);
    },

    // If your feed has ProductID but not a direct product URL, update this template as needed.
    // Example: '/ProductDetail.aspx?pid={ProductID}'
    PRODUCT_DETAIL_URL_TEMPLATE: '',

    SERVICE_CODES: [
      'WEB DELIVER',
      'WEB DELIVERY',
      'STANDARD DELIVERY',
      'SD',
      'FUEL SURCHARGE',
      'FUEL',
      'UPS SHIPPING',
      'UPS',
      'SHIPPING',
      'DELIVERY',
      'DELIVERY CHARGE',
      'FREIGHT'
    ]
  };

  var logPrefix = '[PreviousPurchases]';
  var DEBUG = false;
  function log() { if (DEBUG) console.log.apply(console, [logPrefix].concat([].slice.call(arguments))); }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  function $(selector, root) { return (root || document).querySelector(selector); }
  function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }
  function txt(el) { return (el && el.textContent ? el.textContent : '').replace(/\s+/g, ' ').trim(); }
  function html(value) {
    return String(value == null ? '' : value).replace(/[&<>"]/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch];
    });
  }
  function attr(value) { return html(value).replace(/'/g, '&#39;'); }
  function abs(url) {
    if (!url || /^javascript:/i.test(String(url))) return url || '';
    try { return new URL(url, window.location.origin).toString(); }
    catch (err) { return url; }
  }
  function parseMoney(value) {
    var n = parseFloat(String(value || '').replace(/[^0-9.\-]/g, '') || '0');
    return Number.isFinite(n) ? n : 0;
  }
  function parseQty(value) {
    var n = parseFloat(String(value || '').replace(/[^0-9.\-]/g, '') || '0');
    return Number.isFinite(n) ? n : 0;
  }
  function money(value) {
    var n = typeof value === 'number' ? value : parseMoney(value);
    return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  }
  function cleanDate(value) {
    var text = String(value || '').trim();
    if (!text) return '';
    return text.replace(/\s+\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?$/i, '');
  }
  function parseDate(value) {
    var d = new Date(String(value || '').replace(/-/g, '/'));
    return isNaN(d.getTime()) ? null : d;
  }
  function daysBetween(a, b) {
    if (!a || !b) return null;
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }
  function todayMidnight() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  function normalize(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toUpperCase();
  }

  function injectCSS() {
    if ($('#wlpp-styles')) return;
    var style = document.createElement('style');
    style.id = 'wlpp-styles';
    style.textContent = `
      .wlpp, .wlpp * { box-sizing: border-box; }
      .wlpp {
        --wlpp-brand: ${CONFIG.BRAND};
        --wlpp-soft: #fbf5f6;
        --wlpp-border: #e5e7eb;
        --wlpp-muted: #64748b;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        color: #222;
        margin: 8px 0 24px;
      }
      .wlpp-top {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }
      .wlpp-menu-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }
      .wlpp-menu-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border: 1px solid var(--wlpp-border);
        background: #fff;
        color: var(--wlpp-brand);
        font-weight: 900;
        border-radius: 10px;
        padding: 9px 13px;
        cursor: pointer;
        line-height: 1.1;
        white-space: nowrap;
      }
      .wlpp-menu-btn:hover { background: var(--wlpp-soft); }
      .wlpp-title { color: var(--wlpp-brand); font-size: 1.24rem; line-height: 1.2; font-weight: 900; }
      .wlpp-subtitle { color: var(--wlpp-muted); margin-top: 3px; font-size: .92rem; line-height: 1.35; }
      .wlpp-menu {
        position: absolute;
        left: 0;
        top: 46px;
        z-index: 7001;
        width: min(390px, 92vw);
        max-height: 0;
        overflow: auto;
        padding: 0 8px;
        background: #fff;
        border: 1px solid var(--wlpp-border);
        border-radius: 14px;
        box-shadow: 0 12px 30px rgba(0,0,0,.16);
        opacity: 0;
        pointer-events: none;
        transition: max-height .25s ease, opacity .18s ease, padding .18s ease;
      }
      .wlpp-menu.open { max-height: 72vh; opacity: 1; pointer-events: auto; padding: 8px; }
      .wlpp-menu-section + .wlpp-menu-section { border-top: 1px solid #eee; margin-top: 6px; padding-top: 6px; }
      .wlpp-menu-label {
        color: var(--wlpp-brand);
        font-size: .72rem;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: .06em;
        padding: 5px 10px 3px;
      }
      .wlpp-menu a {
        display: block;
        padding: 9px 10px;
        color: #111;
        text-decoration: none;
        border-radius: 9px;
        font-weight: 700;
      }
      .wlpp-menu a:hover, .wlpp-menu a[aria-current="page"] { background: var(--wlpp-soft); color: var(--wlpp-brand); }
      .wlpp-top-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
      .wlpp-btn, .wlpp-top-actions a {
        appearance: none;
        border: 1px solid var(--wlpp-border);
        border-radius: 10px;
        background: #fff;
        color: #111;
        min-height: 38px;
        padding: 9px 13px;
        font-weight: 850;
        text-decoration: none;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
      }
      .wlpp-btn:hover, .wlpp-top-actions a:hover { background: var(--wlpp-soft); color: var(--wlpp-brand); }
      .wlpp-btn-primary { background: var(--wlpp-brand); border-color: var(--wlpp-brand); color: #fff; }
      .wlpp-btn-primary:hover { background: #4d0010; color: #fff; }
      .wlpp-toolbar {
        background: #fff;
        border: 1px solid var(--wlpp-border);
        border-radius: 16px;
        box-shadow: 0 4px 14px rgba(15,23,42,.05);
        padding: 12px;
        margin-bottom: 12px;
        display: grid;
        grid-template-columns: minmax(260px, 1fr) auto;
        gap: 10px;
      }
      .wlpp-toolbar label {
        display: block;
        margin-bottom: 6px;
        color: #475569;
        font-size: 12px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: .04em;
      }
      .wlpp-input, .wlpp-select {
        width: 100%;
        min-height: 40px;
        border: 1px solid var(--wlpp-border);
        border-radius: 12px;
        padding: 9px 11px;
        font: inherit;
        background: #fff;
      }
      .wlpp-input:focus, .wlpp-select:focus { outline: 2px solid rgba(107,0,22,.18); border-color: var(--wlpp-brand); }
      .wlpp-controls { display: flex; align-items: end; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
      .wlpp-chip {
        border: 1px solid var(--wlpp-border);
        border-radius: 999px;
        padding: 8px 12px;
        font-weight: 850;
        background: #fff;
        color: #0f172a;
        font-size: 12px;
        cursor: pointer;
      }
      .wlpp-chip[data-active="true"] { border-color: var(--wlpp-brand); background: var(--wlpp-soft); color: var(--wlpp-brand); }
      .wlpp-note { grid-column: 1 / -1; color: var(--wlpp-muted); font-size: 12px; line-height: 1.35; }
      .wlpp-summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(155px, 1fr));
        gap: 10px;
        margin-bottom: 12px;
      }
      .wlpp-summary-card {
        background: #fff;
        border: 1px solid #ead4d9;
        border-radius: 14px;
        padding: 12px;
      }
      .wlpp-summary-label { color: var(--wlpp-muted); font-size: .78rem; font-weight: 900; text-transform: uppercase; letter-spacing: .04em; }
      .wlpp-summary-value { margin-top: 2px; color: var(--wlpp-brand); font-size: 1.25rem; font-weight: 950; }
      .wlpp-suggested {
        background: linear-gradient(135deg, #fff, var(--wlpp-soft));
        border: 1px solid #ead4d9;
        border-radius: 16px;
        padding: 13px;
        margin-bottom: 14px;
      }
      .wlpp-section-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin: 4px 0 10px;
      }
      .wlpp-section-title h3 {
        color: var(--wlpp-brand);
        margin: 0;
        font-size: 1.05rem;
        font-weight: 950;
      }
      .wlpp-section-title p { margin: 2px 0 0; color: var(--wlpp-muted); font-size: .9rem; }
      .wlpp-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(285px, 1fr)); gap: 12px; }
      .wlpp-product {
        background: #fff;
        border: 1px solid var(--wlpp-border);
        border-radius: 16px;
        box-shadow: 0 6px 18px rgba(15,23,42,.06);
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      .wlpp-media {
        position: relative;
        width: 100%;
        aspect-ratio: 4 / 3;
        background: linear-gradient(135deg, #fafafa, #f1f5f9);
        border-bottom: 1px solid #eef0f3;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .wlpp-media img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
        background: #fff;
      }
      .wlpp-media-fallback {
        padding: 16px;
        text-align: center;
        color: var(--wlpp-brand);
        font-weight: 900;
        line-height: 1.25;
      }
      .wlpp-media-badge {
        position: absolute;
        right: 10px;
        bottom: 10px;
        background: rgba(255,255,255,.92);
        color: #334155;
        border: 1px solid #e2e8f0;
        border-radius: 999px;
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 900;
      }
      .wlpp-modal-product {
        display: grid;
        grid-template-columns: 180px minmax(0, 1fr);
        gap: 14px;
        align-items: start;
        margin-bottom: 12px;
      }
      .wlpp-modal-media {
        width: 100%;
        aspect-ratio: 1 / 1;
        border: 1px solid #ead4d9;
        border-radius: 14px;
        overflow: hidden;
        background: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .wlpp-modal-media img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
      }
      .wlpp-product.hidden { display: none; }
      .wlpp-card-head { padding: 13px 14px 9px; border-bottom: 1px solid #eef0f3; }
      .wlpp-code { color: var(--wlpp-brand); font-family: ui-monospace, Menlo, Consolas, monospace; font-weight: 950; font-size: 1rem; word-break: break-word; }
      .wlpp-desc { margin-top: 5px; color: #111; font-weight: 760; line-height: 1.28; }
      .wlpp-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
      .wlpp-tag { display: inline-flex; align-items: center; border-radius: 999px; padding: 5px 9px; background: #f1f5f9; color: #334155; font-size: 12px; font-weight: 850; }
      .wlpp-tag-reorder { background: #fef3c7; color: #92400e; }
      .wlpp-tag-ready { background: #dcfce7; color: #065f46; }
      .wlpp-card-body { padding: 12px 14px; display: grid; gap: 9px; flex: 1; }
      .wlpp-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .wlpp-metric { border: 1px solid #eef0f3; border-radius: 12px; padding: 9px; background: #f8fafc; }
      .wlpp-metric-label { color: var(--wlpp-muted); font-size: .75rem; font-weight: 900; text-transform: uppercase; letter-spacing: .04em; }
      .wlpp-metric-value { margin-top: 2px; font-weight: 950; color: #111; }
      .wlpp-last { color: var(--wlpp-muted); font-size: .88rem; line-height: 1.4; }
      .wlpp-card-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        padding: 0 14px 14px;
      }
      .wlpp-history {
        background: #fff;
        border: 1px solid var(--wlpp-border);
        border-radius: 16px;
        overflow: hidden;
      }
      .wlpp-history-head {
        padding: 12px 14px;
        background: #f8fafc;
        border-bottom: 1px solid var(--wlpp-border);
        color: var(--wlpp-brand);
        font-weight: 950;
      }
      .wlpp-table { width: 100%; border-collapse: collapse; font-size: .9rem; }
      .wlpp-table th, .wlpp-table td { padding: 10px 11px; border-bottom: 1px solid #eef0f3; text-align: left; vertical-align: top; }
      .wlpp-table th { color: #475569; font-size: .75rem; text-transform: uppercase; letter-spacing: .04em; background: #fff; }
      .wlpp-table tr.hidden { display: none; }
      .wlpp-empty {
        background: #fff;
        border: 1px solid #ead4d9;
        border-radius: 14px;
        padding: 14px;
        color: var(--wlpp-muted);
        line-height: 1.45;
      }
      .wlpp-modal {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: none;
        align-items: flex-start;
        justify-content: center;
        padding: 18px;
        background: rgba(0,0,0,.45);
        overflow: auto;
      }
      .wlpp-modal.open { display: flex; }
      .wlpp-modal-card {
        width: min(1000px, 96vw);
        margin: auto 0;
        background: #fff;
        border-radius: 16px;
        border: 1px solid var(--wlpp-border);
        box-shadow: 0 18px 44px rgba(0,0,0,.22);
        overflow: hidden;
        max-height: calc(100vh - 36px);
        display: flex;
        flex-direction: column;
      }
      .wlpp-modal-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        background: var(--wlpp-brand);
        color: #fff;
        padding: 12px 14px;
        flex: 0 0 auto;
      }
      .wlpp-modal-title { font-weight: 950; font-size: 1.05rem; }
      .wlpp-modal-subtitle { color: rgba(255,255,255,.88); font-size: .88rem; margin-top: 2px; }
      .wlpp-modal-close {
        border: 1px solid rgba(255,255,255,.55);
        background: rgba(255,255,255,.12);
        color: #fff;
        border-radius: 10px;
        min-height: 36px;
        padding: 7px 11px;
        font-weight: 850;
        cursor: pointer;
      }
      .wlpp-modal-body { padding: 14px; background: var(--wlpp-soft); overflow: auto; }
      .wlpp-hide {
        position: absolute !important;
        left: -9999px !important;
        width: 1px !important;
        height: 1px !important;
        overflow: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      @media (max-width: 760px) {
        .wlpp-top { align-items: flex-start; flex-direction: column; }
        .wlpp-toolbar { grid-template-columns: 1fr; }
        .wlpp-controls { justify-content: flex-start; }
        .wlpp-table { display: block; overflow-x: auto; white-space: nowrap; }
        .wlpp-modal-product { grid-template-columns: 1fr; }
      }
    `;

    style.textContent += `
      .wlpp-buyagain-layout {
        display: grid;
        grid-template-columns: 235px minmax(0, 1fr);
        gap: 16px;
        align-items: start;
      }
      .wlpp-sidebar {
        position: sticky;
        top: 12px;
        background: #fff;
        border: 1px solid var(--wlpp-border);
        border-radius: 14px;
        box-shadow: 0 4px 14px rgba(15,23,42,.05);
        padding: 14px;
      }
      .wlpp-sidebar h3 {
        color: #111;
        font-size: .98rem;
        font-weight: 950;
        margin: 0 0 9px;
      }
      .wlpp-sidebar-section + .wlpp-sidebar-section {
        border-top: 1px solid #eef0f3;
        margin-top: 14px;
        padding-top: 14px;
      }
      .wlpp-sidebar .wlpp-select,
      .wlpp-sidebar .wlpp-input {
        min-height: 38px;
        border-radius: 9px;
      }
      .wlpp-filter-list {
        display: grid;
        gap: 7px;
      }
      .wlpp-side-filter {
        border: 0;
        background: transparent;
        color: #111;
        text-align: left;
        padding: 4px 0;
        font: inherit;
        font-size: .92rem;
        cursor: pointer;
      }
      .wlpp-side-filter:hover,
      .wlpp-side-filter[data-active="true"] {
        color: var(--wlpp-brand);
        font-weight: 900;
      }
      .wlpp-clear-link {
        border: 0;
        background: transparent;
        color: #2563eb;
        padding: 0;
        font: inherit;
        font-size: .9rem;
        cursor: pointer;
        text-align: left;
      }
      .wlpp-results-top {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
      }
      .wlpp-results-top h2 {
        margin: 0;
        color: #111;
        font-size: 1.22rem;
        font-weight: 950;
      }
      .wlpp-results-top p {
        margin: 3px 0 0;
        color: var(--wlpp-muted);
        font-size: .9rem;
      }
      .wlpp-toolbar {
        grid-template-columns: 1fr auto;
        box-shadow: none;
        border-radius: 14px;
        margin-bottom: 14px;
      }
      .wlpp-summary,
      .wlpp-suggested {
        display: none !important;
      }
      .wlpp-grid {
        grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
        gap: 14px;
      }
      .wlpp-product {
        border-radius: 10px;
        box-shadow: none;
        border-color: #ddd;
        transition: box-shadow .14s ease, transform .14s ease, border-color .14s ease;
      }
      .wlpp-product:hover {
        border-color: #cbd5e1;
        box-shadow: 0 8px 22px rgba(15,23,42,.12);
        transform: translateY(-1px);
      }
      .wlpp-media {
        aspect-ratio: 1 / 1;
        height: 205px;
        padding: 12px;
        background: #fff;
      }
      .wlpp-media img {
        object-fit: contain;
        mix-blend-mode: multiply;
      }
      .wlpp-media-badge {
        display: none;
      }
      .wlpp-media-fallback {
        width: 100%;
        height: 100%;
        border: 1px dashed #cbd5e1;
        border-radius: 10px;
        display: grid;
        place-items: center;
        padding: 14px;
        background: linear-gradient(135deg, #fff, #f8fafc);
      }
      .wlpp-card-head {
        border-bottom: 0;
        padding: 10px 12px 4px;
      }
      .wlpp-code {
        font-size: .78rem;
        color: #565959;
        font-family: inherit;
        font-weight: 800;
        margin-bottom: 4px;
      }
      .wlpp-desc,
      .wlpp-product-title {
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
        min-height: 3.9em;
        color: #111827;
        text-decoration: none;
        font-size: .95rem;
        font-weight: 700;
        line-height: 1.3;
      }
      .wlpp-product-title:hover {
        color: var(--wlpp-brand);
        text-decoration: underline;
      }
      .wlpp-card-body {
        padding: 5px 12px 10px;
        gap: 7px;
      }
      .wlpp-buy-meta {
        color: #565959;
        font-size: .84rem;
        line-height: 1.35;
      }
      .wlpp-buy-price {
        color: #111;
        font-weight: 950;
        font-size: 1.05rem;
      }
      .wlpp-reorder-note {
        color: #92400e;
        background: #fef3c7;
        border-radius: 8px;
        padding: 7px 8px;
        font-size: .82rem;
        font-weight: 800;
        line-height: 1.28;
      }
      .wlpp-tags {
        margin-top: 7px;
      }
      .wlpp-tag {
        font-size: 11px;
        padding: 4px 8px;
      }
      .wlpp-card-actions {
        padding: 0 12px 12px;
        gap: 7px;
      }
      .wlpp-card-actions .wlpp-btn {
        min-height: 34px;
        padding: 7px 10px;
        border-radius: 8px;
        font-size: .86rem;
        flex: 1 1 auto;
      }
      .wlpp-history-shell {
        margin-top: 18px;
      }
      .wlpp-history-shell > summary {
        cursor: pointer;
        color: var(--wlpp-brand);
        font-weight: 950;
        margin-bottom: 9px;
      }
      @media (max-width: 900px) {
        .wlpp-buyagain-layout { grid-template-columns: 1fr; }
        .wlpp-sidebar { position: relative; top: auto; }
      }
    `;

    document.head.appendChild(style);
  }

  function getStoredCashAccountFlag() {
    try {
      var raw = localStorage.getItem('wl_account_is_cash_v1');
      if (raw === 'true') return true;
      if (raw === 'false') return false;
    } catch (err) {}
    return null;
  }

  function normalizeMenuLabel(label) {
    label = String(label || '').trim();
    if (/^Account Information$/i.test(label)) return 'Account Dashboard';
    if (/^Quicklists$/i.test(label)) return 'Shopping Lists';
    return label;
  }

  function buildAccountMenu(root) {
    var menu = $('.wlpp-menu', root);
    var btn = $('.wlpp-menu-btn', root);
    if (!menu || !btn || btn.__wlMenuBound) return;

    var currentPath = (window.location.pathname || '').split('/').pop().toLowerCase();
    var isCashAccount = getStoredCashAccountFlag();
    var paymentLabel = isCashAccount === true ? 'Reload Balance' : (isCashAccount === false ? 'Make a Payment' : 'Make a Payment / Reload Balance');

    var accountSettingLinks = [
      ['Quicklists_R.aspx', 'Shopping Lists']
    ];
    if (isCashAccount !== true) accountSettingLinks.push(['Statements_R.aspx', 'Statements']);
    accountSettingLinks = accountSettingLinks.concat([
      ['CustomerTokens.aspx', 'Payment Methods'],
      ['AccountSettings.aspx', 'Change Password / Account Settings'],
      ['AddressList_R.aspx', 'Addresses'],
      ['Contacts_r.aspx', 'Contacts']
    ]);

    var groups = [
      { label: '', links: [['AccountInfo_R.aspx', 'Account Dashboard']] },
      {
        label: 'Transactions',
        links: [
          ['AccountPayment_r.aspx', paymentLabel],
          ['OpenQuotes_r.aspx', 'Quotes'],
          ['OpenOrders_r.aspx', 'Orders'],
          ['Invoices_r.aspx', 'Invoices'],
          ['CreditNotes_r.aspx', 'Credit Notes'],
          ['ProductsPurchased_R.aspx', 'Products Purchased']
        ]
      },
      { label: 'Account Settings', links: accountSettingLinks }
    ];

    menu.innerHTML = groups.map(function (group) {
      return `
        <div class="wlpp-menu-section">
          ${group.label ? `<div class="wlpp-menu-label">${html(group.label)}</div>` : ''}
          ${group.links.map(function (pair) {
            var href = pair[0];
            var label = pair[1];
            var path = String(href || '').split('?')[0].split('#')[0].split('/').pop().toLowerCase();
            var current = path === currentPath ? ' aria-current="page"' : '';
            return `<a role="menuitem" href="${attr(href)}"${current}>${html(normalizeMenuLabel(label))}</a>`;
          }).join('')}
        </div>
      `;
    }).join('');

    function toggle(open) {
      menu.classList.toggle('open', !!open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    btn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      toggle(!menu.classList.contains('open'));
    });

    document.addEventListener('click', function (event) {
      if (!menu.classList.contains('open')) return;
      if (!menu.contains(event.target) && event.target !== btn) toggle(false);
    });

    btn.__wlMenuBound = true;
  }

  function shouldAutoExpandHistory() {
    if (!CONFIG.AUTO_EXPAND_TO_12_MONTHS) return false;
    if (new URLSearchParams(window.location.search).has('wlpp_no_expand')) return false;

    try {
      if (sessionStorage.getItem(CONFIG.AUTO_EXPAND_SESSION_KEY) === 'done') return false;
    } catch (err) {}

    var dateList = $('#ctl00_PageBody_DateList');
    if (!dateList) return false;
    return dateList.value && dateList.value !== '6';
  }

  function autoExpandHistoryOnce() {
    if (!shouldAutoExpandHistory()) return false;

    var dateList = $('#ctl00_PageBody_DateList');
    var apply = $('#ctl00_PageBody_ApplySearchParametersImageButton');
    if (!dateList || !apply) return false;

    try { sessionStorage.setItem(CONFIG.AUTO_EXPAND_SESSION_KEY, 'done'); } catch (err) {}

    dateList.value = '6'; // Last 12 Months
    setTimeout(function () {
      try { apply.click(); }
      catch (err) { window.location.href = '/ProductsPurchased_R.aspx?wlpp_no_expand=1'; }
    }, 40);
    return true;
  }

  function hideLegacy() {
    var legacyNav = $('#ctl00_LeftSidebarContents_MainNav_NavigationMenu');
    if (legacyNav) legacyNav.classList.add('wlpp-hide');

    $$('.bodyFlexItem.listPageHeader, .listPageHeader').forEach(function (el) {
      if (/Products Purchased/i.test(txt(el))) el.classList.add('wlpp-hide');
    });

    var searchPanel = $('#ctl00_PageBody_Panel1');
    if (searchPanel) searchPanel.classList.add('wlpp-hide');

    var grid = $('#ctl00_PageBody_ProductsPurchasedGrid');
    if (grid) grid.classList.add('wlpp-hide');

    $$('.paging-control').forEach(function (el) { el.classList.add('wlpp-hide'); });
    var anchor = $('#detailsAnchor');
    if (anchor && anchor.parentElement) anchor.parentElement.classList.add('wlpp-hide');
  }

  function isServiceLine(row) {
    var code = normalize(row.code);
    var desc = normalize(row.description);
    var combined = normalize((row.code || '') + ' ' + (row.description || ''));

    if (CONFIG.SERVICE_CODES.indexOf(code) >= 0 || CONFIG.SERVICE_CODES.indexOf(desc) >= 0) return true;

    if (/^(WEB\s+DELIVER|WEB\s+DELIVERY|STANDARD\s+DELIVERY|FUEL\s+SURCHARGE|UPS\s+SHIPPING|UPS|SHIPPING|DELIVERY|FREIGHT)$/i.test(code)) return true;
    if (/^(WEB\s+DELIVER|WEB\s+DELIVERY|STANDARD\s+DELIVERY|FUEL\s+SURCHARGE|UPS\s+SHIPPING|UPS|SHIPPING|DELIVERY|FREIGHT)$/i.test(desc)) return true;

    if (/UPS\s+SHIPPING|STANDARD\s+DELIVERY|FUEL\s+SURCHARGE|WEB\s+DELIVER|WEB\s+DELIVERY/i.test(combined)) return true;

    // Most service pseudo-lines have no meaningful product unit and zero price.
    if ((/SHIPPING|DELIVERY|SURCHARGE|FREIGHT/i.test(combined)) && parseMoney(row.totalPrice) === 0) return true;

    return false;
  }

  function getProductRows() {
    var table =
      $('#ctl00_PageBody_ProductsPurchasedGrid_ctl00') ||
      $('#ctl00_PageBody_ProductsPurchasedGrid .rgMasterTable');

    if (!table) return [];

    return $$('tbody > tr.rgRow, tbody > tr.rgAltRow', table).map(function (tr, index) {
      var productAnchor =
        $('td[data-title="Product Code"].narrow-only a[href]', tr) ||
        $('td[data-title="Product Code"] a[href]', tr);

      var row = {
        rowIndex: index,
        code: txt($('td[data-title="Product Code"]', tr)),
        description: txt($('td[data-title="Description"]', tr)),
        orderNo: txt($('td[data-title="Order No."]', tr)),
        jobRef: txt($('td[data-title="Job Reference"]', tr)),
        orderDateRaw: txt($('td[data-title="OrderDate"]', tr)),
        orderStatus: txt($('td[data-title="Order Status"]', tr)),
        customerRef: txt($('td[data-title="Customer Ref"]', tr)),
        qty: txt($('td[data-title="Qty"]', tr)),
        per: txt($('td[data-title="Per"]', tr)),
        sellPrice: txt($('td[data-title="Sell Price"]', tr)),
        totalPrice: txt($('td[data-title="Total Price"]', tr)),
        purchaseHref: productAnchor ? abs(productAnchor.getAttribute('href') || '') : ''
      };

      row.orderDate = parseDate(row.orderDateRaw);
      row.orderDateDisplay = cleanDate(row.orderDateRaw);
      row.qtyNumber = parseQty(row.qty);
      row.sellNumber = parseMoney(row.sellPrice);
      row.totalNumber = parseMoney(row.totalPrice);
      row.serviceLine = isServiceLine(row);
      row.key = normalize(row.code) || normalize(row.description) || ('ROW_' + index);
      return row;
    });
  }

  function aggregateProducts(rows) {
    var map = new Map();

    rows.filter(function (row) { return !row.serviceLine; }).forEach(function (row) {
      var key = row.key;
      if (!map.has(key)) {
        map.set(key, {
          key: key,
          code: row.code,
          description: row.description,
          purchases: [],
          totalQty: 0,
          totalSpend: 0,
          lastPurchase: null,
          firstPurchase: null,
          productUrl: '',
          productUrlSource: 'search'
        });
      }

      var item = map.get(key);
      item.purchases.push(row);
      item.totalQty += row.qtyNumber || 0;
      item.totalSpend += row.totalNumber || 0;

      if (row.orderDate && (!item.lastPurchase || row.orderDate > item.lastPurchase.orderDate)) item.lastPurchase = row;
      if (row.orderDate && (!item.firstPurchase || row.orderDate < item.firstPurchase.orderDate)) item.firstPurchase = row;
    });

    var products = Array.from(map.values()).map(function (item) {
      item.purchases.sort(function (a, b) {
        return (b.orderDate ? b.orderDate.getTime() : 0) - (a.orderDate ? a.orderDate.getTime() : 0);
      });

      var sortedAsc = item.purchases.filter(function (p) { return !!p.orderDate; }).slice().sort(function (a, b) {
        return a.orderDate - b.orderDate;
      });

      var intervals = [];
      for (var i = 1; i < sortedAsc.length; i++) {
        var days = daysBetween(sortedAsc[i - 1].orderDate, sortedAsc[i].orderDate);
        if (days != null && days > 0) intervals.push(days);
      }

      item.purchaseCount = item.purchases.length;
      item.avgIntervalDays = intervals.length ? Math.round(intervals.reduce(function (a, b) { return a + b; }, 0) / intervals.length) : null;
      item.daysSinceLast = item.lastPurchase && item.lastPurchase.orderDate ? daysBetween(item.lastPurchase.orderDate, todayMidnight()) : null;

      var repeatDue = item.avgIntervalDays && item.daysSinceLast != null && item.daysSinceLast >= Math.max(14, Math.round(item.avgIntervalDays * 0.75));
      var singleMaybeDue = item.purchaseCount === 1 && item.daysSinceLast != null && item.daysSinceLast >= 75;
      item.suggested = !!(repeatDue || singleMaybeDue);
      item.suggestReason = repeatDue
        ? 'Based on prior timing, this may be ready to reorder.'
        : (singleMaybeDue ? 'This was purchased a while back and may be worth checking.' : '');

      return item;
    });

    products.sort(function (a, b) {
      if (a.suggested !== b.suggested) return a.suggested ? -1 : 1;
      var ad = a.lastPurchase && a.lastPurchase.orderDate ? a.lastPurchase.orderDate.getTime() : 0;
      var bd = b.lastPurchase && b.lastPurchase.orderDate ? b.lastPurchase.orderDate.getTime() : 0;
      return bd - ad;
    });

    return products;
  }

  function parseCSV(text) {
    var rows = [];
    var row = [];
    var value = '';
    var quote = false;

    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      var next = text[i + 1];

      if (ch === '"' && quote && next === '"') {
        value += '"';
        i++;
      } else if (ch === '"') {
        quote = !quote;
      } else if (ch === ',' && !quote) {
        row.push(value);
        value = '';
      } else if ((ch === '\n' || ch === '\r') && !quote) {
        if (ch === '\r' && next === '\n') i++;
        row.push(value);
        if (row.some(function (cell) { return String(cell).trim() !== ''; })) rows.push(row);
        row = [];
        value = '';
      } else {
        value += ch;
      }
    }

    row.push(value);
    if (row.some(function (cell) { return String(cell).trim() !== ''; })) rows.push(row);
    return rows;
  }

  function pickHeader(headers, names) {
    var lower = headers.map(function (h) { return normalize(h).replace(/[^A-Z0-9]/g, ''); });
    for (var i = 0; i < names.length; i++) {
      var target = normalize(names[i]).replace(/[^A-Z0-9]/g, '');
      var idx = lower.indexOf(target);
      if (idx >= 0) return idx;
    }
    return -1;
  }

  async function loadProductFeedMap() {
    if (!CONFIG.PRODUCT_FEED_URL) return new Map();

    try {
      var response = await fetch(CONFIG.PRODUCT_FEED_URL, { cache: 'no-cache' });
      if (!response.ok) throw new Error('Feed request failed ' + response.status);

      var contentType = response.headers.get('content-type') || '';
      var map = new Map();

      if (/json/i.test(contentType) || /\.json($|\?)/i.test(CONFIG.PRODUCT_FEED_URL)) {
        var json = await response.json();
        var arr = Array.isArray(json) ? json : (Array.isArray(json.items) ? json.items : []);
        arr.forEach(function (item) {
          var possibleCodes = [
            item.ProductCode,
            item.productcode,
            item.product_code,
            item.sku,
            item.id,
            item.mpn,
            item.MPN
          ].filter(Boolean);

          var productId = item.ProductID || item.productid || item.product_id || item.id || '';
          var url = item.ProductURL || item.producturl || item.product_url || item.link || item.url || item.mobile_link || item['mobile link'] || '';

          if (!url && productId && CONFIG.PRODUCT_DETAIL_URL_TEMPLATE) {
            url = CONFIG.PRODUCT_DETAIL_URL_TEMPLATE.replace(/\{ProductID\}/g, encodeURIComponent(productId));
          }

          var image = item.image || item.image_link || item['image link'] || '';
          var additional = item.additional_image_link || item['additional image link'] || '';

          if (url) {
            var payload = {
              url: abs(url),
              image: image ? abs(image) : '',
              additionalImage: additional ? abs(additional) : '',
              title: item.title || '',
              productType: item.product_type || item['product_type'] || item.productType || item['product type'] || '',
              brand: item.brand || ''
            };
            possibleCodes.forEach(function (code) {
              if (code) map.set(normalize(code), payload);
            });
          }
        });
        return map;
      }

      var csvText = await response.text();
      var csvRows = parseCSV(csvText);
      if (!csvRows.length) return map;

      var headers = csvRows.shift();
      var codeIdx = pickHeader(headers, ['ProductCode', 'productcode', 'Product Code', 'sku', 'item id']);
      var idIdx = pickHeader(headers, ['id']);
      var mpnIdx = pickHeader(headers, ['mpn', 'MPN']);
      var productIdIdx = pickHeader(headers, ['ProductID', 'productid', 'Product ID', 'product_id']);
      var urlIdx = pickHeader(headers, ['ProductURL', 'producturl', 'Product URL', 'Product Page URL', 'link', 'url', 'mobile link', 'mobile_link']);
      var imageIdx = pickHeader(headers, ['image link', 'image_link', 'image']);
      var additionalImageIdx = pickHeader(headers, ['additional image link', 'additional_image_link']);
      var titleIdx = pickHeader(headers, ['title', 'name']);
      var productTypeIdx = pickHeader(headers, ['product_type', 'product type', 'category']);
      var brandIdx = pickHeader(headers, ['brand']);

      csvRows.forEach(function (cells) {
        var possibleCodes = [
          codeIdx >= 0 ? cells[codeIdx] : '',
          idIdx >= 0 ? cells[idIdx] : '',
          mpnIdx >= 0 ? cells[mpnIdx] : ''
        ].filter(Boolean);

        var productId = productIdIdx >= 0 ? cells[productIdIdx] : (idIdx >= 0 ? cells[idIdx] : '');
        var url = urlIdx >= 0 ? cells[urlIdx] : '';

        if (!url && productId && CONFIG.PRODUCT_DETAIL_URL_TEMPLATE) {
          url = CONFIG.PRODUCT_DETAIL_URL_TEMPLATE.replace(/\{ProductID\}/g, encodeURIComponent(productId));
        }

        if (url) {
          var payload = {
            url: abs(url),
            image: imageIdx >= 0 && cells[imageIdx] ? abs(cells[imageIdx]) : '',
            additionalImage: additionalImageIdx >= 0 && cells[additionalImageIdx] ? abs(cells[additionalImageIdx]) : '',
            title: titleIdx >= 0 ? (cells[titleIdx] || '') : '',
            productType: productTypeIdx >= 0 ? (cells[productTypeIdx] || '') : '',
            brand: brandIdx >= 0 ? (cells[brandIdx] || '') : ''
          };
          possibleCodes.forEach(function (code) {
            if (code) map.set(normalize(code), payload);
          });
        }
      });

      return map;
    } catch (err) {
      console.warn('Product feed lookup failed', err);
      return new Map();
    }
  }


  function productMediaHtml(item, compact) {
    var image = item.productImage || item.productAdditionalImage || '';
    if (image) {
      return `
        <div class="${compact ? 'wlpp-modal-media' : 'wlpp-media'}">
          <img src="${attr(image)}" alt="${attr(item.description || item.code || 'Product image')}" loading="lazy">
          ${!compact && item.productUrlSource === 'feed' ? '<span class="wlpp-media-badge">Feed image</span>' : ''}
        </div>
      `;
    }

    return `
      <div class="${compact ? 'wlpp-modal-media' : 'wlpp-media'}">
        <div class="wlpp-media-fallback">
          <div>${html(item.code || 'Product')}</div>
          <div style="font-size:.85rem;margin-top:6px;color:#64748b;font-weight:700;">Product image unavailable</div>
        </div>
      </div>
    `;
  }

  function productFallbackUrl(item) {
    return CONFIG.PRODUCT_SEARCH_URL(item.code, item.description);
  }

  function friendlyCategory(value) {
    var text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return 'Other';
    var parts = text.split(/\s*>\s*|\s*\/\s*/).filter(Boolean);
    if (!parts.length) return text;
    if (parts.length === 1) return parts[0];
    return parts.slice(Math.max(0, parts.length - 2)).join(' › ');
  }

  function applyProductUrls(products, feedMap) {
    var matched = 0;
    var imageMatched = 0;

    products.forEach(function (item) {
      var payload = feedMap.get(normalize(item.code));
      if (payload && payload.url) {
        item.productUrl = payload.url;
        item.productUrlSource = 'feed';
        item.productImage = payload.image || '';
        item.productAdditionalImage = payload.additionalImage || '';
        item.feedTitle = payload.title || '';
        item.productType = payload.productType || '';
        item.productTypeLabel = friendlyCategory(payload.productType || '');
        item.brand = payload.brand || '';
        matched++;
        if (item.productImage || item.productAdditionalImage) imageMatched++;
      } else {
        item.productUrl = productFallbackUrl(item);
        item.productUrlSource = 'search';
        item.productImage = '';
        item.productAdditionalImage = '';
        item.feedTitle = '';
        item.productType = '';
        item.productTypeLabel = 'Other';
        item.brand = '';
      }
    });

    window.WLPreviousPurchasesFeedMatches = {
      matched: matched,
      imageMatched: imageMatched,
      total: products.length,
      feedEnabled: !!CONFIG.PRODUCT_FEED_URL
    };
  }

  function setServerDateRange(value) {
    var dateList = $('#ctl00_PageBody_DateList');
    var apply = $('#ctl00_PageBody_ApplySearchParametersImageButton');
    if (!dateList || !apply) return;
    dateList.value = String(value);
    apply.click();
  }

  function runServerSearch() {
    var legacySearchType = $('#ctl00_PageBody_ddSearch');
    var legacyText = $('#ctl00_PageBody_ProductTextBox');
    var modernType = $('#wlpp-server-type');
    var modernText = $('#wlpp-server-search');
    var modernRange = $('#wlpp-date-range');
    var legacyRange = $('#ctl00_PageBody_DateList');
    var apply = $('#ctl00_PageBody_ApplySearchParametersImageButton');

    if (legacySearchType && modernType) legacySearchType.value = modernType.value;
    if (legacyText && modernText) legacyText.value = modernText.value;
    if (legacyRange && modernRange) legacyRange.value = modernRange.value;

    if (apply) apply.click();
  }

  function buildShell() {
    var existing = $('#wlpp-root');
    if (existing) existing.remove();

    var host = $('#ctl00_PageBody_ProductsPurchasedGrid')?.closest('.bodyFlexContainer') ||
      $('.bodyFlexContainer') ||
      $('#MainLayoutRow .col') ||
      document.body;

    var legacySearchType = $('#ctl00_PageBody_ddSearch');
    var legacyText = $('#ctl00_PageBody_ProductTextBox');
    var legacyRange = $('#ctl00_PageBody_DateList');

    var root = document.createElement('div');
    root.className = 'wlpp';
    root.id = 'wlpp-root';
    root.innerHTML = `
      <div class="wlpp-top">
        <div class="wlpp-menu-wrap">
          <button type="button" class="wlpp-menu-btn" aria-expanded="false" aria-controls="wlpp-menu">☰ Menu</button>
          <div>
            <div class="wlpp-title">Buy Again</div>
            <div class="wlpp-subtitle">Quickly find products you have purchased before and get back to the right item.</div>
          </div>
          <div class="wlpp-menu" id="wlpp-menu" role="menu"></div>
        </div>
        <div class="wlpp-top-actions">
          <a href="OpenOrders_r.aspx">Open Orders</a>
          <a href="Invoices_r.aspx">Invoices</a>
        </div>
      </div>

      <div class="wlpp-toolbar">
        <div>
          <label for="wlpp-filter">Search previous purchases</label>
          <input id="wlpp-filter" class="wlpp-input" type="search" placeholder="Search product code, description, order #, job, ref, or amount...">
        </div>
        <div class="wlpp-controls">
          <button type="button" class="wlpp-btn wlpp-btn-primary" id="wlpp-server-apply">Update History</button>
          <button type="button" class="wlpp-btn" id="wlpp-12mo">Use 12 Months</button>
        </div>
        <div class="wlpp-note" id="wlpp-note">Showing previous purchase products. Delivery and shipping lines are hidden.</div>
      </div>

      <div class="wlpp-buyagain-layout">
        <aside class="wlpp-sidebar">
          <div class="wlpp-sidebar-section">
            <h3>Sort by</h3>
            <select id="wlpp-sort" class="wlpp-select">
              <option value="recommended">Recommended</option>
              <option value="date">Purchase date</option>
              <option value="count">Purchase count</option>
              <option value="name">Product name</option>
            </select>
          </div>

          <div class="wlpp-sidebar-section">
            <h3>Filters</h3>
            <button type="button" class="wlpp-clear-link" id="wlpp-clear-filters">Clear filters</button>
          </div>

          <div class="wlpp-sidebar-section">
            <h3>Purchase type</h3>
            <div class="wlpp-filter-list">
              <button type="button" class="wlpp-side-filter" data-filter="all" data-active="true">All products</button>
              <button type="button" class="wlpp-side-filter" data-filter="suggested">Suggested reorders</button>
              <button type="button" class="wlpp-side-filter" data-filter="repeat">Bought more than once</button>
              <button type="button" class="wlpp-side-filter" data-filter="recent">Recently purchased</button>
            </div>
          </div>

          <div class="wlpp-sidebar-section">
            <h3>Category</h3>
            <select id="wlpp-category" class="wlpp-select">
              <option value="all">All categories</option>
            </select>
          </div>

          <div class="wlpp-sidebar-section">
            <h3>Search more history</h3>
            <div style="display:grid;gap:8px;">
              <select id="wlpp-server-type" class="wlpp-select">
                <option value="Product"${legacySearchType && legacySearchType.value === 'Product' ? ' selected' : ''}>Product</option>
                <option value="Job Reference"${legacySearchType && legacySearchType.value === 'Job Reference' ? ' selected' : ''}>Job Reference</option>
              </select>
              <input id="wlpp-server-search" class="wlpp-input" type="search" value="${attr(legacyText ? legacyText.value : '')}" placeholder="Search product or job...">
              <select id="wlpp-date-range" class="wlpp-select">
                <option value="1"${legacyRange && legacyRange.value === '1' ? ' selected' : ''}>Last 30 days</option>
                <option value="2"${legacyRange && legacyRange.value === '2' ? ' selected' : ''}>Current Month</option>
                <option value="3"${legacyRange && legacyRange.value === '3' ? ' selected' : ''}>Last 2 Months</option>
                <option value="4"${legacyRange && legacyRange.value === '4' ? ' selected' : ''}>Last 3 Months</option>
                <option value="5"${legacyRange && legacyRange.value === '5' ? ' selected' : ''}>Last 6 Months</option>
                <option value="6"${legacyRange && legacyRange.value === '6' ? ' selected' : ''}>Last 12 Months</option>
              </select>
            </div>
          </div>
        </aside>

        <main class="wlpp-results">
          <div class="wlpp-results-top">
            <div>
              <h2>Recommended for reorder</h2>
              <p id="wlpp-results-subtitle">Products are sorted from most likely to be useful first.</p>
            </div>
          </div>
          <div class="wlpp-summary" id="wlpp-summary"></div>
          <div id="wlpp-suggested-wrap"></div>
          <div id="wlpp-products-wrap"></div>
          <div id="wlpp-history-wrap"></div>
        </main>
      </div>
    `;

    host.insertBefore(root, host.firstChild);
    buildAccountMenu(root);

    $('#wlpp-server-apply', root).addEventListener('click', runServerSearch);
    $('#wlpp-server-search', root).addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        runServerSearch();
      }
    });
    $('#wlpp-12mo', root).addEventListener('click', function () { setServerDateRange('6'); });

    return root;
  }

  function productHaystack(item) {
    var parts = [
      item.code,
      item.description,
      item.feedTitle,
      item.productTypeLabel,
      item.brand,
      item.purchaseCount,
      item.totalQty,
      item.totalSpend,
      item.lastPurchase && item.lastPurchase.orderNo,
      item.lastPurchase && item.lastPurchase.orderStatus,
      item.lastPurchase && item.lastPurchase.customerRef,
      item.lastPurchase && item.lastPurchase.jobRef,
      item.purchases.map(function (p) {
        return [p.orderNo, p.orderDateDisplay, p.orderStatus, p.customerRef, p.jobRef, p.totalPrice, p.sellPrice].join(' ');
      }).join(' ')
    ];
    return parts.join(' ').replace(/\s+/g, ' ').toLowerCase();
  }

  function activeFilter(root) {
    var active = $('.wlpp-side-filter[data-active="true"]', root);
    return active ? active.dataset.filter : 'all';
  }

  function activeCategory(root) {
    var select = $('#wlpp-category', root);
    return select ? (select.value || 'all') : 'all';
  }

  function applyFilters(root, products) {
    var needle = ($('#wlpp-filter', root)?.value || '').trim().toLowerCase();
    var filter = activeFilter(root);
    var category = activeCategory(root);
    var now = todayMidnight();
    var shown = 0;

    $$('.wlpp-product', root).forEach(function (card) {
      var item = products.find(function (p) { return p.key === card.dataset.key; });
      if (!item) return;

      var textMatch = !needle || productHaystack(item).indexOf(needle) >= 0;
      var filterMatch = true;
      var categoryMatch = category === 'all' || item.productTypeLabel === category;

      if (filter === 'suggested') filterMatch = !!item.suggested;
      else if (filter === 'repeat') filterMatch = item.purchaseCount > 1;
      else if (filter === 'recent') {
        filterMatch = !!(item.lastPurchase && item.lastPurchase.orderDate && daysBetween(item.lastPurchase.orderDate, now) <= 45);
      }

      var show = textMatch && filterMatch && categoryMatch;
      card.classList.toggle('hidden', !show);
      if (show) shown++;
    });

    $$('.wlpp-history-row', root).forEach(function (row) {
      var key = row.dataset.key;
      var item = products.find(function (p) { return p.key === key; });
      if (!item) return;

      var textMatch = !needle || productHaystack(item).indexOf(needle) >= 0 || row.textContent.toLowerCase().indexOf(needle) >= 0;
      var filterMatch = true;
      var categoryMatch = category === 'all' || item.productTypeLabel === category;

      if (filter === 'suggested') filterMatch = !!item.suggested;
      else if (filter === 'repeat') filterMatch = item.purchaseCount > 1;
      else if (filter === 'recent') {
        filterMatch = !!(item.lastPurchase && item.lastPurchase.orderDate && daysBetween(item.lastPurchase.orderDate, now) <= 45);
      }

      row.classList.toggle('hidden', !(textMatch && filterMatch && categoryMatch));
    });

    var note = $('#wlpp-note', root);
    if (note) {
      note.textContent = 'Showing ' + shown + ' of ' + products.length + ' previous purchase products. Delivery and shipping lines are hidden.';
    }

    var subtitle = $('#wlpp-results-subtitle', root);
    if (subtitle) {
      var label = filter === 'all' ? 'Recommended products' :
        filter === 'suggested' ? 'Suggested reorders' :
        filter === 'repeat' ? 'Items bought more than once' :
        'Recently purchased items';
      subtitle.textContent = label + (category !== 'all' ? ' in ' + category : '') + '.';
    }
  }

  function renderSummary(root, products, rawRows) {
    var el = $('#wlpp-summary', root);
    if (el) el.innerHTML = '';
  }

  function productCard(item, options) {
    var last = item.lastPurchase || item.purchases[0] || {};
    var actionLabel = item.productUrlSource === 'feed' ? 'View / Reorder' : 'Find Product';
    var countText = item.purchaseCount === 1 ? 'Purchased 1 time' : 'Purchased ' + item.purchaseCount + ' times';
    var lastText = last.orderDateDisplay ? 'Last purchased ' + last.orderDateDisplay : 'Last purchase date unavailable';
    var lastQty = last.qty ? 'Last qty: ' + last.qty + (last.per ? ' ' + last.per : '') : '';
    var lastPrice = last.sellPrice ? 'Last price: ' + last.sellPrice : '';
    var title = item.description || item.feedTitle || item.code || 'Product';

    return `
      <div class="wlpp-product" data-key="${attr(item.key)}">
        ${productMediaHtml(item, false)}
        <div class="wlpp-card-head">
          <div class="wlpp-code">Product Code: ${html(item.code || '—')}</div>
          <a class="wlpp-product-title" href="${attr(item.productUrl)}">${html(title)}</a>
          <div class="wlpp-tags">
            ${item.suggested ? '<span class="wlpp-tag wlpp-tag-reorder">May be time to reorder</span>' : ''}
            ${item.purchaseCount > 1 ? '<span class="wlpp-tag">Repeat purchase</span>' : ''}
            ${item.productTypeLabel && item.productTypeLabel !== 'Other' ? '<span class="wlpp-tag">' + html(item.productTypeLabel) + '</span>' : ''}
          </div>
        </div>
        <div class="wlpp-card-body">
          ${lastPrice ? '<div class="wlpp-buy-price">' + html(lastPrice) + '</div>' : ''}
          <div class="wlpp-buy-meta">${html(countText)}</div>
          <div class="wlpp-buy-meta">${html(lastText)}</div>
          ${lastQty ? '<div class="wlpp-buy-meta">' + html(lastQty) + '</div>' : ''}
          ${item.suggestReason ? '<div class="wlpp-reorder-note">' + html(item.suggestReason) + '</div>' : ''}
        </div>
        <div class="wlpp-card-actions">
          <a class="wlpp-btn wlpp-btn-primary" href="${attr(item.productUrl)}">${html(actionLabel)}</a>
          <button type="button" class="wlpp-btn" data-product-history="${attr(item.key)}">History</button>
        </div>
      </div>
    `;
  }

  function renderSuggested(root, products) {
    var wrap = $('#wlpp-suggested-wrap', root);
    if (wrap) wrap.innerHTML = '';
  }

  function renderProducts(root, products) {
    var wrap = $('#wlpp-products-wrap', root);
    if (!wrap) return;

    var sorted = getSortedProducts(products, root);
    if (!sorted.length) {
      wrap.innerHTML = '<div class="wlpp-empty">No reorderable product lines were found in the current purchase history.</div>';
      return;
    }

    wrap.innerHTML = `
      <div class="wlpp-grid">
        ${sorted.map(function (item) { return productCard(item, { suggestedCard: false }); }).join('')}
      </div>
    `;
  }

  function renderHistory(root, products) {
    var rows = [];
    products.forEach(function (item) {
      item.purchases.forEach(function (p) {
        rows.push({ item: item, purchase: p });
      });
    });

    rows.sort(function (a, b) {
      return (b.purchase.orderDate ? b.purchase.orderDate.getTime() : 0) - (a.purchase.orderDate ? a.purchase.orderDate.getTime() : 0);
    });

    $('#wlpp-history-wrap', root).innerHTML = `
      <details class="wlpp-history-shell">
        <summary>View purchase history table</summary>
        <div class="wlpp-history">
          <div class="wlpp-history-head">Purchase History Detail</div>
          <table class="wlpp-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Description</th>
                <th>Order</th>
                <th>Date</th>
                <th>Status</th>
                <th>Qty</th>
                <th>Sell</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(function (row) {
                var item = row.item;
                var p = row.purchase;
                return `
                  <tr class="wlpp-history-row" data-key="${attr(item.key)}">
                    <td><a href="${attr(item.productUrl)}">${html(item.code)}</a></td>
                    <td>${html(item.description || item.feedTitle || '')}</td>
                    <td>${p.purchaseHref ? '<a href="' + attr(p.purchaseHref) + '">' + html(p.orderNo || 'Open') + '</a>' : html(p.orderNo || '—')}</td>
                    <td>${html(p.orderDateDisplay || '—')}</td>
                    <td>${html(p.orderStatus || '—')}</td>
                    <td>${html(p.qty || '—')} ${html(p.per || '')}</td>
                    <td>${html(p.sellPrice || '—')}</td>
                    <td>${html(p.totalPrice || '—')}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </details>
    `;
  }

  function openProductHistoryModal(item) {
    var existing = $('#wlpp-history-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.className = 'wlpp-modal open';
    modal.id = 'wlpp-history-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="wlpp-modal-card">
        <div class="wlpp-modal-head">
          <div>
            <div class="wlpp-modal-title">${html(item.code)} — Purchase History</div>
            <div class="wlpp-modal-subtitle">${html(item.description)} • ${item.purchaseCount} purchase${item.purchaseCount === 1 ? '' : 's'} loaded</div>
          </div>
          <button type="button" class="wlpp-modal-close">Close</button>
        </div>
        <div class="wlpp-modal-body">
          <div class="wlpp-modal-product">
            ${productMediaHtml(item, true)}
            <div>
              <div class="wlpp-summary" style="margin-bottom:12px;">
            <div class="wlpp-summary-card"><div class="wlpp-summary-label">Times Bought</div><div class="wlpp-summary-value">${item.purchaseCount}</div></div>
            <div class="wlpp-summary-card"><div class="wlpp-summary-label">Total Qty</div><div class="wlpp-summary-value">${Number(item.totalQty.toFixed(2)).toLocaleString()}</div></div>
            <div class="wlpp-summary-card"><div class="wlpp-summary-label">Loaded Spend</div><div class="wlpp-summary-value">${money(item.totalSpend)}</div></div>
            <div class="wlpp-summary-card"><div class="wlpp-summary-label">Reorder Timing</div><div class="wlpp-summary-value" style="font-size:1rem;">${html(item.avgIntervalDays ? item.avgIntervalDays + ' days avg.' : 'Not enough history')}</div></div>
              </div>
              <div class="wlpp-last" style="margin-top:4px;">
                ${item.suggestReason ? '<strong>' + html(item.suggestReason) + '</strong><br>' : ''}
                ${item.feedTitle && normalize(item.feedTitle) !== normalize(item.description) ? 'Feed title: ' + html(item.feedTitle) + '<br>' : ''}
                ${item.productImage || item.productAdditionalImage ? '' : 'Product image unavailable.'}
              </div>
            </div>
          </div>
          <div class="wlpp-card-actions" style="padding:0 0 12px;">
            <a class="wlpp-btn wlpp-btn-primary" href="${attr(item.productUrl)}">${item.productUrlSource === 'feed' ? 'View Product' : 'Find Product'}</a>
          </div>
          <div class="wlpp-history">
            <div class="wlpp-history-head">Loaded purchase records</div>
            <table class="wlpp-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Qty</th>
                  <th>Sell</th>
                  <th>Total</th>
                  <th>Ref</th>
                </tr>
              </thead>
              <tbody>
                ${item.purchases.map(function (p) {
                  return `
                    <tr>
                      <td>${p.purchaseHref ? '<a href="' + attr(p.purchaseHref) + '">' + html(p.orderNo || 'Open') + '</a>' : html(p.orderNo || '—')}</td>
                      <td>${html(p.orderDateDisplay || '—')}</td>
                      <td>${html(p.orderStatus || '—')}</td>
                      <td>${html(p.qty || '—')} ${html(p.per || '')}</td>
                      <td>${html(p.sellPrice || '—')}</td>
                      <td>${html(p.totalPrice || '—')}</td>
                      <td>${html(p.customerRef || p.jobRef || '—')}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    function close() {
      modal.classList.remove('open');
      setTimeout(function () { modal.remove(); }, 160);
    }

    $('.wlpp-modal-close', modal).addEventListener('click', close);
    modal.addEventListener('click', function (event) { if (event.target === modal) close(); });
    var keyHandler = function (event) {
      if (event.key === 'Escape' && modal.classList.contains('open')) {
        close();
        document.removeEventListener('keydown', keyHandler);
      }
    };
    document.addEventListener('keydown', keyHandler);
  }

  function bindEvents(root, products) {
    var filterInput = $('#wlpp-filter', root);
    if (filterInput && !filterInput.__wlppBound) {
      filterInput.addEventListener('input', function () { applyFilters(root, products); });
      filterInput.__wlppBound = true;
    }

    var sortSelect = $('#wlpp-sort', root);
    if (sortSelect && !sortSelect.__wlppBound) {
      sortSelect.addEventListener('change', function () {
        renderProducts(root, products);
        applyFilters(root, products);
      });
      sortSelect.__wlppBound = true;
    }

    var categorySelect = $('#wlpp-category', root);
    if (categorySelect && !categorySelect.__wlppBound) {
      categorySelect.addEventListener('change', function () { applyFilters(root, products); });
      categorySelect.__wlppBound = true;
    }

    $$('.wlpp-side-filter', root).forEach(function (chip) {
      if (chip.__wlppBound) return;
      chip.addEventListener('click', function () {
        $$('.wlpp-side-filter', root).forEach(function (c) { c.dataset.active = 'false'; });
        chip.dataset.active = 'true';
        applyFilters(root, products);
      });
      chip.__wlppBound = true;
    });

    var clear = $('#wlpp-clear-filters', root);
    if (clear && !clear.__wlppBound) {
      clear.addEventListener('click', function () {
        if (filterInput) filterInput.value = '';
        if (categorySelect) categorySelect.value = 'all';
        $$('.wlpp-side-filter', root).forEach(function (c) { c.dataset.active = 'false'; });
        var all = $('.wlpp-side-filter[data-filter="all"]', root);
        if (all) all.dataset.active = 'true';
        if (sortSelect) sortSelect.value = 'recommended';
        renderProducts(root, products);
        applyFilters(root, products);
      });
      clear.__wlppBound = true;
    }

    if (!root.__wlppClickBound) {
      root.addEventListener('click', function (event) {
        var btn = event.target.closest('[data-product-history]');
        if (!btn) return;
        event.preventDefault();

        var key = btn.getAttribute('data-product-history');
        var item = products.find(function (p) { return p.key === key; });
        if (item) openProductHistoryModal(item);
      });
      root.__wlppClickBound = true;
    }
  }

  async function render() {
    injectCSS();

    if (autoExpandHistoryOnce()) return;

    hideLegacy();

    var rawRows = getProductRows();
    var products = aggregateProducts(rawRows);
    var feedMap = await loadProductFeedMap();
    applyProductUrls(products, feedMap);

    var root = buildShell();
    renderSidebarCategories(root, products);
    renderSummary(root, products, rawRows);
    renderSuggested(root, products);
    renderProducts(root, products);
    renderHistory(root, products);
    bindEvents(root, products);
    applyFilters(root, products);

    log('Rendered previous purchases', { rawRows: rawRows.length, products: products.length });
  }

  ready(function () {
    render().catch(function (err) {
      console.error('Previous purchases render failed', err);
    });
  });

  window.WLPreviousPurchases = {
    version: '1.3.1',
    rerender: render
  };
})();
