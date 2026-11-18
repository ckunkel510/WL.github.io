# November 18 morning review batch

The owner requested hunting, local STIHL and DIY gift drafts with a randomized exploration of existing Constant Contact My Contacts. No BisTrack data is required for this experiment. All three native campaigns remain DRAFT with no recipients selected, no tests sent and no schedules. Creative, audience and timing need explicit approval before release.

The existing native unsubscribe/profile form now offers 20 topics and weekly, standard, daily-when-useful and pause choices. Unsubscribe-all remains the default. Native unsubscribe is authoritative. Declared exclusions and the most restrictive selected pace win. A daily opt-up requires a verified subscriber choice; standard policy remains three per rolling seven days and 48 hours apart. The new planner honors weekly/pause. Legacy manual sends and active automations still require a shared history/preference adapter before account-wide enforcement is complete.

Review lists: hunting 1,676; gifts 1,650; local STIHL 364 (Lexington 113, Groesbeck 151, Mexia 100); holdout 408. Ten native jobs completed, exact counts and no overlap verified. 496 delivery/suppression holds plus 200 unmatched known-topic holds. Base permission stays unchanged, including 520 explicit and 4,274 implicit contacts. Autonomous dispatch requires explicit consent; the legacy audience experiment is a separate owner-review proposal. Most assignments are exploration, not inferred declarations.

Three native activities:
- Hunting: `2ebf161b-bfbb-4691-a7c6-c26ed81c0e04`.
- STIHL: `f2c11523-4f3d-49df-97d2-dec096bd4882`.
- Gifting: `728940f4-0c13-4657-9bcd-3f4c714a5407`.

Public product UTMs carry only registered campaign/content/product keys. The site emits `email_landing` once for a registered landing within its 30-minute tab session and carries that public context into existing ecommerce events. This is browser-session attribution, not proof of identity or causation. It does not change cart or order behavior. Reports must keep missing website/order/in-store inputs unknown. Unique clicks/delivered differ from click-to-open rate. Opens and a single missing click cannot reroute someone. Four mature delivered exposures spanning at least 21 days may reduce priority; never auto-unsubscribe or invent a different interest.

Exact photos, canonical prices, current branch stock, manufacturer compatibility and NWS weather were reviewed. Two SD-card images contradicted catalog descriptions, so they were omitted. Eight matching AA cells and Class 10 SD up to 32 GB are the exact GMAX camera requirements; the lithium AA four-pack requires two packs for eight cells. STIHL fulfillment is dealer-confirmed and limited to the three approved markets.

`AudienceReview.gs`, `MorningDrafts.gs` and `MarketingMetrics.gs` are authenticated editor functions, not public routes. They retain contact IDs only inside the provider adapter and export aggregates. Setup creates choices without enrolling contacts. Review cohorts are immutable after creation and must be rechecked for current consent, lower frequency, failed delivery and legacy overlap before release. Any `updated_at` after the native preference-center launch with no managed topics holds conservatively; list/tag updates can cause extra holds, so do not reinterpret a changed record as a positive preference.

The hourly click worker skips unsent activities. Future campaign links bind only exact reviewed canonical destinations within that activity using the provider URL ID; no arbitrary query stripping. It writes weak observed tags without changing permission, preferences or subscription and refreshes aggregate KPIs. No send, schedule or activation routes are added.

Compile the bridge by concatenating `lib/marketing/cohorts.js`, then `Code.gs`, `MarketingSetup.gs`, `ClickLearning.gs`, `AudienceReview.gs`, `MorningDrafts.gs`, `MarketingMetrics.gs`. Preserve ScriptProperties and the existing hourly Head trigger. Public deployment snapshots require an explicit version update; editing Head alone does not update the public signup bridge. Never copy credentials or recipient records into source.
