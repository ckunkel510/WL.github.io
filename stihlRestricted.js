
/**
 * WL — Disable online purchase for specific ProductIDs
 * Works on:
 *  - Products.aspx (card sets)
 *  - ProductDetail.aspx (detail page)
 *
 * What it does:
 *  - Disables qty inputs and Add-to-Cart buttons
 *  - Prevents postbacks/clicks
 *  - Shows “This item is not eligible for online purchase.”
 *
 * Add/Remove ProductIDs below.
 */
(function () {
  "use strict";

  // ✅ EDIT THIS LIST
  var BLOCKED_PIDS = [
    3158
    // 1234, 5678, ...
  ].map(String);

  var MSG = "This item is not eligible for online purchase.";

  // ---------- helpers ----------
  function getFirstPidFromUrl(url) {
    if (!url) return null;
    // specifically the FIRST pid= in the string (in case returnUrl includes pid= later)
    var m = String(url).match(/[?&]pid=(\d+)/i);
    return m ? m[1] : null;
  }

  function preventLink(el) {
    if (!el) return;
    try { el.removeAttribute("href"); } catch (e) {}
    el.setAttribute("aria-disabled", "true");
    el.style.pointerEvents = "none";
    el.style.opacity = "0.55";
    el.style.cursor = "not-allowed";
  }

  function disableInput(el) {
    if (!el) return;
    el.disabled = true;
    el.readOnly = true;
    el.setAttribute("aria-disabled", "true");
    el.style.pointerEvents = "none";
    el.style.opacity = "0.6";
    el.style.cursor = "not-allowed";
  }

  function disableButtonsInContainer(container) {
    if (!container) return;
    var btns = container.querySelectorAll("button, input[type='button'], input[type='submit']");
    btns.forEach(function (b) {
      b.disabled = true;
      b.setAttribute("aria-disabled", "true");
      b.style.pointerEvents = "none";
      b.style.opacity = "0.6";
      b.style.cursor = "not-allowed";
    });
  }

  function insertNotice(targetEl, where) {
    if (!targetEl) return;
    // avoid duplicate notices
    var existing = targetEl.parentElement && targetEl.parentElement.querySelector(".wl-not-eligible");
    if (existing) return;

    var note = document.createElement("div");
    note.className = "wl-not-eligible";
    note.textContent = MSG;
    note.style.cssText = [
      "margin-top:8px",
      "padding:8px 10px",
      "border:1px solid #e1e1e1",
      "border-left:4px solid #6b0016",
      "border-radius:6px",
      "background:#fff7f8",
      "color:#6b0016",
      "font-weight:700",
      "text-align:center",
      "font-size:0.95em",
      "line-height:1.2"
    ].join(";");

    if (where === "replace") {
      targetEl.replaceWith(note);
    } else if (where === "after") {
      targetEl.insertAdjacentElement("afterend", note);
    } else {
      // default: before
      targetEl.insertAdjacentElement("beforebegin", note);
    }
  }

  // ---------- ProductDetail.aspx ----------
  function handleProductDetail() {
    var path = (location.pathname || "").toLowerCase();
    if (path.indexOf("productdetail.aspx") === -1) return;

    var pid = getFirstPidFromUrl(location.href);
    if (!pid || BLOCKED_PIDS.indexOf(String(pid)) === -1) return;

    // Add button (your example ID)
    var addBtn = document.getElementById("ctl00_PageBody_productDetail_ctl00_AddProductButton");
    if (addBtn) {
      preventLink(addBtn);
      // Replace the add button with a notice (cleanest)
      insertNotice(addBtn, "replace");
    }

    // Qty input (try exact id pattern first, then fallback)
    var qtyInput =
      document.getElementById("ctl00_PageBody_productDetail_ctl00_qty_" + pid) ||
      document.querySelector("input.productQtyInput") ||
      null;

    if (qtyInput) {
      disableInput(qtyInput);
      // disable +/- buttons near the qty input
      var wrap = qtyInput.closest("div");
      if (wrap) disableButtonsInContainer(wrap);
      // if add button wasn’t found, show message near qty
      if (!document.querySelector(".wl-not-eligible")) insertNotice(qtyInput, "after");
    }

    // If there are any other “Add” links on the detail page (safety net)
    document.querySelectorAll("a[id*='AddProductButton'], a[title*='Add to cart']").forEach(function (a) {
      preventLink(a);
    });
  }

  // ---------- Products.aspx (search cards) ----------
  function handleProductsList() {
    var path = (location.pathname || "").toLowerCase();
    if (path.indexOf("products.aspx") === -1) return;

    // Each card is a fieldset.CardSet
    var cards = document.querySelectorAll("fieldset.CardSet");
    if (!cards.length) return;

    cards.forEach(function (card) {
      // First ProductDetail link in the card is the one we trust
      var link = card.querySelector("a[href*='ProductDetail.aspx?pid='], a[href*='ProductDetail.aspx%3Fpid%3D']");
      if (!link) return;

      var pid = getFirstPidFromUrl(link.getAttribute("href"));
      if (!pid || BLOCKED_PIDS.indexOf(String(pid)) === -1) return;

      // Qty input inside card
      var qty = card.querySelector("input[id*='ProductQuantity'], input[name*='ProductQuantity']");
      if (qty) disableInput(qty);

      // Add button inside card (anchor that triggers postback)
      var add = card.querySelector("a[id*='AddProductButton']");
      if (add) {
        preventLink(add);
        // Replace with notice
        insertNotice(add, "replace");
      } else {
        // fallback: put notice near bottom of card
        var bottom = card.querySelector(".mx-2") || card;
        if (bottom && !bottom.querySelector(".wl-not-eligible")) {
          var dummy = document.createElement("div");
          bottom.appendChild(dummy);
          insertNotice(dummy, "replace");
        }
      }

      // Also disable Quicklist / Stock buttons if you want (optional)
      // var quick = card.querySelector("a[id*='QuickListLink']");
      // if (quick) preventLink(quick);
      // var stock = card.querySelector("a[id*='btnShowStock']");
      // if (stock) preventLink(stock);
    });
  }

  // Run after DOM is ready (no jQuery required)
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

