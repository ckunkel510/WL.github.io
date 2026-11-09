# Native checkout for the normal cart — 2026-11-09

Normal ShoppingCart checkout enters WebTrack's native pages. Compact checkout remains implemented and enabled for product Quick Buy. The normal cart no longer waits for compact account bootstrap; existing Quick Buy journals and guest basket recovery still run their original owner checks.

The native details form presents completed saved details as editable summaries, leaves every required unfinished section available, retains the active editor while typing, and supplies browser autofill hints. Pickup contact defaults from the current native contact when blank; a customer-cleared or edited contact is preserved. Timing and optional instructions remain accessible. A single deliberate Continue waits for pending WebForms updates, confirms fulfillment, checks that routing has not changed, and uses native validation. The wait is bounded and canceled by navigation. Native server errors keep their section open; delayed legacy return timers cannot reopen completed sections without an error. A visible Back to cart link provides an escape from each native stage. No new code submits payment or places orders automatically.

Native shipping/payment/review pages have a consistent progress guide. Detail-only decoration no longer hides controls on later native pages. Presentation loads in parallel; if it is unavailable, the native form remains open and usable. Quick Buy frames retain their own UI and native relays.

A live Back test found the existing pickup shipping intermediary immediately forwarding the customer back to payment. Payment Back now holds that intermediary; browser history returns also hold it. Forward pickup can still skip the intermediary once after a fresh, deliberate details continuation when no choices require input. Opening or refreshing the shipping step cannot start it again. UPS speed choices and multiple local-delivery choices stay deliberate. Navigation away cancels a queued continuation.

Guest signup keeps the existing single-use marker for in-flight compatibility, then proceeds to native checkout only after basket recovery and fresh account confirmation. An unverified guest payload cannot autofill another native account. No real guest account is created by the verification tests.

## Restore point

Before edits, every tracked published file was archived with per-file SHA-256 hashes in the task's `outputs/restore-points/native-cart-checkout-17f2e74-2026-11-09/`. Published base is `17f2e7425043f3eb4f27f81037ea812af46011f1`; local equivalent tree starts at `aad6ad7`. Restore affected files through a reviewed release; do not overwrite subsequent unrelated work. No WebTrack admin HTML or service credentials are changed.

## Verification

All 717 automated tests pass. Automated tests cover native/compact routing, existing recovery, guest identity and basket boundaries, typing/edit summaries, optional-loader independence, native validation, single continuation, payment Back and browser Back, expired markers, UPS/manual choices, and cancellation on page departure. Browser checks use synthetic saved/manual forms plus a temporary live cart item. Live checks stop before Complete Order; no payment or order is submitted. Responsive checks pass at 390, 768 and 1280 pixels, with synthetic screenshots only. Live ordinary-cart native entry, pickup defaults/contact/date, pickup payment, UPS Ground → Second Day → Ground and payment, review total parity, review Back → payment and pickup payment Back → held shipping → editable details pass. One generic native error occurred earlier before the pending-update guard; its backend cause is not established. Subsequent guarded paths passed. The single temporary test item was removed and the signed-in cart is empty. No orders, payments or real guest accounts were submitted.

The live candidate test uses Chrome source overrides, with the exact guide prepended to Checkout2 for transport because the new guide asset is not published yet. No WebTrack HTML, authentication, carrier, payment, or server response is mocked. The independent parallel loader has automated coverage. Production verification must check the new asset after an explicitly approved release.

## Release gate

This changes sensitive cart/checkout behavior. Obtain specific approval under AGENTS.md before merging or publishing. After approval, verify Pages publishes the reviewed source, the guide and updated runtimes return JavaScript, ordinary cart uses native, and Quick Buy stays compact. Existing already-open tabs may need a reload to receive the new runtime.
