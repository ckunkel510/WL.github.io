'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../Checkout2.js'),'utf8');
function fixture(unavailable=false) {
  let invoiceEdits=0,deliveryEdits=0,click;
  const panes=[3,4,5].map(step=>{const classes=new Set(['wl-section-collapsed','wl-section-deferred']);if(unavailable&&step===4)classes.add('wl-step-unavailable');return {dataset:{step:String(step),wlEditing:'0'},classList:{contains:name=>classes.has(name),remove(...names){names.forEach(name=>classes.delete(name));}},scrollIntoView(){},classes};});
  const wizard={querySelector:selector=>panes.find(p=>selector.includes('"'+p.dataset.step+'"')),addEventListener(name,handler){click=handler;}};
  const context=vm.createContext({panes,wizard,window:{WLCheckout:{showInvoiceEditor(){invoiceEdits++;},showDeliveryEditor(){deliveryEdits++;}}}});
  const start=source.indexOf('      function openSection(stepNum)');
  vm.runInContext(source.slice(start,source.indexOf('      function openFirstIncompleteSection()',start)),context);
  const handler=source.indexOf('      wizard.addEventListener("click", function (event)',start);
  vm.runInContext(source.slice(handler,source.indexOf('      wizard.addEventListener("input"',handler)),context);
  return {panes,invoice:()=>invoiceEdits,delivery:()=>deliveryEdits,back(){click({target:{closest:selector=>selector==='[data-wl-back]'?{getAttribute:()=> '4'}:null},preventDefault(){}});}};
}
test('Back from timing uses the existing section editor to open collapsed billing without storage or a public helper',()=>{
  const f=fixture();f.back();assert.equal(f.panes[1].dataset.wlEditing,'1');assert.equal(f.panes[1].classes.has('wl-section-collapsed'),false);assert.equal(f.panes[1].classes.has('wl-section-deferred'),false);assert.equal(f.invoice(),1);
});
test('consolidated Back skips unavailable sections and opens the preceding available editor',()=>{
  const f=fixture(true);f.back();assert.equal(f.panes[0].dataset.wlEditing,'1');assert.equal(f.delivery(),1);assert.equal(f.invoice(),0);
});
test('ordinary wizard mode does not install the consolidated section handler',()=>{
  const start=source.indexOf('    (function installSectionSummaries()');
  const block=source.slice(start,source.indexOf('    // Signed-in customers arriving',start));
  const context=vm.createContext({singlePageCheckout:false,wizard:{querySelectorAll(){throw Error('ordinary wizard must not install a section handler');}}});
  assert.doesNotThrow(()=>vm.runInContext(block,context));
});
