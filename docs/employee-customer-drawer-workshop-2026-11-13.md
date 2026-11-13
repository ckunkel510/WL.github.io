# Employee customer drawer workshop — November 13, 2026

The native employee status block can be taller than its fixed utility bar. The workshop replaces its presentation with a compact Customer chip and a right-side drawer. The selected customer's name remains in the bar; the drawer shows the full name/code, available account figures, address/contact details, sales representative, and permitted native account links.

The source is `EmployeeCustomerPanel.js`. The isolated preview is `test/employee-customer-preview.html`. No production header or loader references this source, and the preview contains only synthetic accounts.

The customer summary comes from an authenticated, uncached, same-origin GET of `AccountInfo_R.aspx` when opened or refreshed. It uses the selected customer record, not the employee's Account Settings/profile. The current native customer code, returned employee-status customer code, and returned account-heading code must agree before rendering. It copies only an explicit field whitelist, preserves displayed zero amounts, performs no financial calculations, and does not fabricate figures for cash accounts.

An in-flight response is cancelled on close/customer change, and mismatched server context fails closed. Closing or changing tabs clears the account details. No customer information enters local/session storage, analytics, console logs, third-party requests, or repository fixtures. Native server permissions remain authoritative.

Change Customer retains the existing anchor node and handler inside the original form, with no duplicate postback. Other account links are whitelisted same-origin paths present in the native response. The drawer supports Escape, focus containment/return, backdrop dismissal, internal scrolling, and phone safe-area spacing.

Sixteen browser checks pass at four Chrome and four Mac Safari responsive sizes, including role absence, native handler preservation, wrong-customer responses, customer changes during loading, cash-account empty states, no background account read, focus behavior, width constraints, and native panel replacement.

This is a working design prototype, not a released employee tool. Before production, review the design, connect the employee-only header loader, and verify the native customer-picker postback and account-data parsing against authorized live cash and charge test customers. Account-feature release approval is required by `AGENTS.md`.
