(function () {
  'use strict';

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function setButtonText(button, value) {
    if (!button) return;
    if (button.tagName === 'INPUT') button.value = value;
    else {
      const span = button.querySelector('span');
      if (span) span.textContent = value;
      else button.textContent = value;
    }
  }

  function setWebTrackValue(input, value, fireInput) {
    if (!input) return;
    const normalized = String(value || '');
    input.value = normalized;
    try { input.defaultValue = normalized; } catch (error) {}

    const stateInput = document.getElementById(input.id + '_ClientState');
    if (stateInput) {
      try {
        const state = JSON.parse(stateInput.value || '{}');
        state.valueAsString = normalized;
        state.lastSetTextBoxValue = normalized;
        state.validationText = normalized;
        stateInput.value = JSON.stringify(state);
      } catch (error) {}
    }

    if (fireInput) {
      try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (error) {}
    }
  }

  function fieldGroup(input, className) {
    if (!input) return null;
    return input.closest(className || '.epi-form-group-signup2, .epi-form-group-signup1, .epi-form-group-signIn') || input.parentElement;
  }

  function setEmailAttributes(input) {
    if (!input) return;
    input.setAttribute('type', 'email');
    input.setAttribute('inputmode', 'email');
    input.setAttribute('autocomplete', 'email');
    input.setAttribute('autocapitalize', 'none');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('required', 'required');
  }

  function addFieldHelp(group, text, id) {
    if (!group || document.getElementById(id)) return;
    const help = document.createElement('div');
    help.id = id;
    help.className = 'wl-auth-field-help';
    help.textContent = text;
    group.appendChild(help);
  }

  function bindEmailAsLogin(emailInput, loginInput, submitButton, errorId) {
    if (!emailInput || !loginInput) return;
    setEmailAttributes(emailInput);

    const group = fieldGroup(emailInput);
    let error = document.getElementById(errorId);
    if (!error && group) {
      error = document.createElement('div');
      error.id = errorId;
      error.className = 'wl-auth-error';
      error.setAttribute('aria-live', 'polite');
      error.hidden = true;
      group.appendChild(error);
    }

    function sync(showError) {
      const email = String(emailInput.value || '').trim().toLowerCase();
      setWebTrackValue(loginInput, email, true);
      const valid = EMAIL_RE.test(email);
      emailInput.setCustomValidity(valid ? '' : 'Enter a valid email address.');
      if (error) {
        error.textContent = valid || !showError ? '' : 'Enter a valid email address.';
        error.hidden = valid || !showError;
      }
      return valid;
    }

    emailInput.addEventListener('input', function () { sync(false); });
    emailInput.addEventListener('change', function () { sync(true); });
    emailInput.addEventListener('blur', function () { sync(true); });

    if (submitButton) {
      submitButton.addEventListener('click', function (event) {
        if (sync(true)) return;
        event.preventDefault();
        try { emailInput.reportValidity(); } catch (error) { emailInput.focus(); }
      }, true);
    }

    sync(false);
  }

  function injectStyles() {
    if (document.getElementById('wl-auth-modern-css')) return;
    const style = document.createElement('style');
    style.id = 'wl-auth-modern-css';
    style.textContent = `
      :root{--wl-auth-brand:#6b0016;--wl-auth-border:#d9dde2;--wl-auth-text:#202428;--wl-auth-muted:#62686e;--wl-auth-soft:#f6f7f8;}
      .wl-auth-page *, .wl-signup-page *{box-sizing:border-box;}
      .wl-auth-page input, .wl-signup-page input{letter-spacing:0;}
      .wl-auth-card{border:1px solid var(--wl-auth-border);border-radius:8px;background:#fff;box-shadow:0 3px 12px rgba(0,0,0,.06);}
      .wl-auth-card-head{padding:16px 18px;border-bottom:1px solid var(--wl-auth-border);}
      .wl-auth-card-head h1,.wl-auth-card-head h2,.wl-auth-card-head h3{margin:0;color:var(--wl-auth-text);font-size:20px;line-height:1.25;letter-spacing:0;}
      .wl-auth-card-head p{margin:5px 0 0;color:var(--wl-auth-muted);font-size:14px;line-height:1.4;}
      .wl-auth-card-body{padding:18px;}
      .wl-auth-field-help{margin:6px 0 0;color:var(--wl-auth-muted);font-size:12px;line-height:1.4;}
      .wl-auth-error{margin:6px 0 0;color:#a40000;font-size:13px;font-weight:700;}
      .wl-auth-notice{margin:0 0 14px;padding:11px 12px;border:1px solid #e3c46d;border-left:4px solid #e0b323;border-radius:6px;background:#fff9df;color:#3d3520;font-size:14px;line-height:1.4;}
      .wl-auth-route-link{color:var(--wl-auth-brand);font-weight:800;text-decoration:underline;text-underline-offset:2px;}
      .wl-login-synced{position:absolute!important;left:-10000px!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(1px,1px,1px,1px)!important;}

      /* Sign in */
      .wl-auth-signin{width:min(960px,calc(100% - 32px))!important;max-width:960px!important;margin:24px auto 40px!important;padding:0!important;}
      .wl-auth-signin-intro{margin:0 0 14px;}
      .wl-auth-signin-intro h1{margin:0;color:var(--wl-auth-text);font-size:27px;line-height:1.2;letter-spacing:0;}
      .wl-auth-signin-intro p{margin:6px 0 0;color:var(--wl-auth-muted);font-size:15px;}
      .wl-auth-signin-grid{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(320px,.92fr);gap:16px;align-items:start;}
      .wl-auth-login-card fieldset{min-width:0;margin:0;padding:0;border:0;}
      .wl-auth-login-card .epi-form-group-signIn{display:block!important;margin:0 0 14px!important;}
      .wl-auth-login-card .epi-form-group-signIn>div{width:100%!important;max-width:none!important;margin:0!important;}
      .wl-auth-login-card label{display:block;margin:0 0 6px;color:#343a40;font-weight:800;}
      .wl-auth-login-card .form-control,.wl-auth-choice-card .form-control{width:100%!important;max-width:none!important;min-height:48px;padding:10px 12px;border:1px solid var(--wl-auth-border);border-radius:6px;font-size:16px;}
      .wl-auth-login-card .form-group{margin:0 0 12px;}
      .wl-auth-login-card .epi-button,.wl-auth-choice-card .epi-button{width:100%!important;min-height:46px;border-radius:6px;font-weight:800;}
      .wl-auth-login-card a[href*="ResetPassword"]{display:inline-block;margin-top:2px;color:var(--wl-auth-brand);font-weight:700;}
      .wl-auth-choice-card{overflow:hidden;}
      .wl-auth-choice-section{padding:17px 18px;}
      .wl-auth-choice-section+.wl-auth-choice-section{border-top:1px solid var(--wl-auth-border);}
      .wl-auth-choice-section h2{margin:0;color:var(--wl-auth-text);font-size:17px;line-height:1.3;letter-spacing:0;}
      .wl-auth-choice-section p{margin:6px 0 12px;color:var(--wl-auth-muted);font-size:13px;line-height:1.45;}
      .wl-auth-choice-section.wl-existing{background:#f8f9fa;}
      .wl-auth-choice-section.wl-existing .epi-button{background:var(--wl-auth-brand)!important;color:#fff!important;}
      .wl-auth-choice-section.wl-new .epi-button{background:#fff!important;color:var(--wl-auth-brand)!important;border:1px solid var(--wl-auth-brand)!important;}
      .wl-auth-choice-section hr,.wl-auth-choice-section .mb-1{display:none!important;}
      .wl-auth-choice-section .epi-form-group-signIn{display:block!important;margin:0 0 10px!important;}
      .wl-auth-choice-section .epi-form-group-signIn>div{width:100%!important;max-width:none!important;margin:0!important;}
      .wl-auth-choice-section label{display:block;margin:0 0 5px;font-weight:750;}

      /* Existing account access */
      .wl-request-root{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 18px;width:min(920px,100%);margin:0 auto;padding:0 0 34px;}
      .wl-request-heading,.wl-request-intro,.wl-request-actions,.wl-request-nav{grid-column:1 / -1;}
      .wl-request-heading h3{margin:0;font-size:27px;letter-spacing:0;}
      .wl-request-intro{padding:14px 16px;border:1px solid var(--wl-auth-border);border-left:4px solid var(--wl-auth-brand);border-radius:6px;background:var(--wl-auth-soft);}
      .wl-request-intro strong{display:block;margin-bottom:4px;color:var(--wl-auth-text);font-size:16px;}
      .wl-request-intro p{margin:0;color:var(--wl-auth-muted);font-size:14px;line-height:1.45;}
      .wl-request-field{min-width:0;margin:0!important;padding:0!important;}
      .wl-request-field>div{width:100%!important;max-width:none!important;margin:0!important;}
      .wl-request-field label{display:block;margin:0 0 6px;color:#343a40;font-weight:800;}
      .wl-request-field .RadInput,.wl-request-field .form-control{display:block!important;width:100%!important;max-width:none!important;}
      .wl-request-field input{width:100%!important;min-height:48px!important;padding:10px 12px!important;border:1px solid var(--wl-auth-border)!important;border-radius:6px!important;font-size:16px!important;}
      .wl-request-actions{display:flex;justify-content:flex-end;margin-top:4px!important;}
      .wl-request-actions .submit-button-panel{width:min(100%,320px);}
      .wl-request-actions .epi-button{display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;border-radius:6px;font-weight:800;}
      .wl-request-nav{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-top:4px;}

      /* New customer signup */
      .wl-signup-intro{width:min(1120px,calc(100% - 32px));margin:24px auto 14px;padding:15px 17px;border:1px solid var(--wl-auth-border);border-left:4px solid var(--wl-auth-brand);border-radius:6px;background:var(--wl-auth-soft);}
      .wl-signup-intro h1{margin:0;color:var(--wl-auth-text);font-size:26px;line-height:1.25;letter-spacing:0;}
      .wl-signup-intro p{margin:5px 0 0;color:var(--wl-auth-muted);font-size:14px;line-height:1.45;}
      .wl-signup-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-areas:"account delivery" "account invoice" "prefs prefs";gap:16px;width:min(1120px,calc(100% - 32px))!important;max-width:1120px!important;margin:0 auto!important;padding:0!important;align-items:start;}
      .wl-signup-grid>.col-lg-4{width:auto!important;max-width:none!important;flex:none!important;margin:0!important;padding:18px!important;border:1px solid var(--wl-auth-border);border-radius:8px;background:#fff;box-shadow:0 3px 12px rgba(0,0,0,.05);}
      .wl-signup-account{grid-area:account;}
      .wl-signup-delivery{grid-area:delivery;}
      .wl-signup-invoice{grid-area:invoice;}
      .wl-signup-grid h3{margin:0 0 14px;padding-bottom:10px;border-bottom:1px solid var(--wl-auth-border);color:var(--wl-auth-text);font-size:20px;letter-spacing:0;}
      .wl-signup-grid .epi-form-group-signup2{display:block!important;margin:0 0 13px!important;padding:0!important;}
      .wl-signup-grid .epi-form-group-signup2>div{width:100%!important;max-width:none!important;margin:0!important;}
      .wl-signup-grid .epi-form-group-signup2 label{display:block;margin:0 0 5px;color:#343a40;font-weight:800;}
      .wl-signup-grid .RadInput,.wl-signup-grid .form-control{display:block!important;width:100%!important;max-width:none!important;}
      .wl-signup-grid input[type="text"],.wl-signup-grid input[type="email"],.wl-signup-grid input[type="password"]{width:100%!important;min-height:46px!important;padding:9px 11px!important;border:1px solid var(--wl-auth-border)!important;border-radius:6px!important;font-size:16px!important;}
      .wl-signup-grid .pw-reqs{margin:0 0 7px!important;padding:8px 10px;border:1px solid #e1e3e5;border-radius:6px;background:#f8f9fa;line-height:1.4;}
      .wl-signup-grid .pw-msg{margin:5px 0 0;line-height:1.35;}
      .wl-billing-toggle{display:flex;align-items:flex-start;gap:9px;margin:-2px 0 14px;padding:10px 11px;border:1px solid var(--wl-auth-border);border-radius:6px;background:#f8f9fa;color:#343a40;font-weight:750;line-height:1.35;cursor:pointer;}
      .wl-billing-toggle input{width:18px!important;height:18px!important;margin:1px 0 0;flex:0 0 auto;}
      .wl-signup-invoice.wl-billing-fields-hidden .epi-form-group-signup2{display:none!important;}
      #wl-signup-comm-prefs{grid-area:prefs!important;width:100%!important;max-width:none!important;margin:0!important;border-radius:8px!important;}
      #wl-signup-comm-prefs .wl-signup-pref-row{display:inline-flex!important;width:calc(50% - 8px);padding-right:14px;vertical-align:top;}
      .wl-signup-submit{width:min(1120px,calc(100% - 32px))!important;max-width:1120px!important;margin:14px auto 38px!important;display:flex!important;justify-content:flex-end!important;}
      .wl-signup-submit .submit-button-panel{width:min(100%,320px)!important;margin:0!important;padding:0!important;}
      .wl-signup-submit .epi-button{display:flex!important;align-items:center;justify-content:center;width:100%!important;min-height:48px;border-radius:6px;font-weight:800;}

      @media(max-width:900px){
        .wl-auth-signin-grid{grid-template-columns:minmax(0,1fr);}
        .wl-signup-grid{grid-template-columns:minmax(0,1fr);grid-template-areas:"account" "delivery" "invoice" "prefs";}
      }
      @media(max-width:640px){
        .wl-auth-signin,.wl-signup-intro,.wl-signup-grid,.wl-signup-submit{width:calc(100% - 20px)!important;}
        .wl-auth-signin{margin-top:14px!important;}
        .wl-auth-signin-intro h1,.wl-request-heading h3,.wl-signup-intro h1{font-size:22px;}
        .wl-auth-card-body,.wl-auth-choice-section{padding:15px;}
        .wl-request-root{grid-template-columns:minmax(0,1fr);gap:13px;width:100%;}
        .wl-request-field,.wl-request-heading,.wl-request-intro,.wl-request-actions,.wl-request-nav{grid-column:1;}
        .wl-request-actions .submit-button-panel{width:100%;}
        .wl-signup-grid>.col-lg-4{padding:15px!important;}
        #wl-signup-comm-prefs .wl-signup-pref-row{width:100%;padding-right:0;}
        .wl-signup-submit .submit-button-panel{width:100%!important;}
      }
    `;
    document.head.appendChild(style);
  }

  function setupSignIn() {
    const user = document.getElementById('ctl00_PageBody_SignInControl_UserNameTextBox');
    const password = document.getElementById('ctl00_PageBody_SignInControl_PasswordTextBox');
    const signInButton = document.getElementById('ctl00_PageBody_SignInControl_SignInButton');
    const signUpPanel = document.getElementById('ctl00_PageBody_SignUpPanel');
    const requestText = document.getElementById('ctl00_PageBody_RequestAccessText');
    const requestButton = document.getElementById('ctl00_PageBody_BtnRequestAccess');
    const shell = user?.closest('.form-small');
    if (!user || !password || !signInButton || !signUpPanel || !requestButton || !shell) return;

    document.body.classList.add('wl-auth-page');
    shell.classList.add('wl-auth-signin');

    user.setAttribute('autocomplete', 'username');
    user.setAttribute('inputmode', 'email');
    user.setAttribute('autocapitalize', 'none');
    user.setAttribute('spellcheck', 'false');
    user.removeAttribute('autofocus');
    password.setAttribute('autocomplete', 'current-password');
    password.removeAttribute('autofocus');

    const userLabel = document.querySelector('label[for="' + user.id + '"]');
    if (userLabel) userLabel.textContent = 'Email or login name';
    const newEmail = document.getElementById('ctl00_PageBody_SignUpControl_EmailAddressTextBox');
    setEmailAttributes(newEmail);
    if (newEmail) newEmail.placeholder = 'you@example.com';
    setButtonText(requestButton, 'Connect My Existing Account');
    setButtonText(document.getElementById('ctl00_PageBody_SignUpControl_SubmitButton'), 'Create New Cash Account');

    const signInBlock = user.closest('fieldset')?.parentElement || user.closest('fieldset');
    const requestButtonGroup = requestButton.closest('.form-group') || requestButton.parentElement;
    if (!signInBlock || !requestButtonGroup) return;

    const intro = document.createElement('div');
    intro.className = 'wl-auth-signin-intro';
    intro.innerHTML = '<h1>Sign in to Woodson</h1><p>Access orders, invoices, saved items, account payments, and faster checkout.</p>';

    const grid = document.createElement('div');
    grid.className = 'wl-auth-signin-grid';

    const loginCard = document.createElement('section');
    loginCard.className = 'wl-auth-card wl-auth-login-card';
    loginCard.innerHTML = '<div class="wl-auth-card-head"><h2>Welcome back</h2><p>Use your email address or existing Woodson login name.</p></div><div class="wl-auth-card-body"></div>';
    loginCard.querySelector('.wl-auth-card-body').appendChild(signInBlock);

    if (new URLSearchParams(location.search).get('from') === 'signup_redirect') {
      const notice = document.createElement('div');
      notice.className = 'wl-auth-notice';
      notice.textContent = 'An online login already exists for that email. Sign in below or reset your password.';
      loginCard.querySelector('.wl-auth-card-body').prepend(notice);
    }

    const choiceCard = document.createElement('section');
    choiceCard.className = 'wl-auth-card wl-auth-choice-card';

    const existing = document.createElement('div');
    existing.className = 'wl-auth-choice-section wl-existing';
    existing.innerHTML = '<h2>Already have a Woodson account?</h2><p>If you receive invoices or statements, or already have an account number, connect online access to that account. This does not create a new cash account.</p>';
    existing.appendChild(requestButtonGroup);

    const create = document.createElement('div');
    create.className = 'wl-auth-choice-section wl-new';
    create.innerHTML = '<h2>Completely new to Woodson?</h2><p>Create a new online cash account for shopping and checkout. Do not choose this if your business already has a Woodson account.</p>';
    create.appendChild(signUpPanel);

    if (requestText) requestText.remove();
    choiceCard.append(existing, create);
    grid.append(loginCard, choiceCard);
    shell.replaceChildren(intro, grid);

    const isTouchDevice = (function () {
      try { return matchMedia('(pointer: coarse)').matches || innerWidth <= 640 || /iPad|iPhone|iPod/i.test(navigator.userAgent); }
      catch (error) { return false; }
    })();
    if (isTouchDevice) {
      const dismissFocus = function () {
        if (document.activeElement === user || document.activeElement === password) {
          try { document.activeElement.blur(); } catch (error) {}
        }
      };
      dismissFocus();
      setTimeout(dismissFocus, 150);
    }
  }

  function setupRequestAccess() {
    const login = document.getElementById('ctl00_PageBody_RequestAccessLoginName');
    const email = document.getElementById('ctl00_PageBody_RequestAccessEmailAddressTextBox');
    const button = document.getElementById('ctl00_PageBody_RequestAccessButton');
    const heading = Array.from(document.querySelectorAll('h3')).find(function (item) {
      return /Request Access/i.test(item.textContent || '');
    });
    const root = heading?.parentElement?.parentElement;
    if (!login || !email || !button || !heading || !root) return;

    document.body.classList.add('wl-auth-page', 'wl-request-page');
    root.classList.add('wl-request-root');
    heading.textContent = 'Connect Your Existing Woodson Account';
    heading.parentElement.classList.add('wl-request-heading');

    const intro = document.createElement('div');
    intro.className = 'wl-request-intro';
    intro.innerHTML = '<strong>For customers who already have a Woodson account</strong><p>Use the account number or customer code shown on a statement or invoice. We will connect this online login to your existing balance, invoices, pricing, and account history.</p>';
    heading.parentElement.insertAdjacentElement('afterend', intro);

    const groups = Array.from(root.querySelectorAll('.epi-form-group-signup1'));
    groups.forEach(function (group) { group.classList.add('wl-request-field'); });
    const loginGroup = fieldGroup(login, '.epi-form-group-signup1');
    if (loginGroup) loginGroup.classList.add('wl-login-synced');

    const actions = button.closest('.epi-form-group-signup1') || button.parentElement;
    if (actions) actions.classList.add('wl-request-actions');
    setButtonText(button, 'Request Online Access');

    const labels = {
      ctl00_PageBody_RequestAccessCustomerCode: 'Woodson account number or customer code *',
      ctl00_PageBody_RequestAccessCustomerName: 'Business or account name *',
      ctl00_PageBody_RequestAccessContactNumber: 'Phone number *'
    };
    Object.keys(labels).forEach(function (id) {
      const label = document.querySelector('label[for="' + id + '"]');
      if (label) label.textContent = labels[id];
    });

    const phone = document.getElementById('ctl00_PageBody_RequestAccessContactNumber');
    if (phone) {
      phone.setAttribute('type', 'tel');
      phone.setAttribute('autocomplete', 'tel');
      phone.setAttribute('inputmode', 'tel');
    }
    document.getElementById('ctl00_PageBody_FirstNameField')?.setAttribute('autocomplete', 'given-name');
    document.getElementById('ctl00_PageBody_LastNameField')?.setAttribute('autocomplete', 'family-name');

    const emailGroup = fieldGroup(email, '.epi-form-group-signup1');
    addFieldHelp(emailGroup, 'Your email address will also be your login name.', 'wl-request-email-help');
    bindEmailAsLogin(email, login, button, 'wl-request-email-error');

    const nav = document.createElement('div');
    nav.className = 'wl-request-nav';
    nav.innerHTML = '<a class="wl-auth-route-link" href="SignIn.aspx">Back to sign in</a><a class="wl-auth-route-link" href="UserSignup.aspx">No existing account? Create a new cash account</a>';
    root.appendChild(nav);
  }

  function setupNewSignup() {
    const login = document.getElementById('ctl00_PageBody_UserNameTextBox');
    const email = document.getElementById('ctl00_PageBody_EmailAddressTextBox');
    const button = document.getElementById('ctl00_PageBody_SignupButton');
    if (!login || !email || !button) return;

    const headings = Array.from(document.querySelectorAll('h3'));
    const userHeading = headings.find(function (item) { return /User Details/i.test(item.textContent || ''); });
    const deliveryHeading = headings.find(function (item) { return /Delivery Address/i.test(item.textContent || ''); });
    const invoiceHeading = headings.find(function (item) { return /Invoice Address/i.test(item.textContent || ''); });
    const accountCol = userHeading?.closest('.col-lg-4');
    const deliveryCol = deliveryHeading?.closest('.col-lg-4');
    const invoiceCol = invoiceHeading?.closest('.col-lg-4');
    const row = accountCol?.parentElement;
    if (!accountCol || !deliveryCol || !invoiceCol || !row) return;

    document.body.classList.add('wl-signup-page');
    row.classList.add('wl-signup-grid');
    accountCol.classList.add('wl-signup-account');
    deliveryCol.classList.add('wl-signup-delivery');
    invoiceCol.classList.add('wl-signup-invoice');
    userHeading.textContent = 'Account and Sign-In';
    deliveryHeading.textContent = 'Contact and Delivery';
    invoiceHeading.textContent = 'Billing Address';

    const intro = document.createElement('div');
    intro.className = 'wl-signup-intro';
    intro.innerHTML = '<h1>Create a New Woodson Cash Account</h1><p>This form is for customers who do not already have a Woodson account. <a class="wl-auth-route-link" href="UserSignup.aspx?existing=1">Already receive invoices or statements? Request access to your existing account instead.</a></p>';
    row.parentElement.insertBefore(intro, row);

    const loginGroup = fieldGroup(login, '.epi-form-group-signup2');
    if (loginGroup) loginGroup.classList.add('wl-login-synced');
    const emailGroup = fieldGroup(email, '.epi-form-group-signup2');
    addFieldHelp(emailGroup, 'Your email address will be your login name.', 'wl-signup-email-help');
    bindEmailAsLogin(email, login, button, 'wl-signup-email-error');

    document.getElementById('ctl00_PageBody_FirstNameTextBox')?.setAttribute('autocomplete', 'given-name');
    document.getElementById('ctl00_PageBody_LastNameTextBox')?.setAttribute('autocomplete', 'family-name');
    document.getElementById('ctl00_PageBody_ContactNameTextBox')?.setAttribute('autocomplete', 'name');
    const phone = document.getElementById('ctl00_PageBody_ContactTelephoneTextBox');
    if (phone) {
      phone.setAttribute('type', 'tel');
      phone.setAttribute('autocomplete', 'tel');
      phone.setAttribute('inputmode', 'tel');
    }

    const addressPairs = [
      ['DeliveryAddressLine1TextBox', 'InvoiceAddressLine1TextBox'],
      ['DeliveryAddressLine2TextBox', 'InvoiceAddressLine2TextBox'],
      ['DeliveryAddressLine3TextBox', 'InvoiceAddressLine3TextBox'],
      ['DeliveryCityTextBox', 'InvoiceCityTextBox'],
      ['DeliveryStateCountyTextBox', 'InvoiceStateCountyTextBox'],
      ['DeliveryPostalCodeTextBox', 'InvoicePostalCodeTextBox'],
      ['DeliveryCountryTextBox', 'InvoiceCountryTextBox']
    ].map(function (pair) {
      return pair.map(function (suffix) { return document.getElementById('ctl00_PageBody_' + suffix); });
    });

    const invoiceHasValue = addressPairs.some(function (pair) { return String(pair[1]?.value || '').trim() && pair[1].value !== 'United States'; });
    const toggle = document.createElement('label');
    toggle.className = 'wl-billing-toggle';
    toggle.innerHTML = '<input type="checkbox" id="wlBillingSameAsDelivery"><span>Billing address is the same as the delivery address</span>';
    invoiceHeading.insertAdjacentElement('afterend', toggle);
    const checkbox = toggle.querySelector('input');
    checkbox.checked = !invoiceHasValue;

    function copyDeliveryAddress() {
      if (!checkbox.checked) return;
      addressPairs.forEach(function (pair) {
        if (pair[0] && pair[1]) setWebTrackValue(pair[1], pair[0].value, true);
      });
    }

    function applyBillingChoice() {
      invoiceCol.classList.toggle('wl-billing-fields-hidden', checkbox.checked);
      checkbox.setAttribute('aria-expanded', checkbox.checked ? 'false' : 'true');
      if (checkbox.checked) copyDeliveryAddress();
    }

    checkbox.addEventListener('change', applyBillingChoice);
    addressPairs.forEach(function (pair) {
      pair[0]?.addEventListener('input', copyDeliveryAddress, { passive: true });
      pair[0]?.addEventListener('change', copyDeliveryAddress, { passive: true });
    });
    button.addEventListener('click', function () {
      setWebTrackValue(login, String(email.value || '').trim().toLowerCase(), false);
      copyDeliveryAddress();
    }, true);
    applyBillingChoice();

    const submitGroup = button.closest('.form-group') || button.parentElement;
    const submitRow = submitGroup?.parentElement;
    if (submitRow) submitRow.classList.add('wl-signup-submit');

    function moveCommunicationPreferences(attempt) {
      const preferences = document.getElementById('wl-signup-comm-prefs');
      if (preferences) {
        if (preferences.parentElement !== row) row.appendChild(preferences);
        return;
      }
      if (attempt < 40) setTimeout(function () { moveCommunicationPreferences(attempt + 1); }, 100);
    }
    moveCommunicationPreferences(0);
  }

  function handleDuplicateSignup() {
    const warning = document.getElementById('ctl00_PageBody_DuplicateUserNameWarning');
    const email = document.getElementById('ctl00_PageBody_EmailAddressTextBox');
    if (!warning || !email || warning.offsetParent === null) return;
    const warningText = String(warning.textContent || '').trim();
    if (!EMAIL_RE.test(String(email.value || '').trim()) || !/user id is already in use/i.test(warningText)) return;

    const group = fieldGroup(email, '.epi-form-group-signup2');
    if (group && !document.getElementById('wl-duplicate-login-notice')) {
      const notice = document.createElement('div');
      notice.id = 'wl-duplicate-login-notice';
      notice.className = 'wl-auth-notice';
      notice.textContent = 'An online login already exists for this email. Taking you to sign in.';
      group.appendChild(notice);
    }
    setTimeout(function () {
      location.href = 'SignIn.aspx?from=signup_redirect';
    }, 2200);
  }

  ready(function () {
    injectStyles();
    if (/\/SignIn\.aspx$/i.test(location.pathname)) setupSignIn();
    if (/\/UserSignup\.aspx$/i.test(location.pathname)) {
      if (new URLSearchParams(location.search).get('existing') === '1') setupRequestAccess();
      else {
        setupNewSignup();
        handleDuplicateSignup();
      }
    }
  });
})();
