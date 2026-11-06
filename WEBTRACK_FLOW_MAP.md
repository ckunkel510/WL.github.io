# WebTrack customization map

Last verified November 6, 2026 against production PR135 (`b303cc1`) and the cleanup candidate. The full page/asset inventory is in [docs/customization-runtime-inventory.json](docs/customization-runtime-inventory.json); findings, verification and restore instructions are in [the cleanup report](docs/customization-cleanup-2026-11-06.md).

## How assets reach the page

WebTrack supplies three inline blocks outside this repository: device-selected CSS, merged page scripts/DOM helpers, and the modern-header bootstrap. The live baseline contents were saved before editing. `config/webtrack-customizations-inline.js` and `config/webtrack-header-loader.html` are prepared admin replacements, not evidence that WebTrack has applied them.

`headermodern.js` owns the WebTrack header, search, modern scanner, address-manager loader and shared site/chat runtimes. The Wix homepage has a separate `woodson-unified-header.js` integration; it is not a duplicate WebTrack header.

## Page families

| Pages | Active owners / boundaries |
|---|---|
| Products | Product cards, stock, filters/sidebar, quantity controls, flags and modern header/search. StoreMode/proximity and legacy location renderers remain supported but are conditional in the prepared loader. |
| Product detail | `ProductDescription.js`, `Productdescriptionstyle.js`, separate `ProductImages.js` gallery, stock/quantity tools and shared header. |
| Mobile scanning | Modern scanner in `headermodern.js`; root `BarcodeScanner.js` hands off to it and uses `legacy/BarcodeScanner.js` only when the header is unavailable. Quagga is the existing library. `InStoreBarcodeScanner.js` remains a separate in-store flow. |
| Cart / checkout | Individual scripts, not `wl-shoppingcart.bundle.js`. `ShoppingCartRow.js`, branch/summary/subtotal/error helpers, `Guestcheckout.js`, `Buy.js` compact checkout and native WebTrack controls remain active. `CartNativeViews.js` defers `Checkout2.js`/`CardContainer.js` until native details/card/final views need them. |
| Invoice payment | Root `PayByInvoice.js` routes to unchanged active `PayByInvoicePreview.js` (historical name). Explicit `wl_payment_flow=native` loads the preserved legacy body on demand. |
| Address list/detail | `AddressManagement.js`, owned by the modern header. Existing inline requests are reused during transition. Repeated copies reuse the initialized API. |
| Account / history | `Accountinfo.js`, invoices/credits/statements, `OpenQuotes.js`, `Tracking.js`, `ProductsPurchased.js` and related page-specific scripts remain active. |
| Saved lists / contacts / settings / saved payment methods | Their existing page modules remain active. No record creation/deletion, token changes or account changes were performed in the cleanup. |
| Sign-in / sign-up / reset | Existing validation/DOM callbacks retained. Prepared route matching checks the actual page filename, not the destination embedded in its return URL. |
| Help / about / dashboards / jobs | Existing page features/shared header retained. |
| Legacy location hub / seven store pages | `default.js`, `storelocations.js`, `brenham.js` remain supported; unchanged renderers are conditionally requested for their routes/opt-ins. |
| Wix homepage | Separate unified header, Turtlebox promotion and Wix module iframe; no edits in this cleanup. |

## Compatibility and unused observations

`wl-shoppingcart.bundle.js` was not requested by the observed cart. `Analytics.js`, `wl-commerce.js` and `wl-events.js` are compatibility aliases; current `wl-site.js` is distinct. An unobserved public asset is not safe to delete merely because a page sample did not request it. Dormant files do not slow a page that never downloads them.

## Release and testing boundaries

Payment, cart, checkout, account and order flows remain approval-controlled per `AGENTS.md`. Preserve native final controls and standard-checkout fallback. Use source-only overrides for real-page candidate checks, mocks only in local synthetic fixtures, and stop before orders, payments or record writes. Restore source using the saved baseline rather than resetting customer/session state.
