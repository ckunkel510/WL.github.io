# Single-result product search

The user approved opening this feature to everyone on October 16, 2026. Signed-in shoppers, anonymous visitors and guest-checkout shoppers now share the same search behavior. The client no longer reads AccountSettings or checks a username.

The existing header loads smart-search.js build 20261016-4 on top-level WebTrack pages. Header Enter/search-button actions read the native search response as inert HTML. An explicit total of one opens the same-origin ProductDetail.aspx destination directly, without loading a results document or running its quote/Quick buy scripts. Multiple matches, zero matches and lookup failures open the normal results page. These fallback cases perform one preliminary results GET before navigation. An ordinary single-result URL also redirects, using replace so Back cannot bounce through the intermediate page.

Destination checks deduplicate image/title/review links, ignore recommendation cards, require a native total of exactly one, validate product IDs and accept only same-origin product pages. Product links omit returnUrl to avoid a native Back link to the intentionally skipped search. One visible card on a later page of a broader search cannot trigger a redirect.

Query edits, blur and clicks elsewhere cancel outstanding direct lookups. Repeated Enter remains one lookup. Existing sanitized search analytics record a direct jump once; normal multi-result searches retain results-page tracking. Native search response time remains. No cart, checkout, payment or account-setting writes are introduced.

Validation: all 430 tests pass. Public search cases cover guests and other signed-in accounts, no account requests, button/Enter behavior, count and destination validation, cancellation, duplicates, failures and native return-link normalization. Local browser checks verify guest and another-account direct navigation, multiple-result fallback and Back. Live release verification is recorded in the project checkpoint and output evidence.

Rollback: revert the public-rollout PR normally. Tag backup/before-public-search-20261016 preserves the private version at 395919be54569c2b8f1b5853fccf0aa0b6402e1d. Do not reset main or alter shopper carts.
