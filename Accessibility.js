/* Woodson WebTrack accessibility. Presentation only; native commerce owns state. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.WLAccessibilityEnhancer = api; api.boot(root); }
})(typeof window === 'object' ? window : this, function () {
  'use strict';
  var BUILD = '20261112-accessibility-2';
  var PAGES = /\/(?:Products|ProductDetail|ShoppingCart|SignIn|Default)\.aspx$/i;
  var FIELDS = 'input:not([type="hidden"]),select,textarea';
  var INVALID = '.wl-field-invalid,.is-invalid,.input-validation-error,[aria-invalid="true"]';
  var ERRORS = '.wl-field-msg,.wl-inline-error,.wl-pa-error,span[controltovalidate],.field-validation-error,.validation-summary-errors';
  var CONTINUE = '.wl-proxy-continue,[data-wl-next],#ctl00_PageBody_ContinueButton1,#ctl00_PageBody_ContinueButton2';
  function text(node) { return String(node && node.textContent || '').replace(/\s+/g, ' ').trim(); }
  function clean(value) { return String(value || '').replace(/[\uE000-\uF8FF]/g, '').replace(/[🛒↗⌄]/gu, '').replace(/\s+/g, ' ').trim(); }
  function set(node, key, value) { if (node && node.getAttribute(key) !== String(value)) node.setAttribute(key, String(value)); }
  function all(node, selector) { return Array.from(node.querySelectorAll(selector)); }
  function visible(win, node) {
    if (!node || !node.isConnected || node.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
    var style = win.getComputedStyle(node);
    return style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0;
  }
  function zoomContent(content) {
    return String(content || '').split(',').map(function (part) { return part.trim(); }).filter(function (part) {
      return part && !/^(?:maximum-scale|minimum-scale|user-scalable)\s*=/i.test(part);
    }).join(',');
  }
  function boot(win) {
    if (!win || win.top !== win || win.location.origin !== 'https://webtrack.woodsonlumber.com' || !PAGES.test(win.location.pathname)) return null;
    if (win.WLAccessibilityRuntime) return win.WLAccessibilityRuntime;
    var doc = win.document, stopped = false, timer = null, serial = 0, observer, manager;
    var pending = null, stock = null, boundFrame = null, frameCleanup = null, promotedHeading = null;
    var invalidOwned = new Map(), descriptions = new Map(), background = new Map();
    var listeners = [], frameLoads = new Map();
    function listen(target, name, fn, options) { target.addEventListener(name, fn, options); listeners.push(function () { target.removeEventListener(name, fn, options); }); }
    function id(node) { if (!node.id) { var next; do { next = 'wl-a11y-' + (++serial); } while (doc.getElementById(next)); node.id = next; } return node.id; }
    function main() { return doc.getElementById('MainLayoutRow'); }
    function focus(node) { if (node) { try { node.focus({ preventScroll: true }); node.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch (_) {} } }
    function style() {
      if (doc.getElementById('wl-a11y-style')) return;
      var node = doc.createElement('style'); node.id = 'wl-a11y-style';
      node.textContent = '.wl-a11y-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;clip-path:inset(50%)!important;white-space:nowrap!important;border:0!important}' +
        '.wl-a11y-skip{position:fixed!important;top:8px!important;left:8px!important;z-index:2147483000!important;transform:translateY(-180%);background:#fff!important;color:#6b0016!important;border:3px solid #6b0016!important;border-radius:4px;padding:12px 18px!important;font:700 16px/1.4 Arial,sans-serif!important}' +
        '.wl-a11y-skip:focus{transform:none;outline:3px solid #f4c400!important;outline-offset:2px}' +
        '#MainLayoutRow{scroll-margin-top:160px}.wl-a11y-errors{box-sizing:border-box;max-width:100%;margin:12px 0;padding:16px;background:#fff7f8;color:#3c1020;border:2px solid #6b0016;border-radius:6px;overflow-wrap:anywhere}.wl-a11y-errors h2{font-size:18px}.wl-a11y-errors a{color:#6b0016!important;text-decoration:underline!important}.wl-a11y-errors a:focus-visible{outline:3px solid #6b0016;outline-offset:3px}' +
        '.wl-pdp-recommendation-item,.wl-smart-search-item{display:flex;flex:0 0 calc((100% - 42px)/4);min-width:0;scroll-snap-align:start}.wl-pdp-recommendation-item>.wl-pdp-recommendation-card,.wl-smart-search-item>.wl-smart-search-card{width:100%;flex:1 1 auto}' +
        '@media(max-width:1050px){.wl-pdp-recommendation-item{flex-basis:calc((100% - 14px)/2)}}@media(max-width:767px){.wl-pdp-recommendation-item{flex-basis:min(78vw,285px)}.wl-pdp-recommendation-card{min-height:325px}}' +
        '@media(max-width:900px){.wl-smart-search-item{flex-basis:calc((100% - 14px)/2)}}@media(max-width:600px){.wl-smart-search-item{flex-basis:78%}}';
      doc.head.appendChild(node);
    }
    function pageStructure() {
      if (!doc.documentElement.getAttribute('lang')) set(doc.documentElement, 'lang', 'en');
      all(doc, 'meta[name="viewport"]').forEach(function (node) { set(node, 'content', zoomContent(node.content)); });
      var container = main(); if (!container) return;
      var existingMain = doc.querySelector('main,[role="main"]');
      if (!existingMain || existingMain === container) { set(container, 'role', 'main'); if (!container.hasAttribute('tabindex')) set(container, 'tabindex', '-1'); }
      if (!doc.getElementById('wl-a11y-skip')) {
        var skip = doc.createElement('a'); skip.id = 'wl-a11y-skip'; skip.className = 'wl-a11y-skip'; skip.href = '#MainLayoutRow'; skip.textContent = 'Skip to main content';
        skip.addEventListener('click', function (event) { event.preventDefault(); focus(main()); }); doc.body.insertBefore(skip, doc.body.firstChild);
      }
      var ownHeading = doc.getElementById('wl-a11y-page-heading');
      var headings = all(container, 'h1,h2,[role="heading"][aria-level="1"]').filter(function (node) { return node !== ownHeading && visible(win, node) && text(node); });
      var nativeH1 = headings.find(function (node) { return node.tagName === 'H1'; });
      if (nativeH1 && promotedHeading) {
        if (promotedHeading.node.getAttribute('aria-level') === '1') {
          if (promotedHeading.before === null) promotedHeading.node.removeAttribute('aria-level'); else set(promotedHeading.node,'aria-level',promotedHeading.before);
        }
        promotedHeading = null;
      }
      var h1 = nativeH1 || headings.find(function (node) { return node.getAttribute('aria-level') === '1'; });
      if (h1) { if (ownHeading) ownHeading.remove(); }
      else if (/\/(?:ShoppingCart|SignIn)\.aspx$/i.test(win.location.pathname) && headings.length) {
        promotedHeading = { node:headings[0],before:headings[0].getAttribute('aria-level') }; set(headings[0], 'aria-level', '1'); if (ownHeading) ownHeading.remove();
      } else {
        if (!ownHeading) { ownHeading = doc.createElement('h1'); ownHeading.id = 'wl-a11y-page-heading'; ownHeading.className = 'wl-a11y-only'; container.insertBefore(ownHeading, container.firstChild); }
        var term = new URLSearchParams(win.location.search || '').get('searchText');
        var name = term ? 'Search results for ' + term.slice(0,180) : 'Shop products';
        if (text(ownHeading) !== name) ownHeading.textContent = name;
      }
      all(container, 'h1,h2,h3,h4,h5,h6').forEach(function (node) { if (!text(node) && !node.querySelector('input,button,a,select,textarea,img')) set(node, 'aria-hidden', 'true'); });
    }
    function productName(card) {
      var title = card.querySelector('.sflDesc,#ProductDescriptionRow a,.productDescriptionRow a,.wl-product-card__title');
      if (title && text(title)) return clean(text(title));
      if (card.matches('.cart-item-card')) {
        var description = card.querySelector('h6')?.parentElement.querySelector('p');
        if (description && text(description)) return clean(text(description));
      }
      return clean(text(card.querySelector('a[href*="ProductDetail.aspx"]')));
    }
    function contextualize(scope, name) {
      if (!name) return;
      all(scope, 'button,a,input:not([type="hidden"]),select,[role="group"]').forEach(function (node) {
        if (node.matches('input,select') && !node.matches('.wl-qty-select,[id*="qty_"],[id$="ProductQuantity"]')) return;
        var old = clean(node.getAttribute('aria-label')), label = clean(text(node));
        var action = '';
        if (node.matches('.wl-qty-decrease') || /^Decrease quantity(?: for |$)/i.test(old)) action = 'Decrease quantity';
        else if (node.matches('.wl-qty-increase') || /^Increase quantity(?: for |$)/i.test(old)) action = 'Increase quantity';
        else if (node.matches('.wl-qty-select,[id*="qty_"],[id$="ProductQuantity"],.wl-qty-control')) action = 'Quantity';
        else if (/^(?:Add|Add to Cart|Quick buy|Save for Later|Saved for later|Save to Quicklist|Save|Delete|Remove|Find a substitute|Be the first to review)$/i.test(label)) action = label;
        if (action) set(node, 'aria-label', action + ' for ' + name);
      });
    }
    function shoppingNames() {
      var container = main(); if (!container) return;
      all(container, '.wl-product-card,.cart-item-card,.sflRow').forEach(function (card) { contextualize(card, productName(card)); });
      if (/\/ProductDetail\.aspx$/i.test(win.location.pathname)) contextualize(container, clean(text(container.querySelector('#wl-product-title,h1'))));
      all(container, 'select[id*="SearchOrderControl"]').forEach(function (node) { if (!node.getAttribute('aria-labelledby')) set(node, 'aria-label', 'Sort products'); });
      all(container, 'a[id$="lnkGrid"],a[id$="lnkList"]').forEach(function (node) { set(node, 'aria-label', /lnkGrid$/.test(node.id) ? 'Show product grid' : 'Show product list'); });
      all(container, '.ProductGroupCardContainer,[id="ProductGroupCardContainer"]').forEach(function (card) {
        var header = card.querySelector('a[id$="ProductGroupLinkHeader"]'); var name = clean(text(header)); if (!name) return;
        all(card, 'a[href]').forEach(function (node) {
          if (!text(node) && !node.getAttribute('aria-labelledby')) set(node, 'aria-label', 'Shop ' + name);
        });
      });
      // A visible native reference label must also be associated with its field.
      var reference = doc.getElementById('ctl00_PageBody_PurchaseOrderNumberTextBox');
      if (reference && !reference.labels?.length && !reference.getAttribute('aria-labelledby')) set(reference, 'aria-label', 'Purchase order number / Your reference');
    }
    function recommendationLinks() {
      // Also repair already-cached renderers, preserving each actual link and
      // its attached analytics/navigation handlers rather than cloning it.
      all(doc,'a.wl-pdp-recommendation-card[role="listitem"],a.wl-smart-search-card[role="listitem"]').forEach(function (card) {
        var item = doc.createElement('div'); item.className = card.matches('.wl-pdp-recommendation-card') ? 'wl-pdp-recommendation-item' : 'wl-smart-search-item';
        item.setAttribute('role','listitem'); card.before(item); item.appendChild(card); card.removeAttribute('role');
      });
    }
    function errorNodes() { return main() ? all(main(), ERRORS).filter(function (node) { return visible(win, node) && text(node); }) : []; }
    function removeDescriptions() {
      descriptions.forEach(function (tokens, node) {
        var keep = String(node.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (token) { return token && !tokens.has(token); });
        if (keep.length) set(node, 'aria-describedby', keep.join(' ')); else if (node.hasAttribute('aria-describedby')) node.removeAttribute('aria-describedby');
      }); descriptions.clear();
    }
    function describe(field, message) {
      var token = id(message), current = String(field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      if (current.indexOf(token) < 0) { current.push(token); set(field, 'aria-describedby', current.join(' ')); if (!descriptions.has(field)) descriptions.set(field, new Set()); descriptions.get(field).add(token); }
    }
    function syncErrors() {
      if (!/\/ShoppingCart\.aspx$/i.test(win.location.pathname) || !main()) return;
      var errors = errorNodes(), links = [], invalid = new Set();
      var fields = all(main(), FIELDS).filter(function (node) { return !node.disabled && visible(win, node); });
      // Restore only attributes added by us, never native invalid flags.
      invalidOwned.forEach(function (before, node) {
        var remains = node.isConnected && (node.matches('.wl-field-invalid,.is-invalid,.input-validation-error') || (node.validity && !node.validity.valid && errors.length > 0) || errors.some(function (error) { return error.getAttribute('controltovalidate') === node.id; }));
        if (!remains) { if (node.getAttribute('aria-invalid') === 'true') { if (before === null) node.removeAttribute('aria-invalid'); else set(node, 'aria-invalid', before); } invalidOwned.delete(node); }
      });
      fields.forEach(function (field) {
        if (field.matches(INVALID) || (errors.length && field.validity && !field.validity.valid)) invalid.add(field);
      });
      // Don't remove/re-add existing associations on every MutationObserver pass.
      descriptions.forEach(function (tokens, node) {
        tokens.forEach(function (token) {
          var error = doc.getElementById(token);
          if (error && errors.includes(error) && (invalid.has(node) || error.getAttribute('controltovalidate') === node.id)) return;
          var keep = String(node.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (t) { return t && t !== token; });
          if (keep.length) set(node, 'aria-describedby', keep.join(' ')); else node.removeAttribute('aria-describedby'); tokens.delete(token);
        });
        if (!tokens.size) descriptions.delete(node);
      });
      fields.forEach(function (field) {
        var direct = errors.find(function (error) { return error.getAttribute('controltovalidate') === field.id; });
        if (direct) invalid.add(field);
        if (!invalid.has(field)) return;
        if (!invalidOwned.has(field) && field.getAttribute('aria-invalid') !== 'true') { invalidOwned.set(field, field.getAttribute('aria-invalid')); set(field, 'aria-invalid', 'true'); }
        var group = field.closest('.form-group,.epi-form-group-checkout,.epi-form-col-single-checkout');
        var pane = field.closest('.checkout-step');
        var message = direct || errors.find(function (error) { return group && group.contains(error); }) || errors.find(function (error) { return pane && pane.contains(error); });
        if (message) { describe(field, message); links.push({ target: field, message: text(message) }); }
      });
      errors.forEach(function (error) {
        if (!links.some(function (link) { return link.message === text(error); }) && !error.matches('.wl-inline-error')) links.push({ target: error, message: text(error) });
      });
      if (!links.length && errors.length) links.push({ target: errors[0], message: text(errors[0]) });
      var summary = doc.getElementById('wl-a11y-error-summary');
      if (!links.length) { if (summary) summary.remove(); return; }
      // Existing errors get associations immediately; focus/summary require an
      // actual failed Next/Continue, never a background availability refresh.
      if (!pending && !summary) return;
      if (pending && (pending.disabled || /^(?:waiting|confirming|posting|validating)$/.test(pending.dataset.wlContinueState || ''))) return;
      if (!summary) {
        summary = doc.createElement('section'); summary.id = 'wl-a11y-error-summary'; summary.className = 'wl-a11y-errors'; summary.tabIndex = -1;
        set(summary, 'aria-labelledby', 'wl-a11y-error-heading');
        var heading = doc.createElement('h2'); heading.id = 'wl-a11y-error-heading'; heading.textContent = 'Please review these checkout details'; summary.appendChild(heading); summary.appendChild(doc.createElement('ul'));
        var guide = doc.getElementById('wl-native-guide');
        if (guide && main().contains(guide)) guide.insertAdjacentElement('afterend',summary);
        else main().insertBefore(summary, main().firstChild);
      }
      var list = summary.querySelector('ul');
      var signature = links.map(function (link) { return id(link.target) + ':' + link.message; }).join('|');
      if (summary.getAttribute('data-wl-error-signature') !== signature) {
        set(summary, 'data-wl-error-signature', signature); list.replaceChildren();
        links.slice(0,12).forEach(function (link) {
          var item = doc.createElement('li'), anchor = doc.createElement('a'); anchor.href = '#' + id(link.target);
          var label = clean(link.target.getAttribute('aria-label') || (link.target.labels?.length ? text(link.target.labels[0]) : ''));
          anchor.textContent = (label ? label + ': ' : '') + link.message;
          anchor.addEventListener('click', function (event) { event.preventDefault(); if (!link.target.matches(FIELDS)) set(link.target, 'tabindex', '-1'); focus(link.target); }); item.appendChild(anchor); list.appendChild(item);
        });
      }
      if (pending) {
        pending = null;
        var first = links.find(function (link) { return link.target.matches(FIELDS); });
        if (first) { if (doc.activeElement !== first.target) focus(first.target); } else focus(summary);
      }
    }
    function restoreBackground() {
      background.forEach(function (before, node) {
        if (node.getAttribute('inert') === '') { if (before.inert === null) node.removeAttribute('inert'); else set(node,'inert',before.inert); }
        if (node.getAttribute('aria-hidden') === 'true') { if (before.hidden === null) node.removeAttribute('aria-hidden'); else set(node,'aria-hidden',before.hidden); }
      }); background.clear();
    }
    function stockActive() {
      if (!stock || !stock.wrapper.isConnected) return false;
      if (!visible(win, stock.wrapper)) return false;
      var z = Number(win.getComputedStyle(stock.wrapper).zIndex) || 0;
      return !all(doc, '.RadWindow,[role="dialog"][aria-modal="true"]').some(function (node) {
        return node !== stock.wrapper && !stock.wrapper.contains(node) && visible(win,node) && (Number(win.getComputedStyle(node).zIndex) || 0) > z;
      });
    }
    function stockFocus() {
      if (!stockActive()) return;
      var target = boundFrame?.getElementById('wl-a11y-stock-heading');
      if (target) { try { target.focus(); } catch (_) {} } else focus(stock.wrapper);
    }
    function bindStockDocument(frame) {
      if (!stock || stock.frame !== frame || !stockActive()) return;
      var child;
      try { child = frame.contentDocument; if (!child || !child.body || !child.querySelector('form')) return; } catch (_) { return; }
      if (boundFrame === child) return;
      if (frameCleanup) frameCleanup(); boundFrame = child;
      if (!child.documentElement.lang) set(child.documentElement, 'lang', 'en');
      var heading = child.getElementById('wl-a11y-stock-heading') || child.createElement('h1'); heading.id = 'wl-a11y-stock-heading'; heading.tabIndex = -1; heading.textContent = stock.label;
      // This frame has separate CSS. Keep its existing visible table layout.
      heading.style.cssText = 'position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap'; child.body.insertBefore(heading,child.body.firstChild);
      function candidates() { return all(child,'a[href],button,input:not([type="hidden"]),select,textarea,[tabindex]').filter(function (node) { return node.tabIndex >= 0 && !node.disabled && visible(child.defaultView,node); }); }
      function key(event) {
        if (!stockActive()) return;
        if (event.key === 'Escape') {
          var close = all(child,'button,a').find(function (node) { return /^Close$/i.test(text(node)) && visible(child.defaultView,node); });
          if (close) { event.preventDefault(); event.stopPropagation(); close.click(); }
        } else if (event.key === 'Tab') {
          var nodes = candidates(), active = child.activeElement, index = nodes.indexOf(active);
          if (!nodes.length) { event.preventDefault(); stockFocus(); }
          else if (event.shiftKey && index <= 0) { event.preventDefault(); nodes[nodes.length-1].focus(); }
          else if (!event.shiftKey && (index < 0 || index === nodes.length-1)) { event.preventDefault(); nodes[0].focus(); }
        }
      }
      child.addEventListener('keydown',key); frameCleanup = function () { child.removeEventListener('keydown',key); };
      stockFocus();
    }
    function syncStock() {
      var frame = all(doc,'iframe[name="RadWindow_Stock"]').find(function (node) {
        try { var url = new URL(node.getAttribute('src'),win.location.href); return url.origin === win.location.origin && /^\/Catalog\/ShowStock\.aspx$/i.test(url.pathname); } catch (_) { return false; }
      });
      var wrapper = frame && frame.closest('.RadWindow');
      if (stock && (stock.frame !== frame || !wrapper || !visible(win,wrapper))) {
        var opener = stock.opener, active = doc.activeElement, previousFrame = stock.frame, previousWrapper = stock.wrapper;
        restoreBackground(); if (frameCleanup) frameCleanup(); frameCleanup = null; boundFrame = null; stock = null;
        if (opener?.isConnected && (active === previousFrame || previousWrapper.contains(active) || active === doc.body || !active?.isConnected)) focus(opener);
      }
      if (!frame || !wrapper || !visible(win,wrapper)) return;
      if (!stock) {
        var name = clean(text(doc.querySelector('#wl-product-title,h1')));
        stock = { frame: frame, wrapper: wrapper, opener: doc.querySelector('a[id$="btnShowStock"]'), label: 'Store inventory' + (name ? ' for ' + name : '') };
      }
      set(frame,'title',stock.label); set(wrapper,'role','dialog'); set(wrapper,'aria-modal','true'); set(wrapper,'aria-label',stock.label);
      if (!wrapper.hasAttribute('tabindex')) set(wrapper,'tabindex','-1');
      if (!frameLoads.has(frame)) { var loaded = function () { bindStockDocument(frame); }; frame.addEventListener('load',loaded); frameLoads.set(frame,loaded); }
      if (!stockActive()) { restoreBackground(); return; }
      if (!boundFrame && doc.activeElement !== frame && !wrapper.contains(doc.activeElement)) stockFocus();
      var branch = wrapper;
      while (branch.parentElement && branch !== doc.body) {
        Array.from(branch.parentElement.children).forEach(function (node) {
          if (node === branch || /^(?:SCRIPT|STYLE|LINK)$/.test(node.tagName) || node.contains(wrapper)) return;
          if (!background.has(node)) background.set(node,{ inert: node.getAttribute('inert'), hidden: node.getAttribute('aria-hidden') });
          set(node,'inert',''); set(node,'aria-hidden','true');
        }); branch = branch.parentElement;
      }
      bindStockDocument(frame);
    }
    function refresh() {
      if (stopped || !doc.body) return;
      style(); syncStock();
      if (!stockActive()) { pageStructure(); shoppingNames(); recommendationLinks(); syncErrors(); }
      if (!manager) try { manager = win.Sys?.WebForms?.PageRequestManager?.getInstance(); manager?.add_endRequest(schedule); } catch (_) {}
    }
    function schedule() { if (!stopped && !timer) timer = win.setTimeout(function () { timer = null; refresh(); },80); }
    function start() {
      if (stopped || !doc.body) return;
      refresh();
      observer = new win.MutationObserver(function (records) {
        if (records.some(function (record) {
          if (record.target.closest?.('#MainLayoutRow,.RadWindow')) return true;
          return Array.from(record.addedNodes).concat(Array.from(record.removedNodes)).some(function (node) { return node.nodeType === 1 && (node.matches('#MainLayoutRow,.RadWindow') || node.querySelector('#MainLayoutRow,.RadWindow')); });
        })) schedule();
      });
      observer.observe(doc.body,{ childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','style','hidden','aria-invalid','data-wl-continue-state'] });
      listen(doc,'click',function (event) { var next = event.target.closest?.(CONTINUE); pending = next || null; schedule(); },true);
      listen(doc,'input',function () { pending = null; schedule(); },true);
      listen(doc,'change',schedule,true);
      listen(doc,'focusin',function (event) { if (stockActive() && !stock.wrapper.contains(event.target)) stockFocus(); },true);
      listen(doc,'keydown',function (event) { if (event.key === 'Tab' && stockActive() && doc.activeElement !== stock.frame) { event.preventDefault(); stockFocus(); } },true);
    }
    function destroy() {
      stopped = true; win.clearTimeout(timer); if (observer) observer.disconnect(); listeners.forEach(function (remove) { remove(); });
      if (frameCleanup) frameCleanup(); frameLoads.forEach(function (fn,frame) { frame.removeEventListener('load',fn); });
      try { manager?.remove_endRequest(schedule); } catch (_) {} restoreBackground(); removeDescriptions();
      invalidOwned.forEach(function (before,node) { if (node.getAttribute('aria-invalid') === 'true') { if (before === null) node.removeAttribute('aria-invalid'); else set(node,'aria-invalid',before); } }); invalidOwned.clear();
      delete win.WLAccessibilityRuntime;
    }
    var runtime = { build:BUILD,refresh:refresh,destroy:destroy }; win.WLAccessibilityRuntime = runtime;
    if (doc.readyState === 'loading') listen(doc,'DOMContentLoaded',start,{ once:true }); else start();
    // Keep observers/listeners on bfcache entries; returning Back must still
    // enhance later UpdatePanels. Cancel only pending focus/timer work on leave.
    listen(win,'pagehide',function () { pending = null; win.clearTimeout(timer); timer = null; });
    listen(win,'pageshow',schedule); return runtime;
  }
  return { build:BUILD,boot:boot,zoomContent:zoomContent };
});
