// === Cart Branch Analyzer ===
if (window.location.pathname === "/ShoppingCart.aspx") {
  console.log("[CartBranch] Cart row script started.");

  const STORES = [
    { name: "Brenham", zip: 77833, lat: 30.1669, lon: -96.3977 },
    { name: "Bryan", zip: 77803, lat: 30.6744, lon: -96.3743 },
    { name: "Caldwell", zip: 77836, lat: 30.5316, lon: -96.6939 },
    { name: "Lexington", zip: 78947, lat: 30.4152, lon: -97.0105 },
    { name: "Groesbeck", zip: 76642, lat: 31.5249, lon: -96.5336 },
    { name: "Mexia", zip: 76667, lat: 31.6791, lon: -96.4822 },
    { name: "Buffalo", zip: 75831, lat: 31.4632, lon: -96.0580 }
  ];

  const SELECTED_KEY = "woodson_cart_branch";
  const cartItems = [];
  const branchScores = {}; // branch => # items it can fulfill
  let accountBranch = null;

  $(document).ready(() => {
    console.log("[CartBranch] Gathering cart items...");

    $(".shopping-cart-item").each(function () {
      const $item = $(this);
      const productLink = $item.find("a[href*='ProductDetail.aspx']").attr("href") || "";
      const pidMatch = productLink.match(/pid=(\d+)/i);
      const pid = pidMatch ? pidMatch[1] : null;

      let qty = null;
      $item.find("input[id*='qty']").each(function () {
        const val = parseFloat($(this).val());
        if (!isNaN(val)) qty = val;
      });

      if (pid && qty != null) {
        cartItems.push({ pid, qty });
        console.log(`[CartBranch] Item: PID ${pid}, Qty ${qty}`);
      }
    });

    if (cartItems.length === 0) return;
    determineBestBranch();
  });

  async function determineBestBranch() {
    accountBranch = await getSignedInBranch();
    console.log("[CartBranch] Account branch:", accountBranch);

    const branchStockMap = {};
    for (const store of STORES) {
      branchStockMap[store.name] = {};
    }

    for (const item of cartItems) {
      try {
        const res = await fetch(`https://webtrack.woodsonlumber.com/Catalog/ShowStock.aspx?productid=${item.pid}`);
        const html = await res.text();
        const temp = document.createElement("div");
        temp.innerHTML = html;
        const table = temp.querySelector("#StockDataGrid_ctl00");
        const rows = table?.querySelectorAll("tr") || [];

        for (const row of rows) {
          const cells = row.querySelectorAll("td");
          if (cells.length < 3) continue;

          const branch = cells[0].textContent.trim();
          const qty = parseFloat(cells[2].textContent.replace(/,/g, ""));

          if (STORES.find(s => s.name === branch)) {
            branchStockMap[branch][item.pid] = qty;
            if (qty >= item.qty) {
              branchScores[branch] = (branchScores[branch] || 0) + 1;
            }
          }
        }
      } catch (err) {
        console.warn("[CartBranch] Stock fetch failed for PID", item.pid);
      }
    }

    const totalItems = cartItems.length;
    console.log("[CartBranch] Branch scores:", branchScores);

    // 1. Prefer account branch if it covers all items
    if (accountBranch && branchScores[accountBranch] === totalItems) {
      console.log("[CartBranch] Account branch can fulfill all items. Using it.");
      localStorage.setItem(SELECTED_KEY, accountBranch);
      return;
    }

    // 2. Otherwise, find other full matches
    const fullMatches = Object.entries(branchScores).filter(([_, score]) => score === totalItems);

    if (fullMatches.length === 1) {
      const [branch] = fullMatches[0];
      console.log(`[CartBranch] Only one full match: ${branch}`);
      localStorage.setItem(SELECTED_KEY, branch);
      return;
    } else if (fullMatches.length > 1) {
      const nearest = await getNearestBranch(fullMatches.map(([name]) => name));
      if (nearest) {
        console.log(`[CartBranch] Multiple matches. Nearest branch is: ${nearest}`);
        localStorage.setItem(SELECTED_KEY, nearest);
        return;
      }
    }

    // 3. Partial match fallback
    const fallback = Object.entries(branchScores).sort((a, b) => b[1] - a[1])[0];
    if (fallback) {
      const [branch] = fallback;
      console.log(`[CartBranch] No full match. Best fallback is ${branch}`);
      localStorage.setItem(SELECTED_KEY, branch);
    }
  }

  async function getSignedInBranch() {
    try {
      const res = await fetch("https://webtrack.woodsonlumber.com/AccountSettings.aspx?cms=1");
      const text = await res.text();
      const temp = document.createElement("div");
      temp.innerHTML = text;
      const selected = temp.querySelector("#ctl00_PageBody_ChangeUserDetailsControl_ddBranch option[selected]");
      return selected?.textContent.trim() || null;
    } catch {
      return null;
    }
  }

  async function getNearestBranch(names) {
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
      const { latitude, longitude } = pos.coords;

      let nearest = null;
      let minDist = Infinity;

      for (const store of STORES.filter(s => names.includes(s.name))) {
        const d = haversine(latitude, longitude, store.lat, store.lon);
        if (d < minDist) {
          nearest = store.name;
          minDist = d;
        }
      }

      return nearest;
    } catch (e) {
      console.warn("[CartBranch] Could not get geolocation:", e);
      return null;
    }
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const toRad = deg => (deg * Math.PI) / 180;
    const R = 3958.8;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
  }
}