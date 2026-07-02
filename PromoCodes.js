// Promotion codes must remain server-authoritative. WebTrack owns the Apply
// postback and recalculates discount, tax, and final order total on the server.
(function () {
  "use strict";

  function markNativePromotionForm() {
    const input = document.getElementById("ctl00_PageBody_PromotionCodeEntry_PromoCodeTextBox");
    if (!input) return;
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocapitalize", "characters");
    input.setAttribute("spellcheck", "false");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", markNativePromotionForm, { once: true });
  } else {
    markNativePromotionForm();
  }

  try {
    const manager = window.Sys && window.Sys.WebForms && window.Sys.WebForms.PageRequestManager
      ? window.Sys.WebForms.PageRequestManager.getInstance()
      : null;
    if (manager) manager.add_endRequest(markNativePromotionForm);
  } catch {}
})();
