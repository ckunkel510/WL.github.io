document.addEventListener("DOMContentLoaded", () => {
  const layout = document.querySelector("#MainLayoutRow");
  const isStoreMode = sessionStorage.getItem("storeMode") === "on";
  const stillAtStore = sessionStorage.getItem("storeProximity") === "true";

  if (!layout || !stillAtStore) return;

  if (isStoreMode) {
    renderStoreMode(layout);
    injectBarcodeDependencies(); // ✅ Make scanner work
  } else {
    injectReturnToStoreBanner();
  }

  function renderStoreMode(layout) {
    console.log("[StoreMode] Rendering store overlay");

    layout.innerHTML = "";

    const container = document.createElement("div");
    container.style.cssText = `
      background-color: #6b0016;
      color: white;
      padding: 30px 16px;
      font-family: sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-sizing: border-box;
      overflow-x: hidden;
    `;

    const title = document.createElement("h1");
    title.textContent = "Welcome to Woodson Lumber (Store Mode)";
    title.style.cssText = `
      font-size: 1.5rem;
      margin-bottom: 24px;
      text-align: center;
      width: 100%;
    `;
    container.appendChild(title);

    const grid = document.createElement("div");
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 14px;
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
          // Scanner is already loaded via script injection
          const scannerUI = document.getElementById("barcode-scan-modal");
          if (scannerUI) scannerUI.style.display = "block";
        }
      },
      {
        text: "🔥 Specials",
        action: () => {
          sessionStorage.setItem("storeMode", "off");
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
          const waitForTawk = setInterval(() => {
            if (typeof Tawk_API !== "undefined" && Tawk_API.maximize) {
              Tawk_API.maximize();
              clearInterval(waitForTawk);
            }
          }, 300);
        }
      },
      {
        text: "🔁 Return to Full Site",
        action: () => {
          sessionStorage.setItem("storeMode", "off");
          window.location.href = "/Products.aspx";
        }
      }
    ];

    buttons.forEach(({ text, action }) => {
      const btn = document.createElement("button");
      btn.textContent = text;
      btn.style.cssText = `
        background-color: white;
        color: #6b0016;
        padding: 0;
        border-radius: 8px;
        border: none;
        font-size: 1rem;
        font-weight: bold;
        cursor: pointer;
        width: 100%;
        aspect-ratio: 1 / 1;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        transition: background-color 0.2s;
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
      const layoutParent = document.querySelector("#MainLayoutRow")?.parentNode;
      if (!layoutParent) return;

      const existingBanner = document.getElementById("storeModeBanner");
      if (existingBanner) return;

      const banner = document.createElement("div");
      banner.id = "storeModeBanner";
      banner.style.cssText = `
        background-color: #6b0016;
        color: white;
        padding: 12px 16px;
        font-weight: bold;
        font-size: 0.95rem;
        text-align: center;
        width: 100%;
        box-sizing: border-box;
        margin-bottom: 10px;
      `;
      banner.innerHTML = `
        Looks like you're at a Woodson Lumber store.
        <a href="#" style="color: white; text-decoration: underline; margin-left: 6px;" id="returnToStoreModeBtn">Switch to Store Mode</a>
      `;

      layoutParent.insertBefore(banner, document.querySelector("#MainLayoutRow"));

      document.getElementById("returnToStoreModeBtn").addEventListener("click", (e) => {
        e.preventDefault();
        sessionStorage.setItem("storeMode", "on");
        window.location.href = "/Products.aspx";
      });

      console.log("[StoreMode] Return banner injected");
    }
  }

  function injectBarcodeDependencies() {
    if (document.getElementById("quagga-loaded")) return;

    const quagga = document.createElement("script");
    quagga.src = "https://unpkg.com/quagga@0.12.1/dist/quagga.min.js";
    quagga.id = "quagga-loaded";
    document.head.appendChild(quagga);

    const scanner = document.createElement("script");
    scanner.src = "https://ckunkel510.github.io/WL.github.io/BarcodeScanner.js";
    scanner.defer = true;
    document.head.appendChild(scanner);
  }
});
