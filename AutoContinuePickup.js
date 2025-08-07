
(function(){
  console.log("[AutoNav-Forward] Script loaded");

  // ── Cookie helpers ─────────────────────────────────────────────
  function readCookie(name) {
    return document.cookie
      .split(';').map(c=>c.trim())
      .find(c=>c.startsWith(name+'='))
      ?.split('=')[1] || '';
  }
  function clearCookie(name) {
    document.cookie = `${name}=;path=/;expires=Thu,01 Jan 1970 00:00:00 GMT`;
    console.log(`[AutoNav-Forward] Cleared ${name}`);
  }

  // ── Hunt + fire the Continue postback ───────────────────────────
  function tryAutoContinue() {
    console.log("[AutoNav-Forward] tryAutoContinue()");
    if (readCookie('pickupSelected') !== 'true') {
      console.log("[AutoNav-Forward] pickupSelected≠true → stopping");
      clearInterval(timer);
      return;
    }
    const btn = document.getElementById(
      'ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView'
    );
    if (!btn) {
      console.log("[AutoNav-Forward] Continue button not found yet");
      return;
    }
    console.log("[AutoNav-Forward] Continue found → firing postback");

    clearInterval(timer);

    // Use the same WebForm_PostBackOptions as the anchor
    if (window.WebForm_DoPostBackWithOptions) {
      WebForm_DoPostBackWithOptions(
        new WebForm_PostBackOptions(
          'ctl00$PageBody$btnContinue_DeliveryAndPromotionCodesView',
          '', true, '', '', false, true
        )
      );
      console.log("[AutoNav-Forward] WebForm_DoPostBackWithOptions called");
    }
    else if (typeof __doPostBack === 'function') {
      __doPostBack('ctl00$PageBody$btnContinue_DeliveryAndPromotionCodesView','');
      console.log("[AutoNav-Forward] __doPostBack called");
    }
    else {
      btn.click();
      console.log("[AutoNav-Forward] btn.click() fallback");
    }

    // clear the flag so this only runs once
    clearCookie('pickupSelected');
  }

  // ── Kick off polling on DOM ready ────────────────────────────────
  let timer;
  document.addEventListener('DOMContentLoaded', function(){
    if (readCookie('pickupSelected') === 'true') {
      console.log("[AutoNav-Forward] pickupSelected=true → starting forward poll");
      timer = setInterval(tryAutoContinue, 200);
    } else {
      console.log("[AutoNav-Forward] pickupSelected≠true → forward disabled");
    }
  });
})();




(function(){
  console.log("[AutoNav-Promo] loaded");

  // ── Cookie utils ────────────────────────────────────────────────
  function readCookie(name) {
    const m = document.cookie
      .split(';').map(c=>c.trim())
      .find(c=>c.startsWith(name+'='));
    const v = m?.split('=')[1] || '';
    console.log(`[AutoNav-Promo] readCookie("${name}") → "${v}"`);
    return v;
  }
  function clearCookie(name) {
    document.cookie = `${name}=;path=/;expires=Thu,01 Jan 1970 00:00:00 GMT`;
    console.log(`[AutoNav-Promo] clearCookie("${name}")`);
  }

  // ── Try to find & click the real Back-to-Cart button ─────────────
  let timer;
  function trySkipBack() {
    console.log("[AutoNav-Promo] trySkipBack()");
    if (readCookie('skipBack') !== 'true') {
      console.log("[AutoNav-Promo] skipBack≠true → stopping");
      clearInterval(timer);
      return;
    }
    const btn = document.getElementById('ctl00_PageBody_BackToCartButton3');
    if (!btn) {
      console.log("[AutoNav-Promo] BackToCartButton3 not in DOM yet");
      return;
    }
    console.log("[AutoNav-Promo] Found BackToCartButton3 → clicking");
    clearInterval(timer);

    // fire the ASP.NET postback by clicking it
    btn.click();

    // clear the flag so it won’t run again
    clearCookie('skipBack');
  }

  // ── Bootstrap on DOM ready & after partial postbacks ─────────────
  document.addEventListener('DOMContentLoaded', function(){
    console.log("[AutoNav-Promo] DOMContentLoaded");
    // Start polling
    timer = setInterval(trySkipBack, 200);

    // Also hook into ASP.NET AJAX updates
    if (window.Sys?.WebForms?.PageRequestManager) {
      Sys.WebForms.PageRequestManager
        .getInstance()
        .add_endRequest(trySkipBack);
      console.log("[AutoNav-Promo] Registered endRequest handler");
    }
  });
})();



