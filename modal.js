setTimeout(() => {
(function () {
  // ---------- CONFIG ----------
  const GET_VAULT_URL = "https://wlmarketingdashboard.vercel.app/api/public/getVaultedAccounts";
  const SIGN_URL      = "https://wlmarketingdashboard.vercel.app/api/public/signCheckout";

  // ---------- STATE ----------
  const userID = localStorage.getItem("wl_user_id");
  let vaultedAccounts = [];
  let forteCustomerToken = null;

  console.log("[ForteVault] wl_user_id:", userID);
  if (!userID) { console.warn("[ForteVault] No wl_user_id found."); return; }

  // ---------- BOOTSTRAP ----------
  fetch(GET_VAULT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userID })
  })
  .then(r => r.json())
  .then(data => {
    console.log("[ForteVault] Vault fetch:", data);
    forteCustomerToken = data.customerToken || null;
    vaultedAccounts = Array.isArray(data.paymentMethods) ? data.paymentMethods : [];
    attachPaymentIntercept();
  })
  .catch(err => console.error("[ForteVault] fetch error:", err));

  // ---------- INTERCEPT "MAKE PAYMENT" ----------
  function attachPaymentIntercept() {
    const paymentBtn = document.querySelector("#ctl00_PageBody_ForteMakePayment");
    if (!paymentBtn) { console.warn("[ForteVault] Make Payment button not found."); return; }

    paymentBtn.addEventListener("click", function (e) {
      const skipVault = sessionStorage.getItem("skipVaultModal");
      if (skipVault === "true") {
        sessionStorage.removeItem("skipVaultModal");
        console.log("[ForteVault] Skipping vault modal — proceed to DEX.");
        return; // allow normal Checkout/DEX to open
      }

      e.preventDefault();

      if (vaultedAccounts.length > 0) {
        showVaultListModal(vaultedAccounts);
      } else {
        showNoAccountModal();
      }
    });
  }

  // ---------- SIGNATURE HELPERS ----------
  async function signCheckout({ method, version_number, total_amount, order_number, customer_token, paymethod_token }) {
    const payload = { method, version_number, total_amount, order_number, customer_token, paymethod_token };
    const resp = await fetch(SIGN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) throw new Error(`signCheckout HTTP ${resp.status}`);
    const data = await resp.json();
    if (!data.signature || !data.utc_time) throw new Error("signCheckout: missing signature/utc_time");
    return data; // { signature, utc_time }
  }

  function setFieldOrAttr(name, value) {
    const paymentBtn = document.querySelector("#ctl00_PageBody_ForteMakePayment");
    const input = document.querySelector(`[name="${name}"]`);
    if (input) input.value = value;
    if (paymentBtn) paymentBtn.setAttribute(name, value);
  }

  function getFromFieldOrAttr(name, fallback = "") {
    const paymentBtn = document.querySelector("#ctl00_PageBody_ForteMakePayment");
    const input = document.querySelector(`[name="${name}"]`);
    return (input?.value) || (paymentBtn?.getAttribute(name)) || fallback;
  }

  // In case Checkout binds events to the button early, replace the node so attributes are re-read
  function replaceButtonNode(btn) {
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
    return document.querySelector("#ctl00_PageBody_ForteMakePayment");
  }

  // ---------- OPEN CHECKOUT / DEX ----------
  function openDexOverlay() {
    const checkRadio = document.querySelector("#ctl00_PageBody_rbPayByCheck");
    if (checkRadio) { checkRadio.checked = true; checkRadio.click(); }

    setTimeout(() => {
      let paymentButton = document.querySelector("#ctl00_PageBody_ForteMakePayment");
      if (paymentButton) {
        console.log("[ForteVault] Opening DEX overlay…");
        paymentButton.click();
      } else {
        console.warn("[ForteVault] Make Payment button not found at launch time.");
      }
    }, 250);
  }

  // ---------- BUTTON PREP (WITH TOKENS) ----------
 // ---------- BUTTON PREP (WITH TOKENS) ----------
async function prepareAndLaunchWithTokens(paymethodToken) {
  let paymentBtn = document.querySelector("#ctl00_PageBody_ForteMakePayment");
  if (!paymentBtn) { console.warn("[ForteVault] Pay button not found."); return; }

  // Put tokens on the button
  if (forteCustomerToken) {
    paymentBtn.setAttribute("customer_token", forteCustomerToken);
  } else {
    paymentBtn.removeAttribute("customer_token");
    console.warn("[ForteVault] No forteCustomerToken — overlay may not preselect.");
  }
  paymentBtn.setAttribute("paymethod_token", paymethodToken);
  paymentBtn.setAttribute("payment_token", paymethodToken);
  paymentBtn.setAttribute("save_token", "false");

  // Also mirror as hidden inputs
  setFieldOrAttr("customer_token", forteCustomerToken || "");
  setFieldOrAttr("paymethod_token", paymethodToken || "");
  setFieldOrAttr("payment_token", paymethodToken || "");
  setFieldOrAttr("save_token", "false");

  // Gather values for signature
  const method         = paymentBtn.getAttribute("method")         || "sale";
  const version_number = paymentBtn.getAttribute("version_number") || "2.0";
  const total_amount   = getFromFieldOrAttr("total_amount", "0.00");
  const order_number   = getFromFieldOrAttr("order_number", "ORDER");
  const utc_time_page  = getFromFieldOrAttr("utc_time"); // <-- Use the page's utc_time

  const { signature } = await signCheckout({
    method, version_number, total_amount, order_number,
    customer_token: forteCustomerToken || "",
    paymethod_token: paymethodToken || "",
    utc_time: utc_time_page // <-- Send the same time for signing
  });

  setFieldOrAttr("signature", signature);
  // Do NOT overwrite utc_time — keep page's
  setFieldOrAttr("allowed_methods", "echeck");

  // Replace node to force re-bind
  paymentBtn = replaceButtonNode(paymentBtn);

  // Debug: show attributes
  console.log("[ForteVault] Button before click (WITH tokens):", paymentBtn.outerHTML);

  debugger; // stops JS until you resume in DevTools
  await new Promise(r => setTimeout(r, 3000)); // pause so you can inspect

  // Bypass modal and launch overlay
  sessionStorage.setItem("skipVaultModal", "true");
  openDexOverlay();
}

// ---------- BUTTON PREP (WITHOUT TOKENS) ----------
async function prepareAndLaunchWithoutTokens() {
  let paymentBtn = document.querySelector("#ctl00_PageBody_ForteMakePayment");
  if (!paymentBtn) { console.warn("[ForteVault] Pay button not found."); return; }

  // Ensure no tokens are present
  paymentBtn.removeAttribute("customer_token");
  paymentBtn.removeAttribute("paymethod_token");
  paymentBtn.removeAttribute("payment_token");
  paymentBtn.setAttribute("save_token", "false");

  // Clear any inputs too
  setFieldOrAttr("customer_token", "");
  setFieldOrAttr("paymethod_token", "");
  setFieldOrAttr("payment_token", "");
  setFieldOrAttr("save_token", "false");

  const method         = paymentBtn.getAttribute("method")         || "sale";
  const version_number = paymentBtn.getAttribute("version_number") || "2.0";
  const total_amount   = getFromFieldOrAttr("total_amount", "0.00");
  const order_number   = getFromFieldOrAttr("order_number", "ORDER");
  const utc_time_page  = getFromFieldOrAttr("utc_time"); // <-- Use the page's utc_time

  const { signature } = await signCheckout({
    method, version_number, total_amount, order_number,
    customer_token: "",
    paymethod_token: "",
    utc_time: utc_time_page // <-- Send the same time for signing
  });

  setFieldOrAttr("signature", signature);
  // Keep original utc_time
  setFieldOrAttr("allowed_methods", "echeck");

  // Replace to ensure fresh attributes are read
  paymentBtn = replaceButtonNode(paymentBtn);

  console.log("[ForteVault] Button before click (NO tokens):", paymentBtn.outerHTML);

  debugger; // optional: stop so you can inspect before overlay
  await new Promise(r => setTimeout(r, 3000));

  sessionStorage.setItem("skipVaultModal", "true");
  openDexOverlay();
}


  // ---------- MODALS ----------
  function showVaultListModal(accounts) {
    const modal = createModal();
    const title = h2("Choose a Saved Payment Method");
    const list  = div({ style: "margin: 20px 0" });

    accounts.forEach(pm => {
      const label = `${pm.label || "Saved Account"}${pm.last4 ? " ••••"+pm.last4 : ""}${pm.accountType ? " ("+pm.accountType.toLowerCase()+")" : ""}`;
      const btn = button(label, baseBtnStyle(), () => {
        cleanupModal();
        showPreviewModal(pm);
      });
      list.appendChild(btn);
    });

    const newBtn = primaryButton("Use a New Account", async () => {
      cleanupModal();
      try { await prepareAndLaunchWithoutTokens(); }
      catch (e) { console.error("[ForteVault] New-account sign/launch failed:", e); }
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

    const useDifferentBtn = button("Use a Different Account", outlineBtnStyle(), async () => {
      cleanupModal();
      try { await prepareAndLaunchWithoutTokens(); }
      catch (e) { console.error("[ForteVault] Different-account sign/launch failed:", e); }
    });

    const confirmBtn = primaryButton("Confirm & Continue", async () => {
      try { await prepareAndLaunchWithTokens(pm.token); }
      catch (e) { console.error("[ForteVault] Token sign/launch failed:", e); }
    });

    actions.append(backBtn, useDifferentBtn, confirmBtn);
    appendToModal(modal, [title, details, actions]);
  }

  function showNoAccountModal() {
    const modal = createModal();
    const title = h2("No Saved Payment Methods");
    const text  = p("You’ll need to add a bank account before you can make a payment.");
    const addBtn = primaryButton("Add Payment Method", async () => {
      cleanupModal();
      try { await prepareAndLaunchWithoutTokens(); }
      catch (e) { console.error("[ForteVault] Add-new sign/launch failed:", e); }
    });
    appendToModal(modal, [title, text, addBtn]);
  }

  // ---------- DOM HELPERS ----------
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

}, 250);