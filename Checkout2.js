
document.addEventListener('DOMContentLoaded', function() {
  // 1) Create wizard container & nav
  var container = document.querySelector('.container');
  var wizard    = document.createElement('div');
  wizard.className = 'checkout-wizard';
  container.insertBefore(wizard, container.firstChild);
  var nav = document.createElement('ul');
  nav.className = 'checkout-steps';
  wizard.appendChild(nav);

  // 2) Define the 7 steps (date/pickup moved to step 7)
  var steps = [
    { title:'Order details',      findEls:()=>{ var tx=document.getElementById('ctl00_PageBody_TransactionTypeDiv'); return tx?[tx.closest('.epi-form-col-single-checkout')]:[]; }},
    { title:'Shipping method',     findEls:()=>{ var ship=document.getElementById('ctl00_PageBody_SaleTypeSelector_lblDelivered'); return ship?[ship.closest('.epi-form-col-single-checkout')]:[]; }},
    { title:'Your reference',      findEls:()=>{ var po=document.getElementById('ctl00_PageBody_PurchaseOrderNumberTextBox'); return po?[po.closest('.epi-form-group-checkout')]:[]; }},
    { title:'Branch',              findEls:()=>{ var br=document.getElementById('ctl00_PageBody_BranchSelector'); return br?[br]:[]; }},
    { title:'Delivery address',    findEls:()=>{ var hdr=document.querySelector('.SelectableAddressType'); return hdr?[hdr.closest('.epi-form-col-single-checkout')]:[]; }},
    { title:'Billing address',     findEls:()=>{ var gp=document.getElementById('ctl00_PageBody_InvoiceAddress_GoogleAddressSearchWrapper'); return gp?[gp.closest('.epi-form-col-single-checkout')]:[]; }},
    { title:'Special instructions',findEls:()=>{
        var arr=[];
        // date picker wrapper
        var dateGrp = document.getElementById('ctl00_PageBody_dtRequired_DatePicker_wrapper');
        if(dateGrp) arr.push(dateGrp.closest('.epi-form-col-single-checkout'));
        // cart table
        var tbl = document.querySelector('.cartTable');
        if(tbl) arr.push(tbl.closest('table'));
        // special instructions input
        var si = document.getElementById('ctl00_PageBody_SpecialInstructionsTextBox');
        if(si){
          var wrap = si.closest('.epi-form-group-checkout')
                  || si.closest('.epi-form-col-single-checkout')
                  || si.parentElement;
          arr.push(wrap);
        }
        return arr;
    }}
  ];

  // 3) Build each step and its pane
  steps.forEach(function(step,i){
    var num=i+1;
    // nav bullet
    var li=document.createElement('li');
    li.dataset.step=num;
    li.textContent=step.title;
    li.addEventListener('click',()=>showStep(num));
    nav.appendChild(li);
    // pane
    var pane=document.createElement('div');
    pane.className='checkout-step';
    pane.dataset.step=num;
    wizard.appendChild(pane);
    // move elements
    step.findEls().forEach(el=>pane.appendChild(el));
    // nav buttons
    var navDiv=document.createElement('div');
    navDiv.className='checkout-nav';
    pane.appendChild(navDiv);
    if(num>1){
      var back=document.createElement('button');
      back.className='btn btn-secondary';
      back.textContent='Back';
      back.addEventListener('click',e=>{e.preventDefault();showStep(num-1);});
      navDiv.appendChild(back);
    }
    if(num<steps.length){
      var next=document.createElement('button');
      next.className='btn btn-primary';
      next.textContent='Next';
      next.addEventListener('click',e=>{e.preventDefault();showStep(num+1);});
      navDiv.appendChild(next);
    } else {
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

  // 4) Optional tag on step 3
  (function(){
    var p3=wizard.querySelector('[data-step="3"]');
    var lbl=p3&&p3.querySelector('label');
    if(lbl){
      var opt=document.createElement('small');
      opt.className='text-muted';
      opt.style.marginLeft='8px';
      opt.textContent='(optional)';
      lbl.appendChild(opt);
    }
  })();

  // 5) Change step 6 header to "Billing Address"
  (function(){
    var p6=wizard.querySelector('[data-step="6"]');
    var hdr=p6&&p6.querySelector('.font-weight-bold.mb-3.mt-4');
    if(hdr) hdr.textContent='Billing Address';
  })();

  // 6) Optional tag on step 7
  (function(){
    var p7=wizard.querySelector('[data-step="7"]');
    var th=p7&&p7.querySelector('th');
    if(th){
      var opt=document.createElement('small');
      opt.className='text-muted';
      opt.style.marginLeft='8px';
      opt.textContent='(optional)';
      th.appendChild(opt);
    }
  })();

  // 7) Prefill delivery address (step 5)
  if(!$('#ctl00_PageBody_DeliveryAddress_AddressLine1').val()){
    var $entries=$('.AddressSelectorEntry');
    if($entries.length){
      var $pick=$entries.first(), minId=parseInt($pick.find('.AddressId').text(),10);
      $entries.each(function(){
        var id=parseInt($(this).find('.AddressId').text(),10);
        if(id<minId){minId=id;$pick=$(this);}
      });
      var parts=$pick.find('dd p').first().text().trim().split(',').map(s=>s.trim());
      var line1=parts[0]||'', city=parts[1]||'', state='', zip='';
      if(parts.length>=4){state=parts[parts.length-2];zip=parts[parts.length-1];}
      else if(parts.length>2){
        var m=parts[2].match(/(.+?)\s*(\d{5}(?:-\d{4})?)?$/);
        if(m){state=m[1].trim();zip=m[2]||'';}
      }
      $('#ctl00_PageBody_DeliveryAddress_AddressLine1').val(line1);
      $('#ctl00_PageBody_DeliveryAddress_City').val(city);
      $('#ctl00_PageBody_DeliveryAddress_Postcode').val(zip);
      $('#ctl00_PageBody_DeliveryAddress_CountrySelector').val('USA');
      $('#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList option').each(function(){
        if($(this).text().trim().toLowerCase()===state.toLowerCase()){
          $(this).prop('selected',true);return false;
        }
      });
    }
  }

  // 8) AJAX for name/email/phone
  $.get('https://webtrack.woodsonlumber.com/AccountSettings.aspx',data=>{
    var $acc=$(data),
        fn=$acc.find('#ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput').val()||'',
        ln=$acc.find('#ctl00_PageBody_ChangeUserDetailsControl_LastNameInput').val()||'',
        em=($acc.find('#ctl00_PageBody_ChangeUserDetailsControl_EmailAddressInput').val()||'').replace(/^\([^)]*\)\s*/,'');
    $('#ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox').val(fn);
    $('#ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox').val(ln);
    $('#ctl00_PageBody_InvoiceAddress_EmailAddressTextBox').val(em);
  });
  $.get('https://webtrack.woodsonlumber.com/AccountInfo_R.aspx',data=>{
    var tel=$(data).find('#ctl00_PageBody_TelephoneLink_TelephoneLink').text().trim();
    $('#ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox').val(tel);
  });

  // 9) Step 5: delivery summary/edit
  (function(){
    var p5=wizard.querySelector('[data-step="5"]'),
        col=p5&&p5.querySelector('.epi-form-col-single-checkout');
    if(!col) return;
    var wrap=document.createElement('div'),
        sum =document.createElement('div');
    wrap.className='delivery-inputs';
    while(col.firstChild) wrap.appendChild(col.firstChild);
    col.appendChild(wrap);
    sum.className='delivery-summary';
    function upd(){
      var a1=wrap.querySelector('#ctl00_PageBody_DeliveryAddress_AddressLine1').value||'',
          a2=wrap.querySelector('#ctl00_PageBody_DeliveryAddress_AddressLine2').value||'',
          c =wrap.querySelector('#ctl00_PageBody_DeliveryAddress_City').value||'',
          s =wrap.querySelector('#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList').selectedOptions[0].text||'',
          z =wrap.querySelector('#ctl00_PageBody_DeliveryAddress_Postcode').value||'';
      sum.innerHTML=`<strong>Delivery Address</strong><br>${a1}${a2?'<br>'+a2:''}<br>${c}, ${s} ${z}<br>
        <button id="editDelivery" class="btn btn-link">Edit</button>`;
    }
    wrap.style.display='none';
    col.insertBefore(sum,wrap);
    sum.addEventListener('click',function(e){
      if(e.target.id!=='editDelivery')return;
      sum.style.display='none'; wrap.style.display='';
      wrap.scrollIntoView({behavior:'smooth'});
      if(!wrap.querySelector('#saveDelivery')){
        var btn=document.createElement('button');
        btn.id='saveDelivery';btn.className='btn btn-primary mt-2';btn.textContent='Save';
        wrap.appendChild(btn);
        btn.addEventListener('click',function(){
          upd(); wrap.style.display='none'; sum.style.display=''; localStorage.currentStep=5;
        });
      }
    });
    upd();
  })();

  // 10) Step 7: pickup vs delivery logic & special instructions
  (function(){
    var p7 = wizard.querySelector('[data-step="7"]');
    if(!p7) return;
    var specialIns = document.getElementById('ctl00_PageBody_SpecialInstructionsTextBox'),
        siWrap     = specialIns.closest('.epi-form-group-checkout')
                  || specialIns.closest('.form-group')
                  || specialIns.parentElement;

    // pickup container
    var pickupDiv = document.createElement('div');
    pickupDiv.className='form-group';
    pickupDiv.innerHTML=`
      <label for="pickupDate">Requested Pickup Date:</label>
      <input type="date" id="pickupDate" class="form-control">
      <label for="pickupPerson">Pickup Person:</label>
      <input type="text" id="pickupPerson" class="form-control">`;
    pickupDiv.style.display='none';

    // delivery container
    var deliveryDiv = document.createElement('div');
    deliveryDiv.className='form-group';
    deliveryDiv.innerHTML=`
      <label for="deliveryDate">Requested Delivery Date:</label>
      <input type="date" id="deliveryDate" class="form-control">
      <div>
        <label><input type="radio" name="deliveryTime" value="Morning"> Morning</label>
        <label><input type="radio" name="deliveryTime" value="Afternoon"> Afternoon</label>
      </div>`;
    deliveryDiv.style.display='none';

    // insert after special instructions container
    siWrap.insertAdjacentElement('afterend', pickupDiv);
    pickupDiv.insertAdjacentElement('afterend', deliveryDiv);

    var rbDel    = document.getElementById('ctl00_PageBody_SaleTypeSelector_rbDelivered'),
        rbPick   = document.getElementById('ctl00_PageBody_SaleTypeSelector_rbCollectLater'),
        zipInput = document.getElementById('ctl00_PageBody_DeliveryAddress_Postcode');

    function inZone(zip){
      return ['75','76','77','78','79'].includes((zip||'').substring(0,2));
    }
    function updateSpecial(){
      specialIns.value='';
      if(rbPick.checked){
        var d=pickupDiv.querySelector('#pickupDate').value,
            p=pickupDiv.querySelector('#pickupPerson').value;
        specialIns.value='Pickup on '+d+(p?' for '+p:'');
      } else if(rbDel.checked){
        var z=zipInput.value;
        if(inZone(z)){
          var d2=deliveryDiv.querySelector('#deliveryDate').value,
              t=deliveryDiv.querySelector('input[name="deliveryTime"]:checked');
          specialIns.value='Delivery on '+d2+(t?' ('+t.value+')':'');
        } else {
          specialIns.value='Ship via 3rd party delivery on next screen.';
        }
      }
    }
    function onShip7(){
      if(rbPick.checked){
        pickupDiv.style.display='block';
        deliveryDiv.style.display='none';
        specialIns.readOnly=false;
      } else if(rbDel.checked){
        pickupDiv.style.display='none';
        specialIns.readOnly=true;
        var z=zipInput.value;
        if(inZone(z)){
          deliveryDiv.style.display='block';
        } else {
          deliveryDiv.innerHTML='<em>Ship via 3rd party delivery on next screen.</em>';
          deliveryDiv.style.display='block';
        }
      } else {
        pickupDiv.style.display='none';
        deliveryDiv.style.display='none';
        specialIns.readOnly=false;
      }
      updateSpecial();
    }
    rbPick.addEventListener('change',onShip7);
    rbDel.addEventListener('change',onShip7);
    pickupDiv.querySelector('#pickupDate').addEventListener('change',updateSpecial);
    pickupDiv.querySelector('#pickupPerson').addEventListener('input',updateSpecial);
    deliveryDiv.querySelector('#deliveryDate').addEventListener('change',function(){
      var today=new Date(); today.setDate(today.getDate()+2);
      var sel=new Date(this.value);
      if(sel<today){ alert('Select at least 2 days out'); this.value=''; }
      else if(sel.getDay()===0){ alert('No Sunday deliveries'); this.value=''; }
      updateSpecial();
    });
    deliveryDiv.querySelectorAll('input[name="deliveryTime"]')
               .forEach(r=>r.addEventListener('change',updateSpecial));
    onShip7();
  })();

  // 11) Step switcher + persistence
  function showStep(n){
    wizard.querySelectorAll('.checkout-step')
      .forEach(p=>p.classList.toggle('active',+p.dataset.step===n));
    nav.querySelectorAll('li').forEach(li=>{
      var s=+li.dataset.step;
      li.classList.toggle('active',    s===n);
      li.classList.toggle('completed', s< n);
    });
    localStorage.currentStep=n;
    window.scrollTo({ top: wizard.offsetTop, behavior: 'smooth' });
  }
  showStep(parseInt(localStorage.currentStep,10)||2);

});

