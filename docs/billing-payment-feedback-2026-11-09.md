# Billing and payment feedback — November 9, 2026

The native checkout billing editor could close immediately after Edit was clicked because hiding that focused button emitted blur. It also retained a stale ZIP error after the customer corrected the field. The repair keeps the editor open, clears corrected errors through native validation, and records the existing pickup billing confirmation before leaving that section.

Billing now explains that card payments use the street and ZIP on the card statement; delivery can differ. Native inline errors are announced as alerts. When WebTrack exposes an explicit payment response in its existing error regions, an additional accessible message explains billing mismatch, security-code mismatch, insufficient funds, unspecified decline, or an unconfirmed payment status. Native messages and controls remain available. Unconfirmed results ask customers to check order history or contact the store before another payment. Approvals and order confirmations must not become decline messages. Processor-dependent AVS letter codes A/W/Z are not interpreted as declines.

The helper is restricted to top-level ShoppingCart.aspx. It does not read card fields, change gateway rules, compare billing against the customer's account address, submit or retry payments, or modify the secure card-entry iframe. Quick Buy retains its existing behavior.

## Verification

- All 734 Node tests pass, including 17 billing editor and payment-feedback regressions.
- Live checkout-only tests: Edit billing stays open; blank street and short ZIP give actionable errors; correcting ZIP clears the previous error; other address fields are preserved; a plausible alternate street reaches native payment selection. This last result is form acceptance, not issuer address verification.
- Secure card-entry host observed: sce.toogo.io. Opened without entering card data and canceled. No authorization, verification, token creation, payment, order, or saved-account/card edit was submitted.
- Original 18 billing/delivery address controls and fulfillment choices were privately compared and restored; user cart rows and quantities were unchanged. No real address/card/order details or financial screenshots were stored.
- Isolated actual-script response preview: AVS/CVV/funds/decline/timeout messages render and change correctly; approval-with-AVS-warning and cleared responses remove guidance. Native message and Continue control remain intact, and no action is auto-triggered.
- Synthetic responsive checks at 390, 768, and 1280 pixels: no horizontal overflow, readable guidance, 44px Continue control. Synthetic mobile and desktop preview images saved outside the source tree.
- Local browser override configuration cleared, DevTools closed, viewport reset, and live test tab closed after returning to the unchanged cart.

## Remaining verification limit

Only the live site is available. No actual issuer decline was forced. The underlying processor's AVS enforcement policy, whether the checkout billing fields reach that processor, and its exact returned error text remain unverified. AVS mismatch does not universally mean a declined transaction. Epicor/payment-provider configuration or a processor sandbox is needed to confirm rejection policy. This JavaScript repair improves available feedback; it does not enforce bank-side address matching.

## Restore and release

Production base: 3c9eee0ab319856da78b8d10fe43149a74538bda (PR138).
Full source restore archive and SHA256 manifest were saved before editing at outputs/restore-points/billing-error-paths-3c9eee0-2026-11-09/ in the task workspace.

Runtime changes require fresh approval under AGENTS.md before production publication. No WebTrack admin-header replacement, environment, credential, dependency, or payment-policy change is needed.

## Primary references

- [Epicor Secure Card Entry host](https://help.eaglesoa.com/29/en-n-eagle/Paymt_Card_Proc/Transact_Secur/Secure_Card_Entry.htm)
- [Epicor AVS codes vary by processor and card type](https://help.eaglesoa.com/25/en-w-sse/Paymt_Card_Proc/Address_Verif/Add_Verif_Resp_Codes_Sug_Act.htm)
- [Forte AVS/CVV behavior](https://developers.forte.net/avs-and-cvv-codes/) — generic example of approvals with mismatch; not identification of the checkout processor.
