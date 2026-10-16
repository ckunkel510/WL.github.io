# Single-result search trial

Only the server-confirmed `ckunkel2` login automatically opens a product when WebTrack reports exactly one native search result. Product-code, UPC and descriptive searches follow the same rule. Multiple results and zero results retain the normal search page and existing search suggestions.

The client requires an explicit native result total, deduplicates image/title/review links by product ID, excludes recommendation cards, and accepts only the same-origin ProductDetail.aspx destination. One card on a later page of a larger search cannot trigger navigation. Grid and list product links are read from the native results panel.

Before navigation, a fresh same-origin GET of AccountSettings.aspx must contain the native signed-in marker and matching user headings for ckunkel2. No local-storage ID, cached login or query flag enables the trial. Missing identity, request timeout/failure, another account, an expired session, user input during verification, changed results, or an embedded page leaves native results usable. The intermediate search history entry is replaced so Back does not immediately redirect again.

Scope: smart-search.js build 20261016-1 and its existing headermodern.js loader version. No cart, checkout, payment, account-setting writes or added dependencies.

Validation before release: 422 automated tests pass, including 20 new redirect/gating cases. Local Chrome checks verified a real navigation for the synthetic ckunkel2 session, normal results for a synthetic other account and guest, the 64-result case, and Back without a loop. Live baseline searches verified 24082ypl returns product 6698 and YPL returns 64 matches. Live post-release verification is recorded in the project checkpoint.

Authorization: user explicitly requested implementation and testing, restricted to ckunkel2 until they authorize broad rollout. Do not broaden the trial account as routine cleanup.

Restore: revert this trial's PR through normal release. Backup tag backup/before-single-result-search-20261016 preserves the production source before this change.
