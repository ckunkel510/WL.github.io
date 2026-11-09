# Native checkout clarity and UPS arrival — November 9, 2026

A recommended UPS card looked selected even when no native sale-type radio was checked. The remaining sections stayed hidden. Live reproduction confirmed this exact state. Recommendations now have an empty selection indicator and a clear Use UPS shipping action. Confirming uses the existing reservation and native radio path; a saved, confirmed method shows its fields immediately. Native validation no longer infers a choice from decorative classes. Rapid method changes cannot apply a second mode using a different pending reservation.

The native checkout uses softer cards, shorter progress labels, fewer repeated instructions, aligned mobile address summaries, and a shorter Continue to shipping button. Optional order notes have one label. Empty pickup-store instructions and the duplicate native Back to cart control are suppressed when the functioning guide supplies their replacements. The native fields and fallback controls remain in the source. Quick Buy keeps its compact path.

## UPS arrival display

The shipping screen uses WebTrack's actual UPSShippingCalculatorControl_ShippingSelection, whose option values are carrier service codes. This differs from the local-delivery selector used by the old widget. Arrival follows the exact selected UPS code, including services with trademarked labels; it does not guess transit days from service names or borrow Ground's date.

The existing quote already contains UPS transit data for the configured Texas carrier origin. On the native details Continue action, the guide transfers only public origin and carrier/service timing metadata across the page transition. It excludes customer addresses, cart contents, account identifiers, prices, and signed claims. It adds no UPS request and never blocks the native rate selection or continuation.

The displayed carrier arrival includes one additional BUSINESS day. The cushion skips weekends and UPS's listed closed holidays; the documented December 31, 2026 Ground restriction is respected. Calendar arithmetic uses UTC dates and the current day in America/Chicago, avoiding phone-time-zone and daylight-saving date shifts. The dispatch basis remains explicitly conditional: If dispatched [date] from Texas. Timing may vary.

A fresh quote and recognized Texas origin are required. With transit days but no usable pickup/arrival pair, the display shows carrier transit days plus one after dispatch. Missing, expired, malformed, or unmatched data leaves the native service usable and shows that an arrival estimate is unavailable. No new date is invented from a UPS service label. Pickup and Woodson local delivery do not receive the new UPS arrival card. The old guessed-date/arrow widget yields on top-level UPS only.

Primary references: [UPS Rating API timing schema](https://raw.githubusercontent.com/UPS-API/api-documentation/main/Rating.yaml), which returns service pickup, arrival and business-day data, and [UPS's US holiday schedule](https://www.ups.com/us/en/support/shipping-support/shipping-services/holiday-shipping-schedule). UPS's carrier arrival data accounts for seasonal/holiday schedule changes; the extra day is Woodson's additional cushion.

## Validation

- All 749 Node tests pass, including 15 new selection, transfer, matching, expiry, malformed-data, business-calendar and pending-selection regressions.
- Actual-script synthetic browser checks use WebTrack's existing jQuery 3.7.1, without a new repository dependency. A suggestion is unpressed and leaves only the first section visible; Use UPS makes one reservation and reveals delivery, billing and notes. A saved confirmed UPS method opens those fields without another selection request.
- Manual-entry path: missing store error; store selection; required billing-field errors; manual entry; corrected error clearing; pickup date/time/contact/notes; one synthetic native Continue. No hidden required field or horizontal overflow.
- Nine layout scenarios at 390, 768 and 1280 pixels pass. Primary actions are at least 44px; the final shorter mobile Continue is 50px. Synthetic console errors: zero.
- UPS fixture service changes update both date and simulated native total. Pickup/local modes remove the card; expired context retains the native selector with an unavailable estimate. Exact carrier-code handling is verified independently of trademarks and label variants.
- Live source-only candidate: recommendation versus native radio fix passes; one Use UPS action confirms the native method and opens the remaining sections. Details Continue reaches the actual native UPS screen. Ground shows November 11; Second Day shows November 12; restoring Ground restores its November 11 date and the exact original native total. These were observed carrier-derived estimates for that test context, not delivery promises.
- All 18 original billing/delivery fields are unchanged. User cart rows, product links and quantities are preserved. No order, payment, authorization, verification, token creation, or saved-account/card edit was submitted.
- Final copy makes the dispatch condition shorter and explicit; final malformed-row guards fail softly. Both are covered by the final 749-test run. No additional live carrier transaction was needed for those copy/data-validation changes.

## Restore, artifacts and release

Production base: 2ec208cbcc315c02a5b4ea4e6984045325521ed6. A full 307-file archive and SHA256 manifest were saved BEFORE edits at outputs/restore-points/native-checkout-polish-2ec208c-2026-11-09/ in the task workspace.

The task outputs include native-polish-verification.json; final synthetic choice, details and UPS desktop/mobile previews; and a safe live UPS-arrival-card crop with no address or financial information. Its live crop predates the final copy-only refinement from Based on UPS dispatch to If dispatched; the date and one-day cushion logic are unchanged.

All local overrides were cleared, DevTools/debugging closed, preview server stopped, viewport reset, and agent tabs closed. The user's original Chrome cart remains open. No WebTrack admin header, environment, credential, dependency, API handler, rate/price rule, or payment-policy change is required. Production publication requires approval under AGENTS.md:47.
