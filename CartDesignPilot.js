/* Private cart design preview. Native cart controls remain the action owners. */
(function (root, factory) {
  'use strict';
  var core=factory();
  if (typeof module==='object' && module.exports) module.exports=core;
  else core.boot(root).catch(function () { /* Keep the existing cart if unavailable. */ });
})(typeof window==='object' ? window : null,function () {
  'use strict';
  var BUILD='20261016-cart-studio-3';
  var ORIGIN='https://webtrack.woodsonlumber.com';
  var ASSETS='https://ckunkel510.github.io/WL.github.io/';
  var THEMES=['canvas','slate','ink','original'];
  var PREFERENCE='wl_cart_studio_theme_v1:ckunkel2';
  var REVEAL=164;
  function text(value) { return String(value || '').replace(/\s+/g,' ').trim(); }
  function nativeUser(doc) {
    if (!doc.querySelector('a[href*="SignOut=1"],a[href*="signout=1"]')) return '';
    var values=Array.from(doc.querySelectorAll('.formPageHeader')).map(function (node) {
      return text(node.textContent).match(/^Change (?:details|password) for user\s+['"]([^'"]+)['"]$/i)?.[1]?.toLowerCase();
    }).filter(Boolean);
    return values.length && new Set(values).size===1 ? values[0] : '';
  }
  function gestureAxis(dx,dy) {
    if (Math.max(Math.abs(dx),Math.abs(dy))<10) return '';
    return Math.abs(dx)>Math.abs(dy)*1.25 ? 'x' : 'y';
  }
  function swipeOffset(start,dx) { return Math.min(0,Math.max(-REVEAL,start+dx)); }
  function revealAfterDrag(offset) { return offset<=-58; }
  async function delegateAction(row,selector,verify,blocked) {
    var control=row?.querySelector(selector);
    if (!row?.isConnected || !control || control.disabled || control.getAttribute('aria-disabled')==='true' || blocked()) return false;
    if (!await verify()) return false;
    if (!row.isConnected || row.querySelector(selector)!==control || control.disabled || control.getAttribute('aria-disabled')==='true' || blocked()) return false;
    control.click(); return true;
  }
  async function boot(win) {
    if (!win || win.top!==win || win.location.origin!==ORIGIN || !/^\/ShoppingCart\.aspx$/i.test(win.location.pathname) || win.WLCartStudio) return;
    var doc=win.document;
    if (doc.readyState==='loading') await new Promise(function (resolve) { doc.addEventListener('DOMContentLoaded',resolve,{once:true}); });
    if (!doc.querySelector('a[href*="SignOut=1"],a[href*="signout=1"]') || !naturalCart()) return;
    async function verify() {
      var controller=new win.AbortController(),timer=win.setTimeout(function () { controller.abort(); },10000);
      try {
        var response=await win.fetch('/AccountSettings.aspx',{credentials:'same-origin',cache:'no-store',signal:controller.signal});
        if (!response.ok || new URL(response.url || '/AccountSettings.aspx',ORIGIN).origin!==ORIGIN) return false;
        return nativeUser(new win.DOMParser().parseFromString(await response.text(),'text/html'))==='ckunkel2';
      } finally { win.clearTimeout(timer); }
    }
    if (!await verify()) return;
    function naturalCart() {
      if (doc.querySelector('#ctl00_PageBody_CompleteCheckoutButton,#ctl00_PageBody_SuccessfulPaymentResults_MerchantDetailsPanel,#btnPickup')) return false;
      return !!doc.getElementById('ctl00_PageBody_ShoppingCartDetailPanel') || /your cart is currently empty/i.test(doc.querySelector('.mainContents')?.textContent || '');
    }
    var shell=doc.querySelector('.mainContents');
    if (!shell || !await loadStyles()) return;
    var theme='canvas';
    try { var saved=win.localStorage.getItem(PREFERENCE); if (THEMES.includes(saved)) theme=saved; } catch (_) {}
    var rows=new Map(),openRow=null,scheduled=false,pending=false,lastCheck=Date.now(),revoked=false;
    var toolbar=doc.createElement('div'); toolbar.className='cs-design-bar'; toolbar.setAttribute('aria-label','Private cart design preview');
    var label=doc.createElement('span'); label.className='cs-design-label'; label.textContent='Cart studio';
    var privateLabel=doc.createElement('small'); privateLabel.textContent='ckunkel2 preview'; label.appendChild(privateLabel); toolbar.appendChild(label);
    var options=doc.createElement('div'); options.className='cs-design-choices'; options.setAttribute('role','group'); options.setAttribute('aria-label','Cart design'); toolbar.appendChild(options);
    THEMES.forEach(function (value) {
      var button=makeButton(value.charAt(0).toUpperCase()+value.slice(1),function () { selectTheme(value); });
      button.dataset.csTheme=value; options.appendChild(button);
    });
    shell.prepend(toolbar);
    var live=doc.createElement('div'); live.className='cs-announcement'; live.setAttribute('role','status'); live.setAttribute('aria-live','polite'); toolbar.appendChild(live);
    var dock=doc.createElement('div'); dock.className='cs-mobile-dock cs-only'; dock.setAttribute('aria-label','Cart checkout');
    dock.innerHTML='<div><span>Subtotal</span><strong data-cs-dock-total></strong></div>';
    var dockButton=makeButton('Checkout',function () {
      var control=doc.getElementById('ctl00_PageBody_PlaceOrderButton');
      if (!control || control.disabled || control.getAttribute('aria-disabled')==='true' || blocked()) return;
      control.click();
    });
    dockButton.className='cs-checkout'; dockButton.setAttribute('aria-label','Proceed to checkout'); dock.appendChild(dockButton); doc.body.appendChild(dock);
    var intersection=null,observedCheckout=null;
    if (win.IntersectionObserver) intersection=new win.IntersectionObserver(function (entries) {
      dock.dataset.mainVisible=entries[0]?.isIntersecting ? 'true' : 'false';
    },{threshold:0.25});
    function blocked() { return revoked || theme==='original' || pending || !!doc.getElementById('wl-buy-now'); }
    function makeButton(copy,handler) {
      var button=doc.createElement('button'); button.type='button'; button.textContent=copy; button.addEventListener('click',handler); return button;
    }
    function selectTheme(value) {
      if (revoked || !THEMES.includes(value)) return;
      closeRow(); theme=value;
      try { win.localStorage.setItem(PREFERENCE,value); } catch (_) {}
      doc.documentElement.classList.toggle('wl-cart-studio',theme!=='original');
      doc.documentElement.dataset.wlCartStudioTheme=theme;
      options.querySelectorAll('button').forEach(function (button) { button.setAttribute('aria-pressed',String(button.dataset.csTheme===theme)); });
      decorate();
    }
    function announce(copy) { live.textContent=copy; }
    function closeRow() { if (openRow) setOpen(openRow,false); }
    function setOpen(record,value) {
      if (value && openRow && openRow!==record) setOpen(openRow,false);
      record.open=value; record.row.classList.toggle('cs-swipe-open',value); record.card.style.setProperty('--cs-swipe-x',value ? '-'+REVEAL+'px' : '0px');
      record.actions.setAttribute('aria-hidden',String(!value)); record.menu.setAttribute('aria-expanded',String(value));
      record.actions.querySelectorAll('button').forEach(function (button) { button.tabIndex=value ? 0 : -1; });
      openRow=value ? record : null;
    }
    async function act(record,selector,label) {
      if (blocked()) return;
      var control=record.row.querySelector(selector);
      if (!control || control.disabled) { announce('This action is not available yet.'); return; }
      pending=true; record.actions.setAttribute('aria-busy','true');
      try {
        var done=await delegateAction(record.row,selector,async function () {
          var allowed=await verify(); if (!allowed) revoke(); return allowed;
        },function () { return revoked || !!doc.getElementById('wl-buy-now'); });
        if (done) { announce(label); closeRow(); }
      } catch (_) { announce('WebTrack could not confirm your session. Please refresh before changing the cart.'); }
      finally { pending=false; record.actions.removeAttribute('aria-busy'); }
    }
    function decorateRow(row,card) {
      var existing=rows.get(row); if (existing?.card===card) return;
      if (existing) cleanupRow(existing);
      var record={row:row,card:card,open:false,gesture:null}; rows.set(row,record);
      row.classList.add('cs-cart-line');
      var actions=doc.createElement('div'); actions.className='cs-swipe-actions cs-only'; actions.setAttribute('aria-label','Item actions'); record.actions=actions;
      var save=makeButton('Save',function () { act(record,'.sfl-button','Moving item to Saved for Later…'); }); save.className='cs-swipe-save';
      var remove=makeButton('Remove',function () { act(record,'.delete-link','Removing item…'); }); remove.className='cs-swipe-remove';
      actions.append(save,remove); row.insertBefore(actions,card);
      var menu=makeButton('•••',function () { if (!blocked()) setOpen(record,!record.open); });
      menu.className='cs-item-more cs-only'; menu.setAttribute('aria-label','Item actions for '+text(card.querySelector('p')?.textContent || card.querySelector('h6')?.textContent)); card.appendChild(menu); record.menu=menu;
      record.down=function (event) {
        if (blocked() || !win.matchMedia('(max-width: 740px)').matches || event.isPrimary===false || (event.button!==undefined && event.button!==0) || event.target.closest('a,button,input,select,textarea,label')) return;
        record.gesture={id:event.pointerId,x:event.clientX,y:event.clientY,start:record.open ? -REVEAL : 0,axis:'',offset:record.open ? -REVEAL : 0};
      };
      record.move=function (event) {
        var gesture=record.gesture; if (!gesture || gesture.id!==event.pointerId) return;
        var dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
        gesture.axis=gesture.axis || gestureAxis(dx,dy); if (gesture.axis!=='x') return;
        if (event.cancelable) event.preventDefault();
        try { row.setPointerCapture(event.pointerId); } catch (_) {}
        gesture.offset=swipeOffset(gesture.start,dx); card.style.setProperty('--cs-swipe-x',gesture.offset+'px'); row.classList.add('cs-swiping');
      };
      record.up=function (event) {
        var gesture=record.gesture; if (!gesture || gesture.id!==event.pointerId) return;
        record.gesture=null; row.classList.remove('cs-swiping');
        setOpen(record,event.type==='pointercancel' ? record.open : gesture.axis==='x' ? revealAfterDrag(gesture.offset) : record.open);
        try { row.releasePointerCapture(event.pointerId); } catch (_) {}
      };
      row.addEventListener('pointerdown',record.down); row.addEventListener('pointermove',record.move,{passive:false}); row.addEventListener('pointerup',record.up); row.addEventListener('pointercancel',record.up);
      setOpen(record,false);
    }
    function cleanupRow(record) {
      record.actions.remove(); record.menu.remove(); record.card.style.removeProperty('--cs-swipe-x'); record.row.classList.remove('cs-cart-line','cs-swipe-open','cs-swiping');
      record.row.removeEventListener('pointerdown',record.down); record.row.removeEventListener('pointermove',record.move); record.row.removeEventListener('pointerup',record.up); record.row.removeEventListener('pointercancel',record.up);
      if (openRow===record) openRow=null; rows.delete(record.row);
    }
    function decorate() {
      if (revoked) return;
      var panel=doc.getElementById('ctl00_PageBody_ShoppingCartDetailPanel');
      shell.classList.add('cs-shell'); panel?.classList.add('cs-cart-panel');
      var header=panel?.querySelector('.cart-header'),lines=panel?.querySelector('.shopping-cart-details'),summary=panel?.querySelector('.custom-subtotal-wrapper');
      header?.classList.add('cs-cart-header'); lines?.classList.add('cs-cart-lines'); summary?.classList.add('cs-summary');
      if (summary && !summary.querySelector('.cs-summary-title')) {
        var title=doc.createElement('h2'); title.className='cs-summary-title cs-only'; title.textContent='Order summary'; summary.prepend(title);
        var total=doc.createElement('div'); total.className='cs-subtotal cs-only'; total.setAttribute('aria-hidden','true'); total.innerHTML='<span>Subtotal</span><strong data-cs-summary-total></strong>'; title.after(total);
        var note=doc.createElement('p'); note.className='cs-summary-note cs-only'; note.textContent='Delivery and tax confirmed at checkout.'; summary.appendChild(note);
      }
      if (header && !header.querySelector('.cs-swipe-hint')) {
        var hint=doc.createElement('span'); hint.className='cs-swipe-hint cs-only'; hint.textContent='Swipe left for item actions'; header.appendChild(hint);
      }
      panel?.querySelectorAll(':scope > div').forEach(function (node) {
        if (node.querySelector('#ctl00_PageBody_PlaceOrderButtonTop,#ctl00_PageBody_ShopForMoreButton')) node.classList.add('cs-native-chrome');
      });
      doc.getElementById('savedForLater')?.classList.add('cs-saved');
      var emptyTarget=lines || (!panel ? shell : null);
      if (emptyTarget && !emptyTarget.querySelector('.shopping-cart-item') && /your cart is currently empty/i.test(emptyTarget.textContent) && !emptyTarget.querySelector('.cs-empty')) {
        Array.from(emptyTarget.childNodes).forEach(function (node) {
          if (node.nodeType===1 && node!==toolbar && node.id!=='savedForLater') node.classList.add('cs-native-empty');
          else if (node.nodeType===3 && /your cart is currently empty/i.test(node.textContent)) { var nativeText=doc.createElement('span'); nativeText.className='cs-native-empty'; node.before(nativeText); nativeText.appendChild(node); }
        });
        var empty=doc.createElement('div'); empty.className='cs-empty cs-only'; empty.innerHTML='<span aria-hidden="true">＋</span><h2>Your cart is empty</h2><p>Find what you need for your next project.</p><a href="/Products.aspx">Explore products <span aria-hidden="true">→</span></a>'; emptyTarget.appendChild(empty);
      }
      rows.forEach(function (record) { if (!record.row.isConnected || !record.card.isConnected || theme==='original') cleanupRow(record); });
      if (theme!=='original') panel?.querySelectorAll('.shopping-cart-item').forEach(function (row) { var card=row.querySelector('.cart-item-card'); if (card && row.querySelector('.delete-link')) decorateRow(row,card); });
      rows.forEach(function (record) {
        record.actions.querySelector('.cs-swipe-save').disabled=!record.row.querySelector('.sfl-button') || !!record.row.querySelector('.sfl-button')?.disabled;
      });
      var checkout=doc.getElementById('ctl00_PageBody_PlaceOrderButton');
      if (checkout!==observedCheckout) { intersection?.disconnect(); observedCheckout=checkout; if (checkout) intersection?.observe(checkout); }
      dock.hidden=theme==='original' || !checkout;
      dockButton.disabled=!checkout || checkout.disabled || checkout.getAttribute('aria-disabled')==='true';
      var subtotal=text(summary?.querySelector('.SubtotalWrapper')?.textContent).match(/\$\s*[\d,]+\.\d{2}/)?.[0] || '';
      var amount=dock.querySelector('[data-cs-dock-total]'); if (amount.textContent!==subtotal) amount.textContent=subtotal;
      var summaryAmount=summary?.querySelector('[data-cs-summary-total]'); if (summaryAmount && summaryAmount.textContent!==subtotal) summaryAmount.textContent=subtotal;
    }
    function schedule() { if (scheduled || revoked) return; scheduled=true; win.setTimeout(function () { scheduled=false; decorate(); },90); }
    function revoke() {
      if (revoked) return; revoked=true; closeRow(); observer.disconnect(); intersection?.disconnect(); rows.forEach(cleanupRow);
      doc.documentElement.classList.remove('wl-cart-studio'); delete doc.documentElement.dataset.wlCartStudioTheme; delete doc.documentElement.dataset.wlCartStudioBuild;
      shell.querySelectorAll('.cs-only').forEach(function (node) { node.remove(); }); toolbar.remove(); dock.remove();
    }
    var observer=new win.MutationObserver(schedule); observer.observe(doc.body,{childList:true,subtree:true,characterData:true});
    doc.addEventListener('pointerdown',function (event) { if (openRow && !openRow.row.contains(event.target)) closeRow(); },true);
    doc.addEventListener('keydown',function (event) { if (event.key==='Escape') closeRow(); });
    win.addEventListener('focus',async function () {
      if (revoked || Date.now()-lastCheck<15000) return; lastCheck=Date.now();
      try { if (!await verify()) revoke(); } catch (_) { revoke(); }
    });
    doc.documentElement.dataset.wlCartStudioBuild=BUILD; win.WLCartStudio={build:BUILD}; selectTheme(theme);
    async function loadStyles() {
      return new Promise(function (resolve) {
        var link=doc.createElement('link'),settled=false,timer=win.setTimeout(function () { finish(false); },10000);
        function finish(ok) { if (settled) return; settled=true; win.clearTimeout(timer); if (!ok) link.remove(); resolve(ok); }
        link.rel='stylesheet'; link.href=ASSETS+'CartDesignPilot.css?v='+BUILD; link.onload=function () { finish(true); }; link.onerror=function () { finish(false); }; doc.head.appendChild(link);
      });
    }
  }
  return {boot:boot,build:BUILD,nativeUser:nativeUser,gestureAxis:gestureAxis,swipeOffset:swipeOffset,revealAfterDrag:revealAfterDrag,delegateAction:delegateAction};
});
