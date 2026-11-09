# Native shipping phone fit — November 9, 2026

The native Shipping & total screen retained a legacy 70% page width, 15% side margins and nested padding. At a 390px phone viewport, the shipping table extended to 400px, the arrival card was squeezed, and native Continue measured 39px high. The UPS dropdown also inherited a 140px minimum width.

Shipping-scoped CSS now uses the available width with a 960px desktop cap, consistent gutters, and zero extra grid-column spacing. The dropdown may shrink within its native cell. The original native Back and Continue anchors have 48px touch targets and rounded corners. The guide and arrival logic, native controls, attributes, event wiring, rate amounts, validation, and payment/order flow are unchanged. Only CSS and cache/build versions change in the runtime files.

## Verification

Actual native Shipping & total with source-only CSS overrides:

| Viewport | Page scroll width | Horizontal overflow | Back / Continue |
| --- | --- | --- | --- |
| 320px | 320px | None | 48px / 48px |
| 390px | 390px | None | 48px / 48px |
| 768px | 768px | None | 48px / 48px |
| 1280px | 1280px | None | 48px / 48px |

All 749 existing tests pass. No tests that mirror CSS were added. Live UPS Ground → Second Day → Ground still updates the arrival date and restores the exact original native total. All 18 address fields and the user's cart rows, product links and quantities are preserved. Browser console errors: zero. No order, payment, authorization, verification, token creation or saved-account/card update was submitted.

All source overrides were cleared, DevTools/debugging closed, viewport reset, and the test tab closed after returning to the cart. No preview server or credentials were used for this correction.

## Restore and scope

Production base: 62e20d85887075a53eabcf78e626be442ccf6031 (PR140). Full 309-file source archive and SHA256 manifest were saved before edits at outputs/restore-points/native-shipping-mobile-fit-62e20d8-2026-11-09/ in the task workspace.

This is a responsive-layout and button-sizing correction within the user's requested styling work and AGENTS.md's Low-Risk Changes tier. It adds no checkout behavior, API call, dependency, environment, credential, or admin-header change.
