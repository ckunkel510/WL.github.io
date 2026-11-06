'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(require.resolve(p),'utf8');
const handoff=read('../BarcodeScanner.js'),header=read('../headermodern.js'),legacy=read('../legacy/BarcodeScanner.js');
const quaggaURL='https://unpkg.com/quagga@0.12.1/dist/quagga.min.js';
function fixture({modern=false,loading=false,path='/Products.aspx',mobile=true}={}) {
  const timers=new Map(),observers=[],winEvents=new Map();let nextTimer=0;
  class Node {
    constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.events=new Map();this.attrs={};this.classList={add(){},remove(){}};}
    appendChild(n){this.children.push(n);n.parentNode=this;return n;}
    remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);}
    setAttribute(k,v){this.attrs[k]=v;}
    addEventListener(k,fn){if(!this.events.has(k))this.events.set(k,new Set());this.events.get(k).add(fn);}
    removeEventListener(k,fn){this.events.get(k)?.delete(fn);}
    emit(k,event={}){for(const fn of [...(this.events.get(k)||[])])fn(event);}
  }
  const root=new Node('html'),head=root.appendChild(new Node('head')),body=root.appendChild(new Node('body'));
  const all=()=>{const nodes=[];function visit(n){nodes.push(n);n.children.forEach(visit);}visit(root);return nodes;};
  const doc=new Node('document');Object.assign(doc,{head,body,documentElement:root,readyState:loading?'loading':'complete',currentScript:{src:'https://ckunkel510.github.io/WL.github.io/BarcodeScanner.js'},createElement:tag=>new Node(tag),getElementById:id=>all().find(n=>n.id===id)||null,querySelectorAll:()=>all().filter(n=>n.tagName==='SCRIPT'&&n.src)});
  function add(id,tag='div'){const n=body.appendChild(new Node(tag));n.id=id;return n;}
  add('ctl00_PageHeader_GlobalSearchControl_RadSearchBox1');add('c50_2');const headerScript=add('wl-header-locations-test','script');
  const win={location:{pathname:path,href:'https://webtrack.woodsonlumber.com'+path},setTimeout(fn,delay){timers.set(++nextTimer,{fn,delay});return nextTimer;},clearTimeout:id=>timers.delete(id),addEventListener(k,fn){winEvents.set(k,fn);},MutationObserver:class{constructor(fn){this.fn=fn;observers.push(this);}observe(){this.active=true;}disconnect(){this.active=false;}}};
  const context=vm.createContext({window:win,document:doc,navigator:{userAgent:mobile?'iPhone':'Desktop'},URL,console:{log(){},error(){},warn(){}},QUAGGA_URL:quaggaURL,debugLog(){}});
  function readyModern(){add('barcode-scanner-container');add('wl-barcode-overlay');observers.filter(o=>o.active).forEach(o=>o.fn());}
  if(modern)readyModern();
  function run(){vm.runInContext(handoff,context);}
  function expire(delay){for(const [id,t] of [...timers])if(t.delay===delay){timers.delete(id);t.fn();}}
  function quagga(){const handlers=new Set();const q={starts:0,stops:0,initError:null,init(options,cb){this.options=options;cb(this.initError);},start(){this.starts++;},stop(){this.stops++;},onDetected:fn=>handlers.add(fn),offDetected:fn=>handlers.delete(fn),handlers};win.Quagga=q;return q;}
  function installModern(){const a=header.indexOf('  function loadQuagga(callback)'),b=header.indexOf('  function normalizeHeaderContainers()',a);vm.runInContext(header.slice(a,b),context);context.addBarcodeScanner();}
  return {doc,win,context,run,expire,quagga,installModern,headerScript,readyModern,timers,observers,add,scripts:()=>doc.querySelectorAll(),leave:()=>winEvents.get('pagehide')?.()};
}
test('modern-first and header-later startup leave one scanner and never request legacy or the camera library',()=>{
  for(const modern of [true,false]){const f=fixture({modern});f.run();f.run();if(!modern)f.readyModern();f.expire(8000);assert.equal(f.scripts().length,0);assert.equal(f.doc.getElementById('barcode-scanner-container')!==null,true);assert.equal(f.timers.size,0);assert.ok(f.observers.every(o=>!o.active));}
});
test('failed or timed-out header uses one legacy fallback, reusing an available camera library',()=>{
  for(const failure of ['error','timeout']){const f=fixture();f.quagga();f.run();if(failure==='error')f.headerScript.emit('error');else f.expire(8000);f.run();f.expire(8000);assert.equal(f.scripts().length,1);assert.match(f.scripts()[0].src,/\/legacy\/BarcodeScanner\.js\?v=/);}
});
test('fallback adopts the old inline camera request instead of downloading another copy',()=>{
  const f=fixture();const pending=f.doc.createElement('script');pending.src=quaggaURL;f.doc.head.appendChild(pending);f.run();f.expire(8000);assert.equal(f.scripts().length,1);f.quagga();pending.emit('load');pending.emit('load');assert.equal(f.scripts().length,2);assert.match(f.scripts()[1].src,/legacy\/BarcodeScanner/);
});
test('a header arriving while the camera library loads wins over legacy',()=>{
  const f=fixture();f.run();f.expire(8000);const library=f.scripts()[0];assert.equal(library.src,quaggaURL);f.readyModern();f.quagga();library.emit('load');assert.equal(f.scripts().length,1);
});
test('legacy source retains its original behavior with an extra final race guard',()=>{
  const crypto=require('node:crypto');const originalSource=legacy.replace(' && !document.getElementById("barcode-scanner-container")','');
  assert.equal(crypto.createHash('sha256').update(originalSource).digest('hex'),'60bf40c861afea3c7945ccf72601b29c30674d9e397da68b512e91c4002d9c7e');
  const f=fixture({modern:true});vm.runInContext(legacy,f.context);assert.equal(f.scripts().length,0);
});
test('page departure, library failure and missing search input cannot inject late scanner controls',()=>{
  const gone=fixture();gone.run();gone.leave();gone.expire(8000);assert.equal(gone.scripts().length,0);
  const during=fixture();during.run();during.expire(8000);const pending=during.scripts()[0];during.leave();during.quagga();pending.emit('load');assert.equal(during.scripts().length,1);
  for(const mode of ['error','timeout']){const f=fixture();f.run();f.expire(8000);const script=f.scripts()[0];if(mode==='error')script.emit('error');else f.expire(12000);assert.equal(f.scripts().length,0);}
  const missing=fixture();missing.doc.getElementById('ctl00_PageHeader_GlobalSearchControl_RadSearchBox1').remove();missing.run();missing.expire(8000);assert.equal(missing.scripts().length,0);
});
test('non-product pages and desktop compatibility calls do not start fallback work',()=>{
  for(const options of [{path:'/ShoppingCart.aspx'},{mobile:false}]){const f=fixture(options);f.run();assert.equal(f.timers.size,0);assert.equal(f.scripts().length,0);}
  const f=fixture({loading:true});f.run();assert.equal(f.timers.size,0);f.doc.emit('DOMContentLoaded');assert.equal(f.timers.size,1);
});
test('modern scanner defers the camera library until open and safely closes during loading',()=>{
  const f=fixture();f.installModern();assert.equal(f.scripts().length,0);const button=f.doc.getElementById('start-scanner'),overlay=f.doc.getElementById('wl-barcode-overlay');button.emit('click');assert.equal(f.scripts().length,1);assert.equal(button.disabled,true);overlay.children[3].emit('click');const q=f.quagga();f.scripts()[0].emit('load');assert.equal(q.starts,0);assert.equal(overlay.hidden,true);assert.equal(button.disabled,false);
});
test('modern scanner adopts old pending libraries and retries failures rather than waiting forever',()=>{
  const f=fixture();const pending=f.doc.createElement('script');pending.src=quaggaURL;f.doc.head.appendChild(pending);f.installModern();const button=f.doc.getElementById('start-scanner');button.emit('click');assert.equal(f.scripts().length,1);pending.emit('error');assert.equal(f.scripts().length,0);assert.equal(button.disabled,false);button.emit('click');assert.equal(f.scripts().length,1);f.expire(12000);assert.equal(f.scripts().length,0);assert.equal(button.disabled,false);
});
test('modern scanner supports denial, reopen, repeated detections, and removes only its own handler',()=>{
  const f=fixture();const q=f.quagga(),other=()=>{};q.handlers.add(other);f.installModern();const button=f.doc.getElementById('start-scanner'),overlay=f.doc.getElementById('wl-barcode-overlay');
  q.initError=Error('permission denied');button.emit('click');assert.equal(q.starts,0);assert.equal(button.disabled,false);assert.match(overlay.children[2].textContent,/Camera access is unavailable/);
  overlay.children[3].emit('click');q.initError=null;button.emit('click');assert.equal(q.starts,1);assert.equal(q.handlers.size,2);overlay.children[3].emit('click');assert.deepEqual([...q.handlers],[other]);
  button.emit('click');assert.equal(q.handlers.size,2);const handler=[...q.handlers].find(fn=>fn!==other);for(let i=0;i<3;i++)handler({codeResult:{code:'012345678905'}});assert.match(f.win.location.href,/searchText=012345678905$/);assert.deepEqual([...q.handlers],[other]);assert.equal(overlay.hidden,true);
});
