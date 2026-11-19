# ckunkel2 native payment-link sandbox handoff

The initial Stripe pilot was a separate portal. Signing in to WebTrack and
opening the native payment link did not redirect anywhere. This corrects that
missing entry point within the user's already authorized ckunkel2-only scope.

`headermodern.js` is the deployed WebTrack header entry point. The legacy
`woodson-unified-header.js` is not the source of that current loader and is not
changed. No payment card inputs, tokens, authorizations, native payment handlers,
or payment methods are altered by this patch.

On a top-level HTTPS Woodson Payment.aspx order link, the helper requires native
sign-out, the order panel and fixed amount, then fetches AccountSettings.aspx
with the current same-origin session and no cache. Both native account headings
must identify exactly ckunkel2. It never uses localStorage identity hints.
Guests, other accounts, frames, ordinary checkout without a bearer order link,
and failed/contradictory/expired identity responses do not redirect.

The helper skips a late redirect after payment interaction, departure, timeout,
focused card iframe, or changed context. The eligible link is stripped to native
payment parameters, carried in a fragment to the isolated portal, and cleared
there immediately. It is not placed in a request URL, query, or referrer.

The separate portal still requires its own ckunkel2 pilot sign-in. WebTrack login
is not SSO and its browser-only identity check does not authorize backend API
access. After portal sign-in (or with its active session), the authenticated API
re-reads the native order/amount and creates a test Checkout Session. No amount
assertion from the browser is accepted. Only an HTTPS checkout.stripe.com test
destination is used. No native order is paid by this sandbox.

Validation: 1,108 complete WebTrack repository tests and 16 sandbox tests passed.
The new tests cover exact-account scope, guests/other accounts, no card-form
mutation, failed lookups, frames, duplicate parameters, interaction/departure
races, token-free server URLs, signed-out API failure and live-destination
rejection. The portal continuation is deployed before publishing its native
entry. A fresh actual browser navigation must verify the complete handoff.

The early Webtrack Manager Google loaders still need the separately supplied
privacy replacement. This redirect does not undo an earlier tracking request.
The morning reminder and header replacement remain applicable.

Rollback: revert this PR's headermodern.js change. The private portal remains
available directly and native customer payment routing remains as before.
