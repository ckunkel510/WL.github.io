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

  const AUTOPAY_ENDPOINT = 'https://wlmarketingdashboard.vercel.app/api/public/autopay-authorizations';
  const AUTOPAY_CONTEXT_KEY = 'wl_autopay_account_context_v1';
  const AUTOPAY_PENDING_KEY = 'wl_autopay_pending_v1';
  const AUTOPAY_ACTIVE_KEY = 'wl_autopay_active_v1';
  const AUTOPAY_ADD_BANK_SESSION_KEY = 'wl_autopay_add_bank_started_v1';
  const AUTOPAY_DAYS = [26, 27, 28, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const AUTOPAY_REQUEST_DAYS = Array.from({ length: 28 }, (_, index) => index + 1);

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

  function safeJsonParse(value, fallback = null) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function readLocalJson(key, fallback = null) {
    try {
      return safeJsonParse(localStorage.getItem(key), fallback);
    } catch {
      return fallback;
    }
  }

  function writeLocalJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function removeLocalItem(key) {
    try {
      localStorage.removeItem(key);
    } catch {}
  }

  function getStoredAutopayRecords() {
    const raw = readLocalJson(AUTOPAY_ACTIVE_KEY, []);
    const records = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    return records.filter(record => record && record.id && record.managementToken);
  }

  function writeStoredAutopayRecords(records) {
    writeLocalJson(AUTOPAY_ACTIVE_KEY, records.filter(record => record && record.id && record.managementToken));
  }

  function isOpenAutopay(record) {
    return record && !/cancelled/i.test(record.authorization?.status || record.status || '');
  }

  function saveAutopayRecord(data) {
    if (!data?.authorization?.id || !data?.managementToken) return;
    const records = getStoredAutopayRecords().filter(record => record.id !== data.authorization.id);
    records.unshift({
      id: data.authorization.id,
      managementToken: data.managementToken,
      authorization: data.authorization,
      savedAt: new Date().toISOString()
    });
    writeStoredAutopayRecords(records.slice(0, 5));
  }

  function updateAutopayRecord(authorization) {
    if (!authorization?.id) return;
    const records = getStoredAutopayRecords().map(record => record.id === authorization.id
      ? { ...record, authorization, savedAt: record.savedAt || new Date().toISOString() }
      : record
    );
    writeStoredAutopayRecords(records);
  }

  function ordinal(day) {
    const n = Number(day);
    if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
    if (n % 10 === 1) return `${n}st`;
    if (n % 10 === 2) return `${n}nd`;
    if (n % 10 === 3) return `${n}rd`;
    return `${n}th`;
  }

  function numericEnding(token) {
    const tail = tokenTail(token);
    return /^\d{4}$/.test(tail) ? tail : '';
  }

  function bankOptionLabel(bank) {
    const ending = numericEnding(bank.token);
    const name = bank.name || 'Saved bank account';
    return ending ? `${name} (bank ending ${ending})` : `${name} (saved ACH)`;
  }

  function statusLabel(value) {
    const clean = String(value || '').replace(/_/g, ' ').trim();
    if (!clean) return 'Pending review';
    return clean.replace(/\b\w/g, ch => ch.toUpperCase());
  }

  function shouldShowAutopay() {
    const params = new URLSearchParams(location.search || '');
    if (params.get('wlAutopay') === '1') return true;
    const pending = readLocalJson(AUTOPAY_PENDING_KEY, null);
    return Boolean(pending?.startedAt && Date.now() - Number(pending.startedAt) < 60 * 60 * 1000);
  }

  function shouldAutoOpenAddBank() {
    const params = new URLSearchParams(location.search || '');
    return params.get('wlAutopayAddBank') === '1';
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
        const token = getCell(row, 'Stored Payment Token');
        const name = getCell(row, 'Name') || (isBankingToken(row, typeRaw, editLink) ? 'Bank Account' : 'Saved Card');
        if (!token && !typeRaw && !editLink && !deleteLink && !name) return null;
        const kind = isBankingToken(row, typeRaw, editLink) ? 'bank' : 'card';

        return {
          index,
          kind,
          name,
          token,
          expiry: getCell(row, 'Token Expiry Date'),
          contact: getCell(row, 'Contact Name'),
          zip: getCell(row, 'ZIP Code'),
          typeRaw,
          editLink,
          deleteLink
        };
      })
      .filter(Boolean)
      .filter(item => item.token || item.typeRaw || item.editLink || item.deleteLink);
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


      .wl-ham-menu-section {
        padding: 4px 0;
      }
      .wl-ham-menu-section + .wl-ham-menu-section {
        border-top: 1px solid #eee;
        margin-top: 4px;
        padding-top: 8px;
      }
      .wl-ham-menu-label {
        padding: 5px 10px 4px;
        color: ${BRAND.muted};
        font-size: .72rem;
        font-weight: 900;
        letter-spacing: .08em;
        text-transform: uppercase;
      }
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

      .wl-autopay-panel {
        margin: 0 0 14px;
        border: 1px solid #e5d6da;
        border-radius: 16px;
        background: #fff;
        box-shadow: 0 1px 6px rgba(0,0,0,.06);
        overflow: hidden;
      }
      .wl-autopay-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 14px;
        background: #201a1b;
        color: #fff;
      }
      .wl-autopay-title {
        font-size: 1.04rem;
        font-weight: 900;
      }
      .wl-autopay-subtitle {
        margin-top: 3px;
        color: rgba(255,255,255,.78);
        font-size: .9rem;
      }
      .wl-autopay-body {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 320px;
        gap: 14px;
        padding: 14px;
        background: ${BRAND.bgSoft};
      }
      .wl-autopay-card {
        min-width: 0;
        border: 1px solid #ead5da;
        border-radius: 14px;
        background: #fff;
        padding: 14px;
      }
      .wl-autopay-card h3 {
        margin: 0;
        color: ${BRAND.primary};
        font-size: 1rem;
      }
      .wl-autopay-note {
        margin-top: 8px;
        color: ${BRAND.muted};
        font-size: .88rem;
        line-height: 1.45;
      }
      .wl-autopay-help {
        display: block;
        margin-top: 6px;
        color: #687176;
        font-size: .8rem;
        font-weight: 700;
        line-height: 1.35;
      }
      .wl-autopay-exception {
        display: none;
        border: 1px solid #ecd49c;
        border-radius: 10px;
        background: #fffaf0;
        padding: 12px;
      }
      .wl-autopay-exception.is-visible {
        display: grid;
      }
      .wl-autopay-exception-note {
        margin-top: 8px;
        color: #60450d;
        font-size: .84rem;
        font-weight: 800;
        line-height: 1.4;
      }
      .wl-autopay-form {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-top: 12px;
      }
      .wl-autopay-field {
        display: grid;
        gap: 5px;
        min-width: 0;
        color: #251f20;
        font-size: .88rem;
        font-weight: 800;
      }
      .wl-autopay-field.full {
        grid-column: 1 / -1;
      }
      .wl-autopay-field input,
      .wl-autopay-field select,
      .wl-autopay-field textarea {
        width: 100%;
        min-height: 40px;
        border: 1px solid #d8c9cc;
        border-radius: 10px;
        background: #fff;
        padding: 9px 10px;
        color: #201a1b;
        font: inherit;
        font-weight: 600;
      }
      .wl-autopay-field textarea {
        min-height: 76px;
        resize: vertical;
      }
      .wl-autopay-check {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        border: 1px solid #eee;
        border-radius: 10px;
        background: #fff;
        padding: 10px;
        color: #3f3839;
        font-size: .85rem;
        line-height: 1.35;
      }
      .wl-autopay-check.full {
        grid-column: 1 / -1;
      }
      .wl-autopay-check input {
        margin-top: 3px;
      }
      .wl-autopay-existing {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-top: 12px;
        border: 1px solid #cbe7d2;
        border-radius: 12px;
        background: #f0faf3;
        padding: 12px;
        color: #1f5f2f;
      }
      .wl-autopay-existing strong,
      .wl-autopay-existing span {
        display: block;
      }
      .wl-autopay-existing span {
        margin-top: 2px;
        color: #426b4c;
        font-size: .86rem;
        font-weight: 650;
      }
      .wl-autopay-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        grid-column: 1 / -1;
      }
      .wl-autopay-status {
        grid-column: 1 / -1;
        display: none;
        border-radius: 10px;
        padding: 10px;
        font-size: .9rem;
        font-weight: 750;
      }
      .wl-autopay-status.ok {
        display: block;
        border: 1px solid #bde5c8;
        background: #effaf2;
        color: #286b37;
      }
      .wl-autopay-status.bad {
        display: block;
        border: 1px solid #efc1c1;
        background: #fff4f4;
        color: #8d1f1f;
      }
      .wl-autopay-summary {
        display: grid;
        gap: 8px;
      }
      .wl-autopay-summary div {
        border: 1px solid #eee;
        border-radius: 10px;
        background: #fff;
        padding: 10px;
      }
      .wl-autopay-summary span {
        display: block;
        color: #706467;
        font-size: .72rem;
        font-weight: 900;
        letter-spacing: .06em;
        text-transform: uppercase;
      }
      .wl-autopay-summary strong {
        display: block;
        margin-top: 3px;
        color: #201a1b;
        font-size: .95rem;
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
        .wl-autopay-body { grid-template-columns: 1fr; }
      }
      @media (max-width: 640px) {
        .wl-top { align-items: flex-start; flex-direction: column; }
        .wl-ham { align-items: flex-start; }
        .wl-section-head { align-items: flex-start; flex-direction: column; }
        .wl-section-head .wl-btn { width: 100%; }
        .wl-token-card { grid-template-columns: 1fr; }
        .wl-token-name-row { flex-direction: column; align-items: flex-start; }
        .wl-token-action, .wl-token-actions .wl-btn { flex: 1 1 100%; }
        .wl-autopay-head { flex-direction: column; }
        .wl-autopay-form { grid-template-columns: 1fr; }
        .wl-autopay-actions .wl-btn { width: 100%; }
        .wl-autopay-existing { align-items: stretch; flex-direction: column; }
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
    const ending = isBank && !numericEnding(item.token) ? 'Saved ACH' : maskedEnding(item.token);
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

  function getAutopayContext() {
    const context = readLocalJson(AUTOPAY_CONTEXT_KEY, {}) || {};
    return {
      accountName: context.accountName || '',
      accountKind: context.accountKind || '',
      termsLabel: context.termsLabel || '',
      statementBalance: context.statementBalance || '',
      lastStatementDate: context.lastStatementDate || '',
      dueDate: context.dueDate || '',
      cycle: context.cycle || 'Statements run on the 26th for the 26th-25th cycle and are generally due on the 10th.',
      source: context.source || 'CustomerTokens.aspx'
    };
  }

  function createAutopayPanel({ banks, addCheck }) {
    const context = getAutopayContext();
    const hasBanks = banks.length > 0;
    const existingRecords = getStoredAutopayRecords().filter(isOpenAutopay);
    const primaryRecord = existingRecords[0] || null;
    const selectedBankOptions = banks.map((bank, index) => {
      const label = bankOptionLabel(bank);
      return `<option value="${index}">${escapeHtml(label)}</option>`;
    }).join('');

    const dayOptions = AUTOPAY_DAYS
      .map(day => `<option value="${day}"${day === 10 ? ' selected' : ''}>${ordinal(day)} of the month</option>`)
      .concat('<option value="request_other">Request another date</option>')
      .join('');
    const requestDayOptions = AUTOPAY_REQUEST_DAYS
      .map(day => `<option value="${day}"${day === 15 ? ' selected' : ''}>${ordinal(day)} of the month</option>`)
      .join('');
    const active = primaryRecord?.authorization || null;
    const activeDay = active?.schedule?.preferredDay || '';
    const activeMethod = active?.paymentMethod?.label || 'Saved bank account';
    const activeEnding = active?.paymentMethod?.ending ? ` ending ${escapeHtml(active.paymentMethod.ending)}` : '';
    const activeScheduleNote = active?.schedule?.requiresApproval
      ? `Requested ${activeDay ? escapeHtml(ordinal(activeDay)) : 'date'} monthly · ${escapeHtml(statusLabel(active.schedule.dateApprovalStatus || 'pending'))}`
      : `${activeDay ? escapeHtml(ordinal(activeDay)) : 'Selected date'} monthly`;

    const panel = dom(`
      <section class="wl-autopay-panel" id="wlAutopayPanel">
        <div class="wl-autopay-head">
          <div>
            <div class="wl-autopay-title">Set up AutoPay</div>
            <div class="wl-autopay-subtitle">Authorize Woodson to process your statement balance in full on the schedule you choose.</div>
          </div>
          <button type="button" class="wl-btn light-on-dark" data-wl-autopay-add-bank>Add Bank Account</button>
        </div>
        <div class="wl-autopay-body">
          <div class="wl-autopay-card">
            <h3>Statement-balance authorization</h3>
            <div class="wl-autopay-note">
              AutoPay pays the full statement balance on the date you select. Standard eligible dates are the 26th-28th or 1st-10th.
            </div>
            ${active ? `
              <div class="wl-autopay-existing" data-wl-autopay-existing>
                <div>
                  <strong>AutoPay request on file</strong>
                  <span>${escapeHtml(statusLabel(active.status))} · ${escapeHtml(activeMethod)}${activeEnding} · ${activeScheduleNote}</span>
                </div>
                <button type="button" class="wl-btn" data-wl-autopay-cancel="${escapeHtml(primaryRecord.id)}">Cancel AutoPay</button>
              </div>
            ` : ''}
            ${!hasBanks ? `
              <div class="wl-empty" style="margin-top:12px;text-align:left">
                Add a bank account first so this AutoPay request can point to the right saved ACH method.
              </div>
            ` : ''}
            <form class="wl-autopay-form" id="wlAutopayForm">
              <label class="wl-autopay-field full">
                Bank account for AutoPay
                <select id="wlAutopayMethod" ${hasBanks ? '' : 'disabled'}>
                  ${hasBanks ? selectedBankOptions : '<option value="">Add a bank account first</option>'}
                </select>
              </label>
              <label class="wl-autopay-field">
                Your name
                <input id="wlAutopayName" type="text" autocomplete="name" placeholder="Authorized signer">
              </label>
              <label class="wl-autopay-field">
                Email for confirmation
                <input id="wlAutopayEmail" type="email" autocomplete="email" placeholder="name@example.com">
              </label>
              <label class="wl-autopay-field">
                Phone
                <input id="wlAutopayPhone" type="tel" autocomplete="tel" placeholder="(###) ###-####">
              </label>
              <label class="wl-autopay-field">
                AutoPay date
                <select id="wlAutopayDay">${dayOptions}</select>
                <span class="wl-autopay-help">Standard dates are available immediately for review. Other dates require Woodson approval.</span>
              </label>
              <label class="wl-autopay-field wl-autopay-exception" data-wl-autopay-exception>
                Requested AutoPay date
                <select id="wlAutopayRequestedDay">${requestDayOptions}</select>
                <span class="wl-autopay-exception-note">
                  Requested dates outside the standard window must be approved by Woodson Lumber. If the request is not approved, the AutoPay may be cancelled.
                </span>
              </label>
              <label class="wl-autopay-field full">
                Notes for Woodson
                <textarea id="wlAutopayNotes" placeholder="Optional: who should be contacted or any account notes."></textarea>
              </label>
              <label class="wl-autopay-check full">
                <input id="wlAutopayConsentBalance" type="checkbox">
                <span>I authorize AutoPay for the full statement balance for this account.</span>
              </label>
              <label class="wl-autopay-check full">
                <input id="wlAutopayConsentPayment" type="checkbox">
                <span>I authorize Woodson Lumber to use the selected saved bank account for approved AutoPay payments.</span>
              </label>
              <label class="wl-autopay-check full">
                <input id="wlAutopayConsentTerms" type="checkbox">
                <span>I understand AutoPay may be cancelled online up to the day before the selected payment date.</span>
              </label>
              <div class="wl-autopay-status" id="wlAutopayStatus" role="status"></div>
              <div class="wl-autopay-actions">
                <button type="submit" class="wl-btn primary" ${hasBanks ? '' : 'disabled'}>Submit AutoPay Request</button>
                <button type="button" class="wl-btn" data-wl-autopay-add-bank>Add another bank account</button>
              </div>
            </form>
          </div>
          <aside class="wl-autopay-summary" aria-label="AutoPay account summary">
            <div><span>Account</span><strong>${escapeHtml(context.accountName || 'Current account')}</strong></div>
            <div><span>Statement balance</span><strong>${escapeHtml(context.statementBalance || 'Statement balance in full')}</strong></div>
            <div><span>Eligible dates</span><strong>26th-28th or 1st-10th</strong></div>
            <div><span>Billing cycle</span><strong>${escapeHtml(context.cycle)}</strong></div>
            ${/cash|test/i.test(context.accountKind || '') ? `<div><span>Test path</span><strong>This account is enabled for rollout testing.</strong></div>` : ''}
          </aside>
        </div>
      </section>
    `);

    $$('[data-wl-autopay-add-bank]', panel).forEach(button => {
      button.addEventListener('click', () => {
        writeLocalJson(AUTOPAY_PENDING_KEY, { startedAt: Date.now(), source: 'CustomerTokens.aspx' });
        triggerOriginalButton(addCheck);
      });
    });

    const form = $('#wlAutopayForm', panel);
    const status = $('#wlAutopayStatus', panel);
    const submit = form?.querySelector('button[type="submit"]');
    const daySelect = $('#wlAutopayDay', panel);
    const exceptionField = $('[data-wl-autopay-exception]', panel);

    function syncRequestedDateField() {
      const show = daySelect?.value === 'request_other';
      if (exceptionField) {
        exceptionField.classList.toggle('is-visible', Boolean(show));
      }
    }

    function setStatus(kind, message) {
      status.className = `wl-autopay-status ${kind}`;
      status.textContent = message;
    }

    async function postAutopayAction(action, record) {
      const response = await fetch(AUTOPAY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          id: record.id,
          managementToken: record.managementToken
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error || 'Unable to update AutoPay.');
      updateAutopayRecord(data.authorization);
      return data.authorization;
    }

    if (primaryRecord) {
      postAutopayAction('status', primaryRecord).catch(() => {});
    }

    daySelect?.addEventListener('change', syncRequestedDateField);
    syncRequestedDateField();

    $$('[data-wl-autopay-cancel]', panel).forEach(button => {
      button.addEventListener('click', async () => {
        const record = getStoredAutopayRecords().find(item => item.id === button.getAttribute('data-wl-autopay-cancel'));
        if (!record) {
          setStatus('bad', 'Could not find the local AutoPay record to cancel.');
          return;
        }

        if (!window.confirm('Cancel this AutoPay request? This can be done online up to the day before the selected payment date.')) {
          return;
        }

        button.disabled = true;
        setStatus('ok', 'Cancelling AutoPay...');

        try {
          const authorization = await postAutopayAction('cancel', record);
          setStatus('ok', 'AutoPay has been cancelled.');
          const existing = panel.querySelector('[data-wl-autopay-existing]');
          if (existing) {
            existing.innerHTML = `<div><strong>AutoPay cancelled</strong><span>${escapeHtml(statusLabel(authorization.status))}</span></div>`;
          }
        } catch (error) {
          button.disabled = false;
          setStatus('bad', error.message || 'Unable to cancel AutoPay.');
        }
      });
    });

    if (form && hasBanks) {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const bank = banks[Number($('#wlAutopayMethod', panel)?.value || 0)];
        if (!bank) {
          setStatus('bad', 'Choose a saved bank account first.');
          return;
        }

        const signerName = $('#wlAutopayName', panel)?.value.trim() || '';
        const email = $('#wlAutopayEmail', panel)?.value.trim() || '';
        const phone = $('#wlAutopayPhone', panel)?.value.trim() || '';
        const dayChoice = $('#wlAutopayDay', panel)?.value || '10';
        const requestedException = dayChoice === 'request_other';
        const scheduleMode = requestedException ? 'requested_exception' : 'fixed_day';
        const preferredDay = requestedException ? ($('#wlAutopayRequestedDay', panel)?.value || '15') : dayChoice;
        const notes = $('#wlAutopayNotes', panel)?.value.trim() || '';
        const consentBalance = $('#wlAutopayConsentBalance', panel)?.checked;
        const consentPayment = $('#wlAutopayConsentPayment', panel)?.checked;
        const consentTerms = $('#wlAutopayConsentTerms', panel)?.checked;

        if (!signerName || !email) {
          setStatus('bad', 'Enter your name and email before submitting.');
          return;
        }

        if (!consentBalance || !consentPayment || !consentTerms) {
          setStatus('bad', 'Please check all AutoPay authorization acknowledgements.');
          return;
        }

        const payload = {
          account: {
            name: context.accountName,
            kind: context.accountKind || 'unknown',
            termsLabel: context.termsLabel,
            statementBalance: context.statementBalance,
            lastStatementDate: context.lastStatementDate,
            dueDate: context.dueDate
          },
          contact: {
            name: signerName,
            email,
            phone
          },
          paymentMethod: {
            kind: 'bank',
            label: bank.name || 'Bank account',
            type: bank.typeRaw || 'Check',
            ending: numericEnding(bank.token),
            expiry: bank.expiry || ''
          },
          schedule: {
            mode: scheduleMode,
            day: preferredDay,
            requestedException,
            requiresApproval: requestedException,
            dateApprovalStatus: requestedException ? 'pending' : 'standard',
            dateApprovalNote: requestedException ? 'Customer requested an AutoPay date outside the standard schedule.' : ''
          },
          consent: {
            statementBalance: true,
            paymentAuthorization: true,
            termsAcknowledged: true,
            signerName
          },
          notes
        };

        submit.disabled = true;
        setStatus('ok', 'Saving your AutoPay authorization request...');

        try {
          const response = await fetch(AUTOPAY_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data.ok === false) throw new Error(data.error || 'Unable to save AutoPay request.');
          saveAutopayRecord(data);
          removeLocalItem(AUTOPAY_PENDING_KEY);
          setStatus('ok', requestedException
            ? 'AutoPay request received. Woodson will review the requested date before it can be processed.'
            : 'AutoPay request received. You can cancel online up to the day before the selected payment date.'
          );
          form.querySelectorAll('input, select, textarea, button').forEach(control => {
            if (!control.matches('[data-wl-autopay-add-bank]')) control.disabled = true;
          });
        } catch (error) {
          submit.disabled = false;
          const message = /failed to fetch/i.test(error.message || '')
            ? 'Unable to reach the AutoPay service. Please try again, or call Woodson so we can help finish the setup.'
            : (error.message || 'Unable to save AutoPay request.');
          setStatus('bad', message);
        }
      });
    }

    if (!hasBanks && shouldAutoOpenAddBank() && addCheck) {
      try {
        if (!sessionStorage.getItem(AUTOPAY_ADD_BANK_SESSION_KEY)) {
          sessionStorage.setItem(AUTOPAY_ADD_BANK_SESSION_KEY, String(Date.now()));
          setTimeout(() => triggerOriginalButton(addCheck), 700);
        }
      } catch {}
    }

    return panel;
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
    const menu = $('.wl-ham-menu', root);
    const btn = $('.wl-menu-btn', root);
    const currentPath = (window.location.pathname || '').split('/').pop().toLowerCase();

    function getStoredCashAccountFlag() {
      try {
        const raw = localStorage.getItem('wl_account_is_cash_v1');
        if (raw === 'true') return true;
        if (raw === 'false') return false;
      } catch (err) {}
      return null;
    }

    const isCashAccount = getStoredCashAccountFlag();
    const paymentHref = 'AccountPayment_r.aspx';
    const paymentLabel = isCashAccount === true ? 'Reload Balance' : (isCashAccount === false ? 'Make a Payment' : 'Make a Payment / Reload Balance');

    let accountSettingLinks = [
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

    const groups = [
      {
        label: '',
        links: [
          ['AccountInfo_R.aspx', 'Account Dashboard']
        ]
      },
      {
        label: 'Transactions',
        links: [
          [paymentHref, paymentLabel],
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

    menu.innerHTML = groups.map(group => {
      const links = group.links.map(([href, label]) => {
        const path = String(href || '').split('?')[0].split('#')[0].split('/').pop().toLowerCase();
        const current = path === currentPath ? ' aria-current="page"' : '';
        const cleanLabel = /^Quicklists$/i.test(label) ? 'Shopping Lists' : label;
        return `<a role="menuitem" href="${escapeHtml(href)}"${current}>${escapeHtml(cleanLabel)}</a>`;
      }).join('');

      return `<div class="wl-ham-menu-section">
        ${group.label ? `<div class="wl-ham-menu-label">${escapeHtml(group.label)}</div>` : ''}
        ${links}
      </div>`;
    }).join('');

    const toggle = (open) => {
      menu.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggle(!menu.classList.contains('open'));
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
    const autopayMode = shouldShowAutopay();
    const hasStoredAutopay = getStoredAutopayRecords().some(isOpenAutopay);

    const root = dom(`
      <div class="wl-tokens-root">
        <div class="wl-top">
          <div class="wl-ham">
            <button class="wl-menu-btn" type="button" aria-expanded="false" aria-controls="wl-tokens-menu">☰ Menu</button>
            <div class="wl-title-wrap">
              <div class="wl-title">${autopayMode ? 'Set up AutoPay' : 'Payment Methods'}</div>
              <div class="wl-subtitle">${autopayMode ? 'Choose a saved bank account and payment date for statement-balance AutoPay.' : 'Manage saved cards and bank accounts for faster checkout and account payments.'}</div>
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
    if (autopayMode) {
      root.insertBefore(createAutopayPanel({ banks, addCheck }), layout);
    }

    if (!autopayMode || hasStoredAutopay) {
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
    } else {
      layout.style.display = 'none';
    }

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
