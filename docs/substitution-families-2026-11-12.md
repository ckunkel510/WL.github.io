# Reviewed substitute families and neutral cart language

## Customer behavior

The cart has not yet established pickup or delivery. Its shortage message is:

> 10 unavailable at Caldwell. Choose a substitute, or continue to checkout to see fulfillment options and timing.

The picker, empty state, network-error state and stock labels use the same neutral approach. Customers can retain their original items at any time. Scope is explicit: the whole line, or only the quantity unavailable at the named store. This local-shortage definition does not imply a companywide shortage or select a fulfillment method.

Alternatives must have enough freshly verified **companywide** piece stock for the requested replacement plus any quantity of that alternative already in the cart. Cards show local and companywide counts, disclose when stock from another store is needed, and defer pickup/delivery eligibility and timing to checkout. No same-day readiness, transfer completion, delivery service or inventory reservation is promised. Unknown stock and supplier-only replacement quantities remain ineligible. The existing checkout inventory/date logic runs on the resulting cart. A changed transfer requirement forces a fresh review before a swap.

## Grow families instead of maintaining every pair

`data/substitution-families.json` is the reviewed family registry. Three initial groups cover 15 reviewed product IDs and up to 66 directed color choices:

| Family | Reviewed variants | Required distinction |
| --- | ---: | --- |
| Turtlebox Ranger | 6 | Same listed Ranger model; color/finish changes |
| Turtlebox Original Gen 3 | 6 | Reviewed Gen 3 product IDs; color changes |
| Ranger bumper sets | 3 | Same accessory fit; color changes |

Speakers never match bumper sets. Ranger, Original, Grande and Cub remain separate. The new Original camouflage listing is not included without a model/generation review. Twelve reviewed members were present in the active catalog during inspection; Ranger Delta, Ranger camouflage and Original Maroon were missing and cannot be suggested while absent. Native catalog presence alone does not bypass the active-catalog boundary.

Each family records a model, exact category and brand, revision, review date, enable switch, and individual product IDs with exact titles and variant labels. Only the known River Rock ID/title may have a missing brand in the catalog; filling that field with the canonical Turtlebox brand stays valid. A changed title, pack, category or unexpected brand fails closed. A disabled family takes effect on the next deployment. Immutable configuration is indexed once per function instance; matching scans the existing catalog, not a pair matrix.

Existing longer untreated lumber rules and exceptional reviewed directional pairs remain supported. Other product types can reuse a color-family entry only after verifying the same model/generation, capacity, size, pack, power platform and compatibility. For example, review one exact drinkware capacity or cooler size at a time. Sizes, electrical ratings, structural grades, treatment, paint formulas and tool-only/kit differences need product-specific rules or directional review; broad category similarity is insufficient.

## Maintenance workflow

1. Export the current customer-facing catalog as JSON (`products` array or array) or Merchant CSV (`id,title,brand,product_type`). No account, orders, prices or credentials are needed for the audit.
2. Run `npm run audit:substitutions -- --catalog /path/to/catalog.csv --output /path/to/report.json` whenever reviewing a catalog refresh or merchandising update.
3. Review the report's missing/changed/ambiguous members, review dates older than 180 days, newly seen colors in existing models, and potential new color families. Discovery is a review queue only. It never edits or enables suggestions. Invalid registry/ambiguous membership/catalog drift returns a failing exit status; missing products and review reminders remain visible warnings.
4. Add reviewed members or families to the registry, or disable entries. Verify manufacturer model/generation and customer-facing differences, update `reviewedAt`, and increment `revision` for semantic changes. Review the diff and normal tests before the repository's approval-required release. Registry changes deploy with the site; this is a versioned maintenance workflow, not a live admin editor or automatic scheduled job.
5. Check a shortage, both replacement scopes, transfer disclosure, keeping originals and the unchanged checkout path. Fresh native stock, titles, prices, cart and store are rechecked before applying every selection.

The read-only audit is linear in catalog size for normal family membership. Potential-family discovery proposes only matching title stems with color-like suffixes and shared brand/category; it is deliberately conservative and does not imply compatibility. A spreadsheet/admin editor can later author this same registry without changing the eligibility model.

## Customer learning and history

Accepted choices continue into the existing anonymous Redis history. Counts modestly improve ordering only among currently eligible products. They do not auto-approve a family, infer compatibility, or cross model boundaries. The API revalidates both membership and rule revision before consuming a receipt. Removed or changed rules cannot train from an old offer. A cart selection is not evidence of a paid or fulfilled order. No new customer data, dependency, secret, public history endpoint or fulfillment policy is introduced.

## Verification

New regressions cover strict family boundaries, missing-brand enrichment, catalog drift, duplicate/disabled families, unknown colors, native title checks, company stock and existing quantities, changed transfers, rule revisions and the maintenance report. The local browser fixture uses actual edited client/rules/API/history modules with simulated native forms and memory-only history. It verifies both scopes and browser → API → accepted-choice data. Production cart mutation is a separate release check; no live order or payment is submitted.
