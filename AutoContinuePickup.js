(function(){
  console.log("[AutoNav] Script loaded");

  // ── Cookie utils ────────────────────────────────────────────────
  function readCookie(name) {
    return document.cookie
      .split(';').map(c=>c.trim())
      .find(c=>c.startsWith(name+'='))
      ?.split('=')[1] || '';
  }
  function setCookie(name, val) {
    document.cookie = `${name}=${val};path=/`;
  }
  function clearCookie(name) {
    document.cookie = `${name}=;path=/;expires=Thu,01 Jan 1970 00:00:00 GMT`;
  }

  // ── ASP.NET AJAX manager (if any) ────────────────────────────────
  const prm = window.Sys?.WebForms?.PageRequestManager?.getInstance();

  // ── FORWARD: auto‐click Continue ─────────────────────────────────
  let pollTimer;
  function tryAutoContinue() {
    // stop if flag cleared
    if (readCookie('pickupSelected') !== 'true') {
      clearInterval(pollTimer);
      prm?.remove_endRequest(tryAutoContinue);
      console.log("[AutoNav] pickupSelected=false → forward automation stopped");
      return;
    }
    const btn = document.getElementById(
      'ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView'
    );
    if (!btn) return;

    console.log("[AutoNav] Continue button found → auto-clicking");
    clearInterval(pollTimer);
    prm?.remove_endRequest(tryAutoContinue);

    const href = btn.getAttribute('href') || '';
    if (href.startsWith('javascript:')) {
      eval(href.replace(/^javascript:/,''));
    } else {
      btn.click();
    }

    // clear forward flag, disable backward skip
    clearCookie('pickupSelected');
    setCookie('skipBack','false');
  }

  // ── BACKWARD: intercept card-page Back ───────────────────────────
  function initAutoBack() {
    const backBtn = document.getElementById('ctl00_PageBody_btnBack_CardOnFileView');
    if (!backBtn) return;

    // replace to drop old handlers
    const fresh = backBtn.cloneNode(true);
    backBtn.parentNode.replaceChild(fresh, backBtn);

    fresh.addEventListener('click', function(e) {
      if (readCookie('skipBack') !== 'true') return;
      e.preventDefault();

      console.log("[AutoNav] skipBack=true → rerouting cart-back");
      // set skipBack again for next leg, clear forward flag
      setCookie('skipBack','true');
      clearCookie('pickupSelected');

      const cartBack = document.getElementById('ctl00_PageBody_BackToCartButton3');
      if (!cartBack) return console.warn("[AutoNav] BackToCartButton3 missing");

      const href2 = cartBack.getAttribute('href') || '';
      if (href2.startsWith('javascript:')) {
        eval(href2.replace(/^javascript:/,''));
      } else {
        cartBack.click();
      }
    });
  }

  // ── Init on DOM ready & after partial postbacks ─────────────────
  document.addEventListener('DOMContentLoaded', () => {
    // BACK handler always attaches
    initAutoBack();
    if (prm) prm.add_endRequest(initAutoBack);

    // only start forward automation if pickupSelected=true
    if (readCookie('pickupSelected') === 'true') {
      pollTimer = setInterval(tryAutoContinue, 200);
      prm?.add_endRequest(tryAutoContinue);
      console.log("[AutoNav] Forward automation enabled");
    } else {
      console.log("[AutoNav] Forward automation disabled");
    }
  });
})();

