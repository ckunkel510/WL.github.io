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
    console.log("[StoreMode] Rendering polished store overlay");
    layout.innerHTML = ""; // clear product grid

    const container = document.createElement("div");
    container.style.cssText = `
      background-color: #6b0016;
      color: white;
      padding: 30px 20px;
      font-family: sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
    `;

    const title = document.createElement("h1");
    title.textContent = "Welcome to Woodson Lumber (Store Mode)";
    title.style.cssText = "font-size: 1.8rem; margin-bottom: 24px; text-align: center;";
    container.appendChild(title);

    const grid = document.createElement("div");
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 16px;
      width: 100%;
      max-width: 500px;
    `;

    const buttons = [
      {
        text: "🔍 Look Up Item",
        action: () => {
          sessionStorage.setItem("storeMode", "off");
          window.location.href = "/products.aspx";
        }
      },
      {
        text: "📷 Scan Barcode",
        action: () => {
          const script = document.createElement("script");
          script.src = "https://ckunkel510.github.io/WL.github.io/BarcodeScanner.js";
          document.body.appendChild(script);
        }
      },
      {
        text: "🔥 Specials",
        action: () => {
          window.location.href = "https://webtrack.woodsonlumber.com/Products.aspx?pl1=4546&pg=4546";
        }
      },
      {
        text: "👤 My Account",
        action: () => {
          window.location.href = "/Signin.aspx";
        }
      },
      {
        text: "💬 Need Help?",
        action: () => {
          Tawk_API?.maximize();
        }
      },
      {
        text: "🔁 Return to Full Site",
        action: () => {
          sessionStorage.setItem("storeMode", "off");
          window.location.href = "/products.aspx";
        }
      }
    ];

    buttons.forEach(({ text, action }) => {
      const btn = document.createElement("button");
      btn.textContent = text;
      btn.style.cssText = `
        background-color: white;
        color: #6b0016;
        padding: 20px;
        border-radius: 8px;
        border: none;
        font-size: 1.1rem;
        font-weight: bold;
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        transition: background-color 0.2s, transform 0.2s;
      `;
      btn.addEventListener("mouseenter", () => btn.style.backgroundColor = "#f0f0f0");
      btn.addEventListener("mouseleave", () => btn.style.backgroundColor = "white");
      btn.addEventListener("click", action);
      grid.appendChild(btn);
    });

    container.appendChild(grid);
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

      console.log("[StoreMode] Return to store mode banner injected");
    }
  }
});
