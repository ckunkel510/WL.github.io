# Hosted card cancellation recovery

Cancelling Epicor hosted card entry can hide the iframe while leaving WebTrack's checkout area empty. This was reproduced during the live guest audit; the user reported the same result for signed-in customers. The cart remains available through its normal GET link.

The native checkout decorator now recognizes the hosted provider's close message from its exact origin and a known iframe window. When the native checkout container remains blank, it offers **Card entry closed → Return to cart**. The customer chooses the existing cart GET route; the repair never submits a form, navigates automatically, retries payment or selects a saved card.

The hosted card return has `#MainLayoutRow` without the `.mainContents` wrapper used by earlier checkout views. Both known containers are checked. A usable native checkout, restored view, fresh active card window or provider payment-result signal takes precedence. Only the static iframe origin/path and its window reference identify the provider. Result parameters and card tokens are never inspected; private iframe URLs, customer details and cart values are never logged or retained by the repair. A short-lived session marker stores only the verified close timestamp so recovery can survive native navigation. Denied storage still permits same-document recovery.

The loader recognizes hosted payment views and a recent close marker. It continues to use the existing native decorators and retry mechanism. No backend, credential, environment, dependency, admin-header, quote, order-submission or compact-checkout code changes are required.

## Restore point

The full 313-file pre-edit archive and SHA-256 manifest are retained in the task's `outputs/restore-points/payment-cancel-recovery-ab34b56-2026-11-09/`. Production baseline: `ab34b56439c50c6fe452c40d0dfce69989f4e20c` (PR143), tree `8d2958df97861aa4600096ec96f185b162aa0f10`.

## Validation

- Behavioral tests cover trusted origin/source, guest/signed-in parity, real native return-container shape, usable/unknown views, removed and newly added iframes, fresh card attempts, opaque payment results, navigation markers, native updates, storage denial and cached-page restoration.
- The actual script's synthetic recovery layout was checked at 390, 768 and 1280 pixels: no horizontal overflow, a 48-pixel return link and keyboard focus on that link. The synthetic iframe uses `srcdoc`; no payment provider is contacted.
- Live guest checks before this repair passed main checkout entry, one authorized guest signup, required/manual/separate-billing validation, address defaults/editor, UPS speed/date/total roundtrip and secure empty card entry. Cancel reproduced the blank page; the temporary guest cart item survived the native cart return. The isolated guest session later ended during diagnostics; candidate guest cancellation has not yet been re-run in a newly authenticated guest session.
- All 783 tests pass (20 new recovery regressions); JavaScript syntax and diff checks pass.
- Live signed-in provider closure displayed the recovery panel, and its explicit Return to cart link restored both original cart rows, product links and quantities exactly. Re-entering native checkout preserved all 18 original address fields. Captured console errors: zero. No saved card was selected or changed.
- Temporary public-source-only DevTools overrides were cleared, DevTools closed, viewport reset and agent tabs closed. A clean published cart GET was verified with the original two rows and no candidate asset loaded. The original user tab was retained.

No card details, payment, authorization, verification, token creation, saved-card change or order submission is part of these checks. Actual bank-side success/decline is outside this live-only test.

Production remains unchanged until explicit checkout/payment release approval under `AGENTS.md`.
