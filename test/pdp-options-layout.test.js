const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("stock data is published without a duplicate bottom stock panel", () => {
  const stock = read("ProductPageStock.js");
  assert.match(stock, /window\.WLPdpStockState/);
  assert.match(stock, /wl:pdp-stock-ready/);
  assert.doesNotMatch(stock, /id=["']stock-widget["']/);
});

test("PDP uses a measured responsive image-options-buy layout", () => {
  const sidebar = read("product-sidebar.js");
  assert.match(sidebar, /id: "product-options-column"/);
  assert.match(sidebar, /wl-has-product-options/);
  assert.match(sidebar, /three_column_options_v2/);
  assert.match(sidebar, /pdp_option_view/);
  assert.match(sidebar, /pdp_option_select/);
  assert.match(sidebar, /#product-options-column[\s\S]*grid-row: 2/);
  assert.match(sidebar, /#product-sidebar,[\s\S]*grid-row: 3/);
});

test("product options publish state, cache safely, and expose analytics hooks", () => {
  const options = read("OptionDropdown.js");
  assert.match(options, /wl_product_options_csv_v2/);
  assert.match(options, /wl:pdp-options-ready/);
  assert.match(options, /data-wl-product-option/);
  assert.match(options, /parseCsv/);
  assert.doesNotMatch(options, /split\(["']\s*,\s*["']\)/);
});

test("analytics runtime accepts PDP option events", () => {
  const analytics = read("wl-site.js");
  assert.match(analytics, /var VERSION = "1\.3\.1"/);
  assert.match(analytics, /pdp_option_view: true/);
  assert.match(analytics, /pdp_option_select: true/);
});
