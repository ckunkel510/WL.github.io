(async function () {
  const DEFAULT_SURVEY_URL = "https://example.com/survey-generic";

  function haversine(lat1, lon1, lat2, lon2) {
    const toRad = deg => (deg * Math.PI) / 180;
    const R = 3958.8; // miles
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
  }

  async function getNearestStore(stores, coords) {
    let nearest = stores[0];
    let minDist = Infinity;
    for (const store of stores) {
      const dist = haversine(coords.lat, coords.lon, store.lat, store.lon);
      if (dist < minDist) {
        minDist = dist;
        nearest = store;
      }
    }
    return nearest;
  }

  async function loadStores() {
    const res = await fetch('/stores.json');
    return await res.json();
  }

  async function tryGeolocation() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        err => reject(err),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  const stores = await loadStores();

  try {
    const coords = await tryGeolocation();
    const nearest = await getNearestStore(stores, coords);
    window.location.href = nearest.surveyUrl;
  } catch (e) {
    console.warn("Geolocation failed or denied, redirecting to default survey.");
    window.location.href = DEFAULT_SURVEY_URL;
  }
})();
