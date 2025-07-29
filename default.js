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
  if (typeof Quagga === "undefined") {
    const quagga = document.createElement("script");
    quagga.src = "https://unpkg.com/quagga@0.12.1/dist/quagga.min.js";
    quagga.onload = () => loadInStoreScanner();
    document.head.appendChild(quagga);
  } else {
    loadInStoreScanner();
  }
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
    const searchBarRow = document.getElementById("ctl00_PageHeader_searchBarTableRow");
    if (!searchBarRow) return;

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
    `;
    banner.innerHTML = `
      Looks like you're at a Woodson Lumber store.
      <a href="#" style="color: white; text-decoration: underline; margin-left: 6px;" id="returnToStoreModeBtn">Switch to Store Mode</a>
    `;

    // ✅ Insert AFTER the search bar row
    if (searchBarRow.parentNode) {
      searchBarRow.parentNode.insertBefore(banner, searchBarRow.nextSibling);
    }

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

  
}

});

function loadInStoreScanner() {
  if (document.getElementById("barcode-scan-overlay")) {
    // If overlay already exists, just open it
    document.getElementById("barcode-scan-overlay").style.display = "block";
    startQuagga();
    return;
  }

  // Create overlay
  const overlay = document.createElement("div");
  overlay.id = "barcode-scan-overlay";
  overlay.style.cssText = `
    display: block;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 9999;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
  `;
  overlay.innerHTML = `
    <video id="barcode-video" autoplay playsinline muted style="width: 100%; height: 100%; object-fit: cover;"></video>
    <canvas id="barcode-canvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 2;"></canvas>
    <div style="position: absolute; top: 50%; left: 50%; width: 60%; height: 20%; transform: translate(-50%, -50%); border: 2px solid #00ff00; z-index: 3;"></div>
    <button id="close-barcode-scanner" style="position: absolute; top: 10px; right: 10px; padding: 10px 15px; font-size: 16px; z-index: 10000;">Close</button>
  `;
  document.body.appendChild(overlay);

  document.getElementById("close-barcode-scanner").onclick = stopQuagga;
  startQuagga();
}

function startQuagga() {
  const video = document.getElementById("barcode-video");
  const detected = {};
  const minDetections = 3;

  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(stream => {
    video.srcObject = stream;

    Quagga.init({
      inputStream: {
        type: "LiveStream",
        target: document.getElementById("barcode-canvas"),
        constraints: { facingMode: "environment" }
      },
      decoder: { readers: ["upc_reader"] },
      locate: true
    }, err => {
      if (err) {
        console.error("Quagga error:", err);
        stopQuagga();
        return;
      }
      Quagga.start();
    });

    Quagga.onDetected(result => {
      const code = result.codeResult.code;
      detected[code] = (detected[code] || 0) + 1;

      if (detected[code] >= minDetections) {
        Quagga.stop();
        stream.getTracks().forEach(t => t.stop());
        window.location.href = `https://webtrack.woodsonlumber.com/Products.aspx?pg=0&searchText=${code}`;
      }
    });
  });
}

function stopQuagga() {
  const overlay = document.getElementById("barcode-scan-overlay");
  if (overlay) overlay.style.display = "none";

  const video = document.getElementById("barcode-video");
  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
  }

  try {
    Quagga?.stop();
  } catch (e) {}
}
