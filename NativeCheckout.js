/* Guidance for the top-level native WebTrack checkout. No order submission. */
(function (root, factory) {
  'use strict';
  var core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else core.boot(root);
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  var BUILD = '20261109-billing-feedback-2';
  var TITLES = {1:'How to receive your order',2:'Pickup store',3:'Delivery address',4:'Billing address',5:'Timing & instructions'};

  function sectionPlan(rows, editing) {
    var available = rows.filter(function (row) { return !row.unavailable; });
    return {
      next: (available.find(function (row) { return !row.valid; }) || {}).step || null,
      ready: available.filter(function (row) { return row.valid; }).length,
      total: available.length,
      rows: rows.map(function (row) {
        return Object.assign({},row,{collapsed:!row.unavailable && row.valid && row.step!==1 && row.step!==5 && row.step!==editing});
      })
    };
  }

  function nativeStage(doc) {
    if (doc.getElementById('ctl00_PageBody_CompleteCheckoutButton')) return 'review';
    if (doc.getElementById('ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView')) return 'shipping';
    if (doc.getElementById('ctl00_PageBody_btnContinue_CardOnFileView') || doc.getElementById('ctl00_PageBody_ddlCardsOnFile')) return 'payment';
    if (doc.getElementById('ctl00_PageBody_SaleTypeSelector_rbCollectLater') || doc.getElementById('ctl00_PageBody_DeliveryAddress_Postcode')) return 'details';
    return null;
  }

  function pickupContactName(doc) {
    // WebTrack often puts the contact on DeliveryAddress even for pickup;
    // InvoiceAddress can contain only the billing street and email controls.
    for (var prefix of ['InvoiceAddress','DeliveryAddress']) {
      var parts=['ContactFirstNameTextBox','ContactLastNameTextBox'].map(function (field) {
        return String(doc.getElementById('ctl00_PageBody_'+prefix+'_'+field)?.value || '').trim();
      });
      if (parts.some(Boolean)) return parts.filter(Boolean).join(' ');
    }
    return '';
  }

  function hasNativeError(win,pane) {
    return Array.from(pane.querySelectorAll('.input-validation-error,.is-invalid,[aria-invalid="true"],.field-validation-error,span[id*="Validator"],span[controltovalidate]')).some(function (field) {
      if (field.matches('.input-validation-error,.is-invalid,[aria-invalid="true"]')) return true;
      var style=win.getComputedStyle(field);
      // Inspect the validator itself, including inside a collapsed summary.
      return !!field.textContent.trim() && style.display!=='none' && style.visibility!=='hidden';
    });
  }

  function paymentFeedback(message) {
    var text=String(message || '').replace(/\s+/g,' ').trim();
    // An AVS warning can accompany an approval. Never turn an approval or an
    // order confirmation into a decline, and never infer AVS from account data.
    var confirmedOrder=/\border\b.{0,80}\b(?:confirmed|submitted|placed)\b/i.test(text) && !/\b(?:no|not|never)\b.{0,40}\b(?:order|confirmed|submitted|placed)\b/i.test(text);
    if (confirmedOrder || /\b(?:payment|transaction)\s+(?:was\s+)?approved\b/i.test(text)) return null;
    if (/\b(?:payment|transaction|gateway|processor)\b.{0,70}\b(?:timed? out|timeout|unavailable|unknown|could not be confirmed)\b|\bunable to (?:confirm|determine)\b.{0,40}\b(?:payment|transaction)\b|\b(?:AVS|address verification)\b.{0,60}\b(?:unavailable|timeout|not supported)\b/i.test(text)) {
      return {kind:'unconfirmed',title:'Payment status needs confirmation',detail:'Check your order history or contact the store before trying another payment. This screen cannot confirm whether the payment went through.'};
    }
    if (/\bAVS\s*(?:(?:result|response|code)\s*)?[:=]\s*N\b|\b(?:AVS|address verification)\b.{0,70}\b(?:fail\w*|mismatch|no match|declin\w*|reject\w*)\b|\bbilling (?:street|address|zip|postal code)\b.{0,60}\b(?:mismatch|does not match|did not match|not matching)\b/i.test(text)) {
      return {kind:'billing',title:'Check your billing address',detail:'Use the billing street address and ZIP code shown on your card statement. Your delivery address can be different. Review the details before trying again.'};
    }
    if (/\b(?:CVV|CVC|security code|card verification)\b.{0,60}\b(?:mismatch|no match|incorrect|invalid|fail\w*|does not match|did not match)\b/i.test(text)) {
      return {kind:'security-code',title:'Check your card security code',detail:'Review the security code and expiration date on your card, or choose another payment method. Enter payment details only in the secure payment form.'};
    }
    if (/\binsufficient funds\b/i.test(text)) return {kind:'funds',title:'Your payment was not approved',detail:'Your card issuer reported insufficient funds. Choose another payment method or contact your card issuer.'};
    if (/\b(?:payment|transaction|card)\b.{0,60}\b(?:declin\w*|reject\w*|not approved)\b|\bdeclin\w*\b.{0,40}\b(?:payment|transaction|card)\b/i.test(text)) {
      return {kind:'declined',title:'Your payment was not approved',detail:'Review your card details and billing address, choose another payment method, or contact your card issuer.'};
    }
    return null;
  }

  function renderPaymentFeedback(win) {
    var doc=win.document,existing=doc.getElementById('wl-native-payment-feedback');
    var selectors='#CartResponseMessage,.validation-summary-errors,[id^="ctl00_PageBody_"][id$="ErrorLabel"],[id^="ctl00_PageBody_"][id$="ErrorMessage"],[id^="ctl00_PageBody_"][id$="ErrorMessageLabel"]';
    var messages=Array.from(doc.querySelectorAll(selectors)).filter(function (node) {
      if (node.closest('#wl-native-payment-feedback,#wl-native-guide')) return false;
      var style=win.getComputedStyle(node);
      return style.display!=='none' && style.visibility!=='hidden';
    }).map(function (node) { return node.textContent; });
    var feedback=paymentFeedback(messages.join(' ').slice(0,4000));
    if (!feedback) { if(existing)existing.remove(); return; }
    if (existing?.dataset.kind===feedback.kind) return;
    var host=doc.querySelector('.mainContents') || doc.querySelector('.container');
    if (!host) return;
    var box=existing || doc.createElement('section');
    box.id='wl-native-payment-feedback';box.className='wl-native-payment-feedback';box.dataset.kind=feedback.kind;
    box.setAttribute('role','alert');box.setAttribute('aria-atomic','true');
    box.replaceChildren();
    var title=doc.createElement('h2'),detail=doc.createElement('p');
    title.textContent=feedback.title;detail.textContent=feedback.detail;box.append(title,detail);
    if (!existing)host.insertBefore(box,host.firstChild);
    // The native message and controls stay in place. No automatic retry,
    // payment submission, card access, logging or address comparison occurs.
    styles(doc);
  }

  function styles(doc) {
    if (doc.getElementById('wl-native-guide-css')) return;
    var style=doc.createElement('style'); style.id='wl-native-guide-css';
    style.textContent=`
      .wl-native-guide{box-sizing:border-box;width:min(100%,960px);margin:24px auto 12px;padding:0 20px;color:#24272b;font-family:Arial,sans-serif;clear:both}
      .wl-native-progress{display:flex;gap:12px;list-style:none!important;padding:0!important;margin:0 0 22px!important;font-size:13px}
      .wl-native-progress li{flex:1;min-width:0;border-top:3px solid #dedbdd;padding-top:9px;color:#65626a;line-height:1.4}
      .wl-native-progress li[aria-current=step]{border-color:#6b0016;color:#6b0016;font-weight:700}
      .wl-native-guide h1{font-size:28px;font-weight:700;letter-spacing:0;line-height:1.2;margin:0 0 8px;color:#24272b}
      .wl-native-return{display:inline-flex;align-items:center;min-height:44px;margin-bottom:8px;color:#6b0016;text-decoration:underline;font-size:14px}
      .wl-native-guide p{font-size:15px;line-height:1.5;margin:0 0 12px;color:#57535b}
      .wl-native-billing-hint{font-size:14px;line-height:1.5;color:#57535b;margin:0 0 16px}
      .wl-native-payment-feedback{box-sizing:border-box;width:min(100% - 32px,920px);margin:20px auto;padding:18px;border:1px solid #c89195;border-left:4px solid #8b1425;border-radius:6px;background:#fff7f7;color:#39292c;font:16px/1.5 Arial,sans-serif;overflow-wrap:anywhere}
      .wl-native-payment-feedback h2{margin:0 0 8px;font-size:20px;color:#6b0016;letter-spacing:0}
      .wl-native-payment-feedback p{margin:0}
      .wl-native-section-status{display:block;font-size:12px;font-weight:600;color:#65626a;margin-top:5px}
      .wl-native-details .wl-section-title{font-size:19px!important}
      .wl-native-details .checkout-step{scroll-margin-top:24px}
      .wl-native-details .wl-section-heading{align-items:flex-start!important}
      .wl-native-details .wl-section-summary{overflow-wrap:anywhere}
      .wl-native-details .wl-section-edit{display:block!important;min-height:44px!important;white-space:normal}
      .wl-native-details .checkout-step:not(.wl-section-collapsed) .wl-section-edit{display:none!important}
      .wl-native-details .wl-native-done{display:block;min-height:44px;padding:10px 18px;margin:16px 0 0 auto;border:1px solid #6b0016;border-radius:6px;background:#fff;color:#6b0016;font-weight:700;font-size:15px}
      .wl-native-details .wl-section-collapsed .wl-native-done{display:none}
      .wl-native-details .wl-proxy-continue{white-space:normal;line-height:1.4}
      .wl-native-details input:not([type=radio]):not([type=checkbox]),.wl-native-details select,.wl-native-details textarea{font-size:16px!important;width:100%;max-width:100%;min-width:0}
      .wl-native-details .wl-field-invalid{scroll-margin-top:70px}
      .wl-native-details .wl-native-ready{color:#246b35}
      @media(max-width:600px){
        .wl-native-guide{padding:0 16px;margin-top:18px}.wl-native-guide h1{font-size:24px}
        .wl-native-progress{gap:8px;font-size:12px}
        .checkout-wizard.wl-single-page.wl-native-details{padding:0 16px;margin-top:18px}
        .wl-native-details .wl-section-heading{gap:10px!important}
        .wl-native-details .wl-section-summary{flex-basis:calc(100% - 50px)!important;margin-left:48px!important;order:4}
        .wl-native-details .wl-section-edit{margin-left:auto;max-width:110px}
        .wl-native-details .wl-section-title{max-width:calc(100% - 50px);font-size:18px!important}
        .wl-native-details .modern-shipping-selector{grid-template-columns:1fr!important}
        .wl-native-details .modern-shipping-selector button{min-height:56px!important;text-align:left}
        .wl-native-details .wl-native-done{width:100%}
      }
      @media(prefers-reduced-motion:reduce){.wl-native-details *{scroll-behavior:auto!important}}
    `;
    doc.head.appendChild(style);
  }

  function mountGuide(win) {
    var doc=win.document,stage=nativeStage(doc),existing=doc.getElementById('wl-native-guide');
    if (!stage) { if (existing) existing.remove(); return; }
    var host=doc.querySelector('.checkout-wizard') || doc.querySelector('.mainContents') || doc.querySelector('.container');
    if (!host) return;
    var guide=existing || doc.createElement('section');
    if (guide.dataset.stage===stage) return;
    guide.id='wl-native-guide'; guide.className='wl-native-guide'; guide.dataset.stage=stage;
    guide.setAttribute('aria-label','Checkout progress');
    guide.innerHTML='<a class="wl-native-return" href="/ShoppingCart.aspx">Back to cart</a><ol class="wl-native-progress"><li>1. Order details</li><li>2. Shipping & payment</li><li>3. Review & place order</li></ol><h1></h1><p></p><p id="wl-native-next" role="status" aria-live="polite" aria-atomic="true"></p>';
    var phase=stage==='details'?0:stage==='review'?2:1;
    guide.querySelectorAll('li')[phase].setAttribute('aria-current','step');
    var copy={
      details:['Let’s get your order ready','Use your saved details or edit below. Complete the required fields, then continue to shipping and payment.'],
      shipping:['Confirm shipping & total','Check the available delivery service and updated total. Choose a different service here if needed.'],
      payment:['Choose your payment method','Select the payment method you want to use. You’ll review the final order before placing it.'],
      review:['Review your order','Check your items, delivery details, payment and final total. Place your order when everything is correct.']
    }[stage];
    guide.querySelector('h1').textContent=copy[0]; guide.querySelector('p').textContent=copy[1];
    if (!existing) host.parentNode.insertBefore(guide,host);
    doc.documentElement.dataset.wlNativeCheckoutStage=stage;
    styles(doc);
  }

  function enhanceSections(win,wizard,adapter) {
    if (win.top!==win || wizard.dataset.wlNativeSections) return false;
    wizard.dataset.wlNativeSections=BUILD; wizard.classList.add('wl-native-details');
    var doc=win.document,editing=null,timer=null,commitTimer=null,abandoned=false,refreshing=false,pickupPersonEdited=false;
    var panes=Array.from(wizard.querySelectorAll('.checkout-step[data-step]'));
    function paneFor(node) { return node && node.closest ? node.closest('.checkout-step[data-step]') : null; }
    function stepFor(node) { return Number(paneFor(node)?.dataset.step || 0); }
    function asyncBusy() {
      try { return !!win.Sys?.WebForms?.PageRequestManager?.getInstance()?.get_isInAsyncPostBack(); } catch (_) { return false; }
    }
    function refresh() {
      if (abandoned || refreshing || !wizard.isConnected) return;
      refreshing=true;
      try {
        var pickupPerson=doc.getElementById('pickupPerson');
        if (pickupPerson && !pickupPerson.value && !pickupPersonEdited) {
          var name=pickupContactName(doc);
          if (name) {
            pickupPerson.value=name;
            pickupPerson.dispatchEvent(new win.Event('input',{bubbles:true}));
          }
        }
        var rows=panes.map(function (pane) {
          var step=Number(pane.dataset.step);
          return {step:step,unavailable:pane.classList.contains('wl-step-unavailable'),valid:adapter.valid(step) && !hasNativeError(win,pane)};
        });
        var plan=sectionPlan(rows,editing);
        plan.rows.forEach(function (row,index) {
          var pane=panes[index],summary=pane.querySelector('.wl-section-summary'),status=pane.querySelector('.wl-native-section-status'),edit=pane.querySelector('[data-wl-edit-step]');
          pane.classList.toggle('wl-section-collapsed',row.collapsed); pane.classList.remove('wl-section-deferred');
          pane.dataset.wlEditing=editing===row.step?'1':'0';
          if (summary) { var text=row.unavailable?'Not needed for this order':adapter.summary(row.step); if(summary.textContent!==text)summary.textContent=text; }
          if (status) { var state=row.valid?'Ready':editing===row.step?'Editing':'Needs details'; if(status.textContent!==state)status.textContent=state; status.classList.toggle('wl-native-ready',row.valid); }
          if (edit) { edit.setAttribute('aria-label','Edit '+TITLES[row.step]); edit.setAttribute('aria-expanded',String(!row.collapsed)); }
        });
        var next=doc.getElementById('wl-native-next');
        if (next) {
          var message=plan.next?'Next: '+TITLES[plan.next]+'. '+plan.ready+' of '+plan.total+' sections ready.':'Your details are ready. Add any optional instructions, then continue to shipping & payment.';
          if (next.textContent!==message) next.textContent=message;
        }
        return plan;
      } finally { refreshing=false; }
    }
    function schedule() { win.clearTimeout(timer); timer=win.setTimeout(refresh,100); }
    function open(step,options) {
      var pane=panes.find(function (item) { return Number(item.dataset.step)===step; });
      if (!pane || pane.classList.contains('wl-step-unavailable')) return;
      editing=step;
      if (step===3) adapter.deliveryEditor();
      if (step===4) adapter.invoiceEditor();
      refresh();
      if (options?.scroll!==false) pane.scrollIntoView({behavior:'smooth',block:'start'});
    }
    function finish(step,explicit) {
      if (abandoned || asyncBusy()) return;
      if (!adapter.valid(step)) {
        if (explicit) { adapter.validate(step); open(step); }
        else refresh();
        return;
      }
      // A valid edit still needs native validation to clear the old error box
      // and record the explicit billing confirmation before leaving the pane.
      if (!adapter.validate(step)) { if(explicit)open(step);else refresh();return; }
      editing=null;
      var plan=refresh();
      // Follow only a deliberate Done action. Blur never steals focus from a
      // different field, optional note, payment control or another open editor.
      if (explicit && plan?.next) open(plan.next);
    }
    panes.forEach(function (pane) {
      var step=Number(pane.dataset.step),title=pane.querySelector('.wl-section-title'),heading=pane.querySelector('.wl-section-heading');
      if (title) title.textContent=TITLES[step];
      if (heading) { var status=doc.createElement('span'); status.className='wl-native-section-status'; title?.appendChild(status); }
      if (step===4 && heading) {
        var hint=doc.createElement('p');hint.className='wl-native-billing-hint';
        hint.textContent='For card payments, use the billing street address and ZIP code on your card statement. Your delivery address can be different.';
        heading.insertAdjacentElement('afterend',hint);
      }
      if (step>1 && step<5) {
        var done=doc.createElement('button'); done.type='button'; done.className='wl-native-done'; done.dataset.wlNativeDone=String(step); done.textContent='Use these details'; pane.appendChild(done);
      }
    });
    wizard.addEventListener('focusin',function (event) {
      var step=stepFor(event.target);
      if (step && !event.target.closest('[data-wl-edit-step]')) { editing=step; schedule(); }
    });
    wizard.addEventListener('input',function (event) { if(event.target.id==='pickupPerson')pickupPersonEdited=true; schedule(); },true);
    wizard.addEventListener('change',schedule,true);
    wizard.addEventListener('focusout',function (event) {
      // Opening an editor hides its Edit button, which blurs that button.
      // Only leaving a data-entry field can commit a section automatically.
      if (!/^(INPUT|SELECT|TEXTAREA)$/.test(event.target?.tagName || '')) return;
      var pane=paneFor(event.target),step=stepFor(event.target);
      if (!pane || !step || pane.contains(event.relatedTarget)) return;
      win.clearTimeout(commitTimer);
      commitTimer=win.setTimeout(function () {
        if (pane.contains(doc.activeElement) || stepFor(doc.activeElement)) return;
        finish(step,false);
      },160);
    });
    wizard.addEventListener('click',function (event) {
      var done=event.target.closest('[data-wl-native-done]'),edit=event.target.closest('[data-wl-edit-step]'),back=event.target.closest('[data-wl-back]');
      if (done) { event.preventDefault(); finish(Number(done.dataset.wlNativeDone),true); }
      else if (edit) { event.preventDefault(); open(Number(edit.dataset.wlEditStep)); }
      else if (back) {
        event.preventDefault();
        var previous=panes.filter(function (pane) { return Number(pane.dataset.step)<=Number(back.dataset.wlBack) && !pane.classList.contains('wl-step-unavailable'); }).pop();
        if (previous) open(Number(previous.dataset.step));
      }
    });
    doc.addEventListener('wl:fulfillment-change',schedule);
    doc.addEventListener('wl:checkout-address-updated',schedule);
    win.addEventListener('pagehide',function () { abandoned=true; win.clearTimeout(timer); win.clearTimeout(commitTimer); },{once:true});
    win.WLCheckout=win.WLCheckout || {};
    win.WLCheckout.refreshSectionSummaries=refresh;
    win.WLCheckout.openCheckoutSection=open;
    win.WLCheckout.openFirstIncompleteSection=function () { var plan=refresh(); if(plan?.next)open(plan.next); return plan?.next; };
    // Native values remain authoritative. Supply browser autofill hints without
    // replacing an address/contact that the customer or WebTrack already chose.
    ['DeliveryAddress','InvoiceAddress'].forEach(function (prefix) {
      var fields={ContactFirstNameTextBox:'given-name',ContactLastNameTextBox:'family-name',ContactTelephoneTextBox:'tel',EmailAddressTextBox:'email',AddressLine1:'address-line1',AddressLine2:'address-line2',City:'address-level2',Postcode:'postal-code'};
      Object.keys(fields).forEach(function (name) {
        var input=doc.getElementById('ctl00_PageBody_'+prefix+'_'+name);
        if (!input) return;
        input.setAttribute('autocomplete','section-'+prefix+' '+(prefix==='DeliveryAddress'?'shipping':'billing')+' '+fields[name]);
        if (fields[name]==='tel') input.setAttribute('inputmode','tel');
        if (fields[name]==='email') input.setAttribute('inputmode','email');
      });
    });
    var observer=new win.MutationObserver(schedule);
    // Only native replacements, not our summary text/class changes.
    observer.observe(wizard,{childList:true,subtree:true});
    win.addEventListener('pagehide',function () { observer.disconnect(); },{once:true});
    refresh(); mountGuide(win);
    return true;
  }

  function boot(win) {
    if (!win || win.top!==win || win.location.origin!=='https://webtrack.woodsonlumber.com' || !/\/ShoppingCart\.aspx$/i.test(win.location.pathname) || win.WLNativeCheckout) return;
    win.WLNativeCheckout={build:BUILD,enhanceSections:enhanceSections};
    win.dispatchEvent(new win.Event('wl-native-checkout-ready'));
    var abandoned=false,feedbackTimer=null;
    function ready() { if(!abandoned) { mountGuide(win);renderPaymentFeedback(win); } }
    if (win.document.readyState==='loading') win.document.addEventListener('DOMContentLoaded',ready,{once:true}); else ready();
    try { win.Sys?.WebForms?.PageRequestManager?.getInstance()?.add_endRequest(ready); } catch (_) {}
    function watch() {
      var host=win.document.querySelector('.mainContents') || win.document.querySelector('.container');
      if (!host || !win.MutationObserver || abandoned) return;
      var observer=new win.MutationObserver(function (mutations) {
        if (abandoned || mutations.every(function (mutation) { return mutation.target.closest?.('#wl-native-payment-feedback'); })) return;
        win.clearTimeout(feedbackTimer);feedbackTimer=win.setTimeout(ready,100);
      });
      observer.observe(host,{childList:true,subtree:true});
      win.addEventListener('pagehide',function () { observer.disconnect(); },{once:true});
    }
    if (win.document.readyState==='loading') win.document.addEventListener('DOMContentLoaded',watch,{once:true});else watch();
    win.addEventListener('pagehide',function () { abandoned=true;win.clearTimeout(feedbackTimer); },{once:true});
  }
  return {build:BUILD,sectionPlan:sectionPlan,nativeStage:nativeStage,pickupContactName:pickupContactName,hasNativeError:hasNativeError,paymentFeedback:paymentFeedback,renderPaymentFeedback:renderPaymentFeedback,enhanceSections:enhanceSections,boot:boot};
});
