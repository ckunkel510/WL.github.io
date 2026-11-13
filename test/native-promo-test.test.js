'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const core=require('../NativePromoTest');
const loader=require('../CartNativeViews');

function scope(href='https://webtrack.woodsonlumber.com/ShoppingCart.aspx?wl_native_promo_test=1') { const win={location:{href}};win.top=win;return win; }
test('only an explicit, unambiguous top-level WebTrack cart test URL enables the native form',()=>{
  assert.equal(core.requested(scope()),true);
  for(const href of ['https://webtrack.woodsonlumber.com/ShoppingCart.aspx','https://webtrack.woodsonlumber.com/ShoppingCart.aspx?wl_native_promo_test=0','https://webtrack.woodsonlumber.com/ShoppingCart.aspx?wl_native_promo_test=1&wl_native_promo_test=1','https://webtrack.woodsonlumber.com/ProductDetail.aspx?wl_native_promo_test=1','https://other.invalid/ShoppingCart.aspx?wl_native_promo_test=1']) assert.equal(core.requested(scope(href)),false,href);
  const frame=scope();frame.top={};assert.equal(core.requested(frame),false);
});
test('normal customer pages gain no styles, listeners, state, or field changes',()=>{
  const win=scope('https://webtrack.woodsonlumber.com/ShoppingCart.aspx');
  Object.defineProperty(win,'document',{get(){throw Error('normal page must not be inspected');}});
  core.boot(win);assert.equal(win.WLNativePromoTest,undefined);
});
test('visibility repair preserves native field value, Apply action, validation and totals',()=>{
  const ids=new Map(),input={value:'XMASLIGHTS2026',attrs:{},getAttribute(k){return this.attrs[k]||null;},setAttribute(k,v){this.attrs[k]=v;}},apply={href:'javascript:nativeApply()',onclick:()=>{},validationGroup:'native'},shipping={};
  ids.set('ctl00_PageBody_PromotionCodeEntry_PromoCodeTextBox',input);ids.set('ctl00_PageBody_PromotionCodeEntry_ApplyPromotionalCodeButton',apply);ids.set('ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView',shipping);
  const nativeBefore={...apply},doc={getElementById:id=>ids.get(id),createElement:()=>({}),head:{appendChild(node){ids.set(node.id,node);}}};
  assert.equal(core.reveal(doc),true);assert.equal(core.reveal(doc),true);
  assert.equal(ids.size,4);assert.equal(input.value,'XMASLIGHTS2026');assert.deepEqual(apply,nativeBefore);
  assert.equal(input.attrs['aria-label'],'Promotion code');
  assert.match(ids.get('wl-native-promo-test-style').textContent,/display:table-cell!important/);
  ids.delete('ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView');assert.equal(core.reveal(doc),false);
});
test('the normal loader requests the native dependencies plus pricing, and the opt-in adds only the visibility helper',()=>{
  for(const optIn of [false,true]) {
    const win=scope('https://webtrack.woodsonlumber.com/ShoppingCart.aspx'+(optIn?'?wl_native_promo_test=1':''));win.location.origin='https://webtrack.woodsonlumber.com';win.location.pathname='/ShoppingCart.aspx';
    const scripts=[];win.addEventListener=()=>{};
    win.document={readyState:'complete',scripts,querySelector:()=>({}),createElement:()=>({setAttribute(){}}),head:{appendChild:s=>scripts.push(s)}};
    loader.boot(win);assert.equal(scripts.length,optIn?5:4);assert.equal(scripts.filter(s=>/NativePromoTest\.js/.test(s.src)).length,optIn?1:0);
    assert.equal(scripts.filter(s=>/Checkout2\.js/.test(s.src)).length,1);assert.equal(scripts.filter(s=>/CardContainer\.js/.test(s.src)).length,1);
  }
});
