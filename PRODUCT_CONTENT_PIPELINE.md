# Product content pipeline

## Why this changed

The former product-detail script downloaded the entire published description
sheet in every shopper's browser and scanned it for the current `pid`.

Measured on July 28, 2026:

- full published CSV: about 16.3 MB
- source rows: about 202,000
- representative product-scoped response (`pid=128`): under 1 KB

The new browser code never requests the full sheet.

## Customer-facing flow

1. `ProductDescription.js` reads the numeric `pid` from the current product URL.
2. It requests `GET https://wl-upsrates.vercel.app/api/product-content?pid=<id>`.
3. `api/product-content.js` fetches only rows for that product through a Google
   Visualization query and caches the normalized response.
4. If the API is temporarily unavailable, the browser uses the same
   product-scoped Google query directly.
5. Only after valid content is rendered does the script hide WebTrack's native
   description. Failed or empty requests retain the native description.
6. The content is rendered as semantic About, Highlights, Specifications, and
   Resources sections. Product JSON-LD receives the description and
   `additionalProperty` specifications when Product schema already exists.

No shopper request downloads or parses all 202,000 source rows.

## Sheet maintenance

The `Product Descriptions` workbook now has a `Product Manager` tab:

- enter one WebTrack Product ID in `B3`
- review all matching source rows in one place
- open the product page from the supplied link
- open the authoritative Merchant primary feed from the supplied link
- use the filter on `Sheet1` for source edits

The preview is formula-driven and intentionally read-only. `Sheet1` remains the
single source of truth so the site and existing vendor processes do not diverge.
The `Review` tab is not used to determine whether a product is active.

Run this repeatable audit from the repository:

```sh
npm run audit:product-content
```

Set `MERCHANT_PRIMARY_FEED_URL` in the local environment before running it. Do
not commit or paste that URL into public documentation: the current primary
export includes internal cost data.

It reports both:

- Merchant primary-feed IDs with no source content
- source-content IDs absent from the Merchant primary feed

The audit reads the `id` column from `Woodson Automated Google Feed`, which is
the authoritative active-product list and refreshes daily. On July 28, 2026,
the audit found 23,234 Merchant IDs, 19,771 with source content, 3,463 without
source content, and 2,216 source-only IDs. Treat source-only IDs as cleanup
candidates, not an automatic deletion list.

## Primary-feed privacy

The published primary CSV currently contains a populated
`cost_of_goods_sold` column. Its URL is therefore configuration, not source
code: keep `MERCHANT_PRIMARY_FEED_URL` in protected local and Vercel environment
variables and never expose it through the shopper API.

This limits new exposure but does not fix the existing public export. The
durable fix is to remove internal cost from the published file or move the
primary source to a protected scheduled fetch, Merchant SFTP, or Merchant
Google Cloud Storage:

- https://support.google.com/merchants/answer/14991445
- https://support.google.com/merchants/answer/13813117
- https://support.google.com/merchants/answer/15291318

## Merchant Center handoff

The customer API returns a `merchant` object alongside the display content:

- `description`
- `productHighlights`
- `productDetails`

The supplemental Merchant delivery currently publishes the extended
`description`. Product highlights and structured details remain available for a
later feed expansion after their source quality is reviewed.

Merchant item `id` is the WebTrack Product ID. Product `128` was verified in the
primary source and the supplemental output.

The supplemental data is split into two disjoint, deterministic CSV sources:

- `https://wl-upsrates.vercel.app/api/product-content-merchant-feed?part=1`
- `https://wl-upsrates.vercel.app/api/product-content-merchant-feed?part=2`

Each source has only `id,description`; Merchant joins it to the primary source
by `id`. IDs are assigned by numeric parity, so the two sources never overlap.
The live validation measured the parts at about 2.61 MiB and 2.64 MiB. The split
keeps each response below Vercel's 4.5 MB function-response limit.

Add both URLs as supplemental data sources in Merchant Center only after the
endpoint deployment has been verified. The endpoint filters against the live
primary feed before publishing, caches each part for six hours, caps each
description at Merchant's 5,000-character limit, and never publishes resources
or HTML.

Relevant Google guidance:

- https://support.google.com/merchants/answer/15624457
- https://support.google.com/merchants/answer/9216100
- https://support.google.com/merchants/answer/9218260

## Configuration

Optional Vercel environment variables:

- `PRODUCT_DESCRIPTION_SHEET_ID` — defaults to the current workbook
- `PRODUCT_DESCRIPTION_SHEET_GID` — defaults to `0` (`Sheet1`)
- `PRODUCT_CONTENT_CACHE_SECONDS` — defaults to 900 seconds, bounded from 60
  seconds to 24 hours
- `PRODUCT_DESCRIPTION_FULL_FEED_URL` — full published content source used only
  by the scheduled Merchant supplemental endpoints
- `MERCHANT_PRIMARY_FEED_URL` — required for the audit and supplemental
  endpoints; store it only as a protected local/Vercel environment variable

The endpoint uses the repository's existing Upstash/Vercel KV environment when
available and falls back to a per-instance memory cache.

## Release order

1. Deploy the Vercel endpoint.
2. Verify a representative content-rich product and a product with no extended
   content.
3. Publish `ProductDescription.js` and `Productdescriptionstyle.js`.
4. Verify desktop and mobile layout, native-description fallback, resources,
   and Product JSON-LD.
5. Add the two supplemental URLs to Merchant Center.
6. Run a test refresh and inspect item `128`, diagnostics, and matched-item
   counts before scheduling daily refreshes.
