'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const core=require('../NativeCheckout'),loader=require('../CartNativeViews');
const ORIGIN='https://sce.toogo.io',KEY='wl_native_payment_closed_v1';
function fixture(options={}){
 const f={clock:Date.now(),busy:false,navigations:0,focused:0,frames:[],timers:new Map(),listeners:{},observers:[],storage:new Map(),nodes:new Map()};
 function node(tag='DIV'){
  const n={tagName:tag,id:'',children:[],hidden:false,innerText:'',style:{},attributes:{},getAttribute(k){return this.attributes[k]||null;},setAttribute(k,v){this.attributes[k]=v;},getBoundingClientRect:()=>({width:n.hidden?0:600,height:n.hidden?0:60}),querySelectorAll:()=>[],append(...children){for(const c of children)this.appendChild(c);},appendChild(c){this.children.push(c);if(c.id)f.nodes.set(c.id,c);return c;},remove(){f.nodes.delete(this.id);},focus(){f.focused++;}};return n;
 }
 const host=node();host.innerText=options.content||'';if(options.hidden)host.hidden=true;
 const doc={readyState:'complete',documentElement:node('HTML'),body:node('BODY'),querySelector:s=>s==='.mainContents'&&!options.layoutOnly&&!options.noHost?host:null,querySelectorAll:s=>s==='iframe'?f.frames:[],getElementById:id=>id==='MainLayoutRow'&&options.layoutOnly?host:f.nodes.get(id)||null,createElement:tag=>node(tag.toUpperCase()),addEventListener(name,fn){f.listeners['doc:'+name]=fn;},removeEventListener(name){delete f.listeners['doc:'+name];}};
 let timerId=0;
 const win={document:doc,location:{origin:'https://webtrack.woodsonlumber.com',pathname:'/ShoppingCart.aspx',href:'https://webtrack.woodsonlumber.com/ShoppingCart.aspx',assign(){f.navigations++;}},sessionStorage:{getItem:k=>f.storage.get(k)||null,setItem:(k,v)=>f.storage.set(k,v),removeItem:k=>f.storage.delete(k)},getComputedStyle:n=>({display:n.hidden?'none':'block',visibility:'visible'}),setTimeout(fn,ms){f.timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>f.timers.delete(id),addEventListener(name,fn){f.listeners[name]=fn;},removeEventListener(name){delete f.listeners[name];},Sys:{WebForms:{PageRequestManager:{getInstance:()=>({get_isInAsyncPostBack:()=>f.busy,add_endRequest:fn=>{f.endRequest=fn;}})}}},MutationObserver:class{constructor(fn){this.fn=fn;f.observers.push(this);}observe(){this.active=true;}disconnect(){this.active=false;}}};win.top=win;
 function frame(src=ORIGIN+'/hp/test') {const n=node('IFRAME');n.attributes.src=src;n.contentWindow={};f.frames.push(n);return n;}
 const first=frame();if(options.hiddenFrame)first.hidden=true;if(options.marker!==undefined)f.storage.set(KEY,options.marker);
 const controller=core.installPaymentCancelRecovery(win);
 return Object.assign(f,{win,doc,host,first,controller,frame,send(operation,extra={}){f.listeners.message({origin:ORIGIN,source:first.contentWindow,data:{operation},...extra});},flush(){const t=[...f.timers.entries()][0];if(t){f.timers.delete(t[0]);t[1].fn();}},panel(){return f.nodes.get('wl-native-payment-recovery');}});
}
test('only the expected provider origin and a remembered iframe may report close or a payment result',()=>{
 const source={},frames=[{source}];
 assert.equal(core.hostedPaymentOperation({origin:ORIGIN,source,data:{operation:'close'}},frames),'close');
 assert.equal(core.hostedPaymentOperation({origin:ORIGIN,source,data:{operation:'token'}},frames),'result');
 for(const event of [{origin:'https://sce.toogo.io.evil.test',source},{origin:'http://sce.toogo.io',source},{origin:ORIGIN,source:{}},{origin:ORIGIN,source,data:'{"operation":"close"}'},{origin:ORIGIN,source,data:{operation:'pay'}}])assert.equal(core.hostedPaymentOperation({data:{operation:'close'},...event},frames),null);
});
test('a genuine hosted close recovers a blank page with an explicit cart GET link and no automatic navigation',()=>{
 const f=fixture();f.send('close');assert.equal(f.panel(),undefined);f.flush();
 assert.equal(f.panel().children[0].textContent,'Card entry closed');const link=f.panel().children[2];assert.equal(link.href,'/ShoppingCart.aspx');assert.equal(link.textContent,'Return to cart');assert.equal(f.navigations,0);assert.equal(f.focused,1);assert.equal(f.storage.has(KEY),false);
 f.send('close');f.flush();assert.equal(f.focused,1);assert.equal(f.nodes.size,1);assert.equal(f.storage.has(KEY),false);
});
test('both guest and signed-in sessions use the same cancel recovery without reading account identity',()=>{
 for(const mode of ['guest','signed_in']){
  const f=fixture();f.storage.set('wl_checkout_mode',mode);f.send('close');f.flush();assert.ok(f.panel());
 }
});
test('the real native hosted-card return can recover an empty MainLayoutRow without a mainContents wrapper',()=>{
 const f=fixture({layoutOnly:true});f.send('close');f.flush();assert.ok(f.panel());
});
test('a usable native MainLayoutRow remains authoritative after card close',()=>{
 const f=fixture({layoutOnly:true,content:'Choose a card to use for payment'});f.send('close');f.flush();assert.equal(f.panel(),undefined);
});
test('an unknown document without a native checkout container is left untouched',()=>{
 const f=fixture({noHost:true});f.send('close');f.flush();assert.equal(f.panel(),undefined);
});
test('card tokens and result parameters remain opaque and native payment processing wins over close',()=>{
 const f=fixture();const data={operation:'token',get params(){throw Error('Payment parameters must never be inspected');}};
 f.send('close');f.send('token',{data});f.flush();assert.equal(f.panel(),undefined);assert.equal(f.storage.has(KEY),false);f.send('close');f.flush();assert.equal(f.panel(),undefined);
});
test('a native payment result arriving after the recovery panel removes it without resubmitting anything',()=>{
 const f=fixture();f.send('close');f.flush();assert.ok(f.panel());f.send('token');assert.equal(f.panel(),undefined);assert.equal(f.navigations,0);
});
test('a usable native checkout or cart remains authoritative and receives no duplicate recovery view',()=>{
 for(const content of ['Shipping & total','Select your payment method','Shopping Cart','Order confirmation']){
  const f=fixture({content});f.send('close');f.flush();assert.equal(f.panel(),undefined);assert.equal(f.storage.has(KEY),false);
 }
});
test('a hidden native container is recoverable and recovery never alters the provider iframe or its controls',()=>{
 const f=fixture({hidden:true,content:'Hidden native state'});f.send('close');f.flush();assert.ok(f.panel());assert.equal(f.first.hidden,false);assert.deepEqual(f.first.style,{});
});
test('a frame removed by the native close handler is still recognized through its cached window reference',()=>{
 const f=fixture();f.frames.length=0;f.send('close');f.flush();assert.ok(f.panel());
});
test('a newly added provider frame is remembered without inspecting its document or request parameters',()=>{
 const f=fixture();f.first.hidden=true;const later=f.frame();f.observers[0].fn([{type:'childList',addedNodes:[later]}]);f.send('close',{source:later.contentWindow});f.flush();assert.ok(f.panel());
});
test('the close marker survives a native navigation but stale and future markers cannot invent a cancellation',()=>{
 const fresh=fixture({marker:String(Date.now()),hiddenFrame:true});fresh.flush();assert.ok(fresh.panel());assert.equal(fresh.storage.has(KEY),false);
 for(const marker of [String(Date.now()-90001),String(Date.now()+90000),'invalid']){const f=fixture({marker});f.flush();assert.equal(f.panel(),undefined);assert.equal(f.storage.has(KEY),false);}
});
test('a carried close cannot cover a fresh visible native card window',()=>{
 const f=fixture({marker:String(Date.now())});f.flush();assert.equal(f.panel(),undefined);assert.equal(f.storage.has(KEY),false);
});
test('a newer native card attempt wins over an older frame close',()=>{
 const f=fixture();f.send('close');const next=f.frame();f.observers[0].fn([{type:'childList',addedNodes:[next]}]);f.flush();assert.equal(f.panel(),undefined);
});
test('pending WebForms work gets time to finish and a restored native view replaces recovery',()=>{
 const f=fixture();f.busy=true;f.send('close');f.flush();assert.equal(f.panel(),undefined);f.busy=false;f.flush();assert.ok(f.panel());f.host.innerText='Native payment choices';f.endRequest();f.flush();assert.equal(f.panel(),undefined);
});
test('a stuck blank native update eventually offers the manual escape without navigating or retrying payment',t=>{
 let now=1000;t.mock.method(Date,'now',()=>now);const f=fixture();f.busy=true;f.send('close');f.flush();assert.equal(f.panel(),undefined);now+=8001;f.flush();assert.ok(f.panel());assert.equal(f.navigations,0);
});
test('storage denial does not prevent same-document recovery or cause another payment request',()=>{
 const f=fixture();f.win.sessionStorage.setItem=()=>{throw Error('blocked');};f.win.sessionStorage.removeItem=()=>{throw Error('blocked');};f.send('close');f.flush();assert.ok(f.panel());assert.equal(f.navigations,0);
});
test('departure pauses work and Back/forward-cache restoration safely resumes the same recovery',()=>{
 const f=fixture();f.send('close');f.listeners.pagehide();f.flush();assert.equal(f.panel(),undefined);f.listeners.pageshow({persisted:true});f.flush();assert.ok(f.panel());f.controller.dispose();assert.equal(f.listeners.message,undefined);assert.equal(f.timers.size,0);
});
test('the native loader recognizes hosted payment views and carries a recent cancellation through a blank native return',()=>{
 assert.equal(loader.needsNativeViews({querySelector:s=>s.startsWith('iframe.')?{}:null,getElementById:()=>({})}),true);
 const scripts=[],win={location:{origin:'https://webtrack.woodsonlumber.com',pathname:'/ShoppingCart.aspx',href:'https://webtrack.woodsonlumber.com/ShoppingCart.aspx'},sessionStorage:{getItem:()=>String(Date.now())},addEventListener(){},setTimeout(){}};win.top=win;
 win.document={readyState:'complete',scripts,querySelector:()=>null,getElementById:()=>({}),createElement:()=>({setAttribute(){}}),head:{appendChild:s=>scripts.push(s)}};
 loader.boot(win);assert.equal(scripts.length,3);assert.match(scripts[0].src,/NativeCheckout\.js\?v=20261113-ups-handoff-7/);
});
