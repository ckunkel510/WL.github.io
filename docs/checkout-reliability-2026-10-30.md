# Checkout recovery release — October 30, 2026

The tested staff-manager compact checkout could remain loading while the same basket and selected job reached native charge review. Guest signup also switched the tested anonymous basket to an empty signed-in basket. This change adds recovery for those states and makes checkout diagnostics more useful.

## Resulting behavior

- An empty embedded entry is no longer treated as initialized WebForms. After 12 seconds, once preflight finishes, checkout offers a prominent standard-checkout action. This early recovery applies only before any native form has loaded; it never restarts a payment or submitted order.
- Standard handoff rechecks the current account and basket. It carries the selected sales/job address, separate billing address and requested timing, PO/reference and notes past native draft-reset handlers. Signed-in invoice recipients remain native defaults. A live follow-up found that a remembered fulfillment intent could style Pickup without activating WebTrack’s native radio. Recovery therefore reopens the native fulfillment choice for explicit confirmation; timing, contact and job details remain retained.
- Guest setup backs up matching visible and freshly fetched native cart lines before creating the account. It verifies the resulting native login. If the confirmed account cart is empty, recovery preflights the products and restores exact supported quantities and units. Existing different carts are retained for a shopper decision. Interrupted adds resume only from an exact recorded before/after state. Unsupported configurations stop safely; they are not guessed or recreated as plain products.
- The generated signup credential stays in memory. Error logging contains a fixed reason code rather than a native error message that might contain personal information.
- A positively confirmed purchase remains pending until the Google event command's processing callback. An unprocessed command receives one five-second retry with the same transaction ID. A matching native confirmation can retry the retained payload on reload for up to 30 minutes. This is not proof of network delivery and does not bypass consent or browser blocking.
- Checkout/cart errors include safe reason codes and product context. Checkout events distinguish `staff_assisted` from `customer` without names or account identifiers. Guest validation lists field IDs, never field values.

## Validation and release

The full Node suite passes (510 tests), including guest cart restoration/interruption, changed-account/cart guards, native form validation, charge confirmations, legitimate employee zero totals, purchase processing retries and privacy filtering. A local browser fixture passed recovery and native handoff at 1440×1000, 768×1024 and 390×844, with no horizontal overflow. The fixture initially retained pickup, PO/reference and notes across the native reset. The live follow-up corrected fulfillment replay to require native confirmation, and its regression check verifies that only the fulfillment intent is cleared.

Live pre-release checks reached native manager charge review with the selected job and separate invoice address; no order was submitted. The owner separately reached the final action with their personal employee-customer account on another device. These checks do not prove the changed scripts on production.

After release, verify all new build markers on a fresh page (native checkout, guest checkout, compact checkout, analytics), then retest fresh guest, personal account, charge account and staff-selected customer through review. Inspect the next genuinely submitted charge-order confirmation and matching analytics transaction. Do not backfill an unproven historical purchase. Register `checkout_context` and `error_code` as event-scoped GA4 definitions if they are not already registered; that registration affects future reporting.

Native WebTrack separately references Checkout2.js, Guestcheckout.js and headermodern.js; the header loads BuyNowPilot.js and wl-site.js. Update the five runtime files together and allow GitHub Pages/cache propagation before live verification. Runtime changes are held for release approval under AGENTS.md.

### Approved rollout corrections

PRs #107 and #108 are published. Live staff-manager testing reached native charge review with the original quantities and subtotal; no order was submitted. GA4 Realtime received analytics version 1.8.4 and staff-assisted context. Event-scoped Checkout Context, Commerce Error Code and Guest Validation Fields definitions are registered.

A subsequent guest preflight exposed an empty WebTrack placeholder carrying the same class as product rows. Guest parser build `20261030-guest-cart-recovery-2` ignores only rows with neither a quantity input nor a product link. Incomplete real product rows still stop before account creation. A regression check covers both states. This correction is part of the user-approved rollout and requires fresh live guest verification.

Guest build `20261030-guest-cart-recovery-3` addresses signup waiting exclusively for the hidden frame's full load event. The frame now has a layout and eager loading, and a bounded readiness probe waits for native fields, a form and WebForms hooks. It submits the native action once and ignores that same document while waiting for a new response. Timeout codes distinguish an unopened form from an unconfirmed submission. A confirmation timeout performs a fresh matching-login read before reporting failure; it never repeats signup. Generated credentials always satisfy the native uppercase, digit, symbol and length requirements and remain in memory only. Local checks cover a held load event, missing hooks, blank frames, duplicate-submit prevention, native duplicate-email response, timeout cleanup and verified-login recovery. Live confirmation is still required; the exact source of the frame delay is unproven.

## Rollback

Revert this release commit and restore the previous script version URLs. Do not delete recovery backups or pending order receipts while an order result is uncertain. A rollback can leave a tab-local guest cart backup that the previous runtime cannot restore automatically; keep it for investigation before asking the shopper to rebuild that basket.

Google documents the callback as event-command processing, and purchase deduplication by transaction ID for web streams:
- https://developers.google.com/tag-platform/gtagjs/reference/parameters
- https://support.google.com/analytics/answer/12313109
