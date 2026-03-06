(function () {
  "use strict";

  const LOG = "[WL DefaultRouter]";
  const loc = window.location;
  const href = (loc.href || "").toLowerCase();
  const path = (loc.pathname || "").toLowerCase();
  const search = loc.search || "";
  const params = new URLSearchParams(search);

  console.log(`${LOG} Script loaded.`);
  console.log(`${LOG} href:`, loc.href);
  console.log(`${LOG} path:`, loc.pathname);
  console.log(`${LOG} search:`, search);

  // Treat these as homepage/default entry points
  const isDefaultLike =
    path === "/" ||
    path === "" ||
    path.endsWith("/default.aspx") ||
    path === "/default.aspx";

  console.log(`${LOG} isDefaultLike:`, isDefaultLike);

  if (!isDefaultLike) {
    console.log(`${LOG} Not a default/home route. Exiting.`);
    return;
  }

  // Route map
  const routeMap = {
    "storelocations": { pl1: 4731, pg: 4731 },
    "stores": { pl1: 4731, pg: 4731 },
    "store-locations": { pl1: 4731, pg: 4731 },

    "store-brenham": { pl1: 4733, pg: 4733 },
    "brenham": { pl1: 4733, pg: 4733 },

    "store-bryan": { pl1: 4734, pg: 4734 },
    "bryan": { pl1: 4734, pg: 4734 },

    "store-caldwell": { pl1: 4735, pg: 4735 },
    "caldwell": { pl1: 4735, pg: 4735 },

    "store-lexington": { pl1: 4736, pg: 4736 },
    "lexington": { pl1: 4736, pg: 4736 },

    "store-groesbeck": { pl1: 4737, pg: 4737 },
    "groesbeck": { pl1: 4737, pg: 4737 },

    "store-mexia": { pl1: 4738, pg: 4738 },
    "mexia": { pl1: 4738, pg: 4738 },

    "store-buffalo": { pl1: 4739, pg: 4739 },
    "buffalo": { pl1: 4739, pg: 4739 }
  };

  let view = (params.get("view") || "").trim().toLowerCase();
  console.log(`${LOG} initial view param:`, view || "(none)");

  // Fallback for naked querystring patterns like ?storelocations
  if (!view) {
    const rawSearch = search.replace(/^\?/, "").trim().toLowerCase();
    console.log(`${LOG} rawSearch fallback check:`, rawSearch || "(none)");

    if (rawSearch && rawSearch.indexOf("=") === -1 && routeMap[rawSearch]) {
      view = rawSearch;
      console.log(`${LOG} matched rawSearch fallback route:`, view);
    }
  }

  // Route to mapped store page
  if (view && routeMap[view]) {
    const target = routeMap[view];
    const destination =
      "/Products.aspx?pl1=" + encodeURIComponent(target.pl1) +
      "&pg=" + encodeURIComponent(target.pg) +
      "&pretty=" + encodeURIComponent(view);

    console.log(`${LOG} matched route for "${view}"`);
    console.log(`${LOG} redirecting to:`, destination);
    window.location.replace(destination);
    return;
  }

  // No special route -> normal homepage behavior
  console.log(`${LOG} no special route matched; redirecting to /Products.aspx`);
  window.location.replace("/Products.aspx");
})();
