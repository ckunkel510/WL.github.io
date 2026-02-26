/* wl-home-merch.js
   Updates:
   - Uses Sheet1 as Group Catalog: ProductGroupID + ImageURL + Title
   - All shelves/cards use real titles when available
   - Up to 4 affinity shelves based on recently viewed groups
   - Square image ratio everywhere (aspect-ratio 1/1)

   Injection rules:
   - Inject if querystring starts with "?pg=0" OR homepage-like (no pl1, no pid, and pg missing or pg=0)
*/

(function WL_HomeMerch() {
  const CFG = {
    HERO_IMAGE: "https://images-woodsonlumber.sirv.com/Emailimages/Dark-Walnut.jpg",
    HERO_LINK: "/Products.aspx?pl1=4546&pg=4546&sort=StockClassSort&direction=asc",
    HERO_TITLE: "Featured",
    HERO_SUBTITLE: "Shop current specials",

    // Affinity CSV (Option A: ProductGroupID, RelatedGroupIDs)
    AFFINITY_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRQWZZ6H1UvsAhO8o29StEflcyS_ssW0lQxRg0LA9NucM9oyAl6gG8jZJfVaIG6nYiZ80Fw2NXldNWD/pub?output=csv",

    // Group Catalog CSV (your image override sheet, now with Title too)
    GROUP_CATALOG_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS-3Rdml5LGrt8dn1yzvZJYqHQDn0BIXrUjycLG_Q0xtu7c-OcVTnO5BvhjXFb2o0H4zlC2lThUUx0V/pub?output=csv",
    COL_GROUP_ID: "ProductGroupID",
    COL_IMAGE_URL: "ImageURL",
    COL_TITLE: "Title", // <-- set this to your header name if different

    COLD_START_SEEDS: ["18"],

    LS_RECENT: "__WL_RECENT_GROUPS_V1__",
    LS_INTENT: "__WL_INTENT_GROUPS_V1__",
    LS_AFF_CACHE: "__WL_AFFINITY_CACHE_V1__",

    RECENT_LIMIT: 16,
    AFFINITY_CACHE_TTL_MS: 12 * 60 * 60 * 1000,

    SHELF_RECENT_COUNT: 10,
    SHELF_RECO_COUNT: 12,

    MAX_AFFINITY_SHELVES: 4,
    AFFINITY_ITEMS_PER_SHELF: 10,
    STATIC_GRID_TILE_COUNT: 4,

    DEBUG: true
  };

  // ---------- Page gating ----------
  const file = (location.pathname.split("/").pop() || "").toLowerCase();
  if (file !== "products.aspx") return;

  const qs = new URLSearchParams(location.search);
  const pl1 = qs.get("pl1");
  const pgParam = qs.get("pg");
  const pid = qs.get("pid");

  const queryStartsWithPg0 = (location.search || "").toLowerCase().startsWith("?pg=0");
  const pgIsPagingZero = (pgParam !== null && String(pgParam) === "0");
  const homepageLike = !pl1 && !pid && (!pgParam || pgIsPagingZero);

  const shouldInject = queryStartsWithPg0 || homepageLike;

  if (window.__WL_HOME_MERCH_LOADED__) return;
  window.__WL_HOME_MERCH_LOADED__ = true;

  // ---------- Utils ----------
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

  function isGroupDrilldownHref(href) {
    const pg = getParamFromHref(href, "pg");
    if (!pg) return false;
    return String(pg) !== "0";
  }

  function getCardMetaFromAnchor(a) {
    const href = a.getAttribute("href") || "";
    const abs = getAbsUrl(href);
    if (!abs) return null;

    const pg = getParamFromHref(href, "pg");
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

  // ---------- Storage ----------
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

  // ---------- Tracking ----------
  function wireClickTracking() {
    document.addEventListener("click", function (e) {
      const a = e.target && e.target.closest ? e.target.closest('a[href*="Products.aspx"]') : null;
      if (!a) return;

      const href = a.getAttribute("href") || "";
      if (!isGroupDrilldownHref(href)) return;

      const meta = getCardMetaFromAnchor(a);
      if (meta) recordGroupVisit(meta);
    }, true);
  }

  function trackLandingContext() {
    if (pl1) {
      const gid = normalizeGroupId(pl1);
      if (gid) recordGroupVisit({ pg: gid, title: `Group ${gid}`, link: location.pathname + location.search, img: "", ts: now() });
      return;
    }
    if (pgParam && String(pgParam) !== "0") {
      const gid = normalizeGroupId(pgParam);
      if (gid) recordGroupVisit({ pg: gid, title: `Group ${gid}`, link: location.pathname + location.search, img: "", ts: now() });
    }
  }

  // ---------- CSV parsing ----------
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

  // ---------- Affinity ----------
  function loadAffinityCache() {
    const raw = localStorage.getItem(CFG.LS_AFF_CACHE);
    const parsed = safeJsonParse(raw, null);
    if (!parsed || !parsed.expiresAt || !parsed.map) return null;
    if (now() > parsed.expiresAt) return null;
    return parsed.map;
  }
  function saveAffinityCache(mapObj) {
    localStorage.setItem(CFG.LS_AFF_CACHE, JSON.stringify({ expiresAt: now() + CFG.AFFINITY_CACHE_TTL_MS, map: mapObj }));
  }

  async function fetchAffinityMap() {
    const cached = loadAffinityCache();
    if (cached) return cached;

    const url = CFG.AFFINITY_CSV_URL;
    if (!url || url.includes("PASTE_")) return {};

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
    return mapObj;
  }

  // ---------- Group Catalog (Image + Title) ----------
  async function fetchGroupCatalog() {
    if (window.__WL_GROUP_CATALOG__) return window.__WL_GROUP_CATALOG__;

    const url = CFG.GROUP_CATALOG_CSV_URL;
    if (!url || url.includes("PASTE_")) {
      window.__WL_GROUP_CATALOG__ = { img: new Map(), title: new Map() };
      return window.__WL_GROUP_CATALOG__;
    }

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      window.__WL_GROUP_CATALOG__ = { img: new Map(), title: new Map() };
      return window.__WL_GROUP_CATALOG__;
    }

    const csv = await res.text();
    const rows = parseCsv(csv);
    if (!rows.length) {
      window.__WL_GROUP_CATALOG__ = { img: new Map(), title: new Map() };
      return window.__WL_GROUP_CATALOG__;
    }

    const header = rows[0].map(h => trim(h));
    const idxId = header.findIndex(h => h.toLowerCase() === CFG.COL_GROUP_ID.toLowerCase());
    const idxUrl = header.findIndex(h => h.toLowerCase() === CFG.COL_IMAGE_URL.toLowerCase());
    const idxTitle = header.findIndex(h => h.toLowerCase() === CFG.COL_TITLE.toLowerCase());

    const imgMap = new Map();
    const titleMap = new Map();

    for (let r = 1; r < rows.length; r++) {
      const id = normalizeGroupId(idxId >= 0 ? rows[r][idxId] : "");
      if (!id) continue;

      const img = idxUrl >= 0 ? trim(rows[r][idxUrl] || "") : "";
      const title = idxTitle >= 0 ? trim(rows[r][idxTitle] || "") : "";

      if (img) imgMap.set(String(id), img);
      if (title) titleMap.set(String(id), title);
    }

    window.__WL_GROUP_CATALOG__ = { img: imgMap, title: titleMap };
    log("Catalog loaded:", imgMap.size, "images,", titleMap.size, "titles");
    return window.__WL_GROUP_CATALOG__;
  }

  function titleFor(groupId, titleMap) {
    const gid = String(groupId);
    return titleMap.get(gid) || `Group ${gid}`;
  }

  // ---------- UI / styles ----------
  function ensureStyles() {
    if (document.getElementById("wl-home-merch-css")) return;

    const css = `
#wlhmRoot { margin: 12px 0 18px 0; }
#wlhmRoot * { box-sizing: border-box; }

.wlhm-hero { border-radius:16px; overflow:hidden; border:1px solid rgba(0,0,0,.08); box-shadow:0 10px 26px rgba(0,0,0,.10); position:relative; }
.wlhm-hero a { display:block; text-decoration:none; color:inherit; }
.wlhm-hero img { width:100%; height:240px; object-fit:cover; display:block; }
@media (max-width:768px){ .wlhm-hero img { height:170px; } }
.wlhm-heroOverlay { position:absolute; inset:auto 0 0 0; padding:14px 16px; background:linear-gradient(to top, rgba(0,0,0,.62), rgba(0,0,0,0)); color:#fff; }
.wlhm-heroTitle { font-weight:800; font-size:18px; line-height:1.15; }
.wlhm-heroSub { opacity:.92; font-size:13px; margin-top:2px; }

.wlhm-shelf { margin-top:14px; }
.wlhm-shelfHead { display:flex; align-items:baseline; justify-content:space-between; padding:6px 2px; }
.wlhm-shelfTitle { font-weight:800; font-size:16px; }
.wlhm-row { display:flex; gap:10px; overflow:auto; padding:6px 2px 10px 2px; scroll-snap-type:x mandatory; }

.wlhm-card { flex:0 0 170px; scroll-snap-align:start; border-radius:14px; overflow:hidden; border:1px solid rgba(0,0,0,.08); background:#fff; box-shadow:0 6px 18px rgba(0,0,0,.08); transition:transform .12s ease, box-shadow .12s ease; }
.wlhm-card:hover { transform:translateY(-2px); box-shadow:0 10px 28px rgba(0,0,0,.12); }
.wlhm-card a { display:block; text-decoration:none; color:inherit; }
.wlhm-cardImg { width:100%; aspect-ratio:1/1; object-fit:cover; background:#f2f2f2; display:block; }
.wlhm-cardBody { padding:10px 10px 12px 10px; }
.wlhm-cardTitle { font-weight:800; font-size:13px; line-height:1.2; }
.wlhm-badge { margin-top:6px; font-size:11px; opacity:.75; }

.wlhm-grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:10px; padding:6px 2px 10px 2px; }
@media (min-width:900px){ .wlhm-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.wlhm-grid .wlhm-card { flex: initial; }
`;
    const style = document.createElement("style");
    style.id = "wl-home-merch-css";
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }

  function getInsertAnchor() {
    return (
      document.querySelector("#ctl00_PageBody_ProductGroupDrillDownPanel .productGroupScrollingPanelFull") ||
      document.querySelector(".productGroupScrollingPanelFull") ||
      document.querySelector("fieldset.Cards") ||
      document.querySelector("#MainLayoutRow") ||
      document.body
    );
  }

  function renderCards(cards) {
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

  function renderShelf(title, mode, cardsHtml) {
    const body = mode === "grid"
      ? `<div class="wlhm-grid">${cardsHtml}</div>`
      : `<div class="wlhm-row">${cardsHtml}</div>`;

    return `
      <div class="wlhm-shelf">
        <div class="wlhm-shelfHead"><div class="wlhm-shelfTitle">${title}</div></div>
        ${body}
      </div>`;
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

    return ranked.length ? ranked : (CFG.COLD_START_SEEDS || []).map(normalizeGroupId).filter(Boolean);
  }

  function buildRecentCards(catalog) {
    const recent = loadRecent().slice(0, CFG.SHELF_RECENT_COUNT);
    return recent.map(r => {
      const gid = String(r.pg);
      return {
        title: r.title && !/^Group\s+\d+$/.test(r.title) ? r.title : titleFor(gid, catalog.title),
        link: r.link || "/Products.aspx",
        img: r.img || catalog.img.get(gid) || "",
        badge: "Continue"
      };
    });
  }

  function buildRecoCards(affMap, catalog) {
    const top = pickTopIntentGroups().slice(0, 5);
    if (!top.length) return [];

    const seen = new Set(loadRecent().map(x => String(x.pg)));
    const score = {};

    top.forEach(src => {
      const rel = (affMap && affMap[String(src)]) ? affMap[String(src)] : [];
      rel.forEach(pg => {
        const gid = String(pg);
        if (!gid || seen.has(gid)) return;
        score[gid] = (score[gid] || 0) + 1;
      });
    });

    const ranked = Object.entries(score)
      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
      .slice(0, CFG.SHELF_RECO_COUNT)
      .map(x => x[0]);

    return ranked.map(gid => ({
      title: titleFor(gid, catalog.title),
      link: `/Products.aspx?pl1=${gid}&pg=${gid}&sort=StockClassSort&direction=asc`,
      img: catalog.img.get(gid) || "",
      badge: "Suggested"
    }));
  }

  function buildAffinityShelves(affMap, catalog) {
    const recent = loadRecent();
    if (!recent.length) return [];

    const shelves = [];
    const usedSource = new Set();
    const usedTarget = new Set();

    for (const r of recent) {
      const src = String(r.pg);
      if (!src || usedSource.has(src)) continue;

      const rel = (affMap && affMap[src]) ? affMap[src] : [];
      if (!rel.length) continue;

      const targets = rel
        .map(String)
        .filter(gid => gid && gid !== src && !usedTarget.has(gid));

      if (!targets.length) continue;

      usedSource.add(src);

      const shelfIndex = shelves.length;
      const mode = shelfIndex < 2 ? "scroll" : "grid";

      const maxItems = mode === "grid" ? CFG.STATIC_GRID_TILE_COUNT : CFG.AFFINITY_ITEMS_PER_SHELF;
      const chosen = targets.slice(0, maxItems);

      chosen.forEach(gid => usedTarget.add(gid));

      const cards = chosen.map(gid => ({
        title: titleFor(gid, catalog.title),
        link: `/Products.aspx?pl1=${gid}&pg=${gid}&sort=StockClassSort&direction=asc`,
        img: catalog.img.get(gid) || "",
        badge: ""
      }));

      const srcTitle = (r.title && !/^Group\s+\d+$/.test(r.title)) ? r.title : titleFor(src, catalog.title);
      shelves.push({
        title: `More like ${srcTitle}`,
        mode,
        cards
      });

      if (shelves.length >= CFG.MAX_AFFINITY_SHELVES) break;
    }

    return shelves;
  }

  function injectUI({ recentCards, recoCards, affinityShelves }) {
    ensureStyles();
    if (document.getElementById("wlhmRoot")) return;

    const anchor = getInsertAnchor();
    if (!anchor) return;

    const root = document.createElement("div");
    root.id = "wlhmRoot";

    let html = `
      <div class="wlhm-hero">
        <a href="${CFG.HERO_LINK}">
          <img src="${CFG.HERO_IMAGE}" alt="Featured">
          <div class="wlhm-heroOverlay">
            <div class="wlhm-heroTitle">${CFG.HERO_TITLE}</div>
            <div class="wlhm-heroSub">${CFG.HERO_SUBTITLE}</div>
          </div>
        </a>
      </div>
    `;

    if (recentCards.length) html += renderShelf("Recently Viewed", "scroll", renderCards(recentCards));
    if (recoCards.length) html += renderShelf("Recommended for You", "scroll", renderCards(recoCards));

    if (affinityShelves && affinityShelves.length) {
      for (const s of affinityShelves) {
        html += renderShelf(s.title, s.mode, renderCards(s.cards));
      }
    }

    root.innerHTML = html;

    if (anchor.classList && anchor.classList.contains("productGroupScrollingPanelFull")) {
      anchor.insertBefore(root, anchor.firstChild);
    } else {
      anchor.parentNode.insertBefore(root, anchor);
    }

    log("Injected UI. affinity shelves:", affinityShelves?.length || 0);
  }

  // ---------- Init ----------
  wireClickTracking();
  trackLandingContext();

  if (!shouldInject) {
    log("Not injecting UI. search =", location.search);
    return;
  }

  (async function init() {
    try {
      const [affMap, catalog] = await Promise.all([fetchAffinityMap(), fetchGroupCatalog()]);
      const recentCards = buildRecentCards(catalog);
      const recoCards = buildRecoCards(affMap, catalog);
      const affinityShelves = buildAffinityShelves(affMap, catalog);
      injectUI({ recentCards, recoCards, affinityShelves });
    } catch (e) {
      warn("init failed:", e);
    }
  })();
})();
