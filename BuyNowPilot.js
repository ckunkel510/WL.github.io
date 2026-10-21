/* Woodson compact checkout. Native WebTrack forms and verified account scopes. */
(function (root, factory) {
  'use strict';
  var core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else core.boot(root).catch(function () { /* An unavailable pilot leaves native shopping alone. */ }).finally(function () {
    root.document.documentElement.dataset.wlCompactCheckoutSettled = '1';
    root.dispatchEvent(new root.Event('wl-buy-now-pilot-settled'));
  });
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  var BUILD = '20261021-total-before-payment-39';
  var ENABLE_NEW_STARTS = true; // Kill switch: recovery remains available when false.
  var ENABLE_CART_CHECKOUT = true;
  var AUDIENCE = 'signed-in';
  var GUEST_START_KEY = 'wl_compact_guest_start_v1';
  var PREFIX = 'wl_buy_now_pilot_v1:';
  var SESSION_KEYS = ['wl_fulfillment_intent','wl_fulfillment_method','wl_fulfillment_selection_source_v1','wl_confirmed_fulfillment_v1','wl_checkout_form_snapshot_v2','wl_checkout_single_page_preview','wl_shipping_selection_v1','wl_shipping_offer_v1','wl_checkout_date_state_v2','wl_checkout_auto_advance','wl_checkout_address_payload','wl_checkout_contact_payload','wl_returnStep','wl_pendingStep','wl_expect_nav','wl_billing_confirmed','wl_billing_seen','wl_billing_confirmed_delivered','wl_autocopy_done'];
  var ORIGIN = 'https://webtrack.woodsonlumber.com';
  var BLOCKLIST_URL = 'https://ckunkel510.github.io/WL.github.io/blocked-products.json';
  var FINAL = '#ctl00_PageBody_CompleteCheckoutButton,#wl-complete,#wl-sticky-complete';
  // Conservative pilot exclusion, checked against ShoppingCartRow's pallet rules in tests.
  var PALLET_PRODUCTS = new Set('23297,22444,23379,24896,25273,25274,26446,26481,94106,12383,24315,24319,122893,25102,4741,12101,21194,23008,23049,20366,20368,21126,12100,2996,3003,21193,26060,133832,25415,2999,4743,21475,4742,25076,25094,23825,23826,23827,113992,113994,23828'.split(','));

  function text(value) { return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  var STATE_NAMES = {
    AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DC:'District of Columbia',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',IA:'Iowa',ID:'Idaho',IL:'Illinois',IN:'Indiana',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',MA:'Massachusetts',MD:'Maryland',ME:'Maine',MI:'Michigan',MN:'Minnesota',MO:'Missouri',MS:'Mississippi',MT:'Montana',NC:'North Carolina',ND:'North Dakota',NE:'Nebraska',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NV:'Nevada',NY:'New York',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VA:'Virginia',VT:'Vermont',WA:'Washington',WI:'Wisconsin',WV:'West Virginia',WY:'Wyoming',AB:'Alberta',BC:'British Columbia',MB:'Manitoba',NB:'New Brunswick',NL:'Newfoundland and Labrador',NS:'Nova Scotia',NT:'Northwest Territories',NU:'Nunavut',ON:'Ontario',PE:'Prince Edward Island',QC:'Quebec',SK:'Saskatchewan',YT:'Yukon Territory'
  };
  function nativeStateOption(options, address) {
    var value=text(address.stateValue).toUpperCase(), label=text(address.stateText).toUpperCase();
    var names=new Set([value,label,STATE_NAMES[value]?.toUpperCase(),STATE_NAMES[label]?.toUpperCase()].filter(Boolean));
    // Native WebTrack uses numeric state IDs (Texas is 56). Resolve the label
    // rather than posting a postal abbreviation as if it were a native ID.
    return Array.from(options).find(function (option) {
      return (value && text(option.value).toUpperCase()===value) || names.has(text(option.textContent).toUpperCase());
    });
  }
  function deliveryAddressSummary(address) {
    if (!text(address?.line1)) return 'Choose an address';
    var state=text(address.stateValue);
    if (!/^[A-Z]{2}$/i.test(state)) state=text(address.stateText || state);
    var region=[state,text(address.zip)].filter(Boolean).join(' ');
    var locality=[text(address.city),region].filter(Boolean).join(', ');
    return [address.line1,address.line2,address.line3,locality].map(text).filter(Boolean).join(', ');
  }
  function pidOf(value) { var m = String(value || '').match(/[?&]pid=(\d+)(?:&|$)/i); return m ? m[1] : ''; }
  function targetOf(value) {
    var m = String(value || '').match(/(?:__doPostBack|WebForm_PostBackOptions)\(\s*['"]([^'"]+)['"]/i);
    return m ? m[1] : '';
  }
  function nativeFormsReady(child) {
    var page=child.document;
    if (page && page.readyState!=='complete') return false;
    var manager=child.Sys?.WebForms?.PageRequestManager?.getInstance?.();
    if (manager?.get_isInAsyncPostBack?.()) return false;
    var application=child.Sys?.Application;
    return !application?.get_isInitialized || application.get_isInitialized();
  }
  function relayControl(name) {
    return /^ctl00\$PageBody\$(?:PlaceOrderButton|ContinueButton[12]|YesButton|btnContinue_DeliveryAndPromotionCodesView|btnContinue_CardOnFileView)$/.test(name || '');
  }
  function continueNativeCart(child, control) {
    if (!nativeFormsReady(child) || !control || control.disabled || control.getAttribute('aria-disabled')==='true') return false;
    var href=control.getAttribute('href') || '';
    if (/WebForm_DoPostBackWithOptions/.test(href)) {
      // Use the same validated native postback as the cart link. JavaScript URL
      // activation in an offscreen iframe can otherwise leave the cart unchanged.
      if (typeof child.WebForm_DoPostBackWithOptions!=='function' || typeof child.WebForm_PostBackOptions!=='function') return false;
      var target=targetOf(href);
      if (target!=='ctl00$PageBody$PlaceOrderButton') throw new Error('The native checkout entry could not be verified.');
      child.WebForm_DoPostBackWithOptions(new child.WebForm_PostBackOptions(target,'',true,'','',false,true));
      if (control.dataset) { control.dataset.bnNativeValidation=child.Page_IsValid===false?'invalid':'accepted'; control.dataset.bnNativeBlocked=String(!!child.Page_BlockSubmit); }
      if (child.Page_IsValid===false) throw new Error('WebTrack needs a cart quantity checked. Return to the cart and review your items.');
    } else control.click();
    return true;
  }
  function readableCart(page, rowCount) {
    return rowCount > 0 || !!page.querySelector('#ctl00_PageBody_ShoppingCartDetailPanel,.ShoppingCartDetailPanel,#ctl00_PageBody_EmptyCartPanel,#ctl00_PageBody_EmptyCartDetailPanel') || /cart\s+is\s+(?:currently\s+)?empty|no\s+items\s+in\s+(?:your\s+)?(?:shopping\s+)?cart/i.test(page.body.textContent);
  }
  function cartPolicyReady(page) {
    return !page.querySelector('script[src*="ShoppingCartRow.js"]') || !!page.getElementById('wl-cart-qty-stepper-styles');
  }
  function hasCustomCuts(items, selections) {
    return Object.values(selections || {}).some(function (selection) {
      return selection && items.some(function (item) { return String(selection.productId)===String(item.pid) || text(selection.productCode).toUpperCase()===text(item.code).toUpperCase(); });
    });
  }
  function signedIn(doc) { return !!doc.querySelector('a[href*="SignOut=1"],a[href*="signout=1"]'); }
  function loginFromDocument(doc) {
    if (!signedIn(doc)) return '';
    // Verified native AccountSettings headings, never editable inputs or localStorage.
    var names = Array.from(doc.querySelectorAll('.formPageHeader')).map(function (el) {
      var match = text(el.textContent).match(/^Change (?:password|details) for user\s+['"]([^'"]+)['"]$/i);
      return match ? match[1].toLowerCase() : '';
    }).filter(Boolean);
    return names.length && new Set(names).size === 1 ? names[0] : '';
  }
  function accountScopeInput(user, header) {
    if (!text(user) || !text(header)) throw new Error('The current customer account could not be verified.');
    // Keep existing ckunkel2 recovery/payment keys compatible while isolating
    // every other verified login and customer account in its own namespace.
    return text(user).toLowerCase() + '|' + text(header);
  }
  function guestContext(session, user) {
    if (session.getItem('wl_checkout_mode') !== 'guest') return null;
    var payload;
    try { payload=JSON.parse(session.getItem('wl_guest_checkout_payload') || '{}'); } catch (_) { return null; }
    if (!payload || text(payload.email).toLowerCase() !== user || !text(payload.fname) || !text(payload.lname)) return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(payload.email)) || text(payload.phone).replace(/\D/g,'').length<10) return null;
    var address = function (billing) {
      var prefix=billing && !payload.billSame ? 'i_' : 'd_';
      var state=text(payload[prefix==='i_'?'i_state2':'d_state']).toUpperCase();
      var value={line1:text(payload[prefix+'addr1']),line2:'',line3:'',city:text(payload[prefix+'city']),stateValue:state,stateText:state,zip:text(payload[prefix+'zip']),countryValue:'USA',countryText:'United States',contactName:text(payload.fname)+' '+text(payload.lname),email:text(payload.email),phone:text(payload.phone)};
      return value.line1 && value.city && /^[A-Z]{2}$/.test(state) && /^\d{5}(?:-\d{4})?$/.test(value.zip) ? value : null;
    };
    var delivery=address(false), billing=address(true);
    if (!delivery || !billing) return null;
    return {address:delivery,billing:billing,contact:{firstName:text(payload.fname),lastName:text(payload.lname),email:text(payload.email),phone:text(payload.phone)}};
  }
  function guestStartPending(session, now) {
    try {
      var value=JSON.parse(session.getItem(GUEST_START_KEY) || 'null');
      return !!value && value.version===1 && Number.isFinite(value.createdAt) && now>=value.createdAt && now-value.createdAt<300000;
    } catch (_) { return false; }
  }
  function lines(value) {
    if (!Array.isArray(value) || value.length > 60) throw new Error('This cart needs regular checkout.');
    var seen = new Set();
    return value.map(function (row) {
      var item = { pid: String(row.pid || ''), quantity: Number(row.quantity), code: text(row.code), unit: text(row.unit).toLowerCase(), name: text(row.name).slice(0, 180) };
      if (!/^\d+$/.test(item.pid) || seen.has(item.pid) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 9999) {
        throw new Error('This cart has a quantity or configuration that needs regular checkout.');
      }
      if (/epallet|e-pallet|wdoor/i.test(item.code)) throw new Error('Pallet and configured orders need regular checkout with compact checkout.');
      if (PALLET_PRODUCTS.has(item.pid)) throw new Error('Pallet-handling products need regular checkout with compact checkout.');
      seen.add(item.pid);
      return item;
    });
  }
  function signature(value) {
    return JSON.stringify(lines(value).map(function (row) { return [row.pid, row.quantity, row.code.toUpperCase(), row.unit]; }).sort(function (a, b) { return a[0].localeCompare(b[0]); }));
  }
  function plan(original, primary, selected) {
    var before = lines(original), purchase = lines([primary]), chosen = new Set((selected || []).map(String));
    if (Array.from(chosen).some(function (id) { return !before.some(function (row) { return row.pid === id; }); })) throw new Error('The cart selection changed. Please reopen Buy now.');
    before.forEach(function (row) {
      if (!chosen.has(row.pid)) return;
      var same = purchase.find(function (item) { return item.pid === row.pid; });
      if (same) {
        if (same.unit !== row.unit || same.code.toUpperCase() !== row.code.toUpperCase()) throw new Error('Matching products have different units. Use regular checkout.');
        same.quantity += row.quantity;
      } else purchase.push(Object.assign({}, row));
    });
    return { original: before, purchase: lines(purchase), remaining: before.filter(function (row) { return !chosen.has(row.pid); }) };
  }
  function nextMutation(current, wanted, preparing) {
    var have = lines(current), target = lines(wanted);
    // During preparation, add the Buy Now product before removing old cart
    // lines, leaving time to include those lines without removing/re-adding them.
    var missing = preparing && target.find(function (row) { return !have.some(function (item) { return item.pid === row.pid; }); });
    if (missing) return { kind:'add',pid:missing.pid,quantity:missing.quantity };
    var remove = have.find(function (row) { return !target.some(function (item) { return item.pid === row.pid; }); });
    if (remove) return { kind: 'remove', pid: remove.pid, quantity: 0 };
    for (var i = 0; i < target.length; i++) {
      var row = target[i], present = have.find(function (item) { return item.pid === row.pid; });
      if (!present) return { kind: 'add', pid: row.pid, quantity: row.quantity };
      if (present.code.toUpperCase() !== row.code.toUpperCase() || present.unit !== row.unit) throw new Error('A cart product or unit changed. Automatic restoration has stopped.');
      if (present.quantity !== row.quantity) return { kind: 'quantity', pid: row.pid, quantity: row.quantity };
    }
    return null;
  }
  function afterMutation(current, wanted, action) {
    var result = lines(current).filter(function (row) { return row.pid !== action.pid; });
    if (action.kind !== 'remove') result.push(Object.assign({}, lines(wanted).find(function (row) { return row.pid === action.pid; }), { quantity: action.quantity }));
    return lines(result);
  }
  function assertExpected(current, record) {
    var actual = signature(current);
    var allowed = record.pending ? [record.pending.before, record.pending.after] : [signature(record.current)];
    if (!allowed.includes(actual)) throw new Error('The cart changed elsewhere. Your backup is retained; automatic changes have stopped.');
  }
  function recoveryTarget(record) {
    if (['submitting', 'uncertain'].includes(record.phase)) throw new Error('Order status must be checked before restoring or trying again.');
    return lines(record.orderNumber ? record.remaining : record.original);
  }
  function assertReview(review, expected) {
    var normalized = function (items) { return JSON.stringify(items.map(function (row) { return [text(row.code).toUpperCase(), Number(row.quantity), text(row.unit).toLowerCase()]; }).sort(function (a,b) { return JSON.stringify(a).localeCompare(JSON.stringify(b)); })); };
    if (!review.length || normalized(review) !== normalized(lines(expected))) throw new Error('The native order review differs from the Buy now basket. The order was not submitted.');
  }
  function dateChoice(value, min, max) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    var parts = value.split('-').map(Number), date = new Date(parts[0], parts[1]-1, parts[2], 12);
    if (date.getFullYear() !== parts[0] || date.getMonth() !== parts[1]-1 || date.getDate() !== parts[2] || date.getDay() === 0) return false;
    return (!min || value >= min) && (!max || value <= max);
  }
  function firstDate(min, max) {
    var parts = String(min || '').split('-').map(Number);
    if (parts.length !== 3) return '';
    var date = new Date(parts[0], parts[1]-1, parts[2], 12);
    for (var i = 0; i < 16; i++, date.setDate(date.getDate()+1)) {
      var value = [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
      if (dateChoice(value, min, max)) return value;
    }
    return '';
  }
  var PICKUP_STORES = ['Brenham','Bryan','Caldwell','Lexington','Groesbeck','Mexia','Buffalo'];
  function pickupStoreName(label) {
    return PICKUP_STORES.find(function (name) { return new RegExp('^'+name+'(?:\\s*(?:-|,)|$)','i').test(text(label)); }) || '';
  }
  function centralCalendar(now) {
    var parts = new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now || new Date());
    var value = Object.fromEntries(parts.map(function (part) { return [part.type,part.value]; }));
    return {date:value.year+'-'+value.month+'-'+value.day,minutes:Number(value.hour)*60+Number(value.minute)};
  }
  function calendarAfter(value, days, business) {
    var date = new Date(value+'T12:00:00Z');
    if (!Number.isFinite(date.getTime())) return '';
    for (var left=days;left>0;) { date.setUTCDate(date.getUTCDate()+1); if (!business || date.getUTCDay()>0 && date.getUTCDay()<6) left--; }
    return date.toISOString().slice(0,10);
  }
  function pickupTimeChoices(value, now) {
    if (!dateChoice(value)) return [];
    var current=centralCalendar(now), day=new Date(value+'T12:00:00Z').getUTCDay();
    var start=value===current.date ? Math.max(480,Math.ceil((current.minutes+120)/60)*60) : 480;
    if (value<current.date) return [];
    var end=day===6 ? 960 : 1050, choices=[];
    var label=function (minutes) { var hour=Math.floor(minutes/60); return (hour%12||12)+':'+String(minutes%60).padStart(2,'0')+' '+(hour>=12?'PM':'AM'); };
    for (var time=start;time+60<=end;time+=60) choices.push({value:label(time)+'–'+label(time+60),label:label(time)+' – '+label(time+60)});
    return choices;
  }
  function stockFromDocument(page) {
    var branches={}, valid=true;
    Array.from(page.querySelectorAll('tr')).forEach(function (row) {
      var name=pickupStoreName(row.querySelector('td[data-title="Branch"]')?.textContent);
      if (!name) return;
      var raw=text(row.querySelector('td[data-title="Available"]')?.textContent).replace(/,/g,'');
      if (!/^-?\d+(?:\.\d+)?$/.test(raw) || Object.prototype.hasOwnProperty.call(branches,name)) { valid=false; return; }
      branches[name]=Math.max(0,Number(raw));
    });
    return {verified:valid && PICKUP_STORES.every(function (name) { return Number.isFinite(branches[name]); }),branches:branches};
  }
  function pickupReadiness(items, stocks, label, now) {
    var current=centralCalendar(now), store=pickupStoreName(label), maximum=calendarAfter(current.date,14,false);
    var ready=firstDate(current.date,maximum);
    while (ready && !pickupTimeChoices(ready,now).length) ready=firstDate(calendarAfter(ready,1,false),maximum);
    var rows=items.map(function (item) {
      var stock=stocks[item.pid], local=stock?.verified && store ? stock.branches[store] : null;
      var total=stock?.verified ? Object.values(stock.branches).reduce(function (sum,n) { return sum+n; },0) : null;
      var state=stock===undefined ? 'checking' : local===null || local===undefined ? 'unconfirmed' : local>=item.quantity ? 'local' : total>=item.quantity ? 'transfer' : 'supplier';
      var min=state==='local' ? ready : firstDate(calendarAfter(current.date,state==='supplier'?7:3,true),maximum);
      return {pid:item.pid,code:item.code,name:item.name,quantity:item.quantity,local:local,state:state,min:min};
    });
    return {store:store,items:rows,checking:rows.some(function (row) { return row.state==='checking'; }),min:rows.reduce(function (value,row) { return row.min>value?row.min:value; },ready),max:maximum,confirmation:rows.some(function (row) { return ['transfer','supplier','unconfirmed'].includes(row.state); })};
  }
  function money(value) {
    var match = text(value).match(/^\$?\s*(\d+(?:,\d{3})*)(?:\.(\d{2}))?$/);
    return match ? Number(match[1].replace(/,/g,''))*100 + Number(match[2] || 0) : null;
  }
  function fulfillmentApplied(method, intent, pressed) {
    return ['pickup','delivery','ship'].includes(method) && intent === method && pressed === 'true';
  }
  function requestNativeMethod(page, method, now) {
    var id = {pickup:'btnPickup',delivery:'btnDelivered',ship:'btnShip'}[method];
    var control = id && page.getElementById(id);
    // WebTrack enables these controls after its quote/UpdatePanel has settled.
    // A disabled button silently ignores click(); never record that as a request.
    if (!control || control.disabled || control.getAttribute('aria-disabled') === 'true') return false;
    if (!control.dataset.bnRequestedAt) {
      control.dataset.bnRequestedAt = String(now);
      page.documentElement.dataset.bnMethod = method;
      control.click();
    }
    return true;
  }
  function productMethod(page) {
    var pickup = page.querySelector('button[aria-label="Choose pickup"][aria-pressed="true"]');
    var paid = page.querySelector('button[aria-label="Choose delivery or shipping"][aria-pressed="true"]');
    return pickup && !paid ? 'pickup' : '';
  }
  function contactDefaults(settings, account) {
    var value = function (id) { return text(settings.getElementById(id)?.value); };
    return {firstName:value('ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput'),lastName:value('ctl00_PageBody_ChangeUserDetailsControl_LastNameInput'),email:value('ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput').replace(/^\([^)]*\)\s*/,''),phone:text(account.getElementById('ctl00_PageBody_TelephoneLink_TelephoneLink')?.textContent)};
  }
  function applyContactDefaults(page, contact, address, forceInvoicePhone) {
    var chosen = address?.contactName ? text(address.contactName).split(' ') : null;
    var delivery = {firstName:chosen ? chosen[0] : contact.firstName,lastName:chosen ? chosen.slice(1).join(' ') : contact.lastName,email:address?.email || contact.email,phone:address?.phone || contact.phone};
    [['DeliveryAddress',delivery],['InvoiceAddress',contact]].forEach(function (entry) {
      [['ContactFirstNameTextBox','firstName'],['ContactLastNameTextBox','lastName'],['EmailAddressTextBox','email'],['ContactTelephoneTextBox','phone']].forEach(function (field) {
        var el = page.getElementById('ctl00_PageBody_'+entry[0]+'_'+field[0]), value = entry[1][field[1]];
        if (el && value && !(entry[0]==='InvoiceAddress' && field[1]==='phone' && el.value && !forceInvoicePhone)) el.value = value;
      });
    });
  }
  function fulfillmentOptions(pickupAvailable, quote) {
    return {
      pickup:{available:pickupAvailable,rate:'Free'},
      delivery:{available:!!quote?.options?.delivery?.available,pending:!quote,rate:'$'+Number(quote?.options?.delivery?.amount||0).toFixed(2),reason:text(quote?.options?.delivery?.reason)},
      ship:{available:!!quote?.options?.ups?.available,pending:!quote,rate:'$'+Number(quote?.options?.ups?.amount||0).toFixed(2),rates:quote?.options?.ups?.rates || [],reason:text(quote?.options?.ups?.reason)}
    };
  }
  function quoteForCart(quote, items) {
    // A late quote from the previous basket must never choose this order's mode.
    var expected = lines(items).map(function (item) { return [item.pid,item.code.replace(/\s+/g,'').toUpperCase(),item.quantity,''].join(':'); }).sort().join('|');
    return quote && expected && quote.cartSignature === expected ? quote : null;
  }
  function cheapestHomeMethod(quote) {
    var options = quote?.options, delivery = options?.delivery, ups = options?.ups;
    var valid = function (option) { return option?.available && Number.isFinite(Number(option.amount)) && Number(option.amount)>0; };
    if (valid(delivery) && (!valid(ups) || Number(delivery.amount)<=Number(ups.amount))) return 'delivery';
    return valid(ups) ? 'ship' : 'pickup';
  }
  function assertPickupStore(nativeLabel, expectedLabel) {
    if (!text(expectedLabel) || text(nativeLabel)!==text(expectedLabel)) throw new Error('WebTrack did not confirm your pickup store. Change it and try again.');
  }
  async function refreshDetailsQuote(refresh, isCurrent) {
    // refresh() may first return an already-running cart-page request. Let that
    // finish, then request the quote with the completed native address fields.
    await refresh();
    if (!isCurrent()) return null;
    var quote = await refresh();
    return isCurrent() ? quote : null;
  }
  function employeeZeroReview(user, totals, hasShippingRow) {
    // WebTrack's existing employee path can omit freight with a fully zero review.
    // Preserve it only for this verified account, never for a partial/positive total.
    return user === 'ckunkel2' && !hasShippingRow && !totals.shipping &&
      ['subtotal','tax','total'].every(function (key) { return money(totals[key]) === 0; });
  }
  function quotedShipping(method, option, service, first) {
    if (method === 'pickup') return 0;
    if (!option || money(option.rate) === null) throw new Error('The fulfillment quote is unavailable.');
    if (method === 'delivery' || first || !service || /ground/i.test(service.label)) return money(option.rate);
    var clean = function (value) { return text(value).toLowerCase().replace(/\bups\b/g,'').replace(/[^a-z0-9]/g,''); };
    var rate = (option.rates || []).find(function (row) { return String(row.serviceCode) === service.value || clean(service.label).includes(clean(row.serviceName)) && !!clean(row.serviceName); });
    if (!rate || !(Number(rate.amount) > 0)) throw new Error('This shipping speed needs regular checkout.');
    return Math.round(Number(rate.amount)*100);
  }
  function reviewTotals(summary) {
    var result = {};
    Array.from(summary.querySelectorAll('table tbody tr')).forEach(function (row) {
      var label = text(row.children[0]?.textContent), value = text(row.querySelector('td.numeric')?.textContent);
      if (/^Subtotal\b/i.test(label)) result.subtotal = value;
      else if (/^Tax$/i.test(label)) result.tax = value;
      else if (/^Total(?:\s+inc\s+Tax)?$/i.test(label)) result.total = value;
      else if (/^(?:Delivery|Shipping)(?:\s|$)/i.test(label)) result.shipping = value;
    });
    if (['subtotal','tax','total'].some(function (key) { return money(result[key]) === null; })) throw new Error('The final total is still loading.');
    return result;
  }
  function paymentTotals(page, method, expectedShipping) {
    // Read native tax and totals; never estimate tax or use a cart-page subtotal.
    var totals = reviewTotals(page);
    if (!totals.shipping && method === 'pickup') totals.shipping = '$0.00';
    var shipping = money(totals.shipping);
    if (shipping === null || shipping !== expectedShipping) throw new Error('The delivery total is still being confirmed.');
    if (Math.abs(money(totals.subtotal) + shipping + money(totals.tax) - money(totals.total)) > 1) throw new Error('The order total is still being confirmed.');
    return totals;
  }
  function marker(record) { return record.cartCheckout ? (record.guestCheckout ? 'Website Guest Compact Checkout | ' : 'Website Compact Checkout | ') + record.id : 'Website Buy Now | ' + record.id + ' | Additional cart items: ' + record.extraCount; }
  function cartOrderReceipt(record) {
    // A submission guard, never a cart backup. No items, addresses or payment data.
    if (!['submitting','uncertain','confirmed'].includes(record.phase)) return null;
    return {version:1,id:record.id,phase:record.phase,createdAt:record.createdAt,updatedAt:record.updatedAt,orderNumber:record.orderNumber || ''};
  }
  function readCartOrderReceipt(storage, key) {
    var raw = storage.getItem(key);
    if (!raw) return null;
    var value;
    try { value = JSON.parse(raw); } catch (_) { throw new Error('The previous checkout status needs review. Open order history before trying again.'); }
    if (!value || value.version!==1 || !/^CC-[a-z0-9-]+$/i.test(value.id || '') || !['submitting','uncertain','confirmed'].includes(value.phase)) throw new Error('The previous checkout status needs review. Open order history before trying again.');
    return cartOrderReceipt(value);
  }
  function savedChoice(options, preferred) {
    var available = options.filter(function (option) { return !option.disabled && option.value && !/^(select|choose|please|none|no (?:saved|stored|cards?))\b/i.test(text(option.label)); });
    var matches = preferred ? available.filter(function (option) { return option.fingerprint === preferred; }) : [];
    return matches.length === 1 ? matches[0] : available[0] || null;
  }
  function mainAddress(rawLines) {
    var values = (rawLines || []).map(text).filter(Boolean);
    for (var i = 1; i < values.length; i++) {
      var locality = values[i].match(/^(.+?)[,\s]+(Texas|[A-Z]{2})(?:\s*,?\s*(\d{5}(?:-\d{4})?))?$/i);
      if (!locality) continue;
      var zip = locality[3] || (values[i + 1] || '').match(/^\d{5}(?:-\d{4})?$/)?.[0];
      if (!zip) continue;
      var street = values.slice(0, i), start = street.findIndex(function (value) { return /^\d+\b|^P\.?\s*O\.?\s*Box\b/i.test(value); });
      if (start < 0 || street.length - start > 3) return null;
      street = street.slice(start);
      return {line1:street[0],line2:street[1]||'',line3:street[2]||'',city:text(locality[1]).replace(/,$/,''),stateValue:/^Texas$/i.test(locality[2])?'TX':locality[2].toUpperCase(),stateText:locality[2],zip:zip,countryValue:'USA',countryText:'United States'};
    }
    return null;
  }
  function readRecord(storage, key) {
    var raw = storage.getItem(key);
    if (!raw) return null;
    var record;
    try { record = JSON.parse(raw); } catch (_) { throw new Error('The cart recovery record could not be read. Do not start another Buy now.'); }
    if (record.version !== 1 || !/^BN-[a-z0-9-]+$/i.test(record.id || '') || !record.scope) throw new Error('The cart recovery record needs review.');
    if (!['backed_up','preparing','checking_out','submitting','uncertain','confirmed','restoring'].includes(record.phase)) throw new Error('The saved checkout state needs review.');
    lines(record.original); lines(record.purchase); lines(record.remaining); lines(record.current);
    return record;
  }
  function persist(storage, key, record) {
    var serialized = JSON.stringify(record);
    storage.setItem(key, serialized);
    if (storage.getItem(key) !== serialized) throw new Error('A cart backup could not be saved. Buy now has stopped.');
  }

  async function boot(win) {
    if (!win || win.location.origin !== ORIGIN || win.top !== win || win.WLBuyNowPilot) return;
    var doc = win.document;
    if (doc.readyState === 'loading') await new Promise(function (resolve) { doc.addEventListener('DOMContentLoaded', resolve, { once: true }); });
    if (!signedIn(doc)) return;
    var storage = win.localStorage;
    var timings = null, measuredPayment = null;
    function measureCheckout(stage, page, reviewed, orderNumber) {
      // Measurement is optional and can never block payment/cart recovery.
      try {
        if (!active || !win.WLAnalytics?.checkout || stage==='cancel' && active.orderNumber) return;
        var paymentType=reviewed?.employeeZero?'no_payment_due':fast?.paymentFingerprint?'stored_card':fast?.securePayment?'new_card':'webtrack';
        if (stage==='review') measuredPayment={id:active.id,revision:fast?.revision,type:paymentType};
        if (measuredPayment?.id===active.id && measuredPayment.revision===fast?.revision) paymentType=measuredPayment.type;
        win.WLAnalytics.checkout(stage,{id:active.id,flow:active.cartCheckout?'compact_cart':'quick_buy',customerType:active.guestCheckout?'guest':'signed_in',items:active.purchase || active.current,method:fast?.method,paymentType:paymentType,totals:reviewed?.totals,readyMs:stage==='review'&&fast?Date.now()-fast.opened:undefined,includedCartItems:active.extraCount || 0,orderNumber:orderNumber},page);
      } catch (_) {}
    }
    async function fetchDocument(path, options, timeoutMs) {
      var url = new URL(path, win.location.href);
      if (url.origin !== ORIGIN) throw new Error('An unexpected checkout destination was blocked.');
      var measurement = timings, began = Date.now();
      var category = options?.method === 'POST' ? 'cartWrite' : /AccountSettings/i.test(url.pathname) ? 'identity' : /AccountInfo/i.test(url.pathname) ? 'account' : /ProductDetail/i.test(url.pathname) ? 'product' : /ShoppingCart/i.test(url.pathname) ? 'cartRead' : 'other';
      var controller = new win.AbortController(), timeout = win.setTimeout(function () { controller.abort(); }, timeoutMs || 20000);
      try {
        var response = await win.fetch(url.href, Object.assign({ credentials: 'same-origin', cache: 'no-store', signal: controller.signal }, options || {}));
        if (!response.ok || new URL(response.url || url.href).origin !== ORIGIN) throw new Error('WebTrack could not confirm the request.');
        return new win.DOMParser().parseFromString(await response.text(), 'text/html');
      } finally {
        win.clearTimeout(timeout);
        if (measurement) { var metric = measurement.requests[category] || (measurement.requests[category] = {count:0,ms:0}); metric.count++; metric.ms += Date.now()-began; }
      }
    }
    var user = '';
    async function authenticate() {
      var settings = await fetchDocument('/AccountSettings.aspx');
      var login=loginFromDocument(settings);
      if (!login || user && login!==user) throw new Error('Your WebTrack sign-in changed or expired. Please sign in again.');
      return settings;
    }
    var initial = await Promise.all([authenticate(),fetchDocument('/AccountInfo_R.aspx'),purchaseRestrictions()]);
    var settings = initial[0];
    user=loginFromDocument(settings);
    var guest=guestContext(win.sessionStorage,user);
    // An old guest draft must never hydrate a different signed-in account.
    if (!guest && win.sessionStorage.getItem('wl_checkout_mode')==='guest') {
      ['wl_guest_checkout_payload','wl_guest_checkout_needs_autofill','wl_checkout_mode',GUEST_START_KEY].forEach(function (name) { win.sessionStorage.removeItem(name); });
    }
    async function digest(value) {
      var bytes = await win.crypto.subtle.digest('SHA-256', new win.TextEncoder().encode(value));
      return Array.from(new Uint8Array(bytes)).map(function (n) { return n.toString(16).padStart(2, '0'); }).join('');
    }
    // User ID is an isolation key, never proof of authorization. Authenticate above and before mutations.
    var account = initial[1];
    var accountHeader = account.querySelector('.panelAccountInfo .listPageHeader,.accountInfoHeader');
    if (!accountHeader || !text(accountHeader.textContent)) throw new Error('The current customer account could not be verified.');
    var scope = await digest(accountScopeInput(user,accountHeader.textContent));
    if (win.sessionStorage.getItem(PREFIX+'current-scope')!==scope) {
      SESSION_KEYS.forEach(function (name) { win.sessionStorage.removeItem(name); });
      win.sessionStorage.setItem(PREFIX+'current-scope',scope);
    }
    var branch = text(settings.getElementById('ctl00_PageBody_ChangeUserDetailsControl_ddBranch')?.value);
    var key = PREFIX + scope, preferenceKey = PREFIX + 'payment:' + scope, cartOrderKey = PREFIX + 'cart-order:' + scope;
    var blocked = initial[2];
    var owner = win.crypto.randomUUID(), active = null, overlay = null, frame = null, releaseLock = null;
    var previousFocus = null, previousOverflow = '', busy = false, submitting = false, cancelPending = false, frameObserver = null, frameTimer = null, framePulse = null, frameReadyTimer = null, installedPage = null, permittedFinal = null, fast = null, cartEntry = false, bypassCartEntry = false;
    var lockName = PREFIX + 'lock:' + scope;
    var model = { build: BUILD, audience: AUDIENCE, guest:!!guest };
    win.WLBuyNowPilot = model;
    doc.documentElement.dataset.wlBuyNowBuild = BUILD;
    doc.documentElement.dataset.wlCompactCheckoutMode = guest ? 'guest' : 'signed-in';
    var detailsQuotes = new WeakMap();

    async function purchaseRestrictions() {
      var controller = new win.AbortController(), timer = win.setTimeout(function () { controller.abort(); }, 15000);
      try {
        var response = await win.fetch(BLOCKLIST_URL, { credentials: 'omit', cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Purchase eligibility could not be checked. Please use regular checkout.');
        var policy = await response.json();
        if (!Array.isArray(policy.blockedProductIds) || !policy.blockedProductIds.every(function (id) { return /^\d+$/.test(String(id)); })) throw new Error('Purchase eligibility could not be verified.');
        return new Set(policy.blockedProductIds.map(String));
      } finally { win.clearTimeout(timer); }
    }

    async function checkIdentity() {
      var identity = await Promise.all([authenticate(), fetchDocument('/AccountInfo_R.aspx')]);
      var currentSettings = identity[0], fresh = identity[1];
      var header = fresh.querySelector('.panelAccountInfo .listPageHeader,.accountInfoHeader');
      if (!header || await digest(accountScopeInput(user,header.textContent)) !== scope) throw new Error('The customer account changed. Cart changes have stopped.');
      var expectedBranch = active ? active.branch : branch;
      if (text(currentSettings.getElementById('ctl00_PageBody_ChangeUserDetailsControl_ddBranch')?.value) !== expectedBranch) throw new Error('Your account branch changed. Return to the original branch before recovering this cart.');
      settings = currentSettings; account = fresh;
    }
    function save() {
      active.updatedAt = Date.now();
      if (active.cartCheckout) {
        var receipt = cartOrderReceipt(active);
        if (receipt) persist(storage,cartOrderKey,receipt);
      } else persist(storage, key, active);
    }
    function assertNoPendingCartOrder() {
      var receipt = readCartOrderReceipt(storage,cartOrderKey);
      if (receipt && receipt.phase!=='confirmed') throw new Error('A previous order is not yet confirmed. Check order history before another checkout.');
      if (receipt) storage.removeItem(cartOrderKey);
    }
    function record() { var value = readRecord(storage, key); if (value && value.scope !== scope) throw new Error('The recovery account does not match.'); return value; }
    function status(message, error) {
      if (!overlay) return;
      var el = overlay.querySelector('[data-bn-status]');
      el.textContent = message; el.classList.toggle('bn-error', !!error);
      if (error) { loading(false); var inline=overlay.querySelector('.bn-editor-error'); if (inline) inline.textContent=message; }
    }
    function button(label, handler, secondary) {
      var el = doc.createElement('button'); el.type = 'button'; el.className = 'bn-action' + (secondary ? ' bn-secondary' : ''); el.textContent = label;
      el.addEventListener('click', handler); return el;
    }
    function clearFrame() {
      if (frameObserver) frameObserver.disconnect(); frameObserver = null;
      if (frameTimer) win.clearTimeout(frameTimer); frameTimer = null;
      if (framePulse) win.clearInterval(framePulse); framePulse = null;
      if (frameReadyTimer) win.clearInterval(frameReadyTimer); frameReadyTimer = null; installedPage = null;
      if (frame) { frame.remove(); frame = null; }
      overlay?.querySelector('.bn-panel')?.classList.remove('bn-secure-payment');
    }
    function dismiss() {
      clearFrame();
      if (overlay) overlay.remove(); overlay = null;
      doc.body.style.overflow = previousOverflow;
      if (previousFocus && previousFocus.isConnected) previousFocus.focus();
      if (releaseLock) releaseLock(); releaseLock = null;
      active = null; busy = false; submitting = false; cancelPending = false;
      fast = null;
      cartEntry = false;
      if (blocked) addButtons();
      else purchaseRestrictions().then(function (ids) { blocked = ids; addButtons(); }).catch(function () {});
    }
    function shell(title) {
      if (overlay) return;
      previousFocus = doc.activeElement; previousOverflow = doc.body.style.overflow;
      overlay = doc.createElement('div'); overlay.id = 'wl-buy-now';
      overlay.dataset.bnFlow=cartEntry ? 'cart' : 'quick-buy';
      var panel = doc.createElement('section'); panel.className = 'bn-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'bn-title');
      var head = doc.createElement('div'); head.className = 'bn-head';
      var heading = doc.createElement('h2'); heading.id = 'bn-title'; heading.textContent = title;
      var label = doc.createElement('small'); label.textContent = guest ? 'Guest checkout' : 'Secure checkout';
      var copy = doc.createElement('div'); copy.append(heading, label);
      head.append(copy, button(cartEntry ? 'Back to cart' : 'Cancel', function () { cancel().catch(showError); }, true));
      var message = doc.createElement('div'); message.className = 'bn-progress'; message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite');
      var spinner = doc.createElement('span'); spinner.className = 'bn-spinner'; spinner.setAttribute('aria-hidden','true');
      var statusText = doc.createElement('span'); statusText.dataset.bnStatus = ''; message.append(spinner,statusText);
      var body = doc.createElement('div'); body.className = 'bn-body'; body.dataset.bnBody = '';
      var stages = node('ol','','bn-stages'); stages.setAttribute('aria-label','Checkout progress');
      ['Items','Options','Payment','Review'].forEach(function (copy,index) { var step = node('li'); step.dataset.bnStep = String(index); step.append(node('span',String(index+1),'bn-step-dot'),node('span',copy)); stages.appendChild(step); });
      panel.append(head, message, stages, body); overlay.appendChild(panel); doc.body.appendChild(overlay); doc.body.style.overflow = 'hidden'; setStage(0);
      overlay.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') { event.preventDefault(); if (fast?.editor) closeEditor(); else cancel().catch(showError); }
        if (event.key !== 'Tab') return;
        var focusable = Array.from(panel.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select,iframe')).filter(function (el) { return !el.hidden && el.offsetParent && el.tabIndex >= 0 && el.getAttribute('aria-hidden') !== 'true'; });
        if (!focusable.length) return;
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
      });
      head.querySelector('button').focus();
      if (cartEntry) {
        var fallback = button('Use standard checkout',standardCheckout,true); fallback.classList.add('bn-standard'); fallback.dataset.bnStandard=''; fallback.disabled=true; body.after(fallback);
      }
    }
    function setStage(index) {
      if (!overlay) return;
      if (timings && timings.stages[index] === undefined) timings.stages[index] = Date.now()-timings.started;
      if (index < 4) fastText('[data-bn-confirm]',['Checking items…','Checking options…','Loading payment…','Checking final total…'][index]);
      overlay.querySelectorAll('[data-bn-step]').forEach(function (el,step) {
        el.dataset.state = step<index ? 'done' : step===index ? 'current' : 'next';
        if (step===index) el.setAttribute('aria-current','step'); else el.removeAttribute('aria-current');
        el.querySelector('.bn-step-dot').textContent = step<index ? '✓' : String(step+1);
      });
    }
    function showPreview(preview, quantity) {
      var body = overlay.querySelector('[data-bn-body]'), row = node('div','','bn-product'), photo = node('div'), copy = node('div'); photo.dataset.bnPhoto = '';
      if (preview?.photo) { var url = new URL(preview.photo,ORIGIN); if (url.protocol==='https:' || url.origin===ORIGIN) { var img = doc.createElement('img'); img.src=url.href; img.alt=''; photo.appendChild(img); } }
      copy.append(node('h3',preview?.name || 'Your item'),node('span',cartEntry ? 'All cart items' : 'Qty '+quantity)); row.append(photo,copy);
      var skeleton = node('div','','bn-skeletons'); skeleton.setAttribute('aria-hidden','true'); for (var i=0;i<5;i++) skeleton.appendChild(node('span'));
      body.replaceChildren(row,skeleton);
    }
    function showError(error) {
      measureCheckout('error');
      if (fast) { fast.ready = false; fast.stopped = true; }
      status(error && error.message || 'Buy now stopped. Your recovery copy is retained.', true);
      busy = false;
      if (active && !active.cartCheckout && !['submitting', 'uncertain'].includes(active.phase)) showRestoreButton();
      var receipt;
      try { receipt=readCartOrderReceipt(storage,cartOrderKey); } catch (_) { receipt={}; }
      if (overlay && receipt && receipt.phase!=='confirmed' && !overlay.querySelector('[data-bn-history]')) {
        var history=doc.createElement('a'); history.href='/AccountInfo_R.aspx'; history.target='_blank'; history.rel='noopener'; history.textContent='Open account and order history'; history.dataset.bnHistory=''; overlay.querySelector('[data-bn-body]').appendChild(history);
      }
      if (cartEntry && overlay && !receipt) { var fallback=overlay.querySelector('[data-bn-standard]'); if (fallback) fallback.disabled=false; }
    }
    function showRestoreButton() {
      if (!overlay || overlay.querySelector('[data-bn-restore]')) return;
      var restore = button(active?.cartCheckout ? 'Back to cart' : 'Restore my cart', function () { cancel().catch(showError); }, true);
      restore.dataset.bnRestore = ''; overlay.querySelector('[data-bn-body]').appendChild(restore);
    }
    async function withLock(work) {
      if (!win.navigator.locks) throw new Error('This browser cannot safely run the Quick buy. Use regular checkout.');
      return new Promise(function (resolve, reject) {
        win.navigator.locks.request(lockName, { ifAvailable: true }, async function (lock) {
          if (!lock) { reject(new Error('Buy now is already open in another tab. Finish or cancel there first.')); return; }
          var held = new Promise(function (release) { releaseLock = release; });
          try { await work(); resolve(); await held; } catch (error) { if (releaseLock) releaseLock(); releaseLock = null; reject(error); }
        }).catch(reject);
      });
    }
    function cartFromDocument(page) {
      if (!signedIn(page)) throw new Error('WebTrack sign-in expired. Sign back in before recovering your cart.');
      var rows = Array.from(page.querySelectorAll('.shopping-cart-item')).filter(function (row) {
        return !!row.querySelector('input.riTextBox,input[id*="_qty_"]:not([type="hidden"]),a[href*="pid="]');
      });
      if (!readableCart(page, rows.length)) {
        throw new Error('WebTrack did not return a readable cart. No further cart changes were made.');
      }
      var parsed = rows.map(function (row) {
        var link = row.querySelector('.cart-item-card h6 a[href*="pid="]') || Array.from(row.querySelectorAll('a[href]')).find(function (el) { return pidOf(el.getAttribute('href')) && text(el.textContent); }) || Array.from(row.querySelectorAll('a[href]')).find(function (el) { return pidOf(el.getAttribute('href')); });
        var quantity = row.querySelector('input.riTextBox,input[id*="_qty_"]:not([type="hidden"])');
        var code = row.querySelector('.portalGridLink,.cart-item-card h6 a') || link;
        var unitNode = row.querySelector('[data-title="Per"],[data-title="UOM"],.productPer,.unit-of-measure,.wl-qty-unit');
        var unitParent = quantity && quantity.closest('.float-right');
        var directUnit = unitParent ? text(Array.from(unitParent.childNodes).filter(function (node) { return node.nodeType === 3; }).map(function (node) { return node.textContent; }).join(' ')) : '';
        var unitMatch = text(row.textContent).match(/\b(?:Per|UOM|Unit)\s*:\s*([a-z][a-z0-9/.-]*)\b/i);
        var configured = Array.from(row.querySelectorAll('input[id$="_txtSpecialProductCode"],input[id$="_txtSpecialProductDescription"]')).some(function (el) { return text(el.value); });
        if (!link || !quantity || configured || /customized special order|cut to ship|configured product/i.test(row.textContent)) throw new Error('This cart contains a line that needs regular checkout with compact checkout.');
        var unit = text(row.getAttribute('data-wl-cart-unit') || (unitNode ? unitNode.textContent : directUnit || unitMatch && unitMatch[1]));
        if (!unit) throw new Error('The cart unit could not be verified. Please use regular checkout.');
        return { pid: pidOf(link.getAttribute('href')), code: text(code.textContent), quantity: Number(quantity.value), unit: unit, name: text(row.querySelector('.description,.ProductDescription,.cart-item-card p.small')?.textContent || code.textContent) };
      });
      return { doc: page, items: lines(parsed), rows: rows };
    }
    async function cart() { return cartFromDocument(await fetchDocument('/ShoppingCart.aspx')); }
    function formBody(page) {
      var form = page.querySelector('form');
      if (!form) throw new Error('The native WebTrack form is missing.');
      var data = new URLSearchParams();
      Array.from(form.elements).forEach(function (el) {
        var kind = String(el.type || '').toLowerCase();
        if (!el.name || el.disabled || ['submit', 'button', 'image', 'reset', 'file'].includes(kind) || (['checkbox', 'radio'].includes(kind) && !el.checked)) return;
        if (el.tagName === 'SELECT' && el.multiple) Array.from(el.selectedOptions).forEach(function (option) { data.append(el.name, option.value); });
        else data.append(el.name, el.value || '');
      });
      return { form: form, data: data };
    }
    async function nativePost(page, control, fallbackPath, adjust) {
      if (!control || control.disabled || control.getAttribute('aria-disabled') === 'true') throw new Error('The required native cart control is unavailable.');
      var body = formBody(page), target = targetOf(control.getAttribute('href') || control.getAttribute('onclick'));
      body.data.set('__EVENTTARGET', target); body.data.set('__EVENTARGUMENT', '');
      if (!target) {
        if (!control.name) throw new Error('The native cart action could not be identified.');
        body.data.set(control.name, control.value || '');
      }
      if (adjust) adjust(body.data);
      var action = new URL(body.form.getAttribute('action') || fallbackPath, ORIGIN + fallbackPath);
      if (action.origin !== ORIGIN || !/^\/(?:ShoppingCart|ProductDetail)\.aspx$/i.test(action.pathname)) throw new Error('An unexpected cart action was blocked.');
      return fetchDocument(action.href, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, body: body.data.toString() });
    }
    async function product(id) {
      if (blocked && blocked.has(id)) throw new Error('This item is not eligible for online purchase.');
      var page = await fetchDocument('/ProductDetail.aspx?pid=' + id);
      if (!signedIn(page)) throw new Error('Sign in again before using Buy now.');
      var add = page.querySelector('[id$="_AddProductButton"]');
      var quantity = page.querySelector('input[id$="_qty_' + id + '"]');
      var special = page.querySelector('input[id$="_txtSpecialProductCode"]');
      if (!add || !quantity || page.querySelector('[id$="_btnSpecialOrder"]') || special && text(special.value)) throw new Error('This product needs regular checkout with compact checkout.');
      var name = text(page.querySelector('.productDescriptionOnThisPageFull,#wl-product-title,h1,[id$="ProductName"]')?.textContent);
      var codeLine = Array.from(page.querySelectorAll('.formPageHeader')).map(function (el) { return text(el.textContent); }).find(function (value) { return /^Product Code:/i.test(value); });
      var code = text(codeLine).replace(/^Product Code:\s*/i, '');
      var unit = text(page.querySelector('.productPerSegment')?.textContent).toLowerCase();
      if (!code || !unit || /epallet|e-pallet|wdoor/i.test(code)) throw new Error('The native product code or unit could not be verified for Buy now.');
      var cuts;
      try { cuts = JSON.parse(win.sessionStorage.getItem('wl_cut_to_ship_v1') || '{}'); } catch (_) { throw new Error('Saved cut selections need regular checkout.'); }
      if (hasCustomCuts([{pid:id,code:code}],cuts)) throw new Error('Cut-to-ship selections need regular checkout with compact checkout.');
      return { doc: page, add: add, quantity: quantity, name: name, code: code, unit: unit };
    }
    async function preflight(items, known) {
      // Validate every original line before removing any line. Re-add must expose a native form.
      var index = 0;
      async function checkNext() {
        while (index < items.length) {
        var item = items[index++], info = known?.[item.pid] || await product(item.pid);
        if (info.name) item.name = info.name;
        if (info.code.toUpperCase() !== item.code.toUpperCase() || info.unit !== item.unit) throw new Error('A cart line differs from its standard product. Please use regular checkout.');
        var selectedUnit = info.doc.querySelector('select[id*="Per"],select[id*="UOM"],select[id*="Unit"]');
        if (selectedUnit || (item.unit && !/^(ea|each|pc|pcs|bag|box|pack|pair|roll|set|gal|lb)$/i.test(item.unit))) throw new Error('This cart uses a unit that has not been proven restorable. Please use regular checkout.');
        }
      }
      await Promise.all(Array.from({length:Math.min(items.length,4)},checkNext));
    }
    async function reconcile(wanted, revise, preparedProducts) {
      for (var count = 0; count < 180; count++) {
        if (revise) wanted = revise(wanted);
        var checks = await Promise.all([checkIdentity(),cart()]);
        var fresh = checks[1]; assertExpected(fresh.items, active);
        if (active.pending) { active.current = fresh.items; active.pending = null; save(); }
        if (revise) wanted = revise(wanted);
        var action = nextMutation(fresh.items, wanted,!!revise);
        if (!action) { active.current = fresh.items; save(); return; }
        var expected = afterMutation(fresh.items, wanted, action);
        active.pending = { before: signature(fresh.items), after: signature(expected) }; save();
        if (action.kind === 'add') {
          // The initial primary form is already preflighted. Use it once, after
          // fresh identity/cart checks, rather than requesting the same page again.
          var info = preparedProducts?.[action.pid];
          if (info) delete preparedProducts[action.pid]; else info = await product(action.pid);
          var reply = await nativePost(info.doc, info.add, '/ProductDetail.aspx?pid=' + action.pid, function (data) { data.set(info.quantity.name, String(action.quantity)); });
        } else {
          var index = fresh.items.findIndex(function (item) { return item.pid === action.pid; }), row = fresh.rows[index];
          var control = action.kind === 'remove'
            ? row.querySelector('a[id*="_del_"],a[id*="Delete"],a[href*="Delete"]') || row.querySelector('a i.fas.fa-times')?.parentElement
            : row.querySelector('a.refresh-cart-line-total');
          reply = await nativePost(fresh.doc, control, '/ShoppingCart.aspx', function (data) {
            if (action.kind !== 'quantity') return;
            var input = row.querySelector('input.riTextBox,input[id*="_qty_"]:not([type="hidden"])');
            data.set(input.name, String(action.quantity));
            var state = row.querySelector('input[id$="_ClientState"]');
            if (state && state.name) {
              var value = JSON.parse(state.value || '{}');
              value.validationText = String(action.quantity); value.valueAsString = String(action.quantity); value.lastSetTextBoxValue = String(action.quantity);
              data.set(state.name, JSON.stringify(value));
            }
          });
        }
        // Native cart POSTs often return the complete, updated basket already.
        // Verify that response; fetch again only when it is a product/other page.
        var after = reply.querySelector('#ctl00_PageBody_ShoppingCartDetailPanel,.ShoppingCartDetailPanel,#ctl00_PageBody_EmptyCartPanel,#ctl00_PageBody_EmptyCartDetailPanel') ? cartFromDocument(reply) : await cart();
        if (signature(after.items) !== signature(expected)) throw new Error('WebTrack did not confirm the requested cart change. Your recovery copy is retained.');
        active.current = after.items; active.pending = null; save();
        if (revise) wanted = revise(wanted);
        if (signature(after.items) === signature(wanted)) return;
      }
      throw new Error('Cart recovery stopped after too many changes. Your backup is retained.');
    }
    function restoreSession() {
      var sessionKey = PREFIX + 'session:' + active.id;
      var before = JSON.parse(win.sessionStorage.getItem(sessionKey) || '{}');
      Object.entries(before).forEach(function (entry) {
        if (entry[1] === null) win.sessionStorage.removeItem(entry[0]); else win.sessionStorage.setItem(entry[0], entry[1]);
      });
      win.sessionStorage.removeItem(sessionKey);
    }
    async function cancel() {
      if (submitting || active && ['submitting', 'uncertain'].includes(active.phase)) {
        status('The order result must be checked before restoring the cart. Do not submit the order again.', true); return;
      }
      if (busy) { cancelPending = true; status(cartEntry ? 'Returning to your cart…' : 'Finishing this change, then restoring your cart…'); return; }
      if (!active) { dismiss(); return; }
      if (fast?.editor) closeEditor();
      if (active.cartCheckout) { measureCheckout('cancel'); dismiss(); win.location.reload(); return; }
      busy = true; clearFrame();
      var wanted = recoveryTarget(active);
      active.phase = 'restoring'; save(); loading(true); status('Restoring your cart…');
      await reconcile(wanted); restoreSession(); storage.removeItem(key);
      var purchased = !!active.orderNumber; if (!purchased) measureCheckout('cancel');
      dismiss();
      if (/\/ShoppingCart\.aspx$/i.test(win.location.pathname)) win.location.reload();
      else notice(purchased ? 'Your remaining cart items are restored.' : 'Buy now cancelled. Your original cart is restored.');
    }
    function standardCheckout() {
      if (!cartEntry || submitting || busy || active && ['submitting','uncertain','confirmed'].includes(active.phase)) return;
      try { assertNoPendingCartOrder(); } catch (error) { showError(error); return; }
      dismiss();
      var native=doc.getElementById('ctl00_PageBody_PlaceOrderButton');
      if (native && !native.disabled) { bypassCartEntry=true; try { native.click(); } finally { bypassCartEntry=false; } }
    }
    function notice(message) {
      var el = doc.createElement('div'); el.className = 'bn-notice'; el.setAttribute('role', 'status'); el.textContent = message;
      el.appendChild(button('Dismiss', function () { el.remove(); }, true)); doc.body.appendChild(el);
    }
    function loading(value) {
      if (!overlay) return;
      overlay.classList.toggle('bn-loading', !!value);
      overlay.classList.toggle('bn-ready',!value && !!fast?.ready);
      overlay.querySelector('.bn-panel').setAttribute('aria-busy', value && !fast?.editor ? 'true' : 'false');
      if (fast) {
        fast.loading = !!value;
        var standard=overlay.querySelector('[data-bn-standard]'); if (standard) standard.disabled=submitting || busy || active && ['submitting','uncertain','confirmed'].includes(active.phase);
        overlay.querySelectorAll('[data-bn-edit],[data-bn-method]').forEach(function (el) {
          if (el.hasAttribute('data-bn-method')) el.disabled = submitting || !!fast.editor || !(fast.methods[el.dataset.bnMethod]?.available || fast.methods[el.dataset.bnMethod]?.pending);
          else if (el.dataset.bnEdit === 'extras') el.disabled = submitting || !!fast.editor;
          else el.disabled = submitting || !!fast.editor || !editableFast(el.dataset.bnEdit);
        });
        var confirm = overlay.querySelector('[data-bn-confirm]');
        if (confirm) confirm.disabled = !!value || !(fast.ready || fast.paymentQuote) || !!fast.editor;
      }
    }
    function node(tag, copy, className) {
      var el = doc.createElement(tag); if (copy) el.textContent = copy; if (className) el.className = className; return el;
    }
    function fastText(selector, copy) {
      var el = overlay?.querySelector(selector); if (el && el.textContent !== copy) el.textContent = copy;
    }
    function renderFast(info, primary, before) {
      var body = overlay.querySelector('[data-bn-body]');
      overlay.dataset.bnOptionsReadyMs=String(Date.now()-fast.opened);
      body.innerHTML = '<div class="bn-product"><div data-bn-photo></div><div><h3 data-bn-product></h3><span data-bn-qty></span></div></div>' +
        '<div class="bn-methods" role="group" aria-label="Fulfillment">' +
        '<button type="button" data-bn-method="pickup"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10h18M4 10v11h16V10M3 10l2-7h14l2 7M9 21v-7h6v7"/></svg><strong>Pickup</strong><small data-bn-rate="pickup">Checking…</small></button>' +
        '<button type="button" data-bn-method="delivery"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 5h12v12H2zM14 9h4l4 5v3h-8M7 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM21 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/></svg><strong>Delivery</strong><small data-bn-rate="delivery">Checking…</small></button>' +
        '<button type="button" data-bn-method="ship"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 9-4 9 4v12l-9 4-9-4zM3 6l9 4 9-4M12 10v12M7 4l10 4"/></svg><strong>Ship</strong><small data-bn-rate="ship">Checking…</small></button></div>' +
        '<div class="bn-options">' +
        '<div class="bn-option"><span class="bn-option-icon">⌖</span><div><strong data-bn-address-title>Deliver to</strong><span data-bn-address>Choose an address</span></div><button type="button" data-bn-edit="address">Change</button></div>' +
        '<div class="bn-option"><span class="bn-option-icon">◷</span><div><strong data-bn-timing-title>When</strong><span data-bn-timing>Earliest available</span></div><button type="button" data-bn-edit="timing">Change</button></div>' +
        '<div class="bn-option"><span class="bn-option-icon">▤</span><div><strong>Payment</strong><span data-bn-payment>Saved payment</span></div><button type="button" data-bn-edit="payment">Change</button></div></div>' +
        '<button type="button" class="bn-extras" data-bn-edit="extras"><span data-bn-extras></span><span>＋</span></button>' +
        '<button type="button" class="bn-more" data-bn-edit="notes">Order notes & billing</button>' +
        '<div data-bn-editor hidden></div><div class="bn-totals"><div><span>Items</span><span data-bn-subtotal>—</span></div><div><span data-bn-shipping-label>Delivery</span><span data-bn-shipping>—</span></div><div><span>Tax</span><span data-bn-tax>—</span></div><div class="bn-grand"><strong>Order total</strong><strong data-bn-total>—</strong></div></div>' +
        '<button type="button" class="bn-action bn-confirm" data-bn-confirm disabled>Preparing your order…</button>' +
        '<p class="bn-terms">By placing your order, you agree to <a href="/TermsAndConditions.aspx" target="_blank" rel="noopener">Woodson’s terms</a>.</p><div data-bn-native-host></div>';
      fastText('[data-bn-product]', info.name || primary.code);
      overlay.querySelector('.bn-footer')?.remove();
      var footer = node('div','','bn-footer');
      ['.bn-totals','[data-bn-confirm]','.bn-terms'].forEach(function (selector) { footer.appendChild(body.querySelector(selector)); });
      body.after(footer);
      var editor=body.querySelector('[data-bn-editor]'); editor.className='bn-editor-workspace'; footer.before(editor);
      var nativeHost=body.querySelector('[data-bn-native-host]'); nativeHost.className='bn-native-workspace'; footer.before(nativeHost);
      var nativeHead=node('div','','bn-workspace-head'); nativeHead.append(node('h3','Secure payment'),button('Order options',function () { fast.paymentOptionsOpen=true; paymentWorkspace(false); },true)); nativeHost.appendChild(nativeHead);
      fastText('[data-bn-qty]', 'Qty ' + primary.quantity + ' · ' + primary.unit);
      fastText('[data-bn-extras]', before.length ? 'Also in your cart (' + before.length + ')' : 'No other cart items');
      if (fast.cartCheckout) {
        fastText('[data-bn-product]','Your cart');
        fastText('[data-bn-qty]',before.length+' product'+(before.length===1?'':'s')+' · '+before.reduce(function (count,item) { return count+item.quantity; },0)+' item'+(before.reduce(function (count,item) { return count+item.quantity; },0)===1?'':'s'));
        body.querySelector('[data-bn-edit="extras"]').remove();
        var contents=node('details','','bn-cart-items'), summary=node('summary','View items · '+before.length+' product'+(before.length===1?'':'s')+' · '+before.reduce(function (count,item) { return count+item.quantity; },0)+' item'+(before.reduce(function (count,item) { return count+item.quantity; },0)===1?'':'s')); contents.appendChild(summary);
        before.forEach(function (item) { var line=node('div','','bn-cart-line'); line.append(node('span',item.name || item.code),node('strong','Qty '+item.quantity+' · '+item.unit)); contents.appendChild(line); });
        body.querySelector('.bn-product').after(contents);
        body.querySelector('.bn-product').hidden=true;
      }
      var photo = info.doc?.querySelector('img[id$="_ProductImage"],.product-image-wrapper img');
      if (photo?.getAttribute('src')) {
        var url = new URL(photo.getAttribute('src'), ORIGIN);
        if (url.protocol === 'https:' || url.origin === ORIGIN) {
          var img = doc.createElement('img'); img.src = url.href; img.alt = ''; overlay.querySelector('[data-bn-photo]').appendChild(img);
        }
      }
      body.querySelectorAll('[data-bn-method]').forEach(function (el) {
        el.addEventListener('click', function () { var option = fast.methods[el.dataset.bnMethod]; if (submitting || fast.editor || fast.method === el.dataset.bnMethod || !(option?.available || option?.pending)) return; fast.method = el.dataset.bnMethod; fast.date = ''; fast.pickupTime=''; fast.shippingValue = ''; updatePickupReadiness(); updateFastOptions(); requestFastUpdate(); });
      });
      body.querySelectorAll('[data-bn-edit]').forEach(function (el) { el.addEventListener('click', function () { editFast(el.dataset.bnEdit); }); });
      overlay.querySelector('[data-bn-confirm]').addEventListener('click', function () {
        if (fast?.paymentQuote && !fast.loading && !fast.editor) { acceptPaymentTotal().catch(showError); return; }
        if (!fast?.ready || fast.loading || fast.editor || !frame?.contentDocument) return;
        submitNative(frame.contentDocument.getElementById('ctl00_PageBody_CompleteCheckoutButton'), frame.contentDocument).catch(showError);
      });
      loading(true);
    }
    var pickupStockCache=new Map();
    function newFast(options) {
      var stores=Array.from(settings.getElementById('ctl00_PageBody_ChangeUserDetailsControl_ddBranch')?.options || []).filter(function (option) { return option.value && pickupStoreName(option.textContent); }).map(function (option) { return {value:option.value,label:text(option.textContent)}; });
      var now=centralCalendar(new Date());
      return Object.assign({cartCheckout:false,original:[],primary:null,selected:[],address:accountAddress(),billing:guest ? Object.assign({},guest.billing) : null,method:'',store:branch,stores:stores,methods:{pickup:{pending:true},delivery:{pending:true},ship:{pending:true}},date:'',dateMin:calendarAfter(now.date,2,false),dateMax:calendarAfter(now.date,14,false),window:'Afternoon',ready:false,payments:[],revision:0,driving:false,editor:'',started:Date.now(),opened:Date.now()},options);
    }
    function proposedItems() { return fast?.cartCheckout ? active?.purchase || [] : fast?.primary ? plan(fast.original,fast.primary,fast.selected).purchase : []; }
    function requestFastUpdate() {
      if (!fast || submitting) return;
      updatePickupReadiness(); updateFastOptions();
      warmPickupStock(proposedItems());
      if (busy || !active || !frame) { fast.refreshQueued=true; return; }
      var entry;
      try { entry=frame.contentDocument; } catch (_) {}
      var sameBasket=active.cartCheckout || signature(proposedItems())===signature(active.purchase);
      if (!fast.ready && !fast.stopped && !fast.securePayment && sameBasket && entry && (entry.URL==='about:blank' || entry.getElementById('ctl00_PageBody_PlaceOrderButton'))) {
        // Native details have not been applied yet. Keep the in-flight entry
        // request; its next page will use these latest choices directly.
        seedSession(); return;
      }
      refreshFast().catch(showError);
    }
    function editableFast(kind) {
      if (!fast || submitting) return false;
      if (kind==='extras') return !fast.cartCheckout;
      if (kind==='address') return fast.method!=='pickup' || !!fast.stores?.length;
      if (kind==='timing') return fast.method==='pickup' || fast.method==='delivery' || fast.method==='ship' && !!fast.shippingOptions?.length;
      return kind==='payment' || kind==='notes';
    }
    function paymentWorkspace(open) {
      if (!overlay || !frame) return;
      overlay.querySelector('.bn-panel').classList.toggle('bn-secure-payment',!!open);
      frame.classList.toggle('bn-frame-open',!!open);
      if (open) { frame.removeAttribute('aria-hidden'); frame.removeAttribute('tabindex'); }
      else { frame.setAttribute('aria-hidden','true'); frame.setAttribute('tabindex','-1'); }
    }
    function paymentPricingScope() {
      return JSON.stringify([fast.revision,signature(active.current),fast.method,fast.shippingValue || '']);
    }
    function cachePaymentTotal(page) {
      try {
        var service=(fast.shippingOptions || []).find(function (option) { return option.value===fast.shippingValue; });
        var expected=quotedShipping(fast.method,fast.methods[fast.method],service,service && service===fast.shippingOptions[0]);
        fast.paymentPricing={scope:paymentPricingScope(),totals:paymentTotals(page,fast.method,expected)};
      } catch (_) { fast.paymentPricing=null; }
    }
    function readPaymentTotal(page) {
      // WebTrack removes the summary when it opens hosted payment. Retain only
      // the native shipping-step totals for this exact basket/options revision.
      if (page.getElementById('ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView') || page.querySelector('table.summaryTotals')) cachePaymentTotal(page);
      var pricing=fast.paymentPricing;
      if (!pricing || pricing.scope!==paymentPricingScope()) throw new Error('The order total is still being confirmed.');
      return {totals:pricing.totals,signature:JSON.stringify([pricing.scope,pricing.totals])};
    }
    function paymentTotalGate(page) {
      // A customer without a saved card sees the native priced order before the
      // secure card form. This state never enables final order submission.
      var quote;
      try { quote=readPaymentTotal(page); } catch (error) {
        fast.paymentQuote=null; paymentWorkspace(false); loading(true); status('Confirming shipping and tax…');
        if (!page.documentElement.dataset.bnTotalWaiting) page.documentElement.dataset.bnTotalWaiting=String(Date.now());
        if (Date.now()-Number(page.documentElement.dataset.bnTotalWaiting)>5000) haltFast('Your total could not be confirmed before payment. Please use standard checkout.');
        return false;
      }
      delete page.documentElement.dataset.bnTotalWaiting;
      if (fast.paymentApproval===quote.signature) return true;
      fast.paymentQuote=quote; fast.ready=false; paymentWorkspace(false);
      ['subtotal','shipping','tax','total'].forEach(function (key) { fastText('[data-bn-'+key+']',quote.totals[key]); });
      fastText('[data-bn-payment]','Add after reviewing total');
      fastText('[data-bn-confirm]','Continue to payment · '+quote.totals.total);
      loading(false); status('Review your total, then add payment securely.');
      return false;
    }
    async function acceptPaymentTotal() {
      var current=fast, page=frame?.contentDocument, quote=fast?.paymentQuote;
      if (!quote || !page || !nativeFormsReady(frame.contentWindow) || busy || submitting || fast.paymentAuthorizing) return;
      fast.paymentAuthorizing=true; loading(true);
      try {
        await checkIdentity();
        if (fast!==current || frame?.contentDocument!==page || fast.editor || fast.paymentQuote?.signature!==quote.signature) return;
        var fresh=readPaymentTotal(page);
        if (fresh.signature!==quote.signature) { fast.paymentApproval=null; paymentTotalGate(page); status('Your total changed. Review it before continuing.'); return; }
        fast.paymentApproval=fresh.signature; fast.paymentQuote=null;
        status('Opening secure payment…');
      } finally { current.paymentAuthorizing=false; }
      if (fast===current && fast.paymentApproval===quote.signature) await driveFast(frame.contentWindow,page);
    }
    function pickupNotice(policy) {
      if (!policy) return 'Choose a pickup store to check availability.';
      if (policy.checking) return 'Checking stock at '+(policy.store || 'your store')+'…';
      if (policy.items.some(function (row) { return row.state==='supplier'; })) return 'Supplier order · allow at least 7 business days. The store will confirm availability and timing.';
      if (policy.items.some(function (row) { return row.state==='unconfirmed'; })) return 'Stock needs confirmation. Allow at least 3 business days; wait for the store to confirm your order is ready.';
      if (policy.items.some(function (row) { return row.state==='transfer'; })) return 'Store transfer · allow 3 business days. Wait for your ready-for-pickup confirmation.';
      return 'In stock at '+policy.store+' · pickup times allow 2 hours to prepare.';
    }
    function pickupInstruction() {
      var policy=fast.pickupReadiness;
      if (!policy || policy.checking) return '';
      var delayed=policy.items.filter(function (row) { return row.state!=='local'; });
      return delayed.length ? 'PICKUP TOGETHER '+fast.date+'; '+delayed.map(function (row) { return row.code+' qty '+row.quantity+': '+(row.state==='transfer'?'store transfer (3 business days)':row.state==='supplier'?'supplier order; timing requires store confirmation':'availability requires store confirmation'); }).join('; ') : '';
    }
    function updatePickupReadiness() {
      if (!fast || fast.method!=='pickup') return;
      var items=proposedItems();
      if (!items.length) return;
      var store=(fast.stores || []).find(function (option) { return option.value===fast.store; });
      var stocks={}; items.forEach(function (item) { stocks[item.pid]=pickupStockCache.get(item.pid)?.result; });
      var policy=pickupReadiness(items,stocks,store?.label,new Date()); fast.pickupReadiness=policy; fast.dateMin=policy.min; fast.dateMax=policy.max;
      if (!overlay) return;
      var notice=overlay.querySelector('[data-bn-pickup-notice]');
      if (!notice) { notice=node('p','','bn-pickup-notice'); notice.dataset.bnPickupNotice=''; notice.setAttribute('role','status'); overlay.querySelector('.bn-options')?.after(notice); }
      notice.textContent=pickupNotice(policy); notice.hidden=false;
      var detail=overlay.querySelector('[data-bn-pickup-items]');
      if (!detail) { detail=node('details','','bn-pickup-items'); detail.dataset.bnPickupItems=''; notice.after(detail); }
      var policyKey=JSON.stringify(policy.items);
      if (detail.dataset.policy!==policyKey) {
        detail.dataset.policy=policyKey; detail.replaceChildren(node('summary','Availability by item · '+items.length));
        policy.items.forEach(function (row) { var line=node('div','','bn-pickup-line'); line.append(node('span',row.name || row.code),node('strong',row.state==='local'?'At this store':row.state==='transfer'?'Transfer · '+row.min:row.state==='checking'?'Checking…':'Store confirmation needed')); detail.appendChild(line); });
      }
      detail.hidden=false;
      var input=overlay.querySelector('[data-bn-editor] input[aria-label="Pickup date"]');
      if (input) { input.min=policy.min; input.max=policy.max; var hint=overlay.querySelector('[data-bn-editor] .bn-pickup-notice'); if (hint) hint.textContent=pickupNotice(policy); }
    }
    function warmPickupStock(items) {
      var pending=items.filter(function (item) { return !pickupStockCache.has(item.pid) || Date.now()-pickupStockCache.get(item.pid).at>120000; });
      pending.forEach(function (item,index) { pickupStockCache.set(item.pid,{at:Date.now(),result:index<12 ? undefined : null}); });
      var next=0, requested=pending.slice(0,12);
      async function worker() {
        for (;next<requested.length;) {
          var item=requested[next++], result=null;
          try { result=stockFromDocument(await fetchDocument('/Catalog/ShowStock.aspx?productid='+encodeURIComponent(item.pid),{credentials:'omit'},7000)); } catch (_) {}
          pickupStockCache.set(item.pid,{at:Date.now(),result:result});
          if (fast && overlay) {
            var previousDate=fast.date; updatePickupReadiness();
            if (fast.method==='pickup' && previousDate && fast.pickupReadiness && previousDate<fast.pickupReadiness.min && fast.ready) { fast.date=''; fast.pickupTime=''; requestFastUpdate(); }
          }
        }
      }
      Promise.all(Array.from({length:Math.min(4,requested.length)},worker)).catch(function () {});
    }
    function field(form, label, value, type, options) {
      var wrap = node('label', label), input = doc.createElement(options ? 'select' : type === 'textarea' ? 'textarea' : 'input');
      if (!options && type !== 'textarea') input.type = type || 'text';
      input.setAttribute('aria-label',label);
      if (options) options.forEach(function (option) { var el = node('option', option.label); el.value = option.value; input.appendChild(el); });
      input.value = value || (options?.[0]?.value || ''); wrap.appendChild(input); form.appendChild(wrap); return input;
    }
    function editFast(kind) {
      if (!fast || submitting || fast.editor || !editableFast(kind)) return;
      var host = overlay.querySelector('[data-bn-editor]'); host.replaceChildren(); host.hidden = false; fast.editor = kind; fast.editorTrigger=doc.activeElement; overlay.querySelector('.bn-panel').classList.add('bn-editing'); loading(fast.loading);
      var titles = {address:fast.method === 'pickup' ? 'Pickup store' : 'Delivery address',timing:'Schedule',payment:'Payment',extras:'Add from your cart',notes:'Order details'};
      var heading=node('div','','bn-workspace-head'); heading.append(node('h3',titles[kind]),button('Back to order',closeEditor,true)); host.appendChild(heading);
      var form = doc.createElement('form'), values = {}, action = null; form.className='bn-editor-form'; host.appendChild(form);
      var fields=node('div','','bn-editor-fields'); form.appendChild(fields);
      var error=node('p','','bn-editor-error'); error.setAttribute('role','alert'); fields.appendChild(error);
      if (kind === 'address' && fast.method === 'pickup') {
        values.store = field(fields, 'Pickup store', fast.store, 'text', fast.stores || []);
      } else if (kind === 'address') {
        var address = fast.address || {};
        [['line1','Street'],['line2','Apt / suite'],['city','City'],['stateValue','State'],['zip','ZIP'],['contactName','Contact'],['phone','Phone'],['email','Email']].forEach(function (entry) {
          values[entry[0]] = field(fields, entry[1], address[entry[0]], entry[0] === 'email' ? 'email' : 'text');
          if (['line1','city','stateValue','zip','contactName','phone','email'].includes(entry[0])) values[entry[0]].required = true;
        });
      } else if (kind === 'timing') {
        values.date = field(fields, fast.method === 'pickup' ? 'Pickup date' : 'Delivery date', fast.date, 'date');
        values.date.min = fast.dateMin || ''; values.date.max = fast.dateMax || '';
        values.date.value=fast.date || firstDate(values.date.min,values.date.max);
        if (fast.method==='pickup') {
          var note=node('p',pickupNotice(fast.pickupReadiness),'bn-pickup-notice'); fields.appendChild(note);
          values.date.addEventListener('change',function () { values.time.replaceChildren(); pickupTimeChoices(values.date.value,new Date()).forEach(function (option) { var el=node('option',option.label); el.value=option.value; values.time.appendChild(el); }); });
        }
        if (fast.method === 'pickup') {
          values.time = field(fields, 'Pickup time', fast.pickupTime || pickupTimeChoices(values.date.value,new Date())[0]?.value, 'text', pickupTimeChoices(values.date.value,new Date()));
          values.person = field(fields, 'Pickup person', fast.pickupPerson || fast.address?.contactName);
          values.person.required = true;
        } else if (fast.method === 'delivery') {
          values.window = field(fields, 'Delivery window', fast.window, 'text', [{value:'Morning',label:'Morning'},{value:'Afternoon',label:'Afternoon'}]);
        } else {
          values.date.closest('label').hidden = true;
          values.shipping = field(fields, 'UPS service', fast.shippingValue, 'text', fast.shippingOptions || []);
        }
      } else if (kind === 'payment') {
        values.payment = field(fields, 'Saved payment', fast.paymentFingerprint, 'text', (fast.payments || []).map(function (option) { return {value:option.fingerprint,label:option.label}; }));
        var rememberLabel = node('label', '', 'bn-check'); values.remember = doc.createElement('input'); values.remember.type = 'checkbox'; values.remember.checked = !!storage.getItem(preferenceKey); rememberLabel.append(values.remember, doc.createTextNode(' Remember on this browser')); fields.appendChild(rememberLabel);
        if (guest) rememberLabel.hidden=true;
        if (!fast.payments?.length) { values.payment.closest('label').hidden=true; values.remember.checked=false; fields.appendChild(node('p',fast.securePayment ? 'Your card details stay in WebTrack’s secure payment form.' : 'Saved payment options are still being checked. You can choose a new card now.')); }
        action = button(fast.securePayment ? 'Continue secure payment' : 'Use a new card', function () { if (fast.securePayment && frame) { closeEditor(); fast.paymentOptionsOpen=false; paymentWorkspace(true); } else { fast.addPayment = true; closeEditor(); requestFastUpdate(); } }, true); fields.appendChild(action);
      } else if (kind === 'extras') {
        fast.original.forEach(function (item) {
          var label = node('label', '', 'bn-check'), check = doc.createElement('input'); check.type = 'checkbox'; check.value = item.pid; check.checked = fast.selected.includes(item.pid);
          label.append(check, doc.createTextNode((item.name || item.code) + ' · Qty ' + item.quantity)); fields.appendChild(label);
        });
        if (!fast.original.length) fields.appendChild(node('p','No other cart items.'));
      } else if (kind === 'notes') {
        values.reference = field(fields, 'PO / reference', fast.reference);
        values.notes = field(fields, 'Order notes', fast.notes, 'textarea');
        var billing = button('Change billing address', function () { editBilling(fields); }, true); fields.appendChild(billing);
      }
      var actions = node('div', '', 'bn-editor-actions'), saveButton = node('button','Apply','bn-action'); saveButton.type = 'submit';
      saveButton.disabled=kind==='payment' && !fast.payments?.length;
      actions.append(saveButton, button('Cancel', closeEditor, true)); form.appendChild(actions);
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!form.reportValidity()) return;
        if (kind === 'address' && fast.method === 'pickup') { fast.store = values.store.value; fast.date=''; fast.pickupTime=''; updatePickupReadiness(); }
        else if (kind === 'address') {
          fast.address = Object.assign({}, fast.address, Object.fromEntries(Object.entries(values).map(function (entry) { return [entry[0],text(entry[1].value)]; })));
          fast.address.stateValue = fast.address.stateValue.toUpperCase(); fast.address.stateText = fast.address.stateValue;
          fast.addressChanged = true; fast.method = ''; fast.date = '';
        } else if (kind === 'timing') {
          updatePickupReadiness();
          var minimum=fast.method==='pickup' ? fast.pickupReadiness?.min || values.date.min : values.date.min;
          values.date.min=minimum;
          if (fast.method !== 'ship' && !dateChoice(values.date.value,minimum,values.date.max)) { error.textContent=fast.method==='pickup' ? pickupNotice(fast.pickupReadiness)+' Choose a date on or after '+minimum+'.' : 'Choose a Monday–Saturday date in the available range.'; values.date.focus(); return; }
          if (fast.method==='pickup' && !pickupTimeChoices(values.date.value,new Date()).some(function (option) { return option.value===values.time.value; })) { error.textContent='Choose an available pickup time at least two hours from now.'; return; }
          fast.date = values.date.value; if (values.time) fast.pickupTime = values.time.value; if (values.person) fast.pickupPerson = values.person.value; if (values.window) fast.window = values.window.value; if (values.shipping) fast.shippingValue = values.shipping.value;
        } else if (kind === 'payment') {
          fast.paymentFingerprint = values.payment.value;
          if (!guest && values.remember.checked) storage.setItem(preferenceKey,fast.paymentFingerprint); else storage.removeItem(preferenceKey);
        } else if (kind === 'extras') fast.selected = Array.from(form.querySelectorAll('input:checked')).map(function (el) { return el.value; });
        else if (kind === 'notes') {
          fast.reference = values.reference.value; fast.notes = values.notes.value;
          if (fast.billingInputs) { fast.billing = {}; Object.entries(fast.billingInputs).forEach(function (entry) { fast.billing[entry[0]] = entry[1].value; }); }
        }
        closeEditor(); requestFastUpdate();
      });
      fields.querySelector('input,select,textarea')?.focus();
    }
    function editBilling(form) {
      if (fast.billingInputs) return;
      var address = fast.billing || fast.address || {}; fast.billingInputs = {};
      form.appendChild(node('h4','Billing address'));
      [['line1','Street'],['line2','Apt / suite'],['city','City'],['stateValue','State'],['zip','ZIP']].forEach(function (entry) { var input = field(form,entry[1],address[entry[0]]); input.required = entry[0] !== 'line2'; fast.billingInputs[entry[0]] = input; });
    }
    function closeEditor() {
      if (!fast || !overlay) return;
      fast.editor = ''; fast.billingInputs = null; overlay.querySelector('.bn-panel').classList.remove('bn-editing');
      var host = overlay.querySelector('[data-bn-editor]'); host.hidden = true; host.replaceChildren(); loading(fast.loading); if (fast.editorTrigger?.isConnected) fast.editorTrigger.focus();
    }

    function seedSession() {
      SESSION_KEYS.forEach(function (name) { win.sessionStorage.removeItem(name); });
      win.sessionStorage.setItem('wl_checkout_single_page_preview','1');
      if (fast.method === 'pickup') {
        win.sessionStorage.setItem('wl_fulfillment_intent','pickup');
        win.sessionStorage.setItem('wl_fulfillment_method','pickup');
        win.sessionStorage.setItem('wl_fulfillment_selection_source_v1','user');
      }
      if (fast.address) win.sessionStorage.setItem('wl_checkout_address_payload', JSON.stringify(Object.assign({},fast.address,{ts:Date.now()})));
    }
    function revisePurchase(wanted) {
      if (!fast.refreshQueued) return wanted;
      fast.refreshQueued = false;
      var planned = plan(fast.original,fast.primary,fast.selected);
      active.purchase = planned.purchase; active.remaining = planned.remaining; active.extraCount = fast.selected.length; save();
      fastText('[data-bn-extras]',fast.selected.length ? fast.selected.length+' cart item'+(fast.selected.length===1?'':'s')+' included' : 'Also in your cart ('+fast.original.length+')');
      return planned.purchase;
    }
    function accountAddress() {
      if (guest) return Object.assign({},guest.address);
      var address = mainAddress(Array.from(account.querySelectorAll('.accountInfoAddress li')).map(function (el) { return el.textContent; }));
      if (address) {
        address.contactName = [text(settings.getElementById('ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput')?.value),text(settings.getElementById('ctl00_PageBody_ChangeUserDetailsControl_LastNameInput')?.value)].filter(Boolean).join(' ');
        address.email = text(settings.getElementById('ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput')?.value);
        address.phone = text(account.getElementById('ctl00_PageBody_TelephoneLink_TelephoneLink')?.textContent);
      }
      return address;
    }
    async function start(id, quantity, preview) {
      if (!ENABLE_NEW_STARTS || guest || overlay || busy) return;
      await withLock(async function () {
        var opened = Date.now();
        timings = {started:opened,requests:{},stages:{}};
        shell('Quick buy'); showPreview(preview,quantity); loading(true); status('Preparing your items…'); busy = true;
        try { win.WLAnalytics?.track('quick_buy_open',{checkout_flow:'quick_buy',customer_type:'signed_in',ecommerce:{currency:'USD',items:[{item_id:String(id),quantity:Number(quantity)}]}}); } catch (_) {}
        if (record()) throw new Error('Restore your earlier Buy now cart first.');
        assertNoPendingCartOrder();
        // These are read-only preflights. All must succeed before saving a draft
        // or changing the basket; reconcile still checks fresh identity/cart.
        var details = await Promise.all([cart(),product(id),checkIdentity(),purchaseRestrictions().then(function (ids) { blocked = ids; })]);
        if (blocked.has(id)) throw new Error('This item is not eligible for online purchase.');
        var before = details[0], info = details[1];
        var primary = {pid:id,quantity:quantity,name:info.name,code:info.code,unit:info.unit};
        fast=newFast({original:before.items,primary:primary,method:productMethod(doc),opened:opened});
        if (cancelPending) { busy = false; cancelPending = false; dismiss(); return; }
        renderFast(info,primary,before.items);
        updatePickupReadiness(); updateFastOptions(); warmPickupStock([primary]);
        await preflight(before.items.concat(before.items.some(function (item) { return item.pid === id; }) ? [] : [primary]),{[id]:info});
        var planned = plan(before.items,primary,fast.selected), sessionBefore = {};
        SESSION_KEYS.forEach(function (name) { sessionBefore[name] = win.sessionStorage.getItem(name); });
        var draft = {version:1,scope:scope,branch:branch,id:'BN-'+win.crypto.randomUUID(),owner:owner,phase:'backed_up',createdAt:Date.now(),original:planned.original,purchase:planned.purchase,remaining:planned.remaining,current:before.items,pending:null,extraCount:0};
        win.sessionStorage.setItem(PREFIX+'session:'+draft.id,JSON.stringify(sessionBefore)); persist(storage,key,draft); active = draft;
        seedSession(); active.phase = 'preparing'; save();
        await reconcile(planned.purchase,revisePurchase,{[id]:info}); active.phase = 'checking_out'; save(); seedSession(); busy = false; measureCheckout('begin');
        if (cancelPending) { cancelPending = false; await cancel(); return; }
        if (fast.refreshQueued) { fast.refreshQueued = false; await refreshFast(); return; }
        openFrame(overlay.querySelector('[data-bn-native-host]'));
      });
    }
    async function startCart() {
      if (!ENABLE_CART_CHECKOUT || overlay || busy) return;
      await withLock(async function () {
        cartEntry=true; busy=true;
        var opened=Date.now(); timings={started:opened,requests:{},stages:{}};
        shell('Checkout'); showPreview({name:'Your cart'},'—'); loading(true); status('Checking your cart…');
        if (record()) throw new Error('Finish or restore your earlier Quick buy cart before checkout.');
        assertNoPendingCartOrder();
        var visible=cartFromDocument(doc);
        if (!visible.items.length) throw new Error('Your cart is empty.');
        var method=win.sessionStorage.getItem('wl_fulfillment_intent');
        if (win.sessionStorage.getItem('wl_fulfillment_selection_source_v1')!=='user' || !['pickup','delivery','ship'].includes(method)) method='';
        fast=newFast({cartCheckout:true,method:method,opened:opened});
        active={cartCheckout:true,guestCheckout:!!guest,scope:scope,branch:branch,id:'CC-'+win.crypto.randomUUID(),owner:owner,phase:'checking_out',createdAt:opened,purchase:visible.items,current:visible.items};
        renderFast({name:'Your cart',doc:doc},visible.items[0],visible.items); updatePickupReadiness(); updateFastOptions(); status('Choose your options while we prepare checkout.');
        seedSession(); warmPickupStock(visible.items); openFrame(overlay.querySelector('[data-bn-native-host]'));
        // Read/compare only. Cart checkout never adds, removes or restores lines.
        var checks=await Promise.all([cart(),checkIdentity(),purchaseRestrictions()]);
        var before=checks[0]; blocked=checks[2];
        if (!before.items.length) throw new Error('Your cart is empty.');
        var cuts;
        try { cuts=JSON.parse(win.sessionStorage.getItem('wl_cut_to_ship_v1') || '{}'); } catch (_) { throw new Error('Saved cut selections need standard checkout.'); }
        if (hasCustomCuts(before.items,cuts)) throw new Error('Custom cutting needs standard checkout with compact checkout.');
        if (signature(before.items)!==signature(visible.items)) throw new Error('Update your cart quantities or refresh the cart before checkout.');
        if (before.items.some(function (item) { return blocked.has(item.pid); })) throw new Error('This cart needs standard checkout. Review its product restrictions first.');
        if (cancelPending) { dismiss(); return; }
        active.purchase=before.items; active.current=before.items; fast.refreshQueued=false;
        seedSession(); busy=false; loading(true); measureCheckout('begin');
        if (frame?.contentDocument) driveFast(frame.contentWindow,frame.contentDocument).catch(showError);
      });
    }
    function bindCartEntry() {
      if (!ENABLE_CART_CHECKOUT || !win.navigator.locks || !/\/ShoppingCart\.aspx$/i.test(win.location.pathname)) return;
      doc.documentElement.dataset.wlCompactCartCheckout=BUILD;
      win.addEventListener('click',function (event) {
        var control=event.target?.closest?.('#ctl00_PageBody_PlaceOrderButton');
        if (bypassCartEntry || !control || control.disabled || control.getAttribute('aria-disabled')==='true' || !doc.querySelector('.shopping-cart-item')) return;
        event.preventDefault(); event.stopImmediatePropagation();
        startCart().catch(function (error) { if (overlay) showError(error); else notice(error.message); });
      },true);
    }
    async function refreshFast() {
      if (!fast || submitting) return;
      if (busy) { fast.refreshQueued = true; return; }
      var detailPage=frame?.contentDocument, reuse=detailPage && detailPage.getElementById('btnPickup') && !detailPage.documentElement.dataset.bnDetailsContinued && !frame.contentWindow.Sys?.WebForms?.PageRequestManager?.getInstance?.()?.get_isInAsyncPostBack?.();
      var previousMethod=detailPage?.documentElement.dataset.bnMethod;
      if (reuse && previousMethod) reuse=fulfillmentApplied(previousMethod,frame.contentWindow.sessionStorage.getItem('wl_fulfillment_intent'),detailPage.getElementById({pickup:'btnPickup',delivery:'btnDelivered',ship:'btnShip'}[previousMethod])?.getAttribute('aria-pressed'));
      if (reuse && !active.cartCheckout) reuse=signature(plan(fast.original,fast.primary,fast.selected).purchase)===signature(active.purchase);
      // New identity per revision makes old asynchronous driver work obsolete.
      fast = Object.assign({},fast,{ready:false,review:null,revision:fast.revision+1,started:Date.now(),opened:Date.now(),driving:false,stopped:false,securePayment:false,paymentQuote:null,paymentApproval:null,paymentAuthorizing:false,paymentPricing:null,paymentOptionsOpen:false,refreshQueued:false});
      timings = {started:fast.opened,requests:{},stages:{}}; setStage(0); updateFastOptions();
      overlay.querySelector('[data-bn-retry]')?.remove();
      ['subtotal','shipping','tax','total'].forEach(function (key) { fastText('[data-bn-'+key+']','—'); });
      loading(true); status('Updating your order…'); fastText('[data-bn-confirm]','Updating…');
      paymentWorkspace(false);
      if (reuse) {
        delete detailPage.documentElement.dataset.bnFieldsApplied; delete detailPage.documentElement.dataset.bnMethod;
        ['btnPickup','btnDelivered','btnShip'].forEach(function (id) { var control=detailPage.getElementById(id); if (control) delete control.dataset.bnRequestedAt; });
        detailsQuotes.delete(detailPage); seedSession();
        driveFast(frame.contentWindow,detailPage).catch(showError); return;
      }
      clearFrame(); busy = true;
      try {
        if (active.cartCheckout) {
          var checks=await Promise.all([checkIdentity(),cart()]);
          if (signature(checks[1].items)!==signature(active.current)) throw new Error('Your cart changed. Return to the cart and review it before checkout.');
          active.phase='checking_out'; seedSession(); busy=false;
          if (cancelPending) { cancelPending=false; await cancel(); return; }
          if (fast.refreshQueued) { fast.refreshQueued=false; await refreshFast(); return; }
          loading(true); openFrame(overlay.querySelector('[data-bn-native-host]')); return;
        }
        // reconcile always refreshes identity/context before any cart write.
        var planned = plan(fast.original,fast.primary,fast.selected);
        active.purchase = planned.purchase; active.remaining = planned.remaining; active.extraCount = fast.selected.length; save();
        await reconcile(planned.purchase,revisePurchase); active.phase = 'checking_out'; save(); seedSession(); busy = false; measureCheckout('begin');
        if (cancelPending) { cancelPending = false; await cancel(); return; }
        if (fast.refreshQueued) { fast.refreshQueued = false; await refreshFast(); return; }
        fastText('[data-bn-extras]',fast.selected.length ? fast.selected.length+' cart item'+(fast.selected.length===1?'':'s')+' included' : 'Also in your cart ('+fast.original.length+')');
        openFrame(overlay.querySelector('[data-bn-native-host]'));
      } catch (error) { busy = false; throw error; }
    }
    function openFrame(body) {
      frame = doc.createElement('iframe'); frame.title = 'Secure WebTrack checkout'; frame.className = 'bn-frame'; frame.name = 'woodson-buy-now-checkout'; frame.loading = 'eager';
      frame.setAttribute('aria-hidden','true'); frame.setAttribute('tabindex','-1');
      frame.addEventListener('load', function () { installFrame().catch(showError); });
      // A fresh native document is required for current WebForms state/cart.
      frame.src = '/ShoppingCart.aspx?wlCheckout=single&wlRun='+win.crypto.randomUUID(); body.appendChild(frame);
      // Images/chat widgets must not hold up native forms that are already ready.
      frameReadyTimer = win.setInterval(function () {
        var page;
        try { page = frame?.contentDocument; } catch (_) { return; }
        if (page && page !== installedPage && page.body && page.readyState !== 'loading' && /\/ShoppingCart\.aspx$/i.test(new URL(page.URL).pathname)) installFrame().catch(showError);
        else if (page?.URL==='about:blank' && fast && active?.phase==='checking_out') driveFast(frame.contentWindow,page).catch(showError);
      },100);
    }
    async function installFrame() {
      if (!frame || !active) return;
      var child = frame.contentWindow, page;
      try { page = frame.contentDocument; if (child.location.origin !== ORIGIN) page = null; } catch (_) { page = null; }
      if (!page) {
        if (!fast?.paymentApproval) { haltFast('The total could not be confirmed before payment. Please use standard checkout.'); return; }
        paymentWorkspace(true); loading(false); status('Complete the secure payment step.'); return;
      }
      if (!page.documentElement || !page.body || page.readyState==='loading' || page === installedPage) return;
      installedPage = page;
      if (frameObserver) frameObserver.disconnect();
      if (framePulse) win.clearInterval(framePulse);
      var style = page.createElement('style');
      style.textContent = '#PageHeaderDiv,#PageFooterDiv,#siteHeaderContent,#savedForLater,nav[aria-label="Account and cart"]{display:none!important}body{padding:0!important}#MainLayoutRow{margin:8px auto!important}';
      page.head.appendChild(style);
      page.querySelectorAll('.shopping-cart-item input.riTextBox,.shopping-cart-item input[id*="_qty_"]:not([type="hidden"])').forEach(function (input) { input.readOnly = true; });
      // Native date-change compares midnight against a time-bearing minimum,
      // which alerts for its own valid minimum day. Keep date handling in this
      // owned iframe, validate calendar bounds, then use native refresh hooks.
      page.addEventListener('change', function (event) {
        var input = event.target;
        if (!input || !['deliveryDate','pickupDate'].includes(input.id) || !input.value || !input.min) return;
        event.stopImmediatePropagation();
        if (!dateChoice(input.value, input.min, input.max)) {
          input.value = '';
          input.dispatchEvent(new child.Event('input', { bubbles: true }));
          status('Choose an available Monday–Saturday date within the range shown in checkout.', true);
          var extra = page.getElementById('specialInsExtra');
          if (extra) extra.dispatchEvent(new child.Event('input', { bubbles: true }));
          return;
        }
        input.dispatchEvent(new child.Event('input', { bubbles: true }));
        child.WLCheckout?.refreshDateUI?.();
        child.WLCheckout?.refreshSectionSummaries?.();
      }, true);
      // Block escaping the dialog through internal navigation while its cart is isolated.
      page.addEventListener('click', function (event) {
        var cartAction = event.target.closest('[id*="_del_"],[id*="_refQty_"],[id*="EmptyCartButton"],.wl-cart-qty-btn,.refresh-cart-line-total');
        if (cartAction) { event.preventDefault(); event.stopImmediatePropagation(); status('To change items or quantities, use Cancel to restore your cart first.'); return; }
        var link = event.target.closest('a[href]');
        if (!link || link.target === '_blank') return;
        var href = link.getAttribute('href');
        if (!href || /^javascript:|^#/i.test(href)) return;
        var url = new URL(href, child.location.href);
        if (url.origin === ORIGIN && !/^\/(?:ShoppingCart|AddressDetails|AddressList_R|CustomerTokens|Contacts_R|ContactDetails_R)\.aspx$/i.test(url.pathname)) {
          event.preventDefault(); event.stopImmediatePropagation(); status('Finish checkout here, or use Cancel to restore your original cart.');
        }
      }, true);
      // Read totals synchronously before WebTrack's own shipping auto-continue
      // replaces this document, even when it advances before the next poll.
      page.addEventListener('click', function (event) {
        if (fast && event.target.closest('#ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView')) cachePaymentTotal(page);
      },true);
      page.addEventListener('click', function (event) {
        var final = event.target.closest(FINAL);
        if (!final || permittedFinal === final) return;
        event.preventDefault(); event.stopImmediatePropagation();
        submitNative(final, page).catch(showError);
      }, true);
      page.addEventListener('submit', function (event) {
        if (page.getElementById('ctl00_PageBody_CompleteCheckoutButton') && !submitting) { event.preventDefault(); status('Use Complete Order after reviewing the final total.'); }
      }, true);
      var nativeForm=page.querySelector('form');
      if (nativeForm) {
        var originalSubmitMethod=nativeForm.submit;
        var originalSubmit=function () { if (typeof originalSubmitMethod==='function') originalSubmitMethod.call(nativeForm); else child.HTMLFormElement.prototype.submit.call(nativeForm); };
        function relay() {
          // Handle only an already-validated intermediate native POST. Keep the
          // final order and hosted payment forms on their original native path.
          if (submitting || active?.phase!=='checking_out' || frame?.contentDocument!==page || page.getElementById('ctl00_PageBody_CompleteCheckoutButton')) return false;
          var name=nativeForm.elements.namedItem('__EVENTTARGET')?.value;
          if (!relayControl(name)) return false;
          if (page.documentElement.dataset.bnNativeRelay) return true;
          var action=new URL(nativeForm.getAttribute('action') || child.location.href,child.location.href);
          if (action.origin!==ORIGIN || !/^\/ShoppingCart\.aspx$/i.test(action.pathname)) throw new Error('The native checkout form destination could not be verified.');
          // Native validation has already run. Submit the original form in its
          // own browsing context: copying it to a targeted parent form can leave
          // WebTrack's frame on the cart without starting the next document.
          // The next task also lets WebForms finish its event/state updates.
          if (nativeForm.target && nativeForm.target!=='_self') throw new Error('The native checkout form target could not be verified.');
          page.documentElement.dataset.bnNativeRelay='1';
          win.setTimeout(function () {
            if (submitting || active?.phase!=='checking_out' || frame?.contentDocument!==page || page.getElementById('ctl00_PageBody_CompleteCheckoutButton')) return;
            var root=page.documentElement; if (!root) return;
            try { root.dataset.bnNativePost='started'; child.HTMLFormElement.prototype.submit.call(nativeForm); root.dataset.bnNativePost='returned'; }
            catch (error) { delete root.dataset.bnNativeRelay; showError(error); }
          },0);
          return true;
        }
        nativeForm.submit=function () { if (!relay(null)) originalSubmit(); };
        // Ordinary submit buttons retain WebTrack's own submit event, validation,
        // submitter value and AJAX behavior. Only the programmatic WebForms
        // form.submit path above needs the deferred native submission.
      }
      var scheduled = false;
      function inspect() {
        if (scheduled || !frame) return;
        scheduled = true;
        frameTimer = win.setTimeout(function () { scheduled = false; inspectFrame(child, page).catch(showError); }, 80);
      }
      frameObserver = new win.MutationObserver(inspect); frameObserver.observe(page.body, { childList: true, subtree: true });
      framePulse = win.setInterval(inspect,300);
      inspect();
    }
    async function inspectFrame(child, page) {
      if (!frame || frame.contentDocument !== page || !page.documentElement || !active || active.phase === 'restored') return;
      var confirmation = page.getElementById('CartResponseMessage'), merchant = page.getElementById('ctl00_PageBody_SuccessfulPaymentResults_MerchantDetailsPanel');
      if (new URL(child.location.href).searchParams.get('success') === '1' && confirmation && merchant) {
        var order = text(confirmation.querySelector('strong')?.textContent).replace(/^(?:reserved\s+)?order(?:\s+(?:number|no\.?))?\s*[:#-]?\s*/i, '');
        // A late native success still counts; recovery/submission safeguards stay in force.
        if (/^[a-z0-9][a-z0-9-]{2,63}$/i.test(order) && active.phase==='uncertain') measureCheckout('purchase',page,null,order);
        if (!/^[a-z0-9][a-z0-9-]{2,63}$/i.test(order) || !['submitting', 'confirmed', 'restoring'].includes(active.phase)) throw new Error('Order confirmation needs review before restoring the cart.');
        if (busy) return;
        measureCheckout('purchase',page,null,order);
        busy = true; submitting = false; active.orderNumber = order; active.phase = 'confirmed'; active.current = []; active.pending = null; save(); clearFrame();
        if (active.cartCheckout) {
          // WebTrack already purchased the natural cart. Never restore a copy.
          busy=false; loading(false); status('Order '+order+' confirmed.');
          overlay.querySelector('.bn-footer')?.remove(); overlay.querySelector('[data-bn-standard]')?.remove();
          var done=button('Continue shopping',function () { dismiss(); win.location.href='/Default.aspx'; });
          overlay.querySelector('[data-bn-body]').replaceChildren(node('div','✓','bn-success'),node('h3','Order '+order+' confirmed'),done);
          return;
        }
        status('Order ' + order + ' confirmed. Restoring items you left in your cart…');
        var fresh = await cart();
        if (fresh.items.length) throw new Error('The order is confirmed, but WebTrack has not returned an empty cart. Your recovery copy is retained.');
        active.phase = 'restoring'; save(); await reconcile(active.remaining); restoreSession(); storage.removeItem(key); active.phase = 'restored';
        status('Order ' + order + ' is confirmed. Your remaining cart items are restored.'); busy = false;
        loading(false); overlay.querySelector('.bn-footer')?.remove(); var done = button('Continue shopping', dismiss); overlay.querySelector('[data-bn-body]').replaceChildren(node('div','✓','bn-success'),node('h3','Order confirmed'),done); return;
      }
      if (submitting) {
        status('Waiting for WebTrack to confirm the order. Do not submit again or close this window.'); return;
      }
      var instructions = page.getElementById('ctl00_PageBody_SpecialInstructionsTextBox');
      if (instructions) {
        var extra = page.getElementById('specialInsExtra');
        var note = marker(active);
        if (extra) {
          if (!extra.value.includes(active.id)) {
            extra.value = [extra.value, note].filter(Boolean).join('\n');
            extra.dispatchEvent(new child.Event('input', { bubbles: true })); extra.dispatchEvent(new child.Event('change', { bubbles: true }));
          }
        } else if (!instructions.value.includes(active.id)) instructions.value = [instructions.value, note].filter(Boolean).join(' | ');
        instructions.dataset.bnNativeNote = '1';
      }
      await driveFast(child,page);
    }
    function setNative(child, element, value) {
      if (!element || element.value === String(value == null ? '' : value)) return;
      element.value = value == null ? '' : String(value);
      element.dispatchEvent(new child.Event('input',{bubbles:true}));
      element.dispatchEvent(new child.Event('change',{bubbles:true}));
    }
    function nativeAddress(child, page, prefix, address) {
      if (!address) return;
      var base = 'ctl00_PageBody_'+prefix+'_';
      [['AddressLine1','line1'],['AddressLine2','line2'],['AddressLine3','line3'],['City','city'],['Postcode','zip']].forEach(function (entry) { setNative(child,page.getElementById(base+entry[0]),address[entry[1]] || ''); });
      var state = page.querySelector('[id^="'+base+'"][id$="CountyList"]');
      if (state) {
        var option = nativeStateOption(state.options,address);
        if (option) setNative(child,state,option.value);
      }
    }
    function readNativeReview(page) {
      var summary = page.getElementById('summary');
      if (!summary || !text(summary.textContent).includes(active.id)) throw new Error('Order details are still loading.');
      var grid = page.getElementById('ctl00_PageBody_ShoppingCartSummaryTableControl_BasketLinesGrid_ctl00');
      var rows = Array.from(grid ? grid.querySelectorAll('tr.rgRow,tr.rgAltRow') : []).map(function (row) {
        var cells = row.querySelectorAll('td'); return {code:text(cells[0]?.textContent),quantity:Number(text(cells[3]?.textContent).replace(/,/g,'')),unit:text(cells[4]?.textContent)};
      });
      assertReview(rows,active.current);
      var totals = reviewTotals(summary), shippingRow = page.getElementById('ctl00_PageBody_ShoppingCartSummaryTableControl_DeliverySummaryRow');
      if (shippingRow) totals.shipping = text(shippingRow.querySelector('td.numeric')?.textContent);
      var employeeZero = employeeZeroReview(loginFromDocument(settings),totals,!!shippingRow);
      if (employeeZero) totals.shipping = '$0.00';
      if (!totals.shipping && fast.method === 'pickup') totals.shipping = '$0.00';
      if (money(totals.shipping) === null) throw new Error('The shipping total is still loading.');
      var nativeMethod = text(page.getElementById('ctl00_PageBody_ShoppingCartSummaryTableControl_SaleType')?.textContent);
      if (!nativeMethod) {
        var label = Array.from(summary.querySelectorAll('.row .font-weight-bold')).find(function (el) { return /Shipping Method/i.test(el.textContent); });
        nativeMethod = text(label?.parentElement?.querySelector('.col')?.textContent);
      }
      if (nativeMethod && ((fast.method === 'pickup') !== /^pickup/i.test(nativeMethod))) throw new Error('The fulfillment choice did not match. Change it and try again.');
      if (fast.method==='pickup') {
        updatePickupReadiness();
        if (!fast.pickupReadiness || fast.pickupReadiness.checking || !dateChoice(fast.date,fast.pickupReadiness.min,fast.dateMax)) throw new Error('Pickup availability changed. Review your pickup date.');
        var store = (fast.stores || []).find(function (option) { return option.value===fast.store; });
        assertPickupStore(page.getElementById('ctl00_PageBody_ShoppingCartSummaryTableControl_BranchRow')?.querySelector('.col')?.textContent,store?.label);
      }
      if (!employeeZero && fast.method !== 'pickup' && !(money(totals.shipping) > 0)) throw new Error('WebTrack did not confirm the delivery charge.');
      var service = (fast.shippingOptions || []).find(function (option) { return option.value === fast.shippingValue; });
      var expectedShipping = quotedShipping(fast.method, fast.methods[fast.method], service, service && service === fast.shippingOptions[0]);
      if (!employeeZero && money(totals.shipping) !== expectedShipping) throw new Error('The delivery charge changed. Refresh your options before ordering.');
      if (fast.method !== 'ship' && fast.date && !text(summary.textContent).includes(fast.date)) throw new Error('WebTrack did not confirm your requested date.');
      return {totals:totals,employeeZero:employeeZero,signature:JSON.stringify([signature(active.current),totals,fast.method,fast.paymentFingerprint || '',fast.revision])};
    }
    function updateFastOptions() {
      Object.entries(fast.methods).forEach(function (entry) {
        var el = overlay.querySelector('[data-bn-method="'+entry[0]+'"]'); if (!el) return;
        el.setAttribute('aria-pressed',fast.method===entry[0]?'true':'false');
        el.dataset.available = entry[1].available || entry[1].pending ? 'true' : 'false';
        el.disabled = submitting || !!fast.editor || !(entry[1].available || entry[1].pending);
        fastText('[data-bn-rate="'+entry[0]+'"]',entry[1].available ? entry[1].rate : entry[1].pending ? (entry[0]==='pickup' ? 'Check availability' : 'Get rate') : 'Unavailable');
        el.title = entry[1].reason || '';
      });
      fastText('[data-bn-address-title]',fast.method === 'pickup' ? 'Pickup at' : 'Deliver to');
      var store = (fast.stores || []).find(function (option) { return option.value === fast.store; });
      fastText('[data-bn-address]',fast.method==='pickup' ? (store?.label.split(' - ')[0] || (guest ? 'Pickup store' : 'Account store')) : deliveryAddressSummary(fast.address));
      if (overlay) { overlay.querySelectorAll('[data-bn-pickup-notice],[data-bn-pickup-items]').forEach(function (el) { el.hidden=fast.method!=='pickup'; }); }
      if (guest && !fast.ready && !fast.securePayment) fastText('[data-bn-payment]','Enter securely');
      fastText('[data-bn-timing-title]',fast.method==='pickup' ? 'Pickup request' : 'When');
      fastText('[data-bn-shipping-label]',fast.method==='pickup'?'Pickup':fast.method==='ship'?'Shipping':'Delivery');
      if (fast.method === 'ship') {
        var service = (fast.shippingOptions || []).find(function (option) { return option.value === fast.shippingValue; });
        fastText('[data-bn-timing]', service ? service.label : 'UPS Ground');
      } else if (fast.date) {
        var parts = fast.date.split('-').map(Number), date = new Date(parts[0],parts[1]-1,parts[2],12);
        fastText('[data-bn-timing]',date.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})+' · '+(fast.method==='pickup' ? fast.pickupTime || 'First available' : fast.window));
      }
      if (overlay) loading(fast.loading);
    }
    function haltFast(message) {
      fast.stopped = true; fast.ready = false; loading(false); status(message,true); fastText('[data-bn-confirm]','Update your options'); updateFastOptions();
      if (!overlay.querySelector('[data-bn-retry]')) {
        var retry = button('Try again',function () { retry.remove(); refreshFast().catch(showError); },true); retry.dataset.bnRetry = ''; overlay.querySelector('[data-bn-native-host]').before(retry);
      }
    }
    async function driveFast(child,page) {
      if (!fast || fast.driving || fast.paymentAuthorizing || fast.stopped || busy || submitting || !page.documentElement || active.phase !== 'checking_out') return;
      if (fast.editor || fast.securePayment || fast.paymentQuote) fast.started=Date.now();
      if (Date.now()-fast.started > 120000) { haltFast('This is taking longer than expected. Retry or cancel.'); return; }
      fast.driving = true;
      var current = fast;
      try {
        var initialized=nativeFormsReady(child); page.documentElement.dataset.bnNativeInitialized=initialized?'1':'0';
        if (!initialized) { status('Loading secure checkout controls…'); return; }
        var complete = page.getElementById('ctl00_PageBody_CompleteCheckoutButton');
        if (complete) {
          setStage(3);
          var reviewed;
          try { reviewed = readNativeReview(page); } catch (error) {
            if (!page.documentElement.dataset.bnReviewWaiting) page.documentElement.dataset.bnReviewWaiting = String(Date.now());
            if (Date.now()-Number(page.documentElement.dataset.bnReviewWaiting) > 4000) haltFast(error.message);
            return;
          }
          measureCheckout('review',page,reviewed); measureCheckout('shipping',page,reviewed); measureCheckout('payment',page,reviewed);
          fast.review = reviewed; fast.ready = true; fast.securePayment = false; fast.paymentQuote=null;
          overlay.querySelector('[data-bn-retry]')?.remove();
          overlay.dataset.bnReadyMs = String(Date.now()-fast.opened);
          setStage(4); overlay.dataset.bnTimings = JSON.stringify({elapsed:Date.now()-timings.started,requests:timings.requests,stages:timings.stages});
          if (framePulse) { win.clearInterval(framePulse); framePulse = null; }
          ['subtotal','shipping','tax','total'].forEach(function (key) { fastText('[data-bn-'+key+']',reviewed.totals[key]); });
          if (reviewed.employeeZero) fastText('[data-bn-payment]','No payment due');
          fastText('[data-bn-confirm]','Place order · '+reviewed.totals.total); loading(false); status('Ready to order'); updateFastOptions();
          paymentWorkspace(false);
          return;
        }
        var checkout = page.getElementById('ctl00_PageBody_PlaceOrderButton');
        if (checkout && page.querySelector('.shopping-cart-item')) {
          if (!cartPolicyReady(page)) { status('Checking item availability…'); return; }
          var block=page.querySelector('.wl-cart-shipping-block,.wl-clearance-stock-note[data-sold-out="1"]');
          if (block && text(block.textContent)) { haltFast(text(block.textContent)); return; }
          if (!page.documentElement.dataset.bnCheckoutOpened && continueNativeCart(child,checkout)) { page.documentElement.dataset.bnCheckoutOpened = '1'; status('Loading your defaults…'); }
          return;
        }
        var methodButton = page.getElementById('btnDelivered'), pickupButton = page.getElementById('btnPickup');
        if (methodButton && pickupButton) {
          setStage(1);
          if (!child.WLCheckout?.refreshDateUI || !child.WLCheckout?.validateBeforeFinalSubmit) return;
          var manager = child.Sys?.WebForms?.PageRequestManager?.getInstance?.(); if (manager?.get_isInAsyncPostBack?.()) return;
          if (!page.documentElement.dataset.bnFieldsApplied) {
            await checkIdentity();
            if (fast!==current || !frame || frame.contentDocument!==page) return;
            page.documentElement.dataset.bnFieldsApplied = '1';
            if (fast.address && (guest || fast.addressChanged || fast.method!=='pickup')) nativeAddress(child,page,'DeliveryAddress',fast.address);
            if (fast.billing) nativeAddress(child,page,'InvoiceAddress',fast.billing);
            applyContactDefaults(page,guest ? guest.contact : contactDefaults(settings,account),fast.addressChanged ? fast.address : null,!!guest);
            if (guest) win.sessionStorage.removeItem('wl_guest_checkout_needs_autofill');
            child.WLCheckout?.hydrateBlankInvoiceFromDelivery?.();
          }
          if (manager?.get_isInAsyncPostBack?.()) return;
          // Pickup doesn't require paid rates. A cart-page quote can still lack
          // the completed address, so keep paid choices pending until requested.
          var quote = fast.method==='pickup' ? null : quoteForCart(child.WLShippingOffer?.current?.(),active.purchase);
          fast.methods = fulfillmentOptions(!pickupButton.disabled,fast.method==='pickup' ? quote : null);
          updateFastOptions();
          if (fast.method!=='pickup') {
            if (!child.WLShippingOffer?.refresh) return;
            if (!detailsQuotes.has(page)) {
              status('Checking delivery & shipping…');
              var quoteTimer, freshQuote;
              try {
                freshQuote = await Promise.race([
                  refreshDetailsQuote(function () { return child.WLShippingOffer.refresh(); },function () { return fast===current && frame?.contentDocument===page && !manager?.get_isInAsyncPostBack?.(); }),
                  new Promise(function (_,reject) { quoteTimer=win.setTimeout(function () { reject(new Error('Delivery rates are taking longer than expected. Retry or choose Pickup.')); },25000); })
                ]);
              } finally { win.clearTimeout(quoteTimer); }
              if (fast!==current || !frame || frame.contentDocument!==page) return;
              quote = quoteForCart(freshQuote,active.purchase);
              if (!quote) return;
              detailsQuotes.set(page,quote);
            } else quote = detailsQuotes.get(page);
          }
          fast.methods = fulfillmentOptions(!pickupButton.disabled,quote);
          updateFastOptions();
          // Pickup needs native stock/schedule validation, not a paid carrier quote.
          if (!quote && fast.method !== 'pickup') return;
          if (!fast.method) fast.method = cheapestHomeMethod(quote);
          updateFastOptions();
          if (!fast.methods[fast.method]?.available) { haltFast('That option is unavailable. Choose another.'); return; }
          var appliedButton = page.getElementById(fast.method==='pickup'?'btnPickup':fast.method==='ship'?'btnShip':'btnDelivered');
          if (!appliedButton?.dataset.bnRequestedAt) {
            status('Confirming your choice…');
            requestNativeMethod(page,fast.method,Date.now());
            return;
          }
          // Native method clicks await rate reservation before applying the UI.
          // Do not validate/continue using the previous delivery/UPS intent.
          if (!fulfillmentApplied(fast.method,child.sessionStorage.getItem('wl_fulfillment_intent'),appliedButton?.getAttribute('aria-pressed'))) {
            if (Date.now()-Number(appliedButton.dataset.bnRequestedAt)>15000) haltFast('WebTrack could not confirm that option. Retry or choose Pickup.');
            return;
          }
          if (manager?.get_isInAsyncPostBack?.()) return;
          if (page.documentElement.dataset.bnDetailsContinued && Array.from(page.querySelectorAll('.validation-summary-errors,.alert-danger,.wl-field-invalid')).some(function (el) { return el.offsetParent && text(el.textContent || el.getAttribute('aria-label')); })) { haltFast('Check your address, billing, or pickup details.'); return; }
          var branchField = page.getElementById('ctl00_PageBody_BranchDropDownList');
          if (branchField) {
            fast.stores = Array.from(branchField.options).filter(function (option) { return option.value && !/^\[?select/i.test(text(option.textContent)); }).map(function (option) { return {value:option.value,label:text(option.textContent)}; });
            if (fast.method==='pickup') {
              if (fast.store && !fast.stores.some(function (option) { return option.value===fast.store; })) { haltFast('Choose an available pickup store.'); return; }
              if (fast.store && branchField.value !== fast.store) { setNative(child,branchField,fast.store); return; }
              fast.store = branchField.value; updatePickupReadiness();
            }
          }
          var dateInput = page.getElementById(fast.method==='pickup'?'pickupDate':'deliveryDate'); if (!dateInput?.min) return;
          fast.dateMin = dateInput.min; fast.dateMax = dateInput.max;
          if (fast.method==='pickup') {
            updatePickupReadiness();
            if (fast.pickupReadiness?.checking) { status('Checking stock at your pickup store…'); return; }
            // Keep the original native floor separate from our store-stock floor.
            // An in-place switch to an in-stock store can then offer earlier dates.
            if (!dateInput.dataset.bnNativePickupMin) dateInput.dataset.bnNativePickupMin=dateInput.min;
            dateInput.min=[dateInput.dataset.bnNativePickupMin,fast.pickupReadiness.min].sort().pop(); fast.dateMin=dateInput.min;
          }
          var chosenDate = fast.date && fast.date>=dateInput.min ? fast.date : firstDate(dateInput.min,dateInput.max);
          if (!dateChoice(chosenDate,dateInput.min,dateInput.max)) { haltFast('Choose an available date.'); return; }
          setNative(child,dateInput,chosenDate); fast.date = chosenDate;
          child.WLCheckout.refreshDateUI();
          if (fast.method === 'pickup') {
            var time = page.getElementById('pickupTime');
            fast.pickupTimes = Array.from(time?.options || []).filter(function (option) { return !!option.value; }).map(function (option) { return {value:option.value,label:text(option.textContent)}; });
            if (!fast.pickupTimes.length) {
              var parts = chosenDate.split('-').map(Number), next = new Date(parts[0],parts[1]-1,parts[2]+1,12);
              var nextValue = [next.getFullYear(),String(next.getMonth()+1).padStart(2,'0'),String(next.getDate()).padStart(2,'0')].join('-');
              fast.date = firstDate(nextValue,dateInput.max); fast.pickupTime = ''; if (!fast.date) haltFast('Choose another pickup date.'); return;
            }
            if (fast.pickupTime && !fast.pickupTimes.some(function (option) { return option.value===fast.pickupTime; })) fast.pickupTime = '';
            fast.pickupTime = fast.pickupTime || fast.pickupTimes[0].value; setNative(child,time,fast.pickupTime);
            var person = page.getElementById('pickupPerson'); fast.pickupPerson = fast.pickupPerson || person?.value || fast.address?.contactName || '';
            setNative(child,person,fast.pickupPerson);
          } else {
            var windowInput = page.querySelector('input[name="deliveryTime"][value="'+fast.window+'"]');
            if (windowInput && !windowInput.checked) { windowInput.checked = true; windowInput.dispatchEvent(new child.Event('change',{bubbles:true})); }
          }
          var instructions = page.getElementById('specialInsExtra');
          setNative(child,instructions,[fast.notes,fast.method==='pickup' ? pickupInstruction() : '',marker(active)].filter(Boolean).join('\n'));
          var reference = page.querySelector('input[id*="PurchaseOrder"],input[id*="CustomerReference"]'); if (reference && fast.reference !== undefined) setNative(child,reference,fast.reference);
          child.WLCheckout.refreshDateUI(); child.WLCheckout.refreshSectionSummaries?.(); updateFastOptions();
          if (!page.documentElement.dataset.bnDetailsContinued) {
            if (!child.WLCheckout.validateBeforeFinalSubmit()) {
              // Native defaults and UpdatePanel handlers can settle after load.
              // Retry validation briefly; never skip it or force a postback.
              if (!page.documentElement.dataset.bnValidationWaiting) page.documentElement.dataset.bnValidationWaiting = String(Date.now());
              if (Date.now()-Number(page.documentElement.dataset.bnValidationWaiting) < 3500) { status('Loading your defaults…'); return; }
              haltFast('Check your address, billing, or pickup details.'); return;
            }
            delete page.documentElement.dataset.bnValidationWaiting;
            // The native proxy also confirms the fulfillment rate before posting.
            var nextButton = page.querySelector('.wl-proxy-continue') || page.getElementById('ctl00_PageBody_ContinueButton2') || page.getElementById('ctl00_PageBody_ContinueButton1'); if (!nextButton || nextButton.disabled) return;
            measureCheckout('shipping',page);
            page.documentElement.dataset.bnDetailsContinued = '1'; status('Calculating your total…'); nextButton.click();
          }
          return;
        }
        var cards = page.getElementById('ctl00_PageBody_ddlCardsOnFile');
        if (cards) {
          setStage(2);
          if (page.documentElement.dataset.bnPaymentContinued) return;
          var options = await Promise.all(Array.from(cards.options).map(async function (option) { return {value:option.value,label:text(option.textContent),disabled:option.disabled,fingerprint:await digest(scope+'|'+text(option.textContent))}; }));
          if (fast !== current || !frame || frame.contentDocument !== page) return;
          options = options.filter(function (option) { return option.value && !/^(select|choose|please)\b/i.test(option.label); }); fast.payments = options;
          if (fast.editor==='payment') {
            var select=overlay.querySelector('[data-bn-editor] select[aria-label="Saved payment"]');
            if (select && !select.options.length && options.length) { options.forEach(function (option) { var el=node('option',option.label); el.value=option.fingerprint; select.appendChild(el); }); select.closest('label').hidden=false; var preferred=savedChoice(options,fast.paymentFingerprint || (!guest && storage.getItem(preferenceKey))); if (preferred) select.value=preferred.fingerprint; overlay.querySelector('[data-bn-editor] button[type=submit]').disabled=false; }
            return;
          }
          var selected = savedChoice(options,fast.paymentFingerprint || (!guest && storage.getItem(preferenceKey)));
          var stored = page.getElementById('ctl00_PageBody_rbStoredCard');
          if (!stored || stored.disabled || cards.disabled) selected=null;
          if (!selected || fast.addPayment) {
            var newCard = page.getElementById('ctl00_PageBody_rbCreditCard'), next = page.getElementById('ctl00_PageBody_btnContinue_CardOnFileView');
            if (!newCard || newCard.disabled || !next) { haltFast('New payment is unavailable. Please use standard checkout.'); return; }
            if (!paymentTotalGate(page)) return;
            await checkIdentity(); if (fast!==current || !frame || frame.contentDocument!==page) return;
            fast.addPayment = false; fast.paymentFingerprint=''; fast.securePayment = true; fastText('[data-bn-payment]','New payment'); page.documentElement.dataset.bnPaymentContinued = '1'; newCard.checked = true; newCard.dispatchEvent(new child.Event('change',{bubbles:true})); next.click(); return;
          }
          fast.paymentFingerprint = selected.fingerprint; fastText('[data-bn-payment]', '•••• '+(selected.label.match(/\b\d{4}\b/)?.[0] || 'Saved payment'));
          var paymentContinue = page.getElementById('ctl00_PageBody_btnContinue_CardOnFileView');
          if (!stored || !paymentContinue) { haltFast('Choose another payment method.'); return; }
          await checkIdentity(); if (fast !== current || !frame || frame.contentDocument !== page) return;
          page.documentElement.dataset.bnPaymentContinued = '1'; stored.checked = true; cards.value = selected.value; cards.dispatchEvent(new child.Event('change',{bubbles:true})); status('Getting the final total…'); paymentContinue.click(); return;
        }
        var shippingContinue = page.getElementById('ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView');
        if (shippingContinue) {
          setStage(2); status('Loading payment…');
          // Capture the native monetary breakdown before its automatic handoff.
          cachePaymentTotal(page);
          // Pickup/local-delivery already have a native automatic continuation.
          if (child.__wlPickupShippingAutoAdvance) return;
          var select = page.getElementById('ctl00_PageBody_CartSummary2_LocalDeliveryChargeControl_DeliveryOptionsDropDownList');
          if (select) {
            fast.shippingOptions = Array.from(select.options).filter(function (option) { return !option.disabled && /\$/.test(option.textContent); }).map(function (option) { return {value:option.value,label:text(option.textContent)}; });
            if (!fast.shippingOptions.length && fast.method!=='pickup') return;
            if (fast.method === 'ship' && fast.shippingValue && !fast.shippingOptions.some(function (option) { return option.value===fast.shippingValue; })) { haltFast('The shipping options changed. Choose again.'); return; }
            var choice = fast.shippingValue || fast.shippingOptions[0]?.value;
            if (choice && select.value !== choice) { setNative(child,select,choice); fast.shippingValue = choice; return; }
            fast.shippingValue = choice || '';
          }
          updateFastOptions();
          if (!page.documentElement.dataset.bnShippingContinued) { page.documentElement.dataset.bnShippingContinued = '1'; cachePaymentTotal(page); status('Getting the final total…'); shippingContinue.click(); }
          return;
        }
        // WebTrack can skip the saved-card selector when no card is on file.
        if (fast.securePayment || page.querySelector('iframe[src^="https://sce.toogo.io/hp/"]') || page.getElementById('ctl00_PageBody_CardOnFileViewTitle_HeaderText')) {
          if (!paymentTotalGate(page)) return;
          fast.securePayment=true; fastText('[data-bn-payment]','Secure payment');
          if (!fast.editor && !fast.paymentOptionsOpen) paymentWorkspace(true); loading(false); status('Add your payment securely.'); return;
        }
      } catch (error) {
        // A replaced frame can still reject a slow carrier request. Only the
        // active revision may report an error or change the current panel.
        if (fast === current && frame?.contentDocument === page) throw error;
      } finally { if (fast === current) fast.driving = false; }
    }
    async function submitNative(control, page) {
      if (submitting || busy || !active || active.phase !== 'checking_out') return;
      if (fast && (!fast.ready || fast.loading || fast.editor || !fast.review)) return;
      var approvedReview = fast?.review?.signature;
      busy = true;
      if (fast) { fast.ready = false; loading(true); }
      try {
        await checkIdentity();
        var fresh = await cart();
        if (signature(fresh.items) !== signature(active.current)) throw new Error('The cart changed before confirmation. The order was not submitted.');
        blocked = await purchaseRestrictions();
        if (active.current.some(function (item) { return blocked.has(item.pid); })) throw new Error('A product is no longer eligible for online purchase. The order was not submitted.');
        var summary = page.getElementById('summary');
        if (!summary || !text(summary.textContent).includes(active.id)) throw new Error('WebTrack did not retain the checkout reference. The order was not submitted.');
        var grid = page.getElementById('ctl00_PageBody_ShoppingCartSummaryTableControl_BasketLinesGrid_ctl00');
        var reviewed = Array.from(grid ? grid.querySelectorAll('tr.rgRow,tr.rgAltRow') : []).map(function (row) {
          var cells = row.querySelectorAll('td');
          return {code:text(cells[0]?.textContent),quantity:Number(text(cells[3]?.textContent).replace(/,/g,'')),unit:text(cells[4]?.textContent)};
        });
        assertReview(reviewed, active.current);
        if (fast && readNativeReview(page).signature !== approvedReview) throw new Error('The final total changed. Review your updated order before placing it.');
        if (!frame || frame.contentDocument !== page) throw new Error('The checkout screen changed. Review the order again before confirming.');
        if (!page.getElementById('ctl00_PageBody_CompleteCheckoutButton')) throw new Error('WebTrack final review is unavailable.');
        if (cancelPending) { cancelPending = false; busy = false; await cancel(); return; }
        measureCheckout('submit',page,fast?.review);
        active.phase = 'submitting'; save(); submitting = true; busy = false;
        status('Placing your order…');
        var nativeFinal = page.getElementById('ctl00_PageBody_CompleteCheckoutButton');
        permittedFinal = nativeFinal;
        try { nativeFinal.click(); } finally { permittedFinal = null; }
        // A lost response is never retried or treated as a failed order.
        win.setTimeout(function () {
          if (!active || active.phase !== 'submitting') return;
          active.phase = 'uncertain'; save();
          if (active.cartCheckout) showError(new Error('WebTrack has not confirmed the result. Check order history before trying again.'));
          else status('WebTrack has not confirmed the result. Check your order history before trying again. Your cart backup is retained.', true);
        }, 45000);
      } catch (error) { busy = false; throw error; }
    }
    function locateProduct(control) {
      if (/\/ProductDetail\.aspx$/i.test(win.location.pathname)) {
        var id = new URL(win.location.href).searchParams.get('pid');
        var qty = doc.querySelector('input[id$="_qty_' + id + '"]');
        return id && qty ? { pid: id, quantity: Number(qty.value) || 1,preview:{name:text(doc.querySelector('#wl-product-title,.productDescriptionOnThisPageFull,h1')?.textContent),photo:doc.querySelector('[id$="_ProductImage"]')?.getAttribute('src')} } : null;
      }
      var parent = control.parentElement;
      for (var depth = 0; parent && depth < 7; depth++, parent = parent.parentElement) {
        var quantities = parent.querySelectorAll('input[id*="_qty_"]:not([type="hidden"]),input[id$="_ProductQuantity"]:not([type="hidden"])');
        if (quantities.length !== 1) continue;
        var match = quantities[0].id.match(/_qty_(\d+)/);
        if (match) return { pid: match[1], quantity: Number(quantities[0].value) || 1,preview:previewFrom(parent,match[1]) };
        var products = new Set(Array.from(parent.querySelectorAll('a[href]')).map(function (link) { return pidOf(link.getAttribute('href')); }).filter(Boolean));
        if (products.size === 1) { var id = Array.from(products)[0]; return { pid:id,quantity:Number(quantities[0].value) || 1,preview:previewFrom(parent,id) }; }
      }
      return null;
    }
    function previewFrom(root,id) {
      var link = Array.from(root.querySelectorAll('a[href]')).find(function (el) { return pidOf(el.getAttribute('href'))===id && text(el.textContent); });
      return {name:text(link?.textContent),photo:root.querySelector('img')?.getAttribute('src')};
    }
    function addButtons() {
      if (!ENABLE_NEW_STARTS || guest || !win.navigator.locks || !blocked || !/\/(?:ProductDetail|Products)\.aspx$/i.test(win.location.pathname)) return;
      doc.querySelectorAll('a[id*="AddProductButton"],input[id*="AddProductButton"],button[id*="AddProductButton"]').forEach(function (control) {
        var product = locateProduct(control);
        if (control.dataset.bnAttached || control.disabled || control.classList.contains('disabled') || control.getAttribute('aria-disabled') === 'true' || !product || blocked.has(product.pid) || PALLET_PRODUCTS.has(product.pid)) return;
        control.dataset.bnAttached = '1';
        control.classList.add('wl-pilot-add-cart');
        var buy = button('Quick buy', function () {
          var item = locateProduct(control);
          if (!item || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 9999) { notice('Choose a whole-number quantity before using Buy now.'); return; }
          buy.disabled = true;
          start(item.pid, item.quantity,item.preview).catch(function (error) { if (overlay) showError(error); else notice(error.message); }).finally(function () { buy.disabled = false; });
        });
        buy.setAttribute('aria-label','Quick buy');
        buy.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2-9 12h7l-1 8 10-13h-7z"/></svg><span>Quick buy</span><span class="wl-quick-arrow" aria-hidden="true">↗</span>';
        buy.classList.add('wl-buy-now-button'); control.insertAdjacentElement('afterend', buy);
        if (/\/ProductDetail\.aspx$/i.test(win.location.pathname) && control.parentElement.tagName==='DIV' && Array.from(control.parentElement.children).every(function (el) { return el===control || el===buy; })) control.parentElement.classList.add('wl-pilot-actions');
      });
    }
    function installStyles() {
      var style = doc.createElement('style'); style.id = 'wl-buy-now-styles';
      style.textContent = "#wl-buy-now{position:fixed;inset:0;z-index:2147483000;background:#16101591;display:flex;align-items:center;justify-content:center;padding:20px;font:14px/1.4 system-ui,-apple-system,sans-serif;color:#25282b;backdrop-filter:blur(3px)}\n#wl-buy-now *{box-sizing:border-box}#wl-buy-now [hidden]{display:none!important}.bn-panel{display:flex;flex-direction:column;width:min(100%,500px);max-height:94dvh;background:#fff;border-radius:18px;box-shadow:0 22px 80px #0005;overflow:hidden;position:relative}.bn-head{display:flex;align-items:center;justify-content:space-between;padding:19px 22px 13px}.bn-head h2{font:750 24px/1.15 system-ui;margin:0 0 3px}.bn-head small{font-size:11px;color:#7d6a6d}.bn-head .bn-action{border:0;padding:7px 0 7px 14px;color:#71666a;background:transparent;min-height:38px;font-size:13px}.bn-progress{display:flex;gap:9px;align-items:center;padding:10px 22px;background:#f6f3f0;color:#68575a;font-size:12px;min-height:36px}.bn-progress .bn-error{color:#9b241e}.bn-spinner{width:14px;height:14px;flex:none;border:2px solid #dcc5ca;border-top-color:#6b0016;border-radius:50%;display:none}.bn-loading .bn-spinner{display:block;animation:bn-spin .8s linear infinite}.bn-body{padding:20px 22px 14px;overflow:auto;min-height:0}.bn-product{display:flex;gap:14px;align-items:center;margin-bottom:18px}.bn-product h3{font-size:15px;line-height:1.4;margin:0 0 6px;font-weight:650}.bn-product span{font-size:12px;color:#777}.bn-product [data-bn-photo]{width:56px;height:62px;border-radius:8px;background:#f5f4f1;flex:none;display:grid;place-items:center}.bn-product img{width:52px;height:58px;object-fit:contain}.bn-methods{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:17px}.bn-methods button{border:1px solid #dedbd9;border-radius:11px;background:#fff;padding:12px 5px 11px;display:flex;flex-direction:column;align-items:center;gap:5px;color:#4e4648;cursor:pointer;min-height:105px;font:inherit}.bn-methods svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}.bn-methods strong{font-size:13px}.bn-methods small{font-size:10px;line-height:1.3}.bn-methods [aria-pressed=true]{background:#fcf5f6;border:2px solid #6b0016;padding:11px 4px 10px;color:#6b0016}.bn-methods [data-available=false]{opacity:.45}.bn-methods button:disabled{cursor:default}.bn-loading .bn-methods small{opacity:.55}.bn-options{border:1px solid #e6e2df;border-radius:11px;overflow:hidden}.bn-option{display:flex;gap:11px;align-items:center;padding:12px 13px}.bn-option+.bn-option{border-top:1px solid #eeeae7}.bn-option-icon{font-size:22px;color:#907b80;width:23px;text-align:center;flex:none}.bn-option>div{display:grid;gap:3px;min-width:0;flex:1}.bn-option strong{font-size:12px;font-weight:650}.bn-option div>span{font-size:12px;color:#777;overflow-wrap:anywhere}.bn-option button,.bn-more{color:#6b0016;background:none;border:0;font:600 12px system-ui;cursor:pointer;padding:8px 0 8px 8px;min-height:36px}.bn-option button:disabled,.bn-more:disabled{opacity:.45;cursor:default}.bn-extras{display:flex;justify-content:space-between;align-items:center;width:100%;padding:12px 13px;margin-top:12px;background:#f8f6f3;border:1px dashed #dacdd0;border-radius:9px;color:#6b0016;font:600 12px system-ui;text-align:left;cursor:pointer;min-height:44px}.bn-extras:disabled{opacity:.6;cursor:default}.bn-more{font-weight:400;padding-left:0;margin:3px 0 0}.bn-totals{border-top:1px solid #e9e4e1;margin-top:7px;padding-top:12px;display:grid;gap:6px;font-size:12px;color:#6c6768}.bn-totals>div{display:flex;justify-content:space-between;gap:12px}.bn-totals .bn-grand{font-size:17px;color:#25282b;padding-top:9px;margin-top:4px;border-top:1px solid #eee9e7}.bn-action{border:1px solid #6b0016;background:#6b0016;color:white;border-radius:8px;padding:11px 16px;font:650 14px/1.4 system-ui;cursor:pointer;min-height:44px}.bn-action:disabled{opacity:.5;cursor:wait}.bn-secondary{background:white;color:#6b0016}.bn-confirm{width:100%;margin-top:14px;min-height:47px;font-size:15px}.bn-terms{font-size:10px;color:#888;text-align:center;margin:10px 0 0}.bn-terms a{color:inherit;text-decoration:underline}.wl-buy-now-button{margin:6px;white-space:nowrap}.bn-frame{position:fixed!important;left:0!important;top:0!important;z-index:-1;width:1000px!important;height:800px!important;opacity:0;pointer-events:none;border:0}.bn-frame.bn-frame-open{position:relative!important;left:auto!important;top:auto!important;width:100%!important;height:60dvh!important;opacity:1;pointer-events:auto;margin-top:16px}.bn-success{font-size:48px;color:#297048;text-align:center}.bn-body:has(.bn-success){text-align:center;padding:30px}.bn-notice{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:white;border:1px solid #6b0016;box-shadow:0 4px 20px #0003;padding:12px;z-index:2147482999;max-width:calc(100% - 24px);font:14px/1.5 system-ui}.bn-notice button{margin-left:12px}.bn-panel [data-bn-editor]{border:1px solid #decdd1;border-radius:10px;padding:15px;margin:8px 0 14px;background:#fdfbfa}.bn-panel [data-bn-editor] h3{font-size:16px;margin:0 0 12px}.bn-panel [data-bn-editor] label{display:grid;gap:5px;font-size:12px;margin:10px 0}.bn-panel [data-bn-editor] input,.bn-panel [data-bn-editor] select,.bn-panel [data-bn-editor] textarea{width:100%;min-width:0;padding:10px;border:1px solid #c9c1c1;border-radius:6px;background:#fff;font:14px system-ui}.bn-panel [data-bn-editor] .bn-check{display:flex;gap:10px;align-items:center}.bn-panel [data-bn-editor] .bn-check input{width:19px;height:19px;flex:none}.bn-editor-actions{display:flex;gap:8px;margin-top:14px}.bn-loading .bn-totals [data-bn-total]{color:#a59a9d}.bn-panel button:focus-visible,.bn-panel input:focus-visible,.bn-panel select:focus-visible{outline:3px solid #9c5565;outline-offset:2px}@keyframes bn-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.bn-loading .bn-spinner{animation:none;border-top-width:4px}}@media(max-width:540px){#wl-buy-now{padding:0;align-items:flex-end}.bn-panel{max-height:100dvh;width:100%;border-radius:18px 18px 0 0}.bn-head{padding:16px 18px 12px}.bn-body{padding:16px 18px 13px}.bn-progress{padding-left:18px}.bn-product{margin-bottom:15px}.bn-methods{gap:7px}.bn-methods button{min-height:100px}.bn-terms{margin-bottom:env(safe-area-inset-bottom,0)}}\n.bn-footer{padding:13px 22px 15px;border-top:1px solid #e9e4e1;background:#fff;flex:none}.bn-footer .bn-totals{margin:0;border:0;padding:0;gap:4px}.bn-footer .bn-grand{padding-top:7px;margin-top:3px}.bn-footer .bn-confirm{margin-top:11px}.bn-footer .bn-terms{margin-top:8px}.bn-product{margin-bottom:14px}.bn-methods{margin-bottom:14px}.bn-methods button{min-height:89px;padding-top:8px;padding-bottom:8px}.bn-methods [aria-pressed=true]{padding-top:7px;padding-bottom:7px}.bn-option{padding:9px 12px}.bn-option div>span{line-height:1.25}.bn-more{min-height:32px;padding-top:6px;padding-bottom:6px}.bn-progress:has(.bn-error){background:#fff0ed}.bn-panel:not([aria-busy=true]) .bn-spinner{display:block;border:0;width:14px;height:14px}.bn-panel:not([aria-busy=true]) .bn-spinner:after{content:'✓';color:#3c7753;font-size:15px}.bn-panel:has(.bn-error) .bn-spinner:after{content:'!';color:#a03028}.bn-body:has([data-bn-editor]:not([hidden]))~.bn-footer .bn-terms{display:none}@media(max-width:540px){.bn-footer{padding:12px 18px max(12px,env(safe-area-inset-bottom,0))}.bn-body{padding-bottom:8px}.bn-methods button{min-height:86px}}\n";
      style.textContent += `
.wl-pilot-add-cart{background:linear-gradient(145deg,#f5f8fb,#e5edf5)!important;color:#60182b!important;border:1px solid #b9c9d9!important;border-radius:12px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:48px!important;padding:11px 12px!important;font:700 14px/1.2 system-ui!important;text-decoration:none!important;box-shadow:inset 0 1px 0 #fff,0 2px 0 #26466314;transition:background .2s,transform .2s!important;width:100%;white-space:nowrap}
.wl-pilot-add-cart:hover{background:#dce7f1!important;transform:translateY(-1px)}
.wl-buy-now-button,#wl-buy-now .bn-confirm{background:radial-gradient(ellipse at 70% -65%,transparent 56%,#172d4455 58%,transparent 63%),radial-gradient(ellipse at 85% -30%,#84a8c824,transparent 64%),conic-gradient(from 220deg at 58% 50%,#6b0016 0deg,#7e2141 85deg,#41617f 175deg,#294764 250deg,#6b0016 360deg)!important;color:#fff!important;border:1px solid #829bb3!important;border-radius:12px!important;box-shadow:inset 0 1px 0 #ffffff52,inset 0 -1px 0 #150d243b,0 3px 0 #26324f24,0 7px 18px #223e5b29;text-shadow:0 1px 2px #17152466;position:relative;overflow:hidden;isolation:isolate;transition:transform .2s,box-shadow .2s}
.wl-buy-now-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:48px;padding:11px 12px;font:800 14px/1.2 system-ui;margin:8px 0;width:100%;white-space:nowrap;cursor:pointer}
.wl-buy-now-button svg{width:18px;height:20px;fill:currentColor;flex:none}.wl-buy-now-button>span,.wl-buy-now-button>svg{position:relative;z-index:1}.wl-quick-arrow{font-size:20px;line-height:1;transition:transform .2s}
.wl-buy-now-button:after{content:'';position:absolute;inset:-60% auto -60% -65%;width:35%;background:linear-gradient(90deg,transparent,#ffffff0f,transparent);transform:skewX(-20deg);animation:wl-quick-glint 7s ease-in-out infinite 1s;pointer-events:none;z-index:0}
.wl-buy-now-button:hover{transform:translateY(-2px);box-shadow:inset 0 1px 0 #ffffff65,inset 0 -1px 0 #150d243b,0 4px 0 #26324f24,0 10px 25px #223e5b40}.wl-buy-now-button:hover .wl-quick-arrow{transform:translate(2px,-2px)}.wl-buy-now-button:active,.wl-pilot-add-cart:active{transform:translateY(1px)}
.wl-buy-now-button:focus-visible,.wl-pilot-add-cart:focus-visible{outline:3px solid #6b0016!important;outline-offset:3px}.wl-buy-now-button:disabled{opacity:.65;cursor:wait}
.wl-pilot-actions{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(min(100%,140px),1fr));gap:10px}.wl-pilot-actions>*{width:100%;min-width:0;margin:0!important}
.bn-progress{position:relative;overflow:hidden}.bn-loading .bn-progress:after{content:'';position:absolute;left:0;bottom:0;width:40%;height:2px;background:linear-gradient(90deg,transparent,#6b0016,#668eaf,transparent);animation:wl-checkout-activity 1.8s ease-in-out infinite}
@keyframes wl-checkout-activity{from{transform:translateX(-110%)}to{transform:translateX(360%)}}
.bn-standard{border:0;background:transparent;color:#6b0016;font-size:11px;min-height:34px;padding:6px 20px;margin:0;flex:none}.bn-standard:disabled{opacity:.4;cursor:wait}.bn-cart-items{border:1px solid #e6e2df;border-radius:9px;margin:0 0 14px;padding:10px 12px;font-size:12px}.bn-cart-items summary{cursor:pointer;color:#6b0016;font-weight:650;min-height:24px}.bn-cart-line{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid #eee}.bn-cart-line span{min-width:0;overflow-wrap:anywhere}.bn-cart-line strong{white-space:nowrap;font-size:11px}
#wl-buy-now[data-bn-flow=cart] .bn-head{padding:14px 20px 10px}#wl-buy-now[data-bn-flow=cart] .bn-body{padding:14px 20px 10px}#wl-buy-now[data-bn-flow=cart] .bn-cart-items{margin-bottom:10px}#wl-buy-now[data-bn-flow=cart] .bn-methods{margin-bottom:10px}#wl-buy-now[data-bn-flow=cart] .bn-methods button{min-height:76px}#wl-buy-now[data-bn-flow=cart] .bn-option{padding:7px 10px}
#wl-buy-now[data-bn-flow=cart].bn-ready .bn-stages{display:none}#wl-buy-now[data-bn-flow=cart] .bn-totals{grid-template-columns:repeat(3,minmax(0,1fr))}#wl-buy-now[data-bn-flow=cart] .bn-totals>div:not(.bn-grand){display:grid;gap:2px;font-size:11px}#wl-buy-now[data-bn-flow=cart] .bn-grand{grid-column:1/-1}
#wl-buy-now[data-bn-flow=cart].bn-ready .bn-progress{position:absolute;width:1px;height:1px;padding:0;margin:-1px;border:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}#wl-buy-now[data-bn-flow=cart] .bn-cart-items{padding:6px 10px}#wl-buy-now[data-bn-flow=cart] .bn-body{padding-top:12px;padding-bottom:8px}
#wl-buy-now[data-bn-flow=cart] .bn-more{min-height:28px;margin:0;padding:4px 0}
.bn-stages{list-style:none;display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin:0;padding:12px 22px 9px;border-bottom:1px solid #f0eae3;font-size:10px;color:#8b8580;flex:none}.bn-stages li{display:flex;align-items:center;gap:5px;position:relative;white-space:nowrap}.bn-step-dot{width:19px;height:19px;display:grid;place-items:center;border-radius:50%;background:#f0ede8;color:#9c948c;font-size:10px;flex:none}.bn-stages [data-state=current]{color:#294764;font-weight:700}.bn-stages [data-state=current] .bn-step-dot{background:#d7e4f0;color:#294764;box-shadow:0 0 0 3px #41617f22;animation:wl-step-pulse 1.5s ease-in-out infinite}.bn-stages [data-state=done] .bn-step-dot{background:#e8f1e8;color:#3d7046}.bn-stages [data-state=done]{color:#55735a}
.bn-skeletons{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;padding-bottom:12px}.bn-skeletons span{height:85px;border-radius:11px;background:linear-gradient(100deg,#eff2f6 20%,#f9fbfd 45%,#eff2f6 70%);background-size:220% 100%;animation:wl-skeleton 1.8s ease-in-out infinite}.bn-skeletons span:nth-child(n+4){grid-column:1/-1;height:48px}
@keyframes wl-quick-glint{0%{left:-65%;opacity:0}2%{opacity:1}14%{left:140%;opacity:0}100%{left:140%;opacity:0}}@keyframes wl-step-pulse{50%{box-shadow:0 0 0 5px #41617f12}}@keyframes wl-skeleton{to{background-position:-120% 0}}
@media(max-width:540px){.bn-stages{padding:10px 18px 8px;gap:3px}.bn-stages li{gap:4px}.wl-pilot-actions{gap:8px}}
@media(prefers-reduced-motion:reduce){.wl-buy-now-button:after,.bn-stages [data-state=current] .bn-step-dot,.bn-skeletons span{animation:none!important}.wl-buy-now-button,.wl-pilot-add-cart,.wl-quick-arrow{transition:none!important}.wl-buy-now-button:after,.bn-loading .bn-progress:after{display:none}}
`;
      style.textContent += `
#wl-buy-now{overflow:hidden}
#wl-buy-now .bn-panel{max-height:calc(100dvh - 32px);min-height:0}
#wl-buy-now .bn-body{flex:1 1 auto;overscroll-behavior:contain;scrollbar-gutter:stable}
#wl-buy-now .bn-editor-workspace{display:flex;flex:1 1 auto;flex-direction:column;min-height:0;overflow:hidden;padding:0;margin:0;border:0;border-radius:0;background:#fff}
#wl-buy-now .bn-workspace-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 22px;border-block:1px solid #e5e9ee;background:#f2f5f9;flex:none}
#wl-buy-now .bn-workspace-head h3{font-size:17px;margin:0;color:#243c56}
#wl-buy-now .bn-workspace-head .bn-action{font-size:12px;min-height:36px;padding:7px 10px}
#wl-buy-now .bn-editor-form{display:flex;flex:1 1 auto;flex-direction:column;min-height:0;overflow:hidden;margin:0}
#wl-buy-now .bn-editor-fields{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;padding:6px 22px 18px}
#wl-buy-now .bn-editor-actions{flex:none;display:flex;gap:10px;margin:0;padding:13px 22px;border-top:1px solid #e5e9ee;background:#fff}
#wl-buy-now .bn-editor-actions .bn-action{flex:1}
#wl-buy-now .bn-editor-error{color:#9b241e;font-weight:600}#wl-buy-now .bn-editor-error:empty{display:none}
#wl-buy-now .bn-panel.bn-editing>:not(.bn-head):not(.bn-editor-workspace):not(.bn-native-workspace){display:none!important}
/* Keep the offscreen native document laid out: WebForms validation and stock
   warnings use visibility measurements while checkout prepares in the background. */
#wl-buy-now .bn-native-workspace{display:flex;flex-direction:column;flex:none;height:0;min-height:0;overflow:hidden}
#wl-buy-now .bn-native-workspace>.bn-workspace-head{display:none}
#wl-buy-now .bn-panel.bn-secure-payment:not(.bn-editing)>.bn-native-workspace{flex:1 1 auto;height:auto}
#wl-buy-now .bn-panel.bn-secure-payment:not(.bn-editing)>.bn-native-workspace>.bn-workspace-head{display:flex}
#wl-buy-now .bn-panel.bn-secure-payment:not(.bn-editing)>:not(.bn-head):not(.bn-native-workspace){display:none!important}
#wl-buy-now .bn-frame.bn-frame-open{flex:1 1 auto;min-height:240px;height:100%!important;max-height:100%;margin:0;display:block;z-index:0}
#wl-buy-now .bn-panel.bn-secure-payment{height:min(780px,calc(100dvh - 32px))}
#wl-buy-now .bn-pickup-notice{font-size:12px;line-height:1.4;color:#36516d;background:#eff4f9;border-radius:8px;padding:10px 12px;margin:10px 0}
#wl-buy-now .bn-pickup-items{font-size:11px;border-bottom:1px solid #e5e9ee;margin-bottom:8px;padding:4px 0 8px}
#wl-buy-now .bn-pickup-items summary{cursor:pointer;color:#36516d;min-height:30px;display:list-item;list-style:disclosure-closed inside}
#wl-buy-now .bn-pickup-items[open] summary{list-style-type:disclosure-open}
#wl-buy-now .bn-pickup-line{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:9px 0;border-top:1px solid #e5e9ee}
#wl-buy-now .bn-pickup-line span{overflow-wrap:anywhere}#wl-buy-now .bn-pickup-line strong{font-weight:600;color:#36516d;font-size:10px}
@media(max-width:540px){#wl-buy-now .bn-panel{max-height:100dvh}#wl-buy-now .bn-panel.bn-secure-payment{height:100dvh}.bn-workspace-head,.bn-editor-actions{padding-inline:18px}.bn-editor-fields{padding-inline:18px}.bn-editor-actions{padding-bottom:max(13px,env(safe-area-inset-bottom))}}
`;
      doc.head.appendChild(style);
    }
    installStyles();
    var pending = record();
    if (pending) {
      await withLock(async function () {
        active = pending; active.owner = owner; shell('Recover your Buy now cart');
        if (['submitting', 'uncertain'].includes(active.phase)) {
          status('A previous order has an unconfirmed result. Check order history before another purchase. Your original cart backup is retained.', true);
          var link = doc.createElement('a'); link.href = '/AccountInfo_R.aspx'; link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'Open account and order history'; overlay.querySelector('[data-bn-body]').appendChild(link);
        } else { status('An earlier Buy now did not finish restoring your cart. Restore it before starting another.'); showRestoreButton(); }
      }).catch(function (error) { if (overlay) showError(error); else notice(error.message); });
    } else {
      addButtons();
      bindCartEntry();
      var observer = new win.MutationObserver(addButtons); observer.observe(doc.body, { childList: true, subtree: true });
      if (guest && ENABLE_CART_CHECKOUT && win.navigator.locks && /\/ShoppingCart\.aspx$/i.test(win.location.pathname) && guestStartPending(win.sessionStorage,Date.now())) {
        win.sessionStorage.removeItem(GUEST_START_KEY);
        await startCart().catch(function (error) { if (overlay) showError(error); else notice(error.message); });
      }
    }
    win.addEventListener('storage', function (event) {
      if (event.key !== key || !overlay || !active) return;
      var latest;
      try { latest = record(); } catch (error) { showError(error); return; }
      if (latest && latest.owner !== owner) { busy = true; clearFrame(); status('Buy now is active in another tab. Cart changes have stopped here.', true); }
    });
  }
  return { relayControl:relayControl, nativeFormsReady:nativeFormsReady, continueNativeCart:continueNativeCart, pickupStoreName:pickupStoreName, centralCalendar:centralCalendar, calendarAfter:calendarAfter, pickupTimeChoices:pickupTimeChoices, stockFromDocument:stockFromDocument, pickupReadiness:pickupReadiness, boot: boot, build: BUILD, audience: AUDIENCE, deliveryAddressSummary:deliveryAddressSummary, nativeStateOption:nativeStateOption, accountScopeInput:accountScopeInput, guestContext:guestContext, guestStartPending:guestStartPending, lines: lines, signature: signature, plan: plan, nextMutation: nextMutation, afterMutation: afterMutation, assertExpected: assertExpected, recoveryTarget: recoveryTarget, assertReview: assertReview, marker: marker, cartOrderReceipt: cartOrderReceipt, readCartOrderReceipt: readCartOrderReceipt, savedChoice: savedChoice, loginFromDocument: loginFromDocument, readRecord: readRecord, persist: persist, targetOf: targetOf, mainAddress: mainAddress, readableCart: readableCart, cartPolicyReady: cartPolicyReady, hasCustomCuts: hasCustomCuts, dateChoice: dateChoice, firstDate: firstDate, money: money, reviewTotals: reviewTotals, paymentTotals: paymentTotals, fulfillmentApplied: fulfillmentApplied, requestNativeMethod: requestNativeMethod, quotedShipping: quotedShipping, employeeZeroReview: employeeZeroReview, fulfillmentOptions: fulfillmentOptions, productMethod: productMethod, contactDefaults: contactDefaults, applyContactDefaults: applyContactDefaults, quoteForCart: quoteForCart, cheapestHomeMethod: cheapestHomeMethod, assertPickupStore: assertPickupStore, refreshDetailsQuote: refreshDetailsQuote };
});
