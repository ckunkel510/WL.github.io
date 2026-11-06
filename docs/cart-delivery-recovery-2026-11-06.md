# Cart delivery recovery — November 6, 2026

The user reports native cart/checkout with eero VPN enabled in iPhone Safari and Chrome, while other pages look correct. The cart JavaScript opens directly on the phone with VPN enabled. This does not establish a blanket GitHub block or identify the precise failing subrequest.

Confirmed loading weaknesses:

- Cart presentation removed its pending stylesheet at ten seconds and permanently kept the native layout, even if the stylesheet would have completed shortly afterward.
- Cart/compact script tags prevented another request after a known delivery failure. A header bootstrap failure only logged an error.
- The inline cart loader requests native wizard, payment and review decorators on every basket. Legacy stored-card decoration can change native selections while compact checkout is managing them.

Runtime repair: cart styles can complete late; a known stylesheet or critical-script delivery failure gets one retry. Pending script requests are never cancelled or replayed. One logical compact-entry guard spans both transport attempts, keeps its twelve-second bound, and never duplicates a queued checkout action. Page navigation cancels queued retries. Native payment/review decoration is skipped only inside the exact same-origin frame owned by compact checkout. Ordinary native checkout keeps both decorators. Compact explicitly opens the native stored-card selector once after fresh identity verification when WebTrack has not rendered its dropdown yet; it no longer relies on the tile decorator to do that. No native postback is automatically replayed.

The header and cart runtime source files ship through the repository. Two separate native WebTrack configuration edits are supplied:

1. Replace only the existing `wl-header-locations-test` script block with `config/webtrack-header-loader.html`. This gives the root header request one retry after a known network failure and marks it as high priority. It uses the existing host and does not add a third-party service.
2. Replace only the external-script `if (isShoppingCart) { ... }` block with `config/webtrack-cart-script-block.js`, inside the existing inline loader. Do not replace its earlier cart preference/DOM-behavior block. If the admin UI manages individual URLs, remove the direct Checkout2.js and CardContainer.js entries and add https://ckunkel510.github.io/WL.github.io/CartNativeViews.js?v=20261106-native-views-1 instead; leave the other entries in place. The replacement keeps fourteen cart scripts, adds the small CartNativeViews loader, and defers `Checkout2.js` and `CardContainer.js` until a native checkout view appears. It also detects partial WebForms transitions and retains the native fallback. These two deferred files total 260,274 uncompressed bytes; actual transfer savings depend on compression and caching. The summary script remains on the basket to retain its thumbnail cache for fallback review.

Do not remove Checkout2.js or CardContainer.js from every ShoppingCart.aspx response: the same URL serves native details, payment and fallback. Neither this change nor hosting can guarantee rendering if a customer blocks JavaScript or all permitted asset routes. A first-party hosting migration remains a separate option; DNS and hosting are unchanged here.

Validation: 617 automated tests pass, including stylesheet completion after ten seconds, bounded failures, stale callbacks, one compact-entry guard, cancelled retries on Back, exact frame ownership, deferred native scripts and partial transitions. Native Chrome authenticated candidate verification is pending. The phone VPN symptom requires a follow-up after the configuration/runtime changes; it has not been reproduced on the Mac. No order submission or cart-line changes are authorized.
