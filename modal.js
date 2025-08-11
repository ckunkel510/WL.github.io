
(function () {
  // ---------- CONFIG ----------
  const GET_VAULT_URL = "https://wlmarketingdashboard.vercel.app/api/public/getVaultedAccounts";
  const SIGN_URL      = "https://wlmarketingdashboard.vercel.app/api/public/signCheckout";

  // ---------- STATE ----------
  const userID = localStorage.getItem("wl_user_id");
  let vaultedAccounts = [];
  window.forteCustomerToken = null; // exposed so submit signer can use it

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
    window.forteCustomerToken = data.customerToken || null;
    vaultedAccounts = Array.isArray(data.paymentMethods) ? data.paymentMethods : [];
    attachPaymentIntercept(); // modal to pick saved method / add new
    attachSubmitSigner();     // sign with final values right before post
  })
  .catch(err => console.error("[ForteVault] fetch error:", err));

  // ---------- DOM / FORM HELPERS ----------
  function getPaymentBtn() {
    return document.querySelector("#ctl00_PageBody_ForteMakePayment");
  }
  function getPaymentForm() {
    const btn = getPaymentBtn();
    return (btn && (btn.form || btn.closest("form"))) || document.forms[0] || document;
  }
  function setFieldOrAttr(name, value) {
    const form = getPaymentForm();
    let input = form.querySelector(`[name="${name}"]`);
    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      form.appendChild(input);
    }
    input.value = value;
    const btn = getPaymentBtn();
    if (btn) btn.setAttribute(name, value);
  }
  function replaceButtonNode(btn) {
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
    return getPaymentBtn();
  }

  // amount / order / utc_time
  function formatAmount(val) {
    const num = Number(String(val).replace(/[^0-9.]/g, ""));
    if (Number.isFinite(num)) return num.toFixed(2);
    return "0.00";
  }
  function readPaymentAmountFromPage() {
    const el = document.querySelector('#ctl00_PageBody_PaymentAmountTextBox')
            || document.querySelector('[name="ctl00$PageBody$PaymentAmountTextBox"]');
    if (!el) return null;
    const raw = String(el.value || "").trim();
    if (!raw) return null;
    return formatAmount(raw);
  }
  function ensureTotalAmount() {
    const form = getPaymentForm();
    let amount = readPaymentAmountFromPage();
    if (!amount) {
      const hidden = form.querySelector('[name="total_amount"]');
      if (hidden && hidden.value) amount = String(hidden.value).trim();
    }
    if (!amount) amount = "0.00";
    setFieldOrAttr("total_amount", amount);
    return amount;
  }
  function ensureOrderNumber() {
    const form = getPaymentForm();
    let input = form.querySelector('[name="order_number"]');
    if (input && input.value && String(input.value).trim() !== "") {
      setFieldOrAttr("order_number", String(input.value).trim());
      return String(input.value).trim();
    }
    const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0,14); // yyyymmddhhmmss
    const rand = Math.random().toString(36).slice(2,8).toUpperCase();
    const candidate = `WT-${ts}-${rand}`;
    setFieldOrAttr("order_number", candidate);
    console.log("[ForteVault] Injected order_number:", candidate);
    return candidate;
  }
  function getDotNetTicksNow() {
    const EPOCH_OFFSET_MS = 62135596800000;
    return String(Math.floor((Date.now() + EPOCH_OFFSET_MS) * 10000));
  }
  function ensureUtcTime() {
    const form = getPaymentForm();
    let input = form.querySelector('[name="utc_time"]');
    let utc = input && input.value ? String(input.value).trim() : null;
    if (!utc) {
      utc = getDotNetTicksNow();
      setFieldOrAttr("utc_time", utc);
      console.log("[ForteVault] Injected utc_time:", utc);
    }
    return utc;
  }

  // ---------- SIGNATURE API ----------
  async function signCheckout({ method, version_number, total_amount, order_number, customer_token, paymethod_token, utc_time }) {
    if (!utc_time) throw new Error("utc_time missing before signCheckout");
    if (!total_amount || !order_number) throw new Error("total_amount or order_number missing before signCheckout");

    const resp = await fetch(SIGN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, version_number, total_amount, order_number, customer_token, paymethod_token, utc_time })
    });
    if (!resp.ok) throw new Error(`signCheckout HTTP ${resp.status}`);
    const data = await resp.json();
    if (!data.signature || !data.utc_time) throw new Error("signCheckout: missing signature/utc_time");
    return data; // { signature, utc_time }
  }

  // ---------- OPEN CHECKOUT / DEX ----------
  function openDexOverlay() {
    // Select “Check” if present to match allowed_methods
    const checkRadio = document.querySelector("#ctl00_PageBody_rbPayByCheck");
    if (checkRadio) { checkRadio.checked = true; checkRadio.click(); }

    // Click the original button to trigger Forte’s own overlay loader
    setTimeout(() => {
      let paymentButton = getPaymentBtn();
      if (paymentButton) {
        console.log("[ForteVault] Opening DEX overlay…");
        paymentButton.click();
      } else {
        console.warn("[ForteVault] Make Payment button not found at launch time.");
      }
    }, 150);
  }

  // ---------- INTERCEPT "MAKE PAYMENT" (show our modal) ----------
  function attachPaymentIntercept() {
    const paymentBtn = getPaymentBtn();
    if (!paymentBtn) { console.warn("[ForteVault] Make Payment button not found."); return; }

    paymentBtn.addEventListener("click", function (e) {
      const skipVault = sessionStorage.getItem("skipVaultModal");
      if (skipVault === "true") {
        sessionStorage.removeItem("skipVaultModal");
        console.log("[ForteVault] Skipping vault modal — proceed to DEX.");
        return; // allow Forte to proceed
      }

      e.preventDefault();

      if (vaultedAccounts.length > 0) {
        showVaultListModal(vaultedAccounts);
      } else {
        showNoAccountModal();
      }
    });
  }

  // ---------- SUBMIT-TIME SIGNER (final values) ----------
  function attachSubmitSigner() {
    const btn  = getPaymentBtn();
    const form = btn && (btn.form || btn.closest("form"));
    if (!form) { console.warn("[ForteVault] Payment form not found for submit signing."); return; }

    form.addEventListener("submit", async function onSubmit(e) {
      if (sessionStorage.getItem("fv_signed_once") === "1") {
        sessionStorage.removeItem("fv_signed_once");
        return; // already signed; let it submit
      }

      e.preventDefault();

      try {
        const method         = btn.getAttribute("method") || "sale";
        const version_number = btn.getAttribute("version_number") || "2.0";

        // ensure these are exactly what the form will post
        const total_amount = ensureTotalAmount();
        const order_number = ensureOrderNumber();
        const utc_time     = ensureUtcTime();

        // ensure tokens mirrored into form + button (if user picked a saved method)
        const paymethodToken = sessionStorage.getItem("selectedPaymethodToken");
        if (paymethodToken && window.forteCustomerToken) {
          setFieldOrAttr("customer_token", window.forteCustomerToken);
          setFieldOrAttr("paymethod_token", paymethodToken);
          setFieldOrAttr("payment_token",  paymethodToken);
          btn.setAttribute("customer_token", window.forteCustomerToken);
          btn.setAttribute("paymethod_token", paymethodToken);
          btn.setAttribute("payment_token",  paymethodToken);
        } else {
          // clear if not using saved method
          setFieldOrAttr("customer_token", "");
          setFieldOrAttr("paymethod_token", "");
          setFieldOrAttr("payment_token",  "");
          btn.removeAttribute("customer_token");
          btn.removeAttribute("paymethod_token");
          btn.removeAttribute("payment_token");
        }

        // re-sign with the final strings
        const { signature } = await signCheckout({
          method, version_number, total_amount, order_number,
          customer_token: window.forteCustomerToken || "",
          paymethod_token: paymethodToken || "",
          utc_time
        });

        setFieldOrAttr("signature", signature);
        setFieldOrAttr("allowed_methods", "echeck");

        // avoid loop and submit for real
        sessionStorage.setItem("fv_signed_once", "1");
        form.submit();

      } catch (err) {
        console.error("[ForteVault] Submit signer failed:", err);
        sessionStorage.setItem("fv_signed_once", "1");
        form.submit(); // fail-open to avoid blocking checkout
      }
    }, true); // capture so we beat other handlers
  }

  // ---------- FLOWS (WITH / WITHOUT TOKENS) ----------
  async function prepareAndLaunchWithTokens(paymethodToken) {
    let btn = getPaymentBtn();
    if (!btn) { console.warn("[ForteVault] Pay button not found."); return; }

    // tokens on button + hidden inputs
    if (window.forteCustomerToken) {
      btn.setAttribute("customer_token", window.forteCustomerToken);
    } else {
      btn.removeAttribute("customer_token");
      console.warn("[ForteVault] No forteCustomerToken — overlay may not preselect.");
    }
    btn.setAttribute("paymethod_token", paymethodToken);
    btn.setAttribute("payment_token",  paymethodToken);
    btn.setAttribute("save_token", "false");
    setFieldOrAttr("customer_token", window.forteCustomerToken || "");
    setFieldOrAttr("paymethod_token", paymethodToken || "");
    setFieldOrAttr("payment_token",  paymethodToken || "");
    setFieldOrAttr("save_token", "false");

    // ensure amount/order/time exist before launch (submit signer will re-check)
    ensureTotalAmount();
    ensureOrderNumber();
    ensureUtcTime();

    // Replace node so Forte re-reads fresh attrs
    btn = replaceButtonNode(btn);

    // Bypass our intercept once and open overlay
    sessionStorage.setItem("skipVaultModal", "true");
    openDexOverlay();
  }

  async function prepareAndLaunchWithoutTokens() {
    let btn = getPaymentBtn();
    if (!btn) { console.warn("[ForteVault] Pay button not found."); return; }

    // clear tokens; keep save_token false
    btn.removeAttribute("customer_token");
    btn.removeAttribute("paymethod_token");
    btn.removeAttribute("payment_token");
    btn.setAttribute("save_token", "false");
    setFieldOrAttr("customer_token", "");
    setFieldOrAttr("paymethod_token", "");
    setFieldOrAttr("payment_token",  "");
    setFieldOrAttr("save_token", "false");

    ensureTotalAmount();
    ensureOrderNumber();
    ensureUtcTime();

    btn = replaceButtonNode(btn);

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
      const selBtn = button(label, baseBtnStyle(), () => {
        cleanupModal();
        showPreviewModal(pm);
      });
      list.appendChild(selBtn);
    });

    const newBtn = primaryButton("Use a New Account", async () => {
      cleanupModal();
      sessionStorage.removeItem("selectedPaymethodToken");
      try { await prepareAndLaunchWithoutTokens(); } catch(e) { console.error(e); }
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
      sessionStorage.removeItem("selectedPaymethodToken");
      try { await prepareAndLaunchWithoutTokens(); } catch(e) { console.error(e); }
    });

    const confirmBtn = primaryButton("Confirm & Continue", async () => {
      try {
        sessionStorage.setItem("selectedPaymethodToken", pm.token);
        await prepareAndLaunchWithTokens(pm.token);
      } catch (e) {
        console.error("[ForteVault] Token flow failed:", e);
      }
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
      sessionStorage.removeItem("selectedPaymethodToken");
      try { await prepareAndLaunchWithoutTokens(); } catch(e) { console.error(e); }
    });
    appendToModal(modal, [title, text, addBtn]);
  }

  // ---------- UI HELPERS ----------
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

