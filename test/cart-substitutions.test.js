'use strict';
process.env.NODE_ENV = 'test';
const test = require('node:test'), assert = require('node:assert/strict');
const rules = require('../SubstitutionRules'), core = require('../CartSubstitutions');
const history = require('../api/substitution-history');
const endpoint = require('../api/cart-substitutions')._test;
const category = 'Lumber > Yellow Pine > 2x #2 Yellow Pine > 2x4 #2 Yellow Pine';
function product(id, length = 10, extra = {}) { return { productId: id, title: `2 X 4 - ${length} #2 Yellow Pine`, category, brand: '', productCode: 'CODE' + id, availability: 'in_stock', ...extra }; }
const source = product('1'), replacement = { ...product('2', 12), kind: 'longer_lumber' };
test('native unit-price formatting accepts the verified ea suffix while rejecting totals and ambiguous amounts', () => {
  assert.equal(core.money('$204.21\n ea'), 20421); assert.equal(core.money('$1,204.21'), 120421);
  for (const input of ['Total: $12.00', '$1,2.00', '$12.00 $13.00', '$12.00 LF', 'Call for price', '']) assert.equal(core.money(input), null);
});
test('longer boards require the same full family, size, species, grade, brand and remaining description', () => {
  assert.ok(rules.eligibility(source, replacement));
  for (const other of [product('2', 8), product('2', 10), product('2', 12, { title: '2 X 6 - 12 #2 Yellow Pine' }), product('2', 12, { title: '2 X 4 - 12 #1 Yellow Pine' }), product('2', 12, { title: '2 X 4 - 12 #2 Yellow Pine (Stud GR)' }), product('2', 12, { category: category + ' Other' }), product('2', 12, { brand: 'Other' }), product('2', 12, { title: '2 X 4 - 12 Yellow Pine' }), product('2', 12, { title: '2 X 4 - 12 #2' }), product('2', 12, { title: '2 X 4 - 12 #2 Yellow Pine Treated' })]) assert.equal(rules.eligibility(source, other), null, other.title);
});
test('treated, engineered, decking and insufficiently specified families fail closed', () => {
  for (const suffix of ['Treated', 'Engineered', 'LVL', 'Decking', 'Fencing', 'Plywood']) assert.equal(rules.lumber(product('1', 10, { category: category + ' ' + suffix })), null);
  assert.equal(rules.lumber(product('1', 10, { title: 'Lumber board 10 ft' })), null);
});
test('accepted choices rank only eligible directed pairs and never establish reverse equivalence', () => {
  const products = [source, replacement, product('3', 14), product('4', 16, { title: '2 X 6 - 16 #2 Yellow Pine' })];
  const rows = rules.candidates(products, '1', [], { 3: 30, 4: 100000 });
  assert.equal(rows[0].product.productId, '3'); assert.equal(rows.some(r => r.product.productId === '4'), false);
  assert.deepEqual(rules.candidates(products, '3', [], {}), []);
});
test('explicit reviewed pairs are directional and require enabled reason and differences', () => {
  const target = product('8', 10, { category: 'Different', title: 'Staff approved option' });
  const approval = { from: '1', to: '8', enabled: true, reason: 'Reviewed for this product', differences: 'Different brand' };
  assert.equal(rules.eligibility(source, target, [approval]).kind, 'approved_pair');
  assert.equal(rules.eligibility(target, source, [approval]), null);
  assert.equal(rules.eligibility(source, target, [{ ...approval, differences: '' }]), null);
});
test('shortage replaces only unavailable local pieces while whole replaces every requested piece', () => {
  assert.deepEqual(rules.quantities(12, 2, 'shortage'), { keep: 2, replace: 10 });
  assert.deepEqual(rules.quantities(12, 2, 'whole'), { keep: 0, replace: 12 });
  assert.deepEqual(rules.quantities(12, 2.7, 'shortage'), { keep: 2, replace: 10 });
  assert.deepEqual(rules.quantities(12, 0, 'shortage'), { keep: 0, replace: 12 });
  for (const args of [[1.5, 1, 'whole'], [12, -1, 'shortage'], [12, 2, 'bad'], [10000, 2, 'whole']]) assert.throws(() => rules.quantities(...args));
});
function fixture(options = {}) {
  let cart = { store: 'Caldwell', items: [{ pid: '1', code: 'CODE1', quantity: 12, unit: 'ea', configured: false, price: 500 }, { pid: '9', code: 'UNCHANGED', quantity: 2, unit: 'bag', configured: false, price: 300 }] };
  if (options.existing) cart.items.push({ pid: '2', code: 'CODE2', quantity: options.existing, unit: 'ea', configured: false, price: 650 });
  const calls = [], copy = () => structuredClone(cart);
  const io = {
    read: async () => { calls.push(['read']); if (options.readFailsAfterAdd && calls.some(c => c[0] === 'add')) throw Error('Read failed'); return copy(); },
    stock: async pid => ({ verified: !options.unknownStock, branches: { Caldwell: pid === '1' ? (options.local ?? 2) : (options.targetStock ?? 100) } }),
    product: async pid => ({ pid, name: pid === '1' ? source.title : replacement.title, code: 'CODE' + pid, unit: 'ea', price: pid === '1' ? 500 : (Object.hasOwn(options, 'targetPrice') ? options.targetPrice : 650) }),
    add: async (info, quantity) => { calls.push(['add', info.pid, quantity]); if (options.addRejected) throw Error('Rejected'); let row = cart.items.find(r => r.pid === info.pid); if (row) row.quantity += quantity; else cart.items.push({ pid: info.pid, code: info.code, quantity, unit: 'ea', configured: false, price: info.price }); if (options.concurrentEdit) cart.items.find(r => r.pid === '9').quantity++; if (options.addReplyLost) throw Error('Reply lost'); },
    change: async (before, pid, quantity) => { calls.push(['change', pid, quantity]); if (pid === '1' && options.reduceRejected) throw Error('Rejected'); if (pid === '2' && options.rollbackRejected) throw Error('Rejected'); if (quantity) cart.items.find(r => r.pid === pid).quantity = quantity; else cart.items = cart.items.filter(r => r.pid !== pid); if (pid === '1' && options.reduceReplyLost) throw Error('Reply lost'); }
  };
  return { io, calls, get: copy, edit: fn => fn(cart), options };
}
test('partial swap adds and verifies ten pieces before retaining two originals; unrelated line unchanged', async () => {
  const f = fixture(), quote = await core.prepare(f.io, rules, source, replacement, 'shortage');
  assert.equal(quote.delta, 1500);
  await core.swap(f.io, rules, quote);
  assert.deepEqual(f.get().items.map(r => [r.pid, r.quantity]), [['1', 2], ['9', 2], ['2', 10]]);
  const writes = f.calls.filter(c => ['add', 'change'].includes(c[0]));
  assert.deepEqual(writes, [['add', '2', 10], ['change', '1', 2]]);
});
test('whole-line swap removes the original only after replacement was verified', async () => {
  const f = fixture(), quote = await core.prepare(f.io, rules, source, replacement, 'whole');
  await core.swap(f.io, rules, quote);
  assert.deepEqual(f.get().items.map(r => [r.pid, r.quantity]), [['9', 2], ['2', 12]]);
});
test('existing replacement quantities count against available stock and are preserved', async () => {
  const f = fixture({ existing: 3, targetStock: 13 });
  const quote = await core.prepare(f.io, rules, source, replacement, 'shortage'); await core.swap(f.io, rules, quote);
  assert.equal(f.get().items.find(r => r.pid === '2').quantity, 13);
  const tooFew = fixture({ existing: 3, targetStock: 12 });
  await assert.rejects(core.prepare(tooFew.io, rules, source, replacement, 'shortage'), /enough stock/);
});
test('unknown inventory, unconfirmed price, configured source and title drift cannot produce an applicable choice', async () => {
  for (const opts of [{ unknownStock: true }, { targetPrice: null }, { targetStock: 9 }]) {
    const f = fixture(opts); await assert.rejects(core.prepare(f.io, rules, source, replacement, 'shortage')); assert.equal(f.calls.some(c => c[0] === 'add'), false);
  }
  const f = fixture(); f.edit(c => { c.items[0].configured = true; }); await assert.rejects(core.prepare(f.io, rules, source, replacement, 'whole'));
  const drift = fixture(); const original = drift.io.product; drift.io.product = async pid => ({ ...await original(pid), name: (await original(pid)).name + ' (Stud GR)' });
  await assert.rejects(core.prepare(drift.io, rules, source, replacement, 'shortage'));
});
test('cart, store, stock and price changes after the customer reviews a choice require review again before any write', async () => {
  for (const mutation of [f => f.edit(c => { c.items[1].quantity++; }), f => f.edit(c => { c.store = 'Bryan'; }), f => { f.options.local = 3; }, f => { f.options.targetPrice = 700; }]) {
    const f = fixture(), quote = await core.prepare(f.io, rules, source, replacement, 'shortage'); mutation(f);
    await assert.rejects(core.swap(f.io, rules, quote)); assert.equal(f.calls.some(c => c[0] === 'add'), false);
  }
});
test('an old review cannot apply even when quantities and prices have stayed the same', async () => {
  const f = fixture(), quote = await core.prepare(f.io, rules, source, replacement, 'whole'); quote.at -= 120001;
  await assert.rejects(core.swap(f.io, rules, quote), /Review this choice again/); assert.equal(f.calls.some(c => c[0] === 'add'), false);
});
test('lost POST replies are reconciled by reading and never result in repeated additions', async () => {
  const f = fixture({ addReplyLost: true, reduceReplyLost: true });
  await core.swap(f.io, rules, await core.prepare(f.io, rules, source, replacement, 'shortage'));
  assert.equal(f.calls.filter(c => c[0] === 'add').length, 1); assert.equal(f.calls.filter(c => c[0] === 'change').length, 1);
});
test('failed addition leaves the original exactly intact and never attempts a reduction', async () => {
  const f = fixture({ addRejected: true }), before = core.signature(f.get());
  await assert.rejects(core.swap(f.io, rules, await core.prepare(f.io, rules, source, replacement, 'whole')), error => error.safeCart === true && !error.reviewCart);
  assert.equal(core.signature(f.get()), before); assert.equal(f.calls.some(c => c[0] === 'change'), false);
});
test('failed reduction compensates the verified addition without losing any pre-existing alternative quantity', async () => {
  const f = fixture({ existing: 3, reduceRejected: true }), before = core.signature(f.get());
  await assert.rejects(core.swap(f.io, rules, await core.prepare(f.io, rules, source, replacement, 'shortage')), error => error.safeCart === true);
  assert.equal(core.signature(f.get()), before);
  assert.deepEqual(f.calls.filter(c => c[0] === 'change'), [['change', '1', 2], ['change', '2', 3]]);
});
test('concurrent edits prevent any reduction or compensation that might overwrite customer changes', async () => {
  const f = fixture({ concurrentEdit: true });
  await assert.rejects(core.swap(f.io, rules, await core.prepare(f.io, rules, source, replacement, 'shortage')), error => error.reviewCart === true);
  assert.equal(f.calls.some(c => c[0] === 'change'), false); assert.equal(f.get().items[0].quantity, 12); assert.equal(f.get().items[1].quantity, 3);
});
test('unreadable state after a write and failed compensation always require actual-cart review', async () => {
  for (const options of [{ readFailsAfterAdd: true }, { reduceRejected: true, rollbackRejected: true }]) {
    const f = fixture(options); await assert.rejects(core.swap(f.io, rules, await core.prepare(f.io, rules, source, replacement, 'shortage')), error => error.reviewCart === true);
    assert.equal(f.calls.filter(c => c[0] === 'add').length, 1);
  }
});
test('the native form serializer preserves successful fields and rejects checkout/order or foreign targets', () => {
  const fields = [{ name: '__VIEWSTATE', value: 'opaque', type: 'hidden' }, { name: 'disabled', value: 'x', disabled: true }, { name: 'unchecked', type: 'checkbox', checked: false }, { name: 'unrelated', value: 'keep', type: 'text' }];
  const form = { elements: fields, getAttribute: () => '/ShoppingCart.aspx' }, page = { querySelector: () => form };
  const control = { getAttribute: name => name === 'href' ? 'javascript:__doPostBack("ctl00$PageBody$CartLineControl_7$refQty_1", "")' : null };
  const result = new URLSearchParams(core.formPost(page, control, '/ShoppingCart.aspx', d => d.set('wanted', '2')).body);
  assert.equal(result.get('__VIEWSTATE'), 'opaque'); assert.equal(result.get('unrelated'), 'keep'); assert.equal(result.has('disabled'), false); assert.equal(result.has('unchecked'), false);
  for (const target of ['ctl00$PageBody$CompleteCheckoutButton', 'ctl00$PageBody$PlaceOrderButton', 'ctl00$PageBody$EmptyCartButton']) assert.throws(() => core.formPost(page, { getAttribute: () => `javascript:__doPostBack("${target}", "")` }, '/ShoppingCart.aspx'));
  assert.throws(() => core.formPost({ querySelector: () => ({ ...form, getAttribute: () => 'https://example.com/ShoppingCart.aspx' }) }, control, '/ShoppingCart.aspx'));
  assert.throws(() => core.formPost({ querySelector: () => ({ ...form, getAttribute: () => '/ProductDetail.aspx?pid=999' }) }, { getAttribute: () => 'javascript:__doPostBack("ctl00$PageBody$productDetail$ctl00$AddProductButton", "")' }, '/ProductDetail.aspx?pid=2'));
});
test('native quantity serialization updates Telerik state without rewriting unrelated state', () => {
  const data = new URLSearchParams(), input = { name: 'qty', id: 'quantity' };
  core.setQuantity(data, { getElementById: () => ({ name: 'clientstate', value: '{"other":"keep","valueAsString":"12"}' }) }, input, 2);
  const state = JSON.parse(data.get('clientstate')); assert.equal(data.get('qty'), '2'); assert.equal(state.valueAsString, '2'); assert.equal(state.other, 'keep');
});
function request(handler, method, data = {}, headers = {}) {
  return new Promise(resolve => {
    const response = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(value) { resolve({ status: this.statusCode, data: value ? JSON.parse(value) : null, headers: this.headers }); } };
    handler({ method, headers: { origin: 'https://webtrack.woodsonlumber.com', 'content-type': 'application/json', ...headers }, query: method === 'GET' ? data : {}, body: method === 'POST' ? data : undefined }, response);
  });
}
test('suggestion → accepted choice → future ranking traverses the real API and history boundary without PII', async () => {
  history._test.reset(); endpoint.reset();
  const catalog = { fresh: true, products: [source, replacement, product('3', 14)] };
  const handler = endpoint.createHandler({ catalog: async () => catalog });
  const suggestions = await request(handler, 'GET', { pid: '1' }); assert.equal(suggestions.status, 200); assert.equal(suggestions.data.suggestions.length, 2);
  const receipt = suggestions.data.suggestions[1].receipt;
  const body = { receipt, scope: 'shortage', quantity: 10, store: 'Caldwell', email: 'must-not-store@example.test', account: 'must-not-store', notes: 'must-not-store' };
  const accepted = await request(handler, 'POST', body); assert.equal(accepted.data.recorded, true);
  const duplicate = await request(handler, 'POST', body); assert.equal(duplicate.data.recorded, false);
  assert.deepEqual(await history.counts('1'), { 3: 1 });
  assert.equal(JSON.stringify(history._test.memory.events).includes('must-not-store'), false);
  assert.equal(history._test.memory.events[0].fulfillmentConfirmed, false);
  assert.equal(history._test.memory.events[0].evidence, 'customer_selected_cart_swap');
  assert.deepEqual(await history.counts('3'), {});
  for (let i = 0; i < 2; i++) {
    const again = await request(handler, 'GET', { pid: '1' });
    const offer = again.data.suggestions.find(row => row.productId === '3');
    assert.equal((await request(handler, 'POST', { ...body, receipt: offer.receipt })).data.recorded, true);
  }
  const learned = await request(handler, 'GET', { pid: '1' });
  assert.equal(learned.data.suggestions[0].productId, '3');
});
test('receipt mismatch, stale products, invalid quantities and hostile origins cannot train the matcher', async () => {
  history._test.reset(); endpoint.reset();
  const catalog = { fresh: true, products: [source, replacement] }, handler = endpoint.createHandler({ catalog: async () => catalog });
  const suggestions = await request(handler, 'GET', { pid: '1' }), receipt = suggestions.data.suggestions[0].receipt;
  for (const bad of [{ quantity: 1.5 }, { quantity: 0 }, { scope: 'auto' }, { store: 'Unknown' }]) assert.equal((await request(handler, 'POST', { receipt, quantity: 10, scope: 'shortage', store: 'Caldwell', ...bad })).status, 400);
  assert.equal((await request(handler, 'POST', { receipt, quantity: 10, scope: 'shortage', store: 'Caldwell' }, { origin: 'https://evil.example' })).status, 403);
  catalog.products[1] = product('2', 12, { title: '2 X 6 - 12 #2 Yellow Pine' });
  assert.equal((await request(handler, 'POST', { receipt, quantity: 10, scope: 'shortage', store: 'Caldwell' })).status, 409);
  assert.deepEqual(await history.counts('1'), {});
});
test('unavailable catalog and empty eligibility leave an optional empty response, not a checkout action', async () => {
  endpoint.reset();
  assert.equal((await request(endpoint.createHandler({ catalog: async () => ({ fresh: false, products: [] }) }), 'GET', { pid: '1' })).status, 503);
  const empty = await request(endpoint.createHandler({ catalog: async () => ({ fresh: true, products: [source] }) }), 'GET', { pid: '1' });
  assert.deepEqual(empty.data.suggestions, []);
});
test('test storage cannot connect to Redis, while preview and production offers occupy separate namespaces', async () => {
  const fs = require('node:fs'), vm = require('node:vm'), code = fs.readFileSync(require.resolve('../api/substitution-history'), 'utf8'), writes = [];
  function load(mode) {
    const context = { module: { exports: {} }, process: { env: { NODE_ENV: mode === 'test' ? 'test' : 'production', VERCEL_ENV: mode, UPSTASH_REDIS_REST_URL: 'configured', UPSTASH_REDIS_REST_TOKEN: 'configured' } }, Date, Map };
    context.require = name => name === '@upstash/redis' ? { Redis: { fromEnv() { if (mode === 'test') throw Error('Test attempted external Redis'); return { set: async key => writes.push(key) }; } } } : require(name);
    vm.runInNewContext(code, context); return context.module.exports;
  }
  assert.ok(await load('test').offer('1', '2', 'rule'));
  await load('production').offer('1', '2', 'rule'); await load('preview').offer('1', '2', 'rule');
  assert.equal(writes.length, 2); assert.notEqual(writes[0].split('offer:')[0], writes[1].split('offer:')[0]);
});
