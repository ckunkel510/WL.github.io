'use strict';
const crypto = require('node:crypto');
let Redis;
try { ({ Redis } = require('@upstash/redis')); } catch {}
let client;
const PREFIX = process.env.VERCEL_ENV === 'production' ? 'wl:substitutions:v1:' : 'wl:substitutions:preview:v1:';
const memory = { offers: new Map(), counts: new Map(), events: [] };
function redis() {
  if (testMemory()) return null;
  if (!Redis || !((process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) || (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN))) return null;
  return client || (client = Redis.fromEnv());
}
function testMemory() { return process.env.NODE_ENV === 'test'; }
async function counts(from) {
  const db = redis();
  if (db) return await db.hgetall(PREFIX + 'counts:' + from) || {};
  return testMemory() ? Object.fromEntries(memory.counts.get(from) || []) : {};
}
async function offer(from, to, rule) {
  const db = redis();
  if (!db && !testMemory()) return null;
  const token = crypto.randomUUID();
  const value = { from, to, rule, expiresAt: Date.now() + 15 * 60 * 1000 };
  if (db) await db.set(PREFIX + 'offer:' + token, value, { ex: 900 });
  else memory.offers.set(token, value);
  return token;
}
async function readOffer(token) {
  if (!/^[a-f0-9-]{36}$/.test(String(token || ''))) return null;
  const db = redis(), value = db ? await db.get(PREFIX + 'offer:' + token) : testMemory() ? memory.offers.get(token) : null;
  return value && value.expiresAt > Date.now() ? value : null;
}
// One atomic consume prevents duplicate counts on retry. Only a bounded recent
// anonymous event list and lifetime product-pair totals are retained. No PII.
const ACCEPT_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
redis.call('DEL', KEYS[1])
redis.call('HINCRBY', KEYS[2], ARGV[1], 1)
redis.call('LPUSH', KEYS[3], ARGV[2])
redis.call('LTRIM', KEYS[3], 0, 9999)
return 1`;
async function accept(token, selection) {
  const value = await readOffer(token);
  if (!value) return false;
  const record = { from: value.from, to: value.to, rule: value.rule, scope: selection.scope, quantity: selection.quantity, store: selection.store, at: new Date().toISOString(), evidence: 'customer_selected_cart_swap', fulfillmentConfirmed: false };
  const db = redis();
  if (db) return Number(await db.eval(ACCEPT_SCRIPT, [PREFIX + 'offer:' + token, PREFIX + 'counts:' + value.from, PREFIX + 'recent'], [value.to, JSON.stringify(record)])) === 1;
  if (!testMemory() || !memory.offers.delete(token)) return false;
  if (!memory.counts.has(value.from)) memory.counts.set(value.from, new Map());
  const pairs = memory.counts.get(value.from); pairs.set(value.to, (pairs.get(value.to) || 0) + 1);
  memory.events.unshift(record); memory.events.length = Math.min(memory.events.length, 10000);
  return true;
}
function reset() { memory.offers.clear(); memory.counts.clear(); memory.events.length = 0; }
module.exports = { counts, offer, readOffer, accept, _test: { reset, memory, ACCEPT_SCRIPT } };
