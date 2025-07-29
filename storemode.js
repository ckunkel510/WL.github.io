console.log("[StoreMode] Checking for store proximity...");

(function () {
  // Only fire on mobile and if not already redirected this session
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const alreadyRedirected = sessionStorage.getItem("storeModeRedirected");

  if (!isMobile || alreadyRedirected === "true") return;

  const stores = [
  { name: 'Brenham', lat: 30.1669, lon: -96.3977 },
  { name: 'Bryan', lat: 30.6744, lon: -96.3743 },
  { name: 'Caldwell', lat: 30.5316, lon: -96.6939 },
  { name: 'Lexington', lat: 30.4152, lon: -97.0105 },
  { name: 'Groesbeck', lat: 31.5249, lon: -96.5336 },
  { name: 'Mexia', lat: 31.6791, lon: -96.4822 },
  { name: 'Buffalo', lat: 31.4632, lon: -96.0580 },
  { name: 'Woodson Office', lat: 30.543497526885822, lon: -96.68760572699072 } // ← added for testing
];


  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      const threshold = 0.06; // ~100 meters in degrees (~0.06 miles)

      const nearStore = stores.find(store => {
        const dist = haversine(latitude, longitude, store.lat, store.lon);
        return dist < 0.06; // ~100 meters
      });

      if (nearStore) {
        console.log(`[StoreMode] Near ${nearStore.name}. Redirecting to store mode.`);
        sessionStorage.setItem("storeModeRedirected", "true");
        window.location.href = "/Default.aspx";
      } else {
        console.log("[StoreMode] User is not near a store.");
      }
    },
    (err) => {
      console.warn("[StoreMode] Geolocation not granted or failed", err);
    },
    {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 0
    }
  );

  function haversine(lat1, lon1, lat2, lon2) {
    const toRad = deg => (deg * Math.PI) / 180;
    const R = 3958.8; // miles
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
  }
})();
