// Checkout navigation is owned by Checkout2.js and DeliveryOptions.js.
// Do not auto-submit the delivery/promotion screen: it must remain available
// whenever WebTrack presents shipping choices or a promotion-code field.
(function () {
  "use strict";

  function clearLegacyBackFlag() {
    document.cookie = "skipBack=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", clearLegacyBackFlag, { once: true });
  } else {
    clearLegacyBackFlag();
  }
})();
