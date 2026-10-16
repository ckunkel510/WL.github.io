# Private cart design pilot

The natural ShoppingCart.aspx cart has three switchable designs for **ckunkel2 only**: Canvas (warm), Slate (cool), and Ink (navy). Original restores the prior layout without changing cart contents. The theme preference is browser-local.

BuyNowPilot build `20261016-compact-checkout-23` loads CartDesignPilot build `20261016-cart-studio-1` only after its native account check identifies ckunkel2. The design module independently verifies the account from a fresh, uncached AccountSettings.aspx response before loading CSS or adding UI. Guests, other accounts, frames, and checkout/review pages do not get the private design. This is a presentation pilot, not an authorization boundary for orders or account data.

The design keeps the existing cart nodes and native quantity, checkout, Save for Later, Delete, and Empty Cart handlers. The mobile checkout bar clicks the existing Proceed to checkout control. A mobile swipe reveals Save and Remove; it never mutates the cart by itself. Those two actions reverify ckunkel2 and delegate once to the existing native control. Vertical scrolling and interactive quantity controls are excluded from the swipe gesture. Keyboard users can open the same actions with the item menu and dismiss with Escape.

Saved for Later retrieval, pricing, shipping rules, compact checkout, and order submission are unchanged. Its existing empty-cart data retrieval limitations remain. No new service or package dependency is introduced.

## Restore point

Pushed tag `backup/before-cart-studio-20261016` points to `dad55d06143555f5a0abb0ad4447b9376c92b9d9`, the public build immediately before this pilot. For an immediate local visual comparison, choose Original. For a full release rollback, revert the private-cart pilot commit and publish the revert through the normal Pages workflow; do not reset or force-push main. Keep the already-public compact checkout changes from earlier releases.

## Validation

- `npm test`: 362 passing tests, including strict account checks, guest/frame/checkout exclusion, gesture thresholds, and guarded single delegation.
- Browser fixture built from the live cart DOM: one/multiple/empty cart, populated/empty Saved for Later, 360/390/820/1280 widths, three themes and Original.
- Simulated Save/Remove and mobile Checkout each call the existing control once. Swiping alone makes zero changes; quantity selection remains usable.
- Live verification must preserve the existing cart and stop before order submission.
