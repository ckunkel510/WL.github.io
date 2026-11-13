# Cart suggestions paused

The owner requested that cart substitute suggestions be hidden while the customer experience is reconsidered. Production no longer loads the optional picker from `ShoppingCartRow.js`. The module also returns before reading the page or requesting stock/suggestions, covering older cart loaders that still request it.

The picker source, photos, reviewed families, matching rules, API, anonymous choice history, tests and review tooling are preserved. No data is deleted. Explicit local preview mode remains available for design review. Future reactivation requires reviewing and enabling both `cartSubstitutionsEnabled` in `ShoppingCartRow.js` and `ENABLED` in `CartSubstitutions.js`.

The native cart and Proceed control, pickup estimates, delivery options, checkout validation, payment and order handlers are unchanged. Customers retain the ordinary checkout path. This release implements the owner's explicit request to hide the feature; it does not automatically replace any products.
