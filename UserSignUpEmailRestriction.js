document.addEventListener('DOMContentLoaded', function () {
  console.log('[WL Script] DOM loaded.');

  const input = document.getElementById('ctl00_PageBody_UserNameTextBox');
  const signupBtn = document.getElementById('ctl00_PageBody_SignupButton');
  const validator = document.getElementById('ctl00_PageBody_UserNameValidator');
  const errorMsgDiv = validator?.querySelector('.errorMessage');
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const signInUrl = 'https://webtrack.woodsonlumber.com/SignIn.aspx?from=signup_redirect';

  // ========== EMAIL VALIDATION SETUP ==========
  if (input) {
    console.log('[WL Script] Found username/email input.');

    input.setAttribute('type', 'email');
    input.setAttribute('required', 'true');
    input.setAttribute('placeholder', 'Enter your email');

    const customError = document.createElement('div');
    customError.id = 'customEmailError';
    customError.style.color = 'red';
    customError.style.fontSize = '0.9em';
    customError.style.marginTop = '5px';
    customError.style.display = 'none';
    input.parentNode.insertBefore(customError, input.nextSibling);

    function validateEmail(value) {
      if (!value) return 'Email is required';
      if (!emailPattern.test(value)) return 'Please enter a valid email address';
      return '';
    }

    function updateValidationMessage() {
      const value = input.value.trim();
      const message = validateEmail(value);

      if (message) {
        console.warn('[WL Script] Email validation failed:', message);
        customError.textContent = message;
        customError.style.display = 'block';
        if (signupBtn) {
          signupBtn.classList.add('disabled');
          signupBtn.style.pointerEvents = 'none';
          signupBtn.style.opacity = '0.5';
        }
      } else {
        console.log('[WL Script] Email validated successfully.');
        customError.textContent = '';
        customError.style.display = 'none';
        if (signupBtn) {
          signupBtn.classList.remove('disabled');
          signupBtn.style.pointerEvents = 'auto';
          signupBtn.style.opacity = '1';
        }
      }
    }

    // Validate on load (in case value is pre-filled)
    updateValidationMessage();

    // Validate live
    input.addEventListener('input', updateValidationMessage);

    if (signupBtn) {
      signupBtn.addEventListener('click', function (e) {
        const message = validateEmail(input.value.trim());
        if (message) {
          console.warn('[WL Script] Blocking sign-up due to invalid email.');
          e.preventDefault();
          updateValidationMessage();
        }
      });
    }
  } else {
    console.warn('[WL Script] Username/email input not found.');
  }

 // ========== REDIRECT IF EMAIL ALREADY EXISTS ==========
const duplicateWarning = document.getElementById('ctl00_PageBody_DuplicateUserNameWarning');
const enteredEmail = input?.value.trim() || '';
const isValidEmail = emailPattern.test(enteredEmail);

if (duplicateWarning) {
  const warningText = duplicateWarning.textContent.trim();
  const isWarningVisible = duplicateWarning.offsetParent !== null;

  console.log('[WL Script] Duplicate warning found. Text:', warningText, '| Visible:', isWarningVisible);

  if (isWarningVisible && isValidEmail && /user id is already in use/i.test(warningText)) {
    console.warn('[WL Script] Duplicate email detected — redirecting soon...');

    const redirectMessage = document.createElement('div');
    redirectMessage.textContent = 'User already exists. Redirecting to sign in...';
    redirectMessage.style.color = 'orange';
    redirectMessage.style.fontWeight = 'bold';
    redirectMessage.style.marginTop = '8px';
    input?.parentNode.insertBefore(redirectMessage, input.nextSibling);

    setTimeout(() => {
      console.log('[WL Script] Redirecting to:', signInUrl);
      window.location.href = signInUrl;
    }, 3000);
  } else {
    console.log('[WL Script] No redirect — duplicate warning not visible or email invalid.');
  }
} else {
  console.log('[WL Script] Duplicate user warning element not found.');
}

// ========== SIGN-IN PAGE OVERRIDE ==========
const urlParams = new URLSearchParams(window.location.search);
const fromParam = urlParams.get('from');

if (fromParam === 'signup_redirect') {
  console.log('[WL Script] Sign-in override triggered by ?from=signup_redirect');

  function tryHideSignupSections(attempt = 1) {
    console.log(`[WL Script] Attempt ${attempt}: Looking for signup/access sections...`);

    const signUpPanel = document.getElementById('ctl00_PageBody_SignUpPanel');
    const requestAccessText = document.getElementById('ctl00_PageBody_RequestAccessText');
    const requestAccessButton = document.getElementById('ctl00_PageBody_BtnRequestAccess');

    if (signUpPanel || requestAccessText || requestAccessButton) {
      console.log('[WL Script] Elements found:');
      if (signUpPanel) {
        signUpPanel.style.display = 'none';
        console.log('  - Hid SignUpPanel (ctl00_PageBody_SignUpPanel)');
      } else {
        console.log('  - SignUpPanel not found');
      }

      if (requestAccessText) {
        requestAccessText.style.display = 'none';
        console.log('  - Hid RequestAccessText (ctl00_PageBody_RequestAccessText)');
      } else {
        console.log('  - RequestAccessText not found');
      }

      if (requestAccessButton) {
        requestAccessButton.style.display = 'none';
        console.log('  - Hid RequestAccessButton (ctl00_PageBody_BtnRequestAccess)');
      } else {
        console.log('  - RequestAccessButton not found');
      }

      // Show notice message if any of the above were hidden
      // Show notice message above the username login input section
const loginGroup = document.querySelector('.epi-form-group-signIn');
const notice = document.createElement('div');
notice.textContent = 'We found your account — please sign in below.';
notice.style.background = '#f6e6cc';
notice.style.color = '#8a4b00';
notice.style.padding = '10px';
notice.style.marginBottom = '10px';
notice.style.border = '1px solid #dca';

if (loginGroup && loginGroup.parentNode) {
  loginGroup.parentNode.insertBefore(notice, loginGroup);
  console.log('[WL Script] Inserted sign-in message above username input.');
} else {
  // fallback if loginGroup not found
  document.body.prepend(notice);
  console.warn('[WL Script] Username input section not found — inserted notice at top of body.');
}

    } else if (attempt < 30) {
      console.warn('[WL Script] Signup/access elements not found yet. Retrying...');
      setTimeout(() => tryHideSignupSections(attempt + 1), 100);
    } else {
      console.error('[WL Script] Gave up after 30 attempts. Signup/access elements not found.');
    }
  }

  tryHideSignupSections();
}
});
