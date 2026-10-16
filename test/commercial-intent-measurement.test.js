'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../wl-site.js'),'utf8');
function fixture(type='product_list'){
 const events=[],context=vm.createContext({URL,pageType:()=>type,window:{location:{href:'https://webtrack.woodsonlumber.com/Products.aspx'}},pushEvent:(name,params)=>events.push({name,...params})});
 vm.runInContext(source.slice(source.indexOf('  function trackCommercialIntent('),source.indexOf('  function handleClick(')),context);
 return {events,click:href=>context.trackCommercialIntent({matches:()=>true,getAttribute:()=>href})};
}
test('catalog quote navigation records intent without customer query data or fabricated revenue',()=>{
 const f=fixture();f.click('https://woodsonwholesaleinc.formstack.com/forms/request_a_quote?email=private@example.invalid');
 assert.equal(f.events.length,1);assert.equal(f.events[0].name,'quote_request_click');assert.equal(f.events[0].lead_stage,'intent');assert.equal(f.events[0].value,undefined);assert.ok(!JSON.stringify(f.events).includes('private'));
});
test('the PDP sidebar remains the single owner of its quote clicks',()=>{
 const f=fixture('product_detail');f.click('https://woodsonwholesaleinc.formstack.com/forms/request_a_quote');assert.equal(f.events.length,0);
 const sidebar=fs.readFileSync(require.resolve('../product-sidebar.js'),'utf8');assert.match(sidebar,/wlTrack\("quote_request_click", \{ lead_source: "pdp_quote_request", lead_stage: "intent" \}\)/);assert.doesNotMatch(sidebar,/wlTrack\("generate_lead"/);
});
test('only known public store phone links emit a call intent without the phone number',()=>{
 const f=fixture();f.click('tel:+1-979-567-9805');f.click('tel:2125550199');f.click('mailto:person@example.invalid');f.click('https://other.example/forms/request_a_quote');
 assert.equal(f.events.length,1);assert.equal(f.events[0].name,'contact_click');assert.equal(f.events[0].store_branch,'Caldwell');assert.equal(f.events[0].interaction_type,'phone');assert.ok(!JSON.stringify(f.events).includes('979'));assert.ok(!JSON.stringify(f.events).includes('person'));
});
