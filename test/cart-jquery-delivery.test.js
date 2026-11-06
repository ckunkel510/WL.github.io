'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
for(const file of ['ShoppingCartRow.js','ShoppingCartBranch.js','DeliveryOptions.js']) {
 test(file+' waits for parser-loaded jQuery instead of failing when it arrives asynchronously first',()=>{
  const listeners=new Map(),readyCalls=[];const doc={readyState:'loading',documentElement:{dataset:{}},body:{},addEventListener:(name,fn)=>listeners.set(name,fn),getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]};
  const win={location:{pathname:'/ShoppingCart.aspx',search:'',origin:'https://webtrack.woodsonlumber.com'},name:'',document:doc,addEventListener(){},setTimeout(){},sessionStorage:{getItem:()=>null},WLCheckout:{}};win.parent=win;
  const context=vm.createContext({window:win,document:doc,location:win.location,console:{log(){},warn(){},error(){}},sessionStorage:win.sessionStorage,localStorage:{getItem:()=>null},setTimeout(){},setInterval(){},clearTimeout(){},clearInterval(){},MutationObserver:class{observe(){}}});
  vm.runInContext(fs.readFileSync(require.resolve('../'+file),'utf8'),context);assert.equal(readyCalls.length,0);assert.equal(typeof listeners.get('DOMContentLoaded'),'function');
  const library=arg=>{if(typeof arg==='function'){readyCalls.push(arg);return;}return{ready(fn){readyCalls.push(fn);}};};
  win.jQuery=library;context.$=context.jQuery=library;doc.readyState='interactive';listeners.get('DOMContentLoaded')();assert.ok(readyCalls.length>0);
 });
 test(file+' keeps the native page usable if the required library itself failed',()=>{
  const doc={readyState:'complete',documentElement:{dataset:{}}};
  assert.doesNotThrow(()=>vm.runInNewContext(fs.readFileSync(require.resolve('../'+file),'utf8'),{window:{},document:doc}));
  assert.ok(Object.values(doc.documentElement.dataset).includes('missing'));
 });
}
