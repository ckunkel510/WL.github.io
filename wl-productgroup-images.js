/* wl-productgroup-images.js
   Inject custom Product Group images on Products.aspx using a Google Sheet (Sheet1).
   - Map ProductGroupID -> ImageURL
   - If mapping exists, replace the card's <img.productGroupImage> src
   - Otherwise, keep WebTrack defaults

   Requirements:
   - Publish your Google Sheet to the web as CSV (Sheet1).
   - Provide the CSV URL below (SHEET_CSV_URL).

   Recommended sheet columns (header row):
   - ProductGroupID
   - ImageURL

   Notes:
   - WebTrack repeats IDs (invalid HTML), so we avoid getElementById and use querySelectorAll.
*/

(function WL_ProductGroupImageOverride() {
  // ---------- CONFIG ----------
  const CONFIG = {
    // 1) Put your published CSV URL here (Sheet1).
    // Example format:
    // https://docs.google.com/spreadsheets/d/e/XXXX/pub?output=csv&gid=0
    SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS-3Rdml5LGrt8dn1yzvZJYqHQDn0BIXrUjycLG_Q0xtu7c-OcVTnO5BvhjXFb2o0H4zlC2lThUUx0V/pub?output=csv",

    // 2) Column names in the CSV header row:
    COL_GROUP_ID: "ProductGroupID",
    COL_IMAGE_URL: "ImageURL",

    // 3) Cache behavior (localStorage)
    CACHE_KEY: "__WL_PGIMG_CACHE_V1__",
    CACHE_TTL_MS: 6 * 60 * 60 * 1000, // 6 hours

    // 4) If you want this to only run on the Products.aspx homepage (no pl1/pg), set true.
    // Otherwise it runs on Products.aspx for homepage AND internal group pages.
    HOMEPAGE_ONLY: false,

    // 5) Safety: only override if URL looks like an image
    ALLOW_NON_IMAGE_URLS: false
  };

  // ---------- PAGE GATING ----------
  const path = (location.pathname.split("/").pop() || "").toLowerCase();
  if (path !== "products.aspx") return;

  if (CONFIG.HOMEPAGE_ONLY) {
    const qs = new URLSearchParams(location.search);
    const isHomepage = !qs.has("pl1") && !qs.has("pg");
    if (!isHomepage) return;
  }

  if (window.__WL_PGIMG_LOADED__) return;
  window.__WL_PGIMG_LOADED__ = true;

  // ---------- HELPERS ----------
  function now() {
    return Date.now();
  }

  function isProbablyImageUrl(url) {
    if (CONFIG.ALLOW_NON_IMAGE_URLS) return true;
    const u = (url || "").toLowerCase().split("?")[0];
    return (
      u.endsWith(".jpg") ||
      u.endsWith(".jpeg") ||
      u.endsWith(".png") ||
      u.endsWith(".webp") ||
      u.endsWith(".gif") ||
      u.endsWith(".bmp")
    );
  }

  function safeTrim(s) {
    return (s == null) ? "" : String(s).trim();
  }

  // Minimal CSV parser that supports quoted fields and commas inside quotes
  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"' && inQuotes && next === '"') {
        // Escaped quote
        cur += '"';
        i++;
        continue;
      }

      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (ch === "," && !inQuotes) {
        row.push(cur);
        cur = "";
        continue;
      }

      if ((ch === "\n" || ch === "\r") && !inQuotes) {
        // handle CRLF or LF
        if (ch === "\r" && next === "\n") i++;
        row.push(cur);
        cur = "";
        // ignore completely empty trailing row
        if (row.some(cell => cell !== "")) rows.push(row);
        row = [];
        continue;
      }

      cur += ch;
    }

    // last cell
    row.push(cur);
    if (row.some(cell => cell !== "")) rows.push(row);

    return rows;
  }

  function buildMapFromCsv(csvText) {
    const rows = parseCsv(csvText);
    if (!rows.length) return new Map();

    const header = rows[0].map(h => safeTrim(h));
    const idxGroup = header.findIndex(h => h.toLowerCase() === CONFIG.COL_GROUP_ID.toLowerCase());
    const idxUrl = header.findIndex(h => h.toLowerCase() === CONFIG.COL_IMAGE_URL.toLowerCase());

    if (idxGroup === -1 || idxUrl === -1) {
      console.warn("[WL_PGIMG] CSV is missing required columns:", CONFIG.COL_GROUP_ID, CONFIG.COL_IMAGE_URL);
      return new Map();
    }

    const map = new Map();

    for (let r = 1; r < rows.length; r++) {
      const groupIdRaw = safeTrim(rows[r][idxGroup]);
      const url = safeTrim(rows[r][idxUrl]);

      if (!groupIdRaw || !url) continue;

      // group IDs are numeric, but keep as string key
      const key = groupIdRaw.replace(/[^\d-]/g, "");
      if (!key) continue;

      if (!isProbablyImageUrl(url)) continue;

      map.set(key, url);
    }

    return map;
  }

  function loadCache() {
    try {
      const raw = localStorage.getItem(CONFIG.CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.expiresAt || !parsed.data) return null;
      if (now() > parsed.expiresAt) return null;

      // data stored as [ [k,v], ... ]
      return new Map(parsed.data);
    } catch (e) {
      return null;
    }
  }

  function saveCache(map) {
    try {
      const payload = {
        expiresAt: now() + CONFIG.CACHE_TTL_MS,
        data: Array.from(map.entries())
      };
      localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify(payload));
    } catch (e) {
      // ignore
    }
  }

  async function fetchGroupImageMap() {
    const cached = loadCache();
    if (cached && cached.size) return cached;

    const url = CONFIG.SHEET_CSV_URL;
    if (!url || url.includes("PASTE_YOUR_PUBLISHED")) {
      console.warn("[WL_PGIMG] Missing SHEET_CSV_URL in config.");
      return new Map();
    }

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("CSV fetch failed: " + res.status);

    const text = await res.text();
    const map = buildMapFromCsv(text);
    if (map.size) saveCache(map);
    return map;
  }

  function getPgFromCard(cardEl) {
    // Grab the first anchor that looks like the card link; parse pg=#### from href.
    const a = cardEl.querySelector('a[href*="Products.aspx"]');
    if (!a) return null;

    try {
      const href = a.getAttribute("href") || "";
      // handle relative href by using current origin as base
      const abs = new URL(href, location.origin);
      const pg = abs.searchParams.get("pg");
      return pg ? String(pg) : null;
    } catch (e) {
      return null;
    }
  }

  function applyImages(map) {
    // Card wrapper in your markup
    const cards = document.querySelectorAll('fieldset[id="productGroupCard"]');
    if (!cards.length) return;

    let replaced = 0;

    cards.forEach(card => {
      const pg = getPgFromCard(card);
      if (!pg) return;

      const customUrl = map.get(pg);
      if (!customUrl) return;

      const img = card.querySelector("img.productGroupImage");
      if (!img) return;

      // If it’s already set to this, skip
      const current = (img.getAttribute("src") || "").trim();
      if (current === customUrl) return;

      img.setAttribute("loading", "lazy");
      img.setAttribute("decoding", "async");
      img.setAttribute("referrerpolicy", "no-referrer");

      img.src = customUrl;
      replaced++;
    });

    if (replaced) {
      console.log(`[WL_PGIMG] Replaced ${replaced} product group images.`);
    }
  }

  // ---------- RUN ----------
  (async function init() {
    try {
      const map = await fetchGroupImageMap();
      if (!map.size) return;

      // Apply once now
      applyImages(map);

      // If WebTrack does partial updates, keep a lightweight observer
      const obs = new MutationObserver(() => applyImages(map));
      obs.observe(document.body, { childList: true, subtree: true });
    } catch (err) {
      console.warn("[WL_PGIMG] Failed to apply custom product group images:", err);
    }
  })();
})();
