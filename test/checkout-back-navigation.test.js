'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../Checkout2.js'),'utf8');
function fixture(singlePageCheckout) {
  const collapsed=new Set(['wl-section-collapsed','wl-section-deferred']);let activeStep=5,invoiceEdits=0,scrolls=0,back;
  const pane={dataset:{wlEditing:'0'},classList:{contains:name=>collapsed.has(name),remove(...names){names.forEach(name=>collapsed.delete(name));}},scrollIntoView(){scrolls++;}};
  const context=vm.createContext({singlePageCheckout,num:5,panes:[pane],wizard:{querySelector:selector=>selector.includes('"4"')?pane:null},
    navDiv:{appendChild(node){back=node;}},document:{createElement:()=>({dataset:{},addEventListener(name,handler){this.click=handler;}})},
    showStep(n){activeStep=n;},getStep:()=>activeStep,window:{WLCheckout:{showInvoiceEditor(){invoiceEdits++;}}}});
  const start=source.indexOf('      function openSection(stepNum)');
  vm.runInContext(source.slice(start,source.indexOf('      function openFirstIncompleteSection()',start)),context);
  context.window.WLCheckout.openSection=context.openSection;
  const nav=source.indexOf('      if (num > 1) {');
  vm.runInContext(source.slice(nav,source.indexOf('      if (num < steps.length)',nav)),context);
  return {run:()=>back.click({preventDefault(){}}),collapsed,pane,active:()=>activeStep,edits:()=>invoiceEdits,scrolls:()=>scrolls};
}
test('Back from timing opens the collapsed billing section in consolidated checkout',()=>{
  const f=fixture(true);f.run();assert.equal(f.active(),4);assert.equal(f.pane.dataset.wlEditing,'1');assert.equal(f.collapsed.has('wl-section-collapsed'),false);assert.equal(f.collapsed.has('wl-section-deferred'),false);assert.equal(f.edits(),1);assert.equal(f.scrolls(),1);
});
test('the ordinary wizard Back action keeps its existing step navigation',()=>{
  const f=fixture(false);f.run();assert.equal(f.active(),4);assert.equal(f.edits(),0);assert.equal(f.scrolls(),0);
});
