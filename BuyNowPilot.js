/* Woodson Buy Now pilot. Native WebTrack forms only. Audience stays ckunkel2. */
(function (root, factory) {
  'use strict';
  var core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else core.boot(root).catch(function () { /* An unavailable pilot leaves native shopping alone. */ });
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  var BUILD = '20261015-ckunkel2-4';
  var ENABLE_NEW_STARTS = true; // Kill switch: recovery remains available when false.
  var USER = 'ckunkel2'; // No query string, storage value, or public rollout override.
  var PREFIX = 'wl_buy_now_pilot_v1:';
  var ORIGIN = 'https://webtrack.woodsonlumber.com';
  var BLOCKLIST_URL = 'https://ckunkel510.github.io/WL.github.io/blocked-products.json';
  var FINAL = '#ctl00_PageBody_CompleteCheckoutButton,#wl-complete,#wl-sticky-complete';
  // Conservative pilot exclusion, checked against ShoppingCartRow's pallet rules in tests.
  var PALLET_PRODUCTS = new Set('23297,22444,23379,24896,25273,25274,26446,26481,94106,12383,24315,24319,122893,25102,4741,12101,21194,23008,23049,20366,20368,21126,12100,2996,3003,21193,26060,133832,25415,2999,4743,21475,4742,25076,25094,23825,23826,23827,113992,113994,23828'.split(','));

  function text(value) { return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  function pidOf(value) { var m = String(value || '').match(/[?&]pid=(\d+)(?:&|$)/i); return m ? m[1] : ''; }
  function targetOf(value) {
    var m = String(value || '').match(/(?:__doPostBack|WebForm_PostBackOptions)\(\s*['"]([^'"]+)['"]/i);
    return m ? m[1] : '';
  }
  function readableCart(page, rowCount) {
    return rowCount > 0 || !!page.querySelector('#ctl00_PageBody_ShoppingCartDetailPanel,.ShoppingCartDetailPanel,#ctl00_PageBody_EmptyCartPanel,#ctl00_PageBody_EmptyCartDetailPanel') || /cart\s+is\s+(?:currently\s+)?empty|no\s+items\s+in\s+(?:your\s+)?(?:shopping\s+)?cart/i.test(page.body.textContent);
  }
  function signedIn(doc) { return !!doc.querySelector('a[href*="SignOut=1"],a[href*="signout=1"]'); }
  function loginFromDocument(doc) {
    if (!signedIn(doc)) return '';
    // Verified native AccountSettings headings, never editable inputs or localStorage.
    var names = Array.from(doc.querySelectorAll('.formPageHeader')).map(function (el) {
      var match = text(el.textContent).match(/^Change (?:password|details) for user\s+['"]([^'"]+)['"]$/i);
      return match ? match[1].toLowerCase() : '';
    }).filter(Boolean);
    return names.length && new Set(names).size === 1 ? names[0] : '';
  }
  function lines(value) {
    if (!Array.isArray(value) || value.length > 60) throw new Error('This cart needs regular checkout.');
    var seen = new Set();
    return value.map(function (row) {
      var item = { pid: String(row.pid || ''), quantity: Number(row.quantity), code: text(row.code), unit: text(row.unit).toLowerCase(), name: text(row.name).slice(0, 180) };
      if (!/^\d+$/.test(item.pid) || seen.has(item.pid) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 9999) {
        throw new Error('This cart has a quantity or configuration that needs regular checkout.');
      }
      if (/epallet|e-pallet|wdoor/i.test(item.code)) throw new Error('Pallet and configured orders need regular checkout during this pilot.');
      if (PALLET_PRODUCTS.has(item.pid)) throw new Error('Pallet-handling products need regular checkout during this pilot.');
      seen.add(item.pid);
      return item;
    });
  }
  function signature(value) {
    return JSON.stringify(lines(value).map(function (row) { return [row.pid, row.quantity, row.code.toUpperCase(), row.unit]; }).sort(function (a, b) { return a[0].localeCompare(b[0]); }));
  }
  function plan(original, primary, selected) {
    var before = lines(original), purchase = lines([primary]), chosen = new Set((selected || []).map(String));
    if (Array.from(chosen).some(function (id) { return !before.some(function (row) { return row.pid === id; }); })) throw new Error('The cart selection changed. Please reopen Buy now.');
    before.forEach(function (row) {
      if (!chosen.has(row.pid)) return;
      var same = purchase.find(function (item) { return item.pid === row.pid; });
      if (same) {
        if (same.unit !== row.unit || same.code.toUpperCase() !== row.code.toUpperCase()) throw new Error('Matching products have different units. Use regular checkout.');
        same.quantity += row.quantity;
      } else purchase.push(Object.assign({}, row));
    });
    return { original: before, purchase: lines(purchase), remaining: before.filter(function (row) { return !chosen.has(row.pid); }) };
  }
  function nextMutation(current, wanted) {
    var have = lines(current), target = lines(wanted);
    var remove = have.find(function (row) { return !target.some(function (item) { return item.pid === row.pid; }); });
    if (remove) return { kind: 'remove', pid: remove.pid, quantity: 0 };
    for (var i = 0; i < target.length; i++) {
      var row = target[i], present = have.find(function (item) { return item.pid === row.pid; });
      if (!present) return { kind: 'add', pid: row.pid, quantity: row.quantity };
      if (present.code.toUpperCase() !== row.code.toUpperCase() || present.unit !== row.unit) throw new Error('A cart product or unit changed. Automatic restoration has stopped.');
      if (present.quantity !== row.quantity) return { kind: 'quantity', pid: row.pid, quantity: row.quantity };
    }
    return null;
  }
  function afterMutation(current, wanted, action) {
    var result = lines(current).filter(function (row) { return row.pid !== action.pid; });
    if (action.kind !== 'remove') result.push(Object.assign({}, lines(wanted).find(function (row) { return row.pid === action.pid; }), { quantity: action.quantity }));
    return lines(result);
  }
  function assertExpected(current, record) {
    var actual = signature(current);
    var allowed = record.pending ? [record.pending.before, record.pending.after] : [signature(record.current)];
    if (!allowed.includes(actual)) throw new Error('The cart changed elsewhere. Your backup is retained; automatic changes have stopped.');
  }
  function recoveryTarget(record) {
    if (['submitting', 'uncertain'].includes(record.phase)) throw new Error('Order status must be checked before restoring or trying again.');
    return lines(record.orderNumber ? record.remaining : record.original);
  }
  function assertReview(review, expected) {
    var normalized = function (items) { return JSON.stringify(items.map(function (row) { return [text(row.code).toUpperCase(), Number(row.quantity), text(row.unit).toLowerCase()]; }).sort(function (a,b) { return JSON.stringify(a).localeCompare(JSON.stringify(b)); })); };
    if (!review.length || normalized(review) !== normalized(lines(expected))) throw new Error('The native order review differs from the Buy now basket. The order was not submitted.');
  }
  function dateChoice(value, min, max) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    var parts = value.split('-').map(Number), date = new Date(parts[0], parts[1]-1, parts[2], 12);
    if (date.getFullYear() !== parts[0] || date.getMonth() !== parts[1]-1 || date.getDate() !== parts[2] || date.getDay() === 0) return false;
    return (!min || value >= min) && (!max || value <= max);
  }
  function firstDate(min, max) {
    var parts = String(min || '').split('-').map(Number);
    if (parts.length !== 3) return '';
    var date = new Date(parts[0], parts[1]-1, parts[2], 12);
    for (var i = 0; i < 16; i++, date.setDate(date.getDate()+1)) {
      var value = [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
      if (dateChoice(value, min, max)) return value;
    }
    return '';
  }
  function money(value) {
    var match = text(value).match(/^\$?\s*(\d+(?:,\d{3})*)(?:\.(\d{2}))?$/);
    return match ? Number(match[1].replace(/,/g,''))*100 + Number(match[2] || 0) : null;
  }
  function reviewTotals(summary) {
    var result = {};
    Array.from(summary.querySelectorAll('table tbody tr')).forEach(function (row) {
      var label = text(row.children[0]?.textContent), value = text(row.querySelector('td.numeric')?.textContent);
      if (/^Subtotal\b/i.test(label)) result.subtotal = value;
      else if (/^Tax$/i.test(label)) result.tax = value;
      else if (/^Total(?:\s+inc\s+Tax)?$/i.test(label)) result.total = value;
      else if (/^(?:Delivery|Shipping)(?:\s|$)/i.test(label)) result.shipping = value;
    });
    if (['subtotal','tax','total'].some(function (key) { return money(result[key]) === null; })) throw new Error('The final total is still loading.');
    return result;
  }
  function marker(record) { return 'Website Buy Now | ' + record.id + ' | Additional cart items: ' + record.extraCount; }
  function savedChoice(options, preferred) {
    var available = options.filter(function (option) { return option.value && !/^(select|choose|please)\b/i.test(text(option.label)); });
    var matches = preferred ? available.filter(function (option) { return option.fingerprint === preferred; }) : [];
    return matches.length === 1 ? matches[0] : available[0] || null;
  }
  function mainAddress(rawLines) {
    var values = (rawLines || []).map(text).filter(Boolean);
    for (var i = 1; i < values.length; i++) {
      var locality = values[i].match(/^(.+?)[,\s]+(Texas|[A-Z]{2})(?:\s*,?\s*(\d{5}(?:-\d{4})?))?$/i);
      if (!locality) continue;
      var zip = locality[3] || (values[i + 1] || '').match(/^\d{5}(?:-\d{4})?$/)?.[0];
      if (!zip) continue;
      var street = values.slice(0, i), start = street.findIndex(function (value) { return /^\d+\b|^P\.?\s*O\.?\s*Box\b/i.test(value); });
      if (start < 0 || street.length - start > 3) return null;
      street = street.slice(start);
      return {line1:street[0],line2:street[1]||'',line3:street[2]||'',city:text(locality[1]).replace(/,$/,''),stateValue:/^Texas$/i.test(locality[2])?'TX':locality[2].toUpperCase(),stateText:locality[2],zip:zip,countryValue:'USA',countryText:'United States'};
    }
    return null;
  }
  function readRecord(storage, key) {
    var raw = storage.getItem(key);
    if (!raw) return null;
    var record;
    try { record = JSON.parse(raw); } catch (_) { throw new Error('The cart recovery record could not be read. Do not start another Buy now.'); }
    if (record.version !== 1 || !/^BN-[a-z0-9-]+$/i.test(record.id || '') || !record.scope) throw new Error('The cart recovery record needs review.');
    if (!['backed_up','preparing','checking_out','submitting','uncertain','confirmed','restoring'].includes(record.phase)) throw new Error('The saved checkout state needs review.');
    lines(record.original); lines(record.purchase); lines(record.remaining); lines(record.current);
    return record;
  }
  function persist(storage, key, record) {
    var serialized = JSON.stringify(record);
    storage.setItem(key, serialized);
    if (storage.getItem(key) !== serialized) throw new Error('A cart backup could not be saved. Buy now has stopped.');
  }

  async function boot(win) {
    if (!win || win.location.origin !== ORIGIN || win.top !== win || win.WLBuyNowPilot) return;
    var doc = win.document;
    if (doc.readyState === 'loading') await new Promise(function (resolve) { doc.addEventListener('DOMContentLoaded', resolve, { once: true }); });
    if (!signedIn(doc)) return;
    var storage = win.localStorage;
    async function fetchDocument(path, options) {
      var url = new URL(path, win.location.href);
      if (url.origin !== ORIGIN) throw new Error('An unexpected checkout destination was blocked.');
      var controller = new win.AbortController(), timeout = win.setTimeout(function () { controller.abort(); }, 20000);
      try {
        var response = await win.fetch(url.href, Object.assign({ credentials: 'same-origin', cache: 'no-store', signal: controller.signal }, options || {}));
        if (!response.ok || new URL(response.url || url.href).origin !== ORIGIN) throw new Error('WebTrack could not confirm the request.');
        return new win.DOMParser().parseFromString(await response.text(), 'text/html');
      } finally { win.clearTimeout(timeout); }
    }
    async function authenticate() {
      var settings = await fetchDocument('/AccountSettings.aspx');
      if (loginFromDocument(settings) !== USER) throw new Error('Buy now is available only for the ckunkel2 pilot. Please sign in again.');
      return settings;
    }
    var settings = await authenticate();
    async function digest(value) {
      var bytes = await win.crypto.subtle.digest('SHA-256', new win.TextEncoder().encode(value));
      return Array.from(new Uint8Array(bytes)).map(function (n) { return n.toString(16).padStart(2, '0'); }).join('');
    }
    // User ID is an isolation key, never proof of authorization. Authenticate above and before mutations.
    var account = await fetchDocument('/AccountInfo_R.aspx');
    var accountHeader = account.querySelector('.panelAccountInfo .listPageHeader,.accountInfoHeader');
    if (!accountHeader || !text(accountHeader.textContent)) throw new Error('The current customer account could not be verified.');
    var scope = await digest(USER + '|' + text(accountHeader.textContent));
    var branch = text(settings.getElementById('ctl00_PageBody_ChangeUserDetailsControl_ddBranch')?.value);
    var key = PREFIX + scope, preferenceKey = PREFIX + 'payment:' + scope;
    var blocked = null;
    var owner = win.crypto.randomUUID(), active = null, overlay = null, frame = null, releaseLock = null;
    var previousFocus = null, previousOverflow = '', busy = false, submitting = false, cancelPending = false, frameObserver = null, frameTimer = null, framePulse = null, permittedFinal = null, fast = null;
    var lockName = PREFIX + 'lock:' + scope;
    var model = { build: BUILD, audience: USER };
    win.WLBuyNowPilot = model;

    async function purchaseRestrictions() {
      var controller = new win.AbortController(), timer = win.setTimeout(function () { controller.abort(); }, 15000);
      try {
        var response = await win.fetch(BLOCKLIST_URL, { credentials: 'omit', cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Purchase eligibility could not be checked. Please use regular checkout.');
        var policy = await response.json();
        if (!Array.isArray(policy.blockedProductIds) || !policy.blockedProductIds.every(function (id) { return /^\d+$/.test(String(id)); })) throw new Error('Purchase eligibility could not be verified.');
        return new Set(policy.blockedProductIds.map(String));
      } finally { win.clearTimeout(timer); }
    }

    async function checkIdentity() {
      var identity = await Promise.all([authenticate(), fetchDocument('/AccountInfo_R.aspx')]);
      var currentSettings = identity[0], fresh = identity[1];
      var header = fresh.querySelector('.panelAccountInfo .listPageHeader,.accountInfoHeader');
      if (!header || await digest(USER + '|' + text(header.textContent)) !== scope) throw new Error('The customer account changed. Cart changes have stopped.');
      var expectedBranch = active ? active.branch : branch;
      if (text(currentSettings.getElementById('ctl00_PageBody_ChangeUserDetailsControl_ddBranch')?.value) !== expectedBranch) throw new Error('Your account branch changed. Return to the original branch before recovering this cart.');
      settings = currentSettings; account = fresh;
    }
    function save() { active.updatedAt = Date.now(); persist(storage, key, active); }
    function record() { var value = readRecord(storage, key); if (value && value.scope !== scope) throw new Error('The recovery account does not match.'); return value; }
    function status(message, error) {
      if (!overlay) return;
      var el = overlay.querySelector('[data-bn-status]');
      el.textContent = message; el.classList.toggle('bn-error', !!error);
      if (error) loading(false);
    }
    function button(label, handler, secondary) {
      var el = doc.createElement('button'); el.type = 'button'; el.className = 'bn-action' + (secondary ? ' bn-secondary' : ''); el.textContent = label;
      el.addEventListener('click', handler); return el;
    }
    function clearFrame() {
      if (frameObserver) frameObserver.disconnect(); frameObserver = null;
      if (frameTimer) win.clearTimeout(frameTimer); frameTimer = null;
      if (framePulse) win.clearInterval(framePulse); framePulse = null;
      if (frame) { frame.remove(); frame = null; }
    }
    function dismiss() {
      clearFrame();
      if (overlay) overlay.remove(); overlay = null;
      doc.body.style.overflow = previousOverflow;
      if (previousFocus && previousFocus.isConnected) previousFocus.focus();
      if (releaseLock) releaseLock(); releaseLock = null;
      active = null; busy = false; submitting = false; cancelPending = false;
      fast = null;
      if (blocked) addButtons();
      else purchaseRestrictions().then(function (ids) { blocked = ids; addButtons(); }).catch(function () {});
    }
    function shell(title) {
      if (overlay) return;
      previousFocus = doc.activeElement; previousOverflow = doc.body.style.overflow;
      overlay = doc.createElement('div'); overlay.id = 'wl-buy-now';
      var panel = doc.createElement('section'); panel.className = 'bn-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'bn-title');
      var head = doc.createElement('div'); head.className = 'bn-head';
      var heading = doc.createElement('h2'); heading.id = 'bn-title'; heading.textContent = title;
      var label = doc.createElement('small'); label.textContent = 'Private pilot';
      var copy = doc.createElement('div'); copy.append(heading, label);
      head.append(copy, button('Cancel', function () { cancel().catch(showError); }, true));
      var message = doc.createElement('div'); message.className = 'bn-progress'; message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite');
      var spinner = doc.createElement('span'); spinner.className = 'bn-spinner'; spinner.setAttribute('aria-hidden','true');
      var statusText = doc.createElement('span'); statusText.dataset.bnStatus = ''; message.append(spinner,statusText);
      var body = doc.createElement('div'); body.className = 'bn-body'; body.dataset.bnBody = '';
      panel.append(head, message, body); overlay.appendChild(panel); doc.body.appendChild(overlay); doc.body.style.overflow = 'hidden';
      overlay.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') { event.preventDefault(); cancel().catch(showError); }
        if (event.key !== 'Tab') return;
        var focusable = Array.from(panel.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select,iframe')).filter(function (el) { return !el.hidden && el.offsetParent && el.tabIndex >= 0 && el.getAttribute('aria-hidden') !== 'true'; });
        if (!focusable.length) return;
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
      });
      head.querySelector('button').focus();
    }
    function showError(error) {
      if (fast) { fast.ready = false; fast.stopped = true; }
      status(error && error.message || 'Buy now stopped. Your recovery copy is retained.', true);
      busy = false;
      if (active && !['submitting', 'uncertain'].includes(active.phase)) showRestoreButton();
    }
    function showRestoreButton() {
      if (!overlay || overlay.querySelector('[data-bn-restore]')) return;
      var restore = button('Restore my cart', function () { cancel().catch(showError); }, true);
      restore.dataset.bnRestore = ''; overlay.querySelector('[data-bn-body]').appendChild(restore);
    }
    async function withLock(work) {
      if (!win.navigator.locks) throw new Error('This browser cannot safely run the Buy now pilot. Use regular checkout.');
      return new Promise(function (resolve, reject) {
        win.navigator.locks.request(lockName, { ifAvailable: true }, async function (lock) {
          if (!lock) { reject(new Error('Buy now is already open in another tab. Finish or cancel there first.')); return; }
          var held = new Promise(function (release) { releaseLock = release; });
          try { await work(); resolve(); await held; } catch (error) { if (releaseLock) releaseLock(); releaseLock = null; reject(error); }
        }).catch(reject);
      });
    }
    function cartFromDocument(page) {
      if (!signedIn(page)) throw new Error('WebTrack sign-in expired. Sign back in before recovering your cart.');
      var rows = Array.from(page.querySelectorAll('.shopping-cart-item')).filter(function (row) {
        return !!row.querySelector('input.riTextBox,input[id*="_qty_"]:not([type="hidden"]),a[href*="pid="]');
      });
      if (!readableCart(page, rows.length)) {
        throw new Error('WebTrack did not return a readable cart. No further cart changes were made.');
      }
      var parsed = rows.map(function (row) {
        var link = Array.from(row.querySelectorAll('a[href]')).find(function (el) { return pidOf(el.getAttribute('href')); });
        var quantity = row.querySelector('input.riTextBox,input[id*="_qty_"]:not([type="hidden"])');
        var code = row.querySelector('.portalGridLink') || link;
        var unitNode = row.querySelector('[data-title="Per"],[data-title="UOM"],.productPer,.unit-of-measure');
        var unitParent = quantity && quantity.closest('.float-right');
        var directUnit = unitParent ? text(Array.from(unitParent.childNodes).filter(function (node) { return node.nodeType === 3; }).map(function (node) { return node.textContent; }).join(' ')) : '';
        var unitMatch = text(row.textContent).match(/\b(?:Per|UOM|Unit)\s*:\s*([a-z][a-z0-9/.-]*)\b/i);
        var configured = Array.from(row.querySelectorAll('input[id$="_txtSpecialProductCode"],input[id$="_txtSpecialProductDescription"]')).some(function (el) { return text(el.value); });
        if (!link || !quantity || configured || /customized special order|cut to ship|configured product/i.test(row.textContent)) throw new Error('This cart contains a line that needs regular checkout during the pilot.');
        var unit = text(unitNode ? unitNode.textContent : directUnit || unitMatch && unitMatch[1]);
        if (!unit) throw new Error('The cart unit could not be verified. Please use regular checkout.');
        return { pid: pidOf(link.getAttribute('href')), code: text(code.textContent), quantity: Number(quantity.value), unit: unit, name: text(row.querySelector('.description,.ProductDescription')?.textContent || code.textContent) };
      });
      return { doc: page, items: lines(parsed), rows: rows };
    }
    async function cart() { return cartFromDocument(await fetchDocument('/ShoppingCart.aspx')); }
    function formBody(page) {
      var form = page.querySelector('form');
      if (!form) throw new Error('The native WebTrack form is missing.');
      var data = new URLSearchParams();
      Array.from(form.elements).forEach(function (el) {
        var kind = String(el.type || '').toLowerCase();
        if (!el.name || el.disabled || ['submit', 'button', 'image', 'reset', 'file'].includes(kind) || (['checkbox', 'radio'].includes(kind) && !el.checked)) return;
        if (el.tagName === 'SELECT' && el.multiple) Array.from(el.selectedOptions).forEach(function (option) { data.append(el.name, option.value); });
        else data.append(el.name, el.value || '');
      });
      return { form: form, data: data };
    }
    async function nativePost(page, control, fallbackPath, adjust) {
      if (!control || control.disabled || control.getAttribute('aria-disabled') === 'true') throw new Error('The required native cart control is unavailable.');
      var body = formBody(page), target = targetOf(control.getAttribute('href') || control.getAttribute('onclick'));
      body.data.set('__EVENTTARGET', target); body.data.set('__EVENTARGUMENT', '');
      if (!target) {
        if (!control.name) throw new Error('The native cart action could not be identified.');
        body.data.set(control.name, control.value || '');
      }
      if (adjust) adjust(body.data);
      var action = new URL(body.form.getAttribute('action') || fallbackPath, ORIGIN + fallbackPath);
      if (action.origin !== ORIGIN || !/^\/(?:ShoppingCart|ProductDetail)\.aspx$/i.test(action.pathname)) throw new Error('An unexpected cart action was blocked.');
      await fetchDocument(action.href, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, body: body.data.toString() });
    }
    async function product(id) {
      if (blocked && blocked.has(id)) throw new Error('This item is not eligible for online purchase.');
      var page = await fetchDocument('/ProductDetail.aspx?pid=' + id);
      if (!signedIn(page)) throw new Error('Sign in again before using Buy now.');
      var add = page.querySelector('[id$="_AddProductButton"]');
      var quantity = page.querySelector('input[id$="_qty_' + id + '"]');
      var special = page.querySelector('input[id$="_txtSpecialProductCode"]');
      if (!add || !quantity || page.querySelector('[id$="_btnSpecialOrder"]') || special && text(special.value)) throw new Error('This product needs regular checkout during the pilot.');
      var name = text(page.querySelector('.productDescriptionOnThisPageFull,#wl-product-title,h1,[id$="ProductName"]')?.textContent);
      var codeLine = Array.from(page.querySelectorAll('.formPageHeader')).map(function (el) { return text(el.textContent); }).find(function (value) { return /^Product Code:/i.test(value); });
      var code = text(codeLine).replace(/^Product Code:\s*/i, '');
      var unit = text(page.querySelector('.productPerSegment')?.textContent).toLowerCase();
      if (!code || !unit || /epallet|e-pallet|wdoor/i.test(code)) throw new Error('The native product code or unit could not be verified for Buy now.');
      var cuts;
      try { cuts = JSON.parse(win.sessionStorage.getItem('wl_cut_to_ship_v1') || '{}'); } catch (_) { throw new Error('Saved cut selections need regular checkout.'); }
      if (Object.values(cuts).some(function (selection) { return selection && (String(selection.productId) === id || text(selection.productCode).toUpperCase() === code.toUpperCase()); })) throw new Error('Cut-to-ship selections need regular checkout during this pilot.');
      return { doc: page, add: add, quantity: quantity, name: name, code: code, unit: unit };
    }
    async function preflight(items) {
      // Validate every original line before removing any line. Re-add must expose a native form.
      var index = 0;
      async function checkNext() {
        while (index < items.length) {
        var item = items[index++], info = await product(item.pid);
        if (info.name) item.name = info.name;
        if (info.code.toUpperCase() !== item.code.toUpperCase() || info.unit !== item.unit) throw new Error('A cart line differs from its standard product. Please use regular checkout.');
        var selectedUnit = info.doc.querySelector('select[id*="Per"],select[id*="UOM"],select[id*="Unit"]');
        if (selectedUnit || (item.unit && !/^(ea|each|pc|pcs|bag|box|pack|pair|roll|set|gal|lb)$/i.test(item.unit))) throw new Error('This cart uses a unit that has not been proven restorable. Please use regular checkout.');
        }
      }
      await Promise.all(Array.from({length:Math.min(items.length,4)},checkNext));
    }
    async function reconcile(wanted) {
      for (var count = 0; count < 180; count++) {
        await checkIdentity();
        var fresh = await cart(); assertExpected(fresh.items, active);
        if (active.pending) { active.current = fresh.items; active.pending = null; save(); }
        var action = nextMutation(fresh.items, wanted);
        if (!action) { active.current = fresh.items; save(); return; }
        var expected = afterMutation(fresh.items, wanted, action);
        active.pending = { before: signature(fresh.items), after: signature(expected) }; save();
        if (action.kind === 'add') {
          var info = await product(action.pid);
          await nativePost(info.doc, info.add, '/ProductDetail.aspx?pid=' + action.pid, function (data) { data.set(info.quantity.name, String(action.quantity)); });
        } else {
          var index = fresh.items.findIndex(function (item) { return item.pid === action.pid; }), row = fresh.rows[index];
          var control = action.kind === 'remove'
            ? row.querySelector('a[id*="_del_"],a[id*="Delete"],a[href*="Delete"]') || row.querySelector('a i.fas.fa-times')?.parentElement
            : row.querySelector('a.refresh-cart-line-total');
          await nativePost(fresh.doc, control, '/ShoppingCart.aspx', function (data) {
            if (action.kind !== 'quantity') return;
            var input = row.querySelector('input.riTextBox,input[id*="_qty_"]:not([type="hidden"])');
            data.set(input.name, String(action.quantity));
            var state = row.querySelector('input[id$="_ClientState"]');
            if (state && state.name) {
              var value = JSON.parse(state.value || '{}');
              value.validationText = String(action.quantity); value.valueAsString = String(action.quantity); value.lastSetTextBoxValue = String(action.quantity);
              data.set(state.name, JSON.stringify(value));
            }
          });
        }
        var after = await cart();
        if (signature(after.items) !== signature(expected)) throw new Error('WebTrack did not confirm the requested cart change. Your recovery copy is retained.');
        active.current = after.items; active.pending = null; save();
      }
      throw new Error('Cart recovery stopped after too many changes. Your backup is retained.');
    }
    function restoreSession() {
      var sessionKey = PREFIX + 'session:' + active.id;
      var before = JSON.parse(win.sessionStorage.getItem(sessionKey) || '{}');
      Object.entries(before).forEach(function (entry) {
        if (entry[1] === null) win.sessionStorage.removeItem(entry[0]); else win.sessionStorage.setItem(entry[0], entry[1]);
      });
      win.sessionStorage.removeItem(sessionKey);
    }
    async function cancel() {
      if (submitting || active && ['submitting', 'uncertain'].includes(active.phase)) {
        status('The order result must be checked before restoring the cart. Do not submit the order again.', true); return;
      }
      if (busy) { cancelPending = true; status('Finishing this change, then restoring your cart…'); return; }
      if (!active) { dismiss(); return; }
      busy = true; clearFrame();
      var wanted = recoveryTarget(active);
      active.phase = 'restoring'; save(); loading(true); status('Restoring your cart…');
      await reconcile(wanted); restoreSession(); storage.removeItem(key);
      var purchased = !!active.orderNumber;
      dismiss();
      if (/\/ShoppingCart\.aspx$/i.test(win.location.pathname)) win.location.reload();
      else notice(purchased ? 'Your remaining cart items are restored.' : 'Buy now cancelled. Your original cart is restored.');
    }
    function notice(message) {
      var el = doc.createElement('div'); el.className = 'bn-notice'; el.setAttribute('role', 'status'); el.textContent = message;
      el.appendChild(button('Dismiss', function () { el.remove(); }, true)); doc.body.appendChild(el);
    }
    function loading(value) {
      if (!overlay) return;
      overlay.classList.toggle('bn-loading', !!value);
      overlay.querySelector('.bn-panel').setAttribute('aria-busy', value ? 'true' : 'false');
      if (fast) {
        fast.loading = !!value;
        overlay.querySelectorAll('[data-bn-edit],[data-bn-method]').forEach(function (el) { el.disabled = !!value || el.dataset.available === 'false'; });
        var confirm = overlay.querySelector('[data-bn-confirm]');
        if (confirm) confirm.disabled = !!value || !fast.ready || !!fast.editor;
      }
    }
    function node(tag, copy, className) {
      var el = doc.createElement(tag); if (copy) el.textContent = copy; if (className) el.className = className; return el;
    }
    function fastText(selector, copy) {
      var el = overlay?.querySelector(selector); if (el && el.textContent !== copy) el.textContent = copy;
    }
    function renderFast(info, primary, before) {
      var body = overlay.querySelector('[data-bn-body]');
      body.innerHTML = '<div class="bn-product"><div data-bn-photo></div><div><h3 data-bn-product></h3><span data-bn-qty></span></div></div>' +
        '<div class="bn-methods" role="group" aria-label="Fulfillment">' +
        '<button type="button" data-bn-method="pickup"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10h18M4 10v11h16V10M3 10l2-7h14l2 7M9 21v-7h6v7"/></svg><strong>Pickup</strong><small data-bn-rate="pickup">Checking…</small></button>' +
        '<button type="button" data-bn-method="delivery"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 5h12v12H2zM14 9h4l4 5v3h-8M7 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM21 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/></svg><strong>Delivery</strong><small data-bn-rate="delivery">Checking…</small></button>' +
        '<button type="button" data-bn-method="ship"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 9-4 9 4v12l-9 4-9-4zM3 6l9 4 9-4M12 10v12M7 4l10 4"/></svg><strong>Ship</strong><small data-bn-rate="ship">Checking…</small></button></div>' +
        '<div class="bn-options">' +
        '<div class="bn-option"><span class="bn-option-icon">⌖</span><div><strong data-bn-address-title>Deliver to</strong><span data-bn-address>Account address</span></div><button type="button" data-bn-edit="address">Change</button></div>' +
        '<div class="bn-option"><span class="bn-option-icon">◷</span><div><strong>When</strong><span data-bn-timing>Earliest available</span></div><button type="button" data-bn-edit="timing">Change</button></div>' +
        '<div class="bn-option"><span class="bn-option-icon">▤</span><div><strong>Payment</strong><span data-bn-payment>Saved payment</span></div><button type="button" data-bn-edit="payment">Change</button></div></div>' +
        '<button type="button" class="bn-extras" data-bn-edit="extras"><span data-bn-extras></span><span>＋</span></button>' +
        '<button type="button" class="bn-more" data-bn-edit="notes">Order notes & billing</button>' +
        '<div data-bn-editor hidden></div><div class="bn-totals"><div><span>Items</span><span data-bn-subtotal>—</span></div><div><span data-bn-shipping-label>Delivery</span><span data-bn-shipping>—</span></div><div><span>Tax</span><span data-bn-tax>—</span></div><div class="bn-grand"><strong>Order total</strong><strong data-bn-total>—</strong></div></div>' +
        '<button type="button" class="bn-action bn-confirm" data-bn-confirm disabled>Preparing your order…</button>' +
        '<p class="bn-terms">By placing your order, you agree to <a href="/TermsAndConditions.aspx" target="_blank" rel="noopener">Woodson’s terms</a>.</p><div data-bn-native-host></div>';
      fastText('[data-bn-product]', info.name || primary.code);
      overlay.querySelector('.bn-footer')?.remove();
      var footer = node('div','','bn-footer');
      ['.bn-totals','[data-bn-confirm]','.bn-terms'].forEach(function (selector) { footer.appendChild(body.querySelector(selector)); });
      body.after(footer);
      fastText('[data-bn-qty]', 'Qty ' + primary.quantity + ' · ' + primary.unit);
      fastText('[data-bn-extras]', before.length ? 'Also in your cart (' + before.length + ')' : 'No other cart items');
      var photo = info.doc.querySelector('img[id$="_ProductImage"],.product-image-wrapper img');
      if (photo?.getAttribute('src')) {
        var url = new URL(photo.getAttribute('src'), ORIGIN);
        if (url.protocol === 'https:' || url.origin === ORIGIN) {
          var img = doc.createElement('img'); img.src = url.href; img.alt = ''; overlay.querySelector('[data-bn-photo]').appendChild(img);
        }
      }
      body.querySelectorAll('[data-bn-method]').forEach(function (el) {
        el.addEventListener('click', function () { if (fast.loading || !fast.methods[el.dataset.bnMethod]?.available) return; fast.method = el.dataset.bnMethod; fast.date = ''; fast.shippingValue = ''; refreshFast().catch(showError); });
      });
      body.querySelectorAll('[data-bn-edit]').forEach(function (el) { el.addEventListener('click', function () { editFast(el.dataset.bnEdit); }); });
      overlay.querySelector('[data-bn-confirm]').addEventListener('click', function () {
        if (!fast?.ready || fast.loading || fast.editor || !frame?.contentDocument) return;
        submitNative(frame.contentDocument.getElementById('ctl00_PageBody_CompleteCheckoutButton'), frame.contentDocument).catch(showError);
      });
      loading(true);
    }
    function field(form, label, value, type, options) {
      var wrap = node('label', label), input = doc.createElement(options ? 'select' : type === 'textarea' ? 'textarea' : 'input');
      if (!options && type !== 'textarea') input.type = type || 'text';
      input.setAttribute('aria-label',label);
      if (options) options.forEach(function (option) { var el = node('option', option.label); el.value = option.value; input.appendChild(el); });
      input.value = value || ''; wrap.appendChild(input); form.appendChild(wrap); return input;
    }
    function editFast(kind) {
      if (!fast || fast.loading || submitting || busy) return;
      var host = overlay.querySelector('[data-bn-editor]'); host.replaceChildren(); host.hidden = false; fast.editor = kind; loading(false);
      var titles = {address:fast.method === 'pickup' ? 'Pickup store' : 'Delivery address',timing:'Schedule',payment:'Payment',extras:'Add from your cart',notes:'Order details'};
      host.appendChild(node('h3', titles[kind]));
      var form = doc.createElement('form'), values = {}, action = null; host.appendChild(form);
      if (kind === 'address' && fast.method === 'pickup') {
        values.store = field(form, 'Pickup store', fast.store, 'text', fast.stores || []);
      } else if (kind === 'address') {
        var address = fast.address || {};
        [['line1','Street'],['line2','Apt / suite'],['city','City'],['stateValue','State'],['zip','ZIP'],['contactName','Contact'],['phone','Phone'],['email','Email']].forEach(function (entry) {
          values[entry[0]] = field(form, entry[1], address[entry[0]], entry[0] === 'email' ? 'email' : 'text');
          if (['line1','city','stateValue','zip','contactName','phone','email'].includes(entry[0])) values[entry[0]].required = true;
        });
      } else if (kind === 'timing') {
        values.date = field(form, fast.method === 'pickup' ? 'Pickup date' : 'Delivery date', fast.date, 'date');
        values.date.min = fast.dateMin || ''; values.date.max = fast.dateMax || '';
        if (fast.method === 'pickup') {
          values.time = field(form, 'Pickup time', fast.pickupTime, 'text', fast.pickupTimes || []);
          values.person = field(form, 'Pickup person', fast.pickupPerson || fast.address?.contactName);
          values.person.required = true;
        } else if (fast.method === 'delivery') {
          values.window = field(form, 'Delivery window', fast.window, 'text', [{value:'Morning',label:'Morning'},{value:'Afternoon',label:'Afternoon'}]);
        } else {
          values.date.closest('label').hidden = true;
          values.shipping = field(form, 'UPS service', fast.shippingValue, 'text', fast.shippingOptions || []);
        }
      } else if (kind === 'payment') {
        values.payment = field(form, 'Saved payment', fast.paymentFingerprint, 'text', (fast.payments || []).map(function (option) { return {value:option.fingerprint,label:option.label}; }));
        var rememberLabel = node('label', '', 'bn-check'); values.remember = doc.createElement('input'); values.remember.type = 'checkbox'; values.remember.checked = !!storage.getItem(preferenceKey); rememberLabel.append(values.remember, doc.createTextNode(' Remember on this browser')); form.appendChild(rememberLabel);
        action = button('Add new payment', function () { fast.addPayment = true; closeEditor(); refreshFast().catch(showError); }, true); form.appendChild(action);
      } else if (kind === 'extras') {
        fast.original.forEach(function (item) {
          var label = node('label', '', 'bn-check'), check = doc.createElement('input'); check.type = 'checkbox'; check.value = item.pid; check.checked = fast.selected.includes(item.pid);
          label.append(check, doc.createTextNode((item.name || item.code) + ' · Qty ' + item.quantity)); form.appendChild(label);
        });
        if (!fast.original.length) form.appendChild(node('p','No other cart items.'));
      } else if (kind === 'notes') {
        values.reference = field(form, 'PO / reference', fast.reference);
        values.notes = field(form, 'Order notes', fast.notes, 'textarea');
        var billing = button('Change billing address', function () { editBilling(form); }, true); form.appendChild(billing);
      }
      var actions = node('div', '', 'bn-editor-actions'), saveButton = node('button','Apply','bn-action'); saveButton.type = 'submit';
      actions.append(saveButton, button('Cancel', closeEditor, true)); form.appendChild(actions);
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!form.reportValidity()) return;
        if (kind === 'address' && fast.method === 'pickup') fast.store = values.store.value;
        else if (kind === 'address') {
          fast.address = Object.assign({}, fast.address, Object.fromEntries(Object.entries(values).map(function (entry) { return [entry[0],text(entry[1].value)]; })));
          fast.address.stateValue = fast.address.stateValue.toUpperCase(); fast.address.stateText = fast.address.stateValue;
          fast.addressChanged = true; fast.method = ''; fast.date = '';
        } else if (kind === 'timing') {
          if (fast.method !== 'ship' && !dateChoice(values.date.value,values.date.min,values.date.max)) { status('Choose a Monday–Saturday date in the available range.',true); return; }
          fast.date = values.date.value; if (values.time) fast.pickupTime = values.time.value; if (values.person) fast.pickupPerson = values.person.value; if (values.window) fast.window = values.window.value; if (values.shipping) fast.shippingValue = values.shipping.value;
        } else if (kind === 'payment') {
          fast.paymentFingerprint = values.payment.value;
          if (values.remember.checked) storage.setItem(preferenceKey,fast.paymentFingerprint); else storage.removeItem(preferenceKey);
        } else if (kind === 'extras') fast.selected = Array.from(form.querySelectorAll('input:checked')).map(function (el) { return el.value; });
        else if (kind === 'notes') {
          fast.reference = values.reference.value; fast.notes = values.notes.value;
          if (fast.billingInputs) { fast.billing = {}; Object.entries(fast.billingInputs).forEach(function (entry) { fast.billing[entry[0]] = entry[1].value; }); }
        }
        closeEditor(); refreshFast().catch(showError);
      });
      form.querySelector('input,select,textarea')?.focus();
    }
    function editBilling(form) {
      if (fast.billingInputs) return;
      var address = fast.billing || fast.address || {}; fast.billingInputs = {};
      form.appendChild(node('h4','Billing address'));
      [['line1','Street'],['line2','Apt / suite'],['city','City'],['stateValue','State'],['zip','ZIP']].forEach(function (entry) { var input = field(form,entry[1],address[entry[0]]); input.required = entry[0] !== 'line2'; fast.billingInputs[entry[0]] = input; });
    }
    function closeEditor() {
      if (!fast || !overlay) return;
      fast.editor = ''; fast.billingInputs = null;
      var host = overlay.querySelector('[data-bn-editor]'); host.hidden = true; host.replaceChildren(); loading(fast.loading);
    }
    var SESSION_KEYS = ['wl_fulfillment_intent','wl_fulfillment_method','wl_fulfillment_selection_source_v1','wl_confirmed_fulfillment_v1','wl_checkout_form_snapshot_v2','wl_checkout_single_page_preview','wl_shipping_selection_v1','wl_shipping_offer_v1','wl_checkout_date_state_v2','wl_checkout_auto_advance','wl_checkout_address_payload','wl_checkout_contact_payload','wl_returnStep','wl_pendingStep','wl_expect_nav','wl_billing_confirmed','wl_billing_seen','wl_billing_confirmed_delivered','wl_autocopy_done'];
    function seedSession() {
      SESSION_KEYS.forEach(function (name) { win.sessionStorage.removeItem(name); });
      win.sessionStorage.setItem('wl_checkout_single_page_preview','1');
      if (fast.address) win.sessionStorage.setItem('wl_checkout_address_payload', JSON.stringify(Object.assign({},fast.address,{ts:Date.now()})));
    }
    async function start(id, quantity) {
      if (!ENABLE_NEW_STARTS || overlay || busy) return;
      await withLock(async function () {
        shell('Buy now'); loading(true); status('Getting your options…'); busy = true;
        await Promise.all([checkIdentity(), purchaseRestrictions().then(function (ids) { blocked = ids; })]);
        if (record()) throw new Error('Restore your earlier Buy now cart first.');
        var details = await Promise.all([cart(),product(id)]), before = details[0], info = details[1];
        var primary = {pid:id,quantity:quantity,name:info.name,code:info.code,unit:info.unit};
        await preflight(before.items.concat(before.items.some(function (item) { return item.pid === id; }) ? [] : [primary]));
        var address = mainAddress(Array.from(account.querySelectorAll('.accountInfoAddress li')).map(function (el) { return el.textContent; }));
        if (address) {
          address.contactName = [text(settings.getElementById('ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput')?.value),text(settings.getElementById('ctl00_PageBody_ChangeUserDetailsControl_LastNameInput')?.value)].filter(Boolean).join(' ');
          address.email = text(settings.getElementById('ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput')?.value);
          address.phone = text(account.getElementById('ctl00_PageBody_TelephoneLink_TelephoneLink')?.textContent);
        }
        fast = {original:before.items,primary:primary,selected:[],address:address,method:'',methods:{},date:'',window:'Afternoon',ready:false,payments:[],revision:0,driving:false,editor:'',started:Date.now()};
        if (cancelPending) { busy = false; cancelPending = false; dismiss(); return; }
        renderFast(info,primary,before.items);
        var planned = plan(before.items,primary,[]), sessionBefore = {};
        SESSION_KEYS.forEach(function (name) { sessionBefore[name] = win.sessionStorage.getItem(name); });
        var draft = {version:1,scope:scope,branch:branch,id:'BN-'+win.crypto.randomUUID(),owner:owner,phase:'backed_up',createdAt:Date.now(),original:planned.original,purchase:planned.purchase,remaining:planned.remaining,current:before.items,pending:null,extraCount:0};
        win.sessionStorage.setItem(PREFIX+'session:'+draft.id,JSON.stringify(sessionBefore)); persist(storage,key,draft); active = draft;
        seedSession(); active.phase = 'preparing'; save();
        await reconcile(planned.purchase); active.phase = 'checking_out'; save(); busy = false;
        if (cancelPending) { cancelPending = false; await cancel(); return; }
        openFrame(overlay.querySelector('[data-bn-native-host]'));
      });
    }
    async function refreshFast() {
      if (!fast || busy || submitting) return;
      fast.ready = false; fast.review = null; fast.revision++; fast.started = Date.now(); fast.driving = false; fast.stopped = false; fast.securePayment = false;
      loading(true); status('Updating your order…'); fastText('[data-bn-confirm]','Updating…');
      clearFrame(); busy = true;
      try {
        await checkIdentity();
        var planned = plan(fast.original,fast.primary,fast.selected);
        active.purchase = planned.purchase; active.remaining = planned.remaining; active.extraCount = fast.selected.length; save();
        await reconcile(planned.purchase); active.phase = 'checking_out'; save(); seedSession(); busy = false;
        if (cancelPending) { cancelPending = false; await cancel(); return; }
        fastText('[data-bn-extras]',fast.selected.length ? fast.selected.length+' cart item'+(fast.selected.length===1?'':'s')+' included' : 'Also in your cart ('+fast.original.length+')');
        openFrame(overlay.querySelector('[data-bn-native-host]'));
      } catch (error) { busy = false; throw error; }
    }
    function openFrame(body) {
      frame = doc.createElement('iframe'); frame.title = 'Secure WebTrack Buy now checkout'; frame.className = 'bn-frame'; frame.name = 'woodson-buy-now-checkout';
      frame.setAttribute('aria-hidden','true'); frame.setAttribute('tabindex','-1');
      frame.addEventListener('load', function () { installFrame().catch(showError); });
      frame.src = '/ShoppingCart.aspx?wlCheckout=single'; body.appendChild(frame);
    }
    async function installFrame() {
      if (!frame || !active) return;
      var child = frame.contentWindow, page;
      try { page = frame.contentDocument; if (child.location.origin !== ORIGIN) page = null; } catch (_) { page = null; }
      if (!page) {
        frame.classList.add('bn-frame-open'); frame.removeAttribute('aria-hidden'); frame.removeAttribute('tabindex'); loading(false); status('Complete the secure payment step below.'); return;
      }
      if (frameObserver) frameObserver.disconnect();
      if (framePulse) win.clearInterval(framePulse);
      var style = page.createElement('style');
      style.textContent = '#PageHeaderDiv,#PageFooterDiv,#siteHeaderContent,#savedForLater{display:none!important}body{padding:0!important}#MainLayoutRow{margin:8px auto!important}';
      page.head.appendChild(style);
      page.querySelectorAll('.shopping-cart-item input.riTextBox,.shopping-cart-item input[id*="_qty_"]:not([type="hidden"])').forEach(function (input) { input.readOnly = true; });
      // Native date-change compares midnight against a time-bearing minimum,
      // which alerts for its own valid minimum day. Keep date handling in this
      // pilot iframe, validate calendar bounds, then use native refresh hooks.
      page.addEventListener('change', function (event) {
        var input = event.target;
        if (!input || !['deliveryDate','pickupDate'].includes(input.id) || !input.value || !input.min) return;
        event.stopImmediatePropagation();
        if (!dateChoice(input.value, input.min, input.max)) {
          input.value = '';
          input.dispatchEvent(new child.Event('input', { bubbles: true }));
          status('Choose an available Monday–Saturday date within the range shown in checkout.', true);
          var extra = page.getElementById('specialInsExtra');
          if (extra) extra.dispatchEvent(new child.Event('input', { bubbles: true }));
          return;
        }
        input.dispatchEvent(new child.Event('input', { bubbles: true }));
        child.WLCheckout?.refreshDateUI?.();
        child.WLCheckout?.refreshSectionSummaries?.();
      }, true);
      // Block escaping the dialog through internal navigation while its cart is isolated.
      page.addEventListener('click', function (event) {
        var cartAction = event.target.closest('[id*="_del_"],[id*="_refQty_"],[id*="EmptyCartButton"],.wl-cart-qty-btn,.refresh-cart-line-total');
        if (cartAction) { event.preventDefault(); event.stopImmediatePropagation(); status('To change items or quantities, use Cancel to restore your cart first.'); return; }
        var link = event.target.closest('a[href]');
        if (!link || link.target === '_blank') return;
        var href = link.getAttribute('href');
        if (!href || /^javascript:|^#/i.test(href)) return;
        var url = new URL(href, child.location.href);
        if (url.origin === ORIGIN && !/^\/(?:ShoppingCart|AddressDetails|AddressList_R|CustomerTokens|Contacts_R|ContactDetails_R)\.aspx$/i.test(url.pathname)) {
          event.preventDefault(); event.stopImmediatePropagation(); status('Finish checkout here, or use Cancel to restore your original cart.');
        }
      }, true);
      page.addEventListener('click', function (event) {
        var final = event.target.closest(FINAL);
        if (!final || permittedFinal === final) return;
        event.preventDefault(); event.stopImmediatePropagation();
        submitNative(final, page).catch(showError);
      }, true);
      page.addEventListener('submit', function (event) {
        if (page.getElementById('ctl00_PageBody_CompleteCheckoutButton') && !submitting) { event.preventDefault(); status('Use Complete Order after reviewing the final total.'); }
      }, true);
      var scheduled = false;
      function inspect() {
        if (scheduled || !frame) return;
        scheduled = true;
        frameTimer = win.setTimeout(function () { scheduled = false; inspectFrame(child, page).catch(showError); }, 80);
      }
      frameObserver = new win.MutationObserver(inspect); frameObserver.observe(page.body, { childList: true, subtree: true });
      framePulse = win.setInterval(inspect,300);
      inspect();
    }
    async function inspectFrame(child, page) {
      if (!frame || !active || active.phase === 'restored') return;
      var confirmation = page.getElementById('CartResponseMessage'), merchant = page.getElementById('ctl00_PageBody_SuccessfulPaymentResults_MerchantDetailsPanel');
      if (new URL(child.location.href).searchParams.get('success') === '1' && confirmation && merchant) {
        var order = text(confirmation.querySelector('strong')?.textContent).replace(/^(?:reserved\s+)?order(?:\s+(?:number|no\.?))?\s*[:#-]?\s*/i, '');
        if (!/^[a-z0-9][a-z0-9-]{2,63}$/i.test(order) || !['submitting', 'confirmed', 'restoring'].includes(active.phase)) throw new Error('Order confirmation needs review before restoring the cart.');
        if (busy) return;
        busy = true; submitting = false; active.orderNumber = order; active.phase = 'confirmed'; active.current = []; active.pending = null; save();
        status('Order ' + order + ' confirmed. Restoring items you left in your cart…');
        var fresh = await cart();
        if (fresh.items.length) throw new Error('The order is confirmed, but WebTrack has not returned an empty cart. Your recovery copy is retained.');
        active.phase = 'restoring'; save(); await reconcile(active.remaining); restoreSession(); storage.removeItem(key); active.phase = 'restored';
        status('Order ' + order + ' is confirmed. Your remaining cart items are restored.'); busy = false;
        loading(false); overlay.querySelector('.bn-footer')?.remove(); var done = button('Continue shopping', dismiss); overlay.querySelector('[data-bn-body]').replaceChildren(node('div','✓','bn-success'),node('h3','Order confirmed'),done); return;
      }
      if (submitting) {
        status('Waiting for WebTrack to confirm the order. Do not submit again or close this window.'); return;
      }
      var instructions = page.getElementById('ctl00_PageBody_SpecialInstructionsTextBox');
      if (instructions) {
        var extra = page.getElementById('specialInsExtra');
        var note = marker(active);
        if (extra) {
          if (!extra.value.includes(active.id)) {
            extra.value = [extra.value, note].filter(Boolean).join('\n');
            extra.dispatchEvent(new child.Event('input', { bubbles: true })); extra.dispatchEvent(new child.Event('change', { bubbles: true }));
          }
        } else if (!instructions.value.includes(active.id)) instructions.value = [instructions.value, note].filter(Boolean).join(' | ');
        instructions.dataset.bnNativeNote = '1';
      }
      await driveFast(child,page);
    }
    function setNative(child, element, value) {
      if (!element || element.value === String(value == null ? '' : value)) return;
      element.value = value == null ? '' : String(value);
      element.dispatchEvent(new child.Event('input',{bubbles:true}));
      element.dispatchEvent(new child.Event('change',{bubbles:true}));
    }
    function nativeAddress(child, page, prefix, address) {
      if (!address) return;
      var base = 'ctl00_PageBody_'+prefix+'_';
      [['AddressLine1','line1'],['AddressLine2','line2'],['AddressLine3','line3'],['City','city'],['Postcode','zip']].forEach(function (entry) { setNative(child,page.getElementById(base+entry[0]),address[entry[1]] || ''); });
      var state = page.querySelector('[id^="'+base+'"][id$="CountyList"]');
      if (state) {
        var option = Array.from(state.options).find(function (el) { return el.value.toUpperCase() === text(address.stateValue).toUpperCase() || text(el.textContent).toUpperCase() === text(address.stateText || address.stateValue).toUpperCase(); });
        if (option) setNative(child,state,option.value);
      }
    }
    function readNativeReview(page) {
      var summary = page.getElementById('summary');
      if (!summary || !text(summary.textContent).includes(active.id)) throw new Error('Order details are still loading.');
      var grid = page.getElementById('ctl00_PageBody_ShoppingCartSummaryTableControl_BasketLinesGrid_ctl00');
      var rows = Array.from(grid ? grid.querySelectorAll('tr.rgRow,tr.rgAltRow') : []).map(function (row) {
        var cells = row.querySelectorAll('td'); return {code:text(cells[0]?.textContent),quantity:Number(text(cells[3]?.textContent).replace(/,/g,'')),unit:text(cells[4]?.textContent)};
      });
      assertReview(rows,active.current);
      var totals = reviewTotals(summary), shippingRow = page.getElementById('ctl00_PageBody_ShoppingCartSummaryTableControl_DeliverySummaryRow');
      if (shippingRow) totals.shipping = text(shippingRow.querySelector('td.numeric')?.textContent);
      if (!totals.shipping && fast.method === 'pickup') totals.shipping = '$0.00';
      if (money(totals.shipping) === null) throw new Error('The shipping total is still loading.');
      var nativeMethod = text(page.getElementById('ctl00_PageBody_ShoppingCartSummaryTableControl_SaleType')?.textContent);
      if (!nativeMethod) {
        var label = Array.from(summary.querySelectorAll('.row .font-weight-bold')).find(function (el) { return /Shipping Method/i.test(el.textContent); });
        nativeMethod = text(label?.parentElement?.querySelector('.col')?.textContent);
      }
      if (nativeMethod && ((fast.method === 'pickup') !== /^pickup/i.test(nativeMethod))) throw new Error('The fulfillment choice did not match. Change it and try again.');
      if (fast.method !== 'pickup' && !(money(totals.shipping) > 0)) throw new Error('WebTrack did not confirm the delivery charge.');
      var expectedShipping = fast.method === 'pickup' ? 0 : fast.method === 'delivery' ? money(fast.methods.delivery?.rate) : null;
      if (fast.method === 'ship') {
        var service = (fast.shippingOptions || []).find(function (option) { return option.value === fast.shippingValue; });
        var quoted = service?.label.match(/\$\s*[\d,]+\.\d{2}/); if (quoted) expectedShipping = money(quoted[0]);
      }
      if (expectedShipping !== null && money(totals.shipping) !== expectedShipping) throw new Error('The delivery charge changed. Refresh your options before ordering.');
      if (fast.method !== 'ship' && fast.date && !text(summary.textContent).includes(fast.date)) throw new Error('WebTrack did not confirm your requested date.');
      return {totals:totals,signature:JSON.stringify([signature(active.current),totals,fast.method,fast.paymentFingerprint || '',fast.revision])};
    }
    function updateFastOptions() {
      Object.entries(fast.methods).forEach(function (entry) {
        var el = overlay.querySelector('[data-bn-method="'+entry[0]+'"]'); if (!el) return;
        el.setAttribute('aria-pressed',fast.method===entry[0]?'true':'false');
        el.dataset.available = entry[1].available ? 'true' : 'false';
        el.disabled = fast.loading || !entry[1].available;
        fastText('[data-bn-rate="'+entry[0]+'"]',entry[1].available ? entry[1].rate+(entry[1].recommended?' · Best':'') : 'Unavailable');
        el.title = entry[1].reason || '';
      });
      fastText('[data-bn-address-title]',fast.method === 'pickup' ? 'Pickup at' : 'Deliver to');
      var store = (fast.stores || []).find(function (option) { return option.value === fast.store; });
      fastText('[data-bn-address]',fast.method==='pickup' ? (store?.label.split(' - ')[0] || 'Account store') : fast.addressChanged ? 'Selected address' : 'Account address');
      fastText('[data-bn-shipping-label]',fast.method==='pickup'?'Pickup':fast.method==='ship'?'Shipping':'Delivery');
      if (fast.method === 'ship') {
        var service = (fast.shippingOptions || []).find(function (option) { return option.value === fast.shippingValue; });
        fastText('[data-bn-timing]', service ? service.label : 'UPS Ground');
      } else if (fast.date) {
        var parts = fast.date.split('-').map(Number), date = new Date(parts[0],parts[1]-1,parts[2],12);
        fastText('[data-bn-timing]',date.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})+' · '+(fast.method==='pickup' ? fast.pickupTime || 'First available' : fast.window));
      }
    }
    function haltFast(message) {
      fast.stopped = true; fast.ready = false; loading(false); status(message,true); fastText('[data-bn-confirm]','Update your options'); updateFastOptions();
      if (!overlay.querySelector('[data-bn-retry]')) {
        var retry = button('Try again',function () { retry.remove(); refreshFast().catch(showError); },true); retry.dataset.bnRetry = ''; overlay.querySelector('[data-bn-native-host]').before(retry);
      }
    }
    async function driveFast(child,page) {
      if (!fast || fast.driving || fast.stopped || busy || submitting || active.phase !== 'checking_out') return;
      if (Date.now()-fast.started > 65000) { haltFast('This is taking longer than expected. Retry or cancel.'); return; }
      fast.driving = true;
      var current = fast;
      try {
        var complete = page.getElementById('ctl00_PageBody_CompleteCheckoutButton');
        if (complete) {
          var reviewed;
          try { reviewed = readNativeReview(page); } catch (error) {
            if (!page.documentElement.dataset.bnReviewWaiting) page.documentElement.dataset.bnReviewWaiting = String(Date.now());
            if (Date.now()-Number(page.documentElement.dataset.bnReviewWaiting) > 4000) haltFast(error.message);
            return;
          }
          fast.review = reviewed; fast.ready = true; fast.securePayment = false;
          if (framePulse) { win.clearInterval(framePulse); framePulse = null; }
          ['subtotal','shipping','tax','total'].forEach(function (key) { fastText('[data-bn-'+key+']',reviewed.totals[key]); });
          fastText('[data-bn-confirm]','Place order · '+reviewed.totals.total); loading(false); status('Ready to order'); updateFastOptions();
          frame.classList.remove('bn-frame-open'); frame.setAttribute('aria-hidden','true'); frame.setAttribute('tabindex','-1');
          return;
        }
        var checkout = page.getElementById('ctl00_PageBody_PlaceOrderButton');
        if (checkout && page.querySelector('.shopping-cart-item')) {
          if (!page.documentElement.dataset.bnCheckoutOpened) { page.documentElement.dataset.bnCheckoutOpened = '1'; status('Loading your defaults…'); checkout.click(); }
          return;
        }
        var methodButton = page.getElementById('btnDelivered'), pickupButton = page.getElementById('btnPickup');
        if (methodButton && pickupButton) {
          if (!child.WLCheckout?.refreshDateUI || !child.WLCheckout?.validateBeforeFinalSubmit) return;
          var quote = child.WLShippingOffer?.current?.(); if (!quote) return;
          fast.methods = {
            pickup:{available:!pickupButton.disabled,rate:'Free'},
            delivery:{available:!!quote.options?.delivery?.available,rate:'$'+Number(quote.options?.delivery?.amount||0).toFixed(2),recommended:quote.recommendation?.mode==='delivery',reason:text(quote.options?.delivery?.reason)},
            ship:{available:!!quote.options?.ups?.available,rate:'$'+Number(quote.options?.ups?.amount||0).toFixed(2),recommended:quote.recommendation?.mode==='ship',reason:text(quote.options?.ups?.reason)}
          };
          if (!fast.method) fast.method = fast.methods[quote.recommendation?.mode]?.available ? quote.recommendation.mode : fast.methods.delivery.available ? 'delivery' : fast.methods.ship.available ? 'ship' : 'pickup';
          updateFastOptions();
          if (!fast.methods[fast.method]?.available) { haltFast('That option is unavailable. Choose another.'); return; }
          if (page.documentElement.dataset.bnMethod !== fast.method) {
            page.documentElement.dataset.bnMethod = fast.method;
            page.getElementById(fast.method==='pickup'?'btnPickup':fast.method==='ship'?'btnShip':'btnDelivered').click();
            return;
          }
          var manager = child.Sys?.WebForms?.PageRequestManager?.getInstance?.(); if (manager?.get_isInAsyncPostBack?.()) return;
          if (page.documentElement.dataset.bnDetailsContinued && Array.from(page.querySelectorAll('.validation-summary-errors,.alert-danger,.wl-field-invalid')).some(function (el) { return el.offsetParent && text(el.textContent || el.getAttribute('aria-label')); })) { haltFast('Check your address, billing, or pickup details.'); return; }
          if (!page.documentElement.dataset.bnFieldsApplied) {
            page.documentElement.dataset.bnFieldsApplied = '1';
            if (fast.addressChanged) nativeAddress(child,page,'DeliveryAddress',fast.address);
            if (fast.billing) nativeAddress(child,page,'InvoiceAddress',fast.billing);
          }
          var branchField = page.getElementById('ctl00_PageBody_BranchDropDownList');
          if (branchField) {
            fast.stores = Array.from(branchField.options).filter(function (option) { return option.value && !/^\[?select/i.test(text(option.textContent)); }).map(function (option) { return {value:option.value,label:text(option.textContent)}; });
            if (fast.store && branchField.value !== fast.store && fast.method==='pickup') { setNative(child,branchField,fast.store); return; }
            fast.store = branchField.value;
          }
          var dateInput = page.getElementById(fast.method==='pickup'?'pickupDate':'deliveryDate'); if (!dateInput?.min) return;
          fast.dateMin = dateInput.min; fast.dateMax = dateInput.max;
          var chosenDate = fast.date || firstDate(dateInput.min,dateInput.max);
          if (!dateChoice(chosenDate,dateInput.min,dateInput.max)) { haltFast('Choose an available date.'); return; }
          setNative(child,dateInput,chosenDate); fast.date = chosenDate;
          child.WLCheckout.refreshDateUI();
          if (fast.method === 'pickup') {
            var time = page.getElementById('pickupTime');
            fast.pickupTimes = Array.from(time?.options || []).filter(function (option) { return !!option.value; }).map(function (option) { return {value:option.value,label:text(option.textContent)}; });
            if (!fast.pickupTimes.length) {
              var parts = chosenDate.split('-').map(Number), next = new Date(parts[0],parts[1]-1,parts[2]+1,12);
              var nextValue = [next.getFullYear(),String(next.getMonth()+1).padStart(2,'0'),String(next.getDate()).padStart(2,'0')].join('-');
              fast.date = firstDate(nextValue,dateInput.max); fast.pickupTime = ''; if (!fast.date) haltFast('Choose another pickup date.'); return;
            }
            if (fast.pickupTime && !fast.pickupTimes.some(function (option) { return option.value===fast.pickupTime; })) fast.pickupTime = '';
            fast.pickupTime = fast.pickupTime || fast.pickupTimes[0].value; setNative(child,time,fast.pickupTime);
            var person = page.getElementById('pickupPerson'); fast.pickupPerson = fast.pickupPerson || person?.value || fast.address?.contactName || '';
            setNative(child,person,fast.pickupPerson);
          } else {
            var windowInput = page.querySelector('input[name="deliveryTime"][value="'+fast.window+'"]');
            if (windowInput && !windowInput.checked) { windowInput.checked = true; windowInput.dispatchEvent(new child.Event('change',{bubbles:true})); }
          }
          var instructions = page.getElementById('specialInsExtra');
          setNative(child,instructions,[fast.notes,marker(active)].filter(Boolean).join('\n'));
          var reference = page.querySelector('input[id*="PurchaseOrder"],input[id*="CustomerReference"]'); if (reference && fast.reference !== undefined) setNative(child,reference,fast.reference);
          child.WLCheckout.refreshDateUI(); child.WLCheckout.refreshSectionSummaries?.(); updateFastOptions();
          if (!page.documentElement.dataset.bnDetailsContinued) {
            if (!child.WLCheckout.validateBeforeFinalSubmit()) { haltFast('Check your address, billing, or pickup details.'); return; }
            var nextButton = page.getElementById('ctl00_PageBody_ContinueButton2') || page.getElementById('ctl00_PageBody_ContinueButton1'); if (!nextButton) return;
            page.documentElement.dataset.bnDetailsContinued = '1'; status('Calculating your total…'); nextButton.click();
          }
          return;
        }
        var cards = page.getElementById('ctl00_PageBody_ddlCardsOnFile');
        if (cards) {
          if (page.documentElement.dataset.bnPaymentContinued) return;
          var options = await Promise.all(Array.from(cards.options).map(async function (option) { return {value:option.value,label:text(option.textContent),fingerprint:await digest(scope+'|'+text(option.textContent))}; }));
          if (fast !== current || !frame || frame.contentDocument !== page) return;
          options = options.filter(function (option) { return option.value && !/^(select|choose|please)\b/i.test(option.label); }); fast.payments = options;
          var selected = savedChoice(options,fast.paymentFingerprint || storage.getItem(preferenceKey));
          if (!selected || fast.addPayment) {
            if (!fast.addPayment && !selected) { haltFast('Add a payment method to continue.'); return; }
            var newCard = page.getElementById('ctl00_PageBody_rbCreditCard'), next = page.getElementById('ctl00_PageBody_btnContinue_CardOnFileView');
            if (!newCard || !next) { haltFast('New payment is unavailable.'); return; }
            fast.addPayment = false; fast.securePayment = true; page.documentElement.dataset.bnPaymentContinued = '1'; newCard.checked = true; newCard.dispatchEvent(new child.Event('change',{bubbles:true})); next.click(); return;
          }
          fast.paymentFingerprint = selected.fingerprint; fastText('[data-bn-payment]', '•••• '+(selected.label.match(/\b\d{4}\b/)?.[0] || 'Saved payment'));
          var stored = page.getElementById('ctl00_PageBody_rbStoredCard'), paymentContinue = page.getElementById('ctl00_PageBody_btnContinue_CardOnFileView');
          if (!stored || !paymentContinue) { haltFast('Choose another payment method.'); return; }
          await checkIdentity(); if (fast !== current || !frame || frame.contentDocument !== page) return;
          page.documentElement.dataset.bnPaymentContinued = '1'; stored.checked = true; cards.value = selected.value; cards.dispatchEvent(new child.Event('change',{bubbles:true})); status('Getting the final total…'); paymentContinue.click(); return;
        }
        var shippingContinue = page.getElementById('ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView');
        if (shippingContinue) {
          var select = page.getElementById('ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_DeliveryOptionsDropDownList');
          if (select) {
            fast.shippingOptions = Array.from(select.options).filter(function (option) { return !option.disabled && /\$/.test(option.textContent); }).map(function (option) { return {value:option.value,label:text(option.textContent)}; });
            if (!fast.shippingOptions.length && fast.method!=='pickup') return;
            if (fast.method === 'ship' && fast.shippingValue && !fast.shippingOptions.some(function (option) { return option.value===fast.shippingValue; })) { haltFast('The shipping options changed. Choose again.'); return; }
            var choice = fast.shippingValue || fast.shippingOptions[0]?.value;
            if (choice && select.value !== choice) { setNative(child,select,choice); fast.shippingValue = choice; return; }
            fast.shippingValue = choice || '';
          }
          updateFastOptions();
          if (!page.documentElement.dataset.bnShippingContinued) { page.documentElement.dataset.bnShippingContinued = '1'; status('Getting the final total…'); shippingContinue.click(); }
          return;
        }
        if (fast.securePayment) {
          frame.classList.add('bn-frame-open'); frame.removeAttribute('aria-hidden'); frame.removeAttribute('tabindex'); loading(false); status('Add your payment securely below.'); return;
        }
      } finally { if (fast === current) fast.driving = false; }
    }
    async function submitNative(control, page) {
      if (submitting || busy || !active || active.phase !== 'checking_out') return;
      if (fast && (!fast.ready || fast.loading || fast.editor || !fast.review)) return;
      var approvedReview = fast?.review?.signature;
      busy = true;
      if (fast) { fast.ready = false; loading(true); }
      try {
        await checkIdentity();
        var fresh = await cart();
        if (signature(fresh.items) !== signature(active.current)) throw new Error('The cart changed before confirmation. The order was not submitted.');
        blocked = await purchaseRestrictions();
        if (active.current.some(function (item) { return blocked.has(item.pid); })) throw new Error('A product is no longer eligible for online purchase. The order was not submitted.');
        var summary = page.getElementById('summary');
        if (!summary || !text(summary.textContent).includes(active.id)) throw new Error('WebTrack did not retain the Buy now order note. The order was not submitted.');
        var grid = page.getElementById('ctl00_PageBody_ShoppingCartSummaryTableControl_BasketLinesGrid_ctl00');
        var reviewed = Array.from(grid ? grid.querySelectorAll('tr.rgRow,tr.rgAltRow') : []).map(function (row) {
          var cells = row.querySelectorAll('td');
          return {code:text(cells[0]?.textContent),quantity:Number(text(cells[3]?.textContent).replace(/,/g,'')),unit:text(cells[4]?.textContent)};
        });
        assertReview(reviewed, active.current);
        if (fast && readNativeReview(page).signature !== approvedReview) throw new Error('The final total changed. Review your updated order before placing it.');
        if (!frame || frame.contentDocument !== page) throw new Error('The checkout screen changed. Review the order again before confirming.');
        if (!page.getElementById('ctl00_PageBody_CompleteCheckoutButton')) throw new Error('WebTrack final review is unavailable.');
        if (cancelPending) { cancelPending = false; busy = false; await cancel(); return; }
        active.phase = 'submitting'; save(); submitting = true; busy = false;
        status('Placing your order…');
        var nativeFinal = page.getElementById('ctl00_PageBody_CompleteCheckoutButton');
        permittedFinal = nativeFinal;
        try { nativeFinal.click(); } finally { permittedFinal = null; }
        // A lost response is never retried or treated as a failed order.
        win.setTimeout(function () {
          if (!active || active.phase !== 'submitting') return;
          active.phase = 'uncertain'; save(); status('WebTrack has not confirmed the result. Check your order history before trying again. Your cart backup is retained.', true);
        }, 45000);
      } catch (error) { busy = false; throw error; }
    }
    function locateProduct(control) {
      if (/\/ProductDetail\.aspx$/i.test(win.location.pathname)) {
        var id = new URL(win.location.href).searchParams.get('pid');
        var qty = doc.querySelector('input[id$="_qty_' + id + '"]');
        return id && qty ? { pid: id, quantity: Number(qty.value) || 1 } : null;
      }
      var parent = control.parentElement;
      for (var depth = 0; parent && depth < 7; depth++, parent = parent.parentElement) {
        var quantities = parent.querySelectorAll('input[id*="_qty_"]:not([type="hidden"]),input[id$="_ProductQuantity"]:not([type="hidden"])');
        if (quantities.length !== 1) continue;
        var match = quantities[0].id.match(/_qty_(\d+)/);
        if (match) return { pid: match[1], quantity: Number(quantities[0].value) || 1 };
        var products = new Set(Array.from(parent.querySelectorAll('a[href]')).map(function (link) { return pidOf(link.getAttribute('href')); }).filter(Boolean));
        if (products.size === 1) return { pid: Array.from(products)[0], quantity: Number(quantities[0].value) || 1 };
      }
      return null;
    }
    function addButtons() {
      if (!ENABLE_NEW_STARTS || !blocked || !/\/(?:ProductDetail|Products)\.aspx$/i.test(win.location.pathname)) return;
      doc.querySelectorAll('a[id*="AddProductButton"],input[id*="AddProductButton"],button[id*="AddProductButton"]').forEach(function (control) {
        var product = locateProduct(control);
        if (control.dataset.bnAttached || control.disabled || control.classList.contains('disabled') || control.getAttribute('aria-disabled') === 'true' || !product || blocked.has(product.pid) || PALLET_PRODUCTS.has(product.pid)) return;
        control.dataset.bnAttached = '1';
        var buy = button('Buy now', function () {
          var item = locateProduct(control);
          if (!item || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 9999) { notice('Choose a whole-number quantity before using Buy now.'); return; }
          start(item.pid, item.quantity).catch(function (error) { if (overlay) showError(error); else notice(error.message); });
        });
        buy.classList.add('wl-buy-now-button'); control.insertAdjacentElement('afterend', buy);
      });
    }
    function installStyles() {
      var style = doc.createElement('style'); style.id = 'wl-buy-now-styles';
      style.textContent = "#wl-buy-now{position:fixed;inset:0;z-index:2147483000;background:#16101591;display:flex;align-items:center;justify-content:center;padding:20px;font:14px/1.4 system-ui,-apple-system,sans-serif;color:#25282b;backdrop-filter:blur(3px)}\n#wl-buy-now *{box-sizing:border-box}#wl-buy-now [hidden]{display:none!important}.bn-panel{display:flex;flex-direction:column;width:min(100%,500px);max-height:94dvh;background:#fff;border-radius:18px;box-shadow:0 22px 80px #0005;overflow:hidden;position:relative}.bn-head{display:flex;align-items:center;justify-content:space-between;padding:19px 22px 13px}.bn-head h2{font:750 24px/1.15 system-ui;margin:0 0 3px}.bn-head small{font-size:11px;color:#7d6a6d}.bn-head .bn-action{border:0;padding:7px 0 7px 14px;color:#71666a;background:transparent;min-height:38px;font-size:13px}.bn-progress{display:flex;gap:9px;align-items:center;padding:10px 22px;background:#f6f3f0;color:#68575a;font-size:12px;min-height:36px}.bn-progress .bn-error{color:#9b241e}.bn-spinner{width:14px;height:14px;flex:none;border:2px solid #dcc5ca;border-top-color:#6b0016;border-radius:50%;display:none}.bn-loading .bn-spinner{display:block;animation:bn-spin .8s linear infinite}.bn-body{padding:20px 22px 14px;overflow:auto;min-height:0}.bn-product{display:flex;gap:14px;align-items:center;margin-bottom:18px}.bn-product h3{font-size:15px;line-height:1.4;margin:0 0 6px;font-weight:650}.bn-product span{font-size:12px;color:#777}.bn-product [data-bn-photo]{width:56px;height:62px;border-radius:8px;background:#f5f4f1;flex:none;display:grid;place-items:center}.bn-product img{width:52px;height:58px;object-fit:contain}.bn-methods{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:17px}.bn-methods button{border:1px solid #dedbd9;border-radius:11px;background:#fff;padding:12px 5px 11px;display:flex;flex-direction:column;align-items:center;gap:5px;color:#4e4648;cursor:pointer;min-height:105px;font:inherit}.bn-methods svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}.bn-methods strong{font-size:13px}.bn-methods small{font-size:10px;line-height:1.3}.bn-methods [aria-pressed=true]{background:#fcf5f6;border:2px solid #6b0016;padding:11px 4px 10px;color:#6b0016}.bn-methods [data-available=false]{opacity:.45}.bn-methods button:disabled{cursor:default}.bn-loading .bn-methods small{opacity:.55}.bn-options{border:1px solid #e6e2df;border-radius:11px;overflow:hidden}.bn-option{display:flex;gap:11px;align-items:center;padding:12px 13px}.bn-option+.bn-option{border-top:1px solid #eeeae7}.bn-option-icon{font-size:22px;color:#907b80;width:23px;text-align:center;flex:none}.bn-option>div{display:grid;gap:3px;min-width:0;flex:1}.bn-option strong{font-size:12px;font-weight:650}.bn-option div>span{font-size:12px;color:#777;overflow-wrap:anywhere}.bn-option button,.bn-more{color:#6b0016;background:none;border:0;font:600 12px system-ui;cursor:pointer;padding:8px 0 8px 8px;min-height:36px}.bn-option button:disabled,.bn-more:disabled{opacity:.45;cursor:default}.bn-extras{display:flex;justify-content:space-between;align-items:center;width:100%;padding:12px 13px;margin-top:12px;background:#f8f6f3;border:1px dashed #dacdd0;border-radius:9px;color:#6b0016;font:600 12px system-ui;text-align:left;cursor:pointer;min-height:44px}.bn-extras:disabled{opacity:.6;cursor:default}.bn-more{font-weight:400;padding-left:0;margin:3px 0 0}.bn-totals{border-top:1px solid #e9e4e1;margin-top:7px;padding-top:12px;display:grid;gap:6px;font-size:12px;color:#6c6768}.bn-totals>div{display:flex;justify-content:space-between;gap:12px}.bn-totals .bn-grand{font-size:17px;color:#25282b;padding-top:9px;margin-top:4px;border-top:1px solid #eee9e7}.bn-action{border:1px solid #6b0016;background:#6b0016;color:white;border-radius:8px;padding:11px 16px;font:650 14px/1.4 system-ui;cursor:pointer;min-height:44px}.bn-action:disabled{opacity:.5;cursor:wait}.bn-secondary{background:white;color:#6b0016}.bn-confirm{width:100%;margin-top:14px;min-height:47px;font-size:15px}.bn-terms{font-size:10px;color:#888;text-align:center;margin:10px 0 0}.bn-terms a{color:inherit;text-decoration:underline}.wl-buy-now-button{margin:6px;white-space:nowrap}.bn-frame{position:fixed!important;left:-12000px!important;top:0!important;width:1000px!important;height:800px!important;opacity:0;pointer-events:none;border:0}.bn-frame.bn-frame-open{position:relative!important;left:auto!important;top:auto!important;width:100%!important;height:60dvh!important;opacity:1;pointer-events:auto;margin-top:16px}.bn-success{font-size:48px;color:#297048;text-align:center}.bn-body:has(.bn-success){text-align:center;padding:30px}.bn-notice{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:white;border:1px solid #6b0016;box-shadow:0 4px 20px #0003;padding:12px;z-index:2147482999;max-width:calc(100% - 24px);font:14px/1.5 system-ui}.bn-notice button{margin-left:12px}.bn-panel [data-bn-editor]{border:1px solid #decdd1;border-radius:10px;padding:15px;margin:8px 0 14px;background:#fdfbfa}.bn-panel [data-bn-editor] h3{font-size:16px;margin:0 0 12px}.bn-panel [data-bn-editor] label{display:grid;gap:5px;font-size:12px;margin:10px 0}.bn-panel [data-bn-editor] input,.bn-panel [data-bn-editor] select,.bn-panel [data-bn-editor] textarea{width:100%;min-width:0;padding:10px;border:1px solid #c9c1c1;border-radius:6px;background:#fff;font:14px system-ui}.bn-panel [data-bn-editor] .bn-check{display:flex;gap:10px;align-items:center}.bn-panel [data-bn-editor] .bn-check input{width:19px;height:19px;flex:none}.bn-editor-actions{display:flex;gap:8px;margin-top:14px}.bn-loading .bn-totals [data-bn-total]{color:#a59a9d}.bn-panel button:focus-visible,.bn-panel input:focus-visible,.bn-panel select:focus-visible{outline:3px solid #9c5565;outline-offset:2px}@keyframes bn-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.bn-loading .bn-spinner{animation:none;border-top-width:4px}}@media(max-width:540px){#wl-buy-now{padding:0;align-items:flex-end}.bn-panel{max-height:100dvh;width:100%;border-radius:18px 18px 0 0}.bn-head{padding:16px 18px 12px}.bn-body{padding:16px 18px 13px}.bn-progress{padding-left:18px}.bn-product{margin-bottom:15px}.bn-methods{gap:7px}.bn-methods button{min-height:100px}.bn-terms{margin-bottom:env(safe-area-inset-bottom,0)}}\n.bn-footer{padding:13px 22px 15px;border-top:1px solid #e9e4e1;background:#fff;flex:none}.bn-footer .bn-totals{margin:0;border:0;padding:0;gap:4px}.bn-footer .bn-grand{padding-top:7px;margin-top:3px}.bn-footer .bn-confirm{margin-top:11px}.bn-footer .bn-terms{margin-top:8px}.bn-product{margin-bottom:14px}.bn-methods{margin-bottom:14px}.bn-methods button{min-height:89px;padding-top:8px;padding-bottom:8px}.bn-methods [aria-pressed=true]{padding-top:7px;padding-bottom:7px}.bn-option{padding:9px 12px}.bn-option div>span{line-height:1.25}.bn-more{min-height:32px;padding-top:6px;padding-bottom:6px}.bn-progress:has(.bn-error){background:#fff0ed}.bn-panel:not([aria-busy=true]) .bn-spinner{display:block;border:0;width:14px;height:14px}.bn-panel:not([aria-busy=true]) .bn-spinner:after{content:'✓';color:#3c7753;font-size:15px}.bn-panel:has(.bn-error) .bn-spinner:after{content:'!';color:#a03028}.bn-body:has([data-bn-editor]:not([hidden]))~.bn-footer .bn-terms{display:none}@media(max-width:540px){.bn-footer{padding:12px 18px max(12px,env(safe-area-inset-bottom,0))}.bn-body{padding-bottom:8px}.bn-methods button{min-height:86px}}\n";
      doc.head.appendChild(style);
    }
    installStyles();
    var pending = record();
    if (pending) {
      await withLock(async function () {
        active = pending; active.owner = owner; shell('Recover your Buy now cart');
        if (['submitting', 'uncertain'].includes(active.phase)) {
          status('A previous order has an unconfirmed result. Check order history before another purchase. Your original cart backup is retained.', true);
          var link = doc.createElement('a'); link.href = '/AccountInfo_R.aspx'; link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'Open account and order history'; overlay.querySelector('[data-bn-body]').appendChild(link);
        } else { status('An earlier Buy now did not finish restoring your cart. Restore it before starting another.'); showRestoreButton(); }
      }).catch(function (error) { if (overlay) showError(error); else notice(error.message); });
    } else {
      blocked = await purchaseRestrictions();
      addButtons();
      var observer = new win.MutationObserver(addButtons); observer.observe(doc.body, { childList: true, subtree: true });
    }
    win.addEventListener('storage', function (event) {
      if (event.key !== key || !overlay || !active) return;
      var latest;
      try { latest = record(); } catch (error) { showError(error); return; }
      if (latest && latest.owner !== owner) { busy = true; clearFrame(); status('Buy now is active in another tab. Cart changes have stopped here.', true); }
    });
  }
  return { boot: boot, build: BUILD, audience: USER, lines: lines, signature: signature, plan: plan, nextMutation: nextMutation, afterMutation: afterMutation, assertExpected: assertExpected, recoveryTarget: recoveryTarget, assertReview: assertReview, marker: marker, savedChoice: savedChoice, loginFromDocument: loginFromDocument, readRecord: readRecord, persist: persist, targetOf: targetOf, mainAddress: mainAddress, readableCart: readableCart, dateChoice: dateChoice, firstDate: firstDate, money: money, reviewTotals: reviewTotals };
});
