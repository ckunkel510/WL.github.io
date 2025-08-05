// == Custom Checkout UI: Summary + Modal Editors ==================================
(function () {
  if (window.__checkoutUIInit) return; // prevent double‑init
  window.__checkoutUIInit = true;

  $(document).ready(function () {
    console.log("[CheckoutUI] Initializing custom checkout experience...");

    // ===================================================
    // 0. Utility helpers
    // ===================================================
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
    const safeText = (s) => (s || "").toString().trim();

    // ===================================================
    // 1. Known selectors (with fallbacks where needed)
    // ===================================================
    const SELECTORS = {
      // Transaction / Order Type
      txnOrderRadio:   "#ctl00_PageBody_TransactionTypeSelector_rdbOrder",
      txnQuoteRadio:   "#ctl00_PageBody_TransactionTypeSelector_rdbQuote",
      txnContainer:    "#ctl00_PageBody_TransactionTypeDiv",

      // Shipping / Order Method
      shipDelivered:   "#ctl00_PageBody_SaleTypeSelector_rbDelivered",
      shipPickup:      "#ctl00_PageBody_SaleTypeSelector_rbCollectLater",
      shipContainer:   ".epi-form-col-single-checkout:has(.SaleTypeSelector)",

      // Date (Required date picker)
      dateWrapper:     "#ctl00_PageBody_dtRequired_DatePicker_wrapper",
      dateInput:       [
        "#ctl00_PageBody_dtRequired_dateInput",
        "#ctl00_PageBody_dtRequired_dateInput_text",
        "#ctl00_PageBody_dtRequired_DatePicker input[type='text']"
      ],

      // PO (update with your exact ID if known)
      poInput: [
        "#ctl00_PageBody_PurchaseOrderNo",
        "#ctl00_PageBody_POTextBox",
        "input[id*='PurchaseOrder'][type='text']",
        "input[id*='PONumber'][type='text']"
      ],

      // Special Notes / Instructions
      notesInput: [
        "#ctl00_PageBody_SpecialInstructionsTextBox",
        "textarea[id*='Special']",
        "textarea[id*='Notes']"
      ],

      // Delivery Address
      del: {
        firstName: "#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox",
        lastName:  "#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox",
        line1:     "#ctl00_PageBody_DeliveryAddress_AddressLine1",
        line2:     "#ctl00_PageBody_DeliveryAddress_AddressLine2",
        line3:     "#ctl00_PageBody_DeliveryAddress_AddressLine3",
        city:      "#ctl00_PageBody_DeliveryAddress_City",
        county:    "#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList",
        zip:       "#ctl00_PageBody_DeliveryAddress_Postcode",
        country:   "#ctl00_PageBody_DeliveryAddress_CountrySelector",
        phone:     "#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox",
        container: ".epi-form-col-single-checkout:has(#ctl00_PageBody_DeliveryAddress_AddressLine1)"
      },

      // Invoice Address
      inv: {
        line1:     "#ctl00_PageBody_InvoiceAddress_AddressLine1",
        line2:     "#ctl00_PageBody_InvoiceAddress_AddressLine2",
        line3:     "#ctl00_PageBody_InvoiceAddress_AddressLine3",
        city:      "#ctl00_PageBody_InvoiceAddress_City",
        county:    "#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList",
        zip:       "#ctl00_PageBody_InvoiceAddress_Postcode",
        country:   "#ctl00_PageBody_InvoiceAddress_CountrySelector1, #ctl00_PageBody_InvoiceAddress_CountrySelector",
        email:     "#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox",
        container: ".epi-form-col-single-checkout:has(#ctl00_PageBody_InvoiceAddress_AddressLine1)"
      },

      // Copy delivery->invoice
      copyDeliveryToInvoice: "#ctl00_PageBody_CopyDeliveryAddressLinkButton",

      // Generic row wrapper (common on WebTrack)
      rowGroup: ".epi-form-group-checkout"
    };

    // Hidden elements (from your working script)
    const deliveryHidden = [
      "#ctl00_PageBody_DeliveryAddress_ContactNameTitleLiteral",
      "label:contains('First name:')",
      "label:contains('Last name:')",
      SELECTORS.del.firstName,
      SELECTORS.del.lastName,
      "#ctl00_PageBody_DeliveryAddress_GoogleAddressSearchWrapper",
      "label[for='locationFieldDelivery']",
      "#locationFieldDelivery",
      "#ctl00_PageBody_DeliveryAddress_AddressLine1TitleLiteral",
      SELECTORS.del.line1,
      "#ctl00_PageBody_DeliveryAddress_AddressLine2TitleLiteral",
      SELECTORS.del.line2,
      "#ctl00_PageBody_DeliveryAddress_AddressLine3TitleLiteral",
      SELECTORS.del.line3,
      "#ctl00_PageBody_DeliveryAddress_AddressCityTitleLiteral",
      SELECTORS.del.city,
      "#ctl00_PageBody_DeliveryAddress_AddressCountyTitleLiteral",
      SELECTORS.del.county,
      "#ctl00_PageBody_DeliveryAddress_AddressPostcodeTitleLiteral",
      SELECTORS.del.zip,
      "#ctl00_PageBody_DeliveryAddress_AddressCountryTitleLiteral",
      SELECTORS.del.country,
      "#ctl00_PageBody_DeliveryAddress_ContactTelephoneRow",
      "#ctl00_PageBody_DeliveryAddress_ContactTelephoneTitleLiteral",
      SELECTORS.del.phone,
      "#autocompleteDelivery",
      "#ctl00_PageBody_ContinueButton1"
    ];
    const invoiceHidden = [
      "#ctl00_PageBody_InvoiceAddress_GoogleAddressSearchWrapper",
      "label[for='locationFieldInvoice']",
      "#locationFieldInvoice",
      "#autocompleteInvoice",
      "#ctl00_PageBody_InvoiceAddress_AddressLine1TitleLiteral",
      SELECTORS.inv.line1,
      "#ctl00_PageBody_InvoiceAddress_AddressLine2TitleLiteral",
      SELECTORS.inv.line2,
      "#ctl00_PageBody_InvoiceAddress_AddressLine3TitleLiteral",
      SELECTORS.inv.line3,
      "#ctl00_PageBody_InvoiceAddress_AddressCityTitleLiteral",
      SELECTORS.inv.city,
      "#ctl00_PageBody_InvoiceAddress_AddressCountyTitleLiteral",
      SELECTORS.inv.county,
      "#ctl00_PageBody_InvoiceAddress_AddressPostcodeTitleLiteral",
      SELECTORS.inv.zip,
      "#ctl00_PageBody_InvoiceAddress_AddressCountryTitleLiteral",
      SELECTORS.inv.country,
      "#ctl00_PageBody_InvoiceAddress_EmailAddressRow",
      "#ctl00_PageBody_InvoiceAddress_EmailAddressTitleLiteral",
      SELECTORS.inv.email
    ];

    // Hide the native inline blocks you don't want to show
    $(deliveryHidden.join(", ")).hide();
    $(invoiceHidden.join(", ")).hide();

    // Show the rest of your checkout rows
    $(".container .row").not(".shopping-cart-item").show();

    // Relabel copy link
    $(SELECTORS.copyDeliveryToInvoice).text("Billing address is the same as delivery address");

    // ===================================================
    // 2. Build the left summary and modal containers
    // ===================================================
    const summaryHTML = `
      <div class="checkout-layout-wrapper">
        <div class="checkout-summary-panel" id="checkoutSummaryPanel">
          <h2>Your Order Summary</h2>
          ${[
            ["order-type", "Order Type"],
            ["order-method", "Order Method"],
            ["date", "Date"],
            ["po", "PO Number"],
            ["notes", "Special Notes"],
            ["delivery", "Delivery Address"],
            ["invoice", "Invoice Address"],
            ["contact", "Contact Info"]
          ].map(([slug, title]) => `
            <div class="checkout-summary-section" data-section="${slug}">
              <h3>${title}</h3>
              <p id="summary-${slug}">Loading...</p>
              <button class="edit-button" data-edit="${slug}">Edit</button>
            </div>
          `).join("")}
        </div>
        <div class="modal-overlay" id="checkoutModalOverlay"></div>
        <div class="modal-box" id="checkoutModalBox">
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
      </div>
    `;
    // Insert the panel before transaction type block
    $(SELECTORS.txnContainer).before(summaryHTML);
    $(".container .row").first().addClass("checkout-main-area");

    // ===================================================
    // 3. Transaction & Shipping selectors (custom buttons)
    // ===================================================
    function updateTransactionStyles(val) {
      const isOrder = (val === "rdbOrder");
      setChecked(SELECTORS.txnOrderRadio, isOrder);
      setChecked(SELECTORS.txnQuoteRadio, !isOrder);
      refreshSummary();
    }
    function updateShippingStyles(val) {
      const isDelivered = (val === "rbDelivered");
      setChecked(SELECTORS.shipDelivered, isDelivered);
      setChecked(SELECTORS.shipPickup, !isDelivered);
      refreshSummary();
    }

    if ($(SELECTORS.txnContainer).length) {
      $(".TransactionTypeSelector").hide();
      const txnHTML = `
        <div class="modern-transaction-selector" style="display:flex; gap:.5rem; margin-bottom:.75rem;">
          <button id="btnOrder" class="edit-button" data-value="rdbOrder">Order</button>
          <button id="btnQuote" class="edit-button btn-secondary" data-value="rdbQuote">Request Quote</button>
        </div>
      `;
      $(SELECTORS.txnContainer).append(txnHTML);
      updateTransactionStyles($(SELECTORS.txnOrderRadio).is(":checked") ? "rdbOrder" : "rdbQuote");
      $(document).on("click", ".modern-transaction-selector button", function () {
        updateTransactionStyles($(this).data("value"));
      });
    } else {
      console.warn("[CheckoutUI] Transaction type container not found.");
    }

    if ($(".SaleTypeSelector").length) {
      $(".SaleTypeSelector").hide();
      const shipHTML = `
        <div class="modern-shipping-selector" style="display:flex; gap:.5rem;">
          <button id="btnDelivered" class="edit-button" data-value="rbDelivered">Delivered</button>
          <button id="btnPickup" class="edit-button btn-secondary" data-value="rbCollectLater">Pickup (Free)</button>
        </div>
      `;
      $(SELECTORS.shipContainer).append(shipHTML);
      updateShippingStyles($(SELECTORS.shipDelivered).is(":checked") ? "rbDelivered" : "rbCollectLater");
      $(document).on("click", ".modern-shipping-selector button", function () {
        updateShippingStyles($(this).data("value"));
      });
    } else {
      console.warn("[CheckoutUI] Shipping method selector not found.");
    }

    // ===================================================
    // 4. Pre-population (keep your logic) + Account fetch
    // ===================================================
    if (!$(SELECTORS.del.line1).val()) {
      console.log("[CheckoutUI] Initial address pre-population running...");
      const $link = $("#ctl00_PageBody_CustomerAddressSelector_SelectAddressLinkButton");
      if ($link.length) {
        let $entries = $(".AddressSelectorEntry");
        if ($entries.length) {
          let $pick = $entries.first();
          let minId = parseInt($pick.find(".AddressId").text(), 10);
          $entries.each(function () {
            const id = +$(this).find(".AddressId").text();
            if (id < minId) { minId = id; $pick = $(this); }
          });
          const txt = $pick.find("dd p").first().text().trim();
          const parts = txt.split(",").map(s => s.trim());
          const [line1 = "", city = ""] = parts;
          let state = "", zip = "";
          if (parts.length >= 4) {
            state = parts[parts.length - 2];
            zip = parts[parts.length - 1];
          } else if (parts.length > 2) {
            const m = parts[2].match(/(.+?)\s*(\d{5}(?:-\d{4})?)?$/);
            if (m) { state = m[1].trim(); zip = m[2] || ""; }
          }
          console.log(`[CheckoutUI] Parsed Address: ${line1}, ${city}, ${state}, ${zip}`);
          setVal(SELECTORS.del.line1, line1);
          setVal(SELECTORS.del.city, city);
          setVal(SELECTORS.del.zip, zip);
          setVal(SELECTORS.del.country, "USA");
          $(SELECTORS.del.county + " option").each(function () {
            if ($(this).text().trim().toLowerCase() === state.toLowerCase()) {
              $(this).prop("selected", true).trigger("change");
              return false;
            }
          });
        }
      } else {
        console.warn("[CheckoutUI] Address selector link button not found.");
      }
    } else {
      console.log("[CheckoutUI] Address pre-population skipped; field not empty.");
    }

    // Account info fetches
    $.get("https://webtrack.woodsonlumber.com/AccountSettings.aspx", function (data) {
      const $acc = $(data);
      const fn = $acc.find("#ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput").val() || "";
      const ln = $acc.find("#ctl00_PageBody_ChangeUserDetailsControl_LastNameInput").val() || "";
      let email = $acc.find("#ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput").val() || "";
      email = email.replace(/^\([^)]*\)\s*/, "");
      setVal(SELECTORS.del.firstName, fn);
      setVal(SELECTORS.del.lastName, ln);
      setVal(SELECTORS.inv.email, email);
      refreshSummary();
    });
    $.get("https://webtrack.woodsonlumber.com/AccountInfo_R.aspx", function (data) {
      const tel = $(data).find("#ctl00_PageBody_TelephoneLink_TelephoneLink").text().trim();
      setVal(SELECTORS.del.phone, tel);
      refreshSummary();
    });

    // ===================================================
    // 5. Summary Refresh Logic
    // ===================================================
    function getOrderType() {
      return $(SELECTORS.txnOrderRadio).is(":checked") ? "Order" : "Request Quote";
    }
    function getOrderMethod() {
      return $(SELECTORS.shipDelivered).is(":checked") ? "Delivered" : "Pickup (Free)";
    }
    function getDateNeeded() {
      const v = safeText(valOf(SELECTORS.dateInput));
      return v || "Not selected";
    }
    function getPO() {
      const v = safeText(valOf(SELECTORS.poInput));
      return v || "Not provided";
    }
    function getNotes() {
      const v = safeText(valOf(SELECTORS.notesInput));
      return v || "None";
    }
    function getDeliverySummary() {
      const fn = safeText($(SELECTORS.del.firstName).val());
      const ln = safeText($(SELECTORS.del.lastName).val());
      const a1 = safeText($(SELECTORS.del.line1).val());
      const a2 = safeText($(SELECTORS.del.line2).val());
      const a3 = safeText($(SELECTORS.del.line3).val());
      const ct = safeText($(SELECTORS.del.city).val());
      const zp = safeText($(SELECTORS.del.zip).val());
      const lines = [
        [fn, ln].filter(Boolean).join(" "),
        a1,
        a2,
        a3,
        [ct, zp].filter(Boolean).join(", ")
      ].filter(Boolean);
      return lines.join("\n") || "Not provided";
    }
    function getInvoiceSummary() {
      const a1 = safeText($(SELECTORS.inv.line1).val());
      const a2 = safeText($(SELECTORS.inv.line2).val());
      const a3 = safeText($(SELECTORS.inv.line3).val());
      const ct = safeText($(SELECTORS.inv.city).val());
      const zp = safeText($(SELECTORS.inv.zip).val());
      const lines = [
        a1,
        a2,
        a3,
        [ct, zp].filter(Boolean).join(", ")
      ].filter(Boolean);
      return lines.join("\n") || "Not provided";
    }
    function getContactSummary() {
      const fn = safeText($(SELECTORS.del.firstName).val());
      const ln = safeText($(SELECTORS.del.lastName).val());
      const ph = safeText($(SELECTORS.del.phone).val());
      const em = safeText($(SELECTORS.inv.email).val());
      const name = [fn, ln].filter(Boolean).join(" ") || "Name not set";
      return [name, em || "Email not set", ph || "Phone not set"].join("\n");
    }

    function refreshSummary() {
      $("#summary-order-type").text(getOrderType());
      $("#summary-order-method").text(getOrderMethod());
      $("#summary-date").text(getDateNeeded());
      $("#summary-po").text(getPO());
      $("#summary-notes").text(getNotes());
      $("#summary-delivery").text(getDeliverySummary());
      $("#summary-invoice").text(getInvoiceSummary());
      $("#summary-contact").text(getContactSummary());
    }

    // Recompute summaries when relevant inputs change
    $(document).on("change blur input", [
      SELECTORS.txnOrderRadio,
      SELECTORS.txnQuoteRadio,
      SELECTORS.shipDelivered,
      SELECTORS.shipPickup,
      SELECTORS.dateInput.join ? SELECTORS.dateInput.join(",") : SELECTORS.dateInput,
      SELECTORS.poInput.join ? SELECTORS.poInput.join(",") : SELECTORS.poInput,
      SELECTORS.notesInput.join ? SELECTORS.notesInput.join(",") : SELECTORS.notesInput,
      SELECTORS.del.firstName, SELECTORS.del.lastName, SELECTORS.del.line1, SELECTORS.del.line2, SELECTORS.del.line3,
      SELECTORS.del.city, SELECTORS.del.zip, SELECTORS.del.phone,
      SELECTORS.inv.line1, SELECTORS.inv.line2, SELECTORS.inv.line3, SELECTORS.inv.city, SELECTORS.inv.zip, SELECTORS.inv.email
    ].join(",")).on("change blur input", refreshSummary);

    // Seed once
    refreshSummary();

    // ===================================================
    // 6. Modal Edit Framework (move real nodes in & out)
    // ===================================================
    const originalSlots = {}; // section -> [{ node, parent, nextSibling }]
    function jqWrap(v) { return $.isFunction(v) ? $(v()) : $(v); }

    // For delivery/invoice, we bring the hidden rows into the modal.
    const sectionsConfig = {
      "order-type": {
        title: "Order Type",
        editSelectors: [SELECTORS.txnContainer]
      },
      "order-method": {
        title: "Order Method",
        editSelectors: [function () {
          const $guess = $(SELECTORS.shipContainer);
          if ($guess.length) return $guess;
          const $a = $(SELECTORS.shipDelivered).closest(SELECTORS.rowGroup);
          const $b = $(SELECTORS.shipPickup).closest(SELECTORS.rowGroup);
          return $a.add($b);
        }]
      },
      "date": {
        title: "Date",
        editSelectors: [function () {
          const $w = $(SELECTORS.dateWrapper);
          return $w.length ? $w : jqWrap(SELECTORS.dateInput).closest(SELECTORS.rowGroup);
        }]
      },
      "po": {
        title: "PO Number",
        editSelectors: [function () {
          const $i = jqWrap(SELECTORS.poInput).first();
          return $i.length ? $i.closest(SELECTORS.rowGroup + ", .epi-form-col-single-checkout, .form-group") : $();
        }]
      },
      "notes": {
        title: "Special Notes",
        editSelectors: [function () {
          const $i = jqWrap(SELECTORS.notesInput).first();
          return $i.length ? $i.closest(SELECTORS.rowGroup + ", .epi-form-col-single-checkout, .form-group") : $();
        }]
      },
      "delivery": {
        title: "Delivery Address",
        editSelectors: [function () {
          return $(deliveryHidden.join(", ")).map(function () {
            const $row = $(this).closest(SELECTORS.rowGroup);
            return $row.length ? $row[0] : this;
          });
        }],
        onOpen: () => $(deliveryHidden.join(", ")).show(),
        onClose: () => $(deliveryHidden.join(", ")).hide()
      },
      "invoice": {
        title: "Invoice Address",
        editSelectors: [function () {
          return $(invoiceHidden.join(", ")).map(function () {
            const $row = $(this).closest(SELECTORS.rowGroup);
            return $row.length ? $row[0] : this;
          });
        }],
        onOpen: () => $(invoiceHidden.join(", ")).show(),
        onClose: () => $(invoiceHidden.join(", ")).hide()
      },
      "contact": {
        title: "Contact Info",
        editSelectors: [function () {
          const $els = $()
            .add($(SELECTORS.del.firstName))
            .add($(SELECTORS.del.lastName))
            .add($(SELECTORS.del.phone))
            .add($(SELECTORS.inv.email));
          return $els.map(function () {
            const $row = $(this).closest(SELECTORS.rowGroup);
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
      $("#checkoutModalBox").attr("data-section", sectionKey);

      originalSlots[sectionKey] = [];

      if (cfg.onOpen) cfg.onOpen();

      cfg.editSelectors.forEach(sel => {
        const $nodes = jqWrap(sel);
        $nodes.each(function () {
          const node = this;
          const parent = node.parentNode;
          const nextSibling = node.nextSibling;
          originalSlots[sectionKey].push({ node, parent, nextSibling });

          // placeholder ensures stable re‑insert
          const placeholder = document.createElement("div");
          placeholder.className = "_placeholder";
          parent.insertBefore(placeholder, nextSibling);

          // move node into modal
          $("#checkoutModalBody")[0].appendChild(node);
        });
      });

      $("#checkoutModalOverlay, #checkoutModalBox").addClass("active");
    }

    function closeEditor(sectionKey, save) {
      const slots = originalSlots[sectionKey] || [];

      // return nodes
      slots.forEach(({ node, parent, nextSibling }) => {
        if (nextSibling) parent.insertBefore(node, nextSibling);
        else parent.appendChild(node);
      });

      // remove placeholders
      $("#checkoutModalBody").find("._placeholder").remove();
      $("#checkoutModalBody").empty();
      $("#checkoutModalOverlay, #checkoutModalBox").removeClass("active");

      const cfg = sectionsConfig[sectionKey];
      if (cfg && cfg.onClose) cfg.onClose();

      if (save) refreshSummary();
      delete originalSlots[sectionKey];
    }

    // Open modal on Edit
    $(document).on("click", ".checkout-summary-panel .edit-button", function () {
      const section = $(this).data("edit");
      if (!sectionsConfig[section]) return;
      openEditor(section);
    });

    // Close / Cancel / Save
    $(document).on("click", "#checkoutModalOverlay, #modalCloseBtn, #modalCancelBtn", function () {
      const section = $("#checkoutModalBox").attr("data-section");
      if (section) closeEditor(section, false);
    });
    $(document).on("click", "#modalSaveBtn", function () {
      const section = $("#checkoutModalBox").attr("data-section");
      if (section) closeEditor(section, true);
    });

    // ===================================================
    // 7. Generic input change hook -> keep summary fresh
    // ===================================================
    $(document).on("change input blur", ".epi-form-group-checkout input, .epi-form-group-checkout textarea, .epi-form-group-checkout select", refreshSummary);

    console.log("[CheckoutUI] Ready.");
  });
})();
