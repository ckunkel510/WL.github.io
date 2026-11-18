# Verified game-camera batteries — owner-approved wiring

Owner approved the prototype November18 and requested live wiring just below **View our Shipping Policy**, with the surrounding product-page background and no themed panel. The compact control matches **WGI-SWTC2LOK/SPARK2.0 (PID246159)** and **STC-GMAX32VNG/GMAXVision (PID174184)** to **Energizer MAX AA8 (PID2853/SKU1162676)**. Other cameras are excluded until their exact battery requirements are verified. No purchase-history claim is made.

An unchecked option selects a complete eight-cell pack for each camera. The action explicitly says **Add camera + batteries** and uses the selected native camera quantity, current customer prices and verified inventory. Existing quantities and unrelated cart lines are preserved. The ordinary native Add to Cart button keeps its existing behavior.

The manufacturer's combo already includes eight AA batteries and a16GB SD card. The extra pack is prominently labeled optional spares. Exact manufacturer catalog model and Energizer AA8 packaging were verified November18,2026. The four-pack lithium option stays in the email without a price; this cart pilot uses the single complete alkaline8-pack.

## Scope and authorization

- The owner explicitly said the prototype is fine and authorized wiring known game-camera matches to the live product pages. The header loader is restricted to these two camera PIDs. No new third-party dependency, checkout, payment, account or branch-setting action is introduced. Existing cart substitutions remain paused.
- `ProductPairingNative.js` supports a recognized empty/nonempty guest cart and native signed-in cart. Guest availability is companywide with no local pickup promise. Signed-in pickup verifies the native selected branch; delivery uses verified company inventory and leaves actual route eligibility to checkout.
- Updated review fixture: workspace `outputs/camera-pairing-release/product-page-preview.html`. It exercises the actual DOMParser/native form serializer and transport against simulated native responses. No real cart/order is used by that fixture.
- Owner-specified camera promo59.99 differs from native99.99 on November18. This module shows native customer prices; it never overrides price or claims the email promo is active. Verify promo in WebTrack/BisTrack before email/SMS release.

## Safeguards

Exact PID/SKU/title/unit/pack match; fresh native prices and quantity-aware inventory; existing quantities count against stock. Unconfirmed guest store identity never becomes a local promise. Signed-in local shortages require a different native fulfillment selection or the regular product flow. Unknown/redirected/changed sessions and unrecognized carts fail closed.

Each native POST gets a freshly read product form. Complete cart is read before and after each addition; unrelated lines and pre-existing quantities are retained. Double clicks and quote reuse are blocked. Lost replies are reconciled by one read, never a blind POST retry. The two native adds are **not atomic**: if the second fails, the customer is directed to review the actual cart. No automatic removal, rollback, cart reset or overwriting of concurrent edits.

## Validation

The full repository suite passed **1089 tests**. Pairing/native-core subset passed57. Nine browser-native transport cases passed: empty guest cart, existing quantities, signed-in local pickup, local-stock gate, delivery company stock, rejected second item, lost replies, concurrent edits and exact SPARK match. Stale-quote refresh, quantity changes and preservation of unrelated lines were also checked through the UI. The compact surface, location,44px action and no overflow were verified at1280/768/375px.

Before publishing, the actual native guest controls added GMAX and MAXAA8 into an isolated initially-empty guest cart; readback showed one each and140.38 subtotal. Both test additions were deleted through their native controls and the cart was verified empty. No order was submitted and the user's Chrome cart was not used. Post-deployment paired-action verification remains required. A live authenticated test account was not available; the signed-in branch contract was verified with fixtures and existing native parser/serializer regressions.

The release also registers the newly requested GTA26SET email link. Its native unsent creative is119.99/regular149.99/while supplies last with no expiration; this does not authorize an email/SMS send or schedule. Standard confirmed `add_to_cart` instrumentation records both items only after full cart readback; no claim of actual GA4 receipt or revenue.

Sources: [OEM WGI catalog, SPARK WGI-SWTC2LOK](https://assets.unilogcorp.com/267/ITEM/DOC/Wildgame_INNOVATIONS_WLD006_Catalog.pdf), [original camera manual](https://manuals.plus/wp-content/uploads/2023/05/Wildgame-Innovations-SWITCH-SWTC2LO-Digital-Game-Scouting-Camera-User-Manual.pdf), exact native Woodson product pages and Merchant photos.
