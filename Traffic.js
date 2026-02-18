(function () {
  const CONTAINER_SEL = "td.Component209004";
  const TABLE_SEL = "table.Table209004";
  const MAX_RETRIES = 120;
  const RETRY_MS = 250;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const txt = (el) => (el?.textContent || "").trim();

  function log(...a) { console.log("[WL Traffic]", ...a); }
  function warn(...a) { console.warn("[WL Traffic]", ...a); }

  function addProofBadge() {
    if ($("#wlTrafficProof")) return;
    const b = document.createElement("div");
    b.id = "wlTrafficProof";
    b.textContent = "Traffic.js running ✅";
    b.style.cssText =
      "position:fixed;top:10px;left:10px;z-index:999999;" +
      "padding:10px 12px;background:#111;color:#fff;border-radius:10px;" +
      "font-weight:900;font-size:13px;box-shadow:0 6px 18px rgba(0,0,0,.25)";
    document.body.appendChild(b);
  }

  function ensureStatusUI(anchor) {
    if ($("#wlTrafficDash")) return;

    const wrap = document.createElement("div");
    wrap.id = "wlTrafficDash";
    wrap.style.cssText = "padding:10px;";

    wrap.innerHTML = `
      <div style="margin-bottom:10px; padding:10px 12px; border:1px solid #ddd; border-radius:10px; background:#fff;">
        <div style="font-weight:900; font-size:16px;">Traffic Dashboard</div>
        <div id="wlTrafficStatus" style="opacity:.85; font-size:12px; margin-top:4px;">Starting…</div>
      </div>
    `;

    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(wrap, anchor);
    else document.body.insertBefore(wrap, document.body.firstChild);
  }

  function setStatus(s) {
    const el = $("#wlTrafficStatus");
    if (el) el.textContent = s;
  }

  function forceHide() {
    const comp = $(CONTAINER_SEL);
    const tbl = $(TABLE_SEL);

    let did = false;

    if (comp) {
      comp.style.display = "none";
      comp.style.visibility = "hidden";
      comp.style.height = "0";
      comp.style.overflow = "hidden";
      did = true;
    }
    if (tbl) {
      tbl.style.display = "none";
      tbl.style.visibility = "hidden";
      did = true;
    }

    return { did, compFound: !!comp, tblFound: !!tbl };
  }

  // minimal parse just to confirm the table is populated
  function normHeader(h) {
    return String(h || "").trim().replace(/\s+/g, " ").replace(/[^\w]+/g, "");
  }

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

  function boot() {
    // This must run even when script is injected after DOMContentLoaded
    try {
      addProofBadge();

      // Insert UI anchored near the component if possible
      const anchor = $(CONTAINER_SEL) || $(TABLE_SEL) || document.body.firstChild;
      ensureStatusUI(anchor);

      let tries = MAX_RETRIES;

      const tick = () => {
        const table = $(TABLE_SEL);
        const hideInfo = forceHide();

        if (hideInfo.did) {
          setStatus(`✅ Hidden raw table component (comp:${hideInfo.compFound ? "yes" : "no"} / table:${hideInfo.tblFound ? "yes" : "no"})`);
        } else {
          setStatus(`Waiting for table/component… (${MAX_RETRIES - tries}/${MAX_RETRIES})`);
        }

        // If table exists and has rows, confirm parse
        if (table) {
          const raw = parseTable(table);
          if (raw.length) {
            setStatus(`✅ Table detected + parsed (${raw.length} rows). Next step: render charts/heatmap.`);
            log("Parsed rows:", raw.length, raw[0]);
            return; // stop retrying once confirmed
          }
        }

        tries--;
        if (tries <= 0) {
          setStatus("❌ Gave up waiting for populated table. Table may be rendered differently than expected.");
          warn("Retries exhausted. Check selectors:", CONTAINER_SEL, TABLE_SEL);
          return;
        }
        setTimeout(tick, RETRY_MS);
      };

      tick();
      log("Boot executed (immediate). readyState=", document.readyState);
    } catch (e) {
      console.error("[WL Traffic] Fatal boot error:", e);
    }
  }

  // ✅ Run immediately
  boot();
})();
