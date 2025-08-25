
/* ==========================================================
   Woodson — Store Mode (proximity bootstrap)
   - Mobile-only geofence; single redirect per session
   - Skips if cart_origin is a Meta source
   - Sets: storeProximity=true, storeMode=on, storeName, storeBranchKey
   - Redirects to /Default.aspx (Store Mode overlay takes over there)
   ========================================================== */
(function () {
  'use strict';

  console.log('[StoreMode] Script injected ✅');

  document.addEventListener('DOMContentLoaded', () => {
    console.log('[StoreMode] DOM fully loaded');

    // Short delay to let first-paint elements settle (reduces layout flashes)
    setTimeout(runProximity, 1200);
  });

  function runProximity() {
    console.log('[StoreMode] Running proximity check...');

    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const alreadyRedirected = sessionStorage.getItem('storeModeRedirected') === 'true';

    // cart_origin bypass for Meta Shops handoffs
    const urlParams = new URLSearchParams(window.location.search);
    const cartOrigin = (urlParams.get('cart_origin') || '').toLowerCase();
    const acceptedOrigins = ['meta_shops', 'facebook', 'instagram', 'whatsapp'];

    console.log(`[StoreMode] Mobile: ${isMobile} | Redirected: ${alreadyRedirected} | cart_origin: ${cartOrigin || 'none'}`);

    if (acceptedOrigins.includes(cartOrigin)) {
      console.log('[StoreMode] Skipping proximity (Meta origin detected).');
      return;
    }

    if (!isMobile) {
      console.log('[StoreMode] Not a mobile UA — skipping redirect.');
      return;
    }

    // If we've already redirected this session, don't bounce them again.
    if (alreadyRedirected) {
      console.log('[StoreMode] Already redirected once this session — no action.');
      return;
    }

    // Your stores (name should match/contain the label used in ShowStock.aspx)
    const stores = [
      { key: 'Brenham',  name: 'Brenham',  lat: 30.1669, lon: -96.3977 },
      { key: 'Bryan',    name: 'Bryan',    lat: 30.6744, lon: -96.3743 },
      { key: 'Caldwell', name: 'Caldwell', lat: 30.5316, lon: -96.6939 },
      { key: 'Lexington',name: 'Lexington',lat: 30.4152, lon: -97.0105 },
      { key: 'Groesbeck',name: 'Groesbeck',lat: 31.5249, lon: -96.5336 },
      { key: 'Mexia',    name: 'Mexia',    lat: 31.6791, lon: -96.4822 },
      { key: 'Buffalo',  name: 'Buffalo',  lat: 31.4632, lon: -96.0580 },
      { key: 'Corporate',name: 'Woodson Lumber Corporate', lat: 30.543497526885822, lon: -96.68760572699072 }
    ];

    // ~0.06 miles ≈ 317 feet (~100 m)
    const THRESHOLD_MILES = 0.06;

    // Ask for high-accuracy location
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        console.log(`[StoreMode] User location: ${latitude}, ${longitude}`);

        let nearest = null;
        for (const s of stores) {
          const dist = haversineMiles(latitude, longitude, s.lat, s.lon);
          console.log(`[StoreMode] Distance to ${s.name}: ${dist.toFixed(4)} miles`);
          if (dist < THRESHOLD_MILES) { nearest = s; break; }
        }

        if (!nearest) {
          console.log('[StoreMode] No store within range — no redirect.');
          return;
        }

        // Set session flags for the Store Mode app to use
        sessionStorage.setItem('storeModeRedirected', 'true');
        sessionStorage.setItem('storeProximity', 'true');
        sessionStorage.setItem('storeMode', 'on');
        sessionStorage.setItem('storeName', nearest.name);
        sessionStorage.setItem('storeBranchKey', nearest.key);

        // Route to Default.aspx so the Store Mode overlay is guaranteed
        console.log(`[StoreMode] Near ${nearest.name}. Redirecting to /Default.aspx`);
        window.location.href = `${location.origin}/Default.aspx`;
      },
      (err) => {
        console.warn('[StoreMode] Geolocation error:', err && err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function haversineMiles(lat1, lon1, lat2, lon2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 3958.8; // miles
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
  }
})();

