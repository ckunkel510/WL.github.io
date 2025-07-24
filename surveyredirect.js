(function () {
  const DEFAULT_SURVEY_URL = "https://woodsonwholesaleinc.formstack.com/forms/customerfeedback";
  const STORE_RADIUS_MILES = 20; // adjust as needed

  const stores = [
    { name: "Brenham", lat: 30.1669, lon: -96.3977, url: "https://www.woodsonlumber.com/" },
    { name: "Bryan", lat: 30.6744, lon: -96.3743, url: "https://www.woodsonlumber.com/" },
    { name: "Caldwell", lat: 30.5316, lon: -96.6939, url: "https://www.woodsonlumber.com/" },
    { name: "Lexington", lat: 30.4152, lon: -97.0105, url: "https://www.woodsonlumber.com/" },
    { name: "Groesbeck", lat: 31.5249, lon: -96.5336, url: "https://www.woodsonlumber.com/" },
    { name: "Mexia", lat: 31.6791, lon: -96.4822, url: "https://www.woodsonlumber.com/" },
    { name: "Buffalo", lat: 31.4632, lon: -96.0580, url: "https://www.woodsonlumber.com/" }
  ];

  function haversine(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // Earth radius in miles
    const toRad = deg => deg * (Math.PI / 180);
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
  }

  function redirectToNearest(lat, lon) {
    for (const store of stores) {
      const distance = haversine(lat, lon, store.lat, store.lon);
      if (distance <= STORE_RADIUS_MILES) {
        console.log(`[SurveyRedirect] Redirecting to ${store.name} survey`);
        window.location.href = store.url;
        return;
      }
    }
    console.log("[SurveyRedirect] No store within range. Redirecting to default survey.");
    window.location.href = DEFAULT_SURVEY_URL;
  }

  function fallbackRedirect() {
    console.warn("[SurveyRedirect] Geolocation failed. Redirecting to default.");
    window.location.href = DEFAULT_SURVEY_URL;
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        console.log("[SurveyRedirect] Location found:", latitude, longitude);
        redirectToNearest(latitude, longitude);
      },
      (err) => {
        console.warn("[SurveyRedirect] Location error:", err);
        fallbackRedirect();
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0
      }
    );
  } else {
    console.warn("[SurveyRedirect] Geolocation not supported");
    fallbackRedirect();
  }
})();
