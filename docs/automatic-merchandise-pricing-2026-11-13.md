# Automatic Christmas-light pricing — release candidate

The owner requested an automatic mixed-SKU sale in the cart and native checkout, including pickup, while preserving the three existing BisTrack promotions. The final customer flow needs no promotion code.

## Customer behavior

- Eligible selling packs combine: 1–3 boxes 25%, 4–8 boxes 40%, 9+ boxes 60%. Round the basket discount once to integer cents, then allocate its cents across eligible lines for shipping-promotion qualification.
- The cart shows merchandise, a named Christmas-light discount and the discounted subtotal before checkout. A fresh native basket is read again at native submission. Decreasing or removing quantities recalculates the tier; credits replace, rather than stack on, an old quote. Already discounted native prices receive only the additional amount needed to reach the tier, never another full percentage.
- The checkout presentation shows the same named discount, the actual positive shipping charge (or $0 pickup), native tax and native total. Original financial cells, controls and postbacks remain the native source of truth. Changing UPS service keeps the merchandise credit and changes only freight/tax/total.
- Pickup availability, store, schedule and person remain in the existing pickup flow. At final native Details submission, the native UPS radio and the selected store's physical address transport a scoped negative price adjustment through the calculator. It is not a parcel shipment. Instructions explicitly prepend STORE PICKUP / selected store / DO NOT SHIP, while preserving the pickup instructions. Returning to Details restores the original address and pickup choice.
- Sale lights use standard cart checkout. Their Quick buy button and inclusion as Quick buy extras are suppressed so the compact checkout cannot charge an undiscounted total. Existing compact drafts containing these lights must restore their cart before continuing.

## Products and lifecycle

`data/christmas-light-sale-2026.json` was verified against the live Christmas Lights category (4651) on November 13: 54 listings, 46 packaged sets/string/icicle/C6/C9/T5/net/rope lights included, 8 clips/stakes/projectors/necklaces excluded. Selling quantity counts boxes, not individual bulbs. Exact product IDs and codes are retained; an arbitrary category label or client-supplied eligibility flag cannot grant a discount. Review new category products before adding them to the manifest.

The policy starts November 13, 2026. No campaign end date was supplied: `endsAt:null` keeps it active until the owner disables `enabled` or supplies an end date. No expiry was invented from the separate MERRY100 shipping campaign. Existing BisTrack promotions and definitions are unchanged. The owner will handle back-office representation/reconciliation of the imported adjustment.

## Native adjustment protocol

`api/merchandise-pricing.js` calculates target merchandise pricing using the fresh server catalog. It validates quantities/product mappings, caps the native price basis at the trusted regular price, rejects stale/missing catalog data and ignores arbitrary request prices/discount amounts. Employee views are excluded in the browser and evaluator.

`api/cart-pricing.js` previews the basket or reserves a 15-minute receipt. Receipts live in a separate Redis keyspace with a random 120-bit address marker. They bind the exact address hash, public trading branch and current catalog basket weight. No merchandise credit enters ordinary ZIP/weight fulfillment fallbacks. The authenticated native XML/SOAP bridge imports the server-held receipt after proxy authentication; expired/missing/mismatched receipts fail rather than returning an undiscounted rate. All offered speeds receive the single merchandise delta; pickup starts at $0. Current MERRY100 qualification is calculated on the adjusted merchandise lines.

Original address fields are kept in browser session storage for Back navigation, then restored. The price marker uses address line 3, which must be free. A genuine three-line shipping address requires a different native metadata carrier before this bridge can support it. Names, telephone numbers, email, billing details and payment data are not sent to the pricing endpoint. No production credentials, environment variables or dependencies change.

The native carrier request carries addresses and weight, not SKU-level basket data. This patch verifies a fresh native basket in the browser and verifies the receipt/address/origin/weight at the authenticated server bridge. It does not provide server-side attestation that an adversarial client has submitted the real native SKUs or customer profile; that stronger guarantee requires an Epicor basket/order API or signed server callback. Do not represent CORS or the browser's employee flag as server authentication.

## Reuse for special orders

`priceCart(..., {trustedSpecialPrices})` supports an approved target unit price and quantity per native line, with a quote ID and expiry. It calculates either a surcharge or reduction, excludes that line from Christmas tier stacking and produces the same adjustment ledger for the cart and native total. Unit prices are accepted only from the server's `resolveSpecialPrices` extension point. The public endpoint does not accept browser-supplied adjustments, special-order unit prices or an arbitrary discount.

No special-order price issuer is enabled in this release. A future issuer must authenticate the customer/quote, verify product/configuration, quantity, expiry and tax treatment on the server, then resolve approved quote IDs into `trustedSpecialPrices`. The rate bridge changes taxable freight; a future item with a different tax treatment needs a native line-price integration or verified tax-specific adapter before activation. No special-order catalog items, prices, terms or BisTrack rules were changed now.

## Validation and release

- All 922 automated tests pass (25 new pricing tests), including tier boundaries, mixed items/accessory exclusion, existing-discount reconciliation, integer-cent allocation, employee exclusion, approved special-order increases/decreases, scoped expiry and actual authenticated native XML import for pickup/UPS/local delivery.
- Browser fixture uses the production CartPricing module, real pricing service and synthetic cart/carrier inputs. Cart changes 3→8→9→4 boxes correctly show 25→40→60→40%; every amount reconciles. Cart/pickup layouts fit 390/768/1280 with no horizontal overflow. Four-box pickup: merchandise79.96, savings31.98, pickup0, tax3.96, total51.94. UPS Ground: shipping9.95, tax4.78, total62.71. Second Day Air: shipping35.83, tax6.91, total90.72. A deliberately stale total blocks Continue.
- The prior isolated live WebTrack rate test already proved a returned −22.03 produces native tax4.78 and total62.71. The automatic candidate and its pickup radio/address handoff have not been published or verified against live WebTrack. No payment/order/card data submitted.

Before release, review the patch and obtain the required checkout-release approval. Then publish through the existing GitHub/Vercel workflow, verify exact deployed commit, and test the existing guest basket for cart display, 1/3/4/8/9 boundaries, mixed items, pickup and UPS, Back, shipping speed, and the empty hosted-payment amount without payment or order submission. Revert the release if native controls, weight precision, pickup metadata or payment amount do not reconcile. Do not declare the sale live until these checks pass.

Live PR167 checks confirmed real cart tiers3/8/9/4 and nativepickup51.94 with a separate savings line. The empty hosted-card form opened and was canceled with no data entered; it displays no amount. A slow cart response on re-entry exposed a startup revision race, so PR168 restored the previous release. The correction gives unchanged-cart callbacks no new revision and preserves the saved verified quote. Regression tests cover delayed same-cart responses, changed-cart supersession and old-error retries. Runtime pricing asset version2 is used for the corrected release.

A live pickup-to-UPS re-entry showed two native WLQ markers after WebForms restored the old address draft. The guard blocked Continue and PR170 reverted the release while fixing this. New receipts now remove old technical markers server-side; browser Back snapshots also strip them while preserving real address fields. Assetversion3 has a DOM build marker for exact live verification. Two additional regressions cover real address line2 plus old marker and genuine line3 preservation. User requested remaining live checks in Chrome; a fresh anonymous Chrome tab was opened without signing out another account.

Clean Chrome guest validation uncovered a second native Continue validation pass treating the UPS pricing transport as delivery. Logical pickup now remains true while a valid pickup receipt uses that transport; all pickup date/instruction UI checks use logical pickup. Billing helpers cannot overwrite the reserved store address during this pass, and STORE PICKUP / DO NOT SHIP instructions survive reconstruction. Three additional regressions cover transport semantics, instruction preservation and address immutability. Checkout and pricing assetversion4 identify this correction.
