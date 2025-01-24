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
    <input type="button" id="start-scanner" style="background: url('https://images-woodsonlumber.sirv.com/Other%20Website%20Images/Scan%20To%20Search.png') no-repeat center center; background-size: contain; width: 25px; height: 25px; border: none; cursor: pointer;" />
    <div id="scanner-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); z-index: 9999;">
      <video id="manual-video-feed" autoplay playsinline muted style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 1;"></video>
      <canvas id="quagga-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 2;"></canvas>
      <div id="scan-area" style="position: absolute; top: 50%; left: 50%; width: 60%; height: 20%; transform: translate(-50%, -50%); border: 2px solid #00ff00; z-index: 3;"></div>
      <button id="stop-scanner" style="position: absolute; top: 10px; right: 10px; padding: 10px; font-size: 16px; z-index: 10000;">Stop</button>
    </div>
  `;
  searchBox.parentNode.insertBefore(scannerContainer, searchBox.nextSibling);

  // References to the newly created elements
  const startScannerButton = document.getElementById("start-scanner");
  const stopScannerButton = document.getElementById("stop-scanner");
  const scannerOverlay = document.getElementById("scanner-overlay");
  const videoElement = document.getElementById("manual-video-feed");

  // Validation: Store detected barcodes and only accept repeated ones
  let detectedBarcodes = {};
  const minDetectionsRequired = 3; // Number of consistent detections needed to confirm

  // Function to start the scanner
  startScannerButton.addEventListener("click", async () => {
    scannerOverlay.style.display = "block";

    try {
      // Start manual video feed
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Use back camera
        },
      });

      // Attach the stream to the video element
      videoElement.srcObject = stream;

      // Initialize Quagga
      Quagga.init(
        {
          inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.getElementById("quagga-overlay"), // Attach Quagga to the canvas
            constraints: {
              video: {
                facingMode: "environment",
              },
            },
          },
          decoder: {
            readers: ["upc_reader"], // UPC barcode reader
          },
          locate: true, // Improve detection accuracy by locating the barcode first
          frequency: 5, // Process every 5th frame to reduce noise
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
    } catch (err) {
      console.error("Error accessing the camera:", err);
      scannerOverlay.style.display = "none"; // Hide overlay if camera access fails
    }
  });

  // Stop the scanner
  stopScannerButton.addEventListener("click", () => {
    // Stop the manual video feed
    const stream = videoElement.srcObject;
    if (stream) {
      const tracks = stream.getTracks();
      tracks.forEach((track) => track.stop());
    }

    // Stop Quagga
    Quagga.stop();
    scannerOverlay.style.display = "none";
  });

  // Handle detected barcode
  Quagga.onDetected((result) => {
    const detectedCode = result.codeResult.code;
    const confidence = result.codeResult.decodedCodes.reduce((sum, code) => sum + code.error, 0);

    console.log("Detected Code:", detectedCode);
    console.log("Detection Confidence:", confidence);

    // Ignore low-confidence detections
    if (confidence > 0.5) {
      console.warn("Low-confidence detection ignored:", detectedCode);
      return;
    }

    // Count detections of the same code
    if (!detectedBarcodes[detectedCode]) {
      detectedBarcodes[detectedCode] = 1;
    } else {
      detectedBarcodes[detectedCode]++;
    }

    // If the same code is detected consistently, confirm it
    if (detectedBarcodes[detectedCode] >= minDetectionsRequired) {
      console.log("Confirmed Code:", detectedCode);

      // Redirect to the search URL
      const searchUrl = `https://webtrack.woodsonlumber.com/Products.aspx?pg=0&searchText=${detectedCode}`;
      window.location.href = searchUrl;

      // Reset detections to prevent multiple redirects
      detectedBarcodes = {};
      Quagga.stop();
    }
  });
} else if (!isMobileDevice()) {
  console.log("Barcode scanner functionality is disabled on non-mobile devices.");
} else {
  console.log("Search bar not found. Barcode scanner functionality will not load.");
}
