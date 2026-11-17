'use strict';
const {createHash} = require('node:crypto');
const HOUR=3600000;
const time=value=>{const n=Date.parse(value);return Number.isFinite(n)?n:null;};
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
}
function reviewProducts(products=[]) {
  const fields=['productId','sku','title','image','url','price','currency','regularPrice','offerTerms','offerStartsAt','offerEndsAt','unit','quantityRequired'];
  return products.map(p=>Object.fromEntries(fields.filter(k=>p[k]!==undefined).map(k=>[k,p[k]])));
}
// This exact reviewed payload is the renderer/provider input. Inventory evidence
// may refresh, but creative, price, product or routing-copy changes need review.
function reviewHash(manifest) {
  if (!manifest || !manifest.campaignId || !manifest.revision || !manifest.subject || !manifest.html ||
      !manifest.audience || !Array.isArray(manifest.products) || time(manifest.scheduledFor)===null) throw Error('Complete review manifest required');
  return createHash('sha256').update(JSON.stringify(canonical(manifest))).digest('hex');
}
function createReview(manifest, {now=Date.now()}={}) {
  const hash=reviewHash(manifest), scheduled=time(manifest.scheduledFor);
  if (scheduled-now < 24*HOUR) throw Error('Allow at least 24 hours for creative review; move the release');
  return {campaignId:manifest.campaignId,revision:manifest.revision,hash,scheduledFor:manifest.scheduledFor,
    submittedAt:new Date(now).toISOString(),reviewAt:new Date(Math.max(now,scheduled-48*HOUR)).toISOString(),
    reminderAt:new Date(scheduled-24*HOUR).toISOString(),deadline:new Date(scheduled-6*HOUR).toISOString(),
    status:'pending',approval:null};
}
// Call only after a trusted adapter authenticates the owner and persists an
// append-only approval audit. A browser checkbox/local preview is not approval.
function approveReview(record,manifest,{owner,now=Date.now()}={}) {
  if (!owner || record?.status!=='pending' || time(record.deadline)===null || now>=time(record.deadline) || record.hash!==reviewHash(manifest)) throw Error('Current owner approval before deadline required');
  return {...record,status:'approved',approval:{owner,at:new Date(now).toISOString(),hash:record.hash}};
}
function releaseGate(campaign,now=Date.now()) {
  const record=campaign?.review,manifest=campaign?.reviewManifest;
  if (!record || !manifest || record.status!=='approved' || !record.approval?.owner) return 'creative_review';
  let hash;try{hash=reviewHash(manifest);}catch{return 'review_manifest';}
  if (record.hash!==hash || record.approval.hash!==hash || record.campaignId!==campaign.id || manifest.campaignId!==campaign.id || record.revision!==campaign.revision || manifest.revision!==campaign.revision ||
      manifest.category!==campaign.category || manifest.audience?.mode!==campaign.audience || manifest.themeId!==campaign.themeId ||
      JSON.stringify(canonical(manifest.audience.targeting||{}))!==JSON.stringify(canonical(campaign.targeting||{})) ||
      JSON.stringify(canonical(manifest.articles||[]))!==JSON.stringify(canonical(campaign.articles||[])) ||
      JSON.stringify(canonical(manifest.seasonality||{}))!==JSON.stringify(canonical(campaign.seasonality||{})) ||
      JSON.stringify(canonical(manifest.fulfillment||{}))!==JSON.stringify(canonical({method:campaign.fulfillment||'auto',store:campaign.store||null,minimumQuantity:campaign.minimumQuantity||1})) ||
      JSON.stringify(canonical(manifest.products))!==JSON.stringify(canonical(reviewProducts(campaign.products)))) return 'review_changed';
  const approved=time(record.approval.at),submitted=time(record.submittedAt),scheduled=time(record.scheduledFor),deadline=time(record.deadline);
  if ([approved,submitted,scheduled,deadline].some(x=>x===null) || approved<submitted || approved>=deadline || approved>now || scheduled-submitted<24*HOUR || record.scheduledFor!==manifest.scheduledFor) return 'review_timing';
  // Never silently roll a missed or held release to another day.
  if (now<scheduled || now>=scheduled+HOUR) return 'release_window';
  return null;
}
function queueStatus(record,now=Date.now()) {
  if (!record || time(record.deadline)===null) return 'invalid';
  if (record.status==='approved') return now>=time(record.scheduledFor)+HOUR?'expired':'approved';
  if (record.status==='rejected') return 'rejected';
  if (now>=time(record.deadline)) return 'held';
  if (now>=time(record.reminderAt)) return 'approval_reminder';
  return now>=time(record.reviewAt)?'ready_for_review':'preparing';
}
module.exports={reviewHash,reviewProducts,createReview,approveReview,releaseGate,queueStatus};
