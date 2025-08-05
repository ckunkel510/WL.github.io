
document.addEventListener('DOMContentLoaded', function() {
  // 1) Wizard container & nav
  var container = document.querySelector('.container');
  var wizard    = document.createElement('div');
  wizard.className = 'checkout-wizard';
  container.insertBefore(wizard, container.firstChild);
  var nav = document.createElement('ul');
  nav.className = 'checkout-steps';
  wizard.appendChild(nav);

  // 2) Step definitions: date stays in step 2, step 7 only special instructions
  var steps = [
    { title: 'Order details', findEls: function() {
        var tx = document.getElementById('ctl00_PageBody_TransactionTypeDiv');
        return tx ? [tx.closest('.epi-form-col-single-checkout')] : [];
    }},
    { title: 'Shipping method', findEls: function() {
        var shipCol = document.querySelector('.SaleTypeSelector')
                             .closest('.epi-form-col-single-checkout');
        var dateCol = document
          .getElementById('ctl00_PageBody_dtRequired_DatePicker_wrapper')
          .closest('.epi-form-col-single-checkout');
        return [ shipCol, dateCol ];
    }},
    { title: 'Your reference', findEls: function() {
        var po = document.getElementById('ctl00_PageBody_PurchaseOrderNumberTextBox');
        return po ? [ po.closest('.epi-form-group-checkout') ] : [];
    }},
    { title: 'Branch', findEls: function() {
        var br = document.getElementById('ctl00_PageBody_BranchSelector');
        return br ? [ br ] : [];
    }},
    { title: 'Delivery address', findEls: function() {
        var hdr = document.querySelector('.SelectableAddressType');
        return hdr ? [ hdr.closest('.epi-form-col-single-checkout') ] : [];
    }},
    { title: 'Billing address', findEls: function() {
        var gp = document.getElementById('ctl00_PageBody_InvoiceAddress_GoogleAddressSearchWrapper');
        return gp ? [ gp.closest('.epi-form-col-single-checkout') ] : [];
    }},
    { title: 'Special instructions', findEls: function() {
        var tbl = document.querySelector('.cartTable');
        return tbl ? [ tbl ] : [];
    }}
  ];

  // 3) Build wizard panes
  steps.forEach(function(step, i) {
    var num = i + 1;
    // Nav bullet
    var li = document.createElement('li');
    li.dataset.step = num;
    li.textContent  = step.title;
    li.addEventListener('click', function() { showStep(num); });
    nav.appendChild(li);

    // Pane
    var pane = document.createElement('div');
    pane.className   = 'checkout-step';
    pane.dataset.step = num;
    wizard.appendChild(pane);

    // Move existing elements
    step.findEls().forEach(function(el) {
      pane.appendChild(el);
    });

    // Back/Next or Continue
    var navDiv = document.createElement('div');
    navDiv.className = 'checkout-nav';
    pane.appendChild(navDiv);

    if (num > 1) {
      var back = document.createElement('button');
      back.className = 'btn btn-secondary';
      back.textContent = 'Back';
      back.addEventListener('click', function(e) {
        e.preventDefault();
        showStep(num - 1);
      });
      navDiv.appendChild(back);
    }
    if (num < steps.length) {
      var next = document.createElement('button');
      next.className = 'btn btn-primary';
      next.textContent = 'Next';
      next.addEventListener('click', function(e) {
        e.preventDefault();
        showStep(num + 1);
      });
      navDiv.appendChild(next);
    } else {
      // Final: real Continue button
      var conts = Array.from(document.querySelectorAll(
        '#ctl00_PageBody_ContinueButton1, #ctl00_PageBody_ContinueButton2'
      ));
      if (conts.length) {
        var cont = conts.pop();
        cont.style.display = '';
        navDiv.appendChild(cont);
      }
    }
  });

  // 4) Step 3 optional tag
  (function(){
    var pane3 = wizard.querySelector('[data-step="3"]');
    var lbl   = pane3 && pane3.querySelector('label');
    if (lbl) {
      var opt = document.createElement('small');
      opt.className = 'text-muted';
      opt.style.marginLeft = '8px';
      opt.textContent = '(optional)';
      lbl.appendChild(opt);
    }
  })();

  // 5) Step 6 header tweak
  (function(){
    var pane6 = wizard.querySelector('[data-step="6"]');
    var hdr   = pane6 && pane6.querySelector('.font-weight-bold.mb-3.mt-4');
    if (hdr) hdr.textContent = 'Billing Address';
  })();

  // 6) Step 7 optional tag
  (function(){
    var pane7 = wizard.querySelector('[data-step="7"]');
    var th    = pane7 && pane7.querySelector('th');
    if (th) {
      var opt = document.createElement('small');
      opt.className = 'text-muted';
      opt.style.marginLeft = '8px';
      opt.textContent = '(optional)';
      th.appendChild(opt);
    }
  })();

  // 7) Prefill Delivery (step 5) — unchanged
  if (!$('#ctl00_PageBody_DeliveryAddress_AddressLine1').val()) {
    var entries = $('.AddressSelectorEntry');
    if (entries.length) {
      var pick = entries.first(), minId = parseInt(pick.find('.AddressId').text(), 10);
      entries.each(function(){
        var id = parseInt($(this).find('.AddressId').text(), 10);
        if (id < minId) { minId = id; pick = $(this); }
      });
      var parts = pick.find('dd p').first().text().trim().split(',').map(s=>s.trim()),
          line1 = parts[0]||'', city = parts[1]||'', state='', zip='';
      if (parts.length>=4) { state=parts[parts.length-2]; zip=parts[parts.length-1]; }
      else if (parts.length>2) {
        var m = parts[2].match(/(.+?)\s*(\d{5}(?:-\d{4})?)?$/);
        if (m) { state=m[1].trim(); zip=m[2]||''; }
      }
      $('#ctl00_PageBody_DeliveryAddress_AddressLine1').val(line1);
      $('#ctl00_PageBody_DeliveryAddress_City').val(city);
      $('#ctl00_PageBody_DeliveryAddress_Postcode').val(zip);
      $('#ctl00_PageBody_DeliveryAddress_CountrySelector').val('USA');
      $('#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList option').each(function(){
        if ($(this).text().trim().toLowerCase()===state.toLowerCase()) {
          $(this).prop('selected', true);
          return false;
        }
      });
    }
  }

  // 8) AJAX for name/email/phone — unchanged
  $.get('https://webtrack.woodsonlumber.com/AccountSettings.aspx', function(data){
    var acc=$(data),
        fn=acc.find('#ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput').val()||'',
        ln=acc.find('#ctl00_PageBody_ChangeUserDetailsControl_LastNameInput').val()||'',
        em=(acc.find('#ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput').val()||'')
            .replace(/^\([^)]*\)\s*/, '');
    $('#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox').val(fn);
    $('#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox').val(ln);
    $('#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox').val(em);
  });
  $.get('https://webtrack.woodsonlumber.com/AccountInfo_R.aspx', function(data){
    var tel=$(data).find('#ctl00_PageBody_TelephoneLink_TelephoneLink').text().trim();
    $('#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox').val(tel);
  });

  // 9) Step 5 Delivery summary/edit — unchanged
  (function(){
    var pane5 = wizard.querySelector('[data-step="5"]'),
        col   = pane5 && pane5.querySelector('.epi-form-col-single-checkout');
    if (!col) return;
    var wrap = document.createElement('div'),
        sum  = document.createElement('div');
    wrap.className = 'delivery-inputs';
    while (col.firstChild) wrap.appendChild(col.firstChild);
    col.appendChild(wrap);
    sum.className = 'delivery-summary';
    function upd() {
      var a1  = wrap.querySelector('#ctl00_PageBody_DeliveryAddress_AddressLine1').value||'',
          a2  = wrap.querySelector('#ctl00_PageBody_DeliveryAddress_AddressLine2').value||'',
          c   = wrap.querySelector('#ctl00_PageBody_DeliveryAddress_City').value||'',
          s   = wrap.querySelector('#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList')
                   .selectedOptions[0].text||'',
          z   = wrap.querySelector('#ctl00_PageBody_DeliveryAddress_Postcode').value||'';
      sum.innerHTML = `<strong>Delivery Address</strong><br>
        ${a1}${a2?'<br>'+a2:''}<br>${c}, ${s} ${z}<br>
        <button id="editDelivery" class="btn btn-link">Edit</button>`;
    }
    wrap.style.display = 'none';
    col.insertBefore(sum, wrap);
    sum.addEventListener('click', function(e){
      if (e.target.id!=='editDelivery') return;
      sum.style.display='none';
      wrap.style.display='';
      wrap.scrollIntoView({behavior:'smooth'});
      if (!wrap.querySelector('#saveDelivery')) {
        var btn = document.createElement('button');
        btn.id='saveDelivery';
        btn.className='btn btn-primary mt-2';
        btn.textContent='Save';
        wrap.appendChild(btn);
        btn.addEventListener('click', function(){
          upd();
          wrap.style.display='none';
          sum.style.display='';
          localStorage.currentStep=5;
        });
      }
    });
    upd();
  })();

  // 10) Step 2: add Pickup Person under date in step 2
  (function(){
    var pane2 = wizard.querySelector('[data-step="2"]');
    if (!pane2) return;
    // pickup person input
    var pp = document.createElement('div');
    pp.className = 'epi-form-group-checkout';
    pp.innerHTML = `<div><label for="pickupPerson">Pickup Person:</label></div>
      <div><input type="text" id="pickupPerson" class="form-control"></div>`;
    pp.style.display='none';
    pane2.appendChild(pp);

    var rbPick = document.getElementById('ctl00_PageBody_SaleTypeSelector_rbCollectLater'),
        rbDel  = document.getElementById('ctl00_PageBody_SaleTypeSelector_rbDelivered');

    function togglePickupPerson(){
      pp.style.display = rbPick.checked ? '' : 'none';
    }
    rbPick.addEventListener('change', togglePickupPerson);
    rbDel .addEventListener('change', togglePickupPerson);
    togglePickupPerson();
  })();

  // 11) Step 7: delivery-only date/time update special instructions
  (function(){
    var pane7     = wizard.querySelector('[data-step="7"]');
    var special  = document.getElementById('ctl00_PageBody_SpecialInstructionsTextBox');
    var rbDel    = document.getElementById('ctl00_PageBody_SaleTypeSelector_rbDelivered'),
        rbPick   = document.getElementById('ctl00_PageBody_SaleTypeSelector_rbCollectLater'),
        zipInput = document.getElementById('ctl00_PageBody_DeliveryAddress_Postcode');

    if (!pane7 || !special) return;

    // create delivery date/time block
    var delDiv = document.createElement('div');
    delDiv.className = 'form-group';
    delDiv.innerHTML = `
      <label for="deliveryDate">Requested Delivery Date:</label>
      <input type="date" id="deliveryDate" class="form-control">
      <div>
        <label><input type="radio" name="deliveryTime" value="Morning"> Morning</label>
        <label><input type="radio" name="deliveryTime" value="Afternoon"> Afternoon</label>
      </div>`;
    delDiv.style.display='none';
    pane7.insertBefore(delDiv, pane7.querySelector('.cartTable')||pane7.firstChild);

    function inZone(zip){
      return ['75','76','77','78','79'].includes((zip||'').substring(0,2));
    }
    function updateSpecial(){
      if (rbDel.checked) {
        var z = zipInput.value||'';
        if (inZone(z)) {
          var d = document.getElementById('deliveryDate').value||'',
              t = pane7.querySelector('input[name="deliveryTime"]:checked');
          special.value = 'Delivery on ' + d + (t? ' ('+t.value+')':'');
        } else {
          special.value = 'Ship via 3rd party delivery selected on next screen.';
        }
      }
    }
    function onShip7(){
      if (rbDel.checked) {
        delDiv.style.display='';
        special.readOnly = true;
      } else {
        delDiv.style.display='none';
        special.readOnly = false;
      }
      updateSpecial();
    }
    rbDel.addEventListener('change', onShip7);
    rbPick.addEventListener('change', onShip7);
    document.getElementById('deliveryDate').addEventListener('change', function(){
      var sel = new Date(this.value),
          min = new Date(); min.setDate(min.getDate()+2);
      if (sel < min || sel.getDay()===0) {
        alert('Select at least 2 days out and not a Sunday.');
        this.value = '';
      }
      updateSpecial();
    });
    pane7.querySelectorAll('input[name="deliveryTime"]').forEach(function(r){
      r.addEventListener('change', updateSpecial);
    });

    // initialize
    onShip7();
  })();

  // 12) Step switcher + persistence
  function showStep(n){
    wizard.querySelectorAll('.checkout-step').forEach(function(p){
      p.classList.toggle('active', +p.dataset.step === n);
    });
    nav.querySelectorAll('li').forEach(function(li){
      var s = +li.dataset.step;
      li.classList.toggle('active',    s === n);
      li.classList.toggle('completed', s < n);
    });
    localStorage.currentStep = n;
    window.scrollTo({ top: wizard.offsetTop, behavior: 'smooth' });
  }
  showStep(parseInt(localStorage.currentStep,10)||2);
});

