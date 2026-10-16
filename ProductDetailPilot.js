/* Light product-detail preview. Existing WebTrack controls own every purchase action. */
(function (root, factory) {
  'use strict';
  var core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else core.boot(root).catch(function () { /* Retain the existing product page. */ });
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  var BUILD = '20261016-pdp-light-1';
  var ORIGIN = 'https://webtrack.woodsonlumber.com';
  var ASSETS = 'https://ckunkel510.github.io/WL.github.io/';
  var SCOPE = 'data-wl-pdp-preview';
  function text(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function signedIn(doc) { return !!doc.querySelector('a[href*="SignOut=1"],a[href*="signout=1"]'); }
  function pilotAccount(doc) {
    if (!signedIn(doc)) return false;
    var names = Array.from(doc.querySelectorAll('.formPageHeader')).map(function (node) {
      var match = text(node.textContent).match(/^Change (?:password|details) for user\s+['"]([^'"]+)['"]$/i);
      return match ? match[1].toLowerCase() : '';
    }).filter(Boolean);
    return names.length > 0 && names.every(function (name) { return name === 'ckunkel2'; });
  }
  async function verifyAccount(win) {
    if (!signedIn(win.document)) return false;
    var controller = new win.AbortController();
    var timer = win.setTimeout(function () { controller.abort(); }, 8000);
    try {
      var response = await win.fetch('/AccountSettings.aspx', {
        credentials: 'same-origin', cache: 'no-store', signal: controller.signal
      });
      var url = new URL(response.url, win.location.origin);
      if (!response.ok || url.origin !== ORIGIN || !/^\/AccountSettings\.aspx$/i.test(url.pathname)) return false;
      var page = new win.DOMParser().parseFromString(await response.text(), 'text/html');
      return signedIn(win.document) && pilotAccount(page);
    } catch (_) { return false; }
    finally { win.clearTimeout(timer); }
  }
  function ratingSummary(section) {
    var count = section.querySelectorAll('.wl-review-item').length;
    var stars = section.querySelector('.wl-review-summary .wl-review-stars');
    var value = Number.parseFloat(stars?.getAttribute('aria-label') || '');
    return count && Number.isFinite(value) && value > 0 && value <= 5
      ? { count: count, value: value, label: value.toFixed(1) + ' · ' + count + ' review' + (count === 1 ? '' : 's') }
      : null;
  }
  async function boot(win) {
    if (!win || win.top !== win || win.location.origin !== ORIGIN || !/^\/ProductDetail\.aspx$/i.test(win.location.pathname) || win.WLPdpExperience) return;
    var doc = win.document;
    if (doc.readyState === 'loading') await new Promise(function (resolve) { doc.addEventListener('DOMContentLoaded', resolve, { once: true }); });
    if (!await verifyAccount(win)) return;
    var link = doc.createElement('link');
    link.rel = 'stylesheet'; link.href = ASSETS + 'ProductDetailPilot.css?v=' + BUILD;
    var loaded = await new Promise(function (resolve) {
      var timer = win.setTimeout(function () { resolve(false); }, 8000);
      link.onload = function () { win.clearTimeout(timer); resolve(true); };
      link.onerror = function () { win.clearTimeout(timer); resolve(false); };
      doc.head.appendChild(link);
    });
    if (!loaded || !signedIn(doc)) { link.remove(); return; }
    var moves = new Map(), attributes = new Map(), copies = new Map(), generated = new Set(), listeners = [];
    var revoked = false, scheduled = false, checking = false, observer;
    function listen(node, name, handler) { node.addEventListener(name, handler); listeners.push([node, name, handler]); }
    function make(tag, className, copy) {
      var node = doc.createElement(tag); node.className = className;
      if (copy) node.textContent = copy;
      generated.add(node); return node;
    }
    function attr(node, name, value) {
      if (!node || node.getAttribute(name) === value) return;
      if (!attributes.has(node)) attributes.set(node, new Map());
      if (!attributes.get(node).has(name)) attributes.get(node).set(name, node.getAttribute(name));
      node.setAttribute(name, value);
    }
    function copy(node, value) {
      if (!node || node.textContent === value) return;
      if (!copies.has(node)) copies.set(node, node.textContent);
      node.textContent = value;
    }
    function move(node, parent, before) {
      if (!node || !parent || (node.parentNode === parent && (!before || node.nextSibling === before))) return;
      if (!moves.has(node)) {
        var marker = doc.createComment('pdp original position');
        node.before(marker); moves.set(node, marker);
      }
      parent.insertBefore(node, before || null);
    }
    function revoke() {
      if (revoked) return;
      revoked = true; observer?.disconnect(); doc.documentElement.removeAttribute(SCOPE);
      listeners.forEach(function (entry) { entry[0].removeEventListener(entry[1], entry[2]); });
      // Restore moved controls before removing their presentation-only wrappers.
      Array.from(moves.entries()).reverse().forEach(function (entry) { if (entry[1].parentNode) entry[1].replaceWith(entry[0]); });
      copies.forEach(function (value, node) { node.textContent = value; });
      attributes.forEach(function (values, node) { values.forEach(function (value, name) { if (value === null) node.removeAttribute(name); else node.setAttribute(name, value); }); });
      generated.forEach(function (node) { node.remove(); }); link.remove();
    }
    var galleryBound = new WeakSet();
    function reconcile() {
      if (revoked || checking) return;
      if (!signedIn(doc)) { revoke(); return; }
      var page = doc.getElementById('product-page'), heading = doc.querySelector('.wl-pdp-heading');
      var sidebar = doc.getElementById('product-sidebar'), box = sidebar?.querySelector('.wl-pdp-buybox');
      if (!page || !heading || !box) return;
      doc.documentElement.setAttribute(SCOPE, BUILD);
      var share = doc.getElementById('share-product-button');
      if (share) {
        move(share, heading); attr(share, 'type', 'button'); attr(share, 'aria-label', 'Share this product');
        attr(share.querySelector('svg'), 'aria-hidden', 'true');
        if (!share.querySelector('.wl-pdp-share-label')) share.appendChild(make('span', 'wl-pdp-share-label', 'Share'));
      }
      var quote = doc.querySelector('.wl-quote-product');
      if (quote) {
        move(quote, sidebar);
        copy(quote.firstElementChild?.children[0], 'Planning a larger project?');
        copy(quote.firstElementChild?.children[1], 'Ask us about project pricing.');
      }
      var price = box.querySelector('.wl-product-price-row, .wl-price-login-gate');
      if (price && box.firstElementChild !== price) move(price, box, box.firstChild);
      var methods = box.querySelector('.wl-pdp-method-row');
      if (methods && !box.querySelector('.wl-pdp-fulfillment-label')) {
        var label = make('div', 'wl-pdp-fulfillment-label', 'How to get it'); methods.before(label);
        attr(methods, 'role', 'group'); attr(methods, 'aria-label', 'Pickup or delivery');
      }
      var action = box.querySelector('.wl-pdp-action-row'), input = action?.querySelector('input.productQtyInput');
      if (input && !action.querySelector('.wl-pdp-quantity-label')) {
        var quantityLabel = make('label', 'wl-pdp-quantity-label', 'Quantity'); quantityLabel.htmlFor = input.id; action.prepend(quantityLabel);
      }
      action?.querySelectorAll('.productQtySegment button').forEach(function (button) {
        attr(button, 'aria-label', text(button.textContent) === '+' ? 'Increase quantity' : 'Decrease quantity');
      });
      var quicklist = doc.getElementById('ctl00_PageBody_productDetail_ctl00_QuickList_QuickListLink');
      var stock = doc.getElementById('ctl00_PageBody_productDetail_ctl00_btnShowStock');
      var tools = box.querySelector('.wl-pdp-tools');
      if (!tools && (quicklist || stock)) { tools = make('div', 'wl-pdp-tools'); box.appendChild(tools); }
      if (quicklist) {
        var wrap = quicklist.closest('.mb-1'); if (wrap) move(wrap, tools);
        copy(quicklist.querySelector('span'), 'Save to Quicklist');
      }
      if (stock) { move(stock.parentElement, tools); copy(stock, 'Store inventory'); }
      var banner = box.querySelector('.wl-fulfillment-detail');
      if (banner && !banner.closest('.wl-pdp-fulfillment-help')) {
        var details = make('details', 'wl-pdp-fulfillment-help');
        details.appendChild(make('summary', '', 'Pickup & delivery details')); box.appendChild(details); move(banner, details);
      }
      var reviews = doc.getElementById('customer-reviews'), rating = reviews ? ratingSummary(reviews) : null;
      var ratingLink = heading.querySelector('.wl-pdp-rating');
      if (rating) {
        if (!ratingLink) { ratingLink = make('a', 'wl-pdp-rating'); ratingLink.href = '#customer-reviews'; heading.appendChild(ratingLink); }
        if (ratingLink.dataset.summary !== rating.label) {
          var stars = reviews.querySelector('.wl-review-summary .wl-review-stars').cloneNode(true);
          ratingLink.replaceChildren(stars, doc.createTextNode(rating.label));
          ratingLink.dataset.summary = rating.label;
          ratingLink.setAttribute('aria-label', rating.value.toFixed(1) + ' out of 5 stars, ' + rating.count + ' reviews. Read reviews');
        }
      } else if (ratingLink) { ratingLink.remove(); }
      var mainImage = doc.getElementById('ctl00_PageBody_productDetail_ProductImage');
      if (mainImage && !mainImage.getAttribute('alt')) attr(mainImage, 'alt', text(doc.getElementById('wl-product-title')?.textContent) || 'Product image');
      doc.querySelectorAll('.wl-product-thumbnail').forEach(function (thumb, index) {
        var image = thumb.querySelector('img'); if (!image) return;
        attr(thumb, 'role', 'button'); attr(thumb, 'tabindex', '0'); attr(thumb, 'aria-label', 'View product image ' + (index + 1));
        attr(thumb, 'aria-pressed', mainImage?.src === image.src ? 'true' : 'false');
        if (galleryBound.has(thumb)) return;
        galleryBound.add(thumb);
        listen(thumb, 'click', function (event) { if (event.target !== image) image.click(); schedule(); });
        listen(thumb, 'keydown', function (event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); image.click(); schedule(); } });
      });
    }
    function schedule() {
      if (scheduled || revoked || checking) return;
      scheduled = true;
      win.requestAnimationFrame(function () { scheduled = false; reconcile(); });
    }
    async function recheck() {
      if (revoked || checking) return;
      checking = true;
      doc.documentElement.removeAttribute(SCOPE);
      var allowed = await verifyAccount(win); checking = false;
      if (!allowed) revoke(); else reconcile();
    }
    observer = new win.MutationObserver(schedule);
    observer.observe(doc.getElementById('MainLayoutRow') || doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'aria-label'] });
    listen(win, 'focus', recheck);
    listen(win, 'pageshow', function (event) { if (event.persisted) recheck(); });
    win.WLPdpExperience = { build: BUILD, audience: 'ckunkel2', revoke: revoke };
    reconcile();
  }
  return { boot: boot, pilotAccount: pilotAccount, verifyAccount: verifyAccount, ratingSummary: ratingSummary, build: BUILD };
});
