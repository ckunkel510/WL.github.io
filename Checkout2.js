document.addEventListener('DOMContentLoaded', function() {
  // 1) Create wizard container & nav
  var container = document.querySelector('.container');
  var wizard    = document.createElement('div');
  wizard.className = 'checkout-wizard';
  container.insertBefore(wizard, container.firstChild);
  var nav = document.createElement('ul');
  nav.className = 'checkout-steps';
  wizard.appendChild(nav);

  // 2) Define the 7 steps (step 2 now only shipping, step 7 includes date + instructions)
  var steps = [
    { title:'Order details',    findEls:()=>{ var tx=document.getElementById('ctl00_PageBody_TransactionTypeDiv'); return tx?[tx.closest('.epi-form-col-single-checkout')]:[]; }},
    { title:'Shipping method',   findEls:()=>{ var ship=document.getElementById('ctl00_PageBody_SaleTypeSelector_lblDelivered'); return ship?[ship.closest('.epi-form-col-single-checkout')]:[]; }},
    { title:'Your reference',    findEls:()=>{ var po=document.getElementById('ctl00_PageBody_PurchaseOrderNumberTextBox'); return po?[po.closest('.epi-form-group-checkout')]:[]; }},
    { title:'Branch',            findEls:()=>{ var br=document.getElementById('ctl00_PageBody_BranchSelector'); return br?[br]:[]; }},
    { title:'Delivery address',  findEls:()=>{ var hdr=document.querySelector('.SelectableAddressType'); return hdr?[hdr.closest('.epi-form-col-single-checkout')]:[]; }},
    { title:'Billing address',   findEls:()=>{ var gp=document.getElementById('ctl00_PageBody_InvoiceAddress_GoogleAddressSearchWrapper'); return gp?[gp.closest('.epi-form-col-single-checkout')]:[]; }},
    { title:'Special instructions', findEls:()=>{
        var arr=[];
        var dateCol = document.getElementById('ctl00_PageBody_dtRequired_DatePicker_wrapper');
        if(dateCol) arr.push(dateCol.closest('.epi-form-col-single-checkout'));
        var tbl = document.querySelector('.cartTable');
        if(tbl) arr.push(tbl.closest('.cartTable'));
        return arr;
    }}
  ];

  // 3) Build each step and its pane
  steps.forEach(function(step,i){
    var num = i+1;
    // nav bullet
    var li = document.createElement('li');
    li.dataset.step = num;
    li.textContent  = step.title;
    li.addEventListener('click', function(){ showStep(num); });
    nav.appendChild(li);
    // content pane
    var pane = document.createElement('div');
    pane.className = 'checkout-step';
    pane.dataset.step = num;
    wizard.appendChild(pane);
    // move existing elements
    step.findEls().forEach(function(el){ pane.appendChild(el); });
    // nav controls
    var navDiv = document.createElement('div');
    navDiv.className = 'checkout-nav';
    pane.appendChild(navDiv);
    if(num>1){
      var back=document.createElement('button');
      back.className='btn btn-secondary';
      back.textContent='Back';
      back.addEventListener('click', function(e){ e.preventDefault(); showStep(num-1); });
      navDiv.appendChild(back);
    }
    if(num<steps.length){
      var next=document.createElement('button');
      next.className='btn btn-primary';
      next.textContent='Next';
      next.addEventListener('click', function(e){ e.preventDefault(); showStep(num+1); });
      navDiv.appendChild(next);
    } else {
      // final: Continue button
      var conts=Array.from(document.querySelectorAll(
        '#ctl00_PageBody_ContinueButton1,#ctl00_PageBody_ContinueButton2'
      ));
      if(conts.length){
        var cont=conts.pop();
        cont.style.display='';
        navDiv.appendChild(cont);
      }
    }
  });

  // 4) Optional tag on step 3 ("Your reference")
  (function(){
    var pane3 = wizard.querySelector('.checkout-step[data-step="3"]');
    if(pane3){
      var lbl = pane3.querySelector('label');
      if(lbl){
        var opt = document.createElement('small');
        opt.className = 'text-muted';
        opt.style.marginLeft = '8px';
        opt.textContent = '(optional)';
        lbl.appendChild(opt);
      }
    }
  })();

  // 5) Change pane6 header to "Billing Address"
  (function(){
    var pane6 = wizard.querySelector('.checkout-step[data-step="6"]');
    if(pane6){
      var hdr = pane6.querySelector('.font-weight-bold.mb-3.mt-4');
      if(hdr) hdr.textContent = 'Billing Address';
    }
  })();

  // 6) Optional tag on step7 ("Special instructions")
  (function(){
    var pane7 = wizard.querySelector('.checkout-step[data-step="7"]');
    if(pane7){
      var th = pane7.querySelector('th');
      if(th){
        var opt2 = document.createElement('small');
        opt2.className = 'text-muted';
        opt2.style.marginLeft = '8px';
        opt2.textContent = '(optional)';
        th.appendChild(opt2);
      }
    }
  })();

  // 7) Prefill delivery address (step 5)
  if(!$('#ctl00_PageBody_DeliveryAddress_AddressLine1').val()){
    var $link=$('#ctl00_PageBody_CustomerAddressSelector_SelectAddressLinkButton');
    if($link.length){
      var $entries=$('.AddressSelectorEntry');
      if($entries.length){
        var $pick=$entries.first(), minId=parseInt($pick.find('.AddressId').text(),10);
        $entries.each(function(){
          var id=parseInt($(this).find('.AddressId').text(),10);
          if(id<minId){minId=id;$pick=$(this);}
        });
        var txt=$pick.find('dd p').first().text().trim(),
            parts=txt.split(',').map(s=>s.trim()),
            line1=parts[0]||'', city=parts[1]||'',
            state='', zip='';
        if(parts.length>=4){state=parts[parts.length-2]; zip=parts[parts.length-1];}
        else if(parts.length>2){
          var m=parts[2].match(/(.+?)\s*(\d{5}(?:-\d{4})?)?$/);
          if(m){state=m[1].trim(); zip=m[2]||'';}
        }
        $('#ctl00_PageBody_DeliveryAddress_AddressLine1').val(line1);
        $('#ctl00_PageBody_DeliveryAddress_City').val(city);
        $('#ctl00_PageBody_DeliveryAddress_Postcode').val(zip);
        $('#ctl00_PageBody_DeliveryAddress_CountrySelector').val('USA');
        $('#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList option').each(function(){
          if($(this).text().trim().toLowerCase()===state.toLowerCase()){
            $(this).prop('selected',true); return false;
          }
        });
      }
    }
  }

  // 8) AJAX fetch name/email & telephone
  $.get('https://webtrack.woodsonlumber.com/AccountSettings.aspx', function(data){
    var $acc=$(data),
        fn=$acc.find('#ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput').val()||'',
        ln=$acc.find('#ctl00_PageBody_ChangeUserDetailsControl_LastNameInput').val()||'',
        em=($acc.find('#ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput').val()||'').replace(/^\([^)]*\)\s*/,'');
    $('#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox').val(fn);
    $('#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox').val(ln);
    $('#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox').val(em);
  });
  $.get('https://webtrack.woodsonlumber.com/AccountInfo_R.aspx', function(data){
    var tel=$(data).find('#ctl00_PageBody_TelephoneLink_TelephoneLink').text().trim();
    $('#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox').val(tel);
  });

  // 9) Delivery summary/edit (step 5)
  (function(){
    var pane5=wizard.querySelector('.checkout-step[data-step="5"]');
    if(!pane5) return;
    var col=pane5.querySelector('.epi-form-col-single-checkout'),
        wrapper=document.createElement('div'),
        summary=document.createElement('div');
    wrapper.className='delivery-inputs';
    while(col.firstChild) wrapper.appendChild(col.firstChild);
    col.appendChild(wrapper);
    summary.className='delivery-summary';
    function refreshSummary(){
      var a1=wrapper.querySelector('#ctl00_PageBody_DeliveryAddress_AddressLine1').value||'',
          a2=wrapper.querySelector('#ctl00_PageBody_DeliveryAddress_AddressLine2').value||'',
          city=wrapper.querySelector('#ctl00_PageBody_DeliveryAddress_City').value||'',
          state=wrapper.querySelector('#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList')
                   .selectedOptions[0].text||'',
          zip=wrapper.querySelector('#ctl00_PageBody_DeliveryAddress_Postcode').value||'';
      summary.innerHTML=`
        <strong>Delivery Address</strong><br>
        ${a1}${a2?'<br>'+a2:''}<br>
        ${city}, ${state} ${zip}<br>
        <button id="editDelivery" class="btn btn-link">Edit</button>
      `;
    }
    wrapper.style.display='none';
    col.insertBefore(summary,wrapper);
    summary.addEventListener('click',function(e){
      if(e.target.id!=='editDelivery') return;
      summary.style.display='none'; wrapper.style.display='';
      wrapper.scrollIntoView({behavior:'smooth'});
      if(!wrapper.querySelector('#saveDelivery')){
        var btn=document.createElement('button');
        btn.id='saveDelivery'; btn.className='btn btn-primary mt-2'; btn.textContent='Save';
        wrapper.appendChild(btn);
        btn.addEventListener('click',function(){
          refreshSummary();
          wrapper.style.display='none';
          summary.style.display='';
          localStorage.currentStep=5;
        });
      }
    });
    refreshSummary();
  })();

  // 10) Billing-same checkbox + invoice summary/edit (step 6)
  (function(){
    var pane6=wizard.querySelector('.checkout-step[data-step="6"]');
    if(!pane6) return;
    var orig=document.getElementById('copyDeliveryAddressButton');
    if(orig) orig.style.display='none';
    var chkDiv=document.createElement('div');
    chkDiv.className='form-check mb-3';
    chkDiv.innerHTML=`
      <input class="form-check-input" type="checkbox" id="sameAsDeliveryCheck">
      <label class="form-check-label" for="sameAsDeliveryCheck">
        Billing address is the same as delivery address
      </label>`;
    pane6.insertBefore(chkDiv,pane6.firstChild);
    var sameCheck=chkDiv.querySelector('#sameAsDeliveryCheck');
    var colInv=pane6.querySelector('.epi-form-col-single-checkout'),
        wrapperInv=document.createElement('div'),
        summaryInv=document.createElement('div');
    wrapperInv.className='invoice-inputs';
    while(colInv.firstChild) wrapperInv.appendChild(colInv.firstChild);
    colInv.appendChild(wrapperInv);
    summaryInv.className='invoice-summary';
    function suppressPostback(el){ if(el) el.onchange=e=>e.stopImmediatePropagation(); }
    var invState=wrapperInv.querySelector('#ctl00_PageBody_InvoiceAddress_CountySelector_CountyList'),
        invCountry=wrapperInv.querySelector('#ctl00_PageBody_InvoiceAddress_CountrySelector1');
    suppressPostback(invState); suppressPostback(invCountry);
    function refreshInvoiceSummary(){
      var a1=wrapperInv.querySelector('#ctl00_PageBody_InvoiceAddress_AddressLine1').value||'',
          a2=wrapperInv.querySelector('#ctl00_PageBody_InvoiceAddress_AddressLine2').value||'',
          city=wrapperInv.querySelector('#ctl00_PageBody_InvoiceAddress_City').value||'',
          state=invState?invState.selectedOptions[0].text:'',
          zip=wrapperInv.querySelector('#ctl00_PageBody_InvoiceAddress_Postcode').value||'',
          email=wrapperInv.querySelector('#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox').value||'';
      summaryInv.innerHTML=`
        <strong>Billing Address</strong><br>
        ${a1}${a2?'<br>'+a2:''}<br>
        ${city}, ${state} ${zip}<br>
        Email: ${email}<br>
        <button id="editInvoice" class="btn btn-link">Enter new billing address</button>`;
    }
    wrapperInv.style.display='none'; summaryInv.style.display='none';
    colInv.insertBefore(summaryInv,wrapperInv);
    var same=localStorage.sameAsDelivery==='true';
    sameCheck.checked=same;
    if(same){
      setTimeout(function(){
        refreshInvoiceSummary();
        wrapperInv.style.display='none';
        summaryInv.style.display='';
      },50);
    } else {
      wrapperInv.style.display='';
      summaryInv.style.display='none';
    }
    sameCheck.addEventListener('change',function(){
      if(this.checked){
        localStorage.sameAsDelivery='true';
        __doPostBack('ctl00$PageBody$CopyDeliveryAddressLinkButton','');
      } else {
        localStorage.sameAsDelivery='false';
        summaryInv.style.display='none';
        wrapperInv.style.display='';
      }
    });
    summaryInv.addEventListener('click',function(e){
      if(e.target.id!=='editInvoice') return;
      summaryInv.style.display='none';
      wrapperInv.style.display='';
      wrapperInv.scrollIntoView({behavior:'smooth'});
    });
  })();

  // 11) Step switcher + persistence
  function showStep(n){
    wizard.querySelectorAll('.checkout-step').forEach(function(p){
      p.classList.toggle('active', +p.dataset.step===n);
    });
    nav.querySelectorAll('li').forEach(function(li){
      var s=+li.dataset.step;
      li.classList.toggle('active',    s===n);
      li.classList.toggle('completed', s< n);
    });
    localStorage.currentStep=n;
    window.scrollTo({ top: wizard.offsetTop, behavior: 'smooth' });
  }
  showStep(parseInt(localStorage.currentStep,10)||2);
});

