document.addEventListener("DOMContentLoaded", function () {
  const cameFromCart = sessionStorage.getItem("CartErrorRedirect") === "true";

  if (!cameFromCart) return;

  console.log("[Cart Recovery] Detected cart-related error. Attempting forced cart clear.");

  sessionStorage.removeItem("CartErrorRedirect");

  // Step 1: Create a hidden form that mimics the empty cart postback
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/ShoppingCart.aspx";

  const eventTarget = document.createElement("input");
  eventTarget.type = "hidden";
  eventTarget.name = "__EVENTTARGET";
  eventTarget.value = "ctl00$PageBody$EmptyCartButtonTop";
  form.appendChild(eventTarget);

  // Add __EVENTARGUMENT (usually empty)
  const eventArgument = document.createElement("input");
  eventArgument.type = "hidden";
  eventArgument.name = "__EVENTARGUMENT";
  eventArgument.value = "";
  form.appendChild(eventArgument);

  // Optional: Include __VIEWSTATE and __EVENTVALIDATION if required,
  // but many .NET implementations will process this without them for simple postbacks

  document.body.appendChild(form);
  form.submit(); // Triggers empty cart logic

  setTimeout(() => {
  window.location.href = "/ShoppingCart.aspx";
}, 1500);

});

