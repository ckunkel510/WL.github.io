document.addEventListener('DOMContentLoaded', function() {
  // 1) Wizard container & nav
  var container = document.querySelector('.container');
  var wizard    = document.createElement('div');
  wizard.className = 'checkout-wizard';
  container.insertBefore(wizard, container.firstChild);
  var nav = document.createElement('ul');
  nav.className = 'checkout-steps';
  wizard.appendChild(nav);

  // 2) Define the 7 steps (moved date into step7)
  var steps = [
    { title:'Order details',      findEls:()=>{ var tx=document.getElementById('ctl00_PageBody_TransactionTypeDiv'); return tx?[tx.closest('.epi-form-col-single-checkout')]:[]; }},
    { title:'Shipping method',     findEls:()=>{ var ship=document.getElementById('ctl00_PageBody_SaleTypeSelector_lblDelivered'); return ship?[ship.closest('.epi-form-col-single-checkout')]:[]; }},
    { title:'Your reference',      findEls:()=>{ var po=document.getElementById('ctl00_PageBody_PurchaseOrderNumberTextBox'); return po?[po.closest('.epi-form-group-checkout')]:[]; }},
    { title:'Branch',              findEls:()=>{ var br=document.getElementById('ctl00_PageBody_BranchSelector'); return br?[br]:[]; }},
    { title:'Delivery address',    findEls:()=>{ var hdr=document.querySelector('.SelectableAddressType'); return hdr?[hdr.closest('.epi-form-col-single-checkout')]:[]; }},
    { title:'Billing address',     findEls:()=>{ var gp=document.getElementById('ctl00_PageBody_InvoiceAddress_GoogleAddressSearchWrapper'); return gp?[gp.closest('.epi-form-col-single-checkout')]:[]; }},
    { title:'Special instructions',findEls:()=>{
        var arr=[];
        // move date here
        var dateGrp = document.getElementById('ctl00_PageBody_dtRequired_DatePicker_wrapper');
        if(dateGrp) arr.push(dateGrp.closest('.epi-form-col-single-checkout'));
        var tbl = document.querySelector('.cartTable');
        if(tbl) arr.push(tbl.closest('.cartTable'));
        return arr;
    }}
  ];

  // 3) Build steps & panes
  steps.forEach(function(step,i){
    var num = i+1;
    var li = document.createElement('li');
    li.dataset.step = num;
    li.textContent  = step.title;
    li.addEventListener('click',()=>showStep(num));
    nav.appendChild(li);

    var pane = document.createElement('div');
    pane.className  = 'checkout-step';
    pane.dataset.step = num;
    wizard.appendChild(pane);

    step.findEls().forEach(el=>pane.appendChild(el));

    var navDiv = document.createElement('div');
    navDiv.className = 'checkout-nav';
    pane.appendChild(navDiv);

    if(num>1){
      var back=document.createElement('button');
      back.className='btn btn-secondary';
      back.textContent='Back';
      back.onclick=e=>{e.preventDefault(); showStep(num-1);};
      navDiv.appendChild(back);
    }
    if(num<steps.length){
      var next=document.createElement('button');
      next.className='btn btn-primary';
      next.textContent='Next';
      next.onclick=e=>{e.preventDefault(); showStep(num+1);};
      navDiv.appendChild(next);
    } else {
      var conts=Array.from(document.querySelectorAll(
        '#ctl00_PageBody_ContinueButton1,#ctl00_PageBody_ContinueButton2'
      ));
      if(conts.length){
        var cont=conts.pop(); cont.style.display=''; navDiv.appendChild(cont);
      }
    }
  });

  // 4) Optional tags and header tweaks (steps 3,6,7)
  (function(){
    // step3 optional
    var p3=wizard.querySelector('[data-step="3"]'), l3=p3&&p3.querySelector('label');
    if(l3){ var o=document.createElement('small'); o.className='text-muted'; o.style.marginLeft='8px'; o.textContent='(optional)'; l3.appendChild(o); }
    // step6 header
    var p6=wizard.querySelector('[data-step="6"]'), h6=p6&&p6.querySelector('.font-weight-bold.mb-3.mt-4');
    if(h6) h6.textContent='Billing Address';
    // step7 optional
    var p7=wizard.querySelector('[data-step="7"]'), th7=p7&&p7.querySelector('th');
    if(th7){ var o2=document.createElement('small'); o2.className='text-muted'; o2.style.marginLeft='8px'; o2.textContent='(optional)'; th7.appendChild(o2); }
  })();

  // 5) Prefill delivery (step5)
  if(!$('#ctl00_PageBody_DeliveryAddress_AddressLine1').val()){
    var $entries=$('.AddressSelectorEntry'),$pick, minId;
    if($entries.length){
      $pick=$entries.first(); minId=parseInt($pick.find('.AddressId').text(),10);
      $entries.each(function(){ var id=parseInt($(this).find('.AddressId').text(),10); if(id<minId){minId=id;$pick=$(this);} });
      var parts=$pick.find('dd p').first().text().trim().split(',').map(s=>s.trim()),
          line1=parts[0]||'', city=parts[1]||'', state='', zip='';
      if(parts.length>=4){state=parts[parts.length-2];zip=parts[parts.length-1];}
      else if(parts.length>2){var m=parts[2].match(/(.+?)\s*(\d{5}(?:-\d{4})?)?$/); if(m){state=m[1].trim();zip=m[2]||'';}}
      $('#ctl00_PageBody_DeliveryAddress_AddressLine1').val(line1);
      $('#ctl00_PageBody_DeliveryAddress_City').val(city);
      $('#ctl00_PageBody_DeliveryAddress_Postcode').val(zip);
      $('#ctl00_PageBody_DeliveryAddress_CountrySelector').val('USA');
      $('#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList option').each(function(){
        if($(this).text().trim().toLowerCase()===state.toLowerCase()){ $(this).prop('selected',true); return false;}
      });
    }
  }

  // 6) AJAX for name/email/phone
  $.get('https://webtrack.woodsonlumber.com/AccountSettings.aspx',data=>{
    var $acc=$(data),fn=$acc.find('#ctl00_PageBody_ChangeUserDetailsControl_FirstNameInput').val()||'',
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

  // 7) Step5: delivery summary/edit
  (function(){
    var p5=wizard.querySelector('[data-step="5"]'),col=p5&&p5.querySelector('.epi-form-col-single-checkout');
    if(!col) return;
    var wrap=document.createElement('div'),sum=document.createElement('div');
    wrap.className='delivery-inputs'; while(col.firstChild) wrap.appendChild(col.firstChild);
    col.appendChild(wrap); sum.className='delivery-summary';
    function upd(){ var a1=wrap.querySelector('#ctl00_PageBody_DeliveryAddress_AddressLine1').value||'',
        a2=wrap.querySelector('#ctl00_PageBody_DeliveryAddress_AddressLine2').value||'',
        city=wrap.querySelector('#ctl00_PageBody_DeliveryAddress_City').value||'',
        st=wrap.querySelector('#ctl00_PageBody_DeliveryAddress_CountySelector_CountyList').selectedOptions[0].text||'',
        zip=wrap.querySelector('#ctl00_PageBody_DeliveryAddress_Postcode').value||'';
      sum.innerHTML=`<strong>Delivery Address</strong><br>${a1}${a2?'<br>'+a2:''}<br>${city}, ${st} ${zip}<br><button id="editDelivery" class="btn btn-link">Edit</button>`;}
    wrap.style.display='none'; col.insertBefore(sum,wrap);
    sum.addEventListener('click',e=>{ if(e.target.id!=='editDelivery')return; sum.style.display='none'; wrap.style.display=''; wrap.scrollIntoView({behavior:'smooth'}); if(!wrap.querySelector('#saveDelivery')){ var btn=document.createElement('button'); btn.id='saveDelivery'; btn.className='btn btn-primary mt-2'; btn.textContent='Save'; wrap.appendChild(btn); btn.addEventListener('click',()=>{ upd(); wrap.style.display='none'; sum.style.display=''; localStorage.currentStep=5; }); } });
    upd();
  })();

  // 8) Step6 shipping vs pickup dynamic
  (function(){
    var p2=wizard.querySelector('[data-step="2"]');
    var p7=wizard.querySelector('[data-step="7"]');
    if(!p2||!p7) return;
    // clone date-group for pickup
    var dateGrp=document.getElementById('ctl00_PageBody_dtRequired_DatePicker_wrapper')
                    .closest('.epi-form-col-single-checkout');
    var pickDateGrp=dateGrp.cloneNode(true);
    pickDateGrp.querySelector('label').textContent='Requested Pickup Date:';
    pickDateGrp.style.display='none';
    p2.appendChild(pickDateGrp);
    // pickup person input
    var ppDiv=document.createElement('div');
    ppDiv.className='epi-form-group-checkout';
    ppDiv.innerHTML=`<div><label for="pickupPerson">Pickup Person:</label></div>
      <div><input type="text" id="pickupPerson" class="form-control"></div>`;
    ppDiv.style.display='none';
    p2.appendChild(ppDiv);

    var rbDel=document.getElementById('ctl00_PageBody_SaleTypeSelector_rbDelivered'),
        rbPick=document.getElementById('ctl00_PageBody_SaleTypeSelector_rbCollectLater');

    function onShipChange(){
      if(rbPick.checked){
        pickDateGrp.style.display='';
        ppDiv.style.display='';
      } else {
        pickDateGrp.style.display='none';
        ppDiv.style.display='none';
      }
    }
    rbDel.addEventListener('change',onShipChange);
    rbPick.addEventListener('change',onShipChange);
    onShipChange();
  })();

  // 9) Step7: special instructions + delivered date logic
  (function(){
    var p7=wizard.querySelector('[data-step="7"]');
    if(!p7) return;
    // delivered-date container
    var ddDiv=document.createElement('div');
    ddDiv.className='form-group';
    ddDiv.innerHTML = '<label for="deliveryDate">Requested Delivery Date:</label><input type="date" id="deliveryDate" class="form-control"><div><label><input type="radio" name="deliveryTime" value="Morning"> Morning</label> <label><input type="radio" name="deliveryTime" value="Afternoon"> Afternoon</label></div>';
    ddDiv.style.display='none';
    p7.insertBefore(ddDiv, p7.querySelector('.cartTable'));

    var same=localStorage.sameAsDelivery==='true',
        zipInput=document.getElementById('ctl00_PageBody_DeliveryAddress_Postcode'),
        specialIns=document.getElementById('ctl00_PageBody_SpecialInstructionsTextBox');

    function inZone(zip){
      // crude Texas Triangle prefixes
      return ['75','76','77','78','79'].includes(zip.substring(0,2));
    }
    function onShipStep7(){
      var rbDel=document.getElementById('ctl00_PageBody_SaleTypeSelector_rbDelivered');
      if(rbDel.checked){
        var zip=zipInput.value||'';
        if(inZone(zip)){
          ddDiv.style.display='';
          specialIns.readOnly=true;
          ddDiv.querySelector('#deliveryDate').min = (function(){
            var d=new Date(); d.setDate(d.getDate()+2);
            var m=('0'+(d.getMonth()+1)).slice(-2), day=('0'+d.getDate()).slice(-2);
            return d.getFullYear()+'-'+m+'-'+day;
          })();
          // prevent Sundays
          ddDiv.querySelector('#deliveryDate').addEventListener('change',function(){
            var d=new Date(this.value);
            if(d.getDay()===0){ alert('No Sunday deliveries'); this.value=''; }
          });
          // update special instructions locked
          ddDiv.addEventListener('change',updateSpec);
        } else {
          ddDiv.innerHTML='<em>Ship via 3rd party delivery selected on next screen.</em>';
          ddDiv.style.display='';
          specialIns.readOnly=true;
        }
      } else {
        ddDiv.style.display='none';
        specialIns.readOnly=false;
      }
    }
    function updateSpec(){
      var date=ddDiv.querySelector('#deliveryDate').value,
          time=ddDiv.querySelector('input[name="deliveryTime"]:checked');
      specialIns.value='Delivery '+(date||'')+' '+(time?time.value:'')+'\n'+specialIns.value;
    }

    // watch shipping radios
    document.getElementById('ctl00_PageBody_SaleTypeSelector_rbDelivered').addEventListener('change',onShipStep7);
    document.getElementById('ctl00_PageBody_SaleTypeSelector_rbCollectLater').addEventListener('change',onShipStep7);
    // on load step7
    onShipStep7();
  })();

  // 10) Step switcher + persistence
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

