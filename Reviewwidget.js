(function () {
  "use strict";

  if (!/ProductDetail\.aspx/i.test(window.location.pathname)) return;

  const params = new URLSearchParams(window.location.search);
  const productId = String(params.get("pid") || params.get("productid") || "").replace(/\D+/g, "");
  if (!productId) return;

  const REVIEW_FORM_URL =
    "https://docs.google.com/forms/d/e/1FAIpQLSdYfrNw3XYEe6F6kOAbugDwXhgpVA4d4TyopkRCzMRkDDY2eA/viewform";
  const REVIEW_SHEET_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZGjAjfdB4m_XfqFQC3i3-n09g-BlRp_oVBo0sD1eyMV9OlwMFbCaVQ3Urrw6rwWPr9VPu5vDXcMyo/pubhtml/sheet?headers=false&gid=220983932";

  function installStyles() {
    if (document.getElementById("wl-product-review-styles")) return;

    const style = document.createElement("style");
    style.id = "wl-product-review-styles";
    style.textContent = `
      #customer-reviews {
        box-sizing: border-box;
        width: 100%;
        margin: 28px 0 8px;
        padding: 24px 0 0;
        color: #202326;
        border-top: 1px solid #dfe2e4;
      }

      #customer-reviews * { box-sizing: border-box; }

      #customer-reviews .wl-review-heading {
        margin: 0 0 12px;
        font-size: 22px;
        font-weight: 750;
        letter-spacing: 0;
      }

      #customer-reviews .wl-review-summary {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        min-height: 28px;
        margin-bottom: 14px;
        color: #4e5357;
        font-size: 14px;
      }

      #customer-reviews .wl-review-stars {
        display: inline-flex;
        gap: 2px;
        color: #b2b6b9;
        font-size: 18px;
        line-height: 1;
      }

      #customer-reviews .wl-review-star.is-filled { color: #b26a00; }

      #customer-reviews .wl-review-list {
        display: grid;
        gap: 10px;
        margin: 0 0 16px;
        padding: 0;
        list-style: none;
      }

      #customer-reviews .wl-review-item {
        padding: 14px 0;
        border-bottom: 1px solid #eceeed;
      }

      #customer-reviews .wl-review-item-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 7px;
      }

      #customer-reviews .wl-review-author {
        color: #202326;
        font-size: 14px;
        font-weight: 700;
      }

      #customer-reviews .wl-review-comment {
        margin: 0;
        color: #454a4f;
        font-size: 14px;
        line-height: 1.5;
      }

      #customer-reviews .wl-review-empty {
        margin: 0 0 16px;
        color: #555b60;
        font-size: 14px;
        line-height: 1.5;
      }

      #review-product-button {
        min-height: 42px;
        padding: 9px 16px;
        color: #fff;
        font-size: 14px;
        font-weight: 700;
        background: #6b0005;
        border: 1px solid #6b0005;
        border-radius: 6px;
        cursor: pointer;
      }

      #review-product-button:hover,
      #review-product-button:focus {
        background: #4f0004;
        border-color: #4f0004;
      }

      .wl-review-modal {
        position: fixed;
        inset: 0;
        z-index: 10050;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(20, 22, 24, 0.62);
      }

      .wl-review-dialog {
        position: relative;
        width: min(720px, 100%);
        height: min(820px, calc(100vh - 36px));
        overflow: hidden;
        background: #fff;
        border-radius: 8px;
        box-shadow: 0 16px 46px rgba(0, 0, 0, 0.3);
      }

      .wl-review-dialog iframe {
        width: 100%;
        height: 100%;
        border: 0;
      }

      .wl-review-close {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 2;
        width: 40px;
        height: 40px;
        padding: 0;
        color: #202326;
        font-size: 20px;
        font-weight: 700;
        background: #fff;
        border: 1px solid #c8cccf;
        border-radius: 50%;
        cursor: pointer;
      }

      @media (max-width: 520px) {
        #customer-reviews { margin-top: 22px; padding-top: 20px; }
        #customer-reviews .wl-review-heading { font-size: 19px; }
        .wl-review-modal { padding: 0; }
        .wl-review-dialog { width: 100%; height: 100%; border-radius: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  function findHeader(headers, candidates) {
    return headers.findIndex(function (header) {
      return candidates.some(function (candidate) {
        return header === candidate || header.includes(candidate);
      });
    });
  }

  function parseReviews(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const table = doc.querySelector("table.waffle") || doc.querySelector("table");
    if (!table) return [];

    const rows = Array.from(table.querySelectorAll("tbody tr"));
    if (rows.length < 2) return [];

    const headers = Array.from(rows[0].querySelectorAll("td,th")).map(function (cell) {
      return String(cell.textContent || "").trim().toLowerCase();
    });
    const columns = {
      name: findHeader(headers, ["name", "reviewer", "customer name"]),
      stars: findHeader(headers, ["stars", "rating", "score", "column 2"]),
      comment: findHeader(headers, ["comment", "review", "feedback"]),
      productId: findHeader(headers, ["productid", "product id", "pid", "product"])
    };

    if (columns.productId === -1 || columns.stars === -1) return [];

    return rows.slice(1).map(function (row) {
      const cells = Array.from(row.querySelectorAll("td,th"));
      const value = function (index) {
        return index < 0 ? "" : String(cells[index]?.textContent || "").trim();
      };
      const stars = Number.parseFloat(value(columns.stars).replace(/[^0-9.]/g, ""));
      return {
        productId: value(columns.productId).replace(/\D+/g, ""),
        name: value(columns.name) || "Anonymous",
        stars: Number.isFinite(stars) ? Math.max(0, Math.min(5, stars)) : 0,
        comment: value(columns.comment)
      };
    }).filter(function (review) {
      return review.productId && review.stars > 0;
    });
  }

  function buildStars(rating, label) {
    const stars = document.createElement("span");
    stars.className = "wl-review-stars";
    stars.setAttribute("role", "img");
    stars.setAttribute("aria-label", label || (rating + " out of 5 stars"));

    const filled = Math.round(rating);
    for (let index = 1; index <= 5; index += 1) {
      const star = document.createElement("span");
      star.className = "wl-review-star" + (index <= filled ? " is-filled" : "");
      star.setAttribute("aria-hidden", "true");
      star.innerHTML = "&#9733;";
      stars.appendChild(star);
    }
    return stars;
  }

  function openReviewForm() {
    if (document.querySelector(".wl-review-modal")) return;

    const formUrl = REVIEW_FORM_URL +
      "?usp=pp_url&entry.1813578127=" + encodeURIComponent(productId) +
      "&embedded=true&width=640&height=894";
    const modal = document.createElement("div");
    modal.className = "wl-review-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Write a product review");
    modal.innerHTML = `
      <div class="wl-review-dialog">
        <button type="button" class="wl-review-close" aria-label="Close review form">X</button>
        <iframe title="Product review form" src="${formUrl}"></iframe>
      </div>
    `;

    const close = function () {
      document.removeEventListener("keydown", onKeydown);
      modal.remove();
    };
    const onKeydown = function (event) {
      if (event.key === "Escape") close();
    };

    modal.querySelector(".wl-review-close").addEventListener("click", close);
    modal.addEventListener("click", function (event) {
      if (event.target === modal) close();
    });
    document.addEventListener("keydown", onKeydown);
    document.body.appendChild(modal);
    modal.querySelector(".wl-review-close").focus();
  }

  function createReviewSection() {
    const section = document.createElement("section");
    section.id = "customer-reviews";
    section.innerHTML = `
      <h2 class="wl-review-heading">Customer reviews</h2>
      <div class="wl-review-summary" aria-live="polite">Loading reviews...</div>
      <ul class="wl-review-list"></ul>
      <p class="wl-review-empty" hidden></p>
      <button type="button" id="review-product-button">Write a review</button>
    `;
    section.querySelector("#review-product-button").addEventListener("click", openReviewForm);
    return section;
  }

  function renderReviews(section, reviews) {
    const summary = section.querySelector(".wl-review-summary");
    const list = section.querySelector(".wl-review-list");
    const empty = section.querySelector(".wl-review-empty");
    const button = section.querySelector("#review-product-button");

    if (!reviews.length) {
      summary.textContent = "No ratings yet";
      list.replaceChildren();
      empty.hidden = false;
      empty.textContent = "Have experience with this product? Help the next customer by sharing it.";
      button.textContent = "Be the first to review";
      return;
    }

    const average = reviews.reduce(function (sum, review) {
      return sum + review.stars;
    }, 0) / reviews.length;
    summary.replaceChildren();
    summary.appendChild(buildStars(average, average.toFixed(1) + " out of 5 stars"));
    summary.appendChild(document.createTextNode(
      average.toFixed(1) + " (" + reviews.length + " review" + (reviews.length === 1 ? "" : "s") + ")"
    ));

    empty.hidden = true;
    list.replaceChildren();
    reviews.forEach(function (review) {
      const item = document.createElement("li");
      item.className = "wl-review-item";
      const head = document.createElement("div");
      head.className = "wl-review-item-head";
      const author = document.createElement("span");
      author.className = "wl-review-author";
      author.textContent = review.name;
      head.append(author, buildStars(review.stars, review.stars + " out of 5 stars"));
      item.appendChild(head);
      if (review.comment) {
        const comment = document.createElement("p");
        comment.className = "wl-review-comment";
        comment.textContent = review.comment;
        item.appendChild(comment);
      }
      list.appendChild(item);
    });
  }

  installStyles();

  const productDescription = document.getElementById("ctl00_PageBody_productDetail_productDescription");
  const footer = document.querySelector(".site-footer");
  const section = createReviewSection();
  if (productDescription) {
    productDescription.insertAdjacentElement("afterend", section);
  } else if (footer) {
    footer.insertAdjacentElement("beforebegin", section);
  } else {
    document.body.appendChild(section);
  }

  fetch(REVIEW_SHEET_URL + "&cacheBust=" + Date.now())
    .then(function (response) {
      if (!response.ok) throw new Error("Review feed returned " + response.status);
      return response.text();
    })
    .then(function (html) {
      const reviews = parseReviews(html).filter(function (review) {
        return review.productId === productId;
      });
      renderReviews(section, reviews);
    })
    .catch(function (error) {
      console.error("Review widget could not load reviews.", error);
      const summary = section.querySelector(".wl-review-summary");
      summary.textContent = "Reviews are temporarily unavailable";
    });

  if (window.location.hash === "#customer-reviews") {
    window.setTimeout(function () {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  }
})();
