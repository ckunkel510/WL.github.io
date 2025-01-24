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
    <video id="barcode-scanner" style="display: none; width: 300px; height: 200px;"></video>
    <button id="stop-scanner" style="display: none;">Stop Scanner</button>
  `;
  searchBox.parentNode.insertBefore(scannerContainer, searchBox.nextSibling);

  // References to the newly created elements
  const startScannerButton = document.getElementById("start-scanner");
  const stopScannerButton = document.getElementById("stop-scanner");
  const videoElement = document.getElementById("barcode-scanner");

  // Function to start the scanner
  startScannerButton.addEventListener("click", () => {
    videoElement.style.display = "block";
    stopScannerButton.style.display = "inline-block";
    startScannerButton.style.display = "none";

    // Initialize Quagga
    Quagga.init(
      {
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: videoElement, // Target the video element
        },
        decoder: {
          readers: ["upc_reader"], // UPC barcode reader
        },
      },
      function (err) {
        if (err) {
          console.error("Error initializing Quagga:", err);
          return;
        }
        Quagga.start();
      }
    );
  });

  // Stop the scanner
  stopScannerButton.addEventListener("click", () => {
    Quagga.stop();
    videoElement.style.display = "none";
    stopScannerButton.style.display = "none";
    startScannerButton.style.display = "inline-block";
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
    videoElement.style.display = "none";
    stopScannerButton.style.display = "none";
    startScannerButton.style.display = "inline-block";
  });
} else if (!isMobileDevice()) {
  console.log("Barcode scanner functionality is disabled on non-mobile devices.");
} else {
  console.log("Search bar not found. Barcode scanner functionality will not load.");
}
