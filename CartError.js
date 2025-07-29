
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
  iframe.src = "/Products.aspx"; // 👈 update if needed
  document.body.appendChild(iframe);

  console.log("[Cart Recovery] 🧭 Injected iframe to load Products.aspx");

  iframe.onload = function () {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      console.log("[Cart Recovery] ✅ iframe loaded. Extracting state tokens...");

      const viewState = iframeDoc.querySelector('input[name="__VIEWSTATE"]');
      const eventValidation = iframeDoc.querySelector('input[name="__EVENTVALIDATION"]');
      const viewStateGen = iframeDoc.querySelector('input[name="__VIEWSTATEGENERATOR"]');

      if (!viewState || !eventValidation) {
        console.warn("[Cart Recovery] ⚠️ Failed to extract required tokens.");
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

      const inputs = [
        ["__EVENTTARGET", "ctl00$PageBody$EmptyCartButtonTop"],
        ["__EVENTARGUMENT", ""],
        ["__VIEWSTATE", vsVal],
        ["__EVENTVALIDATION", evVal]
      ];

      if (vsgVal) inputs.push(["__VIEWSTATEGENERATOR", vsgVal]);

      for (const [name, value] of inputs) {
        const input = document.createElement("input");
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }

      document.body.appendChild(form);
      console.log("[Cart Recovery] 🧾 Form built with extracted values.");
      console.log("[Cart Recovery] ⏳ Submitting in 4 seconds...");

      setTimeout(() => {
        console.log("[Cart Recovery] 🚀 Submitting form to clear cart...");
        form.submit();
      }, 4000);

    } catch (err) {
      console.error("[Cart Recovery] ❌ Error during extraction/post:", err);
    }
  };
});

