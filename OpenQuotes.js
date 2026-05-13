/* ==========================================================
   Woodson — Quotes Page Override
   Page: OpenQuotes_r.aspx
   Purpose:
   - Apply Woodson account menu pattern
   - Rebuild quote results as modern active/expired quote cards
   - Keep quote details on the same page via existing details anchor URLs
   - Show expired quote details/download, but do NOT expose "Add Quote to Cart"
   - Re-label quote money fields as Subtotal / Tax / Total
   - Default to all-time quote results and use a modal for selected quote details
   ========================================================== */
(function () {
  'use strict';

  if (!/OpenQuotes_r\.aspx/i.test(window.location.pathname)) return;
  if (window.__WL_OPEN_QUOTES_OVERRIDE__) return;
  window.__WL_OPEN_QUOTES_OVERRIDE__ = true;

  var BRAND = {
    primary: '#6b0016',
    primaryHover: '#540011',
    bgSoft: '#fbf5f6',
    border: '#e6e6e6',
    text: '#222',
    muted: '#666',
    danger: '#9f1d1d',
    dangerBg: '#fff5f5',
    warning: '#8a5a00',
    warningBg: '#fff9e9',
    success: '#2f6b3c',
    successBg: '#f3fbf5'
  };

  var CONFIG = {
    // If customer lands on OpenQuotes_r.aspx with no search params, push them to an all-time date range.
    AUTO_DEFAULT_ALL_TIME: true,
    ALL_TIME_START_ISO: '1980-01-01T00:00:00',
    ITEMS_PER_PAGE: 48,
    QUOTE_URL: 'https://woodsonwholesaleinc.formstack.com/forms/request_a_quote'
  };

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function txt(el) {
    return ((el && el.textContent) || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function dom(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, '&#39;');
  }

  function money(value) {
    var n = parseFloat(String(value || '').replace(/[^0-9.\-]/g, ''));
    if (!Number.isFinite(n)) return value || '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  }

  function parseDate(value) {
    var s = String(value || '').trim();
    var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    return new Date(+m[3], +m[1] - 1, +m[2]);
  }

  function todayStart() {
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function isExpiredDate(expiresText) {
    var d = parseDate(expiresText);
    if (!d) return false;
    return d < todayStart();
  }

  function getOidFromHref(href) {
    var raw = String(href || '');
    var match = raw.match(/[?&](?:oid|id)=(\d+)/i);
    return match ? match[1] : '';
  }

  function getSelectedOid() {
    return new URLSearchParams(window.location.search).get('oid') || '';
  }

  function normalizeQuoteDetailsHref(href) {
    var oid = getOidFromHref(href);
    var now = new Date();
    var yyyy = now.getFullYear();
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var dd = String(now.getDate()).padStart(2, '0');
    if (!oid) return href || 'OpenQuotes_r.aspx';
    return 'OpenQuotes_r.aspx?searchType=DateCreated&startDate=' +
      encodeURIComponent(CONFIG.ALL_TIME_START_ISO) +
      '&endDate=' +
      encodeURIComponent(yyyy + '-' + mm + '-' + dd + 'T23:59:59') +
      '&itemsPerPage=' + CONFIG.ITEMS_PER_PAGE +
      '&oid=' + encodeURIComponent(oid) +
      '';
  }

  function processDocumentHref(oid) {
    if (!oid) return '#';
    return 'https://webtrack.woodsonlumber.com/ProcessDocument.aspx?documentId=' +
      encodeURIComponent(oid) +
      '&documentType=5&processDocument=1&IsSummaryStatement=0';
  }

  function clickOriginal(el) {
    if (!el) return;
    try {
      el.click();
    } catch (err) {
      if (el.href) window.location.href = el.href;
    }
  }

  function makeActionFromOriginal(original, label, className) {
    if (!original) return null;
    var clone = original.cloneNode(true);
    clone.removeAttribute('id');
    clone.className = className || 'wloq-btn';
    clone.innerHTML = escapeHtml(label);
    clone.setAttribute('aria-label', label);
    return clone;
  }

  function normalizeMenuLabel(label) {
    label = String(label || '').trim();
    if (/^Account Information$/i.test(label)) return 'Account Dashboard';
    if (/^Quicklists$/i.test(label)) return 'Shopping Lists';
    if (/Customer\s*Cards|Stored\s*Cards/i.test(label)) return 'Payment Methods';
    return label;
  }

  function getStoredCashAccountFlag() {
    try {
      var raw = localStorage.getItem('wl_account_is_cash_v1');
      if (raw === 'true') return true;
      if (raw === 'false') return false;
    } catch (err) {}
    return null;
  }

  function maybeDefaultAllTimeSearch() {
    if (!CONFIG.AUTO_DEFAULT_ALL_TIME) return false;

    var params = new URLSearchParams(window.location.search);
    if (params.has('searchType') || params.has('startDate') || params.has('endDate') || params.has('oid')) return false;

    var now = new Date();
    var yyyy = now.getFullYear();
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var dd = String(now.getDate()).padStart(2, '0');

    window.location.replace(
      'OpenQuotes_r.aspx?searchType=DateCreated&startDate=' +
      encodeURIComponent(CONFIG.ALL_TIME_START_ISO) +
      '&endDate=' +
      encodeURIComponent(yyyy + '-' + mm + '-' + dd + 'T23:59:59') +
      '&itemsPerPage=' + CONFIG.ITEMS_PER_PAGE
    );
    return true;
  }

  function injectStyles() {
    if ($('#wloq-styles')) return;

    var style = document.createElement('style');
    style.id = 'wloq-styles';
    style.textContent = `
      .wloq-root, .wloq-root * { box-sizing: border-box; }
      .wloq-root {
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        width: 100%;
        color: ${BRAND.text};
      }

      .wloq-hide {
        position: absolute !important;
        left: -9999px !important;
        width: 1px !important;
        height: 1px !important;
        overflow: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      .wloq-top {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin: 8px 0 14px;
      }

      .wloq-title-wrap { min-width: 0; }

      .wloq-title {
        font-size: 1.24rem;
        line-height: 1.2;
        font-weight: 850;
        color: ${BRAND.primary};
      }

      .wloq-subtitle {
        margin-top: 3px;
        color: ${BRAND.muted};
        font-size: .92rem;
      }

      .wloq-menu-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .wloq-menu-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border: 1px solid ${BRAND.border};
        background: #fff;
        color: ${BRAND.primary};
        font-weight: 800;
        border-radius: 10px;
        padding: 9px 13px;
        cursor: pointer;
        line-height: 1.1;
        white-space: nowrap;
      }

      .wloq-menu-btn:hover { background: ${BRAND.bgSoft}; }

      .wloq-menu {
        position: absolute;
        left: 0;
        top: 46px;
        z-index: 7001;
        width: min(390px, 92vw);
        max-height: 0;
        overflow: auto;
        padding: 0 8px;
        background: #fff;
        border: 1px solid ${BRAND.border};
        border-radius: 14px;
        box-shadow: 0 12px 30px rgba(0,0,0,.16);
        opacity: 0;
        pointer-events: none;
        transition: max-height .25s ease, opacity .18s ease, padding .18s ease;
      }

      .wloq-menu.open {
        max-height: 72vh;
        opacity: 1;
        pointer-events: auto;
        padding: 8px;
      }

      .wloq-menu-section + .wloq-menu-section {
        border-top: 1px solid #eee;
        margin-top: 6px;
        padding-top: 6px;
      }

      .wloq-menu-label {
        color: ${BRAND.primary};
        font-size: .72rem;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: .06em;
        padding: 5px 10px 3px;
      }

      .wloq-menu a {
        display: block;
        padding: 9px 10px;
        color: #111;
        text-decoration: none;
        border-radius: 9px;
        font-weight: 650;
      }

      .wloq-menu a:hover,
      .wloq-menu a[aria-current="page"] {
        background: ${BRAND.bgSoft};
        color: ${BRAND.primary};
      }

      .wloq-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        flex-wrap: wrap;
      }

      .wloq-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        min-height: 38px;
        padding: 9px 14px;
        border-radius: 10px;
        border: 1px solid ${BRAND.border};
        background: #fff;
        color: #111 !important;
        text-decoration: none !important;
        font-weight: 800;
        cursor: pointer;
        line-height: 1.1;
        white-space: nowrap;
        font-size: .92rem;
      }

      .wloq-btn:hover {
        background: ${BRAND.bgSoft};
        color: ${BRAND.primary} !important;
      }

      .wloq-btn-primary {
        background: ${BRAND.primary};
        border-color: ${BRAND.primary};
        color: #fff !important;
      }

      .wloq-btn-primary:hover {
        background: ${BRAND.primaryHover};
        border-color: ${BRAND.primaryHover};
        color: #fff !important;
      }

      .wloq-btn-warning {
        background: ${BRAND.warningBg};
        border-color: #efdca4;
        color: ${BRAND.warning} !important;
      }

      .wloq-btn-small {
        min-height: 34px;
        padding: 8px 10px;
        font-size: .86rem;
      }

      .wloq-panel {
        background: #fff;
        border: 1px solid ${BRAND.border};
        border-radius: 14px;
        box-shadow: 0 2px 8px rgba(0,0,0,.05);
        overflow: hidden;
        margin-bottom: 14px;
      }

      .wloq-panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        background: ${BRAND.primary};
        color: #fff;
        padding: 11px 14px;
      }

      .wloq-panel-title {
        font-weight: 850;
        letter-spacing: .1px;
      }

      .wloq-panel-meta {
        color: rgba(255,255,255,.88);
        font-size: .88rem;
        white-space: nowrap;
      }

      .wloq-panel-body {
        background: ${BRAND.bgSoft};
        padding: 13px;
      }

      .wloq-request-card {
        background: #fff;
        border: 1px solid #ead4d9;
        border-radius: 14px;
        box-shadow: 0 2px 8px rgba(0,0,0,.05);
        padding: 13px 14px;
        margin-bottom: 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }

      .wloq-request-title {
        color: ${BRAND.primary};
        font-weight: 900;
        font-size: 1rem;
        margin-bottom: 3px;
      }

      .wloq-request-text {
        color: ${BRAND.muted};
        font-size: .91rem;
        line-height: 1.4;
      }

      .wloq-tools {
        background: #fff;
        border: 1px solid ${BRAND.border};
        border-radius: 14px;
        box-shadow: 0 2px 8px rgba(0,0,0,.05);
        padding: 12px;
        margin-bottom: 14px;
        display: grid;
        grid-template-columns: minmax(240px, 1fr) auto;
        gap: 10px;
        align-items: end;
      }

      .wloq-field label {
        display: block;
        margin-bottom: 6px;
        color: ${BRAND.muted};
        font-weight: 750;
        font-size: .9rem;
      }

      .wloq-input {
        width: 100%;
        min-height: 40px;
        border: 1px solid #ddd;
        border-radius: 10px;
        padding: 9px 11px;
        font: inherit;
        background: #fff;
      }

      .wloq-input:focus {
        outline: 2px solid rgba(107,0,22,.18);
        border-color: ${BRAND.primary};
      }

      .wloq-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(310px, 1fr));
        gap: 12px;
      }

      .wloq-card {
        min-width: 0;
        background: #fff;
        border: 1px solid #ead4d9;
        border-radius: 14px;
        padding: 13px;
        box-shadow: 0 1px 4px rgba(0,0,0,.04);
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .wloq-card.expired {
        border-color: #ead9bd;
      }

      .wloq-card-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 10px;
      }

      .wloq-quote-no {
        color: ${BRAND.primary};
        font-size: 1.08rem;
        font-weight: 900;
        line-height: 1.2;
      }

      .wloq-muted {
        color: ${BRAND.muted};
        font-size: .88rem;
        line-height: 1.35;
      }

      .wloq-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        border: 1px solid #e2c4ca;
        background: #fff;
        color: ${BRAND.primary};
        border-radius: 999px;
        padding: 4px 9px;
        font-size: .78rem;
        font-weight: 850;
        white-space: nowrap;
      }

      .wloq-pill-active {
        border-color: #d8eadc;
        color: ${BRAND.success};
        background: ${BRAND.successBg};
      }

      .wloq-pill-expired {
        border-color: #efdca4;
        color: ${BRAND.warning};
        background: ${BRAND.warningBg};
      }

      .wloq-money {
        display: grid;
        grid-template-columns: repeat(3, minmax(90px, 1fr));
        gap: 8px;
      }

      .wloq-money-box {
        border: 1px solid #ecd6db;
        border-radius: 11px;
        background: #fff;
        padding: 9px;
      }

      .wloq-money-label {
        color: ${BRAND.muted};
        font-size: .78rem;
        font-weight: 800;
        margin-bottom: 2px;
      }

      .wloq-money-value {
        color: ${BRAND.primary};
        font-weight: 900;
      }

      .wloq-info-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px 10px;
        font-size: .88rem;
      }

      .wloq-info-grid strong {
        color: #333;
      }

      .wloq-card-actions {
        display: flex;
        gap: 7px;
        flex-wrap: wrap;
        margin-top: auto;
      }

      .wloq-empty,
      .wloq-note {
        background: #fff;
        border: 1px dashed #e2c4ca;
        border-radius: 12px;
        padding: 14px;
        color: ${BRAND.muted};
        line-height: 1.45;
      }

      .wloq-note-warning {
        border-color: #efdca4;
        background: ${BRAND.warningBg};
        color: ${BRAND.warning};
      }

      .wloq-modal {
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

      .wloq-modal.open {
        display: flex;
      }

      .wloq-modal-card {
        width: min(1120px, 96vw);
        margin: auto 0;
        background: #fff;
        border-radius: 16px;
        border: 1px solid ${BRAND.border};
        box-shadow: 0 18px 44px rgba(0,0,0,.22);
        overflow: hidden;
        max-height: calc(100vh - 36px);
        display: flex;
        flex-direction: column;
      }

      .wloq-modal-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        background: ${BRAND.primary};
        color: #fff;
        padding: 12px 14px;
        flex: 0 0 auto;
      }

      .wloq-modal-title {
        font-weight: 900;
        font-size: 1.05rem;
      }

      .wloq-modal-subtitle {
        color: rgba(255,255,255,.88);
        font-size: .88rem;
        margin-top: 2px;
      }

      .wloq-modal-close {
        border: 1px solid rgba(255,255,255,.55);
        background: rgba(255,255,255,.12);
        color: #fff;
        border-radius: 10px;
        min-height: 36px;
        padding: 7px 11px;
        font-weight: 850;
        cursor: pointer;
      }

      .wloq-modal-close:hover {
        background: rgba(255,255,255,.22);
      }

      .wloq-modal-body {
        padding: 14px;
        background: ${BRAND.bgSoft};
        overflow: auto;
      }

      .wloq-modal-body .wloq-panel {
        margin-bottom: 0;
        box-shadow: none;
      }

      .wloq-detail-summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
        gap: 9px;
        margin-bottom: 12px;
      }

      .wloq-summary-box {
        background: #fff;
        border: 1px solid #ead4d9;
        border-radius: 12px;
        padding: 10px;
      }

      .wloq-summary-label {
        color: ${BRAND.muted};
        font-size: .8rem;
        font-weight: 850;
      }

      .wloq-summary-value {
        margin-top: 2px;
        color: ${BRAND.primary};
        font-weight: 900;
      }

      .wloq-lines {
        display: grid;
        gap: 10px;
      }

      .wloq-line {
        background: #fff;
        border: 1px solid #ead4d9;
        border-radius: 12px;
        padding: 11px;
        display: grid;
        grid-template-columns: minmax(130px, 170px) minmax(240px, 1fr) repeat(3, auto);
        align-items: center;
        gap: 10px;
      }

      .wloq-line-code {
        color: ${BRAND.primary};
        font-weight: 900;
        word-break: break-word;
      }

      .wloq-line-desc {
        color: #222;
        font-weight: 650;
        line-height: 1.3;
      }

      .wloq-line-meta {
        color: ${BRAND.muted};
        font-size: .86rem;
        white-space: nowrap;
      }

      .wloq-line-price {
        color: #111;
        font-weight: 900;
        white-space: nowrap;
      }

      @media (max-width: 860px) {
        .wloq-tools {
          grid-template-columns: 1fr;
        }

        .wloq-top {
          align-items: flex-start;
          flex-direction: column;
        }

        .wloq-actions {
          width: 100%;
          justify-content: stretch;
        }

        .wloq-actions .wloq-btn,
        .wloq-tools .wloq-btn {
          flex: 1 1 auto;
        }

        .wloq-panel-head {
          align-items: flex-start;
          flex-direction: column;
        }

        .wloq-panel-meta {
          white-space: normal;
        }

        .wloq-line {
          grid-template-columns: 1fr;
        }

        .wloq-money {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function getHost() {
    return $('#MainLayoutRow .col') || $('td.pageContentBody') || document.body;
  }

  function buildMenu(root) {
    var menu = $('.wloq-menu', root);
    var btn = $('.wloq-menu-btn', root);
    var currentPath = (window.location.pathname || '').split('/').pop().toLowerCase();
    var isCashAccount = getStoredCashAccountFlag();
    var paymentLabel = isCashAccount === true ? 'Reload Balance' : (isCashAccount === false ? 'Make a Payment' : 'Make a Payment / Reload Balance');

    var accountSettingLinks = [
      ['Quicklists_R.aspx', 'Shopping Lists']
    ];

    if (isCashAccount !== true) {
      accountSettingLinks.push(['Statements_R.aspx', 'Statements']);
    }

    accountSettingLinks = accountSettingLinks.concat([
      ['CustomerTokens.aspx', 'Payment Methods'],
      ['AccountSettings.aspx', 'Change Password / Account Settings'],
      ['AddressList_R.aspx', 'Addresses'],
      ['Contacts_r.aspx', 'Contacts']
    ]);

    var groups = [
      {
        label: '',
        links: [
          ['AccountInfo_R.aspx', 'Account Dashboard']
        ]
      },
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
      {
        label: 'Account Settings',
        links: accountSettingLinks
      }
    ];

    menu.innerHTML = groups.map(function (group) {
      return '<div class="wloq-menu-section">' +
        (group.label ? '<div class="wloq-menu-label">' + escapeHtml(group.label) + '</div>' : '') +
        group.links.map(function (link) {
          var href = link[0];
          var label = normalizeMenuLabel(link[1]);
          var path = String(href || '').split('?')[0].split('#')[0].split('/').pop().toLowerCase();
          var current = path === currentPath ? ' aria-current="page"' : '';
          return '<a role="menuitem" href="' + escapeAttr(href) + '"' + current + '>' + escapeHtml(label) + '</a>';
        }).join('') +
      '</div>';
    }).join('');

    function toggle(open) {
      menu.classList.toggle('open', !!open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggle(!menu.classList.contains('open'));
    });

    document.addEventListener('click', function (e) {
      if (!menu.classList.contains('open')) return;
      if (!menu.contains(e.target) && e.target !== btn) toggle(false);
    });
  }

  function parseQuotes() {
    var grid = $('#ctl00_PageBody_QuotesGrid');
    if (!grid) return [];

    return $$('tbody tr', grid).filter(function (row) {
      return !row.classList.contains('rgNoRecords') && row.querySelector('td');
    }).map(function (row) {
      var wideLink = $('td[data-title="Quote #"].wide-only a', row);
      var narrowLink = $('td[data-title="Quote #"].narrow-only a', row);
      var link = wideLink || narrowLink || $('td[data-title="Quote #"] a', row);

      var quoteNumber = txt(link) || txt($('td[data-title="Quote #"]', row));
      var rawHref = link ? (link.getAttribute('href') || link.href || '#') : '#';
      var oid = getOidFromHref(rawHref);
      var expires = txt($('td[data-title="Expires"]', row));
      var expired = isExpiredDate(expires);

      return {
        row: row,
        quoteNumber: quoteNumber,
        oid: oid,
        detailHref: normalizeQuoteDetailsHref(rawHref),
        documentHref: processDocumentHref(oid),
        yourRef: txt($('td[data-title="Your Ref"]', row)) || '—',
        jobRef: txt($('td[data-title="Job Ref"]', row)) || '—',
        created: txt($('td[data-title="Created"]', row)) || '—',
        expires: expires || '—',
        subtotal: txt($('td[data-title="Goods Total"]', row)) || '0',
        tax: txt($('td[data-title="Tax"]', row)) || '0',
        total: txt($('td[data-title="Total Amount"]', row)) || '0',
        lines: txt($('td[data-title="Lines"]', row)) || '0',
        branch: txt($('td[data-title="Branch"]', row)) || '—',
        salesRep: txt($('td[data-title="Sales Rep"]', row)) || '—',
        expired: expired
      };
    }).sort(function (a, b) {
      var ad = parseDate(a.expires);
      var bd = parseDate(b.expires);
      var aTime = ad ? ad.getTime() : 0;
      var bTime = bd ? bd.getTime() : 0;

      if (a.expired !== b.expired) return a.expired ? 1 : -1;
      return bTime - aTime;
    });
  }

  function getSelectedQuoteFromPage(quotes) {
    var header = $('#detailsAnchor') ? $('#detailsAnchor').closest('.bodyFlexItem') : null;
    var detailHeader = header ? $('.listPageHeader', header) : null;
    var quoteNo = '';

    if (detailHeader) {
      var m = txt(detailHeader).match(/Details for Quote\s+(\S+)/i);
      if (m) quoteNo = m[1];
    }

    var selectedOid = getSelectedOid();

    return quotes.filter(function (q) {
      return (quoteNo && q.quoteNumber === quoteNo) || (selectedOid && q.oid === selectedOid);
    })[0] || null;
  }

  function parseQuoteLines() {
    var grid = $('#ctl00_PageBody_ctl02_QuoteDetailGrid');
    if (!grid) return [];

    return $$('tbody tr', grid).filter(function (row) {
      return !row.classList.contains('rgNoRecords') && row.querySelector('td');
    }).map(function (row) {
      return {
        code: txt($('td[data-title="Product Code"]', row)),
        description: txt($('td[data-title="Description"]', row)),
        tally: txt($('td[data-title="Tally"]', row)),
        qty: txt($('td[data-title="Qty"]', row)),
        qtyUom: txt($$('td[data-title="UOM"]', row)[0]),
        price: txt($('td[data-title="Price"]', row)),
        priceUom: txt($$('td[data-title="UOM"]', row)[1])
      };
    });
  }

  function quoteCard(q) {
    var card = dom(`
      <article class="wloq-card ${q.expired ? 'expired' : 'active'}" data-quote-search="${escapeAttr([
        q.quoteNumber, q.yourRef, q.jobRef, q.created, q.expires, q.branch, q.salesRep, q.total
      ].join(' ').toLowerCase())}">
        <div class="wloq-card-top">
          <div>
            <div class="wloq-quote-no">Quote #${escapeHtml(q.quoteNumber)}</div>
            <div class="wloq-muted">Created ${escapeHtml(q.created)} • Expires ${escapeHtml(q.expires)}</div>
          </div>
          <span class="wloq-pill ${q.expired ? 'wloq-pill-expired' : 'wloq-pill-active'}">${q.expired ? 'Expired' : 'Open'}</span>
        </div>

        <div class="wloq-money">
          <div class="wloq-money-box">
            <div class="wloq-money-label">Subtotal</div>
            <div class="wloq-money-value">${escapeHtml(money(q.subtotal))}</div>
          </div>
          <div class="wloq-money-box">
            <div class="wloq-money-label">Tax</div>
            <div class="wloq-money-value">${escapeHtml(money(q.tax))}</div>
          </div>
          <div class="wloq-money-box">
            <div class="wloq-money-label">Total</div>
            <div class="wloq-money-value">${escapeHtml(money(q.total))}</div>
          </div>
        </div>

        <div class="wloq-info-grid">
          <div><strong>Lines:</strong> ${escapeHtml(q.lines)}</div>
          <div><strong>Branch:</strong> ${escapeHtml(q.branch)}</div>
          <div><strong>Your Ref:</strong> ${escapeHtml(q.yourRef)}</div>
          <div><strong>Job Ref:</strong> ${escapeHtml(q.jobRef)}</div>
          <div><strong>Sales Rep:</strong> ${escapeHtml(q.salesRep)}</div>
        </div>

        ${q.expired ? '<div class="wloq-note wloq-note-warning">This quote has expired. You can still view it for reference, but pricing may need to be requoted before purchase.</div>' : ''}

        <div class="wloq-card-actions">
          <a class="wloq-btn wloq-btn-primary" href="${escapeAttr(q.detailHref)}">View Details</a>
          <a class="wloq-btn" href="${escapeAttr(q.documentHref)}" target="_blank" rel="noopener">View / Download Quote</a>
        </div>
      </article>
    `);

    return card;
  }

  function buildQuoteSection(title, quotes, emptyText) {
    var section = dom(`
      <section class="wloq-panel">
        <div class="wloq-panel-head">
          <div class="wloq-panel-title">${escapeHtml(title)}</div>
          <div class="wloq-panel-meta">${quotes.length} quote${quotes.length === 1 ? '' : 's'}</div>
        </div>
        <div class="wloq-panel-body">
          <div class="wloq-grid"></div>
        </div>
      </section>
    `);

    var grid = $('.wloq-grid', section);
    if (!quotes.length) {
      grid.replaceWith(dom('<div class="wloq-empty">' + escapeHtml(emptyText) + '</div>'));
    } else {
      quotes.forEach(function (q) {
        grid.appendChild(quoteCard(q));
      });
    }

    return section;
  }

  function buildDetailsPanel(selectedQuote) {
    if (!selectedQuote) return null;

    var lines = parseQuoteLines();
    var requestDocument = $('#ctl00_PageBody_ctl02_RequestDocumentLink') || $('#ctl00_PageBody_ctl02_RequestDocumentDropDown');
    var addToCart = $('#ctl00_PageBody_ctl02_AddToCart') || $('#ctl00_PageBody_ctl02_AddToCartDropDown');

    var panel = dom(`
      <section class="wloq-panel" id="wloq-selected-detail">
        <div class="wloq-panel-head">
          <div>
            <div class="wloq-panel-title">Quote #${escapeHtml(selectedQuote.quoteNumber)} Details</div>
            <div class="wloq-panel-meta">${selectedQuote.expired ? 'Expired quote — reference only' : 'Open quote'}</div>
          </div>
          <div class="wloq-actions wloq-detail-actions"></div>
        </div>
        <div class="wloq-panel-body">
          ${selectedQuote.expired ? '<div class="wloq-note wloq-note-warning" style="margin-bottom:12px">This quoted price has expired. Please reach out to request an updated quote before placing an order.</div>' : ''}
          <div class="wloq-detail-summary">
            <div class="wloq-summary-box"><div class="wloq-summary-label">Subtotal</div><div class="wloq-summary-value">${escapeHtml(money(selectedQuote.subtotal))}</div></div>
            <div class="wloq-summary-box"><div class="wloq-summary-label">Tax</div><div class="wloq-summary-value">${escapeHtml(money(selectedQuote.tax))}</div></div>
            <div class="wloq-summary-box"><div class="wloq-summary-label">Total</div><div class="wloq-summary-value">${escapeHtml(money(selectedQuote.total))}</div></div>
            <div class="wloq-summary-box"><div class="wloq-summary-label">Created</div><div class="wloq-summary-value">${escapeHtml(selectedQuote.created)}</div></div>
            <div class="wloq-summary-box"><div class="wloq-summary-label">Expires</div><div class="wloq-summary-value">${escapeHtml(selectedQuote.expires)}</div></div>
            <div class="wloq-summary-box"><div class="wloq-summary-label">Branch</div><div class="wloq-summary-value">${escapeHtml(selectedQuote.branch)}</div></div>
          </div>
          <div class="wloq-lines"></div>
        </div>
      </section>
    `);

    var actions = $('.wloq-detail-actions', panel);
    var downloadButton = requestDocument ? makeActionFromOriginal(requestDocument, 'View / Download Quote', 'wloq-btn') : null;
    if (downloadButton) {
      downloadButton.setAttribute('target', '_blank');
      downloadButton.setAttribute('rel', 'noopener');
      actions.appendChild(downloadButton);
    } else {
      actions.appendChild(dom('<a class="wloq-btn" target="_blank" rel="noopener" href="' + escapeAttr(selectedQuote.documentHref) + '">View / Download Quote</a>'));
    }

    if (!selectedQuote.expired && addToCart) {
      actions.appendChild(makeActionFromOriginal(addToCart, 'Add Quote to Cart', 'wloq-btn wloq-btn-primary'));
    }

    var lineWrap = $('.wloq-lines', panel);

    if (!lines.length) {
      lineWrap.appendChild(dom('<div class="wloq-empty">No line items were found for this quote.</div>'));
      return panel;
    }

    lines.forEach(function (line) {
      lineWrap.appendChild(dom(`
        <div class="wloq-line">
          <div class="wloq-line-code">${escapeHtml(line.code || '—')}</div>
          <div class="wloq-line-desc">${escapeHtml(line.description || '—')}</div>
          <div class="wloq-line-meta">Qty: ${escapeHtml(line.qty || '—')} ${escapeHtml(line.qtyUom || '')}</div>
          <div class="wloq-line-price">${escapeHtml(money(line.price))}</div>
          <div class="wloq-line-meta">per ${escapeHtml(line.priceUom || '—')}</div>
          ${line.tally ? '<div class="wloq-line-meta" style="grid-column:1 / -1">Tally: ' + escapeHtml(line.tally) + '</div>' : ''}
        </div>
      `));
    });

    return panel;
  }


  function buildDetailsModal(selectedQuote) {
    var detailPanel = buildDetailsPanel(selectedQuote);
    if (!detailPanel) return null;

    // The panel already has its own action area; inside the modal it becomes the body content.
    var modal = dom(`
      <div class="wloq-modal open" id="wloq-detail-modal" role="dialog" aria-modal="true" aria-labelledby="wloq-modal-title">
        <div class="wloq-modal-card">
          <div class="wloq-modal-head">
            <div>
              <div class="wloq-modal-title" id="wloq-modal-title">Quote #${escapeHtml(selectedQuote.quoteNumber)}</div>
              <div class="wloq-modal-subtitle">${selectedQuote.expired ? 'Expired quote — request an updated quote before ordering.' : 'Open quote details and line items.'}</div>
            </div>
            <button type="button" class="wloq-modal-close" id="wloq-modal-close">Close</button>
          </div>
          <div class="wloq-modal-body"></div>
        </div>
      </div>
    `);

    $('.wloq-modal-body', modal).appendChild(detailPanel);

    var closeBtn = $('#wloq-modal-close', modal);
    function closeModal() {
      modal.classList.remove('open');

      // Remove the oid/hash from the address bar after closing so refresh returns to the list view.
      try {
        var url = new URL(window.location.href);
        url.searchParams.delete('oid');
        url.hash = '';
        window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));
      } catch (err) {}
    }

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function (event) {
      if (event.target === modal) closeModal();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && modal.classList.contains('open')) closeModal();
    });

    return modal;
  }


  function buildQuoteRequestCTA() {
    return dom(`
      <div class="wloq-request-card">
        <div>
          <div class="wloq-request-title">Need a new quote?</div>
          <div class="wloq-request-text">
            Pricing a larger order, special materials, or an expired quote? Send us a quick request and we’ll follow up with updated pricing.
          </div>
        </div>
        <a class="wloq-btn wloq-btn-primary" href="${escapeAttr(CONFIG.QUOTE_URL)}" target="_blank" rel="noopener">
          Request a Quote
        </a>
      </div>
    `);
  }

  function buildTools(root, quotes) {
    var tools = dom(`
      <div class="wloq-tools">
        <div class="wloq-field">
          <label for="wloq-filter">Filter visible quotes</label>
          <input id="wloq-filter" class="wloq-input" type="search" placeholder="Search quote #, branch, ref, date, total...">
        </div>
        <button type="button" class="wloq-btn" id="wloq-clear-filter">Clear Filter</button>
      </div>
    `);

    var input = $('#wloq-filter', tools);
    var clear = $('#wloq-clear-filter', tools);

    function applyFilter() {
      var needle = String(input.value || '').trim().toLowerCase();
      $$('.wloq-card', root).forEach(function (card) {
        var hay = card.getAttribute('data-quote-search') || '';
        card.style.display = !needle || hay.indexOf(needle) >= 0 ? '' : 'none';
      });
    }

    input.addEventListener('input', applyFilter);
    clear.addEventListener('click', function () {
      input.value = '';
      applyFilter();
      input.focus();
    });

    return tools;
  }

  function hideLegacy(selectedQuote) {
    var legacyNav = $('#ctl00_LeftSidebarContents_MainNav_NavigationMenu');
    if (legacyNav) legacyNav.classList.add('wloq-hide');

    [
      '#ctl00_PageBody_SearchPanel',
      '#ctl00_PageBody_QuotesGrid',
      '.paging-control'
    ].forEach(function (selector) {
      $$(selector).forEach(function (el) {
        el.classList.add('wloq-hide');
      });
    });

    $$('.bodyFlexItem.listPageHeader').forEach(function (header) {
      if (/Quote Results for/i.test(txt(header)) || /Details for Quote/i.test(txt(header))) {
        header.classList.add('wloq-hide');
      }
    });

    // Hide the legacy quote action strip. We rebuild it into the selected-detail panel.
    $$('.epi-action').forEach(function (el) {
      el.classList.add('wloq-hide');
    });

    // Extra safety: if selected quote is expired, hide the original add-to-cart controls as well.
    if (selectedQuote && selectedQuote.expired) {
      [
        '#ctl00_PageBody_ctl02_AddToCart',
        '#ctl00_PageBody_ctl02_AddToCartDropDown'
      ].forEach(function (selector) {
        var el = $(selector);
        if (el) el.classList.add('wloq-hide');
      });
    }

    var detailGrid = $('#ctl00_PageBody_ctl02_QuoteDetailGrid');
    if (detailGrid) detailGrid.classList.add('wloq-hide');
  }

  function buildUI() {
    injectStyles();

    var host = getHost();
    if (!host) return;

    var existing = $('#wloq-root');
    if (existing) existing.remove();

    var quotes = parseQuotes();
    var activeQuotes = quotes.filter(function (q) { return !q.expired; });
    var expiredQuotes = quotes.filter(function (q) { return q.expired; });
    var selectedQuote = getSelectedQuoteFromPage(quotes);

    var root = dom(`
      <div class="wloq-root" id="wloq-root">
        <div class="wloq-top">
          <div class="wloq-menu-wrap">
            <button type="button" class="wloq-menu-btn" aria-expanded="false" aria-controls="wloq-menu">☰ Menu</button>
            <div class="wloq-title-wrap">
              <div class="wloq-title">Quotes</div>
              <div class="wloq-subtitle"></div>
            </div>
            <div class="wloq-menu" id="wloq-menu" role="menu"></div>
          </div>
          <div class="wloq-actions">
            <a class="wloq-btn" href="AccountInfo_R.aspx">Account Dashboard</a>
          </div>
        </div>
        <div id="wloq-content"></div>
      </div>
    `);

    buildMenu(root);

    var content = $('#wloq-content', root);
    content.appendChild(buildQuoteRequestCTA());
    content.appendChild(buildTools(root, quotes));

    content.appendChild(buildQuoteSection('Open Quotes', activeQuotes, 'No open quotes were found in the current results.'));
    content.appendChild(buildQuoteSection('Expired Quotes', expiredQuotes, 'No expired quotes were found in the current results.'));

    var firstContainer = $('.bodyFlexContainer', host) || host.firstChild;
    host.insertBefore(root, firstContainer);

    hideLegacy(selectedQuote);

    if (selectedQuote) {
      var detailModal = buildDetailsModal(selectedQuote);
      if (detailModal) document.body.appendChild(detailModal);
    }

    document.title = (document.title || '').replace(/Open Quotes|Quote Results/ig, 'Quotes');
  }

  ready(function () {
    if (maybeDefaultAllTimeSearch()) return;
    buildUI();

    window.setTimeout(function () {
      if (!$('#wloq-root')) buildUI();
    }, 600);
  });
})();
