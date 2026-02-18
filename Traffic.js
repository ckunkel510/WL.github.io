(function () {
  const CONTAINER_SEL = "td.Component209004";
  const TABLE_SEL = "table.Table209004";
  const MAX_RETRIES = 80;
  const RETRY_MS = 250;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const txt = (el) => (el?.textContent || "").trim();

  function log(...a) { console.log("[WL Traffic]", ...a); }
  function warn(...a) { console.warn("[WL Traffic]", ...a); }

  // 1) PROOF OF LIFE badge (always visible if JS runs)
  function addProofBadge() {
    if ($("#wlTrafficProof")) return;
    const b = document.createElement("div");
    b.id = "wlTrafficProof";
    b.textContent = "Traffic.js running ✅";
    b.style.cssText =
      "position:fixed;top:10px;left:10px;z-index:999999;" +
      "padding:10px 12px;background:#111;color:#fff;border-radius:10px;" +
      "font-weight:800;font-size:14px;box-shadow:0 6px 18px rgba(0,0,0,.25)";
    document.body.appendChild(b);
  }

  // 2) FORCE HIDE the raw table component immediately
  function forceHideComponent() {
    const comp = $(CONTAINER_SEL);
    if (comp) {
      comp.style.display = "none";
      comp.style.visibility = "hidden";
      comp.style.height = "0";
      comp.style.overflow = "hidden";
      log("Forced hide applied to", CONTAINER_SEL);
      return true;
    }
    return false;
  }

  // UI container (we inject this even if parse fails so you get feedback)
  function ensureUI(anchorEl) {
    if ($("#wlTrafficDash")) return;

    const wrap = document.createElement("div");
    wrap.id = "wlTrafficDash";
    wrap.style.cssText = "padding:10px;";

    wrap.innerHTML = `
      <div style="margin-bottom:10px; padding:10px 12px; border:1px solid #ddd; border-radius:10px; background:#fff;">
        <div style="font-weight:900; font-size:16px;">Traffic Dashboard</div>
        <div id="wlTrafficStatus" style="opacity:.8; font-size:12px; margin-top:4px;">Starting…</div>
      </div>

      <div id="wlTrafficRenderArea" style="border:1px dashed #ddd; border-radius:10px; background:#fff; padding:10px;">
        <div style="opacity:.8;">Waiting for data…</div>
      </div>
    `;

    // If no anchor, just prepend to body
    if (anchorEl && anchorEl.parentNode) {
      anchorEl.parentNode.insertBefore(wrap, anchorEl);
    } else {
      document.body.insertBefore(wrap, document.body.firstChild);
    }
  }

  function setStatus(s) {
    const el = $("#wlTrafficStatus");
    if (el) el.textContent = s;
  }

  // parsing helpers
  function normHeader(h) {
    return String(h || "")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[^\w]+/g, ""); // "Branch Name" => "BranchName"
  }
  const toInt = (v) => {
    const n = parseInt(String(v ?? "").replace(/,/g, "").trim(), 10);
    return Number.isFinite(n) ? n : null;
  };
  const toNum = (v) => {
    const n = parseFloat(String(v ?? "").replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  };

  function parseTable(tableEl) {
    const headerCells = $$("thead tr:first-child th, thead tr:first-child td", tableEl);
    const headers = headerCells.map(c => normHeader(txt(c)));
    if (!headers.length || headers.every(h => !h)) return [];

    const dataRows = $$("tbody tr", tableEl);
    const out = [];
    for (const r of dataRows) {
      const cells = $$("td", r);
      if (!cells.length) continue;
      const o = {};
      for (let i = 0; i < headers.length; i++) {
        o[headers[i] || `col${i}`] = txt(cells[i]);
      }
      out.push(o);
    }
    return out;
  }

  function normalizeRows(raw) {
    return raw.map(r => ({
      Grain: r.Grain,
      Scope: r.Scope,
      BranchCode: toInt(r.BranchCode) ?? 0,
      BranchName: r.BranchName || "All Branches",
      XInt: toInt(r.XInt),
      XLabel: r.XLabel,
      Y: toNum(r.Y),
      YInt: toInt(r.YInt),
      YLabel: r.YLabel,
      V: toNum(r.V)
    })).filter(r => r.Grain);
  }

  // super-minimal render (so you can tell rendering happened)
  function renderSummary(rows) {
    const area = $("#wlTrafficRenderArea");
    if (!area) return;

    const grains = rows.reduce((acc, r) => (acc[r.Grain] = (acc[r.Grain] || 0) + 1, acc), {});
    const branches = new Set(rows.map(r => r.BranchCode)).size;
    const scope = rows.find(r => r.Scope)?.Scope || "";

    area.innerHTML = `
      <div style="font-weight:800; margin-bottom:6px;">Parsed data ✅</div>
      <div style="font-size:13px; opacity:.85;">
        Scope: <b>${scope || "(blank)"}</b><br/>
        Rows: <b>${rows.length}</b><br/>
        Branches: <b>${branches}</b><br/>
        Grains: <b>${Object.entries(grains).map(([k,v]) => `${k}:${v}`).join(" • ")}</b>
      </div>
    `;
  }

  function init() {
    // Always show proof + attempt hide immediately
    addProofBadge();
    const hidden = forceHideComponent();

    const comp = $(CONTAINER_SEL);
    // Inject UI above where the table WAS (use comp as anchor if it exists)
    ensureUI(comp || document.body.firstChild);

    if (hidden) setStatus("✅ JS is running — component was force-hidden.");
    else setStatus("JS running, but td.Component209004 not found yet…");

    const table = $(CONTAINER_SEL + " " + TABLE_SEL) || $(TABLE_SEL);
    if (!table) {
      setStatus("JS running — waiting for table.Table209004 to appear…");
      return false;
    }

    const raw = parseTable(table);
    if (raw.length < 3) {
      setStatus("Table found — waiting for tbody rows to populate…");
      return false;
    }

    const rows = normalizeRows(raw);
    if (!rows.length) {
      setStatus("Table populated but headers/columns didn’t parse as expected.");
      return false;
    }

    setStatus(`✅ Data loaded: ${rows.length} rows. (Component is hidden)`);
    renderSummary(rows);
    log("Rendered summary with rows:", rows.length);
    return true;
  }

  function boot() {
    log("Traffic.js loaded");
    let tries = MAX_RETRIES;

    const tick = () => {
      try {
        if (init()) return;
      } catch (e) {
        warn("Fatal error:", e);
        setStatus("❌ JS error. Check console for details.");
        return;
      }

      tries--;
      if (tries <= 0) {
        setStatus("❌ Gave up waiting. If the table never hid, this JS file isn’t loading on the page.");
        warn("Init failed after retries.");
        return;
      }
      setTimeout(tick, RETRY_MS);
    };

    tick();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
