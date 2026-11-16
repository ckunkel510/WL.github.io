/* Offer details and read-only product price previews. Native controls own purchases. */
(function (root, factory) {
  'use strict';
  var offer = factory();
  if (typeof module === 'object' && module.exports) module.exports = offer;
  else offer.boot(root);
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  var BUILD = '20261116-light-product-prices-2';
  var ORIGIN = 'https://webtrack.woodsonlumber.com';
  var LIGHT_GROUPS = ['4651', '4693', '4694', '4695', '4696', '4697', '4698'];
  var SHOP = '/Products.aspx?pl1=4647&pg=4651&sort=StockClassSort&direction=asc';
  var ID = 'wl-light-sale-details';
  var API = 'https://wl-upsrates.vercel.app/api/cart-pricing';
  function text(value) { return String(value || '').replace(/\s+/g,' ').trim(); }
  function cents(value) { var m=text(value).replace(/,/g,'').match(/(?:\$\s*)?(-?\d+\.\d{2})/); return m ? Math.round(Number(m[1])*100) : null; }
  function money(value) { return '$'+(value/100).toFixed(2); }
  // Keep the native row contract aligned with CartPricing.readCart; no saved basket is used.
  function readCart(doc) {
    var rows=Array.from(doc.querySelectorAll('.shopping-cart-item'));
    if (!rows.length) {
      if (/your cart is (?:currently )?empty/i.test(doc.getElementById('MainLayoutRow')?.textContent || doc.body?.textContent || '')) return [];
      throw Error('The current cart could not be confirmed.');
    }
    return rows.map(function (row) {
      var link=Array.from(row.querySelectorAll('a[href*="ProductDetail.aspx"]')).find(function (a) {return /[?&]pid=\d+/i.test(a.getAttribute('href') || '');});
      var id=(link?.getAttribute('href') || '').match(/[?&]pid=(\d+)/i)?.[1];
      var q=row.querySelector('select.wl-qty-select')?.value || row.querySelector('input[id*="_qty_"]:not([id$="_ClientState"])')?.value || row.querySelector('.wl-qty-locked')?.textContent;
      var total=row.querySelector('.cart-item-card .action-block > div:first-child .fw-bold, .col-12.col-sm-3 .d-flex > div:first-child');
      var raw=total?.textContent || text(row.textContent).match(/Total:\s*(\$[\d,.]+)/i)?.[1];
      var code=text(row.querySelector('.portalGridLink,.cart-item-card h6 a')?.textContent).replace(/^SKU\s*/i,'');
      var line={productId:id,productCode:code,quantity:Number(q),netLineTotalCents:cents(raw)};
      if (!id || !Number.isSafeInteger(line.quantity) || line.quantity<1 || !Number.isSafeInteger(line.netLineTotalCents) || line.netLineTotalCents<0) throw Error('The current cart prices could not be confirmed.');
      return line;
    });
  }
  function selection(doc,pid) {
    var row=doc.querySelector('#product-sidebar .wl-product-price-row');
    var input=doc.querySelector('input[id$="_qty_'+pid+'"]:not([id$="_ClientState"])');
    if (!row || !input) return null;
    return {row:row,input:input,quantity:Number(input.value),unitPriceCents:cents(row.textContent),unit:text(row.querySelector('.wl-product-unit')?.textContent).replace(/^\/\s*/,'') || 'ea'};
  }
  function latestOnly() {
    var current=0,key='';
    return {begin:function (next,force) {if (!force && next===key) return null;key=next;return ++current;},current:function (revision) {return revision===current;},invalidate:function () {current++;key='';}};
  }
  function productPricing(win,policy,pid) {
    var doc=win.document,revision=latestOnly(),timer,controller,timeout,abandoned=false,lastRow,lastInput;
    function clear() {doc.querySelectorAll('.wl-light-sale-native-price').forEach(function (el) {el.classList.remove('wl-light-sale-native-price');});doc.getElementById('wl-light-product-price')?.remove();}
    function show(source,state,preview) {
      clear();
      if (!source.row.isConnected) return;
      var box=make(doc,'section','wl-light-product-price');box.id='wl-light-product-price';box.setAttribute('aria-label','Christmas light sale price');box.setAttribute('aria-live','polite');box.dataset.state=state;box.dataset.build=BUILD;
      if (state==='ready') {
        source.row.classList.add('wl-light-sale-native-price');
        var regular=make(doc,'div','wl-light-price-regular','Regular price ');regular.appendChild(make(doc,'del','',money(preview.regularUnitPriceCents)+' / '+source.unit));box.appendChild(regular);
        var unit=make(doc,'div','wl-light-price-main');unit.append(make(doc,'strong','',money(preview.unitPriceCents)),make(doc,'span','',preview.unitPriceIsAverage?' / '+source.unit+' avg.':' / '+source.unit));box.appendChild(unit);
        box.appendChild(make(doc,'p','wl-light-price-discount',preview.percentOff+'% off · '+preview.eligibleQuantity+' eligible '+(preview.eligibleQuantity===1?'box':'boxes')+' after adding'));
        box.appendChild(make(doc,'p','wl-light-price-total',preview.inCartQuantity ? 'This item after adding: '+preview.itemQuantity+' boxes · '+money(preview.itemTotalCents) : 'Selected quantity: '+preview.selectedQuantity+' '+(preview.selectedQuantity===1?'box':'boxes')+' · '+money(preview.itemTotalCents)));
        box.appendChild(make(doc,'p','wl-light-price-note',preview.inCartQuantity ? preview.inCartQuantity+' of this item already in your cart + '+preview.selectedQuantity+' selected. All eligible light styles combine.' : (preview.eligibleQuantity-preview.selectedQuantity)+' eligible boxes already in your cart + '+preview.selectedQuantity+' selected.'));
        if (preview.unitPriceIsAverage) box.appendChild(make(doc,'p','wl-light-price-note','Average unit price is rounded; the item total includes the exact savings.'));
        box.appendChild(make(doc,'small','','Before tax and shipping. Updates when quantity or cart changes.'));
      } else {
        box.appendChild(make(doc,'p','',state==='loading'?'Checking your cart for the sale price…':state==='quantity'?'Enter a whole number of boxes to see your sale price.':'We couldn’t confirm your cart. Retry to see your sale price.'));
        if (state==='error') {var retry=make(doc,'button','','Retry sale price');retry.type='button';retry.addEventListener('click',function () {schedule(true);});box.appendChild(retry);}
      }
      source.row.before(box);
    }
    function schedule(force) {
      if (abandoned) return;
      var source=selection(doc,pid);if (!source) return;
      if (source.row!==lastRow || source.input!==lastInput) {force=true;lastRow=source.row;lastInput=source.input;}
      var employee=!!doc.getElementById('ctl00_EmployeeStatusBar_LogonBarPanel');
      var key=JSON.stringify([source.quantity,source.unitPriceCents,employee]);
      var current=revision.begin(key,force===true);if (current===null) return;
      win.clearTimeout(timer);win.clearTimeout(timeout);controller?.abort();
      if (employee || !active(policy,Date.now())) {clear();return;}
      if (!Number.isSafeInteger(source.quantity) || source.quantity<1 || source.quantity>10000 || !Number.isSafeInteger(source.unitPriceCents) || source.unitPriceCents<1) {show(source,'quantity');return;}
      show(source,'loading');
      timer=win.setTimeout(async function () {
        controller=new win.AbortController();var signal=controller.signal;
        timeout=win.setTimeout(function () {controller?.abort();},25000);
        try {
          var cartResponse=await win.fetch('/ShoppingCart.aspx',{credentials:'same-origin',cache:'no-store',signal:signal});
          if (!cartResponse.ok || new URL(cartResponse.url || '/ShoppingCart.aspx',ORIGIN).pathname.toLowerCase()!=='/shoppingcart.aspx') throw Error('Cart unavailable.');
          var page=new win.DOMParser().parseFromString(await cartResponse.text(),'text/html');
          if (page.getElementById('ctl00_EmployeeStatusBar_LogonBarPanel')) {if (revision.current(current)) clear();return;}
          var cart=readCart(page).filter(function (line) {return policy.products.some(function (p) {return String(p.productId)===line.productId;});});
          var response=await win.fetch(API,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},signal:signal,body:JSON.stringify({action:'product-preview',cart:cart,selectedProduct:{productId:pid,quantity:source.quantity,unitPriceCents:source.unitPriceCents}})});
          var data=await response.json();
          if (!response.ok || !data.ok || !data.productPreview) throw Error('Price unavailable.');
          if (!abandoned && revision.current(current)) {if (data.productPreview.percentOff>0) show(source,'ready',data.productPreview);else clear();}
        } catch (_) {if (!abandoned && revision.current(current)) show(source,'error');}
        finally {if (revision.current(current)) win.clearTimeout(timeout);}
      },250);
    }
    doc.addEventListener('input',function (event) {if (event.target.matches?.('input[id$="_qty_'+pid+'"]')) schedule();},true);
    doc.addEventListener('change',function (event) {if (event.target.matches?.('input[id$="_qty_'+pid+'"]')) schedule();},true);
    // The existing +/- widget writes input.value without emitting input/change.
    // Observe its completed click without changing that native quantity action.
    doc.addEventListener('click',function (event) {if (event.target.closest?.('button')?.parentElement?.querySelector('input[id$="_qty_'+pid+'"]')) schedule();});
    win.addEventListener('focus',function () {schedule(true);});
    doc.addEventListener('visibilitychange',function () {if (doc.visibilityState==='visible') schedule(true);});
    win.addEventListener('pageshow',function () {abandoned=false;schedule(true);});
    win.addEventListener('pagehide',function () {abandoned=true;revision.invalidate();win.clearTimeout(timer);win.clearTimeout(timeout);controller?.abort();});
    try {win.Sys?.WebForms?.PageRequestManager?.getInstance()?.add_endRequest(function () {schedule(true);});} catch (_) {}
    return {schedule:schedule};
  }
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
      .wl-light-sale-native-price{display:none!important}
      #wl-light-product-price{margin:0 0 12px;min-width:0;color:#243a2f;font:14px/1.45 Arial,Helvetica,sans-serif}
      #wl-light-product-price .wl-light-price-regular{color:#647166;font-size:13px;margin-bottom:4px}
      #wl-light-product-price .wl-light-price-main{display:flex;align-items:baseline;gap:7px;flex-wrap:wrap}
      #wl-light-product-price .wl-light-price-main strong{font:700 32px/1.2 Arial;color:#6b0016;letter-spacing:-.03em}
      #wl-light-product-price p{margin:6px 0;font:13px/1.45 Arial;color:#364c3d}
      #wl-light-product-price .wl-light-price-discount{color:#6b0016;font-weight:700}
      #wl-light-product-price .wl-light-price-total{font-weight:700;font-size:15px}
      #wl-light-product-price .wl-light-price-note,#wl-light-product-price small{display:block;font-size:12px;color:#536357}
      #wl-light-product-price button{min-height:40px;padding:8px 12px;margin:4px 0;border:1px solid #6b0016;border-radius:5px;background:#fff;color:#6b0016;font:700 13px Arial;cursor:pointer}
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
      // The offer and its price preview share the checkout policy.
      var result = await win.fetch(new URL('data/christmas-light-sale-2026.json', source).href, { credentials: 'omit', cache: 'no-cache' });
      if (!result.ok) return;
      policy = await result.json();
      if (!active(policy, Date.now())) return;
    } catch (_) { return; }
    if (doc.readyState === 'loading') await new Promise(function (resolve) { doc.addEventListener('DOMContentLoaded', resolve, { once: true }); });
    var pid = new URLSearchParams(win.location.search).get('pid');
    if (kind === 'product' && !policy.products.some(function (p) { return String(p.productId) === pid; })) return;
    var preview=kind==='product' ? productPricing(win,policy,pid) : null;
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
      preview?.schedule();
    }
    function schedule() { if (!queued) { queued = true; win.requestAnimationFrame(render); } }
    var observer = new win.MutationObserver(schedule);
    observer.observe(doc.getElementById('MainLayoutRow') || doc.body, { childList: true, subtree: true });
    win.addEventListener('pagehide', function () { observer.disconnect(); }, { once: true });
    win.addEventListener('pageshow', function (event) { if (event.persisted) { observer.observe(doc.getElementById('MainLayoutRow') || doc.body, { childList: true, subtree: true }); schedule(); } });
    if (policy.endsAt) win.setTimeout(schedule, Math.min(Math.max(0, Date.parse(policy.endsAt) - Date.now() + 1), 2147483647));
    render();
  }
  return { boot: boot, pageKind: pageKind, active: active, tierLabels: tierLabels, readCart: readCart, selection: selection, latestOnly: latestOnly };
});
