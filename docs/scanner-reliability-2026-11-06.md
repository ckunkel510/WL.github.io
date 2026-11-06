# Barcode scanner repair — November 6, 2026

The supplied 22-second iPhone recording shows a moving camera preview from roughly 8 seconds onward while the status remains “Starting camera…” through the end. There is no ready/detection/search transition, and the chat widget overlaps the scanner. The visible interface is the modern header scanner, not the preserved legacy fallback.

## Diagnosis and change

`headermodern.js` starts detection only after Quagga's initialization callback. Quagga 0.12.1's default worker bootstrap can wait indefinitely for an initialized-worker message; worker failure does not reliably finish that callback. The recording proves the missing ready transition, but does not by itself prove the exact Safari worker/CSP error. The repair removes that failure path by explicitly selecting zero workers, and bounds startup/frame readiness so any remaining failure has a retry/manual recovery.

- Request an inline muted rear-camera video at an ideal 1280×720 and preserve a 1280-pixel analysis size; use the smaller locator grid for retail barcodes.
- Retain the existing Quagga 0.12.1 dependency and host. No new dependency, upload service or remote script is added.
- Use distinct loading, camera startup, scanning, confirming, found/searching, manual and error states. Show the recognized number before the existing product-search navigation; a visible results link remains available.
- Require two matching retail detections within 1.5 seconds, reject bad GTIN checksums/poor decode confidence, and normalize zero-prefixed EAN-13 representations of UPC-A. Existing Code128 search support remains, with three confirmations and no GTIN-checksum rule applied to Code128 values.
- Replace the full-screen stretched camera with a bounded preview, readable status/actions, accessible close control and a focused manual-entry form. Temporarily hide the existing chat iframe only while the scanner is open; restore its CSS visibility on close.
- Stop owned camera tracks/listeners on close, error, manual entry, page departure or backgrounding. Handle late camera resolution, preserve other Quagga detection handlers and cancel pending search navigation when the customer closes.
- Manual entry validates complete 8/12/13/14-digit retail codes, tolerates pasted spaces/hyphens and preserves corrections. It uses the existing product-search route and does not alter the cart.

## Verification and limits

- Full Node suite: 690 tests pass, including startup timeout, missing decoder frames, denied access, retry/reopen, late camera resolution, visibility/page departure, checksum/confidence filtering, EAN-to-UPC normalization, manual correction, keyboard focus and cancellation of delayed navigation.
- Local browser test keeps workers blocked and uses the site's actual Quagga 0.12.1 decoder on a camera-region crop from the recording. The 12-second frame decodes as UPC `762111571717`; a steady-frame replay reaches the visible confirmation and the expected product-search handoff. A separate local system decoder also reads its EAN-13 representation `0762111571717` from several original full frames.
- Other recorded frames are not uniformly readable by Quagga; the package is creased and moving. Recognition still depends on focus, glare and holding the entire barcode steady. This is why retry and manual entry are retained.
- Local tests replace only camera acquisition and navigation; image decoding is real. They do not establish a successful physical iPhone camera session. A fresh phone scan remains the final device check after release.
- Scanner checks at 390, 768 and 1280 pixels have no horizontal overflow; close control remains visible. Chat hides during scanning and returns on close. Manual correction and normalized search pass in the browser.
- No orders, payments, cart lines or account records are submitted or changed. The requested change is confined to the existing public scanner/search experience and its requested UI modernization.

Raw recordings/frames stay local and are not committed or uploaded. Local screenshots and metadata are in the task's `outputs/` folder; no customer financial screenshots are captured.

## Restore and deferred admin blocks

A fresh complete source archive (300 tracked files), per-file hashes and restore instructions were saved before runtime edits under `outputs/restore-points/scanner-reliability-09e87e6/`. The baseline is published PR136 commit `09e87e6097cde2b80083568252981d1b52f7d696`, tree `629dc6060cf698633192860400ef08655fa12dbc`.

Restore `headermodern.js` from that baseline and publish the source rollback if needed; do not reset customer/cart/session data. The old scanner fallback remains available unchanged.

The user deferred WebTrack admin activation. Both replacement HTML blocks and instructions from PR136 remain saved and unapplied. This scanner repair works through the already loaded modern header and does not require activating those blocks.

References: [Quagga source initialization and worker handling](https://github.com/serratus/quaggaJS/blob/v0.12.1/src/quagga.js), [Quagga configuration](https://github.com/serratus/quaggaJS#configuration), [camera constraints](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).
