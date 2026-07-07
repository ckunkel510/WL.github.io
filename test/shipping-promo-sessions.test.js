"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  claimMatchesRequest,
  findPromoClaim,
  normalizePromoClaimInput,
  promoFingerprint,
  storePromoClaim
} = require("../api/shipping-promo-sessions");

test("normalizes a shipping promo claim from ZIP and package weights", () => {
  assert.deepEqual(normalizePromoClaimInput({
    shipTo: { postalCode: "77833-1234" },
    packages: [{ weight: 3.456 }, { weight: "2.2" }]
  }), {
    shipToPostalCode: "77833",
    packageCount: 2,
    totalWeight: 5.66
  });
});

test("promo fingerprint tolerates package count differences with the same total weight", () => {
  const onePackage = promoFingerprint({
    shipTo: { postalCode: "78701" },
    packages: [{ weight: 8 }]
  });
  const twoPackages = promoFingerprint({
    shipTo: { postalCode: "78701" },
    packages: [{ weight: 3 }, { weight: 5 }]
  });
  const otherWeight = promoFingerprint({
    shipTo: { postalCode: "78701" },
    packages: [{ weight: 9 }]
  });

  assert.ok(onePackage);
  assert.equal(onePackage, twoPackages);
  assert.notEqual(onePackage, otherWeight);
});

test("stores and finds a short-lived promo claim by shipping fingerprint", async () => {
  const input = {
    code: "SummerChill26",
    eligible: true,
    cartSignature: "282948:TB-ORIG-G3-TAN:1",
    cart: [{ productId: "282948", productCode: "TB-ORIG-G3-TAN", quantity: 1 }],
    shipTo: { postalCode: "78701" },
    packages: [{ weight: 8 }]
  };

  const stored = await storePromoClaim(input);
  const found = await findPromoClaim({
    shipTo: { postalCode: "78701-0001" },
    packages: [{ weight: 2 }, { weight: 6 }]
  });

  assert.equal(stored.ok, true);
  assert.equal(found.code, "SummerChill26");
  assert.equal(found.eligible, true);
  assert.equal(found.cartSignature, "282948:TB-ORIG-G3-TAN:1");
});

test("matches a stored promo claim when WebTrack sends a slightly different UPS package weight", () => {
  const claim = {
    eligible: true,
    normalized: {
      shipToPostalCode: "78701",
      totalWeight: 10
    }
  };

  assert.equal(claimMatchesRequest(claim, {
    shipTo: { postalCode: "78701" },
    packages: [{ weight: 12 }]
  }), true);

  assert.equal(claimMatchesRequest(claim, {
    shipTo: { postalCode: "78701" },
    packages: [{ weight: 25 }]
  }), false);
});
