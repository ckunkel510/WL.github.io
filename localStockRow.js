(function () {
  "use strict";

  const stores = [
    { name: "Brenham", lat: 30.1669, lon: -96.3977 },
    { name: "Bryan", lat: 30.6744, lon: -96.3743 },
    { name: "Caldwell", lat: 30.5316, lon: -96.6939 },
    { name: "Lexington", lat: 30.4152, lon: -97.0105 },
    { name: "Groesbeck", lat: 31.5249, lon: -96.5336 },
    { name: "Mexia", lat: 31.6791, lon: -96.4822 },
    { name: "Buffalo", lat: 31.4632, lon: -96.0580 }
  ];
  const DEFAULT_STORE = "Groesbeck";
  const MAX_CONCURRENT_STOCK_REQUESTS = 6;
  const LOCATION_STORE_KEY = "wlNearestStoreV1";
  const LOCATION_ATTEMPT_KEY = "wlLocationAttemptedAtV1";
  const LOCATION_CACHE_MS = 24 * 60 * 60 * 1000;
  let storeContextPromise;
  let activeStockRequests = 0;
  const stockRequestQueue = [];

  function getProductId(card) {
    const href = card.querySelector("#ProductImageRow a")?.href || "";
    const match = href.match(/[?&]pid=(\d+)/i);
    return match ? match[1] : "";
  }

  function ensureStockRow(card) {
    let row = card.querySelector("#LocalStockRow");
    if (row) return row;

    const quantityRow = card.querySelector("#QuantityRow");
    if (!quantityRow || !quantityRow.parentNode) return null;

    row = document.createElement("tr");
    row.id = "LocalStockRow";
    const cell = document.createElement("td");
    cell.colSpan = 1;
    const message = document.createElement("div");
    message.className = "wl-stock-message wl-stock-message--loading";
    message.textContent = "Checking local stock...";
    cell.appendChild(message);
    row.appendChild(cell);
    quantityRow.parentNode.insertBefore(row, quantityRow.nextSibling);
    return row;
  }

  function setStockMessage(card, text, state) {
    const row = ensureStockRow(card);
    if (!row) return;

    const cell = row.querySelector("td") || row.appendChild(document.createElement("td"));
    let message = cell.querySelector(".wl-stock-message");
    if (!message) {
      cell.replaceChildren();
      message = document.createElement("div");
      cell.appendChild(message);
    }
    message.className = "wl-stock-message wl-stock-message--" + state;
    message.textContent = text;
  }

  async function getSignedInBranch() {
    try {
      const response = await fetch("/AccountSettings.aspx?cms=1", { credentials: "include" });
      if (!response.ok) return "";
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const dropdown = doc.querySelector("#ctl00_PageBody_ChangeUserDetailsControl_ddBranch");
      const selected = dropdown?.querySelector("option:checked, option[selected='selected']");
      return selected?.textContent.trim() || "";
    } catch (error) {
      return "";
    }
  }

  function normalizeStoreName(value) {
    const text = String(value || "").trim().toLowerCase();
    const match = stores.find(function (store) {
      return text.indexOf(store.name.toLowerCase()) !== -1;
    });
    return match ? match.name : "";
  }

  function getRememberedStore() {
    try {
      const sessionStore = normalizeStoreName(
        sessionStorage.getItem("wlDetectedStore") ||
        sessionStorage.getItem("storeName") ||
        sessionStorage.getItem("storeBranchKey")
      );
      if (sessionStore) return sessionStore;

      const cached = JSON.parse(localStorage.getItem(LOCATION_STORE_KEY) || "null");
      if (cached && Date.now() - Number(cached.savedAt || 0) < LOCATION_CACHE_MS) {
        return normalizeStoreName(cached.store);
      }
    } catch (error) {}
    return "";
  }

  function rememberStore(storeName) {
    const normalized = normalizeStoreName(storeName);
    if (!normalized) return;
    try { sessionStorage.setItem("wlDetectedStore", normalized); } catch (error) {}
    try { localStorage.setItem(LOCATION_STORE_KEY, JSON.stringify({ store: normalized, savedAt: Date.now() })); } catch (error) {}
  }

  function locationWasRecentlyAttempted() {
    try {
      const attemptedAt = Number(
        sessionStorage.getItem(LOCATION_ATTEMPT_KEY) ||
        localStorage.getItem(LOCATION_ATTEMPT_KEY) ||
        0
      );
      return attemptedAt > 0 && Date.now() - attemptedAt < LOCATION_CACHE_MS;
    } catch (error) {
      return false;
    }
  }

  function markLocationAttempt() {
    try { sessionStorage.setItem(LOCATION_ATTEMPT_KEY, String(Date.now())); } catch (error) {}
    try { localStorage.setItem(LOCATION_ATTEMPT_KEY, String(Date.now())); } catch (error) {}
  }

  async function getNearestStoreBranch() {
    if (!navigator.geolocation) return "";
    const rememberedStore = getRememberedStore();
    if (rememberedStore) return rememberedStore;
    if (locationWasRecentlyAttempted()) return "";
    markLocationAttempt();

    try {
      const position = await new Promise(function (resolve, reject) {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 30 * 60 * 1000
        });
      });

      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      let nearest = stores[0];
      let nearestDistance = Infinity;
      stores.forEach(function (store) {
        const distance = haversine(latitude, longitude, store.lat, store.lon);
        if (distance < nearestDistance) {
          nearest = store;
          nearestDistance = distance;
        }
      });
      rememberStore(nearest.name);
      return nearest.name;
    } catch (error) {
      return "";
    }
  }

  function getStoreContext() {
    if (storeContextPromise) return storeContextPromise;
    storeContextPromise = (async function () {
      const signedInBranch = await getSignedInBranch();
      const branch = signedInBranch || (await getNearestStoreBranch()) || DEFAULT_STORE;
      return { branch: branch, useActualColumn: Boolean(signedInBranch) };
    })();
    return storeContextPromise;
  }

  async function loadStockForCard(card) {
    if (card.dataset.wlStockLoaded === "true") return;
    card.dataset.wlStockLoaded = "true";

    const productId = getProductId(card);
    if (!productId) return;

    ensureStockRow(card);
    const context = await getStoreContext();
    setStockMessage(card, "Checking " + context.branch + " stock...", "loading");

    try {
      const response = await fetch("/Catalog/ShowStock.aspx?productid=" + encodeURIComponent(productId), {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Stock request returned " + response.status);

      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const table = doc.querySelector("#StockDataGrid_ctl00");
      if (!table) throw new Error("Stock table was not found");

      const columnIndex = context.useActualColumn ? 4 : 2;
      let rawQuantity = null;
      Array.from(table.querySelectorAll("tr")).some(function (row) {
        const cells = row.querySelectorAll("td");
        if (!cells.length) return false;
        if (cells[0].textContent.trim().toLowerCase() !== context.branch.toLowerCase()) return false;
        rawQuantity = cells[columnIndex]?.textContent.trim() || "";
        return true;
      });

      if (rawQuantity == null) {
        setStockMessage(card, "Check store availability on the product page", "unavailable");
        return;
      }

      const numericMatch = rawQuantity.replace(/,/g, "").match(/-?\d+/);
      const quantity = numericMatch ? Number.parseInt(numericMatch[0], 10) : null;
      const noStock = /no stock/i.test(rawQuantity) || quantity === 0;
      if (noStock) {
        setStockMessage(
          card,
          "0 in stock at " + context.branch + ". Ship to your store for free pickup at checkout.",
          "pickup"
        );
        return;
      }

      setStockMessage(card, rawQuantity + " in stock at " + context.branch, "available");
    } catch (error) {
      console.warn("[LocalStock] Stock unavailable for product " + productId, error);
      setStockMessage(card, "Check store availability on the product page", "unavailable");
    }
  }

  function drainStockRequestQueue() {
    while (activeStockRequests < MAX_CONCURRENT_STOCK_REQUESTS && stockRequestQueue.length) {
      const card = stockRequestQueue.shift();
      activeStockRequests += 1;
      loadStockForCard(card).finally(function () {
        activeStockRequests -= 1;
        drainStockRequestQueue();
      });
    }
  }

  function queueStockForCard(card) {
    stockRequestQueue.push(card);
    drainStockRequestQueue();
  }

  function registerCards(root) {
    const cards = root.querySelectorAll
      ? root.querySelectorAll("#productlistcards table.ProductCard")
      : [];
    cards.forEach(function (card) {
      if (card.dataset.wlStockRegistered === "true") return;
      card.dataset.wlStockRegistered = "true";
      ensureStockRow(card);
      queueStockForCard(card);
    });
  }

  function initialize() {
    registerCards(document);
    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.matches && node.matches("#productlistcards table.ProductCard")) {
            registerCards(node.parentElement || document);
          }
          registerCards(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const toRadians = function (degrees) {
      return (degrees * Math.PI) / 180;
    };
    const earthRadiusMiles = 3958.8;
    const latitudeDistance = toRadians(lat2 - lat1);
    const longitudeDistance = toRadians(lon2 - lon1);
    const value =
      Math.sin(latitudeDistance / 2) ** 2 +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
      Math.sin(longitudeDistance / 2) ** 2;
    return earthRadiusMiles * 2 * Math.asin(Math.sqrt(value));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
