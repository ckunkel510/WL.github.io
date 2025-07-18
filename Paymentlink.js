(function () {
  const RECAPTCHA_SITE_KEY = "6Lfn5IcrAAAAAMxSoB_0zPc-a41_vBNs5QcAg7RN";
  const IPINFO_TOKEN = "169fa3f70bafa2";
  const LOGGING_URL = "https://script.google.com/macros/s/AKfycbxF-OhAy_JK635XpjDuaVAkFROyF2vWq2WjEF_qTp2rkyXPLU2AW3eYKfsK7RSj3PlTuQ/exec";

  let captchaVerified = false;
  let zipMatch = false;
  let tokenValid = false;

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

  // Global reCAPTCHA callbacks
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

  async function checkZipMatch() {
    const zipInput = document.getElementById("ctl00_PageBody_CrePostalCode");
    const zip = zipInput?.value?.trim()?.slice(0, 5);

    try {
      const res = await fetch(`https://ipinfo.io/json?token=${IPINFO_TOKEN}`);
      const data = await res.json();
      const ipZip = data.postal?.trim()?.slice(0, 5);
      console.log("ZIP Check — Entered:", zip, "IP ZIP:", ipZip);

      if (zip && ipZip && zip === ipZip) {
        zipMatch = true;
      } else {
        zipMatch = false;
      }
    } catch (err) {
      console.warn("IP check failed:", err);
      zipMatch = false;
    }

    validateAllChecks();
  }

  function checkTokenTimestamp() {
    const params = new URLSearchParams(window.location.search);
    const ts = parseInt(params.get("ts"));
    const now = Date.now();
    tokenValid = ts && now <= ts;
    console.log("Token Valid:", tokenValid, "| Now:", now, "| ts:", ts);
    validateAllChecks();
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

  let ipZip = "";
  try {
    const res = await fetch(`https://ipinfo.io/json?token=${IPINFO_TOKEN}`);
    const data = await res.json();
    ipZip = data.postal || "";
  } catch (err) {
    console.warn("Failed to fetch IP ZIP for logging.");
  }

  await fetch(LOGGING_URL, {
    method: "POST",
    body: new URLSearchParams({
      billingAddress,
      billingZip,
      orderMatch: orderText,
      pageUrl,
      ipZip,
      timestamp: new Date().toISOString()
    })
  });
}


  // Hijack and wrap original requestToken call
  const originalRequestToken = window.requestToken;
  window.requestToken = function () {
    logPaymentData().then(() => {
      if (typeof originalRequestToken === "function") {
        originalRequestToken();
      } else {
        console.log("requestToken override fallback — original function not found.");
      }
    });
  };

  // Init sequence
  document.addEventListener("DOMContentLoaded", function () {
    const btn = document.querySelector('button[onclick="requestToken()"]');
    if (btn) btn.disabled = true;

    insertRecaptcha();
    checkTokenTimestamp();

    const zipInput = document.getElementById("ctl00_PageBody_CrePostalCode");
    if (zipInput) zipInput.addEventListener("blur", checkZipMatch);
  });
})();
