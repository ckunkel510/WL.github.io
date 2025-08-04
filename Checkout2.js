(function($){
  // ===========================
  // CONFIG & FEATURE FLAGS
  // ===========================
  const CONFIG = {
    BUY_NOW_PARAM: "buy_now",
    BUY_NOW_STORAGE_KEY: "wl_buy_now_intent",
    AUTO_CONTINUE_ENABLED: true,
    AUTO_CONTINUE_GRACE_MS: 600,     // let UI render
    PREFILL_TIMEOUT_MS: 6000,        // fail-safe
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
      invoice: [
        "#ctl00_PageBody_InvoiceAddress_AddressLine1",
        "#ctl00_PageBody_InvoiceAddress_City",
        "#ctl00_PageBody_InvoiceAddress_Postcode"
      ]
    }
  };

  // ===========================
  // STATE
  // ===========================
  const CheckoutState = {
    editing: { delivery:false, invoice:false },
    loaded:  { account:false, telephone:false, addressbook:false },
    data: {
      delivery: {
        firstName:"", lastName:"", phone:"", line1:"", line2:"", line3:"",
        city:"", state:"", zip:"", country:"USA"
      },
      invoice: {
        line1:"", line2:"", line3:"", city:"", state:"", zip:"", country:"USA",
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
    invoice: {
      line1:   "#ctl00_PageBody_InvoiceAddress_AddressLine1",
      line2:   "#ctl00_PageBody_InvoiceAddress_AddressLine2",
      line3:   "#ctl00_PageBody_InvoiceAddress_AddressLine3",
      city:    "#ctl00_PageBody_InvoiceAddress_City",
      state:   "#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList",
      zip:     "#ctl00_PageBody_InvoiceAddress_Postcode",
      country: "#ctl00_PageBody_InvoiceAddress_CountrySelector1",
      email:   "#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox"
    }
  };

  // ===========================
  // UTILS
  // ===========================
  const qs = new URLSearchParams(location.search);
  const hasBuyNowParam = qs.get(CONFIG.BUY_NOW_PARAM) === "1";
  const hasBuyNowStorage = localStorage.getItem(CONFIG.BUY_NOW_STORAGE_KEY) === "1";

  function setBuyNowIntent(on) {
    if (on) localStorage.setItem(CONFIG.BUY_NOW_STORAGE_KEY, "1");
    else    localStorage.removeItem(CONFIG.BUY_NOW_STORAGE_KEY);
  }
  function firstExisting(selArr) { for (const s of selArr){ const $el=$(s); if($el.length) return $el; } return $(); }
  function safeText(v){ return (v||"").toString().trim(); }
  function wait(ms){ return new Promise(res=>setTimeout(res,ms)); }
  function validateRequired(group){
    const list = CONFIG.REQUIRED_FIELDS[group] || [];
    for (const sel of list) {
      const $el = $(sel);
      if (!$el.length) return false;
      if (!safeText($el.val())) return false;
    }
    return true;
  }
  function tryClickContinue(){
    const $btn = firstExisting(CONFIG.CONTINUE_SELECTORS);
    if (!$btn.length) return false;
    if ($btn.is(":disabled") || $btn.css("display")==="none") return false;
    $btn.trigger("click");
    return true;
  }

  function pullFromDOM(){
    // Delivery
    const d = CheckoutState.data.delivery;
    for (const [k,sel] of Object.entries(Fields.delivery)) {
      const $el = $(sel);
      if (!$el.length) continue;
      d[k] = $el.is("select") ? ($el.find("option:selected").text().trim() || $el.val() || "") : $el.val();
    }
    const $stateSelD = $(Fields.delivery.state);
    if ($stateSelD.length) d.state = $stateSelD.find("option:selected").text().trim() || $stateSelD.val() || "";

    // Invoice
    const i = CheckoutState.data.invoice;
    for (const [k,sel] of Object.entries(Fields.invoice)) {
      const $el = $(sel);
      if (!$el.length) continue;
      i[k] = $el.is("select") ? ($el.find("option:selected").text().trim() || $el.val() || "") : $el.val();
    }
    const $stateSelI = $(Fields.invoice.state);
    if ($stateSelI.length) i.state = $stateSelI.find("option:selected").text().trim() || $stateSelI.val() || "";

    CheckoutState.data.transactionType =
      $("#ctl00_PageBody_TransactionTypeSelector_rdbOrder").is(":checked") ? "rdbOrder" :
      $("#ctl00_PageBody_TransactionTypeSelector_rdbQuote").is(":checked") ? "rdbQuote" : null;

    CheckoutState.data.shippingMethod =
      $("#ctl00_PageBody_SaleTypeSelector_rbDelivered").is(":checked") ? "rbDelivered" :
      $("#ctl00_PageBody_SaleTypeSelector_rbCollectLater").is(":checked") ? "rbCollectLater" : null;
  }

  function pushToDOM(){
    const d = CheckoutState.data.delivery;
    const i = CheckoutState.data.invoice;

    function setVal(sel, val, isSelect=false){
      const $el = $(sel);
      if (!$el.length) return;
      if (isSelect) {
        let matched = false;
        $el.find("option").each(function(){
          if (
            ($(this).text().trim().toLowerCase() === (val||"").toLowerCase()) ||
            (($(this).val()||"").trim().toLowerCase() === (val||"").toLowerCase())
          ){
            $(this).prop("selected", true); matched=true; return false;
          }
        });
        if (!matched && val) $el.val(val);
      } else {
        $el.val(val || "");
      }
      $el.trigger("change");
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
    setVal(Fields.delivery.state,     d.state, true);

    // Invoice
    setVal(Fields.invoice.line1,   i.line1);
    setVal(Fields.invoice.line2,   i.line2);
    setVal(Fields.invoice.line3,   i.line3);
    setVal(Fields.invoice.city,    i.city);
    setVal(Fields.invoice.zip,     i.zip);
    setVal(Fields.invoice.country, i.country, true);
    setVal(Fields.invoice.state,   i.state, true);
    setVal(Fields.invoice.email,   i.email);
  }

  // --- Helpers for Invoice copy ---
  function setSelectMatch($sel, value){
    if (!$sel.length) return;
    let matched = false;
    $sel.find("option").each(function(){
      const txt=$(this).text().trim().toLowerCase();
      const val=$(this).val()?.trim().toLowerCase();
      const want=(value||"").toLowerCase();
      if (txt===want || val===want){ $(this).prop("selected",true); matched=true; return false; }
    });
    if (!matched && value) $sel.val(value);
    $sel.trigger("change");
  }

  function copyDeliveryToInvoice(opts={force:false}){
    const d = Fields.delivery, i = Fields.invoice;
    const invoiceHasAddr = !!safeText($(i.line1).val());
    if (!opts.force && invoiceHasAddr) return false;

    $(i.line1).val($(d.line1).val());
    $(i.line2).val($(d.line2).val());
    $(i.line3).val($(d.line3).val());
    $(i.city).val($(d.city).val());
    $(i.zip).val($(d.zip).val());

    setSelectMatch($(i.country), $(d.country).find("option:selected").val() || $(d.country).val());
    setSelectMatch($(i.state),   $(d.state).find("option:selected").val()   || $(d.state).val());

    $(i.line1+","+i.line2+","+i.line3+","+i.city+","+i.zip).trigger("change");
    return true;
  }

  // ===========================
  // UI BUILDERS
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
      "label[for='locationFieldDelivery']",
      "#locationFieldDelivery",
      "#autocompleteDelivery",
      "#ctl00_PageBody_ContinueButton1",
      "#ctl00_PageBody_DeliveryAddress_AddressLine1TitleLiteral",
      Fields.delivery.line1,
      "#ctl00_PageBody_DeliveryAddress_AddressLine2TitleLiteral",
      Fields.delivery.line2,
      "#ctl00_PageBody_DeliveryAddress_AddressLine3TitleLiteral",
      Fields.delivery.line3,
      "#ctl00_PageBody_DeliveryAddress_AddressCityTitleLiteral",
      Fields.delivery.city,
      "#ctl00_PageBody_DeliveryAddress_AddressCountyTitleLiteral",
      Fields.delivery.state,
      "#ctl00_PageBody_DeliveryAddress_AddressPostcodeTitleLiteral",
      Fields.delivery.zip,
      "#ctl00_PageBody_DeliveryAddress_AddressCountryTitleLiteral",
      Fields.delivery.country,
      "#ctl00_PageBody_DeliveryAddress_ContactTelephoneRow",
      "#ctl00_PageBody_DeliveryAddress_ContactTelephoneTitleLiteral",
      Fields.delivery.phone,

      // Invoice native
      "#ctl00_PageBody_InvoiceAddress_GoogleAddressSearchWrapper",
      "label[for='locationFieldInvoice']",
      "#locationFieldInvoice",
      "#autocompleteInvoice",
      "#ctl00_PageBody_InvoiceAddress_AddressLine1TitleLiteral",
      Fields.invoice.line1,
      "#ctl00_PageBody_InvoiceAddress_AddressLine2TitleLiteral",
      Fields.invoice.line2,
      "#ctl00_PageBody_InvoiceAddress_AddressLine3TitleLiteral",
      Fields.invoice.line3,
      "#ctl00_PageBody_InvoiceAddress_AddressCityTitleLiteral",
      Fields.invoice.city,
      "#ctl00_PageBody_InvoiceAddress_AddressCountyTitleLiteral",
      Fields.invoice.state,
      "#ctl00_PageBody_InvoiceAddress_AddressPostcodeTitleLiteral",
      Fields.invoice.zip,
      "#ctl00_PageBody_InvoiceAddress_AddressCountryTitleLiteral",
      Fields.invoice.country,
      "#ctl00_PageBody_InvoiceAddress_EmailAddressRow",
      "#ctl00_PageBody_InvoiceAddress_EmailAddressTitleLiteral",
      Fields.invoice.email
    ];
    $(hideList.join(",")).css({display:"none"});
  }

  function buildSummaries(){
    const $cols = $(".epi-form-col-single-checkout");
    if ($cols.length < 7) { console.warn("Not enough .epi-form-col-single-checkout columns"); return; }

    if ($cols.eq(5).find("#wlDeliverySummary").length === 0) {
      $cols.eq(5).append(`
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
    if ($cols.eq(6).find("#wlInvoiceSummary").length === 0) {
      $cols.eq(6).append(`
        <div class="wl-summary-card" id="wlInvoiceSummary">
          <div class="wl-summary-header">
            <div>
              <strong>Invoice / Billing</strong>
              <div class="wl-summary-sub" id="wlInvoiceLine"></div>
            </div>
            <button type="button" class="wl-btn-link" id="wlEditInvoice">Edit</button>
          </div>
          <div class="wl-summary-body"><div id="wlInvoiceSummaryBody"></div></div>
        </div>
      `);
    }
  }

  function renderSummaries(){
    pullFromDOM(); // sync state
    const d = CheckoutState.data.delivery;
    const i = CheckoutState.data.invoice;

    const deliveryHtml = `
      ${safeText(d.firstName)} ${safeText(d.lastName)}<br>
      ${safeText(d.line1)} ${safeText(d.line2)} ${safeText(d.line3)}<br>
      ${safeText(d.city)}${d.state ? ", "+safeText(d.state):""} ${safeText(d.zip)}<br>
      ${safeText(d.country)}<br>
      ${d.phone ? "Tel: "+safeText(d.phone):""}
    `.replace(/\s+\n/g,"\n");

    const invoiceHtml = `
      ${safeText(i.line1)} ${safeText(i.line2)} ${safeText(i.line3)}<br>
      ${safeText(i.city)}${i.state ? ", "+safeText(i.state):""} ${safeText(i.zip)}<br>
      ${safeText(i.country)}<br>
      ${i.email ? "Email: "+safeText(i.email):""}
    `.replace(/\s+\n/g,"\n");

    $("#wlDeliverySummaryBody").html(deliveryHtml);
    $("#wlInvoiceSummaryBody").html(invoiceHtml);

    $("#wlDeliveryLine").text([
      safeText(d.line1),
      [safeText(d.city), safeText(d.state)].filter(Boolean).join(", "),
      safeText(d.zip)
    ].filter(Boolean).join(" • "));

    $("#wlInvoiceLine").text([
      safeText(i.line1),
      [safeText(i.city), safeText(i.state)].filter(Boolean).join(", "),
      safeText(i.zip)
    ].filter(Boolean).join(" • "));
  }

  function openEditor(which){
    CheckoutState.editing[which] = true;

    const map = which === "delivery" ? Fields.delivery : Fields.invoice;
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
      const $orig = $(row.sel).first();
      if (!$orig.length) return;
      let $clone = $orig.clone(true,true);
      $clone.attr("id", $orig.attr("id")+"_shadow").removeAttr("name");
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

    const $host = (which==="delivery") ? $("#wlDeliverySummary") : $("#wlInvoiceSummary");
    $host.find(".wl-editor").remove();
    $host.append($panel);
    $host.addClass("wl-editing");
  }

  function closeEditor(which){
    CheckoutState.editing[which] = false;
    const $host = (which==="delivery") ? $("#wlDeliverySummary") : $("#wlInvoiceSummary");
    $host.removeClass("wl-editing");
    $host.find(".wl-editor").remove();
    renderSummaries();
  }

  function saveEditor(which){
    const map = which === "delivery" ? Fields.delivery : Fields.invoice;
    const $host = (which==="delivery") ? $("#wlDeliverySummary") : $("#wlInvoiceSummary");
    const $panel = $host.find(".wl-editor");
    if (!$panel.length) return;

    const missing = [];
    function valOf(sel){ return $panel.find(sel+"_shadow").val(); }
    if (!safeText(valOf(map.line1))) missing.push("Address line 1");
    if (!safeText(valOf(map.city)))  missing.push("City");
    if (!safeText(valOf(map.zip)))   missing.push("ZIP");
    if (which==="delivery" && !safeText(valOf(map.state))) missing.push("State");
    if (missing.length){ alert("Please complete: " + missing.join(", ")); return; }

    // Write back to REAL WebForms inputs
    $panel.find("input, select, textarea").each(function(){
      const shadowId = $(this).attr("id") || "";
      const realId = shadowId.replace("_shadow","");
      const $real = $("#"+realId);
      if ($real.length){ $real.val($(this).val()).trigger("change"); }
    });

    pullFromDOM();
    renderSummaries();
    closeEditor(which);
  }

  // ===========================
  // ASYNC PREFILL / FETCHERS
  // ===========================
  function prefillFromAddressBook(){
    return new Promise(resolve=>{
      try{
        if (!$("#ctl00_PageBody_CustomerAddressSelector_SelectAddressLinkButton").length){
          return resolve(false);
        }
        const $entries = $(".AddressSelectorEntry");
        if (!$entries.length) return resolve(false);

        let chosen = $entries.first(), smallest = parseInt(chosen.find(".AddressId").text().trim(),10);
        $entries.each(function(){
          const id = parseInt($(this).find(".AddressId").text().trim(),10);
          if (id < smallest){ smallest = id; chosen = $(this); }
        });

        const shipping = chosen.find("dd p").first().text().trim(); // "123 Main St, City, ST, 77833"
        const parts = shipping.split(",").map(s=>s.trim());
        const line1 = parts[0] || "";
        const city  = parts[1] || "";
        let state="", zip="";
        if (parts.length >= 4){
          state = parts[parts.length-2] || "";
          zip   = parts[parts.length-1] || "";
        } else if (parts.length > 2){
          const m = parts[2].match(/(.+?)\s*(\d{5}(?:-\d{4})?)?$/);
          if (m){ state = (m[1]||"").trim(); zip = m[2]||""; }
        }

        CheckoutState.data.delivery.line1 = line1;
        CheckoutState.data.delivery.city  = city;
        CheckoutState.data.delivery.state = state;
        CheckoutState.data.delivery.zip   = zip;
        CheckoutState.data.delivery.country = "USA";

        pushToDOM();
        CheckoutState.loaded.addressbook = true;
        resolve(true);
      } catch(e){
        console.warn("prefillFromAddressBook error", e);
        resolve(false);
      }
    });
  }

  function fetchAccountSettings(){
    return new Promise(resolve=>{
      $.get("https://webtrack.woodsonlumber.com/AccountSettings.aspx", function(html){
        const $acc = $(html);
        CheckoutState.data.delivery.firstName =
          $acc.find("#ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput").val() || "";
        CheckoutState.data.delivery.lastName =
          $acc.find("#ctl00_PageBody_ChangeUserDetailsControl_LastNameInput").val() || "";
        const emailStr =
          $acc.find("#ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput").val() || "";
        CheckoutState.data.invoice.email = (emailStr || "").replace(/^\([^)]*\)\s*/,"");
        CheckoutState.loaded.account = true;
        pushToDOM();
        resolve(true);
      }).fail(()=>resolve(false));
    });
  }

  function fetchTelephone(){
    return new Promise(resolve=>{
      $.get("https://webtrack.woodsonlumber.com/AccountInfo_R.aspx", function(html){
        const tel = $(html).find("#ctl00_PageBody_TelephoneLink_TelephoneLink").text().trim();
        CheckoutState.data.delivery.phone = tel || "";
        CheckoutState.loaded.telephone = true;
        pushToDOM();
        resolve(true);
      }).fail(()=>resolve(false));
    });
  }

  async function runPrefill(){
    const deliveryEmpty = !safeText($(Fields.delivery.line1).val());

    if (deliveryEmpty) {
      await Promise.race([
        (async()=>{
          await prefillFromAddressBook();
          await fetchAccountSettings();
          await fetchTelephone();
        })(),
        wait(CONFIG.PREFILL_TIMEOUT_MS)
      ]);

      // >>>>>>> INVOICE FIX: copy when invoice blank <<<<<<<
      const deliveryHasAddr = !!safeText($(Fields.delivery.line1).val());
      const invoiceHasAddr  = !!safeText($(Fields.invoice.line1).val());
      if (deliveryHasAddr && !invoiceHasAddr) { copyDeliveryToInvoice({force:true}); }

      renderSummaries();
      return;
    }

    // Delivery already had data, still fetch contact details
    await Promise.race([
      (async()=>{ await fetchAccountSettings(); await fetchTelephone(); })(),
      wait(CONFIG.PREFILL_TIMEOUT_MS)
    ]);

    // >>>>>>> INVOICE FIX: copy when invoice blank <<<<<<<
    const deliveryHasAddr = !!safeText($(Fields.delivery.line1).val());
    const invoiceHasAddr  = !!safeText($(Fields.invoice.line1).val());
    if (deliveryHasAddr && !invoiceHasAddr) { copyDeliveryToInvoice({force:true}); }

    renderSummaries();
  }

  // ===========================
  // RADIO UI (transaction & shipping)
  // ===========================
  function buildModernToggles(){
    // Transaction
    if ($("#ctl00_PageBody_TransactionTypeDiv").length){
      $(".TransactionTypeSelector").hide();
      const html = `
        <div class="wl-toggle">
          <button type="button" class="wl-chip" id="wlTxnOrder" data-value="rdbOrder">Order</button>
          <button type="button" class="wl-chip" id="wlTxnQuote" data-value="rdbQuote">Request Quote</button>
        </div>`;
      $("#ctl00_PageBody_TransactionTypeDiv").append(html);

      function setTxn(v){
        if (v==="rdbOrder"){
          $("#ctl00_PageBody_TransactionTypeSelector_rdbOrder").prop("checked", true);
          $("#wlTxnOrder").addClass("wl-chip--active"); $("#wlTxnQuote").removeClass("wl-chip--active");
        } else {
          $("#ctl00_PageBody_TransactionTypeSelector_rdbQuote").prop("checked", true);
          $("#wlTxnQuote").addClass("wl-chip--active"); $("#wlTxnOrder").removeClass("wl-chip--active");
        }
      }
      setTxn($("#ctl00_PageBody_TransactionTypeSelector_rdbOrder").is(":checked") ? "rdbOrder" : "rdbQuote");
      $(document).on("click", "#wlTxnOrder,#wlTxnQuote", function(){ setTxn($(this).data("value")); });
    }

    // Shipping
    if ($(".SaleTypeSelector").length){
      $(".SaleTypeSelector").hide();
      const html = `
        <div class="wl-toggle">
          <button type="button" class="wl-chip" id="wlShipDeliver" data-value="rbDelivered">Delivered</button>
          <button type="button" class="wl-chip" id="wlShipPickup"  data-value="rbCollectLater">Pickup (Free)</button>
        </div>`;
      $(".epi-form-col-single-checkout:has(.SaleTypeSelector)").append(html);

      function setShip(v){
        if (v==="rbDelivered"){
          $("#ctl00_PageBody_SaleTypeSelector_rbDelivered").prop("checked", true);
          $("#wlShipDeliver").addClass("wl-chip--active"); $("#wlShipPickup").removeClass("wl-chip--active");
        } else {
          $("#ctl00_PageBody_SaleTypeSelector_rbCollectLater").prop("checked", true);
          $("#wlShipPickup").addClass("wl-chip--active"); $("#wlShipDeliver").removeClass("wl-chip--active");
        }
        renderSummaries();
      }
      setShip($("#ctl00_PageBody_SaleTypeSelector_rbDelivered").is(":checked") ? "rbDelivered" : "rbCollectLater");
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
    const invoiceOk  = validateRequired("invoice"); // adjust if invoice not required for pickup
    if (deliveryOk && invoiceOk){
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
    $(document).off("click", "#wlEditInvoice").on("click", "#wlEditInvoice", ()=>openEditor("invoice"));
    $(document).off("click", "#wlSave_delivery").on("click", "#wlSave_delivery", ()=>saveEditor("delivery"));
    $(document).off("click", "#wlCancel_delivery").on("click", "#wlCancel_delivery", ()=>closeEditor("delivery"));
    $(document).off("click", "#wlSave_invoice").on("click", "#wlSave_invoice", ()=>saveEditor("invoice"));
    $(document).off("click", "#wlCancel_invoice").on("click", "#wlCancel_invoice", ()=>closeEditor("invoice"));

    // Re-render summaries on input change (debounced)
    let t=null;
    $(document).off("input change blur", ".epi-form-group-checkout input, .epi-form-group-checkout select")
      .on("input change blur", ".epi-form-group-checkout input, .epi-form-group-checkout select", function(){
        clearTimeout(t); t=setTimeout(()=>renderSummaries(), 120);
      });

    // Intercept built-in "copy delivery to invoice" to avoid postback
    $(document).off("click", "#ctl00_PageBody_CopyDeliveryAddressLinkButton")
      .on("click", "#ctl00_PageBody_CopyDeliveryAddressLinkButton", function(e){
        e.preventDefault();
        copyDeliveryToInvoice({force:true});
        renderSummaries();
      });

    // While invoice is still blank, keep it synced with delivery edits
    const deliveryWatch = [
      Fields.delivery.line1, Fields.delivery.line2, Fields.delivery.line3,
      Fields.delivery.city, Fields.delivery.state, Fields.delivery.zip, Fields.delivery.country
    ].join(",");
    $(document).off("change", deliveryWatch).on("change", deliveryWatch, function(){
      if (!safeText($(Fields.invoice.line1).val())) {
        copyDeliveryToInvoice();
        renderSummaries();
      }
    });
  }

  function initOrReinit(){
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

    // Clarify link text
    $("#ctl00_PageBody_CopyDeliveryAddressLinkButton")
      .text("Billing address is the same as delivery address");

    initOrReinit();
    attachPostbackHooks();

    await runPrefill();

    if (hasBuyNowParam) setBuyNowIntent(true);

    await maybeAutoContinue();
  });

})(jQuery);

