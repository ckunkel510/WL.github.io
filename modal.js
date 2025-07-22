(function () {
  if (!window.location.pathname.includes("AccountPayment_r.aspx")) return;

  const userID = getCookie("wl_user_id");
  if (!userID) return;

  let vaultedAccounts = [];

  fetch("https://wlmarketingdashboard.vercel.app/api/getVaultedAccounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userID })
  })
    .then(res => res.json())
    .then(data => {
      if (data?.paymentMethods?.length) {
        window.vaultedAccounts = data.paymentMethods;
        vaultedAccounts = data.paymentMethods;
        console.log("[ForteVault] Found vaulted accounts");
      } else {
        console.log("[ForteVault] No saved vault accounts");
      }

      attachPaymentIntercept();
    });

  function attachPaymentIntercept() {
    const paymentBtn = document.querySelector("#ctl00_PageBody_ForteMakePayment");
    if (!paymentBtn) return;

    paymentBtn.addEventListener("click", function (e) {
      e.preventDefault();

      if (vaultedAccounts.length > 0) {
        showVaultModal(vaultedAccounts);
      } else {
        showNoAccountModal();
      }
    });
  }

  function showVaultModal(accounts) {
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
        sessionStorage.setItem("selectedPaymethodToken", pm.token);
        cleanupModal();
        document.querySelector("#ctl00_PageBody_ForteMakePayment").click();
      };
      list.appendChild(btn);
    });

    const newBtn = createPrimaryButton("Use a New Account", () => {
      cleanupModal();
      document.querySelector("#ctl00_PageBody_ForteMakePayment").click();
    });

    appendToModal(modal, [title, list, newBtn]);
  }

  function showNoAccountModal() {
    const modal = createModal();

    const title = document.createElement("h2");
    title.textContent = "No Saved Payment Methods";

    const text = document.createElement("p");
    text.textContent = "You’ll need to add a bank account before you can make a payment.";

    const addBtn = createPrimaryButton("Add Payment Method", () => {
      cleanupModal();
      document.querySelector("#ctl00_PageBody_ForteMakePayment").click();
    });

    appendToModal(modal, [title, text, addBtn]);
  }

  function createModal() {
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
    if (modal) modal.remove();
  }

  function baseBtnStyle() {
    return `
      display: block; width: 100%; margin-bottom: 10px;
      padding: 10px; border-radius: 4px; border: 1px solid #ccc;
      cursor: pointer;
    `;
  }

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
  }
})();
