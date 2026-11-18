/* Owner-authorized aggregate reporting, private editor/hourly worker only.
 * No recipient identifiers leave the provider adapter. Missing commerce data is
 * unknown. Public UTMs measure browser-session attribution, not causality. */
function refreshMarketingKpis_() {
  const campaignIds=[WL_REVIEW_CAMPAIGN].concat(WL_CLICK_CAMPAIGNS.map(function(c){return c.campaignId;}).filter(Boolean));
  const report=ccGet_('/reports/stats/email_campaigns/'+[...new Set(campaignIds)].join(','));
  if(!Array.isArray(report.results))throw new Error('KPI stats missing');
  const rows=report.results.map(function(row){const s=row.stats||{},sent=Number(s.em_sends),reportedBounces=Number(s.em_bounces),delivered=Number.isFinite(sent)&&Number.isFinite(reportedBounces)?Math.max(0,sent-reportedBounces):null;
    const rate=function(n,d){return Number.isFinite(Number(n))&&Number.isFinite(d)&&d>0?Number(n)/d:null;};
    return {campaignId:row.campaign_id,asOf:row.last_refresh_time||null,sends:Number.isFinite(sent)?sent:null,reportedBounces:Number.isFinite(reportedBounces)?reportedBounces:null,providerEstimatedDelivered:delivered,uniqueOpens:s.em_opens??null,uniqueClickers:s.em_clicks??null,totalClicks:s.em_clicks_all??null,trueUnsubscribes:s.em_optouts??null,uniqueClickRatePerProviderEstimatedDelivered:rate(s.em_clicks,delivered),clickToReportedOpenRate:rate(s.em_clicks,Number(s.em_opens)),unsubscribeRatePerProviderEstimatedDelivered:rate(s.em_optouts,delivered),opensAreDirectionalOnly:true,deliveryDenominatorNote:'Provider sends minus reported bounces; vacation auto-reply rows may still be delivered. Review bounce codes before cohort release.',websiteArrivals:null,onlineOrders:null,onlineNetRevenue:null,inStoreNetRevenue:null};
  });
  const result={checkedAt:new Date().toISOString(),campaigns:rows,unknownCommerceIsNotZero:true,attribution:'UTM browser session; shared promo usage and sales lift do not establish causation',cohortsAreReviewOnly:true,campaignsSent:0};setProp_('WL_MARKETING_KPI_SUMMARY',JSON.stringify(result));return result;
}
function inspectMarketingKpis() {const result=refreshMarketingKpis_();console.log(JSON.stringify(result));return result;}
