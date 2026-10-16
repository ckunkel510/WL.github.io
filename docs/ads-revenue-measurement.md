# Advertising attribution and revenue measurement — 2026-10-16

This release keeps the existing GA4 `purchase` import as the sole primary Google Ads sales action. It does not generate a purchase from a click or create a second sales conversion action. Analytics 1.8.2 is loaded by `headermodern.js` with `wl-site.js?v=20261016-3`.

## Findings and fixes

- The live `URLSanitize.js` removes arbitrary URL values at 300 characters. This can remove valid long Google `_gl` linker parameters before the Google tag consumes them. Preserve recognized advertising/linker and UTM parameters as opaque values, while retaining cleanup for recursive return parameters and oversized unrelated fields. Do not manually store or resend click identifiers.
- The PDP quote CTA reported `generate_lead` when a shopper opened the form. Rename that to `quote_request_click` with `lead_stage=intent`, including a compatibility mapping for cached old sidebars. Catalog quote clicks are measured separately. No lead revenue is fabricated. A submitted/qualified quote requires confirmation from Formstack or the lead system and is not inferred here.
- Known public Woodson store telephone links emit `contact_click` with the store and phone-intent category. Customer contact numbers and raw telephone values are excluded. This measures dialing intent, not a connected or qualified call. Existing Ads call conversions remain responsible for real ad calls.
- Confirmed purchases include optional Merchant cart data: account 453662576, feed label US and language en, plus both native `item_id` and `id`. Merchant Center product 140156 was verified to use the identical WebTrack PID and US/en offer identity. Attach the metadata only when all final unit prices and positive integer quantities reconcile to the verified merchandise subtotal. Unknown prices or inconsistent/fractional/employee totals omit the optional metadata; purchase totals stay authoritative. Never use public catalog prices as the paid price. No costs, customer identity or payment data are added.
- Pinterest's existing confirmed-purchase tag used sessionStorage `purchaseSubtotal` and an order-number variable that read the parent page's confirmation DOM. Both can fail with the new background checkout. GTM variable 21 now reads `ecommerce.value` and variable 20 reads `ecommerce.transaction_id`, using Data Layer Version 2 with no fallback/default. Existing names remain for tag references. They are referenced only by the existing Pinterest confirmed-purchase tag. Its `wl_analytics_event` / `event_name=purchase` trigger is unchanged. Paused Meta tags stay paused; the direct runtime owns Meta events.

## Google Ads account changes

Account 890-813-3301 retains its primary purchase action 786164556, value/currency from GA4, every conversion, 90-day click window and data-driven attribution. Its source event remains `purchase`; its awaiting-conversions warning reports the last attributed purchase May 6, 2026, not a configuration error.

Moved these obsolete account-default actions from Primary to Secondary, preserving their history:

- 477770823 — Click Specials (Default Google Ads Profile), Universal Analytics goal from 2020. The Other goal was included in 20 of 25 campaigns.
- 6725864149 — Android installs (all other apps), Google Play. The Download goal was included in 18 of 25 campaigns.

No budgets, bid amounts, ads, campaign URLs or legitimate call goals were changed. Primary-to-secondary changes remove these two obsolete actions from default bidding optimization; they remain observable in All conversions. A custom campaign goal can include secondary actions, so custom-goal usage needs separate inspection if any exist.

## Validation and limitations

402 automated checks pass, including long linker/click IDs, campaign parameters, recursive URL cleanup, click navigation, quote and public-phone intent privacy, valid Merchant cart data, unknown-price omission, confirmed purchase values and transaction deduplication.

The existing GA4 import already provides a supported Ads conversion path; adding another primary Ads purchase would double-count bidding signals. A genuine eligible ad interaction and subsequent native confirmed order are needed to prove the final Ads credit. Do not click paid ads, inject fake click IDs into production, or send synthetic purchases for this test. Imports can take up to 24 hours to appear. Compare transaction dates appropriately: Ads may report on the ad-interaction date, while GA4 reports the event date.

Enhanced conversions are a separate possible enhancement. They send first-party customer identifiers, such as a hashed checkout email, to Google. They require an explicit decision about customer-data use, the appropriate consent implementation, and acceptance of Google's terms. This release does not enable identity collection or accept those terms.

Runtime restore: `backup/before-ads-revenue-measurement-20261016` at 575b80e. GTM previous live version 24 restores the old Pinterest variables. Ads rollback is to return the two listed actions to Primary; do not do that as routine cleanup.

## References

- [GA4 conversion imports in Google Ads](https://support.google.com/google-ads/answer/2375435?hl=en)
- [Google cross-domain linker behavior](https://developers.google.com/tag-platform/devguides/cross-domain)
- [Conversions with cart data](https://support.google.com/google-ads/answer/14943675?hl=en)
- [Enhanced conversions for web](https://support.google.com/google-ads/answer/15712870?hl=en)
