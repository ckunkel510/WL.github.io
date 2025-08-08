(function() {
  // Only run on signup.aspx
  if (!/signup\.aspx/i.test(window.location.href)) return;

  const phoneInput = document.getElementById("ctl00_PageBody_ContactTelephoneTextBox");
  if (!phoneInput) return;

  // Pre-fill with "1 " if empty
  if (!phoneInput.value.trim()) {
    phoneInput.value = "1 ";
  }

  // Put cursor after the "1 "
  function placeCursor() {
    const pos = phoneInput.value.length;
    phoneInput.setSelectionRange(pos, pos);
  }

  // Format input as "1 (XXX) XXX-XXXX"
  function formatPhone(value) {
    // Remove all non-digits except starting 1
    let digits = value.replace(/\D/g, "");

    // Ensure starts with 1
    if (!digits.startsWith("1")) {
      digits = "1" + digits;
    }

    // Limit to 11 digits total
    digits = digits.substring(0, 11);

    // Apply mask: 1 (XXX) XXX-XXXX
    let out = digits[0] + " ";
    if (digits.length > 1) out += "(" + digits.substring(1, 4);
    if (digits.length >= 4) out += ")";
    if (digits.length > 4) out += " " + digits.substring(4, 7);
    if (digits.length > 7) out += "-" + digits.substring(7, 11);

    return out;
  }

  // Handle typing & pasting
  phoneInput.addEventListener("input", function(e) {
    const formatted = formatPhone(phoneInput.value);
    phoneInput.value = formatted;
    placeCursor();
  });

  // Prevent deleting the "1 "
  phoneInput.addEventListener("keydown", function(e) {
    if (phoneInput.selectionStart <= 2 && (e.key === "Backspace" || e.key === "Delete")) {
      e.preventDefault();
    }
  });

  // Validate before submit
  document.addEventListener("submit", function(e) {
    const raw = phoneInput.value.replace(/\D/g, "");
    if (raw.length !== 11) { // includes the starting "1"
      e.preventDefault();
      alert("Please enter a valid 10-digit phone number.");
      phoneInput.focus();
    }
  }, true);

  // Re-format on page load (handles autofill)
  setTimeout(() => {
    phoneInput.value = formatPhone(phoneInput.value);
  }, 200);

})();

