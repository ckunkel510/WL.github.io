# Payment-link privacy fix

The user authorized this privacy correction separately from the private Stripe
sandbox. This change does not route or submit any payments.

A fresh native payment-link visit was observed sending the full page URL,
including the native opaque order and amount credentials, in a Google Ads
request. The initial Google loaders are stored in Webtrack Manager and execute
before the GitHub header/analytics code. Removing a tag after load cannot repair
that earlier disclosure.

## Changes

- `config/webtrack-payment-google-header.html` replaces the existing GTM loader,
  external Google Ads include, and Ads initialization as one guarded section.
  It runs the privacy check before creating any Google script element.
- Payment.aspx and URLs containing native payment parameters, including encoded
  return URLs, skip the loaders and receive a no-referrer meta policy.
- `headermodern.js` skips its analytics loader in the same contexts.
- `wl-site.js` and the identical compatibility entry points `Analytics.js`,
  `wl-commerce.js`, and `wl-events.js` exit before any analytics work.
- Ordinary pages keep the same Google container and Ads identifiers.

The installation file gives the exact three script boundaries. Keep the
unrelated merged customizations, CSS, header loader, and native payment scripts.
If present, remove the unguardable GTM no-JavaScript iframe fallback.

## Verification

The complete repository suite passed **1,103 tests**. The focused privacy,
analytics-integration, and checkout-measurement set passed **34 tests**. The
privacy tests execute the actual inline header and analytics entry points,
check zero tracker loads for sensitive contexts, and confirm ordinary pages
retain their original loaders. No native card or bank authorization was made.

The initial disclosure remains open until the user saves the Webtrack Manager
replacement and a fresh native payment-link network check passes. A one-time
reminder is scheduled for November 19 at 9 a.m. Central with the full code.

Scope is the confirmed Google disclosure and the custom analytics entry points.
The independent existing chat bootstrap is outside this correction. Review all
third-party code before a future live payment portal; bearer payment URLs must
never be sent to advertising, analytics, chat, or application logs.

Rollback: restore the backed-up Manager tracking section and revert this commit
only if needed to recover ordinary-page tracking. Restoring the old tracking on
payment pages also restores the privacy problem.
