'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const holiday = require('../HolidayShop');
const now = Date.parse('2026-11-13T12:00:00-06:00');

function storage() {
  const values = new Map();
  return { getItem:k=>values.get(k) ?? null, setItem:(k,v)=>values.set(k,v), removeItem:k=>values.delete(k) };
}
function visitor() {
  return { localStorage:storage(), sessionStorage:storage(), document:{cookie:''} };
}
test('the seasonal window follows Central time and ends after Christmas Day', () => {
  assert.equal(holiday.inSeason(Date.parse('2026-11-13T05:59:59Z')), false);
  assert.equal(holiday.inSeason(Date.parse('2026-11-13T06:00:00Z')), true);
  assert.equal(holiday.inSeason(Date.parse('2026-12-26T05:59:59Z')), true);
  assert.equal(holiday.inSeason(Date.parse('2026-12-26T06:00:00Z')), false);
});
test('only shopping pages are eligible, including mixed case; commerce/account pages are excluded', () => {
  for (const path of ['/Products.aspx','/PRODUCTS.ASPX','/ProductDetail.aspx']) assert.equal(holiday.shoppingPage(path),true);
  for (const path of ['/ShoppingCart.aspx','/SignIn.aspx','/Default.aspx','/AccountInfo_R.aspx','/SelectPaymentMethod.aspx','/InvoiceDetails.aspx','/']) assert.equal(holiday.shoppingPage(path),false,path);
  assert.equal(holiday.christmasPage('/Products.aspx','?pl1=4647&pg=4649&sort=StockClassSort'),true);
  assert.equal(holiday.christmasPage('/ProductDetail.aspx','?pg=4649'),false);
  assert.equal(holiday.christmasPage('/Products.aspx','?pg=4651'),false);
  assert.equal(holiday.christmasContext('/Products.aspx','?pg=4651'),true);
  assert.equal(holiday.christmasContext('/ProductDetail.aspx','?pg=4660'),true);
  assert.equal(holiday.christmasContext('/Products.aspx','?pg=4518'),false);
});
test('a visit survives a new session and is eligible at exactly 24 hours', () => {
  const win=visitor();
  assert.equal(holiday.firstEntry(win),true);
  assert.equal(holiday.rememberVisit(win,now),true);
  assert.equal(holiday.firstEntry(win),false);
  win.sessionStorage=storage();
  assert.equal(holiday.firstEntry(win),true);
  assert.equal(holiday.recent(holiday.readVisit(win),now+holiday.DAY-1),true);
  assert.equal(holiday.recent(holiday.readVisit(win),now+holiday.DAY),false);
  // A long-lived tab still doesn't get a second invitation in the same session.
  assert.equal(holiday.firstEntry(win),false);
});
test('invalid stored values do not throw; future clock values suppress repeat popups', () => {
  for (const v of [null,'junk','NaN','Infinity',0,-3]) assert.equal(holiday.recent(v,now),false);
  assert.equal(holiday.recent(now+60000,now),true);
});
test('native page-size redirects do not consume a session entry before the delayed invitation opens', () => {
  const shared=visitor();
  let scheduled=0;
  for(const search of ['', '?itemsPerPage=48&pageIndex=0']) {
    const win={...shared,location:{origin:'https://webtrack.woodsonlumber.com',hostname:'webtrack.woodsonlumber.com',protocol:'https:',pathname:'/Products.aspx',search},setTimeout(){scheduled++;}};
    const css={sheet:{}};
    win.document={readyState:'complete',currentScript:{src:'https://ckunkel510.github.io/WL.github.io/HolidayShop.js'},documentElement:{hasAttribute:()=>false},getElementById:id=>id==='wl-holiday-styles'?css:null,cookie:''};
    win.top=win;
    const RealDateNow=Date.now;
    try { Date.now=()=>now;holiday.boot(win); } finally {Date.now=RealDateNow;}
    assert.equal(holiday.entryAvailable(win),true);
  }
  assert.equal(scheduled,2);
});
test('a first-party cookie preserves the 24-hour cap when localStorage is blocked', () => {
  const win=visitor();
  Object.defineProperty(win,'localStorage',{get(){throw new Error('blocked');}});
  assert.equal(holiday.rememberVisit(win,now),true);
  assert.equal(holiday.readVisit(win),now);
  assert.match(win.document.cookie,/Max-Age=86400; Path=\/; SameSite=Lax; Secure/);
});
test('closed account and barcode overlays do not suppress the invitation; visible dialogs do', () => {
  function modal(display,rects=1,hidden=false,ariaHidden=null) {
    return {hidden,getAttribute:()=>ariaHidden,getClientRects:()=>Array(rects).fill({}),style:{display,visibility:'visible'}};
  }
  const doc={defaultView:{getComputedStyle:e=>e.style},querySelectorAll:()=>[modal('none',0),modal('none',0)]};
  assert.equal(holiday.hasVisibleModal(doc),false);
  doc.querySelectorAll=()=>[modal('block')];
  assert.equal(holiday.hasVisibleModal(doc),true);
  doc.querySelectorAll=()=>[modal('block',1,true),modal('block',1,false,'true')];
  assert.equal(holiday.hasVisibleModal(doc),false);
});
test('when neither persistent store works the runtime declines to show a repeated popup', () => {
  const win=visitor();
  Object.defineProperty(win,'localStorage',{get(){throw new Error('blocked');}});
  Object.defineProperty(win.document,'cookie',{get(){return '';},set(){}});
  assert.equal(holiday.rememberVisit(win,now),false);
});
test('header refuses to load the seasonal runtime on other hosts, in frames, on excluded pages, or twice', () => {
  const source=fs.readFileSync(require.resolve('../headermodern'),'utf8');
  const block=source.slice(source.indexOf('  function loadHolidayShop()'),source.indexOf('  function loadSmartSearch()'));
  for(const mode of ['normal','other-host','frame','cart','account','duplicate','loaded','ended']) {
    const scripts=[];
    const win={location:{origin:mode==='other-host'?'https://www.woodsonlumber.com':'https://webtrack.woodsonlumber.com',pathname:mode==='cart'?'/ShoppingCart.aspx':mode==='account'?'/AccountInfo_R.aspx':'/Products.aspx'}};
    win.top=mode==='frame'?{}:win;
    if(mode==='loaded')win.WLHolidayShop={};
    const doc={querySelector:()=>mode==='duplicate'?{}:null,createElement:()=>({setAttribute(){}}),head:{appendChild:s=>scripts.push(s)}};
    const MockDate=class extends Date {static now(){return mode==='ended'?Date.parse('2026-12-26T06:00:00Z'):now;}};
    const context=vm.createContext({window:win,document:doc,Date:MockDate,WEBTRACK:'https://webtrack.woodsonlumber.com',HOLIDAY_SHOP_URL:'HolidayShop.js'});
    vm.runInContext(block,context);context.loadHolidayShop();
    assert.equal(scripts.length,mode==='normal'?1:0,mode);
  }
});
test('runtime boot rejects non-Webtrack origins, embeds, and cart pages', () => {
  for(const [origin,path,embedded] of [['https://www.woodsonlumber.com','/Products.aspx',false],['https://webtrack.woodsonlumber.com','/ShoppingCart.aspx',false],['https://webtrack.woodsonlumber.com','/Products.aspx',true]]) {
    const win={location:{origin,pathname:path,hostname:new URL(origin).hostname,search:'',protocol:'https:'},document:{documentElement:{hasAttribute:()=>false}}};win.top=embedded?{}:win;
    assert.equal(holiday.boot(win),null);
  }
});
