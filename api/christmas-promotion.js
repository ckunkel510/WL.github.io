'use strict';

const catalog = require('../data/christmas-shop-2026.json');
const CODE = 'MERRY100';
const START = Date.parse('2026-11-13T00:00:00-06:00');
const END_AT = '2026-12-06T00:00:00-06:00';
const END = Date.parse(END_AT);
const MINIMUM_CENTS = 10000;
const ids = new Set(catalog.products.map(p => p.productId));
const codes = new Set(catalog.products.map(p => p.productCode.toUpperCase()));

function active(now = Date.now()) { return Number.isFinite(now) && now >= START && now < END; }
function normalizeCode(value) { return String(value || '').trim().toUpperCase(); }
function eligibleProduct(line) {
  const id = String(line?.productId || '');
  return id ? ids.has(id) : codes.has(String(line?.productCode || '').trim().toUpperCase());
}

// Server catalog membership/prices are authoritative. A native net line total
// can reduce the qualifying spend for customer pricing/discounts, never inflate it.
function evaluate(code, cart, trustedLines, now = Date.now()) {
  const base = { code: CODE, minimumCents: MINIMUM_CENTS, eligibleSubtotalCents: 0, expiresAt: END_AT, applied: false };
  if (!normalizeCode(code)) return { ...base, reason: 'not-entered' };
  if (normalizeCode(code) !== CODE) return { ...base, reason: 'unrecognized' };
  if (!active(now)) return { ...base, reason: 'expired' };
  if (!Array.isArray(cart) || !cart.length || !Array.isArray(trustedLines) || cart.length !== trustedLines.length) return { ...base, reason: 'unverified-cart' };
  let subtotal = 0;
  const seen = new Set();
  for (let i = 0; i < trustedLines.length; i++) {
    const line = trustedLines[i];
    if (!eligibleProduct(line)) continue;
    const quantity = Number(line.quantity);
    const price = Number(line.unitPriceCents);
    const nativeTotal = Number(cart[i]?.netLineTotalCents);
    if (String(cart[i]?.productId || '') !== String(line.productId) || seen.has(line.productId) ||
        !Number.isSafeInteger(quantity) || quantity < 1 ||
        !Number.isSafeInteger(price) || price < 0 ||
        cart[i]?.netLineTotalCents == null || !Number.isSafeInteger(nativeTotal) || nativeTotal < 0) return { ...base, reason: 'unverified-cart' };
    seen.add(line.productId);
    subtotal += Math.min(price * quantity, nativeTotal);
  }
  return { ...base, eligibleSubtotalCents: subtotal, applied: subtotal >= MINIMUM_CENTS,
    reason: subtotal >= MINIMUM_CENTS ? 'qualified' : 'minimum-not-met' };
}

function apply(rates, decision, addedCharge = 0, now = Date.now()) {
  if (!decision?.applied || !active(now)) return rates;
  const processing = Math.max(0, Math.round(Number(addedCharge || 0) * 100) / 100);
  return rates.map(rate => String(rate.serviceCode) === '03' ? {
    ...rate, originalAmount: Number(rate.amount), amount: processing,
    promotion: { ...decision, verified: true, groundWaived: true, processingCharge: processing }
  } : rate);
}

// Only rates produced by the validated server-side quote path receive this
// marker. API inputs cannot submit rates or set this marker on stored claims.
function promotionalRate(rate, now = Date.now()) {
  const p = rate?.promotion;
  return active(now) && String(rate?.serviceCode) === '03' && p?.code === CODE &&
    p.verified === true && p.applied === true && p.groundWaived === true &&
    p.expiresAt === END_AT && p.eligibleSubtotalCents >= MINIMUM_CENTS &&
    Number.isFinite(Number(rate.amount)) && Number(rate.amount) >= 0 &&
    Number(rate.amount) === Number(p.processingCharge || 0);
}

module.exports = { CODE, END_AT, MINIMUM_CENTS, active, normalizeCode, eligibleProduct, evaluate, apply, promotionalRate };
