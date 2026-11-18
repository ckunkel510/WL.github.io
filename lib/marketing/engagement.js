'use strict';
const DAY=86400000;
// Delivered messages are exposure, not proof of attention. Opens never change
// topic preferences; scanner-only clicks never increase an interest score.
function evaluateEngagement({category,exposures=[],clicks=[],websiteEvents=[],declaredInterests=[],excludedInterests=[],now=Date.now()}) {
  if(excludedInterests.includes(category))return {action:'exclude',reason:'subscriber_excluded_topic',score:0};
  const recent=exposures.filter(x=>x.category===category&&x.delivered===true&&Number.isFinite(Date.parse(x.at))&&Date.parse(x.at)<=now-3*DAY&&now-Date.parse(x.at)<=60*DAY);
  const clicked=new Set(clicks.filter(x=>x.category===category&&x.registered===true&&x.suspectedBot!==true&&Number.isFinite(Date.parse(x.at))&&Date.parse(x.at)<=now&&now-Date.parse(x.at)<=30*DAY).map(x=>x.campaignActivityId).filter(Boolean));
  const arrivals=new Set(websiteEvents.filter(x=>x.category===category&&x.identityAndPersonalizationVerified===true&&x.sourceVerified===true&&['view_item','add_to_cart','purchase'].includes(x.type)&&Number.isFinite(Date.parse(x.at))&&Date.parse(x.at)<=now&&now-Date.parse(x.at)<=30*DAY).map(x=>x.eventId).filter(Boolean));
  if(arrivals.size)return {action:'prioritize',reason:'verified_website_engagement',score:Math.min(8,arrivals.size*2)};
  if(clicked.size>=2)return {action:'prioritize',reason:'repeat_registered_clicks',score:clicked.size};
  if(clicked.size===1)return {action:'observe',reason:'single_click_is_weak',score:1};
  const campaigns=new Set(recent.map(x=>x.campaignActivityId).filter(Boolean));
  const span=recent.length?Math.max(...recent.map(x=>Date.parse(x.at)))-Math.min(...recent.map(x=>Date.parse(x.at))):0;
  if(campaigns.size>=4&&span>=21*DAY)return {action:declaredInterests.includes(category)?'reduce_and_ask':'deprioritize',reason:'repeated_delivered_without_registered_engagement',score:0,neverAutoUnsubscribe:true,neverAssumeAnotherInterest:true};
  return {action:'wait',reason:'insufficient_mature_exposure',score:0};
}
function frequencyPolicy({choice='standard',verifiedSubscriberChoice=false}={}) {
  if(choice==='paused')return {maxPerRollingSevenDays:0,minSpacingHours:null};
  if(choice==='weekly')return {maxPerRollingSevenDays:1,minSpacingHours:168};
  if(choice==='daily'&&verifiedSubscriberChoice)return {maxPerRollingSevenDays:7,minSpacingHours:24};
  return {maxPerRollingSevenDays:3,minSpacingHours:48};
}
module.exports={evaluateEngagement,frequencyPolicy};
