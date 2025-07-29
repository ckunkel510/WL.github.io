
document.addEventListener("DOMContentLoaded", function () {
  console.log("[Cart Recovery] 🔍 Script loaded on Error.aspx");

  const cameFromCart = sessionStorage.getItem("CartErrorRedirect") === "true";
  if (!cameFromCart) {
    console.log("[Cart Recovery] ❌ No redirect flag found.");
    return;
  }

  console.log("[Cart Recovery] ✅ Redirected from ShoppingCart.aspx");
  sessionStorage.removeItem("CartErrorRedirect");
  sessionStorage.removeItem("CartNeedsEmpty");
  sessionStorage.removeItem("CartRecoveryAttemptCount");

  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = "/Products.aspx"; // Update if needed
  document.body.appendChild(iframe);

  console.log("[Cart Recovery] 🧭 Injected iframe to load Products.aspx");

  iframe.onload = function () {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      console.log("[Cart Recovery] ✅ iframe loaded. Extracting hidden tokens...");

      const viewState = iframeDoc.querySelector('input[name="__VIEWSTATE"]');
      const eventValidation = iframeDoc.querySelector('input[name="__EVENTVALIDATION"]');
      const viewStateGen = iframeDoc.querySelector('input[name="__VIEWSTATEGENERATOR"]');

      if (!viewState || !eventValidation) {
        console.warn("[Cart Recovery] ⚠️ Required tokens not found. Abort.");
        return;
      }

      const vsVal = viewState.value;
      const evVal = eventValidation.value;
      const vsgVal = viewStateGen ? viewStateGen.value : null;

      console.log("[Cart Recovery] 🧬 Extracted __VIEWSTATE length:", vsVal.length);
      console.log("[Cart Recovery] 🧬 Extracted __EVENTVALIDATION length:", evVal.length);
      if (vsgVal) {
        console.log("[Cart Recovery] 🧬 Extracted __VIEWSTATEGENERATOR:", vsgVal);
      }

      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/ShoppingCart.aspx";
      form.style.display = "none";

      const payload = [
        ["__EVENTTARGET", "ctl00$PageBody$EmptyCartButtonTop"],
        ["__EVENTARGUMENT", ""],
        ["__VIEWSTATE", vsVal],
        ["__EVENTVALIDATION", evVal],
      ];

      if (vsgVal) payload.push(["__VIEWSTATEGENERATOR", vsgVal]);

      payload.forEach(([name, value]) => {
        const input = document.createElement("input");
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });

      // Log the actual post values in table format
      console.log("[Cart Recovery] 📦 Payload being submitted:");
      console.table(Object.fromEntries(payload));

      document.body.appendChild(form);
      console.log("[Cart Recovery] 🧾 Form ready. Submitting in 3 seconds...");

      setTimeout(() => {
        console.log("[Cart Recovery] 🚀 Submitting form NOW to empty cart...");
        form.submit();
      }, 3000); // short delay to see logs

      // Slow down the redirect: Set a separate delay AFTER submit (for manual tracking)
      setTimeout(() => {
        console.log("[Cart Recovery] ⏳ Redirecting manually to /ShoppingCart.aspx after inspection...");
        window.location.href = "/ShoppingCart.aspx";
      }, 8000); // more time to inspect Network tab

    } catch (err) {
      console.error("[Cart Recovery] ❌ Exception during token extraction or form submission:", err);
    }
  };
});
