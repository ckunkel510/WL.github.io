'use strict';
const {eligibility, chooseFlow} = require('./policy');

// Vendor-neutral runner. The production adapter MUST atomically recheck consent,
// purchase history, cross-campaign frequency and idempotency while reserving.
// A naive get-then-set reservation is not a conforming adapter.
async function runBatch({contactIds, campaigns, adapter, now = Date.now(), dryRun = true}) {
  if (!adapter || typeof adapter.snapshot !== 'function') throw new Error('Authoritative snapshot adapter required');
  if (!dryRun && (typeof adapter.reserveAndRecheck !== 'function' || typeof adapter.deliver !== 'function' || typeof adapter.finish !== 'function')) throw new Error('Transactional send adapter required');
  const results = [];
  for (const id of [...new Set(contactIds || [])]) {
    const snapshot = await adapter.snapshot(id);
    if (snapshot?.contact?.id !== id) {results.push({contactId:id,status:'suppressed',reasons:['identity_mismatch']});continue;}
    const candidates = campaigns.map(campaign => ({...campaign, decision:eligibility({...snapshot, campaign, now})}));
    const winner = chooseFlow(candidates);
    if (!winner) {results.push({contactId:id, status:'suppressed', reasons:[...new Set(candidates.map(x=>x.decision.reason))]}); continue;}
    if (dryRun) {results.push({contactId:id,campaignId:winner.id,status:'would_send'});continue;}
    const reservation = await adapter.reserveAndRecheck({contactId:id,campaign:winner,now,policy:eligibility});
    if (!reservation?.acquired || !reservation.idempotencyKey || reservation.decision?.eligible!==true || reservation.reviewHash!==winner.review.hash) {results.push({contactId:id,status:'suppressed',reasons:['reservation_denied']});continue;}
    try {
      const delivery = await adapter.deliver({contactId:id,campaign:winner,reviewManifest:winner.reviewManifest,reviewHash:winner.review.hash,productRoutes:reservation.decision.productRoutes,idempotencyKey:reservation.idempotencyKey});
      if (!delivery?.providerMessageId) throw new Error('Delivery unconfirmed');
      await adapter.finish(reservation,{status:'sent',providerMessageId:delivery.providerMessageId});
      results.push({contactId:id,campaignId:winner.id,status:'sent'});
    } catch {
      // A timeout may have sent. Keep the reservation charged to the frequency cap.
      // Reconcile with the provider; never retry automatically with a new key.
      await adapter.finish(reservation,{status:'uncertain'});
      results.push({contactId:id,campaignId:winner.id,status:'uncertain'});
    }
  }
  return results;
}
module.exports = {runBatch};
