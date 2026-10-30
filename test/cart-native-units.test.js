'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../BuyNowPilot');
const rowSource=fs.readFileSync(require.resolve('../ShoppingCartRow.js'),'utf8');
const unitContext=vm.createContext({});
vm.runInContext(rowSource.slice(rowSource.indexOf('  function wlEpalletText('),rowSource.indexOf('  function wlEpalletNumber(')),unitContext);
function nativeRow(unit,quantity=1,styled=false,pid="22628",code="BHG") {
  const link={textContent:code,getAttribute:()=>'/ProductDetail.aspx?pid='+pid};
  const input={value:String(quantity),closest:()=>styled?null:{childNodes:[{nodeType:1,textContent:'1'},{nodeType:3,textContent:' '+unit+' '},{nodeType:1,textContent:'Update'}]}};
  return {textContent:'LP Black Humus',getAttribute:()=>styled?unit:null,
    querySelectorAll:selector=>selector==='a[href]'?[link]:[],
    querySelector:selector=>selector.includes('input.')?input:selector.includes('data-title')?(styled?{textContent:unit}:null):selector.includes('.description')?{textContent:'LP Black Humus'}:selector.includes('a[href')||selector.includes('portalGridLink')?link:null};
}
test('cart redesign captures the actual native quantity unit before removing its layout',()=>{
  for(const unit of ['Bag','ea','LF','SF','Box'])assert.equal(unitContext.wlCartLineUnit(nativeRow(unit)),unit);
  const row=nativeRow('Bag');row.querySelector=selector=>selector.includes('data-title')?{textContent:' Board '}:null;
  assert.equal(unitContext.wlCartLineUnit(row),'Board');
});
test('missing native unit stays unknown instead of becoming ea',()=>{
  assert.equal(unitContext.wlCartLineUnit({querySelector:()=>null}),'');
});
test('native and redesigned bag carts compare equally while changed quantities still fail comparison',()=>{
  const source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8');
  const context=vm.createContext({text:value=>String(value??'').replace(/\s+/g,' ').trim(),signedIn:()=>true,readableCart:()=>true,lines:core.lines,pidOf:value=>String(value).match(/[?&]pid=(\d+)/)?.[1]||''});
  vm.runInContext(source.slice(source.indexOf('    function cartFromDocument('),source.indexOf('    async function cart(')),context);
  const parse=row=>context.cartFromDocument({querySelectorAll:()=>[row]}).items;
  const original=parse(nativeRow('Bag')),styled=parse(nativeRow('Bag',1,true));
  assert.equal(core.signature(original),core.signature(styled));assert.equal(styled[0].unit,'bag');
  assert.notEqual(core.signature(original),core.signature(parse(nativeRow('Bag',2,true))));
  assert.notEqual(core.signature(original),core.signature(parse(nativeRow('ea',1,true))));
});

test('native pallet verification reads both native and redesigned lines while compact parsing still rejects them',()=>{
  const source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8');
  const context=vm.createContext({text:value=>String(value??'').replace(/\s+/g,' ').trim(),signedIn:()=>true,readableCart:()=>true,lines:core.lines,nativeCartLines:core.nativeCartLines,pidOf:value=>String(value).match(/[?&]pid=(\d+)/)?.[1]||''});
  vm.runInContext(source.slice(source.indexOf('    function cartFromDocument('),source.indexOf('    async function cart(')),context);
  const parse=styled=>({querySelectorAll:()=>[nativeRow('Bag',30,styled,'22444','ASC'),nativeRow('ea',1,styled,'23297','EPALLETS')]});
  for(const styled of [false,true]) {
    assert.throws(()=>context.cartFromDocument(parse(styled)),/Pallet/);
    const actual=context.cartFromDocument(parse(styled),true).items;
    assert.equal(actual[0].quantity,30);assert.equal(actual[1].quantity,1);
    assert.equal(core.nativeCartSignature(actual),core.nativeCartSignature(context.cartFromDocument(parse(false),true).items));
  }
});
