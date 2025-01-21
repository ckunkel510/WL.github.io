
if (window.location.href.includes("ProductDetail.aspx")) {
  const url = window.location.href;
  const pidMatch = url.match(/pid=([0-9]+)/);

  if (pidMatch && pidMatch[1]) {
    const productId = pidMatch[1];
    const baseFormUrl = "https://docs.google.com/forms/d/e/1FAIpQLSdYfrNw3XYEe6F6kOAbugDwXhgpVA4d4TyopkRCzMRkDDY2eA/viewform";
    const formUrl = `${baseFormUrl}?usp=pp_url&entry.1813578127=${productId}&embedded=true&width=640&height=894`;
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

    // Determine the parent element where the reviews will be appended
    const insertParent = productDescription || footer;

    if (insertParent) {
      insertParent.insertAdjacentElement(productDescription ? "afterend" : "beforebegin", reviewButton);
    } else {
      console.error("Footer or Product Description element not found.");
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

    const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZGjAjfdB4m_XfqFQC3i3-n09g-BlRp_oVBo0sD1eyMV9OlwMFbCaVQ3Urrw6rwWPr9VPu5vDXcMyo/pubhtml";
    const reviewContainer = document.createElement("div");
    reviewContainer.id = "review-widget";
    reviewContainer.innerHTML = `<h3>Customer Reviews</h3><div id="average-rating"></div><ul id="review-list"></ul>`;

    if (insertParent) {
      insertParent.insertAdjacentElement(productDescription ? "afterend" : "beforebegin", reviewContainer);
    }

    fetch(`${sheetUrl}?cacheBust=${new Date().getTime()}`)
      .then((r) => r.text())
      .then((html) => {
        const rows = Array.from(new DOMParser().parseFromString(html, "text/html").querySelectorAll("table tbody tr"));
        const reviews = rows
          .map((r) => {
            const cells = r.querySelectorAll("td");
            return {
              timestamp: cells[0]?.textContent.trim(),
              name: cells[1]?.textContent.trim(),
              stars: parseFloat(cells[2]?.textContent.trim()) || 0,
              comment: cells[3]?.textContent.trim(),
              productId: cells[4]?.textContent.trim()
            };
          })
          .filter((r) => r.productId === productId);

        const totalStars = reviews.reduce((sum, r) => sum + r.stars, 0);
        const averageStars = reviews.length > 0 ? (totalStars / reviews.length).toFixed(1) : "No ratings yet";
        const averageRatingContainer = document.getElementById("average-rating");
        const reviewList = document.getElementById("review-list");

        averageRatingContainer.innerHTML = `<strong>Average Rating:</strong> ${averageStars} ${
          averageStars !== "No ratings yet" ? "!" : ""
        }`;
        reviewList.innerHTML =
          reviews.length > 0
            ? reviews.map((r) => `<li><strong>${r.name}:</strong> ${r.stars} Stars<br><em>${r.comment}</em></li>`).join("")
            : "<li>No reviews for this product yet.</li>";
      })
      .catch((e) => console.error("Error loading reviews:", e));
  } else {
    console.error("Product ID not found in the URL.");
  }
} else {
  console.warn("This script only runs on ProductDetail.aspx pages.");
}
