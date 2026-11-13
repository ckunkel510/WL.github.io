'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const cart=require('../CartDesignPilot');
function styleFixture() {
 const links=[],timers=[],state={};
 const document={documentElement:{dataset:state},createElement(){const e={removed:false,remove(){e.removed=true}};return e;},head:{appendChild:e=>links.push(e)}};
 const window={setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},clearTimeout(){}};
 return {links,timers,state,document,window,start:()=>cart.cartStyles(window,document,'https://example.invalid/cart.css')};
}
test('a stylesheet delayed beyond ten seconds still completes without cancelling or duplicating its request',async()=>{
 const f=styleFixture();let settled=false;const promise=f.start().then(ok=>{settled=true;return ok;});
 f.timers.find(t=>t.ms===10000).fn();await Promise.resolve();assert.equal(settled,false);assert.equal(f.state.wlCartStyleState,'delayed');assert.equal(f.links.length,1);assert.equal(f.links[0].removed,false);
 f.links[0].onload();assert.equal(await promise,true);assert.equal(f.state.wlCartStyleState,'ready');assert.equal(f.links.length,1);
});
test('a known CSS error gets one retry and obsolete callbacks cannot finish the replacement request',async()=>{
 const f=styleFixture(),promise=f.start(),old=f.links[0],late=old.onload;
 old.onerror();assert.equal(old.removed,true);assert.equal(f.state.wlCartStyleState,'retrying');f.timers.find(t=>t.ms===350).fn();
 late();assert.equal(f.state.wlCartStyleState,'loading');f.links[1].onload();assert.equal(await promise,true);assert.equal(f.links.length,2);
});
test('repeated CSS failure leaves native cart presentation available after two requests',async()=>{
 const f=styleFixture(),promise=f.start();f.links[0].onerror();f.timers.find(t=>t.ms===350).fn();f.links[1].onerror();assert.equal(await promise,false);assert.equal(f.state.wlCartStyleState,'failed');assert.equal(f.links.length,2);
});
test('a late stylesheet cannot activate cart presentation after native checkout has replaced the view',async()=>{
 let checkout=false,creates=0;const shell={isConnected:true},links=[];
 const doc={readyState:'complete',documentElement:{dataset:{}},querySelector:s=>s.includes('CompleteCheckoutButton')?(checkout?{}:null):s==='.mainContents'?shell:null,getElementById:()=>({}),createElement(){creates++;return{};},head:{appendChild:e=>links.push(e)}};
 const win={document:doc,location:{origin:'https://webtrack.woodsonlumber.com',pathname:'/ShoppingCart.aspx'},setTimeout:()=>1,clearTimeout(){}};win.top=win;
 const boot=cart.boot(win);checkout=true;links[0].onload();await boot;assert.equal(win.WLCartStudio,undefined);assert.equal(creates,1);
});
const header=fs.readFileSync(require.resolve('../headermodern.js'),'utf8');
const helper=header.slice(header.indexOf('  function loadCartRuntimeScript('),header.indexOf('  function loadCartDesign('));
function bus() {
 const handlers=new Map();return {addEventListener(name,fn){if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(fn);},emit(name){for(const fn of handlers.get(name)||[])fn();},dispatchEvent(event){this.emit(event.type);}};
}
function scriptFixture() {
 const scripts=[],timers=[];let prepared=0,failed=0;
 const win=Object.assign(bus(),{Event:class{constructor(type){this.type=type;}},setTimeout(fn,ms){timers.push({fn,ms});}});
 const doc={querySelector:()=>scripts.find(s=>!s.removed)||null,createElement(){const attrs=new Map();const script=Object.assign(bus(),{setAttribute:(n,v)=>attrs.set(n,v),getAttribute:n=>attrs.get(n),remove(){this.removed=true;}});return script;},head:{appendChild:e=>scripts.push(e)}};
 const c=vm.createContext({window:win,document:doc});vm.runInContext(helper,c);
 const load=()=>c.loadCartRuntimeScript('script[data-test]','https://example.invalid/core.js','data-test',s=>{prepared++;s.addEventListener('wl-asset-failed',()=>failed++);});
 return {load,scripts,timers,win,prepared:()=>prepared,failed:()=>failed};
}
test('pending critical scripts are requested once and never replaced merely because time passes',()=>{
 const f=scriptFixture(),first=f.load();assert.equal(f.load(),first);assert.equal(f.scripts.length,1);assert.equal(f.timers.length,0);assert.equal(f.prepared(),1);
 first.emit('load');assert.equal(first.getAttribute('data-wl-load-state'),'loaded');assert.equal(f.load(),first);assert.equal(f.scripts.length,1);
});
test('a known critical-script error retries once with a single logical checkout guard',()=>{
 const f=scriptFixture(),first=f.load();first.emit('error');assert.equal(f.failed(),0);assert.equal(first.getAttribute('data-wl-load-state'),'retrying');assert.equal(f.timers[0].ms,350);f.timers[0].fn();
 assert.equal(first.removed,true);assert.equal(f.scripts.length,2);assert.equal(f.prepared(),1);f.scripts[1].emit('load');assert.equal(f.failed(),0);assert.equal(f.scripts[1].getAttribute('data-wl-load-state'),'loaded');
});
test('failed delivery reports one logical failure only after its bounded retry',()=>{
 const f=scriptFixture();f.load().emit('error');f.timers[0].fn();f.scripts[1].emit('error');assert.equal(f.failed(),1);assert.equal(f.scripts[1].getAttribute('data-wl-load-state'),'failed');f.load();assert.equal(f.scripts.length,2);
});
test('Back navigation cancels a queued retry and never injects into an abandoned page',()=>{
 const f=scriptFixture();f.load().emit('error');f.win.emit('pagehide');f.timers[0].fn();assert.equal(f.scripts.length,1);assert.equal(f.failed(),0);
});

test('the inline root loader retries a failed header once and cancels retry on navigation',()=>{
 const html=fs.readFileSync(require.resolve('../config/webtrack-header-loader.html'),'utf8'),inline=html.match(/<script>([\s\S]*)<\/script>/)[1];
 for(const mode of ['success','failed','back']) {
  const f=scriptFixture();f.scripts.length=0;
  const document={getElementById:()=>f.scripts.find(s=>!s.removed)||null,createElement(){const attrs=new Map();return{setAttribute:(k,v)=>attrs.set(k,v),getAttribute:k=>attrs.get(k),remove(){this.removed=true;}};},head:{appendChild:s=>f.scripts.push(s)}};
  vm.runInNewContext(inline,{window:f.win,document});assert.equal(f.scripts.length,1);assert.equal(f.timers.length,0);
  f.scripts[0].onerror();if(mode==='back')f.win.emit('pagehide');f.timers[0].fn();
  if(mode==='back')assert.equal(f.scripts.length,1);
  else {assert.equal(f.scripts.length,2);if(mode==='success')f.scripts[1].onload();else f.scripts[1].onerror();assert.equal(f.scripts[1].getAttribute('data-wl-load-state'),mode==='success'?'loaded':'failed');assert.equal(f.timers.length,1);}
 }
});

test('legacy payment/review decoration is skipped only in the exact owned compact frame',()=>{
 for(const file of ['CardContainer.js','ShoppingCartSummary.js']) {
  const source=fs.readFileSync(require.resolve('../'+file),'utf8');
  const end=source.indexOf('  } catch (_) {}')+'  } catch (_) {}'.length;
  const guard=source.slice(source.indexOf('(function () {'),end)+'\n window.executed=true; })();';
  for(const mode of ['owned','top','foreign-name','unowned','cross-origin']) {
   const win={name:mode==='foreign-name'?'other':'woodson-buy-now-checkout',location:{origin:'https://webtrack.woodsonlumber.com'}};
   win.parent=mode==='top'?win:{location:{origin:mode==='cross-origin'?'https://example.invalid':win.location.origin},document:{querySelector:()=>mode==='unowned'?null:{contentWindow:win}}};
   vm.runInNewContext(guard,{window:win});assert.equal(win.executed,mode==='owned'?undefined:true,file+' '+mode);
  }
 }
});

test('native-view loader defers basket-only downloads and retains fallback, partial transitions and Back',()=>{
 const core=require('../CartNativeViews');
 for(const mode of ['cart','empty','native','transition','back','other-page']) {
  const scripts=[],timers=[];let native=mode==='native',mutate,disconnected=0;
  const win=Object.assign(bus(),{location:{origin:'https://webtrack.woodsonlumber.com',pathname:mode==='other-page'?'/Products.aspx':'/ShoppingCart.aspx',href:'https://webtrack.woodsonlumber.com/ShoppingCart.aspx'},setTimeout:fn=>timers.push(fn),MutationObserver:class{constructor(fn){mutate=fn;}observe(){}disconnect(){disconnected++;}}});
  win.document={readyState:'complete',scripts,body:{},querySelector:()=>native?{}:null,getElementById:id=>native?null:(id===(mode==='empty'?'ctl00_PageBody_EmptyCartPanel':'ctl00_PageBody_ShoppingCartDetailPanel')?{}:null),createElement:()=>({setAttribute(){},remove(){this.removed=true;}}),head:{appendChild:s=>scripts.push(s)}};
  core.boot(win);if(mode==='other-page'){assert.equal(scripts.length,0);continue;}
  assert.equal(scripts.length,mode==='native'?3:0,mode);
  if(mode==='transition'||mode==='back') {if(mode==='back')win.emit('pagehide');native=true;mutate();if(timers[0])timers[0]();assert.equal(scripts.length,mode==='transition'?3:0);}
  if(mode==='transition'){assert.equal(disconnected,1);assert.ok(scripts[0].src.includes('Checkout2.js'));assert.ok(scripts[1].src.includes('CartPricing.js'));assert.ok(scripts[2].src.includes('CardContainer.js'));}
 }
});
test('native-view loader deduplicates existing native script tags and retries only failed delivery',()=>{
 const core=require('../CartNativeViews'),scripts=[{src:'https://ckunkel510.github.io/WL.github.io/Checkout2.js'}],timers=[];
 const win=Object.assign(bus(),{location:{origin:'https://webtrack.woodsonlumber.com',pathname:'/ShoppingCart.aspx',href:'https://webtrack.woodsonlumber.com/ShoppingCart.aspx'},setTimeout:fn=>timers.push(fn)});
 win.document={readyState:'complete',scripts,querySelector:()=>({}),createElement:()=>({setAttribute(){},remove(){}}),head:{appendChild:s=>scripts.push(s)}};
 core.boot(win);assert.equal(scripts.length,3);assert.equal(timers.length,0);scripts[1].onerror();timers[0]();assert.equal(scripts.length,4);scripts[3].onerror();assert.equal(timers.length,1);
});
