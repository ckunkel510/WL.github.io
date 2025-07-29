document.addEventListener("DOMContentLoaded", function () {
  const cameFromCart = sessionStorage.getItem("CartErrorRedirect") === "true";

  if (!cameFromCart) {
    console.log("[Cart Recovery] No redirect flag found. Nothing to do.");
    return;
  }

  console.log("[Cart Recovery] Cart redirect flag detected. Attempting cart clear via postback.");

  // Clear the flag to avoid looping
  sessionStorage.removeItem("CartErrorRedirect");

  try {
    // Step 1: Create the form
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/ShoppingCart.aspx";
    form.style.display = "none";

    // Step 2: Add __EVENTTARGET to simulate the Empty Cart button
    const eventTarget = document.createElement("input");
    eventTarget.type = "hidden";
    eventTarget.name = "__EVENTTARGET";
    eventTarget.value = "ctl00$PageBody$EmptyCartButtonTop";
    form.appendChild(eventTarget);
    console.log("[Cart Recovery] Added __EVENTTARGET input.");

    // Step 3: Add __EVENTARGUMENT (usually empty for this button)
    const eventArgument = document.createElement("input");
    eventArgument.type = "hidden";
    eventArgument.name = "__EVENTARGUMENT";
    eventArgument.value = "";
    form.appendChild(eventArgument);
    console.log("[Cart Recovery] Added __EVENTARGUMENT input.");

    // Optional: Log current cookies/session for debugging purposes
    console.log("[Cart Recovery] Current cookies:", document.cookie);

    // Step 4: Add the form to the page and submit it
    document.body.appendChild(form);
    console.log("[Cart Recovery] Submitting form to trigger server-side cart clear...");

    form.submit();

    // Optional: Set a timeout to redirect user back to cart
    setTimeout(() => {
      console.log("[Cart Recovery] Redirecting back to ShoppingCart.aspx after postback.");
      window.location.href = "/ShoppingCart.aspx";
    }, 2000);

  } catch (err) {
    console.error("[Cart Recovery] Failed to submit cart clear form:", err);
  }
});

