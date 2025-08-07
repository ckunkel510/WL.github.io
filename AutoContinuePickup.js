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
    document.cookie = `${name}=${val}; path=/`;
    console.log(`[AutoNav] Cookie ${name}=${val}`);
  }
  function clearCookie(name) {
    document.cookie = `${name}=; path=/; expires=Thu,01 Jan 1970 00:00:00 GMT`;
    console.log(`[AutoNav] Cleared ${name}`);
  }

  // ── ASP.NET AJAX manager (if any) ────────────────────────────────
  const prm = window.Sys?.WebForms?.PageRequestManager?.getInstance();

  // ── FORWARD: auto-click Continue ─────────────────────────────────
  let pollTimer;
  function tryAutoContinue() {
    console.log("[AutoNav] tryAutoContinue()");
    if (readCookie('pickupSelected') !== 'true') {
      console.log("[AutoNav] pickupSelected≠true → skip forward");
      return;
    }
    const btn = document.getElementById(
      'ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView'
    );
    if (!btn) {
      console.log("[AutoNav] Continue button missing");
      return;
    }
    console.log("[AutoNav] Continue found → firing");

    clearInterval(pollTimer);
    prm?.remove_endRequest(tryAutoContinue);

    // fire the postback
    const href = btn.getAttribute('href')||'';
    if (href.startsWith('javascript:')) {
      eval(href.replace(/^javascript:/,''));
    } else {
      btn.click();
    }

    // now clear pickupSelected, disable backward skip
    clearCookie('pickupSelected');
    setCookie('skipBack', 'false');
  }

  // ── BACKWARD: intercept first Back click on the card page ─────────
  function initAutoBack() {
    console.log("[AutoNav] initAutoBack()");
    const backBtn = document.getElementById('ctl00_PageBody_btnBack_CardOnFileView');
    if (!backBtn) {
      console.log("[AutoNav] Card Back button missing");
      return;
    }
    // replace to clear old handlers
    const fresh = backBtn.cloneNode(true);
    backBtn.parentNode.replaceChild(fresh, backBtn);

    fresh.addEventListener('click', function(e) {
      console.log("[AutoNav] Card Back clicked, skipBack=", readCookie('skipBack'));
      if (readCookie('skipBack') === 'true') {
        e.preventDefault();
        // set skipBack true for the next target-back page
        setCookie('skipBack','true');
        // clear pickupSelected so forward won’t fire
        clearCookie('pickupSelected');

        const cartBack = document.getElementById('ctl00_PageBody_BackToCartButton3');
        console.log("[AutoNav] Redirecting to cart Back →", cartBack);
        if (cartBack) {
          const href2 = cartBack.getAttribute('href')||'';
          if (href2.startsWith('javascript:')) {
            eval(href2.replace(/^javascript:/,''));
          } else {
            cartBack.click();
          }
        } else {
          console.warn("[AutoNav] Cart BackToCartButton3 missing");
        }
      }
    });
    console.log("[AutoNav] Card Back handler attached");
  }

  // ── Initialize on load & partial-postbacks ────────────────────────
  document.addEventListener('DOMContentLoaded', function(){
    pollTimer = setInterval(tryAutoContinue, 200);
    prm?.add_endRequest(tryAutoContinue);

    initAutoBack();
    prm?.add_endRequest(initAutoBack);
  });
})();
