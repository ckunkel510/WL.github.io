/*!
 * WL ShoppingCart Bundle (consolidated)
 * Generated: 2026-02-17
 * Purpose: single orchestrator + guarded feature modules for ShoppingCart.aspx
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // WL Core: guards, scheduling, WebForms hooks
  // ---------------------------------------------------------------------------
  var WL = window.WL || (window.WL = {});
  var _state = WL.__state || (WL.__state = { inited: {}, timers: {}, tickScheduled: false });

  function log() {
    try { console.log.apply(console, ['[WL]'].concat([].slice.call(arguments))); } catch(e) {}
  }
  function warn() {
    try { console.warn.apply(console, ['[WL]'].concat([].slice.call(arguments))); } catch(e) {}
  }
  function err() {
    try { console.error.apply(console, ['[WL]'].concat([].slice.call(arguments))); } catch(e) {}
  }

  function onReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  // Runs a function once per page lifetime
  function initOnce(key, fn) {
    if (_state.inited[key]) return false;
    _state.inited[key] = true;
    try { fn(); } catch (e) { err('Init failed:', key, e); }
    return true;
  }

  // Runs a function again if its "version key" changes (used for partial updates)
  function initPerVersion(key, version, fn) {
    var k = key + '::' + String(version || '');
    if (_state.inited[k]) return false;
    _state.inited[k] = true;
    try { fn(); } catch (e) { err('Init failed:', key, e); }
    return true;
  }

  function debounce(key, fn, delay) {
    delay = delay || 120;
    clearTimeout(_state.timers[key]);
    _state.timers[key] = setTimeout(fn, delay);
  }

  function scheduleTick(reason) {
    if (_state.tickScheduled) return;
    _state.tickScheduled = true;
    setTimeout(function(){
      _state.tickScheduled = false;
      tick(reason || 'scheduled');
    }, 50);
  }

  // WebForms partial postback hook (if present)
  function hookAspNetEndRequest() {
    try {
      if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager) {
        var prm = Sys.WebForms.PageRequestManager.getInstance();
        if (!prm.__wlHooked) {
          prm.__wlHooked = true;
          prm.add_endRequest(function () { scheduleTick('endRequest'); });
          log('Hooked PageRequestManager endRequest');
        }
      }
    } catch(e) {}
  }

  // MutationObserver to detect DOM changes (fallback / non-WebForms)
  function hookMutationObserver() {
    if (_state.__mo) return;
    try {
      _state.__mo = new MutationObserver(function(){
        debounce('moTick', function(){ scheduleTick('mutation'); }, 100);
      });
      _state.__mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
      log('Hooked MutationObserver');
    } catch(e) {}
  }

  // Safe jQuery accessor (many legacy scripts use $)
  function hasJQ() { return !!(window.jQuery && window.jQuery.fn); }

  // ---------------------------------------------------------------------------
  // Tick: run feature modules when their DOM is available
  // ---------------------------------------------------------------------------
  function tick(reason) {
    // Only run on ShoppingCart.aspx unless you intentionally reuse elsewhere
    if (!/\/ShoppingCart\.aspx/i.test(location.pathname)) return;

    hookAspNetEndRequest();

    // "Version" fingerprints (used to re-run modules when cart re-renders)
    var cartCount = document.querySelectorAll('.shopping-cart-details .shopping-cart-item').length;
    var hasSummary = !!document.querySelector('#summary');
    var hasSubtotal = !!document.querySelector('.SubtotalWrapper');
    var verCart = cartCount + '|' + (hasSubtotal ? '1' : '0');
    var verSummary = hasSummary ? '1' : '0';

    // --- Cart UI rebuild / cards ---
    if (hasJQ() && cartCount) initPerVersion('cartRowCards', verCart, function(){ WL.CartRowCards && WL.CartRowCards.run(); });

    // --- Subtotal capture (sessionStorage.purchaseSubtotal) ---
    if (hasSubtotal) initPerVersion('purchaseSubtotalCapture', verCart, function(){ WL.PurchaseSubtotal && WL.PurchaseSubtotal.run(); });

    // --- Shipping message / subtotal enhancements (WoodsonShoppingCart.js) ---
    if (hasSubtotal) initPerVersion('shippingMessage', verCart, function(){ WL.ShippingMessage && WL.ShippingMessage.run(); });

    // --- Branch scoring + dropdown apply ---
    initPerVersion('branchLogic', verCart, function(){ WL.CartBranch && WL.CartBranch.run(); });

    // --- Add-to-cart modal + triggerPlaceOrder behavior (if present on this page) ---
    initOnce('addToCartModal', function(){ WL.AddToCartModal && WL.AddToCartModal.run(); });

    // --- Meta shops cart build (query-string based) ---
    initOnce('metaShop', function(){ WL.MetaShop && WL.MetaShop.run(); });

    // --- Saved For Later panel ---
    initOnce('savedForLater', function(){ WL.SavedForLater && WL.SavedForLater.run(); });

    // --- Delivery options (high delivery cost flow) ---
    if (hasJQ()) initPerVersion('deliveryOptions', verCart, function(){ WL.DeliveryOptions && WL.DeliveryOptions.run(); });

    // --- Checkout wizard + guest checkout enhancements (elements appear later on this same page) ---
    initOnce('checkoutWizard', function(){ WL.CheckoutWizard && WL.CheckoutWizard.run(); });
    initOnce('guestCheckout', function(){ WL.GuestCheckout && WL.GuestCheckout.run(); });

    // --- Cards on file container tweaks (Step/payment UI) ---
    initOnce('cardContainer', function(){ WL.CardContainer && WL.CardContainer.run(); });

    // --- Modern summary page rebuild (if #summary exists) ---
    if (hasSummary) initPerVersion('modernSummary', verSummary, function(){ WL.ModernSummary && WL.ModernSummary.run(); });

    // --- Store notification (thank-you / merchant panel) ---
    initOnce('storeNotification', function(){ WL.StoreNotification && WL.StoreNotification.run(); });
  }

  // Boot
  onReady(function(){
    hookAspNetEndRequest();
    hookMutationObserver();
    scheduleTick('domReady');
  });

  // Expose minimal API
  WL._core = WL._core || { log: log, warn: warn, err: err, scheduleTick: scheduleTick, tick: tick, initOnce: initOnce, initPerVersion: initPerVersion };

})();

(function(){
  // -----------------------------
  // Cart Row Cards (consolidated from ShoppingCartRow.js)
  // -----------------------------
  var WL = window.WL || (window.WL = {});
  WL.CartRowCards = WL.CartRowCards || {};
  WL.CartRowCards.run = function () {
    if (!window.jQuery) return;
    if (!/\/ShoppingCart\.aspx/i.test(location.pathname)) return;

    var $ = window.jQuery;

    // 0) Ensure header exists
    try {
      if ($('.cart-header').length === 0) {
        var $oldTitle = $('#ctl00_PageBody_ShoppingCartTitle_HeaderText');
        var count = 0;
        if ($oldTitle.length) {
          var match = ($oldTitle.text() || '').match(/\d+/);
          count = match ? parseInt(match[0], 10) : 0;
          $oldTitle.detach();
        }
        var $newHeader = $(`
          <div class="cart-header mb-3">
            <h2>Shopping Cart</h2>
            <p>${count} item${count === 1 ? '' : 's'}</p>
          </div>
        `);
        $('.shopping-cart-details').first().before($newHeader);
      }
    } catch(e){}

    // 1) Hide legacy header buttons (safe to re-run)
    try {
      $('#ctl00_PageBody_ShopForMoreButton, \
        #ctl00_PageBody_PlaceOrderButtonTop, \
        #ctl00_PageBody_ShopForMoreButtonTop, \
        #ctl00_PageBody_EmptyCartButtonTop').hide();
    } catch(e){}

    // 2) Build/refresh custom subtotal wrapper once
    try {
      if ($('.custom-subtotal-wrapper').length === 0) {
        var $origSub = $('.SubtotalWrapper');
        if ($origSub.length) {
          var $cloneSub = $origSub.clone();
          $origSub.hide();
          $cloneSub.find('div[style]').remove();

          // Detach & relabel Place Order button
          var $btn = $('#ctl00_PageBody_PlaceOrderButton');
          if ($btn.length) {
            $btn = $btn.detach();
            $btn.find('span').text('Proceed to checkout');
          }

          var $newWrapper = $('<div class="custom-subtotal-wrapper"></div>')
            .append($cloneSub)
            .append($btn);

          $('.ShoppingCartDetailPanel').append($newWrapper);

          // Attach click override once
          if ($btn && $btn.length && !$btn.data('wlStateHook')) {
            $btn.data('wlStateHook', true);
            $btn.on('click', function(){
              try {
                console.log('[Checkout] Overriding localStorage: sameAsDelivery = false, currentStep = 2');
                localStorage.setItem('sameAsDelivery', 'false');
                localStorage.setItem('currentStep', '2');
              } catch(e){}
            });
          }

          // Sticky behavior (one-time per wrapper)
          try {
            var wrapper = document.querySelector('.custom-subtotal-wrapper');
            if (wrapper && !wrapper.__wlSticky) {
              wrapper.__wlSticky = true;
              var wasOffScreen = wrapper.getBoundingClientRect().top > window.innerHeight;

              if (wasOffScreen) wrapper.classList.add('fixed-bottom');
              else wrapper.classList.add('sticky-top');

              var observer = new IntersectionObserver(function(entries){
                var entry = entries && entries[0];
                if (!entry) return;
                if (!entry.isIntersecting) {
                  wrapper.classList.remove('fixed-bottom');
                  wrapper.classList.add('sticky-top');
                } else {
                  if (wasOffScreen) {
                    wrapper.classList.add('fixed-bottom');
                    wrapper.classList.remove('sticky-top');
                  }
                }
              }, { threshold: 0 });
              observer.observe(wrapper);
            }
          } catch(e){}
        }
      }
    } catch(e){}

    // 3) Move Empty Cart button to bottom (once)
    try {
      var $emptyBtn = $('#ctl00_PageBody_EmptyCartButton');
      if ($emptyBtn.length && !$emptyBtn.data('wlMoved')) {
        $emptyBtn.data('wlMoved', true);
        $emptyBtn.detach();
        $('.shopping-cart-details').append($emptyBtn);
      }
    } catch(e){}

    // 4) Convert each cart item into a card (idempotent)
    $('.shopping-cart-details .shopping-cart-item').each(function(){
      var $item = $(this);
      if ($item.data('wlCarded')) return;
      $item.data('wlCarded', true);

      // Remove legacy update rows & validators
      $item.find('[style*="display: table-row"]').remove();
      $item.find('span[id$="_QuantityValidator"]').remove();

      // Capture original Delete link JS then remove
      var $origDel = $item.find('a[id*="_del_"]').first();
      var delJs = '';
      if ($origDel.length) delJs = ($origDel.attr('href') || '').replace(/^javascript:/, '');
      $origDel.remove();

      // Capture original Refresh link JS then remove
      var $origRef = $item.find('a.refresh-cart-line-total').first();
      var refJs = '';
      if ($origRef.length) refJs = ($origRef.attr('href') || '').replace(/^javascript:/, '');
      $origRef.remove();

      // Detach qty wrapper
      var $origQtyWrap = $item.find('span.RadInput').first().detach();

      // Gather data
      var imgSrc = $item.find('img.ThumbnailImage').attr('src');
      var $infoCol = $item.find('.row.pl-2.w-100 .col-12.col-sm-6').first();
      var $link   = $infoCol.find('a:has(.portalGridLink)').first();
      var code    = ($link.find('.portalGridLink').text() || '').trim();
      var href    = $link.attr('href');
      var desc    = ($infoCol.find('> div:nth-child(3) div').text() || '').trim();

      var priceText = ($item
        .find('.col-12.col-sm-9 .col-6')
        .contents().filter(function(i,n){ return n.nodeType===3; })
        .text() || '').trim();

      var totalText = ($item
        .find('.col-12.col-sm-3 .d-flex div').first()
        .text() || '').trim();

      // Delete link
      var $delBtn = $('<a href="#" class="delete-link ms-2">Delete</a>');
      if (delJs) {
        $delBtn.on('click', function(e){
          e.preventDefault();
          try { eval(delJs); } catch(ex){}
        });
      }

      var $card = $(`
        <div class="card mb-2 cart-item-card">
          <div class="card-body p-2">
            <div class="d-flex align-items-center">
              <div class="flex-shrink-0">
                <a href="${href}">
                  <img src="${imgSrc}" alt="${code}"
                       style="width:14vw; max-width:140px; height:auto; object-fit:contain; border-radius:4px;">
                </a>
              </div>
              <div class="flex-grow-1 flex-shrink-1 ms-3">
                <h6 class="mb-1"><a href="${href}">${code}</a></h6>
                <p class="mb-1 small text-secondary text-wrap">${desc}</p>
              </div>
              <div class="flex-shrink-0 text-end">
                <span class="fw-bold">${priceText}</span>
              </div>
            </div>
            <hr class="my-2">
            <div class="d-flex justify-content-between align-items-center">
              <div class="d-flex align-items-center qty-section"></div>
              <div class="text-end action-block">
                <div><span class="fw-bold">${totalText}</span></div>
                <div class="mt-1"></div>
                <div class="sfl-placeholder mt-1"></div>
              </div>
            </div>
          </div>
        </div>
      `);

      // Qty clone + wire refresh
      var $qtyClone = $origQtyWrap && $origQtyWrap.length ? $origQtyWrap.clone() : $('<span></span>');
      $card.find('.qty-section').append($qtyClone).append(' ea');

      if (refJs) {
        var $input = $qtyClone.find('input.riTextBox');
        $input.on('blur', function(){ try{ eval(refJs); }catch(ex){} })
              .on('keydown', function(e){
                if (e.key === 'Enter') {
                  e.preventDefault();
                  try{ eval(refJs); }catch(ex){}
                  $input.blur();
                }
              });
      }

      // Attach delete
      $card.find('.action-block > div:nth-child(2)').append($delBtn);

      // Swap content
      $item.empty().append($card);
    });
  };
})();



(function(){
  var WL = window.WL || (window.WL = {});
  WL.PurchaseSubtotal = WL.PurchaseSubtotal || {};
  WL.PurchaseSubtotal.run = function(){
    try {
      // capture subtotal (idempotent)
      var rows = document.querySelectorAll('table tr');
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var td = row.querySelector('td');
        if (td && td.textContent && td.textContent.includes('Subtotal')) {
          var amountCell = row.querySelectorAll('td')[1];
          if (!amountCell) continue;
          var text = (amountCell.textContent || '').trim();
          var match = text.match(/\$?([\d,]+\.\d{2})/);
          if (match && match[1]) {
            var subtotal = parseFloat(match[1].replace(/,/g, ''));
            sessionStorage.setItem('purchaseSubtotal', subtotal);
            break;
          }
        }
      }
    } catch (e) {
      console.error('Subtotal sessionStorage error:', e);
    }

    try {
      // clear subtotal after order completion (hook once)
      var completeBtn = document.getElementById("ctl00_PageBody_CompleteCheckoutButton");
      if (completeBtn && !completeBtn.__wlSubtotalClearHook) {
        completeBtn.__wlSubtotalClearHook = true;
        completeBtn.addEventListener("click", function () {
          setTimeout(function () {
            sessionStorage.removeItem("purchaseSubtotal");
            console.log("✅ purchaseSubtotal cleared from sessionStorage");
          }, 5000);
        });
      }
    } catch(e){}
  };
})();



(function(){
  var WL = window.WL || (window.WL = {});
  WL.ShippingMessage = WL.ShippingMessage || {};
  WL.ShippingMessage.run = async function(){
    try{
      const subtotalWrapper = document.querySelector('.SubtotalWrapper');
      if (!subtotalWrapper) return;

      const subtotalText = subtotalWrapper.innerHTML;

      // Avoid stacking multiple messages
      const existing = subtotalWrapper.querySelector('.wl-shipping-message');
      if (existing) existing.remove();

      const shippingMessage = document.createElement('div');
      shippingMessage.className = 'wl-shipping-message';
      shippingMessage.style.marginTop = '10px';
      shippingMessage.style.fontSize = '14px';
      shippingMessage.style.color = '#555';

      async function getUserAddress() {
        try {
          const response = await fetch('https://webtrack.woodsonlumber.com/AccountInfo_R.aspx', { credentials: 'include' });
          const text = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, 'text/html');
          const addressElements = doc.querySelectorAll('.accountInfoAddress li');
          if (addressElements.length >= 4) {
            return { zip: addressElements[2].textContent.trim() };
          }
        } catch (error) {
          console.error('Error fetching user address:', error);
        }
        return null;
      }

      function isWithinCentralDeliveryZone(zip) {
        const eligibleZips = ['77833','77836','78947','77803','76667','76642','75831'];
        return eligibleZips.includes(zip);
      }

      async function getProductData() {
        const response = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vSg6EOqMwc_5UjWU7ycyvF-rgj717p-WjV2Vhydcb7uc2Mf2Awj6GehQp66AHwViq4uX6mXXrtZZR-1/pub?output=csv');
        const csvText = await response.text();
        const rows = csvText.split('\n').map(row => row.split(','));
        const headers = rows.shift();
        return rows.map(row => Object.fromEntries(row.map((cell, index) => [headers[index], cell])));
      }

      function getCartProductCodes() {
        const cartLines = document.querySelectorAll('[id*="ctl00_PageBody_CartLineControl"]');
        return Array.from(cartLines).map(line => {
          const title = line.getAttribute('title');
          return title ? title.trim() : null;
        }).filter(Boolean);
      }

      const userAddress = await getUserAddress();
      const cartSubtotal = parseFloat(subtotalWrapper.textContent.replace(/[^0-9\.]/g, '')) || 0;
      const productData = await getProductData();
      const cartProductCodes = getCartProductCodes();

      const cartProducts = productData.filter(product => cartProductCodes.includes(product.ProductCode));

      const cartContainsLargeItems = cartProducts.some(product =>
        parseFloat(product.Weight) > 35 ||
        parseFloat(product.Width) > 36 ||
        parseFloat(product.Thickness) > 36 ||
        parseFloat(product.Length) > 36
      );

      if (userAddress) {
        if (isWithinCentralDeliveryZone(userAddress.zip)) {
          if (cartContainsLargeItems) {
            shippingMessage.textContent = 'Shipping calculated at checkout.';
          } else if (cartSubtotal >= 50) {
            shippingMessage.textContent = 'Your order qualifies for free shipping in our central delivery zone!';
          } else {
            shippingMessage.textContent = 'Shipping estimated at $9.95 for your location unless your order qualifies for free shipping.';
          }
        } else {
          if (cartContainsLargeItems) {
            shippingMessage.textContent = 'One or more items in your cart cannot be shipped to your main address. Please select a different address at checkout or remove the item.';
          } else {
            shippingMessage.textContent = 'Ground freight calculated in checkout.';
          }
        }
      } else {
        shippingMessage.textContent = 'Shipping estimated based on item size and destination.';
      }

      subtotalWrapper.innerHTML = subtotalText;
      subtotalWrapper.appendChild(shippingMessage);
    } catch(e){
      console.error('[WL.ShippingMessage] error', e);
    }
  };
})();



(function(){
  var WL = window.WL || (window.WL = {});
  WL.CartBranch = WL.CartBranch || {};

  WL.CartBranch.run = function(){
    if (!/\/ShoppingCart\.aspx/i.test(location.pathname)) return;
    if (!window.jQuery) return;
    var $ = window.jQuery;

    // --- Scoring / best-branch selection (from ShoppingCartBranch.js) ---
    try {
      console.log("[CartBranch] Script started.");

  const STORES = [
    "Brenham",
    "Bryan",
    "Caldwell",
    "Lexington",
    "Groesbeck",
    "Mexia",
    "Buffalo"
  ];

  const branchScores = {}; // branchName => # of items it can fulfill
  const cartItems = [];

  $(document).ready(() => {
    console.log("[CartBranch] Document ready. Finding cart items...");

    $(".shopping-cart-item").each(function (i) {
      const $item = $(this);

      // Find the product URL
      const productLink = $item.find("a[href*='ProductDetail.aspx']").attr("href") || "";
      const pidMatch = productLink.match(/pid=(\d+)/i);
      const pid = pidMatch ? pidMatch[1] : null;

      // Quantity: find any visible or hidden input with 'qty' in its ID and a numeric value
      let qty = null;
      $item.find("input[id*='qty']").each(function () {
        const val = parseFloat($(this).val());
        if (!isNaN(val)) qty = val;
      });

      if (pid && qty != null) {
        cartItems.push({ pid, qty });
        console.log(`[CartBranch] Found item ${i + 1}: PID=${pid}, Qty=${qty}`);
      } else {
        console.warn(`[CartBranch] Skipped item ${i + 1}: PID=${pid}, Qty=${qty}`);
      }
    });

    console.log(`[CartBranch] Total valid cart items: ${cartItems.length}`);

    if (cartItems.length) {
      getSignedInBranch().then(accountBranch => {
        getStockForCart(accountBranch);
      });
    } else {
      console.warn("[CartBranch] No valid cart items found.");
    }
  });

  async function getSignedInBranch() {
    try {
      const res = await fetch("https://webtrack.woodsonlumber.com/AccountSettings.aspx?cms=1");
      const text = await res.text();
      const temp = document.createElement("div");
      temp.innerHTML = text;
      const dropdown = temp.querySelector("#ctl00_PageBody_ChangeUserDetailsControl_ddBranch");
      const selected = dropdown?.querySelector("option[selected='selected']");
      const branch = selected?.textContent.trim() || null;
      console.log(`[CartBranch] Signed-in account branch: ${branch}`);
      return branch;
    } catch (err) {
      console.warn("[CartBranch] Error fetching signed-in branch:", err);
      return null;
    }
  }

  async function getStockForCart(accountBranch) {
  console.log("[CartBranch] Checking stock availability across branches...");

  const useActualColumn = !!accountBranch;
  const columnIndex = useActualColumn ? 4 : 2;

  for (const item of cartItems) {
    console.log(`[CartBranch] Fetching stock for PID ${item.pid}...`);

    try {
      const res = await fetch(`https://webtrack.woodsonlumber.com/Catalog/ShowStock.aspx?productid=${item.pid}`);
      const html = await res.text();
      const temp = document.createElement("div");
      temp.innerHTML = html;

      const table = temp.querySelector("#StockDataGrid_ctl00");
      if (!table) {
        console.warn(`[CartBranch] No stock table found for PID ${item.pid}`);
        continue;
      }

      const rows = table.querySelectorAll("tr");
      let accountBranchHasStock = false;

      for (const row of rows) {
        const cells = row.querySelectorAll("td");
        if (cells.length < columnIndex + 1) continue;

        const branchName = cells[0].textContent.trim();
        const qtyText = cells[columnIndex].textContent.trim();
        const qty = parseFloat(qtyText.replace(/,/g, ""));

        if (!STORES.includes(branchName)) continue;

        console.log(`[CartBranch] Branch ${branchName} has ${qty} for PID ${item.pid} (need ${item.qty})`);

        if (branchName === accountBranch && qty >= item.qty) {
          accountBranchHasStock = true;
          console.log(`[CartBranch] --> Account branch ${accountBranch} can fulfill PID ${item.pid}`);
        }

        if (qty >= item.qty) {
          branchScores[branchName] = (branchScores[branchName] || 0) + 1;
        }
      }

      if (!accountBranchHasStock) {
        console.log(`[CartBranch] Account branch cannot fulfill PID ${item.pid}`);
      }

    } catch (err) {
      console.error(`[CartBranch] Failed to fetch stock for PID ${item.pid}:`, err);
    }
  }

  console.log("[CartBranch] Final branch scores:", branchScores);

  const itemCount = cartItems.length;

  if (accountBranch && branchScores[accountBranch] === itemCount) {
    console.log(`[CartBranch] Account branch ${accountBranch} can fulfill all items. Storing...`);
    localStorage.setItem("woodson_cart_branch", accountBranch);
  } else {
    const fullMatch = Object.entries(branchScores).find(([_, count]) => count === itemCount);
    if (fullMatch) {
      const [branch] = fullMatch;
      console.log(`[CartBranch] Alternate branch ${branch} can fulfill all items.`);
      localStorage.setItem("woodson_cart_branch", branch);
    } else {
      const fallback = Object.entries(branchScores).sort((a, b) => b[1] - a[1])[0];
      if (fallback) {
        const [branch] = fallback;
        console.log(`[CartBranch] Partial match: ${branch} can fulfill ${branchScores[branch]} of ${itemCount} items.`);
        localStorage.setItem("woodson_cart_branch", branch);
      } else {
        console.warn("[CartBranch] No matching branch could fulfill any items.");
      }
    }
  }
}
    } catch(e) {
      console.error('[CartBranch] scoring error', e);
    }

    // --- Dropdown apply (from cartbranchdropdown.js), but immediate (not window.load) ---
    try {
      const SELECTED_KEY = "woodson_cart_branch";
      const DROPDOWN_ID = "#ctl00_PageBody_BranchDropDownList";

      const storedBranch = localStorage.getItem(SELECTED_KEY);
      const $dropdown = $(DROPDOWN_ID);
      if ($dropdown.length === 0) return;

      // Hook manual changes once
      if (!$dropdown.data('wlManualHook')) {
        $dropdown.data('wlManualHook', true);
        $dropdown.on("change", function () {
          const newSelected = $(this).find("option:selected").text().trim();
          sessionStorage.setItem("woodson_user_selected_branch", newSelected);
          console.log("[CartBranch] User manually changed branch to:", newSelected);
        });
      }

      const manuallySelected = sessionStorage.getItem("woodson_user_selected_branch");
      if (manuallySelected) return;

      const currentSelected = $dropdown.find("option:selected").text().trim();

      if (storedBranch && !currentSelected.toLowerCase().startsWith(storedBranch.toLowerCase())) {
        const matchOption = $dropdown.find("option").filter((_, opt) =>
          $(opt).text().toLowerCase().startsWith(storedBranch.toLowerCase())
        );

        if (matchOption.length > 0) {
          console.log(`[CartBranch] Setting dropdown to stored branch: ${storedBranch}`);
          matchOption.prop("selected", true);
          $dropdown.trigger("change");
        }
      }

      // Clear after apply attempt
      if (storedBranch) {
        localStorage.removeItem(SELECTED_KEY);
        console.log("[CartBranchDropdown] Cleared stored branch after applying.");
      }
    } catch(e) {
      console.error('[CartBranch] dropdown error', e);
    }
  };
})();



(function(){
  var WL = window.WL || (window.WL = {});
  WL.AddToCartModal = WL.AddToCartModal || {};
  WL.AddToCartModal.run = function(){
    try {
      if (!(true)) return;
      console.log("[CartModal] DOMContentLoaded ✅");
      
        // ✅ Step 1: Hook into your exact Add to Cart button
        const addToCartButton = document.querySelector("#ctl00_PageBody_productDetail_ctl00_AddProductButton");
      
        if (addToCartButton) {
          console.log("[CartModal] Add to Cart button found 🎯");
      
          addToCartButton.addEventListener("click", () => {
            console.log("[CartModal] Add to Cart clicked – setting session flag");
            sessionStorage.setItem("showAddToCartModal", "true");
          });
        } else {
          console.warn("[CartModal] Add to Cart button NOT FOUND ❌");
        }
      
      
      
        // ✅ Step 2: Check if we should show modal
        const modalFlag = sessionStorage.getItem("showAddToCartModal");
        console.log("[CartModal] Modal flag is:", modalFlag);
      
        if (modalFlag === "true") {
          sessionStorage.removeItem("showAddToCartModal");
          console.log("[CartModal] Flag detected – triggering modal load");
          setTimeout(() => {
            showCustomCartModal();
          }, 500);
        }
      
        // ✅ Step 3: Inject modal structure
        const modal = document.createElement("div");
        modal.id = "customCartModal";
        modal.style.cssText = `
          display: none;
          position: fixed;
          top: 10%;
          left: 50%;
          transform: translateX(-50%);
          background: white;
          padding: 20px;
          z-index: 10000;
          max-width: 500px;
          width: 90%;
          box-shadow: 0 0 15px rgba(0,0,0,0.3);
          border-radius: 10px;
          font-family: sans-serif;
        `;
        modal.innerHTML = `
          <h3 style="margin-top: 0;">🛒 Added to Cart!</h3>
          <div id="cartSubtotal" style="font-weight:bold; margin-bottom:10px;"></div>
          <div id="cartItemsPreview" style="margin-bottom:15px;"></div>
          <div style="display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap;">
            <a href="/ShoppingCart.aspx" style="text-decoration: none;">
              <button style="background:#6b0016; color:white; border:none; padding:8px 14px; border-radius:5px; cursor:pointer;">
                View Cart
              </button>
            </a>
            <button id="customCheckoutBtn" style="background:#007b00; color:white; border:none; padding:8px 14px; border-radius:5px; cursor:pointer;">
              Checkout
            </button>
          </div>
          <div style="text-align:center; margin-top:10px;">
            <button id="customCartCloseBtn" style="background:none; border:none; color:#666; text-decoration:underline; cursor:pointer;">Keep Shopping</button>
          </div>
        `;
        document.body.appendChild(modal);
      
        document.getElementById("customCartCloseBtn").onclick = () => {
          console.log("[CartModal] Keep Shopping clicked – closing modal");
          modal.style.display = "none";
        };
      
        document.getElementById("customCheckoutBtn").onclick = () => {
        console.log("[CartModal] Checkout clicked – setting flag & redirecting");
        sessionStorage.setItem("triggerPlaceOrder", "true");
        window.location.href = "/ShoppingCart.aspx";
      };
      
      
        // ✅ Step 4: Fetch cart data and show modal
        function showCustomCartModal() {
          console.log("[CartModal] Fetching cart from /ShoppingCart.aspx");
      
          fetch("/ShoppingCart.aspx")
            .then(res => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res.text();
            })
            .then(html => {
              console.log("[CartModal] Cart page fetched successfully");
              const tempDiv = document.createElement("div");
              tempDiv.innerHTML = html;
      
              const subtotalEl = tempDiv.querySelector(".SubtotalWrapper");
              const subtotalText = subtotalEl ? subtotalEl.textContent.match(/\$[\d,.]+/)?.[0] : "—";
              document.getElementById("cartSubtotal").innerHTML = `Subtotal: ${subtotalText}`;
              console.log("[CartModal] Subtotal parsed:", subtotalText);
      
              const items = tempDiv.querySelectorAll(".shopping-cart-item");
              const previewContainer = document.getElementById("cartItemsPreview");
              previewContainer.innerHTML = "";
              console.log(`[CartModal] Found ${items.length} cart items`);
      
              items.forEach((item, i) => {
                if (i >= 3) return;
                const img = item.querySelector("img")?.src || "";
                const name = item.querySelector("a span.portalGridLink")?.textContent || "";
                const desc = item.querySelector("div > div:nth-child(3) > div")?.textContent || "";
                const price = item.querySelector(".col-6")?.textContent?.trim() || "";
      
                if (img || name || price) {
        previewContainer.innerHTML += `
          <div style="display:flex; align-items:center; margin-bottom:10px;">
            ${img ? `<img src="${img}" alt="" style="width:50px; height:50px; object-fit:cover; margin-right:10px;">` : ''}
            <div>
              ${name ? `<strong>${name}</strong><br>` : ''}
              ${desc ? `<small>${desc}</small><br>` : ''}
              ${price ? `<span>${price}</span>` : ''}
            </div>
          </div>`;
      }
      
              });
      
              modal.style.display = "block";
              console.log("[CartModal] Modal shown ✅");
            })
            .catch(err => {
              console.error("[CartModal] Failed to fetch cart:", err);
              document.getElementById("cartSubtotal").innerHTML = "Subtotal: unavailable";
              modal.style.display = "block";
            });
        }
      });
      
      
      document.addEventListener("DOMContentLoaded", function () {
        const shouldTrigger = sessionStorage.getItem("triggerPlaceOrder");
        if (shouldTrigger === "true") {
          sessionStorage.removeItem("triggerPlaceOrder");
          console.log("[CartModal] Triggering Place Order button automatically");
      
          // Wait for DOM and WebForms JS to initialize
          setTimeout(() => {
            const placeOrderButton = document.querySelector("#ctl00_PageBody_PlaceOrderButton");
            if (placeOrderButton) {
              placeOrderButton.click();
              console.log("[CartModal] Place Order button clicked ✅");
            } else {
              console.warn("[CartModal] Place Order button not found ❌");
            }
          }, 500);
        }
    } catch(e) {
      console.error('[WL.AddToCartModal] error', e);
    }
  };
})();



(function(){
  var WL = window.WL || (window.WL = {});
  WL.MetaShop = WL.MetaShop || {};
  WL.MetaShop.run = function(){
    try {
      if (!(true)) return;
      const params = new URLSearchParams(window.location.search);
        const cartOrigin = params.get("cart_origin");
        const productsParam = params.get("products");
      
        const acceptedOrigins = ["meta_shops", "facebook", "instagram", "whatsapp"];
      if (!acceptedOrigins.includes(cartOrigin) || !productsParam) return;
      
        if (sessionStorage.getItem("metaCartBuilt")) return;
      
        // ✅ Show modal before doing anything
        showMetaCartModal();
      
        sessionStorage.setItem("metaCartBuilt", "true");
      
        const productEntries = productsParam.split(",");
        const products = productEntries.map(entry => {
          const [id, qty] = entry.split(":");
          const parsedQty = parseInt(qty || "1", 10);
          return { productId: id, quantity: parsedQty };
        });
      
        console.log(`[MetaShops] Starting cart build for ${products.length} product(s)...`);
      
        for (const { productId, quantity } of products) {
          console.log(`[MetaShops] Adding product ${productId} with quantity ${quantity}...`);
          await addToCartViaIframe(productId, quantity);
        }
      
        console.log("[MetaShops] All products processed. Redirecting to cart...");
        removeMetaCartModal();
        setTimeout(() => {
          window.location.href = "/ShoppingCart.aspx";
        }, 1000);
      });
      
      function addToCartViaIframe(productId, quantity) {
        return new Promise((resolve) => {
          const iframe = document.createElement("iframe");
          iframe.style.display = "none";
          iframe.src = `/ProductDetail.aspx?pid=${productId}`;
      
          iframe.onload = () => {
            try {
              const doc = iframe.contentWindow.document;
              const qtyInputId = `ctl00_PageBody_productDetail_ctl00_qty_${productId}`;
              const qtyInput = doc.getElementById(qtyInputId);
      
              if (qtyInput) {
                qtyInput.value = quantity;
                qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
                qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
                qtyInput.dispatchEvent(new Event('blur'));
              }
      
              const button = doc.querySelector("#ctl00_PageBody_productDetail_ctl00_AddProductButton");
              if (button) {
                button.click();
              }
            } catch (e) {
              console.error(`[MetaShops] Error processing iframe for ${productId}:`, e);
            }
      
            setTimeout(() => {
              iframe.remove();
              resolve();
            }, 1000);
          };
      
          iframe.onerror = () => {
            console.error(`[MetaShops] Failed to load iframe for ${productId}`);
            resolve();
          };
      
          document.body.appendChild(iframe);
        });
      }
      
      function showMetaCartModal() {
        const modal = document.createElement("div");
        modal.id = "metaCartModal";
        modal.innerHTML = `
          <div style="background: white; border-radius: 8px; padding: 2rem; max-width: 500px; width: 90%; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-family: sans-serif;">
            <h2 style="color: #6b0016; margin-bottom: 1rem;">Building Your Cart</h2>
            <p style="font-size: 1rem; color: #333;">We’re adding your selected items into your cart.</p>
            <p style="font-size: 0.9rem; color: #666; margin-top: 1rem;">Please allow us just a few moments. Your cart will be ready shortly!</p>
            <div style="margin-top: 1.5rem;">
              <div class="loader" style="margin: 0 auto; width: 36px; height: 36px; border: 4px solid #eee; border-top: 4px solid #6b0016; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            </div>
          </div>
        `;
        modal.style.position = "fixed";
        modal.style.top = 0;
        modal.style.left = 0;
        modal.style.width = "100vw";
        modal.style.height = "100vh";
        modal.style.backgroundColor = "rgba(255,255,255,0.9)";
        modal.style.zIndex = "9999";
        modal.style.display = "flex";
        modal.style.alignItems = "center";
        modal.style.justifyContent = "center";
      
        // Add CSS animation
        const style = document.createElement("style");
        style.textContent = `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(style);
        document.body.appendChild(modal);
      }
      
      function removeMetaCartModal() {
        const modal = document.getElementById("metaCartModal");
        if (modal) modal.remove();
      }
    } catch(e) {
      console.error('[WL.MetaShop] error', e);
    }
  };
})();



(function(){
  var WL = window.WL || (window.WL = {});
  WL.SavedForLater = WL.SavedForLater || {};
  WL.SavedForLater.run = function(){
    try {
      if (!(true)) return;
      setTimeout(() =>{
      (function() {
      
        const SFL_NAME = "Saved For Later";
        const SFL_DESC = "Saved For Later";
        const BASE = location.origin + "/";
      
      
      
      
        // Inject container HTML into DOM
        const container = document.createElement("div");
        container.id = "savedForLater";
        container.style.display = "none";
        container.innerHTML = `
          <div id="sflHeader">
            <span>Saved For Later</span>
            <span class="sflCount" id="sflCount"></span>
          </div>
          <div id="sflBody">
            <div id="sflLoading">Loading your saved items…</div>
            <div id="sflList" style="display:none;"></div>
            <div id="sflEmpty" style="display:none;">No items saved for later.</div>
          </div>
        `;
        const mainContents = document.querySelector('.mainContents');
      if (mainContents && mainContents.parentNode) {
        mainContents.parentNode.insertBefore(container, mainContents.nextSibling);
        console.log("[SFL] Injected after .mainContents");
      } else {
        console.warn("[SFL] .mainContents not found, appending to body");
        document.body.appendChild(container);
      }
      
        console.log("[SFL] Injected Saved For Later HTML container");
      
        // Utility functions
        async function fetchHtml(url, options = {}) {
          console.log("[SFL] Fetching HTML from:", url);
          const res = await fetch(url, { credentials: "include", ...options });
          if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
          const text = await res.text();
          const doc = new DOMParser().parseFromString(text, "text/html");
          return { text, doc };
        }
      
        function getHiddenFields(doc) {
          const fields = {};
          doc.querySelectorAll('input[type="hidden"]').forEach(inp => {
            if (inp.name) fields[inp.name] = inp.value || "";
          });
          return fields;
        }
      
        function toFormData(obj) {
          const fd = new FormData();
          Object.entries(obj).forEach(([k, v]) => fd.append(k, v));
          return fd;
        }
      
        function $(sel, root = document) {
          return root.querySelector(sel);
        }
      
        function $all(sel, root = document) {
          return Array.from(root.querySelectorAll(sel));
        }
      
        function ensureSflContainer() {
          const el = document.getElementById("savedForLater");
          if (el) el.style.display = "block";
          return el;
        }
      
        function setLoading(msg = "Loading your saved items…") {
          console.log("[SFL] setLoading:", msg);
          $("#sflLoading").style.display = "block";
          $("#sflLoading").textContent = msg;
          $("#sflList").style.display = "none";
          $("#sflEmpty").style.display = "none";
        }
      
        function setEmpty() {
          console.log("[SFL] No items found");
          $("#sflLoading").style.display = "none";
          $("#sflList").style.display = "none";
          $("#sflEmpty").style.display = "block";
          $("#sflCount").textContent = "(0)";
        }
      
        function setListCount(n) {
          console.log(`[SFL] Found ${n} items`);
          $("#sflCount").textContent = `(${n})`;
        }
      
        // --------- Step 0: must be signed in
        const wlUserId = (typeof localStorage !== "undefined") ? localStorage.getItem("wl_user_id") : null;
        console.log("[SFL] wl_user_id =", wlUserId);
        if (!wlUserId) {
          console.log("[SFL] Not signed in — skipping");
          return;
        }
      
        ensureSflContainer();
        setLoading();
      
        // --------- Step 1: Find or create the Saved For Later quicklist
        async function findSavedForLaterList() {
          console.log("[SFL] Searching for existing quicklist...");
          const { doc } = await fetchHtml(BASE + "Quicklists_R.aspx");
          const table = doc.querySelector("table.rgMasterTable");
          if (!table) return { exists: false };
      
          let sflRow = null;
          const rows = $all("tbody > tr", table);
          for (const tr of rows) {
            const anchor = tr.querySelector('td a[href*="Quicklists_R.aspx"]');
            if (!anchor) continue;
            if (anchor.textContent.trim().toLowerCase() === SFL_NAME.toLowerCase()) {
              sflRow = { tr, anchor };
              break;
            }
          }
      
          if (sflRow) {
            const href = new URL(sflRow.anchor.getAttribute("href"), BASE).toString();
            console.log("[SFL] Found existing Saved For Later quicklist:", href);
            return { exists: true, detailUrl: href };
          }
      
          console.log("[SFL] Quicklist not found — will create new");
          return { exists: false };
        }
      
        async function createSavedForLaterList() {
          console.log("[SFL] Creating Saved For Later quicklist…");
          const addUrl = BASE + "Quicklists_R.aspx?addNew=1";
          const { doc } = await fetchHtml(addUrl);
      
          const hidden = getHiddenFields(doc);
          hidden["ctl00$PageBody$EditQuicklistName"] = SFL_NAME;
          hidden["ctl00$PageBody$EditQuicklistDescription"] = SFL_DESC;
      
          const defaultSel = $("#ctl00_PageBody_EditDefaultQuicklistDropdown", doc);
          const val = defaultSel ? (defaultSel.value || "no") : "no";
          hidden["ctl00$PageBody$EditDefaultQuicklistDropdown"] = val;
      
          // Simulate Save button click via __doPostBack
          hidden["__EVENTTARGET"] = "ctl00$PageBody$SaveQuickListButton";
          hidden["__EVENTARGUMENT"] = "";
      
          console.log("[SFL] Submitting quicklist creation form with postback to SaveQuickListButton");
          const fd = toFormData(hidden);
          const res = await fetch(addUrl, {
            method: "POST",
            credentials: "include",
            body: fd
          });
      
          if (!res.ok) throw new Error("Quicklist creation POST failed.");
      
          const found = await findSavedForLaterList();
          if (!found.exists) throw new Error("Quicklist was not created as expected.");
          return found.detailUrl;
        }
      
        // --------- Step 2: Resolve detail URL for SFL
        async function ensureSflDetailUrl() {
        console.log("[SFL] Locating Saved For Later Quicklist via Quicklists_R.aspx...");
        sessionStorage.removeItem("sfl_detail_url"); // always re-check
      
        const found = await findSavedForLaterList(); // loads Quicklists_R.aspx
        if (found.exists && found.detailUrl) {
          console.log("[SFL] Found valid Quicklist detail URL:", found.detailUrl);
          const fixedUrl = found.detailUrl.replace("QuicklistDetails.aspx", "Quicklists_R.aspx");
      sessionStorage.setItem("sfl_detail_url", fixedUrl);
      console.log("[SFL] Saved corrected detail URL:", fixedUrl);
      
          return found.detailUrl;
        }
      
        console.log("[SFL] Not found, creating new Saved For Later list...");
        const createdUrl = await createSavedForLaterList();
        sessionStorage.setItem("sfl_detail_url", createdUrl);
        return createdUrl;
      }
      
      
        // --------- Step 3: Load items
       function parseSflItems(detailDoc) {
        console.log("[SFL] Parsing Quicklist detail page...");
      
        // Find the outer grid div (fallback to .RadGrid or .rgMasterTable)
        let grid = detailDoc.querySelector(".RadGrid") || detailDoc.querySelector("table.rgMasterTable");
        if (!grid) {
          console.error("[SFL] Grid container not found");
          return [];
        }
      
        // Ensure we have the actual table
        let table = grid.tagName === "TABLE" ? grid : grid.querySelector("table.rgMasterTable");
        if (!table) {
          console.error("[SFL] .rgMasterTable not found inside grid container");
          return [];
        }
      
        const rows = table.querySelectorAll("tr.rgRow, tr.rgAltRow");
        console.log(`[SFL] Found ${rows.length} row(s) in Quicklist table`);
      
        const items = [];
      
        rows.forEach((tr, i) => {
          const tds = Array.from(tr.querySelectorAll("td"));
          if (tds.length < 5) {
            console.warn(`[SFL] Skipping row ${i} — only ${tds.length} td cells`);
            return;
          }
      
          const a = tds[0].querySelector("a[href*='ProductDetail.aspx']");
          const productHref = a?.getAttribute("href") || null;
          const productCode = a?.textContent.trim() || "";
          const description = tds[1].textContent.trim();
          const price = tds[2].textContent.trim();
          const per = tds[3].textContent.trim();
      
          // 🔍 Find delete anchor and extract EVENTTARGET
          const deleteAnchor = tr.querySelector("a[id*='DeleteQuicklistLineButtonX']");
          let eventTarget = null;
      
          if (deleteAnchor) {
            const href = deleteAnchor.getAttribute("href") || "";
            const match = href.match(/__doPostBack\('([^']+)'/);
            if (match) {
              eventTarget = match[1];
              console.log(`[SFL] Row ${i}: Found delete __EVENTTARGET: ${eventTarget}`);
            } else {
              console.warn(`[SFL] Row ${i}: Failed to extract __EVENTTARGET from href`);
            }
          } else {
            console.warn(`[SFL] Row ${i}: No delete anchor found`);
          }
      
          console.log(`[SFL] Row ${i}: ${productCode} | ${description} | ${price} | ${per}`);
      
          items.push({
            productHref,
            productCode,
            description,
            price,
            per,
            eventTarget // 💡 used later to remove item
          });
        });
      
        return items;
      }
      
      
      
      
      
      
        async function loadSflItems() {
        const detailUrl = await ensureSflDetailUrl();
        const { doc } = await fetchHtml(detailUrl);
        const items = parseSflItems(doc);
        return { detailUrl, items, doc };
      }
      
        // --------- Step 4: Render
        function pidFromHref(href) {
          try {
            const u = new URL(href, BASE);
            return u.searchParams.get("pid");
          } catch (e) {
            return null;
          }
        }
      
        function productImageUrlFromPid(pid) {
          return "https://images-woodsonlumber.sirv.com/Other%20Website%20Images/placeholder.png";
        }
      
       async function renderSflList(items) {
        const list = document.getElementById("sflList");
        list.innerHTML = "";
      
        if (!items.length) {
          setEmpty();
          return;
        }
      
        const placeholder = "https://images-woodsonlumber.sirv.com/Other%20Website%20Images/placeholder.png";
      
        for (const item of items) {
          const pid = item.productHref ? pidFromHref(item.productHref) : null;
          const productUrl = pid ? `https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=${pid}` : "#";
      
          // === Create image element ===
          const imgElement = document.createElement("img");
          imgElement.className = "sflImg";
          imgElement.src = placeholder;
      
          // === Wrap image in anchor ===
          const link = document.createElement("a");
          link.href = productUrl;
          link.target = "_blank"; // optional: open in new tab
          link.appendChild(imgElement);
      
          // === Build row ===
          const row = document.createElement("div");
          row.className = "sflRow";
          row.innerHTML = `
            <div class="sflImgWrapper"></div>
            <div>
              <div class="sflTitle">${item.productCode || ""}</div>
              <div class="sflDesc">${item.description || ""}</div>
            </div>
            <div class="sflPrice">${item.price || ""}</div>
            <div class="sflPer">${item.per || ""}</div>
            <div class="sflActions">
              <button class="sflBtn js-sfl-add" data-pid="${pid || ""}" data-code="${item.productCode || ""}">Add to Cart</button>
            </div>
          `;
      
          // Add the <a><img></a> to the image wrapper
          row.querySelector(".sflImgWrapper").appendChild(link);
      
          // Add data attributes
          row.dataset.eventTarget = item.eventTarget || "";
          row.dataset.pid = pid || "";
          row.dataset.code = item.productCode || "";
      
          // Append to the list
          list.appendChild(row);
      
          // === Update image if available ===
          if (pid) {
            try {
              const response = await fetch("https://wlmarketingdashboard.vercel.app/api/get-product-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productUrl })
              });
      
              const result = await response.json();
              if (result.imageUrl) {
                imgElement.src = result.imageUrl;
              } else {
                console.warn(`[SFL] No image found for PID ${pid}`);
              }
            } catch (err) {
              console.error(`[SFL] Error fetching image for PID ${pid}:`, err.message);
            }
          }
        }
      
        setListCount(items.length);
        document.getElementById("sflLoading").style.display = "none";
        document.getElementById("sflEmpty").style.display = "none";
        list.style.display = "block";
      }
      
      
      
        // --------- Init
        (async function initSfl() {
        try {
          console.log("[SFL] Initializing...");
      
          // Check if we're on a step where SFL should be hidden
          const shouldHide = (() => {
            const isVisible = (el) => el && el.offsetParent !== null;
            const paymentHeader = document.querySelector("#ctl00_PageBody_CardOnFileViewTitle_HeaderText");
            const reviewHeader = document.querySelector("#ctl00_PageBody_SummaryHeading_HeaderText");
            const summaryEntry2 = document.getElementById("SummaryEntry2");
            const CheckoutDetails = document.getElementById("ctl00_PageBody_CheckoutTitle_HeaderText");
      
            return (
              isVisible(paymentHeader) ||
              isVisible(reviewHeader) ||
              isVisible(summaryEntry2) ||
              isVisible(CheckoutDetails)
            );
          })();
      
          if (shouldHide) {
            console.log("[SFL] Skipping SFL load — on final step.");
            const sflBlock = document.getElementById("savedForLater");
            if (sflBlock) sflBlock.style.display = "none";
            return; // exit early
          }
      
          const { items } = await loadSflItems();
          renderSflList(items);
          console.log("[SFL] Done.");
        } catch (err) {
          console.error("[SFL] Error during init:", err);
          setEmpty();
        }
      })();
      
      
      // === New logic to hide SFL block based on page step ===
      function hideSflIfOnFinalStep() {
        const paymentHeader = document.querySelector("#ctl00_PageBody_CardOnFileViewTitle_HeaderText");
        const reviewHeader = document.querySelector("#ctl00_PageBody_SummaryHeading_HeaderText");
        const summaryEntry2 = document.getElementById("SummaryEntry2");
        const CheckoutDetails = document.getElementById("ctl00_PageBody_CheckoutTitle_HeaderText");
        const sflBlock = document.getElementById("savedForLater");
      
        if (!sflBlock) return;
      
        const isVisible = (el) => el && el.offsetParent !== null;
      
        if (
          isVisible(paymentHeader) ||
          isVisible(reviewHeader) ||
          isVisible(summaryEntry2) ||
          isVisible(CheckoutDetails)
        ) {
          sflBlock.style.display = "none";
          console.log("[SFL] Hiding Saved For Later section on payment, review, or summary step.");
        }
      }
      
      
      
      })();
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      (function(){
        const BASE = location.origin + "/";
      
        function $(sel, root=document) { return root.querySelector(sel); }
        function $all(sel, root=document) { return Array.from(root.querySelectorAll(sel)); }
      
        async function fetchHtml(url, options = {}) {
          const res = await fetch(url, { credentials: "include", ...options });
          if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
          const text = await res.text();
          const doc = new DOMParser().parseFromString(text, "text/html");
          return { text, doc };
        }
        function getHiddenFields(doc) {
          const fields = {};
          doc.querySelectorAll('input[type="hidden"]').forEach(inp => {
            if (inp.name) fields[inp.name] = inp.value || "";
          });
          return fields;
        }
        function toFormData(obj) {
          const fd = new FormData();
          Object.entries(obj).forEach(([k, v]) => fd.append(k, v));
          return fd;
        }
      
        async function addPidToCart(pid, qty = 1) {
        if (!pid) throw new Error("PID required to add to cart.");
        const pdpUrl = BASE + "ProductDetail.aspx?pid=" + encodeURIComponent(pid);
        console.log("[SFL] Loading PDP:", pdpUrl);
        const { doc } = await fetchHtml(pdpUrl);
      
        const hidden = getHiddenFields(doc);
      
        // Try to find quantity input (optional)
        let qtyInput = doc.querySelector('input[name*="qty"]');
        if (qtyInput && qtyInput.name) {
          hidden[qtyInput.name] = String(qty);
          console.log("[SFL] Setting quantity:", qtyInput.name, "=", qty);
        }
      
        // Auto-detect Add to Cart link first
        let eventTarget = null;
        const atcLink = doc.querySelector('a[href^="javascript:__doPostBack"][id*="AddProductButton"]');
        if (atcLink) {
          const href = atcLink.getAttribute("href");
          const m = href.match(/__doPostBack\('([^']+)'/);
          if (m) eventTarget = m[1];
          console.log("[SFL] Auto-detected Add to Cart event target:", eventTarget);
        }
      
        // Fallback if not found
        if (!eventTarget) {
          eventTarget = "ctl00$PageBody$productDetail$ctl00$AddProductButton";
          console.log("[SFL] Using hardcoded Add to Cart event target:", eventTarget);
        }
      
        hidden["__EVENTTARGET"] = eventTarget;
        hidden["__EVENTARGUMENT"] = "";
      
        const fd = toFormData(hidden);
        const res = await fetch(pdpUrl, {
          method: "POST",
          credentials: "include",
          body: fd
        });
      
        if (!res.ok) throw new Error("Add to Cart postback failed.");
        console.log("[SFL] Add to Cart succeeded");
        return true;
      }
      
      
      async function removeQuicklistLine(productCodeToRemove) {
        const detailUrl = sessionStorage.getItem("sfl_detail_url");
        if (!detailUrl) throw new Error("Missing quicklist detail URL");
      
        console.log(`[SFL] Removing item from quicklist using detail URL: ${detailUrl}`);
      
        // 1. Load the quicklist page HTML
        const response = await fetch(detailUrl, { credentials: "include" });
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        console.log("[SFL] Loaded quicklist detail page");
      
        // 2. Parse the grid rows and find the correct delete __EVENTTARGET
        const rows = doc.querySelectorAll("tr.rgRow, tr.rgAltRow");
        let eventTarget = null;
      
      for (const tr of rows) {
        const deleteAnchor = tr.querySelector("a[id*='DeleteQuicklistLineButtonX']");
        const onclick = deleteAnchor?.getAttribute("onclick") || "";
        const productCodeMatch = onclick.match(/PromptDeleteQuicklistLine\("([^"]+)"/);
        const productCode = productCodeMatch?.[1]?.trim().toUpperCase();
      
        if (productCode === productCodeToRemove.toUpperCase()) {
          const href = deleteAnchor.getAttribute("href") || "";
          const match = href.match(/__doPostBack\('([^']+)'/);
      
          if (match) {
            eventTarget = match[1];
            console.log(`[SFL] Matched product '${productCodeToRemove}' — using eventTarget: ${eventTarget}`);
            break;
          }
        }
      }
      
      
      
        if (!eventTarget) {
          console.error(`[SFL] Could not find delete button for product ${productCodeToRemove}`);
          throw new Error("Delete button not found in DOM.");
        }
      
        // 3. Build form data for POST
        const form = doc.querySelector("form");
        const inputs = [...form.querySelectorAll("input[type=hidden]")];
        const formData = new URLSearchParams();
      
        inputs.forEach(input => {
          if (input.name) formData.append(input.name, input.value);
        });
      
        formData.set("__EVENTTARGET", eventTarget);
        formData.set("__EVENTARGUMENT", "");
      
        const postUrl = new URL(form.getAttribute("action"), detailUrl).href;
      
        const postRes = await fetch(postUrl, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: formData.toString()
        });
      
        const resText = await postRes.text();
        if (!resText.includes("QuicklistDetailGrid")) {
          console.error("[SFL] Response text preview:\n", resText.slice(0, 500));
          throw new Error("Failed to remove item from Quicklist.");
        }
      
        console.log("[SFL] Item successfully removed from Quicklist.");
      }
      
      
      
      
      
      
      
      
      
      
      
      
      
      
        async function refreshSfl() {
          // Re-run the loader from Phase 1
          const init = window.__sflReload;
          if (typeof init === "function") await init();
        }
      
        // Wire up the click handler
        document.addEventListener("click", async (e) => {
        const btn = e.target.closest(".js-sfl-add");
        if (!btn) return;
      
        btn.disabled = true;
        btn.textContent = "Adding…";
      
        const row = btn.closest(".sflRow");
        const pid = row?.dataset?.pid || null;
        const productCode = row?.dataset?.code || null;
      
        try {
          if (!pid) throw new Error("Missing PID for add-to-cart.");
      
          // 1. Add to cart
          await addPidToCart(pid, 1);
      
          // 2. Remove from Quicklist using productCode
          if (productCode) {
            await removeQuicklistLine(productCode);
            console.log("[SFL] Removed item from Saved For Later list");
          } else {
            throw new Error("Missing productCode for removal.");
          }
      
          // 3. Refresh UI
          console.log("[SFL] Refreshing ShoppingCart page to show updated cart...");
          location.replace(location.href);
      
          await refreshSfl();
        } catch (err) {
          console.error("[SFL] Add to cart/remove failed:", err);
          btn.textContent = "Try Again";
          btn.disabled = false;
        }
      });
      
      
        // Expose a hook Phase 1 can call to re-render
        window.__sflReload = async function() {
          const sflLoading = document.getElementById("sflLoading");
          if (sflLoading) sflLoading.style.display = "block";
      
          // Reload the detail list the same way Phase 1 did
          const detailUrl = sessionStorage.getItem("sfl_detail_url");
          if (!detailUrl) {
            location.reload();
            return;
          }
          const { text, doc } = await fetchHtml(detailUrl);
          const parse = (root) => {
            const grid = root.querySelector("#ctl00_PageBody_ctl01_QuicklistDetailGrid");
            if (!grid) return [];
            const table = grid.querySelector("table.rgMasterTable");
            if (!table) return [];
            const items = [];
            table.querySelectorAll("tbody > tr").forEach(tr => {
              const tds = tr.querySelectorAll("td");
              if (tds.length < 5) return;
              const a = tds[0].querySelector("a[href*='ProductDetail.aspx']");
              const href = a ? a.getAttribute("href") : null;
              const code = a ? a.textContent.trim() : "";
              const desc = tds[1].textContent.trim();
              const price = tds[2].textContent.trim();
              const per = tds[3].textContent.trim();
              const delA = tds[4].querySelector("a[href^='javascript:__doPostBack']");
              let target = null;
              if (delA) {
                const h = delA.getAttribute("href") || "";
                const m = h.match(/__doPostBack\('([^']+)'/);
                if (m) target = m[1];
              }
              items.push({ productHref: href, productCode: code, description: desc, price, per, eventTarget: target });
            });
            return items;
          };
          const items = parse(doc);
      
          // Re-draw rows (reusing Phase 1’s render)
          const list = document.getElementById("sflList");
          if (!list) return;
          list.innerHTML = "";
      
          const hdrCount = document.getElementById("sflCount");
          const loading = document.getElementById("sflLoading");
          const empty = document.getElementById("sflEmpty");
      
          function pidFromHref(href) {
            try {
              const u = new URL(href, location.origin + "/");
              return u.searchParams.get("pid");
            } catch (e) { return null; }
          }
          function productImageUrlFromPid(pid) {
            return "https://images-woodsonlumber.sirv.com/Other%20Website%20Images/placeholder.png";
          }
      
          if (!items.length) {
            if (hdrCount) hdrCount.textContent = "(0)";
            if (loading) loading.style.display = "none";
            if (list) list.style.display = "none";
            if (empty) empty.style.display = "block";
            return;
          }
      
          items.forEach(item => {
            const pid = item.productHref ? pidFromHref(item.productHref) : null;
            const img = productImageUrlFromPid(pid);
            const row = document.createElement("div");
            row.className = "sflRow";
            row.dataset.eventTarget = item.eventTarget || "";
            row.dataset.pid = pid || "";
            row.dataset.code = item.productCode || "";
            row.innerHTML = `
              <img class="sflImg" src="${img}" alt="">
              <div>
                <div class="sflTitle">${item.productCode || ""}</div>
                <div class="sflDesc">${item.description || ""}</div>
              </div>
              <div class="sflPrice">${item.price || ""}</div>
              <div class="sflPer">${item.per || ""}</div>
              <div class="sflActions">
                <button class="sflBtn js-sfl-add" data-pid="${pid || ""}" data-code="${item.productCode || ""}">Add to Cart</button>
              </div>
            `;
            list.appendChild(row);
          });
      
          if (hdrCount) hdrCount.textContent = `(${items.length})`;
          if (loading) loading.style.display = "none";
          if (empty) empty.style.display = "none";
          if (list) list.style.display = "block";
        };
      })();
      
      
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            
      
      
          
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      async function injectSaveForLaterButtons() {
        console.log("[SFL] Starting Save for Later button injection...");
      
        const cartItems = document.querySelectorAll(".shopping-cart-item");
        console.log(`[SFL] Found ${cartItems.length} cart items.`);
      
        cartItems.forEach((item, index) => {
          console.log(`[SFL] Processing cart item #${index+1}`);
      
          // 1) Get the product link & code
          const codeLink = item.querySelector("h6 a");
          const productCode = codeLink?.textContent.trim();
          if (!productCode) {
            console.warn("[SFL] No product code:", item);
            return;
          }
          console.log(`[SFL] Found product code: ${productCode}`);
      
          // 2) Extract pid from that href
          const pidMatch = codeLink.href?.match(/pid=(\d+)/);
          if (!pidMatch) {
            console.warn("[SFL] No pid in href:", codeLink.href);
            return;
          }
          const productId = pidMatch[1];
          console.log(`[SFL] Found pid: ${productId}`);
      
          // 3) Find the “Delete” link you created
          const deleteBtn = item.querySelector("a.delete-link");
          if (!deleteBtn) {
            console.warn("[SFL] Could not find delete-link in item:", item);
            return;
          }
      
          // 4) Build the SFL button
          const btn = document.createElement("button");
          btn.textContent = "Save for Later";
          btn.className = "btn btn-link text-primary btn-sm sfl-button";
          btn.style.marginLeft = "1rem";
      
          btn.addEventListener("click", async e => {
            e.preventDefault();
            btn.disabled = true;
            btn.textContent = "Saving…";
            try {
              await addToQuicklist(productId);
              // now trigger your Delete link to remove from cart
              deleteBtn.click();
            } catch (err) {
              console.error("[SFL] Failed to save for later:", err);
              btn.textContent = "Error – Try Again";
              btn.disabled = false;
            }
          });
      
          // 5) Inject into the placeholder
          const placeholder = item.querySelector(".sfl-placeholder");
          if (placeholder) {
            placeholder.appendChild(btn);
            console.log("[SFL] Injected Save for Later button.");
          } else {
            console.warn("[SFL] No .sfl-placeholder found");
          }
        });
      }
      
      
      
      
      async function removeCartItem(eventTarget) {
        const form = document.querySelector("form");
        const inputs = [...form.querySelectorAll("input[type=hidden]")];
        const formData = new URLSearchParams();
      
        inputs.forEach(input => {
          if (input.name) formData.append(input.name, input.value);
        });
      
        formData.set("__EVENTTARGET", eventTarget);
        formData.set("__EVENTARGUMENT", "");
      
        const postUrl = form.getAttribute("action");
      
        const res = await fetch(postUrl, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: formData.toString()
        });
      
        const resText = await res.text();
        if (!resText.includes("ShoppingCart.aspx")) {
          console.warn("[SFL] Remove POST response didn't contain expected content.");
        }
      }
      
      function addToQuicklist(productId) {
        console.log(`[SFL] Attempting to add ProductID ${productId} to Saved For Later...`);
      
        return new Promise((resolve, reject) => {
          const iframe = document.createElement("iframe");
          iframe.style.display = "none";
          iframe.src = `/ProductDetail.aspx?pid=${productId}`;
          document.body.appendChild(iframe);
      
          iframe.onload = () => {
            try {
              const doc = iframe.contentDocument || iframe.contentWindow.document;
      
              console.log("[SFL] Product detail iframe loaded.");
      
              const link = Array.from(doc.querySelectorAll("a")).find(
                a => a.textContent?.trim() === "Add to Saved For Later"
              );
      
              if (!link) {
                throw new Error("Could not find 'Add to Saved For Later' link in iframe.");
              }
      
              const href = link.getAttribute("href");
              const match = href.match(/__doPostBack\('([^']+)'/);
      
              if (!match || !match[1]) {
                throw new Error("Could not extract __doPostBack target.");
              }
      
              const postbackTarget = match[1];
              console.log(`[SFL] Found __EVENTTARGET: ${postbackTarget}`);
      
              const form = doc.forms[0];
              if (!form) throw new Error("Form not found in iframe.");
      
              form.__EVENTTARGET.value = postbackTarget;
              form.__EVENTARGUMENT.value = "";
      
              form.submit();
      
              console.log(`[SFL] Submitted postback to add product ${productId} to quicklist.`);
      
              // Give it time to complete, then cleanup
              setTimeout(() => {
                document.body.removeChild(iframe);
                resolve();
              }, 1500); // Adjust timing if needed
            } catch (err) {
              console.error("[SFL] Error in addToQuicklist via iframe:", err);
              document.body.removeChild(iframe);
              reject(err);
            }
          };
        });
      }
      
      
      
      
      
      
      console.log("[SFL] Script loaded – injecting Save for Later buttons...");
      injectSaveForLaterButtons();
      
      
      
      // Ensure it runs on page load
      document.addEventListener("DOMContentLoaded", () => {
        setTimeout(() => {
          try {
            injectSaveForLaterButtons();
          } catch (e) {
            console.error("[SFL] Error injecting Save for Later buttons:", e);
          }
        }, 1000); // slight delay for table rendering
      });
      
      
      
      
      }, 1000);
    } catch(e) {
      console.error('[WL.SavedForLater] error', e);
    }
  };
})();



(function(){
  var WL = window.WL || (window.WL = {});
  WL.DeliveryOptions = WL.DeliveryOptions || {};
  WL.DeliveryOptions.run = function(){
    try {
      if (!(window.jQuery && document.getElementById('ctl00_PageBody_CartSummary2_DeliveryCostsRow'))) return;
      $(function(){
        // 1) Check delivery cost
        var costText = $('#ctl00_PageBody_CartSummary2_DeliveryCostsRow td.numeric').text().trim();
        if (costText === '$250.00') {
          console.log('[DeliveryCheck] High delivery cost detected:', costText);
      
          // 2) Grab & detach the original Back-to-Cart anchor
          var $origBack = $('#ctl00_PageBody_BackToCartButton3').detach();
          var backJs = ($origBack.attr('href') || '')
            .replace(/^javascript:/, '');
      
          // 3) Build a “Change Address” link that sets currentStep=5 and then fires the same postback
          var $changeAddr = $(`
            <a href="#" id="changeAddressBtn" class="epi-button mr-2">
              <span>Change Address</span>
            </a>
          `).on('click', function(e){
            e.preventDefault();
            console.log('[DeliveryCheck] Change Address clicked');
            // set the localStorage step
            localStorage.setItem('currentStep', '5');
            // invoke the original postback
            try {
              eval(backJs);
            } catch (err) {
              console.error('[DeliveryCheck] Postback failed:', err);
            }
          });
      
          // 4) Build a new “Edit Cart” button
          var $editCart = $(`
            <a id="editCartBtn" class="epi-button" href="ShoppingCart.aspx">
              <span>Edit Cart</span>
            </a>
          `);
      
          // 5) Empty the mainContents and show a message + our two buttons
          var $container = $('.mainContents').empty();
          var $message = $(`
            <div class="delivery-error-message mb-4">
              An item in your cart is not eligible for delivery to your selected delivery address.<br>
              Please select a new address or remove the item from your cart.
            </div>
          `);
      
          $container
            .append($message)
            .append($('<div class="button-group"></div>')
              .append($changeAddr)
              .append($editCart)
            );
      
          console.log('[DeliveryCheck] Switched to delivery-error view');
        }
      });
      
      
      
      
      
      
      
      
      document.addEventListener('DOMContentLoaded', function () {
        const headers = document.querySelectorAll('th');
        headers.forEach(th => {
          if (th.textContent.trim() === 'Summary') {
            th.textContent = 'Shipping';
          }
        });
      });
      
      
      
      
      
      
      
      
      
      (function ($) {
        function initDeliveryWidget() {
          var $area = $('#ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_lstDeliveryAreas'),
              $opts = $('#ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_DeliveryOptionsDropDownList'),
              $summary = $('#SummaryEntry2'),
              $panel = $('#ctl00_PageBody_CartSummary2_DeliveryOptionsPanel');
      
          if (!$area.length || !$opts.length || !$area.is(':visible') || !$opts.is(':visible')) return;
      
          // Hide the select boxes (not removed for ASP.NET postback support)
          $area.closest('tr').css({
            position: 'absolute', width: '1px', height: '1px',
            overflow: 'hidden', clip: 'rect(1px, 1px, 1px, 1px)',
            clipPath: 'inset(50%)', whiteSpace: 'nowrap'
          });
      
          $opts.closest('tr').css({
            position: 'absolute', width: '1px', height: '1px',
            overflow: 'hidden', clip: 'rect(1px, 1px, 1px, 1px)',
            clipPath: 'inset(50%)', whiteSpace: 'nowrap'
          });
      
          $summary.find('.summaryTotals tr').filter(function () {
            return $(this).find('td:first').text().trim() === 'Total discount';
          }).hide();
      
          if (!$summary.find('.summary-card').length) {
            $summary.wrapInner(
              '<div class="card summary-card shadow-sm mb-4"><div class="card-body p-3"></div></div>'
            );
            $summary.find('.summaryTotals').addClass('table table-borderless mb-0');
          }
      
          $summary.prev('.shipping-card').remove();
          $summary.prev('.expected-widget').remove(); // clean up existing widget
      
          var standardText = $opts.find('option[value="-1"]').text(),
              mstd = standardText.match(/\(([^)]+)\)/),
              standardCost = mstd ? parseFloat(mstd[1].replace(/[^0-9\.-]/g, '')) : 0;
      
          var $ship = $(
            '<div class="card shipping-card shadow-sm mb-4">' +
              '<div class="card-header bg-light"><strong>Shipping Method</strong></div>' +
              '<div class="card-body">' +
                '<div class="delivery-summary text-muted small mb-2"></div>' +
                '<div class="delivery-pills d-flex flex-wrap mb-2"></div>' +
              '</div>' +
            '</div>'
          );
      
          if ($panel.length) {
            var summaryText = $panel.clone().children().first().html();
            if (summaryText) {
              $ship.find('.delivery-summary').html(summaryText);
            }
            $panel.css({
              position: 'absolute', width: '1px', height: '1px',
              overflow: 'hidden', clip: 'rect(1px, 1px, 1px, 1px)',
              clipPath: 'inset(50%)', whiteSpace: 'nowrap'
            });
          }
      
          function computeExpected(days) {
            const now = new Date();
            const total = new Date(now.getTime() + (days + 2) * 86400000);
            return total.toLocaleDateString(undefined, {
              month: 'long', day: 'numeric', year: 'numeric'
            });
          }
      
          function getArrowGraphic(speedLevel) {
            const totalArrows = 8;
            let arrows = '';
            for (let i = 1; i <= totalArrows; i++) {
              arrows += i <= speedLevel
                ? '<span class="maroon-arrow">➤</span>'
                : '<span class="gray-arrow">➤</span>';
            }
            return arrows;
          }
      
          function getSpeedLabel(speedLevel) {
            switch (speedLevel) {
              case 1: return 'Slowest Shipping';
              case 3: return 'Moderate Speed';
              case 6: return 'Fast Shipping';
              case 8: return 'Fastest Shipping';
              default: return 'Estimated Shipping';
            }
          }
      
          // Expected widget that appears after shipping card
          const $expectedWidget = $(
            '<div class="expected-widget text-center my-3">' +
              '<div class="shipping-speed-graphic mb-2"></div>' +
              '<div class="expected-by-text fw-bold fs-5 text-maroon"></div>' +
            '</div>'
          );
      
          $opts.find('option').each(function () {
            const $o = $(this),
                  txt = $o.text().trim(),
                  label = txt.replace(/\s*\(.*\)/, '').trim(),
                  extraMatch = txt.match(/\(([^)]+)\)/),
                  extraRaw = extraMatch ? extraMatch[1] : '',
                  extra = parseFloat(extraRaw.replace(/[^0-9\.-]/g, '')) || 0,
                  cost = $o.val() === '-1' ? standardCost : standardCost + extra,
                  costLbl = '$' + cost.toFixed(2),
                  days = /Next\s*Day/i.test(txt) ? 1 :
                         /2nd\s*Day/i.test(txt)  ? 2 :
                         /3\s*Day/i.test(txt)    ? 3 : 5,
                  speedLevel = /Next\s*Day/i.test(txt) ? 8 :
                               /2nd\s*Day/i.test(txt)  ? 6 :
                               /3\s*Day/i.test(txt)    ? 3 : 1,
                  $btn = $('<button type="button" class="btn btn-outline-primary m-1">' +
                          label + '<br><small>' + costLbl + '</small></button>');
      
            if ($o.is(':selected')) {
              $btn.removeClass('btn-outline-primary').addClass('btn-primary');
              $expectedWidget.find('.shipping-speed-graphic').html(getArrowGraphic(speedLevel));
              $expectedWidget.find('.expected-by-text').html(getSpeedLabel(speedLevel) + ' – Expected by ' + computeExpected(days));
            }
      
            $btn.on('click', function () {
              $opts.val($o.val()).change();
              $ship.find('button')
                .removeClass('btn-primary')
                .addClass('btn-outline-primary');
              $btn.removeClass('btn-outline-primary').addClass('btn-primary');
              $expectedWidget.find('.shipping-speed-graphic').html(getArrowGraphic(speedLevel));
              $expectedWidget.find('.expected-by-text').html(getSpeedLabel(speedLevel) + ' – Expected by ' + computeExpected(days));
            });
      
            $ship.find('.delivery-pills').append($btn);
          });
      
          $summary.before($expectedWidget);
          $summary.before($ship);
        }
      
        $(initDeliveryWidget);
      
        if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager) {
          Sys.WebForms.PageRequestManager.getInstance()
            .add_endRequest(initDeliveryWidget);
        }
      })(jQuery);
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      (function ($) {
        function hideDeliveryPanelIfOnlyAreaDropdownShown() {
          var $areaDropdown = $('#ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_lstDeliveryAreas');
          var $deliveryPanel = $('#ctl00_PageBody_CartSummary2_DeliveryOptionsPanel');
      
          // Bail if either doesn't exist
          if (!$areaDropdown.length || !$deliveryPanel.length) return;
      
          // Hide delivery panel if only area dropdown is shown
          var $otherVisibleSelects = $deliveryPanel.find('select').filter(function () {
            return $(this).attr('id') !== $areaDropdown.attr('id') && $(this).is(':visible');
          });
      
          if ($areaDropdown.is(':visible') && $otherVisibleSelects.length === 0) {
            $deliveryPanel.css({
              position: 'absolute',
              width: '1px',
              height: '1px',
              overflow: 'hidden',
              clip: 'rect(1px, 1px, 1px, 1px)',
              clipPath: 'inset(50%)',
              whiteSpace: 'nowrap'
            });
          }
      
          // Hide "Total discount" row wherever it appears
          $('tr').filter(function () {
            return $(this).find('td:first').text().trim() === 'Total discount';
          }).hide();
        }
      
        // Run on load
        $(hideDeliveryPanelIfOnlyAreaDropdownShown);
      
        // Run on partial postbacks
        if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager) {
          Sys.WebForms.PageRequestManager.getInstance()
            .add_endRequest(hideDeliveryPanelIfOnlyAreaDropdownShown);
        }
      })(jQuery);
    } catch(e) {
      console.error('[WL.DeliveryOptions] error', e);
    }
  };
})();



(function(){
  var WL = window.WL || (window.WL = {});
  WL.CheckoutWizard = WL.CheckoutWizard || {};
  WL.CheckoutWizard.run = function(){
    try {
      if (!(true)) return;
      // ─────────────────────────────────────────────────────────────────────────────
      // Woodson WebTrack Checkout Wizard (Modern Flow Rebuild + Fixes)
      // Fixes:
      //  1) Same-day pickup times must be >= 2 hours out
      //  2) Billing "same as delivery" persistence: if invoice fields blank after reload,
      //     auto-trigger CopyDeliveryAddress postback ONCE per session and return to Step 5
      // ─────────────────────────────────────────────────────────────────────────────
      (function () {
        
        // ---------------------------------------------------------------------------
        // HOTFIX: Some builds referenced getDeliveredSelected()/getPickupSelected()
        // but didn't define them, which breaks the wizard and greys out steps.
        // Keep these tiny and WebForms-safe.
        // ---------------------------------------------------------------------------
        function getDeliveredSelected() {
          const el = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbDelivered");
          if (el && el.checked) return true;
          // Fallback: modern selector buttons (no radio checked yet)
          try {
            const btn = document.querySelector(`.modern-shipping-selector button[data-value="rbDelivered"].is-selected, .modern-shipping-selector button[data-value="rbDelivered"].selected, .modern-shipping-selector button[data-value="rbDelivered"].active`);
            if (btn) return true;
          } catch {}
          return false;
        }
        function getPickupSelected() {
          const el = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbCollectLater");
          if (el && el.checked) return true;
          // Fallback: modern selector buttons (no radio checked yet)
          try {
            const btn = document.querySelector(`.modern-shipping-selector button[data-value="rbCollectLater"].is-selected, .modern-shipping-selector button[data-value="rbCollectLater"].selected, .modern-shipping-selector button[data-value="rbCollectLater"].active`);
            if (btn) return true;
          } catch {}
          return false;
        }
        function getSaleType() {
          return getPickupSelected() ? 'pickup' : (getDeliveredSelected() ? 'delivered' : '');
        }
      
      // ---------------------------------------------------------------------------
        // 0) Storage helpers (TTL for step; sessionStorage for returnStep)
        // ---------------------------------------------------------------------------
        const STEP_KEY = "wl_currentStep";
        const SAME_KEY = "wl_sameAsDelivery";
        const TTL_MS = 10 * 60 * 1000; // 10 minutes
      
        function setWithExpiry(key, value, ttlMs) {
          try {
            localStorage.setItem(
              key,
              JSON.stringify({ value, expiry: Date.now() + ttlMs })
            );
          } catch {}
        }
        function getWithExpiry(key) {
          try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const item = JSON.parse(raw);
            if (!item || typeof item !== "object" || !("expiry" in item)) {
              localStorage.removeItem(key);
              return null;
            }
            if (Date.now() > item.expiry) {
              localStorage.removeItem(key);
              return null;
            }
            return item.value;
          } catch {
            return null;
          }
        }
      
        function setStep(n) {
          setWithExpiry(STEP_KEY, String(n), TTL_MS);
        }
        function getStep() {
          const v = getWithExpiry(STEP_KEY);
          return v != null ? parseInt(v, 10) : null;
        }
      
        function setSameAsDelivery(val) {
          try {
            localStorage.setItem(SAME_KEY, val ? "true" : "false");
          } catch {}
        }
        function getSameAsDelivery() {
          try {
            return localStorage.getItem(SAME_KEY) === "true";
          } catch {
            return false;
          }
        }
      
        function setReturnStep(n) {
          try {
            sessionStorage.setItem("wl_returnStep", String(n));
          } catch {}
        }
        function consumeReturnStep() {
          try {
            const v = sessionStorage.getItem("wl_returnStep");
            if (v) sessionStorage.removeItem("wl_returnStep");
            return v ? parseInt(v, 10) : null;
          } catch {
            return null;
          }
        }
      
        function setExpectedNav(flag) {
          try {
            sessionStorage.setItem("wl_expect_nav", flag ? "1" : "0");
          } catch {}
        }
        function consumeExpectedNav() {
          try {
            const v = sessionStorage.getItem("wl_expect_nav") === "1";
            sessionStorage.removeItem("wl_expect_nav");
            return v;
          } catch {
            return false;
          }
        }
      
        // One-time per-session guard for auto-copy
        function markAutoCopyDone() {
          try { sessionStorage.setItem("wl_autocopy_done", "1"); } catch {}
        }
        function autoCopyAlreadyDone() {
          try { return sessionStorage.getItem("wl_autocopy_done") === "1"; } catch { return false; }
        }
      
        window.WLCheckout = window.WLCheckout || {};
        window.WLCheckout.setStep = setStep;
        window.WLCheckout.getStep = getStep;
        window.WLCheckout.setReturnStep = setReturnStep;
        window.WLCheckout.TTL_MS = TTL_MS;
      
        // ---------------------------------------------------------------------------
        // 1) DOM Ready
        // ---------------------------------------------------------------------------
        document.addEventListener("DOMContentLoaded", function () {
          const $ = window.jQuery;
      
          // -------------------------------------------------------------------------
          // A) Hide legacy UI bits
          // -------------------------------------------------------------------------
          try {
            const dateColDefault = document.getElementById(
              "ctl00_PageBody_dtRequired_DatePicker_wrapper"
            );
            if (dateColDefault) dateColDefault.style.display = "none";
      
            if ($) {
              $("label")
                .filter(function () {
                  return $(this).text().trim() === "Date required:";
                })
                .hide();
              $("div.form-control").hide();
              $("#ctl00_PageBody_dtRequired_DatePicker_wrapper").hide();
              $("#ctl00_PageBody_dtRequired_DatePicker_wrapper")
                .closest(".epi-form-col-single-checkout.epi-form-group-checkout")
                .hide();
      
              $(".submit-button-panel").hide();
            }
      
            if ($) $("#ctl00_PageBody_BackToCartButton2").val("Back to Cart");
          } catch {}
      
          // -------------------------------------------------------------------------
          // B) Build wizard container only once
          // -------------------------------------------------------------------------
          const container = document.querySelector(".container");
          if (!container) return;
      
          if (document.querySelector(".checkout-wizard")) return;
      
          const wizard = document.createElement("div");
          wizard.className = "checkout-wizard";
          container.insertBefore(wizard, container.firstChild);
      
          const nav = document.createElement("ul");
          nav.className = "checkout-steps";
          wizard.appendChild(nav);
      
          function isEl(x) {
            return x && x.nodeType === 1;
          }
      
          // -------------------------------------------------------------------------
          // C) Steps definition
          // -------------------------------------------------------------------------
          const steps = [
            {
              title: "Ship/Pickup",
              findEls: () => {
                const ship = document.getElementById(
                  "ctl00_PageBody_SaleTypeSelector_lblDelivered"
                );
                return ship ? [ship.closest(".epi-form-col-single-checkout")] : [];
              },
            },
            {
              title: "Branch",
              findEls: () => {
                const br = document.getElementById("ctl00_PageBody_BranchSelector");
                return br ? [br] : [];
              },
            },
            {
              title: "Delivery Address",
              findEls: () => {
                const hdr = document.querySelector(".SelectableAddressType");
                return hdr ? [hdr.closest(".epi-form-col-single-checkout")] : [];
              },
            },
            {
              title: "Billing Address",
              findEls: () => {
                const gp = document.getElementById(
                  "ctl00_PageBody_InvoiceAddress_GoogleAddressSearchWrapper"
                );
                return gp ? [gp.closest(".epi-form-col-single-checkout")] : [];
              },
            },
            {
              title: "Date & Instructions",
              findEls: () => {
                const arr = [];
      
                const po = document.getElementById(
                  "ctl00_PageBody_PurchaseOrderNumberTextBox"
                );
                if (po) {
                  const wrap =
                    po.closest(".epi-form-group-checkout") ||
                    po.closest(".epi-form-col-single-checkout") ||
                    po.parentElement;
                  if (wrap) arr.push(wrap);
                }
                const tbl = document.querySelector(".cartTable");
                if (tbl) arr.push(tbl.closest("table"));
                const si = document.getElementById("ctl00_PageBody_SpecialInstructionsTextBox");
                if (si) {
                  const wrap =
                    si.closest(".epi-form-group-checkout") ||
                    si.closest(".epi-form-col-single-checkout") ||
                    si.parentElement;
                  if (wrap) arr.push(wrap);
                }
                return arr;
              },
            },
          ];
      
          
          // -------------------------------------------------------------------------
          // C.5) Pickup mode + address syncing helpers (WebForms-safe)
          // New step numbers after removing Order Details:
          //  1 Ship/Pickup, 2 Branch (pickup only), 3 Delivery Address (delivered only),
          //  4 Billing Address, 5 Date & Instructions (includes Your reference)
          // -------------------------------------------------------------------------
          function getBranchField() {
            const host = document.getElementById("ctl00_PageBody_BranchSelector");
            if (!host) return null;
            if (host.tagName === "SELECT" || host.tagName === "INPUT") return host;
            return host.querySelector("select, input");
          }
      
          function isBranchChosen(field) {
            if (!field) return false;
            const v = norm(field.value);
            if (!v || v === "0") return false;
            if (field.tagName === "SELECT" && field.selectedIndex <= 0) {
              const opt0 = field.options && field.options[0] ? norm(field.options[0].value) : "";
              if (!opt0 || opt0 === "0") return false;
            }
            return true;
          }
      
          function autoSelectDefaultBranch() {
            const field = getBranchField();
            if (!field) return false;
            if (isBranchChosen(field)) return true;
      
            // Try last used branch first
            let last = "";
            try { last = localStorage.getItem("wl_last_branch") || ""; } catch {}
            if (last && field.tagName === "SELECT") {
              const opts = Array.from(field.options || []);
              const match = opts.find(o => norm(o.value) === norm(last));
              if (match) { field.value = match.value; return isBranchChosen(field); }
            }
      
            // Otherwise pick first non-placeholder option
            if (field.tagName === "SELECT") {
              const opts = Array.from(field.options || []);
              const candidate = opts.find(o => {
                const val = norm(o.value);
                const txt = norm(o.textContent || o.text || "");
                return val && val !== "0" && !/^select/i.test(txt);
              });
              if (candidate) {
                field.value = candidate.value;
                return isBranchChosen(field);
              }
            }
            return false;
          }
      
          function setStepVisibility(stepNum, isVisible) {
            const li = nav.querySelector(`li[data-step="${stepNum}"]`);
            const pane = wizard.querySelector(`.checkout-step[data-step="${stepNum}"]`);
            if (li) li.style.display = isVisible ? "" : "none";
            if (pane) pane.style.display = isVisible ? "" : "none";
          }
      
          function setDeliverySectionVisibility(isVisible) {
            // Keep underlying server controls in DOM, but hide the whole visual block.
            const pane4 = wizard.querySelector('.checkout-step[data-step="3"]');
            if (!pane4) return;
            const col = pane4.querySelector(".epi-form-col-single-checkout");
            if (col) col.style.display = isVisible ? "" : "none";
          }
      
          // In Pickup mode we hide the Delivery step, but WebTrack still requires a phone.
          // We surface the Delivery phone field inside Billing step so customers can complete it.
          function mountPickupPhoneInBilling(enable) {
            const phoneEl = document.getElementById("ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox");
            if (!phoneEl) return;
      
            let row = phoneEl.closest(".epi-form-group") || phoneEl.closest("div");
            if (!row) row = phoneEl.parentElement;
            if (!row) return;
      
            if (!row.dataset.wlOrigParentId) {
              const p = row.parentElement;
              if (p) {
                if (!p.id) p.id = "wl_del_phone_parent_" + Math.random().toString(16).slice(2);
                row.dataset.wlOrigParentId = p.id;
              }
            }
      
            const pane4 = wizard.querySelector('.checkout-step[data-step="4"]');
            if (!pane4) return;
            const target = pane4.querySelector(".epi-form-col-single-checkout") || pane4;
      
            if (enable) {
              if (!pane4.contains(row)) {
                const holderId = "wlPickupPhoneHolder";
                let holder = document.getElementById(holderId);
                if (!holder) {
                  holder = document.createElement("div");
                  holder.id = holderId;
                  holder.className = "wl-pickup-phone mb-3";
                  holder.innerHTML = `<div class="font-weight-bold mb-1">Phone (for order updates)</div>`;
                  target.insertBefore(holder, target.firstChild);
                }
                holder.appendChild(row);
              }
              row.style.display = "";
            } else {
              const origId = row.dataset.wlOrigParentId;
              const orig = origId ? document.getElementById(origId) : null;
              if (orig && !orig.contains(row)) orig.appendChild(row);
            }
          }
      
          function updatePickupModeUI() {
            const pickup = getPickupSelected();
            const delivered = getDeliveredSelected();
      
            // Step 2 Branch: show for Pickup, hide for Delivered.
            setStepVisibility(2, !!pickup);
      
            if (!pickup && delivered) {
              // Ensure branch has a default value so WebTrack doesn't complain later.
              autoSelectDefaultBranch();
            }
      
            // Step 3 Delivery Address: hide + skip in pickup mode
            setStepVisibility(3, !pickup);
            setDeliverySectionVisibility(!pickup);
      
            // Phone requirement: surface delivery phone inside billing when pickup
            mountPickupPhoneInBilling(!!pickup);
      
            // If pickup, keep Delivery inputs populated from Billing to satisfy required server fields.
            if (pickup) syncBillingToDelivery();
          }
      
          window.WLCheckout = window.WLCheckout || {};
          window.WLCheckout.updatePickupModeUI = updatePickupModeUI;
          window.WLCheckout.syncBillingToDelivery = syncBillingToDelivery;
          function norm(s) { return String(s || "").trim(); }
      
          function setIf(el, val) {
            if (!el) return;
            el.value = val;
            // IMPORTANT: don't trigger change/input on server controls unless needed.
          }
      
          function selectByText(selectEl, text) {
            if (!selectEl) return false;
            const t = norm(text).toLowerCase();
            if (!t) return false;
            const opts = Array.from(selectEl.options || []);
            // exact match
            let hit = opts.find(o => norm(o.text).toLowerCase() === t) || null;
            // try abbreviations (TX -> Texas) and vice versa
            if (!hit && t.length === 2) {
              const map = { al:"alabama", ak:"alaska", az:"arizona", ar:"arkansas", ca:"california", co:"colorado", ct:"connecticut",
                de:"delaware", fl:"florida", ga:"georgia", hi:"hawaii", id:"idaho", il:"illinois", in:"indiana", ia:"iowa", ks:"kansas",
                ky:"kentucky", la:"louisiana", me:"maine", md:"maryland", ma:"massachusetts", mi:"michigan", mn:"minnesota", ms:"mississippi",
                mo:"missouri", mt:"montana", ne:"nebraska", nv:"nevada", nh:"new hampshire", nj:"new jersey", nm:"new mexico", ny:"new york",
                nc:"north carolina", nd:"north dakota", oh:"ohio", ok:"oklahoma", or:"oregon", pa:"pennsylvania", ri:"rhode island",
                sc:"south carolina", sd:"south dakota", tn:"tennessee", tx:"texas", ut:"utah", vt:"vermont", va:"virginia", wa:"washington",
                wv:"west virginia", wi:"wisconsin", wy:"wyoming", dc:"district of columbia" };
              const full = map[t];
              if (full) hit = opts.find(o => norm(o.text).toLowerCase() === full) || null;
            }
            if (hit) {
              selectEl.value = hit.value;
              return true;
            }
            return false;
          }
      
          function showInlineError(stepNum, msg) {
            const pane = wizard.querySelector(`.checkout-step[data-step="${stepNum}"]`);
            if (!pane) return;
            let box = pane.querySelector(".wl-inline-error");
            if (!box) {
              box = document.createElement("div");
              box.className = "wl-inline-error alert alert-warning";
              box.style.marginBottom = "12px";
              pane.insertBefore(box, pane.firstChild);
            }
            box.innerHTML = msg;
          }
      
          function clearInlineError(stepNum) {
            const pane = wizard.querySelector(`.checkout-step[data-step="${stepNum}"]`);
            const box = pane && pane.querySelector(".wl-inline-error");
            if (box) box.remove();
          }
      
          function validateZip(zip) {
            const z = norm(zip).replace(/\s/g, "");
            return /^\d{5}(-\d{4})?$/.test(z);
          }
          function validatePhone(phone) {
            const p = norm(phone).replace(/[^\d]/g, "");
            return p.length >= 10;
          }
          function validateEmail(email) {
            const e = norm(email).replace(/^\([^)]*\)\s*/, "");
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
          }
      
          function validateAddressBlock(prefix, stepNum, requireEmail) {
            // prefix: "DeliveryAddress" or "InvoiceAddress"
            const line1 = document.getElementById(`ctl00_PageBody_${prefix}_AddressLine1`);
            const city  = document.getElementById(`ctl00_PageBody_${prefix}_City`);
            const zip   = document.getElementById(`ctl00_PageBody_${prefix}_Postcode`);
            const state = document.getElementById(`ctl00_PageBody_${prefix}_CountySelector_CountyList`);
            const country = document.getElementById(`ctl00_PageBody_${prefix}_CountrySelector${prefix==="InvoiceAddress" ? "1" : ""}`);
            const phone = document.getElementById(`ctl00_PageBody_${prefix}_ContactTelephoneTextBox`);
            const email = prefix==="InvoiceAddress" ? document.getElementById("ctl00_PageBody_InvoiceAddress_EmailAddressTextBox") : null;
      
            // Some WebTrack builds don’t have a Billing/Invoice phone field.
            // In those cases, we validate (and later submit) the Delivery phone field instead.
            const phoneFallback = (!phone && prefix==="InvoiceAddress") ? document.getElementById("ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox") : null;
      
            const missing = [];
            if (!norm(line1 && line1.value)) missing.push("Street address");
            if (!norm(city && city.value)) missing.push("City");
            if (!(state && norm(state.value))) missing.push("State");
            if (!validateZip(zip && zip.value)) missing.push("ZIP");
            const phoneVal = (phone && phone.value) ? phone.value : (phoneFallback && phoneFallback.value) ? phoneFallback.value : "";
            if (!validatePhone(phoneVal)) missing.push("Phone");
            if (requireEmail && !validateEmail(email && email.value)) missing.push("Email");
      
            if (country && !norm(country.value)) {
              // default to USA without triggering postbacks
              try { country.value = "USA"; } catch {}
            }
      
            if (missing.length) {
              showInlineError(stepNum,
                `<strong>We just need a bit more info.</strong><br>` +
                `Please enter: <em>${missing.join(", ")}</em>.`
              );
              return false;
            }
      
            clearInlineError(stepNum);
            return true;
          }
      
          function syncBillingToDelivery() {
            // Copy invoice/billing fields into delivery fields (no postback).
            // This keeps pickup checkout "shoppable" by only asking for billing.
            const map = [
              ["ctl00_PageBody_InvoiceAddress_ContactFirstNameTextBox","ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox"],
              ["ctl00_PageBody_InvoiceAddress_ContactLastNameTextBox","ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox"],
              ["ctl00_PageBody_InvoiceAddress_ContactTelephoneTextBox","ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox"],
              ["ctl00_PageBody_InvoiceAddress_AddressLine1","ctl00_PageBody_DeliveryAddress_AddressLine1"],
              ["ctl00_PageBody_InvoiceAddress_AddressLine2","ctl00_PageBody_DeliveryAddress_AddressLine2"],
              ["ctl00_PageBody_InvoiceAddress_AddressLine3","ctl00_PageBody_DeliveryAddress_AddressLine3"],
              ["ctl00_PageBody_InvoiceAddress_City","ctl00_PageBody_DeliveryAddress_City"],
              ["ctl00_PageBody_InvoiceAddress_Postcode","ctl00_PageBody_DeliveryAddress_Postcode"],
            ];
      
            map.forEach(([fromId,toId]) => {
              const from = document.getElementById(fromId);
              const to = document.getElementById(toId);
              if (from && to) setIf(to, from.value);
            });
      
            // Country selectors differ between delivery/invoice
            const invCountry = document.getElementById("ctl00_PageBody_InvoiceAddress_CountrySelector1");
            const delCountry = document.getElementById("ctl00_PageBody_DeliveryAddress_CountrySelector");
            if (invCountry && delCountry) setIf(delCountry, invCountry.value || "USA");
            if (delCountry && !norm(delCountry.value)) delCountry.value = "USA";
      
            // State dropdown by visible text
            const invState = document.getElementById("ctl00_PageBody_InvoiceAddress_CountySelector_CountyList");
            const delState = document.getElementById("ctl00_PageBody_DeliveryAddress_CountySelector_CountyList");
            if (invState && delState) {
              const invText = invState.selectedOptions && invState.selectedOptions[0] ? invState.selectedOptions[0].text : "";
              if (invText) selectByText(delState, invText);
            }
          }
      
          function updatePickupModeUI() {
            const pickup = getPickupSelected();
            const delivered = getDeliveredSelected();
      
            // Branch: show for Pickup (customer chooses), hide for Delivered/Shipping (route internally).
            setStep4Visibility(!!pickup);
      
            if (!pickup && delivered) {
              // Ensure branch has a default value so WebTrack doesn't complain later.
              autoSelectDefaultBranch();
            }
      
            // Delivery address UI: hide and skip in pickup mode, but still satisfy required fields.
            setStep5Visibility(!pickup);
            setDeliverySectionVisibility(!pickup);
      
            // Surface required phone field in billing step when pickup (delivery step hidden)
            mountPickupPhoneInBilling(!!pickup);
      
            // If pickup, keep Delivery inputs populated from Billing to satisfy required server fields.
            if (pickup) syncBillingToDelivery();
          }
      
          window.WLCheckout = window.WLCheckout || {};
          window.WLCheckout.updatePickupModeUI = updatePickupModeUI;
          window.WLCheckout.syncBillingToDelivery = syncBillingToDelivery;
      // -------------------------------------------------------------------------
          // D) Create step panes + nav buttons
          // -------------------------------------------------------------------------
          steps.forEach(function (step, i) {
            const num = i + 1;
      
            const li = document.createElement("li");
            li.dataset.step = String(num);
            li.textContent = step.title;
            li.addEventListener("click", () => showStep(num));
            nav.appendChild(li);
      
            const pane = document.createElement("div");
            pane.className = "checkout-step";
            pane.dataset.step = String(num);
            wizard.appendChild(pane);
      
            step.findEls()
              .filter(isEl)
              .forEach((el) => pane.appendChild(el));
      
            const navDiv = document.createElement("div");
            navDiv.className = "checkout-nav";
            pane.appendChild(navDiv);
      
            if (num > 1) {
              const back = document.createElement("button");
              back.type = "button";
              back.className = "btn btn-secondary wl-back";
              back.dataset.wlBack = String(num - 1);
              back.textContent = "Back";
              back.addEventListener("click", (e) => {
                e.preventDefault();
                showStep(num - 1);
              });
              navDiv.appendChild(back);
            }
      
            if (num < steps.length) {
              const next = document.createElement("button");
              next.type = "button";
              next.className = "btn btn-primary wl-next";
              next.dataset.wlNext = String(num + 1);
              next.textContent = "Next";
              next.addEventListener("click", (e) => {
                e.preventDefault();
                const cur = getActiveStep ? getActiveStep() : num;
                // Validate current step and use smart skipping rules
                if (typeof validateStep === "function" && !validateStep(cur)) return;
                if (typeof goNextFrom === "function") { goNextFrom(cur); return; }
                showStep(cur + 1);
              });
              navDiv.appendChild(next);
            } else {
              const conts = Array.from(
                document.querySelectorAll(
                  "#ctl00_PageBody_ContinueButton1,#ctl00_PageBody_ContinueButton2"
                )
              );
              if (conts.length) {
                const cont = conts.pop();
                cont.style.display = "";
                cont.type = "submit";
                navDiv.appendChild(cont);
              }
            }
          });
      
          
          // -------------------------------------------------------------------------
          // E.2) ASP.NET UpdatePanel / async postback resilience
          // - Selecting Delivered/Pickup can trigger an async postback that disables
          //   arbitrary buttons on the page. Our injected "Next" buttons are not known
          //   to WebForms, so they can remain disabled unless we re-enable them after
          //   the request completes.
          // -------------------------------------------------------------------------
          function reEnableWizardNav() {
            try {
              wizard.querySelectorAll("button").forEach((b) => {
                b.disabled = false;
                b.removeAttribute("disabled");
                b.classList.remove("aspNetDisabled");
              });
            } catch {}
          }
      
          function hookAspNetAjax() {
            try {
              const prm = window.Sys && window.Sys.WebForms && window.Sys.WebForms.PageRequestManager
                ? window.Sys.WebForms.PageRequestManager.getInstance()
                : null;
              if (!prm || prm.__wlHooked) return;
              prm.__wlHooked = true;
      
              prm.add_endRequest(function () {
                // Re-enable our injected buttons and re-apply mode visibility
                reEnableWizardNav();
      // If a ship/pickup selection triggered a postback, advance to the next logical step.
      try {
        const ps = sessionStorage.getItem("wl_pendingStep");
        if (ps) {
          sessionStorage.removeItem("wl_pendingStep");
          const n = parseInt(ps, 10);
          if (Number.isFinite(n)) showStep(n);
        }
      } catch {}
      
                try { updatePickupModeUI(); } catch {}
          // If a full postback happened (not UpdatePanel), consume pending step here as well.
          try {
            const ps = sessionStorage.getItem("wl_pendingStep");
            if (ps) {
              sessionStorage.removeItem("wl_pendingStep");
              const n = parseInt(ps, 10);
              if (Number.isFinite(n)) showStep(n);
            }
          } catch {}
      
                // If the active step became invalid for the selected mode, snap to the first required step.
                try {
                  const a = getActiveStep ? getActiveStep() : 1;
                  if (getPickupSelected() && a === 3) showStep(2); // pickup must choose Branch before billing
                  if (getDeliveredSelected() && !getPickupSelected() && a === 2) showStep(3);
                } catch {}
      
                // Date module visibility can get reset by partial updates
                try {
                  if (window.WLCheckout && typeof window.WLCheckout.refreshDateUI === "function") {
                    window.WLCheckout.refreshDateUI();
                  }
                } catch {}
              });
            } catch {}
          }
      
          // Hook immediately (safe even if Sys isn't present)
          hookAspNetAjax();
          // Also run once in case something disabled buttons during initial render
          reEnableWizardNav();
      
          // Consume any pending step after a FULL postback (UpdatePanel hooks won't fire).
          try {
            const ps = sessionStorage.getItem("wl_pendingStep");
            if (ps) {
              sessionStorage.removeItem("wl_pendingStep");
              const n = parseInt(ps, 10);
              if (Number.isFinite(n)) showStep(n);
            } else {
              // If WebForms restored an unexpected step, clamp to the first required step
              // so the user sees the right flow:
              //  - Pickup: Step 2 (Branch) -> Step 4 (Billing) -> Step 5 (Date & Instructions)
              //  - Delivery: Step 3 (Delivery Address) -> Step 4 -> Step 5
              const a = (typeof getActiveStep === "function") ? getActiveStep() : 1;
              if (getPickupSelected() && a >= 4) showStep(2);
              if (getDeliveredSelected() && !getPickupSelected() && a === 2) showStep(3);
            }
          } catch {}
      
      
          // -------------------------------------------------------------------------
          // E) Step switching + persistence
          // -------------------------------------------------------------------------
          function showStep(n) {
            // If Pickup is selected, skip Delivery Address (Step 3)
            if (getPickupSelected() && n === 3) n = 4;
            // If Delivered/Shipping is selected, hide Branch (Step 2)
            if (getDeliveredSelected() && !getPickupSelected() && n === 2) n = 3;
            wizard
              .querySelectorAll(".checkout-step")
              .forEach((p) => p.classList.toggle("active", +p.dataset.step === n));
      
            nav.querySelectorAll("li").forEach((li) => {
              const s = +li.dataset.step;
              li.classList.toggle("active", s === n);
              li.classList.toggle("completed", s < n);
            });
      
            setStep(n);
            try {
              window.scrollTo({ top: wizard.offsetTop, behavior: "smooth" });
            } catch {}
          }
      
          window.WLCheckout.showStep = showStep;
      
      // -------------------------------------------------------------------------
      // E.1) Delegated nav handlers (survive UpdatePanel partial refresh)
      // -------------------------------------------------------------------------
      document.addEventListener("click", function (ev) {
        const btn = ev.target && ev.target.closest ? ev.target.closest("button") : null;
        if (!btn) return;
      
        // Delegated handlers must respect the wizard's smart-routing rules, especially
        // after UpdatePanel refreshes (the direct listeners may be lost).
        if (btn.dataset && btn.dataset.wlNext) {
          ev.preventDefault();
          const cur = (typeof getActiveStep === "function") ? getActiveStep() : 1;
          if (typeof validateStep === "function" && !validateStep(cur)) return;
          if (typeof goNextFrom === "function") { goNextFrom(cur); return; }
          const to = parseInt(btn.dataset.wlNext, 10);
          if (Number.isFinite(to)) showStep(to);
          return;
        }
      
        if (btn.dataset && btn.dataset.wlBack) {
          ev.preventDefault();
          const cur = (typeof getActiveStep === "function") ? getActiveStep() : 1;
          const to = parseInt(btn.dataset.wlBack, 10);
          // Prefer explicit back target if present, otherwise just go back one step.
          if (Number.isFinite(to)) { showStep(to); return; }
          showStep(Math.max(1, cur - 1));
          return;
        }
      }, true);
      
      
      
      
          // -------------------------------------------------------------------------
          // E.5) Wizard navigation intercept: validate + skip Step 5 in Pickup mode
          // -------------------------------------------------------------------------
          function getActiveStep() {
            const active = wizard.querySelector(".checkout-step.active");
            return active ? parseInt(active.dataset.step, 10) : 1;
          }
      
          function goNextFrom(stepNum) {
            let next = stepNum + 1;
            // Skip Branch step if delivered/shipping
            if (getDeliveredSelected() && !getPickupSelected() && next === 2) next = 3;
            // Skip Delivery Address step if pickup
            if (getPickupSelected() && next === 3) next = 4;
            showStep(next);
          }
      
          function validateStep(stepNum) {
            // Lightweight, client-side validation to prevent "stuck" moments.
            // Server validation still runs on final Continue.
            if (stepNum === 1) {
              // Ship/Pickup selected?
              const rbPick = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbCollectLater");
              const rbDel = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbDelivered");
              if (!(rbPick && rbPick.checked) && !(rbDel && rbDel.checked)) {
                // If using the modern button selector, infer selection from the active button
                try {
                  const btnDel = document.querySelector('.modern-shipping-selector button[data-value="rbDelivered"].is-selected, .modern-shipping-selector button[data-value="rbDelivered"].selected, .modern-shipping-selector button[data-value="rbDelivered"].active');
                  const btnPick = document.querySelector('.modern-shipping-selector button[data-value="rbCollectLater"].is-selected, .modern-shipping-selector button[data-value="rbCollectLater"].selected, .modern-shipping-selector button[data-value="rbCollectLater"].active');
                  if (btnDel && rbDel) { rbDel.checked = true; }
                  if (btnPick && rbPick) { rbPick.checked = true; }
                } catch {}
      
                if (!(rbPick && rbPick.checked) && !(rbDel && rbDel.checked)) {
                  showInlineError(1, "<strong>Please choose:</strong> Delivered or Pickup.");
                  return false;
                }
              }
              clearInlineError(1);
              updatePickupModeUI();
              return true;
            }
      
            if (stepNum === 2) {
              // Branch is REQUIRED for Pickup (customer chooses pickup store).
              // For Delivered/Shipping, we can default a branch operationally (Amazon-style).
              const field = getBranchField();
      
              if (getPickupSelected()) {
                if (field && !isBranchChosen(field)) {
                  showInlineError(2, "<strong>Please select a store/branch</strong> so we can route your pickup order.");
                  return false;
                }
                clearInlineError(3);
                // Remember for next time
                try { if (field && norm(field.value)) localStorage.setItem("wl_last_branch", norm(field.value)); } catch {}
                return true;
              }
      
              // Delivered/Shipping: attempt to auto-select a default branch if none chosen.
              // We still keep the server control satisfied, but we don't block the customer here.
              if (field && !isBranchChosen(field)) {
                autoSelectDefaultBranch();
              }
              clearInlineError(2);
              // Remember for next time
              try { if (field && norm(field.value)) localStorage.setItem("wl_last_branch", norm(field.value)); } catch {}
              return true;
            }
      
            if (stepNum === 3) {
              // Delivery step is hidden in pickup mode.
              if (getPickupSelected()) return true;
              return validateAddressBlock("DeliveryAddress", 3, false);
            }
      
            if (stepNum === 4) {
              // Billing is always required (and is used to satisfy Delivery when pickup).
              const ok = validateAddressBlock("InvoiceAddress", 4, true);
              if (!ok) return false;
      
              if (getPickupSelected()) {
                syncBillingToDelivery();
                // Also, if Delivery Address step is hidden (pickup), make sure required server fields are not blank.
                clearInlineError(2);
              }
              return true;
            }
      
            return true;
          }
      
          // Intercept our wizard "Next" buttons (not the final Continue submit button).
          wizard.addEventListener(
            "click",
            function (e) {
              const btn = e.target && e.target.closest ? e.target.closest("button.btn.btn-primary") : null;
              if (!btn) return;
      
              // Only intercept our "Next" buttons (not the ContinueButton which is submit)
              if (btn.type === "submit") return;
              if ((btn.textContent || "").trim().toLowerCase() !== "next") return;
      
              const stepNum = getActiveStep();
              e.preventDefault();
              e.stopPropagation();
      
              if (!validateStep(stepNum)) {
                showStep(stepNum);
                return;
              }
              goNextFrom(stepNum);
            },
            true
          );
      
      
          // -------------------------------------------------------------------------
          // F) Postback-safe returnStep logic (core fix)
          // -------------------------------------------------------------------------
          function bindReturnStepFor(selector, stepNum, eventName) {
            const ev = eventName || "change";
            const el = document.querySelector(selector);
            if (!el) return;
            el.addEventListener(
              ev,
              function () {
                setReturnStep(stepNum);
              },
              true // capture
            );
          }
      
          bindReturnStepFor("#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList", 3, "change");
          bindReturnStepFor("#ctl00_PageBody_DeliveryAddress_CountrySelector", 3, "change");
      
          bindReturnStepFor("#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList", 4, "change");
          bindReturnStepFor("#ctl00_PageBody_InvoiceAddress_CountrySelector1", 4, "change");
      
          bindReturnStepFor("#ctl00_PageBody_BranchSelector", 2, "change");
          // If the branch control is a wrapper div, bind to its inner select/input as well.
          bindReturnStepFor("#ctl00_PageBody_BranchSelector select", 2, "change");
          bindReturnStepFor("#ctl00_PageBody_BranchSelector input", 2, "change");
      
          // -------------------------------------------------------------------------
          // G) Delivery summary/edit (Step 5)
          // -------------------------------------------------------------------------
          (function () {
            const pane4 = wizard.querySelector('.checkout-step[data-step="3"]');
            if (!pane4) return;
      
            const col = pane4.querySelector(".epi-form-col-single-checkout");
            if (!col) return;
      
            const wrap = document.createElement("div");
            const sum = document.createElement("div");
            wrap.className = "delivery-inputs";
            sum.className = "delivery-summary";
      
            while (col.firstChild) wrap.appendChild(col.firstChild);
            col.appendChild(wrap);
      
            function safeVal(sel) {
              const el = wrap.querySelector(sel);
              return el ? el.value || "" : "";
            }
            function safeTextSelected(sel) {
              const el = wrap.querySelector(sel);
              if (!el || !el.selectedOptions || !el.selectedOptions[0]) return "";
              return el.selectedOptions[0].text || "";
            }
      
            function upd() {
              const a1 = safeVal("#ctl00_PageBody_DeliveryAddress_AddressLine1").trim();
              const a2 = safeVal("#ctl00_PageBody_DeliveryAddress_AddressLine2").trim();
              const c = safeVal("#ctl00_PageBody_DeliveryAddress_City").trim();
              const s = safeTextSelected("#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList").trim();
              const z = safeVal("#ctl00_PageBody_DeliveryAddress_Postcode").trim();
      
              sum.innerHTML = `<strong>Delivery Address</strong><br>
                ${a1}${a2 ? "<br>" + a2 : ""}<br>
                ${c}${c && (s || z) ? ", " : ""}${s} ${z}<br>
                <button type="button" id="editDelivery" class="btn btn-link">Edit</button>`;
            }
      
            col.insertBefore(sum, wrap);
      
            // Expose for other modules (prefill, pickup sync)
            try { window.WLCheckout = window.WLCheckout || {}; window.WLCheckout.refreshDeliverySummary = upd;
            try { window.WLCheckout.showDeliverySummaryIfFilled = function(){
              try {
                const hasAny = safeVal("#ctl00_PageBody_DeliveryAddress_AddressLine1").trim() ||
                               safeVal("#ctl00_PageBody_DeliveryAddress_City").trim() ||
                               safeVal("#ctl00_PageBody_DeliveryAddress_Postcode").trim();
                if (hasAny) { upd(); wrap.style.display = "none"; sum.style.display = ""; }
              } catch {}
            }; } catch {}
       } catch {}
      
            // If delivery already has data, show summary; otherwise keep inputs visible
            const hasAny = safeVal("#ctl00_PageBody_DeliveryAddress_AddressLine1").trim() ||
                           safeVal("#ctl00_PageBody_DeliveryAddress_City").trim() ||
                           safeVal("#ctl00_PageBody_DeliveryAddress_Postcode").trim();
            if (hasAny) {
              upd();
              wrap.style.display = "none";
              sum.style.display = "";
            } else {
              wrap.style.display = "";
              sum.style.display = "none";
            }
      
            sum.addEventListener("click", (e) => {
              if (e.target.id !== "editDelivery") return;
              e.preventDefault();
              sum.style.display = "none";
              wrap.style.display = "";
              try { wrap.scrollIntoView({ behavior: "smooth" }); } catch {}
      
              if (!wrap.querySelector("#saveDelivery")) {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.id = "saveDelivery";
                btn.className = "btn btn-primary mt-2";
                btn.textContent = "Save";
                wrap.appendChild(btn);
      
                btn.addEventListener("click", () => {
                  upd();
                  try {
                    const same = document.getElementById('sameAsDeliveryCheck');
                    if (same && same.checked && window.WLCheckout && typeof window.WLCheckout.refreshInvoiceSummary === 'function') {
                      window.WLCheckout.refreshInvoiceSummary(true);
                    }
                  } catch {}
                  wrap.style.display = "none";
                  sum.style.display = "";
                  setStep(4);
                });
              }
            });
      
            upd();
          })();
      
          // -------------------------------------------------------------------------
          // H) Billing address same-as-delivery + summary/edit (Step 6)
          // Fix: If sameAsDelivery=true but invoice fields blank after reload/cart changes,
          // auto-trigger CopyDeliveryAddress postback ONCE per session.
          // -------------------------------------------------------------------------
          (function () {
            const pane4 = wizard.querySelector('.checkout-step[data-step="4"]');
            if (!pane4) return;
      
            const orig = document.getElementById("copyDeliveryAddressButton");
            if (orig) orig.style.display = "none";
      
            const chkDiv = document.createElement("div");
            chkDiv.className = "form-check mb-3";
            chkDiv.innerHTML = `
              <input class="form-check-input" type="checkbox" id="sameAsDeliveryCheck">
              <label class="form-check-label" for="sameAsDeliveryCheck">
                Billing address is the same as delivery address
              </label>`;
            pane4.insertBefore(chkDiv, pane4.firstChild);
      
            const sameCheck = chkDiv.querySelector("#sameAsDeliveryCheck");
            const colInv = pane4.querySelector(".epi-form-col-single-checkout");
            if (!colInv) return;
      
            const wrapInv = document.createElement("div");
            const sumInv = document.createElement("div");
            wrapInv.className = "invoice-inputs";
            sumInv.className = "invoice-summary";
      
            while (colInv.firstChild) wrapInv.appendChild(colInv.firstChild);
            colInv.appendChild(wrapInv);
      
            const q = (sel) => wrapInv.querySelector(sel);
      
            function copyDeliveryToInvoice(force) {
              try {
                const pairs = [
                  ["ctl00_PageBody_DeliveryAddress_AddressLine1","ctl00_PageBody_InvoiceAddress_AddressLine1"],
                  ["ctl00_PageBody_DeliveryAddress_AddressLine2","ctl00_PageBody_InvoiceAddress_AddressLine2"],
                  ["ctl00_PageBody_DeliveryAddress_AddressLine3","ctl00_PageBody_InvoiceAddress_AddressLine3"],
                  ["ctl00_PageBody_DeliveryAddress_City","ctl00_PageBody_InvoiceAddress_City"],
                  ["ctl00_PageBody_DeliveryAddress_Postcode","ctl00_PageBody_InvoiceAddress_Postcode"],
                ];
                pairs.forEach(([from,to])=>{
                  const f=document.getElementById(from);
                  const t=document.getElementById(to);
                  if (!f || !t) return;
                  if (force || !String(t.value||"").trim()) t.value = f.value;
                });
      
                const delState=document.getElementById("ctl00_PageBody_DeliveryAddress_CountySelector_CountyList");
                const invState=document.getElementById("ctl00_PageBody_InvoiceAddress_CountySelector_CountyList");
                if (delState && invState) {
                  const txt = delState.selectedOptions && delState.selectedOptions[0] ? delState.selectedOptions[0].text : "";
                  if (txt) selectByText(invState, txt);
                }
      
                const invCountry=document.getElementById("ctl00_PageBody_InvoiceAddress_CountrySelector1");
                if (invCountry && !String(invCountry.value||"").trim()) invCountry.value = "USA";
              } catch {}
            }
      
      
            function refreshInv() {
              const a1 = (q("#ctl00_PageBody_InvoiceAddress_AddressLine1")?.value || "").trim();
              const a2 = (q("#ctl00_PageBody_InvoiceAddress_AddressLine2")?.value || "").trim();
              const c = (q("#ctl00_PageBody_InvoiceAddress_City")?.value || "").trim();
              const st =
                q("#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList")?.selectedOptions?.[0]?.text || "";
              const z = (q("#ctl00_PageBody_InvoiceAddress_Postcode")?.value || "").trim();
              const e = (q("#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox")?.value || "").trim();
      
              sumInv.innerHTML = `<strong>Billing Address</strong><br>
                ${a1}${a2 ? "<br>" + a2 : ""}<br>
                ${c}${c && (st || z) ? ", " : ""}${st} ${z}<br>
                Email: ${e}<br>
                <button type="button" id="editInvoice" class="btn btn-link">Enter new billing address</button>`;
            }
      
            function invoiceLooksBlank() {
              const invLine1 = (q("#ctl00_PageBody_InvoiceAddress_AddressLine1")?.value || "").trim();
              const invCity  = (q("#ctl00_PageBody_InvoiceAddress_City")?.value || "").trim();
              const invZip   = (q("#ctl00_PageBody_InvoiceAddress_Postcode")?.value || "").trim();
              return !invLine1 && !invCity && !invZip;
            }
      
            function deliveryHasData() {
              const delLine1 = (document.getElementById("ctl00_PageBody_DeliveryAddress_AddressLine1")?.value || "").trim();
              const delCity  = (document.getElementById("ctl00_PageBody_DeliveryAddress_City")?.value || "").trim();
              const delZip   = (document.getElementById("ctl00_PageBody_DeliveryAddress_Postcode")?.value || "").trim();
              return !!(delLine1 || delCity || delZip);
            }
      
            wrapInv.style.display = "none";
            sumInv.style.display = "none";
            colInv.insertBefore(sumInv, wrapInv);
      
            // Initial state from storage
            const sameStored = getSameAsDelivery();
            sameCheck.checked = sameStored;
      
            // If the user wants same-as-delivery AND invoice is blank after reload,
            // trigger the server-side copy ONCE this session.
            if (sameStored && invoiceLooksBlank() && deliveryHasData() && !autoCopyAlreadyDone()) {
              markAutoCopyDone();
              setReturnStep(5);
              try {
                __doPostBack("ctl00$PageBody$CopyDeliveryAddressLinkButton", "");
                return; // page will reload; stop further UI work this pass
              } catch {}
            }
      
            // Normal display
            if (sameStored) {
              copyDeliveryToInvoice(true);
              refreshInv();
              wrapInv.style.display = "none";
              sumInv.style.display = "";
            } else {
              wrapInv.style.display = "";
              sumInv.style.display = "none";
            }
      
            sameCheck.addEventListener("change", function () {
              if (this.checked) {
                setReturnStep(5);
                setSameAsDelivery(true);
                markAutoCopyDone(); // user-initiated copy: treat as done
      
                // Client-side copy immediately so the customer sees it without needing to uncheck/recheck
                copyDeliveryToInvoice(true);
      
                refreshInv();
                wrapInv.style.display = "none";
                sumInv.style.display = "";
      
                // If your WebTrack installation requires server-side copy logic, we can re-enable this postback.
                // try { __doPostBack("ctl00$PageBody$CopyDeliveryAddressLinkButton", ""); } catch {}
              } else {
                setSameAsDelivery(false);
                sumInv.style.display = "none";
                wrapInv.style.display = "";
              }
            });
      
            sumInv.addEventListener("click", (e) => {
              if (e.target.id !== "editInvoice") return;
              e.preventDefault();
              sumInv.style.display = "none";
              wrapInv.style.display = "";
              try { wrapInv.scrollIntoView({ behavior: "smooth" }); } catch {}
            });
      
            try {
              window.WLCheckout = window.WLCheckout || {};
              window.WLCheckout.refreshInvoiceSummary = function(forceCopy){
                if (forceCopy) copyDeliveryToInvoice(true);
                refreshInv();
              };
            } catch {}
      
            refreshInv();
          })();
      
          // -------------------------------------------------------------------------
          // I) Prefill delivery address (kept light)
          // -------------------------------------------------------------------------
          try {
            if ($ && !$("#ctl00_PageBody_DeliveryAddress_AddressLine1").val()) {
              const $entries = $(".AddressSelectorEntry");
              if ($entries.length) {
                let $pick = $entries.first();
                let minId = parseInt($pick.find(".AddressId").text(), 10);
      
                $entries.each(function () {
                  const id = parseInt($(this).find(".AddressId").text(), 10);
                  if (id < minId) {
                    minId = id;
                    $pick = $(this);
                  }
                });
      
                const parts = $pick
                  .find("dd p")
                  .first()
                  .text()
                  .trim()
                  .split(",")
                  .map((s) => s.trim());
      
                const line1 = parts[0] || "";
                const city = parts[1] || "";
                let state = "", zip = "";
      
                if (parts.length >= 4) {
                  state = parts[parts.length - 2] || "";
                  zip = parts[parts.length - 1] || "";
                } else if (parts.length > 2) {
                  const m = (parts[2] || "").match(/(.+?)\s*(\d{5}(?:-\d{4})?)?$/);
                  if (m) {
                    state = (m[1] || "").trim();
                    zip = m[2] || "";
                  }
                }
      
                $("#ctl00_PageBody_DeliveryAddress_AddressLine1").val(line1);
                $("#ctl00_PageBody_DeliveryAddress_City").val(city);
                $("#ctl00_PageBody_DeliveryAddress_Postcode").val(zip);
                $("#ctl00_PageBody_DeliveryAddress_CountrySelector").val("USA");
      
                $("#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList option").each(function () {
                  if ($(this).text().trim().toLowerCase() === state.toLowerCase()) {
                    $(this).prop("selected", true);
                    return false;
                  }
                });
      
                // Update the collapsed delivery summary immediately if present
                try {
                  if (window.WLCheckout && typeof window.WLCheckout.refreshDeliverySummary === "function") window.WLCheckout.refreshDeliverySummary();
                  if (window.WLCheckout && typeof window.WLCheckout.showDeliverySummaryIfFilled === "function") window.WLCheckout.showDeliverySummaryIfFilled();
                } catch {}
      
              }
            }
          } catch {}
      
          // -------------------------------------------------------------------------
          // J) AJAX fetch user info (DON’T trigger WebForms change)
          // -------------------------------------------------------------------------
          if ($) {
            $.get("https://webtrack.woodsonlumber.com/AccountSettings.aspx", (data) => {
              const $acc = $(data);
              const fn = ($acc.find("#ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput").val() || "").trim();
              const ln = ($acc.find("#ctl00_PageBody_ChangeUserDetailsControl_LastNameInput").val() || "").trim();
              const em = (
                ($acc.find("#ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput").val() || "")
                  .replace(/^\([^)]*\)\s*/, "")
              ).trim();
      
              const setIfExists = (sel, val) => {
                const $el = $(sel);
                if ($el.length && val) $el.val(val);
              };
      
              setIfExists("#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox", fn);
              setIfExists("#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox", ln);
      
              setIfExists("#ctl00_PageBody_InvoiceAddress_ContactFirstNameTextBox", fn);
              setIfExists("#ctl00_PageBody_InvoiceAddress_ContactLastNameTextBox", ln);
      
              setIfExists("#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox", em);
            });
      
            $.get("https://webtrack.woodsonlumber.com/AccountInfo_R.aspx", (data) => {
              const tel = $(data).find("#ctl00_PageBody_TelephoneLink_TelephoneLink").text().trim();
              if (tel) $("#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox").val(tel);
            });
          }
      
          // -------------------------------------------------------------------------
          // K) Step 7: pickup/delivery + special instructions
          // Fix: Same-day pickup times must be >= 2 hours out (rounded up to next hour)
          // -------------------------------------------------------------------------
          (function () {
            const p6 = wizard.querySelector('.checkout-step[data-step="5"]');
            if (!p6) return;
      
            const parseLocalDate = (s) => {
              const [y, m, d] = s.split("-").map(Number);
              return new Date(y, m - 1, d);
            };
            const formatLocal = (d) => {
              const mm = String(d.getMonth() + 1).padStart(2, "0");
              const dd = String(d.getDate()).padStart(2, "0");
              return `${d.getFullYear()}-${mm}-${dd}`;
            };
      
            const specialIns = document.getElementById("ctl00_PageBody_SpecialInstructionsTextBox");
            if (!specialIns) return;
      
            const siWrap =
              specialIns.closest(".epi-form-group-checkout") ||
              specialIns.closest(".epi-form-col-single-checkout") ||
              specialIns.parentElement;
      
            specialIns.style.display = "none";
      
            const pickupDiv = document.createElement("div");
            pickupDiv.className = "form-group";
            pickupDiv.innerHTML = `
              <label for="pickupDate">Requested Pickup Date:</label>
              <input type="date" id="pickupDate" class="form-control">
              <label for="pickupTime">Requested Pickup Time:</label>
              <select id="pickupTime" class="form-control" disabled></select>
              <label for="pickupPerson">Pickup Person:</label>
              <input type="text" id="pickupPerson" class="form-control">`;
            pickupDiv.style.display = "none";
      
            const deliveryDiv = document.createElement("div");
            deliveryDiv.className = "form-group";
            deliveryDiv.innerHTML = `
              <label for="deliveryDate">Requested Delivery Date:</label>
              <input type="date" id="deliveryDate" class="form-control">
              <div>
                <label><input type="radio" name="deliveryTime" value="Morning"> Morning</label>
                <label><input type="radio" name="deliveryTime" value="Afternoon"> Afternoon</label>
              </div>`;
            deliveryDiv.style.display = "none";
      
            siWrap.insertAdjacentElement("afterend", pickupDiv);
            pickupDiv.insertAdjacentElement("afterend", deliveryDiv);
      
            const extraDiv = document.createElement("div");
            extraDiv.className = "form-group";
            extraDiv.innerHTML = `
              <label for="specialInsExtra">Additional instructions:</label>
              <textarea id="specialInsExtra" class="form-control" placeholder="Optional additional notes"></textarea>`;
            deliveryDiv.insertAdjacentElement("afterend", extraDiv);
      
            const specialExtra = document.getElementById("specialInsExtra");
      
            const today = new Date();
            const isoToday = formatLocal(today);
            const maxPickupD = new Date();
            maxPickupD.setDate(maxPickupD.getDate() + 14);
            const minDelD = new Date();
            minDelD.setDate(minDelD.getDate() + 2);
      
            const pickupInput = pickupDiv.querySelector("#pickupDate");
            const pickupTimeSel = pickupDiv.querySelector("#pickupTime");
            const deliveryInput = deliveryDiv.querySelector("#deliveryDate");
      
            pickupInput.setAttribute("min", isoToday);
            pickupInput.setAttribute("max", formatLocal(maxPickupD));
            deliveryInput.setAttribute("min", formatLocal(minDelD));
      
            function formatTime(h, m) {
              const ampm = h >= 12 ? "PM" : "AM";
              const hh = h % 12 || 12;
              const mm = String(m).padStart(2, "0");
              return `${hh}:${mm} ${ampm}`;
            }
      
            function minutesFromMidnight(d) {
              return d.getHours() * 60 + d.getMinutes();
            }
      
            // NEW: if selected pickup date is today, minimum start time is now + 120 minutes,
            // rounded up to next hour
            function getSameDayMinStartMins() {
              const now = new Date();
              const mins = minutesFromMidnight(now) + 120; // +2h
              // round up to next hour boundary
              return Math.ceil(mins / 60) * 60;
            }
      
            function populatePickupTimes(date) {
              const day = date.getDay();
              let openMins = 7 * 60 + 30;
              let closeMins;
      
              if (1 <= day && day <= 5) closeMins = 17 * 60 + 30;
              else if (day === 6) closeMins = 16 * 60;
              else closeMins = openMins + 60; // Sunday: basically none
      
              // Apply same-day rule
              const isSameDay =
                date.getFullYear() === today.getFullYear() &&
                date.getMonth() === today.getMonth() &&
                date.getDate() === today.getDate();
      
              let minStart = openMins;
              if (isSameDay) {
                minStart = Math.max(openMins, getSameDayMinStartMins());
              }
      
              pickupTimeSel.innerHTML = "";
      
              // We show 1-hour windows [m, m+60], starting at minStart, stepping by 60
              // Ensure the window fits fully before close
              // Also snap minStart to an hour boundary to keep clean windows
              minStart = Math.ceil(minStart / 60) * 60;
      
              for (let m = minStart; m + 60 <= closeMins; m += 60) {
                const start = formatTime(Math.floor(m / 60), m % 60);
                const end = formatTime(Math.floor((m + 60) / 60), (m + 60) % 60);
                const opt = document.createElement("option");
                opt.value = `${start}–${end}`;
                opt.text = `${start} – ${end}`;
                pickupTimeSel.appendChild(opt);
              }
      
              pickupTimeSel.disabled = false;
      
              // If nothing available same-day, disable and show a placeholder option
              if (!pickupTimeSel.options.length) {
                pickupTimeSel.disabled = true;
                const opt = document.createElement("option");
                opt.value = "";
                opt.text = "No pickup times available today (select another date)";
                pickupTimeSel.appendChild(opt);
              }
            }
      
            pickupInput.addEventListener("change", function () {
              if (!this.value) return updateSpecial();
              let d = parseLocalDate(this.value);
      
              if (d.getDay() === 0) {
                alert("No Sunday pickups – moved to Monday");
                d.setDate(d.getDate() + 1);
              }
              if (d > maxPickupD) {
                alert("Pickups only within next two weeks");
                d = maxPickupD;
              }
      
              this.value = formatLocal(d);
              populatePickupTimes(d);
              updateSpecial();
            });
      
            deliveryInput.addEventListener("change", function () {
              if (!this.value) return updateSpecial();
              let d = parseLocalDate(this.value);
              if (d.getDay() === 0) {
                alert("No Sunday deliveries – moved to Monday");
                d.setDate(d.getDate() + 1);
              }
              if (d < minDelD) {
                alert("Select at least 2 days out");
                d = minDelD;
              }
              this.value = formatLocal(d);
              updateSpecial();
            });
      
            const rbPick = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbCollectLater");
            const rbDel = document.getElementById("ctl00_PageBody_SaleTypeSelector_rbDelivered");
            const zipInput = document.getElementById("ctl00_PageBody_DeliveryAddress_Postcode");
      
            function inZone(z) {
              return ["75", "76", "77", "78", "79"].includes((z || "").substring(0, 2));
            }
      
            function updateSpecial() {
              let baseText = "";
      
              if (rbPick && rbPick.checked) {
                const d = pickupInput.value;
                const t = pickupTimeSel.disabled ? "" : pickupTimeSel.value;
                const p = pickupDiv.querySelector("#pickupPerson").value;
      
                specialIns.readOnly = false;
                baseText = "Pickup on " + d + (t ? " at " + t : "") + (p ? " for " + p : "");
              } else if (rbDel && rbDel.checked) {
                specialIns.readOnly = true;
                if (inZone(zipInput ? zipInput.value : "")) {
                  const d2 = deliveryInput.value;
                  const t2 = deliveryDiv.querySelector('input[name="deliveryTime"]:checked');
                  baseText = "Delivery on " + d2 + (t2 ? " (" + t2.value + ")" : "");
                } else {
                  baseText = "Ship via 3rd party delivery on next screen.";
                }
              }
      
              specialIns.value = baseText + (specialExtra.value ? " – " + specialExtra.value : "");
            }
      
            function onShip() {
              if (rbPick && rbPick.checked) {
                pickupDiv.style.display = "block";
                deliveryDiv.style.display = "none";
      
                // If date already chosen, enforce same-day rule immediately
                if (pickupInput.value) populatePickupTimes(parseLocalDate(pickupInput.value));
              } else if (rbDel && rbDel.checked) {
                pickupDiv.style.display = "none";
                deliveryDiv.style.display = "block";
              } else {
                pickupDiv.style.display = "none";
                deliveryDiv.style.display = "none";
              }
              updateSpecial();
            }
      
            if (rbPick) rbPick.addEventListener("change", onShip);
            if (rbDel) rbDel.addEventListener("change", onShip);
      
            pickupDiv.querySelector("#pickupPerson").addEventListener("input", updateSpecial);
            pickupTimeSel.addEventListener("change", updateSpecial);
      
            deliveryDiv
              .querySelectorAll('input[name="deliveryTime"]')
              .forEach((r) => r.addEventListener("change", updateSpecial));
            specialExtra.addEventListener("input", updateSpecial);
      
            try { window.WLCheckout = window.WLCheckout || {}; window.WLCheckout.refreshDateUI = onShip; } catch {}
      
            onShip();
      
      // Expose a refresh hook so UpdatePanel partial postbacks can restore visibility/state.
      window.WLCheckout = window.WLCheckout || {};
      window.WLCheckout.refreshDateUI = function () {
        try { onShip(); } catch {}
      };
      
      
            // Client validation on Continue buttons
            if ($) {
              $("#ctl00_PageBody_ContinueButton1, #ctl00_PageBody_ContinueButton2").on("click", function (e) {
                // Ensure pickup orders don't get blocked by required delivery fields
                try {
                  if (getPickupSelected()) {
                    // Validate billing now (so we can guide the user before server rejects)
                    if (!validateAddressBlock("InvoiceAddress", 4, true)) {
                      e.preventDefault();
                      showStep(4);
                      return;
                    }
                    syncBillingToDelivery();
                  }
                } catch {}
      
                setReturnStep(steps.length);
                setExpectedNav(true);
      
                let valid = true;
                const errors = [];
      
                if ($("#deliveryDate").closest(".form-group").is(":visible")) {
                  if (!$("#deliveryDate").val()) {
                    valid = false;
                    errors.push("• Please select a Requested Delivery Date.");
                  }
                  if (!$('input[name="deliveryTime"]:checked').length) {
                    valid = false;
                    errors.push("• Please choose a Delivery Time (Morning or Afternoon).");
                  }
                }
      
                if ($("#pickupDate").closest(".form-group").is(":visible")) {
                  if (!$("#pickupDate").val()) {
                    valid = false;
                    errors.push("• Please select a Requested Pickup Date.");
                  }
                  if (!$("#pickupPerson").val().trim()) {
                    valid = false;
                    errors.push("• Please enter a Pickup Person.");
                  }
                  if ($("#pickupTime").prop("disabled") || !$("#pickupTime").val()) {
                    valid = false;
                    errors.push("• Please select an available Pickup Time.");
                  }
                }
      
                if (!valid) {
                  e.preventDefault();
                  alert("Hold on – we need a bit more info:\n\n" + errors.join("\n"));
                  showStep(6);
                  setExpectedNav(false);
                  return;
                }
      
                setTimeout(function () {
                  window.WLCheckout?.detectAndJumpToValidation?.();
                }, 900);
              });
            }
          })();
      
          // -------------------------------------------------------------------------
          // L) Robust validation scanner → jump to step containing first visible error
          // -------------------------------------------------------------------------
          (function () {
            function isVisible(el) {
              if (!el) return false;
              const s = window.getComputedStyle(el);
              return s.display !== "none" && s.visibility !== "hidden" && el.offsetParent !== null;
            }
      
            function findFirstInvalidElement() {
              const perInputSelectors = [
                "input.input-validation-error",
                "select.input-validation-error",
                "textarea.input-validation-error",
                "input.is-invalid",
                "select.is-invalid",
                "textarea.is-invalid",
                '[aria-invalid="true"]',
              ].join(",");
      
              const badInputs = Array.from(document.querySelectorAll(perInputSelectors)).filter(isVisible);
              if (badInputs.length) return badInputs[0];
      
              const validators = Array.from(
                document.querySelectorAll(
                  "span[controltovalidate], span.validator, .field-validation-error, .text-danger"
                )
              ).filter((el) => isVisible(el) && (el.textContent || "").trim().length >= 1);
      
              if (validators.length) {
                const sp = validators[0];
                const ctl = sp.getAttribute("controltovalidate");
                if (ctl) {
                  const target = document.getElementById(ctl);
                  if (target) return target;
                }
                const nearby =
                  sp.closest(".epi-form-group-checkout, .form-group, .epi-form-col-single-checkout")?.querySelector(
                    "input,select,textarea"
                  );
                return nearby || sp;
              }
      
              const summary = document.querySelector(".validation-summary-errors li, .validation-summary-errors");
              if (summary && isVisible(summary)) return summary;
      
              return null;
            }
      
            function paneStepFor(el) {
              const pane = el && el.closest ? el.closest(".checkout-step") : null;
              return pane && pane.dataset.step ? parseInt(pane.dataset.step, 10) : null;
            }
      
            function detectAndJumpToValidation() {
              const culprit = findFirstInvalidElement();
              if (!culprit) return false;
      
              const stepNum = paneStepFor(culprit) || 1;
              showStep(stepNum);
      
              try {
                culprit.scrollIntoView({ behavior: "smooth", block: "center" });
              } catch {}
      
              return true;
            }
      
            window.WLCheckout = window.WLCheckout || {};
            window.WLCheckout.detectAndJumpToValidation = detectAndJumpToValidation;
          })();
      
          // -------------------------------------------------------------------------
          // M) Modern Shipping selector (Transaction is forced to ORDER)
          // -------------------------------------------------------------------------
          if ($) {
            $(function () {
              // Force ORDER and hide transaction type UI
              if ($("#ctl00_PageBody_TransactionTypeDiv").length) {
                try {
                  $(".TransactionTypeSelector").hide();
                  $("#ctl00_PageBody_TransactionTypeDiv").hide();
                  $("#ctl00_PageBody_TransactionTypeSelector_rdbOrder").prop("checked", true);
                  $("#ctl00_PageBody_TransactionTypeSelector_rdbQuote").prop("checked", false);
                } catch {}
              }
      
              if ($(".SaleTypeSelector").length) {
                $(".SaleTypeSelector").hide();
      
                const shipHTML = `
                  <div class="modern-shipping-selector d-flex justify-content-around">
                    <button type="button" id="btnDelivered" class="btn btn-primary" data-value="rbDelivered">
                      <i class="fas fa-truck"></i> Delivered
                    </button>
                    <button type="button" id="btnPickup" class="btn btn-secondary" data-value="rbCollectLater">
                      <i class="fas fa-store"></i> Pickup (Free)
                    </button>
                  </div>`;
                $(".epi-form-col-single-checkout:has(.SaleTypeSelector)").append(shipHTML);
      
                $("<style>.modern-shipping-selector .btn[disabled], .modern-shipping-selector .btn.disabled { pointer-events:auto; }</style>").appendTo(document.head);
      
                function updateShippingStyles(val) {
      const delRad = $("#ctl00_PageBody_SaleTypeSelector_rbDelivered");
                  const pickRad = $("#ctl00_PageBody_SaleTypeSelector_rbCollectLater");
                  const $btnDelivered = $("#btnDelivered");
                  const $btnPickup = $("#btnPickup");
      
                  $btnDelivered.removeClass("disabled opacity-50").removeAttr("disabled").attr("aria-disabled", "false");
                  $btnPickup.removeClass("disabled opacity-50").removeAttr("disabled").attr("aria-disabled", "false");
      
                  if (val === "rbDelivered") {
                    // Reset wizard state before the UpdatePanel refresh so we don't resume on an invalid step.
                    try { setStep(1); } catch {}
                    // After async postback, land on Delivery Address step (step 3; becomes step 2 visually when Branch is hidden)
                    try { sessionStorage.setItem("wl_pendingStep", "3"); } catch {}
                    // Use native click so any WebForms AutoPostBack handler fires immediately
                    if (!delRad.is(":checked")) { try { delRad.get(0).click(); } catch { delRad.prop("checked", true).trigger("change"); } }
                    else { delRad.trigger("change"); }
      
                    $btnDelivered.addClass("btn-primary").removeClass("btn-secondary opacity-50").attr("aria-pressed", "true");
                    $btnPickup.addClass("btn-secondary opacity-50").removeClass("btn-primary").attr("aria-pressed", "false");
                    document.cookie = "pickupSelected=false; path=/";
                    document.cookie = "skipBack=false; path=/";
                  } else {
                    // Reset wizard state before the UpdatePanel refresh so we don't resume on an invalid step.
                    try { setStep(1); } catch {}
                    // After async postback, land on Branch step (step 2) for pickup.
                    try { sessionStorage.setItem("wl_pendingStep", "2"); } catch {}
                    if (!pickRad.is(":checked")) { try { pickRad.get(0).click(); } catch { pickRad.prop("checked", true).trigger("change"); } }
                    else { pickRad.trigger("change"); }
      
                    $btnPickup.addClass("btn-primary").removeClass("btn-secondary opacity-50").attr("aria-pressed", "true");
                    $btnDelivered.addClass("btn-secondary opacity-50").removeClass("btn-primary").attr("aria-pressed", "false");
                    document.cookie = "pickupSelected=true; path=/";
                    document.cookie = "skipBack=true; path=/";
                  }
      
                  setStep(1);
                  try { window.WLCheckout.updatePickupModeUI && window.WLCheckout.updatePickupModeUI(); } catch {}
                }
      
                updateShippingStyles(
                  $("#ctl00_PageBody_SaleTypeSelector_rbDelivered").is(":checked") ? "rbDelivered" : "rbCollectLater"
                );
      
                $(document).on("click", ".modern-shipping-selector button", function () {
                  updateShippingStyles($(this).data("value"));
                });
              }
            });
          }
      
          // -------------------------------------------------------------------------
          // N) Hide "Special Instructions" column header if present
          // -------------------------------------------------------------------------
          try {
            document.querySelectorAll("th").forEach((th) => {
              if ((th.textContent || "").includes("Special Instructions")) th.style.display = "none";
            });
          } catch {}
      
          // -------------------------------------------------------------------------
          // O) Place order / Back to cart → reset wizard state
          // -------------------------------------------------------------------------
          (function () {
            const placeOrderBtn = document.getElementById("ctl00_PageBody_PlaceOrderButton");
            const backToCartBtn = document.getElementById("ctl00_PageBody_BackToCartButton3");
      
            function resetWizardState() {
              setSameAsDelivery(false);
              try { localStorage.removeItem(STEP_KEY); } catch {}
              try {
                sessionStorage.removeItem("wl_returnStep");
                sessionStorage.removeItem("wl_expect_nav");
                sessionStorage.removeItem("wl_autocopy_done");
              } catch {}
            }
      
            if (placeOrderBtn) placeOrderBtn.addEventListener("click", resetWizardState);
            if (backToCartBtn) backToCartBtn.addEventListener("click", resetWizardState);
          })();
      
          // -------------------------------------------------------------------------
          // P) Restore step on load
          // -------------------------------------------------------------------------
          const expectedNav = consumeExpectedNav();
          const returnStep = consumeReturnStep();
          const saved = getStep();
          const initial = returnStep || saved || 1;
      
          showStep(initial);
          // Apply pickup-mode visibility immediately on load
          try { updatePickupModeUI(); } catch {}
      
          if (expectedNav) {
            const tryJump = () => window.WLCheckout?.detectAndJumpToValidation?.() === true;
            if (!tryJump()) {
              setTimeout(tryJump, 0);
              setTimeout(tryJump, 300);
              setTimeout(tryJump, 1200);
              setTimeout(() => {
                if (!tryJump()) showStep(returnStep || saved || 2);
              }, 1600);
            }
          }
        });
      })();
    } catch(e) {
      console.error('[WL.CheckoutWizard] error', e);
    }
  };
})();



(function(){
  var WL = window.WL || (window.WL = {});
  WL.GuestCheckout = WL.GuestCheckout || {};
  WL.GuestCheckout.run = function(){
    try {
      if (!(true)) return;
      (function(){
        'use strict';
      
        if (!/ShoppingCart\.aspx/i.test(location.pathname)) return;
      
        /* =========================
           CONFIG / HELPERS
        ========================== */
        const LOG = (...a)=>console.log('[GuestCheckout]', ...a);
        const ERR = (...a)=>console.error('[GuestCheckout]', ...a);
      
        // Page endpoints (adjust if your paths differ)
        const SIGNUP_PATH = location.origin + '/UserSignup.aspx';
      
        // Map state abbrev -> long name for the Step 6 billing dropdown
        const STATE_LONG = {
          AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas', CA:'California',
          CO:'Colorado', CT:'Connecticut', DC:'District of Columbia', DE:'Delaware',
          FL:'Florida', GA:'Georgia', HI:'Hawaii', IA:'Iowa', ID:'Idaho',
          IL:'Illinois', IN:'Indiana', KS:'Kansas', KY:'Kentucky', LA:'Louisiana',
          MA:'Massachusetts', MD:'Maryland', ME:'Maine', MI:'Michigan',
          MN:'Minnesota', MO:'Missouri', MS:'Mississippi', MT:'Montana',
          NC:'North Carolina', ND:'North Dakota', NE:'Nebraska', NH:'New Hampshire',
          NJ:'New Jersey', NM:'New Mexico', NV:'Nevada', NY:'New York',
          OH:'Ohio', OK:'Oklahoma', OR:'Oregon', PA:'Pennsylvania', RI:'Rhode Island',
          SC:'South Carolina', SD:'South Dakota', TN:'Tennessee', TX:'Texas',
          UT:'Utah', VA:'Virginia', VT:'Vermont', WA:'Washington', WI:'Wisconsin',
          WV:'West Virginia', WY:'Wyoming', AB:'Alberta', BC:'British Columbia',
          MB:'Manitoba', NB:'New Brunswick', NL:'Newfoundland and Labrador',
          NS:'Nova Scotia', NT:'Northwest Territories', NU:'Nunavut', ON:'Ontario',
          PE:'Prince Edward Island', QC:'Quebec', SK:'Saskatchewan', YT:'Yukon Territory'
        };
      
        // Always use random 16-char temp password (A–Z, 0–9)
        function randTempPassword(len=16){
          const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let s=''; for (let i=0;i<len;i++) s += chars[Math.floor(Math.random()*chars.length)];
          return s;
        }
      
        function el(q,root=document){ return root.querySelector(q); }
        function setVal(node, val){
          if (!node) return;
          if (node.tagName === 'SELECT'){
            const optByText = Array.from(node.options).find(o => (o.text||'').trim().toLowerCase() === String(val||'').trim().toLowerCase());
            if (optByText) { node.value = optByText.value; node.dispatchEvent(new Event('change', {bubbles:true})); return; }
            const optByVal = Array.from(node.options).find(o => String(o.value).trim().toLowerCase() === String(val||'').trim().toLowerCase());
            if (optByVal) { node.value = optByVal.value; node.dispatchEvent(new Event('change', {bubbles:true})); return; }
          } else {
            node.value = val;
            node.dispatchEvent(new Event('input', {bubbles:true}));
            node.dispatchEvent(new Event('change', {bubbles:true}));
          }
        }
      
        // Persist the guest data so we can reuse on the Step 6 fill
        const KEY='wl_guest_checkout_payload';
        function saveGuest(p){ try{ sessionStorage.setItem(KEY, JSON.stringify(p)); }catch(e){} }
        function loadGuest(){ try{ return JSON.parse(sessionStorage.getItem(KEY)||'{}'); }catch(e){ return {}; } }
      
        /* =========================
           STYLES (modal + below-proceed container)
        ========================== */
        function injectStyles(){
          if (document.getElementById('gc_modal_styles')) return;
          const css = `
            .gc-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;z-index:9998;}
            .gc-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:9999;}
            .gc-card{background:#fff;border-radius:16px;max-width:720px;width:92vw;box-shadow:0 8px 30px rgba(0,0,0,.2);padding:20px;}
            .gc-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
            .gc-row-1{display:grid;grid-template-columns:1fr;gap:12px;}
            .gc-head{font-size:20px;font-weight:700;margin-bottom:8px;color:#222;}
            .gc-sub{font-size:13px;color:#555;margin-bottom:16px;}
            .gc-field label{font-size:12px;color:#333;margin-bottom:4px;display:block;}
            .gc-field input, .gc-field select{width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;}
            .gc-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;}
            .gc-btn{padding:10px 14px;border-radius:10px;border:1px solid #ddd;background:#f6f6f6;cursor:pointer}
            .gc-btn.primary{background:#6b0016;color:#fff;border-color:#6b0016}
            .gc-check{display:flex;align-items:center;gap:8px;margin:8px 0 4px}
            .gc-hidden{display:none;}
            .gc-note{font-size:12px;color:#666;margin-top:6px;}
            @media (max-width:640px){ .gc-row{grid-template-columns:1fr;} }
      
            /* Placement container below Proceed */
            #gc_below_proceed{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;}
            #gc_below_proceed .epi-button{display:inline-block;}
          `;
          const style = document.createElement('style');
          style.id = 'gc_modal_styles';
          style.textContent = css;
          document.head.appendChild(style);
        }
      
        /* =========================
           MODAL BUILD
        ========================== */
        function buildModal(){
          if (document.getElementById('gc_modal')) return;
      
          const backdrop = document.createElement('div');
          backdrop.className = 'gc-modal-backdrop'; backdrop.id = 'gc_backdrop';
      
          const modal = document.createElement('div');
          modal.className = 'gc-modal'; modal.id = 'gc_modal';
          modal.innerHTML = `
            <div class="gc-card" role="dialog" aria-modal="true" aria-labelledby="gc_title">
              <div class="gc-head" id="gc_title">Checkout as Guest</div>
              <div class="gc-sub"></div>
      
              <div class="gc-row">
                <div class="gc-field">
                  <label>Email</label>
                  <input id="gc_email" type="email" autocomplete="email" required>
                </div>
                <div class="gc-field">
                  <label>Phone</label>
                  <input id="gc_phone" type="tel" autocomplete="tel" required placeholder="(###) ###-####">
                </div>
              </div>
      
              <div class="gc-row">
                <div class="gc-field">
                  <label>First name</label>
                  <input id="gc_fname" type="text" autocomplete="given-name" required>
                </div>
                <div class="gc-field">
                  <label>Last name</label>
                  <input id="gc_lname" type="text" autocomplete="family-name" required>
                </div>
              </div>
      
              <div class="gc-head" style="margin-top:8px;">Delivery Address</div>
              <div class="gc-row">
                <div class="gc-field">
                  <label>Street</label>
                  <input id="gc_del_addr1" type="text" autocomplete="address-line1" required>
                </div>
                <div class="gc-field">
                  <label>City</label>
                  <input id="gc_del_city" type="text" autocomplete="address-level2" required>
                </div>
              </div>
      
              <div class="gc-row">
                <div class="gc-field">
                  <label>State (2-letter)</label>
                  <input id="gc_del_state" type="text" maxlength="2" placeholder="TX" autocomplete="address-level1" required>
                </div>
                <div class="gc-field">
                  <label>ZIP</label>
                  <input id="gc_del_zip" type="text" autocomplete="postal-code" required>
                </div>
              </div>
      
              <div class="gc-check">
                <input type="checkbox" id="gc_bill_same" checked>
                <label for="gc_bill_same">Billing same as delivery</label>
              </div>
      
              <div id="gc_bill_block" class="gc-hidden">
                <div class="gc-head" style="margin-top:8px;">Billing Address</div>
                <div class="gc-row">
                  <div class="gc-field">
                    <label>Street</label>
                    <input id="gc_inv_addr1" type="text" autocomplete="address-line1">
                  </div>
                  <div class="gc-field">
                    <label>City</label>
                    <input id="gc_inv_city" type="text" autocomplete="address-level2">
                  </div>
                </div>
                <div class="gc-row">
                  <div class="gc-field">
                    <label>State (2-letter)</label>
                    <input id="gc_inv_state" type="text" maxlength="2" placeholder="TX" autocomplete="address-level1">
                  </div>
                  <div class="gc-field">
                    <label>ZIP</label>
                    <input id="gc_inv_zip" type="text" autocomplete="postal-code">
                  </div>
                </div>
              </div>
      
              <div class="gc-note"></div>
      
              <div class="gc-actions">
                <button class="gc-btn" id="gc_cancel">Cancel</button>
                <button class="gc-btn primary" id="gc_submit">Continue</button>
              </div>
            </div>
          `;
      
          document.body.appendChild(backdrop);
          document.body.appendChild(modal);
      
          // Toggle billing block
          el('#gc_bill_same').addEventListener('change', (e)=>{
            el('#gc_bill_block').classList.toggle('gc-hidden', e.target.checked);
          });
      
          // Close handlers
          function close(){ backdrop.style.display='none'; modal.style.display='none'; }
          el('#gc_cancel').addEventListener('click', close);
          backdrop.addEventListener('click', close);
      
          // Submit
          el('#gc_submit').addEventListener('click', onSubmitGuest);
        }
      
        /* =========================
           ROBUST PLACEMENT (retry + observer)
        ========================== */
        function getProceedBtn(){ return document.getElementById('ctl00_PageBody_PlaceOrderButton'); }
        function getSignInCell(){ return document.getElementById('ctl00_PageBody_OptionalSigninButton'); }
      
        function getOrCreateGuestBtn(){
          let btn = document.getElementById('gc_guest_btn');
          if (!btn){
            btn = document.createElement('a');
            btn.id = 'gc_guest_btn';
            btn.className = 'epi-button';
            btn.href = 'javascript:void(0)';
            btn.innerHTML = '<span>Checkout as Guest</span>';
            btn.addEventListener('click', ()=>{
              el('#gc_backdrop').style.display='block';
              el('#gc_modal').style.display='flex';
            });
          }
          return btn;
        }
      
        function getOrCreateBelowContainer(proceedBtn){
          let cont = document.getElementById('gc_below_proceed');
          if (!cont){
            cont = document.createElement('div');
            cont.id = 'gc_below_proceed';
          }
          // Ensure it's directly after Proceed button (even if Proceed moves)
          if (proceedBtn && proceedBtn.nextSibling !== cont){
            proceedBtn.insertAdjacentElement('afterend', cont);
          }
          return cont;
        }
      
        function getOrCreateSignInClone(){
          let clone = document.getElementById('gc_signin_btn');
          const td = getSignInCell();
          const origA = td ? td.querySelector('a[href*="Signin.aspx"]') : null;
          if (origA){
            // Hide original TD to avoid layout issues
            td.style.display = 'none';
            if (!clone){
              clone = origA.cloneNode(true);
              clone.id = 'gc_signin_btn';
              // keep .epi-button class; already present on orig
            }
          }
          return clone; // may be null if none exists
        }
      
        function placeAdjacentUI(){
          const proceed = getProceedBtn();
          if (!proceed) return false;
      
          const cont = getOrCreateBelowContainer(proceed);
          const guest = getOrCreateGuestBtn();
          const signinClone = getOrCreateSignInClone();
      
          // Ensure container exists immediately after Proceed
          if (cont.parentNode !== proceed.parentNode){
            proceed.parentNode.insertBefore(cont, proceed.nextSibling);
          }
      
          // Place buttons inside container (order: Guest, then Sign In)
          if (!guest.parentNode || guest.parentNode.id !== 'gc_below_proceed'){
            cont.appendChild(guest);
          }
          if (signinClone){
            if (!signinClone.parentNode || signinClone.parentNode.id !== 'gc_below_proceed'){
              cont.appendChild(signinClone);
            }
          }
      
          return true;
        }
      
        function startPlacementWatcher(){
          // Initial tries (covers scripts that move things shortly after load)
          const tries = [0, 150, 400, 800, 1600, 3200];
          tries.forEach(t=> setTimeout(placeAdjacentUI, t));
      
          // Observe DOM mutations and debounce reposition
          let debounce;
          const obs = new MutationObserver(()=>{
            clearTimeout(debounce);
            debounce = setTimeout(placeAdjacentUI, 120);
          });
          obs.observe(document.body, {childList:true, subtree:true});
      
          // Also try on resize (some scripts relocate on breakpoints)
          window.addEventListener('resize', ()=> {
            clearTimeout(debounce);
            debounce = setTimeout(placeAdjacentUI, 120);
          });
        }
      
        /* =========================
           GUEST SUBMIT HANDLER
        ========================== */
        async function onSubmitGuest(){
          // Gather fields
          const email = el('#gc_email').value.trim();
          const phoneRaw = el('#gc_phone').value.trim();
          const phone = phoneRaw.replace(/[^\d]/g,'');
          const fname = el('#gc_fname').value.trim();
          const lname = el('#gc_lname').value.trim();
      
          const d_addr1 = el('#gc_del_addr1').value.trim();
          const d_city  = el('#gc_del_city').value.trim();
          const d_state = el('#gc_del_state').value.trim().toUpperCase();
          const d_zip   = el('#gc_del_zip').value.trim();
      
          const billSame = el('#gc_bill_same').checked;
      
          const i_addr1 = billSame ? d_addr1 : (el('#gc_inv_addr1').value.trim());
          const i_city  = billSame ? d_city  : (el('#gc_inv_city').value.trim());
          const i_state2 = billSame ? d_state : (el('#gc_inv_state').value.trim().toUpperCase());
          const i_zip   = billSame ? d_zip   : (el('#gc_inv_zip').value.trim());
      
          // Minimal validation
          if (!email || !phone || !fname || !lname || !d_addr1 || !d_city || !d_state || !d_zip){
            alert('Please complete all required fields.');
            return;
          }
          if (!billSame && (!i_addr1 || !i_city || !i_state2 || !i_zip)){
            alert('Please complete billing address fields or check “Billing same as delivery.”');
            return;
          }
      
          const contactName = `${fname} ${lname}`.trim();
          const password = randTempPassword(16); // randomized temp password
      
          // Persist for step-6 autofill
          const payload = {
            email, phone, fname, lname, contactName,
            d_addr1, d_city, d_state, d_zip,
            billSame,
            i_addr1, i_city, i_state2, i_zip,
            password
          };
          saveGuest(payload);
          LOG('Saved guest payload to sessionStorage', {...payload, password:'[hidden]'}); // don’t log password
      
          // Kick off background signup in hidden iframe
          try{
            await createAccountInBackground(payload);
            // If account creation succeeded (or we had to bounce to reset), continue checkout
            continueCheckoutAndHookBilling();
          }catch(e){
            ERR('Account creation error:', e);
            alert('We had trouble creating your guest account. If this email already exists, we’ll take you to reset your password.');
          }finally{
            // Close modal
            el('#gc_backdrop').style.display='none';
            el('#gc_modal').style.display='none';
          }
        }
      
        /* =========================
           BACKGROUND SIGNUP (iframe)
        ========================== */
        function createAccountInBackground(p){
          return new Promise((resolve, reject)=>{
            // Create hidden iframe
            let frame = document.getElementById('gc_signup_iframe');
            if (!frame){
              frame = document.createElement('iframe');
              frame.id = 'gc_signup_iframe';
              frame.style.position='fixed';
              frame.style.width='1px';
              frame.style.height='1px';
              frame.style.left='-9999px';
              frame.style.top='-9999px';
              frame.setAttribute('aria-hidden','true');
              document.body.appendChild(frame);
            }
      
            const cleanup = ()=> { /* keep iframe for chained postbacks if needed */ };
      
            frame.onload = async ()=>{
              try{
                const win = frame.contentWindow;
                const doc = frame.contentDocument || win.document;
                if (!doc) throw new Error('No iframe document');
      
                // Detect password-reset/exists redirect by common phrases
                const bodyText = (doc.body && doc.body.innerText || '').toLowerCase();
                if (bodyText.includes('reset password') || bodyText.includes('forgot password')){
                  LOG('Existing account detected; redirecting parent to reset page.');
                  top.location.href = win.location.href;
                  cleanup(); resolve(); return;
                }
      
                // Ensure we are on UserSignup.aspx; if not, navigate first
                if (!/UserSignup\.aspx/i.test(win.location.pathname)){
                  LOG('Navigating iframe to UserSignup.aspx…');
                  win.location.href = SIGNUP_PATH;
                  return; // wait for next onload
                }
      
                const $ = (id)=> doc.getElementById(id);
      
                // On signup: fill email into both username + email fields
                const Email1 = $('ctl00_PageBody_UserNameTextBox');
                const Email2 = $('ctl00_PageBody_EmailAddressTextBox');
                const Pass1  = $('ctl00_PageBody_Password1TextBox');
                const Pass2  = $('ctl00_PageBody_Password2TextBox');
                const Phone  = $('ctl00_PageBody_ContactTelephoneTextBox');
      
                const FName  = $('ctl00_PageBody_FirstNameTextBox');
                const LName  = $('ctl00_PageBody_LastNameTextBox');
                const CName  = $('ctl00_PageBody_ContactNameTextBox');
      
                const DAddr1 = $('ctl00_PageBody_DeliveryAddressLine1TextBox');
                const DCity  = $('ctl00_PageBody_DeliveryCityTextBox');
                const DState = $('ctl00_PageBody_DeliveryStateCountyTextBox') || $('ctl00_PageBody_DeliveryStateTextBox') || $('ctl00_PageBody_DeliveryState');
                const DZip   = $('ctl00_PageBody_DeliveryPostalCodeTextBox');
      
                const IAddr1 = $('ctl00_PageBody_InvoiceAddressLine1TextBox');
                const ICity  = $('ctl00_PageBody_InvoiceCityTextBox');
                const IState = $('ctl00_PageBody_InvoiceStateCountyTextBox');
                const IZip   = $('ctl00_PageBody_InvoicePostalCodeTextBox');
      
                if (!Email1 || !Email2 || !Pass1 || !Pass2 || !Phone){
                  // Not ready yet; wait and retry once
                  setTimeout(()=>frame.onload(), 250);
                  return;
                }
      
                // Reduce password manager prompts
                [Pass1, Pass2].forEach(inp=>{
                  try{
                    inp.autocomplete = 'off';
                    inp.setAttribute('aria-hidden','true');
                  }catch(_){}
                });
      
                // Fill fields
                setVal(Email1, p.email);
                setVal(Email2, p.email);
                setVal(Pass1,  p.password);
                setVal(Pass2,  p.password);
                setVal(Phone,  p.phone);
      
                setVal(FName,  p.fname);
                setVal(LName,  p.lname);
                setVal(CName,  p.contactName);
      
                setVal(DAddr1, p.d_addr1);
                setVal(DCity,  p.d_city);
                if (DState) setVal(DState, p.d_state);
                setVal(DZip,  p.d_zip);
      
                setVal(IAddr1, p.i_addr1);
                setVal(ICity,  p.i_city);
                if (IState) setVal(IState, p.i_state2);
                setVal(IZip,   p.i_zip);
      
                // Enable and click the Sign Up postback
                const btn = $('ctl00_PageBody_SignupButton');
                if (!btn) throw new Error('Signup button not found.');
      
                btn.classList.remove('disabled');
                btn.removeAttribute('aria-disabled');
                btn.style.pointerEvents = 'auto';
                btn.style.opacity = '1';
      
                // Trigger the postback the anchor already has in its href
                try { win.eval(btn.getAttribute('href').replace('javascript:','')); }
                catch { btn.click(); }
      
                // Allow time for the postback/redirect
                setTimeout(()=>{
                  LOG('Signup postback dispatched; continuing…');
                  cleanup(); resolve();
                }, 2500);
      
              }catch(e){
                cleanup(); reject(e);
              }
            };
      
            // Initial navigate to signup
            frame.src = SIGNUP_PATH;
          });
        }
      
        /* =========================
           CONTINUE CHECKOUT + STEP 6 BILLING HOOK
        ========================== */
        function continueCheckoutAndHookBilling(){
          // Click "Proceed to checkout" on the cart page
          const proceedBtn = document.getElementById('ctl00_PageBody_PlaceOrderButton');
          if (proceedBtn){
            LOG('Clicking Proceed to checkout…');
            try {
              eval(proceedBtn.getAttribute('href').replace('javascript:',''));
            } catch {
              proceedBtn.click();
            }
          }
      
          // Install a MutationObserver to catch when Step 6 (billing) appears
          installBillingObserver();
        }
      
        function installBillingObserver(){
          const target = document.body;
          const obs = new MutationObserver(()=>{
            const line1 = document.getElementById('ctl00_PageBody_InvoiceAddress_AddressLine1');
            const zip   = document.getElementById('ctl00_PageBody_InvoiceAddress_Postcode');
            const stateSel = document.getElementById('ctl00_PageBody_InvoiceAddress_CountySelector_CountyList');
            const sameChk  = document.getElementById('sameAsDeliveryCheck');
            if (line1 && zip && stateSel && sameChk){
              LOG('Detected Step 6 billing form — applying guest autofill logic.');
              try { applyBillingAutofill(); } catch(e){ ERR('Billing autofill error:', e); }
              obs.disconnect();
            }
          });
          obs.observe(target, { childList:true, subtree:true });
        }
      
        function applyBillingAutofill(){
          const p = loadGuest();
          if (!p || !p.email) { LOG('No guest payload found; skipping billing autofill'); return; }
      
          const sameChk  = document.getElementById('sameAsDeliveryCheck');
          const line1    = document.getElementById('ctl00_PageBody_InvoiceAddress_AddressLine1');
          const city     = document.getElementById('ctl00_PageBody_InvoiceAddress_City');
          const stateSel = document.getElementById('ctl00_PageBody_InvoiceAddress_CountySelector_CountyList');
          const zip      = document.getElementById('ctl00_PageBody_InvoiceAddress_Postcode');
          const country  = document.getElementById('ctl00_PageBody_InvoiceAddress_CountrySelector1');
          const email    = document.getElementById('ctl00_PageBody_InvoiceAddress_EmailAddressTextBox');
      
          // Always uncheck then re-apply (to trigger any internal site scripts)
          if (sameChk){
            sameChk.checked = false;
            sameChk.dispatchEvent(new Event('change', {bubbles:true}));
          }
      
          if (p.billSame){
            sameChk.checked = true;
            sameChk.dispatchEvent(new Event('change', {bubbles:true}));
          } else {
            const useStateName = STATE_LONG[p.i_state2] || p.i_state2;
            setVal(line1, p.i_addr1 || p.d_addr1);
            setVal(city,  p.i_city  || p.d_city);
            setVal(stateSel, useStateName);
            setVal(zip,   p.i_zip   || p.d_zip);
          }
      
          if (country) setVal(country, 'United States');
          if (email)   setVal(email, p.email);
        }
      
        /* =========================
           INIT
        ========================== */
        function init(){
          injectStyles();
          buildModal();
          startPlacementWatcher(); // <-- ensures “Guest” + “Sign In” follow the Proceed button
          LOG('Ready.');
        }
      
        if (document.readyState === 'loading'){
          document.addEventListener('DOMContentLoaded', init);
        } else {
          init();
        }
      
      })();
    } catch(e) {
      console.error('[WL.GuestCheckout] error', e);
    }
  };
})();



(function(){
  var WL = window.WL || (window.WL = {});
  WL.CardContainer = WL.CardContainer || {};
  WL.CardContainer.run = function(){
    try {
      if (!(document.getElementById('ctl00_PageBody_CardsOnFileContainer') || document.getElementById('ctl00_PageBody_rbCreditCard') || document.getElementById('ctl00_PageBody_rbStoredCard'))) return;
      (function () {
        // ---------- config ----------
        const IDS = {
          main: '.mainContents',
          radioNew: 'ctl00_PageBody_rbCreditCard',
          radioStored: 'ctl00_PageBody_rbStoredCard',
          selectStored: 'ctl00_PageBody_ddlCardsOnFile',
          cardsHost: 'ctl00_PageBody_CardsOnFileContainer',
          continueBtnId: 'ctl00_PageBody_btnContinue_CardOnFileView', // e.g. 'ctl00_PageBody_ContinueButton' if you know it; else leave null
        };
      
        // ---------- utils ----------
        const $ = (sel, root=document) => root.querySelector(sel);
        const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
        const byId = id => document.getElementById(id);
        const onReady = fn => (document.readyState !== 'loading') ? fn() : document.addEventListener('DOMContentLoaded', fn);
        const waitFor = (testFn, {tries=40, delay=100} = {}) => new Promise(res=>{
          const t = setInterval(()=>{
            if (testFn()) { clearInterval(t); res(true); }
            if (--tries <= 0) { clearInterval(t); res(false); }
          }, delay);
        });
      
        function getContinueButton() {
        const btn = document.getElementById(IDS.continueBtnId);
        return btn || null;
      }
      
      function hideContinueButton() {
        const btn = getContinueButton();
        if (btn) btn.style.setProperty('display', 'none', 'important');
      }
      
      // a more “real” click for Telerik RadButton
      function clickContinue() {
        const btn = getContinueButton();
        if (!btn) return;
        // fire a genuine click sequence
        ['pointerdown','mousedown','mouseup','click'].forEach(type => {
          btn.dispatchEvent(new MouseEvent(type, {bubbles:true, cancelable:true, view:window}));
        });
      }
      
      
        // Parse "8464 Apple" => { last4: "8464", name: "Apple" }
        function parseCardOptionText(txt) {
          const m = (txt || '').trim().match(/^(\d{4})\s+(.*)$/);
          return m ? { last4: m[1], name: m[2] } : { last4: txt.trim(), name: '' };
        }
      
        function buildCardTile({ last4, name, isNew=false, selected=false }) {
          const div = document.createElement('div');
          div.className = 'wl-card-tile' + (isNew ? ' is-new' : '') + (selected ? ' is-selected' : '');
          div.setAttribute('role', 'button');
          div.setAttribute('tabindex', '0');
          div.innerHTML = isNew
            ? `
              <div class="wl-card-face">
                <div class="wl-card-brand">New card</div>
                <div class="wl-card-pan">•••• •••• •••• ••••</div>
              </div>
            `
            : `
              <div class="wl-card-face">
                <div class="wl-card-brand">${escapeHTML(name || 'Stored card')}</div>
                <div class="wl-card-pan">•••• •••• •••• ${escapeHTML(last4)}</div>
              </div>
            `;
          return div;
        }
      
        function clearSelected(root) { $$('.wl-card-tile.is-selected', root).forEach(el => el.classList.remove('is-selected')); }
        function selectTile(el) { el.classList.add('is-selected'); }
        function escapeHTML(s){ return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
      
        // ---------- main enhancer ----------
        async function enhanceStoredCards() {
          const main = $(IDS.main);
          if (!main) return;
      
          const rNew = byId(IDS.radioNew);
          const rStored = byId(IDS.radioStored);
          const host = byId(IDS.cardsHost);
          if (!rNew || !rStored || !host) return;
      
          // If already enhanced, just return
          if (host.querySelector('.wl-card-picker')) return;
      
          // 1) Make sure stored radio is checked so dropdown populates (WebForms may postback to fill it)
          if (!rStored.checked) {
            rStored.checked = true;
            // trigger any attached onchange/onclick (WebForms)
            rStored.dispatchEvent(new Event('click', {bubbles:true}));
            rStored.dispatchEvent(new Event('change', {bubbles:true}));
          }
      
          // 2) Wait for the dropdown to exist (and populate)
          const ok = await waitFor(()=> !!byId(IDS.selectStored) && byId(IDS.selectStored).options.length > 0, {tries:40, delay:125});
          const ddl = byId(IDS.selectStored);
          if (!ok || !ddl) return;
      
          // Hide the native radio table & select (keep for server postback)
          const cardTable = byId('CardToUseContainer');
          if (cardTable) cardTable.style.display = 'none';
          ddl.style.display = 'none';
      
          // 3) Build visual picker
          const picker = document.createElement('div');
          picker.className = 'wl-card-picker';
          // tiles container
          const list = document.createElement('div');
          list.className = 'wl-card-list';
      
          // New card tile goes first
          const newTile = buildCardTile({ isNew:true });
          list.appendChild(newTile);
      
          // Stored cards
          Array.from(ddl.options).forEach((opt, idx) => {
            const { last4, name } = parseCardOptionText(opt.text);
            const tile = buildCardTile({ last4, name, isNew:false, selected: opt.selected });
            // click handler
            tile.addEventListener('click', () => {
              clearSelected(list);
              selectTile(tile);
              // choose stored radio, set ddl value, click Continue
              rStored.checked = true;
              ddl.value = opt.value;
              ddl.dispatchEvent(new Event('change', {bubbles:true}));
              clickContinue();
            });
            tile.addEventListener('keydown', (e)=>{ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tile.click(); }});
            list.appendChild(tile);
          });
      
          // New card click
          newTile.addEventListener('click', () => {
            clearSelected(list); selectTile(newTile);
            rNew.checked = true;
            rNew.dispatchEvent(new Event('change', {bubbles:true}));
            clickContinue();
          });
          newTile.addEventListener('keydown', (e)=>{ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); newTile.click(); }});
      
          picker.appendChild(list);
          host.appendChild(picker);
          hideContinueButton();
      
          // Minimal style (scoped)
          injectStyles();
        }
      
        // ---------- styles ----------
        function injectStyles() {
          if (document.getElementById('wl-card-picker-css')) return;
          const css = document.createElement('style');
          css.id = 'wl-card-picker-css';
          css.textContent = `
            .wl-card-picker { margin: 8px 0 12px; }
            .wl-card-list {
              display: grid;
              gap: 10px;
            }
            @media (min-width: 600px) {
              .wl-card-list { grid-template-columns: repeat(2, minmax(220px, 1fr)); }
            }
            @media (min-width: 992px) {
              .wl-card-list { grid-template-columns: repeat(3, minmax(220px, 1fr)); }
            }
            .wl-card-tile {
              border-radius: 12px;
              background: #6b0016;
              color: #fff;
              padding: 14px;
              cursor: pointer;
              box-shadow: 0 1px 3px rgba(0,0,0,0.12);
              outline: none;
              transition: transform .08s ease, box-shadow .08s ease, background .2s ease;
            }
            .wl-card-tile.is-new { background: #f3f3f5; color: #111; border: 1px solid #e6e6ea; }
            .wl-card-tile.is-selected { box-shadow: 0 0 0 3px rgba(107,0,22,0.25); }
            .wl-card-tile:focus { box-shadow: 0 0 0 3px rgba(107,0,22,0.35); }
            .wl-card-tile:hover { transform: translateY(-1px); }
            .wl-card-face { display: grid; gap: 6px; }
            .wl-card-brand { font-weight: 700; }
            .wl-card-pan { font-variant-numeric: tabular-nums; letter-spacing: 1px; }
          `;
          document.head.appendChild(css);
        }
      
        // ---------- WebForms/SPA hooks to re-run after partial postbacks ----------
        function attachWebFormsReinit() {
          try {
            if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager) {
              var prm = Sys.WebForms.PageRequestManager.getInstance();
              if (!prm._wlCardsHooked) {
                prm.add_endRequest(function(){ enhanceStoredCards(); });
                prm._wlCardsHooked = true;
              }
            }
          } catch(e){}
          // Also observe container for dynamic changes
          const target = $(IDS.main) || document.body;
          if (!target || target._wlCardsObserver) return;
          const mo = new MutationObserver(()=> {
            // If the stored card radio or container appears, try enhance
            if (byId(IDS.radioStored) && byId(IDS.cardsHost)) enhanceStoredCards();
          });
          mo.observe(target, {childList:true, subtree:true});
          target._wlCardsObserver = mo;
        }
      
        // ---------- boot ----------
        onReady(() => {
          attachWebFormsReinit();
          enhanceStoredCards();
        });
      
      })();
    } catch(e) {
      console.error('[WL.CardContainer] error', e);
    }
  };
})();



(function(){
  var WL = window.WL || (window.WL = {});
  WL.ModernSummary = WL.ModernSummary || {};
  WL.ModernSummary.run = function(){
    try {
      if (!(document.querySelector('#summary'))) return;
      (function () {
        // -----------------------------
        // Guards & utilities
        // -----------------------------
        function safe(s) { return (s || '').replace(/\s+$/, ''); }
        function escapeHTML(s) { return (s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
      
        // -----------------------------
        // Builder: creates the modern summary UI
        // -----------------------------
        function buildModernSummary() {
          const main = document.querySelector(".mainContents");
          const legacySummary = document.querySelector("#summary");
          if (!main || !legacySummary) return null;
      
          // Prevent duplicate builds
          if (main.querySelector('.wl-modern-summary')) return main.querySelector('.wl-modern-summary');
      
          // Hide legacy T&C row and action buttons, but keep functionality
          const tnCRow = main.querySelector('.row.mt-2');
          const backBtn = document.getElementById('ctl00_PageBody_BackToCartButton5');
          const printLink = Array.from(main.querySelectorAll('a.epi-button')).find(a => a.textContent.trim().match(/^Print Cart/i));
          const completeBtn = document.getElementById('ctl00_PageBody_CompleteCheckoutButton');
          const oldActionRow = main.querySelector(".row.justify-content-center");
          if (oldActionRow) oldActionRow.style.display = "none";
      
          // Precheck platform T&C & hide legacy row
          const platformTnC = document.getElementById('ctl00_PageBody_AgreeToTermsAndConditionsCheckBox');
          if (platformTnC) {
            platformTnC.checked = true;
            if (tnCRow) tnCRow.style.display = 'none';
          }
          if (backBtn) backBtn.closest('.row')?.style && (backBtn.closest('.row').style.display = 'none');
          if (printLink) printLink.closest('.col-12')?.style && (printLink.closest('.col-12').style.display = 'none');
          if (completeBtn) completeBtn.closest('.row')?.style && (completeBtn.closest('.row').style.display = 'none');
      
          // Hide original summary block; we’ll rebuild UI
          legacySummary.style.display = 'none';
      
          // Extract data
          const methodLabelEl = Array.from(legacySummary.querySelectorAll('.row .font-weight-bold'))
            .find(el => /Shipping Method/i.test(el.textContent));
          const methodValue = methodLabelEl?.parentElement?.querySelector('.col')?.textContent.trim() || '';
          const isPickup = /^pickup/i.test(methodValue);
      
          const branchRow = document.getElementById("ctl00_PageBody_ShoppingCartSummaryTableControl_BranchRow");
          const branchFull = branchRow?.querySelector('.col:last-child')?.textContent.trim() || '';
          const city = branchFull.split(' - ')[0]?.trim() || '';
          const street = (branchFull.split(' - ')[1] || '').split(',')[0]?.trim() || '';
      
          const requiredDate = (() => {
            const label = Array.from(legacySummary.querySelectorAll('.row .font-weight-bold'))
              .find(el => /Date Required:/i.test(el.textContent || ''));
            // avoid :scope for compatibility
            return label ? label.parentElement.querySelector('.col')?.textContent.trim() || '' : '';
          })();
      
          function getValueByLabel(labelRe) {
            const el = Array.from(legacySummary.querySelectorAll('.row .font-weight-bold'))
              .find(n => labelRe.test((n.textContent || '').replace(/\s+/g, ' ')));
            return el ? el.parentElement.querySelector('.col')?.textContent.trim() || '' : '';
          }
          const poRef = getValueByLabel(/PO\s*#?\s*\/\s*Your\s+Ref:?/i);
          const specialInstr = getValueByLabel(/Special\s+Instructions:?/i);
      
          function collectAddress(prefixHuman) {
            const prefix = /invoice/i.test(prefixHuman) ? 'Invoice' : 'Delivery';
            const q = sel => legacySummary.querySelector(sel)?.textContent?.trim() || '';
            const contact = q('#ctl00_PageBody_ShoppingCartSummaryTableControl_DeliveryContactName');
            const phone   = q('#ctl00_PageBody_ShoppingCartSummaryTableControl_DeliveryTelephone');
            const email   = q('#ctl00_PageBody_ShoppingCartSummaryTableControl_InvoiceEmailAddress');
            const line1   = q(`#ctl00_PageBody_ShoppingCartSummaryTableControl_${prefix}AddressLines`);
            const city    = q(`#ctl00_PageBody_ShoppingCartSummaryTableControl_${prefix}City`);
            const state   = q(`#ctl00_PageBody_ShoppingCartSummaryTableControl_${prefix}State`);
            const zip     = q(`#ctl00_PageBody_ShoppingCartSummaryTableControl_${prefix}${prefix==='Invoice' ? 'ZipCode' : 'PostalCode'}`);
            const country = q(`#ctl00_PageBody_ShoppingCartSummaryTableControl_${prefix}Country`);
            const addrLines = [line1, [city, state].filter(Boolean).join(', '), zip, country].filter(Boolean);
            return { contact, phone, email, addrLines };
          }
          const delivery = collectAddress("Delivery");
          const invoice  = collectAddress("Invoice");
      
          function collectTotals() {
            const rows = Array.from(legacySummary.querySelectorAll('table tbody tr'));
            let subtotal = '', tax = '', total = '';
            for (const tr of rows) {
              const label = tr.children[0]?.textContent?.replace(/\s+/g,' ')?.trim() || '';
              const val   = tr.querySelector('td.numeric')?.textContent?.trim() || '';
              if (/^Subtotal/i.test(label)) subtotal = val;
              else if (/^Tax$/i.test(label)) tax = val;
              else if (/^Total(\s*inc\s*Tax)?$/i.test(label)) total = tr.querySelector('td.numeric.totalRow, td.numeric')?.textContent?.trim() || val;
            }
            return { subtotal, tax, total };
          }
          const totals = collectTotals();
      
          function collectLinesHTML() {
            const table =
              document.querySelector("#ctl00_PageBody_ShoppingCartSummaryTableControl_BasketLinesGrid_ctl00")
              || document.querySelector("#ctl00_PageBody_ShoppingCartSummaryTableControl_BasketLinesGrid .rgMasterTable");
            if (!table) return "";
            const rows = table.querySelectorAll("tr.rgRow, tr.rgAltRow");
            return Array.from(rows).map(r => {
              const tds = r.querySelectorAll("td");
              const code  = tds[0]?.textContent?.trim() || "";
              const desc  = tds[1]?.textContent?.trim() || "";
              const qty   = tds[3]?.textContent?.trim() || "";
              const uom   = tds[4]?.textContent?.trim() || "";
              const price = tds[5]?.textContent?.trim() || "";
              const total = tds[7]?.textContent?.trim() || "";
              return `<tr>
                <td data-title="Product Code">${escapeHTML(code)}</td>
                <td>${escapeHTML(desc)}</td>
                <td style="text-align:right;">${escapeHTML(qty)}</td>
                <td>${escapeHTML(uom)}</td>
                <td style="text-align:right;">${escapeHTML(price)}</td>
                <td style="text-align:right;">${escapeHTML(total)}</td>
              </tr>`;
            }).join("");
          }
          const linesHTML = collectLinesHTML();
      
          // store link/image maps
          const storeLinks = {
            "Buffalo":"https://www.woodsonlumber.com/buffalo",
            "Brenham":"https://www.woodsonlumber.com/brenham",
            "Bryan":"https://www.woodsonlumber.com/bryan",
            "Caldwell":"https://www.woodsonlumber.com/caldwell",
            "Groesbeck":"https://www.woodsonlumber.com/groesbeck",
            "Lexington":"https://www.woodsonlumber.com/lexington",
            "Mexia":"https://www.woodsonlumber.com/mexia",
          };
          const storeImages = {
            "Buffalo":"https://images-woodsonlumber.sirv.com/Store-Images/store-buffalo.png",
            "Brenham":"https://images-woodsonlumber.sirv.com/Store-Images/store-brenham.png",
            "Caldwell":"https://images-woodsonlumber.sirv.com/Store-Images/store-caldwell.png",
            "Bryan":"https://images-woodsonlumber.sirv.com/Store-Images/store-bryan.png",
            "Lexington":"https://images-woodsonlumber.sirv.com/Store-Images/store-lexington.png",
            "Groesbeck":"https://images-woodsonlumber.sirv.com/Store-Images/store-groesbeck.png",
            "Mexia":"https://images-woodsonlumber.sirv.com/Store-Images/store-mexia.png",
          };
          const storeUrl = storeLinks[city] || "#";
          const storeImg = storeImages[city] || "https://images-woodsonlumber.sirv.com/Store-Images/default.jpg";
      
          // Build UI
          const shell = document.createElement('div');
          shell.className = "wl-modern-summary";
          shell.innerHTML = `
            <div class="wl-topbar">
              <a href="${storeUrl}" target="_blank" aria-label="${city} store">
                <img class="wl-store-img" src="${storeImg}" alt="${city} store">
              </a>
              <div>
                <p class="wl-method">${isPickup ? 'Pickup' : 'Delivery'} <span class="wl-pill">${methodValue}</span></p>
                <h3 class="wl-store-name">${city}</h3>
                <p class="wl-store-street">${street || ''}</p>
              </div>
              <div class="wl-date">
                <div><strong>${isPickup ? 'Pickup Date' : 'Expected Delivery'}:</strong> ${requiredDate || '-'}</div>
              </div>
            </div>
      
            <div class="wl-sections">
              <div class="wl-left-stack">
                <div class="wl-card">
                  <h4>Contact</h4>
                  <div class="wl-kv">
                    <div class="k">Name</div><div class="v">${safe(delivery.contact)}</div>
                    <div class="k">Phone</div><div class="v">${safe(delivery.phone)}</div>
                    <div class="k">Email</div><div class="v">${safe(invoice.email)}</div>
                  </div>
                  <div class="wl-kv wl-kv-wide">
                    <div class="k">PO / Your Ref</div><div class="v">${safe(poRef) || '-'}</div>
                  </div>
                  <div class="wl-kv wl-kv-wide">
                    <div class="k">Special Instructions</div><div class="v">${safe(specialInstr) || '-'}</div>
                  </div>
                </div>
      
                <div class="wl-card">
                  <h4>Addresses</h4>
                  <div class="wl-address-wrap">
                    <div>
                      <div class="section-label">Sales Address</div>
                      <p class="wl-address">${delivery.addrLines.filter(Boolean).join('\n')}</p>
                    </div>
                    <div>
                      <div class="section-label">Invoice Address</div>
                      <p class="wl-address">${invoice.addrLines.filter(Boolean).join('\n')}</p>
                    </div>
                  </div>
                </div>
              </div>
      
              <div class="wl-card wl-lines">
                <h4>Order</h4>
                <div class="wl-table-wrap">
                  <table class="wl-table">
                    <thead>
                      <tr>
                        <th>Product Code</th>
                        <th>Description</th>
                        <th style="text-align:right;">Qty</th>
                        <th>UOM</th>
                        <th style="text-align:right;">Price</th>
                        <th style="text-align:right;">Total</th>
                      </tr>
                    </thead>
                    <tbody>${linesHTML}</tbody>
                  </table>
                </div>
                <div class="wl-totals">
                  <div class="row"><div>Subtotal</div><div>${totals.subtotal}</div></div>
                  ${totals.tax ? `<div class="row"><div>Tax</div><div>${totals.tax}</div></div>` : ''}
                  <div class="row total"><div>Total</div><div>${totals.total}</div></div>
                </div>
              </div>
            </div>
      
            <div class="wl-legal">
              By clicking <strong>Complete Order</strong>, you agree to our
              <a href="TermsAndConditions.aspx" target="_blank">Terms and Conditions</a> of sale.
              <div class="sub">
                <strong>Returns & Cancellations:</strong> Most items can be returned within 30 days in new condition with receipt.
                Custom/special orders may be non‑returnable or subject to a restocking fee. See Terms for full details.
              </div>
            </div>
      
            <div class="wl-actions">
              <button class="wl-btn secondary desktop" type="button" id="wl-back">Back</button>
              <button class="wl-btn desktop" type="button" id="wl-complete">Complete Order</button>
            </div>
          `;
          main.insertBefore(shell, main.firstChild);
      
          // Header text
          updateSummaryHeader();
      
          // Hide legacy buttons (ensure)
          hideLegacyButtons();
      
          // Sticky bar (mobile)
          (function addStickyBarMobile(){
            const sticky = document.createElement('div');
            sticky.className = 'wl-sticky-bar';
            sticky.innerHTML = `
              <div class="wl-sticky-legal">
                By tapping <strong>Complete Order</strong>, you agree to our
                <a href="TermsAndConditions.aspx" target="_blank">Terms & Conditions</a>.
              </div>
              <button class="wl-sticky-btn" type="button" id="wl-sticky-complete">Complete Order</button>
            `;
            shell.appendChild(sticky);
            document.getElementById('wl-sticky-complete')?.addEventListener('click', () => {
              if (platformTnC && !platformTnC.checked) platformTnC.checked = true;
              completeBtn?.click();
            });
          })();
      
          // Back before header (mobile)
          (function moveBackBeforeHeader(){
            const headerEl = document.getElementById("ctl00_PageBody_SummaryHeading_HeaderText");
            if (!headerEl) return;
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'wl-btn secondary mobile';
            b.style.margin = '10px 0';
            b.textContent = 'Back';
            b.addEventListener('click', () => document.getElementById("ctl00_PageBody_BackToCartButton5")?.click());
            headerEl.parentElement?.insertBefore(b, headerEl);
          })();
      
          // Totals into tfoot (adds Shipping line)
          (function moveTotalsIntoTable(){
            const table = shell.querySelector('.wl-table');
            if (!table) return;
      
            const tf = document.createElement('tfoot');
            const shipping = getShipping();
            const t = collectTotals(); // re-use in case updated
      
            tf.innerHTML = `
              <tr>
                <td colspan="4"></td>
                <td>Subtotal</td>
                <td class="wl-right">${escapeHTML(t.subtotal)}</td>
              </tr>
              <tr>
                <td colspan="4"></td>
                <td>${escapeHTML(shipping.label)}</td>
                <td class="wl-right">${escapeHTML(shipping.amount)}</td>
              </tr>
              ${t.tax ? `
                <tr>
                  <td colspan="4"></td>
                  <td>Tax</td>
                  <td class="wl-right">${escapeHTML(t.tax)}</td>
                </tr>
              ` : ''}
              <tr>
                <td colspan="4"></td>
                <td>Total</td>
                <td class="wl-right">${escapeHTML(t.total)}</td>
              </tr>
            `;
            table.appendChild(tf);
            shell.querySelector('.wl-totals')?.remove();
          })();
      
          // Wire buttons
          document.getElementById('wl-back')?.addEventListener('click', () => backBtn?.click());
          document.getElementById('wl-complete')?.addEventListener('click', () => {
            if (platformTnC && !platformTnC.checked) platformTnC.checked = true;
            completeBtn?.click();
          });
      
          return shell; // so caller can add thumbnails next
        }
      
        // -----------------------------
        // Helpers used by builder
        // -----------------------------
        function hideLegacyButtons() {
          const backBtn = document.getElementById("ctl00_PageBody_BackToCartButton5");
          const completeBtn = document.getElementById("ctl00_PageBody_CompleteCheckoutButton");
          if (backBtn) backBtn.style.setProperty("display", "none", "important");
          if (completeBtn) completeBtn.style.setProperty("display", "none", "important");
        }
      
        function updateSummaryHeader(newText = "Review & Complete Your Order") {
          const headerEl = document.getElementById("ctl00_PageBody_SummaryHeading_HeaderText");
          if (headerEl) headerEl.textContent = newText;
        }
      
        function getShipping() {
          const deliveryRow = document.getElementById('ctl00_PageBody_ShoppingCartSummaryTableControl_DeliverySummaryRow');
          const deliveryAmt = deliveryRow?.querySelector('td.numeric')?.textContent?.trim();
          if (deliveryAmt) return { label: 'Delivery', amount: deliveryAmt };
          return { label: 'Pickup', amount: 'Free' };
        }
      
        // -----------------------------
        // Thumbnails: cache (cart page) + add to summary
        // -----------------------------
        function ensureCartImageCache(){
          try {
            const items = document.querySelectorAll('.row.shopping-cart-item');
            if (!items.length) return;
            const map = JSON.parse(sessionStorage.getItem('wlCartImages') || '{}');
            let updated = false;
      
            items.forEach(item => {
              const img = item.querySelector('.ThumbnailImage') || item.querySelector('.image-wrapper img');
              const code = (item.querySelector('a[title] .portalGridLink')?.textContent || '').trim().toUpperCase();
              let src = img?.getAttribute('src') || '';
              if (!code || !src) return;
              if (src.startsWith('/')) src = location.origin + src;
              if (!map[code]) { map[code] = src; updated = true; }
            });
      
            if (updated) sessionStorage.setItem('wlCartImages', JSON.stringify(map));
          } catch(e){}
        }
      
        function addThumbnailsToLinesSafe() {
          const table = document.querySelector('.wl-table');
          if (!table || table._wlThumbsApplied) return;
      
          let imgMap = {};
          try { imgMap = JSON.parse(sessionStorage.getItem('wlCartImages') || '{}'); } catch(e){}
      
          const theadRow = table.querySelector('thead tr');
          const bodyRows = table.querySelectorAll('tbody tr');
          if (!theadRow || !bodyRows.length) return;
      
          // map codes from Product Code cells
          const codes = Array.from(bodyRows).map(tr => {
            const codeCell = tr.querySelector('td[data-title="Product Code"]') || tr.children[0];
            return (codeCell?.textContent || '').trim().toUpperCase();
          });
          const hasAnyImage = codes.some(c => imgMap[c]);
          if (!hasAnyImage) return;
      
          // Insert Item header once
          if (!theadRow._wlThumbHeader) {
            const th = document.createElement('th'); th.textContent = 'Item';
            theadRow.insertBefore(th, theadRow.firstChild);
            theadRow._wlThumbHeader = true;
          }
      
          bodyRows.forEach(tr => {
            if (tr._wlThumbAdded) return;
            const codeCell = tr.querySelector('td[data-title="Product Code"]') || tr.children[0];
            const code = (codeCell?.textContent || '').trim().toUpperCase();
            const imgUrl = imgMap[code];
      
            const td = document.createElement('td');
            td.innerHTML = imgUrl
              ? `<img src="${imgUrl}" alt="${code}" loading="lazy" style="width:48px;height:48px;object-fit:cover;border-radius:6px;">`
              : `<div style="width:48px;height:48px;border-radius:6px;background:#f0f0f3;"></div>`;
            tr.insertBefore(td, tr.firstChild);
            tr._wlThumbAdded = true;
          });
      
          // Fix tfoot colspans
          const tfoot = table.querySelector('tfoot');
          if (tfoot) {
            const colCount = theadRow.children.length;
            const labelSpan = Math.max(colCount - 2, 1);
            tfoot.querySelectorAll('tr').forEach(tr => {
              const tds = tr.querySelectorAll('td');
              const label = tds[tds.length-2]?.textContent || '';
              const amt   = tds[tds.length-1]?.textContent || '';
              tr.innerHTML = `
                <td colspan="${labelSpan}"></td>
                <td>${label}</td>
                <td class="wl-right">${amt}</td>
              `;
            });
          }
      
          // Desktop widths when thumbnail present
          if (!document.getElementById('wl-thumb-cols')) {
            const style = document.createElement('style');
            style.id = 'wl-thumb-cols';
            style.textContent = `
              @media (min-width: 992px) {
                .wl-lines .wl-table { table-layout: fixed; }
                .wl-lines .wl-table th:nth-child(1),
                .wl-lines .wl-table td:nth-child(1) { width: 64px; }
                .wl-lines .wl-table th:nth-child(2),
                .wl-lines .wl-table td:nth-child(2) { width: 110px; }
                .wl-lines .wl-table th:nth-child(3),
                .wl-lines .wl-table td:nth-child(3) { width: auto; }
                .wl-lines .wl-table th:nth-child(4),
                .wl-lines .wl-table td:nth-child(4) { width: 70px; text-align:right; }
                .wl-lines .wl-table th:nth-child(5),
                .wl-lines .wl-table td:nth-child(5) { width: 60px; }
                .wl-lines .wl-table th:nth-child(6),
                .wl-lines .wl-table td:nth-child(6) { width: 110px; text-align:right; }
                .wl-lines .wl-table th:nth-child(7),
                .wl-lines .wl-table td:nth-child(7) { width: 120px; text-align:right; }
                .wl-lines .wl-table td:nth-child(3) { white-space: normal; overflow-wrap: break-word; hyphens: auto; }
              }
            `;
            document.head.appendChild(style);
          }
      
          table._wlThumbsApplied = true;
        }
      
        // -----------------------------
        // WebForms / SPA-like re-init
        // -----------------------------
        function safeInit() {
          // First, cache images if we’re on a cart step that has them
          ensureCartImageCache();
      
          // If summary exists and not built, build it
          const hasSummary = !!document.querySelector('#summary');
          const hasModern = !!document.querySelector('.wl-modern-summary');
          if (hasSummary && !hasModern) {
            const shell = buildModernSummary();
            if (shell) addThumbnailsToLinesSafe();
            return;
          }
      
          // If already built, we may only need to (re)apply thumbs after data updates
          if (hasModern) addThumbnailsToLinesSafe();
        }
      
        function onReady(fn){ document.readyState !== 'loading' ? fn() : document.addEventListener('DOMContentLoaded', fn); }
      
        function attachPageRequestManagerHook() {
          try {
            if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager) {
              var prm = Sys.WebForms.PageRequestManager.getInstance();
              if (!prm._wlHooked) {
                prm.add_endRequest(function(){ safeInit(); });
                prm._wlHooked = true;
              }
            }
          } catch(e){}
        }
      
        function attachMutationObserver() {
          try {
            var target = document.querySelector('.mainContents') || document.body;
            if (!target || target._wlObserver) return;
            var mo = new MutationObserver(function(){
              if (document.querySelector('#summary')) safeInit();
            });
            mo.observe(target, { childList: true, subtree: true });
            target._wlObserver = mo;
          } catch(e){}
        }
      
        // -----------------------------
        // Boot
        // -----------------------------
        onReady(function(){
          attachPageRequestManagerHook();
          attachMutationObserver();
          // initial pass
          safeInit();
        });
      })();
    } catch(e) {
      console.error('[WL.ModernSummary] error', e);
    }
  };
})();



(function(){
  var WL = window.WL || (window.WL = {});
  WL.StoreNotification = WL.StoreNotification || {};
  WL.StoreNotification.run = function(){
    try {
      if (!(true)) return;
      (function() {
        // ensure it only runs once
        if (window.__orderNotify) return;
        window.__orderNotify = true;
      
        document.addEventListener("DOMContentLoaded", () => {
          let attempts = 0;
          const maxAttempts = 10;
      
          const interval = setInterval(() => {
            attempts++;
      
            const thankYou = document.querySelector("#CartResponseMessage");
            const merchant = document.querySelector("#ctl00_PageBody_SuccessfulPaymentResults_MerchantDetailsPanel");
      
            if (thankYou && merchant) {
              clearInterval(interval);
      
              // extract order number
              const orderEl = thankYou.querySelector("strong");
              const orderNumber = orderEl ? orderEl.textContent.trim() : "";
      
              // extract branch name (first line of the address block)
              const td = merchant.querySelector("td");
              const branchName = td
                ? td.textContent.split("\n")[0].trim()
                : "";
      
              // POST to your Apps Script Web App
              fetch("https://script.google.com/macros/s/AKfycbyyNX8SshEk5opzF6YUHZpCcBomWWWXv3RG3dh3JPGqVGDsgriFT0s1ZuMEX7m73etF/exec", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({ orderNumber, branchName })
              })
              .catch(err => console.error("Order notify failed:", err));
            }
      
            // stop polling after too many attempts
            if (attempts >= maxAttempts) {
              clearInterval(interval);
            }
          }, 500);
        });
      })();
    } catch(e) {
      console.error('[WL.StoreNotification] error', e);
    }
  };
})();

