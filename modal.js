
(function () {
  const userID = localStorage.getItem("wl_user_id");
  console.log("[ForteVault] Retrieved wl_user_id from localStorage:", userID);
  if (!userID) { console.warn("[ForteVault] No wl_user_id found."); return; }

  let vaultedAccounts = [];
  let forteCustomerToken = null;

  // --- Fetch saved methods + customer token ---
  fetch("https://wlmarketingdashboard.vercel.app/api/public/getVaultedAccounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userID })
  })
  .then(res => res.json())
  .then(data => {
    console.log("[ForteVault] Vault fetch response:", data);
    forteCustomerToken = data.customerToken || null;

    if (data?.paymentMethods?.length > 0) {
      vaultedAccounts = data.paymentMethods;
      window.vaultedAccounts = vaultedAccounts;
      console.log(`[ForteVault] Found ${vaultedAccounts.length} vaulted accounts.`);
    } else {
      console.log("[ForteVault] No saved payment methods found.");
    }

    attachPaymentIntercept();
  })
  .catch(err => {
    console.error("[ForteVault] Error fetching vaulted accounts:", err);
  });

  // --- Intercept Make Payment to show our modal (unless skip flag set) ---
  function attachPaymentIntercept() {
    const paymentBtn = document.querySelector("#ctl00_PageBody_ForteMakePayment");
    if (!paymentBtn) { console.warn("[ForteVault] Payment button not found on page."); return; }

    console.log("[ForteVault] Attaching event listener to Make Payment button");
    paymentBtn.addEventListener("click", function (e) {
      const skipVault = sessionStorage.getItem("skipVaultModal");
      if (skipVault === "true") {
        sessionStorage.removeItem("skipVaultModal");
        console.log("[ForteVault] Skipping vault modal — proceeding to DEX");
        return; // let DEX open
      }

      e.preventDefault();
      if (vaultedAccounts.length > 0) showVaultListModal(vaultedAccounts);
      else showNoAccountModal();
    });
  }

  // --- build hidden inputs in the same form Checkout uses ---
  function ensureHiddenInput(form, name, value) {
    let el = form.querySelector(`[name="${name}"]`);
    if (!el) {
      el = document.createElement("input");
      el.type = "hidden";
      el.name = name;
      form.appendChild(el);
    }
    el.value = value;
  }

  // inject customer_token + payment_token before opening overlay
  function prefillCheckoutWithTokens(paymethodToken) {
    const paymentBtn = document.querySelector("#ctl00_PageBody_ForteMakePayment");
    const form = paymentBtn?.form || paymentBtn?.closest("form");
    if (!form) { console.warn("[ForteVault] Could not find Checkout form."); return; }

    if (forteCustomerToken) {
      ensureHiddenInput(form, "customer_token", forteCustomerToken);
    } else {
      console.warn("[ForteVault] Missing forteCustomerToken; modal will not be pre-linked.");
    }

    ensureHiddenInput(form, "payment_token", paymethodToken);
    // keep save_token=false when using an existing vaulted method
    ensureHiddenInput(form, "save_token", "false");

    // (We do not touch signature/hash fields; per Forte Checkout v2 they don't include these extras.)
  }

  function openDexOverlay() {
    // Make sure 'Check' option is selected if needed
    const checkRadio = document.querySelector("#ctl00_PageBody_rbPayByCheck");
    if (checkRadio) { checkRadio.checked = true; checkRadio.click(); }

    setTimeout(() => {
      const paymentButton = document.querySelector("#ctl00_PageBody_ForteMakePayment");
      if (paymentButton) {
        console.log("[ForteVault] Opening DEX overlay…");
        paymentButton.click();
      } else {
        console.warn("[ForteVault] Payment button not found for DEX overlay.");
      }
    }, 250);
  }

  // ---- MODALS ----
  function showVaultListModal(accounts) {
    const modal = createModal();
    const title = h2("Choose a Saved Payment Method");
    const list = div({ style: "margin: 20px 0" });

    accounts.forEach(pm => {
      const label = `${pm.label || "Saved Account"} ••••${pm.last4 || ""} ${(pm.accountType || "").toLowerCase()}`;
      const btn = button(label, baseBtnStyle(), () => {
        cleanupModal();
        showPreviewModal(pm);
      });
      list.appendChild(btn);
    });

    const newBtn = primaryButton("Use a New Account", () => {
      cleanupModal();
      sessionStorage.setItem("skipVaultModal", "true");  // let next click go through
      // IMPORTANT: do NOT inject payment_token here
      openDexOverlay();
    });

    appendToModal(modal, [title, list, newBtn]);
  }

  function showPreviewModal(pm) {
    const modal = createModal();
    const title = h2("Confirm Payment Method");
    const details = div({ style: "margin: 12px 0; text-align:left" });
    details.innerHTML = `
      <div style="font-size:14px; line-height:1.5">
        <div><strong>Label:</strong> ${escapeHtml(pm.label || "Saved Account")}</div>
        <div><strong>Account:</strong> ${pm.last4 ? "•••• " + escapeHtml(pm.last4) : "—"}</div>
        <div><strong>Type:</strong> ${escapeHtml((pm.accountType || "").toLowerCase() || "—")}</div>
      </div>
      <div style="margin-top:10px; font-size:12px; color:#666">
        You’ll confirm on the next step in our secure payment overlay.
      </div>
    `;

    const actions = div({ style: "margin-top:16px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap" });

    const backBtn = button("Back", outlineBtnStyle(), () => {
      cleanupModal();
      showVaultListModal(vaultedAccounts);
    });

    const useDifferentBtn = button("Use a Different Account", outlineBtnStyle(), () => {
      cleanupModal();
      sessionStorage.setItem("skipVaultModal", "true");
      // IMPORTANT: do NOT inject payment_token here
      openDexOverlay();
    });

    const confirmBtn = primaryButton("Confirm & Continue", () => {
      // store so server can also know (optional)
      sessionStorage.setItem("selectedPaymethodToken", pm.token);
      sessionStorage.setItem("skipVaultModal", "true");
      // inject tokens into the same form that Checkout posts
      prefillCheckoutWithTokens(pm.token);
      cleanupModal();
      openDexOverlay();
    });

    actions.append(backBtn, useDifferentBtn, confirmBtn);
    appendToModal(modal, [title, details, actions]);
  }

  function showNoAccountModal() {
    const modal = createModal();
    const title = h2("No Saved Payment Methods");
    const text = p("You’ll need to add a bank account before you can make a payment.");
    const addBtn = primaryButton("Add Payment Method", () => {
      cleanupModal();
      sessionStorage.setItem("skipVaultModal", "true");
      // Do not inject tokens when adding new
      openDexOverlay();
    });
    appendToModal(modal, [title, text, addBtn]);
  }

  // --- modal element helpers ---
  function createModal() {
    const modal = document.createElement("div");
    modal.id = "vaultModal";
    modal.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0, 0, 0, 0.6); z-index: 9999;
      display: flex; align-items: center; justify-content: center;
    `;
    const box = div({
      style: `
        background: white; padding: 20px; border-radius: 8px;
        width: 90%; max-width: 420px; text-align: center;
        box-shadow: 0 10px 30px rgba(0,0,0,.2);
      `
    });
    modal.appendChild(box);
    document.body.appendChild(modal);
    return modal;
  }
  function appendToModal(modal, elements) { const box = modal.querySelector("div"); elements.forEach(el => box.appendChild(el)); }
  function cleanupModal() { const modal = document.getElementById("vaultModal"); if (modal) modal.remove(); }

  // element helpers
  function h2(txt) { const e = document.createElement("h2"); e.textContent = txt; return e; }
  function p(txt) { const e = document.createElement("p"); e.textContent = txt; return e; }
  function div(attrs = {}) { const e = document.createElement("div"); Object.assign(e, attrs); return e; }
  function button(text, style, onClick) { const b = document.createElement("button"); b.textContent = text; b.style.cssText = style; b.onclick = onClick; return b; }
  function primaryButton(text, onClick) {
    return button(text, `
      padding: 10px 16px;
      background: #6b0016; color: white; border: none; border-radius: 6px;
      cursor: pointer; min-width: 180px;
    `, onClick);
  }
  function outlineBtnStyle() {
    return `
      padding: 10px 16px;
      background: white; color: #6b0016; border: 1px solid #6b0016; border-radius: 6px;
      cursor: pointer; min-width: 180px;
    `;
  }
  function baseBtnStyle() {
    return `
      display: block; width: 100%; margin-bottom: 10px;
      padding: 10px; border-radius: 6px; border: 1px solid #ccc;
      cursor: pointer; text-align:left;
    `;
  }
  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));
  }
})();

