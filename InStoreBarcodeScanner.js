(function () {
  // ✅ Only activate on mobile devices
  const isMobile = /Android|iPhone|iPad|iPod|Windows Phone|BlackBerry|Mobile/i.test(navigator.userAgent);
  if (!isMobile) return;

  // ✅ Inject overlay if not already there
  if (!document.getElementById("barcode-scan-overlay")) {
    const overlay = document.createElement("div");
    overlay.id = "barcode-scan-overlay";
    overlay.style.cssText = `
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      z-index: 9999;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      color: white;
      font-family: sans-serif;
    `;
    overlay.innerHTML = `
      <video id="barcode-video" autoplay playsinline muted style="width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0;"></video>
      <canvas id="barcode-canvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 2;"></canvas>
      <div id="scan-box" style="position: absolute; top: 50%; left: 50%; width: 60%; height: 20%; transform: translate(-50%, -50%); border: 2px solid #ffffff; z-index: 3;"></div>
      <div id="scan-feedback" style="position: absolute; top: 50%; left: 50%; width: 60%; height: 20%; transform: translate(-50%, -50%); border: 4px solid transparent; z-index: 2; pointer-events: none;"></div>
      <button id="close-barcode-scanner" style="position: absolute; top: 12px; right: 12px; padding: 10px 20px; font-size: 1rem; background: white; color: #6b0016; border: none; border-radius: 5px; font-weight: bold; z-index: 10000;">Close</button>
    `;
    document.body.appendChild(overlay);
  }

  // ✅ Inject scan launch button
  if (!document.getElementById("in-store-barcode-launch")) {
    const container = document.createElement("div");
    container.style.cssText = "margin-top: 20px; display: flex; justify-content: center;";
    container.innerHTML = `
      <input type="button" id="in-store-barcode-launch" style="background: url('https://images-woodsonlumber.sirv.com/Other%20Website%20Images/Scan%20To%20Search.png') no-repeat center center; background-size: contain; width: 60px; height: 60px; border: none; cursor: pointer;" title="Scan Barcode">
    `;
    const target = document.querySelector("#MainLayoutRow") || document.body;
    target.appendChild(container);
  }

  const startBtn = document.getElementById("in-store-barcode-launch");
  const overlay = document.getElementById("barcode-scan-overlay");
  const video = document.getElementById("barcode-video");
  const closeBtn = document.getElementById("close-barcode-scanner");

  let detectedBarcodes = {};
  const minDetections = 3;

  // ✅ Launch scanner on button click
  startBtn?.addEventListener("click", async () => {
    overlay.style.display = "block";
    detectedBarcodes = {};

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      video.srcObject = stream;

      Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: document.querySelector("#barcode-canvas"),
          constraints: { facingMode: "environment" }
        },
        decoder: {
          readers: ["upc_reader"]
        },
        locate: true,
        frequency: 5
      }, function (err) {
        if (err) {
          console.error("Quagga init error:", err);
          overlay.style.display = "none";
          return;
        }
        Quagga.start();
      });

      Quagga.onDetected((result) => {
        const code = result.codeResult.code;
        const errorScore = result.codeResult.decodedCodes.reduce((sum, x) => sum + (x.error || 0), 0);

        if (errorScore > 1.5) return; // Too fuzzy, skip

        detectedBarcodes[code] = (detectedBarcodes[code] || 0) + 1;

        // ✅ Show green feedback
        const feedbackBox = document.getElementById("scan-feedback");
        if (feedbackBox) {
          feedbackBox.style.borderColor = "#00ff00";
          feedbackBox.style.transition = "border-color 0.2s ease-in-out";
          setTimeout(() => {
            feedbackBox.style.borderColor = "transparent";
          }, 300);
        }

        if (detectedBarcodes[code] >= minDetections) {
          Quagga.stop();
          stream.getTracks().forEach(track => track.stop());
          sessionStorage.removeItem("inStoreMode"); // Exit store mode
          window.location.href = `https://webtrack.woodsonlumber.com/Products.aspx?pg=0&searchText=${code}`;
        }
      });

    } catch (err) {
      console.error("Camera access failed:", err);
      overlay.style.display = "none";
    }
  });

  // ✅ Close scanner manually
  closeBtn?.addEventListener("click", () => {
    overlay.style.display = "none";
    Quagga?.stop();
    const stream = video.srcObject;
    if (stream) stream.getTracks().forEach(track => track.stop());
  });

})();
