"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluateCartPolicy, parseCompanyInventory, requestedQuantity } = require("../api/cart-policy")._test;

test("sums current clearance inventory across every WebTrack branch", () => {
  const html = `
    <table id="StockDataGrid_ctl00"><tbody>
      <tr><td data-title="Branch">Brenham</td><td data-title="Available">0</td></tr>
      <tr><td data-title="Branch">Lexington</td><td data-title="Available">1</td></tr>
      <tr><td data-title="Branch">Groesbeck</td><td data-title="Available">1</td></tr>
      <tr><td data-title="Branch">Buffalo</td><td data-title="Available">2</td></tr>
    </tbody></table>`;

  assert.equal(parseCompanyInventory(html), 4);
});

test("refuses to guess when WebTrack returns no branch availability", () => {
  assert.throws(() => parseCompanyInventory("<html>temporarily unavailable</html>"), /no branch inventory/i);
});

test("normalizes requested availability quantities conservatively", () => {
  assert.equal(requestedQuantity("3.8"), 4);
  assert.equal(requestedQuantity(0), 1);
  assert.equal(requestedQuantity("not-a-number"), 1);
});

test("confirms a selected-branch shortage silently when companywide stock can fulfill it", async () => {
  const result = await evaluateCartPolicy(
    [{ productCode: "TB-ORIG-G3-TAN", quantity: 1 }],
    { checkAvailability: true },
    {
      getCatalogProducts: async () => ({
        fresh: true,
        products: [{ productId: "282948", productCode: "TB-ORIG-G3-TAN", isClearance: false }]
      }),
      fetchLiveCompanyInventory: async () => 6
    }
  );

  assert.equal(result.availabilityChecked, true);
  assert.equal(result.inventoryVerified, true);
  assert.equal(result.items[0].companyInventory, 6);
  assert.equal(result.items[0].requiresOrdering, false);
});

test("marks a normal item for order-in expectations when companywide stock is short", async () => {
  const result = await evaluateCartPolicy(
    [{ productCode: "NORMAL-100", quantity: 4 }],
    { checkAvailability: true },
    {
      getCatalogProducts: async () => ({
        fresh: true,
        products: [{ productId: "100", productCode: "NORMAL-100", isClearance: false }]
      }),
      fetchLiveCompanyInventory: async () => 2
    }
  );

  assert.equal(result.items[0].companyInventory, 2);
  assert.equal(result.items[0].requiresOrdering, true);
  assert.equal(result.items[0].maxQuantity, null);
});

test("keeps live companywide clearance inventory as a hard maximum", async () => {
  const result = await evaluateCartPolicy(
    [{ productCode: "CLEAR-100", quantity: 3 }],
    { checkAvailability: true },
    {
      getCatalogProducts: async () => ({
        fresh: true,
        products: [{ productId: "100", productCode: "CLEAR-100", isClearance: true }]
      }),
      fetchLiveCompanyInventory: async () => 2
    }
  );

  assert.equal(result.items[0].isClearance, true);
  assert.equal(result.items[0].maxQuantity, 2);
  assert.equal(result.items[0].requiresOrdering, true);
});

test("does not claim availability when a live companywide lookup fails", async () => {
  const result = await evaluateCartPolicy(
    [{ productCode: "NORMAL-100", quantity: 1 }],
    { checkAvailability: true },
    {
      getCatalogProducts: async () => ({
        fresh: true,
        products: [{ productId: "100", productCode: "NORMAL-100", isClearance: false }]
      }),
      fetchLiveCompanyInventory: async () => { throw new Error("unavailable"); }
    }
  );

  assert.equal(result.inventoryVerified, false);
  assert.equal(result.items[0].inventoryVerified, false);
  assert.equal(result.items[0].requiresOrdering, null);
});
