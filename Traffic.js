/* Traffic.js - BisTrack Traffic Dashboard (no Chart.js required)
   Source: datatable HTML table rendered somewhere under .Table209004 (or the element itself)
   Output: injects a full dashboard above the source table and hides the source table AFTER successful render.
*/

(function () {
  const SOURCE_CLASS = "Table209004"; // <- what you gave me
  const MAX_RETRIES = 40;
  const RETRY_MS = 350;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function log(...args) { console.log("[WL Traffic]", ...args); }
  function warn(...args) { console.warn("[WL Traffic]", ...args); }

  function safeText(el) { return (el?.textContent ?? "").trim(); }

  function normHeader(h) {
    return String(h || "")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[^\w]+/g, ""); // stable key: "Branch Name" -> "BranchName"
  }

  function toInt(v) {
    const n = parseInt(String(v ?? "").replace(/,/g, "").trim(), 10);
    return Number.isFinite(n) ? n : null;
  }
  function toNum(v) {
    const n = parseFloat(String(v ?? "").replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }

  // --------- locate the datatable (BisTrack can put the class on wrapper, not the table) ---------
  function findSourceTable() {
    const host = document.getElementsByClassName(SOURCE_CLASS)[0];
    if (!host) return null;

    // If the host itself is a table, use it. Otherwise find table inside.
    if (host.tagName && host.tagName.toLowerCase() === "table") return host;

    const t = host.querySelector("table");
    return t || null;
  }

  // --------- parse HTML table to array of objects ---------
  function parseTable(tableEl) {
    const rows = $$("tr", tableEl);
    if (rows.length < 2) return [];

    // header row: prefer th, else first row td
    let headerCells = $$("th", rows[0]);
    if (!headerCells.length) headerCells = $$("td", rows[0]);

    const headers = headerCells.map(c => normHeader(safeText(c)));
    if (!headers.length || headers.every(h => !h)) return [];

    const data = [];
    for (let i = 1; i < rows.length; i++) {
      const cells = $$("td", rows[i]);
      if (!cells.length) continue;

      const obj = {};
      for (let c = 0; c < headers.length; c++) {
        const key = headers[c] || `col${c}`;
        obj[key] = safeText(cells[c]);
      }
      data.push(obj);
    }
    return data;
  }

  // --------- normalize to expected shape from your SQL ---------
  function normalizeRows(raw) {
    const pick = (o, keys) => {
      for (const k of keys) {
        const nk = normHeader(k);
        if (o[nk] !== undefined && o[nk] !== "") return o[nk];
      }
      for (const k of keys) {
        if (o[k] !== undefined && o[k] !== "") return o[k];
      }
      return "";
    };

    return raw.map(r => {
      const Grain = pick(r, ["Grain"]);
      const Scope = pick(r, ["Scope"]);
      const BranchCode = toInt(pick(r, ["BranchCode"]));
      const BranchName = pick(r, ["BranchName"]);
      const XInt = toInt(pick(r, ["XInt"]));
      const XLabel = pick(r, ["XLabel"]);
      const Y = toNum(pick(r, ["Y"]));
      const YInt = toInt(pick(r, ["YInt"]));
      const YLabel = pick(r, ["YLabel"]);
      const V = toNum(pick(r, ["V"]));

      return {
        Grain,
        Scope,
        BranchCode: BranchCode ?? 0,
        BranchName: BranchName || ((BranchCode ?? 0) === 0 ? "All Branches" : `Branch ${BranchCode}`),
        XInt,
        XLabel,
        Y,
        YInt,
        YLabel,
        V
      };
    }).filter(r => r.Grain);
  }

  // --------- UI shell ---------
  function ensureUI(insertBeforeEl) {
    let wrap = $("#wlTrafficDash");
    if (wrap) return wrap;

    wrap = document.createElement("div");
    wrap.id = "wlTrafficDash";
    wrap.style.padding = "10px";

    wrap.innerHTML = `
      <div id="wlTrafficStatus" style="margin-bottom:10px; padding:8px 10px; border:1px solid #ddd; border-radius:10px; background:#fff;">
        <div style="font-weight:700;">Traffic Dashboard</div>
        <div id="wlTrafficStatusText" style="opacity:.75; font-size:12px;">Initializing…</div>
      </div>

      <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:10px;">
        <div style="display:flex; gap:8px; align-items:center;">
          <label style="font-weight:600;">Branch:</label>
          <select id="wlTrafficBranch" style="padding:6px 8px; border:1px solid #ccc; border-radius:8px;"></select>
        </div>
        <div id="wlTrafficScope" style="opacity:.75;"></div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr; gap:12px;">
        <div style="border:1px solid #ddd; border-radius:10px; padding:10px; background:#fff;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div style="font-weight:700;">Hourly Transactions</div>
            <div id="wlHourlyMeta" style="opacity:.7; font-size:12px;"></div>
          </div>
          <div id="wlHourlyChartHost"></div>
        </div>

        <div style="border:1px solid #ddd; border-radius:10px; padding:10px; background:#fff;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div style="font-weight:700;">Weekday Totals</div>
            <div id="wlWeekdayMeta" style="opacity:.7; font-size:12px;"></div>
          </div>
          <div id="wlWeekdayChartHost"></div>
        </div>

        <div style="border:1px solid #ddd; border-radius:10px; padding:10px; background:#fff;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div style="font-weight:700;">Weekday × Hour Heatmap</div>
            <div id="wlHeatMeta" style="opacity:.7; font-size:12px;"></div>
          </div>
          <div id="wlHeatmap" style="overflow:auto;"></div>
        </div>
      </div>
    `;

    insertBeforeEl.parentNode.insertBefore(wrap, insertBeforeEl);
    return wrap;
  }

  function setStatus(text) {
    const el = $("#wlTrafficStatusText");
    if (el) el.textContent = text;
  }

  function uniqueBranches(rows) {
    const map = new Map();
    rows.forEach(r => map.set(r.BranchCode ?? 0, r.BranchName || "All Branches"));
    if (!map.has(0)) map.set(0, "All Branches");
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === 0) return -1;
      if (b[0] === 0) return 1;
      return String(a[1]).localeCompare(String(b[1]));
    });
  }

  function upsertSelect(selectEl, options, selectedValue) {
    selectEl.innerHTML = "";
    for (const [val, label] of options) {
      const opt = document.createElement("option");
      opt.value = String(val);
      opt.textContent = label;
      selectEl.appendChild(opt);
    }
    selectEl.value = String(selectedValue);
  }

  function filterByBranch(rows, branchCode) {
    return rows.filter(r => (r.BranchCode ?? 0) === branchCode);
  }

  function scopeLabel(rows) {
    const s = rows.find(r => r.Scope)?.Scope;
    return s ? `Scope: ${s}` : "";
  }

  // --------- SVG Line chart (no libraries) ---------
  function renderLineChart(host, labels, values) {
    host.innerHTML = "";

    const w = 1000;     // viewBox width
    const h = 260;      // viewBox height
    const padL = 50;
    const padR = 15;
    const padT = 20;
    const padB = 40;

    const max = Math.max(0, ...values);
    const min = 0;

    const innerW = w - padL - padR;
    const innerH = h - padT - padB;

    const x = (i) => padL + (labels.length <= 1 ? 0 : (i * innerW / (labels.length - 1)));
    const y = (v) => padT + (innerH - (max === 0 ? 0 : ((v - min) / (max - min)) * innerH));

    const pts = values.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.style.width = "100%";
    svg.style.height = "240px";
    svg.style.display = "block";

    // axes
    const axis = document.createElementNS(svg.namespaceURI, "path");
    axis.setAttribute("d", `M${padL} ${padT} L${padL} ${h - padB} L${w - padR} ${h - padB}`);
    axis.setAttribute("fill", "none");
    axis.setAttribute("stroke", "#bbb");
    axis.setAttribute("stroke-width", "2");
    svg.appendChild(axis);

    // line
    const poly = document.createElementNS(svg.namespaceURI, "polyline");
    poly.setAttribute("points", pts);
    poly.setAttribute("fill", "none");
    poly.setAttribute("stroke", "#111");
    poly.setAttribute("stroke-width", "3");
    svg.appendChild(poly);

    // dots + tooltips
    values.forEach((v, i) => {
      const c = document.createElementNS(svg.namespaceURI, "circle");
      c.setAttribute("cx", x(i));
      c.setAttribute("cy", y(v));
      c.setAttribute("r", "4");
      c.setAttribute("fill", "#111");
      const title = document.createElementNS(svg.namespaceURI, "title");
      title.textContent = `${labels[i]}: ${v}`;
      c.appendChild(title);
      svg.appendChild(c);
    });

    // y labels (0 and max)
    const y0 = document.createElementNS(svg.namespaceURI, "text");
    y0.setAttribute("x", padL - 8);
    y0.setAttribute("y", h - padB);
    y0.setAttribute("text-anchor", "end");
    y0.setAttribute("dominant-baseline", "middle");
    y0.setAttribute("font-size", "12");
    y0.setAttribute("fill", "#444");
    y0.textContent = "0";
    svg.appendChild(y0);

    const yMax = document.createElementNS(svg.namespaceURI, "text");
    yMax.setAttribute("x", padL - 8);
    yMax.setAttribute("y", padT);
    yMax.setAttribute("text-anchor", "end");
    yMax.setAttribute("dominant-baseline", "middle");
    yMax.setAttribute("font-size", "12");
    yMax.setAttribute("fill", "#444");
    yMax.textContent = String(max);
    svg.appendChild(yMax);

    // x labels (every ~3 ticks)
    const step = Math.max(1, Math.round(labels.length / 10));
    labels.forEach((lab, i) => {
      if (i % step !== 0 && i !== labels.length - 1) return;
      const t = document.createElementNS(svg.namespaceURI, "text");
      t.setAttribute("x", x(i));
      t.setAttribute("y", h - 16);
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("font-size", "12");
      t.setAttribute("fill", "#444");
      t.textContent = lab;
      svg.appendChild(t);
    });

    host.appendChild(svg);
  }

  // --------- Simple bar chart using divs ---------
  function renderBarChart(host, labels, values) {
    host.innerHTML = "";

    const max = Math.max(0, ...values);

    const wrap = document.createElement("div");
    wrap.style.display = "grid";
    wrap.style.gridTemplateColumns = `repeat(${labels.length}, minmax(30px, 1fr))`;
    wrap.style.alignItems = "end";
    wrap.style.gap = "6px";
    wrap.style.height = "220px";
    wrap.style.padding = "6px 2px 0";

    labels.forEach((lab, i) => {
      const v = values[i] ?? 0;
      const bar = document.createElement("div");
      bar.style.height = max === 0 ? "2px" : `${Math.max(2, Math.round((v / max) * 200))}px`;
      bar.style.background = "#111";
      bar.style.borderRadius = "6px 6px 0 0";
      bar.title = `${lab}: ${v}`;

      const col = document.createElement("div");
      col.style.display = "flex";
      col.style.flexDirection = "column";
      col.style.alignItems = "center";
      col.style.justifyContent = "flex-end";
      col.style.height = "100%";

      const x = document.createElement("div");
      x.textContent = lab.slice(0, 3);
      x.style.fontSize = "12px";
      x.style.opacity = "0.7";
      x.style.marginTop = "6px";

      col.appendChild(bar);
      col.appendChild(x);
      wrap.appendChild(col);
    });

    host.appendChild(wrap);
  }

  // --------- Heatmap (HTML grid) ---------
  function renderHeatmap(host, heatRows) {
    host.innerHTML = "";

    const rows = heatRows
      .filter(r => r.Grain === "HEAT" && r.XInt != null && r.YInt != null)
      .sort((a, b) => (a.YInt - b.YInt) || (a.XInt - b.XInt));

    const hours = Array.from(new Set(rows.map(r => r.XInt))).sort((a, b) => a - b);
    const days = Array.from(new Set(rows.map(r => r.YInt))).sort((a, b) => a - b);

    const hourLabels = new Map();
    const dayLabels = new Map();
    rows.forEach(r => {
      if (!hourLabels.has(r.XInt)) hourLabels.set(r.XInt, r.XLabel || String(r.XInt));
      if (!dayLabels.has(r.YInt)) dayLabels.set(r.YInt, r.YLabel || String(r.YInt));
    });

    const key = (d, h) => `${d}|${h}`;
    const m = new Map(rows.map(r => [key(r.YInt, r.XInt), (r.V ?? 0)]));

    const maxV = Math.max(0, ...rows.map(r => r.V ?? 0));
    const bg = (v) => {
      if (!maxV) return "rgba(0,0,0,0.04)";
      const t = Math.max(0, Math.min(1, v / maxV));
      const a = 0.05 + 0.75 * t;
      return `rgba(0,0,0,${a})`;
    };

    const table = document.createElement("table");
    table.style.borderCollapse = "collapse";
    table.style.minWidth = `${Math.max(650, 80 + hours.length * 40)}px`;

    const thead = document.createElement("thead");
    const hr = document.createElement("tr");

    const corner = document.createElement("th");
    corner.textContent = "Day";
    corner.style.position = "sticky";
    corner.style.left = "0";
    corner.style.background = "#fff";
    corner.style.zIndex = "2";
    corner.style.textAlign = "left";
    corner.style.padding = "6px 8px";
    corner.style.borderBottom = "1px solid #ddd";
    hr.appendChild(corner);

    hours.forEach(h => {
      const th = document.createElement("th");
      th.textContent = hourLabels.get(h) ?? h;
      th.style.textAlign = "center";
      th.style.padding = "6px 4px";
      th.style.borderBottom = "1px solid #ddd";
      th.style.fontSize = "12px";
      th.style.whiteSpace = "nowrap";
      hr.appendChild(th);
    });

    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    days.forEach(d => {
      const tr = document.createElement("tr");

      const th = document.createElement("th");
      th.textContent = dayLabels.get(d) ?? d;
      th.style.position = "sticky";
      th.style.left = "0";
      th.style.background = "#fff";
      th.style.zIndex = "1";
      th.style.textAlign = "left";
      th.style.padding = "6px 8px";
      th.style.borderRight = "1px solid #eee";
      th.style.whiteSpace = "nowrap";
      tr.appendChild(th);

      hours.forEach(h => {
        const v = m.get(key(d, h)) ?? 0;
        const td = document.createElement("td");
        td.style.width = "38px";
        td.style.height = "30px";
        td.style.textAlign = "center";
        td.style.fontSize = "12px";
        td.style.color = "#fff";
        td.style.background = bg(v);
        td.style.border = "1px solid rgba(255,255,255,0.08)";
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

  // --------- main render ---------
  function renderDashboard(allRows, branchCode) {
    const scope = $("#wlTrafficScope");
    if (scope) scope.textContent = scopeLabel(allRows);

    const rows = filterByBranch(allRows, branchCode);

    // Hourly
    const hour = rows.filter(r => r.Grain === "HOUR" && r.XInt != null).sort((a,b)=>a.XInt-b.XInt);
    const hourLabels = hour.map(r => r.XLabel || String(r.XInt));
    const hourVals = hour.map(r => r.Y ?? 0);

    $("#wlHourlyMeta").textContent = `Points: ${hourVals.length}`;
    renderLineChart($("#wlHourlyChartHost"), hourLabels, hourVals);

    // Weekday
    const wd = rows.filter(r => r.Grain === "WEEKDAY" && r.XInt != null).sort((a,b)=>a.XInt-b.XInt);
    const wdLabels = wd.map(r => r.XLabel || String(r.XInt));
    const wdVals = wd.map(r => r.Y ?? 0);

    $("#wlWeekdayMeta").textContent = `Points: ${wdVals.length}`;
    renderBarChart($("#wlWeekdayChartHost"), wdLabels, wdVals);

    // Heatmap
    const heatInfo = renderHeatmap($("#wlHeatmap"), rows);
    $("#wlHeatMeta").textContent = `Grid: ${heatInfo.days}×${heatInfo.hours} • Max cell: ${heatInfo.maxV}`;
  }

  // --------- init with retries + observer ---------
  function initOnceTableReady() {
    const tableEl = findSourceTable();
    if (!tableEl) return false;

    const raw = parseTable(tableEl);
    if (raw.length < 3) return false; // table exists but not populated yet

    const rows = normalizeRows(raw);
    if (!rows.length) return false;

    // Build UI above source table
    ensureUI(tableEl);

    // Branch dropdown
    const branchSelect = $("#wlTrafficBranch");
    const branches = uniqueBranches(rows);
    upsertSelect(branchSelect, branches, 0);

    // Render
    setStatus(`Loaded ${rows.length} rows • ${branches.length} branches`);
    renderDashboard(rows, 0);

    branchSelect.addEventListener("change", () => {
      const code = parseInt(branchSelect.value, 10) || 0;
      renderDashboard(rows, code);
    });

    // Hide source table AFTER success (so you can still see it if something fails)
    tableEl.style.display = "none";

    log("Rendered successfully.");
    return true;
  }

  function start() {
    // status banner even if we can't find table yet
    const hostMaybe = document.getElementsByClassName(SOURCE_CLASS)[0];
    if (hostMaybe) {
      const insertTarget = hostMaybe.tagName?.toLowerCase() === "table" ? hostMaybe : (hostMaybe.querySelector("table") || hostMaybe);
      ensureUI(insertTarget);
      setStatus(`Looking for datatable under .${SOURCE_CLASS}…`);
    } else {
      // nothing to insert above yet, but still log
      warn(`Couldn't find any element with class .${SOURCE_CLASS} yet.`);
    }

    // MutationObserver to catch BisTrack rendering after load
    const obs = new MutationObserver(() => {
      if (initOnceTableReady()) obs.disconnect();
    });
    obs.observe(document.body, { childList: true, subtree: true });

    // Also retry loop (covers cases where observer doesn’t fire as expected)
    let tries = MAX_RETRIES;
    const tick = () => {
      if (initOnceTableReady()) return;
      tries--;
      if (tries <= 0) {
        setStatus(`Gave up: table not found/populated under .${SOURCE_CLASS}. Check the class name and that this JS is loaded.`);
        warn("Init failed after retries. Verify class name and script inclusion.");
        return;
      }
      setStatus(`Waiting for datatable… (${MAX_RETRIES - tries}/${MAX_RETRIES})`);
      setTimeout(tick, RETRY_MS);
    };
    setTimeout(tick, 50);

    log("Traffic.js loaded.");
  }

  document.addEventListener("DOMContentLoaded", start);
})();
