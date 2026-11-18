'use strict';
const {createHash}=require('node:crypto');
const DAY=86400000;
function productLink({campaignId,product,category,store}){
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(campaignId||''))throw Error('Stable public campaign ID required');
 const u=new URL(product.url);if(u.protocol!=='https:'||u.hostname!=='webtrack.woodsonlumber.com'||!/^\/ProductDetail\.aspx$/i.test(u.pathname)||u.searchParams.get('pid')!==String(product.productId))throw Error('Exact canonical product identity required');
 // Discard unknown query parameters, including any accidentally supplied PII.
 const url=new URL('/ProductDetail.aspx',u.origin);url.searchParams.set('pid',String(product.productId));
 const id=createHash('sha256').update(campaignId+':'+product.productId).digest('hex').slice(0,20);
 for(const [key,value]of Object.entries({utm_source:'constant_contact',utm_medium:'email',utm_campaign:campaignId,utm_content:'product_'+id}))url.searchParams.set(key,value);
 return {id,campaignId,productId:String(product.productId),sku:product.sku,category,store:store||null,url:url.href,canonicalUrl:new URL('/ProductDetail.aspx?pid='+encodeURIComponent(product.productId),u.origin).href};
}
// client.getJSON is an authenticated server-side CC OAuth adapter. This function
// is not exposed as a browser ingestion endpoint and never returns contact PII.
async function fetchClickSignals({client,activityId,registry,now=Date.now()}){
 if(!client||typeof client.getJSON!=='function'||!/^[a-f0-9-]{36}$/i.test(activityId))throw Error('Authenticated provider client and activity ID required');
 const activity=await client.getJSON('/emails/activities/'+activityId);if(activity.role&&!['primary_email','resend'].includes(activity.role))return {complete:false,signals:[],reason:'unsupported_activity_role'};if(String(activity.current_status||'').toUpperCase()!=='DONE')return {complete:true,signals:[],reason:'not_sent'};
 const root='/reports/email_reports/'+activityId,links=await client.getJSON(root+'/links?no_clicks=true');
 if(links.campaign_activity_id!==activityId||!Array.isArray(links.link_click_counts))throw Error('Provider link report mismatch');
 const approved=new Map();for(const row of links.link_click_counts){const link=(registry||[]).find(x=>row.link_url===x.url||(x.providerActivityId===activityId&&x.providerUrl===row.link_url&&String(x.providerUrlId)===String(row.url_id)));if(link)approved.set(String(row.url_id),{link,reportedUrl:row.link_url});}
 const signals=[],seen=new Set();let path=root+'/tracking/clicks?limit=500',pages=0;
 while(path){if(++pages>100)throw Error('Incomplete click history; checkpoint before continuing');if(!path.startsWith(root+'/tracking/clicks?')||path.includes('://')||path.includes('..'))throw Error('Unexpected provider page');const report=await client.getJSON(path);if(!Array.isArray(report.tracking_activities))throw Error('Invalid click report');
 for(const row of report.tracking_activities){const mapped=approved.get(String(row.url_id)),link=mapped?.link,at=Date.parse(row.created_time);if(!link||(row.link_url!==mapped.reportedUrl&&row.link_url!==link.url)||row.campaign_activity_id!==activityId||row.tracking_activity_type!=='em_clicks'||!row.contact_id||!Number.isFinite(at)||at>now||now-at>30*DAY)continue;
 const key=[row.contact_id,activityId,link.id,Math.floor(at/DAY)].join(':');if(seen.has(key))continue;seen.add(key);signals.push({id:createHash('sha256').update(key).digest('hex'),contactId:row.contact_id,campaignActivityId:activityId,productId:link.productId,category:link.category,type:'select_item',at:row.created_time,source:'constant_contact_click_report',requiresConsentAndIdentityRecheck:true});}
 path=report._links?.next?.href||null;}
 return {complete:true,signals};
}
module.exports={productLink,fetchClickSignals};
