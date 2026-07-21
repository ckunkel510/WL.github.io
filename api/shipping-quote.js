"use strict";

const { cartonizeCandidates } = require("./cartonizer");
const { getCatalogProducts } = require("./shipping-catalog");
const {
  applyShippingOfferToRates,
  evaluateShippingOffer,
  policyFromEnv
} = require("./shipping-policy");

function cleanText(value, maxLength = 80) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function quantity(value) {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function publicPackages(plan) {
  return plan.packages.map((item) => ({
    weight: item.weight,
    length: item.length,
    width: item.width,
    height: item.height
  }));
}

function groundRate(result) {
  return result?.rates?.find((rate) => String(rate.serviceCode || "") === "03") || null;
}

function trustedCartLines(cart, products) {
  if (!Array.isArray(cart) || !cart.length || cart.length > 50) throw new Error("The cart is unavailable for automatic shipping offers.");
  if (!Array.isArray(products) || products.length !== cart.length) throw new Error("The trusted product catalog is incomplete.");
  let totalQuantity = 0;
  const lines = cart.map((item, index) => {
    const product = products[index];
    const lineQuantity = quantity(item?.quantity);
    totalQuantity += lineQuantity;
    if (!product || !lineQuantity) throw new Error("The trusted product catalog is incomplete.");
    return {
      productId: cleanText(product.productId || item.productId || item.id, 40),
      productCode: cleanText(product.productCode || item.productCode || item.code, 80),
      brand: cleanText(product.brand, 80),
      quantity: lineQuantity,
      price: product.price,
      averageCost: product.averageCost,
      weight: product.weight,
      length: product.length,
      width: product.width,
      height: product.height
    };
  });
  if (!totalQuantity || totalQuantity > 2000) throw new Error("The cart quantity is outside the automatic shipping limit.");
  return lines;
}

async function buildAutomaticShippingQuote(body, dependencies = {}) {
  const requestRates = dependencies.requestRates;
  if (typeof requestRates !== "function") throw new Error("UPS rating is unavailable.");
  const policy = dependencies.policy || policyFromEnv();
  const cart = Array.isArray(body?.cart) ? body.cart : Array.isArray(body?.items) ? body.items : [];
  const catalog = await (dependencies.getCatalogProducts || getCatalogProducts)(cart);
  if (!catalog?.fresh) throw new Error("The trusted product catalog is not current.");
  const lines = trustedCartLines(cart, catalog.products);
  const plans = (dependencies.cartonizeCandidates || cartonizeCandidates)(lines, dependencies.cartonizerOptions);
  if (!plans.length) throw new Error("The cart could not be packed for UPS shipping.");

  const ratedPlans = [];
  for (const plan of plans.slice(0, 3)) {
    const packages = publicPackages(plan);
    const rated = await requestRates({
      shipFrom: body.shipFrom,
      shipTo: body.shipTo,
      packages
    });
    const ground = groundRate(rated);
    if (!ground || !Number.isFinite(Number(ground.amount))) continue;
    ratedPlans.push({ plan, packages, rated, groundCost: Number(ground.amount) });
  }
  if (!ratedPlans.length) throw new Error("UPS Ground is unavailable for the packed cart.");
  ratedPlans.sort((left, right) => left.groundCost - right.groundCost || left.plan.packageCount - right.plan.packageCount);
  const selected = ratedPlans[0];
  const decision = evaluateShippingOffer({
    lines,
    groundCost: selected.groundCost,
    packageCount: selected.plan.packageCount,
    policy
  });
  const result = applyShippingOfferToRates(selected.rated, decision, { creditExpedited: false });
  const merchandiseRevenue = lines.reduce((sum, line) => sum + (Number(line.price) * line.quantity), 0);
  const rawCogs = lines.reduce((sum, line) => sum + (Number(line.averageCost) * line.quantity), 0);
  const productWeight = lines.reduce((sum, line) => sum + (Number(line.weight) * line.quantity), 0);

  return {
    result: {
      ...result,
      packagePlan: {
        packageCount: selected.plan.packageCount,
        totalWeight: selected.plan.totalWeight
      }
    },
    claim: {
      catalogId: catalog.active?.id || "",
      packages: selected.packages,
      productWeight,
      basis: {
        merchandiseRevenue,
        rawCogs,
        packageCount: selected.plan.packageCount,
        productRefs: lines.map((line) => ({
          productId: line.productId,
          productCode: line.productCode,
          quantity: line.quantity
        }))
      },
      policy: {
        enabled: policy.enabled !== false,
        offerMode: "all",
        marginFloor: policy.marginFloor,
        cardFeeRate: policy.cardFeeRate,
        cogsBufferRate: policy.cogsBufferRate,
        contingencyRate: policy.contingencyRate,
        reducedGroundAmount: policy.reducedGroundAmount,
        packagingCostPerPackage: policy.packagingCostPerPackage,
        handlingCostPerOrder: policy.handlingCostPerOrder,
        configured: policy.configured
      },
      decision: {
        mode: decision.mode,
        customerGroundAmount: decision.customerGroundAmount,
        groundCost: decision.groundCost,
        subsidyAmount: decision.subsidyAmount,
        reviewRequired: decision.reviewRequired === true,
        protectedMargin: Number.isFinite(decision.economics?.margin) ? decision.economics.margin : null
      }
    }
  };
}

module.exports = {
  buildAutomaticShippingQuote,
  groundRate,
  publicPackages,
  trustedCartLines
};
