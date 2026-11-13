(function(){
  'use strict';
  var core=window.upsCore,key='wl_native_ups_estimates_v1',stage=document.getElementById('fixture-stage'),fake;
  var errors=[];window.addEventListener('error',function(event){errors.push(event.message);document.getElementById('ups-check-summary').textContent='Fixture error: '+event.message;});
  function quote(){return {ts:Date.now(),carrierOrigin:{state:'TX',postalCode:'77836'},addressKey:'PRIVATE-ADDRESS',cartSignature:'PRIVATE-CART',options:{ups:{available:true,rates:[
    {serviceCode:'03',serviceName:'UPS Ground',transit:{businessDays:1,pickupDate:'2026-11-13',arrivalDate:'2026-11-16'}},
    {serviceCode:'02',serviceName:'UPS 2nd Day Air',transit:{businessDays:2,pickupDate:'2026-11-13',arrivalDate:'2026-11-17'}}
  ]}}};}
  function details(){stage.innerHTML='<p>Intermediate native delivery details / stock confirmation</p><input type="radio" id="ctl00_PageBody_SaleTypeSelector_rbUPSDelivery" checked aria-label="UPS selected"><input id="ctl00_PageBody_DeliveryAddress_Postcode" value="77833" aria-label="Public test ZIP">';}
  function shipping(){stage.innerHTML='<div id="SummaryEntry2"><label for="ctl00_PageBody_CartSummary2_UPSShippingCalculatorControl_ShippingSelection">UPS shipping speed</label><select id="ctl00_PageBody_CartSummary2_UPSShippingCalculatorControl_ShippingSelection"><option value="03">UPS Ground</option><option value="02">UPS Second Day Air®</option></select></div><a id="ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView" href="#test-only" hidden>Continue</a>';core.renderUpsArrival(fake);}
  function environment(){
    if(fake)fake.leave();var listeners={};
    var win={document:document,location:{origin:'https://webtrack.woodsonlumber.com',pathname:'/ShoppingCart.aspx',href:'https://webtrack.woodsonlumber.com/ShoppingCart.aspx'},sessionStorage:sessionStorage,WLShippingOffer:{current:quote},Event:Event,MutationObserver:MutationObserver,getComputedStyle:window.getComputedStyle.bind(window),setTimeout:window.setTimeout.bind(window),clearTimeout:window.clearTimeout.bind(window),addEventListener:function(type,fn){(listeners[type]||(listeners[type]=[])).push(fn);},removeEventListener:function(type,fn){listeners[type]=(listeners[type]||[]).filter(function(item){return item!==fn;});},dispatchEvent:function(event){(listeners[event.type]||[]).forEach(function(fn){fn(event);});},leave:function(){(listeners.pagehide||[]).forEach(function(fn){fn({persisted:false});});}};
    win.top=win;return win;
  }
  document.getElementById('run-ups-checks').addEventListener('click',function(){
    var passed=0,failed=0,results=document.getElementById('ups-check-results');results.replaceChildren();
    function check(name,value){var li=document.createElement('li');li.className=value?'pass':'fail';li.textContent=(value?'PASS — ':'FAIL — ')+name;results.appendChild(li);if(value)passed++;else failed++;}
    details();fake=environment();sessionStorage.setItem('wl_fulfillment_method','ship');
    check('confirmed UPS captures only public carrier metadata',core.captureShippingEstimate(fake)&&!/PRIVATE/.test(sessionStorage.getItem(key)));
    var before=sessionStorage.getItem(key);core.boot(fake);
    check('actual native boot preserves dates through the intermediate details document',sessionStorage.getItem(key)===before&&document.documentElement.getAttribute('data-wl-native-ups-handoff')==='preserved');
    shipping();var ground=document.querySelector('#wl-native-ups-arrival');
    check('shipping renders a carrier-based arrival instead of unavailable',ground&&ground.dataset.kind==='date');
    check('shipping consumes the pending handoff',JSON.parse(sessionStorage.getItem(key)).pending===false);
    var first=ground.querySelector('h2').textContent;var select=document.querySelector('select[id*="ShippingSelection"]');select.value='02';select.dispatchEvent(new Event('change',{bubbles:true}));
    check('changing native service shows its own arrival date',document.querySelector('#wl-native-ups-arrival').dataset.kind==='date'&&document.querySelector('#wl-native-ups-arrival h2').textContent!==first);
    details();check('Back to details clears a completed transfer',core.enterDetailsEstimate(fake,Date.now())===false&&!sessionStorage.getItem(key));
    core.captureShippingEstimate(fake);var old=JSON.parse(sessionStorage.getItem(key));old.capturedAt=Date.now()-120001;sessionStorage.setItem(key,JSON.stringify(old));check('expired pending transfers cannot survive another details entry',!core.enterDetailsEstimate(fake,Date.now())&&!sessionStorage.getItem(key));
    sessionStorage.setItem('wl_fulfillment_method','delivery');check('local delivery cannot reuse UPS dates',!core.captureShippingEstimate(fake)&&!sessionStorage.getItem(key));
    sessionStorage.setItem('wl_fulfillment_method','ship');document.getElementById('ctl00_PageBody_SaleTypeSelector_rbUPSDelivery').checked=false;check('an unconfirmed UPS radio cannot capture an estimate',!core.captureShippingEstimate(fake));
    document.getElementById('ctl00_PageBody_SaleTypeSelector_rbUPSDelivery').checked=true;core.captureShippingEstimate(fake);core.enterDetailsEstimate(fake,Date.now());shipping();
    check('the estimate and native service menu fit the viewport',document.documentElement.scrollWidth<=innerWidth+1&&document.querySelector('#wl-native-ups-arrival').getBoundingClientRect().right<=innerWidth+1);
    check('no uncaught browser errors occur',errors.length===0);
    document.getElementById('ups-check-summary').textContent=passed+' passed · '+failed+' failed at '+innerWidth+' × '+innerHeight;document.documentElement.dataset.upsChecks=failed?'fail':'pass';
  });
})();
