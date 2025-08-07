
(function(){
  console.log("[AutoNav] Script loaded");

  // ── Cookie utilities ─────────────────────────────────────────────
  function readCookie(name) {
    return document.cookie
      .split(';').map(c => c.trim())
      .find(c => c.startsWith(name + '='))
      ?.split('=')[1] || '';
  }
  function setCookie(name, val) {
    document.cookie = `${name}=${val};path=/`;
    console.log(`[AutoNav] setCookie(${name}=${val})`);
  }
  function clearCookie(name) {
    document.cookie = `${name}=;path=/;expires=Thu,01 Jan 1970 00:00:00 GMT`;
    console.log(`[AutoNav] clearCookie(${name})`);
  }

  // ── ASP.NET AJAX manager, if present ────────────────────────────
  const prm = window.Sys?.WebForms?.PageRequestManager?.getInstance();

  // ── FORWARD: auto‐click “Continue” when pickupSelected=true ──────
  let forwardTimer;
  function tryAutoContinue() {
    console.log("[AutoNav] tryAutoContinue()");
    if (readCookie('pickupSelected') !== 'true') {
      console.log("[AutoNav] pickupSelected≠true → stopping forward");
      clearInterval(forwardTimer);
      prm?.remove_endRequest(tryAutoContinue);
      return;
    }
    const btn = document.getElementById('ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView');
    if (!btn) {
      console.log("[AutoNav] Continue button not found yet");
      return;
    }
    console.log("[AutoNav] Continue found → clicking");
    clearInterval(forwardTimer);
    prm?.remove_endRequest(tryAutoContinue);

    // invoke postback
    const href = btn.getAttribute('href') || '';
    if (href.startsWith('javascript:')) {
      eval(href.replace(/^javascript:/, ''));
    } else {
      btn.click();
    }
    // clear forward flag
    clearCookie('pickupSelected');
  }

  // ── CARD-PAGE BACK: set skipBack=true when user clicks the in-card Back button ─
  function bindCardBackSetter() {
    const cardBackBtn = document.getElementById('ctl00_PageBody_btnBack_CardOnFileView');
    if (!cardBackBtn) {
      console.log("[AutoNav] Card Back button not present");
      return;
    }
    // avoid double-binding
    if (cardBackBtn._autoNavBound) return;
    cardBackBtn._autoNavBound = true;

    cardBackBtn.addEventListener('click', function(){
      console.log("[AutoNav] Card Back clicked → setting skipBack=true");
      setCookie('skipBack','true');
      clearCookie('pickupSelected');
    });
    console.log("[AutoNav] Bound card-page Back setter");
  }

  // ── BACKWARD: when skipBack=true, auto-click BackToCartButton3 on the promo/codes step ─
  let backTimer;
  function trySkipBack() {
    console.log("[AutoNav] trySkipBack()");
    if (readCookie('skipBack') !== 'true') {
      console.log("[AutoNav] skipBack≠true → stopping back automation");
      clearInterval(backTimer);
      prm?.remove_endRequest(trySkipBack);
      return;
    }
    const cartBack = document.getElementById('ctl00_PageBody_BackToCartButton3');
    if (!cartBack) {
      console.log("[AutoNav] BackToCartButton3 not found yet");
      return;
    }
    console.log("[AutoNav] BackToCartButton3 found → clicking");
    clearInterval(backTimer);
    prm?.remove_endRequest(trySkipBack);

    // click the real anchor
    cartBack.click();
    // clear backward flag
    clearCookie('skipBack');
  }

  // ── Initialize everything on DOMContentLoaded & after partial postbacks ────────────
  document.addEventListener('DOMContentLoaded', function(){
    console.log("[AutoNav] DOMContentLoaded");

    // Forward flow
    if (readCookie('pickupSelected') === 'true') {
      forwardTimer = setInterval(tryAutoContinue, 200);
      prm?.add_endRequest(tryAutoContinue);
      console.log("[AutoNav] Forward automation enabled");
    } else {
      console.log("[AutoNav] Forward automation not enabled");
    }

    // Card-page Back setter
    bindCardBackSetter();
    prm?.add_endRequest(bindCardBackSetter);

    // Backward flow
    if (readCookie('skipBack') === 'true') {
      backTimer = setInterval(trySkipBack, 200);
      prm?.add_endRequest(trySkipBack);
      console.log("[AutoNav] Back automation enabled");
    } else {
      console.log("[AutoNav] Back automation not enabled");
    }
  });
})();

