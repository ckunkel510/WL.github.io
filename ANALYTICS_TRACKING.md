# WebTrack analytics event contract

`wl-commerce.js` is the live site-side source of truth for WebTrack behavior tracking. It sends structured events to both `window.dataLayer` and GA4 measurement ID `G-4ZLV1YB6GY`. The direct GA4 transport is used because the current Google Tag Manager container is scanner-paused. `wl-events.js` and `Analytics.js` remain compatibility copies. The live filename deliberately avoids `analytics`, `tracking`, and `events`, which are blocked by some privacy filters before the script can execute.

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
  analytics_version: "1.0.1",
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
