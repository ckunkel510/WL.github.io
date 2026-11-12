# Employee-manager shipping branch lookup

An employee-manager checkout could show “Rate unavailable” before contacting UPS. Its Account Settings page contains password controls but no customer branch dropdown; the shipping script treated that missing control as missing checkout context.

When both the checkout and freshly read Account Settings page identify a staff session, the script now uses the explicit native checkout branch as a fallback. The name and ZIP must match a known Woodson store. The branch is read again for every quote, so a changed branch cannot reuse the earlier origin. An existing account branch remains authoritative. Customer and guest pages cannot activate the fallback, and missing or unrecognized native branches remain blocked.

Only `UpsShippingOffer.js` changes behavior. `WoodsonShoppingCart.js` and `UpsShippingPromo.js` point to its new version. Native checkout, guest signup, cart mutation, payment, order submission, rating APIs, claim matching, minimum charges, and dependencies are unchanged.

Validation: all 859 Node tests pass, including seven new regression tests covering the exact five-line cart, all store mappings, branch changes, stale responses, role checks, unchanged account-branch priority, and invalid/missing branches. Browser and published-native verification are recorded in the task's release report.

Release is explicitly authorized by the owner for this employee-manager fix after customer/guest regression checks. Roll back the five files in this change together to restore the previous shipping script and loader versions.
