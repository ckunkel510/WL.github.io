'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const core = require('../PickupAvailability');
const thursday = new Date('2026-11-12T17:30:00Z');
const ranger = { pid: '313359', code: 'TB-RANG-RVR', name: 'Turtlebox Ranger - River Rock', quantity: 12 };
function stock(local = 2, other = 7) { return { verified: true, branches: Object.fromEntries(core.stores.map(name => [name, name === 'Caldwell' ? local : name === 'Groesbeck' ? other : 0])) }; }
function plan(quantity = 12, inventory = stock(), choice = 'together', now = thursday, label = 'Caldwell - Store') { return core.plan([{ ...ranger, quantity }], { '313359': inventory }, label, now, choice); }
test('the Turtlebox case allocates 12 as 2 local, 7 transfers and 3 supplier units', () => {
  const p = plan(); assert.equal(p.items[0].local, 2); assert.equal(p.items[0].transfer, 7); assert.equal(p.items[0].supplier, 3); assert.equal(p.items[0].total, 9);
  assert.equal(p.min, '2026-11-26'); assert.equal(p.canSplit, true); assert.equal(p.split, false);
});
test('partial pickup permits only the locally available quantities on the first date', () => {
  const p = plan(12, stock(), 'split'); assert.equal(p.min, '2026-11-12'); assert.equal(p.split, true);
  const note = core.instruction(p, '2026-11-12', '2:00 PM–3:00 PM');
  assert.match(note, /first pickup for local quantities only/); assert.match(note, /2 local, 7 transfer/); assert.match(note, /3 supplier order/); assert.match(note, /arrange remaining pickup/); assert.match(note, /no guaranteed ready date/);
});
test('exact local and companywide stock boundaries select the correct floor', () => {
  assert.equal(plan(2).min, '2026-11-12'); assert.equal(plan(2).delayed, false);
  for (const q of [3, 9]) { const p = plan(q); assert.equal(p.min, '2026-11-16'); assert.equal(p.items[0].supplier, 0); }
  assert.equal(plan(10).min, '2026-11-26');
  assert.equal(plan(12, stock(12, 0)).canSplit, false);
});
test('a store change reallocates quantities and uses selected store inventory', () => {
  const p = plan(3, stock(), 'together', thursday, 'Groesbeck - Store'); assert.equal(p.items[0].local, 3); assert.equal(p.delayed, false);
  const absent = plan(3, stock(), 'together', thursday, 'Brenham - Store'); assert.equal(absent.items[0].local, 0); assert.equal(absent.items[0].transfer, 3); assert.equal(absent.canSplit, false);
});
test('unknown, failed, malformed and partial inventories never claim local or supplier availability', () => {
  for (const inv of [null, undefined, { verified: false, branches: {} }, { verified: true, branches: { Caldwell: 999 } }, { verified: true, branches: { ...stock().branches, Brenham: -1 } }]) {
    const p = core.plan([ranger], { '313359': inv }, 'Caldwell', thursday); assert.equal(p.items[0].local, 0); assert.equal(p.items[0].supplier, 0); assert.equal(p.items[0].unconfirmed, 12); assert.equal(p.min, '2026-11-26');
  }
  assert.equal(plan(12, stock(), 'together', thursday, 'Unknown').items[0].unconfirmed, 12);
});
test('configured products require confirmation even when their base product is in stock', () => {
  const p = core.plan([{ ...ranger, configured: true }], { '313359': stock(100, 100) }, 'Caldwell', thursday);
  assert.equal(p.items[0].unconfirmed, 12); assert.equal(p.items[0].local, 0);
});
test('mixed products can request available items first without moving the entire order to the early date', () => {
  const p = core.plan([{ ...ranger, quantity: 2 }, { pid: '85', code: 'FISH', name: 'Fish chow', quantity: 1 }], { '313359': stock(), '85': stock(0, 0) }, 'Caldwell', thursday, 'split');
  assert.equal(p.split, true); assert.equal(p.min, '2026-11-12'); assert.equal(p.items[1].supplier, 1); assert.equal(p.items[0].local, 2);
});
test('fractions and negative source stock cannot produce over-allocation', () => {
  const p = plan(3.5, stock(1.25, 0.75)); const row = p.items[0]; assert.equal(row.local, 1.25); assert.equal(row.transfer, 0.75); assert.equal(row.supplier, 1.5);
  for (let q = 1; q < 50; q++) { const row = plan(q).items[0]; assert.equal(row.local + row.transfer + row.supplier, q); assert.ok(row.local <= 2); assert.ok(row.transfer <= 7); }
});
test('business-day transfer floor skips weekends and remains stable across DST', () => {
  assert.equal(core.after('2026-11-13', 2, true), '2026-11-17'); assert.equal(core.after('2026-10-30', 2, true), '2026-11-03');
  assert.equal(core.calendar(new Date('2026-11-13T00:30:00Z')).date, '2026-11-12');
});
test('late local pickup rolls to an open day and never exposes Sunday windows', () => {
  const p = plan(1, stock(), 'together', new Date('2026-11-14T20:00:00Z')); assert.equal(p.min, '2026-11-16');
  assert.deepEqual(core.timeChoices('2026-11-15', thursday), []); assert.deepEqual(core.timeChoices('2026-02-30', thursday), []);
  assert.deepEqual(core.timeChoices('2026-11-11', thursday), []); assert.equal(core.timeChoices('2026-11-14', thursday).at(-1).value, '3:00 PM–4:00 PM');
});
test('forged past, Sunday, too-early, out-of-range and obsolete time choices fail validation', () => {
  const p = plan(3); const slot = '8:00 AM–9:00 AM';
  for (const d of ['2026-11-12', '2026-11-15', '2026-12-25', '2026-02-30', 'bad']) assert.equal(core.validSchedule(p, d, slot, thursday), false);
  assert.equal(core.validSchedule(p, '2026-11-16', slot, thursday), true);
  assert.equal(core.validSchedule(p, '2026-11-16', '5:00 AM–6:00 AM', thursday), false);
  const local = plan(1); assert.equal(core.validSchedule(local, '2026-11-12', '1:00 PM–2:00 PM', thursday), false);
  assert.equal(core.validSchedule(local, '2026-11-12', '2:00 PM–3:00 PM', thursday), true);
  assert.equal(core.validSchedule(plan(), '2026-11-26', slot, new Date('2026-11-13T15:00:00Z')), false);
});
function stockDocument(rows) { return { querySelector: () => ({ querySelectorAll: () => rows.map(([name, qty]) => ({ querySelector: s => ({ textContent: s.includes('Branch') ? name : qty }) })) }) }; }
test('parser uses labeled Available values, rejects incomplete and duplicate stores, clamps negative stock', () => {
  const rows = core.stores.map(name => [name, name === 'Caldwell' ? '1,234.50' : '0']);
  assert.equal(core.stockFromDocument(stockDocument(rows)).branches.Caldwell, 1234.5);
  assert.equal(core.stockFromDocument(stockDocument(rows.slice(1))).verified, false);
  assert.equal(core.stockFromDocument(stockDocument(rows.concat([['Caldwell', '1']]))).verified, false);
  for (const qty of ['NA', 'In stock', '2 available', '1,2', '1,,000']) assert.equal(core.stockFromDocument(stockDocument(rows.map(r => r[0] === 'Caldwell' ? ['Caldwell', qty] : r))).verified, false);
  assert.equal(core.stockFromDocument(stockDocument(rows.map(r => r[0] === 'Caldwell' ? ['Caldwell', '-2'] : r))).branches.Caldwell, 0);
  assert.equal(core.stockFromDocument({ querySelector: () => null }).verified, false);
});
function cartDocument(rows, signedIn = true) { return { querySelector: s => s.includes('SignOut') ? signedIn ? {} : null : {}, querySelectorAll: () => rows.map(item => {
  const link = { getAttribute: () => '/ProductDetail.aspx?pid=' + item.pid, textContent: item.code };
  return { querySelectorAll: s => s.startsWith('a') ? [link] : [], querySelector: s => s.startsWith('input') ? { value: item.quantity } : s.startsWith('select') ? null : s.startsWith('.portal') ? link : { textContent: item.name } };
}) }; }
test('fresh native basket aggregates duplicate products, rejects unreadable rows and expired login', () => {
  const parsed = core.cartFromDocument(cartDocument([ranger, { ...ranger, quantity: 2 }])); assert.equal(parsed.length, 1); assert.equal(parsed[0].quantity, 14);
  for (const quantity of [0, -1, 'bad', Infinity]) assert.throws(() => core.cartFromDocument(cartDocument([{ ...ranger, quantity }])));
  assert.throws(() => core.cartFromDocument(cartDocument([], true))); assert.throws(() => core.cartFromDocument(cartDocument([ranger], false)));
});
test('pickup asset load shares one request, retries errors and times out without accepting stale dates', async () => {
  const fs = require('node:fs'), vm = require('node:vm'), source = fs.readFileSync(require.resolve('../Checkout2'), 'utf8');
  const block = source.slice(source.indexOf('  let pickupAvailabilityLoad;'), source.indexOf('  // WebTrack now receives'));
  const scripts = [], timers = []; const win = { setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {} };
  const context = vm.createContext({ window: win, pickupAssetBase: 'https://example.invalid/', document: { createElement: () => ({ remove() {} }), head: { appendChild: script => scripts.push(script) } } });
  vm.runInContext(block, context);
  const first = context.loadPickupAvailability(), same = context.loadPickupAvailability(); assert.equal(scripts.length, 1);
  scripts[0].onerror(); assert.equal(await first, null); assert.equal(await same, null);
  const next = context.loadPickupAvailability(); assert.equal(scripts.length, 2); timers.at(-1)(); assert.equal(await next, null);
  const success = context.loadPickupAvailability(); win.WLPickupAvailability = { build: 'fixture' }; scripts[2].onload(); assert.equal(await success, win.WLPickupAvailability);
  assert.equal(await context.loadPickupAvailability(), win.WLPickupAvailability); assert.equal(scripts.length, 3);
});
