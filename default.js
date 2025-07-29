document.addEventListener("DOMContentLoaded", () => {
  const layout = document.querySelector("#MainLayoutRow");
  const isStoreMode = sessionStorage.getItem("storeMode") === "on";
  const stillAtStore = sessionStorage.getItem("storeProximity") === "true";
  const storeName = sessionStorage.getItem("storeName") || "Woodson Lumber";

  if (!layout || !stillAtStore) return;

  if (isStoreMode) {
    renderStoreMode(layout, storeName);
    injectBarcodeDependencies();
  } else {
    injectReturnToStoreBanner();
  }

  function renderStoreMode(layout, storeName) {
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
    title.textContent = `Welcome to ${storeName}`;
    title.style.cssText = `
      font-size: 1.6rem;
      margin-bottom: 24px;
      text-align: center;
      font-family: 'Georgia', 'Times New Roman', serif;
      font-style: italic;
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

    const createButton = (text, onClick) => {
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
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        onClick();
      });
      return btn;
    };

    // Add buttons to grid
    grid.appendChild(createButton("🔍 Look Up Item", () => {
      sessionStorage.setItem("storeMode", "off");
      window.location.href = "/products.aspx";
    }));

    grid.appendChild(createButton("📷 Scan Barcode", () => {
      const tryScanner = () => {
        const scannerModal = document.getElementById("barcode-scan-modal");
        if (scannerModal) {
          scannerModal.style.display = "block";
        } else {
          console.warn("[StoreMode] Scanner modal not found yet");
        }
      };
      setTimeout(tryScanner, 500); // small delay to let script load
    }));

    grid.appendChild(createButton("🔥 Specials", () => {
      sessionStorage.setItem("storeMode", "off");
      window.location.href = "https://webtrack.woodsonlumber.com/Products.aspx?pl1=4546&pg=4546";
    }));

    grid.appendChild(createButton("👤 My Account", () => {
      window.location.href = "/Signin.aspx";
    }));

    grid.appendChild(createButton("💬 Need Help?", () => {
      const waitForTawk = setInterval(() => {
        if (typeof Tawk_API !== "undefined" && Tawk_API.maximize) {
          Tawk_API.maximize();
          clearInterval(waitForTawk);
        }
      }, 300);
    }));

    grid.appendChild(createButton("🔁 Return to Full Site", () => {
      sessionStorage.setItem("storeMode", "off");
      window.location.href = "/products.aspx";
    }));

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
        window.location.href = "/Default.aspx";
      });

      console.log("[StoreMode] Return banner injected");
    }
  }

  function injectBarcodeDependencies() {
  if (!document.getElementById("quagga-loaded")) {
    const quagga = document.createElement("script");
    quagga.src = "https://unpkg.com/quagga@0.12.1/dist/quagga.min.js";
    quagga.id = "quagga-loaded";
    document.head.appendChild(quagga);
  }

  if (!document.getElementById("barcode-scanner-script")) {
    const scanner = document.createElement("script");
    scanner.src = "https://ckunkel510.github.io/WL.github.io/BarcodeScanner.js";
    scanner.defer = true;
    scanner.id = "barcode-scanner-script";
    document.head.appendChild(scanner);
  }

  if (!document.getElementById("barcode-scan-modal")) {
    const modal = document.createElement("div");
    modal.id = "barcode-scan-modal";
    modal.style.cssText = `
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      z-index: 9999;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      color: white;
    `;
    modal.innerHTML = `
      <div style="margin-bottom: 16px; font-size: 1.2rem;">Scan a Product Barcode</div>
      <div id="barcode-scanner" style="width: 100%; max-width: 400px; height: 300px; background: black;"></div>
      <button style="margin-top: 20px; padding: 10px 20px; background: white; color: #6b0016; border: none; border-radius: 6px; font-weight: bold;" onclick="document.getElementById('barcode-scan-modal').style.display='none';">Close</button>
    `;
    document.body.appendChild(modal);
  }
}

});
