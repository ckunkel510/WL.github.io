# Native shipping-choice readiness — November 9, 2026

The native method cards were enabled before the address-aware rate quote existed. Clicking UPS in that interval called `select()` with no current quote, then displayed a misleading instruction to recheck the address. A raw cart-cache fallback could also paint choices before the address-aware runtime loaded.

Native choices now start inactive until the actual form controls and WebForms are initialized. Paid choices then wait for an address-matched current quote; pickup remains available during rate lookup. The display says Preparing checkout or Checking delivery options. It stops polling after 12 seconds and exposes a manual Try again action if lookup stalls or fails. The existing quote-state attribute and WebForms events refresh presentation. No extra carrier lookup is made merely to test readiness.

A missing or incomplete routing address takes the existing manual-entry path: choosing delivery/UPS opens the native address fields without attempting to reserve a nonexistent rate. Existing required-field validation and final rate synchronization still apply. Fast Continue with an already-selected method waits up to ten seconds for the quote already loading, without starting another quote request. Failure points to retrying delivery options instead of claiming the address is wrong.

A synchronous click guard also covers address edits before the UI debounce. Only one reservation runs at a time. A response for an address, branch or page visit that changed during reservation cannot apply a stale choice. Back/forward-cache restoration reinitializes the readiness observer and controls. Compact Quick Buy keeps its existing path.

## Verification

- All 763 tests pass, including 14 new behavioral regressions for incomplete loading, late WebForms, delayed quote, manual/guest address entry, fast clicks, unavailable services, double clicks, stale address/page responses, bounded retry, departure, cached cart isolation and fast Continue waiting without another quote lookup. Existing date, holiday, pricing, payment and native-navigation tests pass.
- Actual-script synthetic UI: slow form keeps all choices inactive, slow quote keeps paid choices inactive and pickup available, completing the quote enables the correct choices, and UPS confirmation makes one reservation and reveals sections 1/3/4/5. A failed quote recovers with one retry. Manual address entry opens with zero reservations/errors and a completed synthetic address becomes ready when its quote arrives.
- Saved-method/pending-quote fixture: Continue first shows confirming with no reservation/post; finishing the in-flight quote produces one reservation and one accepted synthetic native continuation, with zero additional quote requests. Final isolated fixture console errors: zero.
- Layout checks at 390 and 1280 pixels have no horizontal overflow. Safe synthetic loading screenshot: outputs/native-method-readiness-loading-mobile.jpg in the task workspace.
- Live source-only test: actual native UI showed Checking delivery options with UPS disabled, then enabled it once a current quote was usable. Candidate Checkout2 native-choice-13 confirmed UPS, revealed the native delivery/billing sections with no false warning, continued to native Shipping & total, and native Back returned to details. All 18 original address fields remained exact. Cart rows, product links and quantities remained exact. Live console errors: zero. The final fast-Continue wait addition was verified in the isolated actual-script fixture and regression tests after the live test; the live test had a current quote and exercised the unchanged ready-quote branch.
- No order, payment, authorization, verification, token or saved-account change was submitted. No customer/financial values or actual checkout screenshots were saved.

## Restore and release

A full 311-file source archive and SHA256 manifest were saved BEFORE edits at outputs/restore-points/native-method-readiness-ea50d53-2026-11-09/ in the task workspace. Production base: ea50d5361cb23f7b3d5bf59e6ca2982b204e100c, tree9e31bed7cbbfd0c43c17b1483d062c6a8def3b95.

Only Checkout2 and its CartNativeViews cache version change at runtime. NativeCheckout's destination-based arrival estimate and internal extra-business-day calculation are unchanged. No admin header, API handler, dependency, environment or credential changes. All local source overrides were cleared, DevTools/debugger closed, viewport reset, preview server stopped and agent tabs closed; the original user cart tab was retained. Publication requires a new checkout-release approval under AGENTS.md line47.
