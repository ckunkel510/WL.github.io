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

  function checkTokenExpiration() {
    const params = new URLSearchParams(window.location.search);
    const tsParam = params.get("ts");

    if (!tsParam) {
      console.warn("Missing ts parameter in URL.");
      tokenValid = false;
      validateAllChecks();
      return;
    }

    const now = new Date();
    const tsDate = new Date(tsParam);

    console.log("Parsed ts:", tsDate.toDateString(), "| Now:", now.toDateString());

    // Check if the ts date is today or in the future (min 1-day validity)
    if (tsDate.toString() === "Invalid Date") {
      tokenValid = false;
    } else {
      tokenValid = now <= tsDate;
    }

    validateAllChecks();
  }

  async function checkZipMatch() {
    const billingZip = document.getElementById("ctl00_PageBody_CrePostalCode")?.value?.trim()?.slice(0, 5);
    const params = new URLSearchParams(window.location.search);
    const deliveryZip = params.get("deliveryzip")?.trim()?.slice(0, 5);
    let ipZip = "";

    console.log("Billing ZIP:", billingZip, "| Delivery ZIP:", deliveryZip);

    if (billingZip && deliveryZip && billingZip === deliveryZip) {
      console.log("ZIP Match: Billing matches delivery ZIP");
      zipMatch = true;
      validateAllChecks();
      return;
    }

    // Fallback: IP ZIP check
    try {
      const res = await fetch(`https://ipinfo.io/json?token=${IPINFO_TOKEN}`);
      const data = await res.json();
      ipZip = data.postal?.trim()?.slice(0, 5);
      console.log("IP ZIP:", ipZip);

      if (billingZip && ipZip && billingZip === ipZip) {
        console.log("ZIP Match: Billing matches IP ZIP");
        zipMatch = true;
      } else {
        console.warn("ZIP Mismatch: Neither delivery nor IP ZIP matched billing");
        zipMatch = false;
      }
    } catch (err) {
      console.error("IP ZIP lookup failed", err);
      zipMatch = false;
    }

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
    const deliveryZip = new URLSearchParams(window.location.search).get("deliveryzip") || "";

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
        ipZip,
        timestamp: new Date().toISOString()
      })
    });
  }

  // Wrap requestToken to log before continuing
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

  // Init sequence
  document.addEventListener("DOMContentLoaded", function () {
    const btn = document.querySelector('button[onclick="requestToken()"]');
    if (btn) btn.disabled = true;

    insertRecaptcha();
    checkTokenExpiration();

    const zipInput = document.getElementById("ctl00_PageBody_CrePostalCode");
    if (zipInput) {
      zipInput.addEventListener("blur", checkZipMatch);
    }
  });
})();