/* Opt-in visibility test for WebTrack's existing native promotion form. */
(function (root, factory) {
  'use strict';
  var core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else core.boot(root);
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  var STYLE_ID = 'wl-native-promo-test-style';
  function requested(win) {
    try {
      var url = new URL(win.location.href);
      return win.top === win && url.origin === 'https://webtrack.woodsonlumber.com' &&
        /^\/ShoppingCart\.aspx$/i.test(url.pathname) &&
        url.searchParams.getAll('wl_native_promo_test').length === 1 &&
        url.searchParams.get('wl_native_promo_test') === '1';
    } catch (_) { return false; }
  }
  function reveal(doc) {
    var input = doc.getElementById('ctl00_PageBody_PromotionCodeEntry_PromoCodeTextBox');
    var apply = doc.getElementById('ctl00_PageBody_PromotionCodeEntry_ApplyPromotionalCodeButton');
    var shipping = doc.getElementById('ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView');
    if (!input || !apply || !shipping) return false;
    if (!doc.getElementById(STYLE_ID)) {
      var style = doc.createElement('style'); style.id = STYLE_ID;
      style.textContent = '#ctl00_PageBody_PromoCodeEntryInputTH,#ctl00_PageBody_PromoCodeEntryInputTD{display:table-cell!important;padding:12px!important;text-align:left!important;vertical-align:middle}' +
        '#PromoCodeEntry input[type="text"]{box-sizing:border-box;min-height:44px;width:min(100%,320px);max-width:100%}' +
        '#ctl00_PageBody_PromotionCodeEntry_ApplyPromotionalCodeButton{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;margin:4px}' +
        '@media(max-width:600px){#ctl00_PageBody_PromoCodeEntryInputTH,#ctl00_PageBody_PromoCodeEntryInputTD{display:block!important;width:auto!important}#PromoCodeEntry table{width:100%;table-layout:fixed}}';
      doc.head.appendChild(style);
    }
    if (!input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby')) input.setAttribute('aria-label', 'Promotion code');
    return true;
  }
  function boot(win) {
    if (!requested(win) || win.WLNativePromoTest) return;
    win.WLNativePromoTest = {build:'20261113-native-promo-test-1'};
    var ready = function () { reveal(win.document); };
    if (win.document.readyState === 'loading') win.document.addEventListener('DOMContentLoaded', ready, {once:true});
    else ready();
    try { win.Sys?.WebForms?.PageRequestManager?.getInstance()?.add_endRequest(ready); } catch (_) {}
  }
  return {requested:requested,reveal:reveal,boot:boot};
});
