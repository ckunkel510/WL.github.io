(function () {
  'use strict';

  const IS_CART_PAGE = /ShoppingCart\.aspx/i.test(location.pathname);
  const IS_CHECKOUT_PAGE = /Checkout/i.test(location.pathname) || /PlaceOrder/i.test(location.pathname);

  // Guest checkout needs to show controls on the cart page, but it also needs to
  // run on the checkout page so saved guest data can be applied after WebForms navigates.
  if (!IS_CART_PAGE && !IS_CHECKOUT_PAGE) return;

  const LOG = (...a) => console.log('[GuestCheckout]', ...a);
  const ERR = (...a) => console.error('[GuestCheckout]', ...a);

  const SIGNUP_PATH = location.origin + '/UserSignup.aspx';
  const KEY = 'wl_guest_checkout_payload';
  const AUTOFILL_KEY = 'wl_guest_checkout_needs_autofill';
  const MODE_KEY = 'wl_checkout_mode';
  const CHECKOUT_SNAPSHOT_KEY = 'wl_checkout_form_snapshot_v2';
  const DATE_STATE_KEY = 'wl_checkout_date_state_v2';

  function getCheckoutMode() { try { return sessionStorage.getItem(MODE_KEY) || ''; } catch { return ''; } }
  function setCheckoutMode(mode) { try { sessionStorage.setItem(MODE_KEY, mode); } catch {} }

  function clearGuestState() {
    try { sessionStorage.removeItem(KEY); } catch {}
    try { sessionStorage.removeItem(AUTOFILL_KEY); } catch {}
  }

  function resetCheckoutDraftStateForGuest() {
    try { sessionStorage.removeItem(CHECKOUT_SNAPSHOT_KEY); } catch {}
    try { sessionStorage.removeItem(DATE_STATE_KEY); } catch {}
    try { sessionStorage.removeItem('wl_billing_confirmed'); } catch {}
    try { sessionStorage.removeItem('wl_billing_seen'); } catch {}
    try { sessionStorage.removeItem('wl_billing_confirmed_delivered'); } catch {}
  }

  function cartHasNativeSigninOption() {
    const cell = document.getElementById('ctl00_PageBody_OptionalSigninButton');
    if (!cell) return false;
    return !!cell.querySelector('a[href*="Signin.aspx"], a[href*="Login"], input[value*="Sign In"], button');
  }

  function isSignedInCartContext() {
    if (!IS_CART_PAGE) return false;
    if (cartHasNativeSigninOption()) return false;
    const wrapper = document.getElementById('wlCustomCart');
    if (wrapper && wrapper.dataset.wlSignedIn === '1') return true;
    const linkText = Array.from(document.querySelectorAll('a,button,input[type=submit],input[type=button]'))
      .map(el => (el.value || el.textContent || el.getAttribute('title') || '').trim().toLowerCase())
      .join(' | ');
    if (/sign\s*out|log\s*out|my\s+account|account\s+settings/.test(linkText)) return true;
    return !document.getElementById('ctl00_PageBody_OptionalSigninButton');
  }

  function removeGuestActionsFromCart() {
    ['gc_guest_btn','gc_signin_btn','gc_below_proceed'].forEach((id) => {
      try { document.getElementById(id)?.remove(); } catch {}
    });
    const mount = document.getElementById('wl_guest_actions_mount');
    if (mount) { mount.innerHTML = ''; mount.style.display = 'none'; }
  }

  const STATE_LONG = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
    CO: 'Colorado', CT: 'Connecticut', DC: 'District of Columbia', DE: 'Delaware',
    FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', IA: 'Iowa', ID: 'Idaho',
    IL: 'Illinois', IN: 'Indiana', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
    MA: 'Massachusetts', MD: 'Maryland', ME: 'Maine', MI: 'Michigan',
    MN: 'Minnesota', MO: 'Missouri', MS: 'Mississippi', MT: 'Montana',
    NC: 'North Carolina', ND: 'North Dakota', NE: 'Nebraska', NH: 'New Hampshire',
    NJ: 'New Jersey', NM: 'New Mexico', NV: 'Nevada', NY: 'New York',
    OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
    SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas',
    UT: 'Utah', VA: 'Virginia', VT: 'Vermont', WA: 'Washington', WI: 'Wisconsin',
    WV: 'West Virginia', WY: 'Wyoming', AB: 'Alberta', BC: 'British Columbia',
    MB: 'Manitoba', NB: 'New Brunswick', NL: 'Newfoundland and Labrador',
    NS: 'Nova Scotia', NT: 'Northwest Territories', NU: 'Nunavut', ON: 'Ontario',
    PE: 'Prince Edward Island', QC: 'Quebec', SK: 'Saskatchewan', YT: 'Yukon Territory'
  };

  function $(q, root = document) { return root.querySelector(q); }
  function byId(id, root = document) { return root.getElementById(id); }
  function clean(v) { return String(v || '').trim(); }
  function digits(v) { return clean(v).replace(/[^\d]/g, ''); }

  function randTempPassword(len = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let s = '';
    for (let i = 0; i < len; i += 1) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  function saveGuest(payload) {
    setCheckoutMode('guest');
    resetCheckoutDraftStateForGuest();
    try { sessionStorage.setItem(KEY, JSON.stringify(payload)); } catch {}
    try { sessionStorage.setItem(AUTOFILL_KEY, '1'); } catch {}
  }

  function loadGuest() {
    try { return JSON.parse(sessionStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
  }

  function setVal(node, val, opts) {
    if (!node) return false;
    const value = clean(val);
    const dispatch = !(opts && opts.silent);

    if (node.tagName === 'SELECT') {
      const want = value.toLowerCase();
      const optsArr = Array.from(node.options || []);
      const match = optsArr.find(o => clean(o.text || o.textContent).toLowerCase() === want) ||
        optsArr.find(o => clean(o.value).toLowerCase() === want) ||
        optsArr.find(o => clean(o.text || o.textContent).toLowerCase() === clean(STATE_LONG[value.toUpperCase()]).toLowerCase());
      if (match) node.value = match.value;
      else if (value) node.value = value;
    } else {
      node.value = value;
    }

    if (dispatch) {
      try { node.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
      try { node.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
    }
    return true;
  }

  function setId(id, val, root = document, opts) {
    return setVal(byId(id, root), val, opts);
  }

  function runNativeButton(btn) {
    if (!btn) return false;
    try {
      const href = btn.getAttribute('href') || '';
      if (/^javascript:/i.test(href)) {
        // WebForms buttons often store the actual postback in href.
        (btn.ownerDocument.defaultView || window).eval(href.replace(/^javascript:/i, ''));
        return true;
      }
    } catch {}
    try { btn.click(); return true; } catch {}
    return false;
  }

  function injectStyles() {
    if (document.getElementById('gc_modal_styles')) return;
    const css = `
      .gc-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;z-index:9998;}
      .gc-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:9999;padding:18px;}
      .gc-card{background:#fff;border-radius:16px;max-width:720px;width:min(720px,96vw);max-height:92vh;overflow:auto;box-shadow:0 8px 30px rgba(0,0,0,.2);padding:20px;}
      .gc-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:10px;}
      .gc-head{font-size:20px;font-weight:700;margin:0 0 8px;color:#222;}
      .gc-sub{font-size:13px;color:#555;margin-bottom:16px;line-height:1.35;}
      .gc-section{font-size:16px;font-weight:700;margin:14px 0 8px;color:#222;}
      .gc-field label{font-size:12px;color:#333;margin-bottom:4px;display:block;}
      .gc-field input{width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;box-sizing:border-box;}
      .gc-field input.gc-invalid{border-color:#b00020;box-shadow:0 0 0 3px rgba(176,0,32,.12);background:#fffafa;}
      .gc-field-msg{font-size:12px;color:#b00020;margin-top:4px;line-height:1.25;}
      .gc-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;}
      .gc-btn{padding:10px 14px;border-radius:10px;border:1px solid #ddd;background:#f6f6f6;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;}
      .gc-btn.primary{background:#6b0016;color:#fff;border-color:#6b0016;}
      .gc-btn[disabled]{opacity:.65;cursor:wait;}
      .gc-check{display:flex;align-items:center;gap:8px;margin:8px 0 4px;}
      .gc-hidden{display:none!important;}
      .gc-note{font-size:12px;color:#666;margin-top:6px;line-height:1.35;}
      .gc-error{background:#fff4f4;border:1px solid #f0caca;color:#8a1f1f;padding:10px;border-radius:10px;margin:10px 0;display:none;}
      #gc_below_proceed,#wl_guest_actions_mount{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;align-items:center;}
      #gc_below_proceed .epi-button,#wl_guest_actions_mount .epi-button{display:inline-flex;align-items:center;justify-content:center;}
      @media (max-width:640px){.gc-row{grid-template-columns:1fr}.gc-actions{flex-direction:column-reverse}.gc-btn{width:100%;}}
    `;
    const style = document.createElement('style');
    style.id = 'gc_modal_styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function showModal() {
    const back = $('#gc_backdrop');
    const modal = $('#gc_modal');
    if (back) back.style.display = 'block';
    if (modal) modal.style.display = 'flex';
    setTimeout(() => { try { $('#gc_email')?.focus(); } catch {} }, 50);
  }

  function closeModal() {
    const back = $('#gc_backdrop');
    const modal = $('#gc_modal');
    if (back) back.style.display = 'none';
    if (modal) modal.style.display = 'none';
  }

  function buildModal() {
    if (document.getElementById('gc_modal')) return;

    const backdrop = document.createElement('div');
    backdrop.className = 'gc-modal-backdrop';
    backdrop.id = 'gc_backdrop';

    const modal = document.createElement('div');
    modal.className = 'gc-modal';
    modal.id = 'gc_modal';
    modal.innerHTML = `
      <div class="gc-card" role="dialog" aria-modal="true" aria-labelledby="gc_title">
        <div class="gc-head" id="gc_title">Checkout as Guest</div>
        <div class="gc-sub">Enter the basics once and we’ll move you into checkout. You can still choose pickup or delivery on the next screen.</div>
        <div class="gc-error" id="gc_error"></div>

        <div class="gc-row">
          <div class="gc-field"><label for="gc_email">Email</label><input id="gc_email" type="email" autocomplete="email" required></div>
          <div class="gc-field"><label for="gc_phone">Phone</label><input id="gc_phone" type="tel" autocomplete="tel" required placeholder="(###) ###-####"></div>
        </div>
        <div class="gc-row">
          <div class="gc-field"><label for="gc_fname">First name</label><input id="gc_fname" type="text" autocomplete="given-name" required></div>
          <div class="gc-field"><label for="gc_lname">Last name</label><input id="gc_lname" type="text" autocomplete="family-name" required></div>
        </div>

        <div class="gc-section">Address</div>
        <div class="gc-row">
          <div class="gc-field"><label for="gc_del_addr1">Street</label><input id="gc_del_addr1" type="text" autocomplete="address-line1" required></div>
          <div class="gc-field"><label for="gc_del_city">City</label><input id="gc_del_city" type="text" autocomplete="address-level2" required></div>
        </div>
        <div class="gc-row">
          <div class="gc-field"><label for="gc_del_state">State</label><input id="gc_del_state" type="text" maxlength="2" placeholder="TX" autocomplete="address-level1" required></div>
          <div class="gc-field"><label for="gc_del_zip">ZIP</label><input id="gc_del_zip" type="text" autocomplete="postal-code" required></div>
        </div>

        <div class="gc-check">
          <input type="checkbox" id="gc_bill_same" checked>
          <label for="gc_bill_same">Billing same as this address</label>
        </div>

        <div id="gc_bill_block" class="gc-hidden">
          <div class="gc-section">Billing Address</div>
          <div class="gc-row">
            <div class="gc-field"><label for="gc_inv_addr1">Street</label><input id="gc_inv_addr1" type="text" autocomplete="address-line1"></div>
            <div class="gc-field"><label for="gc_inv_city">City</label><input id="gc_inv_city" type="text" autocomplete="address-level2"></div>
          </div>
          <div class="gc-row">
            <div class="gc-field"><label for="gc_inv_state">State</label><input id="gc_inv_state" type="text" maxlength="2" placeholder="TX" autocomplete="address-level1"></div>
            <div class="gc-field"><label for="gc_inv_zip">ZIP</label><input id="gc_inv_zip" type="text" autocomplete="postal-code"></div>
          </div>
        </div>

        <div class="gc-note">This creates a temporary guest account so WebTrack can process the order. Customers can reset the password later if they want to use the account again.</div>
        <div class="gc-actions">
          <button type="button" class="gc-btn" id="gc_cancel">Cancel</button>
          <button type="button" class="gc-btn primary" id="gc_submit">Continue</button>
        </div>
      </div>`;

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);

    $('#gc_bill_same').addEventListener('change', (e) => {
      $('#gc_bill_block').classList.toggle('gc-hidden', e.target.checked);
    });
    $('#gc_cancel').addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    $('#gc_submit').addEventListener('click', onSubmitGuest);
  }

  function getProceedBtn() { return document.getElementById('ctl00_PageBody_PlaceOrderButton'); }
  function getSignInCell() { return document.getElementById('ctl00_PageBody_OptionalSigninButton'); }

  function getOrCreateGuestBtn() {
    let btn = document.getElementById('gc_guest_btn');
    if (!btn) {
      btn = document.createElement('a');
      btn.id = 'gc_guest_btn';
      btn.className = 'epi-button gc-guest-entry';
      btn.href = 'javascript:void(0)';
      btn.innerHTML = '<span>Checkout as Guest</span>';
      btn.addEventListener('click', showModal);
    }
    return btn;
  }

  function getOrCreateSignInClone() {
    let clone = document.getElementById('gc_signin_btn');
    if (clone) return clone;

    const td = getSignInCell();
    const origA = td ? td.querySelector('a[href*="Signin.aspx"], a[href*="Login"]') : null;
    if (!origA) return null;

    td.style.display = 'none';
    clone = origA.cloneNode(true);
    clone.id = 'gc_signin_btn';
    return clone;
  }

  function getOrCreateBelowContainer(proceedBtn) {
    const customMount = document.getElementById('wl_guest_actions_mount');
    if (customMount) return customMount;

    let cont = document.getElementById('gc_below_proceed');
    if (!cont) {
      cont = document.createElement('div');
      cont.id = 'gc_below_proceed';
    }
    if (proceedBtn && proceedBtn.nextSibling !== cont) {
      proceedBtn.insertAdjacentElement('afterend', cont);
    }
    return cont;
  }

  function placeAdjacentUI() {
    if (isSignedInCartContext()) {
      if (getCheckoutMode() !== 'guest') {
        setCheckoutMode('signed_in');
        clearGuestState();
      }
      removeGuestActionsFromCart();
      return false;
    }

    const proceed = getProceedBtn();
    const customMount = document.getElementById('wl_guest_actions_mount');
    if (!proceed && !customMount) return false;

    const cont = getOrCreateBelowContainer(proceed);
    if (cont) cont.style.display = '';
    const guest = getOrCreateGuestBtn();
    const signin = getOrCreateSignInClone();

    if (!guest.parentNode || guest.parentNode !== cont) cont.appendChild(guest);
    if (signin && (!signin.parentNode || signin.parentNode !== cont)) cont.appendChild(signin);
    return true;
  }

  function startPlacementWatcher() {
    [0, 100, 300, 800, 1600, 3200].forEach(t => setTimeout(placeAdjacentUI, t));
    let debounce;
    const obs = new MutationObserver(() => {
      clearTimeout(debounce);
      debounce = setTimeout(placeAdjacentUI, 120);
    });
    obs.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', () => {
      clearTimeout(debounce);
      debounce = setTimeout(placeAdjacentUI, 120);
    });
  }

  function showError(msg) {
    const box = $('#gc_error');
    if (!box) return alert(msg);
    box.textContent = msg;
    box.style.display = 'block';
  }

  function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(email)); }
  function normalizeZip(zip) {
    const d = digits(zip);
    if (d.length === 5) return d;
    if (d.length === 9) return `${d.slice(0,5)}-${d.slice(5)}`;
    return clean(zip);
  }
  function validateZip(zip) { return /^\d{5}(-\d{4})?$/.test(normalizeZip(zip)); }
  function normalizePhone(phone) {
    const d = digits(phone);
    if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
    if (d.length === 11 && d[0] === '1') return `(${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
    return clean(phone);
  }

  function clearGuestFieldErrors() {
    document.querySelectorAll('.gc-invalid').forEach(el => el.classList.remove('gc-invalid'));
    document.querySelectorAll('.gc-field-msg').forEach(el => el.remove());
    const box = $('#gc_error');
    if (box) { box.textContent = ''; box.style.display = 'none'; }
  }

  function markGuestInvalid(id, msg) {
    const input = byId(id);
    if (!input) return;
    input.classList.add('gc-invalid');
    const host = input.closest('.gc-field') || input.parentElement;
    if (host && !host.querySelector('.gc-field-msg')) {
      const div = document.createElement('div');
      div.className = 'gc-field-msg';
      div.textContent = msg;
      host.appendChild(div);
    }
  }

  function collectGuestPayload() {
    clearGuestFieldErrors();

    const email = clean($('#gc_email')?.value);
    const phoneDigits = digits($('#gc_phone')?.value);
    const phone = phoneDigits;
    const fname = clean($('#gc_fname')?.value);
    const lname = clean($('#gc_lname')?.value);
    const d_addr1 = clean($('#gc_del_addr1')?.value);
    const d_city = clean($('#gc_del_city')?.value);
    const d_state = clean($('#gc_del_state')?.value).toUpperCase();
    const d_zip = normalizeZip($('#gc_del_zip')?.value);
    const billSame = !!$('#gc_bill_same')?.checked;
    const i_addr1 = billSame ? d_addr1 : clean($('#gc_inv_addr1')?.value);
    const i_city = billSame ? d_city : clean($('#gc_inv_city')?.value);
    const i_state2 = billSame ? d_state : clean($('#gc_inv_state')?.value).toUpperCase();
    const i_zip = billSame ? d_zip : normalizeZip($('#gc_inv_zip')?.value);

    // Put normalized values back so the customer sees the fix before continuing.
    const phoneInput = $('#gc_phone');
    if (phoneInput && phoneDigits.length >= 10) phoneInput.value = normalizePhone(phoneInput.value);
    const dz = $('#gc_del_zip');
    if (dz) dz.value = d_zip;
    const iz = $('#gc_inv_zip');
    if (iz && !billSame) iz.value = i_zip;

    const errors = [];
    const add = (id, msg) => { errors.push(msg); markGuestInvalid(id, msg); };

    if (!validateEmail(email)) add('gc_email', 'Please enter a valid email address.');
    if (phoneDigits.length < 10) add('gc_phone', 'Please enter a valid phone number.');
    if (!fname) add('gc_fname', 'First name is required.');
    if (!lname) add('gc_lname', 'Last name is required.');
    if (!d_addr1) add('gc_del_addr1', 'Street address is required.');
    if (!d_city) add('gc_del_city', 'City is required.');
    if (!/^[A-Z]{2}$/.test(d_state)) add('gc_del_state', 'Use a 2-letter state, like TX.');
    if (!validateZip(d_zip)) add('gc_del_zip', 'ZIP must be 5 digits or ZIP+4.');

    if (!billSame) {
      if (!i_addr1) add('gc_inv_addr1', 'Billing street address is required.');
      if (!i_city) add('gc_inv_city', 'Billing city is required.');
      if (!/^[A-Z]{2}$/.test(i_state2)) add('gc_inv_state', 'Use a 2-letter state, like TX.');
      if (!validateZip(i_zip)) add('gc_inv_zip', 'Billing ZIP must be 5 digits or ZIP+4.');
    }

    if (errors.length) {
      try {
        const first = document.querySelector('.gc-invalid');
        if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => { try { first?.focus(); } catch {} }, 100);
      } catch {}
      return { error: 'Please fix the highlighted fields before continuing.' };
    }

    return {
      email, phone, fname, lname,
      contactName: `${fname} ${lname}`.trim(),
      d_addr1, d_city, d_state, d_zip,
      billSame,
      i_addr1, i_city, i_state2, i_zip,
      password: randTempPassword(18)
    };
  }

  async function onSubmitGuest() {
    const submit = $('#gc_submit');
    const payload = collectGuestPayload();
    if (payload.error) return showError(payload.error);

    saveGuest(payload);
    if (submit) { submit.disabled = true; submit.textContent = 'Continuing…'; }

    try {
      await createAccountInBackground(payload);
      continueCheckoutAndHookBilling();
      closeModal();
    } catch (e) {
      ERR('Account creation error:', e);
      showError('We had trouble creating the guest checkout. If this email already has an account, please use Sign In or reset the password.');
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = 'Continue'; }
    }
  }

  function createAccountInBackground(payload) {
    return new Promise((resolve, reject) => {
      let frame = document.getElementById('gc_signup_iframe');
      if (!frame) {
        frame = document.createElement('iframe');
        frame.id = 'gc_signup_iframe';
        frame.style.position = 'fixed';
        frame.style.width = '1px';
        frame.style.height = '1px';
        frame.style.left = '-9999px';
        frame.style.top = '-9999px';
        frame.setAttribute('aria-hidden', 'true');
        document.body.appendChild(frame);
      }

      let attempts = 0;
      const maxAttempts = 20;

      frame.onload = () => {
        try {
          const win = frame.contentWindow;
          const doc = frame.contentDocument || win.document;
          if (!doc) throw new Error('No iframe document');

          const bodyText = clean(doc.body && doc.body.innerText).toLowerCase();
          if (bodyText.includes('reset password') || bodyText.includes('forgot password')) {
            LOG('Existing account/reset flow detected.');
            resolve();
            return;
          }

          if (!/UserSignup\.aspx/i.test(win.location.pathname)) {
            win.location.href = SIGNUP_PATH;
            return;
          }

          const Email1 = byId('ctl00_PageBody_UserNameTextBox', doc);
          const Email2 = byId('ctl00_PageBody_EmailAddressTextBox', doc);
          const Pass1 = byId('ctl00_PageBody_Password1TextBox', doc);
          const Pass2 = byId('ctl00_PageBody_Password2TextBox', doc);
          const Phone = byId('ctl00_PageBody_ContactTelephoneTextBox', doc);

          if (!Email1 || !Email2 || !Pass1 || !Pass2 || !Phone) {
            attempts += 1;
            if (attempts > maxAttempts) throw new Error('Signup fields did not load.');
            setTimeout(() => frame.onload(), 250);
            return;
          }

          [Pass1, Pass2].forEach(inp => {
            try { inp.autocomplete = 'off'; inp.setAttribute('aria-hidden', 'true'); } catch {}
          });

          setVal(Email1, payload.email);
          setVal(Email2, payload.email);
          setVal(Pass1, payload.password);
          setVal(Pass2, payload.password);
          setVal(Phone, payload.phone);
          setId('ctl00_PageBody_FirstNameTextBox', payload.fname, doc);
          setId('ctl00_PageBody_LastNameTextBox', payload.lname, doc);
          setId('ctl00_PageBody_ContactNameTextBox', payload.contactName, doc);
          setId('ctl00_PageBody_DeliveryAddressLine1TextBox', payload.d_addr1, doc);
          setId('ctl00_PageBody_DeliveryCityTextBox', payload.d_city, doc);
          setId('ctl00_PageBody_DeliveryStateCountyTextBox', payload.d_state, doc);
          setId('ctl00_PageBody_DeliveryStateTextBox', payload.d_state, doc);
          setId('ctl00_PageBody_DeliveryPostalCodeTextBox', payload.d_zip, doc);
          setId('ctl00_PageBody_InvoiceAddressLine1TextBox', payload.i_addr1, doc);
          setId('ctl00_PageBody_InvoiceCityTextBox', payload.i_city, doc);
          setId('ctl00_PageBody_InvoiceStateCountyTextBox', payload.i_state2, doc);
          setId('ctl00_PageBody_InvoicePostalCodeTextBox', payload.i_zip, doc);

          const btn = byId('ctl00_PageBody_SignupButton', doc);
          if (!btn) throw new Error('Signup button not found.');

          btn.classList.remove('disabled');
          btn.removeAttribute('aria-disabled');
          btn.style.pointerEvents = 'auto';
          btn.style.opacity = '1';
          runNativeButton(btn);

          setTimeout(() => resolve(), 2200);
        } catch (e) {
          reject(e);
        }
      };

      frame.src = SIGNUP_PATH;
    });
  }

  function continueCheckoutAndHookBilling() {
    setCheckoutMode('guest');
    try { sessionStorage.setItem(AUTOFILL_KEY, '1'); } catch {}
    installBillingObserver();

    const proceedBtn = getProceedBtn();
    if (proceedBtn) {
      LOG('Clicking Proceed to checkout…');
      runNativeButton(proceedBtn);
    }
  }

  function applyGuestToCheckout() {
    const payload = loadGuest();
    if (!payload || !payload.email) return false;

    const hasCheckoutFields = byId('ctl00_PageBody_InvoiceAddress_AddressLine1') || byId('ctl00_PageBody_DeliveryAddress_AddressLine1');
    if (!hasCheckoutFields) return false;

    LOG('Applying guest checkout autofill.');

    // Delivery/contact fields are still required by WebTrack even for pickup in some builds.
    setId('ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox', payload.fname);
    setId('ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox', payload.lname);
    setId('ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox', payload.phone);
    setId('ctl00_PageBody_DeliveryAddress_AddressLine1', payload.d_addr1);
    setId('ctl00_PageBody_DeliveryAddress_City', payload.d_city);
    setId('ctl00_PageBody_DeliveryAddress_Postcode', payload.d_zip);
    setId('ctl00_PageBody_DeliveryAddress_CountrySelector', 'USA');
    setId('ctl00_PageBody_DeliveryAddress_CountySelector_CountyList', STATE_LONG[payload.d_state] || payload.d_state);

    setId('ctl00_PageBody_InvoiceAddress_ContactFirstNameTextBox', payload.fname);
    setId('ctl00_PageBody_InvoiceAddress_ContactLastNameTextBox', payload.lname);
    setId('ctl00_PageBody_InvoiceAddress_ContactTelephoneTextBox', payload.phone);
    setId('ctl00_PageBody_InvoiceAddress_EmailAddressTextBox', payload.email);
    setId('ctl00_PageBody_InvoiceAddress_AddressLine1', payload.i_addr1 || payload.d_addr1);
    setId('ctl00_PageBody_InvoiceAddress_City', payload.i_city || payload.d_city);
    setId('ctl00_PageBody_InvoiceAddress_Postcode', payload.i_zip || payload.d_zip);
    setId('ctl00_PageBody_InvoiceAddress_CountrySelector1', 'USA');
    setId('ctl00_PageBody_InvoiceAddress_CountySelector_CountyList', STATE_LONG[payload.i_state2] || payload.i_state2 || STATE_LONG[payload.d_state] || payload.d_state);

    try {
      localStorage.setItem('wl_sameAsDelivery', payload.billSame ? 'true' : 'false');
      const same = byId('sameAsDeliveryCheck');
      if (same) {
        same.checked = !!payload.billSame;
        same.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } catch {}

    try { window.WLCheckout?.refreshInvoiceSummary?.(false); } catch {}
    try { window.WLCheckout?.applyInvoiceDefaultView?.(); } catch {}
    try { window.WLCheckout?.refreshDeliverySummary?.(); } catch {}

    try { sessionStorage.removeItem(AUTOFILL_KEY); } catch {}
    return true;
  }

  function installBillingObserver() {
    const payload = loadGuest();
    if (!payload || !payload.email) return;

    const tryApply = () => applyGuestToCheckout();
    if (tryApply()) return;

    let done = false;
    const obs = new MutationObserver(() => {
      if (done) return;
      if (tryApply()) {
        done = true;
        obs.disconnect();
      }
    });
    try { obs.observe(document.body, { childList: true, subtree: true }); } catch {}

    [150, 400, 900, 1600, 3000].forEach(t => setTimeout(() => {
      if (!done && tryApply()) { done = true; try { obs.disconnect(); } catch {} }
    }, t));
  }

  function init() {
    injectStyles();
    document.addEventListener('input', (ev) => {
      if (ev.target && ev.target.classList && ev.target.classList.contains('gc-invalid')) {
        ev.target.classList.remove('gc-invalid');
        try { ev.target.closest('.gc-field')?.querySelector('.gc-field-msg')?.remove(); } catch {}
      }
    }, true);

    if (IS_CART_PAGE) {
      if (isSignedInCartContext()) {
        if (getCheckoutMode() !== 'guest') {
          setCheckoutMode('signed_in');
          clearGuestState();
        }
        removeGuestActionsFromCart();
      } else {
        buildModal();
        startPlacementWatcher();
      }
    }

    const payload = loadGuest();
    const wantsAutofill = (() => { try { return sessionStorage.getItem(AUTOFILL_KEY) === '1'; } catch { return false; } })();
    // Never apply an old guest payload just because the shopper is on checkout.
    // It should only hydrate the page when this checkout was explicitly started as Guest Checkout.
    if (payload && payload.email && wantsAutofill && getCheckoutMode() === 'guest') {
      installBillingObserver();
    }

    window.WLGuestCheckout = window.WLGuestCheckout || {};
    window.WLGuestCheckout.open = showModal;
    window.WLGuestCheckout.apply = applyGuestToCheckout;
    LOG('Ready.');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
