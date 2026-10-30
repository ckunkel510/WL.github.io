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

test('anonymous primary checkout opens the guest form only after cart safety checks',()=>{
  const env=environment();let opened=0;
  env.context.WLGuestCheckout={open(){opened++;}};
  load('WoodsonShoppingCart.js',env,'window.bindHandoff = bindCheckoutHandoff;');
  env.context.bindHandoff('cart-guest');
  assert.equal(click(env,'ctl00_PageBody_PlaceOrderButton').defaultPrevented,true);
  assert.equal(opened,1);assert.equal(env.elements.has('wl-checkout-transition'),false);
  env.document.querySelector=selector=>selector.includes('data-sold-out')?env.element():null;
  click(env,'ctl00_PageBody_PlaceOrderButton');assert.equal(opened,1);
});

test('signed-in primary checkout keeps its native or compact handler',()=>{
  const env=environment();let opened=0;
  env.context.WLGuestCheckout={open(){opened++;}};
  env.document.querySelectorAll=selector=>selector==='a'?[{textContent:'Sign Out'}]:[];
  load('WoodsonShoppingCart.js',env,'window.bindHandoff = bindCheckoutHandoff;');
  env.context.bindHandoff('cart-signed-in');
  assert.equal(click(env,'ctl00_PageBody_PlaceOrderButton').defaultPrevented,undefined);
  assert.equal(opened,0);assert.equal(env.elements.has('wl-checkout-transition'),true);
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
  env.storage.set("wl_guest_cart_handoff_v1", "retained-basket");
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
  assert.equal(env.storage.get("wl_guest_cart_handoff_v1"), "retained-basket");
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
  load('Guestcheckout.js',env,`collectGuestPayload=()=>({email:'guest@example.invalid',password:'temporary-only',fname:'Guest',lname:'Test'});backupGuestCart=()=>{};createAccountInBackground=async()=>{};verifyGuestAccount=async()=>{};window.submitGuest=onSubmitGuest;`);
  await env.context.submitGuest();
  const draft=JSON.parse(env.storage.get('wl_guest_checkout_payload'));
  assert.equal(draft.email,'guest@example.invalid');assert.equal('password' in draft,false);assert.equal(reloads,1);
});

function guestRow(quantity=2) {
  return {getAttribute:()=> 'ea',querySelectorAll:()=>[],querySelector(selector){
    if(selector==='a[href*="pid="]')return {getAttribute:()=>'/ProductDetail.aspx?pid=85'};
    if(selector.startsWith('input.riTextBox'))return {value:String(quantity),closest:()=>null};
    if(selector.startsWith('.portalGridLink'))return {textContent:'FISH'};
    if(selector.startsWith('.description'))return {textContent:'Fish food'};
    return null;
  }};
}
test('guest basket backup uses matching native rows and refuses a pending or configured cart',async()=>{
  const env=environment();env.document.querySelectorAll=()=>[guestRow()];
  load('Guestcheckout.js',env,'guestNativeDocument=async()=>window.nativePage;window.backupGuest=backupGuestCart;');
  env.context.nativePage={querySelectorAll:()=>[guestRow()]};await env.context.backupGuest('guest@example.invalid');
  const saved=JSON.parse(env.storage.get('wl_guest_cart_handoff_v1'));assert.equal(saved.items[0].pid,'85');assert.equal(saved.items[0].quantity,2);assert.equal(saved.items[0].unit,'ea');assert.equal('password' in saved,false);
  env.storage.delete('wl_guest_cart_handoff_v1');env.context.nativePage={querySelectorAll:()=>[guestRow(3)]};await assert.rejects(env.context.backupGuest('guest@example.invalid'));assert.equal(env.storage.has('wl_guest_cart_handoff_v1'),false);
  const invalid=guestRow();invalid.querySelectorAll=()=>[{value:'custom cut'}];env.document.querySelectorAll=()=>[invalid];await assert.rejects(env.context.backupGuest('guest@example.invalid'));assert.equal(env.storage.has('wl_guest_cart_handoff_v1'),false);
});
test('guest basket backup ignores empty WebTrack shell rows but rejects incomplete product rows',async()=>{
  const env=environment(), shell={querySelector:()=>null};
  env.document.querySelectorAll=()=>[shell,guestRow()];
  load('Guestcheckout.js',env,'guestNativeDocument=async()=>window.nativePage;window.backupGuest=backupGuestCart;');
  env.context.nativePage={querySelectorAll:()=>[shell,guestRow()]};
  await env.context.backupGuest('guest@example.invalid');
  const saved=JSON.parse(env.storage.get('wl_guest_cart_handoff_v1'));
  assert.equal(saved.items.length,1);assert.equal(saved.items[0].quantity,2);
  env.storage.delete('wl_guest_cart_handoff_v1');
  const incomplete=guestRow();const original=incomplete.querySelector;
  incomplete.querySelector=selector=>selector.startsWith('input.riTextBox')?null:original(selector);
  env.document.querySelectorAll=()=>[shell,incomplete];
  await assert.rejects(env.context.backupGuest('guest@example.invalid'),error=>error.code==='guest_cart_unsupported');
  assert.equal(env.storage.has('wl_guest_cart_handoff_v1'),false);
});
test('guest signup success requires fresh native login proof matching the supplied email',async()=>{
  const env=environment();load('Guestcheckout.js',env,'guestNativeDocument=async()=>window.nativePage;window.verifyGuest=verifyGuestAccount;');
  function identity(login,signedIn=true){return {querySelector:()=>signedIn?{}:null,querySelectorAll:()=>[{textContent:`Change details for user '${login}'`}]};}
  env.context.nativePage=identity('guest@example.invalid');await env.context.verifyGuest('guest@example.invalid');
  for(const page of [identity('another-login'),identity('guest@example.invalid',false),{querySelector:()=>null,querySelectorAll:()=>[]}]) {env.context.nativePage=page;await assert.rejects(env.context.verifyGuest('guest@example.invalid'),error=>error.code==='guest_signup_unconfirmed');}
});

function signupFrameEnvironment() {
  const env=environment(), intervals=[], attributes=new Map();let posts=0;
  env.document.documentElement={setAttribute:(name,value)=>attributes.set(name,value)};
  env.context.setInterval=fn=>{intervals.push(fn);return intervals.length;};
  env.context.clearInterval=id=>{intervals[id-1]=null;};
  const fields=new Map(['UserNameTextBox','EmailAddressTextBox','Password1TextBox','Password2TextBox','ContactTelephoneTextBox','SignupButton'].map(name=>['ctl00_PageBody_'+name,env.element()]));
  const button=fields.get('ctl00_PageBody_SignupButton');
  button.classList={remove(){}};button.getAttribute=()=> 'javascript:WebForm_DoPostBackWithOptions(...)';
  const page={URL:'https://webtrack.woodsonlumber.com/UserSignup.aspx',readyState:'loading',getElementById:id=>fields.get(id)||null,querySelector:()=>({}),querySelectorAll:()=>[]};
  const nativeWindow={location:{pathname:'/UserSignup.aspx'},document:page,getComputedStyle:()=>({display:'block',visibility:'visible'})};
  const frame=env.element();frame.contentDocument=page;frame.contentWindow=nativeWindow;
  env.document.createElement=tag=>tag==='iframe'?frame:env.element();
  env.context.nativePost=()=>{posts++;return true;};
  load('Guestcheckout.js',env,'runNativeButton=()=>window.nativePost();window.createGuest=createAccountInBackground;window.guestPassword=randTempPassword;');
  return {...env,frame,page,nativeWindow,intervals,attributes,posts:()=>posts,payload:{email:'guest@example.invalid',password:'Temporary-12345',phone:'5555550100',fname:'Guest',lname:'Test',contactName:'Guest Test'},ready(){page.readyState='interactive';nativeWindow.WebForm_DoPostBackWithOptions=()=>{};nativeWindow.WebForm_PostBackOptions=()=>{};}};
}

test('guest signup progresses from DOM readiness without window.load and posts only once',async()=>{
  const env=signupFrameEnvironment(), done=env.context.createGuest(env.payload);
  env.intervals[0]();assert.equal(env.posts(),0);
  env.page.readyState='interactive';env.intervals[0]();assert.equal(env.posts(),0,'native WebForms hooks must be ready');
  env.ready();env.intervals[0]();assert.equal(env.posts(),1);
  env.intervals[0]();env.frame.onload();assert.equal(env.posts(),1,'same document is never resubmitted');
  env.frame.contentDocument={...env.page,URL:'https://webtrack.woodsonlumber.com/Default.aspx'};
  env.nativeWindow.location.pathname='/Default.aspx';env.intervals[0]();await done;
  assert.equal(env.intervals[0],null);assert.equal(env.elements.has('gc_signup_iframe'),false);
  assert.equal(env.attributes.get('data-wl-guest-signup-state'),'confirmation_pending');
});

test('guest signup ignores the initial blank frame and reports a pre-submit form timeout',async()=>{
  const env=signupFrameEnvironment();env.ready();env.page.URL='about:blank';
  const done=env.context.createGuest(env.payload);env.intervals[0]();assert.equal(env.posts(),0);
  env.timers.at(-1)();await assert.rejects(done,error=>error.code==='guest_signup_form_timeout');
  assert.equal(env.intervals[0],null);assert.equal(env.elements.has('gc_signup_iframe'),false);
});

test('guest signup confirmation timeout never repeats an uncertain postback',async()=>{
  const env=signupFrameEnvironment();env.ready();const done=env.context.createGuest(env.payload);
  env.intervals[0]();env.intervals[0]();env.timers.at(-1)();
  await assert.rejects(done,error=>error.code==='guest_signup_confirmation_timeout');
  assert.equal(env.posts(),1);assert.equal(env.intervals[0],null);
});

test('guest signup waits for a new response document before reading duplicate-email validation',async()=>{
  const env=signupFrameEnvironment();env.ready();const done=env.context.createGuest(env.payload);
  env.intervals[0]();
  env.frame.contentDocument={...env.page,querySelectorAll:()=>[{textContent:'An account already exists.'}]};
  env.intervals[0]();await assert.rejects(done,error=>error.code==='email-exists');assert.equal(env.posts(),1);
});

test('guest generated passwords always satisfy native length, uppercase, digit and symbol rules',()=>{
  const env=signupFrameEnvironment();env.context.crypto={getRandomValues:values=>{values[0]=0;return values;}};
  const password=env.context.guestPassword(18);assert.equal(password.length,18);
  assert.match(password,/[A-Z]/);assert.match(password,/[a-z]/);assert.match(password,/\d/);assert.match(password,/[^A-Za-z0-9]/);
});

test('guest signup resumes from fresh matching login proof after a confirmation timeout',async()=>{
  const env=environment();let attempts=0,proofs=0,reloads=0;
  env.context.createAttempt=()=>{attempts++;throw Object.assign(new Error('Unconfirmed response'),{code:'guest_signup_confirmation_timeout'});};
  env.context.nativeProof=()=>{proofs++;};env.context.location.assign=()=>{reloads++;};
  load('Guestcheckout.js',env,`collectGuestPayload=()=>({email:'guest@example.invalid',password:'temporary-only',fname:'Guest',lname:'Test'});backupGuestCart=()=>{};createAccountInBackground=async()=>window.createAttempt();verifyGuestAccount=async()=>window.nativeProof();window.submitGuest=onSubmitGuest;`);
  await env.context.submitGuest();assert.equal(attempts,1);assert.equal(proofs,1);assert.equal(reloads,1);
  assert.equal('password' in JSON.parse(env.storage.get('wl_guest_checkout_payload')),false);
});

function fullPageGuestEnvironment(phase='ready') {
  const env=environment();
  env.context.location.pathname='/UserSignup.aspx'; env.context.parent=env.context;
  const draft={email:'guest@example.invalid',fname:'Guest',lname:'Test',phone:'5555550100',contactName:'Guest Test',d_addr1:'1 Test St',d_city:'Test',d_state:'TX',d_zip:'77836'};
  env.storage.set('wl_guest_checkout_payload',JSON.stringify(draft));
  env.storage.set('wl_guest_cart_handoff_v1',JSON.stringify({version:1,createdAt:Date.now(),email:draft.email,items:[{pid:'85',quantity:1}]}));
  env.storage.set('wl_guest_signup_recovery_v1',JSON.stringify({version:1,createdAt:Date.now(),email:draft.email,phase}));
  const form=env.element(); form.insertBefore=(node)=>{form.children.unshift(node);env.elements.set(node.id,node);};
  const names=['UserNameTextBox','EmailAddressTextBox','Password1TextBox','Password2TextBox','ContactTelephoneTextBox','FirstNameTextBox','LastNameTextBox','DeliveryAddressLine1TextBox','SignupButton'];
  for(const name of names) {const node=env.element('ctl00_PageBody_'+name);node.closest=()=>form;node.getAttribute=()=>'';node.classList={remove(){}};}
  let navigations=0,proofs=0;
  env.context.location.assign=()=>{navigations++;};env.context.nativeProof=()=>{proofs++;};
  load('Guestcheckout.js',env,'verifyGuestAccount=async()=>window.nativeProof();window.readRecovery=readFullPageGuestRecovery;window.resumeRecovery=resumeFullPageGuestRecovery;window.offerRecovery=offerFullPageGuestRecovery;window.stubBasket=fn=>{backupGuestCart=fn;};');
  return {...env,draft,form,navigations:()=>navigations,proofs:()=>proofs};
}

test('full-page guest handoff expires and refuses mismatched draft or basket owners',()=>{
  for(const change of [record=>record.createdAt=Date.now()-300001,record=>record.createdAt=Date.now()+30000,record=>record.phase='unknown',record=>record.email='other@example.invalid']) {
    const env=fullPageGuestEnvironment(),record=JSON.parse(env.storage.get('wl_guest_signup_recovery_v1'));
    change(record);env.storage.set('wl_guest_signup_recovery_v1',JSON.stringify(record));
    assert.equal(env.context.readRecovery(),null);assert.equal(env.storage.has('wl_guest_signup_recovery_v1'),false);
    assert.equal(env.navigations(),0);assert.equal(env.storage.has('wl_guest_cart_handoff_v1'),true);
  }
  const env=fullPageGuestEnvironment();env.storage.set('wl_guest_cart_handoff_v1',JSON.stringify({createdAt:Date.now(),email:'other@example.invalid',items:[{}]}));
  assert.equal(env.context.readRecovery(),null);
});

test('full-page guest setup fills only its verified draft and waits for explicit native submission',async()=>{
  const env=fullPageGuestEnvironment();
  assert.equal(await env.context.resumeRecovery(),true);assert.equal(env.navigations(),0);assert.equal(env.proofs(),0);
  const field=id=>env.elements.get('ctl00_PageBody_'+id);
  assert.equal(field('EmailAddressTextBox').value,env.draft.email);
  assert.equal(field('EmailAddressTextBox').readOnly,true);
  assert.equal(field('Password1TextBox').type,'password');
  assert.match(field('Password1TextBox').value,/\d/);assert.equal(field('Password1TextBox').value,field('Password2TextBox').value);
  assert.equal(JSON.stringify([...env.storage.values()]).includes(field('Password1TextBox').value),false);
  const button=field('SignupButton');assert.equal(button.textContent,'Continue to checkout');
  env.context.Page_ClientValidate=()=>false;button.click({});assert.equal(env.context.readRecovery().phase,'ready');
  env.context.Page_ClientValidate=()=>true;button.click({});assert.equal(env.context.readRecovery().phase,'submitted');
  let blocked=false;button.click({preventDefault(){blocked=true;},stopImmediatePropagation(){}});assert.equal(blocked,true,'second submission is blocked');
});

test('full-page guest return verifies the native login before continuing and never posts signup on reload',async()=>{
  const env=fullPageGuestEnvironment('submitted');
  await env.context.resumeRecovery();assert.equal(env.proofs(),0);assert.equal(env.navigations(),0);
  const returned=environment();returned.context.parent=returned.context;returned.context.location.pathname='/Default.aspx';
  returned.storage.clear();for(const [key,value] of env.storage)returned.storage.set(key,value);
  let proofs=0,nav=0;returned.context.location.assign=()=>nav++;returned.context.nativeProof=()=>{proofs++;};
  load('Guestcheckout.js',returned,'verifyGuestAccount=async()=>window.nativeProof();window.resumeRecovery=resumeFullPageGuestRecovery;');
  assert.equal(await returned.context.resumeRecovery(),true);assert.equal(proofs,1);assert.equal(nav,1);
  assert.equal(returned.storage.has('wl_guest_signup_recovery_v1'),false);
  assert.equal(returned.storage.get('wl_checkout_mode'),'guest');
  assert.equal(returned.storage.has('wl_compact_guest_start_v1'),true);
});

test('full-page guest return retains the basket and does not navigate when native identity proof fails',async()=>{
  const original=fullPageGuestEnvironment('submitted'),env=environment();
  env.context.parent=env.context;env.context.location.pathname='/Default.aspx';
  for(const [key,value] of original.storage)env.storage.set(key,value);
  let nav=0;env.context.location.assign=()=>nav++;
  env.document.body.prepend=node=>env.elements.set(node.id,node);
  load('Guestcheckout.js',env,'verifyGuestAccount=async()=>{throw Error("identity mismatch")};window.resumeRecovery=resumeFullPageGuestRecovery;');
  assert.equal(await env.context.resumeRecovery(),true);assert.equal(nav,0);
  assert.equal(env.storage.has('wl_guest_signup_recovery_v1'),true);
  assert.equal(env.storage.has('wl_guest_cart_handoff_v1'),true);
  assert.equal(env.storage.has('wl_compact_guest_start_v1'),false);
});

test('standard guest setup rechecks the basket and stores only a short-lived owner marker',async()=>{
  const env=fullPageGuestEnvironment();env.element('gc_error');env.storage.delete('wl_guest_signup_recovery_v1');let checks=0;
  env.context.backupCheck=()=>checks++;
  // Rebind the native read, keeping the production recovery button and storage behavior.
  env.context.stubBasket(async()=>env.context.backupCheck());
  env.context.offerRecovery();await env.elements.get('gc_full_page').click();
  const marker=JSON.parse(env.storage.get('wl_guest_signup_recovery_v1'));
  assert.equal(checks,1);assert.equal(env.navigations(),1);assert.equal(marker.phase,'ready');
  assert.deepEqual(Object.keys(marker).sort(),['createdAt','email','phase','version']);
});


test("native customer branch overrides the browsing store when reserving fulfillment", async () => {
  for (const [label, expected] of [
    ["Brenham - 301 Clinton St, PO BOX 118, Brenham, Texas, 77833, United States", "77833"],
    ["Bryan - 105 W Pease St, PO BOX 3950, Bryan, Texas, 77801, United States", "77801"]
  ]) {
    const env = environment();
    env.context.location.pathname = "/Checkout.aspx";
    const branch=env.element("ctl00_PageBody_BranchDropDownList");
    branch.options=[{textContent:label}]; branch.selectedIndex=0;
    env.element("ctl00_PageBody_DeliveryAddress_Postcode").value="77833";
    env.storage.set("wl_shipping_offer_cart_v1",JSON.stringify({items:[{productId:"85",productCode:"ITEM",quantity:1}],origin:{postalCode:"77836"},ts:Date.now()}));
    const requests=[];
    env.context.fetch=async(url,options)=>{requests.push(JSON.parse(options.body));return {ok:true,json:async()=>({options:{},packageProfile:{totalWeight:1}})};};
    load("UpsShippingOffer.js",env);
    await env.context.WLShippingOffer.refresh();
    assert.equal(requests[0].shipFrom.postalCode,expected);
    assert.equal(JSON.parse(env.storage.get("wl_shipping_offer_cart_v1")).origin.postalCode,expected);
  }
});

test('a postal-only response finishing after checkout address hydration is discarded', async () => {
  const env=environment();
  env.element('ctl00_PageBody_DeliveryAddress_Postcode').value='77833';
  env.storage.set('wl_shipping_offer_cart_v1',JSON.stringify({items:[{productId:'85',productCode:'ITEM',quantity:1}],ts:Date.now()}));
  let finish;
  env.context.fetch=()=>new Promise(resolve=>{finish=resolve;});
  load('UpsShippingOffer.js',env);
  const pending=env.context.WLShippingOffer.refresh();
  env.element('ctl00_PageBody_DeliveryAddress_AddressLine1').value='123 Test St';
  env.element('ctl00_PageBody_DeliveryAddress_City').value='Brenham';
  env.element('ctl00_PageBody_DeliveryAddress_CountySelector_CountyList').selectedOptions=[{textContent:'Texas'}];
  finish({ok:true,json:async()=>({options:{ups:{available:true,amount:11.33},delivery:{available:false}}})});
  assert.equal(await pending,null);
  assert.equal(env.storage.has('wl_shipping_offer_v1'),false);
  assert.equal(env.context.WLShippingOffer.current(),null);
});

test('native checkout ignores another page quote with a different address or branch', async () => {
  const env=environment();
  env.element('ctl00_PageBody_DeliveryAddress_Postcode').value='77833';
  env.element('ctl00_PageBody_DeliveryAddress_AddressLine1').value='123 Test St';
  env.element('ctl00_PageBody_DeliveryAddress_City').value='Brenham';
  env.element('ctl00_PageBody_DeliveryAddress_CountySelector_CountyList').selectedOptions=[{textContent:'Texas'}];
  env.storage.set('wl_shipping_offer_cart_v1',JSON.stringify({items:[{productId:'85',productCode:'ITEM',quantity:1}],ts:Date.now()}));
  env.context.fetch=async()=>({ok:true,json:async()=>({options:{ups:{available:true,amount:11.33},delivery:{available:true,amount:25}}})});
  load('UpsShippingOffer.js',env);await env.context.WLShippingOffer.refresh();
  const complete=env.context.WLShippingOffer.current();assert.equal(complete.options.delivery.amount,25);
  env.storage.set('wl_shipping_offer_v1',JSON.stringify({...complete,addressKey:'postal-only-cart-estimate'}));
  assert.equal(env.context.WLShippingOffer.current(),null);
  env.storage.set('wl_shipping_offer_v1',JSON.stringify({...complete,originPostalCode:'77801'}));
  assert.equal(env.context.WLShippingOffer.current(),null);
  env.storage.set('wl_shipping_offer_v1',JSON.stringify(complete));
  env.element('ctl00_PageBody_DeliveryAddress_AddressLine1').value='456 Other St';
  assert.equal(env.context.WLShippingOffer.current(),null);
});
