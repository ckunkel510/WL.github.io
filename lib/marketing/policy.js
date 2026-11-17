'use strict';

const DAY = 86400000;
const CATEGORIES = Object.keys(require('../../marketing/taxonomy.json').departments);
const {releaseGate}=require('./review');
const {seasonalGate}=require('./seasonality');
const {editorialGate}=require('./editorial');
const {opportunity,chooseFulfillment} = require('./merchandising');
const AUDIENCES = {
  trade_news: {label: 'Contractor and market news', editorialShare: 0.8, productShare: 0.2, sections: ['What changed', 'What it means for upcoming jobs', 'Planning checklist', 'Useful products']},
  deals: {label: 'Deals and savings', editorialShare: 0.2, productShare: 0.8, sections: ['Verified offer', 'Savings by project', 'Price and availability details']},
  project_tips: {label: 'Project tips and how-to', editorialShare: 0.6, productShare: 0.4, sections: ['A practical project', 'How to approach it', 'Materials and tools', 'Get help']}
};

function timestamp(value) { const n = Date.parse(value); return Number.isFinite(n) ? n : null; }

// This is a trusted server policy, not a public identity or consent endpoint.
// The adapter must supply authoritative consent, purchase history and an atomic ledger.
function eligibility({contact, campaign, ledger, weatherByStore, now = Date.now()}) {
  const fail = reason => ({eligible: false, reason});
  if (!contact || !contact.id || contact.permission !== 'explicit' || contact.marketingOptIn !== true || contact.status !== 'active') return fail('consent');
  if (contact.suppressed || contact.complaint || contact.hardBounce) return fail('suppressed');
  if (!campaign || !campaign.id || !campaign.themeId || !CATEGORIES.includes(campaign.category)) return fail('invalid_campaign');
  if (contact.excludedCategories?.includes(campaign.category)) return fail('excluded_interest');
  const approval = campaign.approval;
  if (!approval || approval.status !== 'approved' || !approval.owner || !approval.revision || approval.revision !== campaign.revision ||
      timestamp(approval.expiresAt) === null || timestamp(approval.expiresAt) <= now ||
      !approval.categories?.includes(campaign.category) || !approval.audiences?.includes(campaign.audience) ||
      approval.themeId !== campaign.themeId) return fail('approval');
  if (timestamp(campaign.notBefore) === null || timestamp(campaign.expiresAt) === null || now < timestamp(campaign.notBefore) || now >= timestamp(campaign.expiresAt)) return fail('campaign_window');
  const reviewFailure=releaseGate(campaign,now);
  if(reviewFailure) return fail(reviewFailure);
  const editorialFailure=editorialGate(campaign,now);
  if(editorialFailure) return fail(editorialFailure);
  const seasonalFailure=seasonalGate(campaign,weatherByStore,now);
  if(seasonalFailure) return fail(seasonalFailure);
  const targeting=campaign.targeting||{};
  if(targeting.stores?.length && !targeting.stores.includes(contact.fulfillmentContext?.store)) return fail('store_targeting');
  if(targeting.anyInterests?.length && !targeting.anyInterests.some(x=>contact.interests?.includes(x))) return fail('interest_targeting');
  if(targeting.trades?.length && !targeting.trades.some(x=>contact.interests?.includes(x))) return fail('trade_targeting');
  if (campaign.productsVerified !== true || campaign.linksVerified !== true || campaign.contentVerified !== true) return fail('content_checks');
  if (!ledger || ledger.complete !== true || !Array.isArray(ledger.entries)) return fail('incomplete_send_history');
  const entries = ledger.entries.filter(x => x.channel === 'email' && x.kind === 'marketing' && ['sent', 'reserved', 'uncertain'].includes(x.status));
  if (entries.some(x => x.campaignId === campaign.id)) return fail('duplicate');
  if (entries.some(x => x.status === 'uncertain' || timestamp(x.at) === null || timestamp(x.at) > now)) return fail('unreconciled_send');
  const recent = entries.filter(x => now - timestamp(x.at) < 7 * DAY);
  if (recent.length >= 3) return fail('weekly_cap');
  if (entries.some(x => now - timestamp(x.at) < 2 * DAY)) return fail('message_spacing');
  if (entries.some(x => x.storyId && x.storyId === (campaign.storyId || campaign.id) && now - timestamp(x.at) < 14 * DAY)) return fail('story_cooldown');
  if (!Array.isArray(contact.purchases)) return fail('unknown_purchase_history');
  if (contact.purchases.some(x => x.category === campaign.category && (timestamp(x.at) === null || now - timestamp(x.at) < 14 * DAY))) return fail('recent_purchase');
  if (campaign.trigger === 'behavior' && (contact.personalizationOptIn !== true || contact.identityVerified !== true)) return fail('personalization_consent');
  if (campaign.trigger === 'declared' && !contact.interests?.includes(campaign.category) && !contact.interests?.includes(campaign.audience) && !targeting.trades?.some(x=>contact.interests?.includes(x)) && !targeting.anyInterests?.some(x=>contact.interests?.includes(x))) return fail('no_matching_preference');
  if (!['behavior', 'declared', 'welcome'].includes(campaign.trigger)) return fail('unknown_trigger');
  const hour = Number(new Intl.DateTimeFormat('en-US', {timeZone: 'America/Chicago', hour: 'numeric', hourCycle: 'h23'}).format(now));
  if (hour < 9 || hour >= 18) return fail('quiet_hours');
  const productRoutes=(campaign.products||[]).map(product=>({productId:product.productId||product.sku,...chooseFulfillment({product,customer:contact.fulfillmentContext||{},campaign,now})})).filter(x=>x.eligible);
  if (campaign.trigger!=='welcome' && !productRoutes.length && !(campaign.audience==='trade_news' && campaign.allowEditorialOnly===true)) return fail('no_verified_fulfillment');
  return {eligible: true, reason: 'eligible', reservationKey: `${contact.id}:${campaign.id}`,productRoutes};
}

function chooseFlow(candidates) {
  const priority = {welcome: 100, behavior: 80, declared: 60};
  return candidates.filter(x => x.decision?.eligible).sort((a, b) => (priority[b.trigger] || 0) - (priority[a.trigger] || 0) || (b.intentScore || 0) - (a.intentScore || 0) || a.id.localeCompare(b.id))[0] || null;
}

function scoreIntent({events, now = Date.now(), identityVerified, personalizationOptIn}) {
  if (identityVerified !== true || personalizationOptIn !== true) return [];
  const weights = {view_item: 1, select_item: 2, add_to_cart: 4};
  const seen = new Set(), buckets = new Map();
  for (const event of events || []) {
    const at = timestamp(event.at);
    if (!event.id || !event.productId || !CATEGORIES.includes(event.category) || !weights[event.type] || at === null || at > now || now - at > 30 * DAY) continue;
    const key = `${event.category}:${event.productId}:${event.type}:${Math.floor(at / DAY)}`;
    if (seen.has(key) || seen.has(`id:${event.id}`)) continue;
    seen.add(key); seen.add(`id:${event.id}`);
    const bucket = buckets.get(event.category) || {category: event.category, score: 0, days: new Set(), cart: false};
    bucket.score += weights[event.type] * Math.pow(0.5, (now - at) / (7 * DAY));
    bucket.days.add(Math.floor(at / DAY)); bucket.cart ||= event.type === 'add_to_cart';
    buckets.set(event.category, bucket);
  }
  return [...buckets.values()].filter(x => x.score >= 3.5 && (x.days.size >= 2 || x.cart)).map(x => ({category: x.category, score: Math.round(x.score * 100) / 100})).sort((a, b) => b.score - a.score || a.category.localeCompare(b.category));
}

function selectProducts({catalog, category, now = Date.now(), limit = 6, audience}) {
  if (!CATEGORIES.includes(category)) throw new Error('Unknown category');
  return (catalog || []).filter(p => {
    let url; try { url = new URL(p.url); } catch { return false; }
    const verified = timestamp(p.verifiedAt);
    if (url.protocol !== 'https:' || url.hostname !== 'webtrack.woodsonlumber.com' || !/^\/ProductDetail\.aspx$/i.test(url.pathname) || !url.searchParams.get('pid')) return false;
    if (p.category !== category || !p.sku || !p.title || !p.image || p.available !== true || verified === null || verified > now || now - verified > DAY || !Number.isFinite(p.price) || p.price < 0 || p.currency !== 'USD') return false;
    if (audience === 'deals') {
      const deal=opportunity(p,now)!==null || (Number.isFinite(p.regularPrice)&&p.regularPrice>p.price&&timestamp(p.offerStartsAt)!==null&&timestamp(p.offerEndsAt)!==null&&timestamp(p.offerStartsAt)<=now&&timestamp(p.offerEndsAt)>now&&!!p.offerEvidence);
      if(p.promotedAsDeal===true&&!deal)return false;
      return deal || (Number.isFinite(p.relevance)&&p.relevance>=0.7&&typeof p.relevanceReason==='string'&&p.relevanceReason.trim().length>0);
    }
    return true;
  }).sort((a, b) => {const saving=p=>Number.isFinite(p.regularPrice)&&p.regularPrice>p.price?1-p.price/p.regularPrice:0;const offer=p=>opportunity(p,now)!==null||saving(p)>0;return (audience==='deals'?Number(offer(b))-Number(offer(a))||saving(b)-saving(a):0)||(b.relevance||0)-(a.relevance||0)||a.sku.localeCompare(b.sku);}).filter((p, i, all) => all.findIndex(x => x.sku === p.sku) === i).slice(0, Math.min(8, Math.max(1, limit)));
}

function buildBrief(brief, catalog, now = Date.now()) {
  if (!brief || !brief.id || !AUDIENCES[brief.audience] || !brief.themeId) throw new Error('Brief needs an ID, audience and theme');
  if (timestamp(brief.startsAt) === null || timestamp(brief.endsAt) === null || timestamp(brief.endsAt) <= timestamp(brief.startsAt)) throw new Error('Brief needs a valid date range');
  const products = selectProducts({catalog, category: brief.category, audience: brief.audience, now, limit: brief.audience === 'trade_news' ? 2 : 6});
  const blockers = [];
  if (!products.length) blockers.push('No current verified products meet this brief');
  if (!brief.fulfillmentContext) blockers.push('Store/destination and current fulfillment evidence must be resolved for each audience before dispatch');
  if (brief.audience === 'trade_news' && !(brief.editorialSources || []).some(x => { const at = timestamp(x.verifiedAt); return x.url?.startsWith('https://') && x.claim && at !== null && at <= now && now - at < 7 * DAY; })) blockers.push('Contractor news requires current primary sources and claim review');
  return {...brief, storyId:brief.storyId || brief.id, status: 'draft', approvalRequired: true, contentStrategy: AUDIENCES[brief.audience], products, blockers, generatedAt: new Date(now).toISOString(), deliveryPolicy: {maxPerRollingSevenDays: 3, minSpacingHours: 48, storyCooldownDays: 14, approvedLayoutsReusable: true, timeZone: 'America/Chicago', hours: '09:00–18:00', arbitration: 'One highest-priority eligible flow per customer; atomic reservation required'}};
}

module.exports = {DAY, CATEGORIES, AUDIENCES, eligibility, chooseFlow, scoreIntent, selectProducts, buildBrief};
