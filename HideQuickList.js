/* ==========================================================
   Woodson — Shopping Lists / Quicklists Override
   Page: Quicklists_R.aspx
   Purpose:
   - Apply Woodson account menu pattern
   - Rename customer-facing "Quicklists" language to "Shopping Lists"
   - Modernize list tiles and selected-list product display
   - Keep "Saved For Later" visible but protect it from list edit/delete
   ========================================================== */
(function () {
  'use strict';

  if (!/Quicklists_R\.aspx/i.test(window.location.pathname)) return;
  if (window.__WL_SHOPPING_LISTS_OVERRIDE__) return;
  window.__WL_SHOPPING_LISTS_OVERRIDE__ = true;

  var BRAND = {
    primary: '#6b0016',
    primaryHover: '#540011',
    bgSoft: '#fbf5f6',
    border: '#e6e6e6',
    text: '#222',
    muted: '#666',
    danger: '#9f1d1d',
    dangerBg: '#fff5f5',
    success: '#2f6b3c',
    successBg: '#f3fbf5'
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
    return ((el && el.textContent) || '').replace(/\s+/g, ' ').trim();
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

  function normalizeMenuLabel(label) {
    label = String(label || '').trim();
    if (/^Quicklists$/i.test(label)) return 'Shopping Lists';
    if (/Customer\s*Cards|Stored\s*Cards/i.test(label)) return 'Payment Methods';
    return label;
  }

  function isSavedForLater(name) {
    return /^Saved\s+For\s+Later$/i.test(String(name || '').trim());
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
    clone.className = className || 'wlql-btn wlql-btn-light';
    clone.innerHTML = escapeHtml(label);
    clone.setAttribute('aria-label', label);

    if (!clone.getAttribute('href') && original.getAttribute('href')) {
      clone.setAttribute('href', original.getAttribute('href'));
    }

    return clone;
  }

  function injectStyles() {
    if ($('#wlql-styles')) return;

    var style = document.createElement('style');
    style.id = 'wlql-styles';
    style.textContent = `
      .wlql-root, .wlql-root * { box-sizing: border-box; }
      .wlql-root {
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        width: 100%;
        color: ${BRAND.text};
      }

      .wlql-hide {
        position: absolute !important;
        left: -9999px !important;
        width: 1px !important;
        height: 1px !important;
        overflow: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      .wlql-top {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin: 8px 0 14px;
      }

      .wlql-title-wrap {
        min-width: 0;
      }

      .wlql-title {
        font-size: 1.22rem;
        line-height: 1.2;
        font-weight: 850;
        color: ${BRAND.primary};
      }

      .wlql-subtitle {
        margin-top: 3px;
        color: ${BRAND.muted};
        font-size: .92rem;
      }

      .wlql-menu-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .wlql-menu-btn {
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

      .wlql-menu-btn:hover {
        background: ${BRAND.bgSoft};
      }

      .wlql-menu {
        position: absolute;
        left: 0;
        top: 46px;
        z-index: 7001;
        width: min(380px, 92vw);
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

      .wlql-menu.open {
        max-height: 70vh;
        opacity: 1;
        pointer-events: auto;
        padding: 8px;
      }

      .wlql-menu a {
        display: block;
        padding: 9px 10px;
        color: #111;
        text-decoration: none;
        border-radius: 9px;
        font-weight: 650;
      }

      .wlql-menu a:hover {
        background: ${BRAND.bgSoft};
        color: ${BRAND.primary};
      }

      .wlql-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        flex-wrap: wrap;
      }

      .wlql-btn {
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

      .wlql-btn:hover {
        background: ${BRAND.bgSoft};
        color: ${BRAND.primary} !important;
      }

      .wlql-btn-primary {
        background: ${BRAND.primary};
        border-color: ${BRAND.primary};
        color: #fff !important;
      }

      .wlql-btn-primary:hover {
        background: ${BRAND.primaryHover};
        border-color: ${BRAND.primaryHover};
        color: #fff !important;
      }

      .wlql-btn-danger {
        background: ${BRAND.dangerBg};
        border-color: #f0caca;
        color: ${BRAND.danger} !important;
      }

      .wlql-btn-danger:hover {
        background: #ffe9e9;
        color: ${BRAND.danger} !important;
      }

      .wlql-btn-small {
        min-height: 34px;
        padding: 8px 10px;
        font-size: .86rem;
      }

      .wlql-search-card,
      .wlql-panel {
        background: #fff;
        border: 1px solid ${BRAND.border};
        border-radius: 14px;
        box-shadow: 0 2px 8px rgba(0,0,0,.05);
        overflow: hidden;
      }

      .wlql-search-card {
        padding: 12px;
        margin-bottom: 14px;
        display: grid;
        grid-template-columns: minmax(240px, 1fr) auto;
        gap: 10px;
        align-items: end;
      }

      .wlql-field label {
        display: block;
        margin-bottom: 6px;
        color: ${BRAND.muted};
        font-weight: 750;
        font-size: .9rem;
      }

      .wlql-input {
        width: 100%;
        min-height: 40px;
        border: 1px solid #ddd;
        border-radius: 10px;
        padding: 9px 11px;
        font: inherit;
        background: #fff;
      }

      .wlql-input:focus {
        outline: 2px solid rgba(107,0,22,.18);
        border-color: ${BRAND.primary};
      }

      .wlql-panel {
        margin-bottom: 14px;
      }

      .wlql-panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        background: ${BRAND.primary};
        color: #fff;
        padding: 11px 14px;
      }

      .wlql-panel-title {
        font-weight: 850;
        letter-spacing: .1px;
      }

      .wlql-panel-meta {
        color: rgba(255,255,255,.88);
        font-size: .88rem;
        white-space: nowrap;
      }

      .wlql-panel-body {
        background: ${BRAND.bgSoft};
        padding: 13px;
      }

      .wlql-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(285px, 1fr));
        gap: 12px;
      }

      .wlql-list-tile {
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

      .wlql-list-top {
        display: flex;
        align-items: flex-start;
        gap: 11px;
        min-width: 0;
      }

      .wlql-icon {
        width: 42px;
        height: 42px;
        flex: 0 0 42px;
        border-radius: 12px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: ${BRAND.bgSoft};
        color: ${BRAND.primary};
        font-size: 1.25rem;
        border: 1px solid #ead4d9;
      }

      .wlql-name {
        font-size: 1rem;
        font-weight: 850;
        color: ${BRAND.primary};
        line-height: 1.22;
        word-break: break-word;
      }

      .wlql-description {
        color: ${BRAND.muted};
        font-size: .9rem;
        margin-top: 3px;
        line-height: 1.35;
        word-break: break-word;
      }

      .wlql-pill-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
      }

      .wlql-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        border: 1px solid #e2c4ca;
        background: #fff;
        color: ${BRAND.primary};
        border-radius: 999px;
        padding: 3px 9px;
        font-size: .78rem;
        font-weight: 800;
        white-space: nowrap;
      }

      .wlql-pill-protected {
        border-color: #d8eadc;
        color: ${BRAND.success};
        background: ${BRAND.successBg};
      }

      .wlql-tile-actions {
        display: flex;
        align-items: center;
        gap: 7px;
        flex-wrap: wrap;
        margin-top: auto;
      }

      .wlql-note {
        font-size: .85rem;
        color: ${BRAND.muted};
        line-height: 1.35;
        background: #fff;
        border: 1px dashed #e6ccd1;
        border-radius: 10px;
        padding: 9px 10px;
      }

      .wlql-empty {
        background: #fff;
        border: 1px dashed #e2c4ca;
        border-radius: 12px;
        padding: 18px;
        color: ${BRAND.muted};
        text-align: center;
      }

      .wlql-products {
        display: grid;
        gap: 10px;
      }

      .wlql-product-row {
        display: grid;
        grid-template-columns: minmax(120px, 170px) minmax(220px, 1fr) auto auto;
        gap: 10px;
        align-items: center;
        background: #fff;
        border: 1px solid #ead4d9;
        border-radius: 12px;
        padding: 11px;
      }

      .wlql-code {
        font-weight: 850;
        color: ${BRAND.primary};
        word-break: break-word;
      }

      .wlql-prod-desc {
        color: #222;
        font-weight: 650;
        line-height: 1.3;
        word-break: break-word;
      }

      .wlql-price {
        font-weight: 850;
        color: #111;
        white-space: nowrap;
        text-align: right;
      }

      .wlql-per {
        color: ${BRAND.muted};
        font-size: .86rem;
        white-space: nowrap;
      }

      .wlql-product-actions {
        grid-column: 1 / -1;
        display: flex;
        justify-content: flex-end;
        gap: 7px;
        flex-wrap: wrap;
      }

      @media (max-width: 760px) {
        .wlql-top {
          align-items: flex-start;
          flex-direction: column;
        }

        .wlql-actions {
          width: 100%;
          justify-content: stretch;
        }

        .wlql-actions .wlql-btn,
        .wlql-search-card .wlql-btn {
          flex: 1 1 auto;
        }

        .wlql-search-card {
          grid-template-columns: 1fr;
        }

        .wlql-panel-head {
          align-items: flex-start;
          flex-direction: column;
        }

        .wlql-panel-meta {
          white-space: normal;
        }

        .wlql-product-row {
          grid-template-columns: 1fr;
        }

        .wlql-price {
          text-align: left;
        }
      }

      @media (max-width: 480px) {
        .wlql-grid {
          grid-template-columns: 1fr;
        }

        .wlql-tile-actions .wlql-btn {
          flex: 1 1 100%;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function getHost() {
    return $('#MainLayoutRow .col') || $('td.pageContentBody') || document.body;
  }

  function buildMenu(root) {
    var menu = $('.wlql-menu', root);
    var legacyNav = $('#ctl00_LeftSidebarContents_MainNav_NavigationMenu');
    var links = [];

    if (legacyNav) {
      $$('.rmRootGroup .rmItem a', legacyNav).forEach(function (a) {
        links.push({
          href: a.getAttribute('href') || a.href || '#',
          label: normalizeMenuLabel(txt(a))
        });
      });
    }

    if (!links.length) {
      links = [
        { href: 'AccountInfo_R.aspx', label: 'Account Information' },
        { href: 'Quicklists_R.aspx', label: 'Shopping Lists' },
        { href: 'OpenQuotes_r.aspx', label: 'Quotes' },
        { href: 'OpenOrders_r.aspx', label: 'Orders' },
        { href: 'Invoices_r.aspx', label: 'Invoices' },
        { href: 'CreditNotes_r.aspx', label: 'Credit Notes' },
        { href: 'ProductsPurchased_R.aspx', label: 'Products Purchased' },
        { href: 'Statements_R.aspx', label: 'Statements' },
        { href: 'CustomerTokens.aspx', label: 'Payment Methods' },
        { href: 'AddressList_R.aspx', label: 'Addresses' },
        { href: 'Contacts_r.aspx', label: 'Contacts' }
      ];
    }

    menu.innerHTML = links.map(function (link) {
      return '<a role="menuitem" href="' + escapeAttr(link.href) + '">' + escapeHtml(link.label) + '</a>';
    }).join('');

    var btn = $('.wlql-menu-btn', root);
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

  function parseQuicklists() {
    var grid = $('#ctl00_PageBody_QuicklistDataGrid');
    if (!grid) return [];

    return $$('tbody tr', grid).filter(function (row) {
      return !row.classList.contains('rgNoRecords') && row.querySelector('td');
    }).map(function (row) {
      var quickCells = $$('td[data-title="Quicklist"]', row);
      var viewLinks = [];
      quickCells.forEach(function (cell) {
        $$('a', cell).forEach(function (a) {
          if (txt(a)) viewLinks.push(a);
        });
      });

      var preferredView = viewLinks.filter(function (a) {
        return /Quicklists_R\.aspx/i.test(a.getAttribute('href') || '');
      })[0] || viewLinks[0] || null;

      var name = txt(preferredView) || txt(quickCells[0]) || 'Shopping List';
      var description = txt($('td[data-title="Description"]', row));
      if (!description || description === '\u00a0') description = '';

      var defaultCell = $('td[data-title="Default"]', row);
      var defaultCheckbox = defaultCell ? $('input[type="checkbox"]', defaultCell) : null;
      var isDefault = !!(defaultCheckbox && defaultCheckbox.checked);

      var actionCell = $('td[data-title=""]', row) || row.lastElementChild;
      var editLink = actionCell ? $('a[id*="EditQuicklistLink"], a[title^="Edit"]', actionCell) : null;
      var deleteLink = actionCell ? $('a[id*="DeleteQuicklistLink"], a[title^="Delete"]', actionCell) : null;

      return {
        row: row,
        name: name,
        description: description,
        viewHref: preferredView ? (preferredView.getAttribute('href') || preferredView.href || '#') : '#',
        isDefault: isDefault,
        isSaved: isSavedForLater(name),
        editLink: editLink,
        deleteLink: deleteLink
      };
    });
  }

  function getSelectedListName() {
    var details = $('#ctl00_PageBody_QuicklistDetailsDiv');
    if (!details) return '';

    var header = $('.listPageHeader', details);
    var headerText = txt(header);
    if (!headerText) return '';

    var match = headerText.match(/Quicklist:\s*(.*?)(?:Export\s+to\s+Excel|$)/i);
    return match ? match[1].trim() : '';
  }

  function parseDetailProducts() {
    var detailGrid = $('#ctl00_PageBody_ctl01_QuicklistDetailGrid');
    if (!detailGrid) return { products: [], emptyMessage: '' };

    var noRecords = $('.rgNoRecords', detailGrid);
    if (noRecords) {
      return {
        products: [],
        emptyMessage: txt(noRecords) || 'This shopping list does not have any products yet.'
      };
    }

    var products = $$('tbody tr', detailGrid).filter(function (row) {
      return !row.classList.contains('rgNoRecords') && row.querySelector('td');
    }).map(function (row) {
      var actionCell = $('td[data-title=""]', row) || row.lastElementChild;
      var removeLink = actionCell ? $('a', actionCell) : null;

      return {
        code: txt($('td[data-title="Product Code"]', row)),
        description: txt($('td[data-title="Description"]', row)),
        price: txt($('td[data-title="Price"]', row)),
        per: txt($('td[data-title="Per"]', row)),
        removeLink: removeLink
      };
    });

    return { products: products, emptyMessage: '' };
  }

  function hideLegacy() {
    var legacyNav = $('#ctl00_LeftSidebarContents_MainNav_NavigationMenu');
    if (legacyNav) legacyNav.classList.add('wlql-hide');

    [
      '#ctl00_PageBody_SearchPanel',
      '#ctl00_PageBody_QuicklistDataGrid',
      '#ctl00_PageBody_QuicklistDetailsDiv'
    ].forEach(function (selector) {
      $$(selector).forEach(function (el) {
        el.classList.add('wlql-hide');
      });
    });

    // Hide the legacy page header that only says "Quicklists"; leave detail/header data available for parsing.
    $$('.bodyFlexItem.listPageHeader').forEach(function (header) {
      if (/^Quicklists$/i.test(txt(header))) header.classList.add('wlql-hide');
    });
  }

  function buildListTile(item) {
    var icon = item.isSaved ? '🛒' : '📝';
    var tile = dom(`
      <article class="wlql-list-tile">
        <div class="wlql-list-top">
          <div class="wlql-icon" aria-hidden="true">${icon}</div>
          <div style="min-width:0;flex:1 1 auto">
            <div class="wlql-name">${escapeHtml(item.name)}</div>
            <div class="wlql-description">${escapeHtml(item.description || (item.isSaved ? 'Items saved from the cart for later purchase.' : 'Customer shopping list.'))}</div>
          </div>
        </div>
        <div class="wlql-pill-row">
          ${item.isSaved ? '<span class="wlql-pill wlql-pill-protected">Protected system list</span>' : '<span class="wlql-pill">Shopping list</span>'}
          ${item.isDefault ? '<span class="wlql-pill">Default</span>' : ''}
        </div>
        ${item.isSaved ? '<div class="wlql-note">Saved For Later is always available for cart items. Customers can view it, but the list name and list deletion controls are locked.</div>' : ''}
        <div class="wlql-tile-actions"></div>
      </article>
    `);

    var actions = $('.wlql-tile-actions', tile);

    var viewBtn = dom('<a class="wlql-btn wlql-btn-primary" href="' + escapeAttr(item.viewHref || '#') + '">View List</a>');
    actions.appendChild(viewBtn);

    if (!item.isSaved) {
      var editBtn = makeActionFromOriginal(item.editLink, 'Edit Info', 'wlql-btn wlql-btn-light');
      var deleteBtn = makeActionFromOriginal(item.deleteLink, 'Remove List', 'wlql-btn wlql-btn-danger');

      if (editBtn) actions.appendChild(editBtn);
      if (deleteBtn) actions.appendChild(deleteBtn);
    }

    return tile;
  }

  function buildProductsPanel(selectedName) {
    var detail = parseDetailProducts();
    var safeName = selectedName || '';
    if (!safeName && !detail.products.length && !detail.emptyMessage) return null;

    var exportBtnOriginal = $('#ctl00_PageBody_ctl01_ExportQuicklistButton');
    var panel = dom(`
      <section class="wlql-panel" id="wlql-detail-panel">
        <div class="wlql-panel-head">
          <div>
            <div class="wlql-panel-title">${safeName ? 'Selected Shopping List: ' + escapeHtml(safeName) : 'Selected Shopping List'}</div>
            ${isSavedForLater(safeName) ? '<div class="wlql-panel-meta">Saved For Later is protected from list edit/delete.</div>' : '<div class="wlql-panel-meta">Products currently saved to this list.</div>'}
          </div>
          <div class="wlql-actions wlql-detail-actions"></div>
        </div>
        <div class="wlql-panel-body">
          <div class="wlql-products"></div>
        </div>
      </section>
    `);

    var detailActions = $('.wlql-detail-actions', panel);
    if (exportBtnOriginal) {
      var exportBtn = makeActionFromOriginal(exportBtnOriginal, 'Export to Excel', 'wlql-btn wlql-btn-light');
      if (exportBtn) detailActions.appendChild(exportBtn);
    }

    var productsWrap = $('.wlql-products', panel);

    if (!detail.products.length) {
      productsWrap.appendChild(dom('<div class="wlql-empty">' + escapeHtml(detail.emptyMessage || 'This shopping list does not have any products yet.') + '</div>'));
      return panel;
    }

    detail.products.forEach(function (product) {
      var row = dom(`
        <div class="wlql-product-row">
          <div class="wlql-code">${escapeHtml(product.code || '—')}</div>
          <div class="wlql-prod-desc">${escapeHtml(product.description || '—')}</div>
          <div class="wlql-price">${escapeHtml(product.price || '')}</div>
          <div class="wlql-per">${escapeHtml(product.per || '')}</div>
          <div class="wlql-product-actions"></div>
        </div>
      `);

      var actions = $('.wlql-product-actions', row);
      var removeBtn = makeActionFromOriginal(product.removeLink, 'Remove Product', 'wlql-btn wlql-btn-small wlql-btn-danger');
      if (removeBtn) actions.appendChild(removeBtn);
      productsWrap.appendChild(row);
    });

    return panel;
  }

  function buildUI() {
    injectStyles();

    var host = getHost();
    if (!host) return;

    var existing = $('#wlql-root');
    if (existing) existing.remove();

    var addOriginal = $('.epi-search-quicklists .epi-search-right');
    var searchOriginal = $('#ctl00_PageBody_ProductSearchTextBox');
    var applyOriginal = $('#ctl00_PageBody_ApplySearchParametersImageButton');
    var items = parseQuicklists();
    var selectedName = getSelectedListName();

    var root = dom(`
      <div class="wlql-root" id="wlql-root">
        <div class="wlql-top">
          <div class="wlql-menu-wrap">
            <button type="button" class="wlql-menu-btn" aria-expanded="false" aria-controls="wlql-menu">☰ Menu</button>
            <div class="wlql-title-wrap">
              <div class="wlql-title">Shopping Lists</div>
              <div class="wlql-subtitle">Save products for later, organize favorites, and quickly return to commonly purchased items.</div>
            </div>
            <div class="wlql-menu" id="wlql-menu" role="menu"></div>
          </div>
          <div class="wlql-actions">
            <button type="button" class="wlql-btn wlql-btn-primary" id="wlql-add-list">+ Add Shopping List</button>
          </div>
        </div>

        <div class="wlql-search-card">
          <div class="wlql-field">
            <label for="wlql-search-input">Search shopping lists by product</label>
            <input type="text" id="wlql-search-input" class="wlql-input" placeholder="Enter a product keyword or code">
          </div>
          <button type="button" class="wlql-btn" id="wlql-search-apply">Search</button>
        </div>

        <section class="wlql-panel">
          <div class="wlql-panel-head">
            <div class="wlql-panel-title">Your Shopping Lists</div>
            <div class="wlql-panel-meta">${items.length} list${items.length === 1 ? '' : 's'}</div>
          </div>
          <div class="wlql-panel-body">
            <div class="wlql-grid" id="wlql-list-grid"></div>
          </div>
        </section>

        <div id="wlql-details-mount"></div>
      </div>
    `);

    var firstBodyContainer = $('.bodyFlexContainer', host);
    if (firstBodyContainer) {
      host.insertBefore(root, firstBodyContainer);
    } else {
      host.insertBefore(root, host.firstChild);
    }

    buildMenu(root);

    var addBtn = $('#wlql-add-list', root);
    if (addOriginal) {
      addBtn.addEventListener('click', function (e) {
        e.preventDefault();
        clickOriginal(addOriginal);
      });
    } else {
      addBtn.addEventListener('click', function () {
        window.location.href = 'Quicklists_R.aspx?addNew=1';
      });
    }

    var customSearch = $('#wlql-search-input', root);
    var customApply = $('#wlql-search-apply', root);

    if (searchOriginal && customSearch) {
      customSearch.value = searchOriginal.value || '';
    }

    function runSearch() {
      if (searchOriginal) searchOriginal.value = customSearch.value || '';
      if (applyOriginal) clickOriginal(applyOriginal);
    }

    customApply.addEventListener('click', function (e) {
      e.preventDefault();
      runSearch();
    });

    customSearch.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        runSearch();
      }
    });

    var grid = $('#wlql-list-grid', root);
    if (!items.length) {
      grid.parentNode.appendChild(dom('<div class="wlql-empty">No shopping lists were found. Create one to start saving products for future orders.</div>'));
      grid.remove();
    } else {
      items.forEach(function (item) {
        grid.appendChild(buildListTile(item));
      });
    }

    var detailsMount = $('#wlql-details-mount', root);
    var detailsPanel = buildProductsPanel(selectedName);
    if (detailsPanel) detailsMount.appendChild(detailsPanel);

    hideLegacy();

    // Customer-facing text cleanup in document title only; legacy DOM remains hidden for WebForms.
    if (/Quicklists/i.test(document.title || '')) {
      document.title = document.title.replace(/Quicklists/ig, 'Shopping Lists');
    }
  }

  ready(function () {
    buildUI();

    // If Telerik/WebForms injects rows after initial ready, rebuild once more.
    window.setTimeout(function () {
      if (!$('#wlql-root')) buildUI();
    }, 600);
  });
})();
