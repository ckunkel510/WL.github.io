document.addEventListener('DOMContentLoaded', function() {
  // 1) Wizard container & nav
  const container = document.querySelector('.container');
  const wizard    = document.createElement('div');
  wizard.className = 'checkout-wizard';
  container.insertBefore(wizard, container.firstChild);
  const nav = document.createElement('ul');
  nav.className = 'checkout-steps';
  wizard.appendChild(nav);

  // 2) Step definitions
  const steps = [
    { title: 'Order details', findEls: () => {
        const tx = document.getElementById('ctl00_PageBody_TransactionTypeDiv');
        return tx ? [tx.closest('.epi-form-col-single-checkout')] : [];
    }},
    { title: 'Shipping & date', findEls: () => {
        const arr = [];
        const ship = document.getElementById('ctl00_PageBody_SaleTypeSelector_lblDelivered');
        if (ship) arr.push(ship.closest('.epi-form-col-single-checkout'));
        const date = document.getElementById('ctl00_PageBody_dtRequired_DatePicker_wrapper');
        if (date) arr.push(date.closest('.epi-form-col-single-checkout'));
        return arr;
    }},
    { title: 'Your reference', findEls: () => {
        const po = document.getElementById('ctl00_PageBody_PurchaseOrderNumberTextBox');
        return po ? [po.closest('.epi-form-group-checkout')] : [];
    }},
    { title: 'Branch', findEls: () => {
        const br = document.getElementById('ctl00_PageBody_BranchSelector');
        return br ? [br] : [];
    }},
    { title: 'Delivery address', findEls: () => {
        const hdr = document.querySelector('.SelectableAddressType');
        return hdr ? [hdr.closest('.epi-form-col-single-checkout')] : [];
    }},
    { title: 'Invoice address', findEls: () => {
        const gp = document.getElementById('ctl00_PageBody_InvoiceAddress_GoogleAddressSearchWrapper');
        return gp ? [gp.closest('.epi-form-col-single-checkout')] : [];
    }},
    { title: 'Special instructions', findEls: () => {
        const tbl = document.querySelector('.cartTable');
        return tbl ? [tbl] : [];
    }}
  ];

  // 3) Build steps and panes
  steps.forEach((step, i) => {
    const num = i + 1;
    // Nav bullet
    const li = document.createElement('li');
    li.dataset.step = num;
    li.textContent = step.title;
    li.addEventListener('click', () => showStep(num));
    nav.appendChild(li);

    // Content pane
    const pane = document.createElement('div');
    pane.className = 'checkout-step';
    pane.dataset.step = num;
    wizard.appendChild(pane);

    // Move existing elements
    step.findEls().forEach(el => pane.appendChild(el));

    // Back/Next or Continue
    const navDiv = document.createElement('div');
    navDiv.className = 'checkout-nav';
    pane.appendChild(navDiv);

    if (num > 1) {
      const back = document.createElement('button');
      back.className = 'btn btn-secondary';
      back.textContent = 'Back';
      back.addEventListener('click', e => { e.preventDefault(); showStep(num - 1); });
      navDiv.appendChild(back);
    }
    if (num < steps.length) {
      const next = document.createElement('button');
      next.className = 'btn btn-primary';
      next.textContent = 'Next';
      next.addEventListener('click', e => { e.preventDefault(); showStep(num + 1); });
      navDiv.appendChild(next);
    } else {
      // Final: Continue button
      const conts = Array.from(document.querySelectorAll(
        '#ctl00_PageBody_ContinueButton1, #ctl00_PageBody_ContinueButton2'
      ));
      if (conts.length) {
        const cont = conts.pop();
        cont.style.display = '';
        navDiv.appendChild(cont);
      }
    }
  });

  // 4) Prefill delivery address (step 5)
  if (!$('#ctl00_PageBody_DeliveryAddress_AddressLine1').val()) {
    const $link = $('#ctl00_PageBody_CustomerAddressSelector_SelectAddressLinkButton');
    if ($link.length) {
      const $entries = $('.AddressSelectorEntry');
      if ($entries.length) {
        let $pick = $entries.first(), minId = parseInt($pick.find('.AddressId').text(), 10);
        $entries.each(function() {
          const id = parseInt($(this).find('.AddressId').text(), 10);
          if (id < minId) { minId = id; $pick = $(this); }
        });
        const txt   = $pick.find('dd p').first().text().trim();
        const parts = txt.split(',').map(s => s.trim());
        const line1 = parts[0] || '', city = parts[1] || '';
        let state = '', zip = '';
        if (parts.length >= 4) {
          state = parts[parts.length - 2];
          zip   = parts[parts.length - 1];
        } else if (parts.length > 2) {
          const m = parts[2].match(/(.+?)\s*(\d{5}(?:-\d{4})?)?$/);
          if (m) { state = m[1].trim(); zip = m[2] || ''; }
        }
        $('#ctl00_PageBody_DeliveryAddress_AddressLine1').val(line1);
        $('#ctl00_PageBody_DeliveryAddress_City').val(city);
        $('#ctl00_PageBody_DeliveryAddress_Postcode').val(zip);
        $('#ctl00_PageBody_DeliveryAddress_CountrySelector').val('USA');
        $('#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList option').each(function() {
          if ($(this).text().trim().toLowerCase() === state.toLowerCase()) {
            $(this).prop('selected', true);
            return false;
          }
        });
      }
    }
  }

  // 5) AJAX name/email & telephone
  $.get('https://webtrack.woodsonlumber.com/AccountSettings.aspx', data => {
    const $acc = $(data),
          fn   = $acc.find('#ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput').val() || '',
          ln   = $acc.find('#ctl00_PageBody_ChangeUserDetailsControl_LastNameInput').val() || '',
          em   = ($acc.find('#ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput').val() || '').replace(/^\([^)]*\)\s*/, '');
    $('#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox').val(fn);
    $('#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox').val(ln);
    $('#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox').val(em);
  });
  $.get('https://webtrack.woodsonlumber.com/AccountInfo_R.aspx', data => {
    const tel = $(data).find('#ctl00_PageBody_TelephoneLink_TelephoneLink').text().trim();
    $('#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox').val(tel);
  });

  // 6) Delivery summary/edit (step 5)
  (function() {
    const pane5 = wizard.querySelector('.checkout-step[data-step="5"]');
    if (!pane5) return;
    const inputCol = pane5.querySelector('.epi-form-col-single-checkout');
    const wrapper  = document.createElement('div');
    wrapper.className = 'delivery-inputs';
    while (inputCol.firstChild) wrapper.appendChild(inputCol.firstChild);
    inputCol.appendChild(wrapper);
    const summary = document.createElement('div');
    summary.className = 'delivery-summary';
    function refreshSummary() {
      const a1 = wrapper.querySelector('#ctl00_PageBody_DeliveryAddress_AddressLine1').value || '';
      const a2 = wrapper.querySelector('#ctl00_PageBody_DeliveryAddress_AddressLine2').value || '';
      const city  = wrapper.querySelector('#ctl00_PageBody_DeliveryAddress_City').value || '';
      const state = wrapper.querySelector('#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList')
                       .selectedOptions[0].text || '';
      const zip   = wrapper.querySelector('#ctl00_PageBody_DeliveryAddress_Postcode').value || '';
      summary.innerHTML = `
        <strong>Delivery Address</strong><br>
        ${a1}${a2?'<br>'+a2:''}<br>
        ${city}, ${state} ${zip}<br>
        <button id="editDelivery" class="btn btn-link">Edit</button>
      `;
    }
    wrapper.style.display = 'none';
    inputCol.insertBefore(summary, wrapper);
    summary.addEventListener('click', e => {
      if (e.target.id !== 'editDelivery') return;
      summary.style.display = 'none';
      wrapper.style.display = '';
      wrapper.scrollIntoView({ behavior: 'smooth' });
      if (!wrapper.querySelector('#saveDelivery')) {
        const btn = document.createElement('button');
        btn.id = 'saveDelivery';
        btn.className = 'btn btn-primary mt-2';
        btn.textContent = 'Save';
        wrapper.appendChild(btn);
        btn.addEventListener('click', () => {
          refreshSummary();
          wrapper.style.display = 'none';
          summary.style.display = '';
          localStorage.currentStep = 5;
        });
      }
    });
    refreshSummary();
  })();

  // 7) Billing = delivery checkbox + invoice summary/edit
  (function() {
    const pane6 = wizard.querySelector('.checkout-step[data-step="6"]');
    if (!pane6) return;
    // hide original link
    const orig = document.getElementById('copyDeliveryAddressButton');
    if (orig) orig.style.display = 'none';
    // create checkbox
    const chkDiv = document.createElement('div');
    chkDiv.className = 'form-check mb-3';
    chkDiv.innerHTML = `
      <input class="form-check-input" type="checkbox" id="sameAsDeliveryCheck">
      <label class="form-check-label" for="sameAsDeliveryCheck">
        Billing address is the same as delivery address
      </label>
    `;
    pane6.insertBefore(chkDiv, pane6.firstChild);

    // wrap invoice inputs
    const inputColInv = pane6.querySelector('.epi-form-col-single-checkout');
    const wrapperInv  = document.createElement('div');
    wrapperInv.className = 'invoice-inputs';
    while (inputColInv.firstChild) wrapperInv.appendChild(inputColInv.firstChild);
    inputColInv.appendChild(wrapperInv);

    // create summary container
    const summaryInv = document.createElement('div');
    summaryInv.className = 'invoice-summary';
    function suppressPostback(select) {
      if (select) select.onchange = e => e.stopImmediatePropagation();
    }
    const invState   = wrapperInv.querySelector('#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList');
    const invCountry = wrapperInv.querySelector('#ctl00_PageBody_InvoiceAddress_CountrySelector1');
    suppressPostback(invState);
    suppressPostback(invCountry);

    function refreshInvoiceSummary() {
      const a1    = wrapperInv.querySelector('#ctl00_PageBody_InvoiceAddress_AddressLine1').value || '';
      const a2    = wrapperInv.querySelector('#ctl00_PageBody_InvoiceAddress_AddressLine2').value || '';
      const city  = wrapperInv.querySelector('#ctl00_PageBody_InvoiceAddress_City').value || '';
      const state = invState ? invState.selectedOptions[0].text : '';
      const zip   = wrapperInv.querySelector('#ctl00_PageBody_InvoiceAddress_Postcode').value || '';
      const email = wrapperInv.querySelector('#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox').value || '';
      summaryInv.innerHTML = `
        <strong>Invoice Address</strong><br>
        ${a1}${a2?'<br>'+a2:''}<br>
        ${city}, ${state} ${zip}<br>
        Email: ${email}<br>
        <button id="editInvoice" class="btn btn-link">Edit</button>
      `;
    }

    // initial hide
    wrapperInv.style.display = 'none';
    summaryInv.style.display = 'none';
    inputColInv.insertBefore(summaryInv, wrapperInv);

    // checkbox change
    chkDiv.querySelector('#sameAsDeliveryCheck').addEventListener('change', function() {
      if (this.checked) {
        __doPostBack('ctl00$PageBody$CopyDeliveryAddressLinkButton','');
        // after postback, use summary
        refreshInvoiceSummary();
        wrapperInv.style.display = 'none';
        summaryInv.style.display = '';
        localStorage.currentStep = 6;
      } else {
        summaryInv.style.display = 'none';
        wrapperInv.style.display = '';
      }
    });

    // edit invoice
    summaryInv.addEventListener('click', e => {
      if (e.target.id !== 'editInvoice') return;
      summaryInv.style.display = 'none';
      wrapperInv.style.display = '';
      wrapperInv.scrollIntoView({ behavior: 'smooth' });
      if (!wrapperInv.querySelector('#saveInvoice')) {
        const btn = document.createElement('button');
        btn.id = 'saveInvoice';
        btn.className = 'btn btn-primary mt-2';
        btn.textContent = 'Save';
        wrapperInv.appendChild(btn);
        btn.addEventListener('click', () => {
          refreshInvoiceSummary();
          wrapperInv.style.display = 'none';
          summaryInv.style.display = '';
          localStorage.currentStep = 6;
        });
      }
    });
  })();

  // 8) Step switcher + persistence
  function showStep(n) {
    wizard.querySelectorAll('.checkout-step').forEach(p =>
      p.classList.toggle('active', +p.dataset.step === n)
    );
    nav.querySelectorAll('li').forEach(li => {
      const s = +li.dataset.step;
      li.classList.toggle('active', s === n);
      li.classList.toggle('completed', s < n);
    });
    localStorage.currentStep = n;
    window.scrollTo({ top: wizard.offsetTop, behavior: 'smooth' });
  }

  // resume or default to 2
  showStep(parseInt(localStorage.currentStep, 10) || 2);
});