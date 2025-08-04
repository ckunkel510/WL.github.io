
(function($){
  // ===========================
  // CONFIG
  // ===========================
  const CONFIG = {
    DEFAULT_COUNTRY_TEXT: "USA",
    CONTINUE_SELECTORS: [
      "#ctl00_PageBody_ContinueButton1",
      "#ctl00_PageBody_ContinueButton2",
      "button[id*='ContinueButton']"
    ]
  };

  // Field maps
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
    },
    copyLink: "#ctl00_PageBody_CopyDeliveryAddressLinkButton"
  };

  // US states for fuzzy match
  const US_STATES = {
    "AL":"Alabama","AK":"Alaska","AZ":"Arizona","AR":"Arkansas","CA":"California","CO":"Colorado","CT":"Connecticut","DE":"Delaware",
    "FL":"Florida","GA":"Georgia","HI":"Hawaii","ID":"Idaho","IL":"Illinois","IN":"Indiana","IA":"Iowa","KS":"Kansas","KY":"Kentucky",
    "LA":"Louisiana","ME":"Maine","MD":"Maryland","MA":"Massachusetts","MI":"Michigan","MN":"Minnesota","MS":"Mississippi","MO":"Missouri",
    "MT":"Montana","NE":"Nebraska","NV":"Nevada","NH":"New Hampshire","NJ":"New Jersey","NM":"New Mexico","NY":"New York","NC":"North Carolina",
    "ND":"North Dakota","OH":"Ohio","OK":"Oklahoma","OR":"Oregon","PA":"Pennsylvania","RI":"Rhode Island","SC":"South Carolina","SD":"South Dakota",
    "TN":"Tennessee","TX":"Texas","UT":"Utah","VT":"Vermont","VA":"Virginia","WA":"Washington","WV":"West Virginia","WI":"Wisconsin","WY":"Wyoming","DC":"District of Columbia"
  };

  // ===========================
  // POSTBACK GUARD
  // ===========================
  let WL_SUPPRESS = false;
  const originalDoPostBack = window.__doPostBack ? window.__doPostBack.bind(window) : null;
  function suppressPostbacks(enable){
    WL_SUPPRESS = !!enable;
    if (!window.__doPostBack || !originalDoPostBack) return;
    window.__doPostBack = function(){
      if (WL_SUPPRESS) return;
      return originalDoPostBack.apply(this, arguments);
    };
  }

  // ===========================
  // SELECT MATCHING & DEFAULTS
  // ===========================
  function setSelectMatch($sel, rawValue){
    if (!$sel.length) return;
    const wantRaw = (rawValue || "").trim();
    if (!wantRaw) return;
    let want = wantRaw.toLowerCase();

    // Expand state codes to names
    if (wantRaw.length===2 && US_STATES[wantRaw.toUpperCase()]){
      want = US_STATES[wantRaw.toUpperCase()].toLowerCase();
    }

    // Country synonyms
    const synonyms = {
      "usa": ["usa","u.s.a.","united states","united states of america","us","u.s."],
      "united states": ["united states","united states of america","usa","us","u.s.","u.s.a."]
    };
    const candidates = new Set([wantRaw, want]);
    if (synonyms[want]) synonyms[want].forEach(v=>candidates.add(v.toLowerCase()));

    // Exact text/value
    let opt=null;
    $sel.find("option").each(function(){
      const txt=$(this).text().trim().toLowerCase();
      const val=(($(this).val())||"").trim().toLowerCase();
      if (candidates.has(txt) || candidates.has(val)) { opt=$(this); return false; }
    });
    // Starts with
    if (!opt) $sel.find("option").each(function(){
      const txt=$(this).text().trim().toLowerCase();
      if (txt.startsWith(want)) { opt=$(this); return false; }
    });
    // Includes
    if (!opt) $sel.find("option").each(function(){
      const txt=$(this).text().trim().toLowerCase();
      if (txt.includes(want)) { opt=$(this); return false; }
    });
    if (opt) opt.prop("selected", true);
  }

  function ensureDefaultCountry(){
    // Delivery
    const $dC=$(Fields.delivery.country);
    const dTxt=$dC.find("option:selected").text().trim() || $dC.val();
    if (!dTxt) setSelectMatch($dC, CONFIG.DEFAULT_COUNTRY_TEXT);

    // Billing
    const $bC=$(Fields.billing.country);
    const bTxt=$bC.find("option:selected").text().trim() || $bC.val();
    if (!bTxt) setSelectMatch($bC, CONFIG.DEFAULT_COUNTRY_TEXT);
  }

  // ===========================
  // SUMMARIES
  // ===========================
  function safe(v){ return (v||"").toString().trim(); }
  function renderSummaries(){
    const dFn = $(Fields.delivery.firstName).val();
    const dLn = $(Fields.delivery.lastName).val();
    const dL1 = $(Fields.delivery.line1).val();
    const dL2 = $(Fields.delivery.line2).val();
    const dL3 = $(Fields.delivery.line3).val();
    const dCity= $(Fields.delivery.city).val();
    const dStateTxt = $(Fields.delivery.state+" option:selected").text() || $(Fields.delivery.state).val();
    const dZip = $(Fields.delivery.zip).val();
    const dCountryTxt = $(Fields.delivery.country+" option:selected").text() || $(Fields.delivery.country).val();
    const dPhone = $(Fields.delivery.phone).val();

    const bL1 = $(Fields.billing.line1).val();
    const bL2 = $(Fields.billing.line2).val();
    const bL3 = $(Fields.billing.line3).val();
    const bCity= $(Fields.billing.city).val();
    const bStateTxt = $(Fields.billing.state+" option:selected").text() || $(Fields.billing.state).val();
    const bZip = $(Fields.billing.zip).val();
    const bCountryTxt = $(Fields.billing.country+" option:selected").text() || $(Fields.billing.country).val();
    const bEmail = $(Fields.billing.email).val();

    $("#wlDeliverySummaryBody").html(`
      ${safe(dFn)} ${safe(dLn)}<br>
      ${safe(dL1)} ${safe(dL2)} ${safe(dL3)}<br>
      ${safe(dCity)}${safe(dStateTxt)?", "+safe(dStateTxt):""} ${safe(dZip)}<br>
      ${safe(dCountryTxt)}<br>
      ${safe(dPhone) ? "Tel: "+safe(dPhone):""}
    `.replace(/\s+\n/g,"\n"));
    $("#wlBillingSummaryBody").html(`
      ${safe(bL1)} ${safe(bL2)} ${safe(bL3)}<br>
      ${safe(bCity)}${safe(bStateTxt)?", "+safe(bStateTxt):""} ${safe(bZip)}<br>
      ${safe(bCountryTxt)}<br>
      ${safe(bEmail) ? "Email: "+safe(bEmail):""}
    `.replace(/\s+\n/g,"\n"));

    $("#wlDeliveryLine").text([ safe(dL1), [safe(dCity), safe(dStateTxt)].filter(Boolean).join(", "), safe(dZip) ].filter(Boolean).join(" • "));
    $("#wlBillingLine").text([  safe(bL1), [safe(bCity), safe(bStateTxt)].filter(Boolean).join(", "), safe(bZip) ].filter(Boolean).join(" • "));
  }

  // ===========================
  // SUMMARY CARDS + MODALS
  // ===========================
  function mountSummaryCards(){
    const $deliveryMount = $(Fields.delivery.firstName).closest(".epi-form-col-single-checkout, .epi-form-group-checkout").first();
    const $billingMount  = $(Fields.billing.line1).closest(".epi-form-col-single-checkout, .epi-form-group-checkout").first();

    if ($deliveryMount.find("#wlDeliverySummary").length===0){
      $deliveryMount.append(`
        <div class="wl-summary-card" id="wlDeliverySummary">
          <div class="wl-summary-header">
            <div>
              <strong>Delivery Address</strong>
              <div class="wl-summary-sub" id="wlDeliveryLine"></div>
            </div>
            <button type="button" class="wl-btn-link" id="wlOpenDelivery">Edit</button>
          </div>
          <div class="wl-summary-body"><div id="wlDeliverySummaryBody"></div></div>
        </div>
      `);
    }
    if ($billingMount.find("#wlBillingSummary").length===0){
      $billingMount.append(`
        <div class="wl-summary-card" id="wlBillingSummary">
          <div class="wl-summary-header">
            <div>
              <strong>Billing Address</strong>
              <div class="wl-summary-sub" id="wlBillingLine"></div>
            </div>
            <button type="button" class="wl-btn-link" id="wlOpenBilling">Edit</button>
          </div>
          <div class="wl-summary-body"><div id="wlBillingSummaryBody"></div></div>
        </div>
      `);
    }
  }

  function mountModalsOnce(){
    if ($("#wlModalOverlay").length) return;
    $("body").append(`
      <div id="wlModalOverlay" class="wl-modal-overlay" aria-hidden="true">
        <div class="wl-modal">
          <div class="wl-modal-header">
            <h3 id="wlModalTitle">Edit</h3>
            <button type="button" class="wl-modal-close" id="wlModalClose" aria-label="Close">×</button>
          </div>
          <div class="wl-modal-body">
            <form id="wlModalForm" class="wl-modal-grid"></form>
          </div>
          <div class="wl-modal-footer">
            <button type="button" class="wl-btn-secondary" id="wlModalCancel">Cancel</button>
            <button type="button" class="wl-btn-primary" id="wlModalSave">Save</button>
          </div>
        </div>
      </div>
    `);
  }

  // keep track of original parents to restore nodes
  const _park = { which:null, nodes:[], parents:[], nextSiblings:[] };

  function fieldList(which){
    const F = which==="delivery" ? Fields.delivery : Fields.billing;
    // ORDER in modal
    const list = which==="delivery"
      ? [F.firstName,F.lastName,F.phone,F.line1,F.line2,F.line3,F.city,F.state,F.zip,F.country]
      : [F.line1,F.line2,F.line3,F.city,F.state,F.zip,F.country,Fields.billing.email];
    return list.map(sel => $(sel).closest(".epi-form-group-checkout").length
      ? $(sel).closest(".epi-form-group-checkout")[0]
      : $(sel)[0] ).filter(Boolean); // use the nearest group if available
  }

  function openEditor(which){
    // Show overlay
    $("#wlModalTitle").text(which==="delivery" ? "Edit Delivery Address" : "Edit Billing Address");
    const $form = $("#wlModalForm").empty();
    $("#wlModalOverlay").addClass("is-open").attr("aria-hidden","false");

    // suppress postbacks while moving nodes
    suppressPostbacks(true);

    // gather nodes (unique) and move them into modal
    const nodes = fieldList(which);
    // hide any labels with duplicate text to reduce clutter
    nodes.forEach(n=>{
      const $n=$(n);
      // remember original parent and next sibling to restore order
      _park.parents.push($n.parent()[0]);
      _park.nextSiblings.push($n[0].nextSibling);
      _park.nodes.push(n);
      // make sure the inner inputs are visible in modal
      $n.find("label, input, select, textarea").css("display",""); // reset inline hides
      $n.appendTo($form); // move to modal
    });

    _park.which = which;
  }

  function restoreNodes(){
    // move nodes back to their original place in the DOM
    for (let i=0;i<_park.nodes.length;i++){
      const node = _park.nodes[i];
      const parent = _park.parents[i];
      const next = _park.nextSiblings[i];
      if (next && next.parentNode===parent){
        parent.insertBefore(node, next);
      } else {
        parent.appendChild(node);
      }
    }
    // reset park
    _park.which=null; _park.nodes=[]; _park.parents=[]; _park.nextSiblings=[];
    // re-apply compacting (we still want the native blocks hidden on page)
    hideNativeBlocksOnPage();
    // allow postbacks again
    suppressPostbacks(false);
  }

  function saveEditor(){
    // Optional lightweight validation
    const which = _park.which;
    const F = which==="delivery" ? Fields.delivery : Fields.billing;
    const required = which==="delivery"
      ? [F.firstName,F.lastName,F.line1,F.city,F.state,F.zip]
      : [F.line1,F.city,F.zip];
    const missing = required.filter(sel=> !safe($(sel).val()));
    if (missing.length){
      alert("Please complete the required fields.");
      return;
    }
    // Set defaults (country/state if needed)
    ensureDefaultCountry();
    // Close & restore
    closeModal();
    // Update summaries
    renderSummaries();
  }

  function closeModal(){
    $("#wlModalOverlay").removeClass("is-open").attr("aria-hidden","true");
    restoreNodes();
  }

  // Hide native blocks on the page so only summaries show (we'll move them into modal when editing)
  function hideNativeBlocksOnPage(){
    const hideSel = [
      // Delivery
      Fields.delivery.firstName, Fields.delivery.lastName, Fields.delivery.phone,
      Fields.delivery.line1, Fields.delivery.line2, Fields.delivery.line3,
      Fields.delivery.city, Fields.delivery.state, Fields.delivery.zip, Fields.delivery.country,
      // Billing
      Fields.billing.line1, Fields.billing.line2, Fields.billing.line3,
      Fields.billing.city, Fields.billing.state, Fields.billing.zip,
      Fields.billing.country, Fields.billing.email
    ];
    $(hideSel.join(",")).each(function(){
      const $group = $(this).closest(".epi-form-group-checkout");
      if ($group.length) $group.css("display","none"); else $(this).css("display","none");
    });

    // Keep the copy link but reword it
    $(Fields.copyLink).text("Billing address is the same as delivery address");
  }

  // Copy delivery -> billing (no postback; same inputs)
  function copyDeliveryToBilling(){
    $(Fields.billing.line1).val($(Fields.delivery.line1).val());
    $(Fields.billing.line2).val($(Fields.delivery.line2).val());
    $(Fields.billing.line3).val($(Fields.delivery.line3).val());
    $(Fields.billing.city).val($(Fields.delivery.city).val());
    $(Fields.billing.zip).val($(Fields.delivery.zip).val());
    // match country/state
    const dCountryTxt = $(Fields.delivery.country+" option:selected").text() || $(Fields.delivery.country).val();
    const dStateTxt   = $(Fields.delivery.state+" option:selected").text()   || $(Fields.delivery.state).val();
    setSelectMatch($(Fields.billing.country), dCountryTxt || CONFIG.DEFAULT_COUNTRY_TEXT);
    setSelectMatch($(Fields.billing.state), dStateTxt);
    renderSummaries();
  }

  // ===========================
  // BINDINGS
  // ===========================
  function bindHandlers(){
    $(document).off("click", "#wlOpenDelivery").on("click", "#wlOpenDelivery", ()=>openEditor("delivery"));
    $(document).off("click", "#wlOpenBilling").on("click",  "#wlOpenBilling",  ()=>openEditor("billing"));
    $(document).off("click", "#wlModalClose").on("click",   "#wlModalClose",   closeModal);
    $(document).off("click", "#wlModalCancel").on("click",  "#wlModalCancel",  closeModal);
    $(document).off("click", "#wlModalSave").on("click",    "#wlModalSave",    saveEditor);

    // Copy link -> no postback
    $(document).off("click", Fields.copyLink).on("click", Fields.copyLink, function(e){
      e.preventDefault(); copyDeliveryToBilling();
    });

    // Update summaries when native inputs change (on submit or AJAX prefill)
    const watch = [
      Fields.delivery.firstName, Fields.delivery.lastName, Fields.delivery.phone,
      Fields.delivery.line1, Fields.delivery.line2, Fields.delivery.line3,
      Fields.delivery.city, Fields.delivery.state, Fields.delivery.zip, Fields.delivery.country,
      Fields.billing.line1, Fields.billing.line2, Fields.billing.line3,
      Fields.billing.city, Fields.billing.state, Fields.billing.zip,
      Fields.billing.country, Fields.billing.email
    ].join(",");
    $(document).off("input change", watch).on("input change", watch, function(){
      renderSummaries();
    });
  }

  // Re-init after UpdatePanel postbacks
  function attachPostbackHooks(){
    if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager){
      const prm = Sys.WebForms.PageRequestManager.getInstance();
      prm.add_endRequest(function(){
        hideNativeBlocksOnPage();
        mountSummaryCards();
        mountModalsOnce();
        bindHandlers();
        ensureDefaultCountry();
        renderSummaries();
      });
    }
  }

  // ===========================
  // BOOT
  // ===========================
  $(document).ready(function(){
    // Layout
    mountSummaryCards();
    mountModalsOnce();
    hideNativeBlocksOnPage();
    bindHandlers();
    attachPostbackHooks();

    // Country/state safety after your prefill runs
    ensureDefaultCountry();
    renderSummaries();
  });

})(jQuery);

