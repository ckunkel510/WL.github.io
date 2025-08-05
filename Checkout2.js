document.addEventListener('DOMContentLoaded', function() {
  var container = document.querySelector('.container');
  var wizard    = document.createElement('div');
  wizard.className = 'checkout-wizard';
  container.insertBefore(wizard, container.firstChild);

  var nav = document.createElement('ul');
  nav.className = 'checkout-steps';
  wizard.appendChild(nav);

  var steps = [
    {
      title: 'Order details',
      findEls: function() {
        var tx = document.getElementById('ctl00_PageBody_TransactionTypeDiv');
        return tx && tx.closest('.epi-form-col-single-checkout')
          ? [tx.closest('.epi-form-col-single-checkout')]
          : [];
      }
    },
    {
      title: 'Shipping & date',
      findEls: function() {
        var ship = document.getElementById('ctl00_PageBody_SaleTypeSelector_lblDelivered');
        var date = document.getElementById('ctl00_PageBody_dtRequired_DatePicker_wrapper');
        var arr = [];
        if (ship) arr.push(ship.closest('.epi-form-col-single-checkout'));
        if (date) arr.push(date.closest('.epi-form-col-single-checkout'));
        return arr;
      }
    },
    {
      title: 'Your reference',
      findEls: function() {
        var po = document.getElementById('ctl00_PageBody_PurchaseOrderNumberTextBox');
        return po && po.closest('.epi-form-group-checkout')
          ? [po.closest('.epi-form-group-checkout')]
          : [];
      }
    },
    {
      title: 'Branch',
      findEls: function() {
        var brRow = document.getElementById('ctl00_PageBody_BranchSelector');
        return brRow ? [brRow] : [];
      }
    },
    {
      title: 'Delivery address',
      findEls: function() {
        var hdr = document.querySelector('.SelectableAddressType');
        return hdr && hdr.closest('.epi-form-col-single-checkout')
          ? [hdr.closest('.epi-form-col-single-checkout')]
          : [];
      }
    },
    {
      title: 'Invoice address',
      findEls: function() {
        var gp = document.getElementById('ctl00_PageBody_InvoiceAddress_GoogleAddressSearchWrapper');
        return gp && gp.closest('.epi-form-col-single-checkout')
          ? [gp.closest('.epi-form-col-single-checkout')]
          : [];
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

  // Build steps & panes
  steps.forEach(function(step, i) {
    var num = i + 1;
    var li = document.createElement('li');
    li.setAttribute('data-step', num);
    li.textContent = step.title;
    li.addEventListener('click', function(){ showStep(num); });
    nav.appendChild(li);

    var pane = document.createElement('div');
    pane.className = 'checkout-step';
    pane.setAttribute('data-step', num);
    wizard.appendChild(pane);

    step.findEls().forEach(function(el){ pane.appendChild(el); });

    var navDiv = document.createElement('div');
    navDiv.className = 'checkout-nav';
    pane.appendChild(navDiv);

    if (num > 1) {
      var back = document.createElement('button');
      back.className = 'btn btn-secondary';
      back.textContent = 'Back';
      back.addEventListener('click', function(e){
        e.preventDefault();
        showStep(num - 1);
      });
      navDiv.appendChild(back);
    }
    if (num < steps.length) {
      var next = document.createElement('button');
      next.className = 'btn btn-primary';
      next.textContent = 'Next';
      next.addEventListener('click', function(e){
        e.preventDefault();
        showStep(num + 1);
      });
      navDiv.appendChild(next);
    } else {
      var allCont = Array.from(
        document.querySelectorAll('#ctl00_PageBody_ContinueButton1, #ctl00_PageBody_ContinueButton2')
      );
      if (allCont.length) {
        var cont = allCont[allCont.length - 1];
        cont.style.display = '';
        navDiv.appendChild(cont);
      }
    }
  });

  // Prefill delivery address on load (step 5 inputs)
  if (!$('#ctl00_PageBody_DeliveryAddress_AddressLine1').val()) {
    const $link = $('#ctl00_PageBody_CustomerAddressSelector_SelectAddressLinkButton');
    if ($link.length) {
      let $entries = $('.AddressSelectorEntry');
      if ($entries.length) {
        let $pick = $entries.first();
        let minId = parseInt($pick.find('.AddressId').text(), 10);
        $entries.each(function() {
          const id = parseInt($(this).find('.AddressId').text(), 10);
          if (id < minId) { minId = id; $pick = $(this); }
        });
        const txt = $pick.find('dd p').first().text().trim();
        const parts = txt.split(',').map(s => s.trim());
        const [line1 = '', city = ''] = parts;
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

  // AJAX: fetch user name & email into delivery/invoice fields
  $.get("https://webtrack.woodsonlumber.com/AccountSettings.aspx", function(data) {
    const $acc = $(data);
    const fn = $acc.find("#ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput").val() || "";
    const ln = $acc.find("#ctl00_PageBody_ChangeUserDetailsControl_LastNameInput").val() || "";
    let email = $acc.find("#ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput").val() || "";
    email = email.replace(/^\([^)]*\)\s*/, "");
    $("#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox").val(fn);
    $("#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox").val(ln);
    $("#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox").val(email);
  });

  // AJAX: fetch telephone into delivery field
  $.get("https://webtrack.woodsonlumber.com/AccountInfo_R.aspx", function(data) {
    const tel = $(data).find("#ctl00_PageBody_TelephoneLink_TelephoneLink").text().trim();
    $("#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox").val(tel);
  });

  // Step switcher
  function showStep(n) {
    wizard.querySelectorAll('.checkout-step').forEach(function(p){
      p.classList.toggle('active', +p.getAttribute('data-step') === n);
    });
    nav.querySelectorAll('li').forEach(function(b){
      var s = +b.getAttribute('data-step');
      b.classList.toggle('active',    s === n);
      b.classList.toggle('completed', s <  n);
    });
    window.scrollTo({ top: wizard.offsetTop, behavior: 'smooth' });
  }

  // Immediately show step 2 (marks step 1 complete)
  showStep(2);
});