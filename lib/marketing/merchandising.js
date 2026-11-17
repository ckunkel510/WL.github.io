'use strict';
const DAY=86400000;
const STORES=['brenham','bryan','buffalo','caldwell','groesbeck','lexington','mexia'];
const date=value=>{const x=Date.parse(value);return Number.isFinite(x)?x:null;};
function current(evidence,now,maxAge=DAY){const t=date(evidence?.verifiedAt);return t!==null && t<=now && now-t<maxAge && !!evidence.source;}

// Owner-approved opportunity sources; authorization never invents a new markdown.
function opportunity(product, now=Date.now()) {
  const offer=product.offer;
  if (offer && ['webtrack_sale','webtrack_program','clearance'].includes(offer.kind) && current(offer,now) &&
      ['sale','program','clearance'].includes(offer.webtrackFlag) && date(offer.validUntil)!==null && date(offer.validUntil)>now &&
      Number.isFinite(offer.price) && offer.price===product.price && product.price>=0 && offer.termsVerified===true) {
    if (offer.minimumQuantity && (!Number.isFinite(offer.minimumQuantity) || offer.minimumQuantity<1 || !offer.quantityUnit)) return null;
    return {kind:offer.kind,label:offer.kind==='clearance'?'Clearance':offer.kind==='webtrack_program'?'Program offer':'Sale',price:product.price,
      savings:Number.isFinite(offer.regularPrice)&&offer.regularPrice>product.price?Math.round((offer.regularPrice-product.price)*100)/100:null,
      minimumQuantity:offer.minimumQuantity||1,quantityUnit:offer.quantityUnit||'ea',terms:offer.terms||''};
  }
  const benchmark=product.merchantBenchmark;
  if (current(benchmark,now,7*DAY) && benchmark.gtin && benchmark.gtin===product.gtin && benchmark.currency===product.currency &&
      benchmark.market==='US' && benchmark.condition==='new' && benchmark.variantMatch===true && Number.isFinite(benchmark.price) && benchmark.price>product.price && product.price>0) {
    // Merchant benchmark is a product-price signal, not a shipped-price guarantee
    // or proof we are the cheapest seller. Never render it as a retail markdown.
    return {kind:'merchant_value',label:'Online value pick',price:product.price,savings:null,claim:'Selected using current Merchant price competitiveness data'};
  }
  return null;
}

function chooseStore({declaredStore,purchaseStores,now=Date.now()}) {
  if (STORES.includes(declaredStore)) return {store:declaredStore,source:'declared'};
  const counts=new Map();
  for (const p of purchaseStores||[]) {const at=date(p.at);if (STORES.includes(p.store)&&p.verified===true&&at!==null&&at<=now&&now-at<90*DAY) counts.set(p.store,(counts.get(p.store)||0)+1);}
  const ranked=[...counts].sort((a,b)=>b[1]-a[1]);
  if (ranked.length && ranked[0][1]>=2 && (ranked.length===1||ranked[0][1]>ranked[1][1])) return {store:ranked[0][0],source:'verified_purchase_affinity'};
  return {store:null,source:'unknown'};
}

function fulfillmentMatch({product,customer,campaign,now=Date.now()}) {
  const fail=reason=>({eligible:false,reason});
  if (campaign.storeEvent) {
    if (!STORES.includes(campaign.store) || customer.store!==campaign.store) return fail('store_event_mismatch');
    if (campaign.storeEvent.approvedByOwner!==true || !current(campaign.storeEvent,now) || date(campaign.storeEvent.startsAt)===null || date(campaign.storeEvent.endsAt)===null || date(campaign.storeEvent.endsAt)<=now) return fail('event_unverified');
  }
  const method=campaign.fulfillment;
  if (customer.fulfillmentPreference==='shipping' && method==='pickup') return fail('customer_prefers_shipping');
  if (method==='pickup') {
    if (!STORES.includes(customer.store)||campaign.store!==customer.store) return fail('pickup_store_mismatch');
    const stock=product.storeStock?.[customer.store];
    if (!current(stock,now,3600000)||stock.available!==true||!Number.isFinite(stock.quantity)||stock.quantity<(campaign.minimumQuantity||1)) return fail('no_verified_local_stock');
    return {eligible:true,method:'pickup',store:customer.store,cta:'Order online for pickup',qualifier:'Confirm current pickup availability at '+customer.store};
  }
  if (method==='shipping') {
    const shipping=product.shipping;
    if (!current(shipping,now,3600000)||shipping.enabled!==true||shipping.restricted===true||shipping.inventoryAvailable!==true) return fail('shipping_unverified');
    if (!customer.shippingRegionVerified || !Array.isArray(shipping.allowedRegions)||!shipping.allowedRegions.includes(customer.shippingRegion)) return fail('destination_unverified');
    if ((campaign.minimumQuantity||1)>1 && (!Number.isFinite(shipping.availableQuantity)||shipping.availableQuantity<campaign.minimumQuantity)) return fail('shipping_quantity_unverified');
    return {eligible:true,method:'shipping',localPickupPromised:false,cta:'Order online to ship home',qualifier:'Shipping options and charges confirmed at checkout'};
  }
  if (method==='ship_to_store') {
    const route=product.storeTransfers?.[customer.store];
    if (!STORES.includes(customer.store)||campaign.store!==customer.store) return fail('transfer_store_mismatch');
    if (!current(route,now,3600000)||route.enabled!==true||route.inventoryAvailable!==true||route.destinationStore!==customer.store||route.termsVerified!==true||!Number.isFinite(route.readyInBusinessDays)||route.readyInBusinessDays<0) return fail('transfer_unverified');
    if ((campaign.minimumQuantity||1)>1 && (!Number.isFinite(route.availableQuantity)||route.availableQuantity<campaign.minimumQuantity)) return fail('transfer_quantity_unverified');
    return {eligible:true,method:'ship_to_store',store:customer.store,cta:'Order for delivery to your store',qualifier:'Estimated '+route.readyInBusinessDays+' business days; confirm transfer details before ordering'};
  }
  return fail('fulfillment_unspecified');
}
function chooseFulfillment({product,customer,campaign={},now=Date.now()}) {
  const methods=campaign.fulfillment && campaign.fulfillment!=='auto'?[campaign.fulfillment]:customer.fulfillmentPreference==='shipping'?['shipping','ship_to_store','pickup']:['pickup','ship_to_store','shipping'];
  for (const method of methods) {
    const decision=fulfillmentMatch({product,customer,campaign:{...campaign,fulfillment:method,store:campaign.store||customer.store},now});
    if (decision.eligible) return decision;
  }
  return {eligible:false,method:null,cta:'Check fulfillment options',reason:'no_verified_route',localPickupPromised:false};
}
module.exports={STORES,opportunity,chooseStore,fulfillmentMatch,chooseFulfillment};
