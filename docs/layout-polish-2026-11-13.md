# WebTrack layout polish — November 13, 2026

The logo/store-hours links could inherit absolute tablet offsets after a resize or device stylesheet load. Branding also retained a float, shadow and bottom margin. The utility menu painted a different background from its fixed bar. Product pagination inherited a half-width constraint and side margins, wrapping buttons onto several rows on phones.

## Change

- `headermodern.js` resets only the branding containers and direct logo/store-hours links, including legacy positioning. The utility links share the bar's background and have consistent hover/focus treatment.
- The existing tawk.to widget opens through a keyboard-accessible Chat button in the fixed utility bar. Only after the supported widget API is ready does the header hide the native floating launcher/prompt. Opening uses `showWidget`/`maximize`; minimizing hides the floating widget again and restores focus. Existing callbacks and already-open conversations are preserved. No messages, identity, commerce commands, connection shutdown or dashboard settings are changed.
- `mobilepcstyling.js` gives product result counts, native pagination and native sort controls a responsive layout. Native page links/options/events are retained. Page buttons stay on one line; the smallest layout uses narrower buttons with the same 44px height. The sort menu keeps a 44px target in Safari.

The root header is the source for this WebTrack presentation; the Wix unified header is separate. Product styles are owned by `mobilepcstyling.js`. Neither edited file is generated from the dormant shopping-cart bundle.

## Validation before release

- All 859 existing Node tests pass. The checkout's already-installed dependency versions were resolved through `NODE_PATH`; no dependencies or lockfiles changed.
- Real Chrome: all 12 local browser regression checks pass at 320×667, 375×667, 820×1180 and 1280×900.
- Real Mac Safari: all 12 checks pass at 320×667, 375×667, 390×844, 820×1180 and the desktop preview's measured 1279×899 viewport. These are responsive previews, not physical iOS devices.
- The browser fixture loads the actual candidate runtimes and both legacy desktop/tablet styles. It checks geometry, one-row pagination, overflow, sort touch target, utility color, chat lifecycle/callback/focus preservation, and an untouched native field/action handler. Tawk and remote reads are synthetic in this fixture.
- Syntax and whitespace checks pass. The runtime diff is limited to the two presentation owners; no checkout, payment, cart mutation or order handlers are edited.

The signed-out live checkout session was empty during the initial check. Authenticated checkout validation and real widget checks are recorded separately from these local results; do not treat a synthetic fixture as proof of those flows.

## Release and rollback

This is the requested responsive/header/chat presentation release. Publishing these hosted files does not require replacing WebTrack's inline admin loader. Verify the real tawk launcher, public search/detail, and available cart/checkout screens after publication, preserving the existing cart and stopping before orders/payments.

The baseline is commit `ade9205`. To roll back, restore only `headermodern.js` and `mobilepcstyling.js` from that commit and publish through the normal repository process. Never reset customer/cart/session data. An immutable archive of those two baseline files is saved in the task's `outputs/restore-points/layout-pre-ade9205.tar.gz` outside the public repository.
