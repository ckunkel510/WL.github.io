// == Custom Checkout UI: Summary + Left Drawer Editors ==
(function () {
  if (window.__checkoutUIInit) return;
  window.__checkoutUIInit = true;

  $(document).ready(function () {
    // ============= Utilities =============
    const first = (arr) => arr.find((sel) => $(sel).length);
    const valOf = (selOrArr) => {
      const s = Array.isArray(selOrArr) ? first(selOrArr) : selOrArr;
      return s ? $(s).val() : "";
    };
    const setVal = (selOrArr, v) => {
      const s = Array.isArray(selOrArr) ? first(selOrArr) : selOrArr;
      if (s) $(s).val(v).trigger("change");
    };
    const setChecked = (sel, checked) => $(sel).prop("checked", !!checked).trigger("change");
    const T = (s) => (s || "").toString().trim();
    const jqWrap = (v) => $.isFunction(v) ? $(v()) : $(v);

    // ============= Selectors =============
    const S = {
      txnOrder:  "#ctl00_PageBody_TransactionTypeSelector_rdbOrder",
      txnQuote:  "#ctl00_PageBody_TransactionTypeSelector_rdbQuote",
      txnWrap:   "#ctl00_PageBody_TransactionTypeDiv",

      shipDelivered: "#ctl00_PageBody_SaleTypeSelector_rbDelivered",
      shipPickup:    "#ctl00_PageBody_SaleTypeSelector_rbCollectLater",
      shipWrapGuess: ".epi-form-col-single-checkout:has(.SaleTypeSelector)",

      dateWrap: "#ctl00_PageBody_dtRequired_DatePicker_wrapper",
      dateInputs: [
        "#ctl00_PageBody_dtRequired_dateInput",
        "#ctl00_PageBody_dtRequired_dateInput_text",
        "#ctl00_PageBody_dtRequired_DatePicker input[type='text']"
      ],

      po: [
        "#ctl00_PageBody_PurchaseOrderNo",
        "#ctl00_PageBody_POTextBox",
        "input[id*='PurchaseOrder'][type='text']",
        "input[id*='PONumber'][type='text']"
      ],
      notes: [
        "#ctl00_PageBody_SpecialInstructionsTextBox",
        "textarea[id*='Special']",
        "textarea[id*='Notes']"
      ],

      del: {
        first:  "#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox",
        last:   "#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox",
        line1:  "#ctl00_PageBody_DeliveryAddress_AddressLine1",
        line2:  "#ctl00_PageBody_DeliveryAddress_AddressLine2",
        line3:  "#ctl00_PageBody_DeliveryAddress_AddressLine3",
        city:   "#ctl00_PageBody_DeliveryAddress_City",
        county: "#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList",
        zip:    "#ctl00_PageBody_DeliveryAddress_Postcode",
        country:"#ctl00_PageBody_DeliveryAddress_CountrySelector",
        phone:  "#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox"
      },
      inv: {
        line1:  "#ctl00_PageBody_InvoiceAddress_AddressLine1",
        line2:  "#ctl00_PageBody_InvoiceAddress_AddressLine2",
        line3:  "#ctl00_PageBody_InvoiceAddress_AddressLine3",
        city:   "#ctl00_PageBody_InvoiceAddress_City",
        county: "#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList",
        zip:    "#ctl00_PageBody_InvoiceAddress_Postcode",
        country:"#ctl00_PageBody_InvoiceAddress_CountrySelector1, #ctl00_PageBody_InvoiceAddress_CountrySelector",
        email:  "#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox"
      },

      copyDelToInv: "#ctl00_PageBody_CopyDeliveryAddressLinkButton",
      rowGroup: ".epi-form-group-checkout"
    };

    // Keep your hide lists
    const deliveryHidden = [
      "#ctl00_PageBody_DeliveryAddress_ContactNameTitleLiteral",
      "label:contains('First name:')",
      "label:contains('Last name:')",
      S.del.first, S.del.last,
      "#ctl00_PageBody_DeliveryAddress_GoogleAddressSearchWrapper",
      "label[for='locationFieldDelivery']",
      "#locationFieldDelivery",
      "#ctl00_PageBody_DeliveryAddress_AddressLine1TitleLiteral",
      S.del.line1,
      "#ctl00_PageBody_DeliveryAddress_AddressLine2TitleLiteral",
      S.del.line2,
      "#ctl00_PageBody_DeliveryAddress_AddressLine3TitleLiteral",
      S.del.line3,
      "#ctl00_PageBody_DeliveryAddress_AddressCityTitleLiteral",
      S.del.city,
      "#ctl00_PageBody_DeliveryAddress_AddressCountyTitleLiteral",
      S.del.county,
      "#ctl00_PageBody_DeliveryAddress_AddressPostcodeTitleLiteral",
      S.del.zip,
      "#ctl00_PageBody_DeliveryAddress_AddressCountryTitleLiteral",
      S.del.country,
      "#ctl00_PageBody_DeliveryAddress_ContactTelephoneRow",
      "#ctl00_PageBody_DeliveryAddress_ContactTelephoneTitleLiteral",
      S.del.phone,
      "#autocompleteDelivery",
      "#ctl00_PageBody_ContinueButton1"
    ];
    const invoiceHidden = [
      "#ctl00_PageBody_InvoiceAddress_GoogleAddressSearchWrapper",
      "label[for='locationFieldInvoice']",
      "#locationFieldInvoice",
      "#autocompleteInvoice",
      "#ctl00_PageBody_InvoiceAddress_AddressLine1TitleLiteral",
      S.inv.line1,
      "#ctl00_PageBody_InvoiceAddress_AddressLine2TitleLiteral",
      S.inv.line2,
      "#ctl00_PageBody_InvoiceAddress_AddressLine3TitleLiteral",
      S.inv.line3,
      "#ctl00_PageBody_InvoiceAddress_AddressCityTitleLiteral",
      S.inv.city,
      "#ctl00_PageBody_InvoiceAddress_AddressCountyTitleLiteral",
      S.inv.county,
      "#ctl00_PageBody_InvoiceAddress_AddressPostcodeTitleLiteral",
      S.inv.zip,
      "#ctl00_PageBody_InvoiceAddress_AddressCountryTitleLiteral",
      S.inv.country,
      "#ctl00_PageBody_InvoiceAddress_EmailAddressRow",
      "#ctl00_PageBody_InvoiceAddress_EmailAddressTitleLiteral",
      S.inv.email
    ];

    // Hide native rows; show rest
    $(deliveryHidden.join(", ")).hide();
    $(invoiceHidden.join(", ")).hide();
    $(".container .row").not(".shopping-cart-item").show();
    $(S.copyDelToInv).text("Billing address is the same as delivery address");

    // ============= Summary + Left Drawer DOM =============
    const panelHTML = `
      <div class="checkout-layout-wrapper">
        <div class="checkout-summary-panel" id="checkoutSummaryPanel">
          <h2>Your Order Summary</h2>
          ${[
            ["order-type","Order Type"],
            ["order-method","Order Method"],
            ["date","Date"],
            ["po","PO Number"],
            ["notes","Special Notes"],
            ["delivery","Delivery Address"],
            ["invoice","Invoice Address"],
            ["contact","Contact Info"],
          ].map(([key,label]) => `
            <div class="checkout-summary-section" data-section="${key}">
              <div class="section-title-row">
                <span class="section-status" id="status-${key}">•</span>
                <h3>${label}</h3>
              </div>
              <p id="summary-${key}">Loading...</p>
              <button class="edit-button" data-edit="${key}">Edit</button>
            </div>
          `).join("")}
        </div>
      </div>
    `;
    $(S.txnWrap).before(panelHTML);

    // Left drawer elements appended to body to avoid overflow clipping
    const drawerHTML = `
      <div class="modal-overlay" id="checkoutModalOverlay"></div>
      <div class="side-modal" id="checkoutSideModal">
        <div class="modal-header">
          <h3 id="checkoutModalTitle">Edit</h3>
          <button class="btn-secondary" id="modalCloseBtn">Close</button>
        </div>
        <div class="modal-body" id="checkoutModalBody"></div>
        <div class="modal-actions">
          <button class="btn-secondary" id="modalCancelBtn">Cancel</button>
          <button class="edit-button" id="modalSaveBtn">Save</button>
        </div>
      </div>
    `;
    $("body").append(drawerHTML);

    // ============= Transaction & Shipping buttons =============
    function updateTxn(val) {
      const isOrder = (val === "rdbOrder");
      setChecked(S.txnOrder, isOrder);
      setChecked(S.txnQuote, !isOrder);
      refreshSummary();
    }
    function updateShip(val) {
      const isDelivered = (val === "rbDelivered");
      setChecked(S.shipDelivered, isDelivered);
      setChecked(S.shipPickup, !isDelivered);
      refreshSummary();
    }

    if ($(S.txnWrap).length) {
      $(".TransactionTypeSelector").hide();
      $(S.txnWrap).append(`
        <div class="modern-transaction-selector" style="display:flex; gap:.5rem; margin-bottom:.75rem;">
          <button id="btnOrder" class="edit-button" data-value="rdbOrder">Order</button>
          <button id="btnQuote" class="edit-button btn-secondary" data-value="rdbQuote">Request Quote</button>
        </div>
      `);
      updateTxn($(S.txnOrder).is(":checked") ? "rdbOrder" : "rdbQuote");
      $(document).on("click", ".modern-transaction-selector button", function () {
        updateTxn($(this).data("value"));
      });
    }

    if ($(".SaleTypeSelector").length) {
      $(".SaleTypeSelector").hide();
      $(S.shipWrapGuess).append(`
        <div class="modern-shipping-selector" style="display:flex; gap:.5rem;">
          <button id="btnDelivered" class="edit-button" data-value="rbDelivered">Delivered</button>
          <button id="btnPickup" class="edit-button btn-secondary" data-value="rbCollectLater">Pickup (Free)</button>
        </div>
      `);
      updateShip($(S.shipDelivered).is(":checked") ? "rbDelivered" : "rbCollectLater");
      $(document).on("click", ".modern-shipping-selector button", function () {
        updateShip($(this).data("value"));
      });
    }

    // ============= Account Prefill (kept) =============
    $.get("https://webtrack.woodsonlumber.com/AccountSettings.aspx", function (data) {
      const $acc = $(data);
      const fn = $acc.find("#ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput").val() || "";
      const ln = $acc.find("#ctl00_PageBody_ChangeUserDetailsControl_LastNameInput").val() || "";
      let email = $acc.find("#ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput").val() || "";
      email = email.replace(/^\([^)]*\)\s*/, "");
      setVal(S.del.first, fn);
      setVal(S.del.last, ln);
      setVal(S.inv.email, email);
      refreshSummary();
    });
    $.get("https://webtrack.woodsonlumber.com/AccountInfo_R.aspx", function (data) {
      const tel = $(data).find("#ctl00_PageBody_TelephoneLink_TelephoneLink").text().trim();
      setVal(S.del.phone, tel);
      refreshSummary();
    });

    // ============= Summary & Status logic =============
    const getOrderType = () => ($(S.txnOrder).is(":checked") ? "Order" : "Request Quote");
    const getOrderMethod = () => ($(S.shipDelivered).is(":checked") ? "Delivered" : "Pickup (Free)");
    const getDateNeeded = () => T(valOf(S.dateInputs)) || "Not selected";
    const getPO     = () => T(valOf(S.po)) || "Not provided";
    const getNotes  = () => T(valOf(S.notes)) || "None";

    function getDeliverySummary() {
      const fn = T($(S.del.first).val());
      const ln = T($(S.del.last).val());
      const a1 = T($(S.del.line1).val());
      const a2 = T($(S.del.line2).val());
      const a3 = T($(S.del.line3).val());
      const ct = T($(S.del.city).val());
      const zp = T($(S.del.zip).val());
      const lines = [
        [fn, ln].filter(Boolean).join(" "),
        a1, a2, a3,
        [ct, zp].filter(Boolean).join(", ")
      ].filter(Boolean);
      return lines.join("\n") || "Not provided";
    }
    function getInvoiceSummary() {
      const a1 = T($(S.inv.line1).val());
      const a2 = T($(S.inv.line2).val());
      const a3 = T($(S.inv.line3).val());
      const ct = T($(S.inv.city).val());
      const zp = T($(S.inv.zip).val());
      const lines = [a1, a2, a3, [ct, zp].filter(Boolean).join(", ")].filter(Boolean);
      return lines.join("\n") || "Not provided";
    }
    function getContactSummary() {
      const fn = T($(S.del.first).val());
      const ln = T($(S.del.last).val());
      const ph = T($(S.del.phone).val());
      const em = T($(S.inv.email).val());
      const name = [fn, ln].filter(Boolean).join(" ") || "Name not set";
      return [name, em || "Email not set", ph || "Phone not set"].join("\n");
    }

    // Completion rules (✓ / ✗)
    function isOrderTypeOK()   { return $(S.txnOrder).is(":checked") || $(S.txnQuote).is(":checked"); }
    function isOrderMethodOK() { return $(S.shipDelivered).is(":checked") || $(S.shipPickup).is(":checked"); }
    function isDateOK()        { return !!T(valOf(S.dateInputs)); }
    function isPOOK()          { return !!T(valOf(S.po)); }              // mark red if empty (change if optional)
    function isNotesOK()       { return !!T(valOf(S.notes)); }           // mark red if empty (change if optional)
    function isDeliveryOK() {
      return !!T($(S.del.line1).val()) && !!T($(S.del.city).val()) && !!T($(S.del.zip).val());
    }
    function isInvoiceOK() {
      return !!T($(S.inv.line1).val()) && !!T($(S.inv.city).val()) && !!T($(S.inv.zip).val());
    }
    function isContactOK() {
      return !!T($(S.del.first).val()) && !!T($(S.del.last).val()) && !!T($(S.del.phone).val()) && !!T($(S.inv.email).val());
    }

    function setStatus(key, ok) {
      const $el = $("#status-" + key);
      $el.text(ok ? "✓" : "✗").toggleClass("ok", ok).toggleClass("bad", !ok);
    }

    function refreshSummary() {
      $("#summary-order-type").text(getOrderType());   setStatus("order-type",   isOrderTypeOK());
      $("#summary-order-method").text(getOrderMethod()); setStatus("order-method", isOrderMethodOK());
      $("#summary-date").text(getDateNeeded());        setStatus("date",         isDateOK());
      $("#summary-po").text(getPO());                  setStatus("po",           isPOOK());
      $("#summary-notes").text(getNotes());            setStatus("notes",        isNotesOK());
      $("#summary-delivery").text(getDeliverySummary()); setStatus("delivery",   isDeliveryOK());
      $("#summary-invoice").text(getInvoiceSummary());   setStatus("invoice",    isInvoiceOK());
      $("#summary-contact").text(getContactSummary());   setStatus("contact",    isContactOK());
    }

    $(document).on("change input blur", [
      S.txnOrder, S.txnQuote,
      S.shipDelivered, S.shipPickup,
      S.dateInputs.join(","),
      S.po.join(","), S.notes.join(","),
      S.del.first, S.del.last, S.del.line1, S.del.line2, S.del.line3, S.del.city, S.del.zip, S.del.phone,
      S.inv.line1, S.inv.line2, S.inv.line3, S.inv.city, S.inv.zip, S.inv.email
    ].join(",")).on("change input blur", refreshSummary);

    refreshSummary();

    // ============= Left Drawer Editor =============
    const originalSlots = {}; // section -> [{node,parent,nextSibling}]
    const sectionsConfig = {
      "order-type": {
        title: "Order Type",
        editSelectors: [S.txnWrap]
      },
      "order-method": {
        title: "Order Method",
        editSelectors: [function () {
          const $guess = $(S.shipWrapGuess);
          if ($guess.length) return $guess;
          const $a = $(S.shipDelivered).closest(S.rowGroup);
          const $b = $(S.shipPickup).closest(S.rowGroup);
          return $a.add($b);
        }]
      },
      "date": {
        title: "Date",
        editSelectors: [function () {
          const $w = $(S.dateWrap);
          return $w.length ? $w : jqWrap(S.dateInputs).closest(S.rowGroup);
        }]
      },
      "po": {
        title: "PO Number",
        editSelectors: [function(){
          const $i = jqWrap(S.po).first();
          return $i.length ? $i.closest(S.rowGroup + ", .epi-form-col-single-checkout, .form-group") : $();
        }]
      },
      "notes": {
        title: "Special Notes",
        editSelectors: [function(){
          const $i = jqWrap(S.notes).first();
          return $i.length ? $i.closest(S.rowGroup + ", .epi-form-col-single-checkout, .form-group") : $();
        }]
      },
      "delivery": {
        title: "Delivery Address",
        editSelectors: [function(){
          return $(deliveryHidden.join(", ")).map(function(){
            const $row = $(this).closest(S.rowGroup);
            return $row.length ? $row[0] : this;
          });
        }],
        onOpen: () => $(deliveryHidden.join(", ")).show(),
        onClose: () => $(deliveryHidden.join(", ")).hide()
      },
      "invoice": {
        title: "Invoice Address",
        editSelectors: [function(){
          return $(invoiceHidden.join(", ")).map(function(){
            const $row = $(this).closest(S.rowGroup);
            return $row.length ? $row[0] : this;
          });
        }],
        onOpen: () => $(invoiceHidden.join(", ")).show(),
        onClose: () => $(invoiceHidden.join(", ")).hide()
      },
      "contact": {
        title: "Contact Info",
        editSelectors: [function(){
          const $els = $()
            .add($(S.del.first))
            .add($(S.del.last))
            .add($(S.del.phone))
            .add($(S.inv.email));
          return $els.map(function(){
            const $row = $(this).closest(S.rowGroup);
            return $row.length ? $row[0] : this;
          });
        }]
      }
    };

    function openEditor(sectionKey) {
      const cfg = sectionsConfig[sectionKey];
      if (!cfg) return;
      $("#checkoutModalTitle").text(`Edit ${cfg.title}`);
      $("#checkoutModalBody").empty();
      $("#checkoutSideModal").attr("data-section", sectionKey);
      originalSlots[sectionKey] = [];

      if (cfg.onOpen) cfg.onOpen();

      cfg.editSelectors.forEach(sel => {
        const $nodes = jqWrap(sel);
        $nodes.each(function () {
          const node = this;
          const parent = node.parentNode;
          const nextSibling = node.nextSibling;
          originalSlots[sectionKey].push({ node, parent, nextSibling });

          const placeholder = document.createElement("div");
          placeholder.className = "_placeholder";
          parent.insertBefore(placeholder, nextSibling);

          $("#checkoutModalBody")[0].appendChild(node);
        });
      });

      $("#checkoutModalOverlay, #checkoutSideModal").addClass("active");
    }

    function closeEditor(sectionKey, save) {
      const slots = originalSlots[sectionKey] || [];
      slots.forEach(({ node, parent, nextSibling }) => {
        if (nextSibling) parent.insertBefore(node, nextSibling);
        else parent.appendChild(node);
      });
      $("#checkoutModalBody").find("._placeholder").remove();
      $("#checkoutModalBody").empty();
      $("#checkoutModalOverlay, #checkoutSideModal").removeClass("active");

      const cfg = sectionsConfig[sectionKey];
      if (cfg && cfg.onClose) cfg.onClose();

      if (save) refreshSummary();
      delete originalSlots[sectionKey];
    }

    // Open/Close events
    $(document).on("click", ".checkout-summary-panel .edit-button", function () {
      openEditor($(this).data("edit"));
    });
    $(document).on("click", "#checkoutModalOverlay, #modalCloseBtn, #modalCancelBtn", function () {
      const section = $("#checkoutSideModal").attr("data-section");
      if (section) closeEditor(section, false);
    });
    $(document).on("click", "#modalSaveBtn", function () {
      const section = $("#checkoutSideModal").attr("data-section");
      if (section) closeEditor(section, true);
    });

    // Safety: refresh on any field change
    $(document).on("change input blur", ".epi-form-group-checkout input, .epi-form-group-checkout textarea, .epi-form-group-checkout select", refreshSummary);
  });
})();
