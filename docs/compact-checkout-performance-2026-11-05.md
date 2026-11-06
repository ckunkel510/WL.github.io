# Compact checkout loading and rate recovery — November 2026

Runtime `20261106-native-quote-settling-70`; native wizard `20261105-compact-continue-recovery-9`; shipping offer `20261106-native-summary-quotes-9`.

Compact checkout could wait for unrelated page resources, cancel a legitimate entry request, or apply an old async result to a replacement WebForms view. It could also lose its confirmed quote when WebTrack advanced to shipping: those later views have no delivery-address fields, so a background estimate could overwrite the quote with an account-address estimate. Continue then rejected the already priced native order.

The repair makes each async continuation belong to its exact native view and driver, preserves address quotes through shipping/payment/review, and accepts a recovered quote only for the exact basket and selected destination. Shipping Continue waits up to ten seconds for confirmed native shipping, tax and arithmetic, then offers compact Retry. It never accepts an estimate or bypasses total validation. Saved-card changes settle before the following native Continue. The inactivity timer recognizes same-document step changes while retaining bounded recovery for a true stall.

Other loading improvements:

- Initialized interactive WebForms documents can proceed without waiting for images/chat. A form, positive initialization and no active UpdatePanel request are required.
- Initial native GETs are no longer cancelled and restarted at four seconds. No native POST is automatically replayed.
- Explicit checkout quote refresh waits out older estimates and snapshots the settled address. Changed-context or cancelled read-only requests get bounded retries; HTTP rejections remain customer-controlled.
- A twenty-second deadline covers shipping fetch and response decoding, releases Retry and rejects late results.
- Known native validation/rate rejections release compact Continue and remain in compact checkout. Genuine native loading failures retain guarded standard-checkout handoff.
- The exact owned native frame skips duplicated advisory branch/account stock requests; ordinary cart, clearance and inventory enforcement remain in place.

Identity, basket, destination/invoice, final-total, hosted-payment and uncertain-order safeguards remain enforced. No backend rate calculation or final order submission code is changed. Drafts contain no payment state, and status markers contain no customer data.

Validation: 601 automated tests pass, including stale views, duplicate in-flight Continue, native quote preservation, rejected destination/basket quotes, total settling, saved-card postback settling, same-document inactivity and guarded fallback. Responsive recovery markup fits phone, tablet and desktop widths. Authenticated local-override QA with the final repair reached compact NY UPS review, then Back preserved the original six-unit basket and re-entry returned to the same $80.72 review. Two consecutive runs took 40.6 and 29.6 seconds. Earlier builds failed repeated entry and are superseded by this repair. The user reported intermittent power/internet issues during the live investigation, so live latency and loading failures require repeatable verification. No orders were placed or cart lines changed.

Rollback: revert this release, including the three runtime identifiers and both shipping loaders.
