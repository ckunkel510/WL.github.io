# Compact checkout recovery — November 5, 2026

Build: `20261105-checkout-recovery-60`. Runtime source is `BuyNowPilot.js`; `headermodern.js` loads its versioned URL. The legacy shopping-cart bundle does not contain this module and is unchanged.

The observed failure left the compact checkout's native iframe on an empty document and eventually required the shopper to find the standard-checkout button. The same cart and destination returned UPS rates in standard checkout. The initial frame-loading cause was not conclusively isolated; the repair bounds that failure and prevents it becoming a checkout dead end.

Changes:

- Attach the frame before setting its URL; ignore the initial `about:blank` load and callbacks belonging to detached frames or superseded revisions. Retry only the initial empty GET once. Never replay a native POST or final order.
- Recover a failed initial entry after 12 seconds, and an ordinary native step with no progress after 45 seconds. Customer editors, review, and hosted payment are excluded. Safe natural-cart failures automatically enter standard checkout after fresh account, basket, and uncertain-order checks.
- Keep a 30-minute same-account, same-basket session draft of address, fulfillment, timing, and notes. Do not save payment details or ready/submitted state. Reapply the draft after native reset listeners on standard-checkout re-entry.
- Preserve standard routing for that account/session for 30 minutes after handoff, so browser Back and forward checkout do not reopen the failing compact attempt. Clear frames and release natural-cart work on pagehide.
- Bound the initial async script/account bootstrap to 12 seconds. A late bootstrap cannot intercept the already released native checkout click; navigation away discards a queued click.
- Read WebTrack's actual UPS shipping dropdown as well as its local-delivery dropdown. Native shipping changes settle before continuing.

Automatic handoff does not leave an isolated Quick buy basket, an in-progress hosted payment, a pending cart write, or an uncertain/submitting order. Those existing recovery and duplicate-order protections remain in place. Customer validation errors still request the required correction.

Validation: 571 automated tests pass, including blank/unavailable/detached frames, stale rejections, single recovery, Back during pending work, changed identities/baskets, a new uncertain receipt during handoff, session-draft isolation/expiry, and UPS speed changes. Syntax and whitespace checks pass. Synthetic Chrome testing reproduced a blank native entry and reached standard checkout automatically; browser Back and forward re-entry stayed on standard checkout with zero orders and zero cart writes. Live publication and verification are recorded in the project checkpoint.

Rollback: revert the release commit (runtime, loader version and related tests) to the preceding build. No shipping-service or native final-submission code changed.

## Native Back follow-up

Live recovery testing found that consolidated standard checkout's Back button changed its selected step but left the destination section collapsed. `Checkout2.js` build `20261105-native-back-navigation-7` opens that selected section through the existing section editor. Ordinary wizard navigation remains unchanged. Two regressions cover collapsed billing and the ordinary wizard; the full suite passes 573 tests. The compact module remains build60.
