(function(){
  console.log("[AutoNav] Script loaded");

  // ── Cookie helpers ─────────────────────────────────────────────
  function readCookie(name) {
    return document.cookie
      .split(';').map(c=>c.trim())
      .find(c=>c.startsWith(name+'='))
      ?.split('=')[1] || '';
  }
  function clearCookie(name) {
    document.cookie = name + '=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    console.log(`[AutoNav] Cleared cookie "${name}"`);
  }

  // ── ASP.NET AJAX manager (if any) ─────────────────────────────
  const prm = window.Sys?.WebForms?.PageRequestManager?.getInstance();

  // ── FORWARD: auto‐click Continue ───────────────────────────────
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

    const href = btn.getAttribute('href')||'';
    console.log("[AutoNav] executing forward:", href);
    if (href.startsWith('javascript:')) {
      try { eval(href.replace(/^javascript:/,'')); }
      catch(e){ console.error(e); }
    } else {
      btn.click();
    }

    clearCookie('pickupSelected');
  }

  // ── BACKWARD: intercept Back and reroute ────────────────────────
  function initAutoBack() {
    console.log("[AutoNav] initAutoBack()");
    const backBtn = document.getElementById('ctl00_PageBody_btnBack_CardOnFileView');
    console.log("[AutoNav] backBtn element:", backBtn);
    if (!backBtn) return;

    // replace to remove old handlers
    const fresh = backBtn.cloneNode(true);
    backBtn.parentNode.replaceChild(fresh, backBtn);

    fresh.addEventListener('click', function(e){
      console.log("[AutoNav] Back clicked, pickupSelected =", readCookie('pickupSelected'));
      if (readCookie('pickupSelected') === 'true') {
        e.preventDefault();
        const cartBack = document.getElementById('ctl00_PageBody_BackToCartButton3');
        console.log("[AutoNav] cartBack element:", cartBack);
        if (cartBack) {
          const href2 = cartBack.getAttribute('href')||'';
          console.log("[AutoNav] executing back:", href2);
          if (href2.startsWith('javascript:')) {
            try { eval(href2.replace(/^javascript:/,'')); }
            catch(err){ console.error(err); }
          } else {
            cartBack.click();
          }
          clearCookie('pickupSelected');
        } else {
          console.warn("[AutoNav] BackToCartButton3 not found");
        }
      }
    });
    console.log("[AutoNav] Back interceptor attached");
  }

  // ── Initialize on DOM ready & after any partial postback ───────
  document.addEventListener('DOMContentLoaded', function(){
    console.log("[AutoNav] DOMContentLoaded");
    pollTimer = setInterval(tryAutoContinue, 200);
    console.log("[AutoNav] Forward poll started");
    initAutoBack();
    if (prm) {
      prm.add_endRequest(tryAutoContinue);
      prm.add_endRequest(initAutoBack);
      console.log("[AutoNav] AJAX handlers registered");
    }
  });
})();

