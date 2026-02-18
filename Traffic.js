(function () {
  const CONTAINER_SEL = "td.Component209004";        // your wrapper
  const TABLE_SEL = "table.Table209004";             // your actual table
  const MAX_RETRIES = 60;
  const RETRY_MS = 300;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const txt = (el) => (el?.textContent || "").trim();

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
    const rows = $$("tr", tableEl);
    if (rows.length < 2) return [];

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

  function ensureUI(insertBeforeEl) {
    let wrap = $("#wlTrafficDash");
    if (wrap) return wrap;

    wrap = document.createElement("div");
    wrap.id = "wlTrafficDash";
    wrap.style.cssText = "padding:10px; background:transparent;";

    wrap.innerHTML = `
      <div style="margin-bottom:10px; padding:10px 12px; border:1px solid #ddd; border-radius:10px; background:#fff;">
        <div style="font-weight:800; font-size:16px;">Traffic Dashboard</div>
        <div id="wlTrafficStatus" style="opacity:.75; font-size:12px; margin-top:2px;">Initializing…</div>
      </div>

      <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:10px;">
        <div style="display:flex; gap:8px; align-items:center;">
          <label style="font-weight:700;">Branch:</label>
          <select id="wlTrafficBranch" style="padding:6px 8px; border:1px solid #ccc; border-radius:8px;"></select>
        </div>
        <div id="wlTrafficScope" style="opacity:.75;"></div>
      </div>

      <div style="display:grid; grid-template-columns:1fr; gap:12px;">
        <div style="border:1px solid #ddd; border-radius:10px; padding:10px; background:#fff;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:800;">Hourly Transactions</div>
            <div id="wlHourlyMeta" style="opacity:.7; font-size:12px;"></div>
          </div>
          <div id="wlHourlyHost" style="margin-top:8px;"></div>
        </div>

        <div style="border:1px solid #ddd; border-radius:10px; padding:10px; background:#fff;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:800;">Weekday Totals</div>
            <div id="wlWeekdayMeta" style="opacity:.7; font-size:12px;"></div>
          </div>
          <div id="wlWeekdayHost" style="margin-top:8px;"></div>
        </div>

        <div style="border:1px solid #ddd; border-radius:10px; padding:10px; background:#fff;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:800;">Weekday × Hour Heatmap</div>
            <div id="wlHeatMeta" style="opacity:.7; font-size:12px;"></div>
          </div>
          <div id="wlHeatHost" style="margin-top:8px; overflow:auto;"></div>
        </div>
      </div>
    `;

    insertBeforeEl.parentNode.insertBefore(wrap, insertBeforeEl);
    return wrap;
  }

  function setStatus(s) {
    const el = $("#wlTrafficStatus");
    if (el) el.textContent = s;
  }

  function getScope(rows) {
    return rows.find(r => r.Scope)?.Scope || "";
  }

  function uniqueBranches(rows) {
    const m = new Map();
    rows.forEach(r => m.set(r.BranchCode, r.BranchName));
    if (!m.has(0)) m.set(0, "All Branches");
    return Array.from(m.entries()).sort((a, b) => {
      if (a[0] === 0) return -1;
      if (b[0] === 0) return 1;
      return String(a[1]).localeCompare(String(b[1]));
    });
  }

  function renderLineSVG(host, labels, values) {
    host.innerHTML = "";
    const w = 1000, h = 240, padL = 50, padR = 15, padT = 15, padB = 35;
    const innerW = w - padL - padR, innerH = h - padT - padB;
    const max = Math.max(0, ...values);
    const x = (i) => padL + (labels.length <= 1 ? 0 : i * innerW / (labels.length - 1));
    const y = (v) => padT + (innerH - (max ? (v / max) * innerH : 0));
    const pts = values.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.style.cssText = "width:100%; height:220px; display:block;";

    const axis = document.createElementNS(svg.namespaceURI, "path");
    axis.setAttribute("d", `M${padL} ${padT} L${padL} ${h - padB} L${w - padR} ${h - padB}`);
    axis.setAttribute("fill", "none");
    axis.setAttribute("stroke", "#bbb");
    axis.setAttribute("stroke-width", "2");
    svg.appendChild(axis);

    const line = document.createElementNS(svg.namespaceURI, "polyline");
    line.setAttribute("points", pts);
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", "#111");
    line.setAttribute("stroke-width", "3");
    svg.appendChild(line);

    values.forEach((v, i) => {
      const c = document.createElementNS(svg.namespaceURI, "circle");
      c.setAttribute("cx", x(i));
      c.setAttribute("cy", y(v));
      c.setAttribute("r", "4");
      c.setAttribute("fill", "#111");
      const t = document.createElementNS(svg.namespaceURI, "title");
      t.textContent = `${labels[i]}: ${v}`;
      c.appendChild(t);
      svg.appendChild(c);
    });

    host.appendChild(svg);
  }

  function renderBars(host, labels, values) {
    host.innerHTML = "";
    const max = Math.max(0, ...values);

    const grid = document.createElement("div");
    grid.style.cssText = `display:grid; grid-template-columns: repeat(${labels.length}, minmax(30px, 1fr)); gap:6px; height:210px; align-items:end;`;

    labels.forEach((lab, i) => {
      const v = values[i] ?? 0;

      const col = document.createElement("div");
      col.style.cssText = "display:flex; flex-direction:column; align-items:center; justify-content:flex-end; height:100%;";

      const bar = document.createElement("div");
      bar.style.cssText = `width:100%; background:#111; border-radius:8px 8px 0 0;`;
      bar.style.height = max ? `${Math.max(2, Math.round((v / max) * 190))}px` : "2px";
      bar.title = `${lab}: ${v}`;

      const x = document.createElement("div");
      x.textContent = lab.slice(0,3);
      x.style.cssText = "font-size:12px; opacity:.7; margin-top:6px;";

      col.appendChild(bar);
      col.appendChild(x);
      grid.appendChild(col);
    });

    host.appendChild(grid);
  }

  function renderHeat(host, rows) {
    host.innerHTML = "";

    const heat = rows.filter(r => r.Grain === "HEAT" && r.XInt != null && r.YInt != null);
    const hours = Array.from(new Set(heat.map(r => r.XInt))).sort((a,b)=>a-b);
    const days = Array.from(new Set(heat.map(r => r.YInt))).sort((a,b)=>a-b);

    const hourLabels = new Map();
    const dayLabels = new Map();
    heat.forEach(r => {
      if (!hourLabels.has(r.XInt)) hourLabels.set(r.XInt, r.XLabel || String(r.XInt));
      if (!dayLabels.has(r.YInt)) dayLabels.set(r.YInt, r.YLabel || String(r.YInt));
    });

    const key = (d,h)=>`${d}|${h}`;
    const m = new Map(heat.map(r => [key(r.YInt, r.XInt), r.V ?? 0]));
    const maxV = Math.max(0, ...heat.map(r => r.V ?? 0));
    const bg = (v) => {
      if (!maxV) return "rgba(0,0,0,0.04)";
      const t = Math.max(0, Math.min(1, v / maxV));
      return `rgba(0,0,0,${0.06 + 0.74 * t})`;
    };

    const table = document.createElement("table");
    table.style.cssText = "border-collapse:collapse; min-width:900px;";

    const thead = document.createElement("thead");
    const trh = document.createElement("tr");

    const corner = document.createElement("th");
    corner.textContent = "Day";
    corner.style.cssText = "position:sticky; left:0; z-index:2; background:#fff; text-align:left; padding:6px 8px; border-bottom:1px solid #ddd;";
    trh.appendChild(corner);

    hours.forEach(h => {
      const th = document.createElement("th");
      th.textContent = hourLabels.get(h) ?? h;
      th.style.cssText = "text-align:center; padding:6px 4px; border-bottom:1px solid #ddd; font-size:12px; white-space:nowrap;";
      trh.appendChild(th);
    });

    thead.appendChild(trh);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    days.forEach(d => {
      const tr = document.createElement("tr");

      const th = document.createElement("th");
      th.textContent = dayLabels.get(d) ?? d;
      th.style.cssText = "position:sticky; left:0; z-index:1; background:#fff; text-align:left; padding:6px 8px; border-right:1px solid #eee; white-space:nowrap;";
      tr.appendChild(th);

      hours.forEach(h => {
        const v = m.get(key(d,h)) ?? 0;
        const td = document.createElement("td");
        td.style.cssText = `width:38px; height:30px; text-align:center; font-size:12px; color:#fff; background:${bg(v)}; border:1px solid rgba(255,255,255,0.08);`;
        td.title = `${dayLabels.get(d) ?? d} @ ${hourLabels.get(h) ?? h}: ${v}`;
        td.textContent = v ? String(v) : "";
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    host.appendChild(table);

    return { maxV, days: days.length, hours: hours.length };
  }

  function renderAll(allRows, branchCode) {
    const rows = allRows.filter(r => r.BranchCode === branchCode);

    $("#wlTrafficScope").textContent = `Scope: ${getScope(allRows)}`;

    // Hour
    const hour = rows.filter(r => r.Grain === "HOUR" && r.XInt != null).sort((a,b)=>a.XInt-b.XInt);
    const hLabels = hour.map(r => r.XLabel || String(r.XInt));
    const hVals = hour.map(r => r.Y ?? 0);
    $("#wlHourlyMeta").textContent = `Points: ${hVals.length}`;
    renderLineSVG($("#wlHourlyHost"), hLabels, hVals);

    // Weekday
    const wd = rows.filter(r => r.Grain === "WEEKDAY" && r.XInt != null).sort((a,b)=>a.XInt-b.XInt);
    const wLabels = wd.map(r => r.XLabel || String(r.XInt));
    const wVals = wd.map(r => r.Y ?? 0);
    $("#wlWeekdayMeta").textContent = `Points: ${wVals.length}`;
    renderBars($("#wlWeekdayHost"), wLabels, wVals);

    // Heat
    const info = renderHeat($("#wlHeatHost"), rows);
    $("#wlHeatMeta").textContent = `Grid: ${info.days}×${info.hours} • Max cell: ${info.maxV}`;
  }

  function init() {
    const comp = $(CONTAINER_SEL);
    const table = $(CONTAINER_SEL + " " + TABLE_SEL);

    if (!comp || !table) return false;

    const headerOk = !!$("thead tr", table);
    if (!headerOk) return false;

    const raw = parseTable(table);
    if (raw.length < 5) return false;

    const rows = normalizeRows(raw);
    if (!rows.length) return false;

    // Insert UI above the scroll div (parent of table)
    const scrollDiv = table.closest("div") || table;
    ensureUI(scrollDiv);

    const branches = uniqueBranches(rows);
    const sel = $("#wlTrafficBranch");
    upsertSelect(sel, branches, 0);

    setStatus(`Loaded ${rows.length} rows • ${branches.length} branches`);
    renderAll(rows, 0);

    sel.addEventListener("change", () => {
      const code = parseInt(sel.value, 10) || 0;
      renderAll(rows, code);
    });

    // Hide source table after success
    scrollDiv.style.display = "none";

    console.log("[WL Traffic] Rendered ✅", { rows: rows.length, branches: branches.length });
    return true;
  }

  function boot() {
    console.log("[WL Traffic] Traffic.js loaded");
    let tries = MAX_RETRIES;

    const tick = () => {
      if (init()) return;
      tries--;
      if (tries <= 0) {
        console.warn("[WL Traffic] Failed to init. Check selectors:", CONTAINER_SEL, TABLE_SEL);
        return;
      }
      setTimeout(tick, RETRY_MS);
    };

    tick();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
