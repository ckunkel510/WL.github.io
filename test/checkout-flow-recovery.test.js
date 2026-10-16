"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const claims = require("../api/fulfillment-sessions");
const { fulfillmentResult } = require("../api/rate")._test;

function environment() {
  const elements = new Map();
  const listeners = new Map();
  const timers = [];
  const storage = new Map();
  function element(id = "") {
    const node = {
      id, style: { setProperty(key, value) { this[key] = value; } },
      children: [], dataset: {}, textContent: "",
      setAttribute() {}, removeAttribute() {},
      appendChild(child) { this.children.push(child); if (child.id) elements.set(child.id, child); return child; },
      remove() { elements.delete(this.id); },
      contains() { return false; },
      addEventListener(name, fn) { this[name] = fn; },
      querySelector() { return null; }
    };
    if (id) elements.set(id, node);
    return node;
  }
  const document = {
    readyState: "loading", body: element(), activeElement: null,
    createElement: () => element(),
    getElementById: id => elements.get(id) || null,
    querySelector: selector => selector.startsWith("#") ? elements.get(selector.slice(1)) || null : null,
    querySelectorAll: () => [],
    addEventListener(name, fn) { listeners.set(name, [...(listeners.get(name) || []), fn]); },
    dispatchEvent(event) { for (const fn of listeners.get(event.type) || []) fn(event); }
  };
  const context = {
    document, location: { pathname: "/ShoppingCart.aspx", origin: "https://webtrack.woodsonlumber.com" },
    sessionStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key)
    },
    console: { log() {}, warn() {}, error() {} },
    setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {},
    addEventListener(name, fn) { listeners.set(name, [...(listeners.get(name) || []), fn]); },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } }
  };
  context.window = context;
  vm.createContext(context);
  return { context, document, elements, element, listeners, timers, storage };
}

function load(file, env, exports = "") {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, `${exports}\n})();`), env.context, { filename: file });
}

function click(env, id) {
  const event = {
    type: "click", target: { id, closest() { return this; } },
    preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() {}
  };
  env.document.dispatchEvent(event);
  return event;
}

test("opening guest checkout retains safety checks without starting a native handoff", () => {
  const env = environment();
  load("WoodsonShoppingCart.js", env, "window.bindHandoff = bindCheckoutHandoff;");
  env.context.bindHandoff("cart-a");
  env.storage.set("wl_confirmed_fulfillment_v1", "existing");
  assert.equal(click(env, "gc_guest_btn").defaultPrevented, undefined);
  assert.equal(env.elements.has("wl-checkout-transition"), false);
  assert.equal(env.storage.has("wl_confirmed_fulfillment_v1"), false);

  const originalQuery = env.document.querySelector;
  env.document.querySelector = selector => selector.includes("data-sold-out") ? env.element() : originalQuery(selector);
  assert.equal(click(env, "gc_guest_btn").defaultPrevented, true);
  assert.equal(env.elements.has("wl-checkout-transition"), false);
});

test("native checkout keeps its loading screen but recovers after failed navigation or browser Back", () => {
  const env = environment();
  load("WoodsonShoppingCart.js", env, "window.bindHandoff = bindCheckoutHandoff;");
  env.context.bindHandoff("cart-a");
  click(env, "ctl00_PageBody_PlaceOrderButton");
  assert.equal(env.elements.has("wl-checkout-transition"), true);
  env.timers.at(-1)();
  assert.equal(env.elements.has("wl-checkout-transition"), false);
  click(env, "ctl00_PageBody_PlaceOrderButton");
  for (const fn of env.listeners.get("pageshow")) fn();
  assert.equal(env.elements.has("wl-checkout-transition"), false);
});

test("guest Cancel removes an orphaned transition and restores cart quantity editing", () => {
  const env = environment();
  const qty = env.element();
  qty.readOnly = true;
  qty.setAttribute = () => {};
  env.document.querySelectorAll = selector => selector.includes("qty-section") ? [qty] : [];
  const modal = env.element("gc_modal");
  const backdrop = env.element("gc_backdrop");
  env.element("wl-checkout-transition");
  load("Guestcheckout.js", env, "window.cancelGuest = closeModal;");
  env.context.cancelGuest();
  assert.equal(env.elements.has("wl-checkout-transition"), false);
  assert.equal(modal.style.display, "none");
  assert.equal(backdrop.style.display, "none");
  assert.equal(qty.readOnly, false);
});

test("duplicate-email recovery uses native sign-in and removes stale guest autofill", () => {
  const env = environment();
  const box = env.element("gc_error");
  const nativeSignIn = { href: "https://webtrack.woodsonlumber.com/SignIn.aspx?Redirect=ShoppingCart.aspx" };
  env.element("ctl00_PageBody_OptionalSigninButton").querySelector = () => nativeSignIn;
  env.element("wl-checkout-transition");
  env.storage.set("wl_guest_checkout_payload", "discarded guest details");
  env.storage.set("wl_guest_checkout_needs_autofill", "1");
  load("Guestcheckout.js", env, "window.guestError = showError;");
  env.context.guestError("An account already uses this email.", true);
  assert.equal(env.elements.has("wl-checkout-transition"), false);
  const link = box.children[0];
  assert.equal(link.href, nativeSignIn.href);
  assert.equal(link.textContent, "Sign In");
  link.click();
  assert.equal(env.storage.has("wl_guest_checkout_payload"), false);
  assert.equal(env.storage.has("wl_guest_checkout_needs_autofill"), false);
  assert.equal(env.storage.get("wl_checkout_mode"), "signed_in");
});

async function refreshedQuote(mode, available = true) {
  claims.resetMemoryClaims();
  const env = environment();
  env.element("ctl00_PageBody_DeliveryAddress_Postcode").value = "77836";
  env.storage.set("wl_shipping_offer_cart_v1", JSON.stringify({ items: [{ productId: "85", productCode: "FISH", quantity: 1 }], ts: Date.now() }));
  if (mode) {
    env.storage.set("wl_fulfillment_intent", mode);
    env.storage.set("wl_fulfillment_selection_source_v1", "user");
  }
  const route = { shipFrom: { postalCode: "77836" }, shipTo: { postalCode: "77836" }, totalWeight: 50 };
  const ups = [{ serviceCode: "03", serviceName: "UPS Ground", amount: 80.44, currency: "USD" }];
  const delivery = [{ serviceCode: "03", serviceName: "Woodson Local Delivery", amount: 25, currency: "USD" }];
  const requests = [];
  env.context.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    requests.push(body);
    let result;
    if (body.action === "select") result = await claims.selectFulfillmentClaim(body);
    else {
      await claims.storeFulfillmentClaim({ ...route, recommendation: { mode: "delivery", amount: 25 }, rates: delivery, availableRates: { ship: available ? ups : [], delivery } });
      result = { recommendation: { mode: "delivery", amount: 25 }, packageProfile: { totalWeight: 50 }, options: { ups: { available, amount: 80.44 }, delivery: { available: true, amount: 25 } } };
    }
    return { ok: true, json: async () => result };
  };
  load("UpsShippingOffer.js", env);
  await env.context.WLShippingOffer.refresh();
  const claim = await claims.findFulfillmentClaim(route);
  return { env, requests, claim };
}

test("an explicit UPS choice survives recommendation refresh through the native rate bridge", async () => {
  const { env, requests, claim } = await refreshedQuote("ship");
  assert.equal(requests[1].mode, "ship");
  assert.equal(env.context.WLShippingOffer.current().recommendation.mode, "ship");
  assert.equal(claim.recommendation.mode, "ship");
  const nativeRate = fulfillmentResult(claim);
  assert.equal(nativeRate.rates[0].amount, 80.44);
});

test("the cheaper Woodson recommendation remains the default and explicit delivery choice", async () => {
  for (const mode of ["", "delivery"]) {
    const { env, requests, claim } = await refreshedQuote(mode);
    assert.equal(requests.length, 1);
    assert.equal(env.context.WLShippingOffer.current().recommendation.mode, "delivery");
    assert.equal(fulfillmentResult(claim).rates[0].amount, 25);
  }
});

test("a previously chosen UPS method is not restored when the refreshed quote makes it unavailable", async () => {
  const { requests, claim } = await refreshedQuote("ship", false);
  assert.equal(requests.length, 1);
  assert.equal(claim.recommendation.mode, "delivery");
});

test('confirmed guest signup reloads the natural cart with a minimal single-use handoff',()=>{
  const env=environment(); let target='',native=0;
  env.context.location.assign=url=>{target=url;};
  env.element('ctl00_PageBody_PlaceOrderButton').click=()=>native++;
  load('Guestcheckout.js',env,'window.continueGuest = continueCheckoutAndHookBilling;');
  env.context.continueGuest();
  assert.equal(target,'/ShoppingCart.aspx'); assert.equal(native,0);
  const marker=JSON.parse(env.storage.get('wl_compact_guest_start_v1'));
  assert.deepEqual(Object.keys(marker).sort(),['createdAt','version']);
  assert.equal(marker.version,1); assert.equal(env.storage.get('wl_checkout_mode'),'guest');
});
function guestHandoffEnv() {
  const env=environment();env.document.documentElement={dataset:{}};
  env.context.removeEventListener=(name,fn)=>env.listeners.set(name,(env.listeners.get(name)||[]).filter(value=>value!==fn));
  env.document.querySelector=selector=>selector.includes('SignOut=1')?{}:null;
  env.storage.set('wl_compact_guest_start_v1',JSON.stringify({version:1,createdAt:Date.now()}));
  env.storage.set('wl_checkout_mode','guest');env.storage.set('wl_guest_checkout_payload',JSON.stringify({email:'guest@example.invalid'}));
  let native=0;const control=env.element('ctl00_PageBody_PlaceOrderButton');control.click=()=>native++;
  load('Guestcheckout.js',env,'window.waitGuest = awaitCompactGuestCheckout;');
  return {...env,native:()=>native};
}
test('guest handoff does not replay a consumed start or duplicate the native fallback',()=>{
  const compact=guestHandoffEnv();compact.context.waitGuest();compact.storage.delete('wl_compact_guest_start_v1');
  for(const fn of [...compact.listeners.get('wl-buy-now-pilot-settled')])fn();assert.equal(compact.native(),0);
  const fallback=guestHandoffEnv();fallback.context.waitGuest();
  for(const fn of [...fallback.listeners.get('wl-buy-now-pilot-settled')])fn();
  fallback.timers.at(-1)();assert.equal(fallback.native(),1);
});
test('an expired guest handoff never automatically enters native checkout',()=>{
  const env=guestHandoffEnv();env.storage.set('wl_compact_guest_start_v1',JSON.stringify({version:1,createdAt:Date.now()-300001}));
  env.context.waitGuest();assert.equal(env.storage.has('wl_compact_guest_start_v1'),false);assert.equal(env.native(),0);
});

test('legacy guest autofill leaves an owned compact frame to its verified parent',()=>{
  const env=environment();let reads=0;
  env.context.name='woodson-buy-now-checkout';
  env.context.parent={location:{origin:env.context.location.origin},document:{querySelector:()=>({contentWindow:env.context})}};
  env.context.sessionStorage.getItem=()=>{reads++;return null;};
  load('Guestcheckout.js',env,'window.applyGuest = applyGuestToCheckout;');
  vm.runInContext("window.parent.document.querySelector=()=>({contentWindow:window});",env.context);
  assert.equal(env.context.applyGuest(),false);assert.equal(reads,0);
});

test('successful guest signup removes the generated credential before retaining checkout details',async()=>{
  const env=environment();env.element('gc_submit');let reloads=0;
  env.context.location.assign=()=>{reloads++;};
  load('Guestcheckout.js',env,`collectGuestPayload=()=>({email:'guest@example.invalid',password:'temporary-only',fname:'Guest',lname:'Test'});createAccountInBackground=async()=>{};window.submitGuest=onSubmitGuest;`);
  await env.context.submitGuest();
  const draft=JSON.parse(env.storage.get('wl_guest_checkout_payload'));
  assert.equal(draft.email,'guest@example.invalid');assert.equal('password' in draft,false);assert.equal(reloads,1);
});
