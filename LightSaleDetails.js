/* Public offer details only. The shared sale policy and native cart own pricing. */
(function (root, factory) {
  'use strict';
  var offer = factory();
  if (typeof module === 'object' && module.exports) module.exports = offer;
  else offer.boot(root);
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  var BUILD = '20261113-light-sale-details-1';
  var ORIGIN = 'https://webtrack.woodsonlumber.com';
  var LIGHT_GROUPS = ['4651', '4693', '4694', '4695', '4696', '4697', '4698'];
  var SHOP = '/Products.aspx?pl1=4647&pg=4651&sort=StockClassSort&direction=asc';
  var ID = 'wl-light-sale-details';
  function pageKind(path, search) {
    if (/^\/ProductDetail\.aspx$/i.test(path)) return 'product';
    return /^\/Products\.aspx$/i.test(path) && LIGHT_GROUPS.includes(new URLSearchParams(search).get('pg')) ? 'group' : '';
  }
  function active(policy, now) {
    return policy?.enabled === true && now >= Date.parse(policy.startsAt) &&
      (policy.endsAt === null || now < Date.parse(policy.endsAt)) &&
      Array.isArray(policy.products) && policy.products.length > 0 &&
      Array.isArray(policy.tiers) && policy.tiers.length > 0 &&
      policy.tiers.every(function (t, i, tiers) {
        return Number.isInteger(t.minimumQuantity) && t.minimumQuantity >= 1 &&
          Number.isInteger(t.percentOff) && t.percentOff > 0 && t.percentOff <= 100 &&
          (i === 0 ? t.minimumQuantity === 1 : t.minimumQuantity > tiers[i - 1].minimumQuantity);
      });
  }
  function tierLabels(tiers) {
    return tiers.map(function (tier, i) {
      var next = tiers[i + 1];
      return { quantity: next ? tier.minimumQuantity + '–' + (next.minimumQuantity - 1) + ' boxes' : tier.minimumQuantity + '+ boxes', savings: tier.percentOff + '% off' };
    });
  }
  function make(doc, tag, className, text) {
    var el = doc.createElement(tag); el.className = className;
    if (text) el.textContent = text;
    return el;
  }
  function panel(doc, policy, kind) {
    var box = make(doc, 'section', 'wl-light-sale wl-light-sale--' + kind);
    box.id = ID; box.setAttribute('aria-labelledby', ID + '-title');
    box.setAttribute('data-wl-light-sale-build', BUILD);
    box.appendChild(make(doc, 'p', 'wl-light-sale__eyebrow', 'CHRISTMAS LIGHT SALE'));
    var heading = make(doc, 'h2', '', 'Mix, match & save up to ' + Math.max.apply(null, policy.tiers.map(function (t) { return t.percentOff; })) + '%');
    heading.id = ID + '-title'; box.appendChild(heading);
    box.appendChild(make(doc, 'p', 'wl-light-sale__intro', kind === 'product' ? 'This light set qualifies. Mix and match eligible boxes to save more.' : 'Mix and match eligible boxed light sets, strings and reels.'));
    var tiers = make(doc, 'dl', 'wl-light-sale__tiers');
    tierLabels(policy.tiers).forEach(function (tier) {
      var item = make(doc, 'div', ''); item.append(make(doc, 'dt', '', tier.quantity), make(doc, 'dd', '', tier.savings)); tiers.appendChild(item);
    });
    box.appendChild(tiers);
    box.appendChild(make(doc, 'p', 'wl-light-sale__automatic', 'Applied automatically in your cart. No code needed.'));
    box.appendChild(make(doc, 'p', 'wl-light-sale__terms', 'Your total eligible boxes set the discount on all eligible lights. Retail offer; clips, stakes, projectors and necklaces are excluded.'));
    if (kind === 'product') { var link = make(doc, 'a', '', 'Shop Christmas lights →'); link.href = SHOP; box.appendChild(link); }
    return box;
  }
  function styles(doc) {
    if (doc.getElementById(ID + '-styles')) return;
    var css = doc.createElement('style'); css.id = ID + '-styles';
    css.textContent = `
      #${ID},#${ID} *{box-sizing:border-box}
      #${ID}{min-width:0;padding:22px 24px;margin:0 0 28px;border:1px solid #d6ddcc;border-top:4px solid #6b0016;border-radius:10px;background:#faf7ee;color:#243a2f;font:14px/1.5 Arial,Helvetica,sans-serif;text-align:left}
      #${ID} .wl-light-sale__eyebrow{margin:0 0 6px!important;color:#6b0016;font:700 10px/1.4 Arial!important;letter-spacing:.13em}
      #${ID} h2{margin:0 0 8px!important;color:#243a2f!important;font:700 clamp(21px,2.6vw,29px)/1.18 Arial!important;letter-spacing:-.025em}
      #${ID} p{color:#3c5042;margin:0 0 12px;font:14px/1.5 Arial}
      #${ID} .wl-light-sale__tiers{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;max-width:600px;margin:15px 0;padding:0}
      #${ID} .wl-light-sale__tiers>div{padding:12px 8px;border:1px solid #d9dfd0;border-radius:7px;background:#fff;text-align:center;min-width:0}
      #${ID} dt{margin:0 0 4px;font:400 13px/1.3 Arial;color:#435448}
      #${ID} dd{margin:0;color:#6b0016;font:700 clamp(20px,2.5vw,27px)/1.2 Arial;white-space:nowrap}
      #${ID} .wl-light-sale__automatic{font-weight:700;margin-bottom:6px}
      #${ID} .wl-light-sale__terms{font-size:12px;margin-bottom:0}
      #${ID} a{display:inline-flex;align-items:center;min-height:40px;color:#6b0016!important;text-decoration:underline;text-underline-offset:3px;font-weight:700;margin-top:6px}
      #${ID} a:focus-visible{outline:3px solid #6b0016;outline-offset:3px}
      #${ID}.wl-light-sale--product{padding:14px;margin:12px 0 17px;border-top-width:3px}
      #${ID}.wl-light-sale--product h2{font-size:19px!important}
      #${ID}.wl-light-sale--product p{font-size:12px}
      #${ID}.wl-light-sale--product .wl-light-sale__tiers{gap:5px;margin:11px 0}
      #${ID}.wl-light-sale--product .wl-light-sale__tiers>div{padding:9px 3px}
      #${ID}.wl-light-sale--product dt{font-size:11px}
      #${ID}.wl-light-sale--product dd{font-size:20px}
      #${ID}.wl-light-sale--product .wl-light-sale__terms{font-size:11px}
      #${ID}.wl-light-sale--product a{font-size:12px}
      @media(max-width:600px){#${ID}{padding:18px 16px}#${ID} .wl-light-sale__tiers{gap:7px}#${ID} dt{font-size:12px}#${ID} dd{font-size:22px}}
    `;
    doc.head.appendChild(css);
  }
  async function boot(win) {
    if (!win || win.top !== win || win.location.origin !== ORIGIN || win.WLLightSaleDetails) return;
    var kind = pageKind(win.location.pathname, win.location.search); if (!kind) return;
    var doc = win.document, source = doc.currentScript?.src || 'https://ckunkel510.github.io/WL.github.io/LightSaleDetails.js';
    win.WLLightSaleDetails = { build: BUILD };
    var policy;
    try {
      // Read the exact enabled/date/eligibility/tier policy used by pricing. No account or basket reads.
      var result = await win.fetch(new URL('data/christmas-light-sale-2026.json', source).href, { credentials: 'omit', cache: 'no-cache' });
      if (!result.ok) return;
      policy = await result.json();
      if (!active(policy, Date.now())) return;
    } catch (_) { return; }
    if (doc.readyState === 'loading') await new Promise(function (resolve) { doc.addEventListener('DOMContentLoaded', resolve, { once: true }); });
    var pid = new URLSearchParams(win.location.search).get('pid');
    if (kind === 'product' && !policy.products.some(function (p) { return String(p.productId) === pid; })) return;
    var queued = false;
    function render() {
      queued = false;
      var box = doc.getElementById(ID);
      if (!active(policy, Date.now())) { box?.remove(); return; }
      var anchor = kind === 'product' ? doc.querySelector('#product-sidebar .wl-product-price-row') : doc.getElementById('wl-holiday-hero');
      var fallback = kind === 'group' && (doc.getElementById('ctl00_PageBody_ProductGroupDrillDownUpdatePanel') || doc.getElementById('ctl00_PageBody_ProductGroupStandardPanel'));
      if (!anchor && !fallback) return;
      styles(doc); if (!box) box = panel(doc, policy, kind);
      if (anchor) { if (anchor.nextElementSibling !== box) anchor.after(box); }
      else if (fallback.previousElementSibling !== box) fallback.before(box);
    }
    function schedule() { if (!queued) { queued = true; win.requestAnimationFrame(render); } }
    var observer = new win.MutationObserver(schedule);
    observer.observe(doc.getElementById('MainLayoutRow') || doc.body, { childList: true, subtree: true });
    win.addEventListener('pagehide', function () { observer.disconnect(); }, { once: true });
    win.addEventListener('pageshow', function (event) { if (event.persisted) { observer.observe(doc.getElementById('MainLayoutRow') || doc.body, { childList: true, subtree: true }); schedule(); } });
    if (policy.endsAt) win.setTimeout(schedule, Math.min(Math.max(0, Date.parse(policy.endsAt) - Date.now() + 1), 2147483647));
    render();
  }
  return { boot: boot, pageKind: pageKind, active: active, tierLabels: tierLabels };
});
