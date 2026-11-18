const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync('wl-site.js','utf8');
function harness(search,session=new Map()){
 let ready;const storage={getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,String(v)),removeItem:k=>session.delete(k)};
 const document={readyState:'loading',body:null,head:{appendChild(){}},addEventListener:(n,f)=>{if(n==='DOMContentLoaded')ready=f},createElement:()=>({setAttribute(){}}),getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]};
 const window={dataLayer:[],location:{pathname:'/ProductDetail.aspx',search},sessionStorage:storage,localStorage:storage,setTimeout(){},dispatchEvent(){}};
 vm.runInNewContext(source,{window,document,URLSearchParams,CustomEvent:function(){}});ready();return {window,session};
}
const link='?pid=174184&utm_source=constant_contact&utm_medium=email&utm_campaign=wl-20261118-hunting-r1&utm_content=product_acf660284e79487a5e94';
test('registered campaign landing is counted once per browser context and carries into ecommerce without customer identifiers',()=>{
 const h=harness(link+'&email=private@example.com&contact_id=private-identity');const events=()=>h.window.dataLayer.filter(x=>x.event_name==='email_landing');assert.equal(events().length,1);assert.equal(events()[0].campaign_key,'wl-20261118-hunting-r1');h.window.WLAnalytics.refresh();assert.equal(events().length,1);
 h.window.WLAnalytics.track('view_item',{ecommerce:{items:[{item_id:'174184',price:129.99}],currency:'USD'}});const e=h.window.dataLayer.find(x=>x.event_name==='view_item');assert.equal(e.campaign_product_id,'174184');assert.equal(e.attribution_basis,'public_utm_browser_session');assert.doesNotMatch(JSON.stringify(h.session.get('wl_email_campaign_session_v1')),/private|example|contact_id/);assert.doesNotMatch(JSON.stringify(e),/private|example|contact_id/);
 const next=harness('',h.session);next.window.WLAnalytics.track('view_item',{});assert.equal(next.window.dataLayer.find(x=>x.event_name==='view_item').campaign_key,'wl-20261118-hunting-r1');
});
test('unknown source, mismatched SKU and unregistered links cannot create or inherit campaign attribution',()=>{
 for(const q of [link.replace('pid=174184','pid=1'),link.replace('constant_contact','another_source'),link.replace('product_acf660284e79487a5e94','private@example.com')]){const h=harness(q);assert.equal(h.window.dataLayer.filter(x=>x.event_name==='email_landing').length,0);h.window.WLAnalytics.track('view_item',{});assert.equal(h.window.dataLayer.find(x=>x.event_name==='view_item').campaign_key,undefined);}
 const h=harness(link);const other=harness('?utm_source=another_source',h.session);other.window.WLAnalytics.track('view_item',{});assert.equal(other.window.dataLayer.find(x=>x.event_name==='view_item').campaign_key,undefined);
});
test('expired and forged session context is discarded',()=>{
 for(const c of [{campaign:'wl-20261118-hunting-r1',content:'product_acf660284e79487a5e94',product:'174184',at:Date.now()-1800001},{campaign:'fake',content:'private@example.com',product:'174184',at:Date.now()}]){const session=new Map([['wl_email_campaign_session_v1',JSON.stringify(c)]]);const h=harness('',session);h.window.WLAnalytics.track('view_item',{});assert.equal(h.window.dataLayer.find(x=>x.event_name==='view_item').campaign_key,undefined);assert.equal(session.has('wl_email_campaign_session_v1'),false);}
});
test('each revised camera, heater, battery and everyday-tool landing matches its own exact registered SKU',()=>{
 const registry=JSON.parse(fs.readFileSync('marketing/email-link-registry.json','utf8'));
 const additions={hunting:['246159','2853','12990','12887','12888','290616'],gifting:['19911','16923','16265'],stihl:['294914']};
 for(const [key,pids] of Object.entries(additions))for(const pid of pids){
  const campaign='wl-20261118-'+key+'-r1', content=Object.keys(registry[campaign]).find(k=>registry[campaign][k]===pid);
  assert.ok(content,'missing exact product registration '+pid);
  const search='?pid='+pid+'&utm_source=constant_contact&utm_medium=email&utm_campaign='+campaign+'&utm_content='+content;
  const h=harness(search),events=h.window.dataLayer.filter(x=>x.event_name==='email_landing');
  assert.equal(events.length,1);assert.equal(events[0].campaign_product_id,pid);
  assert.equal(harness(search.replace('pid='+pid,'pid=999')).window.dataLayer.filter(x=>x.event_name==='email_landing').length,0);
 }
});
