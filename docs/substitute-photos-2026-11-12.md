# Photo cards for cart suggestions

Existing substitute suggestions now use the catalog's `imageUrl`, the same WebTrack/Sirv image hosts used by product recommendations. Photos retain their aspect ratio with `object-fit: contain`, have product-name alt text and a fixed-size frame, load lazily, and send no referrer. Missing, disallowed or failed images show a readable fallback while the option remains usable. Images do not determine eligibility.

Each card keeps a product name, short color/length change, unit price and estimated change for the selected quantity. Local/company stock counts and an other-store-stock badge remain visible. Longer comparison text and the native product-page link are available in a keyboard-accessible Details disclosure. Unstructured reviewed-pair differences remain visible in full so a compact card does not conceal an important qualification. One shared checkout note replaces repeated fulfillment paragraphs.

Clicking the photo or text selects the existing named radio. Both quantity scopes, explicit differences acknowledgement, native inventory/pricing/cart preflight, Apply, recovery and anonymous history retain their existing handlers and behavior. No cart or order writes are required for the published visual check.

The API adds only presentation fields (`imageUrl`, `differenceSummary`); existing full reason/differences remain. Client build/cache version is `20261112-substitutions-3`; shared eligibility rules remain version2. URL checks accept HTTPS on the existing exact image hosts and reject credentials, unexpected ports, executable URLs and foreign hosts. No new library, script, storage or data source.

This is an existing picker layout/content update under AGENTS.md's low-risk presentation tier. The user's request authorizes the photo presentation; no quantity, checkout, payment, eligibility or history behavior change is included.
