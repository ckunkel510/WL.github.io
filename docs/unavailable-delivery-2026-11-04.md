# Hide unavailable local delivery

When a completed fulfillment quote says Woodson local delivery is unavailable, compact checkout now hides its Delivery card. Pickup and UPS Ship keep their existing behavior, and the visible cards share the available width.

Delivery remains visible while a quote is pending, and returns when a later address/cart quote makes local delivery available. Standard checkout already hides unavailable local delivery and needs no change.

This is a display change only. Rating, method selection, native WebTrack controls, payment, and order submission logic are unchanged.

Validation: 559 Node tests pass, including quote transitions from unavailable to pending to available; syntax and whitespace checks pass. Browser layout/visibility verification is recorded with the task artifacts. No real order is authorized or needed for this change.

Runtime: `20261104-unavailable-delivery-59`. Revert this change to restore the prior display.
