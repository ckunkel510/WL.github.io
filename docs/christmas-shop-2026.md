# Christmas at Woodson — WebTrack seasonal layer

Adds a wine-and-gold holiday ribbon to product listing and product detail pages, a winter welcome dialog, and a fuller Christmas Shop landing treatment. Woodson's existing header, logo, search, product controls and catalog links remain authoritative. The main Woodson/Wix site is outside this release.

The landing treatment applies only to `Products.aspx?pg=4649`. It uses the seven existing group destinations and current image nodes, so the existing published-sheet image override continues to work. Group cards have one keyboard stop apiece. The empty native navigation column is collapsed only when it contains no content or controls.

## Invitation behavior

- First eligible shopping entry in a tab session, after a 1.4-second delay and after seasonal CSS is ready.
- At most once in a rolling 24-hour period per browser profile/origin, including across tabs and browser restarts. A tab's session entry marker also prevents a repeat in a long-lived tab after 24 hours.
- Seeing the invitation starts the 24-hour window; closing it and clicking through both respect that same window.
- Never interrupts cart, checkout, sign-in, account, payment pages, embedded frames, an existing modal, a background tab, or someone typing/selecting in a form field. Direct visits to the Christmas Shop and its known subgroups skip the dialog.
- Uses a timestamp only in first-party localStorage. If that is unavailable, tries a host-only Secure, SameSite=Lax cookie with a 24-hour max age. If neither persistent store works, it leaves the ribbon available and suppresses the automatic dialog.
- The limit is browser/device specific. Clearing site data or using another browser/private profile can allow another invitation. Cross-device/account-level limits would require server-side support.
- Native `<dialog>` provides keyboard and background interaction management. Close button, Escape, backdrop click, primary shop link, and Keep shopping are supported. Older browsers without native dialog retain the ribbon instead.

The layer starts November 13, 2026 and stops automatically at midnight Central time on December 26, 2026. It makes no inventory, delivery-date, promotion, or discount claims. No customer identity or cart content is read or transmitted, and no new third-party library or service is used.

## Implementation and release

`headermodern.js` loads `HolidayShop.js` asynchronously on the two allowlisted shopping routes, within the seasonal window. `HolidayShop.js` loads its sibling `HolidayShop.css`. None of these files is generated from another repository source. Existing analytics and other loaders are preserved.

Release all three runtime files together through the normal GitHub Pages deployment. The live customization already loads `headermodern.js`, so no WebTrack admin settings need editing. Before release, obtain approval for the new customer-facing invitation as required by AGENTS.md. Rollback: remove the `loadHolidayShop()` call from the header and publish that change. The seasonal assets can remain in the repository without executing.

## Validation

Automated coverage verifies season boundaries, shopping route allowlists, Christmas context, session memory, exact 24-hour expiry, blocked storage/cookie fallback, and loader isolation/deduplication. Browser checks use a clearly labeled local fixture made from the observed live category markup and styles. This proves the new UI and frequency logic in isolation; a final live desktop/mobile smoke check is still needed after an approved deployment.

The standalone preview's toolbar resets and advances only its own local demo memory. Explicit preview behavior is restricted to marked local/file fixtures, and cannot be activated by a query string on production WebTrack.
