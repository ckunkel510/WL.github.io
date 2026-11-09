/* Guidance for the top-level native WebTrack checkout. No order submission. */
(function (root, factory) {
  'use strict';
  var core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else core.boot(root);
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  var BUILD = '20261109-native-polish-4';
  var TITLES = {1:'Delivery method',2:'Pickup store',3:'Delivery address',4:'Billing address',5:'Timing & notes'};
  var ETA_KEY='wl_native_ups_estimates_v1',ETA_MAX_AGE=15*60*1000;
  var UPS_SELECT='ctl00_PageBody_CartSummary2_UPSShippingCalculatorControl_ShippingSelection';
  var TX_ORIGINS=['77833','77803','77836','78947','75831','76667','76642'];

  function isoDay(value) {
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(String(value || ''))) return '';
    var date=new Date(value+'T12:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===value ? value : '';
  }
  function texasDay(now) {
    var parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));
    var part=function(type) { return parts.find(function(p) { return p.type===type; }).value; };
    return part('year')+'-'+part('month')+'-'+part('day');
  }
  function upsClosedDay(value,serviceCode) {
    var date=new Date(value+'T12:00:00Z'),day=date.getUTCDay(),month=date.getUTCMonth()+1,n=date.getUTCDate();
    // UPS US closed holidays. The carrier supplies the original date; this
    // calendar only prevents our extra business day landing on a closure.
    if (day===0 || day===6) return true;
    if ((month===1 && n===1) || (month===7 && n===4) || (month===12 && n===25)) return true;
    if (month===1 && day===1 && n>=15 && n<=21) return true;
    if (month===5 && day===1 && n>=25) return true;
    if (month===9 && day===1 && n<=7) return true;
    if (month===11 && day===4 && n>=22 && n<=28) return true;
    return value==='2026-12-31' && ['03','11'].includes(serviceCode);
  }
  function addUpsBusinessDays(value,count,serviceCode) {
    if (!isoDay(value) || !Number.isInteger(count) || count<0 || count>62) return '';
    var date=new Date(value+'T12:00:00Z');
    while(count>0) {
      date.setUTCDate(date.getUTCDate()+1);
      if (!upsClosedDay(date.toISOString().slice(0,10),serviceCode)) count--;
    }
    return date.toISOString().slice(0,10);
  }
  function serviceName(value) {
    return String(value || '').toLowerCase().replace(/\([^)]*\$[^)]*\)/g,'').replace(/\$[\d,.]+.*$/,'')
      .replace(/\bups\b/g,'').replace(/\b2nd\b/g,'second').replace(/\b3(?:rd)?\b/g,'three')
      .replace(/a\.?m\.?/g,'am').replace(/[^a-z0-9]/g,'').replace(/earlyam$/,'early');
  }
  function selectedUpsRate(rates,selected) {
    if (!selected) return null;
    rates=Array.isArray(rates) ? rates.filter(function(rate) { return rate && typeof rate==='object'; }) : [];
    if (selected.nativeUps) {
      var coded=(rates || []).filter(function(rate) { return String(rate.serviceCode)===String(selected.value).padStart(2,'0'); });
      return coded.length===1 ? coded[0] : null;
    }
    var label=serviceName(selected.label);
    // Match the complete service name, not a prefix (Air vs Air Saver/AM).
    var matches=(rates || []).filter(function(rate) { return label && serviceName(rate.serviceName)===label; });
    if (matches.length===1) return matches[0];
    if (!label || /^service\d+$/.test(label)) {
      matches=(rates || []).filter(function(rate) { return String(rate.serviceCode)===String(selected.value).padStart(2,'0'); });
      if(matches.length===1)return matches[0];
    }
    return null;
  }
  function upsQuoteSnapshot(offer,now) {
    var origin=offer?.carrierOrigin,age=now-Number(offer?.ts);
    if (!origin || origin.state!=='TX' || !TX_ORIGINS.includes(origin.postalCode) || !Number.isFinite(age) || age<0 || age>ETA_MAX_AGE || !offer.options?.ups?.available) return null;
    var offered=Array.isArray(offer.options.ups.rates) ? offer.options.ups.rates : [];
    var rates=offered.filter(function(rate) { return rate && /^\d{2}$/.test(String(rate.serviceCode)) && rate.transit && typeof rate.transit==='object'; }).map(function(rate) {
      var transit={},source=rate.transit;
      if (isoDay(source.pickupDate)) transit.pickupDate=source.pickupDate;
      if (isoDay(source.arrivalDate)) transit.arrivalDate=source.arrivalDate;
      if (Number.isInteger(source.businessDays) && source.businessDays>=0 && source.businessDays<=60) transit.businessDays=source.businessDays;
      return {serviceCode:String(rate.serviceCode),serviceName:String(rate.serviceName || '').slice(0,80),transit:transit};
    });
    // Only public carrier/service metadata crosses the native page transition.
    // No customer address, cart contents, account IDs, prices or signed claims.
    return rates.length ? {quotedAt:Number(offer.ts),capturedAt:now,originPostalCode:origin.postalCode,rates:rates} : null;
  }
  function upsArrival(snapshot,selected,now) {
    var unavailable={kind:'unavailable',headline:'Arrival estimate unavailable',detail:'Your UPS speed is selected above.',basis:'Arrival depends on dispatch and carrier availability.'};
    var age=now-Number(snapshot?.quotedAt),captureAge=now-Number(snapshot?.capturedAt);
    if (!snapshot || !TX_ORIGINS.includes(snapshot.originPostalCode) || !Number.isFinite(age) || age<0 || age>ETA_MAX_AGE || !Number.isFinite(captureAge) || captureAge<0 || captureAge>ETA_MAX_AGE) return unavailable;
    var rate=selectedUpsRate(snapshot.rates,selected),transit=rate?.transit,today=texasDay(now);
    if (!transit) return unavailable;
    var pickup=isoDay(transit.pickupDate),arrival=isoDay(transit.arrivalDate),days=transit.businessDays;
    var format=function(value) { return new Date(value+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC',...(value.slice(0,4)!==today.slice(0,4)?{year:'numeric'}:{})}); };
    if (pickup && pickup>=today && arrival && arrival>=pickup && arrival<=addUpsBusinessDays(pickup,62,rate.serviceCode)) {
      var padded=addUpsBusinessDays(arrival,1,rate.serviceCode);
      return {kind:'date',headline:format(padded),date:padded,detail:rate.serviceName+' · Includes 1 extra business day',basis:'If dispatched '+format(pickup)+' from Texas. Timing may vary.'};
    }
    if (Number.isInteger(days) && days>=0 && days<=60) return {kind:'transit',headline:'About '+(days+1)+' business days',detail:rate.serviceName+' · Includes 1 extra business day',basis:'After dispatch from Texas. A calendar date is not available yet.'};
    return unavailable;
  }
  function captureShippingEstimate(win) {
    var snapshot=null;
    try {
      if (win.sessionStorage.getItem('wl_fulfillment_method')==='ship' && win.document.getElementById('ctl00_PageBody_SaleTypeSelector_rbUPSDelivery')?.checked) snapshot=upsQuoteSnapshot(win.WLShippingOffer?.current?.(),Date.now());
      if (snapshot) win.sessionStorage.setItem(ETA_KEY,JSON.stringify(snapshot));
      else win.sessionStorage.removeItem(ETA_KEY);
    } catch (_) { try { win.sessionStorage.removeItem(ETA_KEY); } catch (_) {} }
    return !!snapshot;
  }
  function renderUpsArrival(win) {
    var doc=win.document,existing=doc.getElementById('wl-native-ups-arrival'),mode='';
    try { mode=win.sessionStorage.getItem('wl_fulfillment_method'); } catch (_) {}
    var select=doc.getElementById(UPS_SELECT) || doc.getElementById('ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_DeliveryOptionsDropDownList');
    if (nativeStage(doc)!=='shipping' || mode!=='ship' || !select) { if(existing)existing.remove();return; }
    select.classList.add('wl-native-ups-select');
    if(!select.getAttribute('aria-label'))select.setAttribute('aria-label','UPS shipping speed');
    var option=select.selectedOptions?.[0],snapshot=null;
    try { snapshot=JSON.parse(win.sessionStorage.getItem(ETA_KEY) || 'null'); } catch (_) {}
    var copy=upsArrival(snapshot,option?{value:option.value,label:option.textContent,nativeUps:select.id===UPS_SELECT}:null,Date.now());
    if (existing?.dataset.copy===JSON.stringify(copy)) return;
    var host=doc.getElementById('SummaryEntry2');
    if (!host) return;
    var box=existing || doc.createElement('section');box.id='wl-native-ups-arrival';box.className='wl-native-ups-arrival';box.dataset.copy=JSON.stringify(copy);box.dataset.kind=copy.kind;
    box.setAttribute('role','status');box.setAttribute('aria-live','polite');box.setAttribute('aria-atomic','true');box.replaceChildren();
    [['span','Estimated UPS arrival'],['h2',copy.headline],['p',copy.detail],['small',copy.basis]].forEach(function(part) { var node=doc.createElement(part[0]);node.textContent=part[1];box.appendChild(node); });
    if(!existing)host.insertAdjacentElement('beforebegin',box);
    styles(doc);
  }

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
      .wl-native-guide,.wl-native-details{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important}
      .wl-native-guide{margin-top:20px}.wl-native-guide h1{font-size:27px;letter-spacing:-.6px;font-weight:700}
      .wl-native-progress{gap:10px;margin-bottom:18px!important;font-size:12px}
      .wl-native-progress li{border-top-width:3px;border-radius:2px;padding-top:7px}
      .wl-native-return{min-height:36px;font-size:13px;color:#625c63}
      #wl-native-next:empty,.wl-native-guide p:empty{display:none}
      #wl-native-next{font-size:13px;margin-bottom:0;color:#6b0016}
      html[data-wl-native-checkout-stage="details"] #ctl00_PageBody_BackToCartButton2{display:none!important}
      .checkout-wizard.wl-single-page.wl-native-details{margin-top:18px}
      .checkout-wizard.wl-single-page.wl-native-details .checkout-step{padding:20px;margin:0 0 12px;border:1px solid #e2e4e9!important;border-radius:14px;background:#fff;box-shadow:0 2px 7px #1b243008}
      .checkout-wizard.wl-single-page.wl-native-details .checkout-step.wl-section-collapsed{padding:16px 20px}
      .wl-native-details .wl-section-heading{gap:10px!important;margin-bottom:16px!important}
      .wl-native-details .wl-section-collapsed .wl-section-heading{margin-bottom:0!important}
      .wl-native-details .wl-section-heading .wl-step-icon{width:32px!important;height:32px!important;flex-basis:32px!important;border:0!important;border-radius:10px!important}
      .wl-native-details .wl-section-heading .wl-step-icon svg{width:18px!important;height:18px!important}
      .wl-native-details .wl-section-title{font-size:17px!important;letter-spacing:-.2px}
      .wl-native-details .wl-native-section-status{display:inline-block;margin:0 0 0 8px;font-size:11px;font-weight:500}
      .wl-native-details .wl-section-summary{font-size:13px!important;color:#667080!important}
      .wl-native-details .checkout-step:not(.wl-section-collapsed) .wl-section-summary,.wl-native-details .checkout-step[data-step="1"] .wl-section-summary{display:none!important}
      .wl-native-details .wl-section-edit{border:0!important;background:transparent!important;padding:7px 0 7px 12px!important;font-size:13px}
      .wl-native-details .modern-shipping-selector{gap:10px!important}
      .wl-native-details .modern-shipping-selector button{position:relative;text-align:left;min-height:88px!important;border-radius:11px!important;padding:14px 34px 14px 14px!important;font:600 15px/1.4 system-ui!important}
      .wl-native-details .modern-shipping-selector button:after{content:"";position:absolute;right:12px;top:17px;width:15px;height:15px;box-sizing:border-box;border:1.5px solid #a7aeb8;border-radius:50%}
      .wl-native-details .modern-shipping-selector button.wl-selected:after{background:#6b0016;border-color:#6b0016;box-shadow:inset 0 0 0 3px #fff}
      .wl-native-details .modern-shipping-selector button.wl-recommended{outline:1px dashed #b28b94;outline-offset:2px}
      .wl-native-details .modern-shipping-selector[aria-busy="true"] button{opacity:.65!important;cursor:progress!important}
      .wl-native-details .modern-shipping-selector .wl-option-meta{display:none!important}
      .wl-native-details .modern-shipping-selector .wl-option-label{font-weight:600!important}
      .wl-native-details .modern-shipping-selector .wl-option-tag{font-size:11px!important;font-weight:500!important;padding:0!important;background:transparent!important;color:#615963!important}
      .wl-native-choice-action{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:16px}
      .wl-native-choice-action p{font-size:13px;color:#667080;margin:0}
      .wl-native-choice-action button{flex-shrink:0;min-height:44px;border:0;border-radius:9px;padding:10px 17px;background:#6b0016;color:#fff;font:600 14px system-ui}
      .wl-native-choice-action[hidden],.wl-native-choice-action button[hidden]{display:none!important}
      .wl-native-details .wl-native-done{border-color:#d4c4c8;border-radius:9px;font-size:14px;padding:10px 16px}
      .wl-native-details .wl-native-billing-hint{font-size:13px;max-width:680px;color:#667080}
      .wl-native-details .wl-section-collapsed .wl-native-billing-hint{display:none}
      .wl-native-details textarea{min-height:84px!important}
      .checkout-wizard.wl-single-page.wl-native-details .wl-native-original-notes{display:none!important}
      .wl-native-details .wl-branch-selected-title,.wl-native-details .wl-native-branch-empty .wl-branch-selected,.wl-native-details .wl-native-branch-empty .wl-branch-list-title{display:none!important}
      .wl-native-details .wl-branch-card{border-radius:10px!important;box-shadow:none!important}
      .wl-native-details .wl-proxy-continue{border-radius:10px!important;font:600 15px system-ui!important}
      .wl-native-ups-select{box-sizing:border-box!important;width:100%!important;max-width:100%!important;min-height:48px!important;padding:10px 38px 10px 14px!important;border:1px solid #cbd1da!important;border-radius:10px!important;background:#fff!important;font:15px system-ui!important;color:#25272c!important}
      .wl-native-ups-arrival{box-sizing:border-box;max-width:920px;margin:18px auto;padding:20px;border:1px solid #dce6df;border-radius:14px;background:#f5faf7;color:#24362b;font-family:system-ui,-apple-system,sans-serif}
      .wl-native-ups-arrival>span{font-size:12px;font-weight:600;letter-spacing:.2px;color:#486451}
      .wl-native-ups-arrival h2{font:650 26px/1.25 system-ui;letter-spacing:-.6px;margin:6px 0 8px;color:#243d2d}
      .wl-native-ups-arrival p{font-size:13px;margin:0 0 4px}.wl-native-ups-arrival small{display:block;font-size:12px;line-height:1.5;color:#617267}
      .wl-native-ups-arrival[data-kind="unavailable"]{background:#f7f8fa;border-color:#e1e4e9}.wl-native-ups-arrival[data-kind="unavailable"] h2{font-size:18px}
      html[data-wl-native-checkout-stage="shipping"] #MainLayoutRow{width:100%!important;max-width:960px!important;margin:20px auto 40px!important}
      html[data-wl-native-checkout-stage="shipping"] #MainLayoutRow>.container-fluid{width:100%!important;max-width:100%!important;padding:20px!important;box-sizing:border-box}
      html[data-wl-native-checkout-stage="shipping"] #MainLayoutRow>.container-fluid>.row{margin:0!important;padding:0!important}
      html[data-wl-native-checkout-stage="shipping"] #MainLayoutRow>.container-fluid>.row>.col{padding:0!important;min-width:0}
      html[data-wl-native-checkout-stage="shipping"] #MainLayoutRow .mainContents{width:100%!important;min-width:0}
      html[data-wl-native-checkout-stage="shipping"] #MainLayoutRow .wl-native-guide{padding:0;margin:0 auto 18px}
      html[data-wl-native-checkout-stage="shipping"] .wl-native-ups-select{min-width:0!important}
      html[data-wl-native-checkout-stage="shipping"] #ctl00_PageBody_BackToCartButton3,
      html[data-wl-native-checkout-stage="shipping"] #ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:11px 18px;border-radius:10px;max-width:100%;font:600 15px/1.4 system-ui}
      @media(max-width:767px){html[data-wl-native-checkout-stage="shipping"] #MainLayoutRow>.container-fluid{padding:16px!important}}
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
        .checkout-wizard.wl-single-page.wl-native-details .checkout-step,.checkout-wizard.wl-single-page.wl-native-details .checkout-step.wl-section-collapsed{padding:16px}
        body.wl-checkout-active #MainLayoutRow .wl-native-guide{padding:0 4px}
        .wl-native-details .wl-section-heading{grid-template-columns:32px minmax(0,1fr) auto!important;column-gap:10px!important}
        .wl-native-details .wl-section-title{max-width:none!important}
        .wl-native-details .wl-section-summary{margin-left:0!important;flex-basis:auto!important}
        .wl-native-details .modern-shipping-selector{grid-template-columns:1fr!important}
        .wl-native-details .modern-shipping-selector button{min-height:70px!important}
        .wl-native-choice-action{align-items:stretch;flex-direction:column;gap:10px}.wl-native-choice-action button{width:100%}
        .wl-native-ups-arrival{padding:17px}.wl-native-ups-arrival h2{font-size:24px}
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
    guide.innerHTML='<a class="wl-native-return" href="/ShoppingCart.aspx">← Back to cart</a><ol class="wl-native-progress"><li>1. Details</li><li>2. Shipping & payment</li><li>3. Review</li></ol><h1></h1><p></p><p id="wl-native-next" role="status" aria-live="polite" aria-atomic="true"></p>';
    var phase=stage==='details'?0:stage==='review'?2:1;
    guide.querySelectorAll('li')[phase].setAttribute('aria-current','step');
    var copy={
      details:['Order details',''],
      shipping:['Shipping & total','Choose your shipping speed below.'],
      payment:['Payment','Choose your payment method.'],
      review:['Review order','Check your details before placing your order.']
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
          if (status) { var state=row.valid?'✓ Ready':editing===row.step?'Editing':row.step===1?'Choose one':'Required'; if(status.textContent!==state)status.textContent=state; status.classList.toggle('wl-native-ready',row.valid); }
          if (edit) { edit.setAttribute('aria-label','Edit '+TITLES[row.step]); edit.setAttribute('aria-expanded',String(!row.collapsed)); }
        });
        var next=doc.getElementById('wl-native-next');
        if (next) {
          var message=plan.next && plan.next!==1?'Next: '+TITLES[plan.next]:'';
          if (next.textContent!==message) next.textContent=message;
        }
        var action=wizard.querySelector('.wl-native-choice-action');
        if (action) {
          var chosen=adapter.valid(1),target=wizard.querySelector('.modern-shipping-selector button.wl-recommended:not([disabled])');
          var button=action.querySelector('button'),hint=action.querySelector('p'),selector=wizard.querySelector('.modern-shipping-selector');
          var pending=selector?.getAttribute('aria-busy')==='true';
          action.hidden=chosen;button.hidden=!target;button.disabled=pending;
          var label=pending?'Confirming…':target?.dataset.mode==='ship'?'Use UPS shipping':target?.dataset.mode==='delivery'?'Use Woodson delivery':'Use pickup';
          if(button.textContent!==label)button.textContent=label;
          var hintText=target?'Continue with this suggestion, or choose another method.':'Choose a method to see your details.';
          if(hint.textContent!==hintText)hint.textContent=hintText;
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
      if (step===1) {
        var action=doc.createElement('div');action.className='wl-native-choice-action';
        var hint=doc.createElement('p'),choose=doc.createElement('button');choose.type='button';
        action.append(hint,choose);pane.appendChild(action);
        choose.addEventListener('click',function () {
          var target=wizard.querySelector('.modern-shipping-selector button.wl-recommended:not([disabled])');
          if(target && !asyncBusy() && wizard.querySelector('.modern-shipping-selector')?.getAttribute('aria-busy')!=='true')target.click();
        });
      }
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
    doc.addEventListener('wl:native-method-pending',schedule);
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
    win.WLNativeCheckout={build:BUILD,enhanceSections:enhanceSections,captureShippingEstimate:function () { return captureShippingEstimate(win); }};
    win.dispatchEvent(new win.Event('wl-native-checkout-ready'));
    var abandoned=false,feedbackTimer=null;
    var detailsEntered=false;
    function ready() {
      if(abandoned)return;
      if(nativeStage(win.document)==='details' && !detailsEntered) {
        detailsEntered=true;
        try { win.sessionStorage.removeItem(ETA_KEY); } catch (_) {}
      }
      mountGuide(win);renderPaymentFeedback(win);renderUpsArrival(win);
    }
    win.document.addEventListener('click',function (event) {
      if (!abandoned && event.target.closest?.('#ctl00_PageBody_ContinueButton1,#ctl00_PageBody_ContinueButton2')) captureShippingEstimate(win);
    },true);
    win.document.addEventListener('change',function (event) {
      if(event.target.id===UPS_SELECT || event.target.id==='ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_DeliveryOptionsDropDownList')ready();
    });
    if (win.document.readyState==='loading') win.document.addEventListener('DOMContentLoaded',ready,{once:true}); else ready();
    try { win.Sys?.WebForms?.PageRequestManager?.getInstance()?.add_endRequest(ready); } catch (_) {}
    function watch() {
      var host=win.document.querySelector('.mainContents') || win.document.querySelector('.container');
      if (!host || !win.MutationObserver || abandoned) return;
      var observer=new win.MutationObserver(function (mutations) {
        if (abandoned || mutations.every(function (mutation) { return mutation.target.closest?.('#wl-native-payment-feedback,#wl-native-ups-arrival'); })) return;
        win.clearTimeout(feedbackTimer);feedbackTimer=win.setTimeout(ready,100);
      });
      observer.observe(host,{childList:true,subtree:true});
      win.addEventListener('pagehide',function () { observer.disconnect(); },{once:true});
    }
    if (win.document.readyState==='loading') win.document.addEventListener('DOMContentLoaded',watch,{once:true});else watch();
    win.addEventListener('pagehide',function () { abandoned=true;win.clearTimeout(feedbackTimer); },{once:true});
  }
  return {build:BUILD,sectionPlan:sectionPlan,nativeStage:nativeStage,pickupContactName:pickupContactName,hasNativeError:hasNativeError,paymentFeedback:paymentFeedback,renderPaymentFeedback:renderPaymentFeedback,upsQuoteSnapshot:upsQuoteSnapshot,upsArrival:upsArrival,selectedUpsRate:selectedUpsRate,addUpsBusinessDays:addUpsBusinessDays,captureShippingEstimate:captureShippingEstimate,renderUpsArrival:renderUpsArrival,mountGuide:mountGuide,enhanceSections:enhanceSections,boot:boot};
});
