'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../CartDesignPilot');
const checkout=require('../BuyNowPilot');

function profile(names,signedIn=true) {
  return {querySelector:()=>signedIn?{}:null,querySelectorAll:()=>names.map(textContent=>({textContent}))};
}
test('cart design identity requires consistent fresh native account headings and sign-out',()=>{
  assert.equal(core.nativeUser(profile(["Change details for user 'ckunkel2'","Change password for user 'ckunkel2'"])),'ckunkel2');
  assert.equal(core.nativeUser(profile(["Change details for user 'ckunkel3'"])),'ckunkel3');
  assert.equal(core.nativeUser(profile(["Change details for user 'ckunkel2'"],false)),'');
  assert.equal(core.nativeUser(profile(["Change details for user 'ckunkel2'","Change password for user 'other'"])), '');
  assert.equal(core.nativeUser(profile(['Welcome ckunkel2'])),'');
});
test('the private cart asset loader is limited to verified ckunkel2 on the top-level cart',()=>{
  function load(user,path='/ShoppingCart.aspx',framed=false,existing=false) {
    const scripts=[],win={location:{pathname:path},document:{querySelector:()=>existing?{}:null,createElement:()=>({setAttribute(){}}),head:{appendChild:s=>scripts.push(s)}}};win.top=framed?{}:win;
    checkout.loadPrivateCartDesign(win,user);return scripts;
  }
  assert.equal(load('ckunkel2').length,1);
  for(const user of ['','guest@example.invalid','ckunkel3','CKUNKEL2'])assert.equal(load(user).length,0);
  assert.equal(load('ckunkel2','/Products.aspx').length,0);
  assert.equal(load('ckunkel2','/ShoppingCart.aspx',true).length,0);
  assert.equal(load('ckunkel2','/ShoppingCart.aspx',false,true).length,0);
});
test('a stale loader or client identity hint cannot apply the private design to another account',async()=>{
  for(const user of ['ckunkel3','guest@example.invalid','']) {
    let added=0,requests=0;
    const server=profile(user?[`Change details for user '${user}'`]:[],!!user);
    const doc={readyState:'complete',querySelector:s=>s.includes('SignOut')?{}:null,getElementById:()=>({}),createElement(){added++;throw Error('Should not add private UI');}};
    const win={document:doc,location:{origin:'https://webtrack.woodsonlumber.com',pathname:'/ShoppingCart.aspx'},AbortController,setTimeout,clearTimeout,DOMParser:class{parseFromString(){return server;}},fetch:async()=>{requests++;return {ok:true,url:'https://webtrack.woodsonlumber.com/AccountSettings.aspx',text:async()=>''};},localStorage:{getItem:()=> 'ckunkel2'}};win.top=win;
    await core.boot(win);assert.equal(requests,1);assert.equal(added,0);assert.equal(win.WLCartStudio,undefined);
  }
});
test('anonymous pages, frames and checkout views do not perform private cart lookups',async()=>{
  for(const kind of ['anonymous','frame','checkout']) {
    let requests=0;
    const doc={readyState:'complete',querySelector:selector=>kind==='anonymous'?null:selector.includes('SignOut') || (kind==='checkout' && selector.includes('CompleteCheckoutButton'))?{}:null,getElementById:()=>kind==='checkout'?{}:null};
    const win={document:doc,location:{origin:'https://webtrack.woodsonlumber.com',pathname:'/ShoppingCart.aspx'},fetch(){requests++;}};win.top=kind==='frame'?{}:win;
    await core.boot(win);assert.equal(requests,0);
  }
});
test('swiping distinguishes vertical scrolling and requires a deliberate horizontal reveal',()=>{
  assert.equal(core.gestureAxis(-4,2),'');assert.equal(core.gestureAxis(-20,50),'y');assert.equal(core.gestureAxis(-70,7),'x');
  assert.equal(core.swipeOffset(0,-500),-164);assert.equal(core.swipeOffset(-164,500),0);
  assert.equal(core.revealAfterDrag(-30),false);assert.equal(core.revealAfterDrag(-70),true);
});
function actionFixture() {
  let clicks=0;const control={disabled:false,getAttribute:()=>null,click(){clicks++;}};
  const row={isConnected:true,querySelector:()=>control};return {row,control,clicks:()=>clicks};
}
test('item actions delegate once to the existing native control after fresh identity verification',async()=>{
  const f=actionFixture();let verified=0;
  assert.equal(await core.delegateAction(f.row,'.delete-link',async()=>{verified++;return true;},()=>false),true);
  assert.equal(verified,1);assert.equal(f.clicks(),1);
});
test('changed identity, disabled actions, replaced rows and checkout overlays stop swipe mutations',async()=>{
  for(const mode of ['identity','disabled','detached','replaced','overlay']) {
    const f=actionFixture();if(mode==='disabled')f.control.disabled=true;
    const verify=async()=>{if(mode==='detached')f.row.isConnected=false;if(mode==='replaced')f.row.querySelector=()=>({});return mode!=='identity';};
    assert.equal(await core.delegateAction(f.row,'.delete-link',verify,()=>mode==='overlay'),false);assert.equal(f.clicks(),0);
  }
});
