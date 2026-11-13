# UPS arrival estimate handoff — November 13, 2026

The carrier and rate quote contain transit dates. The native checkout can return an intermediate delivery-details document with its stock-shortage confirmation before rendering shipping. `NativeCheckout.ready()` treated this as a new details entry and deleted the estimate captured immediately before Continue. Both browsers consequently rendered “Arrival estimate unavailable.”

Live Chrome debugging confirmed a fresh matching UPS quote, a successful estimate storage write, and then the deletion in the intermediate document's initial `ready()` call. The document was at `interactive`, its native stage was `details`, and the transferred estimate still existed immediately before deletion. No customer values or cart contents are retained in this report. A separate live UPS probe using public city ZIPs and a synthetic parcel returned per-service carrier dates.

The fix marks the metadata as pending on confirmed native UPS Continue. A fresh pending handoff survives the intermediate details document for up to two minutes. Shipping consumes the marker; a later Back to details clears the completed estimate. Existing fifteen-minute quote expiry, recognized Texas origins, service matching, dispatch qualification, and the existing business-day adjustment remain authoritative. Missing, malformed, expired, future, local-delivery, and unconfirmed-radio data retain the unavailable fallback. No rate, price, stock-confirmation, cart, address, payment, or order control changes.

`NativeCheckout.js` is the source. `CartNativeViews.js` only updates its requested version. Neither is generated from the dormant cart bundle. The build markers are `20261113-ups-handoff-7` and `20261113-native-views-12`.

Validation:

- 862 Node tests pass, including the exact pending → intermediate details → shipping → Back lifecycle and invalid handoffs.
- Eleven actual-runtime browser fixture checks pass in Chrome at 320×667, 390×844, 820×1180, and 1280×900, and Safari at actual 319×666, 390×844, 819×1180, and 1278×898. Safari's scaled Responsive Design Mode rounds some dimensions.
- The fixture boots the actual native guide in the intermediate details document, then renders native shipping controls and changes the selected service. It uses synthetic/public carrier metadata and makes no external request.
- The live employee-manager cart returned with its original five lines and quantities. No payment selection or order submission occurred. Temporary debugger breakpoints/watches were removed.

Release requires checkout-state approval under `AGENTS.md`. After publication, verify the active native asset version and repeat the native stock-confirmation handoff in Safari and Chrome, stopping at shipping. Responsive previews are not physical iPhone/iPad certification.

Rollback: restore `NativeCheckout.js` and `CartNativeViews.js` together from baseline main `c8fc633451554fc323aa1f97c535e14e38c3afa3`. Do not reset account, cart, or customer data.
