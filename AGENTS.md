# WL WebTrack Customization Guidelines

This repository hosts live JavaScript and CSS customizations for Woodson Lumber WebTrack. Treat every runtime script as production-facing unless the user says otherwise.

## Default Working Rules

- Keep changes narrow and page-scoped.
- Prefer layout, accessibility, resilience, and flow improvements over new features.
- Avoid changing checkout, payment, cart, order, invoice, account, or add-to-cart behavior without explicit user approval for that release.
- Do not remove existing user-facing behavior unless the user asks for it or it is clearly broken and the fix is verified.
- Do not log passwords, tokens, card data, customer PII, order contents, or account-sensitive data.
- Do not add third-party dependencies or remote scripts without approval.
- When editing bundled or duplicated logic, identify the source file and generated/bundled file relationship before changing only one side.

## Approval Tiers

### Low-Risk Changes

These can be worked on proactively when scoped and verified:

- Responsive layout fixes for mobile, tablet, and desktop.
- Text wrapping, spacing, overflow, sticky header, button sizing, and visual hierarchy fixes.
- Accessibility improvements that do not change the checkout/order behavior.
- Defensive guards for missing DOM nodes.
- Console noise cleanup when it does not remove useful diagnostics.
- Documentation, repo maps, and test checklists.

### Approval-Required Changes

Ask before release for changes touching:

- Checkout step order, validation, field persistence, order submission, or final complete-order behavior.
- Payment, Pay By Invoice, saved cards, tokens, account balances, or statement payment flows.
- Cart quantity updates, remove/empty cart, branch selection, proceed-to-checkout behavior, or guest checkout handoff.
- Add-to-cart, reorder, saved-for-later, quote, or order duplication behavior.
- Account dashboard, invoices, credits, statements, open orders, job balances, customer tokens, or customer settings.
- New customer-facing tools or features, even if useful.

## Shopping Cart and Checkout Focus

The current priority is improving the shopping cart and checkout flow. Make improvements in small, reviewable steps:

1. Reproduce or inspect the issue in the browser when possible.
2. Identify the exact script and page state involved.
3. Prefer minimal fixes in the relevant script/CSS.
4. Verify at desktop, tablet, and mobile widths.
5. For sensitive behavior, provide a short release note and wait for approval before publishing the runtime script change.

## Validation Checklist

For cart and checkout work, verify as much of this as access allows:

- Cart renders with one item, multiple items, and narrow mobile width.
- Quantity controls remain usable and do not shift layout.
- Primary checkout actions are visible and clearly ordered.
- Guest and signed-in checkout paths do not share stale session state.
- Pickup and delivery flows show the right required fields.
- Required field errors send the user to the right step.
- Back-to-cart and final complete-order actions still use WebTrack native controls.
- No console errors are introduced.

## Sensitive Testing

Use a test WebTrack account for authenticated checkout/cart investigation. Do not ask the user to paste passwords into repository files or scripts. Browser-based testing should avoid submitting real orders unless the user explicitly approves a test submission window and procedure.
