(function(){
  console.log("[AutoNav] Loaded");

  // ── Cookie utils ────────────────────────────────────────────────
  function readCookie(name) {
    return document.cookie
      .split(';').map(c=>c.trim())
      .find(c=>c.startsWith(name+'='))
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

  // ── AJAX manager if used ────────────────────────────────────────
  const prm = window.Sys?.WebForms?.PageRequestManager?.getInstance();

  // ── FORWARD: auto‐click “Continue” ───────────────────────────────
  let pollTimer;
  function tryAutoContinue() {
    if (readCookie('pickupSelected') !== 'true') {
      clearInterval(pollTimer);
      prm?.remove_endRequest(tryAutoContinue);
      console.log("[AutoNav] pickupSelected≠true → stopping forward");
      return;
    }
    const btn = document.getElementById(
      'ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView'
    );
    if (!btn) return;

    console.log("[AutoNav] Continue found → firing");
    clearInterval(pollTimer);
    prm?.remove_endRequest(tryAutoContinue);

    const href = btn.getAttribute('href')||'';
    if (href.startsWith('javascript:')) {
      eval(href.replace(/^javascript:/,''));
    } else {
      btn.click();
    }

    clearCookie('pickupSelected');
  }

  // ── BACKWARD: intercept card‐page Back ───────────────────────────
  function initAutoBack() {
    const backBtn = document.getElementById('ctl00_PageBody_btnBack_CardOnFileView');
    if (!backBtn) return;
    console.log("[AutoNav] Card Back button found");

    // replace node to drop old handlers
    const fresh = backBtn.cloneNode(true);
    backBtn.parentNode.replaceChild(fresh, backBtn);

    fresh.addEventListener('click', function(e) {
      console.log("[AutoNav] Card Back clicked, skipBack=", readCookie('skipBack'));
      if (readCookie('skipBack') === 'true') {
        e.preventDefault();
        const cartBack = document.getElementById('ctl00_PageBody_BackToCartButton3');
        console.log("[AutoNav] Found cartBack anchor:", cartBack);
        if (cartBack) {
          const href2 = cartBack.getAttribute('href')||'';
          console.log("[AutoNav] Executing cartBack href:", href2);
          if (href2.startsWith('javascript:')) {
            eval(href2.replace(/^javascript:/,''));
          } else {
            cartBack.click();
          }
        } else {
          console.warn("[AutoNav] BackToCartButton3 not found");
        }
        // clear only pickupSelected; leave skipBack for final clear
        clearCookie('pickupSelected');
      }
    });
    console.log("[AutoNav] Card Back interceptor attached");
  }

  // ── FINAL BACK: clear skipBack when BackToCartButton3 is clicked ──
  function initFinalBackClear() {
    const cartBack = document.getElementById('ctl00_PageBody_BackToCartButton3');
    if (!cartBack || cartBack._autoNavBound) return;
    console.log("[AutoNav] Binding final BackToCartButton3 handler");
    cartBack._autoNavBound = true;
    cartBack.addEventListener('click', function(){
      console.log("[AutoNav] Final Back clicked → clearing skipBack");
      clearCookie('skipBack');
    });
  }

  // ── Initialize on load & partial postbacks ───────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    // set up handlers
    initAutoBack();
    initFinalBackClear();

    if (readCookie('pickupSelected') === 'true') {
      pollTimer = setInterval(tryAutoContinue, 200);
      prm?.add_endRequest(tryAutoContinue);
      console.log("[AutoNav] Forward automation enabled");
    } else {
      console.log("[AutoNav] Forward automation not enabled");
    }

    prm?.add_endRequest(initAutoBack);
    prm?.add_endRequest(initFinalBackClear);
  });
})();

