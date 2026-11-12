/* Optional cart alternatives. Native checkout is never gated on this feature. */
(function (root, factory) {
  'use strict';
  var core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else { root.WLCartSubstitutions = core; core.boot(root).catch(function () {}); }
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  var BUILD = '20261112-substitutions-2';
  var ORIGIN = 'https://webtrack.woodsonlumber.com';
  var API = 'https://wl-upsrates.vercel.app/api/cart-substitutions';
  var BASE = 'https://ckunkel510.github.io/WL.github.io/';
  function text(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function money(value) {
    var match = text(value).match(/^\$\s*((?:\d+|\d{1,3}(?:,\d{3})+)\.\d{2})(?:\s+(?:ea|each|pc|pcs|board|boards))?$/i);
    return match ? Math.round(Number(match[1].replace(/,/g, '')) * 100) : null;
  }
  function unit(value) { var result = text(value).toLowerCase(); return ['ea', 'each', 'pc', 'pcs', 'board', 'boards'].includes(result) ? 'ea' : result; }
  function targetOf(value) { return String(value || '').match(/(?:__doPostBack|WebForm_PostBackOptions)\(\s*['"]([^'"]+)['"]/i)?.[1] || ''; }
  function signature(cart) {
    return JSON.stringify(cart.items.map(function (r) { return [r.pid, r.quantity, r.code.toUpperCase(), r.unit, r.configured]; }).sort(function (a, b) { return a[0].localeCompare(b[0]); }));
  }
  function expectedCart(cart, source, target, keep, add) {
    var items = cart.items.filter(function (r) { return r.pid !== source; }).map(function (r) { return Object.assign({}, r); });
    var original = cart.items.find(function (r) { return r.pid === source; });
    if (keep) items.push(Object.assign({}, original, { quantity: keep }));
    var present = items.find(function (r) { return r.pid === target.pid; });
    if (present) present.quantity += add;
    else items.push({ pid: target.pid, code: target.code, quantity: add, unit: target.unit, configured: false });
    return { items: items };
  }
  function cartFromDocument(page, availability) {
    var items = availability.cartFromDocument(page), seen = new Set();
    if (items.length > 60) throw Error('This cart needs its existing checkout flow.');
    var rows = Array.from(page.querySelectorAll('#ctl00_PageBody_ShoppingCartDetailPanel .shopping-cart-item'));
    items.forEach(function (item) {
      var matches = rows.filter(function (r) { return Array.from(r.querySelectorAll('a[href*="ProductDetail.aspx"]')).some(function (a) { return a.getAttribute('href')?.match(/[?&]pid=(\d+)(?:&|$)/i)?.[1] === item.pid; }); });
      if (matches.length !== 1 || seen.has(item.pid) || !Number.isInteger(item.quantity) || item.quantity > 9999) throw Error('This cart needs its existing checkout flow.');
      seen.add(item.pid); item.row = matches[0];
      var input = item.row.querySelector('input[id*="_qty_"]:not([id$="_ClientState"])');
      var explicit = item.row.querySelector('[data-title="Per"],[data-title="UOM"],.productPer,.unit-of-measure,.wl-qty-unit');
      var parent = input?.closest('.float-right');
      var rawUnit = parent ? Array.from(parent.childNodes).filter(function (n) { return n.nodeType === 3; }).map(function (n) { return n.textContent; }).join(' ') : '';
      item.unit = unit(item.row.getAttribute('data-wl-cart-unit') || explicit?.textContent || rawUnit);
      var nativePrice = item.row.querySelector('.col-12.col-sm-9 .col-6');
      var priceText = nativePrice ? Array.from(nativePrice.childNodes).filter(function (n) { return n.nodeType === 3; }).map(function (n) { return n.textContent; }).join(' ') : item.row.querySelector('.cart-item-card .card-body > .d-flex .text-end .fw-bold')?.textContent;
      item.price = money(priceText);
    });
    return { doc: page, items: items };
  }
  function productFromDocument(page, pid) {
    if (!page.querySelector('a[href*="SignOut=1" i]')) throw Error('Sign in again to compare your prices.');
    var add = page.querySelector('[id$="_AddProductButton"]'), quantity = page.querySelector('input[id$="_qty_' + pid + '"]');
    var special = page.querySelector('input[id$="_txtSpecialProductCode"]');
    var selectedUnit = page.querySelector('select[id*="Per"],select[id*="UOM"],select[id*="Unit"]');
    var code = Array.from(page.querySelectorAll('.formPageHeader')).map(function (e) { return text(e.textContent); }).find(function (v) { return /^Product Code:/i.test(v); });
    var name = text(page.querySelector('.productDescriptionOnThisPageFull,#wl-product-title')?.textContent).replace(/^\*+\s*/, '');
    var price = money(page.querySelector('.productPriceSegment')?.textContent), per = unit(page.querySelector('.productPerSegment')?.textContent);
    if (!add || add.disabled || add.getAttribute('aria-disabled') === 'true' || !quantity || !quantity.name || !code || !name || per !== 'ea' || selectedUnit || page.querySelector('[id$="_btnSpecialOrder"]') || text(special?.value) || /epallet|e-pallet|wdoor/i.test(code)) throw Error('This item needs the existing checkout flow.');
    return { doc: page, pid: pid, add: add, quantity: quantity, code: code.replace(/^Product Code:\s*/i, ''), name: name, price: price, unit: per };
  }
  function formPost(page, control, path, adjust) {
    var form = page.querySelector('form');
    var target = targetOf(control?.getAttribute('href') || control?.getAttribute('onclick'));
    var product = /^\/ProductDetail\.aspx\?pid=(\d+)$/.exec(path);
    if (!form || !control || control.disabled || control.getAttribute('aria-disabled') === 'true' || (product ? !/^ctl00\$PageBody\$productDetail\$ctl\d+\$AddProductButton$/.test(target) : !/^ctl00\$PageBody\$CartLineControl_\d+\$(?:del|refQty)_\d+$/.test(target))) throw Error('The native cart action could not be confirmed.');
    var action = new URL(form.getAttribute('action') || path, ORIGIN + path);
    if (action.origin !== ORIGIN || action.pathname !== (product ? '/ProductDetail.aspx' : '/ShoppingCart.aspx')) throw Error('The native cart action could not be confirmed.');
    if (product && action.searchParams.has('pid') && action.searchParams.get('pid') !== product[1]) throw Error('The native product changed.');
    var data = new URLSearchParams();
    Array.from(form.elements).forEach(function (el) {
      var type = String(el.type || '').toLowerCase();
      if (!el.name || el.disabled || ['button', 'submit', 'image', 'reset', 'file'].includes(type) || (['checkbox', 'radio'].includes(type) && !el.checked)) return;
      if (el.tagName === 'SELECT' && el.multiple) Array.from(el.selectedOptions).forEach(function (o) { data.append(el.name, o.value); });
      else data.append(el.name, el.value || '');
    });
    data.set('__EVENTTARGET', target); data.set('__EVENTARGUMENT', '');
    if (adjust) adjust(data);
    return { url: action.href, body: data.toString() };
  }
  function setQuantity(data, page, input, quantity) {
    data.set(input.name, String(quantity));
    var state = page.getElementById(input.id + '_ClientState');
    if (state?.name) {
      var parsed = JSON.parse(state.value || '{}');
      parsed.validationText = String(quantity); parsed.valueAsString = String(quantity); parsed.lastSetTextBoxValue = String(quantity);
      data.set(state.name, JSON.stringify(parsed));
    }
  }
  function adapter(win, availability) {
    async function page(path, options) {
      var controller = new win.AbortController(), timer = win.setTimeout(function () { controller.abort(); }, 12000);
      try {
        var response = await win.fetch(path, Object.assign({ credentials: 'same-origin', cache: 'no-store', signal: controller.signal }, options));
        if (!response.ok || new URL(response.url || path, ORIGIN).origin !== ORIGIN) throw Error('WebTrack could not confirm the cart.');
        return new win.DOMParser().parseFromString(await response.text(), 'text/html');
      } finally { win.clearTimeout(timer); }
    }
    async function store() {
      var settings = await page('/AccountSettings.aspx?cms=1');
      var select = settings.querySelector('#ctl00_PageBody_ChangeUserDetailsControl_ddBranch');
      var label = select?.selectedOptions?.[0]?.textContent;
      var selected = availability.stores.find(function (name) { return new RegExp('^' + name + '(?:\\s*[-,]|$)', 'i').test(text(label)); });
      if (!selected) throw Error('Your store could not be confirmed.');
      return selected;
    }
    async function read() { var values = await Promise.all([page('/ShoppingCart.aspx'), store()]); return Object.assign(cartFromDocument(values[0], availability), { store: values[1] }); }
    async function post(bits) { return page(bits.url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, body: bits.body }); }
    return {
      read: read,
      stock: async function (pid) { return availability.stockFromDocument(await page('/Catalog/ShowStock.aspx?productid=' + pid)); },
      product: async function (pid) { return productFromDocument(await page('/ProductDetail.aspx?pid=' + pid), pid); },
      add: async function (info, quantity) { await post(formPost(info.doc, info.add, '/ProductDetail.aspx?pid=' + info.pid, function (data) { setQuantity(data, info.doc, info.quantity, quantity); })); },
      change: async function (cart, pid, quantity) {
        var item = cart.items.find(function (r) { return r.pid === pid; });
        if (!item) throw Error('The original cart line changed.');
        var control = item.row.querySelector(quantity ? 'a.refresh-cart-line-total' : 'a[id*="_del_"]');
        if (!targetOf(control?.getAttribute('href')).endsWith('$' + (quantity ? 'refQty' : 'del') + '_' + pid)) throw Error('The native cart line changed.');
        await post(formPost(cart.doc, control, '/ShoppingCart.aspx', function (data) {
          if (quantity) setQuantity(data, cart.doc, item.row.querySelector('input[id*="_qty_"]:not([id$="_ClientState"])'), quantity);
        }));
      }
    };
  }
  function eligibleNative(rules, source, replacement, nativeSource, nativeTarget) {
    if (rules.normalized(source.title) !== rules.normalized(nativeSource.name) || rules.normalized(replacement.title) !== rules.normalized(nativeTarget.name)) return false;
    if (['approved_pair', 'reviewed_family'].includes(replacement.kind)) return true; // server-maintained explicit pair, with native title drift checked above
    return !!rules.eligibility(Object.assign({}, source, { title: nativeSource.name }), { productId: replacement.productId, title: nativeTarget.name, category: replacement.category, brand: replacement.brand });
  }
  async function inspect(io, sourceId) { return Promise.all([io.read(), io.stock(sourceId), io.product(sourceId)]); }
  function companyStock(stock) {
    if (!stock?.verified || !stock.branches || !Object.keys(stock.branches).length || !Object.values(stock.branches).every(function (count) { return Number.isFinite(count) && count >= 0; })) return null;
    return Object.values(stock.branches).reduce(function (sum, count) { return sum + Math.floor(count); }, 0);
  }
  function stockLabel(quote) {
    return quote.available + ' at ' + quote.baseline.store + ' · ' + quote.companyAvailable + ' companywide. ' + (quote.transfer ? 'Some of this replacement would need stock from another store. ' : '') + 'Pickup or delivery eligibility and timing are shown at checkout; availability is confirmed by Woodson.';
  }
  async function prepare(io, rules, catalogSource, replacement, scope, context) {
    var values = await Promise.all([context || inspect(io, catalogSource.productId), io.stock(replacement.productId), io.product(replacement.productId)]);
    var cart = values[0][0], source = cart.items.find(function (r) { return r.pid === catalogSource.productId; }), a = values[0][1], b = values[1], nativeSource = values[0][2], nativeTarget = values[2];
    if (!source || source.configured || source.unit !== 'ea' || !a.verified || !b.verified || !Number.isFinite(a.branches[cart.store]) || !Number.isFinite(b.branches[cart.store]) || a.branches[cart.store] >= source.quantity || !eligibleNative(rules, catalogSource, replacement, nativeSource, nativeTarget) || source.code.toUpperCase() !== nativeSource.code.toUpperCase()) throw Error('These choices changed or could not be verified. Keep your items or check again.');
    var target = cart.items.find(function (r) { return r.pid === replacement.productId; });
    if (target && (target.configured || target.unit !== 'ea' || target.code.toUpperCase() !== nativeTarget.code.toUpperCase())) throw Error('The replacement already has a different configuration in your cart.');
    var quantities = rules.quantities(source.quantity, a.branches[cart.store], scope);
    var companyAvailable = companyStock(b), needed = quantities.replace + (target?.quantity || 0);
    if (!quantities.replace || companyAvailable === null || needed > Math.min(9999, companyAvailable)) throw Error('This alternative does not have enough stock companywide for this choice. You can keep your original items.');
    if (!Number.isInteger(source.price) || !Number.isInteger(nativeTarget.price)) throw Error('Your current prices could not be confirmed. Keep your original items or contact the store.');
    return { baseline: cart, source: source, target: nativeTarget, catalogSource: catalogSource, replacement: replacement, scope: scope, keep: quantities.keep, quantity: quantities.replace, local: a.branches[cart.store], available: Math.floor(b.branches[cart.store]), companyAvailable: companyAvailable, transfer: Math.max(0, needed - Math.floor(b.branches[cart.store])), price: nativeTarget.price, originalPrice: source.price, delta: quantities.replace * (nativeTarget.price - source.price), at: Date.now() };
  }
  // Native WebTrack has no atomic replace endpoint. Add first, verify, then
  // reduce the original. Ambiguous replies are read back, never blindly retried.
  async function swap(io, rules, proposal) {
    var fresh = await prepare(io, rules, proposal.catalogSource, proposal.replacement, proposal.scope);
    if (Date.now() - proposal.at > 120000 || signature(fresh.baseline) !== signature(proposal.baseline) || fresh.baseline.store !== proposal.baseline.store || fresh.keep !== proposal.keep || fresh.quantity !== proposal.quantity || fresh.price !== proposal.price || fresh.originalPrice !== proposal.originalPrice || fresh.transfer !== proposal.transfer) throw Error('Stock, price or your cart changed. Review this choice again before applying it.');
    var afterAddExpected = expectedCart(fresh.baseline, fresh.source.pid, fresh.target, fresh.source.quantity, fresh.quantity);
    var finalExpected = expectedCart(fresh.baseline, fresh.source.pid, fresh.target, fresh.keep, fresh.quantity);
    var originalTargetQty = fresh.baseline.items.find(function (r) { return r.pid === fresh.target.pid; })?.quantity || 0;
    try {
    try { await io.add(fresh.target, fresh.quantity); } catch (_) {} // the reply can fail after WebTrack applied it
    var afterAdd = await io.read();
    if (signature(afterAdd) === signature(fresh.baseline)) { var unchanged = Error('The alternative was not added. Your original cart is unchanged.'); unchanged.safeCart = true; throw unchanged; }
    if (afterAdd.store !== fresh.baseline.store || signature(afterAdd) !== signature(afterAddExpected)) { var ambiguous = Error('Your cart changed while applying this choice. Review the cart before continuing.'); ambiguous.reviewCart = true; throw ambiguous; }
    try { await io.change(afterAdd, fresh.source.pid, fresh.keep); } catch (_) {}
    var result = await io.read();
    if (result.store === fresh.baseline.store && signature(result) === signature(finalExpected)) return { cart: result, proposal: fresh };
    // Compensate only when the complete cart still exactly matches our known
    // add-only state. Never overwrite a concurrent customer edit.
    if (result.store === fresh.baseline.store && signature(result) === signature(afterAddExpected)) {
      try { await io.change(result, fresh.target.pid, originalTargetQty); } catch (_) {}
      var restored = await io.read();
      if (restored.store === fresh.baseline.store && signature(restored) === signature(fresh.baseline)) { var restoredError = Error('The swap could not finish. Your original cart has been restored.'); restoredError.safeCart = true; throw restoredError; }
    }
    var failure = Error('The swap needs review. Check both cart lines and their quantities before continuing.'); failure.reviewCart = true; throw failure;
    } catch (error) {
      if (!error.safeCart) { error.reviewCart = true; error.message = 'The swap needs review. Check both cart lines and their quantities before continuing.'; }
      throw error;
    }
  }
  function dependencies(win) {
    function load(file, globalName, version) {
      if (win[globalName]) return Promise.resolve(win[globalName]);
      return new Promise(function (resolve, reject) {
        var script = win.document.createElement('script'), timer = win.setTimeout(function () { reject(Error('Optional choices unavailable')); }, 8000);
        script.src = BASE + file + '?v=' + version; script.async = true;
        script.onload = function () { win.clearTimeout(timer); win[globalName] ? resolve(win[globalName]) : reject(Error('Optional choices unavailable')); };
        script.onerror = function () { win.clearTimeout(timer); reject(Error('Optional choices unavailable')); };
        win.document.head.appendChild(script);
      });
    }
    return Promise.all([load('PickupAvailability.js', 'WLPickupAvailability', '20261112-pickup-1'), load('SubstitutionRules.js', 'WLSubstitutionRules', BUILD)]);
  }
  async function boot(win, options) {
    options = options || {};
    if (!win || win.top !== win || (!options.preview && (win.location.origin !== ORIGIN || !/^\/ShoppingCart\.aspx$/i.test(win.location.pathname)))) return;
    var doc = win.document;
    if (!doc.querySelector('#ctl00_PageBody_ShoppingCartDetailPanel') || !doc.querySelector('a[href*="SignOut=1" i]') || doc.querySelector('iframe[name="woodson-buy-now-checkout"]')) return;
    var modules = options.modules || await dependencies(win), availability = modules[0], rules = modules[1], io = options.io || adapter(win, availability);
    if (!doc.querySelector('#ctl00_PageBody_ShoppingCartDetailPanel')) return;
    var dead = false, dialog = null, timer = null;
    win.addEventListener('pagehide', function () { dead = true; if (timer) win.clearTimeout(timer); dialog?.remove(); }, { once: true });
    doc.documentElement.setAttribute('data-wl-substitutions-build', BUILD);
    var style = doc.createElement('style');
    style.textContent = '.wl-substitute-slot{padding:12px 0 0;clear:both}.wl-substitute-slot p{font-size:13px;margin:4px 0 8px}.wl-substitute-button,.wl-sub-dialog button{min-height:44px;padding:10px 14px;border:1px solid #916b75;border-radius:7px;background:white;color:#670020;font:inherit;cursor:pointer}.wl-sub-dialog{width:min(680px,calc(100% - 28px));max-height:calc(100dvh - 32px);box-sizing:border-box;padding:24px;border:1px solid #d8ced0;border-radius:14px;color:#303030;background:#fffdfb;overflow:auto}.wl-sub-dialog::backdrop{background:#20111699}.wl-sub-dialog h2{font-size:24px;color:#670020;margin:0 0 10px}.wl-sub-dialog h3{font-size:18px;margin:0 0 8px}.wl-sub-dialog p{line-height:1.5;overflow-wrap:anywhere}.wl-sub-dialog fieldset{border:1px solid #e3dadd;border-radius:8px;margin:16px 0;padding:12px}.wl-sub-dialog legend{font-size:16px;font-weight:600}.wl-sub-dialog label{display:flex;gap:10px;align-items:flex-start;margin:8px 0;padding:8px 0;line-height:1.5}.wl-sub-dialog input{width:18px;height:18px;flex:none;accent-color:#670020;margin-top:3px}.wl-sub-option{border-top:1px solid #e3dadd;padding:16px 0}.wl-sub-option small{display:block;line-height:1.5}.wl-sub-footer{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:18px}.wl-sub-dialog .wl-sub-apply{background:#670020;color:white}.wl-sub-dialog button:disabled{opacity:.6;cursor:default}.wl-sub-dialog a{color:#670020;text-decoration:underline}.wl-sub-notice{background:#f6f1e9;border-radius:8px;padding:12px}.wl-sub-error{color:#981c32}.wl-sub-dialog [hidden]{display:none!important}@media(max-width:480px){.wl-sub-dialog{padding:18px}.wl-sub-footer button{width:100%}}';
    doc.head.appendChild(style);
    function el(tag, label, className) { var node = doc.createElement(tag); if (label) node.textContent = label; if (className) node.className = className; return node; }
    function dollars(cents) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100); }
    async function apiJson(path, init) {
      if (options.request) return options.request(path, init);
      var controller = new win.AbortController(), wait = win.setTimeout(function () { controller.abort(); }, 6000);
      try { var response = await win.fetch((options.api || API) + path, Object.assign({ credentials: 'omit', cache: 'no-store', signal: controller.signal }, init)); if (!response.ok) throw Error('Choices unavailable'); return await response.json(); }
      finally { win.clearTimeout(wait); }
    }
    function close() { dialog?.close(); dialog?.remove(); dialog = null; }
    async function open(item, opener) {
      if (dialog || dead) return;
      dialog = el('dialog', '', 'wl-sub-dialog'); dialog.setAttribute('aria-labelledby', 'wl-sub-title');
      var title = el('h2', 'Find a substitute'); title.id = 'wl-sub-title'; title.tabIndex = -1;
      var header = el('div', '', 'wl-sub-header'), closeTop = el('button', '×'); closeTop.type = 'button'; closeTop.setAttribute('aria-label', 'Keep original items and close substitutes');
      header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;position:sticky;top:0;background:#fffdfb;z-index:2';
      header.append(title, closeTop);
      var intro = el('p', 'Keep your original items, or choose an alternative. Checkout will show fulfillment options and timing. Nothing changes until you apply a choice.');
      var content = el('div'), status = el('p', 'Checking compatible alternatives and your store’s stock…'); status.setAttribute('role', 'status');
      var keep = el('button', 'Keep original items'); keep.type = 'button'; keep.onclick = function () { close(); opener.focus(); };
      var footer = el('div', '', 'wl-sub-footer'); footer.appendChild(keep);
      dialog.append(header, intro, status, content, footer); doc.body.appendChild(dialog); dialog.showModal(); title.focus();
      var view = dialog, applying = false, reviewNeeded = false, epoch = 0;
      closeTop.onclick = function () { if (applying) return; if (reviewNeeded) win.location.assign('/ShoppingCart.aspx'); else { close(); opener.focus(); } };
      view.addEventListener('cancel', function (event) { if (applying || reviewNeeded) event.preventDefault(); if (reviewNeeded) win.location.assign('/ShoppingCart.aspx'); });
      view.addEventListener('close', function () { view.remove(); if (dialog === view) dialog = null; opener.focus(); });
      try {
        var payload = await apiJson('?pid=' + item.pid);
        if (dead || dialog !== view) return;
        if (!payload.success || !payload.source || !payload.suggestions?.length) { status.textContent = 'No verified substitute is available yet. Keep your original items and continue to checkout for fulfillment options and timing.'; return; }
        var current = await io.read(), source = current.items.find(function (row) { return row.pid === item.pid; }), stock = await io.stock(item.pid);
        if (!source || !stock.verified || !Number.isFinite(stock.branches[current.store])) throw Error('Availability could not be confirmed.');
        var missing = Math.max(0, source.quantity - Math.floor(stock.branches[current.store]));
        if (!missing) { status.textContent = 'Your requested quantity is now available at ' + current.store + '. Keep your original items to continue.'; return; }
        status.textContent = source.quantity + ' requested · ' + (source.quantity - missing) + ' at ' + current.store + ' · ' + missing + ' unavailable at this store.';
        var fieldset = el('fieldset'), legend = el('legend', 'How much would you like to replace?'); fieldset.appendChild(legend);
        [['shortage', 'Only the quantity unavailable at ' + current.store + ' (' + missing + ')'], ['whole', 'The whole line (' + source.quantity + ')']].forEach(function (part) {
          var label = el('label'), input = doc.createElement('input'); input.type = 'radio'; input.name = 'wl-sub-scope'; input.value = part[0]; input.checked = part[0] === 'shortage'; label.append(input, el('span', part[1])); fieldset.appendChild(label);
        });
        content.appendChild(fieldset);
        var list = el('div'); content.appendChild(list);
        var selected = null, selectedQuote = null, ack = doc.createElement('input'); ack.type = 'checkbox';
        var ackLabel = el('label'); ackLabel.append(ack, el('span', 'I have reviewed the product differences and want to use this replacement.')); ackLabel.hidden = true; content.appendChild(ackLabel);
        var priceNote = el('p', 'These are your current unit prices. Quantity pricing and tax are recalculated in your cart.'); content.appendChild(priceNote);
        var apply = el('button', 'Apply selected substitute', 'wl-sub-apply'); apply.type = 'button'; apply.disabled = true; footer.appendChild(apply);
        function scope() { return fieldset.querySelector('input:checked').value; }
        function update() { apply.disabled = !selectedQuote || !ack.checked || applying; }
        ack.onchange = update;
        async function render() {
          var generation = ++epoch; selected = null; selectedQuote = null; ack.checked = false; ackLabel.hidden = true; apply.disabled = true; list.replaceChildren();
          var loading = el('p', 'Checking your prices and available quantities…'); list.appendChild(loading);
          var context = await inspect(io, payload.source.productId), chosenScope = scope(), results = [], next = 0;
          async function check() {
            while (next < payload.suggestions.length && generation === epoch) {
              var index = next++, replacement = payload.suggestions[index];
              try { results[index] = { replacement: replacement, quote: await prepare(io, rules, payload.source, replacement, chosenScope, context) }; }
              catch (_) { results[index] = null; }
            }
          }
          await Promise.all([check(), check(), check()]);
          if (dead || dialog !== view || generation !== epoch) return;
          list.replaceChildren();
          results.filter(Boolean).slice(0, 3).forEach(function (row) {
            var card = el('div', '', 'wl-sub-option'), chooseLabel = el('label'), radio = doc.createElement('input'); radio.type = 'radio'; radio.name = 'wl-sub-product';
            chooseLabel.append(radio, el('strong', row.replacement.title)); card.appendChild(chooseLabel);
            card.append(el('p', row.replacement.reason), el('p', row.replacement.differences));
            card.append(el('small', stockLabel(row.quote)));
            card.append(el('p', dollars(row.quote.price) + ' each · replace ' + row.quote.quantity + ' · estimated merchandise change ' + (row.quote.delta >= 0 ? '+' : '−') + dollars(Math.abs(row.quote.delta))));
            var details = el('a', 'View product details'); details.href = (options.preview ? ORIGIN : '') + '/ProductDetail.aspx?pid=' + row.replacement.productId; details.target = '_blank'; details.rel = 'noopener'; card.appendChild(details);
            radio.onchange = function () { selected = row.replacement; selectedQuote = row.quote; ack.checked = false; ackLabel.hidden = false; update(); };
            list.appendChild(card);
          });
          if (!list.childElementCount) list.appendChild(el('p', 'No verified alternative has enough company stock for this choice. Keep your original items, or try replacing only the quantity unavailable at your store.'));
        }
        fieldset.onchange = function () { render().catch(function () { status.textContent = 'Choices could not be refreshed. Keep your original items and continue.'; }); };
        apply.onclick = async function () {
          if (!selected || !selectedQuote || !ack.checked || applying) return;
          var chosenReplacement = selected, chosenProposal = selectedQuote;
          applying = true; update(); keep.disabled = true; closeTop.disabled = true; fieldset.disabled = true; status.textContent = 'Applying your choice and confirming both cart quantities…';
          function leaving(event) { event.preventDefault(); event.returnValue = ''; }
          win.addEventListener('beforeunload', leaving);
          Array.from(view.querySelectorAll('input')).forEach(function (input) { input.disabled = true; });
          async function work() {
            var result = await swap(io, rules, chosenProposal);
            if (chosenReplacement.receipt) apiJson('', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ receipt: chosenReplacement.receipt, scope: result.proposal.scope, quantity: result.proposal.quantity, store: result.cart.store }) }).catch(function () {});
            win.removeEventListener('beforeunload', leaving);
            if (options.onSuccess) options.onSuccess(result); else win.location.assign('/ShoppingCart.aspx');
          }
          try {
            if (!win.navigator.locks) throw Error('This browser cannot safely apply a substitution. You can keep your original items and continue.');
            await win.navigator.locks.request('wl-native-cart-substitution', { ifAvailable: true }, async function (lock) { if (!lock) throw Error('Another cart change is in progress. Keep your items or try again after it finishes.'); await work(); });
          } catch (error) {
            status.textContent = error.message; status.classList.add('wl-sub-error'); selectedQuote = null;
            if (error.reviewCart) { reviewNeeded = true; keep.textContent = 'Review cart'; keep.onclick = function () { win.location.assign('/ShoppingCart.aspx'); }; }
          } finally { win.removeEventListener('beforeunload', leaving); applying = false; keep.disabled = false; closeTop.disabled = false; fieldset.disabled = false; Array.from(view.querySelectorAll('input')).forEach(function (input) { input.disabled = false; }); update(); }
        };
        await render();
      } catch (_) { if (dialog === view) status.textContent = 'Substitutes are temporarily unavailable. Keep your original items and continue to checkout for fulfillment options and timing.'; }
    }
    async function scan() {
      if (dead || dialog) return;
      function state(value) { doc.documentElement.setAttribute('data-wl-substitution-scan', value); }
      state('reading-cart');
      var parsed;
      try { parsed = cartFromDocument(doc, availability); } catch (_) { state('cart-unreadable'); return; }
      var fresh;
      try { fresh = await io.read(); } catch (_) { state('native-cart-unavailable'); return; }
      if (dead || signature(fresh) !== signature(parsed)) { state('cart-changed'); return; }
      state('checking-stock');
      var cursor = 0;
      async function worker() {
        while (cursor < parsed.items.length && !dead) {
          var item = parsed.items[cursor++];
          if (item.configured || item.unit !== 'ea' || item.pid === '23297' || /epallet|e-pallet/i.test(item.code) || item.row.querySelector('.wl-substitute-slot') || !item.row.isConnected) continue;
          try {
            var stock = await io.stock(item.pid);
            if (dead || !item.row.isConnected || !stock.verified || !Number.isFinite(stock.branches[fresh.store]) || stock.branches[fresh.store] >= item.quantity) continue;
            var slot = el('div', '', 'wl-substitute-slot'), note = el('p', Math.max(0, item.quantity - Math.floor(stock.branches[fresh.store])) + ' unavailable at ' + fresh.store + '. Choose a substitute, or continue to checkout to see fulfillment options and timing.');
            var button = el('button', 'Find a substitute', 'wl-substitute-button'); button.type = 'button'; button.onclick = function () { open(item, button); };
            slot.append(note, button); (item.row.querySelector('.card-body') || item.row).appendChild(slot);
          } catch (_) {}
        }
      }
      await Promise.all([worker(), worker(), worker()]);
      state('ready');
    }
    await scan();
    return { open: open, scan: scan, adapter: io, close: close };
  }
  return { build: BUILD, money: money, unit: unit, targetOf: targetOf, signature: signature, expectedCart: expectedCart, cartFromDocument: cartFromDocument, productFromDocument: productFromDocument, formPost: formPost, setQuantity: setQuantity, adapter: adapter, companyStock: companyStock, stockLabel: stockLabel, prepare: prepare, swap: swap, eligibleNative: eligibleNative, boot: boot };
});
