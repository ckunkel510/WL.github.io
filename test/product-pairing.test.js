'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const pairing = require('../ProductPairing');
const p = pairing.pair;
function fixture(options = {}) {
  const active = pairing.pairFor(options.camera || p.camera);
  let cart = {store: 'Bryan', items: [{pid: '900', code: 'KEEP-ME', quantity: 3, unit: 'bag', configured: false, price: 525}]};
  const calls = [], products = {
    [active.camera]: {pid: active.camera, code: active.cameraCode, name: active.cameraName, unit: 'ea', price: 9999},
    [p.battery]: {pid: p.battery, code: p.batteryCode, name: p.batteryName, unit: 'ea', price: 1039},
    '290616': {pid:'290616',code:'RFS32GB',name:'Reveal SD Memory Card, 32GB',unit:'ea',price:2499}
  };
  if (options.existing) for (const id of [active.camera, p.battery]) cart.items.push({...products[id], quantity: 2, configured: false});
  const io = {
    read: async () => { calls.push(['read']); if (options.readFails && calls.some(c => c[0] === 'add')) throw Error('Unavailable'); return structuredClone(cart); },
    product: async id => { calls.push(['product', id]); return {...products[id]}; },
    stock: async id => ({verified: !options.unknownStock, branches: {Bryan: options.stockByPid?.[id] ?? options.stock ?? 20, Brenham: 0}}),
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
test('boot stays off other origins, embedded pages and unreviewed products', async () => {
  for(const options of [{origin:'https://example.invalid',path:'/ProductDetail.aspx',pid:'174184'},{origin:'https://webtrack.woodsonlumber.com',path:'/ShoppingCart.aspx',pid:'174184'},{origin:'https://webtrack.woodsonlumber.com',path:'/ProductDetail.aspx',pid:'999'}]){
    const page={location:{origin:options.origin,pathname:options.path,search:'?pid='+options.pid},document:new Proxy({},{get(){throw Error('Out of scope DOM access');}})};page.top=page;
    await pairing.boot(page);
  }
});
test('exact optional spare pair uses current native prices and never injects the email promo', async () => {
  const f = fixture(), q = await pairing.prepare(f.io);
  assert.equal(q.total, 11038); assert.equal(q.camera.price, 9999);
  assert.match(p.disclosure, /SPARK combo: 8 AA/); assert.match(p.disclosure, /optional/);
  assert.match(p.compatibility, /eight matching fresh AA/);
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
test('GMAX is its own exact reviewed match and receives the selected number of complete AA8 packs',async()=>{
 const f=fixture({camera:'174184'}),q=await pairing.prepare(f.io,'174184',3);assert.equal(q.pair.cameraCode,'STC-GMAX32VNG');assert.equal(q.total,33114);
 await pairing.addBoth(f.io,q,true);assert.deepEqual(f.get().items.map(r=>[r.pid,r.quantity]),[['900',3],['174184',3],['2853',3]]);
 await assert.rejects(pairing.prepare(f.io,'999',1),/no verified accessory match/);
});
test('guest company availability never requires account settings or claims local pickup',async()=>{
 const f=fixture();const read=f.io.read,product=f.io.product;
 f.io.read=async()=>({...await read(),store:'unconfirmed',scope:'company',sessionKind:'guest'});f.io.product=async id=>({...await product(id),sessionKind:'guest'});
 const q=await pairing.prepare(f.io);assert.equal(q.cart.store,'unconfirmed');await pairing.addBoth(f.io,q,true);assert.equal(f.calls.filter(c=>c[0]==='add').length,2);
});
test('signed-in pickup needs local stock; delivery may use verified company stock without a local promise',async()=>{
 const f=fixture();f.edit(c=>c.store='Brenham');await assert.rejects(pairing.prepare(f.io),/selected store/);
 const read=f.io.read;f.io.read=async()=>({...await read(),scope:'company'});assert.equal((await pairing.prepare(f.io)).cart.scope,'company');
});
test('sign-in, fulfillment scope or selected quantity changes invalidate the reviewed cart context',async()=>{
 for(const change of ['session','scope']){const f=fixture(),q=await pairing.prepare(f.io),read=f.io.read;f.io.read=async()=>({...await read(),...(change==='session'?{sessionKind:'signed_in'}:{scope:'company'})});await assert.rejects(pairing.addBoth(f.io,q,true));assert.equal(f.calls.some(c=>c[0]==='add'),false);}
 for(const n of [0,1.5,100,NaN])await assert.rejects(pairing.prepare(fixture().io,p.id,n),/whole quantity/);
});
test('guest product identity cannot be combined with a signed-in cart',async()=>{
 const f=fixture(),read=f.io.read,product=f.io.product;f.io.read=async()=>({...await read(),sessionKind:'signed_in'});f.io.product=async id=>({...await product(id),sessionKind:'guest'});await assert.rejects(pairing.prepare(f.io),/sign-in changed/);assert.equal(f.calls.some(c=>c[0]==='add'),false);
});
