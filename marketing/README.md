# Woodson customer email automation

Build useful email programs from an audience, category, store/fulfillment context, approved design, and any date range. Customer value determines the mix: contractor news is mostly editorial, bargain-hunter content leads with real offers, and project guidance explains a useful job before introducing materials.

## Live foundation

`Signupvalidation.js` owns the live signup form. `Marketingsignup.js` is legacy and is not loaded by the current signup loader. The production preferences bridge is the existing Apps Script deployment `AKfycbzmUdU2XZ0JGNEzorkbifFLdvnYQxHl6pUFbsJzi29dg_3jFbBLD9zkixZiwSNiUPRJvQ`; source is under `integrations/constant-contact/`. Deploy the concatenation of `Code.gs` and `MarketingSetup.gs` to that existing project. Tokens and secrets remain in Script Properties; none belong in this repository or browser code.

Run `configureWebtrackMarketing` from the authenticated editor to reuse/create 28 dedicated lists and nine source/preference fields. It does not add contacts, send campaigns or activate workflows. Do not change `CC_PREFS_EMAIL_LIST_ID`: the existing My Contacts audience remains compatible with AccountInfo preferences. New explicit opt-ins also enter the dedicated Webtrack marketing list, applicable signup welcome queue, selected interests and explicitly selected store list. Operational email choices alone do not constitute marketing opt-in. An unchecked signup preserves existing marketing, interests, store and consent evidence.

The bridge checks Constant Contact membership after contact writes and creates an opaque, short-lived acknowledgement. Client click/submit events deduplicate in memory. A rejected beacon falls back to a keepalive POST; the browser displays “saved” only after acknowledgement. An opaque response or queued beacon does not prove a save. The existing public GET testSync write was disabled.

The billing/delivery fields record preferences in Constant Contact; they do not change BisTrack's invoice/statement dispatch or create a transactional-email service. SMS choices remain recorded; SMS sending/list integration is not enabled by this work.

## Programs and approved opportunity sources

- **The Trade Brief:** primary-source industry/market reporting, practical implications clearly identified as interpretation, a planning checklist, and one or two useful products. No unsupported local price forecasts.
- **The Savings Edit:** current Webtrack sale flags, quantity/program pricing (including Christmas offers), clearance, and verified Merchant price-competitiveness opportunities. The owner authorized these sources. Do not invent a markdown. A Merchant benchmark is a product-price signal, not proof of the cheapest delivered price or a retail discount. State actual quantity/unit/date/store conditions.
- **Project Notes:** useful project guidance, exact compatible materials, current product evidence, and a clear next step.
- **Owner promos and events:** accept supplied dates, eligible stores, conditions and creative; verify the brief is complete and current before use.

`themes.json` records design recipes and approval status. `flows.json` describes entry/exit rules. The templates in `templates/` and native Constant Contact workflows are unsent review drafts. A rendered example does not approve future claims, audience expansion, discounts, or sends.

## Store and fulfillment decisions

`lib/marketing/merchandising.js` prefers a customer-declared store. Without one, a clear pattern of at least two verified purchases at one store in 90 days can supply an affinity; ambiguous/weak data remains unknown. Never infer a store from IP address or silently replace a declared preference.

Resolve each product for its intended customer context:

1. Local pickup requires that exact SKU and quantity at the chosen store, with stock evidence less than one hour old.
2. Home shipping requires current eligible shipping inventory, destination/region verification, and no restriction.
3. Ship-to-store requires an explicit verified destination route, inventory, terms, and estimated timing. Stock at another branch is insufficient.
4. If no route is verified, use “Check fulfillment options” without an in-stock, pickup, free-shipping or transfer promise. Exclude the product from campaigns that depend on a specific route.

For example, hunting inventory elsewhere in the company must not become a Brenham pickup promotion. Confirmed eligible shipping can support an online offer for a Brenham customer. Store-event campaigns require a matching store audience and verified owner-approved event details.

## Safety and delivery policy

The policy and batch runner are implemented and tested; the production sender adapter is still required before new native flow activation. They are not yet a global frequency control for the four legacy active Constant Contact paths. The legacy subscription welcome already exists: do not activate a second welcome until its entry and duplicate-prevention behavior are reconciled.

The runner defaults to dry-run. A production adapter must obtain authoritative consent, purchases, campaign approval and complete send history; atomically recheck and reserve across all flows; deliver with stable idempotency; and reconcile uncertain provider outcomes. It must import relevant legacy sends into the shared history. A get-then-set reservation is not sufficient.

- Maximum three automated marketing emails per rolling seven days; welcome counts toward the cap.
- Minimum 48 hours between marketing messages; send 9 a.m.–6 p.m. America/Chicago.
- One winning flow per customer; repeated-story cooldown 14 days; approved layouts can be reused with fresh content.
- Current explicit marketing permission, active status and all suppressions checked at dispatch.
- Matching-category purchase within 14 days exits the sales pitch.
- Unknown/incomplete send or purchase data fails closed. An uncertain send stays charged to the cap and is not automatically retried.

Browsing-based email targeting is **disabled** until a trusted identity adapter and separate personalization consent are available. Existing GA4 ecommerce events are aggregate measurement, not permission to attach an anonymous browsing history to an email address. The pure scorer accepts only allowlisted product/category events, deduplicates impressions, decays old signals and requires meaningful intent. Do not publish a public endpoint that trusts an email, browser-provided account ID or self-asserted consent flag.

## Briefs and recurring authoring

Use any date range, one campaign, a season, or an ongoing program. A brief needs audience, category, objective, design, dates, eligible stores/fulfillment, exclusions and any supplied offers. Example:

```sh
node scripts/marketing/build-brief.js marketing/brief.example.json verified-catalog.json campaign-plan.json
```

Catalog products require exact SKU, canonical Webtrack link, image, current public price and verification time. Deals need current supporting evidence; pricing/program conditions and local fulfillment must be rechecked for each send. Contractor editorial needs dated primary sources. The CLI returns a review draft and explicit blockers; it never grants approval or sends.

The existing daily review automation reads the current project checkpoint and these manifests, prioritize complete owner briefs, avoid duplicate review drafts, and prepare multiple distinct useful campaigns when ready. Keep native workflows inactive until design/content approval and production delivery checks are complete.

## Verification and rollback

Run `node --test test/marketing/*.test.js` and `npm test`. Verify signup UI at mobile and desktop widths, explicit/no-change marketing behavior, store/interest field mapping, actual CC memberships, retry receipts and native draft footer/links. Do not create a new Webtrack account just to test the preference bridge.

Apps Script version 11 is the pre-change rollback. Restore that version on the existing deployment to roll back bridge code; the new dedicated lists and fields can remain unused. Revert the scoped frontend commit to remove the new signup inputs. Keep historical lists, source files and workflow history. No checkout/cart/payment code changes are part of this release.

Primary API references: [signup upsert and list memberships](https://developer.constantcontact.com/api_guide/contacts/contacts-create-or-update), [custom fields](https://developer.constantcontact.com/api_guide/contact-custom-fields/custom-fields-create-or-update), [native list-join paths](https://knowledgebase.constantcontact.com/email-digital-marketing/tutorials/KnowledgeBase/49710-Message-new-or-existing-list-members-using-the-Automation-Path-Builder?lang=en_US).

## Advance creative review

Prepare a complete review package 48 hours before its proposed release, with at least 24 hours for review. The existing Codex review task is the owner-selected channel. Show desktop/mobile creative, subject/preheader, exact products/prices/offer conditions, article sources, target categories/trades/stores and exclusions, fulfillment variants, intended release and approval deadline. Remind once at 24 hours if still pending. Hold at six hours before release if approval is missing; never roll a held campaign forward or treat silence as approval.

`lib/marketing/review.js` binds owner approval to an immutable SHA-256 manifest. Any creative, product, price, audience, timing or route-copy change requires a new revision and review. The production sender must render from that approved manifest and authenticate/persist owner approvals; a local gallery interaction is not a sending authorization. Refresh inventory/consent/history at dispatch; if the approved offer is no longer accurate, hold and return it for review. New flow delivery remains inactive until the trusted review store and transactional sender are connected.

## Seasonal and editorial checks

Seasonality applies to every path, including trade news and savings. Plan useful needs roughly one to three months ahead, with any owner-requested timeframe; calmly help customers prepare rather than inventing urgency. Near-term local NWS forecasts can refine products/claims, but a seven-day forecast cannot justify weather claims months ahead. `seasonality.js` checks exact branch area, freshness, valid forecast period, changing conditions and serious alerts. `scripts/marketing/check-weather.js` fetches official NWS data without customer geolocation. A failed forecast check holds a weather-dependent story.

`editorial.js` requires primary sources, working links, actual publication dates, category relevance and recent verification. News is at most 14 days old at release. Technical reading is dated within 12 months and needs a fresh applicability review; it is labeled as technical reading, never fresh news. Do not re-date an old article because it was fetched today. Undated guides need separate manual review and must not masquerade as current articles. The owner has not approved any release.

## STIHL and layout refreshes

Reserve two relevant monthly STIHL campaign slots in each of Lexington, Groesbeck and Mexia, using `stihl-monthly-calendar.json` as a planning calendar, not a send schedule. Verify local assortment, stock and permitted transaction route; emphasize dealer/service support. Target relevant explicit interests in the named markets, not every contact indiscriminately. Shared cadence and approval still apply.

BUILT ON QUALITY is the lead brand promise; since 1913 supports it. Refresh layout direction about every 14 days per program. `layouts.js` selects only currently approved, scoped revisions and requests a new reviewed variation when a different approved family is unavailable. Approved geometry never approves future campaign content.

## Link targeting

`links.js` validates exact PID links, strips arbitrary query data and adds public campaign identifiers without email/account IDs. The authenticated CC report adapter maps only registered links and provider URL IDs, excludes unrelated/stale events, deduplicates repeat daily clicks and returns opaque contact IDs. A click is a candidate signal requiring consent, identity, purchase and cadence rechecks. Native specific-email-link triggers require a sent campaign; draft links cannot be fully bound until the first approved release. Existing legacy click paths remain unchanged and must be reconciled with the shared ledger before new activation. No third-party website tracking script was installed.
