"use strict";

const FREE_GROUND_PROMO = {
  code: "SUMMERCHILL26",
  displayCode: "SummerChill26",
  serviceCode: "03",
  serviceName: "UPS Ground",
  label: "Shipping promo"
};

const ELIGIBLE_PRODUCTS = [
  { productId: "282948", productCode: "TB-ORIG-G3-TAN" },
  { productId: "282954", productCode: "TB-RANG-GRAY" },
  { productId: "282951", productCode: "TB-ORIG-G3-GRAY" },
  { productId: "282949", productCode: "TB-ORIG-G3-WHT" },
  { productId: "282952", productCode: "TB-ORIG-G3-ORG" },
  { productId: "282955", productCode: "TB-RANG-IVR" },
  { productId: "287776", productCode: "TB-ORIG-G3-BURNTORANGE" },
  { productId: "282953", productCode: "TB-RANG-TAN" },
  { productId: "287775", productCode: "TB-ORIG-G3-MAROON" },
  { productId: "290262", productCode: "TB-RANG-DELTA" },
  { productId: "283538", productCode: "TB-GRAN-G1-TAN" },
  { productId: "308684", productCode: "MGDYC84" },
  { productId: "308690", productCode: "MGSSC801NB" },
  { productId: "308682", productCode: "YHCP30YVC" },
  { productId: "308679", productCode: "YHCP30CHBLK" },
  { productId: "308685", productCode: "MGDYC85" },
  { productId: "308691", productCode: "MGSSC80183" },
  { productId: "308680", productCode: "YHCP30GVG" },
  { productId: "308686", productCode: "MGDYC8YVC" },
  { productId: "308689", productCode: "MGSSC801GE" },
  { productId: "308683", productCode: "YHCP30GG" },
  { productId: "308692", productCode: "MGSSC801YVC" },
  { productId: "308681", productCode: "YHCP30XK7" }
];

const EXCLUDED_PRODUCTS = [
  { productId: "308779", productCode: "MYC4805" },
  { productId: "308782", productCode: "MYC4803" },
  { productId: "308777", productCode: "YHC6522" },
  { productId: "308783", productCode: "YDP101" },
  { productId: "308780", productCode: "MYC4801" },
  { productId: "308778", productCode: "YHC6524" },
  { productId: "308735", productCode: "YHC6523" },
  { productId: "308781", productCode: "MYC4802" },
  { productId: "308784", productCode: "MYC-DRAIN03" }
];

const eligibleIds = new Set(ELIGIBLE_PRODUCTS.map((item) => item.productId));
const eligibleCodes = new Set(ELIGIBLE_PRODUCTS.map((item) => normalizeProductCode(item.productCode)));
const excludedIds = new Set(EXCLUDED_PRODUCTS.map((item) => item.productId));
const excludedCodes = new Set(EXCLUDED_PRODUCTS.map((item) => normalizeProductCode(item.productCode)));

function normalizePromoCode(value) {
  return String(value || "").replace(/[\s-]+/g, "").trim().toUpperCase();
}

function normalizeProductCode(value) {
  return String(value || "").replace(/\s+/g, "").trim().toUpperCase();
}

function productRef(item) {
  const source = item && typeof item === "object" ? item : {};
  return {
    productId: String(source.productId || source.ProductID || source.pid || source.id || "").trim(),
    productCode: normalizeProductCode(source.productCode || source.ProductCode || source.code || source.PCode || source.sku || "")
  };
}

function isExcludedProduct(item) {
  const ref = productRef(item);
  return (!!ref.productId && excludedIds.has(ref.productId)) || (!!ref.productCode && excludedCodes.has(ref.productCode));
}

function isEligibleProduct(item) {
  const ref = productRef(item);
  if (isExcludedProduct(ref)) return false;
  return (!!ref.productId && eligibleIds.has(ref.productId)) || (!!ref.productCode && eligibleCodes.has(ref.productCode));
}

function cartHasEligibleProduct(items) {
  return Array.isArray(items) && items.some(isEligibleProduct);
}

function promoCodeMatches(value) {
  return normalizePromoCode(value) === FREE_GROUND_PROMO.code;
}

function promotionApplies(input) {
  const source = input && typeof input === "object" ? input : {};
  if (!promoCodeMatches(source.code || source.promoCode || source.couponCode)) return false;
  if (source.eligible === true || source.cartEligible === true || source.promoEligible === true) return true;
  return cartHasEligibleProduct(source.cart || source.items || source.products || []);
}

function applyFreeGroundPromotion(result, input) {
  if (!result || !Array.isArray(result.rates) || !promotionApplies(input)) {
    return { result, promotion: null };
  }

  let applied = false;
  const rates = result.rates.map((rate) => {
    if (String(rate.serviceCode || "") !== FREE_GROUND_PROMO.serviceCode) return rate;
    applied = true;
    return {
      ...rate,
      originalAmount: Number(rate.amount),
      amount: 0,
      promotion: {
        code: FREE_GROUND_PROMO.displayCode,
        label: FREE_GROUND_PROMO.label,
        serviceCode: FREE_GROUND_PROMO.serviceCode
      }
    };
  });

  if (!applied) return { result, promotion: null };
  return {
    result: {
      ...result,
      rates,
      promotion: {
        applied: true,
        code: FREE_GROUND_PROMO.displayCode,
        label: FREE_GROUND_PROMO.label,
        serviceCode: FREE_GROUND_PROMO.serviceCode,
        serviceName: FREE_GROUND_PROMO.serviceName
      }
    },
    promotion: FREE_GROUND_PROMO
  };
}

module.exports = {
  FREE_GROUND_PROMO,
  ELIGIBLE_PRODUCTS,
  EXCLUDED_PRODUCTS,
  applyFreeGroundPromotion,
  cartHasEligibleProduct,
  isEligibleProduct,
  normalizeProductCode,
  normalizePromoCode,
  productRef,
  promoCodeMatches,
  promotionApplies
};
