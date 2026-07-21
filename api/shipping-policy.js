"use strict";

const DEFAULT_MARGIN_FLOOR = 0.15;
const DEFAULT_CARD_FEE_RATE = 0.03;
const DEFAULT_COGS_BUFFER_RATE = 0.02;
const DEFAULT_CONTINGENCY_RATE = 0.01;
const DEFAULT_REDUCED_GROUND = 6.95;

function finiteNumber(value, fallback = NaN) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegative(value, fallback = NaN) {
  const number = finiteNumber(value, fallback);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function rateFromEnv(value, fallback) {
  const number = nonNegative(value, fallback);
  if (!Number.isFinite(number)) return fallback;
  return number > 1 ? number / 100 : number;
}

function money(value) {
  return Math.round((finiteNumber(value, 0) + Number.EPSILON) * 100) / 100;
}

function policyFromEnv(env = process.env) {
  const packaging = nonNegative(env.SHIPPING_PACKAGING_COST_PER_PACKAGE);
  const handling = nonNegative(env.SHIPPING_HANDLING_COST_PER_ORDER);
  const enabled = /^(1|true|yes|on)$/i.test(String(env.SHIPPING_OFFER_ENABLED || ""));
  return {
    enabled,
    offerMode: "all",
    marginFloor: rateFromEnv(env.SHIPPING_MARGIN_FLOOR, DEFAULT_MARGIN_FLOOR),
    cardFeeRate: rateFromEnv(env.SHIPPING_CARD_FEE_RATE, DEFAULT_CARD_FEE_RATE),
    cogsBufferRate: rateFromEnv(env.SHIPPING_COGS_BUFFER_RATE, DEFAULT_COGS_BUFFER_RATE),
    contingencyRate: rateFromEnv(env.SHIPPING_CONTINGENCY_RATE, DEFAULT_CONTINGENCY_RATE),
    reducedGroundAmount: nonNegative(env.SHIPPING_REDUCED_GROUND_AMOUNT, DEFAULT_REDUCED_GROUND),
    packagingCostPerPackage: packaging,
    handlingCostPerOrder: handling,
    configured: enabled && Number.isFinite(packaging) && Number.isFinite(handling)
  };
}

function normalizeLine(line, index) {
  const source = line && typeof line === "object" ? line : {};
  const quantity = Math.trunc(finiteNumber(source.quantity, 0));
  const price = nonNegative(source.price);
  const averageCost = nonNegative(source.averageCost ?? source.cost);
  if (quantity < 1) throw new Error(`Cart line ${index + 1} requires a positive quantity.`);
  if (!Number.isFinite(price) || price <= 0) throw new Error(`Cart line ${index + 1} requires a trusted selling price.`);
  if (!Number.isFinite(averageCost) || averageCost <= 0) throw new Error(`Cart line ${index + 1} requires a trusted average cost.`);
  return { quantity, price, averageCost };
}

function orderEconomics({ lines, groundCost, customerShipping = 0, packageCount, policy }) {
  const settings = policy || policyFromEnv();
  if (!settings.configured) throw new Error("Shipping profitability policy is not fully configured.");
  if (!Array.isArray(lines) || !lines.length) throw new Error("At least one trusted cart line is required.");

  const normalizedLines = lines.map(normalizeLine);
  const ratedGround = nonNegative(groundCost);
  const shippingCollected = nonNegative(customerShipping);
  const cartons = Math.trunc(nonNegative(packageCount, 0));
  if (!Number.isFinite(ratedGround)) throw new Error("A valid UPS Ground cost is required.");
  if (!Number.isFinite(shippingCollected)) throw new Error("A valid customer shipping charge is required.");
  if (cartons < 1) throw new Error("At least one carton is required.");

  const merchandiseRevenue = normalizedLines.reduce(
    (sum, line) => sum + (line.price * line.quantity),
    0
  );
  const rawCogs = normalizedLines.reduce(
    (sum, line) => sum + (line.averageCost * line.quantity),
    0
  );
  const bufferedCogs = rawCogs * (1 + settings.cogsBufferRate);
  const processingFees = (merchandiseRevenue + shippingCollected) * settings.cardFeeRate;
  const contingency = merchandiseRevenue * settings.contingencyRate;
  const fulfillmentCost = settings.handlingCostPerOrder + (cartons * settings.packagingCostPerPackage);
  const contribution = merchandiseRevenue + shippingCollected
    - bufferedCogs
    - processingFees
    - contingency
    - fulfillmentCost
    - ratedGround;
  const margin = merchandiseRevenue > 0 ? contribution / merchandiseRevenue : -Infinity;

  return {
    merchandiseRevenue,
    rawCogs,
    bufferedCogs,
    processingFees,
    contingency,
    fulfillmentCost,
    ratedGround,
    shippingCollected,
    contribution,
    margin
  };
}

function uniqueCandidateAmounts(groundCost, reducedAmount) {
  const ground = money(groundCost);
  const reduced = money(Math.min(ground, reducedAmount));
  return [...new Set([0, reduced, ground])].sort((left, right) => left - right);
}

function modeForAmount(amount, groundCost) {
  if (amount <= 0) return "free";
  if (amount < money(groundCost)) return "reduced";
  return "regular";
}

function evaluateShippingOffer(input) {
  const policy = input.policy || policyFromEnv();
  const groundCost = money(nonNegative(input.groundCost, 0));
  if (!policy.configured || groundCost <= 0) {
    return {
      mode: "regular",
      customerGroundAmount: groundCost,
      groundCost,
      subsidyAmount: 0,
      reviewRequired: false,
      reason: !policy.configured ? "policy-unconfigured" : "ground-rate-unavailable",
      economics: null
    };
  }

  let lastEconomics = null;
  try {
    for (const amount of uniqueCandidateAmounts(groundCost, policy.reducedGroundAmount)) {
      const economics = orderEconomics({
        lines: input.lines,
        groundCost,
        customerShipping: amount,
        packageCount: input.packageCount,
        policy
      });
      lastEconomics = economics;
      if (economics.margin + 1e-12 < policy.marginFloor) continue;
      return {
        mode: modeForAmount(amount, groundCost),
        customerGroundAmount: money(amount),
        groundCost,
        subsidyAmount: money(groundCost - amount),
        reviewRequired: false,
        reason: "margin-protected",
        economics
      };
    }
  } catch (error) {
    return {
      mode: "regular",
      customerGroundAmount: groundCost,
      groundCost,
      subsidyAmount: 0,
      reviewRequired: false,
      reason: "economics-unavailable",
      error,
      economics: null
    };
  }

  return {
    mode: "regular",
    customerGroundAmount: groundCost,
    groundCost,
    subsidyAmount: 0,
    reviewRequired: Boolean(lastEconomics && lastEconomics.margin < policy.marginFloor),
    reason: "full-ground-required",
    economics: lastEconomics
  };
}

function applyShippingOfferToRates(rated, decision, { creditExpedited = false } = {}) {
  if (!rated || !Array.isArray(rated.rates) || !decision) return rated;
  const subsidy = money(Math.max(0, decision.subsidyAmount || 0));
  const rates = rated.rates.map((rate) => {
    const originalAmount = money(rate.amount);
    let amount = originalAmount;
    if (String(rate.serviceCode || "") === "03") {
      amount = money(Math.min(originalAmount, decision.customerGroundAmount));
    } else if (creditExpedited && subsidy > 0) {
      amount = money(Math.max(0, originalAmount - subsidy));
    }
    if (amount === originalAmount) return rate;
    return { ...rate, originalAmount, amount };
  });

  return {
    ...rated,
    rates,
    shippingOffer: {
      applied: subsidy > 0,
      mode: decision.mode,
      serviceCode: "03",
      serviceName: "UPS Ground",
      customerGroundAmount: money(decision.customerGroundAmount),
      originalGroundAmount: money(decision.groundCost),
      subsidyAmount: subsidy
    }
  };
}

module.exports = {
  DEFAULT_CARD_FEE_RATE,
  DEFAULT_COGS_BUFFER_RATE,
  DEFAULT_CONTINGENCY_RATE,
  DEFAULT_MARGIN_FLOOR,
  DEFAULT_REDUCED_GROUND,
  applyShippingOfferToRates,
  evaluateShippingOffer,
  money,
  orderEconomics,
  policyFromEnv,
  uniqueCandidateAmounts
};
