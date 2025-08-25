
/* ==========================================================
   Woodson — Saved For Later (SFL) — perf-tuned
   - Starts exactly 1s after DOMContentLoaded
   - Caches quicklist detail URL per-session; no re-create loop
   - Fast PDP postbacks via fetch (no iframes)
   - Parallel image lookups with small concurrency
   - No full page reload after add/remove; SFL re-renders instead
   ========================================================== */
(function () {
  'use strict';

  const SFL_NAME = "Saved For Later";
  const SFL_DESC = "Saved For Later";
  const BASE = location.origin + "/";
  const SFL_URL_KEY = "sfl_detail_url";
  const IMG_API = "https://wlmarketingdashboard.vercel.app/api/get-product-image";

  // ---------- utils ----------
  const $  = (s, r=document)=> r.querySelector(s);
  const $$ = (s, r=document)=> Array.from(r.querySelectorAll(s));
  const visible = el => el && el.offsetParent !== null;

  async function fetchHtml(url, options={}) {
    const res = await fetch(url, { credentials: "include", ...options });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const text = await res.text();
    const doc  = new DOMParser().parseFromString(text, "text/html");
    return { text, doc, res };
  }
  function hiddenFields(doc){
    const out={};
    $$('input[type="hidden"]', doc).forEach(i => { if (i.name) out[i.name] = i.value ?? ""; });
    return out;
  }
  function toFD(obj){ const fd=new FormData(); for (const [k,v] of Object.entries(obj)) fd.append(k,v); return fd; }
  function pidFromHref(href){ try{ return new URL(href, BASE).searchParams.get("pid"); }catch{ return null; } }

  // ---------- container ----------
  function ensureContainer() {
    let c = $("#savedForLater");
    if (!c) {
      c = document.createElement("div");
      c.id = "savedForLater";
      c.style.display = "none";
      c.innerHTML = `
        <div id="sflHeader">
          <span>Saved For Later</span>
          <span class="sflCount" id="sflCount"></span>
        </div>
        <div id="sflBody">
          <div id="sflLoading">Loading your saved items…</div>
          <div id="sflList" style="display:none;"></div>
          <div id="sflEmpty" style="display:none;">No items saved for later.</div>
        </div>`;
      const main = document.querySelector('.mainContents');
      if (main?.parentNode) main.parentNode.insertBefore(c, main.nextSibling);
      else document.body.appendChild(c);
    }
    c.style.display = "block";
    return c;
  }
  function setLoading(msg="Loading your saved items…"){
    $("#sflLoading").style.display = "block";
    $("#sflLoading").textContent = msg;
    $("#sflList").style.display = "none";
    $("#sflEmpty").style.display = "none";
  }
  function setEmpty(){
    $("#sflLoading").style.display = "none";
    $("#sflList").style.display = "none";
    $("#sflEmpty").style.display = "block";
    $("#sflCount").textContent = "(0)";
  }
  function setCount(n){ $("#sflCount").textContent = `(${n})`; }

  // ---------- quicklist discovery / cache ----------
  async function findSFL() {
    const { doc } = await fetchHtml(BASE + "Quicklists_R.aspx");
    const table = doc.querySelector("table.rgMasterTable");
    if (!table) return null;
    for (const tr of $$("tbody > tr", table)) {
      const a = tr.querySelector('td a[href*="Quicklists_R.aspx"]');
      if (!a) continue;
      if ((a.textContent || "").trim().toLowerCase() === SFL_NAME.toLowerCase()) {
        return new URL(a.getAttribute("href"), BASE).toString();
      }
    }
    return null;
  }

  async function createSFL() {
    const addUrl = BASE + "Quicklists_R.aspx?addNew=1";
    const { doc } = await fetchHtml(addUrl);
    const hidden = hiddenFields(doc);
    hidden["ctl00$PageBody$EditQuicklistName"] = SFL_NAME;
    hidden["ctl00$PageBody$EditQuicklistDescription"] = SFL_DESC;
    const def = $("#ctl00_PageBody_EditDefaultQuicklistDropdown", doc);
    hidden["ctl00$PageBody$EditDefaultQuicklistDropdown"] = def ? (def.value || "no") : "no";
    hidden["__EVENTTARGET"] = "ctl00$PageBody$SaveQuickListButton";
    hidden["__EVENTARGUMENT"] = "";
    await fetch(addUrl, { method: "POST", credentials:"include", body: toFD(hidden) });
    const found = await findSFL();
    if (!found) throw new Error("Quicklist creation failed");
    return found;
  }

  async function getSFLUrl() {
    const cached = sessionStorage.getItem(SFL_URL_KEY);
    if (cached) return cached;
    const found = await findSFL();
    if (found) { sessionStorage.setItem(SFL_URL_KEY, found); return found; }
    const created = await createSFL();
    sessionStorage.setItem(SFL_URL_KEY, created);
    return created;
  }

  // ---------- SFL loading / parsing ----------
  function parseItems(detailDoc){
    const grid = detailDoc.querySelector(".RadGrid, table.rgMasterTable");
    const table = grid?.tagName === "TABLE" ? grid : grid?.querySelector("table.rgMasterTable");
    if (!table) return [];
    const rows = table.querySelectorAll("tr.rgRow, tr.rgAltRow");
    const items = [];
    rows.forEach(tr => {
      const tds = tr.querySelectorAll("td");
      if (tds.length < 5) return;
      const a = tds[0].querySelector("a[href*='ProductDetail.aspx']");
      const href  = a?.getAttribute("href") || null;
      const code  = a?.textContent.trim() || "";
      const desc  = tds[1].textContent.trim();
      const price = tds[2].textContent.trim();
      const per   = tds[3].textContent.trim();
      // Delete target (if we need to trigger server delete directly)
      const delA  = tr.querySelector("a[id*='DeleteQuicklistLineButtonX']");
      const m = (delA?.getAttribute("href") || "").match(/__doPostBack\('([^']+)'/);
      const eventTarget = m ? m[1] : null;
      items.push({ href, code, desc, price, per, eventTarget });
    });
    return items;
  }

  async function loadSFL() {
    const url = await getSFLUrl();
    const { doc } = await fetchHtml(url);
    return { url, items: parseItems(doc) };
  }

  // ---------- PDP actions (fast postbacks; no iframe) ----------
  async function pdpPostback(pid, detector) {
    const pdpUrl = BASE + "ProductDetail.aspx?pid=" + encodeURIComponent(pid);
    const { doc } = await fetchHtml(pdpUrl);
    const hid = hiddenFields(doc);

    // Add-to-cart button target
    if (detector === "ADD_TO_CART") {
      let target = null;
      const atc = doc.querySelector('a[href^="javascript:__doPostBack"][id*="AddProductButton"]');
      if (atc) {
        const m = atc.getAttribute("href").match(/__doPostBack\('([^']+)'/);
        if (m) target = m[1];
      }
      target = target || "ctl00$PageBody$productDetail$ctl00$AddProductButton";
      hid["__EVENTTARGET"]   = target;
      hid["__EVENTARGUMENT"] = "";
      await fetch(pdpUrl, { method:"POST", credentials:"include", body: toFD(hid) });
      return true;
    }

    // Add to Saved For Later (Quicklist)
    if (detector === "ADD_TO_SFL") {
      let target = null;
      // Prefer the explicit “Add to Saved For Later” link
      const sflA = Array.from(doc.querySelectorAll("a"))
        .find(a => (a.textContent || "").trim() === "Add to Saved For Later");
      if (sflA) {
        const m = (sflA.getAttribute("href") || "").match(/__doPostBack\('([^']+)'/);
        if (m) target = m[1];
      }
      // Fallback: typical button id pattern if link text changes
      target = target || "ctl00$PageBody$productDetail$ctl00$AddToQuicklistButton";

      hid["__EVENTTARGET"]   = target;
      hid["__EVENTARGUMENT"] = "";
      await fetch(pdpUrl, { method:"POST", credentials:"include", body: toFD(hid) });
      return true;
    }

    throw new Error("Unknown PDP postback type");
  }

  async function addPidToCart(pid, qty=1) {
    if (!pid) throw new Error("PID required");
    // qty set if PDP exposes it
    const pdpUrl = BASE + "ProductDetail.aspx?pid=" + encodeURIComponent(pid);
    const { doc } = await fetchHtml(pdpUrl);
    const hid = hiddenFields(doc);
    const qtyInput = doc.querySelector('input[name*="qty"]');
    if (qtyInput?.name) hid[qtyInput.name] = String(qty);

    let target = null;
    const atc = doc.querySelector('a[href^="javascript:__doPostBack"][id*="AddProductButton"]');
    if (atc) {
      const m = atc.getAttribute("href").match(/__doPostBack\('([^']+)'/);
      if (m) target = m[1];
    }
    target = target || "ctl00$PageBody$productDetail$ctl00$AddProductButton";
    hid["__EVENTTARGET"]   = target;
    hid["__EVENTARGUMENT"] = "";
    await fetch(pdpUrl, { method:"POST", credentials:"include", body: toFD(hid) });
    return true;
  }

  // ---------- quicklist delete (by product code) ----------
  async function removeFromQuicklistByCode(productCode) {
    const url = await getSFLUrl();
    const { doc } = await fetchHtml(url);
    const form = doc.querySelector("form");
    if (!form) throw new Error("Quicklist form not found");
    const hid = hiddenFields(doc);

    // find delete button for the matching code
    let target = null;
    for (const tr of $$("tr.rgRow, tr.rgAltRow", doc)) {
      const a = tr.querySelector("td a[href*='ProductDetail.aspx']");
      const code = (a?.textContent || "").trim().toUpperCase();
      if (code !== (productCode || "").toUpperCase()) continue;
      const delA = tr.querySelector("a[id*='DeleteQuicklistLineButtonX']");
      const m = (delA?.getAttribute("href") || "").match(/__doPostBack\('([^']+)'/);
      if (m) { target = m[1]; break; }
    }
    if (!target) throw new Error("Delete target not found");

    hid["__EVENTTARGET"]   = target;
    hid["__EVENTARGUMENT"] = "";

    const postUrl = new URL(form.getAttribute("action"), url).href;
    await fetch(postUrl, {
      method: "POST",
      credentials: "include",
      body: new URLSearchParams(hid) // urlencoded ok here
    });
  }

  // ---------- render ----------
  async function concurrentMap(items, limit, worker) {
    const ret = new Array(items.length);
    let idx = 0, active = 0;
    return new Promise((resolve) => {
      const kick = () => {
        while (active < limit && idx < items.length) {
          const my = idx++;
          active++;
          Promise.resolve(worker(items[my], my))
            .then(v => { ret[my] = v; })
            .catch(()=>{}) // ignore image fails
            .finally(()=>{ active--; (idx >= items.length && active === 0) ? resolve(ret) : kick(); });
        }
      };
      kick();
    });
  }

  async function renderSFL(items){
    const list = $("#sflList");
    list.innerHTML = "";
    if (!items.length) { setEmpty(); return; }

    // Pre-render rows quickly
    const placeholder = "https://images-woodsonlumber.sirv.com/Other%20Website%20Images/placeholder.png";
    items.forEach(it => {
      const pid = it.href ? pidFromHref(it.href) : null;
      const productUrl = pid ? `${BASE}ProductDetail.aspx?pid=${pid}` : "#";
      const row = document.createElement("div");
      row.className = "sflRow";
      row.dataset.pid = pid || "";
      row.dataset.code = it.code || "";
      row.innerHTML = `
        <div class="sflImgWrapper">
          <a href="${productUrl}" target="_blank"><img class="sflImg" src="${placeholder}" alt=""></a>
        </div>
        <div>
          <div class="sflTitle">${it.code || ""}</div>
          <div class="sflDesc">${it.desc || ""}</div>
        </div>
        <div class="sflPrice">${it.price || ""}</div>
        <div class="sflPer">${it.per || ""}</div>
        <div class="sflActions">
          <button class="sflBtn js-sfl-add" data-pid="${pid || ""}" data-code="${it.code || ""}">Add to Cart</button>
        </div>`;
      list.appendChild(row);
    });

    // Fetch images in parallel (limit 4)
    const rows = $$(".sflRow", list);
    await concurrentMap(rows, 4, async (row) => {
      const pid = row.dataset.pid;
      if (!pid) return;
      const productUrl = `${BASE}ProductDetail.aspx?pid=${pid}`;
      try {
        const r = await fetch(IMG_API, {
          method:"POST", headers:{ "Content-Type":"application/json" },
          body: JSON.stringify({ productUrl })
        });
        const j = await r.json();
        if (j.imageUrl) row.querySelector(".sflImg").src = j.imageUrl;
      } catch {}
    });

    setCount(items.length);
    $("#sflLoading").style.display = "none";
    $("#sflEmpty").style.display = "none";
    list.style.display = "block";
  }

  // ---------- public-ish reloader ----------
  async function reloadSFL() {
    setLoading("Updating…");
    const { items } = await loadSFL();
    await renderSFL(items);
  }
  window.__sflReload = reloadSFL;

  // ---------- init (1s after DOM ready) ----------
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(async () => {
      // signed-in guard
      const wlUserId = localStorage.getItem("wl_user_id");
      if (!wlUserId) return;

      // hide on final steps
      const shouldHide =
        visible($("#ctl00_PageBody_CardOnFileViewTitle_HeaderText")) ||
        visible($("#ctl00_PageBody_SummaryHeading_HeaderText")) ||
        visible($("#SummaryEntry2")) ||
        visible($("#ctl00_PageBody_CheckoutTitle_HeaderText"));
      if (shouldHide) {
        const blk = $("#savedForLater"); if (blk) blk.style.display = "none";
        return;
      }

      ensureContainer();
      setLoading();

      try {
        const { items } = await loadSFL();
        await renderSFL(items);
      } catch (e) {
        console.error("[SFL] init error:", e);
        setEmpty();
      }
    }, 1000);
  });

  // ---------- Add to Cart from SFL (no full page reload) ----------
  document.addEventListener("click", async (ev) => {
    const btn = ev.target.closest(".js-sfl-add");
    if (!btn) return;
    const row  = btn.closest(".sflRow");
    const pid  = row?.dataset?.pid;
    const code = row?.dataset?.code;

    btn.disabled = true;
    btn.textContent = "Adding…";
    try {
      await addPidToCart(pid, 1);
      // Remove from quicklist in background; if it fails, just reload SFL
      try { if (code) await removeFromQuicklistByCode(code); } catch(e){ console.warn(e); }
      // Optimistic UI: drop row + refresh SFL list
      row?.remove();
      await reloadSFL();
      // Optional: if you MUST reflect cart totals instantly, we can ajax-refresh the cart DOM here.
    } catch (e) {
      console.error("[SFL] add-to-cart failed:", e);
      btn.disabled = false;
      btn.textContent = "Try Again";
    }
  });

  // ---------- Inject "Save for Later" buttons in cart 1s after DOM ready ----------
  async function injectSaveForLaterButtons() {
    const cartItems = document.querySelectorAll(".shopping-cart-item");
    cartItems.forEach(item => {
      const codeLink  = item.querySelector("h6 a");
      const productCode = codeLink?.textContent.trim();
      const pidMatch = codeLink?.href?.match(/pid=(\d+)/);
      const pid = pidMatch ? pidMatch[1] : null;
      const deleteBtn = item.querySelector("a.delete-link");
      const host = item.querySelector(".sfl-placeholder");
      if (!productCode || !pid || !deleteBtn || !host) return;

      const btn = document.createElement("button");
      btn.textContent = "Save for Later";
      btn.className = "btn btn-link text-primary btn-sm sfl-button";
      btn.style.marginLeft = "1rem";

      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        btn.disabled = true;
        btn.textContent = "Saving…";
        try {
          // Fast PDP postback instead of iframe
          await pdpPostback(pid, "ADD_TO_SFL");
          // remove from cart via your delete (server will re-render cart)
          deleteBtn.click();
        } catch (err) {
          console.error("[SFL] Save for Later failed:", err);
          btn.disabled = false;
          btn.textContent = "Error – Try Again";
        }
      });

      host.appendChild(btn);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      try { injectSaveForLaterButtons(); } catch(e){ console.error(e); }
    }, 1000); // exactly 1s
  });

})();

