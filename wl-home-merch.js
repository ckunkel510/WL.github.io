/* wl-home-merch.js
   Homepage merchandising + personalization for Products.aspx
   - Tracks visited Product Groups (pg) across pagination and direct landings
   - Pulls affinity mapping from a published Google Sheet CSV (Option A or B)
   - Reuses your ProductGroup image override sheet (Sheet1) for shelf card images
   - Injects a hero + shelves on Products.aspx homepage only (no pl1/pg)

   Affinity Sheet format (CSV headers):
   Option A:
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
    HERO_LINK: "/Products.aspx?pl1=4546&pg=4546&sort=StockClassSort&direction=asc", // change anytime
    HERO_TITLE: "Featured",
    HERO_SUBTITLE: "Shop current specials",

    // AFFINITY SHEET (published CSV URL)
    AFFINITY_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRQWZZ6H1UvsAhO8o29StEflcyS_ssW0lQxRg0LA9NucM9oyAl6gG8jZJfVaIG6nYiZ80Fw2NXldNWD/pub?output=csv",

    // GROUP IMAGE SHEET (published CSV URL) - reuse same sheet you use for wl-productgroup-images.js (Sheet1)
    GROUP_IMAGE_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS-3Rdml5LGrt8dn1yzvZJYqHQDn0BIXrUjycLG_Q0xtu7c-OcVTnO5BvhjXFb2o0H4zlC2lThUUx0V/pub?output=csv",
    GROUP_IMAGE_COL_ID: "ProductGroupID",
    GROUP_IMAGE_COL_URL: "ImageURL",

    // Cold-start seeds (used when user has no intent yet)
    // Put the ProductGroupIDs that you want to use to generate recommendations on first visit.
    // For testing: set this to the single ProductGroupID you have in your affinity sheet.
    COLD_START_SEEDS: ["18"],

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

    // If true, hides the default WebTrack cards on homepage
    HIDE_DEFAULT_CARDS_ON_HOMEPAGE: false,

    // Debug logging
    DEBUG: true
  };

  // ---------------- PAGE GATING ----------------
  const file = (location.pathname.split("/").pop() || "").toLowerCase();
  if (file !== "products.aspx") return;

  const qs = new URLSearchParams(location.search);
  const isHomepage = !qs.has("pl1") && !qs.has("pg");

  if (window.__WL_HOME_MERCH_LOADED__) return;
  window.__WL_HOME_MERCH_LOADED__ = true;

  // ---------------- UTILS ----------------
  const now = () => Date.now();
  const trim = (s) => (s == null ? "" : String(s).trim());

  function log(...args) {
    if (CFG.DEBUG) console.log("[WLHM]", ...args);
  }

  function warn(...args) {
    console.warn("[WLHM]", ...args);
  }

  function safeJsonParse(raw, fallback) {
    try {
      const parsed = JSON.parse(raw);
      return (parsed === null || parsed === undefined) ? fallback : parsed;
    } catch {
      return fallback;
    }
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
    const href = a.getAttribute("href") || "";
    const abs = getAbsUrl(href);
    const pg = getGroupIdFromHref(href);
    if (!pg || !abs) return null;

    let title = trim(a.textContent);
    const card = a.closest('fieldset[id="productGroupCard"]') || a.closest("fieldset") || null;
    if (card && !title) {
      const headerA = card.querySelector("#ProductGroupCardHeader a");
      if (headerA) title = trim(headerA.textContent);
    }

    let img = "";
    if (card) {
      const imgEl = card.querySelector("img.productGroupImage");
      if (imgEl) img = trim(imgEl.getAttribute("src") || "");
    }

    return {
      pg: String(pg),
      title: title || "Shop",
      link: abs.replace(location.origin, ""),
      img,
      ts: now()
    };
  }

  // ---------------- RECENT + INTENT STORAGE ----------------
  function loadRecent() {
    const arr = safeJsonParse(localStorage.getItem(CFG.LS_RECENT), []);
    return Array.isArray(arr) ? arr : [];
  }

  function saveRecent(arr) {
    localStorage.setItem(CFG.LS_RECENT, JSON.stringify(arr));
  }

  function bumpIntent(pg) {
    const gid = normalizeGroupId(pg);
    if (!gid) return;

    const raw = localStorage.getItem(CFG.LS_INTENT);
    const parsed = safeJsonParse(raw, {});
    const obj = (parsed && typeof parsed === "object" && !Array.isArray(parsed)) ? parsed : {};

    obj[gid] = (obj[gid] || 0) + 1;
    localStorage.setItem(CFG.LS_INTENT, JSON.stringify(obj));
  }

  function recordGroupVisit(meta) {
    if (!meta || !meta.pg) return;

    const gid = normalizeGroupId(meta.pg);
    if (!gid) return;

    bumpIntent(gid);

    let recent = loadRecent();
    recent = recent.filter(x => x && String(x.pg) !== String(gid));
    recent.unshift({ ...meta, pg: gid, ts: now() });

    if (recent.length > CFG.RECENT_LIMIT) recent = recent.slice(0, CFG.RECENT_LIMIT);
    saveRecent(recent);

    log("Recorded visit:", gid, meta.title);
  }

  function wireClickTracking() {
    document.addEventListener("click", function (e) {
      const a = e.target && e.target.closest ? e.target.closest('a[href*="Products.aspx"]') : null;
      if (!a) return;

      const pg = getGroupIdFromHref(a.getAttribute("href") || "");
      if (!pg) return;

      const meta = getCardMetaFromAnchor(a);
      if (meta) recordGroupVisit(meta);
    }, true);
  }

  function trackLandingVisit() {
    const pg = qs.get("pg");
    if (!pg) return;

    const titleGuess =
      trim(document.querySelector("h1, .PageTitle, .page-title, #PageTitle")?.textContent) ||
      trim(document.querySelector('span[id*="ProductGroup"]')?.textContent) ||
      "Shop";

    const link = location.pathname + location.search;

    let img = "";
    const firstCardImg = document.querySelector('fieldset[id="productGroupCard"] img.productGroupImage');
    if (firstCardImg) img = trim(firstCardImg.getAttribute("src") || "");

    recordGroupVisit({ pg: String(pg), title: titleGuess, link, img, ts: now() });
  }

  // ---------------- CSV PARSER ----------------
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

  // ---------------- AFFINITY CACHE ----------------
  function loadAffinityCache() {
    const raw = localStorage.getItem(CFG.LS_AFF_CACHE);
    const parsed = safeJsonParse(raw, null);
    if (!parsed || !parsed.expiresAt || !parsed.map) return null;
    if (now() > parsed.expiresAt) return null;
    return parsed.map;
  }

  function saveAffinityCache(mapObj) {
    localStorage.setItem(CFG.LS_AFF_CACHE, JSON.stringify({
      expiresAt: now() + CFG.AFFINITY_CACHE_TTL_MS,
      map: mapObj
    }));
  }

  async function fetchAffinityMap() {
    const cached = loadAffinityCache();
    if (cached) {
      log("Affinity loaded from cache:", Object.keys(cached).length, "rows");
      return cached;
    }

    const url = CFG.AFFINITY_CSV_URL;
    if (!url || url.includes("PASTE_")) {
      log("Affinity CSV URL not set yet.");
      return {};
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
        const list = trim(rows[r][idxRelatedList] || "");
        related = list.split(",").map(normalizeGroupId).filter(Boolean);
      } else {
        related = header
          .map((h, i) => ({ h, i }))
          .filter(x => x.h.toLowerCase().startsWith("related"))
          .map(x => normalizeGroupId(rows[r][x.i]))
          .filter(Boolean);
      }

      if (related.length) mapObj[id] = related;
    }

    saveAffinityCache(mapObj);
    log("Affinity fetched:", Object.keys(mapObj).length, "rows");
    return mapObj;
  }

  // ---------------- GROUP IMAGE MAP ----------------
  async function fetchGroupImageMap() {
    if (window.__WL_GROUP_IMG_MAP__) return window.__WL_GROUP_IMG_MAP__;

    const url = CFG.GROUP_IMAGE_CSV_URL;
    if (!url || url.includes("PASTE_")) {
      window.__WL_GROUP_IMG_MAP__ = new Map();
      return window.__WL_GROUP_IMG_MAP__;
    }

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      window.__WL_GROUP_IMG_MAP__ = new Map();
      return window.__WL_GROUP_IMG_MAP__;
    }

    const csv = await res.text();
    const rows = parseCsv(csv);
    if (!rows.length) {
      window.__WL_GROUP_IMG_MAP__ = new Map();
      return window.__WL_GROUP_IMG_MAP__;
    }

    const header = rows[0].map(h => trim(h));
    const idxId = header.findIndex(h => h.toLowerCase() === CFG.GROUP_IMAGE_COL_ID.toLowerCase());
    const idxUrl = header.findIndex(h => h.toLowerCase() === CFG.GROUP_IMAGE_COL_URL.toLowerCase());

    const map = new Map();
    if (idxId >= 0 && idxUrl >= 0) {
      for (let r = 1; r < rows.length; r++) {
        const id = normalizeGroupId(rows[r][idxId]);
        const img = trim(rows[r][idxUrl] || "");
        if (id && img) map.set(String(id), img);
      }
    }

    window.__WL_GROUP_IMG_MAP__ = map;
    log("Group image map loaded:", map.size, "rows");
    return map;
  }

  // ---------------- HOMEPAGE RENDER ----------------
  function ensureStyles() {
    if (document.getElementById("wl-home-merch-css")) return;

    const css = `
#wlhmRoot { margin: 12px 0 18px 0; }
#wlhmRoot * { box-sizing: border-box; }

.wlhm-hero {
  border-radius: 16px; overflow: hidden;
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

.wlhm-shelf { margin-top: 14px; }
.wlhm-shelfHead { display:flex; align-items:baseline; justify-content:space-between; padding: 6px 2px; }
.wlhm-shelfTitle { font-weight:800; font-size:16px; }
.wlhm-row { display:flex; gap: 10px; overflow:auto; padding: 6px 2px 10px 2px; scroll-snap-type: x mandatory; }
.wlhm-card {
  flex: 0 0 180px;
  scroll-snap-align: start;
  border-radius: 14px; overflow:hidden;
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

body.wlhm-hide-default fieldset.Cards { display:none !important; }
`;
    const style = document.createElement("style");
    style.id = "wl-home-merch-css";
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }

  function pickTopIntentGroups() {
    const raw = localStorage.getItem(CFG.LS_INTENT);
    const parsed = safeJsonParse(raw, {});
    const obj = (parsed && typeof parsed === "object" && !Array.isArray(parsed)) ? parsed : {};

    const ranked = Object.entries(obj)
      .map(([k, v]) => ({ k, v: Number(v) || 0 }))
      .filter(x => x.k && x.v > 0)
      .sort((a, b) => b.v - a.v)
      .map(x => x.k);

    if (ranked.length) return ranked;

    // Cold-start: use seeds
    const seeds = (CFG.COLD_START_SEEDS || []).map(normalizeGroupId).filter(Boolean);
    return seeds;
  }

  function renderShelfCards(cards) {
    return cards.map(c => {
      const img = c.img || "";
      const safeImg = img ? img : "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
      const safeTitle = (c.title || "Shop").replace(/"/g, "&quot;");
      return `
        <div class="wlhm-card">
          <a href="${c.link}">
            <img class="wlhm-cardImg" src="${safeImg}" alt="${safeTitle}">
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

    if (CFG.HIDE_DEFAULT_CARDS_ON_HOMEPAGE) document.body.classList.add("wlhm-hide-default");

    const anchor = document.querySelector("fieldset.Cards") || document.querySelector("#MainLayoutRow") || document.body;
    if (!anchor) return;

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
        <div class="wlhm-shelfHead"><div class="wlhm-shelfTitle">Recently Viewed</div></div>
        <div class="wlhm-row">${renderShelfCards(recentCards)}</div>
      </div>` : ``}

      ${recoCards.length ? `
      <div class="wlhm-shelf">
        <div class="wlhm-shelfHead"><div class="wlhm-shelfTitle">Recommended for You</div></div>
        <div class="wlhm-row">${renderShelfCards(recoCards)}</div>
      </div>` : ``}
    `;

    anchor.parentNode.insertBefore(root, anchor);
  }

  function buildRecentCards(groupImgMap) {
    const recent = loadRecent().slice(0, CFG.SHELF_RECENT_COUNT);
    return recent.map(r => ({
      title: r.title || "Shop",
      link: r.link || "/Products.aspx",
      img: r.img || groupImgMap.get(String(r.pg)) || "",
      badge: "Continue"
    }));
  }

  function buildRecoCards(affMap, groupImgMap) {
    const top = pickTopIntentGroups().slice(0, 5);
    if (!top.length) return [];

    const recent = loadRecent().map(x => String(x.pg));
    const seen = new Set(recent);

    const score = {};
    top.forEach(src => {
      const rel = (affMap && affMap[String(src)]) ? affMap[String(src)] : [];
      rel.forEach(pg => {
        const gid = String(pg);
        if (!gid) return;
        if (seen.has(gid)) return;
        score[gid] = (score[gid] || 0) + 1;
      });
    });

    const ranked = Object.entries(score)
      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
      .slice(0, CFG.SHELF_RECO_COUNT)
      .map(x => x[0]);

    log("Top intent:", top, "Reco ranked:", ranked);

    return ranked.map(pg => ({
      title: `Shop ${pg}`, // until we add Title column to your image sheet
      link: `/Products.aspx?pg=${pg}&sort=StockClassSort&direction=asc`,
      img: groupImgMap.get(String(pg)) || "",
      badge: "Suggested"
    }));
  }

  // ---------------- INIT ----------------
  wireClickTracking();
  trackLandingVisit();

  if (isHomepage) {
    (async function () {
      try {
        const [aff, groupImgMap] = await Promise.all([fetchAffinityMap(), fetchGroupImageMap()]);
        const recentCards = buildRecentCards(groupImgMap);
        const recoCards = buildRecoCards(aff, groupImgMap);
        injectHomepageUI({ recentCards, recoCards });
      } catch (e) {
        warn("init failed:", e);
        const groupImgMap = await fetchGroupImageMap().catch(() => new Map());
        const recentCards = buildRecentCards(groupImgMap);
        injectHomepageUI({ recentCards, recoCards: [] });
      }
    })();
  }
})();
