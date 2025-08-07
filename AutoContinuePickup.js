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

  // ── ASP.NET AJAX manager ────────────────────────────────────────
  const prm = window.Sys?.WebForms?.PageRequestManager?.getInstance();

  // ── FORWARD: auto-click Continue ─────────────────────────────────
  let pollTimer;
  function tryAutoContinue() {
    console.log("[AutoNav] tryAutoContinue()");
    if (readCookie('pickupSelected') !== 'true') {
      console.log("[AutoNav] pickupSelected≠true → stop forward automation");
      clearInterval(pollTimer);
      prm?.remove_endRequest(tryAutoContinue);
      return;
    }
    const btn = document.getElementById(
      'ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView'
    );
    if (!btn) {
      console.log("[AutoNav] Continue button missing");
      return;
    }
    console.log("[AutoNav] Continue found — firing postback");

    clearInterval(pollTimer);
    prm?.remove_endRequest(tryAutoContinue);

    const href = btn.getAttribute('href')||'';
    if (href.startsWith('javascript:')) {
      eval(href.replace(/^javascript:/,''));
    } else {
      btn.click();
    }

    // Clear only the forward flag; leave skipBack=true
    clearCookie('pickupSelected');
  }

  // ── BACKWARD: intercept card-page Back ───────────────────────────
  function initAutoBack() {
    console.log("[AutoNav] initAutoBack()");
    const backBtn = document.getElementById('ctl00_PageBody_btnBack_CardOnFileView');
    console.log("[AutoNav] backBtn:", backBtn);
    if (!backBtn) return;

    // Clear old handlers by replacing
    const fresh = backBtn.cloneNode(true);
    backBtn.parentNode.replaceChild(fresh, backBtn);

    fresh.addEventListener('click', function(e) {
      console.log("[AutoNav] Card Back clicked, skipBack=", readCookie('skipBack'));
      if (readCookie('skipBack') === 'true') {
        e.preventDefault();

        // Fire the cart‐page Back anchor
        const cartBack = document.getElementById('ctl00_PageBody_BackToCartButton3');
        console.log("[AutoNav] cartBack:", cartBack);
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

        // Clear skipBack so we don't loop
        clearCookie('skipBack');
      }
    });
    console.log("[AutoNav] Back interceptor attached");
  }

  // ── Initialize on DOM ready & partial postbacks ──────────────────
  document.addEventListener('DOMContentLoaded', () => {
    // Back handler
    initAutoBack();
    prm?.add_endRequest(initAutoBack);

    // Forward automation only if pickupSelected=true
    if (readCookie('pickupSelected') === 'true') {
      pollTimer = setInterval(tryAutoContinue, 200);
      prm?.add_endRequest(tryAutoContinue);
      console.log("[AutoNav] Forward automation enabled");
    } else {
      console.log("[AutoNav] Forward automation disabled");
    }
  });
})();

