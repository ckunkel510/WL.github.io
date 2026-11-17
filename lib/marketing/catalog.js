'use strict';
const {getAiCatalogProducts}=require('../../api/ai-product-catalog');
const taxonomy=require('../../marketing/taxonomy.json');
const mappings=[[/lawn\s*(?:&|and)\s*garden/i,'lawn_garden'],[/\bchristmas\b|\bholiday\b|\bseasonal\b/i,'seasonal'],[/\bplumbing\b/i,'plumbing'],[/\belectrical\b/i,'electrical'],[/\broofing\b/i,'roofing'],[/\bframing\b/i,'framing'],[/\bpaint\b|\bstain\b/i,'paint'],[/\btools\b|\bhardware\b/i,'tools'],[/\blumber\b|building materials/i,'building'],[/\bhunting\b|\bfishing\b/i,'hunting'],[/\boutdoor\b/i,'outdoor']];
function categoryFor(product){if(/^stihl$/i.test(product.brand||''))return 'outdoor';const path=product.category||'';return mappings.find(([pattern])=>pattern.test(path))?.[1]||null;}
async function catalogCandidates({load=getAiCatalogProducts,category,brands,query='',limit=12,now=Date.now()}={}){
 if(!Object.prototype.hasOwnProperty.call(taxonomy.departments,category))throw Error('Declared category required');
 const snapshot=await load(),active=snapshot.active,created=Date.parse(active?.createdAt),products=snapshot.products;
 if(snapshot.fresh!==true||!active?.id||!Number.isFinite(created)||created>now||now-created>86400000||!Array.isArray(products)||!Number.isSafeInteger(active.expectedProducts)||active.expectedProducts<=0||active.expectedProducts!==products.length||active.storedProducts!==products.length)throw Error('Complete current authoritative catalog snapshot required');
 const words=String(query).toLowerCase().split(/\s+/).filter(Boolean),cap=Math.min(30,Math.max(1,Math.trunc(Number(limit)||12)));
 const candidates=products.filter(p=>categoryFor(p)===category&&(!brands?.length||brands.includes(p.brand))&&p.availability==='in_stock').filter(p=>words.every(w=>[p.title,p.brand,p.productCode,p.category].join(' ').toLowerCase().includes(w))).map(p=>({productId:p.productId,sku:p.productCode,title:p.title,brand:p.brand,category,url:p.productUrl,image:p.imageUrl,catalogPrice:p.salePrice||p.price,catalogSeenAt:active.createdAt,needsLiveProductVerification:true,needsFulfillmentVerification:true,marketRestriction:/^stihl$/i.test(p.brand||'')?['lexington','groesbeck','mexia']:null}));
 return {snapshotId:active.id,complete:true,totalProducts:products.length,category,matchingProducts:candidates.length,candidates:candidates.slice(0,cap),resultsArePartial:true};
}
module.exports={categoryFor,catalogCandidates};
