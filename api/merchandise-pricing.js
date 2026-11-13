'use strict';

const crypto = require('node:crypto');
const policy = require('../data/christmas-light-sale-2026.json');
const eligible = new Map(policy.products.map(p => [p.productId, p.productCode]));
const integer = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum;
const fail = message => { const error = new Error(message); error.status = 409; throw error; };

function normalizeCart(cart) {
  if (!Array.isArray(cart) || !cart.length || cart.length > 50) fail('The current cart is required.');
  const seen = new Set();
  return cart.map(line => {
    const productId = String(line.productId || '');
    const quantity = Number(line.quantity), netLineTotalCents = Number(line.netLineTotalCents);
    if (!/^\d{1,12}$/.test(productId) || seen.has(productId) || !integer(quantity, 1) || quantity > 10000 ||
        line.netLineTotalCents == null || !integer(netLineTotalCents) || netLineTotalCents > 100000000) fail('Please refresh the cart quantities and prices.');
    seen.add(productId);
    return {productId, productCode: String(line.productCode || line.code || '').toUpperCase(), quantity, netLineTotalCents};
  });
}

// Integer-cent allocation keeps the cart, shipping qualification and order sum
// equal even when a basket-wide percentage leaves a fraction of a cent per line.
function allocate(cents, lines) {
  const total = lines.reduce((sum, line) => sum + line.netLineTotalCents, 0);
  const parts = lines.map((line, index) => ({index, cents: total ? Number(BigInt(cents) * BigInt(line.netLineTotalCents) / BigInt(total)) : 0,
    remainder: total ? Number(BigInt(cents) * BigInt(line.netLineTotalCents) % BigInt(total)) : 0}));
  let remaining = cents - parts.reduce((sum, p) => sum + p.cents, 0);
  [...parts].sort((a,b) => b.remainder - a.remainder || a.index - b.index).forEach(p => {if (remaining > 0) {p.cents++; remaining--;}});
  return parts.map(p => p.cents);
}

function priceCart(cart, catalog, options = {}) {
  const lines = normalizeCart(cart), now = options.now ?? Date.now();
  if (!catalog?.fresh || !Array.isArray(catalog.products) || catalog.products.length !== lines.length) fail('Current product prices are unavailable. Please retry.');
  const trusted = catalog.products;
  for (let i = 0; i < lines.length; i++) {
    if (String(trusted[i]?.productId) !== lines[i].productId || (lines[i].productCode && lines[i].productCode !== String(trusted[i].productCode).toUpperCase())) fail('The cart product could not be verified.');
  }
  const nativeSubtotalCents = lines.reduce((sum, p) => sum + p.netLineTotalCents, 0);
  if (!integer(nativeSubtotalCents) || nativeSubtotalCents>100000000) fail('This cart requires a reviewed quote.');
  const adjusted = lines.map(p => ({...p})), adjustments = [];
  const overridden = new Set();
  // Extension point: only our server's approved quote resolver can supply these.
  // The public request body is never accepted as a price or adjustment source.
  for (const offer of options.trustedSpecialPrices || []) {
    const index = lines.findIndex(p => p.productId === offer.productId);
    if (index < 0 || overridden.has(offer.productId) || !offer.quoteId || offer.expiresAt <= now ||
        !integer(offer.unitPriceCents) || offer.quantity !== lines[index].quantity) fail('The special-order quote needs to be refreshed.');
    overridden.add(offer.productId);
    const target = offer.unitPriceCents * offer.quantity;
    if (!integer(target) || target > 100000000) fail('The special-order price is invalid.');
    const amountCents = target - lines[index].netLineTotalCents;
    if (amountCents) adjustments.push({id:'special-order:' + offer.quoteId, label:'Special-order pricing', amountCents, productId:offer.productId});
    adjusted[index].netLineTotalCents = target;
  }
  const active = options.employee !== true && policy.enabled && now >= Date.parse(policy.startsAt) && (!policy.endsAt || now < Date.parse(policy.endsAt));
  const indexes = lines.map((p,i) => i).filter(i => active && !overridden.has(lines[i].productId) && eligible.get(lines[i].productId) === String(trusted[i].productCode));
  const eligibleQuantity = indexes.reduce((sum,i) => sum + lines[i].quantity, 0);
  const percentOff = policy.tiers.filter(t => eligibleQuantity >= t.minimumQuantity).at(-1)?.percentOff || 0;
  let regularCents = 0, currentCents = 0;
  indexes.forEach(i => {
    const unit = Math.round(Number(trusted[i].price) * 100);
    if (!integer(unit,1)) fail('A current regular light price is required.');
    const regular = unit * lines[i].quantity;
    if (!integer(regular) || regular>100000000) fail('This light quantity requires a reviewed quote.');
    if (lines[i].netLineTotalCents > regular + 1) fail('The light price has changed. Please refresh the cart.');
    regularCents += regular; currentCents += lines[i].netLineTotalCents;
  });
  const targetCents = regularCents - Math.round(regularCents * percentOff / 100);
  const savingsCents = Math.max(0, currentCents - targetCents);
  if (savingsCents) {
    adjustments.push({id:policy.id, label:policy.label + ' (' + percentOff + '%)', amountCents:-savingsCents, eligibleQuantity, percentOff});
    const shares = allocate(savingsCents, indexes.map(i => lines[i]));
    indexes.forEach((i,j) => {adjusted[i].netLineTotalCents -= shares[j];});
  }
  const deltaCents = adjustments.reduce((sum,p) => sum + p.amountCents,0);
  const merchandiseSubtotalCents = nativeSubtotalCents + deltaCents;
  if (!integer(merchandiseSubtotalCents) || merchandiseSubtotalCents>100000000) fail('The adjusted merchandise total requires a reviewed quote.');
  const signature = crypto.createHash('sha256').update(JSON.stringify(lines)).digest('hex');
  return {version:1, nativeSubtotalCents, merchandiseSubtotalCents, deltaCents, savingsCents, eligibleQuantity, percentOff,
    adjustments, cart:adjusted, cartSignature:signature, catalogVersion:String(catalog.active?.id || ''),
    // Weight is verified from the catalog, never from the browser's package claim.
    totalWeight:trusted.every(p => Number(p.weight)>0) ? Number(trusted.reduce((sum,p,i) => sum + Number(p.weight)*lines[i].quantity,0).toFixed(2)) : null};
}

module.exports = {priceCart, normalizeCart, allocate, policy};
