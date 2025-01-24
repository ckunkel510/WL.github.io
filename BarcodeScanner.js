// Check if the search bar exists on the page
const searchBox = document.getElementById("ctl00_PageHeader_GlobalSearchControl_RadSearchBox1");

// Helper function to detect if the user is on a mobile device
function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Windows Phone|BlackBerry|Mobile/i.test(navigator.userAgent);
}

if (searchBox && isMobileDevice()) {
  // Create and append the scanner container
  const scannerContainer = document.createElement("div");
  scannerContainer.id = "barcode-scanner-container";
  scannerContainer.style.display = "inline-block";
  scannerContainer.innerHTML = `
    <input type="button" id="start-scanner" value="Scan Barcode" />
    <div id="scanner-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); z-index: 9999;">
      <video id="barcode-scanner" autoplay playsinline muted style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 1;"></video>
      <div id="scan-area" style="position: absolute; top: 50%; left: 50%; width: 60%; height: 20%; transform: translate(-50%, -50%); border: 2px solid #00ff00; z-index: 2;"></div>
      <button id="stop-scanner" style="position: absolute; top: 10px; right: 10px; padding: 10px; font-size: 16px; z-index: 10000;">Stop</button>
    </div>
  `;
  searchBox.parentNode.insertBefore(scannerContainer, searchBox.nextSibling);

  // References to the newly created elements
  const startScannerButton = document.getElementById("start-scanner");
  const stopScannerButton = document.getElementById("stop-scanner");
  const scannerOverlay = document.getElementById("scanner-overlay");
  const videoElement = document.getElementById("barcode-scanner");

  // Function to start the scanner
  startScannerButton.addEventListener("click", () => {
    scannerOverlay.style.display = "block";

    // Initialize Quagga with minimal constraints
    Quagga.init(
      {
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: videoElement,
          constraints: {
            video: {
              facingMode: "environment", // Use the back camera
            },
          },
        },
        decoder: {
          readers: ["upc_reader"], // UPC barcode reader
        },
      },
      function (err) {
        if (err) {
          console.error("Error initializing Quagga:", err);
          scannerOverlay.style.display = "none"; // Hide overlay if there's an error
          return;
        }
        Quagga.start();
      }
    );
  });

  // Stop the scanner
  stopScannerButton.addEventListener("click", () => {
    Quagga.stop();
    scannerOverlay.style.display = "none";
  });

  // Handle detected barcode
  Quagga.onDetected((result) => {
    const upcCode = result.codeResult.code;
    console.log("Detected UPC:", upcCode);

    // Redirect to the search URL with the detected UPC
    const searchUrl = `https://webtrack.woodsonlumber.com/Products.aspx?pg=0&searchText=${upcCode}`;
    window.location.href = searchUrl;

    // Stop the scanner after detecting a barcode
    Quagga.stop();
    scannerOverlay.style.display = "none";
  });
} else if (!isMobileDevice()) {
  console.log("Barcode scanner functionality is disabled on non-mobile devices.");
} else {
  console.log("Search bar not found. Barcode scanner functionality will not load.");
}
