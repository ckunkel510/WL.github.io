'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const pairing = require('../ProductPairing');
const p = pairing.pair;
function fixture(options = {}) {
  let cart = {store: 'Bryan', items: [{pid: '900', code: 'KEEP-ME', quantity: 3, unit: 'bag', configured: false, price: 525}]};
  const calls = [], products = {
    [p.camera]: {pid: p.camera, code: p.cameraCode, name: p.cameraName, unit: 'ea', price: 9999},
    [p.battery]: {pid: p.battery, code: p.batteryCode, name: p.batteryName, unit: 'ea', price: 1039}
  };
  if (options.existing) for (const id of [p.camera, p.battery]) cart.items.push({...products[id], quantity: 2, configured: false});
  const io = {
    read: async () => { calls.push(['read']); if (options.readFails && calls.some(c => c[0] === 'add')) throw Error('Unavailable'); return structuredClone(cart); },
    product: async id => { calls.push(['product', id]); return {...products[id]}; },
    stock: async id => ({verified: !options.unknownStock, branches: {Bryan: options.stock ?? 20, Brenham: 0}}),
    add: async (product, quantity) => {
      calls.push(['add', product.pid, quantity]);
      if (options.reject === product.pid) throw Error('Rejected');
      const row = cart.items.find(r => r.pid === product.pid);
      if (row) row.quantity += quantity;
      else cart.items.push({pid: product.pid, code: product.code, quantity, unit: 'ea', configured: false, price: product.price});
      if (options.concurrentEdit) cart.items[0].quantity++;
      if (options.lostReply) throw Error('Network reply lost');
      if (options.afterAdd) options.afterAdd(product.pid, products, cart);
    }
  };
  return {io, options, products, calls, get: () => structuredClone(cart), edit: f => f(cart)};
}
test('staged boot makes no DOM, cart or network calls, even when a caller passes releaseApproved', () => {
  const page = new Proxy({}, {get() { throw Error('Touched live page'); }});
  assert.equal(pairing.enabled, false); assert.equal(pairing.boot(page, {releaseApproved: true}), undefined);
});
test('exact optional spare pair uses current native prices and never injects the email promo', async () => {
  const f = fixture(), q = await pairing.prepare(f.io);
  assert.equal(q.total, 11038); assert.equal(q.camera.price, 9999);
  assert.match(p.disclosure, /already includes 8 AA/); assert.match(p.disclosure, /optional/);
  assert.match(p.compatibility, /1.5V alkaline/);
  assert.equal(f.calls.some(c => c[0] === 'add'), false);
});
test('customer must explicitly select the extra batteries before either item can be added', async () => {
  const f = fixture(), q = await pairing.prepare(f.io);
  for (const choice of [undefined, false, 'true']) await assert.rejects(pairing.addBoth(f.io, q, choice), /Select the optional/);
  assert.equal(f.calls.some(c => c[0] === 'add'), false);
});
test('one customer click adds one of each, reads back the complete cart and preserves unrelated items', async () => {
  const f = fixture(), q = await pairing.prepare(f.io), result = await pairing.addBoth(f.io, q, true);
  assert.equal(result.status, 'added');
  assert.deepEqual(f.get().items.map(r => [r.pid, r.quantity]), [['900', 3], [p.camera, 1], [p.battery, 1]]);
  assert.deepEqual(f.calls.filter(c => c[0] === 'add'), [['add', p.camera, 1], ['add', p.battery, 1]]);
});
test('pre-existing camera and battery quantities are incremented rather than overwritten', async () => {
  const f = fixture({existing: true}); await pairing.addBoth(f.io, await pairing.prepare(f.io), true);
  assert.deepEqual(f.get().items.map(r => [r.pid, r.quantity]), [['900', 3], [p.camera, 3], [p.battery, 3]]);
  const low = fixture({existing: true, stock: 2}); await assert.rejects(pairing.prepare(low.io), /not confirmed in stock/);
});
test('unknown or local out-of-stock inventory never becomes a pickup promise or a write', async () => {
  for (const options of [{unknownStock: true}, {stock: 0}]) { const f = fixture(options); await assert.rejects(pairing.prepare(f.io)); assert.equal(f.calls.some(c => c[0] === 'add'), false); }
  const f = fixture(); f.edit(c => c.store = 'Brenham'); await assert.rejects(pairing.prepare(f.io), /selected store/);
});
test('SKU, battery pack, native title, unit and price drift all fail closed', async () => {
  for (const mutation of [f => f.products[p.camera].code = 'WGI-OTHER', f => f.products[p.battery].name = 'Energizer AAA Battery 8pk', f => f.products[p.battery].unit = 'pack', f => f.products[p.camera].price = null]) {
    const f = fixture(); mutation(f); await assert.rejects(pairing.prepare(f.io), /exact products/);
  }
  const f = fixture({existing: true}); f.edit(c => c.items[1].configured = true); await assert.rejects(pairing.prepare(f.io), /existing cart line/);
});
test('cart, branch, price changes and expired/future quote require another review before writes', async () => {
  for (const mutation of [(f,q) => f.edit(c => c.items[0].quantity++), (f,q) => f.edit(c => c.store = 'Brenham'), f => f.products[p.camera].price++, (f,q) => q.at -= 120001, (f,q) => q.at += 120001]) {
    const f = fixture(), q = await pairing.prepare(f.io); mutation(f,q); await assert.rejects(pairing.addBoth(f.io,q,true)); assert.equal(f.calls.some(c => c[0] === 'add'), false);
  }
});
test('lost replies are reconciled once and never cause duplicate additions', async () => {
  const f = fixture({lostReply: true}), q = await pairing.prepare(f.io);
  await pairing.addBoth(f.io,q,true); assert.equal(f.calls.filter(c => c[0] === 'add').length, 2);
  await assert.rejects(pairing.addBoth(f.io,q,true), /fresh cart review/); assert.equal(f.calls.filter(c => c[0] === 'add').length, 2);
});
test('double click cannot start a second native addition', async () => {
  const f = fixture(), q = await pairing.prepare(f.io);
  const a = pairing.addBoth(f.io,q,true), b = pairing.addBoth(f.io,q,true);
  const result = await Promise.allSettled([a,b]); assert.equal(result.filter(r => r.status === 'fulfilled').length,1);
  assert.equal(f.calls.filter(c => c[0] === 'add').length,2);
});
test('rejected camera is verified unchanged; no battery or quantity rewrite follows', async () => {
  const f = fixture({reject: p.camera}), before = pairing.snapshot(f.get());
  await assert.rejects(pairing.addBoth(f.io,await pairing.prepare(f.io),true), e => e.safeCart === true);
  assert.equal(pairing.snapshot(f.get()),before); assert.equal(f.calls.filter(c => c[0] === 'add').length,1);
});
test('a rejected second item gives explicit partial-cart review and never retries, rolls back or drops old quantities', async () => {
  const f = fixture({existing: true, reject: p.battery}), q = await pairing.prepare(f.io);
  await assert.rejects(pairing.addBoth(f.io,q,true), e => e.reviewCart === true);
  assert.deepEqual(f.get().items.map(r => [r.pid,r.quantity]), [['900',3],[p.camera,3],[p.battery,2]]);
  await assert.rejects(pairing.addBoth(f.io,q,true)); assert.equal(f.calls.filter(c => c[0] === 'add').length,2);
});
test('concurrent edits and unreadable post-write states stop before another addition', async () => {
  for (const options of [{concurrentEdit:true},{readFails:true}]) {
    const f=fixture(options); await assert.rejects(pairing.addBoth(f.io,await pairing.prepare(f.io),true),e=>e.reviewCart===true);
    assert.equal(f.calls.filter(c=>c[0]==='add').length,1);
    assert.equal(f.get().items[0].quantity,options.concurrentEdit?4:3);
  }
});
test('second product is re-read after first addition; intervening price or stock change stops the pair', async () => {
  const f=fixture({afterAdd:(id,products)=>{if(id===p.camera)products[p.battery].price++;}});
  await assert.rejects(pairing.addBoth(f.io,await pairing.prepare(f.io),true),e=>e.reviewCart===true);
  assert.equal(f.calls.filter(c=>c[0]==='add').length,1);
});
test('invalid or ambiguous cart rows cannot be silently omitted',()=>{
  for(const items of [[{pid:'1',code:'A',quantity:0,unit:'ea'}],[{pid:'1',code:'A',quantity:1,unit:'ea'},{pid:'1',code:'A',quantity:1,unit:'ea'}]])assert.throws(()=>pairing.snapshot({store:'Bryan',items}));
});
