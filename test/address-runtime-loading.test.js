'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const header=fs.readFileSync(require.resolve('../headermodern.js'),'utf8');
const start=header.indexOf('  function loadAddressManager()'),end=header.indexOf('  function injectStyles()',start);
function fixture({existing=true,path='/AddressList_R.aspx'}={}) {
  const nodes=[],timers=[];let hide;
  function script(src=''){return {src,attrs:{},listeners:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,fn){this.listeners[k]=fn;},remove(){nodes.splice(nodes.indexOf(this),1);}};}
  const original=script('https://ckunkel510.github.io/WL.github.io/AddressManagement.js');if(existing)nodes.push(original);
  const win={location:{pathname:path,href:'https://webtrack.woodsonlumber.com'+path},setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){},addEventListener(name,fn){if(name==='pagehide')hide=fn;}};
  const doc={querySelector(){return nodes.find(n=>n.attrs['data-wl-address-manager']);},querySelectorAll(){return nodes;},createElement:()=>script(),head:{appendChild(n){nodes.push(n);}}};
  const context=vm.createContext({window:win,document:doc,URL,ADDRESS_MANAGER_URL:'https://ckunkel510.github.io/WL.github.io/AddressManagement.js?v=20260707-2'});vm.runInContext(header.slice(start,end),context);
  return {context,win,nodes,timers,original,leave:()=>hide()};
}
test('the existing inline address request is reused instead of adding another script',()=>{
  const f=fixture();f.context.loadAddressManager();f.context.loadAddressManager();assert.equal(f.nodes.length,1);assert.equal(f.nodes[0],f.original);assert.equal(f.timers.length,1);
});
test('one failed inline request recovers through the modern loader without repeated retries',()=>{
  const f=fixture();f.context.loadAddressManager();f.original.listeners.error();f.original.listeners.error();f.timers[0]();assert.equal(f.nodes.length,1);assert.notEqual(f.nodes[0],f.original);assert.match(f.nodes[0].src,/AddressManagement\.js\?v=/);
});
test('slow scripts have a bounded recovery, while success and a departed page prevent another request',()=>{
  const slow=fixture();slow.context.loadAddressManager();slow.timers[0]();assert.notEqual(slow.nodes[0],slow.original);
  for(const mode of ['loaded','departed']){const f=fixture();f.context.loadAddressManager();if(mode==='loaded')f.win.WLAddressManager={};else f.leave();f.timers[0]();assert.equal(f.nodes[0],f.original);}
});
test('detail pages still receive the address manager, and unrelated pages do not',()=>{
  const detail=fixture({existing:false,path:'/AddressDetails.aspx'});detail.context.loadAddressManager();assert.equal(detail.nodes.length,1);
  const other=fixture({existing:false,path:'/Products.aspx'});other.context.loadAddressManager();assert.equal(other.nodes.length,0);
});
test('a late second address script reuses the existing API without registering another UI',()=>{
  const api={},context=vm.createContext({window:{WLAddressManager:api},module:{exports:{}},document:new Proxy({},{get(){throw Error('Duplicate initialization touched the DOM');}})});
  vm.runInContext(fs.readFileSync(require.resolve('../AddressManagement.js'),'utf8'),context);assert.equal(context.module.exports,api);
});
