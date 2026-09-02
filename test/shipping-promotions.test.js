"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyGroundPromotion,
  cartHasEligibleProduct,
  isEligibleProduct,
  promoCodeMatches,
  promotionActive,
  promotionApplies
} = require("../api/shipping-promotions");

const ACTIVE_PROMO_TIME = Date.parse("2026-08-31T12:00:00-05:00");
const EXPIRED_PROMO_TIME = Date.parse("2026-09-02T12:00:00-05:00");

test("recognizes SummerChill26 only during its advertised campaign", () => {
  assert.equal(promoCodeMatches("SummerChill26", ACTIVE_PROMO_TIME), true);
  assert.equal(promoCodeMatches("summer chill 26", ACTIVE_PROMO_TIME), true);
  assert.equal(promoCodeMatches("FREESHIP", ACTIVE_PROMO_TIME), false);
  assert.equal(promoCodeMatches("SummerChill26", EXPIRED_PROMO_TIME), false);
  assert.equal(promotionActive(EXPIRED_PROMO_TIME), false);
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
  assert.equal(promotionApplies({ code: "SummerChill26", cart: [{ productCode: "MGDYC84" }], now: ACTIVE_PROMO_TIME }), true);
  assert.equal(promotionApplies({ code: "SummerChill26", cart: [{ productCode: "MYC4805" }], now: ACTIVE_PROMO_TIME }), false);
  assert.equal(promotionApplies({ code: "WRONG", cart: [{ productCode: "MGDYC84" }], now: ACTIVE_PROMO_TIME }), false);
  assert.equal(promotionApplies({ code: "SummerChill26", cart: [{ productCode: "MGDYC84" }], now: EXPIRED_PROMO_TIME }), false);
});

test("never reduces promotional UPS Ground below $9.95", () => {
  const { result, promotion } = applyGroundPromotion({
    rates: [
      { serviceCode: "03", serviceName: "UPS Ground", currency: "USD", amount: 18.5, billingWeight: 8 },
      { serviceCode: "02", serviceName: "UPS 2nd Day Air", currency: "USD", amount: 42, billingWeight: 8 }
    ]
  }, {
    code: "SummerChill26",
    cart: [{ productCode: "TB-ORIG-G3-TAN" }],
    now: ACTIVE_PROMO_TIME
  });

  assert.equal(promotion.code, "SUMMERCHILL26");
  assert.equal(result.rates[0].amount, 9.95);
  assert.equal(result.rates[0].originalAmount, 18.5);
  assert.equal(result.rates[1].amount, 42);
  assert.equal(result.promotion.applied, true);
});
