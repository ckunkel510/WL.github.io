document.addEventListener("DOMContentLoaded", () => {
  // Only override if we're on the Default.aspx page
  if (!location.pathname.toLowerCase().includes("default.aspx")) return;

  console.log("[StoreModeUI] Overriding Default.aspx with Store Mode layout ✅");

  // Clear out the existing body content
  const main = document.querySelector("#ctl00_PageBody_MainPanel") || document.body;
  main.innerHTML = "";

  // Inject custom layout
  const container = document.createElement("div");
  container.style.cssText = `
    background-color: #6b0016;
    color: white;
    padding: 40px 20px;
    text-align: center;
    font-family: sans-serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 20px;
  `;

  const header = document.createElement("h1");
  header.textContent = "You're In-Store at Woodson Lumber";
  header.style.cssText = `
    font-size: 1.8rem;
    margin-bottom: 20px;
  `;
  container.appendChild(header);

  const buttons = [
    { text: "🔍 Look Up Item", href: "/products.aspx" },
    { text: "📷 Scan Barcode", href: "/barcode-scanner.html" }, // update if different
    { text: "🔥 View Specials", href: "/deals.aspx" },
    { text: "👤 My Account", href: "/Signin.aspx" },
    { text: "💬 Need Help?", onclick: "Tawk_API?.maximize();" }
  ];

  buttons.forEach(({ text, href, onclick }) => {
    const btn = document.createElement("a");
    btn.textContent = text;
    btn.style.cssText = `
      background-color: white;
      color: #6b0016;
      padding: 18px;
      font-size: 1.2rem;
      border-radius: 8px;
      text-decoration: none;
      font-weight: bold;
      display: block;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;

    if (href) btn.href = href;
    if (onclick) {
      btn.href = "#";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        eval(onclick); // safe here for known values
      });
    }

    container.appendChild(btn);
  });

  main.appendChild(container);
});
