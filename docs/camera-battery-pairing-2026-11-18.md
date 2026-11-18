# Optional camera + spare batteries — staged review

Owner requested an Amazon-style paired purchase on the WGI camera. This first pilot offers **one WGI-SWTC2LOK camera (PID246159)** and **one Energizer MAX AA8 pack (PID2853 / SKU1162676)** only after the shopper explicitly selects the extra pack and clicks **Add both to cart**. The regular native Add to Cart control is untouched. No purchase-history claim is made.

The manufacturer's combo already includes eight AA batteries and a16GB SD card. The extra pack is prominently labeled optional spares. Exact manufacturer catalog model and Energizer AA8 packaging were verified November18,2026. The four-pack lithium option stays in the email without a price; this cart pilot uses the single complete alkaline8-pack.

## State

- `ProductPairing.js` and `ProductPairing.css` are staged source only. `enabled=false`; no header loader, no auto-boot, no live cart calls. The existing cart-substitution feature remains paused.
- Review demo: workspace `outputs/product-pairing/index.html`, using an isolated simulated cart and the actual component. Demo makes no native/cart POSTs and cannot place an order.
- Native adapter reuses the existing tested WebTrack native form serialization and current customer cart/product/store reads. Its initial scope is signed-in shoppers; guest support is unverified and remains held. No checkout, payment, branch, account or order changes.
- Owner-specified camera promo59.99 differs from native99.99 on November18. This module shows native customer prices; it never overrides price or claims the email promo is active. Verify promo in WebTrack/BisTrack before email/SMS release.

## Safeguards

Exact PID/SKU/title/unit/pack match; fresh native prices and selected-store stock; existing pair quantities included against inventory. No assumption that another branch's stock is local, and no transfer or shipping promise. If both items cannot be confirmed locally, use the regular product pages for fulfillment options.

Each native POST gets a freshly read product form. Complete cart is read before and after each addition; unrelated lines and pre-existing quantities are retained. Double clicks and quote reuse are blocked. Lost replies are reconciled by one read, never a blind POST retry. The two native adds are **not atomic**: if the second fails, the customer is directed to review the actual cart. No automatic removal, rollback, cart reset or overwriting of concurrent edits.

## Validation and release gate

`node --test test/product-pairing.test.js` covers15 meaningful cases: explicit selection, current prices, exact compatibility, out-of-stock/unknown store, existing quantities, drift/expiration, double clicks, lost replies, partial failures and concurrent edits. Native serialization regression tests remain applicable. Browser review must cover desktop/tablet/mobile, unselected/selected/success/unavailable and partial failure states.

Before release: owner reviews this concrete pilot; verify it in a designated test account without submitting an order; test native additive behavior and selected-store resolution; approve its page mount and cache loader; then separately enable it. Repository AGENTS requires explicit approval before release of Add-to-Cart changes and new customer features. No release requested or assumed by staging this branch.

Sources: [OEM WGI catalog, SPARK WGI-SWTC2LOK](https://assets.unilogcorp.com/267/ITEM/DOC/Wildgame_INNOVATIONS_WLD006_Catalog.pdf), [original camera manual](https://manuals.plus/wp-content/uploads/2023/05/Wildgame-Innovations-SWITCH-SWTC2LO-Digital-Game-Scouting-Camera-User-Manual.pdf), exact native Woodson product pages and Merchant photos.
