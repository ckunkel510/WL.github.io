<script>
(function () {
  var path = (window.location.pathname || "").toLowerCase();
  var searchParams = new URLSearchParams(window.location.search || "");
  var href = (window.location.href || "").toLowerCase();

  // Only run on Default.aspx
  if (!(path.endsWith("/default.aspx") || path === "/default.aspx")) return;

  // Safety: do not do anything if somehow already on Products.aspx
  if (href.indexOf("/products.aspx") !== -1) return;

  // Central route map
  var routeMap = {
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

  // Preferred route pattern:
  // default.aspx?view=storelocations
  // default.aspx?view=store-caldwell
  var view = (searchParams.get("view") || "").trim().toLowerCase();

  // Optional fallback support for naked querystring patterns like:
  // default.aspx?storelocations
  // default.aspx?brenham
  // default.aspx?store-caldwell
  if (!view) {
    var rawSearch = (window.location.search || "").replace(/^\?/, "").trim().toLowerCase();

    if (rawSearch && rawSearch.indexOf("=") === -1 && routeMap[rawSearch]) {
      view = rawSearch;
    }
  }

  // If a mapped route was requested, send user to that product group page
  if (view && routeMap[view]) {
    var target = routeMap[view];
    var destination =
      "/Products.aspx?pl1=" + encodeURIComponent(target.pl1) +
      "&pg=" + encodeURIComponent(target.pg);

    window.location.replace(destination);
    return;
  }

  // Default homepage behavior
  window.location.replace("/Products.aspx");
})();
</script>
