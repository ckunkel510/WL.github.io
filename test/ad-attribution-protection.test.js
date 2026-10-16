'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../URLSanitize.js'),'utf8');
function clean(search){
 const location=new URL('https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=85&'+search),actions=[],listeners={};
 const window={location,history:{replaceState(_state,_title,url){actions.push(url);}},MutationObserver:null};
 const document={title:'Product',querySelectorAll:()=>[],addEventListener:(name,handler)=>listeners[name]=handler};
 vm.runInNewContext(source,{window,document,URL});
 return {url:new URL(actions.at(-1)||location.href),listeners};
}
test('long Google linker and click identifiers survive address cleanup without alteration',()=>{
 for(const key of ['_gl','_ga','gclid','gclsrc','gbraid','wbraid','dclid','gad_source','gad_campaignid']){
  const value='1~'+('Aa0-_'.repeat(90));const f=clean(new URLSearchParams({[key]:value,ReturnUrl:'nested',other:'x'.repeat(350)}));
  assert.equal(f.url.searchParams.get(key),value,key);assert.equal(f.url.searchParams.has('ReturnUrl'),false);assert.equal(f.url.searchParams.has('other'),false);assert.equal(f.url.searchParams.get('pid'),'85');
 }
});
test('campaign attribution remains intact even when long or containing redirect-like words',()=>{
 const value='spring_redirect_returnurl_'+('offer'.repeat(80));
 for(const key of ['utm_source','utm_medium','utm_campaign','utm_id','utm_term','utm_content','utm_source_platform'])assert.equal(clean(new URLSearchParams({[key]:value})).url.searchParams.get(key),value);
});
test('ordinary recursive and oversized URL junk is still removed',()=>{
 const f=clean('ReturnUrl=old&redirect_uri=loop&callback=old&foo='+('x'.repeat(300))+'&pg=549');
 for(const key of ['ReturnUrl','redirect_uri','callback','foo'])assert.equal(f.url.searchParams.has(key),false);assert.equal(f.url.searchParams.get('pg'),'549');
});
test('link navigation preserves the attribution fields while dropping recursive return data',()=>{
 const f=clean(''),value='1~'+('a'.repeat(380));let next,prevented=false;
 const anchor={getAttribute:key=>key==='href'?'/Products.aspx?pg=18&_gl='+value+'&ReturnUrl=loop':null,hasAttribute:()=>false};
 const window={location:{origin:'https://webtrack.woodsonlumber.com',href:'https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=85',pathname:'/ProductDetail.aspx',assign:url=>next=url},history:{replaceState(){}},MutationObserver:null};let click;
 vm.runInNewContext(source,{window,document:{title:'PDP',querySelectorAll:()=>[],addEventListener:(_name,handler)=>click=handler},URL});
 click({button:0,target:{closest:()=>anchor},preventDefault:()=>prevented=true});
 assert.ok(prevented);assert.equal(new URL(next).searchParams.get('_gl'),value);assert.equal(new URL(next).searchParams.has('ReturnUrl'),false);
});
