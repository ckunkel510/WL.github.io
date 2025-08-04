(function($){
  // ===========================
  // CONFIG & FEATURE FLAGS
  // ===========================
  const CONFIG = {
    BUY_NOW_PARAM: "buy_now",
    BUY_NOW_STORAGE_KEY: "wl_buy_now_intent",
    AUTO_CONTINUE_ENABLED: true,
    AUTO_CONTINUE_GRACE_MS: 600,
    PREFILL_TIMEOUT_MS: 6000,
    CONTINUE_SELECTORS: [
      "#ctl00_PageBody_ContinueButton1",
      "#ctl00_PageBody_ContinueButton2",
      "button[id*='ContinueButton']"
    ],
    REQUIRED_FIELDS: {
      delivery: [
        "#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox",
        "#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox",
        "#ctl00_PageBody_DeliveryAddress_AddressLine1",
        "#ctl00_PageBody_DeliveryAddress_City",
        "#ctl00_PageBody_DeliveryAddress_Postcode",
        "#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList"
      ],
      billing: [
        "#ctl00_PageBody_InvoiceAddress_AddressLine1",
        "#ctl00_PageBody_InvoiceAddress_City",
        "#ctl00_PageBody_InvoiceAddress_Postcode"
      ]
    },
    DEFAULT_COUNTRY_TEXT: "USA"
  };

  // ===========================
  // STATE
  // ===========================

  const US_STATES = {
  "AL":"Alabama","AK":"Alaska","AZ":"Arizona","AR":"Arkansas","CA":"California","CO":"Colorado","CT":"Connecticut","DE":"Delaware",
  "FL":"Florida","GA":"Georgia","HI":"Hawaii","ID":"Idaho","IL":"Illinois","IN":"Indiana","IA":"Iowa","KS":"Kansas","KY":"Kentucky",
  "LA":"Louisiana","ME":"Maine","MD":"Maryland","MA":"Massachusetts","MI":"Michigan","MN":"Minnesota","MS":"Mississippi","MO":"Missouri",
  "MT":"Montana","NE":"Nebraska","NV":"Nevada","NH":"New Hampshire","NJ":"New Jersey","NM":"New Mexico","NY":"New York","NC":"North Carolina",
  "ND":"North Dakota","OH":"Ohio","OK":"Oklahoma","OR":"Oregon","PA":"Pennsylvania","RI":"Rhode Island","SC":"South Carolina","SD":"South Dakota",
  "TN":"Tennessee","TX":"Texas","UT":"Utah","VT":"Vermont","VA":"Virginia","WA":"Washington","WV":"West Virginia","WI":"Wisconsin","WY":"Wyoming",
  "DC":"District of Columbia"
};
  const CheckoutState = {
    editing: { delivery:false, billing:false },
    loaded:  { account:false, telephone:false, addressbook:false },
    data: {
      delivery: {
        firstName:"", lastName:"", phone:"", line1:"", line2:"", line3:"",
        city:"", state:"", zip:"", country: CONFIG.DEFAULT_COUNTRY_TEXT
      },
      billing: {
        line1:"", line2:"", line3:"", city:"", state:"", zip:"", country: CONFIG.DEFAULT_COUNTRY_TEXT,
        email:""
      },
      shippingMethod: null,   // "rbDelivered" | "rbCollectLater"
      transactionType: null   // "rdbOrder"    | "rdbQuote"
    }
  };

  // ===========================
  // FIELD MAPS
  // ===========================
  const Fields = {
    delivery: {
      firstName: "#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox",
      lastName:  "#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox",
      phone:     "#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox",
      line1:     "#ctl00_PageBody_DeliveryAddress_AddressLine1",
      line2:     "#ctl00_PageBody_DeliveryAddress_AddressLine2",
      line3:     "#ctl00_PageBody_DeliveryAddress_AddressLine3",
      city:      "#ctl00_PageBody_DeliveryAddress_City",
      state:     "#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList",
      zip:       "#ctl00_PageBody_DeliveryAddress_Postcode",
      country:   "#ctl00_PageBody_DeliveryAddress_CountrySelector"
    },
    billing: {
      line1:   "#ctl00_PageBody_InvoiceAddress_AddressLine1",
      line2:   "#ctl00_PageBody_InvoiceAddress_AddressLine2",
      line3:   "#ctl00_PageBody_InvoiceAddress_AddressLine3",
      city:    "#ctl00_PageBody_InvoiceAddress_City",
      state:   "#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList",
      zip:     "#ctl00_PageBody_InvoiceAddress_Postcode",
      country: "#ctl00_PageBody_InvoiceAddress_CountrySelector1",
      email:   "#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox"
    },
    radios: {
      txnOrder:   "#ctl00_PageBody_TransactionTypeSelector_rdbOrder",
      txnQuote:   "#ctl00_PageBody_TransactionTypeSelector_rdbQuote",
      shipDeliv:  "#ctl00_PageBody_SaleTypeSelector_rbDelivered",
      shipPickup: "#ctl00_PageBody_SaleTypeSelector_rbCollectLater"
    }
  };

  // ===========================
  // UTILS
  // ===========================
  const qs = new URLSearchParams(location.search);
  const hasBuyNowParam    = qs.get(CONFIG.BUY_NOW_PARAM) === "1";
  const hasBuyNowStorage  = localStorage.getItem(CONFIG.BUY_NOW_STORAGE_KEY) === "1";

  function setBuyNowIntent(on){ if(on) localStorage.setItem(CONFIG.BUY_NOW_STORAGE_KEY,"1"); else localStorage.removeItem(CONFIG.BUY_NOW_STORAGE_KEY); }
  function firstExisting(selArr){ for(const s of selArr){ const $el=$(s); if($el.length) return $el; } return $(); }
  function safeText(v){ return (v||"").toString().trim(); }
  function wait(ms){ return new Promise(res=>setTimeout(res,ms)); }
  function validateRequired(group){
    const list = CONFIG.REQUIRED_FIELDS[group] || [];
    for (const sel of list){ const $el=$(sel); if(!$el.length) return false; if(!safeText($el.val())) return false; }
    return true;
  }
  function tryClickContinue(){
    const $btn = firstExisting(CONFIG.CONTINUE_SELECTORS);
    if(!$btn.length) return false;
    if($btn.is(":disabled") || $btn.css("display")==="none") return false;
    $btn.trigger("click");
    return true;
  }

  // --- Postback suppression guard ---
  let WL_SUPPRESS = false;
  const originalDoPostBack = window.__doPostBack ? window.__doPostBack.bind(window) : null;
  function neutralizeAutoPostback(){
    // Strip inline handlers that cause postbacks on change/click
    const kill = [
      Fields.delivery.state, Fields.delivery.country,
      Fields.billing.state,  Fields.billing.country,
      Fields.radios.txnOrder, Fields.radios.txnQuote,
      Fields.radios.shipDeliv, Fields.radios.shipPickup,
      "#ctl00_PageBody_CopyDeliveryAddressLinkButton"
    ];
    $(kill.join(",")).each(function(){
      $(this).off("click change");
      this.removeAttribute && this.removeAttribute("onclick");
      this.removeAttribute && this.removeAttribute("onchange");
    });
    // Stub __doPostBack while we programmatically update fields
    if (!window.__doPostBack) return;
    window.__doPostBack = function(){
      if (WL_SUPPRESS) { /* swallow */ return; }
      return originalDoPostBack && originalDoPostBack.apply(this, arguments);
    };
  }
  function withNoPostback(fn){
    WL_SUPPRESS = true;
    try { fn(); } finally { WL_SUPPRESS = false; }
  }

  function pullFromDOM(){
    const d = CheckoutState.data.delivery;
    for (const [k,sel] of Object.entries(Fields.delivery)){
      const $el=$(sel); if(!$el.length) continue;
      d[k] = $el.is("select") ? ($el.find("option:selected").text().trim() || $el.val() || "") : $el.val();
    }
    const i = CheckoutState.data.billing;
    for (const [k,sel] of Object.entries(Fields.billing)){
      const $el=$(sel); if(!$el.length) continue;
      i[k] = $el.is("select") ? ($el.find("option:selected").text().trim() || $el.val() || "") : $el.val();
    }

    // Default country if empty
    if (!safeText(d.country)) d.country = CONFIG.DEFAULT_COUNTRY_TEXT;
    if (!safeText(i.country)) i.country = CONFIG.DEFAULT_COUNTRY_TEXT;

    // Radios
    CheckoutState.data.transactionType =
      $(Fields.radios.txnOrder).is(":checked") ? "rdbOrder" :
      $(Fields.radios.txnQuote).is(":checked") ? "rdbQuote" : null;

    CheckoutState.data.shippingMethod =
      $(Fields.radios.shipDeliv).is(":checked") ? "rbDelivered" :
      $(Fields.radios.shipPickup).is(":checked") ? "rbCollectLater" : null;
  }

  // Replace setSelectMatch() with this:
function setSelectMatch($sel, rawValue){
  if (!$sel.length) return;
  const wantRaw = (rawValue || "").trim();
  if (!wantRaw) return;
  const want = wantRaw.toLowerCase();

  // Expand common synonyms for country
  const countrySyn = {
    "usa": ["usa","u.s.a.","united states","united states of america","us","u.s."],
    "united states": ["united states","united states of america","usa","us","u.s.","u.s.a."]
  };

  const candidates = new Set([wantRaw, want]);
  // If looks like a 2-letter state code, add full name candidate
  if (wantRaw.length === 2 && US_STATES[wantRaw.toUpperCase()]) {
    candidates.add(US_STATES[wantRaw.toUpperCase()].toLowerCase());
    candidates.add(US_STATES[wantRaw.toUpperCase()]);
  }
  // Country synonyms
  if (countrySyn[want]) countrySyn[want].forEach(v=>candidates.add(v.toLowerCase()));

  // 1) exact text/value
  let matchedOption = null;
  $sel.find("option").each(function(){
    const txt = $(this).text().trim().toLowerCase();
    const val = (($(this).val())||"").trim().toLowerCase();
    if (candidates.has(txt) || candidates.has(val)) { matchedOption = $(this); return false; }
  });

  // 2) startsWith
  if (!matchedOption){
    $sel.find("option").each(function(){
      const txt = $(this).text().trim().toLowerCase();
      if (txt.startsWith(want)) { matchedOption = $(this); return false; }
    });
  }
  // 3) includes
  if (!matchedOption){
    $sel.find("option").each(function(){
      const txt = $(this).text().trim().toLowerCase();
      if (txt.includes(want)) { matchedOption = $(this); return false; }
    });
  }
  if (matchedOption){ matchedOption.prop("selected", true); }
}

  function pushToDOM(){
    withNoPostback(()=>{
      const d = CheckoutState.data.delivery, i = CheckoutState.data.billing;

      function setVal(sel, val, isSelect=false){
        const $el=$(sel); if(!$el.length) return;
        if(isSelect){ setSelectMatch($el, val); }
        else { $el.val(val || ""); }
        // Do NOT trigger "change" (it can postback). Use "input" for our own listeners.
        $el.trigger("input");
      }

      // Delivery
      setVal(Fields.delivery.firstName, d.firstName);
      setVal(Fields.delivery.lastName,  d.lastName);
      setVal(Fields.delivery.phone,     d.phone);
      setVal(Fields.delivery.line1,     d.line1);
      setVal(Fields.delivery.line2,     d.line2);
      setVal(Fields.delivery.line3,     d.line3);
      setVal(Fields.delivery.city,      d.city);
      setVal(Fields.delivery.zip,       d.zip);
      setVal(Fields.delivery.country,   d.country, true);
      setVal(Fields.delivery.state,     d.state,   true);

      // Billing
      setVal(Fields.billing.line1,   i.line1);
      setVal(Fields.billing.line2,   i.line2);
      setVal(Fields.billing.line3,   i.line3);
      setVal(Fields.billing.city,    i.city);
      setVal(Fields.billing.zip,     i.zip);
      setVal(Fields.billing.country, i.country, true);
      setVal(Fields.billing.state,   i.state,   true);
      setVal(Fields.billing.email,   i.email);
    });
  }

  function copyDeliveryToBilling(opts={force:false}){
    const d = Fields.delivery, b = Fields.billing;
    const billingHasAddr = !!safeText($(b.line1).val());
    if (!opts.force && billingHasAddr) return false;

    withNoPostback(()=>{
      $(b.line1).val($(d.line1).val());
      $(b.line2).val($(d.line2).val());
      $(b.line3).val($(d.line3).val());
      $(b.city).val($(d.city).val());
      $(b.zip).val($(d.zip).val());

      const dCountry = $(d.country).find("option:selected").val() || $(d.country).val() || CONFIG.DEFAULT_COUNTRY_TEXT;
      const dState   = $(d.state).find("option:selected").val()   || $(d.state).val()   || "";
      setSelectMatch($(b.country), dCountry);
      setSelectMatch($(b.state),   dState);

      $(b.line1+","+b.line2+","+b.line3+","+b.city+","+b.zip).trigger("input");
    });
    return true;
  }

  // ===========================
  // UI
  // ===========================
  function hideNativeBlocks(){
    const hideList = [
      // Delivery native
      "#ctl00_PageBody_DeliveryAddress_ContactNameTitleLiteral",
      "label:contains('First name:')",
      "label:contains('Last name:')",
      Fields.delivery.firstName,
      Fields.delivery.lastName,
      "#ctl00_PageBody_DeliveryAddress_GoogleAddressSearchWrapper",
      "label[for='locationFieldDelivery']", "#locationFieldDelivery", "#autocompleteDelivery",
      "#ctl00_PageBody_ContinueButton1",
      "#ctl00_PageBody_DeliveryAddress_AddressLine1TitleLiteral", Fields.delivery.line1,
      "#ctl00_PageBody_DeliveryAddress_AddressLine2TitleLiteral", Fields.delivery.line2,
      "#ctl00_PageBody_DeliveryAddress_AddressLine3TitleLiteral", Fields.delivery.line3,
      "#ctl00_PageBody_DeliveryAddress_AddressCityTitleLiteral",  Fields.delivery.city,
      "#ctl00_PageBody_DeliveryAddress_AddressCountyTitleLiteral",Fields.delivery.state,
      "#ctl00_PageBody_DeliveryAddress_AddressPostcodeTitleLiteral", Fields.delivery.zip,
      "#ctl00_PageBody_DeliveryAddress_AddressCountryTitleLiteral", Fields.delivery.country,
      "#ctl00_PageBody_DeliveryAddress_ContactTelephoneRow",
      "#ctl00_PageBody_DeliveryAddress_ContactTelephoneTitleLiteral",
      Fields.delivery.phone,

      // Billing native
      "#ctl00_PageBody_InvoiceAddress_GoogleAddressSearchWrapper",
      "label[for='locationFieldInvoice']", "#locationFieldInvoice", "#autocompleteInvoice",
      "#ctl00_PageBody_InvoiceAddress_AddressLine1TitleLiteral", Fields.billing.line1,
      "#ctl00_PageBody_InvoiceAddress_AddressLine2TitleLiteral", Fields.billing.line2,
      "#ctl00_PageBody_InvoiceAddress_AddressLine3TitleLiteral", Fields.billing.line3,
      "#ctl00_PageBody_InvoiceAddress_AddressCityTitleLiteral",  Fields.billing.city,
      "#ctl00_PageBody_InvoiceAddress_AddressCountyTitleLiteral",Fields.billing.state,
      "#ctl00_PageBody_InvoiceAddress_AddressPostcodeTitleLiteral", Fields.billing.zip,
      "#ctl00_PageBody_InvoiceAddress_AddressCountryTitleLiteral", Fields.billing.country,
      "#ctl00_PageBody_InvoiceAddress_EmailAddressRow",
      "#ctl00_PageBody_InvoiceAddress_EmailAddressTitleLiteral",
      Fields.billing.email
    ];
    $(hideList.join(",")).css({display:"none"});
  }

  // Replace buildSummaries() with this:
function buildSummaries(){
  // Find dependable mount points near native controls
  const $deliveryMount = $(Fields.delivery.firstName).closest(".epi-form-col-single-checkout").first();
  const $billingMount  = $(Fields.billing.line1).closest(".epi-form-col-single-checkout").first();

  // If not found, fallback to nearest .epi-form-group-checkout container
  const $delHost = $deliveryMount.length ? $deliveryMount : $(Fields.delivery.firstName).closest(".epi-form-group-checkout");
  const $bilHost = $billingMount.length  ? $billingMount  : $(Fields.billing.line1).closest(".epi-form-group-checkout");

  if ($delHost.find("#wlDeliverySummary").length === 0) {
    $delHost.append(`
      <div class="wl-summary-card" id="wlDeliverySummary">
        <div class="wl-summary-header">
          <div>
            <strong>Delivery Address</strong>
            <div class="wl-summary-sub" id="wlDeliveryLine"></div>
          </div>
          <button type="button" class="wl-btn-link" id="wlEditDelivery">Edit</button>
        </div>
        <div class="wl-summary-body"><div id="wlDeliverySummaryBody"></div></div>
      </div>
    `);
  }
  if ($bilHost.find("#wlBillingSummary").length === 0) {
    $bilHost.append(`
      <div class="wl-summary-card" id="wlBillingSummary">
        <div class="wl-summary-header">
          <div>
            <strong>Billing Address</strong>
            <div class="wl-summary-sub" id="wlBillingLine"></div>
          </div>
          <button type="button" class="wl-btn-link" id="wlEditBilling">Edit</button>
        </div>
        <div class="wl-summary-body"><div id="wlBillingSummaryBody"></div></div>
      </div>
    `);
  }
}


  function renderSummaries(){
    pullFromDOM();
    const d = CheckoutState.data.delivery, b = CheckoutState.data.billing;

    const deliveryHtml = `
      ${safeText(d.firstName)} ${safeText(d.lastName)}<br>
      ${safeText(d.line1)} ${safeText(d.line2)} ${safeText(d.line3)}<br>
      ${safeText(d.city)}${d.state ? ", "+safeText(d.state):""} ${safeText(d.zip)}<br>
      ${safeText(d.country)}<br>
      ${d.phone ? "Tel: "+safeText(d.phone):""}
    `.replace(/\s+\n/g,"\n");

    const billingHtml = `
      ${safeText(b.line1)} ${safeText(b.line2)} ${safeText(b.line3)}<br>
      ${safeText(b.city)}${b.state ? ", "+safeText(b.state):""} ${safeText(b.zip)}<br>
      ${safeText(b.country)}<br>
      ${b.email ? "Email: "+safeText(b.email):""}
    `.replace(/\s+\n/g,"\n");

    $("#wlDeliverySummaryBody").html(deliveryHtml);
    $("#wlBillingSummaryBody").html(billingHtml);

    $("#wlDeliveryLine").text([ safeText(d.line1), [safeText(d.city), safeText(d.state)].filter(Boolean).join(", "), safeText(d.zip) ].filter(Boolean).join(" • "));
    $("#wlBillingLine").text([  safeText(b.line1), [safeText(b.city), safeText(b.state)].filter(Boolean).join(", "), safeText(b.zip) ].filter(Boolean).join(" • "));
  }

  function openEditor(which){
    CheckoutState.editing[which] = true;
    const map = (which==="delivery") ? Fields.delivery : Fields.billing;
    const $panel = $(`<div class="wl-editor"></div>`);
    const schema = (which === "delivery") ?
      [
        {label:"First name", key:"firstName", sel:map.firstName},
        {label:"Last name",  key:"lastName",  sel:map.lastName},
        {label:"Phone",      key:"phone",     sel:map.phone},
        {label:"Address line 1", key:"line1", sel:map.line1, required:true},
        {label:"Address line 2", key:"line2", sel:map.line2},
        {label:"Address line 3", key:"line3", sel:map.line3},
        {label:"City",       key:"city",     sel:map.city,  required:true},
        {label:"State",      key:"state",    sel:map.state, isSelect:true, required:true},
        {label:"ZIP",        key:"zip",      sel:map.zip,   required:true},
        {label:"Country",    key:"country",  sel:map.country, isSelect:true}
      ] :
      [
        {label:"Address line 1", key:"line1", sel:map.line1, required:true},
        {label:"Address line 2", key:"line2", sel:map.line2},
        {label:"Address line 3", key:"line3", sel:map.line3},
        {label:"City",       key:"city",     sel:map.city,  required:true},
        {label:"State",      key:"state",    sel:map.state, isSelect:true},
        {label:"ZIP",        key:"zip",      sel:map.zip,   required:true},
        {label:"Country",    key:"country",  sel:map.country, isSelect:true},
        {label:"Email",      key:"email",    sel:map.email}
      ];

    schema.forEach(row=>{
      const $orig=$(row.sel).first(); if(!$orig.length) return;
      const $clone=$orig.clone(true,true);
      $clone.attr("id", $orig.attr("id")+"_shadow").removeAttr("name").removeAttr("onclick").removeAttr("onchange");
      $clone.val($orig.val());
      const req = row.required ? `<span class="wl-required">*</span>` : "";
      $panel.append(`<label class="wl-field-label">${row.label} ${req}</label>`).append($clone);
    });

    const $actions = $(`
      <div class="wl-editor-actions">
        <button type="button" class="wl-btn-secondary" id="wlCancel_${which}">Cancel</button>
        <button type="button" class="wl-btn-primary"   id="wlSave_${which}">Save</button>
      </div>
    `);
    $panel.append($actions);

    const $host = (which==="delivery") ? $("#wlDeliverySummary") : $("#wlBillingSummary");
    $host.find(".wl-editor").remove();
    $host.append($panel).addClass("wl-editing");
  }

  function closeEditor(which){
    CheckoutState.editing[which]=false;
    const $host = (which==="delivery") ? $("#wlDeliverySummary") : $("#wlBillingSummary");
    $host.removeClass("wl-editing").find(".wl-editor").remove();
    renderSummaries();
  }

  function saveEditor(which){
    const map = (which==="delivery") ? Fields.delivery : Fields.billing;
    const $host = (which==="delivery") ? $("#wlDeliverySummary") : $("#wlBillingSummary");
    const $panel = $host.find(".wl-editor");
    if(!$panel.length) return;

    const missing=[];
    function v(sel){ return $panel.find(sel+"_shadow").val(); }
    if (!safeText(v(map.line1))) missing.push("Address line 1");
    if (!safeText(v(map.city)))  missing.push("City");
    if (!safeText(v(map.zip)))   missing.push("ZIP");
    if (which==="delivery" && !safeText(v(map.state))) missing.push("State");
    if (missing.length){ alert("Please complete: " + missing.join(", ")); return; }

    withNoPostback(()=>{
      $panel.find("input, select, textarea").each(function(){
        const shadowId=$(this).attr("id")||"";
        const realId=shadowId.replace("_shadow","");
        const $real=$("#"+realId);
        if($real.length){ $real.val($(this).val()).trigger("input"); }
      });
    });

    pullFromDOM();
    renderSummaries();
    closeEditor(which);
  }

  // ===========================
  // ASYNC PREFILL
  // ===========================
  function prefillFromAddressBook(){
  return new Promise(resolve=>{
    try{
      if (!$("#ctl00_PageBody_CustomerAddressSelector_SelectAddressLinkButton").length) return resolve(false);
      const $entries=$(".AddressSelectorEntry"); if(!$entries.length) return resolve(false);

      let chosen=$entries.first(), smallest=parseInt(chosen.find(".AddressId").text().trim(),10);
      $entries.each(function(){
        const id=parseInt($(this).find(".AddressId").text().trim(),10);
        if (id<smallest){ smallest=id; chosen=$(this); }
      });

      const s = chosen.find("dd p").first().text().trim();
      // Common patterns:
      // "123 Main St, City, ST, 77833"
      // "123 Main St, City ST 77833"
      // "123 Main St, City, StateName, 77833"
      let line1="", city="", state="", zip="";

      // Try comma-split first
      const parts = s.split(",").map(x=>x.trim()).filter(Boolean);
      if (parts.length >= 3){
        line1 = parts[0];
        city  = parts[1];

        // Last token should contain state/zip or just zip
        const tail = parts.slice(2).join(", ");
        // Try "ST 77833" or "StateName 77833"
        const m1 = tail.match(/([A-Za-z\. ]+?)\s+(\d{5}(?:-\d{4})?)$/);
        if (m1){
          state = m1[1].trim();
          zip   = m1[2].trim();
        } else {
          // If there's a trailing pure zip token, pop it
          const z = tail.match(/(\d{5}(?:-\d{4})?)$/);
          if (z){ zip = z[1]; state = tail.replace(z[1],"").trim(); }
          else { state = tail.trim(); }
        }
      } else {
        // Fallback: "City ST 77833" after first comma
        const m2 = s.match(/^(.*?)\,\s*(.+?)\s+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
        if (m2){ line1=m2[1]; city=m2[2]; state=m2[3]; zip=m2[4]; }
      }

      // Normalize state (expand 2-letter codes)
      if (state && state.length===2 && US_STATES[state.toUpperCase()]) {
        state = US_STATES[state.toUpperCase()];
      }

      CheckoutState.data.delivery = {
        ...CheckoutState.data.delivery,
        line1: line1 || CheckoutState.data.delivery.line1,
        city:  city  || CheckoutState.data.delivery.city,
        state: state || CheckoutState.data.delivery.state,
        zip:   zip   || CheckoutState.data.delivery.zip,
        country: CONFIG.DEFAULT_COUNTRY_TEXT
      };
      pushToDOM();
      CheckoutState.loaded.addressbook = true;
      resolve(true);
    }catch(e){ console.warn("prefillFromAddressBook error", e); resolve(false); }
  });
}


  function fetchAccountSettings(){
    return new Promise(resolve=>{
      $.get("https://webtrack.woodsonlumber.com/AccountSettings.aspx", function(html){
        const $acc=$(html);
        CheckoutState.data.delivery.firstName =
          $acc.find("#ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput").val() || "";
        CheckoutState.data.delivery.lastName  =
          $acc.find("#ctl00_PageBody_ChangeUserDetailsControl_LastNameInput").val() || "";
        const emailStr = $acc.find("#ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput").val() || "";
        CheckoutState.data.billing.email = (emailStr || "").replace(/^\([^)]*\)\s*/,"");
        pushToDOM();
        CheckoutState.loaded.account=true;
        resolve(true);
      }).fail(()=>resolve(false));
    });
  }

  function fetchTelephone(){
    return new Promise(resolve=>{
      $.get("https://webtrack.woodsonlumber.com/AccountInfo_R.aspx", function(html){
        const tel=$(html).find("#ctl00_PageBody_TelephoneLink_TelephoneLink").text().trim();
        CheckoutState.data.delivery.phone = tel || "";
        pushToDOM();
        CheckoutState.loaded.telephone=true;
        resolve(true);
      }).fail(()=>resolve(false));
    });
  }

  async function runPrefill(){
    const deliveryEmpty = !safeText($(Fields.delivery.line1).val());

    if (deliveryEmpty){
      await Promise.race([
        (async()=>{ await prefillFromAddressBook(); await fetchAccountSettings(); await fetchTelephone(); })(),
        wait(CONFIG.PREFILL_TIMEOUT_MS)
      ]);
    } else {
      await Promise.race([
        (async()=>{ await fetchAccountSettings(); await fetchTelephone(); })(),
        wait(CONFIG.PREFILL_TIMEOUT_MS)
      ]);
    }

    // Ensure default country applied if missing
    withNoPostback(()=>{
      if (!safeText($(Fields.delivery.country).val())) setSelectMatch($(Fields.delivery.country), CONFIG.DEFAULT_COUNTRY_TEXT);
      if (!safeText($(Fields.billing.country).val()))  setSelectMatch($(Fields.billing.country),  CONFIG.DEFAULT_COUNTRY_TEXT);
      $(Fields.delivery.country+","+Fields.billing.country).trigger("input");
    });

    // If billing blank but delivery filled, mirror it
    const deliveryHasAddr = !!safeText($(Fields.delivery.line1).val());
    const billingHasAddr  = !!safeText($(Fields.billing.line1).val());
    if (deliveryHasAddr && !billingHasAddr) { copyDeliveryToBilling({force:true}); }


    // Ensure default country applied if missing (both address blocks)
withNoPostback(()=>{
  const dCountryNow = $(Fields.delivery.country).find("option:selected").text().trim() || $(Fields.delivery.country).val();
  if (!safeText(dCountryNow)) setSelectMatch($(Fields.delivery.country), CONFIG.DEFAULT_COUNTRY_TEXT);

  const bCountryNow = $(Fields.billing.country).find("option:selected").text().trim() || $(Fields.billing.country).val();
  if (!safeText(bCountryNow)) setSelectMatch($(Fields.billing.country), CONFIG.DEFAULT_COUNTRY_TEXT);

  // Trigger local UI updates only
  $(Fields.delivery.country+","+Fields.billing.country).trigger("input");
});

    renderSummaries();
  }

  // ===========================
  // MODERN TOGGLES
  // ===========================
  function buildModernToggles(){
    // Transaction type
    if ($("#ctl00_PageBody_TransactionTypeDiv").length){
      $(".TransactionTypeSelector").hide();
      const html = `
        <div class="wl-toggle">
          <button type="button" class="wl-chip" id="wlTxnOrder" data-value="rdbOrder">Order</button>
          <button type="button" class="wl-chip" id="wlTxnQuote" data-value="rdbQuote">Request Quote</button>
        </div>`;
      $("#ctl00_PageBody_TransactionTypeDiv").append(html);

      function setTxn(v){
        withNoPostback(()=>{
          if (v==="rdbOrder"){
            $(Fields.radios.txnOrder).prop("checked", true);
            $("#wlTxnOrder").addClass("wl-chip--active"); $("#wlTxnQuote").removeClass("wl-chip--active");
          } else {
            $(Fields.radios.txnQuote).prop("checked", true);
            $("#wlTxnQuote").addClass("wl-chip--active"); $("#wlTxnOrder").removeClass("wl-chip--active");
          }
        });
      }
      setTxn($(Fields.radios.txnOrder).is(":checked") ? "rdbOrder" : "rdbQuote");
      $(document).on("click", "#wlTxnOrder,#wlTxnQuote", function(){ setTxn($(this).data("value")); });
    }

    // Shipping method
    if ($(".SaleTypeSelector").length){
      $(".SaleTypeSelector").hide();
      const html = `
        <div class="wl-toggle">
          <button type="button" class="wl-chip" id="wlShipDeliver" data-value="rbDelivered">Delivered</button>
          <button type="button" class="wl-chip" id="wlShipPickup"  data-value="rbCollectLater">Pickup (Free)</button>
        </div>`;
      $(".epi-form-col-single-checkout:has(.SaleTypeSelector)").append(html);

      function setShip(v){
        withNoPostback(()=>{
          if (v==="rbDelivered"){
            $(Fields.radios.shipDeliv).prop("checked", true);
            $("#wlShipDeliver").addClass("wl-chip--active"); $("#wlShipPickup").removeClass("wl-chip--active");
          } else {
            $(Fields.radios.shipPickup).prop("checked", true);
            $("#wlShipPickup").addClass("wl-chip--active"); $("#wlShipDeliver").removeClass("wl-chip--active");
          }
          renderSummaries();
        });
      }
      setShip($(Fields.radios.shipDeliv).is(":checked") ? "rbDelivered" : "rbCollectLater");
      $(document).on("click", "#wlShipDeliver,#wlShipPickup", function(){ setShip($(this).data("value")); });
    }
  }

  // ===========================
  // AUTO-CONTINUE (Buy Now)
  // ===========================
  async function maybeAutoContinue(){
    if (!CONFIG.AUTO_CONTINUE_ENABLED) return;
    const intent = hasBuyNowParam || hasBuyNowStorage;
    if (!intent) return;

    await wait(CONFIG.AUTO_CONTINUE_GRACE_MS);
    pullFromDOM();

    const deliveryOk = validateRequired("delivery");
    const billingOk  = validateRequired("billing"); // adjust later if billing not required for pickup
    if (deliveryOk && billingOk){
      const clicked = tryClickContinue();
      if (!clicked){ firstExisting(CONFIG.CONTINUE_SELECTORS).addClass("wl-pulse"); }
    } else {
      console.info("Buy-now intent detected, but required fields missing—auto-continue skipped.");
    }
  }

  // ===========================
  // REBIND / EVENTS
  // ===========================
  function bindGlobalHandlers(){
    // Edit flows
    $(document).off("click", "#wlEditDelivery").on("click", "#wlEditDelivery", ()=>openEditor("delivery"));
    $(document).off("click", "#wlEditBilling").on("click",  "#wlEditBilling",  ()=>openEditor("billing"));
    $(document).off("click", "#wlSave_delivery").on("click", "#wlSave_delivery", ()=>saveEditor("delivery"));
    $(document).off("click", "#wlCancel_delivery").on("click", "#wlCancel_delivery", ()=>closeEditor("delivery"));
    $(document).off("click", "#wlSave_billing").on("click",  "#wlSave_billing",  ()=>saveEditor("billing"));
    $(document).off("click", "#wlCancel_billing").on("click","#wlCancel_billing",()=>closeEditor("billing"));

    // Our own lightweight re-render (no postback)
    let t=null;
    $(document).off("input change blur", ".epi-form-group-checkout input, .epi-form-group-checkout select")
      .on("input change blur", ".epi-form-group-checkout input, .epi-form-group-checkout select", function(){
        clearTimeout(t); t=setTimeout(()=>renderSummaries(), 120);
      });

    // Intercept built-in copy link (no postback)
    $(document).off("click", "#ctl00_PageBody_CopyDeliveryAddressLinkButton")
      .on("click", "#ctl00_PageBody_CopyDeliveryAddressLinkButton", function(e){
        e.preventDefault();
        copyDeliveryToBilling({force:true});
        renderSummaries();
      });

    // While billing is blank, keep it synced with delivery edits
    const deliveryWatch = [
      Fields.delivery.line1, Fields.delivery.line2, Fields.delivery.line3,
      Fields.delivery.city, Fields.delivery.state, Fields.delivery.zip, Fields.delivery.country
    ].join(",");
    $(document).off("change", deliveryWatch).on("change", deliveryWatch, function(){
      if (!safeText($(Fields.billing.line1).val())) {
        copyDeliveryToBilling();
        renderSummaries();
      }
    });
  }

  function initOrReinit(){
    neutralizeAutoPostback();
    hideNativeBlocks();
    buildSummaries();
    buildModernToggles();
    bindGlobalHandlers();
    renderSummaries();
  }

  function attachPostbackHooks(){
    if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager){
      const prm = Sys.WebForms.PageRequestManager.getInstance();
      prm.add_endRequest(function(){ initOrReinit(); });
    } else {
      const mo = new MutationObserver((muts)=>{
        const changed = muts.some(m => (m.addedNodes && m.addedNodes.length));
        if (changed) initOrReinit();
      });
      mo.observe(document.body, {childList:true, subtree:true});
    }
  }

  // ===========================
  // BOOT
  // ===========================
  $(document).ready(async function(){
    console.log("WL modern checkout initializing...");
    $('.container .row').not('.shopping-cart-item').css('display', 'block');

    // Copy-link label
    $("#ctl00_PageBody_CopyDeliveryAddressLinkButton")
      .text("Billing address is the same as delivery address");

    initOrReinit();
    attachPostbackHooks();

    await runPrefill();

    if (hasBuyNowParam) setBuyNowIntent(true);

    await maybeAutoContinue();
  });

})(jQuery);

