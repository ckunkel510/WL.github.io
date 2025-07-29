document.addEventListener("DOMContentLoaded", function () {
  const cameFromCart = sessionStorage.getItem("CartErrorRedirect") === "true";

  if (!cameFromCart) {
    console.log("[Cart Recovery] No redirect flag found.");
    return;
  }

  console.log("[Cart Recovery] Redirected from ShoppingCart.aspx. Attempting direct postback to clear cart.");

  // Clear flags
  sessionStorage.removeItem("CartErrorRedirect");
  sessionStorage.removeItem("CartNeedsEmpty");
  sessionStorage.removeItem("CartRecoveryAttemptCount");

  try {
    // Step 1: Build a synthetic postback form
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/ShoppingCart.aspx";
    form.style.display = "none";

    // __EVENTTARGET: triggers empty cart postback
    const targetInput = document.createElement("input");
    targetInput.name = "__EVENTTARGET";
    targetInput.value = "ctl00$PageBody$EmptyCartButtonTop";
    form.appendChild(targetInput);

    // __EVENTARGUMENT: usually empty
    const argumentInput = document.createElement("input");
    argumentInput.name = "__EVENTARGUMENT";
    argumentInput.value = "";
    form.appendChild(argumentInput);

    // Append and submit the form
    document.body.appendChild(form);
    console.log("[Cart Recovery] Submitting postback form to trigger empty cart...");
    form.submit();
  } catch (err) {
    console.error("[Cart Recovery] Failed to submit postback:", err);
  }
});

