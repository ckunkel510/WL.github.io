
document.addEventListener("DOMContentLoaded", function () {
  console.log("[Cart Recovery] 🔍 Script loaded on Error.aspx");

  const cameFromCart = sessionStorage.getItem("CartErrorRedirect") === "true";
  if (!cameFromCart) {
    console.log("[Cart Recovery] ❌ No redirect flag found. Not a cart-related error.");
    return;
  }

  console.log("[Cart Recovery] ✅ Redirected from ShoppingCart.aspx");

  sessionStorage.removeItem("CartErrorRedirect");
  sessionStorage.removeItem("CartNeedsEmpty");
  sessionStorage.removeItem("CartRecoveryAttemptCount");

  // Step 1: Create hidden iframe to load ShoppingCart.aspx
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = "/ShoppingCart.aspx";
  document.body.appendChild(iframe);

  console.log("[Cart Recovery] 🧭 Injected iframe to load ShoppingCart.aspx");

  iframe.onload = function () {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      console.log("[Cart Recovery] ✅ iframe loaded. Attempting to extract __VIEWSTATE and __EVENTVALIDATION...");

      const viewState = iframeDoc.querySelector('input[name="__VIEWSTATE"]');
      const eventValidation = iframeDoc.querySelector('input[name="__EVENTVALIDATION"]');

      if (!viewState || !eventValidation) {
        console.warn("[Cart Recovery] ⚠️ Required hidden fields not found in iframe.");
        return;
      }

      const viewStateValue = viewState.value;
      const eventValidationValue = eventValidation.value;

      console.log("[Cart Recovery] 🧬 Extracted __VIEWSTATE length:", viewStateValue.length);
      console.log("[Cart Recovery] 🧬 Extracted __EVENTVALIDATION length:", eventValidationValue.length);

      // Step 2: Build and submit synthetic postback with real validation tokens
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/ShoppingCart.aspx";
      form.style.display = "none";

      const targetInput = document.createElement("input");
      targetInput.name = "__EVENTTARGET";
      targetInput.value = "ctl00$PageBody$EmptyCartButtonTop";
      form.appendChild(targetInput);

      const argumentInput = document.createElement("input");
      argumentInput.name = "__EVENTARGUMENT";
      argumentInput.value = "";
      form.appendChild(argumentInput);

      const viewStateInput = document.createElement("input");
      viewStateInput.name = "__VIEWSTATE";
      viewStateInput.value = viewStateValue;
      form.appendChild(viewStateInput);

      const eventValidationInput = document.createElement("input");
      eventValidationInput.name = "__EVENTVALIDATION";
      eventValidationInput.value = eventValidationValue;
      form.appendChild(eventValidationInput);

      document.body.appendChild(form);
      console.log("[Cart Recovery] 🚀 Submitting postback with real tokens...");
      form.submit();
    } catch (err) {
      console.error("[Cart Recovery] ❌ Error accessing iframe content or submitting form:", err);
    }
  };
});

