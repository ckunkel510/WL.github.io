# Shipping cost protection — November 9, 2026

When a clearance price is below the catalog retail price, the margin-based Ground offer can overstate the money available to subsidize shipping. Heavy and bulky products can also receive the discounted tier whenever merchandise margin is high.

This release retains the full carrier Ground rate for carts containing clearance merchandise, an item or package weighing at least 50 lb, a dimension above 48 inches, or carrier/dimensional billing weight of at least 50 lb. Trusted catalog clearance flags, packed cartons, and UPS billing weight drive the decision. Ordinary parcels retain the existing protected-margin offer; incomplete shipping data continues to block automatic quotes.

Validation: 79 shipping/API regression checks pass, including clearance, actual weight, dimensional weight, oversize, mixed-cart, and boundary cases. A local replay of 15 live carrier responses retained their full Ground cost. After production deployment, verify fresh quotes for 30GFU, product 24209, product 7172, product 21811, and product 13756. Stored fulfillment quotes expire after 15 minutes.

The user approved releasing this safeguard and the corresponding daily selling-price feed correction on November 9, 2026. No customer order or shipping label is needed for validation.
