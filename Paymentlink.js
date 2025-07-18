(function () {
  const RECAPTCHA_SITE_KEY = "6Lfn5IcrAAAAAMxSoB_0zPc-a41_vBNs5QcAg7RN";
  const IPINFO_TOKEN = "169fa3f70bafa2";
  const LOGGING_URL = "https://script.google.com/macros/s/AKfycbxF-OhAy_JK635XpjDuaVAkFROyF2vWq2WjEF_qTp2rkyXPLU2AW3eYKfsK7RSj3PlTuQ/exec";

  let captchaVerified = false;
  let zipMatch = false;
  let tokenValid = false;

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

  function insertRecaptcha() {
    const targetBtn = document.querySelector('button[onclick="requestToken()"]');
    if (!targetBtn) return;

    const container = document.createElement("div");
    container.id = "recaptcha-container";
    container.className = "g-recaptcha";
    container.setAttribute("data-sitekey", RECAPTCHA_SITE_KEY);
    container.setAttribute("data-callback", "onCaptchaSuccess");
    container.setAttribute("data-expired-callback", "onCaptchaExpired");
    container.setAttribute("data-error-callback", "onCaptchaFailed");

    targetBtn.parentNode.insertBefore(container, targetBtn);
    const script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }

  window.onCaptchaSuccess = function () {
    captchaVerified = true;
    validateAllChecks();
  };
  window.onCaptchaExpired = function () {
    captchaVerified = false;
    validateAllChecks();
  };
  window.onCaptchaFailed = function () {
    captchaVerified = false;
    validateAllChecks();
  };

  function checkTokenExpiration() {
    const params = new URLSearchParams(window.location.search);
    const tsParam = params.get("ts");
    const now = new Date();
    const tsDate = new Date(tsParam);

    console.log("Parsed ts:", tsDate.toDateString(), "| Now:", now.toDateString());

    tokenValid = tsDate.toString() !== "Invalid Date" && now <= tsDate;
    validateAllChecks();
  }

  async function checkAddressMatch() {
  const billingStreetRaw = document.getElementById("ctl00_PageBody_CreBillingAddress")?.value || "";
  const billingZip = document.getElementById("ctl00_PageBody_CrePostalCode")?.value?.trim()?.slice(0, 5);
  const params = new URLSearchParams(window.location.search);
  const deliveryZip = params.get("deliveryzip")?.trim()?.slice(0, 5);
  const deliveryStreetRaw = params.get("deliverystreet") || "";

  const billingStreet = normalizeAddress(billingStreetRaw);
  const deliveryStreet = normalizeAddress(deliveryStreetRaw);

  const msgEl = document.getElementById("SecureWarningMessage");
  if (msgEl) msgEl.remove(); // Clear old message

  // First: Must match BOTH street and ZIP
  if (
    billingStreet &&
    deliveryStreet &&
    billingStreet === deliveryStreet &&
    billingZip &&
    deliveryZip &&
    billingZip === deliveryZip
  ) {
    console.log("Primary match passed: billing matches delivery street AND ZIP");
    zipMatch = true;
    validateAllChecks();
    return;
  }

  // Fallback: IP ZIP check
  try {
    const res = await fetch(`https://ipinfo.io/json?token=${IPINFO_TOKEN}`);
    const data = await res.json();
    const ipZip = data.postal?.trim()?.slice(0, 5);

    if (billingZip && ipZip && billingZip === ipZip) {
      console.log("ZIP fallback passed: billing ZIP matches IP ZIP");
      zipMatch = true;
    } else {
      console.warn("Failed all match conditions");
      zipMatch = false;
    }
  } catch (err) {
    console.error("IP ZIP lookup failed", err);
    zipMatch = false;
  }

  validateAllChecks();

  if (!zipMatch) {
    const msg = document.createElement("div");
    msg.id = "SecureWarningMessage";
    msg.style = "margin-top: 12px; color: darkred; font-weight: bold;";
    msg.innerText =
      "We couldn’t verify your billing details. Please double-check your address and ZIP, or try again from your home or business network. If problems persist, give us a call.";
    const btn = document.querySelector('button[onclick="requestToken()"]');
    if (btn) btn.insertAdjacentElement("afterend", msg);
  }
}


  function validateAllChecks() {
    const btn = document.querySelector('button[onclick="requestToken()"]');
    if (btn) {
      const ready = captchaVerified && zipMatch && tokenValid;
      console.log("Validation Status — CAPTCHA:", captchaVerified, "ZIP Match:", zipMatch, "Token OK:", tokenValid);
      btn.disabled = !ready;
    }
  }

  async function logPaymentData() {
    const billingAddress = document.getElementById("ctl00_PageBody_CreBillingAddress")?.value?.trim() || "";
    const billingZip = document.getElementById("ctl00_PageBody_CrePostalCode")?.value?.trim() || "";
    const orderText = document.querySelector(".PaymentTotalPanel")?.textContent || "";
    const pageUrl = window.location.href;
    const params = new URLSearchParams(window.location.search);
    const deliveryZip = params.get("deliveryzip") || "";
    const deliveryStreet = params.get("deliverystreet") || "";

    let ipZip = "";
    try {
      const res = await fetch(`https://ipinfo.io/json?token=${IPINFO_TOKEN}`);
      const data = await res.json();
      ipZip = data.postal || "";
    } catch (err) {
      console.warn("Logging: IP ZIP fetch failed.");
    }

    await fetch(LOGGING_URL, {
      method: "POST",
      body: new URLSearchParams({
        billingAddress,
        billingZip,
        orderMatch: orderText,
        pageUrl,
        deliveryZip,
        deliveryStreet,
        ipZip,
        timestamp: new Date().toISOString()
      })
    });
  }

  const originalRequestToken = window.requestToken;
  window.requestToken = function () {
    logPaymentData().then(() => {
      if (typeof originalRequestToken === "function") {
        originalRequestToken();
      } else {
        console.log("Fallback: No original requestToken found.");
      }
    });
  };

  document.addEventListener("DOMContentLoaded", function () {
    const btn = document.querySelector('button[onclick="requestToken()"]');
    if (btn) btn.disabled = true;

    insertRecaptcha();
    checkTokenExpiration();

    const zipInput = document.getElementById("ctl00_PageBody_CrePostalCode");
    if (zipInput) {
      zipInput.addEventListener("blur", checkAddressMatch);
    }
  });
})();
