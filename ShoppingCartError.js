<script>
document.addEventListener("DOMContentLoaded", function () {
  const needsEmpty = sessionStorage.getItem("CartNeedsEmpty") === "true";
  const retryCount = sessionStorage.getItem("CartRecoveryAttemptCount") || "0";

  if (!needsEmpty) return;

  const btn = document.querySelector("#ctl00_PageBody_EmptyCartButtonTop");

  if (btn) {
    console.log(`[Cart Recovery] Found empty cart button. Attempt ${retryCount}. Clicking...`);
    sessionStorage.removeItem("CartNeedsEmpty");
    sessionStorage.removeItem("CartRecoveryAttemptCount");
    btn.click();
  } else {
    console.warn("[Cart Recovery] Empty Cart button not found. Page may have crashed.");
    // Trigger error redirect again
    sessionStorage.setItem("CartErrorRedirect", "true");
    window.location.href = "/Error.aspx";
  }
});
</script>
