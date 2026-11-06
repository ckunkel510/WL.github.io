# Customization cleanup — November 6, 2026

Status: implemented and tested candidate; not published. The WebTrack admin replacement is prepared, not applied. Baseline is published commit `b303cc1bb2ea7e44ad55152ee3f1e574f7893ec2` (PR135).

The customer sees the same page layouts while each page avoids unrelated downloads, duplicate initialization and inactive legacy parsing. Scanner consolidation was explicitly approved by the user. Orders, payments and account records were not submitted or changed during this audit.

## Coverage and decisions

Read-only live review covered 23 page states: products, product detail, cart, account, invoices, credits, statements, saved lists, open orders, quotes, purchased products, addresses, contacts, settings, saved payment methods, invoice payment, job balances, dashboards, help, about, legacy location hub, legacy store page and Wix homepage. Thirteen anonymous reads also checked sign-in, sign-up, reset, terms/privacy and session-gated detail templates. This is page assembly/dependency coverage, not a claim that every transaction or protected record action was executed.

`customization-runtime-inventory.json` records 58 observed hosted assets and the per-page loader manifests. Files absent from those observations are review candidates, not automatically obsolete: some are mobile-only, lazy dependencies, public compatibility URLs or used outside the sampled pages.

| Area | Finding | Candidate change |
|---|---|---|
| Invoice payment | 14 legacy IIFEs return immediately on the modern path, but the browser still receives/parses their source. | Move their exact 267,743-byte body into `legacy/PayByInvoice.js`. Keep the small root router and unchanged active `PayByInvoicePreview.js`. The explicit `wl_payment_flow=native` escape hatch loads legacy on demand. |
| Address list | The global inline loader and header can request the same manager simultaneously. | Reuse an existing pending request with one bounded recovery; reuse an already initialized manager API. Prepared admin loader leaves ownership to the header. |
| Barcode scanner | Old and modern scanners share container/button IDs, allowing duplicate controls/camera handlers. | Prefer the existing modern header scanner. Wait at most eight seconds for it, then retain the original scanner as fallback, with a final existing-container guard. Both owners reuse a pending Quagga request. Failed/stalled modern library requests become retryable after a bounded error. |
| Mobile product browsing | Old inline bootstrap eagerly fetches Quagga before the customer taps scan. | Prepared admin loader requests only the scanner handoff. The modern scanner requests the existing Quagga 0.12.1 library when opened; the emergency legacy fallback still needs it during initialization. No new dependency or host. |
| Sign-in return URLs | Full-URL substring matching treats `SignIn.aspx?Redirect=AccountInfo_R.aspx` as an account page. | Match the actual pathname filename, preventing account/cart/payment/product modules on unrelated return URLs. Existing inline DOM rendering callbacks remain byte-for-byte identical. |
| Ordinary product pages | `default.js`, `storelocations.js` and `brenham.js` download, then return without rendering. | Prepared loader requests them only for their existing StoreMode/proximity flags or legacy store routes. Preserve all seven store routes and mixed `pg`/`pl1` cases. |
| Initial basket | Native checkout decorators are requested before any native detail/card/final view needs them. | Prepared loader uses already published `CartNativeViews.js` to load `Checkout2.js` and `CardContainer.js` when needed. Compact and native fallback behavior are retained. |

These are raw source-byte reductions, not measured network-transfer sizes or page-load timings:

- Default invoice-payment entry: 269,410 → 2,487 bytes; 266,923 bytes avoided. The active modern payment module is unchanged.
- Ordinary Products pages: 59,103 bytes of no-op store modules avoided after admin activation.
- Initial cart basket: 256,975 fewer initial source bytes after admin activation, accounting for the small native-view loader. Required native views still load their decorators later.
- Address deduplication avoids a potential second 36,967-byte evaluation; the race depends on cache/load order.
- Modern mobile browsing avoids the eager camera-library request after admin activation. Camera-library wire size and timing were not measured.

Do not add these figures into one site-wide saving: they apply to different page states.

## Code retained intentionally

- `wl-shoppingcart.bundle.js` is not loaded by the observed cart. Deleting a dormant public file does not speed that cart and could break external references.
- `Analytics.js`, `wl-commerce.js` and `wl-events.js` are compatibility aliases; the current `wl-site.js` is distinct. Keep the public URLs and attribution behavior.
- `ProductImages.js` still owns a gallery separate from product description/style modules.
- `default.js`, `storelocations.js`, `brenham.js` and `InStoreBarcodeScanner.js` still serve opt-in in-store and legacy location flows. Scanner cleanup never clears another scanner's Quagga detection handler.
- Wix uses `woodson-unified-header.js`, Turtlebox promotion and its own module iframe. These are separate from WebTrack's header. No homepage source, layout, merchandising or analytics was edited.
- Checkout, guest/manual-entry validation, UPS rates, totals, native submission controls and standard-checkout recovery remain as released in PR135.

## Verification

- Full Node suite: 681 tests pass. Installed `zipcodes` 8.0.0 and `fast-xml-parser` 5.9.3 were resolved from the existing local checkout using `NODE_PATH`; both match this repository lockfile. No dependency or lockfile change.
- Six synthetic cash/charge payment comparisons at 390, 768 and 1280 pixels: before/after screenshots are byte-identical, with no horizontal overflow. Hidden browser-extension nodes differed in two raw DOM snapshots; screenshots and visible layout were identical.
- Native WebTrack source-only candidate checks: modern payment ready, one native payment control, ten layout/style boxes unchanged; address manager one script with the existing-request marker, six layout/style boxes unchanged, search and clear working. No live payment/account changes were submitted.
- Loader tests preserve unchanged feature-module order, exact inline DOM callback source, store-mode opt-ins, seven legacy store routes, native-view stage deferral and sign-in isolation.
- Scanner tests cover either startup order, late header during library download, fallback on error/timeout, duplicate bootstrap, library-request reuse, failed/stalled requests, page departure, camera denial, close during loading, reopen, three matching detections and removal of only the modern handler. Quagga/camera are mocked; real iPhone camera scanning remains a manual device check.
- No measured performance timing is claimed. Network inspection did not supply useful cold-load timing, so conclusions rely on source/dependency analysis and browser rendering evidence.

Local evidence and immutable restore archive are outside the public repository under `outputs/`. They contain source/layout/script manifests, not customer page HTML, financial screenshots, payment fields, cookies or viewstate.

## Deployment and admin activation

The repository's approval-controlled release gate applies to payment/cart/account runtime changes. Obtain approval for this tested candidate before merging/publishing. This implementation does not approve or include optional PR133, new address-validation services, environment changes or new third-party dependencies.

After the hosted cleanup is approved, published and verified:

1. In WebTrack's custom header, replace the JavaScript contents of the large merged customization block with `config/webtrack-customizations-inline.js`, keeping its surrounding script tags. Do not add a second copy. This is the block beginning with the merged DOM helpers and ending with the page-specific script loads; compare with `test/fixtures/customization-loader-before.txt` if needed.
2. Replace only the small `wl-header-locations-test` block with `config/webtrack-header-loader.html`. Leave the separate device-CSS block unchanged.
3. Do not manually disable broad groups of files: the prepared route plan keeps active features, and on-demand fallbacks still need their source URLs.
4. Verify desktop/mobile products, detail, sign-in return URLs, address list/detail, basket, compact checkout and native fallback. Stop before ordering, paying or saving account changes. On a phone, test scan/close/reopen, permission denial and a real barcode with permission given by the user.

Hosted scanner/payment/address improvements work with the old inline loader too. The product/cart route savings and removal of eager Quagga depend on the admin replacement; publishing this repository alone cannot edit WebTrack's inline header.

## Restoration

Before any page runtime edit, an immutable archive of all 290 baseline tracked files was saved, with per-file SHA-256, the three original inline blocks and 23 page script manifests. The local restore folder is `outputs/restore-points/customization-cleanup-b303cc1/`; its `RESTORE.md` maps each page to its affected files.

To roll back, restore the affected source from baseline commit `b303cc1` and publish through the normal release process. Restore the original large inline block and small header block if admin activation occurred; keep the device CSS block. Restore code only: never replay orders or reset live cart/customer state. New unreferenced legacy assets can remain after the old root entry points are restored.
