/* Private editor/clock functions only. No public click-ingestion endpoint.
 * Observed tags preserve marketable explicit/implicit permission as-is. They
 * never change declared preferences, consent or subscriptions; sending uses
 * its separate stricter consent policy.
 * This worker has no send/schedule/activate API calls. */
const WL_CLICK_CAMPAIGNS = [
  {
    "activityId": "3aa0b0d3-78d2-4e57-b757-028d9d661af9",
    "campaignKey": "woodson-christmas-lights-2026-r2",
    "links": [
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=276810&utm_source=constant_contact&utm_medium=email&utm_campaign=woodson-christmas-lights-2026-r2&utm_content=product_bc5af899782de4f41b6a",
        "productId": "276810",
        "tags": [
          "WL observed click - Holiday lighting",
          "WL observed click - C9 lights"
        ],
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=276810",
        "providerUrlId": "794959108966"
      },
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=268611&utm_source=constant_contact&utm_medium=email&utm_campaign=woodson-christmas-lights-2026-r2&utm_content=product_eb4bb5f382f497e533c5",
        "productId": "268611",
        "tags": [
          "WL observed click - Holiday lighting",
          "WL observed click - C9 lights"
        ],
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=268611",
        "providerUrlId": "794959108986"
      },
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=276804&utm_source=constant_contact&utm_medium=email&utm_campaign=woodson-christmas-lights-2026-r2&utm_content=product_8a119139b579546cf0ed",
        "productId": "276804",
        "tags": [
          "WL observed click - Holiday lighting",
          "WL observed click - Icicle lights"
        ],
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=276804",
        "providerUrlId": "794959108969"
      },
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=255139&utm_source=constant_contact&utm_medium=email&utm_campaign=woodson-christmas-lights-2026-r2&utm_content=product_84967c4f34a2fdd8aea8",
        "productId": "255139",
        "tags": [
          "WL observed click - Holiday lighting",
          "WL observed click - Net lights"
        ],
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=255139",
        "providerUrlId": "794959108998"
      },
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=276818&utm_source=constant_contact&utm_medium=email&utm_campaign=woodson-christmas-lights-2026-r2&utm_content=product_45bdd5bafdbe4eaa9b01",
        "productId": "276818",
        "tags": [
          "WL observed click - Holiday lighting",
          "WL observed click - C6 lights"
        ],
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=276818",
        "providerUrlId": "794959109002"
      },
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=276871&utm_source=constant_contact&utm_medium=email&utm_campaign=woodson-christmas-lights-2026-r2&utm_content=product_6c0571dcfa4c6b31445e",
        "productId": "276871",
        "tags": [
          "WL observed click - Holiday lighting",
          "WL observed click - T5 lights"
        ],
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=276871",
        "providerUrlId": "763759659336"
      },
      {
        "url": "https://webtrack.woodsonlumber.com/Products.aspx?pl1=4647&pg=4649&sort=StockClassSort&direction=asc&itemsPerPage=48&pageIndex=0&utm_source=constant_contact&utm_medium=email&utm_campaign=woodson-christmas-lights-2026-r2&utm_content=merry100_christmas_collection",
        "productId": null,
        "tags": [
          "WL observed click - Christmas collection"
        ],
        "providerUrl": "https://webtrack.woodsonlumber.com/Products.aspx?pl1=4647&pg=4649&sort=StockClassSort&direction=asc&itemsPerPage=48&pageIndex=0",
        "providerUrlId": "794959108960"
      },
      {
        "url": "https://webtrack.woodsonlumber.com/Products.aspx?pl1=4647&pg=4651&sort=StockClassSort&direction=asc&itemsPerPage=48&pageIndex=0&utm_source=constant_contact&utm_medium=email&utm_campaign=woodson-christmas-lights-2026-r2&utm_content=eligible_lights_collection",
        "tags": [
          "WL observed click - Holiday lighting"
        ],
        "providerUrl": "https://webtrack.woodsonlumber.com/Products.aspx?pl1=4647&pg=4651&sort=StockClassSort&direction=asc&itemsPerPage=48&pageIndex=0",
        "providerUrlId": "794959108956"
      }
    ]
  },
  {
    "campaignId": "3396233d-722a-4400-9fe9-799826309fe6",
    "activityId": "2ebf161b-bfbb-4691-a7c6-c26ed81c0e04",
    "campaignKey": "wl-20261118-hunting-r1",
    "allowProviderBinding": true,
    "links": [
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=174184&utm_source=constant_contact&utm_medium=email&utm_campaign=wl-20261118-hunting-r1&utm_content=product_acf660284e79487a5e94",
        "productId": "174184",
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=174184",
        "tags": [
          "WL observed click - Hunting"
        ]
      },
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=96255&utm_source=constant_contact&utm_medium=email&utm_campaign=wl-20261118-hunting-r1&utm_content=product_a56af431ba038da3114c",
        "productId": "96255",
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=96255",
        "tags": [
          "WL observed click - Hunting"
        ]
      },
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=186611&utm_source=constant_contact&utm_medium=email&utm_campaign=wl-20261118-hunting-r1&utm_content=product_229f25ebedd54fecb873",
        "productId": "186611",
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=186611",
        "tags": [
          "WL observed click - Hunting"
        ]
      },
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=186598&utm_source=constant_contact&utm_medium=email&utm_campaign=wl-20261118-hunting-r1&utm_content=product_7aa16f7acfd2cd6b2c8c",
        "productId": "186598",
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=186598",
        "tags": [
          "WL observed click - Hunting"
        ]
      },
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=246159&utm_source=constant_contact&utm_medium=email&utm_campaign=wl-20261118-hunting-r1&utm_content=product_8f1e0f1a21e6d32eb137",
        "productId": "246159",
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=246159",
        "tags": [
          "WL observed click - Hunting"
        ]
      },
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=2853&utm_source=constant_contact&utm_medium=email&utm_campaign=wl-20261118-hunting-r1&utm_content=product_d3dea4972e1a6045dbb1",
        "productId": "2853",
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=2853",
        "tags": [
          "WL observed click - Hunting"
        ]
      },
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=12990&utm_source=constant_contact&utm_medium=email&utm_campaign=wl-20261118-hunting-r1&utm_content=product_c1a88083e9e9ed4a6e79",
        "productId": "12990",
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=12990",
        "tags": [
          "WL observed click - Heating"
        ]
      },
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=12887&utm_source=constant_contact&utm_medium=email&utm_campaign=wl-20261118-hunting-r1&utm_content=product_7e7f42d2db516575c10e",
        "productId": "12887",
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=12887",
        "tags": [
          "WL observed click - Heating"
        ]
      },
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=12888&utm_source=constant_contact&utm_medium=email&utm_campaign=wl-20261118-hunting-r1&utm_content=product_8b799db86855c86bcbad",
        "productId": "12888",
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=12888",
        "tags": [
          "WL observed click - Heating"
        ]
      }
    ]
  },
  {
    "campaignId": "d19bd94a-79e0-48f3-87fe-9be81718f84f",
    "activityId": "f2c11523-4f3d-49df-97d2-dec096bd4882",
    "campaignKey": "wl-20261118-stihl-r1",
    "allowProviderBinding": true,
    "links": [
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=294888&utm_source=constant_contact&utm_medium=email&utm_campaign=wl-20261118-stihl-r1&utm_content=product_a3913283073904b30da3",
        "productId": "294888",
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=294888",
        "tags": [
          "WL observed click - STIHL",
          "WL observed click - Outdoor equipment"
        ]
      },
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=294922&utm_source=constant_contact&utm_medium=email&utm_campaign=wl-20261118-stihl-r1&utm_content=product_60f2cacc9d98d96ebf8a",
        "productId": "294922",
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=294922",
        "tags": [
          "WL observed click - STIHL",
          "WL observed click - Outdoor equipment"
        ]
      },
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=294864&utm_source=constant_contact&utm_medium=email&utm_campaign=wl-20261118-stihl-r1&utm_content=product_bd76a4b98a6bba07688e",
        "productId": "294864",
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=294864",
        "tags": [
          "WL observed click - STIHL",
          "WL observed click - Outdoor equipment"
        ]
      },
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=294884&utm_source=constant_contact&utm_medium=email&utm_campaign=wl-20261118-stihl-r1&utm_content=product_367622a9dcb64049c029",
        "productId": "294884",
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=294884",
        "tags": [
          "WL observed click - STIHL",
          "WL observed click - Outdoor equipment"
        ]
      }
    ]
  },
  {
    "campaignId": "cfa7772d-974b-4535-a2d7-a3e900c39f67",
    "activityId": "728940f4-0c13-4657-9bcd-3f4c714a5407",
    "campaignKey": "wl-20261118-gifting-r1",
    "allowProviderBinding": true,
    "links": [
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=265511&utm_source=constant_contact&utm_medium=email&utm_campaign=wl-20261118-gifting-r1&utm_content=product_9e11cedbc1aa49130756",
        "productId": "265511",
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=265511",
        "tags": [
          "WL observed click - Tools and DIY gifts"
        ]
      },
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=253020&utm_source=constant_contact&utm_medium=email&utm_campaign=wl-20261118-gifting-r1&utm_content=product_84041c6d8943c2da36d3",
        "productId": "253020",
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=253020",
        "tags": [
          "WL observed click - Tools and DIY gifts"
        ]
      },
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=276739&utm_source=constant_contact&utm_medium=email&utm_campaign=wl-20261118-gifting-r1&utm_content=product_6da60b8a7283e1425e4a",
        "productId": "276739",
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=276739",
        "tags": [
          "WL observed click - Tools and DIY gifts"
        ]
      },
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=284760&utm_source=constant_contact&utm_medium=email&utm_campaign=wl-20261118-gifting-r1&utm_content=product_ce9aa179448019cbbf1f",
        "productId": "284760",
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=284760",
        "tags": [
          "WL observed click - Tools and DIY gifts"
        ]
      },
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=86866&utm_source=constant_contact&utm_medium=email&utm_campaign=wl-20261118-gifting-r1&utm_content=product_b5ac3da2096bd8de5f94",
        "productId": "86866",
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=86866",
        "tags": [
          "WL observed click - Tools and DIY gifts"
        ]
      },
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=14134&utm_source=constant_contact&utm_medium=email&utm_campaign=wl-20261118-gifting-r1&utm_content=product_54a9a32e860f64c804b2",
        "productId": "14134",
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=14134",
        "tags": [
          "WL observed click - Tools and DIY gifts"
        ]
      },
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=19911&utm_source=constant_contact&utm_medium=email&utm_campaign=wl-20261118-gifting-r1&utm_content=product_7abde459edaba373a3d2",
        "productId": "19911",
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=19911",
        "tags": [
          "WL observed click - Tools and DIY gifts"
        ]
      },
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=16923&utm_source=constant_contact&utm_medium=email&utm_campaign=wl-20261118-gifting-r1&utm_content=product_1350f6d4ffd97779031f",
        "productId": "16923",
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=16923",
        "tags": [
          "WL observed click - Tools and DIY gifts"
        ]
      },
      {
        "url": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=16265&utm_source=constant_contact&utm_medium=email&utm_campaign=wl-20261118-gifting-r1&utm_content=product_c251fd9757558a208d39",
        "productId": "16265",
        "providerUrl": "https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=16265",
        "tags": [
          "WL observed click - Tools and DIY gifts"
        ]
      }
    ]
  }
];
const WL_CLICK_TAGS = ["WL observed click - Holiday lighting", "WL observed click - C9 lights", "WL observed click - Icicle lights", "WL observed click - Net lights", "WL observed click - C6 lights", "WL observed click - T5 lights", "WL observed click - Christmas collection", "WL observed click - Hunting", "WL observed click - STIHL", "WL observed click - Outdoor equipment", "WL observed click - Tools and DIY gifts", "WL observed click - Heating"];
function wlCcPage_(href, root) {
  const path=String(href||'').replace(/^https:\/\/api\.cc\.email\/v3(?=\/)/,'').replace(/^\/v3(?=\/)/,'');
  if(path.indexOf(root)!==0 || /:\/\/|\.\.|[\r\n]/.test(path) || !['','?','/'].includes(path.slice(root.length,root.length+1))) throw new Error('Unexpected Constant Contact report page');
  return path;
}
function wlReadTags_() {
  let path='/contact_tags?limit=200',tags=[],pages=0;
  while(path){if(++pages>10)throw new Error('Tag collection is incomplete');const data=ccGet_(path);tags=tags.concat(data.tags||data.contact_tags||[]);path=data._links&&data._links.next?wlCcPage_(data._links.next.href,'/contact_tags'):'';}
  return tags;
}
function configureChristmasClickLearning() {
  const tags=wlReadTags_(),mapping={};
  WL_CLICK_TAGS.forEach(function(name){let tag=tags.find(function(x){return String(x.name).toLowerCase()===name.toLowerCase();});if(!tag)tag=ccPost_('/contact_tags',{name:name},'Create observed-interest tag failed');if(!tag.tag_id)throw new Error('Tag ID missing');mapping[name]=tag.tag_id;});
  setProp_('WL_CLICK_TAG_IDS',JSON.stringify(mapping));
  const result={ok:true,tagsConfigured:Object.keys(mapping).length,contactsTagged:0,campaignsSent:0,reportPermissionRequired:true};console.log(JSON.stringify(result));return result;
}
function authorizeContactConnection() {
  const result={authorizeUrl:buildAuthorizeUrl_(false),requestedScopes:'contact_data offline_access'};console.log(JSON.stringify(result));return result;
}
function authorizeMarketingReportAccess() {
  const result={authorizeUrl:buildAuthorizeUrl_(true),requestedScopes:'contact_data campaign_data offline_access',purpose:'Read sent-campaign click reports and maintain observed-interest tags; worker never sends emails'};
  console.log(JSON.stringify(result));return result;
}
function enableMarketingClickLearning() {
  WL_CLICK_CAMPAIGNS.forEach(function(c){const activity=ccGet_('/emails/activities/'+c.activityId);if(activity.role&&!['primary_email','resend'].includes(activity.role))throw new Error('Unsupported campaign report role');});
  if(!getProp_('WL_CLICK_TAG_IDS'))throw new Error('Configure observed tags first');
  setProp_('WL_CLICK_LEARNING_ENABLED','true');
  const result={ok:true,enabled:true,clockTriggerRequired:true,sendsEnabled:false};console.log(JSON.stringify(result));return result;
}
// Bind only exact, pre-reviewed canonical destinations within this sent activity.
// The provider report supplies its own opaque URL ID; no arbitrary URL/query stripping.
function wlBindReviewedLinks_(config,rows) {
  if(!config.allowProviderBinding)return config;
  return Object.assign({},config,{links:config.links.map(function(link){
    if(link.providerUrlId||!link.providerUrl)return link;
    const matches=rows.filter(function(row){return row.link_url===link.providerUrl&&/^\d+$/.test(String(row.url_id));});
    return matches.length===1?Object.assign({},link,{providerUrlId:String(matches[0].url_id)}):link;
  })});
}
function wlClickGroups_(rows,providerLinks,config,now) {
  const byId={};providerLinks.forEach(function(row){const link=config.links.find(function(link){return row.link_url===link.url || (link.providerUrl&&row.link_url===link.providerUrl&&String(row.url_id)===link.providerUrlId);});if(link)byId[String(row.url_id)]={link:link,reportedUrl:row.link_url};});
  const groups={};
  rows.forEach(function(row){const mapped=byId[String(row.url_id)],link=mapped&&mapped.link,at=Date.parse(row.created_time);if(!link||(row.link_url!==mapped.reportedUrl&&row.link_url!==link.url)||row.campaign_activity_id!==config.activityId||row.tracking_activity_type!=='em_clicks'||!/^[a-f0-9-]{36}$/i.test(row.contact_id||'')||!Number.isFinite(at)||at>now||now-at>30*86400000)return;
    const group=groups[row.contact_id]||(groups[row.contact_id]={contactId:row.contact_id,tags:[]});link.tags.forEach(function(tag){if(group.tags.indexOf(tag)<0)group.tags.push(tag);});});
  return Object.keys(groups).sort().map(function(id){return groups[id];});
}
function wlReconcileClickJobs_() {
  const jobs=JSON.parse(getProp_('WL_CLICK_PENDING_JOBS')||'[]'),pending=[];let failed=0,completed=0;
  jobs.forEach(function(id){const job=ccGet_('/activities/'+id);if(job.state==='completed'&&!(job.activity_errors||[]).length)completed++;else if(job.state==='failed'||(job.activity_errors||[]).length)failed++;else pending.push(id);});
  setProp_('WL_CLICK_PENDING_JOBS',JSON.stringify(pending));
  if(pending.length>60)throw new Error('Observed tag jobs need reconciliation');
  if(failed)WL_CLICK_CAMPAIGNS.forEach(function(c){setProp_('WL_CLICK_CURSOR_'+c.activityId,'');});
  return {pending:pending,completed:completed,failed:failed};
}
function syncMarketingClickSegments() {
  if(getProp_('WL_CLICK_LEARNING_ENABLED')!=='true')return {ok:false,status:'disabled',contactsTagged:0,campaignsSent:0};
  // Do not hold the script lock across CC calls: token refresh uses that lock.
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return {ok:false,status:'busy'};
  const now=Date.now(),jobId=Utilities.getUuid();
  try{const active=JSON.parse(getProp_('WL_CLICK_RUNNING')||'{}');if(active.until>now)return {ok:false,status:'busy'};setProp_('WL_CLICK_RUNNING',JSON.stringify({id:jobId,until:now+360000}));}finally{lock.releaseLock();}
  try {
    const tagIds=JSON.parse(getProp_('WL_CLICK_TAG_IDS')||'{}'),jobs=wlReconcileClickJobs_();
    const summary={ok:true,campaignsChecked:0,draftCampaignsSkipped:0,notCompletedCampaignsSkipped:0,campaignStates:[],providerLinksSeen:0,registeredLinksMatched:0,contactsChecked:0,consentSkipped:0,tagLimitSkipped:0,tagAssignmentsQueued:0,jobsCompleted:jobs.completed,jobsFailed:jobs.failed,campaignsSent:0};
    WL_CLICK_CAMPAIGNS.forEach(function(config){
      const activity=ccGet_('/emails/activities/'+config.activityId);summary.campaignsChecked++;
      summary.campaignStates.push({activityId:config.activityId,status:activity.current_status,role:activity.role});
      if(String(activity.current_status||'').toUpperCase()!=='DONE'){summary.notCompletedCampaignsSkipped++;if(/draft/i.test(activity.current_status||''))summary.draftCampaignsSkipped++;return;}
      if(!['primary_email','resend'].includes(activity.role))throw new Error('Unsupported campaign report role');
      const root='/reports/email_reports/'+config.activityId,links=ccGet_(root+'/links?no_clicks=true');
      if(links.campaign_activity_id!==config.activityId)throw new Error('Provider link report mismatch');
      config=wlBindReviewedLinks_(config,links.link_click_counts||[]);
      summary.providerLinksSeen+=(links.link_click_counts||[]).length;
      summary.registeredLinksMatched+=config.links.filter(function(link){return (links.link_click_counts||[]).some(function(x){return link.url===x.link_url || (link.providerUrl===x.link_url&&link.providerUrlId===String(x.url_id));});}).length;
      let path=root+'/tracking/clicks?limit=500',rows=[],pages=0;
      while(path){if(++pages>20)throw new Error('Click report requires a larger reviewed import');const page=ccGet_(path);if(!Array.isArray(page.tracking_activities))throw new Error('Click report incomplete');rows=rows.concat(page.tracking_activities);path=page._links&&page._links.next?wlCcPage_(page._links.next.href,root+'/tracking/clicks'):'';}
      const all=wlClickGroups_(rows,links.link_click_counts||[],config,now),cursor=getProp_('WL_CLICK_CURSOR_'+config.activityId)||'',remaining=all.filter(function(x){return x.contactId>cursor;}),byTag={},pendingIds=[];let last=cursor,processed=0;
      for(let i=0;i<remaining.length;i++){
        if(processed>=150||Date.now()-now>240000)break;
        const group=remaining[i],contact=ccGet_('/contacts/'+group.contactId+'?include=taggings');summary.contactsChecked++;processed++;last=group.contactId;
        if(contact.contact_id!==group.contactId||!contact.email_address||!['explicit','implicit'].includes(contact.email_address.permission_to_send)||contact.deleted_at){summary.consentSkipped++;continue;}
        const existing=contact.taggings||[];const wanted=group.tags.map(function(name){if(!tagIds[name])throw new Error('Observed tag is not configured');return tagIds[name];}).filter(function(id){return existing.indexOf(id)<0;});
        if(existing.length+wanted.length>50){summary.tagLimitSkipped++;continue;}
        wanted.forEach(function(id){(byTag[id]||(byTag[id]=[])).push(group.contactId);});
      }
      Object.keys(byTag).forEach(function(tagId){const ids=byTag[tagId];for(let n=0;n<ids.length;n+=100){const chunk=ids.slice(n,n+100),result=ccPost_('/activities/contacts_taggings_add',{source:{contact_ids:chunk},tag_ids:[tagId]},'Observed tag activity failed');if(!result.activity_id)throw new Error('Tag activity acknowledgement missing');pendingIds.push(result.activity_id);summary.tagAssignmentsQueued+=chunk.length;}});
      // Queued is not applied. The next run verifies native bulk-job completion.
      setProp_('WL_CLICK_PENDING_JOBS',JSON.stringify(jobs.pending.concat(pendingIds)));
      jobs.pending=jobs.pending.concat(pendingIds);
      setProp_('WL_CLICK_CURSOR_'+config.activityId,processed<remaining.length?last:'');
    });
    try { refreshMarketingKpis_(); summary.kpisRefreshed=true; } catch (_) { summary.kpisRefreshed=false; }
    setProp_('WL_CLICK_LAST_SUMMARY',JSON.stringify(Object.assign({checkedAt:new Date().toISOString()},summary)));console.log(JSON.stringify(summary));return summary;
  } finally {const active=JSON.parse(getProp_('WL_CLICK_RUNNING')||'{}');if(active.id===jobId)PropertiesService.getScriptProperties().deleteProperty('WL_CLICK_RUNNING');}
}

// Authenticated editor diagnostic: public storefront URL structure only, no contacts.
function inspectChristmasLinkMapping() {
  const config=WL_CLICK_CAMPAIGNS[0],report=ccGet_('/reports/email_reports/'+config.activityId+'/links?no_clicks=true');
  const links=(report.link_click_counts||[]).filter(function(x){return /^https:\/\/webtrack\.woodsonlumber\.com\//i.test(x.link_url||'');}).map(function(x){
    const parts=x.link_url.split('?'),fields=(parts[1]||'').split('&').map(function(y){const i=y.indexOf('=');return {key:y.slice(0,i),value:y.slice(i+1)};});
    return {urlId:x.url_id,path:parts[0],queryKeys:fields.map(function(y){return y.key;}),publicFields:fields.filter(function(y){return /^(pid|pl1|pg|utm_source|utm_medium|utm_campaign|utm_content)$/.test(y.key);})};
  });
  const result={activityId:config.activityId,publicStorefrontLinks:links};console.log(JSON.stringify(result));return result;
}
