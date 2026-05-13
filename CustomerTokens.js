/* ==========================================================
   Woodson — Stored Payment Tokens (CustomerTokens.aspx)
   v1.0 — split Cards vs Banking, modern token tiles,
          AccountInfo-style menu, modern edit/remove actions
   ========================================================== */
(function () {
  'use strict';

  if (!/CustomerTokens\.aspx/i.test(location.pathname)) return;

  const BRAND = {
    primary: '#6b0016',
    primaryHover: '#540011',
    bgSoft: '#fbf5f6',
    border: '#e6e6e6',
    muted: '#6f6264'
  };

  const SELECTORS = {
    leftNav: '#ctl00_LeftSidebarContents_MainNav_NavigationMenu',
    grid: '#ctl00_PageBody_CustomerCardsGrid',
    table: '#ctl00_PageBody_CustomerCardsGrid_ctl00',
    addCard: '#ctl00_PageBody_AddCardButton',
    addCheck: '#ctl00_PageBody_AddCheckButton',
    back: '#ctl00_PageBody_BackButton',
    bodyFlex: '.bodyFlexContainer',
    legacyHeader: '.bodyFlexItem.listPageHeader'
  };

  const CARD_TYPE_LABELS = {
    VI: 'Visa',
    VISA: 'Visa',
    MC: 'Mastercard',
    MASTERCARD: 'Mastercard',
    AX: 'American Express',
    AMEX: 'American Express',
    AMERICANEXPRESS: 'American Express',
    DISC: 'Discover',
    DS: 'Discover',
    DISCOVER: 'Discover',
    DC: 'Diners Club',
    CB: 'Carte Blanche',
    JCB: 'JCB'
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const txt = (el) => (el?.textContent || '').replace(/\u00a0/g, ' ').trim();
  const dom = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
  const cssEscape = (value) => (window.CSS && typeof window.CSS.escape === 'function')
    ? window.CSS.escape(String(value))
    : String(value).replace(/"/g, '\"');

  function waitFor(sel, { timeout = 5000, interval = 100 } = {}) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        const el = $(sel);
        if (el) return resolve(el);
        if (Date.now() - start >= timeout) return reject(new Error(`Timed out waiting for ${sel}`));
        setTimeout(tick, interval);
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tick, { once: true });
      } else {
        tick();
      }
    });
  }

  function cleanCardType(value) {
    return String(value || '').replace(/\s+/g, '').toUpperCase();
  }

  function cardTypeLabel(value) {
    const key = cleanCardType(value);
    if (!key) return 'Card';
    return CARD_TYPE_LABELS[key] || value || 'Card';
  }

  function isBankingToken(row, typeRaw, editLink) {
    const type = String(typeRaw || '').toLowerCase();
    const href = String(editLink?.getAttribute('href') || '').toLowerCase();
    return /check|ach|bank/.test(type) || /customercheck\.aspx/.test(href);
  }

  function getCell(row, title) {
    const direct = row.querySelector(`td[data-title="${cssEscape(title)}"]`);
    if (direct) return txt(direct);

    // Fallback by table header position in case data-title is missing in a future WebTrack update.
    const table = row.closest('table');
    const headers = table ? $$('thead th', table).map(th => txt(th).toLowerCase()) : [];
    const index = headers.findIndex(h => h === String(title).toLowerCase());
    return index >= 0 ? txt(row.children[index]) : '';
  }

  function tokenTail(token) {
    const raw = String(token || '').replace(/\s+/g, '');
    if (!raw) return '';

    // Preferred: last visible alphanumeric characters after the mask.
    const visible = raw.replace(/[\*•xX]/g, '');
    if (visible.length >= 4) return visible.slice(-4);

    // Fallback: last 4 characters from the raw token string.
    const match = raw.match(/([A-Za-z0-9]{1,4})$/);
    return match ? match[1] : raw.slice(-4);
  }

  function maskedEnding(token) {
    const last = tokenTail(token);
    return last ? `•••• ${last}` : 'Token saved';
  }

  function parseExpiry(value) {
    const m = String(value || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return null;
    return new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]), 23, 59, 59);
  }

  function expiryStatus(value) {
    const d = parseExpiry(value);
    if (!d) return '';
    return d < new Date() ? 'Expired' : 'Active';
  }

  function cloneActionLink(source, type) {
    if (!source) return null;

    const link = source.cloneNode(true);
    link.removeAttribute('id');
    link.className = `wl-token-action ${type}`;
    link.innerHTML = type === 'edit'
      ? '<span class="wl-action-icon" aria-hidden="true">✎</span><span>Edit information</span>'
      : '<span class="wl-action-icon" aria-hidden="true">×</span><span>Remove</span>';

    // Keep any existing WebForms href / inline onclick behavior intact.
    return link;
  }

  function parseTokens() {
    const table = $(SELECTORS.table);
    if (!table) return [];

    return $$('tbody tr', table)
      .filter(row => row.querySelector('td'))
      .map((row, index) => {
        const actionCell = row.querySelector('td[data-title=""], td:first-child');
        const editLink = actionCell?.querySelector('a[href*="action=EDIT"], a[id*="Edit"]') || null;
        const deleteLink = actionCell?.querySelector('a[onclick*="PromptDeleteCard"], a[id*="Delete"], a[href^="javascript:__doPostBack"]') || null;
        const typeRaw = getCell(row, 'Card Type');
        const kind = isBankingToken(row, typeRaw, editLink) ? 'bank' : 'card';

        return {
          index,
          kind,
          name: getCell(row, 'Name') || (kind === 'bank' ? 'Bank Account' : 'Saved Card'),
          token: getCell(row, 'Stored Payment Token'),
          expiry: getCell(row, 'Token Expiry Date'),
          contact: getCell(row, 'Contact Name'),
          zip: getCell(row, 'ZIP Code'),
          typeRaw,
          editLink,
          deleteLink
        };
      });
  }

  function addStyles() {
    if ($('#wl-customer-tokens-style')) return;

    document.head.appendChild(dom(`<style id="wl-customer-tokens-style">
      .wl-tokens-root, .wl-tokens-root * { box-sizing: border-box; }
      .wl-tokens-root {
        width: 100%;
        font-family: system-ui, Segoe UI, Roboto, Arial, sans-serif;
        color: #201a1b;
      }

      .wl-top {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin: 6px 0 16px;
      }
      .wl-ham { display: inline-flex; align-items: center; gap: 10px; min-width: 0; }
      .wl-title-wrap { min-width: 0; }
      .wl-title {
        font-size: 1.25rem;
        line-height: 1.15;
        font-weight: 850;
        color: ${BRAND.primary};
      }
      .wl-subtitle {
        margin-top: 3px;
        color: ${BRAND.muted};
        font-size: .92rem;
      }
      .wl-menu-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border: 1px solid ${BRAND.border};
        border-radius: 10px;
        background: #fff;
        cursor: pointer;
        font-weight: 800;
        color: ${BRAND.primary};
      }
      .wl-ham-menu {
        position: absolute;
        left: 8px;
        top: 48px;
        z-index: 7001;
        background: #fff;
        border: 1px solid ${BRAND.border};
        border-radius: 14px;
        box-shadow: 0 12px 30px rgba(0,0,0,.14);
        padding: 8px;
        width: min(390px, 92vw);
        max-height: 0;
        opacity: 0;
        overflow: auto;
        pointer-events: none;
        transition: max-height .24s ease, opacity .18s ease;
      }
      .wl-ham-menu.open { max-height: 70vh; opacity: 1; pointer-events: auto; }
      .wl-ham-menu a {
        display: block;
        padding: 9px 10px;
        border-radius: 10px;
        color: #171415;
        text-decoration: none;
        font-weight: 650;
      }
      .wl-ham-menu a:hover,
      .wl-ham-menu a[aria-current="page"] { background: ${BRAND.bgSoft}; color: ${BRAND.primary}; }

      .wl-token-layout {
        display: grid;
        grid-template-columns: 1.2fr .8fr;
        gap: 14px;
        align-items: start;
      }
      .wl-pay-section {
        background: #fff;
        border: 1px solid ${BRAND.border};
        border-radius: 16px;
        box-shadow: 0 1px 5px rgba(0,0,0,.05);
        overflow: hidden;
        min-width: 0;
      }
      .wl-section-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 14px;
        background: ${BRAND.primary};
        color: #fff;
      }
      .wl-section-title {
        font-size: 1rem;
        font-weight: 850;
        letter-spacing: .2px;
      }
      .wl-section-count {
        margin-top: 2px;
        font-size: .84rem;
        opacity: .86;
      }
      .wl-section-body {
        padding: 14px;
        background: ${BRAND.bgSoft};
      }
      .wl-token-grid {
        display: grid;
        gap: 12px;
      }
      .wl-token-card {
        position: relative;
        overflow: hidden;
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 12px;
        padding: 14px;
        border-radius: 14px;
        border: 1px solid #ead5da;
        background: #fff;
        box-shadow: 0 1px 3px rgba(0,0,0,.04);
        min-width: 0;
      }
      .wl-token-card:before {
        content: "";
        position: absolute;
        inset: 0 auto 0 0;
        width: 5px;
        background: ${BRAND.primary};
      }
      .wl-token-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border-radius: 14px;
        background: ${BRAND.bgSoft};
        color: ${BRAND.primary};
        border: 1px solid #ead5da;
        font-weight: 900;
        font-size: 1.05rem;
      }
      .wl-token-main { min-width: 0; }
      .wl-token-name-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        min-width: 0;
      }
      .wl-token-name {
        min-width: 0;
        font-weight: 850;
        font-size: 1rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .wl-token-pill {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 999px;
        padding: 4px 10px;
        background: #fff;
        border: 1px solid #e0c7cc;
        color: ${BRAND.primary};
        font-size: .78rem;
        font-weight: 850;
        white-space: nowrap;
      }
      .wl-token-number {
        margin-top: 5px;
        color: #342c2e;
        font-size: 1.04rem;
        font-weight: 850;
        letter-spacing: .04em;
      }
      .wl-token-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-top: 9px;
      }
      .wl-token-meta span {
        display: inline-flex;
        align-items: center;
        min-height: 25px;
        border-radius: 999px;
        padding: 3px 9px;
        background: #fff;
        border: 1px solid #eee;
        color: ${BRAND.muted};
        font-size: .8rem;
        font-weight: 650;
      }
      .wl-token-meta span.status-expired {
        color: #8a1c1c;
        border-color: #f1c9c9;
        background: #fff6f6;
      }
      .wl-token-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }
      .wl-token-action,
      .wl-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        min-height: 38px;
        padding: 8px 12px;
        border-radius: 10px;
        border: 1px solid ${BRAND.border};
        background: #fff;
        color: #201a1b;
        text-decoration: none !important;
        cursor: pointer;
        font: inherit;
        font-weight: 800;
        line-height: 1.15;
        white-space: nowrap;
      }
      .wl-token-action:hover,
      .wl-btn:hover { box-shadow: 0 2px 8px rgba(0,0,0,.08); transform: translateY(-1px); }
      .wl-token-action.edit { color: ${BRAND.primary}; border-color: #e2c6cc; }
      .wl-token-action.delete { color: #9a1c1c; border-color: #f0c9c9; }
      .wl-action-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 21px;
        height: 21px;
        border-radius: 999px;
        background: ${BRAND.bgSoft};
        font-weight: 900;
      }
      .wl-token-action.delete .wl-action-icon { background: #fff0f0; }

      .wl-btn.primary {
        background: ${BRAND.primary};
        border-color: ${BRAND.primary};
        color: #fff;
      }
      .wl-btn.primary:hover { background: ${BRAND.primaryHover}; border-color: ${BRAND.primaryHover}; }
      .wl-btn.light-on-dark {
        background: #fff;
        border-color: rgba(255,255,255,.65);
        color: ${BRAND.primary};
      }
      .wl-top-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

      .wl-empty {
        border: 1px dashed #dcc3c8;
        border-radius: 14px;
        background: #fff;
        padding: 18px;
        color: ${BRAND.muted};
        font-weight: 650;
        text-align: center;
      }

      .wl-token-legacy-hide {
        position: absolute !important;
        left: -9999px !important;
        top: auto !important;
        width: 1px !important;
        height: 1px !important;
        overflow: hidden !important;
      }

      @media (max-width: 980px) {
        .wl-token-layout { grid-template-columns: 1fr; }
      }
      @media (max-width: 640px) {
        .wl-top { align-items: flex-start; flex-direction: column; }
        .wl-ham { align-items: flex-start; }
        .wl-section-head { align-items: flex-start; flex-direction: column; }
        .wl-section-head .wl-btn { width: 100%; }
        .wl-token-card { grid-template-columns: 1fr; }
        .wl-token-name-row { flex-direction: column; align-items: flex-start; }
        .wl-token-action, .wl-token-actions .wl-btn { flex: 1 1 100%; }
      }
    </style>`));
  }

  function triggerOriginalButton(button) {
    if (!button) return;
    // Native click keeps WebForms validation/postback wiring intact.
    button.click();
  }

  function createSection({ id, title, count, addLabel, addHandler, items, kind }) {
    const section = dom(`
      <section class="wl-pay-section" id="${id}">
        <div class="wl-section-head">
          <div>
            <div class="wl-section-title">${escapeHtml(title)}</div>
            <div class="wl-section-count">${count} saved ${count === 1 ? 'method' : 'methods'}</div>
          </div>
          <button type="button" class="wl-btn light-on-dark">${escapeHtml(addLabel)}</button>
        </div>
        <div class="wl-section-body">
          <div class="wl-token-grid"></div>
        </div>
      </section>
    `);

    section.querySelector('.wl-section-head .wl-btn').addEventListener('click', addHandler);
    const grid = section.querySelector('.wl-token-grid');

    if (!items.length) {
      grid.appendChild(dom(`<div class="wl-empty">No ${kind === 'bank' ? 'banking accounts' : 'cards'} saved yet.</div>`));
      return section;
    }

    items.forEach(item => grid.appendChild(createTokenTile(item)));
    return section;
  }

  function createTokenTile(item) {
    const isBank = item.kind === 'bank';
    const label = isBank ? 'Bank Account' : cardTypeLabel(item.typeRaw);
    const iconText = isBank ? '🏦' : cardIcon(item.typeRaw);
    const ending = maskedEnding(item.token);
    const status = expiryStatus(item.expiry);
    const statusClass = status === 'Expired' ? 'status-expired' : '';

    const tile = dom(`
      <article class="wl-token-card ${isBank ? 'is-bank' : 'is-card'}">
        <div class="wl-token-icon" aria-hidden="true">${escapeHtml(iconText)}</div>
        <div class="wl-token-main">
          <div class="wl-token-name-row">
            <div class="wl-token-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
            <div class="wl-token-pill">${escapeHtml(label)}</div>
          </div>
          <div class="wl-token-number">${escapeHtml(ending)}</div>
          <div class="wl-token-meta">
            ${item.expiry ? `<span class="${statusClass}">Expires ${escapeHtml(item.expiry)}${status ? ` • ${escapeHtml(status)}` : ''}</span>` : ''}
            ${item.contact ? `<span>Contact: ${escapeHtml(item.contact)}</span>` : ''}
            ${item.zip ? `<span>ZIP: ${escapeHtml(item.zip)}</span>` : ''}
          </div>
          <div class="wl-token-actions"></div>
        </div>
      </article>
    `);

    const actions = tile.querySelector('.wl-token-actions');
    const edit = cloneActionLink(item.editLink, 'edit');
    const del = cloneActionLink(item.deleteLink, 'delete');
    if (edit) actions.appendChild(edit);
    if (del) actions.appendChild(del);

    return tile;
  }

  function cardIcon(typeRaw) {
    const key = cleanCardType(typeRaw);
    if (key === 'VI' || key === 'VISA') return 'V';
    if (key === 'MC' || key === 'MASTERCARD') return 'MC';
    if (key === 'AX' || key === 'AMEX' || key === 'AMERICANEXPRESS') return 'AX';
    if (key === 'DISC' || key === 'DS' || key === 'DISCOVER') return 'D';
    return '💳';
  }

  function buildMenu(root) {
    const leftNav = $(SELECTORS.leftNav);
    const menu = $('.wl-ham-menu', root);
    const btn = $('.wl-menu-btn', root);

    const links = leftNav
      ? $$('.rmRootGroup .rmItem a', leftNav).map(a => [a.href, txt(a)])
      : [
          ['AccountInfo_R.aspx', 'Account Information'],
          ['Quicklists_R.aspx', 'Quicklists'],
          ['OpenQuotes_r.aspx', 'Quotes'],
          ['OpenOrders_r.aspx', 'Orders'],
          ['Invoices_r.aspx', 'Invoices'],
          ['CreditNotes_r.aspx', 'Credit Notes'],
          ['ProductsPurchased_R.aspx', 'Products Purchased'],
          ['Statements_R.aspx', 'Statements'],
          ['AddressList_R.aspx', 'Addresses'],
          ['Contacts_r.aspx', 'Contacts']
        ];

    // Add Payment Methods if it is not present in WebTrack's legacy left nav.
    const hasTokens = links.some(([href, label]) => /CustomerTokens\.aspx/i.test(href) || /payment methods/i.test(label));
    if (!hasTokens) links.splice(1, 0, ['CustomerTokens.aspx', 'Payment Methods']);

    links.forEach(([href, label]) => {
      const a = dom(`<a role="menuitem" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`);
      if (/CustomerTokens\.aspx/i.test(href)) a.setAttribute('aria-current', 'page');
      menu.appendChild(a);
    });

    const toggle = (open) => {
      menu.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggle(!menu.classList.contains('open'));
      return false;
    });

    document.addEventListener('click', (event) => {
      if (!menu.classList.contains('open')) return;
      if (!menu.contains(event.target) && event.target !== btn) toggle(false);
    });
  }

  function hideLegacy() {
    const leftNav = $(SELECTORS.leftNav);
    const grid = $(SELECTORS.grid);
    const addCard = $(SELECTORS.addCard);
    const addCheck = $(SELECTORS.addCheck);
    const header = $(SELECTORS.legacyHeader);

    [leftNav, grid, addCard, addCheck, header].forEach(el => {
      if (el) el.classList.add('wl-token-legacy-hide');
    });

    // Hide the grid's wrapper row if the grid is the main content of that bodyFlexItem.
    const gridWrapper = grid?.closest('.bodyFlexItem');
    if (gridWrapper) gridWrapper.classList.add('wl-token-legacy-hide');
  }

  function init() {
    addStyles();

    const tokens = parseTokens();
    const cards = tokens.filter(t => t.kind === 'card');
    const banks = tokens.filter(t => t.kind === 'bank');

    const addCard = $(SELECTORS.addCard);
    const addCheck = $(SELECTORS.addCheck);
    const back = $(SELECTORS.back);
    const backHref = back?.getAttribute('href') || 'AccountInfo_R.aspx';

    const root = dom(`
      <div class="wl-tokens-root">
        <div class="wl-top">
          <div class="wl-ham">
            <button class="wl-menu-btn" type="button" aria-expanded="false" aria-controls="wl-tokens-menu">☰ Menu</button>
            <div class="wl-title-wrap">
              <div class="wl-title">Payment Methods</div>
              <div class="wl-subtitle">Manage saved cards and bank accounts for faster checkout and account payments.</div>
            </div>
            <div id="wl-tokens-menu" class="wl-ham-menu" role="menu"></div>
          </div>
          <div class="wl-top-actions">
            <a class="wl-btn" href="${escapeHtml(backHref)}">Back to Account</a>
          </div>
        </div>
        <div class="wl-token-layout"></div>
      </div>
    `);

    const layout = $('.wl-token-layout', root);
    layout.appendChild(createSection({
      id: 'wl-card-methods',
      title: 'Cards',
      count: cards.length,
      addLabel: '+ Add Card',
      addHandler: () => triggerOriginalButton(addCard),
      items: cards,
      kind: 'card'
    }));
    layout.appendChild(createSection({
      id: 'wl-bank-methods',
      title: 'Banking / ACH',
      count: banks.length,
      addLabel: '+ Add Bank Account',
      addHandler: () => triggerOriginalButton(addCheck),
      items: banks,
      kind: 'bank'
    }));

    const host = $(SELECTORS.bodyFlex) || $('td.pageContentBody') || $('.col') || document.body;
    host.insertBefore(root, host.firstChild);

    buildMenu(root);
    hideLegacy();
  }

  waitFor(SELECTORS.table, { timeout: 5000 })
    .then(init)
    .catch((error) => {
      console.warn('Woodson CustomerTokens override did not initialize:', error);
    });
})();
