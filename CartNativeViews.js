/* Native checkout decorators are deferred until a native view needs them. */
(function (root,factory) {
  'use strict';
  var core=factory();
  if (typeof module==='object' && module.exports) module.exports=core;
  else core.boot(root,document.currentScript && document.currentScript.src);
})(typeof window==='object'?window:null,function () {
  'use strict';
  var BUILD='20261109-native-views-5';
  function needsNativeViews(doc) {
    if (doc.querySelector('#ctl00_PageBody_DeliveryAddress_Postcode,#ctl00_PageBody_SaleTypeSelector_rbCollectLater,#ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView,#ctl00_PageBody_ddlCardsOnFile,#ctl00_PageBody_rbStoredCard,#ctl00_PageBody_CardOnFileViewTitle_HeaderText,#ctl00_PageBody_CompleteCheckoutButton,#summary')) return true;
    return !['ctl00_PageBody_ShoppingCartDetailPanel','ctl00_PageBody_EmptyCartPanel','ctl00_PageBody_EmptyCartDetailPanel'].some(function (id) { return !!doc.getElementById(id); });
  }
  function boot(win,source) {
    if (!win || win.location.origin!=='https://webtrack.woodsonlumber.com' || !/\/ShoppingCart\.aspx$/i.test(win.location.pathname) || win.WLCartNativeViews) return;
    win.WLCartNativeViews={build:BUILD};
    var doc=win.document,base=new URL('.',source || 'https://ckunkel510.github.io/WL.github.io/CartNativeViews.js').href;
    var abandoned=false,observer=null,scheduled=false,loaded=false;
    win.addEventListener('pagehide',function () { abandoned=true; if (observer) observer.disconnect(); },{once:true});
    function load(file,version) {
      if (Array.from(doc.scripts).some(function (script) { try { return new URL(script.src,win.location.href).pathname.endsWith('/'+file); } catch (_) { return false; } })) return;
      var attempt=0;
      function request() {
        if (abandoned) return;
        attempt++;
        var script=doc.createElement('script'); script.src=base+file+'?v='+version; script.async=true;
        script.setAttribute('data-wl-native-view-file',file);
        script.setAttribute('data-wl-load-state','loading');
        script.onload=function () { script.setAttribute('data-wl-load-state','loaded'); };
        script.onerror=function () {
          script.setAttribute('data-wl-load-state',attempt<2?'retrying':'failed');
          if (attempt<2 && !abandoned) { script.remove(); win.setTimeout(request,350); }
        };
        doc.head.appendChild(script);
      }
      request();
    }
    function inspect() {
      if (abandoned || loaded || !needsNativeViews(doc)) return;
      loaded=true; if (observer) observer.disconnect();
      // Presentation is optional and parallel: never hold native checkout for it.
      if (win.top===win) load('NativeCheckout.js','20261109-native-polish-4');
      load('Checkout2.js','20261109-native-choice-12');
      load('CardContainer.js','20261106-compact-ui-ownership-1');
    }
    function ready() {
      if (abandoned) return;
      inspect();
      if (!loaded && doc.body) {
        observer=new win.MutationObserver(function () {
          if (scheduled || abandoned) return;
          scheduled=true;
          win.setTimeout(function () { scheduled=false; inspect(); },50);
        });
        observer.observe(doc.body,{childList:true,subtree:true});
      }
    }
    if (doc.readyState==='loading') doc.addEventListener('DOMContentLoaded',ready,{once:true}); else ready();
  }
  return {build:BUILD,needsNativeViews:needsNativeViews,boot:boot};
});
