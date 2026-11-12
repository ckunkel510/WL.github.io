/* Quantity-aware pickup estimates for the ordinary native checkout. No reservations or orders. */
(function (root, factory) {
  'use strict';
  var core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else root.WLPickupAvailability = core;
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  var BUILD = '20261112-pickup-1';
  var STORES = ['Brenham', 'Bryan', 'Caldwell', 'Lexington', 'Groesbeck', 'Mexia', 'Buffalo'];
  var MAX_AGE = 120000;
  function text(value) { return String(value || '').trim(); }
  function storeName(label) {
    return STORES.find(function (name) { return new RegExp('^' + name + '(?:\\s*[-,]|$)', 'i').test(text(label)); }) || '';
  }
  function calendar(now) {
    var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now || new Date());
    var value = Object.fromEntries(parts.map(function (part) { return [part.type, part.value]; }));
    return { date: value.year + '-' + value.month + '-' + value.day, minutes: Number(value.hour) * 60 + Number(value.minute) };
  }
  function iso(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
  }
  function after(value, days, business) {
    if (!iso(value)) return '';
    var date = new Date(value + 'T12:00:00Z');
    for (var left = days; left > 0;) { date.setUTCDate(date.getUTCDate() + 1); if (!business || (date.getUTCDay() > 0 && date.getUTCDay() < 6)) left--; }
    return date.toISOString().slice(0, 10);
  }
  function openDate(value) { return iso(value) && new Date(value + 'T12:00:00Z').getUTCDay() !== 0; }
  function nextOpen(value) { return openDate(value) ? value : after(value, 1); }
  function timeChoices(value, now) {
    if (!openDate(value)) return [];
    var current = calendar(now), day = new Date(value + 'T12:00:00Z').getUTCDay();
    if (value < current.date) return [];
    var start = value === current.date ? Math.max(480, Math.ceil((current.minutes + 120) / 60) * 60) : 480;
    var end = day === 6 ? 960 : 1050, choices = [];
    function label(minutes) { var hour = Math.floor(minutes / 60); return (hour % 12 || 12) + ':' + String(minutes % 60).padStart(2, '0') + ' ' + (hour >= 12 ? 'PM' : 'AM'); }
    for (var m = start; m + 60 <= end; m += 60) choices.push({ value: label(m) + '–' + label(m + 60), label: label(m) + ' – ' + label(m + 60) });
    return choices;
  }
  function stockFromDocument(page) {
    var table = page.querySelector('#StockDataGrid_ctl00'), branches = {}, valid = !!table;
    Array.from(table ? table.querySelectorAll('tbody tr') : []).forEach(function (row) {
      var name = storeName(row.querySelector('td[data-title="Branch"]')?.textContent);
      if (!name) return;
      var raw = text(row.querySelector('td[data-title="Available"]')?.textContent);
      if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(raw) || Object.prototype.hasOwnProperty.call(branches, name)) { valid = false; return; }
      branches[name] = Math.max(0, Number(raw.replace(/,/g, '')));
    });
    return { verified: valid && STORES.every(function (name) { return Number.isFinite(branches[name]); }), branches: branches };
  }
  function cartFromDocument(page) {
    if (!page.querySelector('a[href*="SignOut=1" i]') || !page.querySelector('#ctl00_PageBody_ShoppingCartDetailPanel')) throw Error('Basket unavailable');
    var items = [], seen = new Map();
    Array.from(page.querySelectorAll('#ctl00_PageBody_ShoppingCartDetailPanel .shopping-cart-item')).forEach(function (row) {
      var links = Array.from(row.querySelectorAll('a[href*="ProductDetail.aspx"]'));
      var link = links.find(function (el) { return /[?&]pid=\d+/i.test(el.getAttribute('href') || ''); });
      var input = row.querySelector('input[id*="_qty_"]:not([id$="_ClientState"])');
      if (!link && !input) return; // native column headings
      var pid = (link?.getAttribute('href') || '').match(/[?&]pid=(\d+)(?:&|$)/i)?.[1];
      var quantity = Number(row.querySelector('select.wl-qty-select')?.value || input?.value);
      if (!pid || !Number.isFinite(quantity) || quantity <= 0 || quantity > 999999) throw Error('Basket quantity unavailable');
      var code = text((row.querySelector('.portalGridLink,.cart-item-card h6 a') || links.find(function (el) { return text(el.textContent); }))?.textContent);
      var name = text(row.querySelector('.description,.ProductDescription,.cart-item-card p.small')?.textContent || link.parentElement?.nextElementSibling?.textContent || code).slice(0, 180);
      var configured = Array.from(row.querySelectorAll('input[id$="_txtSpecialProductCode"],input[id$="_txtSpecialProductDescription"]')).some(function (field) { return text(field.value); });
      if (seen.has(pid)) { seen.get(pid).quantity += quantity; seen.get(pid).configured ||= configured; return; } // do not allocate the same stock twice
      var item = { pid: pid, code: code || pid, name: name || code || pid, quantity: quantity, configured: configured };
      seen.set(pid, item); items.push(item);
    });
    if (!items.length) throw Error('Basket unavailable');
    return items;
  }
  function plan(items, stocks, label, now, choice) {
    var current = calendar(now), store = storeName(label), localDate = nextOpen(current.date);
    while (!timeChoices(localDate, now).length) localDate = nextOpen(after(localDate, 1));
    var transferDate = nextOpen(after(current.date, 2, true)), supplierDate = nextOpen(after(current.date, 14));
    var rows = items.map(function (item) {
      var stock = stocks[item.pid], verified = !item.configured && stock?.verified && store && STORES.every(function (name) { return Number.isFinite(stock.branches?.[name]) && stock.branches[name] >= 0; });
      var total = verified ? STORES.reduce(function (sum, name) { return sum + stock.branches[name]; }, 0) : null;
      var local = verified ? Math.min(item.quantity, stock.branches[store]) : 0;
      var transfer = verified ? Math.min(item.quantity - local, total - stock.branches[store]) : 0;
      var supplier = verified ? Math.max(0, item.quantity - local - transfer) : 0;
      return Object.assign({}, item, { local: local, transfer: transfer, supplier: supplier, unconfirmed: verified ? 0 : item.quantity, total: total });
    });
    var has = function (key) { return rows.some(function (row) { return row[key] > 0; }); };
    var delayed = has('transfer') || has('supplier') || has('unconfirmed');
    var canSplit = has('local') && delayed, split = choice === 'split' && canSplit;
    return { store: store, items: rows, localDate: localDate, transferDate: transferDate, supplierDate: supplierDate, delayed: delayed, canSplit: canSplit, split: split,
      min: split ? localDate : has('supplier') || has('unconfirmed') ? supplierDate : has('transfer') ? transferDate : localDate,
      max: after(current.date, 42), uncertain: has('supplier') || has('unconfirmed') };
  }
  function policyKey(policy) { return JSON.stringify([policy.store, policy.split, policy.min, policy.max, policy.items]); }
  function validSchedule(policy, date, time, now) {
    if (!policy || !policy.store) return false;
    var current = calendar(now), floor = policy.split ? current.date : policy.uncertain ? nextOpen(after(current.date, 14)) : policy.delayed ? nextOpen(after(current.date, 2, true)) : current.date;
    return openDate(date) && date >= policy.min && date >= floor && date <= policy.max && timeChoices(date, now).some(function (row) { return row.value === time; });
  }
  function instruction(policy, date, time) {
    if (!policy) return '';
    var lines = policy.items.map(function (row) {
      return row.code + ' qty ' + row.quantity + ': ' + [row.local ? row.local + ' local' : '', row.transfer ? row.transfer + ' transfer (usually 1–2 business days)' : '', row.supplier ? row.supplier + ' supplier order (usually 1–2 weeks; confirm lead time)' : '', row.unconfirmed ? row.unconfirmed + ' availability unconfirmed' : ''].filter(Boolean).join(', ');
    });
    return 'PICKUP REQUEST at ' + policy.store + ' — ' + (policy.split ? 'PARTIAL PICKUPS REQUESTED; first pickup for local quantities only' : 'HOLD FOR ONE COMPLETE PICKUP') +
      '; requested ' + date + (time ? ' ' + time : '') + '; ' + lines.join('; ') +
      (policy.delayed ? '; customer acknowledges estimates, no guaranteed ready date; store must confirm readiness' : '; wait for ready-for-pickup confirmation') +
      (policy.split ? '; contact customer to arrange remaining pickup(s)' : '');
  }
  function attach(win, options) {
    var doc = win.document, root = options.root, date = options.date, time = options.time;
    var panel = doc.createElement('section'); panel.id = 'wl-pickup-availability'; panel.className = 'wl-pickup-availability'; panel.setAttribute('aria-label', 'Pickup availability');
    panel.innerHTML = '<h3>Plan your pickup</h3><p class="wl-pa-status" role="status" aria-live="polite">Checking store and company inventory…</p><div class="wl-pa-items"></div>' +
      '<fieldset hidden class="wl-pa-choice"><legend>How would you like to pick up?</legend><label><input type="radio" name="wlPickupPlan" value="together" checked> One pickup when everything is ready</label><label><input type="radio" name="wlPickupPlan" value="split"> Pick up available items first</label></fieldset>' +
      '<p class="wl-pa-hint"></p><label hidden class="wl-pa-ack"><input type="checkbox"> I understand these are estimates. I’ll wait for Woodson to confirm my items are ready.</label>' +
      '<p hidden class="wl-pa-error" role="alert"></p><button type="button" class="wl-pa-retry">Recheck availability</button>';
    root.prepend(panel);
    if (!doc.getElementById('wl-pickup-availability-style')) {
      var style = doc.createElement('style'); style.id = 'wl-pickup-availability-style';
      style.textContent = '.wl-pickup-availability{border:1px solid #dfd6d0;border-radius:12px;background:#faf8f5;padding:18px;margin:0 0 20px;color:#343434}.wl-pickup-availability h3{font-size:20px;margin:0 0 8px;color:#670020}.wl-pickup-availability p{margin:8px 0;line-height:1.5}.wl-pa-item{padding:12px 0;border-top:1px solid #e4ded8;overflow-wrap:anywhere}.wl-pa-item strong{display:block}.wl-pa-item span{display:block;margin-top:4px;font-size:14px}.wl-pa-choice{border:0;padding:0;margin:14px 0}.wl-pa-choice legend{font-size:16px;font-weight:600}.wl-pickup-availability label{display:flex;align-items:flex-start;gap:9px;margin:8px 0;padding:10px 0;line-height:1.4}.wl-pickup-availability input{flex:none;width:18px;height:18px;margin-top:2px;accent-color:#670020}.wl-pickup-availability [hidden]{display:none!important}.wl-pa-hint{font-size:14px}.wl-pa-error{color:#9e172b;font-weight:600}.wl-pa-retry{min-height:44px;border:1px solid #8c6b70;border-radius:7px;background:#fff;color:#670020;padding:8px 14px}.wl-pa-ack{border-top:1px solid #e4ded8;font-size:14px}';
      doc.head.appendChild(style);
    }
    var status = panel.querySelector('.wl-pa-status'), details = panel.querySelector('.wl-pa-items'), choices = panel.querySelector('.wl-pa-choice');
    var ackLabel = panel.querySelector('.wl-pa-ack'), ack = ackLabel.querySelector('input'), hint = panel.querySelector('.wl-pa-hint'), error = panel.querySelector('.wl-pa-error'), retry = panel.querySelector('button');
    var policy = null, loadedAt = 0, busy = null, dead = false, generation = 0, stocks = {}, items = [], lastKey = '', errorText = '';
    function store() { var field = doc.getElementById('ctl00_PageBody_BranchDropDownList'); return field?.selectedOptions?.[0]?.textContent || ''; }
    function selectedChoice() { return panel.querySelector('input[name="wlPickupPlan"]:checked')?.value || 'together'; }
    function notify() { options.onChange?.(); }
    function fail(message) { errorText = message; error.textContent = message; error.hidden = !message; }
    function populate() {
      var saved = time.value; time.replaceChildren();
      var values = policy && date.value >= policy.min && date.value <= policy.max ? timeChoices(date.value) : [];
      var empty = doc.createElement('option'); empty.value = ''; empty.textContent = values.length ? 'Choose a pickup window' : 'Choose an available date first'; time.appendChild(empty);
      values.forEach(function (row) { var option = doc.createElement('option'); option.value = row.value; option.textContent = row.label; time.appendChild(option); });
      time.value = values.some(function (row) { return row.value === saved; }) ? saved : '';
      time.disabled = !values.length;
    }
    function render() {
      if (dead || !root.isConnected) return;
      var next = plan(items, stocks, store(), new Date(), selectedChoice());
      if (!next.canSplit) { panel.querySelector('input[value="together"]').checked = true; next = plan(items, stocks, store(), new Date(), 'together'); }
      var key = policyKey(next);
      if (key !== lastKey) ack.checked = false;
      lastKey = key; policy = next;
      choices.hidden = !policy.canSplit; ackLabel.hidden = !policy.delayed;
      status.textContent = policy.uncertain ? 'Some items need ordering or store confirmation.' : policy.delayed ? 'Some items need a store transfer.' : 'Your requested quantities are in stock at ' + policy.store + '.';
      details.replaceChildren();
      policy.items.forEach(function (row) {
        var line = doc.createElement('div'); line.className = 'wl-pa-item'; var title = doc.createElement('strong'); title.textContent = row.name + ' · ' + row.quantity + ' requested'; line.appendChild(title);
        [[row.local, 'at ' + policy.store + ' · allow 2 hours to prepare'], [row.transfer, 'to transfer · usually 1–2 business days'], [row.supplier, 'to order · usually 1–2 weeks; timing confirmed by store'], [row.unconfirmed, 'with availability unconfirmed · store must confirm timing']].forEach(function (part) {
          if (part[0]) { var detail = doc.createElement('span'); detail.textContent = part[0] + ' ' + part[1]; line.appendChild(detail); }
        }); details.appendChild(line);
      });
      date.min = policy.min; date.max = policy.max;
      var invalid = date.value && (!openDate(date.value) || date.value < policy.min || date.value > policy.max);
      if (invalid) { date.value = ''; time.value = ''; fail('Availability changed. Choose a new pickup date and review the estimate.'); }
      populate();
      var label = root.querySelector('label[for="pickupDate"]');
      if (label) label.firstChild.textContent = policy.split ? 'Requested first pickup date (local items): ' : policy.delayed ? 'Requested pickup date (store must confirm): ' : 'Requested Pickup Date: ';
      hint.textContent = policy.split ? 'Your first pickup covers only the quantities at this store. Woodson will contact you to arrange the remaining pickup(s). Transfer and supplier estimates may change.' : policy.uncertain ? 'For a complete pickup, choose a date at least two weeks out. This is a request, not a confirmed ready date. Supplier availability and lead times may take longer.' : policy.delayed ? 'For a complete pickup, allow two business days for transfers. Your store will confirm when everything is ready.' : 'Pickup windows allow at least two hours to prepare. Wait for your ready-for-pickup confirmation.';
      notify();
    }
    async function fetchPage(path) {
      var controller = new win.AbortController(), timer = win.setTimeout(function () { controller.abort(); }, 8000);
      try { var response = await win.fetch(path, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal }); if (!response.ok) throw Error('Unavailable'); return new win.DOMParser().parseFromString(await response.text(), 'text/html'); }
      finally { win.clearTimeout(timer); }
    }
    function refresh() {
      if (busy) return busy;
      var epoch = ++generation, startStore = store(), previous = lastKey;
      loadedAt = 0; retry.disabled = true; status.textContent = 'Checking store and company inventory…';
      busy = (async function () {
        try {
          var basket = cartFromDocument(await fetchPage('/ShoppingCart.aspx'));
          var found = {}, cursor = 0;
          async function worker() {
            while (cursor < basket.length && !dead) {
              var item = basket[cursor++];
              try { found[item.pid] = stockFromDocument(await fetchPage('/Catalog/ShowStock.aspx?productid=' + encodeURIComponent(item.pid))); }
              catch (_) { found[item.pid] = null; }
            }
          }
          await Promise.all([worker(), worker(), worker()]);
          if (dead || epoch !== generation || startStore !== store()) return false;
          items = basket; stocks = found; loadedAt = Date.now(); fail(''); render();
          if (previous && previous !== lastKey) { fail('Availability changed. Review the quantities and pickup plan, then continue.'); return false; }
          return true;
        } catch (_) {
          if (!dead && epoch === generation) {
            policy = null; details.replaceChildren(); choices.hidden = true; ackLabel.hidden = true; ack.checked = false; hint.textContent = '';
            time.disabled = true; status.textContent = 'We couldn’t verify your current basket.';
            fail('Recheck availability before choosing pickup. You can also return to your cart.'); notify();
          }
          return false;
        } finally {
          if (epoch === generation) {
            busy = null; retry.disabled = false;
            if (!dead && root.isConnected && startStore !== store()) win.setTimeout(refresh, 0);
          }
        }
      })();
      return busy;
    }
    function valid(mark) {
      var message = busy || !policy || !loadedAt ? 'Please wait for the inventory check, or recheck availability.' : storeName(store()) !== policy.store ? 'Your pickup store changed. Recheck availability.' : Date.now() - loadedAt >= MAX_AGE ? 'Availability needs a fresh check. Please continue again.' : !validSchedule(policy, date.value, time.value) ? 'Choose an available pickup date and time for this pickup plan.' : policy.delayed && !ack.checked ? 'Please acknowledge the pickup estimates before continuing.' : '';
      if (mark) fail(message);
      return !message;
    }
    async function prepare() {
      if (!root.isConnected || dead) return false;
      if (!(await refresh())) return false;
      return valid(true);
    }
    panel.addEventListener('change', function (event) { if (event.target.name === 'wlPickupPlan') { fail(''); render(); } else { fail(''); notify(); } });
    retry.addEventListener('click', function () { refresh(); });
    date.addEventListener('change', function () { populate(); notify(); });
    time.addEventListener('change', notify);
    doc.addEventListener('change', function (event) {
      if (event.target.id === 'ctl00_PageBody_BranchDropDownList') { loadedAt = 0; policy = null; ack.checked = false; refresh(); }
    });
    win.addEventListener('pagehide', function () { dead = true; generation++; }, { once: true });
    function instructionNow() { return policy ? instruction(policy, date.value, time.disabled ? '' : time.value) : 'PICKUP AVAILABILITY NOT YET VERIFIED'; }
    return { refresh: refresh, prepare: prepare, valid: valid, populate: populate, instruction: instructionNow, requestKey: function () { return JSON.stringify([lastKey, date.value, time.value, ack.checked]); }, current: function () { return policy; }, error: function () { return errorText; } };
  }
  return { build: BUILD, stores: STORES, calendar: calendar, after: after, openDate: openDate, timeChoices: timeChoices, stockFromDocument: stockFromDocument, cartFromDocument: cartFromDocument, plan: plan, policyKey: policyKey, validSchedule: validSchedule, instruction: instruction, attach: attach };
});
