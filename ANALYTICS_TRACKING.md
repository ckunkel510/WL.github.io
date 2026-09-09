# WebTrack analytics event contract

`wl-site.js` is the live site-side source of truth for WebTrack behavior tracking. It sends structured events to both `window.dataLayer` and GA4 measurement ID `G-4ZLV1YB6GY`. The direct GA4 transport is used because the current Google Tag Manager container is scanner-paused. `wl-commerce.js`, `wl-events.js`, and `Analytics.js` remain compatibility copies. The live filename deliberately avoids analytics- and commerce-related terms that privacy filters can block before the script executes.

The GA4 configuration uses `send_page_view: false`, so WebTrack's existing page-view tracking remains the source of page views. Ecommerce fields are flattened into GA4's native event format before transmission.

## Privacy boundary

The event layer intentionally excludes:

- Names, email addresses, phone numbers, and postal addresses
- Account, customer, or local-storage user IDs
- Passwords, payment details, purchase-order text, and special instructions
- Values typed into checkout fields

Product IDs, product names, quantities, prices, search terms, delivery versus pickup, page type, and confirmed order numbers are allowed. The sanitizer drops known personal-data keys and strings that resemble email addresses or phone numbers.

## Data layer format

Every event uses the same GTM custom event:

```js
{
  event: "wl_analytics_event",
  event_name: "add_to_cart",
  analytics_version: "1.3.1",
  page_type: "product_detail",
  ecommerce: {
    currency: "USD",
    value: 19.98,
    items: [{ item_id: "1234", item_name: "Example", price: 9.99, quantity: 2 }]
  }
}
```

Supported event names:

- `search`
- `view_item_list`
- `select_item`
- `view_item`
- `add_to_cart`
- `remove_from_cart`
- `cart_quantity_change`
- `view_cart`
- `begin_checkout`
- `add_shipping_info`
- `add_payment_info`
- `checkout_submit`
- `purchase`
- `share_product`
- `generate_lead`
- `pdp_fulfillment_view`
- `pdp_fulfillment_ready`
- `pdp_fulfillment_select`
- `pdp_store_availability`
- `pdp_price_sign_in`
- `pdp_option_view`
- `pdp_option_select`

`purchase` is emitted only when WebTrack renders both the order response and successful-payment result elements. It includes the confirmed transaction ID, USD order value, and the retained non-personal cart items. Confirmed transaction IDs are retained only for duplicate-event prevention.

Cart snapshots expire after seven days. `begin_checkout` is deduplicated across the cart-to-checkout page transition, and `add_payment_info` waits until a visible EPX/payment section is present.

## GTM configuration

Do not publish while the container or tags are flagged by Google's malware scanner. Resolve that warning first, then configure the clean workspace as follows:

1. Create a Custom Event trigger named `CE - WL Analytics Event` for `wl_analytics_event`.
2. Create Data Layer Variables using Version 2 for `event_name`, `search_term`, `item_list_name`, `shipping_tier`, `payment_type`, `checkout_stage`, `change_type`, `page_type`, and `analytics_version`.
3. Create one GA4 Event tag using measurement ID `G-4ZLV1YB6GY` and `{{DLV - event_name}}` as the event name.
4. Enable ecommerce data from the data layer in that tag.
5. Map the non-ecommerce parameters above as event parameters and attach `CE - WL Analytics Event`.
6. Use GTM Preview and GA4 DebugView to validate each event before publishing.

The old click-text triggers should be retired after the new event stream is verified. Leaving both enabled will duplicate ecommerce events.

## Abandoned-cart follow-up

The browser stores a non-personal cart snapshot under `wl_analytics_cart_v1` so the funnel can survive WebTrack page transitions. That snapshot alone cannot send a reliable abandoned-cart email or SMS.

A later Constant Contact phase needs a server-side service that receives consented customer identity separately, associates it with the cart, waits for an abandonment window, verifies that no purchase occurred, and then calls Constant Contact. Email addresses or phone numbers must not be placed in GTM or GA4.


## PDP fulfillment experiment

Experiment ID: `pdp_fulfillment_v1_20260909`

Variants:

- Fulfillment v1: `enhanced_fulfillment`
- Options-layout v2 (current): `three_column_options_v2`
- Similar-products v1: `similar_products_v1`
- Recommendation shelves v2 (current): `recommendation_shelves_v2`

Production baseline commit: `f2d483d51ff7e127852be82f0f4f2ec445ca9f3e`

Rollback branches:

- Before fulfillment v1: `backup/pdp-before-fulfillment-v1-20260909`
- Before options-layout v2: `backup/pdp-before-options-layout-v2-20260909`
- Before similar-products v1: `backup/pdp-before-similar-products-v1-20260909`
- Before recommendation shelves v2: `backup/pdp-before-recommendation-shelves-v2-20260909`

The product-detail runtime stores only the experiment ID, variant, and current fulfillment method in session storage. The analytics runtime adds those fields to subsequent supported events, including `view_item`, `add_to_cart`, checkout events, and `purchase`. This permits end-to-end conversion analysis without storing customer identity or address information.

Primary KPI:

- Product-detail add-to-cart rate: users with `add_to_cart` divided by users with `view_item`, segmented by `experiment_variant`.

Secondary diagnostics:

- Fulfillment engagement: `pdp_fulfillment_select` divided by `pdp_fulfillment_view`.
- Store-availability engagement: `pdp_store_availability` divided by `pdp_fulfillment_view`.
- Price-gate sign-in intent: `pdp_price_sign_in` divided by gated product views.
- Option visibility: users with `pdp_option_view` divided by eligible product views.
- Option engagement: `pdp_option_select` divided by `pdp_option_view`, segmented by `option_type` and `option_value`.
- Recommendation-shelf visibility: users with `view_item_list` divided by eligible product views, segmented by `item_list_id` and `recommendation_strategy`.
- Recommendation-shelf click-through: users with `select_item` divided by shelf viewers, segmented by `item_list_id`, `item_list_name`, and `recommendation_strategy`.
- Recommendation-assisted add-to-cart: recommended-product `add_to_cart` events carrying a v2 recommendation `item_list_id` divided by recommendation selections.
- Recommendation-assisted purchase: purchases containing an attributed recommended item divided by recommendation selections.
- Downstream checkout and purchase rate segmented by `fulfillment_method`.

These releases are sequential full rollouts rather than randomized controls. Compare equivalent product and traffic windows before and after each launch, using `experiment_variant` to separate fulfillment v1 from the options-layout v2. Avoid launching unrelated PDP conversion changes during the initial measurement window.

## PDP recommendation shelves v2

Algorithm version: `merchant_category_affinity_v2`

The product recommendation endpoint uses the existing customer-safe catalog snapshot. It never exposes internal cost or supplier data and does not download the complete catalog in the shopper's browser. Candidates must have a safe WebTrack URL, safe image URL, and current catalog-level `in_stock` status.

Ranking and display rules:

- Keep `Compare similar products` focused on the same leaf category when at least three options remain; use the immediate sibling level only when the leaf category is too small.
- Add up to three independently tracked `You may also like` shelves using explicit project affinities such as hoses to nozzles, sprinklers, and lawn care.
- For categories without an explicit affinity, use well-stocked adjacent leaf categories under the same immediate parent, then the next safe catalog level when available.
- Exclude the current product and every product ID already shown in the PDP option controls.
- Never repeat a product across shelves. Prefer closer title and catalog-price similarity, then diversify categories and brands.
- Render at most four shelves and eight products per shelf. Hide any shelf with fewer than three qualified products.
- Do not display catalog prices until a selected-store-aware price source is available. The card CTA is `View price & availability` and opens the native PDP.
- Keep `Product details` before `Customer reviews`, and mount all recommendation shelves after reviews at desktop and mobile widths.
- Do not display a generic inventory-source subtitle; each shelf title carries the merchandising purpose.

Each shelf emits its own GA4 `view_item_list` and `select_item` events with `item_list_id`, `item_list_name`, `recommendation_algorithm`, and `recommendation_strategy`. Recommendation selection is stored in session storage for no more than 24 hours. When the selected product is subsequently viewed, added to cart, or purchased, `wl-site.js` attaches the same shelf attribution and the non-personal source product ID. No customer identity or address is retained.

The first release intentionally does not claim `Frequently bought together`. That module requires anonymized Woodson order-line pairs or sufficiently complete purchase-item exports so the label is supported by actual customer baskets.
