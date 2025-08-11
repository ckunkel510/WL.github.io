(function () {
  const userID = localStorage.getItem("wl_user_id");
  console.log("[ForteVault] Retrieved wl_user_id from localStorage:", userID);
  if (!userID) {
    console.warn("[ForteVault] No wl_user_id found.");
    return;
  }

  let vaultedAccounts = [];

  // Fetch saved payment methods
  fetch("https://wlmarketingdashboard.vercel.app/api/public/getVaultedAccounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userID })
  })
    .then(res => res.json())
    .then(data => {
      console.log("[ForteVault] Vault fetch response:", data);

      if (data?.paymentMethods?.length > 0) {
        vaultedAccounts = data.paymentMethods;
        window.vaultedAccounts = data.paymentMethods;
        console.log(`[ForteVault] Found ${vaultedAccounts.length} vaulted accounts.`);
      } else {
        console.log("[ForteVault] No saved payment methods found.");
      }

      attachPaymentIntercept();
    })
    .catch(err => {
      console.error("[ForteVault] Error fetching vaulted accounts:", err);
    });

  function attachPaymentIntercept() {
    const paymentBtn = document.querySelector("#ctl00_PageBody_ForteMakePayment");
    if (!paymentBtn) {
      console.warn("[ForteVault] Payment button not found on page.");
      return;
    }

    console.log("[ForteVault] Attaching event listener to Make Payment button");

    paymentBtn.addEventListener("click", function (e) {
      const skipVault = sessionStorage.getItem("skipVaultModal");
      if (skipVault === "true") {
        console.log("[ForteVault] Skipping vault modal — proceeding to overlay");
        sessionStorage.removeItem("skipVaultModal");
        return; // let the native DEX overlay open
      }

      e.preventDefault();

      if (vaultedAccounts.length > 0) {
        showVaultListModal(vaultedAccounts);
      } else {
        showNoAccountModal();
      }
    });
  }

  // Step 1: List of saved methods
  function showVaultListModal(accounts) {
    console.log("[ForteVault] Launching vault selection modal");
    const modal = createModal();

    const title = h2("Choose a Saved Payment Method");
    const list = div({ style: "margin: 20px 0" });

    accounts.forEach(pm => {
      const btn = button(
        `${pm.label} ••••${pm.last4} (${(pm.accountType || "").toLowerCase() || "account"})`,
        baseBtnStyle(),
        () => {
          // Open preview/confirm step for this method
          cleanupModal();
          showPreviewModal(pm);
        }
      );
      list.appendChild(btn);
    });

    const newBtn = primaryButton("Use a New Account", () => {
      console.log("[ForteVault] User chose 'Use a New Account'");
      cleanupModal();
      // allow DEX overlay to open
      sessionStorage.setItem("skipVaultModal", "true");
      openDexOverlay();
    });

    appendToModal(modal, [title, list, newBtn]);
  }

  // Step 2: Preview & confirm for a specific saved method
  function showPreviewModal(pm) {
    console.log("[ForteVault] Showing preview modal for token:", pm.token);
    const modal = createModal();

    const title = h2("Confirm Payment Method");
    const details = div({ style: "margin: 12px 0; text-align:left" });
    details.innerHTML = `
      <div style="font-size:14px; line-height:1.5">
        <div><strong>Label:</strong> ${escapeHtml(pm.label || "Saved Account")}</div>
        <div><strong>Account:</strong> •••• ${escapeHtml(pm.last4 || "")}</div>
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
      console.log("[ForteVault] User switched to a new account");
      cleanupModal();
      sessionStorage.setItem("skipVaultModal", "true");
      openDexOverlay(); // new entry path
    });

    const confirmBtn = primaryButton("Confirm & Continue", () => {
      console.log("[ForteVault] Confirmed token:", pm.token);
      // store token for your DEX submit handler to use server-side
      sessionStorage.setItem("selectedPaymethodToken", pm.token);
      // let the next click bypass our vault modal
      sessionStorage.setItem("skipVaultModal", "true");
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
      openDexOverlay();
    });

    appendToModal(modal, [title, text, addBtn]);
  }

  // ——— helpers ———

  function openDexOverlay() {
    // ensure "Check" is selected if applicable
    const checkRadio = document.querySelector("#ctl00_PageBody_rbPayByCheck");
    if (checkRadio) {
      checkRadio.checked = true;
      checkRadio.click();
    }
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

  function appendToModal(modal, elements) {
    const box = modal.querySelector("div");
    elements.forEach(el => box.appendChild(el));
  }

  function cleanupModal() {
    const modal = document.getElementById("vaultModal");
    if (modal) modal.remove();
  }

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
    return String(str || "").replace(/[&<>"']/g, s => ({
      '&':'&nbsp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
    }[s]));
  }
})();
