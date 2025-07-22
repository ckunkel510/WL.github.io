(function () {
  
  const userID = localStorage.getItem("wl_user_id");
console.log("[ForteVault] Retrieved wl_user_id from localStorage:", userID);

  console.log("[ForteVault] Cookie wl_user_id:", userID);

  if (!userID) {
    console.warn("[ForteVault] No wl_user_id cookie found.");
    return;
  }

  let vaultedAccounts = [];

  // 🔄 Fetch saved payment methods
  fetch("https://wlmarketingdashboard.vercel.app/api/getVaultedAccounts.js", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userID })
  })
    .then(res => res.json())
    .then(data => {
      console.log("[ForteVault] Vault fetch response:", data);

      if (data?.paymentMethods?.length > 0) {
        window.vaultedAccounts = data.paymentMethods;
        vaultedAccounts = data.paymentMethods;
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
      e.preventDefault();
      console.log("[ForteVault] Make Payment button clicked.");

      if (vaultedAccounts.length > 0) {
        console.log("[ForteVault] Showing modal with saved methods");
        showVaultModal(vaultedAccounts);
      } else {
        console.log("[ForteVault] No saved accounts — showing 'Add New' modal");
        showNoAccountModal();
      }
    });
  }

  function showVaultModal(accounts) {
    console.log("[ForteVault] Launching vault selection modal");

    const modal = createModal();

    const title = document.createElement("h2");
    title.textContent = "Choose a Saved Payment Method";

    const list = document.createElement("div");
    list.style.margin = "20px 0";

    accounts.forEach(pm => {
      const btn = document.createElement("button");
      btn.textContent = `${pm.label} ••••${pm.last4}`;
      btn.style.cssText = baseBtnStyle();
      btn.onclick = () => {
        console.log("[ForteVault] User selected token:", pm.token);
        sessionStorage.setItem("selectedPaymethodToken", pm.token);
        cleanupModal();
        document.querySelector("#ctl00_PageBody_ForteMakePayment").click();
      };
      list.appendChild(btn);
    });

    const newBtn = createPrimaryButton("Use a New Account", () => {
      console.log("[ForteVault] User clicked 'Use a New Account'");
      cleanupModal();
      document.querySelector("#ctl00_PageBody_ForteMakePayment").click();
    });

    appendToModal(modal, [title, list, newBtn]);
  }

  function showNoAccountModal() {
    console.log("[ForteVault] Showing 'No saved accounts' modal");

    const modal = createModal();

    const title = document.createElement("h2");
    title.textContent = "No Saved Payment Methods";

    const text = document.createElement("p");
    text.textContent = "You’ll need to add a bank account before you can make a payment.";

    const addBtn = createPrimaryButton("Add Payment Method", () => {
      console.log("[ForteVault] User chose to add new payment method");
      cleanupModal();
      document.querySelector("#ctl00_PageBody_ForteMakePayment").click();
    });

    appendToModal(modal, [title, text, addBtn]);
  }

  function createModal() {
    console.log("[ForteVault] Creating modal overlay");

    const modal = document.createElement("div");
    modal.id = "vaultModal";
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.6); z-index: 9999; display: flex;
      align-items: center; justify-content: center;
    `;

    const box = document.createElement("div");
    box.style.cssText = `
      background: white; padding: 20px; border-radius: 8px;
      width: 90%; max-width: 400px; text-align: center;
    `;
    modal.appendChild(box);
    document.body.appendChild(modal);
    return modal;
  }

  function appendToModal(modal, elements) {
    const box = modal.querySelector("div");
    elements.forEach(el => box.appendChild(el));
  }

  function createPrimaryButton(text, onclick) {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.style.cssText = `
      margin-top: 20px; padding: 10px 20px;
      background: #6b0016; color: white; border: none; border-radius: 4px;
      cursor: pointer;
    `;
    btn.onclick = onclick;
    return btn;
  }

  function cleanupModal() {
    const modal = document.getElementById("vaultModal");
    if (modal) {
      console.log("[ForteVault] Cleaning up modal");
      modal.remove();
    }
  }

  function baseBtnStyle() {
    return `
      display: block; width: 100%; margin-bottom: 10px;
      padding: 10px; border-radius: 4px; border: 1px solid #ccc;
      cursor: pointer;
    `;
  }

  function getCookie(name) {
  const cookies = document.cookie;
  console.log("[ForteVault] Raw document.cookie:", cookies);

  const cookieArray = cookies.split(";").map(c => c.trim());
  for (let c of cookieArray) {
    if (c.startsWith(name + "=")) {
      const value = c.split("=").slice(1).join("=");
      console.log(`[ForteVault] Matched cookie: ${name} = ${value}`);
      return value;
    }
  }

  console.warn(`[ForteVault] Cookie '${name}' not found.`);
  return null;
}

})();
