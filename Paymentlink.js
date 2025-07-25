document.addEventListener("DOMContentLoaded", function () {
  const urlParams = new URLSearchParams(window.location.search);
  const isCCVerify = urlParams.get("utm") === "ccverify";

  if (!isCCVerify) return; // Do nothing unless this is a credit card verification link

  // Hide unnecessary elements
  const paymentDiv = document.getElementById("ctl00_PageBody_PaymentProviderSelectionDiv");
  if (paymentDiv) paymentDiv.style.display = "none";

  const billingLabel = document.querySelector('label[for="CreBillingAddress"]');
  if (billingLabel) billingLabel.style.display = "none";

  const zipLabel = document.querySelector('label[for="CrePostalCode"]');
  if (zipLabel) zipLabel.style.display = "none";

  const btn = document.querySelector('button[onclick="requestToken()"]');
  if (btn) btn.disabled = true;

  checkTokenExpiration();
  insertCustomFields();

  const zipInput = document.getElementById("ctl00_PageBody_CrePostalCode");
  if (zipInput) zipInput.addEventListener("blur", checkAddressMatch);
});

(function () {
  const RECAPTCHA_SITE_KEY = "6Lfn5IcrAAAAAMxSoB_0zPc-a41_vBNs5QcAg7RN";
  const IPINFO_TOKEN = "169fa3f70bafa2";
  const LOGGING_URL = "https://script.google.com/macros/s/AKfycbxF-OhAy_JK635XpjDuaVAkFROyF2vWq2WjEF_qTp2rkyXPLU2AW3eYKfsK7RSj3PlTuQ/exec";

  let captchaVerified = false;
  let zipMatch = false;
  let tokenValid = false;
  let signaturePad;

  function normalizeAddress(addr) {
    if (!addr) return "";
    return addr.toLowerCase()
      .replace(/\./g, "").replace(/,/g, "").replace(/-/g, " ")
      .replace(/\bcr\b/g, "county road").replace(/\bc\.r\b/g, "county road")
      .replace(/\bst\b/g, "street").replace(/\brd\b/g, "road")
      .replace(/\bdr\b/g, "drive").replace(/\bln\b/g, "lane")
      .replace(/\bblvd\b/g, "boulevard").replace(/\bave\b/g, "avenue")
      .replace(/\bsuite\b/g, "ste").replace(/\bapt\b/g, "apartment")
      .replace(/\s+/g, " ").trim();
  }

  function insertCustomFields() {
  const btn = document.querySelector('button[onclick="requestToken()"]');
  if (!btn) return;

  const parent = btn.parentNode;
  const wrapper = document.createElement("div");
  wrapper.style = `
    margin-bottom: 12px;
    padding: 16px;
    border: 1px solid #ccc;
    border-radius: 8px;
    background: #fdfdfd;
    box-shadow: 0 1px 4px rgba(0,0,0,0.1);
    font-family: sans-serif;
  `;

  wrapper.appendChild(createLabeledInput("Cardholder Name:", "CardholderName", "Enter name as it appears on the card"));
  addFieldRef(wrapper, "ctl00_PageBody_CreBillingAddress", "Billing Address:");
  addFieldRef(wrapper, "ctl00_PageBody_CrePostalCode", "ZIP Code:");

  // Upload ID
  const idLabel = document.createElement("label");
  idLabel.textContent = "Upload Photo ID:";
  const idInput = document.createElement("input");
  idInput.id = "IDUpload";
  idInput.type = "file";
  idInput.accept = "image/*";
  idInput.style = "display:block;margin-bottom:12px;padding:4px;";
  wrapper.appendChild(idLabel);
  wrapper.appendChild(idInput);

  // Legal disclaimer before signature
  const legalNote = document.createElement("p");
  legalNote.style = "font-size: 0.9em; font-style: italic; color: #444; margin-bottom: 8px;";
  legalNote.textContent =
    "By signing below, I authorize the use of the above card for this order and confirm that I am an authorized user. I understand that this constitutes a legal signature for payment and approval of the transaction.";
  wrapper.appendChild(legalNote);

  // Signature Pad
  const sigLabel = document.createElement("label");
  sigLabel.textContent = "Digital Signature:";
  const canvas = document.createElement("canvas");
  canvas.id = "SignaturePad";
  canvas.width = 300;
  canvas.height = 150;
  canvas.style = "border:1px solid #aaa;display:block;margin-bottom:6px;border-radius:4px;";
  const clearBtn = document.createElement("button");
  clearBtn.textContent = "Clear Signature";
  clearBtn.type = "button";
  clearBtn.style = "margin-bottom:12px;";
  clearBtn.onclick = () => signaturePad?.clear();
  wrapper.appendChild(sigLabel);
  wrapper.appendChild(canvas);
  wrapper.appendChild(clearBtn);

  // Fraud warning
  const warning = document.createElement("p");
  warning.style = "color:#a00;font-weight:bold;font-size:0.9em;margin-bottom:10px;";
  warning.textContent = "WARNING: Providing false or unauthorized payment info may result in account termination and referral for prosecution.";
  wrapper.appendChild(warning);

  // reCAPTCHA
  const recaptcha = document.createElement("div");
  recaptcha.id = "recaptcha-container";
  recaptcha.className = "g-recaptcha";
  recaptcha.setAttribute("data-sitekey", RECAPTCHA_SITE_KEY);
  recaptcha.setAttribute("data-callback", "onCaptchaSuccess");
  recaptcha.setAttribute("data-expired-callback", "onCaptchaExpired");
  recaptcha.setAttribute("data-error-callback", "onCaptchaFailed");
  wrapper.appendChild(recaptcha);

  parent.insertBefore(wrapper, btn);

  const sigScript = document.createElement("script");
  sigScript.src = "https://cdn.jsdelivr.net/npm/signature_pad@4.1.5/dist/signature_pad.umd.min.js";
  sigScript.onload = () => {
    signaturePad = new SignaturePad(canvas, {
      penColor: "black",
      backgroundColor: "white"
    });
  };
  document.body.appendChild(sigScript);

  const recaptchaScript = document.createElement("script");
  recaptchaScript.src = "https://www.google.com/recaptcha/api.js";
  recaptchaScript.async = true;
  recaptchaScript.defer = true;
  document.body.appendChild(recaptchaScript);
}


  function createLabeledInput(labelText, id, placeholder = "") {
    const label = document.createElement("label");
    label.textContent = labelText;
    const input = document.createElement("input");
    input.id = id;
    input.placeholder = placeholder;
    input.style = "display:block;width:100%;margin-bottom:8px";
    const container = document.createElement("div");
    container.appendChild(label);
    container.appendChild(input);
    return container;
  }

  function addFieldRef(wrapper, existingId, labelText) {
    const field = document.getElementById(existingId);
    if (field) {
      const label = document.createElement("label");
      label.textContent = labelText;
      label.style = "margin-top:8px;display:block";
      wrapper.appendChild(label);
      wrapper.appendChild(field);
    }
  }

  function validateAllChecks() {
    const btn = document.querySelector('button[onclick="requestToken()"]');
    const sigOk = signaturePad && !signaturePad.isEmpty();
    const idUploaded = document.getElementById("IDUpload")?.files?.length > 0;
    const cardholderFilled = document.getElementById("CardholderName")?.value?.trim()?.length > 2;
    const ready = captchaVerified && zipMatch && tokenValid && sigOk && idUploaded && cardholderFilled;
    if (btn) btn.disabled = !ready;
    console.log("Validation:", { captchaVerified, zipMatch, tokenValid, sigOk, idUploaded, cardholderFilled });
  }

  async function checkAddressMatch() {
  const billingZip = document.getElementById("ctl00_PageBody_CrePostalCode")?.value?.trim()?.slice(0, 5);
  const params = new URLSearchParams(window.location.search);
  const deliveryZip = params.get("deliveryzip")?.trim()?.slice(0, 5);

  zipMatch = billingZip === deliveryZip;

  if (!zipMatch) {
    try {
      const res = await fetch(`https://ipinfo.io/json?token=${IPINFO_TOKEN}`);
      const data = await res.json();
      const ipZip = data.postal?.trim()?.slice(0, 5);
      zipMatch = billingZip === ipZip;
    } catch {}
  }

  validateAllChecks();
}


  function checkTokenExpiration() {
    const tsParam = new URLSearchParams(window.location.search).get("ts");
    const now = new Date();
    const tsDate = new Date(tsParam);
    tokenValid = tsDate.toString() !== "Invalid Date" && now <= tsDate;
    validateAllChecks();
  }

  async function logPaymentData() {
    const billingAddress = document.getElementById("ctl00_PageBody_CreBillingAddress")?.value?.trim() || "";
    const billingZip = document.getElementById("ctl00_PageBody_CrePostalCode")?.value?.trim() || "";
    const orderText = document.querySelector(".PaymentTotalPanel")?.textContent || "";
    const pageUrl = window.location.href;
    const params = new URLSearchParams(window.location.search);
    const deliveryZip = params.get("deliveryzip") || "";
    const deliveryStreet = params.get("deliverystreet") || "";
    const cardholderName = document.getElementById("CardholderName")?.value?.trim() || "";
    const signatureDataURL = signaturePad?.isEmpty() ? "" : signaturePad.toDataURL();
    let idBase64 = "";
    const idFile = document.getElementById("IDUpload")?.files?.[0];
    if (idFile) {
      const buffer = await idFile.arrayBuffer();
      idBase64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    }

    await fetch(LOGGING_URL, {
      method: "POST",
      body: new URLSearchParams({
        billingAddress,
        billingZip,
        cardholderName,
        orderMatch: orderText,
        pageUrl,
        deliveryZip,
        deliveryStreet,
        signatureDataURL,
        idBase64,
        timestamp: new Date().toISOString()
      })
    });
  }

  const originalRequestToken = window.requestToken;
  window.requestToken = function () {
    logPaymentData().then(() => {
      if (typeof originalRequestToken === "function") {
        originalRequestToken();
      }
    });
  };

  window.onCaptchaSuccess = () => { captchaVerified = true; validateAllChecks(); };
  window.onCaptchaExpired = () => { captchaVerified = false; validateAllChecks(); };
  window.onCaptchaFailed = () => { captchaVerified = false; validateAllChecks(); };

  document.addEventListener("DOMContentLoaded", function () {
    const btn = document.querySelector('button[onclick="requestToken()"]');
    if (btn) btn.disabled = true;
    checkTokenExpiration();
    insertCustomFields();

    const zipInput = document.getElementById("ctl00_PageBody_CrePostalCode");
    if (zipInput) zipInput.addEventListener("blur", checkAddressMatch);
  });
})();
