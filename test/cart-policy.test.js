"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseCompanyInventory } = require("../api/cart-policy")._test;

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
