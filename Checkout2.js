
document.addEventListener('DOMContentLoaded', function() {
  // 1) Wizard container & nav
  var container = document.querySelector('.container');
  var wizard    = document.createElement('div');
  wizard.className = 'checkout-wizard';
  container.insertBefore(wizard, container.firstChild);
  var nav = document.createElement('ul');
  nav.className = 'checkout-steps';
  wizard.appendChild(nav);

  // 2) Define the 7 steps
  var steps = [
    {
      title: 'Order details',
      findEls: function() {
        var tx = document.getElementById('ctl00_PageBody_TransactionTypeDiv');
        return tx ? [tx.closest('.epi-form-col-single-checkout')] : [];
      }
    },
    {
      title: 'Shipping method',
      findEls: function() {
        var el = document
          .getElementById('ctl00_PageBody_SaleTypeSelector_rbDelivered')
          .closest('.epi-form-col-single-checkout');
        return el ? [el] : [];
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
      title: 'Billing address',
      findEls: function() {
        var gp = document.getElementById('ctl00_PageBody_InvoiceAddress_GoogleAddressSearchWrapper');
        return gp ? [gp.closest('.epi-form-col-single-checkout')] : [];
      }
    },
    {
      title: 'Special instructions',
      findEls: function() {
        var arr = [];
        // Move "Date required" into step 7
        var dateGrp = document.getElementById('ctl00_PageBody_dtRequired_DatePicker_wrapper');
        if (dateGrp) arr.push(dateGrp.closest('.epi-form-col-single-checkout'));
        // Special Instructions table
        var tbl = document.querySelector('.cartTable');
        if (tbl) arr.push(tbl);
        return arr;
      }
    }
  ];

  // 3) Build each step & pane
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

    // Move elements in
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

  // 4) Optional tag on step 3
  (function() {
    var pane3 = wizard.querySelector('[data-step="3"]');
    var lbl   = pane3 && pane3.querySelector('label');
    if (lbl) {
      var opt = document.createElement('small');
      opt.className   = 'text-muted';
      opt.style.marginLeft = '8px';
      opt.textContent = '(optional)';
      lbl.appendChild(opt);
    }
  })();

  // 5) Change step 6 header
  (function() {
    var pane6 = wizard.querySelector('[data-step="6"]');
    var hdr   = pane6 && pane6.querySelector('.font-weight-bold.mb-3.mt-4');
    if (hdr) hdr.textContent = 'Billing Address';
  })();

  // 6) Optional tag on step 7
  (function() {
    var pane7 = wizard.querySelector('[data-step="7"]');
    var th    = pane7 && pane7.querySelector('th');
    if (th) {
      var opt = document.createElement('small');
      opt.className   = 'text-muted';
      opt.style.marginLeft = '8px';
      opt.textContent = '(optional)';
      th.appendChild(opt);
    }
  })();

  // 7) Prefill Delivery (step 5)
  if (!$('#ctl00_PageBody_DeliveryAddress_AddressLine1').val()) {
    var entries = $('.AddressSelectorEntry');
    if (entries.length) {
      var pick = entries.first(),
          minId = parseInt(pick.find('.AddressId').text(), 10);
      entries.each(function() {
        var id = parseInt($(this).find('.AddressId').text(), 10);
        if (id < minId) { minId = id; pick = $(this); }
      });
      var parts = pick.find('dd p').first().text().trim()
                   .split(',').map(function(s){return s.trim();}),
          line1 = parts[0]||'', city = parts[1]||'', state='', zip='';
      if (parts.length>=4) {
        state = parts[parts.length-2];
        zip   = parts[parts.length-1];
      } else if (parts.length>2) {
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

  // 8) AJAX for name/email/phone
  $.get('https://webtrack.woodsonlumber.com/AccountSettings.aspx', function(data) {
    var acc=$(data),
        fn=acc.find('#ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput').val()||'',
        ln=acc.find('#ctl00_PageBody_ChangeUserDetailsControl_LastNameInput').val()||'',
        em=(acc.find('#ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput').val()||'')
             .replace(/^\([^)]*\)\s*/, '');
    $('#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox').val(fn);
    $('#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox').val(ln);
    $('#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox').val(em);
  });
  $.get('https://webtrack.woodsonlumber.com/AccountInfo_R.aspx', function(data) {
    var tel=$(data).find('#ctl00_PageBody_TelephoneLink_TelephoneLink').text().trim();
    $('#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox').val(tel);
  });

  // 9) Step 5 Delivery summary/edit
  (function() {
    var p5  = wizard.querySelector('[data-step="5"]'),
        col = p5 && p5.querySelector('.epi-form-col-single-checkout');
    if (!col) return;
    var wrap = document.createElement('div'),
        sum  = document.createElement('div');
    wrap.className = 'delivery-inputs';
    while(col.firstChild) wrap.appendChild(col.firstChild);
    col.appendChild(wrap);
    sum.className = 'delivery-summary';
    function upd() {
      var a1 = wrap.querySelector('#ctl00_PageBody_DeliveryAddress_AddressLine1').value||'',
          a2 = wrap.querySelector('#ctl00_PageBody_DeliveryAddress_AddressLine2').value||'',
          c  = wrap.querySelector('#ctl00_PageBody_DeliveryAddress_City').value||'',
          s  = wrap.querySelector('#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList')
                    .selectedOptions[0].text||'',
          z  = wrap.querySelector('#ctl00_PageBody_DeliveryAddress_Postcode').value||'';
      sum.innerHTML = `<strong>Delivery Address</strong><br>
        ${a1}${a2?'<br>'+a2:''}<br>
        ${c}, ${s} ${z}<br>
        <button id="editDelivery" class="btn btn-link">Edit</button>`;
    }
    wrap.style.display = 'none';
    col.insertBefore(sum, wrap);
    sum.addEventListener('click', function(e) {
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
        btn.addEventListener('click', function() {
          upd();
          wrap.style.display='none';
          sum.style.display='';
          localStorage.currentStep=5;
        });
      }
    });
    upd();
  })();

  // 10) Step 7: Pickup Person & Delivery Date/Time in Special Instructions
  (function() {
    var p7      = wizard.querySelector('[data-step="7"]'),
        special = document.getElementById('ctl00_PageBody_SpecialInstructionsTextBox'),
        rbDel   = document.getElementById('ctl00_PageBody_SaleTypeSelector_rbDelivered'),
        rbPick  = document.getElementById('ctl00_PageBody_SaleTypeSelector_rbCollectLater'),
        zip     = document.getElementById('ctl00_PageBody_DeliveryAddress_Postcode'),
        dateCnt = p7 && p7.querySelector('#ctl00_PageBody_dtRequired_DatePicker_wrapper')
                    .closest('.epi-form-col-single-checkout'),
        // Create Pickup Person input
        pickupDiv = document.createElement('div'),
        // Create custom Delivery Date/Time input
        deliveryDiv = document.createElement('div');

    if (!p7 || !special || !dateCnt) return;

    pickupDiv.className = 'epi-form-group-checkout';
    pickupDiv.innerHTML = `
      <div><label for="pickupPerson">Pickup Person:</label></div>
      <div><input type="text" id="pickupPerson" class="form-control"></div>`;
    pickupDiv.style.display='none';
    // Insert after date container
    dateCnt.parentNode.insertBefore(pickupDiv, dateCnt.nextSibling);

    deliveryDiv.className = 'form-group';
    deliveryDiv.innerHTML = `
      <label for="deliveryDate">Requested Delivery Date:</label>
      <input type="date" id="deliveryDate" class="form-control">
      <div>
        <label><input type="radio" name="deliveryTime" value="Morning"> Morning</label>
        <label><input type="radio" name="deliveryTime" value="Afternoon"> Afternoon</label>
      </div>`;
    deliveryDiv.style.display='none';
    special.closest('table').parentNode.insertBefore(deliveryDiv, special.closest('table').nextSibling);

    function inZone(z) {
      return ['75','76','77','78','79'].includes((z||'').substring(0,2));
    }
    function updateSpecial() {
      if (rbPick.checked) {
        var d = document.getElementById('ctl00_PageBody_dtRequired_DatePicker_dateInput').value,
            p = document.getElementById('pickupPerson').value;
        special.value = 'Pickup on ' + d + (p? ' for '+p : '');
      } else if (rbDel.checked) {
        var z = zip.value||'';
        if (inZone(z)) {
          var d2 = document.getElementById('deliveryDate').value,
              t  = p7.querySelector('input[name="deliveryTime"]:checked');
          special.value = 'Delivery on ' + d2 + (t? ' ('+t.value+')' : '');
        } else {
          special.value = 'Ship via 3rd party delivery selected on next screen.';
        }
      }
    }
    function onStep7() {
      if (rbPick.checked) {
        dateCnt.style.display = '';
        pickupDiv.style.display = '';
        deliveryDiv.style.display = 'none';
        special.readOnly = false;
      } else if (rbDel.checked) {
        dateCnt.style.display = 'none';
        pickupDiv.style.display = 'none';
        special.readOnly = true;
        var z2 = zip.value||'';
        if (inZone(z2)) {
          deliveryDiv.style.display = '';
        } else {
          deliveryDiv.innerHTML = '<em>Ship via 3rd party delivery selected on next screen.</em>';
          deliveryDiv.style.display = '';
        }
      } else {
        dateCnt.style.display = 'none';
        pickupDiv.style.display = 'none';
        deliveryDiv.style.display = 'none';
        special.readOnly = false;
      }
      updateSpecial();
    }

    rbPick.addEventListener('change', onStep7);
    rbDel .addEventListener('change', onStep7);
    // Listen to both date inputs
    document.getElementById('ctl00_PageBody_dtRequired_DatePicker_dateInput')
      .addEventListener('change', updateSpecial);
    document.getElementById('deliveryDate')
      .addEventListener('change', function(){
        var sel=new Date(this.value),
            min=new Date(); min.setDate(min.getDate()+2);
        if (sel<min||sel.getDay()===0){
          alert('Select at least 2 days out and not Sunday.');
          this.value='';
        }
        updateSpecial();
      });
    document.getElementById('pickupPerson')
      .addEventListener('input', updateSpecial);
    p7.querySelectorAll('input[name="deliveryTime"]')
      .forEach(r=>r.addEventListener('change', updateSpecial));

    onStep7();
  })();

  // 11) Step switcher + persistence
  function showStep(n) {
    wizard.querySelectorAll('.checkout-step').forEach(function(p) {
      p.classList.toggle('active', +p.dataset.step === n);
    });
    nav.querySelectorAll('li').forEach(function(li) {
      var s = +li.dataset.step;
      li.classList.toggle('active',    s === n);
      li.classList.toggle('completed', s <  n);
    });
    localStorage.currentStep = n;
    window.scrollTo({ top: wizard.offsetTop, behavior: 'smooth' });
  }
  showStep(parseInt(localStorage.currentStep, 10) || 2);
});

