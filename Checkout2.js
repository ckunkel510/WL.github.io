/*
  checkout_two_panel.js
  ----------------------
  Two-column checkout UI with modals and AJAX-driven field population.
*/

$(document).ready(function() {
  const $checkoutForm = $('#ctl00_PageBody_MainForm');

  // ---------------------------------------------------
  // Field selectors to hide/show
  // ---------------------------------------------------
  const deliveryHidden = [
    "#ctl00_PageBody_DeliveryAddress_ContactNameTitleLiteral",
    "label:contains('First name:'​)",
    "label:contains('Last name:'​)",
    "#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox",
    "#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox",
    "#ctl00_PageBody_DeliveryAddress_GoogleAddressSearchWrapper",
    "label[for='locationFieldDelivery']",
    "#locationFieldDelivery",
    "#ctl00_PageBody_DeliveryAddress_AddressLine1TitleLiteral",
    "#ctl00_PageBody_DeliveryAddress_AddressLine1",
    "#ctl00_PageBody_DeliveryAddress_AddressLine2TitleLiteral",
    "#ctl00_PageBody_DeliveryAddress_AddressLine2",
    "#ctl00_PageBody_DeliveryAddress_AddressLine3TitleLiteral",
    "#ctl00_PageBody_DeliveryAddress_AddressLine3",
    "#ctl00_PageBody_DeliveryAddress_AddressCityTitleLiteral",
    "#ctl00_PageBody_DeliveryAddress_City",
    "#ctl00_PageBody_DeliveryAddress_AddressCountyTitleLiteral",
    "#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList",
    "#ctl00_PageBody_DeliveryAddress_AddressPostcodeTitleLiteral",
    "#ctl00_PageBody_DeliveryAddress_Postcode",
    "#ctl00_PageBody_DeliveryAddress_AddressCountryTitleLiteral",
    "#ctl00_PageBody_DeliveryAddress_CountrySelector",
    "#ctl00_PageBody_DeliveryAddress_ContactTelephoneRow",
    "#ctl00_PageBody_DeliveryAddress_ContactTelephoneTitleLiteral",
    "#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox",
    "#autocompleteDelivery"
  ];
  const invoiceHidden = [
    "#ctl00_PageBody_InvoiceAddress_GoogleAddressSearchWrapper",
    "label[for='locationFieldInvoice']",
    "#locationFieldInvoice",
    "#autocompleteInvoice",
    "#ctl00_PageBody_InvoiceAddress_AddressLine1TitleLiteral",
    "#ctl00_PageBody_InvoiceAddress_AddressLine1",
    "#ctl00_PageBody_InvoiceAddress_AddressLine2TitleLiteral",
    "#ctl00_PageBody_InvoiceAddress_AddressLine2",
    "#ctl00_PageBody_InvoiceAddress_AddressLine3TitleLiteral",
    "#ctl00_PageBody_InvoiceAddress_AddressLine3",
    "#ctl00_PageBody_InvoiceAddress_AddressCityTitleLiteral",
    "#ctl00_PageBody_InvoiceAddress_City",
    "#ctl00_PageBody_InvoiceAddress_AddressCountyTitleLiteral",
    "#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList",
    "#ctl00_PageBody_InvoiceAddress_AddressPostcodeTitleLiteral",
    "#ctl00_PageBody_InvoiceAddress_Postcode",
    "#ctl00_PageBody_InvoiceAddress_AddressCountryTitleLiteral",
    "#ctl00_PageBody_InvoiceAddress_CountrySelector1",
    "#ctl00_PageBody_InvoiceAddress_EmailAddressRow",
    "#ctl00_PageBody_InvoiceAddress_EmailAddressTitleLiteral",
    "#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox"
  ];

  let isEditingDelivery = false;
  let isEditingInvoice  = false;

  // helper to refresh the summary displays
  function refreshReadOnlyDisplays() {
    if (!isEditingDelivery) {
      const fn = $('#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox').val();
      const ln = $('#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox').val();
      const a1 = $('#ctl00_PageBody_DeliveryAddress_AddressLine1').val();
      const ct = $('#ctl00_PageBody_DeliveryAddress_City').val();
      const zp = $('#ctl00_PageBody_DeliveryAddress_Postcode').val();
      $('.selected-address-display').html(
        `<strong>Delivery Address:</strong><br>${fn} ${ln}<br>${a1}<br>${ct}, ${zp}<br>` +
        '<button type="button" id="internalEditDeliveryAddressButton" class="edit-button">Edit Delivery Address</button>'
      );
    }
    if (!isEditingInvoice) {
      const a1 = $('#ctl00_PageBody_InvoiceAddress_AddressLine1').val();
      const ct = $('#ctl00_PageBody_InvoiceAddress_City').val();
      const zp = $('#ctl00_PageBody_InvoiceAddress_Postcode').val();
      $('.selected-invoice-address-display').html(
        `<strong>Billing Address:</strong><br>${a1}<br>${ct}, ${zp}<br>` +
        '<button type="button" id="internalEditInvoiceAddressButton" class="edit-button">Edit Billing Address</button>'
      );
    }
  }
  // re-render when any input changes
  $(document).on('change blur', '.epi-form-group-checkout input', refreshReadOnlyDisplays);

  // initial: hide all detailed fields
  $(deliveryHidden.join(',')).hide();
  $(invoiceHidden.join(',')).hide();

  // ---------------------------------------------------
  // Layout: two panels
  // ---------------------------------------------------
  const $panelsRow = $('<div class="row custom-checkout-panels"></div>');
  const $leftPanel  = $('<div id="leftPanel" class="col-md-6"></div>');
  const $rightPanel = $('<div id="rightPanel" class="col-md-6"></div>');
  $checkoutForm.wrapInner($panelsRow);
  $checkoutForm.find('.custom-checkout-panels').append($leftPanel).append($rightPanel);

  // move left-side fields
  $leftPanel.append($('#ctl00_PageBody_TransactionTypeDiv'));
  $leftPanel.append($('.modern-shipping-selector').closest('.epi-form-col-single-checkout'));
  $leftPanel.append($('#ctl00_PageBody_dtRequired_DatePicker_wrapper').closest('.epi-form-col-single-checkout'));
  $leftPanel.append($('#ctl00_PageBody_txtPurchaseOrder').closest('.epi-form-col-single-checkout'));
  $leftPanel.append($('#ctl00_PageBody_ddlBranchSelector').closest('.epi-form-col-single-checkout'));
  $leftPanel.append($('#ctl00_PageBody_txtSpecialInstructions').closest('.epi-form-col-single-checkout'));

  // navigation buttons
  $('#ctl00_PageBody_BackToCartButton1').hide();
  const $navButtons = $(
    '<div class="d-flex justify-content-between mb-3 nav-buttons">' +
      '<button id="backButton" class="btn btn-secondary">Back</button>' +
      '<button id="continueButton" class="btn btn-primary">Continue</button>' +
    '</div>'
  );
  $checkoutForm.prepend($navButtons);
  $(document).on('click', '#backButton', e => { e.preventDefault(); $('#ctl00_PageBody_BackToCartButton1').click(); });
  $(document).on('click', '#continueButton', e => { e.preventDefault(); $checkoutForm.submit(); });

  // billing sync radios
  $('#ctl00_PageBody_CopyDeliveryAddressLinkButton').replaceWith(
    '<div class="address-sync-toggle mb-3">'
      + '<label class="me-3"><input type="radio" name="billingSync" value="same" checked> Billing same as delivery</label>'
      + '<label><input type="radio" name="billingSync" value="different"> Use separate billing address</label>'
    + '</div>'
  );

  // move right-side summaries
  $rightPanel.append($('.selected-address-display').closest('.epi-form-col-single-checkout'));
  $rightPanel.append($('.selected-invoice-address-display').closest('.epi-form-col-single-checkout'));

  // ---------------------------------------------------
  // Modals for editing
  // ---------------------------------------------------
  const deliveryFields = $(deliveryHidden.join(',')).closest('.epi-form-col-single-checkout').clone();
  const invoiceFields  = $(invoiceHidden.join(',')).closest('.epi-form-col-single-checkout').clone();

  $('body').append(`
    <div class="modal fade" id="deliveryModal" tabindex="-1">
      <div class="modal-dialog modal-lg" style="z-index:1050;"><div class="modal-content">
        <div class="modal-header"><h5>Edit Delivery Address</h5>"
          + "<button class="btn-close" data-bs-dismiss="modal"></button></div>"
        + "<div class="modal-body"></div>"
        + "<div class="modal-footer">" 
          + "<button class="btn btn-secondary" data-bs-dismiss="modal">Close</button>"
          + "<button id="saveDeliveryModalButton" class="btn btn-primary">Save changes</button>"
        + "</div></div></div></div>
    <div class="modal fade" id="invoiceModal" tabindex="-1">
      <div class="modal-dialog modal-lg" style="z-index:1050;"><div class="modal-content">
        <div class="modal-header"><h5>Edit Billing Address</h5>"
          + "<button class="btn-close" data-bs-dismiss="modal"></button></div>"
        + "<div class="modal-body"></div>"
        + "<div class="modal-footer">" 
          + "<button class="btn btn-secondary" data-bs-dismiss="modal">Close</button>"
          + "<button id="saveInvoiceModalButton" class="btn btn-primary">Save changes</button>"
        + "</div></div></div></div>
  `);
  $('#deliveryModal .modal-body').append(deliveryFields);
  $('#invoiceModal  .modal-body').append(invoiceFields);

  // show/hide via edit buttons
  $(document).on('click', '#internalEditDeliveryAddressButton', () => $('#deliveryModal').modal('show'));
  $(document).on('click', '#internalEditInvoiceAddressButton',  () => $('#invoiceModal').modal('show'));
  $(document).on('click', '#saveDeliveryModalButton', () => { $('#deliveryModal').modal('hide'); $(deliveryHidden.join(',')).hide(); isEditingDelivery=false; refreshReadOnlyDisplays(); });
  $(document).on('click', '#saveInvoiceModalButton',  () => { $('#invoiceModal').modal('hide'); $(invoiceHidden.join(',')).hide();  isEditingInvoice=false;  refreshReadOnlyDisplays(); });

  // ---------------------------------------------------
  // (C) Initial Address Pre-Population
  // ---------------------------------------------------
  if (!$('#ctl00_PageBody_DeliveryAddress_AddressLine1').val()) {
    const $link = $('#ctl00_PageBody_CustomerAddressSelector_SelectAddressLinkButton');
    if ($link.length) {
      let $entries = $('.AddressSelectorEntry');
      if ($entries.length) {
        let $pick = $entries.first();
        let minId = parseInt($pick.find('.AddressId').text(),10);
        $entries.each(function(){
          const id = +$(this).find('.AddressId').text();
          if(id<minId){minId=id;$pick=$(this);}  });
        const txt = $pick.find('dd p').first().text().trim();
        const parts = txt.split(',').map(s=>s.trim());
        let [line1='',city=''] = parts;
        let state='',zip='';
        if(parts.length>=4){state=parts[parts.length-2];zip=parts[parts.length-1];}
        else if(parts.length>2){const m=parts[2].match(/(.+?)\s*(\d{5}(?:-\d{4})?)?$/);if(m){state=m[1].trim();zip=m[2]||'';}}
        $('#ctl00_PageBody_DeliveryAddress_AddressLine1').val(line1);
        $('#ctl00_PageBody_DeliveryAddress_City').val(city);
        $('#ctl00_PageBody_DeliveryAddress_Postcode').val(zip);
        $('#ctl00_PageBody_DeliveryAddress_CountrySelector').val('USA');
        $('#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList option').filter(function(){
          return $(this).text().trim().toLowerCase()===state.toLowerCase();
        }).prop('selected',true);
      }
    }
  }

  // ---------------------------------------------------
  // (D) Account & Telephone Fetch
  // ---------------------------------------------------
  $.get('https://webtrack.woodsonlumber.com/AccountSettings.aspx', function(data){
    const $acc = $(data);
    const fn = $acc.find('#ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput').val()||'';
    const ln = $acc.find('#ctl00_PageBody_ChangeUserDetailsControl_LastNameInput').val()||'';
    let email = $acc.find('#ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput').val()||'';
    email = email.replace(/^\([^)]*\)\s*/,'');
    $('#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox').val(fn);
    $('#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox').val(ln);
    $('#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox').val(email);
    refreshReadOnlyDisplays();
  });
  $.get('https://webtrack.woodsonlumber.com/AccountInfo_R.aspx', function(data){
    const tel = $(data).find('#ctl00_PageBody_TelephoneLink_TelephoneLink').text().trim();
    $('#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox').val(tel);
    refreshReadOnlyDisplays();
  });

  // initial render of summaries
  refreshReadOnlyDisplays();
});

/*
  checkout_two_panel.js
  ----------------------
  Reorganized checkout into a two-column layout with modals for editing addresses.
*/

$(document).ready(function() {
  const $checkoutForm = $('#ctl00_PageBody_MainForm'); // adjust if needed

  // 1. Initialize panels row and columns
  const $panelsRow = $('<div class="row custom-checkout-panels"></div>');
  const $leftPanel  = $('<div id="leftPanel" class="col-md-6"></div>');
  const $rightPanel = $('<div id="rightPanel" class="col-md-6"></div>');

  $checkoutForm.wrapInner($panelsRow);
  $checkoutForm.find('.custom-checkout-panels').append($leftPanel).append($rightPanel);

  // 2. Build left panel (transaction, shipping, date, PO, branch, instructions)
  $leftPanel.append($('#ctl00_PageBody_TransactionTypeDiv'));
  $leftPanel.append($('.modern-shipping-selector').closest('.epi-form-col-single-checkout'));
  $leftPanel.append($('#ctl00_PageBody_dtRequired_DatePicker_wrapper').closest('.epi-form-col-single-checkout'));
  $leftPanel.append($('#ctl00_PageBody_txtPurchaseOrder').closest('.epi-form-col-single-checkout'));
  $leftPanel.append($('#ctl00_PageBody_ddlBranchSelector').closest('.epi-form-col-single-checkout'));
  $leftPanel.append($('#ctl00_PageBody_txtSpecialInstructions').closest('.epi-form-col-single-checkout'));

  // 3. Top navigation buttons
  const $navButtons = $(
    '<div class="d-flex justify-content-between mb-3 nav-buttons">' +
      '<button id="backButton" class="btn btn-secondary">Back</button>' +
      '<button id="continueButton" class="btn btn-primary">Continue</button>' +
    '</div>'
  );
  $checkoutForm.prepend($navButtons);

  // 4. Replace billing-sync link with radio toggle
  $('#ctl00_PageBody_CopyDeliveryAddressLinkButton').replaceWith(
    '<div class="address-sync-toggle mb-3">' +
      '<label class="me-3"><input type="radio" name="billingSync" value="same" checked> Billing same as delivery</label>' +
      '<label><input type="radio" name="billingSync" value="different"> Use separate billing address</label>' +
    '</div>'
  );

  // 5. Move read-only address displays into right panel
  $rightPanel.append($('.selected-address-display').closest('.epi-form-col-single-checkout'));
  $rightPanel.append($('.selected-invoice-address-display').closest('.epi-form-col-single-checkout'));

  // 6. Prepare modals for editing addresses
  const deliveryFields = $(deliveryHidden.join(', ')).closest('.epi-form-col-single-checkout').clone();
  const invoiceFields  = $(invoiceHidden.join(', ')).closest('.epi-form-col-single-checkout').clone();

  $('body').append(`
    <div class="modal fade" id="deliveryModal" tabindex="-1">
      <div class="modal-dialog modal-lg" style="z-index:1050;">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">Edit Delivery Address</h5>" +
          "<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>" +
          "<div class="modal-body"></div>" +
          "<div class="modal-footer">" +
            "<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>" +
            "<button type="button" id="saveDeliveryModalButton" class="btn btn-primary">Save changes</button>" +
          "</div>
        </div>
      </div>
    </div>
    <div class="modal fade" id="invoiceModal" tabindex="-1">
      <div class="modal-dialog modal-lg" style="z-index:1050;">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">Edit Billing Address</h5>" +
          "<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>" +
          "<div class="modal-body"></div>" +
          "<div class="modal-footer">" +
            "<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>" +
            "<button type="button" id="saveInvoiceModalButton" class="btn btn-primary">Save changes</button>" +
          "</div>
        </div>
      </div>
    </div>
  `);

  $('#deliveryModal .modal-body').append(deliveryFields);
  $('#invoiceModal .modal-body').append(invoiceFields);

  // 7. Hook edit buttons to show modals
  $(document).on('click', '#internalEditDeliveryAddressButton', function() {
    $('#deliveryModal').modal('show');
  });
  $(document).on('click', '#internalEditInvoiceAddressButton', function() {
    $('#invoiceModal').modal('show');
  });

  // 8. Save from modals: hide modal and refresh displays
  $(document).on('click', '#saveDeliveryModalButton', function() {
    $('#deliveryModal').modal('hide');
    $('#deliveryModal').find('.epi-form-col-single-checkout').hide();
    refreshReadOnlyDisplays();
  });
  $(document).on('click', '#saveInvoiceModalButton', function() {
    $('#invoiceModal').modal('hide');
    $('#invoiceModal').find('.epi-form-col-single-checkout').hide();
    refreshReadOnlyDisplays();
  });

  // Ensure the original hidden fields are hidden initially
  $(deliveryHidden.join(', ')).hide();
  $(invoiceHidden.join(', ')).hide();

});
