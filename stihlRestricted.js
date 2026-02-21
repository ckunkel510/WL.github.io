// ===== shared blocked list loader (GitHub raw JSON) =====
const WL_BLOCKLIST_URL =
  "https://ckunkel510.github.io/WL.github.io/blocked-products.json";

async function wlLoadBlocklist() {
  // fallback if fetch fails
  const fallback = {
    blockedProductIds: [],
    message: "This item is not eligible for online purchase.",
  };

  try {
    // cache-bust so updates apply immediately
    const url = WL_BLOCKLIST_URL + "?v=" + Date.now();
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return fallback;

    const json = await res.json();
    return {
      blockedProductIds: (json.blockedProductIds || json.blockedProductIDs || []).map(String),
      message: (json.message || fallback.message),
    };
  } catch (e) {
    return fallback;
  }
}
/**
 * WL — Block online purchase UI for specific ProductIDs
 * Updates from previous version:
 *  - Hides qty inputs entirely (Products.aspx + ProductDetail.aspx)
 *  - Replaces Add button area with a notice
 *  - On ProductDetail.aspx: hides the *Delivery* method box (leaves Pickup visible)
 *
 * ✅ EDIT BLOCKED_PIDS
 */
(function () {
  "use strict";

  // ✅ EDIT THIS LIST
  const cfg = await wlLoadBlocklist();
const BLOCKED_PIDS = cfg.blockedProductIds;

function isBlocked(pid) {
  return pid && BLOCKED_PIDS.includes(String(pid));
}

  // ---------------- helpers ----------------
  function getFirstPidFromUrl(url) {
    if (!url) return null;
    var m = String(url).match(/[?&]pid=(\d+)/i); // first pid=
    return m ? m[1] : null;
  }

  function hideEl(el) {
    if (!el) return;
    el.style.display = "none";
  }

  function preventLink(el) {
    if (!el) return;
    try { el.removeAttribute("href"); } catch (e) {}
    el.setAttribute("aria-disabled", "true");
    el.style.pointerEvents = "none";
    el.style.opacity = "0.55";
    el.style.cursor = "not-allowed";
  }

  function insertNoticeNear(el, mode) {
    if (!el) return;
    var parent = el.parentElement || document.body;
    if (parent.querySelector(".wl-not-eligible")) return;

    var note = document.createElement("div");
    note.className = "wl-not-eligible";
    note.textContent = MSG;
    note.style.cssText = [
      "margin-top:8px",
      "padding:10px 12px",
      "border:1px solid #e1e1e1",
      "border-left:4px solid #6b0016",
      "border-radius:8px",
      "background:#fff7f8",
      "color:#6b0016",
      "font-weight:800",
      "text-align:center",
      "font-size:0.95em",
      "line-height:1.2"
    ].join(";");

    if (mode === "replace") el.replaceWith(note);
    else if (mode === "after") el.insertAdjacentElement("afterend", note);
    else el.insertAdjacentElement("beforebegin", note);
  }

  function closestQtyGroupFromInput(input) {
    // On ProductDetail you have +/- buttons wrapped with the input in a small inline-flex div.
    // We'll hide the tightest wrapper that looks like the control group.
    if (!input) return null;
    // Prefer the inline-flex wrapper that contains both buttons + input
    var inline = input.closest("div");
    return inline || input.parentElement;
  }

  // ---------------- ProductDetail.aspx ----------------
  function handleProductDetail() {
    var path = (location.pathname || "").toLowerCase();
    if (path.indexOf("productdetail.aspx") === -1) return;

    var pid = getFirstPidFromUrl(location.href);
    if (!pid || BLOCKED_PIDS.indexOf(String(pid)) === -1) return;

    // 1) Hide qty group entirely (input + +/-)
    var qtyInput =
      document.getElementById("ctl00_PageBody_productDetail_ctl00_qty_" + pid) ||
      document.querySelector("input.productQtyInput");

    if (qtyInput) {
      var qtyGroup = closestQtyGroupFromInput(qtyInput);
      hideEl(qtyGroup);
    }

    // 2) Replace Add-to-Cart button with notice
    var addBtn = document.getElementById("ctl00_PageBody_productDetail_ctl00_AddProductButton")
      || document.querySelector("a[id*='AddProductButton'][href*='WebForm_DoPostBackWithOptions']");
    if (addBtn) {
      preventLink(addBtn);
      insertNoticeNear(addBtn, "replace");
    } else if (qtyInput && !document.querySelector(".wl-not-eligible")) {
      insertNoticeNear(qtyInput, "after");
    }

    // 3) Hide the Delivery method box, keep Pickup
    // Target: the method-box with <strong>Delivery</strong>
    document.querySelectorAll(".method-box").forEach(function (box) {
      var strong = box.querySelector("strong");
      var label = strong ? strong.textContent.trim().toLowerCase() : "";
      if (label === "delivery") hideEl(box);
    });

    // Also, if the container ends up with only Pickup, we can tighten spacing a bit (optional)
    var methodRow = document.querySelector("div[style*='margin-bottom: 10px'][style*='gap: 10px']");
    if (methodRow) methodRow.style.justifyContent = "flex-start";
  }

  // ---------------- Products.aspx ----------------
  function handleProductsList() {
    var path = (location.pathname || "").toLowerCase();
    if (path.indexOf("products.aspx") === -1) return;

    var cards = document.querySelectorAll("fieldset.CardSet");
    if (!cards.length) return;

    cards.forEach(function (card) {
      // trust the first ProductDetail link in the card
      var link = card.querySelector("a[href*='ProductDetail.aspx?pid='], a[href*='ProductDetail.aspx%3Fpid%3D']");
      if (!link) return;

      var pid = getFirstPidFromUrl(link.getAttribute("href"));
      if (!pid || BLOCKED_PIDS.indexOf(String(pid)) === -1) return;

      // 1) Hide qty row (more reliable than just the input)
      var qtyRow = card.querySelector("#QuantityRow") || card.querySelector("tr[id*='QuantityRow']");
      if (qtyRow) hideEl(qtyRow);
      else {
        // fallback: hide the input wrapper if row not found
        var qtyInput = card.querySelector("input[id*='ProductQuantity'], input[name*='ProductQuantity']");
        if (qtyInput) hideEl(qtyInput.closest("td") || qtyInput);
      }

      // 2) Replace Add button with notice
      var add = card.querySelector("a[id*='AddProductButton']");
      if (add) {
        preventLink(add);
        insertNoticeNear(add, "replace");
      } else {
        // fallback: put notice at bottom of card controls
        var bottom = card.querySelector(".mx-2") || card;
        if (bottom && !bottom.querySelector(".wl-not-eligible")) {
          var dummy = document.createElement("div");
          bottom.appendChild(dummy);
          insertNoticeNear(dummy, "replace");
        }
      }
    });
  }

  function boot() {
    try { handleProductDetail(); } catch (e) {}
    try { handleProductsList(); } catch (e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
