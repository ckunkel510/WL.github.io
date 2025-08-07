(function(){
  console.log("[AutoNav] Script loaded");

  // Cookie helpers
  function readCookie(name) {
    return document.cookie
      .split(';')
      .map(c=>c.trim())
      .find(c=>c.startsWith(name+'='))
      ?.split('=')[1] || '';
  }
  function clearCookie(name) {
    document.cookie = name + '=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    console.log(`[AutoNav] Cleared cookie "${name}"`);
  }

  // ASP.NET AJAX manager (if any)
  const prm = window.Sys?.WebForms?.PageRequestManager?.getInstance();

  // — FORWARD: auto-click Continue when ready —
  let pollTimer;
  function tryAutoContinue() {
    console.log("[AutoNav] tryAutoContinue()");
    if (readCookie('pickupSelected') !== 'true') {
      console.log("[AutoNav] pickupSelected ≠ true, skipping forward");
      return;
    }
    const btn = document.getElementById('ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView');
    if (!btn) {
      console.log("[AutoNav] Continue button not found yet");
      return;
    }
    console.log("[AutoNav] Continue button found", btn);

    clearInterval(pollTimer);
    if (prm) prm.remove_endRequest(tryAutoContinue);

    // fire the postback
    const href = btn.getAttribute('href')||'';
    if (href.startsWith('javascript:')) {
      const js = href.replace(/^javascript:/,'');
      console.log("[AutoNav] eval:", js);
      try { eval(js); }
      catch(e){ console.error(e); }
    } else {
      console.log("[AutoNav] click()");
      btn.click();
    }

    // done
    clearCookie('pickupSelected');
  }

  // — BACKWARD: intercept Back click and reroute —
  function initAutoBack() {
    console.log("[AutoNav] initAutoBack()");
    const backBtn = document.getElementById('ctl00_PageBody_btnBack_CardOnFileView');
    if (!backBtn) {
      console.log("[AutoNav] Back button not present");
      return;
    }
    // remove previous handlers
    backBtn.replaceWith(backBtn.cloneNode(true));
    const fresh = document.getElementById('ctl00_PageBody_btnBack_CardOnFileView');

    fresh.addEventListener('click', function(e){
      console.log("[AutoNav] Back clicked, cookie =", readCookie('pickupSelected'));
      if (readCookie('pickupSelected') === 'true') {
        e.preventDefault();
        const cartBack = document.getElementById('ctl00_PageBody_BackToCartButton3');
        if (cartBack) {
          console.log("[AutoNav] Redirecting to cart Back");
          cartBack.click();
          clearCookie('pickupSelected');
        } else {
          console.warn("[AutoNav] Cart Back link missing");
        }
      }
    });
    console.log("[AutoNav] Back interceptor attached");
  }

  // — Bootstrap on DOM ready & AJAX events —
  document.addEventListener('DOMContentLoaded', function(){
    console.log("[AutoNav] DOMContentLoaded");
    // start forward polling
    pollTimer = setInterval(tryAutoContinue, 200);
    console.log("[AutoNav] Forward poll started");
    if (prm) {
      prm.add_endRequest(tryAutoContinue);
      console.log("[AutoNav] Registered AJAX endRequest for forward");
      prm.add_endRequest(initAutoBack);
      console.log("[AutoNav] Registered AJAX endRequest for back");
    }
    // also attach Back on initial load
    initAutoBack();
  });
})();
