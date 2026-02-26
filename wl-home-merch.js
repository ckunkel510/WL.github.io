/* wl-home-merch.js
   Homepage merchandising + personalization for Products.aspx
   - Tracks visited Product Groups (pg) across pagination and direct landings
   - Pulls affinity mapping from a published Google Sheet CSV
   - Injects a hero + shelves on Products.aspx homepage only (no pl1/pg)

   Affinity Sheet format (CSV headers):
   Option A (recommended):
     ProductGroupID, RelatedGroupIDs
       - RelatedGroupIDs is a comma-separated list (e.g., "2353,2371,2354")

   Option B:
     ProductGroupID, Related1, Related2, Related3 ... (any number of columns)
*/

(function WL_HomeMerch() {
  // ---------------- CONFIG ----------------
  const CFG = {
    // HERO (temporary)
    HERO_IMAGE: "https://images-woodsonlumber.sirv.com/Emailimages/Dark-Walnut.jpg",
    HERO_LINK: "/Products.aspx?pl1=4546&pg=4546&sort=StockClassSort&direction=asc", // example: Deals (adjust anytime)
    HERO_TITLE: "Featured",
    HERO_SUBTITLE: "Shop current specials",

    // AFFINITY SHEET (published CSV URL)
    // Example:
    // https://docs.google.com/spreadsheets/d/e/XXXX/pub?output=csv&gid=0
    AFFINITY_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRQWZZ6H1UvsAhO8o29StEflcyS_ssW0lQxRg0LA9NucM9oyAl6gG8jZJfVaIG6nYiZ80Fw2NXldNWD/pub?output=csv",

    // LocalStorage keys
    LS_RECENT: "__WL_RECENT_GROUPS_V1__",
    LS_INTENT: "__WL_INTENT_GROUPS_V1__",
    LS_AFF_CACHE: "__WL_AFFINITY_CACHE_V1__",

    // Limits / TTL
    RECENT_LIMIT: 16,
    AFFINITY_CACHE_TTL_MS: 12 * 60 * 60 * 1000, // 12 hours

    // Home shelves
    SHELF_RECENT_COUNT: 10,
    SHELF_RECO_COUNT: 12,

    // If true, hides the default WebTrack cards on homepage (keeps everything on lower pages unchanged)
    HIDE_DEFAULT_CARDS_ON_HOMEPAGE: false
  };

  // ---------------- PAGE GATING ----------------
  const file = (location.pathname.split("/").pop() || "").toLowerCase();
  const isProducts = file === "products.aspx";
  if (!isProducts) return;

  const qs = new URLSearchParams(location.search);
  const isHomepage = !qs.has("pl1") && !qs.has("pg");

  // Prevent double run
  if (window.__WL_HOME_MERCH_LOADED__) return;
  window.__WL_HOME_MERCH_LOADED__ = true;

  // ---------------- UTILS ----------------
  const now = () => Date.now();
  const trim = (s) => (s == null ? "" : String(s).trim());

  function safeJsonParse(raw, fallback) {
    try { return JSON.parse(raw); } catch { return fallback; }
  }

  function getAbsUrl(href) {
    try { return new URL(href, location.origin).toString(); } catch { return null; }
  }

  function getGroupIdFromHref(href) {
    try {
      const u = new URL(href, location.origin);
      const pg = u.searchParams.get("pg");
      return pg ? String(pg) : null;
    } catch {
      return null;
    }
  }

  function normalizeGroupId(id) {
    const s = String(id || "").replace(/[^\d-]/g, "");
    return s || null;
  }

  function getCardMetaFromAnchor(a) {
    // Try to locate the surrounding card and pull title/image
    const href = a.getAttribute("href") || "";
    const abs = getAbsUrl(href);
    const pg = getGroupIdFromHref(href);
    if (!pg || !abs) return null;

    // Title: prefer anchor text, fallback to header link text
    let title = trim(a.textContent);
    const card = a.closest('fieldset[id="productGroupCard"]') || a.closest("fieldset") || null;
    if (card && !title) {
      const headerA = card.querySelector('#ProductGroupCardHeader a');
      if (headerA) title = trim(headerA.textContent);
    }

    // Image: whatever is currently on the DOM (may already be replaced by your image override script)
    let img = null;
    if (card) {
      const imgEl = card.querySelector("img.productGroupImage");
      if (imgEl) img = trim(imgEl.getAttribute("src") || "");
    }

    return {
      pg: String(pg),
      title: title || "Shop",
      link: abs.replace(location.origin, ""), // keep relative
      img: img || "",
      ts: now()
    };
  }

  // ---------------- TRACKING ENGINE ----------------
  function loadRecent() {
    const arr = safeJsonParse(localStorage.getItem(CFG.LS_RECENT), []);
    return Array.isArray(arr) ? arr : [];
  }

  function saveRecent(arr) {
    localStorage.setItem(CFG.LS_RECENT, JSON.stringify(arr));
  }

  function bumpIntent(pg) {
    const key = CFG.LS_INTENT;
    const obj = safeJsonParse(localStorage.getItem(key), {});
    const gid = normalizeGroupId(pg);
    if (!gid) return;

    obj[gid] = (obj[gid] || 0) + 1;
    localStorage.setItem(key, JSON.stringify(obj));
  }

  function recordGroupVisit(meta) {
    if (!meta || !meta.pg) return;

    const gid = normalizeGroupId(meta.pg);
    if (!gid) return;

    // Intent score
    bumpIntent(gid);

    // Recent list (dedupe by pg)
    let recent = loadRecent();
    recent = recent.filter(x => x && String(x.pg) !== String(gid));
    recent.unshift({ ...meta, pg: gid, ts: now() });

    if (recent.length > CFG.RECENT_LIMIT) recent = recent.slice(0, CFG.RECENT_LIMIT);
    saveRecent(recent);
  }

  // 1) Track clicks on any product group card link (works across pagination)
  function wireClickTracking() {
    document.addEventListener("click", function (e) {
      const a = e.target && e.target.closest
        ? e.target.closest('a[href*="Products.aspx"]')
        : null;
      if (!a) return;

      const pg = getGroupIdFromHref(a.getAttribute("href") || "");
      if (!pg) return;

      // Only track group navigation clicks (links that include pg=)
      const meta = getCardMetaFromAnchor(a);
      if (meta) recordGroupVisit(meta);
    }, true);
  }

  // 2) Track landing on a group page (Products.aspx?pl1=..&pg=..)
  function trackLandingVisit() {
    const pg = qs.get("pg");
    if (!pg) return;

    // Build meta from the page itself (title fallback)
    const titleGuess =
      trim(document.querySelector("h1, .PageTitle, .page-title, #PageTitle")?.textContent) ||
      trim(document.querySelector('span[id*="ProductGroup"]')?.textContent) ||
      "Shop";

    const link = location.pathname + location.search;

    // Try to find a hero-ish image on page; otherwise leave blank
    let img = "";
    const firstCardImg = document.querySelector('fieldset[id="productGroupCard"] img.productGroupImage');
    if (firstCardImg) img = trim(firstCardImg.getAttribute("src") || "");

    recordGroupVisit({
      pg: String(pg),
      title: titleGuess,
      link,
      img,
      ts: now()
    });
  }

  // ---------------- AFFINITY SHEET FETCH ----------------
  function loadAffinityCache() {
    const raw = localStorage.getItem(CFG.LS_AFF_CACHE);
    const parsed = safeJsonParse(raw, null);
    if (!parsed || !parsed.expiresAt || !parsed.map) return null;
    if (now() > parsed.expiresAt) return null;
    return parsed.map; // plain object: { "18": ["2353","2371"] }
  }

  function saveAffinityCache(mapObj) {
    const payload = {
      expiresAt: now() + CFG.AFFINITY_CACHE_TTL_MS,
      map: mapObj
    };
    localStorage.setItem(CFG.LS_AFF_CACHE, JSON.stringify(payload));
  }

  // Lightweight CSV parse (quoted fields supported)
  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"' && inQuotes && next === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { inQuotes = !inQuotes; continue; }

      if (ch === "," && !inQuotes) { row.push(cur); cur = ""; continue; }

      if ((ch === "\n" || ch === "\r") && !inQuotes) {
        if (ch === "\r" && next === "\n") i++;
        row.push(cur); cur = "";
        if (row.some(c => c !== "")) rows.push(row);
        row = [];
        continue;
      }

      cur += ch;
    }
    row.push(cur);
    if (row.some(c => c !== "")) rows.push(row);
    return rows;
  }

  async function fetchAffinityMap() {
    const cached = loadAffinityCache();
    if (cached) return cached;

    const url = CFG.AFFINITY_CSV_URL;
    if (!url || url.includes("PASTE_YOUR_AFFINITY")) {
      return {}; // no affinity configured yet
    }

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Affinity CSV fetch failed: " + res.status);

    const csv = await res.text();
    const rows = parseCsv(csv);
    if (!rows.length) return {};

    const header = rows[0].map(h => trim(h));
    const idxId = header.findIndex(h => h.toLowerCase() === "productgroupid");
    const idxRelatedList = header.findIndex(h => h.toLowerCase() === "relatedgroupids");

    const mapObj = {};

    for (let r = 1; r < rows.length; r++) {
      const idRaw = idxId >= 0 ? trim(rows[r][idxId]) : "";
      const id = normalizeGroupId(idRaw);
      if (!id) continue;

      let related = [];

      if (idxRelatedList >= 0) {
        // Option A: comma-separated list in RelatedGroupIDs
        const list = trim(rows[r][idxRelatedList] || "");
        related = list
          .split(",")
          .map(x => normalizeGroupId(x))
          .filter(Boolean);
      } else {
        // Option B: multiple columns Related1..RelatedN
        related = header
          .map((h, i) => ({ h, i }))
          .filter(x => x.h.toLowerCase().startsWith("related"))
          .map(x => normalizeGroupId(rows[r][x.i]))
          .filter(Boolean);
      }

      if (related.length) mapObj[id] = related;
    }

    saveAffinityCache(mapObj);
    return mapObj;
  }

  // ---------------- HOMEPAGE RENDER ----------------
  function ensureStyles() {
    if (document.getElementById("wl-home-merch-css")) return;

    const css = `
/* Container we inject */
#wlhmRoot { margin: 12px 0 18px 0; }
#wlhmRoot * { box-sizing: border-box; }

/* Hero */
.wlhm-hero {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(0,0,0,.08);
  box-shadow: 0 10px 26px rgba(0,0,0,.10);
  position: relative;
}
.wlhm-hero a { display:block; text-decoration:none; color:inherit; }
.wlhm-hero img { width:100%; height:240px; object-fit:cover; display:block; }
@media (max-width: 768px){ .wlhm-hero img { height: 170px; } }
.wlhm-heroOverlay{
  position:absolute; inset:auto 0 0 0;
  padding: 14px 16px;
  background: linear-gradient(to top, rgba(0,0,0,.62), rgba(0,0,0,0));
  color:#fff;
}
.wlhm-heroTitle{ font-weight:800; font-size:18px; line-height:1.15; }
.wlhm-heroSub{ opacity:.92; font-size:13px; margin-top:2px; }

/* Shelves */
.wlhm-shelf { margin-top: 14px; }
.wlhm-shelfHead {
  display:flex; align-items:baseline; justify-content:space-between;
  padding: 6px 2px;
}
.wlhm-shelfTitle { font-weight:800; font-size:16px; }
.wlhm-row {
  display:flex; gap: 10px;
  overflow:auto; padding: 6px 2px 10px 2px;
  scroll-snap-type: x mandatory;
}
.wlhm-card {
  flex: 0 0 180px;
  scroll-snap-align: start;
  border-radius: 14px;
  overflow:hidden;
  border: 1px solid rgba(0,0,0,.08);
  background:#fff;
  box-shadow: 0 6px 18px rgba(0,0,0,.08);
  transition: transform .12s ease, box-shadow .12s ease;
}
.wlhm-card:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(0,0,0,.12); }
.wlhm-card a { display:block; text-decoration:none; color:inherit; }
.wlhm-cardImg { width:100%; height:120px; object-fit:cover; background:#f2f2f2; display:block; }
.wlhm-cardBody { padding: 10px 10px 12px 10px; }
.wlhm-cardTitle { font-weight:800; font-size:13px; line-height:1.2; }
.wlhm-badge { margin-top: 6px; font-size:11px; opacity:.75; }

/* Optional hide default cards on homepage */
body.wlhm-hide-default fieldset.Cards { display:none !important; }
`;
    const style = document.createElement("style");
    style.id = "wl-home-merch-css";
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }

  function pickTopIntentGroups() {
    const obj = safeJsonParse(localStorage.getItem(CFG.LS_INTENT), {});
    const entries = Object.entries(obj)
      .map(([k, v]) => ({ k, v: Number(v) || 0 }))
      .filter(x => x.k && x.v > 0)
      .sort((a, b) => b.v - a.v);
    return entries.map(x => x.k);
  }

  function renderShelfCards(cards) {
    return cards.map(c => {
      const img = c.img || ""; // may be empty
      const safeImg = img ? img : "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
      return `
        <div class="wlhm-card">
          <a href="${c.link}">
            <img class="wlhm-cardImg" src="${safeImg}" alt="${(c.title || "").replace(/"/g, "&quot;")}">
            <div class="wlhm-cardBody">
              <div class="wlhm-cardTitle">${c.title || "Shop"}</div>
              ${c.badge ? `<div class="wlhm-badge">${c.badge}</div>` : ``}
            </div>
          </a>
        </div>`;
    }).join("");
  }

  function injectHomepageUI({ recentCards, recoCards }) {
    ensureStyles();

    if (CFG.HIDE_DEFAULT_CARDS_ON_HOMEPAGE) {
      document.body.classList.add("wlhm-hide-default");
    }

    // Insert above the default card grid
    const anchor =
      document.querySelector("fieldset.Cards") ||
      document.querySelector("#MainLayoutRow") ||
      document.body;

    if (!anchor) return;

    // Avoid double
    if (document.getElementById("wlhmRoot")) return;

    const root = document.createElement("div");
    root.id = "wlhmRoot";
    root.innerHTML = `
      <div class="wlhm-hero">
        <a href="${CFG.HERO_LINK}">
          <img src="${CFG.HERO_IMAGE}" alt="Featured">
          <div class="wlhm-heroOverlay">
            <div class="wlhm-heroTitle">${CFG.HERO_TITLE}</div>
            <div class="wlhm-heroSub">${CFG.HERO_SUBTITLE}</div>
          </div>
        </a>
      </div>

      ${recentCards.length ? `
      <div class="wlhm-shelf">
        <div class="wlhm-shelfHead">
          <div class="wlhm-shelfTitle">Recently Viewed</div>
        </div>
        <div class="wlhm-row">
          ${renderShelfCards(recentCards)}
        </div>
      </div>` : ``}

      ${recoCards.length ? `
      <div class="wlhm-shelf">
        <div class="wlhm-shelfHead">
          <div class="wlhm-shelfTitle">Recommended for You</div>
        </div>
        <div class="wlhm-row">
          ${renderShelfCards(recoCards)}
        </div>
      </div>` : ``}
    `;

    anchor.parentNode.insertBefore(root, anchor);
  }

  function buildRecentCards() {
    const recent = loadRecent().slice(0, CFG.SHELF_RECENT_COUNT);
    return recent.map(r => ({
      title: r.title || "Shop",
      link: r.link || "/Products.aspx",
      img: r.img || "",
      badge: "Continue"
    }));
  }

  function buildRecoCards(affMap) {
    const top = pickTopIntentGroups().slice(0, 5); // take top few visited groups
    const recent = loadRecent().map(x => String(x.pg));
    const seen = new Set(recent);

    // Score related groups by affinity occurrences
    const score = {};
    top.forEach(src => {
      const rel = affMap[String(src)] || [];
      rel.forEach(pg => {
        const gid = String(pg);
        if (!gid) return;
        // don’t recommend the exact same group they just viewed repeatedly
        if (seen.has(gid)) return;
        score[gid] = (score[gid] || 0) + 1;
      });
    });

    const ranked = Object.entries(score)
      .map(([pg, s]) => ({ pg, s }))
      .sort((a, b) => b.s - a.s)
      .slice(0, CFG.SHELF_RECO_COUNT)
      .map(x => x.pg);

    // We need titles/images. For v1: try to find from recents (if ever clicked), else generic label.
    // Later we can pull a “Group Catalog sheet” with Title + Sirv image.
    return ranked.map(pg => ({
      title: "Recommended",
      link: `/Products.aspx?pg=${pg}&sort=StockClassSort&direction=asc`,
      img: "", // optional: can be filled once we add catalog sheet
      badge: "Suggested"
    }));
  }

  // ---------------- INIT ----------------
  wireClickTracking();
  trackLandingVisit();

  // Homepage only: inject hero + shelves
  if (isHomepage) {
    (async function () {
      try {
        const aff = await fetchAffinityMap();
        const recentCards = buildRecentCards();
        const recoCards = buildRecoCards(aff);
        injectHomepageUI({ recentCards, recoCards });
      } catch (e) {
        // Still show hero + recent even if affinity fails
        const recentCards = buildRecentCards();
        injectHomepageUI({ recentCards, recoCards: [] });
        console.warn("[WLHM] affinity load failed:", e);
      }
    })();
  }
})();
