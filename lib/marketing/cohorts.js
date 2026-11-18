'use strict';
function reviewBucket(id,seed){let n=2166136261;const s=seed+':'+id;for(let i=0;i<s.length;i++){n^=s.charCodeAt(i);n=Math.imul(n,16777619);}return (n>>>0)/4294967296;}
// A deterministic randomized experiment is not a declaration of interest.
// Result IDs remain inside the trusted provider adapter; reports expose counts.
function planReviewCohorts({contacts,seed='20261118-email2-v1',holdoutFraction=0.1}){
 if(!Array.isArray(contacts)||!Number.isFinite(holdoutFraction)||holdoutFraction<0||holdoutFraction>0.5)throw Error('Complete normalized contacts and bounded holdout required');
 const cohorts={hunting:[],gifting:[],stihl:[],holdout:[]},counts={excluded:{},basis:{declared:0,known_list:0,observed:0,exploration:0},stihlMarkets:{}};const seen=new Set();
 const exclude=reason=>{counts.excluded[reason]=(counts.excluded[reason]||0)+1;};
 for(const c of contacts){if(!c.id||seen.has(c.id)){exclude('missing_or_duplicate_identity');continue;}seen.add(c.id);
  if(c.marketable!==true||c.suppressed===true){exclude('permission_or_suppression');continue;}
  if(c.frequency==='paused'){exclude('subscriber_paused');continue;}
  if(c.frequency==='weekly'&&c.receivedMarketingThisWeek===true){exclude('weekly_preference_already_served');continue;}
  const topics=c.declaredTopics||[],blocked=c.excludedTopics||[],known=!!c.hasDeclaredProfile;
  const market=(c.markets||[]).filter(x=>['lexington','groesbeck','mexia'].includes(x));
  let choices=[];
  if(topics.includes('hunting')&&!blocked.includes('hunting'))choices.push('hunting');
  if(topics.some(x=>['tools','project_tips'].includes(x))&&!blocked.includes('tools'))choices.push('gifting');
  if(market.length&&topics.some(x=>['brand_stihl','lawn_garden','outdoor'].includes(x))&&!blocked.includes('brand_stihl'))choices.push('stihl');
  let basis=c.topicSource==='legacy_list'?'known_list':'declared';
  if(!choices.length&&!known){basis=(c.observedTopics||[]).length?'observed':'exploration';
   if((c.observedTopics||[]).includes('hunting')&&!blocked.includes('hunting'))choices.push('hunting');
   if((c.observedTopics||[]).includes('tools')&&!blocked.includes('tools'))choices.push('gifting');
   if(!choices.length){if(!blocked.includes('hunting'))choices.push('hunting');if(!blocked.includes('tools'))choices.push('gifting');if(market.length&&!blocked.includes('brand_stihl'))choices.push('stihl');}
  }
  if(!choices.length){exclude('no_matching_declared_topic');continue;}
  if(reviewBucket(c.id,seed+':holdout')<holdoutFraction){cohorts.holdout.push(c.id);continue;}
  const chosen=choices[Math.floor(reviewBucket(c.id,seed+':story')*choices.length)];cohorts[chosen].push(c.id);counts.basis[basis]++;
  if(chosen==='stihl')market.forEach(k=>{counts.stihlMarkets[k]=(counts.stihlMarkets[k]||0)+1;});
 }
 return {cohorts,counts,seed,holdoutFraction,uniqueContacts:seen.size,notAnInterestDeclaration:true,sendsAuthorized:false};
}
if(typeof module!=='undefined')module.exports={planReviewCohorts,reviewBucket};
