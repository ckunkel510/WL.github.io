'use strict';
const DAY=86400000;
const time=value=>{const n=Date.parse(value);return Number.isFinite(n)?n:null;};

// Input must be a complete, trusted catalog snapshot, not ranked search results.
// The first observation establishes a baseline and never announces the catalog as new.
function observeCatalog({previous,snapshot,now=Date.now()}) {
  if (!snapshot || snapshot.complete!==true || !snapshot.source || !snapshot.id || !Array.isArray(snapshot.products) || snapshot.products.length!==snapshot.expectedProducts) throw new Error('Complete authoritative catalog snapshot required');
  if (previous?.snapshotId===snapshot.id) return {state:previous,newlyShoppable:[]};
  const baseline=previous?.baselineEstablished===true;
  const records={...(previous?.records||{})},newlyShoppable=[];
  for(const product of snapshot.products) {
    if (!product.productId || !product.category) continue;
    const id=String(product.productId),known=records[id];
    const genuineDate=time(product.catalogCreatedAt);
    const explicitNew=product.webtrackNewFlag===true && genuineDate!==null && genuineDate<=now && now-genuineDate<=30*DAY;
    const firstSeenAt=known?.firstSeenAt || new Date(now).toISOString();
    const shoppable=product.onlineOrderable===true && product.inStock===true && product.fulfillmentVerified===true && product.canonicalLinkVerified===true;
    const recent=baseline && (!known || (known.observedAfterBaseline===true && now-time(known.firstSeenAt)<=30*DAY));
    const notify=(explicitNew || recent) && shoppable && !known?.announcedAt;
    records[id]={...known,firstSeenAt,observedAfterBaseline:known?.observedAfterBaseline??baseline,lastSeenAt:new Date(now).toISOString(),lastSnapshotId:snapshot.id,shoppable,firstShoppableAt:known?.firstShoppableAt || (shoppable?new Date(now).toISOString():null)};
    if(notify) newlyShoppable.push({...product,firstSeenAt,newnessEvidence:explicitNew?'dated_native_new_flag':'added_after_complete_catalog_baseline'});
  }
  return {state:{baselineEstablished:true,snapshotId:snapshot.id,source:snapshot.source,records},newlyShoppable};
}
function batchArrivals(products,{category,trade,limit=6}={}) {
  return [...new Map((products||[]).filter(x=>(!category||x.category===category)&&(!trade||x.tradeSpecialties?.includes(trade))).map(x=>[x.productId,x])).values()].slice(0,Math.max(1,Math.min(8,limit)));
}
module.exports={observeCatalog,batchArrivals};
