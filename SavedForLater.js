
(function runSavedForLaterWhenReady() {
function startSavedForLater() {
(function() {

  if (!/ShoppingCart\.aspx/i.test(location.pathname)) {
    console.log("[SFL] Skipping Saved For Later outside the cart page.");
    return;
  }

  if (window.__wlSavedForLaterLoaded) {
    console.log("[SFL] Saved For Later already initialized.");
    return;
  }
  window.__wlSavedForLaterLoaded = true;

  const SFL_NAME = "Saved For Later";
  const SFL_DESC = "Saved For Later";
  const BASE = location.origin + "/";
  const SFL_DETAIL_URL_KEY = "sfl_detail_url";
  const SFL_IMAGE_CACHE_KEY = "sfl_image_cache_v1";

  function readStorage(key, storage) {
    try { return storage.getItem(key); } catch (e) { return null; }
  }

  function writeStorage(key, value, storage) {
    try { storage.setItem(key, value); } catch (e) {}
  }

  function removeStorage(key, storage) {
    try { storage.removeItem(key); } catch (e) {}
  }

  function getDetailUrlStorageKeys() {
    const legacyKey = SFL_DETAIL_URL_KEY;
    const userKey = wlUserId ? `${SFL_DETAIL_URL_KEY}:${wlUserId}` : null;
    return userKey ? [userKey, legacyKey] : [legacyKey];
  }

  function readCachedDetailUrl() {
    for (const key of getDetailUrlStorageKeys()) {
      const value = readStorage(key, sessionStorage) || readStorage(key, localStorage);
      if (value) return value;
    }
    return null;
  }

  function writeCachedDetailUrl(url) {
    getDetailUrlStorageKeys().forEach((key) => {
      writeStorage(key, url, sessionStorage);
      writeStorage(key, url, localStorage);
    });
  }

  function clearCachedDetailUrl() {
    getDetailUrlStorageKeys().forEach((key) => {
      removeStorage(key, sessionStorage);
      removeStorage(key, localStorage);
    });
  }

  let sflImageCache = {};
  try { sflImageCache = JSON.parse(localStorage.getItem(SFL_IMAGE_CACHE_KEY) || "{}") || {}; } catch (e) {}

  function cacheProductImage(pid, imageUrl) {
    if (!pid || !imageUrl) return;
    sflImageCache[pid] = { imageUrl, ts: Date.now() };
    const entries = Object.entries(sflImageCache)
      .sort((a, b) => Number(b[1]?.ts || 0) - Number(a[1]?.ts || 0))
      .slice(0, 80);
    sflImageCache = Object.fromEntries(entries);
    writeStorage(SFL_IMAGE_CACHE_KEY, JSON.stringify(sflImageCache), localStorage);
  }




  // Inject container HTML into DOM
  const container = document.createElement("div");
  container.id = "savedForLater";
  container.style.display = "none";
  container.innerHTML = `
    <div id="sflHeader">
      <span>Saved For Later</span>
      <span class="sflCount" id="sflCount"></span>
    </div>
    <div id="sflBody">
      <div id="sflLoading">Loading your saved items…</div>
      <div id="sflList" style="display:none;"></div>
      <div id="sflEmpty" style="display:none;">No items saved for later.</div>
    </div>
  `;
  const insertAnchor =
    document.querySelector("#ctl00_PageBody_ShoppingCartDetailPanel") ||
    document.querySelector(".ShoppingCartDetailPanel") ||
    document.querySelector(".shopping-cart-details") ||
    document.querySelector(".mainContents");
if (insertAnchor && insertAnchor.parentNode) {
  insertAnchor.parentNode.insertBefore(container, insertAnchor.nextSibling);
  console.log("[SFL] Injected after cart content anchor");
} else {
  console.warn("[SFL] .mainContents not found, appending to body");
  document.body.appendChild(container);
}

  console.log("[SFL] Injected Saved For Later HTML container");

  // Utility functions
  async function fetchHtml(url, options = {}) {
    console.log("[SFL] Fetching HTML from:", url);
    const res = await fetch(url, { credentials: "include", ...options });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, "text/html");
    return { text, doc };
  }

  function getHiddenFields(doc) {
    const fields = {};
    doc.querySelectorAll('input[type="hidden"]').forEach(inp => {
      if (inp.name) fields[inp.name] = inp.value || "";
    });
    return fields;
  }

  function toFormData(obj) {
    const fd = new FormData();
    Object.entries(obj).forEach(([k, v]) => fd.append(k, v));
    return fd;
  }

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function $all(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function ensureSflContainer() {
    const el = document.getElementById("savedForLater");
    if (el) el.style.display = "block";
    return el;
  }

  function setLoading(msg = "Loading your saved items…") {
    console.log("[SFL] setLoading:", msg);
    $("#sflLoading").style.display = "block";
    $("#sflLoading").textContent = msg;
    $("#sflList").style.display = "none";
    $("#sflEmpty").style.display = "none";
  }

  function setEmpty() {
    console.log("[SFL] No items found");
    $("#sflLoading").style.display = "none";
    $("#sflList").style.display = "none";
    $("#sflEmpty").style.display = "block";
    $("#sflCount").textContent = "(0)";
  }

  function setListCount(n) {
    console.log(`[SFL] Found ${n} items`);
    $("#sflCount").textContent = `(${n})`;
  }

  // --------- Step 0: must be signed in
  const wlUserId = (typeof localStorage !== "undefined") ? localStorage.getItem("wl_user_id") : null;
  console.log("[SFL] wl_user_id =", wlUserId);
  if (!wlUserId) {
    console.log("[SFL] Not signed in — skipping");
    return;
  }

  ensureSflContainer();
  setLoading();

  // --------- Step 1: Find or create the Saved For Later quicklist
  async function findSavedForLaterList() {
    console.log("[SFL] Searching for existing quicklist...");
    const { doc } = await fetchHtml(BASE + "Quicklists_R.aspx");
    const table = doc.querySelector("table.rgMasterTable");
    if (!table) return { exists: false };

    let sflRow = null;
    const rows = $all("tbody > tr", table);
    for (const tr of rows) {
      const anchor = tr.querySelector('td a[href*="Quicklists_R.aspx"]');
      if (!anchor) continue;
      if (anchor.textContent.trim().toLowerCase() === SFL_NAME.toLowerCase()) {
        sflRow = { tr, anchor };
        break;
      }
    }

    if (sflRow) {
      const href = new URL(sflRow.anchor.getAttribute("href"), BASE).toString();
      console.log("[SFL] Found existing Saved For Later quicklist:", href);
      return { exists: true, detailUrl: href };
    }

    console.log("[SFL] Quicklist not found — will create new");
    return { exists: false };
  }

  async function createSavedForLaterList() {
    console.log("[SFL] Creating Saved For Later quicklist…");
    const addUrl = BASE + "Quicklists_R.aspx?addNew=1";
    const { doc } = await fetchHtml(addUrl);

    const hidden = getHiddenFields(doc);
    hidden["ctl00$PageBody$EditQuicklistName"] = SFL_NAME;
    hidden["ctl00$PageBody$EditQuicklistDescription"] = SFL_DESC;

    const defaultSel = $("#ctl00_PageBody_EditDefaultQuicklistDropdown", doc);
    const val = defaultSel ? (defaultSel.value || "no") : "no";
    hidden["ctl00$PageBody$EditDefaultQuicklistDropdown"] = val;

    // Simulate Save button click via __doPostBack
    hidden["__EVENTTARGET"] = "ctl00$PageBody$SaveQuickListButton";
    hidden["__EVENTARGUMENT"] = "";

    console.log("[SFL] Submitting quicklist creation form with postback to SaveQuickListButton");
    const fd = toFormData(hidden);
    const res = await fetch(addUrl, {
      method: "POST",
      credentials: "include",
      body: fd
    });

    if (!res.ok) throw new Error("Quicklist creation POST failed.");

    const found = await findSavedForLaterList();
    if (!found.exists) throw new Error("Quicklist was not created as expected.");
    return found.detailUrl;
  }

  // --------- Step 2: Resolve detail URL for SFL
  async function ensureSflDetailUrl() {
  console.log("[SFL] Locating Saved For Later Quicklist via Quicklists_R.aspx...");
  const cachedUrl = readCachedDetailUrl();
  if (cachedUrl) {
    console.log("[SFL] Using cached Saved For Later detail URL:", cachedUrl);
    writeCachedDetailUrl(cachedUrl);
    return cachedUrl;
  }

  const found = await findSavedForLaterList(); // loads Quicklists_R.aspx
  if (found.exists && found.detailUrl) {
    console.log("[SFL] Found valid Quicklist detail URL:", found.detailUrl);
    const fixedUrl = found.detailUrl.replace("QuicklistDetails.aspx", "Quicklists_R.aspx");
    writeCachedDetailUrl(fixedUrl);
    console.log("[SFL] Saved corrected detail URL:", fixedUrl);

    return fixedUrl;
  }

  console.log("[SFL] Not found, creating new Saved For Later list...");
  const createdUrl = await createSavedForLaterList();
  writeCachedDetailUrl(createdUrl);
  return createdUrl;
}


  // --------- Step 3: Load items
 function findQuicklistProductTable(detailDoc) {
  const tables = $all("table.rgMasterTable", detailDoc);

  return tables.find((table) => {
    const headerText = $all("th", table)
      .map((th) => th.textContent.trim())
      .join(" ")
      .replace(/\s+/g, " ");
    const hasProductHeaders =
      /Product Code/i.test(headerText) &&
      /Description/i.test(headerText) &&
      /Price/i.test(headerText) &&
      /Per/i.test(headerText);
    const hasProductLinks = !!table.querySelector("a[href*='ProductDetail.aspx']");
    const hasQuicklistDeleteButtons = !!table.querySelector("a[id*='DeleteQuicklistLineButtonX'], a[href*='DeleteQuicklistLineButtonX']");

    return hasProductHeaders || (hasProductLinks && hasQuicklistDeleteButtons);
  }) || null;
}

 function hasQuicklistProductTable(detailDoc) {
  return !!findQuicklistProductTable(detailDoc);
}

 function parseSflItems(detailDoc) {
  console.log("[SFL] Parsing Quicklist detail page...");

  let table = findQuicklistProductTable(detailDoc);
  if (!table) {
    console.error("[SFL] Quicklist product table not found");
    return [];
  }

  const rows = $all("tr.rgRow, tr.rgAltRow", table).filter((tr) => tr.querySelector("a[href*='ProductDetail.aspx']"));
  console.log(`[SFL] Found ${rows.length} row(s) in Quicklist table`);

  const items = [];

  rows.forEach((tr, i) => {
    const tds = Array.from(tr.querySelectorAll("td"));
    if (tds.length < 5) {
      console.warn(`[SFL] Skipping row ${i} — only ${tds.length} td cells`);
      return;
    }

    const a = tds[0].querySelector("a[href*='ProductDetail.aspx']");
    const productHref = a?.getAttribute("href") || null;
    const productCode = a?.textContent.trim() || "";
    const description = tds[1].textContent.trim();
    const price = tds[2].textContent.trim();
    const per = tds[3].textContent.trim();

    // 🔍 Find delete anchor and extract EVENTTARGET
    const deleteAnchor = tr.querySelector("a[id*='DeleteQuicklistLineButtonX']");
    let eventTarget = null;

    if (deleteAnchor) {
      const href = deleteAnchor.getAttribute("href") || "";
      const match = href.match(/__doPostBack\('([^']+)'/);
      if (match) {
        eventTarget = match[1];
        console.log(`[SFL] Row ${i}: Found delete __EVENTTARGET: ${eventTarget}`);
      } else {
        console.warn(`[SFL] Row ${i}: Failed to extract __EVENTTARGET from href`);
      }
    } else {
      console.warn(`[SFL] Row ${i}: No delete anchor found`);
    }

    console.log(`[SFL] Row ${i}: ${productCode} | ${description} | ${price} | ${per}`);

    items.push({
      productHref,
      productCode,
      description,
      price,
      per,
      eventTarget // 💡 used later to remove item
    });
  });

  return items;
}






 async function loadSflItems() {
  const detailUrl = await ensureSflDetailUrl();
  try {
    const { doc } = await fetchHtml(detailUrl);
    if (!hasQuicklistProductTable(doc)) {
      throw new Error("Cached Saved For Later URL did not contain the product detail table.");
    }
    const items = parseSflItems(doc);
    return { detailUrl, items, doc };
  } catch (error) {
    console.warn("[SFL] Cached Saved For Later URL failed; refreshing quicklist lookup.", error);
    clearCachedDetailUrl();
    const refreshedUrl = await ensureSflDetailUrl();
    const { doc } = await fetchHtml(refreshedUrl);
    if (!hasQuicklistProductTable(doc)) {
      throw new Error("Saved For Later detail page did not contain the product detail table.");
    }
    const items = parseSflItems(doc);
    return { detailUrl: refreshedUrl, items, doc };
  }
}

  // --------- Step 4: Render
  function pidFromHref(href) {
    try {
      const u = new URL(href, BASE);
      return u.searchParams.get("pid");
    } catch (e) {
      return null;
    }
  }

  function productImageUrlFromPid(pid) {
    return "https://images-woodsonlumber.sirv.com/Other%20Website%20Images/placeholder.png";
  }

 async function loadSflProductImage(pid, productUrl, imgElement) {
  if (!pid || !productUrl || !imgElement) return;
  const cached = sflImageCache[pid]?.imageUrl;
  if (cached) {
    imgElement.src = cached;
    return;
  }

  try {
    const response = await fetch("https://wlmarketingdashboard.vercel.app/api/get-product-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productUrl })
    });

    const result = await response.json();
    if (result.imageUrl) {
      imgElement.src = result.imageUrl;
      cacheProductImage(pid, result.imageUrl);
    } else {
      console.warn(`[SFL] No image found for PID ${pid}`);
    }
  } catch (err) {
    console.error(`[SFL] Error fetching image for PID ${pid}:`, err.message);
  }
}

 async function renderSflList(items) {
  const list = document.getElementById("sflList");
  list.innerHTML = "";

  if (!items.length) {
    setEmpty();
    return;
  }

  const placeholder = "https://images-woodsonlumber.sirv.com/Other%20Website%20Images/placeholder.png";
  const imageJobs = [];

  for (const item of items) {
    const pid = item.productHref ? pidFromHref(item.productHref) : null;
    const productUrl = pid ? `https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=${pid}` : "#";

    // === Create image element ===
    const imgElement = document.createElement("img");
    imgElement.className = "sflImg";
    imgElement.src = placeholder;

    // === Wrap image in anchor ===
    const link = document.createElement("a");
    link.href = productUrl;
    link.target = "_blank"; // optional: open in new tab
    link.appendChild(imgElement);

    // === Build row ===
    const row = document.createElement("div");
    row.className = "sflRow";
    row.innerHTML = `
      <div class="sflImgWrapper"></div>
      <div>
        <div class="sflTitle">${item.productCode || ""}</div>
        <div class="sflDesc">${item.description || ""}</div>
      </div>
      <div class="sflPrice">${item.price || ""}</div>
      <div class="sflPer">${item.per || ""}</div>
      <div class="sflActions">
        <button class="sflBtn js-sfl-add" data-pid="${pid || ""}" data-code="${item.productCode || ""}">Add to Cart</button>
      </div>
    `;

    // Add the <a><img></a> to the image wrapper
    row.querySelector(".sflImgWrapper").appendChild(link);

    // Add data attributes
    row.dataset.eventTarget = item.eventTarget || "";
    row.dataset.pid = pid || "";
    row.dataset.code = item.productCode || "";

    // Append to the list
    list.appendChild(row);

    if (pid) imageJobs.push(loadSflProductImage(pid, productUrl, imgElement));
  }

  setListCount(items.length);
  document.getElementById("sflLoading").style.display = "none";
  document.getElementById("sflEmpty").style.display = "none";
  list.style.display = "block";
  Promise.allSettled(imageJobs).catch(function () {});
}



  // --------- Init
  (async function initSfl() {
  try {
    console.log("[SFL] Initializing...");

    // Check if we're on a step where SFL should be hidden
    const shouldHide = (() => {
      const isVisible = (el) => el && el.offsetParent !== null;
      const paymentHeader = document.querySelector("#ctl00_PageBody_CardOnFileViewTitle_HeaderText");
      const reviewHeader = document.querySelector("#ctl00_PageBody_SummaryHeading_HeaderText");
      const summaryEntry2 = document.getElementById("SummaryEntry2");
      const CheckoutDetails = document.getElementById("ctl00_PageBody_CheckoutTitle_HeaderText");

      return (
        isVisible(paymentHeader) ||
        isVisible(reviewHeader) ||
        isVisible(summaryEntry2) ||
        isVisible(CheckoutDetails)
      );
    })();

    if (shouldHide) {
      console.log("[SFL] Skipping SFL load — on final step.");
      const sflBlock = document.getElementById("savedForLater");
      if (sflBlock) sflBlock.style.display = "none";
      return; // exit early
    }

    const { items } = await loadSflItems();
    renderSflList(items);
    console.log("[SFL] Done.");
  } catch (err) {
    console.error("[SFL] Error during init:", err);
    setEmpty();
  }
})();


// === New logic to hide SFL block based on page step ===
function hideSflIfOnFinalStep() {
  const paymentHeader = document.querySelector("#ctl00_PageBody_CardOnFileViewTitle_HeaderText");
  const reviewHeader = document.querySelector("#ctl00_PageBody_SummaryHeading_HeaderText");
  const summaryEntry2 = document.getElementById("SummaryEntry2");
  const CheckoutDetails = document.getElementById("ctl00_PageBody_CheckoutTitle_HeaderText");
  const sflBlock = document.getElementById("savedForLater");

  if (!sflBlock) return;

  const isVisible = (el) => el && el.offsetParent !== null;

  if (
    isVisible(paymentHeader) ||
    isVisible(reviewHeader) ||
    isVisible(summaryEntry2) ||
    isVisible(CheckoutDetails)
  ) {
    sflBlock.style.display = "none";
    console.log("[SFL] Hiding Saved For Later section on payment, review, or summary step.");
  }
}



})();






























(function(){
  const BASE = location.origin + "/";

  function $(sel, root=document) { return root.querySelector(sel); }
  function $all(sel, root=document) { return Array.from(root.querySelectorAll(sel)); }

  async function fetchHtml(url, options = {}) {
    const res = await fetch(url, { credentials: "include", ...options });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, "text/html");
    return { text, doc };
  }
  function getHiddenFields(doc) {
    const fields = {};
    doc.querySelectorAll('input[type="hidden"]').forEach(inp => {
      if (inp.name) fields[inp.name] = inp.value || "";
    });
    return fields;
  }
  function toFormData(obj) {
    const fd = new FormData();
    Object.entries(obj).forEach(([k, v]) => fd.append(k, v));
    return fd;
  }

  async function addPidToCart(pid, qty = 1) {
  if (!pid) throw new Error("PID required to add to cart.");
  const pdpUrl = BASE + "ProductDetail.aspx?pid=" + encodeURIComponent(pid);
  console.log("[SFL] Loading PDP:", pdpUrl);
  const { doc } = await fetchHtml(pdpUrl);

  const hidden = getHiddenFields(doc);

  // Try to find quantity input (optional)
  let qtyInput = doc.querySelector('input[name*="qty"]');
  if (qtyInput && qtyInput.name) {
    hidden[qtyInput.name] = String(qty);
    console.log("[SFL] Setting quantity:", qtyInput.name, "=", qty);
  }

  // Auto-detect Add to Cart link first
  let eventTarget = null;
  const atcLink = doc.querySelector('a[href^="javascript:__doPostBack"][id*="AddProductButton"]');
  if (atcLink) {
    const href = atcLink.getAttribute("href");
    const m = href.match(/__doPostBack\('([^']+)'/);
    if (m) eventTarget = m[1];
    console.log("[SFL] Auto-detected Add to Cart event target:", eventTarget);
  }

  // Fallback if not found
  if (!eventTarget) {
    eventTarget = "ctl00$PageBody$productDetail$ctl00$AddProductButton";
    console.log("[SFL] Using hardcoded Add to Cart event target:", eventTarget);
  }

  hidden["__EVENTTARGET"] = eventTarget;
  hidden["__EVENTARGUMENT"] = "";

  const fd = toFormData(hidden);
  const res = await fetch(pdpUrl, {
    method: "POST",
    credentials: "include",
    body: fd
  });

  if (!res.ok) throw new Error("Add to Cart postback failed.");
  console.log("[SFL] Add to Cart succeeded");
  return true;
}


async function removeQuicklistLine(productCodeToRemove) {
  const detailUrl = sessionStorage.getItem("sfl_detail_url");
  if (!detailUrl) throw new Error("Missing quicklist detail URL");

  console.log(`[SFL] Removing item from quicklist using detail URL: ${detailUrl}`);

  // 1. Load the quicklist page HTML
  const response = await fetch(detailUrl, { credentials: "include" });
  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  console.log("[SFL] Loaded quicklist detail page");

  // 2. Parse the grid rows and find the correct delete __EVENTTARGET
  const rows = doc.querySelectorAll("tr.rgRow, tr.rgAltRow");
  let eventTarget = null;

for (const tr of rows) {
  const deleteAnchor = tr.querySelector("a[id*='DeleteQuicklistLineButtonX']");
  const onclick = deleteAnchor?.getAttribute("onclick") || "";
  const productCodeMatch = onclick.match(/PromptDeleteQuicklistLine\("([^"]+)"/);
  const productCode = productCodeMatch?.[1]?.trim().toUpperCase();

  if (productCode === productCodeToRemove.toUpperCase()) {
    const href = deleteAnchor.getAttribute("href") || "";
    const match = href.match(/__doPostBack\('([^']+)'/);

    if (match) {
      eventTarget = match[1];
      console.log(`[SFL] Matched product '${productCodeToRemove}' — using eventTarget: ${eventTarget}`);
      break;
    }
  }
}



  if (!eventTarget) {
    console.error(`[SFL] Could not find delete button for product ${productCodeToRemove}`);
    throw new Error("Delete button not found in DOM.");
  }

  // 3. Build form data for POST
  const form = doc.querySelector("form");
  const inputs = [...form.querySelectorAll("input[type=hidden]")];
  const formData = new URLSearchParams();

  inputs.forEach(input => {
    if (input.name) formData.append(input.name, input.value);
  });

  formData.set("__EVENTTARGET", eventTarget);
  formData.set("__EVENTARGUMENT", "");

  const postUrl = new URL(form.getAttribute("action"), detailUrl).href;

  const postRes = await fetch(postUrl, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: formData.toString()
  });

  const resText = await postRes.text();
  if (!resText.includes("QuicklistDetailGrid")) {
    console.error("[SFL] Response text preview:\n", resText.slice(0, 500));
    throw new Error("Failed to remove item from Quicklist.");
  }

  console.log("[SFL] Item successfully removed from Quicklist.");
}














  async function refreshSfl() {
    // Re-run the loader from Phase 1
    const init = window.__sflReload;
    if (typeof init === "function") await init();
  }

  // Wire up the click handler
  document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".js-sfl-add");
  if (!btn) return;

  btn.disabled = true;
  btn.textContent = "Adding…";

  const row = btn.closest(".sflRow");
  const pid = row?.dataset?.pid || null;
  const productCode = row?.dataset?.code || null;

  try {
    if (!pid) throw new Error("Missing PID for add-to-cart.");

    // 1. Add to cart
    await addPidToCart(pid, 1);

    // 2. Remove from Quicklist using productCode
    if (productCode) {
      await removeQuicklistLine(productCode);
      console.log("[SFL] Removed item from Saved For Later list");
    } else {
      throw new Error("Missing productCode for removal.");
    }

    // 3. Refresh UI
    console.log("[SFL] Refreshing ShoppingCart page to show updated cart...");
    location.replace(location.href);

    await refreshSfl();
  } catch (err) {
    console.error("[SFL] Add to cart/remove failed:", err);
    btn.textContent = "Try Again";
    btn.disabled = false;
  }
});


  // Expose a hook Phase 1 can call to re-render
  window.__sflReload = async function() {
    const sflLoading = document.getElementById("sflLoading");
    if (sflLoading) sflLoading.style.display = "block";

    // Reload the detail list the same way Phase 1 did
    const userId = localStorage.getItem("wl_user_id");
    const keys = userId ? [`sfl_detail_url:${userId}`, "sfl_detail_url"] : ["sfl_detail_url"];
    let detailUrl = null;
    for (const key of keys) {
      detailUrl = sessionStorage.getItem(key) || localStorage.getItem(key);
      if (detailUrl) break;
    }
    if (!detailUrl) {
      location.reload();
      return;
    }
    const { text, doc } = await fetchHtml(detailUrl);
    const parse = (root) => {
      const tables = Array.from(root.querySelectorAll("table.rgMasterTable"));
      const table = tables.find((candidate) => {
        const headerText = Array.from(candidate.querySelectorAll("th"))
          .map((th) => th.textContent.trim())
          .join(" ")
          .replace(/\s+/g, " ");
        const hasProductHeaders =
          /Product Code/i.test(headerText) &&
          /Description/i.test(headerText) &&
          /Price/i.test(headerText) &&
          /Per/i.test(headerText);
        const hasProductLinks = !!candidate.querySelector("a[href*='ProductDetail.aspx']");
        const hasQuicklistDeleteButtons = !!candidate.querySelector("a[id*='DeleteQuicklistLineButtonX'], a[href*='DeleteQuicklistLineButtonX']");

        return hasProductHeaders || (hasProductLinks && hasQuicklistDeleteButtons);
      });
      if (!table) return [];
      const items = [];
      table.querySelectorAll("tbody > tr.rgRow, tbody > tr.rgAltRow").forEach(tr => {
        if (!tr.querySelector("a[href*='ProductDetail.aspx']")) return;
        const tds = tr.querySelectorAll("td");
        if (tds.length < 5) return;
        const a = tds[0].querySelector("a[href*='ProductDetail.aspx']");
        const href = a ? a.getAttribute("href") : null;
        const code = a ? a.textContent.trim() : "";
        const desc = tds[1].textContent.trim();
        const price = tds[2].textContent.trim();
        const per = tds[3].textContent.trim();
        const delA = tds[4].querySelector("a[href^='javascript:__doPostBack']");
        let target = null;
        if (delA) {
          const h = delA.getAttribute("href") || "";
          const m = h.match(/__doPostBack\('([^']+)'/);
          if (m) target = m[1];
        }
        items.push({ productHref: href, productCode: code, description: desc, price, per, eventTarget: target });
      });
      return items;
    };
    const items = parse(doc);

    // Re-draw rows (reusing Phase 1’s render)
    const list = document.getElementById("sflList");
    if (!list) return;
    list.innerHTML = "";

    const hdrCount = document.getElementById("sflCount");
    const loading = document.getElementById("sflLoading");
    const empty = document.getElementById("sflEmpty");

    function pidFromHref(href) {
      try {
        const u = new URL(href, location.origin + "/");
        return u.searchParams.get("pid");
      } catch (e) { return null; }
    }
    function productImageUrlFromPid(pid) {
      return "https://images-woodsonlumber.sirv.com/Other%20Website%20Images/placeholder.png";
    }

    if (!items.length) {
      if (hdrCount) hdrCount.textContent = "(0)";
      if (loading) loading.style.display = "none";
      if (list) list.style.display = "none";
      if (empty) empty.style.display = "block";
      return;
    }

    const placeholder = "https://images-woodsonlumber.sirv.com/Other%20Website%20Images/placeholder.png";

    items.forEach(item => {
      const pid = item.productHref ? pidFromHref(item.productHref) : null;
      const row = document.createElement("div");
      row.className = "sflRow";
      row.dataset.eventTarget = item.eventTarget || "";
      row.dataset.pid = pid || "";
      row.dataset.code = item.productCode || "";
      row.innerHTML = `
        <div class="sflImgWrapper"><a href="${pid ? `/ProductDetail.aspx?pid=${pid}` : "#"}"><img class="sflImg" src="${placeholder}" alt=""></a></div>
        <div>
          <div class="sflTitle">${item.productCode || ""}</div>
          <div class="sflDesc">${item.description || ""}</div>
        </div>
        <div class="sflPrice">${item.price || ""}</div>
        <div class="sflPer">${item.per || ""}</div>
        <div class="sflActions">
          <button class="sflBtn js-sfl-add" data-pid="${pid || ""}" data-code="${item.productCode || ""}">Add to Cart</button>
        </div>
      `;
      list.appendChild(row);
    });

    if (hdrCount) hdrCount.textContent = `(${items.length})`;
    if (loading) loading.style.display = "none";
    if (empty) empty.style.display = "none";
    if (list) list.style.display = "block";
  };
})();


                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      


    




















async function injectSaveForLaterButtons() {
  console.log("[SFL] Starting Save for Later button injection...");

  const cartItems = document.querySelectorAll(".shopping-cart-item");
  console.log(`[SFL] Found ${cartItems.length} cart items.`);

  cartItems.forEach((item, index) => {
    console.log(`[SFL] Processing cart item #${index+1}`);

    // 1) Get the product link & code
    const codeLink = item.querySelector("h6 a");
    const productCode = codeLink?.textContent.trim();
    if (!productCode) {
      console.warn("[SFL] No product code:", item);
      return;
    }
    console.log(`[SFL] Found product code: ${productCode}`);

    // 2) Extract pid from that href
    const pidMatch = codeLink.href?.match(/pid=(\d+)/);
    if (!pidMatch) {
      console.warn("[SFL] No pid in href:", codeLink.href);
      return;
    }
    const productId = pidMatch[1];
    console.log(`[SFL] Found pid: ${productId}`);

    // 3) Find the “Delete” link you created
    const deleteBtn = item.querySelector("a.delete-link");
    if (!deleteBtn) {
      console.warn("[SFL] Could not find delete-link in item:", item);
      return;
    }

    // 4) Build the SFL button
    const btn = document.createElement("button");
    btn.textContent = "Save for Later";
    btn.className = "btn btn-link text-primary btn-sm sfl-button";
    btn.style.marginLeft = "1rem";

    btn.addEventListener("click", async e => {
      e.preventDefault();
      btn.disabled = true;
      btn.textContent = "Saving…";
      try {
        await addToQuicklist(productId);
        // now trigger your Delete link to remove from cart
        deleteBtn.click();
      } catch (err) {
        console.error("[SFL] Failed to save for later:", err);
        btn.textContent = "Error – Try Again";
        btn.disabled = false;
      }
    });

    // 5) Inject into the placeholder
    const placeholder = item.querySelector(".sfl-placeholder");
    if (placeholder) {
      if (placeholder.querySelector(".sfl-button")) {
        console.log("[SFL] Save for Later button already exists.");
        return;
      }
      placeholder.appendChild(btn);
      console.log("[SFL] Injected Save for Later button.");
    } else {
      console.warn("[SFL] No .sfl-placeholder found");
    }
  });
}




async function removeCartItem(eventTarget) {
  const form = document.querySelector("form");
  const inputs = [...form.querySelectorAll("input[type=hidden]")];
  const formData = new URLSearchParams();

  inputs.forEach(input => {
    if (input.name) formData.append(input.name, input.value);
  });

  formData.set("__EVENTTARGET", eventTarget);
  formData.set("__EVENTARGUMENT", "");

  const postUrl = form.getAttribute("action");

  const res = await fetch(postUrl, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: formData.toString()
  });

  const resText = await res.text();
  if (!resText.includes("ShoppingCart.aspx")) {
    console.warn("[SFL] Remove POST response didn't contain expected content.");
  }
}

function addToQuicklist(productId) {
  console.log(`[SFL] Attempting to add ProductID ${productId} to Saved For Later...`);

  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = `/ProductDetail.aspx?pid=${productId}`;
    document.body.appendChild(iframe);

    iframe.onload = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;

        console.log("[SFL] Product detail iframe loaded.");

        const link = Array.from(doc.querySelectorAll("a")).find(
          a => a.textContent?.trim() === "Add to Saved For Later"
        );

        if (!link) {
          throw new Error("Could not find 'Add to Saved For Later' link in iframe.");
        }

        const href = link.getAttribute("href");
        const match = href.match(/__doPostBack\('([^']+)'/);

        if (!match || !match[1]) {
          throw new Error("Could not extract __doPostBack target.");
        }

        const postbackTarget = match[1];
        console.log(`[SFL] Found __EVENTTARGET: ${postbackTarget}`);

        const form = doc.forms[0];
        if (!form) throw new Error("Form not found in iframe.");

        form.__EVENTTARGET.value = postbackTarget;
        form.__EVENTARGUMENT.value = "";

        form.submit();

        console.log(`[SFL] Submitted postback to add product ${productId} to quicklist.`);

        // Give it time to complete, then cleanup
        setTimeout(() => {
          document.body.removeChild(iframe);
          resolve();
        }, 1500); // Adjust timing if needed
      } catch (err) {
        console.error("[SFL] Error in addToQuicklist via iframe:", err);
        document.body.removeChild(iframe);
        reject(err);
      }
    };
  });
}






function scheduleSaveForLaterButtonInjection() {
  let injectTimer = 0;
  const run = () => {
    clearTimeout(injectTimer);
    injectTimer = setTimeout(() => {
      try {
        injectSaveForLaterButtons();
      } catch (e) {
        console.error("[SFL] Error injecting Save for Later buttons:", e);
      }
    }, 80);
  };

  console.log("[SFL] Script loaded – injecting Save for Later buttons...");
  run();
  setTimeout(run, 400);
  setTimeout(run, 1200);

  const observerTarget =
    document.querySelector("#ctl00_PageBody_ShoppingCartDetailPanel") ||
    document.querySelector(".shopping-cart-details") ||
    document.querySelector(".mainContents") ||
    document.body;

  if (observerTarget && !window.__wlSflButtonObserver) {
    window.__wlSflButtonObserver = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => Array.from(mutation.addedNodes || []).some((node) => {
        return node.nodeType === 1 && (
          node.matches?.(".shopping-cart-item, .sfl-placeholder") ||
          node.querySelector?.(".shopping-cart-item, .sfl-placeholder")
        );
      }))) run();
    });
    window.__wlSflButtonObserver.observe(observerTarget, { childList: true, subtree: true });
  }
}

scheduleSaveForLaterButtonInjection();




}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startSavedForLater, { once: true });
} else {
  startSavedForLater();
}
})();                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        




















