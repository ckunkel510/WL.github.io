# Light ProductDetail preview

Build: `20261016-pdp-light-2`. Audience: freshly verified native login `ckunkel2` only.

The header loads `ProductDetailPilot.js` on signed-in, top-level WebTrack ProductDetail pages. The module reads native AccountSettings without caching and requires matching signed-in account headings before loading scoped CSS or rearranging the page. Other accounts, guests, identity failures, stylesheet failures and frames retain the existing layout. Focus and bfcache restoration recheck identity; failed checks restore original nodes, text and attributes.

The light product canvas pairs a contained gallery with a wider purchase panel. Price, fulfillment cards, quantity, Add to Cart, Quick buy, Quicklist and store inventory remain existing controls. Fulfillment detail text is expandable. Share sits beside the title; the existing quote link sits below the purchase panel with quieter copy. Existing review data supplies top-of-page stars only when actual review entries are loaded. Description/review styling is refreshed; recommendation shelves are unchanged.

No cart, checkout, pricing, stock, branch-selection, quote-submission or order logic changes. The existing native inventory link is made visible. Thumbnail buttons gain keyboard access and a selected state while invoking the existing image click handler.

Validation: 436 Node tests passed, including identity rejection/failure and review-presence cases. Browser tests used sanitized rendered WebTrack markup at 360, 390, 820 and 1280 widths: no horizontal page overflow, no image escaping its frame, aligned quantity/Add controls, options preserved, review navigation, one existing action activation per click, guest/other-account exclusion, and full restoration on account change. Restricted-purchase fixture retains no Add/Quick buy controls. Live cart/list/order mutations are unnecessary for this presentation change.

Rollback: revert the preview release through the normal main-branch deployment. Removing only the header loader stops new preview loads; reverting the module/CSS as well restores the pre-preview source. Do not change shopper cart or quicklist data. Public rollout requires new user approval.

Desktop scrolling follow-up: the original colorful Quick buy treatment is retained. Description and reviews reserve the left column while a physical right column bounds the sticky panel above the full-width related-product shelves. Resize and expansion checks disable sticky when the whole panel cannot fit below the toolbar, keeping its lower controls reachable. Tablet and phone retain the stacked layout.
