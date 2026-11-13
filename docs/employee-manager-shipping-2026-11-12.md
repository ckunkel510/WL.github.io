# Employee-manager shipping branch lookup

An employee-manager checkout could show “Rate unavailable” before contacting UPS. Its Account Settings page contains password controls but no customer branch dropdown; the shipping script treated that missing control as missing checkout context.

When both the checkout and freshly read Account Settings page identify a staff session, the script reads the trading branch printed in a fresh native cart response. Every product row must identify the same known Woodson store; absent, mixed, or ambiguous data stays blocked. This read uses an authenticated GET and never changes the cart. The fulfillment selector can differ from the carrier branch, so it is never used as the staff carrier fallback. An existing account branch remains authoritative, and customer and guest pages cannot activate the fallback.

The initial PR154 fallback used the native fulfillment selector. Live log comparison caught Groesbeck fulfillment versus Caldwell carrier origin; a prior valid Caldwell quote had masked that difference in the first handoff. The follow-up replaces that fallback with fresh server-rendered trading-branch data while retaining all native rate/claim checks.

Only `UpsShippingOffer.js` changes behavior. `WoodsonShoppingCart.js` and `UpsShippingPromo.js` point to its new version. Native checkout, guest signup, cart mutation, payment, order submission, rating APIs, claim matching, minimum charges, and dependencies are unchanged.

Validation: all 859 Node tests pass, including seven new regression tests covering the exact five-line cart, all store mappings, branch changes, stale responses, role checks, unchanged account-branch priority, and invalid/missing branches. Browser and published-native verification are recorded in the task's release report.

Release is explicitly authorized by the owner for this employee-manager fix after customer/guest regression checks. Roll back the five files in this change together to restore the previous shipping script and loader versions.
