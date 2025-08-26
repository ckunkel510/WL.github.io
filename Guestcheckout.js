
(function(){
  'use strict';

  if (!/ShoppingCart\.aspx/i.test(location.pathname)) return;

  /* =========================
     CONFIG / HELPERS
  ========================== */
  const LOG = (...a)=>console.log('[GuestCheckout]', ...a);
  const ERR = (...a)=>console.error('[GuestCheckout]', ...a);

  // Page endpoints (adjust if your paths differ)
  const SIGNUP_PATH = location.origin + '/UserSignup.aspx';

  // Map state abbrev -> long name for the Step 6 billing dropdown
  const STATE_LONG = {
    AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas', CA:'California',
    CO:'Colorado', CT:'Connecticut', DC:'District of Columbia', DE:'Delaware',
    FL:'Florida', GA:'Georgia', HI:'Hawaii', IA:'Iowa', ID:'Idaho',
    IL:'Illinois', IN:'Indiana', KS:'Kansas', KY:'Kentucky', LA:'Louisiana',
    MA:'Massachusetts', MD:'Maryland', ME:'Maine', MI:'Michigan',
    MN:'Minnesota', MO:'Missouri', MS:'Mississippi', MT:'Montana',
    NC:'North Carolina', ND:'North Dakota', NE:'Nebraska', NH:'New Hampshire',
    NJ:'New Jersey', NM:'New Mexico', NV:'Nevada', NY:'New York',
    OH:'Ohio', OK:'Oklahoma', OR:'Oregon', PA:'Pennsylvania', RI:'Rhode Island',
    SC:'South Carolina', SD:'South Dakota', TN:'Tennessee', TX:'Texas',
    UT:'Utah', VA:'Virginia', VT:'Vermont', WA:'Washington', WI:'Wisconsin',
    WV:'West Virginia', WY:'Wyoming', AB:'Alberta', BC:'British Columbia',
    MB:'Manitoba', NB:'New Brunswick', NL:'Newfoundland and Labrador',
    NS:'Nova Scotia', NT:'Northwest Territories', NU:'Nunavut', ON:'Ontario',
    PE:'Prince Edward Island', QC:'Quebec', SK:'Saskatchewan', YT:'Yukon Territory'
  };

  // Always use random 16-char temp password (A–Z, 0–9)
  function randTempPassword(len=16){
    const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let s=''; for (let i=0;i<len;i++) s += chars[Math.floor(Math.random()*chars.length)];
    return s;
  }

  function el(q,root=document){ return root.querySelector(q); }
  function setVal(node, val){
    if (!node) return;
    if (node.tagName === 'SELECT'){
      const optByText = Array.from(node.options).find(o => (o.text||'').trim().toLowerCase() === String(val||'').trim().toLowerCase());
      if (optByText) { node.value = optByText.value; node.dispatchEvent(new Event('change', {bubbles:true})); return; }
      const optByVal = Array.from(node.options).find(o => String(o.value).trim().toLowerCase() === String(val||'').trim().toLowerCase());
      if (optByVal) { node.value = optByVal.value; node.dispatchEvent(new Event('change', {bubbles:true})); return; }
    } else {
      node.value = val;
      node.dispatchEvent(new Event('input', {bubbles:true}));
      node.dispatchEvent(new Event('change', {bubbles:true}));
    }
  }

  // Persist the guest data so we can reuse on the Step 6 fill
  const KEY='wl_guest_checkout_payload';
  function saveGuest(p){ try{ sessionStorage.setItem(KEY, JSON.stringify(p)); }catch(e){} }
  function loadGuest(){ try{ return JSON.parse(sessionStorage.getItem(KEY)||'{}'); }catch(e){ return {}; } }

  /* =========================
     STYLES (modal + below-proceed container)
  ========================== */
  function injectStyles(){
    if (document.getElementById('gc_modal_styles')) return;
    const css = `
      .gc-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;z-index:9998;}
      .gc-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:9999;}
      .gc-card{background:#fff;border-radius:16px;max-width:720px;width:92vw;box-shadow:0 8px 30px rgba(0,0,0,.2);padding:20px;}
      .gc-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
      .gc-row-1{display:grid;grid-template-columns:1fr;gap:12px;}
      .gc-head{font-size:20px;font-weight:700;margin-bottom:8px;color:#222;}
      .gc-sub{font-size:13px;color:#555;margin-bottom:16px;}
      .gc-field label{font-size:12px;color:#333;margin-bottom:4px;display:block;}
      .gc-field input, .gc-field select{width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;}
      .gc-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;}
      .gc-btn{padding:10px 14px;border-radius:10px;border:1px solid #ddd;background:#f6f6f6;cursor:pointer}
      .gc-btn.primary{background:#6b0016;color:#fff;border-color:#6b0016}
      .gc-check{display:flex;align-items:center;gap:8px;margin:8px 0 4px}
      .gc-hidden{display:none;}
      .gc-note{font-size:12px;color:#666;margin-top:6px;}
      @media (max-width:640px){ .gc-row{grid-template-columns:1fr;} }

      /* Placement container below Proceed */
      #gc_below_proceed{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;}
      #gc_below_proceed .epi-button{display:inline-block;}
    `;
    const style = document.createElement('style');
    style.id = 'gc_modal_styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* =========================
     MODAL BUILD
  ========================== */
  function buildModal(){
    if (document.getElementById('gc_modal')) return;

    const backdrop = document.createElement('div');
    backdrop.className = 'gc-modal-backdrop'; backdrop.id = 'gc_backdrop';

    const modal = document.createElement('div');
    modal.className = 'gc-modal'; modal.id = 'gc_modal';
    modal.innerHTML = `
      <div class="gc-card" role="dialog" aria-modal="true" aria-labelledby="gc_title">
        <div class="gc-head" id="gc_title">Checkout as Guest</div>
        <div class="gc-sub">We’ll create a quick account to move you through checkout. You can set a new password later.</div>

        <div class="gc-row">
          <div class="gc-field">
            <label>Email</label>
            <input id="gc_email" type="email" autocomplete="email" required>
          </div>
          <div class="gc-field">
            <label>Phone</label>
            <input id="gc_phone" type="tel" autocomplete="tel" required placeholder="(###) ###-####">
          </div>
        </div>

        <div class="gc-row">
          <div class="gc-field">
            <label>First name</label>
            <input id="gc_fname" type="text" autocomplete="given-name" required>
          </div>
          <div class="gc-field">
            <label>Last name</label>
            <input id="gc_lname" type="text" autocomplete="family-name" required>
          </div>
        </div>

        <div class="gc-head" style="margin-top:8px;">Delivery Address</div>
        <div class="gc-row">
          <div class="gc-field">
            <label>Street</label>
            <input id="gc_del_addr1" type="text" autocomplete="address-line1" required>
          </div>
          <div class="gc-field">
            <label>City</label>
            <input id="gc_del_city" type="text" autocomplete="address-level2" required>
          </div>
        </div>

        <div class="gc-row">
          <div class="gc-field">
            <label>State (2-letter)</label>
            <input id="gc_del_state" type="text" maxlength="2" placeholder="TX" autocomplete="address-level1" required>
          </div>
          <div class="gc-field">
            <label>ZIP</label>
            <input id="gc_del_zip" type="text" autocomplete="postal-code" required>
          </div>
        </div>

        <div class="gc-check">
          <input type="checkbox" id="gc_bill_same" checked>
          <label for="gc_bill_same">Billing same as delivery</label>
        </div>

        <div id="gc_bill_block" class="gc-hidden">
          <div class="gc-head" style="margin-top:8px;">Billing Address</div>
          <div class="gc-row">
            <div class="gc-field">
              <label>Street</label>
              <input id="gc_inv_addr1" type="text" autocomplete="address-line1">
            </div>
            <div class="gc-field">
              <label>City</label>
              <input id="gc_inv_city" type="text" autocomplete="address-level2">
            </div>
          </div>
          <div class="gc-row">
            <div class="gc-field">
              <label>State (2-letter)</label>
              <input id="gc_inv_state" type="text" maxlength="2" placeholder="TX" autocomplete="address-level1">
            </div>
            <div class="gc-field">
              <label>ZIP</label>
              <input id="gc_inv_zip" type="text" autocomplete="postal-code">
            </div>
          </div>
        </div>

        <div class="gc-note">Tip: To reduce browser password prompts, we create your account in the background.</div>

        <div class="gc-actions">
          <button class="gc-btn" id="gc_cancel">Cancel</button>
          <button class="gc-btn primary" id="gc_submit">Continue</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);

    // Toggle billing block
    el('#gc_bill_same').addEventListener('change', (e)=>{
      el('#gc_bill_block').classList.toggle('gc-hidden', e.target.checked);
    });

    // Close handlers
    function close(){ backdrop.style.display='none'; modal.style.display='none'; }
    el('#gc_cancel').addEventListener('click', close);
    backdrop.addEventListener('click', close);

    // Submit
    el('#gc_submit').addEventListener('click', onSubmitGuest);
  }

  /* =========================
     ROBUST PLACEMENT (retry + observer)
  ========================== */
  function getProceedBtn(){ return document.getElementById('ctl00_PageBody_PlaceOrderButton'); }
  function getSignInCell(){ return document.getElementById('ctl00_PageBody_OptionalSigninButton'); }

  function getOrCreateGuestBtn(){
    let btn = document.getElementById('gc_guest_btn');
    if (!btn){
      btn = document.createElement('a');
      btn.id = 'gc_guest_btn';
      btn.className = 'epi-button';
      btn.href = 'javascript:void(0)';
      btn.innerHTML = '<span>Checkout as Guest</span>';
      btn.addEventListener('click', ()=>{
        el('#gc_backdrop').style.display='block';
        el('#gc_modal').style.display='flex';
      });
    }
    return btn;
  }

  function getOrCreateBelowContainer(proceedBtn){
    let cont = document.getElementById('gc_below_proceed');
    if (!cont){
      cont = document.createElement('div');
      cont.id = 'gc_below_proceed';
    }
    // Ensure it's directly after Proceed button (even if Proceed moves)
    if (proceedBtn && proceedBtn.nextSibling !== cont){
      proceedBtn.insertAdjacentElement('afterend', cont);
    }
    return cont;
  }

  function getOrCreateSignInClone(){
    let clone = document.getElementById('gc_signin_btn');
    const td = getSignInCell();
    const origA = td ? td.querySelector('a[href*="Signin.aspx"]') : null;
    if (origA){
      // Hide original TD to avoid layout issues
      td.style.display = 'none';
      if (!clone){
        clone = origA.cloneNode(true);
        clone.id = 'gc_signin_btn';
        // keep .epi-button class; already present on orig
      }
    }
    return clone; // may be null if none exists
  }

  function placeAdjacentUI(){
    const proceed = getProceedBtn();
    if (!proceed) return false;

    const cont = getOrCreateBelowContainer(proceed);
    const guest = getOrCreateGuestBtn();
    const signinClone = getOrCreateSignInClone();

    // Ensure container exists immediately after Proceed
    if (cont.parentNode !== proceed.parentNode){
      proceed.parentNode.insertBefore(cont, proceed.nextSibling);
    }

    // Place buttons inside container (order: Guest, then Sign In)
    if (!guest.parentNode || guest.parentNode.id !== 'gc_below_proceed'){
      cont.appendChild(guest);
    }
    if (signinClone){
      if (!signinClone.parentNode || signinClone.parentNode.id !== 'gc_below_proceed'){
        cont.appendChild(signinClone);
      }
    }

    return true;
  }

  function startPlacementWatcher(){
    // Initial tries (covers scripts that move things shortly after load)
    const tries = [0, 150, 400, 800, 1600, 3200];
    tries.forEach(t=> setTimeout(placeAdjacentUI, t));

    // Observe DOM mutations and debounce reposition
    let debounce;
    const obs = new MutationObserver(()=>{
      clearTimeout(debounce);
      debounce = setTimeout(placeAdjacentUI, 120);
    });
    obs.observe(document.body, {childList:true, subtree:true});

    // Also try on resize (some scripts relocate on breakpoints)
    window.addEventListener('resize', ()=> {
      clearTimeout(debounce);
      debounce = setTimeout(placeAdjacentUI, 120);
    });
  }

  /* =========================
     GUEST SUBMIT HANDLER
  ========================== */
  async function onSubmitGuest(){
    // Gather fields
    const email = el('#gc_email').value.trim();
    const phoneRaw = el('#gc_phone').value.trim();
    const phone = phoneRaw.replace(/[^\d]/g,'');
    const fname = el('#gc_fname').value.trim();
    const lname = el('#gc_lname').value.trim();

    const d_addr1 = el('#gc_del_addr1').value.trim();
    const d_city  = el('#gc_del_city').value.trim();
    const d_state = el('#gc_del_state').value.trim().toUpperCase();
    const d_zip   = el('#gc_del_zip').value.trim();

    const billSame = el('#gc_bill_same').checked;

    const i_addr1 = billSame ? d_addr1 : (el('#gc_inv_addr1').value.trim());
    const i_city  = billSame ? d_city  : (el('#gc_inv_city').value.trim());
    const i_state2 = billSame ? d_state : (el('#gc_inv_state').value.trim().toUpperCase());
    const i_zip   = billSame ? d_zip   : (el('#gc_inv_zip').value.trim());

    // Minimal validation
    if (!email || !phone || !fname || !lname || !d_addr1 || !d_city || !d_state || !d_zip){
      alert('Please complete all required fields.');
      return;
    }
    if (!billSame && (!i_addr1 || !i_city || !i_state2 || !i_zip)){
      alert('Please complete billing address fields or check “Billing same as delivery.”');
      return;
    }

    const contactName = `${fname} ${lname}`.trim();
    const password = randTempPassword(16); // randomized temp password

    // Persist for step-6 autofill
    const payload = {
      email, phone, fname, lname, contactName,
      d_addr1, d_city, d_state, d_zip,
      billSame,
      i_addr1, i_city, i_state2, i_zip,
      password
    };
    saveGuest(payload);
    LOG('Saved guest payload to sessionStorage', {...payload, password:'[hidden]'}); // don’t log password

    // Kick off background signup in hidden iframe
    try{
      await createAccountInBackground(payload);
      // If account creation succeeded (or we had to bounce to reset), continue checkout
      continueCheckoutAndHookBilling();
    }catch(e){
      ERR('Account creation error:', e);
      alert('We had trouble creating your guest account. If this email already exists, we’ll take you to reset your password.');
    }finally{
      // Close modal
      el('#gc_backdrop').style.display='none';
      el('#gc_modal').style.display='none';
    }
  }

  /* =========================
     BACKGROUND SIGNUP (iframe)
  ========================== */
  function createAccountInBackground(p){
    return new Promise((resolve, reject)=>{
      // Create hidden iframe
      let frame = document.getElementById('gc_signup_iframe');
      if (!frame){
        frame = document.createElement('iframe');
        frame.id = 'gc_signup_iframe';
        frame.style.position='fixed';
        frame.style.width='1px';
        frame.style.height='1px';
        frame.style.left='-9999px';
        frame.style.top='-9999px';
        frame.setAttribute('aria-hidden','true');
        document.body.appendChild(frame);
      }

      const cleanup = ()=> { /* keep iframe for chained postbacks if needed */ };

      frame.onload = async ()=>{
        try{
          const win = frame.contentWindow;
          const doc = frame.contentDocument || win.document;
          if (!doc) throw new Error('No iframe document');

          // Detect password-reset/exists redirect by common phrases
          const bodyText = (doc.body && doc.body.innerText || '').toLowerCase();
          if (bodyText.includes('reset password') || bodyText.includes('forgot password')){
            LOG('Existing account detected; redirecting parent to reset page.');
            top.location.href = win.location.href;
            cleanup(); resolve(); return;
          }

          // Ensure we are on UserSignup.aspx; if not, navigate first
          if (!/UserSignup\.aspx/i.test(win.location.pathname)){
            LOG('Navigating iframe to UserSignup.aspx…');
            win.location.href = SIGNUP_PATH;
            return; // wait for next onload
          }

          const $ = (id)=> doc.getElementById(id);

          // On signup: fill email into both username + email fields
          const Email1 = $('ctl00_PageBody_UserNameTextBox');
          const Email2 = $('ctl00_PageBody_EmailAddressTextBox');
          const Pass1  = $('ctl00_PageBody_Password1TextBox');
          const Pass2  = $('ctl00_PageBody_Password2TextBox');
          const Phone  = $('ctl00_PageBody_ContactTelephoneTextBox');

          const FName  = $('ctl00_PageBody_FirstNameTextBox');
          const LName  = $('ctl00_PageBody_LastNameTextBox');
          const CName  = $('ctl00_PageBody_ContactNameTextBox');

          const DAddr1 = $('ctl00_PageBody_DeliveryAddressLine1TextBox');
          const DCity  = $('ctl00_PageBody_DeliveryCityTextBox');
          const DState = $('ctl00_PageBody_DeliveryStateCountyTextBox') || $('ctl00_PageBody_DeliveryStateTextBox') || $('ctl00_PageBody_DeliveryState');
          const DZip   = $('ctl00_PageBody_DeliveryPostalCodeTextBox');

          const IAddr1 = $('ctl00_PageBody_InvoiceAddressLine1TextBox');
          const ICity  = $('ctl00_PageBody_InvoiceCityTextBox');
          const IState = $('ctl00_PageBody_InvoiceStateCountyTextBox');
          const IZip   = $('ctl00_PageBody_InvoicePostalCodeTextBox');

          if (!Email1 || !Email2 || !Pass1 || !Pass2 || !Phone){
            // Not ready yet; wait and retry once
            setTimeout(()=>frame.onload(), 250);
            return;
          }

          // Reduce password manager prompts
          [Pass1, Pass2].forEach(inp=>{
            try{
              inp.autocomplete = 'off';
              inp.setAttribute('aria-hidden','true');
            }catch(_){}
          });

          // Fill fields
          setVal(Email1, p.email);
          setVal(Email2, p.email);
          setVal(Pass1,  p.password);
          setVal(Pass2,  p.password);
          setVal(Phone,  p.phone);

          setVal(FName,  p.fname);
          setVal(LName,  p.lname);
          setVal(CName,  p.contactName);

          setVal(DAddr1, p.d_addr1);
          setVal(DCity,  p.d_city);
          if (DState) setVal(DState, p.d_state);
          setVal(DZip,  p.d_zip);

          setVal(IAddr1, p.i_addr1);
          setVal(ICity,  p.i_city);
          if (IState) setVal(IState, p.i_state2);
          setVal(IZip,   p.i_zip);

          // Enable and click the Sign Up postback
          const btn = $('ctl00_PageBody_SignupButton');
          if (!btn) throw new Error('Signup button not found.');

          btn.classList.remove('disabled');
          btn.removeAttribute('aria-disabled');
          btn.style.pointerEvents = 'auto';
          btn.style.opacity = '1';

          // Trigger the postback the anchor already has in its href
          try { win.eval(btn.getAttribute('href').replace('javascript:','')); }
          catch { btn.click(); }

          // Allow time for the postback/redirect
          setTimeout(()=>{
            LOG('Signup postback dispatched; continuing…');
            cleanup(); resolve();
          }, 2500);

        }catch(e){
          cleanup(); reject(e);
        }
      };

      // Initial navigate to signup
      frame.src = SIGNUP_PATH;
    });
  }

  /* =========================
     CONTINUE CHECKOUT + STEP 6 BILLING HOOK
  ========================== */
  function continueCheckoutAndHookBilling(){
    // Click "Proceed to checkout" on the cart page
    const proceedBtn = document.getElementById('ctl00_PageBody_PlaceOrderButton');
    if (proceedBtn){
      LOG('Clicking Proceed to checkout…');
      try {
        eval(proceedBtn.getAttribute('href').replace('javascript:',''));
      } catch {
        proceedBtn.click();
      }
    }

    // Install a MutationObserver to catch when Step 6 (billing) appears
    installBillingObserver();
  }

  function installBillingObserver(){
    const target = document.body;
    const obs = new MutationObserver(()=>{
      const line1 = document.getElementById('ctl00_PageBody_InvoiceAddress_AddressLine1');
      const zip   = document.getElementById('ctl00_PageBody_InvoiceAddress_Postcode');
      const stateSel = document.getElementById('ctl00_PageBody_InvoiceAddress_CountySelector_CountyList');
      const sameChk  = document.getElementById('sameAsDeliveryCheck');
      if (line1 && zip && stateSel && sameChk){
        LOG('Detected Step 6 billing form — applying guest autofill logic.');
        try { applyBillingAutofill(); } catch(e){ ERR('Billing autofill error:', e); }
        obs.disconnect();
      }
    });
    obs.observe(target, { childList:true, subtree:true });
  }

  function applyBillingAutofill(){
    const p = loadGuest();
    if (!p || !p.email) { LOG('No guest payload found; skipping billing autofill'); return; }

    const sameChk  = document.getElementById('sameAsDeliveryCheck');
    const line1    = document.getElementById('ctl00_PageBody_InvoiceAddress_AddressLine1');
    const city     = document.getElementById('ctl00_PageBody_InvoiceAddress_City');
    const stateSel = document.getElementById('ctl00_PageBody_InvoiceAddress_CountySelector_CountyList');
    const zip      = document.getElementById('ctl00_PageBody_InvoiceAddress_Postcode');
    const country  = document.getElementById('ctl00_PageBody_InvoiceAddress_CountrySelector1');
    const email    = document.getElementById('ctl00_PageBody_InvoiceAddress_EmailAddressTextBox');

    // Always uncheck then re-apply (to trigger any internal site scripts)
    if (sameChk){
      sameChk.checked = false;
      sameChk.dispatchEvent(new Event('change', {bubbles:true}));
    }

    if (p.billSame){
      sameChk.checked = true;
      sameChk.dispatchEvent(new Event('change', {bubbles:true}));
    } else {
      const useStateName = STATE_LONG[p.i_state2] || p.i_state2;
      setVal(line1, p.i_addr1 || p.d_addr1);
      setVal(city,  p.i_city  || p.d_city);
      setVal(stateSel, useStateName);
      setVal(zip,   p.i_zip   || p.d_zip);
    }

    if (country) setVal(country, 'United States');
    if (email)   setVal(email, p.email);
  }

  /* =========================
     INIT
  ========================== */
  function init(){
    injectStyles();
    buildModal();
    startPlacementWatcher(); // <-- ensures “Guest” + “Sign In” follow the Proceed button
    LOG('Ready.');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

