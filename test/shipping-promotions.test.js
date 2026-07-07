"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyFreeGroundPromotion,
  cartHasEligibleProduct,
  isEligibleProduct,
  promoCodeMatches,
  promotionApplies
} = require("../api/shipping-promotions");

test("recognizes the SummerChill26 shipping promo code", () => {
  assert.equal(promoCodeMatches("SummerChill26"), true);
  assert.equal(promoCodeMatches("summer chill 26"), true);
  assert.equal(promoCodeMatches("FREESHIP"), false);
});

test("allows Turtlebox and Yukon soft cooler items", () => {
  assert.equal(isEligibleProduct({ productId: "282948" }), true);
  assert.equal(isEligibleProduct({ productCode: "TB-RANG-GRAY" }), true);
  assert.equal(isEligibleProduct({ productId: "308690" }), true);
  assert.equal(isEligibleProduct({ productCode: "YHCP30CHBLK" }), true);
});

test("excludes Yukon hard coolers and drain plugs from the promo", () => {
  assert.equal(isEligibleProduct({ productId: "308779", productCode: "MYC4805" }), false);
  assert.equal(isEligibleProduct({ productId: "308777", productCode: "YHC6522" }), false);
  assert.equal(isEligibleProduct({ productCode: "MYC-DRAIN03" }), false);
});

test("requires both the code and an eligible cart", () => {
  assert.equal(cartHasEligibleProduct([{ productCode: "MGDYC84" }]), true);
  assert.equal(promotionApplies({ code: "SummerChill26", cart: [{ productCode: "MGDYC84" }] }), true);
  assert.equal(promotionApplies({ code: "SummerChill26", cart: [{ productCode: "MYC4805" }] }), false);
  assert.equal(promotionApplies({ code: "WRONG", cart: [{ productCode: "MGDYC84" }] }), false);
});

test("zeros only UPS Ground when the promo applies", () => {
  const { result, promotion } = applyFreeGroundPromotion({
    rates: [
      { serviceCode: "03", serviceName: "UPS Ground", currency: "USD", amount: 18.5, billingWeight: 8 },
      { serviceCode: "02", serviceName: "UPS 2nd Day Air", currency: "USD", amount: 42, billingWeight: 8 }
    ]
  }, {
    code: "SummerChill26",
    cart: [{ productCode: "TB-ORIG-G3-TAN" }]
  });

  assert.equal(promotion.code, "SUMMERCHILL26");
  assert.equal(result.rates[0].amount, 0);
  assert.equal(result.rates[0].originalAmount, 18.5);
  assert.equal(result.rates[1].amount, 42);
  assert.equal(result.promotion.applied, true);
});
