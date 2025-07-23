document.addEventListener('DOMContentLoaded', function () {
  const input = document.getElementById('ctl00_PageBody_UserNameTextBox');
  const signupBtn = document.getElementById('ctl00_PageBody_SignupButton');
  const validator = document.getElementById('ctl00_PageBody_UserNameValidator');
  const errorMsgDiv = validator?.querySelector('.errorMessage');
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const signInUrl = 'https://webtrack.woodsonlumber.com/SignIn.aspx?from=signup_redirect';

  // Email validation + error message setup
  if (input) {
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
        customError.textContent = message;
        customError.style.display = 'block';
        if (signupBtn) {
          signupBtn.classList.add('disabled');
          signupBtn.style.pointerEvents = 'none';
          signupBtn.style.opacity = '0.5';
        }
      } else {
        customError.textContent = '';
        customError.style.display = 'none';
        if (signupBtn) {
          signupBtn.classList.remove('disabled');
          signupBtn.style.pointerEvents = 'auto';
          signupBtn.style.opacity = '1';
        }
      }
    }

    updateValidationMessage();
    input.addEventListener('input', updateValidationMessage);

    if (signupBtn) {
      signupBtn.addEventListener('click', function (e) {
        const message = validateEmail(input.value.trim());
        if (message) {
          e.preventDefault();
          updateValidationMessage();
        }
      });
    }
  }

  // 👇 Check if the signup failed because user ID already exists
  if (
    validator &&
    errorMsgDiv &&
    errorMsgDiv.textContent.trim() === 'The requested user ID is already in use.' &&
    emailPattern.test(input?.value.trim() || '')
  ) {
    const redirectMessage = document.createElement('div');
    redirectMessage.textContent = 'User already exists. Redirecting to sign in...';
    redirectMessage.style.color = 'orange';
    redirectMessage.style.fontWeight = 'bold';
    redirectMessage.style.marginTop = '8px';
    input?.parentNode.insertBefore(redirectMessage, input.nextSibling);

    console.warn('[RedirectChecker] Redirecting to sign in...');
    setTimeout(() => {
      window.location.href = signInUrl;
    }, 3000);
  }

  // 👇 If we're on the SignIn.aspx page with ?from=signup_redirect, hide stuff
  const urlParams = new URLSearchParams(window.location.search);
  const fromParam = urlParams.get('from');
  if (fromParam === 'signup_redirect') {
    console.log('[SignInOverride] Redirected from signup — customizing page.');

    // Example: hide "Create Account" section
    const createAccountSection = document.querySelector('#createAccountSection');
    if (createAccountSection) {
      createAccountSection.style.display = 'none';
    }

    // Optional: Add a helpful banner message
    const notice = document.createElement('div');
    notice.textContent = 'We found your account — please sign in below.';
    notice.style.background = '#f6e6cc';
    notice.style.color = '#8a4b00';
    notice.style.padding = '10px';
    notice.style.marginBottom = '10px';
    notice.style.border = '1px solid #dca';
    document.body.prepend(notice);
  }
});


document.addEventListener('DOMContentLoaded', function () {
  const urlParams = new URLSearchParams(window.location.search);
  const fromParam = urlParams.get('from');

  if (fromParam === 'signup_redirect') {
    console.log('[SignInOverride] Redirected from signup — hiding signup and access request options.');

    // Hide entire Sign-Up panel
    const signUpPanel = document.getElementById('ctl00_PageBody_SignUpPanel');
    if (signUpPanel) {
      signUpPanel.style.display = 'none';
    }

    // Hide "Request Access" text block
    const requestAccessText = document.getElementById('ctl00_PageBody_RequestAccessText');
    if (requestAccessText) {
      requestAccessText.style.display = 'none';
    }

    // Hide "Request Access" button
    const requestAccessButton = document.getElementById('ctl00_PageBody_BtnRequestAccess');
    if (requestAccessButton) {
      requestAccessButton.style.display = 'none';
    }

    // Optional: Show a notice that we're skipping account creation
    const notice = document.createElement('div');
    notice.textContent = 'We found your account — please sign in below.';
    notice.style.background = '#f6e6cc';
    notice.style.color = '#8a4b00';
    notice.style.padding = '10px';
    notice.style.marginBottom = '10px';
    notice.style.border = '1px solid #dca';
    document.body.prepend(notice);
  }
});
