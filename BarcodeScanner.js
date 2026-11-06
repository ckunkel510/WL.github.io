/* Prefer the modern header scanner; retain the original scanner only as a fallback. */
(function () {
  "use strict";
  var file = window.location.pathname.split("/").pop().toLowerCase();
  if (file !== "products.aspx" && file !== "productdetail.aspx") return;
  if (!/Android|iPhone|iPad|iPod|Windows Phone|BlackBerry|Mobile/i.test(navigator.userAgent)) return;
  if (window.__WL_BARCODE_HANDOFF__) return;
  window.__WL_BARCODE_HANDOFF__ = true;

  var source = document.currentScript && document.currentScript.src;
  var legacyURL = new URL("legacy/BarcodeScanner.js?v=20261106-scanner-fallback-1", source || "https://ckunkel510.github.io/WL.github.io/BarcodeScanner.js").href;
  var quaggaURL = "https://unpkg.com/quagga@0.12.1/dist/quagga.min.js";
  var observer, timer, libraryTimer, header, pendingLibrary;
  var cancelled = false;
  var fallingBack = false;

  function hasScanner() {
    return !!document.getElementById("barcode-scanner-container");
  }
  function stopWaiting() {
    window.clearTimeout(timer);
    if (observer) observer.disconnect();
    if (header) header.removeEventListener("error", fallback);
    document.removeEventListener("DOMContentLoaded", waitForHeader);
  }
  function finishLibrary() {
    window.clearTimeout(libraryTimer);
    if (pendingLibrary) {
      pendingLibrary.removeEventListener("load", useLegacy);
      pendingLibrary.removeEventListener("error", libraryFailed);
    }
  }
  function useLegacy() {
    finishLibrary();
    if (cancelled || hasScanner() || !window.Quagga) return;
    var script = document.createElement("script");
    script.src = legacyURL;
    script.async = false;
    script.setAttribute("data-wl-barcode-legacy", "true");
    document.head.appendChild(script);
  }
  function libraryFailed() {
    finishLibrary();
    if (pendingLibrary && !window.Quagga) pendingLibrary.remove();
  }
  function fallback() {
    if (cancelled || fallingBack) return;
    stopWaiting();
    if (hasScanner()) return;
    if (!document.getElementById("ctl00_PageHeader_GlobalSearchControl_RadSearchBox1")) return;
    fallingBack = true;
    if (window.Quagga) { useLegacy(); return; }
    pendingLibrary = Array.prototype.find.call(document.querySelectorAll("script[src]"), function (script) {
      return script.src.split("?")[0] === quaggaURL;
    });
    var existing = !!pendingLibrary;
    if (!pendingLibrary) {
      pendingLibrary = document.createElement("script");
      pendingLibrary.src = quaggaURL;
      pendingLibrary.async = true;
    }
    pendingLibrary.setAttribute("data-wl-quagga", "true");
    pendingLibrary.addEventListener("load", useLegacy);
    pendingLibrary.addEventListener("error", libraryFailed);
    libraryTimer = window.setTimeout(libraryFailed, 12000);
    if (!existing) document.head.appendChild(pendingLibrary);
  }
  function waitForHeader() {
    if (cancelled || hasScanner()) { stopWaiting(); return; }
    header = document.getElementById("wl-header-locations-test");
    if (header) header.addEventListener("error", fallback);
    if (window.MutationObserver) {
      observer = new window.MutationObserver(function () { if (hasScanner()) stopWaiting(); });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    timer = window.setTimeout(fallback, 8000);
  }
  window.addEventListener("pagehide", function () {
    cancelled = true;
    stopWaiting();
    finishLibrary();
  }, { once: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", waitForHeader, { once: true });
  else waitForHeader();
})();
