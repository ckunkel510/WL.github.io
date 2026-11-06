# Compact checkout loading and rate recovery — November 5, 2026

Runtime `20261105-compact-loading-61`; native wizard `20261105-compact-continue-recovery-9`; shipping offer `20261105-bounded-checkout-quotes-5`.

The compact flow had several independent sources of delay:

- `nativeFormsReady` required `document.readyState === 'complete'`. A usable, initialized WebForms form could wait for unrelated images and chat resources. Interactive documents now qualify only with positive `Sys.Application` initialization, a real form and no active UpdatePanel request. Native validation and postback helpers remain required.
- The previous four-second empty-frame retry cancelled legitimate pending GETs. The initial navigation now completes once or reaches the existing bounded standard-checkout recovery. No native POST is retried automatically.
- Details always refreshed shipping twice. A new explicit `refreshCheckout()` waits out an older estimate and takes one fresh address snapshot; an idle service makes one quote request. The compact runtime keeps the old two-call path for cached older shipping scripts.
- Quote, reservation and shipping context requests could hang forever and retain their shared in-flight promise. A 20-second deadline covers fetch and response decoding, aborts where supported, and releases the request for Retry. A response arriving after the deadline cannot publish stale rates or selections.
- The wizard could reject rate confirmation after compact checkout had marked Continue as used. The proxy now reports validation/confirmation/posting state. A known rejection before POST releases that marker and offers compact Retry. Rate failures stay in compact checkout; native loading failures retain the guarded standard handoff.
- The owned native frame repeated advisory account/stock requests from `ShoppingCartBranch.js`. Only the exact same-origin frame owned by the compact overlay skips those suggestions. Ordinary carts and clearance/inventory enforcement retain their existing work.

Validation includes initialized interactive forms, missing initialization, busy UpdatePanels, pending navigation without restart, exact iframe ownership, fresh quote counts, old-address responses, stalled response bodies, timed-out reservations, stale responses, native rejection, duplicate in-flight Continue, and compact versus standard recovery. Existing account, basket, final-total, payment and uncertain-order checks remain in force.

A controlled Chrome cart reached compact review in 2,841 ms with one native entry GET, zero orders and no cart writes. This is a synthetic fixture measurement, not a production latency claim. An authenticated live retest requires restoring the WebTrack session, which expired during this investigation. Browser navigation intermittently stalls under automated inspection, so isolated gate tests and a healthy fixture pass do not prove every production path is fixed. Production verification and any remaining test limitations are recorded in the project checkpoint.

Rollback: revert this release, including all three runtime build identifiers and both shipping loader versions. No backend rate calculation, payment-entry code or final order submission was changed.
