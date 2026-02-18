/* Traffic.js - BisTrack Dashboard
   Reads datatable output from table.Table209004 and renders:
   - Branch selector
   - Hourly transactions chart
   - Weekday totals chart
   - Weekday x Hour heatmap

   Assumptions:
   - Datatable output contains columns:
     Grain, Scope, BranchCode, BranchName, XInt, XLabel, Y, YInt, YLabel, V
   - "HOUR" uses XInt/XLabel + Y
   - "WEEKDAY" uses XInt/XLabel + Y
   - "HEAT" uses XInt/XLabel + YInt/YLabel + V
*/

(function () {
  const TABLE_SELECTOR = ".Table209004";

  // ---------- utilities ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function normHeader(h) {
    return String(h || "")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[^\w]+/g, ""); // remove spaces/punct for stable keys
  }

  function toInt(v) {
    const n = parseInt(String(v ?? "").replace(/,/g, "").trim(), 10);
    return Number.isFinite(n) ? n : null;
  }

  function toNum(v) {
    const n = parseFloat(String(v ?? "").replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }

  function safeText(el) {
    return (el?.textContent ?? "").trim();
  }

  // ---------- parse the BisTrack datatable table into objects ----------
  function parseDataTable(tableEl) {
    // Try to find header row: first <tr> that contains <th>, otherwise first row <td>
    const rows = $$("tr", tableEl);
    if (!rows.length) return [];

    let headerCells = $$("th", rows[0]);
    let headerRowIdx = 0;

    if (!headerCells.length) {
      headerCells = $$("td", rows[0]);
    } else {
      headerRowIdx = 0;
    }

    const headers = headerCells.map(c => normHeader(safeText(c)));
    // If headers look empty, bail
    if (headers.every(h => !h)) return [];

    const data = [];
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
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

  // ---------- normalize row object keys to expected names ----------
  function normalizeRows(raw) {
    // Because header names can vary (e.g. "BranchName" vs "Branch Name"),
    // we normalize by trying multiple possible keys.
    const pick = (o, keys) => {
      for (const k of keys) {
        const nk = normHeader(k);
        if (o[nk] !== undefined && o[nk] !== "") return o[nk];
      }
      // also try exact keys (already normalized)
      for (const k of keys) {
        if (o[k] !== undefined && o[k] !== "") return o[k];
      }
      return "";
    };

    return raw.map(r => {
      const Grain = pick(r, ["Grain"]);
      const Scope = pick(r, ["Scope"]);
      const BranchCode = toInt(pick(r, ["BranchCode", "Branch"]));
      const BranchName = pick(r, ["BranchName", "BranchNm", "Name"]);
      const XInt = toInt(pick(r, ["XInt", "X"]));
      const XLabel = pick(r, ["XLabel", "XLabelText", "XName"]);
      const Y = toNum(pick(r, ["Y", "TxnCount", "Count"]));
      const YInt = toInt(pick(r, ["YInt", "YIndex", "YDay"]));
      const YLabel = pick(r, ["YLabel", "YLabelText", "YName"]);
      const V = toNum(pick(r, ["V", "Value"]));

      return {
        Grain,
        Scope,
        BranchCode: BranchCode ?? 0,
        BranchName: BranchName || (BranchCode === 0 ? "All Branches" : `Branch ${BranchCode}`),
        XInt,
        XLabel,
        Y,
        YInt,
        YLabel,
        V
      };
    }).filter(r => r.Grain); // keep only valid
  }

  // ---------- build dashboard skeleton ----------
  function ensureContainer() {
    // We’ll insert our layout just above the source table (and optionally hide it)
    const tableEl = $(TABLE_SELECTOR);
    if (!tableEl) return null;

    const wrap = document.createElement("div");
    wrap.id = "wlTrafficDash";
    wrap.style.padding = "10px";

    wrap.innerHTML = `
      <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:10px;">
        <div style="font-weight:700; font-size:18px;">Traffic Dashboard</div>
        <div style="display:flex; gap:8px; align-items:center;">
          <label style="font-weight:600;">Branch:</label>
          <select id="wlTrafficBranch" style="padding:6px 8px; border:1px solid #ccc; border-radius:6px;"></select>
        </div>
        <div id="wlTrafficScope" style="opacity:.75;"></div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr; gap:12px;">
        <div style="border:1px solid #ddd; border-radius:10px; padding:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div style="font-weight:700;">Hourly Transactions</div>
            <div id="wlHourlyMeta" style="opacity:.7; font-size:12px;"></div>
          </div>
          <canvas id="wlHourlyChart" height="110" style="width:100%;"></canvas>
          <div id="wlHourlyFallback" style="display:none;"></div>
        </div>

        <div style="border:1px solid #ddd; border-radius:10px; padding:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div style="font-weight:700;">Weekday Totals</div>
            <div id="wlWeekdayMeta" style="opacity:.7; font-size:12px;"></div>
          </div>
          <canvas id="wlWeekdayChart" height="110" style="width:100%;"></canvas>
          <div id="wlWeekdayFallback" style="display:none;"></div>
        </div>

        <div style="border:1px solid #ddd; border-radius:10px; padding:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div style="font-weight:700;">Weekday × Hour Heatmap</div>
            <div id="wlHeatMeta" style="opacity:.7; font-size:12px;"></div>
          </div>
          <div id="wlHeatmap" style="overflow:auto;"></div>
        </div>
      </div>
    `;

    // insert before the table
    tableEl.parentNode.insertBefore(wrap, tableEl);

    // Optional: hide the raw datatable (keep it if you want to debug)
    tableEl.style.display = "none";

    return wrap;
  }

  // ---------- render helpers ----------
  function uniqueBranches(rows) {
    const map = new Map();
    rows.forEach(r => {
      const code = r.BranchCode ?? 0;
      if (!map.has(code)) map.set(code, r.BranchName || (code === 0 ? "All Branches" : `Branch ${code}`));
    });
    // Ensure 0 exists
    if (!map.has(0)) map.set(0, "All Branches");
    // sort: All first, then by name
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === 0) return -1;
      if (b[0] === 0) return 1;
      return String(a[1]).localeCompare(String(b[1]));
    });
  }

  function getScopeLabel(rows) {
    const s = rows.find(r => r.Scope)?.Scope;
    return s ? `Scope: ${s}` : "";
  }

  function filterByBranch(rows, branchCode) {
    return rows.filter(r => (r.BranchCode ?? 0) === branchCode);
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

  // ---------- charts (Chart.js if available, fallback to table) ----------
  let hourlyChartInstance = null;
  let weekdayChartInstance = null;

  function renderHourly(rows) {
    const ctx = $("#wlHourlyChart");
    const fallback = $("#wlHourlyFallback");
    const meta = $("#wlHourlyMeta");

    const hourRows = rows.filter(r => r.Grain === "HOUR" && r.XInt !== null);
    hourRows.sort((a, b) => (a.XInt ?? 0) - (b.XInt ?? 0));

    const labels = hourRows.map(r => r.XLabel || String(r.XInt));
    const values = hourRows.map(r => r.Y ?? 0);

    meta.textContent = `Hours: ${labels.length}`;

    if (window.Chart && ctx) {
      fallback.style.display = "none";
      ctx.style.display = "block";

      if (hourlyChartInstance) hourlyChartInstance.destroy();

      hourlyChartInstance = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [{ label: "Transactions", data: values, tension: 0.25 }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0 } }
          }
        }
      });
    } else {
      // fallback simple table
      ctx.style.display = "none";
      fallback.style.display = "block";
      fallback.innerHTML = buildMiniTable(labels, values, "Hour", "Txns");
    }
  }

  function renderWeekday(rows) {
    const ctx = $("#wlWeekdayChart");
    const fallback = $("#wlWeekdayFallback");
    const meta = $("#wlWeekdayMeta");

    const dayRows = rows.filter(r => r.Grain === "WEEKDAY" && r.XInt !== null);
    dayRows.sort((a, b) => (a.XInt ?? 0) - (b.XInt ?? 0));

    const labels = dayRows.map(r => r.XLabel || String(r.XInt));
    const values = dayRows.map(r => r.Y ?? 0);

    meta.textContent = `Days: ${labels.length}`;

    if (window.Chart && ctx) {
      fallback.style.display = "none";
      ctx.style.display = "block";

      if (weekdayChartInstance) weekdayChartInstance.destroy();

      weekdayChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [{ label: "Transactions", data: values }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0 } }
          }
        }
      });
    } else {
      ctx.style.display = "none";
      fallback.style.display = "block";
      fallback.innerHTML = buildMiniTable(labels, values, "Weekday", "Txns");
    }
  }

  function buildMiniTable(labels, values, colA, colB) {
    const rows = labels.map((l, i) => `<tr><td style="padding:4px 8px; border-bottom:1px solid #eee;">${l}</td><td style="padding:4px 8px; border-bottom:1px solid #eee; text-align:right;">${values[i]}</td></tr>`).join("");
    return `
      <table style="width:100%; border-collapse:collapse; font-size:13px;">
        <thead>
          <tr>
            <th style="text-align:left; padding:4px 8px; border-bottom:1px solid #ddd;">${colA}</th>
            <th style="text-align:right; padding:4px 8px; border-bottom:1px solid #ddd;">${colB}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  // ---------- heatmap (HTML grid) ----------
  function renderHeatmap(rows) {
    const host = $("#wlHeatmap");
    const meta = $("#wlHeatMeta");

    const heatRows = rows.filter(r => r.Grain === "HEAT" && r.XInt !== null && r.YInt !== null);
    heatRows.sort((a, b) => (a.YInt - b.YInt) || (a.XInt - b.XInt));

    // Build dimensions
    const hours = Array.from(new Set(heatRows.map(r => r.XInt))).sort((a, b) => a - b);
    const days = Array.from(new Set(heatRows.map(r => r.YInt))).sort((a, b) => a - b);

    // map for lookup
    const key = (d, h) => `${d}|${h}`;
    const m = new Map();
    heatRows.forEach(r => m.set(key(r.YInt, r.XInt), r.V ?? 0));

    const maxV = Math.max(0, ...heatRows.map(r => r.V ?? 0));
    meta.textContent = `Days: ${days.length} • Hours: ${hours.length} • Max cell: ${maxV}`;

    // Header labels
    const hourLabels = new Map();
    heatRows.forEach(r => {
      if (!hourLabels.has(r.XInt)) hourLabels.set(r.XInt, r.XLabel || String(r.XInt));
    });

    const dayLabels = new Map();
    heatRows.forEach(r => {
      if (!dayLabels.has(r.YInt)) dayLabels.set(r.YInt, r.YLabel || String(r.YInt));
    });

    // Color scale (no external libs): rgba black overlay based on intensity
    const cellBg = (v) => {
      if (!maxV) return "rgba(0,0,0,0.02)";
      const t = Math.max(0, Math.min(1, v / maxV));
      // intensity from 0.05 to 0.75
      const a = 0.05 + (0.70 * t);
      return `rgba(0,0,0,${a})`;
    };

    // Build HTML table heatmap
    let html = `
      <table style="border-collapse:collapse; min-width:${Math.max(650, 80 + hours.length * 40)}px;">
        <thead>
          <tr>
            <th style="position:sticky; left:0; background:#fff; z-index:2; text-align:left; padding:6px 8px; border-bottom:1px solid #ddd;">Day</th>
            ${hours.map(h => `
              <th style="text-align:center; padding:6px 4px; border-bottom:1px solid #ddd; font-size:12px; white-space:nowrap;">
                ${hourLabels.get(h) ?? h}
              </th>`).join("")}
          </tr>
        </thead>
        <tbody>
    `;

    for (const d of days) {
      html += `<tr>
        <th style="position:sticky; left:0; background:#fff; z-index:1; text-align:left; padding:6px 8px; border-right:1px solid #eee; white-space:nowrap;">
          ${dayLabels.get(d) ?? d}
        </th>`;

      for (const h of hours) {
        const v = m.get(key(d, h)) ?? 0;
        html += `
          <td title="${dayLabels.get(d) ?? d} @ ${hourLabels.get(h) ?? h}: ${v}"
              style="width:38px; height:30px; text-align:center; font-size:12px; color:#fff; background:${cellBg(v)}; border:1px solid rgba(255,255,255,0.08);">
            ${v ? v : ""}
          </td>`;
      }

      html += `</tr>`;
    }

    html += `</tbody></table>`;
    host.innerHTML = html;
  }

  // ---------- main render ----------
  function renderAll(allRows, branchCode) {
    const scopeEl = $("#wlTrafficScope");
    if (scopeEl) scopeEl.textContent = getScopeLabel(allRows);

    // Filter rows by selected branch
    const branchRows = filterByBranch(allRows, branchCode);

    renderHourly(branchRows);
    renderWeekday(branchRows);
    renderHeatmap(branchRows);
  }

  // ---------- init ----------
  function initTrafficDashboard() {
    const tableEl = $(TABLE_SELECTOR);
    if (!tableEl) {
      console.warn("[Traffic.js] Source table not found:", TABLE_SELECTOR);
      return;
    }

    const raw = parseDataTable(tableEl);
    const rows = normalizeRows(raw);

    if (!rows.length) {
      console.warn("[Traffic.js] No rows parsed from datatable table.");
      return;
    }

    ensureContainer();

    const branchSelect = $("#wlTrafficBranch");
    const branches = uniqueBranches(rows);

    upsertSelect(branchSelect, branches, 0);

    // initial render (All Branches)
    renderAll(rows, 0);

    branchSelect.addEventListener("change", () => {
      const code = parseInt(branchSelect.value, 10) || 0;
      renderAll(rows, code);
    });

    console.log("[Traffic.js] Loaded rows:", rows.length, "branches:", branches.length);
  }

  // Run when DOM is ready (BisTrack dashboards sometimes load late, so retry a few times)
  function initWithRetry(tries = 20) {
    const tableEl = $(TABLE_SELECTOR);
    if (tableEl) return initTrafficDashboard();

    if (tries <= 0) {
      console.warn("[Traffic.js] Table never appeared:", TABLE_SELECTOR);
      return;
    }
    setTimeout(() => initWithRetry(tries - 1), 300);
  }

  document.addEventListener("DOMContentLoaded", () => initWithRetry());
})();
