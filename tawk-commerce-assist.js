/* Compatibility loader for cached Woodson headers. The active customer-chat
   runtime uses a neutral filename so browser content filters do not suppress it. */
(function () {
  "use strict";

  if (typeof module === "object" && module.exports) {
    module.exports = require("./wl-chat.js");
    return;
  }

  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.WLTawkCommerceAssist || document.querySelector("script[data-wl-chat-runtime]")) return;

  var script = document.createElement("script");
  script.src = "https://ckunkel510.github.io/WL.github.io/wl-chat.js?v=20260723-6";
  script.async = true;
  script.setAttribute("data-wl-chat-runtime", "true");
  document.head.appendChild(script);
})();
