/* Light product-detail experience. Existing WebTrack controls own every purchase action. */
(function (root, factory) {
  'use strict';
  var core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else core.boot(root).catch(function () { /* Retain the existing product page. */ });
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  var BUILD = '20261016-pdp-light-3';
  var ORIGIN = 'https://webtrack.woodsonlumber.com';
  var ASSETS = 'https://ckunkel510.github.io/WL.github.io/';
  var SCOPE = 'data-wl-pdp-preview';
  function text(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function ratingSummary(section) {
    var count = section.querySelectorAll('.wl-review-item').length;
    var stars = section.querySelector('.wl-review-summary .wl-review-stars');
    var value = Number.parseFloat(stars?.getAttribute('aria-label') || '');
    return count && Number.isFinite(value) && value > 0 && value <= 5
      ? { count: count, value: value, label: value.toFixed(1) + ' · ' + count + ' review' + (count === 1 ? '' : 's') }
      : null;
  }
  function stickyFits(height, viewportHeight) {
    // A tall purchase panel scrolls normally so every action remains reachable.
    return height > 0 && height + 56 + 16 <= viewportHeight;
  }
  async function boot(win) {
    if (!win || win.top !== win || win.location.origin !== ORIGIN || !/^\/ProductDetail\.aspx$/i.test(win.location.pathname) || win.WLPdpExperience) return;
    var doc = win.document;
    if (doc.readyState === 'loading') await new Promise(function (resolve) { doc.addEventListener('DOMContentLoaded', resolve, { once: true }); });
    var link = doc.createElement('link');
    link.rel = 'stylesheet'; link.href = ASSETS + 'ProductDetailPilot.css?v=' + BUILD;
    var loaded = await new Promise(function (resolve) {
      var timer = win.setTimeout(function () { resolve(false); }, 8000);
      link.onload = function () { win.clearTimeout(timer); resolve(true); };
      link.onerror = function () { win.clearTimeout(timer); resolve(false); };
      doc.head.appendChild(link);
    });
    if (!loaded) { link.remove(); return; }
    var moves = new Map(), attributes = new Map(), copies = new Map(), generated = new Set(), listeners = [];
    var revoked = false, scheduled = false, observer, observedSidebar;
    var sidebarResize = win.ResizeObserver ? new win.ResizeObserver(schedule) : null;
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
      revoked = true; observer?.disconnect(); sidebarResize?.disconnect(); doc.documentElement.removeAttribute(SCOPE);
      listeners.forEach(function (entry) { entry[0].removeEventListener(entry[1], entry[2]); });
      // Restore moved controls before removing their presentation-only wrappers.
      Array.from(moves.entries()).reverse().forEach(function (entry) { if (entry[1].parentNode) entry[1].replaceWith(entry[0]); });
      copies.forEach(function (value, node) { node.textContent = value; });
      attributes.forEach(function (values, node) { values.forEach(function (value, name) { if (value === null) node.removeAttribute(name); else node.setAttribute(name, value); }); });
      generated.forEach(function (node) { node.remove(); }); link.remove();
    }
    var galleryBound = new WeakSet();
    function reconcile() {
      if (revoked) return;
      var page = doc.getElementById('product-page'), heading = doc.querySelector('.wl-pdp-heading');
      var sidebar = doc.getElementById('product-sidebar'), box = sidebar?.querySelector('.wl-pdp-buybox');
      if (!page || !heading || !box) return;
      doc.documentElement.setAttribute(SCOPE, BUILD);
      var rail = page.querySelector(':scope > .wl-pdp-sidebar-rail');
      if (!rail) { rail = make('div', 'wl-pdp-sidebar-rail'); rail.style.display = 'contents'; sidebar.before(rail); }
      move(sidebar, rail);
      if (sidebar !== observedSidebar) {
        sidebarResize?.disconnect(); sidebarResize?.observe(sidebar); observedSidebar = sidebar;
      }
      attr(sidebar, 'data-wl-pdp-sticky-fit', String(stickyFits(sidebar.getBoundingClientRect().height, win.innerHeight)));
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
      if (scheduled || revoked) return;
      scheduled = true;
      win.requestAnimationFrame(function () { scheduled = false; reconcile(); });
    }
    observer = new win.MutationObserver(schedule);
    observer.observe(doc.getElementById('MainLayoutRow') || doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'aria-label', 'open'] });
    listen(win, 'resize', schedule);
    listen(win, 'pageshow', function (event) { if (event.persisted) schedule(); });
    win.WLPdpExperience = { build: BUILD, audience: 'public', revoke: revoke };
    reconcile();
  }
  return { boot: boot, ratingSummary: ratingSummary, stickyFits: stickyFits, build: BUILD };
});
