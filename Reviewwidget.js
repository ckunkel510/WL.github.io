
(function () {
  if (!/ProductDetail\.aspx/i.test(window.location.href)) {
    console.warn("Review widget: not on ProductDetail.aspx, skipping.");
    return;
  }

  // --- 1) Get productId from URL (pid or productid), normalize to digits only ---
  const usp = new URLSearchParams(window.location.search);
  const rawPid = usp.get("pid") || usp.get("productid");
  if (!rawPid) {
    console.error("Review widget: product ID not found in URL (expected ?pid= or ?productid=).");
    return;
  }
  const productId = (rawPid + "").replace(/\D+/g, ""); // digits only

  // --- 2) Build form button (unchanged) ---
  const baseFormUrl = "https://docs.google.com/forms/d/e/1FAIpQLSdYfrNw3XYEe6F6kOAbugDwXhgpVA4d4TyopkRCzMRkDDY2eA/viewform";
  const formUrl = `${baseFormUrl}?usp=pp_url&entry.1813578127=${encodeURIComponent(productId)}&embedded=true&width=640&height=894`;

  const reviewButton = document.createElement("button");
  reviewButton.id = "review-product-button";
  reviewButton.textContent = "Review this Product";
  Object.assign(reviewButton.style, {
    cursor: "pointer",
    padding: "10px 20px",
    border: "none",
    backgroundColor: "#007BFF",
    color: "white",
    borderRadius: "5px"
  });

  const footer = document.querySelector(".site-footer");
  const productDescription = document.getElementById("ctl00_PageBody_productDetail_productDescription");
  const insertParent = productDescription || footer;

  if (insertParent) {
    insertParent.insertAdjacentElement(productDescription ? "afterend" : "beforebegin", reviewButton);
  } else {
    console.error("Review widget: Footer or Product Description element not found.");
  }

  reviewButton.addEventListener("click", (event) => {
    event.preventDefault();
    const popup = document.createElement("div");
    const closeButton = document.createElement("button");
    const iframe = document.createElement("iframe");

    Object.assign(popup.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: "80%",
      height: "80%",
      backgroundColor: "white",
      boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
      borderRadius: "10px",
      overflow: "hidden",
      zIndex: "1000"
    });

    closeButton.textContent = "X";
    Object.assign(closeButton.style, {
      position: "absolute",
      top: "10px",
      right: "10px",
      border: "none",
      backgroundColor: "red",
      color: "white",
      borderRadius: "50%",
      width: "30px",
      height: "30px",
      cursor: "pointer"
    });

    closeButton.onclick = () => document.body.removeChild(popup);

    iframe.src = formUrl;
    iframe.width = "100%";
    iframe.height = "100%";
    iframe.style.border = "none";

    popup.append(closeButton, iframe);
    document.body.appendChild(popup);
  });

  // --- 3) Reviews container ---
  const reviewContainer = document.createElement("div");
  reviewContainer.id = "review-widget";
  reviewContainer.innerHTML = `
    <h3>Customer Reviews</h3>
    <div id="average-rating"></div>
    <ul id="review-list"></ul>
  `;
  if (insertParent) {
    insertParent.insertAdjacentElement(productDescription ? "afterend" : "beforebegin", reviewContainer);
  }

  // --- 4) Fetch the published sheet (use the RIGHT gid for your Reviews tab) ---
  // Get the gid from the Reviews tab URL in Google Sheets (File > Share > Publish to web > pick that tab).
  // Example with gid placeholder:
  const SHEET_PUBHTML =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZGjAjfdB4m_XfqFQC3i3-n09g-BlRp_oVBo0sD1eyMV9OlwMFbCaVQ3Urrw6rwWPr9VPu5vDXcMyo/pubhtml";

  fetch(`${SHEET_PUBHTML}&cacheBust=${Date.now()}`)
    .then(r => r.text())
    .then(html => {
      const doc = new DOMParser().parseFromString(html, "text/html");

      // Prefer the waffle table Google uses; fall back to any table.
      let table = doc.querySelector("table.waffle") || doc.querySelector("table");
      if (!table) {
        console.warn("Review widget: no table found in published sheet. Check publish settings / gid.");
        showNoReviews("No reviews yet.");
        return;
      }

      const rows = Array.from(table.querySelectorAll("tbody tr"));
      if (!rows.length) {
        console.warn("Review widget: no rows found in published sheet.");
        showNoReviews("No reviews yet.");
        return;
      }

      // --- 5) Map columns by header names (don’t rely on fixed indices) ---
      const headerCells = Array.from(rows[0].querySelectorAll("td,th")).map(td =>
        (td.textContent || "").trim().toLowerCase()
      );

      // Flexible header matching (adjust these if your header labels differ)
      const colIdx = {
        timestamp: findHeader(headerCells, ["timestamp", "date", "submitted"]),
        name:      findHeader(headerCells, ["name", "reviewer", "customer name"]),
        stars:     findHeader(headerCells, ["stars", "rating", "score"]),
        comment:   findHeader(headerCells, ["comment", "review", "feedback"]),
        productId: findHeader(headerCells, ["productid", "product id", "pid"])
      };

      // If we didn’t find a productId column, we’re on the wrong tab or headers changed
      if (colIdx.productId === -1) {
        console.warn("Review widget: could not locate ProductID column. Verify the gid points to the Reviews tab and header names.");
        showNoReviews("No reviews yet.");
        return;
      }

      // Parse data rows (skip header row)
      const dataRows = rows.slice(1).map(tr => {
        const tds = tr.querySelectorAll("td");
        const get = (i) => (tds[i]?.textContent || "").trim();
        return {
          timestamp: getSafe(get, colIdx.timestamp),
          name: getSafe(get, colIdx.name),
          stars: toNumber(getSafe(get, colIdx.stars)),
          comment: getSafe(get, colIdx.comment),
          productId: (getSafe(get, colIdx.productId) + "").replace(/\D+/g, "") // normalize to digits
        };
      }).filter(r => r.productId); // only rows with a productId

      // Filter to this product
      const reviews = dataRows.filter(r => r.productId === productId);

      const averageRatingContainer = document.getElementById("average-rating");
      const reviewList = document.getElementById("review-list");

      if (!reviews.length) {
        averageRatingContainer.innerHTML = `<strong>Average Rating:</strong> No ratings yet`;
        reviewList.innerHTML = `<li>No reviews for this product yet.</li>`;
        return;
      }

      const totalStars = reviews.reduce((sum, r) => sum + (r.stars || 0), 0);
      const avg = (totalStars / reviews.length).toFixed(1);

      averageRatingContainer.innerHTML = `<strong>Average Rating:</strong> ${avg}`;
      reviewList.innerHTML = reviews
        .map(r => `<li><strong>${escapeHtml(r.name || "Anonymous")}:</strong> ${r.stars || 0} Stars<br><em>${escapeHtml(r.comment || "")}</em></li>`)
        .join("");

      // Helpers
      function showNoReviews(msg) {
        const avg = document.getElementById("average-rating");
        const list = document.getElementById("review-list");
        if (avg) avg.innerHTML = `<strong>Average Rating:</strong> No ratings yet`;
        if (list) list.innerHTML = `<li>${msg}</li>`;
      }

      function findHeader(headers, candidates) {
        const idx = headers.findIndex(h =>
          candidates.some(c => h === c || h.includes(c))
        );
        return idx === -1 ? -1 : idx;
      }

      function getSafe(get, idx) {
        return idx === -1 ? "" : get(idx);
      }

      function toNumber(v) {
        const n = parseFloat((v || "").replace(/[^0-9.]/g, ""));
        return isNaN(n) ? 0 : n;
      }

      function escapeHtml(s) {
        return (s || "").replace(/[&<>"']/g, c => ({
          "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
      }
    })
    .catch(e => {
      console.error("Review widget: error loading reviews:", e);
      const avg = document.getElementById("average-rating");
      const list = document.getElementById("review-list");
      if (avg) avg.textContent = "Average Rating: No ratings yet";
      if (list) list.innerHTML = "<li>Unable to load reviews right now.</li>";
    });
})();


