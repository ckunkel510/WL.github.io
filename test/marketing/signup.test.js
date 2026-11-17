'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{webcrypto}=require('node:crypto');
const test=require('node:test'),assert=require('node:assert/strict');
function fixture({valid=true,marketing=true,beacon=true}={}) {
  const nodes={},beacons=[],fetches=[],scripts=[],listeners={};
  function node(value='',checked=false) {return {value,checked,style:{},getAttribute(){return null;},addEventListener(type,fn){this[type]=fn;}};}
  for(const id of ['FirstName','LastName','ContactName','EmailAddress','ContactTelephone']) nodes[`ctl00_PageBody_${id}TextBox`]=node(id==='EmailAddress'?'fixture@example.com':id==='ContactTelephone'?'9795670000':'Fixture');
  nodes['wl-signup-comm-prefs']=node();nodes['ctl00_PageBody_SignupButton']=node();nodes['wl-signup-pref-status']=node();
  for(const [key,checked] of [['email_mkt',marketing],['email_billing',true],['email_delivery',false],['sms_mkt',false]])nodes[`wl_signup_${key}`]=node('',checked);
  const context=vm.createContext({window:{location:{href:'https://fixture/UserSignup.aspx'},crypto:webcrypto,Page_ClientValidate:()=>valid},navigator:{sendBeacon:(url,body)=>{beacons.push({url,body});return beacon;}},Blob,Uint8Array,console:{warn(){}},fetch:(url,options)=>{fetches.push({url,options});return Promise.resolve({});},setTimeout:()=>1,clearTimeout(){},document:{readyState:'complete',getElementById:id=>nodes[id],querySelectorAll:()=>[{getAttribute:()=> 'deals'}],addEventListener:(type,fn)=>listeners[type]=fn,createElement:()=>({remove(){}}),head:{appendChild:script=>scripts.push(script)}}});
  const source=fs.readFileSync(path.join(__dirname,'../../Signupvalidation.js'),'utf8');
  vm.runInContext(source.slice(source.indexOf('/* ==========================================================\n   Woodson — Signup Communication Preferences')),context);
  return {context,nodes,beacons,fetches,scripts,click:()=>nodes['ctl00_PageBody_SignupButton'].click({defaultPrevented:false}),submit:()=>listeners.submit({defaultPrevented:false})};
}
test('one signup click plus native submit produces one consent submission',async()=>{const x=fixture();x.click();x.submit();assert.equal(x.beacons.length,1);const body=JSON.parse(await x.beacons[0].body.text());assert.deepEqual(body.interests,['deals']);assert.equal(body.emailListIntent,'subscribe');assert.match(body.requestId,/^[a-f0-9]{32}$/);});
test('rejected beacon falls back to keepalive fetch',()=>{const x=fixture({beacon:false});x.click();assert.equal(x.fetches.length,1);assert.equal(x.fetches[0].options.keepalive,true);assert.equal(x.fetches[0].options.mode,'no-cors');});
test('invalid native signup never transmits preferences',()=>{const x=fixture({valid:false});x.click();x.submit();assert.equal(x.beacons.length,0);assert.equal(x.fetches.length,0);});
test('billing permission alone never opts into marketing or declared interests',async()=>{const x=fixture({marketing:false});x.click();const body=JSON.parse(await x.beacons[0].body.text());assert.equal(body.emailMarketing,false);assert.equal(body.emailBilling,true);assert.equal(body.emailListIntent,'no_change');assert.deepEqual(body.interests,[]);});
test('only a backend acknowledgement can display saved',()=>{const x=fixture();x.click();assert.equal(x.nodes['wl-signup-pref-status'].textContent,'Sending communication preferences…');const callback=new URL(x.scripts[0].src).searchParams.get('callback');x.context.window[callback]({ok:true});assert.equal(x.nodes['wl-signup-pref-status'].textContent,'Communication preferences saved.');});
