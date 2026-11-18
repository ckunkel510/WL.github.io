/* Staged optional product pairing. No loader or automatic cart changes. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WLProductPairing = api;
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  var RELEASE_ENABLED = false;
  var PAIR = Object.freeze({
    id: 'spark-aa-spares-v1', camera: '246159', battery: '2853',
    cameraCode: 'WGI-SWTC2LOK', batteryCode: '1162676',
    cameraName: 'Wildgame Innovations Spark 2.0 18MP Lightsout Combo',
    batteryName: 'Energizer Max AA Battery 8pk',
    disclosure: 'This camera combo already includes 8 AA batteries and a 16GB SD card. The extra 8-pack is optional spare power.',
    compatibility: 'Eight matching 1.5V alkaline AA cells. Replace the complete set; never mix old/new cells or battery types.',
    evidence: 'OEM WGI-SWTC2LOK catalog and camera manual; exact Energizer MAX AA8 package photo, checked 2026-11-18.'
  });
  var busy = new WeakSet(), used = new WeakSet();
  function normalized(s) { return String(s || '').replace(/\s+/g, ' ').trim().toUpperCase(); }
  function snapshot(cart) {
    if (!cart || !cart.store || !Array.isArray(cart.items) || cart.items.length > 60) throw Error('Check your cart and store before adding this pair.');
    var seen = new Set();
    var rows = cart.items.map(function (r) {
      if (!/^\d+$/.test(r.pid) || seen.has(r.pid) || !Number.isInteger(r.quantity) || r.quantity < 1 || r.quantity > 9999 || !r.code || !r.unit) throw Error('This cart needs the regular product controls.');
      seen.add(r.pid);
      return [r.pid, r.quantity, normalized(r.code), r.unit, !!r.configured, r.price ?? null];
    }).sort(function (a, b) { return a[0].localeCompare(b[0]); });
    return JSON.stringify([cart.store, rows]);
  }
  function increment(cart, product) {
    var items = cart.items.map(function (r) { return Object.assign({}, r); });
    var existing = items.find(function (r) { return r.pid === product.pid; });
    if (existing) existing.quantity++;
    else items.push({pid: product.pid, code: product.code, quantity: 1, unit: 'ea', configured: false, price: product.price});
    return { store: cart.store, items: items };
  }
  function compatible(product, pid, code, name) {
    return product && product.pid === pid && normalized(product.code) === code && normalized(product.name) === normalized(name) && product.unit === 'ea' && Number.isInteger(product.price) && product.price > 0;
  }
  async function prepare(io) {
    var parts = await Promise.all([io.read(), io.product(PAIR.camera), io.product(PAIR.battery), io.stock(PAIR.camera), io.stock(PAIR.battery)]);
    var cart = parts[0], camera = parts[1], battery = parts[2];
    var baseline = snapshot(cart);
    if (!compatible(camera, PAIR.camera, PAIR.cameraCode, PAIR.cameraName) || !compatible(battery, PAIR.battery, PAIR.batteryCode, PAIR.batteryName)) throw Error('The exact products or current prices could not be confirmed. Use the regular product pages.');
    [camera, battery].forEach(function (p, i) {
      var existing = cart.items.find(function (r) { return r.pid === p.pid; });
      if (existing && (existing.configured || existing.unit !== 'ea' || normalized(existing.code) !== normalized(p.code) || existing.price !== p.price || existing.quantity >= 9999)) throw Error('An existing cart line needs review on the regular cart page.');
      var stock = parts[i + 3], count = stock?.branches?.[cart.store];
      if (!stock?.verified || !Number.isFinite(count) || count < (existing?.quantity || 0) + 1) throw Error('Both items are not confirmed in stock at your selected store. Check each product page for other fulfillment options.');
    });
    // No campaign price is injected into native commerce. Show the customer's
    // actual native prices; promotion activation is a separate release check.
    return {pairId: PAIR.id, baseline: baseline, cart: cart, camera: camera, battery: battery, total: camera.price + battery.price, at: Date.now()};
  }
  function reviewError() {
    var error = Error('Check your cart before trying again. One item may have been added; no automatic retry was made.');
    error.reviewCart = true;
    return error;
  }
  async function addBoth(io, quote, selected) {
    if (selected !== true) throw Error('Select the optional spare batteries first.');
    if (busy.has(io) || used.has(quote)) throw Error('This addition is already in progress or needs a fresh cart review.');
    busy.add(io);
    try {
      var fresh = await prepare(io);
      if (!quote || quote.pairId !== PAIR.id || !Number.isFinite(quote.at) || quote.at > Date.now() || Date.now() - quote.at > 120000 || quote.baseline !== fresh.baseline || quote.camera?.price !== fresh.camera.price || quote.battery?.price !== fresh.battery.price) throw Error('Your cart, store, price or availability changed. Review the pair again.');
      used.add(quote);
      var expected = fresh.cart;
      for (var product of [fresh.camera, fresh.battery]) {
        // Refresh each product/form immediately before its own native POST.
        // Never reuse the second product's stale viewstate from the quote.
        var current;
        try {
          var currentCart = await io.read();
          if (snapshot(currentCart) !== snapshot(expected)) throw reviewError();
          var live = await Promise.all([io.product(product.pid), io.stock(product.pid)]);
          current = live[0];
          var currentQty = currentCart.items.find(function (r) { return r.pid === product.pid; })?.quantity || 0;
          if (!compatible(current, product.pid, normalized(product.code), product.name) || current.price !== product.price || !live[1]?.verified || !Number.isFinite(live[1].branches?.[currentCart.store]) || live[1].branches[currentCart.store] < currentQty + 1) throw reviewError();
        } catch (_) { throw reviewError(); }
        var next = increment(expected, current);
        try { await io.add(current, 1); } catch (_) { /* A reply can be lost after WebTrack applied the addition. Read once; never retry the POST. */ }
        var actual, actualSnapshot;
        try { actual = await io.read(); actualSnapshot = snapshot(actual); } catch (_) { throw reviewError(); }
        if (actualSnapshot !== snapshot(next)) {
          if (product.pid === PAIR.camera && actualSnapshot === fresh.baseline) {
            var unchanged = Error('Neither item was added. Your cart is unchanged. Check the product pages.'); unchanged.safeCart = true; throw unchanged;
          }
          throw reviewError();
        }
        expected = actual;
      }
      return {status: 'added', cart: expected, added: [{pid: PAIR.camera, quantity: 1}, {pid: PAIR.battery, quantity: 1}]};
    } finally { busy.delete(io); }
  }
  function money(cents) { return '$' + (cents / 100).toFixed(2); }
  function mount(doc, host, io, options) {
    if (!host || host.querySelector('[data-wl-product-pair]')) return;
    var box = doc.createElement('section'); box.className = 'wl-product-pair'; box.setAttribute('data-wl-product-pair', PAIR.id);
    box.innerHTML = '<div class="wl-pair-eyebrow">PAIR WITH SPARE POWER</div><h2>Camera ready. Backups handy.</h2><p class="wl-pair-disclosure"></p><div class="wl-pair-products"><a href="/ProductDetail.aspx?pid=246159"><img width="180" height="170" src="https://images-woodsonlumber.sirv.com/merchant-feed/products/246159/main-d066bc7f930a45c5.jpg" alt="WGI SPARK 2.0 Lightsout camera"><strong>SPARK 2.0 combo</strong><span data-pair-price="camera"></span></a><span class="wl-pair-plus" aria-hidden="true">+</span><a href="/ProductDetail.aspx?pid=2853"><img width="180" height="170" src="https://images-woodsonlumber.sirv.com/merchant-feed/products/2853/main-80e2c51bf54b4660.jpg" alt="Energizer MAX AA 8-pack"><strong>Energizer MAX AA 8-pack</strong><span data-pair-price="battery"></span></a></div><label class="wl-pair-choice"><input type="checkbox"> Include one optional spare 8-pack with one camera</label><p class="wl-pair-fit"></p><div class="wl-pair-actions"><button type="button" disabled>Check pair availability</button><strong class="wl-pair-total"></strong></div><p role="status" aria-live="polite" class="wl-pair-status"></p><a class="wl-pair-cart" href="/ShoppingCart.aspx" hidden>Review your cart &rarr;</a>';
    box.querySelector('.wl-pair-disclosure').textContent = PAIR.disclosure;
    box.querySelector('.wl-pair-fit').textContent = PAIR.compatibility;
    host.appendChild(box);
    var choice = box.querySelector('input'), button = box.querySelector('button'), status = box.querySelector('[role="status"]');
    var quote, pending = false, finished = false;
    async function refresh() {
      button.disabled = true; status.textContent = 'Checking current prices and your selected store…';
      try {
        quote = await prepare(io);
        box.querySelector('[data-pair-price="camera"]').textContent = money(quote.camera.price);
        box.querySelector('[data-pair-price="battery"]').textContent = money(quote.battery.price);
        box.querySelector('.wl-pair-total').textContent = money(quote.total) + ' for both';
        status.textContent = 'In stock at ' + quote.cart.store + '. Pickup or delivery eligibility and timing are confirmed in checkout.';
        button.textContent = 'Add both to cart'; button.disabled = !choice.checked || pending || finished;
      } catch (e) { status.textContent = e.message; button.textContent = 'Pair unavailable'; }
    }
    choice.addEventListener('change', function () { button.disabled = !choice.checked || !quote || pending || finished; });
    button.addEventListener('click', async function () {
      if (pending || finished) return;
      if (!quote) { await refresh(); return; }
      if (!choice.checked) return;
      pending = true; button.disabled = true; choice.disabled = true;
      status.textContent = 'Adding your selected pair…';
      try {
        await addBoth(io, quote, choice.checked); finished = true;
        status.textContent = 'Added one camera and one spare battery 8-pack. Your other cart items are preserved.';
        button.textContent = 'Both added'; box.querySelector('.wl-pair-cart').hidden = false;
      } catch (e) {
        status.textContent = e.message;
        if (e.reviewCart || e.safeCart) { finished = true; button.textContent = 'Review cart'; box.querySelector('.wl-pair-cart').hidden = false; }
        else { quote = null; button.textContent = 'Check prices again'; choice.checked = false; button.disabled = false; }
      } finally { pending = false; choice.disabled = finished; }
    });
    refresh();
    return {element: box, refresh: refresh};
  }
  function boot(win, options) {
    // Stage only. Future release must explicitly wire this page-scoped module.
    if (!RELEASE_ENABLED || !options?.releaseApproved || win.location.origin !== 'https://webtrack.woodsonlumber.com' || !/^\/ProductDetail\.aspx$/i.test(win.location.pathname) || new URLSearchParams(win.location.search).get('pid') !== PAIR.camera) return;
    if (!win.WLCartSubstitutions || !win.WLPickupAvailability || !win.document.querySelector('a[href*="SignOut=1" i]')) return;
    var host = win.document.querySelector(options.mountSelector);
    return mount(win.document, host, win.WLCartSubstitutions.adapter(win, win.WLPickupAvailability));
  }
  return {enabled: RELEASE_ENABLED, pair: PAIR, snapshot: snapshot, prepare: prepare, addBoth: addBoth, mount: mount, boot: boot};
});
