# Checkout measurement release — 2026-10-16

Status: runtime patch prepared for release approval. GTM has one saved, unpublished change. GA4 reporting dimensions have been registered.

## Runtime owners

`headermodern.js` loads `wl-site.js`, the live analytics source. `BuyNowPilot.js` owns the compact/Quick buy checkout and reports verified stages to the parent's `WLAnalytics.checkout` bridge. Child checkout frames keep their existing analytics exclusion for speed. `Analytics.js`, `wl-commerce.js`, and `wl-events.js` are compatibility copies, not the live header entry. No generic GTM GA4 forwarding tag should be added alongside the direct GA4 transport.

## Verified findings

- Tag Assistant showed product and cart events reaching G-4ZLV1YB6GY. Live compact checkout reached final review without emitting its checkout stages. The parent previously had no analytics bridge and the child intentionally skipped the custom analytics runtime.
- The base GTM Google tag read an old local-storage user identifier on an anonymous product page. The saved draft removes that configuration parameter; it preserves ordinary GA4 cookie/session measurement and all triggers.
- Google Ads account 890-813-3301 is linked to GA4 property 286493964. Auto-tagging is enabled. The existing primary purchase action imports `purchase`, uses GA4 value/currency, counts every conversion, and has a 90-day click window. Its last attributed conversion was May 6, 2026. This is an Ads attribution observation, not an order count.
- The Ads secondary actions `Shopping Cart` and `Add to cart (Google Analytics event Cart clicked)` show Misconfigured. Their old event definitions need replacement with standard events as secondary observation actions. Do not make them primary sales goals.
- Obsolete Universal Analytics `Click Specials (Default Google Ads Profile)` and `Android installs (all other apps)` remain account-default primaries. Review campaign goal usage before making them secondary. Existing phone lead campaigns must retain their legitimate goals.
- Account URL suffix is populated with Google ValueTrack UTMs; it is not a literal broken template. Landing-page reports also showed duplicate UTM keys. Review the campaign/product final URLs before removing either source. No URLs, budgets, bids, campaign goals or Ads conversion settings were changed.
- Combined Google tag destinations include the main website, WebTrack, and Ads. Domain configuration currently has no explicit conditions. Default cookie settings can cover these related subdomains; the empty list alone does not prove lost attribution. The combined tag has a placement warning, while the WebTrack GTM container reports Good quality. Native/Wix tag placement remains a separate follow-up.

## Patch contract

- Existing browse/list/cart/add/remove instrumentation remains. Product detail IDs now come from the current product URL and native/new quantity controls are recognized. Delayed native add-to-cart confirmations are observed.
- Add Quick buy open, guest information start/completion/errors/cancellation, Saved for Later intent, compact checkout start, fulfillment, accepted payment, final review, submit, cancellation and generic error events.
- `begin_checkout` occurs once per checkout attempt, even if cart extras change. Accepted shipping/payment and review events can repeat when the actual item selection or fulfillment changes.
- `purchase` requires WebTrack `success=1`, its confirmation message, merchant confirmation panel, a valid order number, and for the compact bridge a matching verified final review and cart contents. A click, payment screen, declined response, or cancellation cannot create a purchase.
- Merchandise value comes from final native subtotal; tax and shipping are separate. Confirmed employee zero totals stay zero. Unknown native fallback values are omitted rather than copied from an old global cart or `purchaseSubtotal`.
- Transaction IDs are deduplicated in memory and session/local storage, including confirmation reloads. GA4 receives the transaction ID as its server-side deduplication key. Browser-side measurement cannot guarantee delivery when the user blocks tags or leaves before confirmation.
- Measurements whitelist flow, audience, fulfillment, payment category, item IDs/quantities, totals and included-cart count. No address, email, username, card/token, account scope, free-form notes, or internal checkout journal ID is forwarded. This does not certify unrelated account-payment URL parameters or third-party automatic tags.
- Analytics errors cannot block cart recovery or native submission. The patch adds no checkout network requests or new libraries.

## Event parameters and reporting

GA4 now has event-scoped `Checkout Flow` → `checkout_flow` and `Customer Type` → `customer_type`. Existing Checkout Stage, Payment Type, Shipping Tier and Page Type definitions remain. The new runtime fills these with small enumerated values. Purchase stays the primary sales event; no duplicate Ads purchase tag was installed.

## Validation

- 378 automated tests pass, including confirmation proof, amount consistency, stale/different reviews, cart edits, zero totals, transport/storage failures, accepted payment category, late confirmation safeguards, privacy, and duplicate prevention.
- Live signed-in cart reached compact final review and returned to cart without an order. Current live basket was preserved, including the user's current quantities. Tag Assistant confirmed the existing funnel gap.
- Isolated browser fixture: signed-in compact checkout and guest information → secure payment → review → simulated confirmation. No real account, payment, or order was used.
- Isolated Quick buy: two humus bags, three mulch bags included from the cart, Caldwell pickup. One checkout start, one submit and one purchase. Merchandise 18.23, tax 1.50, shipping 0.00, total 19.73 in the fixture's synthetic pricing. Confirmation replay and reload kept purchase count at one.
- Quick buy cancellation restored the fixture cart and emitted no purchase. Local Google/Meta network transports were stubbed and blocked by CSP; synthetic purchases did not enter production analytics.
- Guest was tested locally in this release; no new production guest account or production order was created.

## Release and rollback

1. Approve and merge this narrow runtime patch, then verify the Pages deployment marker and live cache-busted versions: analytics 1.8.0 and compact checkout build 28.
2. Publish only the saved GTM Google Tag - Base change. Current live container version is 23, published Sep 25, 2026. Workspace 24 had no changes before this audit and now has one modified tag. The draft removes only its local-storage `user_id` parameter.
3. Re-run live product/cart/Quick buy/compact/guest pre-submit events in Tag Assistant. Verify base tag firing and no stale user ID in an anonymous session. Do not fabricate a paid click or a purchase event.
4. The first genuine confirmed order must be reconciled by transaction ID and value in GA4, then in the existing Ads imported purchase action if an eligible Ads interaction preceded it. Attribution/import processing is asynchronous. A direct test visit does not prove Ads attribution.
5. Runtime restore point: `backup/before-checkout-measurement-20261016` at 50806f6af44fe5f1e9c3ae5740b2f2f7527508aa. Revert this patch through a new commit; avoid resetting unrelated later work. Before GTM publication, discard its single draft change; after publication, restore version 23 if needed. The two GA4 reporting definitions can remain harmlessly or be archived.

Repository AGENTS.md requires release approval for changes touching final order behavior. The runtime bridge is ready for that approval; it does not change native validation, cart mutation, payment ownership, or order submission logic.
