// WL Products.aspx — block online purchase UI by ProductID (shared JSON)
// Pulls list from GitHub-hosted JSON (single source of truth)

const WL_BLOCKLIST_URL = "https://ckunkel510.github.io/WL.github.io/blocked-products.json";

async function wlLoadBlocklist() {
  const fallback = {
    blockedProductIds: [],
    message: "This item is not eligible for online purchase.",
  };

  try {
    const bust = (WL_BLOCKLIST_URL.includes("?") ? "&" : "?") + "v=" + Date.now();
    const res = await fetch(WL_BLOCKLIST_URL + bust, { cache: "no-store" });
    if (!res.ok) {
      console.warn("[WL Blocklist] Fetch failed:", res.status);
      return fallback;
    }

    // If GitHub Pages path is wrong it may return HTML. Guard that.
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const text = await res.text();
    if (!ct.includes("application/json") && text.trim().startsWith("<")) {
      console.warn("[WL Blocklist] Non-JSON response (likely HTML). Check WL_BLOCKLIST_URL.");
      return fallback;
    }

    const json = JSON.parse(text);
    return {
      blockedProductIds: (json.blockedProductIds || json.blockedProductIDs || []).map(String),
      message: (json.message || fallback.message),
    };
  } catch (e) {
    console.warn("[WL Blocklist] Error loading blocklist:", e);
    return fallback;
  }
}

(function () {
  "use strict";

  // Helpers
  function getFirstPidFromUrl(url) {
    if (!url) return null;
    const m = String(url).match(/[?&]pid=(\d+)/i); // first pid=
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

  function insertNoticeNear(el, message, mode) {
    if (!el) return;
    const parent = el.parentElement || document.body;
    if (parent.querySelector(".wl-not-eligible")) return;

    const note = document.createElement("div");
    note.className = "wl-not-eligible";
    note.textContent = message;
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

  async function boot() {
    const path = (location.pathname || "").toLowerCase();
    if (path.indexOf("products.aspx") === -1) return;

    const cfg = await wlLoadBlocklist();
    const BLOCKED_PIDS = (cfg.blockedProductIds || []).map(String);
    const MSG = cfg.message || "This item is not eligible for online purchase.";

    if (!BLOCKED_PIDS.length) {
      console.log("[WL Restricted] No blockedProductIds loaded (list empty).");
      return;
    }

    const cards = document.querySelectorAll("fieldset.CardSet");
    if (!cards.length) return;

    cards.forEach(function (card) {
      const link = card.querySelector("a[href*='ProductDetail.aspx?pid='], a[href*='ProductDetail.aspx%3Fpid%3D']");
      if (!link) return;

      const pid = getFirstPidFromUrl(link.getAttribute("href"));
      if (!pid || BLOCKED_PIDS.indexOf(String(pid)) === -1) return;

      // Hide qty row entirely
      const qtyRow = card.querySelector("#QuantityRow") || card.querySelector("tr[id*='QuantityRow']");
      if (qtyRow) hideEl(qtyRow);
      else {
        const qtyInput = card.querySelector("input[id*='ProductQuantity'], input[name*='ProductQuantity']");
        if (qtyInput) hideEl(qtyInput.closest("td") || qtyInput);
      }

      // Replace Add button with notice
      const add = card.querySelector("a[id*='AddProductButton']");
      if (add) {
        preventLink(add);
        insertNoticeNear(add, MSG, "replace");
      } else {
        const bottom = card.querySelector(".mx-2") || card;
        if (bottom && !bottom.querySelector(".wl-not-eligible")) {
          const dummy = document.createElement("div");
          bottom.appendChild(dummy);
          insertNoticeNear(dummy, MSG, "replace");
        }
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      boot().catch(function (e) {
        console.warn("[WL Restricted] Boot error:", e);
      });
    });
  } else {
    boot().catch(function (e) {
      console.warn("[WL Restricted] Boot error:", e);
    });
  }
})();
