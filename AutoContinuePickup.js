
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
  console.log("[AutoNav] Card-page Back interceptor loaded");

  // ── Cookie helpers ─────────────────────────────────────────────
  function readCookie(name) {
    return document.cookie
      .split(';').map(c=>c.trim())
      .find(c=>c.startsWith(name+'='))
      ?.split('=')[1] || '';
  }
  function clearCookie(name) {
    document.cookie = `${name}=;path=/;expires=Thu,01 Jan 1970 00:00:00 GMT`;
    console.log(`[AutoNav] Cleared ${name}`);
  }

  // ── Bind on DOM ready ───────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function(){
    const cardBack = document.getElementById('ctl00_PageBody_btnBack_CardOnFileView');
    if (!cardBack) {
      console.log("[AutoNav] Card Back button not present");
      return;
    }
    console.log("[AutoNav] Found card Back button");

    cardBack.addEventListener('click', function(e){
      if (readCookie('skipBack') !== 'true') return;

      e.preventDefault();
      console.log("[AutoNav] skipBack=true → firing BackToCart postback directly");

      // Directly invoke the same WebForm postback as BackToCartButton3
      if (window.WebForm_DoPostBackWithOptions) {
        WebForm_DoPostBackWithOptions(
          new WebForm_PostBackOptions(
            'ctl00$PageBody$BackToCartButton3','',true,'','',false,true
          )
        );
      }
      else if (typeof __doPostBack === 'function') {
        __doPostBack('ctl00$PageBody$BackToCartButton3','');
      }
      else {
        console.warn("[AutoNav] Postback API missing—falling back to history.back()");
        history.back();
      }

      // Clear flags so this only runs once
      clearCookie('skipBack');
      clearCookie('pickupSelected');
    });

    console.log("[AutoNav] Card Back interceptor attached");
  });
})();

