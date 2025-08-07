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
    console.log(`[AutoNav] Cookie ${name}=${val}`);
  }
  function clearCookie(name) {
    document.cookie = `${name}=;path=/;expires=Thu,01 Jan 1970 00:00:00 GMT`;
    console.log(`[AutoNav] Cleared ${name}`);
  }

  // ── AJAX manager if used ────────────────────────────────────────
  const prm = window.Sys?.WebForms?.PageRequestManager?.getInstance();

  // ── FORWARD: auto‐click “Continue” ────────────────────────────────
  let pollTimer;
  function tryAutoContinue() {
    if (readCookie('pickupSelected') !== 'true') {
      clearInterval(pollTimer);
      prm?.remove_endRequest(tryAutoContinue);
      console.log("[AutoNav] pickupSelected=false → stop forward");
      return;
    }
    const btn = document.getElementById(
      'ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView'
    );
    if (!btn) return;

    console.log("[AutoNav] Continue found → click");
    clearInterval(pollTimer);
    prm?.remove_endRequest(tryAutoContinue);

    const href = btn.getAttribute('href')||'';
    if (href.startsWith('javascript:')) {
      eval(href.replace(/^javascript:/,''));
    } else {
      btn.click();
    }

    // clear forward flag only
    clearCookie('pickupSelected');
  }

  // ── BACKWARD: intercept card‐page Back ────────────────────────────
  function initAutoBack() {
    const backBtn = document.getElementById('ctl00_PageBody_btnBack_CardOnFileView');
    if (!backBtn) return;

    // replace to drop old handlers
    const fresh = backBtn.cloneNode(true);
    backBtn.parentNode.replaceChild(fresh, backBtn);

    fresh.addEventListener('click', function(e) {
      if (readCookie('skipBack') !== 'true') return;
      e.preventDefault();

      console.log("[AutoNav] Card-page Back clicked → reroute to cart Back");
      const cartBack = document.getElementById('ctl00_PageBody_BackToCartButton3');
      if (cartBack) {
        const href2 = cartBack.getAttribute('href')||'';
        if (href2.startsWith('javascript:')) {
          eval(href2.replace(/^javascript:/,''));
        } else {
          cartBack.click();
        }
      } else {
        console.warn("[AutoNav] BackToCartButton3 not found");
      }
      // leave skipBack=true — we’ll clear it when the cart-back anchor appears
      clearCookie('pickupSelected');
    });
  }

  // ── Cart-page load: clear skipBack as soon as that anchor is present ─
  function clearSkipOnCartPage() {
    const cartBack = document.getElementById('ctl00_PageBody_BackToCartButton3');
    if (cartBack && readCookie('skipBack') === 'true') {
      console.log("[AutoNav] Cart-page detected → clearing skipBack");
      clearCookie('skipBack');
    }
  }

  // ── Init ───────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    // attach Back interceptor
    initAutoBack();
    prm?.add_endRequest(initAutoBack);

    // start forward automation if pickupSelected=true
    if (readCookie('pickupSelected') === 'true') {
      pollTimer = setInterval(tryAutoContinue, 200);
      prm?.add_endRequest(tryAutoContinue);
      console.log("[AutoNav] Forward automation enabled");
    } else {
      console.log("[AutoNav] Forward automation disabled");
    }

    // clear skipBack when cart-back anchor appears
    clearSkipOnCartPage();
    prm?.add_endRequest(clearSkipOnCartPage);
  });
})();

