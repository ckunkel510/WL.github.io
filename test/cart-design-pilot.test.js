'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../CartDesignPilot');
function cartDocument({empty=false,checkout=false,cart=true}={}) {
  return {querySelector:selector=>selector.includes('CompleteCheckoutButton')?(checkout?{}:null):selector==='.mainContents'?{textContent:empty?'Your cart is currently empty.':''}:null,
    getElementById:()=>cart&&!empty?{}:null};
}
test('natural cart detection accepts populated and empty carts but excludes native checkout',()=>{
  assert.equal(core.naturalCart(cartDocument()),true);
  assert.equal(core.naturalCart(cartDocument({empty:true})),true);
  assert.equal(core.naturalCart(cartDocument({checkout:true})),false);
  assert.equal(core.naturalCart(cartDocument({cart:false})),false);
});
test('cart design starts loading for anonymous shoppers without account or storage requests',async()=>{
  const links=[];let requests=0;
  const doc=Object.assign(cartDocument(),{readyState:'complete',createElement:()=>({remove(){}}),head:{appendChild(link){links.push(link);link.onerror();}}});
  const win={document:doc,location:{origin:'https://webtrack.woodsonlumber.com',pathname:'/ShoppingCart.aspx'},setTimeout,clearTimeout,fetch(){requests++;throw Error('No account fetch needed');}};win.top=win;
  await core.boot(win);assert.equal(requests,0);assert.equal(links.length,1);assert.match(links[0].href,/CartDesignPilot\.css/);
  assert.equal(win.WLCartStudio,undefined); // A CSS failure keeps the native cart.
});
test('frames, other pages and checkout views do not load cart presentation assets',async()=>{
  for(const kind of ['frame','checkout','other-page','other-origin']) {
    let added=0;
    const doc=Object.assign(cartDocument({checkout:kind==='checkout'}),{readyState:'complete',createElement(){added++;throw Error('Unexpected UI');}});
    const win={document:doc,location:{origin:kind==='other-origin'?'https://example.invalid':'https://webtrack.woodsonlumber.com',pathname:kind==='other-page'?'/Products.aspx':'/ShoppingCart.aspx'}};win.top=kind==='frame'?{}:win;
    await core.boot(win);assert.equal(added,0);
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
test('item actions delegate once to the existing native control after confirming the current cart view',async()=>{
  const f=actionFixture();let verified=0;
  assert.equal(await core.delegateAction(f.row,'.delete-link',async()=>{verified++;return true;},()=>false),true);
  assert.equal(verified,1);assert.equal(f.clicks(),1);
});
test('changed page state, disabled actions, replaced rows and checkout overlays stop swipe mutations',async()=>{
  for(const mode of ['identity','disabled','detached','replaced','overlay']) {
    const f=actionFixture();if(mode==='disabled')f.control.disabled=true;
    const verify=async()=>{if(mode==='detached')f.row.isConnected=false;if(mode==='replaced')f.row.querySelector=()=>({});return mode!=='identity';};
    assert.equal(await core.delegateAction(f.row,'.delete-link',verify,()=>mode==='overlay'),false);assert.equal(f.clicks(),0);
  }
});
