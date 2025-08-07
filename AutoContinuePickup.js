
(function(){
  console.log("[AutoNav] Script loaded");

  // ── Cookie utils ────────────────────────────────────────────────
  function readCookie(name) {
    const match = document.cookie
      .split(';').map(c=>c.trim())
      .find(c=>c.startsWith(name+'='));
    const val = match?.split('=')[1] || '';
    console.log(`[AutoNav] readCookie("${name}") → "${val}"`);
    return val;
  }
  function setCookie(name, val) {
    document.cookie = `${name}=${val};path=/`;
    console.log(`[AutoNav] setCookie("${name}", "${val}")`);
  }
  function clearCookie(name) {
    document.cookie = `${name}=;path=/;expires=Thu,01 Jan 1970 00:00:00 GMT`;
    console.log(`[AutoNav] clearCookie("${name}")`);
  }

  // ── AJAX manager if used ────────────────────────────────────────
  const prm = window.Sys?.WebForms?.PageRequestManager?.getInstance();

  // ── FORWARD: auto‐click “Continue” ───────────────────────────────
  let pollTimer;
  function tryAutoContinue() {
    console.log("[AutoNav] tryAutoContinue()");
    if (readCookie('pickupSelected') !== 'true') {
      console.log("[AutoNav] pickupSelected≠true → stopping forward automation");
      clearInterval(pollTimer);
      prm?.remove_endRequest(tryAutoContinue);
      return;
    }
    const btn = document.getElementById(
      'ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView'
    );
    if (!btn) {
      console.log("[AutoNav] Continue button not found yet");
      return;
    }
    console.log("[AutoNav] Continue button found, firing postback");

    clearInterval(pollTimer);
    prm?.remove_endRequest(tryAutoContinue);

    const href = btn.getAttribute('href')||'';
    console.log("[AutoNav] Continue href:", href);
    if (href.startsWith('javascript:')) {
      try {
        eval(href.replace(/^javascript:/,''));
        console.log("[AutoNav] eval(Continue) succeeded");
      } catch(e) {
        console.error("[AutoNav] eval(Continue) failed", e);
      }
    } else {
      btn.click();
      console.log("[AutoNav] btn.click() (Continue) invoked");
    }

    clearCookie('pickupSelected');
  }

  // ── BACKWARD: intercept card‐page Back ───────────────────────────
  function initAutoBack() {
    console.log("[AutoNav] initAutoBack()");
    const backBtn = document.getElementById('ctl00_PageBody_btnBack_CardOnFileView');
    console.log("[AutoNav] Found card Back button:", backBtn);
    if (!backBtn) return;

    // replace node to clear old handlers
    const fresh = backBtn.cloneNode(true);
    backBtn.parentNode.replaceChild(fresh, backBtn);

    fresh.addEventListener('click', function(e) {
      console.log("[AutoNav] Card Back clicked");
      const skip = readCookie('skipBack');
      if (skip !== 'true') {
        console.log("[AutoNav] skipBack≠true → letting default back run");
        return;
      }
      console.log("[AutoNav] skipBack===true → rerouting to cart Back");
      e.preventDefault();

      // Fire the real cart-page back
      const cartBack = document.getElementById('ctl00_PageBody_BackToCartButton3');
      console.log("[AutoNav] cartBack anchor:", cartBack);
      if (cartBack) {
        const href2 = cartBack.getAttribute('href')||'';
        console.log("[AutoNav] cartBack href:", href2);
        if (href2.startsWith('javascript:')) {
          try {
            eval(href2.replace(/^javascript:/,''));
            console.log("[AutoNav] eval(cartBack) succeeded");
          } catch(err) {
            console.error("[AutoNav] eval(cartBack) failed", err);
          }
        } else {
          cartBack.click();
          console.log("[AutoNav] cartBack.click() invoked");
        }
      } else {
        console.warn("[AutoNav] Could not find BackToCartButton3");
      }

      // leave skipBack=true ➔ clear only after cart page loads
      clearCookie('pickupSelected');
    });
    console.log("[AutoNav] Back interceptor attached");
  }

  // ── Clear skipBack when cart-back anchor appears ────────────────
  function clearSkipOnCartPage() {
    console.log("[AutoNav] clearSkipOnCartPage()");
    const cartBack = document.getElementById('ctl00_PageBody_BackToCartButton3');
    console.log("[AutoNav] Found cartBack anchor:", cartBack);
    if (cartBack && readCookie('skipBack') === 'true') {
      console.log("[AutoNav] skipBack===true on cart page → clearing skipBack");
      clearCookie('skipBack');
    }
  }

  // ── Initialize on load & partial postbacks ───────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    console.log("[AutoNav] DOMContentLoaded");

    // Back handler
    initAutoBack();
    prm?.add_endRequest(initAutoBack);

    // Forward automation if flagged
    if (readCookie('pickupSelected') === 'true') {
      console.log("[AutoNav] kickoff forward automation");
      pollTimer = setInterval(tryAutoContinue, 200);
      prm?.add_endRequest(tryAutoContinue);
    } else {
      console.log("[AutoNav] forward automation not enabled");
    }

    // Clear skipBack on cart page load
    clearSkipOnCartPage();
    prm?.add_endRequest(clearSkipOnCartPage);
  });
})();

