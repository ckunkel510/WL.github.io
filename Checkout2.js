
document.addEventListener('DOMContentLoaded', function() {
  // reset wizard to step 1 on each fresh load
if (localStorage.sameAsDelivery !== 'true') {
    localStorage.removeItem('currentStep');
  }

  // Hide the original “Date Required” picker entirely
  var dateColDefault = document.getElementById('ctl00_PageBody_dtRequired_DatePicker_wrapper');
  if (dateColDefault) dateColDefault.style.display = 'none';
  // Hide the ASP.NET panel of default Back/Continue
$('.submit-button-panel').hide();

// Hide the original “Date required:” label
$('label').filter(function(){
  return $(this).text().trim() === 'Date required:';
}).hide();

// Hide the default date-picker wrapper and its form-control container
$('div.form-control').hide();
$('#ctl00_PageBody_dtRequired_DatePicker_wrapper').hide();
// hide the entire epi‐form group that contains the “Date required” picker
$('#ctl00_PageBody_dtRequired_DatePicker_wrapper')
  .closest('.epi-form-col-single-checkout.epi-form-group-checkout')
  .hide();


// Rename the secondary back button
$('#ctl00_PageBody_BackToCartButton2').val('Back to Cart');
// clear any old “billing-same” flag so we always start unchecked



  // 1) Create wizard container & nav
  var container = document.querySelector('.container');
  var wizard    = document.createElement('div');
  wizard.className = 'checkout-wizard';
  container.insertBefore(wizard, container.firstChild);
  var nav = document.createElement('ul');
  nav.className = 'checkout-steps';
  wizard.appendChild(nav);

  function suppressPostback(el) {
    if (!el) return;
    el.onchange = function(e) {
      e.stopImmediatePropagation();
      e.preventDefault();
    };
  }

  // 2) Define steps
  var steps = [
    { title:'Order details',    findEls:()=>{ let tx=document.getElementById('ctl00_PageBody_TransactionTypeDiv'); return tx?[tx.closest('.epi-form-col-single-checkout')]:[]; }},
    { title:'Shipping method',   findEls:()=>{ let ship=document.getElementById('ctl00_PageBody_SaleTypeSelector_lblDelivered'); return ship?[ship.closest('.epi-form-col-single-checkout')]:[]; }},
    { title:'Your reference',    findEls:()=>{ let po=document.getElementById('ctl00_PageBody_PurchaseOrderNumberTextBox'); return po?[po.closest('.epi-form-group-checkout')]:[]; }},
    { title:'Branch',            findEls:()=>{ let br=document.getElementById('ctl00_PageBody_BranchSelector'); return br?[br]:[]; }},
    { title:'Delivery address',  findEls:()=>{ let hdr=document.querySelector('.SelectableAddressType'); return hdr?[hdr.closest('.epi-form-col-single-checkout')]:[]; }},
    { title:'Billing address',   findEls:()=>{ let gp=document.getElementById('ctl00_PageBody_InvoiceAddress_GoogleAddressSearchWrapper'); return gp?[gp.closest('.epi-form-col-single-checkout')]:[]; }},
    { title:'Special instructions', findEls:()=>{
        let arr=[];
        let tbl = document.querySelector('.cartTable');
        if(tbl) arr.push(tbl.closest('table'));
        let si = document.getElementById('ctl00_PageBody_SpecialInstructionsTextBox');
        if(si){
          let wrap = si.closest('.epi-form-group-checkout')
                   || si.closest('.epi-form-col-single-checkout')
                   || si.parentElement;
          arr.push(wrap);
        }
        return arr;
    }}
  ];

  // 3) Build wizard
  steps.forEach(function(step,i){
    let num = i+1;
    let li = document.createElement('li');
    li.dataset.step = num;
    li.textContent = step.title;
    li.addEventListener('click', ()=> showStep(num));
    nav.appendChild(li);

    let pane = document.createElement('div');
    pane.className = 'checkout-step';
    pane.dataset.step = num;
    wizard.appendChild(pane);
    step.findEls().forEach(el=> pane.appendChild(el));

    let navDiv = document.createElement('div');
    navDiv.className = 'checkout-nav';
    pane.appendChild(navDiv);

    if(num>1){
      let back = document.createElement('button');
      back.type = 'button';
      back.className='btn btn-secondary';
      back.textContent='Back';
      back.addEventListener('click', e=>{ e.preventDefault(); showStep(num-1); });
      navDiv.appendChild(back);
    }
    if(num<steps.length){
      let next = document.createElement('button');
      next.type = 'button';
      next.className='btn btn-primary';
      next.textContent='Next';
      next.addEventListener('click', e=>{ e.preventDefault(); showStep(num+1); });
      navDiv.appendChild(next);
    } else {
      let conts = Array.from(document.querySelectorAll(
        '#ctl00_PageBody_ContinueButton1,#ctl00_PageBody_ContinueButton2'
      ));
      if(conts.length){
        let cont = conts.pop();
        cont.style.display = '';
        cont.type = 'submit';
        navDiv.appendChild(cont);
      }
    }
  });

  // 4) Optional tag on step 3
  (function(){
    let p3 = wizard.querySelector('.checkout-step[data-step="3"]');
    if(p3){
      let lbl = p3.querySelector('label');
      if(lbl){
        let opt = document.createElement('small');
        opt.className = 'text-muted';
        opt.style.marginLeft = '8px';
        opt.textContent = '(optional)';
        lbl.appendChild(opt);
      }
    }
  })();

  // 5) Rename step 6 header
  (function(){
    let p6 = wizard.querySelector('.checkout-step[data-step="6"]');
    if(p6){
      let hdr = p6.querySelector('.font-weight-bold.mb-3.mt-4');
      if(hdr) hdr.textContent = 'Billing Address';
    }
  })();

  // 6) Optional tag on step 7
  (function(){
    let p7 = wizard.querySelector('.checkout-step[data-step="7"]');
    if(p7){
      let th = p7.querySelector('th');
      if(th){
        let opt2 = document.createElement('small');
        opt2.className='text-muted';
        opt2.style.marginLeft='8px';
        opt2.textContent='(optional)';
        th.appendChild(opt2);
      }
    }
  })();

  // 7) Prefill delivery address
  if(!$('#ctl00_PageBody_DeliveryAddress_AddressLine1').val()){
    let $link = $('#ctl00_PageBody_CustomerAddressSelector_SelectAddressLinkButton');
    if($link.length){
      let $entries = $('.AddressSelectorEntry');
      if($entries.length){
        let $pick = $entries.first(), minId = parseInt($pick.find('.AddressId').text(),10);
        $entries.each(function(){
          let id = parseInt($(this).find('.AddressId').text(),10);
          if(id<minId){ minId=id; $pick=$(this); }
        });
        let parts = $pick.find('dd p').first().text().trim().split(',').map(s=>s.trim());
        let line1 = parts[0]||'', city=parts[1]||'', state='', zip='';
        if(parts.length>=4){ state=parts[parts.length-2]; zip=parts[parts.length-1]; }
        else if(parts.length>2){
          let m = parts[2].match(/(.+?)\s*(\d{5}(?:-\d{4})?)?$/);
          if(m){ state=m[1].trim(); zip=m[2]||''; }
        }
        $('#ctl00_PageBody_DeliveryAddress_AddressLine1').val(line1);
        $('#ctl00_PageBody_DeliveryAddress_City').val(city);
        $('#ctl00_PageBody_DeliveryAddress_Postcode').val(zip);
        $('#ctl00_PageBody_DeliveryAddress_CountrySelector').val('USA');
        $('#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList option').each(function(){
          if($(this).text().trim().toLowerCase() === state.toLowerCase()){
            $(this).prop('selected',true); return false;
          }
        });
      }
    }
  }

  // 8) AJAX fetch user info
  $.get('https://webtrack.woodsonlumber.com/AccountSettings.aspx', data=>{
    let $acc=$(data),
        fn=$acc.find('#ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput').val()||'',
        ln=$acc.find('#ctl00_PageBody_ChangeUserDetailsControl_LastNameInput').val()||'',
        em=($acc.find('#ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput').val()||'')
             .replace(/^\([^)]*\)\s*/,'');
    $('#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox').val(fn);
    $('#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox').val(ln);
    $('#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox').val(em);
  });
  $.get('https://webtrack.woodsonlumber.com/AccountInfo_R.aspx', data=>{
    let tel=$(data).find('#ctl00_PageBody_TelephoneLink_TelephoneLink').text().trim();
    $('#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox').val(tel);
  });

  // 9) Delivery summary/edit (step 5)
  (function(){
    let pane5 = wizard.querySelector('.checkout-step[data-step="5"]');
    if(!pane5) return;
    let col = pane5.querySelector('.epi-form-col-single-checkout'),
        wrap = document.createElement('div'),
        sum  = document.createElement('div');
    wrap.className='delivery-inputs';
    while(col.firstChild) wrap.appendChild(col.firstChild);
    col.appendChild(wrap);
    sum.className='delivery-summary';

    let delState   = wrap.querySelector('#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList'),
        delCountry = wrap.querySelector('#ctl00_PageBody_DeliveryAddress_CountrySelector');
    suppressPostback(delState);
    suppressPostback(delCountry);

    function upd(){
      let a1 = wrap.querySelector('#ctl00_PageBody_DeliveryAddress_AddressLine1').value||'',
          a2 = wrap.querySelector('#ctl00_PageBody_DeliveryAddress_AddressLine2').value||'',
          c  = wrap.querySelector('#ctl00_PageBody_DeliveryAddress_City').value||'',
          s  = wrap.querySelector('#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList')
                 .selectedOptions[0].text||'',
          z  = wrap.querySelector('#ctl00_PageBody_DeliveryAddress_Postcode').value||'';
      sum.innerHTML = `<strong>Delivery Address</strong><br>
        ${a1}${a2?'<br>'+a2:''}<br>
        ${c}, ${s} ${z}<br>
        <button type="button" id="editDelivery" class="btn btn-link">Edit</button>`;
    }
    wrap.style.display='none';
    col.insertBefore(sum, wrap);
    sum.addEventListener('click', e=>{
      if(e.target.id!=='editDelivery') return;
      e.preventDefault();
      sum.style.display='none';
      wrap.style.display='';
      wrap.scrollIntoView({behavior:'smooth'});
      if(!wrap.querySelector('#saveDelivery')){
        let btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'saveDelivery';
        btn.className = 'btn btn-primary mt-2';
        btn.textContent = 'Save';
        wrap.appendChild(btn);
        btn.addEventListener('click', ()=>{
          upd();
          wrap.style.display='none';
          sum.style.display='';
          localStorage.currentStep = 5;
        });
      }
    });
    upd();
  })();

  // 10) Billing-same + invoice summary/edit (step 6)
  (function(){
    let pane6 = wizard.querySelector('.checkout-step[data-step="6"]');
    if(!pane6) return;
    let orig = document.getElementById('copyDeliveryAddressButton');
    if(orig) orig.style.display='none';

    let chkDiv = document.createElement('div');
    chkDiv.className='form-check mb-3';
    chkDiv.innerHTML=`
      <input class="form-check-input" type="checkbox" id="sameAsDeliveryCheck">
      <label class="form-check-label" for="sameAsDeliveryCheck">
        Billing address is the same as delivery address
      </label>`;
    pane6.insertBefore(chkDiv, pane6.firstChild);
    let sameCheck = chkDiv.querySelector('#sameAsDeliveryCheck');

    let colInv   = pane6.querySelector('.epi-form-col-single-checkout'),
        wrapInv  = document.createElement('div'),
        sumInv   = document.createElement('div');
    wrapInv.className='invoice-inputs';
    while(colInv.firstChild) wrapInv.appendChild(colInv.firstChild);
    colInv.appendChild(wrapInv);
    sumInv.className='invoice-summary';

    let invState   = wrapInv.querySelector('#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList'),
        invCountry = wrapInv.querySelector('#ctl00_PageBody_InvoiceAddress_CountrySelector1');
    suppressPostback(invState);
    suppressPostback(invCountry);

    function refreshInv(){
      let a1 = wrapInv.querySelector('#ctl00_PageBody_InvoiceAddress_AddressLine1').value||'',
          a2 = wrapInv.querySelector('#ctl00_PageBody_InvoiceAddress_AddressLine2').value||'',
          c  = wrapInv.querySelector('#ctl00_PageBody_InvoiceAddress_City').value||'',
          st = invState?invState.selectedOptions[0].text:'', 
          z  = wrapInv.querySelector('#ctl00_PageBody_InvoiceAddress_Postcode').value||'',
          e  = wrapInv.querySelector('#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox').value||'';
      sumInv.innerHTML = `<strong>Billing Address</strong><br>
        ${a1}${a2?'<br>'+a2:''}<br>
        ${c}, ${st} ${z}<br>
        Email: ${e}<br>
        <button type="button" id="editInvoice" class="btn btn-link">Enter new billing address</button>`;
    }
    wrapInv.style.display='none';
    sumInv.style.display='none';
    colInv.insertBefore(sumInv, wrapInv);

    if (localStorage.sameAsDelivery === 'true') {
  // user had checked it previously → show summary
  sameCheck.checked = true;
  refreshInv();
  wrapInv.style.display = 'none';
  sumInv.style.display  = '';
} else {
  // default or user had unchecked → show full form
  sameCheck.checked = false;
  wrapInv.style.display = '';
  sumInv.style.display  = 'none';
}

    sameCheck.addEventListener('change', function(){
      if(this.checked){
        localStorage.sameAsDelivery='true';
        __doPostBack('ctl00$PageBody$CopyDeliveryAddressLinkButton','');
      } else {
        localStorage.sameAsDelivery='false';
        sumInv.style.display='none';
        wrapInv.style.display='';
      }
    });
    sumInv.addEventListener('click', e=>{
      if(e.target.id!=='editInvoice') return;
      e.preventDefault();
      sumInv.style.display='none';
      wrapInv.style.display='';
      wrapInv.scrollIntoView({behavior:'smooth'});
    });
  })();

  // 11) Step 7: pickup/delivery & special instructions
  // Step 7: pickup vs delivery logic, special instructions, no past dates & no Sundays
(function(){
  const p7 = wizard.querySelector('.checkout-step[data-step="7"]');
  if (!p7) return;

  // — Helpers for local-date parsing/formatting —
  const parseLocalDate = s => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const formatLocal = d => {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  };

  // 1) Optional tag
  const th = p7.querySelector('th');
  if (th) {
    const opt2 = document.createElement('small');
    opt2.className = 'text-muted';
    opt2.style.marginLeft = '8px';
    opt2.textContent = '(optional)';
    th.appendChild(opt2);
  }

  // 2) Special instructions field (hidden)
  const specialIns = document.getElementById('ctl00_PageBody_SpecialInstructionsTextBox');
  const siWrap     = specialIns.closest('.epi-form-group-checkout')
                  || specialIns.closest('.epi-form-col-single-checkout')
                  || specialIns.parentElement;
  // hide the original text box completely
  specialIns.style.display = 'none';

  // 3) Pickup inputs
  const pickupDiv = document.createElement('div');
  pickupDiv.className = 'form-group';
  pickupDiv.innerHTML = `
    <label for="pickupDate">Requested Pickup Date:</label>
    <input type="date" id="pickupDate" class="form-control">
    <label for="pickupTime">Requested Pickup Time:</label>
    <select id="pickupTime" class="form-control" disabled></select>
    <label for="pickupPerson">Pickup Person:</label>
    <input type="text" id="pickupPerson" class="form-control">`;
  pickupDiv.style.display = 'none';

  // 4) Delivery inputs
  const deliveryDiv = document.createElement('div');
  deliveryDiv.className = 'form-group';
  deliveryDiv.innerHTML = `
    <label for="deliveryDate">Requested Delivery Date:</label>
    <input type="date" id="deliveryDate" class="form-control">
    <div>
      <label><input type="radio" name="deliveryTime" value="Morning"> Morning</label>
      <label><input type="radio" name="deliveryTime" value="Afternoon"> Afternoon</label>
    </div>`;
  deliveryDiv.style.display = 'none';

  // 5) Insert into DOM
  siWrap.insertAdjacentElement('afterend', pickupDiv);
  pickupDiv.insertAdjacentElement('afterend', deliveryDiv);

  // 6) Additional instructions textarea
  const extraDiv = document.createElement('div');
  extraDiv.className = 'form-group';
  extraDiv.innerHTML = `
    <label for="specialInsExtra">Additional instructions:</label>
    <textarea id="specialInsExtra" class="form-control" placeholder="Optional additional notes"></textarea>`;
  deliveryDiv.insertAdjacentElement('afterend', extraDiv);
  const specialExtra = document.getElementById('specialInsExtra');

  // 7) Date limits
  const today      = new Date();
  const isoToday   = formatLocal(today);

  const maxPickupD = new Date(); maxPickupD.setDate(maxPickupD.getDate() + 14);
  const isoMaxPick = formatLocal(maxPickupD);

  const minDelD    = new Date(); minDelD.setDate(minDelD.getDate() + 2);
  const isoDel     = formatLocal(minDelD);

  const pickupInput   = pickupDiv.querySelector('#pickupDate');
  const pickupTimeSel = pickupDiv.querySelector('#pickupTime');
  const deliveryInput = deliveryDiv.querySelector('#deliveryDate');

  pickupInput.setAttribute('min', isoToday);
  pickupInput.setAttribute('max', isoMaxPick);
  deliveryInput.setAttribute('min', isoDel);

  // 8) Time-block builder
  function formatTime(h,m){
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hh = (h % 12) || 12;
    const mm = String(m).padStart(2,'0');
    return `${hh}:${mm} ${ampm}`;
  }
  function populatePickupTimes(date){
    const day = date.getDay();
    let openMins = 7*60 + 30, closeMins;
    if (1 <= day && day <= 5) closeMins = 17*60 + 30;
    else if (day === 6)      closeMins = 16*60;
    else                     closeMins = openMins + 60;

    pickupTimeSel.innerHTML = '';
    for (let m = openMins; m + 60 <= closeMins; m += 60) {
      const start = formatTime(Math.floor(m/60), m%60);
      const end   = formatTime(Math.floor((m+60)/60),(m+60)%60);
      const opt   = document.createElement('option');
      opt.value   = `${start}–${end}`;
      opt.text    = `${start} – ${end}`;
      pickupTimeSel.appendChild(opt);
    }
    pickupTimeSel.disabled = false;
  }

  // 9) Pickup change
  pickupInput.addEventListener('change', function(){
    if (!this.value) return updateSpecial();
    let d = parseLocalDate(this.value);

    // block Sundays → Monday
    if (d.getDay() === 0) {
      alert('No Sunday pickups – moved to Monday');
      d.setDate(d.getDate() + 1);
    }
    // enforce 14-day max
    if (d > maxPickupD) {
      alert('Pickups only within next two weeks');
      d = maxPickupD;
    }

    this.value = formatLocal(d);
    populatePickupTimes(d);
    updateSpecial();
  });

  // 10) Delivery change
  deliveryInput.addEventListener('change', function(){
    if (!this.value) return updateSpecial();
    let d = parseLocalDate(this.value);

    if (d.getDay() === 0) {
      alert('No Sunday deliveries – moved to Monday');
      d.setDate(d.getDate() + 1);
    }
    if (d < minDelD) {
      alert('Select at least 2 days out');
      d = minDelD;
    }

    this.value = formatLocal(d);
    updateSpecial();
  });

  // 11) Show/hide & special-instructions update
  const rbPick   = document.getElementById('ctl00_PageBody_SaleTypeSelector_rbCollectLater');
  const rbDel    = document.getElementById('ctl00_PageBody_SaleTypeSelector_rbDelivered');
  const zipInput = document.getElementById('ctl00_PageBody_DeliveryAddress_Postcode');
  function inZone(z){ return ['75','76','77','78','79'].includes((z||'').substring(0,2)); }

  function updateSpecial(){
    let baseText = '';
    if (rbPick.checked) {
      const d = pickupInput.value;
      const t = pickupTimeSel.value;
      const p = pickupDiv.querySelector('#pickupPerson').value;
      specialIns.readOnly = false;
      baseText = 'Pickup on ' + d + (t ? ' at ' + t : '') + (p ? ' for ' + p : '');
    }
    else if (rbDel.checked) {
      specialIns.readOnly = true;
      if (inZone(zipInput.value)) {
        const d2 = deliveryInput.value;
        const t2 = deliveryDiv.querySelector('input[name="deliveryTime"]:checked');
        baseText = 'Delivery on ' + d2 + (t2 ? ' (' + t2.value + ')' : '');
      } else {
        baseText = 'Ship via 3rd party delivery on next screen.';
      }
    }
    // append any extra notes
    specialIns.value = baseText + (specialExtra.value ? ' – ' + specialExtra.value : '');
  }

  function onShip(){
    if (rbPick.checked) {
      pickupDiv.style.display   = 'block';
      deliveryDiv.style.display = 'none';
    } else if (rbDel.checked) {
      pickupDiv.style.display   = 'none';
      deliveryDiv.style.display = 'block';
    } else {
      pickupDiv.style.display =
      deliveryDiv.style.display = 'none';
    }
    updateSpecial();
  }

  rbPick.addEventListener('change', onShip);
  rbDel .addEventListener('change', onShip);
  pickupDiv.querySelector('#pickupPerson')
           .addEventListener('input', updateSpecial);
  deliveryDiv.querySelectorAll('input[name="deliveryTime"]')
             .forEach(r=>r.addEventListener('change', updateSpecial));
  specialExtra.addEventListener('input', updateSpecial);

  onShip();
})();




  // 12) Step switcher + persistence
  function showStep(n){
    wizard.querySelectorAll('.checkout-step')
      .forEach(p=>p.classList.toggle('active', +p.dataset.step===n));
    nav.querySelectorAll('li').forEach(li=>{
      let s=+li.dataset.step;
      li.classList.toggle('active',    s===n);
      li.classList.toggle('completed', s< n);
    });
    localStorage.currentStep = n;
    window.scrollTo({ top: wizard.offsetTop, behavior: 'smooth' });
  }
  showStep(parseInt(localStorage.currentStep,10)||2);
});

$(document).ready(function(){
  $('#ctl00_PageBody_ContinueButton2').on('click', function(e){
    var valid = true;
    var errors = [];

    // DELIVERY validation
    if ($('#deliveryDate').closest('.form-group').is(':visible')) {
      if (!$('#deliveryDate').val()) {
        valid = false;
        errors.push('• Please select a Requested Delivery Date.');
      }
      if (!$('input[name="deliveryTime"]:checked').length) {
        valid = false;
        errors.push('• Please choose a Delivery Time (Morning or Afternoon).');
      }
    }

    // PICKUP validation
    if ($('#pickupDate').closest('.form-group').is(':visible')) {
      if (!$('#pickupDate').val()) {
        valid = false;
        errors.push('• Please select a Requested Pickup Date.');
      }
      if (!$('#pickupPerson').val().trim()) {
        valid = false;
        errors.push('• Please enter a Pickup Person.');
      }
    }

    if (!valid) {
      e.preventDefault();
      alert('Hold on – we need a bit more info:\n\n' + errors.join('\n'));
    }
  });
});













(function () {
  document.addEventListener('DOMContentLoaded', function () {
    const placeOrderBtn = document.getElementById('ctl00_PageBody_PlaceOrderButton');
    const backToCartBtn = document.getElementById('ctl00_PageBody_BackToCartButton3');

    function overrideSessionState() {
      console.log('[Checkout] Overriding localStorage: sameAsDelivery = false, currentStep = 2');
      localStorage.setItem('sameAsDelivery', 'false');
      localStorage.setItem('currentStep', '2');
    }

    if (placeOrderBtn) {
      placeOrderBtn.addEventListener('click', overrideSessionState);
    }

    if (backToCartBtn) {
      backToCartBtn.addEventListener('click', overrideSessionState);
    }
  });
})();















$(document).ready(function() {


// ===================================================
  // (B) Modern Transaction & Shipping Selectors
  // ===================================================
  if ($("#ctl00_PageBody_TransactionTypeDiv").length) {
    $(".TransactionTypeSelector").hide();
    const txnHTML = `
      <div class="modern-transaction-selector d-flex justify-content-around">
        <button id="btnOrder" class="btn btn-primary" data-value="rdbOrder">
          <i class="fas fa-shopping-cart"></i> Order
        </button>
        <button id="btnQuote" class="btn btn-secondary" data-value="rdbQuote">
          <i class="fas fa-file-alt"></i> Request Quote
        </button>
      </div>
    `;
    $("#ctl00_PageBody_TransactionTypeDiv").append(txnHTML);

    function updateTransactionStyles(val) {
      console.log(`Transaction type updated: ${val}`);
      const orderRad = $("#ctl00_PageBody_TransactionTypeSelector_rdbOrder");
      const quoteRad = $("#ctl00_PageBody_TransactionTypeSelector_rdbQuote");
      if (val === "rdbOrder") {
        orderRad.prop("checked", true);
        $("#btnOrder").addClass("btn-primary").removeClass("btn-secondary");
        $("#btnQuote").addClass("btn-secondary").removeClass("btn-primary");
      } else {
        quoteRad.prop("checked", true);
        $("#btnQuote").addClass("btn-primary").removeClass("btn-secondary");
        $("#btnOrder").addClass("btn-secondary").removeClass("btn-primary");
      }
    }

    // init & click
    updateTransactionStyles(
      $("#ctl00_PageBody_TransactionTypeSelector_rdbOrder").is(":checked") ? "rdbOrder" : "rdbQuote"
    );
    $(document).on("click", ".modern-transaction-selector button", function() {
      updateTransactionStyles($(this).data("value"));
    });
  } else {
    console.warn("Transaction type div not found.");
  }


  if ($(".SaleTypeSelector").length) {
  $(".SaleTypeSelector").hide();
  const shipHTML = `
    <div class="modern-shipping-selector d-flex justify-content-around">
      <button id="btnDelivered" class="btn btn-primary" data-value="rbDelivered">
        <i class="fas fa-truck"></i> Delivered
      </button>
      <button id="btnPickup" class="btn btn-secondary" data-value="rbCollectLater">
        <i class="fas fa-store"></i> Pickup (Free)
      </button>
    </div>
  `;
  $(".epi-form-col-single-checkout:has(.SaleTypeSelector)").append(shipHTML);

  function updateShippingStyles(val) {
    console.log(`Shipping method updated: ${val}`);
    const delRad  = $("#ctl00_PageBody_SaleTypeSelector_rbDelivered");
    const pickRad = $("#ctl00_PageBody_SaleTypeSelector_rbCollectLater");

    if (val === "rbDelivered") {
      // check & trigger change so your Step 7 script’s onShip() runs
      delRad.prop("checked", true).trigger("change");
      $("#btnDelivered")
        .addClass("btn-primary").removeClass("btn-secondary");
      $("#btnPickup")
        .addClass("btn-secondary").removeClass("btn-primary");
        document.cookie = "pickupSelected=false; path=/";
    } else {
      pickRad.prop("checked", true).trigger("change");
      $("#btnPickup")
        .addClass("btn-primary").removeClass("btn-secondary");
      $("#btnDelivered")
        .addClass("btn-secondary").removeClass("btn-primary");
        document.cookie = "pickupSelected=true; path=/";
    }
  }

  // initialize based on whatever’s already checked
  updateShippingStyles(
    $("#ctl00_PageBody_SaleTypeSelector_rbDelivered").is(":checked")
      ? "rbDelivered"
      : "rbCollectLater"
  );

  // wire up your modern buttons
  $(document).on("click", ".modern-shipping-selector button", function() {
    updateShippingStyles($(this).data("value"));
  });
}
 else {
    console.warn("Shipping method selector not found.");
  }

})


























(function(){
  // Helper to read a cookie by name
  function readCookie(name) {
    return document.cookie
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith(name + '='))
      ?.split('=')[1];
  }

  // Try to find & click (or invoke) the Continue button
  function tryAutoContinue() {
    if (readCookie('pickupSelected') !== 'true') return;
    var btn = document.getElementById('ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView');
    if (!btn) return;
    // Stop polling/handlers once we've found it
    clearInterval(pollTimer);

    // If it has an href with WebForm_DoPostBackWithOptions, invoke it directly
    var href = btn.getAttribute('href') || '';
    if (href.startsWith('javascript:')) {
      href = href.replace(/^javascript:/, '');
      try { eval(href); } catch(e){ console.error(e); }
    } else {
      // Fallback to click()
      btn.click();
    }
  }

  // On initial load, start polling every 200ms
  var pollTimer = setInterval(tryAutoContinue, 200);

  // Also hook into ASP.NET AJAX partial‐postback endRequest so it works if Continue
  // appears after an UpdatePanel refresh
  if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager) {
    Sys.WebForms.PageRequestManager.getInstance().add_endRequest(tryAutoContinue);
  }
})();


