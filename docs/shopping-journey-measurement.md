# Shopping journey measurement — October 16, 2026

The checkout measurement release (PR #79, 87870e6) and GTM version 24 are published. Live Tag Assistant shows checkout start, shipping, accepted payment, review and cancellation hits sent to G-4ZLV1YB6GY. No production order was submitted in these checks.

This follow-up uses analytics 1.8.1 (`wl-site.js?v=20261016-2`) and compact checkout build 29. It adds no libraries, remote scripts, account identifiers or checkout requests. It keeps the existing direct GA4 transport as the single owner of ecommerce events.

## Questions the data can answer

| Question | Events / fields |
| --- | --- |
| What do shoppers search for? | Existing `search`, search suggestions/refinements and enhanced search-result events; `search_term` |
| Which categories and navigation links lead people onward? | `navigation_click`; Navigation Area, Destination Type, Destination Page, Category Navigation |
| Which products are actually seen and opened? | `view_item_list` after at least 35% visibility, `select_item`, `view_item`; standard item ID/name/list fields |
| Which cart changes succeed? | Confirmed `add_to_cart`, `remove_from_cart`, `cart_quantity_change`; Cart Action; quantity delta and resulting quantity |
| What do customers save and return for? | Saved for Later click intents, confirmed `save_for_later`, saved-item selections and confirmed `add_to_cart` with Cart Action `add_saved` |
| Where do checkout users stop? | `begin_checkout`, `add_shipping_info`, `add_payment_info`, `checkout_review`, `checkout_submit`, `checkout_cancel`, `checkout_error`, `purchase` |
| Which checkout works best? | Checkout Flow `quick_buy` / `compact_cart`, Customer Type `guest` / `signed_in`, Shipping Tier, Payment Type |
| How long does checkout take to become ready? | Checkout Ready Time metric (`checkout_ready_ms`), sent with the first valid review per revision |
| Does Quick buy encourage adding existing cart items? | Included Cart Items metric on checkout/purchase; filter to purchase when calculating ordered uplift |

## Data-quality rules

- Cart clicks are intents. A real ecommerce add/removal requires a new native document or replaced native row with the exact expected quantity. Optimistic client edits, failed deletes, stale records and incomplete cart rendering cannot generate confirmed outcomes.
- Quantity changes report the added/removed delta, rather than counting the entire line as added again. They also report the previous and resulting quantities.
- A Saved for Later move counts after cart removal is proven. Saved items added back count after the next authoritative cart proves the added quantity. An HTTP 200 alone is insufficient.
- Temporary Quick buy basket isolation/restoration never counts as customer cart add/remove actions.
- Native product impressions are visibility-based and deduplicated. Existing self-tracked recommendation/search lists retain their own ownership.
- Navigation stores a route and safe category context; it excludes full URLs/query values, raw account labels, email, address, payment details and free-form order notes. Sign In State is an authentication flag, not a customer identity.
- Purchase retains strict native confirmation, matching final-review contents, actual subtotal/tax/freight and transaction-ID deduplication. Native safeguards and submission behavior are unchanged. Pending cart intents clear after a confirmed purchase or sign-out.
- A repeated shipping/payment/review event after an actual edit is a new validated selection. A repeated mutation-observer callback is not.

## GA4 reporting setup

Property 286493964 has Checkout Flow and Customer Type from the first release. Added event-scoped Navigation Area, Destination Type, Destination Page, Sign In State, Cart Action and Category Navigation. Existing Page Type, Checkout Stage, Payment Type, Shipping Tier and product_id remain. Added Checkout Ready Time (milliseconds) and Included Cart Items (standard) custom metrics. Do not create a metric for `value`; use GA4's built-in ecommerce revenue measures.

Use Monetization / ecommerce item reports for product interest and revenue, Traffic acquisition for source/medium, and checkout/purchase journey reports or an Exploration for funnel loss. Compare by Device category and Checkout Flow; break checkout down by Customer Type and fulfillment/payment category. New custom definitions normally take 24–48 hours to appear in processed reporting; live event verification uses Tag Assistant and GA4 Realtime/DebugView.

The combined Google tag has both main-site and WebTrack GA4 stream destinations in the same property. Tag Assistant shows automatic page views going to both destinations. For WebTrack journey analysis, explicitly filter Stream name = Webtrack and Hostname = webtrack.woodsonlumber.com so property-wide page-view sums are not mistaken for distinct WebTrack views. A broader separation of the merged tag destinations should be handled as its own measured migration; no destination was disconnected in this release.

Purchase remains the existing primary Ads sales conversion. Micro-events are observation signals, not extra sales. Legacy secondary goals and obsolete account-default primary goals require campaign-goal review before changing bidding behavior. No bids, budgets or campaign goals change here. Auto-tagging remains enabled; no paid click or synthetic purchase is generated for verification.

## Verification and restore

The full suite has 392 passing tests, including native confirmation proof, visibility thresholds, optimistic edits, exact quantity deltas, failed deletes, empty carts, Save for Later confirmation, malformed/stale state, route privacy, loading-time bounds, payment categories, employee zero totals and purchase deduplication.

Runtime restore point before this follow-up: `backup/before-shopping-journey-measurement-20261016` at 87870e6. First-release restore point remains `backup/before-checkout-measurement-20261016` at 50806f6. GTM previous version is 23; current live version is 24. Use a new revert commit to preserve later unrelated work.

Release verification should cover live product views, category/search navigation, a reversible add/quantity/decrease/delete round trip, compact review/cancel and Quick buy review/cancel. Production guest creation or order submission is not required to fabricate analytics proof; simulated confirmed purchases use isolated transports. The next real, ad-attributed order must be reconciled by transaction ID in GA4 and the existing Ads import after processing.
