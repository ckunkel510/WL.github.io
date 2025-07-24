
(function () {
  const accountLinkDiv = document.querySelector("#accountlinkdiv");
  if (!accountLinkDiv) return;

  // Style parent to flex if not already
  accountLinkDiv.style.display = "flex";
  accountLinkDiv.style.justifyContent = "space-between";
  accountLinkDiv.style.alignItems = "flex-start";
  accountLinkDiv.style.gap = "40px";

  // Right Panel
  const rightPanel = document.createElement("div");
  rightPanel.id = "linkedAccountsPanel";
  rightPanel.style.minWidth = "280px";
  rightPanel.style.maxWidth = "320px";
  rightPanel.style.border = "1px solid #ccc";
  rightPanel.style.borderRadius = "8px";
  rightPanel.style.padding = "16px";
  rightPanel.style.backgroundColor = "#f9f9f9";
  rightPanel.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
  rightPanel.innerHTML = `
    <h3 style="margin-top:0;">Linked Sign-In Options</h3>
    <div style="margin-bottom: 12px;">
      <strong>Google:</strong> <span id="googleStatus">Loading…</span>
      <button id="linkGoogleBtn" style="margin-left: 10px;">Link</button>
    </div>
    <div style="margin-bottom: 12px;">
      <strong>Facebook:</strong> <span id="facebookStatus">Loading…</span>
      <button id="linkFacebookBtn" style="margin-left: 10px;">Link</button>
    </div>
    <div style="margin-bottom: 12px;">
      <strong>Apple:</strong> <span id="appleStatus">Loading…</span>
      <button id="linkAppleBtn" style="margin-left: 10px;">Link</button>
    </div>
    <div style="margin-bottom: 12px;">
      <strong>Outlook:</strong> <span id="outlookStatus">Loading…</span>
      <button id="linkOutlookBtn" style="margin-left: 10px;">Link</button>
    </div>
  `;

  // Insert to right of menu
  accountLinkDiv.appendChild(rightPanel);

  // Example: simulate checking localStorage linked providers
  function checkLinkedStatus(provider) {
    const status = localStorage.getItem("wl_linked_" + provider);
    return status === "true";
  }

  ["google", "facebook", "apple", "outlook"].forEach(provider => {
    const isLinked = checkLinkedStatus(provider);
    const statusSpan = document.getElementById(provider + "Status");
    const btn = document.getElementById("link" + capitalize(provider) + "Btn");
    
    if (isLinked) {
      statusSpan.textContent = "✅ Linked";
      btn.textContent = "Unlink";
      btn.onclick = () => {
        localStorage.setItem("wl_linked_" + provider, "false");
        location.reload();
      };
    } else {
      statusSpan.textContent = "❌ Not linked";
      btn.textContent = "Link";
      btn.onclick = () => {
        // This is where you'd trigger OAuth logic
        localStorage.setItem("wl_linked_" + provider, "true");
        location.reload();
      };
    }
  });

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
})();

