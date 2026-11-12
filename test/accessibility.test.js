'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../Accessibility');

test('zoom restrictions are removed without losing viewport sizing or safe-area settings', () => {
  assert.equal(core.zoomContent('width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover'), 'width=device-width,initial-scale=1,viewport-fit=cover');
  assert.equal(core.zoomContent(core.zoomContent('width=device-width, maximum-scale=2, user-scalable=0')), 'width=device-width');
});

test('accessibility cannot initialize on payment/account sites, other hosts or embedded checkout', () => {
  for (const [origin, pathname, embedded] of [
    ['https://example.invalid','/Products.aspx',false],
    ['https://webtrack.woodsonlumber.com','/AccountInfo_R.aspx',false],
    ['https://webtrack.woodsonlumber.com','/CustomerTokens.aspx',false],
    ['https://webtrack.woodsonlumber.com','/Products.aspx',true]
  ]) {
    const win = { location:{origin,pathname} }; win.top = embedded ? {} : win;
    assert.equal(core.boot(win), null);
  }
});

test('a repeated load reuses the existing runtime instead of binding a second set of handlers', () => {
  const runtime = {build:'existing'};
  const win = { location:{origin:'https://webtrack.woodsonlumber.com',pathname:'/ShoppingCart.aspx'}, WLAccessibilityRuntime:runtime }; win.top=win;
  assert.equal(core.boot(win),runtime);
});

test('header loads accessibility independently, once, only on the intended top-level page', () => {
  const source = fs.readFileSync(require.resolve('../headermodern'),'utf8');
  const block = source.slice(source.indexOf('  function loadAccessibility()'), source.indexOf('  function loadSmartSearch()'));
  for (const mode of ['normal','duplicate','loaded','account','frame','other-origin']) {
    const scripts=[];
    const win={location:{origin:mode==='other-origin'?'https://example.invalid':'https://webtrack.woodsonlumber.com',pathname:mode==='account'?'/AccountInfo_R.aspx':'/ShoppingCart.aspx'}};win.top=mode==='frame'?{}:win;
    if(mode==='loaded')win.WLAccessibilityEnhancer={};
    const doc={querySelector:()=>mode==='duplicate'?{}:null,createElement:()=>({setAttribute(){}}),head:{appendChild(s){scripts.push(s);}}};
    const context=vm.createContext({window:win,location:win.location,document:doc,WEBTRACK:'https://webtrack.woodsonlumber.com',ACCESSIBILITY_URL:'https://ckunkel510.github.io/WL.github.io/Accessibility.js?v=20261112-1'});
    vm.runInContext(block,context);context.loadAccessibility();
    assert.equal(scripts.length,mode==='normal'?1:0,mode);
    if(scripts.length)assert.equal(scripts[0].async,true);
  }
});

test('runtime has no commerce requests, persistence, field value setters, submission or native validator replacement', () => {
  const source=fs.readFileSync(require.resolve('../Accessibility'),'utf8');
  assert.doesNotMatch(source,/\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage|sendBeacon|__doPostBack|WebForm_DoPostBackWithOptions)\b/);
  assert.doesNotMatch(source,/\.value\s*=|\.checked\s*=|\.submit\s*\(|Page_ClientValidate\s*=|Page_IsValid\s*=/);
  assert.doesNotMatch(source,/\.innerHTML\s*=|console\./);
});
