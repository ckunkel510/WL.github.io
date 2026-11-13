/* Customer presentation and native price receipt bridge. Prices come from our server. */
(function(root,factory){'use strict';var core=factory();if(typeof module==='object'&&module.exports)module.exports=core;else core.boot(root);})(typeof window==='object'?window:null,function(){
  'use strict';
  var BUILD='20261113-automatic-pricing-1', API='https://wl-upsrates.vercel.app/api/cart-pricing';
  var KEY='wl_merchandise_pricing_v1', CART='wl_merchandise_cart_v1', ADDRESS='wl_pricing_original_address_v1';
  var LIGHT_IDS=["255014","255026","255051","255085","255099","255117","255120","255139","255149","255155","255156","255159","268610","268611","268612","268613","268618","268622","268623","276803","276804","276805","276806","276807","276808","276809","276810","276811","276813","276814","276815","276816","276817","276818","276819","276820","276821","276822","276823","276824","276825","276870","276871","254983","254985","268621"];
  function text(value){return String(value || '').replace(/\s+/g,' ').trim();}
  function cents(value){var m=text(value).replace(/,/g,'').match(/(?:\$\s*)?(-?\d+\.\d{2})/);return m?Math.round(Number(m[1])*100):null;}
  function money(value){return (value<0?'−':'')+'$'+(Math.abs(value)/100).toFixed(2);}
  function readCart(doc){
    return Array.from(doc.querySelectorAll('.shopping-cart-item')).map(function(row){
      var link=Array.from(row.querySelectorAll('a[href*="ProductDetail.aspx"]')).find(function(a){return /[?&]pid=\d+/i.test(a.getAttribute('href') || '');});
      var id=(link?.getAttribute('href') || '').match(/[?&]pid=(\d+)/i)?.[1];
      if(!id)return null;
      var q=row.querySelector('select.wl-qty-select')?.value || row.querySelector('input[id*="_qty_"]:not([id$="_ClientState"])')?.value || row.querySelector('.wl-qty-locked')?.textContent;
      var total=row.querySelector('.cart-item-card .action-block > div:first-child .fw-bold, .col-12.col-sm-3 .d-flex > div:first-child');
      var raw=total?.textContent || (text(row.textContent).match(/Total:\s*(\$[\d,.]+)/i)?.[1]);
      var code=text(row.querySelector('.portalGridLink,.cart-item-card h6 a')?.textContent).replace(/^SKU\s*/i,'');
      return {productId:id,productCode:code,quantity:Number(q),netLineTotalCents:cents(raw)};
    }).filter(Boolean);
  }
  function nativeTotals(doc){
    var found={};
    Array.from(doc.querySelectorAll('.summaryTotals tr, #summary table tbody tr')).forEach(function(row){
      var label=text(row.children[0]?.textContent), value=cents(row.querySelector('td.numeric')?.textContent);
      if(value===null)return;
      if(/^Subtotal\b/i.test(label))found.subtotal=value;
      else if(/^Tax$/i.test(label))found.tax=value;
      else if(/^Total(?:\s+inc\s+Tax)?$/i.test(label))found.total=value;
      else if(/^(?:Delivery|Shipping)(?:\s|$)/i.test(label))found.shipping=value;
    });
    return found;
  }
  function reconcile(totals,receipt){
    if(!receipt || receipt.expiresAt<=Date.now())return null;
    var p=receipt.pricing;
    if(totals.subtotal!==p.nativeSubtotalCents || !Number.isSafeInteger(totals.shipping) || !Number.isSafeInteger(totals.tax) ||
       totals.total!==totals.subtotal+totals.shipping+totals.tax)return null;
    var base=totals.shipping-p.deltaCents;
    if(!receipt.rates.some(function(r){return Math.round(Number(r.amount)*100)===base;}))return null;
    return {merchandise:p.nativeSubtotalCents,adjustments:p.adjustments,subtotal:p.merchandiseSubtotalCents,shipping:base,tax:totals.tax,total:totals.total};
  }
  function boot(win){
    if(!win || win.top!==win || !/\/ShoppingCart\.aspx$/i.test(win.location.pathname) || win.WLCartPricing)return;
    var doc=win.document,sequence=0,timer,abandoned=false,verified=false,lastFingerprint='';
    var prefix='ctl00_PageBody_DeliveryAddress_';
    var fields=['AddressLine1','AddressLine2','AddressLine3','City','CountySelector_CountyList','Postcode','CountrySelector'];
    function employee(){return !!doc.getElementById('ctl00_EmployeeStatusBar_LogonBarPanel');}
    function load(key){try{return JSON.parse(win.sessionStorage.getItem(key) || 'null');}catch(_){return null;}}
    function save(key,value){win.sessionStorage.setItem(key,JSON.stringify(value));}
    function receipt(){return load(KEY);}
    function needed(items){return !employee() && items.some(function(p){return LIGHT_IDS.includes(p.productId);});}
    function specialIds(){return load('wl_special_order_quote_ids_v1') || [];}
    function setField(name,value){
      var el=doc.getElementById(prefix+name);if(!el)return false;
      if(el.tagName==='SELECT'){
        var option=Array.from(el.options).find(function(o){return text(o.value).toLowerCase()===text(value).toLowerCase() || text(o.textContent).toLowerCase()===text(value).toLowerCase();});
        if(!option)return false;el.value=option.value;
      }else el.value=String(value || '');
      // Preserve WebForms/Telerik values without firing another fulfillment postback.
      var state=doc.getElementById(el.id+'_ClientState');
      if(state){try{var data=JSON.parse(state.value || '{}');data.valueAsString=el.value;data.lastSetTextBoxValue=el.value;state.value=JSON.stringify(data);}catch(_){}}
      return true;
    }
    function restore(){
      if(!doc.getElementById(prefix+'Postcode'))return;
      var old=load(ADDRESS);if(!old)return;
      fields.forEach(function(f){setField(f,old.values[f]);});
      if(old.mode==='pickup'){
        var pick=doc.getElementById('ctl00_PageBody_SaleTypeSelector_rbCollectLater');if(pick)pick.checked=true;
      }
      win.sessionStorage.removeItem(ADDRESS);win.sessionStorage.removeItem(KEY);
    }
    async function request(body){
      var controller=new win.AbortController(),timeout=win.setTimeout(function(){controller.abort();},20000);
      try{var response=await win.fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});var data=await response.json();if(!response.ok || !data.ok)throw Error(data.error || 'Pricing unavailable.');return data;}
      finally{win.clearTimeout(timeout);}
    }
    function style(){
      if(doc.getElementById('wl-merchandise-pricing-style'))return;
      var s=doc.createElement('style');s.id='wl-merchandise-pricing-style';s.textContent='.wl-pricing{box-sizing:border-box;padding:16px;margin:12px 0;border:1px solid #cbd9cc;border-radius:10px;background:#f5f8f3;color:#203a2c;font:15px/1.5 system-ui;max-width:100%}.wl-pricing h3{font-size:17px;margin:0 0 12px}.wl-pricing-row{display:flex;justify-content:space-between;gap:16px;margin:7px 0}.wl-pricing-row span{min-width:0;overflow-wrap:anywhere}.wl-pricing-row strong{white-space:nowrap}.wl-pricing-savings{color:#23643e}.wl-pricing-total{border-top:1px solid #cbd9cc;margin-top:12px;padding-top:12px;font-size:18px}.wl-pricing small{display:block;margin-top:12px;color:#506151}.wl-pricing select{width:100%;min-height:44px;margin:8px 0;font:inherit}.wl-native-pricing-source,.wl-pricing-cart-source,.wl-has-pricing .cs-subtotal{display:none!important}';doc.head.appendChild(s);
    }
    function panel(rows,note,titleText){
      var box=doc.createElement('section');box.className='wl-pricing';box.setAttribute('aria-label','Order pricing');
      var title=doc.createElement('h3');title.textContent=titleText || 'Your savings';box.appendChild(title);
      rows.forEach(function(r){var row=doc.createElement('div');row.className='wl-pricing-row'+(r.savings?' wl-pricing-savings':'')+(r.total?' wl-pricing-total':'');var label=doc.createElement('span'),value=doc.createElement('strong');label.textContent=r.label;value.textContent=money(r.amount);row.append(label,value);box.appendChild(row);});
      if(note){var small=doc.createElement('small');small.textContent=note;box.appendChild(small);}return box;
    }
    function cartPanels(p){
      doc.querySelectorAll('[data-wl-cart-pricing-summary]').forEach(function(el){el.remove();});
      doc.querySelectorAll('.wl-pricing-cart-source').forEach(function(el){el.classList.remove('wl-pricing-cart-source');});
      doc.querySelectorAll('.wl-has-pricing').forEach(function(el){el.classList.remove('wl-has-pricing');});
      if(!p?.deltaCents)return;
      doc.querySelectorAll('.SubtotalWrapper').forEach(function(wrapper){
        Array.from(wrapper.childNodes).filter(function(n){return n.nodeType===3 && text(n.textContent);}).forEach(function(node){var span=doc.createElement('span');span.setAttribute('data-wl-native-cart-subtotal','');node.replaceWith(span);span.appendChild(node);});
        wrapper.querySelectorAll('[data-wl-native-cart-subtotal]').forEach(function(el){el.classList.add('wl-pricing-cart-source');});
        wrapper.closest('.custom-subtotal-wrapper')?.classList.add('wl-has-pricing');
        var rows=[{label:'Merchandise',amount:p.nativeSubtotalCents}].concat(p.adjustments.map(function(a){return {label:a.label,amount:a.amountCents,savings:a.amountCents<0};}),[{label:p.savingsCents?'Subtotal after savings':'Adjusted subtotal',amount:p.merchandiseSubtotalCents,total:true}]);
        var box=panel(rows,'Applied automatically. Delivery and tax are confirmed at checkout. Mix and match eligible lights: 1–3 boxes 25%, 4–8 boxes 40%, 9+ boxes 60%.',p.savingsCents?'Your savings':'Order pricing');box.setAttribute('data-wl-cart-pricing-summary','');wrapper.prepend(box);
      });
    }
    async function refreshCart(){
      var items=readCart(doc);if(!items.length)return;
      var fingerprint=JSON.stringify(items),current=++sequence;
      save(CART,{cart:items,ts:Date.now()});
      if(fingerprint===lastFingerprint)return;
      lastFingerprint=fingerprint;win.sessionStorage.removeItem(KEY);
      if(!needed(items) && !specialIds().length){cartPanels(null);return;}
      try{var data=await request({cart:items,employee:employee(),specialQuoteIds:specialIds()});if(!abandoned && current===sequence){save(CART,{cart:items,pricing:data.pricing,ts:Date.now()});cartPanels(data.pricing);doc.documentElement.dataset.wlCartPricing='ready';}}
      catch(_){lastFingerprint='';if(!abandoned && current===sequence){cartPanels(null);doc.documentElement.dataset.wlCartPricing='unavailable';}}
    }
    async function freshCart(){
      var response=await win.fetch('/ShoppingCart.aspx',{credentials:'same-origin',cache:'no-store',signal:win.AbortSignal.timeout(15000)});
      if(!response.ok)throw Error('Cart unavailable.');var page=new win.DOMParser().parseFromString(await response.text(),'text/html');
      var items=readCart(page);if(!items.length || items.some(function(p){return p.netLineTotalCents===null;}))throw Error('Cart prices unavailable.');return items;
    }
    async function prepareNativeSubmit(mode){
      try{
        var cached=load(CART),context=await win.WLShippingOffer?.pricingContext?.();
        if(!cached?.cart?.length && !specialIds().length)return {ok:true};
        if(!needed(cached.cart) && !specialIds().length)return {ok:true};
        var items=await freshCart();
        if(!context?.carrierOrigin)throw Error('Trading branch unavailable.');
        var branch=doc.getElementById('ctl00_PageBody_BranchDropDownList');
        var nativeOrigin=context.shipFrom;
        // Keep selected cut/pack options, but replace all quantities and totals
        // with a fresh native basket, including edits from another browser tab.
        items=items.map(function(p){return Object.assign({},context.cart?.find(function(c){return String(c.productId)===p.productId;}) || {},p);});
        var data=await request({action:'reserve',cart:items,shipFrom:nativeOrigin,carrierOrigin:context.carrierOrigin,shipTo:context.shipTo,mode:mode,pickupBranch:branch?.value,employee:employee(),specialQuoteIds:specialIds(),promotionCode:load('wl_christmas_shipping_code_2026') || win.sessionStorage.getItem('wl_christmas_shipping_code_2026')});
        if(!data.receipt){win.sessionStorage.removeItem(KEY);return {ok:true};}
        var r=data.receipt,address=r.nativeAddress;
        var values={};fields.forEach(function(f){values[f]=doc.getElementById(prefix+f)?.value || '';});
        if(values.AddressLine3 && !/^WLQ:/.test(values.AddressLine3))throw Error('The third address line is needed for delivery. Contact Woodson to confirm sale pricing.');
        save(ADDRESS,{mode:mode,values:values});
        if(!setField('AddressLine1',address.addressLine[0]) || !setField('AddressLine2',address.addressLine[1] || '') ||
           !setField('AddressLine3',address.addressLine.at(-1)) || !setField('City',address.city) || !setField('Postcode',address.postalCode) ||
           mode==='pickup' && !setField('CountySelector_CountyList','Texas'))throw Error('Native address unavailable.');
        // The marker belongs only in line 3, never duplicated in line 2.
        setField('AddressLine2',address.addressLine.length>2?address.addressLine[1]:'');
        if(mode==='pickup'){
          var ups=doc.getElementById('ctl00_PageBody_SaleTypeSelector_rbUPSDelivery');if(!ups)throw Error('Native rate control unavailable.');ups.checked=true;
          var instructions=doc.querySelector('[id$="_SpecialInstructionsTextBox"],#ctl00_PageBody_SpecialInstructionsTextBox');
          if(!instructions || !/PICKUP/i.test(instructions.value))throw Error('Pickup instructions must be preserved.');
          instructions.value='STORE PICKUP — '+address.name+'; DO NOT SHIP. '+instructions.value;
        }
        save(KEY,r);return {ok:true,receipt:r};
      }catch(_){restore();return {ok:false};}
    }
    function renderNative(){
      var r=receipt();if(!r)return;
      var totals=nativeTotals(doc);
      if(Object.keys(totals).length===0 && r.verifiedTotals)totals=r.verifiedTotals;
      var view=reconcile(totals,r);verified=!!view;
      doc.documentElement.dataset.wlNativePricing=verified?'verified':'unverified';
      if(!view){doc.querySelectorAll('[data-wl-native-pricing-summary]').forEach(function(el){el.remove();});doc.querySelectorAll('.wl-native-pricing-source').forEach(function(el){el.classList.remove('wl-native-pricing-source');});return;}
      r.verifiedTotals=totals;save(KEY,r);
      // Original financial controls and text remain untouched for native
      // postbacks and payment; only their customer presentation is replaced.
      doc.querySelectorAll('[data-wl-native-pricing-summary]').forEach(function(el){el.remove();});
      var sources=Array.from(doc.querySelectorAll('.summaryTotals')).filter(function(el){return !!el.querySelector('td.numeric');});
      var source=sources[0],modern=doc.querySelector('.wl-modern-summary .wl-lines'),payment=doc.getElementById('wl-payment-choice-context');if(!source && !payment && !modern)return;
      sources.forEach(function(el){el.classList.add('wl-native-pricing-source');});
      var box=panel([{label:'Merchandise',amount:view.merchandise}].concat(view.adjustments.map(function(a){return {label:a.label,amount:a.amountCents,savings:a.amountCents<0};}),[{label:r.mode==='pickup'?'Store pickup':r.mode==='delivery'?'Woodson delivery':'Shipping',amount:view.shipping},{label:'Tax',amount:view.tax},{label:'Total',amount:view.total,total:true}]),r.mode==='pickup'?'Store pickup. Your selected store and pickup instructions are included with your order.':'Your pricing adjustments are included in the total.',r.pricing.savingsCents?'Your savings':'Order pricing');
      box.setAttribute('data-wl-native-pricing-summary','');
      if(modern){modern.querySelectorAll('tfoot,.wl-totals').forEach(function(el){el.classList.add('wl-native-pricing-source');});modern.appendChild(box);}
      else if(payment){payment.querySelectorAll('.wl-payment-choice-amount').forEach(function(el){el.classList.add('wl-native-pricing-source');});payment.appendChild(box);}
      else source.before(box);
      var nativeSelect=doc.querySelector('[id$="UPSShippingCalculatorControl_ShippingSelection"],[id$="DeliveryOptionsDropDownList"]');
      if(nativeSelect && r.mode==='ship'){
        var label=doc.createElement('label');label.textContent='Shipping speed';label.htmlFor='wl-priced-shipping-speed';var select=doc.createElement('select');select.id=label.htmlFor;
        Array.from(nativeSelect.options).forEach(function(o,i){var rate=r.rates[i],option=doc.createElement('option');option.value=o.value;option.textContent=(rate?.serviceName || text(o.textContent).replace(/\$.*$/,''))+' '+money(Math.round(Number(rate?.amount)*100));option.selected=o.selected;select.appendChild(option);});
        select.addEventListener('change',function(){verified=false;nativeSelect.value=select.value;nativeSelect.dispatchEvent(new win.Event('change',{bubbles:true}));});box.prepend(label,select);
      }
      if(r.mode==='pickup')doc.getElementById('wl-native-ups-arrival')?.remove();
      var guide=doc.querySelector('#wl-native-guide[data-stage="shipping"]');
      if(guide && r.mode!=='ship'){guide.querySelector('h1').textContent=r.mode==='pickup'?'Pickup & total':'Delivery & total';guide.querySelector('p').textContent='Review your savings and total before payment.';}
    }
    function schedule(){win.clearTimeout(timer);timer=win.setTimeout(function(){refreshCart();renderNative();},150);}
    win.WLCartPricing={version:BUILD,receipt:receipt,prepareNativeSubmit:prepareNativeSubmit,refresh:refreshCart,render:renderNative};
    if(employee()){win.sessionStorage.removeItem(KEY);win.sessionStorage.removeItem(CART);win.sessionStorage.removeItem(ADDRESS);}
    restore();style();
    doc.addEventListener('click',function(event){
      var handoff=event.target.closest?.('#ctl00_PageBody_PlaceOrderButton,#gc_guest_btn');
      var items=readCart(doc);
      if(handoff && needed(items) && doc.documentElement.dataset.wlCartPricing!=='ready'){
        event.preventDefault();event.stopImmediatePropagation();lastFingerprint='';refreshCart();win.alert('Please wait while your light savings are confirmed, then continue.');return;
      }
      var financial=event.target.closest?.('#ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView,#ctl00_PageBody_CompleteCheckoutButton,[id*="PayStored"],[id*="UseStored"],#ctl00_PageBody_btnContinue_CardOnFileView,#ctl00_PageBody_btnContinue_NewCardView,#ctl00_PageBody_btnPayByCard,#wl-complete');
      if(financial && receipt()){
        renderNative();
        if(!verified){event.preventDefault();event.stopImmediatePropagation();win.alert('Your sale total needs to be refreshed. Go Back to order details, then continue.');}
      }
    },true);
    doc.addEventListener('change',schedule,true);
    doc.addEventListener('input',function(event){if(event.target.matches?.('select.wl-qty-select,input[id*="_qty_"]')){doc.documentElement.dataset.wlCartPricing='updating';lastFingerprint='';schedule();}},true);
    doc.addEventListener('wl:shipping-offer-change',renderNative);
    win.addEventListener('wl-native-checkout-ready',renderNative);
    win.addEventListener('pagehide',function(){abandoned=true;win.clearTimeout(timer);},{once:true});
    if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
    win.setTimeout(schedule,750);win.setTimeout(schedule,1600);
    try{var manager=win.Sys?.WebForms?.PageRequestManager?.getInstance();if(manager)manager.add_endRequest(schedule);}catch(_){}
  }
  return {boot:boot,cents:cents,money:money,readCart:readCart,nativeTotals:nativeTotals,reconcile:reconcile,lightIds:LIGHT_IDS};
});
