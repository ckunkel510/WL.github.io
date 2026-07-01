(function () {
  'use strict';

  const cacheBust = Date.now();
  const urls = {
    sale: `https://docs.google.com/spreadsheets/d/e/2PACX-1vS-exMk9OF0fqSsiar-2i0Ui22bZ8t6KWL5x5hkWbd_3NSUuJ6Drz6ycFAj2mmUHVrhT4CDuDFNwaq9/pub?gid=0&single=true&output=csv&t=${cacheBust}`,
    newItem: `https://docs.google.com/spreadsheets/d/e/2PACX-1vS-exMk9OF0fqSsiar-2i0Ui22bZ8t6KWL5x5hkWbd_3NSUuJ6Drz6ycFAj2mmUHVrhT4CDuDFNwaq9/pub?gid=1286930330&single=true&output=csv&t=${cacheBust}`,
    clearance: `https://docs.google.com/spreadsheets/d/e/2PACX-1vS-exMk9OF0fqSsiar-2i0Ui22bZ8t6KWL5x5hkWbd_3NSUuJ6Drz6ycFAj2mmUHVrhT4CDuDFNwaq9/pub?gid=1769959350&single=true&output=csv&t=${cacheBust}`
  };

  function parseCSV(csv) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;

    for (let i = 0; i < String(csv || '').length; i += 1) {
      const ch = csv[i];
      if (ch === '"') {
        if (quoted && csv[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = !quoted;
        }
      } else if (ch === ',' && !quoted) {
        row.push(field.trim());
        field = '';
      } else if ((ch === '\n' || ch === '\r') && !quoted) {
        if (ch === '\r' && csv[i + 1] === '\n') i += 1;
        row.push(field.trim());
        if (row.some(Boolean)) rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }

    row.push(field.trim());
    if (row.some(Boolean)) rows.push(row);
    if (!rows.length) return [];

    const headers = rows.shift().map((header) => String(header || '').trim().toLowerCase());
    return rows.map((values) => {
      const record = {};
      headers.forEach((header, index) => { record[header] = values[index] || ''; });
      return record;
    });
  }

  function parseDate(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const date = iso
      ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 23, 59, 59)
      : us
        ? new Date(Number(us[3]), Number(us[1]) - 1, Number(us[2]), 23, 59, 59)
        : new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function parseMoney(value) {
    const match = String(value || '').replace(/,/g, '').match(/\$?\s*(-?\d+(?:\.\d{1,2})?)/);
    return match ? Number(match[1]) : NaN;
  }

  function formatMoney(value) {
    return `$${Number(value || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  function getPidFromHref(href) {
    try { return new URL(href, location.origin).searchParams.get('pid') || ''; }
    catch (e) { return ''; }
  }

  function injectStyles() {
    if (document.getElementById('wl-promotion-styles')) return;
    const style = document.createElement('style');
    style.id = 'wl-promotion-styles';
    style.textContent = `
      :root { --wl-safety-yellow: #ffcd00; --wl-ink: #151515; }
      .image-with-flags { position: relative !important; max-width: 100%; }
      .wl-savings-flag {
        position: absolute; top: 10px; left: 10px; z-index: 5;
        display: inline-flex; align-items: center; min-height: 32px;
        max-width: calc(100% - 20px); padding: 7px 10px;
        border: 2px solid var(--wl-ink); border-radius: 4px;
        background: var(--wl-safety-yellow); color: var(--wl-ink);
        box-shadow: 0 3px 0 rgba(0,0,0,.18);
        font-size: 12px; font-weight: 900; line-height: 1.1;
        letter-spacing: 0; text-transform: uppercase; white-space: normal;
      }
      .wl-new-flag {
        position: absolute; top: 10px; left: 10px; z-index: 4;
        padding: 7px 10px; border-radius: 4px;
        background: #6b0016; color: #fff;
        font-size: 12px; font-weight: 850; line-height: 1.1;
      }
      #wl-pdp-savings {
        display: grid; grid-template-columns: auto minmax(0,1fr); gap: 2px 12px;
        align-items: center; width: 100%; box-sizing: border-box;
        margin: 2px 0 8px; padding: 12px 14px;
        border: 2px solid var(--wl-ink); border-radius: 6px;
        background: var(--wl-safety-yellow); color: var(--wl-ink);
      }
      #wl-pdp-savings .wl-savings-type {
        grid-row: 1 / span 2; align-self: stretch; display: flex; align-items: center;
        padding-right: 12px; border-right: 2px solid rgba(0,0,0,.45);
        font-size: 12px; font-weight: 950; text-transform: uppercase;
      }
      #wl-pdp-savings .wl-savings-main { font-size: 18px; font-weight: 950; line-height: 1.15; }
      #wl-pdp-savings .wl-savings-meta { font-size: 12px; font-weight: 750; line-height: 1.35; }
      #wl-pdp-savings .wl-savings-meta s { opacity: .72; }
      @media (max-width: 520px) {
        #wl-pdp-savings { grid-template-columns: 1fr; gap: 4px; }
        #wl-pdp-savings .wl-savings-type {
          grid-row: auto; padding: 0 0 6px; border-right: 0; border-bottom: 2px solid rgba(0,0,0,.45);
        }
      }
    `;
    document.head.appendChild(style);
  }

  function promotionFor(pid, data) {
    const clearance = data.clearance.get(pid);
    if (clearance) return { ...clearance, type: 'Clearance' };

    const sale = data.sale.get(pid);
    if (!sale) return null;
    const expires = parseDate(sale.expirationdate);
    if (expires && Date.now() > expires.getTime()) return null;
    return { ...sale, type: 'Sale' };
  }

  function readCurrentPrice(root) {
    const selectors = [
      '.wl-product-price-row',
      '.productPriceSegment',
      '[class*="productPrice"]'
    ];
    for (const selector of selectors) {
      const element = root.querySelector(selector);
      if (!element) continue;
      const amount = parseMoney(element.textContent);
      if (Number.isFinite(amount)) return amount;
    }
    return NaN;
  }

  function ensureImageWrapper(image) {
    if (!image) return null;
    if (image.parentElement?.classList.contains('image-with-flags')) return image.parentElement;
    const wrapper = document.createElement('div');
    wrapper.className = 'image-with-flags';
    image.parentNode?.insertBefore(wrapper, image);
    wrapper.appendChild(image);
    return wrapper;
  }

  function renderListFlags(data) {
    if (!/Products\.aspx/i.test(location.pathname)) return;

    const links = Array.from(document.querySelectorAll('a[href*="ProductDetail.aspx?pid="]'));
    const seen = new Set();
    links.forEach((link) => {
      const pid = getPidFromHref(link.href);
      if (!pid || seen.has(pid)) return;

      const card = link.closest('.wl-product-card') || link.closest('table') || link.closest('fieldset');
      if (!card || card.closest('#WTRelatedProducts')) return;
      const image = card.querySelector('img');
      if (!image) return;
      seen.add(pid);

      const wrapper = ensureImageWrapper(image);
      if (!wrapper) return;
      const promo = promotionFor(pid, data);
      const current = readCurrentPrice(card);
      const was = parseMoney(promo?.wasprice);
      const savings = Number.isFinite(was) && Number.isFinite(current) ? was - current : NaN;

      if (promo && Number.isFinite(savings) && savings > 0.009) {
        wrapper.querySelector('.wl-new-flag')?.remove();
        const text = `Save ${formatMoney(savings)}`;
        const title = `${promo.type}: was ${formatMoney(was)}, now ${formatMoney(current)}`;
        let flag = wrapper.querySelector('.wl-savings-flag');
        if (!flag) {
          flag = document.createElement('span');
          flag.className = 'wl-savings-flag';
          wrapper.appendChild(flag);
        }
        if (flag.textContent !== text) flag.textContent = text;
        if (flag.title !== title) flag.title = title;
      } else if (data.newItems.has(pid)) {
        wrapper.querySelector('.wl-savings-flag')?.remove();
        if (!wrapper.querySelector('.wl-new-flag')) {
          const flag = document.createElement('span');
          flag.className = 'wl-new-flag';
          flag.textContent = 'New';
          wrapper.appendChild(flag);
        }
      } else {
        wrapper.querySelectorAll('.wl-savings-flag, .wl-new-flag').forEach((element) => element.remove());
      }
    });
  }

  function renderDetailSavings(data) {
    if (!/ProductDetail\.aspx/i.test(location.pathname)) return false;
    const pid = new URLSearchParams(location.search).get('pid') || '';
    const promo = promotionFor(pid, data);
    const priceRow = document.querySelector('#product-sidebar .wl-product-price-row, .wl-product-price-row');
    if (!priceRow) return false;

    document.querySelectorAll('#product-image-wrapper .wl-flags').forEach((element) => element.remove());
    const existing = document.getElementById('wl-pdp-savings');
    if (!promo) {
      existing?.remove();
      return true;
    }

    const current = parseMoney(priceRow.textContent);
    const was = parseMoney(promo.wasprice);
    const savings = was - current;
    if (!Number.isFinite(current) || !Number.isFinite(was) || savings <= 0.009) {
      existing?.remove();
      return true;
    }

    const percent = Math.max(1, Math.round((savings / was) * 100));
    const signature = [promo.type, current, was, promo.expirationdate || ''].join('|');
    if (existing?.dataset.signature === signature) return true;
    existing?.remove();
    const panel = document.createElement('div');
    panel.id = 'wl-pdp-savings';
    panel.dataset.signature = signature;
    panel.setAttribute('role', 'status');

    const type = document.createElement('span');
    type.className = 'wl-savings-type';
    type.textContent = promo.type;

    const main = document.createElement('strong');
    main.className = 'wl-savings-main';
    main.textContent = `Save ${formatMoney(savings)} (${percent}% off)`;

    const meta = document.createElement('span');
    meta.className = 'wl-savings-meta';
    const wasText = document.createElement('s');
    wasText.textContent = `Was ${formatMoney(was)}`;
    meta.append(wasText, document.createTextNode(`  Now ${formatMoney(current)}`));
    if (promo.expirationdate) meta.append(document.createTextNode(`  Ends ${promo.expirationdate}`));

    panel.append(type, main, meta);
    priceRow.insertAdjacentElement('afterend', panel);
    return true;
  }

  function removeLegacyFlags() {
    document.querySelectorAll('.wl-flags, .newitem-tag, .Clearance-tag, .clearance-tag, .SaleTag, .sale-tag')
      .forEach((element) => element.remove());
  }

  async function boot() {
    injectStyles();
    try {
      const responses = await Promise.all(Object.values(urls).map((url) => fetch(url, { cache: 'no-store' })));
      if (responses.some((response) => !response.ok)) throw new Error('Promotion data request failed');
      const [saleCSV, newCSV, clearanceCSV] = await Promise.all(responses.map((response) => response.text()));

      const data = {
        sale: new Map(parseCSV(saleCSV).map((row) => [String(row.productid || '').trim(), row])),
        clearance: new Map(parseCSV(clearanceCSV).map((row) => [String(row.productid || '').trim(), row])),
        newItems: new Set(parseCSV(newCSV).map((row) => String(row.productid || '').trim()).filter(Boolean))
      };

      let scheduled = false;
      removeLegacyFlags();
      const render = () => {
        scheduled = false;
        renderListFlags(data);
        renderDetailSavings(data);
      };
      const schedule = () => {
        if (scheduled) return;
        scheduled = true;
        setTimeout(render, 120);
      };

      render();
      setTimeout(render, 900);
      if (/ProductDetail\.aspx/i.test(location.pathname)) {
        let detailAttempts = 0;
        const detailTimer = setInterval(() => {
          detailAttempts += 1;
          if (renderDetailSavings(data) || detailAttempts >= 24) clearInterval(detailTimer);
        }, 250);
      }
      if (/Products\.aspx/i.test(location.pathname)) {
        const observer = new MutationObserver(schedule);
        observer.observe(document.body, { childList: true, subtree: true });
      }
    } catch (error) {
      console.error('[ProductPromotions] Unable to load promotion data:', error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
