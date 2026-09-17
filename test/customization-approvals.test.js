"use strict";

process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  APPROVAL_TTL_SECONDS,
  findCustomizationApproval,
  resetMemoryApprovals,
  storeCustomizationApproval
} = require("../api/customization-approvals");
const approvalHandler = require("../api/customization-approval");

function approvedCart(overrides = {}) {
  return [{
    productId: "10496",
    productCode: "HM38V",
    quantity: 2,
    cutToShip: {
      optionId: "custom-boxable-cuts",
      cutLengthsIn: [48, 48, 24, 24],
      acknowledgedNonRefundable: true
    },
    ...overrides
  }];
}

test.beforeEach(() => resetMemoryApprovals());

test("records a server-timestamped customization receipt for one year", async () => {
  const record = await storeCustomizationApproval({
    webTrackUserId: "ckunkel2",
    cart: approvedCart()
  });
  const found = await findCustomizationApproval(record.approvalId);

  assert.match(record.approvalId, /^CTA-\d{8}-[A-F0-9]{16}$/);
  assert.equal(record.webTrackUserId, "ckunkel2");
  assert.equal(record.identitySource, "webtrack-account-page");
  assert.equal(record.policyVersion, "2026-09-17-custom-cuts-1");
  assert.equal(record.selections[0].productId, "10496");
  assert.deepEqual(record.selections[0].cutLengthsIn, [48, 48, 24, 24]);
  assert.equal(record.addedCharge, 20);
  assert.equal(record.customerAffirmation.merchandiseAndAddedFeesNonRefundable, true);
  assert.equal(found.approvalId, record.approvalId);
  assert.equal(APPROVAL_TTL_SECONDS, 365 * 24 * 60 * 60);
  assert.ok(Date.parse(record.approvedAt) <= Date.now());
  assert.ok(Date.parse(record.expiresAt) > Date.now() + (364 * 24 * 60 * 60 * 1000));
});

test("will not issue a receipt without the explicit non-refundable acknowledgment", async () => {
  const cart = approvedCart();
  cart[0].cutToShip.acknowledgedNonRefundable = false;
  await assert.rejects(
    storeCustomizationApproval({ webTrackUserId: "ckunkel2", cart }),
    (error) => {
      assert.equal(error.code, "invalid-cut-to-ship-selection");
      assert.equal(error.shippingIssues[0].reason, "cut-terms-required");
      return true;
    }
  );
});

test("receipt fingerprint changes with quantity or cut pattern", async () => {
  const first = await storeCustomizationApproval({ webTrackUserId: "ckunkel2", cart: approvedCart() });
  const second = await storeCustomizationApproval({
    webTrackUserId: "ckunkel2",
    cart: approvedCart({ quantity: 3 })
  });
  assert.notEqual(first.selectionKey, second.selectionKey);
  assert.equal(second.addedCharge, 30);
});

test("approval endpoint returns a CORS-safe receipt and rejects unchecked terms", async () => {
  function response() {
    return {
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      end(body) { this.body = body; }
    };
  }
  const validResponse = response();
  await approvalHandler({
    method: "POST",
    headers: { origin: "https://webtrack.woodsonlumber.com", "x-forwarded-for": "127.0.0.2" },
    body: { webTrackUserId: "ckunkel2", cart: approvedCart() },
    socket: {}
  }, validResponse);
  assert.equal(validResponse.statusCode, 200);
  assert.equal(validResponse.headers["Access-Control-Allow-Origin"], "https://webtrack.woodsonlumber.com");
  assert.equal(JSON.parse(validResponse.body).approval.webTrackUserId, "ckunkel2");

  const invalidCart = approvedCart();
  invalidCart[0].cutToShip.acknowledgedNonRefundable = false;
  const invalidResponse = response();
  await approvalHandler({
    method: "POST",
    headers: { origin: "https://webtrack.woodsonlumber.com", "x-forwarded-for": "127.0.0.3" },
    body: { webTrackUserId: "ckunkel2", cart: invalidCart },
    socket: {}
  }, invalidResponse);
  assert.equal(invalidResponse.statusCode, 400);
  assert.equal(JSON.parse(invalidResponse.body).shippingIssues[0].reason, "cut-terms-required");
});
