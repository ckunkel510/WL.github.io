# WebTrack Customization Map

This is a working map for the live WebTrack customization layer. It should be updated as scripts are confirmed live or retired.

## High-Sensitivity Runtime Areas

These files affect customer ordering, payment, account, or order-history flows and should be treated as approval-controlled for release:

- `ShoppingCart2.0.js` - custom cart UI, signed-in checkout start, cart state reset helpers.
- `ShoppingCartRow.js` - cart row layout and proceed-to-checkout presentation.
- `ShoppingCartBranch.js` - cart branch/stock logic.
- `ShoppingCartSummary.js` - final checkout/order summary presentation and complete-order proxy buttons.
- `ShoppingCartSubtotal.js` - checkout submit cleanup behavior.
- `ShoppingCartError.js` and `CartError.js` - cart recovery/error handling.
- `WoodsonShoppingCart.js` - cart shipping/freight messaging.
- `Guestcheckout.js` - guest checkout capture, account creation handoff, and checkout autofill.
- `Checkout2.js` - checkout wizard, validation, pickup/delivery logic, billing/delivery persistence.
- `PayByInvoice.js` and `Paymentlink.js` - invoice/payment-related flows.
- `wl-shoppingcart.bundle.js` - bundled cart/checkout/payment/account behavior; appears to be the active orchestrator for `ShoppingCart.aspx`.
- `Accountinfo.js`, `CustomerTokens.js`, `invoices.js`, `credits.js`, `statements.js`, `OpenQuotes.js`, `Tracking.js`, `ProductsPurchased.js` - account/order/payment-adjacent workflows.

## Lower-Risk Layout and Browsing Areas

These are usually better starting points for visual and responsive improvements, while still verifying on real WebTrack pages:

- `mobilepcstyling.js`
- `headermodern.js`
- `ProductDescription.js`
- `Productdescriptionstyle.js`
- `ProductImages.js`
- `ProductPageStock.js`
- `product-sidebar.js`
- `productcardBulkprice.js`
- `ProductCardFlags.js`
- `QuantityButton.js`
- `filterpanel.js`
- `localStockRow.js`
- `styles/global/*`
- `styles/productdetail/*`
- `styles/products/*`

## Current Improvement Priority

The primary improvement area is shopping cart and checkout flow. Because those pages directly affect customer ordering, changes should be small and tested against live WebTrack using a test account when authenticated state is needed.

## Confirmed Live Script Loading

Observed on `ShoppingCart.aspx` on June 26, 2026: the page loads the individual GitHub Pages scripts (`ShoppingCartRow.js`, `Checkout2.js`, `Guestcheckout.js`, `ShoppingCartBranch.js`, `ShoppingCartSummary.js`, etc.) rather than `wl-shoppingcart.bundle.js`.

## Open Questions

- Which runtime scripts are still injected by WebTrack today?
- Are any individual cart/checkout source files loaded separately in addition to `wl-shoppingcart.bundle.js`?
- Which cart/checkout issues are highest priority from recent customer or staff feedback?
- Is there a safe staging/test checkout path, or should all browser testing stop before final order submission?
