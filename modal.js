
(function () {
  // ---------- CONFIG ----------
  const GET_VAULT_URL = "https://wlmarketingdashboard.vercel.app/api/public/getVaultedAccounts";
  const SIGN_URL      = "https://wlmarketingdashboard.vercel.app/api/public/signCheckout";

  // ---------- STATE ----------
  const userID = localStorage.getItem("wl_user_id");
  let vaultedAccounts = [];
  window.forteCustomerToken = null; // expose for submit signer

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
    window.forteCustomerToken = data.customerToken || null;
    vaultedAccounts = Array.isArray(data.paymentMethods) ? data.paymentMethods : [];
    attachPaymentIntercept();
    attachSubmitSigner(); // <-- sign using FINAL values at submit time
  })
  .catch(err => console.error("[ForteVault] fetch error:", err));

  // ---------- FORM/DOM HELPERS ----------
  function getPaymentForm() {
    const btn = document.querySelector("#ctl00_PageBody_ForteMakePayment");
    return (btn && (btn.form || btn.closest("form"))) || document;
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
    const paymentBtn = document.querySelector("#ctl00_PageBody_ForteMakePayment");
    if (paymentBtn) paymentBtn.setAttribute(name, value);
  }
  function getValueFromFormOrAttr(name, fallback = "") {
    const form = getPaymentForm();
    const input = form.querySelector(`[name="${name}"]`);
    if (input && input.value != null && String(input.value).trim() !== "") return String(input.value).trim();
    const btn = document.querySelector("#ctl00_PageBody_ForteMakePayment");
    const attr = btn && btn.getAttribute(name);
    if (attr) return String(attr).trim();
    return fallback;
  }
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
    const num = Number(raw.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(num)) return null;
    return num.toFixed(2);
  }
  function ensureTotalAmount() {
    const form = getPaymentForm();
    let amount = readPaymentAmountFromPage();
    if (!amount) {
      const hidden = form.querySelector('[name="total_amount"]');
      if (hidden && hidden.value) amount = String(hidden.value).trim();
    }
    if (!amount) amount = "0.00";
    let hidden = form.querySelector('[name="total_amount"]');
    if (!hidden) {
      hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.name = "total_amount";
      form.appendChild(hidden);
    }
    hidden.value = amount;
    return amount;
  }
  function ensureOrderNumber() {
    const form = getPaymentForm();
    let input = form.querySelector('[name="order_number"]');
    if (input && input.value && String(input.value).trim() !== "") {
      return String(input.value).trim();
    }
    const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0,14); // yyyymmddhhmmss
    const rand = Math.random().toString(36).slice(2,8).toUpperCase();
    const candidate = `WT-${ts}-${rand}`;
    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.name = "order_number";
      form.appendChild(input);
    }
    input.value = candidate;
    const btn = document.querySelector("#ctl00_PageBody_ForteMakePayment");
    if (btn) btn.setAttribute("order_number", candidate);
    console.log("[ForteVault] Injected order_number:", candidate);
    return candidate;
  }
  function getDotNetTicksNow() {
    const EPOCH_OFFSET_MS = 62135596800000;
    return String(Math.floor((Date.now() + EPOCH_OFFSET_MS) * 10000));
  }
  function getUtcTimeFromPage() {
    const form = getPaymentForm();
    const input = form.querySelector('[name="utc_time"]');
    if (input && input.value) return input.value;
    const btn = document.querySelector("#ctl00_PageBody_ForteMakePayment");
    if (btn && btn.getAttribute("utc_time")) return btn.getAttribute("utc_time");
    return null;
  }
  function ensureUtcTime() {
    let utc = getUtcTimeFromPage();
    if (!utc) {
      utc = getDotNetTicksNow();
      const form = getPaymentForm();
      let input = form.querySelector('[name="utc_time"]');
      if (!input) {
        input = document.createElement("input");
        input.type = "hidden";
        input.name = "utc_time";
        form.appendChild(input);
      }
      input.value = utc;
      const btn = document.querySelector("#ctl00_PageBody_ForteMakePayment");
      if (btn) btn.setAttribute("utc_time", utc);
      console.log("[ForteVault] Injected utc_time:", utc);
    }
    return utc;
  }

  // ---------- SIGNATURE HELPERS ----------
  async function signCheckout({
    method,
    version_number,
    total_amount,
    order_number,
    customer_token,
    paymethod_token,
    utc_time
  }) {
    console.log("[ForteVault] signCheckout →", {
      method, version_number, total_amount, order_number,
      hasCustomerToken: !!customer_token,
      hasPaymethodToken: !!paymethod_token,
      utc_time
    });
    if (!utc_time)   throw new Error("utc_time missing before signCheckout");
    if (!total_amount || !order_number) throw new Error("total_amount or order_number missing before signCheckout");

    const resp = await fetch(SIGN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method, version_number, total_amount, order_number,
        customer_token, paymethod_token, utc_time
      })
    });
    if (!resp.ok) throw new Error(`signCheckout HTTP ${resp.status}`);
    const data = await resp.json();
    if (!data.signature || !data.utc_time) throw new Error("signCheckout: missing signature/utc_time");
    return data; // { signature, utc_time }
  }

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

  // ---------- INTERCEPT "MAKE PAYMENT" (VAULT MODAL) ----------
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

  // ---------- SUBMIT-TIME SIGNER (FINAL VALUES) ----------
  function attachSubmitSigner() {
    const btn  = document.querySelector("#ctl00_PageBody_ForteMakePayment");
    const form = (btn && (btn.form || btn.closest("form")));
    if (!form) { console.warn("[ForteVault] Payment form not found for submit signing."); return; }

    form.addEventListener("submit", async function onSubmit(e) {
      if (sessionStorage.getItem("fv_signed_once") === "1") {
        sessionStorage.removeItem("fv_signed_once");
        return; // already signed; allow submit
      }

      e.preventDefault();

      try {
        const method         = btn.getAttribute("method") || "sale";
        const version_number = btn.getAttribute("version_number") || "2.0";

        // ensure these are present as the form will actually post them
        const total_amount = ensureTotalAmount();   // sync from visible amount box
        const order_number = ensureOrderNumber();   // generate if missing
        const utc_time     = ensureUtcTime();       // generate if missing

        // if we have a selected token, mirror into hidden fields + attrs
        const paymethodToken = sessionStorage.getItem("selectedPaymethodToken");
        if (paymethodToken && window.forteCustomerToken) {
          setFieldOrAttr("customer_token", window.forteCustomerToken);
          setFieldOrAttr("paymethod_token", paymethodToken);
          setFieldOrAttr("payment_token",  paymethodToken);
          btn.setAttribute("customer_token", window.forteCustomerToken);
          btn.setAttribute("paymethod_token", paymethodToken);
          btn.setAttribute("payment_token",  paymethodToken);
        }

        // sign with the exact strings that will be posted
        const { signature } = await signCheckout({
          method, version_number, total_amount, order_number,
          customer_token: window.forteCustomerToken || "",
          paymethod_token: paymethodToken || "",
          utc_time
        });

        setFieldOrAttr("signature", signature);

        // avoid loop and submit for real
        sessionStorage.setItem("fv_signed_once", "1");
        form.submit();

      } catch (err) {
        console.error("[ForteVault] Submit signer failed:", err);
        sessionStorage.setItem("fv_signed_once", "1");
        form.submit(); // fallback: let it go (may open blank overlay)
      }
    }, true); // capture to run before other handlers
  }

  // ---------- BUTTON PREP (WITH TOKENS) ----------
  async function prepareAndLaunchWithTokens(paymethodToken) {
    let paymentBtn = document.querySelector("#ctl00_PageBody_ForteMakePayment");
    if (!paymentBtn) { console.warn("[ForteVault] Pay button not found."); return; }

    // Put tokens on the button + hidden inputs
    if (window.forteCustomerToken) {
      paymentBtn.setAttribute("customer_token", window.forteCustomerToken);
    } else {
      paymentBtn.removeAttribute("customer_token");
      console.warn("[ForteVault] No forteCustomerToken — overlay may not preselect.");
    }
    paymentBtn.setAttribute("paymethod_token", paymethodToken);
    paymentBtn.setAttribute("payment_token",  paymethodToken);
    paymentBtn.setAttribute("save_token", "false");
    setFieldOrAttr("customer_token", window.forteCustomerToken || "");
    setFieldOrAttr("paymethod_token", paymethodToken || "");
    setFieldOrAttr("payment_token",  paymethodToken || "");
    setFieldOrAttr("save_token", "false");

    // Ensure amount/order/time exist before user proceeds
    ensureTotalAmount();
    ensureOrderNumber();
    ensureUtcTime();

    // Replace node to force re-bind
    paymentBtn = replaceButtonNode(paymentBtn);

    console.log("[ForteVault] Button before click (WITH tokens):", paymentBtn.outerHTML);

    debugger; // pause to inspect
    await new Promise(r => setTimeout(r, 1500));

    sessionStorage.setItem("skipVaultModal", "true");
    openDexOverlay();
  }

  // ---------- BUTTON PREP (WITHOUT TOKENS) ----------
  async function prepareAndLaunchWithoutTokens() {
    let paymentBtn = document.querySelector("#ctl00_PageBody_ForteMakePayment");
    if (!paymentBtn) { console.warn("[ForteVault] Pay button not found."); return; }

    // Clear tokens
    paymentBtn.removeAttribute("customer_token");
    paymentBtn.removeAttribute("paymethod_token");
    paymentBtn.removeAttribute("payment_token");
    paymentBtn.setAttribute("save_token", "false");
    setFieldOrAttr("customer_token", "");
    setFieldOrAttr("paymethod_token", "");
    setFieldOrAttr("payment_token",  "");
    setFieldOrAttr("save_token", "false");

    // Ensure amount/order/time exist
    ensureTotalAmount();
    ensureOrderNumber();
    ensureUtcTime();

    // Replace node to ensure fresh attributes are read
    paymentBtn = replaceButtonNode(paymentBtn);

    console.log("[ForteVault] Button before click (NO tokens):", paymentBtn.outerHTML);

    debugger; // pause to inspect
    await new Promise(r => setTimeout(r, 1500));

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
      catch (e) { console.error("[ForteVault] New-account flow failed:", e); }
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
      catch (e) { console.error("[ForteVault] Different-account flow failed:", e); }
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
      try { await prepareAndLaunchWithoutTokens(); }
      catch (e) { console.error("[ForteVault] Add-new flow failed:", e); }
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

