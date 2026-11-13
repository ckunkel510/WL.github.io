/* Woodson's seasonal layer. Native product links and commerce controls stay authoritative. */
(function (root, factory) {
  var holiday = factory();
  if (typeof module === 'object' && module.exports) module.exports = holiday;
  else holiday.boot(root);
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var BUILD = '20261113-merry100-1';
  var OFFER_END = Date.parse('2026-12-06T00:00:00-06:00');
  function offerActive() { return Date.now() >= START && Date.now() < OFFER_END; }
  var DAY = 86400000;
  var START = Date.parse('2026-11-13T00:00:00-06:00');
  var END = Date.parse('2026-12-26T00:00:00-06:00');
  var VISIT_KEY = 'wl_christmas_2026_seen';
  var SESSION_KEY = 'wl_christmas_2026_entry_v3';
  var SHOP = '/Products.aspx?pl1=4647&pg=4649&sort=StockClassSort&direction=asc';
  var GROUPS = {
    '4651': ['Christmas Lights', 'Bring on the twinkle.', 'Light it up', '01 / SPARKLE'],
    '4656': ['Christmas Trees', 'Meet your merry centerpiece.', 'Find your tree', '02 / GATHER'],
    '4658': ['Garlands & Wreaths', 'A warm welcome starts here.', 'Deck the door', '03 / WELCOME'],
    '4660': ['Outdoor Decorations', 'Make the whole block smile.', 'Spread some cheer', '04 / DELIGHT'],
    '4662': ['Ornaments & Stockings', 'The little things make it magic.', 'Add the finishing touches', '05 / MAKE IT YOURS'],
    '4664': ['Christmas Storage', 'Keep the magic for next year.', 'Wrap it up', '06 / KEEP'],
    '4681': ['Extension Cords', 'A little help behind the holiday glow.', 'Shop extension cords', 'THE HOLIDAY HELPERS'],
    '4693': ['Icicle Lights', 'Give your roofline a frosty glow.', 'Shop icicle lights', 'FROST & GLOW'],
    '4694': ['Mini/T5/C3 Lights', 'Little lights. Big holiday spirit.', 'Find your sparkle', 'SMALL & SPARKLY'],
    '4695': ['Specialty Lights', 'A little unexpected holiday magic.', 'Make it your own', 'SOMETHING SPECIAL'],
    '4696': ['C9 Lights', 'Big bulbs. Classic Christmas cheer.', 'Go big on glow', 'BOLD & BRIGHT'],
    '4697': ['C6 Lights', 'A classic shape with a festive glow.', 'Shop C6 lights', 'A CHRISTMAS CLASSIC'],
    '4698': ['Net Lights', 'Wrap your greenery in twinkle.', 'Light up the landscape', 'WRAP IT IN LIGHT'],
    '4700': ['Light Clips', 'Keep every strand in its happy place.', 'Finish the setup', 'THE LITTLE HELPERS'],
    '4654': ['Inflatable Decorations', 'A big dose of front-yard cheer.', 'Make spirits bright', 'BIG HOLIDAY ENERGY'],
    '4702': ['Yard Decorations', 'Bring a little magic outside.', 'Dress up the yard', 'CURBSIDE CHRISTMAS']
  };

  function inSeason(now) { return now >= START && now < END; }
  function shoppingPage(path) { return /^\/(?:Products|ProductDetail)\.aspx$/i.test(path || ''); }
  function christmasPage(path, search) {
    return /^\/Products\.aspx$/i.test(path || '') && new URLSearchParams(search || '').get('pg') === '4649';
  }
  function christmasContext(path, search) {
    var pg = new URLSearchParams(search || '').get('pg');
    return shoppingPage(path) && (pg === '4649' || Object.prototype.hasOwnProperty.call(GROUPS, pg));
  }
  function recent(value, now) {
    var time = Number(value);
    return Number.isFinite(time) && time > 0 && now - time < DAY;
  }
  function readVisit(win) {
    var latest = 0;
    try { latest = Number(win.localStorage.getItem(VISIT_KEY)) || 0; } catch (_) {}
    try {
      var cookie = win.document.cookie.split(';').map(function (s) { return s.trim(); })
        .find(function (s) { return s.indexOf(VISIT_KEY + '=') === 0; });
      var value = cookie ? Number(cookie.slice(VISIT_KEY.length + 1)) : 0;
      if (Number.isFinite(value)) latest = Math.max(latest, value);
    } catch (_) {}
    return latest;
  }
  function rememberVisit(win, now) {
    var stored = false;
    try {
      win.localStorage.setItem(VISIT_KEY, String(now));
      stored = win.localStorage.getItem(VISIT_KEY) === String(now);
    } catch (_) {}
    if (!stored) {
      try {
        win.document.cookie = VISIT_KEY + '=' + now + '; Max-Age=86400; Path=/; SameSite=Lax; Secure';
        stored = readVisit(win) === now;
      } catch (_) {}
    }
    return stored;
  }
  function entryAvailable(win) {
    try { return !win.sessionStorage.getItem(SESSION_KEY); } catch (_) { return true; }
  }
  function firstEntry(win) {
    if (!entryAvailable(win)) return false;
    try {
      win.sessionStorage.setItem(SESSION_KEY, '1');
    } catch (_) { /* The persistent 24-hour cap remains authoritative. */ }
    return true;
  }
  function element(doc, tag, className, text) {
    var el = doc.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }
  function winterScene() {
    return '<svg class="wl-holiday-scene" viewBox="0 0 520 320" aria-hidden="true" focusable="false">' +
      '<defs><linearGradient id="wl-holiday-sky" x2="0" y2="1"><stop stop-color="#183e36"/><stop offset="1" stop-color="#295549"/></linearGradient></defs>' +
      '<rect width="520" height="320" fill="url(#wl-holiday-sky)"/>' +
      '<g fill="#fff9e9" opacity=".65"><circle cx="44" cy="42" r="2"/><circle cx="89" cy="105" r="2"/><circle cx="144" cy="25" r="2"/><circle cx="193" cy="74" r="3"/><circle cx="279" cy="28" r="2"/><circle cx="328" cy="105" r="2"/><circle cx="400" cy="39" r="3"/><circle cx="458" cy="100" r="2"/><circle cx="29" cy="188" r="2"/><circle cx="494" cy="189" r="2"/></g>' +
      '<path d="M0 282Q130 229 260 278T520 267V320H0" fill="#d9e7df"/>' +
      '<g fill="#356c57" stroke="#afc7b5" stroke-width="2"><path d="m100 102-50 79h23l-41 62h136l-41-62h23z"/><path d="m418 75-45 87h22l-49 89h143l-48-89h22z"/></g>' +
      '<path d="M252 42 168 158h38l-65 81h221l-65-81h39z" fill="#608769"/>' +
      '<path d="m252 42-84 116h38m-65 81h221" fill="none" stroke="#e7eee1" stroke-width="7" stroke-linejoin="round"/>' +
      '<path d="m252 24 5 11 12 1-9 8 3 12-11-6-11 6 2-12-9-8 13-1z" fill="#edcf87"/>' +
      '<path d="M220 110q30 26 62 4m-90 46q59 38 119 6m-148 48q89 36 173 3" fill="none" stroke="#e5c27a" stroke-width="3"/>' +
      '<g fill="#ffe3a1"><circle cx="228" cy="117" r="4"/><circle cx="270" cy="120" r="4"/><circle cx="207" cy="168" r="4"/><circle cx="252" cy="180" r="4"/><circle cx="294" cy="174" r="4"/><circle cx="185" cy="222" r="4"/><circle cx="238" cy="235" r="4"/><circle cx="294" cy="231" r="4"/></g>' +
      '<path d="M246 239h14v47h-14z" fill="#704d3e"/>' +
      '<path d="M0 306q115-36 244-13t276-3v30H0" fill="#f7f4eb"/>' +
      '<g><rect x="286" y="257" width="43" height="41" rx="3" fill="#7b1830"/><path d="M307 257v41m-21-26h43" stroke="#edcf87" stroke-width="5"/><path d="M307 257c-32-22-23-34-9-18l9 18c35-24 31-35 17-21z" fill="none" stroke="#edcf87" stroke-width="3"/>' +
      '<rect x="337" y="277" width="34" height="24" rx="2" fill="#ba9471"/><path d="M353 277v24" stroke="#fff3d4" stroke-width="4"/></g></svg>';
  }

  function installStyles(doc, source) {
    if (doc.getElementById('wl-holiday-styles')) return;
    var css = doc.createElement('link');
    css.id = 'wl-holiday-styles';
    css.rel = 'stylesheet';
    css.href = new URL('HolidayShop.css?v=' + BUILD, source).href;
    doc.head.appendChild(css);
  }
  function ribbon(doc) {
    var header = doc.getElementById('siteHeaderContent');
    if (!header || doc.getElementById('wl-holiday-ribbon')) return;
    var bar = element(doc, 'aside', 'wl-holiday-ribbon');
    bar.id = 'wl-holiday-ribbon';
    bar.setAttribute('aria-label', 'Christmas at Woodson');
    bar.innerHTML = '<span class="wl-holiday-lights" aria-hidden="true"></span>';
    var copy = element(doc,'span','wl-holiday-ribbon-copy',offerActive() ? 'Free Ground on your entire order · $100+ in Christmas items · MERRY100 · Ends Dec 5' : '✧ A little merry. A lot of Woodson.');
    bar.appendChild(copy);
    var link = element(doc, 'a', '', 'Shop Christmas →');
    link.href = SHOP;
    bar.appendChild(link);
    header.insertAdjacentElement('afterend', bar);
  }
  function enhanceGroups(doc) {
    var panel = doc.getElementById('ctl00_PageBody_ProductGroupDrillDownUpdatePanel');
    if (!panel) return;
    panel.classList.add('wl-holiday-groups');
    var grid = panel.querySelector('fieldset.Cards');
    if (grid) {grid.classList.add('wl-holiday-grid');grid.setAttribute('data-wl-holiday-count',String(grid.querySelectorAll('fieldset[id="productGroupCard"]').length));}
    panel.querySelectorAll('fieldset[id="productGroupCard"]').forEach(function (card) {
      if (card.hasAttribute('data-wl-holiday-card')) return;
      var nativeLink = card.querySelector('a[href*="Products.aspx"]');
      if (!nativeLink) return;
      var url = new URL(nativeLink.getAttribute('href'), 'https://webtrack.woodsonlumber.com');
      var pg = url.searchParams.get('pg');
      var details = GROUPS[pg];
      if (!details || url.origin !== 'https://webtrack.woodsonlumber.com') return;
      var img = card.querySelector('img.productGroupImage');
      if (!img) return;
      var link = element(doc, 'a', 'wl-holiday-category');
      link.href = nativeLink.getAttribute('href');
      var art = element(doc, 'span', 'wl-holiday-category-art');
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      art.appendChild(img);
      var copy = element(doc, 'span', 'wl-holiday-category-copy');
      copy.appendChild(element(doc, 'span', 'wl-holiday-kicker', details[3]));
      copy.appendChild(element(doc, 'h3', '', details[0]));
      copy.appendChild(element(doc, 'span', 'wl-holiday-category-caption', details[1]));
      copy.appendChild(element(doc, 'span', 'wl-holiday-category-cta', details[2] + ' →'));
      link.append(art, copy);
      card.replaceChildren(link);
      card.setAttribute('data-wl-holiday-card', pg);
      if (pg === '4681' || pg === '4700') card.classList.add('wl-holiday-helpers');
    });
  }
  function offerDetails(doc, compact) {
    var offer = element(doc,'div','wl-holiday-offer');
    if (!compact) offer.id='wl-holiday-offer';
    if(!compact){
      offer.appendChild(element(doc,'strong','','Free Ground. More merry.'));
      offer.appendChild(element(doc,'p','','Spend $100+ on Christmas Shop merchandise and get free standard Ground shipping on your entire eligible order.'));
    }
    offer.appendChild(element(doc,'span','wl-holiday-code','MERRY100'));
    offer.appendChild(element(doc,'span','wl-holiday-offer-date','Through December 5'));
    var details=element(doc,'details','wl-holiday-offer-terms');
    details.appendChild(element(doc,'summary','','Offer details'));
    details.appendChild(element(doc,'p','','Enter MERRY100 in the Shipping promo code box in your cart. $100 minimum in qualifying Christmas merchandise after item discounts, before tax and shipping. Standard UPS Ground parcel orders only. Upgraded shipping, local delivery and custom processing are extra. Ends December 5, 2026 at 11:59 PM Central.'));
    offer.appendChild(details);
    return offer;
  }

  function christmasLanding(doc, groupId) {
    groupId=groupId || '4649';
    var subgroup=groupId!=='4649';
    var panel = doc.getElementById('ctl00_PageBody_ProductGroupDrillDownUpdatePanel');
    var hasGroups=!!panel?.querySelector('fieldset[id="productGroupCard"]');
    var anchor = hasGroups ? panel : doc.getElementById('ctl00_PageBody_ProductGroupStandardPanel');
    if (!anchor) return;
    var main = doc.getElementById('MainLayoutRow');
    if (main) {
      main.classList.add('wl-holiday-landing');
      var sidebar = main.querySelector('.navigation-menu');
      if (sidebar && !sidebar.textContent.trim() && !sidebar.querySelector('a,button,input')) sidebar.classList.add('wl-holiday-empty-nav');
    }
    if (!doc.getElementById('wl-holiday-hero')) {
      var hero = element(doc, 'section', 'wl-holiday-hero');
      if(subgroup) hero.classList.add('wl-holiday-hero--subgroup');
      hero.id = 'wl-holiday-hero';
      hero.setAttribute('aria-labelledby', 'wl-holiday-hero-title');
      var copy = element(doc, 'div', 'wl-holiday-hero-copy');
      copy.appendChild(element(doc, 'p', 'wl-holiday-eyebrow', 'CHRISTMAS AT WOODSON'));
      if(subgroup){var back=element(doc,'a','wl-holiday-back','← Back to the Christmas Shop');back.href=SHOP;copy.appendChild(back);}
      var heading = element(doc, 'h2', '', subgroup ? GROUPS[groupId][0] : 'Make room for merry.');
      heading.id = 'wl-holiday-hero-title';
      copy.appendChild(heading);
      copy.appendChild(element(doc, 'p', 'wl-holiday-hero-description', subgroup ? GROUPS[groupId][1] : 'A little sparkle. A lot of holiday spirit. Find the finishing touches for your home, inside and out.'));
      if(offerActive()) {
        if(subgroup){var promoLink=element(doc,'a','wl-holiday-sub-offer','$100+ in Christmas items? MERRY100 unlocks free Ground on your entire eligible order. Through Dec 5.');promoLink.href=SHOP+'#wl-holiday-offer';copy.appendChild(promoLink);}
        else copy.appendChild(offerDetails(doc,false));
      }
      var button = element(doc, 'a', 'wl-holiday-button wl-holiday-button--cream', hasGroups ? 'Find your holiday spirit ↓' : 'Shop the collection ↓');
      button.href = hasGroups ? '#wl-holiday-categories' : '#ctl00_PageBody_ProductGroupStandardPanel';
      copy.appendChild(button);
      var art = element(doc, 'div', 'wl-holiday-hero-art');
      art.innerHTML = winterScene();
      hero.append(copy, art);
      anchor.insertAdjacentElement('beforebegin', hero);
      var title = element(doc, 'div', 'wl-holiday-section-title');
      title.id = 'wl-holiday-categories';
      title.tabIndex = -1;
      title.appendChild(element(doc, 'p', 'wl-holiday-eyebrow', 'LET THE MERRY-MAKING BEGIN'));
      title.appendChild(element(doc, 'h2', '', subgroup ? 'Find your kind of holiday magic.' : 'All the ways to make it Christmas.'));
      if(hasGroups) panel.insertAdjacentElement('beforebegin', title);
      var pageHeading = doc.getElementById('wl-a11y-page-heading');
      if (pageHeading) pageHeading.textContent = subgroup ? GROUPS[groupId][0] : 'Christmas Shop';
    }
    if(hasGroups) enhanceGroups(doc);
  }

  function hasVisibleModal(doc) {
    return Array.from(doc.querySelectorAll('dialog[open], [aria-modal="true"]')).some(function (modal) {
      if (modal.hidden || modal.getAttribute('aria-hidden') === 'true' || !modal.getClientRects().length) return false;
      var style = doc.defaultView.getComputedStyle(modal);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse';
    });
  }

  function showPopup(win, preview) {
    var doc = win.document;
    if (doc.getElementById('wl-holiday-popup')) return;
    // Let shoppers keep typing/searching and let existing dialogs finish first.
    if (hasVisibleModal(doc) ||
        /^(INPUT|TEXTAREA|SELECT)$/.test(doc.activeElement && doc.activeElement.tagName || '') ||
        doc.visibilityState === 'hidden') {
      if (!preview) firstEntry(win);
      return;
    }
    if (!preview && (recent(readVisit(win), Date.now()) || !rememberVisit(win, Date.now()))) {
      firstEntry(win);
      return;
    }
    var previousFocus = doc.activeElement;
    var modal = element(doc, 'dialog', 'wl-holiday-popup');
    if(offerActive())modal.classList.add('wl-holiday-popup--offer');
    modal.id = 'wl-holiday-popup';
    modal.setAttribute('aria-labelledby', 'wl-holiday-popup-title');
    modal.setAttribute('aria-describedby', 'wl-holiday-popup-description');
    var close = element(doc, 'button', 'wl-holiday-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close Christmas Shop invitation');
    var art = element(doc, 'div', 'wl-holiday-popup-art');
    art.innerHTML = winterScene();
    var copy = element(doc, 'div', 'wl-holiday-popup-copy');
    copy.appendChild(element(doc, 'p', 'wl-holiday-eyebrow', 'CHRISTMAS AT WOODSON'));
    var title = element(doc, 'h2', '', offerActive() ? 'Make it merry. Ship it free.' : 'Your holiday happy place.');
    title.id = 'wl-holiday-popup-title';
    copy.appendChild(title);
    var description = element(doc, 'p', '', offerActive() ? 'Spend $100+ on Christmas Shop items. Free standard Ground shipping covers your entire eligible order.' : 'Twinkly lights, festive trees & all the merry little details. Let’s make the season feel like home.');
    description.id = 'wl-holiday-popup-description';
    copy.appendChild(description);
    if(offerActive()) copy.appendChild(offerDetails(doc,true));
    var shop = element(doc, 'a', 'wl-holiday-button', 'Explore the Christmas Shop →');
    shop.href = SHOP;
    copy.appendChild(shop);
    var dismiss = element(doc, 'button', 'wl-holiday-dismiss', 'Keep shopping');
    dismiss.type = 'button';
    copy.appendChild(dismiss);
    modal.append(close, art, copy);
    doc.body.appendChild(modal);
    // Native dialog supplies focus containment, background inertness and Escape support.
    if (typeof modal.showModal !== 'function') { modal.remove(); return; }
    function cleanup() {
      doc.documentElement.classList.remove('wl-holiday-modal-open');
      win.removeEventListener('storage', otherTab);
      modal.remove();
      if (previousFocus && previousFocus.isConnected && previousFocus !== doc.body) previousFocus.focus({ preventScroll: true });
    }
    modal.addEventListener('close', cleanup, { once: true });
    close.addEventListener('click', function () { modal.close(); });
    dismiss.addEventListener('click', function () { modal.close(); });
    modal.addEventListener('click', function (event) {
      if (event.target !== modal) return;
      var box = modal.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) modal.close();
    });
    function otherTab(event) {
      if (event.key === VISIT_KEY && recent(event.newValue, Date.now())) {
        if (modal.open) modal.close();
        win.removeEventListener('storage', otherTab);
      }
    }
    win.addEventListener('storage', otherTab);
    modal.showModal();
    if (!preview) firstEntry(win);
    doc.documentElement.classList.add('wl-holiday-modal-open');
    close.focus({ preventScroll: true });
  }

  function boot(win) {
    if (!win || win.top !== win) return null;
    var doc = win.document;
    var params = new URLSearchParams(win.location.search);
    var local = /^(localhost|127\.0\.0\.1)$/.test(win.location.hostname);
    // A local, explicitly marked fixture can demonstrate the exact runtime offline.
    var preview = (local || win.location.protocol === 'file:') && doc.documentElement.hasAttribute('data-wl-holiday-preview');
    var forcePopup = preview && params.get('wlHolidayPreview') !== 'once';
    if (win.location.origin !== 'https://webtrack.woodsonlumber.com' && !preview) return null;
    if (!preview && (!shoppingPage(win.location.pathname) || !inSeason(Date.now()))) return null;
    if (win.WLHolidayShop) return win.WLHolidayShop;
    win.WLHolidayShop = { build: BUILD };
    var source = doc.currentScript && doc.currentScript.src || 'https://ckunkel510.github.io/WL.github.io/HolidayShop.js';
    function start() {
      installStyles(doc, source);
      ribbon(doc);
      var christmas = christmasPage(preview ? '/Products.aspx' : win.location.pathname, win.location.search);
      var alreadyShoppingChristmas = christmasContext(preview ? '/Products.aspx' : win.location.pathname, win.location.search);
      if (alreadyShoppingChristmas && /^\/Products\.aspx$/i.test(preview ? '/Products.aspx' : win.location.pathname)) {
        var groupId=params.get('pg');
        christmasLanding(doc,groupId);
        // WebTrack can replace the drill-down panel through its ASP.NET UpdatePanel.
        if (win.Sys && win.Sys.WebForms && win.Sys.WebForms.PageRequestManager) {
          win.Sys.WebForms.PageRequestManager.getInstance().add_endRequest(function () { christmasLanding(doc,groupId); });
        }
      }
      // WebTrack rewrites listing URLs to add page-size parameters. Do not consume
      // the session entry before the delayed invitation actually opens: that
      // navigation can replace this document during the delay.
      var entry = forcePopup ? true : entryAvailable(win);
      if (!forcePopup && (alreadyShoppingChristmas || recent(readVisit(win), Date.now()))) firstEntry(win);
      if (!alreadyShoppingChristmas && entry && (forcePopup || !recent(readVisit(win), Date.now()))) {
        var css = doc.getElementById('wl-holiday-styles');
        function schedule() { win.setTimeout(function () { showPopup(win, forcePopup); }, 1400); }
        if (css.sheet) schedule();
        else css.addEventListener('load', schedule, { once: true });
      }
      if(offerActive())win.setTimeout(function(){
        doc.querySelectorAll('.wl-holiday-offer,.wl-holiday-sub-offer').forEach(function(el){el.remove();});
        var ribbonCopy=doc.querySelector('.wl-holiday-ribbon-copy');if(ribbonCopy)ribbonCopy.textContent='✧ A little merry. A lot of Woodson.';
        var title=doc.getElementById('wl-holiday-popup-title');if(title)title.textContent='Your holiday happy place.';
        var description=doc.getElementById('wl-holiday-popup-description');if(description)description.textContent='Twinkly lights, festive trees & all the merry little details. Let’s make the season feel like home.';
      },Math.min(OFFER_END-Date.now()+1000,2147483647));
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
    return win.WLHolidayShop;
  }
  return { boot: boot, inSeason: inSeason, shoppingPage: shoppingPage, christmasPage: christmasPage, christmasContext: christmasContext,
    recent: recent, readVisit: readVisit, rememberVisit: rememberVisit, firstEntry: firstEntry, entryAvailable: entryAvailable, hasVisibleModal: hasVisibleModal,
    DAY: DAY, VISIT_KEY: VISIT_KEY, SESSION_KEY: SESSION_KEY };
});
