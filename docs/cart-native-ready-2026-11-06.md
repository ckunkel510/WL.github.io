# Cart dependency readiness — November 6, 2026

The live inline loader appends ShoppingCartRow.js with async=true, while WebTrack's jQuery is a later parser-blocking script. ShoppingCartRow, ShoppingCartBranch and DeliveryOptions use jQuery at module scope. If a cached customization arrives before the native library, startup throws before its ready callbacks can even be registered. VPN-related timing can expose this race, although the exact phone failure remains unverified.

These three modules now wait for DOM ready and receive the native jQuery function before registering their existing handlers. Native jQuery finishes or fails before the parser reaches DOM ready. A missing library leaves the native page intact rather than throwing. Two legacy DOMContentLoaded-only handlers use jQuery ready so deferred module startup cannot miss them. Non-sensitive DOM markers distinguish ready and missing dependencies. Cart policy, stock, pallet, shipping calculation, selection, account and order behavior are unchanged. The old shopping-cart bundle is not in the observed live script list; individual runtime files are the active source.

The staged cart configuration uses versioned URLs for these three files so installation does not reuse a stale cached copy. The two native-only files remain deferred through CartNativeViews.js, preserving fallback.

623 tests pass, including startup before jQuery exists, initialization once the parser has loaded it, and a failed library. Source syntax/diff checks pass. Native browser smoke checks and public-source verification are pending; phone VPN verification still needs the user's configuration update and retest. No orders or cart-line changes.
