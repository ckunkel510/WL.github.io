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

// --- form-aware getters ---
function getPaymentForm() {
  const btn = document.querySelector("#ctl00_PageBody_ForteMakePayment");
  return (btn && (btn.form || btn.closest("form"))) || document;
}



function formatAmount(val) {
  const num = Number(String(val).replace(/[^0-9.]/g, ""));
  if (Number.isFinite(num)) return num.toFixed(2);
  return "0.00";
}

// override old helper everywhere you used it
const getFromFieldOrAttr = getValueFromFormOrAttr;

// --- utc_time (unchanged from earlier suggestion) ---
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

// Ensure order_number exists; prefer existing hidden field, else generate one.
// Returns the order_number we will sign & submit.
function ensureOrderNumber() {
  const form = getPaymentForm();

  // 1) Existing hidden field?
  let input = form.querySelector('[name="order_number"]');
  if (input && input.value && String(input.value).trim() !== "") {
    return String(input.value).trim();
  }

  // 2) Try to derive from any page value you may have (optional hooks)
  // const fromInvoice = document.querySelector('#SomeInvoiceId');
  // if (fromInvoice?.textContent) candidate = fromInvoice.textContent.trim();

  // 3) Fallback: generate a unique, Forte-friendly id (alphanumeric, dashes/underscores are fine)
  const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0,14); // yyyymmddhhmmss
  const rand = Math.random().toString(36).slice(2,8).toUpperCase();
  const candidate = `WT-${ts}-${rand}`;

  // Create/overwrite hidden field so payload + signature use the same value
  if (!input) {
    input = document.createElement("input");
    input.type = "hidden";
    input.name = "order_number";
    form.appendChild(input);
  }
  input.value = candidate;

  // (Optional) also mirror on the button attribute for transparency
  const btn = document.querySelector("#ctl00_PageBody_ForteMakePayment");
  if (btn) btn.setAttribute("order_number", candidate);

  console.log("[ForteVault] Injected order_number:", candidate);
  return candidate;
}



  // .NET ticks: 0001-01-01 to now, in 100ns units
function getDotNetTicksNow() {
  // ms since Unix epoch + offset to 0001-01-01, then * 10,000 to get ticks
  const ms = Date.now();
  const EPOCH_OFFSET_MS = 62135596800000; // 1970-01-01 -> 0001-01-01
  const ticks = (ms + EPOCH_OFFSET_MS) * 10000;
  return String(Math.floor(ticks));
}

// Read utc_time from page (hidden input or button attr)
function getUtcTimeFromPage() {
  const input = document.querySelector('[name="utc_time"]');
  if (input && input.value) return input.value;
  const btn = document.querySelector("#ctl00_PageBody_ForteMakePayment");
  if (btn && btn.getAttribute("utc_time")) return btn.getAttribute("utc_time");
  return null;
}

// Ensure utc_time exists on page; if not, create it using .NET ticks
function ensureUtcTime() {
  let utc = getUtcTimeFromPage();
  if (!utc) {
    utc = getDotNetTicksNow();
    // write to both hidden input (if present) and button attr for consistency
    const btn = document.querySelector("#ctl00_PageBody_ForteMakePayment");
    const input = document.querySelector('[name="utc_time"]');
    if (input) input.value = utc;
    if (btn) btn.setAttribute("utc_time", utc);
    console.log("[ForteVault] Injected utc_time:", utc);
  }
  return utc;
}


  // ---------- SIGNATURE HELPERS ----------
  // ---------- SIGNATURE HELPERS ----------
async function signCheckout({
  method,
  version_number,
  total_amount,
  order_number,
  customer_token,
  paymethod_token,
  utc_time            // <-- accept utc_time
}) {
  // quick sanity logs
  console.log("[ForteVault] signCheckout →", {
    method, version_number, total_amount, order_number,
    hasCustomerToken: !!customer_token,
    hasPaymethodToken: !!paymethod_token,
    utc_time
  });

  if (!utc_time) {
    throw new Error("utc_time missing before signCheckout");
  }
  if (!total_amount || !order_number) {
    throw new Error("total_amount or order_number missing before signCheckout");
  }

  const resp = await fetch("https://wlmarketingdashboard.vercel.app/api/public/signCheckout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method,
      version_number,
      total_amount,
      order_number,
      customer_token,
      paymethod_token,
      utc_time       // <-- include utc_time in body
    })
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

  function getValueFromFormOrAttr(name, fallback = "") {
  const form = getPaymentForm();
  const input = form.querySelector(`[name="${name}"]`);
  if (input && input.value != null && String(input.value).trim() !== "") return String(input.value).trim();

  // try common fallbacks for amount/order number if hidden field isn't found
  if (name === "total_amount") {
    const txtAmt = document.querySelector('#ctl00_PageBody_PaymentAmountTextBox');
    if (txtAmt && txtAmt.value) return formatAmount(txtAmt.value);
    const anyAmt = document.querySelector('[id*="Amount"]');
    if (anyAmt && anyAmt.value) return formatAmount(anyAmt.value);
  }
  if (name === "order_number") {
    const ordHidden = document.querySelector('#ctl00_PageBody_OrderNumberHidden');
    if (ordHidden && ordHidden.value) return String(ordHidden.value).trim();
  }

  // check button attributes last
  const btn = document.querySelector("#ctl00_PageBody_ForteMakePayment");
  const attr = btn && btn.getAttribute(name);
  if (attr) return String(attr).trim();

  return fallback;
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
// WITH TOKENS
async function prepareAndLaunchWithTokens(paymethodToken) {
  let paymentBtn = document.querySelector("#ctl00_PageBody_ForteMakePayment");
  if (!paymentBtn) { console.warn("[ForteVault] Pay button not found."); return; }

  // tokens (same as you have)
  if (forteCustomerToken) paymentBtn.setAttribute("customer_token", forteCustomerToken);
  else paymentBtn.removeAttribute("customer_token");
  paymentBtn.setAttribute("paymethod_token", paymethodToken);
  paymentBtn.setAttribute("payment_token",  paymethodToken);
  paymentBtn.setAttribute("save_token", "false");
  setFieldOrAttr("customer_token", forteCustomerToken || "");
  setFieldOrAttr("paymethod_token", paymethodToken || "");
  setFieldOrAttr("payment_token",  paymethodToken || "");
  setFieldOrAttr("save_token", "false");

  const method         = paymentBtn.getAttribute("method")         || "sale";
  const version_number = paymentBtn.getAttribute("version_number") || "2.0";
  const total_amount   = getFromFieldOrAttr("total_amount");
  const order_number   = ensureOrderNumber(); 
  const utc_time_page  = ensureUtcTime();

  // guard: fail fast if missing
  if (!total_amount || total_amount === "0.00") { console.error("[ForteVault] total_amount missing/zero"); debugger; return; }
  if (!order_number) { console.error("[ForteVault] order_number missing"); debugger; return; }

  const { signature } = await signCheckout({
    method, version_number, total_amount, order_number,
    customer_token: forteCustomerToken || "",
    paymethod_token: paymethodToken || "",
    utc_time: utc_time_page
  });

  setFieldOrAttr("signature", signature);
  setFieldOrAttr("allowed_methods", "echeck");

  paymentBtn = replaceButtonNode(paymentBtn);
  console.log("[ForteVault] Button before click (WITH tokens):", paymentBtn.outerHTML);

  debugger;
  await new Promise(r => setTimeout(r, 3000));

  sessionStorage.setItem("skipVaultModal", "true");
  openDexOverlay();
}

// WITHOUT TOKENS
async function prepareAndLaunchWithoutTokens() {
  let paymentBtn = document.querySelector("#ctl00_PageBody_ForteMakePayment");
  if (!paymentBtn) { console.warn("[ForteVault] Pay button not found."); return; }

  paymentBtn.removeAttribute("customer_token");
  paymentBtn.removeAttribute("paymethod_token");
  paymentBtn.removeAttribute("payment_token");
  paymentBtn.setAttribute("save_token", "false");
  setFieldOrAttr("customer_token", "");
  setFieldOrAttr("paymethod_token", "");
  setFieldOrAttr("payment_token",  "");
  setFieldOrAttr("save_token", "false");

  const method         = paymentBtn.getAttribute("method")         || "sale";
  const version_number = paymentBtn.getAttribute("version_number") || "2.0";
  const total_amount   = getFromFieldOrAttr("total_amount");
  const order_number   = getFromFieldOrAttr("order_number");
  const utc_time_page  = ensureUtcTime();

  if (!total_amount || total_amount === "0.00") { console.error("[ForteVault] total_amount missing/zero"); debugger; return; }
  if (!order_number) { console.error("[ForteVault] order_number missing"); debugger; return; }

  const { signature } = await signCheckout({
    method, version_number, total_amount, order_number,
    customer_token: "",
    paymethod_token: "",
    utc_time: utc_time_page
  });

  setFieldOrAttr("signature", signature);
  setFieldOrAttr("allowed_methods", "echeck");

  paymentBtn = replaceButtonNode(paymentBtn);
  console.log("[ForteVault] Button before click (NO tokens):", paymentBtn.outerHTML);

  debugger;
  await new Promise(r => setTimeout(r, 3000));

  sessionStorage.setItem("skipVaultModal", "true");
  openDexOverlay();
}



// ---------- BUTTON PREP (WITHOUT TOKENS) ----------
async function prepareAndLaunchWithoutTokens() {
  let paymentBtn = document.querySelector("#ctl00_PageBody_ForteMakePayment");
  if (!paymentBtn) { console.warn("[ForteVault] Pay button not found."); return; }

  // ... (clear tokens exactly as you have)

  const method         = paymentBtn.getAttribute("method")         || "sale";
  const version_number = paymentBtn.getAttribute("version_number") || "2.0";
  const total_amount   = getFromFieldOrAttr("total_amount", "0.00");
  const order_number   = ensureOrderNumber(); 
  const utc_time_page  = ensureUtcTime(); // <-- NEW

  const { signature } = await signCheckout({
    method, version_number, total_amount, order_number,
    customer_token: "",
    paymethod_token: "",
    utc_time: utc_time_page
  });

  setFieldOrAttr("signature", signature);
  setFieldOrAttr("allowed_methods", "echeck");

  paymentBtn = replaceButtonNode(paymentBtn);
  console.log("[ForteVault] Button before click (NO tokens):", paymentBtn.outerHTML);

  debugger;
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