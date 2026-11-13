# Christmas 2026: MERRY50

MERRY50 waives standard UPS Ground shipping on the entire parcel-eligible order when Christmas Shop merchandise totals at least $50 after item discounts and before tax or shipping. Valid November 13 through December 5, 2026, inclusive, Central time. The API stops accepting it at `2026-12-06T00:00:00-06:00`. Customers enter the code in the cart shipping-code field or compact checkout before payment. Clearing the field and applying removes it.

The offer covers all 172 products currently listed in Christmas Shop group 4649, including the shop’s extension cords. The reviewed allowlist is `data/christmas-shop-2026.json`. Run `python3 scripts/refresh-christmas-catalog.py` after catalog additions/removals, review its product/group diff, and redeploy. Products outside that manifest do not count toward $50 but receive the same Ground waiver when the whole basket is UPS parcel eligible. Orders containing unshippable items retain the existing availability restrictions. Expedited services, Woodson local delivery, and custom cutting/processing remain payable. No other promotion is reactivated.

## Validation and native checkout

The existing server catalog supplies product IDs, prices and quantities used for validation. Native cart net line totals may reduce qualifying spend for discounts/customer prices and cannot raise it beyond current catalog prices. Missing or malformed native totals fail closed. The browser sends those native totals using the existing cart quote transport; this does not create a new authenticated WebTrack pricing API.

The normal $9.95 shipping minimum has one dated exception for server-validated MERRY50 Ground rates. Zero shipping survives the fulfillment quote, selected claim, legacy UPS XML bridge, compact review and standard checkout preflight. Unexplained zero rates remain rejected. The native WebTrack controls remain authoritative; no order is submitted by this release’s verification.

Free-shipping claims use the complete normalized destination address hash, origin, and exact merchandise weight (two decimal places). They never use the normal broad ZIP/bucket fallback. A paid refresh at the same exact destination/weight supersedes a prior free quote. This prevents a free claim from being shared to another customer in the same ZIP. A native request with a changed address or weight must obtain a fresh quote. Claim lifetime remains 15 minutes, bounded by the promotion expiry.

## Holiday presentation

The holiday ribbon, Christmas Shop landing, all 17 Christmas groups (including the seven Christmas Lights subgroups and two Outdoor Decorations subgroups), and invitation use the same burgundy, evergreen, warm cream, and restrained gold treatment. Original product images and native category links remain. The invitation remains limited to once per browser per rolling 24 hours and once per session; direct Christmas landings skip it. Local storage is primary with a first-party cookie fallback. If persistent storage is unavailable, the automatic invitation is suppressed.

The offer copy automatically falls back to generic Christmas copy at expiry. Seasonal branding ends December 26 at midnight Central. No Wix homepage files are changed.

## Release and rollback

Release the API exception and verified native bridge before enabling the advertised offer and code-entry UI. Verify a live carrier quote with qualifying merchandise, no code, below-threshold spend, and native XML zero preservation using a public business destination. Check desktop and mobile subgroup cards, popup dismissal, navigation and overflow. The automated suite includes threshold, discounts, mixed basket, expiry, paid upgrades, processing charges, address isolation, native bridge and compact-review checks.

To withdraw early, remove the offer copy/code-entry UI and invalidate the promotion in `api/christmas-promotion.js`, deploying both front-end assets and the Vercel API. Do not revert unrelated checkout work. A backend-only withdrawal can leave advertising visible until the front-end update, so coordinate both deployments. Existing paid shipping rules remain in force.

## Verified release evidence

The production carrier API was checked on November 13 with three Christmas light sets (SKU 9086423, $59.97 qualifying merchandise) and a public business destination. MERRY50 returned Ground $0 and a saved $0 ship selection; all expedited rates remained positive. The same basket without the code returned Ground $9.95. A discounted qualifying total of $49.99 also returned $9.95. These were quotes only, with no order or label created. Native XML zero preservation was verified by automated integration tests; no authenticated customer order was submitted.

Responsive browser checks covered desktop, 390px mobile and 320px narrow mobile. Christmas Lights and its C9 leaf collection retain the festive hero and offer, with no horizontal overflow. The invitation’s CTA and dismissal stay visible at 320px.
