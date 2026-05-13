/* ==========================================================
   Woodson — Open Orders Override
   Page: OpenOrders_r.aspx
   Purpose:
   - Apply Woodson grouped account menu
   - Replace legacy order table with modern status-grouped cards
   - Keep Open Orders as the default view
   - Add front-end search/filtering and status filters
   - Use modal order details instead of inline table expansion
   - Preserve UPS tracking behavior from the previous Tracking.js flow
   ========================================================== */
(function () {
  'use strict';

  if (!/OpenOrders_r\.aspx/i.test(window.location.pathname)) return;
  if (window.__WL_OPEN_ORDERS_REWRITE__) return;
  window.__WL_OPEN_ORDERS_REWRITE__ = true;

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
    successBg: '#f3fbf5',
    blue: '#1e3a8a',
    blueBg: '#eef5ff'
  };

  var CONFIG = {
    ITEMS_PER_PAGE: 48,
    AUTO_EXPAND_ITEMS_PER_PAGE: true,
    ORDER_PAGE: 'OpenOrders_r.aspx'
  };

  var STATUS_BUCKETS = [
    {
      key: 'waiting',
      title: 'Waiting for Stock',
      shortLabel: 'Waiting for stock',
      help: 'Some items are still being received by Woodson before this order can move forward.',
      pillClass: 'wloo-pill-waiting'
    },
    {
      key: 'picking',
      title: 'Being Prepared',
      shortLabel: 'Being prepared',
      help: 'Woodson is pulling or preparing the products on this order.',
      pillClass: 'wloo-pill-picking'
    },
    {
      key: 'delivery',
      title: 'Delivery Status',
      shortLabel: 'Delivery status',
      help: 'This order is being prepared for delivery, dispatched, or waiting for a delivery update.',
      pillClass: 'wloo-pill-delivery'
    },
    {
      key: 'pickup',
      title: 'Ready for Pickup',
      shortLabel: 'Ready for pickup',
      help: 'This order is ready, or nearly ready, for customer pickup.',
      pillClass: 'wloo-pill-pickup'
    },
    {
      key: 'other',
      title: 'Other Open Orders',
      shortLabel: 'Open order',
      help: 'These orders are open but do not have a more specific customer-facing status yet.',
      pillClass: 'wloo-pill-other'
    }
  ];

  var BUCKET_INDEX = STATUS_BUCKETS.reduce(function (acc, bucket, index) {
    acc[bucket.key] = index;
    return acc;
  }, {});

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
    return String(value == null ? '' : value).replace(/[&<>\"]/g, function (ch) {
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

  function getHost() {
    return $('#MainLayoutRow .col') || $('td.pageContentBody') || document.body;
  }

  function getStoredCashAccountFlag() {
    try {
      var raw = localStorage.getItem('wl_account_is_cash_v1');
      if (raw === 'true') return true;
      if (raw === 'false') return false;
    } catch (err) {}
    return null;
  }

  function getOidFromHref(href) {
    var m = String(href || '').match(/[?&]oid=(\d+)/i);
    return m ? m[1] : '';
  }

  function orderDetailsHref(oid) {
    if (!oid) return '#';
    return 'OrderDetails_r.aspx?oid=' + encodeURIComponent(oid) + '&returnUrl=%7e%2fOpenOrders_r.aspx';
  }

  function normalizeMenuLabel(label) {
    label = String(label || '').trim();
    if (/^Account Information$/i.test(label)) return 'Account Dashboard';
    if (/^Quicklists$/i.test(label)) return 'Shopping Lists';
    if (/Customer\s*Cards|Stored\s*Cards/i.test(label)) return 'Payment Methods';
    return label;
  }

  function classifyStatus(status, order) {
    var s = String(status || '').toLowerCase();
    var hay = [s, order && order.deliveryText, order && order.vehicleTracking].join(' ').toLowerCase();

    if (/back\s*order|backorder|waiting|awaiting stock|stock|vendor|special order|on order|ordered|purchase order|po\b/.test(hay)) {
      return 'waiting';
    }

    if (/deliver|delivery|dispatch|truck|route|out for delivery|shipped|shipment/.test(hay)) {
      return 'delivery';
    }

    if (/pickup|pick up|ready|will call|collect/.test(hay)) {
      return 'pickup';
    }

    if (/pick|picking|pull|pulling|processing|prepare|preparing|allocated|staged/.test(hay)) {
      return 'picking';
    }

    return 'other';
  }

  function bucketFor(key) {
    return STATUS_BUCKETS.filter(function (bucket) { return bucket.key === key; })[0] || STATUS_BUCKETS[STATUS_BUCKETS.length - 1];
  }

  function maybeNormalizeOpenOrdersUrl() {
    if (!CONFIG.AUTO_EXPAND_ITEMS_PER_PAGE) return false;

    var params = new URLSearchParams(window.location.search || '');
    if (params.has('tracking') || params.has('oid')) return false;
    if (params.has('searchType') || params.has('startDate') || params.has('endDate')) return false;
    if (params.get('itemsPerPage') === String(CONFIG.ITEMS_PER_PAGE)) return false;

    params.set('itemsPerPage', String(CONFIG.ITEMS_PER_PAGE));
    var next = CONFIG.ORDER_PAGE + '?' + params.toString();
    window.location.replace(next);
    return true;
  }

  function injectStyles() {
    if ($('#wloo-styles')) return;

    var style = document.createElement('style');
    style.id = 'wloo-styles';
    style.textContent = `
      .wloo-root, .wloo-root * { box-sizing: border-box; }
      .wloo-root {
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        width: 100%;
        color: ${BRAND.text};
      }

      .wloo-hide {
        position: absolute !important;
        left: -9999px !important;
        width: 1px !important;
        height: 1px !important;
        overflow: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      .wloo-top {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin: 8px 0 14px;
      }

      .wloo-title-wrap { min-width: 0; }
      .wloo-title { font-size: 1.24rem; line-height: 1.2; font-weight: 850; color: ${BRAND.primary}; }
      .wloo-subtitle { margin-top: 3px; color: ${BRAND.muted}; font-size: .92rem; }

      .wloo-menu-wrap { display: flex; align-items: center; gap: 10px; min-width: 0; }
      .wloo-menu-btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        border: 1px solid ${BRAND.border}; background: #fff; color: ${BRAND.primary};
        font-weight: 800; border-radius: 10px; padding: 9px 13px; cursor: pointer; line-height: 1.1; white-space: nowrap;
      }
      .wloo-menu-btn:hover { background: ${BRAND.bgSoft}; }
      .wloo-menu {
        position: absolute; left: 0; top: 46px; z-index: 7001; width: min(390px, 92vw);
        max-height: 0; overflow: auto; padding: 0 8px; background: #fff; border: 1px solid ${BRAND.border};
        border-radius: 14px; box-shadow: 0 12px 30px rgba(0,0,0,.16); opacity: 0; pointer-events: none;
        transition: max-height .25s ease, opacity .18s ease, padding .18s ease;
      }
      .wloo-menu.open { max-height: 72vh; opacity: 1; pointer-events: auto; padding: 8px; }
      .wloo-menu-section + .wloo-menu-section { border-top: 1px solid #eee; margin-top: 6px; padding-top: 6px; }
      .wloo-menu-label { color: ${BRAND.primary}; font-size: .72rem; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; padding: 5px 10px 3px; }
      .wloo-menu a { display: block; padding: 9px 10px; color: #111; text-decoration: none; border-radius: 9px; font-weight: 650; }
      .wloo-menu a:hover, .wloo-menu a[aria-current="page"] { background: ${BRAND.bgSoft}; color: ${BRAND.primary}; }

      .wloo-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
      .wloo-btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 38px; padding: 9px 14px;
        border-radius: 10px; border: 1px solid ${BRAND.border}; background: #fff; color: #111 !important;
        text-decoration: none !important; font-weight: 800; cursor: pointer; line-height: 1.1; white-space: nowrap; font-size: .92rem;
      }
      .wloo-btn:hover { background: ${BRAND.bgSoft}; color: ${BRAND.primary} !important; }
      .wloo-btn-primary { background: ${BRAND.primary}; border-color: ${BRAND.primary}; color: #fff !important; }
      .wloo-btn-primary:hover { background: ${BRAND.primaryHover}; border-color: ${BRAND.primaryHover}; color: #fff !important; }
      .wloo-btn-small { min-height: 34px; padding: 8px 10px; font-size: .86rem; }

      .wloo-tools, .wloo-panel, .wloo-summary-card {
        background: #fff; border: 1px solid ${BRAND.border}; border-radius: 14px; box-shadow: 0 2px 8px rgba(0,0,0,.05); overflow: hidden;
      }
      .wloo-tools { padding: 12px; margin-bottom: 14px; display: grid; grid-template-columns: minmax(250px, 1fr) auto; gap: 10px; align-items: end; }
      .wloo-field label { display: block; margin-bottom: 6px; color: ${BRAND.muted}; font-weight: 750; font-size: .9rem; }
      .wloo-input { width: 100%; min-height: 40px; border: 1px solid #ddd; border-radius: 10px; padding: 9px 11px; font: inherit; background: #fff; }
      .wloo-input:focus { outline: 2px solid rgba(107,0,22,.18); border-color: ${BRAND.primary}; }

      .wloo-status-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 14px; }
      .wloo-tab { border: 1px solid #ead4d9; background: #fff; color: ${BRAND.primary}; border-radius: 999px; padding: 8px 12px; font-weight: 850; cursor: pointer; }
      .wloo-tab.active { background: ${BRAND.primary}; color: #fff; border-color: ${BRAND.primary}; }

      .wloo-summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 14px; }
      .wloo-summary-card { padding: 12px; }
      .wloo-summary-label { color: ${BRAND.muted}; font-size: .82rem; font-weight: 850; }
      .wloo-summary-value { color: ${BRAND.primary}; font-size: 1.45rem; font-weight: 950; line-height: 1.1; margin-top: 4px; }

      .wloo-panel { margin-bottom: 14px; }
      .wloo-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: ${BRAND.primary}; color: #fff; padding: 11px 14px; }
      .wloo-panel-title { font-weight: 850; letter-spacing: .1px; }
      .wloo-panel-meta { color: rgba(255,255,255,.88); font-size: .88rem; white-space: nowrap; }
      .wloo-panel-body { background: ${BRAND.bgSoft}; padding: 13px; }

      .wloo-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 12px; }
      .wloo-card { min-width: 0; background: #fff; border: 1px solid #ead4d9; border-radius: 14px; padding: 13px; box-shadow: 0 1px 4px rgba(0,0,0,.04); display: flex; flex-direction: column; gap: 10px; }
      .wloo-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
      .wloo-order-no { color: ${BRAND.primary}; font-size: 1.08rem; font-weight: 950; line-height: 1.2; }
      .wloo-muted { color: ${BRAND.muted}; font-size: .88rem; line-height: 1.35; }
      .wloo-note { background: #fff; border: 1px dashed #e2c4ca; border-radius: 12px; padding: 10px; color: ${BRAND.muted}; line-height: 1.4; font-size: .9rem; }

      .wloo-pill { display: inline-flex; align-items: center; gap: 5px; border: 1px solid #e2c4ca; background: #fff; color: ${BRAND.primary}; border-radius: 999px; padding: 4px 9px; font-size: .78rem; font-weight: 850; white-space: nowrap; }
      .wloo-pill-waiting { border-color: #efdca4; background: ${BRAND.warningBg}; color: ${BRAND.warning}; }
      .wloo-pill-picking { border-color: #efdca4; background: #fff5e8; color: #9a3412; }
      .wloo-pill-delivery { border-color: #cfe0ff; background: ${BRAND.blueBg}; color: ${BRAND.blue}; }
      .wloo-pill-pickup { border-color: #d8eadc; background: ${BRAND.successBg}; color: ${BRAND.success}; }
      .wloo-pill-other { border-color: #e5e7eb; background: #f8fafc; color: #334155; }

      .wloo-money { display: grid; grid-template-columns: repeat(3, minmax(90px, 1fr)); gap: 8px; }
      .wloo-money-box { border: 1px solid #ecd6db; border-radius: 11px; background: #fff; padding: 9px; }
      .wloo-money-label { color: ${BRAND.muted}; font-size: .78rem; font-weight: 800; margin-bottom: 2px; }
      .wloo-money-value { color: ${BRAND.primary}; font-weight: 900; }

      .wloo-info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 10px; font-size: .88rem; }
      .wloo-info-grid strong { color: #333; }
      .wloo-card-actions { display: flex; gap: 7px; flex-wrap: wrap; margin-top: auto; }

      .wloo-empty { background: #fff; border: 1px dashed #e2c4ca; border-radius: 12px; padding: 18px; color: ${BRAND.muted}; text-align: center; }

      .wloo-modal { position: fixed; inset: 0; z-index: 9999; display: none; align-items: flex-start; justify-content: center; padding: 18px; background: rgba(0,0,0,.45); overflow: auto; }
      .wloo-modal.open { display: flex; }
      .wloo-modal-card { width: min(1120px, 96vw); margin: auto 0; background: #fff; border-radius: 16px; border: 1px solid ${BRAND.border}; box-shadow: 0 18px 44px rgba(0,0,0,.22); overflow: hidden; max-height: calc(100vh - 36px); display: flex; flex-direction: column; }
      .wloo-modal-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: ${BRAND.primary}; color: #fff; padding: 12px 14px; flex: 0 0 auto; }
      .wloo-modal-title { font-weight: 900; font-size: 1.05rem; }
      .wloo-modal-subtitle { color: rgba(255,255,255,.88); font-size: .88rem; margin-top: 2px; }
      .wloo-modal-close { border: 1px solid rgba(255,255,255,.55); background: rgba(255,255,255,.12); color: #fff; border-radius: 10px; min-height: 36px; padding: 7px 11px; font-weight: 850; cursor: pointer; }
      .wloo-modal-close:hover { background: rgba(255,255,255,.22); }
      .wloo-modal-body { padding: 14px; background: ${BRAND.bgSoft}; overflow: auto; }

      .wloo-lines { display: grid; gap: 10px; }
      .wloo-line { background: #fff; border: 1px solid #ead4d9; border-radius: 12px; padding: 11px; display: grid; grid-template-columns: minmax(130px, 170px) minmax(240px, 1fr) auto; align-items: center; gap: 10px; }
      .wloo-line-code { color: ${BRAND.primary}; font-weight: 900; word-break: break-word; }
      .wloo-line-desc { color: #222; font-weight: 650; line-height: 1.3; }
      .wloo-line-meta { color: ${BRAND.muted}; font-size: .86rem; white-space: nowrap; }
      .wloo-line-price { color: #111; font-weight: 900; white-space: nowrap; }
      .wloo-tracking-pills { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
      .wloo-track-pill { display: inline-flex; align-items: center; gap: 6px; padding: 8px 11px; border-radius: 999px; font-weight: 900; font-size: .86rem; text-decoration: none !important; background: #111827; color: #fff !important; }
      .wloo-track-pill:hover { opacity: .92; color: #fff !important; }

      .wloo-loading { color: ${BRAND.muted}; padding: 16px; background: #fff; border-radius: 12px; border: 1px dashed #e2c4ca; }
      .wloo-error { color: ${BRAND.danger}; background: ${BRAND.dangerBg}; border: 1px solid #f0caca; border-radius: 12px; padding: 12px; }

      .wloo-track-overlay { position: fixed; inset: 0; display: grid; place-items: center; padding: 24px; background: rgba(255,255,255,.98); z-index: 10000; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
      .wloo-track-card { width: min(760px, 92vw); background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; box-shadow: 0 12px 36px rgba(0,0,0,.08); padding: 20px; }
      .wloo-track-title { font-size: 22px; font-weight: 900; color: ${BRAND.primary}; }
      .wloo-track-sub { color: #64748b; margin-top: 2px; }
      .wloo-track-list { display: grid; gap: 12px; margin-top: 14px; }
      .wloo-track-line { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; border: 1px solid #eef0f3; border-radius: 12px; padding: 12px; }
      .wloo-track-num { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-weight: 800; }

      @media (max-width: 860px) {
        .wloo-top { align-items: flex-start; flex-direction: column; }
        .wloo-actions { width: 100%; justify-content: stretch; }
        .wloo-actions .wloo-btn, .wloo-tools .wloo-btn { flex: 1 1 auto; }
        .wloo-tools { grid-template-columns: 1fr; }
        .wloo-panel-head { align-items: flex-start; flex-direction: column; }
        .wloo-panel-meta { white-space: normal; }
        .wloo-line { grid-template-columns: 1fr; }
        .wloo-money { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function buildMenu(root) {
    var menu = $('.wloo-menu', root);
    var btn = $('.wloo-menu-btn', root);
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
      return '<div class="wloo-menu-section">' +
        (group.label ? '<div class="wloo-menu-label">' + escapeHtml(group.label) + '</div>' : '') +
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

  function parseOrders() {
    var grid = $('#ctl00_PageBody_OrdersGrid');
    if (!grid) return [];

    var rows = $$('tbody tr.rgRow, tbody tr.rgAltRow', grid);

    return rows.map(function (row) {
      var wideLink = $('td[data-title="Order #"].wide-only a', row);
      var narrowLink = $('td[data-title="Order #"].narrow-only a', row);
      var link = wideLink || narrowLink || $('td[data-title="Order #"] a', row) || $('a[href*="oid="]', row);
      var rawHref = link ? (link.getAttribute('href') || link.href || '#') : '#';
      var oid = getOidFromHref(rawHref);
      var status = txt($('td[data-title="Status"]', row));

      var order = {
        row: row,
        orderNumber: txt(link) || txt($('td[data-title="Order #"]', row)) || oid || 'Order',
        oid: oid,
        fullHref: orderDetailsHref(oid),
        status: status || 'Open',
        invoice: txt($('td[data-title="Invoice #"]', row)),
        vehicleTracking: txt($('td[data-title="Vehicle Tracking"]', row)),
        yourRef: txt($('td[data-title="Your Ref"]', row)) || '—',
        jobRef: txt($('td[data-title="Job Ref"]', row)) || '—',
        created: txt($('td[data-title="Created"]', row)) || '—',
        required: txt($('td[data-title="Required"]', row)) || '—',
        subtotal: txt($('td[data-title="Goods Total"]', row)) || '0',
        tax: txt($('td[data-title="Tax"]', row)) || '0',
        total: txt($('td[data-title="Total Amount"]', row)) || txt($('td[data-title="Goods Total"]', row)) || '0',
        lines: txt($('td[data-title="Lines"]', row)) || '0',
        branch: txt($('td[data-title="Branch"]', row)) || '—',
        salesRep: txt($('td[data-title="Sales Rep"]', row)) || '—'
      };

      order.bucketKey = classifyStatus(order.status, order);
      order.bucket = bucketFor(order.bucketKey);
      order.searchText = [
        order.orderNumber,
        order.status,
        order.yourRef,
        order.jobRef,
        order.created,
        order.required,
        order.subtotal,
        order.tax,
        order.total,
        order.lines,
        order.branch,
        order.salesRep,
        order.invoice,
        order.vehicleTracking
      ].join(' ').toLowerCase();

      return order;
    }).sort(function (a, b) {
      var ai = BUCKET_INDEX[a.bucketKey] == null ? 99 : BUCKET_INDEX[a.bucketKey];
      var bi = BUCKET_INDEX[b.bucketKey] == null ? 99 : BUCKET_INDEX[b.bucketKey];
      if (ai !== bi) return ai - bi;
      return String(b.created || '').localeCompare(String(a.created || ''));
    });
  }

  function buildSummary(orders) {
    var counts = orders.reduce(function (acc, order) {
      acc[order.bucketKey] = (acc[order.bucketKey] || 0) + 1;
      return acc;
    }, {});

    var root = dom('<div class="wloo-summary-grid"></div>');
    STATUS_BUCKETS.forEach(function (bucket) {
      root.appendChild(dom(`
        <div class="wloo-summary-card">
          <div class="wloo-summary-label">${escapeHtml(bucket.shortLabel)}</div>
          <div class="wloo-summary-value">${counts[bucket.key] || 0}</div>
        </div>
      `));
    });
    return root;
  }

  function buildStatusTabs(orders) {
    var counts = orders.reduce(function (acc, order) {
      acc[order.bucketKey] = (acc[order.bucketKey] || 0) + 1;
      return acc;
    }, {});

    var root = dom('<div class="wloo-status-tabs" role="tablist"></div>');
    root.appendChild(dom('<button type="button" class="wloo-tab active" data-status-filter="all">All Orders (' + orders.length + ')</button>'));

    STATUS_BUCKETS.forEach(function (bucket) {
      root.appendChild(dom('<button type="button" class="wloo-tab" data-status-filter="' + escapeAttr(bucket.key) + '">' + escapeHtml(bucket.shortLabel) + ' (' + (counts[bucket.key] || 0) + ')</button>'));
    });

    return root;
  }

  function buildTools() {
    return dom(`
      <div class="wloo-tools">
        <div class="wloo-field">
          <label for="wloo-filter">Search open orders</label>
          <input id="wloo-filter" class="wloo-input" type="search" placeholder="Search order #, status, branch, ref, product after opening details...">
        </div>
        <button type="button" class="wloo-btn" id="wloo-clear-filter">Clear Search</button>
      </div>
    `);
  }

  function orderCard(order) {
    var card = dom(`
      <article class="wloo-card" data-status-bucket="${escapeAttr(order.bucketKey)}" data-order-search="${escapeAttr(order.searchText)}">
        <div class="wloo-card-top">
          <div>
            <div class="wloo-order-no">Order #${escapeHtml(order.orderNumber)}</div>
            <div class="wloo-muted">Created ${escapeHtml(order.created)} • Required ${escapeHtml(order.required)}</div>
          </div>
          <span class="wloo-pill ${escapeAttr(order.bucket.pillClass)}">${escapeHtml(order.bucket.shortLabel)}</span>
        </div>

        <div class="wloo-money">
          <div class="wloo-money-box"><div class="wloo-money-label">Subtotal</div><div class="wloo-money-value">${escapeHtml(money(order.subtotal))}</div></div>
          <div class="wloo-money-box"><div class="wloo-money-label">Tax</div><div class="wloo-money-value">${escapeHtml(money(order.tax))}</div></div>
          <div class="wloo-money-box"><div class="wloo-money-label">Total</div><div class="wloo-money-value">${escapeHtml(money(order.total))}</div></div>
        </div>

        <div class="wloo-info-grid">
          <div><strong>Status:</strong> ${escapeHtml(order.status)}</div>
          <div><strong>Lines:</strong> ${escapeHtml(order.lines)}</div>
          <div><strong>Branch:</strong> ${escapeHtml(order.branch)}</div>
          <div><strong>Sales Rep:</strong> ${escapeHtml(order.salesRep)}</div>
          <div><strong>Your Ref:</strong> ${escapeHtml(order.yourRef)}</div>
          <div><strong>Job Ref:</strong> ${escapeHtml(order.jobRef)}</div>
        </div>

        <div class="wloo-note">${escapeHtml(order.bucket.help)}</div>

        <div class="wloo-card-actions">
          <button type="button" class="wloo-btn wloo-btn-primary" data-open-order="${escapeAttr(order.oid)}">View Details</button>
          <a class="wloo-btn" href="${escapeAttr(order.fullHref)}">Open Full Order</a>
        </div>
      </article>
    `);
    return card;
  }

  function buildOrderSection(bucket, orders) {
    var section = dom(`
      <section class="wloo-panel" data-section-bucket="${escapeAttr(bucket.key)}">
        <div class="wloo-panel-head">
          <div>
            <div class="wloo-panel-title">${escapeHtml(bucket.title)}</div>
            <div class="wloo-panel-meta">${escapeHtml(bucket.help)}</div>
          </div>
          <div class="wloo-panel-meta">${orders.length} order${orders.length === 1 ? '' : 's'}</div>
        </div>
        <div class="wloo-panel-body">
          <div class="wloo-grid"></div>
        </div>
      </section>
    `);

    var grid = $('.wloo-grid', section);
    if (!orders.length) {
      grid.replaceWith(dom('<div class="wloo-empty">No orders currently fall into this status.</div>'));
    } else {
      orders.forEach(function (order) {
        grid.appendChild(orderCard(order));
      });
    }

    return section;
  }

  function findOrderDetailsTable(doc) {
    var candidates = $$('.rgMasterTable', doc);
    return candidates.filter(function (table) {
      return /Product Code/i.test(txt(table)) && /Description/i.test(txt(table));
    })[0] ||
      $('#ctl00_PageBody_ctl02_OrderDetailsGrid_ctl00', doc) ||
      $('#ctl00_PageBody_ctl00_OrderDetailsGrid_ctl00', doc) ||
      $('#ctl00_PageBody_ctl02_OrderDetailsGrid .rgMasterTable', doc) ||
      $('#ctl00_PageBody_ctl00_OrderDetailsGrid .rgMasterTable', doc);
  }

  function parseOrderLinesFromDoc(doc) {
    var table = findOrderDetailsTable(doc);
    var lines = [];
    var upsNumbers = [];
    var UPS_RX = /^1Z[0-9A-Z]{16}$/i;

    if (!table) return { lines: lines, upsNumbers: upsNumbers };

    $$('tbody tr, tr', table).forEach(function (row) {
      if (row.querySelector('th')) return;
      var cells = $$('td', row);
      if (!cells.length) return;

      var codeEl = $('td[data-title="Product Code"]', row) || cells[0];
      var descEl = $('td[data-title="Description"]', row) || cells[1];
      var qtyEl = $('td[data-title="Quantity"]', row) || $('td[data-title="Qty"]', row) || cells[2];
      var priceEl = $('td[data-title="Price"]', row) || $('td[data-title="Net Price"]', row);

      var code = txt(codeEl);
      var desc = txt(descEl);
      var qty = txt(qtyEl);
      var price = txt(priceEl);
      if (!code && !desc) return;

      if (code.toUpperCase() === 'UPS') {
        var raw = desc.replace(/\s+/g, '').toUpperCase();
        if (raw && (UPS_RX.test(raw) || raw.length >= 8)) upsNumbers.push(raw);
        return;
      }

      lines.push({ code: code, description: desc, qty: qty, price: price });
    });

    return { lines: lines, upsNumbers: upsNumbers };
  }

  function upsUrl(number) {
    return 'https://www.ups.com/track?tracknum=' + encodeURIComponent(number);
  }

  async function fetchOrderDetails(order) {
    var html = await fetch(order.fullHref, { credentials: 'same-origin', cache: 'no-cache' }).then(function (response) {
      if (!response.ok) throw new Error('Order details request failed: ' + response.status);
      return response.text();
    });

    var doc = new DOMParser().parseFromString(html, 'text/html');
    return parseOrderLinesFromDoc(doc);
  }

  function openOrderModal(order) {
    var existing = $('#wloo-detail-modal');
    if (existing) existing.remove();

    var modal = dom(`
      <div class="wloo-modal open" id="wloo-detail-modal" role="dialog" aria-modal="true" aria-labelledby="wloo-modal-title">
        <div class="wloo-modal-card">
          <div class="wloo-modal-head">
            <div>
              <div class="wloo-modal-title" id="wloo-modal-title">Order #${escapeHtml(order.orderNumber)}</div>
              <div class="wloo-modal-subtitle">${escapeHtml(order.bucket.shortLabel)} • ${escapeHtml(order.branch)} • Total ${escapeHtml(money(order.total))}</div>
            </div>
            <button type="button" class="wloo-modal-close" id="wloo-modal-close">Close</button>
          </div>
          <div class="wloo-modal-body">
            <div class="wloo-loading">Loading order details…</div>
          </div>
        </div>
      </div>
    `);

    document.body.appendChild(modal);

    function closeModal() {
      modal.classList.remove('open');
      setTimeout(function () { modal.remove(); }, 160);
    }

    $('#wloo-modal-close', modal).addEventListener('click', closeModal);
    modal.addEventListener('click', function (event) {
      if (event.target === modal) closeModal();
    });

    var keyHandler = function (event) {
      if (event.key === 'Escape' && modal.classList.contains('open')) {
        closeModal();
        document.removeEventListener('keydown', keyHandler);
      }
    };
    document.addEventListener('keydown', keyHandler);

    fetchOrderDetails(order).then(function (detail) {
      var body = $('.wloo-modal-body', modal);
      var trackingHtml = detail.upsNumbers.length ? `
        <div class="wloo-tracking-pills">
          ${detail.upsNumbers.map(function (n) {
            return '<a class="wloo-track-pill" href="' + escapeAttr(upsUrl(n)) + '" target="_blank" rel="noopener">UPS · ' + escapeHtml(n) + '</a>';
          }).join('')}
        </div>
      ` : '';

      body.innerHTML = `
        <div class="wloo-summary-grid">
          <div class="wloo-summary-card"><div class="wloo-summary-label">Status</div><div class="wloo-summary-value" style="font-size:1rem">${escapeHtml(order.status)}</div></div>
          <div class="wloo-summary-card"><div class="wloo-summary-label">Required</div><div class="wloo-summary-value" style="font-size:1rem">${escapeHtml(order.required)}</div></div>
          <div class="wloo-summary-card"><div class="wloo-summary-label">Total</div><div class="wloo-summary-value" style="font-size:1rem">${escapeHtml(money(order.total))}</div></div>
          <div class="wloo-summary-card"><div class="wloo-summary-label">Branch</div><div class="wloo-summary-value" style="font-size:1rem">${escapeHtml(order.branch)}</div></div>
        </div>
        ${trackingHtml}
        <div class="wloo-lines"></div>
        <div class="wloo-actions" style="margin-top:12px;justify-content:flex-start">
          <a class="wloo-btn wloo-btn-primary" href="${escapeAttr(order.fullHref)}">Open Full Order Page</a>
        </div>
      `;

      var linesWrap = $('.wloo-lines', body);
      if (!detail.lines.length) {
        linesWrap.appendChild(dom('<div class="wloo-empty">No line items were found for this order.</div>'));
        return;
      }

      detail.lines.forEach(function (line) {
        linesWrap.appendChild(dom(`
          <div class="wloo-line">
            <div class="wloo-line-code">${escapeHtml(line.code || '—')}</div>
            <div>
              <div class="wloo-line-desc">${escapeHtml(line.description || '—')}</div>
              ${line.qty ? '<div class="wloo-line-meta">Qty: ' + escapeHtml(line.qty) + '</div>' : ''}
            </div>
            <div class="wloo-line-price">${line.price ? escapeHtml(money(line.price)) : ''}</div>
          </div>
        `));
      });
    }).catch(function (err) {
      console.error(err);
      $('.wloo-modal-body', modal).innerHTML = `
        <div class="wloo-error">
          Sorry, we could not load the order details in this view. You can still open the full order page.
        </div>
        <div class="wloo-actions" style="margin-top:12px;justify-content:flex-start">
          <a class="wloo-btn wloo-btn-primary" href="${escapeAttr(order.fullHref)}">Open Full Order Page</a>
        </div>
      `;
    });
  }

  async function renderTrackingOverlay() {
    var params = new URLSearchParams(window.location.search || '');
    var trackingParam = params.get('tracking');
    if (!trackingParam) return false;

    // Block the older Tracking.js overlay if this rewrite is loaded first.
    window.__WL_TRACKING_VIEW__ = true;
    $$('.wl-tracking-overlay').forEach(function (el) { el.remove(); });

    var oid = params.get('oid') || '';
    var explicitNumber = trackingParam && trackingParam.toLowerCase() !== 'yes' ? trackingParam.trim() : '';
    var overlay = dom(`
      <div class="wloo-track-overlay">
        <div class="wloo-track-card">
          <div class="wloo-track-title">Track your shipment</div>
          <div class="wloo-track-sub">${oid ? 'Order ID ' + escapeHtml(oid) : 'Shipment tracking'}</div>
          <div class="wloo-loading" style="margin-top:14px">Looking for tracking on your order…</div>
        </div>
      </div>
    `);
    document.body.appendChild(overlay);

    var numbers = [];
    if (explicitNumber) {
      numbers = [explicitNumber];
    } else if (oid) {
      try {
        var parsed = await fetchOrderDetails({ fullHref: orderDetailsHref(oid) });
        numbers = parsed.upsNumbers || [];
      } catch (err) {
        console.warn('Tracking lookup failed', err);
      }
    } else {
      numbers = parseOrderLinesFromDoc(document).upsNumbers || [];
    }

    var card = $('.wloo-track-card', overlay);
    card.innerHTML = `
      <div class="wloo-track-title">Track your shipment</div>
      <div class="wloo-track-sub">${oid ? 'Order ID ' + escapeHtml(oid) : 'Shipment tracking'}</div>
      ${numbers.length ? `
        <div class="wloo-track-list">
          ${numbers.map(function (n) {
            return '<div class="wloo-track-line"><div class="wloo-track-num">UPS ' + escapeHtml(n) + '</div><a class="wloo-btn wloo-btn-primary" target="_blank" rel="noopener" href="' + escapeAttr(upsUrl(n)) + '">View status on UPS</a></div>';
          }).join('')}
        </div>
      ` : `
        <div class="wloo-empty" style="margin-top:14px;text-align:left">
          We do not see a tracking number on this order yet. If you just received this link, give it a little time or contact us and we will check for you.
        </div>
      `}
      <div class="wloo-actions" style="margin-top:16px;justify-content:flex-start">
        <a class="wloo-btn" href="OpenOrders_r.aspx">Back to Orders</a>
      </div>
    `;

    return true;
  }


  function removeEmptyStatusSections() {
    document.querySelectorAll('.wloo-panel, .wlo-panel, .wl-orders-panel, section').forEach(function(section) {
      var titleText = (section.textContent || '').replace(/\s+/g, ' ').trim();
      var isStatusSection =
        /Waiting for Stock|Being Prepared|Delivery Status|Ready for Pickup|Other Open Orders/i.test(titleText);
      var hasOrderCards =
        section.querySelector('.wloo-card, .wlo-card, .wl-order-card, [data-order-search], [data-order-card]');
      var hasEmptyLanguage =
        /No .*orders|No orders|0 orders/i.test(titleText);

      if (isStatusSection && !hasOrderCards && hasEmptyLanguage) {
        section.remove();
      }
    });
  }

  function buildUI() {
    injectStyles();

    var host = getHost();
    if (!host) return;

    var existing = $('#wloo-root');
    if (existing) existing.remove();

    var orders = parseOrders();

    var root = dom(`
      <div class="wloo-root" id="wloo-root">
        <div class="wloo-top">
          <div class="wloo-menu-wrap">
            <button type="button" class="wloo-menu-btn" aria-expanded="false" aria-controls="wloo-menu">☰ Menu</button>
            <div class="wloo-title-wrap">
              <div class="wloo-title">Open Orders</div>
              <div class="wloo-subtitle">Track order progress by status, view details, and check delivery or pickup readiness.</div>
            </div>
            <div class="wloo-menu" id="wloo-menu" role="menu"></div>
          </div>
          <div class="wloo-actions">
            <a class="wloo-btn" href="AccountInfo_R.aspx">Account Dashboard</a>
          </div>
        </div>
        <div id="wloo-content"></div>
      </div>
    `);

    buildMenu(root);

    var content = $('#wloo-content', root);
    content.appendChild(buildSummary(orders));
    content.appendChild(buildTools());
    content.appendChild(buildStatusTabs(orders));

    STATUS_BUCKETS.forEach(function (bucket) {
      var bucketOrders = orders.filter(function (order) { return order.bucketKey === bucket.key; });
      if (bucketOrders.length || orders.length <= 5) {
        (function(section){ if (section) content.appendChild(section); })(buildOrderSection(bucket, bucketOrders));
      }
    });

    if (!orders.length) {
      content.appendChild(dom('<div class="wloo-empty">No open orders were found.</div>'));
    }

    var firstContainer = $('.bodyFlexContainer', host) || host.firstChild;
    host.insertBefore(root, firstContainer);

    var activeStatus = 'all';
    var filterText = '';

    function applyFilters() {
      filterText = String($('#wloo-filter', root).value || '').trim().toLowerCase();
      var visibleBySection = {};

      $$('.wloo-card', root).forEach(function (card) {
        var bucket = card.getAttribute('data-status-bucket') || 'other';
        var hay = card.getAttribute('data-order-search') || '';
        var statusMatch = activeStatus === 'all' || bucket === activeStatus;
        var textMatch = !filterText || hay.indexOf(filterText) >= 0;
        var show = statusMatch && textMatch;
        card.style.display = show ? '' : 'none';
        if (show) visibleBySection[bucket] = (visibleBySection[bucket] || 0) + 1;
      });

      $$('[data-section-bucket]', root).forEach(function (section) {
        var key = section.getAttribute('data-section-bucket');
        var hasAnyCards = !!$('.wloo-card', section);
        section.style.display = !hasAnyCards || visibleBySection[key] ? '' : 'none';
      });
    }

    $('#wloo-filter', root).addEventListener('input', applyFilters);
    $('#wloo-clear-filter', root).addEventListener('click', function () {
      $('#wloo-filter', root).value = '';
      applyFilters();
      $('#wloo-filter', root).focus();
    });

    $$('.wloo-tab', root).forEach(function (tab) {
      tab.addEventListener('click', function () {
        $$('.wloo-tab', root).forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        activeStatus = tab.getAttribute('data-status-filter') || 'all';
        applyFilters();
      });
    });

    $$('.wloo-card [data-open-order]', root).forEach(function (button) {
      button.addEventListener('click', function () {
        var oid = button.getAttribute('data-open-order');
        var order = orders.filter(function (o) { return o.oid === oid; })[0];
        if (order) openOrderModal(order);
      });
    });

    hideLegacy();

    document.title = (document.title || '').replace(/Open Orders/ig, 'Open Orders');
  }

  function hideLegacy() {
    var legacyNav = $('#ctl00_LeftSidebarContents_MainNav_NavigationMenu');
    if (legacyNav) legacyNav.classList.add('wloo-hide');

    [
      '#ctl00_PageBody_Panel1',
      '#ctl00_PageBody_OrdersGrid',
      '.paging-control',
      '.wl-row-head',
      '.wl-details'
    ].forEach(function (selector) {
      $$(selector).forEach(function (el) { el.classList.add('wloo-hide'); });
    });

    $$('.bodyFlexItem.listPageHeader').forEach(function (header) {
      if (/Open Orders/i.test(txt(header))) header.classList.add('wloo-hide');
    });
  }

  ready(async function () {
    injectStyles();

    if (await renderTrackingOverlay()) return;
    if (maybeNormalizeOpenOrdersUrl()) return;

    buildUI();
    removeEmptyStatusSections();
    window.setTimeout(function () {
      if (!$('#wloo-root')) buildUI();
      removeEmptyStatusSections();
    }, 600);
    window.setTimeout(removeEmptyStatusSections, 900);
  });
})();
