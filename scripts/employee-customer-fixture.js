(function () {
  'use strict';
  var panel=document.getElementById('ctl00_EmployeeStatusBar_LogonBarPanel'),slot=panel.parentElement;
  var native=document.getElementById('ctl00_EmployeeStatusBar_SelectCustomerImageButton');
  var errors=[];window.addEventListener('error',function(event){errors.push(event.message);});
  fixture.initialCalls=fixture.calls;
  function frames(){return new Promise(function(resolve){requestAnimationFrame(function(){requestAnimationFrame(resolve);});});}
  function setCustomer(cash){fixture.cash=cash;fixture.name=cash?'Demo Cash Customer':'Demo Building Supply';fixture.code=cash?'DEMO_CASH':'DEMO1042';panel.querySelector('.d-flex.flex-wrap.trunc-width').textContent=fixture.name+' ('+fixture.code+')';}
  native.addEventListener('click',function(event){event.preventDefault();fixture.nativeCalls++;document.getElementById('preview-native-result').textContent='Native customer picker invoked '+fixture.nativeCalls+' time(s). No account was switched.';});
  document.getElementById('preview-open').addEventListener('click',function(){document.getElementById('wl-staff-customer-toggle').click();});
  document.getElementById('preview-charge').addEventListener('click',function(){setCustomer(false);});
  document.getElementById('preview-cash').addEventListener('click',function(){setCustomer(true);});
  document.getElementById('preview-role').addEventListener('click',function(){if(panel.isConnected){panel.remove();this.textContent='Switch to employee view';}else{slot.appendChild(panel);this.textContent='Switch to customer view';}});
  document.getElementById('run-customer-checks').addEventListener('click',async function(){
    this.disabled=true;document.getElementById('customer-check-summary').textContent='Running checks…';var results=document.getElementById('customer-check-results'),passed=0,failed=0;results.replaceChildren();
    function check(name,value){var li=document.createElement('li');li.className=value?'pass':'fail';li.textContent=(value?'PASS — ':'FAIL — ')+name;results.appendChild(li);if(value)passed++;else failed++;}
    function drawer(){return document.getElementById('wl-staff-customer-drawer');}
    function toggle(){return document.getElementById('wl-staff-customer-toggle');}
    async function open(){toggle().focus();toggle().click();await frames();}
    WLStaffCustomerPanel.close();if(!panel.isConnected)slot.appendChild(panel);fixture.hold=false;fixture.mismatch=false;setCustomer(false);await frames();
    check('no account request occurs until the employee opens the drawer',fixture.initialCalls===0);
    check('the existing native customer control is retained exactly once',document.getElementById(native.id)===native&&document.querySelectorAll('#'+native.id).length===1);
    var bar=panel.closest('.sticky-header').getBoundingClientRect(),chip=toggle().getBoundingClientRect(),nav=document.querySelector('.main-nav').getBoundingClientRect();
    check('the customer chip fits the utility bar without overlapping navigation',chip.top>=bar.top-1&&chip.bottom<=bar.bottom+1&&chip.right<=nav.left+1);
    var calls=fixture.calls;await open();
    check('opening reads the account once with same-origin credentials and no cache',fixture.calls===calls+1&&fixture.lastOptions.credentials==='same-origin'&&fixture.lastOptions.cache==='no-store');
    check('only the matched customer summary and permitted account links render',drawer().dataset.state==='ready'&&drawer().textContent.includes('Demo Building Supply')&&drawer().querySelectorAll('.wl-staff-customer-links a').length===6);
    check('zero balances remain explicit and figures are copied without calculation',drawer().textContent.includes('$0.00')&&drawer().textContent.includes('$1,240.80'));
    var box=drawer().getBoundingClientRect();check('the drawer fits phone, tablet and desktop viewports',box.left>=-1&&box.right<=innerWidth+1&&box.top>=-1&&box.bottom<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1);
    var last=drawer().querySelector('.wl-staff-customer-refresh');last.focus();last.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));check('keyboard focus wraps inside the dialog',document.activeElement===drawer().querySelector('.wl-staff-customer-close'));
    drawer().dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));check('Escape closes, clears account details and restores focus',drawer().hidden&&drawer().querySelector('.wl-staff-customer-content').children.length===0&&document.activeElement===toggle()&&document.body.style.overflow!=='hidden');
    fixture.hold=true;toggle().click();await frames();setCustomer(true);await frames();fixture.release?.();await frames();check('a customer change cancels an old response and clears its details',drawer().hidden&&!drawer().textContent.includes('$1,240.80'));fixture.hold=false;
    await open();check('cash customers do not inherit credit balances',drawer().dataset.state==='ready'&&!drawer().querySelector('.wl-staff-customer-card dl'));
    var nativeBefore=fixture.nativeCalls;native.click();check('Change Customer runs its original handler exactly once',fixture.nativeCalls===nativeBefore+1&&drawer().hidden);
    setCustomer(false);await frames();fixture.mismatch=true;await open();check('a mismatched server customer fails closed',drawer().dataset.state==='unavailable'&&!drawer().textContent.includes('$1,240.80'));fixture.mismatch=false;WLStaffCustomerPanel.close();
    calls=fixture.calls;panel.remove();await frames();check('customer-only sessions have no chip or account request',!toggle()&&fixture.calls===calls);slot.appendChild(panel);await frames();check('native employee controls recover after a panel replacement',!!toggle()&&document.getElementById(native.id)===native);
    await open();window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));check('page caching closes and clears the customer drawer',drawer().hidden&&!drawer().querySelector('.wl-staff-customer-content').children.length);window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));setCustomer(true);await frames();check('restored pages resume customer-context synchronization',toggle().textContent.includes('Demo Cash Customer'));setCustomer(false);await frames();
    check('no uncaught browser errors occur',errors.length===0);
    document.getElementById('customer-check-summary').textContent=passed+' passed · '+failed+' failed at '+innerWidth+' × '+innerHeight;document.documentElement.dataset.customerChecks=failed?'fail':'pass';this.disabled=false;
  });
})();
