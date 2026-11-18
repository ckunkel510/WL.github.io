/* Exact-model camera essentials. Only an explicit shopper choice adds items. */
(function(root,factory){'use strict';var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.WLProductPairing=api;api.boot(root).catch(function(){});}})(typeof window==='object'?window:null,function(){
  'use strict';
  var BUILD='20261118-camera-sd-1',ORIGIN='https://webtrack.woodsonlumber.com',BASE='https://ckunkel510.github.io/WL.github.io/';
  var BATTERY=Object.freeze({key:'battery',pid:'2853',code:'1162676',name:'Energizer Max AA Battery 8pk',label:'Energizer MAX AA · 8-pack',unitLabel:'battery pack',image:'https://images-woodsonlumber.sirv.com/merchant-feed/products/2853/main-80e2c51bf54b4660.jpg',fit:'One complete set of eight matching fresh AA cells. Never mix battery types or old and new cells.'});
  var CARD=Object.freeze({key:'sd',pid:'290616',code:'RFS32GB',name:'Reveal SD Memory Card, 32GB',label:'Tactacam REVEAL · 32GB SD card',unitLabel:'SD card',image:'https://images-woodsonlumber.sirv.com/merchant-feed/products/290616/main-5dd3904b315c809e.jpg',fit:'Full-size 32GB SDHC, Class 10. Format in the camera before use; formatting erases existing files.'});
  var PAIRS=[
    {id:'spark-aa-spares-v1',camera:'246159',cameraCode:'WGI-SWTC2LOK',cameraName:'Wildgame Innovations Spark 2.0 18MP Lightsout Combo',cameraLabel:'SPARK 2.0',cardIncluded:true,includedCardGB:16,disclosure:'Included in this SPARK combo: 8 AA batteries and one 16GB SD card. An extra battery pack is optional spare power; no additional SD card is needed for the first setup.',accessories:[BATTERY],evidence:'https://assets.unilogcorp.com/267/ITEM/DOC/Wildgame_INNOVATIONS_WLD006_Catalog.pdf'},
    {id:'gmax32-aa-v1',camera:'174184',cameraCode:'STC-GMAX32VNG',cameraName:'Stealth Cam GMAX Vision, 32 MP',cameraLabel:'GMAX Vision',cardIncluded:false,cardMaxGB:32,disclosure:'This camera uses 8 AA batteries and a full-size Class 10 SD card up to 32GB, sold separately. Choose only the supplies you need.',accessories:[BATTERY,CARD],evidence:'https://www.stealthcam.com/wp-content/uploads/2021/11/GSM-200851-GMAX32VNG-Instruction-Manual-R0.pdf'},
    {id:'reactor-sd-v1',camera:'174187',cameraCode:'STC-RVRZW',cameraName:'Stealth Cam Reactor Cell Game Camera, 26 MP / 1080P (Verizon Version)',cameraLabel:'Reactor Verizon',cardIncluded:false,cardMaxGB:32,disclosure:'This Reactor uses 8 AA batteries and a full-size Class 10 SD card up to 32GB, sold separately. Choose only the supplies you need.',accessories:[BATTERY,CARD],evidence:'https://images.thdstatic.com/catalog/pdfImages/0a/0ad915ec-570a-4c50-8c9b-0fdddadb36c3.pdf'},
    {id:'revolver-sd-v1',camera:'246162',cameraCode:'STC-RVLR',cameraName:'Stealth Cam Revolver 36MP 360 Degree Cell Camera',cameraLabel:'Revolver',cardIncluded:false,cardMaxGB:32,disclosure:'Add a compatible full-size 32GB Class 10 SD card for recording. SD card sold separately.',accessories:[CARD],evidence:'https://www.stealthcam.com/wp-content/uploads/2025/01/STC-RVLR-Revolver-Instruction-Manual-R1.pdf'},
    {id:'mitigator-sd-v1',camera:'225714',cameraCode:'MUD-MTGTR',cameraName:'Muddy Mitigator Cellular Camera 20MP',cameraLabel:'Mitigator',cardIncluded:false,cardMaxGB:32,disclosure:'This Mitigator camera requires a full-size Class 10 SD card up to 32GB, sold separately.',accessories:[CARD],evidence:'https://www.gomuddy.com/wp-content/uploads/2025/01/MUD-MTGTR-Cellular-Instruction-Manual.pdf'},
    {id:'trifecta-sd-v1',camera:'277247',cameraCode:'MUD-TRF180',cameraName:'Muddy Trifecta 180 Degree 36 MP Game Camera',cameraLabel:'Trifecta 180',cardIncluded:null,cardMaxGB:32,disclosure:'Choose a full-size 32GB Class 10 SD card if you need one for this Trifecta 180. This is an optional separate add-on.',accessories:[CARD],evidence:'https://www.gomuddy.com/products/muddy-trifecta-180/',cardEvidence:'https://gsmoutdoorshelp.zendesk.com/hc/en-us/articles/17502615623700-What-are-the-recommended-batteries-and-SD-cards-for-my-camera',contentsEvidence:'Owner authorized the optional separate-card choice on 2026-11-18; included-card contents were not independently confirmed.'},
    {id:'procam14-included-v1',camera:'174183',cameraCode:'MUD-MTC100K',cameraName:'Muddy Pro Cam 14 Game Camera',cameraLabel:'Pro-Cam 14 kit',cardIncluded:true,includedCardGB:16,disclosure:'This MUD-MTC100K kit includes a 16GB SD card and batteries. No additional SD card is needed for the first setup.',accessories:[],evidence:'https://assets.unilogcorp.com/267/ITEM/DOC/MUDDY_MUDMTC100K_Catalog.pdf'},
    {id:'kicker-included-v1',camera:'185533',cameraCode:'WGI-KICK2K',cameraName:'Wildgame Innovations Kicker 2.0 18MP Trail Cam - Batteries & SD Included',cameraLabel:'Kicker 2.0 kit',cardIncluded:true,disclosure:'This Kicker 2.0 kit includes batteries and an SD card. No additional SD card is needed for the first setup.',accessories:[],evidence:'https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=185533'}
  ].map(function(p){return Object.freeze(Object.assign(p,{accessories:Object.freeze(p.accessories),battery:BATTERY.pid,batteryCode:BATTERY.code,batteryName:BATTERY.name,compatibility:BATTERY.fit,verifiedAt:'2026-11-18'}));});
  var busy=new WeakSet(),used=new WeakSet();
  function pairFor(value){return PAIRS.find(function(p){return p.camera===value||p.id===value;})||null;}
  function normalized(s){return String(s||'').replace(/\s+/g,' ').trim().toUpperCase();}
  function quantity(value){var n=Number(value);if(!Number.isInteger(n)||n<1||n>99)throw Error('Choose a whole quantity from 1 to 99 for these camera supplies.');return n;}
  function snapshot(cart){
    if(!cart||!cart.store||!Array.isArray(cart.items)||cart.items.length>60)throw Error('Check your cart and store before adding these items.');
    var seen=new Set(),rows=cart.items.map(function(r){if(!/^\d+$/.test(r.pid)||seen.has(r.pid)||!Number.isInteger(r.quantity)||r.quantity<1||r.quantity>9999||!r.code||!r.unit)throw Error('This cart needs the regular product controls.');seen.add(r.pid);return[r.pid,r.quantity,normalized(r.code),r.unit,!!r.configured,r.price??null];}).sort(function(a,b){return a[0].localeCompare(b[0]);});
    return JSON.stringify([cart.store,cart.sessionKind||'',cart.scope||'local',rows]);
  }
  function increment(cart,product,count){var items=cart.items.map(function(r){return Object.assign({},r);}),existing=items.find(function(r){return r.pid===product.pid;});if(existing)existing.quantity+=count;else items.push({pid:product.pid,code:product.code,quantity:count,unit:'ea',configured:false,price:product.price});return Object.assign({},cart,{items:items});}
  function compatible(product,pid,code,name){return product&&product.pid===pid&&normalized(product.code)===normalized(code)&&normalized(product.name)===normalized(name)&&product.unit==='ea'&&Number.isInteger(product.price)&&product.price>0;}
  function available(stock,cart){if(!stock?.verified||!stock.branches)return null;if(cart.scope!=='company')return Number.isFinite(stock.branches[cart.store])?Math.floor(stock.branches[cart.store]):null;var counts=Object.values(stock.branches);return counts.length&&counts.every(function(n){return Number.isFinite(n)&&n>=0;})?counts.reduce(function(a,n){return a+Math.floor(n);},0):null;}
  function validate(product,spec,stock,cart,count){
    if(!compatible(product,spec.pid,spec.code,spec.name))throw Error('The exact products or current prices could not be confirmed. Use the regular product pages.');
    if(cart.sessionKind&&product.sessionKind!==cart.sessionKind)throw Error('Your sign-in changed. Refresh the product page.');
    var existing=cart.items.find(function(r){return r.pid===spec.pid;});
    if(existing&&(existing.configured||existing.unit!=='ea'||normalized(existing.code)!==normalized(spec.code)||existing.price!==product.price||existing.quantity+count>9999))throw Error('An existing cart line needs review on the regular cart page.');
    var stockCount=available(stock,cart);
    if(stockCount===null||stockCount<(existing?.quantity||0)+count)throw Error(cart.scope==='company'?'This item is not confirmed available in the requested quantity companywide. Check the product page.':'This item is not confirmed in stock at your selected store. Check the product page for other fulfillment options.');
  }
  function cameraSpec(pair){return{pid:pair.camera,code:pair.cameraCode,name:pair.cameraName};}
  function selectedSpecs(pair,keys){
    if(!Array.isArray(keys)||keys.length<1||keys.length>2||new Set(keys).size!==keys.length)throw Error('Select the camera supplies you want to add.');
    return keys.map(function(k){var spec=pair.accessories.find(function(a){return a.key===k;});if(!spec)throw Error('This camera has no verified match for that accessory.');return spec;}).sort(function(a,b){return a.key.localeCompare(b.key);});
  }
  function makeQuote(pair,count,cart,products,keys){return{pairId:pair.id,pair:pair,quantity:count,baseline:snapshot(cart),cart:cart,camera:products[0],battery:products.find(function(p){return p.pid===BATTERY.pid;}),products:products,selectedKeys:keys.slice(),total:count*products.reduce(function(n,p){return n+p.price;},0),at:Date.now()};}
  async function prepare(io,pairId,count,keys){
    var pair=pairFor(pairId||PAIRS[0].id),q=quantity(count??1);if(!pair)throw Error('This camera has no verified accessory match.');
    // Legacy battery-only callers keep their exact selection. New UI supplies explicit keys.
    if(keys===undefined)keys=pair.accessories.some(function(a){return a.key==='battery';})?['battery']:pair.accessories.map(function(a){return a.key;});
    var extras=selectedSpecs(pair,keys),specs=[cameraSpec(pair)].concat(extras),parts=await Promise.all([io.read(),Promise.all(specs.map(function(s){return Promise.all([io.product(s.pid),io.stock(s.pid)]);} ))]),cart=parts[0];snapshot(cart);
    var products=parts[1].map(function(values,i){validate(values[0],specs[i],values[1],cart,q);return values[0];});
    return makeQuote(pair,q,cart,products,extras.map(function(a){return a.key;}));
  }
  async function inspect(io,pair,count){
    var q=quantity(count),cart=await io.read();snapshot(cart);
    var specs=[cameraSpec(pair)].concat(pair.accessories),values=await Promise.allSettled(specs.map(function(s){return Promise.all([io.product(s.pid),io.stock(s.pid)]);}));
    if(values[0].status!=='fulfilled')throw Error('The current camera could not be confirmed. Check its product page.');
    var camera=values[0].value[0];validate(camera,specs[0],values[0].value[1],cart,q);
    var choices=pair.accessories.map(function(spec,i){var value=values[i+1],product=null,error=null;try{if(value.status!=='fulfilled')throw Error('Current availability could not be confirmed.');product=value.value[0];validate(product,spec,value.value[1],cart,q);}catch(e){error=e.message;}return{spec:spec,product:error?null:product,error:error};});
    return{cart:cart,camera:camera,quantity:q,choices:choices};
  }
  function reviewError(){var e=Error('Check your cart before trying again. Some selected items may have been added; no automatic retry was made.');e.reviewCart=true;return e;}
  function fingerprint(q){return JSON.stringify([q.pairId,q.quantity,q.selectedKeys,q.products?.map(function(p){return[p.pid,p.price];})]);}
  async function addBoth(io,quote,selected){
    if(selected!==true)throw Error('Select the optional camera supplies first.');if(busy.has(io)||used.has(quote))throw Error('This addition is already in progress or needs a fresh cart review.');busy.add(io);
    try{
      var fresh=await prepare(io,quote?.pairId,quote?.quantity,quote?.selectedKeys);
      if(!quote||!Number.isFinite(quote.at)||quote.at>Date.now()||Date.now()-quote.at>120000||quote.baseline!==fresh.baseline||fingerprint(quote)!==fingerprint(fresh))throw Error('Your cart, store, price or availability changed. Review these items again.');
      used.add(quote);var expected=fresh.cart;
      for(var product of fresh.products){
        var current;
        try{var currentCart=await io.read();if(snapshot(currentCart)!==snapshot(expected))throw reviewError();var live=await Promise.all([io.product(product.pid),io.stock(product.pid)]);current=live[0];validate(current,{pid:product.pid,code:product.code,name:product.name},live[1],currentCart,fresh.quantity);if(current.price!==product.price)throw reviewError();}catch(_){throw reviewError();}
        var next=increment(expected,current,fresh.quantity);
        try{await io.add(current,fresh.quantity);}catch(_){/* Lost replies are read back once; never retry the POST. */}
        var actual,actualSnapshot;try{actual=await io.read();actualSnapshot=snapshot(actual);}catch(_){throw reviewError();}
        if(actualSnapshot!==snapshot(next)){if(product.pid===fresh.pair.camera&&actualSnapshot===fresh.baseline){var unchanged=Error('No selected items were added. Your cart is unchanged. Check the product pages.');unchanged.safeCart=true;throw unchanged;}throw reviewError();}
        expected=actual;
      }
      return{status:'added',cart:expected,added:fresh.products.map(function(p){return{pid:p.pid,quantity:fresh.quantity};})};
    }finally{busy.delete(io);}
  }
  function money(cents){return '$'+(cents/100).toFixed(2);}
  function mount(doc,host,io,options){
    options=options||{};var pair=pairFor(options.camera||PAIRS[0].camera);if(!pair||!host||host.querySelector('[data-wl-product-pair]'))return;
    var box=doc.createElement('section');box.className='wl-product-pair';box.setAttribute('data-wl-product-pair',pair.id);
    var heading=doc.createElement('h3');heading.textContent=pair.accessories.length?'Camera essentials':'Included with this camera';box.appendChild(heading);
    var disclosure=doc.createElement('p');disclosure.className='wl-pair-disclosure';disclosure.textContent=pair.disclosure;box.appendChild(disclosure);host.appendChild(box);
    if(!pair.accessories.length)return{element:box,refresh:function(){}};
    var rows=pair.accessories.map(function(spec){
      var label=doc.createElement('label');label.className='wl-pair-choice';label.setAttribute('data-accessory',spec.key);
      var choice=doc.createElement('input');choice.type='checkbox';choice.disabled=true;choice.setAttribute('aria-label','Include '+spec.label);
      var img=doc.createElement('img');img.src=spec.image;img.alt=spec.label;img.width=52;img.height=70;
      var copy=doc.createElement('span'),name=doc.createElement('span'),price=doc.createElement('strong'),count=doc.createElement('span');name.className='wl-pair-name';name.textContent=spec.label;price.className='wl-pair-price';count.className='wl-pair-pack-count';copy.append(name,price,count);label.append(choice,img,copy);box.appendChild(label);
      var fit=doc.createElement('p');fit.className='wl-pair-fit';fit.textContent=spec.fit;box.appendChild(fit);return{spec:spec,choice:choice,price:price,count:count};
    });
    var total=doc.createElement('strong');total.className='wl-pair-total';box.appendChild(total);
    var button=doc.createElement('button');button.type='button';button.className='wl-pair-add';button.disabled=true;button.textContent='Checking availability…';box.appendChild(button);
    var status=doc.createElement('p');status.className='wl-pair-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');box.appendChild(status);
    var cartLink=doc.createElement('a');cartLink.className='wl-pair-cart';cartLink.href='/ShoppingCart.aspx';cartLink.hidden=true;cartLink.textContent='View cart →';box.appendChild(cartLink);
    var quote,inspection,pending=false,finished=false,generation=0;
    function sync(){
      if(!inspection||pending||finished)return;
      var chosen=rows.filter(function(r){return r.choice.checked&&!r.choice.disabled;});
      quote=chosen.length?makeQuote(pair,inspection.quantity,inspection.cart,[inspection.camera].concat(chosen.map(function(r){return inspection.choices.find(function(c){return c.spec.key===r.spec.key;}).product;})),chosen.map(function(r){return r.spec.key;}).sort()):null;
      // Keep quote product order aligned with the canonical selected-key order.
      if(quote)quote.products=[inspection.camera].concat(quote.selectedKeys.map(function(k){return inspection.choices.find(function(c){return c.spec.key===k;}).product;}));
      total.textContent=quote?'Camera + selected supplies: '+money(quote.total):'Choose the supplies you need.';
      button.textContent=quote?'Add camera + '+chosen.map(function(r){return r.spec.key==='sd'?'SD card':'batteries';}).join(' + '):'Select an add-on';button.disabled=!quote;
      status.textContent=inspection.cart.scope==='company'?'Available choices are confirmed companywide. Confirm pickup or shipping in your cart.':'Available choices are in stock at '+inspection.cart.store+'. Fulfillment is confirmed in checkout.';
    }
    async function refresh(){
      if(pending||finished)return;var epoch=++generation;quote=null;inspection=null;button.disabled=true;status.textContent='Checking current prices and availability…';rows.forEach(function(r){r.choice.disabled=true;});
      try{
        var result=await inspect(io,pair,options.getQuantity?options.getQuantity():1);if(epoch!==generation)return;inspection=result;
        rows.forEach(function(r){var c=result.choices.find(function(v){return v.spec.key===r.spec.key;});r.choice.disabled=!!c.error;if(c.error){r.choice.checked=false;r.price.textContent='';r.count.textContent=c.error;}else{r.price.textContent=money(c.product.price)+' each';r.count.textContent='Add '+result.quantity+' '+r.spec.unitLabel+(result.quantity===1?'':'s')+' for '+result.quantity+' camera'+(result.quantity===1?'':'s');}});sync();
      }catch(e){if(epoch!==generation)return;rows.forEach(function(r){r.choice.checked=false;r.price.textContent='';r.count.textContent='';});total.textContent='';status.textContent=e.message;button.textContent='Check availability';button.disabled=false;}
    }
    rows.forEach(function(r){r.choice.addEventListener('change',sync);});
    button.addEventListener('click',async function(){
      if(pending||finished)return;if(!inspection){await refresh();return;}if(!quote)return;
      pending=true;button.disabled=true;rows.forEach(function(r){r.choice.disabled=true;});var selectedQuote=quote;status.textContent='Adding your camera and selected supplies…';
      try{
        if(quantity(options.getQuantity?options.getQuantity():1)!==selectedQuote.quantity)throw Error('Your quantity changed. Review the total again.');
        await addBoth(io,selectedQuote,true);finished=true;status.textContent='Added '+selectedQuote.quantity+' camera'+(selectedQuote.quantity===1?'':'s')+' and your selected supplies.';button.textContent='Added to cart';cartLink.hidden=false;
        if(options.onAdded)try{options.onAdded(selectedQuote);}catch(_){}
      }catch(e){status.textContent=e.message;if(e.reviewCart||e.safeCart){finished=true;button.textContent='Review cart';cartLink.hidden=false;}else{quote=null;inspection=null;rows.forEach(function(r){r.choice.checked=false;});button.textContent='Refresh prices';button.disabled=false;}}
      finally{pending=false;}
    });
    refresh();return{element:box,refresh:refresh};
  }
  async function boot(win){
    if(!win||win.top!==win||win.location.origin!==ORIGIN||!/^\/ProductDetail\.aspx$/i.test(win.location.pathname))return;var pair=pairFor(new URLSearchParams(win.location.search).get('pid'));if(!pair)return;var doc=win.document;if(doc.readyState==='loading')await new Promise(function(resolve){doc.addEventListener('DOMContentLoaded',resolve,{once:true});});
    function load(file,name){if(win[name])return Promise.resolve(win[name]);return new Promise(function(resolve,reject){var script=doc.createElement('script'),timer=win.setTimeout(function(){reject(Error('Unavailable'));},10000);script.src=BASE+file+'?v='+BUILD;script.async=true;script.onload=function(){win.clearTimeout(timer);win[name]?resolve(win[name]):reject(Error('Unavailable'));};script.onerror=function(){win.clearTimeout(timer);reject(Error('Unavailable'));};doc.head.appendChild(script);});}
    var style=doc.createElement('link');style.rel='stylesheet';style.href=BASE+'ProductPairing.css?v='+BUILD;var styled=new Promise(function(resolve){var timer=win.setTimeout(function(){resolve(false);},10000);style.onload=function(){win.clearTimeout(timer);resolve(true);};style.onerror=function(){win.clearTimeout(timer);resolve(false);};doc.head.appendChild(style);});
    var deps=await Promise.all([load('CartSubstitutions.js','WLCartSubstitutions'),load('PickupAvailability.js','WLPickupAvailability'),load('ProductPairingNative.js','WLProductPairingNative'),styled]);if(!deps[3])return;var tries=0;
    function place(){
      var policy=doc.querySelector('#product-sidebar a[href="https://www.woodsonlumber.com/shipping-policy"]'),input=doc.querySelector('input[id$="_qty_'+pair.camera+'"]');if(doc.querySelector('[data-wl-product-pair]'))return true;if(!policy||!input)return false;try{quantity(input.value);}catch(_){return false;}
      var code=Array.from(doc.querySelectorAll('.formPageHeader')).map(function(e){return normalized(e.textContent);}).find(function(s){return /^PRODUCT CODE:/.test(s);});var name=normalized(doc.querySelector('#wl-product-title,.productDescriptionOnThisPageFull')?.textContent).replace(/^\*+\s*/,'');if(code!=='PRODUCT CODE: '+normalized(pair.cameraCode)||name!==normalized(pair.cameraName))return false;
      var host=doc.createElement('div');host.className='wl-product-pair-slot';policy.parentElement.after(host);var io=deps[2].adapter(win,deps[0],deps[1]),widget=mount(doc,host,io,{camera:pair.camera,getQuantity:function(){return input.value;},onAdded:function(q){if(win.WLAnalytics?.track)win.WLAnalytics.track('add_to_cart',{ecommerce:{currency:'USD',value:q.total/100,items:q.products.map(function(p){return{item_id:p.pid,item_name:p.name,price:p.price/100,quantity:q.quantity};})}});}});
      if(!widget){host.remove();return true;}function refresh(){win.setTimeout(widget.refresh,0);}input.addEventListener('input',refresh);input.addEventListener('change',refresh);doc.querySelectorAll('#product-sidebar .method-box').forEach(function(b){b.addEventListener('click',refresh);});return true;
    }
    if(place())return;var timer=win.setInterval(function(){if(place()||++tries>=40)win.clearInterval(timer);},250);
  }
  return{enabled:true,build:BUILD,pair:PAIRS[0],pairs:PAIRS,pairFor:pairFor,snapshot:snapshot,prepare:prepare,addBoth:addBoth,mount:mount,boot:boot,available:available,inspect:inspect,accessories:Object.freeze({battery:BATTERY,sd:CARD})};
});
