"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function source(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

function extractedFunction(fileSource, name, dependencies) {
  let start = fileSource.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} should exist`);
  const asyncStart = fileSource.lastIndexOf("async ", start);
  if (asyncStart >= 0 && fileSource.slice(asyncStart + 6, start) === "") start = asyncStart;
  const bodyStart = fileSource.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < fileSource.length; index += 1) {
    if (fileSource[index] === "{") depth += 1;
    if (fileSource[index] !== "}") continue;
    depth -= 1;
    if (depth === 0) {
      const fnSource = fileSource.slice(start, index + 1);
      const names = Object.keys(dependencies || {});
      const values = names.map((key) => dependencies[key]);
      return Function(...names, `return (${fnSource});`)(...values);
    }
  }
  throw new Error(`Could not extract ${name}`);
}

test("cart quantity controls load the trusted companywide clearance limit", () => {
  const cart = source("ShoppingCartRow.js");
  assert.match(cart, /api\/cart-policy/);
  assert.match(cart, /companyClearanceQty/);
  assert.match(cart, /Clearance item:.*available companywide/);
  assert.match(cart, /inventory could not be confirmed/i);
});

test("saved for later does not create account-only quicklists for guest carts", () => {
  const savedForLater = source("SavedForLater.js");
  const hasCartDetailView = extractedFunction(savedForLater, "hasCartDetailView");
  const hasSignedInAccount = extractedFunction(savedForLater, "hasSignedInAccount");
  const root = (href) => ({
    querySelectorAll: () => [{ getAttribute: () => href }]
  });

  assert.equal(hasCartDetailView({ querySelector: () => null }), false);
  assert.equal(hasCartDetailView({ querySelector: () => ({}) }), true);
  assert.equal(hasSignedInAccount(root("SignIn.aspx")), false);
  assert.equal(hasSignedInAccount(root("SignIn.aspx?SignOut=1")), true);
  assert.match(savedForLater, /Skipping Saved For Later outside the cart detail view/);
  assert.match(savedForLater, /Skipping Saved For Later for a signed-out cart/);
});

test("cart preserves its clearance policy when the shared script runs on checkout", () => {
  const cart = source("ShoppingCartRow.js");
  const loaderIndex = cart.indexOf("async function wlLoadCartPolicy");
  const noRowsIndex = cart.indexOf("if (!refs.length)", loaderIndex);
  const clearIndex = cart.indexOf("sessionStorage.removeItem(WL_CLEARANCE_POLICY_KEY)", loaderIndex);
  assert.ok(loaderIndex >= 0);
  assert.ok(noRowsIndex > loaderIndex);
  assert.ok(clearIndex > noRowsIndex);
});

test("checkout resolves branch shortages against companywide stock before continuing", () => {
  const checkout = source("Checkout2.js");
  const lookupIndex = checkout.indexOf("fetchCompanyAvailability(refs)");
  const autoYesIndex = checkout.indexOf("triggerStockYes(modal, message)", lookupIndex);
  assert.ok(lookupIndex >= 0);
  assert.ok(autoYesIndex > lookupIndex);
  assert.match(checkout, /checkAvailability:\s*true/);
  assert.match(checkout, /7 days or longer/);
  assert.match(checkout, /pickup, Woodson delivery, or UPS shipment/);
  assert.match(checkout, /wl-clearance-stock-block/);
  assert.match(checkout, /Update a clearance quantity/);
});

test("checkout hides local delivery for an address outside Texas", () => {
  const checkout = source("Checkout2.js");
  const outsideStart = checkout.indexOf('if (region === "outside")');
  const texasStart = checkout.indexOf('} else if (region === "texas")', outsideStart);
  const outsideBranch = checkout.slice(outsideStart, texasStart);

  assert.ok(outsideStart >= 0);
  assert.ok(texasStart > outsideStart);
  assert.match(checkout, /if \(!option\) values\.push\(el\.textContent\)/);
  assert.match(checkout, /tokens\.some\(function \(token\) \{ return WL_STATE_NAMES\.has\(token\); \}\)/);
  assert.match(checkout, /collectAddressZipCandidates\("delivery"\)/);
  assert.match(checkout, /zip >= 73301 && zip <= 73399/);
  assert.match(checkout, /zip >= 75001 && zip <= 79999/);
  assert.match(checkout, /zip >= 88510 && zip <= 88595/);
  assert.match(outsideBranch, /\$delivery\.hide\(\)/);
  assert.match(outsideBranch, /intent === "pickup"/);
  assert.match(outsideBranch, /Pickup is selected\. Ship via UPS is also available/);
  assert.match(outsideBranch, /Ship via UPS is selected/);
  assert.match(outsideBranch, /Pickup from a Woodson store is also available/);
  assert.match(outsideBranch, /setFulfillmentIntent\("ship"\)/);
  assert.match(outsideBranch, /updateShippingStyles\("ship", \{ silent: !!\(ups && ups\.checked\), reason: "outside-address" \}\)/);
  assert.match(checkout, /button type="button" id="btnPickup"/);
  assert.doesNotMatch(checkout, /outside-address-click/);
});

test("checkout uses the unified fulfillment quote to show and recommend UPS or Woodson delivery", () => {
  const checkout = source("Checkout2.js");
  const offer = source("UpsShippingOffer.js");
  assert.match(checkout, /Delivered by Woodson/);
  assert.match(checkout, /data-mode="delivery" data-value="rbUPSDelivery"/);
  assert.match(checkout, /quote\.options\.delivery/);
  assert.match(checkout, /quote\.options\.ups/);
  assert.match(checkout, /Recommended/);
  assert.match(offer, /api\/fulfillment-quote/);
  assert.match(offer, /checkoutAddress/);
  assert.match(offer, /recommendation:/);
  assert.match(offer, /action: "select"/);
  assert.match(checkout, /await window\.WLShippingOffer\.select\(mode\)/);
});

test("checkout sends USPS state codes and distinguishes address failures from item failures", () => {
  const offer = source("UpsShippingOffer.js");
  const checkout = source("Checkout2.js");
  const stateMap = { virginia: "VA", newyork: "NY", georgia: "GA", california: "CA" };
  const stateCodes = { VA: true, NY: true, GA: true, CA: true };
  const normalizeUsState = extractedFunction(offer, "normalizeUsState", {
    text: (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim(),
    US_STATE_CODES_BY_NAME: stateMap,
    US_STATE_CODES: stateCodes
  });
  const shippingAddressMessage = extractedFunction(checkout, "shippingAddressMessage", {
    cleanStateValue: (value) => String(value || "").replace(/\s+/g, " ").trim()
  });

  assert.equal(normalizeUsState("Virginia"), "VA");
  assert.equal(normalizeUsState("New York"), "NY");
  assert.equal(normalizeUsState("58 Georgia Georgia 58"), "GA");
  assert.match(offer, /state:\s*normalizeUsState\(stateText\) \|\| stateText/);
  assert.match(shippingAddressMessage({ reason: "VI is not a valid state for the specified shipment." }), /check the city, state, and ZIP/i);
  assert.match(shippingAddressMessage({ reason: "The postal code is invalid." }), /check the city, state, and ZIP/i);
  assert.equal(shippingAddressMessage({ reason: "shipping-items-unavailable" }), "");
  assert.match(checkout, /Cannot ship · Check item below/);
  assert.match(checkout, /Check shipping address/);
});

test("fulfillment quoting recognizes the selected store in the current public stores header", () => {
  const offer = source("UpsShippingOffer.js");
  const selectedOrigin = extractedFunction(offer, "selectedOrigin", {
    text: (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim(),
    STORE_ORIGINS: {
      brenham: { name: "Brenham", postalCode: "77833" },
      caldwell: { name: "Caldwell", postalCode: "77836" }
    },
    storedCartData: () => null,
    document: {
      querySelectorAll: () => [{
        getAttribute: () => "https://www.woodsonlumber.com/stores",
        textContent: "Caldwell. Open until 5:30 PM"
      }]
    }
  });

  assert.deepEqual(selectedOrigin(), { name: "Caldwell", postalCode: "77836" });
});

test("cart quoting recognizes the selected store in the current public stores header", () => {
  const cart = source("WoodsonShoppingCart.js");
  const getSelectedStoreOrigin = extractedFunction(cart, "getSelectedStoreOrigin", {
    text: (value) => String(value || "").replace(/\s+/g, " ").trim(),
    STORE_ORIGINS: {
      brenham: { name: "Brenham", postalCode: "77833" },
      caldwell: { name: "Caldwell", postalCode: "77836" }
    },
    document: {
      querySelectorAll: () => [{
        getAttribute: () => "https://www.woodsonlumber.com/stores",
        textContent: "Caldwell. Open until 5:30 PM"
      }]
    }
  });

  assert.deepEqual(getSelectedStoreOrigin(), { name: "Caldwell", postalCode: "77836" });
});

test("checkout classifies selected states and saved ZIPs for Texas-only delivery", () => {
  const checkout = source("Checkout2.js");
  const cleanStateValue = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const normalizeStateRegion = extractedFunction(checkout, "normalizeStateRegion", {
    cleanStateValue,
    WL_STATE_NAMES: new Set(["colorado", "newmexico", "newyork"]),
    WL_STATE_ABBRS: new Set(["co", "nm", "ny"])
  });
  const normalizeZipRegion = extractedFunction(checkout, "normalizeZipRegion", { cleanStateValue });

  assert.equal(normalizeStateRegion("6 Colorado Colorado 6"), "outside");
  assert.equal(normalizeStateRegion("30 New Mexico New Mexico 30"), "outside");
  assert.equal(normalizeStateRegion("TX Texas"), "texas");
  assert.equal(normalizeStateRegion("Canada"), "outside");
  assert.equal(normalizeStateRegion("[Select State]"), "");
  assert.equal(normalizeZipRegion("80219"), "outside");
  assert.equal(normalizeZipRegion("77836"), "texas");
  assert.equal(normalizeZipRegion("73301"), "texas");
  assert.equal(normalizeZipRegion("88510"), "texas");
  assert.equal(normalizeZipRegion(""), "");
});

test("delivery options display the server-returned rate without a browser-side free override", () => {
  const delivery = source("DeliveryOptions.js");
  assert.doesNotMatch(delivery, /WLShippingPromo/);
  assert.doesNotMatch(delivery, /promoApplied\s*\?/);
  assert.match(delivery, /cost = rawCost/);
});

test("every UPS path enforces the $9.95 floor after subsidies and promotions", () => {
  const rates = source("api/ups-rates.js");
  const bridge = source("api/rate.js");
  const policy = source("api/shipping-policy.js");
  assert.match(rates, /applyShippingMinimumToRates\(automatic\.result\)/);
  assert.match(bridge, /applyGroundPromotion/);
  assert.match(bridge, /safePositiveRates\(applyShippingMinimumToRates\(result\)\)/);
  assert.match(policy, /DEFAULT_MINIMUM_SHIPPING = 9\.95/);
  assert.doesNotMatch(policy, /\[0, reduced, ground\]/);
});

test("cart UPS requests no longer send browser-controlled promotion eligibility", () => {
  const cart = source("WoodsonShoppingCart.js");
  assert.doesNotMatch(cart, /promo:\s*promo/);
  assert.match(cart, /shippingOffer/);
  assert.match(cart, /UpsShippingOffer\.js/);
});

test("cart and checkout carry the server-validated cut-to-ship selection into UPS quoting", () => {
  const cart = source("WoodsonShoppingCart.js");
  const offer = source("UpsShippingOffer.js");
  const checkout = source("Checkout2.js");
  const cutPolicy = JSON.parse(source("data/cut-to-ship-products.json"));

  assert.equal(cutPolicy.products[0].productId, "10496");
  assert.equal(cutPolicy.products[0].optionId, "custom-boxable-cuts");
  assert.equal(cutPolicy.products[0].stockLengthIn, 144);
  assert.equal(cutPolicy.products[0].nonRefundable, true);
  assert.match(offer, /wl_cut_to_ship_v1/);
  assert.match(offer, /data\/cut-to-ship-products\.json/);
  assert.match(offer, /The added charge appears in Shipping & Packaging/);
  assert.match(offer, /acknowledgedNonRefundable: true/);
  assert.match(offer, /12 x 12/);
  assert.match(offer, /cutToShip: cutSelection/);
  assert.match(cart, /cutToShip: item\.cutToShip \|\| null/);
  assert.match(checkout, /custom cut request on this step/);
  assert.match(checkout, /rate includes \$.*custom cutting and packaging/);
  assert.match(checkout, /CUT TO SHIP/);
  assert.match(checkout, /CUSTOMIZED SPECIAL ORDER/);
  assert.match(checkout, /NON-REFUNDABLE/);
  assert.match(checkout, /cutToShipOrderInstruction/);
  assert.match(checkout, /getFulfillmentIntent\(\) !== "ship"/);
  assert.match(checkout, /wl:cut-to-ship-change/);
});

test("customization checkout is blocked until a server receipt records the acknowledgment", () => {
  const cart = source("WoodsonShoppingCart.js");
  const offer = source("UpsShippingOffer.js");
  const checkout = source("Checkout2.js");
  const approvalApi = source("api/customization-approval.js");

  assert.match(cart, /validateCustomizationHandoff/);
  assert.match(cart, /data-wl-cut-terms/);
  assert.match(cart, /stopImmediatePropagation/);
  assert.match(cart, /#gc_guest_btn/);
  assert.match(offer, /api\/customization-approval/);
  assert.match(offer, /wl_customization_approval_v1/);
  assert.match(offer, /data-wl-cut-request-toggle/);
  assert.match(offer, /validateCustomizationBeforeCheckout/);
  assert.match(checkout, /validateFinalCustomizationApproval/);
  assert.match(checkout, /CUSTOMER APPROVAL/);
  assert.match(checkout, /webTrackUserId/);
  assert.match(approvalApi, /storeCustomizationApproval/);
});

test("cart handoff rejects the reported unchecked acknowledgment state", () => {
  const cart = source("WoodsonShoppingCart.js");
  const status = { textContent: "" };
  const terms = { checked: false };
  const panel = {
    querySelector(selector) {
      if (selector === "[data-wl-cut-request-toggle]:checked") return { checked: true };
      if (selector === "[data-wl-cut-terms]") return terms;
      if (selector === ".wl-cut-to-ship-status") return status;
      return null;
    }
  };
  const validateCustomizationHandoff = extractedFunction(cart, "validateCustomizationHandoff", {
    document: { querySelectorAll: () => [panel], querySelector: () => panel },
    window: {},
    getCartItems: () => []
  });

  const result = validateCustomizationHandoff();
  assert.equal(result.ok, false);
  assert.equal(result.target, terms);
  assert.match(result.message, /must check/i);
  assert.match(status.textContent, /before checkout/i);
});

test("checkout writes a cut instruction only for an actual UPS order", () => {
  const checkout = source("Checkout2.js");
  const values = {
    wl_shipping_offer_v1: JSON.stringify({
      cutToShip: {
        applied: true,
        nonRefundable: true,
        selections: [{
          optionId: "custom-boxable-cuts",
          productId: "10496",
          productCode: "HM38V",
          originalQuantity: 2,
          cutLengthsIn: [48, 48, 24, 24],
          cutSummary: "2 × 48 in., 2 × 24 in.",
          cutAndPackagingFeePerUnit: 10
        }]
      }
    })
  };
  const sessionStorage = { getItem: (key) => values[key] || null };
  const shippingInstruction = extractedFunction(checkout, "cutToShipOrderInstruction", {
    getFulfillmentIntent: () => "ship",
    sessionStorage,
    customizationApprovalReceipt: () => null,
    cleanText: (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim()
  });
  const deliveryInstruction = extractedFunction(checkout, "cutToShipOrderInstruction", {
    getFulfillmentIntent: () => "delivery",
    sessionStorage,
    customizationApprovalReceipt: () => null,
    cleanText: (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim()
  });

  assert.match(shippingInstruction(), /CUT TO SHIP HM38V \(10496\), qty 2/);
  assert.match(shippingInstruction(), /2 × 48 in\., 2 × 24 in\./);
  assert.match(shippingInstruction(), /\$10\.00 per-length/);
  assert.match(shippingInstruction(), /NON-REFUNDABLE/);
  assert.equal(deliveryInstruction(), "");
});

test("saved for later waits for WebTrack's dynamic Quicklist action", async () => {
  const savedForLater = source("SavedForLater.js");
  const bundle = source("wl-shoppingcart.bundle.js");
  const findSavedForLaterLink = extractedFunction(savedForLater, "findSavedForLaterLink");
  const waitForSavedForLaterLink = extractedFunction(savedForLater, "waitForSavedForLaterLink", {
    findSavedForLaterLink
  });
  const stableLink = { id: "ctl00_QuickList_QuickListRepeater_ctrl0_QuickListAddButton" };
  const fallbackLink = { textContent: " Add to Saved For Later " };

  assert.equal(findSavedForLaterLink({
    querySelector: () => stableLink,
    querySelectorAll: () => []
  }), stableLink);
  assert.equal(findSavedForLaterLink({
    querySelector: () => null,
    querySelectorAll: () => [{ textContent: "Other" }, fallbackLink]
  }), fallbackLink);

  let menuOpened = 0;
  let dynamicLink = null;
  const quicklistToggle = {
    click: () => {
      menuOpened += 1;
      setTimeout(() => { dynamicLink = stableLink; }, 0);
    }
  };
  const resolvedLink = await waitForSavedForLaterLink({
    querySelector: (selector) => selector.includes("QuickListAddButton") ? dynamicLink : quicklistToggle,
    querySelectorAll: () => []
  }, 500);
  assert.equal(resolvedLink, stableLink);
  assert.equal(menuOpened, 1);

  for (const implementation of [savedForLater, bundle]) {
    assert.match(implementation, /waitForSavedForLaterLink\(doc/);
    assert.match(implementation, /quicklistToggle\.click\(\)/);
    assert.match(implementation, /if \(submissionStarted\)/);
    assert.match(implementation, /Saved For Later postback did not return to the product page/);
    assert.doesNotMatch(implementation, /Give it time to complete, then cleanup/);
  }
});

test("saved for later resolves only after WebTrack completes its postback", async () => {
  const savedForLater = source("SavedForLater.js");
  const eventTarget = { value: "" };
  const eventArgument = { value: "pending" };
  let iframe;
  let postbackLoaded = false;
  let iframeRemoved = false;

  const productDocument = {
    forms: [{
      querySelector: (selector) => selector.includes("__EVENTTARGET") ? eventTarget : eventArgument,
      submit: () => {
        setTimeout(() => {
          postbackLoaded = true;
          iframe.onload();
        }, 0);
      }
    }]
  };
  const body = {
    appendChild: (node) => {
      iframe = node;
      node.parentNode = body;
      setTimeout(() => node.onload(), 0);
    },
    removeChild: (node) => {
      node.parentNode = null;
      iframeRemoved = true;
    }
  };
  const addToQuicklist = extractedFunction(savedForLater, "addToQuicklist", {
    document: {
      body,
      createElement: () => ({
        style: {},
        contentDocument: productDocument,
        contentWindow: { document: productDocument, location: { pathname: "/ProductDetail.aspx" } }
      })
    },
    waitForSavedForLaterLink: async () => ({
      getAttribute: () => "javascript:__doPostBack('savedForLaterTarget','')"
    }),
    console: { log: () => {}, error: () => {} }
  });

  await addToQuicklist("6698");
  assert.equal(postbackLoaded, true);
  assert.equal(eventTarget.value, "savedForLaterTarget");
  assert.equal(eventArgument.value, "");
  assert.equal(iframeRemoved, true);
});

test("the expired SummerChill26 bridge is retired without disabling fulfillment quotes", () => {
  const promo = source("UpsShippingPromo.js");
  const offer = source("UpsShippingOffer.js");
  assert.match(promo, /SUMMERCHILL26/);
  assert.match(promo, /PROMO_END_AT = "2026-09-01T00:00:00-05:00"/);
  assert.match(promo, /This shipping promotion has ended/);
  assert.match(promo, /promoSession=1/);
  assert.match(promo, /UpsShippingOffer\.js/);
  assert.match(offer, /WLShippingOffer/);
  assert.match(offer, /Checkout\|PlaceOrder/);
});

test("fresh fulfillment quotes preserve only an explicit customer selection", () => {
  const checkout = source("Checkout2.js");
  const offer = source("UpsShippingOffer.js");
  assert.match(checkout, /wl_fulfillment_selection_source_v1/);
  assert.match(checkout, /selectionSource !== "user"/);
  assert.match(checkout, /:\s*"user";/);
  assert.match(offer, /function rememberedSelection\(/);
  assert.match(offer, /source === "user"/);
  assert.match(offer, /await selectOffer\(selected\.mode\)/);
});

test("a guest checkout transition cannot lose an in-flight quote refresh", () => {
  const offer = source("UpsShippingOffer.js");
  assert.match(offer, /if \(activeRequest\) \{[\s\S]*refreshQueued = true/);
  assert.match(offer, /MISSING_CONTEXT_MAX_RETRIES = 10/);
  assert.match(offer, /scheduleRefresh\(750\)/);
  assert.match(offer, /if \(refreshQueued\) \{[\s\S]*scheduleRefresh\(50\)/);
});

test("checkout synchronizes the displayed fulfillment mode before native submit", async () => {
  const checkout = source("Checkout2.js");
  const saved = new Map();
  const syncFulfillmentForNativeSubmit = extractedFunction(
    checkout,
    "syncFulfillmentForNativeSubmit",
    {
      getFulfillmentIntent: () => "ship",
      getSaleType: () => "delivery",
      FULFILLMENT_CONFIRMATION_KEY: "wl_confirmed_fulfillment_v1",
      document: {
        getElementById: (id) => ({ checked: /rbUPSDelivery$/.test(id) })
      },
      sessionStorage: { setItem: (key, value) => saved.set(key, value) },
      window: {
        WLShippingOffer: {
          current: () => ({ options: { ups: { available: true, amount: 9.95, serviceName: "UPS Ground" } } }),
          select: async (mode) => mode === "ship"
        }
      }
    }
  );

  assert.equal(await syncFulfillmentForNativeSubmit(), true);
  assert.equal(JSON.parse(saved.get("wl_confirmed_fulfillment_v1")).mode, "ship");
  assert.match(checkout, /proxy\.addEventListener\("click", async function/);
  assert.match(checkout, /await syncFulfillmentForNativeSubmit\(\)/);
  assert.ok(
    checkout.indexOf("await syncFulfillmentForNativeSubmit()") < checkout.indexOf("const worked = clickNativeContinue()"),
    "fulfillment should be synchronized before WebTrack's native postback"
  );
  assert.match(checkout, /Please reselect your fulfillment method/);
  assert.match(checkout, /data-wl-edit-step="1"/);
  assert.match(checkout, /option\?\.available.*Number\(option\.amount\) > 0/);
  assert.match(checkout, /mode === "pickup"[\s\S]*!pickup\.checked/);
  assert.match(checkout, /function enforcePaidNativeFulfillmentPath/);
  assert.match(checkout, /freeDelivery\.disabled = true/);
  assert.doesNotMatch(checkout, /mode === "delivery" && !\(\(ups && ups\.checked\) \|\| \(delivered && delivered\.checked\)\)/);
  assert.match(checkout, /Cannot ship · Check item below/);
  assert.match(checkout, /shippingIssueMessage/);
  assert.doesNotMatch(source("UpsShippingOffer.js"), /requestBody\.packages\s*=/);
  assert.doesNotMatch(source("WoodsonShoppingCart.js"), /packages:\s*packageInfo\.packages/);
});

test("checkout rejects every stale or zero-charge fulfillment handoff", async () => {
  const checkout = source("Checkout2.js");

  function makeSync(intent, checkedId, amount = 25) {
    let selections = 0;
    const sync = extractedFunction(checkout, "syncFulfillmentForNativeSubmit", {
      getFulfillmentIntent: () => intent,
      getSaleType: () => intent,
      FULFILLMENT_CONFIRMATION_KEY: "wl_confirmed_fulfillment_v1",
      document: {
        getElementById: (id) => ({ checked: id.endsWith(checkedId) })
      },
      sessionStorage: { setItem: () => {} },
      window: {
        WLShippingOffer: {
          current: () => ({
            options: {
              ups: { available: true, amount },
              delivery: { available: true, amount }
            }
          }),
          select: async () => { selections += 1; return true; }
        }
      }
    });
    return { sync, selections: () => selections };
  }

  const staleDelivery = makeSync("delivery", "rbDelivered");
  assert.equal(await staleDelivery.sync(), false, "native free-delivery state must never pass");
  assert.equal(staleDelivery.selections(), 0);

  assert.equal(await makeSync("delivery", "rbUPSDelivery").sync(), true);
  assert.equal(await makeSync("ship", "rbUPSDelivery", 0).sync(), false);
  assert.equal(await makeSync("pickup", "rbUPSDelivery").sync(), false);
  assert.equal(await makeSync("pickup", "rbCollectLater").sync(), true);
});

test("guest checkout names all three fulfillment choices", () => {
  const guest = source("Guestcheckout.js");
  assert.match(guest, /pickup, Woodson delivery, or UPS shipping/);
});

test("guest checkout marks generated accounts without replacing the customer name", () => {
  const guest = source("Guestcheckout.js");
  assert.match(guest, /Guest User - \$\{payload\.contactName\}/);
  assert.match(guest, /FirstNameTextBox', payload\.fname/);
  assert.match(guest, /LastNameTextBox', payload\.lname/);
});
