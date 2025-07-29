document.addEventListener("DOMContentLoaded", () => {
  const layout = document.querySelector("#MainLayoutRow");
  const isStoreMode = sessionStorage.getItem("storeMode") === "on";

  const stillAtStore = sessionStorage.getItem("storeProximity") === "true";

  if (!layout || !stillAtStore) return;

  if (isStoreMode) {
    renderStoreMode(layout);
  } else {
    injectReturnToStoreBanner();
  }

  function renderStoreMode(layout) {
    console.log("[StoreMode] Rendering full screen store overlay");
    layout.innerHTML = ""; // clear product grid

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
      align-items: center;
      gap: 20px;
    `;

    const title = document.createElement("h1");
    title.textContent = "Welcome to Woodson Lumber (In-Store Mode)";
    title.style.cssText = "font-size: 1.8rem; margin-bottom: 20px;";
    container.appendChild(title);

    const buttons = [
      { text: "🔍 Look Up Item", href: "/products.aspx" },
      { text: "📷 Scan Barcode", href: "/barcode-scanner.html" },
      { text: "🔥 View Specials", href: "/deals.aspx" },
      { text: "👤 My Account", href: "/Signin.aspx" },
      {
        text: "💬 Need Help?",
        onclick: "Tawk_API?.maximize();"
      },
      {
        text: "🔁 Return to Full Site",
        onclick: () => {
          sessionStorage.setItem("storeMode", "off");
          window.location.href = "/Products.aspx";
        }
      }
    ];

    buttons.forEach(({ text, href, onclick }) => {
      const btn = document.createElement("a");
      btn.textContent = text;
      btn.style.cssText = `
        background-color: white;
        color: #6b0016;
        padding: 18px 24px;
        font-size: 1.2rem;
        border-radius: 8px;
        text-decoration: none;
        font-weight: bold;
        display: block;
        max-width: 320px;
        width: 100%;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      `;

      if (href) {
        btn.href = href;
      } else if (onclick) {
        btn.href = "#";
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          if (typeof onclick === "string") {
            eval(onclick);
          } else {
            onclick();
          }
        });
      }

      container.appendChild(btn);
    });

    layout.appendChild(container);
  }

  function injectReturnToStoreBanner() {
    if (location.pathname.toLowerCase().includes("products.aspx")) {
      const target = document.querySelector("#MainLayoutRow");
      if (!target) return;

      const banner = document.createElement("div");
      banner.style.cssText = `
        background-color: #6b0016;
        color: white;
        padding: 12px;
        text-align: center;
        font-weight: bold;
        font-size: 1rem;
        position: relative;
        z-index: 9999;
      `;
      banner.innerHTML = `
        You're at a Woodson Lumber store.
        <a href="#" style="color: white; text-decoration: underline; margin-left: 8px;" id="returnToStoreModeBtn">Return to Store Mode</a>
      `;

      target.parentNode.insertBefore(banner, target);

      document.getElementById("returnToStoreModeBtn").addEventListener("click", (e) => {
        e.preventDefault();
        sessionStorage.setItem("storeMode", "on");
        window.location.href = "/Default.aspx";
      });

      console.log("[StoreMode] Banner for returning to Store Mode injected ✅");
    }
  }
});
