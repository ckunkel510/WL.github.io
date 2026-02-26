/* wl-home-merch.js
   Homepage merchandising + personalization for Products.aspx

   Fixes applied:
   - Treats pg=0 (with no pl1) as "homepage-like" so hero/shelves still inject
   - Uses pl1 as the "current group context" on internal pages (because pg is also used for paging)
   - Inserts hero at the TOP of .productGroupScrollingPanelFull (above paging controls / styles / other injections)
   - Ignores paging links where pg=0 when tracking clicks
   - Cold-start seeds so Recommended can show even before intent is collected

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
    // For testing: set this to the ProductGroupID you have in your affinity sheet
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

    // If true, hides the default WebTrack cards on homepage (keeps everything on lower pages unchanged)
    HIDE_DEFAULT_CARDS_ON_HOMEPAGE: false,

    // Debug logging
    DEBUG: true
  };

  // ---------------- PAGE GATING ----------------
  const file = (location.pathname.split("/").pop() || "").toLowerCase();
  if (file !== "products.aspx") return;

  const qs = new URLSearchParams(location.search);
  const pl1 = qs.get("pl1");
  const pgParam = qs.get("pg"); // can be paging (0) or group id (e.g. 4677)
  const pid = qs.get("pid");    // product context (search-ish flows)

  const pgIsPagingZero = (pgParam !== null && String(pgParam) === "0");

  // "Homepage-like" view:
  // - not inside a department (no pl1)
  // - not in a product-specific flow (no pid)
  // - and either no pg at all OR pg=0
  const isHomepage = !pl1 && !pid && (!pgParam || pgIsPagingZero);

  if (window.__WL_HOME_MERCH_LOADED__) return;
  window.__WL_HOME_MERCH_LOADED__ = true;

  // ---------------- UTILS ----------------
  const now = () => Date.now();
  const trim = (s) => (s == null ? "" : String(s).trim());

  function log(...args) { if (CFG.DEBUG) console.log("[WLHM]", ...args); }
  function warn(...args) { console.warn("[WLHM]", ...args); }

  function safeJsonParse(raw, fallback) {
    try {
      const parsed = JSON.parse(raw);
      return (parsed === null || parsed === undefined) ? fallback : parsed;
    } catch {
      return fallback;
    }
  }

  function normalizeGroupId(id) {
    const s = String(id || "").replace(/[^\d-]/g, "");
    return s || null;
  }

  function getAbsUrl(href) {
    try { return new URL(href, location.origin).toString(); } catch { return null; }
  }

  function getParamFromHref(href, param) {
    try {
      const u = new URL(href, location.origin);
      const v = u.searchParams.get(param);
      return v ? String(v) : null;
    } catch {
      return null;
    }
  }

  // Treat as a “group drilldown link” only if pg exists AND pg != 0
  function isGroupDrilldownHref(href) {
    const pg = getParamFromHref(href, "pg");
    if (!pg) return false;
    return String(pg) !== "0";
  }

  function getCardMetaFromAnchor(a) {
    const href = a.getAttribute("href") || "";
    const abs = getAbsUrl(href);
    if (!abs) return null;

    const pg = getParamFromHref(href, "pg"); // on card links this is the ProductGroupID
    if (!pg || String(pg) === "0") return null;

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
      title: title || `Group ${pg}`,
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

  function bumpIntent(groupId) {
    const gid = normalizeGroupId(groupId);
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

    log("Recorded group visit:", gid, meta.title);
  }

  // Track clicks on group cards (works across pagination)
  function wireClickTracking() {
    document.addEventListener("click", function (e) {
      const a = e.target && e.target.closest ? e.target.closest('a[href*="Products.aspx"]') : null;
      if (!a) return;

      const href = a.getAttribute("href") || "";
      if (!isGroupDrilldownHref(href)) return; // ignore paging links like pg=0

      const meta = getCardMetaFromAnchor(a);
      if (meta) recordGroupVisit(meta);
    }, true);
  }

  // Track landing context:
  // - If pl1 present, record pl1 as intent (even if pg=0 paging)
  // - Else if pg present and pg != 0, record pg as intent
  function trackLandingContext() {
    if (pl1) {
      const gid = normalizeGroupId(pl1);
      if (gid) {
        recordGroupVisit({
          pg: gid,
          title: `Group ${gid}`,
          link: location.pathname + location.search,
          img: "",
          ts: now()
        });
      }
      return;
    }

    if (pgParam && String(pgParam) !== "0") {
      const gid = normalizeGroupId(pgParam);
      if (gid) {
        recordGroupVisit({
          pg: gid,
          title: `Group ${gid}`,
          link: location.pathname + location.search,
          img: "",
          ts: now()
        });
      }
    }
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

  // ---------------- AFFINITY MAP ----------------
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
    if (cached) { log("Affinity cache rows:", Object.keys(cached).length); return cached; }

    const url = CFG.AFFINITY_CSV_URL;
    if (!url || url.includes("PASTE_")) { log("Affinity URL not set."); return {}; }

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
      const id = normalizeGroupId(idxId >= 0 ? rows[r][idxId] : "");
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
    log("Affinity fetched rows:", Object.keys(mapObj).length);
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
    log("Group image map rows:", map.size);
    return map;
  }

  // ---------------- HOMEPAGE INSERTION ----------------
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

  function getHomepageInsertAnchor() {
    return (
      document.querySelector("#ctl00_PageBody_ProductGroupDrillDownPanel .productGroupScrollingPanelFull") ||
      document.querySelector(".productGroupScrollingPanelFull") ||
      document.querySelector("fieldset.Cards") ||
      document.querySelector("#MainLayoutRow") ||
      document.body
    );
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

    return (CFG.COLD_START_SEEDS || []).map(normalizeGroupId).filter(Boolean);
  }

  function renderShelfCards(cards) {
    return cards.map(c => {
      const img = c.img || "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
      const safeTitle = (c.title || "Shop").replace(/"/g, "&quot;");
      return `
        <div class="wlhm-card">
          <a href="${c.link}">
            <img class="wlhm-cardImg" src="${img}" alt="${safeTitle}">
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
    if (document.getElementById("wlhmRoot")) return;

    const anchor = getHomepageInsertAnchor();
    if (!anchor) return;

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

    // If we anchored to the scroll panel, insert hero at the TOP (above paging controls)
    if (anchor.classList && anchor.classList.contains("productGroupScrollingPanelFull")) {
      anchor.insertBefore(root, anchor.firstChild);
    } else {
      anchor.parentNode.insertBefore(root, anchor);
    }

    log("Injected homepage hero/shelves. Anchor:", anchor.className || anchor.id || anchor.tagName);
  }

  function buildRecentCards(groupImgMap) {
    const recent = loadRecent().slice(0, CFG.SHELF_RECENT_COUNT);
    return recent.map(r => ({
      title: r.title || `Group ${r.pg}`,
      link: r.link || "/Products.aspx",
      img: r.img || groupImgMap.get(String(r.pg)) || "",
      badge: "Continue"
    }));
  }

  function buildRecoCards(affMap, groupImgMap) {
    const top = pickTopIntentGroups().slice(0, 5);
    if (!top.length) return [];

    const seen = new Set(loadRecent().map(x => String(x.pg)));

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

    log("Top intent:", top, "Reco:", ranked);

    return ranked.map(pg => ({
      title: `Shop ${pg}`, // upgrade later using a Title column
      // Use pl1+pg when linking to a group page (works well with your existing patterns)
      link: `/Products.aspx?pl1=${pg}&pg=${pg}&sort=StockClassSort&direction=asc`,
      img: groupImgMap.get(String(pg)) || "",
      badge: "Suggested"
    }));
  }

  // ---------------- INIT ----------------
  wireClickTracking();
  trackLandingContext();

  if (isHomepage) {
    (async function () {
      try {
        const [aff, groupImgMap] = await Promise.all([fetchAffinityMap(), fetchGroupImageMap()]);
        const recentCards = buildRecentCards(groupImgMap);
        const recoCards = buildRecoCards(aff, groupImgMap);
        injectHomepageUI({ recentCards, recoCards });
      } catch (e) {
        warn("homepage init failed:", e);
      }
    })();
  } else {
    log("Not homepage-like; hero not injected. search =", location.search);
  }
})();
