# UPS arrival display wording — November 9, 2026

The customer-facing UPS arrival card now lists only the service name beneath its estimate. The internal one-business-day cushion remains in both calendar-date and transit-days calculations, including weekend and holiday handling. Conditional dispatch wording remains. No address quoting, service selection, pricing, validation, payment, order or checkout navigation behavior changes.

The user explicitly requested this presentation-only correction. Existing regression assertions verify that arrival dates and padded transit days remain unchanged while neither result includes the cushion explanation. Build/cache versions advance to NativeCheckout native-polish-5 and CartNativeViews native-views-6.

Before editing, a full 310-file source restore archive and SHA256 manifest were saved under the task workspace at outputs/restore-points/ups-estimate-copy-acb6647-2026-11-09/. Production base is acb6647dc5e77e39afcbb044ac59ed4b51713552, tree ee389ab3aed7472a0457c7fbaabca92bcc47086e.
