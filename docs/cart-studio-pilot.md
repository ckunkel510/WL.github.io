# Woodson Ink cart

Ink is the standard natural ShoppingCart.aspx cart design for every shopper, including signed-in customers and anonymous/guest carts. The private account restriction, theme picker, preview labels, and browser theme preference are removed.

headermodern loads CartDesignPilot build `20261016-ink-cart-6` directly on the top-level cart. Cart presentation no longer waits for account/profile requests. The module independently excludes frames, other origins/routes, and native checkout/review pages, and leaves the existing cart available if its stylesheet cannot load. BuyNowPilot build `20261016-compact-checkout-27` retains the existing signed-in/guest checkout scope and account verification; it no longer owns cart design loading.

Existing cart nodes and quantity, checkout, Save for Later, Delete, and Empty Cart handlers remain the action owners. The mobile checkout bar clicks the original Proceed to checkout control. A deliberate mobile swipe reveals actions; it never changes the cart by itself. Save is offered only when the underlying Save for Later control exists. Save/Remove confirm that the current cart/control is still present and delegate once. Vertical scrolling and interactive quantity controls are excluded from swipes. The item menu provides the same actions for keyboard users, with Escape to dismiss.

Saved for Later retrieval, pricing, shipping rules, guest information entry, compact checkout, account experiments, and order submission are unchanged. No new service or dependency is introduced.

## Restore point

Pushed tag `backup/before-public-ink-cart-20261016` points to `ca6d33cecf221321d44c258977c9b3a4d5a8c96e`, immediately before public rollout. Revert the public rollout commit and publish the revert through the normal Pages workflow; do not reset or force-push main. This restores the private theme preview without undoing prior checkout work or touching customer carts/quicklists.

## Validation

- `npm test`: 362 passing tests, including anonymous independent loading, frame/checkout exclusion, asset failure fallback, gesture thresholds, and guarded single native delegation.
- Browser fixture derived from the live cart DOM: signed-in/anonymous, one/multiple/empty cart, populated/empty Saved for Later, 360/390/820/1280 widths.
- Mobile action menu, Save/Remove, quantity selection, and main/docked checkout entry retain native controls. Unavailable guest Save is hidden.
- Live post-release checks preserve the existing signed-in cart and stop before order submission.
