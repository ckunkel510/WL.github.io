(function(){
  console.log("[AutoContinue] Script loaded");

  // Helper to read a cookie by name
  function readCookie(name) {
    const match = document.cookie
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith(name + '='));
    const val = match?.split('=')[1];
    console.log(`[AutoContinue] Cookie "${name}" =`, val);
    return val;
  }

  // will hold our polling timer
  let pollTimer;

  // ASP.NET AJAX PageRequestManager (if present)
  const prm = window.Sys?.WebForms?.PageRequestManager?.getInstance();

  // endRequest handler reference so we can remove it later
  const endRequestHandler = function() {
    console.log("[AutoContinue] endRequest fired");
    tryAutoContinue();
  };

  // Attempt to find & fire the Continue button postback
  function tryAutoContinue() {
    console.log("[AutoContinue] tryAutoContinue()");
    // only run when pickupSelected is true
    if (readCookie('pickupSelected') !== 'true') {
      console.log("[AutoContinue] pickupSelected ≠ 'true', skipping");
      return;
    }

    const btn = document.getElementById('ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView');
    if (!btn) {
      console.log("[AutoContinue] Continue button not in DOM yet");
      return;
    }
    console.log("[AutoContinue] Continue button found", btn);

    // SUCCESS: stop further polling and AJAX hooks
    clearInterval(pollTimer);
    console.log("[AutoContinue] Polling stopped");
    if (prm && endRequestHandler) {
      prm.remove_endRequest(endRequestHandler);
      console.log("[AutoContinue] Unregistered endRequest handler");
    }

    // execute the postback JavaScript if present
    const href = btn.getAttribute('href') || '';
    console.log("[AutoContinue] href:", href);

    if (href.startsWith('javascript:')) {
      const js = href.replace(/^javascript:/, '');
      console.log("[AutoContinue] Executing:", js);
      try {
        eval(js);
        console.log("[AutoContinue] eval succeeded");
      } catch (e) {
        console.error("[AutoContinue] eval failed", e);
      }
    } else {
      console.log("[AutoContinue] Falling back to btn.click()");
      try {
        btn.click();
        console.log("[AutoContinue] click() succeeded");
      } catch (e) {
        console.error("[AutoContinue] click() failed", e);
      }
    }
  }

  // Start when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    console.log("[AutoContinue] DOMContentLoaded");
    // begin polling every 200ms
    pollTimer = setInterval(tryAutoContinue, 200);
    console.log("[AutoContinue] pollTimer started");

    // hook AJAX partial-postback if available
    if (prm) {
      prm.add_endRequest(endRequestHandler);
      console.log("[AutoContinue] endRequest handler registered");
    }
  });
})();


(function(){
  // Helper to read a cookie by name
  function readCookie(name) {
    const match = document.cookie
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith(name + '='));
    return match?.split('=')[1] || '';
  }

  // Wire up the “Back” redirect
  function initAutoBack() {
    const backBtn = document.getElementById('ctl00_PageBody_btnBack_CardOnFileView');
    if (!backBtn) {
      console.log('[AutoBack] Back button not found');
      return;
    }

    backBtn.addEventListener('click', function(e) {
      if (readCookie('pickupSelected') === 'true') {
        e.preventDefault(); // cancel the normal back
        const cartBack = document.getElementById('ctl00_PageBody_BackToCartButton3');
        if (cartBack) {
          console.log('[AutoBack] pickupSelected=true → clicking BackToCartButton3');
          cartBack.click();
        } else {
          console.warn('[AutoBack] BackToCartButton3 not found');
        }
      }
    });
    console.log('[AutoBack] Listener attached to btnBack_CardOnFileView');
  }

  // Run on DOM ready and after any ASP.NET partial postback
  document.addEventListener('DOMContentLoaded', () => {
    initAutoBack();
    if (window.Sys?.WebForms?.PageRequestManager) {
      window.Sys.WebForms.PageRequestManager
        .getInstance()
        .add_endRequest(initAutoBack);
    }
  });
})();

