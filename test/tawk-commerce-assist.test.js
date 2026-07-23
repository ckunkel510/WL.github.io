const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const assist = require(path.join(root, "tawk-commerce-assist.js"));

test("header loads the tawk commerce bridge from the Woodson-hosted runtime", () => {
  const header = fs.readFileSync(path.join(root, "headermodern.js"), "utf8");
  assert.match(header, /WL\.github\.io\/wl-chat\.js\?v=20260723-5/);
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

test("uses remembered products only for true pronoun follow-ups", () => {
  assert.equal(assist.canUseRememberedProduct("Add it to my cart."), true);
  assert.equal(assist.canUseRememberedProduct("Please add two of them to my cart."), true);
  assert.equal(assist.canUseRememberedProduct("I would like to purchase this one."), true);
  assert.equal(assist.canUseRememberedProduct("Add Milwaukee product 2904-22 to my cart."), false);
  assert.equal(assist.canUseRememberedProduct("Add the black electrical tape to my cart."), false);
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

test("does not invent an add-to-cart control when a product cannot be added directly", () => {
  const emptyDocument = {
    querySelectorAll() { return []; }
  };
  assert.equal(assist.findAddToCartControl(emptyDocument), null);
  assert.equal(assist.findAddToCartTarget(emptyDocument), "");
});

test("posts named WebTrack add buttons using their submitted name and value", () => {
  const control = {
    disabled: false,
    id: "",
    name: "ctl00$PageBody$AddProductButton",
    textContent: "Add to Cart",
    value: "Add to Cart",
    getAttribute(name) {
      if (name === "aria-disabled") return "false";
      if (name === "href") return "";
      return "";
    }
  };
  const doc = {
    querySelectorAll(selector) {
      return selector === 'button[name*="AddProductButton"]' ? [control] : [];
    }
  };

  assert.deepEqual(assist.findAddToCartControl(doc), {
    target: "",
    buttonName: "ctl00$PageBody$AddProductButton",
    buttonValue: "Add to Cart"
  });
});

test("verifies the exact product and quantity from the cart before claiming success", () => {
  const quantityControl = { value: "2" };
  const container = {
    parentElement: null,
    querySelector() { return quantityControl; }
  };
  const link = {
    parentElement: container,
    getAttribute(name) {
      return name === "href"
        ? "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pg=186&pid=345"
        : "";
    },
    querySelector() { return null; }
  };
  const doc = {
    querySelectorAll() { return [link]; }
  };

  assert.deepEqual(assist.cartStateFromDocument(doc, "345"), {
    present: true,
    quantity: 2
  });
  assert.deepEqual(assist.cartStateFromDocument(doc, "999"), {
    present: false,
    quantity: 0
  });
});

test("adds two different products sequentially without reusing the first product state", async () => {
  const cart = new Map();
  const makeCartDocument = () => ({
    querySelectorAll() {
      return Array.from(cart.entries()).map(([pid, quantity]) => {
        const container = {
          parentElement: null,
          querySelector() { return { value: String(quantity) }; }
        };
        return {
          parentElement: container,
          getAttribute(name) {
            return name === "href"
              ? `https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=${pid}`
              : "";
          },
          querySelector() { return null; }
        };
      });
    }
  });
  const makeProductDocument = (pid) => {
    const control = {
      disabled: false,
      id: "",
      name: "ctl00$PageBody$AddProductButton",
      textContent: "Add to Cart",
      value: "Add to Cart",
      getAttribute(name) {
        if (name === "aria-disabled") return "false";
        return "";
      }
    };
    return {
      querySelectorAll(selector) {
        if (selector === 'input[type="hidden"]') return [];
        if (selector === 'button[name*="AddProductButton"]') return [control];
        return [];
      },
      querySelector(selector) {
        if (selector === 'input[name*="Quantity"]') {
          return { name: "ctl00$PageBody$Quantity", value: "1" };
        }
        if (selector === "form") {
          return { getAttribute() { return `/ProductDetail.aspx?pid=${pid}`; } };
        }
        if (selector === "h1") return { textContent: `Product ${pid}` };
        return null;
      }
    };
  };
  let postedPid = "";
  const win = {
    location: { origin: "https://webtrack.woodsonlumber.com" },
    FormData,
    DOMParser: class {
      parseFromString(value) {
        return value.startsWith("product:")
          ? makeProductDocument(value.slice("product:".length))
          : makeCartDocument();
      }
    },
    async fetch(url, options = {}) {
      const parsed = new URL(url, "https://webtrack.woodsonlumber.com");
      if (parsed.pathname === "/ShoppingCart.aspx") {
        return { ok: true, async text() { return "cart"; } };
      }
      const pid = parsed.searchParams.get("pid");
      if (options.method === "POST") {
        postedPid = pid;
        cart.set(pid, (cart.get(pid) || 0) + 1);
        return { ok: true };
      }
      return { ok: true, async text() { return `product:${pid}`; } };
    }
  };

  await assist.addPidToCart(win, "101", 1);
  assert.equal(postedPid, "101");
  await assist.addPidToCart(win, "202", 1);
  assert.equal(postedPid, "202");
  assert.deepEqual(Object.fromEntries(cart), { 101: 1, 202: 1 });
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

test("builds a clickable preview only from the matching Woodson product and image host", () => {
  const product = {
    pid: "221283",
    url: "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=221283"
  };
  const preview = assist.productPreviewFromResponse({
    results: [{
      productCode: "2904-22",
      title: "Milwaukee M18 Fuel Hammer Drill Kit",
      price: "$319.99",
      productUrl: "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=221283",
      imageUrl: "https://images-woodsonlumber.sirv.com/221283.jpg"
    }]
  }, product);

  assert.deepEqual(preview, {
    pid: "221283",
    productUrl: "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=221283",
    imageUrl: "https://images-woodsonlumber.sirv.com/221283.jpg",
    productCode: "2904-22",
    title: "Milwaukee M18 Fuel Hammer Drill Kit",
    price: "$319.99"
  });
  assert.equal(assist.safeImageUrl("https://evil.example/221283.jpg"), "");
  assert.equal(assist.productPreviewFromResponse({
    results: [{
      productUrl: "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=999",
      imageUrl: "https://images-woodsonlumber.sirv.com/999.jpg"
    }]
  }, product), null);
});

test("runtime has no checkout or order-submission controls", () => {
  const runtime = fs.readFileSync(path.join(root, "wl-chat.js"), "utf8");
  assert.doesNotMatch(runtime, /CompleteCheckoutButton|PlaceOrderButton|customCheckoutBtn|HTMLFormElement\.prototype\.submit/);
  assert.match(runtime, /No order was placed/);
  assert.match(runtime, /WebTrack did not confirm/);
  assert.match(runtime, /Best product match/);
});
