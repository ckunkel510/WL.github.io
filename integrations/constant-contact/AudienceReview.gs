/* Authenticated editor only: read-only audit and explicitly requested review cohorts.
 * Never sends, schedules, re-subscribes, or changes declared interest lists. */
const WL_REVIEW_BATCH = '2026-11-18';
const WL_REVIEW_SOURCE_LIST = 'b1b8aa1e-2453-11ef-8470-fa163edc3efc';
const WL_REVIEW_CAMPAIGN = '95f1d00f-84f0-4269-a970-0f5597041363';
const WL_REVIEW_ACTIVITY = '3aa0b0d3-78d2-4e57-b757-028d9d661af9';
function wlReviewPages_(initial,root,key,maxPages) {
  let path=initial,rows=[],pages=0;
  while(path){if(++pages>maxPages)throw new Error('Review import incomplete; no cohorts written');const data=ccGet_(path);if(!Array.isArray(data[key]))throw new Error('Review collection missing');rows=rows.concat(data[key]);path=data._links&&data._links.next?wlCcPage_(data._links.next.href,root):'';}
  return rows;
}
function wlReviewInputs_() {
  const lists=getContactLists_().lists||[];
  const contacts=wlReviewPages_('/contacts?lists='+WL_REVIEW_SOURCE_LIST+'&status=active&include=list_memberships,custom_fields,taggings,street_addresses&limit=500','/contacts','contacts',20);
  const bounces=wlReviewPages_('/reports/email_reports/'+WL_REVIEW_ACTIVITY+'/tracking/bounces?limit=500','/reports/email_reports/'+WL_REVIEW_ACTIVITY+'/tracking/bounces','tracking_activities',20);
  const optouts=wlReviewPages_('/reports/email_reports/'+WL_REVIEW_ACTIVITY+'/tracking/optouts?limit=500','/reports/email_reports/'+WL_REVIEW_ACTIVITY+'/tracking/optouts','tracking_activities',10);
  return {lists:lists,contacts:contacts,bounces:bounces,optouts:optouts};
}
function inspectMorningAudience() {
  const input=wlReviewInputs_(),counts={permissions:{},declaredInterests:{},declaredStores:{},addressMarket:{},bounceCodes:{}};
  const interestIds={},storeIds={};Object.keys(WL_INTERESTS).forEach(function(k){interestIds[k]=getProp_('CC_PREFS_INTEREST_'+k.toUpperCase()+'_LIST_ID');});Object.keys(WL_STORES).forEach(function(k){storeIds[k]=getProp_('CC_PREFS_STORE_'+k.toUpperCase()+'_LIST_ID');});
  input.contacts.forEach(function(c){const permission=c.email_address&&c.email_address.permission_to_send||'unknown';counts.permissions[permission]=(counts.permissions[permission]||0)+1;
    Object.keys(WL_INTERESTS).forEach(function(k){if((c.list_memberships||[]).includes(interestIds[k]))counts.declaredInterests[k]=(counts.declaredInterests[k]||0)+1;});
    Object.keys(WL_STORES).forEach(function(k){if((c.list_memberships||[]).includes(storeIds[k]))counts.declaredStores[k]=(counts.declaredStores[k]||0)+1;});
    const cities=[...new Set((c.street_addresses||[]).filter(function(a){return /^(TX|Texas)$/i.test(a.state||'');}).map(function(a){return String(a.city||'').trim().toLowerCase();}).filter(function(city){return ['lexington','groesbeck','mexia'].includes(city);}))];cities.forEach(function(k){counts.addressMarket[k]=(counts.addressMarket[k]||0)+1;});
  });
  input.bounces.forEach(function(row){const code=row.bounce_code||row.bounce_description||'unspecified';counts.bounceCodes[code]=(counts.bounceCodes[code]||0)+1;});
  const stats=ccGet_('/reports/stats/email_campaigns/'+WL_REVIEW_CAMPAIGN);
  const result={checkedAt:new Date().toISOString(),sourceList:WL_REVIEW_SOURCE_LIST,activeSourceContacts:input.contacts.length,counts:counts,currentCampaignStats:stats.results&&stats.results.map(function(x){return {campaignId:x.campaign_id,stats:x.stats,percents:x.percents,lastRefresh:x.last_refresh_time};}),bounceRows:input.bounces.length,bounceRowFields:input.bounces[0]?Object.keys(input.bounces[0]):[],optoutRows:input.optouts.length,lists:input.lists.map(function(x){return {id:x.list_id,name:x.name,members:x.membership_count};}),contactsChanged:0,campaignsSent:0};
  setProp_('WL_REVIEW_AUDIT_SUMMARY',JSON.stringify(result));console.log(JSON.stringify(result));return result;
}

const WL_FREQUENCY_CHOICES = {weekly:'Email pace - Weekly (choose one)',standard:'Email pace - Up to 3 a week (choose one)',daily:'Email pace - Daily when useful (choose one)',paused:'Email pace - Pause marketing'};
function configureSubscriberChoices() {
  configureWebtrackMarketing();
  const lists=getContactLists_().lists||[];
  Object.keys(WL_FREQUENCY_CHOICES).forEach(function(key){const property='WL_FREQUENCY_'+key.toUpperCase()+'_LIST_ID';if(getProp_(property))return;const existing=lists.find(function(x){return x.name===WL_FREQUENCY_CHOICES[key];});const list=existing||ccPost_('/contact_lists',{name:WL_FREQUENCY_CHOICES[key]},'Create frequency choice failed');if(!list.list_id)throw new Error('Frequency choice missing');setProp_(property,list.list_id);});
  console.log(JSON.stringify({ok:true,topicChoices:Object.keys(WL_INTERESTS).length,frequencyChoices:Object.keys(WL_FREQUENCY_CHOICES).length,contactsEnrolled:0,campaignsSent:0,note:'Only subscriber-selected lower frequency constrains review cohorts. Daily opt-up requires a verified explicit choice in the sending adapter.'}));
}

function wlPlanMorningReview_() {
  const input=wlReviewInputs_(),byName={};input.lists.forEach(function(x){byName[x.name]=x.list_id;});
  const interestIds={},storeIds={},frequencyIds={};Object.keys(WL_INTERESTS).forEach(function(k){interestIds[k]=getProp_('CC_PREFS_INTEREST_'+k.toUpperCase()+'_LIST_ID');});Object.keys(WL_STORES).forEach(function(k){storeIds[k]=getProp_('CC_PREFS_STORE_'+k.toUpperCase()+'_LIST_ID');});Object.keys(WL_FREQUENCY_CHOICES).forEach(function(k){frequencyIds[k]=getProp_('WL_FREQUENCY_'+k.toUpperCase()+'_LIST_ID');});
  const failed=new Set(input.bounces.filter(function(x){return x.bounce_code!=='V';}).map(function(x){return x.contact_id;})),optouts=new Set(input.optouts.map(function(x){return x.contact_id;}));
  const unsafeLists=input.lists.filter(function(x){return /^SUPPRESS\s*-|^SYSTEM\s*-\s*Suppress|^Employees$|^FLOW\s*-\s*Winter Active$/i.test(x.name);}).map(function(x){return x.list_id;});
  const legacyTopics={Hunting:'hunting',DIY:'project_tips',Gardeners:'lawn_garden',Contractor:'trade_news','Bargain Hunters':'deals','Blog Readers':'trade_news'};
  const legacyCounts={},marketsBySource={declared:0,legacyList:0,address:0},permissionCounts={},profileFieldId=getProp_('CC_PREFS_CUSTOM_FIELD_INTERESTS_ID'),preferenceCenterLiveAt=Date.parse(getProp_('WL_PREFERENCE_CENTER_LIVE_AT')||'');
  const normalized=input.contacts.map(function(c){const memberships=c.list_memberships||[],permission=c.email_address&&c.email_address.permission_to_send||'unknown';permissionCounts[permission]=(permissionCounts[permission]||0)+1;
    const declared=Object.keys(interestIds).filter(function(k){return memberships.includes(interestIds[k]);}),nativeTopicCount=declared.length,changedSincePreferenceCenter=Number.isFinite(preferenceCenterLiveAt)&&Date.parse(c.updated_at)>=preferenceCenterLiveAt; if(!nativeTopicCount&&!changedSincePreferenceCenter)Object.keys(legacyTopics).forEach(function(name){if(memberships.includes(byName[name])){declared.push(legacyTopics[name]);legacyCounts[name]=(legacyCounts[name]||0)+1;}});
    let markets=Object.keys(storeIds).filter(function(k){return memberships.includes(storeIds[k]);});if(markets.length)marketsBySource.declared++;
    if(!markets.length){markets=Object.keys(WL_STORES).filter(function(k){return memberships.includes(byName[WL_STORES[k]]);});if(markets.length)marketsBySource.legacyList++;}
    if(!markets.length){markets=[...new Set((c.street_addresses||[]).filter(function(a){return /^(TX|Texas)$/i.test(a.state||a.state_code||a.state_name||'');}).map(function(a){return String(a.city||'').trim().toLowerCase();}).filter(function(city){return ['lexington','groesbeck','mexia'].includes(city);}))];if(markets.length)marketsBySource.address++;}
    const frequencies=Object.keys(frequencyIds).filter(function(k){return memberships.includes(frequencyIds[k]);});const frequency=frequencies.includes('paused')?'paused':frequencies.includes('weekly')?'weekly':frequencies.includes('standard')?'standard':frequencies.includes('daily')?'daily':'standard';
    return {id:c.contact_id,marketable:['explicit','implicit'].includes(permission)&&!c.deleted_at,suppressed:failed.has(c.contact_id)||optouts.has(c.contact_id)||unsafeLists.some(function(id){return memberships.includes(id);}),declaredTopics:[...new Set(declared)],topicSource:nativeTopicCount?'subscriber':'legacy_list',hasDeclaredProfile:changedSincePreferenceCenter||declared.length>0||(c.custom_fields||[]).some(function(f){return f.custom_field_id===profileFieldId;}),markets:markets,frequency:frequency,receivedMarketingThisWeek:true};
  });
  const plan=planReviewCohorts({contacts:normalized});return {plan:plan,aggregate:{sourceContacts:input.contacts.length,permissions:permissionCounts,legacyInterestMemberships:legacyCounts,marketEvidence:marketsBySource,cohortCounts:Object.fromEntries(Object.keys(plan.cohorts).map(function(k){return [k,plan.cohorts[k].length];})),exclusions:plan.counts.excluded,assignmentBasis:plan.counts.basis,stihlMarkets:plan.counts.stihlMarkets,holdoutFraction:plan.holdoutFraction,seed:plan.seed,sendsAuthorized:false,purchaseDataUsed:false,declaredPreferencesChanged:false,holdReasons:['Owner approval of exact creative, audience and timing pending','Current consent/suppressions and cross-campaign overlap must be rechecked before release']}};
}
function inspectPlannedReviewCohorts() {
  const result=wlPlanMorningReview_().aggregate;setProp_('WL_REVIEW_COHORT_PREVIEW',JSON.stringify(result));console.log(JSON.stringify(result));return result;
}
function createMorningReviewCohorts() {
  if(getProp_('WL_REVIEW_COHORTS_CREATED_'+WL_REVIEW_BATCH))throw new Error('Cohorts already created; inspect and recheck rather than silently replacing a reviewed audience');
  const data=wlPlanMorningReview_(),lists=getContactLists_().lists||[],registry={},jobs=[];
  Object.keys(data.plan.cohorts).forEach(function(key){const name='REVIEW | '+WL_REVIEW_BATCH+' | '+key+' | Email 2';let list=lists.find(function(x){return x.name===name;});if(!list)list=ccPost_('/contact_lists',{name:name},'Create review cohort failed');registry[key]={id:list.list_id,name:name,count:data.plan.cohorts[key].length};if(!list.list_id)throw new Error('Review list acknowledgement missing');const ids=data.plan.cohorts[key];for(let n=0;n<ids.length;n+=500){const activity=ccPost_('/activities/add_list_memberships',{source:{contact_ids:ids.slice(n,n+500)},list_ids:[list.list_id]},'Populate review cohort failed');if(!activity.activity_id)throw new Error('Review cohort job acknowledgement missing');jobs.push(activity.activity_id);}});
  const result=Object.assign({},data.aggregate,{reviewLists:registry,jobsQueued:jobs.length,campaignsSent:0});setProp_('WL_REVIEW_COHORT_JOBS',JSON.stringify(jobs));setProp_('WL_REVIEW_COHORTS_CREATED_'+WL_REVIEW_BATCH,JSON.stringify(result));console.log(JSON.stringify(result));return result;
}
function verifyMorningReviewCohorts() {
  const registry=JSON.parse(getProp_('WL_REVIEW_COHORTS_CREATED_'+WL_REVIEW_BATCH)||'null');if(!registry)throw new Error('No review cohorts');const jobs=JSON.parse(getProp_('WL_REVIEW_COHORT_JOBS')||'[]').map(function(id){return ccGet_('/activities/'+id);});if(jobs.some(function(x){return x.state!=='completed'||(x.activity_errors||[]).length;}))throw new Error('Review cohort jobs are not all completed');
  const actual={},seen=new Set();Object.keys(registry.reviewLists).forEach(function(key){const list=registry.reviewLists[key];const contacts=wlReviewPages_('/contacts?lists='+list.id+'&status=active&limit=500','/contacts','contacts',20);if(contacts.length!==list.count)throw new Error('Review cohort count changed; new review required');actual[key]=contacts.length;contacts.forEach(function(c){if(seen.has(c.contact_id))throw new Error('Review cohorts overlap');seen.add(c.contact_id);});});
  const result={ok:true,jobsCompleted:jobs.length,verifiedCounts:actual,mutuallyExclusive:true,campaignsSent:0,releaseApproved:false};setProp_('WL_REVIEW_COHORT_VERIFICATION',JSON.stringify(result));console.log(JSON.stringify(result));return result;
}

function markSubscriberPreferenceCenterLive() {
  if(!getProp_('WL_PREFERENCE_CENTER_LIVE_AT'))setProp_('WL_PREFERENCE_CENTER_LIVE_AT','2026-11-18T00:33:15.180Z');
  const result={ok:true,preferenceCenterLiveAt:getProp_('WL_PREFERENCE_CENTER_LIVE_AT'),note:'For contacts changed after this point, missing managed topic choices do not fall back to old inferred lists. No subscriptions changed.'};console.log(JSON.stringify(result));return result;
}
