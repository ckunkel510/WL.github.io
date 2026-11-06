# Compact checkout: collect choices before review

Draft candidate. Production remains on the approved UPS release; publishing this change requires release approval under AGENTS.md.

Cart checkout now pauses at three customer steps: **Your choices → Payment → Review**. The first step prepares the unsubmitted native delivery screen and shows the address, schedule, notes and available UPS speeds with carrier estimates. Continue applies those choices together. The native payment screen then presents saved-card choices or a priced-total confirmation before secure card entry. Only native final review can enable Place order.

Changing speed, timing, notes or contact details during the first step retains its prepared native screen and rates. Unchanged forms do nothing. Address routing, job or fulfillment changes prepare the affected options again; an unsubmitted native details screen can be reused. Native shipping, tax, selected payment, basket identity, final review and duplicate-submission checks remain authoritative. Quick buy keeps its existing sequence. Existing compact retry and standard-checkout recovery remain available.

Manual entry keeps valid fields when another needs correction. US state names and native numeric-state labels normalize to abbreviations; ZIP+4 and browser autofill hints are supported. Invalid states, ZIPs, email and short phone numbers are flagged before continuation. Guest billing can follow delivery or remain independent. The initial guest form accepts full state names, supports Enter, and guards repeated signup clicks while a request is pending. Signup and payment protocols are unchanged.

Validation completed:

- 653 automated tests pass, including native-driver holds before details/payment POSTs, one continuation per step, removed saved-card handling, guest validation/correction, separate billing, duplicate guest starts, stale native views, slow rates, payment-total gates and final-order safeguards.
- The actual compact UI functions and styles were exercised in an isolated browser fixture with synthetic data. Unchanged address, speed, contact and note edits caused zero options refreshes. Payment switching retained the priced screen; backtracking preserved the expedited service. Invalid email/state/ZIP retained other entries and accepted correction with Enter. Independent guest billing and same-as-delivery behavior passed.
- Phone 390×844, tablet 768×1024 and desktop 1280×900 fit without horizontal overflow. The fixture cannot transmit payment details or submit orders.

Live native verification passed with a source-only browser override and production WebTrack/UPS services: the unsubmitted delivery screen remained held, unchanged address and Ground → Second Day edits added zero options refreshes, native payment paused before its continuation, saved/new payment switching retained the priced screen, and Back → delivery → payment → final review preserved Second Day and its carrier arrival estimate. Native shipping $49.31, tax $9.40 and total $123.33 matched final review. The additional halted-state guard passes automated recovery checks; the final source is also checked at native delivery preparation. The original cart remains intact.

A real guest signup has not been submitted because it creates customer records. Guest tests use controlled forms and native payment-gate fixtures. No order has been placed. No server, UPS credentials, production deployment or WebTrack admin configuration changed. Browser overrides, diagnostics and the local preview server are removed after QA.

Runtime versions: BuyNowPilot `20261106-choices-first-73`, Guestcheckout `20261106-guest-manual-fields-5`, header `20261106-choices-first-loader-6`. The staged root-header snippet points to header 6; applying that snippet in WebTrack is a separate user-controlled configuration step. Rollback is the previous published Buy72/Guest4/header5 assets or the existing standard checkout control.
