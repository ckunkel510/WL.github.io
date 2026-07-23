const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const assist = require(path.join(root, "tawk-commerce-assist.js"));

test("header loads the tawk commerce bridge from the Woodson-hosted runtime", () => {
  const header = fs.readFileSync(path.join(root, "headermodern.js"), "utf8");
  assert.match(header, /WL\.github\.io\/tawk-commerce-assist\.js\?v=20260723-2/);
  assert.match(header, /data-wl-tawk-commerce-assist/);
});

test("reads current tawk message-object and legacy string payloads", () => {
  assert.equal(assist.messageText("hello"), "hello");
  assert.equal(assist.messageText({ message: "new payload" }), "new payload");
  assert.equal(assist.messageText({ msg: "webhook-style payload" }), "webhook-style payload");
});

test("detects explicit product-view and add-to-cart requests", () => {
  assert.deepEqual(assist.detectIntent("Please open that product page for me."), {
    action: "view_product",
    quantity: 0
  });
  assert.deepEqual(assist.detectIntent("Add two of those products to my cart."), {
    action: "add_to_cart",
    quantity: 2
  });
  assert.deepEqual(assist.detectIntent("I would like to purchase it."), {
    action: "add_to_cart",
    quantity: 1
  });
});

test("sends checkout or order-submission language to the cart without adding an item", () => {
  assert.deepEqual(assist.detectIntent("Please place the order for that item."), {
    action: "view_cart",
    quantity: 0
  });
  assert.deepEqual(assist.detectIntent("Can you complete my purchase and check out?"), {
    action: "view_cart",
    quantity: 0
  });
  assert.equal(assist.detectIntent("Don't add that to my cart."), null);
});

test("requires exactly valid Woodson product-detail links", () => {
  const one = assist.productLinksFromMessage({
    message: "Try [this drill](https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=221283)."
  });
  assert.deepEqual(one, [{
    pid: "221283",
    url: "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=221283"
  }]);

  assert.deepEqual(
    assist.productLinksFromMessage("https://evil.example/ProductDetail.aspx?pid=221283"),
    []
  );
  assert.deepEqual(
    assist.productLinksFromMessage("https://webtrack.woodsonlumber.com/Products.aspx?pg=24"),
    []
  );
});

test("understands both WebTrack postback formats used by add-to-cart controls", () => {
  assert.equal(
    assist.extractPostbackTarget("javascript:__doPostBack('ctl00$PageBody$AddProductButton','')"),
    "ctl00$PageBody$AddProductButton"
  );
  assert.equal(
    assist.extractPostbackTarget(
      'javascript:WebForm_DoPostBackWithOptions(new WebForm_PostBackOptions("ctl00$PageBody$productDetail$ctl00$AddProductButton", "", true, "", "", false, true))'
    ),
    "ctl00$PageBody$productDetail$ctl00$AddProductButton"
  );
});

test("remembers one verified product for safe pronoun follow-ups", () => {
  const values = new Map();
  const win = {
    sessionStorage: {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      removeItem(key) { values.delete(key); },
      setItem(key, value) { values.set(key, String(value)); }
    }
  };
  const product = {
    pid: "345",
    url: "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=345"
  };
  assist.rememberProduct(win, product);
  assert.deepEqual(assist.readFreshProduct(win), product);
});

test("runtime has no checkout or order-submission controls", () => {
  const runtime = fs.readFileSync(path.join(root, "tawk-commerce-assist.js"), "utf8");
  assert.doesNotMatch(runtime, /CompleteCheckoutButton|PlaceOrderButton|customCheckoutBtn|HTMLFormElement\.prototype\.submit/);
  assert.match(runtime, /No order was placed/);
});
