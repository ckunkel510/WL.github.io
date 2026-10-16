# Light ProductDetail experience

Build: `20261016-pdp-light-3`. Audience: all shoppers, approved for public release.

The header loads `ProductDetailPilot.js` on all top-level WebTrack ProductDetail pages, including signed-in, guest and anonymous visits. The presentation makes no identity, account or storage requests. Existing native price visibility, purchase eligibility and authenticated controls retain their access rules. Stylesheet failures and frames retain the existing layout. Bfcache restoration and resize remeasure the presentation without account checks.

The light product canvas pairs a contained gallery with a wider purchase panel. Price, fulfillment cards, quantity, Add to Cart, Quick buy, Quicklist and store inventory remain existing controls. Fulfillment detail text is expandable. Share sits beside the title; the existing quote link sits below the purchase panel with quieter copy. Existing review data supplies top-of-page stars only when actual review entries are loaded. Description/review styling is refreshed; recommendation shelves are unchanged.

No cart, checkout, pricing, stock, branch-selection, quote-submission or order logic changes. The existing native inventory link is made visible. Thumbnail buttons gain keyboard access and a selected state while invoking the existing image click handler.

Validation: 438 Node tests passed. Public-audience, stylesheet-failure, page/frame, sticky-fit and review-presence tests are included. Browser tests used sanitized rendered WebTrack markup at 360, 390, 820 and 1280 widths: no horizontal page overflow, no image escaping its frame, aligned quantity/Add controls, options preserved, review navigation, one existing action activation per click, public guest/other-account presentation, and original-node restoration. Restricted-purchase fixture retains no Add/Quick buy controls. Live cart/list/order mutations are unnecessary for this presentation change.

Rollback: revert the preview release through the normal main-branch deployment. Removing only the header loader stops new preview loads; reverting the module/CSS as well restores the pre-preview source. Do not change shopper cart or quicklist data. The user explicitly approved the public rollout on October 16, 2026.

Desktop scrolling follow-up: the original colorful Quick buy treatment is retained. Description and reviews reserve the left column while a physical right column bounds the sticky panel above the full-width related-product shelves. Resize and expansion checks disable sticky when the whole panel cannot fit below the toolbar, keeping its lower controls reachable. Tablet and phone retain the stacked layout.
