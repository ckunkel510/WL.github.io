
document.addEventListener("DOMContentLoaded", function () {
  console.log("[Cart Recovery] 🔍 Script loaded on Error.aspx");

  const cameFromCart = sessionStorage.getItem("CartErrorRedirect") === "true";

  if (!cameFromCart) {
    console.log("[Cart Recovery] ❌ No redirect flag found. Not a cart-related error.");
    return;
  }

  console.log("[Cart Recovery] ✅ Detected redirect from ShoppingCart.aspx");

  // Clear flags before attempting post
  sessionStorage.removeItem("CartErrorRedirect");
  sessionStorage.removeItem("CartNeedsEmpty");
  sessionStorage.removeItem("CartRecoveryAttemptCount");
  console.log("[Cart Recovery] 🧹 Cleared session flags");

  try {
    // Step 1: Create a hidden form to mimic the postback
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/ShoppingCart.aspx";
    form.style.display = "none";
    console.log("[Cart Recovery] 📝 Created hidden form with POST to /ShoppingCart.aspx");

    // Step 2: Add __EVENTTARGET to simulate modal confirmation of Empty Cart
    const targetInput = document.createElement("input");
    targetInput.type = "hidden";
    targetInput.name = "__EVENTTARGET";
    targetInput.value = "ctl00$PageBody$EmptyCartButtonTop";
    form.appendChild(targetInput);
    console.log("[Cart Recovery] ➕ Added __EVENTTARGET input: ctl00$PageBody$EmptyCartButtonTop");

    // Step 3: Add __EVENTARGUMENT (usually empty)
    const argumentInput = document.createElement("input");
    argumentInput.type = "hidden";
    argumentInput.name = "__EVENTARGUMENT";
    argumentInput.value = "";
    form.appendChild(argumentInput);
    console.log("[Cart Recovery] ➕ Added __EVENTARGUMENT input: (empty)");

    // Step 4: (Optional) Log cookies — sometimes important for session-based forms
    console.log("[Cart Recovery] 🍪 Current cookies:", document.cookie);

    // Step 5: Append form to body
    document.body.appendChild(form);
    console.log("[Cart Recovery] 📥 Appended form to DOM");

    // Step 6: Submit the form
    console.log("[Cart Recovery] 🚀 Submitting form to trigger empty cart server-side...");
    form.submit();

    // Failsafe: set a delayed redirect if submit fails silently
    setTimeout(() => {
      console.log("[Cart Recovery] ⏱ Redirecting back to cart in 2 seconds (failsafe)...");
      window.location.href = "/ShoppingCart.aspx";
    }, 2000);

  } catch (err) {
    console.error("[Cart Recovery] ❌ Error during postback simulation:", err);
  }
});

