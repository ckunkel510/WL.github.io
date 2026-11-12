# Shopping accessibility, audit items 1–7

Status: implemented and tested candidate; not published. Baseline: main `d5fe827` (PR151). Runtime build: `20261112-accessibility-1`.

## Result

- Product quantity, Add, Quick buy, save, remove and substitute controls have product context in their accessible names. Visible action wording stays in the name.
- Recommendation rails retain list semantics with a list-item wrapper around each native anchor. Destinations, existing click/analytics handlers, image fallbacks and responsive card sizes are retained. The enhancer also repairs cached older recommendation renderers by moving, never cloning, their anchors.
- Restrictive viewport scaling options are removed; existing width, initial scale and safe-area settings remain.
- Missing document language, main landmark and skip navigation are supplied. Search/department pages get a screen-reader heading. Existing cart/sign-in H2s can receive level-one semantics without replacing their DOM or CSS. A late native checkout H1 removes the enhancer's temporary promotion.
- Sort and grid/list controls and unnamed department links get names. The native PO/reference field gets a programmatic label.
- Only the known same-origin stock iframe is enhanced as a named modal: initial focus, iframe/document name, keyboard wrapping, Escape through the existing Close button, background inertness while open, and opener-focus restoration. Existing table headers and native stock/sort/map links are preserved. Higher native dialogs suspend the trap. Cross-origin frames and embedded Quick Buy checkout are excluded.
- Checkout uses its existing invalid markers and messages. The enhancer adds `aria-invalid`, preserves existing `aria-describedby` tokens, associates visible errors, and focuses a field/error summary after a deliberate failed Next/Continue. It waits while native Continue is waiting/posting, and does not validate on page load. The linked summary follows the native progress guide. Error cleanup removes only enhancer-owned flags and description tokens.

## Runtime boundaries

`Accessibility.js` is an independent optional runtime loaded once by `headermodern.js` on top-level WebTrack Products, ProductDetail, ShoppingCart, SignIn and Default pages. It is independent of analytics/marketing consent and never awaited by commerce code. DOM readiness, scoped/coalesced mutations, ASP.NET `endRequest` and bfcache return are supported. Repeated loads reuse the existing runtime.

The enhancement does not read/write storage, send API requests, log customer data, change field values/names, change selected quantities/options, replace native validators, intercept checkout clicks, submit forms, or replace postback/payment/order functions. It adds no dependencies. Native controls remain responsible for all business decisions and writes. Its only triggered native business-independent click is the inventory popup's existing Close button on Escape.

No robots, product prices/data/schema, account, payment, backend, configuration secrets or deployment settings are changed. The old `wl-shoppingcart.bundle.js` is not used by these changes.

## Verification

- All **852 Node tests passed** (847 existing plus 5 new). Existing dependency installation reused locally through `NODE_PATH`; package manifests and dependencies are unchanged. Syntax and `git diff --check` passed.
- **22 browser DOM/flow fixture checks passed**, including exactly-once native handlers, current field values/destinations, duplicate initialization, native partial replacement and endRequest, bfcache Back, no validation/focus on load, existing error/token cleanup, delayed Continue, late native heading, named stock dialog, Tab/Shift+Tab/Escape, late iframe load after Close, cross-origin exclusion and teardown. Browser fixture uses fictional data and deterministic native-handler stand-ins, not a real ERP/order service. No uncaught fixture errors.
- Real WebTrack candidate checks used source replacements for the three changed runtime assets, with no transport/data mocks. Product: named quantity/Add, native Add href preserved, language/main/zoom, 32 native recommendation links. Search: nine distinct quantity names, native Price Low-to-High postback, named sort/grid/list, eight recommendation links. Cart: both line quantities/actions named and native checkout retained.
- Actual inventory: heading received focus; Shift+Tab wrapped to native last Close; Escape closed through the existing control; focus returned to Store inventory; all background inert attributes were removed; four column headers preserved.
- User explicitly authorized live accessibility testing in the existing session. Actual native checkout reached pickup details with the enhancement active; failed Continue focused the empty pickup date with `aria-invalid=true` and an error description; the native Continue control remained present. The live proof was captured before the final heading/summary-position refinements; those final presentation refinements passed the 22 browser checks. No contact/address/date/payment values were manually entered or edited, no customer/account records were edited, and no actual order was submitted. Native pickup/delivery selection state was exercised as described below.
- Native delivery selection showed required delivery date/time and hid pickup timing. That native postback reloaded the baseline source after local overrides had been disabled; this is an owner-flow check, not evidence of the enhancer on that newly loaded delivery page.
- Back to cart returned exact product-link/quantity equality for both original lines. No add/remove/save/quantity cart mutation was performed in live testing. No claim is made about the entire session being unchanged: pickup/delivery choices were exercised as authorized.
- Final product candidate at 1280/768/390px: document width matched viewport, all 32 recommendation anchors retained link semantics, wrapper/link widths matched (297/351/285px), mobile card minimum height stayed 325px. The latest candidate was verified on the product page after the final refinements.
- Chrome's source-override instrumentation temporarily left a native view request pending. Overrides were disabled and developer tools closed without resubmitting; native details completed with the enhancement present. This diagnostic interruption was not counted as a successful request until the native page was observed.

These checks do not constitute a full VoiceOver/NVDA, speech-control or WCAG conformance assessment, and do not test payment completion or a real order.

## Reproduction

Run `npm test` with the existing dependencies installed. Serve the repo locally and map `/Catalog/ShowStock.aspx` to `test/fixtures/accessibility-stock.html`, then visit `test/fixtures/accessibility.html` for the 22 browser tests. Only local fixture markup uses fake origin/window facades; production boot is exact-origin/page scoped. No production test switch or mocked production API is included.

## Release and rollback

Review/merge the candidate only for the authorized release. GitHub main publishes the static assets and triggers the existing deployment workflow. No WebTrack admin changes are required: the existing header asset loads the new Accessibility.js. Verify the new script's response/MIME and the canonical/current-version header and recommendation assets before published smoke tests. Existing open pages need a safe reload; their cart contents should not be reset.

Rollback by reverting this change and republishing these four runtime assets. Remove the added header load and return recommendation markup/CSS to the baseline together. Reload affected pages; do not clear customer storage or reset carts, account records or checkout state. Accessibility.js alone can also be used as an injected IIFE, but the source-renderer changes in this candidate prevent the bad recommendation role at creation time.

Testing cleanup: local overrides were cleared from Chrome, developer tools closed, normal viewport restored, unused empty snippet removed. Only agent-owned test tabs were used/closed; the original user cart tab was retained. No live code was published.

## Live publication verification follow-up

PR152 was published as bafca87261e6ab095bd291492654e79f1bbba115. Live verification found two naming mismatches: WebTrack department cards repeat `id="ProductGroupCardContainer"` rather than the fixture class, and ProductDetailPilot resets the quantity stepper names after the accessibility runtime runs. The follow-up accepts the actual repeated-ID markup and makes ProductDetailPilot own the same contextual names. Header versions advance both assets. No commerce handlers, fields, requests or validation rules change. The department fixture now exercises two cards with the actual duplicated-ID structure. All852 Node tests and22 browser fixture checks pass.
