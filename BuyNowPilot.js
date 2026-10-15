/* Woodson Buy Now pilot. Native WebTrack forms only. Audience stays ckunkel2. */
(function (root, factory) {
  'use strict';
  var core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else core.boot(root).catch(function () { /* An unavailable pilot leaves native shopping alone. */ });
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  var BUILD = '20261015-ckunkel2-1';
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
  function marker(record) { return 'Website Buy Now | ' + record.id + ' | Additional cart items: ' + record.extraCount; }
  function savedChoice(options, preferred) {
    var available = options.filter(function (option) { return option.value && !/^(select|choose|please)\b/i.test(text(option.label)); });
    var matches = preferred ? available.filter(function (option) { return option.fingerprint === preferred; }) : [];
    return matches.length === 1 ? matches[0] : available[0] || null;
  }
  function mainAddress(rawLines) {
    var values = (rawLines || []).map(text).filter(Boolean);
    for (var i = 1; i < values.length; i++) {
      var locality = values[i].match(/^(.+?)[,\s]+(Texas|[A-Z]{2})\s*,?\s*(\d{5}(?:-\d{4})?)$/i);
      if (!locality) continue;
      var street = values.slice(0, i), start = street.findIndex(function (value) { return /^\d+\b|^P\.?\s*O\.?\s*Box\b/i.test(value); });
      if (start < 0 || street.length - start > 3) return null;
      street = street.slice(start);
      return {line1:street[0],line2:street[1]||'',line3:street[2]||'',city:text(locality[1]).replace(/,$/,''),stateValue:/^Texas$/i.test(locality[2])?'TX':locality[2].toUpperCase(),stateText:locality[2],zip:locality[3],countryValue:'USA',countryText:'United States'};
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
    var previousFocus = null, previousOverflow = '', busy = false, submitting = false, frameObserver = null, frameTimer = null, permittedFinal = null;
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
      var currentSettings = await authenticate();
      var fresh = await fetchDocument('/AccountInfo_R.aspx');
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
    }
    function button(label, handler, secondary) {
      var el = doc.createElement('button'); el.type = 'button'; el.className = 'bn-action' + (secondary ? ' bn-secondary' : ''); el.textContent = label;
      el.addEventListener('click', handler); return el;
    }
    function clearFrame() {
      if (frameObserver) frameObserver.disconnect(); frameObserver = null;
      if (frameTimer) win.clearTimeout(frameTimer); frameTimer = null;
      if (frame) { frame.remove(); frame = null; }
    }
    function dismiss() {
      clearFrame();
      if (overlay) overlay.remove(); overlay = null;
      doc.body.style.overflow = previousOverflow;
      if (previousFocus && previousFocus.isConnected) previousFocus.focus();
      if (releaseLock) releaseLock(); releaseLock = null;
      active = null; busy = false; submitting = false;
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
      var label = doc.createElement('small'); label.textContent = 'Private pilot · ckunkel2';
      var copy = doc.createElement('div'); copy.append(heading, label);
      head.append(copy, button('Cancel', function () { cancel().catch(showError); }, true));
      var message = doc.createElement('p'); message.dataset.bnStatus = ''; message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite');
      var body = doc.createElement('div'); body.className = 'bn-body'; body.dataset.bnBody = '';
      panel.append(head, message, body); overlay.appendChild(panel); doc.body.appendChild(overlay); doc.body.style.overflow = 'hidden';
      overlay.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') { event.preventDefault(); cancel().catch(showError); }
        if (event.key !== 'Tab') return;
        var focusable = Array.from(panel.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select,iframe')).filter(function (el) { return !el.hidden && el.offsetParent; });
        if (!focusable.length) return;
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
      });
      head.querySelector('button').focus();
    }
    function showError(error) {
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
      if (!rows.length && !page.querySelector('#ctl00_PageBody_ShoppingCartDetailPanel,.ShoppingCartDetailPanel,#ctl00_PageBody_EmptyCartPanel') && !/cart\s+is\s+empty|no\s+items\s+in\s+(?:your\s+)?(?:shopping\s+)?cart/i.test(page.body.textContent)) {
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
      for (var i = 0; i < items.length; i++) {
        var info = await product(items[i].pid);
        if (info.name) items[i].name = info.name;
        if (info.code.toUpperCase() !== items[i].code.toUpperCase() || info.unit !== items[i].unit) throw new Error('A cart line differs from its standard product. Please use regular checkout.');
        var selectedUnit = info.doc.querySelector('select[id*="Per"],select[id*="UOM"],select[id*="Unit"]');
        if (selectedUnit || (items[i].unit && !/^(ea|each|pc|pcs|bag|box|pack|pair|roll|set|gal|lb)$/i.test(items[i].unit))) throw new Error('This cart uses a unit that has not been proven restorable. Please use regular checkout.');
      }
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
      if (busy) { status('Please wait for the current cart change to finish before cancelling.'); return; }
      if (!active) { dismiss(); return; }
      busy = true; clearFrame();
      var wanted = recoveryTarget(active);
      active.phase = 'restoring'; save(); status('Restoring and checking your saved cart…');
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
    async function start(id, quantity) {
      if (!ENABLE_NEW_STARTS || overlay || busy) return;
      await withLock(async function () {
        shell('Buy now'); status('Checking this product and your current cart…'); busy = true;
        await checkIdentity();
        blocked = await purchaseRestrictions();
        if (record()) throw new Error('An earlier Buy now needs cart recovery first. Reload this page to recover it.');
        var before = await cart(), info = await product(id);
        await preflight(before.items);
        var primary = { pid: id, quantity: quantity, name: info.name, code: info.code, unit: info.unit };
        await preflight([primary]);
        // Read native metadata using an untouched cart only after preparation; no estimated price is a final total.
        var body = overlay.querySelector('[data-bn-body]');
        var summary = doc.createElement('p'); summary.textContent = (info.name || 'Selected product') + ' · Quantity ' + quantity; body.appendChild(summary);
        var selection = doc.createElement('fieldset'), legend = doc.createElement('legend'); legend.textContent = before.items.length ? 'Also in your cart — include any in this order?' : 'Your cart is empty'; selection.appendChild(legend);
        before.items.forEach(function (item) {
          var label = doc.createElement('label'); label.className = 'bn-cart-line';
          var check = doc.createElement('input'); check.type = 'checkbox'; check.value = item.pid;
          label.append(check, doc.createTextNode((item.name || item.code) + ' · Qty ' + item.quantity)); selection.appendChild(label);
        });
        if (before.items.length > 1) selection.appendChild(button('Select all cart items', function () { selection.querySelectorAll('input').forEach(function (el) { el.checked = true; }); }, true));
        body.appendChild(selection);
        var hint = doc.createElement('p'); hint.className = 'bn-hint'; hint.textContent = 'Your saved address and payment options stay editable in secure checkout. WebTrack will show shipping, tax, and the final total before you place the order. Unselected cart items will be restored.'; body.appendChild(hint);
        var defaultAddress = mainAddress(Array.from(account.querySelectorAll('.accountInfoAddress li')).map(function (el) { return el.textContent; }));
        if (defaultAddress) {
          var addressCopy = doc.createElement('p'); addressCopy.textContent = 'Main account address: ' + [defaultAddress.line1, defaultAddress.line2, defaultAddress.city, defaultAddress.stateValue, defaultAddress.zip].filter(Boolean).join(', ') + '. You can change it in checkout.'; body.appendChild(addressCopy);
        }
        var proceed = button('Continue to secure checkout', async function () {
          if (busy) return;
          busy = true; proceed.disabled = true;
          try {
            await checkIdentity();
            var current = await cart();
            if (signature(current.items) !== signature(before.items)) throw new Error('Your cart changed. Cancel and reopen Buy now.');
            var selected = Array.from(selection.querySelectorAll('input:checked')).map(function (el) { return el.value; });
            var planned = plan(before.items, primary, selected);
            var sessionKeys = ['wl_fulfillment_intent', 'wl_fulfillment_method', 'wl_fulfillment_selection_source_v1', 'wl_confirmed_fulfillment_v1', 'wl_checkout_form_snapshot_v2', 'wl_checkout_single_page_preview', 'wl_shipping_selection_v1', 'wl_shipping_offer_v1', 'wl_checkout_date_state_v2', 'wl_checkout_auto_advance', 'wl_checkout_address_payload', 'wl_checkout_contact_payload'];
            var sessionBefore = {}; sessionKeys.forEach(function (name) { sessionBefore[name] = win.sessionStorage.getItem(name); });
            var draft = { version: 1, scope: scope, branch: branch, id: 'BN-' + win.crypto.randomUUID(), owner: owner, phase: 'backed_up', createdAt: Date.now(), original: planned.original, purchase: planned.purchase, remaining: planned.remaining, current: current.items, pending: null, extraCount: selected.length };
            // Keep form/address state in this browser session, out of the durable cart record.
            win.sessionStorage.setItem(PREFIX + 'session:' + draft.id, JSON.stringify(sessionBefore));
            persist(storage, key, draft);
            active = draft;
            // Old shipping offers and dates belong to the old basket. Requote the isolated basket.
            sessionKeys.forEach(function (name) { win.sessionStorage.removeItem(name); });
            win.sessionStorage.setItem('wl_checkout_single_page_preview', '1');
            var address = mainAddress(Array.from(account.querySelectorAll('.accountInfoAddress li')).map(function (el) { return el.textContent; }));
            if (address) {
              var first = text(settings.getElementById('ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput')?.value);
              var last = text(settings.getElementById('ctl00_PageBody_ChangeUserDetailsControl_LastNameInput')?.value);
              address.contactName = [first, last].filter(Boolean).join(' ');
              address.email = text(settings.getElementById('ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput')?.value);
              address.phone = text(account.getElementById('ctl00_PageBody_TelephoneLink_TelephoneLink')?.textContent);
              address.ts = Date.now(); win.sessionStorage.setItem('wl_checkout_address_payload', JSON.stringify(address));
            }
            active.phase = 'preparing'; save(); status('Your cart is backed up. Preparing secure checkout…');
            await reconcile(planned.purchase);
            active.phase = 'checking_out'; save(); body.replaceChildren(); busy = false;
            openFrame(body);
          } catch (error) { showError(error); if (!active) proceed.disabled = false; }
        });
        body.appendChild(proceed); status('Choose any extra items, then continue. No order is placed until you confirm the final total.'); busy = false;
      });
    }
    function openFrame(body) {
      frame = doc.createElement('iframe'); frame.title = 'Secure WebTrack Buy now checkout'; frame.className = 'bn-frame'; frame.name = 'woodson-buy-now-checkout';
      frame.addEventListener('load', function () { installFrame().catch(showError); });
      frame.src = '/ShoppingCart.aspx?wlCheckout=single'; body.appendChild(frame);
    }
    async function installFrame() {
      if (!frame || !active) return;
      var child = frame.contentWindow, page;
      try { page = frame.contentDocument; if (child.location.origin !== ORIGIN) page = null; } catch (_) { page = null; }
      if (!page) {
        status('Complete the secure payment step, then return here. Your cart recovery copy is retained.'); return;
      }
      if (frameObserver) frameObserver.disconnect();
      var style = page.createElement('style');
      style.textContent = '#PageHeaderDiv,#PageFooterDiv,#siteHeaderContent,#savedForLater{display:none!important}body{padding:0!important}#MainLayoutRow{margin:8px auto!important}';
      page.head.appendChild(style);
      page.querySelectorAll('.shopping-cart-item input.riTextBox,.shopping-cart-item input[id*="_qty_"]:not([type="hidden"])').forEach(function (input) { input.readOnly = true; });
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
        var done = button('Continue shopping', dismiss); overlay.querySelector('[data-bn-body]').prepend(done); return;
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
      var complete = page.getElementById('ctl00_PageBody_CompleteCheckoutButton');
      if (complete) { status('Review the address, payment, shipping, tax, and final total below. Complete Order places this Buy now order.'); return; }
      var cards = page.getElementById('ctl00_PageBody_ddlCardsOnFile');
      if (cards && cards.options.length) { await paymentPicker(child, page, cards); return; }
      var checkout = page.getElementById('ctl00_PageBody_PlaceOrderButton');
      if (checkout && page.querySelector('.shopping-cart-item') && !page.documentElement.dataset.bnCheckoutOpened) {
        page.documentElement.dataset.bnCheckoutOpened = '1';
        status('Opening WebTrack checkout for your selected items…'); checkout.click(); return;
      }
      status('Confirm your saved address and delivery details below. Shipping and tax will be calculated by WebTrack.');
    }
    async function paymentPicker(child, page, cards) {
      if (page.getElementById('bn-payment-choice')) return;
      var options = await Promise.all(Array.from(cards.options).map(async function (option) {
        return { value: option.value, label: text(option.textContent), fingerprint: await digest(scope + '|' + text(option.textContent)) };
      }));
      var preferred = storage.getItem(preferenceKey), selected = savedChoice(options, preferred);
      if (!selected) { status('Add a payment method using WebTrack below, then review the order.'); return; }
      var section = page.createElement('section'); section.id = 'bn-payment-choice'; section.style.cssText = 'padding:16px;border:1px solid #d7c3c6;border-radius:8px;margin:12px;background:#fff';
      var label = page.createElement('label'); label.textContent = 'Buy now payment '; label.htmlFor = 'bn-payment-method'; var select = page.createElement('select'); select.id = 'bn-payment-method';
      options.filter(function (option) { return option.value; }).forEach(function (option) { var el = page.createElement('option'); el.value = option.value; el.textContent = option.label; select.appendChild(el); }); select.value = selected.value; label.appendChild(select);
      var rememberLabel = page.createElement('label'); rememberLabel.style.cssText = 'display:block;margin:12px 0';
      var remember = page.createElement('input'); remember.type = 'checkbox'; remember.checked = !!preferred;
      rememberLabel.append(remember, page.createTextNode(' Remember this payment for Buy now on this browser'));
      var review = page.createElement('button'); review.type = 'button'; review.textContent = 'Use this payment and review order'; review.className = 'epi-button';
      review.addEventListener('click', async function () {
        review.disabled = true;
        try {
          await checkIdentity();
          var option = options.find(function (item) { return item.value === select.value; });
          if (!option || !Array.from(cards.options).some(function (item) { return item.value === option.value && text(item.textContent) === option.label; })) throw new Error('The saved payment list changed. Choose it again in WebTrack.');
          if (remember.checked) storage.setItem(preferenceKey, option.fingerprint); else storage.removeItem(preferenceKey);
          var stored = page.getElementById('ctl00_PageBody_rbStoredCard');
          if (!stored) throw new Error('WebTrack saved-payment controls are unavailable.');
          stored.checked = true; cards.value = option.value; cards.dispatchEvent(new child.Event('change', { bubbles: true }));
          var next = page.getElementById('ctl00_PageBody_btnContinue_CardOnFileView');
          if (!next) throw new Error('WebTrack payment continuation is unavailable.'); next.click();
        } catch (error) { review.disabled = false; showError(error); }
      });
      var hint = page.createElement('p'); hint.textContent = 'You can also choose another method or add a new card using WebTrack below. This step does not place the order.';
      var add = page.createElement('button'); add.type = 'button'; add.textContent = 'Add new payment'; add.className = 'epi-button';
      add.addEventListener('click', function () {
        var newCard = page.getElementById('ctl00_PageBody_rbCreditCard');
        var next = page.getElementById('ctl00_PageBody_btnContinue_CardOnFileView');
        if (!newCard || !next) { showError(new Error('Use the native new-payment option below.')); return; }
        newCard.checked = true; newCard.dispatchEvent(new child.Event('change', { bubbles: true })); next.click();
      });
      hint.textContent = 'Selecting payment opens final order review. Your payment details stay with WebTrack.';
      section.append(label, rememberLabel, review, add, hint);
      (cards.closest('.mainContents') || cards.parentElement).prepend(section);
      var pickerStyle = page.createElement('style'); pickerStyle.textContent = '.wl-card-picker{display:none!important}#bn-payment-choice select{max-width:100%;padding:8px}#bn-payment-choice button{margin:6px 8px 6px 0}'; page.head.appendChild(pickerStyle);
      status('Your saved payment is selected below. Change it or add a new method, then review the final total.');
    }
    async function submitNative(control, page) {
      if (submitting || busy || !active || active.phase !== 'checking_out') return;
      busy = true;
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
        if (!frame || frame.contentDocument !== page) throw new Error('The checkout screen changed. Review the order again before confirming.');
        if (!page.getElementById('ctl00_PageBody_CompleteCheckoutButton')) throw new Error('WebTrack final review is unavailable.');
        active.phase = 'submitting'; save(); submitting = true; busy = false;
        status('Submitting once through WebTrack. Waiting for its order confirmation…');
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
      style.textContent = '#wl-buy-now{position:fixed;inset:0;z-index:2147483000;background:#0008;display:flex;align-items:center;justify-content:center;padding:16px;font:15px/1.5 system-ui;color:#252525}#wl-buy-now *{box-sizing:border-box}.bn-panel{display:flex;flex-direction:column;width:min(100%,1000px);max-height:94vh;background:#fff;border-radius:12px;box-shadow:0 16px 60px #0005;overflow:hidden}.bn-head{display:flex;gap:16px;align-items:center;justify-content:space-between;border-bottom:1px solid #ddd;padding:16px 20px}.bn-head h2{font:700 23px/1.2 system-ui;margin:0 0 4px}.bn-head small{color:#6b0016}.bn-body{padding:16px 20px;overflow:auto;min-height:0}.bn-panel [data-bn-status]{padding:12px 20px;margin:0;background:#f5f2ef}.bn-panel .bn-error{background:#fff0ed;color:#8c2216}.bn-action{border:1px solid #6b0016;background:#6b0016;color:white;border-radius:6px;padding:11px 16px;font:600 15px/1.4 system-ui;cursor:pointer;min-height:44px}.bn-action:disabled{opacity:.55;cursor:wait}.bn-secondary{background:white;color:#6b0016}.wl-buy-now-button{margin:6px;white-space:nowrap}.bn-cart-line{display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid #ddd}.bn-cart-line input{width:20px;height:20px;flex:none}.bn-body fieldset{border:1px solid #ddd;border-radius:8px;padding:12px}.bn-body legend{font-size:16px;font-weight:650;padding:0 6px}.bn-hint{color:#555}.bn-frame{width:100%;height:64vh;border:0;display:block}.bn-notice{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:white;border:1px solid #6b0016;box-shadow:0 4px 20px #0003;padding:12px;z-index:2147482999;max-width:calc(100% - 24px);font:15px/1.5 system-ui}.bn-notice button{margin-left:12px}@media(max-width:600px){#wl-buy-now{padding:0;align-items:stretch}.bn-panel{max-height:100dvh;height:100dvh;border-radius:0}.bn-head,.bn-body{padding:12px}.bn-panel [data-bn-status]{padding:10px 12px}.bn-frame{height:calc(100dvh - 180px)}.bn-head h2{font-size:21px}}';
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
  return { boot: boot, build: BUILD, audience: USER, lines: lines, signature: signature, plan: plan, nextMutation: nextMutation, afterMutation: afterMutation, assertExpected: assertExpected, recoveryTarget: recoveryTarget, assertReview: assertReview, marker: marker, savedChoice: savedChoice, loginFromDocument: loginFromDocument, readRecord: readRecord, persist: persist, targetOf: targetOf, mainAddress: mainAddress };
});
