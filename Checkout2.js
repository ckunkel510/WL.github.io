document.addEventListener('DOMContentLoaded', function() {
  // 1) Create wizard container & nav
  var container = document.querySelector('.container');
  var wizard    = document.createElement('div');
  wizard.className = 'checkout-wizard';
  container.insertBefore(wizard, container.firstChild);
  var nav = document.createElement('ul');
  nav.className = 'checkout-steps';
  wizard.appendChild(nav);

  // 2) Define your 7 steps
  var steps = [
    {
      title: 'Order details',
      findEls: function() {
        var tx = document.getElementById('ctl00_PageBody_TransactionTypeDiv');
        return tx ? [tx.closest('.epi-form-col-single-checkout')] : [];
      }
    },
    {
      title: 'Shipping & date',
      findEls: function() {
        var arr = [];
        var ship = document.getElementById('ctl00_PageBody_SaleTypeSelector_lblDelivered');
        if (ship) arr.push(ship.closest('.epi-form-col-single-checkout'));
        var date = document.getElementById('ctl00_PageBody_dtRequired_DatePicker_wrapper');
        if (date) arr.push(date.closest('.epi-form-col-single-checkout'));
        return arr;
      }
    },
    {
      title: 'Your reference',
      findEls: function() {
        var po = document.getElementById('ctl00_PageBody_PurchaseOrderNumberTextBox');
        return po ? [po.closest('.epi-form-group-checkout')] : [];
      }
    },
    {
      title: 'Branch',
      findEls: function() {
        var br = document.getElementById('ctl00_PageBody_BranchSelector');
        return br ? [br] : [];
      }
    },
    {
      title: 'Delivery address',
      findEls: function() {
        var hdr = document.querySelector('.SelectableAddressType');
        return hdr ? [hdr.closest('.epi-form-col-single-checkout')] : [];
      }
    },
    {
      title: 'Invoice address',
      findEls: function() {
        var gp = document.getElementById('ctl00_PageBody_InvoiceAddress_GoogleAddressSearchWrapper');
        return gp ? [gp.closest('.epi-form-col-single-checkout')] : [];
      }
    },
    {
      title: 'Special instructions',
      findEls: function() {
        var tbl = document.querySelector('.cartTable');
        return tbl ? [tbl] : [];
      }
    }
  ];

  // 3) Build each step + pane
  steps.forEach(function(step,i) {
    var num = i+1;
    // nav bullet
    var li = document.createElement('li');
    li.dataset.step = num;
    li.textContent  = step.title;
    li.addEventListener('click', () => showStep(num));
    nav.appendChild(li);

    // content pane
    var pane = document.createElement('div');
    pane.className  = 'checkout-step';
    pane.dataset.step = num;
    wizard.appendChild(pane);

    // move existing DOM in
    step.findEls().forEach(el => pane.appendChild(el));

    // back/next (or Continue)
    var navDiv = document.createElement('div');
    navDiv.className = 'checkout-nav';
    pane.appendChild(navDiv);
    if (num > 1) {
      var back = document.createElement('button');
      back.className = 'btn btn-secondary';
      back.textContent = 'Back';
      back.onclick = e => { e.preventDefault(); showStep(num-1); };
      navDiv.appendChild(back);
    }
    if (num < steps.length) {
      var next = document.createElement('button');
      next.className = 'btn btn-primary';
      next.textContent = 'Next';
      next.onclick = e => { e.preventDefault(); showStep(num+1); };
      navDiv.appendChild(next);
    } else {
      // final: pull in your real Continue button
      var conts = Array.from(document.querySelectorAll(
        '#ctl00_PageBody_ContinueButton1,#ctl00_PageBody_ContinueButton2'
      ));
      if (conts.length) {
        var cont = conts.pop();
        cont.style.display = '';
        navDiv.appendChild(cont);
      }
    }
  });

  // 4) Prefill delivery address on load (step 5)
  if (!$('#ctl00_PageBody_DeliveryAddress_AddressLine1').val()) {
    const $link = $('#ctl00_PageBody_CustomerAddressSelector_SelectAddressLinkButton');
    if ($link.length) {
      let $entries = $('.AddressSelectorEntry');
      if ($entries.length) {
        let $pick = $entries.first();
        let minId = parseInt($pick.find('.AddressId').text(),10);
        $entries.each(function(){
          const id = parseInt($(this).find('.AddressId').text(),10);
          if (id < minId) { minId = id; $pick = $(this); }
        });
        const txt   = $pick.find('dd p').first().text().trim();
        const parts = txt.split(',').map(s=>s.trim());
        const [line1='',city=''] = parts;
        let state='', zip='';
        if (parts.length >= 4) {
          state = parts[parts.length-2];
          zip   = parts[parts.length-1];
        } else if (parts.length>2) {
          const m = parts[2].match(/(.+?)\s*(\d{5}(?:-\d{4})?)?$/);
          if (m) { state=m[1].trim(); zip=m[2]||''; }
        }
        $('#ctl00_PageBody_DeliveryAddress_AddressLine1').val(line1);
        $('#ctl00_PageBody_DeliveryAddress_City').val(city);
        $('#ctl00_PageBody_DeliveryAddress_Postcode').val(zip);
        $('#ctl00_PageBody_DeliveryAddress_CountrySelector').val('USA');
        $('#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList option').each(function(){
          if ($(this).text().trim().toLowerCase()===state.toLowerCase()){
            $(this).prop('selected',true); return false;
          }
        });
      }
    }
  }

  // 5) AJAX populate name, email & telephone
  $.get('https://webtrack.woodsonlumber.com/AccountSettings.aspx', function(data){
    const $acc = $(data);
    const fn   = $acc.find('#ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput').val()||'';
    const ln   = $acc.find('#ctl00_PageBody_ChangeUserDetailsControl_LastNameInput').val()||'';
    let email  = $acc.find('#ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput').val()||'';
    email      = email.replace(/^\([^)]*\)\s*/,'');
    $('#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox').val(fn);
    $('#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox').val(ln);
    $('#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox').val(email);
  });
  $.get('https://webtrack.woodsonlumber.com/AccountInfo_R.aspx', function(data){
    const tel = $(data).find('#ctl00_PageBody_TelephoneLink_TelephoneLink').text().trim();
    $('#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox').val(tel);
  });

  // 6) Delivery address summary & edit flow (step 5)
  (function(){
    var pane5 = wizard.querySelector('.checkout-step[data-step="5"]');
    if (!pane5) return;
    var inputCol = pane5.querySelector('.epi-form-col-single-checkout');
    // wrap inputs
    var wrapper = document.createElement('div');
    wrapper.className = 'delivery-inputs';
    while(inputCol.firstChild) wrapper.appendChild(inputCol.firstChild);
    inputCol.appendChild(wrapper);
    // summary container
    var summary = document.createElement('div');
    summary.className = 'delivery-summary';
    function refreshSummary(){
      var a1 = wrapper.querySelector('#ctl00_PageBody_DeliveryAddress_AddressLine1').value||'';
      var a2 = wrapper.querySelector('#ctl00_PageBody_DeliveryAddress_AddressLine2').value||'';
      var city = wrapper.querySelector('#ctl00_PageBody_DeliveryAddress_City').value||'';
      var state = wrapper.querySelector('#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList')
                    .selectedOptions[0].text||'';
      var zip = wrapper.querySelector('#ctl00_PageBody_DeliveryAddress_Postcode').value||'';
      summary.innerHTML = `
        <strong>Delivery Address</strong><br>
        ${a1}${a2?'<br>'+a2:''}<br>
        ${city}, ${state} ${zip}<br>
        <button type="button" id="editDelivery" class="btn btn-link">Edit</button>
      `;
    }
    inputCol.parentNode.insertBefore(summary,inputCol);
    wrapper.style.display = 'none';
    summary.addEventListener('click', function(e){
      if (e.target.id !== 'editDelivery') return;
      summary.style.display = 'none';
      wrapper.style.display = '';
      wrapper.scrollIntoView({behavior:'smooth'});
      if (!wrapper.querySelector('#saveDelivery')) {
        var btn = document.createElement('button');
        btn.id = 'saveDelivery';
        btn.textContent = 'Save';
        btn.className   = 'btn btn-primary mt-2';
        wrapper.appendChild(btn);
        btn.addEventListener('click', function(){
          refreshSummary();
          wrapper.style.display = 'none';
          summary.style.display = '';
          localStorage.currentStep = 5;
        });
      }
    });
    refreshSummary();
  })();

  // 7) Step switcher + persistence
  function showStep(n) {
    wizard.querySelectorAll('.checkout-step').forEach(function(p){
      p.classList.toggle('active', +p.dataset.step === n);
    });
    nav.querySelectorAll('li').forEach(function(li){
      var s = +li.dataset.step;
      li.classList.toggle('active',    s === n);
      li.classList.toggle('completed', s <  n);
    });
    localStorage.currentStep = n;
    window.scrollTo({ top: wizard.offsetTop, behavior: 'smooth' });
  }
  // resume or default to step 2
  var start = parseInt(localStorage.currentStep,10) || 2;
  showStep(start);
});