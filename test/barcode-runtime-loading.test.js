'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(require.resolve(p),'utf8');
const handoff=read('../BarcodeScanner.js'),header=read('../headermodern.js'),legacy=read('../legacy/BarcodeScanner.js');
const quaggaURL='https://unpkg.com/quagga@0.12.1/dist/quagga.min.js';
function ui(f,name){let found;function visit(n){if((n.className||'').split(' ').includes(name))found=n;n.children.forEach(visit);}visit(f.doc.body);return found;}
function fixture({modern=false,loading=false,path='/Products.aspx',mobile=true}={}) {
  const timers=new Map(),observers=[],winEvents=new Map();let nextTimer=0;
  class Node {
    constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.events=new Map();this.attrs={};this.value="";this.classList={add(){},remove(){}};}
    appendChild(n){this.children.push(n);n.parentNode=this;return n;}
    remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);}
    setAttribute(k,v){this.attrs[k]=v;}
    getAttribute(k){return this.attrs[k];}
    removeAttribute(k){delete this.attrs[k];}
    focus(){doc.activeElement=this;}
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
  function quagga(){const handlers=new Set(),processed=new Set();const q={starts:0,stops:0,initError:null,init(options,cb){this.options=options;this.callback=cb;if(!this.holdInit)cb(this.initError);},start(){this.starts++;},stop(){this.stops++;},onDetected:fn=>handlers.add(fn),offDetected:fn=>handlers.delete(fn),onProcessed:fn=>processed.add(fn),offProcessed:fn=>processed.delete(fn),handlers,processed};win.Quagga=q;return q;}
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
  const f=fixture();f.installModern();assert.equal(f.scripts().length,0);const button=f.doc.getElementById('start-scanner'),overlay=f.doc.getElementById('wl-barcode-overlay');button.emit('click');assert.equal(f.scripts().length,1);assert.equal(button.disabled,true);overlay.children[0].children[0].children[1].emit('click');const q=f.quagga();f.scripts()[0].emit('load');assert.equal(q.starts,0);assert.equal(overlay.hidden,true);assert.equal(button.disabled,false);
});
test('modern scanner adopts old pending libraries and retries failures rather than waiting forever',()=>{
  const f=fixture();const pending=f.doc.createElement('script');pending.src=quaggaURL;f.doc.head.appendChild(pending);f.installModern();const button=f.doc.getElementById('start-scanner');button.emit('click');assert.equal(f.scripts().length,1);pending.emit('error');assert.equal(f.scripts().length,0);assert.equal(ui(f,'wl-barcode-retry').hidden,false);ui(f,'wl-barcode-retry').emit('click');assert.equal(f.scripts().length,1);f.expire(12000);assert.equal(f.scripts().length,0);assert.equal(ui(f,'wl-barcode-retry').hidden,false);
});
test('modern scanner supports denial, reopen, repeated detections, and removes only its own handler',()=>{
  const f=fixture();const q=f.quagga(),other=()=>{};q.handlers.add(other);f.installModern();const button=f.doc.getElementById('start-scanner'),overlay=f.doc.getElementById('wl-barcode-overlay');
  q.initError=Error('permission denied');button.emit('click');assert.equal(q.starts,0);assert.equal(ui(f,'wl-barcode-retry').hidden,false);assert.match(overlay.children[0].children[2].children[0].textContent,/Camera access is unavailable/);
  overlay.children[0].children[0].children[1].emit('click');q.initError=null;button.emit('click');assert.equal(q.starts,1);assert.equal(q.handlers.size,2);overlay.children[0].children[0].children[1].emit('click');assert.deepEqual([...q.handlers],[other]);
  button.emit('click');assert.equal(q.handlers.size,2);const handler=[...q.handlers].find(fn=>fn!==other);for(let i=0;i<3;i++)handler({codeResult:{code:'012345678905'}});f.expire(450);assert.match(f.win.location.href,/searchText=012345678905$/);assert.deepEqual([...q.handlers],[other]);assert.equal(overlay.hidden,false);assert.match(ui(f,'wl-barcode-status').textContent,/searching products/);
});

test('camera startup bypasses worker bootstrap, preserves image resolution, and cannot stall indefinitely',()=>{
  const f=fixture();const q=f.quagga();q.holdInit=true;f.installModern();f.doc.getElementById('start-scanner').emit('click');
  assert.equal(q.options.numOfWorkers,0);assert.equal(q.options.inputStream.size,1280);assert.equal(q.options.locator.patchSize,'small');
  f.expire(12000);assert.match(ui(f,'wl-barcode-status').textContent,/too long/);assert.equal(ui(f,'wl-barcode-retry').hidden,false);assert.equal(q.stops,1);
  q.callback(null);assert.equal(q.starts,0);
});
test('a running camera without decoder frames becomes recoverable and stops its tracks',()=>{
  const f=fixture();const q=f.quagga();f.installModern();f.doc.getElementById('start-scanner').emit('click');let stops=0;
  const video=f.doc.getElementById('wl-barcode-reader').children[0];video.srcObject={getTracks:()=>[{stop(){stops++;}}]};
  f.expire(6000);assert.match(ui(f,'wl-barcode-status').textContent,/scanning did not start/);assert.equal(stops,1);assert.equal(video.srcObject,null);assert.equal(q.handlers.size,0);assert.equal(q.processed.size,0);
});
test('processed frames keep the ready scanner active and offer a useful slow-read hint',()=>{
  const f=fixture();const q=f.quagga();f.installModern();f.doc.getElementById('start-scanner').emit('click');for(const fn of q.processed)fn();f.expire(6000);f.expire(7000);
  assert.match(ui(f,'wl-barcode-status').textContent,/Scanning for/);assert.match(ui(f,'wl-barcode-hint').textContent,/farther away/);assert.equal(q.stops,0);
});
test('real recorded EAN-13 normalizes to UPC, confirms before navigation, and close cancels the search',()=>{
  for(const close of [false,true]){const f=fixture();const q=f.quagga();f.installModern();f.doc.getElementById('start-scanner').emit('click');const fn=[...q.handlers][0];
    fn({codeResult:{code:'0762111571717',format:'ean_13'}});assert.match(ui(f,'wl-barcode-status').textContent,/hold steady/);fn({codeResult:{code:'0762111571717',format:'ean_13'}});
    assert.match(ui(f,'wl-barcode-status').textContent,/searching products/);assert.doesNotMatch(f.win.location.href,/searchText/);assert.equal(q.handlers.size,0);
    if(close)ui(f,'wl-barcode-close').emit('click');f.expire(450);assert.equal(/searchText=762111571717$/.test(f.win.location.href),!close);
  }
});
test('invalid checksums and poor detections are ignored while Code128 keeps its existing search support',()=>{
  const f=fixture();f.installModern();const validate=f.context.scannerSearchCode;
  assert.equal(validate({codeResult:{code:'0762111571718',format:'ean_13'}}),'');
  assert.equal(validate({codeResult:{code:'762111571717',decodedCodes:[{error:.8}]}}),'');
  assert.equal(validate({codeResult:{code:'6208698',format:'code_128'}}),'6208698');
  assert.equal(validate({codeResult:{code:'123456789012',format:'code_128'}}),'123456789012');
  assert.equal(validate({codeResult:{code:'x\n123',format:'code_128'}}),'');
});
test('manual entry pauses the camera, validates the whole number, preserves correction and searches once',()=>{
  const f=fixture();const q=f.quagga();f.installModern();f.doc.getElementById('start-scanner').emit('click');ui(f,'wl-barcode-manual-toggle').emit('click');assert.equal(q.stops,1);
  const input=f.doc.getElementById('wl-barcode-number'),form=ui(f,'wl-barcode-manual');assert.equal(form.hidden,false);assert.equal(f.doc.activeElement,input);assert.equal(input.attrs.maxlength,'32');
  input.value='0762111571718';form.emit('submit',{preventDefault(){}});assert.equal(input.value,'0762111571718');assert.equal(input.attrs['aria-invalid'],'true');assert.doesNotMatch(f.win.location.href,/searchText/);
  input.value='0 762111 571717';form.emit('submit',{preventDefault(){}});f.expire(0);assert.match(f.win.location.href,/searchText=762111571717$/);
});
test('late camera resolution after closing stops only the departed video and never starts scanning',()=>{
  const f=fixture();const q=f.quagga();q.holdInit=true;f.installModern();f.doc.getElementById('start-scanner').emit('click');const video=f.doc.getElementById('wl-barcode-reader').children[0];ui(f,'wl-barcode-close').emit('click');let stopped=0;
  video.srcObject={getTracks:()=>[{stop(){stopped++;}}]};video.emit('loadedmetadata');q.callback(null);assert.equal(stopped,1);assert.equal(q.starts,0);
});

test('leaving the page releases the camera and a background tab pauses without automatically reopening it',()=>{
  for(const leave of [true,false]){const f=fixture(),q=f.quagga();f.installModern();f.doc.getElementById('start-scanner').emit('click');
    if(leave){f.leave();assert.equal(f.doc.getElementById('wl-barcode-overlay').hidden,true);}else{f.doc.hidden=true;f.doc.emit('visibilitychange');assert.match(ui(f,'wl-barcode-status').textContent,/paused/);f.doc.hidden=false;f.doc.emit('visibilitychange');assert.equal(q.starts,1);}
    assert.equal(q.handlers.size,0);assert.equal(q.processed.size,0);assert.equal(q.stops,1);
  }
});
test('dialog traps keyboard focus, Escape closes, and manual entry removes the camera view',()=>{
  const f=fixture();f.quagga();f.installModern();f.doc.getElementById('start-scanner').emit('click');let prevented=0;
  f.doc.emit('keydown',{key:'Tab',shiftKey:true,preventDefault(){prevented++;}});assert.equal(f.doc.activeElement,ui(f,'wl-barcode-manual-toggle'));
  f.doc.emit('keydown',{key:'Tab',preventDefault(){prevented++;}});assert.equal(f.doc.activeElement,ui(f,'wl-barcode-close'));assert.equal(prevented,2);
  ui(f,'wl-barcode-manual-toggle').emit('click');assert.equal(ui(f,'wl-barcode-stage').hidden,true);assert.equal(ui(f,'wl-barcode-manual-toggle').hidden,true);
  f.doc.emit('keydown',{key:'Escape',preventDefault(){}});assert.equal(f.doc.getElementById('wl-barcode-overlay').hidden,true);assert.equal(f.doc.activeElement,f.doc.getElementById('start-scanner'));
});
