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
    return addr
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/,/g, "")
      .replace(/-/g, " ")
      .replace(/\bcr\b/g, "county road")
      .replace(/\bc\.r\b/g, "county road")
      .replace(/\bst\b/g, "street")
      .replace(/\brd\b/g, "road")
      .replace(/\bdr\b/g, "drive")
      .replace(/\bln\b/g, "lane")
      .replace(/\bblvd\b/g, "boulevard")
      .replace(/\bave\b/g, "avenue")
      .replace(/\bsuite\b/g, "ste")
      .replace(/\bapt\b/g, "apartment")
      .replace(/\s+/g, " ")
      .trim();
  }

  function buildFormElements() {
    const container = document.querySelector("#ctl00_PageBody_CrePostalCode").closest(".container.narrow-panel");
    if (!container) return;

    // Clear recaptcha container to move to bottom
    const oldRecaptcha = document.getElementById("recaptcha-container");
    if (oldRecaptcha) oldRecaptcha.remove();

    const cardholderLabel = document.createElement("label");
    cardholderLabel.textContent = "Cardholder Name:";
    const cardholderInput = document.createElement("input");
    cardholderInput.id = "CardholderName";
    cardholderInput.placeholder = "Enter name as it appears on the card";
    cardholderInput.style = "display:block;width:100%;margin-bottom:6px";

    const billingAddressGroup = document.getElementById("ctl00_PageBody_CreBillingAddress").closest(".form-group");
    const billingZipGroup = document.getElementById("ctl00_PageBody_CrePostalCode").closest(".form-group");

    const idLabel = document.createElement("label");
    idLabel.textContent = "Upload Photo ID:";
    const idInput = document.createElement("input");
    idInput.id = "IDUpload";
    idInput.type = "file";
    idInput.accept = "image/*";
    idInput.style = "display:block;margin-bottom:6px";

    const sigLabel = document.createElement("label");
    sigLabel.textContent = "Digital Signature (By signing, you certify this order is legitimate and subject to legal action if not):";
    const canvas = document.createElement("canvas");
    canvas.id = "SignaturePad";
    canvas.width = 300;
    canvas.height = 150;
    canvas.style = "border:1px solid #ccc;display:block;margin-bottom:6px";

    const clearBtn = document.createElement("button");
    clearBtn.textContent = "Clear Signature";
    clearBtn.type = "button";
    clearBtn.onclick = () => signaturePad?.clear();

    const recaptchaContainer = document.createElement("div");
    recaptchaContainer.id = "recaptcha-container";
    recaptchaContainer.className = "g-recaptcha";
    recaptchaContainer.setAttribute("data-sitekey", RECAPTCHA_SITE_KEY);
    recaptchaContainer.setAttribute("data-callback", "onCaptchaSuccess");
    recaptchaContainer.setAttribute("data-expired-callback", "onCaptchaExpired");
    recaptchaContainer.setAttribute("data-error-callback", "onCaptchaFailed");

    // Insert all in order
    container.insertBefore(cardholderLabel, billingAddressGroup);
    container.insertBefore(cardholderInput, billingAddressGroup);
    container.appendChild(idLabel);
    container.appendChild(idInput);
    container.appendChild(sigLabel);
    container.appendChild(canvas);
    container.appendChild(clearBtn);
    container.appendChild(recaptchaContainer);

    const script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    const sigScript = document.createElement("script");
    sigScript.src = "https://cdn.jsdelivr.net/npm/signature_pad@4.1.5/dist/signature_pad.umd.min.js";
    sigScript.onload = () => {
      signaturePad = new SignaturePad(canvas, {
        penColor: "black",
        backgroundColor: "white"
      });
    };
    document.body.appendChild(sigScript);
  }

  // Leave rest of fraud logic as-is from previous file

  document.addEventListener("DOMContentLoaded", function () {
    buildFormElements();
    const btn = document.querySelector('button[onclick="requestToken()"]');
    if (btn) btn.disabled = true;
  });
})();


  function validateAllChecks() {
    const btn = document.querySelector('button[onclick="requestToken()"]');
    const sigOk = signaturePad && !signaturePad.isEmpty();
    const idUploaded = document.getElementById("IDUpload")?.files?.length > 0;
    const cardholderFilled = document.getElementById("CardholderName")?.value?.trim()?.length > 2;
    const ready = captchaVerified && zipMatch && tokenValid && sigOk && idUploaded && cardholderFilled;
    if (btn) btn.disabled = !ready;
    console.log("Validation Status — CAPTCHA:", captchaVerified, "ZIP Match:", zipMatch, "Token OK:", tokenValid);
  }

  async function checkAddressMatch() {
    const billingStreetRaw = document.getElementById("ctl00_PageBody_CreBillingAddress")?.value || "";
    const billingZip = document.getElementById("ctl00_PageBody_CrePostalCode")?.value?.trim()?.slice(0, 5);
    const params = new URLSearchParams(window.location.search);
    const deliveryZip = params.get("deliveryzip")?.trim()?.slice(0, 5);
    const deliveryStreetRaw = params.get("deliverystreet") || "";

    const billingStreet = normalizeAddress(billingStreetRaw);
    const deliveryStreet = normalizeAddress(deliveryStreetRaw);

    zipMatch = billingStreet === deliveryStreet && billingZip === deliveryZip;
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
    insertRecaptcha();
    checkTokenExpiration();
    insertVerificationFields();

    const zipInput = document.getElementById("ctl00_PageBody_CrePostalCode");
    if (zipInput) zipInput.addEventListener("blur", checkAddressMatch);
  });
})();