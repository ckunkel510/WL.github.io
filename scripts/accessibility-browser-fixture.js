(async function () {
  'use strict';
  var results=document.getElementById('results'), fixture=document.getElementById('fixture'), passed=0,failed=0,runtime,view,doc,facade,endRequests=[],runtimeErrors=[];
  window.addEventListener('error',function(event){runtimeErrors.push(event.message);});
  function equal(actual,expected,message) { if(actual!==expected)throw Error((message||'Mismatch')+': '+JSON.stringify(actual)+' !== '+JSON.stringify(expected)); }
  function ok(value,message) { if(!value)throw Error(message||'Assertion failed'); }
  function pause(ms) { return new Promise(function(resolve){setTimeout(resolve,ms||200);}); }
  async function check(name,fn) { var item=document.createElement('li');try{await fn();item.className='pass';item.textContent='PASS — '+name;passed++;}catch(error){item.className='fail';item.textContent='FAIL — '+name+': '+error.message;failed++;}results.appendChild(item); }
  function markup(content) { return '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"><style>body{font:16px system-ui;margin:16px}button,input,select{min-height:36px}#stockWrapper{position:fixed;inset:15px;background:white;z-index:10003}#stockWrapper iframe{width:100%;height:90%}.wl-field-msg{color:#900}.wl-pdp-recommendations__rail,.wl-smart-search__rail{display:flex;gap:14px;overflow:auto}.wl-pdp-recommendation-card,.wl-smart-search-card{display:flex;flex:0 0 calc((100% - 42px)/4);flex-direction:column;min-width:0;min-height:100px;padding:14px;box-sizing:border-box;border:1px solid #999}</style></head><body><form id="aspnetForm"><nav id="header"><a href="#home">Home</a></nav><div class="site-content"><div id="MainLayoutRow">'+content+'</div></div><div id="external" aria-hidden="false">Outside popup</div></form></body></html>'; }
  async function load(path,content) {
    if(runtime)runtime.destroy();endRequests=[];
    await new Promise(function(resolve){fixture.onload=resolve;fixture.srcdoc=markup(content);});view=fixture.contentWindow;doc=view.document;
    view.addEventListener('error',function(event){runtimeErrors.push(event.message);});
    facade={document:doc,location:{origin:'https://webtrack.woodsonlumber.com',pathname:path,search:'',href:'https://webtrack.woodsonlumber.com'+path},getComputedStyle:view.getComputedStyle.bind(view),MutationObserver:view.MutationObserver,setTimeout:view.setTimeout.bind(view),clearTimeout:view.clearTimeout.bind(view),addEventListener:view.addEventListener.bind(view),removeEventListener:view.removeEventListener.bind(view),Sys:{WebForms:{PageRequestManager:{getInstance:function(){return {add_endRequest:function(fn){endRequests.push(fn);},remove_endRequest:function(fn){endRequests=endRequests.filter(function(x){return x!==fn;});}};}}}}};facade.top=facade;
    runtime=window.WLAccessibilityEnhancer.boot(facade);await pause();return runtime;
  }
  function card(name,n) { return '<div class="wl-product-card"><table class="ProductCard"><tr id="ProductDescriptionRow"><td><a href="/ProductDetail.aspx?pid='+n+'">'+name+'</a></td></tr><tr><td><input id="product'+n+'_ProductQuantity" name="nativeQty'+n+'" value="1"></td></tr></table><a class="add" href="#add'+n+'">Add</a><button type="button" class="buy">Quick buy</button><a href="#save'+n+'">Save for later</a></div>'; }
  await check('two product cards receive distinct quantity, Add, Quick buy and Save names',async function(){
    await load('/Products.aspx',card('Example Board A',1)+card('Example Board B',2));
    equal(doc.querySelector('#product1_ProductQuantity').getAttribute('aria-label'),'Quantity for Example Board A');
    equal(doc.querySelector('#product2_ProductQuantity').getAttribute('aria-label'),'Quantity for Example Board B');
    equal(doc.querySelectorAll('.add')[1].getAttribute('aria-label'),'Add for Example Board B');
    equal(doc.querySelector('.buy').getAttribute('aria-label'),'Quick buy for Example Board A');
  });
  await check('naming preserves native fields, link destinations and exactly-once event handlers',async function(){
    var button=doc.querySelector('.add'), qty=doc.querySelector('#product1_ProductQuantity'),calls=0,changes=0;
    button.addEventListener('click',function(event){event.preventDefault();calls++;});qty.addEventListener('change',function(){changes++;});
    var href=button.getAttribute('href'),name=qty.name;runtime.refresh();runtime.refresh();button.click();qty.value='3';qty.dispatchEvent(new view.Event('change',{bubbles:true}));await pause();
    equal(calls,1);equal(changes,1);equal(qty.value,'3');equal(qty.name,name);equal(button.getAttribute('href'),href);equal(endRequests.length,1);
  });
  await check('zoom, language, main landmark, heading and keyboard skip navigation survive repeat initialization',async function(){
    equal(doc.documentElement.lang,'en');equal(doc.querySelector('meta[name="viewport"]').content,'width=device-width,initial-scale=1,viewport-fit=cover');
    equal(doc.querySelectorAll('[role="main"]').length,1);equal(doc.querySelectorAll('#wl-a11y-page-heading').length,1);equal(doc.querySelectorAll('#wl-a11y-skip').length,1);
    doc.getElementById('wl-a11y-skip').click();equal(doc.activeElement.id,'MainLayoutRow');equal(window.WLAccessibilityEnhancer.boot(facade),runtime);
  });
  await check('existing document language and real product heading are preserved',async function(){
    doc.documentElement.lang='es';var heading=doc.createElement('h1');heading.textContent='Real product';doc.getElementById('MainLayoutRow').appendChild(heading);runtime.refresh();
    equal(doc.documentElement.lang,'es');equal(doc.querySelectorAll('#wl-a11y-page-heading').length,0);equal(heading.tagName,'H1');
  });
  await check('cached recommendation anchors become list-item children without replacing links or click handlers',async function(){
    await load('/ProductDetail.aspx','<h1 id="wl-product-title">Example speaker</h1><div class="wl-pdp-recommendations__rail" role="list"><a role="listitem" class="wl-pdp-recommendation-card" href="#product">Example alternative</a></div>');
    var link=doc.querySelector('.wl-pdp-recommendation-card'),calls=0;link.addEventListener('click',function(event){event.preventDefault();calls++;});runtime.refresh();link.click();
    equal(calls,1);equal(link.getAttribute('role'),null);equal(link.parentElement.getAttribute('role'),'listitem');equal(doc.querySelectorAll('.wl-pdp-recommendation-item').length,1);equal(link.getAttribute('href'),'#product');
  });
  await check('sort and grid/list controls are named while native options and change handlers remain intact',async function(){
    await load('/Products.aspx','<select id="ctl00_SearchOrderControl_lstSort"><option value="best">Best match</option><option value="price">Price</option></select><a id="ctl00_lnkGrid" href="#grid"></a><a id="ctl00_lnkList" href="#list"></a><div class="ProductGroupCardContainer"><a id="group_ProductGroupLinkHeader" href="#tools">Tools</a><a id="group_ProductGroupLink" href="#tools"></a></div>');
    var select=doc.querySelector('select'),calls=0;select.addEventListener('change',function(){calls++;});select.value='price';select.dispatchEvent(new view.Event('change',{bubbles:true}));await pause();
    equal(select.getAttribute('aria-label'),'Sort products');equal(select.options.length,2);equal(select.value,'price');equal(calls,1);equal(doc.getElementById('ctl00_lnkGrid').getAttribute('aria-label'),'Show product grid');equal(doc.getElementById('group_ProductGroupLink').getAttribute('aria-label'),'Shop Tools');
  });
  await check('ASP.NET partial replacement and endRequest get current names without duplicated handlers or stale values',async function(){
    var root=doc.getElementById('MainLayoutRow'),replacement=doc.createElement('div');replacement.id=root.id;replacement.innerHTML=card('Replacement product',3);root.replaceWith(replacement);await pause();endRequests[0]();await pause();
    equal(doc.querySelector('#product3_ProductQuantity').getAttribute('aria-label'),'Quantity for Replacement product');equal(doc.querySelector('#product3_ProductQuantity').value,'1');equal(doc.querySelectorAll('#wl-a11y-skip').length,1);equal(endRequests.length,1);
  });
  await check('returning through browser Back retains the same runtime and refresh handling',async function(){
    view.dispatchEvent(new view.PageTransitionEvent('pagehide',{persisted:true}));view.dispatchEvent(new view.PageTransitionEvent('pageshow',{persisted:true}));
    var cardNode=doc.querySelector('.wl-product-card');cardNode.querySelector('#ProductDescriptionRow a').textContent='After Back';await pause();
    equal(facade.WLAccessibilityRuntime,runtime);equal(cardNode.querySelector('input').getAttribute('aria-label'),'Quantity for After Back');equal(endRequests.length,1);
  });
  await check('cart controls get line context, but quantity/delete/save/checkout handlers keep their original effects',async function(){
    await load('/ShoppingCart.aspx','<h2>Shopping Cart</h2><div class="cart-item-card"><h6><a href="#board">SKU A</a></h6><p>Example Board</p><div class="wl-qty-control" role="group" aria-label="Quantity"><button type="button" class="wl-qty-decrease">−</button><select class="wl-qty-select" name="nativeCartQty"><option>1</option><option>2</option></select><button type="button" class="wl-qty-increase">+</button></div><a class="delete-link" href="#delete">Delete</a><button type="button">Save for Later</button></div><a id="ctl00_PageBody_PlaceOrderButton" href="#native-checkout">Proceed to checkout</a>');
    var qty=doc.querySelector('select'),calls=0,checkout=doc.getElementById('ctl00_PageBody_PlaceOrderButton'),actions={remove:0,save:0,checkout:0};doc.querySelector('.wl-qty-increase').addEventListener('click',function(){qty.value='2';calls++;});doc.querySelector('.wl-qty-increase').click();runtime.refresh();
    var remove=doc.querySelector('.delete-link'),save=doc.querySelector('.cart-item-card>button');remove.addEventListener('click',function(e){e.preventDefault();actions.remove++;});save.addEventListener('click',function(){actions.save++;});checkout.addEventListener('click',function(e){e.preventDefault();actions.checkout++;});runtime.refresh();remove.click();save.click();checkout.click();equal(actions.remove,1);equal(actions.save,1);equal(actions.checkout,1);
    equal(qty.value,'2');equal(calls,1);equal(qty.getAttribute('aria-label'),'Quantity for Example Board');equal(doc.querySelector('.delete-link').getAttribute('aria-label'),'Delete for Example Board');equal(checkout.getAttribute('href'),'#native-checkout');equal(doc.querySelector('h2').getAttribute('aria-level'),'1');
  });
  await check('saved-item Add buttons retain distinct product names and the original add handlers',async function(){
    await load('/ShoppingCart.aspx','<h2>Shopping Cart</h2><div class="sflRow"><div class="sflDesc">Saved Board A</div><button type="button">Add to Cart</button></div><div class="sflRow"><div class="sflDesc">Saved Board B</div><button type="button">Add to Cart</button></div>');
    var buttons=doc.querySelectorAll('button'),calls=0;buttons[1].addEventListener('click',function(){calls++;});runtime.refresh();buttons[1].click();equal(calls,1);equal(buttons[0].getAttribute('aria-label'),'Add to Cart for Saved Board A');equal(buttons[1].getAttribute('aria-label'),'Add to Cart for Saved Board B');
  });
  var checkoutHTML='<h2>Checkout Details</h2><div class="checkout-wizard"><div class="checkout-step" data-step="5"><label>Purchase order#/Your ref:</label><input id="ctl00_PageBody_PurchaseOrderNumberTextBox" name="reference" value="EXAMPLE"><div class="form-group"><label for="pickupDate">Requested Pickup Date</label><p id="date-help">Store must confirm.</p><input type="date" id="pickupDate" name="date" required aria-describedby="date-help"></div><button class="wl-proxy-continue" type="button">Continue to shipping</button></div></div>';
  await check('checkout does not validate, focus, edit values or display errors on initialization',async function(){
    await load('/ShoppingCart.aspx',checkoutHTML);equal(doc.querySelector('[aria-invalid="true"]'),null);equal(doc.getElementById('wl-a11y-error-summary'),null);equal(doc.getElementById('ctl00_PageBody_PurchaseOrderNumberTextBox').value,'EXAMPLE');equal(doc.getElementById('ctl00_PageBody_PurchaseOrderNumberTextBox').getAttribute('aria-label'),'Purchase order number / Your reference');
  });
  await check('a late native checkout H1 removes the temporary H2 promotion',async function(){
    var guide=doc.createElement('section');guide.id='wl-native-guide';var heading=doc.createElement('h1');heading.textContent='Order details';guide.appendChild(heading);doc.querySelector('.checkout-wizard').prepend(guide);await pause();equal(doc.querySelector('h2').getAttribute('aria-level'),null);equal(doc.querySelectorAll('h1,[aria-level="1"]').length,1);
  });
  await check('failed native validation focuses its field and associates the existing message without replacing validation',async function(){
    var button=doc.querySelector('.wl-proxy-continue'),field=doc.getElementById('pickupDate'),pane=button.parentElement,calls=0;
    button.addEventListener('click',function(){calls++;var message=doc.createElement('div');message.className='wl-field-msg';message.textContent='Choose an available pickup date.';field.classList.add('wl-field-invalid');field.parentElement.appendChild(message);var error=doc.createElement('div');error.className='wl-inline-error';error.setAttribute('role','alert');error.textContent='Review pickup date.';pane.prepend(error);button.dataset.wlContinueState='blocked';});
    button.click();await pause();equal(calls,1);equal(doc.activeElement,field);equal(field.getAttribute('aria-invalid'),'true');ok(field.getAttribute('aria-describedby').includes('date-help'));ok(field.getAttribute('aria-describedby').includes(doc.querySelector('.wl-field-msg').id));ok(doc.querySelector('#wl-a11y-error-summary a'));equal(doc.getElementById('wl-a11y-error-summary').previousElementSibling.id,'wl-native-guide');
  });
  await check('correcting errors removes only enhancement-owned invalid/description tokens and retains entered values',async function(){
    var field=doc.getElementById('pickupDate');field.value='2026-12-01';field.classList.remove('wl-field-invalid');doc.querySelectorAll('.wl-field-msg,.wl-inline-error').forEach(function(node){node.remove();});field.dispatchEvent(new view.Event('input',{bubbles:true}));await pause();
    equal(field.value,'2026-12-01');equal(field.getAttribute('aria-invalid'),null);equal(field.getAttribute('aria-describedby'),'date-help');equal(doc.getElementById('wl-a11y-error-summary'),null);
  });
  await check('asynchronous Continue waiting state does not steal focus or cause duplicate submission',async function(){
    await load('/ShoppingCart.aspx',checkoutHTML);var button=doc.querySelector('button'),field=doc.getElementById('pickupDate'),calls=0;button.focus();
    button.addEventListener('click',function(){calls++;button.dataset.wlContinueState='waiting';button.disabled=true;setTimeout(function(){var error=doc.createElement('div');error.className='wl-inline-error';error.textContent='Choose a pickup date.';button.parentElement.prepend(error);},50);});button.click();await pause(160);equal(doc.getElementById('wl-a11y-error-summary'),null);equal(calls,1);
    button.disabled=false;button.dataset.wlContinueState='blocked';await pause();equal(doc.activeElement,field);equal(calls,1);
  });
  await check('server validator associations remain stable through repeated observer passes',async function(){
    await load('/ShoppingCart.aspx','<h2>Checkout</h2><div class="checkout-step"><label for="nativeField">Reference</label><input id="nativeField" value="EXAMPLE" aria-describedby="existing"><span id="existing">Existing help</span><span controltovalidate="nativeField">Existing server error</span></div>');
    var field=doc.getElementById('nativeField'),before=field.getAttribute('aria-describedby');runtime.refresh();runtime.refresh();await pause();equal(field.getAttribute('aria-describedby'),before);equal(field.getAttribute('aria-invalid'),'true');equal(doc.activeElement.tagName,'BODY');
  });
  await check('stock iframe is a named modal with heading focus and preserved table headers',async function(){
    await load('/ProductDetail.aspx','<h1 id="wl-product-title">Example speaker</h1><a id="native_btnShowStock" href="#inventory">Store inventory</a>');
    var opener=doc.getElementById('native_btnShowStock');opener.focus();var wrapper=doc.createElement('div');wrapper.id='stockWrapper';wrapper.className='RadWindow';var frame=doc.createElement('iframe');frame.name='RadWindow_Stock';frame.src='/Catalog/ShowStock.aspx?productid=1';wrapper.appendChild(frame);doc.getElementById('aspnetForm').appendChild(wrapper);await pause(450);
    equal(wrapper.getAttribute('role'),'dialog');equal(wrapper.getAttribute('aria-modal'),'true');equal(frame.title,'Store inventory for Example speaker');equal(doc.activeElement,frame);equal(frame.contentDocument.activeElement.id,'wl-a11y-stock-heading');equal(frame.contentDocument.querySelectorAll('th[scope="col"]').length,2);ok(doc.querySelector('.site-content').hasAttribute('inert'));
  });
  await check('stock Shift+Tab and Tab wrap, Escape uses native Close once and restores focus/background',async function(){
    var frame=doc.querySelector('iframe'),child=frame.contentDocument,buttons=child.querySelectorAll('button'),closed=0;buttons[1].addEventListener('click',function(){closed++;});
    buttons[0].focus();buttons[0].dispatchEvent(new view.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));equal(child.activeElement,buttons[1]);
    buttons[1].dispatchEvent(new view.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));equal(child.activeElement,buttons[0]);
    buttons[0].dispatchEvent(new view.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await pause();equal(closed,1);equal(doc.activeElement.id,'native_btnShowStock');equal(doc.querySelector('.site-content').hasAttribute('inert'),false);equal(doc.getElementById('external').getAttribute('aria-hidden'),'false');
  });
  await check('cross-origin stock frames are not inspected or trapped',async function(){
    var wrapper=doc.getElementById('stockWrapper');wrapper.remove();runtime.refresh();wrapper=doc.createElement('div');wrapper.className='RadWindow';wrapper.innerHTML='<iframe name="RadWindow_Stock" src="https://example.invalid/Catalog/ShowStock.aspx" srcdoc="<form></form>"></iframe>';doc.body.appendChild(wrapper);await pause();equal(wrapper.getAttribute('role'),null);equal(doc.querySelector('.site-content').hasAttribute('inert'),false);wrapper.remove();
  });
  await check('an iframe load arriving after native Close does not reopen or focus the popup',async function(){
    var wrapper=doc.createElement('div');wrapper.id='stockWrapper';wrapper.className='RadWindow';var frame=doc.createElement('iframe');frame.name='RadWindow_Stock';frame.src='/Catalog/ShowStock.aspx?productid=1';wrapper.appendChild(frame);doc.getElementById('aspnetForm').appendChild(wrapper);runtime.refresh();wrapper.style.display='none';runtime.refresh();await pause(350);frame.dispatchEvent(new view.Event('load'));await pause();equal(doc.activeElement.id,'native_btnShowStock');equal(doc.querySelector('.site-content').hasAttribute('inert'),false);wrapper.remove();
  });
  await check('destroy detaches partial-refresh callbacks and all temporary modal/error state',async function(){runtime.destroy();equal(endRequests.length,0);equal(facade.WLAccessibilityRuntime,undefined);equal(doc.querySelectorAll('[inert]').length,0);});
  await check('no uncaught errors occur during partial updates, navigation or teardown',async function(){await pause();equal(runtimeErrors.length,0,runtimeErrors.join('; '));});
  document.getElementById('summary').textContent=passed+' passed · '+failed+' failed';document.documentElement.dataset.testResult=failed?'fail':'pass';
})();
