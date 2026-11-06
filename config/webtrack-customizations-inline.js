// Drop-in replacement for WebTrack’s existing merged customization script block.
// Preserve the separate CSS loader and root header loader blocks.
(function () {
  "use strict";

  // ---------------- helpers ----------------
  const path = window.location.pathname.toLowerCase();

  const onReady = (fn) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  };

  const isPath = (file) => path.split("/").pop() === file.toLowerCase();

  const loadScriptOnce = (() => {
    const loaded = new Set();
    return (src, { defer = true, async = false, logPrefix = null } = {}) => {
      if (!src) return;
      if (loaded.has(src)) return;
      loaded.add(src);

      if (logPrefix) console.log(`${logPrefix} Loading: ${src}`);

      const s = document.createElement("script");
      s.src = src;
      if (defer) s.defer = true;
      if (async) s.async = true;
      document.head.appendChild(s);
    };
  })();

  const loadCssOnce = (() => {
    const loaded = new Set();
    return (href) => {
      if (!href) return;
      if (loaded.has(href)) return;
      loaded.add(href);

      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = href;
      document.head.appendChild(l);
    };
  })();

  const setIframeIdInside = (containerId, newIframeId) => {
    const div = document.getElementById(containerId);
    if (!div) return;
    const iframe = div.querySelector("iframe");
    if (!iframe) return;
    iframe.id = newIframeId; // NOTE: if both containers exist simultaneously, duplicate IDs are invalid HTML
  };

  const getCookie = (name) => {
    return document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(name + "="))
      ?.split("=")[1];
  };

  const setCookie = (name, value, maxAgeSeconds) => {
    document.cookie = `${name}=${value}; path=/; max-age=${maxAgeSeconds}`;
  };

  const clearCookie = (name) => {
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;`;
  };

  // ---------------- page flags ----------------
  const isProductDetail  = isPath("ProductDetail.aspx");
  const isProducts       = isPath("Products.aspx");
  const isShoppingCart   = isPath("ShoppingCart.aspx");
  const isAccountInfo    = isPath("AccountInfo_R.aspx");
  const isOpenOrders     = isPath("OpenOrders_r.aspx");
 const isOpenQuotes     = isPath("OpenQuotes_r.aspx");
  const isInvoices       = isPath("Invoices_r.aspx");
  const isAccountPayment = isPath("AccountPayment_r.aspx");
  const isCreditNotes    = isPath("CreditNotes_r.aspx");
  const isStatements     = isPath("Statements_R.aspx");
  const isQuicklists     = isPath("Quicklists_R.aspx");
const isProductsPurchased     = isPath("ProductsPurchased_R.aspx");
const isCustomerTokens    = isPath("CustomerTokens.aspx");
  const isUserSignup     = isPath("UserSignup.aspx");
  const isSignIn         = isPath("SignIn.aspx");
  const isResetPassword  = isPath("ResetPassword.aspx");
  const isAccountSettings= isPath("AccountSettings.aspx");
const isDefault = isPath("Default.aspx");
const isAddress = isPath("AddressList_R.aspx");

  // ---------------- DOM behaviors (merged) ----------------
  onReady(() => {
    // (A) Account headers: add classes (works with or without jQuery)
    try {
      if (window.jQuery) {
        $("td.panelBodyHeader:contains('Account aging')").addClass("account-aging-title");
        $("td.panelBodyHeader:contains('Account activity')").addClass("AccountActivity-title");
      } else {
        document.querySelectorAll("td.panelBodyHeader").forEach((td) => {
          const t = (td.textContent || "").trim();
          if (t.includes("Account aging")) td.classList.add("account-aging-title");
          if (t.includes("Account activity")) td.classList.add("AccountActivity-title");
        });
      }
    } catch (e) {
      console.warn("[WL] Header class add failed:", e);
    }

    // (B) Iframe id assignment (your original behavior)
    setIframeIdInside("ctl00_PageBody_productDetail_ctl01", "DescriptionIframe");
    setIframeIdInside("ctl00_PageBody_productDetail_ctl02", "DescriptionIframe");

    // (C) ResetPassword flow:
    //  1) mark cookie when on reset page (15 minutes)
    //  2) if success panel visible -> redirect to SignIn after 3s
    if (isResetPassword) {
      try {
        setCookie("wl_passwordReset", "true", 900);

        const successPanel = document.getElementById("ctl00_PageBody_SuccessMessagePanel");
        if (successPanel && successPanel.offsetHeight > 0) {
          setTimeout(() => {
            window.location.href = "SignIn.aspx";
          }, 3000);
        }
      } catch (e) {
        console.warn("[WL] ResetPassword flow error:", e);
      }
    }

    // (D) On SignIn or AccountInfo_R: if reset cookie exists, clear and redirect to AccountSettings resetflow
    if (isSignIn || isAccountInfo) {
      try {
        const isResetFlow = document.cookie.split(";").some(c => c.trim().startsWith("wl_passwordReset="));
        if (isResetFlow) {
          clearCookie("wl_passwordReset");
          window.location.href = "AccountSettings.aspx?resetflow=true";
        }
      } catch (e) {
        console.warn("[WL] resetflow redirect error:", e);
      }
    }

    // (E) On AccountSettings?resetflow=true: hide “Change details”, update button, and selected fields
    // NOTE: your original footer code did NOT page-scope this; I am scoping it to AccountSettings to be safe.
    if (isAccountSettings) {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const isResetFlow = urlParams.get("resetflow") === "true";
        if (isResetFlow) {
          // Hide the "Change details" header
          document.querySelectorAll(".formPageHeader").forEach((header) => {
            if ((header.textContent || "").includes("Change details")) {
              header.style.setProperty("display", "none", "important");
            }
          });

          // Hide the "Update" button
          const updateBtn = document.getElementById("ctl00_PageBody_ChangeUserDetailsControl_UpdateUserDetailsButton");
          if (updateBtn) {
            updateBtn.style.setProperty("display", "none", "important");
            const btnWrapper = updateBtn.closest("div");
            if (btnWrapper) btnWrapper.style.setProperty("display", "none", "important");
          }

          // Helper to walk up and hide nearest .epi-form-group-acctSettings
          function hideFieldByInputId(inputId) {
            const input = document.getElementById(inputId);
            if (!input) return;
            let parent = input.parentElement;
            while (parent && !parent.classList.contains("epi-form-group-acctSettings")) {
              parent = parent.parentElement;
            }
            if (parent) parent.style.setProperty("display", "none", "important");
          }

          hideFieldByInputId("ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput");
          hideFieldByInputId("ctl00_PageBody_ChangeUserDetailsControl_LastNameInput");
          hideFieldByInputId("ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput");
          hideFieldByInputId("ctl00_PageBody_ChangeUserDetailsControl_ddBranch");
        }
      } catch (e) {
        console.warn("[WL] AccountSettings resetflow UI hide error:", e);
      }
    }

    // (F) ChangePassword success -> redirect to AccountInfo_R after 2s
    try {
      const successSpan = document.getElementById("ctl00_PageBody_ChangePasswordControl_ChangePasswordMessage");
      if (
        successSpan &&
        (successSpan.textContent || "").trim().toLowerCase().includes("password changed") &&
        successSpan.offsetHeight > 0
      ) {
        setTimeout(() => {
          window.location.href = "https://webtrack.woodsonlumber.com/AccountInfo_R.aspx";
        }, 2000);
      }
    } catch (e) {
      console.warn("[WL] ChangePassword redirect error:", e);
    }

    // (G) ShoppingCart pickup/delivery auto-select based on localStorage (keeps your logic)
    if (isShoppingCart) {
      try {
        const selectedMethod = localStorage.getItem("woodson_cart_method");
        const alreadyApplied = localStorage.getItem("woodson_cart_method_applied");
        if (!selectedMethod || alreadyApplied === "true") return;

        const apply = () => {
          const pickupRadio = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbCollectLater");
          const deliveryRadio = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbDelivered");
          if (!pickupRadio || !deliveryRadio) return false;

          // Visual buttons
          const btnDelivered = document.getElementById("btnDelivered");
          const btnPickup = document.getElementById("btnPickup");
          if (btnDelivered) { btnDelivered.classList.remove("btn-primary","btn-secondary"); }
          if (btnPickup) { btnPickup.classList.remove("btn-primary","btn-secondary"); }

          if (selectedMethod === "pickup") {
            if (btnPickup) btnPickup.classList.add("btn-primary");
            if (btnDelivered) btnDelivered.classList.add("btn-secondary");

            pickupRadio.checked = true;
            localStorage.setItem("woodson_cart_method_applied", "true");
            if (typeof __doPostBack === "function") {
              __doPostBack("ctl00$PageBody$SaleTypeSelector$rbCollectLater", "");
            }
          } else if (selectedMethod === "delivery") {
            if (btnDelivered) btnDelivered.classList.add("btn-primary");
            if (btnPickup) btnPickup.classList.add("btn-secondary");

            deliveryRadio.checked = true;
            localStorage.setItem("woodson_cart_method_applied", "true");
            if (typeof __doPostBack === "function") {
              __doPostBack("ctl00$PageBody$SaleTypeSelector$rbDelivered", "");
            }
          }

          setTimeout(() => {
            localStorage.removeItem("woodson_cart_method_applied");
          }, 3000);

          return true;
        };

        // Poll because radios can be inside hidden container initially
        const iv = setInterval(() => {
          if (apply()) clearInterval(iv);
        }, 200);

        // safety stop after 15s
        setTimeout(() => clearInterval(iv), 15000);
      } catch (e) {
        console.warn("[WL] ShoppingCart method apply error:", e);
      }
    }

    // (H) Add nav item "Change My Store" (safe-guarded)
    try {
      const menu = document.querySelector(".menu-t1");
      if (menu) {
        const existing = Array.from(menu.querySelectorAll("a")).some(a => (a.textContent || "").trim() === "Change My Store");
        if (!existing) {
          const li = document.createElement("li");
          li.className = "nav-item";
          const a = document.createElement("a");
          a.className = "nav-link text-nowrap";
          a.href = "https://webtrack.woodsonlumber.com/AccountSettings.aspx?cms=1";
          a.textContent = "Change My Store";
          li.appendChild(a);
          menu.appendChild(li);
        }
      }
    } catch (e) {
      console.warn("[WL] menu injection error:", e);
    }

    // (I) SignIn hashing + localStorage write (your existing header functionality)
    if (isSignIn) {
      const usernameInput = document.querySelector("#ctl00_PageBody_SignInControl_UserNameTextBox");
      const signInButton  = document.querySelector("#ctl00_PageBody_SignInControl_SignInButton");

      if (usernameInput && signInButton && window.crypto?.subtle) {
        async function hashUsername(username) {
          const encoder = new TextEncoder();
          const data = encoder.encode(username);
          const hashBuffer = await crypto.subtle.digest("SHA-256", data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
        }

        signInButton.addEventListener("click", function () {
          const rawUsername = (usernameInput.value || "").trim().toLowerCase();
          if (!rawUsername) return;

          hashUsername(rawUsername)
            .then((hashed) => {
              if (hashed) localStorage.setItem("wl_user_id", hashed);
            })
            .catch(() => {});
        });
      }
    }

    // (J) Hide signup panel if ?signup=1 (your footer logic)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("signup") === "1") {
        const hide = (id) => {
          const el = document.getElementById(id);
          if (el) el.style.setProperty("display", "none", "important");
        };
        hide("ctl00_PageBody_SignUpPanel");
        hide("ctl00_PageBody_RequestAccessText");
        hide("ctl00_PageBody_BtnRequestAccess");
      }
    } catch (e) {
      console.warn("[WL] signup=1 hide error:", e);
    }

    // (K) ProductDetail: copy iframe content into ctl01/ctl02 container (your footer logic)
    if (isProductDetail) {
      try {
        const iframe = document.getElementById("DescriptionIframe");
        const targetDiv =
          document.getElementById("ctl00_PageBody_productDetail_ctl01") ||
          document.getElementById("ctl00_PageBody_productDetail_ctl02");

        if (!iframe || !targetDiv) return;

        const appendIframeContent = (content) => {
          const wrapped = `
            <div id="productdescription" style="border: 1px solid #ddd; padding: 10px; margin-top: 20px; background-color: #ffffff; border-radius: 5px;">
              ${content}
            </div>
          `;
          targetDiv.insertAdjacentHTML("beforeend", wrapped);
          iframe.style.display = "none";
        };

        const tryRead = () => {
          try {
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            const body = doc?.body;
            const content = (body?.innerHTML || "").trim();
            if (!content) return false;
            appendIframeContent(content);
            return true;
          } catch (e) {
            // cross-domain or not ready yet
            return false;
          }
        };

        // Attempt now; if not ready, wait for load, then poll briefly
        if (tryRead()) return;

        iframe.addEventListener("load", () => {
          if (tryRead()) return;
          const iv = setInterval(() => {
            if (tryRead()) clearInterval(iv);
          }, 200);
          setTimeout(() => clearInterval(iv), 8000);
        });
      } catch (e) {
        console.warn("[WL] ProductDetail iframe embed error:", e);
      }
    }
  });

  // ---------------- external script loads (grouped & de-duped) ----------------

  // (1) jQuery UI (was in footer). Only load if jQuery exists and UI isn't already present.
  // If WebTrack already loads a different jQuery UI, you can remove this block.
  onReady(() => {
    try {
      if (window.jQuery && !(window.jQuery.ui)) {
        loadScriptOnce("https://code.jquery.com/ui/1.12.1/jquery-ui.js", { defer: true });
      }
    } catch (e) {}
  });

  // ProductDetail.aspx
  if (isProductDetail) {
 loadScriptOnce("https://ckunkel510.github.io/WL.github.io/URLSanitize.js");
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/ProductDescription.js");
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/ProductImages.js");
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/ProductCardFlags.js");
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/ProductPageStock.js");
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/QuantityButton.js");
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/Requestquote.js");
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/productcardBulkprice.js", { logPrefix: "[BulkPricing] Attempting to load productcardBulkprice.js..." });
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/product-sidebar.js");
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/Addtocart.js");
 loadScriptOnce("https://ckunkel510.github.io/WL.github.io/stihlRestricted.js");

    // footer scripts you had on ProductDetail:
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/Reviewwidget.js");
    loadCssOnce("https://ckunkel510.github.io/WL.github.io/reviewwidgetstyle.css");
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/OptionDropdown.js");
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/Productdescriptionstyle.js");
  }

  // Products.aspx
  if (isProducts) {
 loadScriptOnce("https://ckunkel510.github.io/WL.github.io/URLSanitize.js");
 loadScriptOnce("https://ckunkel510.github.io/WL.github.io/wl-productgroup-images.js");
 loadScriptOnce("https://ckunkel510.github.io/WL.github.io/filterpanel.js");
// loadScriptOnce("https://ckunkel510.github.io/WL.github.io/wl-home-merch.js");
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/ProductCardFlags.js");
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/Requestquote.js");
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/productcardBulkprice.js", { logPrefix: "[BulkPricing] Attempting to load productcardBulkprice.js..." });
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/localStockRow.js");
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/mobilepcstyling.js");
    // This module's original entry guard returns unless Store Mode is enabled.
    let storeModeActive=false;
    try { storeModeActive=sessionStorage.getItem('storeMode')==='on' || sessionStorage.getItem('storeProximity')==='true'; } catch (_) {}
    if (storeModeActive) loadScriptOnce("https://ckunkel510.github.io/WL.github.io/default.js");
 loadScriptOnce("https://ckunkel510.github.io/WL.github.io/stihlRestricted.js");
    const storeParams=new URLSearchParams(window.location.search);
    const storeGroups=[storeParams.get('pg'),storeParams.get('pl1')].map(value=>(value || '').trim());
    if (storeGroups.includes('4731')) loadScriptOnce("https://ckunkel510.github.io/WL.github.io/storelocations.js");
    if (storeGroups.some(value=>/^473[3-9]$/.test(value))) loadScriptOnce("https://ckunkel510.github.io/WL.github.io/brenham.js");

  }

// Barcode scanner (was in footer) - Products.aspx & ProductDetail.aspx
(function loadBarcode() {
  const file = location.pathname.split("/").pop().toLowerCase();
  const isTarget = file === "products.aspx" || file === "productdetail.aspx";
  if (!isTarget) return;

  // ? Block on desktop BEFORE loading any scripts
  const isMobileOrTablet = (() => {
    // Primary signal: coarse pointer (most phones/tablets)
    if (window.matchMedia && matchMedia("(pointer: coarse)").matches) return true;

    // Fallback: touch capability (covers some tablets / touch devices)
    const touchPoints = navigator.maxTouchPoints || 0;
    const hasTouch =
      touchPoints > 0 ||
      "ontouchstart" in window ||
      (navigator.msMaxTouchPoints || 0) > 0;

    // If it has touch, treat as mobile/tablet for scanner purposes
    return hasTouch;
  })();

  if (!isMobileOrTablet) {
    // console.log("[Barcode] Desktop detected — skipping load.");
    return;
  }

  // prevent double-injection
  if (window.__WL_BARCODE_LOADED__) return;
  window.__WL_BARCODE_LOADED__ = true;

  const load = (src) =>
    new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.defer = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });

  load("https://ckunkel510.github.io/WL.github.io/BarcodeScanner.js?v=20261106-scanner-handoff-1")
    .catch((err) => console.error("[Barcode] load error:", err));
})();

  // ShoppingCart.aspx
  if (isShoppingCart) {
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/WoodsonShoppingCart.js");
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/CartNativeViews.js?v=20261106-native-views-1");
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/Guestcheckout.js?v=20261106-guest-manual-fields-5");
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/Requestquote.js");

    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/ShoppingCartBranch.js?v=20261106-native-ready-1");
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/ShoppingCartSubtotal.js");
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/cartbranchdropdown.js");

    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/Addtocart.js");

    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/MetaShop.js");
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/ShoppingCartSummary.js");
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/SavedForLater.js");
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/storeNotification.js");
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/ShoppingCartRow.js?v=20261106-native-ready-1");
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/DeliveryOptions.js?v=20261106-native-ready-1");
 loadScriptOnce("https://ckunkel510.github.io/WL.github.io/UpsShippingPromo.js");
  }

  // Account pages
  if (isAccountInfo) {
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/Accountinfo.js");
  }
  if (isOpenOrders) {
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/Tracking.js");
  }
  if (isInvoices) {
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/invoices.js");
  }
 if (isOpenQuotes) {
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/OpenQuotes.js");
  }
  if (isAccountPayment) {
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/PayByInvoice.js");
  }
  if (isCreditNotes) {
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/credits.js");
  }
  if (isStatements) {
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/statements.js");
  }
  if (isQuicklists) {
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/HideQuickList.js");
  }
 if (isAddress) {
    // AddressManagement is owned by headermodern.js, including the detail page.
  }

 if (isProductsPurchased) {
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/ProductsPurchased.js");
  }

if (isCustomerTokens) {
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/CustomerTokens.js");
  }
 if (isDefault) {
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/defaultrouter.js");
  }


  // Signup & Signin restriction script
  if (isUserSignup || isSignIn) {
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/UserSignUpEmailRestriction.js");
  }

  // Signup validation
  if (isUserSignup) {
    loadScriptOnce("https://ckunkel510.github.io/WL.github.io/Signupvalidation.js");
  }
})();
